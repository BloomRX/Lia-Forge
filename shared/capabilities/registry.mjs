/**
 * Capability Registry do Lia Forge (F1).
 *
 * Catálogo versionado e puro de capacidades de produção. Não conhece
 * ferramentas: uma capacidade existe mesmo sem nenhum provider/adapters, e a
 * ligação capacidade → adapter é feita pelo Provider/Tool Hub em tempo de
 * planejamento. Nenhuma capacidade declarada aqui implica implementação,
 * execução ou validação; o campo `status` e a lista `providers` dizem exatamente
 * o que existe hoje.
 *
 * Regras herdadas de T12 §1 e do ADR-001:
 * - ids estáveis, sem enum global de tipos de asset;
 * - requisitos desconhecidos permanecem `null` (nunca zero inventado);
 * - capacidades propostas em T11 mantêm `status: 'proposed'` até aprovação;
 * - nada aqui executa, instala, baixa ou chama serviços.
 */

const CAPABILITY_SCHEMA_VERSION = 1;

const FAMILIES = Object.freeze([
  '2d', '2.5d', '3d', 'character', 'rigging-motion', 'render-export', 'ui-vfx',
]);
const CAPABILITY_STATUSES = Object.freeze([
  'implemented',      // existe código executável no checkout para a capacidade
  'partial',          // existe código real que cobre apenas parte dela
  'proposed',         // proposta registrada (T11/T12) aguardando decisão humana
  'planned',          // parte da visão/roadmap, sem código
]);

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

function fail(field, reason) {
  throw new TypeError(`capability.${field}: ${reason}`);
}

function assertText(value, field, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    fail(field, 'must be a non-empty string');
  }
  return value;
}

function assertList(value, field, { ofIds = false, optional = false } = {}) {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value)) fail(field, 'must be an array');
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || !item.trim()) fail(`${field}[${index}]`, 'must be a non-empty string');
    if (ofIds && !ID_PATTERN.test(item)) fail(`${field}[${index}]`, 'must be a stable id');
    if (seen.has(item)) fail(`${field}[${index}]`, 'entries must be unique');
    seen.add(item);
  }
  return [...value];
}

function assertNullableNumber(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(field, 'must be a non-negative finite number or null');
  }
  return value;
}

function validateRequirements(value = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('requirements', 'must be a plain object');
  }
  return Object.freeze({
    os: value.os === undefined ? null : assertList(value.os, 'requirements.os'),
    gpu: value.gpu === undefined ? null : assertList(value.gpu, 'requirements.gpu'),
    vramMb: assertNullableNumber(value.vramMb, 'requirements.vramMb'),
    ramMb: assertNullableNumber(value.ramMb, 'requirements.ramMb'),
    diskMb: assertNullableNumber(value.diskMb, 'requirements.diskMb'),
    network: value.network === true,
    runtimes: assertList(value.runtimes, 'requirements.runtimes', { optional: true }),
    tools: assertList(value.tools, 'requirements.tools', { optional: true }),
  });
}

function validateCapability(definition) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    fail('definition', 'must be a plain object');
  }
  const id = assertText(definition.id, 'id');
  if (!ID_PATTERN.test(id)) fail('id', 'must match [a-z0-9][a-z0-9._-]*');
  const family = assertText(definition.family, 'family');
  if (!FAMILIES.includes(family)) fail('family', `must be one of ${FAMILIES.join(', ')}`);
  const status = definition.status === undefined ? 'planned' : definition.status;
  if (!CAPABILITY_STATUSES.includes(status)) fail('status', `must be one of ${CAPABILITY_STATUSES.join(', ')}`);
  return Object.freeze({
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    id,
    family,
    status,
    title: assertText(definition.title, 'title'),
    description: assertText(definition.description, 'description', { allowEmpty: true }),
    inputs: assertList(definition.inputs, 'inputs', { optional: true }),
    outputs: assertList(definition.outputs, 'outputs', { optional: true }),
    dependencies: assertList(definition.dependencies, 'dependencies', { ofIds: true, optional: true }),
    validators: assertList(definition.validators, 'validators', { ofIds: true, optional: true }),
    providers: assertList(definition.providers, 'providers', { ofIds: true, optional: true }),
    consumers: assertList(definition.consumers, 'consumers', { optional: true }),
    requirements: validateRequirements(definition.requirements),
    maturity: definition.maturity === undefined ? 'experimental' : assertText(definition.maturity, 'maturity'),
    priority: definition.priority === undefined ? null : assertText(definition.priority, 'priority'),
    evidence: assertText(definition.evidence, 'evidence', { allowEmpty: true }),
    limitations: assertList(definition.limitations, 'limitations', { optional: true }),
  });
}

