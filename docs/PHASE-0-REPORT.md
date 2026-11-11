# Lia Forge — relatório técnico da Fase 0

**Data:** 2026-11-06 (America/Sao_Paulo)<br>
**Branch:** `arena/649f88bd-3dspritesheet` (`active`)<br>
**HEAD inicial/final:** `13dc4c7d2fde28f9324fd929482948ba34a87abf`
**Escopo:** continuação da Fase 0 com auditoria direta do checkout, diagnóstico do ambiente, comparação de decisões, contratos de integração e uma fatia pequena de correção com testes.

> Este relatório distingue evidência do código, execução de fixture, integração real e proposta. Nenhuma recomendação abaixo vira decisão de produto por aparecer aqui. A linha 10 de “Confirmado pelo usuário” em `DECISIONS-AND-OPEN-QUESTIONS.md` dizia que a tarefa seria apenas documental; o pedido explícito desta sessão autorizou auditoria técnica e uma fatia de código pequena/reversível, substituindo **somente** esse limite de escopo para esta sessão. Continuam em vigor preservação do checkout, sem commit/push, sem provider escolhido, sem instalação de Blender/ComfyUI/modelos e sem refatoração ampla.

## 1. Estado Git e ambiente

| Verificação | Início desta continuação | Final desta continuação |
|---|---|---|
| Branch / HEAD | `arena/649f88bd-3dspritesheet` / `13dc4c7d2fde28f9324fd929482948ba34a87abf` | Inalterados |
| Upstream | Não configurado | Continua sem upstream; não foi criado |
| `origin/main` | `e9887118f9826e112e594b5c154a6b151071a0e6` | Não alterado |
| Working tree | `README.md` modificado preexistente; 105 caminhos não rastreados preexistentes; zero staged | Mesmo diff preexistente de `README.md`; 105 caminhos anteriores + este relatório novo = 106 não rastreados; zero staged |
| Commit / push / limpeza | Nenhum | Nenhum; sem reset, clean, checkout destrutivo, rename ou remoção |
| Artefatos de execução | `node_modules` ausente | `node_modules` instalado e ignorado pelo Git; `dist/` do build é excluído/ignorado pelo snapshot |

O checkout segue sendo o source of truth. Os 105 caminhos não rastreados de baseline foram preservados; a contagem final aumenta somente pelo novo relatório `docs/PHASE-0-REPORT.md`. `README.md` não foi editado nesta continuação. O repositório está shallow nesta cópia e `HEAD` não expõe pai local; não se inferiu continuidade com o histórico `f274b01`.

### Runtimes e dependências

| Item | Evidência | Resultado / limite |
|---|---|---|
| Node.js | `node --version` | `v22.22.3`; satisfaz `engines.node >=22.12.0` |
| npm | `npm --version` | `10.9.8`; único lockfile é `package-lock.json` v3. `yarn` existe, mas não há `yarn.lock`; não foi misturado gerenciador |
| Python | `python3 --version` | `3.11.2`; não foram encontrados `pyproject.toml`, `requirements*.txt`, `setup.py` ou `Pipfile` até profundidade 3 |
| Plataforma | `uname` / PATH | Linux x86_64; Blender, ComfyUI, Krita e PowerShell não foram encontrados no PATH |
| Dependências JS | `package.json`, `package-lock.json`, `npm ls --depth=0` | Lockfile correspondia ao manifest; nove dependências diretas declaradas: MCP SDK 1.32.2, React/DOM 18.3.1, lucide-react 0.468.0, Zod 4.6.7, Vite 6.4.5, plugin React 4.7.0, Electron 45.0.0 e electron-builder 26.18.0 |
| Instalação autorizada pela instrução condicional | `npm ci --ignore-scripts` | Instalou 415 pacotes fixados pelo lockfile. Não alterei dependências nem versões. Os scripts de instalação e o `postinstall: install-electron` foram ignorados; o binário Electron continua ausente. npm reportou 6 vulnerabilidades moderadas e avisos de pacotes transitivos deprecated; não executei `npm audit fix` nem atualizações |
| Instalação opcional | Configuração e código | `spriteforge.config.json` mantém `models: []`; nenhum Blender, ComfyUI, modelo, peso ou asset foi instalado/baixado |

### Scripts declarados no package.json

`dev`/`preview` iniciam Vite em `0.0.0.0`; `build` gera renderer; `desktop` executa Electron; `postinstall` chama `install-electron`; `test` encadeia os 14 smokes descritos abaixo; `package:win` compila e empacota NSIS x64; `package:win:portable` gera target portable x64. Os dois comandos de package não foram executados nesta plataforma Linux e o runtime Electron não foi instalado, logo nenhum instalador foi produzido.

### Resultados reais de verificação

- **`npm test`: passou** após a correção da contagem de referências. Os 14 scripts da cadeia npm foram executados, incluindo MCP, API de workspace Vite, cliente ComfyUI, guards Electron, artefatos manuais, workflow runner/store e adapter/plan Blender. São smoke/unit tests com fixtures e servidor ComfyUI simulado; não são teste E2E de UI, Blender, ComfyUI, Windows ou qualidade visual.
- **`npm run build`: passou**, Vite 6.4.5 transformou 1.578 módulos e gerou o bundle. Isso verifica build do renderer, não empacotamento Electron nem ausência de identificadores globais indefinidos em rotas UI não renderizadas.
- **`python -m unittest discover -s tests -v`: 30/30 passou**, incluindo teste da árvore npm instalada, helpers de bootstrap, paths/licenças e config MCP. Testes de paths Windows usam fixtures; não equivalem a execução em Windows.
- Não foi iniciada a aplicação, o ComfyUI ou o Blender. Não houve chamada a provider, upload de referência, chamada paga, uso de credenciais ou consumo de créditos.

## 2. Auditoria por subsistema

Estados: `IMPLEMENTED` = código executável existe; `VERIFIED` = comportamento estreito passou em ambiente/inputs identificados; `PARTIALLY_IMPLEMENTED` = há subconjunto real e lacunas; `DOCUMENTED` = informação sem executor comprovado; `PLANNED` = intenção ainda sem implementação; `EXPERIMENTAL` = protótipo delimitado; `BLOCKED` = dependência, ambiente, autorização ou decisão impede a verificação/execução nomeada; `PROPOSED` = recomendação não aprovada. O estado vale só para a capacidade indicada.

