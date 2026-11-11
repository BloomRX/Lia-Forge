# Lia Forge — índice documental

Este índice separa **intenção do produto**, **estado provado no checkout** e **arquitetura-alvo**. A documentação não prova que uma funcionalidade existe: use a auditoria de código e as evidências nela citadas.

## Arquitetura, decisões e contratos

Cadeia de autoridade documental (a mais alta primeiro). Cada documento declara o próprio estado no cabeçalho; **nenhum deles autoriza implementação por si só**.

| Ordem | Documento | Papel | Estado declarado |
|---|---|---|---|
| 1 | [`ADR-001-LIA-FORGE-DECISIONS.md`](ADR-001-LIA-FORGE-DECISIONS.md) | Decisões arquiteturais aceitas (6 decisões) e gate de implementação | `ACCEPTED — ARCHITECTURE ONLY`; implementação `NOT AUTHORIZED`; data da aprovação humana não registrada |
| 2 | [`LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md`](LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md) | Arquitetura consolidada, escopo de produto, contratos-alvo, compatibilidade de formatos, migração e decisões abertas (§15.2) | decisões arquiteturais `APPROVED`; implementação/migração `NOT_AUTHORIZED`; documento em revisão |
| 3 | [`DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`](DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md) | Especificação técnica pré-implementação dos Domain Contracts (17 records, regras de grafo, fixtures sintéticas, critérios de aceite) | `DRAFT_FOR_HUMAN_REVIEW — NOT AUTHORIZED FOR IMPLEMENTATION`; **12 decisões pendentes** em §11 — **não** está aprovada nem pronta para implementação |

**Regras de leitura:** proposta em revisão não sobrescreve decisão aceita; recomendação da especificação não vira decisão aprovada por aparecer em outro documento; formato, provider ou repositório candidato não é capacidade implementada; auditoria e pesquisa são evidência, não decisão. Divergências deliberadamente não resolvidas estão identificadas nos dois lados — matriz de compatibilidade da especificação (§13.4) e nota de reconciliação da proposta (§5.2).

**Rótulos de estado usados nesta documentação:** **aprovado** (decisão registrada no ADR-001/proposta) · **em revisão** (documento consolidado sob revisão) · **proposta** (`PROPOSED`, sem decisão humana) · **alvo/`PLANNED`** (arquitetura-alvo sem implementação) · **pesquisa** (evidência externa, sem integração) · **pendente de decisão** (item aberto em §11 da especificação ou §15.2 da proposta).

## Fontes de verdade

