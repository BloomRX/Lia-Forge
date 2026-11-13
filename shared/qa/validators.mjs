/**
 * Registro de validadores de artefato (F3 — QA compartilhado).
 *
 * Um único lugar decide o que significa "artefato válido" para cada contrato,
 * e tanto o runner quanto os adapters, o Asset Manager e a interface consultam
 * este registro. Substitui a duplicação em que a validação de conteúdo existia
 * apenas em `local-renderer-test/scripts/verify-output.cjs` (lacuna G8).
 *
 * Cada validador devolve `{ ok: true, metrics }` ou `{ ok: false, problems }`
 * — nunca lança — para que o chamador decida se falha o passo ou só avisa.
 */

import { validatePngStructure, parsePng } from './png.mjs';
import { analyzePngContent, validatePngContent } from './png-codec.mjs';
import { validateSpritesheetContent } from './spritesheet.mjs';

const MODEL_EXTENSIONS = Object.freeze(['blend', 'glb', 'gltf', 'fbx', 'obj', 'stl', 'ply', 'spz']);

function problem(message) {
  return { ok: false, problems: Object.freeze([message]) };
}

function safe(run, label) {
  try {
    return run();
  } catch (error) {
    return problem(`${label}: ${error.message}`);
  }
}

/** PNG íntegro (assinatura, CRC, IHDR, IDAT, IEND). */
export function validatePngStructural(artifact) {
  return safe(() => {
    const info = validatePngStructure(artifact.bytes, { requireRgba8: false });
    return { ok: true, validator: 'png-structural', metrics: info };
  }, 'png-structural');
}

/** PNG RGBA 8 bits — contrato de spritesheet. */
export function validatePngRgba8(artifact) {
  return safe(() => {
    const info = validatePngStructure(artifact.bytes, { requireRgba8: true });
    return { ok: true, validator: 'png-rgba8', metrics: info };
  }, 'png-rgba8');
}

/** Conteúdo real: recusa imagem em branco, sólida ou com células vazias. */
export function validatePngContentArtifact(artifact) {
  return safe(() => {
    const analysis = validatePngContent(artifact.bytes, {
      grid: artifact.grid ?? null,
      minCoverage: artifact.minCoverage ?? 0.0005,
      minUniqueColors: artifact.minUniqueColors ?? 2,
      label: artifact.label ?? 'imagem',
    });
    return {
      ok: true,
      validator: 'png-content',
      metrics: {
        coverage: analysis.coverage,
        opaquePixels: analysis.opaquePixels,
        uniqueColors: analysis.uniqueColors,
        boundingBox: analysis.boundingBox,
        meanLuma: analysis.meanLuma,
        emptyCells: analysis.emptyCells ?? 0,
      },
    };
  }, 'png-content');
}

/** Manifesto de spritesheet: estrutura (delegada) + conteúdo por frame. */
export function validateSpritesheetManifestArtifact(artifact) {
  return safe(() => {
    const manifest = artifact.manifest ?? artifact.value;
    if (!manifest || typeof manifest !== 'object') return problem('spritesheet-manifest: manifesto ausente');
    const content = validateSpritesheetContent(artifact.bytes, manifest, { label: artifact.label ?? 'spritesheet' });
    return {
      ok: true,
      validator: 'spritesheet-manifest',
      metrics: {
        columns: manifest.columns,
        rows: manifest.rows,
        frameCount: content.frameCount,
        coverage: content.coverage,
        uniqueColors: content.uniqueColors,
        boundingBox: content.boundingBox,
      },
    };
  }, 'spritesheet-manifest');
}

