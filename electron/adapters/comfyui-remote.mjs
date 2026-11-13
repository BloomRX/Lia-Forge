/**
 * Adapter de serviço remoto ComfyUI (F2 / requisito §9).
 *
 * Classe `remote-service`: existe envio de dados para fora da máquina e, em
 * geral, custo. Por isso:
 * - o custo é declarado como `unknown` (nenhum preço foi verificado);
 * - `execute` recusa sem uma autorização explícita do usuário gravada no run
 *   (`send_data` e `cost` são ações protegidas);
 * - `reconcile` é obrigatório e compara o que foi enviado com o que voltou,
 *   registrando proveniência para auditoria;
 * - nenhum segredo é aceito no manifesto: credenciais viriam do cofre do
 *   usuário e são redigidas em qualquer log/evento.
 *
 * Este adapter é arquitetura implementada e testável; a ponta remota real
 * permanece pendente de decisão humana (T12 D10: backend remoto e teto de
 * custo). Enquanto não houver autorização, o estado reportado é `blocked`,
 * nunca `available`.
 */

import { defineRemoteServiceAdapter, adapterError, redactSecrets, PROTECTED_ACTIONS } from '../../shared/adapters/sdk.mjs';
import { validatePngStructure } from '../../shared/qa/png.mjs';

export const ADAPTER_ID = 'comfyui-remote';

export const MANIFEST = Object.freeze({
  id: ADAPTER_ID,
  version: '0.1.0',
  title: 'ComfyUI remoto (worker/hosted)',
  description: 'Envia um prompt a um ComfyUI fora da máquina (worker próprio, GPU alugada ou serviço hospedado) e reconcilia os artefatos recebidos. Exige autorização explícita de envio e de custo.',
  capabilities: ['image2d.generate-concept'],
  providers: ['comfyui-remote-worker', 'comfyui-hosted'],
  requirements: {
    os: null,
    gpu: null,
    vramMb: null,
    ramMb: 1024,
    diskMb: 512,
    runtime: 'Endpoint HTTPS compatível com a API do ComfyUI (/prompt, /history, /view)',
    network: true,
    offlineCapable: false,
  },
  configuration: {
    endpoint: { kind: 'endpoint', required: true, description: 'URL HTTPS do worker remoto. Loopback é recusado aqui: use o adapter local.' },
    credentialRef: { kind: 'text', required: false, secret: true, description: 'Referência a uma credencial no cofre do usuário. O valor nunca é gravado em log nem no manifesto.' },
    checkpoint: { kind: 'choice', required: true, description: 'Checkpoint disponível no worker; nada é baixado pela Forge.' },
    maxCostUnits: { kind: 'number', required: false, description: 'Teto de custo autorizado pelo usuário para este run.' },
  },
  inputContracts: [{ id: 'brief', formats: ['text'], validator: 'non-empty-text', required: true }],
  outputContracts: [{ id: 'concept', formats: ['png'], validator: 'png-content', required: true }],
  execution: ['http'],
  progress: true,
  cancel: true,
  errors: ['ADAPTER_SEND_UNAUTHORIZED', 'ADAPTER_COST_UNAUTHORIZED', 'ADAPTER_UNAVAILABLE', 'ADAPTER_OUTPUT_INVALID', 'WORKFLOW_CANCELLED', 'WORKFLOW_FAILED'],
  logs: { redacted: true, maxEntries: 1200 },
  provenance: {
    source: null,
    tool: 'ComfyUI (remoto)',
    version: null,
    sha256: null,
    license: 'UNKNOWN',
    licenseScope: 'Termos do provedor remoto precisam ser lidos e aceitos pelo usuário; a Forge não os infere',
    weightsLicense: 'UNKNOWN',
    outputRights: 'UNKNOWN até o usuário registrar os termos do provedor e do checkpoint',
    note: 'Nenhum provedor remoto foi aprovado. Estado: arquitetura implementada, execução bloqueada.',
  },
  cost: { status: 'unknown', unit: null, note: 'Nenhum preço foi verificado nesta base de código; o usuário precisa informar o teto autorizado.' },
  backends: [
    { kind: 'remote-worker', validated: false, note: 'Worker próprio: arquitetura implementada, sem alvo validado.' },
    { kind: 'hosted-service', validated: false, note: 'Serviço hospedado: exige termos, custo e decisão humana.' },
    { kind: 'rented-gpu', validated: false, note: 'GPU alugada: custo por hora medido por terceiro.' },
  ],
  health: { status: 'blocked', detail: 'Backend remoto não autorizado; nenhum endpoint foi contatado.' },
  evidence: {
    tests: ['tests/adapter-sdk-smoke.mjs', 'tests/orchestrator-engine-smoke.mjs', 'tests/studio-service-smoke.mjs'],
    validatedVersions: [],
    executedOn: null,
    state: 'code-present',
    note: 'Os testes executam só os caminhos de recusa (sem autorização → ADAPTER_SEND_UNAUTHORIZED, endpoint loopback → blocked) e a reconciliação; o hub nunca o escolhe implicitamente. Nenhuma chamada real a serviço remoto foi feita, e nenhuma deve ser feita sem autorização humana.',
  },
  protectedActions: [...PROTECTED_ACTIONS],
});

