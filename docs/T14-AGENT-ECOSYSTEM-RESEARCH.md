# T14 — Pesquisa: ecossistema de agentes para produção completa de assets de jogos

> **Estado:** `RESEARCH` + `PROPOSED`. **Não** autoriza implementação, integração, instalação ou compra. **Data:** 2026-11-14 (UTC). **Branch:** `arena/7aa32dab-lia-forge` (a partir de `5b0ec51`, T13).
> **Documentos irmãos desta tarefa:** [`T14-AGENT-SOLUTIONS-CATALOG.md`](T14-AGENT-SOLUTIONS-CATALOG.md) (catálogo por solução, com licença/atividade/integração/classificação) · [`T14-AGENT-SKILLS-MCP-MATRIX.md`](T14-AGENT-SKILLS-MCP-MATRIX.md) (matrizes de domínio, MCP, Skills e hardware) · [`T14-AGENT-ORCHESTRATION-ARCHITECTURE.md`](T14-AGENT-ORCHESTRATION-ARCHITECTURE.md) (arquitetura, workflows W-A…W-E, roadmap, lacunas).
> **Anti-duplicação:** T7–T13 cobriram nove+ repositórios-chave, ferramentas de produção 2D/3D/cabelo/movimento/spritesheets, o hardware RX 580 e a arquitetura-alvo. Nada disso foi refeito; a T14 cobre o que faltava: **agentes, subagentes, Skills, MCPs, workflows e frameworks que usam ferramentas reais para criar/inspecionar/corrigir/entregar assets**, avaliando cada um individualmente.

## 1. Método e fontes

- GitHub API (`gh api repos/{owner}/{repo}` e `…/license`) e `gh search repos` em 2026-11-14 — metadados, SPDX, stars, atividade. Leitura de arquivos de licença quando a SPDX era `NOASSERTION` (n8n, Windmill, Mastra, AutoGPT, Phoenix, stable-fast-3d, Hunyuan3D-2, windmill, MCP servers, comfy-mcp).
- npm registry (`@anthropic-ai/claude-agent-sdk`, `claude-code`) — licença do SDK reportada como "SEE LICENSE IN README.md" (não OSI).
- Busca web para serviços/preços SaaS (out–nov/2026), sempre rotulada "verificar no site"; **nenhum preço aqui foi aceito como verdade homologada**.
- **Nenhuma instalação, clone, execução, download de modelo/peso/asset, chamada de API paga, envio de arquivo ou integração foi feita.** Nenhum contrato/código/configuração alterado. Dados privados nunca tocaram serviços externos (as consultas foram metadados públicos).
- Limitações: snapshot único; estrelas ≠ qualidade; blogs são descoberta; licenças de **pesos/modelos** (HF) não foram auditadas caso a caso — tratado como gate, não como detalhe.

## 2. Resumo executivo (as 10 descobertas que importam)