| Subsistema / estado | Evidência, interface e dependências | Teste/evidência desta continuação | Limitações, riscos e decisão de preservação |
|---|---|---|---|
| **Electron desktop / `IMPLEMENTED`**; guards IPC/navegação / `VERIFIED` | `electron/main.cjs` (~1.057 linhas) concentra lifecycle, IPC, Vite, arquivos, runs, adapters e fechamento; `preload.cjs` expõe uma fachada allowlisted; `ipc-guard.cjs`, `navigation-guard.cjs`, `paths.cjs` | `ipc-guard-smoke.cjs`, `navigation-guard-smoke.cjs` passaram; build do renderer passou | BrowserWindow declara `contextIsolation`, `sandbox`, `nodeIntegration:false` e `webSecurity:true`; navegação externa e subframe são bloqueados. Não há execução do runtime Electron nesta sessão, nem verificação Windows. Não foi identificada política CSP explícita nem handler de permissões da sessão. Preservar a fachada e separar módulos antes de refatorar o `main.cjs` monolítico. |
| **React/frontend / `IMPLEMENTED`; extensionalidade / `PARTIALLY_IMPLEMENTED`** | `src/App.jsx` (~1.913 linhas), `src/styles.css`, `src/asset-progress.js`; React/React DOM 18.3.1, lucide-react 0.468.0, Vite 6.4.5; desktop usa `window.liaForge`, navegador usa endpoints same-origin Vite | Vite production build passou; `asset-progress-smoke.mjs` passou | Studio, handoff, activity e exports existem. Previews de arte/rig/atlas são guias SVG explicitamente rotulados, não viewers nem outputs. UI fixa `character`/`item` em filtros, stages e formulários; não há E2E de browser. Foi corrigida a importação faltante de `Server` usada na tela Activity; build sozinho não detectaria a referência ausente em runtime. Preservar identidade visual e os rótulos “guide only”. |
| **Domínio / taxonomia / `PARTIALLY_IMPLEMENTED`** | `electron/main.cjs`, `manual-artifacts.cjs`, `blender-workflow-plan.cjs`, `spritesheet-manifest.cjs`, `docs/asset-task.schema.json`, `scripts/spriteforge-mcp.mjs`, `src/App.jsx` | `mcp-smoke`, `manual-artifacts-smoke`, `blender-adapter-smoke` passaram | Não há runtime `Project`, `AssetType`, `AssetVersion`, `Artifact`, `Provenance` ou `ValidationResult` genérico. Várias fronteiras aceitam somente `character`/`item`; MCP `itemKind` enum difere dos exemplos da UI. **O manifesto lido não é genérico:** `schemaVersion:1`, `assetType` restrito a `character|item`, `anchor` fixo `feet|center`, `sourceFrame` inteiro para personagem e `null` para item. O adapter Blender ainda fixa oito colunas. Preservar formato v1 e alias legados; não espalhar mais `if type === ...`. |
| **Persistência / projetos / assets / `PARTIALLY_IMPLEMENTED`** | `.spriteforge/assets.json`; snapshots `.spriteforge/runs/*.json`; store Vite em `vite.config.js`; cópias de leitura/escrita em `main.cjs` e `spriteforge-mcp.mjs`; roots em `electron/paths.cjs` / `scripts/lia_paths.py`; JSON + Node fs/atomic rename e localStorage, sem banco/ORM | `vite-store-smoke`, `workflow-run-store-smoke`, `lia-paths-smoke` e testes Python passaram | Escritas JSON atômicas, limites e algumas verificações de symlink/path existem. Não há ID/manifesto de projeto, version graph, migration geral, transação entre processos nem compare-and-swap. Três implementações do store têm validações diferentes; polling/escritas da UI podem competir com MCP. UI usa `localStorage`/flag pending e mescla por ID; ao store vazio, seeds de demonstração são a base inicial. MCP `prepare_task` reescreve task/prompt gerados no mesmo caminho. Manter `.spriteforge/`; adotar interface de store/migração antes de alterar schema ou diretórios. |
| **Workflow Engine / `PARTIALLY_IMPLEMENTED`** | `electron/workflow-runner.cjs` (~1.250 linhas), `workflow-contracts.cjs`, `workflow-run-store.cjs`, `resume-workflow.cjs`, `blender-workflow-plan.cjs`; Node CommonJS/built-ins, sem fila/worker externo | `workflow-runner-smoke`, `workflow-run-store-smoke` e `blender-workflow-plan-smoke` passaram | Valida planos de até 30 nós, inputs/outputs, formatos, hashes, autorização, revisão e retomada compatível; persiste eventos/snapshots. Agenda sempre serialmente na ordem da lista; `dependsOn` só aponta para nó anterior. Uma instância permite um run; não há timeout genérico, retry policy, scheduler paralelo, locks de recurso ou reconciliação pós-crash do job ComfyUI. `cancel()` e `review()` existem na classe, mas não há IPC/UI que os exponha nesta versão. A retomada desktop persistida é específica ao render Blender de um estágio. Adaptar incrementalmente, sem declarar DAG geral. |
| **ComfyUI / `PARTIALLY_IMPLEMENTED`** | `scripts/comfyui-client.mjs`, templates `workflows/comfyui/*.json`, adapter em `electron/main.cjs`, endpoints Vite read-only e telas React; HTTP para endpoint ComfyUI configurável por `COMFYUI_URL` | `comfyui-client-smoke.mjs` passou com servidor HTTP de teste; MCP smoke consulta status sem instalação | Implementa status/listagem e geração de conceito PNG em dois templates; não cria 3D, rig, animação nem spritesheet. Checkpoint já instalado é escolhido pelo usuário e a geração exige clique; endpoint remoto recebe diálogo antes do POST, mas diagnóstico/status pode consultar automaticamente o `COMFYUI_URL` configurado (UI atualiza periodicamente). Cancelar polling não prova cancelamento do job remoto; não há reconciliação após restart. Não foi executado ComfyUI real. Preservar consentimento de geração e não transformar concept PNG em prancha ortográfica. |
| **Blender / `PARTIALLY_IMPLEMENTED`; execução real / `BLOCKED`** | `electron/blender-adapter.cjs`, `blender-workflow-plan.cjs`, runner e `scripts/blender_spritesheet.py` (~324 linhas); depende de Blender CLI/Python e modelo preexistente (ausentes no PATH) | Plan/adapter smoke passaram com PNG/manifest fixtures; helpers Python passaram | Consome modelo 3D já existente (`.blend`, `.glb/.gltf`, `.fbx`, `.obj`, `.stl`); não gera mesh, rig ou animação. Script tenta importar/renderizar, gerar atlas e metadados; Blender e inputs reais ausentes. Compatibilidade de API/importers/Action Slots e aspecto visual não verificados. `validatePngBuffer` verifica assinatura/chunks/CRC e declaração RGBA, mas não descomprime IDAT nem prova pixels alpha transparentes. Preservar os gates estruturais e exigir revisão visual real. |
| **MCP / `PARTIALLY_IMPLEMENTED`** | `scripts/spriteforge-mcp.mjs`, `scripts/mcp_config.py`, `@modelcontextprotocol/sdk` 1.32.2; transporte stdio e handoff local | MCP smoke passou com client local/arquivos sintéticos; config tests passaram | Consulta/organiza assets e tarefas; não implementa 3D/rig/animação. `spriteforge_open_panel` inicia dev server em `0.0.0.0`; tools MCP podem ler/gravar paths do projeto. Nenhum agente ou provider é requisito do runner. Preservar MCP como integração opcional/revogável. |
| **Agentes/handoff / `DOCUMENTED`; runtime Agent / `PLANNED`** | Handoff/UI e task/prompt generator; `.agents/skills/lia-brand-check/SKILL.md`, `.claude/rules/interface.md`; nenhuma agent runtime dependency | Leitura cruzada; MCP smoke valida protocol/fixture, não chama Claude/Codex/OpenCode nem executor externo | São targets/instruções, não agente integrado nem prova de execução. Skills de marca não são tool permissions. Preservar handoff como opcional e separar da execução do engine. |
| **Skills & Knowledge runtime / `PLANNED`; instruções presentes / `DOCUMENTED`** | `.agents/skills/lia-brand-check/SKILL.md`, `.claude/rules/interface.md`, docs/handoff | Leitura de instruções/documentos; sem teste de engine, pois engine não existe | São conteúdo de marca/contribuição, não roteador/catalogador de skills de assets. Skill não deve executar comandos nem autorizar side effects. Preservar esses arquivos, não promover a `IMPLEMENTED`. |
| **Permissões / segurança / `PARTIALLY_IMPLEMENTED`** | Guards IPC/path, atomic writes, `spawn` sem shell no adapter Blender, dialogs de overwrite, aprovação do POST remoto ComfyUI; `vite.config.js`, `external-tools.cjs`, `task-manager.cjs` | IPC/navigation, paths, MCP config e store smoke passaram | Há controles locais importantes, mas não há política transversal de Capability/Consent/Credentials. Risco de dev: Vite configura `host:0.0.0.0` e `allowedHosts:true`; endpoints do store aceitam pedidos sem `Origin` para tooling local, sem autenticação; `spriteforge_open_panel` também escolhe bind amplo. Revisar exposição e CSRF/SSRF mantendo compatibilidade com preview e caller local. Não foi encontrada integração a OS credential store. Não mudar permissões ou providers por uma correção improvisada. |
| **Testes / `VERIFIED` com escopo estreito** | 14 scripts Node em `package.json`; três módulos `unittest` Python | `npm test` 14/14 scripts passou; Python 30/30 passou | Smokes incluem mocks/fixtures; arquivos de imagem e modelo sintéticos não provam decode/uso real. Não há E2E Electron/browser, Windows, Blender/ComfyUI reais ou inspeção visual. `local-renderer-test/` permanece fora de escopo e não foi executado/reaberto nesta continuação; o estado `EXPERIMENTAL` citado no inventário anterior permanece separado. |
| **Build / empacotamento / `VERIFIED` e `BLOCKED` por capacidade** | `vite.config.js`, `package.json` (Vite 6.4.5; electron-builder 26.18.0, targets NSIS/portable x64) | `npm run build` passou em Linux x86_64; `electron-builder` JS está instalado | O runtime Electron não foi baixado por `--ignore-scripts`; não foi produzido instalador. Windows/NSIS, instalação, upgrade, desinstalação e preservação de workspace seguem `BLOCKED` até execução em Windows real. Build do renderer não equivale a empacotamento. |
| **Rotas, orquestrador e catálogo geral / `DOCUMENTED`, `PLANNED`, `PROPOSED`** | `docs/ASSET-PIPELINES.md`, `INTELLIGENT-ORCHESTRATOR.md`, `TOOL-PROVIDER-HUB.md`, `SKILLS-KNOWLEDGE-ENGINE.md`; contratos pontuais em código | Leitura cruzada com código/testes | Humanoide completo fica bloqueado sem providers/adapters de views, 3D, auto-rig e animação; benchmark e catálogo geral não existem. As arquiteturas são propostas, não executores. Preservar prioridade de humanoide sem restringir o núcleo a ele. |

