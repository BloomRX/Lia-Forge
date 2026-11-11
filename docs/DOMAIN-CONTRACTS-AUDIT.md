# Auditoria arquitetural dos contratos de domínio experimentais

**Data:** 2026-11-07
**Escopo:** leitura estática dos contratos em `shared/domain/contracts.mjs` e seu smoke test, comparados com o manifesto e os contratos de workflow atuais, o store e os documentos de arquitetura.
**Natureza:** auditoria somente leitura. Nenhuma implementação, migração ou mudança de teste foi feita nesta auditoria.

## Veredito executivo

**Conclusão: a proposta é um bom começo para uma camada de dados pura, mas não é uma base suficiente para integrar agora o Project Identity & Consistency Engine. O domínio deve ser ampliado e suas fronteiras esclarecidas antes de conectá-lo ao store, à UI, ao runner ou ao MCP.**

O protótipo acerta em três pontos estreitos: valida records JSON sem depender de Electron/React/provider; recebe um catálogo explícito de tipos de asset sem enum global; e separa sintaxe de metadados de inspeção de arquivos. Isso é reutilizável. Mas hoje ele modela envelopes mínimos de Project/Asset/Artifact/Version/Provenance/ValidationResult — não identidade visual compartilhada, relações entre assets, estilo aprovado/“travado”, análise de consistência ou impacto de mudanças. Também não tem um codec ou migration para os registros de `.spriteforge/`, o manifesto de spritesheet ou os snapshots de workflow.

**Decisão recomendada:** preservar o protótipo como `EXPERIMENTAL`, especificar primeiro o modelo de identidade, relações, avaliação e compatibilidade e só depois desenhar a integração. Não substituir nem migrar os formatos existentes nesta etapa. A arquitetura-alvo documentada continua sendo `PLANNED`; documentação ou fixtures não provam integração.

## Taxonomia de classificação

Cada achado usa duas dimensões independentes:

- **Classificação da auditoria:** `PASS` (somente a alegação estreita demonstrada), `GAP` (contrato ou comportamento necessário ausente/incompatível), `RISK` (falha plausível se integrar como está), `PROPOSED` (recomendação) ou `NOT_VERIFIED` (sem evidência suficiente).
- **Maturidade da implementação:** `IMPLEMENTED`, `VERIFIED`, `PARTIALLY_IMPLEMENTED`, `DOCUMENTED`, `PLANNED`, `EXPERIMENTAL`, `BLOCKED` ou `PROPOSED`. `VERIFIED` sempre se limita ao artefato, fixture e ambiente explicitamente citados; um smoke não é E2E.

## Matriz de dez tópicos

| # | Tópico | Resultado | Síntese |
|---|---|---|---|
| 1 | Identidade do projeto | `GAP · EXPERIMENTAL` | Há ID, política de raiz opaca e alguns metadados técnicos; não há identidade visual versionada do projeto. |
| 2 | Perfil visual e style lock | `GAP · EXPERIMENTAL` | Não existem perfil-base, referências aprovadas, modos de liberdade/guia/lock, exceções ou reaprovação vinculada a versão. |
| 3 | Relações entre assets e impacto | `GAP · EXPERIMENTAL` | Parent IDs registram algumas referências de lineage, mas não formam grafo de relações tipadas nem análise de impacto. |
| 4 | Consistency Analysis | `GAP · EXPERIMENTAL` | `ValidationResult` não representa comparação visual/técnica entre versões, assets e perfil do projeto. |
| 5 | Taxonomia extensível | `PASS · EXPERIMENTAL` / `GAP · IMPLEMENTED` | O catálogo experimental aceita IDs registrados arbitrários; o runtime atual ainda limita tipos a `character`/`item`. |
| 6 | Store de assets e migração | `GAP · PARTIALLY_IMPLEMENTED` | O schema experimental não lê diretamente `.spriteforge/assets.json`; não existe codec/migration nem política de compatibilidade entre os dois. |
| 7 | Coexistência com workflows/manifests | `GAP · PARTIALLY_IMPLEMENTED` | WorkflowPlan/Run e o manifesto têm contratos próprios; não há mapeamento explícito entre eles e Artifact/AssetVersion. |
| 8 | Fronteiras domínio/workflow/provider/store | `PASS · EXPERIMENTAL` (isolamento) / `GAP` (contratos entre camadas) | O módulo é puro e isolado, mas faltam referências tipadas e um contrato de handoff para as outras camadas. |
| 9 | Versões, proveniência e direitos | `GAP · EXPERIMENTAL` / `RISK` | IDs/hashes têm validação de forma; relações, bytes reais, direitos e segredos não são verificados nem protegidos pelo domínio. |
| 10 | Validação estrutural versus avaliação visual | `PASS · IMPLEMENTED` (separação documentada/estrutural) / `NOT_VERIFIED` (avaliação real) | Checks atuais são estruturais. Não há engine de consistência visual nem ledger geral de revisão humana. |

