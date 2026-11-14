/**
 * Gates de segurança compartilhados (F5 — requisito §8).
 *
 * Mesmo conjunto de gates que o runner serial já aplica, agora como módulo
 * único para que o Execution Manager, o Orchestrator e os adapters usem a
 * mesma definição (sem sistemas paralelos e sem enfraquecer nada):
 *
 *   1. autorização por fingerprint        → `authorization-scope-changed`
 *   2. revisão humana com SHA-256         → `review-invalidated`
 *   3. detecção de entrada alterada       → `input-changed`
 *   4. redação de segredos em log/evento  → `redactSecrets`
 *   5. ações protegidas (filhos)          → `PROTECTED_ACTIONS`
 *   6. escrita atômica anti-symlink       → `assertSafeWriteTarget`
 *
 * Tudo é puro e falha fechado: na dúvida, bloqueia e explica.
 */

import { createHash } from 'node:crypto';

import { resolveContainedPath } from '../fs/path-containment.mjs';

export const GATE_SCHEMA_VERSION = 1;

export const GATE_CODES = Object.freeze([
  'authorization-scope-changed',
  'authorization-missing',
  'review-invalidated',
  'review-missing',
  'input-changed',
  'input-missing',
  'protected-action',
  'unsafe-write-target',
  'resume-invalidated',
]);

export const PROTECTED_ACTIONS = Object.freeze([
  'send_data',
  'cost',
  'install_software',
  'download_models_or_weights',
]);

