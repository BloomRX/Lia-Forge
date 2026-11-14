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

### Transporte IPC: coerência entre os três lados e guard por canal

O Studio fala com o **mesmo** `createStudioService` por dois transportes (HTTP no navegador/preview, IPC no desktop), e o transporte IPC depende de três arquivos combinarem: `src/lia-forge-api.js` (quem chama), `electron/preload.cjs` (o que é exposto) e `electron/main.cjs` (o que responde). Um método esquecido em um deles não aparece em nenhum teste de serviço — só quebraria no aplicativo empacotado, que é justamente o que não se executa aqui. `tests/ipc-coherence-smoke.cjs` (**novo**, 58 checagens por análise estática, sem abrir janela nem exigir Electron instalado) fecha essa lacuna:

| Verificação | Resultado medido |
|---|---|
| Cliente → preload | os **30** métodos que `liaForgeApi` chama no bridge existem no bloco `studio` do preload |
| Preload → main | os **30** canais `lia-forge:studio:*` têm `ipcMain.handle`; nenhum botão morto no desktop |
| Main → preload | nenhum handler do Studio ficou sem exposição (superfície igual dos dois lados) |
| Guard por canal | **todos** os 30 handlers chamam `assertTrustedIpcSender(event)` antes de tocar no serviço, e o guard delega para `electron/ipc-guard.cjs` com a janela e a navegação confiável |
| Paridade de transporte | cada método alcança o mesmo método de serviço pela rota HTTP do dev-server — nenhum é só do desktop nem só do navegador |
| Exceções documentadas | `chooseProject`, `revealProject` e `pickInput` são diálogos nativos: existem só no IPC e o cliente devolve `null` no navegador, em vez de fingir que abriu um diálogo |
| Disciplina de canais | namespace `lia-forge:` em todos; `invoke`↔`handle`, `send`↔`on`, `on` do renderer↔`webContents.send` do main; preload não expõe `ipcRenderer` cru; assinatura de eventos devolve como cancelar a escuta |
| Janela endurecida | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, preload do repositório, abertura de janela negada e `will-navigate`/`will-redirect` bloqueando origem não confiável |

Isso é verificação estática de coerência, **não** execução do aplicativo empacotado: continua em §12 que o app com interface gráfica não foi executado neste ambiente.

Correção de teste desta rodada: `tests/run-lifecycle-smoke.mjs` enviava o cancelamento assim que o snapshot mostrava o passo em andamento, o que podia chegar **antes** de o substituto de teste gravar o PID (o Node leva alguns milissegundos para iniciar). O teste dependia de corrida e falhou de forma intermitente com a máquina ocupada; agora ele espera o PID gravado e o processo vivo antes do sinal, e passou três vezes seguidas.

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
- **ter o Blender instalado quebrava os workflows 2D.** `render.atlas` e `motion.cycles` são capacidades compartilhadas entre o renderer 2D interno e o Blender, e a escolha entre candidatos prontos caía em ordem alfabética: com o Blender configurado, o atlas de `2d-character-parts` era entregue a ele e bloqueava pedindo "modelo animado, pasta de saída, script, personagem e dimensões" — entradas que um pipeline 2D nunca produz. O Adapter SDK ganhou o hook **opcional** `canHandle(context)` (os 15 campos do manifesto e as 3 classes seguem iguais), o Hub consulta esse critério com o contexto do passo (workflow, família, params com a entrada do usuário, capacidades de montante transitivas) e marca o candidato com `applicable`/`applicabilityReason`, ordenando os não aplicáveis por último. O Blender só entra em `render.atlas`/`motion.cycles` com material 3D de montante ou modelo informado; o renderer 2D só desenha atlas com `task: 'render'` quando há pipeline 2D de montante (`pack-atlas` serve a qualquer origem). Sem contexto, a escolha anterior permanece;
- a descoberta dizia "Blender encontrado em `<caminho>`" mesmo quando o caminho era um arquivo indicado pelo usuário e **nenhuma versão tinha sido medida**. O pré-voo confere existência e permissão de execução — ele não executa o arquivo, porque rodar `--version` de um caminho digitado pelo usuário seria executar código arbitrário no pré-voo. A mensagem agora diz o que foi medido e o que não foi: `executableSource` (`user-configuration` ou `path`) e `versionConfirmed: false` saem da descoberta, são repassados por `preflight` e pelo Hub, e o painel **Ferramentas & requisitos** mostra os três (executável, origem dele e "versão detectada: não confirmada — o pré-voo mede existência e permissão de execução, mas não executa o arquivo");
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
| Origem do executável | provider e pré-voo devolvem `executableSource: 'user-configuration'` e `versionConfirmed: false`, com a mensagem "A identidade como Blender não foi confirmada: a descoberta não executa o arquivo (nenhum `--version` foi rodado)" |
| Recusas | endpoint não-loopback no modo local, campo de segredo, caminho de executável inválido, provider desativado |

