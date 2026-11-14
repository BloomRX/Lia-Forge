# T14 — Catálogo de agentes e soluções existentes (ecossistema de produção de assets de jogos)

> **Estado:** `RESEARCH` + `PROPOSED`. **Nada foi instalado, baixado, executado, chamado, enviado, licenciado ou gasto.** Nenhum contrato, código ou configuração foi alterado.
> **Data:** 2026-11-14 (UTC). **Branch:** `arena/7aa32dab-lia-forge`.
> **Método:** metadados via GitHub API (`repos/{owner}/{repo}`, `license`, `rate_limit`), busca de repositórios via `gh search`, leitura de `LICENSE` quando a SPDX reportada era `NOASSERTION`, e busca web para preços/termos de serviços comerciais (marcados com data e sempre "verificar no site antes de qualquer decisão"). **Nenhum clone, release, modelo, peso ou asset foi baixado.** Vídeos e blogs são fontes de descoberta, nunca comprovação.
> **Anti-duplicação:** as pesquisas T7–T13 (`EXTERNAL-REPOSITORY-RESEARCH.md`, `T9-HYBRID-EXECUTION-AND-ASSET-PRODUCTION-RESEARCH.md`, `T9-ASSET-TOOLS-AND-EXECUTION-MATRIX.md`, `T12-CAPABILITY-AND-TOOLCHAIN-MATRIX.md`, `T11-2D-*`, `humanoid-workflow-research.md`, `SKILLS-KNOWLEDGE-ENGINE.md`, `WORKFLOW-ENGINE.md`, `INTELLIGENT-ORCHESTRATOR.md`, `TOOL-PROVIDER-HUB.md`) **não são repetidas aqui**. Itens já cobertos entram no máximo como uma linha de referência cruzada.
> **Classificações (vocabulário desta revisão, pedido do usuário):**
> `REUSE` = adotável como dependência/peça após o processo padrão de admissão (source/version pin, leitura de licença completa, SBOM, testes no alvo) — **não é autorização**; `ADAPT` = considerar adapter/wrapper curado após review e decisão humana; `REFERENCE` = estudar conceito, formato ou arquitetura — **nunca copiar código**; `RESEARCH ONLY` = material de estudo, sem plano de uso; `BLOCKED` = impedido agora por licença, hardware, termos ou falta de consentimento; `NOT RECOMMENDED` = rejeitado, com motivo. Nenhum item está aprovado para incorporação; a decisão é sempre humana e posterior.
> **Atualização 2026-11-14 (2ª passada):** licenças e métricas de VLM/OpenCLIP/Retro Diffusion/collections verificadas em nível de repositório (ver `T14-AGENT-ECOSYSTEM-RESEARCH.md` §11); nenhuma classificação mudou de aprovada.
> **Licença verificada em 2026-11-14 via GitHub API quando indicado.** "Empírico/declaração do autor" está marcado. `unknown` é estado visível, não ausência de problema.

Documentos de acompanhamento: [`T14-AGENT-ECOSYSTEM-RESEARCH.md`](T14-AGENT-ECOSYSTEM-RESEARCH.md) (relatório) · [`T14-AGENT-SKILLS-MCP-MATRIX.md`](T14-AGENT-SKILLS-MCP-MATRIX.md) (matrizes) · [`T14-AGENT-ORCHESTRATION-ARCHITECTURE.md`](T14-AGENT-ORCHESTRATION-ARCHITECTURE.md) (arquitetura, workflows, roadmap, lacunas).

---

## Parte A — Frameworks de orquestração multiagente (gerais, não específicos de assets)

Posição de princípio da Forge: **a Forge é dona da orquestração** (`WORKFLOW-ENGINE`, `INTELLIGENT-ORCHESTRATOR`, contratos de domínio). Frameworks externos entram no máximo como **referência de padrões** ou, se algum dia autorizados, como runtime opcional fora do núcleo — nunca como dona do plano, do gate ou do consentimento.

### A1. `langchain-ai/langgraph` — REFERENCE
- **Link:** <https://github.com/langchain-ai/langgraph> · **Licença:** MIT (verificada via API) · **Snapshot:** ★44.923, push 2026-11-14, Python, não arquivado.
- **Capacidades reais:** grafos com estado, checkpoint/persistência, human-in-the-loop, subgrafos, streaming, integração LangSmith (proprietário).
- **Ferramentas/dependências:** Python 3.10+; `langchain-core`; integrações opcionais (OpenAI, Anthropic, Ollama via `langchain-ollama`).
- **Hardware/internet:** roda local; LLM pode ser local (Ollama/llama.cpp) ou remoto. Sem GPU obrigatória.
- **Pago/grátis:** MIT grátis; LangSmith e LangGraph Platform/Cloud são pagos.
- **Segurança:** código maduro e muito usado; superfície ampla de dependências; checkpointer em produção precisa de revisão de acesso.
- **Limitações:** introduz runtime Python ao lado do Electron/Node; duplicaria o Workflow Engine próprio; modelos devem ser avaliados à parte.
- **Integração Forge:** estudar padrões (HITL, checkpoint, subgrafo, time-travel); **não** embutir. REFERENCE do desenho de `Workflow Engine` + retomada por checkpoint já proposto na T8/T12.
- **Equivalente:** n/a.

### A2. `crewAIInc/crewAI` — REFERENCE
- **Link:** <https://github.com/crewAIInc/crewAI> · **Licença:** MIT (API) · **Snapshot:** ★60.866, push 2026-11-13, Python.
- **Capacidades reais:** "crews" com papéis, metas, tarefas ordenadas (`sequential`/`hierarchical`), tools, memória, knowledge; exemplos de pipelines de conteúdo.
- **Ferramentas/deps:** Python; `crewai`, `instructor`, integrações LLM diversas; pode usar modelos locais via litellm/Ollama.
- **Hardware/internet:** leve; internet só se o LLM for remoto.
- **Pago/grátis:** MIT grátis; CrewAI Enterprise/AMP pago (plataforma hosted).
- **Segurança:** prompts dos papéis são dados não confiáveis; tool callbacks precisam de sandbox; telemetria opt-out existe (verificar versão).
- **Limitações:** abstração orientada a conversa/processo, não a contratos de asset com validação estrutural; sem QA de arquivo embutido.
- **Integração Forge:** padrão de "papel + objetivo + ferramentas + critério de saída" é exatamente o que um "agent role" da Forge expressa de forma declarativa. REFERENCE para a especificação de papéis (ver arquitetura). Não adotar runtime.

### A3. `microsoft/autogen` e `ag2ai/ag2` — REFERENCE / RESEARCH ONLY
- **Link:** <https://github.com/microsoft/autogen> · **Licença (API 2026-11-14):** `CC-BY-4.0` reportado (o histórico do código era MIT; o SPDX atual e a documentação devem ser lidos no repo antes de qualquer uso) · **Snapshot:** ★61.808, push 2026-11-12.
- **AG2 (fork comunitário):** <https://github.com/ag2ai/ag2> — Apache-2.0, ★5.062, push 2026-11-13 — "AG2 (formerly AutoGen): The Open-Source AgentOS".
- **Capacidades reais:** conversa entre agentes, GroupChat, tools/functions, agentes conversacionais; AG2 mantém o lineage pós-transição da Microsoft.
- **Limitações:** incerteza de licença no repositório original; foco em chat multiagente; nenhum conceito nativo de asset/QA/gates.
- **Integração Forge:** REFERENCE histórico; AG2 como material de comparação. Nenhum uso planejado.

