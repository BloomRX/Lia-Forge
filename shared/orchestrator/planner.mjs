/**
 * Orchestrator — planejador de produção (F5/F6 — requisitos §4, §10, §12.1).
 *
 * O Orchestrator **planeja e não executa**: recebe a intenção do usuário
 * (o que produzir, para onde, com que referências), resolve capacidades no Hub
 * e devolve um plano em DAG com requisitos, custo, licenças, autorizações
 * necessárias, gates de revisão e o que está bloqueado. Quem executa é o
 * Execution Manager; quem resolve ferramenta é o Hub; quem valida é o QA.
 *
 * Fail-closed: sem provider utilizável, o passo fica com `adapter: null` e
 * `blockedReason` nomeado — nunca um passo "de mentirinha" que finge produzir.
 *
 * Os oito workflows mínimos do requisito §12.1 estão aqui como receitas
 * declarativas (`WORKFLOW_RECIPES`), não como oito pipelines separados: todos
 * compartilham capacidades, adapters, validadores e destinos.
 */

import { PROTECTED_ACTIONS } from '../engine/gates.mjs';

export const ORCHESTRATOR_SCHEMA_VERSION = 1;

export const WORKFLOW_IDS = Object.freeze([
  '2d-art-concept',
  '2d-character-parts',
  '2d-modular-character',
  '2d-animation',
  '3d-object-render',
  '3d-character-spritesheet',
  'ui-vfx-sheet',
  'variation-retexture',
]);

/**
 * Receitas: cada passo declara a capacidade que precisa, não a ferramenta.
 * `optional: true` permite pular sem invalidar o plano (ex.: registro manual).
 */
