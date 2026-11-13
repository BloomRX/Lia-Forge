/**
 * Adapter SDK do Lia Forge (F2).
 *
 * Define o contrato único de adapter documentado em
 * `docs/T12-CAPABILITY-AND-TOOLCHAIN-MATRIX.md` §3: os mesmos 15 campos para
 * todos os adapters e três classes que nunca se misturam.
 *
 *   1. `execution`  — executa e devolve artefatos validáveis (Blender, ComfyUI).
 *   2. `manual-editing` — a pessoa produz; o Forge só descobre, abre e registra
 *      caminhos reais. Nunca possui `execute`.
 *   3. `remote-service` — endpoint de terceiro: exige autorização explícita de
 *      envio, custo declarado (mesmo `unknown`) e `reconcile` obrigatório.
 *
 * Regras de segurança herdadas do runner e preservadas aqui:
 * - nenhum adapter instala, baixa, compra ou envia dados por conta própria;
 *   instalação/download/envio são ações protegidas que dependem de autorização;
 * - `cost.status` só pode ser `known` com `unit` e `value` presentes;
 * - mensagens e logs passam por redação antes de sair do processo;
 * - `discover()` nunca gera artefato: é leitura (binário, versão, endpoint).
 *
 * Este módulo é puro (sem fs, sem rede, sem Buffer) para poder ser usado tanto
 * no processo principal do Electron quanto no Studio.
 */

export const ADAPTER_SDK_VERSION = 1;

export const ADAPTER_CLASSES = Object.freeze(['execution', 'manual-editing', 'remote-service']);

export const COST_STATUSES = Object.freeze(['known', 'unknown', 'not-applicable']);

export const BACKEND_KINDS = Object.freeze([
  'local-process',
  'local-http-loopback',
  'local-cpu',
  'local-vulkan',
  'local-cuda',
  'remote-worker',
  'hosted-service',
  'colab-notebook',
  'rented-gpu',
]);

export const ERROR_CODES = Object.freeze([
  'WORKFLOW_BLOCKED',
  'WORKFLOW_CANCELLED',
  'WORKFLOW_FAILED',
  'ADAPTER_MISCONFIGURED',
  'ADAPTER_UNAVAILABLE',
  'ADAPTER_LICENSE_BLOCKED',
  'ADAPTER_COST_UNAUTHORIZED',
  'ADAPTER_OUTPUT_INVALID',
  'ADAPTER_SEND_UNAUTHORIZED',
]);

/** Ações que nunca podem acontecer sem autorização humana explícita. */
export const PROTECTED_ACTIONS = Object.freeze([
  'send_data',
  'cost',
  'install_software',
  'download_models_or_weights',
]);

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
// Chaves de configuração são identificadores de campo (camelCase permitido);
// ids de adapter/capacidade/contrato continuam estritamente minúsculos.
const CONFIG_KEY_PATTERN = /^[a-z][A-Za-z0-9._-]*$/;
const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey|token|secret|password|passwd|authorization|bearer)\s*[:=]\s*\S+/gi,
  /sk-[A-Za-z0-9_-]{8,}/g,
  /ghp_[A-Za-z0-9]{8,}/g,
  /hf_[A-Za-z0-9]{8,}/g,
  /xox[baprs]-[A-Za-z0-9-]+/g,
  /(?:^|[\s/?&])(?:key|token|apikey|api_key|access_token|sig)=([A-Za-z0-9._~%+-]{6,})/gim,
];

export function fail(field, reason) {
  const error = new TypeError(`adapter.${field}: ${reason}`);
  error.code = 'ADAPTER_MISCONFIGURED';
  return error;
}

/** Redige segredos de qualquer texto que vá para log, evento ou interface. */
export function redactSecrets(text, replacement = '[REDACTED]') {
  if (typeof text !== 'string') return text === undefined || text === null ? '' : String(text);
  let output = text;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    output = output.replace(pattern, (match) => {
      if (match.startsWith('sk-') || match.startsWith('ghp_') || match.startsWith('hf_') || match.startsWith('xox')) {
        return replacement;
      }
      const separator = match.search(/[:=]/);
      return separator === -1 ? replacement : `${match.slice(0, separator + 1)}${replacement}`;
    });
  }
  return output;
}

