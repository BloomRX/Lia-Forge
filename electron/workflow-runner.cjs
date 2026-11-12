const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { validatePngBuffer } = require('./png-validation.cjs');
const { validateSpritesheetManifest } = require('./spritesheet-manifest.cjs');

const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;
const MAX_GLB_CHUNKS = 1024;

const WORKFLOW_STATUSES = Object.freeze([
  'planned', 'awaiting_authorization', 'running', 'failed', 'awaiting_review', 'validated', 'blocked', 'cancelled',
]);
const STEP_STATUSES = Object.freeze([
  'planned', 'awaiting_authorization', 'running', 'failed', 'awaiting_review', 'validated', 'blocked', 'cancelled',
]);
const MAX_LOG_ENTRIES = 1200;
const MAX_JSON_BYTES = 32 * 1024 * 1024;
const MAX_PNG_BYTES = 128 * 1024 * 1024;
const FORMAT_ALIASES = Object.freeze({ jpeg: 'jpg', 'image/png': 'png', 'model/gltf-binary': 'glb', 'model/gltf+json': 'gltf' });

function cleanMessage(value, limit = 500) {
  return String(value || '')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk-|msy_|tsk_)[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_KEY]')
    .replace(/(https?:\/\/)[^/@\s]+@/gi, '$1[REDACTED]@')
    .replace(/([?&](?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|token|secret|password|authorization|prompt|text)=)[^&#\s]*/gi, '$1[REDACTED]')
    .replace(/((?:--)?(?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|token|secret|password|authorization|prompt|text)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[REDACTED]')
    .replace(/[\r\n\u0000-\u001f]+/g, ' ')
    .slice(0, limit);
}

function cloneSerializable(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizedPlanKey(key) {
  return String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');
}

function isSensitivePlanKey(key) {
  const tokens = normalizedPlanKey(key).split('_').filter(Boolean);
  return tokens.some((token) => [
    'prompt', 'brief', 'text', 'token', 'secret', 'password', 'credential', 'credentials',
    'authorization', 'base64', 'private',
  ].includes(token))
    || tokens.some((token, index) => token === 'key' && ['api', 'private', 'secret'].includes(tokens[index - 1]))
    || (tokens.includes('image') && (tokens.includes('data') || tokens.includes('base64')));
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function normalizeFormat(value) {
  const cleaned = String(value || '').trim().toLowerCase().replace(/^\./, '');
  return FORMAT_ALIASES[cleaned] || cleaned;
}

function formatFromPath(value) {
  return normalizeFormat(path.extname(String(value || '')));
}

function contextValue(context, dottedPath) {
  if (typeof dottedPath !== 'string' || !dottedPath.trim()) return undefined;
  return dottedPath.split('.').reduce((value, part) => {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined;
    return value[part];
  }, context);
}

function isMissingValue(value) {
  return value === undefined || value === null || (typeof value === 'string' && !value.trim())
    || (Array.isArray(value) && value.length === 0);
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function readPrefix(filePath, length = 64) {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function readSuffix(filePath, length = 2) {
  const stat = await fs.stat(filePath);
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, Math.max(0, stat.size - length));
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function readBoundedText(filePath, maxBytes = MAX_JSON_BYTES) {
  const stat = await fs.stat(filePath);
  if (stat.size > maxBytes) throw new Error(`Arquivo excede o limite de validação de ${maxBytes} bytes.`);
  return fs.readFile(filePath, 'utf8');
}

async function readExact(handle, length, position, label) {
  const buffer = Buffer.alloc(length);
  let totalRead = 0;
  while (totalRead < length) {
    const { bytesRead } = await handle.read(buffer, totalRead, length - totalRead, position + totalRead);
    if (bytesRead === 0) throw new Error(`${label}: arquivo truncado.`);
    totalRead += bytesRead;
  }
  return buffer;
}

async function validateGlb(filePath, stat) {
  if (stat.size < 20 || stat.size > 0xffffffff) {
    throw new Error('O GLB é menor que um cabeçalho/chunk JSON válido ou excede o limite do formato.');
  }
  const handle = await fs.open(filePath, 'r');
  try {
    const header = await readExact(handle, 12, 0, 'Cabeçalho GLB');
    if (header.toString('ascii', 0, 4) !== 'glTF'
      || header.readUInt32LE(4) !== 2
      || header.readUInt32LE(8) !== stat.size) {
      throw new Error('O arquivo não tem cabeçalho GLB 2 válido ou o tamanho declarado não corresponde ao disco.');
    }

    let offset = 12;
    let chunkCount = 0;
    let jsonValue = null;
    let hasBinaryChunk = false;
    while (offset < stat.size) {
      if (chunkCount >= MAX_GLB_CHUNKS) throw new Error('O GLB excede o limite de chunks estruturais.');
      if (stat.size - offset < 8) throw new Error('O GLB termina com um cabeçalho de chunk incompleto.');
      const chunkHeader = await readExact(handle, 8, offset, 'Cabeçalho de chunk GLB');
      const chunkLength = chunkHeader.readUInt32LE(0);
      const chunkType = chunkHeader.readUInt32LE(4);
      const chunkStart = offset + 8;
      const chunkEnd = chunkStart + chunkLength;
      if (chunkLength % 4 !== 0 || chunkEnd > stat.size) {
        throw new Error('O GLB contém um chunk desalinhado ou fora do tamanho declarado.');
      }
      if (chunkCount === 0 && chunkType !== GLB_JSON_CHUNK) {
        throw new Error('O primeiro chunk do GLB precisa conter JSON.');
      }
      if (chunkType === GLB_JSON_CHUNK) {
        if (chunkCount !== 0 || jsonValue !== null || chunkLength === 0 || chunkLength > MAX_JSON_BYTES) {
          throw new Error('O chunk JSON do GLB está vazio, duplicado ou excede o limite de validação.');
        }
        const jsonBytes = await readExact(handle, chunkLength, chunkStart, 'Chunk JSON GLB');
        const jsonText = jsonBytes.toString('utf8');
        if (!Buffer.from(jsonText, 'utf8').equals(jsonBytes)) throw new Error('O chunk JSON do GLB não contém UTF-8 válido.');
        try { jsonValue = JSON.parse(jsonText); } catch {
          throw new Error('O primeiro chunk do GLB não contém JSON válido.');
        }
        if (jsonValue?.asset?.version !== '2.0') throw new Error('O JSON interno do GLB precisa declarar asset.version 2.0.');
      } else if (chunkType === GLB_BIN_CHUNK) {
        if (chunkCount !== 1 || jsonValue === null || hasBinaryChunk) {
          throw new Error('O chunk BIN do GLB está duplicado ou fora da posição permitida.');
        }
        hasBinaryChunk = true;
      }
      offset = chunkEnd;
      chunkCount += 1;
    }
    if (offset !== stat.size || chunkCount === 0 || jsonValue === null) {
      throw new Error('O GLB não contém uma sequência completa de chunks.');
    }
    return { validator: 'glb', version: 2, assetVersion: '2.0', chunks: chunkCount, hasBinaryChunk };
  } finally {
    await handle.close();
  }
}

async function resolveProjectFile(projectRoot, candidate, label = 'Artefato') {
  if (typeof projectRoot !== 'string' || !projectRoot.trim()) throw new Error('projectRoot é obrigatório para verificar arquivos de saída.');
  if (typeof candidate !== 'string' || !candidate.trim()) throw new Error(`${label}: caminho ausente.`);
  const root = path.resolve(projectRoot);
  const rootReal = await fs.realpath(root);
  const absolute = path.isAbsolute(candidate) ? path.resolve(candidate) : path.resolve(root, candidate);
  if (!isInside(root, absolute) || absolute === root) throw new Error(`${label} aponta para fora da pasta do projeto.`);
  const linkInfo = await fs.lstat(absolute);
  if (linkInfo.isSymbolicLink()) throw new Error(`${label} precisa ser um arquivo simples, não um link simbólico.`);
  if (!linkInfo.isFile() || linkInfo.size <= 0) throw new Error(`${label} está vazio ou não é um arquivo regular.`);
  const realPath = await fs.realpath(absolute);
  if (!isInside(rootReal, realPath)) throw new Error(`${label} aponta para fora da pasta do projeto.`);
  const stat = await fs.stat(realPath);
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  return { absolute, realPath, relative, stat };
}

function formatsFor(contract) {
  const formats = Array.isArray(contract?.formats) ? contract.formats : contract?.format ? [contract.format] : [];
  return formats.map(normalizeFormat).filter(Boolean);
}

function assertFormatAllowed(format, contract, label) {
  const allowed = formatsFor(contract);
  if (allowed.length && !allowed.includes(format)) {
    throw new Error(`${label}: formato .${format || '(sem extensão)'} não atende ao contrato (${allowed.map((item) => `.${item}`).join(', ')}).`);
  }
}

async function validateFileFormat(filePath, format, validator = '') {
  const check = normalizeFormat(validator || format || 'file');
  const stat = await fs.stat(filePath);
  if (stat.size <= 0) throw new Error('O arquivo está vazio.');

  if (check === 'file' || check === 'non-empty') return { validator: check };
  if (check === 'png' || check === 'png-rgba8') {
    if (stat.size > MAX_PNG_BYTES) throw new Error('O PNG excede o limite de validação estrutural.');
    const png = validatePngBuffer(await fs.readFile(filePath), { requireRgba8: check === 'png-rgba8' });
    return { validator: check, dimensions: { width: png.width, height: png.height }, colorType: png.colorType, bitDepth: png.bitDepth };
  }
  if (check === 'jpg') {
    const [head, tail] = await Promise.all([readPrefix(filePath, 3), readSuffix(filePath, 2)]);
    if (!head.equals(Buffer.from([0xff, 0xd8, 0xff])) || !tail.equals(Buffer.from([0xff, 0xd9]))) throw new Error('O arquivo não tem marcadores JPEG SOI/EOI válidos.');
    return { validator: check };
  }
  if (check === 'webp') {
    const head = await readPrefix(filePath, 12);
    if (head.length < 12 || head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WEBP') throw new Error('O arquivo não tem assinatura WebP válida.');
    return { validator: check };
  }
  if (check === 'image') {
    if (format === 'png' || format === 'jpg' || format === 'webp') return validateFileFormat(filePath, format, format);
    throw new Error(`Formato de imagem não suportado: .${format || 'desconhecido'}.`);
  }
  if (check === 'json' || check === 'gltf-json' || check === 'spritesheet-manifest') {
    const text = await readBoundedText(filePath);
    let value;
    try { value = JSON.parse(text); } catch { throw new Error('O arquivo não contém JSON válido.'); }
    if (check === 'gltf-json' && value?.asset?.version !== '2.0') throw new Error('O glTF JSON precisa declarar asset.version 2.0.');
    if (check === 'spritesheet-manifest') return { validator: check, ...validateSpritesheetManifest(value) };
    return { validator: check };
  }
  if (check === 'gltf') {
    const text = await readBoundedText(filePath);
    let value;
    try { value = JSON.parse(text); } catch { throw new Error('O arquivo não contém JSON glTF válido.'); }
    if (value?.asset?.version !== '2.0') throw new Error('O glTF precisa declarar asset.version 2.0.');
    const references = [
      ...(Array.isArray(value.buffers) ? value.buffers : []),
      ...(Array.isArray(value.images) ? value.images : []),
    ].map((entry) => entry?.uri).filter((uri) => typeof uri === 'string' && uri && !/^data:/i.test(uri));
    const dependencies = new Map();
    const root = path.resolve(path.dirname(filePath));
    for (const uri of references) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(uri) || uri.startsWith('//')) throw new Error('O glTF referencia conteúdo remoto; o artefato não é autocontido no workspace.');
      let decoded;
      try { decoded = decodeURIComponent(uri); } catch { throw new Error(`Recurso glTF contém URI inválida: ${uri}`); }
      const referenced = path.resolve(root, decoded);
      if (!isInside(root, referenced)) throw new Error('O glTF referencia um arquivo fora de sua pasta.');
      const info = await fs.lstat(referenced);
      if (info.isSymbolicLink() || !info.isFile() || info.size <= 0) throw new Error(`Recurso glTF ausente ou inválido: ${uri}`);
      const realReferenced = await fs.realpath(referenced);
      if (!isInside(root, realReferenced)) throw new Error('O glTF referencia um arquivo fora de sua pasta por meio de diretório simbólico.');
      const realInfo = await fs.stat(realReferenced);
      if (!realInfo.isFile() || realInfo.size <= 0) throw new Error(`Recurso glTF ausente ou inválido: ${uri}`);
      const relative = path.relative(root, referenced).split(path.sep).join('/');
      if (!dependencies.has(relative)) {
        dependencies.set(relative, { path: relative, sizeBytes: realInfo.size, sha256: await hashFile(realReferenced) });
      }
    }
    return { validator: check, externalResources: dependencies.size, dependencies: [...dependencies.values()] };
  }
  if (check === 'glb') return validateGlb(filePath, stat);
  if (check === 'blend') {
    const head = await readPrefix(filePath, 7);
    if (head.toString('ascii') !== 'BLENDER') throw new Error('O arquivo não tem assinatura Blender válida.');
    return { validator: check };
  }
  if (check === 'fbx') {
    const head = await readPrefix(filePath, 64);
    const binary = head.subarray(0, 23).toString('binary') === 'Kaydara FBX Binary  \0\x1a\0';
    const ascii = head.toString('utf8').trimStart().startsWith('; FBX');
    if (!binary && !ascii) throw new Error('O arquivo não tem assinatura FBX binária ou textual válida.');
    return { validator: check, encoding: binary ? 'binary' : 'ascii' };
  }
  if (check === 'obj') {
    const text = await readBoundedText(filePath, Math.min(MAX_JSON_BYTES, 64 * 1024 * 1024));
    if (!/^v\s+-?[\d.]+\s+-?[\d.]+\s+-?[\d.]+/m.test(text) || !/^f\s+\S+\s+\S+\s+\S+/m.test(text)) {
      throw new Error('O OBJ precisa conter ao menos um vértice e uma face.');
    }
    return { validator: check };
  }
  if (check === 'stl') {
    const head = await readPrefix(filePath, 512);
    const binaryHeader = await readPrefix(filePath, 84);
    let binary = false;
    if (binaryHeader.length === 84) {
      const triangleCount = binaryHeader.readUInt32LE(80);
      binary = 84 + triangleCount * 50 === stat.size && triangleCount > 0;
    }
    const text = head.toString('utf8');
    const ascii = /^\s*solid\b/i.test(text) && /facet\s+normal/i.test(text);
    if (!binary && !ascii) throw new Error('O arquivo não parece ser um STL ASCII ou binário íntegro.');
    return { validator: check, encoding: binary ? 'binary' : 'ascii' };
  }
  if (check === 'bvh') {
    const text = await readBoundedText(filePath, Math.min(MAX_JSON_BYTES, 64 * 1024 * 1024));
    if (!/HIERARCHY/i.test(text) || !/MOTION/i.test(text)) throw new Error('O BVH precisa conter HIERARCHY e MOTION.');
    return { validator: check };
  }
  if (check === 'gif') {
    const head = await readPrefix(filePath, 6);
    if (!['GIF87a', 'GIF89a'].includes(head.toString('ascii'))) throw new Error('O arquivo não tem assinatura GIF válida.');
    return { validator: check };
  }
  if (check === 'mp4') {
    const head = await readPrefix(filePath, 12);
    if (head.toString('ascii', 4, 8) !== 'ftyp') throw new Error('O arquivo não tem caixa ftyp de MP4.');
    return { validator: check };
  }
  throw new Error(`Validador de formato não suportado: ${check}.`);
}

async function verifyArtifact(projectRoot, candidate, contract = {}) {
  const candidatePath = typeof candidate === 'string' ? candidate : candidate?.path;
  const { absolute, realPath, relative, stat } = await resolveProjectFile(projectRoot, candidatePath, 'Artefato');
  const format = normalizeFormat(candidate?.format || formatFromPath(candidatePath));
  assertFormatAllowed(format, contract, `Artefato ${candidate?.id || relative}`);
  const validator = contract.validator || candidate?.validator || format || 'file';
  const validation = await validateFileFormat(realPath, format, validator);
  const fileHash = await hashFile(realPath);
  const contentHash = Array.isArray(validation.dependencies) && validation.dependencies.length
    ? sha256({ file: fileHash, dependencies: validation.dependencies })
    : fileHash;
  return {
    id: typeof candidate?.id === 'string' ? candidate.id : null,
    path: relative,
    format,
    sizeBytes: stat.size,
    sha256: contentHash,
    validator: normalizeFormat(validator),
    validation,
    validatedAt: new Date().toISOString(),
    absolutePath: absolute,
  };
}

function validateContractList(value, stepId, kind) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 30) throw new Error(`Workflow inválido: ${kind} da etapa ${stepId} deve ser uma lista de até 30 contratos.`);
  const ids = new Set();
  for (const contract of value) {
    if (!contract || typeof contract.id !== 'string' || !contract.id.trim() || ids.has(contract.id)) {
      throw new Error(`Workflow inválido: id de contrato ${kind} ausente ou duplicado na etapa ${stepId}.`);
    }
    if (contract.required !== undefined && typeof contract.required !== 'boolean') throw new Error(`Workflow inválido: required inválido no contrato ${contract.id}.`);
    if (contract.formats !== undefined && (!Array.isArray(contract.formats) || contract.formats.some((item) => typeof item !== 'string'))) {
      throw new Error(`Workflow inválido: formats inválido no contrato ${contract.id}.`);
    }
    if (contract.format !== undefined && typeof contract.format !== 'string') throw new Error(`Workflow inválido: format inválido no contrato ${contract.id}.`);
    if (contract.validator !== undefined && typeof contract.validator !== 'string') throw new Error(`Workflow inválido: validator inválido no contrato ${contract.id}.`);
    ids.add(contract.id);
  }
}

function validatePlan(plan, adapters) {
  if (!plan || typeof plan !== 'object' || typeof plan.workflowId !== 'string' || !plan.workflowId.trim()) {
    throw new Error('Workflow inválido: informe workflowId.');
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0 || plan.steps.length > 30) {
    throw new Error('Workflow inválido: steps precisa ter entre 1 e 30 etapas.');
  }
  const seen = new Set();
  for (const [index, step] of plan.steps.entries()) {
    if (!step || typeof step.id !== 'string' || !step.id.trim() || seen.has(step.id)) {
      throw new Error(`Workflow inválido: id da etapa ${index + 1} ausente ou repetido.`);
    }
    if (typeof step.adapter !== 'string' || !step.adapter.trim()) throw new Error(`Workflow inválido: adapter ausente na etapa ${step.id}.`);
    if (typeof adapters[step.adapter] !== 'function' && !(typeof step.blockedReason === 'string' && step.blockedReason.trim())) {
      throw new Error(`Adapter indisponível para a etapa ${step.id}: ${step.adapter || '(não informado)'}.`);
    }
    const dependencies = Array.isArray(step.dependsOn) ? step.dependsOn : [];
    for (const dependency of dependencies) {
      if (!seen.has(dependency)) throw new Error(`Dependência ${dependency} precisa aparecer antes de ${step.id}.`);
    }
    validateContractList(step.inputContracts, step.id, 'inputContracts');
    validateContractList(step.outputContracts, step.id, 'outputContracts');
    if (step.reviewRequired !== undefined && typeof step.reviewRequired !== 'boolean') throw new Error(`Workflow inválido: reviewRequired inválido na etapa ${step.id}.`);
    if (step.authorization !== undefined) {
      if (!step.authorization || typeof step.authorization !== 'object' || typeof step.authorization.required !== 'boolean') {
        throw new Error(`Workflow inválido: authorization.required inválido na etapa ${step.id}.`);
      }
      if (step.authorization.actions !== undefined && (!Array.isArray(step.authorization.actions) || step.authorization.actions.some((action) => typeof action !== 'string'))) {
        throw new Error(`Workflow inválido: authorization.actions inválido na etapa ${step.id}.`);
      }
    }
    seen.add(step.id);
  }
  return true;
}

function sanitizeExecution(execution) {
  if (!execution || typeof execution !== 'object') return null;
  const kind = cleanMessage(execution.kind || 'unknown', 30);
  if (kind === 'process') {
    const args = Array.isArray(execution.args) ? execution.args.slice(0, 100).map((arg, index, values) => {
      const previous = String(values[index - 1] || '').toLowerCase();
      if (/token|secret|password|api[-_]?key|authorization|prompt|text/.test(previous)) return '[REDACTED]';
      return cleanMessage(arg, 1000);
    }) : [];
    return {
      kind,
      executable: cleanMessage(execution.executable, 1000),
      args,
      cwd: cleanMessage(execution.cwd, 1000),
    };
  }
  if (kind === 'http') {
    let host = cleanMessage(execution.host || '', 255);
    if (execution.url) {
      try { host = new URL(execution.url).host; } catch { host = '[invalid-url]'; }
    }
    return {
      kind,
      method: cleanMessage(execution.method || 'POST', 12).toUpperCase(),
      host,
      route: cleanMessage(execution.route || '', 120),
      provider: cleanMessage(execution.provider || '', 80),
      taskId: cleanMessage(execution.taskId || '', 120),
    };
  }
  return { kind, label: cleanMessage(execution.label || '', 160) };
}

function makeStepSnapshot(stepPlan) {
  return {
    id: stepPlan.id,
    title: cleanMessage(stepPlan.title || stepPlan.id, 120),
    adapter: stepPlan.adapter,
    status: 'planned',
    progress: 0,
    note: '',
    inputs: [],
    outputs: [],
    artifacts: [],
    validations: [],
    execution: sanitizeExecution(stepPlan.execution),
    inputFingerprint: null,
    startedAt: null,
    completedAt: null,
    validatedAt: null,
    review: null,
    authorization: null,
    error: null,
  };
}

function sanitizePlanValue(value, key = '') {
  if (isSensitivePlanKey(key)) {
    return typeof value === 'string' ? `[REDACTED sha256:${sha256(value)}]` : '[REDACTED]';
  }
  if (typeof value === 'string') return cleanMessage(value, 1000);
  if (Array.isArray(value)) return value.map((item) => sanitizePlanValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, sanitizePlanValue(child, childKey)]));
  }
  return value;
}

function sanitizeAuthorizationCost(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const amount = typeof value.amount === 'number' && Number.isFinite(value.amount) ? value.amount : null;
  return {
    amount,
    unit: cleanMessage(value.unit || 'unknown', 40),
    known: value.known === true && amount !== null,
    ...(value.note ? { note: cleanMessage(value.note, 200) } : {}),
  };
}

function snapshotPlan(plan) {
  const snapshot = sanitizePlanValue(plan);
  snapshot.steps = plan.steps.map((step) => ({
    ...sanitizePlanValue(step),
    ...(step.execution ? { execution: sanitizeExecution(step.execution) } : {}),
    ...(step.authorization ? {
      authorization: {
        ...sanitizePlanValue(step.authorization),
        summary: cleanMessage(step.authorization.summary || '', 500),
        data: cleanMessage(step.authorization.data || '', 500),
        destination: cleanMessage(step.authorization.destination || '', 255),
        estimatedCost: sanitizeAuthorizationCost(step.authorization.estimatedCost),
      },
    } : {}),
  }));
  return snapshot;
}

function makeRun(plan, id = plan.id || randomUUID()) {
  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: 2,
    workflowId: plan.workflowId,
    assetId: String(plan.assetId || ''),
    status: 'planned',
    progress: 0,
    createdAt: now,
    updatedAt: now,
    resumedFrom: null,
    resumeFrom: null,
    reusedSteps: [],
    plan: snapshotPlan(plan),
    steps: plan.steps.map(makeStepSnapshot),
    artifacts: [],
    authorizations: [],
    logs: [],
    result: null,
    error: null,
  };
}

