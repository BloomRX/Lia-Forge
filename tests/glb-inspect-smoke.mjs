/**
 * Smoke de inspeção GLB (F7 — capacidade model3d.inspect) e do adapter interno.
 */

import assert from 'node:assert/strict';
import { inspectGlb, summarizeGlb } from '../shared/model3d/glb.mjs';
import { runValidator } from '../shared/qa/validators.mjs';
import { createAdapterRegistry } from '../electron/adapters/index.mjs';
import { buildGlbFixture } from './glb-fixtures.mjs';

const glb = buildGlbFixture();
const info = inspectGlb(glb);

assert.equal(info.version, 2);
assert.equal(info.byteLength, glb.byteLength);
assert.equal(info.meshCount, 1);
assert.equal(info.triangleCount, 12);
assert.equal(info.vertexCount, 8);
assert.equal(info.materials.length, 1);
assert.equal(info.textures, 1);
assert.equal(info.images[0].mimeType, 'image/png');
assert.equal(info.animationCount, 1);
assert.deepEqual([...info.animationNames], ['idle']);
assert.equal(info.animations[0].durationSeconds, 0.66);
assert.equal(info.skinned, true);
assert.equal(info.skins[0].joints, 1);
assert.equal(info.generator, 'lia-forge-test-fixture');
assert.ok(info.chunks.some((chunk) => chunk.type === 'JSON') && info.chunks.some((chunk) => chunk.type === 'BIN'));
assert.match(summarizeGlb(info), /1 mesh\(es\)/);

// validador de produção aceita o fixture e recusa o que não é GLB
assert.equal(runValidator('glb-structural', { bytes: glb }).ok, true);
assert.equal(runValidator('glb-structural', { bytes: Buffer.from('não é glb nem tem 20 bytes') }).ok, false);
const truncated = Buffer.from(glb);
truncated.writeUInt32LE(glb.byteLength + 8, 8);
assert.equal(runValidator('glb-structural', { bytes: truncated }).ok, false);
const badMagic = buildGlbFixture({ magic: 0xdeadbeef });
assert.throws(() => inspectGlb(badMagic), /Assinatura glTF ausente/);
assert.throws(() => inspectGlb(buildGlbFixture().subarray(0, 12)), /menor que um cabeçalho/);

// sem animação: o inspetor reporta zero, não inventa
const staticInfo = inspectGlb(buildGlbFixture({ withAnimation: false }));
assert.equal(staticInfo.animationCount, 0);
assert.equal(staticInfo.skinned, false);

// adapter interno produz relatório gravado via emit injetado
const written = [];
const registry = createAdapterRegistry({
  findExternalTool: () => null,
  taskRegistry: { start: () => ({ child: {} }) },
  assertPathInsideProject: async (value) => value,
  buildBlenderSpritesheetArgs: () => [],
  runProcess: async () => {},
  validateSpritesheetFiles: () => ({}),
  validateStageOutputs: () => {},
  getWorkflowClient: async () => ({ getComfyUiEndpoint: () => 'http://127.0.0.1:8188' }),
  hash: () => 'a'.repeat(64),
});
const result = await registry.adapter('glb-inspect').execute({
  bytes: glb,
  emit: async (relativePath, bytes) => { written.push({ relativePath, bytes: bytes.length }); return relativePath; },
});
assert.deepEqual(result.outputs, ['model-report.json']);
assert.equal(written.length, 1);
assert.equal(result.metrics.triangleCount, 12);
assert.match(result.note, /1 animação/);

console.log('GLB inspect smoke test passed (fixture de 12 triângulos inspecionado de ponta a ponta).');