1. **Não existe hoje, em código aberto, um sistema "pedido → asset de jogo completo" equivalente ao escopo da Forge.** O mais próximo é o **Effigy** (MIT; T9) — mesma visão (local, offline, licenças por componente, etapas versionadas, MCP), com foco em 3D/sprites e hardware bem superior ao alvo. Ou seja: a lacuna é de **produto**, não de pesquisa.
2. **Frameworks multiagente gerais (LangGraph, CrewAI, AutoGen/AG2, Agents SDK, ADK, MetaGPT…) são maduros — e todos erram no ponto que importa para a Forge: não conhecem contratos de asset.** São REFERENCE de padrões (HITL, checkpoint, handoff, eval), nunca donas da orquestração. Um "agente criativo" sem validador de arquivo é fumaça de demo.
3. **MCP é o padrão de ferramenta agent-native já viável hoje** — e o ecossistema criativo explodiu: Blender (há opção MIT), Krita, Aseprite, Godot, Unity, Unreal (sem oficial da Epic), ComfyUI (inclusive MCP **oficial dual-licenciado AGPL/comercial — bloqueado** para embutir; a Forge já contorna isso via HTTP direto). O risco dominante não é técnico, é **permissão**: MCP stdio = código arbitrário in-DCC.
4. **A rota comercial é forte em 2D/pixel e 3D rápido — e é o único caminho de qualidade no hardware-alvo hoje:** Meshy/Tripo3D/Scenario/PixelLab/Ludo/Hyper3D têm MCP oficial, planos a partir de ~US$ 5–20/mês (PixelLab tem plano brasileiro de US$ 5) e licenças de saída claras **nos planos pagos** (free tiers costumam ser CC-BY-4.0/pessoal/público). Tudo é remoto: **consentimento por chamada, dados classificados, custo no plano, artifacts baixados na hora**.
5. **No RX 580 8 GB (gfx803, sem ROCm), local-LLM é plausível só para assistência (7B Q4), geração de imagem é impraticável fora de SD1.5 quantizado lento, 3D gen é inviável local (trellis.cpp tem binário Vulkan mas gfx803 é `unknown`; upstream exige ≥24 GB).** A produção local realista é: Blender/Krita/Aseprite manual+agente, render de spritesheet CPU (já existe), kimodo.cpp/motion-bricks.cpp para movimento, e providers remotos consentido para 3D.
6. **QA é onde a IA menos entrega e onde a Forge mais precisa.** Nenhuma solução aberta faz "QA de asset" completo; há utilidade real em (a) validação determinística de conteúdo (alpha real, tiling, UV, tri budget) — **construir**; (b) VLM local opt-in para sinalizar problemas — experimento apenas; (c) revisão humana indelegável — já é a filosofia do produto.
7. **Correção automática existe como padrão (retry com feedback) em projetos pequenos (ex.: `game-asset-agent`, sem licença — não copiar) mas não como infraestrutura confiável.** A Forge deve implementar loop com orçamento de tentativas + parada garantida; é L1 da arquitetura.
8. **Skills externas valem por curadoria, nunca por importação:** `awesome-gamedev-agent-skills` (Apache-2.0) e `blender-skills` (MIT) são as mais úteis — ambas exigem processo de review (instrução externa é dado não confiável; DCC = RCE embutido).
9. **A tendência padroniza handoff entre agentes (A2A do ADK, MCP client embutido no Agents SDK, MCPs por ferramenta) — reforça o desenho de handoff já existente na Forge** e sugere um futuro "Lia Desktop ↔ Lia Forge" falando MCP, quando e se aprovado.
10. **Risco sistêmico é jurídico, não técnico:** licenças de pesos (TRELLIS GGUF sem card claro, Hunyuan Community License exclui UE/UK/KR, SF3D community, nvdiffrast não-comercial), MCP sem licença (pixellab-mcp, unreal-mcps populares), licença AGPL/EE em ferramentas (comfy-mcp, n8n, Windmill, Phoenix ELv2) e SaaS com termos dinâmicos (retenção de 7 dias do Ludo). **Ledger de licenças por componente (modelo Effigy) é pré-condição de qualquer entrega.**

## 3. Respostas diretas às 7 perguntas da tarefa

**§1 Ecossistema (por área):** cobertura sintetizada na Matriz §1 do documento de matrizes — 2D/spritesheets/UI/Otimização = ALTO/MÉDIO com peças locais; 3D/personagens/cabelo/rig = MÉDIO–BAIXO sem serviços; VFX = **lacuna**; Concept = ALTO (ComfyUI) mas com restrição de hardware; QA/Correção = BAIXO–MÉDIO.

**§2 Agentes e frameworks:** LangGraph/CrewAI/AutoGen/Agents-SDK/ADK/MetaGPT/AgentScope/smolagents/SemanticKernel/LlamaIndex/Mastra → **REFERENCE** (padrão) ; n8n/Windmill/Flowise/AutoGPT/Phoenix/TaskWeaver → **NOT RECOMMENDED/RESEARCH ONLY**; promptfoo → **REUSE** candidato dev-only; Effigy → **REFERENCE** primária; handoffs (Codex/opencode/Goose/Aider/OpenHands/Gemini CLI; Claude SDK não-OSI) → **REFERENCE** (destinos já suportados pelo protocolo da Forge).

**§3 Avaliação + classificação:** catálogo completo com 27 frameworks, 6 grupos de Skills, 17 MCPs, 12 provedores remotos e pipelines; resumos por classe na Parte J do catálogo. **Nenhum item é REUSE aprovado; tudo permanece sujeito a decisão humana e registro de admissão.**

