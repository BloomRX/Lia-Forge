const assert = require('node:assert/strict');
const { createBlenderSpritesheetPlan, BLENDER_SPRITESHEET_WORKFLOW_ID } = require('../electron/blender-workflow-plan.cjs');

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
  blenderArgs: ['--background', '--python', '/app/scripts/blender_spritesheet.py'],
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
assert.throws(() => createBlenderSpritesheetPlan({ runId: 'bad', asset, sourceRelative: 'models/a.glb', frameSize: { width: 8, height: 8 }, blenderExecutable: 'blender', blenderArgs: [], outputDirectory: '/out' }), /dados válidos/);

console.log('Blender workflow plan smoke test passed.');