### A4. `openai/openai-agents-python` — REFERENCE
- **Link:** <https://github.com/openai/openai-agents-python> · **Licença:** MIT (API) · **Snapshot:** ★30.657, push 2026-11-14.
- **Capacidades reais:** agentes leves, handoffs, guardrails, tracing, sessões, MCP client embutido; sucessor recomendado do Swarm.
- **Dependências:** Python; otimizado para Responses API da OpenAI, com suporte a providers compatíveis.
- **Pago/grátis:** SDK MIT grátis; modelos OpenAI pagos; providers alternativos variam.
- **Limitações:** melhor caminho com API OpenAI; tracing aponta para OpenAI por padrão; não é framework de pipeline de mídia.
- **Integração Forge:** handoff/guardrails são os mesmos conceitos já previstos no contrato de handoff (`docs/agent-workflow.md`) e nos gates da Forge. REFERENCE.

### A5. `google/adk-python` (Google Agent Development Kit) — REFERENCE
- **Link:** <https://github.com/google/adk-python> · **Licença:** Apache-2.0 (API) · **Snapshot:** ★22.208, push 2026-11-13.
- **Capacidades reais:** construção code-first de agentes, orquestração multiagente, protocolo A2A (agente-agente), avaliação (`adk eval`), deploy; exemplos multi-modal; integração Gemini/Vertex (pagos) e modelos locais via LiteLLM.
- **Integração Forge:** interessante pelo **A2A** (protocolo entre produtos Lia) e pelo harness de avaliação; REFERENCE para possível futura federação Studio↔Forge↔Desktop. Não embutir.

### A6. `FoundationAgents/MetaGPT` — REFERENCE
- **Link:** <https://github.com/FoundationAgents/MetaGPT> · **Licença:** MIT (API) · **Snapshot:** ★71.274, push 2026-01-21, Python — ritmo de contribuição menor que CrewAI/LangGraph.
- **Capacidades reais:** meta-programação por SOPs; papéis (PM/Architect/Engineer/QA), `ProjectManager`, memória compartilhada; gerou demonstrações de "empresa de software" e alguns exemplos de jogo web.
- **Integração Forge:** o padrão SOP (documentos de etapa como contrato entre papéis) reforça o desenho de workflows declarativos da Forge. REFERENCE. Não usar para geração de código de jogo como substituto da Forge.

### A7. `camel-ai/camel` — RESEARCH ONLY
- **Link:** <https://github.com/camel-ai/camel> · **Licença:** Apache-2.0 (API) · **Snapshot:** ★18.031, push 2026-11-09.
- **Capacidades reais:** role-playing em escala, enorme biblioteca de tools/datasets, tracks de pesquisa (inclui OWL); forte viés acadêmico/benchmark.
- **Integração Forge:** nenhum caminho de produção; RESEARCH ONLY.

### A8. `agentscope-ai/agentscope` — REFERENCE
- **Link:** <https://github.com/agentscope-ai/agentscope> · **Licença:** Apache-2.0 (API) · **Snapshot:** ★35.952, push 2026-11-13.
- **Capacidades reais:** plataforma multiagente com "Studio" próprio, `MsgHub`, pipelines, avaliação, tracing; suporta modelos locais (DashScope, Ollama, llama.cpp-compatible via adapters) e MCP.
- **Integração Forge:** referência de DX para depuração visual de pipelines de agentes (útil para o futuro painel); REFERENCE. Não embutir (Studio duplicaria UI).

### A9. `huggingface/smolagents` — REFERENCE
- **Link:** <https://github.com/huggingface/smolagents> · **Licença:** Apache-2.0 (API) · **Snapshot:** ★30.358, push 2026-11-10.
- **Capacidades reais:** agentes mínimos cujo "pensamento" é código Python executável em sandbox (E2B/Docker/local unsafe), tools como funções, integração hub HF.
- **Integração Forge:** o padrão "o agente escreve código que é verificado/executado em sandbox" é relevante para a etapa de correção automática; REFERENCE de design. Executar código de agente embutido exigiria sandbox aprovado — fora do escopo atual.

### A10. `microsoft/semantic-kernel` — REFERENCE
- **Link:** <https://github.com/microsoft/semantic-kernel> · **Licença:** MIT (API) · **Snapshot:** ★28.763, push 2026-11-13, C#/Python/Java.
- **Integração Forge:** planners e plugins são o mesmo conceito de "capability contracts + planner"; stack C#/Java não encaixa no Electron/Node. REFERENCE.

### A11. `run-llama/llama_index` (Workflows) — REFERENCE
- **Link:** <https://github.com/run-llama/llama_index> · **Licença:** MIT (API) · **Snapshot:** ★52.894, push 2026-11-13.
- **Capacidades reais:** ingestão/RAG + `Workflows` (eventos, steps) para agentes; forte para conhecimento/documentação.
- **Integração Forge:** referência para o futuro **Skills & Knowledge Engine** (indexação de specs, licenças e guias); REFERENCE. Não embutir.

### A12. `mastra-ai/mastra` — RESEARCH ONLY
- **Link:** <https://github.com/mastra-ai/mastra> · **Licença (API 2026-11-14):** `NOASSERTION` — núcleo sob Apache-2.0 com diretórios `ee/` sob licença Enterprise (ver `LICENSE` do repo). **Snapshot:** ★29.511, push 2026-11-14, TypeScript.
- **Capacidades reais:** framework TS para agentes, workflows, evals, memória, observability; rápido crescimento.
- **Integração Forge:** único concorrente TS de peso; pré-1.0 e dual-license; risco de conflito com a arquitetura própria. RESEARCH ONLY até estabilizar + decisão humana.

### A13. `langflow-ai/langflow` — REFERENCE
- **Link:** <https://github.com/langflow-ai/langflow> · **Licença:** MIT (API) · **Snapshot:** ★156.613, push 2026-11-14.
- **Integração Forge:** referência de builder visual de agentes; código e dependências (Node+Python) não embutíveis no pacote atual. REFERENCE (inspiração de UX/configuração).

### A14. `FlowiseAI/Flowise` — NOT RECOMMENDED
- **Link:** <https://github.com/FlowiseAI/Flowise> · **Licença (API):** `NOASSERTION` (núcleo de código aberto com componente enterprise) · **Snapshot:** ★55.568, **arquivado em 2026-08-13** (somente leitura).
- **Motivo:** projeto arquivado; não há caminho de manutenção/suporte; risco de supply-chain congelado.

### A15. `n8n-io/n8n` — NOT RECOMMENDED (como componente), REFERENCE (como produto)
- **Link:** <https://github.com/n8n-io/n8n> · **Licença (API):** `NOASSERTION` — "Sustainable Use License" (fair-code, **não** é OSI) + arquivos `.ee` proprietários; uso embutido/redistribuição exige contato comercial. **Snapshot:** ★210.415, push 2026-11-14.
- **Integração Forge:** não embutir (licença fair-code + copyleft de rede para ofertas SaaS); estudar catálogo/UX de integrações como referência de produto. NOT RECOMMENDED como dependência.

### A16. `windmill-labs/windmill` — NOT RECOMMENDED (como dependência)
- **Link:** <https://github.com/windmill-labs/windmill> · **Licença (API):** `NOASSERTION` — AGPL-3.0/Apache-2.0 + Enterprise proprietário (arquivo `LICENSE` do repo lido). **Snapshot:** ★18.576, push 2026-11-13.
- **Motivo:** AGPL com obrigação de rede; incompatível com produto desktop fechado como dependência; como serviço externo auto-hospedado consumiria a mesma classe de permissão que qualquer adapter remoto. NOT RECOMMENDED.