A seleção por passo foi medida **por HTTP no dev-server** com o Blender configurado (substituto de teste rotulado) no projeto de preview:

| Plano | Passo | Adapter escolhido | O que o plano diz dos demais |
|---|---|---|---|
| `2d-character-parts` | `render` (`render.atlas`, task `render`) | `rig2d-software` | `blender-spritesheet ready` com `applicable: false` e o motivo (só entra com material 3D de montante) |
| `variation-retexture` | `atlas` (`pack-atlas`) | `rig2d-software` | Blender marcado como não aplicável |
| `3d-object-render` | `render` e `atlas` | `blender-spritesheet` | nenhum candidato descartado (os dois servem; o 3D vem primeiro) |
| `3d-character-spritesheet` | `animate` (`motion.cycles`) e `render-2d` | `blender-spritesheet` | montante 3D (`rig3d.auto`) qualifica o passo |

E o run completo de `2d-character-parts` no mesmo projeto — que antes parava bloqueado no atlas — chegou a **`succeeded`** com 24 frames, grade 8×3 de 48×48, validadores `animation-loop`, `png-content`, `spritesheet-manifest` e `destination-profile` aprovados, e pacote de exportação com 7 arquivos (`verifiedOnDestination: false`). Na interface, o passo do plano diz na hora qual ferramenta instalada não serve a ele e por quê, sem exigir que o usuário abra a lista de candidatos.

Medido também **por HTTP no dev-server** (projeto de preview com um substituto de teste configurado como executável): `GET /overview` devolve, para `blender-spritesheet`, `status: available`, `executableSource: user-configuration`, `versionConfirmed: false` e o detalhe `Caminho configurado por você (/home/user/lia-preview-tools/blender-render.mjs) existe e é executável. A identidade como Blender não foi confirmada: a descoberta não executa o arquivo (nenhum --version foi rodado).` — ou seja, o substituto rotulado aparece como o que é (um caminho executável configurado), nunca como "Blender instalado".

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

O envio de arquivos para **serviços externos** continua fora: nada sai da máquina, e a pendência de upload segue em §14.

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

Um run interrompido não podia ficar com cara de ocupado para sempre: `listRuns()` agora devolve `active` (está executando **neste processo**) e `stale` (o arquivo diz que está em andamento e não há execução aqui). A lista lateral mostra o item como **Interrompido**, explica o motivo e oferece as duas saídas no próprio item — *Corrigir estado* (grava `cancelled` com `executionPresent: false`) e *Retomar* (reaproveita os checkpoints que existem). Run `unreadable` continua `unreadable`, sem ser promovido a nenhum estado.

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
| Lista de runs durante a execução | `active: true` e `stale: false` enquanto o processo externo trabalha; depois do cancelamento, `active: false`, `stale: false`, `status: cancelled` |
| Run interrompido na lista | `run.json` gravado como `running` sem execução aqui → `stale: true`, `active: false`; após corrigir, `status: cancelled` e `stale: false` |
| Recusas | `cancelRun`/`resumeRun` com caminho como `runId`, run inexistente, run concluído, run ainda em execução |

Na interface, o item da lista (`SavedRunItem`) foi renderizado nos dois estados: run encerrado não oferece recuperação; run `stale` mostra "Interrompido", a explicação "não há execução neste processo" e os dois botões.

