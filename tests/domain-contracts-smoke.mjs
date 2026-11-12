import assert from 'node:assert/strict';
import {
  DOMAIN_SCHEMA_VERSION,
  createAssetTypeCatalog,
  validateAsset,
  validateArtifact,
  validateAssetVersion,
  validateProject,
  validateProvenance,
  validateValidationResult,
} from '../shared/domain/contracts.mjs';

const timestamp = '2026-11-07T12:30:00.000Z';
const digest = 'a'.repeat(64);

function assetType(id, extra = {}) {
  return {
    schemaVersion: DOMAIN_SCHEMA_VERSION,
    id,
    version: '1.0.0',
    artifactRoles: ['source', 'final'],
    capabilities: ['render.sequence'],
    ...extra,
  };
}

function catalogFixture() {
  return createAssetTypeCatalog([
    assetType('character'),
    assetType('item'),
    assetType('environment.background', { taxonomy: { family: 'environment' } }),
  ]);
}

const catalog = catalogFixture();
assert.equal(catalog.has('character'), true);
assert.equal(catalog.has('environment.background'), true);
assert.equal(catalog.has('unknown'), false);
assert.equal(catalog.get('unknown'), null);
assert.deepEqual(catalog.list().map(({ id }) => id), ['character', 'item', 'environment.background']);
assert.ok(Object.isFrozen(catalog));
assert.ok(Object.isFrozen(catalog.list()));
assert.ok(Object.isFrozen(catalog.get('character')));
assert.ok(Object.isFrozen(catalog.get('character').artifactRoles));
assert.throws(() => catalog.list().push(assetType('other')), TypeError);
assert.throws(() => createAssetTypeCatalog([assetType('character'), assetType('character')]), /IDs must be unique/);
assert.throws(() => createAssetTypeCatalog([assetType('no-schema', { schemaVersion: undefined })]), /schemaVersion/);
assert.throws(() => createAssetTypeCatalog([assetType('executable', { callback() {} })]), /JSON-compatible data only/);
assert.throws(() => createAssetTypeCatalog({}), /must be an array/);

const projectInput = {
  id: 'project-01',
  schemaVersion: DOMAIN_SCHEMA_VERSION,
  rootPolicy: { kind: 'workspace-relative', readOnlyInputs: true },
  createdAt: timestamp,
  engine: { id: 'godot', version: '4.x' },
  targets: ['desktop', 'web'],
};
const projectSnapshot = structuredClone(projectInput);
const project = validateProject(projectInput);
assert.deepEqual(projectInput, projectSnapshot, 'validation must not mutate caller-owned objects');
assert.notStrictEqual(project, projectInput, 'validation returns a snapshot');
assert.ok(Object.isFrozen(project));
assert.ok(Object.isFrozen(project.rootPolicy));
assert.throws(() => validateProject({ ...projectInput, schemaVersion: undefined }), /schemaVersion/);
assert.throws(() => validateProject({ ...projectInput, rootPolicy: {} }), /non-empty plain object/);
assert.throws(() => validateProject({ ...projectInput, createdAt: 'yesterday' }), /ISO 8601/);
assert.throws(() => validateProject({ ...projectInput, engine: 17 }), /string or a plain object/);

const characterAssetInput = {
  id: 'hero-01',
  schemaVersion: DOMAIN_SCHEMA_VERSION,
  projectId: 'project-01',
  assetTypeId: 'character',
  subtype: 'humanoid',
  name: 'Hero',
  tags: ['player', 'stylized'],
  targets: ['godot'],
  currentVersionId: null,
};
const characterAsset = validateAsset(characterAssetInput, catalog);
assert.equal(characterAsset.assetTypeId, 'character');
assert.ok(Object.isFrozen(characterAsset));
const environmentAsset = validateAsset({
  id: 'forest-bg',
  schemaVersion: DOMAIN_SCHEMA_VERSION,
  projectId: 'project-01',
  assetTypeId: 'environment.background',
}, catalog);
assert.equal(environmentAsset.assetTypeId, 'environment.background');
assert.throws(() => validateAsset({
  ...characterAssetInput,
  assetTypeId: 'unregistered.category',
}, catalog), /not registered/);
assert.throws(() => validateAsset(characterAssetInput, null), /createAssetTypeCatalog/);
assert.throws(() => validateAsset(characterAssetInput, {
  has: () => true,
  get: () => ({ id: 'character' }),
}), /createAssetTypeCatalog/);
assert.throws(() => validateAsset({ ...characterAssetInput, schemaVersion: 2 }, catalog), /schemaVersion/);
assert.throws(() => validateAsset({ ...characterAssetInput, id: '../hero' }, catalog), /stable identifier/);
assert.throws(() => validateAsset({ ...characterAssetInput, tags: ['same', 'same'] }, catalog), /must be unique/);

