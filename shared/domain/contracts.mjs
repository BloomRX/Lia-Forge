/**
 * Prototype of the Lia Forge domain contracts.
 *
 * This module is deliberately isolated from the current workspace/store schema:
 * it validates JSON-shaped records only. It does not read files, resolve paths,
 * infer license rights, or claim that an artifact exists or is visually correct.
 *
 * schemaVersion 1 here is local to this prototype; it is not a migration for
 * `.spriteforge/assets.json` or the current spritesheet manifest.
 */

export const DOMAIN_SCHEMA_VERSION = 1;

const ASSET_TYPE_CATALOG_BRAND = Symbol('liaForgeAssetTypeCatalog');
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_ID_LENGTH = 160;

function invalid(kind, field, reason) {
  throw new TypeError(`${kind}.${field}: ${reason}`);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneData(value, label, ancestors = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalid(label, 'value', 'numbers must be finite');
    return value;
  }
  if (typeof value !== 'object') invalid(label, 'value', 'must contain JSON-compatible data only');
  if (ancestors.has(value)) invalid(label, 'value', 'cyclic data is not supported');

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length > 0) invalid(label, 'value', 'symbol properties are not supported');
      const ownNames = Object.getOwnPropertyNames(value);
      if (ownNames.some((name) => name !== 'length' && !/^\d+$/.test(name))) {
        invalid(label, 'value', 'arrays cannot have custom properties');
      }

      const copy = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
          invalid(label, 'value', 'arrays must be dense data arrays');
        }
        copy.push(cloneData(descriptor.value, `${label}[${index}]`, ancestors));
      }
      return copy;
    }

    if (!isPlainRecord(value)) invalid(label, 'value', 'must be a plain JSON object');
    if (Object.getOwnPropertySymbols(value).length > 0) invalid(label, 'value', 'symbol properties are not supported');

    const copy = {};
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        invalid(label, key, 'must be an enumerable data property');
      }
      Object.defineProperty(copy, key, {
        value: cloneData(descriptor.value, `${label}.${key}`, ancestors),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return copy;
  } finally {
    ancestors.delete(value);
  }
}

function freezeData(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeData(child);
  return Object.freeze(value);
}

function copyRecord(value, kind) {
  const copy = cloneData(value, kind);
  if (!isPlainRecord(copy)) invalid(kind, 'value', 'must be a plain object');
  return copy;
}

function assertText(value, kind, field, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    invalid(kind, field, allowEmpty ? 'must be a string' : 'must be a non-empty string');
  }
  return value;
}

function assertId(value, kind, field) {
  const id = assertText(value, kind, field);
  if (id.length > MAX_ID_LENGTH || !ID_PATTERN.test(id) || id === '.' || id === '..') {
    invalid(kind, field, 'must be a stable identifier (not a path)');
  }
  return id;
}

function assertSchemaVersion(record, kind) {
  if (record.schemaVersion !== DOMAIN_SCHEMA_VERSION) {
    invalid(kind, 'schemaVersion', `must be ${DOMAIN_SCHEMA_VERSION}`);
  }
}

function assertTimestamp(value, kind, field) {
  if (typeof value !== 'string' || !ISO_DATE_TIME_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
    invalid(kind, field, 'must be an ISO 8601 date-time with a timezone');
  }
}

function assertOptionalTimestamp(record, kind, field) {
  if (record[field] !== undefined && record[field] !== null) assertTimestamp(record[field], kind, field);
}

function assertStringList(value, kind, field, { optional = false, ids = false } = {}) {
  if (value === undefined && optional) return;
  if (!Array.isArray(value)) invalid(kind, field, 'must be an array of strings');
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    const entry = ids ? assertId(item, kind, `${field}[${index}]`) : assertText(item, kind, `${field}[${index}]`);
    if (seen.has(entry)) invalid(kind, field, 'entries must be unique');
    seen.add(entry);
  }
}

function assertDataRecordList(value, kind, field) {
  if (!Array.isArray(value)) invalid(kind, field, 'must be an array of plain data objects');
  for (const [index, item] of value.entries()) {
    if (!isPlainRecord(item)) invalid(kind, `${field}[${index}]`, 'must be a plain data object');
  }
}

function assertOptionalRecord(record, kind, field, { nonEmpty = false } = {}) {
  if (record[field] === undefined) return;
  if (!isPlainRecord(record[field]) || (nonEmpty && Object.keys(record[field]).length === 0)) {
    invalid(kind, field, nonEmpty ? 'must be a non-empty plain object' : 'must be a plain object');
  }
}

