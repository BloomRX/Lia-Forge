# Arquitetura de identidade e consistência compartilhada — Lia Studio ↔ Lia Forge

> **Estado:** `PROPOSED` — desenho arquitetural para revisão humana. **Não autoriza implementação**, não altera contratos existentes, não altera código de nenhum dos dois produtos e não aprova nenhuma das alternativas comparadas.
> **Data da revisão:** 2026-11-12 UTC. **Branch:** `arena/649f88bd-3dspritesheet` (Lia Forge), `HEAD` local `13dc4c7d2fde28f9324fd929482948ba34a87abf`.
> **Hierarquia:** [`ADR-001-LIA-FORGE-DECISIONS.md`](ADR-001-LIA-FORGE-DECISIONS.md) > [`LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md`](LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md) > [`DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`](DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md) > auditorias/pesquisas. Este documento está no nível de **proposta temática** e não sobrescreve nenhum dos anteriores.
> **Relação com outros documentos:** a visão de produto e a fronteira em nível de arquitetura estão em [`PRODUCT-ARCHITECTURE.md`](PRODUCT-ARCHITECTURE.md) (seção "Consistência nos dois produtos"); os impactos contratuais em [`DOMAIN-CONTRACTS-EVOLUTION-PROPOSAL.md`](DOMAIN-CONTRACTS-EVOLUTION-PROPOSAL.md) §14; as decisões abertas em [`DECISIONS-AND-OPEN-QUESTIONS.md`](DECISIONS-AND-OPEN-QUESTIONS.md); o resumo executivo da T8 em [`T8-ARCHITECTURAL-DECISIONS-REVIEW.md`](T8-ARCHITECTURAL-DECISIONS-REVIEW.md).

## 1. Base factual: o que já existe do lado do Lia Studio (fonte primária, não inferência)

A conclusão registrada na T7 de que `docs/LIA-FORGE-NA-PIPELINE.md` "não existe" era **verdadeira apenas para o repositório da Lia Forge** e para a busca de código então disponível. Em 2026-11-12 UTC o documento foi **localizado no repositório correto**:

