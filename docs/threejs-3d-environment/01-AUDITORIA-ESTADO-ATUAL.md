# 01 — Auditoria do estado atual (Lia Forge × 3D)

> **Método:** leitura direta do checkout, `grep` por termos-chave, execução de scripts Node para inspecionar o registro de capacidades e leitura dos documentos arquiteturais existentes. Nenhum teste em navegador real, GPU, Windows, Blender ou ComfyUI foi executado (a suíte Node/SSR do repositório foi rodada na revisão final; ver [`README`](README.md) §9).
> **Baseline Git:** branch `arena/c61c7ae8-lia-forge`, base `0b4e8671270a14d935e17138cac71366c0fe841f`, working tree limpo no início.
> **Regra:** “existe no código” não significa “funciona em runtime”. Onde não houve execução, está marcado.

## 1. Stack e forma de execução (observado)

| Item | Valor observado | Evidência |
|---|---|---|
| Runtime desktop | Electron `45.0.0` (Chromium `156.0.8078.48`, Node interno `24.22.0`) | `package.json`; release oficial `electron/v45.0.0` (2026-10-21) |
| UI | React `18.3.1` + Vite `6.4.5` | `package.json` |
| Node mínimo | `>=22.12.0` | `package.json` `engines` |
| Dependências de runtime | `@modelcontextprotocol/sdk`, `lucide-react`, `react`, `react-dom`, `zod` | `package.json` |
| Three.js | **ausente** | `package.json` e busca textual no código |
| WebGL/WebGPU no código | **ausente** | busca por `WebGL`, `WebGPU`, `three`, `canvas` em `src/`, `shared/`, `electron/` |
| Empacotamento | `electron-builder`, `asar: true`, Windows NSIS x64 | `package.json` `build` |
| Hosts de execução | Electron (IPC) **e** navegador/preview (HTTP same-origin), com o mesmo serviço | `src/lia-forge-api.js:1-20`, `vite.config.js:216+`, `shared/services/studio-service.mjs:1-12` |

Consequência: o app já tem **dois transportes para a mesma lógica**. Qualquer viewport 3D precisa nascer dentro desse padrão, não como um terceiro sistema.

## 2. O que existe de 3D hoje

### 2.1 Inspeção estrutural de GLB (implementada, sem imagem)

| Função | O que faz | Limite |
|---|---|---|
| `inspectGlb(bytes)` (`shared/model3d/glb.mjs:17`) | Valida cabeçalho/chunks GLB 2, lê o JSON e devolve: versão, tamanho, gerador, `extensionsUsed/Required`, contagem de cenas/nós, meshes com contagem de vértices/triângulos por primitiva, flags `hasNormals/hasUvs/hasJoints/hasWeights`, materiais (double-sided, alphaMode, baseColor/normal texture), texturas, imagens (mime, bufferView, uri), animações (canais, samplers, duração máxima, targets), skins (número de juntas), buffers, tipos de componente de accessor | **Não** devolve hierarquia real de nós, nomes de bones, bounds, tamanhos de textura, UVs, pesos, keyframes, versão de extensão por nó, nem valida o conteúdo binário |
| `summarizeGlb(info)` (`shared/model3d/glb.mjs:148`) | Resumo textual curto para cards/log | — |
| `validateGlbStructural(artifact)` (`shared/qa/validators.mjs:94`) | Validador `glb-structural`: assinatura, comprimento, primeiro chunk JSON, `meshes > 0` e métricas | Estrutural; não prova renderização, semântica nem qualidade |
| `describeInputBytes` (`shared/services/studio-service.mjs:438+`) | Em `input/`: para `.glb`, chama `inspectGlb` e expõe `meshCount`, `triangleCount`, materiais, animações, `skinned` | Só `.glb`; `.gltf/.fbx/.obj/.stl/.blend` ficam `contentChecked: false` |
| Adapter `glb-inspect` (`shared/adapters/software.mjs:598-668`) | Capability `model3d.inspect`; grava `model-report.json`; exige caminho dentro do projeto; limite padrão 256 MB | Lê o arquivo inteiro em memória; não renderiza |
| Passo `inspect` do planner (`shared/orchestrator/planner.mjs:96`) | Passo de workflow “Inspecionar modelo (GLB)” | Um passo, sem UI interativa |
| `Comparison Lab` (`src/ForgeStudio.jsx:931-1034`) | Compara lado a lado métricas de arquivos, incluindo `triangleCount` de GLB | Sem comparação visual 3D; só imagem para PNG/JPEG/WebP |