**Disposição preserve/adapt/replace:** preservar renderer, identidade visual, fachada allowlisted, `.spriteforge/`, formato do manifesto v1, grants existentes, adaptando-os gradualmente a ports/registries/events com leitores legados. Não recomendo substituição integral de nenhum subsistema na Fase 0. Possíveis substituições futuras (store duplicado/validação repetida e `main.cjs` monolítico) só após API aprovada, migration dry-run, equivalence tests e rollback; até lá são alvos de extração/adaptação, não substituição imediata.

### Evidência específica solicitada: `spritesheet-manifest.cjs`

O contrato atual da spritesheet é específico, não genérico. `validateSpritesheetManifest()` exige `schemaVersion:1`, apenas `character|item`, `origin:top-left`, anchor `feet` para `character` ou `center` para `item`. A função exige `asset` e `generator` não vazios; frame width/height positivos até 4096; dimensões da grade coerentes; uma animação não vazia por row, única por comparação case-insensitive `en-US`; quantidade de frames igual a `columns × rows`; frames em ordem row-major, coordenadas/dimensões batendo e filename não repetido (case-sensitive). Pivots são inteiros dentro do frame e `durationMs` finito/positivo. `sourceFrame` de `character` é apenas `Number.isInteger` (não exige não-negativo); para `item`, exige `null`. A validação não exige que o pivot por frame corresponda semanticamente ao anchor declarado e não rejeita propriedades adicionais.

O adapter (`electron/blender-adapter.cjs`) também aceita somente `character|item`, passa `columns:8`, valida cabeçalho/chunks/CRC e RGBA declarado do PNG. Isso **não** descomprime pixels nem comprova transparência visual. `validateSpritesheetManifest()` é chamado pelo `workflow-runner.cjs` para o check `spritesheet-manifest`. Já `outputContracts` em `electron/workflow-contracts.cjs` descreve outputs abstratos por ID, formatos e validator (por exemplo, `spritesheet` PNG e `spritesheet-metadata` JSON); não declara o schemaVersion, anchor, sourceFrame, row-major, pivots nem regras concretas do manifesto. Portanto, contrato genérico e manifesto concreto são camadas complementares, não equivalentes: o validator específico pode rejeitar output que satisfaça apenas o contrato genérico. Conclusão: preservar formato v1 e callers; eventual policy injetável deve ampliar só o validador após aprovação, e não alegar suporte end-to-end a uma categoria nova.

## 3. Decisões: alternativas, trade-offs e recomendações

As recomendações abaixo são **propostas técnicas**, não decisões de produto aprovadas. A tabela de requisitos confirmados foi lida integralmente em `docs/DECISIONS-AND-OPEN-QUESTIONS.md`; o pedido explícito de Fase 0 desta sessão altera somente o antigo limite de escopo do item 10 para permitir esta auditoria e correções pequenas/reversíveis. O restante dos itens permanece vigente.

### Requisitos confirmados (1–11)

