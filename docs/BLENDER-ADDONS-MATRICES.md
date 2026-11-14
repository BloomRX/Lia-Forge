# LIA FORGE — MATRIZES CONSOLIDADAS: ADD-ONS BLENDER

> **Estado:** `RESEARCH` — matrizes derivadas de [`ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md`](ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md). Nenhum add-on foi executado.
> **Data:** 2026-11-13 UTC | **Branch:** `arena/7c135d59-lia-forge`

---

## 1. Matriz de licenças e riscos

### 1.1 Licença por add-on (verificada por fonte primária)

| # | Add-on | Licença SPDX | Fonte primária lida | Uso comercial | Redistribuição | Modificação | Restrição conhecida |
|---|---|---|---|---|---|---|---|
| 1 | SquishyFX v3.3.0 | `GPL-3.0-or-later` | `blender_manifest.toml` | ✅ | ✅ (compliance: fonte + mesma licença) | ✅ | Copyleft: obra derivada deve ser GPL-3.0+ |
| 2 | JiggleGen v2.0.0 | `GPL-3.0-or-later` | `blender_manifest.toml` | ✅ | ✅ (compliance) | ✅ | Copyleft |
| 3 | JiggleMaker v2.2.2 | `GPL-3.0-or-later` | `bl_info` | ✅ | ✅ (compliance) | ✅ | Copyleft |
| 4 | HairCard Studio v1.1/v1.5 | `GPL-3.0-or-later` | `bl_info` | ✅ | ✅ (compliance) | ✅ | Copyleft |
| 5 | Braids Generator v5.1.1 | `GPL-3.0-or-later` | `bl_info` | ✅ | ✅ (compliance) | ✅ | Copyleft |
| 6 | Genshin Shader v2.2.1 | **Não declarada** | Sem `LICENSE` | ❓ Desconhecido | ❌ Bloqueada | ❓ Desconhecido | Fan-project sobre IP miHoYo/HoYoverse |
| 7 | Bodiez | **Não declarada** | Sem `LICENSE` | ❓ Desconhecido | ❌ Bloqueada | ❓ Desconhecido | Provável marketplace asset |
| 8 | Voxel Heat Diffuse v3.5.3 | `GPL-3.0-or-later` (wrapper); **proprietário** (binários) | `bl_info` + inspeção | ✅ (wrapper) | ⚠️ Parcial (wrapper sim, binários requerem acordo) | ✅ (wrapper) | Binários `vhd.exe`/`vhd` sem fonte |
| 9 | Cloth NeXt v2.4.0 | `GPL-3.0-or-later` | `bl_info` | ✅ | ✅ (compliance) | ✅ | Rejeitado por hardware (NVIDIA) |
| 10 | Dovetail Key v5.0.1 | **Não declarada** | Sem `LICENSE` | ❓ Desconhecido | ❌ Bloqueada | ❓ Desconhecido | — |
| 11 | Projection Modeling v1.1.4 | **Não declarada** | Sem `LICENSE` | ❓ Desconhecido | ❌ Bloqueada | ❓ Desconhecido | — |
| 12 | SpeedSculpt v0.3.8 | `GPL-3.0-or-later` | `bl_info` | ✅ | ✅ (compliance) | ✅ | Copyleft |
| 13 | Goo Physics v1.0.0 | `GPL-3.0-or-later` | `bl_info` | ✅ | ✅ (compliance) | ✅ | Copyleft |
| 14 | Wiggle Bones v1.1.2 | `GPL-3.0-or-later` | `blender_manifest.toml` | ✅ | ✅ (compliance) | ✅ | Copyleft |
| 15 | SUPERTABs v1.3.0 | **Não declarada** | Sem `LICENSE` | ❓ Desconhecido | ❌ Bloqueada | ❓ Desconhecido | Rejeitado por irrelevância |
| 16 | SquishBulge GeoNodes | `GPL-3.0-or-later` (atribuído) | Mesmo autor do HairCard Studio | ✅ | ✅ (compliance) | ✅ | Copyleft |
| 17 | Motion2MixamoRig v0.1.8 | `GPL-3.0-or-later` (wrapper) | `bl_info` | ❌ (pesos SMPL-X não comerciais) | ⚠️ Parcial | ✅ (wrapper) | Pesos não comerciais; AGPL-3.0 (YOLOv8) |
| 18 | SKkeeper v1.8.2 | `GPL-3.0-or-later` | `bl_info` | ✅ | ✅ (compliance) | ✅ | Copyleft |
| 19 | Car_Rig.zip | n/a (`.uasset` Unreal) | Inspeção binária | n/a | n/a | n/a | Rejeitado (não é add-on Blender) |

