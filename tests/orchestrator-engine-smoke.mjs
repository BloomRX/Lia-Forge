/**
 * Smoke do Orchestrator + Hub + DAG + Execution Manager (F5).
 *
 * Cobre planejamento (sem execução), resolução de provider com estado real,
 * validação de grafo, e os comportamentos exigidos pelo requisito §8:
 * estados, checkpoints, retomada, retry, timeout, cancelamento, logs,
 * progresso, custo, proveniência e os gates de autorização/revisão/entrada.
 */

import assert from 'node:assert/strict';
import { buildDag, dependentsOf, readySteps, scheduleBatch, summarizeDag, DagError } from '../shared/engine/dag.mjs';
import { ExecutionManager } from '../shared/engine/execution-manager.mjs';
import { authorizationFingerprint, checkAuthorization, checkInputs, checkReview, redactSecrets } from '../shared/engine/gates.mjs';
import { createProviderHub, discoverHub } from '../shared/hub/provider-hub.mjs';
import { listWorkflows, planWorkflow, WORKFLOW_IDS, WORKFLOW_RECIPES } from '../shared/orchestrator/planner.mjs';
import { createCapabilityRegistry } from '../shared/capabilities/registry.mjs';
import { createAdapterRegistry } from '../electron/adapters/index.mjs';

// ---------------------------------------------------------------- DAG
const dag = buildDag([
  { id: 'a', adapter: 'x' },
  { id: 'b', adapter: 'x', dependsOn: ['a'] },
  { id: 'c', adapter: 'x', dependsOn: ['a'] },
  { id: 'd', adapter: 'x', dependsOn: ['b', 'c'] },
]);
assert.deepEqual([...dag.order], ['a', 'b', 'c', 'd']);
assert.deepEqual(dag.levels.map((level) => [...level]), [['a'], ['b', 'c'], ['d']]);
assert.equal(dag.depth, 3);
assert.deepEqual([...readySteps(dag, { a: 'succeeded' })], ['b', 'c']);
assert.deepEqual([...readySteps(dag, { a: 'running' })], []);
assert.deepEqual([...dependentsOf(dag, 'a')].sort(), ['b', 'c', 'd']);
assert.throws(() => buildDag([{ id: 'a', adapter: 'x', dependsOn: ['b'] }, { id: 'b', adapter: 'x', dependsOn: ['a'] }]), DagError);
assert.throws(() => buildDag([{ id: 'a', adapter: 'x', dependsOn: ['a'] }]), /si mesmo/);
assert.throws(() => buildDag([{ id: 'a', adapter: 'x', dependsOn: ['zzz'] }]), /não existe no plano/);
assert.throws(() => buildDag([{ id: 'A Maiúsculo', adapter: 'x' }]), /id estável/);
assert.throws(() => buildDag([{ id: 'a', adapter: 'x' }, { id: 'a', adapter: 'y' }]), /duplicado/);

// escalonamento com limite de recursos
const states = { a: 'succeeded' };
const serial = scheduleBatch({ dag, states, limits: { maxConcurrent: 1 } });
assert.deepEqual([...serial.batch], ['b']);
const parallel = scheduleBatch({ dag, states, limits: { maxConcurrent: 4 } });
assert.deepEqual([...parallel.batch], ['b', 'c']);
const withRunning = scheduleBatch({ dag, states: { a: 'succeeded', b: 'running' }, limits: { maxConcurrent: 2 } });
assert.deepEqual([...withRunning.batch], ['c']);
const ramLimited = scheduleBatch({
  dag: buildDag([{ id: 'a', adapter: 'x', resources: { ramMb: 900 } }, { id: 'b', adapter: 'x', resources: { ramMb: 900 } }]),
  states: {},
  limits: { maxConcurrent: 4, ramMb: 1000 },
});
assert.deepEqual([...ramLimited.batch], ['a']);
assert.equal(ramLimited.deferred[0].reason, 'limit-ram');

