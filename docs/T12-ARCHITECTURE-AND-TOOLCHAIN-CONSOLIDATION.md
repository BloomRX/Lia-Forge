# T12 — Consolidação da arquitetura e da cadeia de produção do Lia Forge

> **Estado:** `CONSOLIDATION — PROPOSED`. Este documento **audita, consolida e propõe**. Nada foi implementado, integrado, instalado, baixado, licenciado ou executado além dos testes/validadores do próprio repositório e do `doctor` somente leitura.
> **Data da consolidação:** 2026-11-12 (UTC).
> **Base:** estado final da **T11** (commit `2f41360563fc47f6b447eed2c25b454c2b9db2f4`, ponta remota verificada nesta tarefa), não o estado histórico anterior.
> **Hierarquia respeitada:** [`ADR-001-LIA-FORGE-DECISIONS.md`](ADR-001-LIA-FORGE-DECISIONS.md) (`ACCEPTED — ARCHITECTURE ONLY`) > [`LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md`](LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md) > [`DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`](DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md) (`DRAFT_FOR_HUMAN_REVIEW`) > auditorias datadas.
> **Documentos irmãos desta tarefa:** [`T12-CAPABILITY-AND-TOOLCHAIN-MATRIX.md`](T12-CAPABILITY-AND-TOOLCHAIN-MATRIX.md), [`T12-PRODUCTION-WORKFLOW-MAP.md`](T12-PRODUCTION-WORKFLOW-MAP.md), [`T12-IMPLEMENTATION-ROADMAP.md`](T12-IMPLEMENTATION-ROADMAP.md).

---

## 0. Como ler esta consolidação

### 0.1 Vocabulário de estado (obrigatório e exclusivo)

| Estado | Significado | O que **não** significa |
|---|---|---|
| `IMPLEMENTED` | existe código executável no checkout para a responsabilidade nomeada | que rodou no alvo, que é completo, que foi aprovado |
| `PARTIAL` | existe código real, mas não cobre a responsabilidade completa | que a parte ausente esteja "quase pronta" |
| `DOCUMENTED_ONLY` | existe apenas em documentos (arquitetura-alvo, proposta, contrato conceitual) | que exista executor |
| `NOT_IMPLEMENTED` | não existe código nem documento que o declare pronto | que seja indesejável |
| `BLOCKED` | existe condição impeditiva identificada (hardware, licença, asset, decisão) | que seja inviável |
| `UNKNOWN` | não há evidência suficiente | que esteja funcionando |

### 0.2 Quatro coisas que nunca se confundem

1. **Implementação** — o código existe.
2. **Execução** — o código rodou, onde e com quais entradas.
3. **Validação** — o resultado foi medido contra um contrato, por teste ou verificador.
4. **Aprovação** — uma pessoa decidiu aceitar (revisão humana, licença, adoção, gasto).

Nenhuma linha deste documento promove pesquisa a capacidade, documento a código, teste sintético a execução real ou validação estrutural a avaliação visual.

### 0.3 Método desta auditoria

Leitura do código-fonte do **worktree atual** (não apenas documentos), execução real dos testes disponíveis no ambiente do agente, execução somente leitura do `doctor`, verificações estáticas (`node --check`, `py_compile`, parse JSON), comparação byte a byte entre worktree e árvore publicada, e pesquisa em fonte primária apenas para o item não registrado anteriormente (`MotionBricks`). Nenhuma dependência foi instalada; nenhum modelo/peso foi baixado; nenhuma API foi chamada; nenhum probe de GPU foi iniciado.

---

## 1. Base factual: Git, T11 e o estado real do repositório

### 1.1 Condição de início (§0 da T12) — verificada

| Verificação | Resultado |
|---|---|
| T11 concluída? | **Sim** — commit `2f41360` publicado, ponta remota da branch |
| Commits T9/T10/T11 ancestrais da ponta? | **Sim** — `46475ce` (T9), `93d240a` + `975567b` (T10), `2f41360` (T11) |
| T11 alterou contratos, schemas, runtime ou ferramentas? | **Não** — 9 arquivos: 7 em `docs/`, 1 script de diagnóstico novo (`tools/diagnostics/t11-windows-hardware-vulkan-preflight.ps1`) e 1 manifesto-exemplo sintético (`exampleOnly: true`) |
| T11 aprovou alguma decisão humana? | **Não** — bloco L registra 9 itens, todos `REQUIRES_HUMAN_DECISION`, `BLOCKED` ou `DECIDED` como registro de proposta |
| `origin/main` | `e9887118f9826e112e594b5c154a6b151071a0e6` — **intocado** |
| Branch de trabalho | `arena/649f88bd-3dspritesheet` (`active`) |

Os entregáveis T11 foram lidos integralmente nesta tarefa e são a base: [`T11-WINDOWS-RX580-VULKAN-COLLECTION.md`](T11-WINDOWS-RX580-VULKAN-COLLECTION.md), [`T11-E3-ASSET-PROVENANCE-AND-CONTENT-VALIDATION.md`](T11-E3-ASSET-PROVENANCE-AND-CONTENT-VALIDATION.md), [`T11-2D-SKELETAL-ANIMATION-AND-AI-RESEARCH.md`](T11-2D-SKELETAL-ANIMATION-AND-AI-RESEARCH.md), [`T11-2D-ANIMATION-TOOLS-MATRIX.md`](T11-2D-ANIMATION-TOOLS-MATRIX.md), [`T11-2D-ANIMATION-WORKFLOWS.md`](T11-2D-ANIMATION-WORKFLOWS.md).

### 1.2 Achado R1 — o worktree está à frente da árvore publicada (não presumido, medido)

