# Lia Forge — avaliação de lacuna da viewport Three.js

> **Natureza deste documento:** auditoria técnica comparativa. **Nenhuma funcionalidade foi implementada, nenhuma dependência foi adicionada, nenhum contrato foi alterado, nenhuma linha de código de produto foi tocada.**
> **Data efetiva:** 2026-11-14 (UTC).
> **Branch da sessão:** `arena/e209a742-lia-forge`, criada a partir de `main` em `6bd9a5a7006c7c6ccf5edcb5d577283d61a39949`.
> **Escopo:** determinar, por evidência, o que da viewport Three.js existe hoje, o que a pesquisa `docs/threejs-3d-environment/` propõe, e qual é a próxima fatia correta.

## 0. Aviso de leitura — dois problemas de premissa que mudam tudo

Antes de qualquer conclusão técnica, dois achados de processo. Eles não são detalhe burocrático: **eles invalidam a leitura ingênua da tarefa e mudam a próxima fatia recomendada**.

### 0.1 O código não está nesta branch

A branch desta sessão, `arena/e209a742-lia-forge` (base `6bd9a5a`), contém **42 arquivos rastreados, nenhum de código**:

```
AGENTS.md · README.md · docs/**.md · docs/auditoria-blender-local/*.json
```

Não há `package.json`, `src/`, `shared/`, `electron/`, `tests/`, `vite.config.js` nem `index.html`. Toda referência da pesquisa a `shared/model3d/glb.mjs`, `src/App.jsx`, `electron/main.cjs` e afins aponta para arquivos **ausentes neste checkout**.

O código existe, mas em outra branch remota:

| Item | Evidência |
|---|---|
| `origin/main` | `6bd9a5a` — idêntico à base desta branch, também só documentação |
| `origin/arena/649f88bd-3dspritesheet` | `5b0ec51` — 206 arquivos, incluindo todo o app Electron/React |
| Relação entre as duas | **`git merge-base` retorna vazio: não há ancestral comum.** São duas raízes independentes |

**Consequência:** o repositório tem **duas linhagens não relacionadas**. `main` não é ancestral da branch de código, e vice-versa. Isso explica o `git diff --stat` absurdo de "244 arquivos alterados, 52.092 inserções, 80.325 exclusões" entre elas. Não é divergência de trabalho: são árvores diferentes.

Isto **não** é uma conclusão minha sobre qual linhagem "vence" — é uma decisão humana pendente (§8, D-02). Mas afeta a auditoria: **um agente ou humano que rode `git checkout main` e procure a viewport não encontra nem o app.** Qualquer instrução futura de "inspecione o código" precisa dizer *qual* branch.

### 0.2 Seis dos sete documentos obrigatórios não existem nesta branch

A tarefa pede a leitura de sete documentos. Situação real, verificada por `test -f`:

| Documento pedido | Nesta branch (`e209a742`) | Na branch de código (`649f88bd`) |
|---|---|---|
| `docs/threejs-3d-environment/` (18 arquivos) | ✅ existe (4.395 linhas) | ❌ ausente |
| `docs/IMPLEMENTATION-AUDIT.md` | ❌ ausente | ✅ 133 linhas |
| `docs/DECISIONS-AND-OPEN-QUESTIONS.md` | ❌ ausente | ✅ 101 linhas |
| `docs/PRODUCT-ARCHITECTURE.md` | ❌ ausente | ✅ 187 linhas |
| `docs/ASSET-PIPELINES.md` | ❌ ausente | ✅ 178 linhas |
| `docs/WORKFLOW-ENGINE.md` | ❌ ausente | ✅ 122 linhas |
| `docs/DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md` | ❌ ausente | ✅ 1.934 linhas |

Cada frente entregou seu trabalho na sua própria branch, e **nada foi consolidado**. A pesquisa Three.js e o código nunca coexistiram numa árvore.

**Como esta auditoria resolveu isso:** leitura dos 18 documentos da pesquisa nesta branch; extração **somente leitura** da branch de código para diretório temporário (`git archive 5b0ec51 | tar -x -C /tmp/lia`); leitura dos seis documentos e inspeção do código lá. `FETCH_HEAD` foi usado para não criar referência local a branch alheia. **Nenhum commit, push ou alteração foi feito fora desta branch.**

**Rótulo desta superação:** `EXECUTADO` (o procedimento rodou e produziu os números abaixo), e explicitamente **não** `VALIDATED` para o produto — inspecionar uma branch não valida o app.

### 0.3 O que isso significa para a pergunta original

A pergunta "o que da viewport Three.js já está implementado" tem **duas respostas corretas e distintas**, e confundi-las é o erro central que este documento evita:

- **No produto existente** (linhagem `649f88bd`): nada. Zero. Ver §1.
- **No checkout desta sessão** (`e209a742`): também nada — porque não há produto aqui.

E a pesquisa, apesar de tecnicamente rigorosa, foi escrita contra uma base que não existe no repositório (§7.6).

---

## 1. Estado real do código

### 1.1 Método

Toda afirmação abaixo tem comando e saída. Rótulos: `IMPLEMENTED` = código executável existe; `EXECUTED` = o comando rodou nesta sessão com o resultado citado; `VALIDATED` = há evidência no ambiente-alvo (Windows/GPU real), **que não foi produzida aqui**; `PROPOSED`/`PLANNED` = intenção, não código.

### 1.2 Auditoria dos achados da pesquisa — dois defeitos reais, um erro meu

Antes do inventário, três afirmações da pesquisa que **não sobrevivem à verificação**. Corrigi-las é pré-requisito para planejar.

**B-01 — [RETIRADO] A suposta contagem errada da matriz era um erro meu, não do documento.**

Este achado foi levantado e **refutado dentro desta mesma auditoria**. Registro o episódio porque ele é metodologicamente mais útil do que o achado teria sido.

*Primeira passada.* Contei as classificações com
`awk -F'|' '{print $3}'` sobre as linhas `| A1 | Nome | \`CLASSIFICAÇÃO\` | …`.
O resultado deu `NATIVO THREE.JS = 12` contra os 23 do documento, e `JÁ IMPLEMENTADO = 1` contra 2. Concluí que `08-MATRIZ…` §I tinha somado a coluna errada.

*Por que estava errado.* Nas linhas da matriz o identificador (`A1`) ocupa o **segundo** campo do `awk` (o primeiro é a string vazia antes do `|` inicial). O `$3` que li era o **nome da funcionalidade**, não a classificação — e nomes diferentes foram contados como classes distintas. Alguém que olhasse só esse agregado veria "Navegação orbital: 1", "Seleção por clique: 1"… e a soma por prefixo produzia números plausíveis por coincidência, o que tornava o erro difícil de notar.

*Recontagem correta,* por normalização da coluna de classificação (Node, remoção de backticks e de parênteses de apoio):

```
rows: 76
NATIVO THREE.JS           23
DESENVOLVIMENTO LIA       33
JÁ IMPLEMENTADO            2
BIBLIOTECA COMPLEMENTAR    1
BLENDER                    7
RESEARCH ONLY              8
ADAPTER EXTERNO            2
sum: 76
```

**Os números do documento estão corretos.** A tabela de §I de `08-MATRIZ…` confere exatamente. Nada precisa de errata.

**O que isso ensina — e por que fica registrado:** este é precisamente o modo de falha que a pesquisa quase cometeu e que eu cometi de fato: *agregar por posição de campo numa tabela cujo formato varia, e aceitar um total que fecha sem verificar a atribuição*. O total somava 76 nos dois métodos; só a distribuição diferia. Um número que "fecha" não é evidência de que foi medido corretamente.

**Consequência para esta auditoria:** nenhuma conclusão de priorização depende deste item. A separação entre `NATIVO THREE.JS` e `DESENVOLVIMENTO LIA` continua sendo o eixo editorial da matriz, e ela está publicada corretamente. A tese de §9.2 — de que o custo real está no bloco de produto, não na biblioteca — **não** se apoia nesta contagem e permanece válida pelos motivos independentes de §1.5 e §2.2.

**Lição aplicada:** as demais contagens deste documento (§1.4, §1.5, §2.7, §7.2) foram obtidas por contagem direta de ocorrências ou por execução de código, não por posição de coluna em tabela Markdown.

**B-02 — As decisões 45–62 nunca foram registradas no arquivo canônico.**
`12-RISCOS-DEPENDENCIAS-DECISOES.md` e `01` afirmam que esta frente "acrescentou as questões 45–57" a `DECISIONS-AND-OPEN-QUESTIONS.md`, e a frente de skills as 58–62. Verificação no arquivo real (branch de código):

```
grep -E "^4[5-9]\.|^5[0-9]\.|^6[0-2]\." docs/DECISIONS-AND-OPEN-QUESTIONS.md   → nenhum resultado
maior questão numerada no arquivo                                                  → 44
questões 1..44 presentes                                                           → todas
```

As 18 decisões existem **apenas** dentro de `12-...DECISOES.md` §3 e `17-ROADMAP-INTEGRACAO-SKILLS.md` §9. O arquivo que o produto trata como fonte de verdade das decisões humanas **não as contém**. O corpus se declara bloqueado por decisões 45–57 que, para qualquer leitor do arquivo canônico, não existem.

