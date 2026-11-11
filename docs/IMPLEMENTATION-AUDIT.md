# Lia Forge — auditoria de documentos e capacidades do código

**Snapshot da auditoria:** 2026-11-06 (fuso America/Sao_Paulo)
**Branch:** `arena/649f88bd-3dspritesheet` — status `active`
**HEAD no início da tarefa:** `13dc4c7d2fde28f9324fd929482948ba34a87abf` (`Initial commit`, 2026-10-25)
**Baseline remoto observado:** `origin/main` em `e9887118f9826e112e594b5c154a6b151071a0e6`; checkout shallow.
**Working tree no início:** `README.md` já modificado (diff preexistente de aproximadamente 110 linhas) e **92 caminhos não rastreados**. Não havia autorização para limpar, mover, descartar, stagear, commit ou push. O checkout divergia do estado histórico `f274b01`; não se presume continuidade daquele commit. Todos os arquivos preexistentes foram tratados como material do usuário. Esta consolidação altera somente documentação.

**Estado Git ao finalizar:** branch e `HEAD` permanecem iguais; zero arquivos staged, nenhum commit/push; `README.md` segue modificado e há 105 caminhos não rastreados — os 92 preexistentes mais os 13 documentos novos desta tarefa.

## Método e significado dos estados

Foram cruzados documentos, configuração, código-fonte, testes disponíveis e metadados/fontes públicas dos nove repositórios solicitados. Para os projetos externos, foram lidos endpoints/arquivos públicos do GitHub sem clone; a pesquisa é datada e não constitui auditoria de segurança completa, execução, parecer jurídico ou aceitação de licença.

- **`IMPLEMENTED`** — código executável para a capacidade nomeada existe no checkout; não significa que rodou no ambiente-alvo.
- **`VERIFIED`** — somente o comportamento estreito indicado tem evidência de teste/aceitação registrada para inputs e ambiente identificados. Não significa qualidade artística, estabilidade geral ou compatibilidade de outra plataforma.
- **`PARTIALLY_IMPLEMENTED`** — existe um subconjunto real, com etapas/contratos/gates importantes ausentes.
- **`DOCUMENTED`** — a informação/rota está em documentos, sem executor correspondente comprovado.
- **`PLANNED`** — parte da visão/roadmap aceita, sem implementação neste checkout.
- **`EXPERIMENTAL`** — protótipo ou ensaio delimitado, não um caminho de produção estável.
- **`BLOCKED`** — a execução/verificação nomeada não pode avançar até uma dependência, decisão, ambiente ou autorização explícita ser resolvida.
- **`PROPOSED`** — recomendação arquitetural sujeita a decisão; não é compromisso nem código.

O estado se refere à capacidade delimitada de cada linha. A coluna de teste separa teste sintético/de código de execução real. Nenhuma linha baseada em documentação é promovida a `IMPLEMENTED`.

## Matriz de capacidades

