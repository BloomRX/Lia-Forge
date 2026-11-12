/**
 * Adapter de execução ComfyUI → conceito 2D (F2).
 *
 * Migração do adapter inline de `electron/main.cjs:89-104` para o Adapter SDK.
 * Preserva: endpoint loopback apenas (`isLoopbackEndpoint` no cliente),
 * checkpoint já instalado escolhido pelo usuário, cancelamento por signal,
 * progresso repassado ao runner, confinamento de caminhos ao projeto,
 * validação estrutural do PNG e `validateStageOutputs(..., 1, ..., {
 * allowSingleConcept: true })`.
 *
 * Novidade da F3: o PNG gerado também passa por validação de conteúdo —
 * uma imagem totalmente transparente ou de uma cor só deixa de ser aceita como
 * conceito válido (lacuna G8).
 *
 * O ComfyUI **remoto** é outro adapter (`comfyui-remote.mjs`), de classe
 * `remote-service`, porque envolve envio de dados e custo: nunca é misturado
 * com este caminho local.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { defineExecutionAdapter, adapterError, redactSecrets } from '../../shared/adapters/sdk.mjs';
import { validatePngStructure } from '../../shared/qa/png.mjs';
import { validatePngContent } from '../../shared/qa/png-codec.mjs';

export const ADAPTER_ID = 'comfyui-concept';

export const MANIFEST = Object.freeze({
  id: ADAPTER_ID,
  version: '1.1.0',
  title: 'ComfyUI → conceito 2D',
  description: 'Gera uma imagem de conceito por difusão em um servidor ComfyUI local (loopback), usando apenas checkpoints já instalados pelo usuário.',
  capabilities: ['image2d.generate-concept'],
  providers: ['comfyui'],
  requirements: {
    os: null,
    gpu: null,
    vramMb: 4096,
    ramMb: 8192,
    diskMb: null,
    runtime: 'ComfyUI em execução local com --listen 127.0.0.1',
    network: false,
    offlineCapable: true,
  },
  configuration: {
    endpoint: { kind: 'endpoint', required: false, description: 'URL do servidor local; apenas loopback é aceito.', env: 'COMFYUI_URL', default: 'http://127.0.0.1:8188' },
    checkpoint: { kind: 'choice', required: true, description: 'Checkpoint já instalado, listado por /object_info. Nenhum download é feito pela Forge.' },
    workflowId: { kind: 'choice', required: false, description: 'Workflow salvo do usuário (txt2img/img2img).' },
    prompt: { kind: 'text', required: true, description: 'Descrição da arte; enviada apenas ao servidor local.' },
  },
  inputContracts: [{ id: 'brief', formats: ['text'], validator: 'non-empty-text', required: true }],
  outputContracts: [{ id: 'concept', formats: ['png'], validator: 'png-content', required: true }],
  execution: ['http'],
  progress: true,
  cancel: true,
  errors: ['WORKFLOW_BLOCKED', 'WORKFLOW_CANCELLED', 'WORKFLOW_FAILED', 'ADAPTER_OUTPUT_INVALID', 'ADAPTER_UNAVAILABLE'],
  logs: { redacted: true, maxEntries: 1200 },
  provenance: {
    source: 'https://github.com/comfyanonymous/ComfyUI',
    tool: 'ComfyUI',
    version: null,
    sha256: null,
    license: 'GPL-3.0-only',
    licenseScope: 'Acesso por HTTP loopback como processo separado; a Forge não redistribui nem deriva do ComfyUI',
    weightsLicense: 'Depende do checkpoint escolhido pelo usuário (licenças variam e não são inferidas)',
    outputRights: 'Definidos pela licença do checkpoint usado; a Forge registra qual checkpoint gerou a imagem',
    note: 'Versão lida de /system_stats em discover(); sem afirmação sem evidência.',
  },
  cost: { status: 'not-applicable', note: 'Servidor local: nenhum custo de API. O custo é hardware do usuário.' },
  backends: [{ kind: 'local-http-loopback', validated: false, note: 'Validado por smoke tests com servidor simulado; sem ComfyUI real no ambiente de desenvolvimento.' }],
  health: { status: 'unknown', detail: 'Descoberto por GET /system_stats no endpoint loopback.' },
  evidence: {
    tests: ['tests/comfyui-client-smoke.mjs', 'tests/adapter-sdk-smoke.mjs'],
    validatedVersions: [],
    executedOn: null,
    state: 'code-present',
    note: 'Geração real permanece BLOCKED sem servidor ComfyUI instalado pelo usuário.',
  },
  protectedActions: ['install_software', 'download_models_or_weights', 'cost', 'send_data'],
});

export function createAdapter(dependencies = {}) {
  const {
    getWorkflowClient,
    assertPathInsideProject,
    validateStageOutputs,
    validateContent = true,
  } = dependencies;

  if (typeof getWorkflowClient !== 'function') {
    throw adapterError('ADAPTER_MISCONFIGURED', `O adapter ${ADAPTER_ID} precisa de getWorkflowClient injetado pelo processo principal.`);
  }
  if (typeof assertPathInsideProject !== 'function') {
    throw adapterError('ADAPTER_MISCONFIGURED', `O adapter ${ADAPTER_ID} precisa de assertPathInsideProject injetado pelo processo principal.`);
  }
  if (typeof validateStageOutputs !== 'function') {
    throw adapterError('ADAPTER_MISCONFIGURED', `O adapter ${ADAPTER_ID} precisa de validateStageOutputs injetado pelo processo principal.`);
  }

  return defineExecutionAdapter(MANIFEST, {
    async discover() {
      const checkedAt = new Date().toISOString();
      let client;
      try {
        client = await getWorkflowClient();
      } catch (error) {
        return { adapterId: ADAPTER_ID, status: 'missing', detail: redactSecrets(error.message ?? 'Cliente ComfyUI indisponível.'), checkedAt, version: null };
      }
      const endpoint = client.getComfyUiEndpoint();
      try {
        const status = await client.getComfyUiStatus();
        return {
          adapterId: ADAPTER_ID,
          status: status?.available ? 'available' : 'missing',
          detail: redactSecrets(status?.available ? `ComfyUI responde em ${endpoint}` : 'ComfyUI não respondeu no endpoint loopback.'),
          endpoint,
          version: status?.version ?? null,
          checkpoints: status?.checkpoints ?? null,
          checkedAt,
        };
      } catch (error) {
        return { adapterId: ADAPTER_ID, status: 'missing', detail: redactSecrets(error.message ?? 'ComfyUI inacessível.'), endpoint, checkedAt, version: null };
      }
    },

    async execute(context = {}) {
      const { asset, outputDirectory, projectRoot: runProjectRoot, prompt, checkpoint, workflowId, signal, reportProgress } = context;
      const client = await getWorkflowClient();
      const endpoint = client.getComfyUiEndpoint();
      const result = await client.runComfyUiConcept({ workflowId, prompt, checkpoint, outputDirectory, signal, onProgress: reportProgress });

      const outputs = [];
      const contents = [];
      for (const outputPath of result.outputs) {
        const realPath = await assertPathInsideProject(outputPath, { mustExist: true, label: 'Concept PNG do ComfyUI' });
        const bytes = await fs.readFile(realPath);
        validatePngStructure(bytes);
        if (validateContent) {
          try {
            contents.push(validatePngContent(bytes, { label: 'O conceito gerado pelo ComfyUI', minUniqueColors: 2 }));
          } catch (error) {
            throw adapterError('ADAPTER_OUTPUT_INVALID', error.message, { adapterId: ADAPTER_ID, path: path.basename(realPath) });
          }
        }
        outputs.push(path.relative(runProjectRoot, realPath).split(path.sep).join('/'));
      }
      validateStageOutputs(asset.type, 1, outputs, { allowSingleConcept: true });

      const coverage = contents.length ? contents.map((item) => item.coverage).reduce((a, b) => a + b, 0) / contents.length : null;
      return {
        outputs,
        promptId: result.promptId,
        checkpoint: result.checkpoint,
        content: contents.length ? { images: contents.length, meanCoverage: coverage } : undefined,
        execution: { kind: 'http', method: 'POST', host: new URL(endpoint).host, route: '/prompt', provider: 'ComfyUI', taskId: result.promptId },
        note: `ComfyUI gerou e validou ${outputs.length} imagem(ns) usando o checkpoint já instalado “${result.checkpoint}”. Revise a arte; ela não é um modelo 3D nem garante vistas ortográficas.`,
      };
    },
  });
}

export default createAdapter;
