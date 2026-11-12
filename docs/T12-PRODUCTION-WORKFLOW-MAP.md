# T12 — Mapa de workflows de produção (A–J)

> **Estado:** `CONSOLIDATION — PROPOSED`. Nenhum workflow novo foi implementado; nenhum provider integrado; nenhum contrato alterado.
> **Data:** 2026-11-12 (UTC). **Base:** estado final da T11 (`2f41360`) + auditoria de código da T12.
> **Regra de leitura:** os workflows são **reutilizáveis e independentes de provider**. Onde a capacidade não tem adapter, a etapa fica `BLOCKED` e o runner já recusa executar (fail-closed por `blockedReason`). **Não se pressupõe que todos serão implementados imediatamente** — a ordem está em [`T12-IMPLEMENTATION-ROADMAP.md`](T12-IMPLEMENTATION-ROADMAP.md).
> **Origens consolidadas:** rotas de [`ASSET-PIPELINES.md`](ASSET-PIPELINES.md), contrato humanoide de `electron/workflow-contracts.cjs`, fluxos A–E de [`T11-2D-ANIMATION-WORKFLOWS.md`](T11-2D-ANIMATION-WORKFLOWS.md), pipeline 3D de [`3D-CHARACTER-PRODUCTION-PIPELINE.md`](3D-CHARACTER-PRODUCTION-PIPELINE.md) e backends de [`T9-EXECUTION-BACKEND-ARCHITECTURE.md`](T9-EXECUTION-BACKEND-ARCHITECTURE.md).

---

## 0. Convenções

- **Gate humano** = etapa com `reviewRequired: true` (o runner para em `awaiting_review` e **re-verifica SHA-256** na aprovação).
- **Gate de autorização** = etapa com `authorization.required` (envio de dados, custo, instalação, download, sobrescrita).
- **Retomada** = possível quando o run persistido tem etapas `validated` com fingerprint de input e hashes de artefato conferindo (`workflow-runner.cjs:1126-1228`).
- **Contrato preservado:** spritesheet **384×144**, grade **8×3**, **24 frames**, células **48×48**, ações **idle/walk/run** quando presentes (T10 `VERIFIED_IN_FORGE` estruturalmente).
- Nenhum workflow cria outro renderer, outro orquestrador ou outro engine.

---

## Workflow A — 2D Art (brief → conceito → imagem → acabamento → QA → export)

| Dimensão | Conteúdo |
|---|---|
| **Capacidades** | `image2d.generate-concept` (**existe**), `image2d.illustration`/`pixel-art`/`tileset`/`icon` (não existem), `asset.export-for-target` (parcial) |
| **Etapas** | 1 brief (`brief.md`, já implementado) → 2 conceito (ComfyUI **ou** referência importada) → 3 acabamento (**editor manual**: Krita/Aseprite) → 4 normalização (tamanho, paleta, alpha) → 5 QA → 6 export por destino |
| **Entradas → saídas** | brief/prompt/referências → PNG por peça, atlas opcional, task JSON v2 |
| **Ferramentas candidatas** | ComfyUI (executor), Krita/Aseprite (manual), Godot (destino) |
| **Backends** | local (loopback) para conceito; local para acabamento; remoto só com gate de envio |
| **Requisitos** | ComfyUI rodando + checkpoint **já instalado** escolhido pelo usuário; sem download de pesos |
| **Custos** | local: 0; remoto/hosted: `unknown` declarado no diálogo (**implementado**) |
| **Licenças** | ComfyUI GPL-3.0 (processo separado); checkpoint com licença própria; outputs do usuário |
| **Aprovações** | gate de autorização se endpoint remoto (**implementado**); gate humano na arte |
| **QA** | PNG estrutural (CRC/IHDR/IDAT/IEND) **implementado**; conteúdo (alpha real, paleta) **lacuna G8**; revisão visual humana |
| **Pontos de falha** | sem servidor; checkpoint incompatível; conceito não é prancha ortográfica (já declarado na nota do adapter) |
| **Retomada** | sim para runs persistidos; hoje a retomada exposta no desktop é restrita ao workflow Blender (G6) |

