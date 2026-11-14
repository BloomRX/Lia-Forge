const { BLENDER_SAFETY_FLAGS, missingBlenderSafetyFlags } = require('./blender-adapter.cjs');

const BLENDER_SPRITESHEET_WORKFLOW_ID = 'render-spritesheet-from-existing-3d';

function createBlenderSpritesheetPlan({
  runId,
  asset,
  sourceRelative,
  frameSize,
  blenderExecutable,
  blenderArgs,
  outputDirectory,
} = {}) {
  if (typeof runId !== 'string' || !runId.trim()
    || !asset || !['character', 'item'].includes(asset.type)
    || typeof asset.id !== 'string' || !asset.id.trim()
    || typeof sourceRelative !== 'string' || !sourceRelative.trim()
    || !frameSize || !Number.isInteger(frameSize.width) || frameSize.width < 16 || frameSize.width > 512
    || !Number.isInteger(frameSize.height) || frameSize.height < 16 || frameSize.height > 512
    || typeof blenderExecutable !== 'string' || !blenderExecutable.trim()
    || !Array.isArray(blenderArgs) || blenderArgs.some((arg) => typeof arg !== 'string')
    || typeof outputDirectory !== 'string' || !outputDirectory.trim()) {
    throw new Error('Não é possível criar o plano Blender: faltam dados válidos da execução.');
  }
  // Fail-closed nas flags de segurança (P0-4): o plano é o que o Workflow Runner
  // executa, então um plano com Blender sem `--disable-autoexec` é código de
  // terceiro podendo rodar ao abrir um `.blend`. Antes qualquer `blenderArgs`
  // era aceito, inclusive vazio.
  const missingFlags = missingBlenderSafetyFlags(blenderArgs);
  if (missingFlags.length > 0) {
    throw new Error(`Não é possível criar o plano Blender: faltam as flags de segurança ${missingFlags.join(', ')} (obrigatórias: ${BLENDER_SAFETY_FLAGS.join(', ')}). Nada foi executado.`);
  }
  if (!blenderArgs.includes('--python')) {
    throw new Error('Não é possível criar o plano Blender: sem --python não há script do repositório para executar. Nada foi executado.');
  }
  return {
    id: runId,
    schemaVersion: 2,
    workflowId: BLENDER_SPRITESHEET_WORKFLOW_ID,
    assetId: asset.id,
    metadata: { kind: 'blender-spritesheet', sourceRelative, stageIndex: 4, frameSize: { ...frameSize } },
    steps: [{
      id: 'render-and-pack',
      title: 'Renderizar e empacotar spritesheet no Blender',
      adapter: 'blender-spritesheet',
      dependsOn: [],
      inputContracts: [
        { id: 'model', kind: 'file', path: sourceRelative, formats: ['blend', 'glb', 'gltf', 'fbx', 'obj', 'stl'], required: true },
        { id: 'animations', kind: 'context', contextKey: 'asset.animations', valueType: 'array', required: asset.type === 'character' },
        { id: 'frame-size', kind: 'context', contextKey: 'frameSize', valueType: 'object', required: true },
      ],
      outputContracts: [
        { id: 'spritesheet', formats: ['png'], validator: 'png-rgba8', required: true },
        { id: 'spritesheet-metadata', formats: ['json'], validator: 'spritesheet-manifest', required: true },
      ],
      parameters: {
        assetType: asset.type,
        assetName: String(asset.name || 'asset').slice(0, 120),
        target: String(asset.target || ''),
        frameSize: { ...frameSize },
        animations: Array.isArray(asset.animations) ? [...asset.animations] : [],
      },
      execution: { kind: 'process', executable: blenderExecutable, args: [...blenderArgs], cwd: outputDirectory },
    }],
  };
}

module.exports = { BLENDER_SPRITESHEET_WORKFLOW_ID, createBlenderSpritesheetPlan };
