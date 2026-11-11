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

## Perguntas em aberto acrescentadas pela pesquisa de 2026-11-11

Continuam a numeração da lista anterior. Todas nascem da leitura dos itens 13 a 16 de [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md), da matriz cruzada em [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md) e da seção de consistência em [`PRODUCT-ARCHITECTURE.md`](PRODUCT-ARCHITECTURE.md). **Nenhuma tem default proposto**; nenhuma foi decidida nesta missão.

16. **Vídeo como capacidade ou só como destino:** vídeo/streaming já é destino de consumo possível. Entra também como **categoria/rota de produção** (trailer, cinematic, showcase)? Se sim, [`heygen-com/hyperframes`](https://github.com/heygen-com/hyperframes) (Apache-2.0, sem GPU/CUDA) é o backend opcional a avaliar — com Node 22+, FFmpeg e Chrome headless instalados só após consentimento, **telemetria desligada por padrão** e cloud render excluído do caminho padrão?
17. **Contrato de mídia temporal:** se vídeo virar capacidade, qual contrato, validador e gate de QA (codec, fps, duração, resolução, trilhas de áudio, pureza determinística)? A especificação de Domain Contracts v1 **não** tem entidade de mídia temporal, e nada pode ser acrescentado sem aprovação.
18. **Gaussian splats:** `.spz` entra no escopo de asset da Forge (ingestão, inspeção, validador, export, proxy de colisão) ou ambientes permanecem em malha/imagem/camadas? Formatos são capacidades, não dependências de software — mas exigem validador e decisão de escopo.
19. **Áudio e SFX:** áudio é escopo da Forge ou apenas do destino? Se for escopo: categoria, formatos (`.mp3`/`.opus`/`.wav`), validador de duração/loop, vínculo ao asset por relação e provider — todos os candidatos observados são cloud e pagos.
20. **Nó de *staging* de cena (Scene Composer):** compor câmera, pose, posicionamento, camadas e máscaras **antes** da geração vira um nó de `WorkflowPlan` (caminho recomendado, reusa a rota `Manequim → 2D` já documentada) ou uma entidade própria? Quem escreve esses dados — usuário, agente ou provider — e como são versionados?
21. **Contrato compartilhado de identidade/consistência Lia Studio ↔ Lia Forge:** alternativa **A** (núcleo compartilhado versionado + projeções por produto), **B** (dois contratos independentes + mapeador explícito) ou **C** (contrato único do Studio, consumido read-only)? Quem é o dono do núcleo? Qual a **precedência** quando as projeções discordam sobre o mesmo trait? (Alternativas e consequências em [`PRODUCT-ARCHITECTURE.md`](PRODUCT-ARCHITECTURE.md).)
22. **Limites de contrato que a integração expõe:** `AssetRelationship` porta um único `projectRef` e **não representa relação entre endpoints de Projects diferentes** (spec §11, item 11) — isso muda? E `ProjectVisualProfile` tem um único scope em v1 (`kind: "project"`) — ganha scope por produto/destino, ou cada produto mantém aggregate próprio ligado por relação?
23. **Providers cloud de world/mesh/áudio/imagem:** World Labs Marble, TripoSplat, FAL (Hunyuan3D-v3, Meshy v6, ElevenLabs SFX), `nano-banana`, `gpt-image-2`, Grok, Midjourney, Sora, Rodin, Tripo3D — algum entra em avaliação formal com custo, retenção de dados, direitos e termos de serviço comparados? Todos exigem **upload de arquivo do usuário** e nenhum pode virar dependência obrigatória. O gate de licença do Hunyuan 3D já registrado permanece.
24. **Telemetria de CLIs de terceiros:** qual a política para ferramentas que enviam dados de uso por padrão (o CLI do hyperframes envia nomes de comando e desempenho de render, com opt-out)? Default desligado e consentimento explícito por ferramenta, ou bloqueio de ferramentas sem opt-out?
25. **`docs/LIA-FORGE-NA-PIPELINE.md` (atualizada em 2026-11-12 UTC):** o arquivo **foi localizado** em [`BloomRX/Lia-Studio`](https://github.com/BloomRX/Lia-Studio), branch `arena/01a0f4ab-lia-gamedev` (commit `49eedeec09ce`, blob `82f27727858208166fce34dc050525d0dffff9c3`, 19.340 bytes) — a verificação de 2026-11-11 era verdadeira apenas para o repositório da Forge. Decide-se: consolidar aquele documento na `main` do Studio? A referência cruzada a partir da Forge aponta para a branch, para um commit pinado ou para uma cópia consolidada?
26. **Revisões locais divergentes:** publica-se o conteúdo local mais novo de `product-gap-analysis.md` (revisão 2026-10-28 com inventário de 2026-11-06) e de `lia-ecosystem-integration.md` (2026-11-06), entre os sete documentos divergentes entre workspace e árvore publicada? Nenhuma das duas versões foi sobrescrita nesta missão.
27. **Correção do gerador de notices:** autoriza a correção mínima de `scripts/generate_third_party_notices.py` (linha 36, `repository_url()`) para expandir shorthand `owner/repo` em `https://github.com/owner/repo`, eliminando os **112 links quebrados** de `THIRD_PARTY_NOTICES.md`, com teste novo `tests/test_third_party_notices.py` em `unittest`? O achado, a causa e o plano de teste estão documentados em [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md); **o gerador não foi alterado nesta missão**.
28. **Ambiguidade de nomes:** "Forge Studio" (módulo de apresentação da Lia Forge) convive com "Lia Studio" (produto do ecossistema) e com "ArtCraft Studio"/"HyperFrames Studio" (produtos externos). Renomeia-se o módulo, ou padroniza-se o uso do nome completo do produto em toda a documentação?

## Perguntas em aberto acrescentadas pela revisão T8 (2026-11-12)

Continuam a numeração anterior. Detalhe com evidência primária em [`T8-REQUIREMENTS-TRACEABILITY.md`](T8-REQUIREMENTS-TRACEABILITY.md); nenhuma tem default proposto.

29. **Envelope entre produtos:** o contrato de passagem Studio ↔ Forge passa a carregar **hash de referências** e **versão do perfil visual**, ou continua deliberadamente sem anexos como a prévia atual (`app/lia/forge_brief.py`, com `sent`/`saved`/`verified_result = False`)? Qual vocabulário de tipo de asset no envelope — os quatro do Studio (`concept`, `model`, `rig`, `spritesheet`) ou as categorias extensíveis da Forge (personagens, itens, ambientes, 2D/2.5D)?
30. **Política de admissão:** [`PROVIDER-AND-MODEL-ADMISSION-POLICY.md`](PROVIDER-AND-MODEL-ADMISSION-POLICY.md) é aprovada como política (14 dimensões, 6 categorias, 13 requisitos mínimos, processo de 8 passos)? Cada componente estudado recebe sua categoria por decisão explícita?
31. **Fronteira GPL do ComfyUI:** registra-se formalmente que o [`comfyanonymous/ComfyUI`](https://github.com/comfyanonymous/ComfyUI) é **GPL-3.0** e que a integração da Forge é por endpoint HTTP de processo separado (sem linkagem), com revisão obrigatória antes de qualquer redistribuição de binário, fork ou workflow com nós GPL-3.0?
32. **Rota 3D local e probe real:** autoriza-se avaliar a rota **R1** (TripoSR — MIT em código **e** pesos, ~6 GB VRAM, fallback CPU — mais Blender, xatlas, clips CC0 e Rigify/UniRig) e executar **probe/teste real na máquina Windows com AMD RX 580 8 GB**? A licença dos pesos do UniRig, a licença comunitária do Hunyuan (com exclusão de UE/Reino Unido/Coreia do Sul) e a licença não comercial do FLUX.2 Klein precisam ser revisadas **antes** de qualquer teste que as envolva.
33. **Perfis de compatibilidade por destino:** quem declara e como se validam os requisitos de destino (engine Godot/Unreal/Unity, Lia Desktop, vídeo, impressão), dado que o shape das extensões de destino continua pendente (spec §11, item 12) e o Studio registra que "o perfil de engine continua indecidido"?
34. **Proveniência de skills:** adota-se manifesto + checksum (padrão observado no hyperframes) e curadoria com default sem auto-execução para skills de agente, inclusive as do próprio ecossistema Lia (`.agents/skills/lia-game-*` no Studio, `.agents/skills/lia-brand-check` na Forge)?
35. **Atualização da leitura do lado do Studio:** o documento do Studio ancora nos commits da Forge `f274b015` e `79d4b58` e pede reconfirmação antes de desenhar transporte; os commits `33fdedf` (pesquisa 3D local) e `b81b127` (T7) ainda não foram lidos lá. Essa atualização é tarefa no repositório do Studio — quem a executa e quando?

## Decisões que esta missão não toma

Não escolhe um modelo/provider, serviço cloud, runtime de IA, biblioteca de agente, framework de workflow, plugin format final, banco de dados, hardware mínimo, licenças de terceiros, orçamento, route order, release date, ou troca de `.spriteforge/`. São questões futuras; o roadmap é não linear em [`MASTER-ROADMAP.md`](MASTER-ROADMAP.md). Também não escolhe backend de vídeo, contrato de mídia temporal, escopo de splats ou áudio, nó de *staging* de cena, modelo de contrato compartilhado de identidade entre Lia Studio e Lia Forge, seu dono ou sua precedência, meio de armazenamento desse contrato, e não autoriza a correção do gerador de `THIRD_PARTY_NOTICES.md`.