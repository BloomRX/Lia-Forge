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
    // A ferramenta respondeu, mas esta máquina não atende a um requisito
    // MEDIDO (ex.: RAM total abaixo do declarado): não é "ausente" (ela existe)
    // nem "pronta" (não cabe aqui).
    if (discoveryState === 'available' && compatibility.blocked) state = 'blocked';
    // Respondeu e nada foi medido contra: pronta para executar. Requisitos que
    // não puderam ser medidos (VRAM sem probe de GPU autorizado, por exemplo)
    // viram aviso — nunca veto, e nunca afirmação de hardware validado.
    else if (discoveryState === 'available') state = 'ready';
    else if (discoveryState === 'blocked' || compatibility.blocked) state = compatibility.blocked ? 'missing' : 'blocked';
    else if (discoveryState === 'missing') state = 'missing';
    else state = 'unknown';
    // O motivo precisa chegar inteiro à interface: dizer "ComfyUI responde" e
    // marcar como indisponível, sem explicar o bloqueio, induz o usuário a erro.
    const rawDetail = discovery?.detail ?? 'Não verificado nesta execução.';
    const blockers = compatibility.blockers ?? [];
    const unknowns = state === 'ready' ? (compatibility.unknowns ?? []) : [];
    const detail = [
      rawDetail,
      blockers.length ? `${discoveryState === 'available' ? 'Bloqueio nesta máquina:' : 'Além disso:'} ${blockers.join('; ')}.` : null,
      unknowns.length ? `Aviso (não medido nesta máquina): ${unknowns.join('; ')}.` : null,
    ].filter(Boolean).join(' ');
    return { state, discovery, compatibility, detail };
  }

  /**
   * Um adapter declara `canHandle(context)` quando a capacidade é compartilhada
   * por passos de naturezas diferentes (ex.: `render.atlas` empacota tanto frames
   * do renderizador 2D interno quanto renders 3D do Blender). O Hub consulta esse
   * critério com o contexto do passo e marca o candidato como não aplicável, com
   * o motivo — em vez de escolhê-lo por ordem alfabética e deixar o passo bloquear
   * por falta de uma entrada que ele nunca teria.
   *
   * Sem contexto, ou sem o hook, o candidato continua aplicável como antes: nada
   * aqui muda o comportamento de quem não declarou critério.
   */
  function applicabilityOf(adapter, capabilityId, context) {
    if (!context || typeof adapter.canHandle !== 'function') return { applicable: true, reason: null };
    try {
      const verdict = adapter.canHandle({ capabilityId, ...context });
      if (verdict === true || verdict === null || verdict === undefined) return { applicable: true, reason: null };
      if (verdict === false) return { applicable: false, reason: 'O adapter não se aplica a este passo.' };
      if (typeof verdict === 'object') {
        return {
          applicable: verdict.ok !== false && verdict.applicable !== false,
          reason: verdict.reason ?? verdict.detail ?? null,
        };
      }
      return { applicable: true, reason: null };
    } catch (error) {
      // Falha ao avaliar não vira disponibilidade: o candidato sai da escolha e o
      // motivo aparece no plano (erro de programação visível, não silêncio).
      return { applicable: false, reason: `Falha ao avaliar se o adapter serve a este passo: ${String(error?.message ?? error).slice(0, 200)}` };
    }
  }

  function candidatesFor(capabilityId, context = null) {
    const capability = registry.get(capabilityId);
    const candidates = adapters
      .filter((adapter) => adapter.manifest.capabilities.includes(capabilityId))
      .map((adapter) => {
        const { state, discovery, compatibility, detail } = stateOf(adapter);
        const { applicable, reason: applicabilityReason } = applicabilityOf(adapter, capabilityId, context);
        return Object.freeze({
          adapterId: adapter.manifest.id,
          adapterVersion: adapter.manifest.version,
          class: adapter.manifest.class,
          title: adapter.manifest.title,
          providers: adapter.manifest.providers,
          state,
          discoveryDetail: detail,
          detectedVersion: discovery?.version ?? null,
          executable: discovery?.executable ?? null,
          executableSource: discovery?.executableSource ?? null,
          versionConfirmed: discovery?.versionConfirmed === true,
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
          applicable,
          applicabilityReason,
          limitations: [
            ...(adapter.manifest.evidence?.note ? [adapter.manifest.evidence.note] : []),
            ...(applicable ? [] : [applicabilityReason ?? 'Não se aplica a este passo.']),
          ],
        });
      })
      .sort((a, b) => {
        // Quem não serve a este passo vai para o fim: continua visível no plano
        // (com o motivo), mas nunca é escolhido na frente de quem serve.
        if (a.applicable !== b.applicable) return a.applicable ? -1 : 1;
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
    select(capabilityId, { allowUnknown = false, allowRemote = false, context = null } = {}) {
      const candidates = candidatesFor(capabilityId, context);
      const usable = candidates.find((candidate) => {
        if (!candidate.applicable) return false;
        if (candidate.state === 'ready') return candidate.class === 'remote-service' ? allowRemote : true;
        if (candidate.state === 'unknown' && allowUnknown) return candidate.class === 'remote-service' ? allowRemote : true;
        return false;
      });
      if (usable) return Object.freeze({ selected: usable, reason: null, candidates });
      const inapplicable = candidates.filter((candidate) => !candidate.applicable);
      const reason = !candidates.length
        ? `Nenhum adapter declara a capacidade "${capabilityId}".`
        : `Nenhum candidato utilizável para "${capabilityId}": ${candidates
          .map((candidate) => `${candidate.adapterId}=${candidate.state}${candidate.applicable ? '' : ' (não se aplica a este passo)'}${candidate.compatibility?.blockers?.length ? ` (${candidate.compatibility.blockers.join('; ')})` : ''}`)
          .join(', ')}.${inapplicable.length ? ` Não se aplicam a este passo: ${inapplicable.map((candidate) => `${candidate.adapterId} — ${candidate.applicabilityReason ?? 'sem motivo informado'}`).join('; ')}.` : ''}`;
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