### A17. `temporalio/temporal` — REFERENCE
- **Link:** <https://github.com/temporalio/temporal> · **Licença:** MIT (API) · **Snapshot:** ★24.386, push 2026-11-14, Go.
- **Capacidades reais:** durable execution (workflows como código, retries determinísticos, replay, signals).
- **Integração Forge:** confirma que o modelo de **checkpoint/retomada + orçamento de tentativas** que a Forge já implementou (T13) é o padrão da indústria; servidor Go externo pesado demais para o alvo. REFERENCE.

### A18. `node-red/node-red` · `PrefectHQ/prefect` · `apache/airflow` — REFERENCE
- **Links:** <https://github.com/node-red/node-red> (Apache-2.0, ★23.842) · <https://github.com/PrefectHQ/prefect> (Apache-2.0, ★24.155) · <https://github.com/apache/airflow> (Apache-2.0).
- **Integração Forge:** referências de execução visual/DAG; nenhum encaixa no produto; REFERENCE apenas.

### A19. `microsoft/TaskWeaver` — RESEARCH ONLY
- **Link:** <https://github.com/microsoft/TaskWeaver> · **Licença:** MIT (API) · **Snapshot:** ★6.159, **arquivado**, push 2026-03-23.
- **Capacidades reais (históricas):** code-first agent com planning e plugins para análise de dados.
- **Integração Forge:** RESEARCH ONLY (arquivado; escopo analítico).

### A20. `griptape-ai/griptape` — REFERENCE
- **Link:** <https://github.com/griptape-ai/griptape> · **Licença:** Apache-2.0 (API) · **Snapshot:** ★2.587, push 2026-11-13.
- **Integração Forge:** toolkit modular com ferramentas próprias (inclui integrações de geração de imagem); maturidade baixa (★2,6k). REFERENCE; nada a embutir.

### A21. `promptfoo/promptfoo` — REUSE candidato (dev-tooling, não runtime do produto)
- **Link:** <https://github.com/promptfoo/promptfoo> · **Licença:** MIT (API) · **Snapshot:** ★27.148, push 2026-11-14, TypeScript/CLI.
- **Capacidades reais:** avaliação/red-team de prompts e agentes, matriz de casos, CI; roda local.
- **Integração Forge:** candidato a **ferramenta de desenvolvimento** (avaliar prompts de agentes e skills curatoriais), não dependência do produto; exige decisão humana. REUSE candidato (dev-only).

### A22. `confident-ai/deepeval` — REFERENCE
- **Link:** <https://github.com/confident-ai/deepeval> · **Licença:** Apache-2.0 (API) · **Snapshot:** ★19.474, push 2026-11-12.
- **Integração Forge:** métricas de avaliação de LLM (faithfulness, relevância); complementa promptfoo; Python. REFERENCE.

### A23. `Arize-ai/phoenix` — NOT RECOMMENDED (como dependência)
- **Link:** <https://github.com/Arize-ai/phoenix> · **Licença (API/arquivo):** Elastic License 2.0 (**não** é OSI). **Snapshot:** ★12.277, push 2026-11-13.
- **Motivo:** ELv2 restringe oferta como serviço; como observability self-hosted seria concorrente de algo a construir; REFERENCE de UX de eval/trace. NOT RECOMMENDED como dependência.

### A24. `openai/swarm` — RESEARCH ONLY
- **Link:** <https://github.com/openai/swarm> · **Licença:** MIT (API) · **Snapshot:** ★22.135, push 2026-04-15; **superseded** pelo `openai-agents-python` (A4).
- **Integração Forge:** RESEARCH ONLY (educacional).

### A25. `Significant-Gravitas/AutoGPT` — NOT RECOMMENDED
- **Link:** <https://github.com/Significant-Gravitas/AutoGPT> · **Licença (API/arquivo):** plataforma (`autogpt_platform/`) sob **Polyform Shield**; resto MIT. **Snapshot:** ★188.019, push 2026-11-14.
- **Motivo:** licença do produto principal impede uso como componente/serviço concorrente; escopo (agentes gerais) diverge de pipeline de assets. NOT RECOMMENDED.

### A26. Claude Agent SDK / Claude Code / Codex CLI / opencode / Goose / Aider / OpenHands / Gemini CLI — REFERENCE (destinos de handoff)
- **Links:** Claude Agent SDK/Claude Code — SDK publicado como `@anthropic-ai/claude-agent-sdk` (npm, licença "SEE LICENSE IN README.md" — **não** é OSI; não embutível); <https://github.com/openai/codex> Apache-2.0 ★135.190 · <https://github.com/anomalyco/opencode> MIT ★226.675 · <https://github.com/aaif-goose/goose> Apache-2.0 ★56.563 (AAIF; sucessor do block/goose) · <https://github.com/Aider-AI/aider> Apache-2.0 ★50.111 · <https://github.com/OpenHands/OpenHands> MIT ★93.430 · <https://github.com/google-gemini/gemini-cli> Apache-2.0 ★108.821.
- **Capacidades reais:** agentes de código de terminal; **não produzem assets** por conta própria — consomem MCPs/CLIs (Blender, ComfyUI, Aseprite…) para isso.
- **Integração Forge:** são **destinos de handoff opcionais** já previstos em `docs/agent-workflow.md`. REFERENCE; nenhuma dependência nova; nenhum dado privado deve trafegar sem consentimento.

### A27. `wangchaozhi/game-asset-agent` ("GameAsset Forge") — RESEARCH ONLY
- **Link:** <https://github.com/wangchaozhi/game-asset-agent> · **Licença:** **nenhuma** (API `license: null`) · **Snapshot:** ★0, 3 commits, push 2026-07-07, TypeScript (npm workspaces).
- **Capacidades reais declaradas:** pipeline multiagente **美术总监 → 提示词工程师 → 图像引擎 → 审查官** (diretor de arte → engenheiro de prompt → motor de imagem → revisor com retry de feedback), providers OpenAI Images/Stability/SD WebUI/Replicate/ComfyUI/通义万相, SSE de progresso, galeria, custo/uso, cancelamento, mocks determinísticos, testes (Vitest).
- **Ferramentas/deps:** Node/TS; LLM (Claude/OpenAI-compatible/Gemini); imagem via providers externos ou SD local; **sem geração 3D real**.
- **Segurança:** sem licença → status de copy/uso bloqueado; conteúdo não auditável a fundo sem checkout (proibido nesta missão).
- **Integração Forge:** o desenho "diretor → prompt → motor → revisor com retry" é um **precedente público e pequeno** do padrão que a Forge propõe para etapas criativas; **não copiar código** (sem licença). RESEARCH ONLY até esclarecimento de licença — ou implementação independente.

## Parte B — Skills e coleções de Skills (conteúdo instrucional)

Skills são **dados não confiáveis**: podem conter injection, links, comandos e instruções conflitantes. A Forge só pode renderizar/ler/referenciar skills externas — nunca executar silenciosamente. Ver [`SKILLS-KNOWLEDGE-ENGINE.md`](SKILLS-KNOWLEDGE-ENGINE.md).

