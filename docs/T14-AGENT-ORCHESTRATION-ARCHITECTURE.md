# T14 — Arquitetura recomendada: agentes de produção de assets no Lia Forge

> **Estado:** `PROPOSED` — nada aqui autoriza implementação. **Data:** 2026-11-14 (UTC).
> **Fontes:** catálogo e matrizes T14 desta tarefa; T8–T13 (`T9-EXECUTION-BACKEND-ARCHITECTURE.md`, `T12-ARCHITECTURE-AND-TOOLCHAIN-CONSOLIDATION.md`, `T12-CAPABILITY-AND-TOOLCHAIN-MATRIX.md`, `T12-PRODUCTION-WORKFLOW-MAP.md`, `T12-IMPLEMENTATION-ROADMAP.md`, `WORKFLOW-ENGINE.md`, `INTELLIGENT-ORCHESTRATOR.md`, `TOOL-PROVIDER-HUB.md`, `SKILLS-KNOWLEDGE-ENGINE.md`, `ASSET-MANAGEMENT.md`, `VISUAL-QA-BENCHMARK.md`, `T13-IMPLEMENTATION-EVIDENCE.md`).
> **Princípio inegociável herdado do repositório:** a Forge é dona da orquestração, dos gates e do consentimento; ferramentas externas são **adapters/providers substituíveis**, nunca o produto.

## 1. Arquitetura de camadas recomendada

```text
┌────────────────────────────────────────────────────────────────────┐
│ L0 — Lia Forge (produto; fonte da verdade)                         │
│   Orquestração · Workflow Engine · Capability Contracts · Consents  │
│   Permissões · Histórico/proveniência · QA · Gestão de assets       │
│   Skills & Knowledge Engine (trust manifest) · Asset Registry       │
├────────────────────────────────────────────────────────────────────┤
│ L1 — Papéis lógicos de agente (definidos pela Forge; opcionais)    │
│   Orquestrador determinístico · Concept/2D · 3D/Character ·         │
│   Tech Animator · Environment+Material · UI/VFX · Asset Optimizer   │
│   · QA Reviewer   (ver §3; nenhum é obrigatório; todos gateados)    │
├────────────────────────────────────────────────────────────────────┤
│ L2 — Seleção & planejamento (já parcial: planner.mjs, Hub, registry)│
│   rotas → capabilities → adapters compatíveis → gates → plano       │
├────────────────────────────────────────────────────────────────────┤
│ L3 — Adapters locais (subprocesso/HTTP local; processo separado)    │
│   Blender MCP (stdio, opcional) · ComfyUI HTTP (existe) ·           │
│   Krita MCP (piloto) · Aseprite CLI/MCP · Godot headless (QA/exec)  │
├────────────────────────────────────────────────────────────────────┤
│ L4 — Providers remotos (somente com consentimento por chamada)      │
│   Meshy · Tripo3D · Scenario · PixelLab · Ludo · Hyper3D Rodin      │
│   (custo declarado, dados classificados, artifacts baixados no ato) │
├────────────────────────────────────────────────────────────────────┤
│ Transversais: Ledger de licenças/proveniência por componente        │
│ (modelo Effigy `licenses.yaml`) · Orçamento de tentativas/custo ·   │
│ Checkpoints · Kill-switch · Logs com hash · Telemetria OFF por      │
│ padrão
└────────────────────────────────────────────────────────────────────┘
```

**Regras de ouro:**
1. Agente nunca "decide" sozinho: planeja → mostra → aguarda autorização → executa → reporta.
2. Nenhuma saída de agente é "asset pronto" sem passar por validadores determinísticos + revisão humana.
3. IA preenche incerteza (layout, inpaint, retarget sugerido); **determinismo** valida (índices, checksums, contagens, geometria, alpha, bounding boxes).
4. Toda entrega traz relatório: o que foi usado, licenças, versões, o que foi inferido/reconstruído, o que exige revisão.

## 2. O que "agente" significa aqui (e o que não significa)

