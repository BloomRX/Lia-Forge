# Avaliação de ferramentas externas para integração — Lia Forge

- **Data:** 2026-11-14
- **Branch:** `arena/624582f5-lia-forge`
- **Objeto:** os quatro ZIPs adicionados em `tools/` pelo commit `7fcde2b` ("External Tools")
- **Modo:** auditoria e pesquisa. Nenhuma implementação.
- **Estado deste documento:** `PROPOSED` — recomendações para decisão; nada aqui foi integrado, executado ou validado.

---

## 0. Método e limites

### 0.1 O que foi feito

- Listagem e extração dos ZIPs para um diretório temporário **fora do repositório** (`/tmp`), após conferir que nenhum caminho interno escapava da raiz (sem `../`, sem caminhos absolutos, sem links simbólicos).
- Leitura de arquivos de identificação: `README`, `LICENSE`, `THIRD_PARTY.md`, `BUILD_INFO.json`, `package.json`, lockfiles, `requirements.txt`, `AGENTS.md`, `SKILL.md`.
- Análise estática por busca dirigida: execução de processos, avaliação dinâmica de código, rede, servidores, credenciais, escrita em disco, lançadores `.bat`/`.sh`.
- Leitura integral apenas do `asset-kit` do GamejamProject (cerca de 500 linhas). Nos demais, leitura dos trechos localizados pelas buscas.
- Conferência dos `checksums.sha256` embutidos nas três distribuições Noct (apenas cálculo de hash).
- Leitura do histórico Git embutido no `GamejamProject.zip` com `git log`/`ls-tree`, depois de verificar que o `.git/config` não tinha diretivas executáveis e que não havia hooks ativos.
- Consulta ao registro público do npm **somente por nome e versão de pacotes públicos** (`three`, `playwright`, `vite` etc.), para confirmar que as versões fixadas existem. Nenhum conteúdo dos ZIPs foi enviado.

### 0.2 O que **não** foi feito

- Nenhum programa, script, teste, lançador ou instalador dos ZIPs foi executado.
- Nenhuma dependência foi instalada.
- Nenhum código foi copiado para a Lia Forge; nenhum arquivo existente do projeto foi alterado. O único arquivo criado é este relatório.
- **Não li as ~54 mil linhas linha a linha.** A análise de segurança é por busca de padrões e leitura do entorno; ausência de achado não é prova de ausência de problema.
- Não avaliei a qualidade visual dos resultados nem o comportamento em execução. Toda afirmação sobre funcionalidade é "o código e a documentação indicam", não "funciona".
- As observações sobre licenças identificam o que precisa de decisão; não são parecer jurídico.

### 0.3 Vocabulário de estado

Segue o da revisão de arquitetura: `PROPOSED`, `PLANNED`, `IMPLEMENTED`, `EXECUTED`, `VALIDATED`. Para as ferramentas externas, "IMPLEMENTED (não verificado)" significa: o código existe no ZIP e os testes do autor existem, mas nada foi executado aqui.

---

## 1. Resumo executivo

1. **São três ferramentas em quatro ZIPs.** `noct-asset-forge-v2.zip` é uma versão anterior de `noct-asset-forge-v2.5.zip` (o `BUILD_INFO.json` interno diz `1.0.0`, de 2026-10-11).
2. **Nenhuma pode ser integrada hoje, e o motivo é direito de uso, não técnica.**
   - As duas ferramentas Noct trazem uma licença proprietária que **proíbe redistribuição, inclusive "como parte de outro produto"**.
   - O GamejamProject **não tem licença nenhuma**; sem ela, o padrão legal é "todos os direitos reservados".
3. **Risco imediato, independente de integração:** o repositório `BloomRX/Lia-Forge` é **público** e os ZIPs estão publicados na branch. Para as ferramentas Noct, isso pode por si só configurar a redistribuição que a licença proíbe; a licença prevê término automático nesse caso. Precisa de confirmação com o autor ou remoção (§3).
4. **O `GamejamProject.zip` embute um diretório `.git` completo**, com nome e e-mail pessoal do autor e o histórico de um projeto de jogo anterior. Isso também está público agora.
5. **Tecnicamente, o material é melhor do que a média de código gerado com IA.** Servidores só em loopback, confinamento de caminhos com `realpath`, dependências fixadas e reais, instalação com confirmação explícita (no 3D), separação entre verificação automática e revisão visual humana.
6. **O encaixe com a Lia Forge é parcial.** As três são ambientes de "asset como código" operados por agente de programação: o agente escreve um script, a ferramenta o executa e exporta. A Lia Forge planeja pipelines governados com Blender como autoria. Nenhuma das três fala com Blender, nenhuma expõe MCP, nenhuma registra direitos ou proveniência.
7. **O que vale aproveitar são padrões, não código:** validação de GLB com o validador da Khronos como gate, visualizador Three.js com atualização ao vivo preservando a câmera, relatório de verificação com `visualReview: pending`, empacotador de atlas com JSON, verificação de `Host` contra DNS rebinding, `doctor` que pede confirmação por comando.
8. **Classificação:**

| Ferramenta | Classificação | Motivo em uma linha |
|---|---|---|
| GamejamProject — `asset-kit` | **BLOCKED** | Sem licença. Tecnicamente é a candidata mais próxima da Lia Forge. |
| GamejamProject — 8 Skills `game-*` | **RESEARCH-ONLY** | Escopo é produzir um jogo inteiro; serve de referência de estrutura de Skills. Também sem licença. |
| NoctAssetForge 2.5 (2D) | **BLOCKED** | Licença proíbe redistribuição e incorporação. |
| NoctAssetForge "v2" (build 1.0.0) | **REJECTED** | Versão superada da anterior, mesma licença. |
| NoctAssetForge3DBB 1.0.0 (3D) | **BLOCKED** | Mesma licença; Three.js r128 embutido sem aviso de terceiros; executa receitas Python sem isolamento. |

