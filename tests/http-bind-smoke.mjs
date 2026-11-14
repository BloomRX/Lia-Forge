/**
 * Smoke do bind HTTP efetivo (auditoria P0, item 1 — R-01/R-02).
 *
 * O que este arquivo prova
 * ------------------------
 * Que o comando publicado em `package.json` (`npm run dev`) sobe um processo Vite
 * de verdade cujo **socket LISTEN fica em loopback**, medido no kernel
 * (`/proc/net/tcp` e `/proc/net/tcp6`, estado `0A` = LISTEN, endereço local da
 * porta do processo); e que a exposição de rede só acontece por opt-in nomeado
 * (`LIA_FORGE_HTTP_EXPOSE=1` ou `npm run dev:expose`), caso em que o mesmo socket
 * passa a ouvir em `0.0.0.0` — ou seja, o padrão seguro não foi obtido quebrando o
 * opt-in. Também confere que nenhum script npm e nem o `spriteforge_open_panel` do
 * MCP volta a passar `--host`.
 *
 * Por que medir o socket, e não só "conectar de fora"
 * ---------------------------------------------------
 * A primeira versão deste teste concluía a exposição tentando conectar num
 * endereço não-loopback da máquina. Nesta estação isso **não é evidência**: o
 * sandbox encaminha tráfego do endereço link-local para listeners em loopback.
 * Medido (8 levantamentos com o servidor em `127.0.0.1`, sem URL "Network" no log
 * do Vite):
 *
 *   #0 porta=46539 ext=169.254.0.21:connected   ← serviu o index.html do projeto
 *   #1 porta=37241 ext=169.254.0.21:refused:ECONNREFUSED
 *   #2 porta=38741 ext=169.254.0.21:connected
 *   #3 porta=43023 ext=169.254.0.21:connected
 *   #4..#7 refused
 *
 * Com o bind lido no kernel, o mesmo par de cenários é inequívoco:
 *
 *   padrão (script dev)                → LISTEN local = 127.0.0.1
 *   LIA_FORGE_HTTP_EXPOSE=1            → LISTEN local = 0.0.0.0 + "Network: …" no log
 *
 * O probe externo continua sendo feito, mas como evidência secundária: quando ele
 * conecta enquanto o kernel diz loopback, o teste registra o encaminhamento do
 * ambiente em vez de fingir que mediu exposição.
 *
 * Reprodução do problema que motivou a correção (medida antes, neste checkout,
 * com o mesmo harness na versão de probe):
 *   `package.json` tinha `"dev": "vite --host 0.0.0.0"`. A flag `--host` da CLI do
 *   Vite **sobrescreve** `server.host` do `vite.config.js`, então o bind em
 *   loopback definido por `resolveBindHost()` não valia para quem rodasse o
 *   comando publicado:
 *     vite --host 0.0.0.0 → 127.0.0.1 CONECTOU; 169.254.0.21 CONECTOU
 *                           (Vite imprimia "Network: http://169.254.0.21:5357/")
 *     vite               → 127.0.0.1 CONECTOU; 169.254.0.21 ECONNREFUSED
 *   O mesmo valia para `vite preview --host 0.0.0.0` e para
 *   `spriteforge_open_panel`, que spawnava `npm run dev -- --host 0.0.0.0 …`.
 *
 * O que NÃO prova: bind em loopback não é segurança de produção — não substitui
 * token de sessão, política de host/Origin nem verificação no alvo (Windows/app
 * empacotado, onde `/proc` não existe e este teste reporta a medição como não
 * executada em vez de fingir ok). Nada aqui mede firewall, proxy reverso ou
 * NAT da estação.
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

function note(label) {
  results.push(`··   ${label}`);
}

/** Endereços IPv4 desta máquina que não são loopback (para o probe secundário). */
const externalAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((entry) => entry && entry.family === 'IPv4' && !entry.address.startsWith('127.'))
  .map((entry) => entry.address);