const artifactInput = {
  id: 'artifact-01',
  schemaVersion: DOMAIN_SCHEMA_VERSION,
  uri: 'assets/hero/source/model.fbx',
  mediaType: 'model/vnd.autodesk.fbx',
  format: 'fbx',
  role: 'source',
  sizeBytes: 4096,
  sha256: digest,
  parentArtifactIds: [],
  validatorIds: ['fbx-header-v1'],
  metadata: { importedBy: 'user' },
};
const artifact = validateArtifact(artifactInput);
assert.equal(artifact.sha256, digest);
assert.ok(Object.isFrozen(artifact.metadata));
assert.throws(() => validateArtifact({ ...artifactInput, sha256: 'not-a-hash' }), /SHA-256/);
assert.throws(() => validateArtifact({ ...artifactInput, role: '' }), /non-empty string/);
assert.throws(() => validateArtifact({ ...artifactInput, mediaType: 'fbx' }), /media type/);
assert.throws(() => validateArtifact({ ...artifactInput, sizeBytes: 0 }), /positive safe integer/);
assert.throws(() => validateArtifact({ ...artifactInput, parentArtifactIds: ['artifact-01'] }), /cannot include the artifact itself/);
assert.throws(() => validateArtifact({ ...artifactInput, schemaVersion: undefined }), /schemaVersion/);

const version = validateAssetVersion({
  id: 'version-01',
  schemaVersion: DOMAIN_SCHEMA_VERSION,
  assetId: characterAsset.id,
  createdAt: timestamp,
  artifactIds: ['artifact-01'],
  provenanceIds: ['provenance-01'],
});
assert.deepEqual(version.parentVersionIds, [], 'root versions get an explicit empty parent list');
assert.throws(() => validateAssetVersion({
  ...version,
  parentVersionIds: ['version-01'],
}), /cannot include the version itself/);
assert.throws(() => validateAssetVersion({
  ...version,
  artifactIds: ['artifact-01', 'artifact-01'],
}), /must be unique/);
assert.throws(() => validateAssetVersion({
  ...version,
  artifactIds: ['bad id'],
}), /stable identifier/);

const provenance = validateProvenance({
  id: 'provenance-01',
  schemaVersion: DOMAIN_SCHEMA_VERSION,
  recordedAt: timestamp,
  sources: [{ kind: 'user-provided', uri: 'incoming/model.fbx', rights: { status: 'REVIEW_REQUIRED' } }],
  transformations: [{ toolId: 'blender', toolVersion: '4.x' }],
  inputArtifactIds: [],
  outputArtifactIds: ['artifact-01'],
});
assert.equal(provenance.sources[0].rights.status, 'REVIEW_REQUIRED');
assert.throws(() => validateProvenance({
  ...provenance,
  inputArtifactIds: ['artifact-01', 'artifact-01'],
}), /must be unique/);
assert.throws(() => validateProvenance({ ...provenance, sources: ['not-an-object'] }), /plain data object/);

const validationResult = validateValidationResult({
  id: 'validation-01',
  schemaVersion: DOMAIN_SCHEMA_VERSION,
  artifactId: 'artifact-01',
  artifactSha256: digest,
  validatorId: 'spritesheet-manifest-v1',
  validatorVersion: '1.0.0',
  status: 'passed',
  validatedAt: timestamp,
  checks: [{ id: 'dimensions', status: 'passed' }],
  limitations: ['does not assess visual quality'],
});
assert.equal(validationResult.artifactSha256, digest);
assert.ok(Object.isFrozen(validationResult.checks[0]));
assert.throws(() => validateValidationResult({
  ...validationResult,
  artifactSha256: 'bad',
}), /SHA-256/);
assert.throws(() => validateValidationResult({
  ...validationResult,
  validatorVersion: '',
}), /validatorVersion/);
assert.throws(() => validateValidationResult({
  ...validationResult,
  checks: [null],
}), /plain data object/);

const cyclic = { id: 'cycle' };
cyclic.self = cyclic;
assert.throws(() => createAssetTypeCatalog([assetType('cyclic', { metadata: cyclic })]), /cyclic data/);
assert.throws(() => validateArtifact({
  ...artifactInput,
  metadata: { callback() {} },
}), /JSON-compatible data only/);

console.log('Domain contracts smoke test passed.');
