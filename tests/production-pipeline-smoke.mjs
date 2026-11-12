/**
 * Smoke de ponta a ponta do pipeline 2D/2.5D interno (F7 + F3).
 *
 * Executa de verdade, em disco temporário: imagem de entrada → separação de
 * partes → rig 2D → animações → frames → atlas → validação de conteúdo →
 * pacote de exportação por destino. Nenhum passo é simulado e nenhum artefato é
 * afirmado sem existir.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createAdapterRegistry } from '../electron/adapters/index.mjs';
import { createImage, decomposeParts } from '../shared/imaging/core.mjs';
import { writePng, readPng, readPngContentMetrics } from '../shared/imaging/png-io.mjs';
import { encodePngRgba, analyzePngContent } from '../shared/qa/png-codec.mjs';
import { createPresetAnimation, createRig, estimateSkeleton, renderAnimation } from '../shared/rig2d/core.mjs';
import { packAtlas } from '../shared/imaging/core.mjs';
import { validateSpritesheetContent } from '../shared/qa/spritesheet.mjs';
import { runValidator } from '../shared/qa/validators.mjs';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'lia-forge-pipeline-'));
const emitted = [];

function makeEmit(root) {
  return async (relativePath, bytes) => {
    const target = path.join(root, relativePath);
    assert.ok(target.startsWith(root), 'emit não pode escapar da pasta de saída');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
    emitted.push({ relativePath, bytes: bytes.length });
    return relativePath;
  };
}

const registry = createAdapterRegistry({
  findExternalTool: () => null,
  taskRegistry: { start: () => ({ child: {} }) },
  assertPathInsideProject: async (value) => value,
  buildBlenderSpritesheetArgs: () => [],
  runProcess: async () => {},
  validateSpritesheetFiles: () => ({ frameCount: 24, sheetWidth: 384, sheetHeight: 144 }),
  validateStageOutputs: () => {},
  getWorkflowClient: async () => ({ getComfyUiEndpoint: () => 'http://127.0.0.1:8188' }),
  hash: (bytes) => createHash('sha256').update(bytes).digest('hex'),
});

// 1) entrada: sprite de personagem gerado como dado de teste (não é arte final)
// Personagem de teste em 48×48 para respeitar o contrato de frame do produto
// (48×48, grade 8×3, atlas 384×144, 24 frames).
const sprite = createImage(48, 48);
const paint = (x0, y0, w, h, color) => {
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) sprite.rgba.set(color, (y * 48 + x) * 4);
};
paint(18, 2, 12, 10, [240, 210, 190, 255]);
paint(16, 13, 16, 16, [200, 60, 160, 255]);
paint(9, 14, 6, 13, [180, 50, 140, 255]);
paint(33, 14, 6, 13, [180, 50, 140, 255]);
paint(17, 30, 6, 15, [90, 40, 120, 255]);
paint(25, 30, 6, 15, [90, 40, 120, 255]);
const inputPath = path.join(workspace, 'input', 'sprite.png');
await writePng(inputPath, sprite);
const readBack = await readPng(inputPath);
assert.equal(readBack.width, 48);

// 2) separação de partes pelo adapter interno
const decomposed = await registry.adapter('local-image-ops').execute({
  op: 'decompose-parts',
  image: readBack,
  params: { minArea: 16 },
  emit: makeEmit(path.join(workspace, 'parts')),
});
assert.ok(decomposed.outputs.length >= 5, `partes insuficientes: ${decomposed.outputs.length}`);
assert.ok(decomposed.outputs.some((item) => item.endsWith('layers.json')));
assert.equal(decomposed.metrics.needsReview, true);
const layersJson = JSON.parse(await fs.readFile(path.join(workspace, 'parts', 'parts/layers.json'), 'utf8'));
assert.equal(runValidator('layers-integrity', { layers: layersJson.layers }).ok, true);

// 3) rig 2D + animações + atlas pelo adapter interno
const parts = decomposeParts(readBack, { minArea: 16 }).parts;
const skeleton = estimateSkeleton(parts, { canvasWidth: 48, canvasHeight: 48 });
const rig = createRig({ parts, skeleton, id: 'pipeline-character' });
const rigStep = await registry.adapter('rig2d-software').execute({
  task: 'build-rig',
  parts,
  params: { rigId: 'pipeline-character' },
  emit: makeEmit(path.join(workspace, 'rig')),
});
assert.deepEqual(rigStep.outputs, ['rig.json']);
assert.ok(rigStep.metrics.bones >= 5);
assert.equal(rigStep.metrics.validation.boneCount, rigStep.metrics.bones);

const animations = ['idle', 'walk', 'run'].map((name) => createPresetAnimation(name, { bones: rig.bones }));
const animateStep = await registry.adapter('rig2d-software').execute({
  task: 'animate',
  rig,
  params: { actions: 'idle,walk,run' },
  emit: makeEmit(path.join(workspace, 'anim')),
});
assert.equal(animateStep.metrics.animations.length, 3);

const partImages = Object.fromEntries(parts.map((part) => [part.id, { width: part.width, height: part.height, rgba: part.rgba }]));
const frames = [];
const frameNames = [];
for (const animation of animations) {
  const rendered = renderAnimation({ rig, partImages, animation, frameCount: 8, width: 48, height: 48 });
  rendered.forEach((frame, index) => {
    frames.push(frame);
    frameNames.push({ animation: animation.name, frame: index });
  });
}
assert.equal(frames.length, 24);
const atlas = packAtlas(frames, { columns: 8, rows: 3 });
const atlasPath = path.join(workspace, 'atlas', 'spritesheet.png');
await writePng(atlasPath, atlas.image);
assert.equal(atlas.sheetWidth, 384);
assert.equal(atlas.sheetHeight, 144);

// 4) manifesto no formato já usado pelo produto + validação de conteúdo (G8)
const manifest = {
  schemaVersion: 1,
  assetType: 'character',
  asset: 'pipeline-character',
  generator: 'lia-forge-rig2d-software',
  origin: 'top-left',
  anchor: 'feet',
  frameWidth: 48,
  frameHeight: 48,
  columns: 8,
  rows: 3,
  sheetWidth: 384,
  sheetHeight: 144,
  animations: ['idle', 'walk', 'run'],
  frames: frameNames.map((item, index) => ({
    filename: `${item.animation}-${String(item.frame).padStart(2, '0')}.png`,
    animation: item.animation,
    frame: item.frame,
    x: (index % 8) * 48,
    y: Math.floor(index / 8) * 48,
    width: 48,
    height: 48,
    pivot: { x: 24, y: 47 },
    durationMs: 83,
    sourceFrame: index,
  })),
};
const atlasBytes = await fs.readFile(atlasPath);
const content = validateSpritesheetContent(atlasBytes, manifest, { label: 'atlas do pipeline' });
assert.equal(content.frameCount, 24);
assert.equal(content.emptyFrames, 0);
assert.ok(content.coverage > 0.05, `cobertura baixa: ${content.coverage}`);
assert.equal(runValidator('spritesheet-manifest', { bytes: atlasBytes, manifest }).ok, true);

// 5) exportação para destino real (perfil + SHA-256 + notas de importação)
const exportStep = await registry.adapter('export-package').execute({
  destination: 'godot-4',
  artifacts: [
    { id: 'spritesheet', format: 'png', role: 'spritesheet', relativePath: 'spritesheet.png', bytes: atlasBytes },
    { id: 'manifest', format: 'json', role: 'manifest', relativePath: 'spritesheet.json', bytes: Buffer.from(JSON.stringify(manifest)) },
  ],
  asset: { id: 'pipeline-character', name: 'Personagem de pipeline', type: 'character' },
  workflowRunId: 'pipeline-smoke',
  manifest,
  params: { includeSequence: true },
  emit: makeEmit(path.join(workspace, 'export')),
});
assert.deepEqual(exportStep.outputs, ['export/godot-4/manifest.json', 'export/godot-4/frames.json']);
assert.equal(exportStep.metrics.files, 2);
assert.equal(exportStep.metrics.verifiedOnDestination, false);
const bundle = JSON.parse(await fs.readFile(path.join(workspace, 'export', 'export/godot-4/manifest.json'), 'utf8'));
assert.equal(bundle.destination, 'godot-4');
assert.equal(bundle.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)), true);

// 6) VFX procedural no mesmo fluxo
const vfxStep = await registry.adapter('rig2d-software').execute({
  task: 'render-vfx',
  params: { preset: 'impact', size: 48, frameCount: 8 },
  emit: makeEmit(path.join(workspace, 'vfx')),
});
assert.equal(vfxStep.metrics.deterministic, true);
const vfxBytes = await fs.readFile(path.join(workspace, 'vfx', 'vfx-impact.png'));
const vfxAnalysis = analyzePngContent(vfxBytes);
assert.ok(vfxAnalysis.coverage > 0.001);
assert.ok(vfxAnalysis.uniqueColors > 3);

// 7) métricas de conteúdo legíveis do disco (usadas pela interface)
const metrics = await readPngContentMetrics(atlasPath, { grid: { columns: 8, rows: 3 } });
assert.equal(metrics.cells.length, 24);
assert.equal(metrics.emptyCells, 0);

// 8) nada de instalação/download: o registro continua sem ferramentas externas
// 6 partes + layers.json + rig.json + animations.json + 2 de exportação + vfx
assert.equal(emitted.length, 12, `artefatos gravados pelos adapters: ${emitted.length}`);
await fs.rm(workspace, { recursive: true, force: true });

console.log(`Production pipeline smoke test passed (${emitted.length} artefatos gravados e validados em disco).`);