/** GLB: assinatura glTF, chunks JSON/BIN e conteúdo mínimo do JSON. */
export function validateGlbStructural(artifact) {
  return safe(() => {
    const bytes = artifact.bytes;
    if (!bytes || bytes.length < 20) return problem('glb-structural: arquivo menor que um cabeçalho GLB');
    const view = new DataView(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length);
    if (view.getUint32(0, true) !== 0x46546c67) return problem('glb-structural: assinatura glTF ausente');
    const version = view.getUint32(4, true);
    if (version !== 2) return problem(`glb-structural: versão ${version} não é GLB 2`);
    const declaredLength = view.getUint32(8, true);
    if (declaredLength !== view.byteLength) return problem(`glb-structural: comprimento declarado ${declaredLength} ≠ tamanho real ${view.byteLength}`);
    const jsonLength = view.getUint32(12, true);
    const jsonType = view.getUint32(16, true);
    if (jsonType !== 0x4e4f534a) return problem('glb-structural: primeiro chunk não é JSON');
    const decoder = new TextDecoder('utf-8');
    const json = JSON.parse(decoder.decode(new Uint8Array(bytes.buffer ?? bytes, (bytes.byteOffset ?? 0) + 20, jsonLength)));
    const metrics = {
      version,
      byteLength: declaredLength,
      meshes: json.meshes?.length ?? 0,
      materials: json.materials?.length ?? 0,
      animations: json.animations?.length ?? 0,
      nodes: json.nodes?.length ?? 0,
      skins: json.skins?.length ?? 0,
      images: json.images?.length ?? 0,
      extensionsUsed: json.extensionsUsed ?? [],
    };
    if (metrics.meshes === 0) return problem('glb-structural: nenhuma mesh declarada');
    return { ok: true, validator: 'glb-structural', metrics };
  }, 'glb-structural');
}

/** Extensão de modelo aceita pelo renderer (allowlist, sem inferência). */
export function validateModelExtension(artifact) {
  const extension = String(artifact.extension ?? artifact.path?.split('.').pop() ?? '').toLowerCase();
  if (!MODEL_EXTENSIONS.includes(extension)) {
    return problem(`model-extension: "${extension || 'desconhecida'}" não está na allowlist ${MODEL_EXTENSIONS.join(', ')}`);
  }
  return { ok: true, validator: 'model-extension', metrics: { extension } };
}

/** Camadas: cada uma com pixels e máscara coerente com a camada. */
export function validateLayersIntegrity(artifact) {
  const layers = artifact.layers ?? artifact.value?.layers;
  if (!Array.isArray(layers) || layers.length === 0) return problem('layers-integrity: nenhuma camada produzida');
  const problems = [];
  const ids = new Set();
  for (const [index, layer] of layers.entries()) {
    if (!layer || typeof layer.id !== 'string' || !layer.id.trim()) problems.push(`camada ${index}: id ausente`);
    else if (ids.has(layer.id)) problems.push(`camada ${index}: id duplicado ${layer.id}`);
    else ids.add(layer.id);
    if (!Number.isInteger(layer?.width) || !Number.isInteger(layer?.height) || layer.width < 1 || layer.height < 1) {
      problems.push(`camada ${index}: dimensões inválidas`);
    }
    // Camada pode carregar pixels em memória OU referenciar o arquivo gravado;
    // o que não é aceitável é não ter nenhum dos dois.
    const inline = layer?.pixels ?? layer?.bytes ?? null;
    const reference = layer?.path ?? layer?.file ?? null;
    if (!inline && (typeof reference !== 'string' || !reference.trim())) {
      problems.push(`camada ${index}: sem dados de pixel e sem caminho de arquivo`);
    }
    if (inline && (layer.width * layer.height * 4) !== inline.length) {
      problems.push(`camada ${index}: buffer de pixels não corresponde a ${layer.width}×${layer.height}`);
    }
    if (layer?.occluded === true && layer.reconstruction !== 'generated') {
      problems.push(`camada ${index}: região oculta precisa ser rotulada como conteúdo gerado`);
    }
  }
  if (problems.length) return { ok: false, problems: Object.freeze(problems) };
  return { ok: true, validator: 'layers-integrity', metrics: { layerCount: layers.length, ids: [...ids] } };
}

