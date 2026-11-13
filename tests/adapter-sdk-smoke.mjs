/**
 * Smoke do Adapter SDK (F2).
 *
 * Cobre: os 15 campos do contrato único, as três classes e suas proibições,
 * redação de segredos, códigos de erro, avaliação de compatibilidade
 * (desconhecido ≠ compatível) e a migração real dos dois adapters que estavam
 * inline em `electron/main.cjs`.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  ADAPTER_CLASSES,
  BACKEND_KINDS,
  ERROR_CODES,
  PROTECTED_ACTIONS,
  defineExecutionAdapter,
  defineManualEditingTool,
  defineRemoteServiceAdapter,
  evaluateCompatibility,
  redactSecrets,
} from '../shared/adapters/sdk.mjs';
import os from 'node:os';
import path from 'node:path';
import { createAdapterRegistry } from '../electron/adapters/index.mjs';
import { MANIFEST as BLENDER_MANIFEST } from '../electron/adapters/blender-spritesheet.mjs';
import { MANIFEST as COMFY_MANIFEST } from '../electron/adapters/comfyui-concept.mjs';

const REQUIRED_FIELDS = [
  'id', 'version', 'class', 'capabilities', 'requirements', 'configuration',
  'inputContracts', 'outputContracts', 'execution', 'progress', 'cancel',
  'errors', 'logs', 'provenance', 'cost', 'backends', 'health', 'evidence',
];

function stubDependencies() {
  return {
    findExternalTool: () => null,
    taskRegistry: { start: () => ({ child: {} }) },
    assertPathInsideProject: async (value) => value,
    buildBlenderSpritesheetArgs: () => [],
    runProcess: async () => {},
    validateSpritesheetFiles: () => ({ frameCount: 24, sheetWidth: 384, sheetHeight: 144 }),
    validateStageOutputs: () => {},
    getWorkflowClient: async () => ({ getComfyUiEndpoint: () => 'http://127.0.0.1:8188' }),
    hash: (bytes) => createHash('sha256').update(bytes).digest('hex'),
  };
}

const registry = createAdapterRegistry(stubDependencies());
assert.equal(registry.ids.length, 7, 'registro deve expor os 7 adapters (2 migrados + remoto + 4 internos)');

for (const manifest of registry.manifests()) {
  for (const field of REQUIRED_FIELDS) {
    assert.notEqual(manifest[field], undefined, `${manifest.id}: campo ${field} ausente`);
  }
  assert.ok(ADAPTER_CLASSES.includes(manifest.class), `${manifest.id}: classe inválida`);
  assert.ok(manifest.capabilities.length > 0, `${manifest.id}: sem capacidades`);
  assert.ok(manifest.backends.length > 0, `${manifest.id}: sem backend`);
  for (const backend of manifest.backends) assert.ok(BACKEND_KINDS.includes(backend.kind));
  for (const code of manifest.errors) assert.ok(ERROR_CODES.includes(code), `${manifest.id}: erro ${code} fora do vocabulário`);
  for (const action of manifest.protectedActions) {
    assert.ok(PROTECTED_ACTIONS.includes(action), `${manifest.id}: ação protegida desconhecida ${action}`);
  }
  assert.equal(manifest.logs.redacted, true, `${manifest.id}: logs precisam ser redigidos`);
  assert.ok(manifest.logs.maxEntries <= 1200, `${manifest.id}: teto de logs acima de 1200`);
  // honestidade: nada afirma hardware validado sem evidência
  assert.equal(
    manifest.backends.some((backend) => backend.validated && !manifest.evidence.tests.length),
    false,
    `${manifest.id}: backend validado sem testes apontados`,
  );
}

// --- migração preservou identidade e gates dos adapters inline --------------
assert.equal(BLENDER_MANIFEST.id, 'blender-spritesheet');
// `class` é preenchido pelo SDK ao normalizar; o MANIFEST cru é a definição.
assert.equal(registry.adapter('blender-spritesheet').manifest.class, 'execution');
assert.ok(BLENDER_MANIFEST.capabilities.includes('render3d.to2d'));
assert.equal(BLENDER_MANIFEST.provenance.license, 'GPL-2.0-or-later');
assert.equal(BLENDER_MANIFEST.cost.status, 'not-applicable');
assert.equal(COMFY_MANIFEST.id, 'comfyui-concept');
assert.equal(registry.adapter('comfyui-concept').manifest.class, 'execution');
assert.equal(COMFY_MANIFEST.backends[0].kind, 'local-http-loopback');
assert.equal(COMFY_MANIFEST.requirements.network, false, 'adapter local não pode declarar rede');

// adapter Blender bloqueado sem ferramenta: descoberta diz missing, execução bloqueia
const blender = registry.adapter('blender-spritesheet');
const discovery = await blender.discover();
assert.equal(discovery.status, 'missing');
assert.match(discovery.detail, /não é instalado automaticamente|Instale por conta própria/);
await assert.rejects(
  () => blender.execute({ asset: { name: 'Aiko', type: 'character' }, projectRoot: '/tmp/x' }),
  (error) => error.code === 'WORKFLOW_BLOCKED' && /Blender não foi detectado/.test(error.message),
);
// caminho configurado que não existe não vira ferramenta disponível
const caminhoInvalido = createAdapterRegistry({
  ...stubDependencies(),
  configuration: { 'blender-spritesheet': { executable: path.join(os.tmpdir(), `lia-blender-inexistente-${process.pid}`) } },
}).adapter('blender-spritesheet');
const discoveryInvalida = await caminhoInvalido.discover();
assert.equal(discoveryInvalida.status, 'missing', 'caminho configurado inválido não pode ser descoberto como disponível');
assert.match(discoveryInvalida.detail, /não existe ou não é executável/);
await assert.rejects(
  () => caminhoInvalido.execute({ asset: { name: 'Aiko', type: 'character' }, projectRoot: '/tmp/x' }),
  (error) => error.code === 'WORKFLOW_BLOCKED' && /não existe ou não é executável/.test(error.message),
);
// contrato incompleto também bloqueia (gate preservado); o executável aqui é
// real (o próprio Node) para isolar o motivo: falta de contrato, não de binário
await assert.rejects(
  () => createAdapterRegistry({ ...stubDependencies(), configuration: { 'blender-spritesheet': { executable: process.execPath } } })
    .adapter('blender-spritesheet')
    .execute({ asset: { name: 'Aiko', type: 'character' }, projectRoot: '/tmp/x' }),
  (error) => error.code === 'WORKFLOW_BLOCKED' && /contrato Blender/.test(error.message),
);

// --- três classes: regras que não se misturam ------------------------------
const manualTool = defineManualEditingTool(
  {
    id: 'krita-manual',
    version: '0.1.0',
    title: 'Krita (edição manual)',
    capabilities: ['image2d.illustration'],
    requirements: { ramMb: 1024 },
    backends: [{ kind: 'local-process' }],
    cost: { status: 'not-applicable' },
    provenance: { license: 'GPL-3.0-only' },
    evidence: { tests: ['tests/adapter-sdk-smoke.mjs'] },
  },
  { discover: async () => ({ status: 'available' }), launch: async () => ({ launched: true }) },
);
assert.equal(manifestClass(manualTool), 'manual-editing');
assert.equal(manualTool.execute, null, 'ferramenta de edição manual não pode executar');
assert.equal(manualTool.describe().canExecute, false);

assert.throws(
  () => defineManualEditingTool(
    { id: 'krita-bad', version: '0.1.0', title: 'x', capabilities: ['image2d.illustration'], backends: [{ kind: 'local-process' }], cost: { status: 'not-applicable' } },
    { discover: async () => ({}), launch: async () => ({}), execute: async () => ({}) },
  ),
  /must not execute/,
);

assert.throws(
  () => defineRemoteServiceAdapter(
    { id: 'remote-bad', version: '0.1.0', title: 'x', capabilities: ['image2d.generate-concept'], backends: [{ kind: 'local-process' }], cost: { status: 'unknown' } },
    { discover: async () => ({}), execute: async () => ({}) },
  ),
  /remote backend|reconcile/,
);

const remote = registry.adapter('comfyui-remote');
assert.equal(remote.manifest.class, 'remote-service');
assert.equal(remote.manifest.cost.status, 'unknown', 'serviço remoto precisa declarar custo (unknown é aceitável)');
assert.equal(typeof remote.reconcile, 'function');
await assert.rejects(
  () => remote.execute({ configuration: { endpoint: 'https://worker.example' }, prompt: 'x' }),
  (error) => error.code === 'ADAPTER_SEND_UNAUTHORIZED',
);
const loopbackProbe = await remote.discover({ configuration: { endpoint: 'http://127.0.0.1:8188' } });
assert.equal(loopbackProbe.status, 'blocked', 'adapter remoto deve recusar loopback');
const reconcile = await remote.reconcile({ runRecord: {}, executionResult: { outputs: [] } });
assert.equal(reconcile.reconciled, false);
assert.ok(reconcile.problems.length >= 2);

// --- redação de segredos ---------------------------------------------------
assert.equal(redactSecrets('api_key=abc123def456'), 'api_key=[REDACTED]');
assert.equal(redactSecrets('Bearer sk-ABCDEFGH12345678'), 'Bearer [REDACTED]');
assert.equal(redactSecrets('https://x.dev/run?token=deadbeefcafe'), 'https://x.dev/run?token=[REDACTED]');
assert.equal(redactSecrets('sem segredo aqui'), 'sem segredo aqui');

// --- compatibilidade: desconhecido nunca vira compatível -------------------
const compat = evaluateCompatibility({
  manifest: registry.adapter('comfyui-concept').manifest,
  capability: { id: 'image2d.generate-concept' },
  machine: { os: 'linux', ramMb: 16384, vramMb: null, gpu: null },
});
assert.equal(compat.compatible, false, 'VRAM não medido não pode resultar em compatível');
assert.ok(compat.unknowns.some((item) => /VRAM/.test(item)));
assert.equal(compat.verified, false);

const compatOk = evaluateCompatibility({
  manifest: registry.adapter('comfyui-concept').manifest,
  capability: { id: 'image2d.generate-concept' },
  machine: { os: 'linux', ramMb: 16384, vramMb: 8192 },
});
assert.equal(compatOk.compatible, true);

const wrongCapability = evaluateCompatibility({
  manifest: registry.adapter('comfyui-concept').manifest,
  capability: { id: 'render3d.to2d' },
  machine: { ramMb: 999999, vramMb: 999999 },
});
assert.equal(wrongCapability.compatible, false);
assert.ok(wrongCapability.blockers.some((item) => /não declara a capacidade/.test(item)));

// --- validação fail-closed do manifesto ------------------------------------
assert.throws(() => defineExecutionAdapter({ id: 'Sem-Maiuscula', version: '1', title: 'x', capabilities: ['a'], backends: [{ kind: 'local-process' }] }, { discover: async () => ({}), execute: async () => ({}) }), /stable id/);
assert.throws(() => defineExecutionAdapter({ id: 'ok', version: '1', title: 'x', capabilities: [], backends: [{ kind: 'local-process' }] }, { discover: async () => ({}), execute: async () => ({}) }), /at least one capability/);
assert.throws(() => defineExecutionAdapter({ id: 'ok', version: '1', title: 'x', capabilities: ['a'], backends: [] }, { discover: async () => ({}), execute: async () => ({}) }), /backend/);
assert.throws(() => defineExecutionAdapter({ id: 'ok', version: '1', title: 'x', capabilities: ['a'], backends: [{ kind: 'local-process' }], cost: { status: 'known' } }, { discover: async () => ({}), execute: async () => ({}) }), /cost/);
assert.throws(() => defineExecutionAdapter({ id: 'ok', version: '1', title: 'x', capabilities: ['a'], backends: [{ kind: 'local-process' }] }, { execute: async () => ({}) }), /discover/);

// --- canHandle: hook opcional de adequação ao passo -------------------------
assert.throws(
  () => defineExecutionAdapter(
    { id: 'ok', version: '1', title: 'x', capabilities: ['a'], backends: [{ kind: 'local-process' }] },
    { discover: async () => ({}), execute: async () => ({}), canHandle: 'não é função' },
  ),
  /canHandle/,
  'canHandle que não é função é recusado no manifesto',
);

const blenderAdapter = registry.adapter('blender-spritesheet');
assert.equal(typeof blenderAdapter.canHandle, 'function', 'o adapter Blender declara quando serve ao passo');
const blenderOn2dAtlas = blenderAdapter.canHandle({
  capabilityId: 'render.atlas',
  upstreamCapabilities: ['rig2d.build', 'rig2d.animate'],
  params: { task: 'render', frameSize: '48x48' },
});
assert.equal(blenderOn2dAtlas.ok, false, 'Blender não serve ao atlas que vem do rig 2D');
assert.match(blenderOn2dAtlas.reason, /material 3D/, 'e diz o motivo (só entra quando recebe material 3D)');
assert.equal(blenderAdapter.canHandle({ capabilityId: 'render.atlas', upstreamCapabilities: ['render3d.frame'], params: { task: 'pack-atlas' } }).ok, true,
  'Blender serve ao atlas de renders 3D');
assert.equal(blenderAdapter.canHandle({ capabilityId: 'motion.cycles', upstreamCapabilities: ['rig3d.auto'] }).ok, true,
  'Blender serve aos ciclos de um rig 3D');
assert.equal(blenderAdapter.canHandle({ capabilityId: 'render3d.to2d', upstreamCapabilities: [] }).ok, true,
  'capacidade exclusiva do Blender nunca é filtrada');
assert.equal(blenderAdapter.canHandle({ capabilityId: 'render.atlas', upstreamCapabilities: [], params: { model: 'input/modelo.glb' } }).ok, true,
  'modelo 3D informado pelo usuário também qualifica o passo');

const rig2dAdapter = registry.adapter('rig2d-software');
assert.equal(typeof rig2dAdapter.canHandle, 'function', 'o renderer 2D declara quando serve ao passo');
assert.equal(rig2dAdapter.canHandle({ capabilityId: 'render.atlas', params: { task: 'render' }, upstreamCapabilities: ['render3d.frame'] }).ok, false,
  'o renderer 2D não desenha frames sem rig 2D de montante');
assert.equal(rig2dAdapter.canHandle({ capabilityId: 'render.atlas', params: { task: 'render' }, upstreamCapabilities: ['rig2d.build', 'rig2d.animate'] }).ok, true,
  'com rig 2D de montante, ele desenha');
assert.equal(rig2dAdapter.canHandle({ capabilityId: 'render.atlas', params: { task: 'pack-atlas' }, upstreamCapabilities: ['render3d.frame'] }).ok, true,
  'pack-atlas organiza PNGs de qualquer origem');
assert.equal(rig2dAdapter.canHandle({ capabilityId: 'motion.cycles', upstreamCapabilities: ['rig3d.auto'] }).ok, false,
  'ações de rig 3D não são do renderer 2D');
assert.equal(rig2dAdapter.canHandle({ capabilityId: 'rig2d.build', upstreamCapabilities: [] }).ok, true,
  'capacidade própria do renderer 2D nunca é filtrada');

assert.equal(registry.adapter('local-image-ops').canHandle, null, 'adapter sem critério declarado segue candidato como antes');
assert.equal(registry.adapter('export-package').canHandle, null, 'idem para o empacotador de destino');

function manifestClass(adapter) {
  return adapter.manifest.class;
}

console.log(`Adapter SDK smoke test passed (${registry.ids.length} adapters, ${ADAPTER_CLASSES.length} classes).`);
