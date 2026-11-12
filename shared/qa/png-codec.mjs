/**
 * Codec PNG mínimo e validação de conteúdo (F3 — fecha a lacuna G8).
 *
 * `local-renderer-test/scripts/verify-output.cjs` já recusava células
 * totalmente transparentes, mas o caminho de produção
 * (`validateSpritesheetFiles`) aceitava um atlas 100% transparente como
 * sucesso. Este módulo é a fonte única de verdade da validação de conteúdo:
 * decodifica pixels de verdade (inflate + unfiltro) e mede cobertura,
 * bounding box e ocupação por célula da grade.
 *
 * Node-only (usa `node:zlib`). O Studio nunca decodifica pixels aqui: recebe os
 * resultados prontos do processo principal.
 *
 * Não é um decodificador PNG completo de propósito: suporta o que os geradores
 * do produto emitem (8/16 bits, color types 0/2/3/4/6, sem entrelaçamento) e
 * falha com mensagem clara em vez de produzir pixels errados.
 */

import { inflateSync, deflateSync } from 'node:zlib';
import { CHANNELS_BY_COLOR_TYPE, crc32, parsePng } from './png.mjs';

const MAX_DIMENSION = 16384;
const PAETH_CACHE_LIMIT = 1 << 20;

function chunkBytes(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  body.copy(output, 4);
  output.writeUInt32BE(crc32(body), output.length - 4);
  return output;
}