export function adapterError(code, message, details = {}) {
  if (!ERROR_CODES.includes(code)) throw fail('error.code', `must be one of ${ERROR_CODES.join(', ')}`);
  const error = new Error(redactSecrets(message));
  error.code = code;
  if (details && typeof details === 'object') {
    error.details = Object.freeze({ ...details, message: redactSecrets(String(details.message ?? message)) });
  }
  return error;
}

function requireText(value, field, { pattern = null, allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw fail(field, 'must be a non-empty string');
  if (pattern && !pattern.test(value)) throw fail(field, 'must be a stable id ([a-z0-9][a-z0-9._-]*)');
  return value;
}

function requireIdList(value, field, { optional = false } = {}) {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value)) throw fail(field, 'must be an array of ids');
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    requireText(item, `${field}[${index}]`, { pattern: ID_PATTERN });
    if (seen.has(item)) throw fail(`${field}[${index}]`, 'must not repeat ids');
    seen.add(item);
  }
  return [...value];
}

function requireStringList(value, field, { optional = false, nullable = false } = {}) {
  if (value === undefined && optional) return [];
  if (value === null && nullable) return null;
  if (!Array.isArray(value)) throw fail(field, 'must be an array of strings');
  for (const [index, item] of value.entries()) requireText(item, `${field}[${index}]`);
  return [...value];
}

function requireNullableText(value, field) {
  if (value === null || value === undefined) return null;
  return requireText(value, field);
}

function requireNullableNumber(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw fail(field, 'must be a non-negative finite number or null (null = unknown)');
  }
  return value;
}

function normalizeRequirements(value = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail('requirements', 'must be a plain object');
  return Object.freeze({
    // null = requisito desconhecido/não aplicável (nunca "nenhum").
    os: value.os === undefined ? null : requireStringList(value.os, 'requirements.os', { nullable: true }),
    gpu: value.gpu === undefined ? null : requireStringList(value.gpu, 'requirements.gpu', { nullable: true }),
    vramMb: requireNullableNumber(value.vramMb, 'requirements.vramMb'),
    ramMb: requireNullableNumber(value.ramMb, 'requirements.ramMb'),
    diskMb: requireNullableNumber(value.diskMb, 'requirements.diskMb'),
    runtime: value.runtime === undefined ? null : requireText(value.runtime, 'requirements.runtime'),
    network: value.network === true,
    offlineCapable: value.offlineCapable !== false,
  });
}

function normalizeConfiguration(value = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail('configuration', 'must be a plain object');
  const fields = {};
  for (const [key, item] of Object.entries(value)) {
    requireText(key, 'configuration key', { pattern: CONFIG_KEY_PATTERN });
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      fields[key] = Object.freeze({ kind: 'unknown', required: false, description: '' });
      continue;
    }
    const kind = item.kind === undefined ? 'path' : requireText(item.kind, `configuration.${key}.kind`);
    if (!['path', 'endpoint', 'env', 'choice', 'number', 'boolean', 'text', 'unknown'].includes(kind)) {
      throw fail(`configuration.${key}.kind`, 'must be path|endpoint|env|choice|number|boolean|text|unknown');
    }
    fields[key] = Object.freeze({
      kind,
      required: item.required === true,
      description: item.description === undefined ? '' : requireText(item.description, `configuration.${key}.description`, { allowEmpty: true }),
      default: item.default === undefined ? null : item.default,
      env: item.env === undefined ? null : requireText(item.env, `configuration.${key}.env`),
      choices: item.choices === undefined ? null : Object.freeze(requireStringList(item.choices, `configuration.${key}.choices`)),
      secret: item.secret === true,
    });
  }
  return Object.freeze(fields);
}

function normalizeContract(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(field, 'must be a plain object');
  return Object.freeze({
    id: requireText(value.id, `${field}.id`, { pattern: ID_PATTERN }),
    formats: Object.freeze(requireStringList(value.formats, `${field}.formats`)),
    // `null` é explícito: contratos sem validador conhecido falham fechados no QA.
    validator: value.validator === undefined || value.validator === null ? null : requireText(value.validator, `${field}.validator`, { pattern: ID_PATTERN }),
    required: value.required !== false,
  });
}