O mesmo caminho foi exercitado **por HTTP no dev-server** (projeto real em disco, executável de teste): `GET /runs/active` devolveu o run com `render: running`; `POST /runs/{id}/cancel` devolveu `cancelling` e o estado final gravado foi `cancelled` com `cancellation.reason = "usuário desistiu desta geração"` e `cancelledBy = "validação HTTP"`; o processo de teste (PID 2708) não estava mais vivo; `POST /runs/{id}/resume` reaproveitou 1 checkpoint e terminou `succeeded` com `png-structural`, `png-content` e `destination-profile` aprovados e 6 artefatos; `POST /runs/run-inexistente/cancel` devolveu `404`. Um run gravado à mão como `running` no projeto de preview apareceu em `GET /runs` com `stale: true, active: false`; `POST /runs/{id}/cancel` devolveu `ok: true, status: 'cancelled', stale: true` com a nota de que não havia execução neste processo, e a listagem seguinte passou a mostrar `status: cancelled, stale: false`.

O que **não** foi executado aqui: cancelamento/reconciliação de uma chamada remota já enviada (ComfyUI remoto segue não autorizado — ver §14) e o comportamento após queda abrupta do processo do produto (o run órfão é corrigido pelo caminho acima, mas a reconciliação de requisições de API duplicadas continua como alvo em `WORKFLOW-ENGINE.md`).

## 9. Projeto: a pasta de trabalho existe como passo 1

A jornada do produto começa em "criar projeto" e termina em "exportar", mas a pasta de trabalho não aparecia em lugar nenhum da interface: ela era decidida pelo ambiente (dev-server) ou pelo boot do Electron, e o usuário não tinha como saber onde os arquivos estavam, quanto havia de coisa lá, nem abrir outro projeto. Também não havia garantia escrita de que abrir um projeto não mexeria no que já existia.

- `shared/integrations/project-structure.mjs` (novo) é a única fonte desse conhecimento: um projeto é uma pasta com `input/` (referências e modelos) e `.lia-forge/` (estado produzido: runs, providers, exports). `inspectProjectStructure()` lê sem escrever (existência, permissão de escrita, contagens, o que será preservado); `ensureProjectStructure()` cria **apenas** `input/` e `.lia-forge/runs/` quando faltam e devolve a lista do que criou, do que já existia e do que é preservado. Raiz vazia é recusada antes de `path.resolve` — sem isso o diretório de trabalho atual viraria projeto; arquivo e symlink como raiz também são recusados.
- `.spriteforge/` (store de versões anteriores) e `.lia.json` (formato de importação do destino Lia Desktop, gravado por asset) são detectados, listados como preservados e **nunca** movidos, convertidos, renomeados ou reescritos. Nenhum `.lia.json` de projeto é criado: aquele nome já tem dono no contrato de destino.
- Serviço: `projectInfo()` combina a estrutura com o que o produto tem lá dentro (entradas, runs, assets, execuções em andamento) e diz explicitamente se há conteúdo legado preservado.
- Transportes: `GET /api/lia-forge/studio/project` (somente leitura — `POST` devolve `405`, porque trocar de projeto por HTTP significaria escrever fora da raiz servida) e os canais IPC `lia-forge:studio:project:info|choose|reveal`. No desktop, `choose` abre o seletor de pasta, cria a estrutura mínima, troca a raiz do serviço (que já invalida o cache quando a raiz muda), grava o último projeto em `userData/last-project.json` e recusa a troca se houver execução em andamento; `reveal` abre a pasta no gerenciador de arquivos. No boot, o último projeto só é usado se a pasta ainda existir — caminho que sumiu volta ao padrão em vez de ser recriado.
- Interface: painel **Projeto** no topo da coluna lateral com a pasta, as contagens, o aviso de conteúdo legado preservado, o aviso quando não há permissão de escrita e os botões de abrir/criar/revelar (só no desktop; no navegador a origem da pasta é dita em vez de oferecer ação que não existe). Trocar de projeto limpa o run, a exportação e a comparação exibidos, para ninguém ver artefato de outro projeto.

### O que foi executado de verdade

