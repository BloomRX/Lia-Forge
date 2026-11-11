# Lia Forge — roadmap M0–M11

> **Estado:** roadmap-alvo solicitado pelo usuário. IDs são marcos de planejamento, não releases, datas ou sequência waterfall. Não há funcionalidade nova implementada por este documento. Escolha de priorização e autorização seguem [`DECISIONS-AND-OPEN-QUESTIONS.md`](DECISIONS-AND-OPEN-QUESTIONS.md).

## Como ler o roadmap

- **Parallel-ready:** marcos podem avançar lado a lado se contratos/policies forem estáveis.
- **Dependency:** predecessores lógicos necessários para a capability, não necessariamente toda a roadmap.
- **Exit criteria:** evidência verificável, não status de UI.
- **Slice releases:** uma rota de valor pode ser entregue antes das outras se passar seus próprios gates; `M11` não exige que toda ideia esteja completa.
- Não estimar data/custo/hardware sem medição e dados do target.

## M0 — Evidência, estado e contratos de produto

**Objetivo:** manter visão, implementação e alvo claramente separados; mapear capability e gates atuais.
**Inclui:** vocabulário de estados; baseline/architecture map; contracts e versioning plan; inventário de assets/rotas; threat/privacy/license constraints; link de evidência por capability.
**Dependências:** nenhuma; funciona como trilha crosscutting.
**Saída verificável:** auditoria atualizada para cada mudança; glossary consistente; teste de docs/links; acceptance criteria que distinguem mock/synthetic/real/human review.
**Situação documental:** este snapshot registra o baseline; não altera código.

## M1 — Forge Studio e workspace multi-categoria

**Objetivo:** transformar a interface em estúdio de projetos/asset families, não só uma rota 3D→2D.
**Inclui:** create/import/select project, browsing artifacts real, categories extensible, brief/target/route, entry stage, edit/convert/duplicate, approval prompts, current action/status, export/accessibility.
**Depends on:** M0; pode correr em paralelo com contratos M2.
**Exit:** fixtures de personagem/prop/2D/environment e category extension; operator consegue iniciar desde asset intermediário sem marcar predecesores completos; nenhum fake preview promove status.

## M2 — Asset Manager, lineage, provenance e versioning

**Objetivo:** assegurar que edição/retomada/export não percam arquivos nem rights.
**Inclui:** project/asset/version/artifact/run IDs; immutable provenance; source/derived relations; hash; license/consent; change history; backup/migration/export/reimport.
**Depends on:** M0; alimenta M3/M7/M8/M9; pode começar junto de M1.
**Exit:** migrar schema com report/rollback; reabrir project offline; detectar arquivo alterado por hash e pedir reconcile; output aponta para inputs, tool/provider/version e review.

## M3 — Workflow Engine DAG

**Objetivo:** evoluir runner serial para grafo confiável com entry point, pausa, cancelamento, retry consciente e resume/reconciliation.
**Inclui:** versioned contracts, DAG validation, scheduler/resource locks, event log/snapshots, idempotency, parallel independent nodes, subgraph run, safe re-use, timeout/remote-job reconcile.
**Depends on:** contract baseline M0, data model M2; adapter contract pode avançar paralelo a M4.
**Exit:** tests para ciclos, branching, stage intermediate, partial outputs, crashes antes/depois de side effect, retries, checksum/contract changes e restart sem duplicate call.

## M4 — Tool / Provider Hub

**Objetivo:** registrar/detectar tools/providers/adapters como capabilities versionadas e controladas.
**Inclui:** manifest, source/commit/license, local/remote, OS/runtime/hardware evidence, capabilities, costs/data, secrets, installer consent, compatibility, conformance tests, disable/revoke.
**Depends on:** M0 contracts; interfaces alinham com M3; segurança pode ser implementada junto a M10.
**Exit:** provider offline no core; fake adapter tests não fazem rede; nenhuma API/instalação/download/custo sem gate; real E2E para capability anunciada.

## M5 — Skills & Knowledge Engine

**Objetivo:** tornar guias/checklists selecionáveis, versionados e offline-friendly, sem confundi-los com providers/workflows.
**Inclui:** skill manifest/source/license/hash/trust, routing, knowledge versioning, update diff, disable/rollback, policy para untrusted content e tool prerequisites.
**Depends on:** M0 trust/rights rules; pode correr em paralelo a M1–M4.
**Exit:** nenhuma skill pode autorizar side effect; source/version pin; injection/security tests; offline skill path; curadoria legal/security.

## M6 — Intelligent Orchestrator

**Objetivo:** propor DAGs e alternativas adequadas ao pedido, arquivos e capabilities descobertas.
**Inclui:** structured task extraction, category/route planner, hardware/rights/cost constraints, capability matching, alternatives/fallbacks, scope diff, explanations e approval screen.
**Depends on:** M2 artifacts; M3 contracts/engine; M4 capability data; M5 knowledge optional. Base deterministic offline deve existir sem agente/LLM.
**Exit:** deterministic fixtures; route works from any eligible stage; unknowns/blockers explicados; plano nunca dispara operação antes de usuário iniciar; LLM/agente pode ser removido sem quebrar o Studio.

