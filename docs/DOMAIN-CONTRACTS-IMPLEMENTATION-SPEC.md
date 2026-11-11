# Lia Forge — especificação técnica dos Domain Contracts (pré-implementação)

**Estado:** `DRAFT_FOR_HUMAN_REVIEW — NOT AUTHORIZED FOR IMPLEMENTATION`  
**Snapshot original da proposta:** 2026-10-25 (UTC; preservado, não é data de aprovação)  
**Data efetiva desta revisão:** 2026-11-09 (UTC; data documental da revisão de reconciliação técnica)  
**Revisão anterior:** 2026-10-25 (UTC; redação original desta especificação, preservada como histórico)  
**Reconciliação pós-revisão integral:** aplicada sobre a revisão de 2026-11-09, sem re-datar registros (§12); correções 22–42 em §13.1, recomendações R16–R25 em §13.3(b), novas subseções §4.6 e §8.1–§8.3, invariante 13 em §9.3; nenhum item de §11 aprovado  
**Data de aprovação humana desta especificação:** não registrada; permanece pendente  
**Data da aprovação humana da arquitetura:** não registrada separadamente; não inferida do snapshot ou do campo Data do ADR  
**Referências:** [Proposta consolidada](LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md) · [ADR-001](ADR-001-LIA-FORGE-DECISIONS.md)

> Esta especificação transforma a arquitetura aprovada em uma proposta concreta de contratos, mas **não é uma autorização de código**. Recomendações abaixo marcadas `PENDENTE DE APROVAÇÃO` não são defaults. O Codex só receberá o pacote depois de revisão e aprovação humana desta especificação e de autorização separada para implementação.

## 1. Objetivo, escopo e vocabulário de decisão

O escopo é definir a superfície pura dos primeiros Domain Contracts, as relações entre records, lifecycle, regras de validação, exemplos sintéticos e critérios de aceite. Não se implementa nada nesta etapa.

### 1.1 Restrições já aprovadas — não reabrir neste pacote

- Lia Forge é o único produto/interface; `Lia3DCreate` e `Lia3DSprite` são módulos first-party. Painel Blender só é uma interface técnica auxiliar se uma operação exigir interação direta com Blender.
- `ProjectVisualProfile` é global por Project em v1; o desenho pode evoluir para escopos futuros, sem herança em v1.
- `.spriteforge/` permanece intacto; não criar `.spriteforge/project.json`, não escolher banco ou persistência, não migrar e não inferir `Project.id` de caminho/nome.
- `Asset`, `AssetVersion`, `ArtifactVersion` e `Artifact` têm semânticas distintas; tudo é imutável quando representa uma versão/bytes/decisão. Aprovação é humana.
- Só aprovação humana aplicável aos IDs/hashes exatos pode autorizar atualização de `Asset.currentVersionId` (nome semântico do ADR/proposta; esta spec propõe o nome concreto `currentVersionRef` — ver §2.1 e §13.1); a operação é transacional e pertence ao Store futuro.
- A primeira homologação técnica será modelo existente → setup de câmera/animação → PNG + manifesto → validação estrutural → avaliação visual → aprovação humana. Não requer `Lia3DCreate`.
- Blender e WebGL/SpriteForge devem ser comparados com o mesmo input e critérios; renderer padrão continua sem escolha.
- Windows, inclusive RX 580 8 GB, é alvo de homologação, não suporte declarado. Direitos de código, componentes, inputs e outputs são avaliados separadamente.
- Domain não acessa filesystem, Electron, UI, rede, Blender, providers ou processos externos.

### 1.2 Rótulos usados nesta especificação

- **Aprovado:** decisão registrada na proposta/ADR; não equivale a código aprovado.
- **Proposta:** estrutura concreta recomendada para esta revisão; aguarda decisão humana.
- **Aberto:** exige resposta/decisão antes de congelar o schema ou começar o primeiro código.
- **Fora de escopo:** outro pacote/camada, ainda que esta especificação defina a fronteira.

Palavras `MUST`, `MUST NOT`, `SHOULD` e `MAY` são usadas somente dentro de uma decisão aprovada; os campos concretos descritos abaixo ainda são propostas até aprovação humana.

## 2. Convenções comuns propostas

### 2.1 JSON, envelope e unknowns

**Proposta para todos os 17 records:** JSON puro, UTF-8, sem `undefined`, `NaN`, `Infinity`, funções, bytes inline ou instâncias de runtime. Todo record de topo tem:

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `recordType` | string literal | sim | Discriminador igual ao nome do contrato, por exemplo `"AssetVersion"`. |
| `schemaVersion` | integer | sim | Inteiro positivo, independente de versão de produto, workflow, modelo ou arquivo legado. |
| `id` | `RecordId` ou `ArtifactId` | sim | Identidade estável conforme §2.3; não é path/nome/slug. |
| `extensions` | `Record<string, ExtensionEnvelope>` | não | Só dados namespaced, versionados e preservados. Ausência equivale a `{}`; nunca descartar extensão desconhecida em mapper futuro. |

Campos core desconhecidos ou malformados são erro estrutural. Dados de extensão desconhecidos são preservados sem interpretação. Valores desconhecidos de registries namespaced são aceitos sintaticamente com diagnóstico `unknown_registry_value`; nunca são convertidos para um enum conhecido.

A arquitetura aprova a semântica das relações, não nomes/serialização concretos. **Nomes propostos como canônicos para o pacote de contracts (pendentes de aprovação):** `Asset.currentVersionRef`, `Project.visualProfileRef` e `ProjectVisualProfile.currentApprovedVersionRef`, todos como `RecordRef<T>` tipada. Eles correspondem semanticamente a `Asset.currentVersionId` e `Project.visualProfileId` da proposta consolidada e do ADR-001 — os nomes `*Id` desses documentos permanecem válidos como descrição da semântica aprovada; a forma `*Ref` é a serialização concreta proposta e não substitui contrato executável nem está aprovada até revisão humana (ver §13.1, item 2, e §13.4). O envelope `recordType` e a forma `RecordRef` abaixo são igualmente propostas novas.

`ExtensionEnvelope = { "schemaVersion": integer, "data": object }`. O namespace da chave é um identificador namespaced (`org.example.feature` ou `lia.feature`). Não colocar paths absolutos, tokens, credenciais ou bytes privados em `extensions`.

### 2.2 Tipos compartilhados

| Tipo | Forma proposta |
|---|---|
| `Instant` | String RFC 3339 com timezone obrigatório; timestamps serializados em UTC (`Z`). Validador puro confere formato e ordem local, sem consultar relógio. |
| `NonEmptyString` | String com pelo menos um caractere não-whitespace; não normalizar/reescrever o conteúdo. |
| `Sha256Hex` | Exatamente 64 caracteres hexadecimais minúsculos. |
| `RecordRef<T>` | `{ "recordType": T, "id": RecordId, "schemaVersion": integer }`; `T` é inferido/validado pelo campo que contém a referência. |
| `ArtifactRef` | `{ "recordType":"Artifact", "id":"sha256:<64 hex>", "schemaVersion":1, "sha256":"<mesmo hex>" }`. |
| `Digest` | `{ "algorithm":"sha-256", "canonicalizationId": NonEmptyString, "value": Sha256Hex }`; o algoritmo de canonicalização permanece aberto para o profile e hashes de records compostos. |
| `Trait<T>` | `{ "state":"specified", "value":T, "origin":TraitOrigin }`, `{ "state":"unknown" }` ou `{ "state":"not_applicable" }`. Omissão não significa `unknown`. |
| `Reported<T>` | `{ "state":"reported", "value":T }`, `{ "state":"unknown" }` ou `{ "state":"not_applicable" }`; describe evidência declarada, não verificada pelo Domain. |
| `TraitOrigin` | União discriminada `manual`, `imported_reference` ou `ai_proposal`; campos por origem definidos em §3.8. |
| `OpaqueRef` | Referência tipada cujo `recordType` é uma string namespaced ainda não reconhecida; preservada com warning, sem traversar/propagar. |
| `EvidenceRef` | União `{ "kind":"record", "ref":RecordRef }`, `{ "kind":"artifact", "ref":ArtifactRef }` ou `{ "kind":"url", "uri":string, "checkedAt":Instant|null }`; URL é dado de evidência, não fetch autorizado. |

Para listas de IDs, a serialização preserva ordem se ela tiver significado declarado. Onde a ordem não tiver significado (pais, artefatos em um conjunto, hash witnesses), a validação SHOULD exigir ordem estável lexicográfica ou o produtor deve documentar a ordem; nunca deduzir a ordem do filesystem.

### 2.3 Estratégia de IDs — proposta, não aprovada

| Entidade | Forma proposta | Geração/validação |
|---|---|---|
| Records **imutáveis / append-only** (`AssetVersion`, `ArtifactVersion`, `ProjectVisualProfileVersion`, `Provenance`, `ValidationResult`, `HumanReview`, `ConsistencyAssessment`, `StyleDeviationDecision`, `ChangeImpactReport`, `ImpactDecisionEvent`, `AssetRelationship`, `RightsRecord`, `ConsentRecord`) | `<prefix>_<UUIDv4>` em minúsculas; prefixos `asv`, `afv`, `pvpv`, `prv`, `att`, `val`, `hr`, `ca`, `sd`, `cir`, `ide`, `rel`, `rights`, `consent`. | ID é gerado pelo host/Store ou pelo produtor que cria o record, com RNG criptograficamente seguro; Domain só valida gramática e duplicidade no grafo recebido. Não usar timestamp/path/nome/prompt. UUIDv4 é recomendação, ainda não aprovada. Correção posterior cria record novo/superseding (§2.4); nenhum destes records é editado in-place. |
| Records **mutáveis somente por transação do Store** (`Project`, `Asset` e o aggregate `ProjectVisualProfile`) | `<prefix>_<UUIDv4>` em minúsculas; prefixos `prj`, `ast`, `pvp`. | Mesma gramática e mesma regra de geração. São os únicos records do pacote cujo conteúdo pode mudar depois de criados, e apenas por transação explícita do Store (§4.3, §4.5, §4.6); o Domain valida forma e coerência, nunca muta. |
| `Artifact` | `sha256:<hex64>` e campo `sha256` idêntico ao sufixo. | Content-addressed ID calculado pelo futuro Store sobre bytes reais. Domain só valida formato/igualdade dos campos; não abre arquivo nem atesta bytes. |
| `deliveryId` | `dly_<UUIDv4>` | Novo ID por entrega; retries nunca reutilizam o ID. Geração fora do Domain. **Cardinalidade proposta: 1:1 com `ArtifactVersion`** — cada `ArtifactVersion` porta exatamente um `deliveryId` e nenhum `deliveryId` aparece em dois `ArtifactVersion` (regra de grafo, diagnóstico `delivery_id_reused`). Um `attemptId` pode gerar vários `deliveryId`, um por slot/entrega (§3.6, regra 5). |
| `ProjectVisualProfileVersion` (record independente — recomendado nesta revisão, ver §3.8) | `pvpv_<UUIDv4>` | Imutável; `parentRefs` determina linhagem. Não usar ordinal como identidade. |

UUIDs são strings canônicas minúsculas `8-4-4-4-12`; a variante deve ser UUIDv4 (`4` na versão e `[89ab]` na variante). **Alternativas que exigem aprovação:** UUIDv4 (não expõe ordenação temporal), UUIDv7 (ordenação temporal, porém expõe tempo aproximado), ULID (ordenável, representação própria) ou outro formato. Para `Artifact`, alternativa é UUID aleatório com hash como atributo, mas a recomendação é ID por hash para deduplicação. O Domain puro não deve gerar IDs aleatórios: testes usam IDs fixos e o chamador entrega IDs novos.

### 2.4 Referências e validação de grafos

- Uma referência sintática é validada pelo record isolado; sua existência, tipo real, pertença ao Project e compatibilidade entre endpoints só pode ser conferida quando o chamador fornece um conjunto de records ao validador puro.
- `validateRecord(record)` não lê Store. `validateGraph(records)` pode validar referências/ciclos no conjunto fornecido, sem obter records que não foram passados.
- Falta de record referido produz diagnóstico `unresolved_reference`, não inferência nem descarte. Em import futuro, unknowns permanecem preservados.
- `schemaVersion` da referência deve corresponder ao envelope do record referenciado. Uma referência para tipo/schema diferente é erro de grafo.
- **Classificação de mutabilidade (proposta canônica do pacote; pendente de aprovação com §11, item 12).** `AssetVersion`, `ArtifactVersion`, `ProjectVisualProfileVersion` e `Provenance` são snapshots imutáveis. `ValidationResult`, `HumanReview`, `ConsistencyAssessment`, `StyleDeviationDecision`, `ChangeImpactReport`, `ImpactDecisionEvent`, `AssetRelationship`, `RightsRecord` e `ConsentRecord` são records de avaliação/decisão/evento append-only: correção posterior cria record novo/superseding, nunca edita o anterior. `Project`, `Asset` e o aggregate `ProjectVisualProfile` são os únicos records mutáveis, e apenas por transação explícita do Store (§4.3, §4.5, §4.6). Nenhum record imutável pode ser portador de estado que muda ao longo do tempo — estado especializado por propriedade pertence à versão (§3.3), nunca à identidade (§3.2).

## 3. Schemas propostos

Os quadros listam campos próprios; o envelope comum da §2.1 também é obrigatório, exceto que o `id` de `Artifact` é content-addressed. “Opcional” significa campo ausente; use `null` somente quando a tabela disser `nullable`. As estruturas são propostas para review, não JSON Schema aprovado.

### 3.1 `Project`

| Campo | Tipo | Obrigatório | Referência / regra |
|---|---|---:|---|
| `displayName` | `NonEmptyString` | sim | Rótulo humano; não é identidade nem fonte de ID. |
| `createdAt`, `updatedAt` | `Instant` | sim | `updatedAt >= createdAt`; Store fornece valores. |
| `visualProfileRef` | `RecordRef<ProjectVisualProfile> \| null` | sim | `null` significa nenhum profile global registrado. Não há profile herdado. Aponta para o aggregate; as versões de profile são records independentes (§3.8). |
| `extensions` | extension map | não | Só namespaces versionados. |

**Invariantes:** Project não contém root/path, banco, estado de execução ou licença inferida. A referência de profile, se não nula, deve apontar a profile do mesmo Project. `Project.id` nunca deriva de path. A regra para criar/capturar o UUID é decisão pendente.

### 3.2 `Asset`

| Campo | Tipo | Obrigatório | Referência / regra |
|---|---|---:|---|
| `projectRef` | `RecordRef<Project>` | sim | Dono lógico único; Store futuro confirma ownership. |
| `assetTypeId` | `NonEmptyString` namespaced | sim | Ex.: `lia.asset.character`; catálogo é extensível. Unknown não é reescrito para `character/item`. |
| `displayName` | `NonEmptyString` | sim | Mutável no record de identidade; a versão congela seu snapshot. |
| `description` | string \| null | sim | `null` = sem descrição; string vazia é inválida. |
| `tags` | array de `NonEmptyString` | sim | Sem duplicatas após comparação byte a byte; ordem não é semântica e a recomendação é ordenação estável. |
| `createdAt`, `updatedAt` | `Instant` | sim | Não usados como versão. |
| `currentVersionRef` | `RecordRef<AssetVersion> \| null` | sim | Único ponteiro corrente aprovado; `null` se nunca promovido. |
| `extensions` | extension map | não | Tipos especializados podem ser dados namespaced; hair/motion não exigem um novo top-level record neste pacote. |

**Invariantes:** `Asset` é identidade estável; mudar nome/tags não muda o ID. `currentVersionRef` deve ser do mesmo Asset e Project. O validador de grafo pode confirmar que existe `HumanReview=approve` aplicável; somente o Store futuro pode atualizar o ponteiro transacionalmente.

### 3.3 `AssetVersion`

| Campo | Tipo | Obrigatório | Referência / regra |
|---|---|---:|---|
| `assetRef` | `RecordRef<Asset>` | sim | Asset proprietário. |
| `projectRef` | `RecordRef<Project>` | sim | Redundante para consultas; MUST igualar o Project do Asset. |
| `parentRefs` | array de `RecordRef<AssetVersion>` | sim | `[]` para raiz; um pai para iteração comum; múltiplos para merge explícito. Todos do mesmo Asset. |
| `assetSnapshot` | object | sim | `{ assetTypeId, displayName, description, tags }`; valores congelados nesta revisão. |
| `artifactVersionRefs` | array de `RecordRef<ArtifactVersion>` | sim | Pelo menos uma entrega com ao menos um Artifact real para materializar uma versão de output. Se nada foi produzido, não criar `AssetVersion`. |
| `provenanceRefs` | array de `RecordRef<Provenance>` | sim | Pelo menos um registro de origem/ingestão/tentativa; failed provenance também pode ser referido quando há output parcial. Regra de reciprocidade: deve incluir a `Provenance` de cada `ArtifactVersion` listado em `artifactVersionRefs` (§3.6). |
| `completionBasis` | `{ status, policyId, policyVersion, requirements[] }` | sim | Snapshot versionado que define slots/roles exigidos neste scope; cada requirement `{ requirementId, slotId, slotSchemaVersion, roleId, minCount, maxCount }`. `status=known` exige policy ID/version reconhecidos e requirements; `status=unknown` preserva ID/version alegados e requirements parciais se existirem, mas não infere completude. |
| `completeness` | object | sim | `{ "state":"complete"\|"incomplete"\|"unknown", "missingRequirementIds":string[], "unknownReasonIds":string[] }`; `complete` exige as duas listas vazias; `incomplete` exige ao menos um requisito conhecido ausente (pode também listar unknowns); `unknown` exige missing vazio e ao menos um `unknownReasonId`. `unknownReasonIds` deriva de slot/role/basis indisponível ou não interpretável. |
| `styleContext` | object \| null | sim | `null` = contexto/policy não registrado; senão `{ mode:"Free"\|"Guided"\|"Locked", profileRef, profileVersionRef, profileDigest, traitPaths[] }`. Para `Guided/Locked`, os dois refs e digest são obrigatórios e pinam aggregate+versão; `Free` pode usar refs todos null ou, se mantiver contexto, piná-los todos. Arrays/hashes parciais são inválidos; ausência nunca infere `Free`. |
| `createdAt` | `Instant` | sim | Imutável. |
| `createdBy` | NonEmptyString | sim | Identificador opaco do ator/produtor; autenticação é fora do Domain. |
| `extensions` | extension map | não | Não usar para substituir campos core conhecidos. |

**Lifecycle:** não há campo mutável `status`. `awaiting_review` (candidate) significa nenhuma decisão aplicável; `approved`, `rejected` e `iteration_requested` correspondem à decisão mais recente e não conflitante `approve`, `reject` ou `iterate` da HumanReview exata. `incomplete`/`unknown` são estados imutáveis de `completeness`; `failed` pertence à tentativa `Provenance`/Workflow, não à versão. Se houver outputs parciais, pode existir `AssetVersion` com `completeness.state="incomplete"`; se semântica de slot/requiredness for desconhecida, usar `unknown`. Sem output real, não existe `AssetVersion`.

`CompletionBasis={status:"known"|"unknown",policyId:NonEmptyString|null,policyVersion:integer|null,requirements:CompletionRequirement[]}`. `CompletionRequirement={requirementId,slotId,slotSchemaVersion,roleId,minCount,maxCount}`; IDs são únicos, `minCount>=0`, `maxCount=null|integer>=minCount`. `known` exige policy ID/version reconhecidos e snapshot de requirements não vazio; `unknown` preserva ID/version alegados e requirements parciais quando existirem, sem tratá-los como catálogo aprovado. Completion policy registry e os IDs de v1 estão pendentes de aprovação.

`completionBasis` evita alegar que um modelo-only seja character completo: enumera exatamente o scope que esta AssetVersion promete. `completeness` é recalculada contra basis, slot/role registries e ArtifactVersions: cada requirement conta members com `slotId+slotSchemaVersion+roleId` exatos em todos os ArtifactVersions referidos; `complete` somente se basis/registries são conhecidos, todos os bundles são complete e todas as contagens atendem; `incomplete` se pelo menos uma requirement conhecida falta (mesmo que exista unknown adicional); `unknown` se nenhuma falta conhecida foi provada, mas basis/registry é unknown. `missingRequirementIds` lista faltas conhecidas; `unknownReasonIds` registra lacunas. Basis/requirements integram digest de review e são congelados; editar scope exige nova AssetVersion.

### 3.4 `Artifact`

| Campo | Tipo | Obrigatório | Referência / regra |
|---|---|---:|---|
| `id` | `ArtifactId` | sim | `sha256:<hex64>`; deve corresponder a `sha256`. |
| `sha256` | `Sha256Hex` | sim | Hash declarado dos bytes exatos; validação de bytes reais pertence ao Store. |
| `byteLength` | integer >= 0 | sim | Tamanho em bytes reportado; igualdade com arquivo só é verificável pelo Store. **Decisão pendente (inventariada nesta reconciliação como R16, §13.3):** se `Artifact` com `byteLength=0` é aceito ou rejeitado. Recomendação técnica: rejeitar para artifacts de output; aceitar somente caso a caso para marcadores/placeholders declarados, com justificativa explícita de quem o registra — nunca por default e nunca inferindo conteúdo. Enquanto não decidido, o Domain valida apenas `>= 0` e não escolhe por conveniência (§11, linha final). |
| `mediaType` | string | sim | MIME declarado pelo produtor ou `application/octet-stream`; não prova semântica. |
| `formatId` | NonEmptyString | sim | Formato namespaced conhecido (ex.: `lia.format.glb`) ou o literal reservado `unknown` quando o formato não foi determinado; nunca inferir apenas pela extensão. Valores namespaced desconhecidos seguem a regra de registries da §2.1. |
| `contentMetadata` | object JSON | sim | `{}` se não houver metadata conhecida; não contém path absoluto. |
| `extensions` | extension map | não | Extensões de mídia namespaced. |

Não incluir path físico, URI local, data de escrita, nome original nem role como identidade do Artifact. Esses dados são localização/apresentação do Store ou papel de membro de `ArtifactVersion`; não alteram identidade por bytes. Mesmo bytes podem ser referenciados por várias entregas. **Reconciliação com a proposta consolidada (§5.2 daquela):** a "URI lógica" lá descrita é um localizador administrado pelo Store futuro, resolvido pelo `Artifact.id`/hash — não é campo deste contract, porque localização pode mudar sem que os bytes mudem; `role` é propriedade da participação do Artifact em uma entrega (`ArtifactVersionMember.roleId`), não do Artifact, porque os mesmos bytes podem ter roles diferentes em entregas diferentes. Ver §13.1, item 3.

### 3.5 `ArtifactVersion`

**Slot lógico** é uma chave namespaced registrada (ex.: `lia.slot.character.model`, `lia.slot.hair.geometry`, `lia.slot.motion.clip`, `lia.slot.spritesheet.atlas`) para uma classe de entrega de um Asset. Não é extensão, nome de arquivo, etapa de UI nem ID de provider.

| Campo | Tipo | Obrigatório | Referência / regra |
|---|---|---:|---|
| `projectRef`, `assetRef` | `RecordRef<Project>`, `RecordRef<Asset>` | sim | Devem concordar com o Asset e seu Project. |
| `slotId` | NonEmptyString namespaced | sim | Identifica o slot; não implica que arquivo esteja presente. |
| `slotSchemaVersion` | integer > 0 | sim | Versão da definição de roles/cardinalidade do slot. |
| `deliveryId` | `dly_<UUIDv4>` | sim | Identifica uma tentativa de agrupamento; distinto por entrega/retry. Cardinalidade **1:1** com o `ArtifactVersion`: não pode ser reutilizado por outro `ArtifactVersion` (§2.3). |
| `assemblyState` | `complete \| partial \| unknown` | sim | Snapshot derivado de slot registry, `expectedRoles` e `members`; validator recalcula e rejeita inconsistência. `unknown` impede claim de completude. Não há `failed` sem output. |
| `expectedRoles` | array de `{ roleId, minCount, maxCount }` | sim | Lista congelada de roles esperadas nesta entrega, namespaced; `minCount >= 0`, `maxCount >= minCount` ou `null` sem limite. |
| `members` | array de `ArtifactVersionMember` | sim | Pelo menos um member real. `{ memberKey, roleId, artifactRef, ordinal }`; `memberKey` único; `ordinal` nullable e obrigatório para roles repetíveis com ordenação. |
| `memberLinks` | array de `{ predicateId, fromMemberKey, toMemberKey }` | sim | `[]` quando não houver ligação semântica (array vazio, nunca `{}`). `predicateId` namespaced; `fromMemberKey`/`toMemberKey` devem existir em `members`. Ex.: `lia.artifact.manifest_for` do manifesto para PNG. |
| `membersDigest` | `Digest` | sim | Hash do conjunto canônico de membros: `deliveryId`, `members` (memberKey, roleId, artifactRef com id/sha256, ordinal) e `memberLinks`, nesta ordem declarada. `canonicalizationId` explícito; a escolha de canonicalização permanece aberta (§6.3) e o payload exato do digest precisa ser aprovado junto. Domain valida forma/coerência declarada; não recalcula sem canonicalizer aprovado. |
| `parentRefs` | array de `RecordRef<ArtifactVersion>` | sim | Pais de revisão do **mesmo Asset e slot**; múltiplos permitem merge explícito. `[]` para raiz. |
| `provenanceRef` | `RecordRef<Provenance>` | sim | Tentativa/origem que produziu este bundle; Provenance lista este output. |
| `createdAt` | `Instant` | sim | Imutável. |
| `extensions` | extension map | não | Não alterar o meaning de slot/roles. |

**Regras de agrupamento:**

1. Nunca descobrir membros varrendo diretório/extensão. Cada Artifact é membro somente por referência explícita, hash e role.
2. Os membros de um `ArtifactVersion` compartilham `deliveryId`, `assetRef`, `projectRef` e `slotId`. Como `deliveryId` é 1:1 com `ArtifactVersion` (§2.3), o grupo é identificado pelo próprio `deliveryId`; a combinação `(deliveryId, assetRef, slotId)` é uma **chave derivada de consistência** que o validator confere (divergência entre dois `ArtifactVersion` com o mesmo `deliveryId` é erro `delivery_id_reused`; `deliveryId` cujo `assetRef`/`slotId` difere do declarado é erro estrutural). Outro delivery/retry gera outro `ArtifactVersion` com outro `deliveryId`.
3. Roles e cardinalidades vêm do slot registry versionado; roles desconhecidas continuam preservadas, mas não tornam o grupo `complete` sem definição aplicável. Não supor que role desconhecida é optional; seus IDs aparecem nos diagnostics/`ValidationResult`.
4. Para cada role conhecida, o número de members deve estar entre `minCount` e `maxCount` (quando max não é null); exceder max é erro. `complete` se e somente se o slot e todas as roles são conhecidos e todas atingem `minCount`; `partial` quando ao menos uma role obrigatória conhecida falta (mesmo que outras roles sejam unknown); `unknown` quando nenhuma falta conhecida foi provada, mas semântica de slot/role impede concluir. Optional roles podem faltar. Omissões são derivadas, não Artifact fictício.
5. Arquivos de slots diferentes nunca são combinados num mesmo `ArtifactVersion`. Inputs de outros slots/assets ficam em `Provenance.inputRefs`, não em `parentRefs`.
6. `parentRefs` podem ter múltiplos pais, mas todos são do mesmo Asset/slot e o grafo de pais é acíclico. Transformações multiparent de slots distintos são explicitadas em Provenance; a saída nova começa um novo slot lineage.
7. PNG e manifesto são Artifacts diferentes, membros da entrega `lia.slot.spritesheet.atlas` com roles `lia.role.spritesheet.image` e `lia.role.spritesheet.manifest`; `memberLinks` registra manifest → image. Sidecars/arquivos auxiliares têm roles explícitas e não substituem os originais.
8. Output parcial: registrar somente bytes que existem como Artifacts; bundle `partial` lista roles esperadas faltantes. Output zero: nenhuma ArtifactVersion/AssetVersion é fabricada.

### 3.6 `Provenance`

`Provenance` registra fonte/transformação/tentativa imutável, incluindo uma tentativa que falhou antes de produzir qualquer arquivo.

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `attemptId` | `att_<UUIDv4>` | sim | Agrupa inputs/outputs de uma tentativa; novo em retry; não é `WorkflowRun` nem `deliveryId`. |
| `operationId` | NonEmptyString namespaced | sim | Ex.: `lia.asset.import`, `lia.sprite.render`; catálogo extensível. |
| `outcome` | `succeeded \| partial \| failed \| cancelled \| blocked \| unknown` | sim | Não promove AssetVersion. |
| `inputRefs` | array de `ArtifactRef` ou `RecordRef` versionadas | sim | Só inputs realmente observados; pode ser vazio para criação manual. |
| `outputRefs` | array de `ArtifactVersion` refs | sim | Somente entregas reais, incluindo bundles `partial`; restrições por outcome na tabela determinística abaixo (`[]` obrigatório em `failed`/`blocked`; `cancelled` pode preservar entregas reais). |
| `toolRefs` | array de `ToolComponentRef` | sim | Cada item `{ componentLayer:"tool|model|weights|dataset|dependency|wrapper", name:NonEmptyString, version:Reported<string>, sourceRef:Reported<EvidenceRef>, contentHash:Reported<Sha256Hex> }`; `[]` se manual/sem ferramenta; não atribuir versão presumida. |
| `adapterRef`, `providerRef` | `OpaqueRef \| null` | sim | `null` para manual/não usado; ref namespaced desconhecida preservada quando ocorreu mas não foi identificada. |
| `executionContext` | object | sim | `{ moduleId: Reported<NonEmptyString>, capabilityId: Reported<NonEmptyString>, workflowRunRef: Reported<OpaqueRef>, stepRef: Reported<OpaqueRef>, providerExecutionRef: Reported<OpaqueRef> }`. Declara o contexto de execução futuro sem implementar seus contratos (ver "Fronteira" abaixo). `not_applicable` para operação manual/direta sem workflow; `unknown` quando o contexto existiu e não foi capturado; `reported` somente com valor conhecido. |
| `backend` | `Reported<NonEmptyString>` | sim | `{state:"not_applicable"}` sem backend; unknown explícito se ocorreu e não pôde ser identificado. |
| `environment` | object | sim | `{ os, architecture, cpu, gpu, driver, runtime, toolVersions, spatialConvention, timebase }`; cada valor é `Reported<T>`, exceto `toolVersions` (array); sem inspeção automática pelo Domain. **Nenhum campo core é nomeado a partir de uma ferramenta específica** (ver `toolVersions` abaixo). |
| `parameters` | object JSON redigido | sim | `{}` ou resumo; sem tokens, credentials, prompt privado sem grant ou dados secretos. |
| `rightsRefs`, `consentRefs` | arrays de refs | sim | `[]` apenas se não aplicável; não significa clearance automático. |
| `startedAt`, `finishedAt` | `Instant \| null` | sim | `null` se não houve relógio/execução correspondente; ordem cronológica se ambos presentes. |
| `failure` | object \| null | sim | Obrigatório para `failed/blocked/cancelled`; `{ code, summary }`, sem stack/segredo não redigido. |
| `extensions` | extension map | não | Campos de provider ficam namespaced, não no core. |