function isLoopback(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host.endsWith('.localhost');
}

/**
 * @param {object} dependencies
 * @param {Function} dependencies.transport função que fala com o endpoint
 *   remoto; injetada para permitir teste sem rede. Assinatura:
 *   `({ endpoint, prompt, checkpoint, workflowId, signal, onProgress }) =>
 *    { outputs: Array<{path:string, sha256?:string}>, promptId, usage? }`
 * @param {Function} dependencies.requireAuthorization devolve o registro de
 *   autorização do run ou lança quando ela não existe.
 */
export function createAdapter(dependencies = {}) {
  const { transport, requireAuthorization, validateContent = true } = dependencies;
  if (typeof transport !== 'function') {
    throw adapterError('ADAPTER_MISCONFIGURED', `O adapter ${ADAPTER_ID} precisa de um transport injetado (nunca faz rede por conta própria em teste).`);
  }
  if (typeof requireAuthorization !== 'function') {
    throw adapterError('ADAPTER_MISCONFIGURED', `O adapter ${ADAPTER_ID} precisa de requireAuthorization injetado pelo processo principal.`);
  }

  return defineRemoteServiceAdapter(MANIFEST, {
    async discover({ configuration = {} } = {}) {
      const checkedAt = new Date().toISOString();
      const endpoint = configuration.endpoint ?? null;
      if (!endpoint) {
        return { adapterId: ADAPTER_ID, status: 'blocked', detail: 'Nenhum endpoint remoto configurado; backend remoto não autorizado.', checkedAt, version: null };
      }
      let parsed;
      try {
        parsed = new URL(endpoint);
      } catch {
        return { adapterId: ADAPTER_ID, status: 'blocked', detail: 'Endpoint remoto inválido.', checkedAt, version: null };
      }
      if (isLoopback(parsed.hostname)) {
        return { adapterId: ADAPTER_ID, status: 'blocked', detail: 'Endpoint loopback pertence ao adapter local comfyui-concept; o adapter remoto recusa loopback.', checkedAt, version: null };
      }
      if (parsed.protocol !== 'https:') {
        return { adapterId: ADAPTER_ID, status: 'blocked', detail: 'Somente HTTPS é aceito para envio de dados a um worker remoto.', checkedAt, version: null };
      }
      return {
        adapterId: ADAPTER_ID,
        status: 'blocked',
        detail: 'Endpoint configurado, mas o envio exige autorização explícita do usuário. Nenhum contato foi feito.',
        endpoint: parsed.origin,
        checkedAt,
        version: null,
      };
    },

    async execute(context = {}) {
      const { configuration = {}, prompt, checkpoint, workflowId, signal, outputDirectory, projectRoot } = context;
      const authorization = await requireAuthorization({
        adapterId: ADAPTER_ID,
        actions: ['send_data', 'cost'],
        endpoint: configuration.endpoint ?? null,
        maxCostUnits: configuration.maxCostUnits ?? null,
      });
      if (!authorization?.granted) {
        throw adapterError('ADAPTER_SEND_UNAUTHORIZED', 'O envio de dados a um serviço remoto exige autorização explícita do usuário. Nada foi enviado.', {
          adapterId: ADAPTER_ID,
          endpoint: configuration.endpoint ?? null,
        });
      }
      if (authorization.costApproved !== true && authorization.costAcknowledged !== true) {
        throw adapterError('ADAPTER_COST_UNAUTHORIZED', 'O custo do backend remoto precisa ser aprovado pelo usuário antes do envio. Nada foi enviado.', {
          adapterId: ADAPTER_ID,
        });
      }
      if (signal?.aborted) {
        throw adapterError('WORKFLOW_CANCELLED', 'Execução remota cancelada antes do envio.', { adapterId: ADAPTER_ID });
      }

      const result = await transport({
        endpoint: configuration.endpoint,
        credentialRef: configuration.credentialRef ?? null,
        prompt,
        checkpoint,
        workflowId,
        outputDirectory,
        projectRoot,
        signal,
        authorization,
        onProgress: context.reportProgress,
      });

      const outputs = [];
      for (const output of result.outputs ?? []) {
        if (output?.bytes) validatePngStructure(output.bytes);
        if (output?.path) outputs.push(String(output.path));
      }
      if (!outputs.length) {
        throw adapterError('ADAPTER_OUTPUT_INVALID', 'O serviço remoto não devolveu nenhum artefato utilizável.', { adapterId: ADAPTER_ID });
      }

      return {
        outputs,
        promptId: result.promptId ?? null,
        checkpoint,
        authorization: { id: authorization.id ?? null, grantedAt: authorization.grantedAt ?? null, scope: authorization.scope ?? null },
        cost: { status: 'unknown', unit: result.usage?.unit ?? null, reported: result.usage?.value ?? null, ceiling: configuration.maxCostUnits ?? null },
        execution: { kind: 'http', method: 'POST', host: new URL(configuration.endpoint).host, route: '/prompt', provider: 'ComfyUI remoto', taskId: result.promptId ?? null, redacted: true },
        note: 'Artefato vindo de backend remoto: proveniência, termos e custo precisam constar do registro antes da aprovação.',
        needsReconcile: true,
      };
    },

    async reconcile({ runRecord, executionResult }) {
      const sent = executionResult?.sent ?? null;
      const received = executionResult?.outputs ?? [];
      const problems = [];
      if (!runRecord?.authorization?.granted) problems.push('run sem autorização de envio registrada');
      if (received.length === 0) problems.push('nenhum artefato recebido do serviço remoto');
      if (validateContent) {
        for (const item of received) {
          if (item && item.bytes) {
            try {
              validatePngStructure(item.bytes);
            } catch (error) {
              problems.push(`artefato inválido: ${redactSecrets(error.message)}`);
            }
          }
        }
      }
      return Object.freeze({
        adapterId: ADAPTER_ID,
        reconciled: problems.length === 0,
        sent: sent ? { promptHash: sent.promptHash ?? null, checkpoint: sent.checkpoint ?? null, endpointHost: sent.endpointHost ?? null } : null,
        received: received.map((item) => ({ path: item?.path ?? null, sha256: item?.sha256 ?? null })),
        cost: executionResult?.cost ?? { status: 'unknown' },
        problems: Object.freeze(problems),
      });
    },
  });
}

export default createAdapter;