function normalizeContractList(value, field, { optional = false } = {}) {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value)) throw fail(field, 'must be an array of contracts');
  const seen = new Set();
  const contracts = value.map((item, index) => {
    const contract = normalizeContract(item, `${field}[${index}]`);
    if (seen.has(contract.id)) throw fail(`${field}[${index}]`, `duplicate contract id: ${contract.id}`);
    seen.add(contract.id);
    return contract;
  });
  return Object.freeze(contracts);
}

function normalizeCost(value = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail('cost', 'must be a plain object');
  const status = value.status === undefined ? 'unknown' : requireText(value.status, 'cost.status');
  if (!COST_STATUSES.includes(status)) throw fail('cost.status', `must be one of ${COST_STATUSES.join(', ')}`);
  if (status === 'known') {
    requireText(value.unit ?? '', 'cost.unit');
    requireNullableNumber(value.value, 'cost.value');
    if (value.value === null || value.value === undefined) throw fail('cost.value', 'known cost requires a numeric value');
  }
  return Object.freeze({
    status,
    unit: requireNullableText(value.unit, 'cost.unit'),
    value: status === 'known' ? value.value : null,
    currency: requireNullableText(value.currency, 'cost.currency'),
    note: value.note === undefined ? '' : redactSecrets(requireText(value.note, 'cost.note', { allowEmpty: true })),
  });
}

function normalizeBackend(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(field, 'must be a plain object');
  const kind = requireText(value.kind, `${field}.kind`);
  if (!BACKEND_KINDS.includes(kind)) throw fail(`${field}.kind`, `must be one of ${BACKEND_KINDS.join(', ')}`);
  return Object.freeze({
    kind,
    validated: value.validated === true,
    note: value.note === undefined ? '' : redactSecrets(requireText(value.note, `${field}.note`, { allowEmpty: true })),
  });
}

function normalizeHealth(value = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail('health', 'must be a plain object');
  const status = requireText(value.status ?? 'unknown', 'health.status');
  if (!['available', 'missing', 'blocked', 'unknown', 'stale'].includes(status)) {
    throw fail('health.status', 'must be available|missing|blocked|unknown|stale');
  }
  return Object.freeze({
    status,
    version: requireNullableText(value.version, 'health.version'),
    detail: value.detail === undefined ? '' : redactSecrets(requireText(value.detail, 'health.detail', { allowEmpty: true })),
    checkedAt: requireNullableText(value.checkedAt, 'health.checkedAt'),
  });
}

function normalizeProvenance(value = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail('provenance', 'must be a plain object');
  return Object.freeze({
    // `null`/`UNKNOWN` explícito: proveniência não verificada nunca vira afirmação.
    source: requireNullableText(value.source, 'provenance.source'),
    tool: requireNullableText(value.tool, 'provenance.tool'),
    version: requireNullableText(value.version, 'provenance.version'),
    sha256: requireNullableText(value.sha256, 'provenance.sha256'),
    license: requireNullableText(value.license, 'provenance.license'),
    licenseScope: requireNullableText(value.licenseScope, 'provenance.licenseScope'),
    weightsLicense: requireNullableText(value.weightsLicense, 'provenance.weightsLicense'),
    outputRights: requireNullableText(value.outputRights, 'provenance.outputRights'),
    note: value.note === undefined ? '' : redactSecrets(requireText(value.note, 'provenance.note', { allowEmpty: true })),
  });
}

function normalizeEvidence(value = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail('evidence', 'must be a plain object');
  return Object.freeze({
    tests: Object.freeze(requireStringList(value.tests, 'evidence.tests', { optional: true })),
    validatedVersions: Object.freeze(requireStringList(value.validatedVersions, 'evidence.validatedVersions', { optional: true })),
    executedOn: requireNullableText(value.executedOn, 'evidence.executedOn'),
    state: value.state === undefined ? 'code-present' : requireText(value.state, 'evidence.state'),
    note: value.note === undefined ? '' : redactSecrets(requireText(value.note, 'evidence.note', { allowEmpty: true })),
  });
}

/**
 * Valida e congela um manifesto de adapter.
 *
 * `implementation` aceita `execute` (obrigatório para `execution` e
 * `remote-service`, proibido para `manual-editing`), `discover` (obrigatório
 * para as três classes) e `launch`/`reconcile` conforme a classe.
 */