/** Rig 2D: ossos únicos, hierarquia sem ciclo, pesos somando 1 por vértice. */
export function validateRig2dStructural(artifact) {
  const rig = artifact.rig ?? artifact.value;
  if (!rig || typeof rig !== 'object') return problem('rig2d-structural: rig ausente');
  if (!Array.isArray(rig.bones) || rig.bones.length === 0) return problem('rig2d-structural: nenhum osso declarado');
  const problems = [];
  const ids = new Set();
  for (const [index, bone] of rig.bones.entries()) {
    if (!bone?.id) problems.push(`osso ${index}: id ausente`);
    else if (ids.has(bone.id)) problems.push(`osso ${index}: id duplicado ${bone.id}`);
    else ids.add(bone.id);
    if (bone?.parent !== null && bone?.parent !== undefined && !rig.bones.some((item) => item.id === bone.parent)) {
      problems.push(`osso ${bone?.id ?? index}: pai desconhecido ${bone.parent}`);
    }
    if (!Array.isArray(bone?.position) || bone.position.length !== 2) problems.push(`osso ${bone?.id ?? index}: posição inválida`);
  }
  // ciclo na hierarquia
  for (const bone of rig.bones) {
    let cursor = bone;
    let guard = 0;
    while (cursor?.parent) {
      cursor = rig.bones.find((item) => item.id === cursor.parent);
      guard += 1;
      if (guard > rig.bones.length) {
        problems.push(`osso ${bone.id}: hierarquia com ciclo`);
        break;
      }
    }
  }
  if (Array.isArray(rig.skinning)) {
    for (const [index, weights] of rig.skinning.entries()) {
      const total = Object.values(weights ?? {}).reduce((sum, value) => sum + value, 0);
      if (Math.abs(total - 1) > 0.001) problems.push(`skin ${index}: pesos somam ${total.toFixed(3)} (esperado 1)`);
    }
  }
  if (problems.length) return { ok: false, problems: Object.freeze(problems) };
  return { ok: true, validator: 'rig2d-structural', metrics: { boneCount: rig.bones.length, rootCount: rig.bones.filter((bone) => !bone.parent).length } };
}

/** Animação: cada ação tem keyframes ordenados e ciclos fecham. */
export function validateAnimationLoop(artifact) {
  const animations = artifact.animations ?? artifact.value?.animations;
  if (!Array.isArray(animations) || animations.length === 0) return problem('animation-loop: nenhuma animação declarada');
  const problems = [];
  const names = new Set();
  for (const animation of animations) {
    const name = animation?.name;
    if (typeof name !== 'string' || !name.trim()) problems.push('animation-loop: animação sem nome');
    else if (names.has(name)) problems.push(`animation-loop: nome duplicado ${name}`);
    else names.add(name);
    const keys = animation?.keyframes;
    if (!Array.isArray(keys) || keys.length < 2) {
      problems.push(`animation-loop: ${name ?? 'animacao'} precisa de ao menos 2 keyframes`);
      continue;
    }
    // Keyframes são multi-trilha (um por osso no mesmo instante): o tempo
    // global é não decrescente e, dentro de cada osso, estritamente crescente.
    const lastTimeByBone = new Map();
    for (let index = 1; index < keys.length; index += 1) {
      if (keys[index].time < keys[index - 1].time) {
        problems.push(`animation-loop: ${name} tem tempo decrescente no keyframe ${index}`);
      }
    }
    for (const [index, key] of keys.entries()) {
      const previous = lastTimeByBone.get(key.bone);
      if (previous !== undefined && !(key.time > previous)) {
        problems.push(`animation-loop: ${name} tem keyframes duplicados para o osso ${key.bone} no tempo ${key.time} (índice ${index})`);
      }
      lastTimeByBone.set(key.bone, key.time);
    }
    if (animation.loop !== false) {
      // ciclo fecha quando cada osso que anima no primeiro instante volta ao
      // mesmo valor no último instante da ação
      const tolerance = animation.loopToleranceDeg ?? 2;
      const firstByBone = new Map();
      const lastByBone = new Map();
      for (const key of keys) {
        if (!firstByBone.has(key.bone)) firstByBone.set(key.bone, key);
        lastByBone.set(key.bone, key);
      }
      for (const [boneId, first] of firstByBone) {
        const last = lastByBone.get(boneId);
        if (!last || last.time === first.time) continue;
        const drift = Math.abs((last.rotation ?? 0) - (first.rotation ?? 0));
        if (drift > tolerance) {
          problems.push(`animation-loop: ${name} não fecha o ciclo no osso ${boneId} (deriva ${drift.toFixed(2)}°)`);
        }
      }
    }
  }
  if (problems.length) return { ok: false, problems: Object.freeze(problems) };
  return { ok: true, validator: 'animation-loop', metrics: { animations: [...names], keyframes: animations.reduce((sum, item) => sum + (item.keyframes?.length ?? 0), 0) } };
}