O `HEAD` local continua em `13dc4c7d` (`Initial commit`, contém apenas `README.md`); todo o trabalho T5–T11 foi publicado por *plumbing* a partir do worktree. Comparando **worktree × ponta remota** nesta tarefa:

| Medida | Valor |
|---|---|
| Arquivos na árvore publicada | **123** |
| Arquivos no worktree (134 não rastreados + 1 modificado) | **135** |
| Arquivos que existem **somente** no worktree | **12** |
| Arquivos cujo **conteúdo diverge** | **24** |
| Diferença acumulada | **+2.340 / −218 linhas** |

**Os 12 arquivos nunca publicados** (todos de implementação ou teste, nenhum em `.gitignore`):

`electron/blender-workflow-plan.cjs` · `electron/ipc-guard.cjs` · `electron/resume-workflow.cjs` · `electron/workflow-contracts.cjs` · `electron/workflow-run-store.cjs` · `shared/domain/contracts.mjs` · `src/asset-progress.js` · `tests/asset-progress-smoke.mjs` · `tests/blender-workflow-plan-smoke.cjs` · `tests/domain-contracts-smoke.mjs` · `tests/ipc-guard-smoke.cjs` · `tests/workflow-run-store-smoke.mjs`

**As 24 divergências de conteúdo** incluem código central: `electron/workflow-runner.cjs` (+1.224), `electron/main.cjs` (+293), `src/App.jsx` (+174), `electron/manual-artifacts.cjs`, `electron/preload.cjs`, `package.json`, `scripts/comfyui-client.mjs`, `scripts/spriteforge-mcp.mjs`, 4 testes, `README.md` raiz (modificação preexistente do usuário), `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `memory-bank/estado.md` e os **7 documentos divergentes já conhecidos** (`agent-workflow`, `comfyui`, `humanoid-workflow-research`, `lia-ecosystem-integration`, `mcp`, `product-gap-analysis`, `usage-workflows`) — nenhum foi sobrescrito nesta tarefa.

### 1.3 Achado R2 — a árvore publicada é um snapshot antigo **autoconsistente**, mas com documentos que apontam para código ausente

| Verificação | Resultado |
|---|---|
| `electron/main.cjs` publicado exige os 5 módulos novos? | **Não** — nenhum `require` de `workflow-run-store`/`resume-workflow`/`ipc-guard`/`workflow-contracts`/`blender-workflow-plan` |
| Adapters no `main.cjs` publicado | os mesmos 2 (`blender-spritesheet`, `comfyui-concept`), em versão anterior |
| `package.json` publicado referencia testes inexistentes? | **Não** — lista 10 smokes, todos presentes na árvore publicada |
| Conclusão técnica | a árvore publicada **funciona como snapshot mais antigo**; não está quebrada |
| Conclusão documental | **13 documentos publicados citam código que não está na árvore publicada** |

Documentos publicados que citam módulos não publicados: `3D-CHARACTER-PRODUCTION-PIPELINE.md`, `DOMAIN-CONTRACTS-AUDIT.md`, `DOMAIN-CONTRACTS-EVOLUTION-PROPOSAL.md`, `EXTERNAL-REPOSITORY-RESEARCH.md`, `IMPLEMENTATION-AUDIT.md`, `INTELLIGENT-ORCHESTRATOR.md`, `LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md`, `MODULE-CONSOLIDATION-AUDIT-3D.md`, `PHASE-0-REPORT.md`, `README.md`, `T10-E3-RENDERER-VALIDATION.md`, `WORKFLOW-ENGINE.md`, `humanoid-workflow-research.md`.

**Impacto:** um clone novo da branch encontra auditorias (inclusive `DOMAIN-CONTRACTS-AUDIT.md`, que cita `shared/domain/contracts.mjs` por número de linha) referenciando arquivos que não existem no clone. **Risco de decisão:** avaliar o projeto pelo clone e concluir que capacidades documentadas são "fantasma"; ou avaliar pelo worktree e publicar estados que o clone não sustenta.

**Proposta (decisão humana, não executada aqui):** publicar os 12 arquivos e as 24 divergências num commit próprio de reconciliação — separado de qualquer trabalho novo —, **ou** registrar explicitamente que a fonte de verdade é o worktree. Esta tarefa **não** publica trabalho preexistente: publica apenas os 4 documentos T12, o bloco M de rastreabilidade e o índice.

### 1.4 Consequência para toda a auditoria abaixo

**A auditoria de código desta T12 descreve o worktree** (o que o projeto realmente é hoje), e cada linha indica se o componente está publicado. Onde o estado difere entre worktree e árvore publicada, isso está dito.

---

## 2. Auditoria real da implementação (código, não documentos)

### 2.1 Números do checkout

| Área | Arquivos | Linhas | Observação |
|---|---|---|---|
| `electron/` | 16 | ~3.600 | 11 publicados, 5 somente no worktree |
| `src/` | 4 | ~1.954 | `App.jsx` (1.913) divergente; `asset-progress.js` não publicado |
| `shared/` | 1 | 329 | `domain/contracts.mjs` — **não publicado** |
| `scripts/` | 8 | ~2.900 | launcher (1.227), MCP (657), Blender (323), ComfyUI (314) |
| `tests/` | 19 | ~1.400 | 14 smokes Node na cadeia `npm test` + 1 fora dela + 3 Python + fixtures |
| `local-renderer-test/` | 10 | ~1.100 | harness E3 (T10) |
| `docs/` | 52 | ~11.000 | todos publicados; 7 divergentes |
| **Código total auditado** | — | **~11.400** | sem `node_modules`, sem `dist`, sem `release` |

### 2.2 Matriz de componentes — estado real com evidência

Legenda de publicação: **P** = na árvore publicada; **W** = somente no worktree; **P<W** = publicado em versão anterior.

| # | Componente | Caminho real | Responsabilidade atual | Entradas → saídas | Estado | Testes que existem | Testes **executados nesta tarefa** |
|---|---|---|---|---|---|---|---|
| C1 | Shell Electron + janela | `electron/main.cjs:775-812` **P<W** | cria janela, tema, renderer, bloqueio de navegação | evento de app → `BrowserWindow` | `IMPLEMENTED` (desktop) / `UNKNOWN` (instalador no Windows) | `navigation-guard-smoke` | **passou** |
| C2 | Ponte IPC (`preload`) | `electron/preload.cjs` **P<W** | expõe 20 métodos `window.liaForge`, `contextBridge` congelado | renderer → `ipcRenderer.invoke` | `IMPLEMENTED` | `ipc-guard-smoke` | **passou** |
| C3 | Guarda de confiança IPC/navegação | `electron/ipc-guard.cjs` **W**, `electron/navigation-guard.cjs` **P** | exige `sender === webContents`, `senderFrame === mainFrame` e URL confiável | evento → bool/throw | `IMPLEMENTED` | 2 smokes | **passaram** |
| C4 | Segurança da janela | `electron/main.cjs:788-797` **P<W** | `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, `webSecurity:true`, `setWindowOpenHandler→deny`, `will-navigate` bloqueado | — | `IMPLEMENTED` | indireto (C1/C3) | **passou** |
| C5 | Resolução de caminhos/roots | `electron/paths.cjs` **P**, `scripts/lia_paths.py` **P** | workspace, dados, cache, logs, modelos; `LIA_HOME`, `SPRITEFORGE_PROJECT_ROOT`, `LIA_DATA`, `LIA_MODELOS`, XDG/APPDATA | env → paths | `IMPLEMENTED` | `lia-paths-smoke`, `test_bootstrap.py` | **passaram** |
| C6 | Persistência do workspace de assets | `electron/main.cjs:162-211` **P<W**, `vite.config.js` (middleware) **P** | `.spriteforge/assets.json`, escrita atômica (tmp+rename), limite 24 MB, anti-symlink/traversal | assets[] → JSON | `PARTIAL` | `vite-store-smoke` | **falhou** (sem `node_modules`; falha pré-existente) |
| C7 | Registro/validação de assets | `electron/main.cjs:186-205` **P<W**, `scripts/spriteforge-mcp.mjs:396-453` **P<W** | só `type: character \| item`, id único, 5 etapas fixas, `startStageIndex`, `existingInputs` | payload → registro | `PARTIAL` | `mcp-smoke` (zod) | **falhou** (sem `@modelcontextprotocol/sdk`) |
| C8 | Etapas manuais e pastas | `electron/manual-artifacts.cjs` **P<W** | 5 pastas/etapas por tipo, filtros de diálogo, `validateStageOutputs` (3 referências, extensões de modelo/movimento, PNG+JSON) | asset+etapa → caminhos validados | `IMPLEMENTED` (escopo 3D→2D) | `manual-artifacts-smoke` | **passou** |
| C9 | Progresso/compatibilidade de etapas legadas | `src/asset-progress.js` **W** | desfaz "concluído" de referência legada com <3 imagens distintas | asset → flags | `IMPLEMENTED` | `asset-progress-smoke` | **passou** |
| C10 | **Workflow runner** | `electron/workflow-runner.cjs` **P<W** (+1.224) | valida plano, resolve inputs, gate de autorização com fingerprint, gate de revisão, valida outputs no disco, logs redigidos, cancela, retoma | plano+contexto → run | `PARTIAL` (serial) | `workflow-runner-smoke` (590 linhas) | **passou** |
| C11 | Persistência de runs | `electron/workflow-run-store.cjs` **W** | `.spriteforge/runs/<uuid>.json`, 32 MB, UUID v1–8, anti-fuga de caminho, lista até 200 | run → JSON | `IMPLEMENTED` | `workflow-run-store-smoke` | **passou** |
| C12 | Retomada exposta no desktop | `electron/resume-workflow.cjs` **W**, `main.cjs:501-579` **P<W** | `resumableRunKind` aceita **apenas** `render-spritesheet-from-existing-3d`, `stageIndex 4`, 1 etapa, contratos exatos | runId → run retomado | `PARTIAL` (1 workflow, 1 etapa) | `workflow-runner-smoke` | **passou** |
| C13 | Contratos de workflow humanoide | `electron/workflow-contracts.cjs` **W** | 5 estágios (vistas→3D→rig→animação→render), contratos input/output, autorização por provider, `blockedReason` | asset+providers → plano | `PARTIAL` (só o render tem adapter) | `workflow-runner-smoke`, `blender-workflow-plan-smoke` | **passaram** |
| C14 | Plano Blender de 1 etapa | `electron/blender-workflow-plan.cjs` **W** | plano `schemaVersion 2` para render de modelo existente, frame 16–512 px | asset+fonte → plano | `IMPLEMENTED` | `blender-workflow-plan-smoke` | **passou** |
| C15 | **Adapters de execução** | `electron/main.cjs:47-104` **P<W** | **2 adapters** como closures inline: `blender-spritesheet` (processo local) e `comfyui-concept` (HTTP local/remoto) | step+inputs → outputs | `PARTIAL` | smokes C10/C16/C17 | **passaram** |
| C16 | Adapter Blender | `electron/blender-adapter.cjs` **P**, `scripts/blender_spritesheet.py` **P** | args `--background --python`, `shell:false`, progresso `LIA_FORGE_PROGRESS n msg`, SIGTERM no abort, validação PNG RGBA8 + manifesto | modelo+ações → PNG+JSON | `IMPLEMENTED` (código) / `BLOCKED` (execução: sem Blender no ambiente) | `blender-adapter-smoke`, `test_blender_spritesheet.py` | **passaram** |
| C17 | Integração ComfyUI | `scripts/comfyui-client.mjs` **P<W**, `workflows/comfyui/*.json` **P** | endpoint `COMFYUI_URL` (padrão loopback), status/fila/modelos/dispositivos, 2 templates de 7 nós, `runComfyUiConcept` com polling e download | prompt+checkpoint → PNG | `IMPLEMENTED` (código) / `BLOCKED` (execução: sem ComfyUI) | `comfyui-client-smoke` (HTTP simulado) | **passou** |
| C18 | Descoberta de ferramentas externas | `electron/external-tools.cjs` **P** | **2 ferramentas** (`blender`, `krita`): PATH, Program Files, bibliotecas Steam (registro Windows), versão, launch | nome → caminho/status | `PARTIAL` | `external-tools-smoke` | **passou** |
| C19 | Registro de processos gerenciados | `electron/task-manager.cjs` **P** | spawn, list, `stopAll` com SIGTERM→SIGKILL (`taskkill /T /F` no Windows), relatório de fechamento | comando → processos | `IMPLEMENTED` | `task-manager-smoke` | **passou** |
| C20 | Validadores estruturais | `electron/png-validation.cjs` **P**, `electron/spritesheet-manifest.cjs` **P**, `workflow-runner.cjs:138-364` **P<W** | PNG (assinatura, CRC por chunk, IHDR único, IEND, RGBA8), GLB (chunks), manifesto (grade, animações, pivôs, duração), formatos | bytes/arquivo → ok/throw | `IMPLEMENTED` | C10, C16 | **passaram** |
| C21 | **Contratos de domínio (protótipo)** | `shared/domain/contracts.mjs` **W** | `createAssetTypeCatalog` + `validateProject/Asset/Artifact/AssetVersion/Provenance/ValidationResult`, `schemaVersion 1` local, imutável, sem filesystem | record → record congelado | `PARTIAL` (protótipo puro, não integrado) | `domain-contracts-smoke` | **passou** — mas **não está na cadeia `npm test`** |
| C22 | Schema de tarefa de handoff | `docs/asset-task.schema.json` **P**, `src/App.jsx:332-429` **P<W** | task JSON v2 + prompt Markdown para agentes externos (Claude/Codex/OpenCode) | asset → task+prompt | `IMPLEMENTED` (geração) / `DOCUMENTED_ONLY` (consumo) | nenhum específico | — |
| C23 | Servidor MCP | `scripts/spriteforge-mcp.mjs` **P<W**, `scripts/mcp_config.py` **P** | **10 tools** stdio: status, ComfyUI, workflows, modelos livres (informativo), assets, criar asset, referência, preparar tarefa, atualizar etapa, abrir painel | chamada MCP → JSON | `PARTIAL` | `mcp-smoke`, `test_mcp_config.py` | MCP **falhou** (sem SDK); `test_mcp_config` **passou** (6 testes) |
| C24 | Bootstrap/doctor/launcher | `scripts/spriteforge_launcher.py` **P<W** | `doctor` (platform, 13 tools, models, paths), `setup`, download de modelos com **aceite de licença explícito**, lock com stale 3600 s, SHA-256, launch desktop/panel | CLI → diagnóstico/estado | `PARTIAL` (sem hardware) | `test_bootstrap.py` (24 testes) | **23 passaram, 1 falhou** (`test_installed_npm_tree_matches_lockfile`, pré-existente) |
| C25 | UI React | `src/App.jsx` **P<W**, `src/styles.css`, `index.html` | Studio, AssetBrowser, StageWorkspace, Inspector, Handoff, Activity, Exports, NewAssetModal; modo desktop **e** navegador | estado → interface | `IMPLEMENTED` (interface) / `PARTIAL` (sem viewers de artefato) | `vite-store-smoke` | **falhou** (sem `vite`) |
| C26 | Harness de render local (E3) | `local-renderer-test/**` **P** | driver de render, verificador de saída **com checagem de conteúdo** (`verify-output.cjs:128-142` conta alpha por célula), checagem de licença-fonte | manifesto → render+relatório | `IMPLEMENTED` (harness) / `BLOCKED` (render real: sem Blender/asset) | `runner-smoke` | **passou** (T10) |
| C27 | Empacotamento/instalação | `package.json` (`build`, `nsis`, `electron-builder`) **P<W** | NSIS x64 + portable, `asarUnpack` do script Blender, ícone, atalhos | build → instalador | `DOCUMENTED_ONLY` quanto a resultado | nenhum | **não executado** (`npm run build` bloqueado: sem `vite`) |
| C28 | Tratamento de erros e logs | `workflow-runner.cjs:23-54,419-451,540-556` **P<W** | `cleanMessage` (redação de Bearer/chaves/URL com credencial/query sensível), `isSensitivePlanKey`, `sanitizeExecution` (process/http), log com teto de 1.200 entradas | texto → texto redigido | `IMPLEMENTED` | `workflow-runner-smoke` | **passou** |
| C29 | Credenciais/segredos | — | **não há armazenamento de credenciais no código** (`grep` de token/api-key/secret/password em `electron/main.cjs`: 0 ocorrências); ComfyUI é local; envio remoto exige diálogo | — | `NOT_IMPLEMENTED` (gestão de credenciais) — coerente com local-first | nenhum | — |
| C30 | Capability Registry / Provider Hub / Orchestrator / Execution Manager / Artifact Manager / QA Toolkit / Comparison Lab / Adapter SDK / Environment Preflight (módulo) | — | **0 ocorrências** no código (`grep -riE` em `electron/`, `scripts/`, `src/`, `shared/`, `tests/`) | — | `NOT_IMPLEMENTED` (todos) | — | — |