### B1. `gamedev-skills/awesome-gamedev-agent-skills` — ADAPT (curadoria, nunca importação em massa)
- **Snapshot:** ★8.770, push 2026-11-12 (revalidado 2026-11-14). Já coberto em `EXTERNAL-REPOSITORY-RESEARCH.md` item 1 (Apache-2.0; 77 skills declaradas, router, scripts, testes). **Delta desta revisão:** confirmar que o vocabulário de manifesto/normalização/checklist é o material mais próximo do manifesto de skill proposto pela Forge. ADAPT somente para **formato e checklists selecionadas**, com pin e `trust: reviewed-external` após review; nunca executar scripts do pacote sem revisão.

### B2. `arjun988/blender-skills` — ADAPT (curadoria forte + sandbox)
- **Snapshot:** ★2.761, push 2026-11-06. Já coberto em `EXTERNAL-REPOSITORY-RESEARCH.md` item 2 (MIT; 94 skills/175 references; pressupõe Blender MCP + Python dentro do Blender). **Delta:** como MCP passou a existir em várias implementações MIT (ver Parte C), o risco de execução remota de Python arbitrário continua — exigir review por skill, allowlist de operadores e nunca `bpy` não revisado. ADAPT por curadoria.

### B3. `anthropics/skills` — REFERENCE (formato), RESEARCH ONLY (conteúdo)
- **Link:** <https://github.com/anthropics/skills> · **Licença:** repo sem licença-raiz; cada skill traz `LICENSE.txt` próprio (amostra verificada 2026-11-14: **Apache-2.0** em `algorithmic-art` e `canvas-design`) · **Snapshot:** ★194.145, push 2026-11-06.
- **Capacidades reais:** skills oficiais da Anthropic (documentos, design, arte algorítmica, guias internos); **não há skills de game assets**; servem como referência de estrutura `SKILL.md` + manifesto `.claude-plugin`.
- **Integração Forge:** REFERENCE de formato/marketplace; conteúdo sem relação com o domínio 3D/2D de jogos. RESEARCH ONLY para conteúdo.

### B4. `aldegad/sprite-gen` (skill + CLI) — ADAPT candidato (utilitários delimitados)
- **Snapshot:** ★4.055, push 2026-11-07; release v4.0.0 em 2026-11-06; pytest. Já coberto em `EXTERNAL-REPOSITORY-RESEARCH.md` item 6 (Apache-2.0). **Delta:** suas lanes com providers remotos/pagos devem ser **excluídas**; aproveitar apenas utilitários 2D determinísticos (atlas, animação, normalização) após review.

### B5. `sprite-gen`-adjacent / Aseprite & Krita scripts genéricos — RESEARCH ONLY
- Coleções de scripts/skills de terceiros para Aseprite/Krita encontradas via busca (`gh search repos "pixel-art mcp"`): quase todas com ★0–10, sem licença ou sem testes. **Nenhum aproveitável sem processo individual.** RESEARCH ONLY por padrão.

### B6. Skills internas da Forge (`.agents/skills/lia-brand-check`, `.claude/rules/`)
- Já inventariadas em `SKILLS-KNOWLEDGE-ENGINE.md`. São regras de marca/contribuição, **não** skills de produção; a Forge ainda **não tem** skills de runtime. Lacuna registrada (ver arquitetura, §Lacunas L2).

## Parte C — MCP servers para ferramentas criativas e engines

MCP (Model Context Protocol) é o padrão de ferramenta agent-native do ecossistema. Dois tipos: **stdio local** (processo na máquina) e **remoto/hosted** (serviço de terceiro, exige consentimento de rede). A Forge já tem servidor MCP próprio (`spriteforge_*`) e cliente de handoff; **nenhum MCP externo é dependência hoje**. Riscos comuns: stdio executa código arbitrário do servidor; remoto envia dados do usuário; permissões amplas (filesystem/net) precisam de allowlist.

### C1. `ahujasid/mcp-for-blender` — ADAPT candidato (local, MIT)
- **Link:** <https://github.com/ahujasid/mcp-for-blender> · **Licença:** MIT (API; já verificado em T12/T7 e revalidado 2026-11-14) · **Snapshot:** ★34.326, push 2026-11-13; package `mcp-for-blender` 2.2.7; testes de segurança/compatibilidade no repo; sem GitHub release.
- **Capacidades reais:** controle de Blender via socket/add-on (objetos, materiais, câmeras, renders, scripts Python); usado por agentes (Claude/Codex/opencode) para operar o Blender de verdade.
- **Ferramentas/deps:** Blender 4.x; `mcp` (Python); porta local; Python dentro do Blender.
- **Hardware/internet:** local; CPU/GPU do usuário; sem conta; internet não obrigatória (exceto LLM remoto do agente operador, que é decisão do usuário).
- **Segurança:** o add-on executa Python arbitrário **dentro** do Blender — equivale a RCE local se o agente for manipulado; exige (a) operador humano consentindo cada sessão, (b) allowlist de operações, (c) execução com `blender --background` quando possível, (d) nunca em projetos com credenciais no `.blend`.
- **Limitações:** sem licença de modelos; qualidade depende do agente operador; UI/preview exige olhar humano; telemetry/status devem ser verificados na versão pinada.
- **Integração Forge:** **o candidato mais forte para o primeiro adapter MCP local** (alternativa ao script próprio de spritesheet), sempre opcional e desligado por padrão; fluxo de aprovação por passo. ADAPT candidato.

### C2. `Comfy-Org/comfy-mcp` (oficial do ComfyUI) — BLOCKED (AGPL-3.0-or-later / comercial)
- **Link:** <https://github.com/Comfy-Org/comfy-mcp> · **Licença (arquivo lido 2026-11-14):** **dual** — (a) AGPL-3.0-or-later (com obrigação de disclosure de rede) **ou** (b) licença comercial paga via `licensing@comfy.org` · **Snapshot:** ★342, push 2026-11-05.
- **Capacidades reais:** servidor MCP local para operar ComfyUI (fila, prompts, history, modelos) — mesmo papel do adapter HTTP que a Forge **já implementa diretamente** (`comfyui-concept`).
- **Segurança/termos:** embutir AGPL num produto desktop fechado (mesmo como processo separado, se "linked" por integração derivada) é risco jurídico; ofertar como serviço exige disclosure de fonte. A opção comercial existe.
- **Integração Forge:** **BLOCKED para embutir**; a rota já existente (HTTP `/prompt`,`/queue`,`/history` direto no ComfyUI local) cobre a mesma capacidade sem AGPL. REFERENCE/boletim: pedir à Comfy Org os termos comerciais caso um dia se deseje MCP oficial. *Nota: `docs/comfyui.md` cita este repositório como "first-party" — a nuance de licença passou a ser esta, registrada aqui.*

### C3. `artokun/comfyui-mcp` · `joenorton/comfyui-mcp-server` — ADAPT candidato (local, MIT/Apache-2.0)
- **Links:** <https://github.com/artokun/comfyui-mcp> — MIT, ★924, push 2026-11-09 ("local-first control plane, MCP server + sidebar") · <https://github.com/joenorton/comfyui-mcp-server> — Apache-2.0, ★412, push 2026-02-17.
- **Capacidades reais:** servidores MCP de terceiros para ComfyUI (fila, filas, downloads de modelos declarados — este último ponto precisa de **desligamento explícito** na Forge).
- **Integração Forge:** alternativas MIT/Apache ao C2 para quando um MCP local de ComfyUI for desejável; mesmos controles de C1. ADAPT candidato (escolher um por task, nunca os dois).