Nenhuma ferramenta recebe `RECOMMENDED` nesta etapa.

---

## 2. Inventário

| ZIP | SHA-256 (prefixo) | Tamanho | Arquivos | Conteúdo |
|---|---|---|---|---|
| `GamejamProject.zip` | `de72743f4bde` | 5,46 MB | 471 (382 em `.git/`) | 8 Skills de agente para desenvolvimento de jogos + `tools/asset-kit` + exemplo |
| `noct-asset-forge-v2.5.zip` | `016c2f170f36` | 0,75 MB | 155 | NoctAssetForge 2.5.0 — assets 2D por código (TypeScript) |
| `noct-asset-forge-v2.zip` | `b21c0efc2544` | 0,71 MB | 112 | NoctAssetForge build 1.0.0 — versão anterior do mesmo produto |
| `noct-asset-forge-3d-bb-v2.zip` | `bbf566bd35bc` | 0,98 MB | 274 | NoctAssetForge3DBB 1.0.0 — assets 3D por código (Python), formato BBModel |

Observações de empacotamento:

- O nome `noct-asset-forge-v2.zip` não corresponde ao conteúdo: `BUILD_INFO.json` declara versão `1.0.0`, commit `281a237`, construído em 2026-10-11. O `v2.5` declara `2.5.0`, commit `883da9a`, 2026-11-03.
- O 3D declara `"dirty": true` no `BUILD_INFO.json`: foi empacotado com alterações não commitadas na origem. O commit `409a7ca` não identifica exatamente o que está no ZIP.
- Os três pacotes Noct têm `checksums.sha256` e **todos os hashes conferem** com os arquivos extraídos. Isso prova consistência interna do pacote, não origem nem autoria.
- O `package.json` do 3D referencia `scripts/build_dist.py`, que não está no ZIP. A distribuição é um recorte do repositório de origem.

---

## 3. Bloqueios P0 — direitos, proveniência e exposição

Estes pontos valem **antes** de qualquer discussão técnica.

### P0-1. Licença Noct proíbe redistribuição — e os ZIPs estão num repositório público

Texto do `LICENSE` (idêntico em essência nos três pacotes Noct):

- Permite usar, executar, copiar **dentro da própria organização** e modificar, inclusive para uso comercial.
- O usuário é dono dos resultados gerados (PNG, GLB, `.bbmodel` etc.) sem restrição.
- **Proíbe redistribuir** o software, original ou modificado, definindo redistribuir como fornecer cópias a terceiros "por qualquer meio, incluindo [...] publicação, hospedagem, ou disponibilização como serviço **ou como parte de outro produto, biblioteca, ferramenta ou framework**".
- Termina automaticamente em caso de violação, com obrigação de parar de usar e apagar as cópias.
- O titular não é nomeado: "Copyright (c) 2026. All rights reserved."

Consequências:

1. `gh repo view` mostra `isPrivate: false`. Os ZIPs estão acessíveis a qualquer pessoa na branch `arena/624582f5-lia-forge`. Se não houver autorização escrita do autor para isso, a publicação pode ser a redistribuição proibida.
2. Mesmo com o repositório privado, a Lia Forge **não pode embutir, adaptar nem distribuir** código Noct. Código derivado ("modified versions") segue a mesma restrição.
3. O único uso compatível com a licença como está é: o usuário obtém a ferramenta diretamente do autor, e a Lia Forge a aciona como programa externo já instalado. Mesmo isso merece confirmação, porque a licença não trata de integração.

### P0-2. GamejamProject não tem licença

Não há `LICENSE`, nem campo `license` no `package.json` (`"private": true`), nem menção no `README`. Sem concessão explícita, nenhum direito de copiar, modificar ou redistribuir existe. Vale para o `asset-kit`, para as 8 Skills e para os arquivos de exemplo.

### P0-3. Histórico Git e dado pessoal embutidos

`GamejamProject.zip` contém `.git/` com 8 commits (de 2026-09-07 a 2026-11-02), 141 blobs distintos e cerca de 6,7 MB de conteúdo histórico. Dois pontos:

- Os commits carregam **nome de usuário e e-mail pessoal** do autor. Agora estão num repositório público.
- Os sete commits anteriores ao último são de **outro projeto** (um jogo: shaders, animação, capturas `visual_test_*.png`, `visual_assets.js`, `vfx_pipeline.js`), que o último commit removeu (107 arquivos, −10.380 linhas). Esse conteúdo não foi oferecido para avaliação, mas veio junto e está recuperável.

### P0-4. Autoria e relação entre as ferramentas não estão documentadas

O pedido fala em "outra pessoa". O GamejamProject identifica um autor pelo Git; os pacotes Noct não identificam ninguém. Não há evidência nos ZIPs de que o autor seja o mesmo. Antes de pedir licença, é preciso saber a quem pedir.

### P0-5. Componentes de terceiros sem aviso

