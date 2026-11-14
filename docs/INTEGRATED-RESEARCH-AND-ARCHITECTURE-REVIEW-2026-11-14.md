# Lia Forge — Integração das quatro pesquisas e revisão de arquitetura contra o código atual

> **Natureza deste documento:** `REGISTRO DE INTEGRAÇÃO`. Compara as quatro análises especializadas publicadas em 2026-11-14 com o **HEAD real da frente de produto** e diz, achado por achado, o que continua existindo, o que já foi corrigido, o que só existe em parte e o que não se reproduz. **Não altera código, contrato, capability nem decisão.** Não promove nenhuma capacidade a `EXECUTED`/`VALIDATED`. Não autoriza implementação.
>
> **Data:** 2026-11-14 (UTC).
> **Branch deste registro:** `arena/649f88bd-3dspritesheet` — HEAD `27e2156f385396d35862e8c6035a4f0e26c8d7bb`.
> **Snapshot que as quatro análises usaram:** `5b0ec51ecec1ea06b8228b03fc0f5d4b8b1f0471` (três commits atrás: `1ec516a` revisão humana visível, `d338f98` documentação, `27e2156` rótulos da lista de execuções).
> **Documentos integrados aqui (lidos integralmente):**
> 1. `arena/ca5fcc8f-lia-forge` → `docs/BLENDER-DEEP-TECHNICAL-ASSESSMENT.md` (667 linhas)
> 2. `arena/e209a742-lia-forge` → `docs/THREEJS-IMPLEMENTATION-GAP-ASSESSMENT.md` (909 linhas)
> 3. `arena/6113e868-lia-forge` → `docs/AGENT-SKILLS-MCP-IMPLEMENTATION-ASSESSMENT.md` (449 linhas)
> 4. `arena/624582f5-lia-forge` → `docs/INDEPENDENT-ARCHITECTURE-REVIEW.md` (565 linhas)
>
> Mais a pesquisa já consolidada em `main` pelos PRs #2 e #3 (`RESEARCH-CONSOLIDATION-2026-11-13.md`, `threejs-3d-environment/01…17`, `T14-*`, `BLENDER-BRIDGE-SPECIFICATION.md`, `BLENDER-ADDONS-MATRICES.md`, `ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md`, `auditoria-blender-local/`).
>
> **Como as quatro branches foram lidas:** `git fetch --no-tags origin arena/<id>:refs/remotes/origin/arena/<id>` (somente leitura, refs de acompanhamento) e `git show <ref>:docs/<arquivo>`. **Nenhum merge, rebase, cherry-pick, force-push ou troca de branch.** Nenhum arquivo delas foi copiado para esta branch; este documento é o único artefato novo.

---

## 0. Método, vocabulário e limites

### 0.1 Vocabulário de classificação deste registro

Para cada achado das quatro análises, uma de cinco situações — sempre com a evidência medida no HEAD:

| Situação | Significado |
|---|---|
| **CONFIRMADO** | O achado continua verdadeiro em `27e2156`, verificado por leitura de código, sonda executada ou comando registrado. |
| **CORRIGIDO** | Um commit posterior ao snapshot resolveu o achado. Cito o commit e o teste que o cobre. |
| **PARCIAL** | Parte do problema foi resolvida; o restante continua e está nomeado. |
| **DESATUALIZADO** | A conclusão não corresponde mais ao código (ou nunca correspondeu ao que o código faz). |
| **NÃO REPRODUZIDO** | Não consegui confirmar com os meios disponíveis nesta sessão; fica como dúvida aberta, não como verdade. |

Vocabulário de estado do produto (o mesmo das quatro análises e de `docs/T13-IMPLEMENTATION-EVIDENCE.md`): `IMPLEMENTED` ≠ ligado ao caminho do produto ≠ `EXECUTED` ≠ `VALIDATED` no alvo.

### 0.2 O que foi feito nesta sessão

- Leitura integral dos quatro documentos (2.590 linhas) e das seções relevantes da pesquisa já consolidada em `main`.
- Verificação dirigida no HEAD: `vite.config.js`, `shared/engine/{execution-manager,gates,run-states}.mjs`, `shared/services/studio-service.mjs`, `shared/integrations/provider-store.mjs`, `shared/adapters/{sdk,software}.mjs`, `shared/orchestrator/planner.mjs`, `shared/model3d/glb.mjs`, `shared/qa/validators.mjs`, `shared/ui/journey.mjs`, `shared/assets/manager.mjs`, `electron/{main.cjs,blender-adapter.cjs}`, `electron/adapters/blender-spritesheet.mjs`, `scripts/{spriteforge-mcp.mjs,blender_spritesheet.py}`, `package.json`, `THIRD_PARTY_NOTICES.md`.
- **Sonda executada** (a mesma classe de sonda que a revisão independente usou em §A.3): `createStudioService(...).plan(...)` para `3d-character-spritesheet` e `3d-object-render`, com `candidates[]` e `blockedReason` por passo. Só planejou; o diretório temporário foi removido.
- Verificação de ancestralidade local × API do GitHub (§7.2).
- Superfície de conflito real entre `main` e esta branch, medida por `git ls-tree` (§7.1).
- Suíte completa: `npm test` (33 suítes, código 0), `npm run test:python` (30 testes, OK), `npx vite build` (JS 360,63 kB / CSS 116,92 kB).

### 0.3 O que **não** foi feito

- Nenhum código, contrato, teste ou documento existente foi alterado nesta etapa (a única mudança de código do dia é a correção autorizada da Etapa 1, commit `27e2156`, anterior a este documento).
- Nenhum merge/rebase/cherry-pick/force-push. Nenhuma das quatro branches foi tocada.
- Nenhum add-on, Blender, ComfyUI, modelo, Skill, MCP ou dependência de terceiro foi instalado, baixado ou executado.
- Nenhuma execução com ferramenta externa real. Nada neste registro é `VALIDATED` no alvo (Windows + RX 580).
- Nenhuma decisão humana foi tomada no lugar do dono do produto: §6 lista o que depende dele.
- Não refiz as auditorias especializadas (inventário de add-ons, pesquisa Three.js, catálogo T14). Uso-as como insumo e registro apenas o que as atravessa.

---

## 1. Estado atual confirmado da T13 (medido hoje, não herdado)

### 1.1 Números do repositório

| Item | Valor medido | Comando |
|---|---|---|
| HEAD desta branch | `27e2156` | `git rev-parse` |
| Arquivos rastreados | **206** | `git ls-tree -r --name-only 27e2156 \| wc -l` |
| Documentos em `docs/` | **70** | idem, filtrado |
| Commits à frente de `main` | **68** | API `compare/main...arena/649f88bd-3dspritesheet` → `ahead_by: 68` |
| Commits atrás de `main` | **3** | idem → `behind_by: 3` |
| Ancestral comum | **`13dc4c7`** ("Initial commit", 1 arquivo: `README.md`) | idem → `merge_base`; `git ls-tree -r 13dc4c7` |
| Estado | `diverged` | idem → `status` |
| Clone local | **raso** (`.git/shallow` enxerta `13dc4c7` e `6bd9a5a`) | `git rev-parse --is-shallow-repository` → `true` |

### 1.2 O que o produto é hoje, em código

| Dimensão | Medido |
|---|---|
| Capacidades | 49 ids em 7 famílias (`shared/capabilities/registry.mjs`) |
| Adapters | 7 (`blender-spritesheet`, `comfyui-concept`, `comfyui-remote`, `local-image-ops`, `rig2d-software`, `glb-inspect`, `export-package`) em 3 classes (`execution`, `manual-editing`, `remote-service`) |
| Workflows | 8 receitas; **5 executáveis nesta máquina** (só adapters internos) |
| Preflight | sem provider configurado: `ready 15 · blocked 1 · missing 33`, `canStart: false`; com substituto rotulado: `ready 18 · missing 30` |
| Transporte | 49 `ipcMain.handle` em `electron/main.cjs`, dos quais **30** são `lia-forge:studio:*` coerentes com `src/lia-forge-api.js` e `electron/preload.cjs` (`tests/ipc-coherence-smoke.cjs`, 58 checagens) + HTTP same-origin no dev-server |
| Armazenamento do Studio | `.lia-forge/runs/<runId>/{run.json,plan.json,reviews.json,parts/*.json,steps/}`; inventário de assets em `.spriteforge/assets.json` (herdado) |
| Contrato preservado | spritesheet humanoide **384×144, grade 8×3, 24 frames de 48×48** (`humanoid-prompt-views-to-2d-v1`) |
| Destinos | 6 perfis publicados; `verifiedOnDestination: true` **só** para `lia-desktop` |
| Testes | `npm test` = 33 suítes, código 0 · `npm run test:python` = 30 testes, OK · build Vite ok |
| Dependências | `@modelcontextprotocol/sdk 1.32.2`, `lucide-react`, `react 18.3.1`, `react-dom`, `zod 4.6.7`; dev: `@vitejs/plugin-react`, `electron 45.0.0`, `electron-builder`, `vite 6.4.5`. **`three` não existe.** |

### 1.3 O que mudou entre o snapshot das análises (`5b0ec51`) e o HEAD (`27e2156`)

Três commits, todos verificados por teste — relevantes porque **dois deles tocam achados das análises**:

| Commit | O que fez | Achado que toca |
|---|---|---|
| `1ec516a` | Decisão humana gravada vira proveniência visível: `reviews.json[passo]` mantém a decisão atual **e** ganha `history[]` com as decisões substituídas; `readRun` junta as decisões ao snapshot (`review.status`, `reviewedBy`, `reviewedAt`, `note`, `sha256`, `matchesArtifact`, `review.recorded`); um gate pendente **agora** vale mais que a decisão anterior; UI mostra autoria, nota e histórico, e a aba Logs recebe as decisões (`timelineFor` exportada) | **C-06(a)**, **R-10**, **G-10** (parcial) |
| `d338f98` | Documentação do acima (§5 e §11 de `T13-IMPLEMENTATION-EVIDENCE.md`) | — |
| `27e2156` | Um nome por ação na lista de execuções (`RUN_ACTION_LABELS` + `runItemActions` em `shared/ui/journey.mjs`, usados por lista, rodapé e roteiro); `listRuns` marca `stale` só para `running`/`planned`, deixando `paused` de fora (o engine grava `paused` quando a execução **terminou** com passos pendentes, e `resumeRun` responde `interrupted: false` para ele) | coerência interface × serviço (não citada pelas análises; achado nosso) |

### 1.4 Leitura honesta do conjunto

As quatro análises concordam num ponto que este registro **confirma**: o que está `VALIDATED` no produto é estrutura de arquivo sobre fixtures sintéticas, em Linux, sem GPU. Os 5 workflows executáveis são exatamente os que não precisam de ninguém (operações 2D internas, rig 2D procedural, VFX procedural, inspeção de GLB, empacotamento). **Nenhum workflow de ponta a ponta com ferramenta externa real foi executado**, e nada foi importado num destino real. O volume de código e de testes não deve ser lido como maturidade de produto — e a própria T13 já diz isso em `docs/T13-IMPLEMENTATION-EVIDENCE.md` §12.

O que as análises **não** viram (porque o snapshot é anterior ou porque a leitura foi dirigida): a revisão humana agora tem autoria, nota e histórico visíveis; a seleção de adapter tem `canHandle` com motivo nomeado que chega à interface; a retomada tem uma fonte única de estados (`shared/engine/run-states.mjs`); a compatibilidade do pacote exportado é medida por formato e não descarta metadado em silêncio; a lista de execuções oferece exatamente as ações que o serviço aceita, com um nome só por ação.

---

## 2. Resumo das quatro pesquisas

### 2.1 `BLENDER-DEEP-TECHNICAL-ASSESSMENT.md` (`arena/ca5fcc8f-lia-forge`, tip `6aee194`)

**O que é.** Terceira camada da frente Blender: não repete inventário, responde "o que a Forge consegue executar sem depender de terceiros e o que precisa construir".

**O que executou.** Leitura integral das cinco fontes; extração programática dos JSON da auditoria local; `gh api` sobre 27 repositórios upstream (licença, manifesto, árvore, releases); leitura do código T13 (11 arquivos); **leitura estática** do fonte de um candidato (Wiggle Bones 1.1.2, 6 arquivos, tag `7952297b`); documentação oficial do Blender. **Nenhum add-on instalado/habilitado/executado, nenhum Blender aberto, nenhuma cena original aberta, nenhuma dependência instalada.**

**Seis achados que mudam o plano.** (1) O Bridge como especificado não é executável no alvo: `--factory-startup` × habilitação de add-on em runtime é conflito real, e `bpy.ops.preferences.extension_enable` **não existe** na API (o script falharia no primeiro job com `AttributeError`). (2) Integrar add-on GPL por subprocesso não resolve copyleft quando o add-on precisa rodar *dentro* do Blender para produzir o resultado; o único caminho tecnicamente defensável é CLI sobre arquivos sem `import bpy` — e só um candidato tem essa forma, bloqueado por binário proprietário. (3) A auditoria local mediu o que faltava e **contradiz a pesquisa anterior** em três candidatos (linhagens de SquishyFX, `.pyc` em JiggleGen/JiggleMaker, HairCard Studio declarando 1.0.0 nas três embalagens). (4) Sete correções de licença por fonte primária (MPFB, xatlas, CharMorph, Keemap, Principled Baker, robust-weight-transfer) — cinco delas derrubam prioridade "verde". (5) O melhor candidato a PoC **não é headless-trivial**: `wiggle.bake` → `wiggle.select` → `poll()` exige `context.mode == 'POSE'`, e em `--background` o modo é `OBJECT` (medida M0, antes de qualquer outra). (6) O critério de aceite do Bridge para morph targets **não é avaliável hoje** porque `inspectGlb()` não expõe morph targets.

**Recomendação única.** PoC-1: Wiggle Bones 1.1.2 em Blender 4.5 LTS, fixture própria, medindo habilitação determinística e determinância de saída (M0–M9), não qualidade visual.

**Limitações declaradas.** Nada instalado/executado; os arquivos do usuário não estavam na sessão (SHA-256 local × release nunca comparado); só um candidato teve o fonte lido; `mode_set('POSE')` em background não medido; nenhuma análise jurídica.

