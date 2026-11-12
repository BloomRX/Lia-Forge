/**
 * Preflight compartilhado (F3).
 *
 * Responde, antes de qualquer execução, três perguntas que a interface precisa
 * mostrar com precisão:
 *
 *   1. o que esta máquina tem (ferramentas descobertas, memória, GPU medida);
 *   2. o que cada capacidade precisa e quem pode atendê-la;
 *   3. o que está bloqueado, o que é desconhecido e o que o usuário precisa
 *      decidir ou instalar **por conta própria**.
 *
 * Regras duras:
 * - nunca instala, baixa, compra nem contata serviço externo;
 * - `available` só com evidência de descoberta nesta execução;
 * - requisito não medido vira `unknown`, jamais `compatible`;
 * - cada bloqueio produz uma ação de usuário explícita e nomeada.
 */

import { evaluateCompatibility } from '../adapters/sdk.mjs';

export const PREFLIGHT_SCHEMA_VERSION = 1;

export const PREFLIGHT_STATUSES = Object.freeze(['ready', 'blocked', 'missing', 'unknown']);

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`preflight.${field}: must be a plain object`);
  return value;
}

/**
 * Monta o relatório de preflight a partir de descobertas já coletadas.
 *
 * @param {object} params
 * @param {object} params.registry Capability Registry (createCapabilityRegistry)
 * @param {Array<{manifest:object, discover?:Function}>} params.adapters
 * @param {object} params.machine medições reais da máquina (null = não medido)
 * @param {Map<string,object>|object} params.discoveries resultado de discover() por adapter
 * @param {Array<string>} [params.capabilityIds] restringe o relatório
 */
export function buildPreflightReport({ registry, adapters = [], machine = {}, discoveries = {}, capabilityIds = null, generatedAt = new Date().toISOString() }) {
  requireObject(registry ?? {}, 'registry');
  if (typeof registry?.list !== 'function') throw new TypeError('preflight.registry: expected a Capability Registry instance');
  const discoveryMap = discoveries instanceof Map ? discoveries : new Map(Object.entries(discoveries ?? {}));
  const wanted = Array.isArray(capabilityIds) && capabilityIds.length ? new Set(capabilityIds) : null;

  const tools = [];
  const byAdapter = new Map();
  for (const adapter of adapters) {
    const manifest = adapter.manifest ?? adapter;
    const discovery = discoveryMap.get(manifest.id) ?? null;
    const status = discovery?.status ?? 'unknown';
    const record = Object.freeze({
      adapterId: manifest.id,
      class: manifest.class,
      title: manifest.title,
      version: manifest.version,
      providers: manifest.providers,
      capabilities: manifest.capabilities,
      backends: manifest.backends,
      status,
      detectedVersion: discovery?.version ?? null,
      detail: discovery?.detail ?? 'Não verificado nesta execução.',
      executable: discovery?.executable ?? null,
      endpoint: discovery?.endpoint ?? null,
      checkedAt: discovery?.checkedAt ?? null,
      cost: manifest.cost,
      license: manifest.provenance?.license ?? null,
      evidenceState: manifest.evidence?.state ?? 'code-present',
      protectedActions: manifest.protectedActions,
      compatibility: evaluateCompatibility({ manifest, machine }),
    });
    tools.push(record);
    byAdapter.set(manifest.id, record);
  }

  const capabilities = [];
  const userActions = [];
  for (const capability of registry.list()) {
    if (wanted && !wanted.has(capability.id)) continue;
    const candidates = tools.filter((tool) => tool.capabilities.includes(capability.id));
    const ready = candidates.filter((tool) => tool.status === 'available' && tool.compatibility.compatible);
    const blocked = candidates.filter((tool) => tool.status === 'blocked');
    const missing = candidates.filter((tool) => tool.status === 'missing');

    let status;
    if (ready.length) status = 'ready';
    else if (blocked.length) status = 'blocked';
    else if (missing.length || candidates.length === 0) status = 'missing';
    else status = 'unknown';

    const blockers = [];
    for (const tool of candidates) {
      blockers.push(...tool.compatibility.blockers.map((item) => `${tool.adapterId}: ${item}`));
      if (tool.status === 'missing') blockers.push(`${tool.adapterId}: ferramenta não detectada nesta máquina`);
      if (tool.status === 'blocked') blockers.push(`${tool.adapterId}: ${tool.detail}`);
    }
    if (!candidates.length && capability.status === 'proposed') {
      blockers.push('capacidade proposta aguardando decisão humana (licença/escopo)');
    }
    if (!candidates.length && capability.status === 'planned') {
      blockers.push('capacidade planejada: ainda sem adapter no checkout');
    }

    const unknowns = [];
    for (const tool of candidates) unknowns.push(...tool.compatibility.unknowns.map((item) => `${tool.adapterId}: ${item}`));
    if (capability.requirements.vramMb === null) unknowns.push('VRAM exigido pela capacidade é desconhecido');
    if (!machine.gpu) unknowns.push('GPU desta máquina não foi verificada (nenhum probe foi executado)');

    if (status !== 'ready') {
      const action = buildUserAction(capability, candidates, status, blockers);
      if (action) userActions.push(action);
    }

    capabilities.push(Object.freeze({
      id: capability.id,
      family: capability.family,
      title: capability.title,
      registryStatus: capability.status,
      status,
      providers: Object.freeze(candidates.map((tool) => tool.adapterId)),
      readyProviders: Object.freeze(ready.map((tool) => tool.adapterId)),
      blockers: Object.freeze([...new Set(blockers)]),
      unknowns: Object.freeze([...new Set(unknowns)]),
      verified: status === 'ready' && unknowns.length === 0,
    }));
  }

  const summary = {
    capabilities: capabilities.length,
    ready: capabilities.filter((item) => item.status === 'ready').length,
    blocked: capabilities.filter((item) => item.status === 'blocked').length,
    missing: capabilities.filter((item) => item.status === 'missing').length,
    unknown: capabilities.filter((item) => item.status === 'unknown').length,
    toolsAvailable: tools.filter((tool) => tool.status === 'available').length,
    toolsMissing: tools.filter((tool) => tool.status === 'missing').length,
    toolsBlocked: tools.filter((tool) => tool.status === 'blocked').length,
  };

  return Object.freeze({
    schemaVersion: PREFLIGHT_SCHEMA_VERSION,
    generatedAt,
    machine: Object.freeze({ ...machine }),
    tools: Object.freeze(tools),
    capabilities: Object.freeze(capabilities),
    userActions: Object.freeze(userActions),
    summary: Object.freeze(summary),
    canStart: summary.ready > 0 && summary.blocked === 0,
    note: 'Nenhuma ferramenta foi instalada, baixada ou contatada por este relatório.',
  });
}

