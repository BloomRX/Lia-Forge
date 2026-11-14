/**
 * Smoke da política de segurança da API HTTP (P0-1 da revisão integrada).
 *
 * O que este arquivo prova, e o que não prova
 * -------------------------------------------
 * Prova: as **decisões** da política (host, origem, token, operação
 * privilegiada, rota mutável) para requisições reais, positivas e negativas, e
 * que o servidor de desenvolvimento as aplica — sobe um processo Vite de
 * verdade e ataca as rotas com `fetch`.
 *
 * Não prova: segurança do sistema real em produção. O app empacotado (Electron)
 * usa IPC, não HTTP; nada aqui substitui o teste no alvo, e um teste com
 * servidor de desenvolvimento não é validação de segurança do produto
 * instalado. Também não prova ausência de outros vetores ( XSS, prototype
 * pollution, dependências). Ver `docs/INTEGRATED-RESEARCH-AND-ARCHITECTURE-REVIEW-2026-11-14.md` §11.
 *
 * Reprodução do problema que motivou a correção (medida antes, em
 * `vite.config.js` anterior a este commit):
 *   POST /api/lia-forge/studio/providers  sem Origin → 200, gravou
 *        `executable: /tmp/blender-falso` em `.lia-forge/providers.json`;
 *   POST /api/lia-forge/studio/run        sem Origin → 200, iniciou um run;
 *   GET  /api/lia-forge/studio/overview   com `Host: attacker.example` → 200;
 *   com o provider em modo `path`, o binário gravado **executou** (o arquivo
 *   marcador que ele cria apareceu).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_ALLOWED_HOSTS,
  IPC_ONLY_OPERATIONS,
  MUTABLE_ROUTES,
  TOKEN_HEADER,
  TOKEN_MODULE_ROUTE,
  createHttpApiPolicy,
  resolveBindHost,
  viteAllowedHosts,
} from '../shared/http/api-policy.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let failures = 0;

function check(label, assertion) {
  const ok = assertion === true;
  if (!ok) failures += 1;
  results.push(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — obtido: ${JSON.stringify(assertion)}`}`);
}

// ------------------------------------------------------------------ política pura
{
  const policy = createHttpApiPolicy({ token: 'x'.repeat(48) });

  check('token da política tem o valor fornecido', policy.token === 'x'.repeat(48));
  check('lista de hosts padrão é a fechada', JSON.stringify(policy.allowedHosts) === JSON.stringify(DEFAULT_ALLOWED_HOSTS));
  check('allowedHosts do Vite nunca é `true`', Array.isArray(viteAllowedHosts(policy)) && viteAllowedHosts(policy).includes('localhost'));

  // host
  check('host localhost permitido', policy.isHostAllowed('localhost:5173') === true);
  check('host 127.0.0.1 permitido', policy.isHostAllowed('127.0.0.1:5173') === true);
  check('host IPv6 permitido', policy.isHostAllowed('[::1]:5173') === true);
  check('host de preview permitido', policy.isHostAllowed('5173-abc123.e2b.app') === true);
  check('host arbitrário recusado (DNS rebinding)', policy.isHostAllowed('attacker.example') === false);
  check('host ausente recusado', policy.isHostAllowed(null) === false);
  check('sufixo parecido com o permitido é recusado', policy.isHostAllowed('naoe2b.app') === false);
  check('subdomínio malicioso do sufixo permitido é recusado', policy.isHostAllowed('evil.e2b.app.attacker.example') === false);

  // origem
  check('Origin mesma origem aceito', policy.isOriginAllowed('http://localhost:5173', 'localhost:5173') === true);
  check('Origin ausente recusado', policy.isOriginAllowed(null, 'localhost:5173') === false);
  check('Origin de outro site recusado', policy.isOriginAllowed('https://evil.example', 'localhost:5173') === false);
  check('Origin com host permitido mas diferente do pedido é recusado', policy.isOriginAllowed('http://127.0.0.1:5173', 'localhost:5173') === false);
  check('Origin inválido recusado', policy.isOriginAllowed('não é url', 'localhost:5173') === false);
  check('Origin de esquema não http recusado', policy.isOriginAllowed('file:///tmp', 'localhost:5173') === false);
  check('x-forwarded-host do preview é aceito como host do pedido', policy.classify({
    method: 'GET', route: '/overview', origin: null, host: '127.0.0.1:5173', forwardedHost: '5173-abc.e2b.app',
  }).allow === true);

  // classificação: leitura × mutação × privilégio
  check('GET de leitura sem Origin é permitido', policy.classify({ method: 'GET', route: '/overview', host: 'localhost:5173' }).allow === true);
  check('POST mutável sem Origin é recusado com 403', (() => {
    const decision = policy.classify({ method: 'POST', route: '/run', host: 'localhost:5173', origin: null });
    return decision.allow === false && decision.status === 403 && decision.code === 'ORIGIN_REQUIRED';
  })());
  check('POST mutável com Origin e sem token é recusado com 401', (() => {
    const decision = policy.classify({ method: 'POST', route: '/run', host: 'localhost:5173', origin: 'http://localhost:5173' });
    return decision.allow === false && decision.status === 401 && decision.code === 'TOKEN_REQUIRED';
  })());
  check('POST mutável com Origin e token válido é permitido', policy.classify({
    method: 'POST', route: '/run', host: 'localhost:5173', origin: 'http://localhost:5173', token: 'x'.repeat(48),
  }).allow === true);
  check('token de tamanho diferente é recusado (comparação constante)', policy.classify({
    method: 'POST', route: '/run', host: 'localhost:5173', origin: 'http://localhost:5173', token: 'x'.repeat(47),
  }).allow === false);
  check('POST /providers é recusado mesmo com token válido', (() => {
    const decision = policy.classify({
      method: 'POST', route: '/providers', host: 'localhost:5173', origin: 'http://localhost:5173', token: 'x'.repeat(48),
    });
    return decision.allow === false && decision.status === 403 && decision.code === 'IPC_ONLY_OPERATION';
  })());
  check('POST /runs/:id/review é recusado mesmo com token válido', policy.classify({
    method: 'POST', route: '/runs/run-1/review', host: 'localhost:5173', origin: 'http://localhost:5173', token: 'x'.repeat(48),
  }).code === 'IPC_ONLY_OPERATION');
  check('GET /providers continua permitido (leitura do estado)', policy.classify({
    method: 'GET', route: '/providers', host: 'localhost:5173',
  }).allow === true);
  check('host não permitido vence qualquer credencial', (() => {
    const decision = policy.classify({
      method: 'GET', route: '/overview', host: 'attacker.example', origin: 'http://attacker.example', token: 'x'.repeat(48),
    });
    return decision.allow === false && decision.status === 421 && decision.code === 'HOST_NOT_ALLOWED';
  })());
  check('POST em rota não listada é recusado por padrão (fail-closed)', policy.classify({
    method: 'POST', route: '/rota-nova-qualquer', host: 'localhost:5173', origin: 'http://localhost:5173', token: 'x'.repeat(48),
  }).allow === false);
  check('toda rota mutável declarada tem método explícito', MUTABLE_ROUTES.every((entry) => typeof entry.method === 'string' && typeof entry.match === 'function'));
  check('as três operações privilegiadas estão declaradas', IPC_ONLY_OPERATIONS.map((entry) => entry.id).join(',') === 'provider-configuration,provider-authorization,human-review');

  // módulo de token
  const source = policy.tokenModuleSource();
  check('módulo de token exporta o token da sessão', source.includes('export const sessionToken') && source.includes('x'.repeat(48)));
  check('módulo de token informa o header', source.includes(TOKEN_HEADER));

  // assinatura
  check('assinatura é determinística e diferente para payloads diferentes', policy.sign('a') === policy.sign('a') && policy.sign('a') !== policy.sign('b'));
}

// ------------------------------------------------------------------ bind
{
  check('bind padrão é loopback', (() => {
    const bind = resolveBindHost({});
    return bind.host === '127.0.0.1' && bind.exposed === false && /loopback/i.test(bind.reason);
  })());
  check('expor na rede exige variável explícita', (() => {
    const bind = resolveBindHost({ LIA_FORGE_HTTP_EXPOSE: '1' });
    return bind.exposed === true && bind.host === '0.0.0.0';
  })());
  check('host de exposição explícito é respeitado', resolveBindHost({ LIA_FORGE_HTTP_EXPOSE: 'true', LIA_FORGE_HTTP_HOST: '10.0.0.5' }).host === '10.0.0.5');
  check('valor irrelevante não expõe', resolveBindHost({ LIA_FORGE_HTTP_EXPOSE: 'talvez' }).exposed === false);
}

// ------------------------------------------------------------------ servidor real
async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { headers: { Origin: 'http://127.0.0.1:5199' } });
      if (response.status < 500) return response.status;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`servidor não respondeu em ${timeoutMs} ms: ${lastError?.message ?? 'sem detalhe'}`);
}

const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-http-policy-'));
const port = 5199;
const origin = `http://127.0.0.1:${port}`;
const api = `${origin}/api/lia-forge/studio`;

const child = spawn(process.execPath, [
  path.join(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
  '--host', '127.0.0.1', '--port', String(port), '--strictPort',
], {
  cwd: repositoryRoot,
  env: { ...process.env, SPRITEFORGE_PROJECT_ROOT: projectRoot },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
child.stdout.on('data', (chunk) => { serverLog += String(chunk); });
child.stderr.on('data', (chunk) => { serverLog += String(chunk); });

try {
  await waitForServer(`${api}/overview`);

  // O token é entregue pelo servidor à página da mesma origem.
  const tokenResponse = await fetch(`${origin}${TOKEN_MODULE_ROUTE}`, { headers: { 'sec-fetch-site': 'same-origin' } });
  const tokenSource = await tokenResponse.text();
  const token = /export const sessionToken = "([^"]+)"/.exec(tokenSource)?.[1] ?? null;
  check('servidor entrega o token da sessão como módulo', tokenResponse.status === 200 && typeof token === 'string' && token.length >= 32);
  check('módulo de token não é cacheável', String(tokenResponse.headers.get('cache-control')).includes('no-store'));
  check('módulo de token é recusado para outro site', (await fetch(`${origin}${TOKEN_MODULE_ROUTE}`, { headers: { 'sec-fetch-site': 'cross-site' } })).status === 403);

  const authed = { 'content-type': 'application/json', origin, [TOKEN_HEADER]: token };

  // --- reprodução das falhas originais: agora recusadas
  const providersWithoutOrigin = await fetch(`${api}/providers`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'blender', executable: '/tmp/blender-falso', enabled: true }),
  });
  check('POST /providers sem Origin é recusado (antes: 200)', providersWithoutOrigin.status === 403);

  const providersWithToken = await fetch(`${api}/providers`, {
    method: 'POST', headers: authed, body: JSON.stringify({ id: 'blender', executable: '/tmp/blender-falso' }),
  });
  const providersBody = await providersWithToken.json();
  check('POST /providers é exclusivo do IPC mesmo com Origin e token (antes: 200)', providersWithToken.status === 403
    && providersBody.code === 'IPC_ONLY_OPERATION' && /app desktop/i.test(providersBody.error));

  const providersFile = await fs.readFile(path.join(projectRoot, '.lia-forge', 'providers.json'), 'utf8').catch(() => null);
  check('nenhum executável foi gravado no projeto', providersFile === null || !providersFile.includes('blender-falso'));

  const reviewWithoutOrigin = await fetch(`${api}/runs/run-inexistente/review`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stepId: 's', approved: true }),
  });
  check('POST /runs/:id/review é exclusivo do IPC (antes: chegava ao serviço)', reviewWithoutOrigin.status === 403
    && (await reviewWithoutOrigin.json()).code === 'IPC_ONLY_OPERATION');

  const runWithoutOrigin = await fetch(`${api}/run`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workflowId: '2d-character-parts' }),
  });
  check('POST /run sem Origin é recusado (antes: 200 e executava)', runWithoutOrigin.status === 403);

  const runWithoutToken = await fetch(`${api}/run`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ workflowId: '2d-character-parts' }),
  });
  check('POST /run com Origin mas sem token é recusado com 401', runWithoutToken.status === 401
    && (await runWithoutToken.json()).code === 'TOKEN_REQUIRED');

  const runEvilOrigin = await fetch(`${api}/run`, {
    method: 'POST', headers: { ...authed, origin: 'https://evil.example' }, body: JSON.stringify({ workflowId: '2d-character-parts' }),
  });
  check('POST /run com Origin de outro site é recusado mesmo com token', runEvilOrigin.status === 403);

  const runWrongToken = await fetch(`${api}/run`, {
    method: 'POST', headers: { ...authed, [TOKEN_HEADER]: `${token.slice(0, -2)}zz` }, body: JSON.stringify({ workflowId: '2d-character-parts' }),
  });
  check('POST /run com token errado é recusado', runWrongToken.status === 401);

  // --- host fechado (DNS rebinding)
  // `fetch` do Node (undici) não permite sobrescrever `Host`, então a prova é por
  // socket cru: uma requisição HTTP/1.1 escrita à mão com `Host: attacker.example`
  // contra o mesmo servidor. Se a lista de hosts não valesse, o Vite responderia.
  const rawRequest = (hostHeader) => new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(`GET /api/lia-forge/studio/overview HTTP/1.1\r\nHost: ${hostHeader}\r\nConnection: close\r\n\r\n`);
    });
    let body = '';
    socket.on('data', (chunk) => { body += String(chunk); });
    socket.on('end', () => resolve(body));
    socket.on('error', reject);
    setTimeout(() => { socket.destroy(); resolve(body); }, 4000);
  });
  const rebindingResponse = await rawRequest('attacker.example');
  const rebindingStatus = Number(/^HTTP\/1\.1 (\d{3})/.exec(rebindingResponse)?.[1] ?? 0);
  check('Host fora da lista é recusado pelo servidor (DNS rebinding)', [403, 421].includes(rebindingStatus));
  check('a recusa por Host não entrega dados do projeto', !rebindingResponse.includes('schemaVersion'));
  const allowedResponse = await rawRequest('127.0.0.1:5199');
  check('Host permitido continua sendo atendido', Number(/^HTTP\/1\.1 (\d{3})/.exec(allowedResponse)?.[1] ?? 0) === 200);

  // --- o que continua funcionando (fluxos legítimos)
  const overview = await fetch(`${api}/overview`, { headers: { origin } });
  check('GET /overview continua funcionando para a mesma origem', overview.status === 200 && (await overview.json()).schemaVersion === 1);

  const plan = await fetch(`${api}/plan`, {
    method: 'POST', headers: authed, body: JSON.stringify({ workflowId: '2d-character-parts' }),
  });
  check('POST /plan com Origin e token continua funcionando', plan.status === 200 && Array.isArray((await plan.json()).plan?.steps));

  // PNG 1×1 válido: `saveInput` verifica o conteúdo da imagem, e um PNG truncado
  // seria recusado pelo serviço (não pela política), o que mascararia o teste.
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4'
    + '890000000a49444154789c6300010000050001'
    + '0d0a2db40000000049454e44ae426082',
    'hex',
  );
  const upload = await fetch(`${api}/inputs`, {
    method: 'POST', headers: authed, body: JSON.stringify({ filename: 'prova.png', base64: png.toString('base64') }),
  });
  const uploadBody = await upload.json().catch(() => ({}));
  check('POST /inputs com Origin e token continua funcionando', upload.status === 200 && uploadBody.name === 'prova.png');

  const uploadNoToken = await fetch(`${api}/inputs`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ filename: 'prova2.png', base64: png.toString('base64') }),
  });
  check('POST /inputs sem token é recusado antes de chegar ao serviço', uploadNoToken.status === 401);

  const runs = await fetch(`${api}/runs`, { headers: { origin } });
  check('GET /runs (leitura) continua funcionando', runs.status === 200 && Array.isArray((await runs.json()).runs));

  const storeGet = await fetch(`${origin}/api/spriteforge/assets`, { headers: { origin } });
  check('GET do store legado continua funcionando', storeGet.status === 200);

  const storePutNoToken = await fetch(`${origin}/api/spriteforge/assets`, {
    method: 'PUT', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ assets: [] }),
  });
  const storePutNoTokenBody = await storePutNoToken.json().catch(() => ({}));
  check('PUT do store legado sem token é recusado', storePutNoToken.status === 401
    && storePutNoTokenBody.code === 'TOKEN_REQUIRED');

  const storePutNoOrigin = await fetch(`${origin}/api/spriteforge/assets`, {
    method: 'PUT', headers: { 'content-type': 'application/json', [TOKEN_HEADER]: token }, body: JSON.stringify({ assets: [] }),
  });
  check('PUT do store legado sem Origin é recusado', storePutNoOrigin.status === 403);

  // Leitura do store legado sem Origin continua permitida: é o que o MCP usa para
  // conferir se o painel que subiu é o do projeto certo (`checkPanel`). O browser
  // sempre envia Origin em fetch same-origin, então exigir Origin aqui só
  // quebraria ferramenta local sem ganho de segurança — o que mudou foi a escrita.
  const storeGetNoOrigin = await fetch(`${origin}/api/spriteforge/assets`);
  check('GET do store legado sem Origin continua funcionando (consumidor local)', storeGetNoOrigin.status === 200);

  const storeGetEvilOrigin = await fetch(`${origin}/api/spriteforge/assets`, { headers: { origin: 'https://evil.example' } });
  check('GET do store legado com Origin de outro site é recusado', storeGetEvilOrigin.status === 403);

  const storePutNoHost = await fetch(`${api}/runs`, { headers: { origin } });
  check('leitura da API do Studio com host permitido funciona', storePutNoHost.status === 200);

  const storePut = await fetch(`${origin}/api/spriteforge/assets`, {
    method: 'PUT', headers: { 'content-type': 'application/json', origin, [TOKEN_HEADER]: token }, body: JSON.stringify({ assets: [] }),
  });
  check('PUT do store legado com token continua funcionando', storePut.status === 200);

  const comfy = await fetch(`${origin}/api/lia-forge/comfyui/status`, { headers: { origin } });
  check('leitura do ComfyUI continua funcionando', comfy.status === 200);

  const comfyNoOrigin = await fetch(`${origin}/api/lia-forge/comfyui/status`);
  check('leitura do ComfyUI sem Origin passa (é leitura local)', comfyNoOrigin.status === 200);

  const artifactTraversal = await fetch(`${api}/artifact?path=${encodeURIComponent('../../../etc/passwd')}`, { headers: { origin } });
  check('traversal de artefato continua recusado', artifactTraversal.status === 403);
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!child.killed) child.kill('SIGKILL');
  await fs.rm(projectRoot, { recursive: true, force: true });
}

console.log(results.join('\n'));
console.log(`\nhttp-api-policy-smoke: ${failures ? `FAIL (${failures} de ${results.length})` : `${results.length} checagens, passou`}`);
if (serverLog.includes('error')) console.log('--- trecho do log do servidor ---\n' + serverLog.slice(-600));
process.exit(failures ? 1 : 0);