## Achados detalhados

### 1. Identidade do projeto

**`GAP · EXPERIMENTAL`.** `validateProject` exige `id`, `schemaVersion`, `rootPolicy` não vazio e `createdAt`; aceita `engine` e `targets` (`shared/domain/contracts.mjs:200–221`). `validateAsset` exige um `projectId` sintaticamente válido (`:224–250`). Isso é uma identidade técnica mínima, não uma definição da identidade visual compartilhada que o projeto deve preservar.

`rootPolicy` é deliberadamente opaco: o validador não interpreta nem aplica permissões, raízes ou identidade visual. Campos adicionais podem ser copiados como JSON, mas não ganham semântica só por estarem presentes. Brief/prompt por asset também não substitui uma referência canônica, versionada e aprovada do projeto.

### 2. Perfil visual e style lock

**`GAP · EXPERIMENTAL`.** Não há entidade `ProjectVisualProfile`/perfil equivalente, referência a uma versão do perfil no Project/Asset, conjunto de referências visuais aprovadas, nem política de estilo. Portanto não é possível expressar de forma auditável “livre”, “guiado” ou “locked”, qual versão estava em vigor, quais desvios foram autorizados ou quem aprovou uma mudança.

As instruções do task spec atual para preservar silhueta, paleta, escala e câmera (`scripts/spriteforge-mcp.mjs:247–253`) são orientação textual do handoff, não um contrato de identidade medido ou aplicado. Se esses modos forem adotados, devem ser políticas versionadas e revogáveis — não um enum de tipos de asset nem uma promessa de que qualquer provider consegue obedecê-las. Um lock deve poder ser alterado deliberadamente pelo usuário, com justificativa e nova aprovação.

### 3. Relações entre assets, lineage e impacto de mudanças

**`GAP · EXPERIMENTAL`.** Existem `AssetVersion.parentVersionIds`, `Artifact.parentArtifactIds` e listas de IDs de artefatos em versões/proveniência (`shared/domain/contracts.mjs:269–310`). São boas pistas para lineage básico, mas não expressam relações semânticas entre assets — por exemplo, personagem usa item, asset pertence a conjunto, versão implementa variante, ou material é aplicado a modelo — nem direção, papel ou escopo de uma relação.

Os validadores só rejeitam autorreferência direta. Não resolvem referências inexistentes, propriedade entre projetos/Assets, ciclos de vários nós ou dependentes afetados. `currentVersionId` também é validado apenas como ID, sem provar que aponta para uma versão do mesmo asset (`:245–247`). Logo, não existe base para Change Impact Analysis que identifique quais assets, renders, reviews ou etapas precisam ser reavaliados quando um perfil/asset muda.

### 4. Consistency Analysis

**`GAP · EXPERIMENTAL`.** `ValidationResult` associa um resultado a um `artifactId`, um hash em formato SHA-256, `validatorId/version`, horário, `status`, `checks` e limitações (`shared/domain/contracts.mjs:313–328`). Mas `status` é qualquer texto não vazio e os objetos em `checks` não têm esquema de campos. O hash não é comparado com bytes nem com um `Artifact` carregado. Não há dimensão/tipo de avaliação, conjunto de assets comparados, referência à versão do perfil, achados, severidade/confiança, evidência ou revisão humana.

