#!/usr/bin/env node
/**
 * Smoke de ciclo de vida do run: cancelamento, falha intermediária, retomada e
 * progresso gravado por passo (§8 do contrato e §12 de testes).
 *
 * Um **executável de teste** (`tests/tool-stubs.mjs`) ocupa o lugar do Blender,
 * que não está instalado neste ambiente. O caminho de código percorrido é o
 * real: `spawn` com os argumentos do contrato, signal de cancelamento chegando
 * ao processo filho, leitura da saída, validação declarada, checkpoints e
 * retomada. Nada aqui afirma que o Blender renderizou.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createStudioService } from '../shared/services/studio-service.mjs';
import { buildGlbFixture } from './glb-fixtures.mjs';
import { codecShimSource, rendererStub, slowToolStub, failingToolStub } from './tool-stubs.mjs';
import { isResumableRun } from '../shared/ui/journey.mjs';
import { RESUMABLE_RUN_STATES } from '../shared/engine/run-states.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const findings = [];

function check(condition, message) {
  assert.ok(condition, message);
  findings.push(message);
}

const sleep = (milliseconds) => new Promise((resolve) => { setTimeout(resolve, milliseconds); });

async function waitFor(probe, { label, timeoutMs = 25000, intervalMs = 60 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await probe();
    if (last) return last;
    await sleep(intervalMs);
  }
  throw new Error(`tempo esgotado esperando ${label}`);
}

async function isAlive(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-lifecycle-'));
const toolDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-lifecycle-tools-'));

try {
  await fs.mkdir(path.join(projectRoot, 'input'), { recursive: true });
  await fs.writeFile(path.join(projectRoot, 'input', 'modelo.glb'), buildGlbFixture());

  const shimPath = path.join(toolDirectory, 'codec-shim.mjs');
  await fs.writeFile(shimPath, codecShimSource({
    imagingUrl: pathToFileURL(path.join(REPO_ROOT, 'shared', 'imaging', 'core.mjs')).href,
    pngCodecUrl: pathToFileURL(path.join(REPO_ROOT, 'shared', 'qa', 'png-codec.mjs')).href,
  }), 'utf8');

  const writeTool = async (name, source) => {
    const target = path.join(toolDirectory, name);
    await fs.writeFile(target, source, 'utf8');
    await fs.chmod(target, 0o755);
    return target;
  };
  const pidFile = path.join(toolDirectory, 'processo-lento.pid');
  const slowTool = await writeTool('blender-lento.mjs', slowToolStub(pidFile));
  const failingTool = await writeTool('blender-falha.mjs', failingToolStub());
  const renderingTool = await writeTool('blender-render.mjs', rendererStub(pathToFileURL(shimPath).href));

  const service = createStudioService({ projectRoot });
  const useTool = (executable) => service.configureProvider({ id: 'blender', mode: 'path', executable, frameSize: '48x48' });
  const startRender = () => service.run({
    workflowId: '3d-object-render',
    brief: 'herói de teste para o ciclo de vida do run',
    destination: 'godot-4',
    params: { model: 'input/modelo.glb' },
  });

  // ------------------------------------------- 1. cancelamento de verdade
  await useTool(slowTool);
  const running = startRender();
  const active = await waitFor(async () => service.activeRuns()[0] ?? null, { label: 'o run aparecer como ativo' });
  check(active.workflowId === '3d-object-render', 'a execução em andamento é visível para a interface (activeRuns)');
  const runId = active.runId;

  // O snapshot é gravado a cada passo terminado: o progresso existe antes do fim.
  const during = await waitFor(async () => {
    const snapshot = await service.readRun(runId).catch(() => null);
    if (!snapshot) return null;
    return snapshot.steps.some((step) => step.state === 'succeeded') && snapshot.status === 'running' ? snapshot : null;
  }, { label: 'o snapshot gravado durante a execução' });
  check(during.summary?.finished !== true, 'o run é gravado como em andamento enquanto executa');
  check(during.steps.some((step) => step.state === 'running'), 'o passo em andamento aparece no snapshot gravado em disco');

  // A lista de runs diz a verdade sobre a execução enquanto ela acontece.
  const whileRunning = (await service.listRuns()).find((item) => item.runId === runId);
  check(whileRunning?.active === true, 'a lista de runs marca como ativo o run que está executando neste processo');
  check(whileRunning?.stale === false, 'run ativo não é marcado como interrompido');

  // O processo externo tem que estar de pé antes do sinal: cancelar um filho que
  // ainda nem gravou o PID deixaria o teste dependente de corrida (o node do
  // substituto leva alguns milissegundos para iniciar e escrever o arquivo).
  const childPid = await waitFor(async () => {
    const pid = await fs.readFile(pidFile, 'utf8').catch(() => null);
    return pid && (await isAlive(pid)) ? String(pid).trim() : null;
  }, { label: 'o processo externo de teste iniciar e gravar o PID' });
  check(childPid !== null, 'o processo externo de teste chegou a iniciar (PID gravado e processo vivo)');

  const cancelling = await service.cancelRun({ runId, reason: 'usuário desistiu desta geração' });
  check(cancelling.ok === true && cancelling.status === 'cancelling', 'cancelRun envia o sinal e diz que o run está parando');
  check(/ponto de verificação/.test(cancelling.note), 'a resposta explica que o cancelamento é cooperativo');

  const cancelled = await running;
  check(cancelled.snapshot.status === 'cancelled', `o run termina cancelado (${cancelled.snapshot.status})`);
  const afterCancel = (await service.listRuns()).find((item) => item.runId === runId);
  check(afterCancel?.active === false && afterCancel?.stale === false && afterCancel?.status === 'cancelled',
    'depois do cancelamento a lista mostra o run encerrado, nem ativo nem interrompido');
  const cancelledStep = cancelled.snapshot.steps.find((step) => step.state === 'cancelled');
  check(Boolean(cancelledStep), 'o passo que estava em andamento fica marcado como cancelado');
  check(cancelledStep.error?.code === 'WORKFLOW_CANCELLED', `o motivo é WORKFLOW_CANCELLED (${cancelledStep.error?.code})`);
  check(cancelled.snapshot.steps.every((step) => step.state !== 'running'), 'nenhum passo continua "em andamento" depois do cancelamento');
  check(cancelled.snapshot.summary?.finished === true, 'o resumo diz que o run está encerrado');
  check((cancelled.snapshot.logs ?? []).some((entry) => /cancel/i.test(entry.message)), 'o cancelamento fica no log do run');

  await waitFor(async () => (!(await isAlive(childPid)) ? { dead: true } : null), { label: 'o processo filho encerrar' });
  check(!(await isAlive(childPid)), 'o processo externo foi encerrado de verdade — não ficou rodando sozinho');

  // cancelar de novo não altera nada e não finge sucesso
  const before = await fs.readFile(path.join(projectRoot, '.lia-forge', 'runs', runId, 'run.json'), 'utf8');
  const again = await service.cancelRun({ runId, reason: 'segundo cancelamento' });
  check(again.ok === false && /encerrado/.test(again.reason), 'cancelar um run já encerrado devolve ok:false com o estado real');
  const after = await fs.readFile(path.join(projectRoot, '.lia-forge', 'runs', runId, 'run.json'), 'utf8');
  check(before === after, 'nada foi reescrito no run já encerrado');

  // ------------------------------------------------- 2. retomada do cancelado
  await useTool(renderingTool);
  const inspectedBefore = cancelled.snapshot.steps.find((step) => step.state === 'succeeded');
  const resumed = await service.resumeRun({ runId, reason: 'usuário decidiu continuar' });
  check(resumed.ok === true && resumed.resumedFrom === 'cancelled', 'resumeRun retoma o run que estava cancelado');
  check(resumed.checkpointsReused >= 1, `checkpoints reaproveitados na retomada (${resumed.checkpointsReused})`);
  check(['blocked', 'succeeded'].includes(resumed.result.status), `a retomada segue até o próximo ponto de decisão (${resumed.result.status})`);
  const inspectedAfter = resumed.result.steps.find((step) => step.id === inspectedBefore.id);
  check(inspectedAfter.finishedAt === inspectedBefore.finishedAt, 'o passo já concluído não é reexecutado na retomada');
  check(resumed.result.steps.some((step) => step.state === 'succeeded' && step.execution?.kind === 'process'),
    'o passo que faltava executa de verdade na retomada (processo externo)');
  check((resumed.result.events ?? []).some((event) => event.type === 'step-reused'),
    'a retomada registra no histórico qual passo foi reaproveitado do checkpoint');

  // ------------------------------------------- 3. falha intermediária do run
  await useTool(failingTool);
  const failed = await startRender();
  check(failed.snapshot.status === 'failed', `falha na ferramenta externa termina o run como failed (${failed.snapshot.status})`);
  const failedStep = failed.snapshot.steps.find((step) => step.state === 'failed');
  check(Boolean(failedStep), 'o passo que falhou está identificado');
  check(/código 3/.test(failedStep.error?.message ?? ''), 'a mensagem traz o código de saída real do processo');
  check(/dispositivo de render ausente/.test(failedStep.error?.message ?? ''), 'o stderr do processo é preservado no motivo');
  check(failed.snapshot.steps.some((step) => step.state === 'skipped'), 'passos dependentes do que falhou são pulados, não executados às cegas');
  check(failed.snapshot.summary?.finished === true, 'o run falho é gravado como encerrado');

  await useTool(renderingTool);
  const recovered = await service.resumeRun({ runId: failed.runId });
  check(recovered.ok === true && recovered.resumedFrom === 'failed', 'um run que falhou pode ser retomado depois de corrigida a causa');
  check(['blocked', 'succeeded'].includes(recovered.result.status), `a retomada depois da falha avança (${recovered.result.status})`);

  // ----------------------------- 4. run órfão: sem execução neste processo
  const orphanDirectory = path.join(projectRoot, '.lia-forge', 'runs', 'run-orfao-de-teste');
  await fs.mkdir(orphanDirectory, { recursive: true });
  await fs.writeFile(path.join(orphanDirectory, 'run.json'), `${JSON.stringify({
    schemaVersion: 1,
    runId: 'run-orfao-de-teste',
    planId: '3d-object-render',
    planTitle: 'Render de objeto 3D',
    status: 'running',
    startedAt: new Date(Date.now() - 60000).toISOString(),
    finishedAt: null,
    steps: [
      { id: 'inspect', adapter: 'glb-inspect', state: 'succeeded', outputs: [], sha256: null, finishedAt: new Date().toISOString() },
      { id: 'render', adapter: 'blender-spritesheet', state: 'running', outputs: [], error: null },
      { id: 'deliver', adapter: 'export-package', state: 'pending', outputs: [], error: null },
    ],
    gates: [],
    logs: [],
    provenance: [],
    cost: { status: 'unknown', entries: [], total: null, currency: null },
    summary: { total: 3, progress: 33, finished: false, failed: [], blocked: [] },
  }, null, 2)}\n`, 'utf8');

  const orphanListed = (await service.listRuns()).find((item) => item.runId === 'run-orfao-de-teste');
  check(orphanListed?.stale === true, 'run gravado como em andamento sem execução aqui é marcado como interrompido');
  check(orphanListed?.active === false, 'e não aparece como ativo neste processo');
  check(orphanListed?.planStored === false, 'a lista diz que o plano original não está gravado');
  check(isResumableRun(orphanListed) === false,
    'sem plano gravado a interface não oferece "Retomar" — o botão só existe onde o serviço consegue retomar');

  const orphan = await service.cancelRun({ runId: 'run-orfao-de-teste', reason: 'o aplicativo foi fechado durante a execução' });
  check(orphan.ok === true && orphan.stale === true, 'run marcado como em andamento sem execução aqui é corrigido com a marca de execução ausente');
  check(/não havia execução neste processo/i.test(orphan.note), 'a resposta não finge que parou um processo que não existia');
  const orphanSnapshot = await service.readRun('run-orfao-de-teste');
  check(orphanSnapshot.status === 'cancelled', 'o estado gravado do run órfão passa a cancelado');
  check(orphanSnapshot.cancelled?.executionPresent === false, 'fica registrado que não havia execução neste processo');
  check(orphanSnapshot.steps.find((step) => step.id === 'inspect').state === 'succeeded', 'o que já estava concluído não é rebaixado');
  check(orphanSnapshot.steps.find((step) => step.id === 'render').state === 'cancelled', 'o passo que aparecia em andamento é marcado como cancelado');
  await assert.rejects(() => service.resumeRun({ runId: 'run-orfao-de-teste' }),
    /plano original .* não foi encontrado/, 'retomar sem o plano original é recusado com motivo claro');
  const orphanAfter = (await service.listRuns()).find((item) => item.runId === 'run-orfao-de-teste');
  check(orphanAfter?.stale === false && orphanAfter?.status === 'cancelled',
    'depois de corrigido, o run deixa de aparecer como interrompido e consta cancelado');

  // ------- 4.2 interrompido com plano e checkpoints no disco: retomar funciona
  // O caso que a interface oferece como "Retomar": o aplicativo foi fechado no
  // meio, o run consta `running`, não há execução neste processo, e o plano
  // original mais os passos concluídos continuam gravados.
  const interruptedId = 'run-interrompido-com-plano';
  const interruptedDirectory = path.join(projectRoot, '.lia-forge', 'runs', interruptedId);
  await fs.mkdir(interruptedDirectory, { recursive: true });
  await fs.copyFile(path.join(projectRoot, '.lia-forge', 'runs', runId, 'plan.json'), path.join(interruptedDirectory, 'plan.json'));
  const sourceSnapshot = JSON.parse(await fs.readFile(path.join(projectRoot, '.lia-forge', 'runs', runId, 'run.json'), 'utf8'));
  let runningMarked = false;
  const interruptedSteps = (sourceSnapshot.steps ?? []).map((step) => {
    if (step.state === 'succeeded') return step;
    if (!runningMarked) { runningMarked = true; return { ...step, state: 'running', error: null, finishedAt: null }; }
    return { ...step, state: 'pending', error: null, finishedAt: null };
  });
  await fs.writeFile(path.join(interruptedDirectory, 'run.json'), `${JSON.stringify({
    ...sourceSnapshot,
    runId: interruptedId,
    status: 'running',
    finishedAt: null,
    steps: interruptedSteps,
    summary: { ...sourceSnapshot.summary, finished: false },
  }, null, 2)}\n`, 'utf8');

  const interruptedListed = (await service.listRuns()).find((item) => item.runId === interruptedId);
  check(interruptedListed?.stale === true && interruptedListed?.active === false,
    'o run gravado como em andamento sem execução aqui aparece como interrompido');
  check(interruptedListed?.planStored === true, 'a lista confirma que o plano original continua gravado');
  check(isResumableRun(interruptedListed) === true, 'a lista oferece "Retomar" para ele (mesma regra da interface)');

  await useTool(renderingTool);
  const resumedInterrupted = await service.resumeRun({ runId: interruptedId, reason: 'usuário reabriu o aplicativo' });
  check(resumedInterrupted.ok === true, 'retomar o run interrompido é aceito — não devolve "não precisa de retomada"');
  check(resumedInterrupted.interrupted === true && resumedInterrupted.resumedFrom === 'running',
    'a resposta diz que a retomada vem de uma execução interrompida');
  check(resumedInterrupted.checkpointsReused >= 1,
    `os passos concluídos antes da interrupção são reaproveitados (${resumedInterrupted.checkpointsReused})`);
  check(['blocked', 'succeeded'].includes(resumedInterrupted.result.status),
    `a retomada do interrompido segue até o próximo ponto real (${resumedInterrupted.result.status})`);
  check((await service.listRuns()).find((item) => item.runId === interruptedId)?.stale === false,
    'depois de retomado o run deixa de constar como interrompido');

  // Coerência geral: nenhum run da lista oferece uma ação que o serviço recusaria.
  for (const item of await service.listRuns()) {
    const offered = isResumableRun(item);
    const accepted = RESUMABLE_RUN_STATES.includes(item.status)
      || (['running', 'planned'].includes(item.status) && item.active !== true);
    check(!offered || accepted,
      `"Retomar" só é oferecido onde o serviço aceita (run ${item.status}${item.stale ? ' interrompido' : ''}: ${offered ? 'oferece' : 'não oferece'})`);
  }

  // ------------------------------------------------------- 5. recusas e limites
  await assert.rejects(() => service.cancelRun({ runId: '../../etc/passwd' }), /runId inválido/, 'cancelRun recusa caminho como runId');
  await assert.rejects(() => service.resumeRun({ runId: '../fora' }), /runId inválido/, 'resumeRun recusa caminho como runId');
  await assert.rejects(() => service.cancelRun({ runId: 'run-que-nao-existe' }), /não encontrado/, 'cancelRun diz quando o run não existe');
  await assert.rejects(() => service.resumeRun({ runId: 'run-que-nao-existe' }), /não encontrado/, 'resumeRun diz quando o run não existe');

  const finished = await service.run({ workflowId: 'ui-vfx-sheet', brief: 'brilho neon', destination: 'web-canvas' });
  check(finished.snapshot.status === 'succeeded', `run interno de controle conclui (${finished.snapshot.status})`);
  const noop = await service.cancelRun({ runId: finished.runId });
  check(noop.ok === false && noop.status === 'succeeded', 'cancelar um run concluído não altera nada e devolve o estado real');
  check(isResumableRun((await service.listRuns()).find((item) => item.runId === finished.runId)) === false,
    'run concluído não oferece "Retomar" na lista');
  const noopResume = await service.resumeRun({ runId: finished.runId });
  check(noopResume.ok === false && /não precisa de retomada/.test(noopResume.reason), 'retomar um run concluído é recusado sem mexer no disco');
  check(service.activeRuns().length === 0, 'nenhuma execução fica registrada como ativa depois de encerrada');

  console.log(`Run lifecycle smoke test passed (cancelamento cooperativo com processo externo encerrado, falha intermediária, retomada por checkpoint — inclusive de run interrompido —, run órfão corrigido sem fingir execução, recusas nomeadas).`);
  for (const finding of findings) console.log(`  · ${finding}`);
  console.log('  · Substitutos de teste (não são Blender): executáveis criados por este smoke em pasta temporária; a execução na ferramenta real continua pendente de instalação pelo usuário.');
} finally {
  await fs.rm(projectRoot, { recursive: true, force: true });
  await fs.rm(toolDirectory, { recursive: true, force: true });
}