**§4 Arquitetura:** 8 papéis lógicos (não 12 agentes), Forge dona de L0–L2, adapters L3/L4 permutáveis, contrato de passo com orçamento de correção, ledger de licenças transversais — ver `T14-AGENT-ORCHESTRATION-ARCHITECTURE.md`.

**§5 Fluxo completo (10 etapas):** W-A 2D sprite · W-B personagem humanoide · W-C animação walk cycle · W-D cenário paralelo · W-E UI/VFX HUD — cada um com gates, correção e entrega (arquivos+preview+relatório) no doc de arquitetura §5.

**§6 Hardware:** matriz completa na Matriz §4. Regra prática para o alvo RX 580/5500/16 GB/Windows: **local = manual+Blender+Krita+Aseprite+render CPU+motion local; remoto consentido = 3D rápido e concept pesado; nunca assumir CUDA/ROCm; Vulkan é o caminho local de ML que resta, com `unknown` até probe autorizado.**

**§7 Entregáveis:** os quatro documentos T14 + esta seção; roadmap F14.0–F14.7 e lacunas L1–L12 no doc de arquitetura; atualização do índice (`docs/README.md`).

## 4. Classificações-consolidadas (contagem, pós-2ª passada)

REUSE candidato: 3 (promptfoo dev-only, ollama, llama.cpp) · ADAPT local: 13 · ADAPT remoto (consentido): 7 serviços/wrappers · ADAPT conteúdo curado: 4 · REFERENCE: ~20 · RESEARCH ONLY: ~20 · BLOCKED: 5 · NOT RECOMMENDED: 7. Detalhe: catálogo Parte J. **Nenhuma adoção implícita; IDs e decisões humanas em aberto.**

## 5. Recomendações priorizadas (o que pedir ao humano decidir primeiro)

1. **P0 — Decisão F14.0:** confirmar escopo de piloto: (a) contrato de papel+correção no engine (F14.1); (b) QA determinístico v2 (F14.2); (c) 1 MCP local read-only (blender/krita); (d) 1 provider remoto em dry-run (Meshy ou Tripo) com teto de custo; (e) 5 skills curadas.
2. **P0 — Não embutir comfy-mcp oficial** (AGPL/dual): manter HTTP direto; revisitar licença comercial com a Comfy Org só se fizer sentido.
3. **P0 — Ledger de licenças por asset** como requisito de entrega de todo workflow (L3) — pré-condição de uso comercial.
4. **P1 — Expectativa de hardware por escrito:** RX 580 não gera 3D/concept pesado local; aprovar política "remoto consentido ou manual" para essas etapas.
5. **P1 — Correção automática:** política default (2 tentativas estruturais, 1 semântica máx., parada garantida, escalona para humano).
6. **P2 — PixelLab como primeiro adapter remoto "pequeno"** (custo baixo, plano BR US$5, MCP oficial, saída comercial nos pagos) para validar o consent-UX remoto de ponta a ponta — **somente após F14.1–F14.2**.
7. **Não fazer agora:** embutir LangGraph/CrewAI/Mastra; VLM no QA crítico path; VFX generativo; auto-rig local; mudança de contratos de produção; qualquer merge para `main`.

## 6. Riscos e mitigações (resumo)

RCE via MCP stdio → allowlist+timeout+processo sem credenciais · licença de pesos/modelos → ledger+gate · SaaS volátil → adapter substituível+cache local · "IA aprovou" → humano indelegável · benchmark em GPU errada → probes locais · injection via skills → scanner+render-only · custo descontrolado → teto por passo+total no plano. Detalhe: arquitetura §10.

## 7. Limitações desta pesquisa