const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey|token|secret|password|passwd|authorization|bearer|credential)\s*[:=]\s*\S+/gi,
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\bghp_[A-Za-z0-9]{8,}\b/g,
  /\bhf_[A-Za-z0-9]{8,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]+\b/g,
  /([?&](?:key|token|apikey|api_key|access_token|sig|signature)=)([^&#\s]{6,})/gi,
];

/** Redação de segredos: idêntica em log, evento de UI, erro e relatório. */
export function redactSecrets(text, replacement = '[REDACTED]') {
  if (text === null || text === undefined) return '';
  if (typeof text !== 'string') {
    try {
      return redactSecrets(JSON.stringify(text), replacement);
    } catch {
      return String(text);
    }
  }
  let output = text;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    output = output.replace(pattern, (match, prefix) => {
      // `prefix` só é string quando o padrão tem grupo de captura; caso
      // contrário o segundo argumento é o offset numérico da ocorrência.
      if (typeof prefix === 'string') return `${prefix}${replacement}`;
      const separator = match.search(/[:=]/);
      return separator === -1 ? replacement : `${match.slice(0, separator + 1)}${replacement}`;
    });
  }
  return output;
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Fingerprint do escopo autorizado: plano + ferramentas + destinos + ações
 * protegidas + orçamento. Qualquer mudança invalida a autorização anterior.
 */
export function authorizationFingerprint(scope) {
  const canonical = JSON.stringify({
    plan: scope?.plan ?? null,
    adapters: scope?.adapters ?? null,
    capabilities: scope?.capabilities ?? null,
    destinations: scope?.destinations ?? null,
    protectedActions: [...(scope?.protectedActions ?? [])].sort(),
    backends: scope?.backends ?? null,
    costCeiling: scope?.costCeiling ?? null,
    inputs: scope?.inputs ?? null,
  });
  return sha256Hex(Buffer.from(canonical, 'utf8'));
}

/**
 * Gate 1 — autorização.
 * @returns {{ok:boolean, code?:string, reason?:string, fingerprint:string}}
 */
export function checkAuthorization({ scope, authorization }) {
  const fingerprint = authorizationFingerprint(scope);
  if (!authorization || authorization.granted !== true) {
    return { ok: false, code: 'authorization-missing', reason: 'Nenhuma autorização concedida para este escopo.', fingerprint };
  }
  if (!authorization.fingerprint) {
    return { ok: false, code: 'authorization-missing', reason: 'Autorização sem fingerprint do escopo.', fingerprint };
  }
  if (authorization.fingerprint !== fingerprint) {
    return {
      ok: false,
      code: 'authorization-scope-changed',
      reason: 'O escopo mudou depois da autorização (plano, ferramentas, destinos, ações protegidas ou teto de custo).',
      fingerprint,
      authorizedFingerprint: authorization.fingerprint,
    };
  }
  if (authorization.expiresAt && Date.parse(authorization.expiresAt) < Date.now()) {
    return { ok: false, code: 'authorization-scope-changed', reason: 'Autorização expirada.', fingerprint };
  }
  return { ok: true, fingerprint };
}

/**
 * Gate 2 — revisão humana.
 * A revisão é registrada sobre o SHA-256 do artefato; se o byte mudar, a
 * revisão deixa de valer (não existe "aprovação herdada").
 */
export function checkReview({ artifactBytes, artifactSha256 = null, review }) {
  const actual = artifactBytes ? sha256Hex(artifactBytes) : artifactSha256;
  if (!actual) return { ok: false, code: 'input-missing', reason: 'Artefato sem hash para conferência de revisão.' };
  if (!review || review.approved !== true) {
    return { ok: false, code: 'review-missing', reason: 'Artefato ainda não revisado por uma pessoa.', sha256: actual };
  }
  if (review.sha256 !== actual) {
    return {
      ok: false,
      code: 'review-invalidated',
      reason: 'O artefato mudou depois da revisão; aprove novamente o conteúdo atual.',
      sha256: actual,
      reviewedSha256: review.sha256,
    };
  }
  return { ok: true, sha256: actual, reviewedBy: review.reviewer ?? null, reviewedAt: review.reviewedAt ?? null };
}

/**
 * Gate 3 — entrada alterada.
 * Compara o hash registrado no checkpoint com o hash atual da entrada.
 */
export function checkInputs({ inputs = [], recorded = {} }) {
  const problems = [];
  const current = {};
  for (const input of inputs) {
    if (!input?.id) {
      problems.push({ code: 'input-missing', reason: 'Entrada sem id.' });
      continue;
    }
    if (!input.sha256 && !input.bytes) {
      problems.push({ code: 'input-missing', reason: `Entrada "${input.id}" sem hash nem conteúdo.`, id: input.id });
      continue;
    }
    const digest = input.sha256 ?? sha256Hex(input.bytes);
    current[input.id] = digest;
    const previous = recorded[input.id];
    if (previous && previous !== digest) {
      problems.push({
        code: 'input-changed',
        reason: `Entrada "${input.id}" mudou depois do registro (esperado ${previous.slice(0, 12)}…, atual ${digest.slice(0, 12)}…).`,
        id: input.id,
        expected: previous,
        actual: digest,
      });
    }
  }
  return { ok: problems.length === 0, problems: Object.freeze(problems), inputs: Object.freeze(current) };
}

/**
 * Gate 5 — ações protegidas.
 * Um passo só pode disparar uma ação protegida se a autorização do run cobrir
 * explicitamente aquela ação. Sem cobertura: bloqueia e nomeia a ação.
 */
export function checkProtectedAction({ action, authorization, step = null }) {
  if (!PROTECTED_ACTIONS.includes(action)) return { ok: true, action };
  const granted = authorization?.protectedActions ?? [];
  if (!granted.includes(action)) {
    return {
      ok: false,
      code: 'protected-action',
      action,
      reason: `A ação protegida "${action}" exige autorização explícita do usuário${step ? ` no passo "${step}"` : ''}. Nada foi executado.`,
      requiresUserDecision: true,
      canBeAutomated: false,
    };
  }
  return { ok: true, action };
}

/**
 * Gate 6 — escrita segura.
 * Recusa caminhos fora da raiz do projeto e qualquer alvo que seja symlink
 * (ou cujo pai ainda não exista e precise ser criado fora da raiz).
 * `resolve`/`lstat` são injetados para manter o módulo testável sem disco.
 *
 * A decisão de contenção vem de `shared/fs/path-containment.mjs` (auditoria P0,
 * item 2): comparação por **caminho relativo**, não por `startsWith` — que deixava
 * passar uma pasta irmã cujo nome começa com o nome da raiz — e resolução do
 * **caminho real** subindo até o ancestral existente mais próximo, o que pega o
 * symlink num pai de um alvo que ainda não foi criado. O contrato de retorno
 * (`ok`/`code`/`reason`/`target`) e as mensagens são os de antes.
 */
export async function assertSafeWriteTarget({ root, target, resolve, lstat, realpath = null }) {
  const contained = await resolveContainedPath({
    root,
    target,
    resolve,
    lstat,
    realpath,
    label: 'Alvo',
  });
  if (contained.code === 'unsafe-path') {
    return { ok: false, code: 'unsafe-write-target', reason: contained.reason, target: String(target ?? '') };
  }
  if (contained.code === 'outside-root') {
    return { ok: false, code: 'unsafe-write-target', reason: `Alvo "${target}" está fora da raiz do projeto.`, target: contained.target };
  }
  if (contained.isSymlink) {
    return { ok: false, code: 'unsafe-write-target', reason: `Alvo "${target}" é um symlink; escrita recusada.`, target: contained.target };
  }
  if (!contained.ok) {
    return { ok: false, code: 'unsafe-write-target', reason: `Alvo "${target}" aponta para fora da raiz do projeto.`, target: contained.real ?? contained.target };
  }
  return { ok: true, target: contained.target };
}

/**
 * Gate de retomada: um checkpoint só pode ser reutilizado se o plano, as
 * entradas e o adapter forem os mesmos. Qualquer diferença invalida a retomada
 * e o passo volta a executar.
 */
export function checkResume({ checkpoint, step, inputs = {}, adapterVersion = null, planFingerprint = null }) {
  if (!checkpoint) return { ok: false, code: 'resume-invalidated', reason: 'Sem checkpoint para retomar.' };
  if (checkpoint.stepId !== step.id) return { ok: false, code: 'resume-invalidated', reason: 'Checkpoint pertence a outro passo.' };
  if (checkpoint.adapter && step.adapter && checkpoint.adapter !== step.adapter) {
    return { ok: false, code: 'resume-invalidated', reason: `Adapter mudou de "${checkpoint.adapter}" para "${step.adapter}".` };
  }
  if (adapterVersion && checkpoint.adapterVersion && checkpoint.adapterVersion !== adapterVersion) {
    return { ok: false, code: 'resume-invalidated', reason: `Versão do adapter mudou (${checkpoint.adapterVersion} → ${adapterVersion}).` };
  }
  if (planFingerprint && checkpoint.planFingerprint && checkpoint.planFingerprint !== planFingerprint) {
    return { ok: false, code: 'resume-invalidated', reason: 'O plano mudou depois do checkpoint.' };
  }
  const inputCheck = checkInputs({ inputs, recorded: checkpoint.inputs ?? {} });
  if (!inputCheck.ok) {
    return { ok: false, code: 'resume-invalidated', reason: inputCheck.problems.map((item) => item.reason).join(' '), problems: inputCheck.problems };
  }
  return { ok: true, reason: 'step-reused', checkpoint };
}

/**
 * Registra o resultado de um gate no histórico do run (auditável).
 * `run` pode ser o run inteiro ou qualquer objeto com `gates`; o retorno é um
 * objeto novo com o histórico atualizado (nunca muta o original).
 */
export function recordGate(run, gate, result, at = new Date().toISOString()) {
  const entry = Object.freeze({
    gate,
    ok: result.ok === true,
    code: result.code ?? null,
    reason: redactSecrets(result.reason ?? ''),
    at,
  });
  const history = [...(run?.gates ?? []), entry];
  return Object.freeze({ ...(run ?? {}), gates: Object.freeze(history.slice(-500)), lastGate: entry });
}
