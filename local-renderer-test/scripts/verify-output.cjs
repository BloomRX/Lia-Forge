#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inflateSync } = require('node:zlib');
const { validateSpritesheetFiles } = require('../../electron/blender-adapter.cjs');

const [outputArgument, modelArgument, blenderExecutable, subject] = process.argv.slice(2);
if (!outputArgument || !modelArgument || !blenderExecutable || !subject) {
  console.error('Uso: node verify-output.cjs <output-dir> <combined.blend> <blender-executable> <subject-id>');
  process.exit(2);
}

const outputDirectory = path.resolve(outputArgument);
const modelPath = path.resolve(modelArgument);
const pngPath = path.join(outputDirectory, 'spritesheet.png');
const metadataPath = path.join(outputDirectory, 'spritesheet.json');
const reportPath = path.join(outputDirectory, 'validation-report.json');
const frameSize = { width: 48, height: 48 };
const expectedAnimations = ['idle', 'walk', 'run'];
const expectedSheet = { width: 384, height: 144 };

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  const digest = crypto.createHash('sha256');
  const fileDescriptor = fs.openSync(filePath, 'r');
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fileDescriptor, chunk, 0, chunk.length, null);
      if (bytesRead > 0) digest.update(chunk.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fileDescriptor);
  }
  return digest.digest('hex');
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function decodeRgba8Png(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error('Assinatura PNG inválida.');

  let width = 0;
  let height = 0;
  let bitDepth = null;
  let colorType = null;
  let interlace = null;
  const idatChunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > buffer.length) throw new Error(`Chunk ${type} está truncado.`);
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
      interlace = buffer[dataStart + 12];
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(dataStart, dataStart + length));
    } else if (type === 'IEND') {
      break;
    }
    offset = chunkEnd;
  }

  if (!width || !height || bitDepth !== 8 || colorType !== 6 || interlace !== 0 || idatChunks.length === 0) {
    throw new Error('Decodificador de evidência aceita somente PNG RGBA8 não entrelaçado com IDAT.');
  }
  const rowBytes = width * 4;
  const filtered = inflateSync(Buffer.concat(idatChunks));
  const expectedLength = height * (rowBytes + 1);
  if (filtered.length !== expectedLength) {
    throw new Error(`Dados PNG descomprimidos têm ${filtered.length} bytes; eram esperados ${expectedLength}.`);
  }

  const pixels = Buffer.alloc(height * rowBytes);
  let sourceOffset = 0;
  let previousRow = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filterType = filtered[sourceOffset];
    sourceOffset += 1;
    const row = Buffer.alloc(rowBytes);
    for (let index = 0; index < rowBytes; index += 1) {
      const raw = filtered[sourceOffset];
      sourceOffset += 1;
      const left = index >= 4 ? row[index - 4] : 0;
      const above = previousRow[index];
      const upperLeft = index >= 4 ? previousRow[index - 4] : 0;
      let predictor;
      if (filterType === 0) predictor = 0;
      else if (filterType === 1) predictor = left;
      else if (filterType === 2) predictor = above;
      else if (filterType === 3) predictor = Math.floor((left + above) / 2);
      else if (filterType === 4) predictor = paethPredictor(left, above, upperLeft);
      else throw new Error(`Filtro PNG desconhecido: ${filterType}.`);
      row[index] = (raw + predictor) & 0xff;
    }
    row.copy(pixels, y * rowBytes);
    previousRow = row;
  }
  return { width, height, pixels };
}

function extractCell(image, row, column, cellWidth, cellHeight) {
  const bytesPerCellRow = cellWidth * 4;
  const data = Buffer.alloc(bytesPerCellRow * cellHeight);
  let alphaPixels = 0;
  let minX = cellWidth;
  let minY = cellHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < cellHeight; y += 1) {
    const sourceStart = ((row * cellHeight + y) * image.width + column * cellWidth) * 4;
    const sourceEnd = sourceStart + bytesPerCellRow;
    const targetStart = y * bytesPerCellRow;
    image.pixels.copy(data, targetStart, sourceStart, sourceEnd);
    for (let x = 0; x < cellWidth; x += 1) {
      const alphaOffset = targetStart + x * 4 + 3;
      if (data[alphaOffset] > 0) {
        alphaPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      } else {
        // Ignore arbitrary RGB values in transparent pixels when comparing poses.
        const pixelOffset = targetStart + x * 4;
        data[pixelOffset] = 0;
        data[pixelOffset + 1] = 0;
        data[pixelOffset + 2] = 0;
      }
    }
  }

  return {
    alphaPixels,
    alphaCoverage: Number((alphaPixels / (cellWidth * cellHeight)).toFixed(6)),
    visibleBounds: maxX < 0 ? null : { minX, minY, maxX, maxY },
    sha256: sha256(data),
    pixels: data,
  };
}

