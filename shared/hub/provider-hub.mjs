/**
 * Tool & Provider Hub (F5 — requisito §4/§7).
 *
 * Liga capacidade → adapter → ferramenta → backend, com o estado real de
 * descoberta. É o único lugar que responde "quem pode fazer isto agora?" e a
 * resposta nunca afirma disponibilidade sem evidência: adapter sem discover,
 * ferramenta ausente, requisito não medido ou licença pendente aparecem como
 * `missing`, `blocked` ou `unknown`.
 *
 * O Hub não executa: devolve candidatos ordenados para o Orchestrator montar o
 * plano e para o Execution Manager resolver o adapter.
 */

import { evaluateCompatibility } from '../adapters/sdk.mjs';

export const HUB_SCHEMA_VERSION = 1;

export const CANDIDATE_STATES = Object.freeze(['ready', 'unknown', 'blocked', 'missing']);

// Ordem de preferência: pronto > não verificado > ausente (o usuário pode
// instalar) > bloqueado (exige decisão humana de licença/autorização/custo).
const STATE_RANK = Object.freeze({ ready: 0, unknown: 1, missing: 2, blocked: 3 });
// Em igualdade de estado, ferramenta local vem antes de serviço remoto: o
// remoto envolve envio de dados e custo, e nunca é a escolha implícita.
const CLASS_RANK = Object.freeze({ execution: 0, 'manual-editing': 1, 'remote-service': 2 });

/**
 * @param {object} params
 * @param {object} params.registry Capability Registry
 * @param {Array} params.adapters adapters construídos pelo Adapter Registry
 * @param {Map<string,object>|object} params.discoveries descobertas por adapter
 * @param {object} params.machine medições reais (null = não medido)
 */