- **Não** é um chatbot com persona. É uma **definição declarativa**: `roleId`, objetivo, capabilities permitidas, skills permitidas (por `trust`), backends permitidos, orçamento (tentativas/custo/tempo), gates obrigatórios, contrato de saída e política de escalonamento.
- **Não** substitui o Workflow Engine: o agente é um **executor de passos** cujo comportamento é restringido por contrato; o grafo (dependências, paralelismo, retomada) continua no Engine.
- **Obrigatório:** determinismo onde possível (voxel→tri, atlases, palette scan); LLM só onde interpretação é inevitável (brief → plano → crítica visual).
- **Correção automática** é um loop explícito com parada garantida: falha estrutural determinística → correção local (≤2 tentativas) → re-validação; falha semântica → gate humano imediato. Nunca lupa infinita.

## 3. Roster recomendado: 8 papéis (combina os 12 pedidos)

Os 12 papéis pedidos na tarefa não são todos viáveis como agentes separados hoje. A combinação abaixo preserva cobertura funcional com menos superfícies de risco, e pode ser desdobrada depois sem quebrar contratos (cada papel é só uma `roleId` no registry).

| # | Papel (roleId) | Absorve os pedidos | Escopo de execução real hoje | Gates obrigatórios | Backends candidatos (todos não adotados) |
|---|---|---|---|---|---|
| 1 | **Orquestrador** (`lia.orchestrator`) | Planejamento de tarefas complexas, seleção de skills/tools, orçamento, retomada | **Já existe** (`shared/orchestrator/planner.mjs`, T13) — determinístico; LLM opcional e nunca decisório | Aprovação humana do plano; revalidação no início; gates por passo | Planner interno (manter); Temporal/LangGraph só como estudo |
| 2 | **Concept/2D Artist** (`lia.concept-2d`) | Concept Artist · 2D Artist · (parte de) Spritesheet | Conceito via ComfyUI local (existe); ilustração/pixel via Krita/Aseprite **manual+MCP**; atlas via render interno (existe) | Escolha de checkpoint; revisão visual; alpha/palette/tiling | ComfyUI HTTP (existe); mcp-for-blender/krita-mcp/aseprite-mcp (ADAPT); PixelLab/Scenario (remoto, consentido) |
| 3 | **3D/Character Artist** (`lia.character-3d`) | 3D Artist · Character Artist · Hair Artist · roupas/acessórios | Geração remota (consentido) **ou** modelagem manual Blender; cabelo via HairDeck (pesquisa) ou cards manuais; roupas/acessórios como **peças modulares** em slots, não "agente de roupa" | Vistas→modelo (multiview QA); watertight/retopo; rig review; escala/eixos | TRELLIS.2/Pixal3D (ADAPT, pesos c/ restrição); remoto Meshy/Tripo/Rodin (consentido); Blender (manual); HairDeck (RESEARCH ONLY) |
| 4 | **Technical Animator** (`lia.tech-animator`) | Technical Animator · Rigging · Animação · (Render de) Spritesheet | Auto-rig: **lacuna** (Mixamo manual grátis; UniRig pesquisa); motion: Kimodo local (T9)/MotionBricks; spritesheet: render Blender (existe) | Rig review (ossos, pesos, raiz, eixos); FPS/duração/loop; pivô | Rigify (GPL, Blender); Mixamo (ToS, manual); kimodo.cpp (CPU/Vulkan); motion-bricks.cpp; renderer interno (existe) |
| 5 | **Environment + Material Artist** (`lia.environment`) | Environment Artist · Material Artist · Texturas | Cenários: composição manual em Blender + texturas CC0/compradas/autorizadas; procedural: infinigen (RESEARCH ONLY); PBR: bake interno + nós GPL em processo separado | Escala/bounds; "não é colisão"; draw calls; licenças de texturas | Blender (manual); ComfyUI+nós (GPL, processo separado); infinigen (RESEARCH ONLY); Godot/Unity/Unreal import QA |
| 6 | **UI + VFX Artist** (`lia.ui-vfx`) | UI e elementos de jogos · VFX Artist | UI: tokens/design→código (Figma MCP ou manual); VFX: **procedurais internas** (já existem: `ui-vfx-sheet`) + spritesheets; partículas in-engine (Godot) | Legibilidade HUD; alpha/atlas; state machine reachable; custo de draw | Godot headless (ADAPT); Figma MCP (UI, consentido); atlas procedural (existe); nada aberto p/ VFX text→efeito (lacuna L6) |
| 7 | **Asset Optimizer** (`lia.optimizer`) | Asset Optimizer · Otimização de assets | **Determinístico, sem LLM:** tri budget, LOD, decimação, palette/atlas pack, compressão, mipmap, perfil por destino | Contagem antes/depois; nenhuma perda silenciosa; relatório de diff | Blender headless; meshopt (MIT); trellis.cpp decimate (Vulkan/ROCm/CUDA); scripts internos (existe, expandir) |
| 8 | **QA Reviewer** (`lia.qa-reviewer`) | QA Reviewer · QA visual/técnico · detecção de defeitos | **Estrutural:** validadores internos (existem); **visual assistivo:** VLM local opt-in (RESEARCH ONLY); **final:** humano sempre | Revisão humana indelegável; nenhum "aprovado" só por IA | Validators internos (existe); OpenCLIP/VLM (RESEARCH ONLY); Compare Lab (existe, T13) |