function addLog(run, { event, stepId = null, message = '', details = null } = {}) {
  run.logs.push({
    at: new Date().toISOString(),
    event: cleanMessage(event || 'event', 60),
    stepId: stepId || null,
    message: cleanMessage(message || event || '', 500),
    ...(details ? { details: cloneSerializable(details) } : {}),
  });
  if (run.logs.length > MAX_LOG_ENTRIES) run.logs.splice(0, run.logs.length - MAX_LOG_ENTRIES);
}

function computeRunProgress(run) {
  if (!run.steps.length) return 0;
  const total = run.steps.reduce((sum, step) => sum + (step.status === 'validated' || step.status === 'awaiting_review' ? 100 : step.progress || 0), 0);
  return Math.round(total / run.steps.length);
}

function inputSummary(input) {
  const summary = { id: input.id, kind: input.kind };
  if (input.path) summary.path = input.path;
  if (input.format) summary.format = input.format;
  if (Number.isFinite(input.sizeBytes)) summary.sizeBytes = input.sizeBytes;
  if (input.sha256) summary.sha256 = input.sha256;
  if (input.valueHash) summary.valueHash = input.valueHash;
  if (input.sourceStep) summary.sourceStep = input.sourceStep;
  return summary;
}

async function verifyInputFile(context, pathValue, contract, label) {
  const checked = await verifyArtifact(context.projectRoot, { path: pathValue, format: formatFromPath(pathValue) }, contract);
  return {
    path: checked.path,
    format: checked.format,
    sizeBytes: checked.sizeBytes,
    sha256: checked.sha256,
    validator: checked.validator,
  };
}