/** Codifica RGBA 8 bits sem entrelaçamento (filtro 0 por linha: determinístico). */
export function encodePngRgba(rgba, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new TypeError('encodePngRgba: width/height must be positive integers');
  }
  if (rgba.length !== width * height * 4) throw new TypeError('encodePngRgba: buffer length does not match width*height*4');
  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (rowBytes + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * rowBytes, rowBytes).copy(raw, y * (rowBytes + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunkBytes('IHDR', header),
    chunkBytes('IDAT', deflateSync(raw, { level: 6 })),
    chunkBytes('IEND', Buffer.alloc(0)),
  ]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function expandToBytes(sample, bitDepth) {
  if (bitDepth === 8) return sample;
  if (bitDepth === 16) return sample >> 8;
  const scale = 255 / ((1 << bitDepth) - 1);
  return Math.round(sample * scale);
}

function readSamples(row, bitDepth) {
  if (bitDepth === 8) return row;
  if (bitDepth === 16) {
    const output = Buffer.alloc(row.length >> 1);
    for (let index = 0; index < output.length; index += 1) output[index] = row[index * 2];
    return output;
  }
  const samplesPerByte = 8 / bitDepth;
  const mask = (1 << bitDepth) - 1;
  const output = Buffer.alloc(row.length * samplesPerByte);
  for (let index = 0; index < row.length; index += 1) {
    for (let slot = 0; slot < samplesPerByte; slot += 1) {
      const shift = (samplesPerByte - 1 - slot) * bitDepth;
      output[index * samplesPerByte + slot] = (row[index] >> shift) & mask;
    }
  }
  return output;
}

/**
 * Decodifica um PNG em RGBA 8 bits.
 * @returns {{width:number,height:number,colorType:number,bitDepth:number,rgba:Uint8ClampedArray}}
 */
export function decodePng(buffer) {
  const info = parsePng(buffer);
  if (info.interlaced === 1) throw new Error('O decoder do Lia Forge não suporta PNG entrelaçado (Adam7).');
  if (info.width > MAX_DIMENSION || info.height > MAX_DIMENSION) {
    throw new Error(`O PNG excede a dimensão máxima suportada de ${MAX_DIMENSION}px.`);
  }

  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer.buffer ?? buffer, buffer.byteOffset ?? 0, buffer.byteLength);
  const idat = [];
  let palette = null;
  let transparency = null;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') transparency = data;
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (!idat.length) throw new Error('O PNG não contém dados IDAT.');

  const { width, height, bitDepth, colorType } = info;
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  const stride = Math.max(1, Math.ceil((width * channels * bitDepth) / 8));
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * height) throw new Error('O PNG declara mais pixels do que os dados comprimidos contêm.');

  const bpp = Math.max(1, Math.ceil((channels * bitDepth) / 8));
  const unfiltered = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filterType = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const current = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const rawByte = line[x];
      const left = x >= bpp ? current[x - bpp] : 0;
      const up = previous[x];
      const upLeft = x >= bpp ? previous[x - bpp] : 0;
      let value;
      switch (filterType) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + left; break;
        case 2: value = rawByte + up; break;
        case 3: value = rawByte + ((left + up) >> 1); break;
        case 4: value = rawByte + paeth(left, up, upLeft); break;
        default: throw new Error(`O PNG usa um tipo de filtro desconhecido (${filterType}).`);
      }
      current[x] = value & 0xff;
    }
    current.copy(unfiltered, y * stride);
    previous = current;
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  const samplesPerPixel = bitDepth === 16 ? 2 : 1;
  for (let y = 0; y < height; y += 1) {
    const rowBytes = bitDepth < 8
      ? readSamples(unfiltered.subarray(y * stride, (y + 1) * stride), bitDepth)
      : unfiltered.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;
      if (colorType === 6) {
        const base = x * 4 * samplesPerPixel;
        rgba[target] = expandToBytes(rowBytes[base], bitDepth);
        rgba[target + 1] = expandToBytes(rowBytes[base + samplesPerPixel], bitDepth);
        rgba[target + 2] = expandToBytes(rowBytes[base + 2 * samplesPerPixel], bitDepth);
        rgba[target + 3] = expandToBytes(rowBytes[base + 3 * samplesPerPixel], bitDepth);
      } else if (colorType === 2) {
        const base = x * 3 * samplesPerPixel;
        rgba[target] = expandToBytes(rowBytes[base], bitDepth);
        rgba[target + 1] = expandToBytes(rowBytes[base + samplesPerPixel], bitDepth);
        rgba[target + 2] = expandToBytes(rowBytes[base + 2 * samplesPerPixel], bitDepth);
        rgba[target + 3] = 255;
      } else if (colorType === 4) {
        const base = x * 2 * samplesPerPixel;
        const gray = expandToBytes(rowBytes[base], bitDepth);
        rgba[target] = gray;
        rgba[target + 1] = gray;
        rgba[target + 2] = gray;
        rgba[target + 3] = expandToBytes(rowBytes[base + samplesPerPixel], bitDepth);
      } else if (colorType === 0) {
        const gray = expandToBytes(rowBytes[x * samplesPerPixel], bitDepth);
        let alpha = 255;
        if (transparency && transparency.length >= 2) {
          const key = bitDepth === 16 ? transparency.readUInt16BE(0) : transparency[0];
          const sample = bitDepth === 16
            ? (rowBytes[x * 2] << 8) | rowBytes[x * 2 + 1]
            : rowBytes[x];
          if (sample === key) alpha = 0;
        }
        rgba[target] = gray;
        rgba[target + 1] = gray;
        rgba[target + 2] = gray;
        rgba[target + 3] = alpha;
      } else {
        const index = rowBytes[x];
        if (!palette || index * 3 + 2 >= palette.length) throw new Error('O PNG indexado referencia uma cor fora da paleta.');
        rgba[target] = palette[index * 3];
        rgba[target + 1] = palette[index * 3 + 1];
        rgba[target + 2] = palette[index * 3 + 2];
        rgba[target + 3] = transparency && index < transparency.length ? transparency[index] : 255;
      }
    }
  }
  return { width, height, colorType, bitDepth, rgba };
}

/**
 * Métricas de conteúdo de uma imagem RGBA.
 * `grid` opcional ({columns, rows}) mede a ocupação de cada célula — é o que
 * impede um atlas com células vazias de passar como sucesso.
 */
