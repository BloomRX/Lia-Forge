/**
 * Smoke de confinamento de caminhos (auditoria P0, item 2 — R-11).
 *
 * Reprodução medida ANTES da correção, neste checkout (o mesmo harness deste
 * arquivo, com o código antigo):
 *
 *   run "run-mwg3itup-qebs0z" concluído; `run.json` adulterado para declarar duas
 *   saídas a mais; `exportRun` chamado:
 *     arquivos no bundle: ["vfx-explosion.png",
 *       "../run-mwg3itup-qebs0z-evil/segredo-do-vizinho.png",
 *       "link-para-fora.png", "vfx-preview-composed.png",
 *       "export/godot-4/manifest.json"]
 *     IRMÃO POR PREFIXO VAZOU? true
 *     SYMLINK PARA FORA VAZOU? true
 *
 *   Causa: `shared/services/studio-service.mjs` decidia contenção com
 *   `absolute.startsWith(runDirectory) || absolute.startsWith(projectRoot)`.
 *   (a) sem separador no fim da raiz, a pasta irmã `run-<id>-evil/` satisfaz o
 *   prefixo; (b) symlink é comparado como string, então um link criado dentro do
 *   run apontando para `/tmp/fora.png` tem caminho textual "dentro" e conteúdo
 *   fora; (c) o segundo termo aceitava **qualquer** arquivo do projeto inteiro.
 *   O manifesto saía com o caminho `../run-…-evil/…` declarado para o destino.
 *
 * O que este arquivo cobre:
 *  1. `shared/fs/path-containment.mjs` puro (irmão por prefixo, `..`, absoluto
 *     externo, outro volume Windows, caminho declarado).
 *  2. O mesmo módulo com filesystem injetado (symlink no alvo e symlink num pai de
 *     alvo que ainda não existe).
 *  3. O mesmo módulo com disco de verdade (symlink real, pasta irmã real).
 *  4. `assertSafeWriteTarget` (gate 6) mantendo o contrato antigo e ganhando a
 *     cobertura de symlink no pai.
 *  5. `buildExportBundle` recusando caminho declarado absoluto ou com `..`.
 *  6. `exportRun` de ponta a ponta: controle aceita, e seis adulterações são
 *     recusadas sem gravar nada.
 *
 * O que NÃO prova: não é validação de segurança de produção. Nada aqui mede
 * permissões do filesystem, montagem de rede, junctions/links físicos do Windows
 * (o sandbox é Linux — os casos com separador `\\` são reportados como não
 * mensuráveis em POSIX, em vez de fingirem ok), nem comportamento no app
 * empacotado.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isDeclaredPathContained,
  isPathContained,
  resolveContainedPath,
  resolveContainedPathOnDisk,
} from '../shared/fs/path-containment.mjs';
import { assertSafeWriteTarget } from '../shared/engine/gates.mjs';
import { buildExportBundle } from '../shared/destinations/profiles.mjs';
import { createStudioService } from '../shared/services/studio-service.mjs';
import { encodePngRgba } from '../shared/qa/png-codec.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let failures = 0;

function check(label, assertion) {
  const ok = assertion === true;
  if (!ok) failures += 1;
  results.push(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — obtido: ${JSON.stringify(assertion)}`}`);
}

// ------------------------------------------------------- 1. parte pura (sem disco)
const root = '/proj/.lia-forge/runs/run-abc';
check('dentro da raiz está contido', isPathContained(root, `${root}/vfx-explosion.png`) === true);
check('subpasta dentro da raiz está contida', isPathContained(root, `${root}/export/godot-4/manifest.json`) === true);
check('a própria raiz está contida', isPathContained(root, root) === true);
check('IRMÃ POR PREFIXO não está contido (o startsWith antigo aceitava)',
  isPathContained(root, '/proj/.lia-forge/runs/run-abc-evil/segredo.png') === false);
check('irmão por prefixo com nome mais longo também não',
  isPathContained(root, '/proj/.lia-forge/runs/run-abc123/x.png') === false);
check('".." que sobe para o projeto não está contido', isPathContained(root, '/proj/segredo.png') === false);
check('".." normalizado por path.resolve não está contido',
  isPathContained(root, path.resolve(`${root}/../../segredo.png`)) === false);
check('absoluto externo não está contido', isPathContained(root, '/etc/passwd') === false);
check('argumentos inválidos não estão contidos', isPathContained(root, null) === false && isPathContained('', `${root}/x`) === false);
// Separadores Windows só são mensuráveis onde `path.sep === '\\'`: em POSIX a
// barra invertida é caractere de nome de arquivo, então `path.relative` não trata
// esses caminhos como hierarquia. Reportado como não mensurável, não como ok.
if (path.sep === '\\') {
  check('Windows: outro volume não está contido', isPathContained('C:\\proj\\runs\\run-abc', 'D:\\segredo.png') === false);
  check('Windows: irmã por prefixo não está contida',
    isPathContained('C:\\proj\\runs\\run-abc', 'C:\\proj\\runs\\run-abc-evil\\x.png') === false);
  check('Windows: dentro da raiz está contida',
    isPathContained('C:\\proj\\runs\\run-abc', 'C:\\proj\\runs\\run-abc\\x.png') === true);
} else {
  results.push('ok   separadores Windows (outro volume / irmã por prefixo) não mensuráveis em POSIX: path.relative não trata "\\" como hierarquia — verificação pendente no alvo Windows');
}

check('caminho declarado relativo é aceito', isDeclaredPathContained('vfx-explosion.png').ok === true);
check('e é normalizado', isDeclaredPathContained('a/./b.png').normalized === 'a/b.png');
check('caminho declarado com barras invertidas é aceito e normalizado',
  isDeclaredPathContained('export\\godot-4\\manifest.json').normalized === 'export/godot-4/manifest.json');
check('caminho declarado com ".." é recusado', isDeclaredPathContained('../segredo.png').ok === false);
check('".." escondido no meio é recusado', isDeclaredPathContained('a/../../segredo.png').ok === false);
check('caminho declarado absoluto é recusado', isDeclaredPathContained('/etc/passwd').ok === false);
check('caminho declarado com drive Windows é recusado', isDeclaredPathContained('C:\\segredo.png').ok === false);
check('caminho declarado vazio é recusado', isDeclaredPathContained('   ').ok === false);
check('e a recusa diz o motivo', /escapa da raiz/.test(isDeclaredPathContained('../x.png').reason ?? '')
  && /absoluto/.test(isDeclaredPathContained('/x.png').reason ?? ''));

// ------------------------------------- 2. filesystem injetado (decisão sem disco)
function fakeFs(entries) {
  const lstat = async (value) => {
    const entry = entries.get(value);
    return entry ? { isSymbolicLink: () => entry.kind === 'link' } : null;
  };
  const realpath = async (value) => {
    let current = value;
    for (let step = 0; step < 16; step += 1) {
      const entry = entries.get(current);
      if (!entry || entry.kind !== 'link') return current;
      current = entry.target;
    }
    return current;
  };
  return { resolve: async (value) => path.resolve(value), lstat, realpath };
}

const injectedRoot = '/proj/.lia-forge/runs/run-abc';
const injected = fakeFs(new Map([
  [injectedRoot, { kind: 'dir' }],
  [`${injectedRoot}/ok.png`, { kind: 'file' }],
  [`${injectedRoot}/fora.png`, { kind: 'link', target: '/tmp/fora.png' }],
  [`${injectedRoot}/dentro.png`, { kind: 'link', target: `${injectedRoot}/ok.png` }],
  [`${injectedRoot}/pasta-link`, { kind: 'link', target: '/tmp/outra-pasta' }],
  ['/proj/.lia-forge/runs/run-abc-evil', { kind: 'dir' }],
  ['/proj/.lia-forge/runs/run-abc-evil/segredo.png', { kind: 'file' }],
]));

const inside = await resolveContainedPath({ root: injectedRoot, target: `${injectedRoot}/ok.png`, ...injected, label: 'artefato' });
check('alvo comum dentro da raiz é aceito', inside.ok === true);
check('e devolve o caminho real igual ao textual', inside.real === `${injectedRoot}/ok.png`);
check('e não é symlink', inside.isSymlink === false);

const missing = await resolveContainedPath({ root: injectedRoot, target: `${injectedRoot}/novo/ainda-nao-existe.png`, ...injected, label: 'artefato' });
check('alvo que ainda não existe, mas está dentro, é aceito (caso de escrita)', missing.ok === true);

const sibling = await resolveContainedPath({ root: injectedRoot, target: '/proj/.lia-forge/runs/run-abc-evil/segredo.png', ...injected, label: 'artefato' });
check('irmã por prefixo é recusada', sibling.ok === false && sibling.code === 'outside-root');
check('e o motivo mostra o caminho relativo', /run-abc-evil/.test(sibling.reason ?? ''));

const escapeLink = await resolveContainedPath({ root: injectedRoot, target: `${injectedRoot}/fora.png`, ...injected, label: 'artefato' });
check('symlink que aponta para fora é recusado', escapeLink.ok === false && escapeLink.code === 'symlink-escape');
check('e o motivo nomeia o caminho real', /\/tmp\/fora\.png/.test(escapeLink.reason ?? ''));

const innerLink = await resolveContainedPath({ root: injectedRoot, target: `${injectedRoot}/dentro.png`, ...injected, label: 'artefato' });
check('symlink que aponta para dentro continua aceito', innerLink.ok === true);
check('e é reportado como symlink', innerLink.isSymlink === true);

const parentLink = await resolveContainedPath({ root: injectedRoot, target: `${injectedRoot}/pasta-link/gerado.png`, ...injected, label: 'artefato' });
check('symlink no PAI de um alvo inexistente é recusado (o gate antigo só conferia alvo existente)',
  parentLink.ok === false && parentLink.code === 'symlink-escape');
check('e o caminho real mostrado inclui o trecho que ainda não existe',
  (parentLink.real ?? '') === '/tmp/outra-pasta/gerado.png');

const rejectSymlink = await resolveContainedPath({ root: injectedRoot, target: `${injectedRoot}/dentro.png`, ...injected, rejectSymlink: true, label: 'alvo' });
check('rejectSymlink recusa qualquer symlink, mesmo apontando para dentro', rejectSymlink.ok === false);

const withoutRealpath = await resolveContainedPath({
  root: injectedRoot,
  target: `${injectedRoot}/fora.png`,
  resolve: async (value) => path.resolve(value),
  lstat: injected.lstat,
  label: 'artefato',
});
check('sem realpath injetado o symlink NÃO é detectado (limitação registrada, não silêncio)',
  withoutRealpath.ok === true && withoutRealpath.isSymlink === true);

const unsafePath = await resolveContainedPath({ root: injectedRoot, target: '   ', ...injected, label: 'artefato' });
check('caminho vazio é recusado como unsafe-path', unsafePath.ok === false && unsafePath.code === 'unsafe-path');

const relativeToRoot = await resolveContainedPath({ root: injectedRoot, target: 'ok.png', relativeToRoot: true, ...injected, label: 'artefato' });
check('target relativo à raiz é resolvido contra a raiz', relativeToRoot.ok === true);

let missingDepsError = null;
try {
  await resolveContainedPath({ root: injectedRoot, target: 'x' });
} catch (error) { missingDepsError = error; }
check('sem resolve/lstat injetados o módulo lança em vez de decidir no escuro',
  missingDepsError instanceof TypeError && /resolve e lstat são obrigatórios/.test(missingDepsError.message));

// ------------------------------------------------------ 3. disco de verdade
const diskRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-containment-'));
const runDirectory = path.join(diskRoot, '.lia-forge', 'runs', 'run-disco');
await fs.mkdir(runDirectory, { recursive: true });
await fs.mkdir(path.join(diskRoot, '.lia-forge', 'runs', 'run-disco-evil'), { recursive: true });
await fs.writeFile(path.join(diskRoot, '.lia-forge', 'runs', 'run-disco-evil', 'segredo.png'), 'vizinho');
await fs.writeFile(path.join(runDirectory, 'ok.png'), 'artefato');
const outsideFile = path.join(os.tmpdir(), `lia-fora-${process.pid}.png`);
await fs.writeFile(outsideFile, 'fora do projeto');
await fs.symlink(outsideFile, path.join(runDirectory, 'link-para-fora.png'));
await fs.symlink(path.join(runDirectory, 'ok.png'), path.join(runDirectory, 'link-dentro.png'));
await fs.symlink(path.dirname(outsideFile), path.join(runDirectory, 'pasta-fora'));

const diskInside = await resolveContainedPathOnDisk({ root: runDirectory, target: 'ok.png', relativeToRoot: true });
check('disco: artefato real dentro do run é aceito', diskInside.ok === true);
const diskSibling = await resolveContainedPathOnDisk({ root: runDirectory, target: path.join(diskRoot, '.lia-forge/runs/run-disco-evil/segredo.png') });
check('disco: pasta irmã por prefixo é recusada', diskSibling.ok === false && diskSibling.code === 'outside-root');
const diskLink = await resolveContainedPathOnDisk({ root: runDirectory, target: 'link-para-fora.png', relativeToRoot: true });
check('disco: symlink real para fora do projeto é recusado', diskLink.ok === false && diskLink.code === 'symlink-escape');
const diskInnerLink = await resolveContainedPathOnDisk({ root: runDirectory, target: 'link-dentro.png', relativeToRoot: true });
check('disco: symlink real para dentro do run é aceito', diskInnerLink.ok === true);
const diskParentLink = await resolveContainedPathOnDisk({ root: runDirectory, target: 'pasta-fora/gerado.png', relativeToRoot: true });
check('disco: symlink real no pai de alvo inexistente é recusado', diskParentLink.ok === false && diskParentLink.code === 'symlink-escape');

// ------------------------------------- 4. gate 6 (escrita segura) preservado
const gateCall = (target, options = {}) => assertSafeWriteTarget({
  root: runDirectory,
  target,
  resolve: async (value) => path.resolve(value),
  lstat: async (value) => fs.lstat(value).catch(() => null),
  realpath: async (value) => fs.realpath(value).catch(() => null),
  ...options,
});
check('gate: escrita dentro da raiz continua permitida', (await gateCall(path.join(runDirectory, 'novo.png'))).ok === true);
check('gate: escrita na pasta irmã por prefixo é recusada', (await gateCall(path.join(diskRoot, '.lia-forge/runs/run-disco-evil/x.png'))).ok === false);
check('gate: alvo symlink continua recusado (comportamento antigo preservado)', (await gateCall(path.join(runDirectory, 'link-dentro.png'))).ok === false);
const gateParentLink = await gateCall(path.join(runDirectory, 'pasta-fora', 'gerado.png'));
check('gate: symlink no pai de alvo inexistente agora é recusado', gateParentLink.ok === false);
check('gate: o motivo continua dizendo que aponta para fora', /aponta para fora da raiz/.test(gateParentLink.reason ?? ''));
check('gate: código continua unsafe-write-target', gateParentLink.code === 'unsafe-write-target');
check('gate: fora da raiz mantém a mensagem antiga', /está fora da raiz do projeto/.test((await gateCall('/etc/passwd')).reason ?? ''));

// --------------------------------------------- 5. pacote de exportação puro
const bundleHash = (bytes) => `sha-${bytes.length}`;
const goodBundle = buildExportBundle({
  destinationId: 'godot-4',
  artifacts: [{ id: 'vfx:vfx.png', format: 'png', role: 'vfx', relativePath: 'vfx.png', bytes: Buffer.from('1234') }],
  hash: bundleHash,
  workflowRunId: 'run-x',
});
check('pacote com caminho relativo continua sendo construído', goodBundle.files.length === 1 && goodBundle.files[0].path === 'vfx.png');
function bundleWith(declaredPath) {
  try {
    buildExportBundle({
      destinationId: 'godot-4',
      artifacts: [{ id: 'vfx:vfx.png', format: 'png', role: 'vfx', relativePath: declaredPath, bytes: Buffer.from('1234') }],
      hash: bundleHash,
    });
    return null;
  } catch (error) { return error; }
}
const escapeError = bundleWith('../run-x-evil/segredo.png');
check('pacote recusa caminho declarado com ".." (antes: entrava no manifesto)',
  escapeError instanceof Error && /escapa da raiz/.test(escapeError.message));
check('e diz que nada foi empacotado', /Nada foi empacotado/.test(escapeError?.message ?? ''));
const absoluteError = bundleWith('/etc/passwd');
check('pacote recusa caminho declarado absoluto', absoluteError instanceof Error && /absoluto/.test(absoluteError.message));
check('pacote recusa caminho declarado com drive Windows', bundleWith('C:\\segredo.png') instanceof Error);
check('e o pacote normaliza barras invertidas em vez de recusar',
  buildExportBundle({
    destinationId: 'godot-4',
    artifacts: [{ id: 'vfx:vfx.png', format: 'png', role: 'vfx', relativePath: 'export\\godot-4\\vfx.png', bytes: Buffer.from('1234') }],
    hash: bundleHash,
  }).files[0].path === 'export/godot-4/vfx.png');

// ------------------------------------------- 6. exportRun de ponta a ponta
const pngBytes = encodePngRgba(Buffer.alloc(48 * 48 * 4, 200), 48, 48);
const relative = (base, target) => path.relative(base, target).split(path.sep).join('/');

/**
 * Um run real (executado neste ambiente, sem ferramenta externa) e uma
 * adulteração do `run.json` dele. A exportação pede `unity-2d` de propósito: o
 * passo `deliver` do run já gravou `export/godot-4/manifest.json`, então pedir
 * godot-4 de novo reescreveria esse arquivo e o teste mediria divergência de hash
 * em vez de confinamento.
 */
