const assert = require('node:assert/strict');
const { createBlenderSpritesheetPlan, BLENDER_SPRITESHEET_WORKFLOW_ID } = require('../electron/blender-workflow-plan.cjs');
const { BLENDER_SAFETY_FLAGS, buildBlenderSpritesheetArgs, missingBlenderSafetyFlags } = require('../electron/blender-adapter.cjs');

const asset = {
  id: 'hero-01',
  type: 'character',
  name: 'Hero',
  target: '64 × 64 px',
  animations: ['idle', 'walk', 'run'],
};
const plan = createBlenderSpritesheetPlan({
  runId: 'test-run-01',
  asset,
  sourceRelative: 'models/hero.glb',
  frameSize: { width: 64, height: 64 },
  blenderExecutable: '/opt/blender/blender',
  blenderArgs: ['--background', '--disable-autoexec', '--python', '/app/scripts/blender_spritesheet.py'],
  outputDirectory: '/workspace/Lia/runs/test-run-01',
});

assert.equal(plan.workflowId, BLENDER_SPRITESHEET_WORKFLOW_ID);
assert.equal(plan.assetId, asset.id);
assert.equal(plan.metadata.sourceRelative, 'models/hero.glb');
assert.deepEqual(plan.metadata.frameSize, { width: 64, height: 64 });
assert.equal(plan.steps.length, 1);
assert.equal(plan.steps[0].inputContracts.find((contract) => contract.id === 'model').path, 'models/hero.glb');
assert.equal(plan.steps[0].inputContracts.find((contract) => contract.id === 'animations').contextKey, 'asset.animations');
assert.deepEqual(plan.steps[0].parameters.animations, ['idle', 'walk', 'run']);
assert.equal(plan.steps[0].parameters.assetName, 'Hero');
assert.deepEqual(plan.steps[0].outputContracts.map((contract) => contract.validator), ['png-rgba8', 'spritesheet-manifest']);
// frameSize fora do intervalo é recusado antes de qualquer outra leitura
assert.throws(() => createBlenderSpritesheetPlan({ runId: 'bad', asset, sourceRelative: 'models/a.glb', frameSize: { width: 8, height: 8 }, blenderExecutable: 'blender', blenderArgs: [], outputDirectory: '/out' }), /dados válidos/);

// ------------------------------------------------- flags de segurança (P0-4)
// O plano é o que o Workflow Runner executa. Um `.blend` de origem desconhecida
// pode carregar Python embutido: sem --disable-autoexec esse código roda dentro
// do processo que o produto iniciou. Antes desta correção qualquer blenderArgs
// era aceito, inclusive vazio (medido).
assert.deepEqual(BLENDER_SAFETY_FLAGS, ['--background', '--disable-autoexec'], 'as flags obrigatórias são background + disable-autoexec');
assert.deepEqual(plan.steps[0].execution.args.slice(0, 2), ['--background', '--disable-autoexec'], 'o plano preserva as flags na ordem em que o Blender as lê');
assert.deepEqual(missingBlenderSafetyFlags(plan.steps[0].execution.args), [], 'nada falta nos args do plano válido');

const unsafePlan = (blenderArgs) => () => createBlenderSpritesheetPlan({
  runId: 'unsafe', asset, sourceRelative: 'models/hero.glb', frameSize: { width: 64, height: 64 },
  blenderExecutable: '/opt/blender/blender', blenderArgs, outputDirectory: '/out',
});
assert.throws(unsafePlan(['--background', '--python', '/app/scripts/blender_spritesheet.py']),
  /faltam as flags de segurança --disable-autoexec/, 'args sem --disable-autoexec são recusados');
assert.throws(unsafePlan(['--disable-autoexec', '--python', '/app/scripts/blender_spritesheet.py']),
  /faltam as flags de segurança --background/, 'args sem --background são recusados');
assert.throws(unsafePlan([]), /faltam as flags de segurança/, 'args vazios são recusados');
assert.throws(unsafePlan(['--background', '--disable-autoexec']), /sem --python/, 'args sem o script do repositório são recusados');
// Uma flag a mais não é motivo de recusa: o plano exige as de segurança, quem
// decide o resto dos argumentos é o adapter que os produziu.
const withExtraFlag = createBlenderSpritesheetPlan({
  runId: 'extra', asset, sourceRelative: 'models/hero.glb', frameSize: { width: 64, height: 64 },
  blenderExecutable: '/opt/blender/blender',
  blenderArgs: ['--background', '--disable-autoexec', '--python', '/app/scripts/blender_spritesheet.py', '--verbose'],
  outputDirectory: '/out',
});
assert.ok(withExtraFlag.steps[0].execution.args.includes('--disable-autoexec'), 'flag extra não derruba as de segurança');

// O adapter produz args que o plano aceita: os dois lados concordam.
const adapterArgs = buildBlenderSpritesheetArgs({
  scriptPath: '/app/scripts/blender_spritesheet.py',
  inputPath: '/workspace/models/hero.glb',
  outputDirectory: '/out',
  asset: { type: 'character', name: 'Hero', target: '64 × 64 px' },
  frameSize: { width: 64, height: 64 },
});
assert.deepEqual(missingBlenderSafetyFlags(adapterArgs), [], 'os args do adapter já nascem seguros');
const fromAdapter = createBlenderSpritesheetPlan({
  runId: 'run-adapter', asset, sourceRelative: 'models/hero.glb', frameSize: { width: 64, height: 64 },
  blenderExecutable: '/opt/blender/blender', blenderArgs: adapterArgs, outputDirectory: '/out',
});
assert.deepEqual(fromAdapter.steps[0].execution.args, adapterArgs, 'o plano repassa os args do adapter sem alterá-los');

console.log('Blender workflow plan smoke test passed (plano exige --background e --disable-autoexec; args inseguros recusados).');
