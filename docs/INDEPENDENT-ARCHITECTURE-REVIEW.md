# Lia Forge — Revisão independente de arquitetura e coerência do produto

> **Estado deste documento:** `AUDITORIA INDEPENDENTE` — análise transversal. Não implementa, não altera código nem contratos, não aprova decisões e não promove o estado de nenhuma capacidade.
> **Data:** 2026-11-14 (UTC).
> **Branch desta revisão:** `arena/624582f5-lia-forge`, criada de `main` @ `6bd9a5a7006c7c6ccf5edcb5d577283d61a39949`.
> **Código e documentos de arquitetura examinados:** `arena/649f88bd-3dspritesheet` @ `5b0ec51ecec1ea06b8228b03fc0f5d4b8b1f0471` (frente T13), lidos por `git archive` em diretório temporário fora do repositório. **Esse conteúdo não está em `main`** — ver §0.2.
> **Ambiente da revisão:** sandbox Linux, Node v22.22.3, Python 3.11.2, sem Blender, sem ComfyUI, sem GPU, sem `node_modules`. Não é o ambiente-alvo (Windows + AMD RX 580 8 GB).

---

## 0. Escopo, método e limites

### 0.1 Vocabulário de estado usado aqui

| Estado | Significado nesta revisão |
|---|---|
| `PROPOSED` | Existe apenas como proposta em documento, sujeita a decisão humana. |
| `PLANNED` | Aceito como direção ou roadmap, sem código. |
| `IMPLEMENTED` | Código existe no commit citado. Não diz que está ligado ao produto, nem que rodou. |
| `EXECUTED` | Rodou de fato. Sempre acompanhado de **quem, onde e com quê** (ferramenta real ou substituto de teste). |
| `VALIDATED` | Critério verificável **e** resultado observado **no escopo declarado**. Validação estrutural em sandbox não é validação no alvo. |

Acrescento uma distinção que os documentos anteriores usam de forma irregular e que muda as conclusões: **`IMPLEMENTED` ≠ ligado ao produto**. Vários mecanismos existem e passam em teste unitário, mas o caminho do produto não os aciona (§3.1, C-04).

### 0.2 Achado de método: as fontes obrigatórias não estão em `main`

A missão pede a leitura de nove documentos e a inspeção "dos módulos e contratos reais do código atual". Em `main` @ `6bd9a5a`:

- o repositório tem **42 arquivos, todos documentação** (`README.md`, `AGENTS.md` e `docs/`). **Não há código** — nenhum `package.json`, `electron/`, `shared/`, `src/`, `scripts/` ou `tests/`;
- **8 dos 9 documentos obrigatórios não existem**: `PRODUCT-ARCHITECTURE.md`, `ASSET-PIPELINES.md`, `WORKFLOW-ENGINE.md`, `INTELLIGENT-ORCHESTRATOR.md`, `TOOL-PROVIDER-HUB.md`, `DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`, `IMPLEMENTATION-AUDIT.md` e `DECISIONS-AND-OPEN-QUESTIONS.md`. Só `RESEARCH-CONSOLIDATION-2026-11-13.md` está presente;
- esses oito documentos e todo o código vivem na branch `arena/649f88bd-3dspritesheet` (206 arquivos), que **divergiu de `main` no commit inicial** `13dc4c7` — um commit que continha apenas o `README.md`. Pela API de comparação do GitHub, a T13 está **67 commits à frente e 3 atrás** de `main`; `main` nunca conteve código;
- a exclusão foi deliberada: `RESEARCH-CONSOLIDATION-2026-11-13.md` registra como "deliberately excluded" a branch T13 e todo o código-fonte.

Para cumprir a missão, li a branch T13 como **referência**, sem trocar de branch e sem trazer nada dela para esta. Toda citação `arquivo:linha` de código abaixo refere-se ao commit `5b0ec51`. **Nenhuma afirmação de `IMPLEMENTED` neste documento vale para `main`.** Este é, por si, o primeiro achado arquitetural (C-01).

### 0.3 O que foi feito

- **Lidos por inteiro ou quase:** `PRODUCT-ARCHITECTURE.md`, `WORKFLOW-ENGINE.md`, `INTELLIGENT-ORCHESTRATOR.md`, `DECISIONS-AND-OPEN-QUESTIONS.md`, `RESEARCH-CONSOLIDATION-2026-11-13.md`, `ADR-001`, `BLENDER-BRIDGE-SPECIFICATION.md`, `T14-AGENT-ORCHESTRATION-ARCHITECTURE.md`, e de `auditoria-blender-local/`: `README.md`, `BASELINE.md`, `ASSIMILACAO.md`, `CONTAGENS.json`.
- **Lidos em parte (cabeçalho de estado, seções-chave e busca dirigida):** `ASSET-PIPELINES.md`, `TOOL-PROVIDER-HUB.md`, `IMPLEMENTATION-AUDIT.md`, `DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md` (cabeçalho, §1.1, §8, §11 e índice), `T13-IMPLEMENTATION-EVIDENCE.md`; os dois outros documentos Blender; Three.js `README`, `05`, `06`, `12`, `13` (os demais 13 capítulos só por busca); as três outras peças T14; `LICENCAS-E-DEPENDENCIAS.md`, `CAPACIDADES.md`, `DUPLICATAS.md`, `PROJETOS-BLENDER.md`.
- **Não lidos:** `ADDONS.md` e os JSON grandes da auditoria local (`ADDONS.json`, `BLENDS.json`, `FONTES-SHA256.json`, `INVENTARIO.json`, ~1,9 MB). A missão pede "toda" essa documentação; a cobertura real é a descrita aqui, e as conclusões sobre essas frentes devem ser lidas com esse limite (§A.7).
- Leitura dirigida do código T13: `shared/` (domínio, capabilities, hub, SDK, engine, gates, planner, serviço, assets, QA, destinos, integrações), `electron/` (main, adapters, runner legado, Blender), `scripts/spriteforge-mcp.mjs`, `vite.config.js`, `package.json`.
- Execução da suíte de smoke tests do próprio projeto, sem instalar nada (§A.2), e de uma sonda de planejamento de 20 linhas contra o serviço real (§A.3).
- Verificações mecânicas: links relativos quebrados em `main` e ids de capability citados nos documentos × registro real (§A.4, §A.5).

### 0.4 O que **não** foi feito

- Nenhum código, contrato, teste ou documento existente foi alterado. O único arquivo criado é este.
- Nenhuma dependência instalada; nenhum add-on, Blender, ComfyUI ou binário externo executado; nenhuma chamada de rede a provider.
- Nenhuma das falhas de segurança descritas foi explorada: as cadeias em §6 são **leitura de código**, não demonstrações.
- Nenhuma validação no hardware-alvo, em Windows, com Blender real ou com modelos reais.
- Não refiz as auditorias especializadas (add-ons Blender, pesquisa técnica Three.js, catálogo T14). Uso-as como insumo e aponto apenas o que as atravessa.
- Não é parecer jurídico. Os pontos de licença são riscos a revisar, não conclusões legais.

---

## 1. Resumo executivo

1. **O produto descrito não está na linha principal.** `main` é só documentação de pesquisa que cita, 43 vezes, arquivos que não existem nela. O código e a arquitetura vivem numa branch que divergiu de `main` no commit inicial (só `README`) e está 67 commits à frente, sem nunca ter sido consolidada. Qualquer roadmap que ignore isso planeja sobre uma base que ninguém consolidou.

2. **A branch T13 contém engenharia real e, em boa parte, cuidadosa** — DAG com checkpoints e retomada, gates com fingerprint e SHA-256, Hub que só descobre e não instala, Electron com `contextIsolation`/`sandbox`, e honestidade consistente sobre o que não foi executado. **30 de 33 smoke tests passaram nesta revisão** (os 3 restantes dependem de `node_modules`). Não é demonstração vazia.

3. **Mas é engenharia sem gate registrado.** O ADR-001 declara `Implementação/migração: NOT AUTHORIZED`, e a spec de domínio declara `NOT AUTHORIZED FOR IMPLEMENTATION`. A T13 acumulou 67 commits, incluindo um protótipo de domínio e escrita em `.spriteforge/assets.json`. Não encontrei, nos documentos lidos, registro de autorização que substitua esses gates. Ou a autorização existiu e não foi registrada, ou a governança documental não governa. Nos dois casos, o documento que deveria ser a fonte de verdade não é.

4. **Há dois produtos dentro do produto.** Um caminho legado (`electron/workflow-runner.cjs`, `lia-forge:assets:*`, `App.jsx`, estágios fixos, `.spriteforge/runs/`) e um caminho novo (`shared/engine`, `lia-forge:studio:*`, `ForgeStudio.jsx`, receitas, `.lia-forge/runs/`) coexistem, com modelos de workflow, autorização e armazenamento diferentes. O MCP é um terceiro caminho que não passa por nenhum dos gates do segundo.

5. **Os gates mais importantes existem, mas não estão ligados.** O gate de autorização por fingerprint só roda se o chamador passar `scope` — e o serviço do produto nunca passa. Direitos são classificados e exibidos, mas **nada no caminho de execução ou exportação os consulta**. `attachRunToAsset` grava `validated: true` como literal. O princípio "nenhum gasto/upload sem autorização" hoje é sustentado por um flag persistente por provider, exatamente o que `WORKFLOW-ENGINE.md` diz que a autorização não deve ser.

6. **Existe uma exposição P0 de segurança concreta.** A API HTTP do Studio sobe em `0.0.0.0` com `allowedHosts: true`, sem autenticação, aceitando requisições sem `Origin`; por ela é possível configurar o caminho do "executável do Blender" (cuja identidade o adapter declara não verificar) e iniciar um run. Uma ferramenta MCP (`spriteforge_open_panel`) sobe esse mesmo servidor em `0.0.0.0` a pedido de um agente.

7. **Capabilities não são contratos.** Entradas e saídas são texto livre (`'model/*'`, `'acoes'`, `'rig'`). Resultado observado: no pipeline de personagem **3D**, o planner atribui o passo "Animações" ao adapter de rig **2D** (`rig2d-software`), sem bloqueio. E as três frentes de pesquisa usam vocabulários próprios: dos 14 ids de capability citados nos documentos Blender, **nenhum** existe no registro.

8. **As três pesquisas (Blender, Three.js, T14) são boas isoladamente e não compõem entre si.** Cada uma propõe seu próprio contrato de execução (Job JSON do Bridge, `View3DSession`, `step-contract` de agente), sobre um engine que já tem o seu, sobre uma spec de domínio que não foi aprovada. São quatro contratos de passo e nenhum dono.

