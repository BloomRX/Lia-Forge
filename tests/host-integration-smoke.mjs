/**
 * Integração real com ferramentas externas (requisitos §3, §6, §9, §12).
 *
 * O que este smoke prova executando de verdade neste ambiente:
 *   1. as integrações do repositório (`electron/blender-adapter.cjs`,
 *      `electron/external-tools.cjs`, `electron/manual-artifacts.cjs`,
 *      `electron/task-manager.cjs`, `scripts/comfyui-client.mjs`) funcionam
 *      fora do Electron: o mesmo adapter roda em qualquer hospedeiro Node;
 *   2. um executável externo é descoberto, lançado como processo filho real
 *      (`spawn`), com os argumentos do contrato Blender, e o artefato que ele
 *      grava em disco é validado por estrutura E conteúdo antes de virar
 *      output do run — com proveniência (executável + args) gravada no passo;
 *   3. um servidor ComfyUI em loopback é consultado de verdade (HTTP real:
 *      /system_stats, /models/checkpoints, /prompt, /history, /view), o
 *      checkpoint escolhido pelo usuário é enviado no grafo, e o PNG retornado
 *      é gravado e validado;
 *   4. a escolha de provider é real: local (loopback), remoto (só com
 *      autorização gravada) ou desativado — e cada recusa aparece como
 *      bloqueio nomeado, nunca como falha nem como "disponível";
 *   5. segredos nunca são gravados na configuração do projeto.
 *
 * HONESTIDADE SOBRE OS SUBSTITUTOS: neste ambiente não existe Blender nem
 * ComfyUI instalados. Os dois são substituídos por um executável de teste e um
 * servidor HTTP de teste, criados aqui e rotulados como tal. Eles exercitam o
 * mesmo caminho de código que a ferramenta real percorreria (spawn, args,
 * escrita em disco, validação, HTTP, grafo, download do PNG), mas NENHUMA
 * afirmação deste teste vale como "Blender renderizou" ou "ComfyUI difundiu".
 * A execução na ferramenta real continua pendente de instalação pelo usuário.
 *
 * Nada instala, baixa, compra ou envia dados para fora da máquina.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createStudioService } from '../shared/services/studio-service.mjs';
import { createImage } from '../shared/imaging/core.mjs';
import { encodePngRgba, decodePng, analyzePngContent } from '../shared/qa/png-codec.mjs';
import { createProviderStore } from '../shared/integrations/provider-store.mjs';
import { createHostDefaults } from '../shared/integrations/host-defaults.mjs';
import { buildGlbFixture } from './glb-fixtures.mjs';
import { rendererStub, codecShimSource } from './tool-stubs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

function check(condition, message) {
  assert.ok(condition, message);
}

/** PNG 512×512 com gradiente + formas: conteúdo real, não uma tela vazia. */
function conceptPng(width = 512, height = 512) {
  const image = createImage(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      image.rgba[index] = (x * 255) / width;
      image.rgba[index + 1] = (y * 255) / height;
      image.rgba[index + 2] = 160;
      image.rgba[index + 3] = 255;
    }
  }
  for (let y = 120; y < 380; y += 1) {
    for (let x = 140; x < 340; x += 1) {
      image.rgba.set([255, 90, 200, 255], (y * width + x) * 4);
    }
  }
  return encodePngRgba(image.rgba, image.width, image.height);
}

// -------------------------------------------------- substituto do executável
/**
 * Executável de teste no lugar do Blender. Recebe exatamente os argumentos que
 * `buildBlenderSpritesheetArgs` produz e grava `spritesheet.png` +
 * `spritesheet.json` na pasta de saída — como o script real faria.
 */


/** Imagem e encoder usados pelo stub: um único módulo do repo, sem duplicar código. */
const CODEC_URL = pathToFileURL(path.join(REPO_ROOT, 'shared', 'imaging', 'core.mjs')).href;
const PNG_CODEC_URL = pathToFileURL(path.join(REPO_ROOT, 'shared', 'qa', 'png-codec.mjs')).href;

