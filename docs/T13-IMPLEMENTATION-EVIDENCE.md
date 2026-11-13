# T13 — Evidências de implementação do Lia Forge

> **Estado:** registro de execução (não é proposta nem autorização). Data das medições: **2026-11-13 UTC**.
> Fonte de verdade: o código em `shared/`, `electron/`, `src/` e os testes citados. Nada aqui afirma capacidade que não tenha sido executada neste checkout.

Este documento existe para separar quatro coisas que costumam ser confundidas: **implementado** (código presente), **integrado** (ligado ao produto), **executado** (rodou aqui, com artefatos gravados) e **validado no alvo** (rodou na ferramenta/máquina de destino). Só o que foi medido está marcado como executado.

## 1. Ambiente onde tudo foi medido

| Item | Valor observado |
|---|---|
| SO | Debian 12 (sandbox de desenvolvimento) |
| CPU / RAM | 2 CPUs · 3.939 MB RAM total |
| GPU | ausente (`/dev/dri` não existe; `machine.gpu = null`) |
| Blender | não instalado (não está no `PATH`) |
| ComfyUI | não instalado / nenhum servidor local ou remoto autorizado |
| Node / npm | v22.22.3 · 10.9.8 |
| Rede | somente `github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org` |

Nenhuma ferramenta externa foi instalada, baixada, comprada ou chamada. Nenhum dado foi enviado. Backends remotos seguem **não autorizados** e aparecem como `blocked` no Hub.

## 2. Estado do catálogo medido pelo próprio produto

Saída real de `createStudioService(...).overview()` / `.preflight()` em projeto temporário:

- **49 capacidades** em **7 famílias** (`shared/capabilities/registry.mjs`);
- **7 adapters** registrados (`electron/adapters/index.mjs`): 4 internos (`local-image-ops`, `rig2d-software`, `glb-inspect`, `export-package`), `blender-spritesheet` (ausente), `comfyui-concept` (ausente) e `comfyui-remote` (não autorizado);
- pré-voo: `ready 15 · blocked 1 · missing 33 · unknown 0`; ferramentas `disponíveis 4 · ausentes 2 · bloqueadas 1`; `canStart: false` (há capacidades sem provider — o produto diz isso antes de executar);
- **8 workflows** no catálogo, dos quais **5 executáveis agora** só com código interno.

## 3. Matriz de execução dos 8 workflows (§12.1)

Reproduzível com `node tests/workflow-coverage-smoke.mjs` (projeto temporário real, sem rede).

| Workflow | Caso executado | Estado final | Evidência |
|---|---|---|---|
| `ui-vfx-sheet` | execução direta | `succeeded` | **executado**: VFX procedural + prévia composta + pacote de destino; validadores `png-content` e `destination-profile` aprovados |
| `variation-retexture` | execução direta | `succeeded` | **executado**: recolor → contorno → atlas 4 colunas com manifesto → destino; `spritesheet-manifest` aprovado |
| `2d-character-parts` | execução direta | `blocked` | **executado até o gate**: separação de 6 partes + `layers-integrity` aprovado; parou pedindo revisão humana |
| `2d-character-parts` | revisão + retomada | `succeeded` | **executado**: 2 gates aprovados, retomada por checkpoint, atlas 384×144 (8×3, 24 frames de 48×48) com cobertura medida |
| `2d-animation` | sem run de origem | `blocked` | **bloqueado com motivo**: o plano avisa que falta escolher o run de origem (`pendingInputs`, ação `canBeAutomated: false`) |
| `2d-animation` | rig de outro run | `succeeded` | **executado**: rig revisado reaproveitado entre runs, ações geradas, atlas + manifesto, pacote de destino |
| `2d-modular-character` | revisão + retomada | `succeeded` | **executado**: peças intercambiáveis, animações compartilhadas (`sharedAnimations: true`), cada variante validada como rig |
| `2d-art-concept` | ferramenta ausente | `blocked` | **não executado**: `image2d.generate-concept` sem provider (ComfyUI ausente/não autorizado); motivo nomeado no run |
| `3d-object-render` | ferramenta ausente | `blocked` | **não executado**: falta o modelo do usuário e o Blender; motivo nomeado |
| `3d-object-render` | modelo fornecido | `blocked` | **parcialmente executado**: `inspect` rodou de verdade sobre um GLB (1 mesh, 12 triângulos, 1 animação, skinned) com `glb-structural` aprovado; `render` bloqueado por Blender ausente |
| `3d-character-spritesheet` | ferramenta ausente | `blocked` | **não executado**: 4 passos dependem de geração 2D/3D e auto-rig externos; contrato `humanoid-prompt-views-to-2d-v1` preservado no plano |