// ---------------------------------------------------------------- gates
const scope = { plan: ['a', 'b'], adapters: ['x'], protectedActions: ['cost'], costCeiling: null };
const fingerprint = authorizationFingerprint(scope);
assert.equal(checkAuthorization({ scope, authorization: { granted: true, fingerprint } }).ok, true);
assert.equal(checkAuthorization({ scope, authorization: { granted: true, fingerprint: 'outro' } }).code, 'authorization-scope-changed');
assert.equal(checkAuthorization({ scope, authorization: null }).code, 'authorization-missing');
assert.equal(checkAuthorization({ scope: { ...scope, costCeiling: 10 }, authorization: { granted: true, fingerprint } }).code, 'authorization-scope-changed');

const bytes = Buffer.from('conteúdo revisado');
assert.equal(checkReview({ artifactBytes: bytes, review: null }).code, 'review-missing');
assert.equal(checkReview({ artifactBytes: bytes, review: { approved: true, sha256: 'x'.repeat(64) } }).code, 'review-invalidated');
const digest = checkReview({ artifactBytes: bytes, review: null }).sha256;
assert.equal(checkReview({ artifactBytes: bytes, review: { approved: true, sha256: digest, reviewer: 'humano' } }).ok, true);

const inputs = checkInputs({ inputs: [{ id: 'ref', bytes: Buffer.from('a') }], recorded: {} });
assert.equal(inputs.ok, true);
const changed = checkInputs({ inputs: [{ id: 'ref', bytes: Buffer.from('b') }], recorded: inputs.inputs });
assert.equal(changed.ok, false);
assert.equal(changed.problems[0].code, 'input-changed');
assert.equal(redactSecrets('token=abc123456789'), 'token=[REDACTED]');

// ---------------------------------------------------------------- Hub
const registry = createCapabilityRegistry();
const adapterRegistry = createAdapterRegistry({
  findExternalTool: () => null,
  taskRegistry: { start: () => ({ child: {} }) },
  assertPathInsideProject: async (value) => value,
  buildBlenderSpritesheetArgs: () => [],
  runProcess: async () => {},
  validateSpritesheetFiles: () => ({ frameCount: 24, sheetWidth: 384, sheetHeight: 144 }),
  validateStageOutputs: () => {},
  getWorkflowClient: async () => ({ getComfyUiEndpoint: () => 'http://127.0.0.1:8188', getComfyUiStatus: async () => ({ available: false }) }),
  hash: () => 'a'.repeat(64),
});
const adapters = adapterRegistry.all();
const { hub } = await discoverHub({ registry, adapters, machine: { os: 'linux', ramMb: 3939 } });

const conceptCandidates = hub.candidatesFor('image2d.generate-concept');
assert.equal(conceptCandidates.length, 2, 'conceito 2D tem adapter local e remoto');
assert.equal(conceptCandidates[0].adapterId, 'comfyui-concept');
assert.notEqual(conceptCandidates[0].state, 'ready', 'ComfyUI não está rodando: não pode aparecer como pronto');
const remoteCandidate = conceptCandidates.find((item) => item.adapterId === 'comfyui-remote');
assert.equal(remoteCandidate.state, 'blocked');
assert.equal(remoteCandidate.requiresAuthorization, true);

assert.equal(hub.select('image2d.transform').selected.adapterId, 'local-image-ops');
assert.equal(hub.select('image2d.generate-concept').selected, null);
assert.match(hub.select('image2d.generate-concept').reason, /Nenhum candidato utilizável/);
assert.equal(hub.select('model3d.generate').selected, null, 'geração 3D não tem provider: nunca pode ser oferecida');
const states2 = hub.capabilityStates();
assert.equal(states2.find((item) => item.id === 'image2d.transform').state, 'ready');
assert.equal(states2.find((item) => item.id === 'model3d.generate').state, 'no-provider');

// ---------------------------------------------------------------- Orchestrator
const workflows = listWorkflows({ hub, registry });
assert.equal(workflows.length, WORKFLOW_IDS.length);
assert.equal(workflows.length >= 8, true, 'requisito §12.1 exige no mínimo 8 workflows');