function validateContextType(value, contract) {
  const expected = contract.valueType;
  if (!expected) return;
  if (expected === 'string' && typeof value !== 'string') throw new Error(`Entrada ${contract.id} precisa ser texto.`);
  if (expected === 'array' && !Array.isArray(value)) throw new Error(`Entrada ${contract.id} precisa ser uma lista.`);
  if (expected === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) throw new Error(`Entrada ${contract.id} precisa ser um objeto.`);
}

async function resolveStepInputs(stepPlan, context, availableArtifacts) {
  const resolved = [];
  for (const contract of stepPlan.inputContracts || []) {
    const required = contract.required !== false;
    const kind = contract.kind || 'context';
    if (kind === 'context') {
      const value = contextValue(context, contract.contextKey || contract.source);
      if (required && isMissingValue(value)) throw new Error(`Entrada obrigatória ausente: ${contract.id}.`);
      if (!isMissingValue(value)) validateContextType(value, contract);
      const valueHash = isMissingValue(value) ? null : sha256(value);
      resolved.push({ id: contract.id, kind, value, valueHash, source: contract.contextKey || contract.source || null });
      continue;
    }
    if (kind === 'artifact') {
      const artifact = availableArtifacts.find((item) => item.id === contract.artifactId && (!contract.fromStep || item.stepId === contract.fromStep));
      if (!artifact) {
        if (required) throw new Error(`Artefato de entrada obrigatório ausente: ${contract.fromStep || '?'}:${contract.artifactId || contract.id}.`);
        resolved.push({ id: contract.id, kind, value: null, sourceStep: contract.fromStep || null });
        continue;
      }
      const checked = await verifyInputFile(context, artifact.path, contract, `Entrada ${contract.id}`);
      if (artifact.sha256 && checked.sha256 !== artifact.sha256) throw new Error(`O artefato ${artifact.path} mudou depois de ser validado; etapa dependente bloqueada.`);
      resolved.push({ id: contract.id, kind, value: { ...artifact, ...checked }, sourceStep: artifact.stepId, ...checked });
      continue;
    }
    if (kind === 'file') {
      const pathValue = contract.path || contextValue(context, contract.contextKey || contract.source);
      if (required && isMissingValue(pathValue)) throw new Error(`Arquivo de entrada obrigatório ausente: ${contract.id}.`);
      if (isMissingValue(pathValue)) {
        resolved.push({ id: contract.id, kind, value: null });
        continue;
      }
      const checked = await verifyInputFile(context, pathValue, contract, `Entrada ${contract.id}`);
      resolved.push({ id: contract.id, kind, value: { ...checked }, ...checked });
      continue;
    }
    if (kind === 'files') {
      const rawFiles = contextValue(context, contract.contextKey || contract.source);
      const candidates = (Array.isArray(rawFiles) ? rawFiles : []).filter((item) => !Number.isInteger(contract.filterStageIndex) || item?.stageIndex === contract.filterStageIndex);
      if (required && candidates.length === 0) throw new Error(`Lista de arquivos de entrada obrigatória ausente: ${contract.id}.`);
      const checkedFiles = [];
      for (const item of candidates) {
        const pathValue = typeof item === 'string' ? item : item?.path;
        if (!pathValue) throw new Error(`Um dos arquivos da entrada ${contract.id} não contém path.`);
        const checked = await verifyInputFile(context, pathValue, contract, `Entrada ${contract.id}`);
        checkedFiles.push({ ...checked, stageIndex: item?.stageIndex });
      }
      resolved.push({ id: contract.id, kind, value: checkedFiles, files: checkedFiles });
      continue;
    }
    throw new Error(`Tipo de entrada não suportado para ${contract.id}: ${kind}.`);
  }
  return resolved;
}