## Workflow B — 2D Character (imagem → partes → reconstrução → rig → animação → QA → export)

| Dimensão | Conteúdo |
|---|---|
| **Capacidades** | `image2d.decompose-layers`, `occlusion.inpaint`, `rig2d.build`, `rig2d.animate`, `render.spritesheet` (**existe**), `asset.export-for-target` |
| **Etapas** | 1 imagem-base com proveniência → 2 separação de partes + inpaint de occlusões → 3 **gate humano de máscaras** → 4 esqueleto/hierarquia/pesos → 5 **gate humano de juntas** → 6 animações → 7 **limpeza manual de keys/timing** → 8 QA → 9 export (spritesheet 384×144 quando o destino pedir) |
| **Entradas → saídas** | imagem + intenções → camadas RGBA/máscaras, rig editável, clips, spritesheet + manifesto, proveniência por passo |
| **Ferramentas candidatas** | see-through (Apache-2.0), CLD/LayerD/RevealLayer, image-to-psd; rig: 2DAutoRigger (**licença divergente**), OpenBone (MIT), Godot nativo; spritesheet: renderer interno |
| **Backends** | local (CPU/GPU) para separação/rig; local para spritesheet; remoto apenas se GPU pesar |
| **Requisitos** | pesos licenciados; backends abertos preferidos (birefnet/lama/rtmpose/humanparsing) para evitar sam3 **gated** |
| **Custos** | local: 0; hosted: `unknown` |
| **Licenças** | Apache-2.0/MIT nos candidatos principais; **evitar** `spine-animation-ai` (PolyForm NC); Spine só como formato de intercâmbio se decidido (D6) |
| **Aprovações** | máscaras, juntas, keys e arte final — 4 gates humanos |
| **QA** | alpha/ordem por camada; rig sem osso órfão; loops fechados; validação estrutural do spritesheet; **conteúdo do atlas ainda é lacuna** |
| **Pontos de falha** | inpaint inventar geometria (rotular como reconstruído); ossos "como pontos" e keys bagunçadas (relato T11 tarefa 3); maturidade ★0/★1 dos candidatos |
| **Retomada** | por etapa validada com hash; exige Workflow Runtime DAG para subgrafo (G5) |

## Workflow C — Modular Character (base → rig → peças → skins → variantes → QA)

| Dimensão | Conteúdo |
|---|---|
| **Capacidades** | `rig2d.compose` / `character.modularity` + as do B exceto decomposição repetida; em 3D: `character.clothing`/`accessory` + **slot registry** proposto na spec §5 |
| **Etapas** | 1 rig-template canônico por arquétipo → 2 catálogo de peças (roupa, cabelo, chapéu, arma) como **attachments/skins** → 3 variantes por skin → 4 animações **compartilhadas** → 5 QA por variante → 6 export |
| **Entradas → saídas** | rig-template + peças → skins/variantes + **um** conjunto de animações reusado |
| **Ferramentas candidatas** | OpenBone (skins, linked meshes), Godot (composição de nós), Spine-format como intercâmbio |
| **Backends** | local |
| **Requisitos** | proporções compatíveis entre peças; template versionado |
| **Custos** | 0 |
| **Licenças** | MIT/Apache-2.0; **nenhuma licença por usuário** |
| **Aprovações** | template canônico (humano); cada peça nova (humano) |
| **QA** | mesma animação em ≥2 variantes sem quebra; draw order correto; **sem duplicar pipeline por roupa** |
| **Pontos de falha** | incompatibilidade de proporção; troca em runtime é papel do **destino**, não da Forge |
| **Retomada** | por peça/variante (artefatos independentes) |

## Workflow D — 2D Animation (referência → movimento → geração/edição → correção → QA → export)

