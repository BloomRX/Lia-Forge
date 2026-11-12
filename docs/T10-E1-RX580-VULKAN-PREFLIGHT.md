# T10 · E1 — Pré-voo técnico de `pixal3d.cpp` / `trellis.cpp` na RX 580 (gfx803)

> **Estado:** pré-voo **exclusivamente de diagnóstico**. **Nenhum peso foi baixado (~16,5 GB), nenhuma dependência instalada, nenhum binário compilado, nenhuma geração iniciada, nenhuma licença aceita, nenhum download gated acessado.** O probe completo **não foi iniciado** e não deve sê-lo sem autorização separada (§11).
> **Data:** 2026-11-12 UTC. **Fontes primárias:** GitHub API (metadados, releases, `README`, `LICENSE`) e Hugging Face (fichas de modelo). Stars e downloads **não** são evidência de compatibilidade.
> **Aviso estrutural:** o ambiente do agente **não é a máquina-alvo** (ver §1). As seções de hardware e Vulkan do alvo ficam `UNKNOWN` por impossibilidade de medição, e vêm acompanhadas do **checklist exato** para medi-las na máquina real.

## 1. Hardware real — o que foi medido e o que não pôde ser medido

### 1.1 Ambiente do agente (medido nesta tarefa)
Linux Debian 12 (bookworm), kernel 6.1.158+ x86_64 · CPU Intel Xeon 2,60 GHz (2 CPUs) · **RAM 3.939 MB totais / 3.707 MB disponíveis / swap 0** · disco 21 GB (20 livres) · **nenhum dispositivo de vídeo** (`lspci` indisponível, `/dev/dri` ausente) · **sem Vulkan** (`vulkaninfo`/`glslc`/`libvulkan`/`icd.d` ausentes) · sem Blender · sem PowerShell.

### 1.2 Máquina-alvo (ADR-001, Decisão 5) — **não acessível ao agente**
Historicamente: Windows + **AMD Radeon RX 580 8 GB (Polaris, `gfx803`)** + Ryzen 5 5500 + **16 GB RAM**. A tarefa instrui a não presumir que os valores históricos continuam iguais — e eles **não puderam ser re-verificados**, porque o agente não executa na máquina-alvo. **Todos os itens abaixo ficam `UNKNOWN` até medição local:** modelo exato/VRAM disponível/ID PCI/`gfx803` confirmado/versão de driver/versão do Windows/CPU/RAM livre/pagefile/espaço em disco/processos concorrentes.

**Checklist de medição (executar na máquina-alvo, PowerShell, sem instalar nada):**
```powershell
# GPU e driver
Get-CimInstance Win32_VideoController | Select Name, AdapterRAM, DriverVersion, Status
# (AdapterRAM vem em bytes e é limitado a 4 GB em alguns drivers; confirme os 8 GB na UI da AMD)
wmic path win32_videocontroller get PNPDeviceID          # ID PCI (VEN_1002&DEV_67DF = Polaris/RX 580)
# CPU, RAM, pagefile, disco
Get-CimInstance Win32_Processor | Select Name, NumberOfCores, NumberOfLogicalProcessors
Get-CimInstance Win32_OperatingSystem | Select TotalVisibleMemorySize, FreePhysicalMemory
Get-CimInstance Win32_PageFileUsage | Select Name, AllocatedBaseSize, CurrentUsage
Get-PSDrive -PSProvider FileSystem | Select Name, @{n='LivresGB';e={[math]::Round($_.Free/1GB,1)}}
# Vulkan: SOMENTE se já instalado (não instalar)
if (Get-Command vulkaninfo -EA SilentlyContinue) { vulkaninfo --summary } else { 'vulkaninfo AUSENTE -> UNKNOWN' }
```
**Interpretação esperada:** se `vulkaninfo` existir, procure a RX 580 listada como dispositivo físico e o `apiVersion`/`driverVersion`; a ausência do utilitário **não é falha da GPU**, é `UNKNOWN` de medição. O driver AMD para Windows **inclui** um ICD Vulkan mesmo sem o SDK — portanto a pergunta certa não é "o SDK está instalado?" e sim "o driver expõe um dispositivo Vulkan?", respondível também por um binário que tente criar uma instância (§11).