function changedPixelCount(first, second) {
  let changed = 0;
  for (let offset = 0; offset < first.length; offset += 4) {
    if (first[offset + 3] === 0 && second[offset + 3] === 0) continue;
    if (first[offset] !== second[offset]
      || first[offset + 1] !== second[offset + 1]
      || first[offset + 2] !== second[offset + 2]
      || first[offset + 3] !== second[offset + 3]) changed += 1;
  }
  return changed;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

try {
  if (!fs.existsSync(modelPath) || !fs.statSync(modelPath).isFile() || fs.statSync(modelPath).size === 0) {
    throw new Error(`Modelo de entrada ausente/vazio: ${modelPath}`);
  }
  const pngBuffer = fs.readFileSync(pngPath);
  const metadataBuffer = fs.readFileSync(metadataPath);
  const metadata = JSON.parse(metadataBuffer.toString('utf8'));
  const structural = validateSpritesheetFiles({
    pngBuffer,
    metadata,
    frameSize,
    assetType: 'character',
    animations: expectedAnimations,
  });
  if (structural.sheetWidth !== expectedSheet.width || structural.sheetHeight !== expectedSheet.height) {
    throw new Error(`Dimensões reais inesperadas: ${structural.sheetWidth}×${structural.sheetHeight}; esperado 384×144.`);
  }
  if (metadata.asset !== subject) {
    throw new Error(`O manifesto identifica ${JSON.stringify(metadata.asset)}; o esperado era ${JSON.stringify(subject)}.`);
  }

  const image = decodeRgba8Png(pngBuffer);
  if (image.width !== expectedSheet.width || image.height !== expectedSheet.height) {
    throw new Error('Dimensões decodificadas do atlas não correspondem à grade esperada.');
  }

  const issues = [];
  const actions = [];
  for (let row = 0; row < expectedAnimations.length; row += 1) {
    const name = expectedAnimations[row];
    const frames = [];
    for (let column = 0; column < 8; column += 1) {
      const cell = extractCell(image, row, column, frameSize.width, frameSize.height);
      if (cell.alphaPixels === 0) issues.push(`${name} frame ${column}: célula totalmente transparente.`);
      frames.push({
        frame: column,
        alphaPixels: cell.alphaPixels,
        alphaCoverage: cell.alphaCoverage,
        visibleBounds: cell.visibleBounds,
        sha256: cell.sha256,
        pixels: cell.pixels,
      });
    }
    const uniqueHashes = new Set(frames.map((frame) => frame.sha256));
    const adjacentChangedPixels = [];
    for (let index = 0; index < frames.length - 1; index += 1) {
      adjacentChangedPixels.push(changedPixelCount(frames[index].pixels, frames[index + 1].pixels));
    }
    const hasPixelVariation = uniqueHashes.size > 1 && adjacentChangedPixels.some((count) => count > 0);
    if ((name === 'walk' || name === 'run') && !hasPixelVariation) {
      issues.push(`${name}: os oito frames não mostram variação de pixels entre poses.`);
    }
    actions.push({
      name,
      frameCount: frames.length,
      nonTransparentFrames: frames.filter((frame) => frame.alphaPixels > 0).length,
      distinctFrameCount: uniqueHashes.size,
      hasPixelVariation,
      adjacentChangedPixels,
      frames: frames.map(({ pixels, ...summary }) => summary),
    });
  }

  const blenderVersionResult = spawnSync(blenderExecutable, ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  });
  const blenderVersion = blenderVersionResult.error
    ? `version query failed: ${blenderVersionResult.error.message}`
    : `${blenderVersionResult.stdout || ''}${blenderVersionResult.stderr || ''}`.trim();
  if (blenderVersionResult.status !== 0) issues.push('Não foi possível confirmar novamente a versão do executável Blender informado.');

  const modelStats = fs.statSync(modelPath);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: issues.length ? 'checks_blocked' : 'checks_passed_visual_review_required',
    subject,
    toolchain: {
      nodeVersion: process.version,
      platform: `${process.platform}-${process.arch}`,
      blenderExecutable,
      blenderVersion,
      blenderVersionExitCode: blenderVersionResult.status,
    },
    input: {
      path: modelPath,
      sizeBytes: modelStats.size,
      sha256: sha256File(modelPath),
    },
    outputs: {
      png: { path: pngPath, sizeBytes: pngBuffer.length, sha256: sha256(pngBuffer) },
      manifest: { path: metadataPath, sizeBytes: metadataBuffer.length, sha256: sha256(metadataBuffer) },
    },
    structuralChecks: {
      rgba8PngAndManifest: 'PASS',
      dimensions: `${image.width}x${image.height}`,
      grid: '8x3',
      frameSize: '48x48',
      frameCount: structural.frameCount,
      requiredActionOrder: expectedAnimations,
      allCellsContainVisibleAlphaPixels: issues.some((issue) => issue.includes('célula totalmente transparente')) ? 'FAIL' : 'PASS',
    },
    actionPixelChecks: actions,
    issues,
    visualReview: {
      status: 'required',
      checklist: [
        'inspecionar manualmente as 24 células do atlas em tamanho nativo',
        'confirmar corpo inteiro, recorte, escala e pivô dos pés',
        'revisar deformação do rig, poses, loop e foot sliding',
        'confirmar visualmente que as ações correspondem a idle, walk e run',
      ],
    },
    limitations: [
      'Pixels com alpha e variação entre frames não comprovam a semântica nem a qualidade da animação.',
      'O relatório é verificação local automatizada; a aprovação visual continua humana e não é registrada automaticamente.',
    ],
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  if (issues.length) {
    console.error(`Checks bloqueados. Relatório preservado em ${reportPath}`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(`Checks estruturais e de pixels aprovados; revisão visual ainda obrigatória. Relatório: ${reportPath}`);
  }
} catch (error) {
  fail(`Verificação não concluída: ${error.message}`);
}