### C4. `ATH-MaaS/Pixelle-MCP` — REFERENCE
- **Link:** <https://github.com/ATH-MaaS/Pixelle-MCP> · **Licença:** MIT (API) · **Snapshot:** ★1.131, último push 2025-12, Python.
- **Capacidades reais:** plataforma multimodal AIGC sobre ComfyUI + MCP + LLM; workflows de vídeo/imagem/áudio como tools MCP.
- **Integração Forge:** demonstra "ComfyUI-as-tool-library para agentes" em escala; código não embutível (puxa ComfyUI inteiro + modelos); REFERENCE.

### C5. `meshy-dev/meshy-mcp-server` — ADAPT candidato **somente remoto com consentimento** (MIT)
- **Link:** <https://github.com/meshy-dev/meshy-mcp-server> · **Licença:** MIT (API) · **Snapshot:** ★93, push 2026-11-13; wrapper não-oficial sobre a API pública Meshy.
- **Capacidades reais:** expõe text-to-3D, image-to-3D, remessh, remesh, rig, animate (20 animações grátis por conta Free) da Meshy via MCP.
- **Dependências:** chave de API Meshy; rede; créditos; upload da imagem do usuário para os servidores da Meshy.
- **Pago/grátis:** Free 100 créditos/mês (saídas públicas, CC-BY-4.0, atribuição); Pro $20/mês (comercial, privado) — verificar <https://meshy.ai> (fonte: busca web 2026-09/10, não homologada por nós).
- **Segurança:** MCP local mas destino remoto; prompt/imagens saem do dispositivo; termos Meshy governam saídas; sem SLA do wrapper (não-oficial).
- **Integração Forge:** candidato a **adapter remoto** no Tool/Provider Hub — somente após decisão humana, consentimento por chamada, limite de custo, e dados classificados como não-sensíveis. ADAPT (remoto, consentido).

### C6. `pixellab-code/pixellab-mcp` / `pixellab-code/pixellab-python` — BLOCKED (sem licença); serviço oficial = RESEARCH ONLY
- **Links:** <https://github.com/pixellab-code/pixellab-mcp> — **sem LICENSE** (API 404), ★48, push 2025-08-10 · <https://github.com/pixellab-code/pixellab-python> — sem LICENSE, ★30, push 2026-05-27.
- **Serviço oficial:** MCP hospedado em `api.pixellab.ai/mcp` (documentado publicamente; ~100 tools: `create_character`, `animate_character`, `create_topdown_tileset`, `create_sidescroller_tileset`, `create_ui_asset`…). Trial: 40 gerações rápidas + 5/dia; planos **US$12/24/50**; **plano brasileiro "Pixel Novice" US$5/700 gerações** (fonte: blogs/sumarizador de preços, out/2026 — verificar no site). Saídas do usuário; proibição de uso para treinar modelos.
- **Integração Forge:** código sem licença → **não copiar/embutir**; serviço remoto → só com consentimento explícito e créditos; é a opção mais madura hoje para **sprites animados 8-direções e tilesets via agente**, mas é nuvem paga. RESEARCH ONLY hoje; ADAPT remoto após decisão.

### C7. `Scenario` — MCP oficial hospedado; RESEARCH ONLY/ADAPT remoto
- **Site do MCP:** `https://mcp.scenario.com/mcp` (OAuth ou API key) · **Licença do código do cliente:** não publicado como repositório utilizável; plataforma SaaS.
- **Capacidades reais:** geração on-style em lote (treino de modelo custom em 5–100 imagens), 750+ modelos de 50+ providers, 3D/vídeo/texturas, Unity plugin, skills open-source declaradas no site; free tier 50 créditos/dia **pessoal/avaliação**; Starter $15/mo; Pro $45/mo (treino); Max $75/mo — fontes web out/2026; verificar <https://scenario.com>.
- **Integração Forge:** melhor caso de "consistência de estilo por estúdio" da indústria; é SaaS, logo **consentimento + classificação de dados + orçamento** são pré-condição; sem plano gratuito comercial. RESEARCH ONLY hoje; ADAPT remoto após decisão.

### C8. `Ludo.ai` — API/MCP/CLI; RESEARCH ONLY/ADAPT remoto
- **Site:** <https://ludo.ai> · planos: Indie **$20/mês** (250 créditos, inclui API+MCP+CLI), Pro $50/mês; resultados de API/MCP **retidos só 7 dias** — baixar/artifacts no ato; verificar preços no site.
- **Capacidades reais:** sprites, sprites animados (até 3 keyframes/texto/vídeo/presets), 8-direções (beta), tilesets, UI, música/SFX, vozes, 3D com rig e animação (nomes de ossos Mixamo/Unity/Unreal/Godot/Rigify/HumanIK/VRM), vídeo; ~12¢/sheet estimado em reviews (terceiros).
- **Integração Forge:** um único contrato remoto cobre muito do pipeline 2D+3D+áudio; risco = crédito, retenção de 7 dias, qualidade variável ("topology often messy" em review independente). RESEARCH ONLY hoje; ADAPT remoto após decisão.

### C9. `Hyper3D Rodin` (Deemos) — API/MCP; RESEARCH ONLY/ADAPT remoto
- **Docs:** <https://developer.hyper3d.ai> · **Preços:** pay-per-generation (Gen-2: 0,5 crédito base; HighPack +1); Creator $30/mês, Business $120/mês (API/MCP, licença de avatar); verificar <https://hyper3d.ai>.
- **Capacidades reais:** imagem/texto→3D (STL/FBX/OBJ/GLB/USDZ), quad meshes, ControlNet, partial edit, textures 4K; "Rodin MCP server" oficial; plugins Blender/Unity/Unreal.
- **Integração Forge:** equivalente de alta qualidade ao C5/C8; mesmo bloco de decisão remota. RESEARCH ONLY hoje; ADAPT remoto após decisão.

### C10. `nanayax3/krita-mcp` · `SanSaSane/krita-mcp` · `cyyprezz/krita-codex-mcp` — ADAPT candidato (local)
- **Links:** <https://github.com/nanayax3/krita-mcp> — MIT, ★53, push 2026-02-26 · <https://github.com/SanSaSane/krita-mcp> — CC0-1.0, ★13, push 2026-10-23 · cyyprezz/krita-codex-mcp — licença não lida.
- **Capacidades reais:** operam Krita via API Python (camadas, filtros, cores, seleção) — desenho assistido por agente numa ferramenta real de pintura.
- **Limitações:** maturidade muito baixa; Krita é GPL-3.0 (processo separado ok); "fix for …" no nanayax3 sugere manutenção reativa; testes escassos.
- **Integração Forge:** candidato de **piloto local** para "2D Artist" operar Krita com gates; exige sandbox/allowlist como C1. ADAPT candidato (pilotar, não promover).

### C11. `diivi/aseprite-mcp` · `willibrandon/pixel-mcp` · `ext-sakamoro/AsepriteMCP` — ADAPT candidato (local)
- **Links:** <https://github.com/diivi/aseprite-mcp> — MIT, ★993, push 2026-11-03 · <https://github.com/willibrandon/pixel-mcp> — MIT, ★160, push 2025-10-18 · ext-sakamoro/AsepriteMCP — MIT (busca).
- **Nota de licença do editor:** **Aseprite é source-available e pago** (~US$ 20 na loja oficial/Steam; compilação própria exige EULA de não redistribuição). O MCP é MIT; o editor não é.
- **Capacidades reais:** sprites via API/CLI do Aseprite (desenhar, frames, tags, atlas export).
- **Integração Forge:** rota real de **pixel art assistida por agente** local; depende de o usuário ter Aseprite licenciado (detecção via `doctor`). ADAPT candidato.