| # | Restrição confirmada | Alternativas / trade-offs | Recomendação / impacto | Como validar |
|---|---|---|---|---|
| 1 | Personagens, itens/armas/ferramentas, 2D, 3D/rig/animação, ambientes e novas categorias | Enum global é simples, mas fechado; string livre é extensível, porém aceita typo; registry tipado dá validação sem enum rígido | `AssetTypeId` registrado, extensões de subtype e contracts de artifact; `character`/`item` continuam aliases. Não espalhar condicionais por categoria | Adicionar fixture de novo type sem editar branches do core; tipo ausente/desconhecido falha fechado; inputs legados continuam legíveis |
| 2 | Rotas Brief→2D, 3D humanoide, mannequin, procedural, image→3D e edição/conversão | Pipeline único obrigatório versus workflows/recipes independentes | Workflows versionados por capability; engines inexistentes bloqueiam só a rota correspondente, sem placeholders | Executar fixtures por route e verificar que etapas fora da rota não rodam |
| 3 | Entrada em qualquer estágio compatível e retomada sem re-geração | Marcar predecessores como concluídos sem evidência; recomeçar tudo; marcar `out_of_scope`/`reused` com fingerprints | Nunca inventar completion. Persistir input/artifact hashes e compatibilidade; efeitos externos incertos precisam reconciliação | Restart, alteração de fingerprint, input intermediário, output preservado e falha após submit remoto |
| 4 | Prioridade de produto é humanoide estilizado corpo inteiro | Restringir o modelo a humanoide ou manter categoria geral e priorizar uma vertical slice | Preservar a prioridade da vertical slice sem restringir o núcleo; execução completa segue bloqueada até adapters/providers reais | E2E autorizado para cada capability escolhida, com revisão visual e evidência de licença |
| 5 | Provider-neutral/local/cloud possíveis; agentes opcionais; sem conta/internet obrigatória | Provider fixo na UI; agente coordenador obrigatório; Hub de adapters + execução core | Forge executa workflows sem LLM/agente/MCP/provider cloud. Orchestrator propõe; Engine executa | Rodar fluxo determinístico/manual sem processo MCP/agent e verificar que abrir UI não chama provider |
| 6 | Não simular progresso, outputs, testes ou métricas | Percentual estimado, fixtures sem rótulo ou eventos reais medidos | Progresso só de evento real; fixture/mock sempre explicitamente marcada; ausente é melhor que fabricado | Mutation tests, bloqueio/provider ausente e auditoria de texto/UI; nenhum fixture classificado como E2E |
| 7 | QA estrutural não substitui revisão visual humana | Aprovação automática, só humana ou níveis separados | `ValidationResult` automatizado e `HumanReview` explícita vinculada a hash/version | Editar artifact após approve e exigir nova revisão; registrar limites do validator |
| 8 | Usuário controla install/download/custo/autorização/upload/licença | Consentimento genérico; por sessão; por efeito e escopo | Grant específico por action, inputs, destino, provider, dados, custo/limite; permissões não inferidas | Deny-before-call, mudança de escopo, custo unknown, resposta remota perdida, overwrite e cancelamento |
| 9 | Não presumir AMD/Vulkan/CUDA/CPU nem Vulkan nativo no ComfyUI | Heurística de marca, flag instalada ou probe por backend/version/OS | `unknown` é estado válido; instalação, compatibilidade e performance são sinais distintos | Probe real reproduzível por combinação; não promover claim por detecção de hardware |
| 10 | Texto anterior vedava implementação/dependências e dizia documentação-only | Manter o limite antigo ou aplicar o pedido explícito mais recente | Correção desta sessão autoriza auditoria, instalação declarada necessária e duas correções mínimas; não autoriza refatoração, mudança de produto, downloads proibidos, dependências novas, commit/push | Comparar baseline/final; patches pequenos com testes; estado Git preservado |
| 11 | `local-renderer-test/` é tarefa separada | Retomar por proximidade ou manter a separação | Não reabrir/executar como tarefa de produção; estado histórico permanece separado | As suites executadas não entram nesse diretório; nenhuma alegação E2E baseada nele |

### Propostas técnicas P1–P6

| ID | Alternativas / trade-offs | Recomendação | Migração / risco | Validação |
|---|---|---|---|---|
| **P1 — entidades** | `Tool` genérico simplifica catálogo mas mistura app, service, código, conteúdo e agente; tipos distintos exigem interfaces claras | Distinguir `Capability`, `Tool`, `Provider`, `Adapter`, `Workflow`, `Skill`, `Agent`, `AssetType` e `Artifact` | Médio: código existente especializa Blender/ComfyUI e char/item. Introduzir ports/read adapters, não renomear JSON legados | Conformance: tool sem adapter, provider sem capability, skill sem grants, agent ausente |
| **P2 — Workflow Engine** | Lista serial é previsível; DAG abre branch mas precisa persistência, locks, reconciliação e idempotência | Validar DAG geral primeiro; preservar scheduler serial como primeiro executor seguro; paralelizar só com resource claims | Alto em substituição big-bang; baixo/moderado extraindo graph core puro, sem integrar ainda | Cycles, forward edges, branches/joins, erro em ramo, restart, lock e external effect |
| **P3 — storage/version store** | JSON portátil; SQLite tem transações/consulta mas migração; híbrido separa metadata/bytes | Não decidir backend agora. Definir port/versioned schema e preservar `.spriteforge/`; medir antes de trocar | Alto se alterar paths/namespace; precisa reader legado, dry-run, backup/rollback | Crash/concorrência, corrupção, arquivos grandes/Unicode, export/restore offline |
| **P4 — planner** | LLM é flexível mas depende de modelo/rede e varia; regras reproduzíveis mas limitadas; híbrido tem fallback | Planner determinístico/explicável como mínimo; LLM opcional só propõe plano | Alto se sugestão aciona efeitos sem consent | Mesma fixture on/off LLM; blockers/custos `unknown`; nenhuma execução implícita |
| **P5 — Skills/Knowledge** | Executar skill aumenta automação e risco de prompt injection; catálogo declarativo é mais seguro | Começar com conteúdo curado/versionado, provenance/licença/trust; skills não executam nem concedem grants | Médio; signing/source policy pendentes | Corpus adversarial, routing offline e prova de que skill não chama tools |
| **P6 — benchmark** | Score/ranking único esconde inputs, hardware e julgamentos; protocolo com dados separados é custoso | Separar métricas mecânicas, avaliações humanas e `unknown`; sem ranking antes de dataset/rights/metodologia | Alto para reputação/licença dos dados, baixo para schema | Reproduzibilidade, conditions, amostra, uncertainty e revisão de rights |

### Perguntas abertas (1–15)