- O visualizador do 3D embute `three.min.js` **r128** (cabeçalho "Copyright 2010-2021 Three.js Authors", MIT), `GLTFLoader.js` e `OrbitControls.js`. O `THIRD_PARTY.md` do pacote **não lista o Three.js**. A licença MIT exige manter o aviso: o cabeçalho do arquivo minificado o preserva, mas `GLTFLoader.js` e `OrbitControls.js` **não têm cabeçalho de licença**, e nenhum dos três consta da lista de terceiros.
- Os 14 PNG em `stamps/` do 2D (texturas de pincel: `oil_bristle`, `rock_pitted_*`, `wet_splatter` etc.) não têm origem declarada. Se foram baixados de terceiros, a licença Noct não pode cobri-los.
- `model-rules/hytale.md` e `minecraft-bedrock.md` descrevem restrições técnicas "inspiradas" nesses jogos. São regras de formato, não conteúdo dos jogos; o risco é baixo, mas os nomes são marcas de terceiros.

### Ações recomendadas para os P0

| # | Ação | Quem decide |
|---|---|---|
| 1 | Confirmar com o autor se há autorização escrita para manter os ZIPs neste repositório público. | Você |
| 2 | Se não houver: remover os ZIPs da branch **e do histórico** (um commit de remoção não basta, o conteúdo continua acessível pelo SHA) ou tornar o repositório privado. | Você; eu executo se autorizado |
| 3 | Em qualquer caso: substituir `GamejamProject.zip` por uma versão sem `.git/`. | Você |
| 4 | Pedir ao autor do GamejamProject uma licença explícita (MIT ou Apache-2.0 simplificam tudo). | Você |
| 5 | Pedir ao autor Noct uma permissão escrita específica, se houver interesse em algo além de referência. | Você |
| 6 | Guardar as avaliações futuras de ferramentas de terceiros fora do Git público (o `AGENTS.md` do repositório já pede cautela com conteúdo externo). | Você |

Não executei nenhuma dessas ações. A instrução foi não alterar arquivos existentes.

---

## 4. Ferramenta A — GamejamProject

### 4.1 O que é

Dois componentes independentes no mesmo repositório:

- **`.agents/skills/`** — 8 Skills em Markdown (`SKILL.md` + `references/`) para um agente de programação conduzir a criação de um jogo: `game-orchestrator`, `game-researcher`, `game-designer`, `game-design-critic`, `game-art-director`, `game-asset-kit`, `game-programmer`, `game-reviewer-qa`. O `README` cita Google Antigravity como ambiente-alvo.
- **`tools/asset-kit/`** — kit local de produção procedural de assets. O agente escreve um módulo JavaScript por asset; o kit o executa no navegador, exporta GLB ou PNG, valida e captura evidência.

### 4.2 Estrutura e tecnologia

| Item | Evidência |
|---|---|
| Linguagem | JavaScript (ESM), HTML, CSS. Sem build, sem TypeScript. |
| Tamanho | `cli.mjs` 121 linhas, `server.mjs` 82, `viewer.js` 173, `browser.js` 23, `kit.test.mjs` 95. Skills: 915 linhas em 8 `SKILL.md` + 23 arquivos de referência. |
| Dependências (fixadas exatas) | `three` 0.187.0, `manifold-3d` 3.5.4, `gltf-validator` 2.0.0-dev.3.10, `playwright` 1.64.1 (dev). |
| Lockfile | 68 pacotes, todos de `registry.npmjs.org`. Licenças: MIT 34, Apache-2.0 18, LGPL-3.0-or-later em 14 binários opcionais do `sharp`/`libvips`, ISC 1, 0BSD 1. |
| Versões | Conferidas no registro: todas existem; `three` 0.187.0 é a mais recente na data. |
| Requisitos | Node 22+, Chrome instalado ou Chromium do Playwright. |

### 4.3 Funcionalidades implementadas (não verificadas em execução)

- **Manifesto de assets** (`asset-workbench/assets.json`): `id`, `kind` (`glb`/`png`), `source`, `output`, e limites opcionais (`size`, `tolerance`, `maxTriangles`, `clips`, `transparent`). Validado na CLI: id por expressão regular, saídas duplicadas rejeitadas, caminhos confinados ao projeto.
- **Geração 3D** no navegador: Three.js (primitivas, extrusão, `BufferGeometry`), Manifold (booleanas e SDF via `levelSet`), exportação por `GLTFExporter`.
- **Geração 2D**: Canvas nativo para PNG.
- **Verificação** (`check`/`verify`): valida o GLB com o validador da Khronos; recarrega o arquivo exportado e mede triângulos, dimensões, valores finitos e clipes presentes; para PNG, tamanho, pixels visíveis e transparência; grava captura de tela e `report.json`.
- **Relatório com `visualReview: 'pending'`**: o resultado automático `passed` é explicitamente separado da aprovação visual.
- **Visualizador**: árvore de arquivos com busca, alternância fonte/arquivo exportado, estatísticas, reprodução de clipes (`AnimationMixer`), atualização ao vivo por Server-Sent Events preservando seleção e câmera.
- **Servidor**: uma instância por projeto, porta derivada do hash do caminho, reutilização por endpoint de saúde, sem endpoint de escrita.
- **Testes**: dois testes de integração que exportam, corrompem o GLB, estouram orçamento de triângulos e tentam escapar da raiz (`../escape.glb`), esperando falha em cada caso.

### 4.4 Maturidade e limitações

- **Maturidade: protótipo enxuto e coerente.** Um único commit introduz a forma atual (2026-11-02). Um autor. Sem versão, sem changelog, sem CI.
- Código denso, várias instruções por linha; legível, mas difícil de revisar por diff.
- Dois testes cobrem o caminho principal; não há testes unitários.
- O adaptador Manifold transfere só posições e índices: sem UV, sem cores, um material. O próprio `README` declara isso.
- Sem rig automático, sem texturização além de materiais simples.
- Lançador e mensagens presumem Windows (`.bat`, `rundll32`), embora a CLI trate macOS e Linux.

### 4.5 Segurança (estática)

