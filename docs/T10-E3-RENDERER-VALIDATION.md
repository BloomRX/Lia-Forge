# T10 · E3 — Validação real do renderer Blender e dos validadores de spritesheet

> **Estado:** execução real parcial, **com bloqueios registrados**. Nenhuma capacidade foi promovida a `VERIFIED` além do que foi efetivamente executado aqui.
> **Data:** 2026-11-12 UTC. **Branch:** `arena/649f88bd-3dspritesheet` (`HEAD` local `13dc4c7d…`, ponta remota `46475ce…` no início da tarefa).
> **Limite respeitado:** nenhum modelo ou personagem de terceiros foi baixado; nenhum código de produção foi alterado; nenhuma instalação foi feita. Artefatos de teste foram gravados **somente** em `local-renderer-test/output/`, pasta **ignorada pelo Git** (`local-renderer-test/.gitignore:3` → `/output/`).
> **Leitura obrigatória antes de qualquer conclusão:** a execução abaixo **não aconteceu na máquina-alvo**. Ver §1.

## 1. Ambiente em que os testes foram executados — e por que isso importa

Medições reais feitas nesta tarefa, no ambiente disponível ao agente:

| Item | Valor medido | Máquina-alvo esperada (ADR-001, Decisão 5) |
|---|---|---|
| Sistema | **Debian GNU/Linux 12 (bookworm)**, kernel 6.1.158+, x86_64 | **Windows** (10/11) |
| CPU | Intel Xeon @ 2,60 GHz — **2 CPUs** (1 núcleo, 2 threads) | AMD Ryzen 5 5500 (6C/12T) |
| RAM | **3.939 MB totais** (3.707 MB disponíveis), **swap = 0** | **16 GB** |
| Disco | 21 GB totais, **20 GB livres** | a verificar |
| GPU | **nenhum dispositivo de vídeo**: `lspci` indisponível, `/dev/dri` ausente | **AMD Radeon RX 580 8 GB (Polaris/gfx803)** |
| Vulkan | `vulkaninfo`/`glslc` ausentes; `libvulkan` ausente; `/usr/share/vulkan/icd.d/` ausente | a verificar |
| Blender | **ausente** no PATH e em qualquer instalação conhecida | a instalar/verificar |
| PowerShell | **ausente** (`pwsh`/`powershell` não existem) | presente |
| Runtimes | Python 3.11.2 · Node v22.22.3 · npm 10.9.8 | — |

**Consequências diretas, registradas como fatos e não como opinião:**

1. **O render Blender real não pôde ser executado**: não há Blender, não há GPU, não há sistema gráfico e o ambiente não é Windows. O harness do projeto (`local-renderer-test/run-render.ps1`) é PowerShell; sem `pwsh`, seu caminho `.ps1` não é acionável aqui.
2. **Nenhum `.blend` existe no repositório** (busca por `*.blend`, `*.glb`, `*.gltf`, `*.fbx`, `*.obj`, `*.stl` retorna vazio) e o `local-renderer-test/README.md` declara que `assets/` deve ser preenchido **pelo usuário** a partir de FBX licenciados — e esta tarefa proíbe baixar modelos de terceiros. Portanto o cenário "personagem com `idle`/`walk`/`run`" **não tinha entrada disponível**.
3. **O que pôde ser executado de verdade** foi: os validadores estruturais do projeto, o planejador de caminhos/argumentos do harness, o gate de procedência/licença, a detecção de Blender, e a suíte automatizada de testes. Isso é evidência **de contrato e de validação**, não de renderização.

Tudo abaixo é classificado com essa separação explícita.

## 2. Auditoria antes da execução (o que o projeto já prevê)

