/**
 * Adapter de execução Blender → spritesheet (F2).
 *
 * Migração do adapter inline que vivia em `electron/main.cjs:47-88` para o
 * Adapter SDK, preservando integralmente o comportamento e os gates:
 * descoberta por `findExternalTool` (nunca instala), contexto obrigatório,
 * processo filho registrado no `ManagedProcessRegistry`, cancelamento por
 * AbortSignal (SIGTERM → `WORKFLOW_CANCELLED`), caminhos confinados ao projeto
 * (`assertPathInsideProject`), validação estrutural do PNG RGBA8 + manifesto,
 * e — novidade da F3 — validação de conteúdo do atlas (lacuna G8).
 *
 * As dependências do processo principal são injetadas: este módulo não conhece
 * Electron, não resolve caminhos fora do projeto e não decide nada sozinho.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { defineExecutionAdapter, adapterError, redactSecrets } from '../../shared/adapters/sdk.mjs';
import { constants as fsConstants } from 'node:fs';
import { validateSpritesheetContent } from '../../shared/qa/spritesheet.mjs';

/**
 * Um caminho configurado pelo usuário só conta como ferramenta se existir no
 * disco e for executável. Sem isso, "configurei o Blender" pareceria pronto e o
 * run morreria com um erro cru de spawn.
 */