**Por que importa:** o gate da Fase 1 ("decisões 45–57 respondidas") é hoje **inatingível por construção** — não há onde registrá-las. Qualquer tentativa de aprovar a Fase 1 travaria num artefato que não existe.

**B-03 — A matriz não é internamente consistente na coluna de fase.**
Exemplos na mesma tabela: `A10 Telemetria de frame` → Fase **1**; mas `2.16 Telemetria GPU/frame` em `02-INVENTARIO` também Fase 1; já `A11 Detecção de GPU` Fase 1 e `F1-10` em `14-CRITERIOS` exige HUD com backend/driver como **obrigatório** na Fase 1 — enquanto `09-HARDWARE` §7.1 trata o HUD como *opt-in* e `13` P1-7 diz "visível, opt-in". Três documentos, três regras para o mesmo critério.

**Tratamento:** onde há divergência, este documento adota o critério **mais restritivo** (regra que o próprio `14-CRITERIOS` §1 estabelece). Onde a divergência é estrutural, ela vira decisão pendente (§8).

### 1.3 Inventário do que existe — `IMPLEMENTED`

Verificado por leitura direta na branch de código.

| Capacidade | Estado | Evidência (arquivo:linha) | O que **não** faz |
|---|---|---|---|
| Inspeção de container GLB | `IMPLEMENTED` | `shared/model3d/glb.mjs:17` `inspectGlb()` | Não desenha. Não devolve hierarquia, transforms nem bounds |
| Contagens de mesh/triângulo/vértice | `IMPLEMENTED` | `glb.mjs:52-86` | — |
| Flags por primitiva (`hasNormals`, `hasUvs`, `hasJoints`, `hasWeights`) | `IMPLEMENTED` | `glb.mjs:70-78` | Flags, não diagnóstico |
| Metadados de material | `IMPLEMENTED` | `glb.mjs:100-107` | Sem valores PBR (`metallic`, `roughness`), sem textura |
| Metadados de imagem/animação/skin | `IMPLEMENTED` | `glb.mjs:88-118` | Sem duração verificável, sem alvo real |
| Extensões declaradas | `IMPLEMENTED` | `glb.mjs:120` | Não valida conformidade |
| Validador `glb-structural` | `IMPLEMENTED` | `shared/qa/validators.mjs:94-122` | Estrutura, não semântica |
| Adapter `glb-inspect` | `IMPLEMENTED` | `shared/adapters/software.mjs:630-690` | Emite `model-report.json`; teto 256 MB |
| Upload de entrada | `IMPLEMENTED` | `studio-service.mjs:45` `MAX_INPUT_BYTES = 32 MB` | Copia para `input/` |
| Leitura de prévia/artefato | `IMPLEMENTED` | `studio-service.mjs:76` = 6 MB; `main.cjs` artefato = 6 MB | Base64 → duas cópias |
| Versionamento de asset | `IMPLEMENTED` | `shared/assets/manager.mjs` | — |
| Direitos/proveniência | `IMPLEMENTED` | `manager.mjs:68` `classifyRights` | — |
| Exportação por destino | `IMPLEMENTED` | `shared/destinations/profiles.mjs` | Perfis `verified: false` exceto `lia-desktop` |
| Render 3D→2D via Blender | `IMPLEMENTED` | `electron/blender-adapter.cjs`, `scripts/blender_spritesheet.py` | Subprocesso; não é sessão Blender |
| Scheduler DAG / engine de workflow | `IMPLEMENTED` | `shared/engine/dag.mjs`, `execution-manager.mjs` | — |
| Transporte duplo IPC/HTTP | `IMPLEMENTED` | `electron/preload.cjs` (30 métodos Studio), `vite.config.js:216+` | — |
| Guardas de segurança de janela | `IMPLEMENTED` | `main.cjs:878-881` (`contextIsolation`, `nodeIntegration:false`, `sandbox:true`, `webSecurity:true`) | — |
| Same-origin proxy-aware | `IMPLEMENTED` | `vite.config.js:234-245` `isSameOriginRequest` (lê `x-forwarded-host`) | — |
| Confinamento de caminho | `IMPLEMENTED` | `main.cjs:202` `inside()`; recusa symlink por `lstat` | — |
| UI que declara não renderizar | `IMPLEMENTED` | `src/App.jsx:1399` `ILLUSTRATION · NOT A MODEL VIEWER` | É ilustração em CSS |

### 1.4 O que **não** existe — verificado por busca negativa

Comandos rodados sobre `src/ shared/ electron/ scripts/ workflows/ vite.config.js index.html` da branch de código:

| Símbolo/procura | Resultado | Interpretação |
|---|---|---|
| `three`, `webgl`, `webgpu`, `GLTFLoader`, `OrbitControls`, `AnimationMixer` (excluindo falsos positivos `three-quarter`/`three-view`) | **0 ocorrências** | Não há Three.js nem WebGL no produto |
| `three` em `dependencies`/`devDependencies` | **ausente** | Dependências são: `@modelcontextprotocol/sdk`, `lucide-react`, `react`, `react-dom`, `zod` |
| `view3d` em qualquer `.mjs/.cjs/.jsx` | **0 arquivos** | Nenhum módulo, canal ou rota de viewport |
| `Content-Security-Policy` (índice + todos os `electron/*.cjs` + `vite.config.js`) | **0** | Sem CSP, nem meta nem header |
| `protocol.handle` / `registerSchemesAsPrivileged` | **0** | Sem protocolo de asset |
| `webglcontextlost` (main, `src/*.jsx`, todos os testes) | **0** | Sem recuperação de contexto GPU |
| `getAppMetrics` (todos os `electron/*.cjs`) | **0** | Sem telemetria de processo sombreada |
| `model/gltf` em `main.cjs` / `studio-service.mjs` | **0** / **0** | Content-type de modelo existe só no mapa de artefatos do Vite (`vite.config.js:228-229`) |

### 1.5 O buraco central: `inspectGlb` não alimenta nada visual — e nem relatório de hierarquia

Execução real nesta sessão, sobre a fixture do próprio repositório:

```
$ node -e "...inspectGlb(buildGlbFixture())..."
KEYS: version, byteLength, chunks, generator, assetVersion, copyright,
      extensionsUsed, extensionsRequired, scenes, nodes, meshes, meshCount,
      vertexCount, triangleCount, materials, textures, images, animations,
      animationCount, animationNames, skins, skinned, buffers,
      bufferViewCount, binChunkBytes, accessorComponentTypes
nodes field value: 1  (número = contagem)
has hierarchy? false | has bounds? false | has real node transforms? false
```

`nodes` é **um inteiro**. A fixture tem `nodes: [{name:"cube", mesh:0}]` e `scenes:[{nodes:[0]}]` — ou seja, o JSON do GLB **já contém** nome de nó, filiação e a árvore de cena; `inspectGlb` simplesmente não os lê.

**Achado que a pesquisa não registra:** a ausência de hierarquia **não é** uma limitação de "precisa de WebGL". `nodes`, `node.children`, `node.matrix`/`translation`/`rotation`/`scale`, `scene.nodes` e `accessor.min/max` (que a fixture comprova existir: `{"min":[-1,-1,-1],"max":[1,1,1]}`) estão **todos no chunk JSON**. Um `SceneIndex` de hierarquia, transforms e bounds declarados é **aritmética pura sobre bytes já lidos**, sem renderer, sem WebGL, sem GPU e sem dependência nova.

Isso tem consequência direta na recomendação (§9): existe uma fatia de valor real que a pesquisa classificou como "Fase 1 junto com o canvas" e que na verdade **pode vir antes do canvas e ser 100% testável em Node**.

---

## 2. Matriz de capacidades e lacunas

Comparação entre o que a pesquisa propõe e o que o código entrega. `Fase proposta` = conforme `11-PLANO-POR-FASES.md`. `Bloqueio real` = o que impede hoje, por evidência.

### 2.1 Renderização e câmera (Fase 1 proposta)

| # | Capacidade | Pesquisa propõe | Código hoje | Lacuna | Bloqueio real |
|---|---|---|---|---|---|
| R1 | Viewport 3D | Fase 1 | ❌ ausente (ilustração CSS) | Total | `three` não instalado |
| R2 | Órbita/zoom/pan (`OrbitControls`) | Fase 1 | ❌ | Total | idem |
| R3 | Perspectiva ↔ ortográfica | Fase 1 | ❌ | Total | idem |
| R4 | Grade e eixos | Fase 1 | ❌ no viewport (grade é CSS) | Total | idem |
| R5 | Wireframe | Fase 1 | ❌ | Total | idem |
| R6 | Enquadramento automático | Fase 1 | ❌ | Total | precisa de bounds (§2.2) |
| R7 | Render sob demanda | Fase 1 | ❌ | Total | — |
| R8 | Recuperação de contexto perdido | Fase 1 | ❌ | Total | — |
| R9 | Telemetria (`renderer.info`) | Fase 1 | ❌ | Total | precisa de renderer |
| R10 | Detecção de GPU/software | Fase 1 | ❌ | Total | — |
| R11 | WebGL2 como piso | Fase 1 | ❌ | Total | — |
| R12 | WebGPU opcional com fallback | pós-Fase 1 | ❌ | Total | **não medido na RX 580** |

