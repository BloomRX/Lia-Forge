/**
 * Estrutura de uma pasta de projeto do Lia Forge.
 *
 * Um projeto é só isto: uma pasta com `input/` (referências e modelos do
 * usuário), `.lia-forge/` (estado produzido pelo produto: runs, providers,
 * exports) e o que o usuário já tinha nela. Duas regras valem sempre:
 *
 * 1. **nada é apagado, movido, renomeado nem sobrescrito** — `.spriteforge/`
 *    (store de versões anteriores) e `.lia.json` (formato de importação do
 *    destino Lia Desktop, gravado por asset) continuam intocados;
 * 2. criar projeto não baixa, não instala e não envia nada: são pastas locais.
 *
 * Este módulo é compartilhado porque o mesmo conhecimento é usado pelo
 * aplicativo desktop (criar/abrir projeto), pelo serviço do Studio (informar o
 * estado do projeto) e pelos testes.
 */

import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';

/** Pastas que o produto usa dentro do projeto, relativas à raiz. */
export const PROJECT_DIRECTORIES = Object.freeze({
  inputs: 'input',
  state: '.lia-forge',
  runs: path.posix.join('.lia-forge', 'runs'),
  legacyState: '.spriteforge',
});

/** Arquivos que podem existir no projeto e são preservados como estão. */
export const PRESERVED_FILES = Object.freeze({
  liaManifest: '.lia.json',
  legacyAssets: path.posix.join('.spriteforge', 'assets.json'),
  providers: path.posix.join('.lia-forge', 'providers.json'),
});

const MAX_COUNTED_ENTRIES = 5000;

/**
 * Raiz de projeto aceita. Caminho vazio é recusado **antes** de resolver: sem
 * isso, `path.resolve('')` viraria o diretório de trabalho atual e o produto
 * criaria pastas dentro do próprio repositório (ou de ondequer que estivesse).
 */
function assertProjectRoot(root) {
  const value = String(root ?? '').trim();
  if (!value) throw new Error('projectRoot inválida: informe o caminho da pasta do projeto.');
  const resolved = path.resolve(value);
  if (!resolved || resolved === path.dirname(resolved)) {
    throw new Error(`projectRoot inválida: "${resolved}" é a raiz do sistema de arquivos.`);
  }
  return resolved;
}

async function directoryStats(absolute) {
  const stats = await fs.stat(absolute).catch(() => null);
  return { exists: Boolean(stats?.isDirectory()), isSymbolicLink: false };
}

async function fileStats(absolute) {
  const lstat = await fs.lstat(absolute).catch(() => null);
  if (!lstat) return { exists: false, bytes: null, isSymbolicLink: false };
  return { exists: lstat.isFile(), bytes: lstat.isFile() ? lstat.size : null, isSymbolicLink: lstat.isSymbolicLink() };
}

async function countEntries(absolute) {
  try {
    const items = await fs.readdir(absolute, { withFileTypes: true });
    return items.slice(0, MAX_COUNTED_ENTRIES).filter((item) => item.isFile() || item.isDirectory()).length;
  } catch {
    return 0;
  }
}

/**
 * Descreve o estado de uma pasta de projeto **sem escrever nada**: o que existe,
 * se dá para escrever, quantas entradas e runs há e o que será preservado.
 */
export async function inspectProjectStructure(root) {
  const resolved = assertProjectRoot(root);
  const lstat = await fs.lstat(resolved).catch(() => null);
  const exists = Boolean(lstat?.isDirectory());
  let writable = false;
  if (exists) {
    try {
      await fs.access(resolved, fsConstants.W_OK);
      writable = true;
    } catch { /* sem permissão de escrita: o produto diz isso em vez de falhar ao gravar */ }
  }

  const directories = {};
  for (const [key, relative] of Object.entries(PROJECT_DIRECTORIES)) {
    const absolute = path.join(resolved, relative);
    const stats = await directoryStats(absolute);
    directories[key] = Object.freeze({
      path: relative,
      exists: stats.exists,
      entries: stats.exists ? await countEntries(absolute) : 0,
    });
  }

  const files = {};
  for (const [key, relative] of Object.entries(PRESERVED_FILES)) {
    files[key] = Object.freeze({ path: relative, ...(await fileStats(path.join(resolved, relative))) });
  }

  const preserved = Object.entries({ ...directories, ...files })
    .filter(([, value]) => value.exists)
    .map(([key, value]) => Object.freeze({ key, path: value.path }));

  return Object.freeze({
    schemaVersion: 1,
    root: resolved,
    name: path.basename(resolved),
    exists,
    writable,
    directories: Object.freeze(directories),
    files: Object.freeze(files),
    counts: Object.freeze({
      inputs: directories.inputs.entries,
      runs: directories.runs.entries,
    }),
    preserved: Object.freeze(preserved),
    note: exists
      ? 'Nada aqui foi criado, movido ou apagado: esta é a leitura do que já existe na pasta.'
      : 'A pasta ainda não existe; nada foi criado por esta leitura.',
  });
}

/**
 * Garante a estrutura mínima de um projeto: cria `input/` e `.lia-forge/runs/`
 * se não existirem. O que já existe é preservado byte a byte — inclusive
 * `.spriteforge/` e `.lia.json`, que pertencem a outras partes do produto.
 *
 * @returns {Promise<{root:string, created:string[], existing:string[], preserved:object[]}>}
 */
export async function ensureProjectStructure(root) {
  const resolved = assertProjectRoot(root);
  const lstat = await fs.lstat(resolved).catch(() => null);
  if (lstat?.isSymbolicLink()) {
    throw new Error('ensureProjectStructure: a raiz do projeto é um symlink; escolha a pasta real.');
  }
  if (lstat && !lstat.isDirectory()) {
    throw new Error(`ensureProjectStructure: "${resolved}" existe e não é uma pasta.`);
  }

  const created = [];
  const existing = [];
  await fs.mkdir(resolved, { recursive: true });
  for (const relative of [PROJECT_DIRECTORIES.inputs, PROJECT_DIRECTORIES.runs]) {
    const absolute = path.join(resolved, relative);
    const before = await directoryStats(absolute);
    await fs.mkdir(absolute, { recursive: true });
    (before.exists ? existing : created).push(relative);
  }

  try {
    await fs.access(resolved, fsConstants.W_OK);
  } catch {
    throw new Error(`ensureProjectStructure: sem permissão de escrita em "${resolved}".`);
  }

  const structure = await inspectProjectStructure(resolved);
  return Object.freeze({
    root: resolved,
    created: Object.freeze(created),
    existing: Object.freeze(existing),
    preserved: structure.preserved,
    note: created.length
      ? `Pastas criadas: ${created.join(', ')}. Nada que já existia foi alterado.`
      : 'A estrutura já existia; nada foi criado nem alterado.',
  });
}
