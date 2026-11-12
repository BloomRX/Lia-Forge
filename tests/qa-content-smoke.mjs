/**
 * Smoke de QA compartilhado (F3) — fecha e prova a lacuna G8.
 *
 * Antes: `local-renderer-test/scripts/verify-output.cjs` recusava células
 * transparentes, mas o caminho de produção aceitava um atlas 100% transparente.
 * Agora o mesmo validador de conteúdo vale para os dois.
 */

import assert from 'node:assert/strict';
import { analyzePngContent, decodePng, encodePngRgba, validatePngContent } from '../shared/qa/png-codec.mjs';
import { validateSpritesheetContent } from '../shared/qa/spritesheet.mjs';
import { validatePngStructure } from '../shared/qa/png.mjs';
import { listValidators, runValidator } from '../shared/qa/validators.mjs';
import { createImage } from '../shared/imaging/core.mjs';

function spriteSheet({ columns = 8, rows = 3, frameWidth = 48, frameHeight = 48, filledFrames = 24, seed = 7 }) {
  const width = columns * frameWidth;
  const height = rows * frameHeight;
  const image = createImage(width, height);
  let counter = seed;
  for (let frame = 0; frame < filledFrames; frame += 1) {
    const originX = (frame % columns) * frameWidth;
    const originY = Math.floor(frame / columns) * frameHeight;
    for (let y = 8; y < frameHeight - 8; y += 1) {
      for (let x = 8; x < frameWidth - 8; x += 1) {
        counter = (counter * 1103515245 + 12345) % 2147483647;
        const index = ((originY + y) * width + originX + x) * 4;
        image.rgba[index] = 200 + (counter % 40);
        image.rgba[index + 1] = 60 + (counter % 90);
        image.rgba[index + 2] = 160 + (counter % 60);
        image.rgba[index + 3] = 255;
      }
    }
  }
  const frames = [];
  for (let frame = 0; frame < columns * rows; frame += 1) {
    frames.push({
      filename: `frame-${String(frame).padStart(2, '0')}.png`,
      animation: ['idle', 'walk', 'attack'][Math.floor(frame / columns)],
      frame: frame % columns,
      x: (frame % columns) * frameWidth,
      y: Math.floor(frame / columns) * frameHeight,
      width: frameWidth,
      height: frameHeight,
      pivot: { x: 24, y: 47 },
      durationMs: 80,
      sourceFrame: frame,
    });
  }
  return {
    bytes: encodePngRgba(image.rgba, width, height),
    manifest: { schemaVersion: 1, columns, rows, frameWidth, frameHeight, sheetWidth: width, sheetHeight: height, frames },
  };
}

// 1. atlas com conteúdo real passa
const good = spriteSheet({ filledFrames: 24 });
const goodResult = validateSpritesheetContent(good.bytes, good.manifest, { label: 'atlas' });
assert.equal(goodResult.frameCount, 24);
assert.equal(goodResult.emptyFrames, 0);
assert.ok(goodResult.coverage > 0.1, `cobertura esperada > 0.1, obtida ${goodResult.coverage}`);

// 2. atlas 100% transparente é recusado (G8)
const blank = spriteSheet({ filledFrames: 0 });
assert.throws(
  () => validateSpritesheetContent(blank.bytes, blank.manifest, { label: 'atlas' }),
  (error) => error.code === 'ADAPTER_OUTPUT_INVALID' && /100% transparente/.test(error.message),
);

// 3. frames vazios no meio do atlas são recusados e nomeados
const partial = spriteSheet({ filledFrames: 20 });
assert.throws(
  () => validateSpritesheetContent(partial.bytes, partial.manifest, { label: 'atlas' }),
  (error) => error.code === 'ADAPTER_OUTPUT_INVALID' && /frame\(s\) totalmente transparente/.test(error.message),
);

// 4. última linha incompleta é legítima quando o manifesto declara menos frames
const shortManifest = { ...good.manifest, frames: good.manifest.frames.slice(0, 20), rows: 3 };
const shortSheet = spriteSheet({ filledFrames: 20 });
const shortResult = validateSpritesheetContent(shortSheet.bytes, shortManifest, { label: 'atlas curto' });
assert.equal(shortResult.frameCount, 20);

// 5. codec round-trip e métricas
const decoded = decodePng(good.bytes);
assert.equal(decoded.width, 384);
assert.equal(decoded.height, 144);
const metrics = analyzePngContent(good.bytes, { grid: { columns: 8, rows: 3 } });
assert.equal(metrics.cells.length, 24);
assert.equal(metrics.emptyCells, 0);
assert.ok(metrics.uniqueColors > 8);
assert.deepEqual(metrics.boundingBox, { x: 8, y: 8, width: 368, height: 128 });

// 6. validação estrutural continua independente do conteúdo
assert.equal(validatePngStructure(good.bytes, { requireRgba8: true }).colorType, 6);
assert.throws(() => validatePngStructure(Buffer.from('não é png')), /estrutura PNG completa/);

// 7. registro de validadores: desconhecido falha fechado
const validators = listValidators();
for (const expected of ['png-structural', 'png-rgba8', 'png-content', 'spritesheet-manifest', 'glb-structural', 'layers-integrity', 'rig2d-structural', 'animation-loop', 'destination-profile']) {
  assert.ok(validators.includes(expected), `validador ${expected} ausente do registro`);
}
const unknown = runValidator('validador-inexistente', {});
assert.equal(unknown.ok, false);
assert.match(unknown.problems[0], /desconhecido/);

// 8. o validador de conteúdo usado pelo contrato png-content recusa imagem sólida
const solid = createImage(16, 16, [255, 0, 0, 255]);
const solidResult = runValidator('png-content', { bytes: encodePngRgba(solid.rgba, 16, 16), label: 'sólida' });
assert.equal(solidResult.ok, false);
assert.match(solidResult.problems[0], /preenchimento sólido/);

// 9. imagem com conteúdo passa pelo mesmo validador
const contentResult = runValidator('png-content', { bytes: good.bytes, label: 'atlas' });
assert.equal(contentResult.ok, true);
assert.ok(contentResult.metrics.coverage > 0.1);

console.log('QA content smoke test passed (lacuna G8 fechada: atlas transparente recusado na produção).');