| # / tema | Alternativas / trade-offs | Recomendação técnica ainda não aprovada | Risco / migração | Como validar |
|---|---|---|---|---|
| **1. Primeira slice** | Brief→2D tem hoje apenas rota de conceito; modelo existente→spritesheet reusa mais código Blender; humanoide completo carece de etapas/providers | Avaliar modelo 3D existente→spritesheet como prova E2E se input licenciado e ferramentas reais estiverem disponíveis; isso não revoga prioridade humanoide | Média; não prometer geração 3D | Blender/asset real, target OS, manifest/hash, revisão visual e import/export |
| **2. OS/versões** | Windows-first reduz matriz; cross-platform aumenta suporte; declarar só combinações testadas é honesto | Configuração de empacotamento Windows não é suporte verificado; Linux aqui é auditoria. Fixar versions após matriz real | Alta em paths, subprocessos e packaging | Windows install/upgrade/uninstall/NSIS, Blender/ComfyUI versioned smoke |
| **3. Categoria vs route** | Union fechado, string livre ou registry tipado com workflows por capability | Separar `AssetTypeId`, subtype, `WorkflowId`, `ArtifactType`; compat aliases character/item | Alta se migrar `type`; atual manifesto v1 continua | character/item e novos fixtures; nova categoria sem editar core; unknown rejeitado |
| **4. Plugin API** | In-process simples mas amplo; isolated process exige protocol; sem plugins é mais seguro | Não publicar API ainda; primeiro registry declarativo/adapters first-party; plugin externo após threat model/signature/isolation | Alta, execução de código e rede | Digest/signing, sandbox, grants, revoke/rollback/conformance |
| **5. Storage** | JSON, SQLite, manifest filesystem ou híbrido: atomicity/concurrency/query/export diferem | Interfaces e versioning antes de escolher DB; preservar paths `.spriteforge/` | Alta; migration pode perder lineage | Dry-run, backup, rollback, corruption/crash, concurrent UI/MCP |
| **6. Providers** | Local maximiza autonomia; cloud amplia capacidade mas envia dados/custa; híbrido requer policy | Não selecionar provider; capability catalog distingue manual/local/remote e bloqueia se indisponível | Alta: terms, privacy, price, model license | Comparar por capability; fake tests separados de execução real autorizada |
| **7. Hardware** | Minimum VRAM fixo pode excluir/errar; probe genérico não prova backend; `unknown` preserva incerteza | Sem promessas AMD/Vulkan/CUDA/CPU até probe por adapter/version/OS | Média/alta em UX/claims | Probe reproduzível, backend real e performance separados |
| **8. Consent UX** | Grant global/session é fácil, mas excessivo; por effect é preciso, mais prompts | Consent por effect + hashes/dados/destination/provider/cost/expiry; instalação/download/licença/overwrite grants distintos | Alta se consent antigo reusado | Deny tests, invalidation on scope change, ambiguous remote completion |
| **9. Credentials** | `.env` é simples e pode vazar; project JSON é inadequado; OS store depende do target | Port host-side de credential provider; nunca renderer/log/project JSON; env explícito só desenvolvimento | Alta; rotação e OS matrix | Redaction, ACL, rotation/revoke, export sem secrets |
| **10. Review/evidence** | Score automático não julga estilo; humano-only escala mal; níveis separados | Structural `ValidationResult` + `HumanReview` vinculada a artifact hash/version | Média; edição invalida approval | Hash change, evidence real, profiles específicos sem score universal |
| **11. Rights/licensing** | Licença global conflita múltiplas fontes; lineage por source/Artifact mais fiel | Registrar source/model/tool/output rights; `UNKNOWN/REVIEW_REQUIRED` bloqueia claim | Alta, especialmente modelos/media/import | Source→derived lineage, notices e license version, revisão humana/jurídica |
| **12. Benchmark** | Fixtures são regressão, não benchmark; ranking sem igualdade é enganoso; protocolo é lento | Definir rights, sample, reviewers, metrics/uncertainty antes de executar/publicar | Alto para claims e rights | Runs pareados com versions/seed/hardware/cost; unknown explicit |
| **13. Agents/MCP** | Agent obrigatório cria dependência; MCP opcional facilita tools; engine próprio suporta manual/local | Engine independente; agent/MCP clients da facade com grants revogáveis, sem autorizar em nome do user | Alta se trust boundary privilegiada | Workflow sem MCP, revocation, scopes e zero calls implícitas |
| **14. Telemetry** | Default-on reduz cegueira mas envia dados; granularidade exige trabalho; off prioriza autonomia | Telemetry Forge off; opt-in granular após schema/redaction/retention; não presumir política de providers | Média; prompt/reference podem vazar | Network-off, redaction, retention/delete, consent revocable |
| **15. Maturity** | Selo global é simples mas generaliza; por capability×adapter×OS/version/hardware é preciso | Maturity por combinação, `EXPERIMENTAL` até E2E real; `STABLE` com regressões e limites | Média/alta para claims e compat | Matrix de teste, owner, version, rollback e evidence |

## 4. Contratos de integração propostos

Estes contratos são uma interface de desenvolvimento, ainda não JSON schemas aprovados nem persistidos. Versionar cada schema; migrar dados antigos separadamente, com dry-run e rollback.

| Contrato | Campos mínimos propostos | Invariantes / owner |
|---|---|---|
| `Project` | `id`, `schemaVersion`, root policy, timestamps, engine/targets opcional | Root escolhido pelo usuário e resolvido sob policy; nenhum segredo no manifest; Project Store owner |
| `AssetType` descriptor | stable `id`/version, taxonomy, input/output schemas, artifact roles, validators, entry points, capabilities/workflow refs | Registry é extensível e validável; não codifica engine nem route |
| `Asset` | `id`, `projectId`, `assetTypeId`, subtype, brief/tags/targets, `currentVersionId` | Descriptor valida extension; no enum global fechado |
| `Artifact` | `id`, permitted relative URI/path, mediaType/format/semantic role, bytes/size, SHA-256, metadata, parent refs, validator refs | Bytes real e imutáveis; mudança cria Artifact/Version nova; extension não basta para provar semântica |
| `AssetVersion` / `Version` | IDs, parent versions, actor/time, artifact IDs, review/provenance refs | Snapshot immutável; fonte não sobrescrita sem consent/rollback explícito |
| `OutputContract` | ID, semantic artifact kind, allowed media types/formats, cardinality, schema/validator ID+version, required | Independente da categoria. Spritesheet manifest v1 é contrato concreto com policy de AssetType; não é workflow output universal |
| `WorkflowDefinition` | `id`, version/schema, nodes, dependency edges, `entryNodeIds` | Recipe sem estado de execução; DAG acíclico; port contracts versionados |
| `WorkflowPlan` | workflow version, subgraph, adapter/provider candidates, input refs/fingerprints, effect/cost/data summary, blockers | Orchestrator propõe; sem dispatch/consent implícito |
| `WorkflowRun` / `NodeRun` | IDs/versions, status, fingerprints, attempts, times, artifact/validation refs, errors, external task refs | Definition ≠ Run; external ambiguity vira `needs_reconciliation`, nunca retry cego |
| `Capability` / `Tool` / `Provider` / `Adapter` | capability, runtime/tool/version, provider mode/source, adapter contract/version and evidence | Descriptor não prova instalação, compatibility, license ou execução |
| `Skill` / `Agent` | skill version/source/hash/license/trust/required capabilities; client identity and scoped grants | Skill é conteúdo, não permissão; agent/MCP são opcionais/revocáveis |
| `ExecutionEvent` | event ID, run/node, monotonic sequence, timestamp, kind, redacted payload | Append-only; progress só medido; sem segredo/raw prompt sem grant |
| `ValidationResult` | artifact id/hash, validator ID/version, checks, status/details/limits, timestamp | Evidência restrita a esse hash/validator; nova versão invalida |
| `Provenance` | source IDs/rights, prompt/reference refs, tool/provider/model versions, transform, hashes | Preserva lineage; rights separados por fonte/model/provider/output; unknown visível |
| `ConsentRecord` | action, exact input hashes, data class/destination/provider/cost limit, grant/time/expiry/invalidation | Autoriza um efeito/escopo; secrets nunca serializados |

### Fronteiras entre subsistemas