export const WORKFLOW_RECIPES = Object.freeze({
  '2d-art-concept': {
    title: 'Arte 2D (conceito)',
    family: '2d',
    description: 'Gera uma imagem de conceito por difusão local e valida o conteúdo; sem servidor disponível, o passo fica bloqueado e a arte pode ser registrada manualmente.',
    destinationAware: true,
    steps: [
      { id: 'concept', title: 'Gerar conceito 2D', capability: 'image2d.generate-concept', requiresParam: 'prompt', reviewRequired: true, validators: ['png-structural', 'png-content'], optional: true, blockedFallback: 'manual-registration' },
      { id: 'prepare', title: 'Preparar imagem (fundo/recorte)', capability: 'image2d.transform', dependsOn: ['concept'], params: { op: 'chroma-key' }, validators: ['png-content'] },
      { id: 'deliver', title: 'Empacotar para o destino', capability: 'export.engine', dependsOn: ['prepare'], validators: ['destination-profile'] },
    ],
  },
  '2d-character-parts': {
    title: 'Personagem 2D por partes',
    family: '2.5d',
    description: 'Separa o sprite em partes, monta rig 2D, anima e empacota o atlas — tudo com o renderer interno, sem ferramenta externa.',
    destinationAware: true,
    steps: [
      { id: 'decompose', title: 'Separar partes', capability: 'image2d.decompose-parts', params: { op: 'decompose-parts', minArea: 16 }, validators: ['layers-integrity'], reviewRequired: true },
      { id: 'rig', title: 'Construir rig 2D', capability: 'rig2d.build', dependsOn: ['decompose'], params: { task: 'build-rig' }, validators: ['rig2d-structural'], reviewRequired: true },
      { id: 'animate', title: 'Gerar ações (idle/walk/run)', capability: 'rig2d.animate', dependsOn: ['rig'], params: { task: 'animate', actions: 'idle,walk,run' }, validators: ['animation-loop'] },
      { id: 'render', title: 'Renderizar frames e atlas', capability: 'render.atlas', dependsOn: ['animate'], params: { task: 'render', frameSize: '48x48', columns: 8 }, validators: ['png-content', 'spritesheet-manifest'] },
      { id: 'deliver', title: 'Empacotar para o destino', capability: 'export.engine', dependsOn: ['render'], validators: ['destination-profile'] },
    ],
  },
  '2d-modular-character': {
    title: 'Personagem modular 2D (skins/variantes)',
    family: '2.5d',
    description: 'Um rig-template com peças intercambiáveis: as animações são compartilhadas entre variantes, sem duplicar pipeline.',
    destinationAware: true,
    steps: [
      { id: 'decompose', title: 'Separar partes do template', capability: 'image2d.decompose-parts', params: { op: 'decompose-parts' }, validators: ['layers-integrity'], reviewRequired: true },
      { id: 'rig', title: 'Construir rig-template', capability: 'rig2d.build', dependsOn: ['decompose'], params: { task: 'build-rig' }, validators: ['rig2d-structural'] },
      { id: 'variants', title: 'Gerar variantes modulares', capability: 'character.modularity', dependsOn: ['rig'], params: { task: 'modular-variants' }, validators: ['rig2d-structural'] },
      { id: 'animate', title: 'Animar (compartilhado entre variantes)', capability: 'rig2d.animate', dependsOn: ['variants'], params: { task: 'animate', actions: 'idle,walk' }, validators: ['animation-loop'] },
      { id: 'render', title: 'Renderizar atlas por variante', capability: 'render.atlas', dependsOn: ['animate'], params: { task: 'render' }, validators: ['png-content', 'spritesheet-manifest'] },
      { id: 'deliver', title: 'Empacotar para o destino', capability: 'export.engine', dependsOn: ['render'], validators: ['destination-profile'] },
    ],
  },
  '2d-animation': {
    title: 'Animação 2D sobre rig existente',
    family: '2.5d',
    description: 'Reutiliza um rig já revisado para gerar novas ações e frames, sem repetir separação de partes.',
    destinationAware: true,
    // A entrada deste workflow é um rig já revisado: ou vem de um run anterior
    // (`fromRun`) ou é construído aqui a partir das partes separadas.
    steps: [
      { id: 'rig', title: 'Obter rig de origem', capability: 'rig2d.build', params: { task: 'build-rig' }, validators: ['rig2d-structural'], inputFrom: 'priorRun' },
      { id: 'animate', title: 'Gerar ações', capability: 'rig2d.animate', dependsOn: ['rig'], params: { task: 'animate', actions: 'idle,walk,run,attack' }, validators: ['animation-loop'], reviewRequired: true },
      { id: 'render', title: 'Renderizar frames e atlas', capability: 'render.atlas', dependsOn: ['animate'], params: { task: 'render', frameSize: '48x48', columns: 8 }, validators: ['png-content', 'spritesheet-manifest'] },
      { id: 'deliver', title: 'Empacotar para o destino', capability: 'export.engine', dependsOn: ['render'], validators: ['destination-profile'] },
    ],
  },
  '3d-object-render': {
    title: 'Objeto 3D + render',
    family: '3d',
    description: 'Inspeciona o modelo, renderiza vistas/turntable e empacota o atlas. Requer Blender instalado pelo usuário.',
    destinationAware: true,
    steps: [
      { id: 'inspect', title: 'Inspecionar modelo (GLB)', capability: 'model3d.inspect', requiresParam: 'model', validators: ['glb-structural'] },
      { id: 'render', title: 'Renderizar vistas', capability: 'render3d.frame', dependsOn: ['inspect'], validators: ['png-structural', 'png-content'] },
      { id: 'atlas', title: 'Empacotar atlas', capability: 'render.atlas', dependsOn: ['render'], params: { task: 'pack-atlas', columns: 4 }, validators: ['spritesheet-manifest'] },
      { id: 'deliver', title: 'Empacotar para o destino', capability: 'export.engine', dependsOn: ['atlas'], validators: ['destination-profile'] },
    ],
  },
  '3d-character-spritesheet': {
    title: 'Personagem 3D + spritesheet (contrato humanoide)',
    family: '3d',
    description: 'Contrato existente de 5 estágios: vistas de referência → geração 3D → auto-rig → animação → render 2D. Só o render tem adapter hoje; os demais ficam bloqueados com motivo nomeado.',
    destinationAware: true,
    preservesContract: 'humanoid-prompt-views-to-2d-v1',
    steps: [
      { id: 'reference-views', title: 'Vistas de referência', capability: 'image2d.generate-concept', requiresParam: 'prompt', validators: ['png-content'], reviewRequired: true, optional: true },
      { id: 'generate-3d', title: 'Gerar modelo 3D', capability: 'model3d.generate', dependsOn: ['reference-views'], validators: ['glb-structural'], protectedActions: ['download_models_or_weights', 'cost'] },
      { id: 'auto-rig', title: 'Auto-rigging', capability: 'rig3d.auto', dependsOn: ['generate-3d'], validators: ['glb-structural'] },
      { id: 'animate', title: 'Animações', capability: 'motion.cycles', dependsOn: ['auto-rig'], validators: ['animation-loop'] },
      { id: 'render-2d', title: 'Render 2D (spritesheet 8×3, 48×48)', capability: 'render3d.to2d', dependsOn: ['animate'], params: { frameSize: '48x48' }, validators: ['png-structural', 'png-content', 'spritesheet-manifest'], reviewRequired: true },
      { id: 'deliver', title: 'Empacotar para o destino', capability: 'export.engine', dependsOn: ['render-2d'], validators: ['destination-profile'] },
    ],
  },
  'ui-vfx-sheet': {
    title: 'UI/VFX (spritesheet procedural)',
    family: 'ui-vfx',
    description: 'Efeitos 2D procedurais determinísticos (explosão, fogo, faísca, fumaça, impacto, raio) empacotados em atlas, sem ferramenta externa.',
    destinationAware: true,
    steps: [
      { id: 'vfx', title: 'Gerar VFX procedural', capability: 'vfx2d.generate', params: { task: 'render-vfx', preset: 'explosion', size: 64, frameCount: 8 }, validators: ['png-content'] },
      { id: 'compose', title: 'Compor prévia sobre o fundo do produto', capability: 'image2d.compose', dependsOn: ['vfx'], params: { op: 'compose', background: [16, 0, 24, 255], output: 'vfx-preview-composed.png' }, validators: ['png-content'], optional: true },
      { id: 'deliver', title: 'Empacotar para o destino', capability: 'export.engine', dependsOn: ['vfx'], validators: ['destination-profile'] },
    ],
  },
  'variation-retexture': {
    title: 'Variações / retexture 2D',
    family: '2d',
    description: 'Gera variações de cor/recorte/contorno a partir de uma imagem existente e empacota por destino. Nenhuma IA é usada: as transformações são determinísticas e reversíveis.',
    destinationAware: true,
    steps: [
      { id: 'variation', title: 'Gerar variação de cor', capability: 'image2d.transform', params: { op: 'recolor', hueShift: 40 }, validators: ['png-content'] },
      { id: 'outline', title: 'Aplicar contorno', capability: 'image2d.transform', dependsOn: ['variation'], params: { op: 'outline' }, validators: ['png-content'], optional: true },
      { id: 'atlas', title: 'Empacotar variações em atlas', capability: 'render.atlas', dependsOn: ['variation', 'outline'], params: { task: 'pack-atlas', columns: 4 }, validators: ['spritesheet-manifest'] },
      { id: 'deliver', title: 'Empacotar para o destino', capability: 'export.engine', dependsOn: ['atlas'], validators: ['destination-profile'] },
    ],
  },
});

