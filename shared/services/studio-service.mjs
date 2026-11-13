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
import { assertSafeWriteTarget, redactSecrets, sha256Hex } from '../engine/gates.mjs';
import { createAssetManager, classifyRights } from '../assets/manager.mjs';
import { decodePng, encodePngRgba, analyzePngContent } from '../qa/png-codec.mjs';
import { validateStepOutputs } from '../qa/validators.mjs';
import { createHostDefaults } from '../integrations/host-defaults.mjs';
import { createProviderStore, isLoopbackEndpoint } from '../integrations/provider-store.mjs';
import { adapterError } from '../adapters/sdk.mjs';
import { generateVfxAtlas } from '../vfx/core.mjs';
import { buildExportBundle, checkDestinationCompatibility, listDestinations } from '../destinations/profiles.mjs';

export const STUDIO_SERVICE_SCHEMA_VERSION = 1;
const RUNS_DIRECTORY = '.lia-forge/runs';
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
      try { comfyStatus = await client.getComfyUiStatus({ includeModels: false }); }
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
        detail: blender.mode === 'disabled'
          ? 'Blender desativado por você: os passos 3D ficam bloqueados com esse motivo.'
          : executable
            ? `Blender encontrado em ${executable}.`
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
        assets: assetManager.list().map((asset) => ({ id: asset.id, name: asset.name, type: asset.type, versions: asset.versions.length, rights: asset.rights.state })),
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
    async run({ workflowId, destination = null, options: runOptions = {}, brief = null, params = {}, authorization = null, onEvent = null, signal = null, resume = null }) {
      const runId = resume?.runId ?? `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

      const snapshot = await manager.execute(plan, {
        context,
        authorization,
        signal,
        onEvent,
        // o id do run é decidido aqui: é o nome da pasta em .lia-forge/runs/
        runId,
        resume: Boolean(resume),
        checkpoints: resume?.checkpoints ?? null,
      });
      return Object.freeze({ runId, plan, snapshot, runDirectory: path.relative(projectRoot, runDirectory) });
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
      }
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
      reviews[stepId] = decision;
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

    async listRuns() {
      const root = path.join(projectRoot, RUNS_DIRECTORY);
      if (!await pathExists(root)) return [];
      const entries = await fs.readdir(root, { withFileTypes: true });
      const runs = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const file = path.join(root, entry.name, 'run.json');
        if (!await pathExists(file)) continue;
        try {
          const snapshot = JSON.parse(await fs.readFile(file, 'utf8'));
          runs.push({ runId: snapshot.runId, planId: snapshot.planId, planTitle: snapshot.planTitle, status: snapshot.status, startedAt: snapshot.startedAt, finishedAt: snapshot.finishedAt, summary: snapshot.summary });
        } catch {
          runs.push({ runId: entry.name, status: 'unreadable' });
        }
      }
      return runs.sort((a, b) => String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')));
    },

    async readRun(runId) {
      const file = path.join(projectRoot, RUNS_DIRECTORY, String(runId), 'run.json');
      if (!await pathExists(file)) return null;
      return JSON.parse(await fs.readFile(file, 'utf8'));
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
    async exportRun({ runId, destination, asset = null }) {
      const snapshot = await this.readRun(runId);
      if (!snapshot) throw new Error(`exportRun: run "${runId}" não encontrado`);
      const runDirectory = path.join(projectRoot, RUNS_DIRECTORY, runId);
      const artifacts = [];
      for (const step of snapshot.steps) {
        for (const relative of step.outputs ?? []) {
          const absolute = path.isAbsolute(relative) ? relative : path.join(projectRoot, relative);
          if (!absolute.startsWith(runDirectory) && !absolute.startsWith(projectRoot)) continue;
          if (!await pathExists(absolute)) continue;
          const bytes = await fs.readFile(absolute);
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
      const bundle = buildExportBundle({ destinationId: destination, artifacts, hash, asset, workflowRunId: runId });
      const target = path.join(runDirectory, 'export', destination, 'manifest.json');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
      return Object.freeze({ bundle, compatibility, path: path.relative(projectRoot, target).split(path.sep).join('/') });
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

    /** Registra provenência de um run inteiro no asset (direitos recalculados). */
    async attachRunToAsset({ assetId, runId }) {
      const snapshot = await this.readRun(runId);
      if (!snapshot) throw new Error(`attachRunToAsset: run "${runId}" não encontrado`);
      const manager = await assets();
      if (!manager.get(assetId)) throw new Error(`attachRunToAsset: asset "${assetId}" não encontrado`);
      const artifacts = [];
      for (const provenance of snapshot.provenance ?? []) {
        const emitted = provenance.outputs ?? [];
        for (const relative of emitted) {
          const absolute = path.join(projectRoot, relative);
          if (!await pathExists(absolute)) continue;
          const bytes = await fs.readFile(absolute);
          artifacts.push({
            path: relative,
            role: provenance.stepId,
            format: path.extname(relative).slice(1).toLowerCase() || null,
            bytes: bytes.length,
            // o hash gravado pelo run vale para o artefato principal do passo;
            // com mais de uma saída, cada arquivo é hasheado individualmente
            sha256: emitted.length === 1 ? (provenance.sha256 ?? hash(bytes)) : hash(bytes),
            validated: true,
            contentMetrics: null,
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

    classifyRights,
    redactSecrets,
    sha256: hash,
  });
}

export default createStudioService;
