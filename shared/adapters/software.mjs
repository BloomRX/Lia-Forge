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

import path from 'node:path';

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
import { analyzePngContent, decodePng, encodePngRgba, validatePngContent } from '../qa/png-codec.mjs';
import { runValidator } from '../qa/validators.mjs';

const INTERNAL_VERSION = '1.0.0';

function requireEmit(context, adapterId) {
  if (typeof context?.emit !== 'function') {
    throw adapterError('ADAPTER_MISCONFIGURED', `O adapter ${adapterId} precisa de emit(relativePath, bytes) injetado pelo processo principal.`, { adapterId });
  }
  return context.emit;
}

/**
 * Recarrega dados intermediários dos artefatos gravados no run.
 *
 * Necessário na retomada: quando um passo é reutilizado do checkpoint (por
 * exemplo após revisão humana aprovada), ele não reexecuta e a bolsa em memória
 * (`context.state`) fica vazia. Os passos seguintes então leem do disco — que é
 * a única fonte durável — em vez de exigir que tudo seja refeito.
 */
function upstreamOutputs(context, matcher) {
  const found = [];
  // dependências diretas primeiro, depois o restante do run (retomada)
  const sources = [context.inputsById ?? {}, context.runOutputs ?? {}];
  for (const source of sources) {
    for (const [stepId, input] of Object.entries(source)) {
      for (const relative of input.outputs ?? []) {
        if (found.includes(relative)) continue;
        if (matcher(relative, stepId)) found.push(relative);
      }
    }
  }
  return found;
}

async function readJsonArtifact(context, relativePath) {
  if (typeof context.readArtifact !== 'function') return null;
  const bytes = await context.readArtifact(relativePath);
  if (!bytes) return null;
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
}

async function readImageArtifact(context, relativePath) {
  if (typeof context.readArtifact !== 'function') return null;
  const bytes = await context.readArtifact(relativePath);
  if (!bytes) return null;
  try {
    return decodePng(bytes);
  } catch {
    return null;
  }
}

/** Lê `parts/layers.json` + os PNGs das partes gravados por `decompose-parts`. */
async function loadPartsFromArtifacts(context) {
  const manifestPath = upstreamOutputs(context, (relative) => /layers\.json$/i.test(relative))[0];
  if (!manifestPath) return null;
  const manifest = await readJsonArtifact(context, manifestPath);
  if (!manifest?.layers?.length) return null;
  const base = manifestPath.split('/').slice(0, -1).join('/');
  const parts = [];
  for (const layer of manifest.layers) {
    const imagePath = layer.path ? (base ? `${base}/${layer.path.split('/').pop()}` : layer.path) : null;
    const image = imagePath ? await readImageArtifact(context, imagePath) : null;
    if (!image) continue;
    parts.push({ ...layer, rgba: image.rgba, width: image.width, height: image.height });
  }
  return parts.length ? parts : null;
}

/** Lê o primeiro PNG gravado por passos anteriores (entrada implícita). */
async function loadImageFromArtifacts(context) {
  const imagePath = upstreamOutputs(context, (relative) => /\.(png|jpe?g|webp)$/i.test(relative))[0];
  if (!imagePath) return null;
  return readImageArtifact(context, imagePath);
}

/** Lê o `rig.json` gravado por `build-rig`. */
async function loadRigFromArtifacts(context) {
  const rigPath = upstreamOutputs(context, (relative) => /(^|\/)rig[^/]*\.json$/i.test(relative))[0];
  if (!rigPath) return null;
  const rig = await readJsonArtifact(context, rigPath);
  return rig?.bones?.length ? rig : null;
}

/** Lê o `animations.json` gravado por `animate`. */
async function loadAnimationsFromArtifacts(context) {
  const animationsPath = upstreamOutputs(context, (relative) => /animations?[^/]*\.json$/i.test(relative))[0];
  if (!animationsPath) return null;
  const document = await readJsonArtifact(context, animationsPath);
  return document?.animations?.length ? document.animations : null;
}

