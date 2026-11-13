/**
 * Asset Manager + Rights/Provenance (F4 — requisito §4/§5).
 *
 * Responsabilidade: registrar o que existe (assets, versões, artefatos por
 * estágio), de onde veio (proveniência) e o que pode ser feito com isso
 * (direitos). Não gera nada e não duplica o store existente:
 *
 *   - `.spriteforge/assets.json` continua sendo o store do app (schemaVersion 1,
 *     assets com `id` e `type` ∈ {character, item}); este módulo lê/escreve esse
 *     formato e apenas acrescenta campos opcionais, portanto é compatível com o
 *     que `electron/main.cjs` e o middleware do Vite já validam;
 *   - `.lia.json` continua sendo o registro por asset do Lia Desktop.
 *
 * Regras de direitos herdadas do ADR-001 e da T12: wrapper ≠ pesos, consent ≠
 * licença, `NOASSERTION` ≠ sem licença, derivado de restrito herda restrição.
 * Nada é inferido: sem declaração explícita, o estado é `unknown`.
 */

export const ASSET_MANAGER_SCHEMA_VERSION = 1;

export const RIGHTS_STATES = Object.freeze([
  'owned',                 // criado pelo usuário/por ele autorizado
  'licensed',              // licença declarada e lida
  'license-pending',       // licença existe mas ainda não foi verificada
  'unknown',               // nenhuma declaração (padrão seguro)
  'restricted',            // licença restritiva conhecida (ex.: não comercial)
  'blocked',               // não pode ser usado/redistribuído
]);

/**
 * Trechos que indicam restrição real declarada por alguém.
 *
 * `NOASSERTION` NÃO está aqui: significa "ninguém afirmou nada", ou seja,
 * licença pendente — tratá-la como restritiva inventaria uma restrição que não
 * foi declarada. Para ela existe PENDING_HINTS.
 */
export const RESTRICTED_HINTS = Object.freeze([
  'non-commercial', 'noncommercial', 'nc', 'custom', 'proprietary',
  'cc-by-nc', 'polyform', 'research only', 'educational', 'education', 'spine',
]);

/** Trechos que significam "licença declarada como desconhecida". */
export const PENDING_HINTS = Object.freeze([
  'noassertion', 'unknown', 'unspecified', 'no license', 'see source model',
]);

/**
 * Casa um hint com uma licença sem falso positivo por substring.
 *
 * Hint de uma palavra só casa como token inteiro (`nc` casa em `CC-BY-NC-4.0`,
 * mas não em `NCSA` nem em `licence`); hint composto casa por substring.
 */
function matchesHint(license, hint) {
  const loweredLicense = license.toLowerCase();
  const loweredHint = hint.toLowerCase();
  if (loweredHint.includes(' ') || loweredHint.includes('-')) {
    return loweredLicense.includes(loweredHint) || loweredLicense.includes(loweredHint.replaceAll('-', ' '));
  }
  return loweredLicense.split(/[^a-z0-9]+/).filter(Boolean).includes(loweredHint);
}

function assertText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`asset.${field}: must be a non-empty string`);
  return value;
}

/** Estado de direitos a partir de licenças declaradas — sem inferir nada. */
export function classifyRights({ declarations = [], generatedBy = null, thirdPartyInputs = [] }) {
  const licenses = declarations.map((item) => String(item?.license ?? '').trim()).filter(Boolean);
  // o casamento ignora caixa, mas o relatório preserva o texto declarado
  const restricted = licenses.filter((license) => RESTRICTED_HINTS.some((hint) => matchesHint(license, hint)));
  const pending = licenses.filter((license) => PENDING_HINTS.some((hint) => matchesHint(license, hint)));
  const permissive = licenses.filter((license) => ['mit', 'apache-2.0', 'bsd-3-clause', 'cc0', 'cc0-1.0', 'unlicense'].includes(license.toLowerCase()));

  let state = 'unknown';
  if (restricted.length) state = 'restricted';
  else if (pending.length) state = 'license-pending';
  else if (licenses.length && permissive.length === licenses.length) state = 'licensed';
  else if (!licenses.length && generatedBy === 'user' && !thirdPartyInputs.length) state = 'owned';
  else if (licenses.length) state = 'license-pending';

  const blockers = [];
  if (restricted.length) blockers.push(`licença(s) restritiva(s) declarada(s): ${restricted.join(', ')}`);
  if (pending.length && state !== 'restricted') blockers.push(`licença declarada como desconhecida (${pending.join(', ')}): uso e redistribuição exigem decisão humana`);
  if (thirdPartyInputs.some((input) => input?.rights === 'blocked')) blockers.push('entrada de terceiro marcada como bloqueada');
  if (state === 'unknown') blockers.push('nenhuma licença declarada: uso e redistribuição permanecem indefinidos');
  if (blocked(declarations)) {
    state = 'blocked';
    blockers.push('declaração explícita de bloqueio');
  }

  return Object.freeze({
    state,
    licenses: Object.freeze(licenses),
    restricted: Object.freeze(restricted),
    pending: Object.freeze(pending),
    permissive: Object.freeze(permissive),
    inheritRestriction: restricted.length > 0,
    blockers: Object.freeze(blockers),
    redistributable: state === 'owned' || (state === 'licensed' && !restricted.length),
    note: 'Direitos não são inferidos: apenas o que foi declarado por uma pessoa conta.',
  });
}