`inputRefs` versionadas aceitam somente `ArtifactRef` ou refs imutáveis de `ArtifactVersion`, `AssetVersion` e `ProjectVisualProfileVersion`; objeto mutável `Project/Asset` não pode servir de input sem snapshot/hash. `environment.os/architecture/cpu/gpu/driver/runtime` usam `Reported<NonEmptyString>`; `spatialConvention` é `Reported<{unit,upAxis,forwardAxis,handedness}>`; `timebase` é `Reported<{frameRate:finite number>0,unit:"fps",timeUnit:"frame|second",dropFrame:boolean}>`. Manual/import sem runtime usa `not_applicable`; dado que existiu mas não foi observado usa `unknown`. Essas são declarações de provenance, não benchmark nem validação de compatibilidade.

**`toolVersions` (substitui o campo nomeado por ferramenta desta revisão anterior; shape proposto, pendente de aprovação com §11, item 12):** array de `{ toolId: NonEmptyString namespaced, version: Reported<NonEmptyString>, role: Reported<NonEmptyString> }`; `[]` quando nenhuma ferramenta de runtime participou (operação manual/import). `toolId` identifica a ferramenta pelo registry namespaced (padrão `lia.tool.<nome>`, ex.: `lia.tool.blender`, `lia.tool.webgl_renderer`, `lia.tool.layered_image_pipeline`); `role` descreve a função exercida naquela operação (ex.: `renderer`, `importer`, `segmenter`), não a marca. `toolId` desconhecido segue a regra de registries da §2.1 (preservado com diagnóstico, nunca convertido em conhecido). **Justificativa arquitetural:** o Domain não pode pressupor ferramenta (ADR-001 Decisões 1 e 5 — Blender é interface auxiliar e não há renderer padrão; proposta §8.1 — backend não se infere pelo nome do provider), e a Forge deve representar rotas 2D, 2.5D, 3D e futuras (§8.2) com o mesmo contrato. Uma versão de ferramenta específica como campo core ficaria permanentemente `not_applicable` para toda operação não relacionada àquela ferramenta e exigiria bump de `schemaVersion` para generalizar. `toolRefs` (camada/nome/versão/hash de code, wrapper, model, weights, dataset, dependency) continua sendo o registro de **componentes** com direitos e hash; `toolVersions` registra apenas o **runtime observado** da operação, sem claim de direitos.

**Fronteira com `WorkflowRun`, `StepRun`, `ProviderExecution`, Capability e Workflow (contratos futuros — fora deste pacote):**

- `Provenance` é o registro imutável, visível ao Domain, de **uma tentativa** (`attemptId`). `WorkflowDefinition`/`WorkflowPlan`/`WorkflowRun`/`StepRun`/`ProviderExecution` e `CapabilityClaim` pertencem a pacotes futuros (proposta §8.3); nenhum deles é criado, validado ou exigido aqui.
- A referência a esses contratos futuros é feita exclusivamente por `executionContext`, usando `Reported<OpaqueRef>`: o Domain preserva a referência sem traversar, propaga warning de tipo não reconhecido e nunca deduz estado de execução a partir dela. `operationId` é a taxonomia de operações do Domain (ex.: `lia.sprite.render`); `capabilityId` é o ID do registry de capabilities do Hub futuro. São registries distintos e um não implica o outro. `moduleId` identifica o módulo produtor (`lia.module.*`), não um provider.
- Rastreabilidade sem perda: quando os contratos futuros existirem, o produtor do `WorkflowRun`/`StepRun`/`ProviderExecution` deverá referir os `attemptId`/`Provenance` correspondentes, e os `executionContext` já gravados permitirão o enlace bidirecional sem editar records antigos. A reciprocidade Provenance↔WorkflowRun será definida no pacote que introduzir `WorkflowRun`; até lá, `executionContext` é a única superfície de enlace e `not_applicable`/`unknown` distinguem "sem contexto de workflow" de "contexto não capturado".
- Estados de execução remota não confirmada (proposta: `needs_reconciliation`) pertencem ao futuro `ProviderExecution`; no nível do Domain, o correspondente é `outcome:"unknown"` com `failure` opcional descrevendo a indeterminação. Não adicionar `needs_reconciliation` ao enum de `outcome` nesta revisão.
- Retry/cancelamento/eventos continuam sendo responsabilidade do Workflow Runner futuro: no Domain, cada retry é um novo `attemptId` com novo record `Provenance`; nada é editado.

**Regras determinísticas de `outcome` e consistência recíproca com `ArtifactVersion` (propostas):**

| `outcome` | `outputRefs` | `failure` | Regras |
|---|---|---|---|
| `succeeded` | `[]` somente se o propósito declarado da operação não inclui entregas; caso contrário, todas as entregas reais da tentativa | deve ser `null` | Todo output listado é recíproco (abaixo). `succeeded` nunca promove AssetVersion por si só. |
| `partial` | obrigatoriamente não vazio; somente entregas realmente materializadas | opcional; se presente, descreve a parte que falhou | Usar quando parte do propósito foi materializada. Bundles referidos podem ser `partial` ou `complete` (o conjunto de bundles é que é incompleto frente ao propósito). |
| `failed` | obrigatoriamente `[]` | obrigatório | Se bytes foram materializados **e registrados** como entregas, o outcome correto é `partial`, não `failed`. `failed` = tentativa sem nenhuma entrega registrada. |
| `blocked` | obrigatoriamente `[]` | obrigatório (código do gate: rights/consent/preflight/etc.) | Gate impediu a execução; não pode haver outputs. |
| `cancelled` | `[]` ou entregas reais materializadas antes do cancelamento | obrigatório (motivo redigido) | Cancelamento não apaga entregas existentes; reciprocity aplica-se normalmente. |
| `unknown` | somente entregas reais registradas, se houver | opcional | Produtor não pôde classificar (ex.: crash, efeito remoto indeterminado). Ver `needs_reconciliation` acima. |

Consistência recíproca (regras de grafo, determinísticas):

1. Para todo `ArtifactVersion` listado em `Provenance.outputRefs`, o campo `ArtifactVersion.provenanceRef` deve apontar de volta para essa mesma `Provenance` (id e schemaVersion), e vice-versa: o `provenanceRef` de cada `ArtifactVersion` deve listar esse `ArtifactVersion` em seus `outputRefs`. Violação em qualquer direção é erro de grafo (`provenance_output_not_reciprocal`).
2. Um `ArtifactVersion` não pode ser output de duas `Provenance` diferentes; cada bundle tem exatamente uma tentativa de origem.
3. `failed`/`blocked` com `outputRefs` não vazio é erro estrutural; `partial` com `outputRefs` vazio é erro estrutural.
4. `failure` ausente (`null`) em `failed`/`blocked`/`cancelled` é erro estrutural; `failure` presente em `succeeded` é erro estrutural.
5. Um `attemptId` pode produzir múltiplos `deliveryId`/`ArtifactVersion` (slots diferentes da mesma tentativa); cada retry recebe novo `attemptId`, novos `deliveryId` e novos records.
6. Em `AssetVersion.provenanceRefs` deve constar a `Provenance` de cada `ArtifactVersion` de `artifactVersionRefs` (regra também declarada em §3.3); provenances adicionais (ex.: a tentativa `failed` anterior que motivou o retry) são permitidas.

O Workflow Runner futuro guardará eventos/retry/cancelamento; não é parte deste record nem do pacote inicial.

### 3.7 `ValidationResult`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `subjectRef` | União explícita: `ArtifactRef` para sujeito `Artifact`; `RecordRef<ArtifactVersion>`, `RecordRef<AssetVersion>` ou `RecordRef<ProjectVisualProfileVersion>` para os demais | sim | ID/schema exatos do sujeito inspecionado; nunca `Asset`/`Project` lógico sem versão. |
| `observedArtifactHashes` | array de `{ artifactId, sha256 }` | sim | Hashes efetivamente vistos pelo validator/ambiente; sintaxe e consistência referencial são validáveis no Domain. |
| `validatorId`, `validatorVersion` | strings | sim | Identificam implementação e release; não são prova de capability. |
| `targetRef` | `OpaqueRef \| null` | sim | Contract/target testado ou `null`; o registry de targets é externo ao pacote. |
| `status` | `passed \| failed \| warning \| blocked \| not_run \| unknown \| not_applicable` | sim | Resultado apenas dos checks listados. |
| `checks` | array de `{ checkId, status, message, expected?, observed?, unit?, evidenceRefs:EvidenceRef[] }` | sim | `checkId` namespaced; check status `pass|fail|warning|unknown|not_applicable`; evidência exata. |
| `limitations` | array de strings | sim | `[]` quando nenhuma limitação conhecida; unknown relevante deve ser explícito. |
| `evaluatedAt` | `Instant \| null` | sim | Null para `not_run`; caso contrário timestamp reportado. |
| `extensions` | extension map | não | Não chamar resultado estrutural de aprovação visual/legal. |

Não afirma que arquivo existe ou que bytes foram realmente lidos: isso pertence ao Store.

**Agregação determinística de `checks` em `status` (proposta; pendente de aprovação):** `status` é derivado e o validator puro o recalcula; divergência entre o `status` gravado e o calculado é erro estrutural (`status_aggregation_mismatch`). Função total, em ordem de precedência:

1. Se algum check tem `status="fail"` ⇒ `failed`.
2. Senão, se algum check tem `status="unknown"` ⇒ `unknown`.
3. Senão, se algum check tem `status="warning"` ⇒ `warning`.
4. Senão, se há pelo menos um check e todos são `not_applicable` ⇒ `not_applicable`.
5. Senão, se há pelo menos um check (todos `pass`, possivelmente com `not_applicable`) ⇒ `passed`.
6. Se `checks=[]`, os únicos `status` permitidos são: `not_run` (exige `evaluatedAt=null`), `blocked` (gate impediu a execução; `limitations` não vazio), `unknown` (produtor não pôde executar/determinar; `limitations` não vazio) ou `not_applicable` (sujeito fora do escopo do target; `limitations` não vazio). `passed` ou `failed` com `checks=[]` é erro estrutural.

Conceitos de "check obrigatório" específicos de um validator são expressos pelo próprio validator emitindo um check `fail` quando o requisito não é atendido; a agregação do Domain é fixa e não depende de registry. Agregação configurável por registry/target exigiria novo `schemaVersion` e é decisão futura, não default. `evaluatedAt` permanece `null` apenas para `not_run`; para os demais é o timestamp reportado pelo produtor (o Domain não consulta relógio).

**Precedência entre múltiplos `ValidationResult` (lacuna registrada nesta reconciliação — decisão pendente: §11, item 10; recomendação R17).** Vários `ValidationResult` podem coexistir para o mesmo sujeito: validators diferentes, versões diferentes do mesmo validator, `targetRef` diferentes ou re-execuções. A agregação determinística acima opera **dentro** de um único record; este pacote **não** define precedência **entre** records — `ValidationResult` não tem `supersedesRef` (ao contrário de `HumanReview`, `ConsistencyAssessment`, `StyleDeviationDecision`, `AssetRelationship` e `ProjectVisualProfile`). Consequência explícita: o Domain não escolhe "o resultado válido", e nenhum gate deve derivar essa escolha do Domain. Alternativas legítimas, todas exigindo decisão humana: (a) acrescentar `supersedesRef` a `ValidationResult` e consumir o último terminal da cadeia — rastreabilidade explícita de re-execuções, custo de bump de `schemaVersion`; (b) regra determinística de seleção no gate (ex.: último por `evaluatedAt` para o mesmo `validatorId`+`targetRef`, com tie-break declarado) — preserva o contrato, mas desloca a semântica de verdade para o gate e depende de relógio reportado; (c) seleção configurável por registry de validators/targets — mais flexível e a menos auditável por função pura. Enquanto não decidido, resultados divergentes para o mesmo sujeito/hash são **ambos** preservados e reportados: a contradição permanece visível e não é resolvida em silêncio.

### 3.8 `ProjectVisualProfile` e `ProjectVisualProfileVersion`

**Decisão estrutural desta revisão (recomendação; pendente de aprovação):** `ProjectVisualProfileVersion` passa a ser um **record independente de topo** (envelope §2.1 completo), e o `ProjectVisualProfile` permanece um aggregate global por Project que lista `versionRefs` e mantém o ponteiro aprovado. As duas alternativas analisadas:

| Critério | (A) Versão como record independente — **recomendada** | (B) Versão embutida no aggregate com referência especializada |
|---|---|---|
| Resolução de referências | Toda `RecordRef<ProjectVisualProfileVersion>` resolve para record de topo, como nos demais contratos; `validateGraph` uniforme. | Exigiria referência especializada de duas chaves (profileId+versionId) e caminho de resolução próprio em `HumanReview`, `ConsistencyAssessment`, `StyleDeviationDecision`, `AssetRelationship`, `Provenance.inputRefs`, `ValidationResult.subjectRef` e `ChangeImpactReport.changedRefs`. |
| Imutabilidade/append-only | Cada versão é um record imutável independente, coerente com `AssetVersion`/`ArtifactVersion`. | O aggregate mutável cresceria a cada versão; criar versão reescreveria o documento inteiro. |
| Concorrência | Criar versão e mover o ponteiro são escritas separadas; CAS do ponteiro (§4.5) não concorre com criação de versões. | Duas criações concorrentes de versão exigiriam serializar reescritas do aggregate inteiro. |
| Digest/binding de review | `contentDigest` cobre o payload da versão isolada; review vincula id+digest de um record autônomo. | Review vincularia um objeto embutido em documento mutável; definição de bytes/hash mais ambígua. |
| Custo | Duas leituras para ver profile+versão; aggregate precisa de `versionRefs` para checagem de pertinência. | Documento único; porém com as desvantagens acima. |

Os exemplos desta spec já referenciavam `ProjectVisualProfileVersion` como record de topo (com `schemaVersion`), o que era inconsistente com o modelo embutido anterior; a opção (A) elimina essa inconsistência. **Todas as referências, reviews, assessments, relationships, inputs de Provenance, changedRefs e hashes usam o mesmo modelo:** `RecordRef<ProjectVisualProfileVersion>` resolvível por `validateGraph`. Não há perfil por tipo/Asset nem herança em v1.

`ProjectVisualProfile` (aggregate):

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `projectRef` | `RecordRef<Project>` | sim | Um aggregate global para esse Project; dois aggregates ativos no mesmo Project são erro de grafo. |
| `scope` | literal `{ "kind":"project" }` | sim | Único scope de v1. |
| `versionRefs` | array de `RecordRef<ProjectVisualProfileVersion>` | sim | `[]` antes da primeira versão; refs únicas; cada versão referida deve apontar de volta para este aggregate (`profileRef`); pertinência é recíproca. |
| `currentApprovedVersionRef` | `RecordRef<ProjectVisualProfileVersion> \| null` | sim | `null` até uma aprovação humana; deve estar em `versionRefs` e ter `HumanReview=approve` exata aplicável e vigente (§4.5). Projeção mutável do Store; nunca edita versões. |
| `extensions` | extension map | não | Futuras versões de scope não entram em v1. |

`ProjectVisualProfileVersion` (record independente; envelope §2.1 obrigatório, `id = pvpv_<UUIDv4>`):

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `profileRef` | `RecordRef<ProjectVisualProfile>` | sim | Aggregate proprietário; reciprocidade com `versionRefs`. |
| `parentRefs` | array de `RecordRef<ProjectVisualProfileVersion>` | sim | `[]` para primeira; múltiplos só em merge explícito; pais dentro do mesmo profile; grafo acíclico. |
| `contentSchemaVersion` | integer > 0 | sim | Versiona conteúdo visual separadamente do envelope. |
| `traits` | objeto de traits tipados | sim | Campos fixos abaixo; cada trait é `specified`, `unknown` ou `not_applicable`. |
| `references` | array de `ProfileReference` | sim | Artefatos/hash exatos; uso como baseline exige HumanReview aplicável. |
| `contentDigest` | `Digest` | sim | Hash do conteúdo canônico da versão, com `canonicalizationId`; escolha de algoritmo aberta em §6.3. Nunca cobre o ponteiro do aggregate nem reviews. |
| `createdAt`, `createdBy` | Instant, NonEmptyString | sim | Origem da proposta; não é aprovação. |
| `extensions` | extension map | não | Preservar traits futuros. |

`traits` v1 recomendado:

| Trait | Tipo de `value` quando `state="specified"` |
|---|---|
| `style.name`, `style.substyle` | `NonEmptyString`; vocabulário descritivo extensível, sem enum fechado nem inferência pelo renderer. |
| `palette.colorSpace` | `NonEmptyString` namespaced quando houver registry; ex.: `srgb`; desconhecido permanece literal + diagnostic. |
| `palette.swatches` | Array de `{ name:NonEmptyString, colorHex:#RRGGBB|#RRGGBBAA, semanticRole:NonEmptyString }`; entradas/cores duplicadas devem ser decididas pela rubrica, não removidas pelo Domain. |
| `form.silhouette` | `NonEmptyString`, descritor visual. |
| `form.proportions` | Array `{ measureId:NonEmptyString, value:finite number, unit:NonEmptyString, tolerance?:finite number>=0 }`; numeric measures incluem unidade; não inferir de imagem sem provenance/review. |
| `materials.surfaceLanguage`, `materials.finish` | Arrays de `NonEmptyString`; descritores qualitativos v1, não medições físicas sem validator especializado. |
| `lighting.model`, `lighting.direction`, `lighting.softness`, `lighting.contrast` | `NonEmptyString` descritiva em v1; valores numéricos/unidades ficam para extension/versão futura aprovada. |
| `camera.viewSet` | Array ordenado de `NonEmptyString` (ex.: `front`, `side`, `back`); labels desconhecidos preservados. |
| `camera.projection` | `orthographic|perspective`; estado desconhecido usa Trait `state:"unknown"`. |
| `camera.focalLength` | `{ value:finite number>0, unit:"mm" }` para perspectiva; `not_applicable` para ortográfica ou `unknown` se não sabido. |
| `scale.referenceUnit`, `scale.referenceHeight` | Unit `NonEmptyString` e height `{ value:finite number>0, unit:same-as-referenceUnit }`; par especificado junto ou como unknown; sem conversão implícita de unidades Blender. |

Cada valor especificado carrega sua própria origem: `manual={kind:"manual",actorId,recordedAt}`, `imported_reference={kind:"imported_reference",artifactRef,sha256,reviewRef,rightsRef}` ou `ai_proposal={kind:"ai_proposal",provenanceRef}`. Proposta de IA pode ser preservada como candidata, mas não aprova profile nem preenche `currentApprovedVersionRef`. Referência importada é pinada por bytes/hash; review deve ser exata ao hash e propósito. `unknown`/`not_applicable` não têm value/origin. Traits não herdam de outro profile.

`TraitOrigin` tem discriminador `kind` obrigatório: `manual` requer `actorId,recordedAt`; `imported_reference` requer `artifactRef,sha256,reviewRef,rightsRef`; `ai_proposal` requer `provenanceRef`. Campos de outra variante são inválidos. `ProfileReference={artifactRef,purpose,rightsRef,approvalReviewRef}`; `purpose` é `style|palette|silhouette|proportion|material|lighting|camera|scale|other`; `approvalReviewRef` pode ser null enquanto referência estiver apenas anexada, mas para alimentar qualquer Trait baseline deve apontar a `HumanReview=approve` do Artifact/hash exato. Uma aprovação posterior não edita a `ProjectVisualProfileVersion`: cria nova versão pinando o review. `rightsRef` nunca pode ser omitido: estado `unknown` é um valor válido e bloqueante conforme uso.

**Regra de grafo para `TraitOrigin.ai_proposal` (adicionada nesta reconciliação):** `provenanceRef` deve apontar para uma `Provenance` cujo `outcome` seja `succeeded` ou `partial` — uma proposta de IA só existe como consequência de uma tentativa que produziu algo. `outcome` `failed`, `blocked`, `cancelled` ou `unknown` produz o diagnóstico `trait_origin_provenance_inconsistent`, e o trait não pode alimentar baseline aprovado nem ser usado como referência em avaliação `Guided`/`Locked` (permanece proposta não utilizável até outra origem). Uma `Provenance` de proposta de trait pode legitimamente ter `outcome="succeeded"` com `outputRefs=[]`, porque o propósito declarado da operação não inclui entregas (§3.6, tabela de outcomes). A regra não julga qualidade nem converte proposta em aprovação: `ai_proposal` continua sendo proposta até aprovação humana da `ProjectVisualProfileVersion` (§3.8, §6.2). O mesmo critério vale para `imported_reference`: `artifactRef`/`sha256` devem resolver no grafo recebido, e `reviewRef` deve apontar para `HumanReview=approve` do hash exato quando a referência alimentar baseline.

`HumanReview.subjectRef` inclui também `Artifact` para aprovação de uma referência; review de Artifact aprova seu hash/purpose apenas, não rights nem o perfil inteiro. Cada `TraitOrigin.imported_reference` deve corresponder a um `ProfileReference` da mesma `ProjectVisualProfileVersion` com Artifact/hash/purpose/review/rights coerentes; mismatch é erro de grafo e não se usa a referência como baseline. Proposta para `subjectRef=Artifact`: `subjectDigest={algorithm:"sha-256",canonicalizationId:"artifact-bytes-sha256-v1",value:Artifact.sha256}`; isso apenas vincula ao hash de bytes já conceitualmente aprovado e não escolhe canonicalizer JSON. Nome/shape ainda entram na aprovação do pacote. Para `ProjectVisualProfileVersion`/`AssetVersion`/`ArtifactVersion` usa-se digest canônico do snapshot e é necessária canonicalização aprovada.

### 3.9 `AssetRelationship`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `projectRef` | `RecordRef<Project>` | sim | Vínculo do edge. Como o record porta um único `projectRef`, ele afirma que os endpoints estão vinculados **naquele** Project. Para todo endpoint cujo Project é derivável no grafo recebido (`Asset`→`projectRef`; `AssetVersion`→`projectRef`; `ArtifactVersion`→`projectRef`; `ProjectVisualProfileVersion`→`profileRef`→aggregate→`projectRef`), divergência com o `projectRef` declarado é erro estrutural `relationship_project_mismatch` — autocontradição do record, não política de escopo. Para endpoint `ArtifactRef`, a pertinência não é derivável do Artifact (§3.4 não porta `projectRef`) e aplica-se a regra de ownership abaixo. |
| `subjectRef`, `objectRef` | `RelationshipEndpointRef` | sim | União explícita `RecordRef<Asset> \| RecordRef<AssetVersion> \| ArtifactRef \| RecordRef<ArtifactVersion> \| RecordRef<ProjectVisualProfileVersion>` (todos records de topo resolvíveis); endpoints ordenados. O significado direcional é do predicate registry, não se troca lexicalmente. |
| `predicateId` | NonEmptyString namespaced | sim | Predicate exato do registry. Unknown permanece preservado, sem impacto calculado. |
| `predicateCatalogVersion` | integer > 0 | sim | Versão do catálogo de semântica/direção. |
| `state` | `active \| archived` | sim | Mudança é record novo com `supersedesRef`; não editar histórico. |
| `supersedesRef` | `RecordRef<AssetRelationship> \| null` | sim | Necessário para archival/substituição; endpoints e predicate devem ser compatíveis. |
| `evidenceRefs` | array de `EvidenceRef` | sim | Pode ser vazio, mas `unknown` deve continuar unknown. |
| `createdAt`, `createdBy` | Instant, NonEmptyString | sim | Registro de quem/como ligou os endpoints; não prova a relação por si só. |
| `extensions` | extension map | não | Preservar predicates futuros. |

Constraints de ciclos e impacto dependem da versão do predicate. Grafo sem catalog entry pode ser guardado com warning, mas não é percorrido pelo Change Impact v1.

**Ownership de endpoint `ArtifactRef` (regra derivável, sem campo novo).** Um endpoint `ArtifactRef` tem ownership verificável **se e somente se** o grafo recebido contém ao menos um `ArtifactVersion` que (a) lista aquele `artifactId` em `members` e (b) tem `projectRef` igual ao `projectRef` declarado na relação. Satisfeitas as duas condições, a aresta é tratada como pertencente ao Project. Caso contrário o Domain emite `relationship_endpoint_ownership_unresolved` (warning) e a aresta **não** é atravessada pelo Change Impact v1. A relação é preservada, nunca eliminada em silêncio (§2.4, §7.2). O mesmo `Artifact` pode participar de entregas de Projects diferentes — por isso a regra exige um caminho inequívoco **no grafo recebido**, e não uma propriedade do Artifact.

**Escopo de Project (decisão pendente — §11, item 11).** O shape v1 tem um único `projectRef` e, portanto, **não representa** relação entre endpoints de Projects diferentes; se relações cross-project devem existir (e com qual shape: dois refs, ref de projeto de origem/destino, ou registry de escopo) é decisão humana pendente e não está resolvida aqui. Comportamento até a decisão: nenhum produtor deve fabricar `projectRef` para fazer uma relação cross-project caber no shape; o caso é registrado como desconhecido/diagnóstico e preservado. `relationship_project_mismatch` (acima) é erro estrutural em qualquer cenário, porque descreve um record que contradiz a si mesmo, e não uma escolha de política.

### 3.10 `HumanReview`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `subjectRef` | União explícita: `ArtifactRef` para `Artifact`; `RecordRef<ArtifactVersion>`, `RecordRef<AssetVersion>` ou `RecordRef<ProjectVisualProfileVersion>` para os demais | sim | Tipo exato; nunca `Asset`/`Project` lógico sozinho. |
| `subjectDigest` | `Digest` | sim | Digest do snapshot revisto; não usar `canonicalizationId` vazio nem inferir versão atual. |
| `observedArtifactHashes` | array de `{ artifactId, sha256 }` | sim | Set ordenado e exato dos bytes relevantes; vazio apenas para sujeito sem Artifact. |
| `decision` | `approve \| reject \| iterate \| revoke` (`revoke` é recomendação desta revisão; pendente de aprovação) | sim | `iterate` pede nova versão/ciclo; não aprova parcialmente o mesmo snapshot. `revoke` exige `supersedesRef` apontando ao `approve` exato revogado (mesmo subject+digest); efeito no ponteiro em §4.5. |
| `reviewerId` | NonEmptyString | sim | Ator humano identificado fora do Domain; modelo/provider não é reviewer humano. |
| `reviewedAt` | `Instant` | sim | Imutável. |
| `reason` | NonEmptyString | sim | Justificativa breve e auditável. |
| `evidenceRefs` | array de `EvidenceRef` | sim | Evidência visual/estrutural/contextual; não substitui o hash observado. |
| `reviewBasis` | object | sim | **Adição desta reconciliação (shape proposto; pendente de aprovação com §11, item 12).** `{ checklist: Reported<NonEmptyString>, scale: Reported<NonEmptyString>, context: Reported<NonEmptyString> }` — checklist/rubrica aplicada, escala de avaliação usada e contexto de visualização (ex.: escala de exibição, ambiente/iluminação de referência, vistas comparadas). `not_applicable` quando o reviewer não usou aquele elemento; `unknown` quando usou e o valor não foi registrado; `reported` somente com valor conhecido. O registry de checklists/escalas é **externo ao pacote**: o Domain valida forma e coerência `Reported<>`, nunca o conteúdo da rubrica, e uma rubrica ausente não invalida a revisão — fica `not_applicable`/`unknown` explícito. Justificativa: requisito da proposta §5.3 ("checklist/contexto/escala e refs/hash exatos observados") e da auditoria de contratos (a revisão registra hash, contexto/escala, reviewer e limitações). |
| `limitations` | array de strings | sim | **Adição desta reconciliação.** `[]` quando nenhuma limitação é conhecida; não vazio quando a revisão foi feita sem pixels, sem contexto de escala, sobre proxy/subconjunto dos bytes ou sobre versão de profile diferente da vigente. Limitação não é reprovação: declara o que a revisão **não** cobriu. Mesmo padrão de `ValidationResult.limitations` (§3.7), `ConsistencyAssessment.limitations` (§3.11) e `ChangeImpactReport.limitations` (§3.13). |
| `supersedesRef` | `RecordRef<HumanReview> \| null` | sim | Liga revisão posterior; não apaga/edita aprovação anterior. |
| `extensions` | extension map | não | Notas de rubric/version podem ser namespaced. |

**Aplicabilidade recomendada:** uma review aprova somente o `subjectRef + subjectDigest + observedArtifactHashes` exato. Uma nova versão de qualquer Artifact, alteração de profile/policy ou mismatch de hash exige outra review. Rejeição de um snapshot não rejeita todos os filhos/irmãos do Asset.

**Decisões concorrentes (definição — adicionada nesta reconciliação):** duas ou mais reviews **ativas** (não substituídas) para o mesmo (`subjectRef`, `subjectDigest`) sem cadeia `supersedesRef` entre si são concorrentes **independentemente de terem o mesmo valor de `decision`** — dois `approve` duplicados para o mesmo sujeito/digest também são concorrentes, porque é a cadeia de supersessão que estabelece qual decisão está vigente. Concorrência gera o diagnóstico `review_conflict` e bloqueia promoção até decisão humana. O Domain apenas detecta e relata: **qual** decisão prevalece, e o efeito de aprovações/revogações concorrentes sobre os ponteiros, permanecem política pendente (§11, itens 6 e 7).

**Revogação:** a arquitetura pede eventos de aprovação/rejeição/revogação do profile. Duas alternativas foram analisadas: (a) `reject` superseding — nova review `reject` do mesmo subject com `supersedesRef` ao `approve` anterior; (b) **`revoke` como valor distinto — recomendada nesta revisão (pendente de aprovação)**, porque a proposta consolidada descreve três eventos append-only (aprovação/rejeição/revogação) e porque `reject` e `revoke` têm leituras auditáveis diferentes: `reject` discorda do mérito do snapshot; `revoke` retira a vigência operacional de uma aprovação anterior sem reavaliar mérito. Regras propostas para `revoke`: `supersedesRef` obrigatório ao `approve` exato (mesmo `subjectRef` + `subjectDigest`); uma aprovação revogada deixa de sustentar ponteiro/projeção; o Store limpa `currentApprovedVersionRef` (ou `currentVersionRef`, se aplicável) por transação conforme §4.5; revalidar uma versão revogada exige novo `approve` próprio — `revoke` nunca restaura versão anterior automaticamente. Histórico nunca é apagado/editado em nenhuma das alternativas.

