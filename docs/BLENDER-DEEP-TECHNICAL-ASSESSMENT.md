# LIA FORGE — AVALIAÇÃO TÉCNICA PROFUNDA: BLENDER

> **Estado deste documento:** `PROPOSED` — avaliação e recomendação. **Nenhum add-on foi instalado, habilitado ou executado. Nenhum Blender foi aberto. Nenhuma cena original foi aberta ou modificada. Nenhuma dependência foi instalada. Nenhum código de produção foi escrito.** Nenhuma compatibilidade é declarada como validada.
>
> **Data:** 2026-11-14 UTC
> **Branch:** `arena/ca5fcc8f-lia-forge` (base `main` @ `6bd9a5a`)
> **Escopo:** terceira camada da frente Blender. Não repete inventário, contagens nem matrizes já publicadas.
>
> **Documentos de base (lidos integralmente nesta sessão):**
> [`ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md`](ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md) · [`BLENDER-ADDONS-MATRICES.md`](BLENDER-ADDONS-MATRICES.md) · [`BLENDER-BRIDGE-SPECIFICATION.md`](BLENDER-BRIDGE-SPECIFICATION.md) · [`auditoria-blender-local/`](auditoria-blender-local/README.md) (README, BASELINE, ADDONS, CAPACIDADES, DUPLICATAS, ASSIMILACAO, LICENCAS-E-DEPENDENCIAS, PROJETOS-BLENDER e os JSON de inventário)
>
> **Documentos que este documento pretende substituir parcialmente:** as seções de decisão da especificação do Bridge **§3.2** (descoberta), **§6.1** (flags de segurança), **§6.2** (habilitação de add-ons), **§6.3** (`temp_override`), **§12** (controle de versões) e **§14** (automatizável vs manual) — ver §5.2, §5.4 e §9 abaixo. As demais seções da especificação **permanecem** válidas como contrato de job.

---

## 0. Sumário executivo

A pesquisa anterior parou em "quais add-ons existem e o que cada um faz". A auditoria local provou que os bytes existem e que as licenças declaradas nos manifestos podem ser lidas. **Nenhuma das duas respondeu à pergunta que decide o produto:** *o que a Lia Forge consegue executar sem depender de terceiros, e o que ela precisa construir sozinha?*

Este documento responde a essa pergunta com seis achados que mudam o plano:

1. **O Bridge, como especificado, não é executável no alvo.** A especificação manda rodar Blender com `--factory-startup` e habilitar add-ons em runtime (§6.1/§6.2). Em factory startup não se pode contar com add-on habilitado pelo usuário, e a habilitação de extensão moderna exige o módulo qualificado `bl_ext.<repo>.<pkg>` — nome que só existe após a instalação e que varia por repositório. A alternativa documentada (`--addons bl_ext.<repo>.<pkg>`) falha quando o repositório está desabilitado. **Decisão necessária: renunciar a `--factory-startup` no caminho que habilita add-ons, ou passar a exigir um perfil de usuário Blender dedicado e provisionado.** Ver §5.2.
2. **"Integrar" um add-on GPL por subprocesso não resolve o copyleft.** Quando o add-on precisa rodar *dentro* do processo Blender para produzir o resultado (bake, shape keys, keyframes), o artefato que a Lia Forge produz e distribuível incorpora dados gerados por código GPL, e a fronteira de obra derivada deixa de ser óbvia. O único caminho em que a separação é tecnicamente defensável é **chamada por CLI, sobre arquivos, sem import de `bpy`**. Hoje **apenas um** candidato tem essa forma (Voxel Heat Diffuse) e ele está bloqueado por binário proprietário. Ver §4 e §8.
3. **A auditoria local já mediu o que faltava medir em três candidatos, e o resultado contradiz a pesquisa anterior.** SKkeeper local tem 1 fonte e zero marcadores de UI; `JiggleGen` e `JiggleMaker` empacotam `.pyc`; SquishyFX tem duas linhagens (3.3.0 com 7 fontes, 3.40.0 com 17 e marcadores de viewport); HairCard Studio declara 1.0.0 internamente nas três embalagens 1.0/1.1/1.5. Isso muda a ordem de prioridade. Ver §3.
4. **A verificação upstream corrigiu sete afirmações da pesquisa anterior, cinco delas de licença** (MPFB não é AGPL no código; xatlas não é MIT no add-on; CharMorph tem AGPL no *banco de personagens*; Keemap não é MIT; Principled Baker não tem licença verificada; `robust-weight-transfer` não é MIT) **e mais duas da própria especificação do Bridge** (`extension_enable` não existe; o critério de morph target não é avaliável). Duas das primeiras sustentavam prioridade "verde". Ver §2.
5. **O melhor candidato a PoC não é headless-trivial, e o documento diz exatamente por quê.** A leitura estática do Wiggle Bones 1.1.2 (6 arquivos) mostra que `wiggle.bake` chama `wiggle.select`, cujo `poll()` exige `context.mode == 'POSE'`. Em `--background` o modo é `OBJECT`. O bake **pode não rodar** sem `mode_set('POSE')` — e isso vira a medida M0, antes de qualquer outra (§10.1). O add-on não tem `random` nem relógio: a hipótese de determinância é razoável, mas continua sendo hipótese.
6. **A especificação do Bridge contém uma chamada que não existe e um critério de aceite que o validador atual não consegue medir.** `bpy.ops.preferences.extension_enable` não é operador da API. E `inspectGlb()` no T13 cobre meshes, primitivas, animações, skins, materiais e imagens, mas **não** expõe `primitive.targets` nem contagem de morph targets — portanto o critério §11.1 (`includeMorphTargets: true` ⇒ ≥ 1 target) **não é avaliável hoje**. Ver §5.2, §7.2 (P2) e §11.2 (T7).

**Recomendação única de próxima prova de conceito:** §10 — PoC-1, bake headless de um rig próprio com Wiggle Bones 1.1.2, medindo antes a *capacidade de habilitação* e a *determinância de saída*, não a qualidade visual.

---

## 1. Regras de leitura deste documento

### 1.1 Estados

Os cinco estados são usados no sentido estrito definido em [`auditoria-blender-local/BASELINE.md`](auditoria-blender-local/BASELINE.md):

| Estado | Critério |
|---|---|
| `PROPOSED` | opção apresentada para decisão humana |
| `PLANNED` | etapa futura documentada, sem código |
| `IMPLEMENTED` | existe código no checkout citado |
| `EXECUTED` | algo rodou, com ambiente e escopo registrados |
| `VALIDATED` | critério verificável + resultado observado |

Estado documental complementar: `NOT-TESTED` (não executado) e `BLOCKED` (depende de decisão/acesso).

### 1.2 O que esta sessão executou de fato

| Ação | Estado | Escopo |
|---|---|---|
| Leitura das cinco fontes obrigatórias | `EXECUTED` | integral |
| Extração programática de marcadores de risco dos JSON da auditoria local | `EXECUTED` | `ADDONS.json`, `BLENDS.json`, `INVENTARIO.json`, `FONTES-SHA256.json`, `CONTAGENS.json` — somente leitura |
| Consulta à API do GitHub (`gh api`) sobre 27 repositórios upstream (mais 1 retorno `404`) e seus `LICENSE`/manifestos/árvores/releases | `EXECUTED` | metadados, texto de licença, manifestos, releases |
| Leitura do código real do T13 (`arena/649f88bd-3dspritesheet`) — 11 arquivos, alguns parcialmente | `EXECUTED` | leitura, sem checkout nem execução |
| Leitura estática do código-fonte de **um** candidato: `Hans-xwh/wiggle-bones`, 6 arquivos, `src/wiggle_bones/`, tag `1.1.2` (`7952297b`) | `EXECUTED` | leitura, sem instalar, sem habilitar, sem executar; achados em §10.1 |
| Consulta às docs oficiais do Blender (CLI, extensões, bpy.ops, release notes 4.2/5.0) | `EXECUTED` | leitura |
| Instalar, habilitar ou executar add-on | **não feito** | — |
| Abrir Blender | **não feito** | — |
| Abrir cena original | **não feito** | — |
| Instalar dependência (`pip`, wheels, binários) | **não feito** | — |
| Verificar SHA-256 dos pacotes locais contra upstream | **não feito** — os arquivos do usuário não estão nesta sessão; sem os bytes locais não há comparação possível. Um download de *release* completou por redirecionamento, mas **não foi usado como evidência** (§12.3, L3 e L4) | — |

### 1.3 Duas fontes de verdade diferentes

Este documento trata como **fato local** apenas o que está nos JSON da auditoria local, e como **fato upstream** apenas o que foi lido em repositório público ou documentação oficial. Onde os dois divergem, a divergência é registrada como divergência — não é resolvida por escolha de fonte.

---

## 2. Correções materiais sobre a pesquisa anterior

Estas correções não repetem o inventário; corrigem afirmações que sustentavam decisões. C1–C7 vêm de fonte primária (licença/manifesto/código upstream). C8–C9 vêm da leitura de código feita para esta avaliação.

