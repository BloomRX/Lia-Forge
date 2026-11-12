/**
 * Rig 2D esquelético, animação e renderer de software (F7 — capacidades
 * `rig2d.build`, `rig2d.deform`, `rig2d.animate`, `rig2d.compose`).
 *
 * Puro (sem Node, sem canvas, sem dependências): produz pixels RGBA que o
 * processo principal grava em PNG e que o Studio mostra em preview.
 *
 * Limitações declaradas (nunca escondidas):
 * - o auto-rig é heurístico por posição/tamanho das partes; a revisão de juntas
 *   é gate humano (`needsReview: true`);
 * - a deformação é afim por osso (rotação/translação/escala), sem skinning
 *   suave de malha;
 * - o renderer usa splatting direto com ordem de desenho: ampliações grandes
 *   podem deixar lacunas de 1px (documentado em `limitations`).
 */

import { createImage, composeLayers, alphaBounds } from '../imaging/core.mjs';

export const RIG2D_SCHEMA_VERSION = 1;

export const BONE_ROLES = Object.freeze(['root', 'torso', 'head', 'arm-upper', 'arm-lower', 'hand', 'leg-upper', 'leg-lower', 'foot', 'tail', 'prop', 'other']);

export const limitations = Object.freeze([
  'auto-rig heurístico: a posição das juntas precisa de revisão humana',
  'deformação afim por osso, sem skinning suave',
  'renderer por splatting: ampliações grandes podem deixar lacunas de 1px',
]);

const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

function affine(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
  return { a, b, c, d, e, f };
}