const executable = workflows.filter((workflow) => workflow.executableNow).map((workflow) => workflow.id);
// Cinco workflows rodam apenas com adapters internos (nenhuma ferramenta externa)
for (const expected of ['2d-character-parts', '2d-modular-character', '2d-animation', 'ui-vfx-sheet', 'variation-retexture']) {
  assert.ok(executable.includes(expected), `${expected} deveria ser planejável só com adapters internos; executáveis: ${executable.join(', ')}`);
}
// Os que dependem de Blender/ComfyUI precisam aparecer bloqueados com motivo,
// nunca como disponíveis (requisito §3: nunca apresentar ferramenta ausente).
const objectRender = workflows.find((workflow) => workflow.id === '3d-object-render');
assert.equal(objectRender.executableNow, false);
const objectPlan = planWorkflow({ workflowId: '3d-object-render', hub, registry, destination: 'godot-4' });
assert.equal(objectPlan.blocked, true);
assert.equal(objectPlan.steps[0].adapter, 'glb-inspect', 'inspeção GLB é interna e funciona sem Blender');
assert.equal(objectPlan.steps[1].adapter, null);
// Duas razões distintas de bloqueio, cada uma nomeada: falta o modelo do usuário
// (nada é baixado) e falta o Blender para renderizar.
const inspectBlock = objectPlan.blockedSteps.find((item) => item.id === 'inspect');
const renderBlock = objectPlan.blockedSteps.find((item) => item.id === 'render');
assert.match(inspectBlock.reason, /model/, 'o passo de inspeção pede o modelo do usuário');
assert.match(renderBlock.reason, /render3d.frame|Nenhum candidato/);
assert.deepEqual(
  objectPlan.pendingInputs.map((item) => item.param),
  ['model'],
  'o plano declara a entrada pendente antes de executar',
);
assert.equal(objectPlan.steps[0].blockedReason !== null, true, 'passo bloqueado pelo plano carrega o motivo');
// Com o modelo informado, o passo de inspeção deixa de estar bloqueado no plano.
const withModel = planWorkflow({ workflowId: '3d-object-render', hub, registry, destination: 'godot-4', options: { model: 'input/modelo.glb' } });
assert.equal(withModel.pendingInputs.length, 0, 'informar o modelo remove a pendência de entrada');
assert.equal(withModel.steps[0].blockedReason, null);
assert.equal(withModel.blocked, true, 'o render continua bloqueado: Blender não está instalado');
assert.match(withModel.blockedSteps[0].reason, /render3d.frame|Nenhum candidato/);
const conceptWorkflow = workflows.find((workflow) => workflow.id === '2d-art-concept');
assert.equal(conceptWorkflow.executableNow, false, 'conceito 2D depende de ComfyUI, que não está rodando');
// 2d-animation reutiliza um rig revisado: sem o run de origem o plano diz o que
// falta, em vez de falhar no meio do pipeline.
const animationWorkflow = workflows.find((workflow) => workflow.id === '2d-animation');
assert.deepEqual(
  animationWorkflow.needsInput.map((item) => item.kind),
  ['priorRun'],
  'a lista de workflows declara que 2d-animation precisa de um run de origem',
);
const animationPlan = planWorkflow({ workflowId: '2d-animation', hub, registry, destination: 'godot-4' });
assert.equal(animationPlan.blocked, true);
assert.match(animationPlan.blockedSteps[0].reason, /run de origem/);
assert.equal(animationPlan.userActions[0].canBeAutomated, false, 'escolher o run de origem é decisão humana');
const animationReady = planWorkflow({ workflowId: '2d-animation', hub, registry, destination: 'godot-4', options: { fromRun: 'run-origem' } });
assert.equal(animationReady.blocked, false, 'com o run de origem informado, o plano fica executável');
assert.deepEqual(animationReady.steps.map((step) => step.id), ['rig', 'animate', 'render', 'deliver']);

const humanoid = workflows.find((workflow) => workflow.id === '3d-character-spritesheet');
assert.equal(humanoid.executableNow, false);
assert.ok(humanoid.blocked >= 2, 'geração 3D e auto-rig precisam aparecer bloqueados');