### 2.2 `THREEJS-IMPLEMENTATION-GAP-ASSESSMENT.md` (`arena/e209a742-lia-forge`, tip `84aeca4`)

**O que é.** Auditoria comparativa entre a pesquisa `docs/threejs-3d-environment/` (18 arquivos, 4.395 linhas) e o código real.

**O que executou.** `git archive 5b0ec51` em diretório temporário (somente leitura); grep negativo por `three`/`webgl`/`webgpu`/`GLTFLoader`/`OrbitControls`/`view3d`/CSP/`protocol.handle`/`webglcontextlost`/`getAppMetrics`; execução de `inspectGlb()` sobre a fixture do repositório; leitura do tarball `three@0.187.0` (APIs de dispose, `GLTFLoader`, `KTX2Loader`, `DRACOLoader`, `WebGPURenderer`); os 33 smokes individualmente (30 passam, 3 bloqueados por `node_modules` ausente); `unittest` do Python (30 testes, 1 falha por `node_modules` ausente).

**Achados centrais.** (a) **Não existe viewport**: zero ocorrência de Three.js/WebGL/CSP/protocolo/telemetria de processo. (b) **A lacuna mais mal classificada é a hierarquia**: árvore de nós, transforms, `accessor.min/max`, PBR declarado e canais de animação **já estão no chunk JSON** que `glb.mjs` lê — não precisam de renderer. Daí a proposta de **Camada 0 / `SceneIndex` declarado** (puro, Node, sem dependência nova), que a pesquisa original colocava dentro da Fase 1 junto com o canvas. (c) Três defeitos reais em `glb.mjs`: `durationSeconds` depende de `accessor.max` (glTF não o exige para animação), `triangleCount` divide por 3 ignorando `mode` (strip/fan é `n-2`), e `materials` não expõe nenhum valor PBR. (d) Teto prometido (256 MB) ≠ teto real de entrada (32 MB) e de prévia (6 MB). (e) **Nenhum teste de canvas** no repositório: validar viewport por SSR é falsa confiança. (f) As decisões-gate 45–62 **não existem** no arquivo canônico (para em 44) ⇒ o gate da Fase 1 é inatingível por construção.

**Honestidade rara:** o documento registra um achado próprio (**B-01**) que levantou e **refutou** na mesma sessão (contagem por posição de coluna em tabela Markdown que "fechava" o total mas distribuía errado), e corrige o classificador de testes de "33 verdes" para "30 passam, 3 bloqueados".

**Recomendação única.** `SceneIndex` declarado (esforço S, sem dependência, 100% validável em Node), com 10 critérios de aceite.

### 2.3 `AGENT-SKILLS-MCP-IMPLEMENTATION-ASSESSMENT.md` (`arena/6113e868-lia-forge`, tip `3aabf99`)

**O que é.** Auditoria de agentes, Skills, MCP e automação, com duas colunas de verdade (`main` × T13 `5b0ec51`).

**O que executou.** Leitura dirigida do código T13; os 33 smokes individualmente (30 passam, 3 bloqueados); `gh api` sobre ~35 repositórios (licença SPDX, estrelas, último push, README, releases). Nada instalado, nada executado de terceiro, nenhum dado enviado.

**Achados centrais.** (a) Sete conceitos que não podem se misturar (Knowledge, Skill, Tool, Provider, Adapter, Workflow, Agente) e a regra de decisão entre eles; **MCP não é nenhum deles — é transporte**, e herda o risco da tool que embrulha. (b) Critério de quatro condições para justificar um agente: resultado **no máximo três agentes opcionais** (A1 intérprete de brief, A2 operador de DCC, A3 co-revisor) contra os 8 papéis da T14 — a linha de produção funciona sem nenhum. (c) Permissões em 8 níveis (P0 ler … P7 sobrescrever/apagar): as 4 ações protegidas do código cobrem P4/P5/P6 e **não cobrem P3 (executar código arbitrário) nem P7 (sobrescrever/apagar)**, embora `WORKFLOW-ENGINE.md` liste "sobrescrever/apagar" como gate. (d) **Envelope de handoff único + ledger por entrega** como contratos que faltam; o consumidor nunca confia no campo `declared`. (e) MCP da Forge: 10 tools, sem papel, sem allowlist, sem identidade de cliente; `open_panel` sobe dev-server em `0.0.0.0`; `shell: true` no Windows; não passa por serviço, planner, engine nem gates. (f) Rotas Blender: **B1 headless com script first-party é a rota principal** (já implementada); B2 Bridge só depois de B1 validada; **B3 MCP de terceiros não embutir** (Python arbitrário por padrão, socket sem autenticação na 9876, integrações remotas embutidas).

**Recomendação única.** Homologar um handoff real: GLB existente → Blender headless → spritesheet → QA → revisão humana → pacote com ledger.

### 2.4 `INDEPENDENT-ARCHITECTURE-REVIEW.md` (`arena/624582f5-lia-forge`, tip `a6a679b`)

**O que é.** Revisão transversal: 17 contradições (C-01…C-17), 10 duplicações (D-01…D-10), 12 lacunas que bloqueiam workflows reais (G-01…G-12), 15 riscos P0 (R-01…R-15), 15 decisões pendentes (DEC-01…DEC-15), roadmap P0–P3 e 31 critérios objetivos de aceite.

**O que executou.** Leitura (integral ou dirigida) de ~25 documentos; leitura dirigida do código T13; os 33 smokes (30 passam, 3 bloqueados); sonda de planejamento de 20 linhas; varredura de 191 links relativos em `main` (43 quebrados, 17 alvos ausentes); comparação de ids de capability citados nos documentos × registro real. **Nenhum risco de segurança foi explorado** — as cadeias são leitura de código.

**Acrescenta uma distinção que as outras três não usam de forma consistente:** `IMPLEMENTED` ≠ **ligado ao produto**. Vários mecanismos existem e passam em teste unitário, mas o caminho do produto não os aciona — o caso mais grave é o gate de autorização por fingerprint (C-04).

**Recomendação única.** Parar de abrir frentes e fazer **uma** fatia: levar o caminho governado mínimo para `main` e provar, com Blender real na máquina do usuário, `GLB → spritesheet → validação → revisão → versão → exportação`, fechando no percurso os P0 de segurança e integridade.

### 2.5 Convergência das quatro

As quatro análises, por caminhos independentes, recomendam **a mesma primeira fatia**: o único trecho da cadeia com código completo (modelo existente → Blender headless → spritesheet → QA → revisão → pacote), executado de verdade. Divergem no que vem imediatamente antes: a revisão independente exige fechar P0 de segurança/integridade **no percurso**; a frente Blender propõe uma PoC de add-on (Wiggle Bones) como primeira prova; a frente Three.js propõe `SceneIndex` declarado; a frente de agentes propõe envelope + ledger como contrato. §8 e §9 deste registro ordenam essas quatro propostas por dependência.

---

## 3. Matriz de achados × situação no HEAD `27e2156`

### 3.1 Governança, ancestralidade e documentação

| ID (origem) | Achado | Situação | Evidência no HEAD |
|---|---|---|---|
| **C-01** (revisão) | `main` não contém o produto | **CONFIRMADO** | `main` = 42 arquivos, todos documentação; T13 = 206. Interseção de caminhos: **3** (`README.md`, `AGENTS.md`, `docs/BRAND-STANDARDS.md`) |
| **C-02** (revisão) | Implementação sem gate registrado (ADR-001: `Implementação/migração: NOT AUTHORIZED`) | **CONFIRMADO como ausência de registro** — com correção de causa | `docs/ADR-001-LIA-FORGE-DECISIONS.md:6` e `:27` intactos; 68 commits de implementação. **O que a revisão não podia ver:** a autorização existe — foi delegada pelo dono do produto nas tarefas T9–T13, com limites explícitos (sem compras, sem upload, sem serviços remotos pagos, sem instalações, sem decidir pendências humanas). Falta o **registro no repositório**, não a autorização. Ver DEC-A em §6 |
| **C-09** (revisão) | `IMPLEMENTATION-AUDIT.md` contradiz os documentos irmãos (matriz de 2026-11-06 marca como `PLANNED` o que os cabeçalhos dão como parcialmente implementado) | **CONFIRMADO** | `docs/IMPLEMENTATION-AUDIT.md` × cabeçalhos de `WORKFLOW-ENGINE.md`, `TOOL-PROVIDER-HUB.md`, `INTELLIGENT-ORCHESTRATOR.md` |
| **C-16** / **B-02** / **R23** (revisão, Three.js) | Registro de decisões bifurcado: o arquivo canônico para em **44**; as questões 45–62 só existem dentro de `threejs-3d-environment/12` e `17` | **CONFIRMADO** | `git show 27e2156:docs/DECISIONS-AND-OPEN-QUESTIONS.md` → 101 linhas, maior número **44**; `grep -E "^4[5-9]\.|^5[0-9]\.|^6[0-2]\."` → vazio |
| **R-13** (revisão) | Governança documental sem efeito | **CONFIRMADO** | C-02 + C-09 + C-16 somados |
| **R-15** (revisão) | Volume documental como substituto de execução (~8,5 MB somados, zero execuções com ferramenta real) | **CONFIRMADO** | 70 documentos em `docs/` na T13 + 42 em `main`; `docs/T13-IMPLEMENTATION-EVIDENCE.md` §12 lista o não executado |
| **A.4** (revisão) | 43 links relativos quebrados em `main` (17 alvos ausentes) | **CONFIRMADO, e reparável por consolidação** | Verifiquei 11 dos alvos citados: **todos existem na T13** (`docs/DECISIONS-AND-OPEN-QUESTIONS.md`, `TOOL-PROVIDER-HUB.md`, `T13-IMPLEMENTATION-EVIDENCE.md`, `PRODUCT-ARCHITECTURE.md`, `WORKFLOW-ENGINE.md`, `INTELLIGENT-ORCHESTRATOR.md`, `ASSET-PIPELINES.md`, `DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`, `IMPLEMENTATION-AUDIT.md`, `electron/blender-adapter.cjs`, `memory-bank/estado.md`) |
| **A.5** (revisão) | Ids de capability citados nos documentos não existem no registro (Blender: 14 citados, **0** no registro; `TOOL-PROVIDER-HUB.md`+`ASSET-PIPELINES.md`: 6 citados, **0**) | **CONFIRMADO** | `shared/capabilities/registry.mjs` (49 ids) não contém `model3d.rig`, `model3d.unwrap-uv`, `model3d.render-spritesheet`, `mesh.make-watertight`, `texture.bake-normal` etc. |
| **§0.1 / R22 / D-02** (Three.js) | "`git merge-base` retorna vazio: **não há ancestral comum**; são duas raízes independentes" | **DESATUALIZADO (conclusão) / CONFIRMADO (sintoma)** | O sintoma é real e reproduz aqui: `git merge-base 27e2156 origin/main` → vazio. **A causa não é ausência de ancestralidade, é o clone raso**: `git rev-parse --is-shallow-repository` → `true`; `.git/shallow` contém `13dc4c7` **e** `6bd9a5a`, então nenhuma das duas histórias pode ser traversada até o encontro. A API do GitHub reporta `merge_base: 13dc4c7d2fde…`, `status: diverged`. `13dc4c7` é alcançável localmente e contém 1 arquivo (`README.md`). Ver §7.2 |
| **"67 commits à frente"** (revisão §0.2, §2.1) | Contagem de avanço da T13 sobre `main` | **NÃO REPRODUZIDO** | API no próprio snapshot da revisão: `compare/main...5b0ec51` → `ahead_by: 65`. Hoje, em `27e2156`: `ahead_by: 68`. A diferença de 2 não muda nenhuma conclusão, mas o número publicado não confere |
| **C-08** (revisão) | Documento descreve classes de adapter que o código não tem | **CONFIRMADO** | `shared/adapters/sdk.mjs:27` → `['execution','manual-editing','remote-service']`; `TOOL-PROVIDER-HUB.md` usa `local-tool`/`internal-process`/`remote-service` e um terceiro conjunto no manifesto proposto |
| **C-12 / DEC-09 / D4** (revisão, Blender) | Versão-alvo do Blender sem reconciliação: Bridge diz 4.2 LTS; a máquina do usuário tem 5.3.0; a frente Blender recomenda 4.5 LTS primário / 5.2 secundário | **CONFIRMADO como decisão pendente** | Nenhum código afirma versão; o adapter declara que **não** confirma identidade/versão (`versionConfirmed: false`, commit `522740a`). Três documentos, três alvos |
| **C-13** (revisão) | Licença do MPFB: `AGPL-3.0` (pesquisa) × `GPL-3.0-or-later` (auditoria local) | **CORRIGIDO por fonte primária, sem efeito no produto** | A frente Blender (C1) leu `LICENSE.CODE.md` = GPL-3.0 e `LICENSE.ASSETS.md` = CC0; o AGPL vale para o **banco de personagens**, por personagem. Nenhum código do produto depende de MPFB |
| **C-14** (revisão) | "Sem pin de versão" (Bridge §12.2) × "origem e versão pinadas" (`ASSET-PIPELINES.md`) | **CONFIRMADO** | Contradição documental; a frente Blender reforça: pin tem de ser por **SHA-256**, porque HairCard Studio declara 1.0.0 nas três embalagens |
| **C-15 / DEC-11** (revisão) | Renderer WebGL: candidato (ADR-001 D5) ou só inspetor (frente Three.js, decisão 56) | **CONFIRMADO como decisão pendente** | Nenhum renderer WebGL existe; `three` ausente de `package.json` |
| **C-17** (revisão) | Frente Three.js descarta "servidor HTTP local no app" e no mesmo parágrafo propõe outra rota HTTP | **CONFIRMADO** | `threejs-3d-environment/12` decisão 49 × `06` §5. Agravado por R-01 (§3.2) |

### 3.2 Segurança (P0)