/** Catálogo base consolidado de T12 §1 (nenhuma capacidade inventada). */
const BASE_CAPABILITIES = Object.freeze([
  // ---------------------------------------------------------------- 2D
  { id: 'image2d.generate-concept', family: '2d', status: 'implemented', title: 'Conceito/imagem 2D por difusão', description: 'Gera PNG conceitual a partir de brief/prompt com checkpoint já instalado escolhido pelo usuário.', inputs: ['brief', 'prompt', 'checkpoint-instalado'], outputs: ['image/png'], validators: ['png-structural', 'png-content'], providers: ['comfyui-concept'], consumers: ['studio', 'jogo', 'ui'], requirements: { ramMb: 8192, vramMb: 4096, tools: ['comfyui'] }, maturity: 'beta', priority: 'nucleo', evidence: 'electron/main.cjs adapter comfyui-concept; execução real BLOCKED sem servidor ComfyUI', limitations: ['conceito não é prancha ortográfica', 'não gera modelo/rig'] },
  { id: 'image2d.transform', family: '2d', status: 'implemented', title: 'Transformações locais de imagem 2D', description: 'Recorte, redimensionamento, conversão, remoção de fundo por cor-chave, variações de cor e composição — determinístico, local, sem dependências externas.', inputs: ['image/png'], outputs: ['image/png'], validators: ['png-structural', 'png-content'], providers: ['local-image-ops'], consumers: ['studio', 'jogo', 'ui'], requirements: { ramMb: 512 }, maturity: 'beta', priority: 'nucleo', evidence: 'shared/imaging (implementado na T13)', limitations: ['sem IA: cor-chave e geometria apenas'] },
  { id: 'image2d.illustration', family: '2d', status: 'planned', title: 'Ilustração e pintura 2D', description: 'Arte final 2D produzida em editor manual ou provider de imagem.', inputs: ['brief', 'referencias'], outputs: ['image/png', 'image/psd'], providers: [], consumers: ['jogo', 'ui'], requirements: {}, maturity: 'experimental', priority: 'media', evidence: 'T12 §1.1', limitations: ['editor manual não é operado pelo Forge'] },
  { id: 'image2d.pixel-art', family: '2d', status: 'planned', title: 'Pixel art', description: 'Sprites em paleta e grade controladas.', inputs: ['brief', 'paleta', 'grid'], outputs: ['image/png'], providers: [], consumers: ['jogo'], requirements: {}, maturity: 'experimental', priority: 'baixa-media', evidence: 'T12 §1.1' },
  { id: 'image2d.tileset', family: '2d', status: 'planned', title: 'Tilesets', description: 'Conjuntos de tiles sem costura.', inputs: ['brief', 'grid'], outputs: ['image/png', 'atlas'], providers: [], consumers: ['jogo'], requirements: {}, maturity: 'experimental', priority: 'baixa-media', evidence: 'T12 §1.1' },
  { id: 'image2d.icon', family: '2d', status: 'planned', title: 'Ícones', description: 'Ícones em grades de tamanho.', inputs: ['brief', 'tamanhos'], outputs: ['image/png', 'image/svg'], providers: [], consumers: ['ui'], requirements: {}, maturity: 'experimental', priority: 'baixa', evidence: 'T12 §1.1' },
  { id: 'image2d.scenario', family: '2d', status: 'planned', title: 'Cenários e fundos em camadas', description: 'Fundo/parallax com separação estático/dinâmico.', inputs: ['imagem', 'referencias'], outputs: ['camadas', 'image/png'], dependencies: ['image2d.decompose-layers'], providers: [], consumers: ['jogo', 'video'], requirements: {}, maturity: 'experimental', priority: 'baixa-media', evidence: 'T12 §1.1; fronteira 1.2' },
  { id: 'image2d.decompose-layers', family: '2d', status: 'proposed', title: 'Separação de camadas com reconstrução de oclusões', description: 'Parte a imagem em camadas RGBA com máscaras editáveis e regiões ocultas rotuladas como reconstruídas.', inputs: ['image/png autorizada'], outputs: ['camadas', 'mascaras'], validators: ['layers-integrity'], providers: [], consumers: ['rig2d.build', 'ui-vfx'], requirements: { vramMb: null, ramMb: 4096 }, maturity: 'experimental', priority: 'alta', evidence: 'T11 fluxo A/B; proposta não aprovada', limitations: ['pesos licenciados pendentes', 'gate humano de máscaras obrigatório'] },
  { id: 'image2d.compose', family: '2d', status: 'implemented', title: 'Composição de camadas', description: 'Combina camadas/frames em uma imagem ou atlas com ordem e offsets declarados.', inputs: ['camadas'], outputs: ['image/png'], validators: ['png-structural'], providers: ['local-image-ops'], consumers: ['render-export', 'ui-vfx'], requirements: { ramMb: 512 }, maturity: 'beta', priority: 'nucleo', evidence: 'shared/imaging (T13)' },

  // ---------------------------------------------------------------- 2.5D
  { id: 'image2d.decompose-parts', family: '2.5d', status: 'implemented', title: 'Separação de partes por conectividade', description: 'Divide sprite em partes por componentes conectados de alpha (heurística determinística), base para rig 2D.', inputs: ['image/png'], outputs: ['partes', 'ordem-de-oclusao'], validators: ['layers-integrity'], providers: ['local-image-ops'], consumers: ['rig2d.build'], requirements: { ramMb: 512 }, maturity: 'beta', priority: 'alta', evidence: 'shared/imaging (T13)', limitations: ['heurística: partes encostadas viram uma só', 'gate humano obrigatório'] },
  { id: 'occlusion.inpaint', family: '2.5d', status: 'proposed', title: 'Reconstrução de regiões ocultas', description: 'Preenche pixels sob oclusão, sempre rotulados como conteúdo gerado.', inputs: ['partes'], outputs: ['partes-completas'], providers: [], consumers: ['rig2d.build'], requirements: {}, maturity: 'experimental', priority: 'alta', evidence: 'T12 §1.2; proposta não aprovada' },
  { id: 'rig2d.build', family: '2.5d', status: 'implemented', title: 'Construção de rig 2D esquelético', description: 'Gera esqueleto, hierarquia, pivôs e pesos por camada a partir de partes; assistido e editável.', inputs: ['partes'], outputs: ['rig2d/json'], validators: ['rig2d-structural'], providers: ['rig2d-software'], consumers: ['rig2d.animate', 'render-export'], requirements: { ramMb: 512 }, maturity: 'beta', priority: 'alta', evidence: 'shared/rig2d (T13)', limitations: ['auto-rig heurístico; revisão de juntas é gate humano'] },
  { id: 'rig2d.deform', family: '2.5d', status: 'implemented', title: 'Deformação/meshes 2D', description: 'Aplica transforms afins por osso sobre camadas rasterizadas (software renderer).', inputs: ['rig2d/json', 'keyframes'], outputs: ['frames'], providers: ['rig2d-software'], consumers: ['render.atlas'], requirements: { ramMb: 512 }, maturity: 'beta', priority: 'alta', evidence: 'shared/rig2d/render (T13)', limitations: ['afim por osso, sem skinning suave ainda'] },
  { id: 'rig2d.animate', family: '2.5d', status: 'implemented', title: 'Animação 2D por keyframes', description: 'Ciclos e ações definidos por keyframes de ossos (rotação/translação/escala).', inputs: ['rig2d/json', 'acoes'], outputs: ['keyframes', 'frames'], validators: ['animation-loop'], providers: ['rig2d-software'], consumers: ['render.atlas'], requirements: { ramMb: 512 }, maturity: 'beta', priority: 'alta', evidence: 'shared/rig2d (T13)' },
  { id: 'rig2d.animate-assisted', family: '2.5d', status: 'proposed', title: 'Animação 2D assistida por IA sobre rig editável', description: 'Modelo/gerador propõe keyframes sobre formato editável; limpeza manual obrigatória.', inputs: ['rig2d/json', 'descricao'], outputs: ['keyframes'], providers: [], consumers: ['rig2d.animate'], requirements: {}, maturity: 'experimental', priority: 'media-alta', evidence: 'T11 fluxo C; proposta não aprovada', limitations: ['fallback manual mantido'] },
  { id: 'rig2d.expressions', family: '2.5d', status: 'planned', title: 'Expressões faciais 2D', description: 'Blendshapes/keys faciais sobre rig 2D.', inputs: ['rig2d/json'], outputs: ['keyframes-faciais'], providers: [], consumers: ['rig2d.animate'], requirements: {}, maturity: 'experimental', priority: 'media', evidence: 'T12 §1.2' },
  { id: 'rig2d.compose', family: '2.5d', status: 'implemented', title: 'Personagem modular 2D (skins/variantes)', description: 'Um rig-template com peças intercambiáveis; animações compartilhadas entre variantes.', inputs: ['rig2d/json', 'pecas'], outputs: ['variantes'], validators: ['rig2d-structural'], providers: ['rig2d-software'], consumers: ['render-export'], requirements: { ramMb: 512 }, maturity: 'beta', priority: 'alta', evidence: 'shared/rig2d/modular (T13)' },

  // ---------------------------------------------------------------- 3D
  { id: 'model3d.inspect', family: '3d', status: 'implemented', title: 'Inspeção de modelo 3D (GLB)', description: 'Lê chunks GLB e reporta meshes, materiais, animações, nós e extensões sem Blender.', inputs: ['model/gltf-binary'], outputs: ['relatorio/json'], validators: ['glb-structural'], providers: ['glb-inspect'], consumers: ['studio', 'render-export'], requirements: { ramMb: 512 }, maturity: 'beta', priority: 'nucleo', evidence: 'electron/workflow-runner.cjs validateGlb + shared/model3d (T13)' },
  { id: 'model3d.generate', family: '3d', status: 'partial', title: 'Geração de modelo 3D a partir de imagem/texto', description: 'Passo contratual generate-3d existe e fica bloqueado sem provider/adapter.', inputs: ['imagens', 'prompt'], outputs: ['model/gltf-binary'], providers: [], consumers: ['model3d.retopologize'], requirements: { vramMb: 16384, diskMb: 17000 }, maturity: 'experimental', priority: 'alta', evidence: 'electron/workflow-contracts.cjs (bloqueado); T10 E1', limitations: ['~16,5 GB de pesos', 'gfx803 sem referência'] },
  { id: 'model3d.model', family: '3d', status: 'planned', title: 'Modelagem manual', description: 'Modelagem em DCC externo registrada como artefato.', inputs: ['brief'], outputs: ['model/*'], providers: [], consumers: ['model3d.uv'], requirements: {}, maturity: 'experimental', priority: 'media', evidence: 'T12 §1.3' },
  { id: 'model3d.retopologize', family: '3d', status: 'planned', title: 'Retopologia/LOD', description: 'Reduz malha para contagem de triângulos de jogo.', inputs: ['model/*'], outputs: ['model/*'], providers: [], consumers: ['model3d.uv'], requirements: {}, maturity: 'experimental', priority: 'alta', evidence: 'T12 §1.3; candidatos GPL exigem decisão' },
  { id: 'model3d.uv', family: '3d', status: 'planned', title: 'UV', description: 'Desdobramento sem sobreposição.', inputs: ['model/*'], outputs: ['model/*'], providers: [], consumers: ['model3d.texture'], requirements: {}, maturity: 'experimental', priority: 'alta', evidence: 'T12 §1.3' },
  { id: 'model3d.texture', family: '3d', status: 'planned', title: 'Texturização', description: 'Texturas a partir de referência.', inputs: ['model/*', 'referencias'], outputs: ['image/*'], providers: [], consumers: ['material.pbr'], requirements: {}, maturity: 'experimental', priority: 'alta', evidence: 'T12 §1.3' },
  { id: 'material.pbr', family: '3d', status: 'planned', title: 'Materiais PBR', description: 'Conjunto de mapas PBR com resolução/espaço declarados.', inputs: ['texturas'], outputs: ['material'], providers: [], consumers: ['render3d.frame'], requirements: {}, maturity: 'experimental', priority: 'alta', evidence: 'T12 §1.3' },
  { id: 'model3d.bake', family: '3d', status: 'planned', title: 'Baking de mapas', description: 'Normal/AO/curvature de high para low.', inputs: ['model/*'], outputs: ['image/*'], providers: [], consumers: ['material.pbr'], requirements: {}, maturity: 'experimental', priority: 'media', evidence: 'T12 §1.3' },
  { id: 'model3d.optimize', family: '3d', status: 'planned', title: 'Otimização/decimação', description: 'LODs e decimação com contagem declarada.', inputs: ['model/*'], outputs: ['model/*'], providers: [], consumers: ['model3d.export'], requirements: {}, maturity: 'experimental', priority: 'media', evidence: 'T12 §1.3' },
  { id: 'model3d.export', family: '3d', status: 'partial', title: 'Exportação de modelo', description: 'Formatos aceitos pelo renderer e manifesto de importação por destino.', inputs: ['model/*'], outputs: ['model/*', 'manifesto'], validators: ['format-allowlist'], providers: ['blender-spritesheet', 'export-package'], consumers: ['destinos'], requirements: {}, maturity: 'beta', priority: 'alta', evidence: 'renderer aceita blend/glb/gltf/fbx/obj/stl' },
  { id: 'env.reconstruct', family: '3d', status: 'planned', title: 'Reconstrução de ambiente', description: 'Ambientes a partir de imagens; candidatos hospedados e pagos.', inputs: ['imagens'], outputs: ['mesh', 'splat'], providers: [], consumers: ['image2d.scenario'], requirements: {}, maturity: 'experimental', priority: 'baixa', evidence: 'T12 §1.3; fronteira 2.2' },
  { id: 'splat.ingest', family: '3d', status: 'planned', title: 'Ingestão de gaussian splats', description: 'Registra .spz/.ply como representação, nunca como malha/colisão.', inputs: ['splat'], outputs: ['artefato'], providers: [], consumers: ['env.reconstruct'], requirements: {}, maturity: 'experimental', priority: 'baixa', evidence: 'T12 §1.3' },

  // ---------------------------------------------------------------- personagens
  { id: 'character.humanoid', family: 'character', status: 'partial', title: 'Pipeline humanoide completo', description: 'Contrato de 5 estágios (vistas → 3D → rig → animação → 2D); só o render tem adapter.', inputs: ['brief', 'prompt'], outputs: ['spritesheet', 'manifesto'], validators: ['png-structural', 'png-content', 'spritesheet-manifest'], providers: ['blender-spritesheet'], consumers: ['jogo', 'lia-desktop'], requirements: { tools: ['blender'] }, maturity: 'beta', priority: 'nucleo', evidence: 'electron/workflow-contracts.cjs', limitations: ['4 estágios bloqueados sem provider'] },
  { id: 'character.creature', family: 'character', status: 'planned', title: 'Criaturas e animais', description: 'Rota não bípede; taxonomia de código ainda não os representa.', inputs: ['brief'], outputs: ['model/*'], providers: [], consumers: ['character.humanoid'], requirements: {}, maturity: 'experimental', priority: 'media', evidence: 'T12 §1.4' },
  { id: 'character.hair', family: 'character', status: 'planned', title: 'Cabelo e hair cards', description: 'Cards/hair com ordem de draw e sem gaps.', inputs: ['model/*'], outputs: ['model/*'], providers: [], consumers: ['character.humanoid'], requirements: {}, maturity: 'experimental', priority: 'media', evidence: 'CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D §4' },
  { id: 'character.clothing', family: 'character', status: 'planned', title: 'Roupas, acessórios e armaduras', description: 'Peças como attachments/skins sobre rig-base.', inputs: ['rig', 'pecas'], outputs: ['variantes'], providers: [], consumers: ['character.modularity'], requirements: {}, maturity: 'experimental', priority: 'alta', evidence: 'T12 §1.4' },
  { id: 'character.modularity', family: 'character', status: 'implemented', title: 'Modularidade e variantes', description: 'Rig compartilhado com peças intercambiáveis sem duplicar pipeline.', inputs: ['rig', 'catalogo-de-pecas'], outputs: ['variantes'], validators: ['rig2d-structural'], providers: ['rig2d-software'], consumers: ['render-export'], requirements: { ramMb: 512 }, maturity: 'beta', priority: 'alta', evidence: 'shared/rig2d/modular (T13)' },

  // ---------------------------------------------------------------- rigging e movimento
  { id: 'rig3d.auto', family: 'rigging-motion', status: 'partial', title: 'Auto-rigging 3D', description: 'Passo contratual auto-rig existe e fica bloqueado sem provider.', inputs: ['model/*'], outputs: ['model/* rigged'], providers: [], consumers: ['motion.generate'], requirements: {}, maturity: 'experimental', priority: 'alta', evidence: 'electron/workflow-contracts.cjs (bloqueado)' },
  { id: 'rig3d.manual', family: 'rigging-motion', status: 'planned', title: 'Rigging manual', description: 'Rig produzido em DCC e registrado.', inputs: ['model/*'], outputs: ['model/* rigged'], providers: [], consumers: ['motion.generate'], requirements: {}, maturity: 'experimental', priority: 'media', evidence: 'T12 §1.5' },
  { id: 'motion.retarget', family: 'rigging-motion', status: 'planned', title: 'Retargeting de movimento', description: 'Clips para rig-alvo sem foot sliding.', inputs: ['clips', 'rig'], outputs: ['clips'], providers: [], consumers: ['motion.cycles'], requirements: {}, maturity: 'experimental', priority: 'alta', evidence: 'T12 §1.5' },
  { id: 'motion.generate', family: 'rigging-motion', status: 'planned', title: 'Geração de movimento (texto/poses)', description: 'Candidatos CPU/Vulkan (motion-bricks.cpp, kimodo.cpp) condicionados a licença e validação.', inputs: ['texto', 'poses'], outputs: ['clips'], providers: [], consumers: ['motion.cycles'], requirements: { ramMb: 2048 }, maturity: 'experimental', priority: 'media-alta', evidence: 'T12 §2.1 (registro 2026-11-12)', limitations: ['SOMA/G1 apenas; retarget obrigatório', 'pesos com download por padrão exigem consentimento'] },
  { id: 'motion.from-video', family: 'rigging-motion', status: 'planned', title: 'Movimento a partir de vídeo', description: 'Captura com confiança declarada; vídeo nunca substitui rig.', inputs: ['video'], outputs: ['clips'], providers: [], consumers: ['motion.retarget'], requirements: {}, maturity: 'experimental', priority: 'baixa', evidence: 'T12 §1.5' },
  { id: 'motion.cycles', family: 'rigging-motion', status: 'implemented', title: 'Ciclos e ações nomeadas', description: 'Resolução de ações por token com rejeição de ambiguidade (idle/walk/run).', inputs: ['rig', 'acoes'], outputs: ['frames', 'clips'], validators: ['animation-loop'], providers: ['blender-spritesheet', 'rig2d-software'], consumers: ['render.atlas'], requirements: {}, maturity: 'beta', priority: 'nucleo', evidence: 'scripts/blender_spritesheet.py matching_actions; 4/4 unittest T10' },
  { id: 'motion.edit', family: 'rigging-motion', status: 'planned', title: 'Edição de movimento', description: 'Limpeza de keys e timing sobre clips editáveis.', inputs: ['clips'], outputs: ['clips'], providers: [], consumers: ['motion.cycles'], requirements: {}, maturity: 'experimental', priority: 'alta', evidence: 'T12 §1.5' },

  // ---------------------------------------------------------------- render e export
  { id: 'render3d.frame', family: 'render-export', status: 'implemented', title: 'Render 3D de frames', description: 'EEVEE Next com fallback EEVEE, câmera ortográfica e area light.', inputs: ['cena'], outputs: ['image/png'], validators: ['png-structural'], providers: ['blender-spritesheet'], consumers: ['render.atlas'], requirements: { tools: ['blender'] }, maturity: 'beta', priority: 'nucleo', evidence: 'scripts/blender_spritesheet.py configure_render' },
  { id: 'render3d.to2d', family: 'render-export', status: 'implemented', title: '3D para 2D (spritesheet)', description: 'Modelo + ações → atlas com contrato 384×144 / 8×3 / 24 frames / 48×48 quando o perfil pedir.', inputs: ['model/*', 'acoes', 'frame-size'], outputs: ['image/png', 'manifesto'], validators: ['png-structural', 'png-content', 'spritesheet-manifest'], providers: ['blender-spritesheet'], consumers: ['jogo', 'lia-desktop'], requirements: { tools: ['blender'] }, maturity: 'beta', priority: 'nucleo', evidence: 'T10 VERIFIED_IN_FORGE (estrutural); render real BLOCKED sem Blender/asset' },
  { id: 'render.turntable', family: 'render-export', status: 'partial', title: 'Turntable', description: 'Sequência de ângulos equidistantes (--turntable-frames).', inputs: ['model/*'], outputs: ['frames'], providers: ['blender-spritesheet'], consumers: ['studio'], requirements: { tools: ['blender'] }, maturity: 'beta', priority: 'media', evidence: 'scripts/blender_spritesheet.py' },
  { id: 'render.atlas', family: 'render-export', status: 'implemented', title: 'Empacotamento de atlas', description: 'Frames → atlas + manifesto com grade e pivôs.', inputs: ['frames'], outputs: ['image/png', 'manifesto'], validators: ['spritesheet-manifest', 'png-content'], providers: ['blender-spritesheet', 'rig2d-software'], consumers: ['export.engine'], requirements: {}, maturity: 'beta', priority: 'nucleo', evidence: 'pack_atlas + validadores' },
  { id: 'export.sequence', family: 'render-export', status: 'planned', title: 'Sequência de frames', description: 'Frames numerados com FPS declarado.', inputs: ['frames'], outputs: ['sequencia'], providers: [], consumers: ['destinos'], requirements: {}, maturity: 'experimental', priority: 'media', evidence: 'T12 §1.6' },
  { id: 'export.engine', family: 'render-export', status: 'implemented', title: 'Exportação por destino', description: 'Pacote + manifesto de importação segundo perfil de compatibilidade do destino (escala, eixos, unidades, FPS, root motion).', inputs: ['artefatos aprovados', 'perfil-de-destino'], outputs: ['pacote', 'manifesto'], validators: ['destination-profile'], providers: ['export-package'], consumers: ['godot', 'unity', 'unreal', 'lia-desktop', 'jogo', 'video'], requirements: {}, maturity: 'beta', priority: 'alta', evidence: 'shared/destinations + export-package (T13)' },

  // ---------------------------------------------------------------- UI e VFX
  { id: 'ui2d.animate', family: 'ui-vfx', status: 'proposed', title: 'Animação de UI (tweens/state machine)', description: 'Estados e transições de interface sem esqueleto.', inputs: ['pecas', 'estados'], outputs: ['state-machine', 'atlas'], providers: [], consumers: ['ui'], requirements: {}, maturity: 'experimental', priority: 'media', evidence: 'T11 fluxo E; proposta não aprovada' },
  { id: 'vfx2d.generate', family: 'ui-vfx', status: 'implemented', title: 'VFX 2D procedurais', description: 'Partículas/explosões/raios/fogo como spritesheets procedurais determinísticos (software renderer).', inputs: ['parametros'], outputs: ['image/png', 'manifesto'], validators: ['png-content', 'spritesheet-manifest'], providers: ['rig2d-software'], consumers: ['jogo', 'ui'], requirements: { ramMb: 512 }, maturity: 'beta', priority: 'media', evidence: 'shared/vfx (T13)', limitations: ['procedural: não substitui direção de arte'] },
]);