function stepFingerprint(workflowId, stepPlan, resolvedInputs) {
  const inputMetadata = resolvedInputs.map(inputSummary);
  return sha256({
    workflowId,
    step: {
      id: stepPlan.id,
      adapter: stepPlan.adapter,
      provider: stepPlan.provider || null,
      version: stepPlan.version || null,
      parameters: stepPlan.parameters || null,
      authorization: stepPlan.authorization || null,
      inputContracts: stepPlan.inputContracts || [],
      outputContracts: stepPlan.outputContracts || [],
    },
    inputs: inputMetadata,
  });
}

function outputContractFor(candidate, stepPlan, claimed) {
  const contracts = stepPlan.outputContracts || [];
  if (!contracts.length) return { contract: {}, index: -1 };
  const candidateId = typeof candidate?.id === 'string' ? candidate.id : null;
  const format = normalizeFormat(candidate?.format || formatFromPath(candidate?.path || candidate));
  let index = candidateId ? contracts.findIndex((item, i) => item.id === candidateId && !claimed.has(i)) : -1;
  if (index < 0) index = contracts.findIndex((item, i) => !claimed.has(i) && formatsFor(item).includes(format));
  if (index < 0) throw new Error(`Output inesperado para o contrato da etapa ${stepPlan.id}: ${candidateId || candidate?.path || candidate}.`);
  claimed.add(index);
  return { contract: contracts[index], index };
}