| Dimensão | Conteúdo |
|---|---|
| **Capacidades** | `rig2d.animate-assisted` / `motion.edit` / `motion.cycles` |
| **Etapas** | 1 rig pronto + descrição textual da ação → 2 geração de keyframes (≤2 tentativas, método T11) → 3 **comparação com referência** → 4 gerações corretivas → 5 **limpeza manual de keys/timing** → 6 QA → 7 export |
| **Entradas → saídas** | rig + prompt/referência → keyframes **editáveis** + log de gerações |
| **Ferramentas candidatas** | agente hospedeiro editando formato editável (OpenBone **MCP**), Godot `AnimationPlayer`; **imagem→vídeo é auxiliar, nunca substituto de rig** |
| **Backends** | hosted para o modelo; **local** para edição/limpeza/export |
| **Requisitos** | formato editável (critério de corte da T11) |
| **Custos** | API por chamada — **preços não verificados**; capítulo Cost do vídeo é lacuna |
| **Licenças** | termos do modelo por chamada (a verificar); outputs do usuário |
| **Aprovações** | envio a modelo hosted (gate de autorização); resultado (gate humano) |
| **QA** | contagem/organização de keys, loops, comparação visual com referência |
| **Pontos de falha** | "timeline bagunçada" (relato); depender de hosted para etapa central → **manter fallback manual** |
| **Retomada** | sim por clip |

## Workflow E — 3D Prop (imagem/texto → modelo → geometria → UV → materiais → QA → export)

| Dimensão | Conteúdo |
|---|---|
| **Capacidades** | `model3d.generate` (passo contratual existe, **bloqueado**), `model3d.retopologize`, `model3d.uv`, `model3d.texture`, `model3d.export` |
| **Etapas** | 1 imagem autorizada/texto → 2 geração de malha → 3 watertight/reparo (com relatório) → 4 decimação/LOD → 5 UV → 6 materiais PBR → 7 QA → 8 export + manifesto de importação |
| **Entradas → saídas** | imagem/texto → `.glb`/`.gltf` com UV+texturas, contagem de triângulos, proveniência |
| **Ferramentas candidatas** | TRELLIS.2/Pixal3D (MIT), trellis.cpp/pixal3d.cpp (Vulkan/CUDA), nós ComfyUI (`ComfyUI-Trellis2`), LODTailor/UltraTex/Bake-Forger (**GPL-3.0**), `manifold` (Apache-2.0), `CuMesh`+`FlexGEMM` (MIT) |
| **Backends** | local (Vulkan/CUDA), Colab, GPU alugada, hosted |
| **Requisitos** | ~16,5 GB de pesos; cascade 1024 exige 16 GB → **`NOT_FEASIBLE_ON_TARGET`** na RX 580 (T10 E1) |
| **Custos** | local: 0 (energia); Colab A100 e RunPod: **medido por terceiro**, datado |
| **Licenças** | código MIT; **pesos com registro separado** (`trellis2-gguf` = "see the source model"; `Aero-Ex` sem model card); GPL contamina se linked |
| **Aprovações** | download de pesos (gate), execução remota (gate), geometria (humano) |
| **QA** | watertight, triângulos, UV sem overlap, mapas presentes; **nunca declarar "game-ready" sem validação no destino** |
| **Pontos de falha** | VRAM insuficiente; pesos sem licença; GPU incompatível (`gfx803` = 0 referências) |
| **Retomada** | por etapa com artefato validado; requer backend remoto com `reconcile` (G9) |

## Workflow F — 3D Character (conceito → modelo → cabelo/roupa → retopo → UV → materiais → rig → animação → QA)

