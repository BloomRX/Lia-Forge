/**
 * Leitura/escrita de PNG no processo principal (F7).
 *
 * Fino wrapper Node sobre o codec puro: mantém separados o que é algoritmo
 * (portável, testável, visível no Studio) e o que é I/O de disco.
 * Escrita sempre atômica (arquivo temporário + rename) e confinada ao
 * diretório informado pelo chamador — que já é validado pelo runner/adapter.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { decodePng, encodePngRgba, analyzePngContent } from '../qa/png-codec.mjs';
import { validatePngStructure } from '../qa/png.mjs';

export async function readPng(filePath) {
  const bytes = await fs.readFile(filePath);
  validatePngStructure(bytes);
  return decodePng(bytes);
}

export async function readPngContentMetrics(filePath, options = {}) {
  const bytes = await fs.readFile(filePath);
  return analyzePngContent(bytes, options);
}

export async function writePng(filePath, image) {
  const bytes = encodePngRgba(image.rgba, image.width, image.height);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, bytes, { flag: 'wx' });
  try {
    await fs.rename(temporary, filePath);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
  return { path: filePath, bytes: bytes.length, width: image.width, height: image.height };
}

export function encodePng(image) {
  return encodePngRgba(image.rgba, image.width, image.height);
}