// -------------------------------------------------- substituto do ComfyUI
function createComfyUiStub() {
  const png = conceptPng();
  const hits = { total: 0, byPath: {}, prompts: [] };
  let promptCount = 0;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    hits.total += 1;
    const key = `${request.method} ${url.pathname}`;
    hits.byPath[key] = (hits.byPath[key] ?? 0) + 1;
    const send = (status, body, type = 'application/json') => {
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
      response.writeHead(status, { 'Content-Type': type, 'Content-Length': String(bytes.length) });
      response.end(bytes);
    };
    if (request.method === 'GET' && url.pathname === '/system_stats') {
      send(200, {
        system: { comfyui_version: '0.0.0-substituto-de-teste', python_version: '3.11.0', torch_version: null },
        devices: [{ name: 'CPU (substituto de teste)', type: 'cpu', index: 0, vram_total: null, vram_free: null }],
      });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/queue') { send(200, { queue_running: [], queue_pending: [] }); return; }
    if (request.method === 'GET' && url.pathname.startsWith('/models/')) {
      send(200, url.pathname === '/models/checkpoints' ? ['lia-forge-test.safetensors'] : []);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/prompt') {
      const chunks = [];
      request.on('data', (chunk) => chunks.push(chunk));
      request.on('end', () => {
        let payload = null;
        try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { send(400, { error: 'json inválido' }); return; }
        promptCount += 1;
        const promptId = `stub-prompt-${promptCount}`;
        hits.prompts.push({ promptId, graph: payload?.prompt ?? null, clientId: payload?.client_id ?? null });
        server.pending = server.pending ?? new Map();
        server.pending.set(promptId, payload?.prompt ?? null);
        send(200, { prompt_id: promptId, number: promptCount, node_errors: null });
      });
      return;
    }
    if (request.method === 'GET' && url.pathname.startsWith('/history/')) {
      const promptId = decodeURIComponent(url.pathname.slice('/history/'.length));
      send(200, {
        [promptId]: {
          status: { completed: true, status_str: 'success', messages: [] },
          outputs: { 7: { images: [{ filename: 'concept.png', subfolder: '', type: 'output' }] } },
        },
      });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/view') { send(200, png, 'image/png'); return; }
    send(404, { error: `rota não implementada no substituto: ${key}` });
  });
  return { server, hits, start: () => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port))), stop: () => new Promise((resolve) => server.close(resolve)) };
}

// ------------------------------------------------------------------ cenário
const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-host-integration-'));
const toolDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-host-tools-'));
const comfy = createComfyUiStub();
const findings = [];