Regras que a matriz respeita:

1. falta de ferramenta ou de entrada do usuário **nunca** vira `failed` — vira passo `blocked` com `requiresUserDecision: true` e mensagem que diz o que fazer;
2. nenhum passo bloqueado é apresentado como pronto na interface;
3. `succeeded` só aparece quando os validadores declarados no plano rodaram e aprovaram os artefatos gravados em disco.

## 4. Validação declarada é executada (lacuna G8 fechada na produção)

- `shared/qa/validators.mjs` → `validateStepOutputs({ validators, params, result, outputs, readArtifact })` monta a entrada de cada validador a partir dos **artefatos gravados** e do retorno do adapter;
- `shared/engine/execution-manager.mjs` chama isso depois de cada passo e **antes** do gate de revisão: reprovação derruba o passo com `ADAPTER_OUTPUT_INVALID` e o resultado fica em `step.validations` (a interface mostra validador, status e motivo);
- quando a entrada de um validador não existe, o registro é `skipped` **com o motivo** — nunca um "ok" silencioso;
- variantes modulares são validadas uma a uma (`checked: n`);
- o renderer 2D passou a gravar `spritesheet-manifest.json`, e o empacotador de atlas grava `atlas-manifest.json`: sem manifesto não há como importar o atlas em engine nenhuma.

## 5. Gates de segurança preservados (§8)

Autorização por fingerprint do plano · revisão humana ancorada em SHA-256 (mudou o arquivo, a aprovação perde a validade) · detecção de entrada alterada · redação de segredos em logs, eventos, planos e revisões · ações protegidas (`install_software`, `download_models_or_weights`, `cost`, `send_data`) exigem autorização explícita · escrita atômica com recusa de symlink e confinamento ao projeto.

Reforços desta fase:

- o DAG aceita passo bloqueado pelo plano (sem adapter) e o engine honra `blockedReason` **antes** de executar: o plano voltou a ser a fonte de verdade;
- `fromRun` é validado como nome de pasta (traversal recusado antes de qualquer leitura) e a leitura de artefatos continua confinada a `<projeto>/.lia-forge/runs/`;
- `reviewStep` repassa a origem do run gravada em `plan.json` (`fromRun`, `sourceImage`, opções): retomar não perde mais o contexto que só existia na primeira execução;
- `needsAuthorization` deixou de ser derivado de `protectedActions` (que lista o que o adapter **se recusa** a fazer): adapters locais não geram mais pendências falsas de autorização no plano.

## 6. Ferramentas externas: integração real em qualquer hospedeiro + providers

Até esta rodada, as implementações reais (`electron/blender-adapter.cjs`, `external-tools.cjs`, `manual-artifacts.cjs`, `task-manager.cjs`, `scripts/comfyui-client.mjs`) só eram injetadas pelo `electron/main.cjs`. Fora do Electron, os defaults do serviço lançavam erro ou eram no-op: **um Blender ou ComfyUI instalado pelo usuário era invisível** no dev-server, nos testes e em qualquer processo Node. Isso foi corrigido sem criar um segundo sistema:

- `shared/integrations/host-defaults.mjs` carrega essas implementações de forma preguiçosa (`createRequire`) e tolerante a falha — se um módulo não carrega, devolve `null` e lista o motivo em `unavailable`;
- `shared/engine/execution-manager.mjs` ganhou o hook `prepareContext`: o hospedeiro completa o contrato de cada passo (pasta de saída real, script, `asset`, dimensões, modelo de entrada, prompt, checkpoint) e o engine continua sem conhecer ferramenta alguma;
- `shared/services/studio-service.mjs` passa a usar esses defaults e a hashiar artefatos gravados por processo externo, para o gate de revisão continuar ancorado em SHA-256.

