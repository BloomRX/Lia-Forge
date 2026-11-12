/**
 * Smoke de operações de imagem 2D (F7 — capacidades image2d.*).
 * Determinístico: mesmas entradas produzem exatamente os mesmos pixels.
 */

import assert from 'node:assert/strict';
import {
  alphaBounds,
  chromaKey,
  composeLayers,
  createImage,
  cropImage,
  decomposeParts,
  flipImage,
  outlineImage,
  packAtlas,
  recolor,
  resizeImage,
  rgbToHsl,
  hslToRgb,
} from '../shared/imaging/core.mjs';
import { encodePngRgba, decodePng } from '../shared/qa/png-codec.mjs';

function filled(width, height, color) {
  return createImage(width, height, color);
}

// create/crop/resize
const base = filled(16, 16, [10, 20, 30, 255]);
const cropped = cropImage(base, 4, 4, 8, 8);
assert.equal(cropped.width, 8);
assert.equal(cropped.rgba[0], 10);
assert.throws(() => cropImage(base, 10, 10, 10, 10), RangeError);
const resized = resizeImage(base, 8, 8, { filter: 'nearest' });
assert.equal(resized.width, 8);
const bilinear = resizeImage(base, 32, 32, { filter: 'bilinear' });
assert.equal(bilinear.width, 32);
assert.throws(() => resizeImage(base, 4, 4, { filter: 'cubic' }), TypeError);

// chroma-key remove o fundo verde e preserva o resto
const keyed = createImage(4, 4, [0, 255, 0, 255]);
keyed.rgba.set([200, 60, 160, 255], 0);
const result = chromaKey(keyed, { color: [0, 255, 0], tolerance: 24 });
assert.equal(result.image.rgba[3], 255, 'pixel colorido não pode ser removido');
assert.equal(result.image.rgba[7], 0, 'fundo verde deve ficar transparente');
assert.equal(result.removedPixels, 15);

// recolor por substituição e por matiz
const swapped = recolor(keyed, { from: [0, 255, 0], to: [0, 0, 255] });
assert.deepEqual([swapped.rgba[4], swapped.rgba[5], swapped.rgba[6]], [0, 0, 255]);
const shifted = recolor(filled(2, 2, [255, 0, 0, 255]), { hueShift: 120 });
assert.ok(shifted.rgba[1] > 200, 'matiz deslocado deve virar verde');

// conversão de cor ida e volta
const [h, s, l] = rgbToHsl(241, 124, 190);
const back = hslToRgb(h, s, l);
assert.ok(Math.abs(back[0] - 241) <= 1 && Math.abs(back[1] - 124) <= 1 && Math.abs(back[2] - 190) <= 1);

// flip e outline
const flipped = flipImage(keyed, 'x');
assert.equal(flipped.rgba[3], 255, 'espelhamento horizontal move o pixel para o outro lado');
const outlined = outlineImage(keyed, { color: [0, 0, 0, 255] });
assert.equal(alphaBounds(outlined).width, 4);

// composição de camadas com opacidade
const bottom = filled(8, 8, [255, 0, 0, 255]);
const top = filled(4, 4, [0, 0, 255, 128]);
const composed = composeLayers([{ ...bottom }, { ...top, x: 2, y: 2, opacity: 1 }], { width: 8, height: 8 });
assert.equal(composed.rgba[(2 * 8 + 2) * 4 + 2] > 100, true, 'camada superior deve aparecer');
assert.equal(composed.rgba[0], 255, 'fundo permanece fora da camada superior');

// separação de partes por conectividade
const sprite = createImage(24, 24);
for (let y = 2; y < 8; y += 1) for (let x = 9; x < 15; x += 1) sprite.rgba.set([240, 200, 180, 255], (y * 24 + x) * 4);
for (let y = 9; y < 20; y += 1) for (let x = 8; x < 16; x += 1) sprite.rgba.set([200, 60, 160, 255], (y * 24 + x) * 4);
const decomposition = decomposeParts(sprite, { minArea: 4 });
assert.equal(decomposition.parts.length, 2, 'duas massas desconexas devem virar duas partes');
assert.equal(decomposition.needsReview, true, 'ordem de oclusão estimada exige revisão humana');
assert.ok(decomposition.parts.every((part) => part.reconstruction === 'none'), 'nenhum pixel pode ser inventado');
assert.equal(decomposition.parts[0].drawOrder, 0);
const noise = decomposeParts(sprite, { minArea: 1000 });
assert.equal(noise.parts.length, 0, 'área mínima descarta ruído');

// atlas empacotado sem células vazias
const frames = [filled(8, 8, [10, 200, 90, 255]), filled(8, 8, [200, 10, 90, 255]), filled(8, 8, [90, 10, 200, 255])];
const atlas = packAtlas(frames, { columns: 3 });
assert.equal(atlas.sheetWidth, 24);
assert.equal(atlas.rows, 1);
assert.equal(atlas.emptyCells, 0);

// round-trip PNG preserva pixels
const png = encodePngRgba(atlas.image.rgba, atlas.image.width, atlas.image.height);
const decoded = decodePng(png);
assert.equal(decoded.width, 24);
assert.deepEqual(Array.from(decoded.rgba.slice(0, 4)), [10, 200, 90, 255]);

console.log('Imaging smoke test passed (operações 2D determinísticas).');
