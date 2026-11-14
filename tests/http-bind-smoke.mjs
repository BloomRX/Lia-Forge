/**
 * Smoke do bind HTTP efetivo (auditoria P0, item 1 — R-01/R-02).
 *
 * O que este arquivo prova, e o que não prova
 * -------------------------------------------
 * Prova: que o comando publicado em `package.json` (`npm run dev`) sobe um
 * processo Vite de verdade que **só aceita conexão em loopback**, medido com
 * socket cru em cada endereço não-loopback da máquina; que a exposição de rede só
 * acontece por opt-in nomeado (`LIA_FORGE_HTTP_EXPOSE=1` ou `npm run
 * dev:expose`), e que nesse caso o servidor realmente atende fora do loopback —
 * ou seja, o padrão seguro não foi obtido quebrando o opt-in.
 *
 * Não prova: segurança de produção. Um bind em loopback não substitui token,
 * política de host/Origin nem o teste no alvo (Windows/app empacotado); nada aqui
 * mede firewall, proxy reverso ou outra interface que o ambiente não tenha.
 *
 * Reprodução do problema que motivou a correção (medida antes, neste checkout):
 *   `package.json` tinha `"dev": "vite --host 0.0.0.0"`. A flag `--host` da CLI do
 *   Vite **sobrescreve** `server.host` do `vite.config.js`, então o bind em
 *   loopback definido por `resolveBindHost()` não valia para quem rodasse o
 *   comando publicado:
 *     vite --host 0.0.0.0  → 127.0.0.1 CONECTOU · <endereço da máquina> CONECTOU
 *                            (Vite imprimia "Network: http://<endereço>:porta/")
 *     vite                 → 127.0.0.1 CONECTOU · <endereço da máquina> ECONNREFUSED
 *   O mesmo valia para `vite preview --host 0.0.0.0` e para
 *   `spriteforge_open_panel`, que spawnava `npm run dev -- --host 0.0.0.0 …`.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveBindHost } from '../shared/http/api-policy.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const results = [];
let failures = 0;

function check(label, assertion) {
  const ok = assertion === true;
  if (!ok) failures += 1;
  results.push(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — obtido: ${JSON.stringify(assertion)}`}`);
}

/** Endereços IPv4 desta máquina que não são loopback. */
const externalAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((entry) => entry && entry.family === 'IPv4' && !entry.address.startsWith('127.'))
  .map((entry) => entry.address);

/** Conecta de verdade (socket cru) e diz o que aconteceu. */
function probe(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (outcome) => { socket.destroy(); resolve(outcome); };
    socket.setTimeout(3000);
    socket.once('connect', () => done('connected'));
    socket.once('timeout', () => done('timeout'));
    socket.once('error', (error) => done(`refused:${error.code ?? error.message}`));
  });
}

/**
 * Sobe o Vite exatamente como o script npm pedido e devolve o que foi medido.
 *
 * @param {string[]} args argumentos do script (os do `package.json`, sem `vite`)
 * @param {NodeJS.ProcessEnv} [extraEnv]
 */
async function measure(args, extraEnv = {}) {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-bind-'));
  const port = 5340 + Math.floor(Math.random() * 400);
  const child = spawn(process.execPath, [viteBin, ...args, '--port', String(port), '--strictPort'], {
    cwd: repositoryRoot,
    env: { ...process.env, ...extraEnv, SPRITEFORGE_PROJECT_ROOT: projectRoot },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (chunk) => { log += String(chunk); });
  child.stderr.on('data', (chunk) => { log += String(chunk); });
  let up = false;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.status < 500) { up = true; break; }
    } catch { /* ainda subindo */ }
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const measured = {
    up,
    log,
    port,
    loopback: up ? await probe('127.0.0.1', port) : 'server-did-not-start',
    external: up
      ? Object.fromEntries(await Promise.all(externalAddresses.map(async (address) => [address, await probe(address, port)])))
      : {},
    networkUrl: /Network:\s+(\S+)/.exec(log)?.[1] ?? null,
  };
  child.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!child.killed) child.kill('SIGKILL');
  await fs.rm(projectRoot, { recursive: true, force: true });
  return measured;
}

// ------------------------------------------------------------------ política pura
{
  const standard = resolveBindHost({});
  check('sem opt-in o bind é loopback', standard.host === '127.0.0.1');
  check('e não se declara exposto', standard.exposed === false);
  check('e o motivo nomeia como expor', /LIA_FORGE_HTTP_EXPOSE=1/.test(standard.reason) && /dev:expose/.test(standard.reason));

  const byEnv = resolveBindHost({ LIA_FORGE_HTTP_EXPOSE: '1' });
  check('LIA_FORGE_HTTP_EXPOSE=1 expõe', byEnv.exposed === true && byEnv.host === '0.0.0.0');
  check('e o motivo diz que foi explícito', /Exposição explícita/.test(byEnv.reason));

  const byEnvHost = resolveBindHost({ LIA_FORGE_HTTP_EXPOSE: '1', LIA_FORGE_HTTP_HOST: '10.0.0.5' });
  check('LIA_FORGE_HTTP_HOST escolhe a interface', byEnvHost.host === '10.0.0.5');

  const byMode = resolveBindHost({}, { mode: 'expose' });
  check('o modo "expose" do Vite é opt-in de exposição (portável no Windows)', byMode.exposed === true);
  check('e o motivo nomeia o modo', /modo "expose"/.test(byMode.reason));

  check('mode de desenvolvimento normal não expõe', resolveBindHost({}, { mode: 'development' }).exposed === false);
  check('mode de produção não expõe', resolveBindHost({}, { mode: 'production' }).exposed === false);
  check('expor por env vale em qualquer modo', resolveBindHost({ LIA_FORGE_HTTP_EXPOSE: 'true' }, { mode: 'production' }).exposed === true);
  check('sem env e sem modo, LIA_FORGE_HTTP_HOST sozinho NÃO expõe',
    resolveBindHost({ LIA_FORGE_HTTP_HOST: '0.0.0.0' }).exposed === false);
}

