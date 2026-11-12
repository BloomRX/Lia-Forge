# T12 — Matriz de capacidades, ferramentas externas, adapters e backends

> **Estado:** `CONSOLIDATION — PROPOSED`. Nenhuma ferramenta aqui foi integrada, instalada, executada, clonada ou licenciada. Pesquisa ≠ capacidade.
> **Data:** 2026-11-12 (UTC). **Base:** estado final da T11 (`2f41360`) + auditoria de código da T12 ([`T12-ARCHITECTURE-AND-TOOLCHAIN-CONSOLIDATION.md`](T12-ARCHITECTURE-AND-TOOLCHAIN-CONSOLIDATION.md)).
> **Fontes consolidadas:** [`T9-ASSET-TOOLS-AND-EXECUTION-MATRIX.md`](T9-ASSET-TOOLS-AND-EXECUTION-MATRIX.md), [`T9-EXECUTION-BACKEND-ARCHITECTURE.md`](T9-EXECUTION-BACKEND-ARCHITECTURE.md), [`T10-E1-RX580-VULKAN-PREFLIGHT.md`](T10-E1-RX580-VULKAN-PREFLIGHT.md), [`T10-E3-RENDERER-VALIDATION.md`](T10-E3-RENDERER-VALIDATION.md), [`T11-2D-ANIMATION-TOOLS-MATRIX.md`](T11-2D-ANIMATION-TOOLS-MATRIX.md), [`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md), [`ASSET-PIPELINES.md`](ASSET-PIPELINES.md), [`CAPABILITY-BOUNDARIES-AND-ROADMAP.md`](CAPABILITY-BOUNDARIES-AND-ROADMAP.md), [`CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md`](CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md), [`PROVIDER-AND-MODEL-ADMISSION-POLICY.md`](PROVIDER-AND-MODEL-ADMISSION-POLICY.md).
> **Pesquisa nova desta tarefa:** `NVlabs/motionbricks` e `localai-org/motion-bricks.cpp` (fonte primária GitHub, 2026-11-12) — único item solicitado que não estava registrado anteriormente.

---

## 1. Capability Catalog

Capacidades são **o que o Forge produz**; nunca ficam permanentemente ligadas a uma ferramenta. `Estado` usa o vocabulário da T12 §0.1. IDs marcados **(T11 proposta)** vieram de [`T11-2D-ANIMATION-WORKFLOWS.md`](T11-2D-ANIMATION-WORKFLOWS.md) §5 e **não estão aprovados**.

### 1.1 2D

| Capacidade (id) | Estado | Entradas | Saídas | Dependências | Ferramentas candidatas | QA necessário | Maturidade | Prioridade | Consumidores |
|---|---|---|---|---|---|---|---|---|---|
| `image2d.generate-concept` | `IMPLEMENTED` (código) / `BLOCKED` (execução: sem ComfyUI) | brief+prompt, checkpoint **já instalado** | PNG conceitual validado | ComfyUI local, escolha humana de checkpoint | ComfyUI (GPL-3.0, processo separado) | estrutural PNG + revisão visual humana | Beta | já usada na etapa 1 | Studio, jogo, UI |
| `image2d.illustration` / `pixel-art` / `tileset` | `NOT_IMPLEMENTED` | brief, referência, paleta, grid | PNG por peça/tile, atlas opcional | editor ou provider de imagem | Krita (GPL-3.0, manual), Aseprite (source-available, pago), ComfyUI | resolução/paleta/tiling sem costura | — | baixa-média | jogo 2D, UI |
| `image2d.icon` | `NOT_IMPLEMENTED` | brief, tamanho-alvo | PNG/SVG em grades | — | Krita, Godot (import) | legibilidade em tamanho real | — | baixa | UI, HUD |
| `image2d.scenario` | `NOT_IMPLEMENTED` | imagem/referência de ambiente | camadas/parallax/fundo | `env.reconstruct` ou separação de camadas | see-through, ComfyUI | escala coerente com perfil, estático/dinâmico declarado | — | baixa-média (§1.2 de fronteiras) | jogo, vídeo |
| `image2d.decompose-layers` **(T11 proposta)** | `NOT_IMPLEMENTED` | imagem autorizada + hashes | camadas RGBA + máscaras editáveis + regiões ocultas **marcadas como reconstruídas** | pesos licenciados, gate humano de máscaras | `shitagaki-lab/see-through` (Apache-2.0), CLD/LayerD/RevealLayer (índice CC0), `link-ding/image-to-psd` | alpha por camada, ordem de oclusão, sem sangramento | Experimental | alta para o fluxo B 2D | rig 2D, UI, VFX |
| `ui2d.animate` **(T11 proposta)** | `NOT_IMPLEMENTED` | peças de UI, estados | tweens/state machine ou atlas | destino com runtime adequado | Godot (`AnimationPlayer`, tweens), OpenBone (state machines) | estados alcançáveis, sem flicker | — | média | UI, menus, popups |
| `vfx2d.generate` **(T11 proposta)** | `NOT_IMPLEMENTED` | descrição/partículas | partículas ou spritesheet procedural | idem | Godot (`GPUParticles2D`), spritesheet existente | loop fechado, sem flicker, orçamento de draw | — | média | jogo, UI |
| `render.spritesheet` | `IMPLEMENTED` (código) / `BLOCKED` (execução real: sem Blender+asset) | modelo 3D ou rig, ações, frame size | PNG RGBA8 + manifesto `schemaVersion 1` | Blender, ações nomeadas | **renderer interno** (`scripts/blender_spritesheet.py`) | estrutural (grade 8×N, pivôs, duração) **+ conteúdo (lacuna G8)** | Beta | núcleo | jogo, Lia Desktop, docs |
| `asset.export-for-target` | `PARTIAL` (manifesto+task JSON v2) | artefatos aprovados | pacote por destino + manifesto de importação | perfil de destino | Godot/Unity/Unreal (formatos), exporter interno | escala, eixos, unidades, FPS, root motion | Experimental | alta | todos os destinos |

### 1.2 2.5D

| Capacidade | Estado | Entradas → saídas | Ferramentas candidatas | QA | Prioridade |
|---|---|---|---|---|---|
| `image2d.decompose-parts` (partes + ordem) | `NOT_IMPLEMENTED` | imagem → partes com pixels próprios e fronteiras | see-through, image-to-psd, doll-studio | gate humano de máscaras | alta (fluxo B) |
| `occlusion.inpaint` (reconstrução de regiões ocultas) | `NOT_IMPLEMENTED` | partes → pixels inferidos **rotulados como gerados** | see-through (inpaint), lama (Apache-2.0) | declarar conteúdo reconstruído; nunca confundir com original | alta |
| `rig2d.build` **(T11 proposta)** | `NOT_IMPLEMENTED` | camadas → esqueleto, hierarquia, pesos/meshes | `matbn/2DAutoRigger` (**licença divergente**, REFINE GATE), `UXCentury/open-bone` (MIT, MCP), Godot `Skeleton2D`/`Bone2D`, manual | gate humano de juntas; sem ossos órfãos | alta |
| `rig2d.deform` | `NOT_IMPLEMENTED` | rig → deformação/meshes/linked meshes | OpenBone (linked meshes), Godot (polígono interno) | sem ruptura em pose extrema | média |
| `rig2d.animate` | `NOT_IMPLEMENTED` | rig → clips (idle/walk/run/…) | OpenBone, Godot, agente sobre formato editável | loops fechados, contagem de keys | alta |
| `rig2d.animate-assisted` **(T11 proposta)** | `NOT_IMPLEMENTED` | rig + descrição textual → keyframes editáveis | agente hospedeiro (método do vídeo T11), OpenBone MCP | **limpeza manual obrigatória**; comparação com referência | média-alta |
| `rig2d.expressions` | `NOT_IMPLEMENTED` | rig facial → blendshapes/keys faciais | OpenBone (medição facial), Live2D Cubism (proprietário, `UNKNOWN`) | simetria, sem drift | média |
| `rig2d.compose` (personagens modulares) **(T11 proposta)** | `NOT_IMPLEMENTED` | rig-template + peças → skins/variantes | OpenBone (skins), Spine-format como **intercâmbio**, Godot | mesma animação em ≥2 variantes sem quebra; draw order | alta |

### 1.3 3D

| Capacidade | Estado | Entradas → saídas | Candidatos | QA | Prioridade |
|---|---|---|---|---|---|
| `model3d.generate` (image/text→3D) | `NOT_IMPLEMENTED` (passo contratual `generate-3d` **existe** e está bloqueado) | imagem/vistas → mesh + materiais | `microsoft/TRELLIS.2` (MIT), `TencentARC/Pixal3D` (MIT + NOTICE), `pwilkin/trellis.cpp` (MIT, Vulkan), `raven38/pixal3d.cpp`, `visualbruno/ComfyUI-Trellis2`, Colab A100 (medido por terceiro) | watertight ou relatório de reparo, contagem de triângulos, presença de UV/material | **alta** (gargalo) |
| `model3d.model` (modelagem) | `NOT_IMPLEMENTED` (manual) | brief → mesh | Blender (GPL-3.0, manual), Krita (2D) | topologia declarada | média |
| `model3d.retopologize` | `NOT_IMPLEMENTED` | high-poly → low-poly | `Mstafa-awad/LODTailor` (**GPL-3.0**), Blender (manual), `elalish/manifold` (Apache-2.0) | triângulos alvo, sem non-manifold | alta |
| `model3d.uv` | `NOT_IMPLEMENTED` | mesh → UV sem sobreposição | Blender, `JeffreyXiang/CuMesh`+`FlexGEMM` (MIT, substitui `nvdiffrast` **não comercial**) | seam/overlap medidos | alta |
| `model3d.texture` / `material.pbr` | `NOT_IMPLEMENTED` | mesh+referência → texturas PBR | `Mstafa-awad/UltraTex` (**GPL-3.0**), ComfyUI + nós de textura | resolução/espaço declarados, mapas presentes | alta |
| `model3d.bake` | `NOT_IMPLEMENTED` | high→low → normal/AO/curvature | `LODTailor-Bake-Forger` (**GPL-3.0**), Blender | resolução, espaço, sem bleeding | média |
| `model3d.optimize` / `lod` | `NOT_IMPLEMENTED` | mesh → LODs/decimação | LODTailor, Blender, trellis.cpp (decimate CUDA/ROCm-HIP/Vulkan) | contagem por LOD | média |
| `model3d.export` | `PARTIAL` (formatos aceitos pelo renderer: blend/glb/gltf/fbx/obj/stl) | mesh → arquivo de engine + manifesto | Blender, Godot (destino) | escala/eixos/unidades | alta |
| `env.reconstruct` / `splat.ingest` | `NOT_IMPLEMENTED` | imagens → ambiente/`.spz` | candidatos hospedados e pagos (todos observados) | bounds, contagem de splats, "não é malha nem colisão" | baixa (§2.2 fronteiras) |

### 1.4 Personagens

| Capacidade | Estado | Entradas → saídas | Candidatos | QA | Prioridade |
|---|---|---|---|---|---|
| `character.humanoid` (pipeline completo) | `PARTIAL` — **contrato existe** (`workflow-contracts.cjs`, 5 estágios), só o último tem adapter | brief → vistas → 3D → rig → animação → spritesheet | TRELLIS.2/Pixal3D + auto-rig + Blender | gates por estágio (todos `reviewRequired: true`) | **núcleo** |
| `character.creature` / `animal` | `NOT_IMPLEMENTED` (taxonomia de código só `character`/`item`) | idem, sem bípede padrão | auto-rig genérico, manual | rig sem osso órfão; retarget declarado | média |
| `character.hair` / `hair-cards` | `NOT_IMPLEMENTED` | mesh → cabelo/hair cards | HairDeck (ver [`CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md`](CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md) §4) | cards sem gap, ordem de draw | média |
| `character.clothing` / `accessory` / `armor` | `NOT_IMPLEMENTED` | peça → attachment/skin | OpenBone (skins 2D), Blender (3D), modular por slot | encaixe sem interseção; escala | alta (modularidade) |
| `character.modularity` / `variants` | `NOT_IMPLEMENTED` (spec tem **slot registry** proposto, §5) | rig-base + peças → variantes | slot registry (spec), OpenBone, Godot | variante não duplica pipeline | alta |

### 1.5 Rigging e movimento

| Capacidade | Estado | Entradas → saídas | Candidatos | QA | Prioridade |
|---|---|---|---|---|---|
| `rig3d.auto` | `NOT_IMPLEMENTED` (passo `auto-rig` existe e está bloqueado) | mesh → armature+pesos | `actionforge.app` (hospedado, licença **não verificada**), Blender (Auto-Rig/manual), Mixamo (termos próprios) | relatório do que foi automático vs. revisão | alta |
| `rig3d.manual` | `NOT_IMPLEMENTED` (manual externo) | mesh → rig | Blender | pesos/limites declarados | média |
| `motion.retarget` | `NOT_IMPLEMENTED` | clips → rig-alvo | Motion2MixamoRig (ver §6 do audit 3D), Blender | sem foot sliding, proporções | alta |
| `motion.generate` (texto/poses→movimento) | `NOT_IMPLEMENTED` | texto/keyframes → rotações | **`localai-org/motion-bricks.cpp`** (Apache-2.0, CPU+Vulkan, GGUF 0,73 GB G1 F32 com SHA-256), `nv-tlabs/kimodo` (Apache-2.0; **SMPL-X só pesquisa**), `localai-org/kimodo.cpp` (Apache-2.0, Vulkan/CPU <2 GB) | licença por esqueleto (SOMA/G1 vs SMPL-X); retarget obrigatório; sem GLB/FBX no kimodo.cpp | média-alta |
| `motion.from-video` | `NOT_IMPLEMENTED` | vídeo → motion | candidatos de captura (audit §6) | confiança declarada; vídeo **não** substitui rig | baixa |
| `motion.cycles` / `expressions` | `PARTIAL` (ações nomeadas no renderer: idle/walk/run resolvidas por token, ambiguidade rejeitada) | rig → ciclos/expressões | Blender actions, OpenBone | resolução de ação **já testada** (4/4 unittest T10) | núcleo |
| `motion.edit` | `NOT_IMPLEMENTED` | clips → clips editados | Blender, agente sobre formato editável | keys limpos, timing | alta (ponto fraco relatado no vídeo T11) |

### 1.6 Renderização e exportação

| Capacidade | Estado | Entradas → saídas | Candidatos | QA | Prioridade |
|---|---|---|---|---|---|
| `render3d.frame` | `IMPLEMENTED` (EEVEE Next com fallback EEVEE, câmera ortográfica + area light) | cena → frames | Blender | frame count real, alpha | núcleo |
| `render3d.to2d` | `IMPLEMENTED` (código) / `BLOCKED` (execução) | modelo+ações → atlas | **renderer interno** | 384×144 / 8×3 / 24 frames / 48×48 preservados | núcleo |
| `render.turntable` | `PARTIAL` (`--turntable-frames`, padrão 8, no script) | modelo → turntable | renderer interno | ângulos equidistantes | média |
| `render.atlas` / `pack` | `IMPLEMENTED` (`pack_atlas`) | frames → atlas + manifesto | renderer interno | grade × dimensões conferem | núcleo |
| `export.sequence` | `NOT_IMPLEMENTED` | frames → sequência numerada | Blender, ffmpeg (GPL) | nomenclatura/FPS | média |
| `export.engine` | `PARTIAL` (task JSON v2 + manifesto) | artefatos → pacote de engine | Godot (MIT, destino), Unity/Unreal | manifesto de importação | alta |

**Regra transversal:** capacidades 1.1–1.6 que hoje não têm adapter **não** podem aparecer como disponíveis na UI nem em plano executável — o runner já garante isso por `blockedReason` (fail-closed).

---

## 2. Toolchain externa consolidada

### 2.1 Ferramentas de produção (16 campos exigidos)

Legenda de papel: **executor** (adapter), **editor manual** (abre e registra), **destino** (consome), **referência** (formato/método), **candidato** (a avaliar).

| Ferramenta / projeto oficial | Capacidades | Manutenção | Licença código | Licença editor/runtime | Licença modelos/pesos | Restrições dos resultados | Hardware | Backends | Formatos E/S | CLI/API/SDK/MCP | Engines | Custo | Evidência de execução | Limitações | Papel recomendado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Blender** (blender.org) | modelagem, rig, animação, render, import/export, scripting | ativo | **GPL-3.0** | grátis | n/a | outputs do usuário; **redistribuir Blender exige GPL** | CPU/GPU; EEVEE leve | local (processo) | `.blend/.glb/.gltf/.fbx/.obj/.stl` → PNG+JSON | **CLI `--background --python`** (usada) | todas | grátis | **código integrado** (`blender-adapter.cjs`); execução real **BLOCKED** no ambiente do agente; harness T10 pronto | sem Blender instalado aqui; aparência depende de inspeção no alvo | **executor** principal de `render3d.*` |
| **ComfyUI** (`comfyanonymous/ComfyUI`) | difusão (imagem), nós customizados, fila | ativo (★146.363; `main` 2026-11-11) | **GPL-3.0** | grátis | **por checkpoint** (decisão do usuário) | weights e nós de terceiros têm termos próprios | 4 GB VRAM + 8 GB RAM declarados; AMD/Windows via ROCm 10.0 (RDNA4); `HSA_OVERRIDE_GFX_VERSION` documentado p/ RDNA2/3; `--directml`/`--cpu` **presentes no código**; **RX 580 `unknown`** | local (HTTP loopback) ou remoto com diálogo | prompt+grafo → PNG | **API HTTP** `/prompt`,`/queue`,`/history`,`/view`,`/system_stats`,`/models/*` (usada) | — | grátis | **código integrado**; execução real **BLOCKED** (sem servidor aqui); smoke HTTP simulado | GPL exige revisão antes de qualquer redistribuição/empacotamento; não prova compatibilidade de workflow | **executor** de `image2d.generate-concept` |
| **Krita** (krita.org) | pintura/edição 2D, camadas | ativo | **GPL-3.0** | grátis | n/a | do usuário | leve | local (aplicativo) | PSD/PNG/… | sem CLI de produção usada | — | grátis | **discovery + launch implementados** (`external-tools.cjs`) | integração é "abrir e registrar", não operar | **editor manual** |
| **Godot 4.7** (godotengine.org) | engine 2D/3D, `Skeleton2D`/`Bone2D`, `SkeletonModificationStack2D`, `GPUParticles2D`, `AnimationPlayer`, headless | ativo | **MIT** | MIT | n/a | do usuário | leve | local | `.tscn`, glTF, PNG | CLI headless (a avaliar) | é o destino | grátis | docs oficiais lidas (T11); **nenhuma execução** | não é ferramenta de autoria 2D completa | **destino** + candidato a executor de `ui2d`/`vfx2d`/`rig2d` headless |
| **Spine** (Esoteric Software) | rig/anim 2D esquelético padrão de mercado, skins, meshes | ativo (runtimes push 2026-11-10) | runtime: **Spine Runtimes License** (código disponível) | **editor comercial por usuário nomeado**, ≤2 PCs, **teto de receita <US$500k/12m**; Enterprise anual; **Education sem uso comercial**; Trial só avaliação | n/a | do usuário licenciado | leve | local | `.spine`, JSON | **CLI `UNKNOWN`** (sem diretório de CLI no repo) | runtimes oficiais godot/unity/ue/ts/… | pago (**valores não verificados**) | acordos de licença lidos em fonte primária (T11); **nenhuma execução** | **runtime exige licença de editor por usuário do produto** → custo implícito por usuário | **referência de formato** (não dependência) |
| **DragonBones** | rig 2D esquelético | **dormante** (2026-01) | MIT (runtime JS) | sem editor público | n/a | — | leve | local | formato próprio | sem CLI | — | grátis | metadados lidos | risco de manutenção | **não recomendado** |
| **Rive** (`rive-app/rive-runtime`) | state machines 2D/UI, animação vetorial | ativo | **MIT** (runtime) | editor **comercial/SaaS (não verificado)** | n/a | — | leve | local/hosted | `.riv` | runtime SDK | — | `UNKNOWN` | runtime verificado (T11) | editor pago/fechado | **candidato** para `ui2d.animate` |
| **OpenBone** (`UXCentury/open-bone`) | rig 2D clean-room, skins, linked meshes, trace-mesh, import PSD, **MCP server** | ativo 2026-11-12, **★1** | **MIT** | MIT | n/a | do usuário | leve | local | PSD, formato próprio | **MCP** | export Godot (a confirmar) | grátis | README lido; **sem execução independente** | maturidade ★1 | **candidato MIT** para `rig2d.*` |
| **2DAutoRigger** (`matbn/2DAutoRigger`) | pipeline `ingest→matte→pose→parts ==REFINE GATE==> layers→skeleton→mesh→weights→emit`; exports Godot/Spine/Unity; `provenance.json` | 2026-10-23, **★0** | **SPDX Other** (README alega core Apache-2.0 — **divergência**) | — | sam3 **gated** (Meta SAM); birefnet MIT; lama/rtmpose Apache-2.0; humanparsing MIT | depende do backend escolhido | GPU recomendada | local | imagem → camadas/rig | CLI/script | Godot/Spine/Unity | grátis (local) | README lido; **sem execução** | licença divergente + pesos gated + ★0 | **candidato `BLOCKED_PENDING_LICENSE_REVIEW`** |
| **see-through** (`shitagaki-lab/see-through`) | separação em até 23 camadas com inpaint → PSD | ativo, **★5.642**, SIGGRAPH 2026 | **Apache-2.0** | — | pesos no HF (**licença a confirmar**); treino **bootstrapped de Live2D comerciais** | proveniência do treino exige revisão | GPU recomendada (offload/NF4 possíveis) | local | imagem → PSD camadas | script/CLI | — | grátis | artigo+código lidos; **sem execução** | pesos e proveniência de treino `UNKNOWN` | **candidato** para `image2d.decompose-layers` |
| **spine-animation-ai** (`GenielabsOpenSource`) | skeleton Spine por CV clássica | 2026-08-26, ★673 | **PolyForm Noncommercial 1.0.0** | — | n/a | **não comercial** | leve | local | imagem → rig Spine | script | Spine | grátis mas não comercial | README lido | bloqueia pipeline comercial | **`BLOCKED`** |
| **Aseprite / OpenToonz / Synfig** | pixel art / animação tradicional | ativos | própria (source-available) / `NOASSERTION` / **GPL-3.0** | paga / grátis / grátis | n/a | — | leve | local | PNG/PSD, projetos próprios | sem CLI de produção | — | pago/grátis | mercado | GPL e licença própria exigem cuidado | **editores manuais** opcionais |
| **Live2D Cubism** | 2.5D anime | ativo | SDK proprietário | comercial | n/a | — | leve | local | `.moc3` | SDK | Unity/native | pago (**não verificado**) | **licença não lida** | `UNKNOWN` | **não considerado** |
| **Effigy** (`SifuInTheShell/Effigy`) | referência de arquitetura de execução (processo por passo, GPU lock, orçamento de VRAM com recusa nomeada, volume PBR, `licenses.yaml`, MCP) | ativo | **MIT** | — | por modelo | — | bench AMD gfx1151 4,28 GB pico torch; 5,6 GB RSS Metal res-512 | local | — | MCP | — | grátis | dados lidos em T9 | referência, não dependência | **referência arquitetural** primária |
| **TRELLIS.2 / Pixal3D / trellis.cpp / pixal3d.cpp** | image→3D (malha+textura), decimate CUDA/ROCm-HIP/Vulkan, export GLB com UV | ativos | **MIT** (upstream e ports) | — | pesos: `trellis2-gguf` diz "License: see the source model"; `Aero-Ex/Trellis2-GGUF` **sem model card** | direitos dos pesos **separados** do código | trellis.cpp: cascade 1024 exige 16 GB; **~16,5 GB de pesos**; **gfx803 = 0 referências** | local (Vulkan/CUDA), remoto, Colab | imagem → `.glb` | CLI | — | grátis | leitura de fontes (T9/T10); **sem execução** | hardware do alvo `UNKNOWN` (probe não autorizado) | **candidatos** a `model3d.generate` |
| **kimodo / kimodo.cpp** | motion a partir de texto | ativos | **Apache-2.0** | — | SOMA/G1 = NVIDIA Open Model License (comercial ok); **SMPL-X = só pesquisa, não redistribuível**; kimodo.cpp usa Llama 3 8B (**gated**) | excluir SMPL-X; Llama 3 gated | original ~17 GB VRAM; **`.cpp`: Vulkan ou CPU, <2 GB**, encoder 15,2 GB | local, HF Space, fal | texto → rotações (NPZ/MuJoCo CSV/Isaac/ProtoMotions) | API C | — | grátis | fontes lidas (T9) | `.cpp` **sem export GLB/FBX**, sem SOMA/G1, build Nix+CMake | **candidato** com restrições |
| **MotionBricks** (`NVlabs/motionbricks`) — **novo registro T12** | modelo latente modular que anima personagens e robôs em tempo real; preenche movimento entre 4 poses recentes e até 4 poses-alvo; **Smart Primitives** (vaulting, sitting) compõem sem retreinar; paper SIGGRAPH 2026 (arXiv 2604.24833); modelos pré-treados **SOMA** e **Unitree G1** em ONNX, checkpoints no HF | ★1.005; push 2026-10-26; criado 2026-04-21 | **dual**: código **Apache-2.0** + documentação/skills/assets **CC-BY-4.0** (GitHub reporta `NOASSERTION` pelo cabeçalho dual — **não é "sem licença"**) | runtime Python próprio | **checkpoints no HF: licença a verificar separadamente** | assets/docs exigem atribuição (CC-BY-4.0); pesos com registro próprio | não medido aqui | local (Python) | poses → movimento (ONNX/HF) | runtime Python | — | grátis | **README + LICENSE lidos em fonte primária 2026-11-12**; **sem execução** | anima **SOMA/G1**, não rigs arbitrários → **retarget obrigatório** | **candidato** a `motion.generate` |
| **motion-bricks.cpp** (`localai-org/motion-bricks.cpp`) — **novo registro T12** | port C++23/GGML do MotionBricks para **CPU e Vulkan** com ABI C estável; caminho G1 batch-one completo (GGUF estrito, planejamento de root/duração, predição de pose-token, decodificação VQ, conversão 418/414/413, alinhamento de estilo, **saída de animação esquelética**); paridade CPU/Vulkan em suíte de referência; física MuJoCo opcional via GGML SONIC; playback Kimodo; streaming WebSocket | ★365; push 2026-10-19 | **Apache-2.0** | — | GGUF **0,73 GB G1 F32** + style bundles baixados **com verificação SHA-256** (`scripts/download_gguf_weights.py`); download **por padrão** no preset (desligável com `-DMOTIONBRICKS_DOWNLOAD_MODELS=OFF`) | pesos com registro próprio; download exige consentimento | **CPU ou Vulkan** (mesma API pública); sem número de VRAM declarado no README lido | local | poses/keyframes → animação esquelética | **API C + CMake/ctest**, presets debug/asan-ubsan/sonic-cpu | — | grátis | **README lido em fonte primária 2026-11-12**; **sem execução** | foco **G1**; encoder SMPL humano é passo de integração separado; **baixa pesos no build por padrão** | **candidato** a `motion.generate` em CPU/Vulkan (alvo sem CUDA) |
| **PixelArtistry / actionforge.app / templates RunPod / Colab** | rota image→game-ready demonstrada; auto-rig hospedado; backend remoto com TRELLIS.2+Pixal3D | ativos | variados / **não verificada** (actionforge) | — | por modelo | termos do serviço | A100 medido por terceiro; RunPod: GPU NVIDIA CUDA 12.8, driver 570+, container 30 GB + volume 100 GB | **remoto/hosted** | imagem → `.glb`/texturas | UI/API do serviço | — | pago (**medido por terceiro, não por nós**) | leituras T9; **nenhuma execução nossa** | custo e retenção de dados por conta do usuário | **referência** de backend remoto |
| **GPL nodes (`Mstafa-awad/*`)** | watertight, LOD, bake, textura | ativos | **GPL-3.0** | — | por modelo | **código derivado herda GPL-3.0** | GPU (nós ComfyUI) | local | mesh → mesh/mapas | nós ComfyUI | — | grátis | fontes lidas (T9) | contaminação GPL se linked | **candidato com restrição** |
| **`NVlabs/nvdiffrast` / `MeshInspector/MeshLib`** | rasterização diferencível / operações de malha | ativos | **Nvidia 1-Way Commercial §3.3 (não comercial)** / **não comercial-educacional** | — | — | **bloqueio comercial** | CUDA | local | — | API | — | grátis | licença lida (T9) | **evitáveis**: substituir por `JeffreyXiang/CuMesh`+`FlexGEMM` (MIT) e `elalish/manifold` (Apache-2.0) | **`REJECT` para uso comercial** |
| **lemonade-sdk** | runtime local de inferência | ativo | **Apache-2.0** | — | por modelo | — | AMD/other | local | — | CLI/API | — | grátis | fonte lida (T9) | não testado | **candidato** de runtime local |

### 2.2 Regras de leitura da toolchain

1. **Licença do código ≠ licença do editor ≠ licença dos pesos ≠ direitos dos outputs** — avaliadas sempre em separado (ADR-001 decisão 6).
2. **`NOASSERTION` ≠ sem licença.** Dois casos reais nesta matriz: `NVlabs/motionbricks` (dual Apache-2.0 + CC-BY-4.0) e OpenToonz.
3. **`code-present` ≠ `verified`.** `--directml`/`--cpu` existem no ComfyUI; isso não prova suporte à RX 580.
4. **Estrelagem não é maturidade nem licença.** ★5.642 (see-through) não resolve a licença dos pesos; ★0/★1 (2DAutoRigger/OpenBone) não desqualifica o desenho.
5. **GPL-3.0 em processo separado** (Blender, ComfyUI por HTTP/CLI) não torna a Forge derivada; **redistribuir** a ferramenta, fork ou workflow com nós GPL exige cumprir a GPL.
6. **Nenhum preço numérico foi verificado nesta tarefa.** Custos de Spine, Rive, Live2D, actionforge, APIs e GPU alugada permanecem `UNKNOWN` ou "medido por terceiro".

---

## 3. Matriz de adapters necessários

**Padrão único** (o mesmo para todos), baseado na interface conceitual de [`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md) e no que o runner **já exige** hoje:

| Campo | Obrigatório | Como o código atual já se relaciona |
|---|---|---|
| `id`, `version` | sim | hoje implícito na chave do mapa de adapters (`main.cjs:47`) |
| `capabilities[]` | sim | hoje só via `adapterRole` em `workflow-contracts.cjs` |
| `requirements` (os, gpu.arch, vram, ram, disk, runtime) | sim | **ausente** |
| `configuration` (paths, endpoint, env) | sim | parcial: `COMFYUI_URL`, `findExternalTool` |
| `inputContracts[]` / `outputContracts[]` | sim | **já existe** e é validado (`validateContractList`, `verifyArtifact`) |
| `execution` (kind `process`/`http`, redigido) | sim | **já existe** (`sanitizeExecution`) |
| `progress` (0–100 + mensagem) | sim | **já existe** (`reportProgress`, `LIA_FORGE_PROGRESS`) |
| `cancel` (AbortSignal) | sim | **já existe** (`signal` no adapter) |
| `errors` (código + mensagem redigida) | sim | **já existe** (`WORKFLOW_BLOCKED/CANCELLED/FAILED`) |
| `logs` (redigidos, teto) | sim | **já existe** (`cleanMessage`, 1.200 entradas) |
| `provenance` (fonte, versão, hash, licenças) | sim | **parcial**: hash de artefato existe; licença/versão do provider não |
| `cost` (known/unknown, unit) | sim | **já existe** no gate (`normalizedCost`) |
| `backend` compatível | sim | **ausente** (só local) |
| `health` (`discover()` sem gerar) | sim | **parcial**: `getExternalToolStatus`, `getComfyUiStatus` |
| `evidence` (testes/versões validadas) | sim | **ausente** como dado; existe em documentos |

**Três classes distintas — não misturar:**

| Classe | O que é | Exemplos | Regra |
|---|---|---|---|
| **Adapter de execução** | executa e devolve artefatos validáveis | Blender, ComfyUI, motion-bricks.cpp, see-through, 2DAutoRigger | contrato completo acima; nunca simula output |
| **Ferramenta de edição manual** | a pessoa produz; o Forge registra caminhos reais | Krita, Blender GUI, Aseprite, Godot editor, OpenBone editor | `discover`+`launch`+registro; **sem** `execute` |
| **Serviço remoto** | endpoint de terceiro | ComfyUI remoto, actionforge, RunPod/Colab | autorização explícita de envio, custo `unknown` declarado, `reconcile` obrigatório |

| Adapter | Classe | Capacidades que atende | Candidato de ferramenta | Backend | Estado | Justificativa de existir (ou não) |
|---|---|---|---|---|---|---|
| **Blender Adapter** | execução | `render3d.*`, `render.spritesheet`, `export.*` | Blender | local | `IMPLEMENTED` (código) | já existe — **preservar e migrar para o SDK** |
| **ComfyUI Adapter** | execução/serviço | `image2d.generate-concept` | ComfyUI | local **e** remoto | `IMPLEMENTED` (código) | já existe — separar "local" de "remoto" no manifesto |
| **Sprite Renderer Adapter** | execução | `render3d.to2d`, `render.atlas` | renderer interno | local | `IMPLEMENTED` | já existe; não criar segundo renderer (regra T10/T11) |
| **Atlas/Export Adapter** | execução | `export.engine`, `export.sequence` | interno + Godot headless | local | `PARTIAL` (manifesto/task) | necessário para destinos sem duplicar geração |
| **2D Layer Separation Adapter** | execução | `image2d.decompose-layers` | see-through, image-to-psd | local | `NOT_IMPLEMENTED` | necessário; licenciação de pesos pendente |
| **2D Rigging Adapter** | execução | `rig2d.build` | 2DAutoRigger, OpenBone, Godot | local | `NOT_IMPLEMENTED` | necessário; **um** adapter com 2–3 providers, não um por ferramenta |
| **2D Animation Adapter** | execução | `rig2d.animate`, `rig2d.animate-assisted` | OpenBone MCP, agente sobre formato editável | local/hosted | `NOT_IMPLEMENTED` | necessário; manter fallback manual |
| **Krita Adapter** | **edição manual** | `image2d.illustration`, correção de camadas | Krita | local | `PARTIAL` (discovery+launch) | **não** criar `execute`; só abrir e registrar |
| **Godot Adapter** | destino + execução headless | `export.engine`, `ui2d.animate`, `vfx2d.generate`, validação de rig 2D | Godot | local | `NOT_IMPLEMENTED` | necessário como destino; headless só se medido |
| **Spine Adapter** | **não recomendado** | — | Spine | local | `NOT_IMPLEMENTED` | **não criar**: licença por usuário do produto; usar Spine-format só como intercâmbio se decidido |
| **3D Generation Adapter** | execução | `model3d.generate` | TRELLIS.2, Pixal3D, trellis.cpp | local/remoto/Colab | `NOT_IMPLEMENTED` (passo contratual bloqueado) | necessário; depende de hardware e pesos |
| **Retopology Adapter** | execução | `model3d.retopologize`, `model3d.optimize` | LODTailor (GPL), Blender | local | `NOT_IMPLEMENTED` | avaliar GPL antes; Blender pode cobrir |
| **Texturing Adapter** | execução | `model3d.texture`, `material.pbr`, `model3d.bake` | UltraTex (GPL), nós ComfyUI | local | `NOT_IMPLEMENTED` | necessário para workflow I |
| **Auto-Rigging Adapter (3D)** | execução/serviço | `rig3d.auto` | Blender, actionforge (hospedado) | local/remoto | `NOT_IMPLEMENTED` (passo bloqueado) | necessário; licença do hospedado `UNKNOWN` |
| **Motion/Retargeting Adapter** | execução | `motion.generate`, `motion.retarget` | motion-bricks.cpp, kimodo.cpp, Motion2MixamoRig | local (CPU/Vulkan) | `NOT_IMPLEMENTED` | necessário; **candidato CPU/Vulkan é o único viável no alvo sem CUDA** |
| **Hair Adapter** | execução | `character.hair` | HairDeck (audit 3D §4) | local | `NOT_IMPLEMENTED` | só após decisão de escopo |

**Regra anti-proliferação:** não criar adapter por nome de ferramenta. Um adapter por **responsabilidade**, com providers substituíveis atrás dele — exatamente como o runner já trata `adapter` + `provider`.

---

## 4. Execution Backend e compatibilidade de hardware

### 4.1 Backends

| Backend | Estado no código | Quando usar | O que exige | Risco principal |
|---|---|---|---|---|
| **local (processo)** | `IMPLEMENTED` (Blender) | render, 3D leve, ferramentas instaladas | binário detectado | GPU/VRAM do usuário |
| **local (HTTP loopback)** | `IMPLEMENTED` (ComfyUI) | difusão com checkpoint do usuário | servidor rodando | nenhum upload; `isLoopbackEndpoint` já distingue |
| **local (CPU/Vulkan GGML)** | `NOT_IMPLEMENTED` | motion/image→3D em máquina sem CUDA | binários Vulkan + pesos GGUF | compatibilidade gfx803 `UNKNOWN` |
| **Colab** | `NOT_IMPLEMENTED` | experimento pontual de GPU | notebook, conta, sessão interativa | custo medido por terceiro; retenção; não reproduzível |
| **GPU alugada (RunPod etc.)** | `NOT_IMPLEMENTED` | produção remota repetível | template/container, volume, rede | custo por hora, transferência de artefatos |
| **worker remoto próprio** | `NOT_IMPLEMENTED` | equipe com máquina forte | worker + fila + auth | credenciais (hoje inexistentes no produto) |
| **hosted API/service** | `NOT_IMPLEMENTED` | quando não há alternativa local | termos, custo, região | envio de dados e direitos dos outputs |

**Uma etapa pode usar backend diferente de outra** e **um provider pode suportar vários backends** — por isso backend é dimensão, não módulo (T9 §1).

### 4.2 APIs de aceleração — não presumir suporte por família

| API | Presença real observada | Regra |
|---|---|---|
| **CPU** | `IMPLEMENTED` indireto (todo processo roda em CPU); `trellis.cpp` tem CPU `BLOCKED_BY_MEMORY` no alvo | sempre disponível como fallback, com limite declarado |
| **Vulkan** | binários `trellis-vulkan-{linux,windows}-x64` publicados; **motion-bricks.cpp e kimodo.cpp suportam Vulkan**; na máquina-alvo **nada medido** | loader/ICD/dispositivo/contexto/kernels são **5 estágios que não se implicam** (T11 §1) |
| **CUDA** | requisitos de templates RunPod/Colab (CUDA 12.8) | só onde declarado; nunca inferir de "suporta NVIDIA" |
| **ROCm** | ComfyUI AMD/Windows via ROCm 10.0 com extras RDNA4; `HSA_OVERRIDE_GFX_VERSION` documentado p/ RDNA2/3 | **RX 580 (Polaris/GCN4) não declarada** → `unknown` |
| **Metal** | bench Effigy em Metal (5,6 GB RSS res-512) | macOS apenas; evidência de terceiro |
| **DirectML** | flag `--directml` **presente no código** do ComfyUI | `code-present` ≠ `verified`; exigir medição |

### 4.3 RX 580 / gfx803 como caso de teste (não requisito universal)

| Fato | Estado | Fonte |
|---|---|---|
| Binário Vulkan do trellis.cpp publicado | ✔ verificado | T10 E1 §2 |
| Vulkan funcional comprovado apenas em gfx1151 (bench de terceiro) | ✔ | T9/T10 |
| AMD suportado oficialmente só RDNA3+ | ✔ | T10 E1 |
| **RX 580/gfx803 comprovada** | ✘ **0 referências** a gfx803/Polaris | T10 E1 §2 |
| cascade 1024 no alvo | `NOT_FEASIBLE_ON_TARGET` (16 GB exigidos; ~18 GB sem FA; 8 GB de VRAM) | T10 E1 §3 |
| CPU como rota | `BLOCKED_BY_MEMORY` (3.939 MB RAM no ambiente do agente; 16 GB no alvo declarado) | T10 E1 |
| res-512 Vulkan no alvo | **`UNKNOWN`** até probe autorizado | T10/T11 |
| Veredito | **`GO_WITH_CONSTRAINTS`** — probe só após checklist local e proveniência GGUF | T10 E1 §7 |

### 4.4 RAM × VRAM × armazenamento (separar sempre)

| Recurso | Como medir | Onde já existe | Regra de bloqueio |
|---|---|---|---|
| **RAM** | sistema (ainda **não** coletado no produto) | Effigy declara 5,6 GB RSS em Metal | bloquear antes de iniciar se requisito > disponível; nomear o limite |
| **VRAM** | `/system_stats` do ComfyUI (`vram_total`, `vram_free`) — **só com servidor ativo** | `comfyui-client.mjs:90-98`, UI `formatVram` | recusa nomeada (padrão Effigy), nunca "falhou" genérico |
| **Armazenamento** | espaço livre do volume de saída + tamanho de pesos | pesos trellis ~16,5 GB; GGUF motion-bricks 0,73 GB; RunPod volume 100 GB | bloquear download sem espaço e sem consentimento |

### 4.5 Regras propostas (para decisão humana)

1. **Estimativa por passo:** cada passo declara `os`, `gpu.arch`, `vram`, `ram`, `disk`, `network`, `time`, `cost`, `rights`, `consent`, `fallback` (T9 §2). Sem declaração → `unknown`, e `unknown` **não** é `supported`.
2. **Preflight antes de executar:** `evaluate(requirements, probe)` → `supported \| unsupported \| unknown`; `unknown` exige consentimento explícito de "tentar mesmo assim".
3. **Bloqueio por memória:** recusa **nomeada** (qual recurso, qual limite, qual valor medido) antes de alocar; nunca depois de estourar.
4. **Seleção de backend:** local primeiro; remoto só com autorização de envio + custo declarado ou `unknown` consciente; hosted só com termos revisados.
5. **Custo máximo:** teto por execução definido pelo usuário; ultrapassar → parar e perguntar.
6. **Consentimento:** por ação (enviar, pagar, instalar, baixar, sobrescrever), com fingerprint — **já implementado** no runner e deve ser preservado como padrão.
7. **Checkpoint:** persistir estado a cada evento (**já implementado**); retomada só com fingerprint + SHA-256 conferindo (**já implementado**).
8. **Transferência de artefatos:** hash antes de enviar e depois de receber; revalidar contrato no destino; nunca enviar referência local sem declarar (hoje o ComfyUI remoto envia só prompt+grafo, e isso está dito no diálogo).
9. **Limpeza de temporários:** só arquivos criados pela Forge, dentro do workspace, com registro — como já fazem `workflow-run-store` e o harness (`local-renderer-test/output/` é efêmero).

**Nenhum experimento de geração foi executado nesta tarefa.**

---

## 5. Licenças e custos consolidados

| Categoria | Regra aplicada | Exemplos verificados |
|---|---|---|
| **Código** | SPDX lido no repositório, não inferido | MIT (Godot, OpenBone, Effigy, trellis.cpp, TRELLIS.2, Pixal3D, kimodo.cpp, motion-bricks.cpp, rive-runtime, DragonBonesJS); Apache-2.0 (see-through, lemonade, kimodo, MotionBricks); GPL-3.0 (Blender, ComfyUI, Krita, Synfig, nós `Mstafa-awad`); **Other/divergente** (2DAutoRigger, spine-runtimes); **PolyForm Noncommercial** (spine-animation-ai) |
| **Editor/runtime** | separado do código | Spine: **licença de editor por usuário do produto**; Aseprite paga; Live2D comercial; Rive editor não verificado |
| **Pesos/modelos** | registro próprio, nunca herda do wrapper | SOMA/G1 = NVIDIA Open Model License (comercial ok); **SMPL-X = só pesquisa**; Llama 3 = gated; GGUF trellis2 = "see the source model"; checkpoints MotionBricks no HF = **a verificar**; pesos see-through = **a confirmar** |
| **Não comercial confirmado** | bloqueio de uso comercial | `nvdiffrast` §3.3; `MeshLib`; `spine-animation-ai` |
| **Derivação** | código derivado de restrito **herda** restrição | Hunyuan → TripoSG/HoloPart (T9) |
| **Outputs** | direitos do usuário **quando** entradas e ferramentas estão limpas | manifestos `local-renderer-test/` exigem revisão de termos por sujeito |
| **Custos numéricos** | **nenhum inventado** | Spine/Rive/Live2D/actionforge/APIs = `UNKNOWN`; Colab A100 e RunPod = **medido por terceiro**, datado |

---

## 6. Evidências desta matriz

| Tipo | O que foi feito |
|---|---|
| **Código lido** | ~11.400 linhas do worktree (16 módulos Electron, 4 em `src/`, 1 em `shared/`, 8 scripts, 19 testes, harness E3) |
| **Executado** | 13 smokes Node + 30 testes Python (29 ok) + `node --check` (40) + `py_compile` + parse JSON (7) + `doctor --json` (exit 0) |
| **Fonte primária nova (2026-11-12)** | `NVlabs/motionbricks` (README + LICENSE dual) e `localai-org/motion-bricks.cpp` (README) via API GitHub |
| **Consolidado de T9/T10/T11** | 40+ ferramentas/provedores com licenças, hardware e custos já verificados naquelas tarefas |
| **Não executado** | nenhuma geração 2D/3D, nenhum Blender/ComfyUI real, nenhum probe Vulkan, nenhum download de peso, nenhuma API paga, nenhum Colab/GPU alugada, nenhuma instalação |
| **Não decidido** | adoção de qualquer ferramenta, licença, provider, backend ou custo |
