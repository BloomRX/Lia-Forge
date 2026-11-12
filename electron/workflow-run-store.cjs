const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_RUN_BYTES = 32 * 1024 * 1024;
const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function runDirectory(projectRoot) {
  return path.join(path.resolve(projectRoot), '.spriteforge', 'runs');
}

async function resolveSafe(projectRoot, candidate, { mustExist = false, label = 'Arquivo de execução' } = {}) {
  const root = path.resolve(projectRoot);
  const rootReal = await fs.realpath(root);
  const absolute = path.resolve(candidate);
  if (!isInside(root, absolute) || absolute === root) throw new Error(`${label} está fora do workspace.`);
  let probe = absolute;
  while (true) {
    try {
      const realPath = await fs.realpath(probe);
      if (!isInside(rootReal, realPath)) throw new Error(`${label} aponta para fora do workspace.`);
      if (mustExist && probe === absolute) return realPath;
      return absolute;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (mustExist) throw new Error(`${label} não existe.`);
      const parent = path.dirname(probe);
      if (parent === probe) throw new Error(`${label} está fora do workspace.`);
      probe = parent;
    }
  }
}

async function persistWorkflowRun(projectRoot, run) {
  if (!projectRoot || !run || !RUN_ID_PATTERN.test(String(run.id || ''))) throw new Error('ID da execução inválido.');
  const directory = runDirectory(projectRoot);
  await fs.mkdir(directory, { recursive: true });
  await resolveSafe(projectRoot, directory, { label: 'Pasta de execuções' });
  const realDirectory = await fs.realpath(directory);
  if (!isInside(await fs.realpath(path.resolve(projectRoot)), realDirectory)) throw new Error('Pasta de execuções fora do workspace.');
  const file = path.join(directory, `${run.id}.json`);
  await resolveSafe(projectRoot, file, { label: 'Estado da execução' });
  try {
    const existing = await fs.lstat(file);
    if (existing.isSymbolicLink() || !existing.isFile()) throw new Error('O destino do estado não é um arquivo simples.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const contents = `${JSON.stringify(run, null, 2)}\n`;
  if (Buffer.byteLength(contents, 'utf8') > MAX_RUN_BYTES) throw new Error('O estado da execução excede o limite de armazenamento.');
  await fs.writeFile(temporary, contents, { encoding: 'utf8', flag: 'wx' });
  try { await fs.rename(temporary, file); } catch (error) { await fs.rm(temporary, { force: true }); throw error; }
}

async function readWorkflowRun(projectRoot, runId) {
  if (typeof runId !== 'string' || !RUN_ID_PATTERN.test(runId)) throw new Error('ID da execução inválido.');
  const file = path.join(runDirectory(projectRoot), `${runId}.json`);
  const safeFile = await resolveSafe(projectRoot, file, { mustExist: true, label: 'Estado da execução' });
  const info = await fs.stat(safeFile);
  if (!info.isFile() || info.size <= 0 || info.size > MAX_RUN_BYTES) throw new Error('O estado da execução está vazio ou excede o limite de leitura.');
  let run;
  try { run = JSON.parse(await fs.readFile(safeFile, 'utf8')); } catch { throw new Error('O estado da execução contém JSON inválido.'); }
  if (run?.id !== runId || !Array.isArray(run.steps) || typeof run.workflowId !== 'string') throw new Error('O estado salvo não corresponde ao formato de execução esperado.');
  return run;
}

async function listWorkflowRuns(projectRoot, { limit = 50 } = {}) {
  if (!projectRoot || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Parâmetros inválidos para listar execuções.');
  const directory = runDirectory(projectRoot);
  try {
    try { await fs.stat(directory); } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    await resolveSafe(projectRoot, directory, { mustExist: true, label: 'Pasta de execuções' });
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const candidates = entries
      .filter((entry) => entry.isFile() && RUN_ID_PATTERN.test(entry.name.replace(/\.json$/i, '')) && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => entry.name.replace(/\.json$/i, ''));
    const runs = [];
    for (const id of candidates) {
      try {
        const run = await readWorkflowRun(projectRoot, id);
        runs.push({
          id: run.id,
          workflowId: run.workflowId,
          assetId: run.assetId || '',
          status: run.status,
          progress: Number.isFinite(run.progress) ? run.progress : 0,
          createdAt: run.createdAt || null,
          updatedAt: run.updatedAt || null,
          resumeFrom: run.resumeFrom || null,
          error: run.error || null,
        });
      } catch { /* Skip damaged or unsafe records; callers can inspect the workspace directly. */ }
    }
    runs.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    return runs.slice(0, limit);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

module.exports = { RUN_ID_PATTERN, listWorkflowRuns, persistWorkflowRun, readWorkflowRun };