function validateTypeDescriptor(value, index) {
  const kind = `assetTypes[${index}]`;
  const descriptor = copyRecord(value, kind);
  assertSchemaVersion(descriptor, kind);
  assertId(descriptor.id, kind, 'id');
  assertText(descriptor.version, kind, 'version');

  for (const field of ['artifactRoles', 'capabilities', 'entryPoints', 'validators', 'workflowRefs']) {
    if (descriptor[field] !== undefined) assertStringList(descriptor[field], kind, field);
  }
  for (const field of ['inputContracts', 'outputContracts']) {
    if (descriptor[field] !== undefined && !Array.isArray(descriptor[field])) {
      invalid(kind, field, 'must be an array');
    }
  }
  assertOptionalRecord(descriptor, kind, 'metadata');
  return freezeData(descriptor);
}

/**
 * Create an immutable, explicit AssetType catalog. There are no built-in types:
 * character, item, environment, and future types are accepted only when listed.
 */
export function createAssetTypeCatalog(definitions) {
  if (!Array.isArray(definitions)) invalid('assetTypeCatalog', 'definitions', 'must be an array');

  const byId = new Map();
  const entries = [];
  for (const [index, definition] of definitions.entries()) {
    const descriptor = validateTypeDescriptor(definition, index);
    if (byId.has(descriptor.id)) invalid('assetTypeCatalog', 'definitions', 'asset type IDs must be unique');
    byId.set(descriptor.id, descriptor);
    entries.push(descriptor);
  }

  const frozenEntries = Object.freeze([...entries]);
  return Object.freeze({
    [ASSET_TYPE_CATALOG_BRAND]: true,
    has(id) {
      return typeof id === 'string' && byId.has(id);
    },
    get(id) {
      return typeof id === 'string' ? byId.get(id) ?? null : null;
    },
    list() {
      return frozenEntries;
    },
  });
}

/** Validate a Project envelope; rootPolicy is data-only and is not enforced here. */
export function validateProject(value) {
  const project = copyRecord(value, 'project');
  assertSchemaVersion(project, 'project');
  assertId(project.id, 'project', 'id');
  assertOptionalRecord(project, 'project', 'rootPolicy', { nonEmpty: true });
  if (project.rootPolicy === undefined) invalid('project', 'rootPolicy', 'is required');
  assertTimestamp(project.createdAt, 'project', 'createdAt');
  assertOptionalTimestamp(project, 'project', 'updatedAt');

  if (project.engine !== undefined && project.engine !== null) {
    if (typeof project.engine === 'string') {
      assertText(project.engine, 'project', 'engine');
    } else if (isPlainRecord(project.engine)) {
      assertId(project.engine.id, 'project.engine', 'id');
      if (project.engine.version !== undefined) assertText(project.engine.version, 'project.engine', 'version');
    } else {
      invalid('project', 'engine', 'must be a string or a plain object with an id');
    }
  }
  if (project.targets !== undefined) assertStringList(project.targets, 'project', 'targets');
  return freezeData(project);
}

/** Validate an Asset against an explicitly supplied catalog; no category enum is built in. */
export function validateAsset(value, catalog) {
  const asset = copyRecord(value, 'asset');
  assertSchemaVersion(asset, 'asset');
  assertId(asset.id, 'asset', 'id');
  assertId(asset.projectId, 'asset', 'projectId');
  const assetTypeId = assertId(asset.assetTypeId, 'asset', 'assetTypeId');
  if (!catalog || catalog[ASSET_TYPE_CATALOG_BRAND] !== true
    || typeof catalog.has !== 'function' || typeof catalog.get !== 'function') {
    invalid('asset', 'catalog', 'must be created with createAssetTypeCatalog');
  }
  const descriptor = catalog.get(assetTypeId);
  if (!catalog.has(assetTypeId) || !descriptor || descriptor.id !== assetTypeId) {
    invalid('asset', 'assetTypeId', 'is not registered in the supplied catalog');
  }

  if (asset.subtype !== undefined && asset.subtype !== null) assertText(asset.subtype, 'asset', 'subtype');
  if (asset.name !== undefined) assertText(asset.name, 'asset', 'name');
  if (asset.brief !== undefined) assertText(asset.brief, 'asset', 'brief', { allowEmpty: true });
  if (asset.tags !== undefined) assertStringList(asset.tags, 'asset', 'tags');
  if (asset.targets !== undefined) assertStringList(asset.targets, 'asset', 'targets');
  if (asset.currentVersionId !== undefined && asset.currentVersionId !== null) {
    assertId(asset.currentVersionId, 'asset', 'currentVersionId');
  }
  assertOptionalTimestamp(asset, 'asset', 'createdAt');
  assertOptionalTimestamp(asset, 'asset', 'updatedAt');
  return freezeData(asset);
}

