/**
 * Serviço de integração do Studio (F8 — requisito §11).
 *
 * Uma única fachada usada pelos dois hospedeiros reais do produto:
 *   - Electron (`electron/main.cjs`, via IPC) — aplicação desktop;
 *   - Vite (`vite.config.js`, via API HTTP same-origin) — navegador/preview.
 *
 * Isso evita dois sistemas paralelos: as mesmas funções de capability, hub,
 * preflight, planejamento, execução, assets e exportação servem os dois.
 *
 * Regras preservadas: nenhum download/instalação/compra/envio; escritas
 * confinadas a `<projectRoot>/.lia-forge/` com arquivo temporário + rename e
 * recusa de symlink; segredos redigidos; nada é afirmado sem evidência.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { createCapabilityRegistry } from '../capabilities/registry.mjs';
import { createAdapterRegistry } from '../../electron/adapters/index.mjs';
import { discoverHub } from '../hub/provider-hub.mjs';
import { runPreflight } from '../qa/preflight.mjs';
import { listWorkflows, planWorkflow, WORKFLOW_IDS } from '../orchestrator/planner.mjs';
import { ExecutionManager } from '../engine/execution-manager.mjs';
import { isResumableRunState } from '../engine/run-states.mjs';
import { assertSafeWriteTarget, checkAuthorization, redactSecrets, sha256Hex } from '../engine/gates.mjs';
import {
  authorizationForScope,
  buildRunScope,
  missingProtectedActions,
  scopeRequiresAuthorization,
} from '../engine/run-authorization.mjs';

// Reexportado para os consumidores existentes (testes, UI) não precisarem saber
// onde a política mora; a implementação é uma só, em run-authorization.mjs.
export {
  authorizationForScope,
  bindAuthorizationToScope,
  buildRunScope,
  missingProtectedActions,
  policyAuthorizationForScope,
  scopeRequiresAuthorization,
} from '../engine/run-authorization.mjs';
import { createAssetManager, classifyRights } from '../assets/manager.mjs';
import { decodePng, encodePngRgba, analyzePngContent } from '../qa/png-codec.mjs';
import { validatePngStructure } from '../qa/png.mjs';
import { inspectGlb } from '../model3d/glb.mjs';
import { validateStepOutputs } from '../qa/validators.mjs';
import { createHostDefaults } from '../integrations/host-defaults.mjs';
import { createProviderStore, isLoopbackEndpoint } from '../integrations/provider-store.mjs';
import { inspectProjectStructure } from '../integrations/project-structure.mjs';
import { adapterError } from '../adapters/sdk.mjs';
import { generateVfxAtlas } from '../vfx/core.mjs';
import { buildExportBundle, checkDestinationCompatibility, listDestinations } from '../destinations/profiles.mjs';

export const STUDIO_SERVICE_SCHEMA_VERSION = 1;
const RUNS_DIRECTORY = '.lia-forge/runs';
/** Pasta das entradas fornecidas pelo usuário (imagens de referência, modelos). */
const INPUT_DIRECTORY = 'input';
const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_INPUT_ENTRIES = 400;
const MAX_INPUT_DEPTH = 3;
const INPUT_IMAGE_EXTENSIONS = Object.freeze(['png', 'jpg', 'jpeg', 'webp']);
const INPUT_MODEL_EXTENSIONS = Object.freeze(['glb', 'gltf', 'fbx', 'obj', 'stl', 'blend']);
const INPUT_OTHER_EXTENSIONS = Object.freeze(['md', 'json', 'txt']);
const INPUT_EXTENSIONS = Object.freeze([...INPUT_IMAGE_EXTENSIONS, ...INPUT_MODEL_EXTENSIONS, ...INPUT_OTHER_EXTENSIONS]);

/**
 * Nome de arquivo vindo do usuário vira nome de arquivo dentro de `input/`:
 * sem caminho, sem `..`, sem caracteres que dependam de shell ou de sistema de
 * arquivos específico. Colisão nunca sobrescreve o original — ganha sufixo.
 */
function sanitizeInputName(value) {
  const base = path.basename(String(value ?? '').replace(/\\/g, '/')).trim();
  if (!base || base === '.' || base === '..') return null;
  const cleaned = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+/, '')
    .replace(/\.{2,}/g, '.')
    .slice(0, 120);
  if (!cleaned || cleaned.startsWith('.')) return null;
  return cleaned;
}

function extensionOf(name) {
  const match = /\.([A-Za-z0-9]+)$/.exec(String(name ?? ''));
  return match ? match[1].toLowerCase() : '';
}
const MAX_PREVIEW_BYTES = 6 * 1024 * 1024;

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {object} options
 * @param {string} options.projectRoot raiz do projeto (escrita confinada aqui)
 * @param {Function} [options.findExternalTool] descoberta de ferramentas
 * @param {object} [options.taskRegistry] registro de processos filhos
 * @param {Function} [options.getWorkflowClient] cliente ComfyUI (Electron)
 * @param {Function} [options.validateStageOutputs] validação de estágio legada
 * @param {{maxConcurrent?:number, ramMb?:number}} [options.limits]
 */
/**
 * `validated` derivado de evidência, não declarado (P0-4).
 *
 * Só é `true` quando o passo concluiu, tem ao menos um validador **aprovado**,
 * nenhum reprovado, e a validação rodou sobre estes bytes — o que é conferido
 * comparando o SHA-256 que o engine gravou para o passo com o do arquivo. Um
 * passo com várias saídas tem um hash gravado (o do artefato principal): para as
 * demais saídas não há como afirmar que a validação as cobriu, e o registro diz
 * isso em vez de marcar `true`.
 *
 * @param {{step:object|null, sha256:string, emittedCount:number}} args
 * @returns {{validated:boolean, validator:string|null, contentMetrics:object|null, validation:object}}
 */
export function deriveArtifactValidation({ step, sha256, emittedCount = 1 }) {
  const validations = step?.validations ?? [];
  const passed = validations.filter((item) => item.status === 'passed');
  const failed = validations.filter((item) => item.status === 'failed');
  const skipped = validations.filter((item) => item.status === 'skipped');
  const validators = validations.map((item) => `${item.validator}=${item.status}`);
  const at = step?.finishedAt ?? null;
  const evidence = (status, reason) => Object.freeze({
    validated: false,
    validator: null,
    contentMetrics: null,
    validation: Object.freeze({
      status,
      reason,
      validators: Object.freeze(validators),
      sha256: sha256 ?? null,
      stepId: step?.id ?? null,
      stepState: step?.state ?? null,
      at,
    }),
  });

  if (!step || step.state !== 'succeeded') {
    return evidence('step-not-succeeded', `O passo ${step ? `"${step.id}" está "${step.state}"` : 'não existe no run'}; nenhuma validação aprovada pode ser atribuída a este arquivo.`);
  }
  if (failed.length > 0) {
    return evidence('validation-failed', `Validação reprovada: ${(failed[0].problems ?? []).join('; ') || failed[0].validator}.`);
  }
  if (passed.length === 0) {
    return evidence('not-validated', skipped.length > 0
      ? `Validadores pulados por falta de entrada: ${skipped.map((item) => `${item.validator} (${item.reason ?? 'sem entrada'})`).join('; ')}.`
      : 'O passo não declara validador: nada foi conferido sobre este arquivo.');
  }
  if (!step.sha256 || step.sha256 !== sha256) {
    return evidence('hash-diverged', emittedCount > 1
      ? 'O passo gravou um único SHA-256 (o do artefato principal) para várias saídas: não há como afirmar que a validação aprovada cobriu este arquivo.'
      : `A validação aprovada não corresponde a estes bytes (passo gravou ${String(step.sha256).slice(0, 12)}…, arquivo é ${String(sha256).slice(0, 12)}…).`);
  }
  return Object.freeze({
    validated: true,
    validator: passed.map((item) => item.validator).join(','),
    contentMetrics: passed.find((item) => item.metrics)?.metrics ?? null,
    validation: Object.freeze({
      status: 'validated',
      reason: `Validado por ${passed.map((item) => item.validator).join(', ')} sobre o SHA-256 gravado pelo passo.`,
      validators: Object.freeze(validators),
      sha256,
      stepId: step.id,
      stepState: step.state,
      at,
    }),
  });
}