### 2.2 Estrutura, hierarquia e medição — a lacuna que o corpus subestima

| # | Capacidade | Pesquisa propõe | Código hoje | Observação |
|---|---|---|---|---|
| S1 | Árvore de nós (nome, filiação, pai) | Fase 2 | ❌ | **Dado já presente no JSON do GLB** |
| S2 | Transforms por nó (matrix ou TRS) | Fase 2 | ❌ | **Já presente no JSON** |
| S3 | Bounds declarados (`accessor.min/max`) | Fase 1 | ❌ | **Já presente no JSON** — a fixture prova |
| S4 | Bounds computados (`Box3.setFromObject`) | Fase 1 | ❌ | Exige cena carregada |
| S5 | Escala/unidade com expectativa de destino | Fase 1 | ❌ | glTF não declara unidade |
| S6 | IDs estáveis gerados pela Lia | Fase 2 | ❌ | Necessário antes de seleção |
| S7 | Seleção por clique (`Raycaster`) | Fase 2 | ❌ | — |
| S8 | Hierarquia navegável na UI | Fase 2 | ❌ | — |

**Divergência com a pesquisa:** `02-INVENTARIO` marca 1.9 (hierarquia) e 1.10 (bounds) como "ausente — `DESENVOLVIMENTO LIA` sobre `NATIVO THREE.JS`". Correto para *bounds computados*; **incorreto para hierarquia e bounds declarados**, que não precisam de Three.js. S1–S3 são `DESENVOLVIMENTO LIA` sobre **bytes**, não sobre o renderer.

### 2.3 Materiais e texturas (Fase 3 proposta)

| # | Capacidade | Código hoje | Lacuna |
|---|---|---|---|
| M1 | Valores PBR declarados (`baseColorFactor`, `metallicFactor`, `roughnessFactor`, `emissiveFactor`) | ❌ `glb.mjs` não lê | **Presente no JSON do GLB** |
| M2 | Inventário de canais de textura por material | ⚠️ parcial (`baseColorTexture`, `normalTexture` só) | Faltam `metallicRoughness`, `occlusion`, `emissive` |
| M3 | Resolução de imagem | ❌ | Presente no binário (PNG/JPEG header) — decodificável sem GPU |
| M4 | VRAM estimada (aritmética) | ❌ | Puro cálculo |
| M5 | Prévia visual de textura | ❌ | Precisa decodificar imagem |
| M6 | PBR efetivo no material Three.js | ❌ | Precisa de renderer |
| M7 | Ambiente neutro / PMREM | ❌ | Precisa de renderer |
| M8 | Pipeline de cor declarado | ❌ | Precisa de renderer |
| M9 | KTX2 / Draco / Meshopt | ❌ | Exige decoders + CSP |

### 2.4 Personagens, esqueleto e animação (Fase 4 proposta)

| # | Capacidade | Código hoje | Lacuna |
|---|---|---|---|
| A1 | Contagem de juntas por skin | ✅ `glb.mjs:132-138` | — |
| A2 | Nome do nó raiz do skin | ⚠️ índice só | Sem nome |
| A3 | Hierarquia de bones | ❌ | **Presente em `nodes`** |
| A4 | Duração de clipe | ⚠️ de `accessor.max` (frágil, ver §2.5) | Sem verificação |
| A5 | Alvos de canal por nome de nó | ❌ só `target.path` | `target.node` é índice — resolvível |
| A6 | Reprodução (`AnimationMixer`) | ❌ | Precisa de renderer |
| A7 | Timeline/scrub | ❌ | idem |
| A8 | `SkeletonHelper` | ❌ | idem |
| A9 | Debug de pesos de skin | ❌ | Shader próprio |

### 2.5 Qualidade dos dados existentes — três fragilidades que a pesquisa não registra

**F-01 — `durationSeconds` pode ser nula ou errada.** `glb.mjs:88-98` calcula a duração do clipe lendo `accessors[sampler.input].max`. Isso depende de o exportador preencher `max` no accessor de tempo. glTF **não exige** `min`/`max` em accessors de animação (são obrigatórios apenas para `POSITION`). Um GLB sem `max` no input sampler produz `durationSeconds: null` silenciosamente — e a Fase 4 promete "duração correta dentro de um frame". **A duração real exige ler os bytes do accessor**, não confiar no metadado.

**F-02 — `triangleCount` assume `mode: 4` sem verificar.** `glb.mjs:60-62` faz `Math.floor(count/3)` para qualquer primitiva, inclusive `mode: 1` (LINES), `mode: 5` (TRIANGLE_STRIP) ou `mode: 6` (TRIANGLE_FAN). Para strip/fan a contagem de triângulos é `n-2`, não `n/3`. `mode` é lido e reportado (`glb.mjs:57`), mas **não é usado no cálculo**. O orçamento de triângulos do §3 do `09-HARDWARE` pode ser sistematicamente errado para modelos não-indexados em strip.

**F-03 — `materials` não expõe valor nenhum de PBR.** `glb.mjs:100-107` devolve `hasPbr: boolean` e dois índices de textura. Não há `baseColorFactor`, `metallicFactor`, `roughnessFactor`, `emissiveFactor` nem `alphaCutoff`. "Inspeção PBR" (Fase 3, `C1`) não pode ser construída sobre este relatório sem estendê-lo — e a extensão é **leitura de JSON que já está em memória**.

### 2.6 Integração e segurança

| # | Capacidade | Código | Lacuna | Impacto na viewport |
|---|---|---|---|---|
| I1 | CSP | ❌ | **Nenhuma** | Decoders wasm/worker ficam sem barreira |
| I2 | Protocolo de asset com Range | ❌ | Nenhum | GLB grande só via IPC/base64 |
| I3 | Streaming de bytes | ❌ | `readInput` 6 MB, upload 32 MB | Modelo > 6 MB não chega ao renderer pelo caminho atual |
| I4 | Telemetria de processo | ❌ | `getAppMetrics` ausente | "não vaza memória" vira opinião |
| I5 | Capability de preview | ❌ | 49 capacidades, nenhuma de preview | Hub/preflight não expressam "posso ver isto?" |
| I6 | Contrato de sessão | ❌ | Nenhum | Sem onde guardar câmera/seleção |
| I7 | Teste em Chromium real | ❌ | 0 dependências de navegador | Canvas não é testado por nada |
| I8 | Same-origin proxy-aware | ✅ | — | **Reutilizável** para rota de bytes |
| I9 | Confinamento + symlink | ✅ | — | **Reutilizável** |
| I10 | Transporte IPC/HTTP duplo | ✅ | — | **Reutilizável** |

### 2.7 Resumo quantificado

| Dimensão | Valor | Fonte |
|---|---|---|
| Arquivos rastreados nesta branch | 42 | `git ls-tree` |
| Arquivos rastreados na branch de código | 206 | `git ls-tree 5b0ec51` |
| Arquivos de código nesta branch | **0** | busca por extensão |
| Ocorrências de Three.js/WebGL no produto | **0** | grep `EXECUTADO` |
| Capacidades registradas | 49 | `BASE_CAPABILITIES.length` |
| Capacidades de preview/render de modelo | **0** | inspeção do registry |
| Canais IPC | 49 | `ipcMain.handle` |
| Canais de viewport | **0** | grep |
| Smokes na cadeia `npm test` | 33 | `package.json` |
| Smokes que tocam canvas/WebGL | **0** | grep |
| Dependências de teste de navegador | **0** | `package.json` |
| Linhas de pesquisa Three.js | 4.395 | `wc -l` |
| Funcionalidades na matriz | 76 (contagem correta) | `awk` |

---

## 3. Arquitetura recomendada

> **Rótulo:** `PROPOSED`. Nada aqui foi implementado. Divergências em relação a `05-ARQUITETURA-PROPOSTA.md` estão marcadas com **[Δ]** e justificadas.

### 3.1 Princípios que herdo sem alteração

1. **Lia Forge é o produto; a viewport é uma view.** Three.js desenha; não define contrato, permissão, versionamento ou UX.
2. **Blender é o DCC.** Malha, UV, rig, animação autoral, bake e render final continuam lá, em qualquer fase.
3. **GLB/glTF é container de intercâmbio, não contrato semântico.**
4. **Original é intocável.** Nenhuma escrita no `.glb` de origem, jamais.
5. **Nenhum renderer padrão.** A comparação Blender × WebGL continua aberta (ADR-001, Decisão 5).

### 3.2 [Δ] Camada 0 — o que deve existir **antes** do canvas

**Esta é a divergência mais importante com a pesquisa.** O plano proposto coloca canvas e inspeção estrutural juntos na Fase 1. A evidência de §1.5 e §2.5 mostra que **uma camada inteira de valor não precisa de renderer** e é o insumo de que tudo o mais depende:

```
┌─────────────────────────────────────────────────────────────────────┐
│ CAMADA 0 — SceneIndex declarado (puro, Node, zero GPU)              │
│                                                                     │
│  bytes GLB ──► leitura do chunk JSON ──► {                         │
│                                            nodes:     árvore + TRS │
│                                            meshes:    primitivas    │
│                                            materials: PBR completo  │
│                                            skins:     juntas + raiz │
│                                            animations: canais+alvo  │
│                                            bounds:    min/max       │
│                                            ids:       estáveis      │
│                                          }                          │
│  Puro. Testável em Node. Sem three, sem WebGL, sem CSP, sem worker. │
└─────────────────────────────────────────────────────────────────────┘
                              │
        consome para tudo o que vem depois (e antes do canvas)
                              ▼
```