### 3.11 `ConsistencyAssessment`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `subjectRef` | União explícita: `RecordRef<AssetVersion> \| RecordRef<ArtifactVersion>` | sim | Objeto/slot sob avaliação; nunca `Asset`/`Project` lógico sem versão (mesma disciplina de `HumanReview.subjectRef` e `ValidationResult.subjectRef`). |
| `profileVersionRef` | `RecordRef<ProjectVisualProfileVersion> \| null` | sim | Versão de profile usada; `null` exige que o assessment declare não ter baseline visual (limitations). |
| `profileDigest` | `Digest \| null` | sim | Hash exato do profile acima; não aplicar se profile mudou. |
| `policy` | `Free \| Guided \| Locked \| not_selected` | sim | Profile global e política são diferentes; `not_selected` não significa `Free`. |
| `capabilityClaimRefs` | array de `OpaqueRef` | sim | Referências namespaced a claims versionados; contrato CapabilityClaim está fora deste pacote. Pode ser vazio, sem claim implícito. |
| `status` | `not_run \| running \| completed \| inconclusive \| blocked \| failed` | sim | Record é snapshot; transição cria record novo e `supersedesRef` quando necessário. |
| `findings` | array de `{ traitPath, status, observed?, expected?, unit?, evidenceRefs:EvidenceRef[], limitation? }` | sim | `status=match\|deviation\|unknown\|not_applicable`; nenhuma score agregada implícita. **Mapeamento com o vocabulário da proposta §5.3** (`pass/issue/unknown/not_applicable`): `pass`→`match`, `issue`→`deviation`, `unknown`→`unknown`, `not_applicable`→`not_applicable`. O enum desta spec é a proposta canônica do pacote — é o vocabulário que `StyleDeviationDecision` referencia (`accept_deviation`/`reject_deviation`, §3.12) — e o mapeamento é reconciliação documental, não um segundo enum aceito (ver §13.4). `limitation?` é a limitação **deste finding**; as limitações do assessment como um todo vivem em `limitations`. |
| `observedArtifactHashes` | array ordenado de `{ artifactId, sha256 }` | sim | Hashes observados exatos pelo evaluator. (Nome unificado nesta revisão; a redação anterior usava `comparedArtifactHashes` para o mesmo conceito — ver §13.1.) |
| `limitations` | array de strings | sim | **Campo declarado nesta reconciliação — o texto normativo e a proposta §5.3 ("limitações obrigatórias") já o exigiam, mas a tabela de campos não o declarava.** `[]` somente quando nenhuma limitação é conhecida. Obrigatório **não vazio** quando: (a) `profileVersionRef=null` — avaliação sem baseline visual aprovado; (b) `status="completed"` e a cobertura dos trait paths não é derivável no Domain (sujeito `ArtifactVersion`, ou modo diferente de `Locked`); (c) `status` é `inconclusive`, `failed` ou `blocked` — motivo e limites explícitos; (d) qualquer finding porta `status=unknown` ou `not_applicable` que reduza o alcance da conclusão. Limitação não é reprovação nem score: declara o que a avaliação **não** cobriu, e é o que impede ler `completed` como "visualmente consistente". Mesmo padrão de `ValidationResult.limitations` (§3.7), `HumanReview.limitations` (§3.10) e `ChangeImpactReport.limitations` (§3.13). |
| `evaluatorId`, `evaluatorVersion` | NonEmptyString, NonEmptyString | sim | Identificador e versão; “visualmente consistente” não é claim universal. |
| `createdAt` | `Instant` | sim | Imutável. |
| `supersedesRef` | `RecordRef<ConsistencyAssessment> \| null` | sim | Snapshot anterior, se houver. |
| `extensions` | extension map | não | Métricas adicionais com unidades e semantics explícitas. |

Perfil `Locked` exige checks para cada trait marcado como locked e capability claim com version/scope/evidência compatíveis; claim não garante qualidade. A IA pode gerar assessment/findings, nunca registrar aprovação humana.

**Semântica fechada de `status` (proposta; pendente de aprovação):** o record é um snapshot imutável; nenhuma transição ocorre in-place.

- `not_run`: assessment planejado e ainda não executado; `findings=[]`; nunca serve de evidência.
- `running`: declaração de que a avaliação foi iniciada; **exige `findings=[]`** (achados parciais não são interpretáveis sem estado terminal e não entram em v1). Um snapshot `running` nunca é evidência para gate, promoção ou decisão; a conclusão cria record novo com `status` terminal e `supersedesRef` ao snapshot `running`. Consumidores usam o último snapshot terminal da cadeia de supersessão. `running` órfão (sem sucessor terminal) não expira no Domain — não há relógio; timeout/reconciliação pertencem ao Workflow/Store futuros.
- `completed`: todos os checks planejados foram avaliados e cada finding porta `status` próprio. Quando o sujeito é `AssetVersion` com `styleContext.mode="Locked"`, o conjunto de `traitPaths` dos findings deve cobrir todos os trait paths pinados no `styleContext`; cobertura faltante produz diagnóstico `locked_trait_uncovered` e impede `completed`. Quando o sujeito é `ArtifactVersion` (sem `styleContext` próprio) ou o modo não é `Locked`, a cobertura não é derivável no Domain e a limitação deve constar em `limitations`.
- `inconclusive`/`failed`/`blocked`: motivos e limites explícitos em `limitations`; `blocked` indica que um gate (ex.: `Locked` sem capability claim compatível) impediu a execução; `failed` indica erro do evaluator; `inconclusive` indica que um ou mais traits não puderam ser determinados.

**Regras de consistência `policy`/refs:** `Guided`/`Locked` exigem `profileVersionRef` e `profileDigest` não nulos; `Free` pode ter ambos null ou, se mantiver contexto, pinar ambos; `not_selected` admite null e não vira `Free` automaticamente. `profileVersionRef` não nulo exige `profileDigest` não nulo, e vice-versa.

**Derivação de `policy` a partir de `styleContext` (mapeamento adicionado nesta reconciliação):** quando o sujeito é `AssetVersion`, `policy` e o `styleContext` da versão devem concordar — `styleContext=null` ⇒ `policy="not_selected"` (contexto/policy não registrado; nunca `Free`); `styleContext.mode="Free"` ⇒ `policy="Free"`, com `profileVersionRef`/`profileDigest` nulos ou ambos pinados conforme o `styleContext`; `mode="Guided"` ou `"Locked"` ⇒ `policy` igual ao modo, com refs e digest obrigatoriamente pinados. Divergência entre `policy` e o `styleContext` do sujeito é erro de grafo `style_policy_mismatch`. Quando o sujeito é `ArtifactVersion` (que não porta `styleContext`), `policy` declara a política sob a qual a avaliação foi conduzida e a ausência de contexto derivável consta em `limitations`.

### 3.12 `StyleDeviationDecision`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `subjectRef` | União explícita: `RecordRef<AssetVersion> \| RecordRef<ArtifactVersion>` | sim | Snapshot/slot exato considerado; nunca `Asset`/`Project` lógico sem versão. |
| `subjectDigest`, `observedArtifactHashes` | `Digest` e array ordenado de `{ artifactId, sha256 }` | sim | Binding imutável ao snapshot e aos bytes observados. (Nome unificado nesta revisão; a redação anterior usava `artifactHashes` — ver §13.1.) |
| `profileVersionRef`, `profileDigest` | `RecordRef<ProjectVisualProfileVersion> \| null` e `Digest \| null` | sim | Baseline exato. **Ambos são nullable (correção desta reconciliação: a redação anterior declarava o tipo sem `\| null` enquanto a regra 1 admitia `null`).** `null` somente se nenhuma profile se aplica e a decisão explicita isso em `reason`; os dois são nulláveis **juntos** — um null e o outro não null é erro estrutural (`deviation_baseline_incomplete`). |
| `traitPaths` | array de paths namespaced | sim | Traits/campos para os quais se registra desvio. |
| `decision` | `accept_deviation \| reject_deviation` | sim | Decisão humana sobre desvio identificado; não altera profile nem substitui HumanReview de promoção. |
| `reason` | NonEmptyString | sim | Explicação/escopo. |
| `decidedBy`, `decidedAt` | NonEmptyString, Instant | sim | Identidade humana opaca e instante. |
| `evidenceRefs` | array de `EvidenceRef` | sim | Artefato/assessment/finding exatos. |
| `supersedesRef` | Ref de `StyleDeviationDecision` \| null | sim | Correção/decisão posterior append-only. |
| `extensions` | extension map | não | Sem override de policy em campo oculto. |

**Efeito sobre avaliação `Locked` (semântica fechada nesta revisão):**

1. **Aplicabilidade exata:** uma decisão só se aplica a um `ConsistencyAssessment` quando coincidem `subjectRef` + `subjectDigest` + `observedArtifactHashes` + `profileVersionRef` + `profileDigest`, e o `traitPath` do finding está coberto por `traitPaths` da decisão. Profile diferente (ou digest diferente) ⇒ decisão inaplicável; avaliação nova é necessária.
2. **Nenhum record é mutado:** o assessment é imutável; `accept_deviation` não edita findings nem status. O efeito existe apenas em **projeções derivadas** (Store/Workflow/UI): para o snapshot exato, findings de desvio cobertos por um `accept_deviation` vigente podem ser apresentados/tratados como "desvio reconhecido".
3. **`Locked` não é relaxado:** o preflight `Locked` ocorre **antes** do output; um `StyleDeviationDecision` é ato **pós-output**. Portanto ele nunca desbloqueia preflight, nunca converte `Locked` em `Guided`/`Free` e nunca altera o Profile ou cria versão de profile.
4. **Não dispensa `HumanReview`:** `accept_deviation` não é aprovação de promoção. A promoção de `AssetVersion` continua exigindo `HumanReview=approve` exata (§4.2–§4.3); o reviewer pode citar a decisão como evidência (`evidenceRefs`), mas a decisão não substitui o review.
5. **Não libera direitos/consent:** nenhum efeito sobre `RightsRecord`/`ConsentRecord` (§3.15–§3.17).
6. **Vigência e conflito:** vale a decisão mais recente por (`subjectRef`, `subjectDigest`, `traitPath`) na cadeia `supersedesRef`; um `reject_deviation` posterior substitui um `accept_deviation` anterior e o finding volta a contar como desvio não reconhecido. Duas decisões concorrentes sem cadeia de supersessão geram diagnóstico `deviation_decision_conflict`.
7. **Gate de promoção em `Locked` com desvio:** se um desvio coberto por `accept_deviation` vigente deve deixar de bloquear a promoção em modo `Locked`, isso é política de Store/Workflow e **decisão humana pendente** (§11, item 9); o Domain apenas registra a decisão e o diagnóstico, não autoriza o gate. `reject_deviation` em modo `Locked` produz diagnóstico de desvio não resolvido; seu efeito bloqueante sobre promoção também é política pendente — nada é default.

### 3.13 `ChangeImpactReport`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `projectRef` | `RecordRef<Project>` | sim | Escopo de análise. |
| `changedRefs` | array de `ChangedRef` = `{ ref: ImpactTriggerRef, beforeDigest: Digest \| null, afterDigest: Digest \| null }` | sim | Pelo menos um item; `beforeDigest`/`afterDigest` não podem ser ambos null. `ImpactTriggerRef` é **união explícita**: `RecordRef<ProjectVisualProfile> \| RecordRef<ProjectVisualProfileVersion> \| RecordRef<Asset> \| RecordRef<AssetVersion> \| RecordRef<ArtifactVersion> \| ArtifactRef \| RecordRef<AssetRelationship>` — os triggers da proposta §7.2 (profile, AssetVersion, ArtifactVersion/hash, relação anterior e nova). Representa alteração concreta, não intenção futura. |
| `relationshipCatalogVersion` | integer | sim | Versão de predicates/impact traversal usada. |
| `status` | `complete \| partial \| blocked \| failed` | sim | `partial` quando há relações/refs unknown ou grafo incompleto. |
| `findings` | array de `ImpactFinding` = `{ findingId: NonEmptyString, affectedRef: ImpactAffectedRef, pathRefs: array de RecordRef<AssetRelationship>, reasonPredicateIds: array de NonEmptyString namespaced, impactClass, severity, reviewNeed, evidenceRefs: EvidenceRef[] }` | sim | `findingId` único no report; `impactClass=direct\|derived\|review_only\|unknown`; `severity=low\|medium\|high\|unknown` e `reviewNeed=none_indicated\|recommended\|required\|unknown` (campos reconciliados com a proposta §7.2; obrigatórios e explícitos, sem default — `unknown` é valor válido). `ImpactAffectedRef` é **união explícita**: `RecordRef<AssetVersion> \| RecordRef<ArtifactVersion> \| ArtifactRef \| RecordRef<ProjectVisualProfileVersion> \| RecordRef<AssetRelationship> \| RecordRef<HumanReview> \| RecordRef<ValidationResult> \| RecordRef<ConsistencyAssessment> \| RecordRef<Asset> \| RecordRef<ProjectVisualProfile>`. Regra de precisão: quando o afetado tem versão derivável no grafo de entrada, o finding refere a **versão**; os agregados mutáveis (`RecordRef<Asset>`, `RecordRef<ProjectVisualProfile>`) são admitidos apenas para impacto em nível de identidade/ponteiro (`currentVersionRef`, `currentApprovedVersionRef`). `pathRefs` lista as `AssetRelationship` atravessadas na ordem do traversal — os endpoints intermediários são deriváveis dessas relações, portanto não existe array separado; `[]` para impacto direto. `reasonPredicateIds` lista os predicates que justificam o caminho (`[]` quando o impacto não deriva de predicate). Não iniciar geração. |
| `unresolvedRefs` | array de `UnresolvedRef` | sim | `UnresolvedRef` = **união explícita** `RecordRef<T>` (para qualquer dos 17 `recordType` do pacote) ou `ArtifactRef`, na mesma forma usada no resto do grafo, sem duplicatas. Set explícito; vazio somente se todos foram resolvidos no input graph. Qualquer item presente impede `status=complete` (§9.2). |
| `limitations` | array de strings | sim | Unknowns e limite do traversal. |
| `createdAt`, `createdBy` | Instant, NonEmptyString | sim | Assessment reproduzível, sem side effect. |
| `extensions` | extension map | não | Provenance do analyzer/version pode ser adicional. |

O report é uma lista diagnóstica de possíveis dependentes. Não dispara render, provider, validação, upload, notificação ou regeneração automática. Não promete completude se o grafo fornecido é parcial. **`stale` (vocabulário da proposta §7.2):** o report é imutável e não existe campo `stale`; a obsolescência é uma **projeção derivada** — se trigger, profile, grafo de relações ou refs mudarem após `createdAt`, consumidores tratam o report como stale e uma análise nova cria report novo (nunca edição do anterior). Determinar stale exige comparar snapshots e pertence ao Store/Workflow, não ao validador puro.

### 3.14 `ImpactDecisionEvent`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `reportRef` | `RecordRef<ChangeImpactReport>` | sim | Relatório/estado exato considerado. |
| `findingRefs` | array `{ findingId }` | sim | Cada ID deve existir uma única vez no report imutável. |
| `decision` | `regenerate_later \| keep \| discard_candidate \| defer \| request_review` | sim | Decisão humana sobre encaminhamento; nenhum valor executa ação. |
| `reason` | NonEmptyString | sim | Justificativa/condição de follow-up. |
| `decidedBy`, `decidedAt` | NonEmptyString, Instant | sim | Ator e instante. |
| `supersedesRef` | Ref de `ImpactDecisionEvent` \| null | sim | Nova decisão de report/finding sem apagar anterior. |
| `extensions` | extension map | não | IDs de ticket/owner somente se aprovados como dado. |

No enum `run_now` nesta versão proposta: a decisão não pode servir de autorização de side effect nem de consent. `discard_candidate` significa não prosseguir com a candidate, nunca apagar bytes/records. Workflows futuros exigem grant separado. **Mapeamento com o vocabulário da proposta §7.2** (`review`, `defer`, `dismiss`, `pending`): `review`→`request_review`; `defer`→`defer`; `dismiss`→`keep`; `pending`→ausência de event (nenhuma decisão registrada). O enum concreto desta spec é a proposta canônica para o pacote; o mapeamento é reconciliação documental, não novo valor.

### 3.15 `RightsRecord`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `subject` | União discriminada por `kind` — `{kind:"record", ref: RecordRef<AssetVersion> \| RecordRef<ArtifactVersion> \| RecordRef<ProjectVisualProfileVersion> \| ArtifactRef}` **ou** `{kind:"external_component", componentType: ComponentLayer, name: NonEmptyString, version: Reported<NonEmptyString>, contentHash: Reported<Sha256Hex> \| null}` | sim | **Definição completada nesta reconciliação.** `kind` é discriminador obrigatório e exclusivo. `kind:"record"` aceita **somente** sujeitos imutáveis/resolvíveis por hash (bytes de `Artifact` ou versões): agregados mutáveis (`Project`, `Asset`, aggregate `ProjectVisualProfile`) **não** são sujeitos válidos de direitos, porque o claim se liga a bytes/versão exatos — mesmo padrão de `HumanReview.subjectRef` e `ValidationResult.subjectRef`. `kind:"external_component"` identifica componente externo por camada/nome/versão/hash; `componentType` usa o **mesmo enum fechado** de `componentLayer` (`ComponentLayer`) e MUST ser igual a ele — divergência é erro estrutural `rights_component_layer_mismatch`. `contentHash` pode ser null somente se desconhecido; nesse caso o componente não tem identidade exata e `rightsStatus` não pode ser `allowed` (regra de coerência desta reconciliação, pendente junto com §11, item 8). |
| `componentLayer` | `ComponentLayer` = `code \| wrapper \| dependency \| model \| weights \| dataset \| asset \| reference \| output \| other` | sim | Clearance é por componente/camada; wrapper não cobre dependências/pesos. Enum fechado nomeado `ComponentLayer` nesta reconciliação para ser reutilizado por `subject.external_component.componentType`. |
| `rightsStatus` | `unknown \| review_required \| allowed \| restricted \| blocked` | sim | Claim técnico de estado da revisão, não parecer jurídico. |
| `terms` | array de `{ name: NonEmptyString, sourceRef: EvidenceRef \| null, version: NonEmptyString \| null, evidenceRef: EvidenceRef \| null, notes: NonEmptyString \| null }` | sim | Preservar fonte/versão/escopo; campos ausentes são `null`; array vazio não prova ausência de termos. **Distinção definida nesta reconciliação:** `sourceRef` identifica **onde o termo foi obtido** (documento/URL/aviso/contrato de origem); `evidenceRef` identifica **a evidência retida** que suporta o claim (snapshot, captura, registro datado). Podem coincidir, mas não são redundantes: um é procedência, o outro é prova. `name` é `NonEmptyString` (rótulo legível do termo, ex.: `Apache-2.0`, `MIT`, `custom-license`, `no-license-found`) — não é enum fechado, não é parecer jurídico e não substitui a análise por camada. |
| `uses` | mapa com chaves `internal`, `modify`, `store`, `send_remote`, `publish`, `distribute`, `commercial` → `unknown\|allowed\|restricted\|blocked` | sim | Decisão por uso pretendido; sem herança entre campos/componentes. A chave `send_remote` (envio de bytes a provider/destino remoto) é adição desta revisão — pendente de aprovação. Todas as sete chaves são obrigatórias no mapa; ausência de chave é erro estrutural. |
| `evidenceRefs` | array de `EvidenceRef` | sim | Fonte/hash/notice/autorização; URL não implica validação nem autoriza fetch. |
| `reviewedBy`, `reviewedAt` | NonEmptyString \| null, Instant \| null | sim | `null` para `unknown/not reviewed`; credenciais nunca são evidência. |
| `limitations` | array de strings | sim | Obrigatório registrar gaps relevantes. |
| `supersedesRef` | `RecordRef<RightsRecord> \| null` | sim | Nova decisão não apaga anterior. |
| `extensions` | extension map | não | Campos jurídicos/produto seguem política apropriada; Domain não conclui lei. |

`allowed` é um registro de revisão técnica/evidência delimitada, não um parecer jurídico. `unknown` nunca se converte em uso comercial permitido. Direitos de output e input são records separados quando subjects/layers diferem. A especificação não aprova qualquer licença concreta.

**Coerência determinística entre `rightsStatus` geral e `uses` por uso (proposta; pendente de aprovação):** `rightsStatus` descreve o estado/maturidade da revisão do componente; `uses` descreve a permissão de cada atividade. Gates leem `uses` da atividade específica — nunca o estado geral isolado. Regras estruturais (violação = erro):

| `rightsStatus` | `uses` permitido | Justificativa |
|---|---|---|
| `unknown` | todas as chaves em {`unknown`, `blocked`} | Sem revisão, nenhum uso pode constar como permitido. |
| `review_required` | todas em {`unknown`, `restricted`, `blocked`} (nenhuma `allowed`) | Revisão pendente não gera permissão. |
| `allowed` | todas = `allowed` | Estado geral `allowed` sem exceções; qualquer restrição/bloqueio exige estado geral `restricted`. |
| `restricted` | qualquer combinação, com **ao menos uma** chave em {`restricted`, `blocked`, `unknown`}; quando alguma chave for `restricted`, `terms` e/ou `limitations` devem ser não vazios | Permissões condicionadas/parciais. **Correção desta reconciliação:** a redação anterior aceitava `restricted` com todas as chaves `allowed` desde que houvesse `terms`/`limitations` não vazios — um "OU" que permitia estado geral restritivo sem nenhuma atividade restringida e enfraquecia o fail-closed (§3.17 regra 2; §9.2). Condições em `terms`/`limitations` **complementam** a restrição, nunca a substituem. Se o caso de produto for "todas as atividades `allowed` sob condições", o estado geral coerente é `allowed` com as condições registradas em `terms`/`limitations` — não `restricted`. |
| `blocked` | todas = `blocked` | Componente bloqueado não tem uso permitido. |

Fail-closed por atividade: um gate só autoriza a atividade quando existe `RightsRecord` vigente aplicável ao subject exato (record/hash/camada) com a chave correspondente `allowed`; `restricted` exige decisão humana registrada (não é auto-allow); `unknown`, `review_required`, `blocked` ou ausência de record negam a atividade. A matriz completa de atividades (incluindo promoção interna vs publicação) está em §3.17.

### 3.16 `ConsentRecord`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `principalId` | NonEmptyString | sim | Identificador opaco do titular que concede/nega; autenticação fica fora do Domain. |
| `decision` | `grant \| deny \| revoke` | sim | Evento append-only; revoke referencia grant anterior. |
| `scope` | object fechado v1 | sim | `{scopeSchemaVersion:1,effectId,operationId,purpose,inputArtifactHashes[],dataClasses[],providerRef:OpaqueRef|null,destination:{kind:"none"}|{kind:"endpoint",identifier,region},limits:{maxBytes,maxRuns,maxCostMinorUnits,currency,overwriteAllowed,retentionPolicyId}}`. Limites numéricos podem ser null somente se não aplicável e devem falhar fechado para efeito que os exige. |
| `issuedAt`, `expiresAt` | `Instant`, `Instant \| null` | sim | Se houver expiração, deve ser depois de `issuedAt`. |
| `supersedesRef` | `RecordRef<ConsentRecord> \| null` | sim | Obrigatório para `revoke` e para substituição de grant. |
| `evidenceRefs` | array de `EvidenceRef` | sim | Contexto/registro da decisão; não armazenar token/secret. |
| `extensions` | extension map | não | Sem dados secretos. |

`scope.effectId` e `operationId` são strings namespaced; `purpose` é NonEmptyString; `inputArtifactHashes` contém witnesses ordenados; `dataClasses` é lista de IDs namespaced. `providerRef` é null somente para efeito local/sem provider; `destination.kind="none"` é incompatível com operação remota. `limits.maxBytes/maxRuns/maxCostMinorUnits` são inteiros não negativos ou null (null somente se inaplicável e autorizado); `currency` é ISO 4217 ou null e deve existir se maxCost não for null; `overwriteAllowed` é boolean; `retentionPolicyId` é `NonEmptyString \| null` — **correção desta reconciliação**: `null` é admitido somente quando `destination.kind="none"` e nenhuma retenção se aplica; para qualquer efeito que retenha dados (local ou remoto), `null` falha fechado como limite exigido e ausente, exatamente como os limites numéricos. Essas regras e a obrigação de usar endpoint/region concretos para efeito remoto são propostas para aprovação.

Consent é por efeito/destino/inputs e não equivale a licença de direitos: um `grant` nunca autoriza um uso que `RightsRecord` não permita, e um rights `allowed` nunca dispensa o consent exigido para o efeito (ver §3.17). Workflow futuro só aceita `grant` vigente cujo scope cubra a operação exata; `deny`, `revoke`, expiry ou scope mismatch falha fechado. Vigência temporal (comparar `expiresAt` com "agora") é avaliação do gate executor (Workflow/Store), que tem relógio; o validador puro do Domain confere apenas forma e ordem local (`expiresAt > issuedAt`), preservando determinismo sem relógio externo. `revoke` exige `supersedesRef` ao `grant` revogado e escopo idêntico ao do grant (mesmo `effectId`/`operationId`/destino); mismatch de escopo em `revoke` é erro estrutural. UX, retenção e política de expiração continuam decisões abertas.

**Escopo de aplicabilidade por Project/Asset (decisão pendente — §11, item 8; registrada nesta reconciliação).** O `scope` v1 é definido por efeito/operação/provider/destino/hashes de input/classes de dado/limites e **não** contém referência a Project nem a Asset. Consequência verificável e registrada para análise humana: um `grant` cujo escopo coincida com uma operação executada em outro Project satisfaz o match de escopo, porque nada no record o vincula a um Project. Alternativas legítimas, com custos diferentes: (a) vínculo explícito no `scope` (exige campo novo e bump de `scopeSchemaVersion`); (b) derivação da pertinência pelos `inputArtifactHashes` (frágil — os mesmos bytes podem ser usados em dois Projects, como §3.4 permite); (c) grants globais por provider/destino, sem vínculo de projeto (mais simples e menos restritivo). **Nenhuma está escolhida.** Até a decisão, o Domain valida somente o que está declarado e **não** infere pertinência a Project; gates futuros não devem tratar um `grant` nem como restrito a um Project, nem como globalmente válido, sem verificação humana registrada.

### 3.17 Matriz de política de direitos e consent (proposta desta revisão; pendente de aprovação)

A matriz separa atos de lifecycle interno (Domain/Store) de usos sujeitos a direitos/consent. É política recomendada para os gates futuros de Store/Workflow; o Domain deste pacote apenas valida os records. Nada aqui é default antes de aprovação humana; os pontos marcados "pendente" estão consolidados em §11, item 8.

| # | Atividade | Rights consultado (`uses`) | Consent necessário? | Gate/executor (futuro) | Comportamento por estado |
|---|---|---|---|---|---|
| 1 | Promoção/registro interno de `AssetVersion` (criar candidata; mover `currentVersionRef` por CAS) | Nenhuma chave de uso: ato de lifecycle, não direito externo. O estado de rights aplicável deve ser **exibido ao reviewer** como contexto | Não (efeito local) | Store, somente após `HumanReview=approve` exata (§4.3) | `allowed`/`restricted`/`unknown`/`review_required`/`blocked` não mudam a mecânica da promoção; se `unknown` deve bloquear categoricamente a promoção, é **decisão pendente** (§11, item 8). Promoção interna nunca libera nenhum uso externo |
| 2 | Uso interno (visualização, preview, avaliação estrutural/visual no workspace) | `internal` | Não | Workflow/Store/UI | `allowed` autoriza pipelines internos; `restricted` exige decisão humana registrada + condições; `unknown`/`review_required`/`blocked` falham fechado para uso automatizado. Inspeção humana interativa de bytes já armazenados localmente é decisão de UX/produto (pendente) |
| 3 | Modificação (criar versões derivadas/nova `AssetVersion` a partir de bytes existentes) | `modify` (sem herança de `internal`: o gate consulta cada chave exigida pela operação) | Não, se local | Workflow/Store | Mesma regra fail-closed; `unknown` não autoriza modificação automatizada |
| 4 | Armazenamento persistente de bytes (registrar `Artifact` no Store) | `store` | Não, se local | Store | `unknown` no import ⇒ recomendação (pendente): quarentena em área própria do Store, sem apagar nem usar; `blocked` ⇒ não ingerir para uso; preservar para decisão humana |
| 5 | Envio para provider remoto (upload de bytes para geração/processamento) | `send_remote` **e** `ConsentRecord.decision=grant` vigente cobrindo efeito/destino/input hashes/limites exatos | **Sim — obrigatório; consent não é substituído por licença** | Workflow gate imediatamente antes do efeito | rights `allowed` sem grant vigente ⇒ não envia; grant vigente com rights `unknown`/`review_required`/`blocked` ⇒ não envia; `deny`/`revoke`/expirado/scope mismatch ⇒ fail-closed; efeito remoto sem resposta ⇒ reconciliação no futuro `ProviderExecution` (Provenance `unknown`) |
| 6 | Publicação (tornar output acessível/publicado fora do produto) | `publish` + regra de cadeia (abaixo) | Conforme destino/efeito (se houver transferência) | Workflow/Store + ato humano | Só `allowed` no `RightsRecord` do próprio output, com cadeia de componentes revisada e evidenciada, autoriza; `unknown`/`review_required` ⇒ não publicar; `restricted` ⇒ decisão humana + condições |
| 7 | Distribuição (entregar cópias a terceiros, empacotar, redistribuir) | `distribute` + regra de cadeia | Conforme efeito | Workflow/Store + ato humano | Idem publicação; `publish` `allowed` não implica `distribute` `allowed` (sem herança entre chaves) |
| 8 | Uso comercial (monetização/uso em produto comercial) | `commercial` + regra de cadeia | Conforme efeito | Produto/Workflow + ato humano | `unknown` nunca se converte em comercial permitido (regra aprovada); `restricted` exige condições registradas e decisão humana |

Regras transversais (a separação por componente/uso é decisão aprovada — ADR-001, decisão 6; os detalhes de gate abaixo são proposta pendente):

1. **Promoção interna não é publicação externa:** as atividades 1–4 são locais/internas e não autorizam, por si, nenhuma das atividades 5–8. `HumanReview=approve` + CAS move apenas o ponteiro interno.
2. **Consent não substitui licença e licença não substitui consent:** efeito remoto exige os dois records independentes (§3.15 e §3.16), cada um com sujeito/escopo/vigência próprios.
3. **Sem herança de wrapper:** `RightsRecord` de `componentLayer="wrapper"`/`"code"` não cobre `model`, `weights`, `dataset`, `dependency`, `asset`, `reference` nem `output`. Cada camada envolvida em uma operação precisa de record aplicável próprio; ausência = `unknown` = fail-closed para aquela camada.
4. **Regra de cadeia para outputs:** `uses.publish/distribute/commercial = allowed` em um output só pode ser registrado após revisão por componente de todos os inputs/ferramentas/pesos/datasets que contribuíram para ele (AND entre camadas). O Domain não calcula essa conclusão jurídica: ela é claim de revisão humana registrado com evidência (`evidenceRefs`, `terms`, `limitations`), e os gates consomem o record sem recalcular.
5. **Estado geral vs permissão por uso:** `rightsStatus` resume a maturidade/resultado da revisão do componente; gates consultam a chave `uses` da atividade específica; a coerência entre os dois níveis é validada deterministicamente (§3.15).
6. **`unknown`/`review_required`/`restricted`/`blocked`:** `unknown` e `review_required` bloqueiam o uso automatizado correspondente até revisão; `restricted` exige decisão humana registrada e satisfação das condições declaradas; `blocked` proíbe o uso e não é reversível por consent.
7. **Decisões pendentes desta área (§11, item 8):** bloqueio categórico de promoção por rights `unknown`; mecanismo/nome da quarentena de armazenamento; UX, prazos e retenção de consent; lista de gates por atividade para cada capability futura.

## 4. Identidade, versões, iteração e promoção

