/**
 * Registro de adapters do Lia Forge (F2).
 *
 * Um único ponto onde adapters de execução, ferramentas de edição manual e
 * serviços remotos são construídos com as dependências do processo principal.
 * Regra anti-proliferação da T12 preservada: um adapter por responsabilidade,
 * com providers substituíveis atrás dele — nunca um adapter por ferramenta.
 *
 * Nada aqui é importado estaticamente pelo `main.cjs` (que é CommonJS): o
 * carregamento é dinâmico e falha fechado se um adapter não puder ser criado.
 */

import { createAdapter as createBlenderSpritesheetAdapter } from './blender-spritesheet.mjs';
import { createAdapter as createComfyUiConceptAdapter } from './comfyui-concept.mjs';
import { createAdapter as createComfyUiRemoteAdapter } from './comfyui-remote.mjs';
import {
  createExportPackageAdapter,
  createGlbInspectAdapter,
  createLocalImageOpsAdapter,
  createRig2dSoftwareAdapter,
} from '../../shared/adapters/software.mjs';
import { adapterError } from '../../shared/adapters/sdk.mjs';

/**
 * @param {object} dependencies
 * @param {(name:string)=>string|null} dependencies.findExternalTool
 * @param {{start:Function}} dependencies.taskRegistry
 * @param {Function} dependencies.assertPathInsideProject
 * @param {Function} dependencies.buildBlenderSpritesheetArgs
 * @param {Function} dependencies.runProcess
 * @param {Function} dependencies.validateSpritesheetFiles
 * @param {Function} dependencies.validateStageOutputs
 * @param {Function} dependencies.getWorkflowClient
 * @param {(bytes:Uint8Array)=>string} dependencies.hash
 * @param {Function} [dependencies.remoteTransport]
 * @param {Function} [dependencies.requireAuthorization]
 * @param {Record<string, object>} [dependencies.configuration]
 */
export function createAdapterRegistry(dependencies = {}) {
  const {
    hash,
    remoteTransport = null,
    requireAuthorization = null,
    configuration = {},
  } = dependencies;

  const built = new Map();

  const factories = new Map([
    ['blender-spritesheet', () => createBlenderSpritesheetAdapter({ ...dependencies, validateContent: configuration['blender-spritesheet']?.validateContent !== false })],
    ['comfyui-concept', () => createComfyUiConceptAdapter({ ...dependencies })],
    ['comfyui-remote', () => createComfyUiRemoteAdapter({
      transport: remoteTransport ?? (async () => {
        throw adapterError('ADAPTER_UNAVAILABLE', 'Nenhum transporte remoto foi configurado. Backend remoto exige decisão humana (endpoint, termos e teto de custo).', { adapterId: 'comfyui-remote' });
      }),
      requireAuthorization: requireAuthorization ?? (async () => ({ granted: false, reason: 'backend remoto não autorizado' })),
    })],
    ['local-image-ops', () => createLocalImageOpsAdapter()],
    ['rig2d-software', () => createRig2dSoftwareAdapter()],
    ['glb-inspect', () => createGlbInspectAdapter()],
    ['export-package', () => createExportPackageAdapter({ hash })],
  ]);

  function adapter(id) {
    if (built.has(id)) return built.get(id);
    const factory = factories.get(id);
    if (!factory) throw adapterError('ADAPTER_MISCONFIGURED', `Adapter desconhecido "${id}". Disponíveis: ${[...factories.keys()].join(', ')}.`);
    const instance = factory();
    built.set(id, instance);
    return instance;
  }

  return Object.freeze({
    ids: Object.freeze([...factories.keys()]),
    has: (id) => factories.has(id),
    adapter,
    all: () => Object.freeze([...factories.keys()].map((id) => adapter(id))),
    manifests: () => Object.freeze([...factories.keys()].map((id) => adapter(id).manifest)),
    describe: () => Object.freeze([...factories.keys()].map((id) => adapter(id).describe())),
    /** Mapa pronto para o WorkflowRunner (mantém a assinatura atual do runner). */
    runnerAdapters: () => Object.fromEntries([...factories.keys()].map((id) => [id, (context) => adapter(id).execute(context)])),
    /** Adapters que atendem uma capacidade. */
    forCapability: (capabilityId) => Object.freeze([...factories.keys()]
      .map((id) => adapter(id))
      .filter((instance) => instance.manifest.capabilities.includes(capabilityId))),
  });
}

export default createAdapterRegistry;