try {
  await fs.mkdir(path.join(projectRoot, 'input'), { recursive: true });
  await fs.writeFile(path.join(projectRoot, 'input', 'modelo.glb'), buildGlbFixture());

  // O stub precisa de um módulo que exporte createImage E encodePngRgba.
  const shimPath = path.join(toolDirectory, 'codec-shim.mjs');
  await fs.writeFile(shimPath, codecShimSource({ imagingUrl: CODEC_URL, pngCodecUrl: PNG_CODEC_URL }), 'utf8');
  const stubSource = rendererStub(pathToFileURL(shimPath).href);
  const rendererPath = path.join(toolDirectory, 'renderizador-de-teste.mjs');
  await fs.writeFile(rendererPath, stubSource, 'utf8');
  await fs.chmod(rendererPath, 0o755);
  // Cópia com o nome que a descoberta procura: prova que o PATH do usuário é
  // percorrido de verdade (sem instalar nada — o arquivo é criado pelo teste).
  const onPathPath = path.join(toolDirectory, 'blender');
  await fs.writeFile(onPathPath, stubSource, 'utf8');
  await fs.chmod(onPathPath, 0o755);

  const service = createStudioService({ projectRoot });
  const host = createHostDefaults();

  // ------------------------------------------- 1. nada é "disponível" à toa
  const initial = await service.providers();
  check(initial.comfyui.connected === false, 'sem servidor local, o ComfyUI não aparece como conectado');
  check(initial.blender.available === false, 'sem executável, o Blender não aparece como disponível');
  check(/não é instalado automaticamente/i.test(initial.blender.detail), 'a mensagem diz que nada é instalado automaticamente');
  const preflightBefore = await service.preflight();
  const blenderBefore = preflightBefore.tools.find((item) => item.adapterId === 'blender-spritesheet');
  check(blenderBefore.status === 'missing', `adapter Blender ausente antes de configurar (${blenderBefore.status})`);
  check(blenderBefore.executable === null, 'nenhum executável é inventado quando a ferramenta não existe');
  check(preflightBefore.summary.toolsMissing >= 1, 'o preflight conta a ferramenta ausente');
  findings.push('antes de configurar: Blender ausente e ComfyUI não conectado — nada é apresentado como pronto');

  // --------------------------------- 2. integração real fora do Electron
  check(typeof host.findExternalTool === 'function', 'as integrações reais carregam em Node puro (sem Electron)');
  check(
    host.findExternalTool('blender', { env: { PATH: toolDirectory }, platform: 'linux' }) === onPathPath,
    'a descoberta percorre o PATH do usuário e encontra o executável (nada é instalado aqui)',
  );
  check(host.findExternalTool('blender', { env: { PATH: toolDirectory }, platform: 'linux' }) !== null, 'o resultado da descoberta não é nulo quando o executável existe');
  check(host.blenderScriptPath.endsWith(path.join('scripts', 'blender_spritesheet.py')), 'o script do Blender usado é o do repositório');
  findings.push('host-defaults: findExternalTool, taskRegistry, cliente ComfyUI e script Blender carregam fora do Electron');

  // ------------------------------- 3. provider Blender apontando para o stub
  const configuredBlender = await service.configureProvider({ id: 'blender', mode: 'path', executable: rendererPath, frameSize: '48x48' });
  check(configuredBlender.providers.blender.available === true, 'com executável real no disco, o provider fica disponível');
  check(configuredBlender.providers.blender.executable === rendererPath, 'o caminho configurado é o usado');
  check(configuredBlender.providers.blender.executableSource === 'user-configuration',
    'a origem do executável é dita: caminho configurado pelo usuário (não "a ferramenta está instalada")');
  check(configuredBlender.providers.blender.versionConfirmed === false,
    'a identidade como Blender não é afirmada sem medição');
  check(/identidade como Blender não foi confirmada/i.test(configuredBlender.providers.blender.detail),
    'a mensagem do provider diz que a identidade não foi confirmada');

  const preflightWithBlender = await service.preflight();
  const blenderAdapter = preflightWithBlender.tools.find((item) => item.adapterId === 'blender-spritesheet');
  check(blenderAdapter.status === 'available', `adapter Blender disponível após configurar (${blenderAdapter.status})`);
  check(blenderAdapter.executable === rendererPath, 'o preflight reporta o executável configurado pelo usuário');
  check(blenderAdapter.executableSource === 'user-configuration', 'o pré-voo diz de onde veio o executável aceito');
  check(blenderAdapter.versionConfirmed === false, 'o pré-voo não afirma versão que não mediu');
  check(/não executa o arquivo/i.test(blenderAdapter.detail),
    'e explica por que a versão não foi confirmada: a descoberta não executa o arquivo');

  const objectRun = await service.run({
    workflowId: '3d-object-render',
    destination: 'godot-4',
    params: { model: 'input/modelo.glb' },
  });
  const inspectStep = objectRun.snapshot.steps.find((step) => step.id === 'inspect');
  const renderStep = objectRun.snapshot.steps.find((step) => step.id === 'render');
  check(inspectStep.state === 'succeeded', `inspeção GLB executa de verdade (${inspectStep.state})`);
  check(renderStep.state === 'succeeded', `o processo externo executa e o artefato é aceito (${renderStep.state}: ${renderStep.error?.message ?? 'sem erro'})`);

  // Proveniência real: o passo registra o executável e os argumentos usados.
  check(renderStep.execution?.kind === 'process', 'a proveniência registra execução por processo');
  check(renderStep.execution.executable === rendererPath, 'a proveniência aponta o executável configurado pelo usuário');
  const args = renderStep.execution.args;
  check(args.includes('--python') && args[args.indexOf('--python') + 1].endsWith('blender_spritesheet.py'), 'o script do repositório é passado ao processo');
  check(args.includes('--input') && args[args.indexOf('--input') + 1].endsWith('modelo.glb'), 'o modelo informado pelo usuário é passado ao processo');
  check(args.includes('--frame-width') && args[args.indexOf('--frame-width') + 1] === '48', 'as dimensões configuradas chegam ao processo');

  const renderOutputs = renderStep.outputs;
  check(renderOutputs.some((output) => output.endsWith('.png')) && renderOutputs.some((output) => output.endsWith('.json')), 'o passo registra o PNG e o JSON gravados pelo processo');
  const sheetPath = path.join(projectRoot, renderOutputs.find((output) => output.endsWith('.png')));
  const sheetBytes = await fs.readFile(sheetPath);
  const sheet = decodePng(sheetBytes);
  const analysis = analyzePngContent(sheetBytes);
  check(sheet.width === 384 && sheet.height === 144, `a folha tem a grade do contrato 8×3 de 48×48 (${sheet.width}×${sheet.height})`);
  check(analysis.blank === false && analysis.coverage > 0.05, `o conteúdo foi medido, não apenas a estrutura (cobertura ${(analysis.coverage * 100).toFixed(1)}%)`);
  check(
    renderStep.validations.some((item) => item.validator === 'png-content' && item.status === 'passed'),
    'o validador de conteúdo declarado no plano rodou sobre o artefato do processo externo',
  );
  check(typeof renderStep.sha256 === 'string' && renderStep.sha256.length === 64, 'o artefato gravado por processo externo também recebe SHA-256');
  findings.push(`3d-object-render: processo externo real executado; folha ${sheet.width}×${sheet.height} com ${(analysis.coverage * 100).toFixed(1)}% de cobertura e SHA-256 registrado`);

  // ------------------------------- 4. ComfyUI local: HTTP real em loopback
  const port = await comfy.start();
  const endpoint = `http://127.0.0.1:${port}`;
  const configuredComfy = await service.configureProvider({
    id: 'comfyui',
    mode: 'local-loopback',
    endpoint,
    checkpoint: 'lia-forge-test.safetensors',
    workflowId: 'character-concept',
  });
  check(configuredComfy.providers.comfyui.connected === true, `o provider local consulta o servidor e reporta conexão (${configuredComfy.providers.comfyui.detail})`);
  check(configuredComfy.providers.comfyui.version === '0.0.0-substituto-de-teste', 'a versão reportada vem do servidor consultado');
  const preflightWithComfy = await service.preflight();
  const comfyAdapter = preflightWithComfy.tools.find((item) => item.adapterId === 'comfyui-concept');
  check(comfyAdapter.status === 'available', `a descoberta do adapter vê o servidor local (${comfyAdapter.status})`);
  check(comfyAdapter.endpoint === endpoint, 'o endpoint loopback configurado é o usado');
  check(comfy.hits.byPath['GET /system_stats'] >= 1, 'a descoberta consultou /system_stats de verdade');

  // 4.1 Esta máquina tem menos RAM do que o adapter declara precisar: o passo é
  // bloqueado com o número medido no motivo e NADA é enviado ao servidor.
  const brief = 'Heroína de neon correndo sob chuva roxa, vista lateral, estilo pixel art';
  const shortPlan = await service.plan({ workflowId: '2d-art-concept', destination: 'godot-4', brief });
  const shortReason = String(shortPlan.plan.steps[0].blockedReason ?? '');
  const machine = (await service.overview()).machine;
  if (machine.ramMb < 8192) {
    check(/RAM/.test(shortReason), `o bloqueio nomeia o recurso medido (${shortReason.slice(0, 140)})`);
    const shortRun = await service.run({ workflowId: '2d-art-concept', destination: 'godot-4', brief });
    const shortStep = shortRun.snapshot.steps.find((step) => step.id === 'concept');
    check(shortStep.state === 'blocked', `sem RAM suficiente o passo não executa (${shortStep.state})`);
    check(shortRun.snapshot.steps.every((step) => step.state !== 'failed'), 'requisito não atendido não vira falha do produto');
    check(comfy.hits.byPath['POST /prompt'] === undefined, 'nenhum workflow é enviado quando a máquina não atende ao requisito declarado');
    findings.push(`requisito medido respeitado: ${machine.ramMb} MB de RAM < 8192 MB exigidos → passo bloqueado, zero envio`);
  } else {
    findings.push(`máquina atende ao requisito de RAM (${machine.ramMb} MB): o caso de bloqueio por recurso não se aplica aqui`);
  }

  // 4.2 Numa máquina que atende ao requisito (medição simulada e rotulada como
  // tal — este ambiente tem 3,9 GB), o mesmo caminho executa de ponta a ponta.
  const capableRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-host-capable-'));
  const capableService = createStudioService({
    projectRoot: capableRoot,
    machineInfo: async () => ({ ...machine, ramMb: 16384, freeRamMb: 12288, note: 'Medição simulada pelo smoke de integração: RAM suficiente para o requisito declarado.' }),
  });
  await capableService.configureProvider({
    id: 'comfyui',
    mode: 'local-loopback',
    endpoint,
    checkpoint: 'lia-forge-test.safetensors',
    workflowId: 'character-concept',
  });
  const conceptRun = await capableService.run({ workflowId: '2d-art-concept', destination: 'godot-4', brief });
  const conceptStep = conceptRun.snapshot.steps.find((step) => step.id === 'concept');
  check(conceptStep.outputs.length >= 1, `a difusão local gerou artefato antes do gate de revisão (${conceptStep.state}: ${conceptStep.error?.message ?? 'sem erro'})`);
  check(comfy.hits.byPath['POST /prompt'] === 1, 'exatamente um workflow foi enviado ao servidor local');
  const sentGraph = comfy.hits.prompts[0].graph;
  check(sentGraph?.['1']?.inputs?.ckpt_name === 'lia-forge-test.safetensors', 'o checkpoint escolhido pelo usuário é o enviado no grafo');
  check(String(sentGraph?.['2']?.inputs?.text ?? '').includes('Heroína de neon'), 'o texto escrito pelo usuário chega ao grafo');
  const conceptOutput = conceptStep.outputs.find((output) => output.endsWith('.png'));
  const conceptBytes = await fs.readFile(path.join(capableRoot, conceptOutput));
  const conceptAnalysis = analyzePngContent(conceptBytes);
  check(conceptAnalysis.blank === false && conceptAnalysis.uniqueColors > 100, `a imagem recebida tem conteúdo medido (${conceptAnalysis.uniqueColors} cores)`);
  check(
    conceptStep.validations.some((item) => item.validator === 'png-content' && item.status === 'passed'),
    'o conceito gerado passa pelo validador de conteúdo declarado no plano',
  );
  findings.push(`2d-art-concept: HTTP real em loopback; checkpoint e prompt do usuário enviados; PNG de ${conceptAnalysis.uniqueColors} cores validado`);

  // ------------------------------------- 5. revisão humana continua de pé
  check(conceptStep.state === 'blocked' && conceptStep.review?.status === 'review-missing', `o gate de revisão para o run antes de entregar (${conceptStep.state})`);
  const reviewed = await capableService.reviewStep({ runId: conceptRun.runId, stepId: 'concept', approved: true, reviewer: 'smoke-de-integracao', note: 'conceito conferido' });
  check(reviewed.resumed === true, 'aprovar a revisão retoma o run');
  check(reviewed.decision.sha256?.length === 64, 'a revisão ancora o SHA-256 do artefato vindo da ferramenta externa');
  const reviewedStep = reviewed.result.steps.find((step) => step.id === 'concept');
  check(reviewedStep.state === 'succeeded', `após a revisão o passo conclui (${reviewedStep.state})`);
  findings.push('gate de revisão preservado sobre artefato vindo de ferramenta externa (SHA-256 + retomada)');

  // ----------------------- 6. provider remoto sem autorização não envia nada
  const hitsBeforeRemote = comfy.hits.total;
  await capableService.configureProvider({ id: 'comfyui', mode: 'remote', endpoint: 'https://worker.invalido.exemplo' });
  const remoteRun = await capableService.run({ workflowId: '2d-art-concept', destination: 'godot-4', brief });
  const remoteStep = remoteRun.snapshot.steps.find((step) => step.id === 'concept');
  check(remoteStep.state !== 'succeeded', `sem autorização o passo remoto não gera nada (${remoteStep.state})`);
  check(remoteRun.snapshot.steps.every((step) => step.state !== 'failed'), 'nenhum passo aparece como falha por decisão de autorização');
  check(comfy.hits.total === hitsBeforeRemote, 'nenhuma requisição nova saiu durante o teste do provider remoto');
  const remoteState = await capableService.providers();
  check(remoteState.comfyui.authorization.granted === false, 'a pendência de autorização fica visível na configuração');
  check(/sem autorização/i.test(remoteState.comfyui.detail), 'a interface recebe o motivo da pendência');
  findings.push('provider remoto sem autorização: nada enviado, nada gerado, pendência visível');

  // ------------------------------------------- 7. recusas e honestidade
  await assert.rejects(
    () => service.configureProvider({ id: 'comfyui', mode: 'local-loopback', endpoint: 'http://10.0.0.5:8188' }),
    /loopback/i,
    'o modo local recusa endpoint de outra máquina',
  );
  await assert.rejects(
    () => service.configureProvider({ id: 'comfyui', token: 'segredo-super-secreto' }),
    /segredo/i,
    'campo de segredo é recusado',
  );
  const store = createProviderStore({ projectRoot });
  const persisted = JSON.stringify(await store.read());
  check(!persisted.includes('segredo-super-secreto'), 'nenhum segredo foi gravado em .lia-forge/providers.json');
  check(path.dirname((await fs.realpath(path.join(projectRoot, '.lia-forge', 'providers.json')))).endsWith('.lia-forge'), 'a configuração fica dentro de .lia-forge/');

  const brokenBlender = await service.configureProvider({ id: 'blender', mode: 'path', executable: path.join(toolDirectory, 'nao-existe') });
  check(brokenBlender.providers.blender.available === false, 'caminho inexistente não vira ferramenta disponível');
  check(/não existe ou não é executável/i.test(brokenBlender.providers.blender.detail), 'o motivo do caminho inválido é dito com clareza');
  const brokenRun = await service.run({ workflowId: '3d-object-render', destination: 'godot-4', params: { model: 'input/modelo.glb' } });
  const brokenRender = brokenRun.snapshot.steps.find((step) => step.id === 'render');
  check(brokenRender.state === 'blocked', `render bloqueado com caminho inválido (${brokenRender.state})`);
  check(brokenRun.snapshot.steps.every((step) => step.state !== 'failed'), 'ferramenta ausente nunca vira falha do produto');

  await capableService.configureProvider({ id: 'comfyui', mode: 'local-loopback', endpoint, checkpoint: 'lia-forge-test.safetensors' });
  const disabled = await capableService.configureProvider({ id: 'comfyui', mode: 'disabled' });
  check(disabled.providers.comfyui.connected === false, 'provider desativado não consulta nada');
  const hitsBeforeDisabled = comfy.hits.total;
  const disabledRun = await capableService.run({ workflowId: '2d-art-concept', destination: 'godot-4', brief: 'Personagem de teste para o provider desativado neste smoke' });
  const disabledStep = disabledRun.snapshot.steps.find((step) => step.id === 'concept');
  check(disabledStep.state !== 'succeeded', `com o provider desativado nada é gerado (${disabledStep.state})`);
  check(comfy.hits.total === hitsBeforeDisabled, 'nenhuma requisição é feita com o provider desativado');
  findings.push('recusas verificadas: não-loopback, segredo, caminho inválido e provider desativado');

  console.log('Host integration smoke test passed (integrações reais fora do Electron; processo externo e ComfyUI em loopback exercitados com substitutos rotulados).');
  for (const line of findings) console.log(`  · ${line}`);
  console.log('  · Substitutos de teste (não são Blender/ComfyUI reais): renderizador e servidor HTTP criados neste smoke; a execução nas ferramentas reais continua pendente de instalação pelo usuário.');
} finally {
  await comfy.stop();
  await fs.rm(projectRoot, { recursive: true, force: true });
  await fs.rm(toolDirectory, { recursive: true, force: true });
  await fs.rm(path.join(os.tmpdir(), 'lia-host-capable-'), { recursive: true, force: true }).catch(() => {});
}