**O que a Camada 0 entrega sozinha, sem nenhum pixel:** árvore de nós navegável, nomes, transforms, bounds declarados em unidades do arquivo, escala suspeita, material PBR declarado, inventário de canais de textura, hierarquia de bones, canais de animação com alvo resolvido por nome, e — crucialmente — **a base de IDs estáveis** que a Fase 2 exige.

**O que ela não entrega:** a imagem. Isso continua exigindo renderer.

**Por que isso é melhor do que o plano proposto:**
- É a **única** parte do escopo que pode ser `VALIDATED` sem Windows, sem GPU e sem `chrome://gpu`.
- Elimina o bloqueio de CSP: não há wasm nem worker.
- Atrasa a dependência `three` — o maior risco de licença, bundle e atualização (§8) — até que o resto esteja provado.
- Entrega diagnóstico de valor real (F-01, F-02, F-03 corrigidos, UV ausente, skin sem uso) **antes** de existir canvas, o que é exatamente o "diagnóstico honesto" prometido para a Fase 1.
- Não cria contrato novo: é uma extensão de leitura do `model3d.inspect` **já implementado**, com o adapter `glb-inspect` já existente.

### 3.3 Camada 1 — transporte e sessão

```
Renderer (sandbox)                          Main (Node)
┌──────────────────┐                       ┌───────────────────────────┐
│ Lia3DView        │  lia-forge:view3d:*   │ View3DService             │
│  ├ runtime       │◄─────────────────────►│  resolve → token          │
│  ├ SceneIndex    │                       │  hash SHA-256 (stream)    │
│  ├ camera        │  bytes                │  limites (256 MB)         │
│  ├ selection     │◄─────────────────────►│  lstat / symlink          │
│  └ telemetry     │                       │  sessão + TTL             │
└──────────────────┘                       └───────────────────────────┘
```

**Reaproveitamento direto verificado** (não é proposta abstrata — o padrão já existe):

| Necessidade | Ativo existente | Reuso |
|---|---|---|
| Same-origin no preview | `vite.config.js:234-245` `isSameOriginRequest`, proxy-aware via `x-forwarded-host` | Copiar o padrão para a rota de bytes |
| Confinamento | `main.cjs:202` `inside()` | Idêntico |
| Recusa de symlink | `main.cjs` `lstat().isSymbolicLink()` | Idêntico |
| Erro nomeado com próximo passo | padrão dos adapters (`WORKFLOW_BLOCKED`) | Idêntico |
| Transporte duplo | `preload.cjs` + HTTP | Adicionar namespace `view3d` |
| Guard de IPC | `ipc-guard.cjs` `assertTrustedIpcSender` | Obrigatório em cada canal |

**[Δ] Divergência de transporte.** A pesquisa recomenda protocolo `lia3d://` como caminho primário. Mantenho a recomendação, com uma ressalva que a pesquisa não levanta: **um protocolo customizado é um canal novo cuja validação de `initiatorOrigin` não existe em nenhum lugar do código hoje**. É superfície nova, não reuso. Proposta revisada:

- **Fatia curta:** rota HTTP same-origin (`/api/lia-forge/studio/view3d/file`) — reusa `isSameOriginRequest`, funciona no preview e no Electron via o mesmo serviço, e é a única que hoje tem precedente testado no repositório.
- **Protocolo `lia3d://`:** adiado até haver teste de origem em Chromium real. Sem esse teste, é complexidade não verificável.

### 3.4 Camada 2 — runtime de renderização

```
interface ViewportRenderer {          // PROPOSTO, não implementado
  init(canvas): Promise<void>
  render(scene, camera): void
  setAnimationLoop(fn | null): void
  info(): RendererStats               // campos ausentes = 'unknown', nunca 0
  dispose(): Promise<void> | void     // WebGPU: assíncrono
  readonly backend: 'webgl2' | 'webgpu' | 'unknown'
  readonly isSoftware: boolean
}
```

`WebGLRenderer` é a única implementação na primeira fatia. WebGPU fica atrás de flag, e §6.3 explica por que a decisão pode esperar.

---

## 4. Ciclo de vida e gestão de memória

### 4.1 Máquina de estados

```
idle ──open(ref)──► resolving ──ok──► loading ──ok──► ready ⇄ animating
  ▲                     │                │              │
  │                     │ erro           │ erro         │ close/crash
  └────── error ◄───────┴────────────────┘              ▼
                                                     disposing ──► idle
```

| Estado | Garantia | Evidência necessária (não produzida) |
|---|---|---|
| `resolving` | Confinamento, hash, recusa de symlink, limite antes do parse | Teste negativo por canal |
| `loading` | Cancelamento real; descarte do parcial em erro | Teste de abort no meio |
| `ready` | Render sob demanda; zero frames ociosos | Contador de frames |
| `animating` | Mixer isolado; pausa ao sair | Teste de ação órfã |
| `error` | Nenhum objeto órfão | `renderer.info` após erro |
| `disposing` | `dispose()` de tudo; `forceContextLoss()`; canvas removido | 10 ciclos |

**Regra de concorrência:** uma sessão ativa por vez. Duas sessões exigiriam orçamento de VRAM que não existe em 8 GB compartilhados.

### 4.2 O que precisa de `dispose` — inventário auditado no pacote real

Verificado em `three@0.187.0` (tarball baixado e inspecionado nesta sessão):

| Recurso | API verificada | Arquivo |
|---|---|---|
| Renderer WebGL | `renderer.dispose()`, `renderer.forceContextLoss()` | `src/renderers/WebGLRenderer.js:1088`, `:609` |
| Renderer WebGPU | `async dispose()` — **assíncrono** | `src/renderers/common/Renderer.js:3019` |
| Geometria/material/textura | `.dispose()` | padrão Three.js |
| `AnimationMixer` | `stopAllAction()`, `uncacheRoot()`, `uncacheClip()` | `src/animation/AnimationMixer.js` |
| Helpers | `SkeletonHelper.dispose()`, `ViewHelper.dispose()` | addons |

### 4.3 Invariante de memória — o que é medível e o que não é

| Camada | Limite proposto | Rótulo | Como medir |
|---|---|---|---|
| Arquivo em disco | sem cópia; aberto no lugar | `PROPOSED` | inspeção de disco |
| Cache de bytes | ≤ 64 MB, LRU por hash | `PROPOSED` | contador próprio |
| Buffer no renderer | 1 modelo, sem cópia extra | `PROPOSED` | 2 leituras de arquivo |
| GPU | 512 MB confortável / 1 GB alerta / 1,2 GB recusa | **`HIPÓTESE` — não medida** | `renderer.info.memory` |
| Overrides JSON | ≤ 256 KB | `PROPOSED` | tamanho do arquivo |

**Campos de telemetria — diferença verificada entre backends:**

| Backend | Campo | Arquivo | Rótulo |
|---|---|---|---|
| WebGL | `info.memory.geometries`, `info.memory.textures` (contadores) | `src/renderers/webgl/WebGLInfo.js:6-7` | `EXECUTADO` (lido) |
| WebGL | `info.render.calls`, `info.render.triangles` | idem | `EXECUTADO` (lido) |
| WebGPU | `info.render.drawCalls` | `src/renderers/common/Info.js:70` | `EXECUTADO` (lido) |
| WebGPU | `info.memory.texturesSize` **em bytes** | `src/renderers/common/Info.js:133` | `EXECUTADO` (lido) |

**O HUD deve tratar campo ausente como `unknown`, nunca como `0`.** Zero é uma medição; ausência é ausência — e a política do preflight já usa `unknown` como estado válido (`shared/qa/preflight.mjs:24`). A viewport deve seguir a mesma regra.

### 4.4 Aritmética de VRAM — declaro como aritmética, não medição

| Textura | Base RGBA8 | Com mipmaps (~+33%) | 6 texturas iguais |
|---|---|---|---|
| 1024² | 4,19 MB | 5,59 MB | 33,5 MB |
| 2048² | 16,78 MB | 22,37 MB | 134,2 MB |
| 4096² | 67,11 MB | 89,48 MB | **536,9 MB** |

Um único GLB com seis texturas 4K consome ~537 MB de VRAM **sem geometria**. Este é o argumento mais forte para o aviso antes de abrir — e continua sendo **aritmética**, sujeita a arredondamento do driver, compressão e paginação. Não é medição e não deve ser citada como tal.

### 4.5 Regra de teste de vazamento

O critério `F1-4` exige 10 ciclos abrir/fechar sem crescimento. **Isso é testável de forma automatizada** se e somente se existir telemetria — mas o critério "memória do processo não cresce > 5%" exige `app.getAppMetrics()`, que **hoje não existe no código** (`grep` = 0 em todos os `electron/*.cjs`). Ou seja: `F1-4` é hoje **não executável**, não "pendente". Adicionar `app.getAppMetrics` é trabalho pequeno e é pré-requisito do critério, não consequência dele.