**Fato confirmado:** a Lia Forge sabe *ler o índice* de um GLB e dizer “3 meshes, 12.400 triângulos, 2 animações”. Ela **não** sabe desenhar esse modelo.

### 2.2 Pipeline Blender (existente, subprocesso)

| Peça | Papel | Evidência |
|---|---|---|
| `electron/blender-adapter.cjs` | Descobre Blender, monta argumentos, executa sem shell, registra processo | arquivo (180 linhas) |
| `scripts/blender_spritesheet.py` | Importa modelo existente, configura câmera/EEVEE, renderiza frames, empacota atlas + manifesto | arquivo + testes Python |
| `electron/spritesheet-manifest.cjs` | Valida manifesto `schemaVersion: 1`, `character` ou `item`, 8 colunas | arquivo + `tests/*` |
| `render3d.frame`, `render3d.to2d`, `render.atlas` | Capabilities `implemented` | `shared/capabilities/registry.mjs:165-168` |

**Fato confirmado:** o 3D hoje é **produção por Blender** e **leitura estrutural de GLB**. Não há renderização 3D em tempo real na Lia Forge.

### 2.3 UI atual de 3D

| Local | Estado real | Evidência |
|---|---|---|
| `ModelPreview` | Ilustração de guia com grade/eixos; rótulo “ILLUSTRATION · NOT A MODEL VIEWER”; quando há arquivo, diz “Arquivo(s) 3D registrado(s) · não visualizado(s) aqui” | `src/App.jsx:1394-1401` |
| `RigPreview` | Guia estático de rig; “no animation playback” | `src/App.jsx:1404-1418` |
| `InputPicker` | Aceita `.glb,.gltf,.fbx,.obj,.stl,.blend`; para `.glb` promete inspeção de meshes/triângulos/animações | `src/ForgeStudio.jsx:861`, `1609-1610` |
| `ComparisonLab` | Mostra `Triângulos` de um GLB ao comparar | `src/ForgeStudio.jsx:1006` |
| Assets | Taxonomia do store aceita apenas `character` e `item` | `shared/assets/manager.mjs:110+` |

**Fato confirmado:** a UI não mente sobre a ausência de viewport. Qualquer implementação deve preservar esse traço: ou mostra de verdade, ou diz que não mostra.

## 3. Capacidades registradas que tocam 3D (estado do registro, não do código)

Extraído executando `createCapabilityRegistry(BASE_CAPABILITIES).list()` nesta sessão (49 capacidades).

| Família | Capacidade | Status declarado | Observação da auditoria |
|---|---|---|---|
| 3d | `model3d.inspect` | `implemented` | Sustentado por `inspectGlb` + adapter + smoke |
| 3d | `model3d.generate` | `partial` | Passo contratual bloqueado sem provider |
| 3d | `model3d.model` | `planned` | Modelagem em DCC externo |
| 3d | `model3d.retopologize` | `planned` | — |
| 3d | `model3d.uv` | `planned` | Nenhum código de UV |
| 3d | `model3d.texture` | `planned` | — |
| 3d | `material.pbr` | `planned` | Nenhum inspetor de material |
| 3d | `model3d.bake` / `model3d.optimize` | `planned` | — |
| 3d | `model3d.export` | `partial` | `export-package` + allowlist por destino |
| 3d | `env.reconstruct`, `splat.ingest` | `planned` | Sem visualizador |
| character | `character.humanoid` | `partial` | Só render tem adapter |
| character | `character.hair`, `character.clothing` | `planned` | — |
| rigging-motion | `rig3d.auto` | `partial` | Passo bloqueado |
| rigging-motion | `rig3d.manual`, `motion.retarget`, `motion.edit` | `planned` | — |
| rigging-motion | `motion.cycles` | `implemented` | Matching de ações no renderer Blender |
| render-export | `render3d.frame`, `render3d.to2d`, `render.atlas`, `export.engine` | `implemented` | Blender/software renderer, não Three.js |
| render-export | `render.turntable` | `partial` | — |

