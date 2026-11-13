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

  // --------------------------------------------- 6. providers pela API (F8/§9)
  const providers = await liaForgeApi.providers();
  assert.equal(providers.comfyui.mode, 'local-loopback', 'o padrão é executar na própria máquina');
  assert.equal(providers.comfyui.connected, false, 'sem servidor local, nada é reportado como conectado');
  assert.equal(providers.blender.available, false, 'sem executável, o Blender não aparece como disponível');
  assert.match(providers.blender.detail, /não é instalado automaticamente/, 'a interface diz que nada é instalado automaticamente');
  assert.match(providers.note, /Nenhuma ferramenta foi instalada/, 'a nota de provider repete a garantia');

  const secretRefusal = await nativeFetch(`${origin}/api/lia-forge/studio/providers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'comfyui', token: 'segredo-nunca-gravado' }),
  });
  assert.equal(secretRefusal.status, 400, 'segredo enviado pela UI é recusado com 400');
  assert.match(await secretRefusal.text(), /segredo/i, 'a recusa explica por quê');

  const remoteRefusal = await nativeFetch(`${origin}/api/lia-forge/studio/providers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'comfyui', mode: 'local-loopback', endpoint: 'http://10.9.8.7:8188' }),
  });
  assert.equal(remoteRefusal.status, 400, 'modo local com endpoint de outra máquina é recusado');

  const configured = await liaForgeApi.configureProvider({ id: 'blender', mode: 'path', executable: path.join(os.tmpdir(), 'blender-que-nao-existe') });
  assert.equal(configured.providers.blender.available, false, 'caminho inexistente não vira ferramenta disponível');
  assert.match(configured.providers.blender.detail, /não existe ou não é executável/, 'o motivo do caminho inválido aparece na UI');
  const storedProviders = JSON.parse(await fs.readFile(path.join(projectRoot, '.lia-forge', 'providers.json'), 'utf8'));
  assert.equal(storedProviders.providers.blender.mode, 'path', 'a escolha fica gravada no projeto');
  assert.ok(!JSON.stringify(storedProviders).includes('segredo-nunca-gravado'), 'nenhum segredo foi gravado em .lia-forge/providers.json');
  await liaForgeApi.configureProvider({ id: 'blender', mode: 'auto', executable: null });

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'payload.exe', base64: Buffer.from('MZ').toString('base64') }),
  });
  assert.equal(badExtension.status, 400, 'formato não aceito é recusado com 400');
  const badContent = await nativeFetch(`${origin}/api/lia-forge/studio/inputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'falso.png', base64: Buffer.from('isto não é um png').toString('base64') }),
  });
  assert.equal(badContent.status, 400, 'PNG inválido é recusado com 400');

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'teste' }),
  });
  assert.equal(missingCancel.status, 404, 'cancelar run inexistente devolve 404');
  const missingResume = await nativeFetch(`${origin}/api/lia-forge/studio/runs/run-inexistente/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(missingResume.status, 404, 'retomar run inexistente devolve 404');
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
  const projectMethod = await nativeFetch(`${origin}/api/lia-forge/studio/project`, { method: 'POST' });
  assert.equal(projectMethod.status, 405, 'criar/trocar projeto não é permitido por HTTP');
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
  assert.ok(staleMarkup.includes('Corrigir estado') && staleMarkup.includes('Retomar'), 'as duas saídas são oferecidas no próprio item');

  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  assert.equal(typeof App, 'function', 'App.jsx continua carregando com a página nova ligada');

  console.log(`Studio UI smoke test passed (cliente HTTP ↔ API ↔ serviço, revisão + retomada + exportação, rig entre runs, entradas pendentes, validações, providers, upload de referências, Comparison Lab, ciclo de vida do run, projeto, roteiro de 12 passos e run interrompido na UI; transporte ${liaForgeApi.transport}).`);
} finally {
  globalThis.fetch = nativeFetch;
  await vite.close();
  httpServer.close();
  await once(httpServer, 'close').catch(() => {});
  await fs.rm(projectRoot, { recursive: true, force: true });
}