| Capacidade delimitada | Estado | Evidência no checkout | Teste/evidência e limite atual |
|---|---|---|---|
| Aplicação desktop e UI React | `IMPLEMENTED` | `package.json`, `electron/main.cjs`, `electron/preload.cjs`, `src/App.jsx` | Shell/rotas IPC estão codificados. Build/UI de produção e instalador não foram validados em Windows neste snapshot. Pré-visualizações de modelo/rig/spritesheet são guias ilustrativos, não viewers de artefatos. |
| Projeto/workspace local e persistência de assets | `PARTIALLY_IMPLEMENTED` | `electron/paths.cjs`, `electron/main.cjs`, `.spriteforge/assets.json` (gerado em workspace), `scripts/lia_paths.py` | Persistência JSON em `.spriteforge/assets.json` e roots configuráveis. Só `character`/`item`; sem banco/version graph, busca completa, migração geral ou seletor visual de raiz. |
| Taxonomia e catálogo de categorias | `PARTIALLY_IMPLEMENTED` | `electron/main.cjs` valida `character`/`item`; `electron/manual-artifacts.cjs`; `docs/asset-task.schema.json`; MCP em `scripts/spriteforge-mcp.mjs` | Personagens e itens são reconhecidos. Ambientes, sprites/tiles/UI, materiais e categorias de plugin não são entidades de runtime. |
| Registro manual de arquivos reais por etapa | `IMPLEMENTED` | `electron/manual-artifacts.cjs`, handlers IPC em `electron/main.cjs`, `scripts/spriteforge-mcp.mjs` | Paths relativos e extensões esperadas; exige arquivos existentes e outputs em certos formatos. Isso não valida semântica nem qualidade visual. |
| Geração de imagem-conceito pelo ComfyUI | `IMPLEMENTED` | `scripts/comfyui-client.mjs`; adapter `comfyui-concept` em `electron/main.cjs`; `workflows/comfyui/*` | Requer endpoint e checkpoint já instalado escolhido pelo usuário; envio explicitamente acionado; salva PNG estrutural. Smoke HTTP simulado não equivale a execução real. Não gera prancha ortográfica/modelo/rig. |
| Diagnóstico/consulta ComfyUI | `IMPLEMENTED` | `scripts/comfyui-client.mjs`; `electron/main.cjs`; `src/App.jsx` | Código consulta stats, fila, devices/model folders reportados. O endpoint é consultado pelo processo local; resposta não prova compatibilidade do workflow nem desempenho. |
| Render de spritesheet no Blender a partir de modelo existente | `IMPLEMENTED` | `electron/blender-adapter.cjs`, `electron/blender-workflow-plan.cjs`, `scripts/blender_spritesheet.py`, adapter em `electron/main.cjs` | Código invoca Blender sem shell e exige PNG + JSON estruturais. Não foi renderizado Blender real nesta auditoria; Action/Slots, armature, cenário e aparência dependem de inspeção no target. |
| Harness de teste local do renderer (tarefa anterior, fora do escopo atual) | `EXPERIMENTAL` | `local-renderer-test/README.md`, scripts e manifestos | É um ensaio condicionado a inputs/licença/hardware; não é uma capability de produção do Studio. Não foi executado/reaberto nesta missão documental. |
| Contrato de pipeline humanoide | `PARTIALLY_IMPLEMENTED` | `electron/workflow-contracts.cjs`, `docs/asset-task.schema.json` | Plano declara views → 3D → rig → animação → render e bloqueia provider ausente. Não há adapters executáveis de views, geração 3D, auto-rig ou animação. |
| Executor de workflows ordenados | `PARTIALLY_IMPLEMENTED` | `electron/workflow-runner.cjs` | Valida contratos, pré-requisitos em ordem, autorizações, revisão, progresso de adapter, artefatos e falhas. A execução é serial pela ordem da lista; `dependsOn` não constitui scheduler geral de DAG/parallelismo. |
| Engine geral baseado em grafo | `PLANNED` | Arquitetura-alvo em [`WORKFLOW-ENGINE.md`](WORKFLOW-ENGINE.md) | Não há scheduling por grafo, cálculo de subgrafo em runtime, locks por recurso ou execução paralela controlada. |
| Snapshot local de runs e reuso/retomada | `PARTIALLY_IMPLEMENTED` | `electron/workflow-run-store.cjs`, `electron/workflow-runner.cjs`, `electron/resume-workflow.cjs` | Há JSONs locais, fingerprints/checksums e revalidação de outputs. A rota de retomada persistida exposta pelo desktop é limitada ao workflow Blender de um estágio; task remota ambígua não é reconciliada automaticamente. |
| Validação estrutural de PNG/manifesto/outputs | `PARTIALLY_IMPLEMENTED` | `electron/png-validation.cjs`, `electron/spritesheet-manifest.cjs`, validadores em `electron/workflow-runner.cjs` | Confere estrutura de PNG, dimensões, grade, contratos, paths e checksums em contextos definidos. Não certifica transparência visual real em todos os caminhos, arte, qualidade, rig, identidade ou compatibilidade no jogo. |
| Comportamento estreito dos helpers nas fixtures dos smoke tests | `VERIFIED` | `tests/manual-artifacts-smoke.cjs`, `tests/workflow-runner-smoke.cjs`, `tests/workflow-run-store-smoke.cjs`, `tests/blender-adapter-smoke.cjs` e outros smoke tests | Os 12 smoke tests Node listados abaixo passaram no sandbox. Escopo restrito às fixtures/helpers; não prova renderer/ComfyUI real, build, plataforma, qualidade visual ou estabilidade de release. |
| QA visual sistemático e aprovação registrada | `PLANNED` | Critérios documentados em `docs/usage-workflows.md` e `docs/agent-workflow.md` | Não há pipeline geral de contato visual, revisão com identidade/versionamento, métricas visuais ou gate formal para as categorias-alvo. Revisão humana continua obrigatória por política, não substituída por score. |
| Handoff/MCP opcional | `PARTIALLY_IMPLEMENTED` | `scripts/spriteforge-mcp.mjs`, `scripts/mcp_config.py`, `docs/mcp.md` | Servidor expõe ferramentas de status, assets e preparação/registro de tarefa. Não é um agente interno; MCP não cria os outputs de geração 3D/rig/animação. Requer dependência instalada para execução real. |
| Intelligent Orchestrator genérico | `PLANNED` | `electron/workflow-contracts.cjs` é uma lista estática/contratual; ver `docs/INTELLIGENT-ORCHESTRATOR.md` | Não interpreta intenção em todas as categorias, não descobre e compara providers e não produz plano geral baseado em capabilities. |
| Tool/Provider Hub e catálogo versionado | `PLANNED` | Adapters pontuais em `electron/main.cjs`; ferramentas detectadas em `electron/external-tools.cjs`; `spriteforge.config.json` | Não existe registry de plugins/providers genérico. `models: []`; detecção/abertura de Blender/Krita não equivale a adapter de produção. |
| Manifesto final de plugins/providers e política de instalação | `PROPOSED` | Esboço conceitual em `docs/TOOL-PROVIDER-HUB.md` | Campos/permissões/pinning foram propostos para discussão; nenhum formato ou contrato final foi aprovado/implementado. |
| Skills & Knowledge Engine em runtime | `PLANNED` | `.agents/skills/lia-brand-check/SKILL.md`, `.claude/rules/interface.md`, docs de handoff | Os arquivos encontrados são instruções de marca/interface/contribuição, não catálogo/roteador de skills de produção de assets usado pelo app. |
| Gestão de proveniência/licenças de todos os assets | `PARTIALLY_IMPLEMENTED` | `THIRD_PARTY_NOTICES.md`, `scripts/spriteforge_launcher.py`, `electron/workflow-runner.cjs`, `local-renderer-test/manifests/source-license-manifest.json` | Há registro/aceite de modelos no downloader auxiliar e checksums em runs; catálogo vazio. Não há lineage/licença por asset em todas as rotas nem aceite universal. O harness `local-renderer-test/` é separado e não foi retomado/executado nesta tarefa. |
| Versionamento e comparação de versões de assets | `PLANNED` | Alvo em [`ASSET-MANAGEMENT.md`](ASSET-MANAGEMENT.md) | JSON de estado e logs não são histórico imutável de versões/derivações; não há version graph ou ferramenta de comparação. |
| Benchmark e comparação de providers/workflows | `PLANNED` | Alvo em [`VISUAL-QA-BENCHMARK.md`](VISUAL-QA-BENCHMARK.md) | Nenhum benchmark medido foi produzido nesta tarefa; não há harness de comparação de rotas equivalente. |
| Brief → 2D, Manequim → 2D, code/procedural → 2D/3D, image → 3D, edit/conversion genérica, ambientes | `PLANNED` | Visão em `docs/usage-workflows.md` e [`ASSET-PIPELINES.md`](ASSET-PIPELINES.md) | São escopo documentado, sem rotas executáveis/selecionáveis no app atual. Apenas o conceito ComfyUI e render 3D existente cobrem partes isoladas. |
| Setup e downloader opcional de modelos | `PARTIALLY_IMPLEMENTED` | `scripts/spriteforge_launcher.py`, `scripts/lia_paths.py`, `spriteforge.config.json` | Há guardrails de HTTPS/checksum/aceite; lista vazia. `setup` pode instalar runtime/apps com confirmação; nesta missão nada foi instalado. O código não prova compatibilidade de hardware/provider. |
| Compatibilidade/hardware genérica e custo por etapa | `PARTIALLY_IMPLEMENTED` | ComfyUI pode reportar devices; contrato registra custo `unknown` e autorização em `electron/workflow-contracts.cjs` | Não existe detector universal nem matriz verificada para CUDA/ROCm/Vulkan/CPU/AMD. Custo/retention de serviços externos pode permanecer desconhecido e deve bloquear/solicitar decisão. |
| Instalador/execução de release no Windows | `BLOCKED` | `package.json` configura `electron-builder`/NSIS; documentação marca validação pendente | Build, instalação, upgrade/desinstalação e uso do app no Windows real não foram validados nesta tarefa. Não inferir estabilidade do manifest de build. |
| Pesquisa de providers/capabilities externas | `DOCUMENTED` | `docs/humanoid-workflow-research.md`, `docs/EXTERNAL-REPOSITORY-RESEARCH.md` | Reúne alternativas, metadados e limitações de fontes; não cria catálogo runtime, não seleciona provider e não autoriza instalação/uso. |
| Pipeline completo prompt → humanoide → animações → spritesheet | `BLOCKED` | Plano em `electron/workflow-contracts.cjs` | Falta escolha/autorização de providers e adapters executáveis. Nenhuma geração/rig/animação simulada foi produzida. |

