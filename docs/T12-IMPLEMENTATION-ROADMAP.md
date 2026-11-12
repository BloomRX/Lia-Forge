# T12 — Roadmap de implementação por dependências reais

> **Estado:** `PROPOSED — REQUIRES_HUMAN_DECISION`. Nenhuma fase foi iniciada; nenhuma estimativa de calendário é feita (não há base).
> **Data:** 2026-11-12 (UTC). **Base:** auditoria de código da T12 + estado final da T11 (`2f41360`).
> **Relação com o roadmap existente:** estas fases **não substituem** [`MASTER-ROADMAP.md`](MASTER-ROADMAP.md) (M0–M11). Elas **ordenam** os itens de M0–M11 por dependência real observada no código e acrescentam pré-requisitos, critérios de aceite, testes e riscos verificáveis. Cada fase indica os marcos M correspondentes.
> **Esforço relativo:** `S` (dias de trabalho focado) · `M` (semanas) · `L` (meses) — **ordem de grandeza, não calendário**.

---

## 0. Classificação de escopo

| Classe | Significado | Itens |
|---|---|---|
| **Núcleo obrigatório** | sem isso a arquitetura declarada não se sustenta | F0, F1, F2, F3 |
| **Necessário para a primeira versão funcional** | produz valor verificável ao usuário | F4, F5 |
| **Expansão futura** | amplia sem bloquear a primeira versão | F6, F7 |
| **Pesquisa opcional** | continua a ser pesquisa até decisão humana | F8 |

---

## Fase 0 — Reconciliação do repositório e estabilização dos contratos

**Classe:** núcleo obrigatório · **M:** M0 · **Esforço:** `S`

| Item | Conteúdo |
|---|---|
| **Pré-requisitos** | nenhum; é a base de tudo |
| **Entregáveis** | (a) decisão sobre publicar os **12 arquivos** e as **24 divergências** do worktree (D1) ou declarar o worktree fonte de verdade; (b) `domain-contracts-smoke.mjs` na cadeia `npm test` (D2); (c) registro explícito de que **13 documentos publicados citam código ausente da árvore publicada**; (d) decisão sobre `generate_third_party_notices.py:36` (D13) |
| **Critérios de aceite** | clone novo da branch contém todo o código citado pelos documentos publicados; `npm test` executa os smokes que existem; nenhum documento aponta para arquivo inexistente; os 7 documentos divergentes **não** são sobrescritos sem decisão |
| **Riscos** | publicar trabalho preexistente sem revisão; perder a distinção entre "o que o agente fez" e "o que o usuário fez"; sobrescrever os 7 docs divergentes |
| **Testes** | 13 smokes Node + 30 Python continuam com o mesmo resultado (1 falha pré-existente); verificador de links relativos em `docs/` = 0 quebrados; diff entre worktree e árvore = 0 após a reconciliação |
| **Dependências** | decisão humana D1/D2/D13 |
| **Valor desbloqueado** | qualquer auditoria futura (humana ou de agente) parte de um clone verdadeiro |

---

## Fase 1 — Capability Registry (dados puros, versionados)

**Classe:** núcleo obrigatório · **M:** M0/M4 · **Esforço:** `S`–`M`

| Item | Conteúdo |
|---|---|
| **Pré-requisitos** | Fase 0; ADR do formato de capacidade |
| **Entregáveis** | catálogo versionado em `shared/capabilities/` com os ids da matriz T12 §1 (`image2d.*`, `rig2d.*`, `model3d.*`, `motion.*`, `render.*`, `character.*`, `ui2d.*`, `vfx2d.*`, `export.*`), requisitos por capacidade e validadores associados; **sem** vínculo permanente a ferramenta |
| **Critérios de aceite** | capacidade existe no catálogo mesmo sem provider; nenhuma capacidade nova é criada sem justificativa registrada; o catálogo não introduz enum global de tipos de asset (regra de `createAssetTypeCatalog`); nada no runtime muda de comportamento nesta fase |
| **Riscos** | duplicar o catálogo com `adapterRole` de `workflow-contracts.cjs`; congelar o domínio experimental; confundir capacidade com provider |
| **Testes** | unit: catálogo vazio/inválido/duplicado/versão incompatível; ids fora do padrão rejeitados; snapshot de compatibilidade (catálogo antigo continua legível); regressão: 13 smokes intactos |
| **Dependências** | `shared/domain/contracts.mjs` (padrão de módulo puro já estabelecido) |
| **Valor desbloqueado** | Orchestrator e Hub passam a ter o que consultar; UI pode mostrar "capacidade existe, provider ausente" em vez de esconder |

