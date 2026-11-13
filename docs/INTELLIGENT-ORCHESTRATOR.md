# Intelligent Orchestrator — planejamento explicável

> **Estado:** **parcialmente implementado** (T13, 2026-11-13 UTC). `shared/orchestrator/planner.mjs` planeja sem executar: 8 receitas de workflow, seleção de adapter por capacidade via Hub, passos bloqueados com motivo nomeado, ações pendentes marcadas como decisão humana (`canBeAutomated: false`), entradas que só o usuário fornece (`pendingInputs`), requisitos de RAM/VRAM/disco separados, custo só quando o adapter declara valor, licenças por adapter e gates de revisão listados. Evidência: `tests/orchestrator-engine-smoke.mjs` e `tests/workflow-coverage-smoke.mjs`. Seguem como **alvo**: busca por skills, comparação de rotas alternativas com custo real medido e planejamento multipipeline. Consulte [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md), [`WORKFLOW-ENGINE.md`](WORKFLOW-ENGINE.md) e [`T13-IMPLEMENTATION-EVIDENCE.md`](T13-IMPLEMENTATION-EVIDENCE.md).

## Missão

Traduzir pedido e restrições da pessoa em alternativas de workflow executáveis, usando somente capabilities registradas e compatíveis. O orquestrador **planeja, explica e propõe**; o usuário decide, autoriza e inicia. Ele não deve selecionar provider baseado em popularidade, ocultar um bloqueio, aceitar licença, chamar API, instalar ou baixar algo por conta própria.

## Entradas explícitas

- objetivo, categoria/subtipo e uso final do asset;
- brief, referências, estilo, câmera, scale, resolução, frames, target engine/platform;
- arquivos e versões já existentes, ponto de entrada preferido e o que deve permanecer inalterado;
- restrições de direitos/licenças, dados que não podem sair do dispositivo e uso permitido de cloud;
- orçamento e limite de custo (incluindo se custo desconhecido é permitido após pergunta);
- permissões de instalação/download, rede, API e overwrite — cada uma independente;
- ferramentas/providers já instalados e informações de hardware/runtimes efetivamente reportadas.

Campo não fornecido é `unknown`, não uma escolha implícita. Um nome de GPU, quantidade de VRAM ou modelo no catálogo não prova que o adapter consegue usar aquele hardware.

## Passos de planejamento

1. **Normalizar objetivo:** identificar categoria, output target, critérios verificáveis, prazo/preferências e informações faltantes.
2. **Inspecionar inputs:** localizar artefatos somente em roots permitidas; registrar paths/hashes; não copiar/enviar automaticamente.
3. **Enumerar rotas:** buscar workflows existentes, incluindo rotas 2D sem 3D; calcular subgrafo pelo ponto de entrada.
4. **Resolver capabilities:** para cada nó buscar adapter/tool/provider compatível e estado real (instalado, detectado, configurado, licenciado, indisponível ou desconhecido).
5. **Aplicar hard constraints primeiro:** licença e direitos; rede/privacidade; orçamento; sistema/runtime; formato/semântica; autorização; dependências.
6. **Construir alternativas:** preferir opções disponíveis e locais se isso atender ao usuário; listar motivos para rejeições, dependências, riscos e diferenças de saída.
7. **Exibir plano:** grafo, arquivos, etapas a executar/ignorar/reutilizar, destination, dados enviados, ferramentas e versões, custo/limites, operações de instalação/download e QA.
8. **Aguardar escolha:** permitir editar rota, trocar provider, importar arquivo, pular parte opcional, restringir dados ou cancelar.
9. **Revalidar no início:** comprovar dependências/paths/consentimentos e pedir nova aprovação se scope mudou.
10. **Observar e reportar:** consumir eventos reais do Workflow Engine; não inventar ETA, porcentagem, imagem, teste ou completion.

## Esquema de saída do plano

O plano apresenta, por etapa:

- intenção e objetivo do output;
- `workflowId`/versão, nó, dependências e contratos;
- input artifacts/paths com checksums e origem;
- capability, adapter, provider, versão e environment needs;
- modo `local`/`remote` e dados que atravessam a fronteira;
- instalação/download/licença necessários;
- custo conhecido ou explicitamente desconhecido, moeda/unidade e limite;
- riscos, limitações, fallbacks e estado de maturidade;
- validators estruturais, human review requerida e outputs esperados;
- quais etapas não serão executadas e por que.

Um plano pode estar `blocked`/`partial` se alguma etapa não tiver capability. Um provider não selecionado gera uma pergunta/gate, não um output de exemplo.

## Regras de recomendação

- Hard constraints eliminam opções incompatíveis; pesos de preferência podem apenas ordenar as restantes.
- Se nenhum provider declarado atende, explicar o que falta e oferecer rota manual/outro ponto de entrada quando existente.
- Não estimar suporte AMD/Vulkan/CUDA/CPU sem evidência específica do adapter e ambiente. Não inventar preço/tempo/performance. `unknown` é estado visível.
- Não confundir “disponível online”, “downloadable”, “instalado”, “licenciado”, “API configurada” e “testado aqui”. São sinais distintos.
- Não usar apenas extensão para decidir que um arquivo é modelo, rig ou animação utilizável.
- Respeitar a prioridade de humanoide estilizado como um caso prioritário, mantendo a taxonomia geral e rotas 2D/3D independentes.

## Agentes, LLMs e modo offline

Um LLM pode ajudar a extrair campos/recomendar planos, mas o modo de base deve continuar útil por formulários, templates e regras determinísticas. Um agente externo pode executar um handoff opcional; sua presença não transforma o plano em run da Forge e não concede permissões. Skills são fontes de conhecimento e não executores. A aprovação é feita na Forge, por ação e escopo, mesmo quando o plano veio de um agente.

## Estado atual e lacunas

`electron/workflow-contracts.cjs` gera contrato humanoide estático e condições de autorização por provider; `workflow-runner.cjs` executa o plano recebido serialmente. O provider ausente bloqueia cada etapa de geração e não simula arquivos. Desde a T13 há index geral de capabilities (`shared/capabilities/registry.mjs`, 49 capacidades em 7 famílias) e detecção de máquina/backends por adapter (`shared/adapters/sdk.mjs`, campo `backends` com `validated` explícito); continuam ausentes busca por skills, comparação de rotas, detecção universal de custos e planner multipipeline. `scripts/spriteforge-mcp.mjs` é integração opcional de handoff/registro, não Intelligent Orchestrator.

## Critérios de aceite futuros

- Mesmo pedido/configuração e capability catalog versionado produzem planos explicáveis (LLM ligado/desligado), incluindo `unknown`/`blocked`.
- Mudança do arquivo/endereço/custo depois da aprovação pede aprovação nova.
- Nenhum endpoint/instalação/download/custo acionado antes de botão explícito.
- Fixtures cobrem tipo de asset, ponto de entrada intermediário, provider ausente, conflito de licença, orçamento, hardware desconhecido, internet desligada e saída parcial.
- Cada recomendação pode ser rastreada a capability/skill/decision source e não contém resultado fabricado.