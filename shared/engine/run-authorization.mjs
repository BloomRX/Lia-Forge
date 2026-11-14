/**
 * Autorização por run — Lia Forge (P0-2 da revisão integrada).
 *
 * Estado antes deste módulo (medido, não inferido): o engine tinha gate de
 * autorização por fingerprint desde a fase F1–F3 (`checkAuthorization`), mas o
 * serviço chamava `manager.execute(plan, { context, authorization })` **sem
 * `scope`**, e o gate só roda `if (scope)`. Consequência: nenhum run do produto
 * registrava gate de autorização (`snapshot.gates` sem entrada `authorization`) e
 * o parâmetro `authorization` de `run()` nunca era verificado — a única coisa que
 * de fato liberava envio remoto era a flag persistente
 * `providers.comfyui.authorization.granted`.
 *
 * Este módulo é o lugar único onde:
 *   1. o escopo de um run é derivado do plano REAL (não de uma lista fixa);
 *   2. se decide se aquele escopo exige autorização de uma pessoa;
 *   3. a autorização recebida é validada e vinculada ao escopo por fingerprint.
 *
 * Regras:
 *   - Um run com ação protegida (`send_data`, `cost`, `install_software`,
 *     `download_models_or_weights`) exige autorização explícita. Sem ela, nada
 *     executa (fail-closed) e o motivo nomeia as ações que faltam.
 *   - `granted: true` sozinho não autoriza nada: é preciso nomear as ações
 *     protegidas aceitas. Autorização genérica/global é recusada.
 *   - A autorização é vinculada ao fingerprint do escopo. Se o plano mudar
 *     (adapter, destino, entrada, ação protegida a mais), o fingerprint muda e a
 *     autorização deixa de valer — o run pede decisão de novo.
 *   - Um run sem ação protegida (tudo local, sem custo, sem envio, sem instalar)
 *     não exige confirmação humana; o registro gravado diz explicitamente que foi
 *     a política que o dispensou, com o motivo. Não é autorização implícita: é
 *     uma decisão escrita, auditável no run.json, que só vale para escopo sem
 *     ação protegida.
 *   - Superfície HTTP não concede autorização: o campo nem é encaminhado pela
 *     rota `/run`. Só o IPC (canal da decisão humana no desktop) entrega.
 */

import { authorizationFingerprint, PROTECTED_ACTIONS } from './gates.mjs';

export { PROTECTED_ACTIONS };

/** SHA-256 das entradas fornecidas para este run, em ordem estável. */
function inputFingerprints(context) {
  const entries = Object.entries(context?.inputs ?? {})
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([id, sha256]) => `${id}:${sha256}`)
    .sort();
  return entries.length ? entries : null;
}

/**
 * Escopo de autorização de um run, derivado do plano real.
 *
 * @param {object} plan plano devolvido por `planWorkflow`
 * @param {{destination?:string|null, inputs?:object, costCeiling?:number|null}} [extra]
 * @returns {Readonly<{workflowId:string|null, plan:string[], adapters:string[], capabilities:string[], destinations:string[], protectedActions:string[], backends:null, inputs:string[]|null, costCeiling:number|null}>}
 */
export function buildRunScope(plan, extra = {}) {
  const steps = plan?.steps ?? [];
  return Object.freeze({
    workflowId: plan?.id ?? null,
    plan: steps.map((step) => step.id),
    adapters: [...new Set(steps.map((step) => step.adapter).filter(Boolean))].sort(),
    capabilities: [...new Set(steps.map((step) => step.capability).filter(Boolean))].sort(),
    destinations: extra.destination ? [String(extra.destination)] : [],
    protectedActions: [...(plan?.protectedActions ?? [])].sort(),
    backends: null,
    inputs: inputFingerprints(extra),
    costCeiling: Number.isFinite(extra.costCeiling) ? extra.costCeiling : null,
  });
}

/**
 * Este escopo exige autorização de uma pessoa?
 *
 * Só ação protegida exige. Exigir confirmação para rodar o renderer 2D interno
 * seria ruído e acostumaria a pessoa a clicar sem ler — o que enfraquece o gate
 * que importa. Os outros gates continuam valendo (revisão humana passo a passo,
 * entrada, alvo de escrita).
 */
export function scopeRequiresAuthorization(scope) {
  return Array.isArray(scope?.protectedActions) && scope.protectedActions.length > 0;
}

/** Motivo escrito do registro produzido pela política (escopo sem ação protegida). */
export const NO_PROTECTED_ACTION_NOTE = 'Escopo sem ação protegida: nada é enviado, cobrado, instalado ou baixado. Qualquer plano que passe a conter ação protegida exige autorização de uma pessoa.';

/**
 * Autorização vinculada ao escopo.
 *
 * @param {object|null} authorization `{ granted, grantedBy, grantedAt, protectedActions, expiresAt?, fingerprint?, costCeiling? }`
 * @param {object} scope escopo deste run
 * @returns {object|null} `null` quando nenhuma autorização foi concedida
 */
