const { randomUUID } = require('node:crypto');

const HUMANOID_WORKFLOW_ID = 'humanoid-prompt-views-to-2d-v1';
const HUMANOID_PIPELINE_STAGES = Object.freeze([
  Object.freeze({
    id: 'reference-views',
    title: 'Brief → vistas de referência coerentes',
    adapterRole: 'views',
    inputContracts: Object.freeze([
      Object.freeze({ id: 'brief', kind: 'context', contextKey: 'asset.brief', valueType: 'string', required: true }),
      Object.freeze({ id: 'prompt', kind: 'context', contextKey: 'asset.prompt', valueType: 'string', required: true }),
      Object.freeze({ id: 'existing-reference-images', kind: 'files', contextKey: 'asset.existingInputs', filterStageIndex: 1, formats: ['png', 'jpg', 'jpeg', 'webp'], validator: 'image', required: false }),
    ]),
    outputContracts: Object.freeze([
      Object.freeze({ id: 'front-view', required: true, formats: ['png', 'jpg', 'jpeg', 'webp'], validator: 'image' }),
      Object.freeze({ id: 'side-view', required: true, formats: ['png', 'jpg', 'jpeg', 'webp'], validator: 'image' }),
      Object.freeze({ id: 'back-view', required: true, formats: ['png', 'jpg', 'jpeg', 'webp'], validator: 'image' }),
    ]),
    reviewRequired: true,
    authorizationActions: Object.freeze(['send_prompt_or_references', 'paid_generation', 'download_result']),
  }),
  Object.freeze({
    id: 'generate-3d',
    title: 'Vistas aprovadas → modelo 3D',
    adapterRole: 'generation',
    dependsOn: Object.freeze(['reference-views']),
    inputContracts: Object.freeze([
      Object.freeze({ id: 'brief', kind: 'context', contextKey: 'asset.brief', valueType: 'string', required: true }),
      Object.freeze({ id: 'prompt', kind: 'context', contextKey: 'asset.prompt', valueType: 'string', required: true }),
      Object.freeze({ id: 'front-view', kind: 'artifact', fromStep: 'reference-views', artifactId: 'front-view', formats: ['png', 'jpg', 'jpeg', 'webp'], validator: 'image', required: true }),
      Object.freeze({ id: 'side-view', kind: 'artifact', fromStep: 'reference-views', artifactId: 'side-view', formats: ['png', 'jpg', 'jpeg', 'webp'], validator: 'image', required: true }),
      Object.freeze({ id: 'back-view', kind: 'artifact', fromStep: 'reference-views', artifactId: 'back-view', formats: ['png', 'jpg', 'jpeg', 'webp'], validator: 'image', required: true }),
      Object.freeze({ id: 'existing-reference-images', kind: 'files', contextKey: 'asset.existingInputs', filterStageIndex: 1, formats: ['png', 'jpg', 'jpeg', 'webp'], validator: 'image', required: false }),
    ]),
    outputContracts: Object.freeze([
      Object.freeze({ id: 'model', required: true, formats: ['glb', 'gltf', 'fbx', 'blend', 'obj', 'stl'] }),
    ]),
    reviewRequired: true,
    authorizationActions: Object.freeze(['send_prompt_or_references', 'paid_generation', 'download_result']),
  }),
  Object.freeze({
    id: 'auto-rig',
    title: 'Rigging humanoide',
    adapterRole: 'rigging',
    dependsOn: Object.freeze(['generate-3d']),
    inputContracts: Object.freeze([
      Object.freeze({ id: 'model', kind: 'artifact', fromStep: 'generate-3d', artifactId: 'model', formats: ['glb', 'gltf', 'fbx', 'blend', 'obj', 'stl'], required: true }),
    ]),
    outputContracts: Object.freeze([
      Object.freeze({ id: 'rigged-model', required: true, formats: ['glb', 'gltf', 'fbx', 'blend'] }),
    ]),
    reviewRequired: true,
    authorizationActions: Object.freeze(['send_model', 'paid_rigging', 'download_result']),
  }),
  Object.freeze({
    id: 'animate',
    title: 'Animações solicitadas',
    adapterRole: 'animation',
    dependsOn: Object.freeze(['auto-rig']),
    inputContracts: Object.freeze([
      Object.freeze({ id: 'rigged-model', kind: 'artifact', fromStep: 'auto-rig', artifactId: 'rigged-model', formats: ['glb', 'gltf', 'fbx', 'blend'], required: true }),
      Object.freeze({ id: 'actions', kind: 'context', contextKey: 'asset.animations', valueType: 'array', required: true }),
    ]),
    outputContracts: Object.freeze([
      Object.freeze({ id: 'animated-model', required: true, formats: ['glb', 'gltf', 'fbx', 'blend'] }),
    ]),
    reviewRequired: true,
    authorizationActions: Object.freeze(['send_model', 'paid_animation', 'download_result']),
  }),
  Object.freeze({
    id: 'render-2d',
    title: 'Renderizar spritesheet + metadados no Blender',
    adapterRole: 'render',
    dependsOn: Object.freeze(['animate']),
    inputContracts: Object.freeze([
      Object.freeze({ id: 'animated-model', kind: 'artifact', fromStep: 'animate', artifactId: 'animated-model', formats: ['glb', 'gltf', 'fbx', 'blend'], required: true }),
      Object.freeze({ id: 'actions', kind: 'context', contextKey: 'asset.animations', valueType: 'array', required: true }),
    ]),
    outputContracts: Object.freeze([
      Object.freeze({ id: 'spritesheet', required: true, formats: ['png'], validator: 'png-rgba8' }),
      Object.freeze({ id: 'spritesheet-metadata', required: true, formats: ['json'], validator: 'spritesheet-manifest' }),
    ]),
    reviewRequired: true,
    authorizationActions: Object.freeze([]),
  }),
]);