### 1.2 Licença de add-ons comunitários

| Add-on | Repo | Licença | Uso comercial | Redistribuição |
|---|---|---|---|---|
| RetopoFlow | `CGCookie/retopoflow` | GPL-3.0 | ✅ | ✅ (compliance) |
| TexTools | `SavMartin/TexTools-Blender` | GPL-3.0 | ✅ | ✅ (compliance) |
| Magic-UV | `nutti/Magic-UV` | GPL-3.0 | ✅ | ✅ (compliance) |
| mio3_uv | `mio3io/mio3_uv` | GPL-3.0 | ✅ | ✅ (compliance) |
| UniV | `Oxicid/UniV` | GPL-3.0 | ✅ | ✅ (compliance) |
| xatlas | `mattedicksoncom/blender-xatlas` | **MIT** | ✅ | ✅ (manter aviso) |
| Ucupaint | `ucupumar/ucupaint` | GPL-3.0 | ✅ | ✅ (compliance) |
| Dream Textures | `carson-katri/dream-textures` | GPL-3.0 | ✅ | ✅ (compliance) |
| Principled Baker | `danielenger/Principled-Baker` | GPL-3.0 | ✅ | ✅ (compliance) |
| Malt | `bnpr/Malt` | GPL-3.0 | ✅ | ✅ (compliance) |
| MakeHuman MPFB2 | `makehumancommunity/mpfb2` | **AGPL-3.0** | ✅ | ⚠️ Copyleft forte (obra derivada = abrir código do produto) |
| CharMorph | `Upliner/CharMorph` | **GPL-2.0** | ✅ | ⚠️ GPL-2.0 (não "or-later"; incompatível com GPL-3.0 sem exceção) |
| BlenRig 7 | `jpbouza/BlenRig` | GPL-3.0 | ✅ | ✅ (compliance) |
| Rokoko Studio Live | `Rokoko/rokoko-studio-live-blender` | GPL-3.0 | ✅ | ✅ (compliance) |
| VRM Add-on | `saturday06/VRM-Addon-for-Blender` | **MIT** | ✅ | ✅ (manter aviso) |
| MMD Tools | `MMD-Blender/blender_mmd_tools` | GPL-3.0 | ✅ | ✅ (compliance) |
| Animaide | `aresdevo/animaide` | GPL-3.0 | ✅ | ✅ (compliance) |
| Keemap Retargeting | `nkeeline/Keemap-Blender-Rig-ReTargeting-Addon` | **MIT** | ✅ | ✅ (manter aviso) |
| blender-animation-retargeting | `Mwni/blender-animation-retargeting` | **MIT** | ✅ | ✅ (manter aviso) |
| Wiggle 2 | `shteeve3d/blender-wiggle-2` | GPL-3.0 | ✅ | ✅ (compliance) |
| rigid-body-bones | `Pauan/blender-rigid-body-bones` | **MIT** | ✅ | ✅ (manter aviso) |
| robust-weight-transfer | `sentfromspacevr/robust-weight-transfer` | **MIT** | ✅ | ✅ (manter aviso) |
| FLIP Fluids | `rlguy/Blender-FLIP-Fluids` | GPL-3.0 | ✅ | ✅ (compliance) |
| glTF-Blender-IO | `KhronosGroup/glTF-Blender-IO` | **Apache-2.0** | ✅ | ✅ (manter notice) |

### 1.3 Resumo de riscos