### 2.3 O que o runner realmente faz — e o que não faz (diferença serial × DAG)

**Faz (verificado por leitura e por smoke):**

- Valida o plano: 1–30 etapas, ids únicos, `adapter` obrigatório e **função registrada ou `blockedReason`** (fail-closed), dependências precisam aparecer **antes** na lista, contratos ≤30 por etapa (`workflow-runner.cjs:383-418`).
- Uma execução por instância (`activeRunId`), `AbortController` por run, `signal` repassado ao adapter, `cancel(runId)` (`:1229`).
- **Gate de autorização com invalidação por fingerprint:** se dados/destino/plano mudam após aprovar, a aprovação cai e volta a `awaiting_authorization` (`:840-860`, evento `authorization-scope-changed`).
- **Gate de revisão humana:** `reviewRequired` → `awaiting_review`; na aprovação, **re-verifica cada artefato no disco e compara SHA-256**; se mudou → `review-invalidated` (`:1022-1125`).
- **Detecção de entrada alterada durante a execução:** re-resolve inputs pós-adapter e compara fingerprint; se divergiu, preserva outputs mas **não** marca a etapa como concluída (`:869-877`).
- **Retomada real:** reutiliza etapa anterior **somente** se `status==='validated'`, fingerprint de input confere e **cada artefato ainda bate o SHA-256**; revalida contratos de saída; registra `step-reused`/`resume-invalidated` (`:1126-1228`).
- Validação de outputs por contrato: formato permitido, validador (`png-rgba8`, `spritesheet-manifest`, `glb`, `json`), tamanho, hash, caminho dentro do projeto (`:227-364`, `:672-730`).
- Estados de run e de etapa: `planned`, `awaiting_authorization`, `running`, `failed`, `awaiting_review`, `validated`, `blocked`, `cancelled` (`:12-17`).