### C12. Godot MCP — ADAPT candidato (local, MIT/Apache-2.0)
- **Links:** <https://github.com/Coding-Solo/godot-mcp> — MIT, ★6.636, push 2026-04-16 (lançar editor, rodar projeto, capturar output — foco execução/debug, poucas operações de autoria) · <https://github.com/tugcantopaloglu/godot-mcp> — MIT, ★512 (157 tools, testado em Godot 4.7) · <https://github.com/IvanMurzak/Godot-MCP> — Apache-2.0, ★341, push 2026-11-14 (C#; plugin + cloud `ai-game.dev` — **rejeitar a cloud**, usar só local).
- **Integração Forge:** úteis para **QA de importação** (abrir cena Godot headless, rodar validação, screenshot) e para execução de cenas de UI/VFX; Godot 4.7 já é MIT e leve — candidato natural de destino/exec headless. ADAPT candidato (local-only; desabilitar qualquer cloud embutida).

### C13. Unity MCP — ADAPT candidato (editor proprietário necessário)
- **Link:** <https://github.com/CoplayDev/unity-mcp> — MIT, ★15.958, push 2026-10-30 (bridge AI↔Editor Unity: cenas, assets, scripts, testes).
- **Dependências/termos:** Unity Editor (pessoal gratuito abaixo de limiar de receita — verificar termos vigentes); download pesado; .NET; sem execução headless trivial em CI sem licença.
- **Integração Forge:** só quando o destino declarado for Unity; o adapter é opcional e separado. ADAPT candidato (condicional ao destino).

### C14. Unreal MCP — ADAPT candidato (misto; nenhum oficial da Epic)
- **Links:** <https://github.com/chongdashu/unreal-mcp> — **sem licença** (API `NONE`), ★2.117, push 2025-04 — popular mas **BLOCKED por licença** · <https://github.com/ChiR24/Unreal_mcp> — MIT, ★1.035, push 2026-11-13 — ADAPT candidato · <https://github.com/flopperam/unreal-engine-mcp> — sem licença, ★1.117 — BLOCKED · <https://github.com/winyunq/UnrealMotionGraphicsMCP> — nichado (UMG).
- **Termos do editor:** UE royalty-free até US$1M/ano de receita de produto; depois 5% — verificar EULA vigente.
- **Integração Forge:** condicional ao destino Unreal; preferir `ChiR24/Unreal_mcp` se/quando necessário; jamais os sem licença. ADAPT candidato (condicional).

### C15. Figma MCP (oficial) e `GLips/Figma-Context-MCP` (Framelink) — RESEARCH ONLY / ADAPT candidato (UI, não assets)
- **Oficial:** remoto `https://mcp.figma.com/mcp` ou desktop (Dev Mode, porta 3845); GA desde out/2025; leitura de contexto (variáveis, componentes, layout, Code Connect) gratuita; write-back em beta e futuro pago; seats/planos Figma — fontes web (set/nov 2026).
- **Framelink:** <https://github.com/GLips/Figma-Context-MCP> — MIT, ★16.203, push 2026-10-27 (servidor local que expõe dados Figma para codegen).
- **Integração Forge:** útil no eixo **UI/HUD de jogo** (design → tokens → implementação), não no eixo de assets; candidato ADAPT para o painel/HUD e sites de destino; RESEARCH ONLY para o fluxo central de assets.

### C16. `modelcontextprotocol/servers` (referência oficial) — REFERENCE
- **Link:** <https://github.com/modelcontextprotocol/servers> — transição MIT→Apache-2.0 em curso (arquivo `LICENSE` lido), ★91.976, push 2026-11-12.
- **Conteúdo:** servidores de referência (fetch, git, filesystem…); filesystems MCP externos **não** substituem as permissões próprias da Forge. REFERENCE de API/empacotamento; nada a instalar.

### C17. `Comfy-Org/comfy-mcp` reclassificado vs. C2/C3 — ver C2. (Mantido separado para não duplicar.)

## Parte D — Pipelines/agentes de geração integrados (end-to-end ou quase)

### D1. `SifuInTheShell/Effigy` — REFERENCE (verdade arquitetural, já mapeado na T9)
- **Link:** <https://github.com/SifuInTheShell/Effigy> · **Licença:** MIT · **Snapshot:** ★260, push 2026-11-13 (revalidado 2026-11-14); pipeline Reference→Generate→Clean→Simplify→Unwrap→Bake→Rig→Animate→Check→Export; GPU lock; licenses.yaml por componente; servidor MCP; spritesheet pixel-art 2D→Godot/Unreal.
- **Desta T14:** confirma-se como **padrão de referência** para o que a Forge quer ser; aproveitar **conceitos** (etapas versionadas, `licenses.yaml` por asset, MCP como superfície), nunca código sem revisão completa. REFERENCE.

### D2. `wangchaozhi/game-asset-agent` — RESEARCH ONLY (ver A27)
- Pipeline diretor→prompt→motor→revisor com retry e custo/uso; sem licença; ★0. Estudar o **shape** do loop de correção; implementação independente apenas se/quando a Forge decidir ter agente-revisor equivalente.

### D3. `neilsonnn/image-blaster` — RESEARCH ONLY (já mapeado)
- MIT, ★tempo; inativo desde 2026-05-15; convenções disk-first/linhagem; providers cloud. Ver `EXTERNAL-REPOSITORY-RESEARCH.md` itens 13–16. RESEARCH ONLY.

### D4. `Blizaine/Maestro` — NOT RECOMMENDED (já decidido na T7)
- Licença não-comercial veda componente; CUDA-only; ver item 13 da pesquisa externa. NOT RECOMMENDED.

### D5. `Mixar-AI/mixar-app` — RESEARCH ONLY (já mapeado na T9)
- GPL-3.0, ★597; agente-em-DCC sobre Blender (controle multiagente no Blender, assinaturas ChatGPT/local). Processo separado obrigatório; maturidade "AI-em-DCC" útil como estudo de UX. RESEARCH ONLY.

### D6. `ATH-MaaS/Pixelle-MCP` — REFERENCE (ver C4)

### D7. `TRELLIS.2` / `Pixal3D` / `trellis.cpp` / `pixal3d.cpp` — ADAPT candidato (constraints T9/T10)
- Já mapeado: código MIT (upstream) / MIT (ports C++/GGML Vulkan/ROCm); **pesos com licença própria** (GGUF sem card claro); gfx803 RX 580 **sem suporte declarado**; trellis.cpp cascade 1024 exige 16 GB. Qualquer adoção: decisão humana + probe local (T10/T11) + direitos de pesos verificados. ADAPT candidato, hardware-condicionado.

### D8. Auto-rig candidatos: `VAST-AI-Research/UniRig` — RESEARCH ONLY
- **Link:** <https://github.com/VAST-AI-Research/UniRig> · **Licença:** MIT (API 2026-11-14) · **Snapshot:** ★2.107, push 2026-06-04; SIGGRAPH 2025.
- **Capacidades reais:** UNIRIG/elecia — esqueletização+skinning automáticos diversos skeletons.
- **Limitações:** pesquisa; exige GPU NVIDIA CUDA no caminho documentado (preset oficial); `unknown` em Vulkan/CPU/RX 580; pesos com termos próprios a verificar.
- **Integração Forge:** referência para "rig3d.auto"; Kimodo/MotionBricks (T9/T12) cobrem movimento. RESEARCH ONLY (requer validação de hardware e de pesos antes de qualquer candidato a ADAPT).

