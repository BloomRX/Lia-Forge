/**
 * Execution Manager (F5 — requisito §8).
 *
 * Executa um plano em DAG com estados, checkpoints, retomada, retry, timeout,
 * cancelamento, logs redigidos, progresso, custo e proveniência. Não planeja
 * (quem planeja é o Orchestrator) e não executa ferramenta nenhuma diretamente
 * (quem executa é o adapter resolvido pelo Hub).
 *
 * Gates preservados e aplicados por `shared/engine/gates.mjs`:
 * autorização por fingerprint, revisão com SHA-256, detecção de entrada
 * alterada, redação de segredos, ações protegidas e escrita segura.
 *
 * Paralelismo só acontece com controle explícito de recursos: o padrão é
 * serial (`maxConcurrent: 1`), exatamente como o runner atual.
 */

import { buildDag, dependentsOf, readySteps, scheduleBatch, summarizeDag } from './dag.mjs';
import {
  authorizationFingerprint,
  checkAuthorization,
  checkInputs,
  checkProtectedAction,
  checkResume,
  checkReview,
  redactSecrets,
  recordGate,
  sha256Hex,
} from './gates.mjs';

export const EXECUTION_SCHEMA_VERSION = 1;

export const RUN_STATES = Object.freeze(['planned', 'running', 'succeeded', 'failed', 'cancelled', 'blocked', 'paused']);

const MAX_LOG_ENTRIES = 1200;
const DEFAULT_STEP_TIMEOUT_MS = 30 * 60 * 1000;

