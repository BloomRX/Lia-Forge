/**
 * Smoke da jornada de 12 passos (requisito §3 da T13).
 *
 * O roteiro de produção não pode ser decoração: ele tem que acompanhar o estado
 * real do produto. Este teste percorre a jornada inteira — abrir a pasta, enviar
 * uma referência, escolher o objetivo, descrever, conferir requisitos, ler o
 * plano, executar, acompanhar, revisar o gate humano, comparar, exportar e
 * guardar — usando o serviço de verdade sobre um projeto temporário, e deriva o
 * roteiro a cada parada com a mesma função que a interface usa
 * (`shared/ui/journey.mjs`).
 *
 * O que é afirmado em cada parada:
 *   - só vira "concluído" o passo cuja evidência existe (nada de progresso por
 *     otimismo: o número de concluídos nunca diminui, mas também não avança sem
 *     o artefato correspondente);
 *   - o passo que só uma pessoa pode fazer (instalar/autorizar provider, aprovar
 *     revisão, importar na engine) nunca aparece como concluído;
 *   - falta de ferramenta não vira falha do produto;
 *   - a exportação diz que não foi verificada no destino.
 *
 * Sem rede, sem ferramenta externa, sem escrita fora do diretório temporário.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createStudioService } from '../shared/services/studio-service.mjs';
import { ensureProjectStructure } from '../shared/integrations/project-structure.mjs';
import { buildJourneySteps, journeyProgress, isResumableRun, runItemActions, RUN_ACTION_LABELS } from '../shared/ui/journey.mjs';
import { RESUMABLE_RUN_STATES } from '../shared/engine/run-states.mjs';
import { encodePngRgba, analyzePngContent } from '../shared/qa/png-codec.mjs';
import { buildGlbFixture } from './glb-fixtures.mjs';
import { failingToolStub, slowToolStub } from './tool-stubs.mjs';

const DESTINATION = 'godot-4';
const WORKFLOW = '2d-character-parts';
const ORDER = [
  'project', 'references', 'objective', 'brief', 'requirements', 'plan',
  'execute', 'follow', 'review', 'compare', 'export', 'keep',
];

const sleep = (milliseconds) => new Promise((resolve) => { setTimeout(resolve, milliseconds); });

const stepOfJourney = (steps, id) => steps.find((step) => step.id === id);

async function waitFor(probe, { label, timeoutMs = 25000, intervalMs = 60 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await sleep(intervalMs);
  }
  throw new Error(`tempo esgotado esperando ${label}`);
}

const checks = [];
function check(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  assert.ok(condition, message);
}

/** PNG 48×48 com um boneco simples — entrada real, medida antes de entrar no plano. */
function spriteBytes() {
  const width = 48;
  const height = 48;
  const rgba = Buffer.alloc(width * height * 4, 0);
  const paint = (x, y, [r, g, b]) => {
    const at = (y * width + x) * 4;
    rgba[at] = r; rgba[at + 1] = g; rgba[at + 2] = b; rgba[at + 3] = 255;
  };
  for (let y = 8; y < 40; y += 1) {
    for (let x = 14; x < 34; x += 1) paint(x, y, [226, 118, 78]);
  }
  for (let y = 2; y < 10; y += 1) {
    for (let x = 18; x < 30; x += 1) paint(x, y, [246, 214, 176]);
  }
  return encodePngRgba(rgba, width, height);
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-journey-'));
const toolDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-journey-tools-'));
const service = createStudioService({ projectRoot: root });
const trail = [];
const detours = [];

/**
 * Deriva o roteiro do estado atual e registra a parada na trilha da jornada.
 * `detour: true` marca um cenário alternativo (o plano de um objetivo que não
 * pode ser atendido nesta máquina), que sai da trilha porque não é um passo
 * seguinte do mesmo caminho — é outra situação para o roteiro explicar.
 */
function journeyAt(label, state, { detour = false } = {}) {
  const steps = buildJourneySteps(state);
  const progress = journeyProgress(steps);
  (detour ? detours : trail).push({ label, ...progress });
  return { steps, progress };
}

try {
  // ------------------------------------------------ 0. nada aberto ainda
  const empty = journeyAt('sem projeto', {});
  check(empty.progress.total === 12, `o roteiro tem os 12 passos da jornada (${empty.progress.total})`);
  check(empty.steps.map((step) => step.id).join(',') === ORDER.join(','), 'a ordem dos passos é a da jornada pedida');
  check(empty.progress.done === 0, 'sem nada aberto, nenhum passo consta como concluído');
  check(empty.progress.next?.index === 1, 'o próximo passo é abrir a pasta do projeto');
  check(empty.steps.filter((step) => step.state === 'now').length === 1, 'existe um único passo atual (o roteiro não aponta para dois lugares)');

  // ------------------------------------------------ 1. abrir a pasta do projeto
  const structure = await ensureProjectStructure(root);
  check(structure.created.length >= 2, `a criação mínima fez ${structure.created.length} pastas`);
  const project = await service.projectInfo();
  const opened = journeyAt('projeto aberto', { project, requiresInput: true });
  check(opened.progress.done === 1, 'projeto aberto e gravável conclui o passo 1');
  check(opened.steps.find((step) => step.id === 'project').state === 'done', 'passo 1 concluído com a pasta real');
  check(opened.progress.next?.id === 'references', 'o próximo passo passa a ser enviar a referência');

  // ------------------------------------------------ 2. enviar a referência
  const saved = await service.saveInput({ filename: 'referencia.png', bytes: spriteBytes() });
  check(saved.contentChecked === true, 'a entrada foi medida ao entrar (conteúdo verificado)');
  check(saved.path === 'input/referencia.png', `a entrada ficou em ${saved.path}`);
  check(saved.width === 48 && saved.height === 48, `dimensões medidas na entrada (${saved.width}×${saved.height})`);
  const inputs = await service.listInputs();
  const referenced = journeyAt('referência enviada', { project, inputs: inputs.entries, requiresInput: true });
  check(referenced.progress.done === 2, 'a referência em input/ conclui o passo 2');
  check(referenced.steps.find((step) => step.id === 'references').detail.includes('medidos antes de entrar no pipeline'),
    'o passo 2 diz que o arquivo foi medido');

  // ------------------------------------------------ 3./4./6. objetivo, descrição e plano
  const brief = 'heroína neon de 48 px para o capítulo 1';
  const planned = await service.plan({ workflowId: WORKFLOW, destination: DESTINATION, brief });
  const overview = await service.overview();
  const withPlan = journeyAt('plano na tela', {
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: WORKFLOW,
    brief,
    destination: DESTINATION,
    plan: planned.plan,
    preflight: overview.preflight,
  });
  check(withPlan.steps.find((step) => step.id === 'objective').state === 'done', 'objetivo escolhido conclui o passo 3');
  check(withPlan.steps.find((step) => step.id === 'brief').state === 'done', 'descrição escrita conclui o passo 4');
  check(withPlan.steps.find((step) => step.id === 'plan').state === 'done', 'plano lido conclui o passo 6');
  check(withPlan.steps.find((step) => step.id === 'requirements').state === 'done',
    'sem passo bloqueado no plano, conferir requisitos consta como feito');
  check(withPlan.progress.next?.id === 'execute', 'com o plano na tela, o próximo passo é executar');

  // ------------------------------------------- 3.1 requisito não atendido = decisão humana
  const blockedPlan = await service.plan({ workflowId: '3d-character-spritesheet', destination: DESTINATION });
  check((blockedPlan.plan.blockedSteps ?? []).length > 0, 'o plano de 3D sem provider reporta passos bloqueados');
  const human = journeyAt('plano com provider ausente', {
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: '3d-character-spritesheet',
    brief,
    destination: DESTINATION,
    plan: blockedPlan.plan,
    preflight: overview.preflight,
  }, { detour: true });
  const requirementsStep = human.steps.find((step) => step.id === 'requirements');
  check(requirementsStep.state === 'human', 'passo sem provider nesta máquina é decisão humana');
  check(requirementsStep.detail.includes('decisão sua'), 'o passo humano diz o que só o usuário pode fazer');
  check(human.progress.humanDecisions.length > 0, 'o resumo lista as decisões humanas para a interface avisar');

  // ------------------------------------------------ 5./7./8. executar e acompanhar
  const started = await service.run({
    workflowId: WORKFLOW,
    destination: DESTINATION,
    brief,
    params: { sourceImage: saved.path },
  });
  check(started.snapshot.status === 'blocked', `a execução para no gate humano (${started.snapshot.status})`);
  check(started.snapshot.steps.every((step) => step.state !== 'failed'), 'gate humano não vira falha do produto');
  const runId = started.runId ?? started.snapshot.runId;

  let snapshot = started.snapshot;
  const gated = journeyAt('run parado no gate', {
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: WORKFLOW,
    brief,
    destination: DESTINATION,
    plan: planned.plan,
    preflight: overview.preflight,
    run: snapshot,
  });
  check(gated.steps.find((step) => step.id === 'execute').state === 'done', 'existe run: o passo 7 consta como executado');
  check(gated.steps.find((step) => step.id === 'review').state === 'now',
    'com revisão pendente, revisar os artefatos é o passo atual');
  check(gated.steps.find((step) => step.id === 'review').detail.includes('SHA-256'),
    'o passo de revisão diz que a aprovação fica amarrada ao SHA-256');
  check(gated.progress.done < 12, 'roteiro incompleto não aparece como terminado');

  // ------------------------------------------------ 9. revisar e retomar
  let approvals = 0;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const pending = snapshot.steps.find((step) => step.state === 'blocked' && step.review?.status === 'review-missing');
    if (!pending) break;
    const reviewed = await service.reviewStep({ runId, stepId: pending.id, approved: true, reviewer: 'smoke-journey', note: 'conferido' });
    assert.equal(reviewed.resumed, true, `aprovar "${pending.id}" retoma o run`);
    snapshot = reviewed.result;
    approvals += 1;
  }
  check(approvals >= 2, `o fluxo precisou de ${approvals} decisões humanas`);
  check(snapshot.status === 'succeeded', `run concluído depois das revisões (${snapshot.status})`);
  const reviewed = journeyAt('run concluído', {
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: WORKFLOW,
    brief,
    destination: DESTINATION,
    plan: planned.plan,
    preflight: overview.preflight,
    run: snapshot,
  });
  check(reviewed.steps.find((step) => step.id === 'review').state === 'done', 'sem revisão pendente, o passo 9 consta como feito');
  check(reviewed.steps.find((step) => step.id === 'follow').state === 'done', 'run encerrado conclui acompanhar');
  check(reviewed.progress.next?.id === 'export', 'o próximo passo passa a ser exportar');

  // ------------------------------------------- 10. comparar (passo opcional)
  const artifacts = snapshot.steps.flatMap((step) => step.outputs ?? []).filter((output) => output.endsWith('.png'));
  check(artifacts.length >= 2, `o run deixou ${artifacts.length} artefatos comparáveis`);
  const comparison = await service.compareArtifacts({ paths: artifacts.slice(0, 2) });
  check(comparison.entries.length === 2, 'o Comparison Lab mediu as duas variações');
  const compared = journeyAt('variações comparadas', {
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: WORKFLOW,
    brief,
    destination: DESTINATION,
    plan: planned.plan,
    preflight: overview.preflight,
    run: snapshot,
    comparison,
  });
  const compareStep = compared.steps.find((step) => step.id === 'compare');
  check(compareStep.state === 'done', 'comparação medida conclui o passo opcional');
  check(compared.steps.filter((step) => step.id === 'compare' && step.detail.includes('você decide')).length === 1,
    'o passo de comparar deixa claro que a escolha é do usuário');

  // ------------------------------------------------ 11. exportar
  const exported = await service.exportRun({ runId, destination: DESTINATION });
  check(exported.bundle.verifiedOnDestination === false, 'a exportação não afirma import verificado no destino');
  check(exported.bundle.compatibility?.compatible === true,
    `o pacote é compatível com o perfil publicado do destino (${JSON.stringify(exported.bundle.compatibility?.summary)})`);
  check((exported.bundle.compatibility?.summary?.metadata ?? 0) >= 1,
    'os metadados (manifesto da folha, rig, animações) vão no pacote: sem eles o destino não sabe grade, pivô nem fps');
  check((exported.bundle.compatibility?.summary?.assets ?? 0) >= 1, 'e o pacote separa o que é asset importável do que é metadado');
  const exportedJourney = journeyAt('pacote exportado', {
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: WORKFLOW,
    brief,
    destination: DESTINATION,
    plan: planned.plan,
    preflight: overview.preflight,
    run: snapshot,
    comparison,
    exportResult: exported,
  });
  const exportStep = exportedJourney.steps.find((step) => step.id === 'export');
  check(exportStep.state === 'done', 'pacote exportado conclui o passo 11');
  check(exportStep.detail.includes('verificado no destino: não'), 'e diz na tela que não foi verificado no destino');
  check(/asset\(s\) importáveis/.test(exportStep.detail), `o passo diz a composição do pacote (${exportStep.detail.slice(0, 120)})`);

  // Pacote que o destino não aceita: exportar aconteceu, mas não resolveu — a
  // decisão (outro destino ou converter) é humana e o roteiro não pode dizer que
  // está tudo concluído.
  const rejectedExport = {
    ...exported,
    bundle: {
      ...exported.bundle,
      compatibility: {
        ...exported.bundle.compatibility,
        compatible: false,
        blockers: ['render:sprite.psd: formato "psd" não é aceito por Godot 4.x (png, glb)'],
        summary: { ...exported.bundle.compatibility.summary, blockers: 1 },
      },
    },
  };
  const rejectedSteps = buildJourneySteps({
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: WORKFLOW,
    brief,
    destination: DESTINATION,
    plan: planned.plan,
    preflight: overview.preflight,
    run: snapshot,
    comparison,
    exportResult: rejectedExport,
  });
  const rejectedStep = rejectedSteps.find((step) => step.id === 'export');
  check(rejectedStep.state === 'human', 'pacote que o destino recusa não consta como passo concluído');
  check(/não aceita o pacote como está/.test(rejectedStep.detail), 'e o passo diz que o destino não aceita o pacote');
  check(/sprite\.psd/.test(rejectedStep.detail), 'o arquivo recusado é nomeado no passo');
  check(journeyProgress(rejectedSteps).done === exportedJourney.progress.done - 1,
    'a contagem cai exatamente um quando o pacote é recusado');
  check(journeyProgress(rejectedSteps).humanDecisions.some((item) => item.id === 'export'),
    'e a recusa entra como decisão humana no resumo');
  check(exportedJourney.progress.next?.id === 'keep', 'falta só guardar no projeto');

  // ------------------------------------------------ 12. guardar no projeto
  await service.upsertAsset({ id: 'heroina-neon', type: 'character', name: 'Heroína neon' });
  const attached = await service.attachRunToAsset({ assetId: 'heroina-neon', runId });
  check(attached.versions.length === 1, 'o run virou versão do asset');
  const assets = await service.listAssets();
  const finished = journeyAt('resultado guardado', {
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: WORKFLOW,
    brief,
    destination: DESTINATION,
    plan: planned.plan,
    preflight: overview.preflight,
    run: snapshot,
    comparison,
    exportResult: exported,
    assets: assets.assets ?? assets,
  });
  check(finished.steps.find((step) => step.id === 'keep').state === 'done', 'asset com versão conclui o passo 12');
  check(finished.progress.done === 12, `a jornada inteira chegou a ${finished.progress.done} de 12`);
  check(finished.progress.next === null, 'e não sobra passo atual pendente');
  check(finished.progress.humanDecisions.length === 0, 'nada ficou marcado como decisão humana pendente neste fluxo');

  // ---------------------------- 12.1 run interrompido entra no roteiro (§8)
  // O aplicativo foi fechado no meio da execução: o arquivo diz "em andamento" e
  // não há processo aqui. O roteiro não pode apresentar isso como execução viva.
  const interruptedRun = { runId: 'run-interrompido', status: 'running', summary: { finished: false, total: 2, progress: 50 } };
  const interrupted = journeyAt('run interrompido', {
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: WORKFLOW,
    brief,
    destination: DESTINATION,
    plan: planned.plan,
    preflight: overview.preflight,
    run: interruptedRun,
    runStale: true,
  }, { detour: true });
  const followStep = interrupted.steps.find((step) => step.id === 'follow');
  check(followStep.state === 'human', 'run interrompido vira decisão humana no passo de acompanhar');
  check(/não há execução neste processo/.test(followStep.detail), 'e o passo diz que não há execução neste processo');
  check(/"Corrigir estado"/.test(followStep.detail) && /"Retomar do checkpoint"/.test(followStep.detail),
    'o passo nomeia as duas ações que a lista de execuções oferece de verdade, com o nome que cada uma tem no botão');
  check(isResumableRun({ runId: interruptedRun.runId, status: 'running', stale: true, active: false }),
    'o run interrompido é retomável pelo serviço: o botão oferecido não devolve erro');
  check(!isResumableRun({ runId: interruptedRun.runId, status: 'running', active: true }),
    'com a execução viva neste processo o mesmo run não oferece retomada');
  check(interrupted.progress.humanDecisions.some((item) => item.id === 'follow'), 'o resumo lista a recuperação como decisão pendente');
  check(interrupted.steps.find((step) => step.id === 'review').state === 'todo', 'sem run encerrado, revisar não consta como feito');
  const base = {
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: WORKFLOW,
    brief,
    destination: DESTINATION,
    plan: planned.plan,
    preflight: overview.preflight,
  };
  const liveRunState = buildJourneySteps({ ...base, run: interruptedRun, runStale: false, liveRun: { runId: interruptedRun.runId } });
  check(liveRunState.find((step) => step.id === 'follow').state === 'now', 'com a execução viva, o mesmo passo volta a ser o passo atual');
  const finishedIgnored = buildJourneySteps({ ...base, run: snapshot, comparison, exportResult: exported, runStale: true });
  check(finishedIgnored.find((step) => step.id === 'follow').state === 'done', 'run encerrado não vira interrompido só porque o sinal chegou');

  // --------------------- 12.2 run falho e run cancelado entram no roteiro
  // Substitutos de teste (não são Blender) para produzir estados reais de falha e
  // de cancelamento sobre o mesmo projeto.
  const writeTool = async (name, source) => {
    const target = path.join(toolDirectory, name);
    await fs.writeFile(target, source, 'utf8');
    await fs.chmod(target, 0o755);
    return target;
  };
  const failingTool = await writeTool('blender-falha.mjs', failingToolStub());
  const slowTool = await writeTool('blender-lento.mjs', slowToolStub(path.join(toolDirectory, 'lento.pid')));
  const model = await service.saveInput({ filename: 'modelo.glb', bytes: buildGlbFixture() });
  check(model.path === 'input/modelo.glb', `o modelo 3D entrou como ${model.path}`);

  await service.configureProvider({ id: 'blender', mode: 'path', executable: failingTool, frameSize: '48x48' });
  const failedResult = await service.run({
    workflowId: '3d-object-render',
    destination: DESTINATION,
    brief,
    params: { model: model.path },
  });
  check(failedResult.snapshot.status === 'failed', `a ferramenta que falha termina o run como failed (${failedResult.snapshot.status})`);
  const failedJourney = journeyAt('run falho', {
    project,
    inputs: (await service.listInputs()).entries,
    requiresInput: true,
    workflowId: '3d-object-render',
    brief,
    destination: DESTINATION,
    plan: failedResult.plan ?? null,
    preflight: overview.preflight,
    run: failedResult.snapshot,
    assets: assets ?? [],
  }, { detour: true });
  const failedReview = failedJourney.steps.find((step) => step.id === 'review');
  check(failedReview.state === 'human', 'run falho não consta como revisado: o que resta é decisão do usuário');
  check(/terminou com falha em "render"/.test(failedReview.detail), `o passo nomeia onde falhou (${failedReview.detail.slice(0, 90)})`);
  check(/nada aqui foi entregue como pronto/.test(failedReview.detail), 'e diz que nada foi entregue como pronto');
  check(/"Retomar" na lista de execuções/.test(failedReview.detail), 'o passo falho aponta a retomada pelos checkpoints, que o serviço aceita');
  check(failedJourney.steps.find((step) => step.id === 'export').state === 'todo', 'run falho não libera exportação');
  check(failedJourney.steps.find((step) => step.id === 'keep').state === 'todo',
    'asset guardado de outro run não conclui o passo de guardar deste run');
  check(assets.some((asset) => (asset.versions ?? []).length > 0),
    'e o projeto realmente tem asset guardado (a checagem acima não passa por lista vazia)');
  check(assets.every((asset) => (asset.versions ?? []).every((version) => version.runId !== failedResult.snapshot.runId)),
    'nenhuma versão do inventário vem do run falho');
  check(failedJourney.progress.humanDecisions.some((item) => item.id === 'review'), 'a falha aparece como decisão pendente no resumo');

  await service.configureProvider({ id: 'blender', mode: 'path', executable: slowTool, frameSize: '48x48' });
  const cancellingRun = service.run({
    workflowId: '3d-object-render',
    destination: DESTINATION,
    brief,
    params: { model: model.path },
  });
  const activeEntry = await waitFor(async () => (await service.activeRuns())[0] ?? null, { label: 'o run ficar ativo' });
  await service.cancelRun({ runId: activeEntry.runId, reason: 'usuário desistiu desta geração', cancelledBy: 'smoke-journey' });
  const cancelledResult = await cancellingRun;
  check(cancelledResult.snapshot.status === 'cancelled', `o cancelamento termina o run como cancelled (${cancelledResult.snapshot.status})`);
  const cancelledJourney = journeyAt('run cancelado', {
    project,
    inputs: (await service.listInputs()).entries,
    requiresInput: true,
    workflowId: '3d-object-render',
    brief,
    destination: DESTINATION,
    plan: cancelledResult.plan ?? null,
    preflight: overview.preflight,
    run: cancelledResult.snapshot,
    assets: assets ?? [],
  }, { detour: true });
  const cancelledReview = cancelledJourney.steps.find((step) => step.id === 'review');
  check(cancelledReview.state === 'human', 'run cancelado não consta como revisado');
  check(/Run cancelado: usuário desistiu desta geração/.test(cancelledReview.detail), 'o passo diz o motivo gravado do cancelamento');
  check(/"Retomar" na lista de execuções/.test(cancelledReview.detail), 'e aponta a saída que existe na interface (retomar dos checkpoints)');
  check(/executar de novo recomeça do zero/.test(cancelledReview.detail), 'e distingue retomar de recomeçar');
  check(/smoke-journey/.test(cancelledReview.detail), 'a autoria gravada do cancelamento aparece no passo');
  check(cancelledJourney.steps.find((step) => step.id === 'follow').state === 'done', 'acompanhar estava concluído: o run foi encerrado de propósito');
  check(cancelledJourney.steps.find((step) => step.id === 'export').state === 'todo', 'run cancelado não libera exportação');

  // ---- 12.2.1 o roteiro aceita a forma que a interface recebe de verdade
  // A página passa `overview.assets`, onde `versions` é a **contagem** e
  // `versionRunIds` diz de que run cada versão veio. Com a lista de versões ali,
  // a derivação quebrava (TypeError) assim que um run era aberto.
  const summaryOverview = await service.overview();
  const summarized = summaryOverview.assets ?? [];
  check(summarized.length === assets.length, `o overview resume o inventário (${summarized.length} asset(s))`);
  check(summarized.some((asset) => typeof asset.versions === 'number'), 'no resumo, versions é a contagem (formato publicado)');
  check(summarized.some((asset) => (asset.versionRunIds ?? []).includes(runId)),
    'e o resumo diz de qual run vem a versão guardada');
  const summarizedJourney = buildJourneySteps({ ...base, run: snapshot, comparison, exportResult: exported, assets: summarized });
  check(stepOfJourney(summarizedJourney, 'keep').state === 'done',
    'com o resumo do overview, o passo 12 continua concluído para o run guardado');
  check(stepOfJourney(buildJourneySteps({ ...base, run: failedResult.snapshot, assets: summarized }), 'keep').state === 'todo',
    'e continua não concluído para um run que não foi guardado');

  // ------------- 12.3 o botão da lista é exatamente o que o serviço aceita
  // Regra de coerência: a interface não oferece ação que o serviço recusaria
  // (botão que devolve "não precisa de retomada") nem esconde ação aceita.
  const listed = await service.listRuns();
  check(listed.length >= 3, `o projeto tem runs de estados diferentes gravados (${listed.length})`);
  for (const item of listed) {
    const offered = isResumableRun(item);
    const accepted = RESUMABLE_RUN_STATES.includes(item.status)
      || (['running', 'planned'].includes(item.status) && item.active !== true);
    check(!offered || accepted,
      `o run ${item.status}${item.stale ? ' (interrompido)' : ''} só oferece "Retomar" se o serviço aceita (${offered ? 'oferece' : 'não oferece'})`);
    check(item.status !== 'succeeded' || !offered, 'run concluído não oferece retomada');
    check(item.status !== 'blocked' || !offered,
      'run bloqueado por revisão não oferece "Retomar": o que ele espera é a aprovação no painel do run');
  }
  check(listed.some((item) => item.status === 'failed' && isResumableRun(item)),
    'o run que falhou aparece na lista com saída de retomada');
  check(listed.some((item) => item.status === 'cancelled' && isResumableRun(item)),
    'o run cancelado aparece na lista com saída de retomada');
  check(listed.some((item) => item.status === 'succeeded' && !isResumableRun(item)),
    'e o run concluído aparece sem ela');

  // ------- 12.4 um nome só para cada ação: lista, rodapé e roteiro combinam
  // O mesmo botão aparece em três lugares. Se o roteiro manda procurar "Retomar"
  // e a lista mostra "Retomar do checkpoint", o usuário procura um botão que não
  // existe com aquele nome — por isso os rótulos saem de `RUN_ACTION_LABELS`.
  const labelCases = [
    ['concluído', { status: 'succeeded', stale: false, active: false, planStored: true }, null, null],
    ['bloqueado na revisão', { status: 'blocked', stale: false, active: false, planStored: true }, null, null],
    ['falhou', { status: 'failed', stale: false, active: false, planStored: true }, null, RUN_ACTION_LABELS.resumeFinished],
    ['cancelado', { status: 'cancelled', stale: false, active: false, planStored: true }, null, RUN_ACTION_LABELS.resumeFinished],
    ['pausado', { status: 'paused', stale: false, active: false, planStored: true }, null, RUN_ACTION_LABELS.resumeFinished],
    ['em execução agora', { status: 'running', stale: false, active: true, planStored: true }, null, null],
    ['interrompido', { status: 'running', stale: true, active: false, planStored: true }, RUN_ACTION_LABELS.recoverState, RUN_ACTION_LABELS.resumeInterrupted],
    ['interrompido sem plano', { status: 'running', stale: true, active: false, planStored: false }, RUN_ACTION_LABELS.recoverState, null],
    ['encerrado sem plano', { status: 'failed', stale: false, active: false, planStored: false }, null, null],
  ];
  for (const [label, item, expectedCorrect, expectedResume] of labelCases) {
    const actions = runItemActions(item);
    check((actions.correct?.label ?? null) === expectedCorrect,
      `run ${label}: corrigir estado ${expectedCorrect ? `é oferecido como "${expectedCorrect}"` : 'não é oferecido'} (${actions.correct?.label ?? 'nenhum'})`);
    check((actions.resume?.label ?? null) === expectedResume,
      `run ${label}: retomada ${expectedResume ? `é oferecida como "${expectedResume}"` : 'não é oferecida'} (${actions.resume?.label ?? 'nenhuma'})`);
    check(actions.interrupted === (item.stale === true),
      `run ${label}: "interrompido" é exatamente o que a lista marca como tal (sem segundo critério)`);
  }
  check(runItemActions({ status: 'blocked', stale: false, active: false, planStored: true }).note.includes('abra o run para aprovar ou rejeitar'),
    'run bloqueado não ganha botão: ganha o nome da saída real (aprovar ou rejeitar no painel do run)');
  check(runItemActions({ status: 'failed', stale: false, active: false, planStored: true }).note.includes('Corrija a causa antes'),
    'run falho avisa que retomar sem corrigir a causa repete a falha (medido no ciclo de vida)');
  for (const item of listed) {
    const actions = runItemActions(item);
    check(actions.interrupted === (item.stale === true),
      `no run real ${item.runId} (${item.status}), a regra e a lista concordam sobre ser interrompido`);
    check(!actions.resume || isResumableRun(item), 'nenhum rótulo de retomada existe sem a retomada ser aceita');
  }

  // ------------------------------------------------ honestidade do roteiro
  // Tirar a evidência tem que tirar o "concluído": o estado nunca é decorativo.
  const state = {
    project,
    inputs: inputs.entries,
    requiresInput: true,
    workflowId: WORKFLOW,
    brief,
    destination: DESTINATION,
    plan: planned.plan,
    preflight: overview.preflight,
    run: snapshot,
    comparison,
    exportResult: exported,
    assets: assets.assets ?? assets,
  };
  const stepOf = (steps, id) => steps.find((step) => step.id === id);
  const withoutExport = buildJourneySteps({ ...state, exportResult: null });
  check(stepOf(withoutExport, 'export').state !== 'done', 'sem o pacote, o passo de exportar não consta como feito');
  check(journeyProgress(withoutExport).done === finished.progress.done - 1, 'e a contagem cai exatamente um');

  const withoutComparison = buildJourneySteps({ ...state, comparison: null });
  check(stepOf(withoutComparison, 'compare').state === 'optional', 'sem comparação medida, o passo opcional volta a ser opcional');

  const withoutRun = buildJourneySteps({ ...state, run: null });
  for (const id of ['execute', 'follow', 'review']) {
    check(stepOf(withoutRun, id).state !== 'done', `sem o run, o passo "${id}" não consta como feito`);
  }

  const withoutKept = buildJourneySteps({ ...state, assets: [] });
  check(stepOf(withoutKept, 'keep').state !== 'done', 'sem versão guardada, o passo 12 não consta como feito');

  const withoutProject = buildJourneySteps({ ...state, project: null });
  check(stepOf(withoutProject, 'project').state === 'now', 'sem a pasta aberta, o passo 1 volta a ser o passo atual');
  check(journeyProgress(withoutProject).done === finished.progress.done - 1, 'e só ele sai da contagem');

  const withoutBrief = buildJourneySteps({ ...state, brief: '' });
  check(stepOf(withoutBrief, 'brief').state !== 'done', 'sem texto escrito, o passo 4 não consta como feito');

  const withoutEvidence = journeyProgress(buildJourneySteps({}));
  check(withoutEvidence.done === 0, 'estado vazio = zero passos concluídos');

  // Progresso nunca aumentou sem a evidência correspondente.
  const sequence = trail.map((stop) => stop.done);
  check(sequence.every((value, index) => index === 0 || value >= sequence[index - 1]),
    `o progresso só avançou com evidência (${sequence.join(' → ')})`);
  check(sequence.at(-1) === 12, 'a última parada da trilha é a jornada completa');
  check(detours.length === 4, `os quatro cenários alternativos ficam fora da trilha (${detours.length})`);
  check(detours.every((stop) => stop.humanDecisions.length > 0),
    'cada cenário alternativo (objetivo sem provider aqui, run interrompido) é registrado como decisão humana, não como progresso');
  check(trail.every((stop) => stop.humanDecisions.length === 0),
    'nenhuma parada da jornada concluída deixou decisão humana pendente');

  // O pacote existe de verdade e o atlas segue o contrato publicado.
  const rendered = snapshot.steps.find((step) => step.id === 'render');
  check(rendered?.metrics?.frames === 24, '24 frames preservados no run da jornada');
  check(rendered?.metrics?.grid?.columns === 8 && rendered?.metrics?.grid?.rows === 3, 'grade 8×3 preservada');
  const atlasPath = exported.path ?? exported.bundle?.path;
  check(typeof atlasPath === 'string' && atlasPath.length > 0, `pacote gravado em ${atlasPath}`);
  const atlasPng = (rendered?.outputs ?? []).find((output) => output.endsWith('.png'));
  const atlasMetrics = analyzePngContent(await fs.readFile(path.join(root, atlasPng)));
  check(atlasMetrics.width === 384 && atlasMetrics.height === 144, `atlas 384×144 medido (${atlasMetrics.width}×${atlasMetrics.height})`);
  check(atlasMetrics.blank === false, 'o atlas tem conteúdo de verdade');

  console.log(`Journey smoke test passed (jornada de 12 passos percorrida com o serviço real: ${checks.length} checagens · progresso ${sequence.join(' → ')} · run ${runId} ${snapshot.status} · pacote ${path.basename(exported.path ?? '')}).`);
} finally {
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(toolDirectory, { recursive: true, force: true });
}