export function defineAdapter(definition, implementation = {}) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw fail('definition', 'must be a plain object');
  }
  const adapterClass = requireText(definition.class, 'class');
  if (!ADAPTER_CLASSES.includes(adapterClass)) throw fail('class', `must be one of ${ADAPTER_CLASSES.join(', ')}`);

  const manifest = Object.freeze({
    sdkVersion: ADAPTER_SDK_VERSION,
    id: requireText(definition.id, 'id', { pattern: ID_PATTERN }),
    version: requireText(definition.version, 'version'),
    class: adapterClass,
    title: requireText(definition.title, 'title'),
    description: requireText(definition.description ?? '', 'description', { allowEmpty: true }),
    capabilities: Object.freeze(requireIdList(definition.capabilities, 'capabilities')),
    providers: Object.freeze(requireIdList(definition.providers, 'providers', { optional: true })),
    requirements: normalizeRequirements(definition.requirements),
    configuration: normalizeConfiguration(definition.configuration),
    inputContracts: normalizeContractList(definition.inputContracts, 'inputContracts', { optional: true }),
    outputContracts: normalizeContractList(definition.outputContracts, 'outputContracts', { optional: true }),
    execution: Object.freeze(requireStringList(definition.execution, 'execution', { optional: true })),
    progress: definition.progress !== false,
    cancel: definition.cancel !== false,
    // Códigos de erro são MAIÚSCULOS com underscore e precisam existir no SDK.
    errors: Object.freeze((definition.errors ?? []).map((code, index) => {
      requireText(code, `errors[${index}]`);
      if (!ERROR_CODES.includes(code)) throw fail(`errors[${index}]`, `must be one of ${ERROR_CODES.join(', ')}`);
      return code;
    })),
    logs: Object.freeze({
      redacted: definition.logs?.redacted !== false,
      maxEntries: requireNullableNumber(definition.logs?.maxEntries, 'logs.maxEntries') ?? 1200,
    }),
    provenance: normalizeProvenance(definition.provenance),
    cost: normalizeCost(definition.cost),
    backends: Object.freeze((definition.backends ?? []).map((item, index) => normalizeBackend(item, `backends[${index}]`))),
    health: normalizeHealth(definition.health),
    evidence: normalizeEvidence(definition.evidence),
    protectedActions: Object.freeze(requireIdList(definition.protectedActions ?? [...PROTECTED_ACTIONS], 'protectedActions')),
  });

  if (!manifest.capabilities.length) throw fail('capabilities', 'an adapter must serve at least one capability');
  if (!manifest.backends.length) throw fail('backends', 'an adapter must declare at least one backend');

  const discover = implementation.discover;
  const execute = implementation.execute;
  const launch = implementation.launch;
  const reconcile = implementation.reconcile;

  if (typeof discover !== 'function') throw fail('implementation.discover', 'must be a function (read-only probe)');
  if (adapterClass === 'manual-editing') {
    if (execute !== undefined) {
      throw fail('implementation.execute', 'a manual-editing tool must not execute; it only discovers, launches and records real paths');
    }
    if (typeof launch !== 'function') throw fail('implementation.launch', 'a manual-editing tool must be launchable');
  } else {
    if (typeof execute !== 'function') throw fail('implementation.execute', `${adapterClass} adapters must implement execute`);
  }
  if (adapterClass === 'remote-service') {
    if (typeof reconcile !== 'function') throw fail('implementation.reconcile', 'a remote service must reconcile what was sent and produced');
    if (manifest.cost.status === 'not-applicable') throw fail('cost.status', 'a remote service must declare a cost status (unknown is acceptable)');
    const remoteBackend = manifest.backends.find((backend) => BACKEND_KINDS.slice(5).includes(backend.kind));
    if (!remoteBackend) throw fail('backends', 'a remote service must declare a remote backend kind');
  }

  return Object.freeze({
    manifest,
    discover: (...args) => discover(...args),
    execute: execute ? (...args) => execute(...args) : null,
    launch: launch ? (...args) => launch(...args) : null,
    reconcile: reconcile ? (...args) => reconcile(...args) : null,
    describe: () => describeAdapter(manifest),
  });
}

