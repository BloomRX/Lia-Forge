/**
 * Fixtures de PNG para os smokes em CommonJS.
 *
 * `makePng` continua gerando um PNG estruturalmente válido com pixels zerados
 * (comportamento publicado, usado pelos testes que só conferem estrutura).
 * As funções novas existem porque validação de estrutura não é validação de
 * conteúdo: um atlas 100% transparente passa no validador estrutural e é
 * exatamente o defeito que a lacuna G8 descrevia. Com elas os testes conseguem
 * distinguir "arquivo é um PNG" de "arquivo tem imagem dentro".
 *
 * Nada aqui depende de biblioteca externa: zlib do Node + CRC32 próprio.
 */

const { deflateSync } = require('node:zlib');

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBytes, data]);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  body.copy(output, 4);
  output.writeUInt32BE(crc32(body), output.length - 4);
  return output;
}

/**
 * @param {number} width
 * @param {number} height
 * @param {object} [options]
 * @param {number} [options.colorType=6] 6 = RGBA, 2 = RGB
 * @param {number} [options.bitDepth=8]
 * @param {number[]|null} [options.fill=null] cor sólida [r,g,b,a]; null = pixels zerados
 * @param {'checker'|'gradient'|'noise'|null} [options.pattern=null] padrão determinístico
 * @param {Function|null} [options.pixel=null] função (x, y) => [r,g,b,a]
 */
function makePng(width, height, { colorType = 6, bitDepth = 8, fill = null, pattern = null, pixel = null } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = bitDepth;
  header[9] = colorType;
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
  const rowBytes = width * bytesPerPixel + 1;
  const rows = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowBytes;
    rows[rowStart] = 0; // filtro None
    for (let x = 0; x < width; x += 1) {
      let color = null;
      if (typeof pixel === 'function') color = pixel(x, y);
      else if (pattern === 'checker') color = ((x >> 2) + (y >> 2)) % 2 === 0 ? [240, 60, 170, 255] : [30, 20, 40, 255];
      else if (pattern === 'gradient') color = [Math.round((x * 255) / Math.max(1, width - 1)), Math.round((y * 255) / Math.max(1, height - 1)), 128, 255];
      else if (pattern === 'noise') {
        // determinístico: mesmo (x, y) sempre produz o mesmo byte
        const value = (x * 31 + y * 17) % 251;
        color = [value, (value * 7) % 251, (value * 13) % 251, 255];
      } else if (fill) color = fill;
      if (!color) continue;
      const offset = rowStart + 1 + x * bytesPerPixel;
      rows[offset] = color[0] & 0xff;
      if (bytesPerPixel >= 3) rows[offset + 1] = color[1] & 0xff;
      if (bytesPerPixel >= 3) rows[offset + 2] = color[2] & 0xff;
      if (bytesPerPixel === 4) rows[offset + 3] = color[3] === undefined ? 255 : color[3] & 0xff;
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** PNG com conteúdo real (xadrez por padrão) — nunca uma imagem em branco. */
function makeContentPng(width, height, options = {}) {
  return makePng(width, height, { pattern: 'checker', ...options });
}

/**
 * Atlas de spritesheet com conteúdo distinto em cada célula.
 *
 * Padrão: 8 colunas × 3 linhas de 48×48 = 384×144, o contrato publicado do
 * workflow humanoide (24 frames). Cada frame recebe um disco colorido em posição
 * derivada do índice, então nenhuma célula fica vazia e o atlas tem várias cores.
 */
function makeSpritesheetFixture({ columns = 8, rows = 3, frameWidth = 48, frameHeight = 48, frames = columns * rows } = {}) {
  const width = columns * frameWidth;
  const height = rows * frameHeight;
  return makePng(width, height, {
    pixel: (x, y) => {
      const column = Math.floor(x / frameWidth);
      const row = Math.floor(y / frameHeight);
      const index = row * columns + column;
      if (index >= frames) return [0, 0, 0, 0];
      const localX = x - column * frameWidth;
      const localY = y - row * frameHeight;
      // disco cujo centro desloca a cada frame (movimento visível frame a frame)
      const centerX = frameWidth / 2 + Math.round(6 * Math.cos((index * Math.PI) / 6));
      const centerY = frameHeight / 2 + Math.round(6 * Math.sin((index * Math.PI) / 6));
      const distance = Math.hypot(localX - centerX, localY - centerY);
      if (distance > Math.min(frameWidth, frameHeight) / 3) return [12, 8, 16, 255];
      const hue = (index * 47) % 360;
      return [
        Math.round(120 + 100 * Math.abs(Math.sin((hue * Math.PI) / 180))),
        Math.round(60 + 120 * Math.abs(Math.sin(((hue + 120) * Math.PI) / 180))),
        Math.round(140 + 100 * Math.abs(Math.sin(((hue + 240) * Math.PI) / 180))),
        255,
      ];
    },
  });
}

module.exports = { makePng, makeContentPng, makeSpritesheetFixture };