**Escolha de provider (§9) deixou de ser implícita.** `shared/integrations/provider-store.mjs` grava `.lia-forge/providers.json` (escrita atômica, confinada ao projeto) com:

| Provider | Modos | O que é recusado |
|---|---|---|
| ComfyUI | `local-loopback` (padrão) · `remote` · `disabled` | endpoint não-loopback no modo local; segredo em qualquer campo (só `credentialRef`); modo remoto sem autorização gravada (quem, quando, escopo `send_data+cost`) |
| Blender | `auto` (PATH + locais conhecidos) · `path` · `disabled` | caminho inexistente ou não executável nunca vira "disponível" |

A interface expõe isso no painel **Providers & backends** (`src/ForgeStudio.jsx`), por HTTP (`GET`/`POST /api/lia-forge/studio/providers`, configuração inválida → `400`) e por IPC (`lia-forge:studio:providers[:configure]`).

Correções de honestidade que essa integração revelou:

- `comfyui-concept` lia `status.available` de um cliente que reporta `connected`: **um servidor ComfyUI respondendo era marcado como ausente**. Corrigido, e o adapter agora recusa endpoint que não seja da própria máquina (enviar dados é papel do `comfyui-remote`, com autorização);
- `blender-spritesheet` aceitava qualquer caminho configurado como ferramenta: agora verifica existência + `X_OK` na descoberta e na execução, e falha de spawn (`ENOENT`/`EACCES`) vira **bloqueio nomeado**, nunca falha do produto;
- o Hub tratava requisito não medido como veto: agora requisito **medido e insuficiente** → `blocked` com o número na mensagem (ex.: "RAM: precisa de 8192 MB e há 3940 MB"), e requisito **não medido** (VRAM sem probe autorizado) → aviso, não veto;
- passos de difusão declaram `requiresParam: 'prompt'` e o brief escrito pelo usuário satisfaz essa entrada: o plano pede o texto antes de executar, em vez de falhar no meio;
- `destination-profile` passou a conferir o pacote contra o **perfil publicado** do destino (destino existente no catálogo, fps/eixos/unidades/pivô/formatos idênticos, formatos aceitos por arquivo, bloqueios de compatibilidade). Continua sem afirmar importação real: `verifiedOnDestination` vem do perfil.

### O que o smoke de integração executa de verdade

`tests/host-integration-smoke.mjs` exercita o caminho completo com **substitutos rotulados** (um executável de teste no lugar do Blender e um servidor HTTP de teste no lugar do ComfyUI — neste ambiente não existe nenhum dos dois):

| Verificação | Resultado medido |
|---|---|
| Descoberta por PATH | executável de teste encontrado por `findExternalTool('blender', { env: { PATH } })` |
| Processo externo real | `spawn` com os argumentos do contrato; proveniência gravada no passo (`execution.kind = 'process'`, executável + args) |
| Artefato do processo | folha **384×144** (grade 8×3 de 48×48), **39,1%** de cobertura medida, `png-content` aprovado, SHA-256 de 64 chars |
| ComfyUI em loopback | HTTP real: `/system_stats`, `/queue`, `/models/checkpoints`, `/prompt`, `/history/{id}`, `/view`; **1** POST `/prompt` com o checkpoint escolhido e o texto do usuário no grafo; PNG de **52.766 cores** validado |
| Gate de revisão | passo para em `review-missing` após executar; aprovação ancora SHA-256 e retoma |
| Requisito medido | 3.940 MB de RAM < 8.192 MB exigidos → passo `blocked` e **zero** requisição de geração |
| Remoto sem autorização | nada enviado, nada gerado, pendência visível na configuração |
| Recusas | endpoint não-loopback no modo local, campo de segredo, caminho de executável inválido, provider desativado |

