# Lia Forge — decisões e perguntas em aberto

Use rótulos diferentes para requisitos, escolhas já feitas e recomendações. Este registro complementa [`memory-bank/decisoes.md`](../memory-bank/decisoes.md); não apaga nem altera a fonte anterior. Mudanças que alterem produto, permissões, licença, stack ou dados precisam aprovação explícita e registro de data/evidência.

## Confirmado pelo usuário

| # | Requisito confirmado | Consequência de arquitetura |
|---|---|---|
| 1 | Suportar personagens, itens/armas/ferramentas, sprites/animações 2D, modelos/rig/animação 3D, ambientes/cenários e novas categorias extensíveis. | Tipos/rotas são contracts extensíveis; personagem/item não podem ser enum universal. |
| 2 | Rotas incluem Brief→2D; Brief→3D→Rig→Animação→Spritesheet; Manequim→2D; código/procedural→2D/3D; imagem→3D; edição/conversão de assets existentes. | Recipes independentes, não pipeline obrigatório; cada uma é executável só quando adapters existem. |
| 3 | Iniciar em qualquer estágio compatível e retomar sem regenerar trabalho anterior. | Stage inputs/artefatos existentes, fingerprints, retomada segura e estados predecessores `out_of_scope`/`reused`; nunca falso `completed`. |
| 4 | Prioridade anterior é humanoide estilizado de corpo inteiro. | Vertical slice prioritária, não limitação do core a humanoides ou 3D. |
| 5 | Provider-neutral; local e cloud possíveis. Agentes opcionais. Sem internet permanente, conta ou provider obrigatório. | Capabilities/Hub separados; core e modo offline utilizáveis sem agentes e sem cloud. |
| 6 | Não simular progresso, outputs, testes ou métricas. | Evidência real/escopo explícito; progresso só por eventos/medições; mocks marcados como mocks. |
| 7 | Revisão estrutural não substitui revisão visual humana. | QA humano requerido em etapas artísticas; `VERIFIED` escopado e amarrado a hash/version. |
| 8 | Usuário controla instalações, downloads, custos, autorizações, uploads e licenças. | Consentimentos separados e explícitos; nada instalado/downloaded/called/uploaded/charged sem permissão correspondente. |
| 9 | Não presumir AMD/Vulkan/CUDA/CPU; não afirmar Vulkan nativo do ComfyUI sem prova. | Hardware/provider support só após evidence do adapter/target. `unknown` é estado válido. |
| 10 | Nenhuma implementação/refatoração/dependência nesta missão; não clonar projetos/baixar assets; preservar arquivos; sem mudanças destrutivas ou commit/push. | Esta tarefa é documentação-only e não modifica tracking, packages ou artefatos preexistentes. |
| 11 | O teste do renderer Mixamo/Blender anterior é tarefa separada e não deve ser retomado nesta missão. | `local-renderer-test/` não é rodado/reaberto como tarefa de produção aqui; documentação prévia permanece referenciada apenas como histórica. |

## Estado/decisões já registrados em documentos existentes

- `memory-bank/decisoes.md` declara local-first/autonomia da Waifu, agentes opcionais, `models: []`, regras de licença e paths; manter links com `docs/lia-ecosystem-integration.md`.
- O usuário ainda não selecionou provider/modelo para views/3D/rig/animation. O pipeline contratual permanece bloqueado; não escolher um provider em seu nome.
- O workspace current audit divergia da memória de push anterior. Nenhuma limpeza/rebase/stage/commit/push foi autorizada.

## Propostas técnicas — não são decisões de produto

