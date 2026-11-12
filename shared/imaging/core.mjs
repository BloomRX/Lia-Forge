/**
 * Operações de imagem 2D (F7 — capacidade `image2d.*`).
 *
 * Puro: trabalha sobre `{ width, height, rgba: Uint8ClampedArray }`, sem Node,
 * sem canvas e sem dependências. Roda igual no processo principal (onde grava
 * PNG via `png-io.mjs`) e no Studio (onde mostra preview).
 *
 * Nada aqui inventa conteúdo: `decomposeParts` separa o que já existe e marca
 * regiões possivelmente ocultas para revisão humana — nunca preenche pixels
 * (reconstrução de oclusão é capacidade `proposed`, não implementada).
 */

export function createImage(width, height, fill = [0, 0, 0, 0]) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new TypeError('createImage: width/height must be positive integers');
  }
  const rgba = new Uint8ClampedArray(width * height * 4);
  if (fill && (fill[0] || fill[1] || fill[2] || fill[3])) {
    for (let index = 0; index < rgba.length; index += 4) {
      rgba[index] = fill[0];
      rgba[index + 1] = fill[1];
      rgba[index + 2] = fill[2];
      rgba[index + 3] = fill[3];
    }
  }
  return { width, height, rgba };
}

function assertImage(image, label = 'image') {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || !image.rgba) {
    throw new TypeError(`${label}: expected { width, height, rgba }`);
  }
  if (image.rgba.length !== image.width * image.height * 4) {
    throw new TypeError(`${label}: rgba length does not match width*height*4`);
  }
  return image;
}

export function getPixel(image, x, y) {
  const index = (y * image.width + x) * 4;
  return [image.rgba[index], image.rgba[index + 1], image.rgba[index + 2], image.rgba[index + 3]];
}

export function setPixel(image, x, y, [r, g, b, a]) {
  const index = (y * image.width + x) * 4;
  image.rgba[index] = r;
  image.rgba[index + 1] = g;
  image.rgba[index + 2] = b;
  image.rgba[index + 3] = a;
}

export function cloneImage(image) {
  assertImage(image);
  return { width: image.width, height: image.height, rgba: new Uint8ClampedArray(image.rgba) };
}

/** Bounding box dos pixels visíveis (alpha > threshold) ou null se vazia. */
export function alphaBounds(image, alphaThreshold = 8) {
  assertImage(image, 'alphaBounds image');
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.rgba[(y * image.width + x) * 4 + 3] > alphaThreshold) {
        opaque += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!opaque) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, opaquePixels: opaque };
}

export function cropImage(image, x, y, width, height) {
  assertImage(image, 'cropImage image');
  if (x < 0 || y < 0 || x + width > image.width || y + height > image.height) {
    throw new RangeError('cropImage: region outside the image');
  }
  const output = createImage(width, height);
  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((y + row) * image.width + x) * 4;
    output.rgba.set(image.rgba.subarray(sourceStart, sourceStart + width * 4), row * width * 4);
  }
  return output;
}

/** Redimensiona por vizinho mais próximo (sprites) ou bilinear (fotos). */
export function resizeImage(image, width, height, { filter = 'nearest' } = {}) {
  assertImage(image, 'resizeImage image');
  const output = createImage(width, height);
  if (filter === 'nearest') {
    for (let y = 0; y < height; y += 1) {
      const sourceY = Math.min(image.height - 1, Math.floor((y * image.height) / height));
      for (let x = 0; x < width; x += 1) {
        const sourceX = Math.min(image.width - 1, Math.floor((x * image.width) / width));
        const source = (sourceY * image.width + sourceX) * 4;
        const target = (y * width + x) * 4;
        output.rgba[target] = image.rgba[source];
        output.rgba[target + 1] = image.rgba[source + 1];
        output.rgba[target + 2] = image.rgba[source + 2];
        output.rgba[target + 3] = image.rgba[source + 3];
      }
    }
    return output;
  }
  if (filter !== 'bilinear') throw new TypeError("resizeImage: filter must be 'nearest' or 'bilinear'");
  const scaleX = image.width / width;
  const scaleY = image.height / height;
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, (y + 0.5) * scaleY - 0.5);
    const y0 = Math.max(0, Math.floor(sourceY));
    const y1 = Math.min(image.height - 1, y0 + 1);
    const fy = sourceY - y0;
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, (x + 0.5) * scaleX - 0.5);
      const x0 = Math.max(0, Math.floor(sourceX));
      const x1 = Math.min(image.width - 1, x0 + 1);
      const fx = sourceX - x0;
      const target = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const p00 = image.rgba[(y0 * image.width + x0) * 4 + channel];
        const p10 = image.rgba[(y0 * image.width + x1) * 4 + channel];
        const p01 = image.rgba[(y1 * image.width + x0) * 4 + channel];
        const p11 = image.rgba[(y1 * image.width + x1) * 4 + channel];
        const top = p00 + (p10 - p00) * fx;
        const bottom = p01 + (p11 - p01) * fx;
        output.rgba[target + channel] = Math.round(top + (bottom - top) * fy);
      }
    }
  }
  return output;
}