function aggregateRequirements(steps, registry) {
  const total = { ramMb: 0, vramMb: 0, diskMb: 0, unknown: [] };
  for (const step of steps) {
    const capability = registry.get(step.capability);
    const requirements = capability?.requirements ?? {};
    for (const field of ['ramMb', 'vramMb', 'diskMb']) {
      const value = requirements[field];
      if (value === null || value === undefined) {
        if (!total.unknown.includes(`${step.id}:${field}`)) total.unknown.push(`${step.id}:${field}`);
        continue;
      }
      total[field] = Math.max(total[field], value);
    }
  }
  return total;
}

/**
 * Planeja um workflow.
 *
 * @param {object} params
 * @param {string} params.workflowId um de WORKFLOW_IDS
 * @param {object} params.hub Hub já alimentado por descobertas
 * @param {object} params.registry Capability Registry
 * @param {string} [params.destination] destino (perfil de compatibilidade)
 * @param {object} [params.options] parâmetros do usuário (frameSize, actions, preset…)
 * @param {boolean} [params.allowRemote] autoriza backend remoto (padrão: não)
 */
export function planWorkflow({ workflowId, hub, registry, destination = null, options = {}, allowRemote = false, brief = null }) {
  const recipe = WORKFLOW_RECIPES[workflowId];
  if (!recipe) {
    throw new TypeError(`planWorkflow: workflow desconhecido "${workflowId}" (disponíveis: ${WORKFLOW_IDS.join(', ')})`);
  }
  if (!hub || typeof hub.select !== 'function') throw new TypeError('planWorkflow: hub obrigatório');
  if (!registry || typeof registry.get !== 'function') throw new TypeError('planWorkflow: registry obrigatório');

  const steps = [];
  const blockedSteps = [];
  const userActions = [];
  const requirementsSeen = [];
  const licenses = [];
  const costEntries = [];

  // Capacidade de cada passo e o que chega de montante (transitivamente): é isso
  // que diz se um atlas vem de frames 2D internos ou de renders 3D, e portanto que
  // adapter serve a este passo. O Hub recebe esse contexto e o repassa ao
  // `canHandle` de cada adapter — a escolha deixa de depender de ordem alfabética.
  const capabilityByStepId = new Map(recipe.steps.map((item) => [item.id, item.capability]));
  const upstreamCapabilitiesOf = (recipeStep) => {
    const seen = new Set();
    const stack = [...(recipeStep.dependsOn ?? [])];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      const upstream = recipe.steps.find((item) => item.id === id);
      if (upstream) stack.push(...(upstream.dependsOn ?? []));
    }
    return Object.freeze([...seen].map((id) => capabilityByStepId.get(id)).filter(Boolean));
  };

  for (const recipeStep of recipe.steps) {
    const capability = registry.get(recipeStep.capability);
    const params = { ...(recipeStep.params ?? {}), ...(options[recipeStep.id] ?? {}) };
    // A entrada fornecida pelo usuário entra nos params do passo: é por eles que
    // o engine alimenta o adapter (context.params é substituído por step.params).
    if (recipeStep.requiresParam) {
      const provided = options[recipeStep.requiresParam] ?? options[recipeStep.id]?.[recipeStep.requiresParam] ?? null;
      if (provided !== null && provided !== undefined) params[recipeStep.requiresParam] = provided;
      // O brief escrito pelo usuário É o texto do prompt: aceitá-lo evita pedir
      // duas vezes a mesma informação na interface.
      if (recipeStep.requiresParam === 'prompt' && params.prompt === undefined) {
        const briefText = typeof brief === 'string' ? brief.trim() : '';
        if (briefText.length >= 12) params.prompt = briefText.slice(0, 8000);
      }
    }

    // A seleção acontece DEPOIS de os params estarem completos (entrada do
    // usuário, brief como prompt): o contexto do passo é o que o Hub e os
    // adapters usam para dizer se servem a ele.
    const selection = hub.select(recipeStep.capability, {
      allowUnknown: false,
      allowRemote,
      context: Object.freeze({
        workflowId,
        family: recipe.family ?? null,
        stepId: recipeStep.id,
        params: Object.freeze({ ...params }),
        upstreamCapabilities: upstreamCapabilitiesOf(recipeStep),
        requiresParam: recipeStep.requiresParam ?? null,
        destination,
      }),
    });
    const candidate = selection.selected;

    const step = {
      id: recipeStep.id,
      title: recipeStep.title,
      capability: recipeStep.capability,
      capabilityStatus: capability?.status ?? null,
      adapter: candidate?.adapterId ?? null,
      adapterVersion: candidate?.adapterVersion ?? null,
      provider: candidate?.providers?.[0] ?? null,
      class: candidate?.class ?? null,
      dependsOn: [...(recipeStep.dependsOn ?? [])],
      params,
      validators: [...(recipeStep.validators ?? capability?.validators ?? [])],
      reviewRequired: recipeStep.reviewRequired === true,
      optional: recipeStep.optional === true,
      // De onde vem a entrada deste passo: null = produzida no próprio run.
      inputFrom: recipeStep.inputFrom ?? null,
      // Parâmetro que só o usuário pode fornecer (ex.: caminho do modelo 3D).
      requiresParam: recipeStep.requiresParam ?? null,
      missingParam: null,
      protectedActions: Object.freeze([...(recipeStep.protectedActions ?? [])]),
      resources: Object.freeze({
        ramMb: capability?.requirements?.ramMb ?? null,
        vramMb: capability?.requirements?.vramMb ?? null,
      }),
      license: candidate?.license ?? null,
      outputRights: candidate?.outputRights ?? null,
      cost: candidate?.cost ?? { status: 'unknown' },
      backends: candidate ? Object.freeze(candidate.backends.map((backend) => backend.kind)) : Object.freeze([]),
      blockedReason: null,
      // Candidatos com o motivo de quem não serve a este passo: a interface
      // mostra a escolha e o porquê das alternativas descartadas.
      candidates: Object.freeze((selection.candidates ?? []).map((item) => ({
        adapterId: item.adapterId,
        state: item.state,
        detail: item.discoveryDetail,
        applicable: item.applicable !== false,
        reason: item.applicabilityReason ?? null,
      }))),
    };

    // Entrada que vem de fora do run (ex.: rig revisado de um run anterior):
    // sem ela o passo é bloqueado no plano, com a ação que destrava — assim o
    // Studio explica antes de executar, em vez de falhar no meio do pipeline.
    // A entrada pode vir no topo das opções (`options.model`) ou no próprio
    // passo (`options.inspect.model`); o que não pode é o plano fingir que ela
    // existe quando não foi fornecida.
    const providedInput = params[recipeStep.requiresParam ?? ''] ?? options[recipeStep.requiresParam ?? ''] ?? null;
    if (recipeStep.requiresParam && !providedInput) {
      step.blockedReason = `Este passo precisa de "${recipeStep.requiresParam}", que só você pode fornecer (nada é baixado automaticamente).`;
      step.missingParam = recipeStep.requiresParam;
      blockedSteps.push({ id: step.id, capability: step.capability, reason: step.blockedReason, fallback: null });
      userActions.push({
        kind: 'provide-input',
        stepId: step.id,
        capabilityId: step.capability,
        title: `Informar "${recipeStep.requiresParam}"`,
        detail: step.blockedReason,
        param: recipeStep.requiresParam,
        requiresUserDecision: true,
        canBeAutomated: false,
      });
    }

    if (recipeStep.inputFrom === 'priorRun' && !options.fromRun) {
      step.blockedReason = 'Este passo reutiliza um resultado já revisado de outro run. Escolha o run de origem (ex.: "2d-character-parts" com o rig aprovado) e execute de novo.';
      blockedSteps.push({ id: step.id, capability: step.capability, reason: step.blockedReason, fallback: '2d-character-parts' });
      userActions.push({
        kind: 'provide-input',
        stepId: step.id,
        capabilityId: step.capability,
        title: 'Escolher o run de origem',
        detail: step.blockedReason,
        requiresUserDecision: true,
        canBeAutomated: false,
      });
    }

    if (!candidate) {
      step.blockedReason = step.blockedReason ?? selection.reason;
      if (!step.blockedReason || step.blockedReason === selection.reason) {
        blockedSteps.push({ id: step.id, capability: step.capability, reason: selection.reason, fallback: recipeStep.blockedFallback ?? null });
      }
      userActions.push({
        kind: capability?.status === 'proposed' ? 'decision' : 'install',
        stepId: step.id,
        capabilityId: step.capability,
        title: capability?.status === 'proposed'
          ? `Decidir provider para "${capability.title}"`
          : `Tornar "${capability?.title ?? step.capability}" utilizável`,
        detail: selection.reason,
        candidates: step.candidates,
        requiresUserDecision: true,
        canBeAutomated: false,
      });
    } else {
      if (candidate.license) licenses.push({ adapterId: candidate.adapterId, license: candidate.license, scope: candidate.licenseScope ?? null, weights: candidate.weightsLicense ?? null, outputRights: candidate.outputRights ?? null });
      if (candidate.cost) costEntries.push({ stepId: step.id, adapterId: candidate.adapterId, ...candidate.cost });
      if (candidate.requiresAuthorization) {
        userActions.push({
          kind: 'authorization',
          stepId: step.id,
          capabilityId: step.capability,
          title: `Autorizar ${candidate.title}`,
          detail: candidate.class === 'remote-service'
            ? 'Backend remoto: exige autorização explícita de envio de dados e de custo.'
            : 'Adapter exige autorização para ação protegida antes de executar.',
          requiresUserDecision: true,
          canBeAutomated: false,
        });
      }
    }
    if (capability) requirementsSeen.push({ stepId: step.id, ...capability.requirements });
    steps.push(step);
  }

  const protectedActions = [...new Set(steps.flatMap((step) => step.protectedActions))].filter((action) => PROTECTED_ACTIONS.includes(action));
  const requirements = aggregateRequirements(steps, registry);

  return Object.freeze({
    schemaVersion: ORCHESTRATOR_SCHEMA_VERSION,
    id: workflowId,
    title: recipe.title,
    family: recipe.family,
    description: recipe.description,
    preservesContract: recipe.preservesContract ?? null,
    brief: brief ?? null,
    destination,
    destinationAware: recipe.destinationAware === true,
    steps: Object.freeze(steps),
    blocked: blockedSteps.length > 0,
    blockedSteps: Object.freeze(blockedSteps),
    userActions: Object.freeze(userActions),
    requirements: Object.freeze({
      ramMb: requirements.ramMb || null,
      vramMb: requirements.vramMb || null,
      diskMb: requirements.diskMb || null,
      unknown: Object.freeze(requirements.unknown),
      perStep: Object.freeze(requirementsSeen),
    }),
    cost: Object.freeze({
      status: costEntries.some((entry) => entry.status === 'known') ? 'known' : costEntries.length ? 'unknown' : 'not-applicable',
      entries: Object.freeze(costEntries),
      note: 'Nenhum preço foi medido nesta base de código; custo conhecido só quando o adapter declara valor e unidade.',
    }),
    licenses: Object.freeze(licenses),
    protectedActions: Object.freeze(protectedActions),
    reviewGates: Object.freeze(steps.filter((step) => step.reviewRequired).map((step) => step.id)),
    // Entradas que só o usuário pode fornecer (arquivo, run de origem, decisão).
    // Aparecem aqui para o Studio pedir antes de executar, não depois de falhar.
    pendingInputs: Object.freeze(userActions
      .filter((action) => action.kind === 'provide-input')
      .map((action) => ({ stepId: action.stepId, title: action.title, detail: action.detail, param: action.param ?? null }))),
    validators: Object.freeze([...new Set(steps.flatMap((step) => step.validators))]),
    parallelizable: Object.freeze(steps.filter((step) => !step.dependsOn.length).map((step) => step.id)),
    note: 'Plano produzido pelo Orchestrator: nada foi executado, instalado, baixado nem enviado.',
  });
}

