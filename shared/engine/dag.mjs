/**
 * DAG de execução (F5 — requisito §8).
 *
 * Camada pura de grafo: valida dependências, detecta ciclos, ordena
 * topologicamente e calcula o conjunto pronto para execução com limite de
 * recursos. Não executa nada, não conhece adapters e não decide autorização —
 * quem executa é o Execution Manager.
 *
 * Substitui a regra anterior do runner ("dependsOn = aparecer antes na lista")
 * por um grafo real, que é o que permite paralelismo controlado e retomada
 * correta.
 */

export const STEP_STATES = Object.freeze([
  'pending',
  'ready',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'skipped',
  'blocked',
]);

const TERMINAL_STATES = Object.freeze(['succeeded', 'failed', 'cancelled', 'skipped', 'blocked']);
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export class DagError extends TypeError {
  constructor(message, details = {}) {
    super(message);
    this.name = 'DagError';
    this.code = 'PLAN_INVALID';
    this.details = Object.freeze({ ...details });
  }
}

function assertStep(step, index) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) throw new DagError(`steps[${index}]: passo inválido`);
  if (typeof step.id !== 'string' || !ID_PATTERN.test(step.id)) {
    throw new DagError(`steps[${index}].id: deve ser um id estável ([a-z0-9][a-z0-9._-]*)`, { index });
  }
  // Passo que o Orchestrador bloqueou (ferramenta ausente, licença, custo não
  // autorizado, entrada humana pendente) não tem adapter: nada pode executá-lo
  // ainda. O DAG aceita e o engine o mantém `blocked` com o motivo declarado —
  // transformar isso em erro de plano esconderia a razão real de quem usa.
  const blockedByPlan = typeof step.blockedReason === 'string' && step.blockedReason.trim().length > 0;
  if (!blockedByPlan && (typeof step.adapter !== 'string' || !step.adapter.trim())) {
    throw new DagError(`steps[${index}].adapter: adapter obrigatório (ou declare blockedReason)`, { id: step.id });
  }
  const dependsOn = step.dependsOn ?? [];
  if (!Array.isArray(dependsOn)) throw new DagError(`steps[${index}].dependsOn: deve ser uma lista`, { id: step.id });
  return { ...step, adapter: step.adapter ?? null, dependsOn: [...dependsOn] };
}

/**
 * Valida e normaliza um plano em DAG.
 * @returns {{steps:Array, order:Array<string>, levels:Array<Array<string>>, byId:Map}}
 */
export function buildDag(steps) {
  if (!Array.isArray(steps) || steps.length === 0) throw new DagError('plan: steps deve ser uma lista não vazia');
  const normalized = steps.map(assertStep);
  const byId = new Map();
  for (const [index, step] of normalized.entries()) {
    if (byId.has(step.id)) throw new DagError(`plan: id duplicado "${step.id}"`, { index });
    byId.set(step.id, step);
  }
  for (const step of normalized) {
    for (const dependency of step.dependsOn) {
      if (!byId.has(dependency)) {
        throw new DagError(`plan: "${step.id}" depende de "${dependency}", que não existe no plano`, { id: step.id, dependency });
      }
      if (dependency === step.id) throw new DagError(`plan: "${step.id}" depende de si mesmo`, { id: step.id });
    }
  }

  // Kahn: ordem topológica + níveis (passos do mesmo nível podem rodar juntos)
  const incoming = new Map(normalized.map((step) => [step.id, new Set(step.dependsOn)]));
  const outgoing = new Map(normalized.map((step) => [step.id, new Set()]));
  for (const step of normalized) {
    for (const dependency of step.dependsOn) outgoing.get(dependency).add(step.id);
  }
  const order = [];
  const levels = [];
  let frontier = normalized.filter((step) => incoming.get(step.id).size === 0).map((step) => step.id);
  while (frontier.length) {
    levels.push([...frontier].sort());
    order.push(...[...frontier].sort());
    const next = [];
    for (const id of frontier) {
      for (const dependent of outgoing.get(id)) {
        incoming.get(dependent).delete(id);
        if (incoming.get(dependent).size === 0) next.push(dependent);
      }
    }
    frontier = next;
  }
  if (order.length !== normalized.length) {
    const stuck = normalized.filter((step) => !order.includes(step.id)).map((step) => step.id);
    throw new DagError(`plan: ciclo de dependências entre ${stuck.join(', ')}`, { cycle: stuck });
  }

  return Object.freeze({
    steps: Object.freeze(normalized),
    order: Object.freeze(order),
    levels: Object.freeze(levels.map((level) => Object.freeze(level))),
    byId,
    depth: levels.length,
  });
}