9. **Nenhum workflow de ponta a ponta com ferramenta externa real foi `EXECUTED`, e nada foi `VALIDATED` no alvo.** O render Blender — a única etapa com ferramenta externa que o ADR-001 escolheu como primeira homologação — só rodou contra substitutos de teste. Three.js não existe no código (`package.json` não o declara). Bridge e agentes são `PROPOSED`.

10. **Recomendação central:** parar de abrir frentes. Antes de viewport, Bridge geral, agentes ou spec completa, fazer **uma** fatia: levar para `main` o caminho governado mínimo e provar, com Blender real na máquina do usuário, `GLB existente → spritesheet → validação → revisão humana → versão → exportação`, fechando no percurso os P0 de segurança e integridade. É a homologação que o ADR-001 (Decisão 4) já escolheu e que ainda não aconteceu.

---

## 2. Estado real da arquitetura

### 2.1 Por repositório/branch

| Local | Conteúdo | Estado |
|---|---|---|
| `main` @ `6bd9a5a` | 42 arquivos de documentação: marca, pesquisas Blender/Three.js/T14, auditoria local Blender | Pesquisa `PROPOSED`; **zero código**; 43 de 191 links relativos quebrados (17 alvos ausentes) |
| `arena/649f88bd-3dspritesheet` @ `5b0ec51` | App Electron/React, `shared/`, adapters, MCP, 33 smoke tests, ~60 documentos | `IMPLEMENTED` em branch divergente desde o commit inicial (67 à frente, 3 atrás de `main`); não consolidado |
| `arena/7c135d59-lia-forge` (Blender), `arena/c61c7ae8-lia-forge` (Three.js) | Citadas como origem das pesquisas | **Não existem mais no remoto** (`git ls-remote` lista só `main` e `arena/649f88bd`). O que não foi copiado para `main` no PR #2 não é recuperável a partir do remoto; pode existir em checkouts locais do usuário (`BASELINE.md` os menciona) |

### 2.2 Por módulo (código = T13 @ `5b0ec51`)

Colunas: **Impl.** = código existe; **Ligado** = acionado pelo caminho do produto; **Exec.** = rodou, e com quê; **Valid. alvo** = validado em Windows/RX 580 com ferramenta real.

| Módulo | Impl. | Ligado | Exec. | Valid. alvo | Observação independente |
|---|---|---|---|---|---|
| Shell Electron + UI React | Sim | Sim | Testes de render de UI não rodaram aqui (falta `node_modules`) | Não | `contextIsolation`, `sandbox`, `webSecurity` ativos (`electron/main.cjs:878–881`). Sem CSP |
| Capability Registry (49 ids, 7 famílias) | Sim | Sim | Sim (smoke, nesta revisão) | n/a | I/O em texto livre; mistura verbos e tipos de asset; campo `providers` duplica o vínculo que o Hub deveria ter (D-05) |
| Adapter SDK + Hub | Sim | Sim | Sim (smoke) | Não | Hub só descobre, não instala — coerente com o princípio. Documento e código divergem nas classes (C-08) |
| Planner ("Intelligent Orchestrator") | Sim | Sim | Sim (smoke + sonda §A.3) | n/a | Determinístico, 8 receitas fixas. Não é "inteligente" nem genérico; casa capability por id, sem checar tipos (G-01) |
| Engine DAG (`shared/engine`) | Sim | Sim | Sim (smoke, com substitutos) | Não | Retomada/cancelamento reais em teste. Concorrência padrão 1. Gate de autorização por escopo **não ligado** (C-04) |
| Runner legado (`electron/workflow-runner.cjs`, 1.250 linhas) | Sim | Sim | Sim (smoke) | Não | Segundo engine vivo, com contratos e autorização próprios (D-01) |
| Domain contracts (`shared/domain/contracts.mjs`) | Sim | **Não** | Sim (smoke) | n/a | Nenhum código de produção o importa. Cobre 6 validadores; a spec propõe 17 tipos (C-03) |
| Asset Manager + direitos | Sim | Sim | Sim (smoke) | Não | Grava em `.spriteforge/assets.json`. Direitos **não bloqueiam** nada (C-05) |
| QA estrutural (PNG, atlas, GLB, manifesto) | Sim | Sim | Sim (smoke, fixtures) | Não | Sólido no que se propõe. Não há QA visual; revisão humana é um booleano + texto livre |
| Adapter Blender spritesheet | Sim | Sim | **Só com substituto de teste** | Não | Sem `--factory-startup` nem `--disable-autoexec` (R-04). Identidade do executável não verificada |
| Adapters ComfyUI (local/remoto) | Sim | Sim | **Só com servidor de teste em loopback** | Não | Autorização remota = flag persistente por provider (C-04) |
| MCP (`scripts/spriteforge-mcp.mjs`) | Sim | Caminho próprio | Não rodou aqui (falta `node_modules`) | Não | Escreve no store e sobe servidor em `0.0.0.0`; sem papéis, sem allowlist, sem gates do engine (R-02, C-06) |
| Viewport Three.js | Não | — | — | — | `PROPOSED`. `three` não está em `package.json`; a UI declara "NOT A MODEL VIEWER" (`src/App.jsx:1399`) |
| Blender Bridge geral | Não | — | — | — | `PROPOSED` |
| Papéis de agente / contrato de passo T14 | Não | — | — | — | `PROPOSED` |
| Skills & Knowledge Engine | Não | — | — | — | `PLANNED` |
| Benchmark / comparação visual | Parcial (Comparison Lab de métricas) | Sim | Sim (smoke) | Não | Compara números de arquivo, não qualidade |
| Auditoria local Blender | n/a | n/a | `EXECUTED` em Windows pelo autor (enumeração e leitura estática) | `VALIDATED` só no escopo estático | 53 de 238 compactados com listagem falha/parcial; nenhum add-on executado |

**Leitura honesta do conjunto:** o que está `VALIDATED` é estrutura de arquivo em fixtures sintéticas, em Linux. O que o produto promete — produzir um asset de jogo real com ferramenta real — não foi executado uma única vez de ponta a ponta. Os próprios documentos T13 dizem isso; registro aqui para que o volume de código e de testes não seja lido como maturidade de produto.

---

## 3. Contradições e duplicações

### 3.1 Contradições entre arquitetura documentada e código