/** Lê as imagens das partes gravadas, indexadas por id (para `render`). */
async function loadPartImagesFromArtifacts(context) {
  const parts = await loadPartsFromArtifacts(context);
  if (!parts) return null;
  return Object.fromEntries(parts.map((part) => [part.id, { width: part.width, height: part.height, rgba: part.rgba }]));
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
  evidence: { tests: ['tests/imaging-smoke.mjs', 'tests/adapter-sdk-smoke.mjs', 'tests/production-pipeline-smoke.mjs', 'tests/studio-service-smoke.mjs'], validatedVersions: [INTERNAL_VERSION], executedOn: 'ambiente de desenvolvimento', state: 'executed', note: 'Executado de verdade em testes: entrada e saída comparadas pixel a pixel.' },
  protectedActions: ['install_software', 'download_models_or_weights', 'cost', 'send_data'],
});

export function createLocalImageOpsAdapter() {
  return defineExecutionAdapter(LOCAL_IMAGE_OPS_MANIFEST, {
    discover: async () => internalDiscover('local-image-ops', 'Módulo interno de operações de imagem presente no checkout.'),
    async execute(context = {}) {
      const emit = requireEmit(context, 'local-image-ops');
      const params = { ...(context.params ?? {}) };
      const op = context.op ?? params.op ?? 'chroma-key';
      let { image = null, layers = null, frames = null } = context;
      context.signal?.throwIfAborted?.();

      const outputs = [];
      const metrics = {};
      let layersPayload = null;
      let manifestPayload = null;

      // Dentro de um workflow a entrada normal é o artefato do passo anterior;
      // exigir que o hospedeiro carregue tudo em memória tornaria o plano
      // incapaz de retomar de um checkpoint (onde só existem arquivos).
      const needsImage = !['pack-atlas', 'compose'].includes(op) || op === 'compose';
      if (needsImage && !image && typeof context.readArtifact === 'function') {
        image = await loadImageFromArtifacts(context);
      }
      if (!image && !layers && !frames && op !== 'pack-atlas') {
        throw adapterError('ADAPTER_MISCONFIGURED', 'local-image-ops precisa de image, layers ou frames no contexto (ou de um PNG gravado por passo anterior).', { adapterId: 'local-image-ops' });
      }

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
        let sourceLayers = layers;
        if (!sourceLayers?.length && typeof context.readArtifact === 'function') {
          const images = [];
          for (const relative of upstreamOutputs(context, (value) => /\.(png|jpe?g|webp)$/i.test(value))) {
            const decoded = await readImageArtifact(context, relative);
            if (decoded) images.push({ ...decoded, x: 0, y: 0, id: relative.split('/').pop() });
          }
          if (images.length) sourceLayers = images;
        }
        if (!sourceLayers?.length) sourceLayers = image ? [image] : null;
        if (!sourceLayers?.length) {
          throw adapterError('ADAPTER_MISCONFIGURED', 'compose precisa de camadas (no contexto, em image ou gravadas por passos anteriores).', { adapterId: 'local-image-ops' });
        }
        const result = composeLayers(sourceLayers, params);
        outputs.push(await emit(params.output ?? 'composed.png', encodePngRgba(result.rgba, result.width, result.height)));
        metrics.layers = sourceLayers.length;
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
        // payload do validador `layers-integrity`: referencia os PNGs gravados
        layersPayload = composed.map((part) => ({
          id: part.id,
          path: `parts/${part.id}.png`,
          width: part.width,
          height: part.height,
          x: part.x,
          y: part.y,
        }));
        // Fluxo entre passos do mesmo run: o rig 2D lê as partes daqui.
        if (context.state) {
          context.state.parts = composed;
          context.state.partImages = Object.fromEntries(composed.map((part) => [part.id, { width: part.width, height: part.height, rgba: part.rgba }]));
          context.state.decomposition = { needsReview: true, discardedNoise: decomposition.discardedNoise };
        }
      } else if (op === 'pack-atlas') {
        let sourceFrames = frames;
        if (!sourceFrames?.length && typeof context.readArtifact === 'function') {
          const images = [];
          for (const relative of upstreamOutputs(context, (value) => /\.(png|jpe?g|webp)$/i.test(value))) {
            const decoded = await readImageArtifact(context, relative);
            if (decoded) images.push({ ...decoded, id: relative.split('/').pop() });
          }
          if (images.length) sourceFrames = images;
        }
        if (!sourceFrames?.length) {
          throw adapterError('ADAPTER_MISCONFIGURED', 'pack-atlas precisa de frames (no contexto ou gravados por passos anteriores).', { adapterId: 'local-image-ops' });
        }
        const atlas = packAtlas(sourceFrames, params);
        outputs.push(await emit(params.output ?? 'atlas.png', encodePngRgba(atlas.image.rgba, atlas.image.width, atlas.image.height)));
        metrics.grid = { columns: atlas.columns, rows: atlas.rows, frameWidth: atlas.frameWidth, frameHeight: atlas.frameHeight };
        manifestPayload = {
          schemaVersion: 1,
          generator: 'local-image-ops/pack-atlas',
          columns: atlas.columns,
          rows: atlas.rows,
          frameWidth: atlas.frameWidth,
          frameHeight: atlas.frameHeight,
          sheetWidth: atlas.sheetWidth,
          sheetHeight: atlas.sheetHeight,
          frames: sourceFrames.map((frame, index) => ({
            filename: frame.id ?? `frame-${String(index).padStart(2, '0')}`,
            frame: index,
            x: (index % atlas.columns) * atlas.frameWidth,
            y: Math.floor(index / atlas.columns) * atlas.frameHeight,
            width: atlas.frameWidth,
            height: atlas.frameHeight,
          })),
        };
        outputs.push(await emit(params.manifestOutput ?? 'atlas-manifest.json', Buffer.from(`${JSON.stringify(manifestPayload, null, 2)}\n`, 'utf8')));
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
  backends: [{ kind: 'local-process', validated: true, note: 'Validado por tests/rig2d-vfx-smoke.mjs (rig, poses, frames) e executado em tests/production-pipeline-smoke.mjs e tests/studio-service-smoke.mjs.' }],
  health: { status: 'available', detail: 'Renderer interno presente no checkout.' },
  evidence: { tests: ['tests/rig2d-vfx-smoke.mjs', 'tests/adapter-sdk-smoke.mjs', 'tests/production-pipeline-smoke.mjs', 'tests/studio-service-smoke.mjs'], validatedVersions: [INTERNAL_VERSION], executedOn: 'ambiente de desenvolvimento', state: 'executed', note: 'Executado de verdade: rig, poses, frames e atlas produzidos e medidos em teste.' },
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
  const UPSTREAM_2D_PREFIXES = ['rig2d.', 'image2d.'];
  const comesFrom2d = (context) => (context.upstreamCapabilities ?? []).some((id) => UPSTREAM_2D_PREFIXES.some((prefix) => String(id).startsWith(prefix)));

  return defineExecutionAdapter(RIG2D_SOFTWARE_MANIFEST, {
    /**
     * Serve a este passo?
     *
     * `render.atlas` com `task: 'render'` desenha frames a partir de rig 2D e das
     * imagens das partes — sem pipeline 2D de montante não há o que desenhar.
     * `motion.cycles` idem (as ações são de ossos 2D). Já `pack-atlas` apenas
     * organiza PNGs produzidos por passos anteriores (variações, retexture ou
     * renders 3D) e serve a qualquer origem.
     */
    canHandle(context = {}) {
      const capabilityId = context.capabilityId ?? null;
      const task = context.params?.task ?? null;
      if (capabilityId === 'render.atlas' && task === 'render') {
        return comesFrom2d(context)
          ? { ok: true }
          : { ok: false, reason: 'Este atlas pede frames desenhados a partir de rig 2D e imagens das partes; o passo não vem do pipeline 2D interno.' };
      }
      if (capabilityId === 'motion.cycles') {
        return comesFrom2d(context)
          ? { ok: true }
          : { ok: false, reason: 'As ações deste passo são de um rig 3D; o renderer 2D interno anima ossos 2D.' };
      }
      return { ok: true };
    },

    discover: async () => internalDiscover('rig2d-software', 'Renderer 2D interno presente no checkout (rig, animação, VFX, atlas).'),
    async execute(context = {}) {
      const emit = requireEmit(context, 'rig2d-software');
      const params = { ...(context.params ?? {}) };
      const task = context.task ?? params.task;
      const { parts = null, partImages = null, rig = null, animations = null } = context;
      context.signal?.throwIfAborted?.();
      const outputs = [];
      const metrics = {};

      if (task === 'estimate-skeleton' || task === 'build-rig') {
        const sourceParts = parts ?? context.state?.parts ?? await loadPartsFromArtifacts(context);
        if (!sourceParts?.length) {
          throw adapterError('WORKFLOW_BLOCKED', 'build-rig precisa das partes separadas: execute antes "2d-character-parts" (com revisão aprovada) e reaproveite aquele run como entrada, ou envie uma imagem e rode a separação de partes.', { adapterId: 'rig2d-software' });
        }
        const skeleton = estimateSkeleton(sourceParts, params.canvas ?? undefined);
        const built = createRig({ parts: sourceParts, skeleton, id: params.rigId ?? 'rig-2d' });
        outputs.push(await emit(params.output ?? 'rig.json', Buffer.from(`${JSON.stringify({ ...built, bones: built.bones, parts: built.parts }, null, 2)}\n`, 'utf8')));
        metrics.bones = built.bones.length;
        metrics.needsReview = true;
        const validation = runValidator('rig2d-structural', { rig: built });
        if (!validation.ok) throw adapterError('ADAPTER_OUTPUT_INVALID', `Rig produzido é inválido: ${validation.problems.join('; ')}`, { adapterId: 'rig2d-software' });
        metrics.validation = validation.metrics;
        if (context.state) {
          context.state.rig = built;
          context.state.partImages = context.state.partImages ?? Object.fromEntries(sourceParts.map((part) => [part.id, { width: part.width, height: part.height, rgba: part.rgba }]));
        }
        const note = task === 'estimate-skeleton'
          ? `Esqueleto estimado com ${built.bones.length} ossos. Revise as juntas antes de animar: a estimação é heurística.`
          : `Rig 2D construído com ${built.bones.length} ossos e ${built.parts.length} partes; juntas marcadas para revisão humana.`;
        return { outputs, metrics, rig: built, execution: { kind: 'process', provider: 'lia-forge-internal', task }, note };
      }

      if (task === 'animate') {
        const targetRig = rig ?? context.state?.rig ?? context.builtRig ?? await loadRigFromArtifacts(context);
        if (!targetRig?.bones) {
          throw adapterError('WORKFLOW_BLOCKED', 'animate precisa de um rig revisado: escolha um run anterior que tenha produzido rig.json (workflow "2d-character-parts" aprovado) ou execute antes o passo de construção de rig.', { adapterId: 'rig2d-software' });
        }
        const actions = (params.actions ?? context.actions ?? 'idle,walk').split(',').map((item) => item.trim()).filter(Boolean);
        const produced = actions.map((name) => createPresetAnimation(name, { bones: targetRig.bones, amplitudeScale: params.amplitudeScale ?? 1 }));
        outputs.push(await emit(params.output ?? 'animations.json', Buffer.from(`${JSON.stringify({ schemaVersion: 1, animations: produced }, null, 2)}\n`, 'utf8')));
        const validation = runValidator('animation-loop', { animations: produced });
        if (!validation.ok) throw adapterError('ADAPTER_OUTPUT_INVALID', `Animações inválidas: ${validation.problems.join('; ')}`, { adapterId: 'rig2d-software' });
        metrics.animations = produced.map((item) => ({ name: item.name, keyframes: item.keyframes.length, durationMs: item.durationMs }));
        if (context.state) context.state.animations = produced;
        return { outputs, metrics, execution: { kind: 'process', provider: 'lia-forge-internal', task }, note: `${produced.length} ação(ões) gerada(s) por keyframes: ${produced.map((item) => item.name).join(', ')}. Edite os keyframes antes de exportar.` };
      }

      if (task === 'render') {
        const targetRig = rig ?? context.state?.rig ?? context.builtRig ?? await loadRigFromArtifacts(context);
        const images = partImages ?? context.state?.partImages ?? context.partImages ?? await loadPartImagesFromArtifacts(context);
        if (!targetRig?.bones || !images) throw adapterError('ADAPTER_MISCONFIGURED', 'render precisa de rig e das imagens das partes.', { adapterId: 'rig2d-software' });
        const frameSize = parseFrameSize(params.frameSize ?? context.frameSize);
        const list = animations ?? context.state?.animations ?? context.animations ?? await loadAnimationsFromArtifacts(context) ?? [createPresetAnimation('idle', { bones: targetRig.bones })];
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
        const sheetBytes = encodePngRgba(atlas.image.rgba, atlas.image.width, atlas.image.height);
        outputs.push(await emit(params.output ?? 'spritesheet.png', sheetBytes));
        // O plano declara o validador `spritesheet-manifest` neste passo: sem o
        // manifesto gravado, a validação só poderia ser pulada — e um atlas sem
        // grade declarada não é importável em engine nenhuma.
        const manifest = {
          schemaVersion: 1,
          generator: 'rig2d-software/render',
          columns,
          rows,
          frameWidth: atlas.frameWidth,
          frameHeight: atlas.frameHeight,
          sheetWidth: atlas.sheetWidth,
          sheetHeight: atlas.sheetHeight,
          frames: frameNames.map((item, index) => ({
            filename: `${item.animation}-${String(item.frame).padStart(2, '0')}.png`,
            animation: item.animation,
            frame: index,
            x: (index % columns) * atlas.frameWidth,
            y: Math.floor(index / columns) * atlas.frameHeight,
            width: atlas.frameWidth,
            height: atlas.frameHeight,
          })),
        };
        outputs.push(await emit(params.manifestOutput ?? 'spritesheet-manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')));
        const validation = validatePngContent(sheetBytes, { grid: { columns, rows }, label: 'O atlas do renderer 2D', minUniqueColors: 1 });
        metrics.grid = { columns, rows, frameWidth: atlas.frameWidth, frameHeight: atlas.frameHeight };
        metrics.coverage = validation.coverage;
        metrics.frames = frameNames.length;
        metrics.manifestFrames = manifest.frames.length;
        return { outputs, metrics, manifest, execution: { kind: 'process', provider: 'lia-forge-internal', task }, note: `Renderer interno produziu ${frameNames.length} frames em atlas ${atlas.sheetWidth}×${atlas.sheetHeight}px com ${(validation.coverage * 100).toFixed(1)}% de cobertura e manifesto de grade.` };
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

      if (task === 'pack-atlas') {
        // Empacota imagens produzidas por passos anteriores em atlas + manifesto.
        // Não exige rig: é o caminho de variações/retexture e de qualquer passo
        // que só precisa organizar PNGs numa grade declarada.
        let sourceFrames = context.frames ?? params.frames ?? null;
        if (!sourceFrames?.length && typeof context.readArtifact === 'function') {
          const images = [];
          for (const relative of upstreamOutputs(context, (value) => /\.(png|jpe?g|webp)$/i.test(value))) {
            const decoded = await readImageArtifact(context, relative);
            if (decoded) images.push({ ...decoded, id: relative.split('/').pop() });
          }
          if (images.length) sourceFrames = images;
        }
        if (!sourceFrames?.length) {
          throw adapterError('WORKFLOW_BLOCKED', 'pack-atlas não encontrou imagens para empacotar: execute antes um passo que gere PNGs (variação, render ou VFX).', { adapterId: 'rig2d-software' });
        }
        const columns = Math.min(sourceFrames.length, params.columns ?? 4);
        const rows = Math.ceil(sourceFrames.length / columns);
        const atlas = packAtlas(sourceFrames, { columns, rows, frameWidth: params.frameWidth ?? null, frameHeight: params.frameHeight ?? null });
        const atlasBytes = encodePngRgba(atlas.image.rgba, atlas.image.width, atlas.image.height);
        outputs.push(await emit(params.output ?? 'atlas.png', atlasBytes));
        const manifest = {
          schemaVersion: 1,
          generator: 'rig2d-software/pack-atlas',
          columns: atlas.columns,
          rows: atlas.rows,
          frameWidth: atlas.frameWidth,
          frameHeight: atlas.frameHeight,
          sheetWidth: atlas.sheetWidth,
          sheetHeight: atlas.sheetHeight,
          frames: sourceFrames.map((frame, index) => ({
            filename: frame.id ?? `frame-${String(index).padStart(2, '0')}`,
            frame: index,
            x: (index % atlas.columns) * atlas.frameWidth,
            y: Math.floor(index / atlas.columns) * atlas.frameHeight,
            width: atlas.frameWidth,
            height: atlas.frameHeight,
          })),
        };
        outputs.push(await emit(params.manifestOutput ?? 'atlas-manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')));
        metrics.grid = { columns: atlas.columns, rows: atlas.rows, frameWidth: atlas.frameWidth, frameHeight: atlas.frameHeight };
        metrics.frames = sourceFrames.length;
        metrics.coverage = analyzePngContent(atlasBytes, { grid: { columns: atlas.columns, rows: atlas.rows } }).coverage;
        return { outputs, metrics, manifest, execution: { kind: 'process', provider: 'lia-forge-internal', task }, note: `${sourceFrames.length} imagem(ns) empacotada(s) em atlas ${atlas.sheetWidth}×${atlas.sheetHeight}px com manifesto.` };
      }

      if (task === 'modular-variants') {
        const template = context.template ?? rig ?? context.state?.rig ?? await loadRigFromArtifacts(context);
        if (!template?.bones) {
          throw adapterError('WORKFLOW_BLOCKED', 'modular-variants precisa do rig-template construído no passo anterior (build-rig).', { adapterId: 'rig2d-software' });
        }
        // Slots declarados pelo usuário prevalecem. Sem eles, cada peça do
        // template é um slot intercambiável e existe uma variante `default` com
        // as peças originais: nada é inventado, e a nota diz o que falta para
        // ter skins alternativas de verdade.
        const declaredSlots = params.slots ?? context.slots ?? null;
        const slots = declaredSlots ?? {
          default: Object.fromEntries(template.parts.map((part) => [part.id, part.id])),
        };
        const modular = createModularRig({ template, slots });
        outputs.push(await emit(params.output ?? 'modular-variants.json', Buffer.from(`${JSON.stringify(modular, null, 2)}\n`, 'utf8')));
        metrics.variants = Object.keys(modular.variants);
        metrics.slots = modular.slots;
        metrics.slotsDerived = declaredSlots === null;
        metrics.sharedAnimations = true;
        const note = metrics.slotsDerived
          ? `${metrics.variants.length} variante(s) sobre o mesmo rig, com ${metrics.slots.length} peça(s) marcadas como intercambiáveis. Nenhuma skin alternativa foi declarada: informe params.slots ({ variante: { peça: arquivo } }) para trocar as peças. Animações são compartilhadas, sem pipeline por variante.`
          : `${metrics.variants.length} variante(s) sobre o mesmo rig: animações compartilhadas, sem pipeline por variante.`;
        return { outputs, metrics, execution: { kind: 'process', provider: 'lia-forge-internal', task }, note };
      }

      throw adapterError('ADAPTER_MISCONFIGURED', `task desconhecida "${task ?? '(ausente)'}" em rig2d-software. Tasks válidas: estimate-skeleton, build-rig, animate, render, render-vfx, pack-atlas, modular-variants. Params recebidos: ${JSON.stringify(Object.keys(params))}.`, { adapterId: 'rig2d-software' });
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
  evidence: { tests: ['tests/glb-inspect-smoke.mjs', 'tests/orchestrator-engine-smoke.mjs'], validatedVersions: [INTERNAL_VERSION], executedOn: 'ambiente de desenvolvimento', state: 'executed', note: 'Executado sobre GLB de fixture construído byte a byte no teste.' },
  protectedActions: ['install_software', 'download_models_or_weights', 'cost', 'send_data'],
});

export function createGlbInspectAdapter() {
  return defineExecutionAdapter(GLB_INSPECT_MANIFEST, {
    discover: async () => internalDiscover('glb-inspect', 'Inspetor GLB interno presente no checkout.'),
    async execute(context = {}) {
      const emit = requireEmit(context, 'glb-inspect');
      const params = { ...(context.params ?? {}) };
      let bytes = context.bytes ?? context.model?.bytes ?? null;
      // Caminho relativo ao projeto (params.model): o modelo é do usuário, nada
      // é baixado aqui.
      if (!bytes && params.model && typeof context.readArtifact === 'function') {
        bytes = await context.readArtifact(params.model);
        if (!bytes) {
          throw adapterError('WORKFLOW_BLOCKED', `glb-inspect: o modelo "${params.model}" não foi encontrado dentro do projeto. Coloque o arquivo .glb na pasta do projeto e informe o caminho relativo.`, { adapterId: 'glb-inspect' });
        }
      }
      if (!bytes) {
        throw adapterError('WORKFLOW_BLOCKED', 'glb-inspect precisa de um modelo 3D do usuário: informe params.model com o caminho de um .glb dentro do projeto (nenhum modelo é baixado automaticamente).', { adapterId: 'glb-inspect' });
      }
      const maxBytes = params.maxBytes ?? 256 * 1024 * 1024;
      if (bytes.length > maxBytes) throw adapterError('ADAPTER_OUTPUT_INVALID', `GLB de ${(bytes.length / 1024 / 1024).toFixed(1)} MB excede o limite de inspeção de ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`, { adapterId: 'glb-inspect' });
      let info;
      try {
        info = inspectGlb(bytes);
      } catch (error) {
        throw adapterError('ADAPTER_OUTPUT_INVALID', error.message, { adapterId: 'glb-inspect' });
      }
      const outputs = [await emit(params.output ?? 'model-report.json', Buffer.from(`${JSON.stringify(info, null, 2)}\n`, 'utf8'))];
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
  backends: [{ kind: 'local-process', validated: true, note: 'Validado por tests/preflight-destinations-smoke.mjs (perfis) e executado em tests/production-pipeline-smoke.mjs e tests/studio-service-smoke.mjs (passo de entrega).' }],
  health: { status: 'available', detail: 'Perfis de destino presentes no checkout.' },
  evidence: { tests: ['tests/preflight-destinations-smoke.mjs', 'tests/production-pipeline-smoke.mjs', 'tests/studio-service-smoke.mjs'], validatedVersions: [INTERNAL_VERSION], executedOn: 'ambiente de desenvolvimento', state: 'executed', note: 'Executado em teste; nenhum import em engine de terceiros foi feito (não verificado no destino).' },
  protectedActions: ['install_software', 'download_models_or_weights', 'cost', 'send_data'],
});

export function createExportPackageAdapter({ hash }) {
  if (typeof hash !== 'function') throw adapterError('ADAPTER_MISCONFIGURED', 'export-package precisa de hash(bytes) injetado (SHA-256 no processo principal).', { adapterId: 'export-package' });
  return defineExecutionAdapter(EXPORT_PACKAGE_MANIFEST, {
    discover: async () => internalDiscover('export-package', `Perfis de destino disponíveis: ${listDestinations().map((item) => item.id).join(', ')}.`),
    async execute(context = {}) {
      const emit = requireEmit(context, 'export-package');
      const params = { ...(context.params ?? {}) };
      const destinationId = context.destination ?? params.destination;
      let artifacts = context.artifacts ?? [];
      // Sem lista explícita, exporta o que os passos anteriores produziram no
      // run (lido pelo `readArtifact` injetado, confinado à pasta do run).
      if (!artifacts.length && typeof context.readArtifact === 'function') {
        const seen = new Set();
        const sources = { ...(context.runOutputs ?? {}), ...(context.inputsById ?? {}) };
        for (const [stepId, input] of Object.entries(sources)) {
          for (const relative of input.outputs ?? []) {
            if (seen.has(relative)) continue;
            seen.add(relative);
            const bytes = await context.readArtifact(relative);
            if (!bytes) continue;
            artifacts.push({
              id: `${stepId}:${path.basename(relative)}`,
              format: path.extname(relative).slice(1).toLowerCase() || 'bin',
              role: stepId,
              relativePath: relative,
              bytes,
            });
          }
        }
      }
      if (!destinationId) throw adapterError('ADAPTER_MISCONFIGURED', 'export-package precisa do destino.', { adapterId: 'export-package' });
      let compatibility = checkDestinationCompatibility({ destinationId, artifacts });
      // Coleta automática: se o destino não aceitar algum formato intermediário
      // (ex.: JSON de camadas no Godot), exporta só os artefatos aceitos.
      if (!compatibility.compatible && !(context.artifacts ?? []).length) {
        const accepted = artifacts.filter((artifact) => checkDestinationCompatibility({ destinationId, artifacts: [artifact] }).compatible);
        if (accepted.length) {
          artifacts = accepted;
          compatibility = checkDestinationCompatibility({ destinationId, artifacts });
        }
      }
      if (!compatibility.compatible) {
        throw adapterError('ADAPTER_OUTPUT_INVALID', `Exportação para ${compatibility.label} bloqueada: ${[...compatibility.blockers, ...compatibility.conversionsNeeded.map((item) => `converter ${item.from}→${item.to} (${item.reason})`)].join('; ')}`, { adapterId: 'export-package', compatibility });
      }
      const bundle = buildExportBundle({ destinationId, artifacts, hash, asset: context.asset ?? null, workflowRunId: context.workflowRunId ?? null });
      const outputs = [await emit(params.output ?? `export/${destinationId}/manifest.json`, Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`, 'utf8'))];
      if (params.includeSequence && context.manifest?.frames) {
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