### 4.1 Estados sem colapsar níveis

| Situação | Representação proposta |
|---|---|
| Asset ainda sem output | `Asset` com `currentVersionRef:null`; não criar Artifact/AssetVersion vazios. |
| Candidata completa, ainda sem review | `AssetVersion.completeness=complete`; ausência de review approve significa candidata. |
| Candidata parcial/indeterminada | `incomplete` + `assemblyState=partial` e missing IDs quando requisito conhecido falta; `unknown` + `assemblyState=unknown` quando registry/semântica não permite concluir. Só outputs presentes têm Artifact/hash; `incomplete/unknown` não promove pela recomendação atual. |
| Rejeitada/iterar | `HumanReview.decision=reject|iterate` amarrada ao subject exato; não apaga candidate nem seus bytes. |
| Tentativa falhou sem output | `Provenance.outcome=failed`, `outputRefs=[]`, `failure` presente; sem ArtifactVersion/AssetVersion fake. |
| Tentativa falhou depois de output parcial | Provenance `partial` aponta somente bundles ArtifactVersion reais (se houve entregas registradas, o outcome é `partial`; `failed` exige `outputRefs=[]` — tabela da §3.6); candidate incompleta opcional se houver caso de produto. |
| Branch concorrente | Duas AssetVersions irmãs com o mesmo parent; ambas preservadas. Não existe branch name implícita no Asset. |
| Merge | Nova AssetVersion com dois ou mais `parentRefs`, provenance da operação de merge e ArtifactVersions novos; nunca mutar as irmãs. |
| Retry | Novo `attemptId`, `deliveryId`, Provenance e ArtifactVersion; não sobrescreve a falha/anterior. |

`createdAt`, ordem de arquivo e ID lexical não definem “latest”. `Asset.currentVersionRef` é o único ponteiro corrente; ordenação/aprovação de versões candidatas é humana.

### 4.2 Binding de review a hashes exatos

Recomendação para criação de `HumanReview`:

1. Congelar o ID/schema da versão candidata e seu digest de record.
2. Enumerar e ordenar deterministicamente todos os Artifacts da(s) ArtifactVersion(s) que a review cobre, com IDs e SHA-256 exatos; incluir `profileDigest` e policy quando estilo for parte da decisão.
3. Escrever review com subject/digest/hash list e reviewer/time/evidence.
4. Se qualquer ID, digest, byte hash, profile version, policy ou scope mudar, criar novo snapshot/review; não atualizar record aprovado in-place.
5. Duas reviews conflitantes do mesmo snapshot sem relação `supersedesRef` bloqueiam promoção. Relógio sozinho não resolve concorrência.

A escolha de canonicalização continua bloqueante; até essa aprovação, exemplos de digest são esquemáticos e nenhuma implementação deve adivinhar bytes/canonicalizer. Se aprovado, o `membersDigest` de cada `ArtifactVersion` (§3.5) pode integrar a evidência de binding com o mesmo requisito de canonicalização.

### 4.3 Pré-condições da promoção de `Asset.currentVersionRef`

Não faz parte do Domain Contract executar a promoção. No futuro, uma operação do Store deve, em uma transação/CAS atômica:

1. Confirmar que candidate e todos os parents pertencem ao Asset/Project alvo; referência não dangling; DAG sem ciclo.
2. Confirmar `completeness=complete`. **Recomendação atual: `incomplete` e `unknown` não promovem**; qualquer exceção de produto exige decisão explícita, scope e review humanos.
3. Confirmar um `HumanReview=approve` aplicável ao mesmo `AssetVersion.id`, digest, conjunto completo de hashes de Artifacts e, se exigido, profile/policy snapshots; recheck de rejeição/revogação/conflitos.
4. Revalidar hash e byte length dos arquivos no Store; Domain isolado não consegue atestar bytes.
5. Comparar `expectedCurrentVersionRef` lido pelo caller ao ponteiro atual (compare-and-swap). Em mismatch, nenhuma escrita: conservar candidate e pedir resolução humana.
6. Alterar somente o ponteiro corrente dentro de uma transação durável; registrar evento/provenance de promoção e permitir rollback por nova promoção, sem remover versões.

Se duas candidatas irmãs forem aprovadas concorrentemente, a primeira CAS pode avançar o ponteiro; a segunda não pisa silenciosamente na primeira. Ela permanece aprovada/branch, mas exige decisão explícita: manter branch, basear/revisar novamente, ou criar merge version. Se o Store é JSON sidecar, SQLite ou outro, atomicidade/mecanismo ainda não escolhido; nenhuma implementação é autorizada. As regras equivalentes para o ponteiro do profile visual estão em §4.5.

### 4.4 AssetVersion vs ArtifactVersion

- Uma AssetVersion captura estado lógico do Asset, snapshot de metadados, estilo e conjunto de entregas incluídas.
- Cada ArtifactVersion captura uma revisão de um slot/entrega e agrupa um ou mais Artifacts físicos por roles.
- Um AssetVersion pode apontar múltiplas ArtifactVersions (p.ex. character model + hair + motion clip + spritesheet). A mesma ArtifactVersion imutável pode ser reutilizada por AssetVersions posteriores do mesmo Asset quando aquele slot não mudou; candidate assets não copiam bytes nem mudam a entrega em place.
- A mesma Artifact bytes/hash pode surgir em entregas diferentes; isso não torna ArtifactVersion iguais.
- Candidate/failed/rejected/approved nunca são estados do Artifact físico.

### 4.5 Atualização concorrente e revogação de `ProjectVisualProfile.currentApprovedVersionRef` (proposta)

O ponteiro do profile recebe segurança equivalente à promoção de `AssetVersion` (§4.3). Nenhuma parte desta seção é executada pelo Domain; são pré-condições de uma operação transacional do Store futuro:

1. **Pertinência:** a versão candidata existe como record independente, está listada em `versionRefs` do aggregate e seu `profileRef` aponta de volta para o mesmo aggregate; aggregate e versão pertencem ao mesmo Project. Referência dangling ou recíproca ausente bloqueia a operação.
2. **Aprovação exata:** existe `HumanReview=approve` aplicável ao `ProjectVisualProfileVersion.id` + `contentDigest` exatos (e aos hashes de Artifacts de referência usados como baseline, quando houver); rejeições/revogações/conflitos posteriores são rechecados. Duas decisões concorrentes sem cadeia `supersedesRef` geram `review_conflict` e bloqueiam.
3. **CAS:** o caller fornece `expectedCurrentApprovedVersionRef` lido antes da decisão; mismatch com o valor atual ⇒ nenhuma escrita; ambas as versões permanecem preservadas e o conflito é apresentado para decisão humana. Relógio sozinho não resolve concorrência.
4. **Transação e imutabilidade:** a operação altera somente o ponteiro, em transação durável do Store; versões de profile nunca são editadas/apagadas; a versão anteriormente aprovada permanece resolvível e rastreável; evento/provenance de atualização é registrado; rollback ocorre por nova atualização transacional, nunca por remoção.
5. **Revogação:** `HumanReview=revoke` (valor recomendado; pendente de aprovação — §3.10) ou, na alternativa rejeitada desta revisão, `reject` superseding do `approve` vigente. Em ambos os casos o Store limpa `currentApprovedVersionRef` para `null` por transação CAS (expected = a versão revogada). A revogação **não** restaura automaticamente nenhuma versão anterior: voltar a apontar qualquer versão exige `approve` próprio vigente para ela.
6. **Corrida promoção×revogação:** promover(v2) e revogar(v2) concorrentes são serializados pela transação do Store; o estado final é o da ordem de commit, não do relógio dos records. Revogação commitada após promoção limpa o ponteiro; promoção commitada após revogação da mesma versão é inválida no gate 2 (approve revogado não sustenta ponteiro) e deve falhar com diagnóstico.
7. **Sem reinterpretação retroativa:** mover ou limpar o ponteiro não reinterpreta `AssetVersion`/`ConsistencyAssessment` antigos — eles permanecem pinados às versões/digests que registraram (regra aprovada na proposta §5.2).

### 4.6 Concorrência e edição dos records mutáveis (`Project`, `Asset`, aggregate `ProjectVisualProfile`) — adicionado nesta reconciliação

§4.3 e §4.5 definem CAS para os dois ponteiros. Os demais campos dos três records mutáveis (`Project.displayName`/`visualProfileRef`; `Asset.displayName`/`description`/`tags`/`assetTypeId`; `ProjectVisualProfile.versionRefs`/`displayName`) também podem ser editados concorrentemente e não estavam cobertos. Regras propostas (pendentes de aprovação humana junto com a política de concorrência do §11, item 6):

1. **Só o Store muta.** O Domain nunca aplica edição: valida o grafo candidato recebido e relata (§8).
2. **CAS generalizado (proposta):** toda transação que alterar um record mutável apresenta o digest do estado lido antes da decisão (`expectedDigest` do record inteiro) — o mesmo mecanismo já proposto para os ponteiros. Mismatch ⇒ nenhuma escrita, nenhuma perda, conflito apresentado para decisão humana. Alternativas legítimas: CAS por campo (`expectedValue` por campo), mais permissivo e mais complexo de auditar; ou last-write-wins com diagnóstico, o mais simples e o único que pode descartar edição humana em silêncio — por isso não recomendado. A escolha é humana e não está feita aqui.
3. **`versionRefs` cresce por anexação serializada:** anexar uma `ProjectVisualProfileVersion` ao aggregate é adição à lista; duas adições concorrentes são serializadas pela transação e o resultado contém ambas, sem duplicatas (duplicidade já é erro de grafo, §9.2). Remoção de entrada de `versionRefs` não é operação prevista: versões nunca são apagadas (§3.8, §4.5 regra 4).
4. **Editar identidade não cria identidade nova:** mudar `displayName`/`description`/`tags`/`assetTypeId` de um `Asset` não cria outro `Asset` nem reinterpreta `AssetVersion` antigas, cujo `assetSnapshot` permanece congelado (§3.3; proposta §7.1).
5. **Nenhuma edição de record mutável substitui ato humano:** editar `Asset`/`Project`/aggregate não move ponteiro, não aprova versão, não altera `HumanReview`, `ConsistencyAssessment`, `RightsRecord` nem `ConsentRecord`.
6. **Assimetria por desenho:** `AssetVersion`, `ArtifactVersion`, `ProjectVisualProfileVersion`, `Provenance` e os records de avaliação/decisão nunca são editados (§2.3, §2.4); apenas os três agregados mutáveis admitem transação, e sempre com CAS se a regra 2 for aprovada.

Permanece dependendo de decisão humana: escolher entre CAS por record, CAS por campo ou last-write-wins com diagnóstico; e definir se edição de campos de identidade exige justificativa/evidência registradas (ex.: evento próprio append-only). Nenhum default foi adotado.

## 5. Slot registry e exemplos de grupos

**Como ler os blocos de exemplo (regra adicionada nesta reconciliação).** §5.1–§5.4 ilustram entregas isoladas (um bloco por caso; §5.2 tem dois blocos: a entrega e o estado por propriedade no `AssetVersion`); §5.5 traz fragmentos de lifecycle; **§5.6 é o único grafo sintético completo e autoconsistente**; §5.7 acrescenta cenários suplementares. Os blocos **não** formam, somados, um único grafo válido: §5.5 e §5.7 referenciam records de §5.6 por declaração (refs não resolvidas no bloco) e descrevem **estados alternativos** do mesmo cenário — por exemplo, §5.6 mantém `ProjectVisualProfile.currentApprovedVersionRef` apontando para `pvpv_...0010` enquanto §5.7 traz o `HumanReview=revoke` daquela aprovação. Unir tudo num único grafo produziria exatamente as violações que §9.2 lista como negativas. Consequência para fixtures (§9.1): cada cenário é montado separadamente; o caso positivo "ponteiro de profile promovido **e** depois revogado por CAS" (§9.1, item 4) vem da cadeia de §5.7, não da união dos blocos.

**Cobertura do registry v1.** Os slots/roles abaixo são orientados a 3D e spritesheet. Slots, roles e `formatId` para fluxos 2D e 2.5D (imagem 2D fonte, PSD em camadas, máscaras por camada, rig 2.5D/runtime, atlas 2D, expressões/visemes) **não** são propostos neste pacote; o mecanismo que os comportaria é o mesmo (registry versionado + `formatId` namespaced + `extensions`) e seus IDs são decisão pendente — ver §8.2 e §11, item 5. Nenhum formato ou provider candidato citado em outros documentos vira capacidade suportada por esta spec.

**Registro sugerido (não aprovado):**

| `slotId` | Roles e cardinalidade sugeridas | Notas |
|---|---|---|
| `lia.slot.character.model` | `lia.role.character.model`: 1..1; `lia.role.metadata.sidecar`: 0..N | Modelo principal e sidecars declarados; formato não inferido pela extensão. |
| `lia.slot.hair.geometry` | `lia.role.hair.geometry`: 1..N; `lia.role.hair.material`: 0..N; `lia.role.hair.texture`: 0..N | Geometria/parte/cartões podem ser múltiplos. Skinning/attachment são estados separados e não presumidos. |
| `lia.slot.motion.clip` | `lia.role.motion.clip`: 1..1; `lia.role.motion.skeleton`: 0..1; `lia.role.motion.metadata`: 0..N | Fps/timebase/rig mapping são metadados tipados ou extensão; imagem estática não prova movimento. |
| `lia.slot.spritesheet.atlas` | `lia.role.spritesheet.image`: 1..1; `lia.role.spritesheet.manifest`: 1..1; `lia.role.metadata.sidecar`: 0..N | Link manifest → PNG deve ser explícito e validar hash/dimensões declarados. |

Cada versão do slot congela roles/min/max. Alterar cardinalidade gera nova `slotSchemaVersion`; validator não reinterpretará retroativamente os membros. Os nomes/roles acima são propostas para feedback, não catálogo aprovado.

### 5.1 Personagem — modelo + metadata

Exemplo de `ArtifactVersion` completo, um modelo e um sidecar optional ausente. IDs/hashes são sintéticos:

```json
{
  "recordType": "ArtifactVersion",
  "schemaVersion": 1,
  "id": "afv_550e8400-e29b-41d4-a716-446655440011",
  "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
  "assetRef": { "recordType": "Asset", "id": "ast_550e8400-e29b-41d4-a716-446655440002", "schemaVersion": 1 },
  "slotId": "lia.slot.character.model",
  "slotSchemaVersion": 1,
  "deliveryId": "dly_550e8400-e29b-41d4-a716-446655440012",
  "assemblyState": "complete",
  "expectedRoles": [
    { "roleId": "lia.role.character.model", "minCount": 1, "maxCount": 1 },
    { "roleId": "lia.role.metadata.sidecar", "minCount": 0, "maxCount": null }
  ],
  "members": [
    {
      "memberKey": "model",
      "roleId": "lia.role.character.model",
      "artifactRef": {
        "recordType": "Artifact",
        "id": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "schemaVersion": 1,
        "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "ordinal": null
    }
  ],
  "memberLinks": [],
  "membersDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "2222222222222222222222222222222222222222222222222222222222222222" },
  "parentRefs": [],
  "provenanceRef": { "recordType": "Provenance", "id": "prv_550e8400-e29b-41d4-a716-446655440013", "schemaVersion": 1 },
  "createdAt": "2026-10-25T12:00:00Z",
  "extensions": {}
}
```

### 5.2 Cabelo — geometria, material e estado independente de rig

`Asset.assetTypeId="lia.asset.hair"` identifica o tipo; o **estado por propriedade** vive na extensão ilustrativa `lia.hair.state.v1` da **`AssetVersion`** — correção desta reconciliação (antes o texto a colocava no `Asset` e o exemplo JSON na `ArtifactVersion`, dois donos incompatíveis entre si).

**Dono correto e justificativa:** `Asset` é registro **mutável** de identidade (§2.3, §3.2) e não pode portar estado versionado — colocá-lo ali permitiria que o estado mudasse sem nova versão, sem digest e sem revisão humana, violando imutabilidade e rastreabilidade (§2.4, §4.2, §4.6). `ArtifactVersion` descreve **uma entrega de um slot** (§3.5); o estado de cabelo (geometria, materiais, UV, associação, attachment, skinning, springs) atravessa várias entregas e pertence à **revisão coerente do asset** (§3.3), que é imutável, entra no digest de review e só muda por nova versão. Fatos intrínsecos a um arquivo específico (ex.: canais/UV de um GLB) permanecem em `Artifact.contentMetadata` e nos members/roles da entrega; uma rig association real usa `AssetRelationship`/evidência explícita; bone/transform, se conhecidos, ficam em metadata namespaced. Não inferir skinned hair, spring bones, VRM nem ligação ao skeleton por existir GLB.

**Vocabulário e derivação dos valores:** cada propriedade usa `present|absent|unknown|not_applicable` — nenhum estado infere outro. No exemplo abaixo os valores derivam do que a entrega declara: `geometry=present` (há member com `lia.role.hair.geometry`); `materials=absent` (a role `lia.role.hair.material` é opcional e nenhum member com essa role foi entregue); `uv`/`association`/`attachment=unknown` (nada no grafo permite concluir); `skinning=absent`; `springs=not_applicable`. O valor `partial`, usado no exemplo da proposta §5.3, **não** pertence a este vocabulário — divergência registrada em §8.3 e §13.4 (recomendação R18), não resolvida por default. A extensão e seu shape são exemplos sintéticos **pendentes de aprovação** (§11, itens 5 e 12), não formato legado compatível. No exemplo completo da §5.6, o `Asset` de cabelo (`ast_...0019`) porta `extensions: {}` exatamente por esta regra.

```json
{
  "recordType": "ArtifactVersion",
  "schemaVersion": 1,
  "id": "afv_550e8400-e29b-41d4-a716-446655440021",
  "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
  "assetRef": { "recordType": "Asset", "id": "ast_550e8400-e29b-41d4-a716-446655440022", "schemaVersion": 1 },
  "slotId": "lia.slot.hair.geometry",
  "slotSchemaVersion": 1,
  "deliveryId": "dly_550e8400-e29b-41d4-a716-446655440023",
  "assemblyState": "complete",
  "expectedRoles": [
    { "roleId": "lia.role.hair.geometry", "minCount": 1, "maxCount": null },
    { "roleId": "lia.role.hair.material", "minCount": 0, "maxCount": null },
    { "roleId": "lia.role.hair.texture", "minCount": 0, "maxCount": null }
  ],
  "members": [
    {
      "memberKey": "hair-part-0",
      "roleId": "lia.role.hair.geometry",
      "artifactRef": {
        "recordType": "Artifact",
        "id": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "schemaVersion": 1,
        "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
      },
      "ordinal": 0
    }
  ],
  "memberLinks": [],
  "membersDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "3333333333333333333333333333333333333333333333333333333333333333" },
  "parentRefs": [],
  "provenanceRef": { "recordType": "Provenance", "id": "prv_550e8400-e29b-41d4-a716-446655440024", "schemaVersion": 1 },
  "createdAt": "2026-10-25T12:01:00Z",
  "extensions": {}
}
```

`AssetVersion` de cabelo correspondente, **portadora da extensão de estado** (IDs sintéticos; refs declaradas, não resolvidas neste bloco):

```json
{
  "recordType": "AssetVersion",
  "schemaVersion": 1,
  "id": "asv_550e8400-e29b-41d4-a716-446655440073",
  "assetRef": { "recordType": "Asset", "id": "ast_550e8400-e29b-41d4-a716-446655440022", "schemaVersion": 1 },
  "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
  "parentRefs": [],
  "assetSnapshot": { "assetTypeId": "lia.asset.hair", "displayName": "Synthetic Hair", "description": null, "tags": [] },
  "artifactVersionRefs": [ { "recordType": "ArtifactVersion", "id": "afv_550e8400-e29b-41d4-a716-446655440021", "schemaVersion": 1 } ],
  "provenanceRefs": [ { "recordType": "Provenance", "id": "prv_550e8400-e29b-41d4-a716-446655440024", "schemaVersion": 1 } ],
  "completionBasis": {
    "status": "known",
    "policyId": "lia.completion.hair-geometry-only",
    "policyVersion": 1,
    "requirements": [ { "requirementId": "lia.req.hair.geometry", "slotId": "lia.slot.hair.geometry", "slotSchemaVersion": 1, "roleId": "lia.role.hair.geometry", "minCount": 1, "maxCount": null } ]
  },
  "completeness": { "state": "complete", "missingRequirementIds": [], "unknownReasonIds": [] },
  "styleContext": null,
  "createdAt": "2026-10-25T12:01:30Z",
  "createdBy": "human:synthetic-reviewer",
  "extensions": { "lia.hair.state.v1": { "schemaVersion": 1, "data": { "geometry": "present", "materials": "absent", "uv": "unknown", "association": "unknown", "attachment": "unknown", "skinning": "absent", "springs": "not_applicable" } } }
}
```

### 5.3 Animação — clip e skeleton não são personagem

Um `Asset` tipado como `lia.asset.motion_clip` tem ArtifactVersion no slot de motion. Relação `lia.rel.animates` pode conectar clip a personagem/rig somente com predicate aprovado. Tempo, sample rate, coordinate system, source/target rig signatures e retarget mapping não podem ser inferidos de `.npz`/`.fbx`/`.glb`; cada medida precisa de metadata/provenance/validator explícitos.

```json
{
  "recordType": "ArtifactVersion",
  "schemaVersion": 1,
  "id": "afv_550e8400-e29b-41d4-a716-446655440031",
  "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
  "assetRef": { "recordType": "Asset", "id": "ast_550e8400-e29b-41d4-a716-446655440032", "schemaVersion": 1 },
  "slotId": "lia.slot.motion.clip",
  "slotSchemaVersion": 1,
  "deliveryId": "dly_550e8400-e29b-41d4-a716-446655440033",
  "assemblyState": "complete",
  "expectedRoles": [
    { "roleId": "lia.role.motion.clip", "minCount": 1, "maxCount": 1 },
    { "roleId": "lia.role.motion.skeleton", "minCount": 0, "maxCount": 1 }
  ],
  "members": [
    {
      "memberKey": "clip",
      "roleId": "lia.role.motion.clip",
      "artifactRef": {
        "recordType": "Artifact",
        "id": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "schemaVersion": 1,
        "sha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
      },
      "ordinal": null
    }
  ],
  "memberLinks": [],
  "membersDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "4444444444444444444444444444444444444444444444444444444444444444" },
  "parentRefs": [],
  "provenanceRef": { "recordType": "Provenance", "id": "prv_550e8400-e29b-41d4-a716-446655440034", "schemaVersion": 1 },
  "createdAt": "2026-10-25T12:02:00Z",
  "extensions": { "lia.motion.clip.v1": { "schemaVersion": 1, "data": { "frameRate": { "state": "unknown" }, "timebase": { "state": "unknown" }, "sourceRigSignature": { "state": "unknown" }, "targetRigSignature": { "state": "unknown" }, "retargetMappingRef": null } } }
}
```

### 5.4 Spritesheet — PNG e manifesto no mesmo delivery, com link

```json
{
  "recordType": "ArtifactVersion",
  "schemaVersion": 1,
  "id": "afv_550e8400-e29b-41d4-a716-446655440041",
  "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
  "assetRef": { "recordType": "Asset", "id": "ast_550e8400-e29b-41d4-a716-446655440042", "schemaVersion": 1 },
  "slotId": "lia.slot.spritesheet.atlas",
  "slotSchemaVersion": 1,
  "deliveryId": "dly_550e8400-e29b-41d4-a716-446655440043",
  "assemblyState": "complete",
  "expectedRoles": [
    { "roleId": "lia.role.spritesheet.image", "minCount": 1, "maxCount": 1 },
    { "roleId": "lia.role.spritesheet.manifest", "minCount": 1, "maxCount": 1 }
  ],
  "members": [
    {
      "memberKey": "atlas",
      "roleId": "lia.role.spritesheet.image",
      "artifactRef": {
        "recordType": "Artifact",
        "id": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "schemaVersion": 1,
        "sha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
      },
      "ordinal": null
    },
    {
      "memberKey": "manifest",
      "roleId": "lia.role.spritesheet.manifest",
      "artifactRef": {
        "recordType": "Artifact",
        "id": "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "schemaVersion": 1,
        "sha256": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
      },
      "ordinal": null
    }
  ],
  "memberLinks": [ { "predicateId": "lia.artifact.manifest_for", "fromMemberKey": "manifest", "toMemberKey": "atlas" } ],
  "membersDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "5555555555555555555555555555555555555555555555555555555555555555" },
  "parentRefs": [],
  "provenanceRef": { "recordType": "Provenance", "id": "prv_550e8400-e29b-41d4-a716-446655440044", "schemaVersion": 1 },
  "createdAt": "2026-10-25T12:03:00Z",
  "extensions": { "lia.spritesheet.v1": { "schemaVersion": 1, "data": { "frameCount": { "state": "unknown" }, "layout": { "state": "unknown" }, "manifestImageSha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" } } }
}
```

### 5.5 Partial, iteration e failure sem output

- Partial spritesheet pode ter só PNG como member, `assemblyState:"partial"`, manifesto role faltante e `AssetVersion.completeness.state:"incomplete"`. Hash do PNG é preservado; sem manifesto, não inventar dimensões/frame mapping. Slot/role schema desconhecido usa `assemblyState:"unknown"` e `completeness.state:"unknown"`.
- Iteração cria outro `deliveryId`, ArtifactVersion com `parentRefs` do mesmo slot e novo Artifact (ou Artifact id igual se bytes forem idênticos). AssetVersion candidata guarda a nova composição; a antiga não é sobrescrita.
- Falha antes de qualquer output cria somente `Provenance` `failed`, `outputRefs:[]`, `failure` presente. Não criar `Artifact` vazio, `ArtifactVersion` vazia nem `AssetVersion` com sucesso implícito.

#### Fragmentos JSON de lifecycle (IDs e hashes sintéticos)

Os objetos nomeados abaixo são records completos quando identificados como tais; `assetVersionCompleteness` e `siblingLineage` são apenas fragments dos campos indicados. Não constituem execução/fixture real.

```json
{
  "failedProvenance": {
    "recordType": "Provenance",
    "schemaVersion": 1,
    "id": "prv_550e8400-e29b-41d4-a716-446655440050",
    "attemptId": "att_550e8400-e29b-41d4-a716-446655440051",
    "operationId": "lia.sprite.render",
    "outcome": "failed",
    "inputRefs": [],
    "outputRefs": [],
    "toolRefs": [],
    "adapterRef": null,
    "providerRef": null,
    "backend": { "state": "not_applicable" },
    "executionContext": { "moduleId": { "state": "reported", "value": "lia.module.lia3dsprite" }, "capabilityId": { "state": "unknown" }, "workflowRunRef": { "state": "not_applicable" }, "stepRef": { "state": "not_applicable" }, "providerExecutionRef": { "state": "not_applicable" } },
    "environment": {"os":{"state":"unknown"},"architecture":{"state":"unknown"},"cpu":{"state":"unknown"},"gpu":{"state":"unknown"},"driver":{"state":"unknown"},"runtime":{"state":"unknown"},"toolVersions":[],"spatialConvention":{"state":"unknown"},"timebase":{"state":"unknown"}},
    "parameters": {},
    "rightsRefs": [],
    "consentRefs": [],
    "startedAt": "2026-10-25T13:00:00Z",
    "finishedAt": "2026-10-25T13:00:01Z",
    "failure": { "code": "lia.render.initialization_failed", "summary": "Synthetic failure; no output bytes were produced." },
    "extensions": {}
  },
  "partialArtifactVersion": {
    "recordType": "ArtifactVersion",
    "schemaVersion": 1,
    "id": "afv_550e8400-e29b-41d4-a716-446655440052",
    "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
    "assetRef": { "recordType": "Asset", "id": "ast_550e8400-e29b-41d4-a716-446655440042", "schemaVersion": 1 },
    "slotId": "lia.slot.spritesheet.atlas",
    "slotSchemaVersion": 1,
    "deliveryId": "dly_550e8400-e29b-41d4-a716-446655440053",
    "assemblyState": "partial",
    "expectedRoles": [
      { "roleId": "lia.role.spritesheet.image", "minCount": 1, "maxCount": 1 },
      { "roleId": "lia.role.spritesheet.manifest", "minCount": 1, "maxCount": 1 }
    ],
    "members": [
      {
        "memberKey": "atlas",
        "roleId": "lia.role.spritesheet.image",
        "artifactRef": {
          "recordType": "Artifact",
          "id": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          "schemaVersion": 1,
          "sha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
        },
        "ordinal": null
      }
    ],
    "memberLinks": [],
    "membersDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "6666666666666666666666666666666666666666666666666666666666666666" },
    "parentRefs": [],
    "provenanceRef": { "recordType": "Provenance", "id": "prv_550e8400-e29b-41d4-a716-446655440054", "schemaVersion": 1 },
    "createdAt": "2026-10-25T13:00:01Z",
    "extensions": {}
  },
  "partialProvenance": {
    "recordType": "Provenance",
    "schemaVersion": 1,
    "id": "prv_550e8400-e29b-41d4-a716-446655440054",
    "attemptId": "att_550e8400-e29b-41d4-a716-446655440055",
    "operationId": "lia.sprite.render",
    "outcome": "partial",
    "inputRefs": [],
    "outputRefs": [ { "recordType": "ArtifactVersion", "id": "afv_550e8400-e29b-41d4-a716-446655440052", "schemaVersion": 1 } ],
    "toolRefs": [],
    "adapterRef": null,
    "providerRef": null,
    "backend": { "state": "not_applicable" },
    "executionContext": { "moduleId": { "state": "reported", "value": "lia.module.lia3dsprite" }, "capabilityId": { "state": "unknown" }, "workflowRunRef": { "state": "not_applicable" }, "stepRef": { "state": "not_applicable" }, "providerExecutionRef": { "state": "not_applicable" } },
    "environment": {"os":{"state":"unknown"},"architecture":{"state":"unknown"},"cpu":{"state":"unknown"},"gpu":{"state":"unknown"},"driver":{"state":"unknown"},"runtime":{"state":"unknown"},"toolVersions":[],"spatialConvention":{"state":"unknown"},"timebase":{"state":"unknown"}},
    "parameters": {},
    "rightsRefs": [],
    "consentRefs": [],
    "startedAt": "2026-10-25T13:00:00Z",
    "finishedAt": "2026-10-25T13:00:01Z",
    "failure": null,
    "extensions": {}
  },
  "assetVersionCompleteness": { "state": "incomplete", "missingRequirementIds": [ "lia.req.spritesheet.manifest" ], "unknownReasonIds": [] },
  "reviewEvents": [
    {
      "recordType": "HumanReview",
      "schemaVersion": 1,
      "id": "hr_550e8400-e29b-41d4-a716-446655440056",
      "subjectRef": { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440057", "schemaVersion": 1 },
      "subjectDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "1111111111111111111111111111111111111111111111111111111111111111" },
      "observedArtifactHashes": [ { "artifactId": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", "sha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" } ],
      "decision": "reject",
      "reviewerId": "human:synthetic-reviewer",
      "reviewedAt": "2026-10-25T13:05:00Z",
      "reason": "Synthetic rejection; missing evidence/output.",
      "evidenceRefs": [],
      "supersedesRef": null,
      "extensions": {}
    },
    {
      "recordType": "HumanReview",
      "schemaVersion": 1,
      "id": "hr_550e8400-e29b-41d4-a716-446655440058",
      "subjectRef": { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440057", "schemaVersion": 1 },
      "subjectDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "1111111111111111111111111111111111111111111111111111111111111111" },
      "observedArtifactHashes": [ { "artifactId": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", "sha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" } ],
      "decision": "iterate",
      "reviewerId": "human:synthetic-reviewer",
      "reviewedAt": "2026-10-25T13:06:00Z",
      "reason": "Create a new version with the missing manifest.",
      "evidenceRefs": [],
      "supersedesRef": { "recordType": "HumanReview", "id": "hr_550e8400-e29b-41d4-a716-446655440056", "schemaVersion": 1 },
      "extensions": {}
    }
  ],
  "siblingLineage": {
    "sharedParent": { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440059", "schemaVersion": 1 },
    "leftCandidate": { "id": "asv_550e8400-e29b-41d4-a716-446655440060", "parentRefs": [ { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440059", "schemaVersion": 1 } ] },
    "rightCandidate": { "id": "asv_550e8400-e29b-41d4-a716-446655440061", "parentRefs": [ { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440059", "schemaVersion": 1 } ] },
    "mergeCandidate": { "id": "asv_550e8400-e29b-41d4-a716-446655440062", "parentRefs": [ { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440060", "schemaVersion": 1 }, { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440061", "schemaVersion": 1 } ] },
    "note": "Fragmento: apenas os campos de linhagem. Duas candidatas irmãs (0060/0061) ficam preservadas; promoção com expectedCurrentVersionRef stale não sobrescreve o ponteiro. Merge, se escolhido por ato humano, cria outro AssetVersion (0062) com ambos os pais, provenance da operação de merge e ArtifactVersions novos; as irmãs nunca são mutadas."
  }
}
```