async function exportScenario(label, tamper) {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-export-'));
  const service = createStudioService({ projectRoot });
  const run = await service.run({ workflowId: 'ui-vfx-sheet', destination: 'godot-4', params: {} });
  const runDirectoryOfRun = path.join(projectRoot, '.lia-forge', 'runs', run.runId);
  const outsideTarget = path.join(os.tmpdir(), `lia-export-fora-${run.runId}.png`);
  await fs.writeFile(outsideTarget, pngBytes);
  const injectedOutputs = await tamper({ projectRoot, runDirectory: runDirectoryOfRun, runId: run.runId, outsideTarget });
  const runFile = path.join(runDirectoryOfRun, 'run.json');
  const snapshot = JSON.parse(await fs.readFile(runFile, 'utf8'));
  snapshot.steps[0].outputs = [...snapshot.steps[0].outputs, ...injectedOutputs];
  await fs.writeFile(runFile, JSON.stringify(snapshot, null, 2));
  let error = null;
  let accepted = null;
  try {
    accepted = await service.exportRun({ runId: run.runId, destination: 'unity-2d' });
  } catch (thrown) { error = thrown; }
  const manifestWritten = await fs.stat(path.join(runDirectoryOfRun, 'export', 'unity-2d', 'manifest.json'))
    .then(() => true).catch(() => false);
  await fs.rm(projectRoot, { recursive: true, force: true });
  await fs.rm(outsideTarget, { force: true });
  return { label, error, accepted, manifestWritten };
}