| Risco | Add-ons afetados | Severidade | Mitigação |
|---|---|---|---|
| **Binários proprietários sem fonte** | Voxel Heat Diffuse | 🟡 Média | Sandboxing; invocar via CLI em tempdir |
| **Pesos ML não comerciais** | Motion2MixamoRig (SMPL-X, GVHMR) | 🔴 Alta | Rejeitado |
| **CUDA obrigatório** | Cloth NeXt, Motion2MixamoRig, Dream Textures, HairDeck | 🔴 Alta | Rejeitado para hardware alvo |
| **Licença não declarada** | Genshin Shader, Bodiez, Dovetail Key, Projection Modeling, SUPERTABs | 🟡 Média | Bloqueado para redistribuição; verificar origem |
| **AGPL-3.0 (copyleft forte)** | MakeHuman MPFB2 | 🟡 Média | Uso como processo separado; não como biblioteca |
| **GPL-2.0 (sem "or-later")** | CharMorph | 🟡 Média | Verificar compatibilidade com GPL-3.0 do Blender |
| **IP de terceiro (fan-project)** | Genshin Shader (miHoYo/HoYoverse) | 🟡 Média | Verificar termos de uso do IP |
| **Dependência de serviço externo pago** | Rokoko Studio Live | 🟡 Média | RESEARCH ONLY |

---

## 2. Matriz de compatibilidade Blender

### 2.1 Versão mínima do Blender

| Add-on | Blender mínimo | Blender máximo testado | `blender_manifest.toml` | `bl_info` |
|---|---|---|---|---|
| SquishyFX v3.3.0 | 4.2 | 5.2+ | ✅ (extensão moderna) | — |
| JiggleGen v2.0.0 | 4.2 (declarado como `3.2.0` no manifest, mas presets usam APIs 4.x) | 5.2+ | ✅ | — |
| JiggleMaker v2.2.2 | 4.0 | Não declarado | — | ✅ |
| HairCard Studio v1.1 | 4.2 | Não declarado | — | ✅ |
| HairCard Studio v1.5 | 4.4 | Não declarado | — | ✅ |
| Braids Generator v5.1.1 | 4.2 | Não declarado | — | ✅ |
| Genshin Shader v2.2.1 | 4.3 | 5.x LTS | — | — |
| Voxel Heat Diffuse v3.5.3 | 2.80 | Não declarado | — | ✅ |
| Cloth NeXt v2.4.0 | 5.0 | 5.x | — | ✅ |
| Dovetail Key v5.0.1 | 4.2 | Não declarado | — | ✅ |
| Projection Modeling v1.1.4 | 4.2 | Não declarado | — | ✅ |
| SpeedSculpt v0.3.8 | 2.80 | Não declarado | — | ✅ |
| Goo Physics v1.0.0 | 4.1 | Não declarado | — | ✅ |
| Wiggle Bones v1.1.2 | 4.5 | 5.0+ | ✅ | — |
| SUPERTABs v1.3.0 | 2.80 | Não declarado | — | ✅ |
| SKkeeper v1.8.2 | 4.2 | Não declarado | — | ✅ |
| Motion2MixamoRig v0.1.8 | 4.5 | Não declarado | — | ✅ |

### 2.2 Compatibilidade com Blender headless (`--background`)

| Add-on | Headless confirmado? | Método de operação | Notas |
|---|---|---|---|
| SquishyFX v3.3.0 | **Leitura estática: provável** | `bpy.data` + `scene.frame_set()` + `bpy.ops.mesh.shape_key_*` | Sem viewport/modal; `frame_change_pre` handler |
| JiggleGen v2.0.0 | **Leitura estática: provável** | `bpy.ops.ptcache.bake(bake=True)` + `temp_override` | `temp_override` pode exigir área específica |
| JiggleMaker v2.2.2 | **Desconhecido** | Proxies FBX + operadores | Requer teste |
| HairCard Studio | **Incerto** | Curves → mesh + UV attributes | `NTRealize_And_Rename_UV` pode exigir contexto |
| Braids Generator | **Incerto** | Realize Instances + UV conversion | Mesmo caso HairCard |
| Goo Physics | **Leitura estática: provável** | `frame_change_pre` handler + bake → keyframes | Handlers funcionam em background |
| Wiggle Bones | **Leitura estática: provável** | `frame_change_pre` + `wiggle.bake` | Handlers funcionam em background |
| Voxel Heat Diffuse | **Sim (CLI)** / Não (UI) | CLI `vhd` em subprocess | Operador UI usa modal timer; CLI funciona |
| SKkeeper | **Leitura estática: provável** | `bpy.data` + `bpy.ops.mesh` | Sem viewport/modal |
| TexTools | **Leitura estática: provável** | `bpy.ops.uv.*` | UV ops funcionam em background |
| xatlas | **Leitura estática: provável** | Auto-unwrap via C library | Sem viewport |
| Principled Baker | **Leitura estática: provável** | `bpy.ops.principled_baker.bake()` | Cycles bake em CPU funciona em background |
| BlenRig | **Parcialmente** | Rig ops funcionam; algumas features podem exigir viewport | Requer teste |
| VRM Add-on | **Leitura estática: provável** | Import/export | Sem viewport |