Esse envelope pode ser uma base para registrar **um resultado estrutural por artefato/hash**, após fortalecer o contrato. Não é por si só um motor de consistência: não compara artefatos entre si nem avalia identidade visual/técnica de projeto.

### 5. Extensibilidade da taxonomia

**`PASS · EXPERIMENTAL` (escopo estreito).** `createAssetTypeCatalog` não embute categorias e aceita descritores com IDs registrados; o smoke registra `environment.background` além de `character` e `item` (`shared/domain/contracts.mjs:150–198`; `tests/domain-contracts-smoke.mjs:22–49, 81–90`). Isso evita congelar o domínio experimental numa enumeração global.

**`GAP · IMPLEMENTED` no produto atual.** O store valida `asset.type` como `character` ou `item` (`electron/main.cjs:186–205`); o MCP declara `z.enum(['character', 'item'])` (`scripts/spriteforge-mcp.mjs:396–415`); o manifesto da spritesheet também exige um desses dois tipos (`electron/spritesheet-manifest.cjs:12–24`). Uma entrada no catálogo experimental não habilita automaticamente UI, store, pipeline, validator ou export.

Além disso, o catálogo atual só verifica que `inputContracts`/`outputContracts` são arrays; não valida os membros. Registrar um tipo não declara que existe adapter/capability para produzi-lo. A extensão futura deve ser por registro/contrato específico e disponibilidade de adapters, sem transformar a taxonomia inteira em enum; tipo registrado sem rota ou validator aplicável deve ficar claramente `BLOCKED`, não ser tratado como suportado.

### 6. Compatibilidade com o store de assets atual

**`GAP · PARTIALLY_IMPLEMENTED`.** O store atual tem `schemaVersion: 1` no envelope e grava asset records com `type`, `stageStatus`, `startStageIndex`, `entryPointId`, `existingInputs`, `outputPath`, prompts/referências e outputs (`electron/main.cjs:171–205`; criação MCP em `scripts/spriteforge-mcp.mjs:396–453`). O protótipo exige `schemaVersion`, `projectId` e `assetTypeId` em cada record (`shared/domain/contracts.mjs:224–250`); esses campos e o mapper não existem nos records legados. O protótipo tampouco modela diretamente os estados e os bindings de entrada/saída por etapa usados pelo store atual.

Não é seguro passar os records atuais direto por `validateAsset` nem renomear `type` para `assetTypeId` sem uma tradução versionada. Uma integração futura deve preservar sem perda os IDs, paths, pontos de entrada, artefatos e estados existentes; produzir relatório de migração, permitir rollback e não alterar os originais antes de validação. O destino físico `.spriteforge/` deve permanecer por compatibilidade enquanto uma migração não for decidida e testada.

### 7. Coexistência com manifest e contratos de workflow

**`GAP · PARTIALLY_IMPLEMENTED`.** O manifesto real é um contrato especializado de spritesheet: `schemaVersion: 1`, `assetType: character|item`, dimensões/grade, animações, frames, pivôs, duração e `sourceFrame` (`electron/spritesheet-manifest.cjs:12–88`; gerado em `scripts/blender_spritesheet.py:254–291`). Isso não é substituído por `Artifact` genérico. O validador do manifesto deve continuar sendo a autoridade estrutural desse formato, com uma tradução explícita de/para os metadados de domínio se aprovada.

`electron/workflow-contracts.cjs:4–80, 191–236` descreve o plano humanoide de cinco etapas e contratos de inputs/outputs; etapas sem adapter executável ficam bloqueadas. `electron/blender-workflow-plan.cjs:12–51` constrói o plano real de uma etapa de render a partir de modelo existente. O runner valida uma lista ordenada cujas dependências têm de aparecer antes (`electron/workflow-runner.cjs:383–416`), grava runs `schemaVersion: 2` (`:516–537`) e a retomada desktop reconhecida é específica ao workflow Blender de um estágio (`electron/resume-workflow.cjs:4–28`; auditoria em `docs/IMPLEMENTATION-AUDIT.md:38–42`).