## 2. Auditoria das implementações (fontes primárias)

| Item | [`pwilkin/trellis.cpp`](https://github.com/pwilkin/trellis.cpp) | [`raven38/pixal3d.cpp`](https://github.com/raven38/pixal3d.cpp) |
|---|---|---|
| É C++/GGML? | **Sim** — "TRELLIS.2 image-to-3D in C++/GGML (CUDA + Vulkan), with a resident HTTP server"; GGML **vendorizado** em `thirdparty/ggml` | **Sim** — fork do trellis.cpp |
| Licença do código | **MIT** (© 2026 Piotr Wilkin) | **MIT** (© 2026 Piotr Wilkin, base do fork) |
| Maturidade/atividade | ★396, push 2026-11-01, releases v0.8.0 (2026-09-24) e v0.8.1 (2026-09-25) | ★23, push 2026-09-24, releases v0.10.0/v0.10.1-desktop-alpha (2026-09-19/20) |
| Backends | CUDA, **Vulkan**, ROCm/HIP, Metal (auto), CPU (fallback), Qualcomm HTP, **WebGPU/WASM só no fork** | idem + **WebGPU/WASM browser target** |
| Binário Windows publicado? | **Sim**: `trellis-cuda-windows-x64.zip`, `trellis-cuda12-windows-x64.zip`, `trellis-rocm-windows-x64.zip`, **`trellis-vulkan-windows-x64.zip`**, `trellis-studio-windows-x64-{portable.zip,setup.exe}` | **Sim**: os mesmos 13 artefatos + `trellis-metal-macos-arm64.tar.gz` |
| Binário **Vulkan** publicado? | **Sim** (`trellis-vulkan-{linux,windows}-x64`) | **Sim** |
| Precisa compilar? | Não para usar os binários. Para compilar no Windows x64: **MSVC developer PowerShell + Ninja + Vulkan SDK** (`-DGGML_VULKAN=ON`, `-DGGML_OPENMP=OFF`) | idem |
| Suporte a GPU AMD antiga? | **Nenhuma declaração.** Busca no código: `gfx803`=0, `Polaris`=0, `RX 580`=0, `GCN`=0, `gfx900`=0; única referência AMD explícita é **`gfx1030` (RDNA1) = 2 ocorrências**; medição publicada em **gfx1151 (Strix Halo, RDNA3.5)** | mesmas 0 ocorrências de gfx803/Polaris |
| Formatos de peso | **GGUF** (pré-construídos em `ilintar/trellis2-gguf`, ou conversão própria safetensors→GGUF via `docs/spec/`+`tools/`) | idem |
| GGUF compatível com Vulkan? | **Hipótese.** GGUF é formato do ggml e o binário Vulkan existe, mas **nenhuma medição publicada combina GGUF + Vulkan em gfx803** | idem |
| Operações que exigem recurso específico | Postprocess (weld→remesh→decimate→unwrap→bake→WebP) roda em GPU (CUDA/ROCm/**Vulkan compute**) com **fallback automático de CPU**; os dois kernels próprios (BiRefNet deformable conv, QEM decimation) caem em **CPU** no Metal; `birefnet` GGUF é **CUDA only**; retopo all-quad opcional usa **TMPDIR em RAM** e baixa LEMON/CGAL/Boost (+GMP/MPFR no Linux) — **omitido nos binários prontos** | idem |
| Validação numérica | **Sim, contra PyTorch**: SS sampler rel 4,3e-3 (voxel exato), DiT 2,8e-3, DINOv3 1,8e-2, sparse conv 1e-3, BiRefNet 4e-4, C2S exato (`trellis-test-*` + `tools/ref_*.py`) | herda do upstream |
| Restrições de licença em binários/pesos/deps | Código MIT limpo. **Pesos:** ver §6 (espelhos ungated = questão jurídica). Deps vendoredizadas = ggml (MIT). Binários de terceiro = mesmos termos do código | idem |

### 2.1 As quatro afirmações que não podem ser confundidas

| Afirmação | Estado | Evidência |
|---|---|---|
| 1. Binário Vulkan **publicado** | **Confirmada** | `trellis-vulkan-windows-x64.zip` nas releases v0.8.0/v0.8.1/v0.10.x |
| 2. Backend Vulkan **funcional** | **Confirmada em GPU específica de terceiro** (não no alvo) | Medição do autor: Strix Halo iGPU via Vulkan end-to-end (6:09 leve / 12:39 pesado); "On Strix Halo, Vulkan is the fastest backend" |
| 3. GPU **AMD compatível** | **Confirmada para RDNA3/RDNA3.5; NÃO para Polaris** | gfx1151 (Vulkan, medido), gfx1102 (ROCm, port ComfyUI), gfx1201 (Effigy); **gfx803 tem 0 referências** em todo o código pesquisado |
| 4. Compatibilidade **comprovada com RX 580** | **Inexistente** | Nenhuma fonte primária lida menciona Polaris/gfx803/RX 580 |

## 3. Orçamento de memória (o ponto crítico para o alvo)

| Grandeza | Valor de fonte primária | Leitura para a RX 580 (8 GB VRAM / 16 GB RAM) |
|---|---|---|
| Pesos em disco | **~16,5 GB** (set completo, `trellis-server`/Trellis Studio) | Cabe em disco, **não em RAM de uma vez sem mmap/offload** |
| VRAM p/ cascade **1024** (padrão) | "The 1024 cascade runs on a **16 GB card** thanks to FlashAttention with padded K/V … the manual softmax needed a single **~18 GB score-matrix alloc**" | **Não cabe em 8 GB** → rota padrão `NOT_FEASIBLE_ON_TARGET` |
| VRAM p/ rota **`--res 512`** | **Nenhum número publicado** | `UNKNOWN`; única referência de memória host: **pico RSS 5,6 GB** no Metal (M5, memória unificada, res-512) |
| RAM de host p/ caminho CPU | "**very slow, RAM-hungry** CPU path" (`--require-gpu` existe justamente para **falhar** em vez de cair nele) | Com 16 GB totais e pesos de 16,5 GB + buffers → **`BLOCKED_BY_MEMORY`** para a cascade; incerto para res-512 |
| Buffers temporários | Retopo opcional: "uses a **RAM-backed temporary directory**"; "Choose a disk-backed location with ample free space for it and `TMPDIR`" | Retopo **não deve ser usado** no alvo (TMPDIR em RAM) |
| Offloading / carga parcial | ggml suporta; flags `--threads`, `--sched on\|off` (multi-backend), `--vulkan-fallback`; **nenhuma declaração de offload camada-a-camada** no README | Não assumir; tratar como `UNKNOWN` |
| Quantização | GGUF Q4_K_M→Q8_0 existe no caminho **ComfyUI** (`Aero-Ex/Trellis2-GGUF`); para trellis.cpp o HF declara "We're not able to determine the quantization variants" | **Hipótese, não evidência**: reduzir o peso armazenado não comprovadamente reduz o pico de atenção/postprocess |
| Memória virtual | não documentada | **Não somar VRAM + RAM** como intercambiáveis; pagefile torna o caminho CPU ainda mais lento |
| Steps | default 12; "`--steps` lower values are useful for **backend bring-up**" | Única alavanca documentada para trazer um backend novo à vida |

**Conclusão de memória:** o limitante declarado pelo próprio autor para a rota padrão é **VRAM de 16 GB**, e o limitante do caminho CPU é **RAM**. Com 8 GB + 16 GB, **a única rota com alguma plausibilidade é `--res 512` via Vulkan**, e ela permanece `UNKNOWN` porque nenhum número de pico foi publicado para essa rota em GPU discreta.

## 4. Compatibilidade e risco por rota

| Rota | Situação | Evidência |
|---|---|---|
| Vulkan com binário publicado | **Confirmada** | releases v0.8.x/v0.10.x |
| Vulkan compilando para **gfx803** | **Hipótese** | ggml Vulkan existe e roda em gfx1151; GCN4 nunca mencionado; ggml não declara suporte a Polaris |
| GGUF com Vulkan | **Hipótese** | formatos e binário existem; nenhuma medição publicada os combina em gfx803 |
| CPU | **Confirmada como existente, inviável no alvo** | autor a descreve como "very slow, RAM-hungry"; 16 GB RAM insuficientes para a cascade |
| ROCm | **Binário oficial existe** (`trellis-rocm-windows-x64.zip`) mas **incompatível com gfx803** | ROCm moderno não lista Polaris; medição do autor em gfx1151 exige `GGML_CUDA_DISABLE_GRAPHS=1` e perde de 10–40% p/ Vulkan |
| CUDA | **Incompatível** | RX 580 não é NVIDIA |
| Outra alternativa | **Lemonade SDK** ([`lemonade-sdk/lemonade`](https://github.com/lemonade-sdk/lemonade), **Apache-2.0**, ★6.192, ativo 2026-11-12) consome **os mesmos GGUF** como backend GGML — rota AMD-adjacente a investigar; e o **WebGPU/WASM** do fork pixal3d.cpp (browser) como rota sem instalação | fichas HF + descrição do fork |

**Riscos específicos de gfx803:** (a) ggml Vulkan pode depender de extensões/subgrupos não presentes em GCN4; (b) BF16 **não existe** em Polaris — o caminho default é f16 com `--f32` disponível, mas FlashAttention com K/V em BF16 precisaria de fallback; (c) 8 GB de VRAM não acomodam nem os pesos bf16 completos nem a matriz de atenção da cascade; (d) driver AMD antigo pode expor `apiVersion` Vulkan baixo.

## 5. Auditoria de GGUF

| Fonte | O que é | Tamanho | Licença declarada | Consumidor |
|---|---|---|---|---|
| [`ilintar/trellis2-gguf`](https://huggingface.co/ilintar/trellis2-gguf) | Set completo p/ **trellis.cpp**: `dinov3`, `ss_flow`/`ss_dec`, `shape_flow_512/1024`/`shape_dec`, `tex_flow_512/1024`/`tex_dec`, `birefnet` (**CUDA only**) | 203.226 downloads/mês; variantes de quantização **não determinadas** pelo HF | **"License: see the source model"** (fonte: `microsoft/TRELLIS-image-large`, MIT) — **conversão de terceiro, sem licença própria declarada** | trellis.cpp · **Lemonade SDK** |
| [`Aero-Ex/Trellis2-GGUF`](https://huggingface.co/Aero-Ex/Trellis2-GGUF) | Quantizações p/ **ComfyUI** (outro consumidor): BF16 2,62 GB; BF16_Q 789 MB / 948 MB / 1,12 GB / 1,43 GB | 66.141 downloads/mês | **Sem model card** → licença **desconhecida** | `Aero-Ex/ComfyUI-Trellis2-GGUF` |

**Não somar os dois conjuntos nem tratá-los como equivalentes:** são conversões diferentes para consumidores diferentes. E **nenhum dos dois reduz comprovadamente o pico de memória da cascade** (§3).

## 6. Licenças e cadeia de dependências (reconfirmadas antes de qualquer probe)

| Componente | Licença | Observação |
|---|---|---|
| `pwilkin/trellis.cpp`, `raven38/pixal3d.cpp` | **MIT** | limpo |
| ggml (vendorizado) | MIT | sem dependência externa |
| Pesos TRELLIS.2 / TRELLIS-image-large | **MIT** | origem rastreável |
| Conversão `ilintar/trellis2-gguf` | "see the source model" | **proveniência de terceiro**: aceitar como equivalente jurídico ao original é decisão humana, não automática |
| `timm/vit_large_patch16_dinov3.lvd1689m` | **espelho ungated** do DINOv3 ViT-L ("same weights"); DINOv3 upstream é **gated** | **questão jurídica em aberto** — o próprio projeto usa o espelho para evitar token; um espelho não é automaticamente equivalente em termos de licença |
| `ZhengPeng7/BiRefNet` | espelho ungated (substituto de RMBG-2.0, que é NC) | idem; e o GGUF de birefnet é **CUDA only** |
| LEMON/CGAL/Boost/GMP/MPFR | várias (CGAL é GPL/dual) | **somente no retopo opcional**, omitido nos binários prontos → não afeta o probe básico |
| Vulkan SDK / Ninja / MSVC | ferramentas de build | só necessárias se compilar; o probe usa binário pronto |

## 7. Classificação do pré-voo

| Escopo | Classificação | Motivo |
|---|---|---|
| Rota padrão (cascade 1024) na RX 580 | **`NOT_FEASIBLE_ON_TARGET`** | Requisito declarado pelo autor: placa de 16 GB; alvo tem 8 GB |
| Caminho CPU na máquina-alvo | **`BLOCKED_BY_MEMORY`** | 16 GB RAM vs pesos 16,5 GB + buffers "RAM-hungry" + TMPDIR em RAM |
| Rota `--res 512` via Vulkan na RX 580 | **`UNKNOWN`** | Binário Vulkan existe; gfx803 nunca testado; nenhum pico de VRAM/RAM publicado para essa rota |
| Licença/proveniência | **não bloqueante, mas condicionante** | código MIT; pesos origem MIT; **espelhos ungated e conversão de terceiro exigem verificação humana** |
| **Veredito global do pré-voo** | **`GO_WITH_CONSTRAINTS`** | Evidências suficientes para **autorizar um teste controlado** *somente* da rota res-512/Vulkan, **condicionado** ao checklist de hardware/Vulkan da §1.2 ser executado primeiro na máquina-alvo e às restrições da §8. **Não é autorização para iniciar agora.** |

## 8. Requisitos para um eventual probe real (autorização separada; **não executar nesta tarefa**)

1. Executar o checklist da §1.2 e registrar: GPU/VRAM/driver/ID PCI, RAM livre com Blender fechado, pagefile, disco livre. **Sem esses números, o probe não começa.**
2. Baixar **apenas** `trellis-vulkan-windows-x64.zip` (não o instalador Trellis Studio, que puxa ~16,5 GB automaticamente), com hash conferido e em pasta fora do Git.
3. Verificar antes a licença/proveniência dos GGUF e dos espelhos ungated (decisão humana).
4. Primeira execução mínima: `trellis-cli.exe --backend Vulkan --res 512 --steps 4 --verbose <imagem-propria.png> out.glb`, **sem** `--require-gpu` (para observar o fallback) e **sem** retopo.
5. Capturar: exit code, stderr completo, tempos por stage, e pico de VRAM/RAM (AMD Software ou `Get-Counter`), antes e durante.
6. Critério de sucesso **duplo e honesto**: produzir um `.glb` estruturalmente válido **ou** falhar com mensagem identificável (ex.: falta de extensão Vulkan, OOM). **Ambos encerram o `UNKNOWN`.**
7. Repetir 2× para comparar hashes/tempos e registrar determinismo.
8. Publicar o resultado como adendo datado a este documento, promovendo (ou não) a rota de `UNKNOWN` para `VERIFIED_ON_TARGET_HARDWARE` / `NOT_FEASIBLE_ON_TARGET`.