**Papéis explicitamente não criados (com motivo):**
- **Hair Artist** separado: nenhuma ferramenta aberta confiável no alvo; vira *capability* `character.hair` dentro do papel 3.
- **Material Artist** separado: texturas/PBR compartilham 80% do pipeline do ambiente; papel 5 cobre.
- **Concept Artist** e **2D Artist** separados: mesma ferramenta (ComfyUI/Krita), mesmos gates, mesmo atlas de saída — papel 2.
- **Sprite Renderer** separado: é o `render.spritesheet` (capacidade determinística), não um agente criativo — papéis 2/4 o invocam.
- **"General Game Agent"** estilo AutoGPT/CrewAI: rejeitado — sem contratos de asset não há entrega verificável.

## 4. Contrato de execução de passo com correção (o que falta no T13)

Cada passo executado por L1 declara:

```yaml
stepId: character.generate-3d
roleId: lia.character-3d
capability: model3d.generate            # do registry
adapter: trellis2-local | trellis2-remote-meshy | blender-manual   # resolvido pelo Hub
inputs:  { vistas: [...hashes], brief: ... }
budget:  { attempts: 2, costCeilingBRL: 0, timeoutMin: 45 }
policy:  { onStructuralFail: [retry-local, fail-step], onSemanticFail: human-gate }
validators: [glb-inspect, triangle-budget, uv-overlap, watertight]
provenance: { licenses: [...], weightsHash: ..., generatedBy: adapter }
gates:   [reviewRequired, consentRequired]
outputs: { glb: path, report: path, preview: path }
```

Loop de correção permitido (exemplo com 2 tentativas): falha estrutural → retry com seed diferente/parâmetro ajustado → falha de novo → `fail-step` com diagnóstico nomeado (nunca "erro desconhecido"); falha semântica (vista inconsistente) → **para na hora** e pede revisão. Cada tentativa fica no ledger; artefatos intermediários são versionados, nunca sobrescritos.

## 5. Workflows completos (10 etapas, 5 cenários)

O esqueleto comum (idêntico nos 5): `pedido → interpretação normalizada → plano + rotas → seleção de skills/tools autorizadas → execução por passo (L3/L4) → inspeção → detecção de defeitos → correção (§4, se permitido) → validação (G) → entrega (arquivos+preview+relatório)`.