| ID | Contradição | Evidência | Gravidade |
|---|---|---|---|
| **C-01** | **`main` não contém o produto.** A arquitetura, as decisões e o código estão numa branch nunca consolidada; `main` tem pesquisa que referencia arquivos ausentes. | §0.2; §A.4 (43 links quebrados; alvos: `DECISIONS-AND-OPEN-QUESTIONS.md`, `TOOL-PROVIDER-HUB.md`, `T13-IMPLEMENTATION-EVIDENCE.md`, `../electron/blender-adapter.cjs`, `../memory-bank/estado.md` etc.) | P0 arquitetura |
| **C-02** | **Implementação sem gate registrado.** ADR-001: `Implementação/migração: NOT AUTHORIZED` e "A execução desse pacote exige autorização separada e revisão independente". T13: 67 commits à frente de `main`, a maior parte implementação. `T13-IMPLEMENTATION-EVIDENCE.md` declara-se "registro de execução (não é proposta nem autorização)". | `docs/ADR-001-LIA-FORGE-DECISIONS.md` (cabeçalho e "Gate de implementação"); `git log` da branch | P0 governança |
| **C-03** | **Spec de domínio não aprovada × protótipo implementado e desligado.** A spec (247 KB, 17 tipos, 12 decisões pendentes) proíbe implementação. Existe `shared/domain/contracts.mjs` com 6 validadores e ids/semântica próprios — e **nenhum módulo de produção o importa** (só `tests/domain-contracts-smoke.mjs`). O Asset Manager real usa outro modelo. | `grep -rn "domain/contracts"` fora de `tests/` → vazio; `shared/assets/manager.mjs` | P0 arquitetura |
| **C-04** | **Autorização por escopo: implementada, testada, não ligada.** `WORKFLOW-ENGINE.md`: "A autorização não é uma flag genérica de sessão". No engine, o gate só roda `if (scope)` (`shared/engine/execution-manager.mjs:190`). O serviço chama `manager.execute(plan, { context, authorization, … })` **sem `scope`** (`shared/services/studio-service.mjs:901`), e o handler IPC `lia-forge:studio:run` nem repassa `authorization` (`electron/main.cjs:1105–1115`). O que de fato libera envio remoto é `providers.comfyui.authorization.granted`, persistido em `.lia-forge/providers.json` (`shared/integrations/provider-store.mjs:203–214`) — um flag por provider, sem hash de entrada, sem expiração, com escopo em texto livre (`'send_data+cost'`). | Linhas citadas; `grep -n scope shared/services/studio-service.mjs` → vazio | **P0 segurança/consentimento** |
| **C-05** | **Direitos são informativos, não um gate.** Princípio 7 e ADR-001 D6 exigem direitos em cada transformação. O código classifica (`classifyRights`, 6 estados, incluindo `blocked`) e exibe um relatório; nenhum caminho de execução, anexação ou exportação consulta o estado. `exportRun` empacota qualquer run sem olhar direitos, status do run ou revisão pendente (`studio-service.mjs:1205–1232`). | Usos de `classifyRights`/`rightsReport` fora do manager: só leitura e reexport | **P0 direitos** |
| **C-06** | **"Revisão humana indelegável" × caminhos que a contornam.** (a) `reviewStep` aceita `reviewer` como texto vindo do chamador e sobrescreve `reviews.json` por `stepId` com `writeFile` simples — não é append-only nem atômico (`studio-service.mjs:1096–1113`); a spec exige `HumanReview` append-only. (b) O MCP permite a um agente marcar uma etapa como `completed` (`spriteforge_update_stage`, `scripts/spriteforge-mcp.mjs:550`), sem gate humano. (c) Pela API HTTP sem autenticação, `POST /runs/{id}/review` aprova. | Linhas citadas | P0 integridade |
| **C-07** | **`validated: true` como literal.** `attachRunToAsset` registra todo artefato emitido por um run como `validated: true`, sem ler `step.validations`, estado do run ou revisão (`studio-service.mjs:1276`). Contraria o princípio 2 ("sem outputs ou progresso simulados"). | Linha citada | P0 integridade |
| **C-08** | **Documento descreve classes de adapter que o código não tem.** `TOOL-PROVIDER-HUB.md` (cabeçalho): classes `local-tool`, `internal-process`, `remote-service`. Código: `['execution', 'manual-editing', 'remote-service']` (`shared/adapters/sdk.mjs:27`). O manifesto proposto no mesmo documento usa ainda um terceiro conjunto (`local-model \| local-tool \| cloud-api \| manual`). | Linhas citadas | P2 |
| **C-09** | **`IMPLEMENTATION-AUDIT.md` contradiz os documentos irmãos.** A matriz (snapshot 2026-11-06) marca "Engine geral baseado em grafo", "Tool/Provider Hub" e "Intelligent Orchestrator genérico" como `PLANNED`; os cabeçalhos de `WORKFLOW-ENGINE.md`, `TOOL-PROVIDER-HUB.md` e `INTELLIGENT-ORCHESTRATOR.md` os dão como "parcialmente implementado (T13, 2026-11-13)". O documento que os outros apontam como "estado verificável" é o mais desatualizado. | Matriz de capacidades × cabeçalhos | P1 |
| **C-10** | **`.spriteforge/` "permanece intacto" × três escritores.** ADR-001 D3: `.spriteforge/` intacto, "nenhuma … escrita de formatos legados está aprovada". O serviço novo grava `.spriteforge/assets.json` (`studio-service.mjs:380–402`); o IPC legado `lia-forge:assets:write` grava o array inteiro vindo do renderer (`electron/main.cjs:1007`); o MCP grava o mesmo arquivo (`spriteforge-mcp.mjs:19,139`). `projectInfo` diz ao usuário que o conteúdo legado "é preservado: o produto não move, não converte". Leitura-modificação-escrita do arquivo inteiro, sem lock entre processos. | Linhas citadas | P0 integridade |
| **C-11** | **Adapter Blender atual × regras de segurança do próprio Bridge proposto.** O Bridge exige "sempre" `--factory-startup` e `--disable-autoexec` (§6.1, §10.3). O adapter em produção lança `--background --python <script>` sem nenhum dos dois (`electron/blender-adapter.cjs:69–70`) e abre `.blend` com `bpy.ops.wm.open_mainfile` (`scripts/blender_spritesheet.py:59`). A auditoria local, corretamente, usou os dois. | Linhas citadas; `auditoria-blender-local/README.md` | P0 segurança (ver R-04) |
| **C-12** | **Versão-alvo do Blender.** Bridge: 4.2 LTS "primário", 5.0+ "monitorar". Auditoria local: o Blender instalado na máquina do usuário é **5.3.0** (Steam). Nenhum documento reconcilia. | `BLENDER-BRIDGE-SPECIFICATION.md` §12.1 × `auditoria-blender-local/README.md` | P1 |
| **C-13** | **Licença do MPFB.** Pesquisa de ecossistema: `AGPL-3.0` com alerta de copyleft forte. Auditoria local, lida do pacote: `GPL-3.0-or-later`. Podem ser versões diferentes, mas a consequência para o produto é muito diferente e não está resolvida. | `ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md:518`, `BLENDER-ADDONS-MATRICES.md:48` × `LICENCAS-E-DEPENDENCIAS.md` | P1 direitos |
| **C-14** | **"Sem pin de versão" × proveniência pinada.** Bridge §12.2: "Não há pin de versão — o Bridge usa o que o usuário instalou". `ASSET-PIPELINES.md`: "Origem e versão pinadas… nada de 'última versão' implícita". Registrar a versão depois não é o mesmo que planejar contra uma versão. | Trechos citados | P2 |
| **C-15** | **Renderer WebGL: candidato ou só inspetor?** ADR-001 D5 manda comparar "Blender e WebGL/SpriteForge sobre o mesmo input/hash". A frente Three.js recomenda que o viewport **não** seja renderer (decisão 56, opção A). As duas posições são defensáveis; não podem valer juntas sem registro. | ADR-001 D5 × `threejs-3d-environment/12`, decisão 56 | P1 decisão |
| **C-16** | **Registro de decisões bifurcado.** A frente Three.js afirma que `DECISIONS-AND-OPEN-QUESTIONS.md` vai até a questão **62**. A única cópia sobrevivente do arquivo (T13) termina na **44**. As questões 45–62 só existem dentro de `threejs-3d-environment/12`; as 7 decisões da T14 não têm número; as 12 da spec têm numeração própria. | `threejs-3d-environment/12:3` × `DECISIONS-AND-OPEN-QUESTIONS.md` (T13) | P1 governança |
| **C-17** | **Servidor HTTP: rejeitado e existente.** A frente Three.js descarta "servidor HTTP local dentro do app" por "duplicar transporte e superfície" (decisão 49, opção D) e, no mesmo parágrafo, propõe mais uma rota HTTP de arquivo para o preview. O transporte HTTP já existe e é o maior risco do produto (R-01). | `threejs-3d-environment/12`, decisão 49; `06` §5 | P1 |

### 3.2 Duplicações de responsabilidade

| ID | Duplicação | Evidência | Consequência |
|---|---|---|---|
| **D-01** | **Dois engines de workflow.** `electron/workflow-runner.cjs` + `workflow-contracts.cjs` + `workflow-run-store.cjs` (serial, 5 estágios fixos, `.spriteforge/runs/`) e `shared/engine/*` + `shared/orchestrator/planner.mjs` (DAG, receitas, `.lia-forge/runs/`). Ambos com handlers IPC ativos (`lia-forge:workflow:*` e `lia-forge:studio:*`). | `electron/main.cjs:1016–1160` | Dois modelos de run, de retomada e de autorização para manter e auditar |
| **D-02** | **Quatro contratos de "passo".** (1) contrato legado humanoide (`workflow-contracts.cjs`); (2) passo de receita do planner; (3) Job JSON do Bridge (§4); (4) `step-contract` da T14 (§4). Mais `View3DSession` como quinto registro de execução. Nenhum referencia os outros. | Documentos e arquivos citados | Cada frente, se implementada como escrita, cria um executor paralelo |
| **D-03** | **Três vocabulários de ação protegida.** Legado: `send_prompt_or_references`, `paid_generation`, `download_result`, `send_model`, `paid_rigging`… (`workflow-contracts.cjs:20–68`). Novo: `send_data`, `cost`, `install_software`, `download_models_or_weights`. Documento: tabela de 6 gates incluindo "sobrescrever/apagar" e "gerar localmente", que nenhum dos dois códigos modela. | Linhas citadas; `WORKFLOW-ENGINE.md` "Contrato de autorização" | Não há uma lista única do que exige consentimento. **Sobrescrita/exclusão não é ação protegida em lugar nenhum** |
| **D-04** | **`protectedActions` com dois sentidos opostos.** No manifesto do adapter significa "o que o adapter se **recusa** a fazer" (`T13-IMPLEMENTATION-EVIDENCE.md:72`) — por isso todos os 7 manifestos listam as 4 ações. No passo do plano significa "o que **exige autorização**". A proposta Three.js copia a lista para o manifesto do viewport. | Manifestos em `electron/adapters/*.mjs`, `shared/adapters/software.mjs`; `planner.mjs:110` | Campo de segurança ambíguo; quem ler o manifesto conclui o contrário do que ele diz |
| **D-05** | **`PROTECTED_ACTIONS` e `redactSecrets` definidos duas vezes**, em `shared/adapters/sdk.mjs:56–73` e `shared/engine/gates.mjs:34–49`, com **expressões regulares diferentes** (uma cobre `credential` e `signature`, a outra não). O comentário diz "idêntica em log, evento de UI, erro e relatório". | Linhas citadas | O que é redigido depende de qual módulo escreveu o log |
| **D-06** | **Vínculo capability↔adapter declarado dos dois lados.** O registro diz "não conhece ferramentas" e tem campo `providers`; o adapter declara `capabilities`. | `shared/capabilities/registry.mjs:1–16`, linhas de definição | Duas fontes para a mesma relação |
| **D-07** | **Três modelos de direitos/consentimento.** `RIGHTS_STATES` do Asset Manager (6 estados em texto); `RightsRecord`/`ConsentRecord` + matriz §3.17 da spec (não aprovada); classificação de dados `public/internal/private/secret` da T14. | `shared/assets/manager.mjs:21`; spec §3.15–3.17; T14 §6 | Sem modelo único, o gate de direitos (C-05) não tem o que consultar |
| **D-08** | **Dois diretórios de projeto e dois transportes.** `.spriteforge/` e `.lia-forge/`; IPC e HTTP "um sistema só, dois transportes". | `studio-service.mjs:42,380`; `vite.config.js` | O segundo transporte não tem o guard do primeiro (`assertTrustedIpcSender`) |
| **D-09** | **Seis vocabulários de estado.** Auditoria T13 (8 rótulos), registro de capabilities (`implemented/partial/proposed/planned`), Three.js (Observado/Executado/Hipótese/Proposta/Não verificado), add-ons (`MANUAL/ADAPT/REFERENCE/REUSE/BLOCKED_PENDING_LICENSE_REVIEW`), matrizes Blender (`INTEGRAR/ADMIT_WITH_RESTRICTIONS`…), e os cinco desta missão. | Documentos citados | "implemented" no registro ≠ `IMPLEMENTED` na auditoria ≠ executado |
| **D-10** | **Três "Studio".** Já registrado pela própria documentação (questão 28); permanece sem decisão. | `PRODUCT-ARCHITECTURE.md` | Ruído, não risco |

### 3.3 Abstrações desnecessárias ou prematuras

- **Spec de domínio com 17 tipos antes do primeiro asset real.** `ProjectVisualProfile`, `ConsistencyAssessment`, `StyleDeviationDecision`, `ChangeImpactReport`, `ImpactDecisionEvent` descrevem governança de identidade visual para um produto que ainda não produziu um único artefato com ferramenta real. O núcleo necessário para a primeira homologação é bem menor (§7, DEC-03).
- **Contrato compartilhado Lia Studio ↔ Lia Forge (alternativas A/B/C).** Discussão legítima, mas a ponte "não está aprovada nem implementada" dos dois lados. Decidir a forma do contrato compartilhado antes de a Forge ter contrato próprio em uso é ordem invertida.
- **Viewport como "adapter" do Hub.** A proposta Three.js modela um módulo interno de UI como adapter classe `execution` com capability `model3d.preview`, e em seguida ressalva que "não deve aparecer como ferramenta instalada no Hub". Se precisa de exceção para não parecer adapter, não é adapter. O viewport é um módulo de apresentação que **consome** artefatos; não precisa passar pelo planner.
- **8 papéis de agente.** O que diferencia `lia.concept-2d` de `lia.environment` é um conjunto de capabilities permitidas. Isso é uma **política de permissão**, não uma entidade. Um único conceito ("perfil de permissão de um cliente externo") cobre os oito.
- **Tipos de asset como capabilities.** `character.humanoid`, `character.creature`, `image2d.icon`, `image2d.tileset` são tipos de resultado, não operações. Misturados a verbos (`model3d.retopologize`, `render.atlas`) no mesmo registro, impedem a tipagem de I/O (G-01).

