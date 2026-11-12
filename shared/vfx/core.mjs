/**
 * VFX 2D procedurais (F7 — capacidade `vfx2d.generate`).
 *
 * Gera spritesheets de efeito (explosão, fogo, faísca, fumaça, impacto, raio)
 * de forma determinística: mesma semente → mesmos pixels. Não usa IA nem
 * bibliotecas externas, e não pretende substituir direção de arte — o objetivo
 * é produzir material utilizável e inspecionável quando não há ferramenta
 * instalada, com parâmetros visíveis na interface.
 *
 * Puro: devolve imagens RGBA que `shared/imaging/png-io.mjs` grava em PNG.
 */

import { createImage, packAtlas } from '../imaging/core.mjs';

export const VFX_PRESETS = Object.freeze(['explosion', 'fire', 'spark', 'smoke', 'impact', 'lightning']);

/** PRNG determinístico (mulberry32) — reprodutível por semente. */
export function createRandom(seed = 1) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let index = 0; index < String(text).length; index += 1) {
    hash ^= String(text).charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function radialField(size, { cx = 0.5, cy = 0.5, radius = 0.5, hardness = 1 } = {}) {
  const values = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) / size - cx;
      const dy = (y + 0.5) / size - cy;
      const distance = Math.sqrt(dx * dx + dy * dy) / radius;
      values[y * size + x] = Math.max(0, 1 - distance) ** hardness;
    }
  }
  return values;
}

function writePixel(image, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const index = (y * image.width + x) * 4;
  const sourceAlpha = a / 255;
  const destAlpha = image.rgba[index + 3] / 255;
  const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) return;
  for (const [channel, value] of [[0, r], [1, g], [2, b]]) {
    image.rgba[index + channel] = Math.round((value * sourceAlpha + image.rgba[index + channel] * destAlpha * (1 - sourceAlpha)) / outAlpha);
  }
  image.rgba[index + 3] = Math.round(outAlpha * 255);
}

function renderExplosion({ size, factor, random, palette }) {
  const image = createImage(size, size);
  const progress = factor;
  const radius = size * (0.12 + progress * 0.42);
  const field = radialField(size, { radius: radius / size, hardness: 1.4 });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const base = field[y * size + x];
      if (base <= 0) continue;
      const noise = 0.6 + random() * 0.4;
      const intensity = Math.min(1, base * noise * (1.15 - progress * 0.55));
      if (intensity <= 0.02) continue;
      const color = sampleRamp(palette, intensity);
      writePixel(image, x, y, color[0], color[1], color[2], Math.round(intensity * 255 * (1 - progress * 0.35)));
    }
  }
  // detritos
  const debris = Math.round(6 + progress * 18);
  for (let index = 0; index < debris; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = radius * (0.4 + random() * 0.9) * (0.4 + progress);
    const x = Math.round(size / 2 + Math.cos(angle) * distance);
    const y = Math.round(size / 2 + Math.sin(angle) * distance);
    const color = sampleRamp(palette, 0.5 + random() * 0.5);
    writePixel(image, x, y, color[0], color[1], color[2], Math.round(255 * (1 - progress * 0.7)));
  }
  return image;
}

function renderFire({ size, factor, random, palette }) {
  const image = createImage(size, size);
  const flicker = 0.75 + Math.sin(factor * Math.PI * 2) * 0.25;
  for (let x = 0; x < size; x += 1) {
    const columnNoise = 0.6 + random() * 0.4;
    const height = size * (0.25 + 0.55 * columnNoise * flicker) * (1 - Math.abs(x / size - 0.5) * 0.9);
    for (let y = size - 1; y > size - 1 - height; y -= 1) {
      const lifeFactor = (size - 1 - y) / Math.max(1, height);
      const intensity = (1 - lifeFactor) * columnNoise * flicker;
      if (intensity <= 0.03) continue;
      const color = sampleRamp(palette, intensity);
      writePixel(image, x, y, color[0], color[1], color[2], Math.round(intensity * 255));
    }
  }
  return image;
}

function renderSpark({ size, factor, random, palette }) {
  const image = createImage(size, size);
  const rays = 10;
  for (let index = 0; index < rays; index += 1) {
    const angle = (index / rays) * Math.PI * 2 + factor * Math.PI * 0.5;
    const length = size * (0.15 + random() * 0.35) * (0.4 + factor);
    for (let step = 0; step < length; step += 1) {
      const x = Math.round(size / 2 + Math.cos(angle) * step);
      const y = Math.round(size / 2 + Math.sin(angle) * step);
      const intensity = 1 - step / length;
      const color = sampleRamp(palette, intensity);
      writePixel(image, x, y, color[0], color[1], color[2], Math.round(intensity * 255));
    }
  }
  const core = radialField(size, { radius: 0.16, hardness: 2 });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = core[y * size + x];
      if (value <= 0) continue;
      const color = sampleRamp(palette, 1);
      writePixel(image, x, y, color[0], color[1], color[2], Math.round(value * 255));
    }
  }
  return image;
}

function renderSmoke({ size, factor, random, palette }) {
  const image = createImage(size, size);
  const puffs = 26;
  for (let index = 0; index < puffs; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = size * 0.06 + random() * size * 0.28 * (0.4 + factor);
    const cx = 0.5 + (Math.cos(angle) * distance) / size;
    const cy = 0.55 - (factor * 0.3) + (Math.sin(angle) * distance) / size;
    const radius = (0.08 + random() * 0.14) * (0.6 + factor);
    const field = radialField(size, { cx, cy, radius, hardness: 1.6 });
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const value = field[y * size + x] * (1 - factor * 0.6);
        if (value <= 0.02) continue;
        const color = sampleRamp(palette, 0.3 + random() * 0.2);
        writePixel(image, x, y, color[0], color[1], color[2], Math.round(value * 190));
      }
    }
  }
  return image;
}