| Verificação | Resultado medido |
|---|---|
| Leitura sem escrita | `inspectProjectStructure` de pasta inexistente devolve `exists:false, writable:false` e a pasta **não** é criada |
| Criação mínima | `ensureProjectStructure` cria exatamente `input/` e `.lia-forge/runs/`; a chamada seguinte não cria nada e diz que a estrutura já existia |
| Preservação | `.spriteforge/assets.json`, `.lia.json` e um arquivo de usuário (`brief-do-usuario.md`) sobrevivem **byte a byte** à abertura do projeto e aparecem em `preserved` |
| Serviço | `projectInfo()` informa a mesma raiz, as contagens (1 entrada, 0 runs), `legacy.spriteforge/liaManifest` e a nota de preservação |
| Recusas | arquivo como raiz, symlink como raiz e raiz vazia (com verificação de que nada foi criado fora do caminho informado) |
| HTTP no dev-server | `GET /project` devolve `root=/home/user/lia-preview-project`, `writable:true`, `counts {inputs:2, runs:1, assets:0}`, `preserved [input, .lia-forge, .lia-forge/runs, .lia-forge/providers.json]`, `managedHere:false` com a nota sobre `SPRITEFORGE_PROJECT_ROOT`; `POST /project` → `405` |
| Interface | `ProjectPanel` renderizado nos dois transportes: no navegador mostra a pasta e a origem dela sem oferecer troca; no desktop oferece abrir, criar e revelar, e mostra o conteúdo legado como preservado |

O que **não** foi executado aqui: o seletor de pasta e o `shell.openPath` são código do processo principal do Electron e exigem o aplicativo rodando em uma máquina com interface gráfica — neste ambiente (sem display) eles foram verificados por código, contrato de canais e pelos mesmos caminhos de serviço/estrutura exercitados nos testes.

## 10. Roteiro de produção: os 12 passos visíveis

A experiência pedida é "criar projeto → exportar" em 12 passos, mas a interface tinha cinco seções numeradas e nenhuma visão do caminho inteiro: quem não conhece Blender nem ComfyUI não sabia o que vem depois, nem o que já estava feito. O painel **Roteiro de produção** (`JourneyChecklist`, no topo da coluna principal) resolve isso com uma regra que vale para os 12 itens: **o estado é derivado de dados reais** — nada é decorativo e nada é marcado como concluído sem a evidência correspondente.

| # | Passo | Vira "concluído" quando | Vira "decisão sua" quando |
|---|---|---|---|
| 1 | Abrir a pasta do projeto | `projectInfo()` diz que a pasta existe e é gravável | — |
| 2 | Enviar referências e modelos | há entradas listadas em `input/` | — |
| 3 | Escolher o objetivo | existe plano ou run para o workflow escolhido | — |
| 4 | Descrever em uma frase | o brief tem texto (e o plano não pede `prompt` pendente) | — |
| 5 | Conferir requisitos e ferramentas | o plano não tem passos bloqueados | `plan.blockedSteps` existe: instalar, autorizar ou escolher provider é humano |
| 6 | Ler o plano antes de executar | `plan` está na tela | — |
| 7 | Executar | existe run | — |
| 8 | Acompanhar (ou cancelar) | o run está encerrado (`summary.finished`) | run gravado como em andamento **sem execução neste processo** (`runStale`): corrigir o estado ou retomar é humano |
| 9 | Revisar os artefatos | run encerrado sem revisão pendente | run `blocked`: a aprovação é humana e fica amarrada ao SHA-256 |
| 10 | Comparar variações | há comparação medida no Comparison Lab (passo opcional) | — |
| 11 | Exportar para o destino | existe pacote exportado, com "verificado no destino: não" dito no próprio passo | — |
| 12 | Guardar no projeto | há versão registrada no asset ou asset com versões/proveniência | — |

As decisões humanas aparecem com **título e motivo** no próprio aviso, sem precisar abrir a lista dos 12 passos — é o que impede o usuário de achar que o produto vai instalar, autorizar ou recuperar algo sozinho. O passo 8 usa o mesmo campo `stale` que a lista lateral de runs usa (`listRuns()`), derivado na interface uma única vez: não há dois cálculos para o mesmo fato.

A derivação mora em `shared/ui/journey.mjs` — lógica pura, sem React e sem módulo do Node — e a interface importa de lá: navegador, testes em Node e qualquer consumidor futuro (CLI, processo principal) calculam o roteiro no **mesmo** lugar, sem segunda versão que possa divergir. Junto sai `journeyProgress(steps)`, o resumo que o painel mostra (`total`, `done`, `percent`, `next` e `humanDecisions`), para que a contagem exibida e a conferida nos testes sejam o mesmo cálculo. Dois detalhes que vieram dessa mudança: sem pasta aberta existe **um único** passo atual (abrir o projeto), em vez de dois apontando ao mesmo tempo; e o passo de comparar concluído diz que o Comparison Lab mede e a escolha é do usuário.