| Aspecto | Achado | Avaliação |
|---|---|---|
| Rede | Servidor escuta só em `127.0.0.1` (`server.mjs`). Nenhuma chamada a host externo no código do kit. | Bom |
| Confinamento | `inside()` rejeita caminhos fora da raiz; o servidor repete a checagem após `realpath`, o que cobre links simbólicos. Testado. | Bom — melhor que o `startsWith` apontado na T13 |
| Escrita | Servidor sem rota de escrita; só a CLI grava, em caminhos do manifesto. | Bom |
| Origem das requisições | Sem verificação de `Host`/`Origin`. Qualquer página aberta no navegador do usuário pode **ler** os arquivos do projeto servido se descobrir a porta (determinística por caminho). Sem escrita, o impacto é exposição de conteúdo local. | Ressalva |
| **Instalação automática** | `ensureDependencies()` em `cli.mjs` roda `execSync('npm install')` se `node_modules` não existir, **sem perguntar**. O `.bat` gerado faz o mesmo. Roda scripts de instalação de terceiros. | **Conflita** com o princípio "nenhuma instalação sem autorização" |
| Execução de código | Os módulos-fonte dos assets são JavaScript escrito pelo agente e executado **dentro da página do navegador**, não no Node. A página só alcança o servidor local. | Aceitável; é o melhor isolamento entre as três ferramentas |
| Skills | Instruem o agente a orientar instalação de Node (`winget`, `brew`, `curl … \| sudo bash`) e a rodar `npm install`/`npx playwright install`. `game-researcher` manda pesquisar Steam, SteamDB e YouTube. `game-reviewer-qa` manda executar o jogo. | Precisam de reescrita para o modelo de permissões da Lia Forge |
| Credenciais | Nenhuma referência a chaves, tokens ou `.env`. | Bom |

### 4.6 Classificação

- **`asset-kit`: BLOCKED** (P0-2). É a peça tecnicamente mais alinhada: mesma pilha (Node, Three.js atual, GLB como saída), pequena o bastante para ser auditada inteira, e já implementa três coisas que a revisão de arquitetura apontou como lacunas. Com licença permissiva, passa a candidata a `RECOMMENDED` **como referência de implementação a ser reescrita dentro dos contratos da Lia Forge**, não como dependência.
- **Skills `game-*`: RESEARCH-ONLY.** O objeto delas é o ciclo de vida de um jogo (pesquisa de mercado, GDD, programação, QA de gameplay), fora do domínio da Lia Forge. O que interessa é a forma: Skills curtas com `references/` carregadas sob demanda, um contrato de entrega de assets (`asset_handoff.md`), e a tabela de decisão de técnica em `game-asset-kit`.

---

## 5. Ferramenta B — NoctAssetForge (2D), versões "v2" e 2.5

### 5.1 O que é

Ambiente para criar assets visuais 2D por código: UI, ícones, tiles, texturas e sprites. O agente escreve TypeScript sobre dois motores — `@core/brush` (geometria vetorial, booleanas, traços, texturas procedurais) e `@core/pixel` (pixel art em grade inteira) — e a ferramenta rasteriza para PNG ou JPEG em Chromium sem interface.

### 5.2 Estrutura e tecnologia

| Item | Evidência |
|---|---|
| Linguagem | TypeScript (65 arquivos `.ts` no 2.5), cerca de 13.900 linhas com testes. |
| Dependências | `paper` 0.12.18, `simplex-noise` 4.0.3, `picocolors`, `playwright` (faixa `^1.50.1`, lock em 1.63.0). Dev: `vite` 6.4.3, `tsx`, `typescript`. |
| Lockfile | 99 pacotes; MIT 94, Apache-2.0 3, ISC 1, BSD-3-Clause 1. Scripts de instalação: `esbuild`, `fsevents`. |
| Organização | `core/` (motores, cor, ruído, empacotador), `tools/` (CLI, exportação, servidor), `viewer/`, `templates/`, `stamps/`, `scripts/`, `tests/` (6 arquivos), `.agents/skills/` (3 Skills). |
| Documentação | 23 Markdown, incluindo referência de API **gerada** (`scripts/generate-api-docs.ts`) e um teste que confere a documentação (`tests/docs.test.ts`). |

### 5.3 Funcionalidades implementadas (não verificadas em execução)

- `defineAsset` com `width`, `height`, `scale`, `frames`, `fps`, `animations` (intervalos nomeados de quadros), modos de antialiasing.
- Exportação de animação como tira horizontal + **atlas JSON** com `frame_0..N`.
- Empacotamento de folhas: `packGrid` e `packCompact`, com `--gap`, `--cols`, `--scale`, `--format png|jpeg`.
- CLI: `new-project`, `new-asset`, `new-sandbox`, `check` (tipos), `export`, `list --json`, `inspect` (mede um PNG), `capture` (captura uma página de prévia).
- Visualizador com catálogo de projetos, assets e "sandboxes" (páginas de prévia por projeto); no 2.5, API de catálogo somente leitura com escopo por projeto.
- `doctor` de ambiente; `STYLE.md`/`PROJECT.md` por projeto como contrato de estilo.
- Skills: `noct-setup`, `noct-asset-forge` (regras de produção), `noct-review` (conferência do resultado).

### 5.4 Diferença entre "v2" e 2.5

85 arquivos diferem. O 2.5 acrescenta servidor compartilhado com descoberta (`forge-server.ts`), API do visualizador (`viewer-api.ts`), sessão e tema (`forge-session.js`, `forge-theme.css`), sandboxes no lugar de `project-preview`, migração (`migrate-sandboxes.ts`) e dois arquivos de teste. Não há motivo para avaliar a versão anterior separadamente.