async function validateStepOutputs(stepPlan, result, context, run) {
  const rawOutputs = Array.isArray(result?.artifacts) ? result.artifacts : result?.outputs;
  if (!Array.isArray(rawOutputs) || rawOutputs.length === 0) {
    throw new Error(`O adapter ${stepPlan.adapter} não retornou artefatos reais para validar.`);
  }
  const claimed = new Set();
  const validated = [];
  for (const output of rawOutputs) {
    const candidate = typeof output === 'string' ? { path: output } : output;
    if (!candidate || typeof candidate.path !== 'string' || !candidate.path.trim()) throw new Error(`O adapter ${stepPlan.adapter} retornou um artefato sem path.`);
    const { contract } = outputContractFor(candidate, stepPlan, claimed);
    let info;
    try {
      info = await verifyArtifact(context.projectRoot, candidate, contract);
    } catch (error) {
      const root = path.resolve(context.projectRoot);
      const candidateAbsolute = path.resolve(root, candidate.path);
      const displayPath = isInside(root, candidateAbsolute)
        ? path.relative(root, candidateAbsolute).split(path.sep).join('/')
        : path.basename(candidate.path);
      const format = normalizeFormat(candidate.format || formatFromPath(candidate.path));
      const validator = normalizeFormat(contract.validator || candidate.validator || format || 'file');
      const step = run.steps.find((item) => item.id === stepPlan.id);
      step?.validations.push({
        artifactId: contract.id || candidate.id || null,
        path: displayPath,
        format,
        validator,
        attemptedAt: new Date().toISOString(),
        result: 'failed',
        details: cleanMessage(error.message || error, 500),
      });
      addLog(run, {
        event: 'artifact-validation-failed',
        stepId: stepPlan.id,
        message: `Falha ao validar ${path.basename(candidate.path)}: ${error.message || error}`,
        details: { path: displayPath, format, validator },
      });
      throw error;
    }
    validated.push({
      id: contract.id || info.id || `output-${validated.length + 1}`,
      stepId: stepPlan.id,
      path: info.path,
      format: info.format,
      sizeBytes: info.sizeBytes,
      sha256: info.sha256,
      validator: info.validator,
      validation: info.validation,
      validatedAt: info.validatedAt,
    });
  }
  run.artifacts.push(...validated);
  for (const [index, contract] of (stepPlan.outputContracts || []).entries()) {
    if (contract.required !== false && !claimed.has(index)) throw new Error(`Output obrigatório ausente: ${stepPlan.id}:${contract.id}.`);
  }
  return validated;
}

function summarizeResolvedInputs(resolvedInputs) {
  return resolvedInputs.map(inputSummary);
}

function authorizationScope(stepPlan, step) {
  const authorization = stepPlan.authorization || { required: false, actions: [] };
  return {
    stepId: stepPlan.id,
    adapter: stepPlan.adapter,
    actions: Array.isArray(authorization.actions) ? authorization.actions.map((item) => cleanMessage(item, 80)) : [],
    summary: cleanMessage(authorization.summary || '', 500),
    data: cleanMessage(authorization.data || '', 500),
    destination: cleanMessage(authorization.destination || '', 255),
    estimatedCost: sanitizeAuthorizationCost(authorization.estimatedCost),
    inputFingerprint: step.inputFingerprint,
  };
}

class WorkflowRunner {
  constructor({ adapters = {}, persist = async () => {}, onEvent = () => {} } = {}) {
    this.adapters = adapters;
    this.persist = persist;
    this.onEvent = onEvent;
    this.runs = new Map();
    this.activeRunId = null;
  }

  snapshot(run) {
    return cloneSerializable(run);
  }

  async publish(run, event, step = null, message = '') {
    addLog(run, { event, stepId: step?.id || null, message: message || event, details: step?.execution ? { execution: step.execution } : null });
    run.updatedAt = new Date().toISOString();
    const snapshot = this.snapshot(run);
    try { await this.persist(snapshot); } catch (error) {
      throw new Error(`Não foi possível persistir o estado do workflow: ${error.message || error}`);
    }
    try { this.onEvent({ event, run: snapshot, stepId: step?.id || null }); } catch { /* UI event delivery is best-effort. */ }
  }

  async run(plan, context = {}) {
    validatePlan(plan, this.adapters);
    if (this.activeRunId) throw new Error('Já existe um workflow executando nesta instância.');
    const run = makeRun(plan);
    const entry = { run, plan: cloneSerializable(plan), context, controller: null, authorizations: new Map() };
    this.runs.set(run.id, entry);
    this.activeRunId = run.id;
    try {
      await this.publish(run, 'run-planned', null, 'Plano validado; nenhuma etapa foi executada ainda.');
      return await this.execute(entry, 0, { resumed: false });
    } catch (error) {
      if (error?.run) throw error;
      const active = run.steps.find((step) => step.status === 'running' || step.status === 'planned');
      this.recordFailure(run, active, error);
      try { await this.publish(run, `run-${run.status}`, active, run.error); } catch { /* Preserve the original execution error when persistence is unavailable. */ }
      throw Object.assign(new Error(run.error || error.message || 'Workflow falhou.'), { code: error?.code || 'WORKFLOW_FAILED', run: this.snapshot(run) });
    } finally {
      if (this.activeRunId === run.id) this.activeRunId = null;
    }
  }