### 2.3 Compatibilidade com AMD RX 580 8 GB (`gfx803`)

| Add-on | GPU necessária? | RX 580 compatível? | Backend | Evidência |
|---|---|---|---|---|
| SquishyFX | Não | ✅ Provável | Geonodes + bpy.data | Sem chamadas CUDA/ROCm no código |
| JiggleGen | Não | ✅ Provável | Physics (CPU) | Sem chamadas CUDA/ROCm |
| JiggleMaker | Não | ✅ Provável | Proxy meshes | Sem chamadas GPU |
| HairCard Studio | Não | ✅ Provável | Geonodes | Sem chamadas CUDA/ROCm |
| Braids Generator | Não | ✅ Provável | Geonodes | Sem chamadas CUDA/ROCm |
| Goo Physics | Não | ✅ Provável | Bone physics (CPU) | Sem chamadas GPU |
| Wiggle Bones | Não | ✅ Provável | Spring bones (CPU) | Sem chamadas GPU |
| Voxel Heat Diffuse | Não | ✅ Provável | CLI (CPU) | Binários x64 CPU |
| SKkeeper | Não | ✅ Provável | Mesh ops (CPU) | Sem chamadas GPU |
| TexTools | Não | ✅ Provável | UV ops (CPU) | Sem chamadas GPU |
| xatlas | Não | ✅ Provável | Auto-unwrap (CPU) | Biblioteca C CPU |
| Principled Baker | Não (com CPU Cycles) | ✅ Com `scene.cycles.device = 'CPU'` | Cycles CPU | HIP/ROCm não suportado em `gfx803` |
| BlenRig | Não | ✅ Provável | Rig ops (CPU) | Sem chamadas GPU |
| VRM Add-on | Não | ✅ Provável | Import/export (CPU) | Sem chamadas GPU |
| MMD Tools | Não | ✅ Provável | Import/export (CPU) | Sem chamadas GPU |
| Cloth NeXt | **Sim (CUDA)** | ❌ Incompatível | NVIDIA only | `telemetry/gpu.py` → `nvidia-smi` |
| Motion2MixamoRig | **Sim (CUDA)** | ❌ Incompatível | GVHMR (CUDA) | README + NOTICE |
| Dream Textures | **Sim (GPU+VRAM)** | ❌ Provável | Stable Diffusion | CUDA/ROCm; RX 580 sem suporte documentado |
| HairDeck | **Sim (CUDA)** | ❌ Incompatível | NVIDIA Ampere+ | Guia Windows: CUDA 12.8 |
| FLIP Fluids | Não | ✅ Provável | Fluid sim (CPU) | Sem chamadas GPU |

**Nota:** "✅ Provável" = inferido de leitura estática (ausência de chamadas CUDA/ROCm). **Nenhum foi testado em RX 580 real.**

---

## 3. Matriz consolidada de candidatos