**Não existe** nenhuma capacidade de *preview*, *viewport*, *material inspect*, *rig inspect* ou *animation preview* no registro. Isso é uma lacuna de vocabulário, não apenas de código.

## 4. Contratos e infraestrutura reaproveitáveis

| Componente | O que já entrega | Relevância para o viewport |
|---|---|---|
| **Asset Manager** (`shared/assets/manager.mjs`) | Store `.spriteforge/assets.json` compatível; versões com artefatos/`sha256`/`validator`; proveniência; direitos (`owned/licensed/license-pending/unknown/restricted/blocked`) | É onde uma alteração só vira “versão” quando o usuário decide |
| **Comparison Lab** (`studio-service.compareArtifacts`) | Até 8 caminhos, recusa fora do projeto, métricas reais por arquivo | Ponto natural para A/B de capturas e de relatórios |
| **QA** (`shared/qa/validators.mjs:356`) | Validadores: `png-structural`, `png-rgba8`, `png-content`, `spritesheet-manifest`, `glb-structural`, `model-extension`, `layers-integrity`, `rig2d-structural`, `animation-loop`, `format-allowlist`, `destination-profile`, `non-empty-text` | O viewport **não** pode inventar “aprovado”; pode produzir observações e chamar validadores existentes |
| **Preflight / Hub** (`shared/qa/preflight.mjs`, `shared/hub/provider-hub.mjs`) | Estados `ready/unknown/blocked/missing`; requisito não medido vira `unknown` | O backend gráfico (WebGL2/WebGPU) precisa entrar como requisito medido, não presumido |
| **Projetos** (`shared/integrations/project-structure.mjs`) | `input/`, `.lia-forge/runs/`; nada é apagado/movido; symlink recusado | Onde um GLB pode estar hoje |
| **Domínio** (`shared/domain/contracts.mjs`) | Protótipo de `Project/Asset/Artifact/AssetVersion/Provenance/ValidationResult` com validação de JSON | **Não é consumido por produção** (só `tests/domain-contracts-smoke.mjs`); um contrato de viewport não pode depender dele sem decisão |
| **Serviço único** (`shared/services/studio-service.mjs`) | Assets, runs, export, comparação, inputs, VFX | Padrão a seguir para qualquer rota nova |

## 5. Fronteiras de segurança observadas (importantes para 3D)

| Controle | Estado | Evidência |
|---|---|---|
| `contextIsolation: true` | ativo | `electron/main.cjs:876-881` |
| `nodeIntegration: false` | ativo | idem |
| `sandbox: true` | ativo | idem |
| `webSecurity: true` | ativo (não desabilitado) | idem |
| Preload mínimo via `contextBridge` | ativo | `electron/preload.cjs` |
| Validação de remetente IPC + navegação confiável | ativo | `electron/ipc-guard.cjs`, `electron/navigation-guard.cjs`, `electron/main.cjs:207-217` |
| Leitura de artefato confinada a `.lia-forge/runs/` | ativo; teto 6 MB; recusa symlink | `electron/main.cjs:1215-1235` |
| Leitura de entrada confinada a `input/` | ativo; teto 6 MB | `shared/services/studio-service.mjs:1372-1383` |
| Upload de entrada | teto 32 MB; nome sanitizado; não sobrescreve | `shared/services/studio-service.mjs:44`, `519`, `1330` |
| Protocolo customizado (`protocol.handle`) | **não existe** | busca em `electron/main.cjs` |
| Content-Security-Policy | **não existe** (nem meta, nem header) | `index.html` sem CSP; nenhum header no Vite/Electron |
| Tratamento de `webglcontextlost` / `render-process-gone` | **não existe** | busca em `electron/main.cjs` e `src/*` |
| Limite de corpo da API HTTP | 1 MB (`MAX_BODY_BYTES`) | `vite.config.js:218` |

**Consequência direta:** o viewport introduz dois novos vetores — (a) bytes de modelo grandes atravessando IPC/HTTP; (b) workers/wasm de decoders exigindo política de origem e CSP. Nenhum dos dois está resolvido hoje.

## 6. Documentação existente que esta frente deve respeitar

