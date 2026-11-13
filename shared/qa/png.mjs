/**
 * Validação estrutural de PNG (F3).
 *
 * Puro e sem dependências de Node além de `Uint8Array`/`DataView`, portanto
 * roda tanto no processo principal quanto no Studio. Não decodifica pixels:
 * confere assinatura, sequência de chunks, CRC, IHDR e presença de IDAT/IEND.
 *
 * Fonte única de verdade da validação estrutural: `electron/png-validation.cjs`
 * é uma casca que delega para cá (via `require` de módulo ES, Node >= 22.12, o
 * mínimo declarado em `engines.node`), e `shared/qa/png-codec.mjs` usa
 * `parsePng` para decodificar pixels. A cópia duplicada que existia no processo
 * principal foi removida — mesma regra, um lugar só.
 */

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const VALID_DEPTH_BY_COLOR_TYPE = Object.freeze({
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
});

export const CHANNELS_BY_COLOR_TYPE = Object.freeze({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 });

export function pngColorTypeLabel(colorType) {
  return { 0: 'gray', 2: 'rgb', 3: 'indexed', 4: 'gray+alpha', 6: 'rgba' }[colorType] ?? `unknown(${colorType})`;
}

function asBytes(buffer) {
  if (buffer instanceof Uint8Array) return buffer;
  if (buffer && buffer.buffer instanceof ArrayBuffer) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset ?? 0, buffer.byteLength ?? buffer.length);
  }
  throw new TypeError('png: expected a Buffer, Uint8Array or ArrayBufferView');
}

/**
 * Percorre os chunks de um PNG.
 * @returns {{width:number,height:number,bitDepth:number,colorType:number,interlaced:number,
 *            hasAlpha:boolean,paletteEntries:number,idatChunks:number,trns:boolean,bytes:number}}
 */
export function parsePng(buffer, { verifyCrc = true } = {}) {
  const bytes = asBytes(buffer);
  if (bytes.length < 57) throw new Error('O output não tem uma estrutura PNG completa.');
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) throw new Error('O output não tem uma estrutura PNG completa.');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let header = null;
  let foundImageData = false;
  let foundEnd = false;
  let idatChunks = 0;
  let paletteEntries = 0;
  let trns = false;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) throw new Error('O PNG está truncado em um chunk.');
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    if (verifyCrc) {
      const expected = view.getUint32(dataStart + length);
      const actual = crc32(bytes.subarray(offset + 4, dataStart + length));
      if (expected !== actual) throw new Error(`O PNG tem checksum CRC inválido no chunk ${type}.`);
    }

    if (!header) {
      if (type !== 'IHDR' || length !== 13) throw new Error('O PNG não começa com um cabeçalho IHDR válido.');
      const width = view.getUint32(dataStart);
      const height = view.getUint32(dataStart + 4);
      const bitDepth = bytes[dataStart + 8];
      const colorType = bytes[dataStart + 9];
      const interlaced = bytes[dataStart + 12];
      if (width < 1 || height < 1 || !VALID_DEPTH_BY_COLOR_TYPE[colorType]?.includes(bitDepth)) {
        throw new Error('O PNG declara dimensões, profundidade ou tipo de cor inválidos.');
      }
      if (bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 || interlaced > 1) {
        throw new Error('O PNG declara métodos de compressão, filtro ou entrelaçamento inválidos.');
      }
      header = { width, height, bitDepth, colorType, interlaced };
    } else if (type === 'IHDR') {
      throw new Error('O PNG contém mais de um cabeçalho IHDR.');
    }

    if (type === 'IDAT') {
      foundImageData = true;
      idatChunks += 1;
    } else if (type === 'PLTE') {
      paletteEntries = Math.floor(length / 3);
    } else if (type === 'tRNS') {
      trns = true;
    } else if (type === 'IEND') {
      if (length !== 0 || !foundImageData) throw new Error('O PNG não contém dados de imagem e encerramento válidos.');
      foundEnd = true;
      offset = chunkEnd;
      break;
    }
    offset = chunkEnd;
  }

  if (!header || !foundImageData || !foundEnd || offset !== bytes.length) {
    throw new Error('O PNG não contém uma sequência completa de chunks até IEND.');
  }
  if (header.colorType === 3 && paletteEntries === 0) throw new Error('O PNG indexado não declara paleta PLTE.');

  return {
    ...header,
    hasAlpha: header.colorType === 4 || header.colorType === 6 || trns,
    paletteEntries,
    idatChunks,
    trns,
    bytes: bytes.length,
  };
}

/** Valida estrutura e, se pedido, exige RGBA 8 bits (contrato de spritesheet). */
export function validatePngStructure(buffer, { requireRgba8 = false, maxWidth = null, maxHeight = null } = {}) {
  const info = parsePng(buffer);
  if (requireRgba8 && (info.bitDepth !== 8 || info.colorType !== 6)) {
    throw new Error('A spritesheet precisa ser PNG RGBA de 8 bits com canal alpha.');
  }
  if (maxWidth !== null && info.width > maxWidth) throw new Error(`A imagem excede a largura máxima de ${maxWidth}px.`);
  if (maxHeight !== null && info.height > maxHeight) throw new Error(`A imagem excede a altura máxima de ${maxHeight}px.`);
  return info;
}