// ---------------------------------------------------- leitura do bind no kernel
function hexToIpv4(hex) {
  return [6, 4, 2, 0].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join('.');
}

/**
 * Classifica o endereço local de um socket LISTEN lido de `/proc/net/tcp{,6}`.
 * `loopback` = só a máquina; `any` = 0.0.0.0/:: (todas as interfaces);
 * `interface` = um endereço específico não-loopback.
 */
function classifyListening(raw, family) {
  const value = raw.toLowerCase();
  if (family === 4) {
    if (value === '0100007f') return { kind: 'loopback', address: '127.0.0.1' };
    if (value === '00000000') return { kind: 'any', address: '0.0.0.0' };
    return { kind: 'interface', address: hexToIpv4(value) };
  }
  if (/^0{31}1$/.test(value)) return { kind: 'loopback', address: '::1' };
  if (/^0{32}$/.test(value)) return { kind: 'any', address: '::' };
  if (/^0{24}ffff0100007f$/.test(value)) return { kind: 'loopback', address: '::ffff:127.0.0.1' };
  if (/^0{24}ffff00000000$/.test(value)) return { kind: 'any', address: '::ffff:0.0.0.0' };
  return { kind: 'interface', address: `ipv6:${value}` };
}

/** Inodes de socket abertos pelo processo (via `/proc/<pid>/fd`). `null` se ilegível. */
async function socketInodesOf(pid) {
  const directory = `/proc/${pid}/fd`;
  const entries = await fs.readdir(directory).catch(() => null);
  if (!entries) return null;
  const inodes = new Set();
  for (const entry of entries) {
    const link = await fs.readlink(path.join(directory, entry)).catch(() => null);
    const match = /^socket:\[(\d+)\]$/.exec(link ?? '');
    if (match) inodes.add(match[1]);
  }
  return inodes;
}

/**
 * Sockets em estado LISTEN na porta informada, lidos do kernel e **atribuídos ao
 * processo medido** pelo inode do socket em `/proc/<pid>/fd`.
 *
 * A atribuição importa: neste ambiente já foi observado outro processo escutando a
 * mesma porta na interface externa (encaminhamento do sandbox). Sem atribuir por
 * PID, o teste leria o socket do proxy como se fosse do Vite — para mais ou para
 * menos. `foreign` guarda exatamente esses sockets de terceiros, para diagnóstico.
 *
 * Devolve `null` quando a plataforma não expõe `/proc/net/tcp` ou o `/proc/<pid>/fd`
 * não é legível (Windows/macOS): o teste então diz que a medição não foi executada,
 * em vez de assumir resultado.
 */
async function listeningFor(pid, port) {
  const inodes = await socketInodesOf(pid);
  if (!inodes) return null;
  const owned = [];
  const foreign = [];
  for (const [file, family] of [['/proc/net/tcp', 4], ['/proc/net/tcp6', 6]]) {
    const text = await fs.readFile(file, 'utf8').catch(() => null);
    if (text === null) return null;
    for (const line of text.split('\n').slice(1)) {
      const columns = line.trim().split(/\s+/);
      if (columns.length < 10 || columns[3] !== '0A') continue; // 0A = TCP_LISTEN
      const [rawAddress, rawPort] = columns[1].split(':');
      if (parseInt(rawPort, 16) !== port) continue;
      const entry = { ...classifyListening(rawAddress, family), inode: columns[9] };
      (inodes.has(entry.inode) ? owned : foreign).push(entry);
    }
  }
  return { owned, foreign };
}

/** Conecta de verdade (socket cru) — evidência secundária. */
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

/** Pede uma porta livre ao SO e confere que ninguém já a atende. */
async function pickUsablePort() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const port = await new Promise((resolve, reject) => {
      const listener = net.createServer();
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', () => {
        const assigned = listener.address().port;
        listener.close(() => resolve(assigned));
      });
    });
    const busy = (await probe('127.0.0.1', port)) === 'connected';
    if (!busy) return port;
  }
  throw new Error('não foi possível obter uma porta livre para medir o bind');
}