function buildUserAction(capability, candidates, status, blockers) {
  const tool = candidates[0];
  if (status === 'blocked' && tool) {
    return Object.freeze({
      kind: 'authorization',
      capabilityId: capability.id,
      title: `Autorizar ${tool.title}`,
      detail: tool.detail,
      requiresUserDecision: true,
      canBeAutomated: false,
    });
  }
  if (tool && tool.status === 'missing') {
    return Object.freeze({
      kind: 'install',
      capabilityId: capability.id,
      title: `Instalar ${tool.providers[0] ?? tool.title} por conta própria`,
      detail: `${blockers.join('; ') || 'Ferramenta não detectada.'} O Lia Forge não instala nem baixa ferramentas: a instalação é sempre sua.`,
      requiresUserDecision: true,
      canBeAutomated: false,
      provider: tool.providers[0] ?? null,
      adapterId: tool.adapterId,
    });
  }
  if (!candidates.length) {
    return Object.freeze({
      kind: 'decision',
      capabilityId: capability.id,
      title: `Decidir provider para "${capability.title}"`,
      detail: capability.status === 'proposed'
        ? 'Capacidade proposta: exige decisão humana de licença/escopo antes de existir adapter.'
        : 'Nenhum adapter atende esta capacidade ainda; ela aparece como planejada, nunca como disponível.',
      requiresUserDecision: true,
      canBeAutomated: false,
    });
  }
  return Object.freeze({
    kind: 'hardware',
    capabilityId: capability.id,
    title: `Verificar requisitos de "${capability.title}"`,
    detail: blockers.join('; ') || 'Requisitos não medidos nesta máquina.',
    requiresUserDecision: true,
    canBeAutomated: false,
  });
}

/**
 * Executa as descobertas (somente leitura) e monta o relatório.
 * `discover` de cada adapter é chamado com a configuração resolvida; falha de
 * descoberta vira status `missing` com a mensagem, nunca exceção propagada.
 */
export async function runPreflight({ registry, adapters = [], machine = {}, configuration = {}, capabilityIds = null, timeoutMs = 8000 }) {
  const discoveries = new Map();
  await Promise.all(adapters.map(async (adapter) => {
    const manifest = adapter.manifest ?? adapter;
    const discover = adapter.discover;
    if (typeof discover !== 'function') {
      discoveries.set(manifest.id, { adapterId: manifest.id, status: 'unknown', detail: 'Adapter sem discover(); não é possível afirmar disponibilidade.', checkedAt: new Date().toISOString() });
      return;
    }
    try {
      const result = await withTimeout(discover({ configuration: configuration[manifest.id] ?? {}, machine }), timeoutMs);
      discoveries.set(manifest.id, { adapterId: manifest.id, ...(result ?? { status: 'unknown' }) });
    } catch (error) {
      discoveries.set(manifest.id, {
        adapterId: manifest.id,
        status: 'missing',
        detail: `discover() falhou: ${error?.message ?? 'erro desconhecido'}`,
        checkedAt: new Date().toISOString(),
      });
    }
  }));
  return buildPreflightReport({ registry, adapters, machine, discoveries, capabilityIds });
}

function withTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`descoberta excedeu ${timeoutMs}ms`)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