| ID | Achado | Situação | Evidência no HEAD |
|---|---|---|---|
| **R-01** | API HTTP do Studio em `0.0.0.0`, `allowedHosts: true`, sem autenticação, aceitando requisição **sem** `Origin`, com rotas que configuram executável, iniciam run, aprovam revisão e concedem autorização remota | **CONFIRMADO** | `vite.config.js:569` (`host: '0.0.0.0'`), `:571` (`allowedHosts: true`), `isSameOriginRequest` (`:233-240`) → `if (!origin) return true`; rotas `/providers` (`:418`), `/run`, `/runs/:id/(review\|export\|cancel\|resume)` (`:476-508`); `package.json` scripts `dev`/`preview` com `--host 0.0.0.0`. **Contexto que a revisão registrou e eu confirmo:** o comentário em `vite.config.js:570` diz que a abertura serve ao preview proxy da Arena — é conveniência de desenvolvimento que virou padrão do repositório. O caminho do produto (Electron) é IPC, com `assertTrustedIpcSender` em todos os 49 handlers |
| **R-02** | Agente pode abrir essa exposição: `spriteforge_open_panel` sobe o dev-server em `0.0.0.0` | **CONFIRMADO** | `scripts/spriteforge-mcp.mjs:636` → `spawn(npm, ['run','dev','--','--host','0.0.0.0','--port',…,'--strictPort'])`, com `shell: process.platform === 'win32'` (`:641`) |
| **R-03** | Autorização de envio/custo é flag persistente concedível por canal não confiável | **CONFIRMADO** | `shared/integrations/provider-store.mjs:203-214` (`authorization.granted`, sem hash de entrada, sem expiração, escopo em texto livre) gravado em `.lia-forge/providers.json`; consumido em `studio-service.mjs:232,287,643`. Gravável pela rota HTTP `/providers` |
| **R-04 / C-11** | Blender executado sem `--factory-startup`/`--disable-autoexec`; `.blend` aberto com `open_mainfile` | **CONFIRMADO, com correção de mitigação** | `electron/blender-adapter.cjs:69` → só `--background` (e `shell: false` em `:167`, o que está certo); `scripts/blender_spritesheet.py:59` → `bpy.ops.wm.open_mainfile`. **A mitigação da revisão ("sempre os dois flags") não pode ser copiada literalmente:** a frente Blender (§5.2) mostra que `--factory-startup` conflita com habilitação de add-on e pode, com auto-save ativo, gravar padrões de fábrica sobre o `userpref.blend` do usuário. O que é incondicional para o nosso caminho (script first-party, sem add-on) é `--disable-autoexec` + `bpy.app.autoexec_fail = True` ao abrir `.blend` de terceiro, e `--factory-startup` **somente** em job que não habilita add-on |
| **Identidade do executável não verificada** (revisão §5.1 item 2) | O adapter não roda `--version` no caminho configurado; o run executa o que estiver configurado | **CONFIRMADO como risco / PARCIAL como honestidade** | O risco permanece (combinado com R-01 fecha uma cadeia de execução de código). A **divulgação** foi corrigida em `522740a`: provider por caminho do usuário reporta `available: true`, `executableSource: 'user-configuration'`, `versionConfirmed: false` e detail dizendo que a identidade não foi confirmada; caminho inexistente → `available: false` com motivo. O produto não afirma o que não mediu — mas ainda executa |
| **R-11** | Confinamento de caminho por prefixo de string em `exportRun` | **CONFIRMADO** | `shared/services/studio-service.mjs` (`exportRun`): `absolute.startsWith(runDirectory) \|\| absolute.startsWith(projectRoot)` e aceita `step.outputs` absoluto ⇒ `/proj-outro` passa por `/proj`. O gate correto (`assertSafeWriteTarget`, de `shared/engine/gates.mjs`) é usado em outros pontos do **mesmo arquivo** (`:114,354,424`) |
| **Sem CSP** (Three.js I1, revisão §2.2) | Nenhuma Content-Security-Policy em `index.html`, `electron/*.cjs` ou `vite.config.js` | **CONFIRMADO** | `grep -rn "Content-Security-Policy"` → 0 ocorrências |
| **`shell: true` no Windows** (agentes §5.4) | MCP usa shell no Windows para `npm` e para sondas | **CONFIRMADO** | `scripts/spriteforge-mcp.mjs:277,629,641` → `shell: process.platform === 'win32'`. O caminho de produção do Blender **não** usa shell (`blender-adapter.cjs:167`), o que está certo |
| **R-07** | Fronteira GPL dos scripts que rodam dentro do Blender não decidida (`scripts/blender_spritesheet.py` importa `bpy` e é distribuído em `build.files`) | **CONFIRMADO como decisão pendente** | `package.json` → `build.files` inclui `scripts/`; repositório é MIT. Não é decisão técnica (DEC-08 / DEC-H em §6) |
| **R-08 / DEC-15** | Acervo local com direitos não resolvidos tratado como insumo (15 de 38 famílias com licença pendente; 580 cenas sem titularidade confirmada; 61 com script text e 31 com driver com script) | **CONFIRMADO** | Nenhuma fixture do produto vem do acervo (as fixtures são `tests/glb-fixtures.mjs` e PNGs gerados por código). `docs/LIBRARY-VISUAL-REFERENCE-INVENTORY.md` marca 13 rastreadas + 13 `LIBRARY_ONLY` como `RIGHTS_PENDING` |

### 3.3 Autorização, gates e consentimento

| ID | Achado | Situação | Evidência no HEAD |
|---|---|---|---|
| **C-04 / G-02** | Gate de autorização por fingerprint implementado e testado, **não ligado** ao caminho do produto | **CONFIRMADO** | `shared/engine/execution-manager.mjs:190` → `if (scope) { checkAuthorization(...) }`; `shared/services/studio-service.mjs:901-903` chama `manager.execute(plan, { context, authorization, … })` **sem `scope`**; `electron/main.cjs` handler `lia-forge:studio:run` **não repassa `authorization`**. Consequência: nenhum run do produto passa pelo gate de fingerprint, e o que de fato libera envio remoto é a flag de R-03. É fail-closed para passos com `protectedActions` (ficam bloqueados), mas significa que **nenhuma rota generativa paga ou com download pode rodar pelo caminho governado** |
| **D-03 / G4** (agentes §7.1) | Três vocabulários de ação protegida; **sobrescrever/apagar e executar código arbitrário não são ações protegidas em lugar nenhum** | **CONFIRMADO** | `shared/engine/gates.mjs:34` e `shared/adapters/sdk.mjs:56` → 4 ações (`send_data`, `cost`, `install_software`, `download_models_or_weights`); `electron/workflow-contracts.cjs` tem o vocabulário legado (`paid_generation`, `send_model`, …); `WORKFLOW-ENGINE.md` lista 6 gates incluindo "sobrescrever/apagar" |
| **D-04** | `protectedActions` com dois sentidos opostos (no manifesto = o que o adapter **se recusa** a fazer; no passo do plano = o que **exige autorização**) | **CONFIRMADO no nome / PARCIAL no efeito** | O efeito prático foi reduzido: `needsAuthorization` deixou de ser derivado de `protectedActions` (fase F1–F3), então adapters locais não geram mais pendências falsas. O campo continua ambíguo para quem lê o manifesto |
| **D-05** | `PROTECTED_ACTIONS` e `redactSecrets` definidos duas vezes, com regex diferentes | **CONFIRMADO, com precisão nova** | `shared/adapters/sdk.mjs:56-73` × `shared/engine/gates.mjs:34-49`. As listas de padrões **diferem**: `gates.mjs` cobre `credential` e `signature` e usa `\b` nos prefixos (`\bsk-`, `\bghp_`, `\bhf_`, `\bxox`); `sdk.mjs` não cobre `credential`/`signature` e não tem `\b`. As funções também diferem para não-string (`sdk` faz `String(text)`; `gates` faz `JSON.stringify` e recorre). O comentário em `gates.mjs:50` afirma "idêntica em log, evento de UI, erro e relatório" — **falso enquanto houver duas definições** |
| **G-09** (revisão) | Reconciliação de efeitos remotos ausente (crash depois de job pago ⇒ reenvio às cegas) | **CONFIRMADO** | Nenhum registro de efeito remoto pendente/conciliável; bloqueia qualquer provider pago |
| **G7** (agentes) | "Há `retry.maxAttempts` e `costCeiling` no fingerprint, mas não há acúmulo de custo por run" | **PARCIAL / DESATUALIZADO em parte** | Tentativas com backoff existem; o custo **é** acumulado por run: `execution-manager.mjs:347-355` grava `stepRecord.cost` e faz `current.cost.entries.push(...)`, derivando `cost.status` (`known` se alguma entrada é `known`). O que falta é (a) `total` numérico (permanece `null`) e (b) **aplicação** do teto — `costCeiling` só entra no fingerprint quando `scope` é passado, e `scope` nunca é (C-04) |
| **G6** (agentes) | Sem classificação de dados (`public/internal/private/secret`) antes de qualquer envio | **CONFIRMADO** | Nenhuma ocorrência no código; pré-condição de qualquer provider remoto |
| **Princípios que continuam corretos** (revisão §3.4) | Hub descobre e não instala; planner não executa; `unknown` como estado de primeira classe; validadores puros; Electron endurecido; substitutos de teste nomeados | **CONFIRMADO** | `shared/hub/provider-hub.mjs`, `shared/orchestrator/planner.mjs`, `shared/qa/preflight.mjs:24`, `electron/main.cjs:878-881` (`contextIsolation`, `nodeIntegration:false`, `sandbox:true`, `webSecurity:true`), `tests/tool-stubs.mjs` |

### 3.4 Integridade, proveniência e direitos

| ID | Achado | Situação | Evidência no HEAD |
|---|---|---|---|
| **C-05 / R-05** | Direitos são informativos, não gate: nenhum caminho de execução, anexação ou exportação consulta o estado | **CONFIRMADO** | `classifyRights`/`rightsReport` aparecem só em leitura e exibição (`studio-service.mjs:730-732` no `overview`, `:1315-1316`, `:1490` exportado). `exportRun` não consulta direitos, estado do run nem revisão pendente. Um asset `blocked`/`license-pending` é exportável. A UI dificulta (botão Exportar só com `status === 'succeeded'`; passo 11 do roteiro vira `human` se o pacote é incompatível), mas o **serviço** aceita |
| **C-06(a) / R-10** | Revisão sobrescrevível, revisor em texto livre, `writeFile` simples (não append-only, não atômico) | **PARCIAL — parcialmente CORRIGIDO por `1ec516a`** | **Corrigido:** a segunda decisão não apaga a primeira — `reviews.json[passo]` guarda a decisão atual (o que o gate lê) + `history[]` com as substituídas (hash, autoria, data, nota); `readRun` junta tudo ao snapshot com `matchesArtifact`, e um gate pendente agora vale mais que a decisão anterior (`review.recorded`). Coberto por `tests/studio-service-smoke.mjs` e `tests/studio-ui-render-smoke.mjs` §12. **Continua:** (i) a escrita é `fs.writeFile` simples (`studio-service.mjs:1126`) — sem `temp+rename` e sem `assertSafeWriteTarget`, ao contrário do que o **mesmo arquivo** faz para `run.json`/`assets.json`/`inputs` (`:363-366,395-398,1024-1026,1437-1440`); (ii) `reviewer` continua texto livre do chamador, inclusive pela rota HTTP (`vite.config.js:508`, default `'usuário do Studio'`); (iii) não registra **o que foi exibido** ao revisor (G-10) |
| **C-06(b)** | MCP permite a agente marcar etapa como `completed` sem gate humano | **PARCIAL** | `scripts/spriteforge-mcp.mjs:550-610`: `spriteforge_update_stage` aceita `status: 'completed'`, mas exige saída real existente (`assertRealProjectPath(output, { mustExist: status === 'completed' })`, `:595`) e verifica o quadro de referências (`:573-577`). Não há revisão humana nem identidade de cliente, e é um **terceiro** modelo de workflow (`direction/references/model/rig/spritesheet`) |
| **C-06(c)** | Pela API HTTP sem autenticação, `POST /runs/{id}/review` aprova | **CONFIRMADO** | `vite.config.js:476-508` + R-01 |
| **C-07** | `validated: true` como literal em `attachRunToAsset` | **CONFIRMADO** | `shared/services/studio-service.mjs:1340` → `validated: true` para **todo** artefato emitido por um run, sem ler `step.validations`, estado do run ou revisão. Contradiz o princípio "sem outputs ou progresso simulados" |
| **G-04** | Sem modelo de versão com promoção: a cadeia `run → revisão → versão → exportação` não existe como invariante | **CONFIRMADO** | `attachRunToAsset` não verifica `snapshot.status`, revisão aprovada nem validações; `addAssetVersion` é chamada independente. Há imutabilidade (versões nunca são sobrescritas) e `versionRunIds` no `overview` (`4941892`), mas **não** há ponteiro de "versão corrente aprovada" nem bloqueio de promoção |
| **G-05** | Sem armazenamento endereçado por conteúdo; apagar a pasta do run quebra a versão | **CONFIRMADO** | Artefatos vivem em `.lia-forge/runs/<id>/`; a versão guarda caminho + hash; não há deduplicação nem verificação de integridade na leitura |
| **R-06** | Proveniência de licença por adapter, não por componente efetivamente usado | **CONFIRMADO** | `execution-manager.mjs` grava `license`/`outputRights` do **manifesto do adapter**. Para ComfyUI a licença relevante é a do checkpoint/nós/LoRAs daquele run — que o manifesto não conhece |
| **R-09 / C-10** | Store legado com três escritores sem coordenação | **CONFIRMADO** | `.spriteforge/assets.json` é escrito por (i) `shared/assets/manager.mjs` via serviço (`studio-service.mjs:380,395-398`), (ii) IPC legado `lia-forge:assets:write` (`electron/main.cjs:1007`, sobrescreve o array inteiro vindo do renderer), (iii) MCP (`scripts/spriteforge-mcp.mjs:19`). Leitura-modificação-escrita do arquivo inteiro, sem lock entre processos. O ADR-001 D3 diz que `.spriteforge/` permanece intacto e que nenhuma escrita de formato legado está aprovada |
| **G-10** | Revisão humana sem evidência visual vinculada (não registra o que a pessoa viu) | **PARCIAL** | Depois de `1ec516a` a revisão registra SHA-256 do artefato, autoria, data, nota, histórico e se o hash ainda bate (`matchesArtifact`), e a UI mostra o artefato, o Comparison Lab e as validações. **Falta:** registrar o que foi exibido (qual render, em que escala, comparado com quê) e, para 3D, não há como olhar o modelo dentro do produto (é o valor real do viewport — §8, P1.6) |
| **G2** (agentes) | Sem envelope de handoff único nem ledger por entrega | **PARCIAL** | As peças existem e são medidas: proveniência por passo (adapter, versão, tool, licença, `outputRights`, hash), `cost.entries`, manifesto de exportação com SHA-256 por arquivo + perfil do destino + `summary{assets,metadata,conversions,blockers}` (commit `a58eb26`). Falta o **envelope único** (um tipo com `declared` revalidado pelo consumidor) e o ledger por componente (R-06) |
| **G-08 da revisão** (exportação não verificada em nenhum destino) | **CONFIRMADO** | `verifiedOnDestination: true` só para `lia-desktop`; nenhuma importação real em Godot/Unity/Unreal foi observada. **Atenção à colisão de nomes:** este `G-08` não é o "G8" da tarefa T13 (validação de conteúdo na produção), que está **fechado** (`shared/qa/validators.mjs` → `png-content`, sangramento/padding, `animation-loop`, `destination-profile`), nem o `G8` da frente de agentes (QA de conteúdo 3D), que está **aberto** |
| **G8 dos agentes** (QA de conteúdo 3D ausente: non-manifold, UV sobreposta, orçamento de triângulos, pesos) | **CONFIRMADO** | O QA 3D é estrutural (`glb-structural`) e por extensão (`validateModelExtension`, `shared/qa/validators.mjs:18,126` aceita `blend, glb, gltf, fbx, obj, stl, ply, spz` **só pela extensão**) |

