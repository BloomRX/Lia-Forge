/**
 * Contenção de caminhos (P0 da auditoria integrada, item "confinamento de
 * caminhos na exportação" / R-11).
 *
 * Por que existe
 * --------------
 * `caminho.startsWith(raiz)` **não** decide contenção. Duas falhas reais, ambas
 * reproduzidas neste checkout antes da correção:
 *
 *   1. Irmão por prefixo. Com `raiz = /p/.lia-forge/runs/run-abc`, o caminho
 *      `/p/.lia-forge/runs/run-abc-evil/segredo.png` satisfaz `startsWith(raiz)`
 *      e era exportado como artefato do run. Sem o separador no fim da raiz,
 *      qualquer pasta cujo nome comece com o nome da raiz entra.
 *   2. Symlink. Um link criado dentro do run apontando para `/tmp/fora.png` tem
 *      caminho textual dentro da raiz e conteúdo fora dela; `startsWith` nunca vê
 *      isso porque compara strings, não o filesystem.
 *
 * Este módulo decide contenção por **caminho relativo** (`path.relative`: sair da
 * raiz produz `..`) e resolve o **caminho real** quando o alvo existe, subindo até
 * o ancestral existente mais próximo — assim um alvo que ainda não foi criado (o
 * caso de escrita) também é conferido pela cadeia de symlinks dos pais.
 *
 * Não é um gate de permissão: é só a pergunta "este caminho está dentro desta
 * raiz, de verdade?". Autorização, direitos e revisão continuam nos seus gates.
 */

import path from 'node:path';

const MAX_ANCESTOR_WALK = 64;

/**
 * Contenção puramente textual, por caminho relativo.
 *
 * `true` quando `candidate` é a própria `root` ou está dentro dela. `..` no
 * relativo, relativo absoluto (Windows entre discos diferentes) e qualquer coisa
 * fora devolvem `false`. Não toca no filesystem.
 *
 * @param {string} root caminho já resolvido/absoluto
 * @param {string} candidate caminho já resolvido/absoluto
 * @returns {boolean}
 */
export function isPathContained(root, candidate) {
  if (typeof root !== 'string' || typeof candidate !== 'string') return false;
  if (!root || !candidate) return false;
  const relative = path.relative(root, candidate);
  if (relative === '') return true;
  if (path.isAbsolute(relative)) return false; // Windows: outro disco/volume
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !relative.startsWith('../');
}

/**
 * Um caminho declarado (string que veio de JSON, plano ou entrada de usuário) é
 * seguro para entrar num pacote/listagem? Recusa absoluto e qualquer segmento
 * `..` que saia da raiz do pacote. Comparação por caminho relativo, não por
 * prefixo.
 *
 * @param {string} declared
 * @returns {{ok:boolean, reason:string|null, normalized:string|null}}
 */
export function isDeclaredPathContained(declared) {
  if (typeof declared !== 'string' || !declared.trim()) {
    return { ok: false, reason: 'está vazio', normalized: null };
  }
  const normalized = declared.replace(/\\/g, '/');
  if (path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) {
    return { ok: false, reason: 'é absoluto', normalized };
  }
  const cleaned = path.posix.normalize(normalized);
  if (!isPathContainedPosix('.', cleaned)) {
    return { ok: false, reason: 'escapa da raiz (contém "..")', normalized: cleaned };
  }
  return { ok: true, reason: null, normalized: cleaned };
}

function isPathContainedPosix(root, candidate) {
  const relative = path.posix.relative(root, candidate);
  if (relative === '') return true;
  if (path.posix.isAbsolute(relative)) return false;
  return relative !== '..' && !relative.startsWith('../');
}

/**
 * Resolve um caminho e decide se ele está, **de verdade**, dentro da raiz.
 *
 * `resolve`/`lstat`/`realpath` são injetados para que o módulo seja testável sem
 * disco (mesmo padrão de `assertSafeWriteTarget` em `shared/engine/gates.mjs`).
 *
 * Casos recusados (`ok:false`), cada um com `code` próprio:
 * - `unsafe-path`       argumento inválido;
 * - `outside-root`      `..`, absoluto externo, irmão por prefixo, outro volume;
 * - `symlink-escape`    o caminho real (symlinks resolvidos) sai da raiz real.
 *
 * @param {object} params
 * @param {string} params.root raiz que confina (pasta do run, raiz do projeto…)
 * @param {string} params.target caminho a conferir (absoluto ou relativo à raiz)
 * @param {(value:string)=>string|Promise<string>} params.resolve
 * @param {(value:string)=>Promise<import('node:fs').Stats|null>} params.lstat
 * @param {(value:string)=>Promise<string|null>} params.realpath
 * @param {boolean} [params.relativeToRoot] interpretar `target` relativo à `root`
 *   (padrão `false`: relativo ao cwd do processo, como `path.resolve`)
 * @param {boolean} [params.rejectSymlink] recusar quando o próprio alvo é symlink
 *   (é o que a escrita segura exige; leitura de artefato não precisa)
 * @param {string} [params.label] nome do caminho nas mensagens
 * @returns {Promise<{ok:boolean, code:string|null, reason:string|null, root:string,
 *   realRoot:string, target:string, real:string|null, isSymlink:boolean}>}
 */