function multiply(m, n) {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

function invert(m) {
  const determinant = m.a * m.d - m.b * m.c;
  if (Math.abs(determinant) < 1e-9) return null;
  return {
    a: m.d / determinant,
    b: -m.b / determinant,
    c: -m.c / determinant,
    d: m.a / determinant,
    e: (m.c * m.f - m.d * m.e) / determinant,
    f: (m.b * m.e - m.a * m.f) / determinant,
  };
}

function applyToPoint(m, x, y) {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
}

function rotationMatrix(degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return affine(cos, sin, -sin, cos, 0, 0);
}

function translationMatrix(x, y) {
  return affine(1, 0, 0, 1, x, y);
}

function scaleMatrix(x, y = x) {
  return affine(x, 0, 0, y, 0, 0);
}

function partAspect(part) {
  return part.height / Math.max(1, part.width);
}

/**
 * Estima um esqueleto a partir das partes separadas.
 * Heurística documentada: cabeça = parte superior pequena; torso = maior parte
 * central; braços = partes alongadas laterais; pernas = partes alongadas
 * inferiores. Nada é afirmado como correto — `needsReview` segue true.
 */
export function estimateSkeleton(parts, { canvasWidth, canvasHeight } = {}) {
  if (!Array.isArray(parts) || parts.length === 0) throw new TypeError('estimateSkeleton: parts must be a non-empty array');
  const width = canvasWidth ?? parts.reduce((max, part) => Math.max(max, part.x + part.width), 1);
  const height = canvasHeight ?? parts.reduce((max, part) => Math.max(max, part.y + part.height), 1);
  const centerX = width / 2;

  const scored = parts.map((part) => ({
    part,
    area: part.area ?? part.width * part.height,
    aspect: partAspect(part),
    relativeY: part.centroid ? part.centroid.y / height : (part.y + part.height / 2) / height,
    offsetX: part.centroid ? part.centroid.x - centerX : part.x + part.width / 2 - centerX,
  }));

  const torso = [...scored].sort((a, b) => b.area - a.area)[0];
  const head = [...scored]
    .filter((item) => item.part !== torso.part && item.relativeY < torso.relativeY)
    .sort((a, b) => a.relativeY - b.relativeY)[0] ?? null;

  const torsoBottom = (torso.part.y + torso.part.height) / height;
  const limbs = scored.filter((item) => item.part !== torso.part && item.part !== head?.part && item.aspect > 1.15);
  const isLeg = (item) => item.part.y / height >= torsoBottom - 0.15;
  const arms = limbs.filter((item) => !isLeg(item));
  const legs = limbs.filter(isLeg);
  const leftLimbs = arms.filter((item) => item.offsetX < 0).sort((a, b) => a.relativeY - b.relativeY);
  const rightLimbs = arms.filter((item) => item.offsetX >= 0).sort((a, b) => a.relativeY - b.relativeY);
  const legLimbs = legs.sort((a, b) => a.offsetX - b.offsetX);
  const extras = scored.filter((item) => !limbs.includes(item) && item.part !== torso.part && item.part !== head?.part);

  const bones = [];
  const rootPivot = [Math.round(centerX), Math.round(height)];
  bones.push({
    id: 'root',
    parent: null,
    role: 'root',
    partId: null,
    position: rootPivot,
    length: Math.round(height * 0.25),
    angle: 0,
  });

  const torsoPivot = torso.part.centroid ? [torso.part.centroid.x, torso.part.y + torso.part.height] : [Math.round(centerX), torso.part.y + torso.part.height];
  bones.push({
    id: 'torso',
    parent: 'root',
    role: 'torso',
    partId: torso.part.id,
    position: [Math.round(torsoPivot[0]), Math.round(torsoPivot[1])],
    length: torso.part.height,
    angle: 0,
  });

  if (head) {
    bones.push({
      id: 'head',
      parent: 'torso',
      role: 'head',
      partId: head.part.id,
      position: [Math.round(head.part.centroid?.x ?? head.part.x + head.part.width / 2), Math.round(head.part.y + head.part.height)],
      length: head.part.height,
      angle: 0,
    });
  }

  const armSlots = [
    { side: 'left', queue: leftLimbs },
    { side: 'right', queue: rightLimbs },
  ];
  for (const slot of armSlots) {
    const upper = slot.queue.shift();
    if (!upper) continue;
    const upperId = `arm-upper-${slot.side}`;
    bones.push({
      id: upperId,
      parent: 'torso',
      role: 'arm-upper',
      partId: upper.part.id,
      position: [Math.round(upper.part.x + upper.part.width / 2), Math.round(upper.part.y)],
      length: Math.round(upper.part.height / 2),
      angle: 0,
      side: slot.side,
    });
    const lower = slot.queue.shift();
    if (lower) {
      bones.push({
        id: `arm-lower-${slot.side}`,
        parent: upperId,
        role: 'arm-lower',
        partId: lower.part.id,
        position: [Math.round(lower.part.x + lower.part.width / 2), Math.round(lower.part.y)],
        length: lower.part.height,
        angle: 0,
        side: slot.side,
      });
    }
  }

  const legCandidates = legLimbs.length
    ? legLimbs
    : scored.filter((item) => item.relativeY > torso.relativeY && !bones.some((bone) => bone.partId === item.part.id));
  const legParts = legCandidates.filter((item) => !bones.some((bone) => bone.partId === item.part.id));
  for (const [index, leg] of legParts.slice(0, 2).entries()) {
    bones.push({
      id: `leg-${index === 0 ? 'left' : 'right'}`,
      parent: 'torso',
      role: 'leg-upper',
      partId: leg.part.id,
      position: [Math.round(leg.part.x + leg.part.width / 2), Math.round(leg.part.y)],
      length: leg.part.height,
      angle: 0,
      side: index === 0 ? 'left' : 'right',
    });
  }

  for (const extra of extras) {
    if (bones.some((bone) => bone.partId === extra.part.id)) continue;
    bones.push({
      id: `prop-${extra.part.id}`,
      parent: 'torso',
      role: 'prop',
      partId: extra.part.id,
      position: [Math.round(extra.part.centroid?.x ?? extra.part.x), Math.round(extra.part.centroid?.y ?? extra.part.y)],
      length: Math.max(1, Math.round(extra.part.height / 2)),
      angle: 0,
    });
  }

  return Object.freeze({
    schemaVersion: RIG2D_SCHEMA_VERSION,
    bones: Object.freeze(bones.map((bone) => Object.freeze({ ...bone }))),
    canvas: Object.freeze({ width, height }),
    needsReview: true,
    limitations,
  });
}

/** Monta o rig completo: esqueleto + partes + pesos simples por parte. */
export function createRig({ parts, skeleton = null, id = 'rig-2d', canvas = null }) {
  const estimated = skeleton ?? estimateSkeleton(parts, canvas ?? undefined);
  const partById = new Map(parts.map((part) => [part.id, part]));
  const skinning = {};
  for (const bone of estimated.bones) {
    if (!bone.partId) continue;
    const part = partById.get(bone.partId);
    if (!part) continue;
    skinning[bone.partId] = { [bone.id]: 1 };
  }
  const unparented = parts.filter((part) => !estimated.bones.some((bone) => bone.partId === part.id));
  return Object.freeze({
    schemaVersion: RIG2D_SCHEMA_VERSION,
    id,
    bones: estimated.bones,
    canvas: estimated.canvas,
    parts: Object.freeze(parts.map((part) => Object.freeze({
      id: part.id,
      x: part.x,
      y: part.y,
      width: part.width,
      height: part.height,
      drawOrder: part.drawOrder ?? 0,
      possiblyOccluded: part.possiblyOccluded ?? false,
      reconstruction: part.reconstruction ?? 'none',
    }))),
    skinning: Object.freeze(skinning),
    unparentedParts: Object.freeze(unparented.map((part) => part.id)),
    needsReview: true,
    limitations,
  });
}

/** Amostra uma animação em `timeMs` e devolve transforms por osso. */
export function samplePose(animation, timeMs) {
  if (!animation || !Array.isArray(animation.keyframes) || animation.keyframes.length === 0) {
    throw new TypeError('samplePose: animation without keyframes');
  }
  const duration = animation.durationMs ?? animation.keyframes[animation.keyframes.length - 1].time;
  const loop = animation.loop !== false;
  let time = duration > 0 ? timeMs % duration : 0;
  if (!loop) time = Math.min(timeMs, duration);
  const pose = {};
  const byBone = new Map();
  for (const key of animation.keyframes) {
    if (!byBone.has(key.bone)) byBone.set(key.bone, []);
    byBone.get(key.bone).push(key);
  }
  for (const [boneId, keys] of byBone) {
    const sorted = [...keys].sort((a, b) => a.time - b.time);
    let previous = sorted[0];
    let next = sorted[sorted.length - 1];
    for (let index = 0; index < sorted.length - 1; index += 1) {
      if (time >= sorted[index].time && time <= sorted[index + 1].time) {
        previous = sorted[index];
        next = sorted[index + 1];
        break;
      }
    }
    const span = next.time - previous.time;
    const factor = span > 0 ? (time - previous.time) / span : 0;
    const lerp = (from = 0, to = 0) => from + (to - from) * factor;
    pose[boneId] = {
      rotation: lerp(previous.rotation ?? 0, next.rotation ?? 0),
      translation: [lerp(previous.translation?.[0] ?? 0, next.translation?.[0] ?? 0), lerp(previous.translation?.[1] ?? 0, next.translation?.[1] ?? 0)],
      scale: [lerp(previous.scale?.[0] ?? 1, next.scale?.[0] ?? 1), lerp(previous.scale?.[1] ?? 1, next.scale?.[1] ?? 1)],
    };
  }
  return pose;
}

function easeInOut(factor) {
  return 0.5 - Math.cos(factor * Math.PI * 2) / 2;
}

/**
 * Ações padrão geradas proceduralmente, com ciclo fechado (o último keyframe
 * volta ao primeiro) para passar no validador `animation-loop`.
 */
export function createPresetAnimation(name, { bones, amplitudeScale = 1 } = {}) {
  const frames = 8;
  const durationMs = 800;
  const keyframes = [];
  const push = (time, bone, rotation, translation = [0, 0]) => keyframes.push({ time, bone, rotation, translation });
  const has = (id) => !bones || bones.some((bone) => bone.id === id);

  const presets = {
    idle: () => {
      for (let index = 0; index <= frames; index += 1) {
        const time = (durationMs / frames) * index;
        const breath = Math.sin((index / frames) * Math.PI * 2) * 1.5 * amplitudeScale;
        if (has('torso')) push(time, 'torso', breath, [0, Math.sin((index / frames) * Math.PI * 2) * 0.6]);
        if (has('head')) push(time, 'head', -breath * 0.6);
        if (has('arm-upper-left')) push(time, 'arm-upper-left', breath * 0.8);
        if (has('arm-upper-right')) push(time, 'arm-upper-right', -breath * 0.8);
      }
    },
    walk: () => {
      for (let index = 0; index <= frames; index += 1) {
        const time = (durationMs / frames) * index;
        const swing = Math.sin((index / frames) * Math.PI * 2) * 22 * amplitudeScale;
        if (has('leg-left')) push(time, 'leg-left', swing);
        if (has('leg-right')) push(time, 'leg-right', -swing);
        if (has('arm-upper-left')) push(time, 'arm-upper-left', -swing * 0.7);
        if (has('arm-upper-right')) push(time, 'arm-upper-right', swing * 0.7);
        if (has('torso')) push(time, 'torso', 0, [0, -Math.abs(Math.sin((index / frames) * Math.PI * 2)) * 1.5]);
      }
    },
    run: () => {
      for (let index = 0; index <= frames; index += 1) {
        const time = (durationMs / frames) * index;
        const swing = Math.sin((index / frames) * Math.PI * 2) * 38 * amplitudeScale;
        if (has('leg-left')) push(time, 'leg-left', swing);
        if (has('leg-right')) push(time, 'leg-right', -swing);
        if (has('arm-upper-left')) push(time, 'arm-upper-left', -swing * 0.9);
        if (has('arm-upper-right')) push(time, 'arm-upper-right', swing * 0.9);
        if (has('torso')) push(time, 'torso', 4 * amplitudeScale, [0, -Math.abs(Math.sin((index / frames) * Math.PI * 2)) * 3]);
      }
    },
    attack: () => {
      const steps = [0, 0.15, 0.35, 0.6, 1];
      const armAngle = [0, -55, 70, 25, 0];
      for (let index = 0; index < steps.length; index += 1) {
        const time = durationMs * steps[index];
        if (has('arm-upper-right')) push(time, 'arm-upper-right', armAngle[index] * amplitudeScale);
        if (has('torso')) push(time, 'torso', armAngle[index] * 0.12 * amplitudeScale);
      }
      // fecha o ciclo no mesmo valor do primeiro keyframe
      if (has('arm-upper-right')) push(durationMs, 'arm-upper-right', 0);
      if (has('torso')) push(durationMs, 'torso', 0);
    },
  };

  const build = presets[name];
  if (!build) throw new TypeError(`createPresetAnimation: ação desconhecida "${name}" (use idle, walk, run ou attack)`);
  build();
  const deduped = new Map();
  for (const key of keyframes) deduped.set(`${key.bone}@${key.time}`, key);
  const sorted = [...deduped.values()].sort((a, b) => (a.time - b.time) || a.bone.localeCompare(b.bone));
  return Object.freeze({
    name,
    loop: name !== 'attack',
    durationMs,
    frameCount: frames,
    keyframes: Object.freeze(sorted.map((key) => Object.freeze({ ...key }))),
    generated: true,
    note: 'Ciclo procedural editável: ajuste os keyframes no Studio antes de exportar.',
  });
}

/** Aplica a pose ao rig e devolve o transform mundial de cada osso. */
export function computeBoneTransforms(rig, pose = {}) {
  const byId = new Map(rig.bones.map((bone) => [bone.id, bone]));
  const transforms = new Map();
  const resolve = (boneId, guard = 0) => {
    if (transforms.has(boneId)) return transforms.get(boneId);
    if (guard > rig.bones.length) throw new Error(`computeBoneTransforms: ciclo na hierarquia em ${boneId}`);
    const bone = byId.get(boneId);
    if (!bone) throw new Error(`computeBoneTransforms: osso desconhecido ${boneId}`);
    const local = pose[boneId] ?? { rotation: 0, translation: [0, 0], scale: [1, 1] };
    // `bone.position` é absoluto no canvas. Para herdar a rotação do pai sem
    // somar a translação duas vezes, o pivô é convertido para o espaço do pai.
    const parentWorld = bone.parent ? resolve(bone.parent, guard + 1) : IDENTITY;
    const parentInverse = invert(parentWorld) ?? IDENTITY;
    const pivot = applyToPoint(
      parentInverse,
      bone.position[0] + (local.translation?.[0] ?? 0),
      bone.position[1] + (local.translation?.[1] ?? 0),
    );
    const localMatrix = multiply(
      translationMatrix(pivot[0], pivot[1]),
      multiply(scaleMatrix(local.scale[0], local.scale[1]), rotationMatrix(local.rotation)),
    );
    const world = multiply(parentWorld, localMatrix);
    transforms.set(boneId, world);
    return world;
  };
  for (const bone of rig.bones) resolve(bone.id);
  return transforms;
}

/**
 * Renderiza um frame: cada parte é desenhada com o transform do osso, em ordem
 * de desenho (fundo → frente), com blending de alpha.
 */
export function renderFrame({ rig, partImages, pose = {}, width = null, height = null, background = null, offset = [0, 0] }) {
  const canvasWidth = width ?? rig.canvas.width;
  const canvasHeight = height ?? rig.canvas.height;
  const canvas = createImage(canvasWidth, canvasHeight, background ?? [0, 0, 0, 0]);
  const transforms = computeBoneTransforms(rig, pose);
  const boneByPart = new Map(rig.bones.filter((bone) => bone.partId).map((bone) => [bone.partId, bone]));

  const ordered = [...rig.parts].sort((a, b) => (b.drawOrder ?? 0) - (a.drawOrder ?? 0));
  for (const part of ordered) {
    const image = partImages[part.id];
    if (!image) continue;
    const bone = boneByPart.get(part.id);
    const world = bone ? transforms.get(bone.id) : affine(1, 0, 0, 1, part.x, part.y);
    if (!world) continue;
    // A parte é expressa no espaço do osso: o pivô do osso fica na origem local
    // da parte, então o transform aplicado é world ∘ translate(-pivotLocal).
    const pivotLocal = bone ? [bone.position[0] - part.x, bone.position[1] - part.y] : [0, 0];
    const forward = bone ? multiply(world, translationMatrix(-pivotLocal[0], -pivotLocal[1])) : translationMatrix(part.x, part.y);
    const inverse = invert(forward);
    if (!inverse) continue;
    const targetX0 = Math.max(0, Math.floor(Math.min(...corners(forward, image).map((point) => point[0]))));
    const targetY0 = Math.max(0, Math.floor(Math.min(...corners(forward, image).map((point) => point[1]))));
    const targetX1 = Math.min(canvasWidth - 1, Math.ceil(Math.max(...corners(forward, image).map((point) => point[0]))));
    const targetY1 = Math.min(canvasHeight - 1, Math.ceil(Math.max(...corners(forward, image).map((point) => point[1]))));
    for (let y = targetY0; y <= targetY1; y += 1) {
      for (let x = targetX0; x <= targetX1; x += 1) {
        const [sourceX, sourceY] = applyToPoint(inverse, x - offset[0], y - offset[1]);
        const sx = Math.round(sourceX);
        const sy = Math.round(sourceY);
        if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
        const source = (sy * image.width + sx) * 4;
        const sourceAlpha = image.rgba[source + 3] / 255;
        if (sourceAlpha <= 0) continue;
        const target = (y * canvasWidth + x) * 4;
        const destAlpha = canvas.rgba[target + 3] / 255;
        const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
        for (let channel = 0; channel < 3; channel += 1) {
          canvas.rgba[target + channel] = outAlpha === 0
            ? 0
            : Math.round((image.rgba[source + channel] * sourceAlpha + canvas.rgba[target + channel] * destAlpha * (1 - sourceAlpha)) / outAlpha);
        }
        canvas.rgba[target + 3] = Math.round(outAlpha * 255);
      }
    }
  }
  return canvas;
}

function corners(matrix, image) {
  return [
    applyToPoint(matrix, 0, 0),
    applyToPoint(matrix, image.width, 0),
    applyToPoint(matrix, 0, image.height),
    applyToPoint(matrix, image.width, image.height),
  ];
}

/** Renderiza todos os frames de uma animação. */
export function renderAnimation({ rig, partImages, animation, frameCount = 8, width = null, height = null, background = null }) {
  const frames = [];
  for (let index = 0; index < frameCount; index += 1) {
    const time = (animation.durationMs / frameCount) * index;
    frames.push(renderFrame({ rig, partImages, pose: samplePose(animation, time), width, height, background }));
  }
  return frames;
}

/**
 * Personagem modular: um rig-template com peças intercambiáveis por slot.
 * As animações são compartilhadas entre variantes — não existe um pipeline por
 * variante (regra anti-proliferação da T12).
 */
export function createModularRig({ template, slots }) {
  if (!template || !Array.isArray(template.bones)) throw new TypeError('createModularRig: template must be a rig');
  if (!slots || typeof slots !== 'object') throw new TypeError('createModularRig: slots must be an object of slot → part ids');
  const variants = {};
  for (const [variantId, assignment] of Object.entries(slots)) {
    const parts = template.parts.map((part) => ({ ...part }));
    for (const [slotName, partId] of Object.entries(assignment)) {
      const target = parts.find((part) => part.slot === slotName || part.id === slotName);
      if (!target) throw new TypeError(`createModularRig: slot desconhecido "${slotName}" na variante "${variantId}"`);
      target.id = partId;
      target.variantOf = slotName;
    }
    variants[variantId] = Object.freeze({
      id: `${template.id}:${variantId}`,
      templateId: template.id,
      variantId,
      parts: Object.freeze(parts),
      bones: template.bones,
      animations: template.animations ?? [],
      sharedAnimations: true,
    });
  }
  return Object.freeze({ schemaVersion: RIG2D_SCHEMA_VERSION, templateId: template.id, slots: Object.freeze(Object.keys(slots)), variants: Object.freeze(variants) });
}

export { composeLayers, alphaBounds, createImage, affine, multiply, invert, rotationMatrix, translationMatrix, scaleMatrix, easeInOut };
