# Workflow Engine baseado em grafo — contratos e execução

> **Estado:** contrato-alvo **parcialmente implementado** (T13, 2026-11-13 UTC). `shared/engine/dag.mjs` + `shared/engine/execution-manager.mjs` formam um scheduler DAG real — ordem topológica por níveis, lote com limite de recurso, retry com backoff, timeout, cancelamento cooperativo, checkpoints, retomada, custo, proveniência, gates (autorização por fingerprint, revisão ancorada em SHA-256, entrada alterada, redação de segredos, escrita atômica) e logs — e o plano declara os validadores que o engine cobra por passo. Evidência executada: `tests/orchestrator-engine-smoke.mjs`, `tests/workflow-coverage-smoke.mjs`, `tests/studio-service-smoke.mjs`, `tests/run-lifecycle-smoke.mjs` (cancelamento de um passo em andamento com processo externo encerrado de verdade, falha intermediária com stderr preservado, retomada por checkpoint sem reexecutar passo concluído e run órfão corrigido sem fingir execução). O cancelamento e a retomada chegaram ao produto: `cancelRun`/`resumeRun`/`activeRuns` no serviço, `POST /runs/{id}/cancel|resume` e `GET /runs/active` no transporte HTTP, `lia-forge:studio:runs:cancel|resume|active` no IPC e botões de cancelar/retomar na interface; o snapshot do run passou a ser gravado a cada passo (início e fim), de forma serializada, para o progresso existir antes do run terminar. O runner legado `electron/workflow-runner.cjs` continua serial e específico do fluxo Blender. Seguem como **alvo**: filas de jobs persistentes, paralelismo por recurso validado em máquina real, reconciliação de chamadas de API após crash e migração de runs antigos. Para evidências por módulo, veja [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md) e [`T13-IMPLEMENTATION-EVIDENCE.md`](T13-IMPLEMENTATION-EVIDENCE.md).

## Responsabilidade

O Workflow Engine transforma um plano aprovado em execução rastreável: valida dependências/contracts, resolve inputs existentes, agenda nós, controla efeitos, persiste eventos/checkpoints, registra outputs reais, interrompe ou pausa com segurança, recupera após reinício e entrega evidências para revisão/asset manager.

Ele **não** escolhe sozinho a intenção artística, não descobre providers, não substitui a aprovação do usuário e não declara qualidade visual. O Intelligent Orchestrator sugere um plano; o usuário autoriza; o engine executa o subgrafo aprovado.

## Separar definição, plano e run

- **WorkflowDefinition:** receita de nós versionada e testável; sem estado de uma execução concreta.
- **WorkflowPlan:** subgrafo concreto para um asset, com inputs resolvidos, adapters/capabilities escolhidos e lacunas/autorizações explicitadas.
- **WorkflowRun:** instância imutável em evolução, ligada a uma versão do plano, inputs, ambiente e eventos.
- **StepRun:** status, timings, parâmetros redigidos, inputs/outputs, efeitos, retry/reconciliation e aprovação daquele nó.
- **Artifact:** arquivo real identificado por caminho/URI controlada, hash, formato, semântica, provenance e validators.

Esqueleto informativo (não é schema implementado):

```json
{
  "schemaVersion": "target-v1",
  "workflowId": "character-brief-to-sprites-v1",
  "assetId": "hero-01",
  "entryNode": "build-sprites",
  "nodes": [{
    "id": "render",
    "dependsOn": ["animation"],
    "capability": "render.sequence",
    "adapter": "blender-existing-model",
    "inputs": [{"id": "rigged-model", "kind": "artifact", "required": true}],
    "outputs": [{"id": "atlas", "format": "png", "validator": "sprite-atlas-v1"}],
    "authorization": {"actions": []},
    "review": {"required": true}
  }]
}
```

Versões, environment fingerprint e hashes são campos de primeira classe; esse pseudocode não deve ser copiado como runtime format sem schema/migration review.

## DAG, pontos de entrada e scheduling

1. Cada `dependsOn` referencia um nó existente; validação rejeita ciclo, referência ambígua, output órfão, tipos incompatíveis e versão de contrato não suportada.
2. `entryNode`/conjunto de entradas resolve o subgrafo realmente necessário. Inputs externos podem satisfazer um nó intermediário depois de passar validator/rights checks.
3. Nós predecessores não executados ficam `out_of_scope` ou `reused_from_version`; nunca são marcados como outputs produzidos nesta run.
4. Um nó fica `ready` quando todos os inputs e dependências têm artefatos validados ou uma aprovação/exceção formal.
5. Execução paralela só é permitida entre nós sem dependências nem conflito de arquivos, recurso, GPU, memória ou provider. O adapter declara exclusividade/recurso e o scheduler a aplica.
6. A ordem do grafo, resultados de concorrência, ordenação de outputs e event log devem ser reproduzíveis quando o adapter o permite; nondeterminism é registrado, não escondido.
7. Falha de um ramo invalida apenas descendentes que dependem dele; ramos sem dependência podem ser preservados.

## Estados propostos

Estados de run e node devem ser separados. Exemplo de estados de run:

```text
draft → planned → awaiting_authorization → queued → running
                                     ↘ awaiting_review → running / completed / rejected
running → paused / cancelling → cancelled
running → blocked / failed / needs_reconciliation
completed → superseded (quando uma nova versão passa QA)
```