| Dimensão | Conteúdo |
|---|---|
| **Capacidades** | as do E + `character.humanoid` (contrato **existe**: 5 estágios), `rig3d.auto`, `motion.generate`, `motion.retarget`, `character.hair`/`clothing` |
| **Etapas** | 1 brief/prompt → 2 **vistas frente/perfil/costas** (`reference-views`, gate) → 3 geração 3D (`generate-3d`, gate) → 4 cabelo/roupa/acessórios → 5 retopo → 6 UV → 7 materiais → 8 auto-rig (`auto-rig`, gate) → 9 animações (`animate`, gate) → 10 spritesheet (`render-2d`) |
| **Entradas → saídas** | brief+referências → modelo rigged/animado + spritesheet + manifesto + proveniência |
| **Ferramentas candidatas** | ComfyUI (vistas), TRELLIS.2/Pixal3D (3D), Blender/actionforge (rig), motion-bricks.cpp/kimodo.cpp/Motion2MixamoRig (movimento), HairDeck (cabelo), **renderer interno** (2D) |
| **Backends** | misto: local para vistas/render; local/remoto para 3D e rig; hosted para motion |
| **Requisitos** | **todos os 4 primeiros estágios estão `BLOCKED` hoje** (sem provider/adapter); só o render tem adapter |
| **Custos** | `unknown` por provider; declarado no gate (**implementado** em `providerAuthorization`) |
| **Licenças** | MotionBricks: código Apache-2.0 + docs/assets CC-BY-4.0 + **checkpoints a verificar**; kimodo: **SMPL-X só pesquisa**; SOMA/G1 comercial ok; actionforge `UNKNOWN` |
| **Aprovações** | 5 gates (todos os estágios do contrato têm `reviewRequired: true`) + autorização por ação protegida |
| **QA** | por estágio: vistas coerentes, malha watertight, rig sem osso órfão, clips com licença, spritesheet estrutural + conteúdo |
| **Pontos de falha** | retarget obrigatório (MotionBricks anima SOMA/G1, não rigs arbitrários); VRAM; licenças de pesos |
| **Retomada** | o contrato já persiste por etapa; retomada geral depende do DAG (G5) |

## Workflow G — 3D to 2D (modelo → rig/animação → câmeras → render → spritesheet → validação)

| Dimensão | Conteúdo |
|---|---|
| **Capacidades** | `render3d.to2d`, `render.atlas`, `render.spritesheet`, `render.turntable`, validação estrutural — **todas com código existente** |
| **Etapas** | 1 modelo existente do usuário (blend/glb/gltf/fbx/obj/stl) → 2 resolução de ações por token (ambiguidade **rejeitada**) → 3 setup explícito de câmera ortográfica + area light → 4 render por frame → 5 `pack_atlas` → 6 validação PNG RGBA8 + manifesto → 7 **revisão visual humana** → 8 aprovação |
| **Entradas → saídas** | modelo + ações + frame size (16–512 px, padrão 48×48) → `spritesheet.png` + `spritesheet.json` |
| **Ferramentas candidatas** | **Blender** (EEVEE Next com fallback EEVEE) — não criar segundo renderer |
| **Backends** | local (processo) |
| **Requisitos** | Blender detectado (`findExternalTool`), modelo dentro do workspace, ações nomeadas |
| **Custos** | 0 |
| **Licenças** | Blender GPL-3.0 em processo separado; asset do usuário com termos revisados (`local-renderer-test/manifests/`) |
| **Aprovações** | ação explícita de iniciar (sem gate de autorização: adapter local); revisão humana obrigatória |
| **QA** | estrutural **`VERIFIED_IN_FORGE`** (T10: 3 controles negativos corretos, 4/4 resolução de ações); **conteúdo é lacuna G8**; visual é humana |
| **Pontos de falha** | sem Blender; modelo sem armature para actions; atlas transparente aceito hoje |
| **Retomada** | **`IMPLEMENTED` e exposta** para este workflow específico (`resumableRunKind`: 1 etapa, `stageIndex 4`) |

## Workflow H — UI & VFX (conceito → preparação → animação adequada → QA → export)

| Dimensão | Conteúdo |
|---|---|
| **Capacidades** | `ui2d.animate`, `vfx2d.generate`, `image2d.icon`, `asset.export-for-target` |
| **Etapas** | 1 conceito de UI/VFX → 2 **escolha de tecnologia por tipo** (tweens/state machine/partículas/spritesheet — tabela T11 §6) → 3 preparação de peças (9-slice, atlas, camadas) → 4 animação/geração → 5 QA → 6 export por destino |
| **Entradas → saídas** | peças + estados/descrição → cenas `.tscn`, atlas, partículas, state machines |
| **Ferramentas candidatas** | Godot (`AnimationPlayer`, tweens, `GPUParticles2D`), OpenBone (state machines), Rive (editor **não verificado**), renderer interno para spritesheets de VFX |
| **Backends** | local |
| **Requisitos** | destino com runtime adequado |
| **Custos** | 0 (Godot MIT) |
| **Licenças** | MIT; Rive editor pago/`UNKNOWN` |
| **Aprovações** | direção de arte e parâmetros (humano) |
| **QA** | estados alcançáveis, loop de partícula fechado, sem flicker, orçamento de draw calls |
| **Pontos de falha** | **forçar esqueleto onde partículas/tweens bastam**; capítulos UI/VFX do vídeo T11 são lacuna de transcrição |
| **Retomada** | por peça/estado |

