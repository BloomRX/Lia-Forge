# 08 — Matriz de funcionalidades e viabilidade

> **Classificação principal** usa exatamente os rótulos da missão: `JÁ IMPLEMENTADO`, `NATIVO THREE.JS`, `BIBLIOTECA COMPLEMENTAR`, `DESENVOLVIMENTO LIA`, `ADAPTER EXTERNO`, `BLENDER`, `RESEARCH ONLY`, `NÃO RECOMENDADO`.
> **Apoio:** o que mais é necessário para entregar a linha.
> **Fase** segue [`11-PLANO-POR-FASES.md`](11-PLANO-POR-FASES.md): 1 = viewport/visualização; 2 = seleção/hierarquia/transformações; 3 = materiais/texturas; 4 = personagens/esqueletos/animações; 5 = workflows/Blender/QA; `pós` = pesquisa não comprometida; `—` = não se aplica.
> **Esforço** é hipótese (S ≤ 1 semana · M 2–4 semanas · L 1–2 meses · XL > 2 meses, uma pessoa), não estimativa aprovada.
> **Risco** é o risco de produto/técnico se for feito ingenuamente.

## A. Viewport

| # | Funcionalidade | Classificação principal | Apoio | Fase | Esforço | Risco |
|---|---|---|---|---|---|---|
| A1 | Navegação orbital (rotate/pan/zoom) | `NATIVO THREE.JS` (`OrbitControls`) | `DESENVOLVIMENTO LIA` (UX/limites) | 1 | S | Baixo |
| A2 | Perspectiva ↔ ortográfica | `NATIVO THREE.JS` | `DESENVOLVIMENTO LIA` | 1 | S | Médio (recalcular frustum/zoom) |
| A3 | Grade e eixos | `NATIVO THREE.JS` | — | 1 | S | Baixo |
| A4 | Wireframe / modos de visualização | `NATIVO THREE.JS` | `DESENVOLVIMENTO LIA` | 1 | S | Baixo |
| A5 | Seleção por clique | `NATIVO THREE.JS` (`Raycaster`) | `DESENVOLVIMENTO LIA` | 2 | M | Médio (bounds de skinning) |
| A6 | Hierarquia de cena navegável | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` | 2 | M | Médio (nomes duplicados/vazios) |
| A7 | Foco no objeto selecionado | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` | 2 | S | Baixo |
| A8 | Transformar (mover/rotacionar/escalar) | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` (`TransformControls`) | 2 | M | Alto (contrato de edição, undo) |
| A9 | Gizmos de eixos/view cube | `NATIVO THREE.JS` (`ViewHelper`) | — | 2 | S | Baixo |
| A10 | Telemetria de frame (fps/draw calls) | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` (`info`) | 1 | S | Baixo |
| A11 | Detecção de GPU/software | `DESENVOLVIMENTO LIA` | APIs WebGL + addon `WebGL` | 1 | S | Médio (falsos negativos) |
| A12 | Recuperação de contexto perdido | `DESENVOLVIMENTO LIA` | — | 1 | M | Alto se ausente |
| A13 | Múltiplos viewports simultâneos | `DESENVOLVIMENTO LIA` | — | pós | L | Alto (memória/VRAM) — **não recomendado no v1** |
| A14 | Render sob demanda | `DESENVOLVIMENTO LIA` | — | 1 | S | Médio (damping exige loop) |
| A15 | Sombras em tempo real | `NATIVO THREE.JS` | — | 3 | S | Médio (custo) — opcional |

## B. Modelos e geometria

