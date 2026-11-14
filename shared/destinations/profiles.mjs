/**
 * Perfis de compatibilidade por destino e pacote de exportação
 * (F7 — capacidade `export.engine`).
 *
 * Regra da T12 preservada: **não existe pipeline por consumidor**. A geração é
 * uma só; o destino entra como perfil que descreve escala, eixos, unidades,
 * FPS, pivô e notas de importação. Nenhum valor de destino é inventado: o que
 * não foi verificado fica `null` com `verified: false`.
 *
 * `buildExportBundle` é puro: o hash dos artefatos é injetado pelo chamador
 * (Node usa SHA-256 do `node:crypto`), então o mesmo código roda no Studio.
 */

import { isDeclaredPathContained } from '../fs/path-containment.mjs';

export const DESTINATION_PROFILE_SCHEMA_VERSION = 1;

export const DESTINATIONS = Object.freeze([
  {
    id: 'godot-4',
    label: 'Godot 4.x',
    kind: 'engine',
    verified: false,
    units: 'pixel',
    axes: 'y-down',
    scaleConvention: '1 unidade = 1 pixel (Pixel Snap recomendado)',
    fps: 60,
    pivot: 'bottom-center',
    spriteFormats: ['png'],
    modelFormats: ['glb'],
    animationImport: 'SpriteFrames / AnimationPlayer',
    rootMotion: 'não declarado pelo formato de spritesheet',
    importNotes: 'Importe o PNG como SpriteFrames e use o manifesto JSON para pivôs e durações. Em Godot, Y aponta para baixo, igual ao atlas gerado.',
    licenseNote: 'Godot é MIT; exportar para ele não altera a licença dos seus assets.',
    evidence: 'Perfil derivado do contrato de spritesheet existente (384×144, 8×3, 48×48). Nenhum import real foi executado nesta base de código.',
  },
  {
    id: 'unity-2d',
    label: 'Unity (2D)',
    kind: 'engine',
    verified: false,
    units: 'pixel-per-unit',
    axes: 'y-up',
    scaleConvention: 'Pixels Per Unit = altura do frame (48) para escala 1:1',
    fps: 60,
    pivot: 'bottom-center',
    spriteFormats: ['png'],
    modelFormats: ['fbx', 'glb', 'obj'],
    animationImport: 'Sprite Editor (Multiple) + Animator',
    rootMotion: 'decidido no Animator, não no atlas',
    importNotes: 'No Sprite Editor use modo Multiple, grid 8×3 de 48×48 e pivô Bottom. O eixo Y do Unity aponta para cima: a ordem dos frames do atlas não muda, mas a posição do sprite sim.',
    licenseNote: 'Unity tem termos próprios de engine; a exportação não transfere direitos dos seus assets.',
    evidence: 'Não verificado em projeto Unity real nesta base de código.',
  },
  {
    id: 'unreal-2d',
    label: 'Unreal (Paper2D)',
    kind: 'engine',
    verified: false,
    units: 'pixel',
    axes: 'y-up',
    scaleConvention: 'Pixels Per Unit no import do Paper2D',
    fps: 60,
    pivot: 'bottom-center',
    spriteFormats: ['png'],
    modelFormats: ['fbx', 'obj'],
    animationImport: 'Paper2D Flipbook',
    rootMotion: 'Root Motion no Animation Blueprint (3D); em flipbook é manual',
    importNotes: 'Use Extract Sprites no Paper2D com grid 8 colunas × 3 linhas. GLB não é formato nativo de import do Unreal: converta para FBX antes.',
    licenseNote: 'Unreal tem EULA próprio; nada aqui afirma compatibilidade legal.',
    evidence: 'Não verificado em projeto Unreal real nesta base de código.',
  },
  {
    id: 'lia-desktop',
    label: 'Lia Desktop (app existente)',
    kind: 'app',
    verified: true,
    units: 'pixel',
    axes: 'y-down',
    scaleConvention: '1 unidade = 1 pixel',
    fps: 12,
    pivot: 'feet (character) / center (item)',
    spriteFormats: ['png'],
    modelFormats: ['blend', 'glb', 'gltf', 'fbx', 'obj', 'stl'],
    animationImport: '.lia.json + pasta de artefatos por estágio',
    rootMotion: 'não aplicável',
    importNotes: 'Formato nativo do produto: `.lia.json` com estágios e artefatos, atlas 8×3 com pivô em `feet`. É o único destino cuja estrutura foi verificada por testes neste checkout.',
    licenseNote: 'Mesmo projeto; nenhuma licença externa envolvida.',
    evidence: 'Contrato verificado por tests/workflow-runner-smoke.cjs e electron/manual-artifacts.cjs.',
  },
  {
    id: 'web-canvas',
    label: 'Web (canvas/PixiJS-like)',
    kind: 'runtime',
    verified: false,
    units: 'pixel',
    axes: 'y-down',
    scaleConvention: '1 unidade = 1 pixel CSS',
    fps: 60,
    pivot: 'bottom-center',
    spriteFormats: ['png', 'webp'],
    modelFormats: ['glb'],
    animationImport: 'atlas + JSON de frames',
    rootMotion: 'não aplicável',
    importNotes: 'Use o manifesto JSON como source of truth de frames: x/y/width/height/pivot/durationMs. Y aponta para baixo, como no canvas.',
    licenseNote: 'Depende da biblioteca escolhida pelo usuário; nenhuma é incluída aqui.',
    evidence: 'Não verificado em runtime web de terceiros.',
  },
  {
    id: 'video-timeline',
    label: 'Vídeo / timeline',
    kind: 'media',
    verified: false,
    units: 'pixel',
    axes: 'y-down',
    scaleConvention: 'resolução do quadro do projeto',
    fps: 24,
    pivot: 'center',
    spriteFormats: ['png'],
    modelFormats: [],
    animationImport: 'sequência de frames numerados',
    rootMotion: 'não aplicável',
    importNotes: 'Para timeline prefira sequência de frames numerados (export.sequence) em vez de atlas; FPS do projeto deve bater com durationMs do manifesto.',
    licenseNote: 'Direitos dos assets continuam com você; trilha/encoder são escolha do usuário.',
    evidence: 'Não verificado em editor de vídeo real.',
  },
]);