Importar na engine **não é passo do produto** e não aparece como concluído: quando o pacote existe e `verifiedOnDestination` é `false`, o roteiro diz que o pacote confere com o perfil publicado do destino e que importar e conferir lá é com o usuário. Da mesma forma, passos que exigem instalação ou autorização aparecem com o ícone de decisão humana e o texto do que só o usuário pode fazer — o produto não instala, não compra e não autoriza nada por conta própria.

### O que foi executado de verdade

Dois testes cobrem o roteiro. `tests/journey-smoke.mjs` (**novo**, 74 checagens) **percorre a jornada inteira** com o serviço real sobre um projeto temporário, derivando o roteiro a cada parada com a mesma função da interface:

| Parada | Progresso medido |
|---|---|
| Nada aberto | `0 de 12`; próximo passo = 1 (abrir a pasta); um único passo atual |
| Pasta criada (`ensureProjectStructure` + `projectInfo()`) | `1 de 12`; próximo = enviar a referência |
| Referência enviada (`saveInput`, medida ao entrar: 48×48, `contentChecked`) | `2 de 12` |
| Plano com brief (`2d-character-parts` → `godot-4`) | `6 de 12`; próximo = executar |
| Execução que para no gate humano (`blocked`, sem nenhum passo `failed`) | `8 de 12`; próximo = revisar (detalhe cita o SHA-256) |
| Decisões humanas aprovadas → `succeeded` | `9 de 12`; próximo = exportar |
| Comparison Lab medindo 2 artefatos | `10 de 12` |
| Pacote exportado (`verifiedOnDestination: false`) | `11 de 12`; próximo = guardar |
| Versão registrada no asset | **`12 de 12`**, nenhum passo atual pendente, nenhuma decisão humana sobrando |

Trilha medida: `0 → 1 → 2 → 6 → 8 → 9 → 10 → 11 → 12`, com a checagem de que o progresso nunca avançou sem a evidência correspondente. Os dois cenários alternativos (objetivo `3d-character-spritesheet` sem provider nesta máquina e run interrompido com `runStale`) são registrados **fora da trilha**, como decisão humana — não como progresso. No caso do run interrompido, o mesmo passo volta a ser o passo atual quando há execução viva (`liveRun`) e run encerrado não vira interrompido só porque o sinal chegou. A honestidade foi verificada tirando uma evidência por vez do estado completo: sem pacote, o passo 11 sai da contagem (e só ele); sem comparação, o passo 10 volta a `optional`; sem run, `execute`/`follow`/`review` saem; sem versão guardada, o passo 12 sai; sem pasta, o passo 1 volta a ser o atual; sem brief, o passo 4 sai; estado vazio = `0 de 12`. No fim, o atlas do run é medido no disco: **384×144**, grade 8×3, 24 frames, com conteúdo.

`tests/studio-ui-render-smoke.mjs` deriva o roteiro três vezes, com dados reais vindos da API (projeto, entradas, plano com passos bloqueados, run `succeeded`, pacote exportado, versão de asset):

| Cenário | Resultado medido |
|---|---|
| Início (projeto aberto + 1 entrada, sem plano) | 12 passos numerados; **2 de 12** concluídos; passo atual = "3 · Escolher o objetivo"; nada além do que tem evidência |
| Plano com passo sem provider | `plan` e `brief` concluídos; **requisitos = decisão humana** com o texto "Instalar ou autorizar é decisão sua"; passo atual = "7 · Executar" |
| Jornada completa (run `succeeded` + export + versão gravada) | 11 passos concluídos, nenhum passo atual pendente, exportação dizendo "verificado no destino: não" |
| Render | o painel aparece com "Roteiro de produção", "2 de 12 passos", "Passo 3 — Escolher o objetivo" e a lista completa a um clique |
| Render com run interrompido | o roteiro diz "não há execução neste processo", apresenta a recuperação como decisão do usuário e **não** mostra o texto de execução viva |

## 11. Testes que provam o acima

