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

/**
 * Operações que mudam estado exigem o token da sessão (P0 de superfície HTTP).
 * O navegador o obtém importando `/@lia-forge/session-token.js`, que o próprio
 * servidor gera; em Node o import dinâmico não existe, então o teste busca o
 * módulo e injeta o header — exatamente o que o cliente faria se rodasse num
 * navegador. `window` é definido antes de carregar `/src/lia-forge-api.js`.
 */
const tokenModule = await nativeFetch(`${origin}/@lia-forge/session-token.js`, { headers: { 'sec-fetch-site': 'same-origin' } });
assert.equal(tokenModule.status, 200, 'o servidor entrega o token da sessão como módulo same-origin');
const sessionToken = /export const sessionToken = "([^"]+)"/.exec(await tokenModule.text())?.[1] ?? null;
assert.ok(sessionToken && sessionToken.length >= 32, 'token de sessão com entropia suficiente');
// `window.location.origin` é o que o cliente usa para completar o header Origin
// quando roda fora do navegador (o navegador o envia sozinho).
globalThis.window = {
  location: { origin },
  // O SSR deste teste não monta `#root` nem carrega `/src/main.jsx`; o import do
  // módulo de token é resolvido pelo pipeline do Vite, como faria o navegador.
  __liaForgeImport: (specifier) => vite.ssrLoadModule(specifier),
};
const authHeaders = Object.freeze({ origin, 'x-lia-forge-token': sessionToken });

/**
 * Revisão humana pelo canal que a oferece: o IPC.
 *
 * Por HTTP o servidor recusa (`IPC_ONLY_OPERATION`), porque a autoria da decisão
 * tem de vir de um canal verificado — não do corpo de uma requisição que qualquer
 * processo local pode forjar. O teste chama o mesmo `createStudioService` que o
 * handler `lia-forge:studio:run:review` do Electron chama, com os mesmos
 * argumentos; a diferença de transporte é exatamente o que está sendo protegido.
 * E afirma as duas pontas: que o cliente HTTP devolve a recusa explicável e que o
 * serviço registra a decisão.
 */
let reviewServicePromise = null;
let studioClient = null;
async function reviewThroughIpc(runId, payload, client = studioClient) {
  const viaHttp = await client.reviewStep(runId, payload);
  assert.equal(viaHttp?.ipcOnly, true, 'revisão por HTTP é recusada e o cliente explica (não lança)');
  assert.equal(viaHttp?.ok, false, 'e não finge que registrou');
  if (!reviewServicePromise) {
    reviewServicePromise = import('../shared/services/studio-service.mjs')
      .then((module) => module.createStudioService({ projectRoot }));
  }
  const ipcService = await reviewServicePromise;
  return ipcService.reviewStep({ runId, ...payload });
}

