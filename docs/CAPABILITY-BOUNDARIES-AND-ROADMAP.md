# Fronteiras de capacidade, escopo e prioridades do Lia Forge

> **Estado:** `PROPOSED`. Consolida as dez capacidades avaliadas na matriz cruzada de [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md) (2026-11-11) e propõe **limites de escopo** e **prioridades** para decisão humana. Não autoriza implementação, não altera contratos, não cria módulos.
> **Data:** 2026-11-12 UTC. **Regra de leitura:** nada aqui promove estado; o estado comprovado do checkout continua em [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md) e a divisão de responsabilidades em [`STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md`](STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md).
> **Princípio anti-duplicação:** uma ferramenta externa **não** vira módulo nem produto separado. Cada capacidade abaixo é classificada como **nativa**, **provider**, **adapter**, **backend** ou **destino**, e nunca como os cinco ao mesmo tempo.

## 1. As dez capacidades

### 1.1 Scene Composer

- **Problema que resolve:** hoje a Forge só consegue pedir geração a partir de texto e referências soltas; não há como declarar câmera, pose, posicionamento, camadas e máscaras **antes** de gerar, o que torna o resultado imprevisível e não reproduzível.
- **Usuários e casos de uso:** Dev que precisa de tomadas consistentes do mesmo personagem/local; quem reutiliza um manequim posado; quem quer compor personagem + prop + fundo com profundidade.
- **Entradas / saídas:** entrada = referências, manequim/pose, parâmetros de câmera, disposição de camadas/props, máscara opcional; saída = **dados de staging versionáveis** + (quando houver provider) imagem/mesh condicionado.
- **Relação com as demais:** alimenta Reference-driven Generation (1.10), Composition & Editing (1.9) e Image-to-3D (1.4); é consumida pelo Workflow Engine como nó de plano.
- **Dependências:** contrato de staging; `WorkflowPlan`; referências com função; (opcional) provider de inpainting/pose.
- **Classificação:** **experiência que combina capacidades existentes**, não capacidade nova — ver §2.1.
- **Critérios de QA:** staging reproduzível (mesmos parâmetros → mesmo enquadramento); máscara válida verificada antes do consumo (precedente: `craft-ai-comfyui` verifica máscaras antes de o app vê-las); evidência de que a câmera declarada é a câmera usada.
- **Prioridade sugerida:** **Média** — alto valor, mas depende de decisão de contrato e não desbloqueia a primeira fatia.
- **Risco de duplicação:** criar um "módulo de composição" paralelo ao Workflow Engine; duplicar a rota `Manequim → 2D` já documentada.

### 1.2 Environment Reconstruction

- **Problema:** ambientes/cenários estão no escopo de assets declarado, mas não existe rota nem categoria implementada (taxonomia de código valida apenas `character`/`item`).
- **Usuários/casos:** níveis e fundos de jogo; cenários para sprites/parallax; backdrop para composição de personagem.
- **Entradas/saídas:** entrada = imagem(s) do ambiente, clean plate opcional; saída = mesh/altura/camadas/splat do ambiente **ou** fundo 2D em camadas.
- **Relação:** depende de Image-to-3D (1.4) ou de Gaussian Splats (1.3); alimenta Scene Composer (1.1) e Composition (1.9).
- **Dependências:** extensão de taxonomia além de `character`/`item`; provider (todos os candidatos observados são hospedados e pagos).
- **Classificação:** **rota/capacidade nativa** com **providers substituíveis**.
- **QA:** ocupação/colisão declarada; escala coerente com `scale.referenceUnit`/`referenceHeight` do perfil; separação estático/dinâmico registrada.
- **Prioridade:** **Baixa-média** — posterior à primeira fatia humanoide.
- **Risco de duplicação:** criar "Forge de ambientes" separado; confundir ambiente com destino.

### 1.3 Gaussian Splats

