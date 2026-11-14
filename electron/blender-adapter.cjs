const path = require('node:path');
const { spawn } = require('node:child_process');
const { validatePngBuffer } = require('./png-validation.cjs');
const { validateSpritesheetManifest } = require('./spritesheet-manifest.cjs');

const MODEL_EXTENSIONS = new Set(['.blend', '.glb', '.gltf', '.fbx', '.obj', '.stl']);

function parseFrameSize(value, fallback = { width: 48, height: 48 }) {
  const match = String(value || '').match(/(\d{2,3})\s*[×xX]\s*(\d{2,3})/);
  if (!match) return { ...fallback };
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 16 || width > 512 || height < 16 || height > 512) return { ...fallback };
  return { width, height };
}

function candidateModelPaths(asset) {
  const sources = [];
  for (const stageIndex of [3, 2]) {
    const existing = (Array.isArray(asset?.existingInputs) ? asset.existingInputs : [])
      .filter((input) => input?.stageIndex === stageIndex)
      .map((input) => ({ path: input.path, stageIndex }));
    const outputs = (asset?.stageStatus?.[stageIndex]?.outputs || [])
      .filter((output) => typeof output === 'string')
      .map((candidate) => ({ path: candidate, stageIndex }));
    sources.push(...existing, ...outputs);
  }
  for (const input of Array.isArray(asset?.existingInputs) ? asset.existingInputs : []) {
    if (typeof input?.path === 'string') sources.push({ path: input.path, stageIndex: input.stageIndex });
  }
  for (const stageIndex of [3, 2]) {
    const outputs = asset?.stageStatus?.[stageIndex]?.outputs;
    if (Array.isArray(outputs)) sources.push(...outputs.filter((output) => typeof output === 'string').map((candidate) => ({ path: candidate, stageIndex })));
  }
  const seen = new Set();
  const scored = sources.filter((source) => typeof source.path === 'string' && source.path.trim())
    .map((source, index) => ({
      path: source.path,
      stageIndex: source.stageIndex,
      index,
      extension: path.extname(source.path).toLowerCase(),
    }))
    .filter((candidate) => MODEL_EXTENSIONS.has(candidate.extension))
    .filter((candidate) => {
      if (seen.has(candidate.path)) return false;
      seen.add(candidate.path);
      return true;
    });
  scored.sort((a, b) => {
    const stagePriority = (stageIndex) => stageIndex === 3 ? 0 : stageIndex === 2 ? 1 : 2;
    const extensionPriority = (extension) => extension === '.blend' ? 0 : extension === '.fbx' ? 1 : extension === '.glb' || extension === '.gltf' ? 2 : 3;
    return stagePriority(a.stageIndex) - stagePriority(b.stageIndex)
      || extensionPriority(a.extension) - extensionPriority(b.extension)
      || a.index - b.index;
  });
  return scored.map(({ path: candidate }) => candidate);
}

function findModelInput(asset) {
  return candidateModelPaths(asset)[0] || null;
}

/**
 * Flags de segurança obrigatórias em toda invocação de Blender feita pelo produto.
 *
 * `--disable-autoexec` desliga a execução automática de scripts Python. Sem ela,
 * abrir um `.blend` de origem desconhecida executa o que estiver embutido no
 * arquivo (a preferência "Auto Run Python Scripts" vem ligada em instalações
 * normais): é execução de código de terceiro dentro do processo que o produto
 * iniciou, com o filesystem do usuário ao alcance. Medido antes desta correção:
 * `buildBlenderSpritesheetArgs` produzia `['--background','--python',…]` e
 * `createBlenderSpritesheetPlan` aceitava até `blenderArgs: []`.
 *
 * `--background` mantém o processo sem janela e sem interação.
 *
 * De propósito **não** usamos `--factory-startup`: ele descarta as preferências
 * da pessoa (tema, add-ons, atalhos) e, combinado com auto-save, pode
 * sobrescrever o `userpref.blend` do usuário — efeito colateral irreversível no
 * ambiente de quem usa a máquina. `--disable-autoexec` fecha o vetor sem mexer
 * nas preferências.
 */
const BLENDER_SAFETY_FLAGS = Object.freeze(['--background', '--disable-autoexec']);

/** Args que faltam para a invocação ser segura (vazio = seguro). */
function missingBlenderSafetyFlags(args) {
  const given = new Set((Array.isArray(args) ? args : []).filter((arg) => typeof arg === 'string'));
  return BLENDER_SAFETY_FLAGS.filter((flag) => !given.has(flag));
}