1. **O que o código realmente faz:** [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md) é o inventário por capacidade; [`PHASE-0-REPORT.md`](PHASE-0-REPORT.md) registra a auditoria direta, decisões, ambiente e testes desta continuação de 2026-11-06. Ambos distinguem evidência de propostas.
2. **O que o produto pretende ser:** [`PRODUCT-ARCHITECTURE.md`](PRODUCT-ARCHITECTURE.md) e [`ASSET-PIPELINES.md`](ASSET-PIPELINES.md). São visão/arquitetura-alvo; propostas não equivalem a código. A Forge é registrada como **fábrica geral de assets** para personagens 2D, 2.5D e 3D, PSD em camadas, cabelos/roupas/acessórios/expressões, rigging/animação/spritesheets/renderização; **jogos e Lia Desktop são destinos de consumo** (Game Asset e Lia Desktop Asset), não módulos de geração nem arquiteturas separadas — o mesmo asset pode ser publicado para vários destinos sem duplicar identidade ou origem.
3. **Como o trabalho deve ser executado:** [`WORKFLOW-ENGINE.md`](WORKFLOW-ENGINE.md), [`INTELLIGENT-ORCHESTRATOR.md`](INTELLIGENT-ORCHESTRATOR.md) e [`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md). Contratos-alvo e diferenças atuais estão explicitados em cada documento.
4. **Como preservar e provar resultados:** [`ASSET-MANAGEMENT.md`](ASSET-MANAGEMENT.md) e [`VISUAL-QA-BENCHMARK.md`](VISUAL-QA-BENCHMARK.md).
5. **Plano de evolução e escolhas:** [`MASTER-ROADMAP.md`](MASTER-ROADMAP.md) e [`DECISIONS-AND-OPEN-QUESTIONS.md`](DECISIONS-AND-OPEN-QUESTIONS.md). Os marcos não formam uma sequência obrigatória.
6. **Pesquisa externa:** [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md). Snapshot individual dos nove projetos solicitados (2026-11-06) **mais o adendo com dois repositórios da expansão 2D/2.5D** (`link-ding/image-to-psd` e `link-ding/doll-studio`, itens 10 e 11, evidência upstream de 2026-11-09/2026-11-10); nenhum foi clonado, baixado, instalado, executado ou integrado.
7. **Contratos de domínio, auditorias temáticas e skills:** [`DOMAIN-CONTRACTS-AUDIT.md`](DOMAIN-CONTRACTS-AUDIT.md) (leitura estática de `shared/domain/contracts.mjs` e seu smoke test × manifesto/store/workflow; taxonomia `PASS/GAP/RISK/PROPOSED/NOT_VERIFIED`), [`DOMAIN-CONTRACTS-EVOLUTION-PROPOSAL.md`](DOMAIN-CONTRACTS-EVOLUTION-PROPOSAL.md) (`PROPOSED`; implementação não autorizada), [`MODULE-CONSOLIDATION-AUDIT-3D.md`](MODULE-CONSOLIDATION-AUDIT-3D.md) e [`CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md`](CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md) (auditorias com snapshot 2026-10-25) e [`SKILLS-KNOWLEDGE-ENGINE.md`](SKILLS-KNOWLEDGE-ENGINE.md) (alvo `PLANNED`). A especificação normativa do primeiro pacote de contracts está na seção **Arquitetura, decisões e contratos** acima e continua **pendente de aprovação humana**, com 12 decisões abertas.

## Uso atual e contratos existentes

- [`usage-workflows.md`](usage-workflows.md) — rotas documentadas, pontos de entrada e retomada.
- [`asset-task.schema.json`](asset-task.schema.json) — schema atual da tarefa MCP; hoje limitado a `character`/`item` e à rota 3D → 2D.
- [`agent-workflow.md`](agent-workflow.md) — contrato de handoff para agente externo opcional; não é o orquestrador interno da Forge.
- [`mcp.md`](mcp.md) — instalação e ferramentas MCP atuais.
- [`comfyui.md`](comfyui.md) — integração atual de conceito ComfyUI, limitações e pesquisa de instalação/backends.
- [`humanoid-workflow-research.md`](humanoid-workflow-research.md) — auditoria delimitada do fluxo humanoide. Seu material anterior sobre renderer/Mixamo é outra tarefa e não foi retomado aqui.
- [`lia-ecosystem-integration.md`](lia-ecosystem-integration.md) — adaptação das regras do ecossistema Lia à stack existente.
- [`BRAND-STANDARDS.md`](BRAND-STANDARDS.md) — marca, linguagem e regras de proveniência.

## Referências preservadas

`guia-externo/` e `Lia.zip` são materiais de referência para apps futuros, não prova de que aquelas regras ou instalações estão implementadas na Lia Forge. Os documentos preexistentes foram preservados; divergências de escopo e o estado atual do código devem ser resolvidos pela ordem de precedência acima.

**Snapshot desta consolidação:** 2026-11-06, branch `arena/649f88bd-3dspritesheet`, `HEAD` `13dc4c7d2fde28f9324fd929482948ba34a87abf`. O checkout já continha uma modificação em `README.md` e arquivos não rastreados antes desta tarefa; veja o baseline completo em [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md) e o estado final desta continuação em [`PHASE-0-REPORT.md`](PHASE-0-REPORT.md).

**Adendo 2D/2.5D e destinos de utilização (revisão documental; evidência upstream de 2026-11-09/2026-11-10 UTC):** mesma branch e mesmo `HEAD`, sem commit/push. Apenas documentação foi editada: `EXTERNAL-REPOSITORY-RESEARCH.md`, `ASSET-PIPELINES.md`, `TOOL-PROVIDER-HUB.md`, `SKILLS-KNOWLEDGE-ENGINE.md`, este índice e `LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md`. `DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md` — que continua `DRAFT_FOR_HUMAN_REVIEW`, com seus 12 itens pendentes — e `ADR-001-LIA-FORGE-DECISIONS.md` **não foram modificados**. Nenhum código, adapter ou contrato de domínio foi escrito; nada foi clonado, baixado, instalado ou executado (Blender, providers, workflows, skill ou app desktop); nenhuma integração com Lia Desktop foi criada; nenhuma decisão aberta foi aprovada. Os dois repositórios do adendo permanecem **candidatos experimentais com direitos pendentes**.

**Publicação Git do conjunto documental (reconciliação pós-revisão integral da especificação).** A especificação de Domain Contracts foi reconciliada e publicada isoladamente no commit `b8403fbb6f678261480cd6013a015d6557a01de1` da branch `arena/649f88bd-3dspritesheet` (fast-forward sobre `f274b015706f3cf2305678d6ee78d5ca4dc311b4`, sem force push e sem merge em `main`); ela permanece `DRAFT_FOR_HUMAN_REVIEW — NOT AUTHORIZED FOR IMPLEMENTATION`, com os 12 itens de §11 `OPEN`, nenhum default inventado e nenhuma data de aprovação humana registrada. Em seguida foi publicado o conjunto documental de suporte necessário para navegar da especificação à proposta, ao ADR-001 e às auditorias/pesquisas sem referências quebradas (fechamento transitivo dos links relativos), incluindo este índice, a proposta consolidada com suas notas de reconciliação e o ADR-001 **sem alteração**. `ADR-001-LIA-FORGE-DECISIONS.md` não foi reescrito para caber na especificação. Nenhum código, teste, configuração, `README.md` raiz ou arquivo não documental foi incluído; os seis documentos que já existiam no remoto com conteúdo divergente do workspace (`agent-workflow.md`, `comfyui.md`, `humanoid-workflow-research.md`, `lia-ecosystem-integration.md`, `mcp.md`, `usage-workflows.md`) não foram sobrescritos. Nada foi aprovado: a ordem de precedência acima continua valendo e a implementação segue não autorizada.