const plan = planWorkflow({ workflowId: '2d-character-parts', hub, registry, destination: 'godot-4', brief: { prompt: 'guarda florestal' } });
assert.equal(plan.blocked, false);
assert.equal(plan.steps.length, WORKFLOW_RECIPES['2d-character-parts'].steps.length);
assert.deepEqual(plan.reviewGates, ['decompose', 'rig']);
assert.match(plan.note, /nada foi executado/i, 'o plano precisa declarar que nada foi executado');
assert.ok(plan.requirements.perStep.length > 0);
assert.ok(plan.validators.includes('spritesheet-manifest'));
assert.equal(plan.steps[0].adapter, 'local-image-ops');
assert.equal(plan.steps[3].adapter, 'rig2d-software');
assert.equal(plan.steps[4].adapter, 'export-package');

const blockedPlan = planWorkflow({ workflowId: '3d-character-spritesheet', hub, registry, destination: 'lia-desktop' });
assert.equal(blockedPlan.blocked, true);
assert.equal(blockedPlan.preservesContract, 'humanoid-prompt-views-to-2d-v1');
const blockedIds = blockedPlan.blockedSteps.map((item) => item.id);
assert.ok(blockedIds.includes('generate-3d') && blockedIds.includes('auto-rig'), `passos bloqueados: ${blockedIds.join(', ')}`);
for (const blocked of blockedPlan.blockedSteps) {
  assert.ok(blocked.reason && blocked.reason.length > 10, 'bloqueio precisa de motivo nomeado');
}
assert.equal(blockedPlan.steps.find((step) => step.id === 'generate-3d').adapter, null);
assert.ok(blockedPlan.userActions.some((action) => action.kind === 'decision' || action.kind === 'install'));
assert.ok(blockedPlan.userActions.every((action) => action.canBeAutomated === false));
// render 2D continua ligado ao adapter Blender (contrato preservado); sem
// Blender detectado o passo fica bloqueado, mas o provider segue nomeado
const renderStep = blockedPlan.steps.find((step) => step.id === 'render-2d');
assert.equal(renderStep.capability, 'render3d.to2d');
assert.ok(renderStep.candidates.some((candidate) => candidate.adapterId === 'blender-spritesheet' && candidate.state === 'missing'));
assert.equal(renderStep.adapter, null, 'sem Blender detectado, o passo não pode ter adapter');

// com Blender descoberto, o mesmo plano passa a usar o adapter real
const hubWithBlender = hub.withDiscoveries(new Map([
  ['blender-spritesheet', { adapterId: 'blender-spritesheet', status: 'available', version: '4.2.0', executable: '/usr/bin/blender', checkedAt: new Date().toISOString() }],
]));
assert.equal(hubWithBlender.select('render3d.to2d').selected.adapterId, 'blender-spritesheet');
const planWithBlender = planWorkflow({ workflowId: '3d-character-spritesheet', hub: hubWithBlender, registry, destination: 'lia-desktop' });
assert.equal(planWithBlender.steps.find((step) => step.id === 'render-2d').adapter, 'blender-spritesheet');
assert.equal(planWithBlender.steps.find((step) => step.id === 'render-2d').blockedReason, null);
assert.ok(planWithBlender.licenses.some((item) => item.license === 'GPL-2.0-or-later'));
assert.ok(blockedPlan.protectedActions.includes('download_models_or_weights'));

// plano remoto só com autorização explícita
const remotePlan = planWorkflow({ workflowId: '2d-art-concept', hub, registry, allowRemote: false });
assert.equal(remotePlan.steps[0].adapter, null);
const remoteAllowed = planWorkflow({ workflowId: '2d-art-concept', hub, registry, allowRemote: true });
assert.equal(remoteAllowed.steps[0].adapter, null, 'serviço remoto continua bloqueado sem autorização registrada');
assert.throws(() => planWorkflow({ workflowId: 'inexistente', hub, registry }), TypeError);

// ---------------------------------------------------------------- Execution Manager
const artifacts = new Map();
let flakyCalls = 0;
function fakeAdapter(id, behaviour = async () => ({ outputs: ['out.png'] })) {
  return { manifest: { id, version: '9.9.9', provenance: { license: 'MIT', outputRights: 'usuário' } }, execute: behaviour };
}