function blocked(declarations) {
  return declarations.some((item) => item?.blocked === true || String(item?.license ?? '').toUpperCase() === 'BLOCKED');
}

/** Normaliza um registro de asset no formato do store existente (+ extras). */
export function normalizeAssetRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('asset: registro inválido');
  const id = assertText(record.id, 'id');
  const type = record.type ?? 'character';
  if (!['character', 'item'].includes(type)) {
    // o store publicado só aceita character|item; qualquer outro valor é erro,
    // não uma extensão silenciosa
    throw new TypeError(`asset.type: "${type}" não é aceito pelo store (.spriteforge/assets.json aceita character|item)`);
  }
  return Object.freeze({
    id,
    type,
    name: record.name === undefined ? id : assertText(record.name, 'name'),
    // campos já usados pelo app
    prompt: record.prompt ?? null,
    checkpoint: record.checkpoint ?? null,
    stage: record.stage ?? null,
    stages: Object.freeze((record.stages ?? []).map((stage) => Object.freeze({ ...stage }))),
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    // campos acrescentados pelo Asset Manager (opcionais e aditivos)
    kind: record.kind ?? type,
    capabilities: Object.freeze([...(record.capabilities ?? [])]),
    versions: Object.freeze((record.versions ?? []).map((version) => Object.freeze({
      version: version.version,
      createdAt: version.createdAt ?? null,
      artifacts: Object.freeze((version.artifacts ?? []).map((artifact) => Object.freeze({
        path: artifact.path,
        role: artifact.role ?? 'artifact',
        format: artifact.format ?? null,
        bytes: artifact.bytes ?? null,
        sha256: artifact.sha256 ?? null,
        validator: artifact.validator ?? null,
        validated: artifact.validated === true,
        contentMetrics: artifact.contentMetrics ?? null,
      }))),
      runId: version.runId ?? null,
      note: version.note ?? null,
    }))),
    rights: record.rights ? Object.freeze({ ...record.rights }) : classifyRights({}),
    provenance: Object.freeze((record.provenance ?? []).map((entry) => Object.freeze({
      source: entry.source ?? null,
      tool: entry.tool ?? null,
      adapter: entry.adapter ?? null,
      adapterVersion: entry.adapterVersion ?? null,
      model: entry.model ?? null,
      license: entry.license ?? null,
      weightsLicense: entry.weightsLicense ?? null,
      outputRights: entry.outputRights ?? null,
      runId: entry.runId ?? null,
      at: entry.at ?? null,
    }))),
    destination: record.destination ?? null,
  });
}

/**
 * Cria um Asset Manager sobre um store (objeto em memória) e um gravador
 * injetado. O gravador é quem garante escrita atômica e confinamento ao
 * projeto — o mesmo caminho que `electron/main.cjs` já usa.
 */