### 3.4 O que está bem separado (para não ser desfeito)

- **Hub descobre, não instala nem executa.** Coerente com o princípio de autorização. Estados `ready/unknown/missing/blocked` com motivo nomeado.
- **Planner não executa; engine não planeja.** A fronteira existe e é respeitada no código novo.
- **`unknown` como estado de primeira classe** em custo, hardware, VRAM e licença. Disciplina rara e valiosa.
- **Validadores estruturais puros**, sem I/O, reutilizáveis.
- **Electron endurecido** no essencial e guard de remetente em todos os canais IPC.
- **Honestidade de evidência**: substitutos de teste são nomeados como substitutos.

---

## 4. Lacunas que bloqueiam workflows reais

"Workflow real" aqui: um usuário obtém um asset utilizável em jogo, com ferramenta real, com proveniência e direitos que resistam a uma pergunta posterior.

| ID | Lacuna | Por que bloqueia | Estado |
|---|---|---|---|
| **G-01** | **Capabilities sem tipos de entrada/saída verificáveis.** I/O é texto livre; planner e Hub casam só o id. | **Observado (`EXECUTED`, §A.3):** em `3d-character-spritesheet`, o passo `animate` (`motion.cycles`, depende de `auto-rig`, deve animar um modelo 3D rigado) é atribuído a `rig2d-software` sem motivo de bloqueio. Em `3d-object-render`, `atlas` também vai para `rig2d-software`. Hoje os passos anteriores bloqueiam o run; no dia em que houver um adapter de rig 3D, o plano encadeará GLB em um adapter 2D. Sem tipos, "provider-neutral" vira "qualquer provider serve". | Falha de desenho `IMPLEMENTED` |
| **G-02** | **Não há caminho de produto para conceder autorização por run.** | Passos com `protectedActions` (ex.: `generate-3d`) ficam bloqueados para sempre: o IPC não transporta autorização, e não há UI que produza o fingerprint (C-04). É fail-closed — bom — mas significa que **nenhuma rota generativa paga ou com download pode rodar pelo caminho governado**. | Ausente |
| **G-03** | **Nenhuma execução com ferramenta externa real.** | Blender e ComfyUI só rodaram como substitutos. Compatibilidade de versão (5.3 instalado × 4.2 presumido), EEVEE em RX 580, tempo, memória e aparência são desconhecidos. | Não `EXECUTED` |
| **G-04** | **Sem modelo de versão de asset com promoção.** | O Asset Manager acumula versões com artefatos; não há "versão corrente aprovada", vínculo revisão→versão por hash, nem bloqueio de promoção. A cadeia `run → revisão → versão → exportação` não existe como invariante: cada elo é uma chamada independente (C-06, C-07). | Parcial |
| **G-05** | **Sem armazenamento de artefatos endereçado por conteúdo.** | Artefatos vivem em `.lia-forge/runs/<id>/`; a versão guarda caminho + hash. Apagar ou mover a pasta do run quebra a versão. Não há deduplicação nem verificação de integridade na leitura. | Ausente |
| **G-06** | **Importação de asset existente como entrada de primeira classe.** | A rota "Asset existente → editar/converter" — a mais barata e a que os 580 `.blend` e os GLB do usuário alimentariam — depende de `input/` + inspeção GLB. Não há registro de origem/direitos no ato da importação, e `.blend`/FBX não têm inspetor (só extensão). | Parcial |
| **G-07** | **GLB como formato central sem validação à altura.** | Ver §5.3: o inspetor lê estrutura; não valida conformidade glTF, não mede skins/animações de forma utilizável por um gate, não registra o que a exportação do Blender omitiu. | Parcial |
| **G-08** | **Exportação por destino não verificada em nenhum destino.** | `export.engine` gera pacote + manifesto segundo perfis declarados. Nenhuma importação real em Godot/Unity/Unreal foi observada. Um manifesto correto não é um asset que abre. | Não `VALIDATED` |
| **G-09** | **Reconciliação de efeitos remotos.** | Documentada como alvo; ausente. Um crash depois de enviar um job pago resulta em reenvio às cegas ou em perda. Bloqueia qualquer provider pago. | `PLANNED` |
| **G-10** | **Revisão humana sem evidência visual vinculada.** | A revisão é `approved: true` + nota sobre um hash. Não registra o que a pessoa viu (qual render, em que escala, comparado com quê). Para 3D, não há como olhar o modelo dentro do produto. | Parcial |
| **G-11** | **Taxonomia do caminho legado limitada a `character`/`item`.** | `buildBlenderSpritesheetArgs` recusa qualquer outro tipo (`blender-adapter.cjs:65`). O único adapter de ferramenta externa de autoria herda o enum que a arquitetura diz não ter. | `IMPLEMENTED` |
| **G-12** | **Instalador e execução em Windows.** | `electron-builder` configurado; build, instalação e uso em Windows não observados. | `BLOCKED` (já registrado pela T13) |

**Avaliação:** a arquitetura **comporta** pipelines reais no desenho — DAG, gates, adapters, proveniência por passo são a forma certa. Mas hoje ela comporta sobretudo os pipelines que não precisam de ninguém: os 5 workflows "executáveis" são os que rodam só com adapters internos em software (operações 2D, rig 2D procedural, VFX procedural, inspeção GLB, empacotamento). Tudo que envolve Blender, ComfyUI ou um provider está bloqueado ou só simulado por substituto. O risco é a base interna crescer em largura (mais receitas, mais validadores, mais documentos) sem nunca atravessar a fronteira com uma ferramenta real — que é onde a arquitetura será de fato testada.

---

## 5. Avaliação de Blender, Three.js, GLB/glTF e agentes

### 5.1 Blender — ferramenta de autoria

**O que está certo.** Subprocesso sem shell, script fixo, progresso por stdout, cancelamento por sinal, validação do PNG e do manifesto na saída. A fronteira "Blender é processo separado, a Forge governa" é respeitada. A auditoria local foi feita com o cuidado correto (factory startup, autoexec desligado, nada executado).

**O que precisa de correção antes de qualquer uso real.**

1. **Flags de segurança ausentes no adapter em produção** (C-11, R-04). É uma linha de diferença e é pré-condição para abrir qualquer `.blend` que não tenha sido criado pelo próprio usuário — e o acervo local tem 580.
2. **Identidade do executável não verificada.** O adapter declara que não roda `--version` no caminho configurado. A intenção (não executar arquivo desconhecido na descoberta) é boa; a consequência é que o run executa o que estiver configurado. Combinado com R-01, é a peça final de uma cadeia de execução de código.
3. **O Bridge proposto não herda os gates do engine.** O Job JSON (§4.1) usa caminhos absolutos, não tem hash de entrada, não tem referência à autorização nem a direitos, e a saída não traz SHA-256. O documento afirma "Domain Contracts: os contratos de input/output permanecem os mesmos" e "QA: as validações existentes são suficientes" — a primeira afirmação não tem contrato a que se referir, e a segunda não se sustenta para morph targets, skins e VRM, que o validador GLB atual não mede.
4. **`--factory-startup` × add-ons do usuário.** O Bridge quer os dois. Factory startup ignora as preferências do usuário; habilitar add-ons por `addon_utils.enable()` depende de onde foram instalados (o próprio documento reconhece o risco em §6.2). Não é contradição insolúvel, mas é o ponto técnico central do Bridge e está como nota de rodapé. Precisa de um experimento, não de mais especificação.
5. **Binários proprietários.** O Bridge cataloga `model3d.skin-voxel-heat` chamando `vhd` por subprocesso; a auditoria local classifica Voxel Heat Diffuse como "evidência da release pendente", com `.exe`. O "sandbox" proposto (tempdir + "monitorar via firewall se possível") não é isolamento. Fora de qualquer primeira fatia.
6. **Fronteira GPL dos scripts que rodam dentro do Blender.** O repositório é MIT. `scripts/blender_spritesheet.py` importa `bpy`, e os jobs do Bridge importariam módulos de add-ons GPL-3.0 dentro do processo do Blender. A separação por processo protege o app Electron; **não responde** à pergunta sobre a licença dos scripts que executam dentro do Blender e são distribuídos com o produto (`package.json` → `build.files` inclui `scripts/blender_spritesheet.py`). Os documentos tratam GPL só na redistribuição de add-ons. Precisa de revisão jurídica e de decisão registrada (DEC-08).

**Aproveitamento do acervo local.** A auditoria local é o insumo mais concreto de todo o repositório: 38 famílias de add-ons com disposição proposta, 580 cenas com métricas estáticas. Mas a disposição (`ADAPT`/`MANUAL`/`REFERENCE`) usa vocabulário próprio, não mapeia para ids do registro, e 15 das 38 famílias têm licença "pendente" e 13 estão classificadas `BLOCKED_PENDING_LICENSE_REVIEW`. **Nenhuma** capability de add-on deve entrar no registro antes de (a) vocabulário único e (b) licença resolvida daquela família.

### 5.2 Three.js — viewport interna

**O que está certo.** É a frente mais disciplinada: fronteira explícita (desenha e inspeciona; não autora, não renderiza oficialmente, não exporta), primeira fase read-only, WebGL2 como piso, bytes por protocolo com token em vez de `file://`, garantia de que nenhuma integração é pré-requisito da Fase 1, critérios de aceite mensuráveis.

**O que atravessa mal o resto.**