async function isExecutable(candidate) {
  if (typeof candidate !== 'string' || !candidate.trim()) return false;
  try {
    await fs.access(candidate, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export const ADAPTER_ID = 'blender-spritesheet';

export const MANIFEST = Object.freeze({
  id: ADAPTER_ID,
  version: '1.1.0',
  title: 'Blender → spritesheet 2D',
  description: 'Renderiza um modelo animado em vista ortográfica e empacota os frames em atlas PNG RGBA8 com manifesto, usando o Blender já instalado pelo usuário.',
  capabilities: ['render3d.frame', 'render3d.to2d', 'render.atlas', 'render.turntable', 'motion.cycles', 'model3d.export'],
  providers: ['blender'],
  requirements: {
    os: null,
    gpu: null,
    vramMb: null,
    ramMb: 2048,
    diskMb: null,
    runtime: 'Blender 3.x/4.x com EEVEE (EEVEE Next quando disponível)',
    network: false,
    offlineCapable: true,
  },
  configuration: {
    executable: { kind: 'path', required: false, description: 'Caminho do Blender; quando ausente, é descoberto no PATH/aplicativos instalados.', env: 'LIA_FORGE_BLENDER' },
    script: { kind: 'path', required: true, description: 'scripts/blender_spritesheet.py executado em background.' },
    frameSize: { kind: 'text', required: true, description: 'Dimensões do frame (ex.: 48x48), entre 16 e 512.' },
    turntableFrames: { kind: 'number', required: false, description: 'Quantidade de vistas do turntable; omitido usa as ações do modelo.' },
  },
  inputContracts: [
    { id: 'animated-model', formats: ['blend', 'glb', 'gltf', 'fbx', 'obj', 'stl'], validator: 'model-extension', required: true },
  ],
  outputContracts: [
    { id: 'spritesheet', formats: ['png'], validator: 'png-rgba8', required: true },
    { id: 'manifest', formats: ['json'], validator: 'spritesheet-manifest', required: true },
  ],
  execution: ['process'],
  progress: true,
  cancel: true,
  errors: ['WORKFLOW_BLOCKED', 'WORKFLOW_CANCELLED', 'WORKFLOW_FAILED', 'ADAPTER_OUTPUT_INVALID'],
  logs: { redacted: true, maxEntries: 1200 },
  provenance: {
    source: 'https://www.blender.org',
    tool: 'Blender',
    version: null,
    sha256: null,
    license: 'GPL-2.0-or-later',
    licenseScope: 'Blender é executado como processo separado; a Forge não o redistribui nem deriva dele',
    weightsLicense: null,
    outputRights: 'Os renders pertencem a quem forneceu o modelo e os assets; licenças de terceiros no modelo continuam valendo',
    note: 'Versão detectada em runtime por discover(); nenhum valor é afirmado sem evidência.',
  },
  cost: { status: 'not-applicable', note: 'Execução local; custo é tempo de CPU/GPU da máquina do usuário.' },
  backends: [{ kind: 'local-process', validated: false, note: 'Validado por smoke tests; render real exige Blender instalado no alvo.' }],
  health: { status: 'unknown', detail: 'Descoberto por findExternalTool a cada preflight.' },
  evidence: {
    tests: ['tests/blender-adapter-smoke.cjs', 'tests/adapter-sdk-smoke.mjs', 'tests/blender-workflow-plan-smoke.cjs'],
    validatedVersions: [],
    executedOn: null,
    state: 'code-present',
    note: 'Nenhum Blender existe no ambiente de desenvolvimento; o render real permanece BLOCKED até ser executado no alvo.',
  },
  protectedActions: ['install_software', 'download_models_or_weights', 'cost', 'send_data'],
});

/**
 * @param {object} dependencies dependências do processo principal
 * @param {(name:string)=>string|null} dependencies.findExternalTool
 * @param {{start:Function}} dependencies.taskRegistry
 * @param {Function} dependencies.assertPathInsideProject
 * @param {Function} dependencies.buildBlenderSpritesheetArgs
 * @param {Function} dependencies.runProcess
 * @param {Function} dependencies.validateSpritesheetFiles
 * @param {Function} dependencies.validateStageOutputs
 * @param {{executable?:string}} [dependencies.configuration]
 */
export function createAdapter(dependencies = {}) {
  const {
    findExternalTool,
    taskRegistry,
    assertPathInsideProject,
    buildBlenderSpritesheetArgs,
    runProcess,
    validateSpritesheetFiles,
    validateStageOutputs,
    configuration = {},
    validateContent = true,
  } = dependencies;

  for (const [name, value] of Object.entries({ findExternalTool, taskRegistry, assertPathInsideProject, buildBlenderSpritesheetArgs, runProcess, validateSpritesheetFiles, validateStageOutputs })) {
    if (typeof value !== 'function' && !(name === 'taskRegistry' && value && typeof value.start === 'function')) {
      throw adapterError('ADAPTER_MISCONFIGURED', `O adapter ${ADAPTER_ID} precisa da dependência "${name}" injetada pelo processo principal.`);
    }
  }

  return defineExecutionAdapter(MANIFEST, {
    async discover() {
      const configured = configuration.executable || null;
      const executable = configured || findExternalTool('blender');
      if (!executable) {
        return {
          adapterId: ADAPTER_ID,
          status: 'missing',
          detail: 'Blender não foi detectado nesta máquina. Ele não é instalado automaticamente: instale por conta própria ou escolha outro adapter.',
          checkedAt: new Date().toISOString(),
          version: null,
        };
      }
      if (!(await isExecutable(executable))) {
        return {
          adapterId: ADAPTER_ID,
          status: 'missing',
          detail: configured
            ? `O caminho configurado para o Blender (${configured}) não existe ou não é executável. Corrija em Configurações → Providers; nada foi instalado.`
            : 'O Blender encontrado não é executável neste ambiente.',
          checkedAt: new Date().toISOString(),
          version: null,
        };
      }
      // A descoberta verifica existência e permissão de execução — ela **não**
      // executa o arquivo (rodar `--version` de um caminho indicado pelo usuário
      // seria executar código arbitrário no pré-voo). Por isso a identidade como
      // Blender não é afirmada: o que se sabe é dito, e o que não foi medido fica
      // marcado como não confirmado.
      const fromConfiguration = Boolean(configured);
      return {
        adapterId: ADAPTER_ID,
        status: 'available',
        detail: redactSecrets(fromConfiguration
          ? `Caminho configurado por você (${executable}) existe e é executável. A identidade como Blender não foi confirmada: a descoberta não executa o arquivo (nenhum --version foi rodado).`
          : `Blender encontrado no PATH em ${executable}. A versão não foi confirmada: a descoberta não executa o arquivo.`),
        executable,
        executableSource: fromConfiguration ? 'user-configuration' : 'path',
        checkedAt: new Date().toISOString(),
        version: null,
        versionConfirmed: false,
      };
    },

    async execute(context = {}) {
      const {
        asset,
        inputPath,
        inputsById,
        outputDirectory,
        scriptPath,
        frameSize,
        projectRoot: runProjectRoot,
        signal,
        reportProgress,
      } = context;

      const executable = configuration.executable || findExternalTool('blender');
      if (!executable) {
        throw adapterError(
          'WORKFLOW_BLOCKED',
          'Blender não foi detectado. Instale/adicione o aplicativo por conta própria ou escolha um adapter compatível.',
          { adapterId: ADAPTER_ID, action: 'install_software', requiresUserDecision: true },
        );
      }
      if (!(await isExecutable(executable))) {
        throw adapterError(
          'WORKFLOW_BLOCKED',
          `O Blender configurado (${executable}) não existe ou não é executável. Confira o caminho em Configurações → Providers; a Lia Forge não instala nada por conta própria.`,
          { adapterId: ADAPTER_ID, action: 'install_software', requiresUserDecision: true, executable },
        );
      }

      const artifactInput = inputsById?.['animated-model'] || inputsById?.model;
      const resolvedInputPath = inputPath || (artifactInput?.path ? path.resolve(runProjectRoot, artifactInput.path) : null);
      if (!resolvedInputPath || !outputDirectory || !scriptPath || !asset || !frameSize) {
        throw adapterError(
          'WORKFLOW_BLOCKED',
          'O contrato Blender precisa receber modelo animado, pasta de saída, script, personagem e dimensões.',
          { adapterId: ADAPTER_ID },
        );
      }

      const args = buildBlenderSpritesheetArgs({ scriptPath, inputPath: resolvedInputPath, outputDirectory, asset, frameSize });
      let child;
      try {
        ({ child } = taskRegistry.start(`Lia Forge · spritesheet · ${asset.name}`, executable, args, {
          cwd: outputDirectory,
          stdio: ['ignore', 'pipe', 'pipe'],
        }));
        await runProcess(child, { signal, onProgress: reportProgress });
      } catch (error) {
        // Não conseguir lançar o processo é falta de ferramenta, não defeito do
        // produto: vira bloqueio nomeado com a ação que destrava.
        if (['ENOENT', 'EACCES', 'EPERM'].includes(error?.code) || /ENOENT|EACCES|not found|permissão/i.test(String(error?.message ?? ''))) {
          throw adapterError(
            'WORKFLOW_BLOCKED',
            `Não foi possível executar o Blender (${executable}): ${error?.message ?? error?.code ?? 'motivo desconhecido'}. Confira a instalação e o caminho em Configurações → Providers.`,
            { adapterId: ADAPTER_ID, action: 'install_software', requiresUserDecision: true, executable },
          );
        }
        throw error;
      }

      const pngPath = path.join(outputDirectory, 'spritesheet.png');
      const metadataPath = path.join(outputDirectory, 'spritesheet.json');
      const realPngPath = await assertPathInsideProject(pngPath, { mustExist: true, label: 'Spritesheet PNG' });
      const realMetadataPath = await assertPathInsideProject(metadataPath, { mustExist: true, label: 'Metadados JSON' });
      const [pngBuffer, metadataContents] = await Promise.all([fs.readFile(realPngPath), fs.readFile(realMetadataPath, 'utf8')]);

      let metadata;
      try {
        metadata = JSON.parse(metadataContents);
      } catch {
        throw adapterError('ADAPTER_OUTPUT_INVALID', 'O Blender gerou um JSON de metadados inválido.', { adapterId: ADAPTER_ID });
      }

      const checked = validateSpritesheetFiles({
        pngBuffer,
        metadata,
        frameSize,
        assetType: asset.type,
        animations: asset.type === 'character' ? asset.animations || [] : undefined,
      });

      // F3 / lacuna G8: estrutura não basta — o atlas precisa ter pixels.
      let content = null;
      if (validateContent) {
        try {
          content = validateSpritesheetContent(pngBuffer, metadata, { label: 'A spritesheet do Blender' });
        } catch (error) {
          throw adapterError('ADAPTER_OUTPUT_INVALID', error.message, {
            adapterId: ADAPTER_ID,
            analysis: error.analysis ?? null,
          });
        }
      }

      const outputs = [realPngPath, realMetadataPath].map((output) => path.relative(runProjectRoot, output).split(path.sep).join('/'));
      validateStageOutputs(asset.type, 4, outputs);

      return {
        outputs,
        execution: { kind: 'process', executable, args, cwd: outputDirectory },
        content: content ?? undefined,
        note: content
          ? `Blender renderizou ${checked.frameCount} frames reais em ${checked.sheetWidth}×${checked.sheetHeight}px com ${(content.coverage * 100).toFixed(1)}% de cobertura verificada; revise visualmente a consistência e o pivô.`
          : `Blender renderizou ${checked.frameCount} frames reais em ${checked.sheetWidth}×${checked.sheetHeight}px; revise visualmente a consistência e o pivô.`,
      };
    },
  });
}

export default createAdapter;