## Workflow I — Retexture (modelo existente → análise → materiais → texturas → baking → QA)

| Dimensão | Conteúdo |
|---|---|
| **Capacidades** | `model3d.uv`, `model3d.texture`, `material.pbr`, `model3d.bake`, `model3d.export` |
| **Etapas** | 1 importar modelo existente (hash de entrada) → 2 análise (UV, materiais, resolução atual) → 3 proposta de material → 4 geração/edição de texturas → 5 bake (normal/AO/curvature) → 6 QA → 7 export preservando bytes originais |
| **Entradas → saídas** | modelo + referência → mapas PBR + modelo retexturizado **como nova versão**, nunca sobrescrito |
| **Ferramentas candidatas** | Blender (manual/script), UltraTex (**GPL-3.0**), nós ComfyUI de textura, Krita (manual) |
| **Backends** | local |
| **Requisitos** | UV existente ou etapa de UV; espaço em disco para mapas |
| **Custos** | 0 (local) |
| **Licenças** | GPL-3.0 exige cuidado; textura de terceiro exige direitos |
| **Aprovações** | **gate de sobrescrita** (paths afetados + backup/rollback) — regra já definida em [`WORKFLOW-ENGINE.md`](WORKFLOW-ENGINE.md) |
| **QA** | resolução/espaço declarados, sem bleeding, coerência com referência; versão anterior preservada |
| **Pontos de falha** | UV ruim de origem; perda do original se não versionar (G7) |
| **Retomada** | por mapa |

## Workflow J — Hybrid/Remote (local → remoto → retorno → local → QA)

| Dimensão | Conteúdo |
|---|---|
| **Capacidades** | qualquer combinação: ex. `image2d.generate-concept` (local) → `model3d.generate` (**remoto**) → `model3d.retopologize`/`texture` (local) → `render.spritesheet` (local) |
| **Etapas** | 1 etapas locais com artefatos hashados → 2 **gate de autorização de envio** (dados, destino, região, custo, retenção) → 3 execução remota com `jobId` → 4 **retorno e re-hash** → 5 revalidação de contrato no destino local → 6 etapas locais → 7 QA → 8 limpeza de temporários **só da Forge** |
| **Entradas → saídas** | artefatos locais → artefatos remotos validados → produto final local |
| **Ferramentas candidatas** | Colab (experimento), RunPod/template (produção repetível), worker próprio, hosted API |
| **Backends** | **mistos por etapa** (backend é dimensão, não módulo) |
| **Requisitos** | rede, credenciais (**hoje inexistentes no produto**, C29), transferência de artefatos, `reconcile` |
| **Custos** | por hora/chamada; teto definido pelo usuário; `unknown` exige confirmação consciente |
| **Licenças** | termos do serviço + direitos dos outputs + política de retenção **revisados antes** |
| **Aprovações** | envio, custo, upload de asset, retenção — gates separados (o padrão do ComfyUI remoto já implementado é o modelo a seguir) |
| **QA** | hash antes/depois da transferência; contrato revalidado; efeitos remotos ambíguos → `needs_reconciliation` (estado **ainda não implementado**) |
| **Pontos de falha** | crash após enviar (duplicação), timeout, custo inesperado, upload sem consentimento, limpeza de arquivos de terceiro |
| **Retomada** | exige `reconcile(jobId, fingerprint)` — **`NOT_IMPLEMENTED`** (G9); hoje só local |

---

## 1. Mapa de dependências entre workflows