/** Allowlist de formatos por destino (nunca inferir formato). */
export function validateFormatAllowlist(artifact) {
  const allowed = artifact.allowed ?? MODEL_EXTENSIONS;
  const format = String(artifact.format ?? '').toLowerCase();
  if (!allowed.includes(format)) return problem(`format-allowlist: "${format || 'vazio'}" não está em ${allowed.join(', ')}`);
  return { ok: true, validator: 'format-allowlist', metrics: { format } };
}

/** Pacote de exportação: manifesto do destino coerente com o perfil. */
export function validateDestinationProfile(artifact) {
  const bundle = artifact.bundle ?? artifact.value;
  if (!bundle || typeof bundle !== 'object') return problem('destination-profile: pacote ausente');
  const problems = [];
  if (!bundle.destination) problems.push('destination-profile: destino não declarado');
  if (!bundle.profile) problems.push('destination-profile: perfil de compatibilidade não declarado');
  if (!Array.isArray(bundle.files) || bundle.files.length === 0) problems.push('destination-profile: nenhum arquivo no pacote');
  for (const [index, file] of (bundle.files ?? []).entries()) {
    if (!file?.path) problems.push(`destination-profile: arquivo ${index} sem caminho`);
    if (!file?.sha256) problems.push(`destination-profile: arquivo ${index} sem SHA-256`);
    if (typeof file?.bytes !== 'number' || file.bytes < 0) problems.push(`destination-profile: arquivo ${index} sem tamanho`);
  }
  if (bundle.importNotes !== undefined && typeof bundle.importNotes !== 'string') problems.push('destination-profile: importNotes precisa ser texto');
  if (problems.length) return { ok: false, problems: Object.freeze(problems) };
  return { ok: true, validator: 'destination-profile', metrics: { destination: bundle.destination, profile: bundle.profile, files: bundle.files.length } };
}

export function validateNonEmptyText(artifact) {
  const value = artifact.value ?? artifact.text;
  if (typeof value !== 'string' || !value.trim()) return problem('non-empty-text: texto vazio');
  return { ok: true, validator: 'non-empty-text', metrics: { length: value.trim().length } };
}

export const VALIDATORS = Object.freeze({
  'png-structural': validatePngStructural,
  png: validatePngStructural,
  'png-rgba8': validatePngRgba8,
  'png-content': validatePngContentArtifact,
  'spritesheet-manifest': validateSpritesheetManifestArtifact,
  'glb-structural': validateGlbStructural,
  glb: validateGlbStructural,
  'model-extension': validateModelExtension,
  'layers-integrity': validateLayersIntegrity,
  'rig2d-structural': validateRig2dStructural,
  'animation-loop': validateAnimationLoop,
  'format-allowlist': validateFormatAllowlist,
  'destination-profile': validateDestinationProfile,
  'non-empty-text': validateNonEmptyText,
});