### 3.5 Arquitetura, duplicações e capacidades

| ID | Achado | Situação | Evidência no HEAD |
|---|---|---|---|
| **D-01** | Dois engines de workflow vivos | **CONFIRMADO** | Legado: `electron/workflow-runner.cjs` (~1.250 linhas), `workflow-contracts.cjs`, `workflow-run-store.cjs`, 6 handlers `lia-forge:workflow:*` + `lia-forge:assets:write`, estágios fixos, `.spriteforge/runs/`. Novo: `shared/engine/*` + `shared/orchestrator/planner.mjs`, 30 canais `lia-forge:studio:*`, DAG com checkpoints, `.lia-forge/runs/` |
| **D-02 / R-14** | Quatro contratos de "passo" (legado, receita do planner, Job JSON do Bridge, `step-contract` da T14) + `View3DSession` como quinto | **CONFIRMADO** (2 em código, 3 propostos) | Nenhum dos propostos referencia os existentes. Regra que este registro endossa: **nenhum contrato de passo novo** — orçamento, política de falha e idempotência são campos do passo do engine |
| **D-06** | Vínculo capability↔adapter declarado dos dois lados (`registry.providers` × `adapter.capabilities`) | **CONFIRMADO** | `shared/capabilities/registry.mjs` (campo `providers`) × manifestos em `shared/adapters/software.mjs` e `electron/adapters/*.mjs` |
| **D-07** | Três modelos de direitos/consentimento | **CONFIRMADO** | `RIGHTS_STATES` em `shared/assets/manager.mjs:21` (6 estados) × `RightsRecord`/`ConsentRecord` da spec não aprovada × classificação de dados da T14 (ausente no código) |
| **D-08** | Dois diretórios de projeto e dois transportes; o segundo transporte não tem o guard do primeiro | **CONFIRMADO** | `.spriteforge/` + `.lia-forge/`; IPC com `assertTrustedIpcSender` em 49/49 handlers × HTTP com `isSameOriginRequest` que aceita ausência de `Origin` |
| **C-03** | Spec de domínio não aprovada × protótipo implementado **e desligado** | **CONFIRMADO** | `shared/domain/contracts.mjs` é importado **apenas** por `tests/domain-contracts-smoke.mjs` (verificado por grep em `shared/ electron/ src/ scripts/ vite.config.js` → vazio). O Asset Manager real usa outro modelo |
| **G-01** | Capabilities sem tipos de entrada/saída; planner atribui `motion.cycles` (3D) ao adapter de rig **2D** sem bloqueio | **PARCIAL — o mecanismo existe, o defeito específico continua** | **O que foi corrigido (`9c23d48`):** `canHandle(context)` opcional no SDK; o planner produz `step.candidates[]` + `upstreamCapabilities` (`planner.mjs:190-236`); o Hub expõe `applicable`/`applicabilityReason` e ordena não aplicáveis ao fim; `PlanStepRow` mostra o motivo do descarte na UI. `rig2d-software.canHandle` (`software.mjs:400-424`) recusa `render.atlas` com `task:'render'` e `motion.cycles` quando o passo não vem do pipeline 2D, com motivo nomeado. **O que continua (sonda executada hoje em `27e2156`):** em `3d-character-spritesheet`, o passo `animate` (`motion.cycles`) é atribuído a `rig2d-software` com `applicable: true` e **sem** `blockedReason`, porque `UPSTREAM_2D_PREFIXES = ['rig2d.','image2d.']` e o passo de montante `reference-views` tem capability `image2d.generate-concept` — concept art conta como "pipeline 2D". Em `3d-object-render`, `atlas` (`render.atlas`) também vai para `rig2d-software` porque o `canHandle` só distingue quando `params.task === 'render'`. Na prática o run bloqueia antes (`generate-3d`/`auto-rig` não têm adapter ⇒ fail-closed), então **não é alcançável hoje** — mas a regra é errada e voltará a morder quando houver adapter de rig 3D. A causa de fundo (I/O em texto livre, sem tipos de artefato) permanece |
| **G-11** | Taxonomia do caminho legado limitada a `character`/`item` | **CONFIRMADO** | `electron/blender-adapter.cjs:65` → `if (!['character','item'].includes(asset?.type)) throw`; `shared/assets/manager.mjs:117` recusa outros tipos no store |
| **§3.3** (revisão) | Abstrações prematuras: spec de 17 tipos antes do primeiro asset real; viewport como adapter; 8 papéis de agente; tipos de asset como capabilities | **CONFIRMADO como julgamento arquitetural** — este registro concorda | `character.humanoid`, `image2d.icon`, `image2d.tileset` são tipos de resultado misturados a verbos (`render.atlas`, `model3d.retopologize`) no mesmo registro, o que impede a tipagem de I/O |
| **R-12** | Sem linha de base: não há commit em `main` do qual as frentes possam ramificar e convergir | **CONFIRMADO** | §7 |

### 3.6 Blender (frente especializada)

| ID | Achado | Situação | Evidência no HEAD |
|---|---|---|---|
| **C9 / §5.2** | Bridge chama `bpy.ops.preferences.extension_enable`, operador **inexistente** | **CONFIRMADO como defeito documental** (não há código do Bridge) | Nada a corrigir no produto; a correção vale para quando o Bridge for construído: `addon_enable(module=…)`, `extensions.package_install(_files)`, `package_enable_not_installed` |
| **§5.2 / B4** | `--factory-startup` × habilitação de add-on em runtime é conflito; `bl_ext.<repo>.<pkg>` não é determinístico sem perfil provisionado | **CONFIRMADO como bloqueio de desenho** | Não afeta o caminho atual (script first-party, sem add-on). Afeta qualquer PoC com add-on — inclusive a PoC-1 recomendada pela frente Blender |
| **B5 / T7 / P2** | `inspectGlb()` não expõe morph targets ⇒ o critério de aceite do Bridge (`includeMorphTargets: true` ⇒ ≥1 target) não é avaliável | **CONFIRMADO** | `shared/model3d/glb.mjs` (159 linhas) não lê `primitive.targets`. **Armadilha de nome:** o campo `targets` que existe (`:87`) são os `target.path` dos **canais de animação**, não morph targets |
| **§5.3 / I3** | GLB como formato central sem validação à altura: `.gltf` externo, `.blend`, `.fbx` aceitos por extensão; perda na exportação não registrada; round-trip sem regra de identidade | **CONFIRMADO** | `shared/qa/validators.mjs:18,126` (allowlist por extensão); nenhum perfil de exportação que declare o que foi bakeado/omitido; nenhum campo de proveniência para isso |
| **§8.3 / §8.5** | Isolamento por job (tempdir, cópia somente-leitura, perfil dedicado, sem rede, sem autoexec, sem salvar preferências, limite de recurso, saída validada antes de promover) e o fato de que `SIGTERM` no Blender não alcança `Popen` aninhado | **PARCIAL** | O que existe: `shell: false`, timeout, cancelamento cooperativo com `SIGTERM→SIGKILL` (`tests/run-lifecycle-smoke.mjs` mede o encerramento do processo externo), saída validada antes de promover, tempdir por run. O que falta: perfil Blender dedicado, `--offline-mode`, bloqueio de `save_userpref`, encerramento da **árvore** (netos órfãos no Windows) |
| **§8.4** | Add-on que instala dependência em rede é exclusão (`robust-weight-transfer` faz `pip install --user --break-system-packages`) | **CONFIRMADO como política** | Coerente com a regra do produto de nunca instalar/baixar nada automaticamente (`install_software` e `download_models_or_weights` são ações protegidas; o Hub só descobre) |
| **PoC-1 (Wiggle Bones)** | Melhor candidato: 27.628 bytes, GPL-3.0 verificado, sem binário/wheel/`.pyc`/`Popen`/`socket`/`eval`; **mas** `wiggle.bake` → `wiggle.select` → `poll()` exige `context.mode == 'POSE'` e em `--background` o modo é `OBJECT` (M0) | **NÃO AVALIÁVEL AQUI — e fora do escopo autorizado** | Exige instalar e habilitar add-on GPL de terceiro, decidir redistribuição/licença (DEC-08, DEC-15) e executar Blender real na máquina do usuário. **Nada disso está autorizado nesta etapa** (§6, §10). O achado A1 (`mode_set('POSE')` em background não medido) é razão adicional para não tratar a PoC-1 como primeiro passo |
| **D4 / DEC-09** | Blender 4.5 LTS primário, 5.2 secundário; 4.2 LTS saiu de suporte em jul/2026; não ancorar em 5.3 | **CONFLITO ABERTO com DEC-09 da revisão** (que recomenda homologar primeiro a 5.3 instalada) | Decisão humana (§6, DEC-G). Nenhuma das duas posições é verificável sem executar Blender real |

### 3.7 Three.js, GLB e viewport