- **Problema:** representação de ambiente capturado/gerado que hoje a Forge não lê, não valida e não exporta.
- **Usuários/casos:** pré-visualização de local, backdrop de composição, referência espacial; eventualmente consumo em engine que suporte splats.
- **Entradas/saídas:** entrada = `.spz`/`.ply`/`.splat` de provider ou captura; saída = artefato registrado com hash + proxy (malha/colisão/imagem) quando aplicável.
- **Relação:** é uma **representação** dentro de Environment Reconstruction (1.2) e pode ser camada em Scene Composer (1.1).
- **Dependências:** validador de formato; decisão de escopo; visualizador (hoje inexistente).
- **Classificação:** ver §2.2 — recomendação: **formato de asset primeiro, capacidade de reconstrução depois**.
- **QA:** integridade de arquivo, contagem de splats, bounds, e declaração de que **não** é malha nem colisão.
- **Prioridade:** **Baixa**.
- **Risco de duplicação:** dois caminhos de ambiente (splat e malha) sem relação registrada entre eles.

### 1.4 Image-to-3D

- **Problema:** gerar geometria a partir de imagem é a etapa 2 do pipeline 3D e está `PLANNED`/`BLOCKED` (nenhum provider escolhido; rota do vídeo bloqueada por hardware e licença).
- **Usuários/casos:** personagem a partir de concept; prop a partir de foto; peça a partir de desenho.
- **Entradas/saídas:** entrada = imagem + parâmetros declarados (resolução alvo, PBR, contagem de faces); saída = mesh com materiais + proveniência + limitações.
- **Relação:** alimenta retopologia/UV/bake/textura/rig (etapas 3–9 do pipeline) e Composition (1.9).
- **Dependências:** provider local ou hospedado; direitos; hardware (ver [`3D-CHARACTER-PRODUCTION-PIPELINE.md`](3D-CHARACTER-PRODUCTION-PIPELINE.md) §2).
- **Classificação:** **capability nativa com provider substituível**; o passo contratual `generate-3d` **já existe**.
- **QA:** watertight ou relatório de reparo; contagem de triângulos declarada; presença de UV/material; ausência de afirmação de "game-ready" sem validação no destino.
- **Prioridade:** **Alta** — é o gargalo da primeira fatia 3D.
- **Risco de duplicação:** criar rota paralela ao passo `generate-3d` existente.

### 1.5 Spatial Audio & SFX

- **Problema:** a Forge não tem nenhuma capability de áudio (0 arquivos), enquanto destinos (jogo, Lia Desktop, vídeo) consomem som.
- **Usuários/casos:** SFX por objeto, loop ambiente, passos, voz.
- **Entradas/saídas:** entrada = descrição textual e/ou imagem do objeto, parâmetros (duração, loop, contagem); saída = arquivo de áudio com hash, licença e proveniência.
- **Relação:** vincula-se ao asset por relação (ex.: `lia.rel.uses_reference`/predicado próprio a decidir); é consumido por Video Production (1.6) e pelos destinos.
- **Dependências:** provider (todos os observados são hospedados: ElevenLabs SFX via FAL; catálogo ArtCraft); categoria de asset nova.
- **Classificação:** ver §2.3 — recomendação: **produção de assets sonoros apenas**, sem composição espacial.
- **QA:** formato/duração/loop conformes; ausência de clipping quando medível; licença e direitos por arquivo.
- **Prioridade:** **Baixa**.
- **Risco de duplicação:** sobreposição com o Lia Voice Studio (produto separado do ecossistema) — **não** duplicar voz/personalidade aqui.

### 1.6 Video Production