---

## 5. Integração GLB/glTF e Blender

### 5.1 Matriz de importação — herdo, com correção de premissa

| Formato | Fase 1 | Caminho | Limite real verificado |
|---|---|---|---|
| `.glb` | ✅ | `GLTFLoader.parse` | Envios pelo seletor limitados a **32 MB** (`MAX_INPUT_BYTES`) |
| `.gltf` autocontido (`data:`) | ✅ | `GLTFLoader.parse` | idem |
| `.gltf` + recursos externos | Não (Fase 5) | protocolo + allowlist | path traversal |
| FBX/OBJ/STL/PLY | Não | Blender → GLB | `MODEL_EXTENSIONS` já os aceita como *entrada* |
| `.blend` | Não | Blender | — |
| `.vrm` | Não | Blender/add-on → GLB | licença própria |
| `.spz`/`.splat` | Não | futuro `splat.ingest` | representação diferente |

**Contradição de produto que precisa ser dita em voz alta.** A pesquisa promete viewport com teto de **256 MB**. O caminho real de entrada é **32 MB** (`studio-service.mjs:45`), e o de leitura de prévia é **6 MB** (`:76`). O adapter `glb-inspect` aceita 256 MB, mas **recebe os bytes por parâmetro de contexto**, não pelo seletor.

Resultado: **um GLB de 100 MB não consegue entrar no produto pelo caminho normal, e portanto não pode ser aberto na viewport.** A pesquisa trata isso como "decisão 57" e recomenda manter 32 MB na Fase 1. Concordo com a decisão, mas a consequência precisa ser explícita na UI: *"este viewport abre arquivos de até 32 MB, porque é o limite de entrada do produto"* — não "até 256 MB". Prometer 256 MB e entregar 32 MB é exatamente o tipo de desonestidade que o `App.jsx:1399` recusa.

### 5.2 O que o loader entrega e o que ele não entrega

Verificado no pacote `three@0.187.0`:

| Fato | Evidência | Consequência |
|---|---|---|
| `texture.flipY = false` em glTF | `GLTFLoader.js:3366` | Não "consertar" para `true` |
| `baseColorTexture` recebe `SRGBColorSpace` | `GLTFLoader.js:849` | Julgar cor sem isso é erro |
| 52 identificadores `KHR_*`/`EXT_*` suportados | contagem no arquivo | Cobertura ampla |
| `KTX2Loader.detectSupport` aceita WebGL e WebGPU | `KTX2Loader.js:239-250` | Remove receio de migração |
| `detectSupportAsync` **deprecado no r181** | `KTX2Loader.js:222-228` | Usar `detectSupport` + `await init()` |
| `hasFeature()` **lança erro** antes de `init()` | `src/renderers/common/Renderer.js:3384-3392` (lido: lança `Error` se `_initialized === false`) | A ordem de inicialização é contrato |
| DRACOLoader cria worker via `Blob` | `DRACOLoader.js:430` | CSP precisa de `worker-src blob:` |
| KTX2Loader cria worker via `Blob` | `KTX2Loader.js:342` | idem |
| `WebGPURenderer` cai para WebGL2 | `src/renderers/webgpu/WebGPURenderer.js:57-69` (`forceWebGL`, `WebGLBackend`) | Fallback é real, não teórico |

**Correção ao corpus:** `01AUDITORIA` §8.1 e `03` §2.2 afirmam que `hasFeature()` "lança erro se chamado antes de `await renderer.init()`". A leitura do código **confirma** — mas o JSDoc imediatamente acima (`:3378-3380`) diz *"If the renderer has not been initialized, this method always returns `false`"*. **O comentário contradiz a implementação.** Confiar no comportamento, não na documentação inline; e registrar isso como armadilha para quem for implementar.

### 5.3 Fronteira com Blender — o desenho recomendado

```
┌────────────────────────┐        ┌─────────────────────────┐        ┌──────────────────┐
│ Lia Forge (governa)    │        │ Viewport Three.js       │        │ Blender (autora) │
│                        │        │ (inspeciona)            │        │                  │
│ projeto, asset, versão │        │                         │        │ malha, UV        │
│ contrato, permissão    │───────►│ ver, orbitar, medir     │        │ rig, pesos       │
│ QA, histórico, UX      │  bytes │ diagnosticar, descartar │        │ animação, NLA    │
│ decisão humana         │◄───────│ (read-only)             │        │ bake, render     │
└────────────────────────┘        └─────────────────────────┘        └──────────────────┘
         │                                                                     ▲
         │  export por destino (exportRun + perfil)                            │
         │  render 3D→2D (blender-adapter, IMPLEMENTED) ───────────────────────┘
         │  "abrir no Blender" (external-tools, IMPLEMENTED)
```

**O adapter Blender já existe e é o caminho de produção hoje.** Verificado:
- `electron/blender-adapter.cjs:17-59` `candidateModelPaths` **prefere** `.blend` > `.fbx` > `.glb/.gltf` e os estágios 3 e 2 — ou seja, o produto já trata o Blender como fonte de verdade da cadeia 3D.
- `scripts/blender_spritesheet.py:60-61` importa `.glb/.gltf` via `bpy.ops.import_scene.gltf`.

**Oportunidade de integração que a pesquisa não explora:** o `blender-adapter` **já lê GLB** e o `glb-inspect` **já escreve `model-report.json`**. Existe um handoff natural — *relatório de inspeção no mesmo diretório do modelo* — que não exige contrato novo e permite que o usuário veja, no Blender, o que a Forge mediu. É `PROPOSED`, de baixo custo, e sem tocar em autoria.

### 5.4 Limites que o viewport nunca deve cruzar

| Nunca | Por quê |
|---|---|
| Escrever no `.glb` de origem | Perda irreversível; viola G1 |
| Editar malha, UV, rig, pesos, keyframes | Escopo de DCC; Three.js não tem modelagem |
| Exportar sobrescrevendo o original | `GLTFExporter` não é round-trip lossless |
| Ser declarado renderer padrão | ADR-001 Decisão 5 |
| Controlar sessão do Blender | Viola "nenhum segundo app" |
| Aprovar asset | Aprovação é humana |

---

## 6. WebGL2 e WebGPU — a decisão que pode esperar

### 6.1 Fatos verificados

| Afirmação | Rótulo | Evidência |
|---|---|---|
| `three@0.187.0` é a versão `latest` | `EXECUTADO` | `registry.npmjs.org`, publicado 2026-10-30 |
| Licença MIT, **zero dependências** | `EXECUTADO` | `dist.dependencies = {}` |
| Exporta `./webgpu` → `build/three.webgpu.js` | `EXECUTADO` | `package.json exports` |
| `WebGPURenderer` cai para WebGL2 (`forceWebGL`, `WebGLBackend`) | `EXECUTADO` (lido) | `WebGPURenderer.js:57-69` |
| `renderer.init()` é assíncrono; `dispose()` é assíncrono | `EXECUTADO` (lido) | `Renderer.js:899`, `:3019` |
| `render()` antes de `init()` **lança erro** | `EXECUTADO` (lido) | `Renderer.js:1823` |
| Addon `WebGL.isWebGL2Available()` existe | `EXECUTADO` (lido) | `examples/jsm/capabilities/WebGL.js` |
| Addon `WebGPU.isAvailable()` existe e faz `requestAdapter()` **no load do módulo** | `EXECUTADO` (lido) | `examples/jsm/capabilities/WebGPU.js:1-7` |

**Achado sobre o addon WebGPU:** `WebGPU.js` executa `await navigator.gpu.requestAdapter()` **no topo do módulo**, em tempo de importação. Isso significa que **importar o addon já dispara uma chamada assíncrona de GPU** — e, num ambiente com CSP ou sem WebGPU, o comportamento depende do runtime. É um detalhe de ordem de importação que precisa de teste, não de suposição.

### 6.2 Tamanho de bundle — medido

| Artefato | Bruto | Gzip |
|---|---|---|
| `build/three.module.js` | 0,63 MB | 0,12 MB |
| `build/three.webgpu.js` | 1,29 MB | 0,25 MB |
| Pacote npm completo (unpacked) | 20,1 MB | — |

**Consequência:** WebGPU **dobra** o payload de runtime (0,25 MB gzip vs 0,12 MB). Num app Electron com bundle local isso é irrelevante em disco, mas é relevante em política: carregar `three/webgpu` na primeira fatia significa pagar o dobro por um backend **não medido neste hardware**.

### 6.3 Recomendação

| Decisão | Recomendação | Justificativa |
|---|---|---|
| Backend da primeira fatia | **WebGL2 (`WebGLRenderer`)** | Ecossistema maduro, `init` síncrono, `info` com contadores, menor payload |
| WebGPU | **Fora da primeira fatia.** Flag posterior | Não há medição na RX 580 · payload dobra · `init` assíncrono muda o ciclo de vida |
| Interface | Isolar atrás de `ViewportRenderer` | Migração futura sem reescrever UI/contratos |
| Materiais customizados | Evitar; se inevitável, TSL | Suportar ambos os backends depois |

**A decisão sobre WebGPU pode esperar por uma razão simples: ela não bloqueia nada.** A primeira fatia recomendada (§9) nem toca em renderer. Postergá-la é gratuito.