export async function resolveContainedPath({
  root,
  target,
  resolve,
  lstat,
  realpath = null,
  relativeToRoot = false,
  rejectSymlink = false,
  label = 'caminho',
}) {
  if (typeof resolve !== 'function' || typeof lstat !== 'function') {
    throw new TypeError('resolveContainedPath: resolve e lstat são obrigatórios');
  }
  if (typeof root !== 'string' || !root.trim() || typeof target !== 'string' || !target.trim()) {
    return refusal({ code: 'unsafe-path', reason: `${label}: caminho ausente ou inválido.`, root: String(root ?? ''), target: String(target ?? '') });
  }
  const resolvedRoot = await resolve(root);
  const realRoot = (realpath ? await realpath(resolvedRoot).catch(() => null) : null) ?? resolvedRoot;
  const absolute = await resolve(relativeToRoot && !path.isAbsolute(target) ? path.join(resolvedRoot, target) : target);

  if (!isPathContained(resolvedRoot, absolute)) {
    return refusal({
      code: 'outside-root',
      reason: `${label} "${target}" está fora de "${root}" (caminho relativo: ${JSON.stringify(path.relative(resolvedRoot, absolute)) || 'fora da raiz'}).`,
      root: resolvedRoot,
      realRoot,
      target: absolute,
    });
  }

  const stats = await lstat(absolute).catch(() => null);
  const isSymlink = stats?.isSymbolicLink?.() === true;
  if (rejectSymlink && isSymlink) {
    return refusal({
      code: 'symlink-escape',
      reason: `${label} "${target}" é um symlink; recusado.`,
      root: resolvedRoot,
      realRoot,
      target: absolute,
      isSymlink: true,
    });
  }

  // Caminho real: resolve a cadeia de symlinks do ancestral existente mais
  // próximo e reaplica o trecho que ainda não existe no disco.
  let probe = absolute;
  let probeStats = stats;
  for (let step = 0; step < MAX_ANCESTOR_WALK && !probeStats; step += 1) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
    probeStats = await lstat(probe).catch(() => null);
  }
  const realProbe = (realpath ? await realpath(probe).catch(() => null) : null) ?? probe;
  const tail = path.relative(probe, absolute);
  const real = tail && tail !== '.' ? path.resolve(realProbe, tail) : realProbe;

  if (!isPathContained(realRoot, real)) {
    return refusal({
      code: 'symlink-escape',
      reason: `${label} "${target}" resolve para "${real}", fora de "${root}".`,
      root: resolvedRoot,
      realRoot,
      target: absolute,
      real,
      isSymlink,
    });
  }

  return Object.freeze({
    ok: true,
    code: null,
    reason: null,
    root: resolvedRoot,
    realRoot,
    target: absolute,
    real,
    isSymlink,
    exists: stats !== null,
  });
}

function refusal({ code, reason, root = '', realRoot = null, target = '', real = null, isSymlink = false }) {
  return Object.freeze({ ok: false, code, reason, root, realRoot: realRoot ?? root, target, real, isSymlink, exists: false });
}

/**
 * Atalho com `node:fs/promises` real (uso em produção e em testes que precisam de
 * disco de verdade). O import é dinâmico de propósito: este módulo é importado por
 * `shared/destinations/profiles.mjs`, que não deve ganhar dependência de `node:fs`
 * no topo — a parte pura (comparação por caminho relativo) continua sem I/O.
 */
export async function resolveContainedPathOnDisk({ root, target, ...options }) {
  const fs = await import('node:fs/promises');
  return resolveContainedPath({
    root,
    target,
    ...options,
    resolve: async (value) => path.resolve(value),
    lstat: async (value) => fs.lstat(value).catch(() => null),
    realpath: async (value) => fs.realpath(value).catch(() => null),
  });
}

export default resolveContainedPath;