- **Problema:** vídeo é hoje apenas **destino de consumo**; não há capability de produção, contrato de mídia temporal nem gate de QA.
- **Usuários/casos:** trailer/showcase de asset, cinematic curta, vídeo de documentação, comparação de versões lado a lado.
- **Entradas/saídas:** entrada = assets aprovados + composição declarativa (cenas, trilhas, tempos, legendas); saída = MP4 com hash, fps, duração, resolução e trilhas.
- **Relação:** consome Deterministic Rendering (1.7), Spatial Audio (1.5) e o sistema de assets inteiro; é também destino.
- **Dependências:** backend candidato [`hyperframes`](https://github.com/heygen-com/hyperframes) (Apache-2.0, Node 22+, FFmpeg, Chrome headless, **sem GPU/CUDA**); contrato de mídia temporal inexistente na spec v1; política de telemetria.
- **Classificação:** ver §2.4 — recomendação: **backend opcional + capability da Forge**, com destino permanecendo destino.
- **QA:** pureza determinística (sem relógio de parede, sem aleatoriedade não semeada, sem rede durante o render, saída fixa, duração finita); mesma entrada → mesmo hash de saída; conferência de trilhas.
- **Prioridade:** **Média** — é a única das dez com backend licenciado e sem barreira de hardware.
- **Risco de duplicação:** transformar o destino "vídeo/streaming" em módulo de geração; duplicar o que o FilmCraft/EffectCraft (externos) já fazem.

### 1.7 Deterministic Rendering

- **Problema:** garantir que a mesma entrada produza a mesma saída, para que `VERIFIED` tenha significado e para permitir comparação/regressão.
- **Usuários/casos:** spritesheets, evidência de QA, comparação de providers, benchmark, vídeo.
- **Entradas/saídas:** entrada = modelo/pose/câmera/parâmetros fixos; saída = imagens ou quadros + manifesto + hash.
- **Relação:** é pré-requisito de Video Production (1.6), de Visual QA e de Benchmark.
- **Dependências:** renderer (Blender hoje, `IMPLEMENTED` como código, **não executado** neste checkout); checklist de pureza.
- **Classificação:** **capability nativa transversal** (não é módulo novo).
- **QA:** checklist de pureza adotado do hyperframes e aplicado **ao renderer existente**; seed declarada; ausência de rede durante o render; resolução/engine fixos; repetição com hash igual.
- **Prioridade:** **Alta** — é o que permite afirmar `VERIFIED` em qualquer rota.
- **Risco de duplicação:** criar um segundo renderizador; confundir determinismo de imagem com determinismo de vídeo sem estender o checklist.

### 1.8 Agent Production Control

- **Problema:** permitir que um agente planeje, execute e reporte produção sem que isso vire dependência obrigatória nem permissão implícita.
- **Usuários/casos:** Dev com agente hospedeiro (MCP/CLI); automação de lote; retomada assistida.
- **Entradas/saídas:** entrada = objetivo, restrições, autorização por efeito; saída = plano, eventos reais de execução, evidências, limitações.
- **Relação:** é a superfície externa do Intelligent Orchestrator + Workflow Engine; não substitui nenhum dos dois.
- **Dependências:** `scripts/spriteforge-mcp.mjs` (`PARTIALLY_IMPLEMENTED`), skills (`PLANNED` em runtime), aprovação escopada.
- **Classificação:** ver §2.6 — recomendação: **parte do Orchestrator**, com transporte MCP/CLI como adapter, não como camada separada.
- **QA:** nenhuma ação externa sem consentimento; progresso só por eventos reais; skills tratadas como conteúdo não confiável; proveniência de skill (manifesto + checksum, como no hyperframes).
- **Prioridade:** **Média-alta** (já parcialmente existente).
- **Risco de duplicação:** criar um "agente da Forge" paralelo ao Orchestrator; duplicar estados de sessão com os do Studio.

### 1.9 Composition & Editing

- **Problema:** editar assets existentes (camadas, máscaras, inpainting, remoção de fundo, conversão, otimização) sem regenerar do zero.
- **Usuários/casos:** corrigir uma vista, remover fundo, separar partes, converter formato, otimizar malha.
- **Entradas/saídas:** entrada = asset existente + instrução/máscara; saída = **nova versão** com linhagem (nunca sobrescrita da origem).
- **Relação:** depende de Asset Management (versões/lineage) e alimenta Reference-driven Generation (1.10).
- **Dependências:** provider de edição de imagem (candidatos observados: `nano-banana`, `gpt-image-2` — hospedados) ou ferramenta local; contrato de camadas/máscaras.
- **Classificação:** **rota nativa** ("asset existente → edição/conversão") com **providers substituíveis**; **não** é um editor próprio.
- **QA:** preservação integral da origem; máscara válida; declaração de pixels inferidos/reconstruídos (política de conteúdo reconstruído já pendente na proposta consolidada).
- **Prioridade:** **Média**.
- **Risco de duplicação:** construir um editor concorrente de PhotoCraft/`image-to-psd`/`doll-studio` dentro da Forge.

### 1.10 Reference-driven Generation

- **Problema:** referências hoje são **slot com gate de contagem** (≥3 imagens), sem função, sem vínculo a identidade/estilo e sem detecção de defasagem.
- **Usuários/casos:** qualquer produção que precise de coerência entre vistas, poses, expressões, roupas e versões.
- **Entradas/saídas:** entrada = referências com **função declarada**, hash e direitos + perfil visual aprovado; saída = geração condicionada + registro de quais referências foram efetivamente usadas.
- **Relação:** é o mecanismo que dá sentido a Scene Composer (1.1), Composition (1.9) e à consistência Studio↔Forge.
- **Dependências:** shape do perfil (spec §11, item 3), origem por trait (`manual`/`imported_reference`/`ai_proposal`), predicado `lia.rel.uses_reference`.
- **Classificação:** **capability nativa** (contrato + validação), não provider.
- **QA:** referência com hash exato e direitos; uso como baseline exige revisão humana; detecção de `stale`; nenhuma inferência de estilo a partir de prompt.
- **Prioridade:** **Alta** — é o núcleo da exigência de consistência.
- **Risco de duplicação:** criar um segundo sistema de referências fora do perfil visual já proposto.

## 2. As sete questões de fronteira (alternativas e recomendação)

### 2.1 Scene Composer: capacidade própria ou experiência combinada?

| Alternativa | Consequências |
|---|---|
| **Capacidade/módulo próprio** | Editor de cena com estado próprio; risco de duplicar Workflow Engine e a rota `Manequim → 2D`; exige UI, contrato e QA novos |
| **Experiência que combina capacidades** *(recomendada)* | Um **nó de staging** em `WorkflowPlan` + contratos de câmera/pose/máscara + UI que os expõe; nenhuma entidade de domínio nova; reusa referências com função e o perfil visual |

**Recomendação (não aprovada):** experiência combinada. O que precisa existir de novo é **contrato de staging** e **UI**, não um módulo de composição.

### 2.2 Gaussian Splats: formato, capacidade de reconstrução ou ambos?

**Recomendação (não aprovada):** **formato primeiro** (ingestão, hash, validador, registro como `Artifact`) e **reconstrução depois** (somente se houver provider e caso de uso aprovados). Tratar os dois juntos criaria uma capacidade de reconstrução sem demanda comprovada.

### 2.3 Spatial Audio: produção de assets sonoros ou também composição espacial?

**Recomendação (não aprovada):** **apenas produção de assets sonoros** (arquivo com licença, hash, duração, loop, vínculo ao asset). Composição espacial (posicionamento 3D, atenuação, oclusão, mix) pertence ao **consumidor** (engine/jogo, Lia Desktop, vídeo) — entrar nela duplicaria o papel do destino e o do SoundCraft/FilmCraft externos.

### 2.4 Video Production: Forge, Studio ou compartilhada?

| Alternativa | Consequências |
|---|---|
| **Do Studio** | O Studio passaria a produzir mídia, contrariando a decisão registrada de que ele não gera arte/rig/animação/spritesheet no lugar do Forge |
| **Do Forge como capability** *(recomendada)* | Coerente com "Forge produz assets para qualquer consumidor"; vídeo vira categoria/rota com backend substituível; o destino "vídeo/streaming" continua sendo destino |
| **Compartilhada** | Exige contrato de mídia temporal entre produtos que não existe; duplica estados; só faz sentido se o Studio precisar **editar** vídeo do jogo (não declarado) |

**Recomendação (não aprovada):** capability do **Forge** com backend opcional; Studio apenas **solicita** (via brief) e **consome** o arquivo com seus próprios gates.

### 2.5 Deterministic Rendering: só imagens/spritesheets ou também vídeo/sequências?

**Recomendação (não aprovada):** **o mesmo checklist de pureza para os dois**, aplicado por backend. Hoje vale para o render Blender (imagem); se vídeo entrar, o checklist se estende (clock inteiro, duração finita, sem rede). Não criar dois conceitos de determinismo.

### 2.6 Agent Production Control: parte do Orchestrator ou camada de execução separada?

**Recomendação (não aprovada):** **parte do Orchestrator**. MCP/CLI/skills são **adapters de transporte** da mesma capacidade de planejamento e consentimento; uma camada separada criaria dois lugares que decidem o que pode ser executado — exatamente o que o princípio "ação explícita para executar" proíbe.

### 2.7 Como Composition & Editing se relaciona com os workflows existentes?

**Recomendação (não aprovada):** é **uma rota do mesmo Workflow Engine** ("asset existente → edição/conversão/otimização/reexport"), entrando pelo ponto de entrada compatível e criando **nova versão** com linhagem. Não é um editor interativo próprio e não é um subsistema fora do grafo.

## 3. Fronteira Forge × Studio por capacidade

| Capacidade | Forge | Studio | Consumidor/destino |
|---|---|---|---|
| Scene Composer | staging + produção | define intenção/critérios | valida enquadramento no jogo |
| Environment Reconstruction | produz ambiente | decide necessidade/cânone | importa e testa |
| Gaussian Splats | ingere/valida/exporta | — | decide se consome splats |
| Image-to-3D | produz mesh | aprova adequação | valida na engine |
| Spatial Audio & SFX | produz arquivo de áudio | decide necessidade | mixa/posiciona |
| Video Production | produz o vídeo | solicita e consome | publica |
| Deterministic Rendering | garante e evidencia | — | confia no hash |
| Agent Production Control | planeja/executa com consentimento | tem **seus próprios** agentes/skills para trabalho do jogo | — |
| Composition & Editing | edita/converte criando versões | registra no projeto | importa a versão que lhe serve |
| Reference-driven Generation | aplica referências com função | **dono** das referências aprovadas e da direção | declara requisitos |

Nenhuma linha dá ao Studio seleção de provider interno da Forge, e nenhuma dá à Forge julgamento de adequação ao jogo.

## 4. Prioridades sugeridas (para decisão humana)

| Prioridade | Capacidades | Por quê |
|---|---|---|
| **1 — desbloqueia a primeira fatia** | Deterministic Rendering (1.7), Reference-driven Generation (1.10), Image-to-3D (1.4) | Sem elas não há `VERIFIED`, nem coerência de identidade, nem geometria no alvo de hardware |
| **2 — amplia sem depender de decisão de escopo nova** | Composition & Editing (1.9), Agent Production Control (1.8) | Reusam contratos e módulos já planejados |
| **3 — exige decisão de escopo prévia** | Video Production (1.6), Scene Composer (1.1) | Precisam de contrato de mídia temporal / contrato de staging |
| **4 — posterior** | Environment Reconstruction (1.2), Gaussian Splats (1.3), Spatial Audio & SFX (1.5) | Dependem de providers hospedados, extensão de taxonomia e decisão de escopo |

## 5. O que este documento não faz

Não cria módulo, não escolhe provider, não aprova prioridade, não altera contratos nem estados, não autoriza instalação ou execução. As decisões correspondentes estão listadas em [`DECISIONS-AND-OPEN-QUESTIONS.md`](DECISIONS-AND-OPEN-QUESTIONS.md) (perguntas 16 a 28) e resumidas em [`T8-ARCHITECTURAL-DECISIONS-REVIEW.md`](T8-ARCHITECTURAL-DECISIONS-REVIEW.md).