| Pergunta | Resposta verificada no código |
|---|---|
| Qual comando inicia o renderer? | Harness: `local-renderer-test/run-render.ps1 -Subject <sujeito>` (PowerShell) ou, sem PowerShell, `node local-renderer-test/scripts/run-render.cjs --subject <sujeito>`. O runner chama o Blender com `--background --python scripts/blender_spritesheet.py -- --input <modelo> --output-dir <dir> --asset-name <nome> --asset-type character --frame-width 48 --frame-height 48 --animations-json '["idle","walk","run"]'` (`buildBlenderArguments`, linhas 43–59). |
| Qual versão do Blender é esperada? | O projeto **não fixa versão**: usa `electron/external-tools.cjs → findExternalTool('blender')` (PATH + instalações conhecidas, incluindo Steam no Windows), consulta `--version` e registra em `blender-version.txt`. O Effigy (referência externa, não dependência) pinava 5.2.2 LTS. O renderer escolhe engine `BLENDER_EEVEE_NEXT` se existir no enum, com fallback (`scripts/blender_spritesheet.py:107`). |
| Quais entradas são necessárias? | **Um único arquivo** com mesh/skin, armature principal e as Actions reais acessíveis em `bpy.data.actions` (`combined.blend`). Formatos aceitos: `.blend`, `.glb`, `.gltf`, `.fbx`, `.obj`, `.stl` (`MODEL_EXTENSIONS`, `electron/blender-adapter.cjs:6`). |
| Quais actions são suportadas? | Contrato solicita `idle`, `walk`, `run`. Resolução por **sequência de tokens completos**, insensível a maiúsculas (`matching_actions`): `mixamo|Idle` casa com `idle`; `Mixamo|Walk Forward` casa com `walk`; `Running` **não** casa com `run`. Nomes ambíguos são rejeitados; duas solicitações não podem selecionar a mesma Action. |
| Qual resolução/organização de atlas? | `FRAME_SIZE = {48,48}`; grade **8 colunas × 3 linhas**; atlas **384 × 144** (`verify-output.cjs:22-24`). É o contrato aplicável ao ensaio de personagem; não foi alterado para acomodar o teste. |
| Quais formatos são produzidos? | `spritesheet.png` (RGBA8), `spritesheet.json` (`schemaVersion: 1`), mais `validation-report.json`, `validation.log`, `run-provenance.json`, `blender-version.txt`, `blender.log` (`run-render.cjs:256`). |
| Câmera/enquadramento | Ortográfica própria: `ortho_scale = max(dim) × 1.35`, `lens = 50` (`blender_spritesheet.py:115-116`); props estáticos recebem turntable ortográfico reproduzível (linha 185). |
| Quais validadores já existem? | Produção: `electron/spritesheet-manifest.cjs` (`validateSpritesheetManifest`) + `electron/blender-adapter.cjs` (`validateSpritesheetFiles`) + `electron/png-validation.cjs` (RGBA8/CRC/dimensões). Harness: `local-renderer-test/scripts/verify-output.cjs` (decodifica o PNG, conta **pixels com alpha por célula**, mede variação entre frames de `walk`/`run`, compara hashes) e `check-source-license.cjs` (gate de procedência/licença). |
| Testes automatizados × inspeção visual | Automatizados: suíte Python `unittest` (30 testes) e 14 smokes Node. **Inspeção visual humana é exigida pelo próprio projeto**: "`checks_passed_visual_review_required` significa somente que os checks automatizados passaram; **não** valida o renderer por si só … abra o PNG e inspecione as 24 células" (`local-renderer-test/README.md` §6). |
| Caminho principal previsto pela arquitetura | O harness `local-renderer-test/` é o caminho **já previsto pelo projeto** para validação real no Windows (preparação → manifesto revisado → render → verificação → compartilhamento). Ele foi usado como base; não foi criado renderer novo. |

## 3. Comandos executados e resultados reais