const events = [];
const persisted = [];
const manager = new ExecutionManager({
  resolveAdapter: async (adapterId) => {
    if (adapterId === 'ok') return fakeAdapter('ok', async ({ stepId, params }) => {
      artifacts.set(stepId, Buffer.from(`artefato-${stepId}`));
      return { outputs: [`${stepId}.png`], artifactBytes: artifacts.get(stepId), cost: { status: 'known', unit: 'segundos', value: params?.seconds ?? 1 }, note: `passo ${stepId} concluído` };
    });
    if (adapterId === 'fail') return fakeAdapter('fail', async () => { throw new Error('falha simulada token=abc123456789'); });
    if (adapterId === 'slow') return fakeAdapter('slow', async ({ signal }) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ outputs: ['late.png'] }), 5000);
      signal?.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('cancelado'), { code: 'WORKFLOW_CANCELLED' })); }, { once: true });
    }));
    if (adapterId === 'flaky') {
      // contador fora do factory: resolveAdapter é chamado a cada tentativa
      return fakeAdapter('flaky', async () => {
        flakyCalls += 1;
        if (flakyCalls < 3) throw new Error('instável');
        return { outputs: ['flaky.png'] };
      });
    }
    throw new Error(`adapter desconhecido ${adapterId}`);
  },
  persist: async (snapshot) => persisted.push(snapshot),
  onEvent: (event) => events.push(event),
});

// 1) execução serial com sucesso, custo, proveniência e hash
const okRun = await manager.execute({
  id: 'plano-ok',
  steps: [
    { id: 'a', adapter: 'ok', params: { seconds: 2 } },
    { id: 'b', adapter: 'ok', dependsOn: ['a'] },
  ],
}, { context: {} });
assert.equal(okRun.status, 'succeeded');
assert.deepEqual(okRun.steps.map((step) => step.state), ['succeeded', 'succeeded']);
assert.equal(okRun.steps[0].sha256.length, 64);
assert.equal(okRun.cost.status, 'known');
assert.equal(okRun.provenance.length, 2);
assert.equal(okRun.provenance[0].license, 'MIT');
assert.ok(events.some((event) => event.type === 'run-started') && events.some((event) => event.type === 'run-finished'));
assert.ok(persisted.length >= 1);

// 2) falha propaga: dependentes são pulados e o segredo é redigido no log
const failRun = await manager.execute({
  steps: [
    { id: 'a', adapter: 'fail' },
    { id: 'b', adapter: 'ok', dependsOn: ['a'] },
  ],
});
assert.equal(failRun.status, 'failed');
assert.equal(failRun.steps[0].state, 'failed');
assert.equal(failRun.steps[1].state, 'skipped');
assert.equal(failRun.steps[0].error.message.includes('abc123456789'), false, 'segredo não pode aparecer no erro');
assert.ok(JSON.stringify(failRun.logs).includes('[REDACTED]'));

// 3) retry declarado recupera passo instável
const retryRun = await manager.execute({
  steps: [{ id: 'a', adapter: 'flaky', retry: { maxAttempts: 3, backoffMs: 1 } }],
});
assert.equal(retryRun.status, 'succeeded');
assert.equal(retryRun.steps[0].attempts, 3);

// 4) timeout cancela o passo
const timeoutRun = await manager.execute({ steps: [{ id: 'a', adapter: 'slow', timeoutMs: 30 }] });
assert.equal(timeoutRun.status, 'cancelled');
assert.equal(timeoutRun.steps[0].state, 'cancelled');

// 5) cancelamento externo
const cancellation = manager.createCancellation();
const cancelRunPromise = manager.execute({ steps: [{ id: 'a', adapter: 'slow' }, { id: 'b', adapter: 'ok', dependsOn: ['a'] }] }, { signal: cancellation.signal });
setTimeout(() => cancellation.cancel('usuário desistiu'), 20);
const cancelRun = await cancelRunPromise;
assert.equal(cancelRun.status, 'cancelled');
assert.notEqual(cancelRun.steps[1].state, 'succeeded');

