# T14 — Matrizes: Skills, ferramentas, MCPs e compatibilidade de hardware

> **Estado:** `RESEARCH` + `PROPOSED`. Nada foi instalado/executado/integrado. **Data:** 2026-11-14 (UTC).
> Fontes primárias: GitHub API/`gh` (snapshots de 2026-11-14 indicados) e buscas web citadas no catálogo ([`T14-AGENT-SOLUTIONS-CATALOG.md`](T14-AGENT-SOLUTIONS-CATALOG.md)). Itens com cobertura anterior T9–T13 aparecem como referência cruzada ("ver T…"), sem repetição.

## 1. Cobertura dos 15 domínios de produção pedidos × estado da arte aberto

Legenda de "Sinal aberto": ALTO = existem peças abertas utilizáveis (com review); MÉDIO = peças parciais/imaturas; BAIXO = quase nada aberto útil; NENHUM = mercado fechado/SaaS.

| # | Domínio | Sinal aberto | Peças abertas/candidatas (classificação) | Lacuna dominante |
|---|---|---|---|---|
| 1 | Concept art e referências | ALTO | ComfyUI local (existente na Forge) · FLUX.2 klein 4B Apache-2.0 (T9; ~13 GB VRAM — **acima do alvo**) · SD1.5 community (lento no alvo) | Qualidade/VRAM no RX 580; consistência entre vistas (Pixal3D-Turntable MIT, T9) |
| 2 | Modelagem 3D | MÉDIO | TRELLIS.2/Pixal3D (ADAPT candidato, pesos c/ restrições) · Blender manual (GPL-3.0, processo separado) | Topologia "game-ready" confiável fora de serviços; reprojetar malha p/ tri budget |
| 3 | Personagens humanoides | MÉDIO | Contrato humanoide da Forge (existe) · TRELLIS.2 multiview · Mixamo (free, ToS Adobe, retarget) | Vista→modelo com rig utilizável 100% local; pesos gated (DINOv3/SAM3) |
| 4 | Cabelo, roupas, acessórios | BAIXO–MÉDIO | HairDeck Apache-2.0 (T9; SAM3/DINOv3 gated) · slot registry proposto (spec §5) · modularidade 2D OpenBone (MIT, ★1) | Cabelo/roupa 3D com pesos livres; attachment automático só com review |
| 5 | Rigging | BAIXO–MÉDIO | Rigify (Blender, GPL) · Auto-Rig Pro (pago) · UniRig MIT (RESEARCH ONLY, GPU CUDA) · Mixamo (grátis, ToS) | Auto-rig local confiável no alvo hardware — inexistente hoje |
| 6 | Animação | MÉDIO | Kimodo + kimodo.cpp (Apache-2.0; CPU/Vulkan <2 GB; T9) · MotionBricks/motion-bricks.cpp (Apache-2.0; CPU/Vulkan; T12) · clips CC0 (T9) | Retarget p/ rigs arbitrários; export GLB/FBX (kimodo.cpp não exporta) |
| 7 | Cenários e ambientes | MÉDIO | infinigen BSD-3 (RESEARCH ONLY; Blender headless) · Holodeck/ProcTHOR (RESEARCH ONLY) · BlenderGIS (GPL) | Pipeline prompt→cenário com composição/colisão/escala; limpo e local não existe |
| 8 | Texturas e materiais | MÉDIO | ComfyUI + nós (UltraTex/WTiVo — **GPL-3.0**, processo separado) · Materialize (NC — **rejeitar**) · Blender bake | PBR coerente (normal/AO/ORM) sem deriva; licenças de nós GPL |
| 9 | Sprites 2D e 2.5D | MÉDIO–ALTO | `image2d.generate-concept` (existe) · see-through (Apache-2.0, T11; GPU) · PixelLab (SaaS, $5 BR) · Aseprite MCP (ADAPT) · OpenBone (MIT, T11) | Separação de partes + inpaint com QA no alvo; proveniência de pesos |
| 10 | Spritesheets | ALTO | `render.spritesheet` (existe, Blender) · sprite-gen (Apache-2.0, ADAPT utilitários) · Aseprite CLI/MCP | Validação de conteúdo (alpha real, pivô, loop) — lacuna G8 da T12 |
| 11 | VFX | BAIXO | **Nada aberto "text→VFX de jogo"**; Godot `GPUParticles2D` · spritesheets procedurais da Forge (existe!) · Kimodo/MotionBricks (movimento, não VFX) | Definição + geração + QA de VFX — produto a construir |
| 12 | UI e elementos de jogos | MÉDIO | Figma MCP (contexto design→código) · Rive (runtime MIT; editor SaaS) · shadcn (MIT) · Godot/Unity UI | Bridge design system→engine; não é problema de "asset" puro |
| 13 | Otimização de assets | MÉDIO | Blender decimator/LOD (manual) · LODTailor (GPL-3.0) · trellis.cpp decimate (CUDA/ROCm-HIP/Vulkan) · meshopt (MIT; Khronos glTF) | LOD automático + orçamento por destino; scripts próprios factíveis |
| 14 | QA visual e técnico | MÉDIO | Validators internos da Forge (existem) · OpenCLIP (RESEARCH ONLY) · VLMs locais 2B (RESEARCH ONLY) · promptfoo/deepeval (dev) · T11-E3 (proposta) | QA de conteúdo determinístico (pixels/estrutura) > QA por IA; humano indelegável |
| 15 | Correção automática | BAIXO–MÉDIO | Ciclo revisor-com-retry (game-asset-agent, RESEARCH ONLY) · lama inpaint (Apache-2.0, T11) · inpaint ComfyUI · Effigy "repair sem nova geração" (conceito) | Loop de correção com orçamento de tentativas e política de parada — trabalho da Forge |