- Snapshot único (2026-11-14); atividade/stars mudam; preços SaaS mudam (Ludo retém 7 dias; PixelLab tem plano BR sujeito a alteração — confirmar).
- Licenças de **pesos** (TRELLIS GGUF, Hunyuan, SAM3/DINOv3/Llama-3 gated, FLUX dev NC) não auditadas em texto completo — tratadas como `unknown`/gate.
- Nenhum código foi lido além de licenças/README públicos; nenhuma execução mediu as capacidades aqui listadas — toda "capacidade real" é **declaração de autor, documentação ou terceiro**.
- VLM: `QwenLM/Qwen2.5-VL` redireciona para `Qwen3-VL` (**Apache-2.0**, ★20.211) e `vikhyat/moondream` para `m87-labs/moondream` (**Apache-2.0**, ★10.160) verificados em repositório; **pesos HF não verificados**; SmolVLM/InternVL não verificados. OpenCLIP: texto MIT clássico sem título — GitHub reporta `NOASSERTION`; pesos são da OpenAI. Infinigen tem dependências/assets com termos próprios não inventariados.
- "REUSE candidato" ≠ aprovado: processo de admissão (pin, SBOM, testes no alvo, revisão de segurança, decisão humana) continua obrigatório para qualquer incorporação.

## 8. O que falta (lacunas L1–L12) e próximos passos

Ver `T14-AGENT-ORCHESTRATION-ARCHITECTURE.md` §8 (L1–L12) e §7 (roadmap F14.0–F14.7) e §9 (decisões humanas). Próximo passo concreto sugerido: **revisão humana deste conjunto T14; em seguida, F14.0** (registro de decisão) — nada além disso deve acontecer sem ela.

---

## 11. Addendum — 2ª passada de verificação (2026-11-14, mesmo dia)

Feita dentro das mesmas restrições (nenhuma instalação/execução/integração; apenas fontes primárias):

- **VLMs:** `QwenLM/Qwen2.5-VL` → redirect `QwenLM/Qwen3-VL` (Apache-2.0, ★20.211, push 2026-01-30); `vikhyat/moondream` → redirect `m87-labs/moondream` (Apache-2.0, ★10.160, push 2026-04-20). SmolVLM/InternVL: não verificados (pesos/HF fora do alcance). Conclusão operacional: há candidatos locais de revisão VLM com licença de código permissiva, **todos permanecem RESEARCH ONLY** (opt-in, nunca aprovador; custo/CPU no alvo `unknown`).
- **OpenCLIP (`mlfoundations/open_clip`):** arquivo de licença lido — MIT clássico sem título, `NOASSERTION` no GitHub; pesos CLIP são da OpenAI. Mantém-se RESEARCH ONLY.
- **Retro Diffusion:** fontes web (set/nov-2026) indicam uso comercial permitido e pay-per-image ~US$ 0,015–0,18; Aseprite extension ~US$ 65; API/MCP declarados. Permanece RESEARCH ONLY (SaaS pago; termos do plano efetivo a verificar).
- **Collections de skills:** `awesome-gamedev-agent-skills` ★8.770 (push 2026-11-12), `blender-skills` ★2.761 (push 2026-11-06), `sprite-gen` ★4.055 (push 2026-11-07), `Effigy` ★260 (push 2026-11-13).
- **Consistência interna:** contagem de ADAPT locais corrigida para 13 no catálogo e no §4; `UniRig` removido do bloco "ADAPT conteúdo" (permanece RESEARCH ONLY); typo `deepeval-eval` corrigido.

## Apêndice A — Fontes primárias consultadas (2026-11-14)