function renderImpact({ size, factor, random, palette }) {
  const image = createImage(size, size);
  const ringRadius = size * (0.1 + factor * 0.4);
  const thickness = Math.max(1, size * 0.05 * (1 - factor * 0.6));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const delta = Math.abs(distance - ringRadius);
      if (delta > thickness) continue;
      const intensity = (1 - delta / thickness) * (1 - factor * 0.7);
      const color = sampleRamp(palette, intensity);
      writePixel(image, x, y, color[0], color[1], color[2], Math.round(intensity * 255));
    }
  }
  const shards = 8;
  for (let index = 0; index < shards; index += 1) {
    const angle = (index / shards) * Math.PI * 2 + random() * 0.2;
    const length = size * 0.1 * (0.5 + factor);
    for (let step = 0; step < length; step += 1) {
      const x = Math.round(size / 2 + Math.cos(angle) * (ringRadius + step));
      const y = Math.round(size / 2 + Math.sin(angle) * (ringRadius + step));
      const color = sampleRamp(palette, 1 - step / length);
      writePixel(image, x, y, color[0], color[1], color[2], Math.round(255 * (1 - step / length) * (1 - factor)));
    }
  }
  return image;
}

function renderLightning({ size, factor, random, palette }) {
  const image = createImage(size, size);
  const branches = 3;
  for (let branch = 0; branch < branches; branch += 1) {
    let x = size / 2 + (branch - 1) * size * 0.08;
    let y = size * 0.05;
    const targetY = size * (0.55 + factor * 0.4);
    while (y < targetY) {
      x += (random() - 0.5) * size * 0.14;
      const nextY = Math.min(targetY, y + size * 0.05);
      const steps = Math.max(1, Math.round(nextY - y));
      for (let step = 0; step <= steps; step += 1) {
        const px = Math.round(x + ((nextY - y) ? 0 : 0));
        const py = Math.round(y + step);
        const intensity = 1 - (py / size) * 0.4;
        const color = sampleRamp(palette, intensity);
        writePixel(image, px, py, color[0], color[1], color[2], 255);
        if (px + 1 < size) writePixel(image, px + 1, py, color[0], color[1], color[2], 140);
        if (px - 1 >= 0) writePixel(image, px - 1, py, color[0], color[1], color[2], 140);
      }
      y = nextY;
    }
  }
  return image;
}

const PALETTES = Object.freeze({
  explosion: [[255, 255, 220], [255, 200, 80], [255, 110, 40], [150, 40, 30], [40, 20, 20]],
  fire: [[255, 250, 200], [255, 190, 60], [240, 110, 30], [140, 40, 20]],
  spark: [[255, 255, 255], [200, 230, 255], [120, 180, 255], [60, 90, 200]],
  smoke: [[220, 220, 225], [160, 160, 170], [100, 100, 112], [50, 50, 58]],
  impact: [[255, 255, 255], [255, 220, 160], [255, 150, 90], [120, 60, 40]],
  lightning: [[255, 255, 255], [210, 225, 255], [150, 175, 255], [90, 110, 220]],
  neon: [[255, 240, 255], [241, 124, 190], [170, 70, 200], [70, 30, 110]],
});

function sampleRamp(palette, t) {
  const stops = PALETTES[palette] ?? PALETTES.neon;
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const position = clamped * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(position));
  const factor = position - index;
  const from = stops[index];
  const to = stops[index + 1];
  return [
    Math.round(from[0] + (to[0] - from[0]) * factor),
    Math.round(from[1] + (to[1] - from[1]) * factor),
    Math.round(from[2] + (to[2] - from[2]) * factor),
  ];
}

const RENDERERS = Object.freeze({
  explosion: renderExplosion,
  fire: renderFire,
  spark: renderSpark,
  smoke: renderSmoke,
  impact: renderImpact,
  lightning: renderLightning,
});

/**
 * Gera os frames de um efeito.
 * @returns {{frames:Array, preset:string, seed:number, size:number, frameCount:number, palette:string}}
 */
export function generateVfxFrames({ preset = 'explosion', size = 64, frameCount = 8, seed = 'lia-forge', palette = null, params = {} } = {}) {
  if (!RENDERERS[preset]) throw new TypeError(`generateVfxFrames: preset desconhecido "${preset}" (use ${VFX_PRESETS.join(', ')})`);
  if (!Number.isInteger(size) || size < 8 || size > 512) throw new RangeError('generateVfxFrames: size must be an integer between 8 and 512');
  if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > 64) throw new RangeError('generateVfxFrames: frameCount must be between 1 and 64');
  const numericSeed = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  const random = createRandom(numericSeed);
  const chosenPalette = palette ?? preset;
  const frames = [];
  for (let index = 0; index < frameCount; index += 1) {
    const factor = frameCount === 1 ? 0.5 : index / (frameCount - 1);
    frames.push(RENDERERS[preset]({ size, factor, random, palette: chosenPalette, ...params }));
  }
  return { frames, preset, seed: numericSeed, size, frameCount, palette: chosenPalette, deterministic: true };
}

/** Gera efeito + atlas empacotado, pronto para validação de conteúdo. */
export function generateVfxAtlas(options = {}) {
  const generated = generateVfxFrames(options);
  const atlas = packAtlas(generated.frames, { columns: options.columns ?? Math.min(8, generated.frameCount) });
  return { ...generated, atlas, emptyCells: atlas.emptyCells };
}

export { PALETTES, sampleRamp, radialField };