## Discrepâncias documentais corrigidas ou explicitadas

| Documento/afirmação antiga | Estado observado | Tratamento nesta consolidação |
|---|---|---|
| `docs/product-gap-analysis.md` datado de 2026-10-28 diz não haver `AGENTS.md`, `.agents/` ou `.claude/`. | O snapshot tem `AGENTS.md`, `CLAUDE.md`, `.agents/skills/lia-brand-check/SKILL.md` e `.claude/rules/interface.md`. São instruções de contribuição/marca/interface; não há engine de skills de asset no runtime. | Corrigir o inventário e apontar esta matriz como fonte de verdade para código. |
| Guias `docs/guia-externo/` descrevem padrões de apps Lia e caminhos de instalação. | São material de referência/plano, não prova de que a Lia Forge usa aqueles mecanismos. | Preservar, rotular como referência e manter `docs/lia-ecosystem-integration.md` como adaptação do app atual. |
| `docs/usage-workflows.md`, `docs/agent-workflow.md` e `docs/humanoid-workflow-research.md` descrevem fluxos futuros e providers. | A documentação distingue partes pendentes; a lista de contratos não equivale a adapter. | Acrescentar links para a arquitetura e para esta auditoria; manter limites por etapa. |
| README/UI usam prévias ilustrativas de modelo/rig/spritesheet. | O código comenta explicitamente “not a model viewer”, “no animation player” e “guide only”. | Tratar como guia visual da interface, nunca como arquivo/output gerado. |
| Workspace atual difere da memória de push `f274b01`. | HEAD é `13dc4c7...`; muitos arquivos são não rastreados, mas fazem parte do workspace visível. | Não limpar, recuperar ou rebasear. Não stagear/commit/push. |
| `hunyuan3d/hunyuan3d` aparece como projeto Hunyuan3D. | O repo fornecido contém só README, não código nem licença; a implementação oficial Tencent está em outro endereço. | Corrigir com pesquisa individual em `EXTERNAL-REPOSITORY-RESEARCH.md`; não substituir silenciosamente nem aceitar termos. |