- **UI → Application Facade:** commands/queries tipados (`createAsset`, `proposePlan`, `startRun`, `cancelRun`, `reviewRun`, `openArtifact`). UI mostra plano/estado e não importa implementação de Provider.
- **Intelligent Orchestrator → Workflow Engine:** `PlanProposal` com DAG/subgraph, entradas, candidates, blockers e custo/dados `unknown`. Orchestrator planeja; `startRun` requer comando separado após consentimento explícito.
- **Workflow Engine → Tool/Provider Hub:** `inspectCapability`, `estimateEffects`, `executeNode`, `cancelJob`, `reconcileJob`, `validateOutputs`. Sem shell/HTTP genérico derivado de texto de skill.
- **Hub → Adapter:** contexto mínimo, inputs validados, paths permitidos, `AbortSignal`, grants, execution policy e resource claims; response tipada com external job ID, eventos reais e outputs verificáveis.
- **Skills & Knowledge → Orchestrator/QA:** conteúdo curado/versionado, recommendations/checklists; não chama tools, concede consent ou muda contracts.
- **Project Store ↔ subsistemas:** port para Project/Asset/Version/Artifact/Provenance/Validation/ExecutionEvents. Backend em aberto; preservar `.spriteforge/assets.json` e `.spriteforge/runs/` enquanto não há migration.
- **MCP/agents:** clientes opcionais da mesma facade com grants revogáveis; tirar MCP deve deixar Forge manual/local e workflows próprios executáveis.

## 5. Workflow Engine executável: desenho-alvo, não estado atual

1. **Validação:** IDs únicos; referências existentes; DAG acíclico; ports/outputs ligados; formatos/cardinality compatíveis; workflow/adapter version conhecida; paths, input hashes e rights verificados. Dependências podem apontar a nós declarados depois; ordenar topologicamente em vez de depender da ordem do array.
2. **Entry points:** calcular apenas o subgrafo necessário. Input externo pode satisfazer estágio intermediário após contract, validator, rights e fingerprint. Predecessores ficam `out_of_scope`/`reused`, nunca `completed` nesta run sem prova.
3. **Inputs/outputs:** port referencia Artifact/context tipado; Artifact traz MIME/format/role, size/hash, schema/validator, provenance/cardinality. Todo output precisa corresponder ao contract; validator produz `ValidationResult` separado. Nenhum output fictício.
4. **Paralelismo:** começar com layers prontos e execução serial. Paralelizar somente se resource claims não conflitam: CPU/GPU/memória/VRAM/processo exclusivo/quota/destino de arquivo. Limits configuráveis e apoiados por probe; ordenar eventos/outputs deterministicamente quando possível.
5. **Persistência/retomada:** append-only event log e snapshots atômicos; workflow/adapter/provider/validator versions, fingerprints, outputs/hashes, environment evidence, grants e external job IDs; restart revalida e invalida só descendentes afetados. Primeiro planejar migration `.spriteforge/`, dry-run/backup/rollback.
6. **Retry/idempotência:** node declara `pure`, `idempotent`, `deduplicated_by_provider`, `non_idempotent` ou `unknown`; key só se provider suportar. Retry automático só com garantia. Submit/upload/custo de resposta perdida vira `needs_reconciliation`.
7. **Cancelamento/timeouts:** timeout por node/adapter; `AbortSignal` e parar subprocesso. `cancelled` significa o que Forge conseguiu encerrar, não presume cancelamento remoto. Persistir external job ID/reconcile; preservar outputs parciais.
8. **Eventos/erros:** transição, progresso medido, artifact, validation, authorization, review, timeout e reconcile. Estados distinguem `blocked`, `failed`, `cancelled`, `rejected`, `needs_reconciliation`; logs redigidos; percentuais desconhecidos são omitidos.
9. **Recursos/isolamento:** limites de tempo/bytes/outputs/threads; root explícito; credenciais mínimas host-side; rede declarada; sem shell genérico; cleanup só de temporários próprios; conflito de escrita bloqueia.
10. **UI e independência:** UI consome events/queries; engine funciona via facade local sem window, Agent ou MCP. Agent é cliente opcional, não executor privilegiado.

O runner atual implementa validações pontuais, snapshots, autorização, hashes, cancelamento de classe e retomada Blender limitada; não implementa scheduler DAG geral nem os 10 pontos completos. Isso permanece `PLANNED`.

## 6. Fatia implementada e resultados desta continuação

| Arquivo | Alteração | Motivo | Evidência / limite |
|---|---|---|---|
| `scripts/spriteforge-mcp.mjs` | Corrigido `countDistinctReferenceImages`: regex agora usa ponto literal antes de `png/jpg/jpeg/webp` em vez de escapar o backslash | Paths de referência POSIX terminando nessas extensões não eram contados; o MCP smoke falhava ao registrar três referências | `node tests/mcp-smoke.mjs` passou; fixtures são paths/bytes sintéticos, não decode de imagem real |
| `src/App.jsx` | Adicionado import de `Server` do `lucide-react`, já referenciado na ActivityPage | Evita identificador indefinido ao renderizar Activity | `npm run build` passou; não houve teste DOM/E2E da tela |
| `docs/PHASE-0-REPORT.md` | Criado este relatório técnico com auditoria, decisões, contratos, plano e prompts | Entregável principal da Fase 0 desta sessão | Conteúdo confrontado com código/fixtures; propostas seguem não aprovadas |
| `docs/README.md` | Indexado o relatório atual e apontada a precedência desta sessão | Evita que o snapshot de auditoria anterior pareça ser a única fonte atual | Leitura/revisão do índice; não é prova de runtime |
| `memory-bank/estado.md` | Adicionado snapshot desta continuação, testes, estado Git e próximos passos | Preserva memória operacional sem substituir snapshots históricos | Estado conferido com Git e comandos executados |

A primeira execução de `npm test`, antes do patch, falhou em `tests/mcp-smoke.mjs` com a asserção de três imagens de referência. A correção pequena, dirigida pelo teste, foi seguida por nova execução completa. Nenhuma regra de workflow ou manifesto foi alterada nesta fatia.

### Comandos executados e resultados observados

- `npm ci --ignore-scripts` — concluído após aviso prévio: 415 pacotes do `package-lock.json` instalados; scripts/postinstall ignorados. Seis vulnerabilidades moderadas relatadas pelo npm; sem `audit fix`/upgrade. Binário Electron ausente.
- `node tests/mcp-smoke.mjs` — passou após correção MCP.
- `npm test` — passou; 14 scripts em cadeia: MCP smoke, Vite store, ComfyUI client, task manager, navigation guard, IPC guard, asset progress, manual artifacts, external tools, workflow runner, workflow-run store, Blender workflow plan, Blender adapter e Lia paths.
- `npm run build` — passou; Vite 6.4.5, 1.578 módulos transformados.
- `python -m unittest discover -s tests -v` — 30/30 passou.
- `git diff --check` retornou sem avisos no diff rastreado. A checagem staged identificou três espaços finais usados como quebras Markdown no cabeçalho; troquei por `<br>` no relatório novo e reexecutei a validação. O arquivo termina com newline e os blocos de código estão balanceados. Nenhuma suíte foi tratada como E2E.

## 7. Pacotes de trabalho e divisão Arena/Codex/Paralelo/Bloqueado

Os protótipos abaixo ainda não foram implementados. Codex deve receber **um pacote por vez**; a proibição de editar mesmos arquivos concorrentemente permanece. Os nomes são paths novos, verificados como ausentes neste checkout ao preparar este relatório.

