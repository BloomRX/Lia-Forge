const FRAME_SIZE_LIMITS = Object.freeze({ min: 1, max: 4096 });

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function normalizeExpectedAnimations(value) {
  if (!Array.isArray(value)) return null;
  return value.map((name) => typeof name === 'string' ? name.trim() : '');
}

function validateSpritesheetManifest(manifest, expected = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || manifest.schemaVersion !== 1) {
    throw new Error('O manifesto da spritesheet precisa declarar schemaVersion 1.');
  }
  if (!['character', 'item'].includes(manifest.assetType)) {
    throw new Error('O manifesto da spritesheet precisa declarar assetType character ou item.');
  }
  if (typeof manifest.asset !== 'string' || !manifest.asset.trim()
    || typeof manifest.generator !== 'string' || !manifest.generator.trim()) {
    throw new Error('O manifesto da spritesheet precisa identificar o asset e o gerador.');
  }
  if (manifest.origin !== 'top-left'
    || manifest.anchor !== (manifest.assetType === 'character' ? 'feet' : 'center')) {
    throw new Error('A origem ou o pivô global do manifesto da spritesheet é inválido.');
  }

  const { frameWidth, frameHeight, columns, rows, sheetWidth, sheetHeight } = manifest;
  if (![frameWidth, frameHeight].every(isPositiveInteger)
    || frameWidth < FRAME_SIZE_LIMITS.min || frameWidth > FRAME_SIZE_LIMITS.max
    || frameHeight < FRAME_SIZE_LIMITS.min || frameHeight > FRAME_SIZE_LIMITS.max
    || !isPositiveInteger(columns) || !isPositiveInteger(rows)
    || !isPositiveInteger(sheetWidth) || !isPositiveInteger(sheetHeight)
    || columns * frameWidth !== sheetWidth || rows * frameHeight !== sheetHeight) {
    throw new Error('As dimensões da grade declaradas no manifesto da spritesheet são inválidas ou não correspondem.');
  }

  if ((expected.frameWidth !== undefined && frameWidth !== expected.frameWidth)
    || (expected.frameHeight !== undefined && frameHeight !== expected.frameHeight)) {
    throw new Error('As dimensões de frame do manifesto não correspondem ao tamanho solicitado.');
  }
  if ((expected.sheetWidth !== undefined && sheetWidth !== expected.sheetWidth)
    || (expected.sheetHeight !== undefined && sheetHeight !== expected.sheetHeight)) {
    throw new Error('As dimensões da spritesheet no manifesto não correspondem ao PNG real.');
  }
  if (expected.columns !== undefined && columns !== expected.columns) {
    throw new Error('A quantidade de frames por animação não corresponde ao formato do gerador.');
  }
  if (expected.assetType !== undefined && manifest.assetType !== expected.assetType) {
    throw new Error('O tipo de asset do manifesto não corresponde ao asset em execução.');
  }

  const animations = manifest.animations;
  if (!Array.isArray(animations) || animations.length !== rows
    || animations.some((name) => typeof name !== 'string' || !name.trim())
    || new Set(animations.map((name) => name.trim().toLocaleLowerCase('en-US'))).size !== animations.length) {
    throw new Error('A lista de animações do manifesto precisa ter um nome único e não vazio por linha.');
  }
  const expectedAnimations = normalizeExpectedAnimations(expected.animations);
  if (expectedAnimations && (expectedAnimations.length !== animations.length
    || expectedAnimations.some((name, index) => name !== animations[index]))) {
    throw new Error('As animações do manifesto não correspondem às ações solicitadas.');
  }

  const frames = manifest.frames;
  if (!Array.isArray(frames) || frames.length !== columns * rows) {
    throw new Error('A quantidade de frames do manifesto não corresponde à grade declarada.');
  }
  const filenames = new Set();
  for (const [index, frame] of frames.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const filename = typeof frame?.filename === 'string' ? frame.filename.trim() : '';
    if (!frame || typeof frame !== 'object' || Array.isArray(frame)
      || !filename || filenames.has(filename)
      || frame.animation !== animations[row]
      || frame.frame !== column
      || frame.x !== column * frameWidth || frame.y !== row * frameHeight
      || frame.width !== frameWidth || frame.height !== frameHeight
      || frame.x + frame.width > sheetWidth || frame.y + frame.height > sheetHeight
      || !Number.isInteger(frame.pivot?.x) || !Number.isInteger(frame.pivot?.y)
      || frame.pivot.x < 0 || frame.pivot.x >= frameWidth
      || frame.pivot.y < 0 || frame.pivot.y >= frameHeight
      || !Number.isFinite(frame.durationMs) || frame.durationMs <= 0
      || (manifest.assetType === 'character' && !Number.isInteger(frame.sourceFrame))
      || (manifest.assetType === 'item' && frame.sourceFrame !== null)) {
      throw new Error(`O frame ${index + 1} do manifesto da spritesheet é inválido.`);
    }
    filenames.add(filename);
  }

  return {
    assetType: manifest.assetType,
    frameWidth,
    frameHeight,
    columns,
    rows,
    sheetWidth,
    sheetHeight,
    frameCount: frames.length,
    animations: [...animations],
  };
}

module.exports = { validateSpritesheetManifest };