const scenarios = [];
scenarios.push(await exportScenario('controle (só as saídas legítimas do run)', async () => []));
scenarios.push(await exportScenario('irmã por prefixo: run-<id>-evil', async ({ projectRoot, runId }) => {
  const evil = path.join(projectRoot, '.lia-forge', 'runs', `${runId}-evil`);
  await fs.mkdir(evil, { recursive: true });
  await fs.writeFile(path.join(evil, 'segredo-do-vizinho.png'), pngBytes);
  return [relative(projectRoot, path.join(evil, 'segredo-do-vizinho.png'))];
}));
scenarios.push(await exportScenario('symlink dentro do run apontando para fora do projeto', async ({ projectRoot, runDirectory, outsideTarget }) => {
  await fs.symlink(outsideTarget, path.join(runDirectory, 'link-para-fora.png'));
  return [relative(projectRoot, path.join(runDirectory, 'link-para-fora.png'))];
}));
scenarios.push(await exportScenario('".." subindo da pasta do run para a raiz do projeto', async ({ projectRoot }) => {
  await fs.writeFile(path.join(projectRoot, 'segredo-na-raiz.png'), Buffer.alloc(8, 7));
  return ['.lia-forge/runs/inexistente/../../../segredo-na-raiz.png'];
}));
scenarios.push(await exportScenario('absoluto externo ao projeto', async () => ['/etc/passwd']));
scenarios.push(await exportScenario('absoluto de outro arquivo do projeto (não é artefato do run)', async ({ projectRoot }) => [relative(projectRoot, path.join(projectRoot, 'package.json'))]));
scenarios.push(await exportScenario('symlink no pai: pasta do run com link para fora', async ({ projectRoot, runDirectory, outsideTarget }) => {
  await fs.symlink(path.dirname(outsideTarget), path.join(runDirectory, 'pasta-fora'));
  return [relative(projectRoot, path.join(runDirectory, 'pasta-fora', path.basename(outsideTarget)))];
}));

