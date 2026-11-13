/**
 * Smoke do serviço de integração do Studio (F8 — requisitos §3, §4, §11, §12).
 *
 * Este teste executa o produto de ponta a ponta em um projeto temporário real:
 *   1. visão geral (máquina, capacidades, adapters, preflight, workflows);
 *   2. planejamento sem execução (§10: o Orchestrator planeja e não executa);
 *   3. execução de um workflow só com adapters internos (VFX);
 *   4. fluxo completo com revisão humana + retomada por checkpoint (2D
 *      character), preservando o contrato 384×144 / 8×3 / 24 frames / 48×48;
 *   5. revisão rejeitada mantém o run bloqueado;
 *   6. ferramenta ausente nunca é apresentada como disponível;
 *   7. segredos redigidos no que é gravado em disco;
 *   8. escrita/leitura confinada ao projeto (traversal recusado);
 *   9. exportação por destino com SHA-256 e sem afirmar validação no destino;
 *  10. Asset Manager integrado (versão + proveniência + direitos).
 *
 * Nada aqui instala, baixa, compra ou envia: só código do checkout.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createStudioService } from '../shared/services/studio-service.mjs';
import { createImage } from '../shared/imaging/core.mjs';
import { decodePng, encodePngRgba, analyzePngContent } from '../shared/qa/png-codec.mjs';
import { WORKFLOW_IDS } from '../shared/orchestrator/planner.mjs';

function check(condition, message) {
  assert.ok(condition, message);
}

/** Sprite 48×48 com 6 regiões conexas (cabeça, torso, 2 braços, 2 pernas). */
function makeSprite() {
  const image = createImage(48, 48);
  const paint = (x0, y0, width, height, color) => {
    for (let y = y0; y < y0 + height; y += 1) {
      for (let x = x0; x < x0 + width; x += 1) image.rgba.set(color, (y * 48 + x) * 4);
    }
  };
  paint(18, 2, 12, 10, [240, 210, 190, 255]); // cabeça
  paint(16, 13, 16, 16, [200, 60, 160, 255]); // torso
  paint(9, 14, 6, 13, [180, 50, 140, 255]); // braço esquerdo
  paint(33, 14, 6, 13, [180, 50, 140, 255]); // braço direito
  paint(17, 30, 6, 15, [90, 40, 120, 255]); // perna esquerda
  paint(25, 30, 6, 15, [90, 40, 120, 255]); // perna direita
  return image;
}

const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-studio-smoke-'));