### D9. `Tencent-Hunyuan/Hunyuan3D-2` — RESEARCH ONLY (já decidido na T8)
- Tencent Hunyuan 3D 2.0 Community License; **território exclui UE/UK/KR**; não atualizado desde 2025-10-28; ★15.399; caminho oficial exige GPU considerável. Ver T8/T9. RESEARCH ONLY.

### D10. `stability-ai/stable-fast-3d` (SF3D) — RESEARCH ONLY
- **Link:** <https://github.com/stability-ai/stable-fast-3d> · **Licença (API/arquivo):** Stability AI Community License (uso comercial < US$1M/ano sob condições; não é OSI) · **Snapshot:** ★1.934, push 2025-01-22, sem releases.
- **Integração Forge:** inativo há ~22 meses; license gate para uso amplo; RESEARCH ONLY; nenhuma rota prevista.

### D11. `gamedev-skills`-derived geração completa — ver Parte B. Não há pipeline pronto "prompt→asset game-ready" open-source de qualidade confiável hoje; as melhores peças são conhecidas e mapeadas (Effigy D1, ComfyUI+Blender+TRELLIS.2) — **a composição é trabalho da Forge, não de um repo externo**.

### D12. `heygen-com/hyperframes` — ADAPT candidato (vídeo determinístico; já mapeado T7 item 16)
- Apache-2.0 (análise T7: telemetria a desligar; Node 22+FFmpeg+Chrome headless; ~450 itens de catálogo de blocos a auditar por SBOM). Único uso Forge plausível: **trailers/cutscenes de marketing**, não gameplay. ADAPT candidato para vídeo opcional; decisão humana.

## Parte E — Provedores remotos comerciais (serviços, não componentes)

Todos exigem: consentimento por chamada, dados classificados (nunca privado/secreto), limite de custo declarado, download imediato dos artifacts (retenção típica curta — Ludo: 7 dias), e **nunca** credenciais no repo. Preços de fontes web (out–nov/2026): **verificar no site antes de qualquer decisão**; não constituem homologação.