### 5.6 Exemplo JSON sintético de todos os contratos

O array a seguir é um exemplo documental de grafo coerente, não uma fixture real nem uma aprovação de formato. Os digests do Profile/AssetVersion são placeholders sintáticos e não foram recalculados: a canonicalização continua aberta. O `HumanReview` de Asset está aprovado, mas `Asset.currentVersionRef` permanece `null` de propósito: o exemplo não representa promoção/Store. Nesta revisão, `ProjectVisualProfileVersion` aparece como record independente no array, e o aggregate `ProjectVisualProfile` mantém apenas `versionRefs`/`currentApprovedVersionRef` (§3.8). Ele contém também `ConsentRecord=deny` e rights `unknown`; não autoriza upload/uso comercial (§3.17). Para `ArtifactVersion` de cabelo, animação e spritesheet, ver §5.2–§5.4.

```json
{
  "records": [
    {
      "recordType": "Project",
      "schemaVersion": 1,
      "id": "prj_550e8400-e29b-41d4-a716-446655440001",
      "displayName": "Synthetic Lia Demo",
      "createdAt": "2026-10-25T12:00:00Z",
      "updatedAt": "2026-10-25T12:10:00Z",
      "visualProfileRef": { "recordType": "ProjectVisualProfile", "id": "pvp_550e8400-e29b-41d4-a716-446655440002", "schemaVersion": 1 },
      "extensions": {}
    },
    {
      "recordType": "Asset",
      "schemaVersion": 1,
      "id": "ast_550e8400-e29b-41d4-a716-446655440003",
      "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
      "assetTypeId": "lia.asset.character",
      "displayName": "Synthetic Character",
      "description": null,
      "tags": [],
      "createdAt": "2026-10-25T12:00:00Z",
      "updatedAt": "2026-10-25T12:10:00Z",
      "currentVersionRef": null,
      "extensions": {}
    },
    {
      "recordType": "Asset",
      "schemaVersion": 1,
      "id": "ast_550e8400-e29b-41d4-a716-446655440019",
      "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
      "assetTypeId": "lia.asset.hair",
      "displayName": "Synthetic Hair",
      "description": null,
      "tags": [],
      "createdAt": "2026-10-25T12:00:00Z",
      "updatedAt": "2026-10-25T12:00:00Z",
      "currentVersionRef": null,
      "extensions": {}
    },
    {
      "recordType": "Artifact",
      "schemaVersion": 1,
      "id": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "byteLength": 123456,
      "mediaType": "model/gltf-binary",
      "formatId": "lia.format.glb",
      "contentMetadata": {},
      "extensions": {}
    },
    {
      "recordType": "ArtifactVersion",
      "schemaVersion": 1,
      "id": "afv_550e8400-e29b-41d4-a716-446655440004",
      "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
      "assetRef": { "recordType": "Asset", "id": "ast_550e8400-e29b-41d4-a716-446655440003", "schemaVersion": 1 },
      "slotId": "lia.slot.character.model",
      "slotSchemaVersion": 1,
      "deliveryId": "dly_550e8400-e29b-41d4-a716-446655440020",
      "assemblyState": "complete",
      "expectedRoles": [ { "roleId": "lia.role.character.model", "minCount": 1, "maxCount": 1 } ],
      "members": [
        {
          "memberKey": "model",
          "roleId": "lia.role.character.model",
          "artifactRef": {
            "recordType": "Artifact",
            "id": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "schemaVersion": 1,
            "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          },
          "ordinal": null
        }
      ],
      "memberLinks": [],
      "membersDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "7777777777777777777777777777777777777777777777777777777777777777" },
      "parentRefs": [],
      "provenanceRef": { "recordType": "Provenance", "id": "prv_550e8400-e29b-41d4-a716-446655440006", "schemaVersion": 1 },
      "createdAt": "2026-10-25T12:03:00Z",
      "extensions": {}
    },
    {
      "recordType": "AssetVersion",
      "schemaVersion": 1,
      "id": "asv_550e8400-e29b-41d4-a716-446655440005",
      "assetRef": { "recordType": "Asset", "id": "ast_550e8400-e29b-41d4-a716-446655440003", "schemaVersion": 1 },
      "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
      "parentRefs": [],
      "assetSnapshot": { "assetTypeId": "lia.asset.character", "displayName": "Synthetic Character", "description": null, "tags": [] },
      "artifactVersionRefs": [ { "recordType": "ArtifactVersion", "id": "afv_550e8400-e29b-41d4-a716-446655440004", "schemaVersion": 1 } ],
      "provenanceRefs": [ { "recordType": "Provenance", "id": "prv_550e8400-e29b-41d4-a716-446655440006", "schemaVersion": 1 } ],
      "completionBasis": {
        "status": "known",
        "policyId": "lia.completion.character-model-only",
        "policyVersion": 1,
        "requirements": [ { "requirementId": "lia.req.character.model", "slotId": "lia.slot.character.model", "slotSchemaVersion": 1, "roleId": "lia.role.character.model", "minCount": 1, "maxCount": 1 } ]
      },
      "completeness": { "state": "complete", "missingRequirementIds": [], "unknownReasonIds": [] },
      "styleContext": {
        "mode": "Guided",
        "profileRef": { "recordType": "ProjectVisualProfile", "id": "pvp_550e8400-e29b-41d4-a716-446655440002", "schemaVersion": 1 },
        "profileVersionRef": { "recordType": "ProjectVisualProfileVersion", "id": "pvpv_550e8400-e29b-41d4-a716-446655440010", "schemaVersion": 1 },
        "profileDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" },
        "traitPaths": [ "style.name", "form.silhouette" ]
      },
      "createdAt": "2026-10-25T12:03:00Z",
      "createdBy": "human:synthetic-reviewer",
      "extensions": {}
    },
    {
      "recordType": "Provenance",
      "schemaVersion": 1,
      "id": "prv_550e8400-e29b-41d4-a716-446655440006",
      "attemptId": "att_550e8400-e29b-41d4-a716-446655440018",
      "operationId": "lia.asset.register",
      "outcome": "succeeded",
      "inputRefs": [ { "recordType": "Artifact", "id": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "schemaVersion": 1, "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } ],
      "outputRefs": [ { "recordType": "ArtifactVersion", "id": "afv_550e8400-e29b-41d4-a716-446655440004", "schemaVersion": 1 } ],
      "toolRefs": [],
      "adapterRef": null,
      "providerRef": null,
      "backend": { "state": "not_applicable" },
      "executionContext": { "moduleId": { "state": "reported", "value": "lia.module.forge" }, "capabilityId": { "state": "not_applicable" }, "workflowRunRef": { "state": "not_applicable" }, "stepRef": { "state": "not_applicable" }, "providerExecutionRef": { "state": "not_applicable" } },
      "environment": {"os":{"state":"unknown"},"architecture":{"state":"unknown"},"cpu":{"state":"unknown"},"gpu":{"state":"unknown"},"driver":{"state":"unknown"},"runtime":{"state":"unknown"},"toolVersions":[],"spatialConvention":{"state":"unknown"},"timebase":{"state":"unknown"}},
      "parameters": {},
      "rightsRefs": [ { "recordType": "RightsRecord", "id": "rights_550e8400-e29b-41d4-a716-446655440016", "schemaVersion": 1 } ],
      "consentRefs": [],
      "startedAt": "2026-10-25T12:02:00Z",
      "finishedAt": "2026-10-25T12:03:00Z",
      "failure": null,
      "extensions": {}
    },
    {
      "recordType": "ValidationResult",
      "schemaVersion": 1,
      "id": "val_550e8400-e29b-41d4-a716-446655440007",
      "subjectRef": { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440005", "schemaVersion": 1 },
      "observedArtifactHashes": [ { "artifactId": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } ],
      "validatorId": "lia.validator.synthetic-structure",
      "validatorVersion": "1.0.0",
      "targetRef": null,
      "status": "passed",
      "checks": [
        { "checkId": "lia.check.artifact.reference-shape", "status": "pass", "message": "Synthetic ref shape is valid.", "expected": "one character model", "observed": "one character model", "unit": null, "evidenceRefs": [] }
      ],
      "limitations": [ "No file bytes were opened or verified by this example." ],
      "evaluatedAt": "2026-10-25T12:04:00Z",
      "extensions": {}
    },
    {
      "recordType": "ProjectVisualProfile",
      "schemaVersion": 1,
      "id": "pvp_550e8400-e29b-41d4-a716-446655440002",
      "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
      "scope": { "kind": "project" },
      "versionRefs": [ { "recordType": "ProjectVisualProfileVersion", "id": "pvpv_550e8400-e29b-41d4-a716-446655440010", "schemaVersion": 1 } ],
      "currentApprovedVersionRef": { "recordType": "ProjectVisualProfileVersion", "id": "pvpv_550e8400-e29b-41d4-a716-446655440010", "schemaVersion": 1 },
      "extensions": {}
    },
    {
      "recordType": "ProjectVisualProfileVersion",
      "schemaVersion": 1,
      "id": "pvpv_550e8400-e29b-41d4-a716-446655440010",
      "profileRef": { "recordType": "ProjectVisualProfile", "id": "pvp_550e8400-e29b-41d4-a716-446655440002", "schemaVersion": 1 },
      "parentRefs": [],
      "contentSchemaVersion": 1,
      "traits": {
        "style": {
          "name": { "state": "specified", "value": "Stylized 3D", "origin": { "kind": "manual", "actorId": "human:synthetic-reviewer", "recordedAt": "2026-10-25T12:01:00Z" } },
          "substyle": { "state": "unknown" }
        },
        "palette": {
          "colorSpace": { "state": "specified", "value": "srgb", "origin": { "kind": "manual", "actorId": "human:synthetic-reviewer", "recordedAt": "2026-10-25T12:01:00Z" } },
          "swatches": { "state": "specified", "value": [ { "name": "primary", "colorHex": "#6A8FC6", "semanticRole": "primary" } ], "origin": { "kind": "manual", "actorId": "human:synthetic-reviewer", "recordedAt": "2026-10-25T12:01:00Z" } }
        },
        "form": { "silhouette": { "state": "specified", "value": "compact silhouette", "origin": { "kind": "manual", "actorId": "human:synthetic-reviewer", "recordedAt": "2026-10-25T12:01:00Z" } }, "proportions": { "state": "unknown" } },
        "materials": { "surfaceLanguage": { "state": "unknown" }, "finish": { "state": "not_applicable" } },
        "lighting": { "model": { "state": "unknown" }, "direction": { "state": "unknown" }, "softness": { "state": "unknown" }, "contrast": { "state": "unknown" } },
        "camera": {
          "viewSet": { "state": "specified", "value": [ "front", "side", "back" ], "origin": { "kind": "manual", "actorId": "human:synthetic-reviewer", "recordedAt": "2026-10-25T12:01:00Z" } },
          "projection": { "state": "specified", "value": "orthographic", "origin": { "kind": "manual", "actorId": "human:synthetic-reviewer", "recordedAt": "2026-10-25T12:01:00Z" } },
          "focalLength": { "state": "not_applicable" }
        },
        "scale": {
          "referenceUnit": { "state": "specified", "value": "m", "origin": { "kind": "manual", "actorId": "human:synthetic-reviewer", "recordedAt": "2026-10-25T12:01:00Z" } },
          "referenceHeight": { "state": "specified", "value": { "value": 1.7, "unit": "m" }, "origin": { "kind": "manual", "actorId": "human:synthetic-reviewer", "recordedAt": "2026-10-25T12:01:00Z" } }
        }
      },
      "references": [],
      "contentDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" },
      "createdAt": "2026-10-25T12:01:00Z",
      "createdBy": "human:synthetic-reviewer",
      "extensions": {}
    },
    {
      "recordType": "AssetRelationship",
      "schemaVersion": 1,
      "id": "rel_550e8400-e29b-41d4-a716-446655440008",
      "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
      "subjectRef": { "recordType": "Asset", "id": "ast_550e8400-e29b-41d4-a716-446655440003", "schemaVersion": 1 },
      "objectRef": { "recordType": "Asset", "id": "ast_550e8400-e29b-41d4-a716-446655440019", "schemaVersion": 1 },
      "predicateId": "lia.rel.uses_hair",
      "predicateCatalogVersion": 1,
      "state": "active",
      "supersedesRef": null,
      "evidenceRefs": [],
      "createdAt": "2026-10-25T12:03:00Z",
      "createdBy": "human:synthetic-reviewer",
      "extensions": {}
    },
    {
      "recordType": "HumanReview",
      "schemaVersion": 1,
      "id": "hr_550e8400-e29b-41d4-a716-446655440009",
      "subjectRef": { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440005", "schemaVersion": 1 },
      "subjectDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "1111111111111111111111111111111111111111111111111111111111111111" },
      "observedArtifactHashes": [ { "artifactId": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } ],
      "decision": "approve",
      "reviewerId": "human:synthetic-reviewer",
      "reviewedAt": "2026-10-25T12:05:00Z",
      "reason": "Synthetic review example only.",
      "evidenceRefs": [
        { "kind": "record", "ref": { "recordType": "ValidationResult", "id": "val_550e8400-e29b-41d4-a716-446655440007", "schemaVersion": 1 } },
        { "kind": "record", "ref": { "recordType": "StyleDeviationDecision", "id": "sd_550e8400-e29b-41d4-a716-446655440013", "schemaVersion": 1 } }
      ],
      "supersedesRef": null,
      "extensions": {}
    },
    {
      "recordType": "HumanReview",
      "schemaVersion": 1,
      "id": "hr_550e8400-e29b-41d4-a716-446655440011",
      "subjectRef": { "recordType": "ProjectVisualProfileVersion", "id": "pvpv_550e8400-e29b-41d4-a716-446655440010", "schemaVersion": 1 },
      "subjectDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" },
      "observedArtifactHashes": [],
      "decision": "approve",
      "reviewerId": "human:synthetic-reviewer",
      "reviewedAt": "2026-10-25T12:02:00Z",
      "reason": "Synthetic profile approval example only.",
      "evidenceRefs": [],
      "supersedesRef": null,
      "extensions": {}
    },
    {
      "recordType": "ConsistencyAssessment",
      "schemaVersion": 1,
      "id": "ca_550e8400-e29b-41d4-a716-446655440012",
      "subjectRef": { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440005", "schemaVersion": 1 },
      "profileVersionRef": { "recordType": "ProjectVisualProfileVersion", "id": "pvpv_550e8400-e29b-41d4-a716-446655440010", "schemaVersion": 1 },
      "profileDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" },
      "policy": "Guided",
      "capabilityClaimRefs": [],
      "status": "completed",
      "findings": [ { "traitPath": "form.silhouette", "status": "deviation", "observed": "broader", "expected": "compact silhouette", "unit": null, "evidenceRefs": [], "limitation": "Synthetic description only." } ],
      "observedArtifactHashes": [ { "artifactId": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } ],
      "evaluatorId": "lia.evaluator.synthetic",
      "evaluatorVersion": "1.0.0",
      "createdAt": "2026-10-25T12:04:30Z",
      "supersedesRef": null,
      "extensions": {}
    },
    {
      "recordType": "StyleDeviationDecision",
      "schemaVersion": 1,
      "id": "sd_550e8400-e29b-41d4-a716-446655440013",
      "subjectRef": { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440005", "schemaVersion": 1 },
      "subjectDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "1111111111111111111111111111111111111111111111111111111111111111" },
      "observedArtifactHashes": [ { "artifactId": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } ],
      "profileVersionRef": { "recordType": "ProjectVisualProfileVersion", "id": "pvpv_550e8400-e29b-41d4-a716-446655440010", "schemaVersion": 1 },
      "profileDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" },
      "traitPaths": [ "form.silhouette" ],
      "decision": "accept_deviation",
      "reason": "Synthetic intentional deviation example.",
      "decidedBy": "human:synthetic-reviewer",
      "decidedAt": "2026-10-25T12:05:30Z",
      "evidenceRefs": [ { "kind": "record", "ref": { "recordType": "ConsistencyAssessment", "id": "ca_550e8400-e29b-41d4-a716-446655440012", "schemaVersion": 1 } } ],
      "supersedesRef": null,
      "extensions": {}
    },
    {
      "recordType": "ChangeImpactReport",
      "schemaVersion": 1,
      "id": "cir_550e8400-e29b-41d4-a716-446655440014",
      "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440001", "schemaVersion": 1 },
      "changedRefs": [
        {
          "ref": { "recordType": "ProjectVisualProfileVersion", "id": "pvpv_550e8400-e29b-41d4-a716-446655440010", "schemaVersion": 1 },
          "beforeDigest": null,
          "afterDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }
        }
      ],
      "relationshipCatalogVersion": 1,
      "status": "complete",
      "findings": [ { "findingId": "impact-001", "affectedRef": { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440005", "schemaVersion": 1 }, "pathRefs": [], "reasonPredicateIds": [], "impactClass": "review_only", "severity": "low", "reviewNeed": "recommended", "evidenceRefs": [] } ],
      "unresolvedRefs": [],
      "limitations": [ "Synthetic graph only; no regeneration was run." ],
      "createdAt": "2026-10-25T12:06:00Z",
      "createdBy": "domain:synthetic-analyzer",
      "extensions": {}
    },
    {
      "recordType": "ImpactDecisionEvent",
      "schemaVersion": 1,
      "id": "ide_550e8400-e29b-41d4-a716-446655440015",
      "reportRef": { "recordType": "ChangeImpactReport", "id": "cir_550e8400-e29b-41d4-a716-446655440014", "schemaVersion": 1 },
      "findingRefs": [ { "findingId": "impact-001" } ],
      "decision": "request_review",
      "reason": "Synthetic decision example; no workflow was started.",
      "decidedBy": "human:synthetic-reviewer",
      "decidedAt": "2026-10-25T12:06:30Z",
      "supersedesRef": null,
      "extensions": {}
    },
    {
      "recordType": "RightsRecord",
      "schemaVersion": 1,
      "id": "rights_550e8400-e29b-41d4-a716-446655440016",
      "subject": { "kind": "record", "ref": { "recordType": "Artifact", "id": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "schemaVersion": 1, "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
      "componentLayer": "asset",
      "rightsStatus": "unknown",
      "terms": [],
      "uses": { "internal": "unknown", "modify": "unknown", "store": "unknown", "send_remote": "unknown", "publish": "unknown", "distribute": "unknown", "commercial": "unknown" },
      "evidenceRefs": [],
      "reviewedBy": null,
      "reviewedAt": null,
      "limitations": [ "No rights review was performed in this synthetic example.", "Subject is the imported source asset used as input of prv_...0006, hence componentLayer=\"asset\" (corrigido nesta reconciliação: a redação anterior declarava \"output\" para um input). Outputs/derivados exigem RightsRecord próprio com componentLayer=\"output\" e regra de cadeia por componente (§3.15, §3.17)." ],
      "supersedesRef": null,
      "extensions": {}
    },
    {
      "recordType": "ConsentRecord",
      "schemaVersion": 1,
      "id": "consent_550e8400-e29b-41d4-a716-446655440017",
      "principalId": "human:synthetic-reviewer",
      "decision": "deny",
      "scope": {
        "scopeSchemaVersion": 1,
        "effectId": "synthetic.effect.upload",
        "operationId": "lia.upload.synthetic",
        "purpose": "Example only; no real destination or transfer.",
        "inputArtifactHashes": [ { "artifactId": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } ],
        "dataClasses": [ "synthetic_fixture" ],
        "providerRef": { "recordType": "lia.provider.synthetic", "id": "synthetic-provider", "schemaVersion": 1 },
        "destination": { "kind": "endpoint", "identifier": "https://example.invalid", "region": "unknown" },
        "limits": { "maxBytes": 1024, "maxRuns": 1, "maxCostMinorUnits": 0, "currency": "USD", "overwriteAllowed": false, "retentionPolicyId": "synthetic-example-only" }
      },
      "issuedAt": "2026-10-25T12:07:00Z",
      "expiresAt": null,
      "supersedesRef": null,
      "evidenceRefs": [],
      "extensions": {}
    }
  ]
}
```

### 5.7 Casos suplementares — sem versão aprovada, completeness unknown, desvio rejeitado, revogações (adicionados nesta revisão)

Objetos nomeados abaixo: `projectWithoutProfile`, `projectWithCandidateProfile`, `profileAggregateUnapproved`, `traitProposalProvenance`, `profileVersionCandidate`, `supersededGrant`, `consentRevoke` e `profileApprovalRevocation` são **records completos**; `assetVersionUnknownCompleteness` e `rejectedStyleDeviation` são **fragmentos** dos campos indicados. IDs/hashes/digests sintéticos; nenhuma fixture real, nenhuma execução. Referências a records de outros blocos (§5.5–§5.6) são declaradas nas notas.

```json
{
  "projectWithoutProfile": {
    "recordType": "Project",
    "schemaVersion": 1,
    "id": "prj_550e8400-e29b-41d4-a716-446655440063",
    "displayName": "Synthetic Project Without Profile",
    "createdAt": "2026-10-25T14:00:00Z",
    "updatedAt": "2026-10-25T14:00:00Z",
    "visualProfileRef": null,
    "extensions": {}
  },
  "projectWithCandidateProfile": {
    "recordType": "Project",
    "schemaVersion": 1,
    "id": "prj_550e8400-e29b-41d4-a716-446655440064",
    "displayName": "Synthetic Project With Candidate Profile",
    "createdAt": "2026-10-25T14:00:00Z",
    "updatedAt": "2026-10-25T14:01:00Z",
    "visualProfileRef": { "recordType": "ProjectVisualProfile", "id": "pvp_550e8400-e29b-41d4-a716-446655440065", "schemaVersion": 1 },
    "extensions": {}
  },
  "profileAggregateUnapproved": {
    "recordType": "ProjectVisualProfile",
    "schemaVersion": 1,
    "id": "pvp_550e8400-e29b-41d4-a716-446655440065",
    "projectRef": { "recordType": "Project", "id": "prj_550e8400-e29b-41d4-a716-446655440064", "schemaVersion": 1 },
    "scope": { "kind": "project" },
    "versionRefs": [ { "recordType": "ProjectVisualProfileVersion", "id": "pvpv_550e8400-e29b-41d4-a716-446655440066", "schemaVersion": 1 } ],
    "currentApprovedVersionRef": null,
    "extensions": {}
  },
  "traitProposalProvenance": {
    "recordType": "Provenance",
    "schemaVersion": 1,
    "id": "prv_550e8400-e29b-41d4-a716-446655440071",
    "attemptId": "att_550e8400-e29b-41d4-a716-446655440072",
    "operationId": "lia.profile.trait_propose",
    "outcome": "succeeded",
    "inputRefs": [],
    "outputRefs": [],
    "toolRefs": [],
    "adapterRef": null,
    "providerRef": null,
    "backend": { "state": "not_applicable" },
    "executionContext": { "moduleId": { "state": "reported", "value": "lia.module.forge" }, "capabilityId": { "state": "not_applicable" }, "workflowRunRef": { "state": "not_applicable" }, "stepRef": { "state": "not_applicable" }, "providerExecutionRef": { "state": "not_applicable" } },
    "environment": {"os":{"state":"unknown"},"architecture":{"state":"unknown"},"cpu":{"state":"unknown"},"gpu":{"state":"unknown"},"driver":{"state":"unknown"},"runtime":{"state":"unknown"},"toolVersions":[],"spatialConvention":{"state":"not_applicable"},"timebase":{"state":"not_applicable"}},
    "parameters": { "note": "Synthetic trait proposal; parameters redacted." },
    "rightsRefs": [],
    "consentRefs": [],
    "startedAt": "2026-10-25T15:20:00Z",
    "finishedAt": "2026-10-25T15:20:05Z",
    "failure": null,
    "extensions": {}
  },
  "profileVersionCandidate": {
    "recordType": "ProjectVisualProfileVersion",
    "schemaVersion": 1,
    "id": "pvpv_550e8400-e29b-41d4-a716-446655440066",
    "profileRef": { "recordType": "ProjectVisualProfile", "id": "pvp_550e8400-e29b-41d4-a716-446655440065", "schemaVersion": 1 },
    "parentRefs": [],
    "contentSchemaVersion": 1,
    "traits": {
      "style": {
        "name": { "state": "specified", "value": "Candidate Stylized 3D", "origin": { "kind": "ai_proposal", "provenanceRef": { "recordType": "Provenance", "id": "prv_550e8400-e29b-41d4-a716-446655440071", "schemaVersion": 1 } } },
        "substyle": { "state": "unknown" }
      },
      "palette": { "colorSpace": { "state": "unknown" }, "swatches": { "state": "unknown" } },
      "form": { "silhouette": { "state": "unknown" }, "proportions": { "state": "unknown" } },
      "materials": { "surfaceLanguage": { "state": "unknown" }, "finish": { "state": "unknown" } },
      "lighting": { "model": { "state": "unknown" }, "direction": { "state": "unknown" }, "softness": { "state": "unknown" }, "contrast": { "state": "unknown" } },
      "camera": { "viewSet": { "state": "unknown" }, "projection": { "state": "unknown" }, "focalLength": { "state": "unknown" } },
      "scale": { "referenceUnit": { "state": "unknown" }, "referenceHeight": { "state": "unknown" } }
    },
    "references": [],
    "contentDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "8888888888888888888888888888888888888888888888888888888888888888" },
    "createdAt": "2026-10-25T14:01:00Z",
    "createdBy": "ai:synthetic-proposer",
    "extensions": {}
  },
  "assetVersionUnknownCompleteness": {
    "completionBasis": { "status": "unknown", "policyId": "lia.completion.unregistered-policy", "policyVersion": null, "requirements": [] },
    "completeness": { "state": "unknown", "missingRequirementIds": [], "unknownReasonIds": [ "lia.reason.completion_basis_unknown" ] },
    "note": "Fragmento: somente completionBasis/completeness de uma AssetVersion cujas ArtifactVersions referidas usam assemblyState unknown (slot/role registry não interpretável). unknown não promove (§4.3, regra 2)."
  },
  "rejectedStyleDeviation": {
    "recordType": "StyleDeviationDecision",
    "schemaVersion": 1,
    "id": "sd_550e8400-e29b-41d4-a716-446655440067",
    "subjectRef": { "recordType": "AssetVersion", "id": "asv_550e8400-e29b-41d4-a716-446655440057", "schemaVersion": 1 },
    "subjectDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "1111111111111111111111111111111111111111111111111111111111111111" },
    "observedArtifactHashes": [ { "artifactId": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", "sha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" } ],
    "profileVersionRef": { "recordType": "ProjectVisualProfileVersion", "id": "pvpv_550e8400-e29b-41d4-a716-446655440010", "schemaVersion": 1 },
    "profileDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" },
    "traitPaths": [ "form.silhouette" ],
    "decision": "reject_deviation",
    "reason": "Synthetic rejection of the observed silhouette deviation; baseline must hold.",
    "decidedBy": "human:synthetic-reviewer",
    "decidedAt": "2026-10-25T14:05:00Z",
    "evidenceRefs": [],
    "supersedesRef": null,
    "extensions": {}
  },
  "supersededGrant": {
    "recordType": "ConsentRecord",
    "schemaVersion": 1,
    "id": "consent_550e8400-e29b-41d4-a716-446655440069",
    "principalId": "human:synthetic-reviewer",
    "decision": "grant",
    "scope": {
      "scopeSchemaVersion": 1,
      "effectId": "synthetic.effect.upload",
      "operationId": "lia.upload.synthetic",
      "purpose": "Example only; no real destination or transfer.",
      "inputArtifactHashes": [ { "artifactId": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } ],
      "dataClasses": [ "synthetic_fixture" ],
      "providerRef": { "recordType": "lia.provider.synthetic", "id": "synthetic-provider", "schemaVersion": 1 },
      "destination": { "kind": "endpoint", "identifier": "https://example.invalid", "region": "unknown" },
      "limits": { "maxBytes": 1024, "maxRuns": 1, "maxCostMinorUnits": 0, "currency": "USD", "overwriteAllowed": false, "retentionPolicyId": "synthetic-example-only" }
    },
    "issuedAt": "2026-10-25T14:00:00Z",
    "expiresAt": null,
    "supersedesRef": null,
    "evidenceRefs": [],
    "extensions": {}
  },
  "consentRevoke": {
    "recordType": "ConsentRecord",
    "schemaVersion": 1,
    "id": "consent_550e8400-e29b-41d4-a716-446655440068",
    "principalId": "human:synthetic-reviewer",
    "decision": "revoke",
    "scope": {
      "scopeSchemaVersion": 1,
      "effectId": "synthetic.effect.upload",
      "operationId": "lia.upload.synthetic",
      "purpose": "Example only; no real destination or transfer.",
      "inputArtifactHashes": [ { "artifactId": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } ],
      "dataClasses": [ "synthetic_fixture" ],
      "providerRef": { "recordType": "lia.provider.synthetic", "id": "synthetic-provider", "schemaVersion": 1 },
      "destination": { "kind": "endpoint", "identifier": "https://example.invalid", "region": "unknown" },
      "limits": { "maxBytes": 1024, "maxRuns": 1, "maxCostMinorUnits": 0, "currency": "USD", "overwriteAllowed": false, "retentionPolicyId": "synthetic-example-only" }
    },
    "issuedAt": "2026-10-25T14:10:00Z",
    "expiresAt": null,
    "supersedesRef": { "recordType": "ConsentRecord", "id": "consent_550e8400-e29b-41d4-a716-446655440069", "schemaVersion": 1 },
    "evidenceRefs": [],
    "extensions": {}
  },
  "profileApprovalRevocation": {
    "recordType": "HumanReview",
    "schemaVersion": 1,
    "id": "hr_550e8400-e29b-41d4-a716-446655440070",
    "subjectRef": { "recordType": "ProjectVisualProfileVersion", "id": "pvpv_550e8400-e29b-41d4-a716-446655440010", "schemaVersion": 1 },
    "subjectDigest": { "algorithm": "sha-256", "canonicalizationId": "pending-human-choice", "value": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" },
    "observedArtifactHashes": [],
    "decision": "revoke",
    "reviewerId": "human:synthetic-reviewer",
    "reviewedAt": "2026-10-25T14:20:00Z",
    "reason": "Synthetic revocation of the previous approval; pointer must be cleared by transaction (§4.5).",
    "evidenceRefs": [],
    "supersedesRef": { "recordType": "HumanReview", "id": "hr_550e8400-e29b-41d4-a716-446655440011", "schemaVersion": 1 },
    "extensions": {}
  }
}
```