---

## Fase 2 — Adapter SDK e migração dos 2 adapters atuais

**Classe:** núcleo obrigatório · **M:** M4 · **Esforço:** `M`

| Item | Conteúdo |
|---|---|
| **Pré-requisitos** | Fase 1; ADR do contrato de adapter (D4) |
| **Entregáveis** | contrato `discover() · validateCapability() · estimateEffects() · execute(ctx, signal) · reconcile(jobId) · validateOutputs() · dispose()`; manifestos dos adapters `blender-spritesheet` e `comfyui-concept` com os 15 campos da matriz T12 §3; adapters movidos das closures de `main.cjs:47-104` para `electron/adapters/` |
| **Critérios de aceite** | os 2 adapters atuais **passam nos mesmos smokes** após migrar; adapter sem `discover` é rejeitado no registro; nenhum adapter usa shell genérico (`shell:false` preservado); segredos continuam fora de logs/plano/artefatos; as três classes (execução / edição manual / serviço remoto) estão explícitas no manifesto |
| **Riscos** | migrar e quebrar o único caminho de produção que funciona (G); criar adapter por nome de ferramenta; manifesto virar "shell command ilimitado" sem política |
| **Testes** | smokes atuais (regressão); contrato: adapter inválido, `estimateEffects` sem custo conhecido, `reconcile` inexistente em serviço remoto; segurança: redação de token/key/URL; integração simulada identificada **como simulada** |
| **Dependências** | Capability Registry |
| **Valor desbloqueado** | adicionar provider deixa de exigir edição do processo principal; base para Hub e para backends |

---

## Fase 3 — Environment Preflight (hardware real) e QA Toolkit compartilhado

**Classe:** núcleo obrigatório · **M:** M2/M7/M10 · **Esforço:** `M`

| Item | Conteúdo |
|---|---|
| **Pré-requisitos** | Fase 2 |
| **Entregáveis** | (a) `probe()` com `os, cpu, ram, gpu[], vram, disk, runtimes, apis` + `evaluate(requirements, probe) → supported \| unsupported \| unknown`, estendendo o `doctor` existente (**sem criar um segundo doctor**); (b) integração do coletor Windows somente leitura da T11 (`tools/diagnostics/t11-windows-hardware-vulkan-preflight.ps1`) como fonte de evidência, **não** como execução automática; (c) extração das checagens de conteúdo de `local-renderer-test/scripts/verify-output.cjs:128-142` para `shared/validators/`, com flag **desligada** na produção (D3) |
| **Critérios de aceite** | GPU ausente → `unknown`, nunca `supported`; `code-present` ≠ `verified` (DirectML/ROCm); recusa por memória é **nomeada** (recurso, limite, valor medido); separação RAM × VRAM × disco; alpha zero por célula = inválido; variação zero em walk/run = inválida; **fundo opaco não é exigido**; os 3 controles negativos da T10 continuam corretos |
| **Riscos** | falso positivo de compatibilidade por família de API; falso negativo que bloqueie o alvo sem medição; mudar comportamento de produção sem autorização |
| **Testes** | unit com fixtures de probe (sem GPU, GPU sem VRAM conhecida, disco cheio); regra `unknown`; validadores: atlas transparente, atlas com variação zero, atlas válido, PNG opaco de fundo; harness E3 continua reproduzível com hashes idênticos |
| **Dependências** | Adapter SDK (requisitos declarados por passo) |
| **Valor desbloqueado** | bloqueio antes de falhar (G3) e fim da lacuna de conteúdo (G8) |

---

## Fase 4 — Asset Manager + Provenance & Rights (identidade, versões, relações)

**Classe:** necessário para a primeira versão funcional · **M:** M2 · **Esforço:** `M`–`L`