| ID | Achado | Situação | Evidência no HEAD |
|---|---|---|---|
| **§1.4 / R27** | Não há Three.js, WebGL, WebGPU, `GLTFLoader`, `OrbitControls`, `view3d`, protocolo de asset, handler de contexto perdido ou `getAppMetrics` | **CONFIRMADO** | `package.json` sem `three`; `src/App.jsx` declara `ILLUSTRATION · NOT A MODEL VIEWER` |
| **F-01** | `durationSeconds` pode ser nula/errada (lê `accessors[sampler.input].max`, que glTF não exige para animação) | **CONFIRMADO** | `shared/model3d/glb.mjs:86` → `durationSeconds: maxTime \|\| null` |
| **F-02 / R28** | `triangleCount` assume `mode: 4` sem verificar (strip/fan é `n-2`) | **CONFIRMADO** | `glb.mjs:54` lê `mode: primitive.mode ?? 4`; `:57` e `:69` dividem por 3 independentemente do `mode` |
| **F-03** | `materials` não expõe nenhum valor PBR (`baseColorFactor`, `metallicFactor`, `roughnessFactor`, `emissiveFactor`, `alphaCutoff`) | **CONFIRMADO** | `glb.mjs:100-107` → `hasPbr: boolean` + dois índices de textura |
| **S1–S3 / §1.5 / Camada 0** | Árvore de nós, transforms e bounds declarados **já estão no chunk JSON** e não precisam de renderer; `nodes` no relatório é um inteiro | **CONFIRMADO — e é o achado de maior valor/custo das quatro análises** | `glb.mjs` não lê `nodes[]`/`scenes[]`/`accessor.min-max` além das contagens; a fixture (`tests/glb-fixtures.mjs`) prova que os bytes existem. É extensão de leitura de um módulo puro, sem dependência nova, 100% testável em Node |
| **R24 / D-05 (Three.js)** | Teto prometido (256 MB) ≠ teto real de entrada (32 MB) e de prévia (6 MB) | **CONFIRMADO** | `studio-service.mjs:45` (`MAX_INPUT_BYTES = 32 MB`), `:76` (`MAX_PREVIEW_BYTES = 6 MB`); o adapter `glb-inspect` aceita 256 MB mas recebe bytes por parâmetro, não pelo seletor |
| **R25 / §7.1** | Nenhum teste de canvas; 0 dependências de navegador; viewport "validada" por SSR seria falsa confiança | **CONFIRMADO** | Sem `playwright`/`puppeteer`/`jsdom`; `tests/studio-ui-render-smoke.mjs` é SSR e **diz isso no cabeçalho** ("rodar sem navegador não é fingir que validou") |
| **R19** | `THIRD_PARTY_NOTICES.md` não menciona `three`/Draco/Basis/Meshopt | **CONFIRMADO (nada a declarar hoje)** | `grep -icE "\bthree\b\|draco\|basis_universal\|meshopt" THIRD_PARTY_NOTICES.md` → 0. Se `three` entrar, os notices precisam ser regenerados — **e o gerador `scripts/generate_third_party_notices.py` está sob restrição permanente de não alteração** (§6, DEC-I) |
| **R1 / §4.5** | Critério "memória do processo não cresce >5%" exige `app.getAppMetrics()`, que não existe ⇒ critério não executável | **CONFIRMADO** | 0 ocorrências em `electron/*.cjs` |
| **§7.2** | Python: 30 testes, 29 OK, 1 FAIL (`test_installed_npm_tree_matches_lockfile`) por `node_modules` ausente | **CONFIRMADO como dependente do ambiente** | Com `npm install` feito (esta sessão): **30 testes, OK**. Sem `node_modules`: a falha reportada acontece. Não é defeito de código |
| **B-03** | Matriz da pesquisa com fase divergente entre três documentos (telemetria/HUD obrigatório × opt-in) | **NÃO REPRODUZIDO em profundidade** | Não reli os 18 documentos da pesquisa para conferir linha a linha; aceito como inconsistência documental e adoto, como a auditoria fez, o critério **mais restritivo** |
| **§7.6** | A base declarada pela pesquisa Three.js (`0b4e8671…`, branch `arena/c61c7ae8-lia-forge`) não existe no remoto ⇒ rastreabilidade perdida | **PARCIAL / DESATUALIZADO** | `0b4e867` **existe** e é um commit **desta** branch (docs §6 da descoberta honesta do Blender, publicado em `522740a`'s vizinhança); a branch `arena/c61c7ae8-lia-forge` de fato não está no remoto. Ou seja: a base citada existe no repositório, mas não com o nome de branch citado |

### 3.8 Agentes, Skills e MCP

| ID | Achado | Situação | Evidência no HEAD |
|---|---|---|---|
| **§5.4 / C-06 / DEC-12** | MCP é um terceiro caminho que não passa por serviço, planner, engine nem gates; sem papéis, sem allowlist, sem identidade de cliente | **CONFIRMADO** | `scripts/spriteforge-mcp.mjs`: 10 tools (`get_status`, `comfyui_status`, `list_comfyui_workflows`, `list_free_models`, `list_assets`, `create_asset`, `add_reference`, `prepare_task`, `update_stage`, `open_panel`); lê e grava `.spriteforge/assets.json` diretamente (`:19`); não importa `createStudioService` |
| **G10** | Skills sem mecanismo de runtime, manifesto ou `trust` | **CONFIRMADO** | `.agents/skills/lia-brand-check/SKILL.md` é conteúdo; nenhum carregador |
| **G11** | Sem papel de agente, sem LLM, sem cliente MCP (a Forge só é servidor) | **CONFIRMADO — e por desenho** | A frente de agentes concorda: agentes vêm por último |
| **G3** | Modelagem, rigging e animação 3D: capabilities declaradas sem adapter | **CONFIRMADO** | Sonda de hoje: `model3d.generate` e `rig3d.auto` → "Nenhum adapter declara a capacidade"; `render3d.to2d`/`render3d.frame` → `blender-spritesheet = missing` |
| **G5** | Sem rollback/restauração/promoção explícita | **CONFIRMADO** | Nenhuma ocorrência de `rollback`/`restore`/`supersede` em `shared/` e `electron/`; versões são imutáveis, mas não há ponteiro de versão corrente nem reversão registrada |
| **§3 (papéis)** | No máximo três agentes opcionais (A1, A2, A3); a linha de produção funciona sem nenhum | **CONFIRMADO como julgamento** — este registro concorda | Coerente com o princípio de que a Forge é dona do grafo |
| **§6.1 B3** | MCP de terceiros para Blender não embutir (Python arbitrário por padrão, socket sem autenticação na 9876) | **CONFIRMADO como decisão de escopo** | Nenhum MCP de terceiro no código; a rota B1 (subprocesso com script first-party) é a que existe |
| **§12 (fatia)** | Homologar handoff real GLB → Blender → spritesheet → QA → revisão → pacote com ledger | **CONFIRMADO como a fatia correta** | Converge com a revisão independente e com o estado do código (§9) |

---

## 4. Contradições entre documentos, e entre documentos e implementação

### 4.1 Entre as quatro análises (precisam de arbitragem antes de qualquer roadmap)

| # | Contradição | Quem diz o quê | Arbitragem deste registro |
|---|---|---|---|
| **K1** | **Ancestralidade das branches** | Three.js §0.1/R22/D-02: "`git merge-base` retorna vazio — **duas raízes independentes**". Revisão §A.1: "clone **raso**; por isso `merge-base` local retorna vazio; a ancestralidade vem da API" | **A revisão está certa.** Medido aqui: `.git/shallow` enxerta `13dc4c7` e `6bd9a5a`; `merge-base` local vazio; API → `merge_base: 13dc4c7`, `diverged`, `ahead_by 68`, `behind_by 3`. São **irmãs** com raiz comum, não linhagens não relacionadas. Consequência prática enorme: consolidação é merge comum, não `--allow-unrelated-histories` (§7.2) |
| **K2** | **Ordem da primeira prova** | Revisão §9: fatia `GLB → Blender real → spritesheet → …` em `main`, fechando P0 no percurso. Blender §10: PoC-1 com **Wiggle Bones** (add-on GPL) como próxima prova. Three.js §10: `SceneIndex` declarado. Agentes §12: a mesma fatia da revisão, com envelope + ledger | **Revisão + agentes têm prioridade**, porque são o único caminho com código completo, sem instalação de terceiro, sem licença nova e sem GPU. A PoC-1 da frente Blender exige decisões humanas (licença, redistribuição, versão do Blender) e tem pré-condição não medida (M0). `SceneIndex` é o de menor risco e maior valor por linha, mas **não** é pré-requisito da cadeia de produção — entra depois (§8, P1.2) |
| **K3** | **Versão-alvo do Blender** | Revisão DEC-09: homologar primeiro a **5.3** instalada. Blender D4: **4.5 LTS** primário, 5.2 secundário, "não ancorar em 5.3" | **Decisão humana** (§6, DEC-G). Tecnicamente: homologar o que está instalado evita instalar outra versão (o que exigiria autorização), mas ancora numa release regular; 4.5 LTS dá estabilidade de API e exige instalação |
| **K4** | **`--factory-startup`** | Revisão R-04/C-11: "sempre `--factory-startup` e `--disable-autoexec`". Blender §5.2: `--factory-startup` **só** em job que não habilita add-on, e nunca salvar preferências | **A frente Blender está certa** e a mitigação da revisão deve ser refinada, não copiada. Para o caminho atual (script first-party, sem add-on) os dois flags são seguros; o risco de sobrescrever `userpref.blend` aparece quando há perfil de usuário + auto-save |
| **K5** | **Viewport como adapter/capability** | Pesquisa Three.js (`05`, decisão 45): adapter classe `execution` com capability `model3d.preview`. Auditoria Three.js §3.3 e revisão DEC-13: **não** é adapter; é módulo de apresentação com serviço próprio | **Concordo com as duas auditorias.** Se precisa de exceção para não parecer ferramenta instalada no Hub, não é adapter. Não registrar `model3d.preview` no registry |
| **K6** | **Servidor HTTP no produto** | Three.js decisão 49 descarta "servidor HTTP local no app" por duplicar transporte e superfície — e no mesmo parágrafo propõe outra rota HTTP de arquivo. Revisão C-17/R-01: o transporte HTTP já existe e é o maior risco | **Revisão está certa.** Qualquer nova rota HTTP só depois de R-01 fechado (loopback + token + rotas privilegiadas exclusivas do IPC) |

### 4.2 Entre documentos e implementação (além das já listadas em §3)

| # | Contradição | Estado |
|---|---|---|
| **K7** | `WORKFLOW-ENGINE.md`: "a autorização não é uma flag genérica de sessão" × o único gate efetivo de envio remoto é uma flag persistente por provider | CONFIRMADO (C-04 + R-03) |
| **K8** | ADR-001 D3: `.spriteforge/` intacto, nenhuma escrita de formato legado aprovada × três escritores ativos do store legado | CONFIRMADO (C-10/R-09) |
| **K9** | Princípio 7 e ADR-001 D6: direitos em cada transformação × direitos não bloqueiam nada | CONFIRMADO (C-05/R-05) |
| **K10** | `TOOL-PROVIDER-HUB.md`/`ASSET-PIPELINES.md` citam 6 capabilities que não existem no registro; os documentos Blender citam 14, das quais **nenhuma** existe | CONFIRMADO (A.5) |
| **K11** | `gates.mjs:50` comenta "redação idêntica em log, evento de UI, erro e relatório" × existem duas implementações com padrões diferentes | CONFIRMADO (D-05) |
| **K12** | Documentos dão `IMPLEMENTATION-AUDIT.md` como "estado verificável" × ele é o mais desatualizado dos irmãos | CONFIRMADO (C-09) |
| **K13** | `T13-IMPLEMENTATION-EVIDENCE.md` declara-se "registro de execução (não é proposta nem autorização)" × é o único lugar onde o que foi executado está descrito | CONFIRMADO — e é a razão de DEC-A (registrar a autorização num ADR, não neste arquivo) |

### 4.3 Contratos e capacidades duplicados ou incompatíveis entre pesquisa e implementação

| Contrato/vocabulário | Onde existe | Incompatibilidade |
|---|---|---|
| Passo de workflow | `shared/orchestrator/planner.mjs` (receita) + `electron/workflow-contracts.cjs` (legado) + Job JSON do Bridge (proposto) + `step-contract` T14 (proposto) + `View3DSession` (proposto) | Cinco formas, nenhum dono. Regra: estender o passo do engine; **nenhum** contrato paralelo |
| Ações protegidas | 4 no código novo, ~6 no legado, 6 na documentação, 8 níveis (P0–P7) na frente de agentes | Não há lista única do que exige consentimento; sobrescrever/apagar e executar código arbitrário não estão em nenhuma |
| Direitos | `RIGHTS_STATES` (6) × `RightsRecord`/`ConsentRecord` (spec não aprovada) × `public/internal/private/secret` (T14) | Sem modelo único, o gate de direitos não tem o que consultar |
| Capabilities | 49 ids no registro × 14 citados pela frente Blender × 30 pela Three.js (4 propostos) × 5 pela T14 (2 fora) × 6 nos documentos de arquitetura | Vocabulário por frente; tipos de asset misturados a verbos no mesmo registro (impede tipagem de I/O) |
| Estados de evidência | 8 rótulos na auditoria T13 × 5 no registro × 5 na frente Three.js (Observado/Executado/Hipótese/Proposta/Não verificado) × 5 nas auditorias de add-ons × 5 neste registro | "implemented" não significa o mesmo em dois documentos |
| Store de projeto | `.spriteforge/` (legado) × `.lia-forge/` (Studio) × `DATA_ROOT` do MCP | Três escritores, dois formatos, sem lock |

---

## 5. Riscos por gravidade, reavaliados no HEAD

### P0 — violam princípio do produto ou inviabilizam o resto

| ID | Risco | Situação hoje | Mitigação mínima |
|---|---|---|---|
| **P0-1** (R-01) | API HTTP em `0.0.0.0`, `allowedHosts: true`, sem autenticação, aceitando requisição sem `Origin`, com rotas que configuram executável, iniciam run, aprovam revisão e concedem autorização remota | **Aberto** | Loopback por padrão; token por sessão em toda rota mutável; recusar ausência de `Origin` em rotas mutáveis; lista fechada de hosts; **tirar da API HTTP** configuração de executável, concessão de autorização e revisão (ficam exclusivas do IPC). O preview da Arena continua funcionando com token + host allowlist |
| **P0-2** (C-04/R-03/G-02) | Autorização por run não ligada: o gate de fingerprint nunca roda no caminho do produto; o que libera envio remoto é flag persistente gravável por HTTP | **Aberto** | Passar `scope` (plano + hashes de entrada + destino + teto de custo) do serviço ao engine; transportar `authorization` pelo IPC; autorização concedida só por ação na UI do Electron, vinculada ao fingerprint, com expiração |
| **P0-3** (C-05/R-05) | Direitos não são gate: asset `blocked`/`license-pending` é exportável; `exportRun` não consulta direitos, estado do run nem revisão pendente | **Aberto** | Gate fail-closed na exportação e no envio remoto; `unknown`/`license-pending` bloqueiam destino externo até declaração explícita, que vai no manifesto |
| **P0-4** (C-07/G-04/R-10) | `validated: true` literal; versão de asset criada sem exigir run concluído, validações aprovadas e revisão do **mesmo hash** | **Aberto** | `validated` derivado de `ValidationResult` com o mesmo SHA-256; `attachRunToAsset` recusa run não concluído/reprovado/sem revisão do hash; exportação exige a cadeia íntegra |
| **P0-5** (C-10/R-09) | Três escritores do store legado, um deles sobrescrevendo o arquivo inteiro com o que o renderer enviar | **Aberto** | Um único módulo escritor no processo principal; os demais caminhos passam por ele; controle de concorrência (versão/ETag) |
| **P0-6** (R-02 + `shell:` no Windows) | Agente pode expor a API à rede (`open_panel`) e MCP usa shell no Windows | **Aberto** | Remover `open_panel` ou restringi-la a loopback com token e confirmação na UI; nunca `shell: true`; nunca iniciar servidor por ação de agente |
| **P0-7** (R-04/C-11) | Blender executado sem `--disable-autoexec` ao abrir `.blend`; comportamento depende das preferências e add-ons do usuário | **Aberto** (mitigação refinada por K4) | `--disable-autoexec` + `bpy.app.autoexec_fail = True`; `--factory-startup` só em job sem add-on; tratar `.blend` de terceiro como entrada não confiável; registrar os flags na proveniência |
| **P0-8** (R-12/C-01) | Sem linha de base: o produto não está em `main`; as 4 branches de pesquisa não convergem com ele | **Aberto** | §7 |
| **P0-9** (G-03) | Nenhuma execução com ferramenta externa real; nada `VALIDATED` no alvo | **Aberto** | §9 (a fatia) |
| **P0-10** (C-06 restante) | `reviews.json` escrito com `fs.writeFile` simples, sem `assertSafeWriteTarget`, enquanto o mesmo arquivo usa `temp+rename` para `run.json`/`assets.json`/`inputs`; `reviewer` é texto livre inclusive por HTTP | **Aberto, pequeno** | Mesma escrita atômica dos outros stores + `assertSafeWriteTarget`; autoria vinda do canal (IPC confiável), não do corpo da requisição |

### P1 — bloqueiam a próxima frente ou degradam integridade

| ID | Risco | Situação |
|---|---|---|
| **P1-1** (G-01) | Capabilities sem tipos; a regra `UPSTREAM_2D_PREFIXES` faz concept art contar como pipeline 2D e entrega `motion.cycles` de uma receita **3D** ao renderer 2D | **Aberto, não alcançável hoje** (o run bloqueia antes). Corrigir a regra é barato; tipar I/O é a correção de fundo (DEC-10) |
| **P1-2** (R-11) | Confinamento por prefixo de string em `exportRun` (`/proj-outro` passa por `/proj`) e aceitação de caminho absoluto vindo de `step.outputs` | **Aberto** — usar o gate único (`assertSafeWriteTarget`/`resolveInside`) e recusar caminho absoluto em snapshot |
| **P1-3** (D-05) | Duas implementações de `redactSecrets`/`PROTECTED_ACTIONS` com padrões diferentes | **Aberto** — módulo único; o que é redigido não pode depender de quem escreveu o log |
| **P1-4** (G-05) | Artefatos não endereçados por conteúdo; apagar a pasta do run quebra a versão | **Aberto** |
| **P1-5** (R-06) | Licença por adapter, não por componente usado no run | **Aberto** — é o ledger que a frente de agentes pede |
| **P1-6** (B5/F-01/F-02/F-03) | `glb.mjs`: sem morph targets, duração frágil, triângulos errados em strip/fan, nenhum valor PBR | **Aberto** — correção pequena, pura, testável em Node |
| **P1-7** (G8-agentes) | QA de conteúdo 3D ausente (non-manifold, UV, orçamento de triângulos, pesos) e formatos aceitos só por extensão | **Aberto** |
| **P1-8** (D-01) | Dois engines vivos, dois modelos de run/retomada/autorização | **Aberto** — DEC-D |
| **P1-9** (R25) | Nenhum teste de canvas; sem telemetria de processo (`getAppMetrics`) o critério de memória é inexequível | **Aberto** — decide-se antes de qualquer viewport |
| **P1-10** (C-09/C-16/R-13) | Registro de estado desatualizado e decisões em quatro numerações | **Aberto** — DEC-J |
| **P1-11** (G-09/G6) | Sem reconciliação de efeitos remotos e sem classificação de dados | **Aberto** — pré-condição de qualquer provider pago |

### P2 — largura e qualidade

R-07 (fronteira GPL dos scripts in-process, decisão jurídica) · R-08/DEC-15 (acervo local como insumo) · C-08/C-14 (vocabulário e pin por SHA-256) · D-06/D-07 (vínculo duplicado, três modelos de direitos) · R24 (teto anunciado na UI) · G-11 (taxonomia `character`/`item`) · §3.3 (abstrações prematuras) · Bridge geral e add-ons (faixas 2 e 3 da matriz Blender) · MCP com propostas confirmáveis na UI.

### P3 — depois de haver assets reais

Provider remoto pago piloto · perfil visual/style lock/change impact da spec de domínio · contrato compartilhado Lia Studio ↔ Lia Forge · Skills em runtime · papéis de agente (A1, A3, A2) · VLM de apoio à revisão · benchmark · rotas 2.5D/splats/áudio/vídeo · comparação de renderers (se DEC-11 a mantiver) · WebGPU.

---

## 6. Decisões que dependem de você

Nenhuma foi tomada neste registro. Para cada uma: o que está em jogo, as opções e o que eu recomendo. **Enquanto não houver resposta, o item correspondente não é implementado.**

| ID | Decisão | Opções | Recomendação | O que trava sem ela |
|---|---|---|---|---|
| **DEC-A** | **Regularizar o gate do ADR-001.** O ADR diz `Implementação/migração: NOT AUTHORIZED`; a T13 tem 68 commits de implementação autorizados por você nas tarefas, sem registro no repositório | (A) ADR-002 curto registrando o que está autorizado a entrar em `main`, com data e responsável · (B) autorização retroativa genérica · (C) deixar como está | **A** — sem reescrever o ADR-001, que continua válido para o que **não** foi autorizado | Consolidação (P0-8) e qualquer alegação de governança |
| **DEC-B** | **Como o código chega à linha principal** (§7) | (A) merge/PR da T13 em `main`, reconciliando 2 arquivos · (B) importação curada por fatias · (C) recomeçar dos contratos | **A + P0 imediato**: a superfície de conflito medida é de 2 arquivos, o histórico é preservado integralmente e os 43 links quebrados de `main` se reparam sozinhos. As fatias curadas (B) custam mais e **perdem** a rastreabilidade de 68 commits; o que B protege (não trazer D-01/R-01 junto) se resolve fechando os P0 logo depois, não fatiando o histórico | Tudo: sem linha de base, nenhuma frente converge |
| **DEC-C** | **Transporte HTTP do produto** | (A) remover (só Electron) · (B) manter para desenvolvimento com loopback + token, sem rotas privilegiadas · (C) como está | **B**, com `/providers`, autorização e revisão **exclusivos do IPC**. (C) é o P0-1 | P0-1, P0-6, e qualquer rota nova (inclusive a de bytes do viewport) |
| **DEC-D** | **Um engine** | (A) manter os dois · (B) aposentar o legado, mantendo o render Blender pelo adapter novo · (C) aposentar o novo | **B** — o adapter novo já embrulha as funções do legado; é majoritariamente remoção. Exige decidir junto o store (DEC-E) | P1-8, D-02, D-03 |
| **DEC-E** | **Um store, um escritor** | (A) continuar em `.spriteforge/assets.json` · (B) store novo em `.lia-forge/`, legado somente leitura · (C) SQLite | **B** agora (respeita o ADR-001 D3 e isola o formato novo); **C** quando houver volume | P0-5 |
| **DEC-F** | **Modelo de autorização** | (A) flag por provider (atual) · (B) por run, vinculada a fingerprint · (C) B + política persistente explícita | **B** primeiro; **C** depois, como decisão própria | P0-2, G-09, qualquer provider remoto |
| **DEC-G** | **Versão-alvo do Blender** (K3) | (A) 4.2 LTS (Bridge) · (B) 5.3 instalada · (C) 4.5 LTS primário / 5.2 secundário (frente Blender) · (D) matriz: homologar a instalada, declarar as demais `unknown` | **D com B primeiro**: homologar a que já está na máquina evita instalar outra versão (instalação exige sua autorização) e produz a primeira medida real; registrar 4.5 LTS como alvo de produto e as demais como `unknown` | P0-9, PoC-1, DEC-08 do Bridge |
| **DEC-H** | **Licença dos scripts que rodam dentro do Blender** (`scripts/blender_spritesheet.py` importa `bpy` e é distribuído) | (A) licenciá-los como GPL-compatíveis, separados · (B) manter MIT sustentando que não são derivados · (C) não distribuir scripts | **Revisão jurídica sua.** Até lá: não ampliar o catálogo de scripts in-process | Distribuição do app empacotado |
| **DEC-I** | **`scripts/generate_third_party_notices.py`** tem 112 links quebrados conhecidos e está sob sua restrição permanente de "não alterar" | (A) manter intocado · (B) autorizar correção · (C) substituir por gerador novo, mantendo o atual | **A** por padrão; **B** só se/quando `three` entrar e os notices precisarem ser regenerados | Entrada de qualquer dependência gráfica |
| **DEC-J** | **Registro único de decisões e de estado** | (A) manter por frente · (B) um `DECISIONS.md` e um `STATE.md` na linha principal, numeração única, renumerando 45–62 + as 7 da T14 + as 12 da spec | **B** | P1-10, gate da Fase 1 do viewport (inatingível hoje) |
| **DEC-K** | **Vocabulário de capabilities** | (A) manter os 49 ids e acrescentar · (B) redesenhar: capability = verbo + tipo de entrada + tipo de saída, com tipos de artefato registrados; tipos de asset saem do registro | **B antes** de registrar qualquer capability de Blender, viewport ou agente. Quebrar ids é barato agora e caro depois | P1-1 (correção de fundo), Bridge, viewport |
| **DEC-L** | **MCP da Forge** | (A) somente leitura, cliente do mesmo serviço que a UI usa · (B) leitura + propostas que viram pendências a confirmar **na UI** · (C) como está (mutação direta) | **A imediatamente** (remoção de risco: `update_stage`, `create_asset`, `add_reference`, `prepare_task`, `open_panel`); **B** como evolução, pelo serviço governado. (C) viola o princípio de que a pessoa autoriza no produto | P0-6, C-06(b), qualquer agente externo |
| **DEC-M** | **PoC com add-on de terceiro (Wiggle Bones / SKkeeper / SquishyFX)** | (A) autorizar instalação + habilitação + execução no seu Blender, com licença GPL-3.0 verificada e sem redistribuição · (B) adiar até a cadeia própria estar homologada · (C) nunca | **B**. Exige: sua autorização explícita, decisão de licença/redistribuição (DEC-H), fixture própria com direitos declarados, e a medida M0 (`mode_set('POSE')` em `--background`) que a própria frente Blender diz não estar medida | Nada na fatia recomendada — essa é a vantagem dela |
| **DEC-N** | **Viewport Three.js** | (A) `three` como dependência + canvas · (B) só a Camada 0 (`SceneIndex` declarado, sem dependência) · (C) nada por enquanto | **B quando a cadeia de produção estiver íntegra; C até lá.** `three` (A) só depois de DEC-J, DEC-C e de existir teste de canvas real (P1-9) | Revisão visual de 3D (G-10) |
| **DEC-O** | **Acervo Blender local (580 cenas, 38 famílias) como insumo** | (A) fonte de fixtures e técnicas · (B) só referência documental até direitos por item | **B**; a primeira fixture deve ser um modelo seu ou CC0 verificado na fonte (a frente Blender mediu 61 cenas com script text e 31 com driver com script — nenhuma é dado inerte) | P0-7, R-08 |
| **DEC-P** | **Autorizações operacionais para a fatia de §9** | Executar o Blender instalado na sua máquina sobre um arquivo escolhido por você · indicar a fixture e declarar seus direitos · autorizar `npm install` das dependências de desenvolvimento já declaradas | **Pedir as três antes de executar** — nenhuma é presumida | P0-9 |

---

## 7. Estratégia segura para consolidar o código na linha principal

### 7.1 Superfície de conflito medida (não estimada)

```
main  @ 6bd9a5a : 42 arquivos  (todos documentação)
T13   @ 27e2156 : 206 arquivos (código + 70 documentos)
interseção      : 3 caminhos
   docs/BRAND-STANDARDS.md  → blob IDÊNTICO nos dois lados (sem conflito)
   README.md                → DIVERGE (main: 13 linhas, neutro quanto a branch; T13: 119 linhas, descreve o produto)
   AGENTS.md                → DIVERGE (main: 8 linhas; T13: 44 linhas)
só em main      : 39 arquivos (pesquisa: Blender ×3, T14 ×4, RESEARCH-CONSOLIDATION, auditoria-blender-local ×13, threejs-3d-environment ×18)
só na T13       : 203 arquivos (todo o código, testes, Electron, scripts e ~60 documentos)
```

Três consequências diretas:

1. **O conflito real são 2 arquivos**, e nos dois casos a versão da T13 é a substancial. O `README.md` de `main` existe para dizer "não presuma que branches de trabalho já foram integradas" — aviso que perde o objeto assim que o código estiver lá; o conteúdo útil a preservar são os padrões de marca e o apontador para `docs/BRAND-STANDARDS.md` (idêntico nos dois).
2. **Os 43 links quebrados de `main` se reparam sozinhos**: verifiquei 11 dos 17 alvos ausentes e **todos** existem na T13.
3. **Nada se perde nos dois sentidos**: os 39 documentos de pesquisa de `main` permanecem (a T13 não os toca, porque não os tem), e os 203 arquivos da T13 entram. Não há substituição de trabalho de nenhuma das quatro sessões.

### 7.2 Ancestralidade: o que o git local diz, o que o GitHub diz, e por que divergem

Pedido seu, item 2. Medido nesta sessão:

| Verificação | Resultado |
|---|---|
| `git rev-parse --is-shallow-repository` | **`true`** — o clone é raso |
| `cat .git/shallow` | `13dc4c7d2fde28f9324fd929482948ba34a87abf` **e** `6bd9a5a7006c7c6ccf5edcb5d577283d61a39949` |
| `git merge-base 27e2156 origin/main` | **vazio** |
| `git log --oneline -1 13dc4c7` | `13dc4c7 Initial commit` — alcançável a partir desta branch |
| `git ls-tree -r --name-only 13dc4c7` | **1 arquivo**: `README.md` |
| `git rev-list --count 13dc4c7..27e2156` | **68** |
| `git rev-list --count origin/main` (local) | **1** (só o tip enxertado) |
| API `compare/main...arena/649f88bd-3dspritesheet` | `status: diverged`, `ahead_by: 68`, `behind_by: 3`, **`merge_base: 13dc4c7d2fde…`** |
| API `compare/main...5b0ec51` (snapshot das análises) | `ahead_by: 65`, `behind_by: 3` |

**Explicação da divergência.** O clone foi feito com profundidade limitada. `.git/shallow` marca `13dc4c7` e `6bd9a5a` como **fronteiras**: o git não conhece os pais desses commits, então não consegue traversar de `main` (cuja história local é só o tip) até `13dc4c7`, e `merge-base` devolve vazio. O ancestral comum **existe** e o GitHub o reporta: `13dc4c7`, o commit inicial, que contém apenas `README.md`. `main` seguiu com 3 commits de documentação (`e988711` marca, `e6bfeec` PR #2 pesquisas, `6bd9a5a` PR #3 auditoria local) e a T13 com 68 commits de produto.

**Correção a registrar:** a conclusão da frente Three.js de que "não há ancestral comum, são duas raízes independentes" (§0.1, R22, D-02) é **sintoma verdadeiro com causa errada**. A revisão independente já havia identificado a causa (clone raso, §A.1). Isso importa porque muda a operação de consolidação: **não** é preciso `--allow-unrelated-histories`, e um merge comum preserva as duas histórias.

**Regra de prudência:** qualquer medição de ancestralidade feita neste sandbox deve citar a fonte (API do GitHub) e o fato de o clone ser raso. Números de contagem de commits publicados sem essa ressalva podem estar errados — como os "67 à frente" da revisão (a API diz 65 no mesmo commit).

### 7.3 Sequência segura recomendada (você executa ou autoriza; eu não faço merge)

| # | Passo | Por quê é seguro | O que preserva |
|---|---|---|---|
| 1 | **Congelar o conteúdo**: nada de novo na T13 além de correções P0 até a consolidação | Evita mover o alvo durante a revisão | — |
| 2 | **PR de consolidação `arena/649f88bd-3dspritesheet` → `main`**, merge comum (não squash, não rebase) | Conflito real = 2 arquivos; sem `--allow-unrelated-histories`; sem reescrita de histórico | Os 68 commits com autoria e mensagem; os 39 documentos de `main`; as 4 branches de pesquisa intactas no remoto |
| 3 | Reconciliar `README.md` e `AGENTS.md` **no commit de merge**: base = versão da T13 (substancial) + os apontadores de marca e a disciplina de evidência da versão de `main` | Nenhum dos dois textos é descartado; a fusão fica visível no commit | Os dois textos |
| 4 | No mesmo PR (ou no imediatamente seguinte), **fechar P0-1, P0-6 e P0-10** — são pequenos, locais e testáveis: loopback+token, remover/limitar `open_panel`, escrita atômica de `reviews.json` | Não deixar a linha principal nascer com um P0 de rede conhecido | — |
| 5 | **Marcar o que não foi consolidado**: `docs/IMPLEMENTATION-AUDIT.md` atualizado, um `STATE.md` e um `DECISIONS.md` únicos (DEC-J), e cabeçalho nos documentos de pesquisa dizendo que descrevem propostas não implementadas | Ataca R-13/R-15 sem apagar nada | Todo o conteúdo das pesquisas |
| 6 | **Só então** abrir as frentes P1 (GLB SceneIndex, tipos de capability, envelope/ledger) | Ordem por dependência, não por volume de documento | — |

**Alternativa curada por fatias (opção B da revisão).** É defensável se o objetivo for revisar cada módulo antes de ele entrar. Custo real: 68 commits viram N importações sem autoria original, e a rastreabilidade "este teste cobre este achado" se perde. Como a superfície de conflito é de 2 arquivos, o ganho de revisão não vem de fatiar o histórico — vem de revisar o **diff inteiro** no PR, que é exatamente o que a revisão independente já fez em §A.6. Por isso recomendo A + P0 imediato.

**O que eu não faço em nenhuma hipótese sem sua autorização:** merge em `main`, rebase, force-push, cherry-pick das quatro branches, apagamento de commit da T13, alteração de `README.md` raiz fora do commit de merge autorizado, ou qualquer operação que reescreva histórico.

---

## 8. Roadmap revisado (dependências e critérios objetivos de aceite)

Regra de coerência herdada da revisão independente e mantida aqui: **nenhum item de um nível começa antes de os critérios do nível anterior estarem observados**, e nenhuma frente (Blender, viewport, agentes) avança sozinha.

### P0 — base íntegra e primeira execução real

| # | Item | Fecha | Depende de | Critério objetivo de aceite |
|---|---|---|---|---|
| **P0.1** | DEC-A…DEC-P registradas num único `DECISIONS.md` na linha principal, com data e responsável humano | R-12, R-13, C-16 | DEC-B | Arquivo existe; DEC-A, B, C, D, E, F, G, L constam respondidas; `DECISIONS-AND-OPEN-QUESTIONS.md` aponta para ele |
| **P0.2** | Consolidação: PR de merge com `README.md`/`AGENTS.md` reconciliados | C-01, R-12 | DEC-A, DEC-B | `main` contém `package.json` e o código; `npm test` = 33 suítes, código 0, em checkout limpo de `main`; verificador de links relativos → **0** quebrados; histórico dos 68 commits preservado (`git log --follow` funciona) |
| **P0.3** | Superfície de rede fechada: loopback por padrão, token por sessão, `Origin` obrigatório em rotas mutáveis, lista fechada de hosts; `/providers`, autorização e revisão **exclusivos do IPC**; `open_panel` removida ou restrita | R-01, R-02, C-06(c) | DEC-C, DEC-L | Conexão de outra máquina às rotas `/api/lia-forge/**` falha; requisição mutável sem token → 401; sem `Origin` → recusada; `Host` fora da lista → recusado; teste que enumera rotas e **falha** se aparecer rota HTTP que configure executável, conceda autorização ou registre revisão; `grep -rn "0\.0\.0\.0"` em código de produção → vazio ou justificado em comentário coberto por teste; preview da Arena continua funcionando |
| **P0.4** | Autorização por run ligada de ponta a ponta (UI → IPC → `scope` → gate) | C-04, R-03, G-02 | DEC-F | Run iniciado sem autorização vinculada ao fingerprint termina `blocked` com `authorization-missing` **pelo caminho IPC real** (teste de integração); alterar entrada, destino ou parâmetro depois da autorização → `authorization-scope-changed`; nenhuma chamada de rede durante a fatia (teste com rede bloqueada passa) |
| **P0.5** | Blender: `--disable-autoexec` + `autoexec_fail` ao abrir `.blend`; `--factory-startup` só em job sem add-on; nunca `save_userpref`; identidade/versão do executável confirmadas **com consentimento** e registradas na proveniência; flags registrados no log do run | R-04, C-11, K4 | DEC-G | Linha de comando no log contém `--background` e `--disable-autoexec`; teste falha se faltar; primeira execução de um caminho mostra caminho + versão reportada + hash e exige confirmação; a confirmação é invalidada se o hash mudar |
| **P0.6** | Cadeia de integridade: `validated` derivado de validação com o mesmo SHA-256; revisão com escrita atômica + `assertSafeWriteTarget` e autoria vinda do canal; versão criada só a partir de run concluído **e** revisado no mesmo hash; exportação exige cadeia íntegra **e** direitos declarados | C-05, C-06, C-07, R-05, R-10, G-04, P0-10 | DEC-E | Nenhum literal `validated: true` em código de produção; artefato sem validação → `validated` ausente/`false`; criar versão de run não concluído, reprovado ou sem revisão do mesmo hash → recusado com erro nomeado (3 testes); exportar com direitos `unknown`/`license-pending`/`restricted`/`blocked` → recusado com motivo; com direitos declarados → permitido e a declaração vai no manifesto; alterar 1 byte do PNG depois da revisão → exportação falha por divergência de hash; segunda decisão sobre o mesmo passo preserva a primeira (já coberto por `1ec516a`) e o arquivo sobrevive a escrita interrompida |
| **P0.7** | Módulo único de confinamento de caminho e único de redação de segredos; `exportRun` deixa de aceitar caminho absoluto de `step.outputs` | R-11, D-05 | — | Teste de arquitetura: nenhuma segunda definição exportada; `/proj-outro` não passa por `/proj`; caminho absoluto em snapshot é recusado; padrão de segredo redigido é o mesmo nos dois módulos (tabela de casos) |
| **P0.8** | **Execução real no alvo**: GLB seu (ou sintético com direitos declarados) → Blender instalado → spritesheet → QA → revisão humana → versão aprovada → exportação, em Windows | G-03, G-08 | P0.1–P0.7 + DEC-P | Critérios 23–29 da revisão independente, que este registro adota: percurso completo no app Electron; PNG passa em `png-structural`, `png-content` e `spritesheet-manifest`; revisão feita por pessoa olhando o PNG real (**rejeição é resultado válido**); cancelar durante o render encerra o processo do Blender (verificado na lista de processos) e deixa o run retomável; fechar o app durante o render e reabrir mostra o run como **interrompido**; registrados como medidos versão do Blender, engine de render, tempo de parede e pico de memória — o não medido permanece `unknown`; o relatório distingue linha a linha o que foi `EXECUTED` no alvo do que rodou com substituto |

### P1 — contratos que as frentes compartilham

| # | Item | Depende de | Critério de aceite |
|---|---|---|---|
| **P1.1** | Vocabulário de capability tipado (DEC-K) + migração das 8 receitas; planner recusa encadeamento de tipos incompatíveis; correção imediata de `UPSTREAM_2D_PREFIXES` | P0 | Sonda de planejamento: `3d-character-spritesheet.animate` **não** é atribuído a `rig2d-software` (ou é, com motivo nomeado e bloqueio); teste de regressão com a sonda publicada neste documento |
| **P1.2** | **Camada 0 — `SceneIndex` declarado** (hierarquia, transforms, bounds declarados, PBR declarado, canais com alvo por nome, IDs estáveis) + correção de F-01/F-02/F-03 + campo de morph targets | P0.8 | Os 10 critérios da frente Three.js (§10.3), que este registro adota integralmente: fixtures nova e adversarial; `triangleCount` correto para `mode` 4/5/6; duração com e sem `accessor.max`; ausência de PBR → `null`, nunca `0`; diagnóstico nunca emite `approved`/`passed`; nenhum arquivo do projeto alterado (SHA-256 antes/depois); `glb-inspect-smoke` verde; **nenhuma dependência nova** no `package.json` |
| **P1.3** | **Perfil GLB da Forge**: o que é obrigatório, o que é medido, o que é recusado, e o que a exportação deve declarar como omitido | P0.8, P1.2 | Documento curto + validador; `.blend`/`.fbx` deixam de ser aceitos só por extensão (inspeção ou recusa nomeada); perda de exportação registrada em campo de proveniência |
| **P1.4** | Envelope de handoff único + ledger por componente (modelo, nó, add-on, versão, licença) | P0.6 | Um tipo só, com `declared` revalidado pelo consumidor; ledger no pacote exportado; licença por componente e não por adapter |
| **P1.5** | Armazenamento endereçado por conteúdo; versões referenciam hash, não pasta de run | P0.6 | Apagar a pasta do run não quebra a versão; deduplicação medida |
| **P1.6** | Um engine: legado aposentado (DEC-D), um store com um escritor (DEC-E) | P0.5 | `main` não contém `electron/workflow-runner.cjs`, `workflow-contracts.cjs`, `workflow-run-store.cjs` nem handlers `lia-forge:workflow:*`/`lia-forge:assets:write`; teste falha se outro arquivo abrir o store para escrita; nada escrito em `.spriteforge/` (hash do diretório antes/depois) |
| **P1.7** | MCP reescrito como **cliente do mesmo serviço** que a UI usa, somente leitura (DEC-L, opção A) | P0.3 | Teste enumera as tools e falha diante de qualquer uma que escreva em disco ou inicie processo; toda leitura passa por `createStudioService`; identidade de cliente registrada |
| **P1.8** | Importação real do pacote exportado em **um** destino, o que você escolher | P0.8 | Asset abre no destino; `verifiedOnDestination: true` só para esse destino, com evidência registrada |
| **P1.9** | Teste de canvas real (DEC-N) e telemetria de processo (`getAppMetrics`) | P1.2 | Sem isso, nenhum critério `F1-*` do viewport é cumprível |

### P2 — largura controlada

Bridge Blender geral (**um** job adicional, como passo do engine, com o experimento factory-startup × add-on resolvido) · primeiro add-on do acervo como adapter, **só** de família com licença resolvida · ComfyUI local real para conceito 2D com proveniência por componente · viewport Fases 1a–4 (cada uma ligada a um gate de QA que a use) · MCP com propostas confirmáveis na UI (DEC-L opção B) · reconciliação de efeitos remotos · instalador Windows homologado · QA de conteúdo 3D.

### P3 — depois de haver assets reais

Provider remoto pago piloto (exige reconciliação + autorização de custo + classificação de dados) · perfil visual/style lock/change impact da spec de domínio · contrato compartilhado Lia Studio ↔ Lia Forge · Skills em runtime · A1/A3/A2 · VLM de apoio à revisão · benchmark · rotas 2.5D/splats/áudio/vídeo · WebGPU.

**O que este roadmap adia de propósito**, apesar de haver documentação extensa pronta: a spec de domínio completa, o Bridge geral, os oito papéis de agente, as fases 2–5 do viewport e a PoC com add-on. Não por serem ruins — porque cada um pressupõe uma base que ainda não foi executada uma vez.

---

## 9. A única próxima fatia de implementação recomendada

> ### "Do GLB ao spritesheet aprovado e exportado, pelo caminho governado, com Blender real"
>
> `GLB próprio ou sintético com direitos declarados → planejar → autorizar (fingerprint) → Blender instalado → spritesheet + manifesto → QA determinístico → revisão humana (aprovar **ou** rejeitar) → versão aprovada → exportação com ledger`

**Avaliação da recomendação da revisão independente contra o código atual e a pesquisa Blender** — pedido seu, Etapa 4.

| Pergunta | Resposta medida |
|---|---|
| Todos os elos têm código? | **Sim, exceto dois.** Existem: entrada de modelo (`saveInput`, 32 MB), inspeção GLB (`glb-inspect` + `inspectGlb`), plano (`3d-object-render`), adapter Blender (`electron/adapters/blender-spritesheet.mjs` + `electron/blender-adapter.cjs` + `scripts/blender_spritesheet.py`), validadores (`png-structural`, `png-content`, `spritesheet-manifest`, `glb-structural`, `destination-profile`), gate de revisão por SHA-256 (`checkReview`), retomada por checkpoint (`resumeRun`), versão (`attachRunToAsset`/`addAssetVersion`) e exportação com compatibilidade medida (`exportRun`). Faltam: **autorização por run ligada** (P0.4) e **integridade da cadeia** (P0.6). Ambos são pequenos e locais |
| Precisa instalar algo? | **Não.** O Blender já está na máquina do usuário (5.3.0, segundo a auditoria local). Nenhum add-on, nenhum modelo, nenhuma dependência nova |
| Envolve rede, custo, IA ou licença de terceiro? | **Não**, se a fixture for sua ou sintética. É a única candidata com essa propriedade |
| Atravessa os P0? | **Sim, obrigatoriamente.** Não dá para executá-la na linha principal sem P0.2; nem com segurança sem P0.3 e P0.5; nem com integridade sem P0.4 e P0.6; nem honestamente sem P0.7 |
| A pesquisa Blender contradiz a fatia? | **Não — ela a reforça e a condiciona.** A frente Blender chega à mesma conclusão sobre onde está o código completo (rota **B1**, headless com script first-party, "rota principal"), e acrescenta três pré-condições que a revisão independente não tinha: (i) `--disable-autoexec`/`autoexec_fail` ao abrir `.blend` (K4); (ii) identidade do add-on/pacote tem de ser **SHA-256**, não versão declarada (HairCard Studio prova por quê); (iii) `inspectGlb` não mede morph targets, então qualquer critério de aceite que os envolva não é avaliável (P1.2/P1.3) |
| E a PoC-1 com Wiggle Bones? | **Fica depois, e só com DEC-M.** Três razões: exige instalar e habilitar add-on GPL de terceiro (decisão de licença e de redistribuição, DEC-H/DEC-M/DEC-O); a pré-condição técnica M0 (`bpy.ops.object.mode_set(mode='POSE')` em `--background`) **não foi medida** pela própria frente, e se falhar a conclusão dela muda; e ela não fecha nenhum P0. A fatia recomendada exercita os mesmos riscos arquiteturais (habilitação não entra, mas entram execução real, proveniência, cancelamento, validação, revisão) sem nenhuma dessas dependências |
| E o Three.js? | **Etapa posterior, como instrumento da revisão visual — não como frente nova.** O valor de arquitetura do viewport é resolver G-10 (dar à pessoa algo para olhar ao aprovar, especialmente em 3D). Por isso ele vem **depois** de a cadeia de revisão existir e ser usada uma vez de verdade. A exceção que vale registrar: a **Camada 0** (`SceneIndex` declarado) não precisa de `three`, de GPU, de CSP nem de Windows, corrige três defeitos reais de `glb.mjs` e é 100% testável em Node — mas mesmo ela entra em P1.2, depois de P0.8, porque não é pré-requisito da cadeia de produção e abrir essa frente agora seria exatamente o que as quatro análises pedem para não fazer |
| E agentes/Skills/MCP? | **Nenhum runtime novo.** A pergunta correta, e a que este registro responde, é: **como o MCP existente passa a ser cliente do mesmo serviço e dos mesmos gates da UI.** Resposta: DEC-L opção A agora (somente leitura, sem `open_panel`, sem escrita no store, sem shell), e a opção B depois — agente **propõe**, a pessoa **autoriza no produto**. Hoje é o inverso: o agente tem um canal com menos controles que o da pessoa |

### 9.1 Escopo fechado da fatia

**Dentro.** P0.2 a P0.8 de §8, nesta ordem, cada um com seu critério de aceite. Um único workflow exercitado: `3d-object-render` (e, se o seu GLB tiver animação, o render de spritesheet do contrato humanoide **só como leitura**, sem alterar o contrato 384×144 / 8×3 / 24 frames de 48×48).

**Fora, explicitamente.** Viewport/`three` · Bridge geral e qualquer add-on (inclusive Wiggle Bones, SKkeeper, SquishyFX) · qualquer geração por IA, ComfyUI, provider local ou remoto · MCP com escrita e papéis de agente · spec de domínio além do núcleo mínimo · novas receitas, capabilities, adapters ou validadores não exigidos pela fatia · runner legado e `App.jsx` legado (saem em P1.6, não são tocados aqui) · instalador · importação em engine (vem em P1.8) · alteração de `scripts/generate_third_party_notices.py` (DEC-I).

**Contenção verificável.** O PR da fatia não adiciona `three`, novas capabilities, novas receitas, novos adapters nem novos documentos de especificação além dos de decisão/estado; se o MCP permanecer, expõe apenas ferramentas de leitura (teste enumera e falha diante de qualquer uma que escreva em disco ou inicie processo).

**Autorizações exigidas antes de começar (DEC-P):** autorizar a consolidação na linha principal (DEC-A/DEC-B); autorizar a execução do Blender instalado, na sua máquina, sobre um arquivo escolhido por você; indicar a fixture e declarar seus direitos; autorizar a instalação das dependências npm de desenvolvimento já declaradas.

---

## 10. O que permanece fora de escopo por enquanto

1. **Qualquer merge, rebase, cherry-pick ou force-push.** A consolidação é sua decisão (DEC-B); este registro só a prepara com números.
2. **Instalação, habilitação ou execução de add-on, modelo, Skill, MCP ou dependência de terceiro** — inclusive os de licença verificada (Wiggle Bones, SKkeeper, SquishyFX 3.3.0). Sem DEC-M não há PoC.
3. **Qualquer provider remoto, envio de dado, custo ou compra.** Exige DEC-F, classificação de dados (G6) e reconciliação de efeitos remotos (G-09).
4. **Viewport Three.js, canvas, WebGL/WebGPU, Draco/KTX2.** Exige DEC-N, DEC-J, DEC-C e teste de canvas real (P1.9).
5. **Runtime de agentes, novas Skills, novos MCPs.** Exige P1.7 (o MCP atual virar cliente somente leitura) e, para a opção B, confirmação na UI.
6. **Spec de domínio completa (17 tipos, 12 decisões).** Adotado o núcleo mínimo proposto pela revisão (DEC-03-C): `Asset`, `AssetVersion`, `Artifact`, `Provenance`, `ValidationResult`, `HumanReview`, `RightsRecord`, `ConsentRecord`. Perfil visual, style lock e change impact ficam para P3.
7. **Bridge Blender geral e catálogo de jobs.** Só depois de P1.3 (perfil GLB) e P1.5, com o experimento factory-startup × add-on resolvido.
8. **Uso do acervo local (580 cenas, 38 famílias) como fixture, técnica ou adapter.** DEC-O: referência documental até direitos por item. A frente Blender mediu 61 cenas com script text e 31 com driver com script — nenhuma é dado inerte.
9. **Alteração de contratos existentes** (inclusive o do spritesheet humanoide) e de `scripts/generate_third_party_notices.py`.
10. **Afirmar compatibilidade com RX 580 / gfx803, EEVEE, WebGPU ou qualquer versão de Blender sem medição.** Permanece `unknown` até P0.8 produzir número.
11. **Qualquer promoção de estado**: nada neste documento transforma `PROPOSED` em `IMPLEMENTED`, `IMPLEMENTED` em `EXECUTED` ou `EXECUTED` com substituto em `VALIDATED` com ferramenta real.

---

## 11. Apêndice — evidências desta sessão

### 11.1 Comandos e resultados

| Verificação | Comando | Resultado |
|---|---|---|
| Ancestralidade | `git rev-parse --is-shallow-repository`; `cat .git/shallow`; `git merge-base 27e2156 origin/main`; `gh api repos/BloomRX/Lia-Forge/compare/main...arena/649f88bd-3dspritesheet` | `true`; `13dc4c7` + `6bd9a5a`; vazio; `diverged / ahead_by 68 / behind_by 3 / merge_base 13dc4c7` |
| Snapshot das análises | `gh api …/compare/main...5b0ec51` | `ahead_by: 65` (a revisão publicou 67) |
| Raiz comum | `git ls-tree -r --name-only 13dc4c7` | 1 arquivo: `README.md` |
| Superfície de conflito | `git ls-tree -r --name-only origin/main \| sort` × idem `27e2156`; `comm -12`; comparação de blobs | 42 × 206; interseção 3; `docs/BRAND-STANDARDS.md` idêntico; `README.md`/`AGENTS.md` divergem |
| Alvos dos links quebrados de `main` | `git cat-file -e 27e2156:<caminho>` para 11 alvos | **todos existem** na T13 |
| Suíte | `npm test`; `npm run test:python`; `npx vite build` | 33 suítes, código 0; 30 testes, OK; JS 360,63 kB / CSS 116,92 kB |
| Superfície HTTP | `grep -n "allowedHosts\|0\.0\.0\.0" vite.config.js package.json`; leitura de `isSameOriginRequest` | `:569`, `:571`, scripts `dev`/`preview`; `if (!origin) return true` |
| Gate de autorização | `grep -n scope shared/engine/execution-manager.mjs`; leitura de `studio-service.mjs:901-903`; handler `lia-forge:studio:run` | `if (scope)` em `:190`; serviço não passa `scope`; IPC não passa `authorization` |
| Direitos | `grep -rn "classifyRights\|rightsReport" shared/services/studio-service.mjs` | só leitura/exibição (`:730-732`, `:1315-1316`, `:1490`) |
| `validated` literal | leitura de `attachRunToAsset` | `studio-service.mjs:1340` |
| Confinamento em `exportRun` | leitura do método | `startsWith(runDirectory) \|\| startsWith(projectRoot)` + aceita `step.outputs` absoluto |
| Redação duplicada | `sed -n` nos dois `SECRET_PATTERNS` | `gates.mjs` cobre `credential`/`signature` e usa `\b`; `sdk.mjs` não |
| MCP | `grep -n "registerTool(server, '"`; `grep -n "spawn\|shell"` | 10 tools; `shell: process.platform === 'win32'` em `:277,629,641`; `npm run dev -- --host 0.0.0.0` em `:636` |
| Store legado | `grep -rn "assets.json"` | `studio-service.mjs:380`, `manager.mjs:8,117`, `main.cjs:253`, `spriteforge-mcp.mjs:19` |
| Engine legado | `grep -c "lia-forge:workflow:" electron/main.cjs`; `grep -n "lia-forge:assets:write"` | 6 handlers + `:1007` |
| Blender | `grep -n "background\|factory-startup\|disable-autoexec\|shell" electron/blender-adapter.cjs`; `grep -n open_mainfile scripts/blender_spritesheet.py`; `grep -n "character\|item"` | `:69` só `--background`; `:167` `shell:false`; `:59` `open_mainfile`; `:65` taxonomia |
| GLB | `grep -n "targets\|mode\|durationSeconds\|metallic" shared/model3d/glb.mjs` | `:54` lê `mode`, `:57/:69` dividem por 3; `:86` duração de `accessor.max`; `:87` `targets` = canais de animação; nenhum valor PBR |
| Extensões de modelo | `grep -n "MODEL_EXTENSIONS" shared/qa/validators.mjs` | `:18` allowlist por extensão (`blend, glb, gltf, fbx, obj, stl, ply, spz`) |
| Custo por run | `grep -n cost shared/engine/execution-manager.mjs` | `:347-355` acumula `entries` e deriva `status`; `total` permanece `null` |
| Decisões canônicas | `git show 27e2156:docs/DECISIONS-AND-OPEN-QUESTIONS.md \| grep -oE "^[0-9]+\."` | maior número **44** |
| `three` / notices | `package.json`; `grep -icE "\bthree\b\|draco\|basis_universal\|meshopt" THIRD_PARTY_NOTICES.md` | ausente; 0 |
| CSP | `grep -rn "Content-Security-Policy" index.html electron/*.cjs vite.config.js` | 0 |
| Domínio desligado | `grep -rn "domain/contracts" shared electron src scripts vite.config.js` | vazio; só `tests/domain-contracts-smoke.mjs` |

### 11.2 Sonda de planejamento executada em `27e2156` (G-01)

`createStudioService({ projectRoot: <tmp> }).plan(...)`, sem executar run; diretório temporário removido.

```text
3d-character-spritesheet   (plan.blocked = true)
   reference-views | image2d.generate-concept | adapter=null           | bloqueado: precisa de "prompt" (só você pode fornecer)
                                          candidatos: comfyui-concept, comfyui-remote
   generate-3d     | model3d.generate         | adapter=null           | bloqueado: nenhum adapter declara a capacidade
   auto-rig        | rig3d.auto               | adapter=null           | bloqueado: nenhum adapter declara a capacidade
   animate         | motion.cycles            | adapter=rig2d-software | SEM BLOQUEIO  ← defeito residual de G-01
                                          candidatos: rig2d-software (applicable: true), blender-spritesheet (missing, applicable: true)
   render-2d       | render3d.to2d            | adapter=null           | bloqueado: nenhum candidato utilizável (blender-spritesheet=missing)
   deliver         | export.engine            | adapter=export-package | sem bloqueio
3d-object-render
   inspect         | model3d.inspect          | adapter=glb-inspect    | sem bloqueio
   render          | render3d.frame           | adapter=null           | bloqueado: blender-spritesheet=missing
   atlas           | render.atlas             | adapter=rig2d-software | SEM BLOQUEIO  ← mesma causa
   deliver         | export.engine            | adapter=export-package | sem bloqueio
```

Comparação com a sonda da revisão independente (§A.3, em `5b0ec51`): o defeito **reproduz**, mas o quadro é diferente do que ela descreve — hoje o plano traz `candidates[]` com `applicable`/`reason` (mecanismo de `9c23d48`) e o motivo de cada bloqueio é nomeado. A causa residual é `UPSTREAM_2D_PREFIXES = ['rig2d.','image2d.']` (`shared/adapters/software.mjs:399`): `reference-views` tem capability `image2d.generate-concept`, então `comesFrom2d()` devolve `true` dentro de uma receita **3D** e `canHandle` aceita `motion.cycles`. Correção barata em P1.1; correção de fundo é tipar I/O (DEC-K).

### 11.3 Limitações deste registro

1. **Nenhuma execução com ferramenta real.** Blender, ComfyUI, Godot, Unity, Unreal, GPU e Windows não foram exercitados. Todo `EXECUTED` aqui é Node/Python no sandbox, com substitutos de teste rotulados.
2. **Riscos de segurança não explorados.** P0-1 a P0-7 são leitura de código e, no caso da sonda, execução de planejamento sem efeito. Nenhum servidor foi exposto, nenhuma requisição maliciosa foi enviada, nenhum Blender foi aberto.
3. **Leitura dirigida das pesquisas consolidadas em `main`.** Os 18 documentos de `threejs-3d-environment/`, os 4 `T14-*` e os 13 arquivos de `auditoria-blender-local/` (~1,9 MB de JSON) não foram relidos linha a linha; uso as conclusões das quatro análises e verifico apenas o que elas afirmam sobre o código.
4. **`B-03` (fase divergente entre três documentos) não foi reproduzido em profundidade** — exige ler os 18 capítulos da pesquisa. Adoto, como a auditoria Three.js fez, o critério mais restritivo.
5. **Nenhuma análise jurídica.** Os pontos de licença (DEC-H, DEC-M, DEC-O, R-07, R-08) são sinalizações para revisão sua, com o texto que as quatro análises leram em fonte primária.
6. **Números de contagem de commits exigem a ressalva do clone raso** (§7.2). Um terceiro que repita as medições num clone completo pode obter os mesmos `merge_base`/`ahead_by` da API, mas verá a história completa de `main`.
7. **Este documento não substitui** `docs/T13-IMPLEMENTATION-EVIDENCE.md` (registro canônico do que foi executado na T13), nem as quatro análises, nem a pesquisa consolidada em `main`. Ele os relaciona e diz o que vale hoje.