| # | Add-on | Categoria | Classificação A | Classificação B | Redistribuição | Headless | RX 580 | Prioridade |
|---|---|---|---|---|---|---|---|---|
| 1 | SquishyFX v3.3.0 | Soft Body | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ | 🔴 Alta |
| 2 | SKkeeper v1.8.2 | Modifiers/ShapeKeys | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ | 🔴 Alta |
| 3 | JiggleGen v2.0.0 | Soft Body | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ | 🔴 Alta |
| 4 | Wiggle 2 / Wiggle Bones v1.1.2 | Spring Bones | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ | 🔴 Alta |
| 5 | Goo Physics v1.0.0 | Bone Physics | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ | 🟡 Média |
| 6 | xatlas | UV | `INTEGRAR` | `ADMIT` | `REDISTRIBUTABLE` | Provável | ✅ | 🟡 Média |
| 7 | TexTools | UV | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ | 🟡 Média |
| 8 | Principled Baker | Texturização | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ (CPU) | 🟡 Média |
| 9 | VRM Add-on | Export | `INTEGRAR` | `ADMIT` | `REDISTRIBUTABLE` | Provável | ✅ | 🟡 Média |
| 10 | Magic-UV | UV | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ | 🟢 Baixa |
| 11 | MMD Tools | Import/Export | `INTEGRAR` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ | 🟢 Baixa |
| 12 | HairCard Studio v1.5 | Cabelo | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Incerto | ✅ | 🟡 Média |
| 13 | Braids Generator v5.1.1 | Cabelo | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Incerto | ✅ | 🟡 Média |
| 14 | Voxel Heat Diffuse v3.5.3 | Skinning | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | `LOCAL_ONLY` | CLI sim | ✅ | 🟡 Média |
| 15 | JiggleMaker v2.2.2 | Soft Body | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Desconhecido | ✅ | 🟢 Baixa |
| 16 | SquishBulge GeoNodes | Soft Body | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ | 🟢 Baixa |
| 17 | Genshin Shader v2.2.1 | Shaders | `ADAPTER` | `BLOCKED_PENDING_LICENSE_REVIEW` | `UNKNOWN` | Provável | ✅ | 🟡 Média |
| 18 | BlenRig 7 | Rigging | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Parcial | ✅ | 🟢 Baixa |
| 19 | Keemap Retargeting | Animação | `ADAPTER` | `ADMIT` | `REDISTRIBUTABLE` | Provável | ✅ | 🟢 Baixa |
| 20 | blender-animation-retargeting | Animação | `ADAPTER` | `ADMIT` | `REDISTRIBUTABLE` | Provável | ✅ | 🟢 Baixa |
| 21 | rigid-body-bones | Soft Body | `ADAPTER` | `ADMIT` | `REDISTRIBUTABLE` | Provável | ✅ | 🟢 Baixa |
| 22 | robust-weight-transfer | Skinning | `ADAPTER` | `ADMIT` | `REDISTRIBUTABLE` | Provável | ✅ | 🟢 Baixa |
| 23 | FLIP Fluids | Simulação | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Provável | ✅ | 🟢 Baixa |
| 24 | Ucupaint | Texturização | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | Parcial | ✅ | 🟢 Baixa |
| 25 | MakeHuman MPFB2 | Anatomia | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` (AGPL) | Provável | ✅ | 🟢 Baixa |
| 26 | CharMorph | Anatomia | `ADAPTER` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` (GPL-2.0) | Provável | ✅ | 🟢 Baixa |
| 27 | SpeedSculpt v0.3.8 | Sculpt | `MANUAL` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | n/a (viewport) | ✅ | — |
| 28 | Dovetail Key v5.0.1 | Modelagem | `MANUAL` | `BLOCKED_PENDING_LICENSE_REVIEW` | `UNKNOWN` | n/a | ✅ | — |
| 29 | Projection Modeling v1.1.4 | Modelagem | `MANUAL` | `BLOCKED_PENDING_LICENSE_REVIEW` | `UNKNOWN` | n/a | ✅ | — |
| 30 | RetopoFlow | Retopologia | `MANUAL` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | n/a (viewport) | ✅ | — |
| 31 | Animaide | Animação | `MANUAL` | `ADMIT_WITH_RESTRICTIONS` | `REDISTRIBUTABLE` | n/a (viewport) | ✅ | — |
| 32 | Bodiez | Anatomia | `RESEARCH ONLY` | `BLOCKED_PENDING_LICENSE_REVIEW` | `UNKNOWN` | Provável | ✅ | — |
| 33 | Malt | Shaders | `RESEARCH ONLY` | `MONITOR` | `REDISTRIBUTABLE` | Provável | ✅ | — |
| 34 | Rokoko Studio Live | Mocap | `RESEARCH ONLY` | `MONITOR` | `REDISTRIBUTABLE` | n/a (streaming) | ✅ | — |
| 35 | ppf-contact-solver | Física | `RESEARCH ONLY` | `MONITOR` | `REDISTRIBUTABLE` | Provável | ✅ | — |
| 36 | HairDeck | Cabelo | `RESEARCH ONLY` | `MONITOR` | `REDISTRIBUTABLE` | Parcial | ❌ (CUDA) | — |
| 37 | Cloth NeXt v2.4.0 | Cloth | `REJECT` | `REJECT` | n/a | n/a | ❌ (CUDA) | — |
| 38 | Motion2MixamoRig v0.1.8 | Animação | `REJECT` | `REJECT` | n/a | n/a | ❌ (CUDA) | — |
| 39 | SUPERTABs v1.3.0 | UI | `REJECT` | `REJECT` | n/a | n/a | n/a | — |
| 40 | Car_Rig.zip | Veículos | `REJECT` | `REJECT` | n/a | n/a | n/a | — |
| 41 | Dream Textures | Texturização | `REJECT` | `REJECT` | n/a | n/a | ❌ (GPU) | — |