| Comando | Resultado |
|---|---|
| `npm test` | **33 smokes verdes** (Node 22, sem rede; o smoke de integração usa processo e HTTP loopback reais, sem ferramenta externa instalada) |
| `npm run test:python` | **30 testes OK** |
| `npx vite build` | build de produção sem erro |

O que cada smoke prova, por arquivo (novos ou estendidos na fase T13):

- `tests/ipc-coherence-smoke.cjs` (**novo**): coerência estática entre cliente, preload e processo principal (30 métodos/30 canais), guard de IPC em todos os handlers do Studio, paridade de transporte com o HTTP e janela endurecida (§5).
- `tests/journey-smoke.mjs` (**novo**): a jornada de 12 passos percorrida de ponta a ponta com o serviço real, com o roteiro derivado a cada parada e a honestidade verificada removendo uma evidência por vez (§10).
- `tests/project-structure-smoke.mjs` (**novo**): leitura que não escreve, criação limitada a `input/` e `.lia-forge/runs/`, `.spriteforge/assets.json`, `.lia.json` e um arquivo do usuário preservados byte a byte, `projectInfo()` coerente com o disco e raízes inválidas (arquivo, symlink, caminho vazio) recusadas — com verificação de que nada foi criado fora do caminho informado (§9).
- `tests/run-lifecycle-smoke.mjs` (**novo**): progresso gravado antes do fim do run, cancelamento com o processo externo encerrado de verdade, cancelar duas vezes sem reescrever nada, retomada por checkpoint sem reexecutar passo concluído, falha intermediária com código de saída e stderr preservados, retomada depois da falha, run órfão corrigido sem fingir execução e recusas nomeadas (§8).
- `tests/tool-stubs.mjs` (**novo**): os substitutos de ferramenta externa (renderizador, lento e falho) reunidos num módulo só, usados pelo smoke de ciclo de vida e pelo de integração — sem duplicar código e sempre rotulados como substitutos.
- `tests/studio-ui-render-smoke.mjs` (estendido): roteiro de 12 passos derivado em três cenários reais e renderizado, item de run interrompido (§10 e §8) e a nota do plano sobre ferramenta instalada que não serve ao passo (§6); projeto por `GET /project`, `405` em `POST` e `ProjectPanel` nos dois transportes (§9); `GET /runs/active` e `POST /runs/{id}/cancel|resume` (§8); envio de arquivo por HTTP com `400`/`403`, prévia servida, comparação de artefatos, escolha gravada como versão do asset e `InputPicker`/`ComparisonLab` renderizados (§7); rig entre runs pela API, entradas pendentes, validações e o painel de providers na UI (§6).
- `tests/studio-service-smoke.mjs` (estendido): seção 11 com medição de entradas, sanitização de nome, colisão que ignora caixa, recusas de formato/conteúdo/teto, leitura confinada a `input/` e Comparison Lab com caminho recusado (§7); passo opcional que produz prévia, passo opcional com erro que vira skip e brief como entrada de texto do passo de conceito.
- `tests/host-integration-smoke.mjs` (**novo** nesta fase): integração real com processo externo e ComfyUI em loopback, providers, recusas, gates e a descoberta que diz a origem do executável sem afirmar versão não medida (§6).
- `tests/workflow-coverage-smoke.mjs` (**novo** nesta fase): 11 casos sobre os 8 workflows, com a matriz de evidência impressa (§3).
- `tests/orchestrator-engine-smoke.mjs` (estendido): entradas pendentes, `pendingInputs`, bloqueio nomeado por passo e a regressão de seleção com Blender **e** adapters internos prontos (atlas 2D e retexture no renderer interno com motivo no plano; render/atlas 3D e animações do contrato humanoide no Blender; `select` sem contexto inalterado).
- `tests/preflight-destinations-smoke.mjs` (estendido): conformidade do pacote com o perfil publicado do destino.
- `tests/adapter-sdk-smoke.mjs` (estendido): caminho de executável inválido não vira ferramenta disponível; contrato do hook `canHandle` (recusa de não-função, veredictos de Blender e renderer 2D por capacidade/origem, adapters sem hook inalterados).

## 12. O que **não** foi executado (e o que seria necessário)