### 6.4 O que não pode ser afirmado

| Afirmação | Estado correto |
|---|---|
| "WebGPU funciona na RX 580" | **`unknown`** — nenhum probe executado |
| "WebGPU é mais rápido" | **Não medido**; pode ser mais lento em cenas pequenas |
| "WebGL2 funciona nesta máquina" | **`HIPÓTESE`** — Chromium 156 suporta; driver não verificado |
| "60 fps em 1080p" | **Não medido** — nenhum frame foi renderizado nesta auditoria |
| "Cabe em 512 MB de VRAM" | **Aritmética**, não medição |

---

## 7. Plano de testes e medições no Windows/AMD

### 7.1 O problema de partida: o repositório não testa canvas

Verificado: **0** dependências de navegador (`playwright`, `puppeteer`, `jsdom`, `electron-mocha` ausentes do `package.json`); **0** ocorrências de `getContext` em qualquer teste. A palavra `canvas` aparece em 3 arquivos de teste, mas **nenhuma é um canvas de DOM**: são parâmetros `canvasWidth`/`canvasHeight` (`production-pipeline-smoke.mjs:83`, `rig2d-vfx-smoke.mjs:46`), uma variável local que guarda bytes RGBA (`rig2d-vfx-smoke.mjs:26`) e o nome de um destino (`'web-canvas'`, `run-lifecycle-smoke.mjs:275`). O único teste de UI é `studio-ui-render-smoke.mjs`, que renderiza **SSR** — e o próprio cabeçalho do arquivo declara que rodar sem navegador não é fingir que validou.

**Um viewport validado só por SSR é exatamente a falsa confiança que o `14-CRITERIOS` §11 proíbe.**

### 7.2 Baseline executado nesta sessão

Para que a evidência futura seja comparável, medi o estado atual. Todos os comandos abaixo foram `EXECUTADO` nesta sessão.

| Comando | Resultado | Observação |
|---|---|---|
| `npm test` | **bloqueado no 1º script** | `ERR_MODULE_NOT_FOUND: @modelcontextprotocol/sdk` — `node_modules` ausente. Falha de bootstrap, **não** de código |
| Cada um dos 33 smokes da cadeia, executado individualmente | **30 PASS · 0 FAIL · 3 bloqueados** | Bloqueados: `mcp-smoke`, `studio-ui-render-smoke`, `vite-store-smoke` — todos por `node_modules` ausente |
| `python3 -m unittest discover -s tests` | **30 testes, 29 OK, 1 FAIL** | `test_installed_npm_tree_matches_lockfile` — falha pré-existente e **documentada** em `IMPLEMENTATION-AUDIT.md` como consequência de `node_modules` ausente |

**Nota metodológica — corrigi um número meu aqui também.** A primeira contagem que fiz nesta sessão reportou "33 PASS", porque o classificador tratava `vite-store-smoke.mjs` como aprovado: ele **sai depois** de uma falha interna (o processo Vite não sobe), e o `grep` do meu laço não reconhecia a mensagem `Cannot find module .../node_modules/vite/bin/vite.js` como bloqueio. Recontado com o padrão correto, o resultado é **30 PASS · 3 bloqueados · 0 FAIL** — que coincide exatamente com as 33 entradas da cadeia `npm test`.

Os dois números que eu poderia ter publicado errados — "33 verdes" e "23 vs 12 `NATIVO THREE.JS`" (§B-01) — têm a mesma causa: **classificador que erra em silêncio e devolve um total que fecha**. Nenhum dos dois foi para a conclusão.

Rótulo de todos os itens acima: **`EXECUTADO` no sandbox, não `VALIDATED` na plataforma-alvo.**

### 7.3 Estratégia de teste em quatro camadas

| Camada | Roda em | Prova | **Não** prova |
|---|---|---|---|
| **L1 — puro** (`shared/`) | Node, sem GPU | Parsing, validação, limites, IDs, diagnóstico, estimativas | Nada sobre render |
| **L2 — integração** | Node + HTTP loopback | Rotas, Range, recusas, confinamento, hash | Canvas |
| **L3 — Chromium real** | Electron/Chromium | Canvas existe, contexto vive, dispose roda | Desempenho real |
| **L4 — manual Windows/RX 580** | Máquina do usuário | fps, VRAM, memória de processo, driver | Automação |

**Regra:** L1 e L2 são automatizáveis hoje sem dependência nova. L3 exige decisão humana (§8, D-06). **L4 não pode ser automatizada nem simulada** — e só ela pode cumprir `F1-3` (60 fps).

### 7.4 Fixtures necessárias

A fixture existente `tests/glb-fixtures.mjs` é boa mas insuficiente: **um cubo de 12 triângulos, 1 material, 1 nó, sem skin, sem hierarquia**. Verificado por extração do JSON: `nodes: [{name:"cube", mesh:0}]`, `scenes: [{nodes:[0]}]`.

| Fixture | Propósito | Cobre | Status |
|---|---|---|---|
| **F0** existente | Contrato/parse | 12 tri, 1 nó, 1 anim, 1 textura | ✅ existe |
| **F1** hierarquia | Árvore aninhada, TRS, nomes duplicados e vazios | S1, S2, S6, `F2-2`, `F4-2` | ❌ criar |
| **F2** personagem | Skin + 2 clipes + 4 texturas 1K | Caso de uso principal | ❌ **fornecido pelo usuário**, não baixar |
| **F3** pesado | ≥ 1 M triângulos, 6 texturas 4K | Limite/VRAM/recusa | ❌ gerar por script |
| **F4** extensões | Draco **e** KTX2 | Decoders/CSP | ❌ gerar por script |
| **F5** adversarial | Sem normais, sem UV, escala absurda, `mode: 5` (strip), accessor sem `max`, skin sem uso | Diagnóstico, F-01, F-02 | ❌ criar |
| **F6** não-GLB | GLB truncado, magic errado, JSON inválido, versão 1 | Recusas nomeadas | ⚠️ parcial em `glb-inspect-smoke` |

**Restrição absoluta:** nenhuma fixture de terceiro. Nada baixado. F3/F4/F5 são **geradas por script** — o padrão que `glb-fixtures.mjs` já usa (constrói bytes à mão com `Buffer`, 17 ocorrências).

**Nota:** `glb-fixtures.mjs` usa `Buffer` (Node). Uma fixture usada em teste de renderer no navegador não terá `Buffer`; precisa de variante `Uint8Array`. Detalhe pequeno, mas que quebra na hora errada.

### 7.5 Protocolo de medição no Windows

Para que "funciona" seja um fato e não uma impressão:

**Antes de medir:**
1. Registrar `chrome://gpu` completo (backend, driver, blocklist, WebGL2, WebGPU).
2. Registrar versão do driver AMD e build do Windows.
3. Registrar se Blender/jogo estão abertos (o cenário real de 16 GB).
4. Registrar commit, versão de `three`, tamanho e hash do GLB.

**Durante:**
5. 300 frames em órbita; reportar **média e p95**, não "60 fps".
6. `renderer.info.memory` antes, durante e após 10 ciclos.
7. `app.getAppMetrics()` por processo — **exige implementação, hoje ausente**.
8. `forceContextLoss()` provocado e recuperação cronometrada.
9. Teto de frame: nenhum > 100 ms durante órbita.

**Depois:**
10. SHA-256 do GLB antes/depois — deve ser idêntico.

### 7.6 A base que a pesquisa cita não existe no repositório

O `README.md` da pesquisa declara:

> Branch da sessão: `arena/c61c7ae8-lia-forge` (base `0b4e8671270a14d935e17138cac71366c0fe841f`).

Verificação nesta sessão:

```
$ git cat-file -e 0b4e8671270a14d935e17138cac71366c0fe841f   → ABSENT
$ git cat-file -e c61c7ae8                                     → ABSENT
$ git ls-remote --heads origin                                 → main, arena/649f88bd-3dspritesheet
```

**Nenhum dos dois commits existe no remoto**, e a branch `c61c7ae8` não está publicada. A pesquisa foi escrita sobre um checkout local que nunca foi enviado.

Isso não invalida o conteúdo — as afirmações sobre `three@0.187.0` foram reconfirmadas de forma independente nesta auditoria (§6.1) e resistiram. Mas **invalida a rastreabilidade**: os números de linha citados (`glb.mjs:17`, `App.jsx:1399`, `main.cjs:876-881`) não podem ser verificados por um terceiro contra a base declarada. Eu os verifiquei contra `5b0ec51`, que é a branch de código disponível — e eles conferem lá. A base citada, porém, não confere.

**Consequência prática:** qualquer auditoria futura que tente reproduzir a pesquisa a partir da base declarada vai falhar. A pesquisa precisa registrar a base que existe (`5b0ec51`) ou declarar que a base original não foi preservada.

### 7.7 O que conta como evidência

| Conta | Não conta |
|---|---|
| Execução em Windows, na máquina do usuário, com números e `chrome://gpu` | Build no sandbox |
| 300 frames com média e p95 | Screenshot |
| `renderer.info` antes/depois de 10 ciclos | "Funciona no meu navegador" |
| Hash antes/depois | Teste SSR |
| Chromium headless com SwiftShader **como teste de fumaça** | SwiftShader como prova de desempenho |