export function analyzePngContent(buffer, { grid = null, alphaThreshold = 8, colorSampleLimit = 262144 } = {}) {
  const { width, height, rgba } = decodePng(buffer);
  const total = width * height;
  let opaque = 0;
  let sumLuma = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const colors = new Map();
  const stride = Math.max(1, Math.ceil(total / colorSampleLimit));
  let sampled = 0;

  for (let index = 0, pixel = 0; pixel < total; pixel += 1, index += 4) {
    const alpha = rgba[index + 3];
    if (alpha > alphaThreshold) {
      opaque += 1;
      if (pixel % stride === 0) {
        const key = (rgba[index] << 16) | (rgba[index + 1] << 8) | rgba[index + 2];
        colors.set(key, (colors.get(key) ?? 0) + 1);
        sampled += 1;
      }
      const x = pixel % width;
      const y = (pixel - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    sumLuma += (rgba[index] * 299 + rgba[index + 1] * 587 + rgba[index + 2] * 114) / 1000;
  }

  const analysis = {
    width,
    height,
    totalPixels: total,
    opaquePixels: opaque,
    transparentPixels: total - opaque,
    coverage: total === 0 ? 0 : opaque / total,
    uniqueColors: colors.size,
    uniqueColorsSampled: sampled < total,
    dominantColors: [...colors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key, count]) => ({
        hex: `#${key.toString(16).padStart(6, '0')}`,
        count,
      })),
    boundingBox: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    meanLuma: total === 0 ? 0 : sumLuma / total,
    blank: opaque === 0,
  };

  if (grid) {
    if (!Number.isInteger(grid.columns) || !Number.isInteger(grid.rows) || grid.columns < 1 || grid.rows < 1) {
      throw new TypeError('analyzePngContent: grid precisa de columns/rows inteiros positivos');
    }
    const cellWidth = width / grid.columns;
    const cellHeight = height / grid.rows;
    if (!Number.isInteger(cellWidth) || !Number.isInteger(cellHeight)) {
      throw new Error(`A grade ${grid.columns}×${grid.rows} não divide a imagem ${width}×${height}.`);
    }
    const cells = [];
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        let cellOpaque = 0;
        for (let y = row * cellHeight; y < (row + 1) * cellHeight; y += 1) {
          for (let x = column * cellWidth; x < (column + 1) * cellWidth; x += 1) {
            if (rgba[(y * width + x) * 4 + 3] > alphaThreshold) cellOpaque += 1;
          }
        }
        cells.push({
          index: cells.length,
          column,
          row,
          x: column * cellWidth,
          y: row * cellHeight,
          width: cellWidth,
          height: cellHeight,
          opaquePixels: cellOpaque,
          coverage: cellOpaque / (cellWidth * cellHeight),
          empty: cellOpaque === 0,
        });
      }
    }
    return { ...analysis, grid: { columns: grid.columns, rows: grid.rows }, cells, emptyCells: cells.filter((cell) => cell.empty).length };
  }
  return analysis;
}

/**
 * Validação de conteúdo de artefato de imagem — obrigatória na produção.
 *
 * Falha fechada: um atlas totalmente transparente, uma imagem de uma cor só ou
 * células vazias onde o contrato exige frames são recusados como output
 * inválido, e não como sucesso silencioso (lacuna G8).
 */
export function validatePngContent(buffer, options = {}) {
  const {
    grid = null,
    minCoverage = 0.0005,
    minUniqueColors = 2,
    allowEmptyCells = false,
    label = 'imagem',
  } = options;
  const analysis = analyzePngContent(buffer, { grid });
  const problems = [];
  if (analysis.blank) problems.push(`${label} não tem nenhum pixel visível (100% transparente).`);
  else if (analysis.coverage < minCoverage) {
    problems.push(`${label} cobre apenas ${(analysis.coverage * 100).toFixed(3)}% dos pixels (mínimo ${(minCoverage * 100).toFixed(3)}%).`);
  }
  if (!analysis.blank && analysis.uniqueColors < minUniqueColors) {
    problems.push(`${label} tem apenas ${analysis.uniqueColors} cor(es) visível(is); parece um preenchimento sólido, não arte renderizada.`);
  }
  if (grid && !allowEmptyCells && analysis.emptyCells > 0) {
    const first = analysis.cells.filter((cell) => cell.empty).slice(0, 6).map((cell) => `#${cell.index}`).join(', ');
    problems.push(`${label} tem ${analysis.emptyCells} célula(s) vazia(s) na grade ${grid.columns}×${grid.rows} (${first}).`);
  }
  if (problems.length) {
    const error = new Error(problems.join(' '));
    error.code = 'ADAPTER_OUTPUT_INVALID';
    error.analysis = analysis;
    throw error;
  }
  return analysis;
}

export { PAETH_CACHE_LIMIT as _internalPaethCacheLimit };