export const METADATA_FORMATS = Object.freeze(['json', 'txt', 'md', 'csv', 'yaml']);
/**
 * Papéis que já foram usados para reconhecer sidecar. Mantido publicado porque
 * faz parte do contrato do módulo, mas **não decide mais** a classificação: quem
 * produz o pacote informa o passo de origem como `role` (`render`, `rig`,
 * `deliver`…), e exigir um papel específico fazia o mesmo pacote ser "compatível"
 * num caminho e "bloqueado" noutro. O que define metadado é o formato do arquivo.
 */
export const METADATA_ROLES = Object.freeze(['manifest', 'metadata', 'sidecar', 'report']);

export function listDestinations() {
  return DESTINATIONS;
}

export function resolveDestination(destinationId) {
  const found = DESTINATIONS.find((destination) => destination.id === destinationId);
  if (!found) {
    throw new TypeError(`destination-profile: destino desconhecido "${destinationId}" (disponíveis: ${DESTINATIONS.map((item) => item.id).join(', ')})`);
  }
  return found;
}

/**
 * Verifica se os artefatos produzidos atendem ao perfil do destino.
 * Nunca "adivinha" conversão: se o formato não está no perfil, é bloqueio.
 */
export function checkDestinationCompatibility({ destinationId, artifacts = [] }) {
  const profile = resolveDestination(destinationId);
  const blockers = [];
  const conversions = [];
  const accepted = [];

  for (const artifact of artifacts) {
    const format = String(artifact.format ?? '').toLowerCase();
    if (!format) {
      blockers.push(`${artifact.id ?? 'artefato'}: formato não declarado`);
      continue;
    }
    const isSprite = profile.spriteFormats.includes(format);
    const isModel = profile.modelFormats.includes(format);
    if (isSprite || isModel) {
      accepted.push({ id: artifact.id ?? format, format });
      continue;
    }
    // Sidecar de metadados (manifesto da folha, rig, camadas, animações, notas de
    // importação) acompanha qualquer destino: não é asset que a engine importa, é
    // dado sobre o asset — e sem ele o pacote perde justamente a informação de
    // grade, pivô e fps. A classificação é pelo **formato**, nunca pelo passo que
    // produziu o arquivo.
    if (METADATA_FORMATS.includes(format)) {
      accepted.push({ id: artifact.id ?? format, format, role: 'metadata', sourceRole: artifact.role ?? null });
      continue;
    }
    if (format === 'glb' && profile.modelFormats.includes('fbx')) {
      conversions.push({ id: artifact.id ?? format, from: 'glb', to: 'fbx', reason: `${profile.label} não importa GLB diretamente` });
      continue;
    }
    blockers.push(`${artifact.id ?? format}: formato "${format}" não é aceito por ${profile.label} (${[...profile.spriteFormats, ...profile.modelFormats].join(', ') || 'nenhum'})`);
  }

  const metadata = accepted.filter((item) => item.role === 'metadata');
  const assetFiles = accepted.filter((item) => item.role !== 'metadata');
  return Object.freeze({
    destinationId: profile.id,
    label: profile.label,
    compatible: blockers.length === 0 && conversions.length === 0,
    accepted: Object.freeze(accepted),
    // Separados para a interface dizer o que é asset importável e o que é dado
    // sobre o asset: "7 arquivos aceitos" esconde que só 2 entram na engine.
    assets: Object.freeze(assetFiles),
    metadata: Object.freeze(metadata),
    conversionsNeeded: Object.freeze(conversions),
    blockers: Object.freeze(blockers),
    summary: Object.freeze({
      assets: assetFiles.length,
      metadata: metadata.length,
      conversions: conversions.length,
      blockers: blockers.length,
    }),
    verified: profile.verified,
    fps: profile.fps,
    pivot: profile.pivot,
    importNotes: profile.importNotes,
  });
}