---

## 8. Riscos e decisões pendentes

### 8.1 Riscos — herdados, reclassificados e novos

| ID | Risco | Prob. | Impacto | Origem | Observação desta auditoria |
|---|---|---|---|---|---|
| R1 | Vazamento de VRAM/GPU | Alta | Alto | Herdado | `app.getAppMetrics` ausente torna o critério não executável |
| R2 | GLB grande congela a UI | Alta | Alto | Herdado | Parse de 100 MB é síncrono na main thread |
| R4 | CSP quebra decoders | Alta | Médio | Herdado | Sem CSP hoje; adicionar é passo separado |
| R5 | WebGPU não funciona na RX 580 | Média | Médio | Herdado | Irrelevante se WebGPU sair do escopo |
| R19 | Licença de decoder mal registrada | Média | Médio | Herdado | `THIRD_PARTY_NOTICES.md` **não menciona** three/Draco/Basis (§nota) |
| **R22** | **`main` não contém o produto** | **Confirmada** | **Alto** | **Novo** | Duas raízes sem ancestral comum (§0.1) |
| **R23** | **As 18 decisões-gate não existem no arquivo canônico** | **Confirmada** | **Alto** | **Novo** | Fase 1 inatingível por construção (§B-02) |
| **R24** | **Teto prometido (256 MB) ≠ teto real de entrada (32 MB)** | **Confirmada** | **Médio** | **Novo** | UI mentiria (§5.1) |
| **R25** | **Nenhum teste de canvas; viewport "validada" por SSR** | **Alta** | **Alto** | **Novo (agravado)** | 0 dependências de navegador (§7.1) |
| ~~R26~~ | ~~Matriz com contagem errada~~ | — | — | — | **Retirado**: a contagem do documento está correta; o erro era desta auditoria (§B-01) |
| **R27** | **`three` entra em `dependencies` e no bundle base** | Média | Médio | Herdado (R14) | Payload medido: 0,63 MB / 0,12 MB gzip |
| **R28** | **Diagnóstico de triângulos errado em strip/fan** | **Confirmada** | **Médio** | **Novo** | `mode` lido mas não usado (§F-02) |

**Nota sobre R19:** verificado por busca insensível a caixa em `THIRD_PARTY_NOTICES.md` que **não há entrada** para `three`, `draco`, `basis_universal` nem `meshopt`/`meshoptimizer`. As duas ocorrências textuais de "basis" no arquivo são a palavra inglesa em descrições de `asn1js` e `pkijs` — falsos positivos, não `Basis Universal`. Confirma-se, portanto, que o projeto **nunca teve dependência gráfica**. Se `three` entrar, os notices **precisam** ser regenerados (`scripts/generate_third_party_notices.py` existe) e revisados à mão para Draco/Basis/Meshopt. Registrar que esse gerador tem **112 links quebrados** conhecidos (`IMPLEMENTATION-AUDIT.md`, causa raiz na linha 36, não corrigida).

### 8.2 Decisões pendentes

**Herdadas (45–57) — todas ainda abertas, nenhuma decidida:**

| # | Tema | Recomendação técnica não vinculante |
|---|---|---|
| 45 | Capability nova × estender `model3d.inspect` | Nova `model3d.preview`; `inspect` intacto |
| 46 | Política de versão do Three.js | Versão exata + notices |
| 47 | Escopo de edição | Só overrides de apresentação |
| 48 | Integração React | Runtime imperativo (React 18.3.1 confirmado no `package.json`) |
| 49 | Modelo de segurança dos bytes | Token + rota same-origin; `lia3d://` depois |
| 50 | Limites de memória | 1 sessão, DPR ≤ 1.5, sem pós-processamento |
| 51 | Formatos da Fase 1 | `.glb` + `.gltf` autocontido |
| 52 | Persistência | `.lia-forge/view3d/`, fora do store de assets |
| 53 | Captura/exportação | Captura explícita; export derivado só na Fase 5 |
| 54 | Validação glTF | `glb-structural` na Fase 1; `gltf-validator` depois |
| 55 | Evidência de "funciona" | Windows real + RX 580 |
| 56 | Fronteira com render de spritesheet | Viewport é inspetor |
| 57 | Teto de importação | Manter 32 MB **e dizer isso na UI** |

**Novas — levantadas por esta auditoria:**

| # | Decisão | Por que é bloqueante | Opções |
|---|---|---|---|
| **D-01** | Onde a pesquisa Three.js é consolidada? | Vive só nesta branch; o código está em outra | (A) merge nesta branch · (B) portar para `649f88bd` · (C) manter separado |
| **D-02** | Qual linhagem é o produto? | `main` (só docs) × `649f88bd` (só código), sem ancestral comum | (A) `649f88bd` vira base · (B) `main` recebe código · (C) decisão de produto maior |
| **D-03** | Onde as decisões 45–62 são registradas? | O arquivo canônico para em 44 | (A) acrescentar a `DECISIONS-AND-OPEN-QUESTIONS.md` · (B) arquivo próprio |
| **D-04** | A Camada 0 (SceneIndex declarado) vem antes do canvas? | Muda a ordem das fases | (A) sim, como pré-Fase 1 · (B) junto com o canvas |
| **D-05** | Qual teto a UI anuncia? | 32 MB real vs 256 MB prometido | (A) anunciar 32 MB · (B) elevar o teto (decisão 57 = B) |
| **D-06** | Adotar teste em Chromium real? | Sem ele, `F1-*` não é cumprível | (A) Playwright como devDependency · (B) Electron de teste · (C) manual apenas |
| **D-07** | Corrigir os 2 defeitos restantes (B-02, B-03) e a contradição de JSDoc? | Afetam gate e orçamento | (A) errata nos arquivos da pesquisa · (B) nota neste documento apenas |

### 8.3 Riscos que **não** existem — para não gastar esforço

- **"Three.js não renderiza glTF"** — renderiza; 52 extensões verificadas.
- **"Precisa de R3F"** — não precisa; runtime imperativo basta, e R3F exige React 19 contra o 18.3.1 instalado.
- **"WebGPU é obrigatório"** — não é; e está fora da primeira fatia.
- **"Precisa de Draco para abrir modelos"** — só quando o arquivo usa Draco.
- **"Hierarquia exige WebGL"** — **falso**, e é a correção mais útil desta auditoria (§1.5).

---

## 9. Fases priorizadas

### 9.1 Comparação com o plano proposto

| Fase proposta | Escopo | Esforço declarado | Avaliação desta auditoria |
|---|---|---|---|
| 0 | Decisões, contratos, CSP, fixtures | S–M | ✅ Correto, mas **inalcançável** enquanto D-03 não resolver (§B-02) |
| 1 | Viewport, visualização, diagnóstico, telemetria, descarte | M–L | ⚠️ **Mistura duas coisas de risco muito diferente** — ver §9.2 |
| 2 | Seleção, hierarquia, transformações | M–L | ⚠️ Depende de IDs estáveis, que a Camada 0 entrega antes |
| 3 | Materiais e texturas | M | ⚠️ 60% é leitura de JSON, não precisa de renderer |
| 4 | Esqueleto e animação | M–L | ⚠️ `durationSeconds` pode ser nulo (§F-01) |
| 5 | Workflows, Blender, QA | L | ✅ Depende de contratos não aprovados; correto postergar |

### 9.2 A divergência central: separar risco de GPU de risco de produto

A Fase 1 proposta junta, num só bloco de 3–6 semanas:

- **(a)** ler estrutura de modelo e diagnosticar → **risco baixo**, testável em Node;
- **(b)** instalar `three`, criar canvas, gerenciar contexto GPU, dispose, telemetria → **risco alto**, testável só em Windows.

Se (b) falhar — e R25 mostra que não há **nenhum** teste de canvas para provar que não falha —, **(a) é arrastado junto** e o produto fica sem nenhum ganho de 3D depois de semanas de trabalho.

**Proposta:** separar (a) como **Fase 0.5**, entregável de forma independente.

### 9.3 Sequência recomendada

| Fase | Escopo | Novo? | Depende de | Evidência possível |
|---|---|---|---|---|
| **0** | Decidir D-01…D-07 e registrar 45–62 | ✅ | — | Documento |
| **0.5** | **Camada 0: SceneIndex declarado** | ✅ **novo** | Fase 0 | **Node puro, 100% `VALIDATED`** |
| 1a | Instalar `three` lazy; canvas; WebGL2; órbita; dispose; telemetria | — | 0.5 | Chromium real + Windows |
| 1b | Diagnóstico declarado × medido sobre a cena carregada | — | 1a | Chromium real |
| 2 | Seleção, hierarquia, transformação reversível | — | 1a | Chromium real |
| 3 | Materiais e texturas | — | 2 | Chromium real |
| 4 | Esqueleto e animação | — | 2 | Windows (fps) |
| 5 | Workflows, Blender, QA | — | Contratos aprovados | — |
| pós | WebGPU, splats, cabelo, path tracing | — | Medição | Não comprometido |

**Por que 0.5 vem antes:** entrega hierarquia, transforms, bounds declarados, PBR declarado, canais de animação resolvidos por nome, IDs estáveis e diagnóstico — tudo `VALIDATED` em Node, sem GPU, sem CSP, sem dependência nova, sem Windows. E **corrige F-01/F-02/F-03** no único lugar onde eles importam.