/**
 * Executa um validador pelo id do contrato.
 * Validador desconhecido falha fechado: um contrato sem verificação não passa.
 */
export function runValidator(validatorId, artifact) {
  const validator = VALIDATORS[validatorId];
  if (!validator) {
    return { ok: false, validator: validatorId, problems: Object.freeze([`validador desconhecido: ${validatorId}`]) };
  }
  const result = validator(artifact);
  return { ...result, validator: validatorId };
}

/**
 * Executa os validadores declarados por um passo do plano (F3 + §5/G8).
 *
 * Quem conhece o formato de cada payload é a QA — o engine só chama e registra.
 * Regra de honestidade: quando a entrada de um validador não existe (o adapter
 * não devolveu o manifesto, por exemplo), o resultado é `skipped` com o motivo,
 * nunca um "ok" silencioso. Quando o validador roda e reprova, o passo falha.
 *
 * @param {object} args
 * @param {string[]} args.validators ids declarados no plano
 * @param {object} [args.params] params do passo (traz entradas declaradas pelo usuário)
 * @param {object} [args.result] retorno do adapter (pode trazer manifest/rig/layers/…)
 * @param {string[]} args.outputs caminhos gravados, relativos ao projeto
 * @param {Function} [args.readArtifact] lê bytes de um caminho relativo
 * @param {string} [args.label] rótulo usado nas mensagens
 * @returns {Promise<{ok: boolean, validations: object[], problems: string[]}>}
 */