// ----------------------------------------------------- comando publicado no package.json
const pkg = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
const scripts = pkg.scripts ?? {};
const devArgs = String(scripts.dev ?? '').replace(/^vite\s*/, '').split(/\s+/).filter(Boolean);
const exposeArgs = String(scripts['dev:expose'] ?? '').replace(/^vite\s*/, '').split(/\s+/).filter(Boolean);

check('existe o script dev', typeof scripts.dev === 'string' && scripts.dev.length > 0);
check('o script dev não passa --host (a flag da CLI sobrescreve server.host)', !devArgs.includes('--host'));
check('e não passa nenhum endereço de bind', !devArgs.some((arg) => arg === '0.0.0.0'));
check('o script preview não passa --host', !String(scripts.preview ?? '').includes('--host'));
check('o script preview não passa 0.0.0.0', !String(scripts.preview ?? '').includes('0.0.0.0'));
check('existe opt-in nomeado para expor o dev', typeof scripts['dev:expose'] === 'string' && /--mode expose/.test(scripts['dev:expose']));
check('e opt-in nomeado para expor o preview', typeof scripts['preview:expose'] === 'string' && /--mode expose/.test(scripts['preview:expose']));

// O MCP sobe o mesmo dev-server: não pode reintroduzir a flag.
const mcpSource = await fs.readFile(path.join(repositoryRoot, 'scripts', 'spriteforge-mcp.mjs'), 'utf8');
const openPanelSpawn = /spawn\(npm, \[[^\]]*\]/.exec(mcpSource)?.[0] ?? '';
check('spriteforge_open_panel spawnava npm run dev (achado no fonte)', /run', 'dev/.test(openPanelSpawn));
check('e não passa mais --host 0.0.0.0 (verificação de fonte, não de execução)',
  !/'--host'/.test(openPanelSpawn) && !/0\.0\.0\.0/.test(openPanelSpawn));

// ------------------------------------------------- comportamento efetivo (socket cru)
const standardRun = await measure(devArgs);
check(`o servidor do script dev sobe (args: ${JSON.stringify(devArgs)})`, standardRun.up === true);
check('atende em loopback', standardRun.loopback === 'connected');
if (externalAddresses.length === 0) {
  results.push('ok   nenhuma interface não-loopback neste ambiente: a recusa fora do loopback não pôde ser medida aqui (o bind continua 127.0.0.1 no config)');
} else {
  for (const address of externalAddresses) {
    check(`recusa conexão em ${address} (endereço não-loopback da máquina)`,
      String(standardRun.external[address]).startsWith('refused'));
  }
}
check('o Vite não anuncia URL de rede', standardRun.networkUrl === null);
check('e não registra exposição no log', !/Exposição explícita/.test(standardRun.log));

const exposedRun = await measure(devArgs, { LIA_FORGE_HTTP_EXPOSE: '1' });
check('com LIA_FORGE_HTTP_EXPOSE=1 o servidor sobe', exposedRun.up === true);
if (externalAddresses.length > 0) {
  check('e aí sim atende fora do loopback (o opt-in não está quebrado)',
    Object.values(exposedRun.external).some((outcome) => outcome === 'connected'));
  check('e o Vite anuncia a URL de rede', typeof exposedRun.networkUrl === 'string');
}
check('e registra por escrito que a exposição foi explícita', /Exposição explícita/.test(exposedRun.log));

const modeRun = await measure(exposeArgs);
check(`com o script dev:expose o servidor sobe (args: ${JSON.stringify(exposeArgs)})`, modeRun.up === true);
if (externalAddresses.length > 0) {
  check('e o modo expose atende fora do loopback (caminho portável, sem env no script)',
    Object.values(modeRun.external).some((outcome) => outcome === 'connected'));
}
check('e também registra o motivo', /Exposição explícita/.test(modeRun.log));

console.log(results.join('\n'));
console.log(`\nhttp-bind-smoke: ${failures ? `FAIL (${failures} de ${results.length})` : `${results.length} checagens, passou`}`);
if (failures) console.log(`--- interfaces medidas: ${externalAddresses.join(', ') || '(nenhuma)'} ---`);
process.exit(failures ? 1 : 0);