**Não faz (verificado por ausência):**

- **Ordenação topológica/scheduling por DAG** — `dependsOn` é validado como "aparece antes", não como grafo a agendar (1 ocorrência no arquivo).
- **Paralelismo** — 0 ocorrências de `parallel`/`concurrency`/`queue`/lock por recurso.
- **Retry automático** — 0 ocorrências; falha encerra o run (com artefatos preservados).
- **Timeout por etapa** — 0 ocorrências no runner (existe apenas no cliente ComfyUI e em `spawnSync` de discovery).
- **Reconciliação pós-crash de tarefa remota** — nada que consulte job externo por ID depois de restart.
- **Fila de jobs, subgrafo por ponto de entrada intermediário, `out_of_scope`/`reused_from_version`** como estados de nó.

**Conclusão:** o runner atual é um **executor serial contratual com gates fortes**, não o Workflow Engine por grafo de [`WORKFLOW-ENGINE.md`](WORKFLOW-ENGINE.md). Essa diferença já está registrada naquele documento (§"Compatibilidade com o código atual") e é confirmada aqui por leitura de código — **sem promoção de estado**.

### 2.4 Testes realmente executados nesta tarefa (ambiente do agente)

| Suíte | Comando | Resultado real |
|---|---|---|
| Smokes Node sem dependências | `node tests/<smoke>` individual | **13 de 15 passaram** |
| `tests/mcp-smoke.mjs` | idem | **falhou** — `Cannot find package '@modelcontextprotocol/sdk'` (pré-existente) |
| `tests/vite-store-smoke.mjs` | idem | **falhou** — `Cannot find module 'vite'` (pré-existente) |
| Python | `python3 -m unittest discover -s tests -p 'test_*.py'` | **Ran 30 tests — 29 ok, 1 FAIL** (`test_installed_npm_tree_matches_lockfile`, sem árvore npm) |
| `npm test` (cadeia) | — | **bloqueado no primeiro script** (`mcp-smoke`) por `&&`; não executado em cadeia |
| `npm run build` | — | **não executado** (sem `vite`) |
| Sintaxe | `node --check` em 40 arquivos `.cjs`/`.mjs` + `vite.config.js` | **40 ok, 0 falhas** |
| Sintaxe Python | `python3 -m py_compile scripts/*.py tests/*.py` | **ok** |
| JSON | parse de 7 arquivos (package, config, schema, 2 templates, 2 manifestos) | **ok** |
| `doctor` | `python3 scripts/spriteforge_launcher.py doctor --json` | **exit 0** — `platform Linux-6.1.158+`, tools instaladas `node v22.22.3` (`meetsMinimum true`), `npm 10.9.8`, `python`; ausentes `blender, krita, claude, codex, opencode, ollama, comfy, comfy-mcp, comfyui, electron`; `models {configured:0, verified:0, missingOrInvalid:0}`; `comfyui.running false`; paths `workspace true`, `modelos compartilhados false` |