const [control, ...tampered] = scenarios;
check('controle: exportação legítima continua funcionando', control.error === null && (control.accepted?.bundle?.files?.length ?? 0) > 0);
check('controle: os arquivos do pacote são relativos à pasta do run, sem ".."',
  (control.accepted?.bundle?.files ?? []).every((file) => isDeclaredPathContained(file.path).ok));
check('controle: o manifesto foi gravado', control.manifestWritten === true);

for (const scenario of tampered) {
  check(`${scenario.label}: exportação recusada (antes: entrava no pacote)`, scenario.error instanceof Error);
  check(`${scenario.label}: o motivo nomeia o confinamento`, /fora da pasta do run/.test(scenario.error?.message ?? ''));
  check(`${scenario.label}: diz que nada foi gravado`, /Nada foi gravado/.test(scenario.error?.message ?? ''));
  check(`${scenario.label}: nenhum manifesto foi gravado`, scenario.manifestWritten === false);
}

// --------------------------------------------------------------- limpeza e resumo
await fs.rm(diskRoot, { recursive: true, force: true });
await fs.rm(outsideFile, { force: true });

console.log(results.join('\n'));
console.log(`\npath-containment-smoke: ${failures ? `FAIL (${failures} de ${results.length})` : `${results.length} checagens, passou`}`);
console.log('--- Substitutos de teste: filesystem injetado (mapa em memória) e disco temporário criado por este smoke. Nenhum Blender/ComfyUI/provider externo foi usado; os runs são executados pelos adapters internos do repositório. ---');
console.log(`--- repositório: ${repositoryRoot} ---`);
process.exit(failures ? 1 : 0);