O módulo experimental não define `WorkflowDefinition`, `WorkflowPlan`, `WorkflowRun` ou `StepRun`, nem vincula Artifact/AssetVersion a `runId`/`stepId`. Isso é aceitável para manter o domínio separado do executor, mas exige um contrato de referência/mapper; não se deve representar o estado de execução dentro de `AssetType` ou confundir um snapshot de run com versionamento de asset. O ponto de entrada atual (`startStageIndex`, `entryPointId`, `existingInputs`) precisa ser preservado por esse mapper (`scripts/spriteforge-mcp.mjs:173–199, 396–453`).

### 8. Fronteiras entre domínio, workflow, provider e store

**`PASS · EXPERIMENTAL` quanto ao isolamento.** `shared/domain/contracts.mjs` é um módulo de dados/validação pura: não chama filesystem, UI, MCP, provider nem runner. Também declara que `uri` não é resolvido e que a existência de referências fica para uma futura camada (`:1–14, 253–275, 278–300`). Isso é uma fronteira promissora.

**`GAP` quanto ao contrato entre camadas.** O domínio não especifica como o store comprova paths, symlinks, hash real, existência, unicidade global ou integridade referencial. Isso não deve ser remediado fazendo o validador puro acessar o disco: cabe ao store/repository resolver e validar persistência/refs e ao adapter registrar outputs reais. Workflow define planos/etapas/estados; provider hub define capabilities/adapters/invocações e efeitos; domínio deve guardar identidades e evidências referenciáveis. Strings como `capabilities`, `workflowRefs` e `validatorIds` no descritor não substituem os respectivos registries nem provam que algo esteja instalado ou executável.

### 9. Versões, proveniência, direitos e dados sensíveis

**`GAP · EXPERIMENTAL` / `RISK`.** O módulo checa formato de ID/hash, listas e timestamps, mas não verifica bytes do arquivo, coerência MIME/extensão, destino permitido, existência de referências ou ciclos de lineage. `AssetVersion` só rejeita o próprio ID como pai; `Object.freeze` protege o snapshot retornado em memória, não torna uma versão imutável no store (`shared/domain/contracts.mjs:253–295`). Um `schemaVersion` local único (`DOMAIN_SCHEMA_VERSION = 1`) não define compatibilidade, migrations ou upgrade de records antigos.

`Provenance.sources` e `transformations` são objetos JSON genéricos; não exigem autor/origem/hash, modelo/provider/versão, licença/termos, consentimento ou relação com um run. O código aceita texto arbitrário nesses objetos — inclusive uma chave/token — sem redação. Assim, provenance pode ser preservada como envelope experimental, mas não deve ser anunciada como trilha de direitos ou garantia contra vazamento. A política de licença/consentimento e a proteção de segredos precisam ser contratos próprios e enforcement fora do schema puro, em linha com `docs/ASSET-MANAGEMENT.md:35–44` e `docs/WORKFLOW-ENGINE.md`.

### 10. Validação estrutural, avaliação visual e evidência de testes

**`PASS · IMPLEMENTED` (somente checks estruturais conhecidos).** `electron/png-validation.cjs:16–69` confere assinatura, chunks, CRC, dimensões, formato e canal alpha RGBA8; não decodifica os pixels para provar que há transparência real. `electron/spritesheet-manifest.cjs` verifica grade, nomes, ordem, bounds, pivôs e durações. Essas evidências não dizem se a silhueta, identidade, estilo, movimento ou adequação ao jogo está correta. `docs/VISUAL-QA-BENCHMARK.md:1–15, 65–76` e `docs/usage-workflows.md:38–40` mantêm essa distinção e requerem revisão humana.

**`NOT_VERIFIED` para avaliação visual real.** Não há no protótipo um visual evaluator, comparação contra perfil/referências, ledger geral de revisão ou aprovação invalidada por mudança do hash/perfil. A infraestrutura ampla de Visual QA permanece `PLANNED` (`docs/IMPLEMENTATION-AUDIT.md:42–44`). Nenhum PNG válido, JSON conforme, run concluído ou smoke test prova qualidade artística.

O smoke `tests/domain-contracts-smoke.mjs:22–201` cobre catálogo, snapshots, forma de records, hashes em formato, referências locais e rejeições de dados inválidos/cíclicos. O comando de smoke isolado havia passado anteriormente; isso verifica apenas fixtures/funções puras. **Não** é teste de integração com store/manifest/runner, não valida migração, não executa Blender/ComfyUI e não é E2E ou aprovação visual. Também não demonstra runtime na plataforma-alvo.