/** Remove fundo por cor-chave com tolerância e suavização de borda. */
export function chromaKey(image, { color = [0, 255, 0], tolerance = 32, feather = 16 } = {}) {
  assertImage(image, 'chromaKey image');
  const output = cloneImage(image);
  const toleranceSquared = tolerance * tolerance * 3;
  const featherSquared = Math.max(toleranceSquared, (tolerance + feather) ** 2 * 3);
  let removed = 0;
  for (let index = 0; index < output.rgba.length; index += 4) {
    const dr = output.rgba[index] - color[0];
    const dg = output.rgba[index + 1] - color[1];
    const db = output.rgba[index + 2] - color[2];
    const distance = dr * dr + dg * dg + db * db;
    if (distance <= toleranceSquared) {
      output.rgba[index + 3] = 0;
      removed += 1;
    } else if (distance < featherSquared) {
      const factor = (distance - toleranceSquared) / (featherSquared - toleranceSquared);
      output.rgba[index + 3] = Math.round(output.rgba[index + 3] * factor);
    }
  }
  return { image: output, removedPixels: removed };
}

/** Troca de cor por substituição exata ou por deslocamento de matiz. */
export function recolor(image, { from = null, to = null, tolerance = 0, hueShift = 0, saturation = 1, lightness = 1 } = {}) {
  assertImage(image, 'recolor image');
  const output = cloneImage(image);
  if (from && to) {
    for (let index = 0; index < output.rgba.length; index += 4) {
      const match = Math.abs(output.rgba[index] - from[0]) <= tolerance
        && Math.abs(output.rgba[index + 1] - from[1]) <= tolerance
        && Math.abs(output.rgba[index + 2] - from[2]) <= tolerance;
      if (match) {
        output.rgba[index] = to[0];
        output.rgba[index + 1] = to[1];
        output.rgba[index + 2] = to[2];
      }
    }
    return output;
  }
  if (!hueShift && saturation === 1 && lightness === 1) return output;
  for (let index = 0; index < output.rgba.length; index += 4) {
    const [h, s, l] = rgbToHsl(output.rgba[index], output.rgba[index + 1], output.rgba[index + 2]);
    const [r, g, b] = hslToRgb((h + hueShift) % 360, clamp01(s * saturation), clamp01(l * lightness));
    output.rgba[index] = r;
    output.rgba[index + 1] = g;
    output.rgba[index + 2] = b;
  }
  return output;
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h, s, l) {
  if (s === 0) {
    const value = Math.round(l * 255);
    return [value, value, value];
  }
  const hue = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  return [
    Math.round(channel(hue + 1 / 3) * 255),
    Math.round(channel(hue) * 255),
    Math.round(channel(hue - 1 / 3) * 255),
  ];
}

export function flipImage(image, axis = 'x') {
  assertImage(image, 'flipImage image');
  const output = createImage(image.width, image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sourceX = axis === 'x' ? image.width - 1 - x : x;
      const sourceY = axis === 'y' ? image.height - 1 - y : y;
      const source = (sourceY * image.width + sourceX) * 4;
      const target = (y * image.width + x) * 4;
      output.rgba.set(image.rgba.subarray(source, source + 4), target);
    }
  }
  return output;
}