### 5.5 Maturidade e limitações

- **Maturidade: média.** Versionado, com build reproduzível declarado, checksums, API documentada por geração e testes de fronteira. Duas versões em três semanas indicam desenvolvimento ativo.
- Autor e canal de manutenção desconhecidos; sem repositório público citado.
- Depende de Chromium para rasterizar: pesado para o que entrega, e uma dependência a mais no hardware-alvo.
- Não lê nem produz nada 3D; não tem relação com o pipeline GLB → spritesheet.

### 5.6 Segurança (estática)

| Aspecto | Achado | Avaliação |
|---|---|---|
| Rede | Vite em `127.0.0.1` (2.5) ou `localhost` ("v2"). Nenhum host externo no código. | Bom |
| API | Só `GET` de saúde e catálogo; rejeita projeto fora do escopo da sessão; nome de projeto validado por expressão regular. | Bom |
| Processos | `execFileSync` do `tsc` local; `execFile` para abrir o navegador. Sem `shell`. | Bom |
| Execução de código | O código do asset roda na página do Chromium. As ferramentas rodam via `tsx` no Node, e o Vite compila e serve o que estiver em `projects/`. | Aceitável |
| Estado em disco | `forge-server.ts` grava a origem do servidor ativo em `.runtime/viewer-server.json`, sob o diretório de trabalho. | Aceitável |
| Instalação | Manual (`npm install`, `npx playwright install chromium`); os lançadores usam `npx tsx`, que pode baixar o pacote se ausente. | Ressalva |
| Credenciais | Nenhuma. | Bom |

### 5.7 Classificação

- **NoctAssetForge 2.5: BLOCKED** (P0-1). Sem permissão escrita, nem o código nem trechos adaptados podem entrar na Lia Forge.
- **NoctAssetForge "v2" (1.0.0): REJECTED.** Superada pela 2.5, mesma restrição. Recomendo retirá-la do conjunto em avaliação.

---

## 6. Ferramenta C — NoctAssetForge3DBB (3D)

### 6.1 O que é

Pipeline 3D procedural em Python. O agente escreve "receitas" (scripts Python salvos); a ferramenta produz um arquivo `.bbmodel` (o formato JSON do Blockbench) como artefato de trabalho, sobre o qual rodam etapas independentes de UV, pintura de textura e animação, e exporta glTF/GLB. O aplicativo Blockbench **não é necessário**; é opcional para edição manual.

### 6.2 Estrutura e tecnologia

| Item | Evidência |
|---|---|
| Linguagem | Python 3.12 (162 arquivos; ~27.300 linhas de ferramenta, ~12.300 de testes), JavaScript no visualizador. |
| Dependências | `Pillow>=10`, `numpy>=1.26`, `playwright>=1.40` (faixas abertas, **sem lock** para Python); `gltf-validator` 2.0.0-dev.3.10 via npm. |
| Embutidos | `three.min.js` r128, `GLTFLoader.js`, `OrbitControls.js` em `Tools/viewer/vendor/`. |
| Organização | `lib/` (construtor de modelo, primitivas, IK, animação, validação de malha), `Tools/` (CLI `forge`, UV, `TexturePainter`, exportador glTF, visualizador, captura, `doctor`), `docs/`, `model-rules/`, `tests/`, `.agents/skills/` (9 Skills), `AGENTS.md`. |
| Plataforma | Windows com o lançador `py` é a configuração declarada como suportada. |

### 6.3 Funcionalidades implementadas (não verificadas em execução)

- **Modelagem** por receita: caixas, malhas livres, hierarquia, armaduras, ossos, vínculos de pele, espelhamento, IK (`lib/ik.py`), validação de malha.
- **UV**: empacotador próprio (`uv_packer.py`, 1.317 linhas) com regras salvas no próprio BBModel.
- **Pintura de textura procedural** (`Tools/TexturePainter/`): campos, traços, carimbos, projeção, amostragem de superfície, variantes de textura (por exemplo, expressões).
- **Animação**: clipes declarados em receita, amostragem para exportação.
- **Exportador glTF/GLB próprio** (`gltf_export.py`): nós, peles com matrizes inversas compartilhadas, animações com `extras.loop`, seleção de partes (`--include`/`--exclude`) e de clipes.
- **Visualizador** Three.js com interpretador de `.bbmodel`, reprodução de animação, inspetor, plano de referência e sandboxes.
- **Captura** de vistas para revisão (`capture_preview.py`), incluindo modo "clay" para conferência de forma.
- **Reconciliação de edição manual**: `edit_diff.py` compara o BBModel editado à mão com a receita e orienta a atualização.
- **Pedidos de arte externa** (`Tools/art.py`): manifesto `art.json` que descreve imagens a serem fornecidas por "pessoa, ferramenta ou agente", acionado só a pedido explícito.
- **`doctor`** com `--install`: cada correção é mostrada como comando e só roda com `y`; sem terminal interativo, a resposta padrão é não.
- **Disciplina de etapas** documentada: nenhuma etapa executa um pré-requisito ausente; regenerar geometria só a pedido; exportar nunca roda receita nem altera o BBModel de origem; sobrescrever exige `--overwrite`.

### 6.4 Maturidade e limitações

