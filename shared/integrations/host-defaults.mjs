/**
 * Ligações reais entre o serviço do Studio e as integrações do repositório.
 *
 * Motivo deste módulo: as implementações de Blender, ComfyUI, descoberta de
 * ferramentas e validação de estágio já existem no checkout
 * (`electron/blender-adapter.cjs`, `electron/external-tools.cjs`,
 * `electron/manual-artifacts.cjs`, `electron/task-manager.cjs`,
 * `scripts/comfyui-client.mjs`), mas eram injetadas apenas pelo processo
 * principal do Electron. Fora dele — no servidor de desenvolvimento, nos testes
 * e em qualquer hospedeiro Node — o serviço recebia stubs que lançavam erro, e
 * o resultado era um produto que **nunca** enxergava um Blender ou um ComfyUI
 * instalados pelo usuário, mesmo quando existiam.
 *
 * Aqui as implementações reais são carregadas de forma preguiçosa e tolerante a
 * falha: se um módulo não puder ser carregado, a dependência correspondente fica
 * `null` e o adapter reporta ausência — nunca disponibilidade fingida.
 *
 * Regras preservadas: nada é instalado, baixado ou comprado; nenhum segredo é
 * gravado; descoberta de ferramenta é somente leitura; processos filhos passam
 * pelo registro gerenciado (proteção contra órfãos).
 */

import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Carrega um módulo CommonJS do repositório sem derrubar o serviço se falhar. */
function loadCommonJs(relativePath) {
  try {
    return require(path.join(repositoryRoot, relativePath));
  } catch (error) {
    return { __loadError: error?.message ?? String(error) };
  }
}

let blenderAdapter = null;
let externalTools = null;
let manualArtifacts = null;
let taskManager = null;
let comfyUiClientPromise = null;
let sharedTaskRegistry = null;

function blender() {
  if (!blenderAdapter) blenderAdapter = loadCommonJs('electron/blender-adapter.cjs');
  return blenderAdapter;
}

function tools() {
  if (!externalTools) externalTools = loadCommonJs('electron/external-tools.cjs');
  return externalTools;
}

function artifacts() {
  if (!manualArtifacts) manualArtifacts = loadCommonJs('electron/manual-artifacts.cjs');
  return manualArtifacts;
}

/**
 * Cliente ComfyUI real (`scripts/comfyui-client.mjs`): só loopback por padrão,
 * com descoberta de checkpoints instalados e cancelamento por signal.
 */
export function getWorkflowClient() {
  if (!comfyUiClientPromise) {
    comfyUiClientPromise = import(path.join(repositoryRoot, 'scripts', 'comfyui-client.mjs'))
      .catch((error) => {
        comfyUiClientPromise = null;
        throw new Error(`Cliente ComfyUI não pôde ser carregado: ${error?.message ?? error}`);
      });
  }
  return comfyUiClientPromise;
}

/**
 * Registro mínimo de processos filhos, usado só se `electron/task-manager.cjs`
 * não puder ser carregado. Mantém a mesma interface (`start(label, cmd, args,
 * options) → { child, task }`) para que a proteção contra processos órfãos
 * continue existindo em qualquer hospedeiro.
 */
function createFallbackRegistry() {
  const { spawn } = require('node:child_process');
  const { randomUUID } = require('node:crypto');
  const processes = new Map();
  return {
    fallback: true,
    start(label, command, args = [], options = {}) {
      const child = spawn(command, args, { ...options, detached: process.platform !== 'win32', windowsHide: true });
      const task = { id: randomUUID(), label: String(label || 'Tarefa local').slice(0, 120), pid: child.pid ?? null, startedAt: new Date().toISOString() };
      processes.set(task.id, { ...task, child });
      const remove = () => processes.delete(task.id);
      child.once('exit', remove);
      child.once('error', remove);
      return { child, task };
    },
    list: () => [...processes.values()].map(({ child, ...task }) => task),
    closeAll: async () => {
      for (const { child } of processes.values()) { try { child.kill('SIGTERM'); } catch { /* já saiu */ } }
    },
  };
}

/** Registro único de processos filhos por processo hospedeiro. */
export function taskRegistry() {
  if (sharedTaskRegistry) return sharedTaskRegistry;
  const manager = taskManager ?? loadCommonJs('electron/task-manager.cjs');
  taskManager = manager;
  sharedTaskRegistry = typeof manager.ManagedProcessRegistry === 'function'
    ? new manager.ManagedProcessRegistry()
    : createFallbackRegistry();
  return sharedTaskRegistry;
}

/**
 * Dependências reais para `createStudioService` / `createAdapterRegistry`.
 *
 * @param {object} [options]
 * @param {string} [options.repositoryRootOverride] raiz do repositório (testes)
 * @returns {object} dependências prontas para injeção (valores `null` quando o
 *          módulo correspondente não existe ou não pôde ser carregado)
 */
export function createHostDefaults(options = {}) {
  const root = options.repositoryRootOverride ? path.resolve(options.repositoryRootOverride) : repositoryRoot;
  const scriptPath = path.join(root, 'scripts', 'blender_spritesheet.py');

  const findExternalTool = typeof tools().findExternalTool === 'function' ? tools().findExternalTool : null;
  const buildBlenderSpritesheetArgs = typeof blender().buildBlenderSpritesheetArgs === 'function' ? blender().buildBlenderSpritesheetArgs : null;
  const runProcess = typeof blender().runProcess === 'function' ? blender().runProcess : null;
  const validateSpritesheetFiles = typeof blender().validateSpritesheetFiles === 'function' ? blender().validateSpritesheetFiles : null;
  const findModelInput = typeof blender().findModelInput === 'function' ? blender().findModelInput : null;
  const parseFrameSize = typeof blender().parseFrameSize === 'function' ? blender().parseFrameSize : null;
  const validateStageOutputs = typeof artifacts().validateStageOutputs === 'function' ? artifacts().validateStageOutputs : null;
  const registry = taskRegistry();

  return Object.freeze({
    repositoryRoot: root,
    blenderScriptPath: scriptPath,
    findExternalTool,
    getExternalToolStatus: typeof tools().getExternalToolStatus === 'function' ? tools().getExternalToolStatus : null,
    buildBlenderSpritesheetArgs,
    runProcess,
    validateSpritesheetFiles,
    findModelInput,
    parseFrameSize,
    validateStageOutputs,
    taskRegistry: registry,
    getWorkflowClient,
    /** O que não pôde ser carregado, com o motivo: diagnóstico honesto. */
    unavailable: Object.freeze(Object.entries({
      'electron/blender-adapter.cjs': blender().__loadError ?? null,
      'electron/external-tools.cjs': tools().__loadError ?? null,
      'electron/manual-artifacts.cjs': artifacts().__loadError ?? null,
      'electron/task-manager.cjs': registry?.fallback ? 'ManagedProcessRegistry indisponível (registro mínimo em uso)' : null,
    }).filter(([, reason]) => reason).map(([module, reason]) => ({ module, reason }))),
  });
}

export default createHostDefaults;
