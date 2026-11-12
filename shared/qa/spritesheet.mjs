/**
 * Validação de conteúdo de spritesheet/atlas (F3 — lacuna G8).
 *
 * O manifesto estrutural (`electron/spritesheet-manifest.cjs`) confere grade,
 * pivôs e nomes. Este módulo confere o que estava faltando na produção: se cada
 * frame declarado realmente tem pixels. Um atlas 100% transparente ou com
 * frames vazios deixa de ser aceito como sucesso.
 *
 * As células verificadas são exatamente as declaradas em `manifest.frames`
 * (x/y/width/height), portanto células de sobra na grade — quando a quantidade
 * de frames não preenche a última linha — não contam como falha.
 */

import { analyzePngContent } from './png-codec.mjs';

export const SPRITESHEET_CONTENT_LIMITS = Object.freeze({
  minFrameCoverage: 0.002,
  minFrameUniqueColors: 1,
  maxFrames: 4096,
});

/**
 * @param {Buffer|Uint8Array} buffer PNG decodificável
 * @param {{frameWidth:number,frameHeight:number,columns:number,rows:number,
 *          sheetWidth:number,sheetHeight:number,frames:Array<object>}} manifest
 *        manifesto já validado estruturalmente
 * @param {{minFrameCoverage?:number,allowEmptyFrames?:boolean,label?:string}} options
 */
export function validateSpritesheetContent(buffer, manifest, options = {}) {
  const {
    minFrameCoverage = SPRITESHEET_CONTENT_LIMITS.minFrameCoverage,
    allowEmptyFrames = false,
    label = 'spritesheet',
  } = options;

  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.frames)) {
    throw new TypeError('validateSpritesheetContent: manifesto sem frames');
  }
  if (manifest.frames.length > SPRITESHEET_CONTENT_LIMITS.maxFrames) {
    throw new Error(`${label} declara ${manifest.frames.length} frames (máximo ${SPRITESHEET_CONTENT_LIMITS.maxFrames}).`);
  }

  const analysis = analyzePngContent(buffer, {
    grid: { columns: manifest.columns, rows: manifest.rows },
  });
  const problems = [];

  if (analysis.blank) {
    problems.push(`${label} não tem nenhum pixel visível: o render produziu um atlas 100% transparente.`);
  }

  const emptyFrames = [];
  const sparseFrames = [];
  for (const [index, frame] of manifest.frames.entries()) {
    const column = Math.round(frame.x / manifest.frameWidth);
    const row = Math.round(frame.y / manifest.frameHeight);
    const cell = analysis.cells?.[row * manifest.columns + column];
    if (!cell) {
      problems.push(`${label}: o frame ${index} (${frame.filename ?? 'sem nome'}) está fora da grade declarada.`);
      continue;
    }
    if (cell.empty) emptyFrames.push(index);
    else if (cell.coverage < minFrameCoverage) sparseFrames.push({ index, coverage: cell.coverage });
  }

  if (!allowEmptyFrames && emptyFrames.length) {
    const sample = emptyFrames.slice(0, 8).join(', ');
    problems.push(`${label} tem ${emptyFrames.length} frame(s) totalmente transparente(s): índices ${sample}${emptyFrames.length > 8 ? ', …' : ''}.`);
  }
  if (sparseFrames.length) {
    const sample = sparseFrames.slice(0, 4).map((item) => `#${item.index} ${(item.coverage * 100).toFixed(2)}%`).join(', ');
    problems.push(`${label} tem ${sparseFrames.length} frame(s) com menos de ${(minFrameCoverage * 100).toFixed(1)}% de cobertura: ${sample}.`);
  }

  if (problems.length) {
    const error = new Error(problems.join(' '));
    error.code = 'ADAPTER_OUTPUT_INVALID';
    error.analysis = {
      coverage: analysis.coverage,
      opaquePixels: analysis.opaquePixels,
      totalPixels: analysis.totalPixels,
      emptyFrames,
      sparseFrames: sparseFrames.map((item) => item.index),
      boundingBox: analysis.boundingBox,
    };
    throw error;
  }

  return Object.freeze({
    coverage: analysis.coverage,
    opaquePixels: analysis.opaquePixels,
    frameCount: manifest.frames.length,
    emptyFrames: 0,
    boundingBox: analysis.boundingBox,
    uniqueColors: analysis.uniqueColors,
  });
}

/** Métricas de conteúdo sem julgamento — usadas por relatórios e pela interface. */
export function inspectSpritesheetContent(buffer, manifest) {
  return analyzePngContent(buffer, { grid: { columns: manifest.columns, rows: manifest.rows } });
}