- **Maturidade: a mais alta das três em volume e disciplina**, com ressalvas. 93 arquivos de teste e 676 funções de teste; documentação de arquitetura e de entrega; `implementation-handoff.md` declara "implementação e auditoria de aceite concluídas" em 2026-10-03 — é declaração do autor, não verificada.
- Pacote construído de árvore suja (`dirty: true`).
- `lib/model_builder.py` tem 3.429 linhas num arquivo: ponto único de complexidade.
- Dependências Python sem versões fixadas: a instalação não é reproduzível.
- Three.js r128 é de 2021. A Lia Forge, se adotar Three.js, usará versão atual; o visualizador não é reaproveitável como está.
- O formato central é BBModel, voltado a modelos de blocos e baixa contagem de polígonos. Não cobre personagens orgânicos nem o acervo `.blend` auditado.

### 6.5 Segurança (estática)

| Aspecto | Achado | Avaliação |
|---|---|---|
| Rede | Servidor em `127.0.0.1`; portas preferenciais 8765 e 8080 com alternativas. Nenhum host externo no código. | Bom |
| DNS rebinding | `host_allowed()` aceita só `127.0.0.1`, `localhost`, `::1` na porta do próprio servidor e responde 403 ao resto. | Bom — é exatamente a defesa ausente no servidor da T13 |
| Escrita por HTTP | Nenhum `do_POST`/`do_PUT`/`do_DELETE`. | Bom |
| Leitura de arquivos | `/api/file?path=…` recebe caminho absoluto, resolve e passa por `permitted()`, que exige estar sob a raiz de projetos ou em lista explícita. | Bom, com ressalva: a segurança depende inteiramente dessa função |
| **Execução de receitas** | `model_export.py`, `uv_packer.py`, `animation_export.py` e `texture_export.py` rodam a receita com `subprocess.run([sys.executable, recipe])`; `recipe_capture.py` usa `runpy.run_path`; `theme.py` carrega `theme.py` do projeto por `importlib`. É **Python arbitrário com os privilégios do usuário**, sem isolamento. | **Risco estrutural**: quem escreve a receita é um agente; abrir um projeto de terceiros equivale a executar código de terceiros |
| Instalação | Só com confirmação por comando (`doctor --install`). | Bom — modelo a copiar |
| Desserialização | `np.load(..., allow_pickle=False)`. Sem `pickle`, sem `eval`. | Bom |
| Regras para o agente | `AGENTS.md` proíbe Python inline (`python -c`, stdin) e restringe o agente ao projeto ativo. É convenção em texto, não mecanismo. | Parcial |
| Credenciais | Só variáveis `FORGE_*` de caminho. Nenhuma chave. | Bom |

### 6.6 Classificação

**BLOCKED.** Três causas, em ordem: licença (P0-1); aviso de terceiros incompleto (P0-5); e, se as duas forem resolvidas, a execução de receitas precisa de uma decisão de isolamento antes de qualquer acoplamento. Como **referência de projeto**, é a mais rica das três.

---

## 7. Comparação com a Lia Forge

### 7.1 Diferença de modelo

| | Lia Forge (planejada) | As três ferramentas |
|---|---|---|
| Quem conduz | Usuário na interface, com planejador e gates | Agente de programação num terminal |
| Unidade de trabalho | Workflow com passos, capabilities e providers | Script escrito pelo agente, executado pela ferramenta |
| Autoria 3D | Blender | Three.js/Manifold no navegador; ou Python → BBModel |
| Permissões | Autorização por execução, por provider | Convenções em `SKILL.md`/`AGENTS.md` |
| Direitos e proveniência | Obrigatórios por asset | Ausentes nas três |
| Histórico e revisão | Registro de execução e revisão humana | Arquivos de relatório; `visualReview: pending` no asset-kit |

Integrar qualquer uma "como está" traria um segundo modelo de operação para dentro do produto. O caminho coerente com os princípios do projeto é tratá-las como **providers externos** atrás de um adapter, ou como **fonte de padrões**.

### 7.2 Mapa de aproveitamento

Referências a `C-`, `R-`, `G-` e `DEC-` são da `INDEPENDENT-ARCHITECTURE-REVIEW.md`.

| Necessidade da Lia Forge | Onde aparece resolvida | Origem | Forma de aproveitar |
|---|---|---|---|
| Gate de integridade de GLB (roadmap P1, perfil GLB) | Validador da Khronos + medição de triângulos, dimensões, clipes | asset-kit; 3D | Adotar o **validador** (Apache-2.0, dependência pública) diretamente; a ideia dos limites por asset é livre |
| Revisão humana distinta de verificação automática (C-06, R-10) | `visualReview: 'pending'` no relatório | asset-kit | Padrão de contrato; reimplementar |
| Confinamento de caminhos (R-05) | `inside()` + `realpath`; `permitted()` | asset-kit; 3D | Padrão; reimplementar com teste de escape |
| Servidor local seguro (R-01, R-02, DEC-06) | Loopback, sem escrita, checagem de `Host` | 3D (mais completo) | Padrão; reimplementar |
| Viewport Fase 1 (PROPOSED) | Visualizador com SSE, câmera preservada, estatísticas, clipes | asset-kit | Referência para o agente Three.js; não copiar sem licença |
| Atlas e folha de sprites com JSON | `packGrid`/`packCompact`, tira + `frame_N` | 2D | Só como referência; a T13 já tem saída de spritesheet pelo Blender |
| Instalação só com consentimento (princípio do produto) | `doctor --install` com confirmação por comando | 3D | Padrão de UX; reimplementar |
| Estrutura de Skills (T14, PROPOSED) | `SKILL.md` curto + `references/` + contrato de entrega | As três | Referência de formato |
| Etapas explícitas sem pré-requisito implícito (G-01) | Regras de `docs/pipeline.md` | 3D | Princípio de desenho de workflow |
| Pedido de arte a produtor externo | `art.json` | 3D | Ideia compatível com o hub de providers |
| Geração procedural de props simples | Three.js + Manifold → GLB | asset-kit | **Capability nova**, não planejada: exige decisão de produto |