Notas de coerência: (a) `profileVersionCandidate` usa `origin.kind="ai_proposal"` apontando para `traitProposalProvenance` (`prv_...0071`, `outcome="succeeded"` com `outputRefs=[]` — permitido porque o propósito declarado da operação não inclui entregas, §3.6 tabela de outcomes), o que satisfaz a regra de grafo de `TraitOrigin.ai_proposal` (§3.8). `operationId="lia.profile.trait_propose"` é valor sintético ilustrativo e **não** é entrada de registry aprovada (§2.1: namespaced desconhecido é preservado com diagnóstico). **Correção desta reconciliação:** a redação anterior apontava para a `Provenance` `failed` da §5.5 (`prv_...0050`), o que violaria aquela regra num grafo real. Proposta de IA não aprova profile nem preenche `currentApprovedVersionRef` (§3.8); (b) nenhum `HumanReview=approve` existe para `pvpv_...0066`, portanto o aggregate permanece com ponteiro `null` e avaliações `Guided/Locked` não podem usá-lo como baseline (§3.11); (c) `rejectedStyleDeviation` retoma sujeito/digest/hashes do exemplo da §5.5 e profile da §5.6 — como fragmento ilustrativo, suas refs são declaradas, não resolvidas neste bloco; (d) `consentRevoke` tem escopo idêntico ao `supersededGrant` (regra da §3.16); (e) `profileApprovalRevocation` ilustra o valor `revoke` **recomendado e pendente de aprovação** (§3.10/§4.5); se a alternativa `reject` superseding for a escolhida, este exemplo deve ser reescrito antes de qualquer fixture.

## 6. Perfil visual v1, origin e hash

### 6.1 Conteúdo e semântica

O profile é global e sem herança. Cada versão registra separadamente `style.name/substyle`, `palette.colorSpace/swatches`, `form.silhouette/proportions`, `materials.surfaceLanguage/finish`, `lighting`, `camera.viewSet/projection/focalLength` e `scale.referenceUnit/referenceHeight`. Cada trait deve ser `specified`, `unknown` ou `not_applicable`; ausência de campo não equivale a qualquer um desses estados.

O aggregate é **único e compartilhado por todos os assets do Project** em v1 (decisão aprovada — ADR-001 Decisão 3 e proposta §6.1): não existe profile por asset, por tipo, por coleção nem por destino de consumo, e não há herança entre profiles. Escopos adicionais são evolução futura da estrutura e não entram em v1. Um asset consumido por vários destinos (§8.1) continua referindo o **mesmo** profile do seu Project; destino não altera identidade visual nem cria baseline alternativo. Project legado sem profile permanece `null`/`not_selected` — nada é inferido de prompt, nome ou ausência (§3.11).

`Free`, `Guided` e `Locked` são policy da avaliação/versão da tarefa, não um valor inferido do profile. Proposta: `Guided/Locked` exigem `ProjectVisualProfileVersion` já aprovada (ponteiro vigente no aggregate, §4.5) e `traitPaths` explícitos não vazios; `Free` pode não referenciar Profile. Para `Locked`, cada trait lockado precisa de validator/capability claim versionado, escopado e evidenciado; sem claim resulta `unknown`/`blocked`, nunca aprovação implícita. Assessment, StyleDeviationDecision e HumanReview continuam records diferentes, com as semânticas fechadas em §3.11 e §3.12.

**Nenhum modo promete consistência.** `Locked` expressa uma restrição e exige evidência de capacidade por trait, mas claim de capability não prova qualidade nem resultado: consistência só é afirmada por `ConsistencyAssessment` com findings, evidência e `limitations` explícitos e, quando o fluxo exigir, por `HumanReview`. Validação técnica (`ValidationResult`), avaliação de consistência (`ConsistencyAssessment`) e aprovação humana (`HumanReview`) são **três atos distintos, com records distintos**; nenhum substitui, implica ou dispensa os outros (§3.7, §3.10, §3.11, §9.3 invariante 13). Ausência de profile aprovado não vira `Free` automaticamente, e `not_selected` não significa `Free` (§3.11).

### 6.2 Origens e uso de referências

- `manual`: actor e timestamp; confiança não é automaticamente superior em conteúdo, mas é autoria explícita.
- `imported_reference`: Artifact/hash exato, purpose, `RightsRecord` e `HumanReview` para usar a referência como baseline. Somente anexar uma imagem não significa autorização nem approval.
- `ai_proposal`: Provenance de geração/transformação, ferramentas/inputs e parâmetros redigidos. É somente proposta até uma pessoa aprovar a ProfileVersion.
- Cada referência preserva hash, finalidade (paleta/silhueta/materiais/câmera/etc.), direitos aplicáveis e review. Se rights ou origem são desconhecidos, manter `unknown`/`review_required`; nenhuma liberação comercial inferida.

### 6.3 Canonicalização e hashing — alternativas sem aprovação silenciosa

Campo `contentDigest` é necessário para binding exato, mas o algoritmo/protocolo não está aprovado. `lia-json-canonical-v1` permanece recomendação histórica, não padrão escolhido. Alternativas:

| Alternativa | Vantagens | Riscos/decisões |
|---|---|---|
| RFC 8785 JSON Canonicalization Scheme (JCS) | Padrão publicado e interoperável para canonicalizar JSON/I-JSON antes de SHA-256. | Requer implementação compatível; não normaliza Unicode semanticamente; regras de number/keys e subset I-JSON precisam de fixtures cross-runtime. |
| `lia-json-canonical-v1` | Pode especificar precisamente a estrutura Lia e versionar regras próprias. | Custom; custo de manutenção/interoperabilidade; precisa publicar grammar, normalização, ordering, números, escapes e fixtures aprovadas. Não está aprovado. |
| CBOR deterministic encoding (RFC 8949) | Bytes determinísticos em encoding binário bem especificado. | Exige mapeamento JSON→CBOR, regra para tipos, strings/decimal e ecossistema; consumidor precisa concordar no modelo de dados. |
| Hash de bytes JSON serializados originais | Simples de computar no produtor. | Whitespace/ordem/serializer mudam hash sem mudar semântica; ruim para profile e reviews concorrentes; não recomendada. |

**Proposta provisória para decisão:** avaliar RFC 8785/JCS como primeira opção interoperável, mas não adotá-la sem review e fixtures aprovadas. Até então, cada `canonicalizationId` é opaco; nenhuma implementação deve usar `JSON.stringify`, JCS ou `lia-json-canonical-v1` por conveniência.

O hash de profile (`contentDigest` da `ProjectVisualProfileVersion` independente) cobre o payload canônico da versão sem o ponteiro do aggregate (`currentApprovedVersionRef`), sem reviews, path físico ou mutable pointers; inclui `contentSchemaVersion`, traits e values/origins, `references` com hashes, `parentRefs` e extension payloads semânticos. Exato payload/ordem precisa ser fixado junto ao algoritmo. SHA-256 dos bytes de cada Artifact é outro hash independente; não o confundir com semantic/profile digest. O `membersDigest` de `ArtifactVersion` (§3.5) é um terceiro hash independente, sobre o conjunto de membros.

## 7. Relações, predicados, ciclos e Change Impact

### 7.1 Proposta de registry v1

`AssetRelationship` preserva endpoints ordenados. `predicateId + predicateCatalogVersion` define nomes, tipos permitidos, semântica direcional, regra de ciclo e direção de impacto. O catálogo abaixo é uma proposta inicial e cada predicate requer aprovação; não congelar nomes ou semântica por inferência.

| Predicate sugerido | Subject → object (tipos) | Ciclos | Direção de impacto sugerida |
|---|---|---|---|
| `lia.rel.derived_from` | derived `AssetVersion|ArtifactVersion` → source `AssetVersion|ArtifactVersion|Artifact` | DAG acíclico obrigatório | mudança na fonte (object) impacta subject derivado. |
| `lia.rel.variant_of` | variant `Asset|AssetVersion` → base do mesmo tipo | DAG acíclico obrigatório | mudança na base (object) marca variant para review. |
| `lia.rel.uses_hair` | character `Asset|AssetVersion` → hair `Asset|AssetVersion` | ciclos permitidos; cycle é warning | mudança em hair impacta/revisa personagem. |
| `lia.rel.uses_rig` | consumer `Asset|AssetVersion` → rig `Asset|AssetVersion` | ciclos permitidos; validator reporta ambiguidade | mudança em rig impacta consumers relacionados. |
| `lia.rel.uses_motion` | character/spritesheet `Asset|AssetVersion` → clip `Asset|AssetVersion` | ciclos permitidos | mudança no clip impacta deliverable relacionado. |
| `lia.rel.animates` | clip `Asset|AssetVersion` → character/rig alvo `Asset|AssetVersion` | ciclos permitidos | mudança no clip impacta alvo; alvo não reescreve clip. |
| `lia.rel.contains` | container `Asset|AssetVersion|ArtifactVersion` → componente `Asset|AssetVersion|Artifact` | DAG acíclico obrigatório | mudança no componente pode impactar/revisar container. |
| `lia.rel.uses_reference` | `Asset|AssetVersion|ProjectVisualProfileVersion` → `Artifact` de referência | sem ciclo de Asset graph | alteração/reference hash novo gera finding review-only. |

Predicates `uses_*` são associations/declarações, não prova de attachment, skinning, rig compatibility ou resultado técnico. Distinguir `uses_motion` de `animates` é necessário para orientar traversal; usuário deve aprovar se ambos são necessários. **Reconciliação com a proposta §7.1:** a proposta lista também `wears`, `uses_material`, `uses_palette` e `depends_on` como exemplos de catálogo; esta registry v1 deliberadamente não os inclui ainda — são candidatos adiados (não removidos), e cada um exigirá definição de direção/tipos/ciclo aprovada antes de entrar.

### 7.2 Ciclos e unknowns

- Version lineage (`AssetVersion.parentRefs`, `ArtifactVersion.parentRefs`, `ProjectVisualProfileVersion.parentRefs`) sempre acíclico, independentemente dos predicates.
- Predicate declarado `acyclic` valida o subgrafo composto por relações ativas desse predicate; cycle retorna erro e path witness reproduzível.
- Predicate desconhecido não rejeita a persistência sintática se record envelope é válido, mas emite warning, não traversa e faz ChangeImpact `partial` se era relevante.
- Relação `archived` não participa do grafo ativo; archiving gera novo record linked por `supersedesRef`, conforme proposta. Conflitos de cadeia devem bloquear o projection graph.
- Findings de ChangeImpact só expandem arestas explícitas e predicates/catalog version conhecidos. Um caminho incerto recebe `impactClass:"unknown"` e `limitations`; não se assume ausência de impacto.

### 7.3 Uso do Change Impact

`ChangeImpactReport` é diagnóstico puro a partir de graph snapshot fornecido: entradas alteradas (IDs/hash antigo/novo), relações resolvidas, paths e possíveis dependentes. Ele não faz task scheduling, não cria `WorkflowPlan`, não chama provider nem regenera Asset. `ImpactDecisionEvent` guarda decisão humana sobre um report/finding; um futuro Workflow Engine teria outro gate/grant, executor, provenance, cancelamento e reconciliação.

## 8. Limites Domain / Store / Workflow

| Responsabilidade | Domain | Store futuro | Workflow futuro |
|---|---|---|---|
| Shape, campos obrigatórios, tipos, enums e invariantes locais | **Sim:** validadores puros/determinísticos. | Não decide semântica. | Chama validators. |
| Referências, ownership e DAG no input recebido | **Sim:** `validateGraph(records)` sobre memória recebida. | Obtém records sob seu mecanismo; sem leitura implícita via Domain. | Fornece snapshot ao Domain. |
| ID generation, filesystem, arquivo/hash real, paths | **Não.** | Gera IDs externos, lê/escreve atomicamente, verifica bytes/size, containment e quota. | Solicita efeitos autorizados e associa resultados. |
| `Artifact.sha256` | Checa formato e igualdade entre ID/campo/ref. | Calcula/verifica sobre bytes. | Carrega evidência de output. |
| `HumanReview` | Valida estrutura e binding declarado. | Persiste append-only e revalida binding/CAS. | Pausa para revisão humana; não fabrica aprovação. |
| Promoção de `Asset.currentVersionRef` | **Não muta.** Pode validar um grafo candidato completo. | CAS/transação, persistência/atomicidade, hash recheck e rollback. | Pode pedir ao Store após todos os gates; não escolhe versão automaticamente. |
| Rights/consent | Valida estrutura/scope e estados declarados. | Persiste evidências/records e protege segredos/paths. | Gate antes de upload/download/execução/cobrança/overwrite; sem grant, fail closed. |
| Providers, Blender, rede, Electron, run/retry/cancel | **Proibido.** | Adaptadores/boundary físico, futuro e não autorizado agora. | Orquestra só em pacote futuro autorizado. |
| Impact report | Calcula traversal em grafo explicitamente fornecido. | Fornece snapshot. | Usa report para apresentar decisão; nunca auto-regenera. |
| Atualização/revogação de `currentApprovedVersionRef` (§4.5) | **Não muta.** Valida grafo candidato, reciprocidade aggregate↔versão e binding declarado de review. | CAS/transação, recheck de approve vigente/revogado e rollback por nova transação. | Pode solicitar ao Store após gates; nunca escolhe versão. |
| `Provenance.executionContext` | Valida forma `Reported`/`OpaqueRef`; preserva sem traversar tipos não reconhecidos. | Persiste records. | Produtores futuros preenchem refs quando `WorkflowRun`/`StepRun`/`ProviderExecution` existirem como contracts. |
| Gates de rights/consent por atividade (§3.17) | Valida records e coerência estado↔uses; não decide atividades. | Persiste/aplica gates locais com relógio próprio quando autorizado. | Consulta rights+consent antes de cada efeito; fail-closed. |

Os primeiros testes de Domain devem rodar offline e operar somente sobre objetos JSON em memória. Não criar nesse pacote adapters, Store, `WorkflowRun`, UI, migração, compatibilidade de formato, nem executar Blender/provider.

### 8.1 Destinos de consumo (Game Asset, Lia Desktop Asset) — adicionado nesta reconciliação

**Requisito representado (proposta §4.3):** existe **um único** sistema de identidade e versionamento de assets; um mesmo asset pode ser consumido por jogos, pelo Lia Desktop e por outros destinos. `Game Asset` e `Lia Desktop Asset` **não são tipos de domínio distintos**, não geram records próprios, não criam uma segunda identidade nem uma segunda origem. Destino é **declaração de consumo/exportação** e conjunto de **requisitos de compatibilidade** — nunca um sistema de geração separado e nunca um módulo do Domain.

Representação em v1, sem novo record de topo (o pacote permanece com 17 tipos, §10.1):

| Necessidade | Onde vive em v1 | Regra |
|---|---|---|
| Declarar para qual destino uma entrega se destina | `ArtifactVersion.extensions`, extensão namespaced de entrega (shape **proposto e pendente** de aprovação com §11, item 12) | Destino é propriedade da **entrega**, não da identidade: o mesmo `Asset`/`AssetVersion` pode ter entregas para destinos diferentes. Nenhum campo core novo. |
| Múltiplos destinos para o mesmo asset | (a) uma `ArtifactVersion` declarando vários destinos quando os mesmos bytes servem a todos, ou (b) `ArtifactVersion` distintas por destino, ligadas por `parentRefs` (mesmo slot) ou `AssetRelationship` (`variant_of`/`derived_from`) | Bytes diferentes ⇒ `Artifact` diferente (content-addressed, §3.4). Identidade, `Provenance` e `HumanReview` **não** são duplicados por destino. |
| Evidência de compatibilidade com um destino | `ValidationResult` com `targetRef` apontando o target de compatibilidade do destino e `checks` específicos (dimensões, formato, canais, limites de tamanho, requisitos de runtime) | `passed` em checks de compatibilidade **não** é aprovação de qualidade nem autorização de publicação; `HumanReview` continua sendo o único ato de aprovação (§3.10). |
| Requisitos de exportação/conversão | Fora do Domain: pertencem ao futuro módulo de compatibilidade/exportação (§10.2) | O Domain não declara nem valida conversão para formato de destino; registra apenas o que foi declarado e medido. |
| Destinos padrão no nível do projeto (`targets`/`engine` da proposta §5.2) | **Fora do pacote v1** — divergência registrada em §13.4 | Não existe campo `targets`/`engine` em `Project` (§3.1). Se destinos padrão por projeto forem exigidos, é decisão futura com campo novo explícito; nada é inferido enquanto não decidido. |

**Distinção terminológica obrigatória (evita colisão entre documentos):** *destino de consumo* = para quem/para que o asset é entregue (jogo, Lia Desktop, outro consumidor), tratado nesta subseção; *destino físico de persistência* = onde bytes/records são guardados (`.spriteforge/`, sidecar, banco), tratado em §10.2 e §13.4 como assunto do futuro Store. Os dois conceitos não se substituem e não compartilham campos.

Nenhuma integração com Lia Desktop foi realizada, testada ou homologada por esta especificação; destinos são consumidores declarados, não capacidades implementadas.

### 8.2 Formatos, ferramentas e fluxos 2D/2.5D — adicionado nesta reconciliação

**Formato é capacidade declarada, não dependência de software.** `Artifact.formatId` é uma string namespaced (ou o literal reservado `unknown`) e `mediaType` é o MIME declarado; nenhum dos dois prova semântica, direitos, compatibilidade ou que exista ferramenta capaz de produzir/ler o formato (§3.4). PSD em camadas, formatos de rig 2.5D, Live2D, atlas 2D, GLB, PNG e qualquer outro formato são **representáveis pelo mesmo mecanismo** — registry versionado de slots/roles + `formatId` + `extensions` — sem que o Domain dependa de um software específico e sem que a presença de um formato implique provider instalado, homologado ou licenciado.

**Estado da cobertura 2D/2.5D neste pacote (explícito, para não sugerir cobertura inexistente):**

- O registry v1 proposto (§5) contém 4 slots orientados a 3D/spritesheet (`lia.slot.character.model`, `lia.slot.hair.geometry`, `lia.slot.motion.clip`, `lia.slot.spritesheet.atlas`) e `formatId` de exemplo `lia.format.glb`.
- Slots, roles e `formatId` para fluxos 2D e 2.5D (imagem 2D fonte, PSD em camadas, máscaras por camada, rig 2.5D/runtime, atlas 2D, expressões/visemes) **não estão propostos neste pacote**. Seus IDs seguiriam o mesmo padrão namespaced (`lia.slot.<família>.<papel>`, `lia.role.<família>.<papel>`, `lia.format.<formato>`) e são **decisão pendente** (§11, item 5) — não são inventados aqui.
- O requisito é justificado e está documentado fora desta spec: proposta §4.3/§8.4/§9.4 (rota Imagem 2D → PSD → revisão → rig 2.5D → animação → exportação), `ASSET-PIPELINES.md` e `TOOL-PROVIDER-HUB.md` (estado `PLANNED`/`BLOCKED`, providers substituíveis) e `EXTERNAL-REPOSITORY-RESEARCH.md` (candidatos em avaliação, sem código copiado). Nenhum desses documentos é evidência de capacidade implementada, e esta spec não promove nada disso a suportado.
- Consequência prática até a decisão: um produtor que use slot/formato não registrado tem seus valores **preservados com diagnóstico** (§2.1), com `assemblyState="unknown"` e `completeness.state="unknown"` quando a semântica de slot/role não é interpretável (§3.3, §3.5) — nunca convertidos em valores conhecidos nem tratados como `complete`.

**Rastreabilidade do fluxo 2.5D com os contratos existentes** (mapeamento, sem novo record):

| Elemento do fluxo | Representação v1 |
|---|---|
| Fonte 2D original (imagem/PSD) | `Artifact` (bytes/hash) como member de `ArtifactVersion` com role de fonte; originais nunca são sobrescritos (§3.4, §3.5 regra 1). |
| Máscaras por camada | `Artifact` próprios, members com roles próprias e `memberLinks` ligando máscara ↔ camada (§3.5 regra 7 é o padrão já usado para PNG ↔ manifesto). |
| Áreas ocultas reconstruídas/preenchidas | Conteúdo **gerado/inferido**, nunca fonte original: `Provenance` com `operationId` próprio (registry), `inputRefs` = fonte, `outputRefs` = entrega reconstruída, `parameters` redigidos; direitos do resultado como `componentLayer="output"` (§3.15); aprovação das camadas reconstruídas por `HumanReview` (§3.10). Apresentar reconstrução como original é violação de proveniência. |
| Ajustes manuais | `Provenance` com `operationId` de edição manual, `toolRefs=[]` ou ferramenta declarada, `adapterRef`/`providerRef` `null`, `environment.toolVersions` conforme observado; nova `AssetVersion`/`ArtifactVersion` ligada por `parentRefs` à anterior (§3.3, §4.4). |
| Rig 2.5D e animações | `ArtifactVersion` em slots próprios (IDs pendentes, acima) + `AssetRelationship` (`uses_rig`, `animates`/`uses_motion`, §7.1). A relação **não** prova visualmente que o rig/deformação está correto. |
| Versões e iterações | `AssetVersion`/`ArtifactVersion` imutáveis com `parentRefs`; retries com novo `attemptId`/`deliveryId` (§3.5, §3.6, §4.1). |
| Proveniência de cada etapa | Um `Provenance` por tentativa, com reciprocidade obrigatória de outputs (§3.6 regras 1–6) e `executionContext` apontando futuros contracts de execução sem implementá-los. |

Nada nesta subseção declara rigging profissional garantido, compatibilidade verificada com arquivos/formatos reais, nem escolha de provider/renderer/backend.

### 8.3 Mapeamento dos contratos especializados da proposta (requisitos de `HairAsset`) — adicionado nesta reconciliação

A matriz §13.4 afirma que `HairAsset`, `RiggedCharacter`, `MotionClip`, `SpriteSheetOutput` e `StylePolicySnapshot` estão cobertos em v1 por slots/extensions/relationships/`styleContext`. Esta subseção **demonstra** a alegação requisito por requisito (proposta §5.2 e §10.1) e declara o que ainda não está coberto:

| Requisito da proposta | Representação em v1 | Estado |
|---|---|---|
| `ArtifactVersion` de geometria de cabelo | slot `lia.slot.hair.geometry` + roles/cardinalidades do registry (§5) | **Coberto** (IDs pendentes de aprovação, §11 item 5) |
| Referência de cabeça/rig | `AssetRelationship` (`uses_rig`, `uses_hair`) com predicate/direção do registry (§7.1) | **Coberto** |
| Eixos, unidades, escala | `Provenance.environment.spatialConvention` + traits de profile `scale.referenceUnit`/`scale.referenceHeight` (§3.6, §3.8) | **Coberto** |
| Gerador, seed, provenance | `Provenance` (`toolRefs`, `operationId`, `attemptId`, `parameters` redigidos — a seed entra em `parameters` quando não for segredo) | **Coberto** |
| Representação (cards/mesh/curves/etc.) | Estado por propriedade em extensão namespaced de **`AssetVersion`** (§5.2); sem campo core | **Mecanismo coberto; shape pendente** (§11 item 12) |
| Materiais/cores/UVs | Idem (estado por propriedade) + `Artifact.contentMetadata`/members; nenhum claim de material válido | **Mecanismo coberto; shape pendente** |
| Proxies | Member com role própria na entrega (role ID do registry) | **Mecanismo coberto; role ID pendente** |
| Skinning/weights, springs/colliders | Estado por propriedade na extensão; validação real de pesos/física é validator externo (§10.2) | **Mecanismo coberto; shape pendente** |
| Vocabulário de estado por propriedade | Proposto: `present \| absent \| unknown \| not_applicable`. O exemplo da proposta §5.3 usa também `partial`, que **não** pertence ao vocabulário proposto | **Divergência registrada** (§13.4; recomendação R18) — não resolvida por default |
| `RiggedCharacter`, `MotionClip`, `SpriteSheetOutput` | Assinatura de skeleton/hierarquia/bind pose, timebase/frame range/canais, layout/grade/pivôs/câmeras: `Provenance.environment.timebase`, members/roles/`memberLinks` do slot, `ValidationResult` de estrutura e extensões namespaced | **Mecanismo coberto; shapes pendentes** (§11 item 12); validadores reais fora do pacote (§10.2) |
| `StylePolicySnapshot` | `AssetVersion.styleContext` (modo + refs de profile/versão + digest + trait paths) | **Coberto** (equivalência já registrada na nota de reconciliação da proposta) |

Conclusão: nenhum requisito da proposta fica sem lugar **estrutural** em v1; o que permanece em aberto é o *shape* das extensões e os IDs de registry, que são decisões pendentes (§11, itens 5 e 12) — não lacunas silenciosas.

## 9. Fixtures sintéticas, positivos/negativos e invariantes

Nenhum fixture de código é criado agora. Quando pacote for autorizado, criar fixtures JSON sintéticas e versionadas ao lado dos testes isolados; não usar arquivos/projetos reais como se fossem fixtures representativas. Não alegar compatibilidade com `.spriteforge/`, `.lia.json`, `metadata.json`, plugin ZIP ou formatos reais sem fixtures de origem licenciada, representativa e explicitamente revisada. `.spriteforge/` e outros formatos reais continuam read-only/futuros.

### 9.1 Positivos mínimos

1. Project sem profile e com profile global; profile v1 approved (com ponteiro vigente) e profile candidate não aprovado com `currentApprovedVersionRef=null` (§5.7).
2. Asset sem versão; AssetVersion raiz com completion basis conhecido; basis desconhecido não superestimado como complete (fragmento `unknown` em §5.7); iteração com um parent; merge com dois pais (`mergeCandidate` em §5.5); duas branches irmãs.
3. Artifact content-addressed com ID/hash coerente; ArtifactVersion character, hair, motion e spritesheet conforme §5, cada uma com `membersDigest` declarado; `AssetVersion` de cabelo portando a extensão de estado por propriedade (§5.2), com valores derivados do que a entrega declara.
4. Spritesheet PNG + manifesto ligados; bundle parcial com manifesto faltante e bundle cujo slot/role registry é desconhecido; completeness explícita (`complete`, `incomplete`, `unknown`).
5. Provenance manual/import, succeeded, partial, failed sem output, blocked sem output e cancelled com/sem output; reciprocidade Provenance↔ArtifactVersion nos dois sentidos; `executionContext` not_applicable/unknown/reported; `environment.toolVersions` com ferramenta declarada e `[]` em operação manual (§3.6); `succeeded` com `outputRefs=[]` quando o propósito declarado não inclui entregas (`traitProposalProvenance`, §5.7).
6. HumanReview approve/reject/iterate do subject/digest/hash exatos, com `reviewBasis` e `limitations` explícitos (§3.10); revoke (se aprovado) superseding do approve exato; StyleDeviationDecision accept e reject separadas (§5.6–§5.7).
7. Relationship conhecida e acíclica, relationship desconhecida preservada; ChangeImpact complete e partial com `severity`/`reviewNeed` explícitos, sem side effect.
8. RightsRecord `unknown`, `review_required`, `allowed`, `restricted` e `blocked` escopados por componente/uso, coerentes com a tabela da §3.15 e com as sete chaves de `uses`; Consent grant/deny/revoke com scope/expiração, revoke com escopo idêntico ao grant.
9. ValidationResult `not_run`, `passed`, `warning`, `failed`, `blocked`, `unknown` e `not_applicable`, com limitation e hashes observados explícitos; casos de agregação calculada coincidente com o `status` gravado (§3.7); dois `ValidationResult` para o mesmo sujeito com `status` diferentes, ambos preservados e reportados, sem seleção feita pelo Domain (§3.7, precedência pendente).
10. ConsistencyAssessment `running` com findings vazios e seu sucessor terminal por `supersedesRef`; `completed` em Locked com cobertura de trait paths; `limitations` não vazio nos casos exigidos (§3.11); `policy` concordando com o `styleContext` do sujeito, inclusive `styleContext=null` ⇒ `not_selected`; ponteiro de profile promovido e revogado por CAS (§4.5) em cenários documentais.
11. Destino de consumo declarado em extensão de `ArtifactVersion` com evidência de compatibilidade em `ValidationResult.targetRef`, **sem** record/tipo próprio por destino e sem duplicar identidade ou origem (§8.1); o mesmo `Asset`/`AssetVersion` com duas entregas para destinos diferentes.
12. Slot/formato 2D ou 2.5D não registrado: valores preservados com diagnóstico, `assemblyState="unknown"` e `completeness.state="unknown"`, nunca convertidos em conhecidos nem tratados como `complete` (§8.2).

### 9.2 Negativos obrigatórios