  async execute(entry, startIndex, { resumed = false } = {}) {
    const { run, plan, context } = entry;
    if (this.activeRunId && this.activeRunId !== run.id) throw new Error('Já existe um workflow executando nesta instância.');
    this.activeRunId = run.id;
    entry.controller = new AbortController();
    const controller = entry.controller;
    run.status = 'running';
    run.error = null;

    try {
      await this.publish(run, resumed ? 'run-resumed' : 'run-started', null, resumed ? `Retomando a partir da etapa ${plan.steps[startIndex]?.id || 'final'}.` : 'Execução iniciada pelo usuário.');
      for (let index = startIndex; index < plan.steps.length; index += 1) {
        const stepPlan = plan.steps[index];
        const step = run.steps[index];
        if (step.status === 'validated') continue;
        if (controller.signal.aborted) throw Object.assign(new Error('Workflow cancelado pelo usuário.'), { code: 'WORKFLOW_CANCELLED' });
        if (stepPlan.blockedReason) throw Object.assign(new Error(stepPlan.blockedReason), { code: 'WORKFLOW_BLOCKED' });

        const resolvedInputs = await resolveStepInputs(stepPlan, context, run.artifacts);
        step.inputs = summarizeResolvedInputs(resolvedInputs);
        step.inputFingerprint = stepFingerprint(plan.workflowId, stepPlan, resolvedInputs);
        const authorization = stepPlan.authorization || { required: false };
        const granted = entry.authorizations.get(stepPlan.id);
        if (authorization.required && granted && granted.inputFingerprint !== step.inputFingerprint) {
          entry.authorizations.delete(stepPlan.id);
          step.status = 'awaiting_authorization';
          step.authorization = {
            status: 'awaiting_authorization',
            scope: authorizationScope(stepPlan, step),
            requestedAt: new Date().toISOString(),
            previousApprovalInvalidatedAt: new Date().toISOString(),
          };
          run.status = 'awaiting_authorization';
          run.progress = computeRunProgress(run);
          run.resumeFrom = stepPlan.id;
          await this.publish(run, 'authorization-scope-changed', step, 'Os dados, o destino ou o plano mudaram depois da aprovação; é necessária uma nova autorização.');
          return this.snapshot(run);
        }
        if (authorization.required && !granted) {
          step.status = 'awaiting_authorization';
          step.authorization = { status: 'awaiting_authorization', scope: authorizationScope(stepPlan, step), requestedAt: new Date().toISOString() };
          run.status = 'awaiting_authorization';
          run.progress = computeRunProgress(run);
          run.resumeFrom = stepPlan.id;
          await this.publish(run, 'authorization-required', step, authorization.summary || 'Aguardando aprovação explícita antes de executar.');
          return this.snapshot(run);
        }

        step.status = 'running';
        step.startedAt ||= new Date().toISOString();
        step.execution ||= sanitizeExecution(stepPlan.execution);
        step.note = cleanMessage(stepPlan.note || `Executando adapter ${stepPlan.adapter}.`);
        run.progress = computeRunProgress(run);
        await this.publish(run, 'step-started', step, step.note);

        const adapter = this.adapters[stepPlan.adapter];
        if (typeof adapter !== 'function') throw Object.assign(new Error(`Adapter indisponível para a etapa ${stepPlan.id}: ${stepPlan.adapter}.`), { code: 'WORKFLOW_BLOCKED' });
        const inputsById = Object.fromEntries(resolvedInputs.map((input) => [input.id, input.value]));
        const result = await adapter({
          ...context,
          step: cloneSerializable(stepPlan),
          run: this.snapshot(run),
          inputs: resolvedInputs,
          inputsById,
          artifacts: cloneSerializable(run.artifacts),
          signal: controller.signal,
          reportProgress: async ({ progress, message }) => {
            if (controller.signal.aborted) return;
            step.progress = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : step.progress;
            step.note = cleanMessage(message || step.note);
            run.progress = computeRunProgress(run);
            await this.publish(run, 'step-progress', step, step.note);
          },
        });
        if (controller.signal.aborted) throw Object.assign(new Error('Workflow cancelado pelo usuário.'), { code: 'WORKFLOW_CANCELLED' });

        const validatedArtifacts = await validateStepOutputs(stepPlan, result, context, run);
        const inputsAfterExecution = await resolveStepInputs(
          stepPlan,
          context,
          run.artifacts.filter((artifact) => artifact.stepId !== stepPlan.id),
        );
        const fingerprintAfterExecution = stepFingerprint(plan.workflowId, stepPlan, inputsAfterExecution);
        if (fingerprintAfterExecution !== step.inputFingerprint) {
          throw new Error('Uma ou mais entradas mudaram durante a execução; outputs validados foram preservados, mas a etapa não foi marcada como concluída.');
        }
        step.status = stepPlan.reviewRequired ? 'awaiting_review' : 'validated';
        step.progress = 100;
        step.outputs = validatedArtifacts.map((artifact) => artifact.path);
        step.artifacts = validatedArtifacts.map((artifact) => ({ ...artifact }));
        step.validations = validatedArtifacts.map((artifact) => ({
          artifactId: artifact.id,
          path: artifact.path,
          format: artifact.format,
          validator: artifact.validator,
          sizeBytes: artifact.sizeBytes,
          sha256: artifact.sha256,
          validatedAt: artifact.validatedAt,
          result: 'passed',
          details: artifact.validation,
        }));
        step.execution = sanitizeExecution(result?.execution || stepPlan.execution) || step.execution;
        step.note = cleanMessage(result.note || (stepPlan.reviewRequired ? 'Artefatos verificados estruturalmente; aguardando revisão humana.' : 'Artefatos reais verificados no disco.'));
        step.completedAt = new Date().toISOString();
        if (step.status === 'validated') step.validatedAt = step.completedAt;
        if (stepPlan.reviewRequired) {
          step.review = { status: 'awaiting_review', required: true, requestedAt: step.completedAt, note: '' };
          run.status = 'awaiting_review';
          run.resumeFrom = stepPlan.id;
          run.progress = computeRunProgress(run);
          run.result = this.resultFor(run);
          await this.publish(run, 'review-required', step, step.note);
          return this.snapshot(run);
        }

        run.progress = computeRunProgress(run);
        await this.publish(run, 'step-validated', step, step.note);
      }
      run.status = 'validated';
      run.progress = 100;
      run.resumeFrom = null;
      run.result = this.resultFor(run);
      await this.publish(run, 'run-validated', null, 'Todas as etapas foram executadas e seus artefatos foram verificados.');
      return this.snapshot(run);
    } catch (error) {
      const step = run.steps.find((candidate) => candidate.status === 'running' || candidate.status === 'planned');
      this.recordFailure(run, step, error);
      try { await this.publish(run, `run-${run.status}`, step, run.error); } catch { /* Preserve the execution error. */ }
      throw Object.assign(new Error(run.error || error.message || 'Workflow falhou.'), { code: error?.code || 'WORKFLOW_FAILED', run: this.snapshot(run) });
    } finally {
      if (this.activeRunId === run.id) this.activeRunId = null;
      entry.controller = null;
    }
  }

  resultFor(run) {
    return {
      outputs: run.artifacts.map((artifact) => artifact.path),
      artifacts: cloneSerializable(run.artifacts),
    };
  }

