/**
 * Smoke de rig 2D + animação + VFX procedural (F7 — capacidades rig2d.*,
 * motion.cycles, vfx2d.generate, character.modularity).
 *
 * Tudo é executado de verdade: pixels produzidos, medidos e validados pelos
 * mesmos validadores que a produção usa.
 */

import assert from 'node:assert/strict';
import {
  createModularRig,
  createPresetAnimation,
  createRig,
  estimateSkeleton,
  renderAnimation,
  renderFrame,
  samplePose,
} from '../shared/rig2d/core.mjs';
import { generateVfxAtlas, generateVfxFrames, VFX_PRESETS } from '../shared/vfx/core.mjs';
import { createImage, decomposeParts } from '../shared/imaging/core.mjs';
import { encodePngRgba } from '../shared/qa/png-codec.mjs';
import { runValidator } from '../shared/qa/validators.mjs';
import { validatePngContent } from '../shared/qa/png-codec.mjs';

function buildCharacter() {
  const canvas = createImage(48, 64);
  const paint = (x0, y0, w, h, color) => {
    for (let y = y0; y < y0 + h; y += 1) {
      for (let x = x0; x < x0 + w; x += 1) canvas.rgba.set(color, (y * 48 + x) * 4);
    }
  };
  paint(18, 4, 12, 12, [240, 210, 190, 255]);   // cabeça
  paint(16, 17, 16, 22, [200, 60, 160, 255]);   // torso
  paint(8, 18, 6, 18, [180, 50, 140, 255]);     // braço esquerdo
  paint(34, 18, 6, 18, [180, 50, 140, 255]);    // braço direito
  paint(17, 40, 6, 20, [90, 40, 120, 255]);     // perna esquerda
  paint(25, 40, 6, 20, [90, 40, 120, 255]);     // perna direita
  return canvas;
}

const sprite = buildCharacter();
const decomposition = decomposeParts(sprite, { minArea: 16 });
assert.ok(decomposition.parts.length >= 4, `personagem deve renderizar partes, obtido ${decomposition.parts.length}`);

// esqueleto estimado + rig validado pelo validador de produção
const skeleton = estimateSkeleton(decomposition.parts, { canvasWidth: 48, canvasHeight: 64 });
assert.ok(skeleton.bones.some((bone) => bone.role === 'root'));
assert.ok(skeleton.bones.some((bone) => bone.role === 'torso'));
assert.equal(skeleton.needsReview, true, 'auto-rig heurístico exige revisão humana');
const rig = createRig({ parts: decomposition.parts, skeleton, id: 'aiko' });
const rigValidation = runValidator('rig2d-structural', { rig });
assert.equal(rigValidation.ok, true, `rig inválido: ${rigValidation.problems?.join('; ')}`);

// animações procedurais fecham ciclo e passam no validador
const animations = ['idle', 'walk', 'run', 'attack'].map((name) => createPresetAnimation(name, { bones: rig.bones }));
const animationValidation = runValidator('animation-loop', { animations });
assert.equal(animationValidation.ok, true, `animações inválidas: ${animationValidation.problems?.join('; ')}`);
assert.throws(() => createPresetAnimation('teleporte', { bones: rig.bones }), TypeError);

// amostragem de pose é contínua e limitada
const pose = samplePose(animations[1], 200);
assert.ok(Object.keys(pose).length > 0);
for (const value of Object.values(pose)) {
  assert.ok(Math.abs(value.rotation) <= 90, 'rotação fora do esperado para caminhada');
}

// render produz pixels reais (não uma tela vazia)
const partImages = Object.fromEntries(decomposition.parts.map((part) => [part.id, { width: part.width, height: part.height, rgba: part.rgba }]));
const frame = renderFrame({ rig, partImages, pose: samplePose(animations[0], 0), width: 48, height: 64 });
const framePng = encodePngRgba(frame.rgba, frame.width, frame.height);
const content = validatePngContent(framePng, { label: 'frame do rig 2D', minCoverage: 0.01, minUniqueColors: 3 });
assert.ok(content.coverage > 0.05, `cobertura do frame muito baixa: ${content.coverage}`);

// animação completa: frames diferentes entre si (não é uma imagem estática)
const rendered = renderAnimation({ rig, partImages, animation: animations[1], frameCount: 8, width: 48, height: 64 });
assert.equal(rendered.length, 8);
const signatures = new Set(rendered.map((image) => encodePngRgba(image.rgba, image.width, image.height).length + ':' + image.rgba.reduce((sum, value, index) => index % 97 === 0 ? sum + value : sum, 0)));
assert.ok(signatures.size > 1, 'frames de caminhada idênticos indicam pose não aplicada');

// modularidade: variantes compartilham o mesmo rig e as mesmas animações
const template = { ...rig, parts: rig.parts.map((part, index) => ({ ...part, slot: index === 0 ? 'head' : `slot-${index}` })), animations: animations.map((item) => item.name) };
const modular = createModularRig({ template, slots: { default: { head: 'head-a' }, helmet: { head: 'head-b' } } });
assert.deepEqual(Object.keys(modular.variants).sort(), ['default', 'helmet']);
assert.equal(modular.variants.helmet.sharedAnimations, true);
assert.throws(() => createModularRig({ template, slots: { x: { inexistente: 'y' } } }), TypeError);

// VFX procedural: determinístico por semente e diferente entre presets
const a = generateVfxFrames({ preset: 'explosion', size: 32, frameCount: 6, seed: 'lia' });
const b = generateVfxFrames({ preset: 'explosion', size: 32, frameCount: 6, seed: 'lia' });
const c = generateVfxFrames({ preset: 'explosion', size: 32, frameCount: 6, seed: 'outra' });
assert.deepEqual(Array.from(a.frames[2].rgba), Array.from(b.frames[2].rgba), 'mesma semente deve reproduzir os mesmos pixels');
assert.notDeepEqual(Array.from(a.frames[2].rgba), Array.from(c.frames[2].rgba), 'sementes diferentes devem mudar o resultado');
for (const preset of VFX_PRESETS) {
  const generated = generateVfxAtlas({ preset, size: 48, frameCount: 8, seed: `${preset}-seed` });
  const png = encodePngRgba(generated.atlas.image.rgba, generated.atlas.image.width, generated.atlas.image.height);
  const metrics = validatePngContent(png, { grid: { columns: generated.atlas.columns, rows: generated.atlas.rows }, label: `VFX ${preset}`, minUniqueColors: 3 });
  assert.ok(metrics.coverage > 0.001, `${preset} sem cobertura`);
  assert.equal(generated.atlas.emptyCells, 0, `${preset} com células vazias`);
}
assert.throws(() => generateVfxFrames({ preset: 'inexistente' }), TypeError);
assert.throws(() => generateVfxFrames({ preset: 'fire', size: 4 }), RangeError);

console.log(`Rig2D + VFX smoke test passed (${decomposition.parts.length} partes, ${animations.length} ações, ${VFX_PRESETS.length} presets de VFX).`);