### W-A · 2D — "Sprite de fogo animada em atlas para Godot"
1. **Pedido:** "atlas 256×256, 16 frames, fundo transparente, estilo pixel 32×32, paleta 16 cores".
2. **Interpretação:** `image2d.spritesheet` + perfil destino Godot (atlas JSON); faltou: `reference` → pergunta (ou default estilo livre, marcado `assunção`).
3. **Plano:** rota A (procedural interna, já executável hoje) → fallback rota B (ComfyUI conceito + aseprite-mcp, consent needed) → rota C (PixelLab remoto, custo ~N gerações).
4. **Skills/tools autorizadas:** skill `pixel-32-palette-check` (curada); tools: procedural VFX (existe), aseprite (se instalado e consentido).
5. **Execução:** 16 frames gerados → atlas + `.json` (formato Godot).
6–7. **Inspeção/detecção:** alpha real (não só metadado), paleta ≤16, grade 4×4, frames não vazios, sem vazamento entre células.
8. **Correção:** frame vazio → regen do frame isolado (≤2); paleta violada → quantização determinística; loop não fecha → reordenação por similaridade + gate.
9. **Validação:** `png-content`, `spritesheet-manifest`, `destination-profile(Godot)` (já existem, T13).
10. **Entrega:** `fire_atlas.png` + `fire_atlas.json` + preview GIF + `relatorio.md` (origem, hashes, custo, licenças, o que foi inferido).

### W-B · Personagem 3D humanoide — "Arqueira elfa, vistas → GLB → rig → clips → atlas 8×3"
1. **Pedido:** brief + 3 referências (frente/perfil/costas); destino: spritesheet humanoide do contrato v2.
2. **Interpretação:** taxonomia já existe (`character`); pontos de entrada: Prompt→3D (existe, bloqueado sem provider) ou "modelo existente" (desbloqueado hoje).
3. **Plano:** rota local (TRELLIS.2 multiview — **hardware-condicionada, gfx803 `unknown`**) ou rota remota (Meshy/Tripo image-to-3D, consentida, ~$0,10–0,75) ou rota manual (Blender + referência; sem provider).
4. **Skills/tools:** checklist de "game-ready humanoid" (curada); multiview QA (vistas coerentes: cabeça/ombro/proporção — gate humano); tools: ComfyUI multiview ou provider remoto; Blender para limpeza; Rigify/Mixamo para rig.
5. **Execução:** vistas → mesh → retopo (alvo 8–15k tri, QA) → UV/bake → rig → clips (idle/walk/run/atk) → atlas via renderer interno.
6–7. **Detecção:** watertight ≠ ok-rig; QA mede: non-manifold, tri count, UV overlap, presença de skin weights, root motion, eixo Y-up, escala 1.7 m declarada.
8. **Correção:** non-manifold → `manifold`-class repair (Apache-2.0) ou bloqueio com relatório; pesos ruins → re-skin manual (humano); vista inconsistente → regenerar vista (remoto) com memo.
9. **Validação:** `glb-inspect` + contrato humanoide (5 estágios) + `destination-profile`.
10. **Entrega:** `arqueira.glb` (+`.png` atlas, `manifest.json`), previews (turntable, rig poses, atlas), relatório com licenças de pesos/modelos (ex.: "TRELLIS.2 weights: license X — verified on date").

### W-C · Animação — "Walk cycle 8 frames em 60 FPS para personagem existente"
1. **Pedido:** GLB existente + clip desejado + retarget.
2. **Interpretação:** capability `motion.generate`; se personagem for Mixamo-compatible → retarget direto; senão → IK/keyframe manual (Blender) ou Kimodo→NPZ→retarget (limitação conhecida: sem GLB direto).
3. **Plano:** rota local Kimodo (CPU/Vulkan, pesos SOMA/G1 ou Llama-3-encoder gated — verificar) → motion-bricks (G1) → rota manual.
4–10. Execução: gerar/converter → retarget → bake 60 FPS → validar loop (primeiro==último), duração, keyframes → render preview vídeo/GIF → gate humano ("pé escorregando?") → export + relatório.

### W-D · Cenário — "Fundo de floresta paralaxe 3 camadas para menu 2D"
1. **Pedido:** backdrop + midground + fg, estilo pintura, seamless horizontal.
2. **Plano local:** composição própria (Blender + texturas CC0/autorizadas) → generativa (ComfyUI background + see-through decomposição, pesos gated — gate humano) · rota manual (Krita painting) · rota remota (Scenario/Ludo).
3. **QA específico:** tiling sem costura (teste automático: bordas E↔D, W↔H), bounds, "não é malha/colisão" declarado, camadas nomeadas `bg/mg/fg`, alpha entre camadas opcional.
4. **Correção:** costura detectada → espelho/blend de borda (determinístico) ou reflux inpaint; paralaxe incoerente → ajuste de camadas (humano).
5. **Entrega:** 3 PNGs + manifest (parallax factor) + preview animado + relatório de fontes CC0/licenças.