export function createAssetManager({ store = null, save = null, now = () => new Date() } = {}) {
  const state = {
    schemaVersion: store?.schemaVersion ?? ASSET_MANAGER_SCHEMA_VERSION,
    assets: (store?.assets ?? []).map(normalizeAssetRecord),
    updatedAt: store?.updatedAt ?? null,
  };

  function indexOf(id) {
    return state.assets.findIndex((asset) => asset.id === id);
  }

  async function commit() {
    state.updatedAt = now().toISOString();
    const payload = { schemaVersion: state.schemaVersion, assets: state.assets.map((asset) => ({ ...asset })), updatedAt: state.updatedAt };
    if (typeof save === 'function') await save(payload);
    return payload;
  }

  return Object.freeze({
    schemaVersion: state.schemaVersion,
    list: () => Object.freeze([...state.assets]),
    get: (id) => state.assets[indexOf(id)] ?? null,
    count: () => state.assets.length,

    async upsert(record) {
      // `normalizeAssetRecord` é pura (sem relógio): quem carimba é o manager,
      // usando o `now` injetado — assim os testes são determinísticos.
      const stamp = now().toISOString();
      const normalized = normalizeAssetRecord({
        ...record,
        createdAt: record.createdAt ?? stamp,
        updatedAt: stamp,
      });
      const position = indexOf(normalized.id);
      if (position === -1) {
        state.assets.push(normalized);
      } else {
        const previous = state.assets[position];
        state.assets[position] = { ...normalized, createdAt: previous.createdAt ?? normalized.createdAt };
      }
      await commit();
      return state.assets[indexOf(normalized.id)];
    },

    async remove(id) {
      const position = indexOf(id);
      if (position === -1) return false;
      state.assets.splice(position, 1);
      await commit();
      return true;
    },

    /** Registra uma nova versão com artefatos já validados (hash + métricas). */
    async addVersion(id, version) {
      const position = indexOf(id);
      if (position === -1) throw new TypeError(`addVersion: asset "${id}" não existe`);
      const asset = state.assets[position];
      const entry = Object.freeze({
        version: version.version ?? `v${asset.versions.length + 1}`,
        createdAt: version.createdAt ?? now().toISOString(),
        artifacts: Object.freeze((version.artifacts ?? []).map((artifact) => Object.freeze({
          path: assertText(artifact.path, 'artifact.path'),
          role: artifact.role ?? 'artifact',
          format: artifact.format ?? null,
          bytes: artifact.bytes ?? null,
          sha256: artifact.sha256 ?? null,
          validator: artifact.validator ?? null,
          validated: artifact.validated === true,
          contentMetrics: artifact.contentMetrics ?? null,
        }))),
        runId: version.runId ?? null,
        note: version.note ?? null,
      });
      state.assets[position] = { ...asset, versions: Object.freeze([...asset.versions, entry]), updatedAt: entry.createdAt };
      await commit();
      return entry;
    },

    /** Registra proveniência (quem/o quê gerou) e recalcula direitos. */
    async addProvenance(id, entry) {
      const position = indexOf(id);
      if (position === -1) throw new TypeError(`addProvenance: asset "${id}" não existe`);
      const asset = state.assets[position];
      const record = Object.freeze({
        source: entry.source ?? null,
        tool: entry.tool ?? null,
        adapter: entry.adapter ?? null,
        adapterVersion: entry.adapterVersion ?? null,
        model: entry.model ?? null,
        license: entry.license ?? null,
        weightsLicense: entry.weightsLicense ?? null,
        outputRights: entry.outputRights ?? null,
        runId: entry.runId ?? null,
        at: entry.at ?? now().toISOString(),
      });
      const provenance = Object.freeze([...asset.provenance, record]);
      const rights = classifyRights({
        declarations: provenance.map((item) => ({ license: item.license ?? item.weightsLicense ?? null })),
        generatedBy: provenance.length ? 'tool' : 'user',
        thirdPartyInputs: entry.thirdPartyInputs ?? [],
      });
      state.assets[position] = { ...asset, provenance, rights, updatedAt: record.at };
      await commit();
      return { provenance: record, rights };
    },

    /** Direitos explícitos declarados pelo usuário (nunca inferidos). */
    async declareRights(id, declaration) {
      const position = indexOf(id);
      if (position === -1) throw new TypeError(`declareRights: asset "${id}" não existe`);
      const asset = state.assets[position];
      const rights = classifyRights({
        declarations: [{ license: declaration.license ?? null, blocked: declaration.blocked === true }],
        generatedBy: declaration.generatedBy ?? 'user',
        thirdPartyInputs: declaration.thirdPartyInputs ?? [],
      });
      state.assets[position] = {
        ...asset,
        rights: Object.freeze({ ...rights, declaredBy: declaration.declaredBy ?? null, declaredAt: now().toISOString(), note: declaration.note ?? rights.note }),
        updatedAt: now().toISOString(),
      };
      await commit();
      return state.assets[position].rights;
    },

    /** Relatório de direitos do projeto inteiro (para a tela de entrega). */
    rightsReport() {
      const byState = {};
      for (const stateName of RIGHTS_STATES) byState[stateName] = 0;
      const blockers = [];
      for (const asset of state.assets) {
        byState[asset.rights?.state ?? 'unknown'] += 1;
        if (asset.rights?.blockers?.length) blockers.push({ id: asset.id, blockers: asset.rights.blockers });
      }
      return Object.freeze({
        total: state.assets.length,
        byState: Object.freeze(byState),
        blockedAssets: Object.freeze(blockers),
        redistributable: Object.freeze(state.assets.filter((asset) => asset.rights?.redistributable).map((asset) => asset.id)),
        note: 'Estado unknown significa "ninguém declarou", não "livre para usar".',
      });
    },

    /** Store no formato publicado (compatível com main.cjs e com o Vite). */
    toStore: () => ({ schemaVersion: state.schemaVersion, assets: state.assets.map((asset) => ({ ...asset })), updatedAt: state.updatedAt }),
  });
}