/**
 * Sobe o Vite exatamente como o script npm pedido e devolve o que foi medido.
 * Duas tentativas: dentro da cadeia `npm test` outros smokes também sobem
 * servidores, e com `--strictPort` uma porta tomada derruba o Vite na hora.
 */
async function measure(args, extraEnv = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const measured = await measureOnce(args, extraEnv);
    if (measured.up || attempt === 1) return measured;
  }
  return measureOnce(args, extraEnv);
}

async function measureOnce(args, extraEnv = {}) {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-bind-'));
  const port = await pickUsablePort();
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
    port,
    log,
    logTail: log.slice(-300).replace(/\s+/g, ' '),
    exitCode: child.exitCode,
    listening: up ? await listeningFor(child.pid, port) : null,
    loopback: up ? await probe('127.0.0.1', port) : 'server-did-not-start',
    external: up
      ? Object.fromEntries(await Promise.all(externalAddresses.map(async (address) => [address, await probe(address, port)])))
      : {},
    networkUrl: /Network:\s+(\S+)/.exec(log)?.[1] ?? null,
    localUrl: /Local:\s+(\S+)/.exec(log)?.[1] ?? null,
  };
  child.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!child.killed) child.kill('SIGKILL');
  await fs.rm(projectRoot, { recursive: true, force: true });
  return measured;
}

function ownedSockets(measured) {
  return measured.listening?.owned ?? null;
}

function describeListening(measured) {
  const owned = ownedSockets(measured);
  if (owned === null) return 'não mensurável (sem /proc/net/tcp ou /proc/<pid>/fd nesta plataforma)';
  if (!owned.length) return `nenhum socket LISTEN do processo na porta ${measured.port}`;
  return owned.map((entry) => `${entry.address} (${entry.kind})`).join(', ');
}