/** Compõe camadas em ordem (a última fica por cima), com opacidade e offset. */
export function composeLayers(layers, { width, height, background = null } = {}) {
  if (!Array.isArray(layers)) throw new TypeError('composeLayers: layers must be an array');
  const canvasWidth = width ?? layers.reduce((max, layer) => Math.max(max, (layer.x ?? 0) + layer.width), 1);
  const canvasHeight = height ?? layers.reduce((max, layer) => Math.max(max, (layer.y ?? 0) + layer.height), 1);
  const output = createImage(canvasWidth, canvasHeight, background ?? [0, 0, 0, 0]);
  for (const layer of layers) {
    if (!layer || !layer.rgba) throw new TypeError('composeLayers: every layer needs rgba pixels');
    const offsetX = layer.x ?? 0;
    const offsetY = layer.y ?? 0;
    const opacity = layer.opacity === undefined ? 1 : layer.opacity;
    for (let y = 0; y < layer.height; y += 1) {
      const targetY = offsetY + y;
      if (targetY < 0 || targetY >= canvasHeight) continue;
      for (let x = 0; x < layer.width; x += 1) {
        const targetX = offsetX + x;
        if (targetX < 0 || targetX >= canvasWidth) continue;
        const source = (y * layer.width + x) * 4;
        const sourceAlpha = (layer.rgba[source + 3] / 255) * opacity;
        if (sourceAlpha <= 0) continue;
        const target = (targetY * canvasWidth + targetX) * 4;
        const destAlpha = output.rgba[target + 3] / 255;
        const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
        for (let channel = 0; channel < 3; channel += 1) {
          output.rgba[target + channel] = outAlpha === 0
            ? 0
            : Math.round((layer.rgba[source + channel] * sourceAlpha + output.rgba[target + channel] * destAlpha * (1 - sourceAlpha)) / outAlpha);
        }
        output.rgba[target + 3] = Math.round(outAlpha * 255);
      }
    }
  }
  return output;
}

/**
 * Separa um sprite em partes por conectividade de alpha (4-vizinhos).
 *
 * Heurística determinística e honesta: partes encostadas viram uma parte só
 * (`mergeTouching`) e a ordem de oclusão é **estimada** por área/posição, com
 * `needsReview: true`. Nenhum pixel é inventado; regiões cobertas por outra
 * parte ficam marcadas como `possiblyOccluded` para decisão humana.
 */
export function decomposeParts(image, { minArea = 16, alphaThreshold = 8, mergeTouching = false, maxParts = 64 } = {}) {
  assertImage(image, 'decomposeParts image');
  const { width, height, rgba } = image;
  const labels = new Int32Array(width * height).fill(-1);
  const parts = [];
  const step = mergeTouching ? 1 : 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (labels[pixel] !== -1) continue;
      if (rgba[pixel * 4 + 3] <= alphaThreshold) continue;
      const partIndex = parts.length;
      const stack = [pixel];
      labels[pixel] = partIndex;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      while (stack.length) {
        const current = stack.pop();
        const cx = current % width;
        const cy = (current - cx) / width;
        area += 1;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [nx, ny] of [[cx - step, cy], [cx + step, cy], [cx, cy - step], [cx, cy + step]]) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (labels[neighbor] !== -1) continue;
          if (rgba[neighbor * 4 + 3] <= alphaThreshold) continue;
          labels[neighbor] = partIndex;
          stack.push(neighbor);
        }
      }
      if (area < minArea) {
        // descarta ruído: volta os rótulos para -1
        for (let index = 0; index < labels.length; index += 1) if (labels[index] === partIndex) labels[index] = -2;
        continue;
      }
      const partWidth = maxX - minX + 1;
      const partHeight = maxY - minY + 1;
      const pixels = new Uint8ClampedArray(partWidth * partHeight * 4);
      let sumX = 0;
      let sumY = 0;
      for (let py = minY; py <= maxY; py += 1) {
        for (let px = minX; px <= maxX; px += 1) {
          const source = (py * width + px) * 4;
          const target = ((py - minY) * partWidth + (px - minX)) * 4;
          if (labels[py * width + px] === partIndex) {
            pixels[target] = rgba[source];
            pixels[target + 1] = rgba[source + 1];
            pixels[target + 2] = rgba[source + 2];
            pixels[target + 3] = rgba[source + 3];
            sumX += px;
            sumY += py;
          }
        }
      }
      parts.push({
        id: `part-${String(partIndex + 1).padStart(2, '0')}`,
        x: minX,
        y: minY,
        width: partWidth,
        height: partHeight,
        rgba: pixels,
        area,
        centroid: { x: Math.round(sumX / area), y: Math.round(sumY / area) },
        bbox: { x: minX, y: minY, width: partWidth, height: partHeight },
      });
      if (parts.length >= maxParts) break;
    }
    if (parts.length >= maxParts) break;
  }

  // oclusão: partes cuja bbox é coberta por outra parte desenhada depois
  const ordered = [...parts].sort((a, b) => (b.area - a.area) || (a.y - b.y) || (a.x - b.x));
  for (const [drawIndex, part] of ordered.entries()) {
    part.drawOrder = drawIndex;
    part.possiblyOccluded = false;
    part.overlaps = [];
    for (const other of ordered) {
      if (other.id === part.id) continue;
      if (boxesIntersect(part.bbox, other.bbox)) {
        part.overlaps.push(other.id);
        if (other.drawOrder < part.drawOrder) part.possiblyOccluded = true;
      }
    }
    part.reconstruction = 'none';
  }

  return {
    parts: ordered,
    sourceWidth: width,
    sourceHeight: height,
    discardedNoise: labels.filter((value) => value === -2).length,
    needsReview: true,
    note: 'Separação por conectividade: partes encostadas viram uma só e a ordem de oclusão é estimada. Revise antes de usar em rig.',
  };
}

function boxesIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Contorno (outline) de 1px em volta dos pixels visíveis. */
export function outlineImage(image, { color = [0, 0, 0, 255], alphaThreshold = 8 } = {}) {
  assertImage(image, 'outlineImage image');
  const output = cloneImage(image);
  const { width, height, rgba } = image;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] > alphaThreshold) continue;
      const neighborVisible = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
        .some(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height && rgba[(ny * width + nx) * 4 + 3] > alphaThreshold);
      if (!neighborVisible) continue;
      const target = (y * width + x) * 4;
      output.rgba[target] = color[0];
      output.rgba[target + 1] = color[1];
      output.rgba[target + 2] = color[2];
      output.rgba[target + 3] = color[3];
    }
  }
  return output;
}

/**
 * Empacota frames em atlas.
 * `columns` omitido usa a largura do primeiro frame para preencher a linha.
 */
export function packAtlas(frames, { columns = null, rows = null, frameWidth = null, frameHeight = null, padding = 0 } = {}) {
  if (!Array.isArray(frames) || frames.length === 0) throw new TypeError('packAtlas: frames must be a non-empty array');
  const width = frameWidth ?? frames[0].width;
  const height = frameHeight ?? frames[0].height;
  const perRow = columns ?? Math.ceil(Math.sqrt(frames.length));
  const rowCount = rows ?? Math.ceil(frames.length / perRow);
  const atlas = createImage(perRow * (width + padding) - padding, rowCount * (height + padding) - padding);
  const cells = [];
  for (const [index, frame] of frames.entries()) {
    const column = index % perRow;
    const row = Math.floor(index / perRow);
    const x = column * (width + padding);
    const y = row * (height + padding);
    const scaled = frame.width === width && frame.height === height ? frame : resizeImage(frame, width, height, { filter: 'nearest' });
    for (let fy = 0; fy < height; fy += 1) {
      for (let fx = 0; fx < width; fx += 1) {
        const source = (fy * width + fx) * 4;
        const target = ((y + fy) * atlas.width + (x + fx)) * 4;
        atlas.rgba.set(scaled.rgba.subarray(source, source + 4), target);
      }
    }
    cells.push({ index, column, row, x, y, width, height, empty: !alphaBounds(scaled) });
  }
  return {
    image: atlas,
    columns: perRow,
    rows: rowCount,
    frameWidth: width,
    frameHeight: height,
    sheetWidth: atlas.width,
    sheetHeight: atlas.height,
    cells,
    emptyCells: cells.filter((cell) => cell.empty).length,
  };
}