1. **Tudo é `PROPOSED`.** `three` não é dependência; não há uma linha de código. Os documentos citam `shared/model3d/glb.mjs` e `src/App.jsx:1399` como "observado no código" — verdadeiro na branch de origem, falso em `main`.
2. **Modelagem como adapter/capability** (§3.3). Recomendo tratar o viewport como módulo de apresentação com um serviço próprio (`View3DService`), sem entrada no Hub e sem capability no planner. A decisão 45 da própria frente deixa essa porta aberta; recomendo a alternativa "não é capability".
3. **Novo tipo de evidência paralelo.** `View3DSessionReport` "não grava `ValidationResult`". Compreensível enquanto a spec não está aprovada, mas cria um segundo canal de evidência de QA. Quando houver contrato de validação, o relatório do viewport deve ser **um** tipo de evidência dele, não um registro vizinho.
4. **Mais uma rota HTTP.** A proposta "dois hosts, um contrato" estende ao preview em navegador a entrega de arquivos de modelo por HTTP. Enquanto R-01 estiver aberto, isso amplia a exposição. O viewport deve nascer **só** no host Electron.
5. **CSP.** A proposta exige `'wasm-unsafe-eval'` e `worker-src blob:` para Draco/KTX2. O produto hoje não tem CSP alguma. A ordem certa é: CSP estrita primeiro, relaxamento medido depois — e a Fase 1 pode simplesmente recusar Draco/KTX2.
6. **Dependência da decisão de renderer** (C-15).

**Papel no produto.** O viewport resolve G-10 para 3D: dá à pessoa algo para olhar ao aprovar. Esse é o seu valor de arquitetura — ser o instrumento da revisão humana —, e por isso ele deve vir **depois** de a cadeia de revisão existir (§8, P1), não antes.

### 5.3 GLB/glTF — formato central de intercâmbio

O princípio é correto e é compartilhado pelas três frentes. A implementação ainda não o sustenta:

- **Inspeção, não validação.** `shared/model3d/glb.mjs` (159 linhas) lê cabeçalho, chunks e contagens. `glb-structural` verifica estrutura. Não há validação de conformidade glTF 2.0 (o validador Khronos é a referência; a frente Three.js o trata como decisão 54, em aberto).
- **Só `.glb`.** `.gltf` com externos, `.blend` e `.fbx` são aceitos por **extensão** (`validateModelExtension`), contrariando o princípio "extensão sozinha não prova que o conteúdo serve".
- **Perda na exportação não é registrada.** A auditoria local diz, corretamente, que "o perfil de exportação precisa explicitar o que foi bakeado, simplificado ou omitido" (Geometry Nodes, shaders, controladores). Não existe esse perfil, nem campo de proveniência para ele. Sem isso, GLB como "formato central" esconde perda de autoria.
- **Round-trip não definido.** Blender→GLB está descrito; GLB→Blender→GLB (edição iterativa) não tem regra de identidade: o que liga a versão 2 à versão 1 quando o hash muda por completo?
- **Extensões e formatos vizinhos.** VRM é GLB com extensões; morph targets, skins e animações são centrais para personagem. Nada disso é medido de forma que um gate possa usar.

**Recomendação:** antes de expandir capabilities 3D, definir o **perfil GLB da Forge** — um documento curto e um validador: o que é obrigatório, o que é medido (triângulos, materiais, texturas, skins, joints, clips, duração, morphs, extensões usadas), o que é recusado, e o que a exportação deve declarar como omitido. Esse perfil é o contrato que Bridge, viewport e exportadores compartilham; hoje cada frente o presume.

### 5.4 Agentes e MCP

**Estado real.** Existe um servidor MCP stdio com 10 ferramentas (`spriteforge_get_status`, `…_list_assets`, `…_create_asset`, `…_add_reference`, `…_prepare_task`, `…_update_stage`, `…_open_panel` etc.). A T14 é uma proposta que **não descreve esse servidor**: fala de allowlist por papel, classificação de dados e kill-switch como se o ponto de partida fosse zero.

**Avaliação das permissões e contratos atuais: inadequados.**

| Aspecto | Exigido (princípios, T14 §6) | Observado no código |
|---|---|---|
| Permissão por ferramenta | Allowlist por papel, revogável | Nenhuma. Todo cliente conectado tem as 10 ferramentas |
| Leitura × mutação | Separadas; mutação com gate | `create_asset`, `add_reference`, `prepare_task`, `update_stage` escrevem no store e no disco sem confirmação do usuário no produto |
| Revisão humana | Indelegável | `update_stage` aceita `status: 'completed'` (C-06) |
| Efeitos de rede | Nenhum sem consentimento | `open_panel` executa `npm run dev -- --host 0.0.0.0` (`spriteforge-mcp.mjs:636`): um agente expõe a API não autenticada à rede |
| Caminho governado | Agente → serviço → engine → gates | MCP lê e grava `.spriteforge/assets.json` diretamente; não usa `studio-service`, planner, engine nem gates |
| Trilha de auditoria | Quem fez o quê | Não há identidade de cliente; a escrita é indistinguível da do usuário |
| Modelo de dados | Único | Estágios próprios (`direction/references/model/rig/spritesheet`), terceiro modelo de workflow |
| Subprocesso | Sem shell | `shell: true` no Windows para `npm` (`spriteforge-mcp.mjs:277,629,641`) |

**Sobre a proposta T14.** A direção é correta — agente como executor restrito por contrato, determinismo valida, orçamento de tentativas, parada garantida. Três reparos:

1. **Ordem.** A T14 lista como P0 o contrato de passo com orçamento (L1) e a ligação com Skills (L2). Antes disso, o P0 real é **o MCP existente passar pelo serviço governado** ou ser reduzido a leitura. Não faz sentido desenhar papéis para um canal que hoje contorna todos os gates.
2. **Não criar outro contrato de passo** (D-02). Orçamento, política de falha e validadores são campos do passo do engine que já existe.
3. **MCPs de terceiros (Blender, Krita, Aseprite).** A T14 sugere pilotar um "read-only". A própria matriz T14 registra que o candidato para Blender executa "Python arbitrário in-DCC; RCE local se agente manipulado". Uma allowlist "read-only" em volta de um servidor cuja primitiva é executar código não é uma fronteira; é uma convenção. Mantê-los fora até o caminho próprio da Forge (subprocesso com script fixo) estar validado — ele cobre o mesmo caso de uso com superfície muito menor.

**Princípio a fixar:** um agente é um **cliente** do mesmo serviço que a UI usa, com um subconjunto de operações, e toda operação que a UI exigiria confirmar exige confirmação **na UI** quando vem do agente. O agente propõe; a pessoa autoriza no produto. Hoje é o inverso: o agente tem um canal com menos controles que o da pessoa.

---

## 6. Riscos P0

Critério de P0: viola diretamente um princípio do produto (autorização, direitos, integridade, proveniência) ou inviabiliza a construção coerente do resto. As cadeias abaixo foram **lidas no código, não exploradas**.

### Segurança

| ID | Risco | Cadeia observada | Mitigação mínima |
|---|---|---|---|
| **R-01** | **API do Studio exposta na rede, sem autenticação, com caminho até execução de processo.** | (1) `vite.config.js:568–572`: `host: '0.0.0.0'`, `allowedHosts: true`; scripts `dev`/`preview` com `--host 0.0.0.0`. (2) `isSameOriginRequest` aceita requisição **sem** cabeçalho `Origin` (`vite.config.js:233–240`) e, com `Origin`, compara com o `Host` da própria requisição — com `allowedHosts: true`, não resiste a DNS rebinding. (3) `POST /providers` aceita `executable` (`vite.config.js:418–425` → `provider-store.mjs:223`), sem verificação de identidade do binário. (4) `POST /run` inicia workflow (`vite.config.js:440–452`). (5) A mesma API permite conceder a autorização remota do ComfyUI com endpoint arbitrário, aprovar revisões e ler artefatos. | Bind em `127.0.0.1` por padrão; token por sessão obrigatório em toda rota mutável; recusar ausência de `Origin` em rotas mutáveis; lista fechada de hosts; **remover da API HTTP** a configuração de executável e a concessão de autorização. O comentário no código indica que a abertura serve ao preview da Arena — essa conveniência de desenvolvimento não pode ser o padrão do produto |
| **R-02** | **Agente pode abrir essa exposição.** | `spriteforge_open_panel` sobe o dev server em `0.0.0.0` (`spriteforge-mcp.mjs:620–650`). | Remover a ferramenta ou restringi-la a loopback com token; nunca iniciar servidor por ação de agente sem confirmação na UI |
| **R-03** | **Autorização de envio/custo é um flag persistente, concedível por canal não confiável.** | C-04 + R-01: o único gate efetivo para envio remoto é `authorization.granted` em `providers.json`, gravável pela API HTTP e por qualquer processo com acesso à pasta do projeto. | Ligar o gate por escopo do engine ao caminho do produto; autorização concedida só por ação na UI do Electron, vinculada ao fingerprint (plano + hashes de entrada + destino + teto de custo), com expiração |
| **R-04** | **Blender executado sem `--factory-startup`/`--disable-autoexec`.** | C-11. O comportamento passa a depender das preferências do Blender do usuário (execução automática de scripts em `.blend`) e dos add-ons que ele tem habilitados — exatamente o que a auditoria local catalogou como não confiado. Não verifiquei o comportamento em Blender 5.3; por isso é risco, não falha demonstrada. | Adicionar os dois flags; tratar `.blend` de terceiros como entrada não confiável; registrar na proveniência os flags usados |

### Direitos

| ID | Risco | Evidência | Mitigação mínima |
|---|---|---|---|
| **R-05** | **Exportação e uso sem gate de direitos.** | C-05. Um asset `blocked` ou `unknown` é exportável. | Gate fail-closed na exportação e no envio remoto; `unknown` bloqueia exportação para destino externo até declaração explícita |
| **R-06** | **Proveniência de licença por adapter, não por componente.** | O engine grava `license`/`outputRights` do **manifesto do adapter** (`execution-manager.mjs:364–365`). Para ComfyUI, a licença relevante é a do checkpoint, dos nós e dos LoRAs usados naquele run — que o manifesto não conhece. | Proveniência por componente efetivamente usado no run (modelo, versão/hash, licença declarada ou `unknown`); é o "ledger" que a T14 pede como L3 |
| **R-07** | **Fronteira GPL dos scripts in-process não decidida.** | §5.1 item 6. | Revisão jurídica + decisão registrada antes de distribuir qualquer script novo que rode dentro do Blender |
| **R-08** | **Acervo local com direitos não resolvidos tratado como insumo.** | 15 de 38 famílias de add-ons com licença "pendente"; titularidade das 580 cenas não confirmada (a própria auditoria lista como P0); o acervo inclui material derivado de propriedade intelectual de terceiros (ex.: um shader de personagem de jogo comercial, com "direitos de material e arte pendentes" em `DUPLICATAS.md`). | Nenhuma fixture, técnica copiada ou adapter derivado do acervo antes de direitos confirmados **por item** |

### Integridade