```text
A (2D Art) ──> B (2D Character) ──> C (Modular) ──> D (2D Animation)
                                        │                 │
E (3D Prop) ──> F (3D Character) ───────┴──> G (3D→2D) <──┘
      │                    │                     │
      └──> I (Retexture) <─┘                     └──> export/destinos
H (UI & VFX) ── independente (usa peças de A/B e atlas de G)
J (Hybrid/Remote) ── camada transversal: qualquer etapa de A–I pode trocar de backend
```

| Pré-requisito transversal | Workflows afetados | Estado |
|---|---|---|
| Capability Registry | todos | `NOT_IMPLEMENTED` |
| Adapter SDK | todos | `NOT_IMPLEMENTED` |
| Environment Preflight (hardware) | B, E, F, G, I, J | `PARTIAL` (tools/paths/models) |
| Asset Manager com versões/relações | B, C, F, I | `PARTIAL` (protótipo não integrado) |
| Provenance & Rights | todos | `PARTIAL` (3 lugares desconectados) |
| Validação de conteúdo (G8) | A, B, D, G, H | `PARTIAL` (só no harness) |
| Workflow Runtime DAG + reconcile | B, E, F, I, J | `PARTIAL` (serial, sem reconcile) |

## 2. Caminhos alternativos (independência de provider)

| Etapa | Alternativa 1 | Alternativa 2 | Fallback manual |
|---|---|---|---|
| Conceito 2D | ComfyUI (local) | referência importada pelo usuário | Krita/Aseprite |
| Separação de camadas | see-through | CLD/LayerD/RevealLayer | recorte manual no Krita |
| Rig 2D | 2DAutoRigger (licença pendente) | OpenBone / Godot nativo | rig manual |
| Animação 2D | agente sobre formato editável | OpenBone MCP / Godot | keys manuais |
| Geração 3D | TRELLIS.2 (CUDA) | trellis.cpp (Vulkan/CPU) | modelagem manual no Blender |
| Motion | motion-bricks.cpp (CPU/Vulkan) | kimodo.cpp (Vulkan/CPU) | clips do usuário com licença conhecida |
| Retopo/UV/textura | nós GPL (com restrição) | Blender + manifold/CuMesh (permissivos) | manual no Blender |
| Spritesheet | **renderer interno (único, preservado)** | Godot headless (a medir) | export manual registrado |
| Backend | local | Colab/GPU alugada/hosted | etapa manual + registro de artefato |

**Nenhum par de alternativas forma dependência indivisível**; nenhuma é obrigatória para a Forge.

## 3. Studio, Forge e destinos (fronteira preservada)

> "Lia Studio decide e coordena o jogo; Lia Forge produz, transforma e valida tecnicamente assets para qualquer consumidor. Lia Desktop e jogos são destinos de utilização, não módulos de geração separados."

| Regra | Consequência prática |
|---|---|
| **Um só pipeline de geração** | jogos, Lia Desktop, vídeos e docs **não** têm pipeline próprio; têm **perfil de destino** |
| **Destination compatibility profiles** | cada destino declara: formatos aceitos, escala/unidades/eixos, FPS, root motion, colisão/hitbox, atlas vs. sequência, requisitos de licença de runtime |
| **Export é etapa, não módulo** | `asset.export-for-target` consome artefatos aprovados e emite pacote + manifesto de importação |
| **Integração Studio ↔ Forge permanece manual** | até haver decisão e protocolo aprovados ([`STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md`](STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md)); alternativa A de identidade compartilhada **não aprovada** |
| **Vídeo não é módulo de geração** | é destino/composição; capacidade própria exige decisão de escopo (fronteira 2.4) |
| **Troca em runtime (skins) é papel do destino** | a Forge produz variantes e o rig compartilhado; não implementa troca no jogo |

## 4. O que este mapa não faz

Não implementa workflow, não cria adapter, não escolhe provider, não altera contrato de spritesheet/personagem/animação/export, não aprova capacidade proposta, não estima calendário, não autoriza instalação, download, gasto ou envio de dados, não duplica módulos e não promove pesquisa a capacidade operacional.