try {
  await fs.mkdir(path.join(projectRoot, 'input'), { recursive: true });
  const sprite = makeSprite();
  const spritePng = encodePngRgba(sprite.rgba, sprite.width, sprite.height);
  await fs.writeFile(path.join(projectRoot, 'input', 'sprite.png'), spritePng);

  const service = createStudioService({ projectRoot });
  check(service.schemaVersion === 1, 'schemaVersion do serviço é 1');
  check(path.resolve(service.projectRoot) === projectRoot, 'projectRoot resolvido');

  // ------------------------------------------------------- 1. visão geral
  const overview = await service.overview();
  check(overview.capabilities.length === 49, `49 capacidades (${overview.capabilities.length})`);
  check(new Set(overview.capabilities.map((item) => item.family)).size === 7, '7 famílias de capacidade');
  check(overview.adapters.length === 7, `7 adapters descritos (${overview.adapters.length})`);
  check(overview.machine.gpu === null, 'GPU não é afirmada sem probe autorizado');
  check(/probe/i.test(overview.machine.gpuNote), 'a nota explica que o probe de GPU não foi executado');
  check(overview.machine.ramMb > 0 && overview.machine.cpus > 0, 'RAM e CPU medidas de verdade');
  check(Number.isFinite(overview.machine.diskMb) || overview.machine.diskMb === null, 'disco medido ou null (nunca inventado)');
  check(/nenhuma ferramenta foi instalada/i.test(overview.note), 'a visão geral afirma que nada foi instalado/baixado');
  check(overview.preflight.userActions.every((action) => action.canBeAutomated === false && action.requiresUserDecision === true),
    'toda ação de usuário exige decisão humana (nada automatizável)');
  check(overview.destinations.length === 6, `6 destinos de exportação (${overview.destinations.length})`);
  check(overview.workflows.length === WORKFLOW_IDS.length, `todos os ${WORKFLOW_IDS.length} workflows aparecem na visão geral`);

  const executable = overview.workflows.filter((workflow) => workflow.executableNow);
  check(executable.length === 5, `5 workflows executáveis só com adapters internos (${executable.length})`);
  check(executable.every((workflow) => workflow.blocked === 0 && workflow.ready === workflow.steps),
    'executável = todos os passos com adapter pronto (nenhum bloqueado)');
  check(overview.workflows.filter((workflow) => !workflow.executableNow)
    .every((workflow) => workflow.states.filter((state) => state.state === 'blocked').every((state) => typeof state.reason === 'string' && state.reason.length > 0)),
    'todo passo bloqueado na lista explica o motivo');

  // ------------------------------- 2. planejamento sem execução (§10)
  const planned = await service.plan({ workflowId: '3d-character-spritesheet', destination: 'godot-4' });
  check(planned.plan.preservesContract === 'humanoid-prompt-views-to-2d-v1',
    'o plano preserva o contrato publicado do workflow humanoide');
  check(planned.plan.blocked === true, 'workflow 3D→2D aparece bloqueado neste ambiente (sem Blender/provider 3D)');
  check(planned.plan.blockedSteps.length > 0, 'os passos bloqueados são nomeados');
  for (const blocked of planned.plan.blockedSteps) {
    check(typeof blocked.reason === 'string' && blocked.reason.length > 0,
      `passo "${blocked.id}" explica por que está bloqueado`);
    const step = planned.plan.steps.find((item) => item.id === blocked.id);
    check(step.adapter === null, `passo bloqueado "${blocked.id}" não recebe adapter inventado`);
    check(typeof step.blockedReason === 'string' && step.blockedReason.length > 0, 'o passo carrega blockedReason (fail-closed, como no contrato publicado)');
  }
  const render2d = planned.plan.steps.find((step) => step.id === 'render-2d');
  check(render2d.candidates.some((candidate) => candidate.adapterId === 'blender-spritesheet'),
    'o adapter real do Blender continua sendo o candidato nomeado (contrato preservado)');
  check(render2d.candidates.every((candidate) => candidate.state !== 'ready'),
    'nenhum candidato é apresentado como pronto sem a ferramenta presente');
  check(planned.plan.userActions.every((action) => action.canBeAutomated === false),
    'instalações/autorizações nunca são automatizadas pelo plano');

  // Sem o texto do usuário, o plano pede o prompt antes de qualquer ferramenta.
  const semTexto = await service.plan({ workflowId: '2d-art-concept' });
  check(semTexto.plan.pendingInputs.some((item) => item.param === 'prompt'), 'o plano pede o texto da arte quando o usuário não escreveu nada');
  check(semTexto.plan.userActions.every((action) => action.canBeAutomated === false), 'escrever o prompt é decisão humana');

  const concept = await service.plan({ workflowId: '2d-art-concept', brief: 'Heroína de neon correndo sob chuva roxa, vista lateral' });
  check(concept.plan.pendingInputs.length === 0, 'o brief escrito pelo usuário satisfaz a entrada de texto');
  check(concept.plan.blocked === true, 'geração de conceito (ComfyUI) bloqueada sem o serviço');
  check(/comfyui/i.test(JSON.stringify(concept.plan.blockedSteps)), 'o motivo nomeia o ComfyUI');
  check(concept.plan.userActions.every((action) => action.canBeAutomated === false), 'as ações do plano exigem decisão humana');
  const remoteAction = concept.plan.userActions.flatMap((action) => action.candidates ?? [])
    .find((candidate) => candidate.adapterId === 'comfyui-remote');
  check(remoteAction && remoteAction.state === 'blocked', 'o backend remoto aparece bloqueado (nunca como disponível)');
  check(/não autorizado/i.test(remoteAction.detail), 'o motivo diz que o backend remoto não foi autorizado');

  // --------------------------------------- 3. run só com adapters internos
  const vfxRun = await service.run({
    workflowId: 'ui-vfx-sheet',
    destination: 'godot-4',
    brief: 'Impacto neon para a interface',
    options: { vfx: { preset: 'impact', size: 64, frameCount: 8 } },
  });
  if (process.env.LIA_SMOKE_DEBUG && vfxRun.snapshot.status !== 'succeeded') {
    for (const step of vfxRun.snapshot.steps) console.error('DEBUG', step.id, step.state, step.error?.code, step.error?.message);
    console.error('DEBUG logs', vfxRun.snapshot.logs.map((entry) => `${entry.level}: ${entry.message}`).join(' | '));
  }
  check(vfxRun.snapshot.status === 'succeeded', `run de VFX succeeds (${vfxRun.snapshot.status})`);
  check(vfxRun.runId === vfxRun.snapshot.runId, 'o id do run é o mesmo na pasta e no snapshot');
  const vfxStep = vfxRun.snapshot.steps.find((step) => step.id === 'vfx');
  check(vfxStep.state === 'succeeded' && vfxStep.outputs.length === 1, 'passo de VFX gravou um atlas');
  check(typeof vfxStep.sha256 === 'string' && vfxStep.sha256.length === 64, 'SHA-256 do artefato registrado');

  const vfxPath = path.join(projectRoot, vfxStep.outputs[0]);
  const vfxBytes = await fs.readFile(vfxPath);
  const vfxAnalysis = analyzePngContent(vfxBytes, { grid: { columns: vfxStep.metrics.grid.columns, rows: vfxStep.metrics.grid.rows } });
  check(vfxAnalysis.blank === false, 'o atlas de VFX não está em branco (validação de conteúdo, lacuna G8)');
  check(vfxAnalysis.coverage > 0.0005, `cobertura real medida: ${(vfxAnalysis.coverage * 100).toFixed(2)}%`);
  check(vfxAnalysis.uniqueColors >= 2, `cores únicas medidas: ${vfxAnalysis.uniqueColors}`);

  // O passo opcional compõe a prévia sobre o fundo do produto usando o atlas
  // gravado pelo passo anterior: entrada implícita por artefato, não por memória.
  const composeStep = vfxRun.snapshot.steps.find((step) => step.id === 'compose');
  check(composeStep.state === 'succeeded', `passo opcional compõe a prévia com o artefato anterior (${composeStep.state})`);
  check(composeStep.outputs.length === 1, 'a prévia composta foi gravada');
  check(
    composeStep.validations.some((item) => item.validator === 'png-content' && item.status === 'passed'),
    'a validação declarada no plano foi executada de verdade na prévia composta',
  );
  const composedBytes = await fs.readFile(path.join(projectRoot, composeStep.outputs[0]));
  check(analyzePngContent(composedBytes).blank === false, 'a prévia composta tem conteúdo real');

  // Passo opcional que falha não derruba o run: vira skip com o motivo (§8).
  const optionalFailure = await service.run({
    workflowId: 'ui-vfx-sheet',
    destination: 'godot-4',
    options: { vfx: { preset: 'spark', size: 48, frameCount: 6 }, compose: { op: 'operacao-inexistente' } },
  });
  check(optionalFailure.snapshot.status === 'succeeded', `run segue apesar da falha do passo opcional (${optionalFailure.snapshot.status})`);
  const skippedCompose = optionalFailure.snapshot.steps.find((step) => step.id === 'compose');
  check(skippedCompose.state === 'skipped', 'passo opcional com erro vira skip, não falha');
  check(/não concluído/i.test(optionalFailure.snapshot.events.find((event) => event.type === 'step-skipped' && event.stepId === 'compose')?.message ?? ''), 'o evento explica que o passo opcional não foi concluído');

  const runDirectory = path.join(projectRoot, '.lia-forge', 'runs', vfxRun.runId);
  check(await fs.stat(path.join(runDirectory, 'run.json')).then((stats) => stats.isFile()), 'run.json persistido');
  check(await fs.stat(path.join(runDirectory, 'plan.json')).then((stats) => stats.isFile()), 'plan.json persistido (retomada possível)');
  const persistedRun = JSON.parse(await fs.readFile(path.join(runDirectory, 'run.json'), 'utf8'));
  check(persistedRun.status === 'succeeded', 'snapshot persistido confere com o devolvido');
  check(Array.isArray(persistedRun.provenance) && persistedRun.provenance.length > 0, 'proveniência gravada');
  check(persistedRun.provenance.every((entry) => typeof entry.license === 'string'), 'licença registrada na proveniência');

  const listed = await service.listRuns();
  check(listed.some((item) => item.runId === vfxRun.runId), 'run listado por listRuns');
  check((await service.readRun(vfxRun.runId)).status === 'succeeded', 'readRun devolve o snapshot gravado');

  // -------------- 4. fluxo com revisão humana + retomada (§8, §3 passo a passo)
  const characterRun = await service.run({
    workflowId: '2d-character-parts',
    destination: 'godot-4',
    brief: 'Aiko, Guarda Florestal',
    params: { sourceImage: 'input/sprite.png' },
  });
  check(characterRun.snapshot.status === 'blocked', `run para em revisão humana (${characterRun.snapshot.status})`);
  const firstReview = characterRun.snapshot.steps.find((step) => step.state === 'blocked');
  check(firstReview.review?.status === 'review-missing', 'o passo bloqueado diz que falta revisão');
  check(characterRun.snapshot.gates.some((gate) => gate.gate === 'review' && gate.ok === false),
    'o gate de revisão fica registrado no histórico');

  let snapshot = characterRun.snapshot;
  const reviews = [];
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const pending = snapshot.steps.find((step) => step.state === 'blocked' && step.review?.status === 'review-missing');
    if (!pending) break;
    const reviewed = await service.reviewStep({
      runId: characterRun.runId,
      stepId: pending.id,
      approved: true,
      reviewer: 'smoke-test',
    });
    reviews.push(pending.id);
    snapshot = reviewed.result;
    check(reviewed.resumed === true, `aprovar "${pending.id}" retoma o run`);
  }
  check(reviews.length >= 2, `pelo menos 2 revisões humanas no fluxo (${reviews.join(', ')})`);
  check(snapshot.status === 'succeeded', `fluxo completo conclui após as revisões (${snapshot.status})`);
  check(snapshot.steps.every((step) => step.state === 'succeeded'), 'nenhum passo ficou para trás');
  check(snapshot.steps.filter((step) => step.reused).length >= 2, 'passos revisados foram reutilizados do checkpoint (não reexecutados)');

  const renderStep = snapshot.steps.find((step) => step.id === 'render');
  check(renderStep.metrics.frames === 24, `24 frames produzidos (${renderStep.metrics.frames})`);
  check(renderStep.metrics.grid.columns === 8 && renderStep.metrics.grid.rows === 3, 'grade 8×3 preservada');
  check(renderStep.metrics.grid.frameWidth === 48 && renderStep.metrics.grid.frameHeight === 48, 'frame 48×48 preservado');
  const sheetPath = path.join(projectRoot, renderStep.outputs.find((output) => output.endsWith('spritesheet.png')));
  const sheet = decodePng(await fs.readFile(sheetPath));
  check(sheet.width === 384 && sheet.height === 144, `atlas 384×144 preservado (${sheet.width}×${sheet.height})`);
  const sheetAnalysis = analyzePngContent(await fs.readFile(sheetPath), { grid: { columns: 8, rows: 3 } });
  check(sheetAnalysis.blank === false, 'atlas com conteúdo real (não transparente)');
  check(sheetAnalysis.coverage > 0.002, `cobertura do atlas: ${(sheetAnalysis.coverage * 100).toFixed(2)}%`);

  const deliverStep = snapshot.steps.find((step) => step.id === 'deliver');
  check(deliverStep.metrics.destination === 'godot-4', 'exportação registrada para o destino escolhido');
  check(deliverStep.metrics.verifiedOnDestination === false, 'não afirma import verificado no destino sem evidência');

  // --------------------------------------- 5. revisão rejeitada bloqueia
  const rejectedRun = await service.run({
    workflowId: '2d-character-parts',
    destination: 'godot-4',
    params: { sourceImage: 'input/sprite.png' },
  });
  const rejectedStep = rejectedRun.snapshot.steps.find((step) => step.state === 'blocked');
  const rejection = await service.reviewStep({
    runId: rejectedRun.runId,
    stepId: rejectedStep.id,
    approved: false,
    reviewer: 'smoke-test',
    note: 'Partes separadas erradas: braço colado no torso.',
  });
  check(rejection.resumed === false, 'rejeitar não retoma o run');
  check(/rejeitado/i.test(rejection.reason), 'a resposta explica que o run permanece bloqueado');
  const reviewsFile = JSON.parse(await fs.readFile(path.join(projectRoot, '.lia-forge', 'runs', rejectedRun.runId, 'reviews.json'), 'utf8'));
  check(reviewsFile[rejectedStep.id].approved === false, 'a decisão de rejeição é gravada');
  check(typeof reviewsFile[rejectedStep.id].sha256 === 'string' && reviewsFile[rejectedStep.id].sha256.length === 64,
    'a revisão é ancorada no SHA-256 do artefato');
  check((await service.readRun(rejectedRun.runId)).status === 'blocked', 'o run continua bloqueado no disco');

  // ---------------------- 6. segredos redigidos no que é gravado em disco
  const secret = 'sk-SEGREDOSUPERSENSIVEL123';
  const secretRun = await service.run({
    workflowId: 'variation-retexture',
    destination: 'godot-4',
    params: { sourceImage: `input/${secret}.png` },
  });
  const secretFile = await fs.readFile(path.join(projectRoot, '.lia-forge', 'runs', secretRun.runId, 'run.json'), 'utf8');
  check(!secretFile.includes(secret), 'o segredo não aparece no run gravado');
  check(secretFile.includes('[REDACTED]'), 'o log guarda a marca de redação');
  check(secretRun.snapshot.status === 'failed', 'entrada inexistente falha o run (não fabrica saída)');
  check(/não encontrada/.test(secretRun.snapshot.error.message), 'a mensagem explica o que faltou');
  check(!secretRun.snapshot.error.message.includes(secret), 'a mensagem devolvida também vem redigida');
  check(secretRun.snapshot.steps.every((step) => step.state === 'pending'), 'nenhum passo é marcado como executado quando nada rodou');

  // --------------------------- 7. leitura/escrita confinada ao projeto
  const escapeRun = 'run-fake-traversal';
  const escapeDirectory = path.join(projectRoot, '.lia-forge', 'runs', escapeRun);
  await fs.mkdir(escapeDirectory, { recursive: true });
  const outside = path.join(projectRoot, '..', 'fora-do-projeto.png');
  await fs.writeFile(path.join(projectRoot, 'input', 'marcador.txt'), 'ok', 'utf8');
  await fs.writeFile(path.join(escapeDirectory, 'run.json'), `${JSON.stringify({
    runId: escapeRun,
    planId: 'variation-retexture',
    status: 'succeeded',
    startedAt: new Date().toISOString(),
    steps: [{ id: 'variation', adapter: 'local-image-ops', state: 'succeeded', outputs: ['../../../etc/passwd', path.relative(projectRoot, outside)] }],
    provenance: [],
    logs: [],
    gates: [],
  }, null, 2)}\n`, 'utf8');
  let escaped = null;
  try {
    escaped = await service.exportRun({ runId: escapeRun, destination: 'godot-4' });
  } catch (error) {
    escaped = error;
  }
  check(escaped instanceof Error, 'run com saída fora do projeto não exporta nada');
  check(/não produziu artefatos/.test(escaped.message), `motivo claro: ${escaped.message}`);
  check(!await fs.stat(outside).then((stats) => stats.isFile()).catch(() => false), 'nenhum arquivo foi criado fora do projeto');

  // --------------------------------- 8. exportação por destino (§7 perfis)
  const exported = await service.exportRun({ runId: vfxRun.runId, destination: 'godot-4' });
  check(exported.bundle.destination === 'godot-4', 'bundle nomeia o destino');
  check(exported.bundle.files.length > 0, `bundle lista ${exported.bundle.files.length} arquivo(s)`);
  check(exported.bundle.files.every((file) => typeof file.sha256 === 'string' && file.sha256.length === 64),
    'cada arquivo do bundle carrega SHA-256');
  check(exported.bundle.verifiedOnDestination === false, 'bundle não afirma verificação no destino');
  check(typeof exported.bundle.profile.pivot === 'string', 'perfil do destino inclui pivot');
  const manifestOnDisk = JSON.parse(await fs.readFile(path.join(projectRoot, exported.path), 'utf8'));
  check(manifestOnDisk.destination === 'godot-4', 'manifesto gravado em disco');

  // ------------------------------------------- 9. Asset Manager integrado
  const asset = await service.upsertAsset({ id: 'aiko', type: 'character', name: 'Aiko, Guarda Florestal' });
  check(asset.rights.state === 'unknown', 'asset novo começa com direitos unknown (nada declarado)');
  check(asset.rights.redistributable === false, 'unknown não é redistribuível');

  const attached = await service.attachRunToAsset({ assetId: 'aiko', runId: vfxRun.runId });
  check(attached.versions.length === 1, 'run anexado cria uma versão no asset');
  check(attached.versions[0].artifacts.every((artifact) => typeof artifact.sha256 === 'string' && artifact.sha256.length === 64),
    'artefatos da versão carregam SHA-256');
  check(attached.provenance.length > 0, 'proveniência do run registrada no asset');
  check(attached.rights.state !== 'owned', 'proveniência de ferramenta não transforma o asset em "owned"');

  const declared = await service.declareAssetRights('aiko', { license: 'CC0-1.0', declaredBy: 'smoke-test' });
  check(declared.state === 'licensed' && declared.redistributable === true, 'declaração humana muda os direitos');

  const rights = await service.rightsReport();
  check(rights.total === 1 && rights.byState.licensed === 1, 'relatório de direitos reflete o projeto');

  const storeFile = path.join(projectRoot, '.spriteforge', 'assets.json');
  const store = JSON.parse(await fs.readFile(storeFile, 'utf8'));
  check(store.schemaVersion === 1 && Array.isArray(store.assets), 'store gravado no formato publicado (.spriteforge/assets.json)');
  check(store.assets[0].id === 'aiko' && store.assets[0].type === 'character', 'registro compatível com main.cjs e com o plugin Vite');
  check((await service.listAssets()).length === 1, 'listAssets lê o store');

  // ------------------------------------------------ 10. preview e destinos
  const previewA = await service.vfxPreview({ preset: 'fire', size: 48, frameCount: 6 });
  const previewB = await service.vfxPreview({ preset: 'fire', size: 48, frameCount: 6 });
  check(previewA.pngBase64 === previewB.pngBase64, 'preview determinístico na mesma semente');
  check(previewA.sheetWidth === previewA.grid.columns * 48, 'largura do preview confere com a grade');
  const previewPng = Buffer.from(previewA.pngBase64, 'base64');
  check(analyzePngContent(previewPng).blank === false, 'preview tem conteúdo real');

  const preflight = await service.preflight({ capabilityIds: ['render3d.to2d'] });
  check(preflight.summary.capabilities === 1, 'preflight filtrado analisa só a capacidade pedida');
  check(preflight.summary.ready === 0 && preflight.summary.missing === 1,
    `render3d.to2d aparece como missing neste ambiente (ready=${preflight.summary.ready}, missing=${preflight.summary.missing})`);
  check(preflight.canStart === false, 'canStart=false quando falta ferramenta');
  check(preflight.userActions.every((action) => action.requiresUserDecision === true && action.canBeAutomated === false),
    'preflight só propõe ações humanas');
  check(/não instala nem baixa/i.test(preflight.userActions[0].detail),
    'a ação de instalação deixa explícito que o produto não instala nada sozinho');
  check(preflight.tools.some((tool) => tool.adapterId === 'blender-spritesheet'), 'o adapter real do Blender é inspecionável');

  const fullPreflight = await service.preflight();
  check(fullPreflight.summary.capabilities === 49, `preflight completo cobre as 49 capacidades (${fullPreflight.summary.capabilities})`);
  check(fullPreflight.tools.length === 7, 'os 7 adapters aparecem no preflight');
  check(fullPreflight.summary.toolsMissing + fullPreflight.summary.toolsBlocked > 0,
    'ferramentas ausentes/bloqueadas são contadas, não escondidas');

  console.log(`Studio service smoke test passed (${overview.workflows.length} workflows, ${executable.length} executáveis, contrato 384×144 preservado, revisão + retomada ok).`);
} finally {
  await fs.rm(projectRoot, { recursive: true, force: true });
}