| Item | Conteúdo |
|---|---|
| **Pré-requisitos** | Fases 1–3; gate de implementação do ADR-001 (contratos puros + testes primeiro); spec sair de `DRAFT_FOR_HUMAN_REVIEW` |
| **Entregáveis** | mapper **read-only** do legado `.spriteforge/assets.json` (2 tipos, 5 etapas, `startStageIndex`, `existingInputs`, campos desconhecidos preservados) para `Project/Asset/Artifact/AssetVersion/Provenance/ValidationResult`; Artifact Manager (`put/get/relate` com SHA-256); Provenance & Rights unificando o que hoje está em 3 lugares (`contracts.mjs`, `spriteforge_launcher.py`, manifestos `local-renderer-test/`) |
| **Critérios de aceite** | `.spriteforge/` **não** é migrado nem sobrescrito; bytes/sidecars/campos desconhecidos preservados; `consent ≠ license`; `NOASSERTION ≠ sem licença`; código derivado de restrito herda restrição; `HumanReview=approve` só sobre refs/hashes exatos move `currentVersionId` (ADR-001 decisão 2); alternativas/incompletas/rejeitadas permanecem preservadas |
| **Riscos** | migração destrutiva; assumir identidade compartilhada (alternativa A) sem decisão (D12); transformar protótipo puro em engine visual |
| **Testes** | os listados em [`DOMAIN-CONTRACTS-AUDIT.md`](DOMAIN-CONTRACTS-AUDIT.md) §testes: round-trip, referências inexistentes, hash divergente, MIME/format mismatch, path traversal, symlink, limites, crash na escrita, atomicidade, fixtures de compatibilidade com rollback sem tocar originais |
| **Dependências** | Capability Registry (tipos extensíveis), QA Toolkit (ValidationResult) |
| **Valor desbloqueado** | workflows C, F e I deixam de ser possíveis só "por fora"; revisão humana passa a ser por versão e hash |

---

## Fase 5 — Provider Hub + Workflow Runtime DAG + primeiro workflow novo

**Classe:** necessário para a primeira versão funcional · **M:** M3/M4/M6/M9 · **Esforço:** `L`

| Item | Conteúdo |
|---|---|
| **Pré-requisitos** | Fases 1–4 |
| **Entregáveis** | (a) Hub com catálogo/descoberta/manifestos/compatibilidade/versões/licenças/health checks; (b) evolução do runner serial para **DAG**: ordenação topológica, `readySet`, subgrafo por ponto de entrada, paralelismo apenas sem conflito de recurso, retry **somente** com semântica declarada (`pure/idempotent/deduplicated_by_provider/non_idempotent/unknown`), timeout, estados `out_of_scope`/`reused_from_version`/`needs_reconciliation`, `reconcile(jobId)`; (c) Orchestrator propondo rotas com justificativa (custo, hardware, licença, qualidade) **sem executar**; (d) **um** workflow novo ponta a ponta — recomendação: **A (2D Art)** por reusar o adapter ComfyUI existente, ou **G** para fechar a lacuna de conteúdo com asset próprio |
| **Critérios de aceite** | `dependsOn` deixa de ser "aparece antes" e passa a agendar; gates de autorização/revisão preservados **exatamente** como hoje; cancelamento continua abortando o processo filho; retomada reutiliza só com fingerprint + SHA-256; nenhum provider é chamado sem autorização; etapa sem adapter continua `BLOCKED`; contrato de spritesheet 384×144/8×3/24/48×48 preservado |
| **Riscos** | quebrar o único caminho funcional ao migrar o runner; paralelismo causar conflito de GPU/arquivo; retry duplicar efeito pago; Orchestrator virar segundo executor |
| **Testes** | os de [`WORKFLOW-ENGINE.md`](WORKFLOW-ENGINE.md) §aceite: ciclo, nó órfão, grafo grande, subgrafo por entrada intermediária, conflito de recurso, ramos independentes, crash antes/depois de enviar, timeout, restart, reconciliação sem chamada duplicada, fixtures de input alterado/corrompido/symlink/output parcial/revisão rejeitada |
| **Dependências** | Adapter SDK, Preflight, Asset Manager |
| **Valor desbloqueado** | workflows B–F e I–J tornam-se executáveis por composição, não por código novo por fluxo |

---

## Fase 6 — Execution Backend remoto/híbrido (Workflow J)

**Classe:** expansão futura · **M:** M3/M10 · **Esforço:** `M`–`L`

| Item | Conteúdo |
|---|---|
| **Pré-requisitos** | Fase 5; decisão D8 (qual backend, teto de custo); gestão de credenciais (**hoje inexistente**, C29) |
| **Entregáveis** | Execution Manager (`selectBackend`, `transfer`, `budget` com recusa nomeada); transferência com hash antes/depois; `reconcile` para efeitos remotos ambíguos; limpeza apenas de temporários da Forge; templates de Colab/GPU alugada **fora** do repositório de produção (T9 §5) |
| **Critérios de aceite** | nenhum upload sem gate explícito (padrão já implementado no ComfyUI remoto); custo `unknown` exige confirmação consciente; teto de custo para a execução; credenciais fora de frontend/plano/logs/artefatos; estado `needs_reconciliation` quando o efeito remoto é incerto; uma etapa pode usar backend diferente de outra |
| **Riscos** | custo descontrolado; retenção de dados de terceiro; duplicação de efeito pago; credenciais em repositório |
| **Testes** | crash após enviar (sem duplicar), timeout, restart com reconciliação por `jobId`, hash divergente na volta, teto de custo excedido, limpeza seletiva |
| **Dependências** | Hub, DAG, Preflight, Asset Manager |
| **Valor desbloqueado** | rotas 3D inviáveis no alvo (RX 580) tornam-se possíveis sem trocar de arquitetura |