| Pacote | Classe | Responsável | Paths / contrato de integração | Dependências / risco |
|---|---|---|---|---|
| Auditoria, verificações e duas correções locais | `ARENA` — feito | Arena | `docs/PHASE-0-REPORT.md`, `scripts/spriteforge-mcp.mjs`, `src/App.jsx`, índice e memory-bank | Sem alteração de schema, provider ou funcionalidade deliberada |
| Contratos de domínio | `CODEX` — pronto para delegar após revisão | Codex; Arena revisa | Criar apenas `shared/domain/contracts.mjs` e `tests/domain-contracts-smoke.mjs`; API pura indicada no prompt | Não migrar JSON nem integrar UI/store; compatibilizar CJS/ESM por teste |
| Policy de AssetType no validador spritesheet | `CODEX` — interface proposta, aguarda aceite | Codex; Arena revisa | `electron/spritesheet-manifest.cjs`, `tests/spritesheet-manifest-policies-smoke.cjs`; policy explícita por chamada | Preservar schema v1 e fixture char/item; não alegar suporte novo no Blender/UI |
| Core puro de grafo DAG | `CODEX` — após review dos port contracts | Codex; Arena revisa | `electron/workflow-dag-core.cjs`, `tests/workflow-dag-core-smoke.cjs`; `validateGraph`, `topologicalLayers`, `subgraphForTargets` | Não integrar no runner/store; risco é prometer execução/paralelismo inexistentes |
| Evidência em ambiente Windows/Blender/ComfyUI | `PARALELO` | Responsável com target e ferramentas próprios, se/quando usuário iniciar/configurar | Checklist/harness existente; registrar OS, versões, inputs autorizados, comandos, hashes e limites | Não instalar ferramentas nesta sessão; E2E real, packaging NSIS e visual review só no target autorizado |
| API Vite/dev server, credenciais, plugin externo, migração de store, provider/modelo, benchmark público | `BLOQUEADO` até revisão/decisão | Arena prepara threat/migration plan; usuário decide efeitos e targets | `vite.config.js`/smoke, `.spriteforge/`/migration, credenciais, provider/rights/benchmark | Há risco de exposição/SSRF/CSRF, perda de dados, custo, upload/licença; não improvisar nem alterar permissões |

### Prompts prontos para Codex

#### A. Contratos de domínio

```text
Você é Codex no checkout Lia Forge. Não troque de branch, não faça commit/push, não instale dependências e não abra/rode local-renderer-test. Este pacote autoriza apenas um protótipo puro; não migre nem integre dados de produto.

Objetivo: implementar contracts tipados de Project, AssetType, Asset, Artifact, AssetVersion, Provenance e ValidationResult conforme “docs/PHASE-0-REPORT.md”, seção 4. Os tipos devem ser IDs cadastrados num registry extensível, nunca enum global character/item.

Paths autorizados: criar somente `shared/domain/contracts.mjs` e `tests/domain-contracts-smoke.mjs` (ambos ausentes no baseline). Se um path já existir quando iniciar, pare sem sobrescrever e reporte. Não edite package.json/lockfile, README/docs existentes, `src/App.jsx`, `electron/main.cjs`, stores, MCP, adapters, manifests ou workflows.

API ESM sem dependências: `createAssetTypeCatalog(definitions)`, `validateProject(value)`, `validateAsset(value,catalog)`, `validateArtifact(value)`, `validateAssetVersion(value)`, `validateProvenance(value)`, `validateValidationResult(value)`. O descriptor AssetType é data-only. `character`/`item` só são aceitos se registrados. Rejeite IDs vazios/duplicados, schemaVersion ausente, assetType desconhecido, Artifact sem hash/role/mediaType, Version sem refs válidas e ValidationResult sem artifact hash/validator version. Não invente política de licença nem acesso a filesystem.

Dependências: nenhuma implementação anterior; usa apenas os contratos conceituais da seção 4. Risco: consumers ESM/CJS podem divergir, então não prometa integração até conformance review.

Testes: `node tests/domain-contracts-smoke.mjs`; cubra tipos legacy registrados, novo type, unknown, duplicate ID, schema inválido, refs incompletas, input não mutado e erros sem segredo/prompt. Não afirme integração com UI/store.

Aceitação: smoke passa, zero dependências, nenhum JSON existente reescrito e comentários concisos documentam a API. Risco: protótipo não é schema final nem migration. Se a seção 4 deixar campo crítico ambíguo, pare e pergunte sem expandir paths.
```

#### B. Extensibilidade controlada do manifesto de spritesheet

```text
Objetivo: introduzir seam explícito de AssetType policy no validator de spritesheet sem transformar o manifesto v1 em enum universal e sem quebrar character/item.

Paths autorizados: `electron/spritesheet-manifest.cjs` e novo `tests/spritesheet-manifest-policies-smoke.cjs` apenas. Se path do teste existir, pare. Não edite blender-adapter.cjs, workflow-runner.cjs, main.cjs, `scripts/blender_spritesheet.py`, UI, stores, schemas, package.json nem lockfile. Não execute agentes concorrentes nestes paths.

Evidência lida diretamente: schemaVersion 1 aceita character/item, exige `origin:top-left`, anchor feet/center por tipo, sourceFrame inteiro para character e null para item, frames row-major, nomes de animação únicos, dimensões/grade e oito colunas no adapter. Hoje sourceFrame de character aceita inteiro negativo e pivot não é comparado semanticamente ao anchor; não altere essas regras legadas incidentalmente.

Interface proposta: manter `validateSpritesheetManifest(manifest, expected)` com comportamento/resultado legado. Acrescentar terceira opção explícita `{ assetTypePolicies }`, com descriptors data-only e imutáveis que declarem anchor e modo sourceFrame (`integer`, `null` ou `optional-integer`). Default continua fechado a character/item; custom type só passa se policy for explicitamente fornecida por chamador confiável. Sem registry global mutável, callback, plugin, import dinâmico ou inferência por extensão. Se a policy precisar de outra shape, pare para revisão, não amplie escopo.

Dependências: revisão/aceite de `AssetType` policy antes de implementação; nenhum pacote Codex pode editar o mesmo validator/teste ao mesmo tempo. Risco: falsa alegação de categoria executável, mitigada pelo escopo de validator-only.

Testes: novo smoke e `node tests/blender-adapter-smoke.cjs`; provar paridade de fixtures legadas, unknown rejeitado por default, custom aceito apenas com policy, anchor/sourceFrame inválidos rejeitados, expected dimensions/animations preservados. Não introduzir regra negativa nova para sourceFrame legacy sem caso e aprovação explícita.

Aceitação: schema v1/outputs existentes inalterados; nenhum path fora da lista; zero dependência; sem alegação de integração nova com Blender/UI. Relate “validator extensível por policy”, não “nova categoria end-to-end”.
```

#### C. Core puro de validação/topologia DAG