/**
 * Monta o pacote de exportação (manifesto + arquivos + notas de importação).
 * `hash` é injetado: `(bytes) => hex` (Node: SHA-256).
 */
export function buildExportBundle({ destinationId, artifacts = [], hash, asset = null, workflowRunId = null, rights = null, generatedAt = new Date().toISOString() }) {
  const profile = resolveDestination(destinationId);
  if (typeof hash !== 'function') throw new TypeError('buildExportBundle: hash function is required (SHA-256 in Node)');
  const compatibility = checkDestinationCompatibility({ destinationId, artifacts });

  const files = [];
  for (const artifact of artifacts) {
    if (!artifact?.bytes) continue;
    const declared = artifact.relativePath ?? artifact.path ?? artifact.id ?? 'artifact';
    // Confinamento do pacote (auditoria P0, item 2): o caminho declarado entra no
    // manifesto que outra ferramenta/pessoa vai usar para materializar arquivos.
    // Um caminho absoluto ou com ".." entregaria conteúdo de fora da pasta do run
    // (ou de fora do projeto) sem que ninguém tivesse autorizado. A conferência é
    // por caminho relativo normalizado, não por prefixo de string.
    const contained = isDeclaredPathContained(declared);
    if (!contained.ok) {
      throw new Error(`buildExportBundle: o caminho declarado do artefato "${declared}" ${contained.reason}; o pacote só aceita caminhos relativos dentro da raiz do run. Nada foi empacotado.`);
    }
    files.push({
      path: contained.normalized,
      role: artifact.role ?? 'asset',
      format: artifact.format ?? 'bin',
      bytes: artifact.bytes.length,
      sha256: hash(artifact.bytes),
    });
  }
  if (!files.length) throw new Error('buildExportBundle: nenhum artefato com bytes para exportar');

  return Object.freeze({
    schemaVersion: DESTINATION_PROFILE_SCHEMA_VERSION,
    destination: profile.id,
    label: profile.label,
    profile: Object.freeze({
      units: profile.units,
      axes: profile.axes,
      scaleConvention: profile.scaleConvention,
      fps: profile.fps,
      pivot: profile.pivot,
      spriteFormats: profile.spriteFormats,
      modelFormats: profile.modelFormats,
      animationImport: profile.animationImport,
      rootMotion: profile.rootMotion,
    }),
    asset: asset ? Object.freeze({ id: asset.id ?? null, name: asset.name ?? null, type: asset.type ?? null }) : null,
    // Direitos que autorizaram esta exportação (P0-3 da revisão integrada).
    // `null` = nenhum asset vinculado ao run, ou seja, nada foi declarado: o
    // manifesto diz isso em vez de deixar quem recebe supor que está liberado.
    rights: rights
      ? Object.freeze({
        state: rights.state ?? null,
        licenses: Object.freeze([...(rights.licenses ?? [])]),
        redistributable: rights.redistributable === true,
        declaredBy: rights.declaredBy ?? null,
        declaredAt: rights.declaredAt ?? null,
        blockers: Object.freeze([...(rights.blockers ?? [])]),
        note: rights.note ?? null,
      })
      : null,
    workflowRunId,
    files: Object.freeze(files),
    compatibility,
    importNotes: profile.importNotes,
    licenseNote: profile.licenseNote,
    evidence: profile.evidence,
    verifiedOnDestination: profile.verified,
    generatedAt,
  });
}

/**
 * Ajusta um manifesto de spritesheet para o destino sem reescrever pixels:
 * devolve uma camada de metadados (escala, pivô, fps) que o destino entende.
 */
export function adaptSpritesheetManifestForDestination({ manifest, destinationId }) {
  const profile = resolveDestination(destinationId);
  // `durationMs` é tempo de relógio: não é reescalado. Reescalar inventaria uma
  // conversão de velocidade que ninguém pediu. O que o destino recebe é a
  // sugestão de intervalo por frame no FPS dele, junto com a nota de importação.
  return Object.freeze({
    destination: profile.id,
    frameWidth: manifest.frameWidth,
    frameHeight: manifest.frameHeight,
    columns: manifest.columns,
    rows: manifest.rows,
    pivot: profile.pivot,
    axes: profile.axes,
    fps: profile.fps,
    sourceFps: manifest.fps ?? null,
    destinationFrameDelayMs: profile.fps ? Math.round((1000 / profile.fps) * 100) / 100 : null,
    frames: Object.freeze((manifest.frames ?? []).map((frame) => Object.freeze({
      ...frame,
      pivotHint: profile.pivot,
    }))),
    importNotes: profile.importNotes,
    pixelDataUnchanged: true,
    timingUnchanged: true,
    note: 'Nenhum pixel nem nenhuma duração foi alterada; apenas metadados de importação e a sugestão de intervalo por frame no FPS do destino.',
  });
}