| # | Comando | Exit | Resultado observado |
|---|---|---|---|
| 1 | `node local-renderer-test/scripts/runner-smoke.cjs` | 0 | `local renderer runner smoke passed (sem Blender, sem assets e sem render).` |
| 2 | `python3 -m unittest tests.test_blender_spritesheet -v` | 0 | **4/4 OK** — case-insensitive `idle`/`walk`/`run`; tokens completos, não substrings; ambiguidade rejeitada; sem seleção silenciosa da mesma Action |
| 3 | `python3 -m unittest discover -s tests -p 'test_*.py'` | 1 | **30 testes, 29 ok, 1 FAIL**: `test_installed_npm_tree_matches_lockfile` (`AssertionError: False is not true`) — `node_modules/` ausente; **falha pré-existente conhecida**, não causada por esta tarefa |
| 4 | `node -e "require('./electron/external-tools.cjs').findExternalTool('blender')"` | — | **`null` → Blender NÃO detectado** (fail-closed do helper) |
| 5 | `node local-renderer-test/scripts/check-source-license.cjs mixamo-male` | 1 | `Render bloqueado para mixamo-male; procedência/licença incompleta` + **22 exigências** (termos revisados, `reviewed_by_user`, `localRenderingConfirmed`, origem, versão, títulos e nomes reais das Actions de `idle`/`walk`/`run`, `confirmedByUser`) |
| 6 | `node local-renderer-test/scripts/run-render.cjs --subject mixamo-male --check-only` | 0 | **`Estado: BLOQUEADO`** + 24 motivos, incluindo `combined.blend: ausente em assets/mixamo-male/combined.blend` e `Blender: não detectado`. (`--check-only` é diagnóstico: sai 0 mesmo bloqueado.) |
| 7 | 9 smokes `.cjs` (`task-manager`, `navigation-guard`, `ipc-guard`, `manual-artifacts`, `external-tools`, `workflow-run-store`, `blender-workflow-plan`, `blender-adapter`, `lia-paths`) | 0 | **9/9 passed** |
| 8 | `node tests/{comfyui-client,asset-progress,domain-contracts}-smoke.mjs` | 0 | **3/3 passed** |
| 9 | `node tests/{mcp,vite-store}-smoke.mjs` | 1 | `Cannot find package '@modelcontextprotocol/sdk'` (mcp); erro de dependência (vite-store) — ambos por `node_modules/` ausente |
| 10 | `node tests/workflow-runner-smoke.cjs` | 0 | `Workflow runner smoke test passed.` |
| 11 | Driver T10 (sem modificar o projeto): `validateSpritesheetFiles`/`validateSpritesheetManifest` contra o contrato **384×144 / 8×3 / 24 frames** | 0 | **PASS**: `{sheetWidth:384, sheetHeight:144, frameCount:24}`; manifesto válido |
| 12 | Controles negativos do validador estrutural | — | **3/3 rejeitados corretamente**: PNG 384×96 com manifesto 384×144 → "dimensões … não correspondem ao PNG real"; `animations:['idle']` → "não correspondem às ações solicitadas"; frames duplicados → "O frame 2 … é inválido" |
| 13 | **Controle negativo de conteúdo**: PNG 384×144 **totalmente transparente** no validador de produção | 0 | **ACEITO** `{384,144,24}` → **lacuna documentada em §8.1** |
| 14 | `node local-renderer-test/scripts/verify-output.cjs <fixture> <blend ausente> <blender> mixamo-male` | 1 | `Verificação não concluída: Modelo de entrada ausente/vazio: …/combined.blend` — **fail-closed de proveniência** (linha 184–185, antes de qualquer análise de pixels) |
| 15 | `node local-renderer-test/scripts/run-render.cjs --subject mixamo-male` (render real) | **não executado** | **BLOCKED**: sem Blender, sem `.blend`, sem GPU, sem Windows |

## 4. Entradas utilizadas (fixtures sintéticos, sem assets de terceiros)

Como não havia `.blend` nem render possível, os validadores foram exercitados com **fixtures sintéticos gerados localmente** (RGBA8, 384×144, grade 8×3 de células 48×48), gravados na pasta gitignored `local-renderer-test/output/t10-e3-validator-fixtures/`:

| Arquivo | Conteúdo | Bytes | SHA-256 (24 primeiros) |
|---|---|---|---|
| `fixture-full-384x144.png` | 24 células com retângulo não-transparente (controle positivo estrutural) | 1.231 | `c57a2ecf8ddb66ac6cebfa80` |
| `fixture-hole-walk3-384x144.png` | idem, com a célula `walk`/coluna 3 **vazia** (controle negativo de conteúdo) | 1.326 | `8b670358911d5bb094330b3f` |
| `fixture-transparent-384x144.png` | atlas **inteiramente transparente** (controle negativo de conteúdo) | 294 | `d315cbaf5dda4ae5c8a00cc6` |
| `spritesheet.json` | manifesto `schemaVersion: 1`, 24 frames, `origin: top-left`, `anchor: feet` | 6.791 | — |
| `t10-validator-results.json` | resultados do driver, ambiente e hashes | 1.444 | — |

Inspeção visual do `fixture-full-384x144.png` confirmou a grade esperada: 3 linhas × 8 colunas de retângulos sobre fundo transparente, escala e posição uniformes. **Isto é um fixture de validação, não um resultado de render.**

## 5. Resultados por categoria exigida

### 5.1 Renderização
- **O Blender não executou.** Não há Blender no ambiente (`findExternalTool → null`), não há GPU e o SO não é o alvo. **Classificação: `BLOCKED`.**
- Nenhum arquivo de saída de render existe; não há dimensões, transparência nem frames reais a avaliar.

### 5.2 Spritesheet (contrato)
- O **validador estrutural de produção aceita o contrato 384×144 / 8×3 / 24 frames** e rejeita corretamente dimensão divergente, animações divergentes e frames duplicados/inválidos. **Classificação: `VERIFIED_IN_FORGE` para o contrato e para o validador estrutural.**
- A verificação de **conteúdo** (células vazias, variação de `walk`/`run`) existe **apenas no harness** (`verify-output.cjs`) e **não pôde ser executada** porque ela exige, por desenho, o modelo de entrada presente. **Classificação: `BLOCKED` para a validação de conteúdo.**