| ID | Risco | Evidência | Mitigação mínima |
|---|---|---|---|
| **R-09** | **Store com três escritores sem coordenação.** | C-10. O IPC legado sobrescreve o arquivo inteiro com o que o renderer enviar. | Um único módulo escritor, no processo principal; demais caminhos passam por ele; controle de concorrência (versão/ETag) |
| **R-10** | **Evidência fabricável.** | C-06 e C-07: revisor é texto livre, revisão é sobrescrevível, `validated: true` é literal, exportação não exige revisão. | Revisão append-only com hash do artefato e do que foi exibido; `validated` derivado de `ValidationResult`; exportação exige cadeia íntegra |
| **R-11** | **Confinamento de caminho por prefixo de string.** | `exportRun` usa `absolute.startsWith(projectRoot)` e aceita `step.outputs` absolutos (`studio-service.mjs:1212–1213`); `/proj-outro` passa por `/proj`. Outros pontos do mesmo arquivo usam o gate correto (`assertSafeWriteTarget`). | Usar o gate de confinamento único em todo lugar; recusar caminho absoluto em snapshot |

### Arquitetura

| ID | Risco | Evidência | Mitigação mínima |
|---|---|---|---|
| **R-12** | **Sem linha de base.** | C-01. Não há um commit em `main` a partir do qual frentes possam ramificar e convergir. As branches de pesquisa já não estão no remoto. | DEC-01 |
| **R-13** | **Governança documental sem efeito.** | C-02, C-09, C-16. O gate "não autorizado" não impediu implementação; a auditoria de estado está desatualizada; as decisões estão em quatro numerações. | Um registro de decisões, um registro de estado, ambos em `main`, atualizados no mesmo PR que muda o código |
| **R-14** | **Frentes paralelas, cada uma com seu contrato.** | D-02, §A.5. | Nenhum contrato novo de execução; estender o passo do engine. Vocabulário único de capability antes de qualquer registro novo |
| **R-15** | **Volume documental como substituto de execução.** | ~2,5 MB de documentação em `main`, ~6 MB na T13 (spec de 247 KB), zero execuções com ferramenta real. Documentos longos, com adendos empilhados e cabeçalhos que se contradizem, já não são auditáveis por uma pessoa. | Congelar novas especificações até a primeira fatia real; preferir um documento curto por decisão |

---

## 7. Decisões pendentes

Decisões de produto que esta revisão **não toma**. Para cada uma: alternativas, comparação e a recomendação da revisão — que é só isso, uma recomendação.

| ID | Decisão | Alternativas | Comparação | Recomendação |
|---|---|---|---|---|
| **DEC-01** | **Como o código chega a `main`?** | **A)** Merge integral da T13 (67 commits; ancestral comum só no commit inicial). **B)** Importação curada por fatias, cada uma com revisão. **C)** Recomeçar a partir dos contratos. | A é rápido e traz junto D-01, C-10, R-01 e ~60 documentos contraditórios; dá aparência de linha de base sem ser uma. C descarta engenharia boa e testada. B custa mais, mas é a única que transforma a consolidação em revisão. | **B**, começando pela fatia de §9. O que não entrar fica na branch como referência, declarado como não consolidado |
| **DEC-02** | **Regularizar o gate do ADR-001.** | **A)** Registrar autorização retroativa do que a T13 fez. **B)** Tratar a T13 como protótipo não autorizado, do qual se extrai o que for aprovado. **C)** Deixar como está. | C mantém um ADR que não descreve a realidade. A valida tudo de uma vez. B é coerente com DEC-01-B. | **B**, com um ADR-002 curto que diga o que está autorizado a entrar em `main` |
| **DEC-03** | **Contratos de domínio.** | **A)** Aprovar a spec inteira (17 tipos, 12 decisões). **B)** Adotar o protótipo T13 (6 validadores). **C)** Núcleo mínimo: `Asset`, `AssetVersion`, `Artifact`, `Provenance`, `ValidationResult`, `HumanReview`, `RightsRecord`, `ConsentRecord`; adiar perfil visual, style lock e change impact. | A exige 12 decisões que só fazem sentido com uso real. B não tem revisão, direitos nem consentimento — os três pontos onde o código atual falha. C cobre exatamente os gates P0. | **C**. Das 12 decisões da spec, só 1, 2, 4 (escopo reduzido), 6 e 8 são necessárias agora |
| **DEC-04** | **Um engine.** | **A)** Manter os dois. **B)** Aposentar o legado, migrando o render Blender para o engine novo. **C)** Aposentar o novo. | O adapter novo `blender-spritesheet.mjs` já embrulha as funções do legado; B é majoritariamente remoção. | **B**. O legado sai de `main` desde a primeira importação |
| **DEC-05** | **Um store, um escritor.** | **A)** Continuar em `.spriteforge/assets.json`. **B)** Store novo em `.lia-forge/`, legado somente leitura. **C)** Banco (SQLite). | A contraria o ADR-001 D3. B respeita o ADR e isola o formato novo. C é decisão maior, adiável. | **B** agora; C como decisão posterior, quando houver volume |
| **DEC-06** | **Transporte HTTP.** | **A)** Remover do produto (só Electron). **B)** Manter para desenvolvimento, loopback + token, sem rotas privilegiadas. **C)** Manter como está. | C é R-01. A é o mais seguro e quebra o fluxo de preview em navegador. | **B**, com as rotas de configuração de executável, autorização e revisão **exclusivas** do IPC |
| **DEC-07** | **Modelo de autorização.** | **A)** Flag por provider (atual). **B)** Autorização por run, vinculada a fingerprint. **C)** B + política persistente opcional ("sempre permitir este endpoint até X de custo"), como atalho explícito. | A contraria o documento. B é o que o engine já implementa. C dá ergonomia, com risco se mal delimitada. | **B** primeiro; C só depois, como decisão própria |
| **DEC-08** | **Licença dos scripts que rodam dentro do Blender.** | **A)** Licenciá-los como GPL-compatíveis, separados do resto. **B)** Mantê-los MIT e sustentar que não são derivados. **C)** Não distribuir scripts; gerá-los/instalá-los por ação do usuário. | Não é decisão técnica. | **Revisão jurídica.** Até lá, não ampliar o catálogo de scripts |
| **DEC-09** | **Versão-alvo do Blender.** | **A)** 4.2 LTS (Bridge). **B)** 5.3 (instalado). **C)** Matriz: homologar a instalada, declarar as demais `unknown`. | A exigiria instalar outra versão — o que requer autorização do usuário. B alinha com a máquina real. | **C**, homologando primeiro a 5.3 que já existe |
| **DEC-10** | **Vocabulário de capabilities.** | **A)** Manter os 49 ids e acrescentar. **B)** Redesenhar: capability = verbo + tipo de entrada + tipo de saída, com tipos de artefato registrados; tipos de asset saem do registro. | A perpetua G-01 e os quatro dialetos. B quebra ids existentes — barato agora, caro depois. | **B**, antes de registrar qualquer capability de Blender, Three.js ou agente |
| **DEC-11** | **Renderer de spritesheet.** | **A)** Blender único; viewport só inspeciona. **B)** Comparar Blender × WebGL como manda o ADR-001 D5. | B dobra o trabalho da primeira homologação. A contradiz o ADR sem emendá-lo. | **A agora**, com emenda explícita ao ADR-001 D5 adiando a comparação |
| **DEC-12** | **Permissões de agente/MCP.** | **A)** Leitura apenas. **B)** Leitura + propostas que viram pendências a confirmar na UI. **C)** Mutação direta (atual). | C viola o princípio. A é seguro e limita a utilidade. B é o modelo "agente propõe, pessoa autoriza". | **A** imediatamente (remoção de risco); **B** como evolução, pelo serviço governado |
| **DEC-13** | **Viewport é capability/adapter?** | **A)** Sim (`model3d.preview` no Hub). **B)** Não: módulo de apresentação com serviço próprio. | §3.3. | **B** |
| **DEC-14** | **Registro único de estado e de decisões.** | **A)** Manter por frente. **B)** Um `DECISIONS.md` e um `STATE.md` em `main`, numeração única; documentos de frente só referenciam. | — | **B**, renumerando 45–62 (Three.js), as 7 da T14 e as 12 da spec |
| **DEC-15** | **Acervo Blender local.** | **A)** Usar como fonte de fixtures e técnicas. **B)** Só referência documental até direitos por item. | — | **B**; a primeira fixture deve ser um modelo criado pelo próprio usuário ou CC0 verificado na fonte |

Decisões já levantadas pelas frentes e que **dependem** das acima (não repito o conteúdo): spec §11 (12 itens), `DECISIONS-AND-OPEN-QUESTIONS.md` 1–44, Three.js 45–62, T14 §9 (7 itens), auditoria local "Lacunas e decisões".

---

## 8. Roadmap P0–P3

Ordenado por dependência, sem calendário. Regra de coerência: **nenhum item de um nível começa antes de os critérios do nível anterior estarem observados**, e nenhuma frente (Blender, Three.js, agentes) avança sozinha.

### P0 — Base íntegra e primeiro workflow real (uma fatia; ver §9)

| # | Item | Fecha |
|---|---|---|
| P0.1 | Decisões DEC-01, 02, 03, 04, 05, 06, 07, 09, 11, 12 registradas num único arquivo em `main` | R-12, R-13 |
| P0.2 | Importação curada para `main`: serviço, engine, gates, SDK, Hub, QA, adapter Blender, UI do Studio — **sem** runner legado, sem escrita em `.spriteforge/`, sem MCP mutável | C-01, D-01, C-10 |
| P0.3 | Superfície de rede fechada: loopback + token; rotas privilegiadas só por IPC; `open_panel` removido | R-01, R-02 |
| P0.4 | Autorização por run ligada de ponta a ponta (UI → IPC → `scope` → gate) | C-04, R-03, G-02 |
| P0.5 | Blender com `--factory-startup --disable-autoexec`; identidade e versão do executável confirmadas com consentimento, registradas na proveniência | C-11, R-04 |
| P0.6 | Cadeia de integridade: `validated` derivado de validações; revisão append-only vinculada a hash; versão criada só a partir de run concluído e revisado; exportação exige cadeia íntegra e direitos declarados | C-05, C-06, C-07, R-05, R-10, G-04 |
| P0.7 | Um único módulo de confinamento de caminho e um único de redação de segredos | R-11, D-05 |
| P0.8 | **Execução real**: GLB do usuário → spritesheet no Blender instalado → validação → revisão → versão → exportação, em Windows | G-03 |

### P1 — Contratos que as três frentes compartilham