| # | Funcionalidade | Classificação principal | Apoio | Fase | Esforço | Risco |
|---|---|---|---|---|---|---|
| B1 | Importar e desenhar GLB | `NATIVO THREE.JS` (`GLTFLoader`) | `DESENVOLVIMENTO LIA` (transporte/limites) | 1 | M | Alto (memória/segurança) |
| B2 | Importar `.gltf` com recursos externos | `NATIVO THREE.JS` | `DESENVOLVIMENTO LIA` (protocolo/allowlist) | 5 | M | Alto (path traversal) |
| B3 | Importar FBX/OBJ/STL/PLY | `NATIVO THREE.JS` (loaders) | — | — | M | **`NÃO RECOMENDADO` no v1**; converter antes (Blender) |
| B4 | Inspecionar meshes (contagens, grupos) | `JÁ IMPLEMENTADO` (estrutural) | `DESENVOLVIMENTO LIA` (visual) | 1 | S | Baixo |
| B5 | Bounds, escala e unidades | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` (`Box3`) | 1 | S | Médio (glTF não tem unidade) |
| B6 | Visualizar wireframe/topologia | `NATIVO THREE.JS` | `DESENVOLVIMENTO LIA` | 1 | S | Baixo; **topologia de quads/loops não existe em glTF** |
| B7 | Inspecionar materiais por mesh | `NATIVO THREE.JS` | `DESENVOLVIMENTO LIA` | 3 | M | Baixo |
| B8 | Visualizar UVs | `DESENVOLVIMENTO LIA` | shader próprio | 3 | M | Médio (baixo valor inicial) |
| B9 | Inspecionar normais (helper) | `BIBLIOTECA COMPLEMENTAR` | `NATIVO THREE.JS` | 3 | S | Baixo |
| B10 | Identificar problemas comuns | `DESENVOLVIMENTO LIA` | `JÁ IMPLEMENTADO` (relatório) | 1–3 | M | Médio (falsos positivos) |
| B11 | Comparar versões (estrutural) | `JÁ IMPLEMENTADO` | `DESENVOLVIMENTO LIA` (UI de diff) | 5 | M | Baixo |
| B12 | Comparar versões (visual) | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` (captura) | 5 | L | Alto (determinismo de captura) |
| B13 | Edição de geometria/topologia | `BLENDER` | — | — | — | **`NÃO RECOMENDADO`** no Three.js |

## C. Materiais e texturas