function newRunId(prefix = 'run') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class ExecutionManager {
  /**
   * @param {object} options
   * @param {(adapterId:string)=>{execute:Function, manifest?:object}|Promise<...>} options.resolveAdapter
   * @param {(run:object)=>Promise<void>} [options.persist] grava o snapshot do run
   * @param {(event:object)=>void} [options.onEvent] eventos para UI/log
   * @param {() => Date} [options.now]
   * @param {(bytes:Uint8Array)=>string} [options.hash]
   * @param {{maxConcurrent?:number, ramMb?:number, vramMb?:number}} [options.limits]
   */
  constructor({ resolveAdapter, persist = async () => {}, onEvent = () => {}, now = () => new Date(), hash = sha256Hex, limits = {} } = {}) {
    if (typeof resolveAdapter !== 'function') throw new TypeError('ExecutionManager: resolveAdapter é obrigatório');
    this.resolveAdapter = resolveAdapter;
    this.persist = persist;
    this.onEvent = onEvent;
    this.now = now;
    this.hash = hash;
    this.limits = { maxConcurrent: 1, ...limits };
  }

  emit(run, event) {
    const payload = Object.freeze({
      runId: run.runId,
      at: this.now().toISOString(),
      ...event,
      message: event.message ? redactSecrets(event.message) : undefined,
    });
    run.events.push(payload);
    if (run.events.length > MAX_LOG_ENTRIES) run.events.splice(0, run.events.length - MAX_LOG_ENTRIES);
    this.onEvent(payload);
    return payload;
  }

  log(run, level, message, details = {}) {
    const entry = Object.freeze({ at: this.now().toISOString(), level, message: redactSecrets(message), details: Object.freeze({ ...details }) });
    run.logs.push(entry);
    if (run.logs.length > MAX_LOG_ENTRIES) run.logs.splice(0, run.logs.length - MAX_LOG_ENTRIES);
    return entry;
  }

  /** Cria o registro inicial de um run a partir de um plano. */
  createRun({ plan, scope = null, authorization = null, checkpoints = null, runId = null, inputs = {} }) {
    const dag = buildDag(plan.steps ?? plan);
    const fingerprint = authorizationFingerprint(scope ?? { plan: dag.order, adapters: [...new Set(dag.steps.map((step) => step.adapter))].sort() });
    const run = {
      schemaVersion: EXECUTION_SCHEMA_VERSION,
      runId: runId ?? newRunId(),
      planId: plan.id ?? null,
      planTitle: plan.title ?? null,
      planFingerprint: fingerprint,
      status: 'planned',
      scope: scope ? Object.freeze({ ...scope, fingerprint }) : null,
      authorization: authorization ? Object.freeze({ ...authorization }) : null,
      createdAt: this.now().toISOString(),
      startedAt: null,
      finishedAt: null,
      steps: dag.steps.map((step) => ({
        id: step.id,
        title: step.title ?? step.id,
        adapter: step.adapter,
        state: 'pending',
        attempts: 0,
        startedAt: null,
        finishedAt: null,
        outputs: [],
        sha256: null,
        cost: null,
        error: null,
        review: null,
        reused: false,
        dependsOn: [...step.dependsOn],
        reviewRequired: step.reviewRequired === true,
        resources: step.resources ?? null,
      })),
      inputs: Object.freeze({ ...inputs }),
      events: [],
      logs: [],
      gates: [],
      cost: { status: 'unknown', entries: [], total: null, currency: null },
      provenance: [],
      dag,
    };
    if (checkpoints) run.checkpoints = checkpoints;
    return run;
  }

  snapshot(run) {
    const summary = summarizeDag(run.dag, Object.fromEntries(run.steps.map((step) => [step.id, step.state])));
    return Object.freeze({
      schemaVersion: EXECUTION_SCHEMA_VERSION,
      runId: run.runId,
      planId: run.planId,
      planTitle: run.planTitle,
      planFingerprint: run.planFingerprint,
      status: run.status,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      steps: Object.freeze(run.steps.map((step) => Object.freeze({ ...step, outputs: Object.freeze([...step.outputs]) }))),
      inputs: run.inputs,
      events: Object.freeze([...run.events]),
      logs: Object.freeze([...run.logs]),
      gates: Object.freeze([...run.gates]),
      cost: Object.freeze({ ...run.cost, entries: Object.freeze([...run.cost.entries]) }),
      provenance: Object.freeze([...run.provenance]),
      summary,
    });
  }

  /**
   * Executa o plano.
   * `context` recebe o que os adapters precisam (projeto, saída, signal…) e é
   * enriquecido por passo com `inputsById`, `outputDirectory` e `emit`.
   */
  async execute(plan, { scope = null, authorization = null, checkpoints = null, context = {}, signal = null, run = null, resume = false, runId = null } = {}) {
    const current = run ?? this.createRun({ plan, scope, authorization, checkpoints, runId, inputs: context.inputs ?? {} });
    const dag = current.dag;
    const states = () => Object.fromEntries(current.steps.map((step) => [step.id, step.state]));

    // Gate de autorização: sem ela, nada executa.
    if (scope) {
      const gate = checkAuthorization({ scope: { ...scope, plan: dag.order }, authorization });
      current.gates = recordGate({ gates: current.gates }, 'authorization', gate).gates;
      if (!gate.ok) {
        current.status = 'blocked';
        this.emit(current, { type: 'run-blocked', code: gate.code, message: gate.reason });
        for (const step of current.steps) step.state = 'blocked';
        await this.persist(this.snapshot(current));
        return this.snapshot(current);
      }
      current.authorization = { ...(authorization ?? {}), fingerprint: gate.fingerprint, granted: true };
    }

    // Retomada: reutiliza só o que passa no gate de checkpoint.
    if (resume && checkpoints) {
      for (const stepRecord of current.steps) {
        const step = dag.byId.get(stepRecord.id);
        const checkpoint = checkpoints[stepRecord.id];
        if (!checkpoint) continue;
        const gate = checkResume({
          checkpoint,
          step,
          // current.inputs é o mapa id → sha256 registrado; checkInputs espera
          // descritores, então a conversão acontece aqui (uma só vez).
          inputs: Object.entries(current.inputs ?? {}).map(([id, sha256]) => ({ id, sha256 })),
          adapterVersion: checkpoint.adapterVersion ?? null,
          planFingerprint: current.planFingerprint,
        });
        if (gate.ok) {
          stepRecord.state = 'succeeded';
          stepRecord.reused = true;
          stepRecord.outputs = [...(checkpoint.outputs ?? [])];
          stepRecord.sha256 = checkpoint.sha256 ?? null;
          stepRecord.finishedAt = checkpoint.finishedAt ?? this.now().toISOString();
          this.emit(current, { type: 'step-reused', stepId: stepRecord.id, message: `Passo "${stepRecord.id}" reaproveitado do checkpoint.` });
        } else {
          this.emit(current, { type: 'resume-invalidated', stepId: stepRecord.id, code: gate.code, message: gate.reason });
          this.log(current, 'warn', `Checkpoint do passo "${stepRecord.id}" não pode ser reutilizado: ${gate.reason}`);
        }
      }
    }

    current.status = 'running';
    current.startedAt = current.startedAt ?? this.now().toISOString();
    this.emit(current, { type: 'run-started', planId: current.planId, steps: dag.steps.length, resume });

    const running = new Map();

    const finishRun = async (status) => {
      current.status = status;
      current.finishedAt = this.now().toISOString();
      this.emit(current, { type: 'run-finished', status, summary: summarizeDag(dag, states()) });
      await this.persist(this.snapshot(current));
      return this.snapshot(current);
    };

    const runStep = async (stepRecord) => {
      const step = dag.byId.get(stepRecord.id);
      stepRecord.state = 'running';
      stepRecord.attempts += 1;
      stepRecord.startedAt = this.now().toISOString();
      this.emit(current, { type: 'step-started', stepId: step.id, adapter: step.adapter, attempt: stepRecord.attempts });

      // Gate de entrada alterada (quando o plano declara entradas com hash)
      if (Array.isArray(step.inputs) && step.inputs.length) {
        const gate = checkInputs({ inputs: step.inputs, recorded: current.inputs });
        if (!gate.ok) {
          stepRecord.state = 'failed';
          stepRecord.error = { code: gate.problems[0].code, message: gate.problems[0].reason };
          this.emit(current, { type: 'step-failed', stepId: step.id, code: gate.problems[0].code, message: gate.problems[0].reason });
          return;
        }
        Object.assign(current.inputs, gate.inputs);
      }

      // Ações protegidas declaradas pelo passo exigem cobertura na autorização
      for (const action of step.protectedActions ?? []) {
        const gate = checkProtectedAction({ action, authorization: current.authorization, step: step.id });
        if (!gate.ok) {
          stepRecord.state = 'blocked';
          stepRecord.error = { code: gate.code, message: gate.reason, requiresUserDecision: true };
          this.emit(current, { type: 'step-blocked', stepId: step.id, code: gate.code, message: gate.reason });
          return;
        }
      }

      const maxAttempts = step.retry?.maxAttempts ?? 1;
      const timeoutMs = step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
      let lastError = null;

      for (let attempt = stepRecord.attempts; attempt <= Math.max(maxAttempts, stepRecord.attempts); attempt += 1) {
        if (attempt > stepRecord.attempts) {
          stepRecord.attempts = attempt;
          this.emit(current, { type: 'step-retry', stepId: step.id, attempt, message: `Nova tentativa do passo "${step.id}".` });
        }
        const stepController = new AbortController();
        const onAbort = () => stepController.abort();
        if (signal) {
          if (signal.aborted) stepController.abort();
          else signal.addEventListener('abort', onAbort, { once: true });
        }
        const timer = setTimeout(() => stepController.abort(new Error('timeout')), timeoutMs);
        try {
          const adapter = await this.resolveAdapter(step.adapter);
          if (!adapter || typeof adapter.execute !== 'function') throw new Error(`adapter "${step.adapter}" não expõe execute`);
          const inputsById = Object.fromEntries(step.dependsOn.map((id) => {
            const previous = current.steps.find((item) => item.id === id);
            return [id, { outputs: previous?.outputs ?? [], sha256: previous?.sha256 ?? null }];
          }));
          // Artefatos de todo o run até aqui (não só das dependências diretas):
          // na retomada um passo pode precisar de algo produzido por um
          // antepassado que não é seu pai no DAG.
          const runOutputs = Object.fromEntries(current.steps
            .filter((item) => item.outputs?.length)
            .map((item) => [item.id, { outputs: item.outputs, sha256: item.sha256 ?? null }]));
          const result = await adapter.execute({
            ...context,
            stepId: step.id,
            adapter: step.adapter,
            params: step.params ?? {},
            inputsById,
            runOutputs,
            signal: stepController.signal,
            reportProgress: (event) => this.emit(current, { type: 'step-progress', stepId: step.id, ...event }),
          });
          clearTimeout(timer);
          if (signal) signal.removeEventListener('abort', onAbort);
          if (stepController.signal.aborted) throw Object.assign(new Error('Passo cancelado.'), { code: 'WORKFLOW_CANCELLED' });

          const outputs = [...(result?.outputs ?? [])];
          stepRecord.outputs = outputs;
          stepRecord.sha256 = result?.sha256 ?? (result?.artifactBytes ? this.hash(result.artifactBytes) : null);
          // Sem hash declarado pelo adapter, o hospedeiro calcula o do primeiro
          // artefato gravado: é o que ancora o gate de revisão (SHA-256).
          if (!stepRecord.sha256 && outputs.length && typeof context.hashArtifact === 'function') {
            stepRecord.sha256 = (await context.hashArtifact(outputs[0])) ?? null;
          }
          stepRecord.cost = result?.cost ?? null;
          stepRecord.note = result?.note ?? null;
          stepRecord.metrics = result?.metrics ?? null;
          stepRecord.execution = result?.execution ?? null;
          stepRecord.state = 'succeeded';
          stepRecord.finishedAt = this.now().toISOString();
          if (result?.cost) {
            current.cost.entries.push({ stepId: step.id, ...result.cost });
            current.cost.status = current.cost.entries.some((entry) => entry.status === 'known') ? 'known' : 'unknown';
          }
          current.provenance.push({
            stepId: step.id,
            adapter: step.adapter,
            adapterVersion: adapter.manifest?.version ?? null,
            outputs,
            sha256: stepRecord.sha256,
            at: stepRecord.finishedAt,
            license: adapter.manifest?.provenance?.license ?? null,
            outputRights: adapter.manifest?.provenance?.outputRights ?? null,
          });
          this.emit(current, { type: 'step-succeeded', stepId: step.id, outputs, message: result?.note ?? `Passo "${step.id}" concluído.` });

          // Gate de revisão: passo que exige aprovação humana não segue adiante
          if (stepRecord.reviewRequired) {
            const review = context.reviews?.[step.id] ?? null;
            const gate = checkReview({ artifactSha256: stepRecord.sha256, review });
            current.gates = recordGate({ gates: current.gates }, 'review', gate).gates;
            if (!gate.ok) {
              stepRecord.state = 'blocked';
              stepRecord.review = { status: gate.code, reason: gate.reason };
              this.emit(current, { type: 'step-review-required', stepId: step.id, code: gate.code, message: gate.reason });
              return;
            }
            stepRecord.review = { status: 'approved', sha256: gate.sha256, reviewedBy: gate.reviewedBy, reviewedAt: gate.reviewedAt };
          }
          return;
        } catch (error) {
          clearTimeout(timer);
          if (signal) signal.removeEventListener('abort', onAbort);
          lastError = error;
          const cancelled = error?.code === 'WORKFLOW_CANCELLED' || stepController.signal.aborted || signal?.aborted;
          if (cancelled) break;
          this.log(current, 'error', `Passo "${step.id}" falhou na tentativa ${attempt}: ${error?.message ?? error}`, { code: error?.code ?? null });
          if (attempt < maxAttempts && step.retry?.backoffMs) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(step.retry.backoffMs * attempt, 30000)));
            if (signal?.aborted) break;
            continue;
          }
          break;
        }
      }

      const cancelled = signal?.aborted || lastError?.code === 'WORKFLOW_CANCELLED';
      // Passo opcional que falha não derruba o run: vira skip com o motivo.
      const optional = step.optional === true;
      stepRecord.state = cancelled ? 'cancelled' : optional ? 'skipped' : 'failed';
      stepRecord.finishedAt = this.now().toISOString();
      stepRecord.error = {
        code: lastError?.code ?? (cancelled ? 'WORKFLOW_CANCELLED' : 'WORKFLOW_FAILED'),
        message: redactSecrets(lastError?.message ?? 'Passo cancelado.'),
      };
      this.emit(current, {
        type: cancelled ? 'step-cancelled' : stepRecord.state === 'skipped' ? 'step-skipped' : 'step-failed',
        stepId: step.id,
        code: stepRecord.error.code,
        optional: optional && !cancelled,
        message: optional && !cancelled
          ? `Passo opcional "${step.id}" não concluído (${stepRecord.error.message}). O run continua.`
          : stepRecord.error.message,
      });
    };

    // Loop de escalonamento com limite de recursos.
    while (true) {
      if (signal?.aborted) {
        for (const stepRecord of current.steps) {
          if (!['succeeded', 'failed', 'cancelled', 'skipped', 'blocked'].includes(stepRecord.state)) stepRecord.state = 'cancelled';
        }
        return finishRun('cancelled');
      }
      const blocked = current.steps.some((step) => step.state === 'blocked');
      if (blocked && readySteps(dag, states()).length === 0 && running.size === 0) return finishRun('blocked');

      const { batch } = scheduleBatch({ dag, states: states(), limits: this.limits });
      for (const stepId of batch) {
        const stepRecord = current.steps.find((item) => item.id === stepId);
        const promise = runStep(stepRecord).then(() => {
          running.delete(stepId);
          // dependentes de um passo que falhou/cancelou/bloqueou são pulados
          if (stepRecord.state !== 'succeeded' && stepRecord.state !== 'skipped') {
            for (const dependentId of dependentsOf(dag, stepId)) {
              const dependent = current.steps.find((item) => item.id === dependentId);
              if (dependent && dependent.state === 'pending') {
                dependent.state = 'skipped';
                this.emit(current, { type: 'step-skipped', stepId: dependentId, message: `"${dependentId}" pulado porque "${stepId}" terminou em ${stepRecord.state}.` });
              }
            }
          }
        });
        running.set(stepId, promise);
        if (this.limits.maxConcurrent <= 1) await promise;
      }
      if (this.limits.maxConcurrent > 1 && running.size) {
        await Promise.race([...running.values()]);
        continue;
      }
      if (!running.size && readySteps(dag, states()).length === 0) break;
      if (!running.size && batch.length === 0) break;
    }

    if (running.size) await Promise.all([...running.values()]);

    const summary = summarizeDag(dag, states());
    if (summary.counts.failed > 0) return finishRun('failed');
    if (summary.counts.blocked > 0) return finishRun('blocked');
    if (summary.counts.cancelled > 0) return finishRun('cancelled');
    if (summary.counts.succeeded + summary.counts.skipped === summary.total) return finishRun('succeeded');
    return finishRun('paused');
  }

  /** Cancelamento cooperativo: devolve o controller para o chamador abortar. */
  createCancellation() {
    const controller = new AbortController();
    return {
      signal: controller.signal,
      cancel: (reason = 'cancelado pelo usuário') => {
        controller.abort(new Error(redactSecrets(reason)));
        return true;
      },
    };
  }
}

export { readySteps, summarizeDag };