### W-E · UI/VFX — "Botão e explosão de HUD, 2 estados, para Godot"
1. **Pedido:** botão (normal/hover/pressed) + explosion spritesheet 8×4.
2. **Plano:** UI — tokens do design (Figma MCP consentido, ou brief textual) → peças PNG; VFX — procedural interna (existe) com params; ou spritesheet via Blender (partículas → render).
3. **QA:** 9-slice paths corretos; contraste/legibilidade em 1280×720; atlas sem sangramento; state machine alcançável; draw cost budget.
4. **Correção:** hover ilegível → reforço de cor determinístico; sangramento → padding+extrude; frame faltando → regen do frame.
5. **Entrega:** `hud_button_*.png`, `explosion_atlas.png+json`, cena de demonstração Godot (opcional, headless-tested), relatório.

## 6. Segurança e consentimento (normativo para qualquer piloto)

- **Classificação de dados:** todo input vira `public | internal | private | secret`; providers remotos aceitam no máximo `internal` com consentimento; `secret` nunca sai.
- **Consentimento por passo visível:** o plano lista bytes/hash do que sai, destino, custo e retenção; recusa individual possível sem abortar o plano.
- **MCP:** allowlist de tools por role; stdio em processo com timeout; sem rede salvo allowlist; logs com hash (nunca conteúdo de arquivos privados em log persistente).
- **Injection:** skills/conteúdo externo são dados; nenhuma instrução externa pode ligar rede/apagar gate/baixar modelo; scanner estático antes de exibir.
- **Credenciais:** só via env/ keychain do SO; jamais em `.spriteforge/`, `input/`, logs, exports ou MCP config commitada.
- **Telemetria:** desligada por padrão (regra já confirmada em DECISIONS Q8/14); qualquer binário/SDK externo só após auditoria de telemetria.
- **Licença:** relatório final inclui tabela `componente → licença → verificada-em → uso permitido` (modelo Effigy).

## 7. Roadmap de implementação (por dependência; sem calendário)

| Fase | Entrega | Depende de | Critérios de aceite (exemplos) |
|---|---|---|---|
| **F14.0 — Decisão humana** | Registrar decisões: providers remotos? primeiro MCP local? VLM? orçamento? | Esta pesquisa | ADR/decisão assinada; nenhum default assumido |
| **F14.1 — Contrato de papel + correção** | `agent-role.schema` + `step-contract` (§4) + política de parada; estende T13 | F14.0 | Smoke: plano mostra budget/gates; run interrompido retomável; `fail-step` nomeado |
| **F14.2 — QA de conteúdo v2** | Validadores determinísticos (alpha real, paleta, tiling, UV overlap, tri budget, loop) | F14.1 | Testes verdes; corrige lacuna G8/T12; sem IA |
| **F14.3 — Piloto MCP local (leitura)** | `mcp-for-blender` (ou Krita MCP) com allowlist read-only + gate | F14.1 | Operação de inspeção (não mutação) via agente; log auditável; kill-switch testado |
| **F14.4 — Skills de runtime curadas** | 3–5 skills (pixel palette, game-ready humanoid checklist, atlas Godot, tiling check) | F14.1 | Manifesto com trust/licença; discovery filtra por capabilities |
| **F14.5 — Adapter remoto piloto (opcional)** | 1 provider (ex.: Meshy ou Tripo) em modo dry-run primeiro | F14.0, F14.1, F14.2 | dry-run sem rede; chamada real só com consentimento; artifacts baixados; licença registrada |
| **F14.6 — VLM co-review (opt-in)** | Flag experimental; nunca auto-aprova | F14.2 | Métricas registradas; taxa de falso-alarme medida; gate humano mantido |
| **F14.7 — Benchmark e relatório** | Rodar Visual QA Benchmark + matriz de evidências | F14.2–F14.6 | Relatório de antes/depois; nenhuma capability real → sem marketing de "pronto" |