  recordFailure(run, step, error) {
    const cancelled = error?.code === 'WORKFLOW_CANCELLED';
    const blocked = error?.code === 'WORKFLOW_BLOCKED';
    run.status = cancelled ? 'cancelled' : blocked ? 'blocked' : 'failed';
    if (step) {
      const preservedArtifacts = run.artifacts.filter((artifact) => artifact.stepId === step.id);
      if (preservedArtifacts.length) {
        step.artifacts = cloneSerializable(preservedArtifacts);
        step.outputs = [...new Set([...(step.outputs || []), ...preservedArtifacts.map((artifact) => artifact.path)])];
        for (const artifact of preservedArtifacts) {
          if (step.validations.some((validation) => validation.path === artifact.path && validation.result === 'passed')) continue;
          step.validations.push({
            artifactId: artifact.id,
            path: artifact.path,
            format: artifact.format,
            validator: artifact.validator,
            sizeBytes: artifact.sizeBytes,
            sha256: artifact.sha256,
            validatedAt: artifact.validatedAt,
            result: 'passed',
            details: artifact.validation,
            partial: true,
          });
        }
      }
    }
    if (step && (step.status === 'running' || step.status === 'planned')) {
      step.status = run.status;
      step.error = cleanMessage(error?.message || error);
      step.note = step.error;
      step.completedAt = new Date().toISOString();
    }
    if (error?.promptId || error?.taskId) {
      if (step) step.externalTaskId = cleanMessage(error.promptId || error.taskId, 120);
    }
    run.error = cleanMessage(error?.message || error || 'Workflow falhou.');
    run.updatedAt = new Date().toISOString();
    run.progress = computeRunProgress(run);
    addLog(run, { event: `run-${run.status}`, stepId: step?.id || null, message: run.error, details: step?.execution ? { execution: step.execution } : null });
  }

  async authorize(runId, stepId, decision = {}) {
    const entry = this.runs.get(runId);
    if (!entry) throw new Error('Execução não encontrada nesta sessão.');
    if (entry.run.status !== 'awaiting_authorization' || entry.run.resumeFrom !== stepId) throw new Error('A etapa não está aguardando autorização.');
    if (this.activeRunId) throw new Error('Outra execução está ativa; aguarde antes de autorizar.');
    const index = entry.plan.steps.findIndex((item) => item.id === stepId);
    const stepPlan = entry.plan.steps[index];
    const step = entry.run.steps[index];
    if (decision.approved !== true) {
      step.status = 'blocked';
      step.authorization = { ...step.authorization, status: 'denied', decidedAt: new Date().toISOString(), decision: 'denied' };
      step.note = cleanMessage(decision.note || 'A autorização foi recusada; nenhuma ação protegida foi executada.');
      entry.run.status = 'blocked';
      entry.run.error = step.note;
      entry.run.resumeFrom = step.id;
      entry.run.progress = computeRunProgress(entry.run);
      await this.publish(entry.run, 'authorization-denied', step, step.note);
      return this.snapshot(entry.run);
    }

    const grantedAt = new Date().toISOString();
    const scope = authorizationScope(stepPlan, step);
    const grant = {
      ...scope,
      status: 'approved',
      approvedAt: grantedAt,
      approvedBy: cleanMessage(decision.approvedBy || 'explicit-user-confirmation', 80),
      note: cleanMessage(decision.note || '', 300),
    };
    entry.authorizations.set(stepId, grant);
    entry.run.authorizations.push(grant);
    step.authorization = { ...step.authorization, status: 'approved', approvedAt: grantedAt, decision: 'approved', scope };
    step.status = 'planned';
    step.note = 'Autorização registrada; iniciando a etapa aprovada.';
    entry.run.status = 'planned';
    entry.run.error = null;
    this.activeRunId = runId;
    try {
      await this.publish(entry.run, 'authorization-approved', step, step.note);
      return await this.execute(entry, index, { resumed: true });
    } catch (error) {
      if (this.activeRunId === runId && !entry.controller) this.activeRunId = null;
      throw error;
    }
  }

  async review(runId, stepId, decision = {}) {
    const entry = this.runs.get(runId);
    if (!entry) throw new Error('Execução não encontrada nesta sessão.');
    if (entry.run.status !== 'awaiting_review' || entry.run.resumeFrom !== stepId) throw new Error('A etapa não está aguardando revisão.');
    if (this.activeRunId) throw new Error('Outra execução está ativa; aguarde antes de revisar.');
    this.activeRunId = runId;
    try {
    const index = entry.plan.steps.findIndex((item) => item.id === stepId);
    const stepPlan = entry.plan.steps[index];
    const step = entry.run.steps[index];
    const reviewedAt = new Date().toISOString();
    const approved = decision.approved === true;
    step.review = {
      status: approved ? 'approved' : 'rejected',
      required: true,
      decidedAt: reviewedAt,
      note: cleanMessage(decision.note || '', 500),
      approvedBy: cleanMessage(decision.approvedBy || 'explicit-user-review', 80),
    };
    if (!approved) {
      step.status = 'failed';
      step.error = cleanMessage(decision.note || 'A revisão humana rejeitou os artefatos; eles foram preservados para inspeção.');
      step.note = step.error;
      entry.run.status = 'failed';
      entry.run.error = step.error;
      entry.run.updatedAt = reviewedAt;
      entry.run.progress = computeRunProgress(entry.run);
      entry.run.resumeFrom = step.id;
      await this.publish(entry.run, 'review-rejected', step, step.error);
      return this.snapshot(entry.run);
    }

    const claimed = new Set();
    const verifiedArtifacts = [];
    try {
      for (const oldArtifact of step.artifacts || []) {
        const candidate = { id: oldArtifact.id, path: oldArtifact.path, format: oldArtifact.format, validator: oldArtifact.validator };
        const { contract } = outputContractFor(candidate, stepPlan, claimed);
        const verified = await verifyArtifact(entry.context.projectRoot, candidate, contract);
        if (!oldArtifact.sha256 || verified.sha256 !== oldArtifact.sha256) throw new Error('O checksum do artefato mudou depois da revisão solicitada.');
        verifiedArtifacts.push({
          id: contract.id || verified.id || `output-${verifiedArtifacts.length + 1}`,
          stepId: stepPlan.id,
          path: verified.path,
          format: verified.format,
          sizeBytes: verified.sizeBytes,
          sha256: verified.sha256,
          validator: verified.validator,
          validation: verified.validation,
          validatedAt: verified.validatedAt,
        });
      }
      for (const [contractIndex, contract] of (stepPlan.outputContracts || []).entries()) {
        if (contract.required !== false && !claimed.has(contractIndex)) throw new Error(`Output obrigatório ausente na revisão: ${stepPlan.id}:${contract.id}.`);
      }
    } catch (error) {
      step.review = { ...step.review, status: 'invalidated', note: cleanMessage(error.message || error, 500) };
      step.status = 'failed';
      step.error = cleanMessage(error.message || error);
      step.note = step.error;
      entry.run.status = 'failed';
      entry.run.error = step.error;
      entry.run.updatedAt = new Date().toISOString();
      entry.run.progress = computeRunProgress(entry.run);
      entry.run.resumeFrom = step.id;
      await this.publish(entry.run, 'review-invalidated', step, 'Os artefatos mudaram ou deixaram de atender ao contrato; aprovação negada.');
      return this.snapshot(entry.run);
    }

    step.artifacts = verifiedArtifacts;
    step.outputs = verifiedArtifacts.map((artifact) => artifact.path);
    step.validations = verifiedArtifacts.map((artifact) => ({
      artifactId: artifact.id,
      path: artifact.path,
      format: artifact.format,
      validator: artifact.validator,
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
      validatedAt: artifact.validatedAt,
      result: 'passed',
      details: artifact.validation,
      reviewed: true,
    }));
    entry.run.artifacts = entry.run.artifacts.filter((artifact) => artifact.stepId !== step.id).concat(verifiedArtifacts);
    step.status = 'validated';
    step.validatedAt = reviewedAt;
    step.note = cleanMessage(decision.note || 'Revisão humana aprovada após nova validação dos arquivos.');
    entry.run.status = 'planned';
    entry.run.error = null;
    entry.run.progress = computeRunProgress(entry.run);
    entry.run.resumeFrom = null;
    this.activeRunId = runId;
    try {
      await this.publish(entry.run, 'review-approved', step, step.note);
      return await this.execute(entry, index + 1, { resumed: true });
    } catch (error) {
      if (this.activeRunId === runId && !entry.controller) this.activeRunId = null;
      throw error;
    }
    } finally {
      if (this.activeRunId === runId && !entry.controller) this.activeRunId = null;
    }
  }