| # | Afirmação anterior | Evidência desta sessão | Efeito na decisão |
|---|---|---|---|
| C1 | MPFB2 é **AGPL-3.0** (`ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md` §4.5, `BLENDER-ADDONS-MATRICES.md` §1.2/§1.3) | `makehumancommunity/mpfb2` tem `LICENSE.CODE.md` = **GPL-3.0** (texto integral lido) e `LICENSE.ASSETS.md` = **CC0 1.0** (texto integral lido, incluindo os considerandos de renúncia). A auditoria local já havia corrigido isso em `DUPLICATAS.md`. | A restrição "copyleft forte / obra derivada" **não se aplica ao código**. Ela continua valendo apenas para o **banco de personagens** que o MPFB baixa/distribui (licença por personagem, não por arquivo de licença do repo). O bloqueio desce de "estrutural" para "por asset". |
| C2 | xatlas é **MIT** e `ADMIT` (`BLENDER-ADDONS-MATRICES.md` §1.2/§3 linha 6) | `mattedicksoncom/blender-xatlas` **não tem arquivo de licença** e a API de licença devolve 404 (tentativa de `GET /license` → `Not Found`). O `addons/blender_xatlas/__init__.py` abre com o cabeçalho **GPL v3 or later**. A biblioteca C upstream `jpcy/xatlas` **é** MIT. | O **add-on** é GPL-3.0+; a **biblioteca** é MIT. `ADMIT` estava atribuído ao componente errado. Corrige-se para `ADDON=GPL-3.0-or-later / LIB=MIT` e a prioridade cai. |
| C3 | CharMorph é GPL-2.0 puro e a dúvida era "compatibilidade com GPL-3.0" (§4.5 e §1.3) | `Upliner/CharMorph/license.txt` separa três licenças: **código GPL-3.0-or-later**, **banco de personagens AGPL-3.0** (herdado do MB-Lab), **renders com cláusula própria**. O texto diz explicitamente que "the AGPL will propagate from the base models and from the database to the output models". | O problema do CharMorph **não é** compatibilidade GPL-2.0/3.0 — é **propagação AGPL para o modelo de saída**. Isso é bloqueio de produto, não de licença de código. |
| C4 | Keemap Retargeting é **MIT** e `ADMIT` (§4.7, §1.2) | `LICENSE` do repositório é **GPL v3** (texto lido); a API de metadados devolve `GPL-3.0`. Último commit em 2023-02-27. | Deixa de ser o candidato permissivo de retargeting. O candidato permissivo com manifesto atual é `Mwni/blender-animation-retargeting` (`blender_manifest.toml`: `license = ["SPDX:GPL-3.0-or-later"]`, `blender_version_min = "4.4.0"`, `[permissions] files`). **Atenção:** a pesquisa anterior chamou este de MIT; o manifesto atual diz GPL-3.0-or-later. Nenhum dos dois é MIT hoje. |
| C5 | `Principled Baker` é **GPL-3.0** (§1.2) | O repositório **não tem arquivo de licença** (404 em `/license`), o `__init__.py` não traz `bl_info` com licença nem cabeçalho SPDX, e o `bl_info` declara `"blender": (2, 83, 0)` com versão `0.5.7`. Último push 2023-09-27. | `GPL-3.0` não está verificado por fonte primária. Rebaixa para `BLOCKED_PENDING_LICENSE_REVIEW` e para `MONITOR`. Também: é add-on legado sem manifesto, mais um caso para §5. |
| C6 | `robust-weight-transfer` é **MIT** e `ADMIT` (§1.2, §3 linha 22) | `LICENSE` = GPL v3; `__init__.py` traz cabeçalho GPL v2-or-later; `requirements.txt` = `scipy`, `libigl==2.5.1`, `robust-laplacian`. O operador `wm.install_rwt_dependencies` executa `python -m pip install --user ... --break-system-packages` dentro do processo Blender. | Copyleft + resolução de dependência em rede no `register`/operador. Sai de "MIT, baixa prioridade" para "excluído do escopo headless" (§8.4). |
| C7 | `blender-xatlas` foi tratado como biblioteca sem processo externo | O `__init__.py` (lido, 885 linhas) invoca `subprocess.Popen('chmod u+x "<path>"', shell=True)` e depois `subprocess.Popen(r'"<path>" <args-string>', shell=True)`, com o argumento montado por concatenação de string a partir de `getattr(packOptions, key)`. | Executa um binário auxiliar **através de shell** com string concatenada. É marcador de segurança relevante (§8.3) e explica por que a auditoria local viu `Popen` em `Auto Unwrap`, `Seamless CAD` etc. — o padrão é comum no ecossistema. |
| C8 | Wiggle Bones "6 fontes, `handlers` apenas" foi lido como "headless trivial" | O código lê quatro dependências de estado que o inventário não captura: `wiggle.select` exige `context.mode == 'POSE'`; `wiggle.bake` chama `wiggle.select`; o bake faz `frame_set` em frame negativo no preroll; o handler sai cedo por comparação de `lastframe` | **Não é** um add-on que "só adiciona keyframes" quando chamado de script: é um add-on de viewport com operadores em cadeia. Continua sendo o melhor candidato — agora com pré-condições nomeadas (§10.1, A1–A4) em vez de otimismo |
| C9 | A especificação do Bridge chama `bpy.ops.preferences.extension_enable(...)` | Operador **inexistente** na API. Os reais são `addon_enable(module=...)`, `extensions.package_install(_files)`, `extensions.package_enable_not_installed` | O script do Bridge, se escrito como está especificado, falha no primeiro job com `AttributeError`. Correção em §5.2 |
**Nota metodológica:** C2–C6 são casos em que a pesquisa anterior atribuiu licença a partir de README, memória de projeto ou convenção da comunidade, sem ler o arquivo. Isso não invalida a pesquisa; invalida o uso das colunas "MIT/ADMIT" como base de priorização. **Nenhuma prioridade deste documento usa licença inferida.**

---

## 3. O que a auditoria local acrescenta e a pesquisa anterior não tinha

A auditoria local cobre 38 famílias, contra 19 na pesquisa anterior, com 21 famílias inéditas. Não vou repetir os nomes (estão em `DUPLICATAS.md` e `CAPACIDADES.md`). O que importa tecnicamente são **quatro sinais estruturais** que a pesquisa anterior não podia ver, porque não tinha os bytes:

### 3.1 Divisão de linhagem dentro da mesma família

| Família | Entradas de versão no inventário local | O que muda para o Bridge |
|---|---|---|
| SquishyFX | 2 hashes (`a5e0c6a2…`, 3.3.0, 7 fontes, contexto `handlers`) e (`fa286809…`, 3.40.0, 17 fontes, contexto `area, handlers, modal_handler_add, region, temp_override, timers, window`) | São **dois programas diferentes**. A linhagem 3.40.0 tem marcadores de viewport que a 3.3.0 não tem. Um teste de headless feito em 3.3.0 **não** transfere para 3.40.0. |
| HairCard Studio | 3 embalagens (1.0 / 1.1 / 1.5) com **manifesto interno 1.0.0** nas três | O número da embalagem não é a versão do add-on. Pin por versão declarada é ambíguo; pin tem de ser por **SHA-256**. |
| JiggleMaker | 2.0.0 e 2.2.2, ambas com 27 fontes e os mesmos marcadores (`modal_handler_add`, `temp_override`, `window`) | A diferença entre versões não altera o perfil de contexto. O risco headless é o mesmo nas duas. |
| Seamless CAD | **6** entradas (8.1.5.1 … 8.1.5.4) com `.exe/.dll/.pyd/.dylib` | Família com maior densidade de binários nativos do inventário, com divergência entre rótulo e metadado. Fora de escopo. |
| Animation Snapper Pro / Switcher | 5 e 4 entradas; variantes por versão de Blender (`4.x Standard` vs `Blender 5.0`) | O add-on **já se divide por versão de Blender**. Isso confirma que pin por versão de host é obrigatório, não opcional. |

**Consequência:** o Bridge não pode registrar "add-on X versão Y" como identidade. Precisa registrar **(família, SHA-256 do pacote, versão declarada no manifesto/bl_info, versão do Blender)**. Ver §6.1.

### 3.2 Marcadores de contexto como predicado de elegibilidade headless

Extraí, dos campos `contexto`, `imports` e `binarios_amostra` do `ADDONS.json`, o perfil de cada família. Resultado agregado (contagem de **famílias**, não de arquivos):

| Marcador | Famílias | Leitura |
|---|---|---|
| UI/contexto de janela (`area`, `region`, `window`, `draw_handler_add`, `modal_handler_add`, `timers`, `handlers`) | 31 de 38 | A maioria dos add-ons **referencia** contexto de UI. Referenciar não é usar no caminho de bake — mas o custo de provar isso é por add-on. |
| `Popen`/`subprocess` | 12 | Já invocam processos externos. Cada um é um subprocesso aninhado que o cancelamento do Bridge não alcança (§8.5). |
| `eval`/`exec` | 9 | Execução dinâmica de código. Relevante para auditoria, não necessariamente malicioso (geradores de operador). |
| Marcadores de rede (`socket`, `urlopen`, `requests`) | 10 | Ver §8.2. |
| Binário nativo ou wheel empacotado | 7 | `.exe`/`.dll`/`.pyd`/`.so`/`.dylib`/`.whl`. Só 2 famílias declaram wheel em manifesto (MMD Tools 1, TrueSKY 5). |
| **Sem marcador algum de contexto/UI** | **5** | `Auto-Rig Pro: Quick Rig`, `Goo Physics`, `Professional Hair Suite`, `RLX Auto Fit`, `SKkeeper`. Desses, **SKkeeper** é o único com licença verificada, zero binários, zero `Popen`, zero rede e arquivo de entrada único. `Auto-Rig Pro: Quick Rig` declara `GPL-2.0-or-later` mas importa `requests`; `Goo Physics`, `Professional Hair Suite` e `RLX Auto Fit` não têm licença declarada. |
| Declara `blender_version_max` no manifesto | **1 de 38** | Só VRM format (`4.10.2`, `max = 5.3.0`). Todo o resto pode instalar em qualquer versão ≥ mínimo. **A ausência de `version_max` é a regra, não a exceção** — o Bridge não pode contar com o Blender recusando um add-on incompatível. |
| Empacota `.pyc` (bytecode) ao lado do `.py` | 5 | `Bloom Agent`, `glTF 2.0 legado`, `JiggleGen`, `JiggleMaker`, `Magic Bone UE5 Rig Creator Pro`. O `.pyc` não substitui a leitura estática (as fontes `.py` dessas famílias foram lidas), mas é **código executável não auditado** dentro do pacote — ver §8.1. `glTF 2.0 legado` com `.pyc` é relevante: são cópias antigas do exportador em bundles de rig. |

**Ressalva medida:** ao ler o código de Wiggle Bones, o campo `contexto` do inventário registra apenas `handlers` — e de fato o único uso de contexto no caminho de bake é `context.mode`, mas o add-on **tem** 340 linhas de painel `VIEW_3D`. O marcador, portanto, **subestima UI declarativa e não subestima (nesse caso) dependência de modo**. Ele serve para **priorizar**, não para **dispensar** S2 (§11.4). Isso é o mesmo que L10 diz, agora com um exemplo concreto em vez de uma ressalva genérica.

**Consequência:** "sem marcador de UI" é o único predicado barato e verificável que a auditoria local oferece para priorizar headless. Ele seleciona **SKkeeper** como o candidato de menor risco estrutural do inventário — e é o que já estava em primeiro lugar na matriz, por outro motivo. Isso é convergência, não circularidade: a pesquisa anterior o colocou lá por "ser puro `bpy.data`"; a auditoria local confirma com contagem de fontes e ausência de `Popen`, `socket`, `eval`, wheel e binário.

### 3.3 Cenas: o que existe é referência, não fixture

Dos 506 hashes de `.blend` com estrutura lida:

| Classe | Hashes | Uso possível |
|---|---|---|
| Biblioteca de materiais | 337 | Referência de técnica. Direitos por item, não verificados. |
| Cena ou biblioteca em pacote | 99 | Referência dentro de add-on. Não é fixture própria. |
| Template ou exemplo de rig | 36 | Referência de topologia/peso. Direitos não verificados. |
| Referência de shader estilizado | 15 | Técnica de NPR. Direitos e IP de terceiros pendentes. |
| Recuperação e histórico (autosave) | 8 | Snapshot; direitos da cena de origem. |
| Ferramenta procedural de tranças | 5 | Referência de Geometry Nodes. |
| Referência de personagem e rig | 3 | **As únicas com contagem alta de ossos** (497, 1321, 612 ossos). São a melhor fonte de *forma de rig* — e as de maior risco de direitos. |
| Template humanoide modular | 2 | 147 objetos / 74 e 71 ossos. Referência de modularidade. |
| Deformação procedural (SquishBulge) | 1 | 2 árvores GN, 4 Actions. |