### 7.3 O que elas **não** trazem

- Nenhuma integração com Blender (nenhuma ocorrência de `bpy` ou "Blender" nos quatro ZIPs).
- Nenhum servidor ou cliente MCP.
- Nenhum registro de direitos, licença de entrada, consentimento ou proveniência por asset.
- Nenhum modelo de permissões além de texto para o agente.
- Nenhuma evidência de execução no hardware-alvo (RX 580).

### 7.4 Decisões de produto que esta avaliação abre

| # | Decisão | Alternativas |
|---|---|---|
| E-1 | A Lia Forge terá **geração procedural por código** como capability? | **A)** Não; fora do escopo. **B)** Sim, como provider externo opcional. **C)** Sim, nativa. Recomendo **A agora, B depois**: a fatia única recomendada na revisão (GLB do usuário → spritesheet) não depende disso. |
| E-2 | BBModel/Blockbench entra como segunda ferramenta de autoria? | **A)** Não; Blender é a única. **B)** Como adapter de importação de `.bbmodel` → GLB. Recomendo **A** até existir demanda concreta de modelos de blocos. |
| E-3 | Como executar código gerado por agente? | **A)** Nunca no host; só em página de navegador isolada (modelo do asset-kit). **B)** No host, com processo restrito. **C)** No host, livre (modelo do 3D). Recomendo **A** como regra; **C** é incompatível com os princípios de permissão. |
| E-4 | Política para material de terceiros em avaliação | **A)** Fora do Git. **B)** Em repositório privado separado. **C)** No repositório do produto. Recomendo **A** ou **B**. |

---

## 8. Integrações possíveis por frente

Tudo abaixo é `PROPOSED` e condicionado à resolução dos P0.

| Frente | GamejamProject | Noct 2D | Noct 3D |
|---|---|---|---|
| **Blender** | Nenhuma direta. O GLB gerado poderia ser entrada do pipeline Blender → spritesheet. | Nenhuma. | Nenhuma direta. Interesse comparativo: exportador glTF com peles e clipes, IK, validação de malha, e o princípio "exportar não altera a origem". |
| **Three.js** | Alta afinidade: Three.js atual, `GLTFLoader`, `AnimationMixer`, descarte correto de recursos, atualização ao vivo. | Nenhuma (2D em Canvas). | Visualizador em r128 — útil como exemplo do que **não** herdar; interpretador de `.bbmodel` é específico. |
| **UI/UX** | Árvore de assets com busca, alternância fonte/exportado, painel de estatísticas, lançador de um clique. | Catálogo por projeto, sandboxes, tema. | Inspetor, plano de referência, vistas de captura, modo "clay". |
| **Agentes/Skills** | 8 Skills com orquestrador e subagentes isolados; contrato de entrega de assets. | 3 Skills (preparar, produzir, revisar). | 9 Skills com roteamento por orquestrador; `AGENTS.md` com regras de escopo. |
| **MCP** | Não há. A CLI (`check`, `verify`, `export`) é pequena e determinística; seria o candidato natural a virar ferramenta somente leitura (`verify`) se a decisão DEC-12 for mantida. | Não há. `list --json` e `inspect --json` são leituras estruturadas. | Não há. `asset_status` e `model_inspector` são leituras estruturadas. |

---

## 9. Recomendações concretas

Em ordem. Nenhuma envolve código.

1. **Resolver a exposição (P0-1, P0-3) antes de tudo.** Confirmar autorização com o autor; se não houver, retirar os ZIPs do repositório público, incluindo o histórico da branch.
2. **Identificar os titulares** (P0-4) e pedir: licença explícita para o GamejamProject; permissão escrita específica para as ferramentas Noct, se houver interesse além de referência.
3. **Retirar `noct-asset-forge-v2.zip` do conjunto.** É versão superada.
4. **Não copiar código de nenhuma das três** enquanto os itens 1 e 2 estiverem abertos. Ler para aprender padrões é diferente de transcrever; os agentes especializados devem ser instruídos nesse sentido.
5. **Adotar já o que é público e independente das ferramentas:** o validador glTF da Khronos como gate de GLB e a ideia de limites por asset. Isso já estava no roadmap P1 da revisão e não depende de licença de terceiros.
6. **Registrar as decisões E-1 a E-4** no registro único de decisões (DEC-14).
7. **Se o autor licenciar o `asset-kit` de forma permissiva:** encaminhar para avaliação especializada com escopo fechado — reescrever dentro dos contratos da Lia Forge, removendo a instalação automática e acrescentando checagem de `Host`.
8. **Não tratar nenhuma como atalho para a fatia única** recomendada na revisão de arquitetura. Nenhuma delas reduz o trabalho de levar um GLB do usuário a um spritesheet aprovado pelo caminho governado.

### Condições para mudar a classificação

| Ferramenta | De → Para | Condição |
|---|---|---|
| asset-kit | BLOCKED → RECOMMENDED (como referência a reimplementar) | Licença permissiva escrita; ZIP sem `.git`; decisão E-1 = B ou C |
| Skills `game-*` | RESEARCH-ONLY → permanece | Licença só é necessária se algum texto for reaproveitado |
| Noct 2D 2.5 | BLOCKED → RESEARCH-ONLY | Permissão para manter cópia de estudo; origem dos `stamps/` esclarecida |
| Noct 2D 2.5 | BLOCKED → RECOMMENDED (provider externo) | Licença que permita integração; decisão E-1 = B |
| Noct 3D | BLOCKED → RESEARCH-ONLY | Permissão de estudo; `THIRD_PARTY.md` corrigido |
| Noct 3D | BLOCKED → RECOMMENDED (provider externo) | Licença que permita integração; isolamento da execução de receitas (E-3); decisão E-2 = B |