Mapeado aos marcos T12 (F0–F8): F14.0↔decisão T12-13; F14.1–F14.2 reforçam F1/F3; F14.3↔F4 (adapters); F14.5↔F5/F6 (providers); F14.6–F14.7↔F7 (QA/Benchmark). **Nada disso está autorizado por este documento.**

## 8. Lacunas que a Forge precisa preencher (priorizadas)

- **L1 (P0).** Contrato de passo com **orçamento de tentativas/custo e política de parada** — sem ele, "agente" vira loop caro e imprevisível.
- **L2 (P0).** Ligar o **Skills & Knowledge Engine** (proposto) ao planner: discovery→trust→invocação→registro de qual skill influenciou o plano.
- **L3 (P0).** **Ledger de licenças/proveniência por componente** em todo artefato (modelo `licenses.yaml` do Effigy): sem isso, nenhum asset pode ser vendido/publicado com segurança.
- **L4 (P0).** **QA de conteúdo determinístico** completo (ver F14.2) — condição para fechar o agir→inspecionar→corrigir sem humano em cada micro-passo.
- **L5 (P1).** **Adapter remoto** com consent-UX completo (lista de dados, custo, retenção, licença de saída) — desbloqueia 3D rápido no hardware-alvo.
- **L6 (P1).** **VFX do zero**: definição de capability + gerador procedural interno ampliado (hoje só sheets básicas) + QA de loop; não existe solução aberta para comprar/copiar.
- **L7 (P1).** **Auto-rig local** ou decisão formal por Mixamo/manual; avaliar UniRig só se houver GPU compatível autorizada.
- **L8 (P2).** **Retarget motion→GLB/FBX** (kimodo.cpp não exporta); possivelmente Blender headless intermediário.
- **L9 (P2).** **VLM co-review** opt-in (§F14.6) e métricas de consistência (OpenCLIP-like) — aprimora revisão, nunca a substitui.
- **L10 (P2).** **Exportadores por destino** validados (Godot/Unity/Unreal) além do manifesto; hoje é `PARTIAL` (T12).
- **L11 (P2).** **Benchmark contínuo** (Visual QA Benchmark implementado) com golden assets e regressão por release.
- **L12 (P3).** Telemetria própria (opt-in) para descobrir onde runs falham; nunca conteúdo.

## 9. Decisões humanas necessárias antes de qualquer piloto

1. Autorizar avaliação técnica (não integração) de **um** MCP local (blender ou krita) com allowlist read-only?
2. Autorizar **adapter remoto** piloto, incluindo classificação de dados e teto de custo? Qual provider?
3. O alvo RX 580 fica como "manual+Blender+Krita+Aseprite" (viável hoje) e 3D rápido só remoto/colab?
4. Skills externas: processo de curadoria e `trust` aceito (quem assina `reviewed-external`)?
5. Orçamento de **correção automática** default (tentativas/custo/tempo) por passo?
6. VLM: autorizar experimento opt-in em máquina do usuário? Qual modelo (licença por card)?
7. Rota de cabelo/hair cards: pesquisa própria, provider remoto, ou fora do escopo?

## 10. Riscos principais

- **R1.** Aceitar providers por popularidade sem gate → vazamento de referências privadas. Mitigação: L5/1–7.
- **R2.** MCP stdio vira shell remoto do agente → RCE local. Mitigação: allowlist, timeout, processo sem credenciais.
- **R3.** Licença de pesos/modelos incompatível com uso comercial → asset inútil no destino. Mitigação: ledger L3 + gate "licença verificada".
- **R4.** "Agente fez" vira desculpa para pular revisão → asset ruim publicado. Mitigação: gates humanos indelegáveis no contrato (L1).
- **R5.** Depender de SaaS volátil (preços/termos mudam, ex.: retenção Ludo 7 dias) → pipeline quebra. Mitigação: adapter substituível + cache local de artifacts + dry-run.
- **R6.** Hardware RX 580 engana benchmarks feitos em 9070 XT/5090 → frustração. Mitigação: probe E1-T11; expectativas escritas; rotas CPU/Vulkan priorizadas.