| # | Funcionalidade | Classificação principal | Apoio | Fase | Esforço | Risco |
|---|---|---|---|---|---|---|
| C1 | Inspeção PBR (base/metallic/roughness/normal/alpha) | `NATIVO THREE.JS` | `DESENVOLVIMENTO LIA` | 3 | M | Baixo |
| C2 | Prévia de mapa de textura | `DESENVOLVIMENTO LIA` | Canvas/ImageBitmap | 3 | M | Médio (memória, cor) |
| C3 | Resolução/formato/VRAM estimada | `DESENVOLVIMENTO LIA` | — | 3 | S | Baixo (aritmética) |
| C4 | Ambiente neutro para inspeção | `NATIVO THREE.JS` (`RoomEnvironment` + `PMREMGenerator`) | `DESENVOLVIMENTO LIA` | 3 | S | Baixo |
| C5 | Troca controlada de material | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` | 3 (só se decisão 47 = A) | M | Alto (semântica/editor) |
| C6 | Pré-visualização de alterações | `DESENVOLVIMENTO LIA` | — | 3 | M | Médio |
| C7 | Garantir não alteração do original | `DESENVOLVIMENTO LIA` | — | 1 | S | **Crítico** |
| C8 | Inspeção de canais de textura comprimida (KTX2) | `NATIVO THREE.JS` (`KTX2Loader`) | decoders (Apache-2.0) | 3 | M | Médio (wasm/CSP) |
| C9 | Edição de textura/pintura | `BLENDER` | — | — | — | **`NÃO RECOMENDADO`** no viewport |
| C10 | Bake de textura | `BLENDER` | — | — | — | Fora de escopo |

## D. Personagens e rigs

| # | Funcionalidade | Classificação principal | Apoio | Fase | Esforço | Risco |
|---|---|---|---|---|---|---|
| D1 | Visualizar armature/skeleton | `NATIVO THREE.JS` (`SkeletonHelper`) | `DESENVOLVIMENTO LIA` | 4 | S | Baixo |
| D2 | Lista e inspeção de bones | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` | 4 | M | Médio (nomes/ordem) |
| D3 | Visualizar skinning (pesos) | `DESENVOLVIMENTO LIA` | shader próprio | 4 | L | Alto (complexidade) |
| D4 | Selecionar partes do personagem | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` (`Raycaster`) | 2 | M | Médio (depende de nós nomeados) |
| D5 | Inspecionar hierarquia | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` | 2 | M | Baixo (feito uma vez, reusa) |
| D6 | Reproduzir animações | `NATIVO THREE.JS` (`AnimationMixer`) | `DESENVOLVIMENTO LIA` | 4 | M | Baixo |
| D7 | Timeline e scrub | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` | 4 | M | Médio (precisão de tempo) |
| D8 | Comparar poses/clipes | `DESENVOLVIMENTO LIA` | — | 4 | L | Alto (UX) |
| D9 | Editar rig/bones/rest pose | `BLENDER` | — | — | — | **`NÃO RECOMENDADO`** |
| D10 | Retargeting/foot sliding | `BLENDER` | `motion.retarget` (planned) | — | XL | Fora de escopo |

## E. Animação

| # | Funcionalidade | Classificação principal | Apoio | Fase | Esforço | Risco |
|---|---|---|---|---|---|---|
| E1 | Play/pause/stop | `NATIVO THREE.JS` (`AnimationMixer`) | — | 4 | S | Baixo |
| E2 | Velocidade | `NATIVO THREE.JS` | — | 4 | S | Baixo |
| E3 | Seleção de clipes | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` | 4 | S | Baixo |
| E4 | Scrubbing | `NATIVO THREE.JS` (`mixer.setTime`) | `DESENVOLVIMENTO LIA` | 4 | M | Médio |
| E5 | Inspeção de keyframes | `DESENVOLVIMENTO LIA` | dados de `AnimationClip` | 4 | M | Médio (formato varia) |
| E6 | Loops e comparação | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` | 4 | M | Médio |
| E7 | Edição de animação (keys, curvas, NLA) | `BLENDER` | — | — | — | **`NÃO RECOMENDADO`** |
| E8 | Motion matching / geração | `RESEARCH ONLY` | `motion.generate` (planned) | — | XL | Fora de escopo |
| E9 | Exportar clipes | `ADAPTER EXTERNO` | `gltf-transform` | 5 | M | Médio |

## F. Cenários e composição

| # | Funcionalidade | Classificação principal | Apoio | Fase | Esforço | Risco |
|---|---|---|---|---|---|---|
| F1 | Hierarquia de cena | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` | 2 | M | Baixo |
| F2 | Adicionar/remover objetos de inspeção (luz, câmera de referência) | `DESENVOLVIMENTO LIA` | `NATIVO THREE.JS` | 3 | M | Médio (confundir com cena do arquivo) |
| F3 | Câmeras do arquivo (visualizar/selecionar) | `NATIVO THREE.JS` | — | 4 | S | Baixo |
| F4 | Iluminação de inspeção (presets) | `DESENVOLVIMENTO LIA` | `RoomEnvironment` | 3 | S | Baixo |
| F5 | Organização de grupos | `DESENVOLVIMENTO LIA` | — | 3 | M | Médio (não altera arquivo) |
| F6 | Pré-visualização de cena | `NATIVO THREE.JS` | — | 1 | M | Baixo |
| F7 | Salvamento de configuração própria da Lia | `DESENVOLVIMENTO LIA` | — | 2 | M | Médio (contrato) |
| F8 | Scene Composer / staging de geração | `RESEARCH ONLY` | decisão separada (pergunta 20) | pós | L | Alto (duplicar workflow) |
| F9 | Reconstrução de ambiente / splats | `RESEARCH ONLY` | — | pós | XL | Fora de escopo |

## G. Ferramentas futuras

| # | Funcionalidade | Classificação principal | Apoio | Fase | Esforço | Risco |
|---|---|---|---|---|---|---|
| G1 | Visualização de cabelo (cards/strands) | `RESEARCH ONLY` | `character.hair` (planned) | pós | L | Alto (shader/semântica) |
| G2 | Visualização de partículas/VFX | `NATIVO THREE.JS` | `DESENVOLVIMENTO LIA` | pós | M | Médio (não é o VFX 2D existente) |
| G3 | Inspeção de colisores | `RESEARCH ONLY` | — | pós | M | Alto (colisor não está no GLB) |
| G4 | Preparação de spritesheet 3D (câmera/pose) | `DESENVOLVIMENTO LIA` | `BLENDER` continua produção | 5 | L | Alto (não escolher renderer padrão) |
| G5 | Render de personagem/imagem de alta qualidade | `BLENDER` | — | — | — | Não substituir |
| G6 | Path tracing no navegador | `RESEARCH ONLY` | `three-gpu-pathtracer` | pós | XL | **`NÃO RECOMENDADO`** como recurso de produto |
| G7 | Efeitos de cabelo/física em tempo real | `RESEARCH ONLY` | — | pós | XL | Fora de escopo |
| G8 | Medição de silhueta/consistência visual | `RESEARCH ONLY` | — | pós | XL | Sem critério aprovado |
| G9 | Comparação de renders Blender × WebGL | `DESENVOLVIMENTO LIA` | `BLENDER` | 5 | L | Alto (decisão aberta, sem renderer padrão) |
| G10 | Exportação GLB derivada | `ADAPTER EXTERNO` | `NATIVO THREE.JS` (`GLTFExporter`) | 5 | M | Alto (round-trip não é lossless) |