---

## 10. Encaminhamento aos agentes especializados

Encaminhar **só depois** da resolução dos P0, e com a instrução de não copiar código.

| Agente | Ferramenta | O que avaliar | Prioridade |
|---|---|---|---|
| **Three.js** | GamejamProject `asset-kit` (`viewer.js`, `browser.js`) | Padrão de carga, descarte, câmera preservada e atualização ao vivo como base da viewport Fase 1; estatísticas de inspeção como contrato de `model3d.preview` | Alta |
| **Three.js** | Noct 3D (`Tools/viewer/`) | Inspetor e plano de referência como ideias; confirmar que r128 embutido não deve ser herdado | Baixa |
| **UI/UX** | Os três visualizadores | Árvore de assets, alternância fonte/exportado, painéis de inspeção, sandboxes, fluxo de um clique; `doctor --install` como padrão de consentimento | Média |
| **Agentes/Skills/MCP** | Skills das três (20 no total) e `AGENTS.md` do 3D | Formato `SKILL.md` + `references/`, orquestrador com subagentes, contrato de entrega; quais comandos de leitura serviriam de ferramentas MCP somente leitura | Média |
| **Blender** | Noct 3D (`gltf_export.py`, `lib/ik.py`, `docs/pipeline.md`) | Comparação com a especificação do Bridge: disciplina de etapas, exportação que não altera a origem, peles e clipes em glTF | Baixa |
| **Blender** | GamejamProject, Noct 2D | Nada a avaliar | — |

Nenhuma ferramenta precisa ir ao agente Blender com urgência: nenhuma delas toca o Blender.

---

## Apêndice — evidências

### A.1 Comandos e verificações

| Verificação | Resultado |
|---|---|
| `gh repo view BloomRX/Lia-Forge --json isPrivate` | `false` |
| `git show --stat 7fcde2b` | 4 arquivos binários adicionados em `tools/` |
| `unzip -Z1` + busca por `../` e caminhos absolutos | 0 ocorrências nos quatro ZIPs |
| `find -type l` após extração | Nenhum link simbólico |
| `sha256sum -c checksums.sha256` (três pacotes Noct) | Todos conferem (121, 111 e 241 entradas) |
| Busca por `mcp`/`modelcontextprotocol` | 0 arquivos |
| Busca por `bpy`/`blender` | 0 arquivos |
| Busca por chaves, tokens, `.env` | Nenhuma credencial; só variáveis `FORGE_*` de caminho no 3D |
| Registro npm (nome@versão) | `three@0.187.0`, `manifold-3d@3.5.4`, `playwright@1.64.1` e `@1.63.0`, `gltf-validator@2.0.0-dev.3.10`, `vite@6.4.3`, `paper@0.12.18`, `sharp@0.35.5`, `simplex-noise@4.0.3`, `tsx@4.23.13` existem |

### A.2 Referências de código

| Achado | Local (dentro do ZIP) |
|---|---|
| Instalação automática sem confirmação | GamejamProject `tools/asset-kit/cli.mjs`, `ensureDependencies()`; `.bat` gerado por `launcher()` |
| Servidor em loopback, sem escrita | GamejamProject `tools/asset-kit/server.mjs` |
| Confinamento com `realpath` | GamejamProject `server.mjs`, `inside()` e a segunda checagem na rota de arquivos |
| `visualReview: 'pending'` | GamejamProject `cli.mjs`, montagem de `reports` |
| Teste de escape de raiz | GamejamProject `tools/asset-kit/kit.test.mjs` |
| Vite em `127.0.0.1` | Noct 2D 2.5 `vite.config.ts:28`, `tools/forge-server.ts:61` |
| API somente leitura com escopo | Noct 2D 2.5 `tools/viewer-api.ts` |
| Checagem de `Host` | Noct 3D `Tools/viewer_server.py:165–177` |
| Rota `/api/file` e `permitted()` | Noct 3D `Tools/viewer_server.py:251–254`, `304–312` (`is_relative_to` após `resolve()`) |
| Execução de receitas | Noct 3D `Tools/model_export.py:115`, `Tools/uv_packer.py:1237`, `Tools/animation_export.py:27`, `Tools/texture_export.py:54`, `lib/recipe_capture.py:148`, `Tools/TexturePainter/theme.py:166` |
| Confirmação por comando | Noct 3D `Tools/doctor.py`, `_confirm()` e `apply_fixes()` |
| Three.js r128 embutido | Noct 3D `Tools/viewer/vendor/three.min.js` (cabeçalho e constante de revisão) |
| `dirty: true` | Noct 3D `BUILD_INFO.json` |

### A.3 Limitações

1. Análise estática por busca; a maior parte do código não foi lida integralmente.
2. Nada foi executado: funcionalidades e testes são os declarados pelo autor.
3. A identidade do autor das ferramentas Noct e a existência de autorização para publicar os ZIPs são desconhecidas; os P0 partem do texto das licenças e do estado público do repositório.
4. Licenças de dependências vêm dos lockfiles e do registro npm; as dependências Python do 3D não foram conferidas no PyPI.
5. A comparação com a Lia Forge usa o estado descrito em `INDEPENDENT-ARCHITECTURE-REVIEW.md`, em que quase tudo é `PROPOSED` ou está fora de `main`.
6. O conteúdo histórico embutido no `.git` do GamejamProject foi apenas listado, não avaliado.