// 6) gate de autorização bloqueia o run inteiro
const blockedRun = await manager.execute(
  { steps: [{ id: 'a', adapter: 'ok' }] },
  { scope: { plan: ['a'], adapters: ['ok'], protectedActions: [] }, authorization: { granted: true, fingerprint: 'errado' } },
);
assert.equal(blockedRun.status, 'blocked');
assert.equal(blockedRun.steps[0].state, 'blocked');
assert.equal(blockedRun.gates.at(-1).code, 'authorization-scope-changed');

// 7) gate de revisão: passo reviewRequired sem aprovação humana não avança
const reviewRun = await manager.execute({ steps: [{ id: 'a', adapter: 'ok', reviewRequired: true }, { id: 'b', adapter: 'ok', dependsOn: ['a'] }] });
assert.equal(reviewRun.status, 'blocked');
assert.equal(reviewRun.steps[0].state, 'blocked');
assert.equal(reviewRun.steps[1].state, 'skipped');

// 8) retomada com checkpoint válido reutiliza passo; com entrada alterada, não
const firstRun = await manager.execute({ steps: [{ id: 'a', adapter: 'ok' }, { id: 'b', adapter: 'ok', dependsOn: ['a'] }] }, { context: { inputs: { ref: Buffer.from('v1') } } });
const checkpoints = Object.fromEntries(firstRun.steps.map((step) => [step.id, { stepId: step.id, adapter: step.adapter, outputs: step.outputs, sha256: step.sha256, inputs: { ref: firstRun.inputs.ref }, finishedAt: step.finishedAt }]));
const resumed = await manager.execute(
  { steps: [{ id: 'a', adapter: 'ok', inputs: [{ id: 'ref', sha256: firstRun.inputs.ref }] }, { id: 'b', adapter: 'ok', dependsOn: ['a'] }] },
  { checkpoints, resume: true, context: { inputs: { ref: firstRun.inputs.ref } } },
);
assert.equal(resumed.steps[0].reused, true);
assert.ok(resumed.events.some((event) => event.type === 'step-reused'));

const invalidated = await manager.execute(
  { steps: [{ id: 'a', adapter: 'ok', inputs: [{ id: 'ref', sha256: firstRun.inputs.ref }] }] },
  { checkpoints, resume: true, context: { inputs: { ref: 'outro-conteudo' } } },
);
assert.equal(invalidated.steps[0].reused, false);
assert.ok(invalidated.events.some((event) => event.type === 'resume-invalidated'));

// 9) ação protegida sem cobertura na autorização bloqueia o passo
const protectedScope = { plan: ['a'], adapters: ['ok'], protectedActions: ['download_models_or_weights'] };
const protectedRun = await manager.execute(
  { steps: [{ id: 'a', adapter: 'ok', protectedActions: ['download_models_or_weights'] }] },
  // autorização válida para o escopo, mas sem cobrir a ação protegida do passo
  { scope: protectedScope, authorization: { granted: true, fingerprint: authorizationFingerprint(protectedScope), protectedActions: [] } },
);
assert.equal(protectedRun.status, 'blocked');
assert.equal(protectedRun.steps[0].state, 'blocked');
assert.equal(protectedRun.steps[0].error.code, 'protected-action');
assert.match(protectedRun.steps[0].error.message, /exige autorização explícita/);
assert.equal(protectedRun.steps[0].error.requiresUserDecision, true);

// 10) paralelismo só com limite explícito de recursos
const parallelManager = new ExecutionManager({ resolveAdapter: async () => fakeAdapter('ok'), limits: { maxConcurrent: 3 } });
const parallelRun = await parallelManager.execute({
  steps: [
    { id: 'a', adapter: 'ok' },
    { id: 'b', adapter: 'ok' },
    { id: 'c', adapter: 'ok' },
    { id: 'd', adapter: 'ok', dependsOn: ['a', 'b', 'c'] },
  ],
});
assert.equal(parallelRun.status, 'succeeded');
assert.equal(parallelRun.steps.every((step) => step.state === 'succeeded'), true);
assert.equal(summarizeDag(buildDag([{ id: 'a', adapter: 'ok' }]), { a: 'succeeded' }).progress, 100);

console.log(`Orchestrator + engine smoke test passed (${workflows.length} workflows planejados, ${executable.length} executáveis só com adapters internos).`);
