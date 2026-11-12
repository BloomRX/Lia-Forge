import assert from 'node:assert/strict';
import { assetCompletionFlags, countDistinctReferenceImages, isLegacyIncompleteReferenceCompletion } from '../src/asset-progress.js';

const references = [
  'game/assets/characters/mira/references/front.png',
  'game/assets/characters/mira/references/profile.webp',
  'game/assets/characters/mira/references/back.jpg',
];
assert.equal(countDistinctReferenceImages(references), 3);
assert.equal(countDistinctReferenceImages([
  references[0],
  'GAME\\ASSETS\\CHARACTERS\\MIRA\\REFERENCES\\FRONT.PNG',
  'game/assets/characters/mira/references/./front.png',
]), 1, 'path aliases and case/separator differences do not inflate the distinct image count');
assert.equal(countDistinctReferenceImages(['concept.gif', 'brief.md', 'model.glb']), 0);

const legacyAsset = {
  completed: [true, true, true, true, false],
  stageStatus: [
    { status: 'completed', outputs: ['brief.md'] },
    { status: 'completed', outputs: [references[0]], note: 'Completed by an older version.' },
    { status: 'completed', outputs: ['game/assets/characters/mira/3d/model.glb'] },
    { status: 'completed', outputs: ['game/assets/characters/mira/rig/character.fbx'] },
    { status: 'pending', outputs: [] },
  ],
};
assert.equal(isLegacyIncompleteReferenceCompletion(legacyAsset), true);
assert.deepEqual(assetCompletionFlags(legacyAsset), [true, false, true, true, false]);
assert.equal(legacyAsset.completed[1], true, 'derived UI state does not mutate stored asset data');
assert.equal(legacyAsset.stageStatus[1].outputs.length, 1, 'existing reference outputs remain preserved');

const currentAsset = {
  completed: [true, true, false, false, false],
  stageStatus: [{ status: 'completed' }, { status: 'completed', outputs: references }],
};
assert.equal(isLegacyIncompleteReferenceCompletion(currentAsset), false);
assert.deepEqual(assetCompletionFlags(currentAsset), currentAsset.completed);

const partialConcept = {
  completed: [true, false, false, false, false],
  stageStatus: [{ status: 'completed' }, { status: 'in_progress', outputs: [references[0]] }],
};
assert.equal(isLegacyIncompleteReferenceCompletion(partialConcept), false, 'a ComfyUI concept already marked in progress remains partial');
assert.deepEqual(assetCompletionFlags(partialConcept), partialConcept.completed);

console.log('Asset progress smoke test passed.');