## Proposta de correção antes da integração

**`PROPOSED` — especificar e revisar, sem implementar nesta auditoria:**

1. **Project Identity:** adicionar um perfil visual versionado separado do simples envelope Project; ligar projeto, perfil, referências aprovadas e versões sem confundir isso com `engine`/`targets`.
2. **Style lock:** declarar modo/política por projeto ou execução (por exemplo, livre/guiado/locked), perfil-version alvo, limites e exceções. Exigir consentimento/revisão para mudar o lock; o lock expressa uma restrição, não prova que o provider a cumpriu.
3. **Relações:** introduzir arestas versionadas entre Asset/AssetVersion com predicado extensível, origem/alvo e provenance. Separar relação semântica entre assets de derivação `Artifact → Artifact` e de ancestry `AssetVersion → AssetVersion`.
4. **Consistency Analysis:** separar `StructuralValidationResult`, avaliação técnica/visual entre artefatos e `HumanReview`. Registrar versões de inputs/perfil/evaluator, findings, evidência, limitações e hash exato. Valores desconhecidos devem permanecer `unknown`/`review_required`; não inventar score universal.
5. **Change Impact:** produzir relatório de dependentes/reviews/workflows potencialmente invalidados após uma mudança de perfil, relação ou artefato. O relatório sugere revalidar/revisar; não regenera nem apaga outputs automaticamente.
6. **Workflow linkage:** manter Definition/Plan/Run/StepRun no domínio de workflow. Ligar outputs a Artifact/Provenance por IDs de run/step e contrato, sem embutir implementação de provider ou status do scheduler em AssetType.
7. **Integridade e migrations:** definir quem valida existência, ownership e referências no store; escrever codecs separados para os formatos atuais; versionar migrations e provar preservação/rollback. Não escolher um backend nem um novo formato de manifesto por inferência.
8. **Extensão:** manter registro de tipos não fechado; capabilities, adapters, validators e rotas determinam o que é executável. Tipo novo sem capacidade compatível deve ser mostrado como indisponível/bloqueado, não traduzido para `character`/`item`.

### Recomendações concretas por arquivo

| Arquivo/área | Recomendação para a futura integração |
|---|---|
| `shared/domain/contracts.mjs` | Conservar a camada pura, mas revisar Project/Asset/Version e os invariantes antes de estabilizar schema. Separar os contratos propostos de perfil visual, relações e avaliações se isso deixar os módulos mais legíveis. Definir explicitamente política de campos desconhecidos, status e compatibilidade de schema. |
| `shared/domain/` (módulos futuros) | Proposta, não trabalho desta auditoria: contratos versionados para perfil/style lock, relações/change impact e resultados de consistência/revisão. Não implementar engine visual como se fosse um simples validador de JSON. |
| `electron/main.cjs` e `scripts/spriteforge-mcp.mjs` | Adicionar futuramente um mapper explícito do modelo legado (`type`, stage states, inputs/outputs e paths), sem substituir os records em massa nem descartar campos desconhecidos. Não trocar a enum do MCP por uma enum global de todos os assets; consultar capacidades de rota quando houver registry real. |
| `electron/spritesheet-manifest.cjs`, `scripts/blender_spritesheet.py`, `electron/blender-adapter.cjs` | Preservar o contrato spritesheet v1 e seus gates. Se houver integração, mapear `AssetType` extensível para o contrato específico do renderer; rejeitar/bloquear tipo sem suporte explícito. Não alegar que o manifesto universaliza categorias. |
| `electron/workflow-contracts.cjs`, `electron/blender-workflow-plan.cjs` | Ligar planos/outputs às versões do Asset e do perfil; manter contratos de etapa e autorização específicos do workflow fora do domínio central. Marcar adapters ausentes como `BLOCKED`, sem outputs simulados. |
| `electron/workflow-runner.cjs`, `electron/workflow-run-store.cjs`, `electron/resume-workflow.cjs` | Introduzir compatibilidade por mapper/versão para snapshots `schemaVersion: 2`; preservar semântica do runner serial e da retomada específica. Não declarar DAG geral nem version graph a partir dos snapshots atuais. |
| `electron/png-validation.cjs` e QA | Manter resultados estruturais distintos de avaliação visual. Vincular check ao hash efetivamente medido; revisão humana continua separada e deve ser invalidada por mudança de artefato/perfil. |
| `docs/ASSET-MANAGEMENT.md`, `docs/ASSET-PIPELINES.md`, `docs/WORKFLOW-ENGINE.md`, `docs/VISUAL-QA-BENCHMARK.md` | Usar como arquitetura-alvo `PLANNED`, não como comprovação. Após uma integração futura, atualizar estado e evidências por módulo, teste e plataforma. |