/** Passos cujas dependências já terminaram com sucesso (ou foram puladas). */
export function readySteps(dag, states) {
  const ready = [];
  for (const step of dag.steps) {
    if (states[step.id] && states[step.id] !== 'pending' && states[step.id] !== 'ready') continue;
    const satisfied = step.dependsOn.every((dependency) => {
      const state = states[dependency];
      return state === 'succeeded' || state === 'skipped';
    });
    if (satisfied) ready.push(step.id);
  }
  return Object.freeze(ready);
}

/** Um passo falhou/bloqueou: quais descendentes precisam ser marcados. */
export function dependentsOf(dag, stepId) {
  const seen = new Set();
  const queue = [stepId];
  while (queue.length) {
    const current = queue.shift();
    for (const step of dag.steps) {
      if (step.dependsOn.includes(current) && !seen.has(step.id)) {
        seen.add(step.id);
        queue.push(step.id);
      }
    }
  }
  return Object.freeze([...seen]);
}

/**
 * Escala o próximo lote respeitando limites de recursos.
 * `usage` descreve o que está em uso agora; `limits` o teto permitido.
 * Recursos considerados: slots de execução, RAM e VRAM declaradas pelo passo.
 */
export function scheduleBatch({ dag, states, usage = {}, limits = {}, candidates = null }) {
  const maxConcurrent = limits.maxConcurrent ?? 1;
  const running = Object.entries(states).filter(([, state]) => state === 'running').map(([id]) => id);
  const availableSlots = Math.max(0, maxConcurrent - running.length);
  if (availableSlots === 0) return Object.freeze({ batch: [], reason: 'limit-concurrent', running });

  const pool = (candidates ?? readySteps(dag, states))
    .map((id) => dag.byId.get(id))
    .filter(Boolean)
    // ordem topológica como desempate: nunca inverte dependências
    .sort((a, b) => dag.order.indexOf(a.id) - dag.order.indexOf(b.id));

  const batch = [];
  let ram = usage.ramMb ?? 0;
  let vram = usage.vramMb ?? 0;
  const deferred = [];
  for (const step of pool) {
    if (batch.length >= availableSlots) {
      deferred.push({ id: step.id, reason: 'limit-concurrent' });
      continue;
    }
    const needsRam = step.resources?.ramMb ?? 0;
    const needsVram = step.resources?.vramMb ?? 0;
    if (limits.ramMb !== undefined && ram + needsRam > limits.ramMb) {
      deferred.push({ id: step.id, reason: 'limit-ram' });
      continue;
    }
    if (limits.vramMb !== undefined && vram + needsVram > limits.vramMb) {
      deferred.push({ id: step.id, reason: 'limit-vram' });
      continue;
    }
    ram += needsRam;
    vram += needsVram;
    batch.push(step.id);
  }
  return Object.freeze({ batch: Object.freeze(batch), deferred: Object.freeze(deferred), running: Object.freeze(running) });
}

/** Resumo do estado do grafo para interface e relatórios. */
export function summarizeDag(dag, states) {
  const counts = {};
  for (const state of STEP_STATES) counts[state] = 0;
  for (const step of dag.steps) counts[states[step.id] ?? 'pending'] += 1;
  const done = counts.succeeded + counts.skipped;
  return Object.freeze({
    total: dag.steps.length,
    depth: dag.depth,
    counts: Object.freeze(counts),
    progress: dag.steps.length === 0 ? 0 : Math.round((done / dag.steps.length) * 100),
    finished: dag.steps.every((step) => TERMINAL_STATES.includes(states[step.id])),
    failed: Object.freeze(dag.steps.filter((step) => states[step.id] === 'failed').map((step) => step.id)),
    blocked: Object.freeze(dag.steps.filter((step) => states[step.id] === 'blocked').map((step) => step.id)),
  });
}

export { TERMINAL_STATES };