  async resume(plan, previousRun, context = {}, options = {}) {
    validatePlan(plan, this.adapters);
    if (!previousRun || previousRun.workflowId !== plan.workflowId || !Array.isArray(previousRun.steps)) {
      throw new Error('Não é possível retomar: a execução anterior não corresponde a este plano.');
    }
    if (this.activeRunId) throw new Error('Já existe um workflow executando nesta instância.');
    const run = makeRun(plan, options.id || randomUUID());
    run.resumedFrom = previousRun.id || null;
    const entry = { run, plan: cloneSerializable(plan), context, controller: null, authorizations: new Map() };
    this.runs.set(run.id, entry);
    this.activeRunId = run.id;
    try {
    let firstUnreusable = 0;
    for (let index = 0; index < plan.steps.length; index += 1) {
      const stepPlan = plan.steps[index];
      const step = run.steps[index];
      const oldStep = previousRun.steps.find((candidate) => candidate.id === stepPlan.id);
      if (index > 0 && firstUnreusable < index) break;
      if (!oldStep || oldStep.status !== 'validated' || !Array.isArray(oldStep.artifacts) || oldStep.artifacts.length === 0) {
        firstUnreusable = index;
        break;
      }
      try {
        const resolvedInputs = await resolveStepInputs(stepPlan, context, run.artifacts);
        const fingerprint = stepFingerprint(plan.workflowId, stepPlan, resolvedInputs);
        if (!oldStep.inputFingerprint || oldStep.inputFingerprint !== fingerprint) {
          firstUnreusable = index;
          run.logs.push({ at: new Date().toISOString(), event: 'resume-invalidated', stepId: stepPlan.id, message: 'Plano ou insumo mudou; etapa será executada novamente.' });
          break;
        }
        const claimed = new Set();
        const verifiedArtifacts = [];
        for (const oldArtifact of oldStep.artifacts) {
          const candidate = { id: oldArtifact.id, path: oldArtifact.path, format: oldArtifact.format, validator: oldArtifact.validator };
          const { contract } = outputContractFor(candidate, stepPlan, claimed);
          const verified = await verifyArtifact(context.projectRoot, candidate, contract);
          if (!oldArtifact.sha256 || verified.sha256 !== oldArtifact.sha256) throw new Error('O checksum do output mudou desde a execução anterior.');
          verifiedArtifacts.push({
            id: contract.id || verified.id || `output-${verifiedArtifacts.length + 1}`,
            stepId: stepPlan.id,
            path: verified.path,
            format: verified.format,
            sizeBytes: verified.sizeBytes,
            sha256: verified.sha256,
            validator: verified.validator,
            validation: verified.validation,
            validatedAt: new Date().toISOString(),
          });
        }
        for (const [contractIndex, contract] of (stepPlan.outputContracts || []).entries()) {
          if (contract.required !== false && !claimed.has(contractIndex)) throw new Error(`Output obrigatório anterior ausente: ${stepPlan.id}:${contract.id}.`);
        }
        step.status = 'validated';
        step.progress = 100;
        step.startedAt = oldStep.startedAt || null;
        step.completedAt = oldStep.completedAt || null;
        step.validatedAt = new Date().toISOString();
        step.inputFingerprint = fingerprint;
        step.inputs = summarizeResolvedInputs(resolvedInputs);
        step.outputs = verifiedArtifacts.map((artifact) => artifact.path);
        step.artifacts = verifiedArtifacts;
        step.validations = verifiedArtifacts.map((artifact) => ({
          artifactId: artifact.id,
          path: artifact.path,
          format: artifact.format,
          validator: artifact.validator,
          sizeBytes: artifact.sizeBytes,
          sha256: artifact.sha256,
          validatedAt: artifact.validatedAt,
          result: 'passed',
          details: artifact.validation,
          resumed: true,
        }));
        step.execution = sanitizeExecution(stepPlan.execution || oldStep.execution);
        step.note = `Reutilizado da execução ${previousRun.id}; checksum e contrato de saída verificados novamente.`;
        step.reusedFromRunId = previousRun.id || null;
        run.artifacts.push(...verifiedArtifacts);
        run.reusedSteps.push(stepPlan.id);
        run.logs.push({ at: new Date().toISOString(), event: 'step-reused', stepId: stepPlan.id, message: step.note });
        firstUnreusable = index + 1;
      } catch (error) {
        firstUnreusable = index;
        run.logs.push({ at: new Date().toISOString(), event: 'resume-invalidated', stepId: stepPlan.id, message: cleanMessage(error.message || error) });
        break;
      }
    }
    run.resumeFrom = plan.steps[firstUnreusable]?.id || null;
    run.progress = computeRunProgress(run);
    if (firstUnreusable >= plan.steps.length) {
      run.status = 'validated';
      run.progress = 100;
      run.result = this.resultFor(run);
      await this.publish(run, 'run-validated', null, `Retomada concluída sem repetir etapas: ${run.reusedSteps.join(', ')}.`);
      return this.snapshot(run);
    }
    run.status = 'planned';
    await this.publish(run, 'run-planned', null, `Retomada compatível; próxima etapa: ${run.resumeFrom}.`);
    return await this.execute(entry, firstUnreusable, { resumed: true });
    } finally {
      if (this.activeRunId === run.id && !entry.controller) this.activeRunId = null;
    }
  }

  cancel(runId) {
    const entry = this.runs.get(runId);
    if (!entry || entry.run.status !== 'running' || !entry.controller) return false;
    entry.controller.abort();
    return true;
  }

  get(runId) {
    const entry = this.runs.get(runId);
    return entry ? this.snapshot(entry.run) : null;
  }
}

module.exports = {
  STEP_STATUSES,
  WORKFLOW_STATUSES,
  WorkflowRunner,
  normalizeFormat,
  validateFileFormat,
  validatePlan,
  verifyArtifact,
};