**Achado T1 (novo, verificável):** `tests/domain-contracts-smoke.mjs` **passa**, mas **não aparece em `package.json.scripts.test`** (0 ocorrências). O único teste do protótipo de contratos de domínio está fora da cadeia oficial.

**Achado T2:** o `doctor --json` **não tem nenhum campo de hardware** (0 chaves `cpu`/`ram`/`gpu`/`vram`/`disk`/`memory`). A única leitura de VRAM existente no produto vem de `/system_stats` do ComfyUI (`scripts/comfyui-client.mjs:90-98`) e só existe **quando o ComfyUI está rodando**; a UI a exibe como "REPORTADO" (`src/App.jsx:1735`).

**Achado T3:** `spriteforge.config.json` tem `"models": []` — o downloader com aceite de licença, lock e SHA-256 existe (`spriteforge_launcher.py:610-845`) mas **não há nenhum modelo configurado**; portanto a cadeia de proveniência de pesos é código pronto sem catálogo.

---

## 3. Arquitetura principal consolidada

As sete responsabilidades estabelecidas são preservadas. A tabela liga cada uma ao que **existe**, ao que está **documentado** e ao que **falta**, sem criar módulo novo.

| Responsabilidade | O que existe hoje (código) | Estado | O que está documentado como alvo | Lacuna principal |
|---|---|---|---|---|
| **Lia Forge Studio** (interface/experiência) | `src/App.jsx` (8 páginas), `index.html`, `styles.css`, IPC C2/C3, modo navegador via `vite.config.js` | `IMPLEMENTED` para a rota 3D→2D; `PARTIAL` como estúdio multi-categoria | [`PRODUCT-ARCHITECTURE.md`](PRODUCT-ARCHITECTURE.md), [`MASTER-ROADMAP.md`](MASTER-ROADMAP.md) M1 | projetos/briefings multi-categoria, comparação lado a lado, viewers de artefato reais (hoje as prévias são guias ilustrativos) |
| **Intelligent Orchestrator** (planejamento) | `electron/workflow-contracts.cjs` gera plano provider-neutro de 5 estágios e **bloqueia** etapa sem provider/adapter; UI só **inspeciona** o plano | `PARTIAL` (planejamento estático de 1 workflow) | [`INTELLIGENT-ORCHESTRATOR.md`](INTELLIGENT-ORCHESTRATOR.md) | interpretar objetivo, descobrir capacidades/providers, avaliar restrições (hardware, licença, custo), propor rotas alternativas e justificativas |
| **Workflow Engine** (execução) | `workflow-runner.cjs` + `workflow-run-store.cjs` + `resume-workflow.cjs`: serial, gates, fingerprints, retomada, cancelamento, persistência | `PARTIAL` | [`WORKFLOW-ENGINE.md`](WORKFLOW-ENGINE.md) (DAG, entry point, paralelismo por recurso, retry consciente, reconciliação) | DAG/scheduler, paralelismo, retry, timeout, reconciliação remota, subgrafo por entrada intermediária |
| **Provider / Tool Hub** (ferramentas e adapters) | 2 adapters inline em `main.cjs`; discovery de 2 apps em `external-tools.cjs`; 13 tools no `doctor`; `spriteforge.config.json` com `models: []` | `PARTIAL` (evidência, não hub) | [`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md) (manifesto YAML proposto, adapter interface conceitual, gate de consentimento) | registry versionado, manifestos, descoberta, compatibilidade, health checks, licenças por componente, catálogo de capacidades |
| **Execution Backend** (dimensão de execução) | apenas **local**: processo (Blender) e HTTP (ComfyUI loopback, com diálogo se remoto) | `PARTIAL` (local) / `NOT_IMPLEMENTED` (remoto/hosted) | [`T9-EXECUTION-BACKEND-ARCHITECTURE.md`](T9-EXECUTION-BACKEND-ARCHITECTURE.md) | Colab, GPU alugada, worker remoto próprio, hosted API; transferência de artefatos; requisitos declarados por passo |
| **Asset Manager** (identidade/versões/proveniência) | `.spriteforge/assets.json` (2 tipos, 5 etapas, sem versões); protótipo puro `shared/domain/contracts.mjs` (Project/Asset/Artifact/AssetVersion/Provenance/ValidationResult) **não integrado**; hashes por run | `PARTIAL` | [`ASSET-MANAGEMENT.md`](ASSET-MANAGEMENT.md), [`DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`](DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md), [`DOMAIN-CONTRACTS-AUDIT.md`](DOMAIN-CONTRACTS-AUDIT.md), ADR-001 decisão 2 | identidade estável + versões imutáveis + variantes + relações semânticas + mapper do legado + migração com fixtures/rollback |
| **QA e Human Review** | validação estrutural (PNG/GLB/manifesto/formato/hash/caminho), gates de revisão no runner, checagem de conteúdo **só no harness** (`verify-output.cjs:128-142`), 3 referências distintas obrigatórias | `PARTIAL` | [`VISUAL-QA-BENCHMARK.md`](VISUAL-QA-BENCHMARK.md) | validação de conteúdo no caminho de produção (lacuna T10 §8.1), QA visual sistemático, métricas definidas antes da coleta, Comparison Lab |

### 3.1 Regras que a consolidação mantém (não são propostas novas)

1. **Provider ≠ backend.** Um provider pode ter vários backends; um backend serve vários providers.
2. **Existência de provider ≠ capacidade.** Nada é capacidade da Forge por ter sido pesquisado.
3. **Destinos não são módulos de geração.** Lia Desktop, jogos e vídeo são consumidores.
4. **Aprovação humana é insubstituível** e é invalidada por mudança de bytes/perfil (já implementado no runner).
5. **Não criar outro orquestrador, outro engine ou módulos duplicados** — as seis capacidades 2D propostas na T11 entram como *provider-steps*, não como módulo.
6. **Alternativa A de identidade compartilhada permanece não aprovada** ([`STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md`](STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md) §4).

---

## 4. Registro de lacunas consolidado

| ID | Lacuna | Evidência | Classe | Onde deve viver | Bloqueio |
|---|---|---|---|---|---|
| G1 | Árvore publicada atrás do worktree (12 arquivos + 24 divergências) e 13 docs publicados citando código ausente | §1.2, §1.3 | `BLOCKED` (decisão) | repositório | decisão humana sobre publicar trabalho preexistente |
| G2 | Teste do protótipo de domínio fora da cadeia `npm test` | §2.4 achado T1 | `PARTIAL` | `package.json` | nenhum (correção trivial, exige autorização) |
| G3 | Sem detecção de CPU/RAM/VRAM/disco no produto; VRAM só via ComfyUI em execução | §2.4 achado T2 | `NOT_IMPLEMENTED` | Environment Preflight | nenhum técnico; exige decisão de escopo |
| G4 | Sem registry de capacidades/providers; adapters são closures inline | C15, C30 | `NOT_IMPLEMENTED` | Provider Hub | exige ADR do manifesto |
| G5 | Sem scheduler DAG, paralelismo, retry, timeout, reconciliação | §2.3 | `NOT_IMPLEMENTED` | Workflow Engine | exige contratos de idempotência |
| G6 | Retomada exposta limitada a 1 workflow de 1 etapa | C12 | `PARTIAL` | Workflow Engine | G5 |
| G7 | Identidade/versões/relações: protótipo puro não integrado; store legado com 2 tipos e 5 etapas fixas | C6, C7, C21 | `PARTIAL` | Asset Manager | ADR-001 gate de implementação + spec `DRAFT` |
| G8 | Validação de conteúdo ausente no caminho de produção (atlas 100% transparente passaria) | T10 §8.1, T11 §3 | `PARTIAL` | QA Toolkit | autorização para alterar código de produção |
| G9 | Nenhum backend remoto/hosted; nenhuma transferência de artefatos | C15, §3 | `NOT_IMPLEMENTED` | Execution Manager | decisão de provedor remoto + consentimento |
| G10 | Nenhum adapter 2D (camadas, rig 2D, animação 2D, UI, VFX) | T11 fluxos A–E | `NOT_IMPLEMENTED` | Provider Hub | licenças pendentes (T11 bloco L7) |
| G11 | Nenhum adapter de geração 3D, retopo, UV, textura, auto-rig, motion | C13 (etapas bloqueadas) | `NOT_IMPLEMENTED` | Provider Hub | hardware do alvo (T10 E1) + licenças |
| G12 | Download de modelos com licença/lock/SHA-256 existe, mas catálogo vazio | §2.4 achado T3 | `PARTIAL` | Provenance & Rights | decisão de quais modelos |
| G13 | Sem Comparison Lab; sem métricas coletadas | C30 | `NOT_IMPLEMENTED` | QA/Benchmark | M8 |
| G14 | Sem Skills/Knowledge Engine em runtime (só `SKILL.md` de marca e regras de interface) | `.agents/skills/`, `.claude/rules/` | `DOCUMENTED_ONLY` | Skill Catalog | M5 |
| G15 | Build/instalador nunca validado no Windows | C27 | `UNKNOWN` | Release | ambiente Windows |
| G16 | 112 links quebrados em `THIRD_PARTY_NOTICES.md` (causa: `generate_third_party_notices.py:36`) | [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md) | `BLOCKED` (não alterar o gerador nesta tarefa) | notices | autorização para corrigir o gerador |

---

## 5. Ferramentas internas: o que realmente precisamos desenvolver

Para cada candidato: existe? é necessário? pode ser responsabilidade de outro? interfaces mínimas, dependências, ordem, como testar. **Nenhum componente duplicado**: onde uma responsabilidade já tem casa, ela é nomeada.

| Candidato | Existe hoje? | É necessário? | Casa correta | Interfaces mínimas | Depende de | Ordem | Como testar |
|---|---|---|---|---|---|---|---|
| **Capability Registry** | `NOT_IMPLEMENTED` (C30) | **Sim** — sem ele o Orchestrator não tem o que consultar | módulo novo `shared/capabilities/` (dados + validação pura, como `contracts.mjs`) | `listCapabilities()`, `get(id)`, `requirementsOf(id)`, `validatorsFor(id)`, versão do catálogo | G7 (tipos de asset extensíveis) | **1º** | unit: catálogo vazio/inválido/duplicado; contrato: capacidade sem ferramenta continua listável; regressão: nada no runtime muda sem registry |
| **Adapter SDK** | `NOT_IMPLEMENTED`; interface **conceitual** em [`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md) | **Sim** — hoje adapters são closures inline, impossível de estender sem tocar `main.cjs` | `electron/adapters/` + contrato em `shared/adapters/` | `discover()`, `validateCapability()`, `estimateEffects()`, `execute(ctx, signal)`, `reconcile(jobId)`, `validateOutputs()`, `dispose()` | Capability Registry | **2º** | os 2 adapters atuais migrados passam nos mesmos smokes; contrato: adapter sem `discover` é rejeitado; isolamento: sem shell genérico |
| **Environment Preflight** | `PARTIAL` — `doctor` (tools/paths/models) + VRAM via ComfyUI + script T11 **não integrado** | **Sim** — é o que permite bloquear por memória em vez de falhar | estender `scripts/spriteforge_launcher.py` (`doctor`) e expor via adapter; **não** criar segundo doctor | `probe()` → `{os, cpu, ram, gpu[], vram, disk, runtimes, apis}`; `evaluate(requirements, probe)` → `supported \| unsupported \| unknown` | Adapter SDK | **3º** | unit com fixtures de probe; regra: GPU ausente → `unknown`, nunca `supported`; integrar o script T11 como coletor Windows **somente leitura** |
| **Execution Manager** | `NOT_IMPLEMENTED` (só local) | **Sim, mas depois** do primeiro backend remoto aprovado | `electron/execution/` | `selectBackend(step, probe, policy)`, `transfer(artifact, backend)`, `budget(step)` → recusa nomeada | Preflight, Adapter SDK, Provider Hub | **6º** | unit: mesma etapa em 2 backends; recusa por memória com nome do limite; nenhum upload sem consentimento |
| **Artifact Manager** | `PARTIAL` — hashes/paths/validação por run; sem entidade de artefato no store | **Sim** — sem ele não há lineage nem revisão por hash | extensão do Asset Manager (não módulo separado) | `put(path, role) → {id, sha256, sizeBytes, mediaType}`, `get(id)`, `relate(parent, child, predicate)` | Domain contracts (C21) | **4º** | round-trip; hash divergente detectado; path traversal/symlink rejeitados; limites de tamanho |
| **Provenance & Rights Manager** | `PARTIAL` — `validateProvenance` puro (C21), aceite de licença de modelos no launcher (C24), manifestos `local-renderer-test/` | **Sim** — já existe em 3 lugares desconectados | unificar sob Asset Manager + política em [`PROVIDER-AND-MODEL-ADMISSION-POLICY.md`](PROVIDER-AND-MODEL-ADMISSION-POLICY.md) | `record(source, license, evidence)`, `rightsOf(artifact)`, `consentOf(action)` | Artifact Manager | **5º** | consent ≠ licença (teste negativo); `NOASSERTION` ≠ sem licença; código derivado herda restrição |
| **Workflow Runtime (DAG)** | `PARTIAL` (serial, C10) | **Sim** — é a lacuna G5 | evoluir `workflow-runner.cjs`, **não** reescrever | `schedule(graph)`, `readySet()`, `pause/resume`, `retry(policy)`, `reconcile(jobId)` | Adapter SDK (declaração de recurso/idempotência) | **7º** | testes listados em [`WORKFLOW-ENGINE.md`](WORKFLOW-ENGINE.md) §aceite: ciclo, órfão, subgrafo, conflito de recurso, crash antes/depois de enviar |
| **QA Toolkit** | `PARTIAL` — validadores estruturais fortes; conteúdo só no harness | **Sim** — G8 | `shared/validators/` compartilhado por runner, harness e MCP | `validate(artifact, contract) → ValidationResult` (já modelado em C21) | Artifact Manager | **4º (junto)** | 3 controles negativos da T10 continuam passando; alpha-zero rejeitado; variação zero em walk/run rejeitada; fundo opaco **não** exigido |
| **Comparison Lab** | `NOT_IMPLEMENTED` | **Não agora** — expansão | extensão de QA, nunca módulo paralelo | `compare(artifactIds[], rubric) → matrix` | QA Toolkit + métricas definidas | **expansão** | mesma entrada/hash/rubrica; nada de score virar aprovação |
| **Skill / Knowledge Catalog** | `DOCUMENTED_ONLY` (G14) | **Não agora** | [`SKILLS-KNOWLEDGE-ENGINE.md`](SKILLS-KNOWLEDGE-ENGINE.md) | manifesto de skill versionado, **sem autoridade de execução** | nenhum | **expansão** | skill nunca executa; conteúdo offline; versão pinada |

