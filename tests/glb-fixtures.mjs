/**
 * Fixture GLB construído byte a byte para testes.
 * É um cubo mínimo com material, textura, 1 mesh e 1 animação — suficiente para
 * exercitar o inspetor. Não é um asset de produção nem representa capacidade de
 * geração 3D.
 */

const POSITIONS = [
  -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1,
  -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
];
const INDICES = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];

function pad4(length) {
  return (4 - (length % 4)) % 4;
}

export function buildGlbFixture({ withAnimation = true, generator = 'lia-forge-test-fixture', magic = 0x46546c67 } = {}) {
  const positionBytes = Buffer.alloc(POSITIONS.length * 4);
  POSITIONS.forEach((value, index) => positionBytes.writeFloatLE(value, index * 4));
  const indexBytes = Buffer.alloc(INDICES.length * 2);
  INDICES.forEach((value, index) => indexBytes.writeUInt16LE(value, index * 2));
  const imageBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
  const timeBytes = Buffer.alloc(8);
  timeBytes.writeFloatLE(0, 0);
  timeBytes.writeFloatLE(0.66, 4);
  const rotationBytes = Buffer.alloc(32);
  for (let index = 0; index < 8; index += 1) rotationBytes.writeFloatLE(index === 3 || index === 7 ? 1 : 0, index * 4);

  const segments = [positionBytes, indexBytes, imageBytes];
  if (withAnimation) segments.push(timeBytes, rotationBytes);

  const bufferViews = [];
  const parts = [];
  let offset = 0;
  for (const [index, segment] of segments.entries()) {
    const padding = pad4(offset);
    if (padding) {
      parts.push(Buffer.alloc(padding));
      offset += padding;
    }
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: segment.byteLength, ...(index < 2 ? { target: index === 0 ? 34962 : 34963 } : {}) });
    parts.push(segment);
    offset += segment.byteLength;
  }
  const binPadding = pad4(offset);
  if (binPadding) parts.push(Buffer.alloc(binPadding));
  const bin = Buffer.concat(parts);

  const accessors = [
    { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', max: [1, 1, 1], min: [-1, -1, -1] },
    { bufferView: 1, componentType: 5123, count: INDICES.length, type: 'SCALAR' },
  ];
  const json = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'cube', mesh: 0 }],
    meshes: [{ name: 'cube-mesh', primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: 'base-material', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }],
    images: [{ name: 'base-color', mimeType: 'image/png', bufferView: 2 }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.byteLength }],
  };
  if (withAnimation) {
    json.accessors.push(
      { bufferView: 3, componentType: 5126, count: 2, type: 'SCALAR', max: [0.66], min: [0] },
      { bufferView: 4, componentType: 5126, count: 2, type: 'VEC4' },
    );
    json.animations = [{
      name: 'idle',
      channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }],
      samplers: [{ input: 2, output: 3, interpolation: 'LINEAR' }],
    }];
    json.skins = [{ name: 'cube-skin', joints: [0] }];
  }

  let jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadding = pad4(jsonBuffer.byteLength);
  if (jsonPadding) jsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);

  const totalLength = 12 + 8 + jsonBuffer.byteLength + 8 + bin.byteLength;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(magic, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.byteLength, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.byteLength, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, bin]);
}