Nenhuma linha desse teste afirma "Blender renderizou" ou "ComfyUI difundiu": afirma que o produto chama, valida e registra corretamente uma ferramenta externa — a execução na ferramenta real continua pendente de instalação pelo usuário.

## 7. Entradas do usuário: referências e modelos entram pelo produto

Até esta rodada o caminho da imagem de entrada era um **campo de texto livre** (`input/sprite.png`): quem não conhece a pasta do projeto não tinha como acertar, e nada do que o usuário enviasse era medido antes de entrar no pipeline. Não havia também como olhar duas variações lado a lado — a comparação existia só na cabeça de quem abria o explorador de arquivos.

O que passou a existir (mesmo serviço, mesmos gates, dois transportes):

- `<projeto>/input/` é a pasta das entradas. `listInputs()` percorre até 3 níveis e 400 arquivos, aceita imagem (`png/jpg/jpeg/webp`), modelo (`glb/gltf/fbx/obj/stl/blend`) e documento (`md/json/txt`), e mede o que dá para medir aqui: PNG é decodificado (dimensões, cores únicas, cobertura, bounding box), GLB é inspecionado (meshes, triângulos, materiais, animações, skin). O que não pôde ser verificado volta com `contentChecked: false` e o motivo em `problem` — nunca como "ok".
- `saveInput({filename, bytes, note})` sanitiza o nome (sem caminho, sem `..`, sem acento, teto de 120 caracteres), verifica o conteúdo **antes** de gravar, escreve de forma atômica (`wx` + rename) e resolve colisão com sufixo — inclusive ignorando caixa, porque o projeto pode viver em um sistema de arquivos que também ignora. O arquivo existente nunca é sobrescrito e o original do usuário nunca é movido nem recomprimido.
- `readInput()` e `compareArtifacts({paths})` (teto de 8) usam o mesmo `assertSafeWriteTarget` dos artefatos: traversal, caminho absoluto e symlink são recusados com o motivo dito.
- HTTP: `GET`/`POST /api/lia-forge/studio/inputs`, `GET /input-file`, `POST /compare` (403 fora de `input/`, 400 formato inválido ou PNG falso, 413 acima de 32 MB). IPC: `lia-forge:studio:inputs:list|save|pick|read` e `lia-forge:studio:compare`. O `pick` abre o seletor do sistema e diz na própria janela que o arquivo será **copiado** para `input/`.
- Interface: o campo de texto de "imagem de entrada" e de "modelo 3D" virou um seletor com miniaturas medidas (`InputPicker`), botão de envio de arquivo e, no desktop, o seletor nativo. O **Comparison Lab** (`ComparisonLab`) compara entradas e artefatos de run lado a lado com as métricas medidas e um botão para gravar a escolha como **versão do asset** (`lia-forge:studio:assets:versions`), levando o `runId` de origem quando o artefato veio de um run. O produto mostra os números e não decide pelo usuário: nada aqui afirma qual variação é "melhor".

### O que foi executado de verdade (HTTP no dev-server, projeto real em disco)

| Verificação | Resultado medido |
|---|---|
| `GET /inputs` | `input/modelo.glb` (1.504 B, 1 mesh, **12 triângulos**, 1 animação, `skinned: true`, `contentChecked: true`) e `input/sprite.png` (48×48, 4 cores, `contentChecked: true`, SHA-256 `dd81079e…`) |
| `POST /inputs` com `filename: '../../etc/Referência Herói.PNG'` | gravado em `input/Referencia-Heroi.PNG` (32×32, 21 cores, cobertura 1,0, SHA-256 `3f8186d6…`), traversal neutralizado, acentos removidos, nota preservada |
| Mesmo envio de novo | `input/Referencia-Heroi-2.png` — o primeiro arquivo continua intacto |
| `POST /inputs` com `.exe` | `400` e nada gravado |
| `GET /input-file?path=input/sprite.png` | `200 image/png`, 182 B |
| `GET /input-file?path=../../../etc/passwd` | `403` |
| `POST /compare` com 2 caminhos válidos + 1 traversal | 2 entradas `ok: true` com dimensões/cores/cobertura/SHA-256 e 1 entrada `ok: false` com "Caminho fora do projeto foi recusado." |
| Entrada enviada → workflow completo | `POST /run` com `params.sourceImage = 'input/Referencia-Heroi.PNG'` → `blocked` → 2 revisões aprovadas (retomada real) → **`succeeded`** em 5 passos; validações `animation-loop`, `png-content`, `spritesheet-manifest` e `destination-profile` = `passed`; 7 artefatos; export Godot 4.x com 7 arquivos, 60 fps, pivô `bottom-center`, `verifiedOnDestination: false` |
| Artefato final medido | folha **384×144** servida por `/artifact` com **21 cores** — as mesmas 21 cores da referência enviada pelo usuário, ou seja, o pipeline consumiu a entrada de verdade |