## H. Leitura por fase

| Fase | O que entra | O que deliberadamente **não** entra |
|---|---|---|
| 1 | Ver, orbitar, enquadrar, diagnosticar, medir, descartar | Selecionar, editar, animar, capturar, exportar |
| 2 | Selecionar, navegar hierarquia, transformar com undo, salvar overrides, capturar | Materiais, animação, versionamento, Blender |
| 3 | Ler PBR/texturas/UVs, ambiente e pipeline de cor; override só com decisão 47 | Pintura, bake, shader customizado |
| 4 | Skeleton, bones, skins, mixer, timeline, A/B de clipes | Editar animação, retarget |
| 5 | Workflows, jornada, QA, Blender, Comparison Lab, export derivado, perfis | Escolher renderer, publicar, controlar Blender |
| pós | Cabelo, partículas, splats, colisores, path tracing | Promessa de fase ou prazo |

## I. Resumo por classificação

Contagem das **76 linhas** por classificação principal (verificada por script na revisão final):

| Classificação | Itens | Observação |
|---|---|---|
| `DESENVOLVIMENTO LIA` | 33 | **Maior bloco**: sessão, transporte, UI, diagnóstico, limites, integração |
| `NATIVO THREE.JS` | 23 | A biblioteca tem a primitiva; o produto em volta não existe |
| `RESEARCH ONLY` | 8 | Splats, cabelo avançado, path tracing, colisores, VFX complexo |
| `BLENDER` | 7 | Autoria (malha, UV, rig, animação, bake, render final) |
| `JÁ IMPLEMENTADO` | 2 | B4 (contagens) e B11 (comparação estrutural) |
| `ADAPTER EXTERNO` | 2 | Exportação derivada/otimização (E9, G10) |
| `BIBLIOTECA COMPLEMENTAR` | 1 | B9 (helper de normais) |
| **Total** | **76** | Nenhuma linha tem `NÃO RECOMENDADO` como classificação principal |

Além disso, **7 linhas** carregam recomendação explícita de não fazer no v1 (A13 múltiplos viewports, B3 FBX, B13 edição de geometria, C9 pintura, D9 edição de rig, E7 edição de animação, G6 path tracing de produto). Isso é uma recomendação, não uma classificação: a classificação continua sendo a do domínio (`BLENDER`, `RESEARCH ONLY`, etc.).

## J. Fronteiras explícitas (o que nunca vai para o viewport)

1. **Modelagem e retopologia** — Blender.
2. **UV unwrap e edição** — Blender.
3. **Rigging, pesos e rest pose** — Blender.
4. **Animação autoral, IK, NLA, correção de foot sliding** — Blender.
5. **Bake de textura e iluminação** — Blender.
6. **Render determinístico final / spritesheet de produção** — Blender (candidato), com comparação aberta.
7. **Publicação/upload** — nenhum.
8. **Simulação física/física de cabelo** — pesquisa.

## K. Regra de leitura da matriz

Uma linha marcada `NATIVO THREE.JS` **não** significa “de graça”: significa que a biblioteca tem a primitiva. O custo real está na coluna de apoio e no bloco `DESENVOLVIMENTO LIA` — que é onde 33 dos itens vivem. Planejar pelo número de itens “nativos” subestima o trabalho em uma ordem de grandeza.

Uma linha marcada `BIBLIOTECA COMPLEMENTAR` **não** autoriza instalar nada: `three-mesh-bvh`, `gltf-validator` e `gltf-transform` continuam opcionais e passam pela política de dependência.