### 5.3 Animação
- Resolução de nomes de Action (`idle`/`walk`/`run`, tokens completos, case-insensitive, sem ambiguidade e sem duplicação) **verificada por execução**: 4/4 testes OK. **Classificação: `VERIFIED_IN_FORGE` (resolução de nomes).**
- Continuidade, enquadramento e qualidade de pose **não avaliáveis** sem render. **Classificação: `BLOCKED`.**

### 5.4 Validação
- **Executados e aprovados:** 14 testes automatizados Node (incl. `blender-adapter`, `blender-workflow-plan`, `workflow-runner`), 29/30 testes Python, gate de procedência (bloqueia corretamente), detecção de Blender (fail-closed), validador estrutural com 3 controles negativos corretos.
- **Executados e reprovados por causa do ambiente:** `mcp-smoke.mjs` e `vite-store-smoke.mjs` (dependências ausentes), `test_installed_npm_tree_matches_lockfile` (idem; pré-existente).
- **Não executados (não existem):** análise de pixels por célula do render real, variação `walk`/`run`, hashes de entrada do `combined.blend`, `blender-version.txt`, `blender.log`.
- **Não existe** verificação de conteúdo no validador de produção (§8.1).
- **Nenhuma qualidade visual foi declarada aprovada.** O único "visual" inspecionado é o fixture sintético.

## 6. Evidência visual

Não há resultado de render para apresentar. A única imagem produzida nesta tarefa é o fixture sintético descrito em §4 (grade 8×3, células 48×48, fundo transparente), usada para provar que os validadores aceitam o formato do contrato e rejeitam desvios. O `local-renderer-test/README.md` é explícito ao exigir **inspeção humana das 24 células** antes de qualquer registro de validação — isso permanece pendente e **só pode ocorrer na máquina-alvo, com um `combined.blend` real e licenciado**.

## 7. Repetibilidade

Três execuções de cada comando-chave, neste ambiente:

| Comando | min | mediana | máx | exit |
|---|---|---|---|---|
| `python3 -m unittest tests.test_blender_spritesheet` | 0,044 s | 0,045 s | 0,056 s | 0 |
| `python3 -m unittest discover -s tests -p 'test_*.py'` | 0,103 s | 0,106 s | 0,107 s | 1 (falha conhecida) |
| `node tests/blender-adapter-smoke.cjs` | 0,062 s | 0,065 s | 0,069 s | 0 |
| `node tests/workflow-runner-smoke.cjs` | 0,082 s | 0,101 s | 0,115 s | 0 |
| `node local-renderer-test/scripts/runner-smoke.cjs` | 0,033 s | 0,034 s | 0,036 s | 0 |
| driver T10 dos validadores | 0,048 s | 0,051 s | 0,051 s | 0 |
| `run-render.cjs --subject mixamo-male --check-only` | 0,027 s | 0,031 s | 0,032 s | 0 |

Regeneração dos fixtures em duas execuções independentes do driver produziu **hashes idênticos** (`c57a2ecf…`, `8b670358…`, `d315cbaf…`) — o gerador de fixture é determinístico. **O renderer em si não foi executado, portanto sua determinismo não foi medido**; o que o projeto já declara sobre reprodutibilidade (seed, turntable ortográfico de props, `resolution_percentage = 100`) permanece como afirmação de código, não como medição.

## 8. Problemas encontrados

### 8.1 Lacuna real de validação (achado novo, não defeito de teste)
O validador de produção `validateSpritesheetFiles`/`validateSpritesheetManifest` **aceita um atlas 384×144 inteiramente transparente** — ele confere schema, dimensões, grades, frames, pivôs e durações, mas **não inspeciona conteúdo de pixels**. A detecção de "célula totalmente transparente" e a medição de variação entre frames existem **somente** no harness `local-renderer-test/scripts/verify-output.cjs` (linha 216 e `changedPixelCount`). Consequência: um render que produza um atlas vazio mas bem formado **passaria** pela validação de produção e só seria barrado no ensaio manual. Isto está registrado como pendência, não corrigido (corrigir seria alterar código de produção para acomodar teste — proibido nesta tarefa).

### 8.2 `verify-output.cjs` exige proveniência antes de pixels
Por desenho, o verificador de conteúdo **recusa executar** sem o modelo de entrada presente e não vazio (exit 1, "Modelo de entrada ausente/vazio"). É uma barreira correta de procedência — mas significa que a validação de conteúdo **nunca** roda isoladamente; ela é inseparável de um render com origem registrada.

