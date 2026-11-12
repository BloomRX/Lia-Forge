/**
 * Adapters de software interno (F2/F7).
 *
 * Quatro adapters, um por responsabilidade — nunca um por ferramenta:
 *
 *   `local-image-ops`  transformações e separação de partes 2D
 *   `rig2d-software`   rig 2D, animação, VFX procedural e atlas
 *   `glb-inspect`      inspeção de modelo 3D (GLB)
 *   `export-package`   pacote + manifesto de importação por destino
 *
 * Todos são de classe `execution`, locais e determinísticos. Nenhum instala,
 * baixa, compra ou envia dados; `discover()` só confirma que o código existe no
 * checkout (o que é verificável) e nunca afirma que uma ferramenta externa está
 * presente.
 *
 * Saída: cada `execute` recebe `emit(relativePath, bytes)` injetado pelo
 * processo principal (escrita atômica + confinamento ao projeto) e devolve
 * `{ outputs, metrics, note }`.
 */

import { defineExecutionAdapter, adapterError } from './sdk.mjs';
import {
  alphaBounds,
  chromaKey,
  composeLayers,
  createImage,
  cropImage,
  decomposeParts,
  flipImage,
  outlineImage,
  packAtlas,
  recolor,
  resizeImage,
} from '../imaging/core.mjs';
import { createModularRig, createPresetAnimation, createRig, estimateSkeleton, renderAnimation, samplePose, renderFrame } from '../rig2d/core.mjs';
import { generateVfxAtlas, generateVfxFrames, VFX_PRESETS } from '../vfx/core.mjs';
import { inspectGlb, summarizeGlb } from '../model3d/glb.mjs';
import { buildExportBundle, checkDestinationCompatibility, adaptSpritesheetManifestForDestination, listDestinations } from '../destinations/profiles.mjs';
import { encodePngRgba } from '../qa/png-codec.mjs';
import { validatePngContent } from '../qa/png-codec.mjs';
import { runValidator } from '../qa/validators.mjs';

const INTERNAL_VERSION = '1.0.0';

function requireEmit(context, adapterId) {
  if (typeof context?.emit !== 'function') {
    throw adapterError('ADAPTER_MISCONFIGURED', `O adapter ${adapterId} precisa de emit(relativePath, bytes) injetado pelo processo principal.`, { adapterId });
  }
  return context.emit;
}