## M7 — Visual QA e human review

**Objetivo:** criar checks por categoria e um fluxo auditável de revisão humana.
**Inclui:** validators format-specific; 2D contact sheets/alpha/frames, 3D geometry/UV/rig/action checks, environment/layer checks; review object, approvals tied to hashes; human comparison.
**Depends on:** M2 artifact/version model; pode avançar paralelo a M3/M4 em contratos.
**Exit:** fixtures positivas/negativas; reviewer vê arquivo real em escala/contexto; edição invalida approval; structural `pass` não implica art quality.

## M8 — Benchmark e comparação

**Objetivo:** medir múltiplas rotas/providers sob condições comparáveis e registrar resultados honestos.
**Inclui:** run group, input fingerprints, seeds/versions/environment, real cost/time, outputs/QA, blinded human pairwise evaluation, uncertainty and limits.
**Depends on:** M2 provenance, M3 runs, M7 evidence; pode iniciar protocolo/fixtures antes da UI.
**Exit:** benchmark reproduzível; `unknown`/missing data preservados; comparações sem equivalência de inputs assinaladas; metrics separadas de revisão humana; dataset rights autorizados.

## M9 — Recipes multi-categoria e rotas

**Objetivo:** oferecer pipelines independentes por objetivo, sem obrigar a rota 3D.
**Inclui:** Brief→2D; prioridade primeira fatia humanoide estilizado corpo inteiro; Brief→3D→Rig→Animação→Spritesheet; Manequim→2D; code/procedural→2D/3D; image→3D; existing asset edit/convert; environment static/layer/parallax; extensões futuras.
**Depends on:** M2 inputs/artifacts e M3 contracts; M4 adapters por rota; M7 criteria. Implementar fatias por capability, não uma migração monolítica.
**Exit:** cada recipe tem outputs reais, checks, permissions, fallback e review; rotas no-product não aparecem como executáveis; começando no meio não roda etapas anteriores.

## M10 — Segurança, privacidade, execução local/offline

**Objetivo:** garantir blast radius mínimo e operação local-first.
**Inclui:** subprocess isolation, file/network permissions, secret handling, permissions per side effect, package signatures/provenance, telemetry default off, resource/time/size quotas, offline mode, revoke/cleanup.
**Depends on:** crosscutting from M0; implementação paralela a M3/M4/M5.
**Exit:** threat model e tests; deny by default; network/telemetry off unless explicit; local runs don’t require an agent/account; remote endpoint/cost/upload shown and consented; no assumption of acceleration hardware.

## M11 — Release, platform matrix e estabilidade declarada

**Objetivo:** transformar slices comprovados em releases com limites e rollback.
**Inclui:** package/installer tests on declared OS; upgrade/uninstall/data preservation; supported tool/provider version matrix; docs/notices; E2E user acceptance; human visual review; fallback, crash reporting policy.
**Depends on:** somente os marcos requeridos pela slice/release escolhida; não depende de todos os pipelines M9 concluídos.
**Exit:** teste real reproduzível na combinação anunciada; evidence artifact; no unverified license/provider; release notes separate `EXPERIMENTAL`/`BETA`/`STABLE`; rollback tested; support limitations disclosed.

## Dependências e execução paralela

```text
                         ┌── M1 Studio ─────────────────────┐
M0 Evidence/contracts ──┼── M2 Asset/provenance → M3 Graph ├── M9 Recipes ── slice-specific M11
                         ├── M4 Hub ────────────────────────┤
                         ├── M5 Skills ───────┐             ├── M7 QA → M8 Benchmark
                         ├── M10 Security ─────┴→ M6 Planner ┘
                         └────────────── cross-cutting gates throughout ───────────────┘
```

Exemplo de slicing paralelo (não decisão de release):

- **Local render slice:** M0 + (reuso pontual M2/M3) + M7 + M10 + target-platform M11; validar um modelo existente→spritesheet sem esperar por generation provider.
- **2D slice:** M1/M2 + uma capability local/remota devidamente aprovada M4 + contracts M3 + 2D QA M7; não aguardar rig/3D.
- **Humanoid slice:** prioridade de produto; requer capabilities reais por subetapa e license/hardware review; pode demonstrar bloqueio/alternativas sem simular geração.
- **Skills/benchmark:** M5 e protocolo de M8 podem avançar em paralelo, mas só avaliam runs com outputs reais autorizados.

## Critério global de progresso

Um marco passa por evidência reprodutível e limite declarado, não por checklist de código. Build/test de mock, escrita de documentação, repo star count, setup screen ou provider catalog não são E2E. Toda mudança de estado atualiza a auditoria, as aprovações e o README; nenhum checkpoint apaga o baseline ou arquivos do usuário.