export function bindAuthorizationToScope(authorization, scope) {
  if (!authorization || authorization.granted !== true) return null;
  const grantedActions = [...new Set(
    (Array.isArray(authorization.protectedActions) ? authorization.protectedActions : [])
      .filter((action) => PROTECTED_ACTIONS.includes(String(action)))
      .map(String),
  )].sort();
  return Object.freeze({
    granted: true,
    grantedBy: typeof authorization.grantedBy === 'string' ? authorization.grantedBy : null,
    grantedAt: authorization.grantedAt ?? null,
    expiresAt: authorization.expiresAt ?? null,
    scopeNote: typeof authorization.scope === 'string' ? authorization.scope : null,
    costCeiling: Number.isFinite(authorization.costCeiling) ? authorization.costCeiling : null,
    protectedActions: Object.freeze(grantedActions),
    fingerprint: authorization.fingerprint ?? authorizationFingerprint(scope),
  });
}

/**
 * Registro que a política produz para um escopo **sem** ação protegida.
 *
 * Não é autorização implícita nem global: só existe quando o plano real não contém
 * ação protegida, vem com o fingerprint desse escopo e com o motivo por escrito.
 * Se o plano passar a conter ação protegida, `scopeRequiresAuthorization` responde
 * true, este registro deixa de ser produzido e o run bloqueia.
 */
export function policyAuthorizationForScope(scope) {
  return Object.freeze({
    granted: true,
    grantedBy: 'policy:no-protected-action',
    grantedAt: null,
    expiresAt: null,
    scopeNote: NO_PROTECTED_ACTION_NOTE,
    costCeiling: null,
    protectedActions: Object.freeze([]),
    fingerprint: authorizationFingerprint(scope),
  });
}

/**
 * A autorização que vale para este escopo: a humana, quando exigida; a da
 * política, quando o escopo não tem ação protegida.
 */
export function authorizationForScope(scope, authorization) {
  if (scopeRequiresAuthorization(scope)) return bindAuthorizationToScope(authorization, scope);
  return policyAuthorizationForScope(scope);
}

/**
 * Ações protegidas do escopo que a autorização NÃO cobre (vazio = cobertura total).
 */
export function missingProtectedActions(scope, authorization) {
  const required = [...(scope?.protectedActions ?? [])].map(String).sort();
  if (!required.length) return [];
  const granted = new Set(authorization?.protectedActions ?? []);
  return required.filter((action) => !granted.has(action));
}

/**
 * Valida a autorização que chega pelo IPC (canal da decisão humana).
 *
 * Campo fora do formato devolve erro — não é ignorado em silêncio, porque
 * autorização ignorada em silêncio é autorização fingida.
 *
 * @param {object|null|undefined} raw `payload.authorization`
 * @returns {{authorization: object|null, costCeiling: number|null}}
 */
export function readRunAuthorization(raw) {
  if (raw === undefined || raw === null) return { authorization: null, costCeiling: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('authorization inválida: esperava objeto { granted, grantedBy, protectedActions }.');
  }
  if (raw.granted !== true) {
    throw new TypeError('authorization.granted precisa ser true para autorizar; para negar, não envie o campo.');
  }
  if (typeof raw.grantedBy !== 'string' || !raw.grantedBy.trim() || raw.grantedBy.length > 120) {
    throw new TypeError('authorization.grantedBy precisa dizer quem autorizou (texto de até 120 caracteres).');
  }
  const actions = raw.protectedActions;
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new TypeError(`authorization.protectedActions precisa listar as ações protegidas aceitas (ex.: ["cost","download_models_or_weights"]). Autorização genérica não é aceita; aceitas: ${PROTECTED_ACTIONS.join(', ')}.`);
  }
  const protectedActions = [...new Set(actions.map((action) => {
    if (typeof action !== 'string' || !PROTECTED_ACTIONS.includes(action)) {
      throw new TypeError(`authorization.protectedActions contém ação desconhecida: ${JSON.stringify(action)} (aceitas: ${PROTECTED_ACTIONS.join(', ')}).`);
    }
    return action;
  }))];
  if (raw.fingerprint !== undefined && raw.fingerprint !== null && !/^[0-9a-f]{64}$/i.test(String(raw.fingerprint))) {
    throw new TypeError('authorization.fingerprint, quando informado, precisa ser o SHA-256 do escopo apresentado à pessoa.');
  }
  if (raw.expiresAt !== undefined && raw.expiresAt !== null && Number.isNaN(Date.parse(String(raw.expiresAt)))) {
    throw new TypeError('authorization.expiresAt, quando informado, precisa ser uma data.');
  }
  let costCeiling = null;
  if (raw.costCeiling !== undefined && raw.costCeiling !== null) {
    costCeiling = Number(raw.costCeiling);
    if (!Number.isFinite(costCeiling) || costCeiling < 0) {
      throw new TypeError('authorization.costCeiling precisa ser um número não negativo.');
    }
  }
  return {
    authorization: Object.freeze({
      granted: true,
      grantedBy: raw.grantedBy.trim(),
      grantedAt: new Date().toISOString(),
      protectedActions: Object.freeze(protectedActions),
      fingerprint: raw.fingerprint ? String(raw.fingerprint).toLowerCase() : null,
      expiresAt: raw.expiresAt ? new Date(String(raw.expiresAt)).toISOString() : null,
      costCeiling,
      scope: typeof raw.scope === 'string' && raw.scope.length <= 500 ? raw.scope : null,
    }),
    costCeiling,
  };
}