function buildBlenderSpritesheetArgs({ scriptPath, inputPath, outputDirectory, asset, frameSize }) {
  if (!scriptPath || !inputPath || !outputDirectory) throw new Error('Blender adapter: faltam caminhos obrigatórios.');
  if (!['character', 'item'].includes(asset?.type)) throw new Error('Blender adapter: tipo de asset não suportado.');
  const animations = Array.isArray(asset.animations) ? asset.animations.filter((name) => typeof name === 'string' && name.trim()) : [];
  const size = frameSize || parseFrameSize(asset.target);
  return [
    // Ordem importa para o Blender: flags antes do `--python` e dos argumentos do
    // script (que vêm depois de `--`).
    '--background',
    '--disable-autoexec',
    '--python', scriptPath,
    '--',
    '--input', inputPath,
    '--output-dir', outputDirectory,
    '--asset-name', String(asset.name || 'asset').slice(0, 120),
    '--asset-type', asset.type,
    '--frame-width', String(size.width),
    '--frame-height', String(size.height),
    '--animations-json', JSON.stringify(animations),
  ];
}

function validateSpritesheetFiles({ pngBuffer, metadata, frameSize, assetType, animations }) {
  let pngInfo;
  try { pngInfo = validatePngBuffer(pngBuffer, { requireRgba8: true }); } catch (error) {
    throw new Error(`O Blender não produziu um PNG RGBA íntegro: ${error.message}`);
  }
  if (!frameSize || !Number.isInteger(frameSize.width) || !Number.isInteger(frameSize.height)) {
    throw new Error('O tamanho de frame esperado para validar a spritesheet é inválido.');
  }
  const checked = validateSpritesheetManifest(metadata, {
    frameWidth: frameSize.width,
    frameHeight: frameSize.height,
    sheetWidth: pngInfo.width,
    sheetHeight: pngInfo.height,
    columns: 8,
    assetType,
    animations,
  });
  return { sheetWidth: pngInfo.width, sheetHeight: pngInfo.height, frameCount: checked.frameCount };
}

function runProcess(child, { signal, onProgress = async () => {}, stderrLimit = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    let stdoutBuffer = '';
    let settled = false;
    let progressError = null;
    let progressQueue = Promise.resolve();
    const queueProgress = (event) => {
      progressQueue = progressQueue.then(() => onProgress(event)).catch((error) => { progressError ||= error; });
    };
    const cleanup = () => {
      signal?.removeEventListener('abort', abort);
      child.removeListener('error', onError);
      child.removeListener('close', onClose);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const abort = () => {
      try { child.kill('SIGTERM'); } catch { /* process exited between checks */ }
    };
    const onError = (error) => {
      void progressQueue.finally(() => finish(reject, error));
    };
    const onClose = async (code, closeSignal) => {
      await progressQueue;
      if (signal?.aborted) {
        finish(reject, Object.assign(new Error('Renderização cancelada.'), { code: 'WORKFLOW_CANCELLED' }));
      } else if (code !== 0) {
        const detail = stderr.trim().split(/\r?\n/).slice(-12).join('\n');
        finish(reject, new Error(`Blender terminou com código ${code ?? closeSignal ?? 'desconhecido'}.${detail ? `\n${detail}` : ''}`));
      } else if (progressError) {
        finish(reject, progressError);
      } else {
        finish(resolve, { code, stderr: stderr.trim() });
      }
    };

    child.stderr?.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString('utf8')}`.slice(-stderrLimit);
    });
    child.stdout?.on('data', (chunk) => {
      stdoutBuffer = `${stdoutBuffer}${chunk.toString('utf8')}`.slice(-stderrLimit);
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        const match = line.match(/^LIA_FORGE_PROGRESS\s+(\d{1,3})\s+(.*)$/);
        if (match) queueProgress({ progress: Number(match[1]), message: match[2] });
      }
    });
    child.once('error', onError);
    child.once('close', onClose);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

function spawnBlender(executable, args, options = {}) {
  return spawn(executable, args, {
    cwd: options.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
  });
}

module.exports = {
  MODEL_EXTENSIONS,
  BLENDER_SAFETY_FLAGS,
  missingBlenderSafetyFlags,
  buildBlenderSpritesheetArgs,
  candidateModelPaths,
  findModelInput,
  parseFrameSize,
  runProcess,
  spawnBlender,
  validateSpritesheetFiles,
};