/** Validate an Artifact record without touching the URI or filesystem. */
export function validateArtifact(value) {
  const artifact = copyRecord(value, 'artifact');
  assertSchemaVersion(artifact, 'artifact');
  assertId(artifact.id, 'artifact', 'id');
  assertText(artifact.uri, 'artifact', 'uri');
  const mediaType = assertText(artifact.mediaType, 'artifact', 'mediaType');
  if (!MEDIA_TYPE_PATTERN.test(mediaType)) invalid('artifact', 'mediaType', 'must be a media type such as image/png');
  assertText(artifact.role, 'artifact', 'role');
  if (!Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0) {
    invalid('artifact', 'sizeBytes', 'must be a positive safe integer');
  }
  if (typeof artifact.sha256 !== 'string' || !SHA256_PATTERN.test(artifact.sha256)) {
    invalid('artifact', 'sha256', 'must be a 64-character SHA-256 hex digest');
  }
  if (artifact.format !== undefined) assertText(artifact.format, 'artifact', 'format');
  if (artifact.parentArtifactIds !== undefined) {
    assertStringList(artifact.parentArtifactIds, 'artifact', 'parentArtifactIds', { ids: true });
    if (artifact.parentArtifactIds.includes(artifact.id)) invalid('artifact', 'parentArtifactIds', 'cannot include the artifact itself');
  }
  if (artifact.validatorIds !== undefined) assertStringList(artifact.validatorIds, 'artifact', 'validatorIds', { ids: true });
  assertOptionalRecord(artifact, 'artifact', 'metadata');
  return freezeData(artifact);
}

/** Validate local AssetVersion references; existence is checked by a future store layer. */
export function validateAssetVersion(value) {
  const version = copyRecord(value, 'assetVersion');
  assertSchemaVersion(version, 'assetVersion');
  assertId(version.id, 'assetVersion', 'id');
  assertId(version.assetId, 'assetVersion', 'assetId');
  assertTimestamp(version.createdAt, 'assetVersion', 'createdAt');
  assertStringList(version.artifactIds, 'assetVersion', 'artifactIds', { ids: true });
  if (version.parentVersionIds === undefined) version.parentVersionIds = [];
  assertStringList(version.parentVersionIds, 'assetVersion', 'parentVersionIds', { ids: true });
  if (version.parentVersionIds.includes(version.id)) invalid('assetVersion', 'parentVersionIds', 'cannot include the version itself');
  for (const field of ['provenanceIds', 'reviewIds']) {
    if (version[field] !== undefined) assertStringList(version[field], 'assetVersion', field, { ids: true });
  }
  if (version.actor !== undefined) assertText(version.actor, 'assetVersion', 'actor');
  if (version.reason !== undefined) assertText(version.reason, 'assetVersion', 'reason', { allowEmpty: true });
  return freezeData(version);
}

/**
 * Validate a provenance envelope. Source/rights semantics remain open; records
 * are preserved as data and must be reviewed by a future policy-aware layer.
 */
export function validateProvenance(value) {
  const provenance = copyRecord(value, 'provenance');
  assertSchemaVersion(provenance, 'provenance');
  assertId(provenance.id, 'provenance', 'id');
  assertTimestamp(provenance.recordedAt, 'provenance', 'recordedAt');
  assertDataRecordList(provenance.sources, 'provenance', 'sources');
  assertDataRecordList(provenance.transformations, 'provenance', 'transformations');
  assertStringList(provenance.inputArtifactIds, 'provenance', 'inputArtifactIds', { ids: true });
  assertStringList(provenance.outputArtifactIds, 'provenance', 'outputArtifactIds', { ids: true });
  return freezeData(provenance);
}

/** Validate a structural result for one exact artifact hash and validator version. */
export function validateValidationResult(value) {
  const result = copyRecord(value, 'validationResult');
  assertSchemaVersion(result, 'validationResult');
  assertId(result.id, 'validationResult', 'id');
  assertId(result.artifactId, 'validationResult', 'artifactId');
  if (typeof result.artifactSha256 !== 'string' || !SHA256_PATTERN.test(result.artifactSha256)) {
    invalid('validationResult', 'artifactSha256', 'must be a 64-character SHA-256 hex digest');
  }
  assertId(result.validatorId, 'validationResult', 'validatorId');
  assertText(result.validatorVersion, 'validationResult', 'validatorVersion');
  assertText(result.status, 'validationResult', 'status');
  assertTimestamp(result.validatedAt, 'validationResult', 'validatedAt');
  assertDataRecordList(result.checks, 'validationResult', 'checks');
  if (result.limitations !== undefined) assertStringList(result.limitations, 'validationResult', 'limitations');
  return freezeData(result);
}