O envio de arquivos para **serviços externos** continua fora: nada sai da máquina, e a pendência de upload segue em §12.

## 8. Ciclo de vida do run: progresso, cancelamento e retomada

O engine já tinha cancelamento cooperativo e retomada por checkpoint, mas **nada disso chegava ao produto**: o snapshot do run só era gravado no fim (portanto não havia progresso para mostrar), nenhum canal permitia cancelar uma execução em andamento e um run interrompido só retomava se houvesse revisão pendente. Três correções, sem criar sistema paralelo:

- `shared/engine/execution-manager.mjs` grava o snapshot **a cada passo** (no início, com o passo em `running`, e no fim), por uma fila serializada: dois passos terminando juntos não se atropelam no mesmo arquivo, e falha ao gravar vira aviso no log do run, não queda da execução.
- `shared/services/studio-service.mjs` mantém o registro das execuções em andamento **neste processo** (`activeRuns()`), cria um `AbortController` por run (encadeando o signal do hospedeiro, quando existe) e expõe `cancelRun()` e `resumeRun()`. O motivo e a autoria do cancelamento são gravados no run (`cancellation` + entrada de log), com segredos redigidos.
- Transporte e interface: `GET /runs/active`, `POST /runs/{id}/cancel`, `POST /runs/{id}/resume` (404 quando o run não existe) e os canais IPC `lia-forge:studio:runs:active|cancel|resume`. A interface mostra o card "Execução em andamento" com o progresso passo a passo lido do disco, o botão **Cancelar execução** e, num run cancelado/pausado/falho, **Retomar do checkpoint**.

Cancelamento tem três casos e os três são ditos com clareza, porque confundir "parei" com "não havia o que parar" é exatamente o tipo de mentira que este registro evita:

| Caso | Comportamento |
|---|---|
| Run em execução neste processo | `ok: true`, `status: 'cancelling'`; o signal chega ao engine, o processo externo recebe `SIGTERM` e o passo para no próximo ponto de verificação; o run é gravado como `cancelled` com motivo e autoria |
| Run já encerrado (`succeeded`, `failed`, `blocked`…) | `ok: false` com o estado real no motivo e **nenhuma reescrita** em disco |
| Run marcado `running` sem execução aqui (o aplicativo foi fechado) | o estado gravado é corrigido para `cancelled` com `cancelled.executionPresent: false` e nota dizendo que não havia processo para parar; checkpoints de passos concluídos seguem válidos para retomada |

### O que foi executado de verdade

`tests/run-lifecycle-smoke.mjs` (novo) usa um **executável de teste** no lugar do Blender — que não está instalado aqui — e percorre o caminho real (`spawn` com os argumentos do contrato, signal até o processo filho, leitura de saída, validação, checkpoints):

