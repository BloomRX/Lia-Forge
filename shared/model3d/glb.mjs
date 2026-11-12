/**
 * Inspeção de GLB/glTF binário (F7 — capacidade `model3d.inspect`).
 *
 * Puro (DataView/TextDecoder): funciona no processo principal e no Studio.
 * Lê o que existe no arquivo e reporta; não gera, não corrige e não afirma
 * nada que o arquivo não declare.
 */

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const COMPONENT_TYPE_SIZE = Object.freeze({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 });
const COMPONENT_TYPE_LABEL = Object.freeze({ 5120: 'BYTE', 5121: 'UBYTE', 5122: 'SHORT', 5123: 'USHORT', 5125: 'UINT', 5126: 'FLOAT' });
const TYPE_COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 });

export function inspectGlb(bytes) {
  const view = new DataView(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length);
  if (view.byteLength < 20) throw new Error('Arquivo menor que um cabeçalho GLB (20 bytes).');
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Assinatura glTF ausente: não é um GLB.');
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error(`GLB versão ${version}; o inspetor suporta versão 2.`);
  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== view.byteLength) {
    throw new Error(`GLB declara ${declaredLength} bytes mas o arquivo tem ${view.byteLength}.`);
  }

  const chunks = [];
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    if (offset + 8 + chunkLength > view.byteLength) throw new Error('Chunk GLB truncado.');
    chunks.push({ type: chunkType === CHUNK_JSON ? 'JSON' : chunkType === CHUNK_BIN ? 'BIN' : `0x${chunkType.toString(16)}`, length: chunkLength, offset: offset + 8 });
    offset += 8 + chunkLength;
  }
  const jsonChunk = chunks.find((chunk) => chunk.type === 'JSON');
  if (!jsonChunk) throw new Error('GLB sem chunk JSON.');
  const decoder = new TextDecoder('utf-8');
  const jsonBytes = new Uint8Array(view.buffer, view.byteOffset + jsonChunk.offset, jsonChunk.length);
  let json;
  try {
    json = JSON.parse(decoder.decode(jsonBytes));
  } catch (error) {
    throw new Error(`JSON do GLB inválido: ${error.message}`);
  }

  const accessors = json.accessors ?? [];
  const meshes = (json.meshes ?? []).map((mesh, index) => {
    const primitives = (mesh.primitives ?? []).map((primitive) => {
      const positionAccessor = accessors[primitive.attributes?.POSITION];
      const indicesAccessor = primitive.indices === undefined ? null : accessors[primitive.indices];
      return {
        mode: primitive.mode ?? 4,
        material: primitive.material ?? null,
        vertexCount: positionAccessor?.count ?? null,
        triangleCount: indicesAccessor ? Math.floor(indicesAccessor.count / 3) : (positionAccessor ? Math.floor(positionAccessor.count / 3) : null),
        hasNormals: primitive.attributes?.NORMAL !== undefined,
        hasUvs: primitive.attributes?.TEXCOORD_0 !== undefined,
        hasJoints: primitive.attributes?.JOINTS_0 !== undefined,
        hasWeights: primitive.attributes?.WEIGHTS_0 !== undefined,
      };
    });
    return {
      index,
      name: mesh.name ?? `mesh-${index}`,
      primitives,
      vertexCount: primitives.reduce((sum, item) => sum + (item.vertexCount ?? 0), 0),
      triangleCount: primitives.reduce((sum, item) => sum + (item.triangleCount ?? 0), 0),
    };
  });

  const animations = (json.animations ?? []).map((animation, index) => {
    const channels = animation.channels ?? [];
    const samplers = animation.samplers ?? [];
    let maxTime = 0;
    for (const sampler of samplers) {
      const input = accessors[sampler.input];
      if (input?.max?.length) maxTime = Math.max(maxTime, ...input.max);
    }
    return {
      index,
      name: animation.name ?? `animation-${index}`,
      channels: channels.length,
      samplers: samplers.length,
      durationSeconds: maxTime || null,
      targets: [...new Set(channels.map((channel) => channel.target?.path).filter(Boolean))],
    };
  });

  const materials = (json.materials ?? []).map((material, index) => ({
    index,
    name: material.name ?? `material-${index}`,
    doubleSided: material.doubleSided === true,
    alphaMode: material.alphaMode ?? 'OPAQUE',
    baseColorTexture: material.pbrMetallicRoughness?.baseColorTexture?.index ?? null,
    normalTexture: material.normalTexture?.index ?? null,
    hasPbr: material.pbrMetallicRoughness !== undefined,
  }));

  const images = (json.images ?? []).map((image, index) => ({
    index,
    name: image.name ?? `image-${index}`,
    mimeType: image.mimeType ?? null,
    bufferView: image.bufferView ?? null,
    uri: image.uri ?? null,
  }));

  const buffers = (json.buffers ?? []).map((buffer, index) => ({ index, byteLength: buffer.byteLength ?? 0, uri: buffer.uri ?? null }));
  const bufferViews = (json.bufferViews ?? []).map((bufferView) => ({ byteLength: bufferView.byteLength ?? 0, target: bufferView.target ?? null }));

  return Object.freeze({
    version,
    byteLength: declaredLength,
    chunks: Object.freeze(chunks),
    generator: json.asset?.generator ?? null,
    assetVersion: json.asset?.version ?? null,
    copyright: json.asset?.copyright ?? null,
    extensionsUsed: Object.freeze(json.extensionsUsed ?? []),
    extensionsRequired: Object.freeze(json.extensionsRequired ?? []),
    scenes: (json.scenes ?? []).length,
    nodes: (json.nodes ?? []).length,
    meshes: Object.freeze(meshes),
    meshCount: meshes.length,
    vertexCount: meshes.reduce((sum, mesh) => sum + mesh.vertexCount, 0),
    triangleCount: meshes.reduce((sum, mesh) => sum + mesh.triangleCount, 0),
    materials: Object.freeze(materials),
    textures: (json.textures ?? []).length,
    images: Object.freeze(images),
    animations: Object.freeze(animations),
    animationCount: animations.length,
    animationNames: Object.freeze(animations.map((animation) => animation.name)),
    skins: Object.freeze((json.skins ?? []).map((skin, index) => ({
      index,
      name: skin.name ?? `skin-${index}`,
      joints: (skin.joints ?? []).length,
      skeleton: skin.skeleton ?? null,
    }))),
    skinned: (json.skins ?? []).length > 0,
    buffers: Object.freeze(buffers),
    bufferViewCount: bufferViews.length,
    binChunkBytes: chunks.find((chunk) => chunk.type === 'BIN')?.length ?? 0,
    accessorComponentTypes: Object.freeze([...new Set(accessors.map((accessor) => COMPONENT_TYPE_LABEL[accessor.componentType] ?? String(accessor.componentType)))]),
  });
}

/** Resumo curto para cards de interface e logs. */
export function summarizeGlb(info) {
  return [
    `${info.meshCount} mesh(es)`,
    `${info.triangleCount} triângulos`,
    `${info.materials.length} material(is)`,
    info.animationCount ? `${info.animationCount} animação(ões): ${info.animationNames.slice(0, 4).join(', ')}` : 'sem animação',
    info.skinned ? `rig com ${info.skins[0]?.joints ?? 0} juntas` : 'sem skin',
    `${(info.byteLength / 1024).toFixed(1)} KB`,
  ].join(' · ');
}

export { COMPONENT_TYPE_SIZE, TYPE_COMPONENTS };