| Item | Estado | O que falta |
|---|---|---|
| Render 3D real (Blender) | não executado na ferramenta real | Blender instalado pelo usuário + modelo de entrada. O caminho completo (descoberta, `spawn`, argumentos, artefato em disco, validação de conteúdo, proveniência) foi executado com um **substituto de teste rotulado** — ver §6 |
| Geração 2D por difusão (ComfyUI) | não executada na ferramenta real | servidor ComfyUI instalado pelo usuário e checkpoint já presente nele. O caminho completo (HTTP loopback, grafo com checkpoint e prompt, download do PNG, validação de conteúdo) foi executado com um **servidor de teste rotulado** — ver §6 |
| Importação em engine de destino (Godot/Unity/Unreal) | não executada | nenhuma engine está instalada aqui. O que é executado: conformidade do pacote com o perfil publicado do destino (formatos, fps, eixos, SHA-256) — `verifiedOnDestination` continua `false` |
| Backend remoto / GPU alugada / hosted | não autorizado | decisão humana sobre envio de dados e teto de custo; arquitetura pronta, execução pendente |
| Seletor de pasta e "ver no sistema" (Electron) | não executado aqui | exigem o aplicativo com interface gráfica; o serviço, a estrutura de projeto e os canais foram executados por teste e por HTTP — ver §9 |
| GPU/Vulkan (RX 580, gfx803) | não medido aqui | máquina alvo com driver; nada é afirmado sem evidência |
| Direitos das artes da Biblioteca | pendente | 6 itens `RIGHTS_PENDING` em `LIBRARY-VISUAL-REFERENCE-INVENTORY.md` |
| Envio de referências do usuário para serviço externo | não autorizado | o upload copia apenas para `input/` do projeto; enviar para fora exige decisão humana (serviço, escopo e custo) |

## 13. Commits da fase T13 (branch `arena/649f88bd-3dspritesheet`)

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
| `d650e09` | documentação de execução do ciclo de vida do run (§8) e reconciliação do cabeçalho de `WORKFLOW-ENGINE.md` |
| `c739c46` | projeto como passo 1: `project-structure.mjs`, `projectInfo()`, `GET /project`, canais IPC de abrir/criar/revelar, painel Projeto e smoke de preservação |
| `3cf7aa5` | documentação de execução do projeto como passo 1 (§9) |
| `59dbe81` | roteiro de produção na interface: 12 passos derivados do estado real, decisões humanas marcadas como tais e smoke nos três cenários |
| `85074e6` | documentação do roteiro de 12 passos (§10) e seção de testes reorganizada por smoke |
| `03846eb` | run interrompido: `listRuns()` diz `active`/`stale` e a lista lateral oferece corrigir o estado ou retomar |
| `87457fd` | documentação do run interrompido no ciclo de vida (§8) |
| `ce0eca0` | derivação do roteiro em `shared/ui/journey.mjs`, resumo compartilhado e `tests/journey-smoke.mjs` (32 smokes) |
| `7578539` | documentação da jornada medida parada a parada (§10) |
| `522740a` | descoberta honesta do Blender: origem do executável, `versionConfirmed: false` e o pré-voo que não executa o arquivo |
| `0b4e867` | documentação da descoberta honesta do executável (§6) |
| `f9a01c6` | smoke de coerência IPC/HTTP (33 smokes) e fim da corrida no teste de cancelamento |
| `1b2d012` | documentação da coerência dos transportes (§5) |
| `c889400` | run interrompido no roteiro de produção (`runStale` → passo 8 como decisão humana) e motivos das decisões visíveis |
| `86df145` | documentação do run interrompido no roteiro (§10) |
| `9c23d48` | seleção por passo: hook `canHandle`, Hub e planner conscientes do contexto, Blender fora do atlas 2D e nota visível no plano |

## 14. Pendências que exigem decisão humana

Adoção de Spine ou de qualquer provider comercial/de IA · alternativa A de identidade Studio × Forge · licenças incertas (`2DAutoRigger`, `see-through`, MotionBricks) · backend remoto pago e teto de custo · upload de arquivos · instalação/download de ferramentas de terceiros · execução dos scripts de diagnóstico na máquina alvo (Windows + RX 580) · direitos das 6 artes `RIGHTS_PENDING`.

Enquanto não houver decisão, o produto mantém o caminho alternativo implementado, marca a pendência no plano (`userActions` com `canBeAutomated: false`) e não finge capacidade.