| Verificação | Resultado medido |
|---|---|
| Progresso antes do fim | snapshot em disco com `inspect: succeeded` e `render: running` enquanto a ferramenta externa trabalha |
| Cancelamento | run `cancelled`, passo `cancelled` com `WORKFLOW_CANCELLED`, dependentes `skipped`, nenhum passo preso em `running`, motivo no log |
| Processo externo | PID gravado pelo executável de teste **deixa de existir** após o cancelamento (não ficou rodando sozinho) |
| Cancelar duas vezes | segunda chamada devolve `ok: false` e o `run.json` fica byte a byte igual |
| Retomada | `resumeRun` com 1 checkpoint reaproveitado, `finishedAt` do passo concluído idêntico (não reexecutou), evento `step-reused` no histórico, run termina `succeeded` com o processo externo real |
| Falha intermediária | executável que sai com código 3 → run `failed`, mensagem com o código de saída e o stderr preservado, dependentes `skipped`; após trocar o executável, `resumeRun` sai do `failed` e conclui |
| Run órfão | `run.json` escrito à mão como `running` → `cancelRun` devolve `stale: true`, grava `cancelled` com `executionPresent: false`, mantém o passo concluído e marca o que estava em andamento como cancelado; `resumeRun` sem `plan.json` é recusado com motivo claro |
| Recusas | `cancelRun`/`resumeRun` com caminho como `runId`, run inexistente, run concluído, run ainda em execução |

O mesmo caminho foi exercitado **por HTTP no dev-server** (projeto real em disco, executável de teste): `GET /runs/active` devolveu o run com `render: running`; `POST /runs/{id}/cancel` devolveu `cancelling` e o estado final gravado foi `cancelled` com `cancellation.reason = "usuário desistiu desta geração"` e `cancelledBy = "validação HTTP"`; o processo de teste (PID 2708) não estava mais vivo; `POST /runs/{id}/resume` reaproveitou 1 checkpoint e terminou `succeeded` com `png-structural`, `png-content` e `destination-profile` aprovados e 6 artefatos; `POST /runs/run-inexistente/cancel` devolveu `404`.

O que **não** foi executado aqui: cancelamento/reconciliação de uma chamada remota já enviada (ComfyUI remoto segue não autorizado — ver §12) e o comportamento após queda abrupta do processo do produto (o run órfão é corrigido pelo caminho acima, mas a reconciliação de requisições de API duplicadas continua como alvo em `WORKFLOW-ENGINE.md`).

## 9. Testes que provam o acima

| Comando | Resultado |
|---|---|
| `npm test` | **30 smokes verdes** (Node 22, sem rede; o smoke de integração usa processo e HTTP loopback reais, sem ferramenta externa instalada) |
| `npm run test:python` | **30 testes OK** |
| `npx vite build` | build de produção sem erro |

Nesta rodada, `tests/run-lifecycle-smoke.mjs` é novo (ciclo de vida do run: progresso por passo, cancelamento com processo externo encerrado, falha intermediária, retomada por checkpoint, run órfão e recusas — ver §8), os substitutos de ferramenta externa foram reunidos em `tests/tool-stubs.mjs` (usados pelo smoke de ciclo de vida e pelo de integração, sem duplicar código), `tests/studio-ui-render-smoke.mjs` passou a cobrir `GET /runs/active` e `POST /runs/{id}/cancel|resume` e `tests/studio-service-smoke.mjs` ganhou a seção 11 (medição de entradas, sanitização de nome, colisão que ignora caixa, recusas de formato/conteúdo/teto, leitura confinada e Comparison Lab com caminho recusado) e `tests/studio-ui-render-smoke.mjs` passou a enviar um arquivo por HTTP, conferir `400`/`403`, servir a prévia, comparar artefatos, gravar a escolha como versão do asset e renderizar `InputPicker` e `ComparisonLab`.

Smokes novos/estendidos nesta fase: `tests/host-integration-smoke.mjs` (novo: integração real com processo externo e ComfyUI em loopback, providers, recusas e gates — ver §6), `tests/workflow-coverage-smoke.mjs` (novo: 11 casos sobre os 8 workflows, com matriz de evidência impressa), `tests/studio-service-smoke.mjs` (passo opcional que produz prévia e passo opcional com erro que vira skip), `tests/orchestrator-engine-smoke.mjs` (entradas pendentes, `pendingInputs`, bloqueio nomeado por passo), `tests/studio-ui-render-smoke.mjs` (rig entre runs pela API, entradas pendentes, validações e o painel de providers renderizados na UI), `tests/preflight-destinations-smoke.mjs` (conformidade do pacote com o perfil publicado do destino), `tests/adapter-sdk-smoke.mjs` (caminho de executável inválido não vira ferramenta disponível), `tests/studio-service-smoke.mjs` (brief como entrada de texto do passo de conceito).

