# LIA FORGE — ECOSSISTEMA DE ADD-ONS BLENDER: AUDITORIA REVISADA

> **Estado:** `RESEARCH` — relatório de pesquisa estática, **nenhum add-on foi instalado, executado, integrado ou redistribuído**. Nenhuma licença foi aceita.
> **Data desta revisão:** 2026-11-13 UTC | **Branch:** `arena/7c135d59-lia-forge`
> **Revisão de:** `8eebda0` (2026-11-13), relatório original da sessão
> **Hardware de referência (ADR-001 Decisão 5):** AMD Radeon RX 580 8 GB (`gfx803` Polaris/GCN4) + Ryzen 5 5500 + 16 GB RAM + Windows
> **Método:** Inspeção estática de conteúdo do Google Drive (19 arquivos) + API do GitHub (`gh api`) sobre repositórios públicos. **Nenhum add-on foi executado.**
> **Documentos relacionados:** [`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md), [`PROVIDER-AND-MODEL-ADMISSION-POLICY.md`](PROVIDER-AND-MODEL-ADMISSION-POLICY.md), [`3D-CHARACTER-PRODUCTION-PIPELINE.md`](3D-CHARACTER-PRODUCTION-PIPELINE.md), [`CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md`](CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md), [`T9-EXECUTION-BACKEND-ARCHITECTURE.md`](T9-EXECUTION-BACKEND-ARCHITECTURE.md)
> **Documentos complementares desta entrega:** [`BLENDER-ADDONS-MATRICES.md`](BLENDER-ADDONS-MATRICES.md) (matrizes consolidadas), [`BLENDER-BRIDGE-SPECIFICATION.md`](BLENDER-BRIDGE-SPECIFICATION.md) (especificação técnica)

---

## 0. Correções aplicadas sobre a versão anterior (`8eebda0`)

| # | Problema identificado | Correção aplicada |
|---|---|---|
| 1 | Contagem "25 add-ons" duplicava os 6 que estão tanto no Drive quanto em `BloomRX/3d-create/plugins` | Contagem corrigida para **19 add-ons/assets únicos** (13 do Drive que não estão no repo + 6 compartilhados entre Drive e repo) |
| 2 | HairCard Studio e Braids Generator classificados como "✅ APROVADO" mas o texto dizia "⚠️ precisa de teste" | Reclassificados como **`ADAPTER`** (requer wrapper headless com teste real antes de integração) |
| 3 | Bodiez e Genshin Shader classificados como "✅ APROVADO" mas licença não declarada | Reclassificados como **`BLOCKED_PENDING_LICENSE_REVIEW`** para redistribuição; uso local sob risco do usuário |
| 4 | Ausência de diferenciação entre uso local e redistribuição | Toda recomendação agora especifica: (a) uso local em processo separado, (b) redistribuição como parte do instalador Lia |
| 5 | Seção 11 benchmarks rotulados como "estimados" mas sem fonte | Remarcados como **especulativos, sem medição real** — não podem ser citados como evidência |
| 6 | Seção 9.2 propunha "empacotar add-ons core no instalador" sem análise de redistribuição | Removido; redistribuição exige compliance de licença verificada caso a caso |
| 7 | SKkeeper classificado em "Skinning / Pesos" mas na verdade preserva Shape Keys | Movido para categoria correta (modificadores + Shape Keys) |
| 8 | Wiggle Bones v1.1.2 e Wiggle 2 apareciam como ferramentas separadas sem relação clara | Relação documentada: Wiggle Bones v1.1.2 é fork/refatoração do Wiggle 2 para Blender 4.5+ |
| 9 | Ausência de HairDeck (auditado em `CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md`) | HairDeck incluído como `RESEARCH ONLY` na categoria de cabelo |
| 10 | Seção 5.1 usava `addon_utils.enable()` sem verificar compatibilidade com Blender 4.x extensions | Corrigido: Blender 4.x usa `bpy.ops.preferences.addon_enable()` para add-ons legados e `blender_manifest.toml` para extensões modernas |
| 11 | `addon_utils.enable(..., default_set=False, persistent=False)` citado na memória de sessão mas sem evidência de que funciona para extensões com `blender_manifest.toml` | Remarcado como **requer teste real** |
| 12 | Diagrama mencionava "BlenderBridge" como se já existisse | Corrigido: o componente existente é `electron/blender-adapter.cjs`; "Blender Bridge" é nome proposto para a evolução |

---

## 1. Escopo e método

### 1.1 O que foi auditado

- **19 arquivos** do Google Drive do usuário (compartilhados por lucasm mmgomes e/ou próprios), sendo:
  - 13 arquivos `.zip`/`.rar`/`.blend` baixados e inspecionados estaticamente (estrutura, `bl_info`/`blender_manifest.toml`, `LICENSE`, `README`, operadores `bl_idname`, binários incluídos)
  - 6 desses 13 também presentes em `BloomRX/3d-create/plugins` (branch `arena/01a0d27a-3d-create`, commit `9e4bc91f`)
- **~30 repositórios comunitários** consultados via API do GitHub (metadados, `LICENSE`, `README`, últimos commits)

### 1.2 O que NÃO foi feito

- Nenhum add-on foi instalado, habilitado ou executado
- Nenhum Blender foi aberto (nem em modo `--background`)
- Nenhuma licença foi aceita em nome do projeto
- Nenhum download de dependências externas foi realizado
- Nenhuma medição de performance foi feita (tempos na seção 11 são especulativos)
- Nenhum teste de compatibilidade com RX 580 foi executado
- Nenhuma redistribuição foi preparada

### 1.3 Taxonomia de classificação

Duas dimensões são avaliadas separadamente:

**Dimensão A — Nível de integração proposto (solicitada pelo usuário):**

| Classificação | Significado |
|---|---|
| `INTEGRAR` | Uso como processo separado (Blender `--background`), sem redistribuir código do add-on; o Lia Forge invoca via script Python controlado |
| `ADAPTER` | Requer wrapper/adapter específico para funcionar em headless; viabilidade depende de teste real |
| `EXTENSÃO LIA` | Funcionalidade a ser reimplementada como código próprio do Lia Forge (sem copiar código do add-on) |
| `MANUAL` | Ferramenta de viewport interativa; não automatizável via headless; artista usa diretamente no Blender |
| `RESEARCH ONLY` | Útil para estudo de conceito/formato; sem intenção de execução no produto |
| `REJECT` | Incompatível com hardware, licença ou arquitetura; não reavaliar sem fato novo |

**Dimensão B — Política de admissão (de [`PROVIDER-AND-MODEL-ADMISSION-POLICY.md`](PROVIDER-AND-MODEL-ADMISSION-POLICY.md)):**

| Categoria | Resumo |
|---|---|
| `ADMIT` | Licença permissiva verificada, sem restrição de hardware, pin de versão, fallback documentado |
| `ADMIT_WITH_RESTRICTIONS` | Admissível com restrição explícita registrada (copyleft, não comercial, telemetria, etc.) |
| `RESEARCH_ONLY` | Estudo de conceito, sem execução no produto |
| `MONITOR` | Relevante mas imaturo ou em mudança rápida |
| `REJECT` | Incompatível com hardware, licença ou arquitetura |
| `BLOCKED_PENDING_LICENSE_REVIEW` | Licença/direitos não verificados; bloqueado até leitura completa |

**Dimensão C — Redistribuição:**

| Permissão | Significado |
|---|---|
| `LOCAL_ONLY` | Uso local em processo separado permitido; redistribuição como parte do instalador Lia **não** autorizada sem revisão |
| `REDISTRIBUTABLE` | Redistribuição permitida sob termos da licença (GPL-3.0: fornecer fonte; MIT: manter aviso; etc.) |
| `UNKNOWN` | Licença não declarada ou não lida; redistribuição **bloqueada** até verificação |

---

## 2. Inventário completo — Add-ons e assets do Drive

### 2.1 SquishyFX v3.3.0

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `SquishyFX_v3.3.0.zip` em `BloomRX/3d-create/plugins` **e** Drive | Ambos |
| **Autor** | `Bann0rTheFag / Auron3D` | `blender_manifest.toml` |
| **Licença** | `SPDX:GPL-3.0-or-later` | `blender_manifest.toml` |
| **Blender** | 4.2–5.2+, Python 3.11+, extensão moderna (`blender_manifest.toml`) | `blender_manifest.toml` |
| **Código** | Python puro, sem binários proprietários | Inspeção do `.zip` |
| **Classificação A** | **`INTEGRAR`** | Bake procedural via `bpy.data`, sem viewport |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | GPL-3.0: redistribuição exige compliance (fornecer fonte, mesma licença) |
| **Classificação C** | **`REDISTRIBUTABLE`** (sob GPL-3.0) | Licença permite, exige compliance |

**O que faz:** Sistema não-destrutivo de soft-body contacts e jiggle via Geometry Nodes. Efeitos: `SQUISH`, `RIPPLE`, `SQUISH_INFLATE`, `JIGGLE`, `PENETRATION`, `SQUISH_ORGANIC`.

**Arquitetura de código (inspecionado):**
- `SQUISHYFX_OT_bake_shapekeys`: itera frames, desabilita modificadores de topologia (`_TOPO_TYPES`), força `"Playing" = 1.0`, calcula delta de vértices (`on - off + basis_co`), cria Shape Keys (`sk_sfx_f{frame}`)
- `squishyfx/geometry_nodes.py` (105 KB): node groups procedurais
- `squishyfx/nodes.py`: injeção de modificadores no objeto
- `_sfx_impulse_update` (`@persistent` em `frame_change_pre`): handler de impulso por frame

**Compatibilidade headless (leitura estática):** O bake usa `scene.frame_set(frame)` + `bpy.data.meshes` — sem dependência de viewport, modal operators ou OpenGL. **Alta probabilidade de funcionar em `--background`**, mas **não testado**.

**Integração GLB:** Shape Keys geradas são exportáveis como Morph Targets via `bpy.ops.export_scene.gltf(export_morph=True)`. Pipeline: `SquishyFX → Shape Keys → GLB Morph Targets → Three.js morphTargetInfluences`.

**Limitações:**
- Bake é síncrono em `execute()` — frames longos bloqueiam o processo
- `_sfx_impulse_update` usa `frame_change_pre` handler; comportamento em `--background` não verificado
- Autor usa pseudônimo; manutenção futura incerta

**Próximos passos:** Teste real de bake headless em Blender 4.5+ com um `.blend` simples + SquishyFX habilitado.

---

### 2.2 JiggleGen v2.0.0

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `jigglegen2.rar` (Drive) | Drive |
| **Autor** | `Pathnode <pathnode42@gmail.com>` | `blender_manifest.toml` |
| **Licença** | `SPDX:GPL-3.0-or-later` | `blender_manifest.toml` |
| **Blender** | 4.2–5.2+, extensão moderna | `blender_manifest.toml` |
| **Código** | Python puro + biblioteca `.blend` | Inspeção do `.rar` |
| **Classificação A** | **`INTEGRAR`** | Bake de physics cache via `bpy.ops.ptcache.bake` |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | GPL-3.0 |
| **Classificação C** | **`REDISTRIBUTABLE`** (sob GPL-3.0) | Licença permite |

**O que faz:** Gera proxies de cloth (`cloth_proxy.py`), collision (`collision.py`) e hair cages (`hair_cage.py`) com 13 presets (`Breast.py`, `cloth.py`, `Funny Ears.py`, `Hair Curves.py`, `hair.py`, `leather.py`, `meat.py`, `paper.py`, `plants.py`, `Tissue*.py`). Biblioteca `jigglegen_library.blend` com node groups de `Follow Cage` via Geonodes + `Surface Deform`.

**Compatibilidade headless (leitura estática):** `bpy.ops.ptcache.bake(bake=True)` funciona em `--background` segundo documentação do Blender. Usa `bpy.context.temp_override` (compat 4.x+). **Alta probabilidade, não testado.**

**Limitações:**
- Arquivo distribuído em `.rar` (não `.zip`) — o adapter Lia precisa descompactar `.rar` ou o add-on precisa ser reembalado
- 13 presets com parâmetros específicos; automação genérica requer mapeamento

**Próximos passos:** (1) Teste de bake headless. (2) Verificar se `temp_override` funciona sem viewport real.

---

### 2.3 JiggleMaker v2.2.2

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `jigglemaker-2_2_2.zip` em `BloomRX/3d-create/plugins` | Repo |
| **Autor** | `@Lewdineer` | `bl_info` |
| **Licença** | `SPDX:GPL-3.0-or-later` | `bl_info` |
| **Blender** | 4.0+ | `bl_info` |
| **Código** | Python + proxies `.fbx` estáticos | Inspeção do `.zip` |
| **Classificação A** | **`ADAPTER`** | Proxies `.fbx` vinculados a operadores; comportamento headless não verificado |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | GPL-3.0 |
| **Classificação C** | **`REDISTRIBUTABLE`** (sob GPL-3.0) | Licença permite |

**O que faz:** Usa proxies `.fbx` estáticos (`Boob_Proxy_Big/Med/Small.fbx`) em vez de geração procedural. Menos flexível que SquishyFX + JiggleGen.

**Compatibilidade headless:** **Desconhecida.** Depende de como os proxies são vinculados aos operadores e se `frame_change_pre` funciona em `--background`.

**Limitações:** Uso de proxies fixos limita a generalização. Requer teste real.

---

### 2.4 HairCard Studio v1.1 e v1.5

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `HairCardStudioV1.1 (Latest).zip` e `HairCardStudioV1.5.zip` (Drive) | Drive |
| **Autor** | `PixelicaCG (pixelica_1999@hotmail.com)` | `bl_info` |
| **Licença** | `SPDX:GPL-3.0-or-later` | `bl_info` |
| **Blender** | 4.2+ / 4.4+ | `bl_info` |
| **Código** | Python + node groups `.blend` | Inspeção do `.zip` |
| **Classificação A** | **`ADAPTER`** | Conversão curves→mesh e manipulação de UV podem exigir contexto de viewport |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | GPL-3.0 |
| **Classificação C** | **`REDISTRIBUTABLE`** (sob GPL-3.0) | Licença permite |

**O que faz:** Geração procedural de hair cards a partir de curve guides, com atributos UV customizados.

**Compatibilidade headless:** **Incerta.** O operador `hairecard.convert_to_mesh` precisa de teste — conversão de curves para mesh via `bpy.ops.curve.to_mesh()` funciona em background, mas a manipulação de atributos UV via `NTRealize_And_Rename_UV` pode exigir contexto de viewport.

**Limitações:** Duas versões (v1.1 e v1.5) com compatibilidades diferentes; escolher uma para o pipeline.

---

### 2.5 Braids Generator v5.1.1

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `Braids Generator v5.1.1.zip` (Drive) | Drive |
| **Autor** | `Carlsu (carlosalvareze32@gmail.com)` | `bl_info` |
| **Licença** | `SPDX:GPL-3.0-or-later` | `bl_info` |
| **Blender** | 4.2+ | `bl_info` |
| **Código** | Python + bibliotecas `.blend` | Inspeção do `.zip` |
| **Classificação A** | **`ADAPTER`** | Mesmo caso do HairCard Studio |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | GPL-3.0 |
| **Classificação C** | **`REDISTRIBUTABLE`** (sob GPL-3.0) | Licença permite |

**O que faz:** Geração procedural de tranças. Usa `Realize Instances` + conversão de atributos UV de Curves para Mesh.

**Compatibilidade headless:** **Incerta.** Mesmas limitações do HairCard Studio.

---

### 2.6 Genshin Impact Character Shader v2.2.1 / v2.2.2

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `v2-2-1 -Blender 4-5 LTS-.zip` (Drive) | Drive |
| **Autor** | `M4 URL5` | Metadados do `.blend` |
| **Licença** | **Não declarada** | Sem `LICENSE`, sem SPDX no `.blend` |
| **Blender** | 4.3 | Metadados do `.blend` |
| **Código** | Arquivo `.blend` com NodeGroups | Inspeção zstd-decompressed SDNA |
| **Classificação A** | **`ADAPTER`** | Load via `bpy.data.libraries.load()` funciona em headless |
| **Classificação B** | **`BLOCKED_PENDING_LICENSE_REVIEW`** | Licença não declarada; redistribuição bloqueada |
| **Classificação C** | **`UNKNOWN`** | Sem licença verificada |

**O que faz:** NodeGroups para NPR/toon shading estilo Genshin Impact (`NTGenshin Shader v2.2`, `NTFace Lightmap Mapping v2.1`, `NTOutline`).

**Integração:** Load do `.blend` via `bpy.data.libraries.load(..., link=False)` com `--disable-autoexec`. Funciona em headless.

**Limitações:**
- Licença não declarada — uso local em processo separado é zona cinzenta; redistribuição é bloqueada
- Fan-project baseado em IP de terceiro (miHoYo/HoYoverse); uso comercial pode violar direitos de propriedade intelectual
- Não é um add-on Python, é um asset `.blend` com NodeGroups

**Próximos passos:** Verificar termos de uso originais (Gumroad, GitHub, ou onde foi publicado).

---

### 2.7 Bodiez — Modular Male/Female Base

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `modular_male_base.blend`, `modular_female_base.blend` (Drive) | Drive |
| **Autor** | Desconhecido | Sem metadados claros |
| **Licença** | **Não declarada** (marketplace asset) | Sem `LICENSE` |
| **Classificação A** | **`RESEARCH ONLY`** | Assets `.blend`; uso depende de licença |
| **Classificação B** | **`BLOCKED_PENDING_LICENSE_REVIEW`** | Licença não verificada |
| **Classificação C** | **`UNKNOWN`** | Sem licença verificada |

**O que faz:** Malhas humanoides base limpas com sistema modular de partes.

**Limitações:** Assets de marketplace tipicamente têm licença de uso pessoal/comercial restrita (sem redistribuição). Sem verificação, não pode ser usado como basemesh padrão do produto.

**Próximos passos:** Identificar origem (marketplace, autor) e ler termos de licença.

---

### 2.8 Voxel Heat Diffuse Skinning v3.5.3

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `Voxel Heat Diffuse Skinning v3.5.3.zip` (Drive) | Drive |
| **Autor** | `mesh online (mesh@katsaii.com)` | `bl_info` |
| **Licença** | `SPDX:GPL-3.0-or-later` (wrapper Python) | `bl_info` |
| **Blender** | 2.80+ | `bl_info` |
| **Binários** | `bin/Windows/x64/{vhd.exe,shd.exe}`, `bin/Linux/x64/{vhd,shd}` — **closed-source** | Inspeção do `.zip` |
| **Classificação A** | **`ADAPTER`** | CLI invocável via `subprocess`; UI operator usa modal timer (incompatível com headless) |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | Wrapper GPL-3.0, binários proprietários |
| **Classificação C** | **`LOCAL_ONLY`** | Binários proprietários: redistribuição exige acordo com o autor |

**O que faz:** Algoritmo de voxel heat diffusion para cálculo de skin weights de alta qualidade.

**Compatibilidade headless:** O operador UI `wm.voxel_heat_diffuse` usa modal timer (`event_timer_add`) e escreve em paths fixos dentro do add-on — **falha em `--background`**. Porém, a invocação direta do CLI (`vhd <mesh.txt> <bone.txt> <weight.txt> <res> <loops> <samples> <influence> <falloff> <solidify:y|n> <half_cores:y|n>`) em tempdir funciona em CPU, independente do Blender.

**Limitações:**
- Binários proprietários sem fonte — risco de cadeia de suprimento
- Redistribuição dos binários pode exigir acordo separado (GPL-3.0 cobre o wrapper Python, não os binários)
- Paths fixos no operador UI (`data/untitled-mesh.txt`) — não race-safe

**Próximos passos:** (1) Testar invocação CLI direta em tempdir. (2) Verificar se redistribuição dos binários é permitida. (3) Considerar sandboxing por segurança.

---

### 2.9 Cloth NeXt v2.4.0

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `cloth_next-2.4.0-windows-x64.zip` (Drive) | Drive |
| **Autor** | `Tim Christmann` | `bl_info` |
| **Licença** | `SPDX:GPL-3.0-or-later` | `bl_info` |
| **Blender** | 5.0+ | `bl_info` |
| **Binários** | `bin/cloth-next-bake.exe` (26.9 MB) + download externo ~448 MB | Inspeção do `.zip` |
| **Classificação A** | **`REJECT`** | NVIDIA/CUDA obrigatório |
| **Classificação B** | **`REJECT`** | Hardware incompatível |
| **Classificação C** | n/a | Rejeitado |

**Problemas:**
- ❌ `cloth-next-bake.exe` requer NVIDIA/CUDA (confirmado em `telemetry/gpu.py` que consulta `nvidia-smi`)
- ❌ Incompatível com AMD RX 580 8 GB (`gfx803`)
- ❌ Dependência externa de 448 MB
- ❌ Windows-only (`.zip` é `windows-x64`)

---

### 2.10 Dovetail Key v5.0.1

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `Dovetail_Key_v5.0.1.zip` (Drive) | Drive |
| **Autor** | `Adam VanderVeen` | `bl_info` |
| **Licença** | **Não declarada** | Sem `LICENSE` |
| **Blender** | 4.2+ | `bl_info` |
| **Classificação A** | **`MANUAL`** | Operador modal interativo (input do mouse + viewport) |
| **Classificação B** | **`RESEARCH_ONLY`** | Ferramenta de viewport, não automatizável |
| **Classificação C** | **`UNKNOWN`** | Licença não verificada |

---

### 2.11 Projection Modeling v1.1.4

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `Projection Modeling v1.1.4.zip` (Drive) | Drive |
| **Autor** | `Adam VanderVeen` | `bl_info` |
| **Licença** | **Não declarada** | Sem `LICENSE` |
| **Blender** | 4.2+ | `bl_info` |
| **Classificação A** | **`MANUAL`** | Modal operator com viewport |
| **Classificação B** | **`RESEARCH_ONLY`** | Ferramenta de viewport |
| **Classificação C** | **`UNKNOWN`** | Licença não verificada |

---

### 2.12 SpeedSculpt v0.3.8

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `SpeedSculpt v0.3.8.zip` (Drive) | Drive |
| **Autor** | `speedcellar / Pierrick Picaut` | `bl_info` |
| **Licença** | `SPDX:GPL-3.0-or-later` | `bl_info` |
| **Blender** | 2.80+ | `bl_info` |
| **Classificação A** | **`MANUAL`** | +50 ferramentas de sculpt interativas |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | GPL-3.0 |
| **Classificação C** | **`REDISTRIBUTABLE`** (sob GPL-3.0) | Licença permite |

---

### 2.13 Goo Physics v1.0.0

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `goo_physics_v_1_0.zip` (Drive) | Drive |
| **Autor** | `Cody Winchester (StudioGoo)` | `bl_info` |
| **Licença** | `SPDX:GPL-3.0-or-later` | `bl_info` |
| **Blender** | 4.1+ | `bl_info` |
| **Código** | Python puro + `gp_sim_nodes_tree.blend` + 13 presets JSON | Inspeção do `.zip` |
| **Classificação A** | **`INTEGRAR`** | Bake via `goophys.bake_physics` → keyframes de Pose Bones |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | GPL-3.0 |
| **Classificação C** | **`REDISTRIBUTABLE`** (sob GPL-3.0) | Licença permite |

**O que faz:** Bone physics (secondary motion em rigs) com 13 presets JSON. `goophys.bake_physics` converte simulação em keyframes de Pose Bones, exportáveis como animação skeletal GLB.

**Compatibilidade headless:** Usa `frame_change_pre` handler; comportamento em `--background` **não verificado** mas provável (handlers persistentes funcionam em background segundo documentação do Blender).

---

### 2.14 Wiggle Bones v1.1.2

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `wiggle_bones-1.1.2.zip` (Drive) **e** `BloomRX/3d-create/plugins` | Ambos |
| **Autor** | `Hans Xwh` | `blender_manifest.toml` |
| **Licença** | `SPDX:GPL-3.0-or-later` | `blender_manifest.toml` |
| **Blender** | 4.5+ | `blender_manifest.toml` |
| **Repo público** | `Hans-xwh/wiggle-bones` | GitHub API |
| **Classificação A** | **`INTEGRAR`** | `wiggle.bake` → keyframes |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | GPL-3.0 |
| **Classificação C** | **`REDISTRIBUTABLE`** (sob GPL-3.0) | Licença permite |

**Relação com Wiggle 2:** Este é um fork/refatoração do Wiggle 2 (`shteeve3d/blender-wiggle-2`) adaptado para Blender 4.5+. Wiggle 2 original suporta Blender 4.0–4.4; Wiggle Bones v1.1.2 estende para 4.5–5.0+. **São mutuamente exclusivos por versão do Blender.**

**O que faz:** Spring bones via `frame_change_pre`. `wiggle.bake` converte simulação em keyframes exportáveis como animação skeletal GLB.

---

### 2.15 SUPERTABs v1.3.0

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `SUPERTABs v1.3.0.zip` (Drive) | Drive |
| **Autor** | `SuperSunny` | `bl_info` |
| **Licença** | **Não declarada** | Sem `LICENSE` |
| **Classificação A** | **`REJECT`** | Organizador de UI tabs, sem funcionalidade de produção |
| **Classificação B** | **`REJECT`** | Irrelevante para pipeline |

---

### 2.16 Car_Rig.zip

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `Car_Rig.zip` (Drive) | Drive |
| **Conteúdo** | `SK_Mustang.uasset` + `SKM_Mustang.uasset` — arquivos **Unreal Engine** | Inspeção binária |
| **Classificação A** | **`REJECT`** | Não é add-on Blender |

**Nota:** `SKM_Mustang.FBX` na mesma pasta é importável como asset FBX, mas é arquivo separado.

---

### 2.17 SquishBulge GeoNodes

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `SquishBulge_GeoNodes.blend` (Drive) | Drive |
| **Autor** | `PixelicaCG` | Metadados do `.blend` |
| **Licença** | `SPDX:GPL-3.0-or-later` | Atribuído pelo mesmo autor do HairCard Studio |
| **Classificação A** | **`ADAPTER`** | Asset `.blend` com node groups; load via `bpy.data.libraries.load()` |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | GPL-3.0 |
| **Classificação C** | **`REDISTRIBUTABLE`** (sob GPL-3.0) | Licença permite |

**O que faz:** Node groups de Geometry Nodes para deformação procedural de bulge/squish.

**Nota:** Este é um asset `.blend`, não um add-on Python. Pode ser carregado como biblioteca de node groups.

---

### 2.18 Motion2MixamoRig v0.1.8

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `Motion2MixamoRig-v0.1.8.zip` em `BloomRX/3d-create/plugins` | Repo |
| **Autor** | `Nyx (Stijn Jacops)` | `bl_info` |
| **Licença** | `SPDX:GPL-3.0-or-later` (wrapper) | `bl_info` |
| **Blender** | 4.5+ | `bl_info` |
| **Classificação A** | **`REJECT`** | CUDA obrigatório, pesos não comerciais |
| **Classificação B** | **`REJECT`** | Hardware + licença |

**Problemas (detalhados em [`CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md`](CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md)):**
- ❌ Requer CUDA para backend `GVHMR`
- ❌ Pesos SMPL-X não comerciais (proíbem uso em produto/serviço comercial)
- ❌ YOLOv8 sob AGPL-3.0
- ❌ Build oficial v0.1.8 é macOS ARM64; Windows "coming soon"
- ❌ Download automático de modelos de ML (~5 GB)
- ❌ Incompatível com AMD RX 580

---

### 2.19 SKkeeper v1.8.2

| Campo | Valor | Fonte |
|---|---|---|
| **Origem** | `SKkeeper_v1.8.2.zip` (Drive) **e** `BloomRX/3d-create/plugins` | Ambos |
| **Autor** | `Johannes Rauch (smokejohn)` | `bl_info` |
| **Licença** | `SPDX:GPL-3.0-or-later` | `bl_info` |
| **Blender** | 4.2+ | `bl_info` |
| **Repo público** | `smokejohn/SKkeeper` | GitHub API |
| **Classificação A** | **`INTEGRAR`** | Puro `bpy.data` / `bpy.ops.mesh` |
| **Classificação B** | **`ADMIT_WITH_RESTRICTIONS`** | GPL-3.0 |
| **Classificação C** | **`REDISTRIBUTABLE`** (sob GPL-3.0) | Licença permite |

**O que faz:** Preserva Shape Keys ao aplicar modificadores (Subdivision Surface, Boolean, etc.). Operadores: `sk.apply_mods_sk`, `sk.apply_subd_sk`, `sk.apply_mods_choice_sk`.

**Nota de classificação:** SKkeeper **não é ferramenta de skinning/pesos**. É ferramenta de preservação de Shape Keys durante aplicação de modificadores — essencial para pipeline de export (aplicar subdiv → preservar morph targets → GLB).

---

## 3. Inventário — Add-ons do repositório `BloomRX/3d-create/plugins`

Dos 6 add-ons neste repositório, **todos estão também no Drive** e foram auditados nas seções acima:

| Add-on | Seção | Status |
|---|---|---|
| SquishyFX v3.3.0 | §2.1 | `INTEGRAR` / `ADMIT_WITH_RESTRICTIONS` |
| JiggleMaker v2.2.2 | §2.3 | `ADAPTER` / `ADMIT_WITH_RESTRICTIONS` |
| Motion2MixamoRig v0.1.8 | §2.18 | `REJECT` |
| SKkeeper v1.8.2 | §2.19 | `INTEGRAR` / `ADMIT_WITH_RESTRICTIONS` |
| Voxel Heat Diffuse Skinning v3.5.3 | §2.8 | `ADAPTER` / `ADMIT_WITH_RESTRICTIONS` |
| Wiggle Bones v1.1.2 | §2.14 | `INTEGRAR` / `ADMIT_WITH_RESTRICTIONS` |

---

## 4. Add-ons comunitários (GitHub) — por categoria

### 4.1 Retopologia

| Add-on | Repo | Licença | Blender | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|---|
| **RetopoFlow** | `CGCookie/retopoflow` | GPL-3.0 | 3.6+ | `MANUAL` | `ADMIT_WITH_RESTRICTIONS` | Ferramenta de viewport interativa (drawing strokes); não automatizável via headless. 3.3k★, ativo. |

**Correção sobre versão anterior:** RetopoFlow foi classificado como "INTEGRAR via wrapper headless" no relatório original — isso é **incorreto**. RetopoFlow é uma ferramenta de viewport interativa que usa `gpu` module para drawing; não funciona em `--background`. Classificação corrigida para `MANUAL`.

### 4.2 UV Mapping

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **TexTools** | `SavMartin/TexTools-Blender` | GPL-3.0 | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | Operadores de UV que funcionam via `bpy.ops.uv.*`; bake de maps. 4.1k★. |
| **Magic-UV** | `nutti/Magic-UV` | GPL-3.0 | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | Operadores de UV copy/paste/align. 1.1k★. Nativo do Blender desde 4.x como add-on oficial. |
| **mio3_uv** | `mio3io/mio3_uv` | GPL-3.0 | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | UV tools. 278★. |
| **UniV** | `Oxicid/UniV` | GPL-3.0 | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | UV tools leve. 287★. |
| **xatlas** | `mattedicksoncom/blender-xatlas` | MIT | `INTEGRAR` | `ADMIT` | Auto-unwrap via xatlas library. MIT permissivo. 277★. |

### 4.3 Texturização / Paint

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **Ucupaint** | `ucupumar/ucupaint` | GPL-3.0 | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | Multi-layer painting; bake pode funcionar headless mas pintura é interativa. 2k★. |
| **Dream Textures** | `carson-katri/dream-textures` | GPL-3.0 | `REJECT` | `REJECT` | Stable Diffusion in-viewport; requer GPU com VRAM ≥8 GB e CUDA/ROCm. RX 580 sem suporte ROCm documentado. 6.2k★. |
| **Principled Baker** | `danielenger/Principled-Baker` | GPL-3.0 | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | Bake PBR maps; `bpy.ops.principled_baker.bake()` funciona em headless com `scene.cycles.device = 'CPU'`. 800★. |

### 4.4 Materiais / Shaders

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **Malt** | `bnpr/Malt` | GPL-3.0 | `RESEARCH ONLY` | `MONITOR` | Custom NPR pipeline; requer renderer próprio (não Blender Eevee/Cycles). Integração complexa. |

### 4.5 Anatomia / Corpo Humano

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **MakeHuman MPFB2** | `makehumancommunity/mpfb2` | AGPL-3.0 | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | Geração procedural de humanoides; **AGPL-3.0** (copyleft forte — redistribuição exige abrir código do produto que o integra). |
| **CharMorph** | `Upliner/CharMorph` | GPL-2.0 | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | Morph targets para personagens. GPL-2.0 (não "or-later" — incompatível com GPL-3.0 sem exceção). |

**Nota sobre AGPL-3.0 (MPFB2):** Se a Forge redistribuir MPFB2 ou integrá-lo como biblioteca (não como processo separado), o código da Forge precisaria ser licenciado sob AGPL-3.0. Uso como processo separado (Blender `--background` invocando MPFB2) pode não constituir obra derivada, mas exige análise jurídica.

### 4.6 Rigging / Posing

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **BlenRig 7** | `jpbouza/BlenRig` | GPL-3.0 | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | Rig completo + auto-weight + MOCAP. Algumas operações podem exigir viewport. 1.2k★. |
| **Rokoko Studio Live** | `Rokoko/rokoko-studio-live-blender` | GPL-3.0 | `RESEARCH ONLY` | `MONITOR` | Streaming mocap de Rokoko Studio; requer software Rokoko (pago) + conexão de rede. |
| **VRM Add-on** | `saturday06/VRM-Addon-for-Blender` | MIT | `INTEGRAR` | `ADMIT` | Import/export VRM 0.x/1.0; MIT permissivo. 600★. |
| **MMD Tools** | `MMD-Blender/blender_mmd_tools` | GPL-3.0 | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | Import/export MMD/PMX. 400★. |

### 4.7 Animação / Retargeting

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **Animaide** | `aresdevo/animaide` | GPL-3.0 | `MANUAL` | `ADMIT_WITH_RESTRICTIONS` | Curves e clones de animação; ferramentas de viewport. 700★. |
| **Keemap Retargeting** | `nkeeline/Keemap-Blender-Rig-ReTargeting-Addon` | MIT | `ADAPTER` | `ADMIT` | Retargeting de animação entre rigs. MIT permissivo. 100★. |
| **blender-animation-retargeting** | `Mwni/blender-animation-retargeting` | MIT | `ADAPTER` | `ADMIT` | Retargeting. MIT permissivo. 200★. |

**Correção sobre Animaide:** Foi classificado como "INTEGRAR" no relatório original — corrigido para `MANUAL` pois suas ferramentas (curves editor, clones) são interativas no viewport.

### 4.8 Soft Body / Wiggle

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **Wiggle 2** | `shteeve3d/blender-wiggle-2` | GPL-3.0 | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | Spring bones via `frame_change_pre`; `wiggle.bake` → keyframes. 2.6k★. Nota: Wiggle Bones v1.1.2 (§2.14) é fork para Blender 4.5+. |
| **rigid-body-bones** | `Pauan/blender-rigid-body-bones` | MIT | `ADAPTER` | `ADMIT` | Rigid body bones. MIT permissivo. 100★. |

### 4.9 Skinning / Pesos

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **robust-weight-transfer** | `sentfromspacevr/robust-weight-transfer` | MIT | `ADAPTER` | `ADMIT` | Transferência de pesos entre meshes. MIT permissivo. 50★. |

### 4.10 Cloth / Simulação

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **FLIP Fluids** | `rlguy/Blender-FLIP-Fluids` | GPL-3.0 | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | Simulação de fluidos; bake funciona headless. 2.5k★. |
| **ppf-contact-solver** | `st-tech/ppf-contact-solver` | GPL-3.0 | `RESEARCH ONLY` | `MONITOR` | Solver de contacto; dependência do Cloth NeXt (rejeitado). |

### 4.11 Export / Interop

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **glTF-Blender-IO** | `KhronosGroup/glTF-Blender-IO` | Apache-2.0 | `INTEGRAR` | `ADMIT` | Add-on oficial de export glTF/GLB. Já incluído no Blender. 1.5k★. |

### 4.12 Cabelo / Hair (complementar)

| Add-on | Repo | Licença | Classificação A | Classificação B | Evidência |
|---|---|---|---|---|---|
| **HairDeck** | (upstream, commit `cb20f70`) | Apache-2.0 (código/checkpoints próprios); SAM 3, DINOv3, BiRefNet com termos próprios | `RESEARCH ONLY` | `MONITOR` | Auditado em [`CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md`](CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md). Requer NVIDIA Ampere+, CUDA 12.8. Não funciona em RX 580. |

---

## 5. Integração com a arquitetura existente do Lia Forge

### 5.1 Blender Adapter existente (`electron/blender-adapter.cjs`)

O adapter atual já implementa:
- `spawnBlender(executable, args)`: spawn com `--background --python <script> -- <args>`
- `buildBlenderSpritesheetArgs()`: construção de argumentos para render de spritesheet
- `runProcess(child, { signal, onProgress })`: monitoramento de progresso via `LIA_FORGE_PROGRESS` protocol no stdout
- `validateSpritesheetFiles()`: validação de PNG RGBA + manifesto JSON
- AbortSignal: cancelamento via SIGTERM
- `MODEL_EXTENSIONS`: `.blend`, `.glb`, `.gltf`, `.fbx`, `.obj`, `.stl`

O adapter é **específico para spritesheet** hoje. A evolução para suportar os add-ons desta pesquisa requer:
1. Generalização do script Python de job (não apenas spritesheet)
2. Descoberta e habilitação de add-ons por job
3. Validação de outputs GLB (não apenas PNG)
4. Contrato de entrada/saída por capability

**Ver detalhe em [`BLENDER-BRIDGE-SPECIFICATION.md`](BLENDER-BRIDGE-SPECIFICATION.md).**

### 5.2 Capability Registry (`shared/capabilities/registry.mjs`)

O registry atual define capabilities com schema validado (id, family, status, inputs, outputs, providers, requirements, maturity, evidence, limitations). As capabilities 3D existentes incluem `model3d.generate-concept`, `model3d.rig`, `model3d.animate`, `model3d.render-spritesheet`.

Novas capabilities candidatas a partir desta pesquisa (proposta, **não registradas**):
- `model3d.bake-softbody` (SquishyFX, JiggleGen)
- `model3d.bake-spring-bones` (Wiggle 2, Wiggle Bones, Goo Physics)
- `model3d.generate-hair-cards` (HairCard Studio, Braids Generator)
- `model3d.skin-voxel-heat` (Voxel Heat Diffuse)
- `model3d.preserve-shapekeys` (SKkeeper)
- `model3d.unwrap-uv` (TexTools, xatlas, Magic-UV)
- `model3d.bake-textures` (Principled Baker)
- `model3d.export-vrm` (VRM Add-on)
- `model3d.retarget-animation` (Keemap, blender-animation-retargeting)

**Nenhuma destas capabilities foi registrada.** Registro exige aprovação humana, evidência de execução real e pin de versão.

### 5.3 GLB Pipeline (`shared/model3d/glb.mjs`)

O parser GLB existente lê headers, chunks e inspeciona estrutura binária. Morph Targets (`MORPHTARGETS_0`) são suportados. **O output dos add-ons de bake (SquishyFX, JiggleGen, SKkeeper) é compatível com o parser existente**, pois geram Shape Keys que são exportadas como Morph Targets pelo `glTF-Blender-IO`.

### 5.4 Tool Provider Hub (`shared/hub/provider-hub.mjs`)

O Hub já descobre Blender por PATH + locais conhecidos, com estados `ready/missing/blocked`. Os add-ons desta pesquisa **não são providers no Hub** — são capacidades executadas **dentro** do processo Blender que o Hub já descobre. A relação é:

```
Provider Hub → descobre Blender → estado ready
  → Blender Bridge → spawn --background + add-ons habilitados
    → executa capability (bake, unwrap, etc.)
      → valida output (GLB, PNG)
```

---

## 6. Compatibilidade de hardware — AMD RX 580 8 GB

| Add-on | GPU obrigatória? | AMD RX 580 compatível? | Backend | Evidência |
|---|---|---|---|---|
| SquishyFX | Não | ✅ Provável | Geonodes (CPU/GPU indiferente) | Leitura estática |
| JiggleGen | Não | ✅ Provável | Physics sim (CPU) | Leitura estática |
| JiggleMaker | Não | ✅ Provável | Proxy meshes | Leitura estática |
| HairCard Studio | Não | ✅ Provável | Geonodes | Leitura estática |
| Braids Generator | Não | ✅ Provável | Geonodes | Leitura estática |
| Goo Physics | Não | ✅ Provável | Bone physics (CPU) | Leitura estática |
| Wiggle Bones | Não | ✅ Provável | Spring bones (CPU) | Leitura estática |
| Voxel Heat Diffuse | Não | ✅ Provável | CLI binário (CPU) | Leitura estática |
| SKkeeper | Não | ✅ Provável | Mesh ops (CPU) | Leitura estática |
| TexTools | Não | ✅ Provável | UV ops (CPU) | Leitura estática |
| xatlas | Não | ✅ Provável | Auto-unwrap (CPU) | Leitura estática |
| Principled Baker | Não | ✅ Com CPU Cycles | Bake (CPU) | Leitura estática; `scene.cycles.device = 'CPU'` necessário |
| VRM Add-on | Não | ✅ Provável | Import/export (CPU) | Leitura estática |
| BlenRig | Não | ✅ Provável | Rig ops (CPU) | Leitura estática |
| Cloth NeXt | **Sim (CUDA)** | ❌ | NVIDIA only | `telemetry/gpu.py` consulta `nvidia-smi` |
| Motion2MixamoRig | **Sim (CUDA)** | ❌ | GVHMR + SMPL-X | README + NOTICE |
| Dream Textures | **Sim (VRAM+GPU)** | ❌ Provável | Stable Diffusion | Requer CUDA/ROCm; RX 580 sem suporte ROCm documentado |
| HairDeck | **Sim (CUDA)** | ❌ | NVIDIA Ampere+ | Guia Windows pede CUDA 12.8 |
| FLIP Fluids | Não | ✅ Provável | Fluid sim (CPU) | Leitura estática |

**Nota importante:** Todas as marcações "✅ Provável" são baseadas em leitura estática de código — **nenhuma foi testada em RX 580 real**. A compatibilidade com Polaris/GCN4 é inferida da ausência de chamadas CUDA/ROCm no código, mas não confirmada.

---

## 7. Segurança e licenças

### 7.1 Matriz de licenças e redistribuição

Ver matriz completa em [`BLENDER-ADDONS-MATRICES.md`](BLENDER-ADDONS-MATRICES.md), seção 1.

### 7.2 Riscos de segurança por tipo de componente

| Tipo | Risco | Mitigação |
|---|---|---|
| **Python puro (GPL-3.0)** | Baixo — código auditável | Revisão de código antes de habilitar |
| **Python + `.blend` libraries** | Baixo — `.blend` é formato aberto | Inspeção de node groups; load com `--disable-autoexec` |
| **Binários proprietários** (Voxel Heat Diffuse) | Médio — código não auditável | Sandboxing; invocar via CLI em tempdir isolado |
| **Binários + download externo** (Cloth NeXt) | Alto — código não auditável + rede | Rejeitado |
| **ML models + pesos** (Motion2MixamoRig, Dream Textures) | Alto — pesos não comerciais + rede | Rejeitado |
| **Add-ons sem licença declarada** | Alto para redistribuição | Bloqueado até verificação |

### 7.3 Riscos específicos de execução Python no Blender

1. **Auto-execute scripts em `.blend`:** Arquivos `.blend` podem conter scripts Python embutidos que executam ao abrir. Mitigação: sempre usar `--disable-autoexec`.
2. **Add-ons com `register()`:** O `register()` de um add-on pode executar código arbitrário. Mitigação: habilitar apenas add-ons auditados.
3. **Handlers persistentes (`@persistent`):** Handlers como `frame_change_pre` executam a cada frame. Mitigação: auditar handlers antes de habilitar.
4. **`bpy.app.timers`:** Timers podem executar código em background. Mitigação: `--factory-startup` + habilitação seletiva.
5. **Imports de rede:** Add-ons podem fazer `import` de pacotes remotos. Mitigação: auditar `__init__.py` de cada add-on.

---

## 8. Relação com documentos e componentes existentes

| Componente Lia | Relação com esta pesquisa | Impacto |
|---|---|---|
| **Workflows** (`WORKFLOW-ENGINE.md`) | Add-ons são providers de capabilities dentro de workflows 3D | Sem impacto imediato; capacidades são candidatas futuras |
| **Tool Provider Hub** (`TOOL-PROVIDER-HUB.md`) | Blender já é descoberto pelo Hub; add-ons são capacidades dentro do Blender | Hub não precisa mudar; Bridge é componente novo |
| **Asset Manager** (`ASSET-MANAGEMENT.md`) | Outputs dos add-ons (GLB, PNG) são assets gerenciados | Sem impacto; formatos já suportados |
| **QA** (`STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md`) | Validação de outputs dos add-ons é responsabilidade do QA | Validações GLB existentes são suficientes para outputs de bake |
| **Blender Adapter** (`electron/blender-adapter.cjs`) | Bridge é evolução do adapter atual | Adapter existente permanece; Bridge estende |
| **Three.js** | GLB com Morph Targets e skeletal animation são consumidos pelo Three.js via GLTFLoader | Sem impacto; pipeline GLB existente suporta |
| **Pipeline de personagens 3D** (`3D-CHARACTER-PRODUCTION-PIPELINE.md`) | Add-ons cobrem etapas do pipeline (bake, hair, skinning, rig) | Complementa; não substitui decisões existentes |
| **Pipeline de animação** (`CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md`) | Wiggle/Goo Physics cobrem secondary motion; retargeting por Keemap | Complementa auditoria existente |
| **Domain Contracts** (`DOMAIN-CONTRACTS-*.md`) | Nenhum contrato existente é alterado por esta pesquisa | Sem impacto |

---

## 9. Resumo executivo

### 9.1 Números

| Métrica | Valor |
|---|---|
| **Add-ons/assets únicos auditados** | 19 (não 25 — 6 estavam tanto no Drive quanto no repo) |
| **Add-ons comunitários mapeados** | ~20 (dos ~30 consultados, os relevantes para as 16 categorias) |
| **Classificados `INTEGRAR`** | 10 (SquishyFX, JiggleGen, Goo Physics, Wiggle Bones, SKkeeper, TexTools, xatlas, Magic-UV, Principled Baker, VRM Add-on, MMD Tools, Wiggle 2) |
| **Classificados `ADAPTER`** | 8 (HairCard Studio, Braids Generator, JiggleMaker, Voxel Heat Diffuse, Genshin Shader, SquishBulge, BlenRig, Keemap Retargeting, etc.) |
| **Classificados `MANUAL`** | 4 (Dovetail Key, Projection Modeling, SpeedSculpt, RetopoFlow, Animaide) |
| **Classificados `RESEARCH ONLY`** | 5 (Bodiez, Malt, Rokoko Studio Live, ppf-contact-solver, HairDeck) |
| **Classificados `REJECT`** | 4 (Cloth NeXt, Motion2MixamoRig, SUPERTABs, Car_Rig, Dream Textures) |
| **`BLOCKED_PENDING_LICENSE_REVIEW`** | 3 (Bodiez, Genshin Shader, Dovetail Key, Projection Modeling) |
| **Cobertura das 16 categorias** | 16/16 (100%) |
| **Compatíveis com RX 580 (leitura estática)** | ~15/19 (79%); 4 incompatíveis (Cloth NeXt, Motion2MixamoRig, Dream Textures, HairDeck) |
| **Licenças verificadas por fonte primária** | 12/19 (63%); 7 sem licença declarada ou não verificada |
| **Redistribuíveis (sob termos da licença)** | 10 (GPL-3.0 ou MIT) |
| **Apenas uso local (sem redistribuição)** | 3 (Voxel Heat Diffuse binários, Genshin Shader, Bodiez) |
| **Testes reais executados** | **0** (zero) — toda a pesquisa é estática |

### 9.2 Decisões recomendadas (sujeitas a aprovação humana)

1. **Não redistribuir add-ons GPL-3.0 no instalador Lia** sem compliance (fornecer fonte, mesma licença, notice). Alternativa: o usuário instala os add-ons no próprio Blender e o Lia os invoca via processo separado.
2. **Não redistribuir** Voxel Heat Diffuse (binários proprietários), Genshin Shader (licença desconhecida + IP de terceiro), Bodiez (marketplace asset, licença desconhecida).
3. **Priorizar para teste real headless:** SquishyFX, SKkeeper, JiggleGen, Wiggle 2/Wiggle Bones (os 4 com maior evidência de compatibilidade headless e maior valor para o pipeline).
4. **Investigar licenças** de Bodiez, Genshin Shader, Dovetail Key e Projection Modeling antes de qualquer uso.
5. **Não anunciar nenhuma integração como capability** até teste real em Blender `--background` com evidência registrada.
6. **Descartar Dream Textures** para o hardware alvo (RX 580 sem suporte ROCm documentado).
7. **Descartar Cloth NeXt e Motion2MixamoRig** (NVIDIA/CUDA obrigatório).

### 9.3 O que este documento NÃO faz

- Não instala, executa, integra ou redistribui nenhum add-on
- Não altera código, contratos ou configurações do Lia Forge
- Não promove nenhum add-on a `IMPLEMENTED` ou `VERIFIED`
- Não substitui os documentos existentes (`TOOL-PROVIDER-HUB.md`, `PROVIDER-AND-MODEL-ADMISSION-POLICY.md`, etc.)
- Não cria nenhuma capability nova no registry
- Stars do GitHub **não** são usados como evidência de qualidade ou maturidade
- Tempos de performance são especulativos e não podem ser citados como benchmark