### 8.3 Bloqueios de ambiente (registrados, não contornados)
Blender ausente · GPU ausente · SO não é Windows · PowerShell ausente (caminho `.ps1` inacessível) · `node_modules/` ausente (2 smokes `.mjs` + 1 teste Python falham) · **nenhum `.blend`/modelo no repositório** e proibição de baixar assets de terceiros.

### 8.4 Gate de licença exige decisão humana
`check-source-license.cjs` bloqueia com 22 exigências, incluindo `reviewed_by_user`, `currentOfficialTermsVerified`, `localRenderingConfirmed` e `confirmedByUser` por Action. **Nenhum desses campos pode ser preenchido pelo agente** — são declarações da pessoa. O gate funcionou exatamente como previsto.

## 9. Classificação final por parte

| Parte | Classificação | Justificativa |
|---|---|---|
| Resolução de nomes de Action (`idle`/`walk`/`run`) | **`VERIFIED_IN_FORGE`** | 4/4 testes executados e aprovados neste ambiente |
| Contrato 384×144 / 8×3 / 24 frames no validador estrutural | **`VERIFIED_IN_FORGE`** | Executado com fixture + 3 controles negativos corretos |
| Planejador de caminhos, argumentos e criação de pastas de saída | **`VERIFIED_IN_FORGE`** | `runner-smoke.cjs` aprovado |
| Gate de procedência/licença e detecção de Blender | **`VERIFIED_IN_FORGE`** | Bloqueiam corretamente por execução real |
| Smokes de adapter/plano/runner/store/paths/guards | **`VERIFIED_IN_FORGE`** | 14 executados e aprovados |
| Render Blender real (pixels, atlas, frames) | **`BLOCKED`** | Sem Blender, sem GPU, sem Windows, sem `.blend` |
| Validação de conteúdo (células vazias, variação de ação) | **`BLOCKED`** | Exige modelo de entrada presente; inexecutável sem render |
| Continuidade/qualidade visual de animação | **`BLOCKED`** | Exige inspeção humana de render real |
| Render na **máquina-alvo (RX 580)** | **não testado** | Ambiente do agente não é o alvo; nenhum número desta tarefa descreve a RX 580 |

## 10. Limitações

1. Nenhuma medição desta tarefa descreve a máquina-alvo; **nada aqui valida o Blender na RX 580**.
2. Os fixtures provam o **validador**, não o **renderer**. Um validador que aceita um atlas correto não implica que o renderer produza um atlas correto.
3. A suíte Python tem 1 falha pré-existente (`node_modules` ausente) e 2 smokes `.mjs` falham pelo mesmo motivo; isso é estado do ambiente, não regressão.
4. Tempos acima são do ambiente do agente (2 CPUs); **não** são tempos de render e não devem ser comparados a benchmarks de terceiros.
5. A inspeção visual humana das 24 células permanece pendente e é condição para qualquer registro de validação visual.

## 11. Checklist para concluir E3 na máquina-alvo (executar lá, não aqui)

Na máquina Windows com Blender instalado, em PowerShell, na raiz do checkout:

1. `.\local-renderer-test\scripts\prepare-folders.ps1` — cria `assets/` e `output/` sem tocar em nada existente.
2. Colocar `assets/mixamo-male/combined.blend` (e `mixamo-female`, se desejado), preparado conforme o README §2 (mesh/skin + armature principal + 3 Actions reais em `bpy.data.actions`). **Não baixar por conta do agente.**
3. Preencher e **aprovar como pessoa** `manifests/source-license-manifest.json` (origem, versão, termos revisados, títulos/nomes reais das Actions, `confirmedByUser`).
4. `.\local-renderer-test\run-render.ps1 -Subject mixamo-male -CheckOnly` — deve deixar de listar bloqueios de manifesto/Blender.
5. `.\local-renderer-test\run-render.ps1 -Subject mixamo-male` — render real.
6. Abrir `output/<run>/spritesheet.png` e inspecionar as **24 células** (corpo inteiro, recorte, pés/pivô, escala, poses, diferença semântica entre idle/walk/run).
7. Repetir a execução e comparar hashes/dimensões/tempos para medir determinismo (§2.5 da tarefa).
8. Registrar o resultado em `docs/T10-E3-RENDERER-VALIDATION.md` como adendo datado, mantendo a separação entre `VERIFIED_IN_FORGE` e `VERIFIED_ON_TARGET_HARDWARE`.