`blocked` significa dependência/decisão não resolvida; `failed` significa execução tentou e falhou; `needs_reconciliation` significa um efeito remoto pode ter ocorrido, mas a resposta/ID não é conhecido; `rejected` é decisão humana, não falha técnica. Outputs reais em qualquer desses estados permanecem guardados e visíveis.

Não derivar progresso numérico de um contador de passos se não há percentual mensurado. O estado de etapa e mensagens/progresso reportados pelo processo/provider podem ser exibidos como tal, com indicador explícito de progresso estimado se no futuro houver estimativa.

## Execução de um nó

1. Resolver inputs e validar paths, symlinks, tipo, tamanho, hash, formato e semântica mínima.
2. Conferir versões do workflow, adapter, tool/provider e contrato.
3. Criar fingerprint da entrada, parâmetros aprovados e política de efeitos.
4. Mostrar ao usuário destino, dados, provider, custo (ou `unknown`), instalação/download e licença se necessário.
5. Aguardar ação explícita; qualquer alteração nos dados/destino invalidará a aprovação correspondente.
6. Executar adapter isolado, sem shell genérico, com paths/credenciais mínimos, timeout, cancelamento e logs redigidos.
7. Capturar IDs de job remoto, status de confirmação, bytes baixados e outputs realmente gravados.
8. Rodar validators definidos, calcular SHA-256 e anexar provenance; se parcial, registrar outputs parciais sem dar etapa como completa.
9. Solicitar revisão humana quando declarada; só aprovação permite promover a versão final.

## Idempotência, retry e retomada

- Cada nó declara semântica `pure`, `idempotent`, `deduplicated_by_provider`, `non_idempotent` ou `unknown`.
- Retry automático é permitido somente quando contrato e adapter garantem segurança. Pagamento/upload sem idempotency key não deve ser repetido automaticamente.
- Após crash, reconstruir checkpoint com log de eventos, inputs/outputs e hashes. Reutilizar somente quando fingerprint de input, versão e contratos coincidem e o arquivo real ainda confere.
- Se request remoto talvez tenha sido enviado, procurar job por ID/external reference ou pedir decisão ao usuário; nunca reenviar às cegas.
- Mudança de input invalida os descendentes dependentes, não todas as etapas do projeto.
- Cancelamento significa que a Forge parou de acompanhar/iniciar trabalho local; provider pode ainda estar processando. Registrar esse limite e oferecer reconciliação.

## Contrato de autorização

O escopo de autorização inclui exatamente a ação, inputs, destination/provider, região, versão, custo/limite, período e outputs permitidos. A autorização não é uma flag genérica de sessão.

| Ação | Gate mínimo |
|---|---|
| Gerar localmente | Adapter, modelo/runtime e inputs; declarar hardware/custo desconhecidos se não mensurados. |
| Enviar prompt/referência/modelo | Quais dados, endpoint/empresa/região e política conhecida/desconhecida; autorização explícita para upload. |
| Pagar/chamar serviço | Estimativa/limite em moeda/unidade se API fornecer; se desconhecido, informar e exigir confirmação consciente. |
| Instalar/atualizar | Fonte oficial, versão, licença, destino, tamanho e alterações do sistema. |
| Baixar weights/assets | Origem, hash, licença/model terms, tamanho e path; não aceitar licença automaticamente. |
| Sobrescrever/apagar | Paths afetados, backup/rollback e confirmação separada. |

Scope changes, caminho diferente, novo endpoint, novos inputs, mudança de provider ou limite desconhecido invalidam aprovação e retornam ao gate.

## Persistência e filesystem

- Event log append-only, snapshots periódicos e escrita atômica/transacional.
- Roots autorizadas explícitas; paths normalizados e realpaths dentro do workspace, exceto artefatos externos explicitamente anexados como read-only.
- Limites de tamanho/quantidade, validação de links, controle de arquivo temporário, cleanups somente dos arquivos da Forge.
- Schema e migration versionados; corrupção detectada sem sobrescrever original.
- Tokens/segredos fora de plano, artefato, mensagens, stack traces e manifestos.

## Compatibilidade com o código atual

`electron/workflow-runner.cjs` já valida etapas serializadas em lista, contratos input/output, autorização, revisão humana, hashes e formato; `workflow-run-store.cjs` escreve snapshots em JSON dentro de `.spriteforge/runs/`. `workflow-contracts.cjs` descreve um plano humanoide, mas deixa adapters de views/model/rig/animação bloqueados. A execução desktop persistida/retomável efetivamente exposta é específica de um workflow Blender de um estágio. Desde a T13 existe scheduler geral por DAG em `shared/engine/` (nível de plano + execução, com gates, checkpoints, retomada e validação declarada por passo); continuam ausentes filas de jobs, execução paralela por recursos e reconciliação de API pós-crash. A base legada descrita acima é ponto de estudo, não prova de engine completo.

## Critérios verificáveis de aceite futuro

- Testes de DAG cíclico, nó órfão, grafo grande, subgrafo por entrada intermediária, conflito de recursos e branches independentes.
- Testes de crash antes/depois de enviar request, duplicação, provider timeout, cancelamento, restart e reconciliação sem chamada duplicada.
- Fixtures de inputs alterados/corrompidos, checksum divergente, symlink/path traversal, output parcial e revisão rejeitada.
- Migrações de run testadas e preservação de todos os artefatos.
- Teste de integração por adapter em ferramenta/versão alvo, com logs, arquivo e hashes reais; testes simulados identificados como simulados.
- Revisão visual humana quando o contrato exigir; nenhuma métrica ou output sintético vira PASS de plataforma.