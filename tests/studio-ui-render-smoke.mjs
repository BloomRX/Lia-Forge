/**
 * Smoke da integração de interface (F8 — §3, §11, §12).
 *
 * Sobe um servidor Vite real em modo middleware (com os plugins publicados do
 * `vite.config.js`) apontando para um projeto temporário e exercita:
 *   1. o cliente `src/lia-forge-api.js` contra as rotas HTTP de verdade —
 *      caminhos, desempacotamento de payload e tratamento de erro;
 *   2. o fluxo completo do produto pela camada de transporte: planejar →
 *      executar → revisar → retomar → exportar → guardar no asset;
 *   3. o componente `src/ForgeStudio.jsx` carregado pelo pipeline do Vite e
 *      renderizado (SSR) sem lançar — prova que imports, JSX e hooks fecham;
 *   4. o confinamento de artefatos e a recusa de origem cruzada.
 *
 * Rodar sem navegador não é fingir que validou: o que este teste afirma é a
 * camada de integração (cliente ↔ API ↔ serviço) e que o componente carrega e
 * renderiza. A pintura em tela continua sendo verificação manual no preview.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-studio-ui-'));

// O plugin lê esta variável ao ser construído: precisa existir antes do config.
process.env.SPRITEFORGE_PROJECT_ROOT = projectRoot;

const { createImage } = await import('../shared/imaging/core.mjs');
const { encodePngRgba, analyzePngContent } = await import('../shared/qa/png-codec.mjs');

// entrada real dentro do projeto temporário (6 regiões conexas)
const sprite = createImage(48, 48);
const paint = (x0, y0, width, height, color) => {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) sprite.rgba.set(color, (y * 48 + x) * 4);
  }
};
paint(18, 2, 12, 10, [240, 210, 190, 255]);
paint(16, 13, 16, 16, [200, 60, 160, 255]);
paint(9, 14, 6, 13, [180, 50, 140, 255]);
paint(33, 14, 6, 13, [180, 50, 140, 255]);
paint(17, 30, 6, 15, [90, 40, 120, 255]);
paint(25, 30, 6, 15, [90, 40, 120, 255]);
await fs.mkdir(path.join(projectRoot, 'input'), { recursive: true });
await fs.writeFile(path.join(projectRoot, 'input', 'sprite.png'), encodePngRgba(sprite.rgba, 48, 48));

const { createServer } = await import('vite');
const vite = await createServer({
  configFile: path.join(repositoryRoot, 'vite.config.js'),
  root: repositoryRoot,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
});
const httpServer = http.createServer(vite.middlewares);
httpServer.listen(0, '127.0.0.1');
await once(httpServer, 'listening');
const origin = `http://127.0.0.1:${httpServer.address().port}`;

// O cliente usa URLs relativas (como no navegador); aqui elas precisam de origem.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => nativeFetch(typeof input === 'string' && input.startsWith('/') ? `${origin}${input}` : input, init);

try {
  const { liaForgeApi } = await vite.ssrLoadModule('/src/lia-forge-api.js');
  assert.equal(liaForgeApi.transport, 'http', 'fora do Electron o transporte é HTTP');

  // ------------------------------------------------------- 1. visão geral
  const overview = await liaForgeApi.overview();
  assert.equal(overview.capabilities.length, 49, '49 capacidades pela API');
  assert.equal(overview.adapters.length, 7, '7 adapters pela API');
  assert.equal(overview.machine.gpu, null, 'GPU não afirmada sem probe');
  assert.equal(overview.workflows.length, 8, '8 workflows pela API');
  assert.equal(overview.workflows.filter((workflow) => workflow.executableNow).length, 5, '5 executáveis nesta máquina');

  const workflows = await liaForgeApi.workflows();
  assert.equal(workflows.length, 8, 'cliente desempacota a lista de workflows');

  const preflight = await liaForgeApi.preflight(['render3d.to2d']);
  assert.equal(preflight.summary.capabilities, 1, 'preflight filtrado pela API');
  assert.equal(preflight.canStart, false, 'sem Blender não dá para começar');

  // ---------------------------------------------------------- 2. planejar
  const planned = await liaForgeApi.plan({ workflowId: '3d-character-spritesheet', destination: 'godot-4' });
  assert.equal(planned.plan.preservesContract, 'humanoid-prompt-views-to-2d-v1', 'contrato preservado no plano');
  assert.equal(planned.plan.blocked, true, 'plano 3D bloqueado neste ambiente');
  assert.ok(planned.plan.blockedSteps.every((step) => step.reason?.length > 0), 'todo bloqueio tem motivo');
  assert.ok(planned.plan.userActions.every((action) => action.canBeAutomated === false), 'nada automatizável');

  // --------------------------------------------- 3. executar (VFX, sem gate)
  const vfxRun = await liaForgeApi.run({
    workflowId: 'ui-vfx-sheet',
    destination: 'godot-4',
    brief: 'Impacto neon',
    params: { vfx: { preset: 'impact', size: 64, frameCount: 8 } },
  });
  assert.equal(vfxRun.snapshot.status, 'succeeded', `run de VFX pela API (${vfxRun.snapshot.status})`);
  const atlasPath = vfxRun.snapshot.steps.flatMap((step) => step.outputs).find((output) => output.endsWith('.png'));
  assert.ok(atlasPath, 'atlas gravado em disco');

  // artefato servido pela rota confinada
  const artifactUrl = await liaForgeApi.artifactSource(atlasPath);
  assert.ok(artifactUrl.startsWith('/api/lia-forge/studio/artifact'), 'cliente devolve URL relativa do artefato');
  const artifactResponse = await nativeFetch(`${origin}${artifactUrl}`);
  assert.equal(artifactResponse.status, 200, 'artefato servido');
  assert.equal(artifactResponse.headers.get('content-type'), 'image/png', 'content-type de imagem');
  const artifactBytes = Buffer.from(await artifactResponse.arrayBuffer());
  assert.equal(analyzePngContent(artifactBytes).blank, false, 'o atlas servido tem conteúdo real');

  const refused = await nativeFetch(`${origin}/api/lia-forge/studio/artifact?path=${encodeURIComponent('../../../etc/passwd')}`);
  assert.equal(refused.status, 403, 'traversal para fora de .lia-forge/runs é recusado');
  const crossOrigin = await nativeFetch(`${origin}/api/lia-forge/studio/overview`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(crossOrigin.status, 403, 'origem cruzada é recusada');

  // ------------------------------------ 4. revisar, retomar e exportar (2D)
  const characterRun = await liaForgeApi.run({
    workflowId: '2d-character-parts',
    destination: 'godot-4',
    params: { sourceImage: 'input/sprite.png' },
  });
  assert.equal(characterRun.snapshot.status, 'blocked', 'run para na revisão humana');
  const runId = characterRun.runId;

  let snapshot = characterRun.snapshot;
  let approvals = 0;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const pending = snapshot.steps.find((step) => step.state === 'blocked' && step.review?.status === 'review-missing');
    if (!pending) break;
    const reviewed = await liaForgeApi.reviewStep(runId, {
      stepId: pending.id,
      approved: true,
      reviewer: 'smoke-ui',
      note: 'aprovado pela camada de transporte',
    });
    assert.equal(reviewed.resumed, true, `aprovar "${pending.id}" retoma o run`);
    snapshot = reviewed.result;
    approvals += 1;
  }
  assert.ok(approvals >= 2, `pelo menos 2 revisões pela API (${approvals})`);
  assert.equal(snapshot.status, 'succeeded', `fluxo completo pela API (${snapshot.status})`);
  const renderStep = snapshot.steps.find((step) => step.id === 'render');
  assert.deepEqual(renderStep.metrics.grid, { columns: 8, rows: 3, frameWidth: 48, frameHeight: 48 }, 'contrato 8×3 de 48×48 preservado');
  assert.equal(renderStep.metrics.frames, 24, '24 frames preservados');

  const reread = await liaForgeApi.readRun(runId);
  assert.equal(reread.status, 'succeeded', 'readRun devolve o estado gravado');
  assert.ok(reread.events.length > 0, 'eventos do run ficam gravados (aba Logs tem o que mostrar)');

  const exported = await liaForgeApi.exportRun(runId, { destination: 'godot-4' });
  assert.equal(exported.bundle.destination, 'godot-4', 'exportação pela API');
  assert.ok(exported.bundle.files.every((file) => file.sha256?.length === 64), 'SHA-256 por arquivo');
  assert.equal(exported.bundle.verifiedOnDestination, false, 'não afirma import verificado no destino');

  const runs = await liaForgeApi.runs();
  assert.ok(runs.some((item) => item.runId === runId), 'run aparece na listagem');

  // ------------------------- 4.1 entradas que só o usuário pode fornecer (§3)
  const catalog = await liaForgeApi.workflows();
  const animationWorkflow = catalog.find((item) => item.id === '2d-animation');
  assert.deepEqual(
    animationWorkflow.needsInput.map((item) => item.kind),
    ['priorRun'],
    'o catálogo declara que 2d-animation reutiliza um run anterior',
  );
  const objectWorkflow = catalog.find((item) => item.id === '3d-object-render');
  assert.deepEqual(objectWorkflow.needsInput.map((item) => item.param), ['model'], 'o catálogo declara o modelo 3D como entrada do usuário');

  // Sem o run de origem: o plano avisa antes, e o run bloqueia com motivo.
  const animationPending = await liaForgeApi.plan({ workflowId: '2d-animation', destination: 'godot-4' });
  assert.equal(animationPending.plan.blocked, true, '2d-animation sem origem não é oferecido como pronto');
  assert.match(animationPending.plan.pendingInputs[0].detail, /run de origem/i);
  assert.equal(animationPending.plan.userActions[0].canBeAutomated, false, 'escolher a origem é decisão humana');

  const animationBlocked = await liaForgeApi.run({ workflowId: '2d-animation', destination: 'godot-4' });
  assert.equal(animationBlocked.snapshot.status, 'blocked', 'sem origem o run bloqueia (não falha)');
  const blockedStep = animationBlocked.snapshot.steps.find((step) => step.id === 'rig');
  assert.equal(blockedStep.error.code, 'WORKFLOW_BLOCKED', 'motivo nomeado no passo bloqueado');
  assert.equal(blockedStep.error.requiresUserDecision, true, 'a UI pode marcar como decisão pendente');

  // Com o run de origem (o 2D aprovado acima): o fluxo completa pela API.
  const animation = await liaForgeApi.run({ workflowId: '2d-animation', destination: 'godot-4', options: { fromRun: runId } });
  let animationSnapshot = animation.snapshot;
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const pending = animationSnapshot.steps.find((step) => step.state === 'blocked' && step.review?.status === 'review-missing');
    if (!pending) break;
    const reviewed = await liaForgeApi.reviewStep(animation.runId, { stepId: pending.id, approved: true, reviewer: 'smoke-ui', note: 'ações conferidas' });
    assert.equal(reviewed.resumed, true, 'aprovar as ações retoma o run de animação');
    animationSnapshot = reviewed.result;
  }
  assert.equal(animationSnapshot.status, 'succeeded', `rig revisado reaproveitado entre runs (${animationSnapshot.status})`);

  // Ferramenta ausente continua bloqueada, nunca "disponível".
  const objectRun = await liaForgeApi.run({ workflowId: '3d-object-render', destination: 'godot-4', params: { model: 'input/modelo.glb' } });
  assert.equal(objectRun.snapshot.status, 'blocked', '3d-object-render bloqueia sem Blender');
  assert.ok(objectRun.snapshot.steps.every((step) => step.state !== 'failed'), 'falta de ferramenta não vira falha do produto');
  const objectPlan = await liaForgeApi.plan({ workflowId: '3d-object-render', destination: 'godot-4' });
  assert.equal(objectPlan.plan.pendingInputs[0].param, 'model', 'sem o caminho do modelo o plano pede a entrada');

  // ------------------------------------------- 4.2 validações declaradas (§5/G8)
  const validatedSteps = snapshot.steps.filter((step) => (step.validations ?? []).length > 0);
  assert.ok(validatedSteps.length >= 3, `passos com validação executada (${validatedSteps.length})`);
  for (const step of validatedSteps) {
    assert.ok(step.validations.every((item) => item.status === 'passed'), `validadores de "${step.id}" passaram: ${JSON.stringify(step.validations)}`);
  }

  // ------------------------------------------------------ 5. assets/direitos
  const created = await liaForgeApi.upsertAsset({ id: 'aiko', type: 'character', name: 'Aiko' });
  assert.equal(created.rights.state, 'unknown', 'asset novo começa unknown');
  const attached = await liaForgeApi.attachRunToAsset('aiko', runId);
  assert.equal(attached.versions.length, 1, 'run anexado como versão');
  assert.notEqual(attached.rights.state, 'owned', 'proveniência de ferramenta não vira "owned"');
  const declared = await liaForgeApi.declareAssetRights('aiko', { license: 'CC0-1.0', declaredBy: 'smoke-ui' });
  assert.equal(declared.state, 'licensed', 'declaração humana muda o estado');
  assert.equal(declared.redistributable, true, 'CC0 é redistribuível');
  const rights = await liaForgeApi.rightsReport();
  assert.equal(rights.total, 1, 'relatório de direitos pela API');
  const listed = await liaForgeApi.assets();
  assert.equal(listed.assets.length, 1, 'listagem de assets pela API');

  const preview = await liaForgeApi.vfxPreview({ preset: 'fire', size: 48, frameCount: 6 });
  assert.ok(preview.pngBase64.length > 100, 'preview de VFX em base64');
  assert.equal(analyzePngContent(Buffer.from(preview.pngBase64, 'base64')).blank, false, 'preview tem conteúdo');

  // ------------------------------------------- 6. componente renderiza (SSR)
  const { default: ForgeStudio } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');
  assert.equal(typeof ForgeStudio, 'function', 'ForgeStudio carrega pelo pipeline do Vite (JSX + imports)');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(createElement(ForgeStudio, { onNotify: () => {} }));
  assert.ok(markup.includes('forge-page'), 'o componente renderiza a página do Forge');
  assert.ok(/Lendo o estado real|forge-loading/.test(markup), 'o estado inicial é o de carregamento (efeitos não rodam em SSR)');

  // Componentes de passo renderizados com dados reais vindos do serviço: é o que
  // garante que validação executada, bloqueio nomeado e entrada pendente
  // aparecem de fato na tela (e não só no JSON).
  const { PlanStepRow, RunStepRow } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');
  const stepMarkup = renderToStaticMarkup(createElement(RunStepRow, { step: renderStep }));
  assert.ok(stepMarkup.includes('forge-validations'), 'a linha do passo mostra as validações');
  assert.ok(stepMarkup.includes('png-content') && stepMarkup.includes('aprovado'), 'validador e resultado aparecem por extenso');

  const blockedMarkup = renderToStaticMarkup(createElement(RunStepRow, { step: blockedStep }));
  assert.ok(blockedMarkup.includes('precisa de uma decisão sua'), 'bloqueio que exige decisão humana é sinalizado');
  assert.ok(blockedMarkup.includes('run de origem') || blockedMarkup.includes('run anterior'), 'o motivo do bloqueio é exibido');

  const animationPlanStep = animationPending.plan.steps.find((step) => step.id === 'rig');
  const planMarkup = renderToStaticMarkup(createElement(PlanStepRow, { step: animationPlanStep }));
  assert.ok(planMarkup.includes('usa um run anterior'), 'o plano avisa que o passo reutiliza outro run');

  const modelStep = objectPlan.plan.steps.find((step) => step.id === 'inspect');
  const modelMarkup = renderToStaticMarkup(createElement(PlanStepRow, { step: modelStep }));
  assert.ok(modelMarkup.includes('precisa de'), 'o plano avisa a entrada que falta');
  assert.ok(modelMarkup.includes('model'), 'o nome do parâmetro aparece para o usuário avançado');

  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  assert.equal(typeof App, 'function', 'App.jsx continua carregando com a página nova ligada');

  console.log(`Studio UI smoke test passed (cliente HTTP ↔ API ↔ serviço, revisão + retomada + exportação, rig entre runs, entradas pendentes e validações na UI; transporte ${liaForgeApi.transport}).`);
} finally {
  globalThis.fetch = nativeFetch;
  await vite.close();
  httpServer.close();
  await once(httpServer, 'close').catch(() => {});
  await fs.rm(projectRoot, { recursive: true, force: true });
}