| # | Item | Depende de |
|---|---|---|
| P1.1 | Vocabulário de capability tipado (DEC-10) e migração das 8 receitas; planner recusa encadeamento de tipos incompatíveis | P0 |
| P1.2 | **Perfil GLB da Forge** + validador de conformidade + relatório do que a exportação omitiu (§5.3) | P0.8 |
| P1.3 | Armazenamento de artefatos endereçado por conteúdo; versões referenciam hash, não pasta de run | P0.6 |
| P1.4 | Proveniência por componente (modelo, nó, add-on, versão, licença) — o "ledger" | P0.6 |
| P1.5 | Um passo de engine estendido com orçamento de tentativas, política de falha e idempotência declarada; **nenhum** contrato de passo paralelo | P1.1 |
| P1.6 | **Viewport Three.js Fase 1** (read-only, só Electron, sem Draco/KTX2, CSP estrita), como instrumento da revisão humana de 3D; captura vinculada à revisão | P1.2, DEC-13 |
| P1.7 | MCP reescrito como cliente do serviço governado, somente leitura | P0.3, DEC-12 |
| P1.8 | Importação real do pacote exportado em **um** destino (o que o usuário escolher) | P0.8 |

### P2 — Largura controlada

| # | Item | Depende de |
|---|---|---|
| P2.1 | Bridge Blender geral: **um** job adicional (ex.: exportação GLB a partir de `.blend` próprio), como passo do engine, com o experimento factory-startup × add-on resolvido | P1.2, P1.5, DEC-08 |
| P2.2 | Primeiro add-on do acervo como adapter — só de família com licença resolvida (DEC-15) | P2.1 |
| P2.3 | ComfyUI local real para conceito 2D, com proveniência por componente | P1.4 |
| P2.4 | Viewport Fases 2–4 (hierarquia, materiais, rig/animação), cada uma ligada a um gate de QA que a use | P1.6 |
| P2.5 | MCP com propostas confirmáveis na UI (DEC-12-B) | P1.7 |
| P2.6 | Reconciliação de efeitos remotos (pré-condição de qualquer provider pago) | P1.5 |
| P2.7 | Instalador Windows homologado | P0.8 |

### P3 — Depois de haver assets reais

Provider remoto pago piloto (exige P2.6 e autorização de custo); perfil visual, style lock e change impact da spec; contrato compartilhado Lia Studio ↔ Lia Forge; Skills & Knowledge Engine em runtime; papéis de agente; VLM de apoio à revisão; benchmark; rotas 2.5D, splats, áudio e vídeo; comparação de renderers (se a emenda de DEC-11 a mantiver).

**O que este roadmap deliberadamente adia**, apesar de ter documentação extensa pronta: a spec de domínio completa, o Bridge geral, os oito papéis de agente e as fases 2–5 do viewport. Não por serem ruins, mas porque cada um pressupõe uma base que ainda não foi executada uma vez.

---

## 9. Uma única próxima fatia recomendada

### "Do GLB do usuário ao spritesheet aprovado e exportado, pelo caminho governado, em `main`, com Blender real"

É a homologação que o ADR-001 (Decisão 4) já escolheu — *modelo existente → câmera/animação → render → PNG + manifesto → validação estrutural → avaliação visual → aprovação humana* — acrescida da condição de que aconteça **em `main`** e **pelo único caminho com gates**.

**Por que esta e não outra.**

- É a única rota em que todos os elos já têm código (`3d-object-render` / render do adapter Blender), faltando ligá-los corretamente e executá-los de verdade.
- Não exige instalar nada: o Blender já está na máquina do usuário. Não envolve provider, rede, custo, modelo de IA nem licença de terceiro — se a fixture for do próprio usuário.
- Atravessa, obrigatoriamente, todos os P0: não dá para fazê-la em `main` sem resolver C-01; nem com segurança sem R-01 e R-04; nem com integridade sem C-06, C-07 e C-10; nem honestamente sem C-05.
- Produz o primeiro resultado `VALIDATED` no alvo do projeto, e com ele a primeira medida real de tudo que hoje é `unknown` (versão do Blender, EEVEE na RX 580, tempos).
- Exercita Blender (autoria/render), GLB (intercâmbio) e a cadeia de revisão — o lugar exato onde o viewport Three.js entrará em seguida.

**Dentro do escopo.** P0.1 a P0.8 de §8.

**Fora do escopo, explicitamente.** Viewport Three.js. Bridge geral e qualquer add-on. Qualquer geração por IA, ComfyUI, provider local ou remoto. MCP com escrita e papéis de agente. Spec de domínio além do núcleo de DEC-03. Novas receitas, novas capabilities, novos validadores não exigidos pela fatia. Runner legado e `App.jsx` legado. Instalador. Importação em engine.

**Autorizações que a fatia exige do usuário, antes de começar** (nenhuma presumida aqui): autorizar a importação de código para `main` (DEC-01/02); autorizar a execução do Blender instalado, em sua máquina, sobre um arquivo escolhido por ele; indicar a fixture e declarar seus direitos; autorizar a instalação das dependências npm de desenvolvimento já declaradas na T13.

---

## 10. Critérios objetivos de aceite

Da fatia de §9. Cada critério é verificável por comando, teste ou observação registrada. "No alvo" = Windows na máquina do usuário, com o Blender instalado por ele.

### A. Linha de base

1. `main` contém `package.json`, o código da fatia e seus testes; `npm test` termina com código 0 em checkout limpo de `main`.
2. `main` não contém `electron/workflow-runner.cjs`, `workflow-contracts.cjs`, `workflow-run-store.cjs` nem handlers `lia-forge:workflow:*` / `lia-forge:assets:write`.
3. O verificador de links relativos de §A.4 retorna **0** links quebrados em `main`.
4. Existe **um** arquivo de decisões e **um** de estado em `main`; DEC-01 a 07, 09, 11 e 12 constam com data e responsável humano.
5. Um ADR registra o que está autorizado a entrar em `main`, substituindo o gate do ADR-001.

### B. Segurança

6. Com o servidor de desenvolvimento ativo, uma conexão a partir de outra máquina da rede às rotas `/api/lia-forge/**` falha (porta não escuta fora de loopback).
7. Requisição mutável sem token de sessão → `401`; sem cabeçalho `Origin` → recusada; com `Host` fora da lista fechada → recusada. Cada caso tem teste automatizado.
8. Não existe rota HTTP que configure executável, conceda autorização ou registre revisão (teste que enumera rotas e falha se alguma aparecer).
9. A linha de comando do Blender registrada no log do run contém `--background`, `--factory-startup` e `--disable-autoexec`; teste falha se qualquer um faltar.
10. A primeira execução de um caminho de executável exibe caminho, versão reportada e hash do arquivo e exige confirmação na UI; a confirmação é invalidada se o hash do executável mudar.
11. Busca por `0.0.0.0` e por qualquer opção `shell:` que possa avaliar como verdadeira em `spawn`/`spawnSync` no código de `main` retorna vazio, ou apenas ocorrências justificadas em comentário e cobertas por teste.

### C. Autorização e consentimento

12. Um run iniciado sem autorização vinculada ao fingerprint do plano termina `blocked` com `authorization-missing`, pelo caminho IPC real (teste de integração, não unitário do engine).
13. Alterar o arquivo de entrada, o destino ou qualquer parâmetro depois da autorização resulta em `authorization-scope-changed` na tentativa seguinte.
14. Não há chamada de rede durante a fatia: teste com rede bloqueada passa, e o log do run não registra nenhuma conexão de saída.

### D. Integridade e proveniência

15. Um único módulo grava o store de assets; teste falha se outro arquivo abrir o store para escrita. Nada é escrito em `.spriteforge/` (teste compara hash do diretório antes e depois).
16. Nenhum literal `validated: true` em código de produção; `validated` de um artefato é derivado de um resultado de validação com mesmo SHA-256 (teste: artefato sem validação → `validated` ausente ou `false`).
17. Revisões são append-only: registrar segunda decisão para o mesmo passo preserva a primeira (teste lê as duas). Cada revisão guarda SHA-256 do artefato revisado e identifica o canal de origem (UI do Electron).
18. Criar versão de asset a partir de run não concluído, com validação reprovada ou sem revisão aprovada **do mesmo hash** → recusado com erro nomeado (três testes).
19. Exportar run cujo asset tem direitos `unknown`, `license-pending`, `restricted` ou `blocked` → recusado com motivo nomeado; com direitos declarados pelo usuário → permitido, e o manifesto de exportação registra a declaração.
20. Alterar um byte do PNG depois da revisão faz a exportação falhar por divergência de hash.
21. O manifesto de exportação contém, para cada arquivo: SHA-256, passo de origem, id do run, versão do adapter, versão do Blender reportada, flags usados, SHA-256 do GLB de entrada e identificação da revisão.
22. Existe uma única função de confinamento de caminho e uma única de redação de segredos (teste de arquitetura: nenhuma segunda definição exportada).

### E. Execução real no alvo

23. Um GLB fornecido pelo usuário, com direitos declarados por ele, percorre no app Electron em Windows: importar → planejar → autorizar → renderizar no Blender instalado → validar → revisar → criar versão → exportar. O registro guarda os SHA-256 de entrada e saída.
24. O PNG passa em `png-structural`, `png-content` e `spritesheet-manifest`; o manifesto declara dimensões, grade e contagem de frames coerentes com os bytes.
25. A revisão visual é feita por uma pessoa olhando o PNG real; a decisão (aprovar **ou** rejeitar) é registrada. **Rejeição é resultado válido da fatia** — o critério é a cadeia funcionar, não a arte agradar.
26. Cancelar o run durante o render encerra o processo do Blender (verificado na lista de processos do sistema) e deixa o run em `cancelled`, retomável.
27. Fechar o app durante o render e reabrir mostra o run como interrompido, nunca como em andamento ou concluído.
28. São registrados como **medidos**: versão do Blender, engine de render efetivamente usado, tempo de parede, pico de memória do processo. Qualquer valor não medido permanece `unknown`.
29. O relatório de evidência distingue, linha a linha, o que foi `EXECUTED` no alvo do que rodou só com substituto de teste, e não usa `VALIDATED` fora do escopo observado.

### F. Contenção de escopo

30. O PR da fatia não adiciona `three`, novas capabilities, novas receitas, novos adapters nem novos documentos de especificação além dos de decisão/estado.
31. O MCP, se presente em `main`, expõe apenas ferramentas de leitura (teste enumera ferramentas e falha diante de qualquer uma que escreva em disco ou inicie processo).