/** Lista os workflows disponíveis com o estado real de cada um. */
export function listWorkflows({ hub, registry }) {
  return Object.freeze(WORKFLOW_IDS.map((workflowId) => {
    const recipe = WORKFLOW_RECIPES[workflowId];
    const states = recipe.steps.map((step) => {
      const selection = hub.select(step.capability, { allowUnknown: false, allowRemote: false });
      return { stepId: step.id, capability: step.capability, state: selection.selected ? 'ready' : 'blocked', adapter: selection.selected?.adapterId ?? null, reason: selection.reason };
    });
    return Object.freeze({
      id: workflowId,
      title: recipe.title,
      family: recipe.family,
      description: recipe.description,
      steps: states.length,
      ready: states.filter((state) => state.state === 'ready').length,
      // Entradas que só o usuário fornece: o workflow tem adapters prontos, mas
      // precisa que a pessoa escolha o arquivo/run de origem.
      needsInput: Object.freeze(recipe.steps
        .filter((step) => step.requiresParam || step.inputFrom)
        .map((step) => ({ stepId: step.id, param: step.requiresParam ?? null, kind: step.inputFrom ?? null }))),
      blocked: states.filter((state) => state.state === 'blocked').length,
      executableNow: states.every((state) => state.state === 'ready'),
      states: Object.freeze(states),
    });
  }));
}