| Documento | O que já decide | Como esta frente se relaciona |
|---|---|---|
| [`../LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md`](../LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md) §4, §9.2, §15.2 | Lia Forge é a única interface; `Lia3DCreate`/`Lia3DSprite` são módulos internos; canvas WebGL, se escolhido, fica numa view da Forge; GLB é container, não contrato semântico; **nenhum renderer padrão** | O viewport é **view de inspeção**, não novo produto nem escolha de renderer de sprites |
| [`../CAPABILITY-BOUNDARIES-AND-ROADMAP.md`](../CAPABILITY-BOUNDARIES-AND-ROADMAP.md) §1.1, §2.1 | “Scene Composer” recomendado como **experiência combinada** com nó de staging, não módulo paralelo | O viewport **não** é Scene Composer; composição/edição de cena é decisão separada |
| [`../DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`](../DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md) §3, §11 | 17 contratos propostos; nenhum contrato de viewport/sessão/staging; pacote não aprovado | Qualquer `ViewSession` é proposta nova, fora do pacote v1 |
| [`../DECISIONS-AND-OPEN-QUESTIONS.md`](../DECISIONS-AND-OPEN-QUESTIONS.md) | 57 perguntas abertas (44 anteriores + 45–57 desta frente); hardware não presumido; nada de download/instalação sem consentimento | Esta frente acrescentou 45–57, sem reabrir nem renumerar as anteriores |
| [`../MODULE-CONSOLIDATION-AUDIT-3D.md`](../MODULE-CONSOLIDATION-AUDIT-3D.md) §3-§5 | 3D Sprite usa three r169 vendorizado; 3D Create é add-on Blender; contratos de spritesheet não são equivalentes; direitos não esclarecidos | Referência de estudo; **não** copiar código/assets sem licença |
| [`../ADR-001-LIA-FORGE-DECISIONS.md`](../ADR-001-LIA-FORGE-DECISIONS.md) Decisão 5 | Comparar Blender × WebGL/SpriteForge com o mesmo input/hash; sem renderer padrão | O viewport não pode ser declarado “renderer oficial” |
| [`../T13-IMPLEMENTATION-EVIDENCE.md`](../T13-IMPLEMENTATION-EVIDENCE.md) §11-§12 | 32 smokes + 30 testes Python; o que **não** foi executado (Blender/ComfyUI/engine/GPU) | Mesmo padrão de evidência deve valer para o viewport |

## 7. Lacunas reais (não propostas de melhoria — ausências)

### 7.1 Lacunas de capacidade

1. **Nenhuma renderização 3D interativa** de qualquer formato.
2. **Nenhuma hierarquia de cena visível**: `inspectGlb` conta nós, mas não expõe a árvore, nomes, transforms nem visibilidade.
3. **Nenhum bounds/escala**: não há como responder “esse modelo tem 1,8 m ou 180 cm?” antes de exportar.
4. **Nenhuma inspeção de material/textura**: existem nomes e índices; não há imagem de textura, resolução, canais, impacto de VRAM.
5. **Nenhuma inspeção de skin/bones**: só a contagem de juntas em `skins`.
6. **Nenhuma reprodução de animação**: `animationNames` e duração existem; não há timeline, scrub ou mixer.
7. **Nenhum diagnóstico visual**: normais invertidas, UVs ausentes, faces degeneradas, texturas faltando, escala absurda — nada disso é detectável sem desenhar.
8. **Nenhuma “sessão de visualização”**: não há onde guardar câmera, overrides, seleção ou estado de inspeção.
9. **Nenhuma captura/estampa**: não há thumbnail real de modelo para cards ou Comparison Lab.
10. **Nenhum probe gráfico**: o app não sabe se está em GPU real, SwiftShader, WebGL1 ou WebGL2.

### 7.2 Lacunas de integração/segurança

11. **Sem streaming de arquivo grande**: ler 100 MB por IPC e novamente no parser duplica memória; o teto de prévia é 6 MB.
12. **Sem CSP**: adicionar wasm/worker sem CSP mantém o renderer com superfície ampla.
13. **Sem protocolo de asset**: não há como o `GLTFLoader` buscar bytes sem `file://` ou base64.
14. **Sem tratamento de perda de contexto GPU**: crash do processo GPU deixaria canvas morto sem recuperação.
15. **Sem telemetria de recursos**: `renderer.info` não existe hoje; não há como provar que o viewport não vaza geometria/textura.
16. **Sem política de versão do Three.js**: nenhuma dependência gráfica tem hoje regra de pin/revisão/notices.