---

## 10. A única próxima fatia recomendada

> **Fatia:** `SceneIndex` declarado — leitura de hierarquia, transforms, bounds, PBR e canais de animação a partir dos bytes GLB já inspecionados.
> **Rótulo:** `PROPOSED`. Nada implementado.
> **Esforço:** **S** (pequeno) — extensão de leitura de um módulo puro de 159 linhas.

### 10.1 Por que esta

| Critério | Por que esta fatia ganha |
|---|---|
| **Não depende de nada bloqueado** | Não precisa de `three`, CSP, protocolo, contrato aprovado, GPU nem Windows |
| **Não cria contrato** | Estende a leitura do `model3d.inspect` **já `IMPLEMENTED`** |
| **Não adiciona dependência** | `DataView`/`TextDecoder`, já usados em `glb.mjs` |
| **É 100% validável hoje** | Node puro; testável no sandbox |
| **É pré-requisito de três fases** | IDs estáveis (F2), bounds (F1), alvos de canal (F4) |
| **Corrige três defeitos reais** | F-01 duração, F-02 triângulos em strip, F-03 PBR ausente |
| **Reduz o risco da Fase 1a** | Quando o canvas chegar, `SceneIndex` já existe e já é confiável |

### 10.2 Escopo exato

**Entra:**
1. Árvore de nós: nome, índice, pai, filiação, `matrix` **ou** TRS decomposto.
2. **IDs estáveis gerados pela Lia** (caminho + índice + hash do nó), porque nomes podem vir vazios ou duplicados.
3. Bounds **declarados** por primitiva, de `accessor.min/max` quando presentes.
4. Material PBR **declarado**: `baseColorFactor`, `metallicFactor`, `roughnessFactor`, `emissiveFactor`, `alphaMode`, `alphaCutoff`, `doubleSided`.
5. Inventário **completo** de canais de textura por material (não só baseColor/normal).
6. Hierarquia de bones e raiz de skin **por nome**.
7. Canais de animação com `target.node` resolvido para nome, e duração **lida dos bytes** quando `accessor.max` faltar.
8. Correção de `triangleCount` respeitando `mode` (4/5/6).
9. Diagnóstico declarado: sem normais, sem UV com material texturizado, escala suspeita, skin declarada sem uso, `extensionsRequired` desconhecida.

**Não entra:**
- Qualquer renderização, canvas, WebGL ou WebGPU.
- Qualquer dependência nova (`three` continua ausente).
- Qualquer contrato novo ou alteração de `View3DSession`.
- Qualquer escrita em arquivo.
- Bounds **computados** (`Box3`) — exigem cena carregada.
- Decodificação de imagem ou VRAM **medida**.

### 10.3 Critérios de aceite

| # | Critério | Evidência |
|---|---|---|
| 1 | F1 (hierarquia aninhada) produz árvore com nomes, pai e TRS corretos | Teste com fixture nova |
| 2 | Nomes duplicados e vazios não colidem: IDs estáveis distintos | Fixture adversarial |
| 3 | Bounds declarados batem com `accessor.min/max` da fixture existente (`[-1,-1,-1]`/`[1,1,1]`) | Teste sobre F0 |
| 4 | `triangleCount` correto para `mode` 4, 5 e 6 | Fixture com strip/fan |
| 5 | Duração de clipe correta **com e sem** `accessor.max` | Duas fixtures |
| 6 | PBR declarado exposto; ausência vira `null`, não `0` | Teste de campo ausente |
| 7 | Diagnóstico **nunca** emite `approved`/`passed` | Validação de schema |
| 8 | Nenhum arquivo do projeto é alterado | SHA-256 antes/depois |
| 9 | `glb-inspect-smoke` continua verde | Regressão |
| 10 | Nenhuma dependência nova no `package.json` | Diff do arquivo |

### 10.4 Por que **não** é a fatia óbvia

A fatia óbvia seria "instalar Three.js e desenhar um cubo". Recuso por três razões verificadas:

1. **Não há teste de canvas no repositório** (R25). "Desenhou um cubo" seria uma afirmação sem evidência reproduzível.
2. **O teto real de entrada é 32 MB** (R24). O caso de uso que justifica a viewport — abrir um personagem real — pode não passar pelo seletor.
3. **As decisões-gate não existem no arquivo canônico** (R23). Implementar antes disso é construir sobre gate inexistente.

A fatia recomendada é a única que produz evidência `VALIDATED` **hoje**, sem violar nenhuma das três condições acima.

---

## 11. Limitações desta auditoria

Honestidade sobre o que **não** foi feito:

| Limitação | Consequência |
|---|---|
| **Nenhum pixel 3D foi renderizado** | Nenhuma afirmação de fps, VRAM ou qualidade |
| **Nenhum probe de GPU** | WebGPU/WebGL2 na RX 580 permanecem `unknown` |
| **Nenhuma execução em Windows** | Nada é `VALIDATED` na plataforma-alvo |
| **App empacotado não foi executado** | Comportamento em produção não verificado |
| **`node_modules` ausente** | 3 smokes não rodaram; `npm test` falha no 1º script |
| **`three` não foi instalado** | Nenhuma verificação de runtime; apenas leitura do tarball |
| **Código lido de branch alheia, não desta** | O produto não está nesta branch |
| **`docs/Lia.zip` não inspecionado** | Pode conter material relevante não auditado |
| **Testes de Blender não executados** | Adapter lido, não executado |
| **Bug B-03 (fases divergentes) tratado, não resolvido** | Adotei o critério mais restritivo |

---

## 12. Conclusão

1. **Não existe viewport Three.js no produto.** Zero ocorrências de Three.js, WebGL, WebGPU, CSP, protocolo de asset, handler de contexto perdido e telemetria de processo. O que existe é inspeção **estrutural** de GLB, sólida e testada, mais uma UI que declara não renderizar.
2. **Esta branch não contém o produto.** `main` e a branch de código são **árvores sem ancestral comum**. A pesquisa e o código nunca coexistiram. Os dois achados de processo de §0 vêm daí.
3. **A pesquisa é tecnicamente competente e organizacionalmente fragmentada.** Suas afirmações sobre o pacote `three@0.187.0` resistiram integralmente à verificação — com uma exceção: o JSDoc de `hasFeature()` contradiz a implementação. Restaram dois defeitos reais de registro (B-02: as 18 decisões-gate não existem no arquivo canônico; B-03: fase divergente entre três documentos) e um terceiro que **eu** levantei por engano e refutei na mesma sessão (B-01), o que está registrado em §1.2 como lição de método.
4. **A lacuna mais mal classificada é a hierarquia.** A árvore de nós, os transforms, os bounds declarados e o PBR **já estão no chunk JSON** que o produto lê. Não precisam de WebGL. Chamar isso de "depende do renderer" adia trabalho barato e de alto valor.
5. **O maior risco não é desenhar.** É memória sem telemetria, CSP inexistente, teto de entrada de 32 MB contra promessa de 256 MB, e — acima de tudo — **nenhum teste de canvas** num produto que pretende validar um canvas.
6. **WebGL2 é a escolha correta e WebGPU pode esperar.** A decisão não bloqueia nada, e a primeira fatia nem toca em renderer.
7. **A próxima fatia recomendada é a `SceneIndex` declarado.** Pequena, sem dependência, sem GPU, sem contrato novo, 100% validável hoje, e pré-requisito de três fases seguintes.

**Veredito:** a pesquisa está pronta para orientar implementação; **o repositório não está pronto para recebê-la**. Antes do primeiro pixel, três coisas precisam acontecer: decidir qual linhagem é o produto (D-02), registrar as 18 decisões num lugar que exista (D-03), e criar um jeito de provar que um canvas funciona (D-06). Nenhuma delas exige GPU.

**Nada neste documento autoriza implementar.**

---

## 13. Rastreabilidade

| Documento | Relação com esta auditoria |
|---|---|
| `docs/threejs-3d-environment/01…17` | Objeto auditado; divergências em §1.2, §2.2, §2.5 |
| `docs/IMPLEMENTATION-AUDIT.md` (branch de código) | Confirma estado real; seus números de baseline foram reconfirmados em §7.2 |
| `docs/DECISIONS-AND-OPEN-QUESTIONS.md` (branch de código) | Fonte de verdade **real** das decisões: para em 44 (§B-02) |
| `docs/DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md` | `DRAFT_FOR_HUMAN_REVIEW — NOT AUTHORIZED`; nenhum contrato de viewport |
| `docs/WORKFLOW-ENGINE.md` | Fase 5 depende dele; `IMPLEMENTED` parcialmente |
| `docs/PRODUCT-ARCHITECTURE.md` | Visão alvo; confirma "arquitetura-alvo, não alegação de implementação" |
| `docs/ASSET-PIPELINES.md` | Rotas 3D são `PARTIALLY_IMPLEMENTED`/`PLANNED` |
| `docs/T13-IMPLEMENTATION-EVIDENCE.md` | §12 lista o que não foi executado — mesma disciplina aplicada aqui |
| `AGENTS.md` | Regra de não declarar funcionalidade sem inspeção — seguida |