Cruzando com os marcadores de conteúdo ativo: **61** hashes têm candidatos a text block de script e **31** têm drivers com script. Isso não significa cena maliciosa — significa que **nenhuma cena do inventário pode ser tratada como dado inerte**. Ver §8.1.

**Consequência:** não existe, no inventário, uma fixture com direitos verificados. Toda prova de conceito precisa de uma **fixture construída pela Lia Forge** (§9.1, B1; §7.2, P5). Usar cena do inventário como fixture contamina o experimento com uma variável de licença que não é o que se quer medir.

### 3.4 Versão de arquivo `.blend` vs versão de Blender

As versões de arquivo lidas vão de `281` a `502`. O preflight da auditoria local usou **Blender 5.3.0** e as tentativas de leitura de projeto em background "não produziram relatórios utilizáveis" (`README.md` da auditoria local). Isso é uma evidência **negativa** e é a mais importante do pacote local: **o ambiente de referência já falhou em ler cenas em background ao menos uma vez**, e a causa não foi isolada. O Bridge herda esse risco (§9.1, B10).

---

## 4. Capacidade × componente: onde a fronteira realmente cai

A separação pedida (código / binários / assets / cenas / presets / dependências) só tem consequência prática se estiver ligada a **quem carrega o quê em qual processo**. Esta é a matriz que uso nas decisões seguintes.

### 4.1 Camadas de componente

| Camada | Definição | Exemplos no inventário | Como o Bridge lida | Risco de licença |
|---|---|---|---|---|
| **L1 — código Python que importa `bpy`** | Executa dentro do processo Blender, altera a cena | SKkeeper (`sk.*`), Wiggle Bones (`wiggle.bake`), SquishyFX (`squishyfx.bake_shapekeys`), VRM (`export_scene.vrm`), MMD Tools | Habilita e chama operador | Copyleft se distribuído junto; fronteira de obra derivada discutível se apenas executado |
| **L2 — dados carregados na cena** (`.blend` de node groups, presets JSON, bibliotecas) | Não executa sozinho, mas pode carregar `Text`s e drivers | SquishBulge (`.blend`), JiggleGen (`jigglegen_library.blend`), Goo Physics (13 presets JSON), Genshin Shader (NodeGroups) | `bpy.data.libraries.load(..., link=False)` com autoexec desligado | Direitos por asset; frequentemente não declarados |
| **L3 — binário nativo empacotado** | Executável ou biblioteca compilada chamada por L1 ou pelo Bridge | VHD (`vhd.exe`/`vhd`), Cloth NeXt (`cloth-next-bake.exe`), Seamless CAD (`.exe/.dll/.pyd`), SpringFX (`.dll/.so/.dylib`), xatlas (`xatlas-blender[.exe]`) | Idealmente: nunca pelo Bridge; no máximo CLI em sandbox com argumentos não concatenados | **Proprietário ou não declarado** em 4 de 5; auditoria impossível sem engenharia reversa |
| **L4 — wheel Python de terceiro** | `.whl` embarcado e instalado no `sys.path` do Blender | MMD Tools (`opencc_python_reimplemented`), TrueSKY (5 wheels) | Herdado do add-on; o Bridge não instala | Licença da wheel é independente do add-on |
| **L5 — dependência resolvida em runtime e em rede** | O add-on instala pacote sozinho | `robust-weight-transfer` (`pip install --user --break-system-packages`) | **Proibido pelo Bridge** (§8.4) | Fora do controle de proveniência |
| **L6 — cena / asset de arte** | Geometria, rig, textura, shader comercial | 506 `.blend`, bases modulares, Bodiez, Genshin Shader | Não entra em job; é entrada do usuário | Direitos por item, quase nunca verificados |
| **L7 — código Lia Forge** | MIT, roda no processo Electron/Node | `blender-adapter.cjs`, `shared/model3d/glb.mjs`, `shared/hub/provider-hub.mjs` | É o Bridge | Sem copyleft |

### 4.2 A consequência que a pesquisa anterior não tirou

A especificação do Bridge (§3.1) justifica "não empacotar add-ons" com três razões: compliance GPL, add-ons sem licença, e "o Blender já tem mecanismo próprio de instalação". As duas primeiras estão corretas. **A terceira é a razão pela qual a arquitetura não fecha:** se o Blender instala, o Bridge não controla versão, e o nome do módulo de uma extensão moderna depende do repositório em que ela foi instalada. O Bridge não pode gerar uma chamada determinística a partir de um add-on que ele não provisionou.

Duas saídas, ambas com custo:

| Saída | O que resolve | O que custa |
|---|---|---|
| **A — Bridge é consumidor, não instalador**: descobre o que existe, reporta `ready`/`missing`, e **falha o job** se o módulo não estiver habilitável. Nunca instala, nunca habilita às cegas. | Determinismo; zero copyleft novo; zero rede | O produto passa a depender de setup manual do usuário. A capability fica `BLOCKED` para quem não instalou. |
| **B — Bridge provisiona um perfil dedicado**: um `BLENDER_USER_CONFIG` (e `BLENDER_USER_EXTENSIONS`) próprios, criados pela Lia Forge, com os add-ons fixados por SHA-256, instalados por `bpy.ops.extensions.package_install_files` / `addon_install` a partir de arquivo local. | Determinismo real; pin por hash; permite `--factory-startup` sem perder os add-ons, porque o "usuário" é o perfil dedicado | A Lia Forge passa a **distribuir** os pacotes. Isso reabre integralmente o problema de copyleft e de proveniência. |

Este documento recomenda **A**, com B disponível como opção explícita do usuário (ele aponta para a própria pasta de extensões que já usa). Justificativa em §4.2 e §9.2 (D1/D3).

---

## 5. Arquitetura de integração recomendada

### 5.1 As cinco estratégias, julgadas contra o que foi verificado

| Estratégia | Onde funciona | Onde falha | Veredito |
|---|---|---|---|
| **Extensão Blender da Lia Forge** (código Lia dentro do Blender) | Interação de artista; menus; handoff manual | Coloca código MIT dentro de um host GPL e cria um artefato cuja licença efetiva precisa ser GPL; expande a superfície de manutenção para cada versão de Blender | `PROPOSED` apenas para um "Lia Helper" de handoff manual, **não** para o pipeline |
| **Subprocesso `--background --python`** (o que já existe) | Bake, export, unwrap, render — qualquer coisa que opere sobre dados | Não tem GUI, então qualquer operador modal puro é inalcançável; não tem `screen`, então `temp_override` de `area`/`region` não resolve | **Recomendada** como transporte |
| **Bridge local com socket/HTTP** (servidor dentro do Blender) | Sessão interativa; o artista vê o que o agente faz | Exige Blender aberto; superfície de ataque de rede local; ciclo de vida do processo é do usuário | `REJECT` para o pipeline de produção nesta fase (§8.2, §8.3). Só faz sentido depois de §10 |
| **Import/export em arquivo** (GLB/VRM/FBX entram e saem de jobs isolados) | Tudo o que é difusível entre etapas | Perde GN, controladores, shaders próprios do Blender — o perfil de export precisa declarar o que foi omitido | **Recomendada** como contrato entre etapas |
| **Workflow híbrido com gate humano** (Bridge faz o mecânico; artista faz o que exige julgamento) | Retopo, sculpt, hair grooming, rig refinement, pintura | Não é automatizável; é processo | **Recomendada** para as categorias que a matriz já marcou `MANUAL` — e agora com critério (§5.4) |

### 5.2 O problema de habilitação, e a correção ao §6.2 do Bridge

A especificação atual propõe:

```text
--background --factory-startup --disable-autoexec --python-exit-code 1
```
…e depois `addon_utils.enable(name)` ou `bpy.ops.preferences.extension_enable(...)`.