| Item | Valor verificado |
|---|---|
| Repositório | [`BloomRX/Lia-Studio`](https://github.com/BloomRX/Lia-Studio) (público, `pushed_at` 2026-11-11T21:07:15Z) |
| Branch | **`arena/01a0f4ab-lia-gamedev`** (commit `49eedeec09ce`, 2026-11-11T21:07:11Z, *"Clarify Studio game ownership and Forge universal asset role"*). A branch `main` (`ba70d22435`) **não** contém o arquivo: tem apenas `docs/BRAND-STANDARDS.md` e `docs/UI-UX-DESIGN-SYSTEM-LIA-STUDIO.md` com o conteúdo `PLACEHOLDER` (11 bytes) |
| Arquivo | `docs/LIA-FORGE-NA-PIPELINE.md`, 19.340 bytes, 175 linhas, blob `82f27727858208166fce34dc050525d0dffff9c3` |
| Código relacionado | `app/lia/forge_brief.py` (4.778 bytes, 90 linhas) e `tests/test_forge_brief.py` (5.575 bytes) |
| Método | GitHub API (`repos/BloomRX/Lia-Studio/git/trees/<branch>?recursive=1`, `contents/...?ref=<branch>`, `commits/<sha>`). **Nenhum clone, download, execução ou alteração** no repositório do Studio |

O que aquele documento **declara como decisão** (transcrição fiel do sentido, com o vocabulário de estado da Forge):

1. **`DECIDED` (decisão de produto do Dev, registrada no Studio):** "Lia Studio decide e coordena o **jogo**; Lia Forge produz, transforma e valida tecnicamente **assets para qualquer consumidor**. Lia Desktop e jogos são destinos de utilização, não módulos de geração separados." A fronteira de responsabilidades está definida e inclui a tabela "Fronteira direta, sem duplicação" e a seção "Dois pedidos, a mesma fábrica".
2. **`REQUIRES_HUMAN_DECISION` (explícito no Studio):** "A fronteira está definida; o protocolo/bridge entre apps **não** está aprovado nem implementado." E: "O contrato de mensagens e a forma de descoberta/transporte (arquivo de handoff, CLI, IPC ou outro) **ainda precisam de decisão**."
3. **`DECIDED` como limite negativo:** "A especificação Domain Contracts do Forge **não é um protocolo Studio ↔ Forge**"; não transportar os JSONs internos do Forge diretamente para o Studio; não construir no Studio um schema que antecipe essa aprovação.
4. **`IMPLEMENTED` no Studio (com escopo estreito declarado):** primeiro corte = **brief manual, sem bridge**. `app/lia/forge_brief.py::preview()` aceita exatamente `{module_id, task_id, asset_kind, request}`, valida IDs por `[0-9a-f]{8}`, limita textos (200/300/300/80/400 chars), rejeita caracteres de controle e colapsa espaços ("textos fornecidos pelo Dev não podem criar novas seções no Markdown"), lê **apenas** `name`, `objective`, `verify` e `status` da Task — com comentário explícito "Nenhum arquivo da Task, documento do projeto, decisão, mídia ou credencial é lido" — e devolve `{content, sha256, sent: False, saved: False, verified_result: False, warning}`. O vocabulário de `asset_kind` é `concept`, `model`, `rig`, `spritesheet`. O próprio documento do Studio classifica esse teste como "serviço, HTTP e UI com dados temporários/falsos; não houve execução do Forge, importação de asset real nem teste de gameplay/Windows".
5. **`PROPOSED` (Studio):** "vínculo mínimo sugerido" com ID/Task do Studio, ID/etapa/versão do contrato no Forge, paths relativos dos outputs, tamanho e **SHA-256 calculado após o arquivo existir**, ferramenta/versão e limitações; e "estados independentes", em que `concept`/`model`/`rig`/`spritesheet` descrevem etapas de arte no Forge enquanto o Studio mantém `arquivo registrado` → `integridade intacta/alterada/indisponível` → `revisão visual humana` → `import/teste na engine` → gate.
6. **`DECIDED` como princípio (Studio):** "**integração na experiência, autonomia na arquitetura**" — o Forge não vira biblioteca interna, subprocesso obrigatório nem a quinta fase do jogo; o Studio não assume que o Forge está instalado, autenticado ou em execução; manter caminho manual funcional e Forge autônomo mesmo após integração completa.
7. **`DECIDED` (Studio), coerente com a T7:** "ArtCraft ou outra ferramenta de criação, se avaliada no futuro, pertence ao catálogo/experimentos do **Forge**, não à arquitetura de providers do Studio"; e "não se cria um `GameForge` ou `DesktopForge` paralelo".
8. **Pendência factual do lado do Studio:** a leitura documental do Studio está ancorada no commit **`f274b015`** da Forge (com nota adicional sobre **`79d4b58`**) e pede expressamente "Confirmar novamente o commit e o contrato **aprovado** antes de desenhar transporte ou mapear schemas". Os commits posteriores da Forge — `33fdedf` (pesquisa 3D local) e `b81b127` (T7: quatro fontes externas, matriz cruzada e fronteira de consistência) — **ainda não foram lidos pelo Studio**.

**Consequência imediata para esta proposta:** a divisão de responsabilidades **não precisa ser re-decidida**; o que continua em aberto é o **modelo de identidade/consistência compartilhada** e o **contrato de passagem**. Toda alternativa abaixo respeita os itens 1, 3, 6 e 7 como restrições, não como sugestões.

## 2. Responsabilidades (consolidado, sem duplicar a tabela do Studio)

| Domínio | Lia Studio | Lia Forge | Consumidor (jogo/Lia Desktop/outro) | Pessoa (Dev) |
|---|---|---|---|---|
| Intenção, GDD, narrativa, mundo, gameplay, escopo, Tasks e gates | **Dono** | Recebe projeção mínima autorizada | — | Aprova |
| Identidade visual global do projeto (direção artística, paleta, silhueta, proporções, materiais, linguagem de superfície, regras de mundo) | **Dono** (cânone) | Aplica e mantém **projeção de produção** versionada | Declara requisitos próprios de destino | Aprova mudanças de direção |
| Identidade de produção do asset (referências com função, vistas, poses, expressões, cabelo/roupa/acessórios, partes modulares, versões, relações, continuidade entre workflows/providers) | Consome evidência | **Dono** | — | Aprova desvios |
| Ferramentas, providers, adapters, workflows, custos, instalações | **Não seleciona** providers internos do Forge | **Dono** | — | Autoriza cada efeito |
| Validação técnica de arquivo (formato, canais, grade, geometria, UV/rig, hash) | Registra e confere integridade | **Dono** | Valida a **sua** integração | — |
| Julgamento de adequação ao jogo (asset tecnicamente correto, visualmente incompatível) | **Dono** | Fornece evidência, desvios e limitações | — | Decide |
| QA do jogo, import na engine, playtest, build, release | **Dono** | Fora de escopo | Cada um no seu contexto | Decide |
| Proveniência, direitos e licenças por componente | Registra origem/licença declarada do que importa | **Dono** do registro de produção | Confere no seu contexto | Aceita licenças e custos |

Regra de ouro herdada do Studio e adotada aqui: **resultado `complete` no Forge não conclui Task nem aprova gate do jogo**; e **`assets.json` do Studio e o manifesto/catálogo do Forge não substituem um ao outro**.

## 3. Modelo conceitual de identidade — três camadas, não um contrato único

Não se presume que todos os dados pertençam a um único contrato. A separação proposta é por **camada de propriedade**, e cada camada tem dono, editor, aprovador e meio de versionamento próprios.

### 3.1 Camada 1 — Identidade global do projeto (dono: Studio)

| Informação | Cria | Edita | Aprova | Como versiona | Como chega ao Forge |
|---|---|---|---|---|---|
| Direção artística e linguagem visual | Studio/Dev | Studio/Dev | **Pessoa** | Revisão datada com autor e justificativa | Projeção mínima, por referência de versão |
| Regras de mundo, narrativa e cânone | Studio/Dev | Studio/Dev | **Pessoa** | Idem | Só o recorte que afeta o asset pedido |
| Personagens: papel, personalidade, silhueta-alvo, proporções | Studio/Dev | Studio/Dev | **Pessoa** | Por personagem, com histórico | Ficha mínima do personagem + referências |
| Paleta de cores e tokens semânticos | Studio/Dev | Studio/Dev | **Pessoa** | Por conjunto de tokens | Traits de paleta (nome, hex, papel semântico) |
| Referências aprovadas (imagens, moodboards, artworks) | Studio/Dev | Studio/Dev | **Pessoa** | Por artefato: hash + data + direitos | Artefato + hash + função declarada |
| Decisões aprovadas e pendentes do projeto | Studio/Dev | Studio/Dev | **Pessoa** | Registro append-only | Apenas as que restringem produção |
| Critérios de aceitação no contexto do jogo | Studio/Dev | Studio/Dev | **Pessoa** | Por Task/gate | **Não** são delegados ao Forge |

### 3.2 Camada 2 — Identidade de produção do asset (dono: Forge)

| Informação | Cria | Edita | Aprova | Como versiona |
|---|---|---|---|---|
| Perfil visual de produção (traits com estado `specified`/`unknown`/`not_applicable` e origem por trait) | Forge a partir da projeção **ou** manualmente, sem Studio | Forge | **Pessoa** (aprovação de versão) | Versões imutáveis com `parentRefs`, digest de conteúdo e ponteiro de versão aprovada |
| Referências com função/papel (front/side/back, expressão, roupa, prop, estilo) | Forge | Forge | **Pessoa** para uso como baseline | Por artefato com hash; papel declarado por referência |
| Identidade por asset (personagem, cabelo, roupa, acessório, parte modular, objeto) | Forge | Forge | **Pessoa** | `Asset` + `AssetVersion` imutáveis |
| Relações entre assets e versões (derivação, variante, usa-cabelo, usa-rig, usa-motion, anima, contém, usa-referência) | Forge | Forge (append-only) | — | Record novo com `supersedesRef` |
| Consistência entre vistas/ângulos/poses/expressões, entre partes e entre 2D/2.5D/3D | Forge (avaliação) | Forge | **Pessoa** (julgamento) | Avaliação por versão, com evidência e limitações |
| Materiais, texturas, iluminação e estilo de produção | Forge | Forge | **Pessoa** | Traits + artefatos com hash |
| Continuidade entre workflows e providers | Forge | Forge | — | Proveniência por execução |
| Desvios detectados, impacto e justificativas de exceção aprovada | Forge (detecta) | — | **Pessoa** (aprova exceção) | Decisão de desvio append-only ligada a versão + hash |
| Evidências de produção (arquivos, hashes, tool/versão, métricas, `unknown`) | Forge | Forge (append-only) | — | Por execução/versão |

### 3.3 Camada 3 — Requisitos técnicos de destino (dono: consumidor)

| Informação | Dono | Exemplo de conteúdo | Como se liga ao asset |
|---|---|---|---|
| Perfil de compatibilidade de destino | Consumidor (jogo via Studio; Lia Desktop; vídeo; impressão) | Formatos aceitos, resolução, transparência, FPS/loop, contagem de triângulos, orçamento de textura, plataforma, empacotamento | Declaração de exportação por entrega, ligada ao mesmo `Asset` |
| Validação de integração no destino | Consumidor | Import na engine, comportamento em jogo, apresentação no desktop | Resultado **não** é escrito pelo Forge |

**Consequência importante (evita duplicação):** um mesmo asset pode ter **N destinos** sem duplicar identidade nem origem. Isso é o que permite que **não existam pipelines separados** para "asset de jogo" e "asset da Lia Desktop": existe **um** pipeline e **um** sistema de assets, com perfis de compatibilidade de destino diferentes por entrega — exatamente o que a decisão do Studio ("não criar linha de produção separada para cada destino; adaptar requisitos/formatos de entrega") e a proposta consolidada da Forge (destinos como consumidores, `ArtifactVersion.extensions` + `ValidationResult.targetRef`, reconciliação R24) já estabelecem. O **shape** dessas extensões continua pendente (spec §11, item 12) e não é definido aqui.

## 4. As três alternativas, comparadas

Critérios pedidos, aplicados a: **A** — core compartilhado + projeções; **B** — contratos independentes + sincronização; **C** — serviço/camada central de identidade.

| Critério | A — Core compartilhado + projeções | B — Contratos independentes + sincronização | C — Serviço/camada central |
|---|---|---|---|
| **Independência dos produtos** | Alta se o núcleo for um **contrato de dados** (schema + semântica versionados), não uma biblioteca compartilhada em runtime; cada produto mantém store, estados e consentimentos próprios | Máxima: nenhum artefato comum obrigatório | **Baixa**: ambos passam a depender da disponibilidade/versão do serviço |
| **Risco de divergência** | **Baixo** para semântica (uma definição), **médio** para implementação (duas leituras do mesmo contrato) | **Alto**: dois modelos de "referência", "desvio" e "identidade" que evoluem separadamente | Baixo em semântica, mas cria divergência **novo tipo**: serviço vs. caches locais |
| **Versionamento e compatibilidade** | Núcleo versionado por `contentSchemaVersion` + projections versionadas por produto; compatibilidade negociada por faixa de versão | Cada produto versiona o seu; o **mapeador** vira o ponto de versão crítica e tende a ser o menos testado | Versionamento central simples, mas exige política de API, deprecations e clientes antigos |
| **Conflitos de edição** | Regra explícita de precedência por camada (Camada 1 = Studio; Camada 2 = Forge; Camada 3 = consumidor) + registro de conflito | Conflito aparece só na sincronização, sem dono claro | Conflito centralizado, mas o serviço precisa de autoridade que **nenhum dos dois produtos tem hoje** |
| **Funcionamento offline** | **Pleno** se o núcleo for dados + validação pura, sem rede | Pleno | **Comprometido** sem cache local; e o cache reintroduz o problema de divergência |
| **Forge sem Studio** | **Sim**: perfil opcional, traits `unknown` válidos, sem dependência de produto | Sim | Só com modo degradado explícito |
| **Outros produtos consumindo o Forge** (Lia Waifu, Lia Desktop, Lia Model Lab, vídeos) | **Sim**: cada um consome a Camada 3 e, se quiser, publica uma Camada 1 própria | Sim, mas cada par de produtos exige novo mapeador (crescimento quadrático) | Sim, e é o único caso em que C é claramente vantajoso |
| **Complexidade de implementação/manutenção** | Média: um contrato, duas projeções, governança de versão | Baixa no início, **alta no médio prazo** (N mapeadores) | Alta desde o início: serviço, auth, availability, backup, migração |
| **Rastreabilidade e auditoria** | Boa: cada afirmação tem dono, versão, hash e origem (`manual`/`imported_reference`/`ai_proposal`) | Fraca entre produtos: a auditoria para na fronteira de cada um | Excelente **se** o serviço registrar histórico append-only; senão, pior que A |
| **Impacto sobre os contratos existentes** | **Baixo**: a forma já existe na spec (`ProjectVisualProfile`/`ProjectVisualProfileVersion` com `scope` + `extensions`, `TraitOrigin`, `AssetRelationship`, `ConsistencyAssessment`, `StyleDeviationDecision`, `ChangeImpactReport`). Exige decidir scope e cross-project (spec §11, itens 3 e 11) | Médio: exige inventar e manter um mapeador **fora** da spec, que a spec não reconhece | **Alto**: introduz autoridade externa de escrita sobre entidades que hoje são locais, e conflita com "cada app mantém seus próprios estados, permissões e consentimentos" |

### 4.1 A lição do ArtCraft (`craft-ai-core` → `craft-libs`), aplicada

Caso verificado na T7 (item 15): o contrato puro `craft-ai-core` foi promovido ao repositório compartilhado `storytold/craft-libs`, mas o workspace downstream `craft-ai-integrations` **manteve cópia local** com adições (consent-term e model-folder) pendentes de revisão upstream, sem poder trocar para uma revisão upstream pinada até que as adições fossem revisadas lá — e precisou criar `docs/CORE-SYNC.md` para definir a fronteira e os **gates de troca de dependência**.

Leitura para a alternativa A: **core compartilhado não elimina divergência; ele desloca a divergência para o mecanismo de sincronização.** Portanto A só é aceitável com quatro condições, que viram requisitos da proposta:

1. **Núcleo como contrato de dados, não como código compartilhado em runtime.** Nada de biblioteca comum importada pelos dois apps; schema + semântica + validadores puros, cada produto com sua implementação.
2. **Documento de fronteira obrigatório** (equivalente a `CORE-SYNC.md`): o que pertence ao núcleo, o que é projeção, quem aprova mudança no núcleo, e quais gates impedem trocar a versão do núcleo.
3. **Pin explícito de versão do núcleo** em cada produto, com compatibilidade por faixa e teste de leitura de versão antiga.
4. **Proibição de cópia local não declarada**: qualquer adição que um produto precise fazer e que ainda não esteja no núcleo é registrada como extensão namespaced do próprio produto, e proposta ao núcleo — nunca copiada em silêncio.

### 4.2 Recomendação (não aprovada)

**Recomenda-se avaliar a Alternativa A**, com as quatro condições de §4.1 e com três restrições adicionais herdadas do Studio: (i) o núcleo **não** é a especificação Domain Contracts da Forge (item 3 de §1) — é um contrato **entre produtos**, mais estreito; (ii) o transporte continua **manual primeiro**, depois versionado, só então guiado (sequência do Studio, §9); (iii) nada de serviço central nesta fase.

**Alternativa C é desaconselhada agora** por violar offline-first e autonomia dos dois produtos, e por exigir autoridade de escrita que nenhum deles tem. **Alternativa B é aceitável apenas como estágio inicial** do caminho manual (é o que efetivamente existe hoje: brief textual + cópia manual), mas **não** como estado final, pelo crescimento quadrático de mapeadores e pelo risco de divergência silenciosa.

**Isto é uma recomendação fundamentada, não uma decisão.** A escolha é humana (pergunta 21 de [`DECISIONS-AND-OPEN-QUESTIONS.md`](DECISIONS-AND-OPEN-QUESTIONS.md)).

## 5. Versionamento e sincronização

1. **Toda afirmação de identidade é versionada e imutável.** Mudança cria novo record ligado ao anterior; nunca edição de histórico. Vale para a Camada 1 (revisões do Studio) e para a Camada 2 (versões do perfil no Forge).
2. **Vínculo por hash, não por nome.** O Forge detecta que uma referência ficou desatualizada comparando **SHA-256 do artefato** e **identificador de versão** declarados na projeção recebida com o que está gravado no perfil de produção. Hash diferente ou versão ausente ⇒ estado **`stale`**, e `stale` nunca é corrigido por suposição: gera achado de consistência e pedido de nova decisão.
3. **Detecção de defasagem em três gatilhos:** (a) ao receber nova projeção; (b) ao retomar um workflow cujo input de identidade mudou; (c) ao revalidar um asset existente após mudança de direção artística. Os três produzem ** Change Impact informativo**, nunca reescrita automática.
4. **Direção da sincronização:** Studio → Forge envia **projeção mínima** (Camada 1 recortada); Forge → Studio devolve **evidência** (Camada 2 resumida + Camada 3 declarada). Nenhum lado escreve no store do outro.
5. **Sincronização é pull explícito com registro**, não push automático: a pessoa escolhe o projeto/Task, autoriza o que compartilhar e o que receber. Isso preserva o requisito de consentimento por efeito e o fato de que hoje a passagem é manual.
6. **Offline-first:** tudo acima funciona com arquivos locais no workspace escolhido (`SPRITEFORGE_PROJECT_ROOT` pode apontar para o projeto do jogo; `LIA_HOME` define raiz comum). Nenhum mecanismo proposto exige rede, conta ou serviço.
7. **O que ainda não existe e não foi desenhado aqui:** o envelope tipado e versionado **entre produtos**. O Studio pede "envelope mínimo, tipado e versionado entre produtos, com consentimento, origem e estados independentes, negociado somente após decisão explícita" — este documento **não** o especifica; apenas enumera o que ele precisaria carregar (§8).

## 6. Conflitos, precedência e exceções aprovadas

| Situação | Regra proposta | Quem resolve |
|---|---|---|
| Projeção do Studio e perfil de produção do Forge discordam sobre o mesmo trait | **Precedência por camada**: Camada 1 pertence ao Studio; o Forge não a sobrescreve — registra `conflito` com os dois valores, hashes e versões, e pede decisão | Pessoa |
| Asset tecnicamente correto, mas incompatível com o jogo | O Forge **não** decide; emite evidência e limitações. O Studio aplica critérios de aceitação do jogo | Studio + Pessoa |
| Desvio de estilo necessário por limitação de provider/ferramenta | Registrado como **desvio** com motivo, escopo, impacto e evidência; só passa a ser aceito com **exceção aprovada** ligada a versão + hash | Pessoa |
| Referência aprovada ficou obsoleta (hash mudou / versão nova) | Estado `stale`; assets derivados marcados para revisão por Change Impact informativo; nenhuma regeneração automática | Pessoa |
| Dois destinos exigem requisitos incompatíveis para o mesmo asset | Não se duplica identidade: duas **entregas** distintas com perfis de compatibilidade de destino próprios, ligadas ao mesmo `Asset` | Consumidor + Pessoa |
| Forge usado sem Studio (Lia Desktop, Lia Waifu, vídeo, projeto pessoal) | Camada 1 ausente é estado **válido**: traits `unknown`/`not_applicable`, perfil criado manualmente ou inexistente; produção segue com gates próprios | Pessoa |

**Exceção aprovada** precisa de: identificação da versão do perfil e do asset, descrição do desvio, motivo, escopo (asset/etapa/lote), evidência, quem aprovou, quando, e efeito sobre revisões futuras. Sem esses elementos, um desvio não é exceção — é achado não tratado.

## 7. Permissões

| Ação | Studio | Forge | Consumidor | Pessoa |
|---|---|---|---|---|
| Criar/alterar identidade global (Camada 1) | Sim | **Não** | Não | Sim (aprova) |
| Criar/alterar perfil de produção (Camada 2) | Não | Sim | Não | Sim (aprova versão) |
| Aprovar versão de perfil (qualquer camada) | Não | Não | Não | **Somente a pessoa** |
| Declarar requisitos de destino (Camada 3) | Sim, para jogo | Não | Sim, para o próprio destino | Sim |
| Selecionar provider/ferramenta/workflow | **Não** | Sim, com autorização | Não | Autoriza cada efeito |
| Enviar arquivo/dado a serviço externo | Não em nome do Forge | Só com consentimento explícito | Não | Autoriza |
| Aceitar licença, custo ou instalação | Não | Não | Não | **Somente a pessoa** |
| Concluir Task, gate ou release do jogo | Sim | **Não** | Não | Sim |
| Promover asset a `VERIFIED`/aprovado visualmente | Não | Não (só evidência técnica) | Não | **Somente a pessoa** |

Nenhum produto pode aprovar em nome do outro, e **IA não aprova**: proposta de origem `ai_proposal` exige proveniência e continua sujeita a revisão humana.

## 8. Fluxo de evidências (o que cada lado precisa receber)

**Studio → Forge (projeção mínima, autorizada pela pessoa):** identificador e versão do projeto/módulo/Task; tipo de asset pedido; objetivo e verificação planejada (o que o Studio já envia hoje no brief manual); traits de identidade relevantes com estado e origem; referências aprovadas com **hash, função declarada e direitos**; requisitos de destino; restrições de produção declaradas. **Não** inclui: GDD inteiro, narrativa completa, arquivos do projeto, mídia não autorizada, prompts anteriores, memórias, credenciais.

**Forge → Studio (evidência de produção):** caminhos relativos dos arquivos reais; tamanho e **SHA-256 calculado após o arquivo existir**; formato/semântica e resultado da validação técnica; ferramenta/provider e versão efetivamente usados; etapas concluídas, puladas e reutilizadas; referências efetivamente usadas (com hash) e versão do perfil de produção aplicada; **desvios detectados com impacto**; **limitações e `unknown`** (o que não foi medido, o que não foi testado, em qual hardware); direitos/atribuições exigidos por componente. **Não** inclui: JSONs internos da Forge como protocolo, aprovação visual, garantia de funcionamento na engine.

**Regra de integridade do fluxo:** ausência de erro **não** é aprovação; `complete` no Forge **não** conclui Task; hash intacto **não** valida licença, visual nem engine.

## 9. Sequência recomendada (herdada do Studio, sem atalhos)

1. **Handoff manual verificável** (estado atual: existe no Studio como prévia de brief; na Forge não há receptor específico — a entrada é texto/arquivos escolhidos pela pessoa). Critério de saída: um asset real produzido, revisado, copiado/importado explicitamente e catalogado no Studio com caminho, hash e procedência.
2. **Contrato versionado + importação supervisionada.** Só depois de decididos: alternativa (A/B/C), envelope entre produtos, precedência de conflito, escopo do perfil e cross-project. Critério de saída: leitura e escrita de uma projeção com versão e hash, testada **com o outro produto ausente**.
3. **Experiência guiada ponta a ponta.** Testada com Forge ausente, Forge atualizado, output alterado no meio do fluxo e jogo rodando na engine. Critério de saída: retomada de Task no Studio sem perda de estado quando o Forge fecha ou falta.

Nenhuma etapa autoriza a seguinte por si só; cada uma exige decisão humana registrada.

## 10. Impacto nos contratos existentes (indicado, não implementado)

Nenhum contrato foi alterado. Os impactos e as decisões que eles exigem estão detalhados em [`DOMAIN-CONTRACTS-EVOLUTION-PROPOSAL.md`](DOMAIN-CONTRACTS-EVOLUTION-PROPOSAL.md) §14 (itens I-1 a I-6): `scope` do `ProjectVisualProfile` limitado a `kind: "project"` em v1; `AssetRelationship` com `projectRef` único (spec §11, item 11) que **não** representa relação entre projetos distintos; ausência de regra de precedência entre projeções; propriedade e versionamento do núcleo; meio de armazenamento; e preservação do funcionamento sem Studio. A especificação continua `DRAFT_FOR_HUMAN_REVIEW — NOT AUTHORIZED FOR IMPLEMENTATION`.

## 11. Questões abertas desta arquitetura (exigem aprovação humana)

1. Alternativa **A**, **B** ou **C** — e, se A, o núcleo é um pacote de schema/validadores puros ou apenas um documento normativo?
2. Onde vive o registro compartilhado: arquivo no workspace do projeto, banco local, ou descoberta pelo mecanismo do ecossistema (`%APPDATA%\Lia\lia.json`, `HKCU\Software\Lia`)?
3. Quem aprova mudança no núcleo e qual o gate de troca de versão (o equivalente a `CORE-SYNC.md`)?
4. `AssetRelationship` passa a aceitar endpoints de Projects diferentes, ou a ligação Studio↔Forge usa outro mecanismo?
5. `ProjectVisualProfile.scope` ganha `kind` além de `"project"` (por produto, por destino)?
6. Qual o vocabulário de `asset_kind` do envelope entre produtos: mantém os quatro do Studio (`concept`, `model`, `rig`, `spritesheet`) ou usa as categorias extensíveis da Forge (que incluem itens, ambientes, 2D/2.5D)?
7. Como o Studio registra e exibe `stale`, `conflito` e `desvio` recebidos do Forge sem transformar isso em gate automático?
8. A prévia de brief do Studio passa a incluir hash de referências e versão de perfil, ou continua deliberadamente sem anexos (como hoje)?
9. Publica-se/consolida-se a fronteira também no lado do Studio (o arquivo lá está em branch `arena/*`, não em `main`)?

## 12. O que este documento não faz

1. Não implementa, não altera código, não altera contratos, não cria schema nem envelope.
2. Não aprova nenhuma alternativa nem transforma recomendação em decisão.
3. Não altera nenhum arquivo do repositório `BloomRX/Lia-Studio` (leitura apenas, via API).
4. Não declara que o Forge ou o Studio possuem capacidade não comprovada: o estado do checkout da Forge está em [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md) e o do Studio é o declarado nos documentos dele.
5. Não inventa datas de aprovação nem estados `VERIFIED`.