export function createProviderHub({ registry, adapters = [], discoveries = new Map(), machine = {}, preferences = {} }) {
  if (!registry || typeof registry.list !== 'function') throw new TypeError('createProviderHub: registry obrigatório');
  const discoveryMap = discoveries instanceof Map ? discoveries : new Map(Object.entries(discoveries ?? {}));

  function stateOf(adapter) {
    const discovery = discoveryMap.get(adapter.manifest.id) ?? null;
    const compatibility = evaluateCompatibility({ manifest: adapter.manifest, machine });
    const discoveryState = discovery?.status ?? 'unknown';
    let state;
    if (discoveryState === 'available' && compatibility.compatible) state = 'ready';
    else if (discoveryState === 'blocked' || compatibility.blocked) state = compatibility.blocked ? 'missing' : 'blocked';
    else if (discoveryState === 'missing') state = 'missing';
    else state = 'unknown';
    return { state, discovery, compatibility };
  }

  function candidatesFor(capabilityId) {
    const capability = registry.get(capabilityId);
    const candidates = adapters
      .filter((adapter) => adapter.manifest.capabilities.includes(capabilityId))
      .map((adapter) => {
        const { state, discovery, compatibility } = stateOf(adapter);
        return Object.freeze({
          adapterId: adapter.manifest.id,
          adapterVersion: adapter.manifest.version,
          class: adapter.manifest.class,
          title: adapter.manifest.title,
          providers: adapter.manifest.providers,
          state,
          discoveryDetail: discovery?.detail ?? 'Não verificado nesta execução.',
          detectedVersion: discovery?.version ?? null,
          executable: discovery?.executable ?? null,
          endpoint: discovery?.endpoint ?? null,
          compatibility,
          cost: adapter.manifest.cost,
          license: adapter.manifest.provenance?.license ?? null,
          licenseScope: adapter.manifest.provenance?.licenseScope ?? null,
          weightsLicense: adapter.manifest.provenance?.weightsLicense ?? null,
          outputRights: adapter.manifest.provenance?.outputRights ?? null,
          evidenceState: adapter.manifest.evidence?.state ?? 'code-present',
          backends: adapter.manifest.backends,
          requiresAuthorization: adapter.describe?.().needsAuthorization ?? adapter.manifest.class === 'remote-service',
          capabilityStatus: capability?.status ?? null,
          limitations: adapter.manifest.evidence?.note ? [adapter.manifest.evidence.note] : [],
        });
      })
      .sort((a, b) => {
        const rank = STATE_RANK[a.state] - STATE_RANK[b.state];
        if (rank !== 0) return rank;
        const classRank = (CLASS_RANK[a.class] ?? 9) - (CLASS_RANK[b.class] ?? 9);
        if (classRank !== 0) return classRank;
        // preferência declarada (ex.: sempre local antes de remoto)
        const preference = (preferences.order ?? []).indexOf(a.adapterId) - (preferences.order ?? []).indexOf(b.adapterId);
        if (preference !== 0 && (preferences.order ?? []).length) return preference;
        if (a.class !== b.class) return a.class === 'execution' ? -1 : 1;
        return a.adapterId.localeCompare(b.adapterId);
      });
    return Object.freeze(candidates);
  }

  return Object.freeze({
    schemaVersion: HUB_SCHEMA_VERSION,
    machine: Object.freeze({ ...machine }),
    candidatesFor,
    /** Escolhe o melhor candidato utilizável; devolve null e o motivo se não houver. */
    select(capabilityId, { allowUnknown = false, allowRemote = false } = {}) {
      const candidates = candidatesFor(capabilityId);
      const usable = candidates.find((candidate) => {
        if (candidate.state === 'ready') return candidate.class === 'remote-service' ? allowRemote : true;
        if (candidate.state === 'unknown' && allowUnknown) return candidate.class === 'remote-service' ? allowRemote : true;
        return false;
      });
      if (usable) return Object.freeze({ selected: usable, reason: null, candidates });
      const reason = !candidates.length
        ? `Nenhum adapter declara a capacidade "${capabilityId}".`
        : `Nenhum candidato utilizável para "${capabilityId}": ${candidates.map((candidate) => `${candidate.adapterId}=${candidate.state}`).join(', ')}.`;
      return Object.freeze({ selected: null, reason, candidates });
    },
    /** Mapa capacidade → estado, para a interface mostrar o que existe hoje. */
    capabilityStates() {
      return Object.freeze(registry.list().map((capability) => {
        const candidates = candidatesFor(capability.id);
        const ready = candidates.filter((candidate) => candidate.state === 'ready');
        return Object.freeze({
          id: capability.id,
          family: capability.family,
          title: capability.title,
          registryStatus: capability.status,
          state: ready.length ? 'ready' : candidates.some((candidate) => candidate.state === 'blocked') ? 'blocked'
            : candidates.length ? 'missing' : 'no-provider',
          providers: Object.freeze(candidates.map((candidate) => candidate.adapterId)),
          readyProviders: Object.freeze(ready.map((candidate) => candidate.adapterId)),
        });
      }));
    },
    /** Atualiza descobertas (novo preflight) sem reconstruir o Hub. */
    withDiscoveries(nextDiscoveries, nextMachine = machine) {
      return createProviderHub({ registry, adapters, discoveries: nextDiscoveries, machine: nextMachine, preferences });
    },
  });
}

/**
 * Roda as descobertas (somente leitura) e devolve o Hub já alimentado.
 * Falha de descoberta vira estado, nunca exceção.
 */
export async function discoverHub({ registry, adapters = [], machine = {}, configuration = {}, preferences = {}, timeoutMs = 8000 }) {
  const discoveries = new Map();
  await Promise.all(adapters.map(async (adapter) => {
    const id = adapter.manifest.id;
    if (typeof adapter.discover !== 'function') {
      discoveries.set(id, { adapterId: id, status: 'unknown', detail: 'Adapter sem discover(); disponibilidade não afirmada.', checkedAt: new Date().toISOString() });
      return;
    }
    try {
      const result = await Promise.race([
        adapter.discover({ configuration: configuration[id] ?? {}, machine }),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`descoberta de ${id} excedeu ${timeoutMs}ms`)), timeoutMs)),
      ]);
      discoveries.set(id, { adapterId: id, ...(result ?? { status: 'unknown' }) });
    } catch (error) {
      discoveries.set(id, { adapterId: id, status: 'missing', detail: `discover() falhou: ${error?.message ?? 'erro desconhecido'}`, checkedAt: new Date().toISOString() });
    }
  }));
  return { hub: createProviderHub({ registry, adapters, discoveries, machine, preferences }), discoveries };
}