## 2. Matriz de MCPs relevantes × tipo × licença (verificada 2026-11-14) × classificação

| MCP / servidor | Escopo | Tipo | Licença (verificada) | Risco dominante | Classe T14 |
|---|---|---|---|---|---|
| `ahujasid/mcp-for-blender` ★34.3k | Blender | stdio local | MIT | Python arbitrário in-DCC; RCE local se agente manipulado | **ADAPT candidato** (gates+allowlist) |
| `Comfy-Org/comfy-mcp` ★342 | ComfyUI | stdio local | **Dual AGPL-3.0-or-later / comercial** | Copyleft de rede/embutimento | **BLOCKED** (usar HTTP direto já existente) |
| `artokun/comfyui-mcp` ★924 | ComfyUI | stdio local | MIT | Idem C3; downloads de modelo embutidos — desligar | ADAPT candidato |
| `joenorton/comfyui-mcp-server` ★412 | ComfyUI | stdio local | Apache-2.0 | idem | ADAPT candidato |
| `ATH-MaaS/Pixelle-MCP` ★1.1k | AIGC suite | stdio local | MIT | Empacotamento pesado; modelos externos | REFERENCE |
| `nanayax3/krita-mcp` ★53 | Krita | stdio local | MIT | Maturidade; API Python in-DCC | ADAPT candidato (piloto) |
| `SanSaSane/krita-mcp` ★13 | Krita | stdio local | CC0-1.0 | Maturidade | ADAPT candidato |
| `diivi/aseprite-mcp` ★993 | Aseprite | stdio local | MIT (editor: EULA pago) | Editor pago; scripts in-DCC | ADAPT candidato |
| `willibrandon/pixel-mcp` ★160 | Aseprite | stdio local | MIT | idem | ADAPT candidato |
| `Coding-Solo/godot-mcp` ★6.6k | Godot | stdio local | MIT | Lança editor; baixo risco | ADAPT candidato |
| `tugcantopaloglu/godot-mcp` ★512 | Godot 4.x | stdio local | MIT | 157 tools; superfície maior | ADAPT candidato |
| `IvanMurzak/Godot-MCP` ★341 | Godot (C#) | stdio local | Apache-2.0 | Cloud `ai-game.dev` embutida — **recusar cloud** | ADAPT candidato (local-only) |
| `CoplayDev/unity-mcp` ★15.9k | Unity | stdio local | MIT | Editor Unity pesado; licença Personal | ADAPT candidato (destino Unity) |
| `ChiR24/Unreal_mcp` ★1.0k | Unreal | stdio local | MIT | Editor UE (royalties); não-oficial Epic | ADAPT candidato (destino Unreal) |
| `chongdashu/unreal-mcp` ★2.1k | Unreal | stdio local | **Nenhuma** | Sem licença | **BLOCKED** |
| `flopperam/unreal-engine-mcp` ★1.1k | Unreal | stdio local | **Nenhuma** | Sem licença (projeto "owned by Aura") | **BLOCKED** |
| `GLips/Figma-Context-MCP` ★16.2k | Figma→code | stdio local | MIT | Dados de design saem p/ LLM do operador | ADAPT candidato (UI) |
| Figma MCP oficial | Figma→code | remoto/desktop | Proprietário (Figma) | Conta/seat; dados no Figma/servidor | RESEARCH ONLY |
| `pixellab-code/pixellab-mcp` ★48 | PixelLab | stdio local | **Nenhuma** | Sem licença; destino remoto pago | **BLOCKED** (código) |
| PixelLab MCP oficial (`api.pixellab.ai/mcp`) | PixelLab | **remoto** | SaaS (termos próprios) | Upload de prompt/refs; custo; BR $5 | RESEARCH ONLY → ADAPT remoto pós-decisão |
| `mcp.scenario.com/mcp` | Scenario | **remoto** | SaaS | idem; free=pessoal | RESEARCH ONLY → ADAPT remoto pós-decisão |
| Ludo.ai API/MCP/CLI | Tudo (2D/3D/áudio) | **remoto** | SaaS | retenção 7 dias; custo | RESEARCH ONLY → ADAPT remoto pós-decisão |
| Hyper3D Rodin API/MCP | 3D | **remoto** | SaaS | custo; avatar≠uso geral | RESEARCH ONLY → ADAPT remoto pós-decisão |
| `meshy-dev/meshy-mcp-server` ★93 | Meshy | stdio→**remoto** | MIT (wrapper) | Wrapper não-oficial; destino Meshy | ADAPT candidato (remoto, consentido) |
| `modelcontextprotocol/servers` ★92.0k | Utilitários | stdio local | MIT→Apache-2.0 (transição) | filesystem externo duplica permissões Forge | REFERENCE |

**Regra de admissão MCP na Forge:** 1) licença OSI lida no pin; 2) superfície mínima (allowlist de tools); 3) consentimento por sessão/passo; 4) nenhum token no repositório; 5) rede explícita quando o destino for remoto; 6) log de chamada com hash de input/output; 7) kill-switch e timeout; 8) revisão de telemetria.