export const defineExecutionAdapter = (definition, implementation) =>
  defineAdapter({ ...definition, class: 'execution' }, implementation);

export const defineManualEditingTool = (definition, implementation) =>
  defineAdapter({ ...definition, class: 'manual-editing' }, implementation);

export const defineRemoteServiceAdapter = (definition, implementation) =>
  defineAdapter({ ...definition, class: 'remote-service' }, implementation);

/** Resumo legível usado pela interface e pelos relatórios de preflight. */
export function describeAdapter(manifest) {
  return Object.freeze({
    id: manifest.id,
    version: manifest.version,
    class: manifest.class,
    title: manifest.title,
    capabilities: manifest.capabilities,
    providers: manifest.providers,
    backends: manifest.backends,
    cost: manifest.cost,
    health: manifest.health,
    evidence: manifest.evidence,
    requirements: manifest.requirements,
    protectedActions: manifest.protectedActions,
    canExecute: manifest.class !== 'manual-editing',
    // `protectedActions` lista o que o adapter se recusa a fazer sem autorização
    // humana (instalar, baixar pesos, gastar, enviar dados) — não é um pedido de
    // autorização para executar. Exigir autorização de um renderer local que não
    // envia nada criaria pendências falsas no plano e na UI.
    needsAuthorization: manifest.requiresAuthorization === true
      || manifest.class === 'remote-service'
      || manifest.backends.some((backend) => !BACKEND_KINDS.slice(0, 5).includes(backend.kind)),
  });
}

/**
 * Relatório de compatibilidade adapter × capacidade × máquina.
 * Nunca afirma hardware validado sem evidência: `requirements.gpu` ausente ou
 * `validated: false` resulta em `unknown`, não em `compatible`.
 */
export function evaluateCompatibility({ manifest, capability, machine = {} }) {
  const blockers = [];
  const unknowns = [];
  const unmeasured = [];
  const requirements = manifest.requirements;

  if (capability && !manifest.capabilities.includes(capability.id)) {
    blockers.push(`o adapter não declara a capacidade ${capability.id}`);
  }
  if (requirements.os?.length && machine.os && !requirements.os.includes(machine.os)) {
    blockers.push(`requer ${requirements.os.join('/')} e a máquina é ${machine.os}`);
  }
  // Só vira "desconhecido" o requisito que o adapter DECLARA e a máquina não
  // mediu. Requisito null (desconhecido pelo adapter) é informativo: não pode
  // impedir compatibilidade nem fingir que foi verificado.
  for (const [field, label] of [['ramMb', 'RAM'], ['vramMb', 'VRAM'], ['diskMb', 'disco']]) {
    const needed = requirements[field];
    const available = machine[field];
    if (needed === null || needed === undefined) {
      unmeasured.push(`${label} exigido não é declarado por este adapter`);
      continue;
    }
    if (available === null || available === undefined) unknowns.push(`${label}: precisa de ${needed} MB e não foi medido nesta máquina`);
    else if (available < needed) blockers.push(`${label}: precisa de ${needed} MB e há ${available} MB`);
  }
  if (requirements.gpu?.length) {
    if (!machine.gpu) unknowns.push(`GPU exigida (${requirements.gpu.join('/')}) não foi verificada nesta máquina`);
    else if (!requirements.gpu.includes(machine.gpu)) blockers.push(`GPU ${machine.gpu} não está entre ${requirements.gpu.join('/')}`);
  }
  if (requirements.network && machine.network === false) blockers.push('requer rede e a execução offline foi pedida');
  if (!manifest.backends.some((backend) => backend.validated)) {
    unmeasured.push('nenhum backend foi validado por execução real no alvo');
  }

  const blocked = blockers.length > 0;
  const status = blocked ? 'incompatible' : unknowns.length ? 'unknown' : 'compatible';
  return Object.freeze({
    adapterId: manifest.id,
    capabilityId: capability?.id ?? null,
    status,
    // `compatible` é estrito: só sem bloqueios E sem requisitos não medidos.
    compatible: status === 'compatible',
    blocked,
    verified: status === 'compatible' && manifest.backends.some((backend) => backend.validated),
    blockers: Object.freeze(blockers),
    unknowns: Object.freeze(unknowns),
    unmeasured: Object.freeze(unmeasured),
  });
}