**GitHub API/`gh` (metadados e licenças):** LangGraph, CrewAI, microsoft/autogen (SPDX `CC-BY-4.0`), ag2ai/ag2, openai-agents-python, google/adk-python, FoundationAgents/MetaGPT, camel-ai/camel, agentscope-ai/agentscope, huggingface/smolagents, microsoft/semantic-kernel, run-llama/llama_index, mastra-ai/mastra (dual Apache-2.0+ee), langflow-ai/langflow, FlowiseAI/Flowise (**arquivado** 2026-08-13), n8n-io/n8n (Sustainable Use License), windmill-labs/windmill (AGPL/Apache/EE), temporalio/temporal, node-red/node-red, PrefectHQ/prefect, apache/airflow, microsoft/TaskWeaver (**arquivado**), griptape-ai/griptape, promptfoo/promptfoo, confident-ai/deepeval, Arize-ai/phoenix (ELv2), openai/swarm, Significant-Gravitas/AutoGPT (Polyform Shield na plataforma), openai/codex, anomalyco/opencode, aaif-goose/goose, Aider-AI/aider, OpenHands/OpenHands, google-gemini/gemini-cli, ollama/ollama, ggml-org/llama.cpp, ahujasid/mcp-for-blender, Comfy-Org/comfy-mcp (dual AGPL/comercial), artokun/comfyui-mcp, joenorton/comfyui-mcp-server, ATH-MaaS/Pixelle-MCP, meshy-dev/meshy-mcp-server, pixellab-code/pixellab-mcp (sem licença), pixellab-code/pixellab-python (sem licença), nanayax3/krita-mcp, SanSaSane/krita-mcp, diivi/aseprite-mcp, willibrandon/pixel-mcp, Coding-Solo/godot-mcp, tugcantopaloglu/godot-mcp, IvanMurzak/Godot-MCP, CoplayDev/unity-mcp, chongdashu/unreal-mcp (sem licença), ChiR24/Unreal_mcp, flopperam/unreal-engine-mcp (sem licença), GLips/Figma-Context-MCP, modelcontextprotocol/servers, anthropics/skills (per-skill Apache-2.0), VAST-AI-Research/UniRig, Tencent-Hunyuan/Hunyuan3D-2 (Community License; UE/UK/KR excluídos), stability-ai/stable-fast-3d (Community License), allenai/Holodeck, allenai/procthor, allenai/ai2thor, princeton-vl/infinigen, mlfoundations/open_clip, wangchaozhi/game-asset-agent (sem licença).

**npm registry:** `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/claude-code` — "SEE LICENSE IN README.md".

**Web (descoberta; preços/termos — verificar antes de decidir):** Meshy ([knowara.com](https://knowara.com/ai-tools/image/meshy-ai-review/), [aitoolapp.com](https://aitoolapp.com/meshy-ai/)) · Tripo3D ([tripo3d.ai](https://www.tripo3d.ai/game-development/image-to-3d-model-ai-with-automatic-pbr-texture-generation-for-realistic-games), [tooliverse.ai](https://tooliverse.ai/tools/tripo), [atlascloud.ai](https://www.atlascloud.ai/models/tripo)) · Scenario ([mrtechking.com](https://www.mrtechking.com/scenario/), [sunoboard.com](https://sunoboard.com/blog/scenario-mcp-consistent-game-art), [ludo.ai compare](https://ludo.ai/compare/best-ai-game-asset-generators)) · PixelLab ([sunoboard.com](https://sunoboard.com/blog/pixellab-mcp-pixel-art-claude-code), [quickmatch.si](https://quickmatch.si/guides/best-ai-tool-pixel-art-sprites/)) · Ludo.ai ([ludo.ai/compare](https://ludo.ai/compare/ludo-vs-meshy), [revuo.ai](https://www.revuo.ai/category/mcp-design-media/ludo-ai)) · Hyper3D Rodin ([developer.hyper3d.ai](https://developer.hyper3d.ai/api-specification/rodin-generation-gen2), [affinco.com](https://affinco.com/hyper3d-review/)) · Figma MCP ([thefrontendcompany.com](https://www.thefrontendcompany.com/posts/figma-mcp-server), [toolradar.com](https://toolradar.com/blog/figma-mcp-server)) · game-asset-agent ("GameAsset Forge", 美术总监→提示词工程师→图像引擎→审查官) ([github.com/wangchaozhi/game-asset-agent](https://github.com/wangchaozhi/game-asset-agent)).

**Interno (base, não refeita):** `EXTERNAL-REPOSITORY-RESEARCH.md`, `T9-HYBRID-EXECUTION-AND-ASSET-PRODUCTION-RESEARCH.md`, `T9-ASSET-TOOLS-AND-EXECUTION-MATRIX.md`, `T10-E1/E3`, `T11-*`, `T12-*`, `T13-IMPLEMENTATION-EVIDENCE.md`, `SKILLS-KNOWLEDGE-ENGINE.md`, `WORKFLOW-ENGINE.md`, `INTELLIGENT-ORCHESTRATOR.md`, `TOOL-PROVIDER-HUB.md`, `VISUAL-QA-BENCHMARK.md`, `ASSET-MANAGEMENT.md`.