function createCapabilityRegistry(definitions = BASE_CAPABILITIES) {
  if (!Array.isArray(definitions)) fail('definitions', 'must be an array');
  const byId = new Map();
  const entries = [];
  for (const definition of definitions) {
    const capability = validateCapability(definition);
    if (byId.has(capability.id)) fail('definitions', `duplicate capability id: ${capability.id}`);
    byId.set(capability.id, capability);
    entries.push(capability);
  }
  for (const capability of entries) {
    for (const dependency of capability.dependencies) {
      if (!byId.has(dependency)) fail(`dependencies`, `capability ${capability.id} depends on unknown ${dependency}`);
    }
  }
  const frozen = Object.freeze([...entries]);
  return Object.freeze({
    schemaVersion: CAPABILITY_SCHEMA_VERSION,
    has: (id) => typeof id === 'string' && byId.has(id),
    get: (id) => (typeof id === 'string' ? byId.get(id) ?? null : null),
    list: () => frozen,
    byFamily: (family) => Object.freeze(frozen.filter((item) => item.family === family)),
    families: () => Object.freeze([...FAMILIES]),
    requirementsOf: (id) => byId.get(id)?.requirements ?? null,
    validatorsFor: (id) => Object.freeze([...(byId.get(id)?.validators ?? [])]),
    providersFor: (id) => Object.freeze([...(byId.get(id)?.providers ?? [])]),
    /** Capacidades que consomem a capacidade informada (impacto de mudança). */
    dependentsOf: (id) => Object.freeze(frozen.filter((item) => item.dependencies.includes(id)).map((item) => item.id)),
  });
}

export {
  BASE_CAPABILITIES,
  CAPABILITY_SCHEMA_VERSION,
  CAPABILITY_STATUSES,
  FAMILIES,
  createCapabilityRegistry,
  validateCapability,
};