## Testes adicionais necessários antes de declarar integração

- **Unitários de domínio:** IDs/extensões sem enum fechado; descritores inválidos; perfis e versões imutáveis; estados desconhecidos; campos extras; relações ausentes, duplicadas, entre projetos e ciclos; `currentVersionId` pertencendo ao Asset correto.
- **Style lock e identidade:** alteração deliberada de perfil, desvio autorizado, bloqueio sem aprovação e invalidação de review quando muda hash ou versão de perfil. Os testes não podem transformar similaridade visual heurística em aprovação artística automática.
- **Change impact:** alteração num Asset/perfil identifica somente dependentes relevantes, preserva ramos independentes e nunca executa/regenera/apaga como efeito implícito.
- **Store/segurança:** round-trip JSON, referências inexistentes, arquivo ausente/trocado, hash de bytes divergente, MIME/format mismatch, path traversal, symlink, limites de tamanho, secrets em provenance, crash na escrita e atomicidade.
- **Fixtures de compatibilidade:** assets reais anonimizados de `.spriteforge/assets.json` para `character` e `item`, com pontos de entrada e etapas completas/parciais/skipped; snapshots de run v2; manifests v1 produzidos pelo script Blender. Verificar conversão de ida/volta, relatório de diferenças, idempotência e rollback sem mexer nos originals.
- **Workflow linkage:** etapa bloqueada sem adapter, entrada intermediária reutilizada com validator/hash, output parcial, revisão pendente, cancelamento e retomada sem execução duplicada; run/step vincula o Artifact correto.
- **Validação vs visual:** PNG RGBA8 totalmente opaco deve poder passar o check estrutural sem ser confundido com transparência visual; revisão do arquivo real registra hash, contexto/escala, reviewer e limitações; qualquer alteração de bytes invalida a aprovação anterior.
- **Integração/E2E por escopo:** execução real do Blender para um modelo/ações suportados, com output e hashes; ComfyUI apenas no endpoint/configuração declarados. Manter separado smoke de protocolo, integração de adapter e E2E de plataforma. Inspeção humana da arte é evidência adicional, não substituída pelo teste.

## Condições de segurança para a futura integração

- Não alterar nem migrar `.spriteforge/`, manifestos, pipelines ou providers como parte de uma integração baseada apenas neste relatório.
- Antes de integrar os quatro arquivos originais referidos no pedido, identificar um baseline confiável fora de uma suposição automática de `HEAD`; apresentar a estratégia e riscos de comparação/restauração e um backup verificável. Não recriar commits/refs nem force-push.
- Manter os statuses `IMPLEMENTED`, `VERIFIED`, `PARTIALLY_IMPLEMENTED`, `DOCUMENTED`, `PLANNED`, `EXPERIMENTAL`, `BLOCKED` e `PROPOSED` ligados a evidência de escopo. Não promover smoke tests a E2E nem validação estrutural a avaliação visual.

## Conclusão final

**Base adequada para continuar o desenho? Sim, como protótipo puro de records e registro extensível. Base adequada para integrar já? Não.** O domínio ainda precisa representar identidade visual compartilhada, política de consistência, relações e impacto de mudanças, e precisa de um caminho de compatibilidade explícito com os formatos atuais. Preserve os bons limites de camada, corrija o modelo antes de integrá-lo e mantenha o manifesto/runner atuais como contratos especializados até que mappers e migrations tenham fixtures, backup, rollback e evidência verificável.
