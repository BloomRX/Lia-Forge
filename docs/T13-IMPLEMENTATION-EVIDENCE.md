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

## 6. Testes que provam o acima

| Comando | Resultado |
|---|---|
| `npm test` | **28 smokes verdes** (Node 22, sem rede, sem ferramentas externas) |
| `npm run test:python` | **30 testes OK** |
| `npx vite build` | build de produção sem erro |

Smokes novos/estendidos nesta fase: `tests/workflow-coverage-smoke.mjs` (novo: 11 casos sobre os 8 workflows, com matriz de evidência impressa), `tests/studio-service-smoke.mjs` (passo opcional que produz prévia e passo opcional com erro que vira skip), `tests/orchestrator-engine-smoke.mjs` (entradas pendentes, `pendingInputs`, bloqueio nomeado por passo), `tests/studio-ui-render-smoke.mjs` (rig entre runs pela API, entradas pendentes e validações renderizadas na UI).

## 7. O que **não** foi executado (e o que seria necessário)

| Item | Estado | O que falta |
|---|---|---|
| Render 3D real (Blender) | não executado | Blender instalado pelo usuário + arquivo `.blend`/GLB de entrada; o adapter existe e reporta `missing` |
| Geração 2D por difusão (ComfyUI) | não executado | servidor ComfyUI local autorizado; o adapter existe e recusa loopback não autorizado |
| Backend remoto / GPU alugada / hosted | não autorizado | decisão humana sobre envio de dados e teto de custo; arquitetura pronta, execução pendente |
| GPU/Vulkan (RX 580, gfx803) | não medido aqui | máquina alvo com driver; nada é afirmado sem evidência |
| Validação no destino (Godot/Unity/Unreal) | não executada | importar o pacote na engine; `verifiedOnDestination` continua `false` por honestidade |
| Direitos das artes da Biblioteca | pendente | 6 itens `RIGHTS_PENDING` em `LIBRARY-VISUAL-REFERENCE-INVENTORY.md` |

## 8. Commits da fase T13 (branch `arena/649f88bd-3dspritesheet`)

| Commit | Conteúdo |
|---|---|
| `8ba0abe` | F0 — inventário Git, dependências instaladas, reconciliação sem perder histórico |
| `95fb41d` | F1/F2/F3/F7 — registro de capacidades, Adapter SDK, QA de conteúdo, capacidades 2D/2.5D internas |
| `8ec3371` | inventário verificado das referências visuais (§3 do doc de inventário) |
| `f2d6810` | F4/F5/F6/F8 — orquestrador, engine de execução, Hub, Asset Manager e serviço do Studio |
| `636724a` | F8 na interface — página "Pipeline de Produção" ligada ao serviço real (HTTP + IPC) |
| `b83bf49` | §12.1 — 8 workflows funcionais, validação declarada executada, estados honestos, retomada fiel |

## 9. Pendências que exigem decisão humana

Adoção de Spine ou de qualquer provider comercial/de IA · alternativa A de identidade Studio × Forge · licenças incertas (`2DAutoRigger`, `see-through`, MotionBricks) · backend remoto pago e teto de custo · upload de arquivos · instalação/download de ferramentas de terceiros · execução dos scripts de diagnóstico na máquina alvo (Windows + RX 580) · direitos das 6 artes `RIGHTS_PENDING`.

Enquanto não houver decisão, o produto mantém o caminho alternativo implementado, marca a pendência no plano (`userActions` com `canBeAutomated: false`) e não finge capacidade.