// ------------------------------------------------------------------ política pura
{
  const standard = resolveBindHost({});
  check('sem opt-in a política resolve loopback', standard.host === '127.0.0.1');
  check('e não se declara exposta', standard.exposed === false);
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
  check('LIA_FORGE_HTTP_HOST sozinho NÃO expõe', resolveBindHost({ LIA_FORGE_HTTP_HOST: '0.0.0.0' }).exposed === false);
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
check('nenhum script do package.json passa --host 0.0.0.0',
  !Object.entries(scripts).filter(([name]) => !name.endsWith(':expose')).some(([, command]) => /--host\s+0\.0\.0\.0/.test(String(command))));

// O MCP sobe o mesmo dev-server: não pode reintroduzir a flag.
const mcpSource = await fs.readFile(path.join(repositoryRoot, 'scripts', 'spriteforge-mcp.mjs'), 'utf8');
const openPanelSpawn = /spawn\(npm, \[[^\]]*\]/.exec(mcpSource)?.[0] ?? '';
check('spriteforge_open_panel spawnava npm run dev (achado no fonte)', /run', 'dev/.test(openPanelSpawn));
check('e não passa mais --host 0.0.0.0 (verificação de fonte, não de execução)',
  !/'--host'/.test(openPanelSpawn) && !/0\.0\.0\.0/.test(openPanelSpawn));

// --------------------------------------------- comportamento efetivo do processo
const standardRun = await measure(devArgs);
check(`o servidor do script dev sobe (args: ${JSON.stringify(devArgs)})`,
  standardRun.up === true || `não subiu (exit=${standardRun.exitCode}): ${standardRun.logTail}`);
check('atende em loopback', standardRun.loopback === 'connected');
check(`o socket LISTEN do processo real está em loopback — medido no kernel, atribuído ao PID: ${describeListening(standardRun)}`,
  ownedSockets(standardRun) === null
    ? 'medição não executada nesta plataforma (sem /proc/net/tcp): pendente de verificação no alvo Windows'
    : (ownedSockets(standardRun).length > 0 && ownedSockets(standardRun).every((entry) => entry.kind === 'loopback')));
if (standardRun.listening?.foreign?.length) {
  note(`outro processo do ambiente também escuta na porta ${standardRun.port}: `
    + `${standardRun.listening.foreign.map((entry) => `${entry.address} (${entry.kind})`).join(', ')}`
    + ' — não é socket do Vite; se o probe externo conectar, a causa é ele');
}
check('o Vite não anuncia URL de rede', standardRun.networkUrl === null);
check('e anuncia a URL local em loopback', /127\.0\.0\.1|localhost/.test(standardRun.localUrl ?? ''));
check('e não registra exposição no log', !/Exposição explícita/.test(standardRun.log));

const forwarded = Object.entries(standardRun.external).filter(([, outcome]) => outcome === 'connected');
if (forwarded.length) {
  note(`probe externo conectou em ${forwarded.map(([address]) => address).join(', ')} embora o kernel mostre loopback: `
    + 'este ambiente encaminha tráfego da interface para listeners em loopback, então o probe externo não é evidência de exposição aqui (registrado, não falha)');
} else if (externalAddresses.length) {
  check(`probe externo (secundário) recusado em ${externalAddresses.join(', ')}`,
    Object.values(standardRun.external).every((outcome) => String(outcome).startsWith('refused')));
} else {
  note('nenhum endereço não-loopback neste ambiente: o probe externo não pôde ser feito');
}

const exposedRun = await measure(devArgs, { LIA_FORGE_HTTP_EXPOSE: '1' });
check('com LIA_FORGE_HTTP_EXPOSE=1 o servidor sobe',
  exposedRun.up === true || `não subiu (exit=${exposedRun.exitCode}): ${exposedRun.logTail}`);
check(`com o opt-in o socket LISTEN sai do loopback (o opt-in não está quebrado): ${describeListening(exposedRun)}`,
  ownedSockets(exposedRun) === null
    ? 'medição não executada nesta plataforma (sem /proc/net/tcp): pendente de verificação no alvo Windows'
    : ownedSockets(exposedRun).some((entry) => entry.kind !== 'loopback'));
check('e o Vite anuncia a URL de rede', typeof exposedRun.networkUrl === 'string');
check('e registra por escrito que a exposição foi explícita', /Exposição explícita/.test(exposedRun.log));

const modeRun = await measure(exposeArgs);
check(`com o script dev:expose o servidor sobe (args: ${JSON.stringify(exposeArgs)})`,
  modeRun.up === true || `não subiu (exit=${modeRun.exitCode}): ${modeRun.logTail}`);
check(`e o modo expose também sai do loopback (caminho portável, sem env no script): ${describeListening(modeRun)}`,
  ownedSockets(modeRun) === null
    ? 'medição não executada nesta plataforma (sem /proc/net/tcp): pendente de verificação no alvo Windows'
    : ownedSockets(modeRun).some((entry) => entry.kind !== 'loopback'));
check('e também registra o motivo', /Exposição explícita/.test(modeRun.log));

const previewArgs = String(scripts.preview ?? '').replace(/^vite\s+preview\s*/, '').split(/\s+/).filter(Boolean);
check('o script preview também não carrega endereço de bind', !previewArgs.some((arg) => arg === '0.0.0.0' || arg === '--host'));

console.log(results.join('\n'));
console.log(`\nhttp-bind-smoke: ${failures ? `FAIL (${failures} de ${results.length})` : `${results.length} checagens, passou`}`);
console.log(`--- interfaces não-loopback medidas: ${externalAddresses.join(', ') || '(nenhuma)'} ---`);
console.log('--- Substitutos de teste: nenhum. O processo medido é o Vite real do repositório, com os argumentos publicados em package.json. ---');
process.exit(failures ? 1 : 0);