## Documentos lidos nesta auditoria

README atual; `docs/product-gap-analysis.md`, `usage-workflows.md`, `agent-workflow.md`, `lia-ecosystem-integration.md`, `comfyui.md`, `mcp.md`, `humanoid-workflow-research.md`, `asset-task.schema.json`, documentos de marca e referência externa; `AGENTS.md`, `CLAUDE.md`, `.agents/skills/lia-brand-check/SKILL.md`, `.claude/rules/interface.md`, `memory-bank/{estado,decisoes,padroes}.md`; metadata/configuração/package; módulos Electron, scripts de ComfyUI/Blender/MCP/launcher, workflows e inventário de testes. Pesquisa individual dos nove repositórios em [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md).

## Verificações desta consolidação

- **Smoke tests Node sem dependências externas:** 12 passaram — task manager, navigation guard, IPC guard, asset progress, manual artifacts, external tools, workflow runner, workflow run store, Blender plan, Blender adapter, Lia paths e ComfyUI client. Os testes do cliente/provider usam fixtures/servidor simulado, não ComfyUI real.
- **`npm test`:** bloqueado no primeiro script (`tests/mcp-smoke.mjs`), porque `@modelcontextprotocol/sdk` não está instalado no workspace (`ERR_MODULE_NOT_FOUND`). A suíte posterior da cadeia não foi executada por causa do `&&`.
- **`npm run build`:** bloqueado (`vite: not found`, exit 127). Não foi instalado dependência.
- **`python -m unittest discover -s tests -v`:** 30 testes, 29 passaram e 1 falhou: `test_installed_npm_tree_matches_lockfile`, porque `package_dependencies_ready()` é falso sem árvore npm instalada. Nenhuma instalação foi tentada.
- **Verificações estáticas:** `node --check` em 33 arquivos `.cjs`/`.mjs` passou; `python -m py_compile scripts/*.py tests/*.py` passou em 9 arquivos; JSON parse passou em 7 arquivos.
- **Documentação:** 94 links Markdown locais em 23 arquivos apontam para paths existentes; checagem de whitespace/tabs em 22 arquivos documentais alterados/criados não encontrou problemas; `git diff --check` passou para o diff rastreado. Links externos/fragments não foram fetchados/verificados. Os arquivos não rastreados foram checados separadamente, pois `git diff --check` não os inclui.
- **Não executado:** build/instalador ou inspeção visual em Windows, Blender real, ComfyUI real, providers/APIs remotos, performance, telemetria, custo ou revisão visual humana. O ensaio Mixamo/Blender de tarefa anterior não foi retomado.

Resultados de smoke/teste sintético não substituem execução na plataforma declarada nem revisão visual humana. Nenhuma dependência foi instalada.