## 3. Matriz de Skills × confiança × ação

| Fonte | Conteúdo | Confiança/Trust | Ação recomendada |
|---|---|---|---|
| `gamedev-skills/awesome-gamedev-agent-skills` (Apache-2.0) | 77 skills: manifesto, normalização, atlas, import | `reviewed-external` somente após review caso-a-caso | **Curar subconjunto** (formato+checklists); pin por commit; nunca em massa |
| `arjun988/blender-skills` (MIT) | 94 skills de operação Blender via MCP | Mesma regra + risco RCE DCC | Curar para operações de leitura/inspeção; jamais `execute_python` sem aprovação |
| `sprite-gen` (Apache-2.0) | Skill 2D + CLI (atlas, anim, curation) | Média-alta p/ utilitários locais | Extrair utilitários determinísticos; excluir lanes pagas/remotas |
| `anthropics/skills` (Apache-2.0 por skill) | Formato SKILL.md/marketplace; docs/design | Formato confiável; conteúdo sem relação com assets | REFERENCE de formato; conteúdo NÃO usar |
| `image-to-psd` / `doll-studio` (sem licença clara) | Skill 2D 19 camadas; editor/rig 2.5D | `unreviewed` | **Não copiar**; estudo conceitual apenas (T7/T11) |
| `link-ding`/community scripts ★0–10 | Vários | `unreviewed` | RESEARCH ONLY |
| Skills da Forge (`.agents/…`) | Marca/contribuição | `first-party` | Manter; **criar skills de runtime** é lacuna (L2) |

## 4. Compatibilidade com o hardware-alvo (AMD RX 580 8 GB · Ryzen 5 5500 · 16 GB RAM · Windows)

Base: T9/T10/T11 (gfx803 nunca referenciado em kernels de 3D; RX 580 sem ROCm oficial; Vulkan possível via GGML; CPU sempre funciona). "Medido por terceiros" ≠ medido por nós.