> **Erro adicional na especificação:** `bpy.ops.preferences.extension_enable` **não existe** na API atual. Os operadores reais são `bpy.ops.preferences.addon_enable(module=...)`, `bpy.ops.extensions.package_install(...)`, `bpy.ops.extensions.package_install_files(...)` e `bpy.ops.extensions.package_enable_not_installed(...)` ([Preferences Operators](https://docs.blender.org/api/current/bpy.ops.preferences.html), [Extensions Operators](https://docs.blender.org/api/current/bpy.ops.extensions.html)). Chamar um operador inexistente levanta `AttributeError` em Python, o que com `--python-exit-code 1` derruba o job com mensagem enganosa.

Três fatos quebram isso — com gradientes de evidência distintos, declarados em cada item:

1. `--factory-startup` é documentado como "Skip reading the `startup.blend` in the user's home directory" ([Command Line Arguments, Blender 5.4 Manual](https://docs.blender.org/manual/en/dev/advanced/command_line/arguments.html)). O texto do manual cita `startup.blend`; o efeito observado e relatado na prática é que a inicialização de fábrica também parte das preferências de fábrica, e portanto da lista de add-ons de fábrica. **Gradiente de evidência:** o texto oficial é `EXECUTED`-leitura; a consequência sobre `userpref.blend` é relato de terceiros, não medida nesta sessão. Teste **T1** existe justamente para fechar isso. O que já é seguro afirmar: em factory startup não se pode contar com add-on habilitado pelo usuário.
2. Extensões modernas vivem sob o pacote `bl_ext.<repo_module>.<pkg_id>` e o nome depende do repositório (documentado em [Add-ons — Extensions and Namespace](https://docs.blender.org/manual/en/latest/advanced/extensions/addons.html): "now instead of `kitsu` the module name would be `bl_ext.{repository_module_name}.kitsu`"). `bpy.ops.preferences.addon_enable(module=...)` recebe o *module name*, portanto precisa do nome qualificado.
3. `--addons bl_ext.<repo>.<pkg>` é a via não-operador, mas falha quando o repositório está desabilitado (relatado e confirmado pela própria thread de desenvolvimento: `Add-on not loaded: "bl_ext.blender_org.textify", cause: extension repository "blender_org" is disabled` — [Blender issue #125406](https://projects.blender.org/blender/blender/issues/125406)). Em `--factory-startup`, a configuração de repositórios é a de fábrica.

Além disso, há um risco operacional documentado fora do ecossistema do add-on: a combinação `--factory-startup` + `addon_enable` pode, com *Auto-Save Preferences* ativo, gravar os padrões de fábrica sobre o `userpref.blend` do usuário (relato detalhado em [osarchorg/wiki PR #5](https://github.com/osarchorg/wiki/pull/5)). Isso destruiria a configuração do artista — inaceitável para um produto que se propõe a não alterar o ambiente do usuário (`BRAND-STANDARDS.md` §2, princípio 2).

**Correção recomendada (substitui §6.1/§6.2 do Bridge):**

| Item | Antes | Depois |
|---|---|---|
| Startup | `--factory-startup` sempre | `--factory-startup` **somente** em job que não habilita add-on. Job com add-on usa `--factory-startup` **+** `BLENDER_USER_CONFIG`/`BLENDER_USER_EXTENSIONS` apontando para um diretório temporário **ou** para o perfil que o usuário escolheu |
| Auto-save | não tratado | `--python-expr` de encerramento não salva preferências; o Bridge nunca chama `bpy.ops.wm.save_userpref()`, e trava a preferência de auto-save no perfil temporário |
| Descoberta | `addon_utils.modules()` + `module_bl_info()` | `addon_utils.modules()` + `module_bl_info()` **e** varredura de `bpy.context.preferences.extensions.repos` (`repo.module`, `repo.directory`, `repo.enabled`, `repo.source`) para montar `bl_ext.<module>.<pkg>` — o campo `repo.source` distingue `USER` de `SYSTEM` |
| Habilitação | "tenta ambos" | Ordem explícita: (1) `bpy.ops.preferences.addon_enable(module=<nome qualificado>)`; (2) fallback `--addons` na linha de comando, **só** se o repo estiver habilitado; (3) falha `ADDON_NOT_ENABLEABLE` com o nome tentado e a razão |
| Verificação | não existia | Depois de habilitar: `addon_utils.check(module)` → `(loaded_default, loaded_state)`; `loaded_state` falso = falha, mesmo que o `enable()` não tenha lançado. Verificar também que o operador esperado existe (`hasattr(bpy.ops.<ns>, '<op>')`) antes de chamar |
| Versão máxima | "o Bridge usa o que o usuário instalou" | O Bridge **compara** `blender_version_max`/`bl_info['blender']` com a versão real e **bloqueia** se fora da faixa declarada. Isso importa porque **37 de 38** famílias não declaram máximo (§3.2) — o Blender não vai recusar |

O item "verificar `hasattr(bpy.ops...)`" não é preciosismo: `addon_utils.enable()` de um add-on cujo `register()` falhou parcialmente retorna sem exceção em vários casos, e o script do Bridge só descobre no meio do bake.

### 5.3 Forma recomendada

```
Studio (UI)
 └─ Workflow Engine (existente)
     └─ Provider Hub (existente)  → estado ready/missing/blocked + caminho do Blender
         └─ Bridge (proposto, contrato do BLENDER-BRIDGE-SPECIFICATION.md §4)
             ├─ Preflight (novo, obrigatório)
             │   ├─ versão do Blender (--version, parse)
             │   ├─ perfil escolhido (temporário | perfil do usuário | perfil provisionado)
             │   ├─ inventário de add-ons (módulos legados + extensões com repo.module)
             │   ├─ aptidão: módulo habilitável? operador existe? versão na faixa?
             │   └─ relatório de aptidão → gate antes de qualquer spawn de job
             ├─ Job Runner (evolução do runProcess existente)
             │   └─ spawn Blender com perfil, flags de §5.2, script do catálogo fechado
             └─ Output Validator (glb.mjs + campo de morph targets — §7.2 P2)
```

O **Preflight** é a única peça genuinamente nova. Sem ele, cada capability falha em tempo de job com um erro de Python de terceiro, que o Bridge não consegue classificar. Com ele, a falha vira `ADDON_NOT_ENABLEABLE` / `ADDON_VERSION_OUT_OF_RANGE` **antes** de abrir a cena — o que também significa que o job nunca toca no arquivo do usuário quando não vai conseguir produzir nada.

### 5.4 Critério de automatizável vs manual (substitui §14 do Bridge)

O §14 atual classifica por reputação do add-on ("RetopoFlow = viewport"). A auditoria local permite um critério verificável. Um capability é candidato a headless **somente** se as quatro condições passarem:

| # | Condição | Como se verifica |
|---|---|---|
| 1 | O operador-alvo não exige `area`/`region` de `VIEW_3D` nem `invoke()` modal | inspeção estática do `execute()` do operador no código-fonte + teste real |
| 2 | O add-on não instala dependência em rede | busca por `pip`, `subprocess`, `urlopen` no módulo de entrada |
| 3 | A saída é um arquivo cujo formato a Lia Forge já sabe validar | contrato de output existente (GLB/PNG/JSON) |
| 4 | O resultado é determinístico ou a não-determinância é declarada e medida | duas execuções idênticas, comparar hash do artefato **ou** comparar métricas com tolerância declarada |

A condição 4 é a que a pesquisa anterior não tinha. Ela é decisiva para física e simulação (§9.1, B6; §10.2, M5).

---

## 6. Matriz de candidatos priorizados

### 6.1 Chave de avaliação

Cada candidato é pontuado em seis dimensões independentes. Nenhuma delas é licença inferida.

| Dimensão | Valores |
|---|---|
| **Lic.** | `VERIFIED` (texto de licença lido) / `UNVERIFIED` (sem arquivo) / `PROPRIETARY` (binário) / `IP-3RD` (IP de terceiro) |
| **Habilitação** | `EXT` (manifesto + `bl_ext.*`) / `LEGACY` (`bl_info`) / `AMBOS` / `CLI` (fora do Blender) |
| **Headless** | `PLAUSÍVEL` (estático, sem marcador bloqueante) / `INCERTO` (marcadores de viewport) / `NÃO` (modal puro) / `NÃO TESTADO` |
| **Determinismo esperado** | `ALTO` (operação determinística sobre dados) / `MÉDIO` (depende de cache/física) / `BAIXO` (simulação com `frame_change_pre`) |
| **Saída validável hoje** | `SIM` (GLB/PNG/JSON com validador existente) / `NÃO` (formato sem validador) |
| **Custo de falha** | `BAIXO` (job isolado, sem arquivo do usuário) / `MÉDIO` / `ALTO` (reescreve cena) |

### 6.2 Matriz — faixa 1: candidatos com licença declarada/verificada e sem bloqueio de hardware ou binário

| # | Candidato | Versão/SHA local | Lic. | Habilitação | Headless | Determinismo | Saída validável | Custo de falha | Estado |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **SKkeeper** | 1.8.2 `5191ab47…` | `GPL-3.0-or-later` `VERIFIED` (manifesto `shapekey_keeper`) | `EXT` | `PLAUSÍVEL` — 1 fonte, zero marcadores, zero `Popen`/`socket`/`eval` | `ALTO` — `bpy.data` + `bpy.ops.object.convert`/`modifier_apply` | `SIM` (GLB morph) | `MÉDIO` (consome e **substitui** o objeto original) | `PROPOSED` → PoC-2 |
| 2 | **Wiggle Bones** | 1.1.2 `0afa2399…` | `GPL-3.0-or-later` `VERIFIED` (manifesto + LICENSE) | `EXT` | `PLAUSÍVEL` com pré-condições nomeadas — 6 fontes, `handlers` apenas; exige `mode = POSE` (§10.1) | `MÉDIO` — spring via `frame_change_pre`, mas o bake chama `nla.bake` sobre `frame_set` em laço; prever tempo | `SIM` (GLB skeletal) | `BAIXO` (adiciona keyframes) | `PROPOSED` → **PoC-1** |
| 3 | **SquishyFX 3.3.0** | 3.3.0 `a5e0c6a2…` | `GPL-3.0-or-later` `VERIFIED` | `LEGACY` (`bl_info`, 7 fontes) | `PLAUSÍVEL` — `handlers` apenas | `MÉDIO` — itera frames, cria shape keys | `SIM` (GLB morph) | `MÉDIO` | `PROPOSED` → candidato a PoC-3 |
| 4 | **SquishyFX 3.40.0** | 3.40.0 `fa286809…` | `GPL-3.0-or-later` `VERIFIED` | `EXT` (manifesto) | `INCERTO` — `area`, `region`, `window`, `modal_handler_add`, `timers` | `MÉDIO` | `SIM` | `MÉDIO` | `PROPOSED`, **não** intercambiável com 3.3.0 |
| 5 | **VRM format** | 4.10.2 `5ec972ae…` | `MIT` **e** `GPL-3.0-or-later` (manifesto upstream lista as duas) `VERIFIED` | `EXT`, **único** com `blender_version_max` (`5.3.0` na cópia local 4.10.2; `5.4.0` na release 4.10.5) | `PLAUSÍVEL` — `handlers`, `timers` | `ALTO` (export) | `NÃO` — VRM/VRMA não têm validador na Forge | `BAIXO` | `PROPOSED`, prioridade condicionada a validador |
| 6 | **MMD Tools** | 4.5.14 `2b8805ab…` | `GPL-3.0-or-later` `VERIFIED` (manifesto + `copyright` de 4 titulares) | `EXT` + wheel própria | `INCERTO` — `area`, `region`, `window`, `temp_override` | `ALTO` (import/export) | `NÃO` (PMX/PMD/VMD) | `BAIXO` | `MONITOR` |
| 7 | **MPFB** | 2.0.15 `5818a084…` | código **GPL-3.0** `VERIFIED`; assets core **CC0** `VERIFIED`; banco de personagens com licença **por personagem** | `EXT` | `INCERTO` — 505 fontes, `area`, `region`, `timers`, `temp_override` | `ALTO` (geração) | `SIM` (GLB) | `MÉDIO` | `PROPOSED` rebaixado — decisão de banco pendente |
| 8 | **xatlas** (add-on) | upstream `v0.0.12` (2025-07-12) | add-on **GPL-3.0+** `VERIFIED` (cabeçalho); lib **MIT** `VERIFIED` | `LEGACY` | `INCERTO` — `Popen` com `shell=True` e string concatenada | `ALTO` | `SIM` (UV em GLB) | `MÉDIO` | `PROPOSED`, rebaixado por C2+C7 |
| 9 | **Animation Retargeting** (`Mwni`) | `2.4.0` (manifesto upstream) | `GPL-3.0-or-later` `VERIFIED` (manifesto) | `EXT` (`blender_version_min = 4.4.0`) | `PLAUSÍVEL` — só `files` em `[permissions]` | `ALTO` | `SIM` (GLB animation) | `BAIXO` | `PROPOSED` (não é MIT — C4) |

### 6.3 Matriz — faixa 2: condicionados a decisão

| # | Candidato | Bloqueio | O que destrava |
|---|---|---|---|
| 10 | Voxel Heat Diffuse 3.5.3 | `PROPRIETARY` (`vhd.exe`, `vhd`); licença do wrapper não localizada; auditoria local não declara licença | Resposta escrita do autor sobre redistribuição dos binários **e** decisão de aceitar binário fechado no produto |
| 11 | JiggleGen 2.0.0 | empacota `.pyc`; `Popen`; manifesto declara `blender_version_min = 3.2.0` para código que usa API 4.x | Explicação de por que há `.pyc`; teste de habilitação em 4.5+ |
| 12 | JiggleMaker 2.2.2 | 27 fontes com `modal_handler_add`, `temp_override`, `window`; `.pyc`; proxies `.fbx` | Provar que `wm.jm_free_bake_cloth_selected` é alcançável sem viewport |
| 13 | HairCard Studio | as três embalagens declaram **1.0.0** internamente; somente `handlers`/`timers`; nenhum operador de conversão encontrado na lista | Resolver a identidade de versão antes de qualquer pin |
| 14 | Braids Generator / CTools Braids | `eval`/`exec`; sem licença no pacote local; upstream `CTools` sem release verificada | Licença + teste de `sna.convert_uv_attr` |
| 15 | BlenRig 7 | `GPL-3.0` `VERIFIED`; rig completo é interativo por natureza | Só como handoff manual |
| 16 | RetopoFlow 4.0.2 | manifesto local declara `SPDX:GPL-2.0-or-later`; `RetopoFlow.LICENSE` no repositório diz **GPL-3.0+**; o manifesto publicado hoje (3.4.11) declara `SPDX:GPL-2.0-or-later`. Divergência manifesto × arquivo de licença, e o texto reserva assets não-código como propriedade da Orange Turbine / CG Cookie | Handoff manual. `MANUAL` confirmado; licença precisa ser fixada **por release** antes de qualquer uso |
| 17 | Genshin Shader 2.2.1 | licença não declarada + IP miHoYo | Não reavaliar sem autorização de direitos |
| 18 | Bodiez | licença não declarada, origem marketplace | Não reavaliar sem nota fiscal/licença |
| 19 | SpringFX 8.2.4 | manifesto `8.2.4` vs `bl_info` `8.2.3`; `.dll/.so/.dylib`; declarada `GPL-3.0` mas com binários | Isolar binários; provável `REJECT` |
| 20 | Goo Physics 1.0.0 | `sem licença declarada` no inventário local (nenhum manifesto com `license`); arquivo `8893ae03…` | Licença em fonte primária. É o único candidato do inventário com zero marcadores de contexto **e** operador de bake explícito (`goophys.bake_physics`) — se a licença aparecer em fonte primária, sobe para faixa 1 |

### 6.4 Matriz — faixa 3: descartados

| Candidato | Motivo do descarte | Reavaliar se |
|---|---|---|
| Cloth NeXt 2.4.0 | CUDA obrigatório; `.exe` Windows; `socket` + `urlopen` + `Popen`; download externo de ~448 MB | hardware NVIDIA |
| Motion2MixamoRig 0.1.8 | CUDA; pesos SMPL-X não comerciais; YOLOv8 AGPL | nunca para produto comercial |
| Dream Textures | GPU/VRAM; RX 580 sem ROCm documentado | hardware diferente |
| HairDeck | NVIDIA Ampere+ | hardware diferente |
| Auto Unwrap | `.exe` + `Popen` + `draw_handler_add` + sem licença | licença + auditoria do binário |
| Seamless CAD | 6 variantes, `.exe/.dll/.pyd`, `socket`, sem licença | nunca sem auditoria de binário |
| **robust-weight-transfer** | GPL-3.0 (não MIT), e **instala dependências via `pip --break-system-packages` dentro do Blender** | nunca — viola §8.4 por construção |
| Principled Baker | licença não verificada; add-on legado `bl_info` de 2020; sem manifesto | licença + teste |
| Keemap Retargeting | GPL-3.0 (não MIT); último commit 2023-02-27 | substituído por #9 (Animation Retargeting, Mwni) |
| SUPERTABs, Car_Rig | irrelevantes / não é add-on Blender | nunca |
| Sanctus-Library, Stylized Asset Suite, Professional Hair Suite, RLX Auto Fit, Magic Bone UE5, Auto-Rig Pro (+Tools, +Quick Rig), PaletteGrid, Proxy Picker, Onion Skinning, SpeedSculpt, Dovetail Key, Projection Modeling, TrueSKY, Wiggle Bone (namespace próprio) | `MANUAL` / `REFERENCE` / direitos mistos / sem etapa correspondente no Bridge | caso a caso, como handoff |

---

## 7. Capacidades: o que aproveitar e o que a Lia Forge precisa construir

### 7.1 Aproveitável de terceiros — com a ressalva de cada caso

| Capacidade | Origem | O que exatamente se aproveita | Ressalva |
|---|---|---|---|
| Aplicar modificador preservando shape keys | SKkeeper | O algoritmo (copiar objeto por shape key, aplicar, reanexar, retargetar drivers) | Copyleft; a Lia Forge **não** reimplementa o código, apenas invoca |
| Secondary motion de ossos | Wiggle Bones / Wiggle 2 | Spring bones → keyframes | Não determinístico sem medição; escolher **uma** das duas, por versão de Blender |
| Bake de soft-body para shape keys | SquishyFX 3.3.0 | Pipeline shape key → morph target GLB | Duas linhagens incompatíveis |
| Export GLB com morph e skin | `glTF-Blender-IO` (embutido) | O caminho de saída padrão | Já é parte do Blender; `export_apply=True` impede morph targets — armadilha documentada |
| Export VRM | VRM format | Saída para consumidor VRM | Sem validador na Forge hoje |
| Converter MMD → Blender | MMD Tools | Ingestão de formato japonês | Sem validador; direitos do modelo são do usuário |
| Humanoides paramétricos | MPFB | Base + rig + morphs | Banco de personagens com licença por item; CC0 é dos *assets core* |
| Retarget de animação | Animation Retargeting (Mwni) | Transferência de pose/ação entre rigs | GPL-3.0; precisa de `blender_version_min = 4.4` |
| UV automático | xatlas (lib) / `bpy.ops.uv.smart_project` (nativo) | Packing por biblioteca C | **Preferir o nativo do Blender** para o pipeline e tratar xatlas como opção do usuário: o wrapper tem `Popen` com `shell=True` |

### 7.2 A construir pela Lia Forge

Estas capacidades **não** devem vir de terceiros: são o que faz o produto ser o produto, e nenhuma delas existe em add-on do inventário.

| # | Capacidade própria | Por quê não terceirizar | Estado |
|---|---|---|---|
| P1 | **Perfil de exportação declarado** — dizer, por artefato, o que foi bakeado, simplificado ou omitido (GN, controladores, shaders do Blender) | Nenhum add-on produz esse registro, e sem ele o GLB mente sobre o que contém | `PLANNED` |
| P2 | **Validador de morph targets no GLB** (critério de aceite §11.1 do Bridge, hoje não avaliável) | É critério de aceite do próprio Bridge | `PLANNED` — corrige lacuna do T13 |
| P3 | **Preflight de aptidão de add-ons** (§5.2) | Depende do contrato da Forge, não do add-on | `PLANNED` |
| P4 | **Registro de proveniência por job**: família, SHA-256 do pacote, versão declarada, versão do Blender, perfil usado | Nenhum add-on reporta isso; a auditoria local prova que versão declarada ≠ versão empacotada | `PLANNED` |
| P5 | **Fixture própria de rig/malha/morph** com direitos limpos | Não existe fixture com direitos verificados no inventário (§3.3) | `PLANNED` — pré-requisito de toda PoC |
| P6 | **Matriz de compatibilidade medida** (Blender × add-on × SHA) | Só existe matriz *declarada*; 37/38 não declaram máximo | `PLANNED` |
| P7 | **Política de dependência em runtime** (proibir `pip`/rede no processo Blender) | Um add-on do inventário faz isso (`robust-weight-transfer`) | `PROPOSED` (§8.4) |
| P8 | **Normalização de unidades/eixos na fronteira GLB** — Y-up, escala, hierarquia | É contrato da Forge com o Three.js, não do Blender | `PLANNED` |
| P9 | **Naming e ownership de objeto** — o Bridge decide nomes de receptor/duplicata, não o add-on | SKkeeper cria `shapekey_receiver` e `*_shapekey_1`; colide em lote | `PLANNED` |
| P10 | **Validador de VRM/VRMA** | Para #5 sair de `PROPOSED` | `PLANNED` |

### 7.3 O que permanece no Blender e não deve migrar

| Fica no Blender | Motivo |
|---|---|
| Retopologia, sculpt, modelagem por projeção/dovetail | Ferramenta de julgamento visual com entrada de mouse |
| Hair grooming e card placement | Precisa de decisão estética contínua |
| Pintura e organização de material | Idem; `Ucupaint`/`PaletteGrid` são `MANUAL` |
| Rigging fino e posem de controle | BlenRig/ARP: o auto-rig é ponto de partida, o ajuste é o trabalho |
| Simulação com cache interativo | Cloth/fluidos com iteração visual |
| Configuração de simuladores e criação de cages | O Bridge **recebe** o resultado, não configura o rig |
| Toda decisão de qualidade visual | Nenhum validador estrutural substitui olho humano |

O critério é o mesmo de §5.4, não a categoria do add-on.

---

## 8. Segurança e isolamento

### 8.1 Modelo de ameaça por camada

| Camada | Ameaça concreta | Evidência | Mitigação |
|---|---|---|---|
| L1 código Python | `register()` executa código arbitrário no import; `@persistent` handler roda a cada frame; `bpy.app.timers` executa em background | 31/38 famílias com marcadores de handler/timer | Habilitar **só** add-on auditado. A ordem de habilitação é a de §5.2 (operador com nome qualificado, `--addons` como fallback); nenhuma das duas vias é sandbox — ambas executam `register()` no processo |
| L1 código Python | `register()` fazendo rede | `Bloom Agent` (`urlopen`), `Cloth NeXt`, `Retargeting`, `TrueSKY` | `--offline-mode` + proibir rede no spawn |
| L2 dados de cena | `.blend` com `Text` Python e drivers com script | 61/506 com script text; 31/506 com driver com script | `--disable-autoexec` **e** `bpy.app.autoexec_fail = True`; nunca abrir `.blend` do inventário como entrada de job de produção |
| L3 binário nativo | Código não auditável, telemetria, escrita fora do tempdir | VHD (`vhd.exe` + `vhd`, licença do wrapper não localizada), SpringFX (`.dll/.so/.dylib` próprios), Seamless CAD (6 variantes com `.exe/.dll/.pyd`) | Bloqueado (§6.3 #11, §6.4) |
| L3 binário nativo | **Injeção de argumento por shell concatenado** | xatlas: `subprocess.Popen(r'"<path>" ' + arguments_string, shell=True)`; `chmod u+x` via `shell=True` | Nunca chamar o CLI do add-on; se necessário, chamar o binário direto com `spawn` sem shell |
| L4 wheel | Dependência com licença própria, ABI por versão de Python | MMD Tools 1 wheel, TrueSKY 5 wheels; **5.1 mudou Python 3.11 → 3.13** | Registrar wheel na proveniência; testar por versão de Blender |
| L5 pip em runtime | Instala pacote arbitrário, sem pin de provenance, escreve em `PYTHONUSERBASE` | `robust-weight-transfer` `wm.install_rwt_dependencies` | **Proibido** (§8.4) |
| L6 asset/arte | Direitos não verificados; IP de terceiro | Genshin Shader (miHoYo), Bodiez, CharMorph/MB-Lab (AGPL no banco) | Nunca redistribuir; não usar como fixture |
| L7 próprio | Path traversal em output; symlink | `workflow-runner.cjs` já valida `isInside` e recusa symlink (lido) | Manter; estender a temporários do job |
| Processo | `SIGTERM` no Blender não alcança `Popen` aninhado | 12 famílias com `Popen`; o Bridge §9 já reconhece a limitação | Ver §8.5 |

### 8.2 Rede: o que a documentação oficial garante e o que não garante

- `bpy.app.online_access` é **somente leitura** e reflete a preferência; `--offline-mode`/`--online-mode` a sobrepõem ([4.2 release notes](https://developer.blender.org/docs/release_notes/4.2/python_api/), [Command Line Arguments](https://docs.blender.org/manual/en/dev/advanced/command_line/arguments.html)).
- A própria documentação diz: "Add-ons that follow this setting will only connect to the internet if enabled. **However, Blender cannot prevent third-party add-ons from violating this rule.**" ([Add-ons — Internet Access](https://docs.blender.org/manual/en/latest/advanced/extensions/addons.html)).
- As `[permissions]` do manifesto (`files`, `network`, `clipboard`, `camera`, `microphone`) são **declaração para o usuário**, não sandbox. Não há confinamento aplicado pelo Blender.

**Consequência prática:** `--offline-mode` é uma **convenção voluntária**, não um controle. O único controle efetivo é de processo/SO (§8.5). Além disso, a extração de manifestos da auditoria local registra `id`, `version`, `blender_version_min`, `blender_version_max`, `license` e `quantidade_wheels` — **não registra o bloco `[permissions]`**. Para as 10 famílias com marcador de rede, portanto, não existe hoje nem a declaração de permissão nem a verificação de que ela corresponde ao código. Um teste de coerência manifesto × código (como o que projetos de terceiros já adotam) é item novo de §11.4.

### 8.3 Isolamento mínimo por job

| Controle | Implementação | Verificável por |
|---|---|---|
| Diretório de trabalho por job | `os.tempdir/lia-forge-<jobId>/`, removido no fim | `EXECUTED` no teste |
| Entrada em cópia somente-leitura | nunca abrir o `.blend` do usuário; copiar para o tempdir e abrir a cópia | hash do original inalterado |
| Perfil Blender dedicado | `BLENDER_USER_CONFIG`/`BLENDER_USER_EXTENSIONS` no tempdir | preferências do usuário intactas |
| Sem rede | `--offline-mode` **+** regra de firewall/host do SO no processo filho | tentativa de conexão falha |
| Sem autoexec | `--disable-autoexec` + `autoexec_fail = True` | script embutido não roda |
| Sem save de preferências | bloqueio de `save_userpref` no script do Bridge | `userpref.blend` com mtime anterior |
| Limite de recurso | timeout, `SIGTERM` → `SIGKILL` no **grupo** de processos, teto de RAM declarado | órfãos ausentes após cancelamento |
| Saída validada antes de promover | `inspectGlb` + validador de formato | arquivo rejeitado não entra no Asset Manager |

### 8.4 Política de dependências (P7 detalhada)

1. O Bridge **nunca** executa `pip`, `ensurepip`, `conda` nem qualquer instalador.
2. Add-on que instala dependência em `register()` ou em operador é **excluído** do escopo (`robust-weight-transfer` já é exclusão).
3. Wheel empacotada no add-on não é instalada pelo Bridge; é aceita apenas como parte do pacote do usuário, e é registrada na proveniência com SHA-256.
4. Se um add-on exigir um pacote que não está no `sys.path` do Blender, o job falha com `ADDON_DEPENDENCY_MISSING` e o Bridge **não** tenta resolver.

### 8.5 Isolamento de processo: o que o Electron não consegue sozinho

`child.kill('SIGTERM')` no Windows termina o processo Blender, mas não a árvore de subprocessos que o add-on criou. Como `spawnBlender` usa `shell: false` hoje (lido em `electron/blender-adapter.cjs`), a árvore é a do Blender; os netos ficam órfãos.

| Opção | Custo | Efeito |
|---|---|---|
| Job object do Windows / process group | Implementação específica de plataforma | Mata a árvore |
| Rejeitar add-ons com `Popen` no caminho do job | Custa 12 famílias, incluindo xatlas e VHD | Reduz o escopo, mas de forma honesta |
| Container / VM por job | Inviável no alvo (Windows + RX 580 + 16 GB) | — |

Recomendação: **rejeitar `Popen` no caminho crítico** nesta fase, e tratar job object como `PLANNED` para quando houver add-on que realmente precise. Isso não é conservadorismo: 3 das 4 capabilities mais valiosas (SKkeeper, Wiggle Bones, SquishyFX 3.3.0) **não** têm `Popen`.

---

## 9. Bloqueios e decisões pendentes

### 9.1 Bloqueios

| # | Bloqueio | Tipo | Afeta | Quem decide |
|---|---|---|---|---|
| B1 | Nenhuma fixture com direitos verificados | técnico + jurídico | toda PoC | produto + jurídico |
| B2 | Licença de Bodiez, Genshin Shader, Dovetail Key, Projection Modeling, Voxel Heat Diffuse, Auto Unwrap, Seamless CAD, Professional Hair Suite, RLX, Sanctus, Stylized, SUPERTABs, CTools Braids, Wiggle Bone, Magic Bone UE5, Goo Physics, Principled Baker, SpringFX não verificada | jurídico | 18 famílias | jurídico |
| B3 | Licença de redistribuição dos binários `vhd.exe`/`vhd` | jurídico | VHD | autor + jurídico |
| B4 | `bl_ext.<repo>.<pkg>` não determinístico sem perfil provisionado | arquitetural | todo job com extensão | arquitetura (§5.2) |
| B5 | `glb.mjs` não lê morph targets | lacuna de implementação | critério de aceite do Bridge | engenharia |
| B6 | Determinância de física (`frame_change_pre`) não medida | técnico | Wiggle, Goo, SquishyFX, JiggleGen | PoC-1 |
| B7 | 53 pacotes locais com listagem parcial/timeout; 17 volumes RAR numerados | dados | cobertura da auditoria local | auditoria |
| B8 | Divergência manifesto × `bl_info` em HairCard Studio (1.0.0 interno em 3 embalagens), SpringFX (8.2.4 vs 8.2.3), Dovetail Key (4.2 vs 3.0), JiggleGen (3.2.0 declarado, API 4.x usada) | dados | pin de versão | auditoria |
| B9 | Nenhum `blender_version_max` em 37/38 famílias | dados | risco de instalação silenciosa | política (§5.2) |
| B10 | O ambiente de referência já falhou em ler `.blend` em background sem causa isolada | técnico | confiabilidade do Bridge | PoC-1, medida M9 |

### 9.2 Decisões pendentes

| # | Decisão | Alternativas | Recomendação |
|---|---|---|---|
| D1 | Distribuir add-ons ou não | (A) não distribuir, consumir instalação do usuário; (B) provisionar perfil próprio com pacotes fixados | **A** (§4.2) |
| D2 | Aceitar binário fechado no produto | sim/não | **não** nesta fase |
| D3 | Perfil Blender usado por job | temporário / perfil do usuário / provisionado | **temporário derivado da instalação do usuário**, com os add-ons copiados por hash |
| D4 | Versões de Blender suportadas | 4.2 LTS / 4.5 LTS / 5.2 LTS | **4.5 LTS primário, 5.2 LTS secundário**. 4.2 LTS saiu de suporte em jul/2026; 5.3 é release regular de nov/2026 — não ancorar em 5.3 |
| D5 | Qual das duas linhagens de SquishyFX | 3.3.0 (legado, 7 fontes) / 3.40.0 (manifesto, 17 fontes, UI) | **3.3.0** para a PoC (menor superfície); 3.40.0 depois, como alvo de produto |
| D6 | Wiggle 2 ou Wiggle Bones | 2.2.3 (GPL-3.0, último release 2023) / 1.1.2 (GPL-3.0, 2026) | **Wiggle Bones 1.1.2** — `blender_version_min = 4.5.0`, alinhado a D4 |
| D7 | Aceitar add-on que exige `pip` | sim/não | **não** (§8.4) |
| D8 | Redistribuir template/arte do inventário | sim/não | **não** sem licença por item |

---

## 10. Recomendação única de próxima prova de conceito

> **PoC-1 — "Wiggle Bones 1.1.2 em Blender 4.5 LTS: habilitação determinística e bake reproduzível com fixture própria."**

### 10.1 Por que esta, e não outra

| Critério | Wiggle Bones 1.1.2 |
|---|---|
| Licença verificada por fonte primária | `GPL-3.0-or-later` no manifesto **e** GPLv3 no `LICENSE` do repositório |
| Forma de habilitação conhecida | `EXT`, `id = "wiggle_bones"`, `blender_version_min = "4.5.0"` → módulo `bl_ext.<repo>.wiggle_bones` |
| Arquivo pequeno e inspecionável | release `wiggle_bones-1.1.2.zip`, **27.628 bytes**, SHA-256 `9f58389c7702d8a4d768fb0d8b53aebc441032363b9269c97bf5736d0561f8a0` (metadado de release, lido via API) |
| Sem binário, sem wheel, sem `.pyc` | confirmado no inventário local (6 fontes, `.pyc` ausente) |
| Sem `Popen`, sem `socket`, sem `eval` | confirmado no inventário local |
| Custo de falha baixo | adiciona keyframes a um rig de fixture; não toca arquivo do usuário |
| Exercita **todos** os riscos arquiteturais de uma vez | habilitação `bl_ext.*` (B4), determinância de `frame_change_pre` (B6), leitura de cena em background (B10), validação de saída (B5) |

Nenhum outro candidato cobre os cinco riscos com um arquivo de 27 KB e licença verificada.

#### Verificação de código feita depois da primeira redação deste documento

O código-fonte do repositório foi lido (`src/wiggle_bones/`, 6 arquivos, `EXECUTED`-leitura; tag `1.1.2` = commit `7952297b`). Isso **não** é execução — é leitura estática — mas mudou a avaliação em cinco pontos, todos verificáveis e todos relevantes para a PoC. Nenhum outro candidato da faixa 1 foi lido no código nesta profundidade.

| # | Fato lido no código | Consequência para a PoC |
|---|---|---|
| A1 | `WiggleSelect.execute()` é chamado por `WiggleBake.execute()` (linha 158: `bpy.ops.wiggle.select()`), e `WiggleSelect.poll()` retorna `context.mode in ['POSE']`. `WiggleReset.poll()` também exige `['OBJECT','POSE']`. No `--background` o modo inicial é `OBJECT` | O bake **não roda** sem que o Bridge entre em modo Pose e selecione um `active_pose_bone`. `bpy.ops.object.mode_set(mode='POSE')` funciona em background; **isto é a primeira coisa que a PoC precisa provar** (nova medida M0) |
| A2 | `bl_info` está **ausente**: só existe `blender_manifest.toml`. O módulo é `bl_ext.<repo>.wiggle_bones` | Confirma que o caminho de habilitação é o de extensão, não o legado. Um `--addons wiggle_bones` falharia |
| A3 | Zero `random`, zero `time.time`, zero `perf_counter`; todo o estado é `bpy` IDProperties (`b.wiggle.position`, `velocity`, `position_last`); a integração avança por `frames_elapsed` derivado de `scene.frame_current` | **Hipótese forte de determinância** — a física é função pura do estado persistido, não do relógio. Isso **não** é medição; M5 é quem decide. Mas muda a expectativa de "provável não determinístico" para "provável determinístico, e o risco real é o estado escondido entre execuções" |
| A4 | `wiggle_pre` sai cedo com `if scene.wiggle.lastframe == scene.frame_current`. O bake faz `frame_set` do **preroll** para trás (`frame_start - preroll - 1`), o que é negado pela convenção do Blender e **pode** ser a origem de comportamento dependente de cache | Candidato nomeado para a causa de não-determinância: **preroll com frame negativo**. M5 deve rodar duas variantes — `preroll = 0` e `preroll > 0` |
| A5 | `wiggle_ui.py` (340 linhas) existe e é importado por `__init__.py`, mas o inventário local registra `contexto = ["handlers"]` e `fontes_lidas = 6` | Os dois batem: o painel declara `VIEW_3D`/`UI` mas isso não é "uso de contexto no caminho de bake". É a evidência de que o marcador do inventário **subestima** UI, mas **acerta** o risco de bake — que é a distinção que §5.4 faz |


### 10.2 O que a PoC deve medir (não é "funcionou?")

| # | Medida | Método | Critério de aprovação |
|---|---|---|---|
| **M0** | **Modo Pose em `--background`** | carregar a fixture, `object.mode_set(mode='POSE')`, marcar ossos, chamar `wiggle.select` e `wiggle.bake`; registrar `poll()` de cada um | ambos retornam `FINISHED`; se `poll()` falhar, o bake é **impossível** por essa via e a PoC precisa do caminho alternativo (chamar `nla.bake` direto, sem os operadores do add-on) |
| M1 | Habilitação determinística | 10 execuções do mesmo comando; registrar se `addon_utils.check()` retorna `loaded_state = True` | 10/10 |
| M2 | Independência de perfil | rodar 1× com `BLENDER_USER_CONFIG` temporário e 1× com perfil do usuário; comparar `env` e módulo resolvido | mesmo módulo, mesmo resultado; `userpref.blend` do usuário com mtime inalterado |
| M3 | Não-destrutividade do ambiente | hash de `userpref.blend`, `startup.blend` e pasta de extensões antes/depois | inalterados |
| M4 | Bake produz chaves | contar F-Curves/keyframes antes e depois; contar ossos afetados | > 0 e apenas nos ossos configurados |
| M5 | **Determinância** | 2 execuções idênticas **com `preroll = 0`**, 2 com **`preroll > 0`** (A4); comparar SHA-256 do GLB e, se diferir, comparar por métrica (nº de keyframes, soma de rotações, posições por frame com tolerância declarada) | declarar `determinístico` / `reproduzível por métrica` / `não reproduzível` — **qualquer** dos três é resultado válido; o insucesso é não medir. Se `preroll = 0` for determinístico e `preroll > 0` não, a causa está identificada |
| M6 | Export GLB com skin + animação | `inspectGlb()` | `skinned = true`, `animationCount ≥ 1`, `triangleCount > 0` |
| M7 | Lacuna de morph target | tentar aplicar o critério de aceite do Bridge §11.1 | comprovar que **não é avaliável hoje** (B5) e registrar como lacuna confirmada |
| M8 | Cancelamento | abortar no meio do bake | processo e netos ausentes em ≤ 5 s; sem arquivo parcial promovido |
| M9 | Cena em background | abrir a fixture e reportar `bpy.data` após load | reproduzir ou refutar B10 |

### 10.3 Fixture e escopo

- Fixture **construída pela Lia Forge** (P5): `.blend` com um rig de 3 ossos encadeados, uma malha com skin, duas shape keys nomeadas, materiais PBR simples, e **zero** `Text` e **zero** driver com script. Nenhum asset do inventário.
- Execução em **Windows**, Blender **4.5 LTS** (e uma repetição em **5.2 LTS** para medir D4).
- O rig precisa estar **inscrito na lista do add-on** (`scene.wiggle.list`) sem UI, por escrita de `IDProperty` a partir do script do Bridge — mais um risco de acoplamento a propriedade privada do add-on, e parte do que a PoC mede.
- Dois passeios de frames: `preroll = 0` e `preroll > 0` (A4).
- Um job, uma capability (`model3d.bake-spring-bones` — nome `PROPOSED`, não registrado), saída GLB + manifesto de proveniência.
- Sem instalar nada além do pacote de release, por conferência manual do SHA-256 contra o metadado da release. **Nota:** o SHA-256 disponível por metadado é o do *asset* de release (`9f58389c…`, 27.628 bytes); o do pacote que está na máquina do usuário é outro (`0afa2399…`) e são coisas diferentes — não comparar um com o outro sem antes estabelecer que o asset e a cópia local são o mesmo arquivo.

### 10.4 O que a PoC **não** decide

Não decide redistribuição, não valida qualidade visual, não valida RX 580 (não há GPU nesse caminho), não registra capability, não autoriza código de produção.

### 10.5 Sequência depois da PoC-1

| Ordem | PoC | Depende de |
|---|---|---|
| 2 | **PoC-2 — SKkeeper**, mesmo rig + Subdivision Surface, medir preservação de shape keys por contagem e por delta de vértice | mesma fixture de PoC-1 |
| 3 | **PoC-3 — SquishyFX 3.3.0**, bake → shape keys → GLB morph; roda **depois** de B5 corrigido, senão não há como validar | B5 |
| 4 | **PoC-4 — determinância de física**: repetir PoC-1 com 3 presets e medir variância | M5 de PoC-1 |
| 5 | Preflight (P3) como código, alimentado pelos achados de M1–M3 | PoC-1 |

Uma PoC por vez. Nenhuma delas começa antes da anterior publicar resultado.

---

## 11. Testes futuros necessários

Organizados por finalidade, não por add-on.

### 11.1 Testes de plataforma (bloqueiam todo o resto)

| # | Teste | Critério |
|---|---|---|
| T1 | Habilitação de extensão por `bl_ext.<repo>.<pkg>` em `--background`, com e sem `--factory-startup` | reproduzir §5.2 com evidência; escolher o modo de spawn definitivo |
| T2 | `--addons` em repositório desabilitado | registrar a falha e a mensagem exata para o código de erro |
| T3 | Integridade de `userpref.blend` após job | mtime + SHA-256 inalterados |
| T4 | `--offline-mode` contra add-on com `urlopen` | conexão falha; job reporta `NETWORK_BLOCKED` |
| T5 | `.blend` com `Text` Python e driver com script, com `--disable-autoexec` | script não executa |
| T6 | Cancelamento com subprocesso aninhado | comportamento documentado (esperado: órfão) e decisão de §8.5 |

### 11.2 Testes de formato e validação

| # | Teste | Critério |
|---|---|---|
| T7 | `inspectGlb` sobre GLB com N morph targets | hoje falha por ausência de campo; serve de teste de regressão para P2 |
| T8 | GLB com `export_apply = True` em malha com shape keys | confirmar perda de morph targets; virar erro do Bridge |
| T9 | Validador de VRM/VRMA | por definir com o consumidor |
| T10 | GLB com morph + skin + animação simultâneos | todos os campos consistentes |

### 11.3 Testes por candidato (só após PoC-1)

| Candidato | Teste | Critério |
|---|---|---|
| SKkeeper | shape keys preservadas após Subdiv nível 2 | nomes, contagem e desvio máximo por vértice declarado |
| SKkeeper | malha com modificador Booleano | deve **falhar de forma limpa** (o código retorna `CANCELLED` em vertex-count mismatch) |
| SquishyFX 3.3.0 | bake em 24 frames | shape keys nomeadas `sk_sfx_f<n>`; GLB com morph |
| SquishyFX 3.40.0 | o mesmo | comparar com 3.3.0; registrar diferenças |
| SquishyFX | duas linhagens no mesmo Blender | conflito de namespace: confirmar que **não** podem coexistir |
| HairCard Studio | resolução de versão 1.0/1.1/1.5 | identificar por SHA qual código roda |
| VRM | export de rig humanoid | arquivo abre em consumidor VRM; declarar a versão do consumidor |
| MMD Tools | import PMX de fixture própria | hierarquia, morphs e física declarados |
| MPFB | geração com assets core CC0 | provar que o banco de personagens **não** foi tocado |

### 11.4 Testes de segurança

| # | Teste | Critério |
|---|---|---|
| S1 | `register()` de cada candidato, com rede bloqueada e monitor de FS | nenhuma escrita fora do tempdir; nenhuma conexão |
| S2 | Censo de `Popen`/`shell=True`/`eval`/`exec` no código dos candidatos aprovados | lista fechada, por SHA |
| S3 | Varredura de `urlopen`/`requests`/`socket` | idem |
| S4 | Cenas do inventário: `autoexec_fail` forçado | nenhum script executa; se executar, defeito no Bridge |
| S5 | Coerência manifesto × código: para cada candidato aprovado, cruzar `[permissions]` declarado com `import` de `urllib`/`socket`/`http`, uso de `wm.clipboard` e escrita em disco | zero divergência; divergência = bloqueio até explicação |
| S6 | Presença e origem de `.pyc` nos pacotes aprovados | `.pyc` só quando o `.py` correspondente existe no mesmo pacote e tem hash registrado |

---

## 12. Evidências, fontes e limitações

### 12.1 Evidência local (arquivos do repositório)

| Evidência | Arquivo | O que foi lido |
|---|---|---|
| 38 famílias, versões, manifestos, `bl_info`, operadores, imports, contexto, binários | `docs/auditoria-blender-local/ADDONS.json` | integral, por script de extração |
| 506 hashes de `.blend` com classe e marcadores | `BLENDS.json` | agregados por classe, `script_text_candidates`, `scripted_drivers`, versões de arquivo |
| 651 entradas de inventário, 2386 hashes de membros | `INVENTARIO.json`, `FONTES-SHA256.json` | agregados por tipo |
| Contagens de escopo | `CONTAGENS.json` | integral |
| Licenças por família e notas de dependência | `LICENCAS-E-DEPENDENCIAS.md` | integral |
| Classes de cena e projetos | `PROJETOS-BLENDER.md` | integral |

Números derivados que **não** estão nos documentos originais e que este documento introduz (calculados por script sobre os JSON):

- 31/38 famílias com marcador de UI/contexto; 5/38 sem marcador algum.
- 12/38 com `Popen`/`subprocess`; 9/38 com `eval`/`exec`; 10/38 com marcador de rede.
- 7/38 com binário nativo ou wheel.
- 5/38 empacotando `.pyc`.
- 17/38 com manifesto **e** `bl_info` simultâneos; 23/38 com manifesto; 32/38 com `bl_info`.
- 1/38 declarando `blender_version_max` (VRM format, `5.3.0`).
- 60 entradas de versão para 38 famílias.
- 61/506 hashes de `.blend` com candidato a script text; 31/506 com driver com script.
- Versões de arquivo `.blend` entre `281` e `502`; compressão `zstd` em 383/506.

### 12.2 Fontes upstream consultadas

**Documentação oficial do Blender:**

- [Command Line Arguments (5.4 dev)](https://docs.blender.org/manual/en/dev/advanced/command_line/arguments.html) — `--background`, `--factory-startup`, `--addons`, `--disable-autoexec`, `--python-exit-code`, `--python-use-system-env`, `--online-mode`/`--offline-mode`, variáveis `BLENDER_USER_CONFIG`, `BLENDER_USER_EXTENSIONS`, `BLENDER_SYSTEM_EXTENSIONS`.
- [Add-ons (Extensions)](https://docs.blender.org/manual/en/latest/advanced/extensions/addons.html) — namespace `bl_ext.{repository_module_name}.{addon}`, `bpy.app.online_access`, limitação explícita "Blender cannot prevent third-party add-ons from violating this rule", requisito de auto-contensão.
- [How to Create Extensions](https://docs.blender.org/manual/en/latest/advanced/extensions/getting_started.html) — `blender_manifest.toml`, `license = ["SPDX:..."]`, `[permissions]` (`files`, `network`, `clipboard`, `camera`, `microphone`), `wheels`.
- [Extensions Operators](https://docs.blender.org/api/current/bpy.ops.extensions.html) — `package_install`, `package_install_files`, `package_disable`, `repo_sync`, `userpref_allow_online`.
- [Preferences Operators](https://docs.blender.org/api/current/bpy.ops.preferences.html) — `addon_enable(module=...)`, `addon_install`, `addon_refresh`.
- [Utilities (bpy.utils)](https://docs.blender.org/api/current/bpy.utils.html) — `extension_path_user`, `register_cli_command`.
- [PreferencesExtensions](https://docs.blender.org/api/current/bpy.types.PreferencesExtensions.html) — `repos` (coleção `UserExtensionRepo`).
- [Python API — Blender 5.0](https://developer.blender.org/docs/release_notes/5.0/python_api/) — remoção do acesso tipo `dict` a `bpy.props`; remoção de BGL; módulos empacotados tornados privados.
- [Python API — Blender 4.2 LTS](https://developer.blender.org/docs/release_notes/4.2/python_api/) — novo empacotamento por manifesto; `bpy.app.online_access`; `extension_path_user`; IDProperties tipados estaticamente.
- [Blender is Free Software (code.blender.org)](https://code.blender.org/2019/06/blender-is-free-software/) — posição da Blender Foundation sobre add-on Python como obra derivada de código GPL.
- [Extensions ToS](https://extensions.blender.org/terms-of-service/) e [Moderation Guidelines](https://developer.blender.org/docs/features/extensions/moderation/guidelines/) — expectativa de checagem de `bpy.app.online_access`; advertência de que permissões são declaração, não sandbox.
- [Blender issue #125406](https://projects.blender.org/blender/blender/issues/125406) — `--addons bl_ext.<repo>.<pkg>` falha com repositório desabilitado.
- [Blender issue #129884](https://projects.blender.org/blender/blender/issues/129884) — `package_install_files` e mensagens `Add-on not loaded: "bl_ext.user_default.…"`.

**Repositórios (API do GitHub, `gh api`, leitura de metadados / `LICENSE` / manifesto / árvore):**

`smokejohn/SKkeeper` (v1.8.2; `blender_manifest.toml`; `__init__.py` 574 linhas lidas; release asset 5.422 bytes, digest `sha256:a2f9025e…`) · `Hans-xwh/wiggle-bones` (tag `1.1.2` = `7952297b`; `blender_manifest.toml` + **6 fontes lidos integralmente**: `__init__` 30, `properties` 528, `operators` 309, `wiggle_ui` 340, `physics_engine` 594, `wiggle_core` 86 linhas; zero `random`/`time.time`; `LICENSE` GPL-3.0; release asset 27.628 bytes, digest `sha256:9f58389c…`) · `shteeve3d/blender-wiggle-2` (GPL-3.0; `wiggle_2.py` único fonte; último release v2.2.3 de 2023) · `makehumancommunity/mpfb2` (`LICENSE.CODE.md` GPL-3.0; `LICENSE.ASSETS.md` CC0) · `saturday06/VRM-Addon-for-Blender` (manifesto 4.10.5: `SPDX:MIT` **e** `SPDX:GPL-3.0-or-later`, `blender_version_max = "5.4.0"`, `[permissions] files`) · `MMD-Blender/blender_mmd_tools` (manifesto 4.5.14, GPL-3.0-or-later, 1 wheel `opencc_python_reimplemented`) · `KhronosGroup/glTF-Blender-IO` (Apache-2.0) · `mattedicksoncom/blender-xatlas` (sem LICENSE; add-on GPL-3.0+; `__init__.py` 885 linhas lidas) · `jpcy/xatlas` (MIT) · `Mwni/blender-animation-retargeting` (manifesto 2.4.0, GPL-3.0-or-later, `blender_version_min = 4.4.0`) · `nkeeline/Keemap-Blender-Rig-ReTargeting-Addon` (GPLv3; último commit 2023-02-27) · `Upliner/CharMorph` (`license.txt`: código GPL-3.0+, banco AGPL-3.0) · `SavMartin/TexTools-Blender` (GPL-3.0+ em `LICENSE.txt`; `bl_info` 1.6.2, Blender 2.80) · `CGCookie/retopoflow` (manifesto 3.4.11: `SPDX:GPL-2.0-or-later`; `RetopoFlow.LICENSE`: GPL-3.0+ para código, assets não-código reservados) · `danielenger/Principled-Baker` (sem LICENSE; `bl_info` 0.5.7) · `sentfromspacevr/robust-weight-transfer` (GPLv3; `pip install --break-system-packages`) · `bnpr/Malt` (MIT) · `nutti/Magic-UV` (GPL-2.0-or-later) · `ucupumar/ucupaint` (GPL-3.0) · `jpbouza/BlenRig` (GPL-3.0) · `rlguy/Blender-FLIP-Fluids` (GPL-3.0) · `Oxicid/UniV`, `mio3io/mio3_uv` (GPL-3.0) · `carson-katri/dream-textures` (GPL-3.0) · `aresdevo/animaide`, `Pauan/blender-rigid-body-bones` (sem licença detectada pelo GitHub).

**Código do próprio projeto (T13, branch `arena/649f88bd-3dspritesheet`, refs publicadas):**
`electron/blender-adapter.cjs` (180 linhas) · `electron/adapters/blender-spritesheet.mjs` · `electron/blender-workflow-plan.cjs` · `electron/workflow-runner.cjs` (1.250 linhas, `validateGlb` lido) · `shared/model3d/glb.mjs` (159 linhas, integral) · `shared/capabilities/registry.mjs` (215 linhas; 49 capabilities) · `shared/hub/provider-hub.mjs` (222 linhas) · `shared/adapters/sdk.mjs` (464 linhas; `evaluateCompatibility`, `evidence`) · `scripts/blender_spritesheet.py` (323 linhas) · `package.json` · `THIRD_PARTY_NOTICES.md`.

> **Nota de escopo:** a leitura do T13 usa refs publicadas no GitHub, não o checkout local desta branch. Nesta branch `main`-based **não existe** `electron/`, `shared/`, `scripts/` nem `tests/` — apenas `docs/`. Portanto nenhuma afirmação deste documento sobre o Bridge é `IMPLEMENTED` **no branch atual**; são `IMPLEMENTED` no T13 e `PROPOSED` para integração aqui.

### 12.3 Limitações desta avaliação

| # | Limitação | Efeito |
|---|---|---|
| L1 | **Nenhum add-on foi instalado, habilitado ou executado.** Toda afirmação de headless é `PLAUSÍVEL` ou `INCERTO`, nunca `VALIDATED`. A única leitura de código-fonte de candidato (§10.1, A1–A5) é estática | Nenhuma capability pode ser registrada |
| L2 | **Nenhum Blender foi aberto.** A §5.2 é inferência de documentação + relatos de issue, não experimento | T1 é obrigatório antes de qualquer código |
| L3 | **Os arquivos do usuário não estão nesta sessão.** Não foi possível conferir SHA-256 local × release. Os hashes citados são do inventário local (auditoria anterior) ou do metadado de release (API) — **nunca de uma comparação entre os dois** | A correspondência pacote local ↔ upstream é `PROPOSED`, não `VALIDATED`. É exatamente o que B8 registra |
| L4 | Rede da sessão: `release-assets.githubusercontent.com`, `raw.githubusercontent.com` e `docs.blender.org` recusaram conexão direta; o acesso a conteúdo funcionou por ferramentas de busca/leitura e pela API do GitHub (`gh api`). Um download de release chegou a completar por redirecionamento e **não foi usado como evidência** | Nenhuma verificação por download é citada |
| L5 | A auditoria local tem 53 pacotes com listagem parcial ou falha e 17 volumes RAR numerados | Cobertura incompleta; conclusões sobre famílias presentes apenas em pacote parcial são frágeis |
| L6 | Stars do GitHub **não** foram usadas como evidência de qualidade | — |
| L7 | Nenhuma medição de desempenho foi feita; não há número de tempo neste documento | — |
| L8 | Nenhuma análise jurídica. As leituras de licença são leitura de texto, não parecer | D1–D8 exigem revisão jurídica |
| L9 | A matriz da §6 é `PROPOSED`; os nomes de capability em §10.3 são `PROPOSED` e **não** foram registrados no `registry.mjs` | — |
| L10 | A §3.2 extrai marcadores por regex/agregação sobre os campos do JSON; "marcador ausente" significa "não apareceu na extração", não "não existe no código" | Um falso negativo de marcador é possível. A verificação definitiva é S2, sobre o código, por SHA |
| L11 | **Só um candidato da faixa 1 teve o código lido.** Os outros oito têm perfil derivado do inventário e do manifesto, não de leitura do fonte. As §§6 e 10 valem por igual para eles apenas em licença e versão | Não estender a avaliação de Wiggle Bones (A1–A5) aos demais candidatos. Ela é específica daquele código |
| L12 | Não foi medido se `bpy.ops.object.mode_set(mode='POSE')` funciona em `--background` sem área/override (M0) | É o **primeiro** item da PoC, não uma suposição. Se falhar, a conclusão de §10 muda |

---

## 13. O que este documento não faz

- Não instala, habilita, executa, integra ou redistribui add-on, binário, wheel, asset ou cena.
- Não abre nem modifica cena original.
- Não altera código, contrato, registry ou configuração.
- Não promove nada a `IMPLEMENTED`, `EXECUTED` ou `VALIDATED`.
- Não cria capability no registry.
- Não substitui `ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md`, `BLENDER-ADDONS-MATRICES.md` nem o `auditoria-blender-local/` — corrige pontos específicos e marca cada correção (§2).
- Não substitui a especificação do Bridge; propõe substituir as seções §3.2, §6.1, §6.2, §6.3, §12 e §14 dela.
- Não decide licença, redistribuição, direitos de marca ou de arte.