| # | Proposta | Por que | O que ainda precisa de decisão |
|---|---|---|---|
| P1 | Usar `Capability`/`Adapter`/`Provider`/`Workflow`/`Skill`/`Agent` como entidades distintas. | Evita que lista de apps/skills pareça integração executável. | Revisar termos/versioning com schema existente. |
| P2 | Workflow Engine DAG com `entryNode`, contracts, event log, idempotency e reconciliation. | Branches independentes, retomada e external effects. | Back-end de persistência, execution workers, version policy e concurrency. |
| P3 | Asset graph/version store com immutable artifacts e provenance sidecars. | Preservar origem e comparar sem sobrescrever. | Backend (JSON/SQLite/etc.), export, encryption/backup/retention. |
| P4 | Deterministic/offline planner fallback; LLM/agente opcional. | Evita account/network dependency e mantém explicabilidade. | Se/como local model suportado; no model selection nesta tarefa. |
| P5 | Skill catalog com provenance/trust, curadoria e default no auto-exec. | Reutilizar conhecimento sem prompt injection/autoinstall. | Approved sources, review process, update/signing and license policy. |
| P6 | Benchmark separa métricas, human ratings e unknown; no rankings until dataset criteria. | Não fabricar claims ou comparar entradas desiguais. | Metrics, dataset, reviewers, min sample policy. |

## Perguntas em aberto

1. **Primeiro release/slice:** qual workflow a pessoa quer provar primeiro além da prioridade humanoide: Brief→2D, modelo existente→spritesheet ou outra rota? As slices podem correr em paralelo.
2. **Targets de sistema operacional:** quais plataformas, versões Blender/ComfyUI e engines serão anunciadas após validação real? O setup documentado no checkout ainda não prova suporte Windows.
3. **Categoria vs route model:** taxonomia ampla mínima e esquema de extensões; quais saídas/engines são indispensáveis na primeira fatia?
4. **Registry/plugin API:** instalação de plugin local, assinatura/provenance, semver, compatibility range, isolation boundary, e se plugins são primeiro-party ou user-supplied.
5. **Storage:** JSON snapshots, database, filesystem manifest ou híbrido; encryption, backups, retention, cloud sync e migration policy.
6. **Provider selection:** quais providers locais/cloud o usuário quer avaliar para cada capability; custo, privacy, terms, model license e target hardware devem ser comparados antes.
7. **Hardware:** quais máquinas/requisitos serão suportados e como probes serão validados? Até lá, nenhuma recomendação AMD/Vulkan/CUDA/CPU se trata como compatibilidade.
8. **Consent UX:** granularidade de aprovação (per action/node/provider/session), unknown price, endpoint regions/data retention e operação paga; recomendação é aprovação de escopo, não consentimento genérico.
9. **Credentials:** OS credential store? profile per project/provider? export/import and rotation? Nenhum segredo deve ficar em project JSON.
10. **Review/evidence:** quais reviewers/roles; quais imagens/screenshots podem ser guardadas; critérios específicos de humanoide, pixel-art, ambiente e engine import.
11. **License rights:** formato de rights manifest, como provar compra/permission; processos para licenses custom (incluindo Hunyuan) e media de repositório.
12. **Benchmark:** quais datasets/fixtures são permitidos, como anonimizá-los, quem pode executar, thresholds/uncertainty e quando publicar comparisons.
13. **Agentes/MCP:** quais hosts/clients suportar; se agentes podem ler output, editar arquivos, executar tools; quais permissões revogáveis. Ainda precisam ser opcionais.
14. **Telemetry/crash data:** default off, escolha explícita por tipo de dado, redaction/retention/storage; princípio do usuário é autonomia sem upload implícito.
15. **`EXPERIMENTAL`/`BETA`/`STABLE`:** revisão/aprovação por capability e combination matrix; definir owner e políticas de rollback.

## Decisões que esta missão não toma

Não escolhe um modelo/provider, serviço cloud, runtime de IA, biblioteca de agente, framework de workflow, plugin format final, banco de dados, hardware mínimo, licenças de terceiros, orçamento, route order, release date, ou troca de `.spriteforge/`. São questões futuras; o roadmap é não linear em [`MASTER-ROADMAP.md`](MASTER-ROADMAP.md).