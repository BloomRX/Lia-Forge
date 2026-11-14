const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { makePng, makeSpritesheetFixture } = require('./png-fixtures.cjs');
const {
  BLENDER_SAFETY_FLAGS,
  buildBlenderSpritesheetArgs,
  candidateModelPaths,
  missingBlenderSafetyFlags,
  findModelInput,
  parseFrameSize,
  runProcess,
  validateSpritesheetFiles,
} = require('../electron/blender-adapter.cjs');

async function main() {
  assert.deepEqual(parseFrameSize('48 × 64 px'), { width: 48, height: 64 });
  assert.deepEqual(parseFrameSize('bad size', { width: 64, height: 64 }), { width: 64, height: 64 });
  assert.deepEqual(candidateModelPaths({
    existingInputs: [
      { path: 'game/assets/hero/3d/model.blend', stageIndex: 2 },
      { path: 'game/assets/hero/rig/hero.fbx', stageIndex: 3 },
    ],
  }), ['game/assets/hero/rig/hero.fbx', 'game/assets/hero/3d/model.blend']);
  assert.equal(findModelInput({ stageStatus: [{}, {}, { outputs: ['game/assets/item/3d/lantern.glb'] }] }), 'game/assets/item/3d/lantern.glb');

  const args = buildBlenderSpritesheetArgs({
    scriptPath: '/opt/lia forge/scripts/blender_spritesheet.py',
    inputPath: '/workspace/hero rig.blend',
    outputDirectory: '/workspace/game assets/hero/sprites/run 1',
    asset: { type: 'character', name: 'Herói Arco', target: '48 × 48 px', animations: ['Idle', 'Walk'] },
  });
  assert(args.includes('/workspace/hero rig.blend'));
  assert(args.includes(JSON.stringify(['Idle', 'Walk'])));
  assert.equal(args[args.indexOf('--frame-width') + 1], '48');

  // P0-4: abrir um .blend de origem desconhecida sem --disable-autoexec executa o
  // Python embutido no arquivo, dentro do processo que o produto iniciou.
  assert.deepEqual(BLENDER_SAFETY_FLAGS, ['--background', '--disable-autoexec']);
  assert.deepEqual(missingBlenderSafetyFlags(args), [], 'os args produzidos não deixam flag de segurança de fora');
  assert(args.includes('--disable-autoexec'), '--disable-autoexec vai na linha de comando');
  assert(args.indexOf('--disable-autoexec') < args.indexOf('--python'),
    'e vem antes do --python (o Blender lê as próprias flags antes do script)');
  assert(args.indexOf('--background') < args.indexOf('--python'), '--background também vem antes do script');
  assert(args.indexOf('--disable-autoexec') < args.indexOf('--'),
    'as flags ficam antes do "--" (depois dele são argumentos do script, não do Blender)');
  assert(!args.includes('--factory-startup'),
    'não usamos --factory-startup: ele descarta as preferências da pessoa e pode sobrescrever o userpref.blend');

  const png = makePng(384, 48);
  const metadata = {
    schemaVersion: 1,
    generator: 'Blender adapter smoke fixture',
    asset: 'hero',
    assetType: 'character',
    frameWidth: 48,
    frameHeight: 48,
    sheetWidth: 384,
    sheetHeight: 48,
    columns: 8,
    rows: 1,
    origin: 'top-left',
    anchor: 'feet',
    animations: ['walk'],
    frames: Array.from({ length: 8 }, (_, column) => ({
      filename: `hero-walk-${String(column).padStart(2, '0')}`,
      animation: 'walk',
      frame: column,
      sourceFrame: column + 1,
      durationMs: 100,
      pivot: { x: 24, y: 47 },
      x: column * 48,
      y: 0,
      width: 48,
      height: 48,
    })),
  };
  const validationOptions = { pngBuffer: png, metadata, frameSize: { width: 48, height: 48 }, assetType: 'character', animations: ['walk'] };
  assert.deepEqual(validateSpritesheetFiles(validationOptions), { sheetWidth: 384, sheetHeight: 48, frameCount: 8 });
  assert.throws(() => validateSpritesheetFiles({ ...validationOptions, animations: ['idle'] }), /ações solicitadas/);
  assert.throws(() => validateSpritesheetFiles({ ...validationOptions, metadata: { ...metadata, frames: metadata.frames.map((frame, index) => index === 1 ? { ...frame, frame: 0 } : frame) } }), /frame 2/);
  assert.throws(() => validateSpritesheetFiles({ ...validationOptions, pngBuffer: makePng(192, 48), metadata: { ...metadata, columns: 4, sheetWidth: 192, frames: metadata.frames.slice(0, 4) } }), /frames por animação/);
  assert.throws(() => validateSpritesheetFiles({ ...validationOptions, pngBuffer: makePng(384, 48, { colorType: 2 }) }), /RGBA/);
  const acceptanceAnimations = ['idle', 'walk', 'run'];
  const acceptanceMetadata = {
    ...metadata,
    sheetHeight: 144,
    rows: 3,
    animations: acceptanceAnimations,
    frames: acceptanceAnimations.flatMap((animation, row) => Array.from({ length: 8 }, (_, column) => ({
      filename: `hero-${animation}-${String(column).padStart(2, '0')}`,
      animation,
      frame: column,
      sourceFrame: column + 1,
      durationMs: 100,
      pivot: { x: 24, y: 47 },
      x: column * 48,
      y: row * 48,
      width: 48,
      height: 48,
    }))),
  };
  const contractSheet = makeSpritesheetFixture();
  assert.deepEqual(validateSpritesheetFiles({
    pngBuffer: contractSheet,
    metadata: acceptanceMetadata,
    frameSize: { width: 48, height: 48 },
    assetType: 'character',
    animations: acceptanceAnimations,
  }), { sheetWidth: 384, sheetHeight: 144, frameCount: 24 });

  // Guarda da lacuna G8 no caminho legado: validação de estrutura sozinha aceita
  // um atlas 100% transparente; a validação de conteúdo (shared/qa/png-codec)
  // recusa. As duas precisam existir na produção.
  const { validatePngContent, analyzePngContent } = require('../shared/qa/png-codec.mjs');
  const blankSheet = makePng(384, 144);
  assert.deepEqual(validateSpritesheetFiles({
    pngBuffer: blankSheet,
    metadata: acceptanceMetadata,
    frameSize: { width: 48, height: 48 },
    assetType: 'character',
    animations: acceptanceAnimations,
  }), { sheetWidth: 384, sheetHeight: 144, frameCount: 24 }, 'A validação estrutural não vê conteúdo — por isso ela não basta.');
  assert.equal(analyzePngContent(blankSheet).blank, true, 'O atlas transparente é medido como em branco.');
  assert.throws(
    () => validatePngContent(blankSheet, { grid: { columns: 8, rows: 3 }, label: 'Atlas transparente' }),
    (error) => error.code === 'ADAPTER_OUTPUT_INVALID',
    'A validação de conteúdo recusa o atlas em branco.',
  );
  const contractAnalysis = analyzePngContent(contractSheet, { grid: { columns: 8, rows: 3 } });
  assert.equal(contractAnalysis.blank, false, 'A fixture do contrato tem conteúdo real.');
  assert.equal(contractAnalysis.emptyCells, 0, 'Nenhuma célula do atlas 8×3 fica vazia.');
  assert.ok(contractAnalysis.uniqueColors >= 2, `Atlas com várias cores (${contractAnalysis.uniqueColors}).`);
  validatePngContent(contractSheet, { grid: { columns: 8, rows: 3 }, label: 'Atlas do contrato' });
  const itemMetadata = {
    ...metadata,
    asset: 'bronze-hammer',
    assetType: 'item',
    sheetHeight: 48,
    rows: 1,
    anchor: 'center',
    animations: ['turntable'],
    frames: Array.from({ length: 8 }, (_, column) => ({
      filename: `bronze-hammer-turntable-${String(column).padStart(2, '0')}`,
      animation: 'turntable',
      frame: column,
      sourceFrame: null,
      durationMs: 100,
      pivot: { x: 24, y: 24 },
      x: column * 48,
      y: 0,
      width: 48,
      height: 48,
    })),
  };
  assert.deepEqual(validateSpritesheetFiles({
    pngBuffer: makePng(384, 48),
    metadata: itemMetadata,
    frameSize: { width: 48, height: 48 },
    assetType: 'item',
  }), { sheetWidth: 384, sheetHeight: 48, frameCount: 8 });
  const corruptedPng = Buffer.from(png);
  corruptedPng[corruptedPng.indexOf(Buffer.from('IDAT')) + 8] ^= 0xff;
  assert.throws(() => validateSpritesheetFiles({ pngBuffer: corruptedPng, metadata, frameSize: { width: 48, height: 48 } }), /CRC inválido/);
  assert.throws(() => validateSpritesheetFiles({ pngBuffer: png, metadata: { ...metadata, sheetWidth: 48 }, frameSize: { width: 48, height: 48 } }), /não correspondem/);

  const progress = [];
  const child = spawn(process.execPath, ['-e', 'console.log("LIA_FORGE_PROGRESS 37 mock stage"); console.log("LIA_FORGE_PROGRESS 82 finishing")'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await runProcess(child, { onProgress: async (event) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    progress.push(event);
  } });
  assert.deepEqual(progress, [
    { progress: 37, message: 'mock stage' },
    { progress: 82, message: 'finishing' },
  ]);

  console.log('Blender adapter smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