| Solução/capacidade | RX 580 (Vulkan/compute) | CPU (16 GB RAM) | Remoto consentido | Veredito no alvo |
|---|---|---|---|---|
| Agent LLM leve (7B Q4, ex.: Qwen2.5-7B via llama.cpp/Ollama) | Vulkan plausível; `unknown` sem probe | Viável (lento, ~ok p/ planejamento) | Opcional | **Viável para assistência de plano/revisão; nunca para "arte"** |
| VLM QA 2B (Moondream-class) | Vulkan plausível; lento | Viável | — | Experimento opt-in; gate humano indelegável |
| ComfyUI SD1.5/SDXL quantizado | Muito lento (horas de imagens) | Impraticável | Sim | **Não recomendado local; usar checkpoint já instalado + paciência, ou remoto** |
| FLUX.2 klein 4B (~13 GB) | Não cabe (8 GB) | Impraticável | Sim | **Inviável no alvo** |
| TRELLIS.2 / Pixal3D (upstream) | Não (CUDA; gfx803 ausente) | Impraticável | Colab/RunPod | Fora do local; ver T9/T10 |
| trellis.cpp / pixal3d.cpp (Vulkan/CPU) | `unknown` (binário existe; gfx803 nunca testado; cascade 1024 exige 16 GB) | Partes sim (Geração menor 512) | Colab | **Probe local necessário (E1-T11)** |
| kimodo.cpp (motion→NPZ) | **Sim (Vulkan)** | **Sim (<2 GB)** | — | **Melhor candidato local p/ movimento**; sem export GLB/FBX |
| motion-bricks.cpp (G1) | **Sim (Vulkan)** | **Sim** | — | Candidato local p/ robô/G1; retarget p/ humano é lacuna |
| Blender Cycles CPU (spritesheet) | n/a (CPU) | **Viável** (lento; resoluções pequenas OK) | — | **Rota de produção local já existente na Forge** |
| Krita/Aseprite (manual + MCP) | n/a | **Viável** | — | **Rota humana+agente local principal** |
| Godot headless (QA import/UI/VFX) | n/a | **Viável** (MIT, leve) | — | **Candidato a executor de QA headless** |
| infinigen (cenários) | n/a | Viável com qualidade reduzida | — | Recurso para fundos; pesado |
| Meshy/Tripo/Rodin/Scenario/PixelLab/Ludo | — | — | **Necessário** | **Única rota de 3D rápido no alvo** (com consentimento) |
| Spritesheet render Blender EEVEE Next | OpenGL 4.3 ok no RX 580 | Viável | — | Já usado (EEVEE/Cycles via scripts da Forge) |

**Notas Windows:** Adrenalin atualizado; WSL2 opcional mas não necessário para GGML; `stable-diffusion.cpp` tem binários Vulkan Windows; ComfyUI Desktop tem build Windows; **nada disso foi instalado neste sandbox** — tudo permanece `PLANNED`/`unknown` até probe com autorização.

## 5. Matriz de rastreabilidade: pedido da tarefa × entregue

| Pedido (§) | Onde está |
|---|---|
| 1. Ecossistema (concept→QA correção) | Catálogo Partes A–J; cobertura 15 domínios na matriz §1 acima |
| 2. Agentes/frameworks (delegação, subagentes, skills, MCP, planejamento, avaliação, retry, entrega) | Catálogo Parte A (frameworks), Parte B (skills), Parte C (MCP); arquitetura recomendada no doc T14-Arquitetura |
| 3. Avaliar e classificar (licença/atividade/hardware/…; REUSE..NOT RECOMMENDED) | Catálogo inteiro; resumos Parte J; matriz §2 |
| 4. Arquitetura (Forge dona; adapters externos) | `T14-AGENT-ORCHESTRATION-ARCHITECTURE.md` |
| 5. Fluxo completo (10 passos + 2D/3D/personagem/animação/cenário) | Idem, §Workflows W-A..W-E |
| 6. Hardware RX 580/5500/16GB/Windows | Matriz §4; relatório §Hardware |
| 7. Entregáveis (catálogo, matrizes, compatibilidade, arquitetura, workflows, roadmap, lacunas) | Este doc + Arquitetura + Relatório |
| Restrições (não instalar/executar/baixar/integrar; commits e push na branch) | Respeitadas integralmente; ver relatório §Método e §Limitações |