### 7.3 Lacunas de produto/taxonomia

17. **Taxonomia só `character` ou `item`**: um ambiente/cenário não tem tipo; um GLB de cenário não entra no fluxo.
18. **Nenhuma capability de preview**: Hub e preflight não conseguem expressar “posso visualizar isto?”.
19. **Nenhum gate de “inspeção feita”**: a jornada de 12 passos não pede confirmação visual de modelo, porque não há como oferecê-la.
20. **Nenhuma decisão sobre edição**: mover/rotacionar/escalar e trocar material são pedidos do produto, mas não existe contrato que diga o que é “alteração reversível”.

## 8. O que **não** é lacuna (para evitar retrabalho)

- **Não** falta inspeção de container GLB: ela existe e é testada (`tests/glb-inspect-smoke.mjs`).
- **Não** falta validação estrutural de GLB: `glb-structural` existe e é executado em workflows.
- **Não** falta armazenamento de versões de asset: `Asset Manager` grava versões com hash e validador.
- **Não** falta comparação de artefatos: o Comparison Lab mede até 8 arquivos e registra a escolha como versão.
- **Não** falta política de direitos: `classifyRights` é explícito e conservador.
- **Não** falta padrão de transporte: IPC e HTTP compartilham o mesmo serviço.
- **Não** falta pipeline Blender: ele existe e continua sendo o caminho de produção enquanto não houver decisão de renderer.
- **Não** falta documentação de fronteira: a proposta consolidada já define módulo/produto/destino.

## 8.1 Correções da revisão final

A revisão técnica de 2026-11-13 conferiu as afirmações desta auditoria contra o código do repositório e o pacote `three@0.187.0`. Nenhuma lacuna observada mudou; os ajustes foram de precisão técnica e estão registrados em [`03`](03-PESQUISA-TECNICA-THREEJS.md) §0 (raycast/bounds de `SkinnedMesh`, `KTX2Exporter`, telemetria WebGL × WebGPU) e no plano de fases ([`11`](11-PLANO-POR-FASES.md)), que passou a seguir a ordem solicitada na revisão.

## 9. Fatos × hipóteses desta auditoria

| Afirmação | Rótulo |
|---|---|
| Não há Three.js, WebGL ou WebGPU no código da Lia Forge | **Fato observado** (busca textual + `package.json`) |
| `inspectGlb` devolve contagens e metadados, não hierarquia/bounds | **Fato observado** (leitura de `shared/model3d/glb.mjs`) |
| A UI atual não renderiza modelo e declara isso | **Fato observado** (`src/App.jsx:1399`) |
| O app roda com `sandbox`, `contextIsolation`, sem CSP | **Fato observado** |
| Não há protocolo customizado nem streaming de modelo | **Fato observado** |
| Electron 45 usa Chromium 156 | **Documentação oficial** (release do Electron) |
| `three@0.187.0` é a versão atual e é MIT | **Documentação oficial + artefato npm baixado e inspecionado** |
| Um viewport Three.js cabe no orçamento de memória da máquina de referência | **Hipótese** — depende de fixture e medição na GPU |
| WebGPU funciona na RX 580 no Windows | **Não verificado** — requer probe na máquina |
| O renderer Blender e o WebGL produzem o mesmo resultado visual | **Não verificado** — decisão já registrada como aberta |

## 10. Conclusão da auditoria

A Lia Forge tem **um alicerce melhor do que se poderia supor** para receber um viewport: contratos de asset/versão, QA estrutural, Hub, preflight, transporte duplo, confinamento de caminhos e uma UI que já se recusa a fingir. O que falta é precisamente o **miolo gráfico** e as **garantias de ciclo de vida** em volta dele.

Isso muda a ordem natural do trabalho: **não começar pelo canvas**. Começar por (a) decisão de escopo/edição, (b) transporte e limites de memória, (c) política de segurança (CSP/protocolo), (d) fixtures e critério de aceite. O canvas é a parte mais fácil e a menos arriscada.