try {
  const { liaForgeApi } = await vite.ssrLoadModule('/src/lia-forge-api.js');
  // O helper de revisão (definido acima, fora do bloco) precisa do cliente
  // carregado pelo Vite — o mesmo que o restante do teste usa.
  studioClient = liaForgeApi;
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
    const reviewed = await reviewThroughIpc(runId, {
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
  assert.equal(exported.bundle.compatibility.compatible, true,
    `o pacote é compatível com o perfil publicado do destino (${JSON.stringify(exported.bundle.compatibility.summary)})`);
  assert.ok(exported.bundle.compatibility.summary.assets >= 1, 'a compatibilidade separa o que é asset importável');
  assert.ok(exported.bundle.compatibility.summary.metadata >= 1,
    'e o que é metadado — antes os JSON do pacote apareciam como bloqueio e o exportador os descartava');
  assert.equal(exported.bundle.compatibility.blockers.length, 0, 'nenhum bloqueio de compatibilidade no pacote real');

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
    const reviewed = await reviewThroughIpc(animation.runId, { stepId: pending.id, approved: true, reviewer: 'smoke-ui', note: 'ações conferidas' });
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
  assert.equal(preview.grid.columns * preview.grid.rows >= preview.frameCount, true, 'a grade declarada comporta os frames');
  assert.equal(preview.sha256.length, 64, 'a prévia recebe SHA-256 do PNG gerado');


  // ------------------------------------------- 6. componente renderiza (SSR)
  const { default: ForgeStudio } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');
  assert.equal(typeof ForgeStudio, 'function', 'ForgeStudio carrega pelo pipeline do Vite (JSX + imports)');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(createElement(ForgeStudio, { onNotify: () => {} }));
  assert.ok(markup.includes('forge-page'), 'o componente renderiza a página do Forge');
  assert.ok(/Lendo o estado real|forge-loading/.test(markup), 'o estado inicial é o de carregamento (efeitos não rodam em SSR)');

  // A prévia existe no serviço desde sempre; a interface é que não a oferecia.
  const { VfxPreview } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');
  const previewMarkup = renderToStaticMarkup(createElement(VfxPreview, {
    preset: 'fire', size: 48, frameCount: 6, preview, busy: null, onRequest: () => {},
  }));
  assert.ok(previewMarkup.includes('Ver prévia'), 'o botão de prévia aparece no formulário de VFX');
  assert.ok(previewMarkup.includes('data:image/png;base64,'), 'a prévia gerada é mostrada como imagem');
  assert.ok(previewMarkup.includes(`${preview.grid.columns}×${preview.grid.rows}`), 'a grade medida aparece na legenda');
  assert.ok(previewMarkup.includes(`${preview.sheetWidth}×${preview.sheetHeight}`), 'o tamanho da folha medido aparece na legenda');
  assert.ok(previewMarkup.includes(String(preview.content.uniqueColors)), 'as cores únicas medidas aparecem na legenda');
  assert.ok(previewMarkup.includes(preview.sha256.slice(0, 16)), 'o SHA-256 da prévia aparece (o usuário avançado confere)');
  assert.ok(previewMarkup.includes('não chama ferramenta externa') && previewMarkup.includes('não gera custo'),
    'a prévia diz que é gerada pelo produto, sem ferramenta externa e sem custo');
  assert.ok(!previewMarkup.includes('os ajustes mudaram desde esta prévia'),
    'com os ajustes iguais aos da geração, nada de aviso de prévia vencida');

  const stalePreviewMarkup = renderToStaticMarkup(createElement(VfxPreview, {
    preset: 'impact', size: 64, frameCount: 6, preview, busy: null, onRequest: () => {},
  }));
  assert.ok(stalePreviewMarkup.includes('os ajustes mudaram desde esta prévia'),
    'se o ajuste mudou, a legenda avisa que a imagem não corresponde ao que será executado');

  const emptyPreviewMarkup = renderToStaticMarkup(createElement(VfxPreview, {
    preset: 'fire', size: 48, frameCount: 6, preview: null, busy: null, onRequest: () => {},
  }));
  assert.ok(emptyPreviewMarkup.includes('Ver prévia'), 'sem prévia gerada o botão continua lá');
  assert.ok(!emptyPreviewMarkup.includes('<img'), 'e nenhuma imagem é inventada antes de gerar');


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

  // --------------------------------------------- 6. providers pela API (F8/§9)
  const providers = await liaForgeApi.providers();
  assert.equal(providers.comfyui.mode, 'local-loopback', 'o padrão é executar na própria máquina');
  assert.equal(providers.comfyui.connected, false, 'sem servidor local, nada é reportado como conectado');
  assert.equal(providers.blender.available, false, 'sem executável, o Blender não aparece como disponível');
  assert.match(providers.blender.detail, /não é instalado automaticamente/, 'a interface diz que nada é instalado automaticamente');
  assert.match(providers.note, /Nenhuma ferramenta foi instalada/, 'a nota de provider repete a garantia');

  // Configurar provider é operação exclusiva do IPC (P0 de superfície HTTP):
  // gravar caminho de executável por requisição anônima era o caminho mais curto
  // para execução de código arbitrário. O servidor recusa com 403 nomeado, e o
  // cliente devolve um resultado explicável em vez de lançar.
  const providersRefusal = await nativeFetch(`${origin}/api/lia-forge/studio/providers`, {
    method: 'POST',
    headers: { ...authHeaders },
    body: JSON.stringify({ id: 'blender', mode: 'path', executable: path.join(os.tmpdir(), 'blender-falso') }),
  });
  assert.equal(providersRefusal.status, 403, 'POST /providers é recusado mesmo com Origin e token válidos');
  const providersRefusalBody = await providersRefusal.json();
  assert.equal(providersRefusalBody.code, 'IPC_ONLY_OPERATION', 'a recusa é nomeada: operação exclusiva do IPC');
  assert.match(providersRefusalBody.error, /app desktop/i, 'a recusa diz onde a operação pode ser feita');

  const secretRefusal = await liaForgeApi.configureProvider({ id: 'comfyui', token: 'segredo-nunca-gravado' });
  assert.equal(secretRefusal.ipcOnly, true, 'o cliente traduz a recusa em resultado explicável (não lança)');
  assert.equal(secretRefusal.ok, false, 'e diz que a operação não aconteceu');

  const configured = await liaForgeApi.configureProvider({ id: 'blender', mode: 'path', executable: path.join(os.tmpdir(), 'blender-que-nao-existe') });
  assert.equal(configured.ipcOnly, true, 'nenhum executável é configurável pelo transporte HTTP');

  const providersFile = await fs.readFile(path.join(projectRoot, '.lia-forge', 'providers.json'), 'utf8').catch(() => null);
  assert.ok(providersFile === null || !providersFile.includes('blender-falso'), 'nada foi gravado em .lia-forge/providers.json');
  assert.ok(providersFile === null || !providersFile.includes('segredo-nunca-gravado'), 'nenhum segredo foi gravado em .lia-forge/providers.json');

  // A validação de provider (segredo, endpoint fora de loopback) continua testada
  // onde ela vive: no serviço, que é o mesmo para os dois transportes.
  const { createStudioService } = await import('../shared/services/studio-service.mjs');
  const providerService = createStudioService({ projectRoot });
  await assert.rejects(
    () => providerService.configureProvider({ id: 'comfyui', token: 'segredo-nunca-gravado' }),
    /segredo/i, 'segredo enviado pela UI é recusado pelo serviço');
  await assert.rejects(
    () => providerService.configureProvider({ id: 'comfyui', mode: 'local-loopback', endpoint: 'http://10.9.8.7:8188' }),
    /loopback|127\.0\.0\.1|localhost/i, 'modo local com endpoint de outra máquina é recusado');

  const { ProvidersPanel } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');
  const providerMarkup = renderToStaticMarkup(createElement(ProvidersPanel, { providers, busy: null, onConfigure: () => {} }));
  assert.ok(providerMarkup.includes('Providers &amp; backends'), 'o painel de providers aparece na interface');
  assert.ok(providerMarkup.includes('Local (nesta máquina)') && providerMarkup.includes('Remoto (worker próprio'), 'as três opções de backend são oferecidas');
  assert.ok(providerMarkup.includes('Não conectado') && providerMarkup.includes('Não detectado'), 'o estado real (ausente) é o que aparece, nunca "disponível"');
  assert.ok(providerMarkup.includes('não instala, não baixa, não compra'), 'a garantia de não instalar/baixar/comprar está visível');

  // ------------------------- 7. entradas do usuário e Comparison Lab (HTTP)
  const listedInputs = await liaForgeApi.listInputs();
  assert.equal(listedInputs.directory, 'input', 'as entradas vivem em input/');
  const spriteEntry = listedInputs.entries.find((entry) => entry.path === 'input/sprite.png');
  assert.ok(spriteEntry, 'a imagem criada no projeto temporário aparece na lista');
  assert.equal(spriteEntry.width, 48, 'a entrada é medida de verdade (largura)');
  assert.equal(spriteEntry.height, 48, 'a entrada é medida de verdade (altura)');
  assert.equal(spriteEntry.contentChecked, true, 'o PNG foi decodificado, não apenas listado');
  assert.equal(spriteEntry.sha256.length, 64, 'a entrada recebe SHA-256');

  const uploaded = await liaForgeApi.saveInput({ filename: '../../etc/Sprite Herói.png', bytes: encodePngRgba(sprite.rgba, 48, 48) });
  assert.equal(uploaded.path, 'input/Sprite-Heroi.png', `nome sanitizado (sem traversal, sem acento) e confinado a input/ (${uploaded.path})`);
  assert.equal(uploaded.contentChecked, true, 'o upload é verificado antes de gravar');
  const again = await liaForgeApi.saveInput({ filename: 'sprite-heroi.png', bytes: encodePngRgba(sprite.rgba, 48, 48) });
  assert.equal(again.path, 'input/sprite-heroi-2.png', 'colisão (mesmo ignorando caixa) nunca sobrescreve o arquivo existente');

  const badExtension = await nativeFetch(`${origin}/api/lia-forge/studio/inputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ filename: 'payload.exe', base64: Buffer.from('MZ').toString('base64') }),
  });
  assert.equal(badExtension.status, 400, 'formato não aceito é recusado com 400');
  const badContent = await nativeFetch(`${origin}/api/lia-forge/studio/inputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ filename: 'falso.png', base64: Buffer.from('isto não é um png').toString('base64') }),
  });
  assert.equal(badContent.status, 400, 'PNG inválido é recusado com 400');
  const uploadWithoutToken = await nativeFetch(`${origin}/api/lia-forge/studio/inputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify({ filename: 'sem-token.png', base64: Buffer.from('x').toString('base64') }),
  });
  assert.equal(uploadWithoutToken.status, 401, 'upload sem o token da sessão é recusado antes de chegar ao serviço');

  const servedInput = await nativeFetch(`${origin}/api/lia-forge/studio/input-file?path=${encodeURIComponent('input/sprite.png')}`);
  assert.equal(servedInput.status, 200, 'a entrada é servida para a prévia');
  assert.equal(servedInput.headers.get('content-type'), 'image/png', 'content-type de imagem');
  assert.equal(analyzePngContent(Buffer.from(await servedInput.arrayBuffer())).blank, false, 'a imagem servida tem conteúdo');
  const inputTraversal = await nativeFetch(`${origin}/api/lia-forge/studio/input-file?path=${encodeURIComponent('../../../etc/passwd')}`);
  assert.equal(inputTraversal.status, 403, 'traversal fora de input/ é recusado');

  const comparison = await liaForgeApi.compareArtifacts(['input/sprite.png', 'input/sprite-heroi-2.png', '../fora-do-projeto.png']);
  assert.equal(comparison.entries.length, 3, 'a comparação devolve uma entrada por caminho');
  assert.equal(comparison.entries[0].ok, true, 'artefato do projeto é medido');
  assert.equal(comparison.entries[0].uniqueColors > 1, true, 'cores únicas medidas no Comparison Lab');
  assert.equal(comparison.entries[2].ok, false, 'caminho fora do projeto é recusado na comparação');
  assert.match(comparison.entries[2].problem, /recusado/, 'o motivo da recusa é dito');

  const chosen = comparison.entries[0];
  await liaForgeApi.upsertAsset({ id: 'hero-comparison', type: 'character', name: 'Herói (escolha no lab)' });
  const versioned = await liaForgeApi.addAssetVersion('hero-comparison', {
    note: 'Escolhido no Comparison Lab',
    artifacts: [{ path: chosen.path, role: 'comparison-pick', format: chosen.format, bytes: chosen.bytes, sha256: chosen.sha256, validated: true, contentMetrics: { uniqueColors: chosen.uniqueColors, coverage: chosen.coverage } }],
  });
  assert.match(String(versioned.version), /^v\d+$/, `a escolha vira versão registrada no asset (${versioned.version})`);
  assert.equal(versioned.artifacts[0].sha256, chosen.sha256, 'a versão guarda o SHA-256 do artefato escolhido');
  assert.equal(versioned.artifacts[0].contentMetrics.uniqueColors, chosen.uniqueColors, 'a versão guarda as métricas medidas na comparação');
  const stored = (await liaForgeApi.assets()).assets.find((asset) => asset.id === 'hero-comparison');
  assert.equal(stored.versions.length, 1, 'a versão fica gravada no inventário do projeto');
  assert.equal(stored.versions[0].artifacts[0].path, chosen.path, 'a versão aponta para o artefato escolhido');

  const { InputPicker, ComparisonLab } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');
  const pickerMarkup = renderToStaticMarkup(createElement(InputPicker, {
    label: 'Imagem de entrada',
    kind: 'image',
    value: 'input/sprite.png',
    entries: listedInputs.entries,
    busy: null,
    transport: 'http',
    onSelect: () => {},
    onUpload: () => {},
    onPickNative: () => {},
  }));
  assert.ok(pickerMarkup.includes('Imagem de entrada'), 'o seletor de entrada aparece com o rótulo');
  assert.ok(pickerMarkup.includes('Enviar arquivo'), 'o envio de arquivo está visível para o iniciante');
  assert.ok(pickerMarkup.includes('sprite.png') && pickerMarkup.includes('is-selected'), 'a entrada existente aparece selecionável');
  assert.ok(!pickerMarkup.includes('Escolher no computador'), 'no navegador não é oferecido o seletor nativo (só no desktop)');

  const labMarkup = renderToStaticMarkup(createElement(ComparisonLab, {
    candidates: [{ path: 'input/sprite.png', origin: 'input' }],
    entries: listedInputs.entries,
    runs: [],
    busy: null,
    comparison,
    onToggle: () => {},
    onRemove: () => {},
    onCompare: () => {},
    onAddRun: () => {},
    onRegister: () => {},
    registered: null,
  }));
  assert.ok(labMarkup.includes('Comparison Lab'), 'o Comparison Lab aparece na página');
  assert.ok(labMarkup.includes('Cores únicas') && labMarkup.includes('sha256'), 'as métricas medidas aparecem na comparação');
  assert.ok(labMarkup.includes('Registrar como versão do asset'), 'a escolha pode ser gravada como versão');
  assert.ok(labMarkup.includes('recusado'), 'caminho recusado é mostrado como erro, não como artefato');

  // --------------------- 8. ciclo de vida do run pelo transporte HTTP (cancelar/retomar)
  const activeNow = await liaForgeApi.activeRuns();
  assert.deepEqual(activeNow, [], 'nenhuma execução fica registrada como ativa depois de encerrada');

  const cancelFinished = await liaForgeApi.cancelRun(runId, { reason: 'tentativa depois de encerrado' });
  assert.equal(cancelFinished.ok, false, 'cancelar um run encerrado não finge sucesso');
  assert.match(cancelFinished.reason, /encerrado/, 'o estado real vem no motivo da recusa');

  const resumeFinished = await liaForgeApi.resumeRun(runId);
  assert.equal(resumeFinished.ok, false, 'retomar um run concluído é recusado sem mexer no disco');
  assert.match(resumeFinished.reason, /não precisa de retomada/, 'a recusa explica por quê');

  const missingCancel = await nativeFetch(`${origin}/api/lia-forge/studio/runs/run-inexistente/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ reason: 'teste' }),
  });
  assert.equal(missingCancel.status, 404, 'cancelar run inexistente devolve 404');
  const missingResume = await nativeFetch(`${origin}/api/lia-forge/studio/runs/run-inexistente/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({}),
  });
  assert.equal(missingResume.status, 404, 'retomar run inexistente devolve 404');

  // Revisão humana também é exclusiva do IPC: a autoria vem do canal verificado,
  // não do corpo da requisição.
  const reviewRefusal = await nativeFetch(`${origin}/api/lia-forge/studio/runs/run-inexistente/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ stepId: 'render', approved: true, reviewer: 'qualquer-um' }),
  });
  assert.equal(reviewRefusal.status, 403, 'POST /runs/:id/review é recusado por HTTP mesmo autenticado');
  assert.equal((await reviewRefusal.json()).code, 'IPC_ONLY_OPERATION', 'recusa nomeada');
  const activeRoute = await nativeFetch(`${origin}/api/lia-forge/studio/runs/active`);
  assert.equal(activeRoute.status, 200, 'a rota de execuções em andamento existe no transporte HTTP');
  assert.deepEqual((await activeRoute.json()).active, [], 'sem execução em andamento neste processo');

  // ------------------------------------------- 9. projeto (passo 1 da jornada)
  const project = await liaForgeApi.projectInfo();
  assert.equal(project.exists, true, 'o projeto existe no caminho informado ao servidor');
  assert.equal(project.writable, true, 'a pasta do projeto é gravável');
  assert.equal(project.managedHere, false, 'no navegador fica dito que a pasta vem do servidor');
  assert.match(project.managementNote, /SPRITEFORGE_PROJECT_ROOT/, 'a nota explica de onde vem a pasta');
  assert.ok(project.counts.inputs >= 1, `as entradas do projeto são contadas (${project.counts.inputs})`);
  assert.ok(Array.isArray(project.preserved), 'o que já existe é listado como preservado');
  const projectRoute = await nativeFetch(`${origin}/api/lia-forge/studio/project`);
  assert.equal(projectRoute.status, 200, 'a rota /project existe no transporte HTTP');
  assert.equal((await projectRoute.json()).root, project.root, 'a rota devolve a mesma raiz que o cliente');
  const projectMethod = await nativeFetch(`${origin}/api/lia-forge/studio/project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: '{}',
  });
  assert.ok([401, 405].includes(projectMethod.status), `criar/trocar projeto não é permitido por HTTP (${projectMethod.status})`);
  assert.equal(await liaForgeApi.chooseProject({ create: true }), null, 'no navegador não há seletor de pasta: a resposta é null, não um caminho inventado');

  const { ProjectPanel } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');
  const browserProject = renderToStaticMarkup(createElement(ProjectPanel, {
    project, busy: null, transport: 'http', onChoose: () => {}, onReveal: () => {}, onRefresh: () => {},
  }));
  assert.ok(browserProject.includes('Projeto') && browserProject.includes(project.root), 'o painel mostra a pasta do projeto');
  assert.ok(/entrada\(s\)/.test(browserProject), 'o painel mostra quantas entradas existem');
  assert.ok(!browserProject.includes('Abrir outra pasta'), 'no navegador não é oferecido trocar de pasta (ação do desktop)');
  assert.ok(browserProject.includes('SPRITEFORGE_PROJECT_ROOT'), 'no navegador a origem da pasta é dita com clareza');

  const desktopProject = renderToStaticMarkup(createElement(ProjectPanel, {
    project: { ...project, legacy: { ...project.legacy, spriteforge: true, liaManifest: true, note: 'Conteúdo de versões anteriores (.spriteforge/, .lia.json) foi encontrado e é preservado: o produto não move, não converte e não apaga.' } },
    busy: null,
    transport: 'ipc',
    onChoose: () => {},
    onReveal: () => {},
    onRefresh: () => {},
  }));
  assert.ok(desktopProject.includes('Abrir outra pasta') && desktopProject.includes('Novo projeto'), 'no desktop é possível abrir ou criar projeto');
  assert.ok(desktopProject.includes('Ver no sistema'), 'no desktop a pasta pode ser revelada no sistema');
  assert.ok(desktopProject.includes('preservado'), 'o conteúdo legado aparece como preservado, não como migrado');

  // --------------------------------------- 10. roteiro de produção (12 passos)
  const { buildJourneySteps, JourneyChecklist } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');

  const journeyStart = buildJourneySteps({
    project,
    inputs: listedInputs.entries,
    requiresInput: true,
    workflowId: '2d-character-parts',
    brief: '',
    destination: 'godot-4',
    plan: null,
    preflight: overview.preflight,
    run: null,
    assets: [],
  });
  assert.equal(journeyStart.length, 12, `o roteiro cobre os 12 passos da jornada (${journeyStart.length})`);
  assert.deepEqual(journeyStart.map((step) => step.index), Array.from({ length: 12 }, (_, index) => index + 1), 'os passos são numerados em ordem');
  assert.equal(journeyStart.find((step) => step.id === 'project').state, 'done', 'projeto aberto e gravável conta como passo concluído');
  assert.equal(journeyStart.find((step) => step.id === 'references').state, 'done', 'entradas em input/ contam como passo concluído');
  assert.equal(journeyStart.find((step) => step.id === 'objective').state, 'now', 'sem plano, o passo atual é escolher o objetivo');
  assert.equal(journeyStart.filter((step) => step.state === 'done').length, 2, 'nada é marcado como concluído sem evidência');

  const journeyPlanned = buildJourneySteps({
    project,
    inputs: listedInputs.entries,
    requiresInput: false,
    workflowId: '3d-character-spritesheet',
    brief: 'heroína neon para o capítulo 1',
    destination: 'godot-4',
    plan: planned.plan,
    preflight: overview.preflight,
    run: null,
    assets: [],
  });
  assert.equal(journeyPlanned.find((step) => step.id === 'plan').state, 'done', 'plano na tela conta como passo concluído');
  assert.equal(journeyPlanned.find((step) => step.id === 'brief').state, 'done', 'descrição escrita conta como passo concluído');
  assert.equal(journeyPlanned.find((step) => step.id === 'requirements').state, 'human', 'passo sem provider nesta máquina é decisão humana, não passo concluído');
  assert.match(journeyPlanned.find((step) => step.id === 'requirements').detail, /Instalar ou autorizar é decisão sua/, 'o passo humano diz o que só o usuário pode fazer');
  assert.equal(journeyPlanned.find((step) => step.id === 'execute').state, 'now', 'com o plano pronto, o passo atual é executar');

  const journeyFinished = buildJourneySteps({
    project,
    inputs: listedInputs.entries,
    requiresInput: true,
    workflowId: '2d-character-parts',
    brief: 'herói neon',
    destination: 'godot-4',
    plan: characterRun.plan,
    preflight: overview.preflight,
    run: snapshot,
    liveRun: null,
    comparison,
    exportResult: exported,
    registeredVersion: { assetId: 'hero-comparison', path: comparison.entries[0].path, version: 'v1' },
    assets: listed.assets,
  });
  const doneIds = journeyFinished.filter((step) => step.state === 'done').map((step) => step.id);
  for (const expected of ['project', 'references', 'objective', 'brief', 'plan', 'execute', 'follow', 'review', 'compare', 'export', 'keep']) {
    assert.ok(doneIds.includes(expected), `passo "${expected}" aparece como concluído quando existe evidência`);
  }
  assert.equal(journeyFinished.find((step) => step.id === 'export').detail.includes('verificado no destino: não'), true,
    'a exportação diz que a importação no destino não foi verificada');
  assert.equal(journeyFinished.find((step) => step.id === 'keep').state, 'done', 'versão registrada no asset conclui o roteiro');
  assert.equal(journeyFinished.filter((step) => step.state === 'now').length, 0, 'roteiro concluído não tem passo atual pendente');

  // A página passa `overview.assets`, onde `versions` é a **contagem** (não a
  // lista) e `versionRunIds` diz de que run vem cada versão guardada. É a forma
  // que a derivação recebe no produto real: com a lista de versões ali ela
  // lançava TypeError assim que um run era aberto.
  const freshOverview = await liaForgeApi.overview();
  assert.ok(freshOverview.assets.some((asset) => typeof asset.versions === 'number'),
    'no resumo do overview, versions é a contagem (formato publicado)');
  assert.ok(freshOverview.assets.some((asset) => (asset.versionRunIds ?? []).includes(runId)),
    'e o resumo diz de qual run vem a versão guardada');
  const summarizedJourney = buildJourneySteps({
    project,
    inputs: listedInputs.entries,
    requiresInput: true,
    workflowId: '2d-character-parts',
    brief: 'herói neon',
    destination: 'godot-4',
    plan: characterRun.plan,
    preflight: overview.preflight,
    run: snapshot,
    comparison,
    exportResult: exported,
    assets: freshOverview.assets,
  });
  assert.equal(summarizedJourney.find((step) => step.id === 'keep').state, 'done',
    'com o resumo que a página usa de verdade, o passo 12 conclui para o run guardado');
  const summarizedMarkup = renderToStaticMarkup(createElement(JourneyChecklist, {
    project,
    inputs: listedInputs.entries,
    requiresInput: true,
    workflowId: '2d-character-parts',
    brief: 'herói neon',
    destination: 'godot-4',
    plan: characterRun.plan,
    preflight: overview.preflight,
    run: snapshot,
    comparison,
    exportResult: exported,
    assets: freshOverview.assets,
  }));
  assert.ok(summarizedMarkup.includes('12 de 12 passos'), 'o roteiro renderiza inteiro com os dados que a página passa');

  // Pacote que o destino não aceita (entrada construída para a derivação: o
  // pacote real acima é compatível). Exportar aconteceu, mas não resolveu.
  const rejectedJourneyMarkup = renderToStaticMarkup(createElement(JourneyChecklist, {
    project,
    inputs: listedInputs.entries,
    requiresInput: true,
    workflowId: '2d-character-parts',
    brief: 'herói neon',
    destination: 'godot-4',
    plan: characterRun.plan,
    preflight: overview.preflight,
    run: snapshot,
    comparison,
    exportResult: {
      ...exported,
      bundle: {
        ...exported.bundle,
        compatibility: {
          ...exported.bundle.compatibility,
          compatible: false,
          blockers: ['decompose:sprite.psd: formato "psd" não é aceito por Godot 4.x (png, glb)'],
          summary: { ...exported.bundle.compatibility.summary, blockers: 1 },
        },
      },
    },
    assets: freshOverview.assets,
  }));
  assert.ok(rejectedJourneyMarkup.includes('não aceita o pacote como está'), 'o roteiro diz que o destino não aceita o pacote');
  assert.ok(rejectedJourneyMarkup.includes('sprite.psd'), 'e nomeia o arquivo recusado');
  assert.ok(rejectedJourneyMarkup.includes('o restante espera uma decisão sua'), 'com o pacote recusado, não diz que está tudo concluído');
  assert.ok(!rejectedJourneyMarkup.includes('Todos os passos que dependem só do produto estão concluídos'),
    'a frase de jornada concluída não aparece enquanto o destino recusar o pacote');

  const journeyMarkup = renderToStaticMarkup(createElement(JourneyChecklist, {
    project,
    inputs: listedInputs.entries,
    requiresInput: true,
    workflowId: '2d-character-parts',
    brief: '',
    destination: 'godot-4',
    plan: null,
    preflight: overview.preflight,
    run: null,
    assets: [],
  }));
  assert.ok(journeyMarkup.includes('Roteiro de produção'), 'o roteiro aparece na página');
  assert.ok(journeyMarkup.includes('2 de 12 passos'), 'o resumo diz quantos passos estão concluídos');
  assert.ok(journeyMarkup.includes('Passo 3 — Escolher o objetivo'), 'o roteiro diz qual é o próximo passo em linguagem de gente');
  assert.ok(journeyMarkup.includes('ver os 12 passos'), 'a lista completa está a um clique');

  // --------------------------------- 11. run interrompido visível e recuperável
  const { SavedRunItem } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');
  const listedRuns = await liaForgeApi.runs();
  assert.ok(listedRuns.length > 0, 'há runs gravados no projeto do smoke');
  assert.equal(listedRuns.every((item) => item.active === false), true, 'nenhum run do smoke segue ativo depois de encerrado');
  assert.equal(listedRuns.every((item) => item.stale === false), true, 'run encerrado não é marcado como interrompido');

  const normalMarkup = renderToStaticMarkup(createElement(SavedRunItem, {
    item: listedRuns[0],
    currentRunId: null,
    busy: null,
    onOpen: () => {},
    onRecover: () => {},
    onResume: () => {},
  }));
  assert.ok(normalMarkup.includes(listedRuns[0].runId), 'o item lista o id do run');
  assert.ok(!normalMarkup.includes('Corrigir estado'), 'run encerrado não oferece recuperação');
  assert.ok(!normalMarkup.includes('Retomar'), 'run concluído não oferece retomada (o serviço recusaria)');

  const renderRunItem = (item) => renderToStaticMarkup(createElement(SavedRunItem, {
    item, currentRunId: null, busy: null, onOpen: () => {}, onRecover: () => {}, onResume: () => {},
  }));

  // Run bloqueado por revisão (real, produzido acima pela API): a saída dele é a
  // aprovação no painel do run, não uma retomada que repetiria o mesmo bloqueio.
  const blockedItem = listedRuns.find((item) => item.status === 'blocked');
  assert.ok(blockedItem, 'o projeto do smoke tem um run bloqueado de verdade');
  assert.equal(blockedItem.planStored, true, 'a lista diz se o plano original está gravado');
  const blockedItemMarkup = renderRunItem(blockedItem);
  assert.ok(!blockedItemMarkup.includes('Retomar'), 'run bloqueado não oferece retomada: o que ele espera é a revisão');
  assert.ok(blockedItemMarkup.includes('Aguardando você'), 'e mostra o estado real do run');
  assert.ok(blockedItemMarkup.includes('Espera sua revisão'), 'o item nomeia a saída real em vez de só dizer que nada foi entregue');
  assert.ok(blockedItemMarkup.includes('is-waiting-review'), 'e o estado de espera tem marcação própria na lista');

  // Run interrompido de verdade: gravado como em andamento, sem execução neste
  // processo, com o plano original copiado de um run real do mesmo projeto.
  const orphanId = 'run-interrompido-do-smoke';
  const orphanDirectory = path.join(projectRoot, '.lia-forge', 'runs', orphanId);
  await fs.mkdir(orphanDirectory, { recursive: true });
  await fs.copyFile(path.join(projectRoot, '.lia-forge', 'runs', runId, 'plan.json'), path.join(orphanDirectory, 'plan.json'));
  await fs.writeFile(path.join(orphanDirectory, 'run.json'), `${JSON.stringify({
    schemaVersion: 1,
    runId: orphanId,
    planId: '3d-object-render',
    planTitle: 'Objeto 3D + render',
    status: 'running',
    startedAt: new Date(Date.now() - 60000).toISOString(),
    finishedAt: null,
    steps: [{ id: 'inspect', adapter: 'glb-inspect', state: 'running', outputs: [], error: null }],
    gates: [],
    logs: [],
    provenance: [],
    cost: { status: 'unknown', entries: [], total: null, currency: null },
    summary: { total: 1, progress: 0, finished: false, failed: [], blocked: [] },
  }, null, 2)}\n`, 'utf8');

  const orphanItem = (await liaForgeApi.runs()).find((item) => item.runId === orphanId);
  assert.equal(orphanItem?.stale, true, 'o run gravado como em andamento sem execução aqui chega à lista como interrompido');
  assert.equal(orphanItem?.planStored, true, 'e a lista confirma que o plano original está gravado');
  const orphanMarkup = renderRunItem(orphanItem);
  assert.ok(orphanMarkup.includes('Corrigir estado') && orphanMarkup.includes('Retomar do checkpoint'),
    'o item interrompido oferece as duas saídas que o serviço aceita, com o nome que cada ação tem');

  // Sem o plano gravado, o botão de retomar não aparece: melhor dizer por quê do
  // que oferecer um botão que devolve erro.
  const planlessId = 'run-sem-plano-do-smoke';
  const planlessDirectory = path.join(projectRoot, '.lia-forge', 'runs', planlessId);
  await fs.mkdir(planlessDirectory, { recursive: true });
  await fs.writeFile(path.join(planlessDirectory, 'run.json'), (await fs.readFile(path.join(orphanDirectory, 'run.json'), 'utf8')).replace(orphanId, planlessId), 'utf8');
  const planlessItem = (await liaForgeApi.runs()).find((item) => item.runId === planlessId);
  assert.equal(planlessItem?.planStored, false, 'a lista distingue o run sem plano gravado');
  const planlessMarkup = renderRunItem(planlessItem);
  assert.ok(!planlessMarkup.includes('Retomar'), 'sem plano gravado não é oferecida a retomada');
  assert.ok(planlessMarkup.includes('não há como retomar com as mesmas entradas'), 'e o motivo é dito no item');
  assert.ok(planlessMarkup.includes('Corrigir estado'), 'corrigir o estado continua disponível');

  // Corrigir o estado pela API produz um run cancelado real: é ele que a lista
  // passa a oferecer para retomar (o plano continua gravado).
  const corrected = await liaForgeApi.cancelRun(orphanId, { reason: 'estado corrigido pelo usuário: não havia execução neste processo' });
  assert.equal(corrected.ok, true, 'corrigir o estado do run interrompido pela API');
  assert.equal(corrected.stale, true, 'a resposta diz que não havia execução neste processo (não finge ter parado um processo)');
  const cancelledItem = (await liaForgeApi.runs()).find((item) => item.runId === orphanId);
  assert.equal(cancelledItem?.status, 'cancelled', 'o estado gravado passa a cancelado');
  assert.equal(cancelledItem?.stale, false, 'e ele deixa de constar como interrompido');
  const cancelledMarkup = renderRunItem(cancelledItem);
  assert.ok(cancelledMarkup.includes('Retomar'), 'run cancelado real oferece a retomada que o serviço aceita');
  assert.ok(!cancelledMarkup.includes('Retomar do checkpoint'),
    'run encerrado não é interrompido: o rótulo é "Retomar", não "Retomar do checkpoint"');
  assert.ok(cancelledMarkup.includes('checkpoint'), 'o item diz que os passos concluídos ficaram em checkpoint');
  assert.ok(!cancelledMarkup.includes('Corrigir estado'), 'com o estado já corrigido, não oferece corrigir de novo');

  // Variante apresentada com o estado trocado de propósito (o run interrompido
  // real, produzido acima, é o que prova o comportamento com dados do serviço).
  const staleMarkup = renderToStaticMarkup(createElement(SavedRunItem, {
    item: { ...listedRuns[0], status: 'running', stale: true, active: false },
    currentRunId: null,
    busy: null,
    onOpen: () => {},
    onRecover: () => {},
    onResume: () => {},
  }));
  assert.ok(staleMarkup.includes('Interrompido'), 'o estado interrompido é dito com todas as letras');
  assert.ok(staleMarkup.includes('não há execução neste processo'), 'o item explica por que está interrompido');
  assert.ok(staleMarkup.includes('Corrigir estado') && staleMarkup.includes('Retomar do checkpoint'),
    'as duas saídas são oferecidas no próprio item, cada uma com o seu nome');

  // Run interrompido no roteiro: não aparece como execução viva, e a recuperação
  // entra como decisão humana (o produto não corrige o estado por conta própria).
  const staleJourneyMarkup = renderToStaticMarkup(createElement(JourneyChecklist, {
    project,
    inputs: listedInputs.entries,
    requiresInput: true,
    workflowId: '2d-character-parts',
    brief: 'herói neon',
    destination: 'godot-4',
    plan: characterRun.plan ?? null,
    preflight: overview.preflight,
    run: { runId: 'run-interrompido', status: 'running', summary: { finished: false, total: 2, progress: 50 } },
    runStale: true,
    assets: [],
  }));
  assert.ok(staleJourneyMarkup.includes('não há execução neste processo'), 'o roteiro diz que o run interrompido não está executando');
  assert.ok(staleJourneyMarkup.includes('decisões suas'), 'e apresenta a recuperação como decisão do usuário');
  assert.ok(!staleJourneyMarkup.includes('Execução em andamento: o progresso é gravado'), 'não apresenta o run interrompido como execução viva');
  assert.ok(staleJourneyMarkup.includes('o restante espera uma decisão sua'),
    'sem passo atual mas com decisão pendente, não diz que está tudo concluído');
  assert.ok(!staleJourneyMarkup.includes('Todos os passos que dependem só do produto estão concluídos'),
    'e a frase de jornada terminada não aparece enquanto houver decisão pendente');

  // O plano mostra quem não serve ao passo e por quê (Blender instalado não pode
  // aparecer como opção para um atlas que vem do rig 2D interno).
  const planCandidates = renderToStaticMarkup(createElement(PlanStepRow, {
    step: {
      id: 'render',
      title: 'Renderizar frames e atlas',
      capability: 'render.atlas',
      adapter: 'rig2d-software',
      candidates: [
        { adapterId: 'rig2d-software', state: 'ready', detail: 'renderer interno', applicable: true, reason: null },
        { adapterId: 'blender-spritesheet', state: 'ready', detail: 'Blender configurado', applicable: false, reason: 'O Blender só entra aqui quando o passo recebe material 3D.' },
      ],
      validators: ['png-content'],
      resources: {},
      cost: { status: 'not-applicable' },
    },
  }));
  assert.ok(planCandidates.includes('blender-spritesheet: O Blender só entra aqui quando o passo recebe material 3D.'),
    'a ferramenta instalada que não serve ao passo é dita na hora, com o motivo (sem precisar abrir os candidatos)');
  assert.ok(planCandidates.includes('<code>rig2d-software</code>'), 'e o passo continua com o adapter que serve a ele');
  assert.ok(!planCandidates.includes('sem adapter'), 'o passo não aparece como sem adapter só porque outra ferramenta foi descartada');

  // Run falho: o roteiro nomeia a falha como decisão pendente e não diz que a
  // jornada terminou (a derivação com runs reais está no journey-smoke).
  const failedJourneyMarkup = renderToStaticMarkup(createElement(JourneyChecklist, {
    project,
    inputs: listedInputs.entries,
    requiresInput: true,
    workflowId: '3d-object-render',
    brief: 'item de teste',
    destination: 'godot-4',
    plan: null,
    preflight: overview.preflight,
    run: {
      runId: 'run-falho-de-teste',
      status: 'failed',
      summary: { finished: true, total: 4, progress: 50 },
      steps: [{ id: 'render', state: 'failed', error: { code: 'ADAPTER_EXECUTION_FAILED', message: 'a ferramenta saiu com código 2.' } }],
    },
    assets: [],
  }));
  assert.ok(failedJourneyMarkup.includes('O run terminou com falha em &quot;render&quot;') || failedJourneyMarkup.includes('O run terminou com falha em "render"'),
    'o roteiro nomeia o passo que falhou');
  assert.ok(failedJourneyMarkup.includes('ADAPTER_EXECUTION_FAILED'), 'e mostra o código do erro');
  assert.ok(failedJourneyMarkup.includes('o restante espera uma decisão sua'), 'não diz que a jornada terminou');
  assert.ok(!failedJourneyMarkup.includes('Todos os passos que dependem só do produto estão concluídos'),
    'a frase de jornada concluída não aparece com run falho');

  // --------------------- 12. revisão humana visível (quem, quando, com que nota)
  // Dados reais pelo transporte HTTP: o run de animação bloqueado acima é rejeitado
  // e depois aprovado, e é isso que a interface tem que mostrar.
  const { timelineFor } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');
  // Run novo, parado de propósito no primeiro gate humano (os anteriores já foram
  // aprovados até o fim nas seções acima).
  const reviewRun = await liaForgeApi.run({
    workflowId: '2d-character-parts',
    destination: 'godot-4',
    brief: 'revisão humana visível',
    params: { sourceImage: 'input/sprite.png' },
  });
  assert.equal(reviewRun.snapshot.status, 'blocked', 'o run para no gate de revisão');
  const reviewRunId = reviewRun.runId;
  const pendingReviewStep = reviewRun.snapshot.steps.find((step) => step.state === 'blocked' && step.review?.status === 'review-missing');
  assert.ok(pendingReviewStep, 'há um passo esperando revisão humana para exercitar');

  const approvedSnapshot = await liaForgeApi.readRun(runId);
  const approvedStep = approvedSnapshot.steps.find((step) => step.review?.status === 'approved');
  assert.ok(approvedStep, 'readRun traz a decisão gravada no passo que foi aprovado');
  const approvedMarkup = renderToStaticMarkup(createElement(RunStepRow, { step: approvedStep }));
  assert.ok(approvedMarkup.includes('Aprovado por'), 'a linha do passo diz que houve aprovação humana');
  assert.ok(approvedMarkup.includes(approvedStep.review.reviewedBy ?? 'smoke-ui'), 'e diz quem aprovou');
  assert.ok(approvedMarkup.includes(String(approvedStep.review.reviewedAt ?? '')), 'e quando aprovou');

  const rejected = await reviewThroughIpc(reviewRunId, {
    stepId: pendingReviewStep.id,
    approved: false,
    reviewer: 'smoke-ui',
    note: 'ações não fecham o ciclo',
  });
  assert.equal(rejected.resumed, false, 'rejeitar não retoma o run');
  const afterRejection = await liaForgeApi.readRun(reviewRunId);
  const rejectedStep = afterRejection.steps.find((step) => step.id === pendingReviewStep.id);
  assert.equal(rejectedStep.review.status, 'review-missing', 'o passo rejeitado continua esperando revisão (não aparece como decidido)');
  assert.equal(rejectedStep.review.recorded?.approved, false, 'a rejeição fica visível como decisão gravada');
  const rejectedMarkup = renderToStaticMarkup(createElement(RunStepRow, { step: rejectedStep }));
  assert.ok(rejectedMarkup.includes('Você rejeitou este conteúdo'), 'a interface diz que aquele conteúdo foi rejeitado');
  assert.ok(rejectedMarkup.includes('ações não fecham o ciclo'), 'e mostra a nota do revisor');
  assert.ok(rejectedMarkup.includes('Aprovar e continuar') && rejectedMarkup.includes('Rejeitar e parar'),
    'as duas saídas continuam oferecidas depois da rejeição');

  const reapproved = await reviewThroughIpc(reviewRunId, {
    stepId: pendingReviewStep.id,
    approved: true,
    reviewer: 'smoke-ui',
    note: 'ações refeitas',
  });
  assert.equal(reapproved.resumed, true, 'aprovar depois da rejeição retoma o run');
  const afterReapproval = await liaForgeApi.readRun(reviewRunId);
  const reapprovedStep = afterReapproval.steps.find((step) => step.id === pendingReviewStep.id);
  assert.equal(reapprovedStep.review.status, 'approved', 'o passo reaprovado aparece como aprovado');
  assert.equal(reapprovedStep.review.history.length, 1, 'e a rejeição anterior continua no histórico');
  const reapprovedMarkup = renderToStaticMarkup(createElement(RunStepRow, { step: reapprovedStep }));
  assert.ok(reapprovedMarkup.includes('Aprovado por'), 'a aprovação atual aparece');
  assert.ok(reapprovedMarkup.includes('Rejeitado antes por'), 'a rejeição substituída aparece como histórico');
  assert.ok(reapprovedMarkup.includes('ações não fecham o ciclo'), 'com a nota que explicou o que estava errado');

  const timeline = timelineFor(afterReapproval);
  assert.ok(timeline.some((entry) => entry.kind === 'review' && /aprovado por smoke-ui/.test(entry.text)),
    'a aba Logs mostra a aprovação com autoria');
  assert.ok(timeline.some((entry) => entry.kind === 'review-history' && /rejeitado por smoke-ui/.test(entry.text)),
    'e mostra a rejeição anterior, marcada como decisão substituída');
  assert.ok(timeline.every((entry) => !/sk-|token/i.test(entry.text)), 'nenhum segredo entra na timeline');

  // ---------- 13. matriz da lista: o rótulo de cada botão e a ação real que ele dispara
  // Regra do produto: a interface só oferece ação que o serviço aceita, e o nome do
  // botão é o nome da ação. Cada estado abaixo é renderizado com os dados que a API
  // devolve e, em seguida, a ação do botão é **chamada de verdade**: um botão que
  // renderiza e devolve erro — ou a falta dele para uma ação aceita — falha aqui.
  // Estados que o smoke não produz naturalmente (failed, paused, interrompido com
  // plano) são gravados no disco do projeto temporário a partir do plano e do
  // snapshot de um run real; o estado é fabricado, a ação executada em seguida não é.
  const { runItemActions, RUN_ACTION_LABELS } = await vite.ssrLoadModule('/src/ForgeStudio.jsx');
  const runsDirectory = path.join(projectRoot, '.lia-forge', 'runs');
  const sourceSnapshot = JSON.parse(await fs.readFile(path.join(runsDirectory, runId, 'run.json'), 'utf8'));

  /** Grava um run com o plano real do 2D aprovado e o estado pedido. */
  const fabricateRun = async (fabricatedId, status, mutateSteps) => {
    const directory = path.join(runsDirectory, fabricatedId);
    await fs.mkdir(directory, { recursive: true });
    await fs.copyFile(path.join(runsDirectory, runId, 'plan.json'), path.join(directory, 'plan.json'));
    const steps = mutateSteps(sourceSnapshot.steps.map((step) => ({ ...step })));
    await fs.writeFile(path.join(directory, 'run.json'), `${JSON.stringify({
      ...sourceSnapshot,
      runId: fabricatedId,
      status,
      finishedAt: status === 'running' ? null : new Date().toISOString(),
      steps,
      summary: { ...sourceSnapshot.summary, finished: status === 'succeeded' },
    }, null, 2)}\n`, 'utf8');
    const listed = (await liaForgeApi.runs()).find((item) => item.runId === fabricatedId);
    assert.ok(listed, `o run ${fabricatedId} (${status}) aparece na listagem`);
    assert.equal(listed.status, status, `o estado gravado chega à lista como ${status}`);
    return listed;
  };

  /** Rótulos dos botões dentro do bloco de ações do item (o botão da linha é abrir). */
  const actionButtons = (markup) => {
    const tail = markup.slice(markup.indexOf('forge-run-recover'));
    if (!markup.includes('forge-run-recover')) return [];
    return [...tail.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
      .map((match) => match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  };

  /**
   * Mantém o primeiro passo concluído (é o checkpoint que a retomada deve
   * reaproveitar), marca o seguinte com o estado pedido e devolve o resto para
   * pendente — a forma de um run que parou no meio, sem fingir conclusão.
   */
  const stoppedAfterFirstCheckpoint = (steps, state, error = null) => {
    let kept = false;
    let marked = false;
    return steps.map((step) => {
      if (step.state !== 'succeeded') return step;
      if (!kept) { kept = true; return step; }
      if (!marked) {
        marked = true;
        return { ...step, state, error, finishedAt: state === 'pending' ? null : new Date().toISOString(), outputs: state === 'pending' ? [] : step.outputs };
      }
      return { ...step, state: 'pending', outputs: [], error: null, finishedAt: null };
    });
  };
  const failedSteps = (steps) => stoppedAfterFirstCheckpoint(steps, 'failed', {
    code: 'WORKFLOW_FAILED',
    message: 'falha simulada no meio da execução para exercitar a retomada',
    requiresUserDecision: false,
  });
  const interruptedSteps = (steps) => stoppedAfterFirstCheckpoint(steps, 'running');

  const matrixCases = [];

  // concluído: nenhuma ação (o serviço recusa retomar e não há estado a corrigir)
  const succeededItem = (await liaForgeApi.runs()).find((item) => item.runId === runId);
  matrixCases.push(['succeeded', succeededItem, []]);

  // bloqueado na revisão: nenhuma retomada, a saída é aprovar/rejeitar no painel
  const blockedListed = (await liaForgeApi.runs()).find((item) => item.status === 'blocked');
  matrixCases.push(['blocked', blockedListed, []]);

  // falhou / pausou / foi cancelado: "Retomar"
  matrixCases.push(['failed', await fabricateRun('run-matriz-failed', 'failed', failedSteps), [RUN_ACTION_LABELS.resumeFinished]]);
  // `paused` é o estado que o engine grava quando a execução terminou com passos
  // pendentes: um registro verdadeiro de parada, não um estado que mente. Por isso
  // a lista não o marca como interrompido (senão ofereceria "Corrigir estado" para
  // um run cujo estado já está certo) e `resumeRun` responde `interrupted: false`.
  const pausedItem = await fabricateRun('run-matriz-paused', 'paused', failedSteps);
  assert.equal(pausedItem.stale, false, 'run pausado não consta como interrompido');
  matrixCases.push(['paused', pausedItem, [RUN_ACTION_LABELS.resumeFinished]]);
  matrixCases.push(['cancelled', await fabricateRun('run-matriz-cancelled', 'cancelled', failedSteps), [RUN_ACTION_LABELS.resumeFinished]]);

  // interrompidos: "Corrigir estado" + "Retomar do checkpoint" (um item para cada
  // ação, porque a primeira ação muda o estado do run)
  matrixCases.push(['running órfão (retomar)', await fabricateRun('run-matriz-interrompido', 'running', interruptedSteps),
    [RUN_ACTION_LABELS.recoverState, RUN_ACTION_LABELS.resumeInterrupted]]);
  matrixCases.push(['running órfão (corrigir)', await fabricateRun('run-matriz-interrompido-2', 'running', interruptedSteps),
    [RUN_ACTION_LABELS.recoverState, RUN_ACTION_LABELS.resumeInterrupted]]);

  // sem plano gravado: corrigir o estado continua possível, retomar não
  const planlessListed = (await liaForgeApi.runs()).find((item) => item.runId === planlessId);
  matrixCases.push(['sem plano gravado', planlessListed, [RUN_ACTION_LABELS.recoverState]]);

  for (const [label, item, expected] of matrixCases) {
    assert.ok(item, `existe um run real no estado ${label}`);
    const markup = renderRunItem(item);
    assert.deepEqual(actionButtons(markup), expected,
      `os botões do run ${label} são exatamente os que o serviço aceita (${JSON.stringify(expected)})`);
    const fromRule = [runItemActions(item).correct?.label, runItemActions(item).resume?.label].filter(Boolean);
    assert.deepEqual(fromRule, expected,
      `a regra compartilhada decide os mesmos botões para o run ${label} (${JSON.stringify(fromRule)})`);
    if (expected.length === 0) {
      assert.ok(runItemActions(item).note.length > 0 || !runItemActions(item).visible,
        `run ${label} não fica sem explicação quando há algo a dizer`);
    }
  }

  // execução viva agora: nenhum botão (variante de apresentação sobre um item real;
  // o caso com processo vivo de verdade está em tests/run-lifecycle-smoke.mjs)
  const liveMarkup = renderRunItem({ ...succeededItem, status: 'running', active: true, stale: false });
  assert.deepEqual(actionButtons(liveMarkup), [], 'run em execução neste processo não oferece retomada nem correção de estado');
  assert.ok(liveMarkup.includes('Em execução agora'), 'e diz que está executando agora');

  // ---- a ação real de cada botão, pelo transporte HTTP
  const resumedFailed = await liaForgeApi.resumeRun('run-matriz-failed', { reason: 'botão Retomar do run falho' });
  assert.equal(resumedFailed.ok, true, 'retomar o run falho é aceito (o botão não devolve erro)');
  assert.equal(resumedFailed.resumedFrom, 'failed', 'a resposta diz de que estado veio a retomada');
  assert.equal(resumedFailed.interrupted, false, 'run falho não é execução interrompida');
  assert.ok(resumedFailed.checkpointsReused >= 1, `os passos concluídos são reaproveitados (${resumedFailed.checkpointsReused})`);
  assert.ok(['blocked', 'succeeded', 'failed'].includes(resumedFailed.result.status),
    `a retomada segue até um estado real (${resumedFailed.result.status})`);

  const resumedPaused = await liaForgeApi.resumeRun('run-matriz-paused', { reason: 'botão Retomar do run pausado' });
  assert.equal(resumedPaused.ok, true, 'retomar o run pausado é aceito');
  assert.equal(resumedPaused.resumedFrom, 'paused', 'e a resposta diz que veio de uma pausa');

  const resumedCancelled = await liaForgeApi.resumeRun('run-matriz-cancelled', { reason: 'botão Retomar do run cancelado' });
  assert.equal(resumedCancelled.ok, true, 'retomar o run cancelado é aceito');
  assert.equal(resumedCancelled.resumedFrom, 'cancelled', 'e a resposta diz que veio de um cancelamento');

  const resumedInterrupted = await liaForgeApi.resumeRun('run-matriz-interrompido', { reason: 'botão Retomar do checkpoint' });
  assert.equal(resumedInterrupted.ok, true, 'retomar o run interrompido é aceito');
  assert.equal(resumedInterrupted.interrupted, true, 'a resposta distingue a retomada de uma execução que nunca terminou');
  assert.equal(resumedInterrupted.resumedFrom, 'running', 'o estado gravado era "em andamento"');
  assert.ok(resumedInterrupted.checkpointsReused >= 1, `checkpoints reaproveitados (${resumedInterrupted.checkpointsReused})`);
  assert.equal((await liaForgeApi.runs()).find((item) => item.runId === 'run-matriz-interrompido')?.stale, false,
    'depois de retomado o run deixa de constar como interrompido');

  const recovered = await liaForgeApi.cancelRun('run-matriz-interrompido-2', { reason: 'botão Corrigir estado' });
  assert.equal(recovered.ok, true, 'corrigir o estado do run interrompido é aceito');
  assert.equal(recovered.stale, true, 'e a resposta diz que não havia execução neste processo (não finge ter parado nada)');
  const recoveredItem = (await liaForgeApi.runs()).find((item) => item.runId === 'run-matriz-interrompido-2');
  assert.equal(recoveredItem.status, 'cancelled', 'o estado gravado passa a cancelado');
  assert.deepEqual(actionButtons(renderRunItem(recoveredItem)), [RUN_ACTION_LABELS.resumeFinished],
    'e o item passa a oferecer "Retomar" — o botão muda junto com o estado, sem recarregar regra nenhuma');

  await assert.rejects(() => liaForgeApi.resumeRun(planlessId, { reason: 'sem plano gravado' }),
    /plano original/, 'retomar sem o plano gravado é recusado com motivo — é por isso que o botão não aparece');

  const refusedSucceeded = await liaForgeApi.resumeRun(runId);
  assert.equal(refusedSucceeded.ok, false, 'retomar o run concluído é recusado (por isso ele não tem botão)');

  // run bloqueado: retomar não resolve (o gate continua lá); aprovar resolve.
  const blockedBefore = await liaForgeApi.readRun(blockedListed.runId);
  const blockedStepId = blockedBefore.steps.find((step) => step.state === 'blocked' && step.review?.status === 'review-missing')?.id;
  assert.ok(blockedStepId, 'o run bloqueado da matriz tem um passo esperando revisão');
  const resumedBlocked = await liaForgeApi.resumeRun(blockedListed.runId, { reason: 'retomar sem revisar' });
  assert.equal(resumedBlocked.ok, true, 'o serviço aceita retomar um run bloqueado…');
  assert.equal(resumedBlocked.result.status, 'blocked', '…e ele para no mesmo gate: retomar não substitui a revisão');
  assert.ok(resumedBlocked.result.steps.some((step) => step.id === blockedStepId && step.state === 'blocked'),
    'o passo que esperava revisão continua esperando (a interface certa em não oferecer o botão)');
  const unblocked = await reviewThroughIpc(blockedListed.runId, { stepId: blockedStepId, approved: true, reviewer: 'smoke-ui', note: 'a saída real do run bloqueado' });
  assert.equal(unblocked.resumed, true, 'aprovar retoma o run a partir dos checkpoints — é essa a ação que a lista nomeia');

  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  assert.equal(typeof App, 'function', 'App.jsx continua carregando com a página nova ligada');

  console.log(`Studio UI smoke test passed (cliente HTTP ↔ API ↔ serviço, revisão + retomada + exportação, revisão humana visível com histórico, rig entre runs, entradas pendentes, validações, providers, upload de referências, Comparison Lab, ciclo de vida do run, projeto, roteiro de 12 passos, run interrompido/cancelado na lista com as saídas que o serviço aceita, matriz de seis estados com o rótulo de cada botão e a ação real que ele dispara; transporte ${liaForgeApi.transport}).`);
} finally {
  globalThis.fetch = nativeFetch;
  await vite.close();
  httpServer.close();
  await once(httpServer, 'close').catch(() => {});
  await fs.rm(projectRoot, { recursive: true, force: true });
}