---

## Apêndice — Evidências desta revisão

Tudo abaixo foi `EXECUTED` nesta sessão, no sandbox Linux descrito no cabeçalho.

### A.1 Estrutura do repositório

| Verificação | Resultado |
|---|---|
| `git ls-files \| wc -l` em `main` @ `6bd9a5a` | 42 arquivos; nenhum fora de `README.md`, `AGENTS.md`, `docs/` |
| `git ls-remote origin` | Branches: `main`, `arena/649f88bd-3dspritesheet`. PRs: #1 (fechado, T13 @ `85074e6`), #2 e #3 (merged, só documentação) |
| `gh api repos/BloomRX/Lia-Forge/compare/main...arena/649f88bd-3dspritesheet` | `status: diverged`, `ahead_by: 67`, `behind_by: 3`, `merge_base: 13dc4c7` ("Initial commit", 1 arquivo: `README.md`) |
| Histórico de `main` (API de commits) | `13dc4c7` → `e988711` (marca) → `e6bfeec` (PR #2, pesquisas) → `6bd9a5a` (PR #3, auditoria local). Nenhum commit com código |
| Clone local | **Raso** (`git rev-parse --is-shallow-repository` → `true`); por isso `git merge-base` local retorna vazio. A ancestralidade acima vem da API do GitHub, não do clone |
| Arquivos na T13 @ `5b0ec51` | 206 |
| Presença dos 8 documentos obrigatórios ausentes de `main` | Todos presentes na T13 |

### A.2 Suíte de smoke tests da T13 (sem instalar dependências)

Cada arquivo de `npm test` foi executado individualmente com `node <arquivo>` sobre a cópia extraída por `git archive`.

- **30 de 33 passaram** (código 0), incluindo: `domain-contracts`, `capability-registry` (49 capacidades, 7 famílias), `adapter-sdk` (7 adapters, 3 classes), `orchestrator-engine` (8 workflows, 5 executáveis só com adapters internos), `studio-service`, `run-lifecycle`, `workflow-coverage` (5 `succeeded`, 6 `blocked` com motivo), `journey` (123 checagens), `host-integration`, `glb-inspect`, `qa-content`, `asset-manager`, `ipc-coherence` (30 canais).
- **3 falharam por dependência ausente** (`node_modules` não instalado, por regra da missão): `mcp-smoke`, `vite-store-smoke`, `studio-ui-render-smoke`. **Não foram avaliados.**
- `run-lifecycle` e `host-integration` declaram na própria saída que usam **substitutos de teste**, não Blender/ComfyUI reais.
- Significado: os números que a T13 publica são reproduzíveis neste ambiente. **Não** significam execução com ferramenta real nem validação no alvo.

### A.3 Sonda de planejamento (G-01)

Script de 20 linhas chamando `createStudioService({ projectRoot: <tmp> }).plan(...)`. Saída relevante:

```text
3d-character-spritesheet
   reference-views | image2d.generate-concept | adapter= null            | bloqueado: precisa de "prompt"
   generate-3d     | model3d.generate         | adapter= null            | bloqueado: nenhum adapter declara a capacidade
   auto-rig        | rig3d.auto               | adapter= null            | bloqueado: nenhum adapter declara a capacidade
   animate         | motion.cycles            | adapter= rig2d-software  | (sem bloqueio)
   render-2d       | render3d.to2d            | adapter= null            | bloqueado: blender-spritesheet=missing
   deliver         | export.engine            | adapter= export-package  | (sem bloqueio)
3d-object-render
   inspect         | model3d.inspect          | adapter= glb-inspect     | bloqueado: precisa de "model"
   render          | render3d.frame           | adapter= null            | bloqueado: blender-spritesheet=missing
   atlas           | render.atlas             | adapter= rig2d-software  | (sem bloqueio)
   deliver         | export.engine            | adapter= export-package  | (sem bloqueio)
```

A sonda só planejou; não executou run, e o diretório temporário permaneceu vazio.

### A.4 Links relativos em `main`

Varredura de todos os `.md` de `main`: **191** links relativos, **43 quebrados**, **17 alvos distintos ausentes**. Mais afetados: `ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md` (8), `threejs-3d-environment/01` (7), `threejs-3d-environment/README.md` (6), `threejs-3d-environment/15` (5), `BLENDER-BRIDGE-SPECIFICATION.md` (3). Todos os alvos ausentes existem na T13.

### A.5 Ids de capability citados × registro real

Ids entre crases com forma `familia.verbo`, comparados com os 49 ids de `shared/capabilities/registry.mjs`:

| Conjunto de documentos | Ids citados | No registro | Fora do registro |
|---|---|---|---|
| Blender (3 docs em `main`) | 14 | **0** | 14 — ex.: `model3d.rig` (registro: `rig3d.auto`), `model3d.unwrap-uv` (`model3d.uv`), `model3d.render-spritesheet` (`render3d.to2d`), `model3d.retarget-animation` (`motion.retarget`), `model3d.bake-softbody`, `model3d.skin-voxel-heat`, `model3d.export-vrm` |
| Three.js (18 docs) | 30 após descartar falsos positivos de API JS | 26 | 4 propostos: `model3d.preview`, `material.inspect`, `rig3d.inspect`, `motion.preview` |
| T14 (4 docs) | 5 | 3 | 2: `render.spritesheet`, `image2d.spritesheet` |
| `TOOL-PROVIDER-HUB.md` + `ASSET-PIPELINES.md` (T13) | 6 | **0** | 6: `mesh.make-watertight`, `mesh.decimate-lowpoly`, `texture.bake-normal`, `texture.generate-from-image`, `dcc.combine-and-place-prop`, `motion.animate` |

### A.6 Referências de código (T13 @ `5b0ec51`)

| Achado | Local |
|---|---|
| Servidor em `0.0.0.0`, `allowedHosts: true` | `vite.config.js:568–572`; `package.json` scripts `dev`, `preview` |
| Requisição sem `Origin` aceita | `vite.config.js:233–240` |
| Rotas HTTP `/providers` e `/run` | `vite.config.js:418–425`, `440–452` |
| `executable` gravado sem verificação | `shared/integrations/provider-store.mjs:223` |
| Adapter não confirma identidade do executável | `electron/adapters/blender-spritesheet.mjs:181–191` |
| Gate de autorização condicionado a `scope` | `shared/engine/execution-manager.mjs:190` |
| Serviço executa sem `scope` | `shared/services/studio-service.mjs:901` |
| IPC `studio:run` sem `authorization` | `electron/main.cjs:1105–1115` |
| Autorização remota como flag persistente | `shared/integrations/provider-store.mjs:203–214`; `electron/adapters/comfyui-remote.mjs:137–149` |
| Revisão sobrescrevível, revisor em texto livre | `shared/services/studio-service.mjs:1096–1113` |
| `validated: true` literal | `shared/services/studio-service.mjs:1276` |
| Exportação sem gate; confinamento por prefixo | `shared/services/studio-service.mjs:1205–1232` |
| Store legado gravado pelo serviço novo | `shared/services/studio-service.mjs:380–402` |
| Store legado gravado pelo IPC legado e pelo MCP | `electron/main.cjs:1007`; `scripts/spriteforge-mcp.mjs:19,139` |
| Flags do Blender | `electron/blender-adapter.cjs:69–70`; `scripts/blender_spritesheet.py:59` |
| Taxonomia `character`/`item` no adapter | `electron/blender-adapter.cjs:65` |
| MCP sobe servidor em `0.0.0.0` | `scripts/spriteforge-mcp.mjs:620–650` |
| MCP marca etapa como concluída | `scripts/spriteforge-mcp.mjs:550` |
| Classes do SDK | `shared/adapters/sdk.mjs:27` |
| `PROTECTED_ACTIONS`/redação duplicados | `shared/adapters/sdk.mjs:56–73`; `shared/engine/gates.mjs:34–49` |
| Licença por adapter na proveniência | `shared/engine/execution-manager.mjs:364–365` |
| Receita 3D com `motion.cycles` | `shared/orchestrator/planner.mjs:109–114` |
| Electron endurecido | `electron/main.cjs:878–881` |
| `three` ausente | `package.json` (`dependencies`, `devDependencies`) |

### A.7 Limitações desta revisão

1. **Base de código fora de `main`.** Toda a análise de código vale para `5b0ec51`. Se a branch mudar ou for apagada, as referências deixam de ser verificáveis.
2. **Leitura dirigida, não integral** (cobertura documental em §0.3). São cerca de 33 mil linhas de código, scripts e testes (sem o lockfile) e ~8,5 MB de documentação somados. Do código, li os trechos citados em §A.6 e seu entorno, localizados por busca; nenhum módulo grande foi lido do início ao fim. `src/App.jsx`, `src/ForgeStudio.jsx`, `electron/workflow-runner.cjs`, `scripts/spriteforge_launcher.py` e a maior parte dos ~50 documentos T8–T13 não obrigatórios foram lidos só por busca. Achados adicionais nesses arquivos são prováveis.
3. **Spec de domínio lida por estrutura.** Dos 247 KB, li cabeçalho, §1.1, §8, §11 e o índice. Não auditei os schemas campo a campo — o que seria duplicar `DOMAIN-CONTRACTS-AUDIT.md`.
4. **Riscos de segurança não demonstrados.** R-01 a R-04 e R-11 são cadeias lidas no código. Não iniciei o servidor, não enviei requisições, não executei Blender. O comportamento real do Blender 5.3 quanto a autoexec em modo background não foi verificado.
5. **Três testes não avaliados** (MCP, store Vite, render de UI). A avaliação do MCP baseia-se em leitura do código-fonte.
6. **Nenhuma verificação no alvo.** Nada aqui diz respeito a Windows, RX 580, Blender real ou ComfyUI real.
7. **Licenças.** Os pontos sobre GPL/AGPL são sinalizações para revisão jurídica. Não verifiquei na fonte a licença de nenhum add-on ou modelo; uso o que os documentos do repositório declaram, e aponto onde divergem entre si.
8. **Auditoria local Blender.** Não tive acesso à máquina nem aos arquivos; avalio só o pacote documental, que por sua vez declara 53 compactados com cobertura incompleta.
9. **Independência.** Esta revisão discorda de documentos anteriores em pontos específicos (estado do `IMPLEMENTATION-AUDIT.md`, prioridade da T14, modelagem do viewport como adapter, suficiência do QA no Bridge). São julgamentos desta revisão, sujeitos a contestação com evidência.