export function createStudioService(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const limits = { maxConcurrent: 1, ...(options.limits ?? {}) };
  const registry = createCapabilityRegistry();

  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

  // As integrações reais do repositório (Blender, ComfyUI, descoberta de
  // ferramentas, validação de estágio, registro de processos) são o padrão em
  // qualquer hospedeiro — não só no Electron. Quem injetar dependências próprias
  // continua tendo precedência.
  const host = options.hostDefaults ?? createHostDefaults();

  const adapterDependencies = {
    findExternalTool: options.findExternalTool ?? host.findExternalTool ?? (() => null),
    taskRegistry: options.taskRegistry ?? host.taskRegistry ?? { start: () => { throw new Error('Task registry indisponível neste hospedeiro.'); } },
    assertPathInsideProject: options.assertPathInsideProject ?? (async (candidate) => {
      const resolved = path.resolve(candidate);
      const gate = await assertSafeWriteTarget({
        root: projectRoot,
        target: resolved,
        resolve: async (value) => path.resolve(value),
        lstat: async (value) => fs.lstat(value),
        realpath: async (value) => fs.realpath(value),
      });
      if (!gate.ok) throw new Error(gate.reason);
      return resolved;
    }),
    buildBlenderSpritesheetArgs: options.buildBlenderSpritesheetArgs ?? host.buildBlenderSpritesheetArgs ?? (() => { throw new Error('buildBlenderSpritesheetArgs indisponível neste hospedeiro.'); }),
    runProcess: options.runProcess ?? host.runProcess ?? (async () => { throw new Error('runProcess indisponível neste hospedeiro.'); }),
    validateSpritesheetFiles: options.validateSpritesheetFiles ?? host.validateSpritesheetFiles ?? (() => { throw new Error('validateSpritesheetFiles indisponível neste hospedeiro.'); }),
    validateStageOutputs: options.validateStageOutputs ?? host.validateStageOutputs ?? (() => {}),
    getWorkflowClient: options.getWorkflowClient ?? (() => workflowClient()),
    hash,
    configuration: options.configuration ?? {},
  };

  // ------------------------------------------------------------- providers
  // Escolha real de backend (§9): local, remoto (autorizado) ou desativado.
  // A configuração vive no projeto, é gravada de forma atômica e nunca contém
  // segredo; o registro de adapters é reconstruído quando ela muda.
  const providerStore = options.providerStore ?? createProviderStore({ projectRoot });
  let adaptersInstance = null;
  let adaptersKey = null;
  let providerCache = null;

  function configurationFor(providers) {
    return {
      'blender-spritesheet': {
        executable: providers.blender.mode === 'path' ? providers.blender.executable : null,
        script: providers.blender.scriptPath ?? host.blenderScriptPath,
        frameSize: providers.blender.frameSize,
        validateContent: true,
      },
      'comfyui-concept': {
        endpoint: providers.comfyui.mode === 'local-loopback' ? providers.comfyui.endpoint : null,
        checkpoint: providers.comfyui.checkpoint,
        workflowId: providers.comfyui.workflowId,
      },
    };
  }

  async function providersNow() {
    return providerStore.read();
  }

  async function currentAdapters() {
    const config = await providersNow();
    const key = JSON.stringify(config.providers);
    if (!adaptersInstance || key !== adaptersKey) {
      adaptersKey = key;
      providerCache = config.providers;
      adaptersInstance = createAdapterRegistry({
        ...adapterDependencies,
        configuration: { ...(options.configuration ?? {}), ...configurationFor(config.providers) },
      });
    }
    return adaptersInstance;
  }

  /**
   * Estado dos providers para a interface: o que está disponível, o que falta e
   * o que precisa de decisão humana. Nada aqui contata um servidor remoto.
   */
  async function providerStates() {
    const config = await providersNow();
    const comfy = config.providers.comfyui;
    const blender = config.providers.blender;
    const client = comfy.mode === 'local-loopback' ? await workflowClient() : null;
    let comfyStatus = null;
    if (client) {
      // includeModels: a lista de checkpoints instalados vem do próprio servidor —
      // é o que permite escolher um modelo real na interface, sem baixar nada.
      try { comfyStatus = await client.getComfyUiStatus({ includeModels: true }); }
      catch (error) { comfyStatus = { connected: false, error: String(error.message ?? error).slice(0, 200) }; }
    }
    const configured = blender.mode === 'disabled' ? null : (blender.executable ?? null);
    // Um caminho digitado pelo usuário não torna a ferramenta disponível: só o
    // teste de executável no disco decide (nunca apresentar ausente como pronto).
    const executable = await (async () => {
      if (configured) {
        try {
          await fs.access(configured, fs.constants.X_OK);
          return configured;
        } catch (error) {
          // Só erro de filesystem vira "indisponível"; erro de programação sobe.
          if (['ENOENT', 'EACCES', 'ENOTDIR', 'EPERM', 'ELOOP'].includes(error?.code)) return null;
          throw error;
        }
      }
      return host.findExternalTool?.('blender') ?? null;
    })();
    const configuredMissing = Boolean(configured) && !executable;
    return Object.freeze({
      schemaVersion: config.schemaVersion,
      updatedAt: config.updatedAt,
      corrupt: config.corrupt ?? null,
      comfyui: {
        mode: comfy.mode,
        endpoint: comfy.endpoint ?? (comfy.mode === 'local-loopback' ? 'http://127.0.0.1:8188' : null),
        checkpoint: comfy.checkpoint,
        workflowId: comfy.workflowId,
        connected: Boolean(comfyStatus?.connected),
        version: comfyStatus?.version ?? null,
        devices: comfyStatus?.devices ?? [],
        queue: comfyStatus?.queue ?? null,
        models: comfyStatus?.models ?? null,
        checkpoints: Array.isArray(comfyStatus?.models?.checkpoints) ? comfyStatus.models.checkpoints : [],
        modelCounts: comfyStatus?.models
          ? Object.fromEntries(Object.entries(comfyStatus.models).map(([folder, list]) => [folder, Array.isArray(list) ? list.length : null]))
          : null,
        detail: comfy.mode === 'local-loopback'
          ? (comfyStatus?.connected
            ? `ComfyUI local respondeu em ${comfyStatus.endpoint ?? comfy.endpoint ?? 'http://127.0.0.1:8188'}.`
            : `ComfyUI local não respondeu (${comfyStatus?.error ?? 'sem servidor em execução'}). Ele não é instalado nem iniciado pela Lia Forge.`)
          : comfy.mode === 'remote'
            ? (comfy.authorization?.granted
              ? `Provider remoto ${comfy.endpoint} autorizado por ${comfy.authorization.grantedBy ?? 'usuário'} em ${comfy.authorization.grantedAt}.`
              : `Provider remoto ${comfy.endpoint ?? '(sem endpoint)'} configurado, mas sem autorização: nada é enviado e nenhum custo é gerado.`)
            : 'ComfyUI desativado por você: nenhum servidor foi contatado.',
        authorization: comfy.authorization,
        maxCostUnits: comfy.maxCostUnits,
        credentialRef: comfy.credentialRef,
      },
      blender: {
        mode: blender.mode,
        executable,
        scriptPath: blender.scriptPath ?? host.blenderScriptPath,
        frameSize: blender.frameSize,
        available: Boolean(executable),
        configuredExecutable: configured,
        // De onde veio o executável aceito: caminho indicado pelo usuário ou PATH.
        executableSource: executable ? (configured ? 'user-configuration' : 'path') : null,
        // Existência + permissão de execução foram medidas; a identidade como
        // Blender não foi (o pré-voo não executa o arquivo), então não é afirmada.
        versionConfirmed: false,
        detail: blender.mode === 'disabled'
          ? 'Blender desativado por você: os passos 3D ficam bloqueados com esse motivo.'
          : executable
            ? (configured
              ? `Caminho configurado por você (${executable}) existe e é executável; a identidade como Blender não foi confirmada (o pré-voo não executa o arquivo).`
              : `Blender encontrado no PATH em ${executable}; versão não confirmada (o pré-voo não executa o arquivo).`)
            : configuredMissing
              ? `O caminho informado (${configured}) não existe ou não é executável. Confira a instalação do Blender.`
              : 'Blender não foi detectado nesta máquina. Ele não é instalado automaticamente: instale por conta própria ou informe o caminho do executável.',
      },
      note: 'Nenhuma ferramenta foi instalada, baixada ou iniciada; nenhum endpoint remoto foi contatado.',
    });
  }

  /**
   * Cliente ComfyUI do hospedeiro, ajustado ao provider escolhido:
   *   - local-loopback → endpoint configurado (ou o padrão 127.0.0.1:8188);
   *   - disabled       → nada é contatado e o motivo é dito com clareza;
   *   - remote         → o cliente local não contata outra máquina; quem faz
   *                      isso é o adapter remoto, com autorização gravada.
   */
  async function workflowClient() {
    const inner = await host.getWorkflowClient();
    const providers = providerCache ?? (await providersNow()).providers;
    const comfy = providers.comfyui;
    if (comfy.mode === 'disabled') {
      const reason = 'ComfyUI está desativado por você em Configurações → Providers. Nenhum servidor foi contatado.';
      return {
        ...inner,
        getComfyUiEndpoint: () => comfy.endpoint ?? 'http://127.0.0.1:8188',
        getComfyUiStatus: async () => ({ connected: false, available: false, endpoint: comfy.endpoint ?? null, detail: reason, version: null, models: null }),
        runComfyUiConcept: async () => { throw adapterError('WORKFLOW_BLOCKED', reason, { adapterId: 'comfyui-concept' }); },
      };
    }
    if (comfy.mode === 'remote') {
      const reason = comfy.authorization?.granted
        ? 'Provider configurado como remoto: a geração local não contata outra máquina. O passo usa o adapter remoto autorizado.'
        : 'Provider remoto configurado, mas sem autorização gravada: nada é enviado e nenhum custo é gerado.';
      return {
        ...inner,
        getComfyUiEndpoint: () => comfy.endpoint ?? 'http://127.0.0.1:8188',
        getComfyUiStatus: async () => ({ connected: false, available: false, endpoint: comfy.endpoint ?? null, detail: reason, version: null, models: null }),
        runComfyUiConcept: async () => { throw adapterError('WORKFLOW_BLOCKED', reason, { adapterId: 'comfyui-concept' }); },
      };
    }
    const endpoint = comfy.endpoint ?? null;
    if (endpoint && !isLoopbackEndpoint(endpoint)) {
      throw adapterError('ADAPTER_SEND_UNAUTHORIZED', `O provider local recusa o endpoint ${endpoint} (não é da própria máquina). Use o modo remoto com autorização explícita.`, { adapterId: 'comfyui-concept' });
    }
    return {
      ...inner,
      getComfyUiEndpoint: (explicit = null) => inner.getComfyUiEndpoint(explicit ?? endpoint),
      getComfyUiStatus: (options2 = {}) => inner.getComfyUiStatus({ ...options2, endpoint: options2.endpoint ?? endpoint }),
      runComfyUiConcept: (options2 = {}) => inner.runComfyUiConcept({ ...options2, endpoint: options2.endpoint ?? endpoint }),
    };
  }

  /** Informações reais da máquina. GPU nunca é afirmada sem probe autorizado. */
  async function measureMachine() {
    const totalRamMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeRamMb = Math.round(os.freemem() / (1024 * 1024));
    let diskMb = null;
    try {
      const stats = await fs.statfs(projectRoot);
      diskMb = Math.round((stats.bavail * stats.bsize) / (1024 * 1024));
    } catch {
      diskMb = null;
    }
    return Object.freeze({
      os: process.platform,
      release: os.release(),
      arch: process.arch,
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model ?? null,
      ramMb: totalRamMb,
      freeRamMb,
      diskMb,
      // Probe de GPU/Vulkan exige decisão humana (T12 D11): não executado.
      gpu: null,
      gpuNote: 'Nenhum probe de GPU/Vulkan foi executado: a verificação depende de autorização humana.',
      vramMb: null,
      node: process.version,
      projectRoot,
    });
  }

  /**
   * Medições da máquina. O padrão mede de verdade neste processo; um hospedeiro
   * que já mede (ou um teste que simula outra máquina) pode injetar.
   */
  const machineInfo = typeof options.machineInfo === 'function' ? options.machineInfo : measureMachine;

  async function discover() {
    const machine = await machineInfo();
    const { hub, discoveries } = await discoverHub({ registry, adapters: (await currentAdapters()).all(), machine });
    return { hub, discoveries, machine };
  }

  async function emitFor(runDirectory, hashes = new Map()) {
    await fs.mkdir(runDirectory, { recursive: true });
    return async (relativePath, bytes) => {
      const target = path.join(runDirectory, relativePath);
      const gate = await assertSafeWriteTarget({
        root: runDirectory,
        target,
        resolve: async (value) => path.resolve(value),
        lstat: async (value) => fs.lstat(value).catch(() => null),
        realpath: async (value) => fs.realpath(value).catch(() => null),
      });
      if (!gate.ok) throw Object.assign(new Error(gate.reason), { code: 'UNSAFE_WRITE_TARGET' });
      await fs.mkdir(path.dirname(target), { recursive: true });
      const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, bytes, { flag: 'wx' });
      try {
        await fs.rename(temporary, target);
      } catch (error) {
        await fs.rm(temporary, { force: true });
        throw error;
      }
      const projectRelative = path.relative(projectRoot, target).split(path.sep).join('/');
      const digest = hash(bytes);
      // o hash fica registrado pelos dois caminhos usados nos relatórios
      hashes.set(projectRelative, digest);
      hashes.set(path.relative(runDirectory, target).split(path.sep).join('/'), digest);
      return projectRelative;
    };
  }

  const storeFile = path.join(projectRoot, '.spriteforge', 'assets.json');

  async function readStore() {
    if (!await pathExists(storeFile)) return null;
    try {
      return JSON.parse(await fs.readFile(storeFile, 'utf8'));
    } catch {
      return null;
    }
  }

  async function writeStore(payload) {
    const serialized = `${JSON.stringify(payload, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > 24 * 1024 * 1024) throw new Error('Asset store excede o limite de 24 MB');
    await fs.mkdir(path.dirname(storeFile), { recursive: true });
    const temporary = `${storeFile}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    try {
      await fs.rename(temporary, storeFile);
    } catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
  }

  async function assets() {
    return createAssetManager({ store: await readStore(), save: writeStore });
  }

  // ---------------------------------------------------- entradas do usuário
  const inputRoot = path.join(projectRoot, INPUT_DIRECTORY);

  /**
   * Resolve um caminho dentro de uma raiz do projeto sem seguir symlink para
   * fora. A interface envia caminhos relativos ao projeto (`input/sprite.png`);
   * os demais são relativos à pasta de confinamento. As duas formas apontam para
   * o mesmo arquivo e nenhuma delas pode sair de `root`.
   */
  async function resolveInside(root, candidate, projectRoot = path.dirname(root)) {
    const value = String(candidate ?? '').trim().replace(/^[\\/]+/, '');
    if (!value || path.isAbsolute(value)) return null;
    const prefixed = value === 'input' || value.startsWith('input/') || value.startsWith('input\\');
    const base = prefixed && path.resolve(root) !== path.resolve(projectRoot) ? projectRoot : root;
    const resolved = path.resolve(base, value);
    const gate = await assertSafeWriteTarget({
      root,
      target: resolved,
      resolve: async (item) => path.resolve(item),
      lstat: async (item) => fs.lstat(item).catch(() => null),
      realpath: async (item) => fs.realpath(item).catch(() => null),
    });
    return gate.ok ? resolved : null;
  }

  /**
   * Mede o que dá para medir aqui, sem ferramenta externa: PNG e GLB são
   * decodificados de verdade; JPEG/WebP são conferidos pela assinatura. O que
   * não pôde ser verificado fica marcado como tal — nunca como "ok".
   */
  function describeInputBytes(name, bytes) {
    const extension = extensionOf(name);
    const base = {
      name,
      format: extension || null,
      bytes: bytes.length,
      sha256: hash(bytes),
      kind: INPUT_IMAGE_EXTENSIONS.includes(extension) ? 'image'
        : INPUT_MODEL_EXTENSIONS.includes(extension) ? 'model'
          : INPUT_OTHER_EXTENSIONS.includes(extension) ? 'document' : 'other',
      contentChecked: false,
      width: null,
      height: null,
      problem: null,
    };
    if (extension === 'png') {
      try {
        validatePngStructure(bytes);
        const decoded = decodePng(bytes);
        const analysis = analyzePngContent(bytes);
        return Object.freeze({
          ...base, contentChecked: true, width: decoded.width, height: decoded.height,
          uniqueColors: analysis.uniqueColors, coverage: analysis.coverage, blank: analysis.blank,
          boundingBox: analysis.boundingBox ?? null,
        });
      } catch (error) {
        return Object.freeze({ ...base, problem: `PNG inválido: ${String(error.message ?? error).slice(0, 180)}` });
      }
    }
    if (extension === 'glb') {
      try {
        const info = inspectGlb(bytes);
        return Object.freeze({
          ...base, contentChecked: true,
          meshCount: info.meshCount, triangleCount: info.triangleCount,
          materials: info.materials?.length ?? 0, animationCount: info.animationCount ?? 0,
          animationNames: info.animationNames ?? [], skinned: info.skinned === true,
        });
      } catch (error) {
        return Object.freeze({ ...base, problem: `GLB inválido: ${String(error.message ?? error).slice(0, 180)}` });
      }
    }
    if (extension === 'jpg' || extension === 'jpeg') {
      const ok = bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      return Object.freeze({ ...base, contentChecked: ok, problem: ok ? null : 'A assinatura do arquivo não é JPEG.' });
    }
    if (extension === 'webp') {
      const ok = bytes.length > 12
        && Buffer.from(bytes.slice(0, 4)).toString('latin1') === 'RIFF'
        && Buffer.from(bytes.slice(8, 12)).toString('latin1') === 'WEBP';
      return Object.freeze({ ...base, contentChecked: ok, problem: ok ? null : 'A assinatura do arquivo não é WebP.' });
    }
    return Object.freeze(base);
  }

  async function walkInputs() {
    const entries = [];
    const stack = [{ directory: inputRoot, depth: 0 }];
    while (stack.length && entries.length < MAX_INPUT_ENTRIES) {
      const { directory, depth } = stack.pop();
      let items = [];
      try {
        items = await fs.readdir(directory, { withFileTypes: true });
      } catch {
        continue; // pasta inexistente ainda não é erro: o projeto pode não ter entradas
      }
      for (const item of items) {
        if (entries.length >= MAX_INPUT_ENTRIES) break;
        const absolute = path.join(directory, item.name);
        if (item.isDirectory()) {
          if (depth + 1 < MAX_INPUT_DEPTH) stack.push({ directory: absolute, depth: depth + 1 });
          continue;
        }
        // Só arquivo regular: symlink, dispositivo ou FIFO não é entrada utilizável.
        if (!item.isFile()) continue;
        const extension = extensionOf(item.name);
        if (!INPUT_EXTENSIONS.includes(extension)) continue;
        const stats = await fs.stat(absolute).catch(() => null);
        if (!stats) continue;
        const relative = path.relative(projectRoot, absolute).split(path.sep).join('/');
        let measured = null;
        if (stats.size <= MAX_INPUT_BYTES) {
          try {
            measured = describeInputBytes(item.name, await fs.readFile(absolute));
          } catch {
            measured = null;
          }
        }
        entries.push(Object.freeze({
          path: relative,
          name: item.name,
          kind: measured?.kind ?? (INPUT_IMAGE_EXTENSIONS.includes(extension) ? 'image' : INPUT_MODEL_EXTENSIONS.includes(extension) ? 'model' : 'other'),
          bytes: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          width: measured?.width ?? null,
          height: measured?.height ?? null,
          format: extension || null,
          contentChecked: measured?.contentChecked ?? false,
          problem: measured?.problem ?? (stats.size > MAX_INPUT_BYTES ? `Arquivo maior que ${MAX_INPUT_BYTES} bytes: não foi verificado aqui.` : null),
          sha256: measured?.sha256 ?? null,
          // Métricas já medidas na leitura: servem para escolher referência e
          // para o Comparison Lab sem decodificar o mesmo arquivo duas vezes.
          uniqueColors: measured?.uniqueColors ?? null,
          coverage: measured?.coverage ?? null,
          blank: measured?.blank ?? null,
          triangleCount: measured?.triangleCount ?? null,
          meshCount: measured?.meshCount ?? null,
          animationCount: measured?.animationCount ?? null,
          skinned: measured?.skinned ?? null,
        }));
      }
    }
    entries.sort((a, b) => a.path.localeCompare(b.path));
    return entries;
  }

  // ------------------------------------------------- contexto de cada passo
  /**
   * O engine é agnóstico de ferramenta: quem conhece o contrato do Blender e do
   * ComfyUI é o hospedeiro. Aqui cada passo recebe a pasta real onde pode
   * gravar, o script, as dimensões de frame, o "asset" e o caminho do modelo de
   * entrada — sem os quais os adapters externos devolvem WORKFLOW_BLOCKED.
   */
  const MODEL_EXTENSIONS = Object.freeze(['.blend', '.glb', '.gltf', '.fbx', '.obj', '.stl']);
  const DEFAULT_ANIMATIONS = Object.freeze(['idle', 'walk', 'attack']);

  function isModelPath(value) {
    return typeof value === 'string' && MODEL_EXTENSIONS.includes(path.extname(value).toLowerCase());
  }

  function absoluteInsideProject(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const resolved = path.isAbsolute(value) ? path.resolve(value) : path.resolve(projectRoot, value);
    return resolved.startsWith(path.resolve(projectRoot) + path.sep) || resolved === path.resolve(projectRoot) ? resolved : null;
  }

  /**
   * "Asset" no sentido do contrato Blender: nome, tipo (character|item),
   * animações e dimensão alvo. Tudo derivado do plano e das entradas do
   * usuário — nada é inventado sobre o modelo.
   */
  function assetForStep(step, context) {
    const params = { ...(context.params ?? {}), ...(step.params ?? {}) };
    const capability = String(step.capability ?? '');
    const workflow = String(context.studioWorkflowId ?? context.workflowId ?? '');
    const type = params.assetType === 'item' || params.assetType === 'character'
      ? params.assetType
      : capability === 'render3d.to2d' || workflow.includes('character')
        ? 'character'
        : 'item';
    const animations = Array.isArray(params.animations) && params.animations.length
      ? params.animations.filter((value) => typeof value === 'string' && value.trim()).slice(0, 8)
      : [...DEFAULT_ANIMATIONS];
    return {
      name: String(params.assetName ?? params.name ?? context.brief?.title ?? type).slice(0, 120),
      type,
      animations,
      target: String(params.frameSize ?? params.target ?? '48x48').slice(0, 12),
    };
  }

  async function resolveModelInput({ step, context, inputsById, runOutputs }) {
    const params = { ...(context.params ?? {}), ...(step.params ?? {}) };
    const declared = [params.model, params.modelPath, params.inputPath, params.source, context.modelPath]
      .map((value) => absoluteInsideProject(value))
      .filter(Boolean);
    if (declared.length) {
      for (const candidate of declared) {
        try { await fs.access(candidate); return candidate; } catch { /* tenta o próximo */ }
      }
      return null;
    }
    const produced = [...Object.values(inputsById ?? {}), ...Object.values(runOutputs ?? {})]
      .flatMap((entry) => (Array.isArray(entry?.outputs) ? entry.outputs : []))
      .filter(isModelPath)
      .map((value) => absoluteInsideProject(value))
      .filter(Boolean);
    if (!produced.length) return null;
    // A prioridade de formato/estágio já testada no adapter legado é reaproveitada.
    const best = host.findModelInput?.({ existingInputs: produced.map((value) => ({ path: value, stageIndex: 3 })) }) ?? produced[0];
    try { await fs.access(best); return best; } catch { return null; }
  }

  async function prepareStepContext({ step, context, inputsById, runOutputs, runDirectory }) {
    const providers = providerCache ?? (await providersNow()).providers;
    const blender = providers.blender;
    const enriched = { ...context };
    const outputDirectory = path.join(runDirectory, 'steps', String(step.id));
    await fs.mkdir(outputDirectory, { recursive: true });
    enriched.outputDirectory = outputDirectory;
    enriched.asset = assetForStep(step, context);
    if (step.adapter === 'comfyui-concept' || step.adapter === 'comfyui-remote') {
      // Difusão: o texto vem do usuário (brief ou campo prompt) e o checkpoint
      // vem do provider escolhido — nada é baixado aqui.
      const params = { ...(context.params ?? {}), ...(step.params ?? {}) };
      const briefText = typeof context.brief === 'string' ? context.brief.trim() : '';
      enriched.prompt = params.prompt ?? (briefText.length >= 12 ? briefText.slice(0, 8000) : null);
      enriched.checkpoint = params.checkpoint ?? providers.comfyui.checkpoint ?? null;
      enriched.workflowId = params.workflowId ?? providers.comfyui.workflowId ?? null;
      enriched.asset = enriched.asset ?? assetForStep(step, context);
      if (step.adapter === 'comfyui-remote') {
        enriched.endpoint = providers.comfyui.endpoint ?? null;
        enriched.credentialRef = providers.comfyui.credentialRef ?? null;
        enriched.maxCostUnits = providers.comfyui.maxCostUnits ?? null;
        enriched.authorization = providers.comfyui.authorization ?? { granted: false };
      }
    }
    if (step.adapter === 'blender-spritesheet') {
      // O contrato do Blender é específico: script, dimensões como objeto e o
      // caminho do modelo. Nada disso é imposto aos outros adapters — o rig2d,
      // por exemplo, espera `frameSize` como texto "48x48".
      enriched.scriptPath = blender.scriptPath ?? host.blenderScriptPath;
      enriched.frameSize = host.parseFrameSize?.(blender.frameSize) ?? { width: 48, height: 48 };
      enriched.projectRoot = projectRoot;
    }
    // Id do workflow do Studio (não confundir com o template do ComfyUI, que
    // vive em `workflowId` e vem do provider escolhido).
    enriched.studioWorkflowId = context.workflowId ?? null;
    const model = await resolveModelInput({ step, context, inputsById, runOutputs });
    if (model) {
      enriched.inputPath = model;
      const relative = path.relative(projectRoot, model).split(path.sep).join('/');
      enriched.inputsById = { ...(inputsById ?? {}), 'animated-model': { outputs: [relative], path: relative, sha256: null } };
    }
    return enriched;
  }

  const managerCache = new Map();

  /**
   * Execuções em andamento **neste processo**. É o que permite cancelar um run
   * de verdade: sem este registro, o sinal de cancelamento não tem para quem
   * ir e o produto só poderia mentir ("cancelado") sem parar nada.
   */
  const activeRuns = new Map();
  /** Pedidos de cancelamento: quem cancelou e por quê fica gravado no run. */
  const cancellationRequests = new Map();

  function managerFor(runId) {
    if (!managerCache.has(runId)) {
      const runDirectory = path.join(projectRoot, RUNS_DIRECTORY, runId);
      managerCache.set(runId, new ExecutionManager({
        resolveAdapter: async (adapterId) => (await currentAdapters()).adapter(adapterId),
        prepareContext: (args) => prepareStepContext({ ...args, runDirectory }),
        persist: async (snapshot) => {
          await fs.mkdir(runDirectory, { recursive: true });
          await fs.writeFile(path.join(runDirectory, 'run.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
        },
        limits,
        validateStep: validateStepOutputs,
      }));
    }
    return managerCache.get(runId);
  }

  return Object.freeze({
    schemaVersion: STUDIO_SERVICE_SCHEMA_VERSION,
    projectRoot,
    workflowIds: WORKFLOW_IDS,

    async overview() {
      const { hub, machine } = await discover();
      const [preflight, assetManager] = [await runPreflight({ registry, adapters: (await currentAdapters()).all(), machine }), await assets()];
      return Object.freeze({
        schemaVersion: STUDIO_SERVICE_SCHEMA_VERSION,
        machine,
        capabilities: registry.list().map((capability) => ({
          id: capability.id,
          family: capability.family,
          title: capability.title,
          status: capability.status,
          description: capability.description,
          requirements: capability.requirements,
          evidence: capability.evidence,
          limitations: capability.limitations,
        })),
        capabilityStates: hub.capabilityStates(),
        adapters: (await currentAdapters()).describe(),
        providers: await providerStates(),
        preflight: Object.freeze({ summary: preflight.summary, userActions: preflight.userActions, tools: preflight.tools }),
        workflows: listWorkflows({ hub, registry }),
        destinations: listDestinations(),
        // `versions` é a contagem (formato publicado e consumido pela interface);
        // `versionRunIds` diz de quais runs cada versão veio — sem isso o roteiro
        // não tem como saber se o resultado em foco foi guardado no projeto.
        assets: assetManager.list().map((asset) => ({
          id: asset.id,
          name: asset.name,
          type: asset.type,
          versions: asset.versions.length,
          versionRunIds: (asset.versions ?? []).map((version) => version.runId ?? null).filter(Boolean),
          rights: asset.rights.state,
        })),
        rights: assetManager.rightsReport(),
        note: 'Nenhuma ferramenta foi instalada, baixada ou contatada; nenhum probe de GPU foi executado.',
      });
    },

    async capabilities() {
      return registry.list();
    },

    /** Providers configurados + estado real de cada um. */
    async providers() {
      return providerStates();
    },

    /** Altera um provider (modo, endpoint, checkpoint, caminho do Blender…). */
    async configureProvider(input) {
      const result = await providerStore.configure(input);
      adaptersInstance = null;
      adaptersKey = null;
      providerCache = null;
      return { ...result, providers: await providerStates() };
    },

    async adapterManifests() {
      return (await currentAdapters()).manifests();
    },

    async preflight({ capabilityIds = null } = {}) {
      const machine = await machineInfo();
      return runPreflight({ registry, adapters: (await currentAdapters()).all(), machine, capabilityIds });
    },

    async workflows() {
      const { hub } = await discover();
      return listWorkflows({ hub, registry });
    },

    async plan({ workflowId, destination = null, options: planOptions = {}, brief = null, allowRemote = false }) {
      const { hub, machine } = await discover();
      const plan = planWorkflow({ workflowId, hub, registry, destination, options: planOptions, brief, allowRemote });
      return Object.freeze({ plan, machine, hubStates: hub.capabilityStates() });
    },

    /**
     * Executa um plano. Só adapters internos rodam sem ferramenta externa;
     * passos bloqueados permanecem bloqueados e o run registra o motivo.
     */
    async run({ workflowId, destination = null, options: runOptions = {}, brief = null, params = {}, authorization = null, costCeiling = null, onEvent = null, signal = null, resume = null }) {
      const runId = resume?.runId ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      // Cancelamento cooperativo: o engine recebe este signal e para no próximo
      // ponto de verificação. Um signal externo (do hospedeiro) é encadeado.
      const controller = new AbortController();
      const forwardAbort = () => controller.abort(signal?.reason ?? new Error('Execução cancelada pelo chamador.'));
      if (signal) {
        if (signal.aborted) forwardAbort();
        else signal.addEventListener('abort', forwardAbort, { once: true });
      }
      activeRuns.set(runId, Object.freeze({
        controller,
        runId,
        workflowId,
        startedAt: new Date().toISOString(),
        resumed: Boolean(resume),
      }));
      const runDirectory = path.join(projectRoot, RUNS_DIRECTORY, runId);
      // Run anterior reaproveitado como entrada (rig/partes já revisados).
      const fromRun = params.fromRun ?? runOptions.fromRun ?? null;
      if (fromRun !== null) {
        // Id de run é nome de pasta: recusar separadores e ".." aqui impede que
        // uma entrada digitada na UI vire leitura fora de .lia-forge/runs/.
        const value = String(fromRun);
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) || value.includes('..')) {
          throw new Error('run: fromRun inválido — use o id de um run existente em .lia-forge/runs/ (sem caminhos).');
        }
      }
      const priorRunDirectory = fromRun ? path.join(projectRoot, RUNS_DIRECTORY, String(fromRun)) : null;
      let plan = null;
      try {
      const { hub, machine } = await discover();
      // Entradas fornecidas pelo usuário (`params.model`, `params.fromRun`…) são
      // promovidas a opções do plano: é por elas que o Orquestrador decide se um
      // passo tem o que precisa, e é por elas que o valor chega ao adapter — o
      // engine substitui `context.params` pelos params do passo planejado.
      const RESERVED_PARAMS = new Set(['reviews', 'sourceImage']);
      const userInputOptions = Object.fromEntries(Object.entries(params)
        .filter(([key, value]) => !RESERVED_PARAMS.has(key) && ['string', 'number', 'boolean'].includes(typeof value)));
      const planOptions = { ...userInputOptions, ...runOptions, ...(fromRun ? { fromRun } : {}) };
      plan = planWorkflow({ workflowId, hub, registry, destination, options: planOptions, brief });
      const hashes = new Map();
      const emit = await emitFor(runDirectory, hashes);
      const manager = managerFor(runId);
      await fs.mkdir(runDirectory, { recursive: true });
      // O que originou este run fica gravado: a retomada precisa das mesmas
      // entradas (run de origem, imagem de entrada) para não perder o contexto
      // que só existia na primeira execução. Segredos são redigidos.
      const origin = {
        workflowId,
        destination,
        brief,
        options: fromRun ? { ...runOptions, fromRun } : { ...runOptions },
        params: Object.fromEntries(Object.entries(params)
          .filter(([key]) => key !== 'reviews')
          .map(([key, value]) => [key, typeof value === 'string' ? redactSecrets(value) : value])),
      };
      await fs.writeFile(path.join(runDirectory, 'plan.json'), `${JSON.stringify({ ...origin, plan }, null, 2)}\n`, 'utf8');

      const readArtifact = async (relativePath) => {
        const candidates = [path.join(runDirectory, relativePath)];
        // artefatos do run de origem, quando este run reaproveita um resultado
        if (priorRunDirectory) candidates.push(path.join(priorRunDirectory, relativePath));
        candidates.push(path.join(projectRoot, relativePath));
        for (const absolute of candidates) {
          const resolved = path.resolve(absolute);
          if (!resolved.startsWith(path.resolve(projectRoot))) return null;
          try {
            return await fs.readFile(resolved);
          } catch {
            /* tenta o próximo candidato */
          }
        }
        return null;
      };

      const context = {
        projectRoot,
        workflowId,
        outputDirectory: runDirectory,
        emit,
        machine,
        destination,
        brief,
        params,
        reviews: params.reviews ?? {},
        // Adapters externos (Blender, ComfyUI) gravam no disco por conta própria,
        // sem passar pelo `emit`. O hash ainda precisa existir: é o que ancora o
        // gate de revisão (SHA-256) e a detecção de entrada alterada.
        hashArtifact: async (relativePath) => {
          const direct = hashes.get(relativePath)
            ?? hashes.get(path.relative(runDirectory, path.join(projectRoot, relativePath)));
          if (direct) return direct;
          const bytes = await context.readArtifact(relativePath);
          return bytes ? hash(bytes) : null;
        },
        // bolsa de dados entre passos do mesmo run (partes → rig → animação)
        state: {},
        // leitura confinada ao projeto: aceita caminho relativo ao run ou ao
        // projeto, e devolve null quando o arquivo não existe
        readArtifact,
      };

      if (fromRun) {
        const previous = await this.readRun(fromRun);
        if (!previous) throw new Error(`run: o run anterior "${fromRun}" não foi encontrado em .lia-forge/runs/`);
        context.priorOutputs = Object.fromEntries((previous.steps ?? [])
          .filter((step) => step.outputs?.length)
          .map((step) => [step.id, { outputs: step.outputs, sha256: step.sha256 ?? null }]));
      }

      // Imagem de entrada declarada pelo usuário (caminho relativo ao projeto).
      const sourceImage = params.sourceImage ?? runOptions.sourceImage ?? null;
      if (sourceImage) {
        const bytes = await context.readArtifact(sourceImage);
        if (!bytes) throw new Error(`run: imagem de entrada "${sourceImage}" não encontrada dentro do projeto`);
        const decoded = decodePng(bytes);
        context.image = decoded;
        context.state.image = decoded;
        context.state.partImages = null;
      }

      // Autorização por run (P0-2): o escopo é derivado do plano REAL deste run e
      // a autorização da pessoa é vinculada a ele por fingerprint. Sem `scope` o
      // gate do engine nem rodava — era o que fazia `authorization` ser decorativo.
      // Na retomada, o escopo autorizado é o gravado no run: se o plano mudou, o
      // fingerprint muda e o run bloqueia pedindo autorização de novo.
      const scope = resume?.scope ?? buildRunScope(plan, {
        destination,
        inputs: context.inputs ?? {},
        costCeiling,
      });
      const requiresAuthorization = scopeRequiresAuthorization(scope);
      // Retomada: a autorização que vale é a gravada no run.json deste run, não
      // uma nova decisão inventada aqui. Ela é vinculada por fingerprint ao escopo
      // RECALCULADO a partir do plano atual — se o plano mudou (adapter novo,
      // destino diferente, entrada trocada, ação protegida a mais), o fingerprint
      // não bate e o engine bloqueia pedindo autorização de novo.
      let requestedAuthorization = resume?.authorization ?? authorization;
      if (!requestedAuthorization && resume) {
        requestedAuthorization = await fs.readFile(path.join(runDirectory, 'run.json'), 'utf8')
          .then((text) => JSON.parse(text)?.authorization ?? null)
          .catch(() => null);
      }
      const boundAuthorization = authorizationForScope(scope, requestedAuthorization);
      const uncoveredActions = requiresAuthorization
        ? missingProtectedActions(scope, boundAuthorization)
        : [];
      if (requiresAuthorization && (!boundAuthorization || uncoveredActions.length > 0)) {
        // Fail-closed antes de executar qualquer passo: o run fica gravado como
        // bloqueado com o motivo e o fingerprint que a pessoa precisa autorizar.
        const gate = checkAuthorization({
          scope: { ...scope, plan: plan.steps.map((step) => step.id) },
          authorization: uncoveredActions.length > 0 ? boundAuthorization : null,
        });
        const blockedSnapshot = await manager.execute(plan, {
          context,
          scope,
          authorization: { granted: false },
          signal: controller.signal,
          onEvent,
          runId,
          resume: false,
          checkpoints: null,
        });
        return Object.freeze({
          runId,
          plan,
          snapshot: blockedSnapshot,
          runDirectory: path.relative(projectRoot, runDirectory),
          authorizationRequired: true,
          authorizationScope: scope,
          authorizationFingerprint: gate.fingerprint,
          authorizationReason: uncoveredActions.length > 0
            ? `Autorização incompleta: as ações protegidas ${uncoveredActions.join(', ')} deste run não foram concedidas. Nada foi executado.`
            : gate.reason,
          missingProtectedActions: Object.freeze(uncoveredActions),
        });
      }
      const snapshot = await manager.execute(plan, {
        context,
        scope,
        authorization: boundAuthorization,
        // O signal interno é o que `cancelRun` aborta; o signal do chamador
        // (quando existe) foi encadeado nele acima.
        signal: controller.signal,
        onEvent,
        // o id do run é decidido aqui: é o nome da pasta em .lia-forge/runs/
        runId,
        resume: Boolean(resume),
        checkpoints: resume?.checkpoints ?? null,
      });
      // O motivo e a autoria do cancelamento não existem dentro do engine: são
      // gravados aqui, sobre o snapshot final, para o histórico do run dizer quem
      // parou a execução e por quê (com segredos redigidos).
      const cancellation = cancellationRequests.get(runId) ?? null;
      if (cancellation && snapshot.status === 'cancelled') {
        const entry = {
          at: cancellation.at,
          level: 'warn',
          message: `Execução cancelada por ${cancellation.cancelledBy}: ${cancellation.reason}`,
          details: { code: 'WORKFLOW_CANCELLED', cancelledBy: cancellation.cancelledBy },
        };
        const recorded = { ...snapshot, cancellation, logs: [...(snapshot.logs ?? []), entry] };
        await fs.writeFile(path.join(runDirectory, 'run.json'), `${JSON.stringify(recorded, null, 2)}\n`, 'utf8').catch(() => {});
        return Object.freeze({
          runId,
          plan,
          snapshot: Object.freeze(recorded),
          runDirectory: path.relative(projectRoot, runDirectory),
          authorizationRequired: requiresAuthorization,
          authorizationScope: scope,
          authorizationFingerprint: recorded.planFingerprint ?? null,
        });
      }
      return Object.freeze({
        runId,
        plan,
        snapshot,
        runDirectory: path.relative(projectRoot, runDirectory),
        authorizationRequired: requiresAuthorization,
        authorizationScope: scope,
        authorizationFingerprint: snapshot.planFingerprint ?? null,
      });
      } catch (error) {
        // Falha antes de qualquer passo executar (entrada inexistente, plano
        // inválido…): o run ainda assim existe, fica gravado e explica o motivo
        // — com segredos redigidos, como em qualquer outro log.
        const message = redactSecrets(error?.message ?? String(error));
        const at = new Date().toISOString();
        const failed = {
          schemaVersion: STUDIO_SERVICE_SCHEMA_VERSION,
          runId,
          planId: plan?.id ?? workflowId,
          planTitle: plan?.title ?? workflowId,
          status: 'failed',
          startedAt: at,
          finishedAt: at,
          steps: (plan?.steps ?? []).map((step) => ({ id: step.id, adapter: step.adapter, state: 'pending', outputs: [], error: null })),
          gates: [],
          logs: [{ at, level: 'error', message, details: { code: error?.code ?? null } }],
          provenance: [],
          cost: { status: 'unknown', entries: [], total: null, currency: null },
          summary: { total: plan?.steps?.length ?? 0, progress: 0, finished: true, failed: [], blocked: [] },
          error: { code: error?.code ?? 'WORKFLOW_FAILED', message },
        };
        await fs.mkdir(runDirectory, { recursive: true }).catch(() => {});
        await fs.writeFile(path.join(runDirectory, 'run.json'), `${JSON.stringify(failed, null, 2)}\n`, 'utf8').catch(() => {});
        return Object.freeze({ runId, plan, snapshot: failed, runDirectory: path.relative(projectRoot, runDirectory) });
      } finally {
        activeRuns.delete(runId);
        cancellationRequests.delete(runId);
        if (signal) signal.removeEventListener('abort', forwardAbort);
      }
    },

    /** Execuções em andamento neste processo (para a interface offrir cancelar). */
    activeRuns() {
      return activeRuns.size
        ? [...activeRuns.values()].map((item) => Object.freeze({ runId: item.runId, workflowId: item.workflowId, startedAt: item.startedAt, resumed: item.resumed }))
        : [];
    },

    /**
     * Cancela um run em andamento. Três casos, todos ditos com clareza:
     *
     * 1. está em execução neste processo → envia o sinal e o engine grava `cancelled`;
     * 2. terminou → nada é alterado e o estado real é devolvido;
     * 3. aparece como `running` mas não está neste processo (o aplicativo foi
     *    fechado, por exemplo) → o estado é gravado como cancelado **com a marca
     *    de execução ausente**: o produto não finge que parou algo que não parou.
     */
    async cancelRun({ runId, reason = 'cancelado pelo usuário', cancelledBy = 'usuario' } = {}) {
      const id = String(runId ?? '').trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || id.includes('..')) {
        throw new Error('cancelRun: runId inválido — use o id de um run em .lia-forge/runs/ (sem caminhos).');
      }
      const text = redactSecrets(String(reason));
      const at = new Date().toISOString();
      const active = activeRuns.get(id);
      if (active) {
        cancellationRequests.set(id, { reason: text, cancelledBy: String(cancelledBy), at });
        active.controller.abort(new Error(text));
        return Object.freeze({
          ok: true,
          runId: id,
          status: 'cancelling',
          cancelledBy: String(cancelledBy),
          reason: text,
          note: 'Sinal de cancelamento enviado: o passo em andamento para no próximo ponto de verificação e o run é gravado como cancelado.',
        });
      }
      const file = path.join(projectRoot, RUNS_DIRECTORY, id, 'run.json');
      if (!await pathExists(file)) throw new Error(`cancelRun: run "${id}" não encontrado em .lia-forge/runs/`);
      const stored = JSON.parse(await fs.readFile(file, 'utf8'));
      if (!['running', 'planned', 'paused'].includes(stored.status)) {
        return Object.freeze({
          ok: false,
          runId: id,
          status: stored.status,
          reason: `O run já estava encerrado como "${stored.status}"; nada foi alterado.`,
        });
      }
      const cancelled = {
        ...stored,
        status: 'cancelled',
        finishedAt: at,
        cancelled: { reason: text, cancelledBy: String(cancelledBy), at, executionPresent: false },
        steps: (stored.steps ?? []).map((step) => (['pending', 'running', 'queued'].includes(step.state)
          ? { ...step, state: 'cancelled', error: { code: 'WORKFLOW_CANCELLED', message: text } }
          : step)),
        logs: [...(stored.logs ?? []), {
          at,
          level: 'warn',
          message: `Run marcado como cancelado sem execução neste processo: ${text}`,
          details: { executionPresent: false },
        }],
        summary: { ...(stored.summary ?? {}), finished: true },
      };
      const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, `${JSON.stringify(cancelled, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      await fs.rename(temporary, file);
      return Object.freeze({
        ok: true,
        runId: id,
        status: 'cancelled',
        stale: true,
        cancelledBy: String(cancelledBy),
        reason: text,
        note: 'Não havia execução neste processo (o aplicativo pode ter sido fechado). O estado gravado foi corrigido para cancelado; checkpoints de passos concluídos continuam válidos para retomada.',
      });
    },

    /**
     * Retoma um run interrompido (cancelado, pausado, bloqueado ou falho) a
     * partir dos checkpoints válidos, com as **mesmas entradas originais** e as
     * revisões já gravadas — sem elas o gate de revisão seria perdido.
     */
    async resumeRun({ runId, reason = null } = {}) {
      const id = String(runId ?? '').trim();
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || id.includes('..')) {
        throw new Error('resumeRun: runId inválido — use o id de um run em .lia-forge/runs/ (sem caminhos).');
      }
      if (activeRuns.has(id)) throw new Error(`resumeRun: o run "${id}" ainda está em execução neste processo; cancele antes de retomar.`);
      const snapshot = await this.readRun(id);
      if (!snapshot) throw new Error(`resumeRun: run "${id}" não encontrado em .lia-forge/runs/`);
      // Run gravado como em andamento sem execução neste processo (o aplicativo
      // foi fechado, a máquina reiniciou): os checkpoints estão no disco e a
      // retomada é exatamente o que o usuário espera do botão "Retomar".
      const interrupted = ['running', 'planned'].includes(snapshot.status) && !activeRuns.has(id);
      if (!interrupted && !isResumableRunState(snapshot.status)) {
        return Object.freeze({ ok: false, runId: id, status: snapshot.status, reason: `Run "${snapshot.status}" não precisa de retomada.` });
      }
      const runDirectory = path.join(projectRoot, RUNS_DIRECTORY, id);
      const planFile = path.join(runDirectory, 'plan.json');
      if (!await pathExists(planFile)) {
        throw new Error(`resumeRun: o plano original do run "${id}" não foi encontrado; sem ele não há como retomar com as mesmas entradas.`);
      }
      const stored = JSON.parse(await fs.readFile(planFile, 'utf8'));
      const reviews = await fs.readFile(path.join(runDirectory, 'reviews.json'), 'utf8')
        .then((text) => JSON.parse(text))
        .catch(() => ({}));
      const checkpoints = Object.fromEntries((snapshot.steps ?? [])
        .filter((step) => step.state === 'succeeded')
        .map((step) => [step.id, { stepId: step.id, adapter: step.adapter, outputs: step.outputs, sha256: step.sha256, finishedAt: step.finishedAt }]));
      const resumed = await this.run({
        workflowId: stored.workflowId,
        destination: stored.destination,
        brief: stored.brief,
        options: stored.options ?? {},
        params: { ...(stored.params ?? {}), reviews },
        // `authorization` não é passada de propósito: o run usa a que está gravada
        // no run.json dele, revalidada contra o escopo recalculado.
        resume: { runId: id, checkpoints },
      });
      return Object.freeze({
        ok: true,
        runId: id,
        resumedFrom: snapshot.status,
        interrupted,
        checkpointsReused: Object.keys(checkpoints).length,
        reason: reason ? redactSecrets(String(reason)) : null,
        result: resumed.snapshot,
      });
    },

    /**
     * Revisão humana de um passo (12 passos do produto: aprovar/rejeitar).
     *
     * Aprovar grava a decisão sobre o SHA-256 do artefato real e retoma o run a
     * partir dos checkpoints válidos — o passo revisado não é reexecutado.
     * Rejeitar marca o passo como reprovado e o run permanece bloqueado.
     */
    async reviewStep({ runId, stepId, approved, reviewer = 'usuario', note = null }) {
      const snapshot = await this.readRun(runId);
      if (!snapshot) throw new Error(`reviewStep: run "${runId}" não encontrado`);
      const step = snapshot.steps.find((item) => item.id === stepId);
      if (!step) throw new Error(`reviewStep: passo "${stepId}" não existe no run "${runId}"`);
      const planFile = path.join(projectRoot, RUNS_DIRECTORY, runId, 'plan.json');
      const stored = JSON.parse(await fs.readFile(planFile, 'utf8'));
      const decision = {
        approved: approved === true,
        sha256: step.sha256 ?? null,
        reviewer,
        reviewedAt: new Date().toISOString(),
        note: note ? redactSecrets(note) : null,
      };
      const reviewsFile = path.join(projectRoot, RUNS_DIRECTORY, runId, 'reviews.json');
      const reviews = await fs.readFile(reviewsFile, 'utf8').then((text) => JSON.parse(text)).catch(() => ({}));
      // Decisão humana é proveniência: rejeitar e depois aprovar não pode apagar a
      // rejeição (foi ela que disse o que estava errado). O mapa continua com a
      // decisão atual — é o que o gate lê — e o histórico vai ao lado.
      const previous = reviews[stepId] ?? null;
      const history = previous
        ? [...(previous.history ?? []), {
          approved: previous.approved === true,
          sha256: previous.sha256 ?? null,
          reviewer: previous.reviewer ?? null,
          reviewedAt: previous.reviewedAt ?? null,
          note: previous.note ?? null,
        }]
        : [];
      reviews[stepId] = history.length ? { ...decision, history } : decision;
      await fs.writeFile(reviewsFile, `${JSON.stringify(reviews, null, 2)}\n`, 'utf8');
      if (!approved) {
        return Object.freeze({ runId, stepId, decision, resumed: false, reason: 'Passo rejeitado pelo revisor; o run permanece bloqueado.' });
      }
      if (!decision.sha256) {
        return Object.freeze({ runId, stepId, decision, resumed: false, reason: 'O passo não produziu artefato com hash; nada a retomar.' });
      }
      const checkpoints = Object.fromEntries(snapshot.steps
        .filter((item) => item.state === 'succeeded' || item.id === stepId)
        .map((item) => [item.id, { stepId: item.id, adapter: item.adapter, outputs: item.outputs, sha256: item.sha256, finishedAt: item.finishedAt }]));
      const resumed = await this.run({
        workflowId: stored.workflowId,
        destination: stored.destination,
        brief: stored.brief,
        options: stored.options ?? {},
        // entradas originais + revisões: sem isso a retomada perde o run de
        // origem (rig já revisado) e a imagem de entrada declarada pelo usuário
        params: { ...(stored.params ?? {}), reviews },
        resume: { runId, checkpoints },
      });
      return Object.freeze({ runId, stepId, decision, resumed: true, result: resumed.snapshot });
    },

    /**
     * Lista os runs gravados. Dois campos a mais dizem a verdade sobre a
     * execução: `active` (está rodando neste processo agora) e `stale` (o
     * arquivo diz que está em andamento, mas não há execução aqui — o aplicativo
     * foi fechado, por exemplo). Sem isso, um run interrompido ficaria para
     * sempre "em andamento" na interface.
     *
     * `stale` cobre só `running`/`planned`, que são os estados que **contradizem**
     * a realidade quando não há execução neste processo — os mesmos que
     * `resumeRun` reporta como `interrupted: true`. `paused` fica de fora: é o
     * estado que o engine grava quando a execução terminou com passos pendentes
     * (sem falha, bloqueio ou cancelamento), ou seja, um registro verdadeiro de
     * uma parada, não uma mentira a corrigir. Tratá-lo como interrompido fazia a
     * lista oferecer "Corrigir estado" — que grava `cancelled` com o motivo "não
     * havia execução neste processo" — para um run cujo estado já estava certo, e
     * ainda contradizia `resumeRun`, que responde `interrupted: false` para ele.
     */
    async listRuns() {
      const root = path.join(projectRoot, RUNS_DIRECTORY);
      if (!await pathExists(root)) return [];
      const entries = await fs.readdir(root, { withFileTypes: true });
      const running = new Set(activeRuns.keys());
      const unfinished = new Set(['running', 'planned']);
      const runs = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const file = path.join(root, entry.name, 'run.json');
        if (!await pathExists(file)) continue;
        try {
          const snapshot = JSON.parse(await fs.readFile(file, 'utf8'));
          const runId = snapshot.runId ?? entry.name;
          const active = running.has(runId);
          runs.push({
            runId,
            planId: snapshot.planId,
            planTitle: snapshot.planTitle,
            status: snapshot.status,
            startedAt: snapshot.startedAt,
            finishedAt: snapshot.finishedAt,
            summary: snapshot.summary,
            active,
            stale: !active && unfinished.has(snapshot.status),
            // Retomar precisa do plano original gravado: sem ele o serviço recusa
            // (e a interface não pode oferecer um botão que devolve erro).
            planStored: await pathExists(path.join(root, entry.name, 'plan.json')),
          });
        } catch {
          runs.push({ runId: entry.name, status: 'unreadable', active: false, stale: false });
        }
      }
      return runs.sort((a, b) => String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')));
    },

    /**
     * Lê o run gravado e traz junto as decisões humanas de `reviews.json`.
     *
     * Sem isso a interface não tem como mostrar quem aprovou o quê: quando a
     * retomada reaproveita o passo do checkpoint, o snapshot novo vem sem o campo
     * `review` e a aprovação que destravou o run fica invisível — assim como uma
     * rejeição anterior, que é justamente o registro do que estava errado.
     *
     * Regra de honestidade: um gate pendente **agora** vale mais do que a decisão
     * gravada antes. Se o passo está de novo esperando revisão (o artefato mudou,
     * por exemplo), ele não aparece como aprovado; a decisão antiga vai em
     * `review.recorded`, com `matchesArtifact` dizendo se ela vale para o conteúdo
     * atual do passo.
     */
    async readRun(runId) {
      const directory = path.join(projectRoot, RUNS_DIRECTORY, String(runId));
      const file = path.join(directory, 'run.json');
      if (!await pathExists(file)) return null;
      const snapshot = JSON.parse(await fs.readFile(file, 'utf8'));
      const reviews = await fs.readFile(path.join(directory, 'reviews.json'), 'utf8')
        .then((text) => JSON.parse(text))
        .catch(() => null);
      if (!reviews || typeof reviews !== 'object' || !Array.isArray(snapshot?.steps)) return snapshot;
      const steps = snapshot.steps.map((step) => {
        const decision = reviews[step.id];
        if (!decision || typeof decision !== 'object') return step;
        const matchesArtifact = decision.sha256 && step.sha256 ? decision.sha256 === step.sha256 : null;
        const recorded = { ...decision, matchesArtifact };
        const current = step.review ?? null;
        if (current && current.status !== 'approved') return { ...step, review: { ...current, recorded } };
        return {
          ...step,
          review: {
            status: decision.approved === true ? 'approved' : 'rejected',
            reviewedBy: decision.reviewer ?? null,
            reviewedAt: decision.reviewedAt ?? null,
            sha256: decision.sha256 ?? null,
            note: decision.note ?? null,
            history: decision.history ?? [],
            matchesArtifact,
            reason: decision.approved === true ? null : 'Rejeitado pelo revisor; o run permanece bloqueado.',
          },
        };
      });
      return { ...snapshot, steps, reviews };
    },

    /** Preview de VFX para a interface (PNG em base64, limitado a 6 MB). */
    async vfxPreview({ preset = 'explosion', size = 96, frameCount = 8, seed = 'lia-forge', palette = null, columns = null } = {}) {
      const generated = generateVfxAtlas({ preset, size, frameCount, seed, palette, columns });
      const png = encodePngRgba(generated.atlas.image.rgba, generated.atlas.image.width, generated.atlas.image.height);
      if (png.length > MAX_PREVIEW_BYTES) throw new Error('Preview excede o limite de 6 MB; reduza size ou frameCount.');
      return Object.freeze({
        preset,
        seed: generated.seed,
        frameCount: generated.frameCount,
        grid: { columns: generated.atlas.columns, rows: generated.atlas.rows },
        sheetWidth: generated.atlas.sheetWidth,
        sheetHeight: generated.atlas.sheetHeight,
        deterministic: generated.deterministic,
        content: analyzePngContent(png),
        pngBase64: png.toString('base64'),
        sha256: hash(png),
      });
    },

    /** Exporta artefatos de um run para um destino (perfil + SHA-256 + notas). */
    /**
     * Exporta o pacote de um run para um destino.
     *
     * Gates (P0-3 da revisão integrada). Antes desta correção `exportRun` não
     * consultava direitos, estado do run nem revisão pendente: um asset com
     * licença declarada como desconhecida (`NOASSERTION` ⇒ estado
     * `license-pending`) era exportado normalmente — medido antes de corrigir.
     * Direitos existem no modelo (`classifyRights` já calcula `redistributable`),
     * só não eram gate.
     *
     *   1. run concluído: `failed`/`cancelled`/`blocked`/`running` não exportam.
     *      Exportar artefato de run que não terminou é entregar conteúdo que o
     *      produto não garante;
     *   2. nenhuma revisão pendente nem revisão sobre hash diferente: a revisão
     *      humana vale para os bytes que a pessoa viu;
     *   3. direitos: se algum asset vinculado a este run (o `asset` informado ou
     *      os que têm proveniência deste runId) não é redistribuível
     *      (`restricted`, `blocked`, `license-pending`, `unknown`), a exportação
     *      é recusada com o estado e os bloqueios nomeados.
     *
     * Quando nenhum asset está vinculado não há declaração nenhuma para conferir:
     * a exportação segue, mas o manifesto grava `rights: null` e a resposta diz
     * `rightsState: 'not-declared'`. Não é "liberado" — é "nada foi declarado",
     * e quem recebe o pacote vê isso.
     */
    async exportRun({ runId, destination, asset = null }) {
      const snapshot = await this.readRun(runId);
      if (!snapshot) throw new Error(`exportRun: run "${runId}" não encontrado`);
      // Ordem dos gates: o motivo mais acionável primeiro. "Revisão pendente no
      // passo X" diz o que a pessoa tem de fazer; "o run está blocked" só
      // descreve o sintoma (e é o estado em que um run com revisão pendente fica).
      const pendingReview = (snapshot.steps ?? []).filter((step) => step.review?.status === 'review-missing');
      if (pendingReview.length > 0) {
        throw new Error(`exportRun: revisão humana pendente no(s) passo(s) ${pendingReview.map((step) => `"${step.id}"`).join(', ')}. Nada foi gravado.`);
      }
      const reviewDiverged = (snapshot.steps ?? []).filter((step) => step.review?.approved === true && step.review?.sha256 && step.sha256 && step.review.sha256 !== step.sha256);
      if (reviewDiverged.length > 0) {
        throw new Error(`exportRun: o artefato do(s) passo(s) ${reviewDiverged.map((step) => `"${step.id}"`).join(', ')} mudou depois da revisão (SHA-256 diferente). Aprove novamente o conteúdo atual.`);
      }
      if (snapshot.status !== 'succeeded') {
        throw new Error(`exportRun: o run "${runId}" está "${snapshot.status}"; exportar exige run concluído. Nada foi gravado.`);
      }
      const rightsGate = await this.exportRightsGate({ runId, asset });
      if (!rightsGate.allowed) {
        throw new Error(`exportRun: direitos ${rightsGate.state} bloqueiam a exportação de "${runId}": ${rightsGate.blockers.join('; ')}. Nada foi gravado.`);
      }
      const runDirectory = path.join(projectRoot, RUNS_DIRECTORY, runId);
      const artifacts = [];
      for (const step of snapshot.steps) {
        const emitted = step.outputs ?? [];
        for (const [index, relative] of emitted.entries()) {
          const absolute = path.isAbsolute(relative) ? relative : path.join(projectRoot, relative);
          if (!absolute.startsWith(runDirectory) && !absolute.startsWith(projectRoot)) continue;
          if (!await pathExists(absolute)) continue;
          const bytes = await fs.readFile(absolute);
          // Integridade do byte exportado. O engine grava o SHA-256 da primeira
          // saída do passo (é o hash que a revisão humana aprovou); se o arquivo
          // em disco não bate com ele, o conteúdo mudou depois do run — exportar
          // seria entregar algo diferente do que foi revisado. Fail-closed.
          if (index === 0 && step.sha256 && hash(bytes) !== step.sha256) {
            throw new Error(`exportRun: o artefato "${path.basename(absolute)}" do passo "${step.id}" mudou depois do run (SHA-256 ${String(step.sha256).slice(0, 12)}… gravado, ${hash(bytes).slice(0, 12)}… em disco). Nada foi gravado.`);
          }
          artifacts.push({
            id: `${step.id}:${path.basename(absolute)}`,
            format: path.extname(absolute).slice(1).toLowerCase(),
            role: step.id,
            relativePath: path.relative(runDirectory, absolute).split(path.sep).join('/'),
            bytes,
          });
        }
      }
      if (!artifacts.length) throw new Error('exportRun: o run não produziu artefatos gravados');
      const compatibility = checkDestinationCompatibility({ destinationId: destination, artifacts });
      const bundle = buildExportBundle({ destinationId: destination, artifacts, hash, asset: rightsGate.asset, rights: rightsGate.rights, workflowRunId: runId });
      const target = path.join(runDirectory, 'export', destination, 'manifest.json');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
      return Object.freeze({
        bundle,
        compatibility,
        path: path.relative(projectRoot, target).split(path.sep).join('/'),
        rightsState: rightsGate.state,
        rightsNote: rightsGate.note,
      });
    },

    /**
     * Direitos que governam a exportação de um run.
     *
     * Considera o asset informado e **todos** os assets que têm proveniência deste
     * run: vincular o run a um asset depois não pode servir para exportar sem o
     * gate, e declarar direitos só no asset "errado" também não.
     *
     * @returns {Promise<{allowed:boolean, state:string, blockers:string[], rights:object|null, asset:object|null, note:string}>}
     */
    async exportRightsGate({ runId, asset = null }) {
      const manager = await assets();
      const wantedId = typeof asset === 'string' ? asset : (asset?.id ?? null);
      const linked = (manager.list() ?? []).filter((entry) => (wantedId ? entry.id === wantedId : (entry.provenance ?? []).some((item) => item.runId === runId)));
      if (!linked.length) {
        return Object.freeze({
          allowed: true,
          state: 'not-declared',
          blockers: Object.freeze([]),
          rights: null,
          asset: null,
          note: 'Nenhum asset vinculado a este run: nenhuma licença foi declarada, então nada aqui afirma que o conteúdo está liberado.',
        });
      }
      const blocking = linked.filter((entry) => entry.rights?.redistributable !== true);
      if (blocking.length) {
        return Object.freeze({
          allowed: false,
          state: blocking.length === 1 ? String(blocking[0].rights?.state ?? 'unknown') : 'mixed',
          blockers: Object.freeze(blocking.flatMap((entry) => (entry.rights?.blockers ?? []).map((blocker) => `${entry.id}: ${blocker}`))),
          rights: null,
          asset: null,
          note: 'Direitos não redistribuíveis bloqueiam a exportação até uma pessoa declarar a licença.',
        });
      }
      const primary = linked.find((entry) => entry.id === wantedId) ?? linked[0];
      return Object.freeze({
        allowed: true,
        state: String(primary.rights?.state ?? 'unknown'),
        blockers: Object.freeze([]),
        rights: primary.rights ?? null,
        asset: primary,
        note: 'Direitos declarados por uma pessoa; a declaração vai no manifesto.',
      });
    },

    // ------------------------------------------------------------- assets
    async listAssets() {
      return (await assets()).list();
    },

    async upsertAsset(record) {
      return (await assets()).upsert(record);
    },

    async addAssetVersion(id, version) {
      return (await assets()).addVersion(id, version);
    },

    async declareAssetRights(id, declaration) {
      return (await assets()).declareRights(id, declaration);
    },

    async rightsReport() {
      return (await assets()).rightsReport();
    },

    /**
     * Registra a proveniência de um run inteiro no asset.
     *
     * Gates (P0-4 da revisão integrada). Antes: qualquer run virava versão de
     * asset e **todo** artefato recebia `validated: true` como literal, sem ler
     * `step.validations`, o estado do run ou a revisão — o oposto de "sem outputs
     * ou progresso simulados".
     *
     *   1. só run concluído vira versão (nada de `failed`/`blocked`/`cancelled`);
     *   2. nenhum passo reprovado, sem revisão pendente, nem revisão registrada
     *      sobre outro hash: a versão herda a integridade do run, não a substitui;
     *   3. `validated` é derivado da validação realmente executada, e só é `true`
     *      quando há validador aprovado **sobre estes bytes** (o SHA-256 que o
     *      passo gravou). Sem evidência, `validated: false` com o motivo escrito.
     */
    async attachRunToAsset({ assetId, runId }) {
      const snapshot = await this.readRun(runId);
      if (!snapshot) throw new Error(`attachRunToAsset: run "${runId}" não encontrado`);
      const manager = await assets();
      if (!manager.get(assetId)) throw new Error(`attachRunToAsset: asset "${assetId}" não encontrado`);
      // Mesma ordem de exportRun: motivo acionável primeiro.
      const pendingReview = (snapshot.steps ?? []).filter((step) => step.review?.status === 'review-missing');
      if (pendingReview.length > 0) {
        throw new Error(`attachRunToAsset: revisão humana pendente no(s) passo(s) ${pendingReview.map((step) => `"${step.id}"`).join(', ')}. Nada foi gravado.`);
      }
      const reviewDiverged = (snapshot.steps ?? []).filter((step) => step.review?.approved === true && step.review?.sha256 && step.sha256 && step.review.sha256 !== step.sha256);
      if (reviewDiverged.length > 0) {
        throw new Error(`attachRunToAsset: o artefato do(s) passo(s) ${reviewDiverged.map((step) => `"${step.id}"`).join(', ')} mudou depois da revisão (SHA-256 diferente). Nada foi gravado.`);
      }
      const failedSteps = (snapshot.steps ?? []).filter((step) => step.state === 'failed');
      if (failedSteps.length > 0) {
        throw new Error(`attachRunToAsset: o passo ${failedSteps.map((step) => `"${step.id}"`).join(', ')} falhou; o run não é íntegro o bastante para virar versão de asset. Nada foi gravado.`);
      }
      if (snapshot.status !== 'succeeded') {
        throw new Error(`attachRunToAsset: o run "${runId}" está "${snapshot.status}"; versão de asset exige run concluído. Nada foi gravado.`);
      }
      const artifacts = [];
      for (const provenance of snapshot.provenance ?? []) {
        const emitted = provenance.outputs ?? [];
        const step = (snapshot.steps ?? []).find((item) => item.id === provenance.stepId) ?? null;
        for (const relative of emitted) {
          const absolute = path.join(projectRoot, relative);
          if (!await pathExists(absolute)) continue;
          const bytes = await fs.readFile(absolute);
          // o hash gravado pelo run vale para o artefato principal do passo;
          // com mais de uma saída, cada arquivo é hasheado individualmente
          const sha256 = emitted.length === 1 ? (provenance.sha256 ?? hash(bytes)) : hash(bytes);
          artifacts.push({
            path: relative,
            role: provenance.stepId,
            format: path.extname(relative).slice(1).toLowerCase() || null,
            bytes: bytes.length,
            sha256,
            ...deriveArtifactValidation({ step, sha256, emittedCount: emitted.length }),
          });
        }
        await manager.addProvenance(assetId, {
          adapter: provenance.adapter,
          adapterVersion: provenance.adapterVersion,
          tool: provenance.adapter,
          license: provenance.license,
          outputRights: provenance.outputRights,
          runId,
          at: provenance.at,
        });
      }
      if (artifacts.length) {
        await manager.addVersion(assetId, { runId, artifacts, note: `Artefatos do run ${runId}` });
      }
      return manager.get(assetId);
    },

    // ------------------------------------------------- entradas (referências)
    /**
     * Lista o que o usuário já tem em `<projeto>/input/`: é o que a interface
     * oferece para escolher, em vez de pedir que alguém digite um caminho.
     */
    /**
     * Passo 1 da jornada: onde está o projeto e o que há nele. Só leitura —
     * nada é criado aqui (criar/abrir pasta é ação do hospedeiro, que usa
     * `ensureProjectStructure` do mesmo módulo).
     */
    async projectInfo() {
      const structure = await inspectProjectStructure(projectRoot);
      const assets = await this.listAssets().catch(() => []);
      const runs = await this.listRuns().catch(() => []);
      return Object.freeze({
        ...structure,
        counts: Object.freeze({
          ...structure.counts,
          assets: Array.isArray(assets) ? assets.length : 0,
          runs: Array.isArray(runs) ? runs.length : structure.counts.runs,
        }),
        activeRuns: this.activeRuns().length,
        legacy: Object.freeze({
          spriteforge: structure.directories.legacyState.exists,
          liaManifest: structure.files.liaManifest.exists,
          note: structure.directories.legacyState.exists || structure.files.liaManifest.exists
            ? 'Conteúdo de versões anteriores (.spriteforge/, .lia.json) foi encontrado e é preservado: o produto não move, não converte e não apaga.'
            : 'Nenhum conteúdo legado (.spriteforge/, .lia.json) foi encontrado nesta pasta.',
        }),
      });
    },

    async listInputs() {
      return Object.freeze({ directory: INPUT_DIRECTORY, entries: Object.freeze(await walkInputs()) });
    },

    /**
     * Grava uma entrada fornecida pelo usuário (imagem de referência, modelo).
     * Regras: nome sanitizado, extensão permitida, conteúdo verificado quando o
     * formato é conhecido deste código, tamanho limitado, escrita atômica dentro
     * de `<projeto>/input/` e colisão nunca sobrescreve o arquivo existente.
     *
     * @param {{filename:string, bytes:Uint8Array|Buffer, note?:string}} input
     */
    async saveInput({ filename, bytes, note = null } = {}) {
      const name = sanitizeInputName(filename);
      if (!name) throw new Error('saveInput: nome de arquivo inválido (use apenas letras, números, ponto, hífen e sublinhado).');
      const extension = extensionOf(name);
      if (!INPUT_EXTENSIONS.includes(extension)) {
        throw new Error(`saveInput: formato ".${extension || '?'}" não é aceito como entrada. Aceitos: ${INPUT_EXTENSIONS.join(', ')}.`);
      }
      const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
      if (!payload.length) throw new Error('saveInput: nenhum byte recebido.');
      if (payload.length > MAX_INPUT_BYTES) throw new Error(`saveInput: arquivo maior que ${Math.round(MAX_INPUT_BYTES / (1024 * 1024))} MB.`);

      const described = describeInputBytes(name, payload);
      if (described.problem) throw new Error(`saveInput: ${described.problem}`);
      if (!described.contentChecked && INPUT_IMAGE_EXTENSIONS.includes(extension)) {
        throw new Error('saveInput: o conteúdo da imagem não pôde ser verificado neste formato.');
      }

      await fs.mkdir(inputRoot, { recursive: true });
      // Colisão ganha sufixo: o que o usuário já tinha nunca é sobrescrito. A
      // comparação ignora caixa porque o projeto pode viver em um sistema de
      // arquivos que também ignora (Windows/macOS) — lá seria o mesmo arquivo.
      const taken = new Set((await fs.readdir(inputRoot).catch(() => [])).map((item) => item.toLowerCase()));
      const stem = name.slice(0, name.length - extension.length - 1);
      // A extensão gravada é a que o usuário enviou (só a comparação ignora caixa).
      const rawExtension = name.slice(stem.length + 1);
      let finalName = name;
      for (let suffix = 2; taken.has(finalName.toLowerCase()); suffix += 1) {
        finalName = `${stem}-${suffix}.${rawExtension}`;
        if (suffix > 500) throw new Error('saveInput: não foi possível encontrar um nome livre para a entrada.');
      }
      const target = await resolveInside(inputRoot, finalName);
      if (!target) throw new Error('saveInput: caminho recusado pelo gate de escrita segura.');

      const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, payload, { flag: 'wx' });
      try {
        await fs.rename(temporary, target);
      } catch (error) {
        await fs.rm(temporary, { force: true });
        throw error;
      }
      return Object.freeze({
        ...described,
        // o nome gravado pode ter sufixo anti-colisão: vale o que está no disco
        name: finalName,
        path: path.relative(projectRoot, target).split(path.sep).join('/'),
        note: note === null ? null : redactSecrets(String(note).slice(0, 400)),
      });
    },

    /** Bytes de uma entrada, confinados a `<projeto>/input/`. */
    async readInput(relativePath) {
      const absolute = await resolveInside(inputRoot, relativePath, projectRoot);
      if (!absolute) throw new Error('readInput: caminho fora de input/ foi recusado.');
      const stats = await fs.lstat(absolute).catch(() => null);
      if (!stats?.isFile()) throw new Error('readInput: entrada não encontrada.');
      if (stats.size > MAX_PREVIEW_BYTES) throw new Error(`readInput: arquivo maior que o limite de prévia (${MAX_PREVIEW_BYTES} bytes).`);
      return fs.readFile(absolute);
    },

    /**
     * Comparison Lab: mede lado a lado os artefatos escolhidos (de runs ou de
     * entradas) sem julgar qual é melhor — a decisão é humana e fica registrada.
     */
    async compareArtifacts({ paths: candidates = [] } = {}) {
      if (!Array.isArray(candidates) || !candidates.length) throw new Error('compareArtifacts: informe ao menos um caminho.');
      if (candidates.length > 8) throw new Error('compareArtifacts: compare até 8 artefatos por vez.');
      const entries = [];
      for (const candidate of candidates) {
        const relative = String(candidate ?? '');
        const absolute = path.isAbsolute(relative) ? null : await resolveInside(projectRoot, relative, projectRoot);
        if (!absolute) {
          entries.push(Object.freeze({ path: relative, ok: false, problem: 'Caminho fora do projeto foi recusado.' }));
          continue;
        }
        try {
          const bytes = await fs.readFile(absolute);
          const described = describeInputBytes(path.basename(absolute), bytes);
          entries.push(Object.freeze({ path: path.relative(projectRoot, absolute).split(path.sep).join('/'), ok: true, ...described }));
        } catch (error) {
          entries.push(Object.freeze({ path: relative, ok: false, problem: String(error.message ?? error).slice(0, 180) }));
        }
      }
      return Object.freeze({ comparedAt: new Date().toISOString(), entries: Object.freeze(entries) });
    },

    classifyRights,
    redactSecrets,
    sha256: hash,
  });
}

export default createStudioService;