```text
Objetivo: criar core puro para validar e consultar topologia de WorkflowDefinition DAG; não substituir nem chamar runner atual.

Paths autorizados: novo `electron/workflow-dag-core.cjs` e `tests/workflow-dag-core-smoke.cjs` somente. Ambos foram verificados ausentes; se qualquer um existir ao iniciar, pare. Não edite workflow-runner.cjs, main.cjs, workflow contracts atuais, stores, UI, MCP, package.json/lockfile ou testes existentes.

Entrada v1 do protótipo: `{ id, schemaVersion, nodes:[{ id, inputContracts:[{id,artifactType,required,source?:{nodeId,outputId}}], outputContracts:[{id,artifactType,mediaTypes?}] }] }`. Input sem `source` é entrada externa; binding/runtime availability é validada fora deste módulo. Exporte `validateGraph(definition)`, `topologicalLayers(definition)` e `subgraphForTargets(definition, targetNodeIds, externalInputBindings=[])`, onde binding é `{nodeId,inputId,artifactRef}`. As dependências derivam de source→output; permita produtor declarado depois. Rejeite IDs duplicados/ausentes, self-edge, source órfã, tipo incompatível, port IDs repetidos e ciclos. `subgraphForTargets` retorna targets + produtores ancestrais necessários em ordem estável; input externo satisfeito pode cortar seus produtores ancestrais. Não marca nenhum predecessor como completed.

Restrições: não executar nodes, não criar Promise/scheduler/paralelismo real, timeout, retry, filesystem, rede, persistência ou migration; não alterar `validatePlan()` serial atual. Funções determinísticas e sem mutar input.

Dependências: aprovação de shape de input/output port e semântica dos bindings antes do código; pode ser um protótipo isolado, não depende da implementação A. Risco: callers podem tratar topologia como scheduler; documentar explicitamente que não executa.

Testes: singleton, chain, forward edge (producer declarado depois), fork/join, cycle, orphan, port/type mismatch, input intermediário satisfeito externamente, subgraph e ordem estável. Rodar `node tests/workflow-dag-core-smoke.cjs`.

Aceitação: smoke passa sem deps. Não declarar que Forge já executa DAG, paralelo, retry ou retomada geral. Se a modelagem de ports divergir dos contratos aprovados, pare para review.
```

#### D. Hardening Vite (pacote bloqueado; prompt só após aprovação de política)

```text
Não comece a editar até o usuário/Arena aprovar a política e revisar o threat model. Ao iniciar, paths autorizados serão `vite.config.js`, `scripts/spriteforge-mcp.mjs` e `tests/vite-store-smoke.mjs`; não mudar store schema, UI, provider client, dependencies ou lockfile.

Objetivo: restringir endpoints dev sem quebrar preview Arena, browser local e polling read-only MCP. Evidência atual: bind `0.0.0.0`, `allowedHosts:true`, PUT do store admite Origin ausente; middleware usa forwarded-host; status remoto pode consultar COMFYUI_URL; MCP `open_panel` inicia server em bind amplo. Não confie em forwarded headers arbitrários nem remova `0.0.0.0`/host per-session Arena para fazer teste passar.

Antes do código, descreva threat model e política efetiva. Prove por teste browser same-origin, cross-origin, Origin ausente, preview Arena explícito, proxy confiável configurado, MCP read-only, caller local autorizado se necessário, body grande, host privado/SSRF e status sem consent/config explícita. Mutação sem capability deve falhar fechado; status não pode gerar request remota implícita sem configuração/consentimento definidos.

Dependências: decisão explícita sobre host/permitted Origins, caller local, proxy trusted e consent de status. Risco: bloquear o preview/callers locais ou manter SSRF; os testes devem cobrir ambos sem confiar em header arbitrário.

Aceitação: testes do Vite e `npm test` passam; preview continua acessível no host proxied do Arena; zero dependências; nenhuma exceção ampla baseada apenas em Host/forwarded headers. Se interface de autorização não estiver decidida, pare e reporte opções.
```

## 8. Ordem de integração e critérios de conclusão da Fase 0

### Ordem segura

1. Usuário revisa/ajusta `AssetTypeId`, `OutputContract`, semântica de status e policy de migração; nenhum agente edita código antes desse review.
2. Codex implementa o pacote A nos dois paths isolados; Arena revisa API/testes. Não integra store/UI.
3. Depois da revisão de `AssetType` policy, Codex executa B, preserva validator v1 e adapter smoke; esse seam não é alegação de suporte a novo pipeline.
4. Codex implementa C após fechar port contracts; Arena revisa before/after. Scheduler, persistência, resource locks, retry/cancel e reconciliation ficam em outro pacote com plano.
5. Integração no runner/facade ocorre numa etapa subsequente, um owner por path, com compatibilidade/migration test e decisão explícita; nunca mexer em `.spriteforge/` neste pacote.
6. Em paralelo, coletar evidência de Windows/NSIS/Blender/ComfyUI em ambiente próprio já autorizado; não instalar nem baixar ferramentas automaticamente.
7. Revisar o pacote Vite/consent antes de qualquer hardening; não ampliar privilégio para manter preview.

### Critérios objetivos para encerrar Fase 0

1. Auditoria por subsistema cita código/interfaces/deps/testes/resultados/limites/riscos e ação preserve/adapt/replace, com estados `IMPLEMENTED`, `VERIFIED`, `PARTIALLY_IMPLEMENTED`, `DOCUMENTED`, `PLANNED`, `EXPERIMENTAL`, `BLOCKED`, `PROPOSED`; cada `VERIFIED` tem evidência estreita.
2. Usuário aprova ou ajusta identidade/versioning de `AssetType`, `OutputContract`, run/status semantics e migration policy; owners e schemas são versionados.
3. Contracts têm testes de legacy, extensibilidade/unknown, hash/provenance, erros e compatibilidade; nenhuma conditional por categoria espalhada.
4. Graph core prova cycle/branch/join/entry/ports; scheduler futuro declara locks/limits/timeouts/idempotency/retry/cancel/reconcile. Não se alega paralelo antes de testar.
5. UI usa facade/plans/events sem provider específico; Forge executa sem Agent/MCP; Hub e Skills não se autorizam reciprocamente.
6. Consent é por efeito/destino/dados/custo, incluindo unknown/install/download/license/overwrite; scope change invalida; segredo não aparece em Project/log/export.
7. Store migration tem dry-run, hashes, backup/rollback e fixtures, preservando paths/arquivos do baseline.
8. `npm test`, `npm run build` e Python suite passam no ambiente anotado; E2E/visual review são evidência separada e ocorrem no target real antes de promover status.
9. Windows packaging/runtime, Blender/ComfyUI e revisão visual são testados com tool/input/version real, sem instalação/download implícito; status por capability×adapter×target.
10. Git comparado ao baseline, nenhuma alteração preexistente descartada e nenhum commit/push sem autorização.

**Conclusão desta continuação:** auditoria técnica direta e comparação de decisões executadas; ambiente JS recuperado de modo controlado; testes npm/Python e build do renderer passam depois de duas correções mínimas. Contratos, scheduler DAG geral, integração real e validação Windows seguem `PROPOSED`/`PLANNED`/`BLOCKED`; a Fase 0 não é declarada encerrada. Próxima ação recomendada: revisão dos contracts com o usuário e delegação isolada dos prompts A–C.