function safeProviderText(value, limit = 500) {
  return String(value || '')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/(https?:\/\/)[^/@\s]+@/gi, '$1[REDACTED]@')
    .replace(/([?&](?:api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|authorization)=)[^&#\s]*/gi, '$1[REDACTED]')
    .replace(/((?:--)?(?:api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|authorization)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/[\r\n\u0000-\u001f]+/g, ' ')
    .slice(0, limit);
}

function safeProviderDestination(value) {
  const raw = safeProviderText(value, 255);
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.replace(/\/$/, '') || url.origin;
  } catch {
    return raw;
  }
}

function normalizedCost(value) {
  const amount = typeof value?.amount === 'number' && Number.isFinite(value.amount) ? value.amount : null;
  const known = value?.known === true && amount !== null;
  return {
    amount,
    unit: safeProviderText(value?.unit || 'unknown', 40),
    known,
    ...(value?.note ? { note: safeProviderText(value.note, 200) } : {}),
  };
}

function providerAuthorization(provider, actions, stageTitle) {
  if (!provider) {
    return {
      required: true,
      actions: [...actions],
      summary: `Selecione um provider para “${stageTitle}” e revise custo, destino e dados antes de qualquer execução.`,
      data: 'Indefinido: depende do provider e da entrada aprovada.',
      destination: 'Indefinido; nenhum serviço foi selecionado.',
      estimatedCost: { amount: null, unit: 'unknown', known: false },
    };
  }
  const mode = provider.mode === 'api' ? 'api' : 'local';
  const transmitsData = mode === 'api' || provider.transmitsData === true;
  const cost = normalizedCost(provider.estimatedCost);
  const costRequiresApproval = !cost.known || cost.amount > 0 || provider.mayIncurCost === true;
  const protectedActions = [];
  if (transmitsData) protectedActions.push('send_data');
  if (costRequiresApproval) protectedActions.push('cost');
  if (provider.installationRequired === true) protectedActions.push('install_software');
  if (provider.downloadRequired === true) protectedActions.push('download_models_or_weights');
  const required = protectedActions.length > 0;
  const humanProviderName = safeProviderText(provider.name || provider.id || provider.adapterId || 'provider selecionado', 100);
  return {
    required,
    actions: [...new Set([...protectedActions, ...actions.filter((action) => {
      if (action === 'send_prompt_or_references' || action === 'send_model') return mode === 'api';
      if (action.startsWith('paid_')) return costRequiresApproval;
      if (action === 'download_result') return mode === 'api';
      return false;
    })])],
    summary: required
      ? `Autorize explicitamente “${humanProviderName}” para ${stageTitle}: confira os dados enviados, o custo estimado e as ações listadas antes de continuar.`
      : `Execução local de “${stageTitle}”; sem transmissão, custo, instalação ou download declarados.`,
    data: safeProviderText(provider.dataDescription || (transmitsData ? 'Prompt, imagens/modelo de entrada e parâmetros necessários à etapa.' : 'Dados locais; não serão transmitidos.'), 500),
    destination: transmitsData ? safeProviderDestination(provider.destination || provider.name || 'Serviço externo não confirmado') : 'Neste dispositivo.',
    estimatedCost: cost,
  };
}

function providerAdapter(provider, fallbackAdapter) {
  return typeof provider?.adapterId === 'string' && provider.adapterId.trim() ? provider.adapterId.trim() : fallbackAdapter;
}

function makeProviderStep(contract, provider, fallbackAdapter, extra = {}) {
  const adapter = providerAdapter(provider, fallbackAdapter);
  const missingProvider = !provider && contract.adapterRole !== 'render';
  const missingAdapter = provider && !provider.adapterRegistered;
  let blockedReason = null;
  if (missingProvider) blockedReason = `Nenhum provider foi escolhido para a etapa “${contract.title}”. A Lia Forge não fará chamadas, downloads nem gerará outputs simulados.`;
  else if (missingAdapter) blockedReason = `O provider “${provider.name || provider.id || adapter}” foi descrito, mas seu adapter executável ainda não está registrado.`;
  return {
    id: contract.id,
    title: contract.title,
    adapter,
    ...(contract.dependsOn ? { dependsOn: [...contract.dependsOn] } : { dependsOn: [] }),
    inputContracts: contract.inputContracts.map((item) => ({ ...item })),
    outputContracts: contract.outputContracts.map((item) => ({ ...item })),
    reviewRequired: contract.reviewRequired,
    authorization: contract.adapterRole === 'render'
      ? { required: false, actions: [], summary: 'Adapter local existente; a execução só começa após a ação explícita de iniciar.' }
      : providerAuthorization(provider, contract.authorizationActions, contract.title),
    provider: provider ? {
      id: String(provider.id || provider.name || adapter).slice(0, 100),
      name: String(provider.name || provider.id || adapter).slice(0, 100),
      mode: provider.mode === 'api' ? 'api' : 'local',
      version: provider.version ? String(provider.version).slice(0, 80) : null,
    } : null,
    ...(blockedReason ? { blockedReason } : {}),
    ...extra,
  };
}

function createHumanoidPipelinePlan({ asset, providers = {}, id = randomUUID(), renderAdapter = 'blender-spritesheet' } = {}) {
  if (!asset || typeof asset !== 'object' || asset.type !== 'character' || typeof asset.id !== 'string' || !asset.id.trim()) {
    throw new Error('O contrato Prompt → 3D → Rigging → Animação → 2D requer um asset character com id.');
  }
  const generationProvider = providers.generation || null;
  const viewsProvider = providers.views || providers.references || (generationProvider?.capabilities?.referenceViews ? generationProvider : null);
  const riggingProvider = providers.rigging || (generationProvider?.capabilities?.rigging ? generationProvider : null);
  const animationProvider = providers.animation || (generationProvider?.capabilities?.animation ? generationProvider : null);
  const steps = HUMANOID_PIPELINE_STAGES.map((contract) => {
    const selectedProvider = contract.adapterRole === 'views'
      ? viewsProvider
      : contract.adapterRole === 'generation'
        ? generationProvider
        : contract.adapterRole === 'rigging'
          ? riggingProvider
          : contract.adapterRole === 'animation'
            ? animationProvider
            : null;
    if (contract.adapterRole === 'render') {
      return makeProviderStep(contract, null, renderAdapter, {
        parameters: {
          assetType: 'character',
          targetFrameSize: String(asset.target || '48 × 48 px').slice(0, 80),
          animations: Array.isArray(asset.animations) ? asset.animations.map((item) => String(item).slice(0, 100)) : [],
        },
        ...(renderAdapter ? {} : { blockedReason: 'Adapter Blender de renderização não configurado.' }),
      });
    }
    const fallbackAdapters = {
      views: 'provider:reference-views',
      generation: 'provider:3d-generation',
      rigging: 'provider:auto-rig',
      animation: 'provider:animation',
    };
    return makeProviderStep(contract, selectedProvider, fallbackAdapters[contract.adapterRole], {
      parameters: contract.id === 'animate' ? { requestedActions: Array.isArray(asset.animations) ? [...asset.animations] : [] } : {},
    });
  });
  return {
    id,
    schemaVersion: 1,
    workflowId: HUMANOID_WORKFLOW_ID,
    assetId: asset.id,
    title: 'Personagem humanoide estilizado · Brief/Prompt → Vistas → 3D → Rigging → Animação → 2D',
    providerNeutral: true,
    steps,
  };
}

module.exports = {
  HUMANOID_PIPELINE_STAGES,
  HUMANOID_WORKFLOW_ID,
  createHumanoidPipelinePlan,
  providerAuthorization,
};