function internalDiscover(adapterId, detail) {
  return Object.freeze({
    adapterId,
    status: 'available',
    version: INTERNAL_VERSION,
    detail,
    checkedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------- image ops

export const LOCAL_IMAGE_OPS_MANIFEST = Object.freeze({
  id: 'local-image-ops',
  version: INTERNAL_VERSION,
  title: 'Operações de imagem 2D (interno)',
  description: 'Recorte, redimensionamento, cor-chave, recolorização, espelhamento, contorno, composição de camadas, separação de partes por conectividade e empacotamento de atlas — determinístico e local.',
  capabilities: ['image2d.transform', 'image2d.compose', 'image2d.decompose-parts'],
  providers: ['lia-forge-internal'],
  requirements: { ramMb: 512, network: false, offlineCapable: true, runtime: 'Node 22 (sem dependências externas)' },
  configuration: {
    op: { kind: 'choice', required: true, description: 'Operação a executar.', choices: ['crop', 'resize', 'chroma-key', 'recolor', 'flip', 'outline', 'compose', 'decompose-parts', 'pack-atlas'] },
    tolerance: { kind: 'number', required: false, description: 'Tolerância da cor-chave (0-255).' },
    minArea: { kind: 'number', required: false, description: 'Área mínima de uma parte na separação por conectividade.' },
  },
  inputContracts: [{ id: 'image', formats: ['png'], validator: 'png-structural', required: true }],
  outputContracts: [
    { id: 'image', formats: ['png'], validator: 'png-content', required: true },
    { id: 'layers', formats: ['json'], validator: 'layers-integrity', required: false },
  ],
  execution: ['process'],
  progress: true,
  cancel: true,
  errors: ['ADAPTER_MISCONFIGURED', 'ADAPTER_OUTPUT_INVALID', 'WORKFLOW_CANCELLED'],
  logs: { redacted: true, maxEntries: 1200 },
  provenance: { source: 'shared/imaging/core.mjs', tool: 'Lia Forge (interno)', version: INTERNAL_VERSION, license: 'mesma licença do repositório', outputRights: 'Derivado direto das imagens fornecidas pelo usuário' },
  cost: { status: 'not-applicable', note: 'Código interno, sem custo externo.' },
  backends: [{ kind: 'local-process', validated: true, note: 'Validado por tests/imaging-smoke.mjs neste checkout.' }],
  health: { status: 'available', detail: 'Módulo interno presente no checkout.' },
  evidence: { tests: ['tests/imaging-smoke.mjs', 'tests/adapter-sdk-smoke.mjs'], validatedVersions: [INTERNAL_VERSION], executedOn: 'ambiente de desenvolvimento', state: 'executed', note: 'Executado de verdade em testes: entrada e saída comparadas pixel a pixel.' },
  protectedActions: ['install_software', 'download_models_or_weights', 'cost', 'send_data'],
});

export function createLocalImageOpsAdapter() {
  return defineExecutionAdapter(LOCAL_IMAGE_OPS_MANIFEST, {
    discover: async () => internalDiscover('local-image-ops', 'Módulo interno de operações de imagem presente no checkout.'),
    async execute(context = {}) {
      const emit = requireEmit(context, 'local-image-ops');
      const { op = 'chroma-key', params = {}, image = null, layers = null, frames = null } = context;
      if (!image && !layers && !frames) throw adapterError('ADAPTER_MISCONFIGURED', 'local-image-ops precisa de image, layers ou frames no contexto.', { adapterId: 'local-image-ops' });
      context.signal?.throwIfAborted?.();

      const outputs = [];
      const metrics = {};
      if (op === 'crop') {
        const result = cropImage(image, params.x ?? 0, params.y ?? 0, params.width ?? image.width, params.height ?? image.height);
        outputs.push(await emit(params.output ?? 'image-crop.png', encodePngRgba(result.rgba, result.width, result.height)));
        metrics.size = { width: result.width, height: result.height };
      } else if (op === 'resize') {
        const result = resizeImage(image, params.width, params.height, { filter: params.filter ?? 'nearest' });
        outputs.push(await emit(params.output ?? 'image-resize.png', encodePngRgba(result.rgba, result.width, result.height)));
        metrics.size = { width: result.width, height: result.height };
      } else if (op === 'chroma-key') {
        const { image: result, removedPixels } = chromaKey(image, params);
        outputs.push(await emit(params.output ?? 'image-keyed.png', encodePngRgba(result.rgba, result.width, result.height)));
        metrics.removedPixels = removedPixels;
        metrics.bounds = alphaBounds(result);
      } else if (op === 'recolor') {
        const result = recolor(image, params);
        outputs.push(await emit(params.output ?? 'image-recolored.png', encodePngRgba(result.rgba, result.width, result.height)));
        metrics.params = params;
      } else if (op === 'flip') {
        const result = flipImage(image, params.axis ?? 'x');
        outputs.push(await emit(params.output ?? 'image-flipped.png', encodePngRgba(result.rgba, result.width, result.height)));
      } else if (op === 'outline') {
        const result = outlineImage(image, params);
        outputs.push(await emit(params.output ?? 'image-outlined.png', encodePngRgba(result.rgba, result.width, result.height)));
      } else if (op === 'compose') {
        const result = composeLayers(layers ?? [image], params);
        outputs.push(await emit(params.output ?? 'composed.png', encodePngRgba(result.rgba, result.width, result.height)));
        metrics.layers = (layers ?? [image]).length;
        metrics.bounds = alphaBounds(result);
      } else if (op === 'decompose-parts') {
        const decomposition = decomposeParts(image, params);
        const composed = decomposition.parts.map((part) => ({ ...part }));
        for (const part of composed) {
          outputs.push(await emit(`parts/${part.id}.png`, encodePngRgba(part.rgba, part.width, part.height)));
        }
        outputs.push(await emit('parts/layers.json', Buffer.from(`${JSON.stringify({
          schemaVersion: 1,
          sourceWidth: decomposition.sourceWidth,
          sourceHeight: decomposition.sourceHeight,
          needsReview: decomposition.needsReview,
          note: decomposition.note,
          layers: composed.map((part) => ({
            id: part.id,
            path: `parts/${part.id}.png`,
            width: part.width,
            height: part.height,
            x: part.x,
            y: part.y,
            area: part.area,
            centroid: part.centroid,
            drawOrder: part.drawOrder,
            possiblyOccluded: part.possiblyOccluded,
            overlaps: part.overlaps,
            reconstruction: part.reconstruction,
          })),
        }, null, 2)}\n`, 'utf8')));
        metrics.parts = composed.length;
        metrics.needsReview = true;
        metrics.discardedNoise = decomposition.discardedNoise;
      } else if (op === 'pack-atlas') {
        const atlas = packAtlas(frames, params);
        outputs.push(await emit(params.output ?? 'atlas.png', encodePngRgba(atlas.image.rgba, atlas.image.width, atlas.image.height)));
        metrics.grid = { columns: atlas.columns, rows: atlas.rows, frameWidth: atlas.frameWidth, frameHeight: atlas.frameHeight };
        metrics.emptyCells = atlas.emptyCells;
      } else {
        throw adapterError('ADAPTER_MISCONFIGURED', `Operação desconhecida "${op}" em local-image-ops.`, { adapterId: 'local-image-ops' });
      }

      return {
        outputs,
        metrics,
        execution: { kind: 'process', provider: 'lia-forge-internal', op },
        note: `Operação "${op}" concluída localmente sobre ${outputs.length} artefato(s); revise o resultado visualmente.`,
      };
    },
  });
}

// ---------------------------------------------------------------- rig2d

export const RIG2D_SOFTWARE_MANIFEST = Object.freeze({
  id: 'rig2d-software',
  version: INTERNAL_VERSION,
  title: 'Rig 2D, animação e VFX (renderer interno)',
  description: 'Constrói rig 2D esquelético a partir de partes, gera ações por keyframes, renderiza frames por deformação afim, produz VFX procedurais e empacota atlas com manifesto.',
  capabilities: ['rig2d.build', 'rig2d.deform', 'rig2d.animate', 'rig2d.compose', 'motion.cycles', 'render.atlas', 'vfx2d.generate', 'character.modularity'],
  providers: ['lia-forge-internal'],
  requirements: { ramMb: 512, network: false, offlineCapable: true, runtime: 'Node 22 (sem dependências externas)' },
  configuration: {
    task: { kind: 'choice', required: true, description: 'Etapa do pipeline 2D.', choices: ['estimate-skeleton', 'build-rig', 'animate', 'render', 'render-vfx', 'modular-variants'] },
    frameSize: { kind: 'text', required: false, description: 'Dimensões do frame de saída (ex.: 48x48).' },
    actions: { kind: 'text', required: false, description: 'Ações separadas por vírgula (idle,walk,run,attack).' },
    vfxPreset: { kind: 'choice', required: false, description: 'Preset de VFX procedural.', choices: [...VFX_PRESETS] },
  },
  inputContracts: [{ id: 'parts', formats: ['png', 'json'], validator: 'layers-integrity', required: false }],
  outputContracts: [
    { id: 'rig', formats: ['json'], validator: 'rig2d-structural', required: false },
    { id: 'animation', formats: ['json'], validator: 'animation-loop', required: false },
    { id: 'atlas', formats: ['png'], validator: 'png-content', required: false },
    { id: 'manifest', formats: ['json'], validator: 'spritesheet-manifest', required: false },
  ],
  execution: ['process'],
  progress: true,
  cancel: true,
  errors: ['ADAPTER_MISCONFIGURED', 'ADAPTER_OUTPUT_INVALID', 'WORKFLOW_CANCELLED'],
  logs: { redacted: true, maxEntries: 1200 },
  provenance: { source: 'shared/rig2d/core.mjs + shared/vfx/core.mjs', tool: 'Lia Forge (interno)', version: INTERNAL_VERSION, license: 'mesma licença do repositório', outputRights: 'Derivado das partes fornecidas pelo usuário; VFX procedural é gerado pelo próprio produto' },
  cost: { status: 'not-applicable', note: 'Código interno, sem custo externo.' },
  backends: [{ kind: 'local-process', validated: true, note: 'Validado por tests/rig2d-smoke.mjs e tests/vfx-smoke.mjs.' }],
  health: { status: 'available', detail: 'Renderer interno presente no checkout.' },
  evidence: { tests: ['tests/rig2d-smoke.mjs', 'tests/vfx-smoke.mjs', 'tests/adapter-sdk-smoke.mjs'], validatedVersions: [INTERNAL_VERSION], executedOn: 'ambiente de desenvolvimento', state: 'executed', note: 'Executado de verdade: rig, poses, frames e atlas produzidos e medidos em teste.' },
  protectedActions: ['install_software', 'download_models_or_weights', 'cost', 'send_data'],
});

function parseFrameSize(value) {
  if (!value) return null;
  const match = /^(\d{1,4})\s*[x×]\s*(\d{1,4})$/i.exec(String(value).trim());
  if (!match) throw adapterError('ADAPTER_MISCONFIGURED', `frameSize inválido "${value}": use LARGURAxALTURA (ex.: 48x48).`, { adapterId: 'rig2d-software' });
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 16 || width > 512 || height < 16 || height > 512) {
    throw adapterError('ADAPTER_MISCONFIGURED', `frameSize ${width}x${height} fora do intervalo 16–512.`, { adapterId: 'rig2d-software' });
  }
  return { width, height };
}

export function createRig2dSoftwareAdapter() {
  return defineExecutionAdapter(RIG2D_SOFTWARE_MANIFEST, {
    discover: async () => internalDiscover('rig2d-software', 'Renderer 2D interno presente no checkout (rig, animação, VFX, atlas).'),
    async execute(context = {}) {
      const emit = requireEmit(context, 'rig2d-software');
      const { task, params = {}, parts = null, partImages = null, rig = null, animations = null } = context;
      context.signal?.throwIfAborted?.();
      const outputs = [];
      const metrics = {};

      if (task === 'estimate-skeleton' || task === 'build-rig') {
        if (!parts?.length) throw adapterError('ADAPTER_MISCONFIGURED', 'build-rig precisa das partes separadas (saída de local-image-ops decompose-parts).', { adapterId: 'rig2d-software' });
        const skeleton = estimateSkeleton(parts, params.canvas ?? undefined);
        const built = createRig({ parts, skeleton, id: params.rigId ?? 'rig-2d' });
        outputs.push(await emit(params.output ?? 'rig.json', Buffer.from(`${JSON.stringify({ ...built, bones: built.bones, parts: built.parts }, null, 2)}\n`, 'utf8')));
        metrics.bones = built.bones.length;
        metrics.needsReview = true;
        const validation = runValidator('rig2d-structural', { rig: built });
        if (!validation.ok) throw adapterError('ADAPTER_OUTPUT_INVALID', `Rig produzido é inválido: ${validation.problems.join('; ')}`, { adapterId: 'rig2d-software' });
        metrics.validation = validation.metrics;
        const note = task === 'estimate-skeleton'
          ? `Esqueleto estimado com ${built.bones.length} ossos. Revise as juntas antes de animar: a estimação é heurística.`
          : `Rig 2D construído com ${built.bones.length} ossos e ${built.parts.length} partes; juntas marcadas para revisão humana.`;
        return { outputs, metrics, rig: built, execution: { kind: 'process', provider: 'lia-forge-internal', task }, note };
      }

      if (task === 'animate') {
        const targetRig = rig ?? context.builtRig;
        if (!targetRig?.bones) throw adapterError('ADAPTER_MISCONFIGURED', 'animate precisa de um rig (saída de build-rig).', { adapterId: 'rig2d-software' });
        const actions = (params.actions ?? context.actions ?? 'idle,walk').split(',').map((item) => item.trim()).filter(Boolean);
        const produced = actions.map((name) => createPresetAnimation(name, { bones: targetRig.bones, amplitudeScale: params.amplitudeScale ?? 1 }));
        outputs.push(await emit(params.output ?? 'animations.json', Buffer.from(`${JSON.stringify({ schemaVersion: 1, animations: produced }, null, 2)}\n`, 'utf8')));
        const validation = runValidator('animation-loop', { animations: produced });
        if (!validation.ok) throw adapterError('ADAPTER_OUTPUT_INVALID', `Animações inválidas: ${validation.problems.join('; ')}`, { adapterId: 'rig2d-software' });
        metrics.animations = produced.map((item) => ({ name: item.name, keyframes: item.keyframes.length, durationMs: item.durationMs }));
        return { outputs, metrics, execution: { kind: 'process', provider: 'lia-forge-internal', task }, note: `${produced.length} ação(ões) gerada(s) por keyframes: ${produced.map((item) => item.name).join(', ')}. Edite os keyframes antes de exportar.` };
      }

      if (task === 'render') {
        const targetRig = rig ?? context.builtRig;
        const images = partImages ?? context.partImages;
        if (!targetRig?.bones || !images) throw adapterError('ADAPTER_MISCONFIGURED', 'render precisa de rig e das imagens das partes.', { adapterId: 'rig2d-software' });
        const frameSize = parseFrameSize(params.frameSize ?? context.frameSize);
        const list = animations ?? context.animations ?? [createPresetAnimation('idle', { bones: targetRig.bones })];
        const framesPerAction = params.framesPerAction ?? 8;
        const width = frameSize?.width ?? targetRig.canvas.width;
        const height = frameSize?.height ?? targetRig.canvas.height;
        const allFrames = [];
        const frameNames = [];
        for (const animation of list) {
          const rendered = renderAnimation({ rig: targetRig, partImages: images, animation, frameCount: framesPerAction, width, height });
          rendered.forEach((frame, index) => {
            allFrames.push(frame);
            frameNames.push({ animation: animation.name, frame: index });
          });
          await context.reportProgress?.({ stage: 'render', animation: animation.name, percent: Math.round(((list.indexOf(animation) + 1) / list.length) * 100) });
        }
        const columns = Math.min(allFrames.length, params.columns ?? 8);
        const rows = Math.ceil(allFrames.length / columns);
        const atlas = packAtlas(allFrames, { columns, rows });
        outputs.push(await emit(params.output ?? 'spritesheet.png', encodePngRgba(atlas.image.rgba, atlas.image.width, atlas.image.height)));
        const validation = validatePngContent(encodePngRgba(atlas.image.rgba, atlas.image.width, atlas.image.height), { grid: { columns, rows }, label: 'O atlas do renderer 2D', minUniqueColors: 1 });
        metrics.grid = { columns, rows, frameWidth: atlas.frameWidth, frameHeight: atlas.frameHeight };
        metrics.coverage = validation.coverage;
        metrics.frames = frameNames.length;
        return { outputs, metrics, execution: { kind: 'process', provider: 'lia-forge-internal', task }, note: `Renderer interno produziu ${frameNames.length} frames em atlas ${atlas.sheetWidth}×${atlas.sheetHeight}px com ${(validation.coverage * 100).toFixed(1)}% de cobertura.` };
      }

      if (task === 'render-vfx') {
        const preset = params.preset ?? context.preset ?? 'explosion';
        const size = params.size ?? 64;
        const frameCount = params.frameCount ?? 8;
        const generated = generateVfxAtlas({ preset, size, frameCount, seed: params.seed ?? 'lia-forge', palette: params.palette ?? null, columns: params.columns ?? null });
        outputs.push(await emit(params.output ?? `vfx-${preset}.png`, encodePngRgba(generated.atlas.image.rgba, generated.atlas.image.width, generated.atlas.image.height)));
        const validation = validatePngContent(encodePngRgba(generated.atlas.image.rgba, generated.atlas.image.width, generated.atlas.image.height), { grid: { columns: generated.atlas.columns, rows: generated.atlas.rows }, label: `O VFX ${preset}`, minUniqueColors: 2 });
        metrics.preset = preset;
        metrics.seed = generated.seed;
        metrics.frameCount = generated.frameCount;
        metrics.grid = { columns: generated.atlas.columns, rows: generated.atlas.rows };
        metrics.coverage = validation.coverage;
        metrics.deterministic = generated.deterministic;
        return { outputs, metrics, execution: { kind: 'process', provider: 'lia-forge-internal', task }, note: `VFX procedural "${preset}" gerado com semente ${generated.seed}: ${generated.frameCount} frames, reprodução idêntica na mesma semente.` };
      }

      if (task === 'modular-variants') {
        const template = context.template ?? rig;
        const slots = params.slots ?? context.slots;
        if (!template || !slots) throw adapterError('ADAPTER_MISCONFIGURED', 'modular-variants precisa de template e slots.', { adapterId: 'rig2d-software' });
        const modular = createModularRig({ template, slots });
        outputs.push(await emit(params.output ?? 'modular-variants.json', Buffer.from(`${JSON.stringify(modular, null, 2)}\n`, 'utf8')));
        metrics.variants = Object.keys(modular.variants);
        metrics.sharedAnimations = true;
        return { outputs, metrics, execution: { kind: 'process', provider: 'lia-forge-internal', task }, note: `${metrics.variants.length} variante(s) sobre o mesmo rig: animações compartilhadas, sem pipeline por variante.` };
      }

      throw adapterError('ADAPTER_MISCONFIGURED', `task desconhecida "${task}" em rig2d-software.`, { adapterId: 'rig2d-software' });
    },
  });
}

// ---------------------------------------------------------------- glb

export const GLB_INSPECT_MANIFEST = Object.freeze({
  id: 'glb-inspect',
  version: INTERNAL_VERSION,
  title: 'Inspeção de modelo 3D (GLB)',
  description: 'Lê chunks, meshes, materiais, texturas, animações, skins e extensões de um GLB e devolve relatório estrutural. Não gera nem altera modelo.',
  capabilities: ['model3d.inspect'],
  providers: ['lia-forge-internal'],
  requirements: { ramMb: 256, network: false, offlineCapable: true, runtime: 'Node 22 (sem dependências externas)' },
  configuration: { maxBytes: { kind: 'number', required: false, description: 'Tamanho máximo aceito para inspeção.' } },
  inputContracts: [{ id: 'model', formats: ['glb'], validator: 'glb-structural', required: true }],
  outputContracts: [{ id: 'report', formats: ['json'], validator: null, required: true }],
  execution: ['process'],
  progress: false,
  cancel: true,
  errors: ['ADAPTER_OUTPUT_INVALID', 'ADAPTER_MISCONFIGURED'],
  logs: { redacted: true, maxEntries: 1200 },
  provenance: { source: 'shared/model3d/glb.mjs', tool: 'Lia Forge (interno)', version: INTERNAL_VERSION, license: 'mesma licença do repositório', outputRights: 'Relatório descritivo do arquivo do usuário' },
  cost: { status: 'not-applicable' },
  backends: [{ kind: 'local-process', validated: true, note: 'Validado por tests/glb-inspect-smoke.mjs.' }],
  health: { status: 'available', detail: 'Inspetor GLB interno presente no checkout.' },
  evidence: { tests: ['tests/glb-inspect-smoke.mjs'], validatedVersions: [INTERNAL_VERSION], executedOn: 'ambiente de desenvolvimento', state: 'executed', note: 'Executado sobre GLB de fixture construído byte a byte no teste.' },
  protectedActions: ['install_software', 'download_models_or_weights', 'cost', 'send_data'],
});

export function createGlbInspectAdapter() {
  return defineExecutionAdapter(GLB_INSPECT_MANIFEST, {
    discover: async () => internalDiscover('glb-inspect', 'Inspetor GLB interno presente no checkout.'),
    async execute(context = {}) {
      const emit = requireEmit(context, 'glb-inspect');
      const bytes = context.bytes ?? context.model?.bytes;
      if (!bytes) throw adapterError('ADAPTER_MISCONFIGURED', 'glb-inspect precisa dos bytes do modelo.', { adapterId: 'glb-inspect' });
      const maxBytes = context.params?.maxBytes ?? 256 * 1024 * 1024;
      if (bytes.length > maxBytes) throw adapterError('ADAPTER_OUTPUT_INVALID', `GLB de ${(bytes.length / 1024 / 1024).toFixed(1)} MB excede o limite de inspeção de ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`, { adapterId: 'glb-inspect' });
      let info;
      try {
        info = inspectGlb(bytes);
      } catch (error) {
        throw adapterError('ADAPTER_OUTPUT_INVALID', error.message, { adapterId: 'glb-inspect' });
      }
      const outputs = [await emit(context.params?.output ?? 'model-report.json', Buffer.from(`${JSON.stringify(info, null, 2)}\n`, 'utf8'))];
      return {
        outputs,
        metrics: { meshCount: info.meshCount, triangleCount: info.triangleCount, animations: info.animationCount, skinned: info.skinned, byteLength: info.byteLength },
        execution: { kind: 'process', provider: 'lia-forge-internal', task: 'inspect' },
        note: summarizeGlb(info),
      };
    },
  });
}

// ---------------------------------------------------------------- export

export const EXPORT_PACKAGE_MANIFEST = Object.freeze({
  id: 'export-package',
  version: INTERNAL_VERSION,
  title: 'Pacote de exportação por destino',
  description: 'Monta pacote com SHA-256 por arquivo, manifesto de importação e notas específicas do destino, sem duplicar geração nem alterar pixels.',
  capabilities: ['export.engine', 'export.sequence', 'model3d.export'],
  providers: ['lia-forge-internal'],
  requirements: { ramMb: 256, network: false, offlineCapable: true, runtime: 'Node 22 (SHA-256 via node:crypto)' },
  configuration: {
    destination: { kind: 'choice', required: true, description: 'Destino da exportação.', choices: listDestinations().map((item) => item.id) },
    includeSequence: { kind: 'boolean', required: false, description: 'Incluir sequência de frames numerados além do atlas.' },
  },
  inputContracts: [{ id: 'artifacts', formats: ['png', 'json', 'glb'], validator: null, required: true }],
  outputContracts: [{ id: 'bundle', formats: ['json'], validator: 'destination-profile', required: true }],
  execution: ['process'],
  progress: false,
  cancel: true,
  errors: ['ADAPTER_MISCONFIGURED', 'ADAPTER_OUTPUT_INVALID'],
  logs: { redacted: true, maxEntries: 1200 },
  provenance: { source: 'shared/destinations/profiles.mjs', tool: 'Lia Forge (interno)', version: INTERNAL_VERSION, license: 'mesma licença do repositório', outputRights: 'Direitos dos artefatos permanecem com o usuário; perfis de destino não transferem licença' },
  cost: { status: 'not-applicable' },
  backends: [{ kind: 'local-process', validated: true, note: 'Validado por tests/destinations-smoke.mjs.' }],
  health: { status: 'available', detail: 'Perfis de destino presentes no checkout.' },
  evidence: { tests: ['tests/destinations-smoke.mjs'], validatedVersions: [INTERNAL_VERSION], executedOn: 'ambiente de desenvolvimento', state: 'executed', note: 'Executado em teste; nenhum import em engine de terceiros foi feito (não verificado no destino).' },
  protectedActions: ['install_software', 'download_models_or_weights', 'cost', 'send_data'],
});

export function createExportPackageAdapter({ hash }) {
  if (typeof hash !== 'function') throw adapterError('ADAPTER_MISCONFIGURED', 'export-package precisa de hash(bytes) injetado (SHA-256 no processo principal).', { adapterId: 'export-package' });
  return defineExecutionAdapter(EXPORT_PACKAGE_MANIFEST, {
    discover: async () => internalDiscover('export-package', `Perfis de destino disponíveis: ${listDestinations().map((item) => item.id).join(', ')}.`),
    async execute(context = {}) {
      const emit = requireEmit(context, 'export-package');
      const destinationId = context.destination ?? context.params?.destination;
      const artifacts = context.artifacts ?? [];
      if (!destinationId) throw adapterError('ADAPTER_MISCONFIGURED', 'export-package precisa do destino.', { adapterId: 'export-package' });
      const compatibility = checkDestinationCompatibility({ destinationId, artifacts });
      if (!compatibility.compatible) {
        throw adapterError('ADAPTER_OUTPUT_INVALID', `Exportação para ${compatibility.label} bloqueada: ${[...compatibility.blockers, ...compatibility.conversionsNeeded.map((item) => `converter ${item.from}→${item.to} (${item.reason})`)].join('; ')}`, { adapterId: 'export-package', compatibility });
      }
      const bundle = buildExportBundle({ destinationId, artifacts, hash, asset: context.asset ?? null, workflowRunId: context.workflowRunId ?? null });
      const outputs = [await emit(context.params?.output ?? `export/${destinationId}/manifest.json`, Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`, 'utf8'))];
      if (context.params?.includeSequence && context.manifest?.frames) {
        const adapted = adaptSpritesheetManifestForDestination({ manifest: context.manifest, destinationId });
        outputs.push(await emit(`export/${destinationId}/frames.json`, Buffer.from(`${JSON.stringify(adapted, null, 2)}\n`, 'utf8')));
      }
      return {
        outputs,
        metrics: { destination: bundle.destination, files: bundle.files.length, fps: bundle.profile.fps, pivot: bundle.profile.pivot, verifiedOnDestination: bundle.verifiedOnDestination },
        execution: { kind: 'process', provider: 'lia-forge-internal', task: 'export-package', destination: bundle.destination },
        note: `${bundle.files.length} arquivo(s) empacotado(s) para ${bundle.label} com SHA-256 e notas de importação. Import no destino ainda não foi verificado.`,
      };
    },
  });
}

export const SOFTWARE_ADAPTERS = Object.freeze([
  { id: 'local-image-ops', create: createLocalImageOpsAdapter },
  { id: 'rig2d-software', create: createRig2dSoftwareAdapter },
  { id: 'glb-inspect', create: createGlbInspectAdapter },
]);

export { createImage, samplePose, renderFrame, generateVfxFrames };