| # | Serviço | Licença das saídas / termos | Preço de entrada | MCP oficial? | Classificação |
|---|---|---|---|---|---|
| E1 | **Meshy** (<https://meshy.ai>) | Free: CC-BY-4.0 + público; pagos: comercial privado | Free 100 cr/mês; Pro $20; Premium $40; Studio $70; Ultra $100 | Sim (wrapper não-oficial MIT C5; MCP "oficial" declarado na review — confirmar no site) | ADAPT remoto (consentido) |
| E2 | **Tripo3D** (<https://www.tripo3d.ai>) | Free: CC-BY-4.0, público, **sem uso comercial**; Pro: comercial | Free 200–300 cr; Pro $19,90–20/mês (3.000 cr); API 1 cr=$0,01; text-to-3D ~$0,10 | API oficial; MCP via terceiros | ADAPT remoto (consentido) |
| E3 | **Scenario** (<https://scenario.com>) | Free: pessoal/avaliação; pagos: licença comercial plena | Free 50 cr/dia; Starter $15; Pro $45 (treino custom); Max $75 | **Sim** (`mcp.scenario.com/mcp`) | ADAPT remoto (consentido) |
| E4 | **PixelLab** (<https://www.pixellab.ai>) | Saídas do usuário, uso comercial permitido, **exceto treinar modelos** | Trial 40 + 5/dia; $12/$24/$50; **Pixel Novice (BR) $5** | **Sim** (`api.pixellab.ai/mcp`, ~100 tools) | ADAPT remoto (consentido) |
| E5 | **Ludo.ai** (<https://ludo.ai>) | Termos Ludo (verificar); retenção API 7 dias | Indie $20 (250 cr); Pro $50; API+MCP+CLI incluídos | **Sim** | ADAPT remoto (consentido) |
| E6 | **Hyper3D Rodin** (<https://hyper3d.ai>) | Avatar/uso: plano Business ($120) para API avatar; verificar | Pay-per-gen; Creator $30; Business $120 | **Sim** (declarado) | ADAPT remoto (consentido) |
| E7 | **Leonardo.ai** (<https://leonardo.ai>) | Freemium; free público; pagos privados/comercial | Free tier; pagos (verificar) | Não confirmado | RESEARCH ONLY |
| E8 | **Layer.ai** | SaaS corporativo (verificar termos) | Não verificado nesta tarefa | Não confirmado | RESEARCH ONLY |
| E9 | **Retro Diffusion** (web, API/MCP, Aseprite ext ~US$65; também hospedado no Scenario) | Web (set/nov-2026): uso comercial **permitido** nos termos publicados; pay-per-image ~US$0,015–0,18; verificar o plano efetivo | por imagem | Sim (declarado) | RESEARCH ONLY (SaaS pago) |
| E10 | **Figma MCP** (<https://www.figma.com>) | Seats Dev Mode; leitura GA grátis; write beta | Plano Figma conforme seat | **Sim** (oficial) | RESEARCH ONLY (UI) |
| E11 | **Replicate / fal.ai** (agregadores de modelos) | Por modelo; muitos **non-commercial** (FLUX dev, SD3.5 etc.) | Pay-per-run | Não (HTTP) | RESEARCH ONLY — cada modelo exige verificação própria |
| E12 | **ElevenLabs** (SFX/voz) | Termos próprios; free limitado; comercial pago | Free + planos | Community MCPs | RESEARCH ONLY (áudio fora do escopo atual) |

**Regra de produto:** a Forge não escolhe provider por popularidade; escolhido um, o plano mostra explicitamente **quais dados saem, quanto custa, o que fica retido e o que a licença permite**, e aguarda autorização.

## Parte F — Ambientes, terreno e procedural

### F1. `princeton-vl/infinigen` — RESEARCH ONLY
- **Link:** <https://github.com/princeton-vl/infinigen> · **Licença:** BSD-3-Clause (API) · **Snapshot:** ★7.422, push 2026-11-11.
- **Capacidades reais:** geração procedural de mundos naturais fotorrealistas em **Blender** (florestas, terreno, edifícios opcionais "Infinigen Indoors"); Python + Blender headless; export glTF/USD via Blender.
- **Dependências:** Blender (GPL-3.0, processo separado), Python, registos científicos; alguns assets/texturas têm termos próprios a auditar antes de redistribuição em jogo.
- **Hardware:** CPU alto + RAM; sem GPU CUDA obrigatório (Cycles renders lentos); 16 GB RAM no alvo = possível com qualidade/resolução reduzidas.
- **Integração Forge:** a única fonte aberta séria de "natureza procedural" para cenários; enorme superfície de dependência; resultado é **fundo/props de ambiente**, não nível jogável. RESEARCH ONLY → candidato ADAPT futuro (processo headless Blender + QA de escala/bounds) se/quando destinos de cenário forem priorizados.

### F2. `allenai/Holodeck` — RESEARCH ONLY
- **Link:** <https://github.com/allenai/Holodeck> · **Licença:** Apache-2.0 (API) · **Snapshot:** ★582, push 2025-04-02; CVPR 2024.
- **Capacidades reais:** linguagem natural → layouts 3D de interiores (AI2-THOR); pesquisa embodied-AI.
- **Limitações:** objetos vêm de datasets com **licenças próprias mistas** (não adequados direto para jogo comercial); geometria placeholder; sem pipeline de engine.
- **Integração Forge:** referência de "prompt→layout" para cenários; RESEARCH ONLY.

### F3. `allenai/procthor` · `allenai/ai2thor` — RESEARCH ONLY
- Apache-2.0, ★484 (2023-04-07) e ★1.830 (2025-11-04). Simuladores de ambiente para pesquisa; não exportam assets de jogo. RESEARCH ONLY.

### F4. Destinos/DCC para cenário já conhecidos da Forge: Blender (manual), Godot, Unity, Unreal — cobertos na T12. Terrain comercial (Gaea, World Machine, Houdini Indie) = fora de pesquisa de código aberto; registrar como opção humana futura.

### F5. VFX (lacuna): **nenhum** pipeline aberto "descrição→VFX de jogo" foi encontrado. O estado da arte aberto relevante: motores de partículas in-engine (Godot `GPUParticles2D/3D`, Unity VFX Graph, Unreal Niagara) + spritesheets procedurais (já na Forge) + previsões locais de partículas (fora de escopo). **VFX permanece lacuna da Forge** (ver arquitetura §Lacunas L6).

## Parte G — QA, avaliação e revisão

### G1. `promptfoo/promptfoo` — REUSE candidato (dev-tooling) — ver A21.
### G2. `confident-ai/deepeval` — REFERENCE — ver A22.
### G3. `Arize-ai/phoenix` — NOT RECOMMENDED (ELv2) — ver A23.
### G4. `mlfoundations/open_clip` (OpenCLIP) — RESEARCH ONLY (métrica de consistência)
- **Link:** <https://github.com/mlfoundations/open_clip> · **Licença (arquivo lido 2026-11-14):** texto MIT clássico (grant + NO WARRANTY), mas sem o título "MIT License" — GitHub reporta `NOASSERTION`; **pesos CLIP são da OpenAI (termos próprios)**. **Snapshot:** ★14.263, push 2026-11-10.
- **Uso plausível:** embedding de imagens para **similaridade estilo/consistência** entre concept↔asset (QA automático), rodando local CPU.
- **Integração Forge:** apenas como experimento opt-in; pesos+licença a auditar. RESEARCH ONLY.

### G5. VLMs locais para co-revisão visual — RESEARCH ONLY
- **Verificadas em repositório (2026-11-14):** `QwenLM/Qwen2.5-VL` redireciona para `QwenLM/Qwen3-VL` — **Apache-2.0**, ★20.211, push 2026-01-30 (código; termos dos pesos conferir no card HF) · `vikhyat/moondream` redireciona para `m87-labs/moondream` — **Apache-2.0**, ★10.160, push 2026-04-20. **Não verificadas:** SmolVLM (pesos/código HF, fora do alcance desta sessão) e InternVL. Qualquer VLM permanece experimento opt-in.
- **Viabilidade RX 580/CPU:** modelos 2B Q4 (~1,5–2 GB) plausíveis em CPU/Vulkan; 7B Q4 (~4,5 GB) lento em CPU; `unknown` até probe. **Nunca substitui gate humano**; no máximo legenda/flag para o revisor. RESEARCH ONLY.

### G6. Validação estrutural (não-LLM): ver T11-E3 (proposta de validação de conteúdo compartilhada: alpha real, bbox, paleta, tiling, tri count, UV overlap) — a Forge pode implementar **sem IA** grande parte do QA técnico; é a rota prioritária.

## Parte H — Runtimes locais e handoff (suporte à execução offline)

### H1. `ollama/ollama` — REUSE candidato (se a Forge decidir embutir runtime LLM algum dia)
- MIT (API), ★186.898, push 2026-11-14. Servidor local de modelos (Llama/Qwen/…), API estável, baixa fricção no Windows. Hoje a Forge **não tem runtime LLM embutido**; se aprovado um dia, é a peça menos intrusiva. REUSE candidato.

### H2. `ggml-org/llama.cpp` — REUSE candidato (idem; também via binding direto)
- MIT (API), ★134.879, push 2026-11-13. Backend Vulkan/CPU (CUDA opcional); GGUF Q4 permite 7B–8B em 8–16 GB RAM; referência de desempenho local em Polaris é `unknown` sem probe. REUSE candidato.

### H3. Claude Agent SDK / Claude Code — REFERENCE (handoff); não OSI — ver A26.

## Parte I — Vídeo/mídia adjacente (fora do núcleo de assets)

- **HyperFrames** — ver D12 (ADAPT candidato; Apache-2.0; T7).
- **Runtimes ComfyUI de vídeo (Wan2.x, HunyuanVideo)** — licenças comunitárias variadas (Hunyuan Community License exclui UE/UK/KR); VRAM muito acima do alvo → fora.
- Nenhuma outra solução de mídia generalista se qualifica para o alvo hardware sem GPU adequada.

## Parte J — Resumo de classificação

Contagem por classe (entradas primárias desta revisão, excluindo referências cruzadas puras):

| Classe | Itens |
|---|---|
| REUSE (candidato) | promptfoo (dev-only), ollama, llama.cpp |
| ADAPT (candidato local) | mcp-for-blender, comfyui-mcp (artokun), comfyui-mcp-server (joenorton), krita-mcp (nanayax3), krita-mcp (SanSaSane), aseprite-mcp (diivi), pixel-mcp (willibrandon), godot-mcp (Coding-Solo), godot-mcp (tugcantopaloglu), Godot-MCP (IvanMurzak, local-only), unity-mcp (condicional), ChiR24/Unreal_mcp (condicional), Figma-Context-MCP (UI) — **13 itens** |
| ADAPT (candidato remoto, consentido) | meshy-mcp-server, Meshy/Tripo3D/Scenario/PixelLab/Ludo/Hyper3D (serviços) |
| ADAPT (conteúdo, curadoria) | awesome-gamedev-agent-skills, blender-skills, sprite-gen (utilitários) |
| REFERENCE | LangGraph, CrewAI, OpenAI Agents SDK, Google ADK, MetaGPT, AgentScope, smolagents, Semantic Kernel, LlamaIndex, Langflow, Temporal, Node-RED/Prefect/Airflow, Griptape, deepeval, A4–A26 handoffs, ComfyUI-MCP oficial (boletim), Pixelle-MCP, modelcontextprotocol/servers, Effigy, anthropics/skills (formato), Holodeck/ProcTHOR (conceito) |
| RESEARCH ONLY | CAMEL, Mastra, TaskWeaver, Swarm, game-asset-agent, image-blaster, Mixar, PixelLab (código), Figma MCP, Leonardo/Layer/RetroDiffusion/Replicate/fal, Hunyuan3D-2, SF3D, UniRig, infinigen, Holodeck, OpenCLIP, VLMs, A2A |
| BLOCKED | Comfy-Org/comfy-mcp (AGPL/comercial dual), pixellab-mcp/pixellab-python (sem licença), chongdashu/unreal-mcp e flopperam/unreal-engine-mcp (sem licença), 2DAutoRigger (T11/T12: SPDX divergente + pesos gated), spine-animation-ai (PolyForm NC, T11) |
| NOT RECOMMENDED | Flowise (arquivado), n8n (fair-code), Windmill (AGPL), AutoGPT (Polyform Shield), Phoenix (ELv2), Maestro (licença NC + CUDA, T7), meshlib/nvdiffrast (NC, T9) |

**Nenhuma adoção está autorizada; a revisão humana é pré-condição para qualquer ADAPT/REUSE.**