- `recordType` incompatível com schema; `schemaVersion` inválido; ID malformado/duplicado; hash malformado ou `Artifact.id` diferente do `sha256`.
- `Asset.currentVersionRef` dangling, de outro Asset/Project, incompleto, sem review approve, review de outro snapshot/hash ou com review conflitante.
- AssetVersion parent de outro Asset, cycle, self-parent ou parent reference com schema incorreto.
- ArtifactVersion misturando Project/Asset/slot/delivery; member duplicado/role desconhecida marcada complete; cardinality quebrada; `assemblyState` contradiz roles; link para `memberKey` ausente; `memberLinks` com keys inexistentes; `membersDigest` ausente/malformado ou com `canonicalizationId` vazio; `deliveryId` reutilizado por dois `ArtifactVersion` (`delivery_id_reused`) ou cujo `assetRef`/`slotId` difere do declarado (§2.3, §3.5 regra 2).
- Extensão de estado por propriedade (ex.: `lia.hair.state.v1`) portada por record **mutável** (`Asset`) ou por `ArtifactVersion` de um único slot quando o estado pertence à revisão do asset: o dono é `AssetVersion` (§5.2, §2.4, §8.3).
- `AssetVersion.completeness=complete` com `completionBasis.status=unknown`, requisito não atendido, ou ArtifactVersion vazio; falha sem output não pode ser representada por versão vazia; `completeness=unknown` com `missingRequirementIds` não vazio ou sem `unknownReasonIds`.
- Provenance failed/blocked sem `failure`; failed/blocked com `outputRefs` não vazio; partial com `outputRefs` vazio; succeeded com `failure` presente; Provenance/output não recíprocos em qualquer direção; mesmo `ArtifactVersion` listado por duas Provenance diferentes; `AssetVersion.provenanceRefs` sem a Provenance de alguma `ArtifactVersion` referida; output de outro delivery sem explicação; item de `environment.toolVersions` sem `toolId` namespaced; campo core nomeado a partir de ferramenta/software específico (§3.6, §8.2).
- Project/Profile cross-reference inconsistente; segundo profile global ativo no mesmo Project; `versionRefs` duplicado ou versão sem `profileRef` recíproco; `currentApprovedVersionRef` fora de `versionRefs`, sem review approve exata vigente ou mantido após revoke; atualização de ponteiro sem `expectedCurrentApprovedVersionRef` (CAS); profile sem trait `unknown` explícito onde o estado é desconhecido; `TraitOrigin.ai_proposal` apontando para `Provenance` com `outcome` `failed`/`blocked`/`cancelled`/`unknown` (`trait_origin_provenance_inconsistent`, §3.8); `imported_reference` cujo `artifactRef`/`sha256` não resolve no grafo recebido.
- HumanReview sem reviewer humano, subject digest/hash diferente, decisão IA tentando aprovar, hash set incompleto, `supersedesRef` cross-subject ou ciclo de supersession; `revoke` (se aprovado) sem `supersedesRef` ao approve exato do mesmo subject+digest; **dois `approve` para o mesmo subject+digest sem cadeia `supersedesRef`** (duplicatas também são decisões concorrentes ⇒ `review_conflict`, §3.10); `reviewBasis` ou `limitations` ausentes (§3.10).
- Relationship cycle em predicate acíclico; endpoint cujo Project derivável difere do `projectRef` declarado (`relationship_project_mismatch`, §3.9); endpoint `ArtifactRef` sem `ArtifactVersion` que o liste como member no mesmo Project (`relationship_endpoint_ownership_unresolved` — warning, aresta não atravessada); ChangeImpact atravessando predicate desconhecido; report com status complete apesar de unresolved refs; finding sem `severity`/`reviewNeed` explícitos; `affectedRef`/`changedRefs[].ref`/`unresolvedRefs` fora das uniões explícitas de §3.13.
- StyleDeviationDecision usada para promover AssetVersion/alterar profile/liberar direitos; decisão aplicada com profile/digest/hashes diferentes do assessment avaliado; `profileVersionRef` nulo com `profileDigest` não nulo, ou o inverso (`deviation_baseline_incomplete`, §3.12); duas decisões concorrentes sem cadeia de supersessão tratadas como ambas vigentes; rights de wrapper herdados por pesos/outputs; gate lendo `rightsStatus` geral no lugar da chave `uses` da atividade; `uses` com chave ausente; `rightsStatus`/`uses` incoerentes com a tabela da §3.15 — incluindo **`restricted` com todas as chaves em `allowed`**; `subject.kind="record"` apontando para agregado mutável (`Project`, `Asset`, `ProjectVisualProfile`); `subject.external_component.componentType` diferente de `componentLayer` (`rights_component_layer_mismatch`); `contentHash` de componente externo nulo com `rightsStatus=allowed`; Consent expirado, revogado ou scope diferente tratado como grant válido; `revoke` de consent sem `supersedesRef` ou com escopo diferente do grant; `limits.retentionPolicyId=null` em efeito que retém dados (§3.16); envio remoto autorizado só com rights ou só com consent.
- ValidationResult com `status` divergente da agregação calculada (§3.7): `passed` com check `fail`/`unknown`/`warning`; `passed`/`failed` com `checks=[]`; `not_run` com `evaluatedAt` não nulo; `blocked`/`unknown` com `checks=[]` e `limitations` vazio.
- ConsistencyAssessment `running`/`not_run` com findings não vazios; snapshot `running` usado como evidência de gate/promoção; `completed` em `Locked` sem cobertura dos trait paths pinados (quando derivável do grafo); `Guided`/`Locked` com `profileVersionRef`/`profileDigest` nulos ou apenas um dos dois presente; **`limitations=[]`** com `profileVersionRef=null`, com `status` `inconclusive`/`failed`/`blocked`, ou com `completed` cuja cobertura não é derivável (§3.11); `policy` divergente do `styleContext` do sujeito (`style_policy_mismatch`).
- Destino de consumo tratado como tipo de domínio: record/tipo próprio por destino, identidade ou `Provenance` duplicados por destino, ou promoção/publicação autorizada por check de compatibilidade de destino (§8.1).
- União dos blocos de exemplo §5.5/§5.7 com §5.6 tratada como um único grafo válido: os blocos são cenários alternativos (§5, "Como ler os blocos de exemplo"); fixtures são montadas por cenário (§9.1).
- Dados com path/credential em campos proibidos; Domain tentar I/O/network/Blender/provider é violação de fronteira, não caso de validação de record.

### 9.3 Invariantes transversais com resultado determinístico

1. Mesmo input record/graph + mesma versão de registry = mesmos diagnostics, ordem e códigos; não depender do relógio, locale, filesystem, rede ou random.
2. Nenhum validator faz side effect, gera ID, reescreve/canonicaliza o objeto recebido ou descarta unknown extension/predicate.
3. Datas incoerentes, referências quebradas, version cycles, ownership conflitante e hash declaration mismatch produzem diagnostic com `code`, `path`, severity e record IDs relevantes.
4. Aprovação nunca é inferida de `passed`, `completed`, capability claim, rights `allowed`, saída de IA ou ausência de erro.
5. `Asset.currentVersionRef` aponta no máximo a uma versão; branch/merge sempre explícitos e todos os candidatos permanecem recuperáveis.
6. `Artifact` representa bytes declarados por hash; path, role, artifact version e aprovação não alteram seu ID.
7. Rights e Consent são diferentes e não se substituem. Unknown permanece unknown; uso comercial não fica autorizado por omissão.
8. Registro fora do escopo desta proposta é rejeitado como core desconhecido ou preservado em namespace extension apropriado, nunca convertido silenciosamente.
9. **Independência de ferramenta:** nenhum campo core do pacote nomeia ferramenta, software, provider, renderer ou destino específico. Ferramenta observada vive em `Provenance.environment.toolVersions` e componentes em `Provenance.toolRefs`; provider/adapter são `OpaqueRef`; destino de consumo é extensão de entrega (§3.6, §8.1, §8.2).
10. **Destino não cria identidade:** o mesmo `Asset`/`AssetVersion`/`Provenance`/`HumanReview` serve a todos os destinos de consumo; destinos diferentes produzem, no máximo, entregas (`ArtifactVersion`) ou extensões diferentes (§8.1).
11. **Estado especializado vive em versão imutável:** estado por propriedade de contratos especializados (ex.: cabelo) é declarado em `AssetVersion`, nunca no `Asset` mutável nem em `ArtifactVersion` de um único slot (§5.2, §8.3).
12. **Nenhuma lacuna é preenchida por default:** campo, enum, ID de registry, canonicalização, precedência ou política ausente/pendente permanece declarado como pendente (§11, §13.3) — inclusive quando isso torna um exemplo menos conveniente.
13. **Três atos distintos:** validação técnica (`ValidationResult`), avaliação de consistência (`ConsistencyAssessment`) e aprovação humana (`HumanReview`) não se substituem — `passed` não implica consistência, `completed`/`match` não implica aprovação, `approve` não dispensa medição nem evidência (§3.7, §3.10, §3.11, §6.1).

## 10. Fronteiras do primeiro pacote e critérios objetivos de aceite

### 10.1 In-scope após autorização explícita

- Tipos puros/schema validators para os 17 records desta spec (incluindo `ProjectVisualProfileVersion` independente), referências, validators de graph, profile traits, membership/slot/completion-basis checks, reciprocidade Provenance↔ArtifactVersion, agregação determinística de `ValidationResult`, coerência `rightsStatus`↔`uses` e registries de slots/completion/relationships conforme decisões aprovadas.
- Diagnostics determinísticos e fixtures JSON sintéticas positivas/negativas em memória.
- Helpers puros para verificar consistência de digest/hash **depois** de escolher canonicalização e sem leitura de bytes.
- Documentação/testes sobre ownership, partial/failure, review binding (incluindo `revoke`, se aprovado), branching/CAS preconditions de `currentVersionRef` e `currentApprovedVersionRef`, matriz de rights/consent (§3.17) como regra documental de gates futuros e proteção de unknowns.

### 10.2 Fora do primeiro pacote

Store, filesystem/SQLite/JSON/sidecar, escolha/geração de Project ID, transação real/CAS, migração, legacy adapters, JSON Schema distribution, UI, renderer, Workflow DAG/Runner, retry/cancel, provider/adapter/backend, Blender, rede/telemetria, direitos jurídicos, Consent UX, validators de geometria/PNG reais, integração Charakuru, dados/modelos reais e qualquer promessa de suporte. Também estão fora: **requisitos de exportação/conversão por destino de consumo** (o Domain só registra a declaração de destino e a evidência de compatibilidade medida — §8.1) e **IDs de registry para fluxos 2D/2.5D** (slots/roles/`formatId` de PSD em camadas, rig 2.5D/runtime, atlas 2D, expressões/visemes — §8.2). Nada disso é lacuna silenciosa: ambos têm lugar designado e decisão pendente registrada.

### 10.3 Aceite verificável antes de qualquer pacote de código seguinte

- Todos os 17 records têm contrato com campos, tipos, required/null/optional, ref type, estados e invariantes aprovados sem placeholder/enum implícito; os critérios revisados desta revisão de 2026-11-09 estão consolidados em §13.6.
- IDs e references validam deterministicamente; Artifact identity/hash agreement tem positivos e negativos; Domain não afirma ter verificado bytes.
- AssetVersion e ArtifactVersion diferenciam candidate/incomplete/rejected/failed/approved, retries, multiparent e slots; outputs parciais/falhas sem artefato fictício.
- HumanReview vincula IDs + digest + hashes exatos; stale/mismatch/conflict bloqueiam promoção; a interface futura de Store declara CAS expected-current e nenhuma gravação em failure.
- Profile global v1 tem trait origins/states, refs aprovadas por hash, versionamento e currentApproved pointer; canonicalization ID escolhido em decisão humana, com fixtures cross-runtime antes de hash de produção.
- Slots character/hair/motion/spritesheet, roles/cardinalidades, grouping/delivery e links PNG-manifest têm fixtures; nenhum formato é interpretado por extensão ou alegado compatível com formatos reais sem fixture representativa.
- Relationship registry tem predicate direction, ciclo/unknown rules e fixtures; Change Impact apenas reporta, sem agendar/regenerar.
- Rights/Consent têm estados e escopos distintos; `unknown` não libera comercial/upload; human review não é capability claim.
- Testes executam offline e não importam dependências de I/O/Electron/Blender/provider; source/worktree legado não é alterado; nenhum Store, Workflow, UI ou provider aparece por dependência transitiva.
- Todo campo citado por regra normativa existe na tabela do contrato, com tipo/obrigatoriedade/nulabilidade (`ConsistencyAssessment.limitations`, `HumanReview.reviewBasis`/`limitations`); toda ref polimórfica tem união explícita (`ImpactTriggerRef`, `ImpactAffectedRef`, `UnresolvedRef`, `RightsRecord.subject`).
- Nenhum campo core nomeia ferramenta/software/provider/destino específico; ferramenta observada aparece apenas em `environment.toolVersions`/`toolRefs` (§3.6, §8.2, §9.3 invariante 9).
- Destinos de consumo não geram tipo de domínio, identidade nem origem separados, e têm lugar declarado (extensão de entrega + `ValidationResult.targetRef`); estado especializado por propriedade vive em `AssetVersion` (§8.1, §8.3, §9.3 invariantes 10–11).
- A revisão independente da Arena do primeiro pacote termina antes de autorizar qualquer próxima fase. Estes critérios não foram executados agora.

## 11. Decisões pendentes para a pessoa usuária

A arquitetura está aprovada, mas o schema abaixo não está. Recomendações não viram default sem resposta explícita. Decisões necessárias antes da aprovação deste pacote (lista revisada em 2026-11-09; itens marcados ▲ mudaram ou são novos nesta revisão):

1. **Envelope/IDs:** aprovar `recordType + schemaVersion`, `RecordRef` tipada e IDs `prefix_UUIDv4` (prefixos da §2.3, incluindo ▲`pvpv`), Artifact ID `sha256:<hex>`? Se não, escolher UUIDv7/ULID/outro e forma de refs.
2. ▲ **Nomes canônicos:** aprovar `Asset.currentVersionRef`, `Project.visualProfileRef`, `ProjectVisualProfile.currentApprovedVersionRef` e `observedArtifactHashes` (unificado) como nomes concretos do pacote, mantendo `currentVersionId`/`visualProfileId` do ADR/proposta como nomes semânticos? (§2.1, §13.1)
3. ▲ **Shape de profile:** aprovar `ProjectVisualProfileVersion` como **record independente de topo** com aggregate mantendo `versionRefs` + `currentApprovedVersionRef` (recomendação da §3.8, opção A), ou escolher a opção B (versões embutidas + referência especializada), assumindo seus custos? Aprovar também a lista exata dos traits v1 e a origin union.
4. **Canonicalização/hash:** escolher RFC 8785/JCS, `lia-json-canonical-v1`, deterministic CBOR ou outra; aprovar payload incluído/ordem/Unicode/números e fixtures antes de uso. ▲ O escopo agora cobre `contentDigest` de profile, `subjectDigest` de reviews/decisões e `membersDigest` de ArtifactVersion. `lia-json-canonical-v1` não é aprovado hoje.
5. **Slots/partial:** aprovar slot IDs/role IDs/cardinalidades e o versioned `completionBasis` desta spec? `AssetVersion` pode ser `incomplete` ou `unknown` para output parcial/semântica não resolvida; aprovar que nenhum dos dois promove, ou há caso de negócio que exija exceção? ▲ Aprovar `membersDigest` como campo obrigatório de `ArtifactVersion` e seu payload (§3.5)?
6. ▲ **Lifecycle/promoção/revogação:** aprovar candidate status derivado, review exata por digest/hash, stale block, CAS `expectedCurrentVersionRef` e as regras equivalentes do ponteiro de profile (§4.5)? Aprovar `revoke` como quarto valor de `HumanReview.decision` (recomendado) ou manter revogação por `reject` superseding? Qual é a política de aprovação/revogação concorrente?
7. **Branches:** aprovar múltiplos pais/merge explícito e proibir alteração automática do ponteiro quando CAS fica stale? Como escolher branch/head após duas aprovações concorrentes?
8. ▲ **Rights/Consent:** aprovar a matriz da §3.17, a chave `uses.send_remote` e as regras de coerência `rightsStatus`↔`uses` (§3.15)? Rights `unknown` deve impedir categoricamente a promoção interna de `Asset.currentVersionRef` ou apenas bloquear usos externos/publicação? Aprovar quarentena para `store` unknown? Consent para efeito remoto, armazenamento e retenção precisa de scopes/UX distintos — quais boundaries são obrigatórias?
9. ▲ **Style Lock/desvio/assessment:** aprovar a semântica fechada de `ConsistencyAssessment.running` (findings vazios + supersessão terminal, §3.11) e os efeitos de `StyleDeviationDecision` (§3.12)? Em `Locked`, um `accept_deviation` vigente deve deixar de bloquear a promoção (política de Store/Workflow) e um `reject_deviation` deve bloqueá-la?
10. ▲ **Validação/agregação:** aprovar a ordem fixa de agregação de checks em `ValidationResult.status` (§3.7) e o erro estrutural em caso de divergência, em vez de agregação configurável por registry?
11. ▲ **Relationships/ChangeImpact:** aprovar catálogo de predicates e direções (especialmente `uses_motion` vs `animates`), quais predicates são acíclicos, políticas de archive/unknown e se todos os endpoints v1 devem ser do mesmo Project; aprovar `severity`/`reviewNeed` obrigatórios nos findings (§3.13) e o tratamento de `stale` como projeção derivada; decidir quando os predicates adiados (`wears`, `uses_material`, `uses_palette`, `depends_on`) entram no catálogo.
12. ▲ **First package:** confirmar os 17 tipos, registries/extension shapes e diagnostics como limite; qualquer JSON Schema entregue/compatibility adapter fica fora até autorização separada.

Se uma escolha não for informada, ela permanece `OPEN`; quem codifica não deve completar o contrato por conveniência. Depois das respostas, atualizar esta spec com as decisões explícitas, registrar a revisão humana/data apenas se informadas e solicitar autorização separada para implementação.

## 12. Histórico, datas e evidência

- A proposta consolidada mantém seu snapshot original **2026-10-25 UTC**. Essa data é baseline documental, não timestamp de aprovação.
- Esta especificação teve sua primeira redação em **2026-10-25 UTC** (preservada como histórico) e sua data efetiva de revisão documental atual — a revisão de reconciliação técnica descrita em §13 — é **2026-11-09 UTC**. Nenhuma das duas datas é timestamp de aprovação.
- A aprovação arquitetural é mantida como `ACCEPTED — ARCHITECTURE ONLY`, conforme ADR; sua data de aprovação humana não está registrada separadamente e não foi inventada.
- A aprovação desta especificação está **pendente** e não recebe data até que a pessoa usuária a aprove explicitamente.
- Exemplos/hashes/IDs deste arquivo são sintéticos e não representam arquivos, projetos, providers ou formatos reais. A ausência de fixtures reais impede alegações de compatibilidade com `.spriteforge/`, `.lia.json`, `metadata.json` e outros formatos.
- Esta revisão é exclusivamente documental. Nenhum código/contrato executável foi alterado; nenhum teste, instalação, runtime, Blender, provider, migração, filesystem de dados/sidecars do produto ou operação Git mutável foi executado.
- A revisão de 2026-11-09 editou apenas esta especificação e acrescentou notas de reconciliação pontuais à proposta consolidada. O ADR-001 **não foi modificado**: nenhuma decisão arquitetural nova foi aprovada nesta revisão, e recomendações não viram decisões (ver §13.3).
- **Reconciliação pós-revisão integral (acrescentada sem re-datar os registros acima):** após uma revisão integral read-only desta especificação (1.717 linhas, todas lidas), foram aplicadas correções documentais de coerência interna — 1 blocker, 7 contradições, lacunas e ambiguidades — inventariadas em §13.1 (itens 22–42) e §13.3(b) (R16–R25). A reconciliação acrescentou as subseções §4.6 (concorrência/CAS), §8.1 (destinos de consumo), §8.2 (formatos e fluxos 2D/2.5D) e §8.3 (mapeamento dos contratos especializados), o invariante 13 de §9.3 (validação × consistência × aprovação são atos distintos), os critérios 13–15 de §13.6 e as linhas de compatibilidade correspondentes em §13.4. Nenhum item de §11 foi aprovado, nenhum default foi criado e o ADR-001 permanece intocado; as datas de snapshot (2026-10-25) e de revisão efetiva (2026-11-09) são preservadas e nenhuma data de aprovação humana foi registrada ou inventada.

## 13. Revisão de reconciliação técnica — data efetiva 2026-11-09 (UTC)

Esta seção registra o resultado da revisão de reconciliação entre esta especificação, a proposta consolidada e o ADR-001. É parte do draft: **nada aqui está aprovado**, nenhuma implementação foi autorizada e nenhuma decisão humana foi inferida. O snapshot original de 2026-10-25 permanece preservado no cabeçalho e na §12.

### 13.1 Inconsistências corrigidas nesta revisão

| # | Problema identificado | Correção documental aplicada | Local |
|---|---|---|---|
| 1 | `ProjectVisualProfileVersion` era embutida no aggregate, mas exemplos/reviews/assessments/relationships a referenciavam como record de topo com `schemaVersion` — `RecordRef<T>` não resolvível de modo uniforme | Recomendação fundamentada (opção A vs B, vantagens/desvantagens) por **record independente**; aggregate passa a usar `versionRefs` + `currentApprovedVersionRef`; reciprocidade `profileRef`; todas as referências usam o mesmo modelo | §3.8, §2.3, §5.6, §5.7 |
| 2 | Divergência de nomes: `currentVersionId`/`visualProfileId` (proposta/ADR) vs `currentVersionRef`/`visualProfileRef` (spec) | Nomes `*Ref` declarados como **proposta canônica** do pacote; nomes `*Id` mantidos como semântica aprovada; decisão pendente | §1.1, §2.1, §11 item 2 |
| 3 | Proposta descreve "URI lógica" e `role` no `Artifact`; spec os excluía sem reconciliação explícita | URI lógica = localizador do Store resolvido por id/hash (fora do contract); role = propriedade de membership (`ArtifactVersionMember.roleId`); identidade por bytes inalterada; nota de reconciliação acrescentada à proposta §5.2 | §3.4 |
| 4 | Proposta inclui "digest do conjunto" no `ArtifactVersion`; spec não definia campo/protocolo | Campo `membersDigest: Digest` proposto (payload + canonicalização pendentes) e adicionado aos exemplos | §3.5, §5.1–§5.6 |
| 5 | Fronteira `Provenance` × futuros `WorkflowRun`/`StepRun`/`ProviderExecution`/capability indefinida | Campo `executionContext` com `Reported<OpaqueRef>`; regras de rastreabilidade futura sem traversar; `operationId`≠`capabilityId`; `needs_reconciliation` mapeado para `outcome:"unknown"` no Domain | §3.6 |
| 6 | Outcomes pouco determinísticos: texto anterior admitia `failed` "com outputs"; reciprocidade citada só como negativo | Tabela fechada por outcome (`failed`/`blocked` ⇒ `outputRefs=[]`; `partial` ⇒ não vazio; `cancelled` pode preservar outputs reais) + 6 regras de reciprocidade + superset em `AssetVersion.provenanceRefs` | §3.6, §3.3, §9.2 |
| 7 | `currentApprovedVersionId` sem regras de concorrência/revogação (assimetria com promoção de AssetVersion) | Nova §4.5: pertinência, approve exata vigente, CAS `expectedCurrentApprovedVersionRef`, transação, revogação (`revoke` recomendado), corrida promoção×revogação serializada pelo Store | §4.5, §3.10 |
| 8 | Efeito de `StyleDeviationDecision` sobre avaliação `Locked` não explicado | Semântica fechada em 7 regras: aplicabilidade exata, projeções derivadas (records imutáveis), pós-output não desbloqueia preflight, não dispensa `HumanReview`, não libera direitos, vigência/supersessão/conflito, política de gate pendente | §3.12 |
| 9 | `ConsistencyAssessment.running` ambíguo em record imutável (quem conclui? findings parciais?) | `running`/`not_run` exigem `findings=[]`; conclusão por record novo + `supersedesRef`; sem timeout no Domain (sem relógio); regra de cobertura de traits em `Locked` | §3.11 |
| 10 | Agregação de checks em `ValidationResult` dependia de "registry/version explícitos" (indefinida) | Função total fixa por precedência (fail > unknown > warning > all-not_applicable > passed); `status` gravado deve igualar o calculado; pré-condições para `checks=[]` | §3.7 |
| 11 | `memberLinks` vazio descrito como `{}` sendo array | Corrigido para `[]` + regra de keys existentes | §3.5 |
| 12 | Nomes divergentes para hashes observados (`artifactHashes` em SDD, `comparedArtifactHashes` em CA vs `observedArtifactHashes` em HR/VR) | Unificado em `observedArtifactHashes` (tabelas e exemplos) | §3.11, §3.12, §5.6 |
| 13 | `ChangeImpactReport` sem nível/severidade e necessidade de revisão da proposta §7.2; `stale` sem tratamento | `severity` e `reviewNeed` obrigatórios nos findings (sem default; `unknown` válido); `stale` = projeção derivada (report imutável); mapeamento do vocabulário de decisões da proposta | §3.13, §3.14 |
| 14 | Colisão de IDs sintéticos entre §5.3 e §5.5 (`dly_...033`, `prv_...034` com sentidos diferentes) | §5.5 renumerado para faixa `...0050`–`...0062`, sem colisões no documento | §5.5 |
| 15 | `missingRequirementIds` exemplificado com roleId (`lia.role.spritesheet.manifest`) em vez de requirementId | Corrigido para `lia.req.spritesheet.manifest`, coerente com `CompletionRequirement.requirementId` | §5.5 |
| 16 | `uses` sem chave para envio a provider remoto; sem regras de coerência entre estado geral e permissões por uso | Chave `send_remote` (7 chaves obrigatórias, pendente); tabela de coerência `rightsStatus`↔`uses`; fail-closed por atividade; matriz de política §3.17 | §3.15, §3.17 |
| 17 | Refs "polimórficas" sem definição de união (subjectRef de HR/VR, endpoints de relacionamento) | Uniões explícitas, com `ArtifactRef` para sujeito `Artifact` | §3.7, §3.9, §3.10 |
| 18 | Contagem de records desatualizada após tornar ProfileVersion independente | 16 → **17** em todo o documento | §2.1, §10.1, §10.3, §11 |
| 19 | Lacunas de exemplos exigidas pela revisão (Project/Profile sem versão aprovada, completeness `unknown`, `reject_deviation`, consent `revoke`, revogação de aprovação de profile, merge explícito) | Nova §5.7 (records completos e fragmentos identificados) + `siblingLineage` expandido com irmãs nomeadas e `mergeCandidate` | §5.5, §5.7 |
| 20 | Consent `revoke` sem regra de escopo; vigência temporal podia sugerir relógio no Domain | `revoke` exige `supersedesRef` + escopo idêntico ao grant; expiração avaliada só pelo gate executor | §3.16 |
| 21 | `formatId` ambíguo ("namespaced conhecido ou `unknown`") | Literal reservado `unknown` definido + regra de registry | §3.4 |
| 22 | **Blocker:** `ConsistencyAssessment.limitations` exigido três vezes pelo texto normativo e pela proposta §5.3 ("limitações obrigatórias"), mas ausente da tabela de campos — regras de `completed`/`inconclusive`/`failed`/`blocked` inimplementáveis | Campo declarado com tipo, obrigatoriedade, nulabilidade e semântica; quatro condições explícitas de não-vazio; coerente com as regras de status e com §9.1/§9.2 | §3.11, §9.1, §9.2 |
| 23 | Extensão `lia.hair.state.v1` com **dois donos**: texto e exemplo §5.2 a colocavam em `ArtifactVersion`; exemplo §5.6 a colocava no `Asset` (record mutável) | Dono único definido: **`AssetVersion`** (imutável, versionada, entra no digest de review), com justificativa por imutabilidade/versionamento/identidade; exemplo §5.2 reescrito (novo `asv_...0073`), `extensions:{}` no `ArtifactVersion` e no `Asset` de §5.6; mapeamento em §8.3; invariante 11 em §9.3 | §5.2, §5.6, §8.3, §9.2, §9.3 |
| 24 | Texto de §5.2 afirmava `materials=present` enquanto o exemplo declarava `"materials":"unknown"` | Valores derivados do que a entrega declara e coerentes entre texto e exemplo (`geometry=present`, `materials=absent` com role opcional não entregue, `uv`/`association`/`attachment=unknown`, `skinning=absent`, `springs=not_applicable`) + regra "nenhum estado infere outro" | §5.2 |
| 25 | Regra de mesmo Project em `AssetRelationship`: "devem pertencer" (§3.9) × "Recomendação" (§3.9) × negativo obrigatório (§9.2) × decisão pendente (§11 item 11); e ownership de endpoint `ArtifactRef` indefinido | Separado o que é **autoconsistência** (erro `relationship_project_mismatch`, válido em qualquer cenário) do que é **política** (representar relação cross-project — explicitamente pendente, §11 item 11); regra derivável de ownership de `ArtifactRef` via `ArtifactVersion` member + `projectRef`, com warning `relationship_endpoint_ownership_unresolved` e aresta não atravessada; §9.2 alinhado | §3.9, §9.2 |
| 26 | §2.3 rotulava `AssetVersion`/`ArtifactVersion`/`ProjectVisualProfileVersion`/`Provenance` como "Records mutáveis/decisões", contradizendo §2.4, §3.3 e §3.8 | Tabela de IDs dividida em **imutáveis/append-only** × **mutáveis somente por transação do Store** (`Project`, `Asset`, aggregate `ProjectVisualProfile`); §2.4 passa a trazer a classificação canônica com a regra de que estado especializado não vive em record mutável | §2.3, §2.4 |
| 27 | Tipos nullable declarados como não nullable e uniões escritas em prosa: `StyleDeviationDecision.profileVersionRef`/`profileDigest` ("Ref + Digest") × regra que admite `null`; `ConsistencyAssessment.subjectRef`/`supersedesRef`; `RightsRecord.supersedesRef`; `ConsentRecord.supersedesRef` | Tipos corrigidos para `\| null` com nullabilidade **conjunta** e diagnóstico `deviation_baseline_incomplete`; refs reescritas como uniões explícitas `RecordRef<T>`, na mesma disciplina da correção 17 | §3.11, §3.12, §3.15, §3.16 |
| 28 | Tipos referenciados sem definição, apesar de §13.5 afirmar cobertura completa: `changedRefs[].ref`, `findings[].affectedRef`, `pathRefs[]`, `unresolvedRefs` ("array de Ref"), `RightsRecord.subject` (recordTypes válidos), `subject.external_component.componentType` × `componentLayer`, `terms[].name`, `terms[].sourceRef` × `evidenceRef` | Definidos `ImpactTriggerRef`, `ImpactAffectedRef` (com regra de precisão versão × agregado), `UnresolvedRef`, `pathRefs: RecordRef<AssetRelationship>[]`, `ComponentLayer` nomeado e MUST-igual a `componentLayer` (`rights_component_layer_mismatch`), `subject` discriminado com tipos permitidos (agregados mutáveis excluídos), `terms[].name: NonEmptyString` e distinção procedência × prova | §3.13, §3.15, §9.2, §13.5 |
| 29 | Vocabulário de dimensões divergente entre spec (`match/deviation`) e proposta §5.3 (`pass/issue`), sem registro na matriz de compatibilidade | Mapeamento explícito registrado (`pass`→`match`, `issue`→`deviation`) no contrato, no mesmo padrão já usado para `ImpactDecisionEvent`; enum da spec declarado proposta canônica; linha acrescentada em §13.4 e nota na proposta | §3.11, §13.4 |
| 30 | Coerência de `rightsStatus=restricted` admitia **todas** as chaves de `uses` em `allowed` desde que houvesse `terms`/`limitations` ("OU" frouxo), enfraquecendo o fail-closed | Restrição passa a exigir ao menos uma chave em {`restricted`,`blocked`,`unknown`}; condições em `terms`/`limitations` complementam e nunca substituem; caso "tudo allowed sob condições" remapeado para `allowed` + condições; negativo acrescentado | §3.15, §9.2 |
| 31 | `Provenance.environment.blenderVersion`: campo core nomeado a partir de uma ferramenta específica, permanentemente `not_applicable` fora dela | Substituído por `environment.toolVersions` (array de `{toolId, version, role}`, namespaced, independente de ferramenta), com justificativa arquitetural (ADR Decisões 1 e 5; proposta §8.1; rotas 2D/2.5D/3D); três exemplos JSON atualizados; `toolRefs` continua sendo o registro de componentes com direitos/hash | §3.6, §5.5, §5.6, §8.2, §9.2 |
| 32 | `deliveryId` sem cardinalidade declarada: §3.5 regra 2 usava chave composta `(deliveryId, assetRef, slotId)` enquanto §3.6 regra 5 implicava 1:1 | Cardinalidade **1:1 com `ArtifactVersion`** declarada; chave composta redefinida como verificação derivada de consistência; diagnóstico `delivery_id_reused`; negativo acrescentado | §2.3, §3.5, §9.2 |
| 33 | `HumanReview` sem checklist/contexto/escala (requisito da proposta §5.3) e sem limitações (auditoria, item 10); "decisões concorrentes" sem definição (duplicatas de `approve` não tratadas) | Campos `reviewBasis` (`Reported<>` para checklist/escala/contexto; registry externo) e `limitations` adicionados; definição de decisões concorrentes cobrindo duplicatas ⇒ `review_conflict`; efeitos sobre ponteiros mantidos como pendência (§11 itens 6–7) | §3.10, §9.1, §9.2 |
| 34 | Concorrência/edição dos records mutáveis além dos dois ponteiros (`Project`, `Asset`, `ProjectVisualProfile.versionRefs`) não tratada | Nova §4.6: só o Store muta; CAS generalizado por `expectedDigest` **proposto** (alternativas: CAS por campo, last-write-wins com diagnóstico — não recomendado); `versionRefs` cresce por anexação serializada; edição de identidade não cria identidade nova nem substitui ato humano; escolha permanece pendente (§11 item 6) | §4.6 |
| 35 | `TraitOrigin.ai_proposal` podia apontar para `Provenance` sem outputs (exemplo §5.7 referenciava tentativa `failed`) sem nenhuma regra de grafo | Regra: `provenanceRef` deve ter `outcome` `succeeded`/`partial`; diagnóstico `trait_origin_provenance_inconsistent`; esclarecido que `succeeded` com `outputRefs=[]` é legal quando o propósito não inclui entregas; exemplo corrigido com novo record sintético `traitProposalProvenance` (`prv_...0071`) e nota (a) reescrita; critério equivalente para `imported_reference` | §3.6, §3.8, §5.7, §9.2 |
| 36 | Exemplo de `RightsRecord` em §5.6 declarava `componentLayer:"output"` sobre o Artifact que é **input** de `lia.asset.register` | Corrigido para `componentLayer:"asset"` com limitação explicando o caso e a exigência de `RightsRecord` próprio para outputs/derivados (regra de cadeia) | §5.6 |
| 37 | Blocos §5.5/§5.7 podiam ser lidos como parte de um único grafo com §5.6 — a união produz violações intencionais (ex.: ponteiro de profile aprovado × revogação da mesma aprovação) | Regra de leitura acrescentada ao §5 (blocos são cenários alternativos; §5.6 é o único grafo completo) + negativo explícito em §9.2 + orientação de montagem de fixtures por cenário | §5, §9.1, §9.2 |
| 38 | Requisitos de **destinos de consumo** (proposta §4.3: Game Asset/Lia Desktop Asset) e de **formatos/fluxos 2D e 2.5D** sem lugar designado no pacote; colisão terminológica com "destinos de consumo" usado em §13.4 para destino físico de persistência | Novas §8.1 (destino = extensão de entrega + `ValidationResult.targetRef`; sem tipo de domínio por destino; identidade/origem únicas; `targets`/`engine` de projeto fora do v1) e §8.2 (formato é capacidade declarada, não dependência de software; slots/roles/`formatId` 2D/2.5D explicitamente não propostos e pendentes; rastreabilidade do fluxo 2.5D mapeada contrato a contrato, com reconstruções tratadas como conteúdo gerado); distinção terminológica obrigatória registrada | §8.1, §8.2, §9.1, §9.2, §9.3, §13.4 |
| 39 | Alegação de §13.4 de que `HairAsset`/`RiggedCharacter`/`MotionClip`/`SpriteSheetOutput` estão "cobertos por slots/extensions" não era demonstrada; vocabulário de estado divergente (`partial` na proposta §5.3) | Nova §8.3 com mapeamento requisito a requisito (coberto / mecanismo coberto com shape pendente / divergência registrada); vocabulário proposto `present\|absent\|unknown\|not_applicable` e `partial` registrado como divergência pendente (R18), sem default | §8.3, §13.4 |
| 40 | Pendências não inventariadas ou regras ausentes: `Artifact.byteLength=0` fora de §11; precedência **entre** `ValidationResult` inexistente; `limits.retentionPolicyId` não nullable mesmo sem retenção aplicável; `ConsentRecord` sem escopo de projeto/Asset | `byteLength=0` registrado como R16 com recomendação técnica; precedência entre resultados registrada como lacuna + R17 com três alternativas e consequências (nenhuma seleção pelo Domain); `retentionPolicyId` tornado nullable apenas quando nenhuma retenção se aplica, mantendo fail-closed; escopo de aplicabilidade de consent registrado como pendência R20 (§11 item 8) | §3.4, §3.7, §3.16, §13.3 |
| 41 | O `policy` derivado do `styleContext` do sujeito não tinha tipo/enum declarado, sugerindo um "lifecycle" paralelo | Esclarecido que o valor derivado pertence ao **mesmo** enum `policy` (`Free \| Guided \| Locked \| not_selected`) do record, com mapeamento total e diagnóstico `style_policy_mismatch`; nenhum tipo novo foi criado | §3.11 |
| 42 | Notação de uniões heterogênea: algumas uniões são tipos nomeados (`EvidenceRef`, `ChangedRef`, `ImpactTriggerRef`, `ImpactAffectedRef`, `UnresolvedRef`, `ImpactFinding`) e outras aparecem como literal inline `{ "kind": … }` nas tabelas | As uniões normativas passaram a ser nomeadas e listadas (§3.13, §3.15, §3.16, §13.5). A uniformização **gráfica** restante (reescrever todas as tabelas para um único estilo) não foi aplicada: é decisão de nomes canônicos e forma de envelope, pendente com §11, itens 1–2; nenhuma renomeação foi feita por default | §3.13, §3.15, §3.16, §13.5 |