---

## Fase 7 — 2D/2.5D, Comparison Lab, Skills e destinos

**Classe:** expansão futura · **M:** M5/M7/M8/M9/M11 · **Esforço:** `L`

| Item | Conteúdo |
|---|---|
| **Pré-requisitos** | Fases 1–5; decisões D6 (Spine), D7 (licenças 2D/motion), D11 (capacidades T11) |
| **Entregáveis** | adapters 2D (separação de camadas, rig 2D, animação 2D assistida, composição modular, UI/VFX); perfis de destino (Godot/Unity/Unreal/Lia Desktop/vídeo/docs) sem duplicar geração; Comparison Lab (mesma entrada/hash/rubrica); Skill/Knowledge Catalog **sem autoridade de execução**; release/instalador validado no Windows |
| **Critérios de aceite** | Spine permanece referência, não dependência, salvo decisão; nada com licença não comercial entra em fluxo comercial; imagem→vídeo nunca substitui rig editável; skills não executam; score não substitui aprovação humana; instalador NSIS validado em Windows real (G15) |
| **Riscos** | adotar ferramenta ★0/★1 sem execução independente; criar módulo "Spine/AI Animation/2D Studio"; pipeline duplicado por destino |
| **Testes** | execução independente de cada candidato antes de recomendação; gates humanos de máscara/junta/keys; comparação reprodutível; build/instalador no alvo |
| **Dependências** | tudo acima |
| **Valor desbloqueado** | produção 2D/2.5D/UI/VFX e múltiplos destinos com um só pipeline |

---

## Fase 8 — Pesquisa contínua (não é fase de implementação)

**Classe:** pesquisa opcional · **Esforço:** contínuo

Itens que **permanecem pesquisa** até decisão humana: probe Vulkan res-512 no alvo (D9); primeiro render E3 com asset próprio (D10); execução independente de `2DAutoRigger`, `OpenBone`, `see-through`, `motion-bricks.cpp`, `kimodo.cpp`; verificação de preços de Spine/Rive/Live2D/APIs; custos do capítulo *Cost* do vídeo T11 (lacuna de transcrição); alternativa A de identidade compartilhada (D12); capacidades de ambiente/splats/áudio/vídeo (fronteiras 2.2–2.5).

---

## 1. Resumo de ordenação

| Ordem | Fase | Classe | M | Esforço | Pré-requisito duro | Desbloqueia |
|---|---|---|---|---|---|---|
| 1 | F0 Reconciliação e contratos | núcleo | M0 | `S` | decisão D1/D2 | auditoria verdadeira |
| 2 | F1 Capability Registry | núcleo | M0/M4 | `S`–`M` | F0 | Orchestrator/Hub |
| 3 | F2 Adapter SDK | núcleo | M4 | `M` | F1 + D4 | novos providers sem tocar o core |
| 4 | F3 Preflight + QA Toolkit | núcleo | M2/M7/M10 | `M` | F2 | bloqueio por hardware e fim da lacuna de conteúdo |
| 5 | F4 Asset Manager + Rights | 1ª versão | M2 | `M`–`L` | F1–F3 + gate ADR-001 | versões, relações, revisão por hash |
| 6 | F5 Hub + DAG + 1º workflow novo | 1ª versão | M3/M4/M6/M9 | `L` | F1–F4 | composição de workflows |
| 7 | F6 Backend remoto/híbrido | expansão | M3/M10 | `M`–`L` | F5 + D8 + credenciais | rotas 3D inviáveis no alvo |
| 8 | F7 2D/2.5D, Lab, Skills, destinos | expansão | M5/M7/M8/M9/M11 | `L` | F1–F5 + D6/D7/D11 | produção 2D e multi-destino |
| — | F8 Pesquisa contínua | pesquisa | — | contínuo | decisões | evidência para decidir |

## 2. O que este roadmap não faz

Não estima calendário, não inicia implementação, não autoriza instalação/download/gasto/envio, não escolhe provider, backend, renderer padrão ou banco, não altera contratos nem schemas, não aprova prioridade (D5 é humana), não cria módulo novo e não promove pesquisa a capacidade.