**Regra aplicada:** onde uma ferramenta externa resolve satisfatoriamente (Blender para render/3D, ComfyUI para difusão, Godot para destino 2D/UI/VFX, MCP para agentes), a recomendação é **integrar por adapter**, não reimplementar.

---

## 6. Decisões pendentes (humanas) desta consolidação

| # | Decisão | Por que é humana | Referência |
|---|---|---|---|
| D1 | Publicar os 12 arquivos + 24 divergências do worktree (commit de reconciliação) ou declarar o worktree como fonte de verdade | muda o que qualquer clone vê | §1.2–1.3 |
| D2 | Autorizar correção trivial: incluir `domain-contracts-smoke.mjs` na cadeia `npm test` | altera `package.json` | achado T1 |
| D3 | Autorizar validação de conteúdo no caminho de produção (flag desligada por padrão) | altera código de produção | G8, T11 §3 |
| D4 | Aprovar o **manifesto de provider** e o **contrato de adapter** (ADR) antes de qualquer hub | define formato estável | [`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md) |
| D5 | Aprovar a ordem de implementação (Fases 0–5) e o que é "núcleo obrigatório" | prioridade de produto | [`T12-IMPLEMENTATION-ROADMAP.md`](T12-IMPLEMENTATION-ROADMAP.md) |
| D6 | Manter Spine como **referência de formato** (recomendado) ou aceitar licença por usuário | custo/licença | T11 bloco L6 |
| D7 | Resolver licenças pendentes: `2DAutoRigger` (SPDX Other × README Apache-2.0), pesos do `see-through`, `NVlabs/motionbricks` (dual Apache-2.0/CC-BY-4.0) e pesos HF | direito de uso | T11 L7; [`T12-CAPABILITY-AND-TOOLCHAIN-MATRIX.md`](T12-CAPABILITY-AND-TOOLCHAIN-MATRIX.md) §3 |
| D8 | Escolher o primeiro backend remoto (se houver) e o teto de custo | gasto/consentimento | G9, T9 |
| D9 | Executar o script de diagnóstico T11 na máquina-alvo e, só então, decidir probe res-512 | hardware/risco | T11 L1 |
| D10 | Prover asset próprio/licenciado para o primeiro render E3 | direitos | T11 L2 |
| D11 | Aprovar/rejeitar as 6 capacidades 2D propostas na T11 | escopo | T11 L8 |
| D12 | Aprovar/rejeitar alternativa A de identidade compartilhada Studio×Forge | arquitetura | [`STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md`](STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md) |
| D13 | Corrigir `generate_third_party_notices.py:36` (112 links) | altera gerador | G16 |

---

## 7. O que este documento não faz

Não implementa provider, não cria adapter funcional, não altera contrato nem schema, não modifica runtime, não instala ferramenta, não baixa modelo/peso, não aceita licença, não cria conta, não chama API paga, não envia asset, não inicia GPU alugada, não executa Colab, não faz geração 2D/3D, não executa probe Vulkan, não altera driver ou configuração de sistema, não toma decisão humana, não aprova prioridade, não move nem reorganiza documentos, não sobrescreve os 7 documentos divergentes e não elimina conteúdo preexistente.