### 13.2 Decisões ainda pendentes

A lista consolidada e revisada está na §11 (12 itens; ▲ marca itens novos/alterados nesta revisão). Permanecem integralmente `OPEN`, sem default inventado: formato de IDs/UUID; nomes canônicos `*Ref`; shape do profile (agora **com recomendação**, mas decisão pendente); canonicalização/hash (incluindo payload de `membersDigest` e de `subjectDigest`); slots/roles/cardinalidades e completion policy registry; não-promoção de `incomplete`/`unknown`; valor `revoke` em `HumanReview.decision`; política de concorrência/branches e escolha de head; matriz de rights/consent e chave `send_remote`; bloqueio de promoção por rights `unknown`; quarentena de armazenamento; semântica de gates `Locked`×desvio; agregação de `ValidationResult`; catálogo de predicates (incluindo os adiados `wears`/`uses_material`/`uses_palette`/`depends_on`); `severity`/`reviewNeed`; limites do primeiro pacote (17 tipos). A aprovação humana desta especificação e a autorização separada de implementação continuam pendentes e sem data.

**Pendências acrescentadas pela reconciliação (todas `OPEN`, nenhuma virou default):** além dos 12 itens de §11 — cujo nome e escopo permanecem inalterados — ficam registrados como pendentes: aceitação de `Artifact` com zero bytes (R16); precedência entre múltiplos `ValidationResult` (R17); inclusão ou não de `partial` no vocabulário de estado por propriedade (R18); mecanismo de concorrência para edição de `Project`/`Asset`/aggregate (R19, dentro da política de concorrência do §11 item 6); vínculo de `ConsentRecord` a Project/Asset (R20, dentro do §11 item 8); e os shapes acrescentados como proposta — `HumanReview.reviewBasis`/`limitations`, `ConsistencyAssessment.limitations`, `Provenance.environment.toolVersions`, uniões `ImpactTriggerRef`/`ImpactAffectedRef`/`UnresolvedRef`/`ComponentLayer`, extensão de destino de consumo e slots/roles/`formatId` 2D/2.5D — todos dependentes da confirmação do pacote (§11, itens 5 e 12).

### 13.3 Recomendações da Arena (não aprovadas) × decisões aprovadas (não reabertas)

**(a) Decisões aprovadas — ADR-001/proposta; esta revisão não as reabre nem as altera:**

| Decisão aprovada | Onde a spec a aplica |
|---|---|
| Lia Forge único produto; módulos first-party; painel Blender só auxiliar | §1.1 (restrições) |
| `Asset`/`AssetVersion`/`ArtifactVersion`/`Artifact` com semânticas distintas e imutáveis; aprovação humana exata; ponteiro só por transação | §2.4, §3.2–§3.5, §4.2–§4.4 |
| `ProjectVisualProfile` global por Project em v1, sem herança, forma evolutiva | §3.8, §6.1 |
| `.spriteforge/` intacto; sem banco/`Project.id`/migração; mapeadores read-only futuros | §1.1, §9, §10.2 |
| Primeira homologação modelo existente → PNG + manifesto → validação → avaliação → aprovação humana | §1.1, §5.4 |
| Comparação Blender × WebGL/SpriteForge sem renderer padrão; Windows/RX 580 alvo ≠ suporte | §1.1 (fora do escopo de contracts) |
| Direitos por componente/camada e uso; wrapper não cobre pesos/modelos/datasets/outputs; `unknown` não vira liberação | §3.15, §3.17 |
| Claims versionados/escopados com evidência; execução por etapa consentida; `unknown` não vira compatibilidade | §3.11, §3.16, §6.1 |

**(b) Recomendações desta revisão (Arena) — todas `PENDENTE DE APROVAÇÃO HUMANA`, nenhuma é default:**

| # | Recomendação | Seção |
|---|---|---|
| R1 | `ProjectVisualProfileVersion` como record independente (opção A) com aggregate `versionRefs`/`currentApprovedVersionRef` | §3.8 |
| R2 | Nomes canônicos `*Ref` (`currentVersionRef`, `visualProfileRef`, `currentApprovedVersionRef`) e `observedArtifactHashes` unificado | §2.1, §3.11–§3.12 |
| R3 | `membersDigest` obrigatório em `ArtifactVersion` (payload/canonicalização pendentes) | §3.5 |
| R4 | `HumanReview.decision=revoke` como valor distinto (alternativa: `reject` superseding, não recomendada) | §3.10, §4.5 |
| R5 | Tabela fechada de outcomes: `failed`/`blocked` ⇒ sem outputs; `partial` ⇒ outputs reais; `cancelled` pode preservar outputs; `unknown` para indeterminação remota | §3.6 |
| R6 | `executionContext` com `Reported<OpaqueRef>` como única superfície de enlace com Workflow/Hub futuros | §3.6 |
| R7 | CAS/transação para `currentApprovedVersionRef` espelhando a promoção de AssetVersion | §4.5 |
| R8 | `running`/`not_run` com `findings=[]` e conclusão por supersessão terminal; cobertura de traits em `Locked` quando derivável | §3.11 |
| R9 | Agregação fixa de checks em `ValidationResult.status` (função total; divergência = erro) | §3.7 |
| R10 | `severity`/`reviewNeed` obrigatórios em findings de `ChangeImpactReport`; `stale` como projeção derivada | §3.13 |
| R11 | `uses.send_remote` + coerência `rightsStatus`↔`uses` + matriz fail-closed de atividades | §3.15, §3.17 |
| R12 | Quarentena (não apagamento) para bytes com `store=unknown` no import | §3.17 |
| R13 | Avaliar RFC 8785/JCS como primeira opção de canonicalização — avaliar, **não adotar** sem fixtures aprovadas | §6.3 |
| R14 | `reject_deviation`/`accept_deviation` como projeção derivada, sem efeito automático em gates (política pendente) | §3.12 |
| R15 | Predicates `wears`/`uses_material`/`uses_palette`/`depends_on` adiados (candidatos, não removidos) | §7.1 |
| R16 | Rejeitar `Artifact` com `byteLength=0` para outputs; aceitar apenas caso a caso, para marcador/placeholder declarado e justificado — nunca por default | §3.4 |
| R17 | Precedência **entre** múltiplos `ValidationResult`: (a) `supersedesRef` no contrato, (b) regra determinística no gate, (c) seleção configurável por registry. Nenhuma adotada; o Domain não seleciona | §3.7 |
| R18 | Vocabulário de estado por propriedade em extensões especializadas: `present \| absent \| unknown \| not_applicable`; `partial` (usado no exemplo da proposta §5.3) **não** incluído — decidir se entra e com qual semântica | §5.2, §8.3 |
| R19 | CAS generalizado (`expectedDigest` do record) para toda edição de `Project`/`Asset`/aggregate `ProjectVisualProfile`; alternativas: CAS por campo ou last-write-wins com diagnóstico (não recomendado) | §4.6 |
| R20 | Vínculo de `ConsentRecord` a Project/Asset (escopo de aplicabilidade): campo novo no `scope`, derivação por `inputArtifactHashes` ou grants globais por provider/destino — nenhuma opção adotada | §3.16 |
| R21 | `Provenance.environment.toolVersions` (independente de ferramenta) em substituição a qualquer campo core nomeado por software específico | §3.6, §8.2 |
| R22 | Estado por propriedade de contratos especializados pertence a `AssetVersion` — nunca a `Asset` (mutável) nem a `ArtifactVersion` (um slot) | §5.2, §8.3, §9.3 |
| R23 | `limitations` obrigatório em `ConsistencyAssessment` e `HumanReview`; `reviewBasis` (checklist/escala/contexto como `Reported<>`) em `HumanReview`, com registry externo ao pacote | §3.10, §3.11 |
| R24 | Destinos de consumo representados por extensão de `ArtifactVersion` + evidência de compatibilidade em `ValidationResult.targetRef`, sem tipo de domínio, identidade ou origem separados por destino | §8.1, §9.3 |
| R25 | Regras deriváveis de integridade relacional: `relationship_project_mismatch` (autoconsistência) e ownership de endpoint `ArtifactRef` via `ArtifactVersion` member no mesmo Project, com warning e aresta não atravessada | §3.9, §9.2 |

### 13.4 Matriz de compatibilidade — proposta × ADR-001 × especificação

| Tema | Proposta consolidada | ADR-001 | Spec (revisão 2026-11-09) | Estado |
|---|---|---|---|---|
| Quatro entidades, imutabilidade, aprovação humana, ponteiro transacional | §1 dec. 3, §5.2–§5.3 | Decisão 2 | §2.4, §3.2–§3.5, §4 | **Compatível** (aprovado) |
| Nomes de ponteiros/referências | `currentVersionId`, `visualProfileId` | `currentVersionId` | `currentVersionRef`, `visualProfileRef`, `currentApprovedVersionRef` (proposta canônica) | Semântica compatível; **nomenclatura pendente** (§11, item 2) |
| Shape do profile | "versões imutáveis + eventos append-only" (sugere versões separáveis) | Não especifica forma | Aggregate + `ProjectVisualProfileVersion` independente (recomendação R1) | **Recomendação pendente** (§11, item 3); exemplos anteriores já eram incompatíveis com versão embutida — corrigido |
| Ponteiro de profile | "perfil ativo só muda por ato explícito" | Não especifica | §4.5 CAS + revoke | **Mecanismo proposto, pendente** (§11, item 6) |
| `Artifact`: URI lógica/role | Inclui URI lógica e role no Artifact | "arquivo físico identificado por bytes/hash" | Sem URI/role no contract; URI = Store; role = membership | **Reconciliado** (nota na proposta §5.2); forma final pendente com o pacote |
| Digest de conjunto em `ArtifactVersion` | Menciona "digest do conjunto" | Não menciona | `membersDigest` (R3) | **Proposto, pendente** (§11, itens 4–5) |
| `Provenance` × `WorkflowRun`/`ProviderExecution` | Lista ambos como contracts; Provenance com workflow/run/step/capability | Gate: pacote delimitado primeiro | Só `Provenance` no pacote; `executionContext` referencia futuros contracts sem implementá-los | **Fronteira definida; compatível com o gate do ADR**; contracts futuros adiados |
| Falha/output parcial | Run falho preserva outputs parciais; sem versão fabricada | "tentativas candidatas, incompletas, rejeitadas e falhas permanecem preservadas" | Tabela de outcomes + reciprocidade (R5) | Compatível em princípio; **detalhes pendentes** |
| Rights por componente/uso | §12.2 (camadas, sem herança de wrapper) | Decisão 6 | §3.15 + matriz §3.17 (R11) | **Compatível**; `send_remote`/matriz pendentes (§11, item 8) |
| Consent por efeito | §8.3 (escopo alterado invalida grant) | Decisões 6/10 (execução consentida) | §3.16 + regra revoke/escopo | **Compatível**; UX/retenção pendentes |
| Canonicalização/hash de profile | `lia-json-canonical-v1` como recomendação histórica | Aberta (§Consequências) | §6.3 (avaliar RFC 8785/JCS; nada adotado) | **Aberta nos três** (§11, item 4) |
| Relationships/predicates | Lista ampla + níveis `low/medium/high` + necessidade de revisão | Aberta | Registry v1 menor + `severity`/`reviewNeed` + mapeamentos | **Reconciliado**; catálogo pendente (§11, item 11) |
| Style Lock/desvio | §6.2 (preflight bloqueado; desvio pontual pós-output) | Decisões 5–6 (claims/evidência) | §3.12 (R14) + §6.1 | **Compatível**; política de gate pendente (§11, item 9) |
| Estados de assessment | `not_run/running/completed/inconclusive/blocked/failed` | — | Mesmo enum + regras fechadas (R8) | **Compatível**; regras pendentes |
| Contracts especializados (`HairAsset`, `RiggedCharacter`, `MotionClip`, `SpriteSheetOutput`, `StylePolicySnapshot`) | Descritos na proposta §5.2/§6.2 | — | Cobertos em v1 por slots/extensions/`styleContext`/relationships; sem records top-level próprios — **mapeamento demonstrado requisito a requisito em §8.3** | **Diferença de escopo proposta** (§11, item 12); shapes de extensões pendentes; proposta mantém os conceitos como evolução futura |
| Estado por propriedade de hair (exemplo da proposta §5.3 usa `partial`) | §5.2/§10.1: `present`, `absent`, `unknown`, não aplicável; exemplo §5.3 cita `partial` | — | Vocabulário proposto `present \| absent \| unknown \| not_applicable`, sem `partial`; dono do estado = `AssetVersion` (§5.2, §8.3) | **Divergência registrada, pendente** (R18); nenhum default adotado |
| Dimensões de `ConsistencyAssessment` | §5.3: `pass/issue/unknown/not_applicable` + "limitações obrigatórias" | — | `match/deviation/unknown/not_applicable` (mapeamento `pass`→`match`, `issue`→`deviation` registrado em §3.11) + campo `limitations` declarado | **Reconciliado** com mapeamento explícito (correções 22 e 29); enum da spec é a proposta canônica do pacote |
| Campos mínimos de `Project`/`Asset`/`AssetVersion` | §5.2: `targets`/`engine` opcionais; `subtype`, `brief`; "ator, hora e **resumo**" | — | Sem `targets`/`engine` em `Project`; sem `subtype`/`brief` em `Asset` (`assetTypeId` namespaced + `displayName`/`description`/`tags`); sem campo de resumo em `AssetVersion` (`createdBy`/`createdAt` + `assetSnapshot` congelado; a justificativa da revisão vive em `HumanReview.reason`/`reviewBasis`) | **Divergências registradas nesta reconciliação** (antes ausentes da matriz); `targets`/`engine` ligados a destinos de consumo (§8.1) permanecem fora do v1 |
| `HumanReview`: checklist/contexto/escala e limitações | §5.3: "checklist/contexto/escala e refs/hash exatos observados" | — | `reviewBasis` (`Reported<>` para checklist/escala/contexto; registry externo) + `limitations` | **Reconciliado** (correção 33, R23); shapes pendentes com o pacote (§11, item 12) |
| `ValidationResult`: nome do campo de achado | §5.2: checks com `finding` | — | `message` no check (§3.7) | **Divergência cosmética registrada**; sem impacto semântico |
| Destinos de consumo (Game Asset, Lia Desktop Asset) | §4.3: destinos são consumidores; não são tipos de domínio nem sistemas de geração | — | §8.1: extensão de entrega + `ValidationResult.targetRef`; identidade/origem únicas; `targets`/`engine` de projeto fora do v1 | **Compatível e agora representado**; shape da extensão pendente (§11, item 12) |
| Formatos e fluxos 2D/2.5D (PSD em camadas, rig 2.5D, Live2D) | §4.3/§8.4/§9.4: rota 2D→PSD→revisão→rig 2.5D→animação→exportação, providers substituíveis | — | §8.2: representáveis por registry + `formatId` + `extensions`; slots/roles/`formatId` 2D/2.5D **não propostos** neste pacote; rastreabilidade do fluxo mapeada; nada promovido a capacidade suportada | **Compatível**; IDs de registry pendentes (§11, item 5) |
| Independência de ferramenta no Domain | §8.1: backend não se infere pelo nome do provider; ADR Decisões 1 e 5 | Decisões 1/5 (Blender auxiliar; sem renderer padrão) | `environment.toolVersions` substitui campo nomeado por ferramenta; `toolRefs` para componentes; `adapterRef`/`providerRef` opacos | **Reconciliado** (correção 31, R21); shape pendente com o pacote |
| Renderer/plataforma/E2E | §9.3, §15 | Decisões 4–5 | Fora do escopo de contracts | **Compatível** (não tocado) |
| Datas | Snapshot 2026-10-25 preservado; aprovação sem data | Registro 2026-10-25; aprovação sem data | Revisão efetiva 2026-11-09; snapshot preservado; aprovação pendente sem data | **Compatível**; nenhuma data de aprovação inventada |
| Estado de autorização | Arquitetura `APPROVED`; implementação `NOT_AUTHORIZED` | `ACCEPTED — ARCHITECTURE ONLY`; `NOT AUTHORIZED` | `DRAFT_FOR_HUMAN_REVIEW — NOT AUTHORIZED FOR IMPLEMENTATION` | **Compatível** |

### 13.5 Contratos e tipos efetivamente cobertos

**17 records de topo (todos com envelope §2.1):** `Project`, `Asset`, `AssetVersion`, `Artifact`, `ArtifactVersion`, `Provenance`, `ValidationResult`, `ProjectVisualProfile`, `ProjectVisualProfileVersion` (novo como record independente), `AssetRelationship`, `HumanReview`, `ConsistencyAssessment`, `StyleDeviationDecision`, `ChangeImpactReport`, `ImpactDecisionEvent`, `RightsRecord`, `ConsentRecord`.

**Tipos compartilhados definidos (§2.2–§2.3 e contratos):** gramáticas de `RecordId` por prefixo (incluindo `pvpv`), `ArtifactId` (`sha256:<hex64>`), `deliveryId` (1:1 com `ArtifactVersion`), `RecordRef<T>`, `ArtifactRef`, `RelationshipEndpointRef`, `ImpactTriggerRef`, `ImpactAffectedRef`, `UnresolvedRef` (uniões explícitas), `ComponentLayer` (enum fechado nomeado, usado por `componentLayer` e `subject.external_component.componentType`), união discriminada `subject` de `RightsRecord`, `Digest`, `Trait<T>`, `Reported<T>`, `TraitOrigin` (união discriminada), `OpaqueRef`, `EvidenceRef`, `Instant`, `NonEmptyString`, `Sha256Hex`, `ExtensionEnvelope`.

**Sub-objetos com definição explícita:** `assetSnapshot`, `CompletionBasis`/`CompletionRequirement`, `completeness`, `styleContext` (equivalente do `StylePolicySnapshot` da proposta), `expectedRoles` entry, `ArtifactVersionMember`, `memberLinks` entry, `membersDigest`, `ToolComponentRef`, `environment` (campos `Reported` + `toolVersions`), `failure`, `executionContext`, `ProfileReference`, traits v1 do profile, findings de `ConsistencyAssessment` (com `limitations` do assessment), `reviewBasis` e `limitations` de `HumanReview`, `changedRefs` (`ChangedRef`) e findings (`ImpactFinding`, com `severity`/`reviewNeed`) de `ChangeImpactReport`, `subject`/`terms`/`uses` de `RightsRecord`, `scope`/`destination`/`limits` de `ConsentRecord`.

**Registries propostas (não aprovadas):** slots/roles v1 (4 slots, §5), completion policies, `operationId`, predicates de relacionamento (8 propostos + 4 adiados), checks/targets de validação, `assetTypeId`, `formatId`, effects/dataClasses de consent, reason/unknownReason IDs, `toolId` de `environment.toolVersions`. **Não propostos neste pacote** (mecanismo pronto, IDs pendentes): slots/roles/`formatId` de fluxos 2D e 2.5D (§8.2), checklists/escalas de `HumanReview.reviewBasis` (§3.10), shapes de extensões especializadas — estado por propriedade de hair (§5.2, §8.3) e destino de consumo (§8.1). Regra geral para valores desconhecidos: §2.1 (aceito sintaticamente com diagnóstico, nunca convertido em valor conhecido).

**Não cobertos neste pacote (fronteira definida, contratos adiados):** `WorkflowDefinition`/`WorkflowPlan`/`WorkflowRun`/`StepRun`, `ProviderExecution`, `Capability`/`CapabilityClaim`, Hub/Adapter/Provider/Backend, Store/persistência e transações reais, records especializados `HairAsset`/`RiggedCharacter`/`MotionClip`/`SpriteSheetOutput` (v1 usa slots/extensions/relationships), UI/UX, distribuição de JSON Schema, codecs legados e migração.

**Verificação de completude pedida nesta revisão (resultado, re-verificado pela reconciliação):** (i) campos obrigatórios/opcionais/nullable sem ambiguidade — tabelas §3 com uniões explícitas (correções 11, 17, 21, **27**); (ii) tipos referenciados com definição — todos listados acima; **a afirmação anterior era incompleta**: `affectedRef`, `pathRefs`, `unresolvedRefs`, `changedRefs[].ref` e os discriminadores de `RightsRecord.subject`/`terms` não estavam definidos e foram definidos na correção **28**; (iii) `RecordRef<T>` resolvível — único caso não resolvível (ProfileVersion embutida) eliminado pela R1; (iv) enums/registries com regra de desconhecidos — §2.1 + §7.2 + §8.2 (IDs 2D/2.5D não propostos); (v) invariantes locais/de grafo determinísticos — outcomes/reciprocidade (§3.6), agregação (§3.7), coerência rights (§3.15), CAS (§4.3/§4.5), ownership/mismatch relacional (§3.9), origem de trait × outcome (§3.8), `deliveryId` 1:1 (§3.5) são regras puras; **precedência entre `ValidationResult` permanece indefinida por decisão pendente** (§3.7, R17); (vi) nenhum validator depende de filesystem/rede/relógio externo/runtime — §8, `Instant` validado só por formato/ordem local, vigência de consent movida para o gate executor (§3.16); (vii) campos redundantes sem contradição — `projectRef` redundante em `AssetVersion`/`ArtifactVersion` é declarado "para consultas" com regra MUST-igual; `status`/`assemblyState` derivados são recalculados e divergência é erro; `componentType`×`componentLayer` e `(deliveryId, assetRef, slotId)` são redundâncias **com regra MUST-igual explícita**; (viii) exemplos JSON coerentes com schemas — corrigidos/renumerados/identificados como fragmentos (§5, §13.1 itens 12, 14, 15, 19, **23, 24, 35, 36, 37**); (ix) **campo normativo existente para toda regra citada em texto** — `ConsistencyAssessment.limitations` e `HumanReview.reviewBasis`/`limitations` declarados (correções 22 e 33); (x) requisitos da proposta sem lugar designado — destinos de consumo (§8.1), formatos/fluxos 2D/2.5D (§8.2) e contratos especializados (§8.3) agora têm lugar explícito ou pendência registrada.

### 13.6 Critérios de aceite revisados

Valem os critérios da §10.3 (não executados), revisados/ampliados por esta seção:

1. Os **17** records têm contrato aprovado (campos, tipos, required/null/optional, refs, estados, invariantes) sem placeholder nem enum implícito, com as decisões de nomenclatura (§11, itens 1–2) registradas.
2. Toda `RecordRef<T>` — incluindo `RecordRef<ProjectVisualProfileVersion>` — resolve no grafo fornecido; reciprocidades aggregate↔versão, `Provenance`↔`ArtifactVersion` e `AssetVersion.provenanceRefs`⊇ provenances das entregas são validadas com fixtures positivas/negativas.
3. A tabela de outcomes (§3.6) é deterministicamente validável: `failed`/`blocked` sem outputs, `partial` com outputs reais, `cancelled`/`unknown` conforme regras; sem artefato fictício em falha.
4. `ValidationResult.status` igual à agregação calculada (§3.7) em todos os casos, incluindo `checks=[]`.
5. `ConsistencyAssessment` obedece às regras de `running`/supersessão/cobertura `Locked` (§3.11); `running` nunca é evidência.
6. As pré-condições CAS de §4.3 e §4.5 constam da interface futura de Store; a alternativa de revogação escolhida (`revoke` ou `reject` superseding) tem fixtures; nenhuma aprovação/revogação edita histórico.
7. `membersDigest` presente/bem formado em `ArtifactVersion`; payload e canonicalização só após a decisão §11, item 4 — até lá, digests de exemplo permanecem esquemáticos.
8. Rights/consent: 7 chaves de `uses` obrigatórias; coerência `rightsStatus`↔`uses`; matriz §3.17 documentada nos gates futuros; separação promoção interna × publicação externa demonstrada em fixtures; `revoke` de consent com escopo idêntico; envio remoto exige rights **e** consent.
9. Todos os exemplos JSON desta spec são coerentes com os schemas propostos, usam IDs sintéticos sem colisão entre blocos e identificam explicitamente fragmentos incompletos; nenhuma compatibilidade com arquivos/formatos reais é declarada.
10. Nenhum default foi inventado para decisões abertas: cada item `OPEN` da §11 permanece visível e bloqueante até resposta humana.
11. Fronteiras preservadas: Domain sem filesystem/rede/relógio externo/runtime; testes futuros offline; `.spriteforge/` e formatos legados intactos e read-only.
12. A revisão independente da Arena do primeiro pacote de código termina antes de qualquer próxima fase. **Esta revisão documental não autoriza implementação.**
13. Todo campo exigido por regra normativa existe na tabela do contrato com tipo, obrigatoriedade e nulabilidade definidos; toda referência polimórfica tem união explícita (correções 22, 27, 28, 33) — nenhum tipo fica descrito apenas em prosa.
14. Nenhum campo core nomeia ferramenta, software, provider, renderer ou destino específico; ferramenta observada aparece só em `environment.toolVersions`/`toolRefs`; destinos de consumo não criam tipo de domínio, identidade nem origem separados; estado especializado por propriedade vive em `AssetVersion` (§8.1–§8.3; §9.3 invariantes 9–11).
15. Requisitos da proposta consolidada sem campo próprio têm lugar designado ou pendência registrada (§8.1–§8.3, §13.4, R16–R25); blocos de exemplo são cenários separados e não formam um grafo único (§5, §9.2).