## 10. O que **não** foi executado (e o que seria necessário)

| Item | Estado | O que falta |
|---|---|---|
| Render 3D real (Blender) | não executado na ferramenta real | Blender instalado pelo usuário + modelo de entrada. O caminho completo (descoberta, `spawn`, argumentos, artefato em disco, validação de conteúdo, proveniência) foi executado com um **substituto de teste rotulado** — ver §6 |
| Geração 2D por difusão (ComfyUI) | não executada na ferramenta real | servidor ComfyUI instalado pelo usuário e checkpoint já presente nele. O caminho completo (HTTP loopback, grafo com checkpoint e prompt, download do PNG, validação de conteúdo) foi executado com um **servidor de teste rotulado** — ver §6 |
| Importação em engine de destino (Godot/Unity/Unreal) | não executada | nenhuma engine está instalada aqui. O que é executado: conformidade do pacote com o perfil publicado do destino (formatos, fps, eixos, SHA-256) — `verifiedOnDestination` continua `false` |
| Backend remoto / GPU alugada / hosted | não autorizado | decisão humana sobre envio de dados e teto de custo; arquitetura pronta, execução pendente |
| GPU/Vulkan (RX 580, gfx803) | não medido aqui | máquina alvo com driver; nada é afirmado sem evidência |
| Direitos das artes da Biblioteca | pendente | 6 itens `RIGHTS_PENDING` em `LIBRARY-VISUAL-REFERENCE-INVENTORY.md` |
| Envio de referências do usuário para serviço externo | não autorizado | o upload copia apenas para `input/` do projeto; enviar para fora exige decisão humana (serviço, escopo e custo) |

## 11. Commits da fase T13 (branch `arena/649f88bd-3dspritesheet`)

| Commit | Conteúdo |
|---|---|
| `8ba0abe` | F0 — inventário Git, dependências instaladas, reconciliação sem perder histórico |
| `95fb41d` | F1/F2/F3/F7 — registro de capacidades, Adapter SDK, QA de conteúdo, capacidades 2D/2.5D internas |
| `8ec3371` | inventário verificado das referências visuais (§3 do doc de inventário) |
| `f2d6810` | F4/F5/F6/F8 — orquestrador, engine de execução, Hub, Asset Manager e serviço do Studio |
| `636724a` | F8 na interface — página "Pipeline de Produção" ligada ao serviço real (HTTP + IPC) |
| `b83bf49` | §12.1 — 8 workflows funcionais, validação declarada executada, estados honestos, retomada fiel |
| `ef777e4` | documentação de execução (este registro) + cabeçalhos reconciliados com o código |
| `28a99a5` | ferramentas reais em qualquer hospedeiro, providers configuráveis (local/remoto/desativado), correções de honestidade no Hub e nos adapters, smoke de integração real |
| `aa91b89` | documentação de execução da integração real (§6) e cabeçalhos reconciliados |
| `c087602` | entradas do usuário em `input/` (upload, verificação de conteúdo, leitura confinada) e Comparison Lab com registro da escolha como versão do asset |
| `bedcdae` | documentação de execução das entradas e do Comparison Lab (§7) |
| `ea6a9f0` | ciclo de vida do run: snapshot gravado a cada passo, `cancelRun`/`resumeRun`/`activeRuns` nos dois transportes, botões de cancelar e retomar e smoke de cancelamento/falha/retomada |

## 12. Pendências que exigem decisão humana

Adoção de Spine ou de qualquer provider comercial/de IA · alternativa A de identidade Studio × Forge · licenças incertas (`2DAutoRigger`, `see-through`, MotionBricks) · backend remoto pago e teto de custo · upload de arquivos · instalação/download de ferramentas de terceiros · execução dos scripts de diagnóstico na máquina alvo (Windows + RX 580) · direitos das 6 artes `RIGHTS_PENDING`.

Enquanto não houver decisão, o produto mantém o caminho alternativo implementado, marca a pendência no plano (`userActions` com `canBeAutomated: false`) e não finge capacidade.