---

## 4. Matriz de cobertura por categoria

| # | Categoria | INTEGRAR | ADAPTER | MANUAL | RESEARCH | REJECT | Cobertura |
|---|---|---|---|---|---|---|---|
| 1 | Modelagem — Mesh | — | — | Dovetail Key, Projection Modeling | — | — | ⚠️ Apenas manual |
| 2 | Modelagem — Sculpt | — | — | SpeedSculpt | — | — | ⚠️ Apenas manual |
| 3 | Retopologia | — | — | RetopoFlow | — | — | ⚠️ Apenas manual |
| 4 | UV Mapping | TexTools, xatlas, Magic-UV, mio3_uv, UniV | — | — | — | — | ✅ Coberta |
| 5 | Texturização | Principled Baker | Ucupaint | — | — | Dream Textures | ✅ Coberta |
| 6 | Materiais / Shaders | — | Genshin Shader | — | Malt | — | ⚠️ Licença pendente |
| 7 | Anatomia | — | MPFB2, CharMorph | — | Bodiez | — | ⚠️ AGPL/GPL-2.0 |
| 8 | Rigging | — | BlenRig, VRM Add-on, MMD Tools | — | Rokoko | — | ✅ Coberta |
| 9 | Animação | — | Keemap, blender-anim-retarget | Animaide | — | Motion2MixamoRig | ✅ Coberta |
| 10 | Soft Body / Jiggle | SquishyFX, JiggleGen, Goo Physics, Wiggle 2/Wiggle Bones | JiggleMaker, SquishBulge, rigid-body-bones | — | — | Cloth NeXt | ✅ Coberta |
| 11 | Cloth / Tecido | — | FLIP Fluids | — | ppf-contact-solver | Cloth NeXt | ⚠️ FLIP Fluids como alternativa |
| 12 | Cabelo | — | HairCard Studio, Braids Generator | — | HairDeck | — | ⚠️ Headless incerto |
| 13 | Skinning / Pesos | — | Voxel Heat Diffuse, robust-weight-transfer | — | — | — | ✅ Coberta |
| 14 | Veículos | — | — | — | — | Car_Rig | ❌ Sem cobertura |
| 15 | Física / Simulação | SquishyFX, JiggleGen, Goo Physics | — | — | — | — | ✅ Coberta |
| 16 | Export / Interop | glTF-Blender-IO, VRM Add-on, MMD Tools | — | — | — | — | ✅ Coberta |

**Cobertura total:** 10/16 categorias com solução `INTEGRAR` ou `ADAPTER`; 5/16 apenas `MANUAL` ou com limitações; 1/16 sem cobertura (Veículos).

---

## 5. Lista priorizada de integrações futuras

### Prioridade 🔴 Alta — Testar primeiro (maior valor + maior evidência de headless)

| # | Add-on | Justificativa | Próximo passo |
|---|---|---|---|
| 1 | **SquishyFX v3.3.0** | Bake procedural de soft-body → Shape Keys → GLB Morph Targets; pipeline completo fechado | Teste headless: `blender --background --factory-startup --disable-autoexec --python test_squishyfx.py` |
| 2 | **SKkeeper v1.8.2** | Preserva Shape Keys ao aplicar Subdiv; essencial para export de qualidade | Teste headless: aplicar subdiv em mesh com shape keys |
| 3 | **JiggleGen v2.0.0** | Geração de cages + bake de physics; complementar ao SquishyFX | Teste headless: gerar cage + bake ptcache |
| 4 | **Wiggle 2 / Wiggle Bones** | Spring bones → keyframes → skeletal animation GLB | Teste headless: wiggle.bake em rig simples |

