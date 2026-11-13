/**
 * Smoke de coerência Studio ↔ preload ↔ processo principal (§11 da T13).
 *
 * O Studio fala com o mesmo `createStudioService` por dois transportes: HTTP no
 * navegador/preview e IPC no desktop. O transporte IPC só existe se três arquivos
 * combinarem — `src/lia-forge-api.js` (quem chama), `electron/preload.cjs` (o que
 * é exposto) e `electron/main.cjs` (o que responde). Um método novo em qualquer
 * um dos três e esquecido nos outros só quebra no aplicativo empacotado, que é
 * justamente o que não dá para executar aqui.
 *
 * Este teste é análise estática dos três arquivos (não abre janela nem exige
 * Electron instalado) e afirma:
 *   1. todo método que o cliente chama no bridge existe no preload;
 *   2. todo canal `lia-forge:studio:*` do preload tem `ipcMain.handle` no main;
 *   3. todo handler `lia-forge:studio:*` do main está exposto no preload (sem
 *      handler órfão);
 *   4. todo handler do Studio valida o emissor com `assertTrustedIpcSender`
 *      (gate de IPC preservado — handler novo sem guard é pego aqui);
 *   5. paridade de transporte: cada método do Studio ou tem rota HTTP no
 *      dev-server ou é uma das exceções desktop-only documentadas (diálogos e
 *      "ver no sistema", que no navegador devolvem `null`);
 *   6. disciplina de canais: namespace `lia-forge:`, `invoke`↔`handle`,
 *      `send`↔`on`, `on` do renderer↔`webContents.send` do main, e o preload sem
 *      expor `ipcRenderer` cru;
 *   7. a janela segue com `contextIsolation`, sem `nodeIntegration`, com
 *      `sandbox` e `webSecurity`, e navegação/abertura de janela bloqueadas.
 *
 * Nada aqui afirma que o aplicativo empacotado foi executado — afirma que os três
 * lados do transporte IPC combinam e que os guards estão no lugar.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const apiSource = read('src/lia-forge-api.js');
const preloadSource = read('electron/preload.cjs');
const mainSource = read('electron/main.cjs');
const viteSource = read('vite.config.js');

const checks = [];
function check(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  assert.ok(condition, message);
}

// ---------------------------------------------------------------- 1. superfícies
/** Métodos que o cliente chama no bridge do desktop (`ipc.metodo(`). */
const calledByClient = [...new Set([...apiSource.matchAll(/\bipc\.([A-Za-z0-9_]+)\s*\(/g)].map((match) => match[1]))].sort();

/**
 * Bloco `studio: Object.freeze({ ... })` do preload → método → canal.
 * O fim é achado por balanceamento de chaves: vários métodos terminam em `}),`
 * (payloads inline), então procurar o primeiro `}),` cortaria o bloco no meio.
 */
const studioBlock = (() => {
  const marker = 'studio: Object.freeze({';
  const start = preloadSource.indexOf(marker);
  assert.ok(start > 0, 'o preload expõe o bloco studio');
  let depth = 0;
  for (let index = start + marker.length - 1; index < preloadSource.length; index += 1) {
    const char = preloadSource[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return preloadSource.slice(start, index + 1);
    }
  }
  throw new Error('o bloco studio do preload não fecha as chaves');
})();
const preloadStudio = new Map(
  [...studioBlock.matchAll(/([A-Za-z0-9_]+):\s*\([^)]*\)\s*=>\s*ipcRenderer\.invoke\('([^']+)'/g)]
    .map((match) => [match[1], match[2]]),
);

/** Canais que o processo principal responde. */
const mainHandles = new Set([...mainSource.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)].map((match) => match[1]));
const mainListeners = new Set([...mainSource.matchAll(/ipcMain\.on\(\s*'([^']+)'/g)].map((match) => match[1]));
const mainSends = new Set([...mainSource.matchAll(/webContents\.send\(\s*'([^']+)'/g)].map((match) => match[1]));

/** Canais que o renderer usa. */
const rendererInvoke = new Set([...preloadSource.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map((match) => match[1]));
const rendererSend = new Set([...preloadSource.matchAll(/ipcRenderer\.send\('([^']+)'/g)].map((match) => match[1]));
const rendererOn = new Set([...preloadSource.matchAll(/ipcRenderer\.on\('([^']+)'/g)].map((match) => match[1]));

check(calledByClient.length >= 25, `o cliente do Studio chama ${calledByClient.length} métodos no bridge`);
check(preloadStudio.size >= 25, `o preload expõe ${preloadStudio.size} métodos do Studio`);

// ------------------------------------- 2. cliente → preload (nada chama fantasma)
const missingInPreload = calledByClient.filter((method) => !preloadStudio.has(method));
check(missingInPreload.length === 0,
  `todo método chamado pelo cliente existe no preload (faltando: ${missingInPreload.join(', ') || 'nenhum'})`);

// --------------------------------- 3. preload ↔ main (canal exposto tem resposta)
const studioChannels = [...preloadStudio.values()].filter((channel) => channel.startsWith('lia-forge:studio:'));
check(studioChannels.length === preloadStudio.size,
  'todo canal do Studio usa o namespace lia-forge:studio:');
const withoutHandler = studioChannels.filter((channel) => !mainHandles.has(channel));
check(withoutHandler.length === 0,
  `todo canal do Studio tem ipcMain.handle (sem resposta: ${withoutHandler.join(', ') || 'nenhum'})`);

const mainStudioHandlers = [...mainHandles].filter((channel) => channel.startsWith('lia-forge:studio:'));
const orphanHandlers = mainStudioHandlers.filter((channel) => !studioChannels.includes(channel));
check(orphanHandlers.length === 0,
  `nenhum handler do Studio ficou sem exposição no preload (órfãos: ${orphanHandlers.join(', ') || 'nenhum'})`);
check(mainStudioHandlers.length === preloadStudio.size,
  `main e preload concordam sobre a superfície do Studio (${mainStudioHandlers.length} canais)`);

// --------------------------------------- 4. guard de IPC em cada handler do Studio
const unguarded = [];
for (const channel of mainStudioHandlers) {
  const start = mainSource.indexOf(`ipcMain.handle('${channel}'`);
  const body = mainSource.slice(start, start + 900);
  if (!/assertTrustedIpcSender\(\s*event\s*\)/.test(body)) unguarded.push(channel);
}
check(unguarded.length === 0,
  `todo handler do Studio valida o emissor antes de tocar no serviço (sem guard: ${unguarded.join(', ') || 'nenhum'})`);
check(/function assertTrustedIpcSender/.test(mainSource) || /assertTrustedIpcSender\s*=/.test(mainSource),
  'o guard usado pelos handlers do Studio existe no processo principal');
check(/assertTrustedIpcEvent\(event, mainWindow, isTrustedNavigation\)/.test(mainSource),
  'o guard delega para electron/ipc-guard.cjs com a janela e a navegação confiável');

// ------------------------------------------------- 5. paridade HTTP × IPC (mesma superfície)
/**
 * Método do Studio (preload/IPC) → método do serviço que a rota HTTP equivalente
 * chama no plugin do dev-server. Os dois transportes têm que alcançar o mesmo
 * `createStudioService`: se um método só existe de um lado, o desktop e o
 * navegador são produtos diferentes.
 *
 * Exceções: `chooseProject`, `revealProject` e `pickInput` são diálogos nativos
 * (no navegador o cliente devolve `null` em vez de fingir que abriu um diálogo) e
 * `readArtifact` é servido do disco pela rota `/artifact`, sem chamada de serviço.
 */
const SERVICE_BY_METHOD = {
  overview: 'overview',
  workflows: 'workflows',
  preflight: 'preflight',
  providers: 'providers',
  configureProvider: 'configureProvider',
  projectInfo: 'projectInfo',
  listInputs: 'listInputs',
  saveInput: 'saveInput',
  readInput: 'readInput',
  compareArtifacts: 'compareArtifacts',
  plan: 'plan',
  run: 'run',
  runs: 'listRuns',
  readRun: 'readRun',
  reviewStep: 'reviewStep',
  activeRuns: 'activeRuns',
  cancelRun: 'cancelRun',
  resumeRun: 'resumeRun',
  exportRun: 'exportRun',
  vfxPreview: 'vfxPreview',
  listAssets: 'listAssets',
  upsertAsset: 'upsertAsset',
  addAssetVersion: 'addAssetVersion',
  declareAssetRights: 'declareAssetRights',
  attachRunToAsset: 'attachRunToAsset',
  rightsReport: 'rightsReport',
  readArtifact: null,
};
const DESKTOP_ONLY = ['chooseProject', 'revealProject', 'pickInput'];

const unmapped = [...preloadStudio.keys()].filter(
  (method) => !DESKTOP_ONLY.includes(method) && !(method in SERVICE_BY_METHOD),
);
check(unmapped.length === 0,
  `todo método do Studio está no contrato de paridade (sem mapeamento: ${unmapped.join(', ') || 'nenhum'})`);

const serviceCalls = new Set([...viteSource.matchAll(/service\.([A-Za-z0-9_]+)\(/g)].map((match) => match[1]));
const ipcOnly = Object.entries(SERVICE_BY_METHOD)
  .filter(([method, serviceMethod]) => serviceMethod && !DESKTOP_ONLY.includes(method) && !serviceCalls.has(serviceMethod))
  .map(([method]) => method);
check(ipcOnly.length === 0,
  `nenhum método do Studio é só do desktop: o dev-server chama o mesmo serviço (só IPC: ${ipcOnly.join(', ') || 'nenhum'})`);

const mappedServices = new Set(Object.values(SERVICE_BY_METHOD).filter(Boolean));
const httpOnly = [...serviceCalls].filter((serviceMethod) => !mappedServices.has(serviceMethod));
check(httpOnly.length === 0,
  `nenhuma rota HTTP alcança um método do serviço que o desktop não expõe (só HTTP: ${httpOnly.join(', ') || 'nenhum'})`);

for (const route of ['/overview', '/workflows', '/preflight', '/providers', '/project', '/inputs', '/input-file',
  '/compare', '/plan', '/run', '/runs', '/runs/active', '/vfx-preview', '/assets', '/rights', '/artifact']) {
  check(viteSource.includes(`route === '${route}'`), `a rota HTTP ${route} existe no plugin do dev-server`);
}
check(/\/runs\\\/\(\[A-Za-z0-9._-\]\+\)\(\?:\\\/\(review\|export\|cancel\|resume\)\)/.test(viteSource),
  'as ações por run (revisão, exportação, cancelamento, retomada) são rotas paramétricas de /runs/{id}');
check(/isInside\(runsRoot, absolute\)/.test(viteSource),
  'a rota de artefato só serve arquivos dentro de .lia-forge/runs/ (leitura confinada)');

for (const method of DESKTOP_ONLY) {
  check(preloadStudio.has(method), `"${method}" existe no preload (diálogo nativo só faz sentido no desktop)`);
  check(!serviceCalls.has(method), `"${method}" não tem equivalente HTTP (não há diálogo no navegador)`);
  const at = apiSource.indexOf(`async ${method}(`);
  check(at > 0, `o cliente do Studio expõe "${method}"`);
  const body = apiSource.slice(at, at + 400);
  check(/:\s*null;/.test(body), `"${method}" devolve null no navegador em vez de fingir um diálogo`);
}

// ------------------------------------------------------- 6. disciplina dos canais
const allChannels = [...rendererInvoke, ...rendererSend, ...rendererOn, ...mainHandles, ...mainListeners, ...mainSends];
const outsideNamespace = allChannels.filter((channel) => !channel.startsWith('lia-forge:'));
check(outsideNamespace.length === 0,
  `todo canal IPC usa o namespace do produto (fora dele: ${outsideNamespace.join(', ') || 'nenhum'})`);

const invokeWithoutHandler = [...rendererInvoke].filter((channel) => !mainHandles.has(channel));
check(invokeWithoutHandler.length === 0,
  `todo ipcRenderer.invoke tem ipcMain.handle (sem resposta: ${invokeWithoutHandler.join(', ') || 'nenhum'})`);

const sendWithoutListener = [...rendererSend].filter((channel) => !mainListeners.has(channel) && !mainHandles.has(channel));
check(sendWithoutListener.length === 0,
  `todo ipcRenderer.send tem ipcMain.on (sem ouvinte: ${sendWithoutListener.join(', ') || 'nenhum'})`);

const onWithoutSender = [...rendererOn].filter((channel) => !mainSends.has(channel));
check(onWithoutSender.length === 0,
  `todo canal que o renderer escuta é enviado pelo main (sem emissor: ${onWithoutSender.join(', ') || 'nenhum'})`);

check(!/ipcRenderer\s*[,:]/.test(studioBlock), 'o bloco do Studio não repassa ipcRenderer cru para a página');
check(!/exposeInMainWorld\([^)]*ipcRenderer/.test(preloadSource), 'o preload não expõe ipcRenderer como tal');
check((preloadSource.match(/contextBridge\.exposeInMainWorld\(/g) ?? []).length === 1,
  'existe um único ponto de exposição do bridge');
check(/removeListener/.test(preloadSource), 'a assinatura de eventos devolve como cancelar a escuta (sem vazamento)');

// --------------------------------------------------- 7. janela endurecida (Electron)
const webPreferences = mainSource.slice(mainSource.indexOf('webPreferences: {'), mainSource.indexOf('webPreferences: {') + 400);
check(/contextIsolation:\s*true/.test(webPreferences), 'contextIsolation ligado');
check(/nodeIntegration:\s*false/.test(webPreferences), 'nodeIntegration desligado');
check(/sandbox:\s*true/.test(webPreferences), 'sandbox ligado');
check(/webSecurity:\s*true/.test(webPreferences), 'webSecurity ligado');
check(/preload:\s*path\.join\(APP_ROOT, 'electron', 'preload\.cjs'\)/.test(webPreferences), 'o preload usado é o do repositório');
check(/setWindowOpenHandler\(\(\)\s*=>\s*\(\{\s*action:\s*'deny'/.test(mainSource), 'abrir janela nova é negado');
check(/will-navigate', blockUntrustedNavigation/.test(mainSource) && /will-redirect', blockUntrustedNavigation/.test(mainSource),
  'navegação e redirecionamento passam pelo bloqueio de origem não confiável');

console.log(`IPC coherence smoke test passed (Studio ↔ preload ↔ main: ${checks.length} checagens · ${preloadStudio.size} métodos do Studio · ${mainStudioHandlers.length} canais com handler e guard · ${calledByClient.length} métodos chamados pelo cliente · paridade HTTP com ${DESKTOP_ONLY.length} exceções desktop-only).`);
