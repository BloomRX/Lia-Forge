const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { WorkflowRunner, validatePlan, verifyArtifact } = require('../electron/workflow-runner.cjs');
const { createHumanoidPipelinePlan, HUMANOID_PIPELINE_STAGES, providerAuthorization } = require('../electron/workflow-contracts.cjs');
const { makePng } = require('./png-fixtures.cjs');
const { resumableRunKind } = require('../electron/resume-workflow.cjs');

function makeGlb(jsonText = '{"asset":{"version":"2.0"}}') {
  const json = Buffer.from(jsonText, 'utf8');
  const padding = (4 - (json.length % 4)) % 4;
  const jsonChunk = Buffer.concat([json, Buffer.alloc(padding, 0x20)]);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(jsonChunk.length, 0);
  chunkHeader.writeUInt32LE(0x4e4f534a, 4);
  const totalLength = 12 + chunkHeader.length + jsonChunk.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  return Buffer.concat([header, chunkHeader, jsonChunk]);
}

async function writeArtifact(root, relativePath, content) {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
  return relativePath;
}

async function makeWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'lia-forge-workflow-'));
}

async function main() {
  const resumablePlanStep = {
    id: 'render-and-pack',
    adapter: 'blender-spritesheet',
    inputContracts: [{ id: 'model', kind: 'file' }],
    outputContracts: [
      { id: 'spritesheet', validator: 'png-rgba8' },
      { id: 'spritesheet-metadata', validator: 'spritesheet-manifest' },
    ],
    execution: { kind: 'process' },
  };
  const resumableRun = {
    workflowId: 'render-spritesheet-from-existing-3d',
    status: 'failed',
    plan: {
      workflowId: 'render-spritesheet-from-existing-3d',
      metadata: { kind: 'blender-spritesheet', stageIndex: 4, sourceRelative: 'models/hero.glb' },
      steps: [resumablePlanStep],
    },
    steps: [{ id: 'render-and-pack', status: 'failed' }],
  };
  assert.equal(resumableRunKind(resumableRun), true);
  assert.equal(resumableRunKind({ ...resumableRun, status: 'validated' }), false, 'A completed run is not a resume request.');
  assert.equal(resumableRunKind({ ...resumableRun, plan: { ...resumableRun.plan, steps: [resumablePlanStep, resumablePlanStep] } }), false, 'Persisted plans with extra steps are rejected.');
  assert.equal(resumableRunKind({ ...resumableRun, plan: { ...resumableRun.plan, steps: [{ ...resumablePlanStep, adapter: 'comfyui-concept' }] } }), false, 'A provider adapter cannot be smuggled into Blender recovery.');

  const root = await makeWorkspace();
  const order = [];
  const persisted = [];
  const events = [];
  const runner = new WorkflowRunner({
    adapters: {
      prepare: async ({ reportProgress, projectRoot }) => {
        order.push('prepare');
        await writeArtifact(projectRoot, 'refs/concept.png', makePng(8, 8));
        await reportProgress({ progress: 50, message: 'Preparando insumos' });
        return { outputs: ['refs/concept.png'], note: 'Imagem real salva.' };
      },
      pack: async ({ run, projectRoot }) => {
        assert.equal(run.steps[0].status, 'validated');
        order.push('pack');
        await writeArtifact(projectRoot, 'sprites/sheet.png', makePng(16, 8));
        const manifest = {
          schemaVersion: 1,
          generator: 'Workflow smoke fixture',
          asset: 'test-character',
          assetType: 'character',
          frameWidth: 8,
          frameHeight: 8,
          columns: 2,
          rows: 1,
          sheetWidth: 16,
          sheetHeight: 8,
          origin: 'top-left',
          anchor: 'feet',
          animations: ['walk'],
          frames: [
            { filename: 'test_walk_00', animation: 'walk', frame: 0, sourceFrame: 1, x: 0, y: 0, width: 8, height: 8, pivot: { x: 4, y: 7 }, durationMs: 100 },
            { filename: 'test_walk_01', animation: 'walk', frame: 1, sourceFrame: 2, x: 8, y: 0, width: 8, height: 8, pivot: { x: 4, y: 7 }, durationMs: 100 },
          ],
        };
        await writeArtifact(projectRoot, 'sprites/sheet.json', Buffer.from(JSON.stringify(manifest)));
        return { outputs: ['sprites/sheet.png', 'sprites/sheet.json'] };
      },
    },
    persist: async (run) => persisted.push(run),
    onEvent: (event) => events.push(event.event),
  });
  const run = await runner.run({
    id: '12345678-1234-4234-8234-123456789abc',
    workflowId: 'smoke-workflow',
    assetId: 'test-asset',
    steps: [
      { id: 'prepare', title: 'Preparar', adapter: 'prepare', dependsOn: [], outputContracts: [{ id: 'concept', formats: ['png'], validator: 'png', required: true }] },
      { id: 'pack', title: 'Empacotar', adapter: 'pack', dependsOn: ['prepare'], outputContracts: [
        { id: 'sheet', formats: ['png'], validator: 'png-rgba8', required: true },
        { id: 'metadata', formats: ['json'], validator: 'spritesheet-manifest', required: true },
      ] },
    ],
  }, { projectRoot: root });
  assert.deepEqual(order, ['prepare', 'pack']);
  assert.equal(run.status, 'validated');
  assert.equal(run.progress, 100);
  assert.deepEqual(run.result.outputs, ['refs/concept.png', 'sprites/sheet.png', 'sprites/sheet.json']);
  assert.equal(run.steps[0].status, 'validated');
  assert.equal(run.steps[1].validations.length, 2);
  assert.match(run.steps[0].artifacts[0].sha256, /^[0-9a-f]{64}$/);
  assert(events.includes('step-progress'));
  assert(events.includes('run-validated'));
  assert(persisted.length >= 7);

  assert.throws(() => validatePlan({ workflowId: 'bad', steps: [{ id: 'x', adapter: 'missing' }] }, {}), /Adapter indisponível/);
  assert.throws(() => validatePlan({ workflowId: 'bad', steps: [{ id: 'b', adapter: 'ok', dependsOn: ['a'] }] }, { ok: async () => ({ outputs: [] }) }), /precisa aparecer antes/);

  const blockedCalls = [];
  const character = {
    id: 'mira',
    type: 'character',
    name: 'Mira',
    brief: 'Humanoide estilizado de corpo inteiro.',
    prompt: 'Uma viajante de fantasia estilizada, corpo inteiro, roupa verde e silhueta clara.',
    animations: ['Idle', 'Walk'],
    target: '48 × 48 px',
  };
  const humanoidPlan = createHumanoidPipelinePlan({ asset: character });
  assert.deepEqual(humanoidPlan.steps.map((step) => step.id), ['reference-views', 'generate-3d', 'auto-rig', 'animate', 'render-2d']);
  assert.deepEqual(HUMANOID_PIPELINE_STAGES.map((stage) => stage.id), ['reference-views', 'generate-3d', 'auto-rig', 'animate', 'render-2d']);
  assert.equal(humanoidPlan.steps[0].outputContracts.filter((contract) => contract.id.endsWith('-view')).length, 3);
  assert.equal(humanoidPlan.steps[1].inputContracts.some((contract) => contract.id === 'prompt'), true);
  assert.equal(humanoidPlan.steps[1].inputContracts.some((contract) => contract.kind === 'artifact' && contract.fromStep === 'reference-views'), true);
  assert.equal(humanoidPlan.steps[3].outputContracts[0].formats.includes('glb'), true);
  assert.equal(humanoidPlan.steps[4].outputContracts.some((contract) => contract.validator === 'spritesheet-manifest'), true);
  assert.equal(humanoidPlan.providerNeutral, true);
  const cloudAuthorization = providerAuthorization({
    id: 'candidate-api', name: 'Candidate API', mode: 'api',
    destination: 'https://api.example.test/v2?api_key=do-not-store',
    estimatedCost: { amount: null, unit: 'credits', known: false },
  }, ['send_prompt_or_references', 'paid_generation', 'download_result'], 'generate model');
  assert.equal(cloudAuthorization.required, true);
  assert.ok(cloudAuthorization.actions.includes('send_data'));
  assert.ok(cloudAuthorization.actions.includes('cost'));
  assert.equal(cloudAuthorization.destination, 'https://api.example.test/v2');
  assert.equal(JSON.stringify(cloudAuthorization).includes('do-not-store'), false);
  const setupAuthorization = providerAuthorization({
    id: 'local-candidate', mode: 'local', estimatedCost: { amount: 0, unit: 'USD', known: true },
    installationRequired: true, downloadRequired: true,
  }, [], 'rigging');
  assert.equal(setupAuthorization.required, true);
  assert.ok(setupAuthorization.actions.includes('install_software'));
  assert.ok(setupAuthorization.actions.includes('download_models_or_weights'));
  const sensitiveHumanoidPlan = structuredClone(humanoidPlan);
  sensitiveHumanoidPlan.steps[0].parameters = {
    userPrompt: 'RAW_CAMELCASE_PROMPT_MUST_NOT_PERSIST',
    apiKey: 'RAW_API_KEY_MUST_NOT_PERSIST',
  };
  const unconfiguredRunner = new WorkflowRunner({ adapters: {
    'blender-spritesheet': async () => { blockedCalls.push('blender'); return { outputs: [] }; },
  } });
  await assert.rejects(unconfiguredRunner.run(sensitiveHumanoidPlan, { asset: character, projectRoot: root }), (error) => {
    assert.equal(error.code, 'WORKFLOW_BLOCKED');
    assert.equal(error.run.status, 'blocked');
    assert.equal(error.run.steps[0].status, 'blocked');
    assert.equal(blockedCalls.length, 0);
    const snapshot = JSON.stringify(error.run);
    assert.equal(snapshot.includes(character.prompt), false, 'The persisted run plan must not copy raw prompt content.');
    assert.equal(snapshot.includes('RAW_CAMELCASE_PROMPT_MUST_NOT_PERSIST'), false, 'CamelCase prompt keys are sanitized before persistence.');
    assert.equal(snapshot.includes('RAW_API_KEY_MUST_NOT_PERSIST'), false, 'CamelCase API-key keys are sanitized before persistence.');
    return true;
  });

  let deniedCalls = 0;
  const deniedRunner = new WorkflowRunner({ adapters: {
    remote: async () => { deniedCalls += 1; return { outputs: [] }; },
  } });
  const authPlan = {
    workflowId: 'approval-test',
    assetId: 'test-asset',
    steps: [{
      id: 'upload',
      adapter: 'remote',
      inputContracts: [{ id: 'prompt', kind: 'context', contextKey: 'prompt', valueType: 'string', required: true }],
      outputContracts: [{ id: 'model', formats: ['glb'], validator: 'glb', required: true }],
      authorization: { required: true, actions: ['send_data', 'cost'], summary: 'Autorize envio e custo.', destination: 'example.invalid', estimatedCost: { amount: null, unit: 'credit', known: false, note: 'API key=RAW_COST_SECRET_MUST_NOT_PERSIST' } },
    }],
  };
  const awaitingAuthorization = await deniedRunner.run(authPlan, { projectRoot: root, prompt: 'informação privada de teste' });
  assert.equal(awaitingAuthorization.status, 'awaiting_authorization');
  assert.equal(awaitingAuthorization.steps[0].status, 'awaiting_authorization');
  assert.equal(deniedCalls, 0);
  assert.equal(JSON.stringify(awaitingAuthorization).includes('informação privada de teste'), false);
  assert.equal(JSON.stringify(awaitingAuthorization).includes('RAW_COST_SECRET_MUST_NOT_PERSIST'), false, 'Authorization cost notes are sanitized before persistence.');
  const denied = await deniedRunner.authorize(awaitingAuthorization.id, 'upload', { approved: false, note: 'Recusado no smoke test.' });
  assert.equal(denied.status, 'blocked');
  assert.equal(denied.steps[0].authorization.status, 'denied');
  assert.equal(deniedCalls, 0);

  let scopedCalls = 0;
  const scopeRoot = await makeWorkspace();
  const scopeContext = { projectRoot: scopeRoot, prompt: 'descrição original' };
  const scopeRunner = new WorkflowRunner({ adapters: {
    scoped: async ({ projectRoot }) => {
      scopedCalls += 1;
      await writeArtifact(projectRoot, 'scope/output.glb', makeGlb());
      return { outputs: ['scope/output.glb'] };
    },
  } });
  const scopePlan = {
    workflowId: 'authorization-scope-test',
    steps: [{
      id: 'upload', adapter: 'scoped',
      inputContracts: [{ id: 'prompt', kind: 'context', contextKey: 'prompt', valueType: 'string', required: true }],
      outputContracts: [{ id: 'model', formats: ['glb'], validator: 'glb', required: true }],
      authorization: { required: true, actions: ['send_data'], destination: 'https://api.example.test/v1?token=should-not-persist' },
    }],
  };
  const scopePending = await scopeRunner.run(scopePlan, scopeContext);
  assert.equal(JSON.stringify(scopePending).includes('should-not-persist'), false, 'Authorization logs redact query credentials.');
  scopeContext.prompt = 'descrição alterada depois da aprovação';
  const staleApproval = await scopeRunner.authorize(scopePending.id, 'upload', { approved: true });
  assert.equal(staleApproval.status, 'awaiting_authorization', 'Changed inputs invalidate a stale consent.');
  assert.equal(staleApproval.steps[0].authorization.status, 'awaiting_authorization');
  assert.equal(scopedCalls, 0, 'No adapter runs under a stale approval.');
  const freshApproval = await scopeRunner.authorize(scopePending.id, 'upload', { approved: true });
  assert.equal(freshApproval.status, 'validated');
  assert.equal(scopedCalls, 1);

  const gatedRoot = await makeWorkspace();
  let generationCalls = 0;
  let animationCalls = 0;
  const gatedRunner = new WorkflowRunner({ adapters: {
    generate: async ({ projectRoot }) => {
      generationCalls += 1;
      await writeArtifact(projectRoot, 'provider/model.glb', makeGlb());
      return { outputs: ['provider/model.glb'], note: 'GLB real de teste salvo.' };
    },
    animate: async ({ inputsById, projectRoot }) => {
      animationCalls += 1;
      assert.equal(inputsById.rigged.path, 'provider/model.glb');
      await writeArtifact(projectRoot, 'provider/animated.glb', makeGlb());
      return { artifacts: [{ id: 'animated', path: 'provider/animated.glb' }] };
    },
  } });
  const gatedPlan = {
    workflowId: 'approval-and-review-test',
    assetId: 'test-asset',
    steps: [
      {
        id: 'generate',
        adapter: 'generate',
        inputContracts: [{ id: 'prompt', kind: 'context', contextKey: 'prompt', valueType: 'string', required: true }],
        outputContracts: [{ id: 'model', formats: ['glb'], validator: 'glb', required: true }],
        authorization: { required: true, actions: ['send_data'], summary: 'Consentimento obrigatório.' },
        reviewRequired: true,
      },
      {
        id: 'animate',
        adapter: 'animate',
        dependsOn: ['generate'],
        inputContracts: [{ id: 'rigged', kind: 'artifact', fromStep: 'generate', artifactId: 'model', formats: ['glb'], validator: 'glb', required: true }],
        outputContracts: [{ id: 'animated', formats: ['glb'], validator: 'glb', required: true }],
      },
    ],
  };
  const pendingReview = await gatedRunner.run(gatedPlan, { projectRoot: gatedRoot, prompt: 'prompt nunca persistido em claro' });
  assert.equal(pendingReview.status, 'awaiting_authorization');
  assert.equal(generationCalls, 0);
  const reviewRequired = await gatedRunner.authorize(pendingReview.id, 'generate', { approved: true, approvedBy: 'explicit-smoke-test' });
  assert.equal(reviewRequired.status, 'awaiting_review');
  assert.equal(reviewRequired.steps[0].status, 'awaiting_review');
  assert.equal(generationCalls, 1);
  assert.equal(animationCalls, 0, 'Downstream stages wait for human review.');
  assert.equal(reviewRequired.artifacts.length, 1);
  const rejectedReview = await gatedRunner.review(reviewRequired.id, 'generate', { approved: false, note: 'Rejeitado de propósito.' });
  assert.equal(rejectedReview.status, 'failed');
  assert.equal(rejectedReview.steps[0].status, 'failed');
  assert.equal(await fs.stat(path.join(gatedRoot, 'provider/model.glb')).then((info) => info.size > 0), true, 'Review rejection preserves real outputs.');
  assert.equal(animationCalls, 0);

  const approvedRoot = await makeWorkspace();
  const approvedRunner = new WorkflowRunner({ adapters: {
    generate: async ({ projectRoot }) => {
      await writeArtifact(projectRoot, 'provider/model.glb', makeGlb());
      return { outputs: ['provider/model.glb'] };
    },
    animate: async ({ inputsById, projectRoot }) => {
      assert.equal(inputsById.rigged.path, 'provider/model.glb');
      await writeArtifact(projectRoot, 'provider/animated.glb', makeGlb());
      return { artifacts: [{ id: 'animated', path: 'provider/animated.glb' }] };
    },
  } });
  const waiting = await approvedRunner.run(gatedPlan, { projectRoot: approvedRoot, prompt: 'local hash only' });
  const awaitingReview = await approvedRunner.authorize(waiting.id, 'generate', { approved: true });
  const finalRun = await approvedRunner.review(awaitingReview.id, 'generate', { approved: true, note: 'Aprovado pelo revisor.' });
  assert.equal(finalRun.status, 'validated');
  assert.deepEqual(finalRun.steps.map((step) => step.status), ['validated', 'validated']);
  assert.deepEqual(finalRun.result.outputs, ['provider/model.glb', 'provider/animated.glb']);

  const reviewMutationRoot = await makeWorkspace();
  let mutationDownstreamCalls = 0;
  const reviewMutationRunner = new WorkflowRunner({ adapters: {
    generate: async ({ projectRoot }) => {
      await writeArtifact(projectRoot, 'review/model.glb', makeGlb());
      return { outputs: ['review/model.glb'] };
    },
    downstream: async () => { mutationDownstreamCalls += 1; return { outputs: [] }; },
  } });
  const reviewMutationPlan = {
    workflowId: 'review-artifact-mutation',
    steps: [
      { id: 'generate', adapter: 'generate', outputContracts: [{ id: 'model', formats: ['glb'], validator: 'glb', required: true }], reviewRequired: true },
      { id: 'next', adapter: 'downstream', dependsOn: ['generate'], outputContracts: [{ id: 'next', formats: ['json'], validator: 'json', required: true }] },
    ],
  };
  const reviewPending = await reviewMutationRunner.run(reviewMutationPlan, { projectRoot: reviewMutationRoot });
  await fs.writeFile(path.join(reviewMutationRoot, 'review/model.glb'), Buffer.from('changed after validation'));
  const invalidatedReview = await reviewMutationRunner.review(reviewPending.id, 'generate', { approved: true });
  assert.equal(invalidatedReview.status, 'failed');
  assert.equal(invalidatedReview.steps[0].review.status, 'invalidated');
  assert.equal(mutationDownstreamCalls, 0, 'Downstream work waits if a reviewed artifact changed on disk.');

  const resumeRoot = await makeWorkspace();
  let prepareCalls = 0;
  let packCalls = 0;
  const resumeRunner = new WorkflowRunner({ adapters: {
    prepare: async ({ projectRoot, inputsById }) => {
      prepareCalls += 1;
      assert.equal(inputsById.brief, 'brief estável');
      await writeArtifact(projectRoot, 'resume/model.glb', makeGlb());
      return { outputs: ['resume/model.glb'] };
    },
    pack: async ({ projectRoot }) => {
      packCalls += 1;
      if (packCalls === 1) throw new Error('falha transitória no empacotamento');
      await writeArtifact(projectRoot, 'resume/final.json', Buffer.from('{"ok":true}'));
      return { outputs: ['resume/final.json'] };
    },
  } });
  const resumePlan = {
    workflowId: 'resume-compatible-stage-test',
    assetId: 'test-asset',
    steps: [
      {
        id: 'prepare',
        adapter: 'prepare',
        parameters: { assetName: 'hero' },
        inputContracts: [{ id: 'brief', kind: 'context', contextKey: 'brief', valueType: 'string', required: true }],
        outputContracts: [{ id: 'model', formats: ['glb'], validator: 'glb', required: true }],
      },
      {
        id: 'pack',
        adapter: 'pack',
        dependsOn: ['prepare'],
        inputContracts: [{ id: 'model', kind: 'artifact', fromStep: 'prepare', artifactId: 'model', formats: ['glb'], validator: 'glb', required: true }],
        outputContracts: [{ id: 'metadata', formats: ['json'], validator: 'json', required: true }],
      },
    ],
  };
  let previousRun;
  await assert.rejects(resumeRunner.run(resumePlan, { projectRoot: resumeRoot, brief: 'brief estável' }), (error) => {
    previousRun = error.run;
    assert.equal(previousRun.status, 'failed');
    assert.equal(previousRun.steps[0].status, 'validated');
    assert.equal(previousRun.steps[1].status, 'failed');
    return /falha transitória/.test(error.message);
  });
  assert.equal(await fs.stat(path.join(resumeRoot, 'resume/model.glb')).then((info) => info.size > 0), true, 'Earlier-stage output survives later failure.');
  const resumed = await resumeRunner.resume(resumePlan, previousRun, { projectRoot: resumeRoot, brief: 'brief estável' });
  assert.equal(resumed.status, 'validated');
  assert.deepEqual(resumed.reusedSteps, ['prepare']);
  assert.equal(resumed.resumeFrom, null);
  assert.equal(prepareCalls, 1, 'A previously validated compatible stage is not repeated.');
  assert.equal(packCalls, 2, 'Only the failed stage is retried.');
  assert.equal(await fs.stat(path.join(resumeRoot, 'resume/model.glb')).then((info) => info.size > 0), true);
  const changedResumePlan = {
    ...resumePlan,
    steps: resumePlan.steps.map((step) => step.id === 'prepare'
      ? { ...step, parameters: { assetName: 'renamed hero' } }
      : step),
  };
  const changedInputsResume = await resumeRunner.resume(changedResumePlan, resumed, { projectRoot: resumeRoot, brief: 'brief estável' }, { id: 'changed-inputs-resume' });
  assert.equal(changedInputsResume.status, 'validated');
  assert.deepEqual(changedInputsResume.reusedSteps, [], 'Changed plan parameters invalidate otherwise identical prior artifacts.');
  assert.equal(prepareCalls, 2);
  assert.equal(packCalls, 3);

  const invalidRoot = await makeWorkspace();
  const invalidRunner = new WorkflowRunner({ adapters: {
    invalid: async ({ projectRoot }) => {
      await writeArtifact(projectRoot, 'bad/output.png', Buffer.from('not a PNG'));
      return { outputs: ['bad/output.png'] };
    },
  } });
  await assert.rejects(invalidRunner.run({
    workflowId: 'bad-png-test',
    steps: [{ id: 'bad', adapter: 'invalid', outputContracts: [{ id: 'image', formats: ['png'], validator: 'png', required: true }] }],
  }, { projectRoot: invalidRoot }), (error) => {
    assert.equal(error.run.status, 'failed');
    assert.equal(error.run.steps[0].validations[0].result, 'failed');
    assert.equal(error.run.logs.some((entry) => entry.event === 'artifact-validation-failed' && entry.details.path === 'bad/output.png'), true);
    return /PNG/.test(error.message);
  });
  assert.equal(await fs.stat(path.join(invalidRoot, 'bad/output.png')).then((info) => info.size > 0), true, 'Invalid partial output is retained for diagnosis.');

  const partialRoot = await makeWorkspace();
  const partialRunner = new WorkflowRunner({ adapters: {
    partial: async ({ projectRoot }) => {
      await writeArtifact(projectRoot, 'partial/image.png', makePng(4, 4));
      return { outputs: ['partial/image.png'] };
    },
  } });
  await assert.rejects(partialRunner.run({
    workflowId: 'partial-output-preservation',
    steps: [{ id: 'partial', adapter: 'partial', outputContracts: [
      { id: 'image', formats: ['png'], validator: 'png', required: true },
      { id: 'metadata', formats: ['json'], validator: 'json', required: true },
    ] }],
  }, { projectRoot: partialRoot }), (error) => {
    assert.equal(error.run.status, 'failed');
    assert.deepEqual(error.run.artifacts.map((artifact) => artifact.path), ['partial/image.png']);
    assert.deepEqual(error.run.steps[0].outputs, ['partial/image.png']);
    return /Output obrigatório ausente/.test(error.message);
  });

  const inFlightMutationRoot = await makeWorkspace();
  await writeArtifact(inFlightMutationRoot, 'source/input.json', Buffer.from('{"revision":1}'));
  const inFlightMutationRunner = new WorkflowRunner({ adapters: {
    mutate: async ({ projectRoot }) => {
      await writeArtifact(projectRoot, 'mutation/output.json', Buffer.from('{"result":"partial but real"}'));
      await fs.writeFile(path.join(projectRoot, 'source/input.json'), Buffer.from('{"revision":2}'));
      return { outputs: ['mutation/output.json'] };
    },
  } });
  await assert.rejects(inFlightMutationRunner.run({
    workflowId: 'input-mutation-during-execution',
    steps: [{
      id: 'mutate',
      adapter: 'mutate',
      inputContracts: [{ id: 'source', kind: 'file', path: 'source/input.json', formats: ['json'], validator: 'json', required: true }],
      outputContracts: [{ id: 'output', formats: ['json'], validator: 'json', required: true }],
    }],
  }, { projectRoot: inFlightMutationRoot }), (error) => {
    assert.equal(error.run.status, 'failed');
    assert.deepEqual(error.run.artifacts.map((artifact) => artifact.path), ['mutation/output.json']);
    assert.deepEqual(error.run.steps[0].outputs, ['mutation/output.json']);
    return /entradas mudaram durante a execução/.test(error.message);
  });
  assert.equal((await fs.readFile(path.join(inFlightMutationRoot, 'mutation/output.json'), 'utf8')).includes('partial but real'), true, 'Outputs produced during a stale-input failure remain inspectable.');

  const glbRoot = await makeWorkspace();
  await writeArtifact(glbRoot, 'bad/short.glb', Buffer.concat([Buffer.from('glTF'), Buffer.alloc(8)]));
  await assert.rejects(verifyArtifact(glbRoot, 'bad/short.glb', { formats: ['glb'], validator: 'glb', required: true }), /menor que um cabeçalho/);
  await writeArtifact(glbRoot, 'bad/invalid-version.glb', makeGlb('{"asset":{"version":"1.0"}}'));
  await assert.rejects(verifyArtifact(glbRoot, 'bad/invalid-version.glb', { formats: ['glb'], validator: 'glb', required: true }), /asset.version 2.0/);
  await writeArtifact(glbRoot, 'bad/invalid-json.glb', makeGlb('not JSON'));
  await assert.rejects(verifyArtifact(glbRoot, 'bad/invalid-json.glb', { formats: ['glb'], validator: 'glb', required: true }), /JSON válido/);
  const wrongFirstChunk = makeGlb();
  wrongFirstChunk.writeUInt32LE(0, 16);
  await writeArtifact(glbRoot, 'bad/wrong-first-chunk.glb', wrongFirstChunk);
  await assert.rejects(verifyArtifact(glbRoot, 'bad/wrong-first-chunk.glb', { formats: ['glb'], validator: 'glb', required: true }), /primeiro chunk do GLB precisa conter JSON/);
  const truncatedChunk = makeGlb();
  truncatedChunk.writeUInt32LE(100, 12);
  await writeArtifact(glbRoot, 'bad/truncated-chunk.glb', truncatedChunk);
  await assert.rejects(verifyArtifact(glbRoot, 'bad/truncated-chunk.glb', { formats: ['glb'], validator: 'glb', required: true }), /chunk desalinhado ou fora/);
  await writeArtifact(glbRoot, 'good/minimal.glb', makeGlb());
  const validGlb = await verifyArtifact(glbRoot, 'good/minimal.glb', { formats: ['glb'], validator: 'glb', required: true });
  assert.equal(validGlb.validation.version, 2);
  assert.equal(validGlb.validation.assetVersion, '2.0');
  assert.equal(validGlb.validation.chunks, 1);

  const originalOpen = fs.open;
  fs.open = async (...args) => {
    const handle = await originalOpen(...args);
    return {
      read: (buffer, offset, length, position) => handle.read(buffer, offset, Math.min(length, 3), position),
      close: () => handle.close(),
    };
  };
  try {
    const shortReadGlb = await verifyArtifact(glbRoot, 'good/minimal.glb', { formats: ['glb'], validator: 'glb', required: true });
    assert.equal(shortReadGlb.validation.version, 2, 'GLB validation must loop when a file read returns fewer bytes than requested.');
  } finally {
    fs.open = originalOpen;
  }

  const invalidManifestRoot = await makeWorkspace();
  await writeArtifact(invalidManifestRoot, 'bad/manifest.json', Buffer.from('{"schemaVersion":1,"frames":[]}'));
  await assert.rejects(verifyArtifact(invalidManifestRoot, 'bad/manifest.json', { formats: ['json'], validator: 'spritesheet-manifest', required: true }), /manifesto da spritesheet/);

  const gltfRoot = await makeWorkspace();
  await writeArtifact(gltfRoot, 'gltf/scene.gltf', Buffer.from(JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'mesh.bin' }], images: [{ uri: 'textures/albedo.bin' }] })));
  await writeArtifact(gltfRoot, 'gltf/mesh.bin', Buffer.from([1, 2, 3]));
  await writeArtifact(gltfRoot, 'gltf/textures/albedo.bin', Buffer.from([4, 5, 6]));
  const gltfBefore = await verifyArtifact(gltfRoot, 'gltf/scene.gltf', { formats: ['gltf'], validator: 'gltf' });
  assert.equal(gltfBefore.validation.externalResources, 2);
  assert.equal(gltfBefore.validation.dependencies.length, 2);
  await writeArtifact(gltfRoot, 'gltf/textures/albedo.bin', Buffer.from([7, 8, 9]));
  const gltfAfter = await verifyArtifact(gltfRoot, 'gltf/scene.gltf', { formats: ['gltf'], validator: 'gltf' });
  assert.notEqual(gltfBefore.sha256, gltfAfter.sha256, 'A changed glTF dependency invalidates the artifact fingerprint.');

  const symlinkGltfRoot = await makeWorkspace();
  const outsideTextureRoot = await makeWorkspace();
  await writeArtifact(symlinkGltfRoot, 'asset/scene.gltf', Buffer.from(JSON.stringify({ asset: { version: '2.0' }, images: [{ uri: 'textures/albedo.png' }] })));
  await writeArtifact(outsideTextureRoot, 'textures/albedo.png', makePng(2, 2));
  await fs.symlink(path.join(outsideTextureRoot, 'textures'), path.join(symlinkGltfRoot, 'asset', 'textures'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(
    verifyArtifact(symlinkGltfRoot, 'asset/scene.gltf', { formats: ['gltf'], validator: 'gltf', required: true }),
    /simbólico|fora de sua pasta/,
  );

  const traversalRunner = new WorkflowRunner({ adapters: { traversal: async () => ({ outputs: ['../escape.json'] }) } });
  await assert.rejects(traversalRunner.run({ workflowId: 'path-safety', steps: [{ id: 'x', adapter: 'traversal' }] }, { projectRoot: root }), /fora da pasta do projeto/);

  const blockedRunner = new WorkflowRunner({ adapters: { unavailable: async () => { throw Object.assign(new Error('provider ausente'), { code: 'WORKFLOW_BLOCKED' }); } } });
  await assert.rejects(blockedRunner.run({
    workflowId: 'blocked-workflow',
    assetId: 'test-asset',
    steps: [{ id: 'provider', adapter: 'unavailable' }],
  }), (error) => error.code === 'WORKFLOW_BLOCKED' && error.run.status === 'blocked');

  let signalSeen = false;
  const cancelRunner = new WorkflowRunner({ adapters: {
    wait: ({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        signalSeen = true;
        reject(Object.assign(new Error('cancelled'), { code: 'WORKFLOW_CANCELLED' }));
      }, { once: true });
    }),
  } });
  const cancelPromise = cancelRunner.run({ id: 'cancel-run', workflowId: 'cancel-test', steps: [{ id: 'wait', adapter: 'wait' }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelRunner.cancel('cancel-run'), true);
  await assert.rejects(cancelPromise, (error) => error.code === 'WORKFLOW_CANCELLED' && error.run.status === 'cancelled');
  assert.equal(signalSeen, true);

  const persistFailureRunner = new WorkflowRunner({
    adapters: { fast: async () => ({ outputs: [] }) },
    persist: async () => { throw new Error('disk indisponível'); },
  });
  await assert.rejects(persistFailureRunner.run({
    id: 'persist-failure-run', workflowId: 'persist-failure', steps: [{ id: 'step', adapter: 'fast' }],
  }), /persistir o estado do workflow/);
  assert.equal(persistFailureRunner.activeRunId, null, 'A falha ao persistir o evento inicial must release the runner lock.');
  assert.equal(persistFailureRunner.get('persist-failure-run').status, 'failed');

  const concurrentRoot = await makeWorkspace();
  let releasePlannedPersist;
  let signalPlannedPersist;
  const plannedPersistEntered = new Promise((resolve) => { signalPlannedPersist = resolve; });
  const concurrentRunner = new WorkflowRunner({
    adapters: { fast: async ({ projectRoot }) => {
      await writeArtifact(projectRoot, 'concurrent/result.json', Buffer.from('{"ok":true}'));
      return { outputs: ['concurrent/result.json'] };
    } },
    persist: async (snapshot) => {
      if (snapshot.status === 'planned' && !releasePlannedPersist) {
        await new Promise((resolve) => { releasePlannedPersist = resolve; signalPlannedPersist(); });
      }
    },
  });
  const concurrentPlan = { workflowId: 'concurrent-lock-test', steps: [{ id: 'fast', adapter: 'fast', outputContracts: [{ id: 'result', formats: ['json'], validator: 'json', required: true }] }] };
  const firstConcurrentRun = concurrentRunner.run(concurrentPlan, { projectRoot: concurrentRoot });
  await plannedPersistEntered;
  await assert.rejects(concurrentRunner.run(concurrentPlan, { projectRoot: concurrentRoot }), /Já existe um workflow executando/);
  releasePlannedPersist();
  const firstConcurrentResult = await firstConcurrentRun;
  assert.equal(firstConcurrentResult.status, 'validated');
  assert.equal(concurrentRunner.activeRunId, null);

  console.log('Workflow runner smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