### Prioridade 🟡 Média — Testar em seguida

| # | Add-on | Justificativa | Próximo passo |
|---|---|---|---|
| 5 | **Goo Physics v1.0.0** | Bone physics → keyframes | Teste headless |
| 6 | **xatlas** | Auto-unwrap MIT permissivo; UV de qualidade | Teste headless |
| 7 | **HairCard Studio v1.5** | Hair cards procedurais; headless incerto | Teste headless com `temp_override` |
| 8 | **Braids Generator** | Tranças procedurais; complementar a HairCard | Teste headless |
| 9 | **Voxel Heat Diffuse** | Skinning de alta qualidade via CLI | Teste CLI em tempdir |
| 10 | **Genshin Shader** | NPR/toon shading; licença pendente | Verificar licença |

### Prioridade 🟢 Baixa — Testar quando o pipeline principal estiver estável

| # | Add-on | Justificativa | Próximo passo |
|---|---|---|---|
| 11 | TexTools | UV tools complementares | Teste headless |
| 12 | Principled Baker | Bake PBR maps | Teste headless com CPU Cycles |
| 13 | VRM Add-on | Export VRM 0/1.0 | Teste headless |
| 14 | MMD Tools | Import MMD/PMX | Teste headless |
| 15 | BlenRig | Rig completo | Teste headless parcial |
| 16 | Keemap Retargeting | Retargeting | Teste headless |
| 17 | FLIP Fluids | Simulação de fluidos | Teste headless |

---

## 6. Itens que exigem autorização ou testes no Windows

### 6.1 Licenças a verificar (requer ação humana)

| # | Add-on | Ação necessária |
|---|---|---|
| 1 | **Bodiez** | Identificar marketplace de origem e ler termos de licença |
| 2 | **Genshin Shader v2.2.1** | Verificar termos de uso originais; avaliar risco de IP miHoYo/HoYoverse |
| 3 | **Dovetail Key v5.0.1** | Verificar licença (Gumroad, Blender Market, ou outro) |
| 4 | **Projection Modeling v1.1.4** | Verificar licença (mesmo autor do Dovetail Key) |
| 5 | **Voxel Heat Diffuse** | Verificar se redistribuição dos binários `vhd.exe`/`vhd` é permitida |
| 6 | **MakeHuman MPFB2** | Avaliar impacto do AGPL-3.0: uso como processo separado vs biblioteca |
| 7 | **CharMorph** | Verificar compatibilidade GPL-2.0 (sem "or-later") com GPL-3.0 do Blender |

### 6.2 Testes a executar no Windows + RX 580 (requer hardware real)

| # | Teste | Add-on(s) | Critério de sucesso |
|---|---|---|---|
| 1 | Bake headless SquishyFX | SquishyFX | GLB com Morph Targets válido |
| 2 | Bake headless SKkeeper | SKkeeper | Shape Keys preservadas após subdiv |
| 3 | Bake headless JiggleGen | JiggleGen | Cage gerada + ptcache baked |
| 4 | Bake headless Wiggle | Wiggle 2 / Wiggle Bones | Keyframes de spring bones |
| 5 | UV unwrap headless | xatlas, TexTools | UVs válidas em mesh |
| 6 | Hair cards headless | HairCard Studio | Mesh com UVs válidas |
| 7 | Voxel Heat Diffuse CLI | VHD | Skin weights válidos |
| 8 | Principled Baker CPU | Principled Baker | Textures baked em CPU Cycles |
| 9 | VRM export headless | VRM Add-on | Arquivo VRM válido |
| 10 | Pipeline completo | SquishyFX + SKkeeper + glTF | Personagem com morph targets + subdiv |

### 6.3 Testes de segurança (requer sandbox)

| # | Teste | Add-on(s) | Critério |
|---|---|---|---|
| 1 | Verificar auto-execute | Todos os `.blend` | Nenhum script executado automaticamente |
| 2 | Verificar imports de rede | Todos os add-ons Python | Nenhum `import` de pacote remoto |
| 3 | Verificar telemetria | Voxel Heat Diffuse, Cloth NeXt | Nenhum dado enviado a servidor externo |
| 4 | Sandboxing de binários | Voxel Heat Diffuse `vhd.exe` | Execução em tempdir isolado |