export async function validateStepOutputs({ validators = [], params = {}, result = null, outputs = [], readArtifact = null, label = 'saída do passo' }) {
  const validations = [];
  const problems = [];

  const bytesOf = async (predicate) => {
    if (typeof readArtifact !== 'function') return null;
    const match = outputs.find(predicate);
    if (!match) return null;
    try {
      return await readArtifact(match);
    } catch {
      return null;
    }
  };
  const jsonOf = async (predicate) => {
    const bytes = await bytesOf(predicate);
    if (!bytes) return null;
    try {
      return JSON.parse(bytes.toString('utf8'));
    } catch {
      return null;
    }
  };
  const isImage = (value) => /\.(png|jpe?g|webp)$/i.test(value);
  const isModel = (value) => /\.(glb|gltf)$/i.test(value);
  // Entrada declarada pelo usuário (ex.: params.model, params.sourceImage): um
  // passo que só inspeciona um arquivo não o reemite como saída, e ainda assim a
  // validação declarada precisa rodar sobre o que foi lido.
  const declaredInput = [params.model, params.sourceImage, params.input].find((value) => typeof value === 'string' && value.trim());
  const adapterMetrics = result?.metrics ?? {};

  for (const validatorId of validators) {
    let artifact = null;
    let missing = null;

    if (validatorId === 'png-structural' || validatorId === 'png' || validatorId === 'png-rgba8') {
      const bytes = await bytesOf(isImage) ?? (declaredInput && isImage(declaredInput) && readArtifact ? await readArtifact(declaredInput) : null);
      if (bytes) artifact = { bytes };
      else missing = 'nenhum PNG gravado ou declarado neste passo';
    } else if (validatorId === 'png-content') {
      const bytes = await bytesOf(isImage) ?? (declaredInput && isImage(declaredInput) && readArtifact ? await readArtifact(declaredInput) : null);
      if (bytes) artifact = { bytes, grid: adapterMetrics.grid ?? null, label, minUniqueColors: adapterMetrics.grid ? 1 : 2 };
      else missing = 'nenhum PNG gravado ou declarado neste passo';
    } else if (validatorId === 'spritesheet-manifest') {
      const bytes = await bytesOf(isImage);
      const manifest = result?.manifest ?? await jsonOf((value) => /manifest[^/]*\.json$/i.test(value) || /frames\.json$/i.test(value));
      if (bytes && manifest) artifact = { bytes, manifest, label };
      else missing = !bytes ? 'nenhum PNG gravado neste passo' : 'o passo não devolveu um manifesto de spritesheet';
    } else if (validatorId === 'glb-structural' || validatorId === 'glb') {
      const bytes = await bytesOf(isModel) ?? (declaredInput && isModel(declaredInput) && readArtifact ? await readArtifact(declaredInput) : null);
      if (bytes) artifact = { bytes };
      else missing = 'nenhum GLB/glTF gravado ou declarado neste passo';
    } else if (validatorId === 'model-extension') {
      const model = outputs.find(isModel);
      if (model) artifact = { path: model };
      else missing = 'nenhum arquivo de modelo 3D neste passo';
    } else if (validatorId === 'layers-integrity') {
      const layers = result?.layers ?? (await jsonOf((value) => /layers[^/]*\.json$/i.test(value)))?.layers;
      if (layers) artifact = { layers };
      else missing = 'o passo não devolveu camadas';
    } else if (validatorId === 'rig2d-structural') {
      // Um passo de modularização não devolve "um rig": devolve um template e
      // variantes. Cada variante é estruturalmente um rig (ossos + peças), então
      // todas são validadas — pular aqui deixaria o validador decorativo.
      const modular = result?.modular ?? await jsonOf((value) => /modular[^/]*\.json$/i.test(value));
      const variants = modular?.variants ? Object.values(modular.variants) : [];
      const rig = result?.rig ?? await jsonOf((value) => /rig[^/]*\.json$/i.test(value));
      if (variants.length) artifact = variants.map((variant) => ({ rig: variant }));
      else if (rig) artifact = { rig };
      else missing = 'o passo não devolveu um rig nem variantes modulares';
    } else if (validatorId === 'animation-loop') {
      const animations = result?.animations ?? (await jsonOf((value) => /animations?[^/]*\.json$/i.test(value)))?.animations;
      if (animations) artifact = { animations };
      else missing = 'o passo não devolveu animações';
    } else if (validatorId === 'destination-profile') {
      const bundle = result?.bundle ?? await jsonOf((value) => /manifest\.json$/i.test(value));
      if (bundle) artifact = { bundle };
      else missing = 'o passo não devolveu um pacote de destino';
    } else if (validatorId === 'format-allowlist') {
      const format = result?.format ?? adapterMetrics.format ?? null;
      if (format) artifact = { format, allowed: result?.allowed ?? undefined };
      else missing = 'o passo não declarou formato';
    } else if (validatorId === 'non-empty-text') {
      const value = result?.text ?? result?.value ?? null;
      if (typeof value === 'string') artifact = { value };
      else missing = 'o passo não devolveu texto';
    } else {
      missing = `validador "${validatorId}" não tem regra de montagem de entrada aqui`;
    }

    if (!artifact) {
      validations.push({ validator: validatorId, status: 'skipped', reason: missing });
      continue;
    }
    // `artifact` pode ser uma lista: todos os itens precisam passar.
    const targets = Array.isArray(artifact) ? artifact : [artifact];
    const failures = [];
    let aggregated = null;
    for (const [targetIndex, target] of targets.entries()) {
      const outcome = runValidator(validatorId, target);
      if (outcome.ok) aggregated = aggregated ? { ...aggregated, ...outcome.metrics } : outcome.metrics ?? null;
      else failures.push(...(outcome.problems ?? []).map((problem) => (targets.length > 1 ? `[${targetIndex}] ${problem}` : problem)));
    }
    if (failures.length === 0) {
      validations.push({ validator: validatorId, status: 'passed', checked: targets.length, metrics: aggregated });
    } else {
      validations.push({ validator: validatorId, status: 'failed', checked: targets.length, problems: failures });
      problems.push(...failures.map((problem) => `${validatorId}: ${problem}`));
    }
  }

  return { ok: problems.length === 0, validations, problems };
}

export function listValidators() {
  return Object.freeze(Object.keys(VALIDATORS));
}

export { analyzePngContent, parsePng, MODEL_EXTENSIONS };
