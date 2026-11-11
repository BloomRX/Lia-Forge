# Tool / Provider Hub — catálogo e adapters

> **Estado:** alvo `PLANNED`. Há integrações pontuais, não um Hub genérico. Nenhum adapter novo foi implementado nesta tarefa. Evidências atuais: [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md).
>
> **Adendo 2D/2.5D (revisão documental; evidência upstream de 2026-11-09/2026-11-10 UTC):** dois providers externos foram registrados como **candidatos experimentais** da rota imagem 2D → PSD em camadas → rig 2.5D → animação → exportação (seção “Providers 2D/2.5D em avaliação”). Registro é documentação de planejamento: nada foi clonado, instalado, baixado, chamado, copiado ou integrado, e nenhum direito foi aceito. A especificação de contratos de domínio permanece em revisão humana, com seus 12 itens pendentes; **nenhum contrato novo foi criado aqui** — `capabilityId`s e campos abaixo são rótulos ilustrativos.

## Vocabulário

| Termo | Significado | Não significa |
|---|---|---|
| **Tool** | Programa/runtime/DCC executável (ex.: Blender ou editor 2D). | Provider de geração ou workflow pronto. |
| **Provider** | Serviço, modelo ou runtime que oferece uma capability (local ou cloud). | Adapter instalado ou legalmente aceito. |
| **Adapter** | Código que converte contrato Lia Forge em chamada/CLI/protocolo do tool/provider e valida outputs. | Garantia de qualidade, suporte a qualquer versão ou permissão de execução. |
| **Plugin/extension** | Pacote de um ou mais adapters/skills/registries com manifesto e lifecycle. | Conteúdo confiável só por estar no catálogo. |
| **Workflow** | Receita/DAG que conecta capabilities por contracts. | Agente ou provider. |
| **Skill** | Instrução/checklist/contexto sobre como fazer/revisar um trabalho. | Código de execução ou autorização. |
| **Agent** | Processo opcional que pode propor/chamar ferramentas via integração permitida. | Dependência da Forge ou prova que a Forge chamou o tool. |

## Registro de capability/provider

Manifesto proposto (campos podem evoluir após ADR):

```yaml
id: provider-id
version: 1.2.3
kind: local-model | local-tool | cloud-api | manual
capabilities: [image.generate]
source: { upstream: https://…, commit: …, author: … }
codeLicense: SPDX-or-custom
modelLicense: separate-record-required
mode: local | remote
inputContracts: [image-prompt-v1]
outputContracts: [image-file-v1]
requirements: { os: unknown, runtime: unknown, hardware: unknown }
network: { destinations: [], uploads: [] }
cost: { known: false, unit: unknown }
sideEffects: [write-artifact]
install: { required: false, userConsent: true }
telemetry: { default: off, disclosure: … }
readiness: experimental
limitations: []
```

Informação desconhecida permanece explicitamente desconhecida. A descrição do manifesto não substitui probing runtime real nem licença verificada.

## Interface de adapter (conceitual)

Um adapter recebe `StepRun` validado, contratos de inputs e contexto mínimo; oferece:

- `discover()`: detectar binário/endpoint/config sem executar geração;
- `validateCapability(request, environment)`: responder `supported`, `unsupported`, `unknown` com fonte/versionamento;
- `estimateEffects(...)`: dados que saem, chamadas, downloads, custo known/unknown e arquivos afetados;
- `execute(..., AbortSignal)`: iniciar após autorização, retornar `jobId`, eventos reais, outputs e detalhes;
- `reconcile(jobId, fingerprint)`: consultar estado de tarefa externa após timeout/restart sem duplicar;
- `validateOutputs(outputs, contracts)`: checks estruturais específicos;
- `dispose()`: limpar somente recursos temporários próprios.

O adapter não persiste tokens em logs, não baixa dependências por conta própria, não abre portas remotas e não executa texto arbitrário do provider como código. Um manifest declarativo não pode definir um shell command ilimitado sem política de segurança/consentimento.

## Compatibilidade, licença e maturity

Separar:

1. licença do código do adapter/plugin;
2. licença/termos do modelo ou weights;
3. termos/limites de API e dados do provider;
4. direitos sobre inputs, assets de terceiros e outputs.

`EXPERIMENTAL`, `BETA` e `STABLE` são status de maturidade, não estados de run. `STABLE` requer testes reais para as plataformas/formats que declara, histórico de regressões, versão upstream pinada, fallback e limites conhecidos. Não atribuir stable ao provider apenas pelo número de estrelas ou frequência de commits.

## Gate de segurança e consentimento

- O usuário escolhe local/remoto, destino e uso de seus arquivos.
- Chaves guardadas no host local/credential store, fora do frontend, workflows, skills e logs; permissões por provider e escopo revogáveis.
- Requests sem redirect automático para destino diferente, host allowlist quando aplicável, timeouts, byte limits, MIME/header validation e tratamento de SSRF.
- Para plugin local: assinatura/proveniência, digest, permissões declaradas, revisão de source e isolamento por processo/permissões.
- Segredo, prompt privado, referência ou modelo não sai do dispositivo até o usuário ver destino/dados e autorizar.
- Telemetria Forge desligada por padrão; provider telemetry é independente e explicitada.
- Cancelamento/timeout não provam que o provider encerrou; registrar job ID e estado como desconhecido até reconcile.

## Registro atual (evidência, não hub)

- **ComfyUI client:** consulta endpoint `COMFYUI_URL` e executa workflows locais de concept PNG por ação explícita; pode alcançar endpoint remoto, com diálogo/aviso para envio de prompt/grafo; referências locais não são enviadas nesta etapa. Não há instalação/weights no catálogo `spriteforge.config.json` (`models: []`).
- **Blender adapter:** executa script headless com input de modelo já no workspace e valida PNG+JSON; não cria mesh/rig/animation.
- **Manual registration:** abre aplicações/seletores e registra paths reais; `electron/external-tools.cjs` detecta/abre Blender e Krita, mas não integra todas as operações de cada aplicativo.
- **MCP:** servidor opcional para assets/tarefas; não é catálogo de provider.

## Integrações externas estudadas

Ver análise detalhada e recomendações em [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md): `sprite-gen` e `mcp-for-blender` são referências para estudar adapters opcionais; skills de gamedev/Blender podem inspirar formato e conteúdo; OpenGame é framework de geração de código de jogos; os demais são índice/material de referência ou candidato bloqueado. Nada foi incorporado.

O adendo 2D/2.5D acrescenta dois repositórios do mesmo autor, pesquisados como itens 10 e 11 daquele documento: [`link-ding/image-to-psd`](https://github.com/link-ding/image-to-psd) (skill de agente + script Python de export de PSD em camadas) e [`link-ding/doll-studio`](https://github.com/link-ding/doll-studio) (leitor PSD/PSB, auto-rig, runtime 2.5D, editor/player web e app desktop Electron). Ambos são candidatos experimentais com direitos pendentes; nenhum foi incorporado.

O adendo 3D local (item 12 daquela pesquisa, [vídeo `PixelArtistry` de 2026-11-06](https://www.youtube.com/watch?v=bEiW6L7Y7NM)) acrescenta candidatos para a rota **imagem 2D → mesh → texturas → rig/animação → engine**: `microsoft/TRELLIS.2` (MIT), `TencentARC/Pixal3D` (MIT + `NOTICE` de terceiros), nós GPL-3.0 de `Mstafa-awad` (WTiVo, LODTailor, Bake Forger, UltraTex), `Tavris1/ComfyUI-Easy-Install` (MIT), o serviço hospedado `actionforge.app` (licença não verificada) e `godotengine/godot` (MIT) como **destino de consumo**. Registro e direitos no item 12; nenhum é capability da Forge.

**Licença do host ComfyUI (verificação de 2026-11-12 UTC, fato não registrado anteriormente):** [`comfyanonymous/ComfyUI`](https://github.com/comfyanonymous/ComfyUI) é **GPL-3.0** (★146.363, ativo; `main` em 2026-11-11). A integração da Forge é por **endpoint HTTP de um processo separado** (`scripts/comfyui-client.mjs`), o que não constitui linkagem nem obra derivada do ponto de vista do código da Forge; ainda assim, **redistribuir o ComfyUI, um fork dele ou um workflow que inclua nós GPL-3.0** exige cumprir a GPL-3.0 e precisa de revisão própria antes de qualquer empacotamento. Dados de suporte declarados pelo projeto: "todos os sistemas operacionais e tipos de GPU (NVIDIA, AMD, Intel, Apple Silicon, Ascend)", modelos grandes a partir de **4 GB de VRAM + 8 GB de RAM** com weight streaming assíncrono; AMD no Windows via **ROCm 10.0** com extras `device-gfx1200`/`device-gfx1201` (RDNA4) e, para placas não suportadas oficialmente, `HSA_OVERRIDE_GFX_VERSION` documentado para **RDNA2/RDNA3**; `--directml` (`comfy/cli_args.py:116`) e `--cpu` (linha 174) **existem no código**. Para a **RX 580 (Polaris/GCN4)** nenhum desses caminhos é declarado como suportado — estado **`unknown`**, e `code-present` não é `verified`.

**Política de admissão:** os critérios objetivos, as categorias (`ADMIT`, `ADMIT_WITH_RESTRICTIONS`, `RESEARCH_ONLY`, `MONITOR`, `REJECT`, `BLOCKED_PENDING_LICENSE_REVIEW`), os requisitos mínimos por componente e os exemplos aplicados a todas as ferramentas estudadas estão em [`PROVIDER-AND-MODEL-ADMISSION-POLICY.md`](PROVIDER-AND-MODEL-ADMISSION-POLICY.md). Nenhum componente foi admitido por aquele documento.

## Providers 2D/2.5D em avaliação (registro documental, não hub)

Rota atendida: **imagem 2D → separação de partes → reconstrução de áreas ocultas → PSD em camadas e máscaras → revisão de partes → rig 2.5D → animação → exportação** (detalhes e preservação em [`ASSET-PIPELINES.md`](ASSET-PIPELINES.md)). Os dois providers são **independentes e substituíveis**: ocupam etapas diferentes e cada etapa admite alternativa (outro separador de camadas, editor/rig próprio, outro runtime 2.5D, exportação para formatos intercambiáveis quando suportada). Nenhum par forma dependência indivisível e nenhum é obrigatório para a Forge.

| Campo | `image-to-psd` (item 10) | `doll-studio` (item 11) |
|---|---|---|
| Tipo | Skill de agente (instrução) + script Python de export | App web (editor/player WebGL) + app desktop Electron |
| Origem pinada | `link-ding/image-to-psd`, branch `main`, commit `e386bf3a92ef1359379ee582309cb55e85db0e9c` (2026-11-10T01:32:11Z); sem tag/release | `link-ding/doll-studio`, branch `main`, commit `127968436dca6d564b6075de94259679e4f17c43` (2026-11-10T02:28:59Z); release `v0.1.0` |
| Etapas/capabilities candidatas | separação de partes; reconstrução de áreas ocultas; export PSD em camadas + máscaras; relatório QA do export | leitura PSD/PSB; limpeza/organização de camadas; auto-rig; deformação 2.5D; blink/olhos/boca/lip sync; física de cabelo; face tracking (MediaPipe); export `.doll` e HTML autocontido |
| Direitos | **Sem `LICENSE`; API `license: null`.** Autorização de uso geral **declarada pelo usuário**, sem URL/documento; não é Apache/MIT. Exemplos (PSDs/PNGs) têm direitos próprios | **Código original: licença não identificada** (API `license: null`, sem `LICENSE` na raiz). Apache-2.0 apenas para LivLiv Player adaptado e MediaPipe, conforme `THIRD_PARTY_NOTICES.md`; `MIT` declarado somente em `electron/package.json` (subpacote `dollpet`). Cópia/integração/redistribuição/fork aguardam esclarecimento ou autorização do titular |
| Modo | Local (script) + remoto quando o agente usa geração de imagem | Local (web com servidor HTTP local; desktop). Download inicial de vendor é remoto |
| Instalação/dependências | `npx skills add …`; Python + `pillow`, `numpy`, `psd-tools` (`cairosvg` para SVG) | Servidor HTTP local para ES modules; `vendor/fetch-mediapipe.sh` (~17 MB: npm + `storage.googleapis.com`); Electron 45/electron-builder/koffi no app desktop |
| Rede/dados | Destino e bytes dependem da ferramenta de geração de imagem do agente (`ImageGen` no Codex, segundo o upstream); não auditado | README declara execução local após o fetch do vendor; face tracking usa câmera e lip sync usa microfone. **Não verificado por auditoria de código** |
| Efeitos colaterais candidatos | instalar dependências; escrever PSD/PNG/relatório; chamar provider de imagem | download de vendor; acesso a câmera/microfone; escrita de arquivos; **“Task alerts” escreve em configuração de agentes externos** (`~/.claude/settings.json`, `~/.codex/config.toml`) |
| Custo | `unknown` (depende do provider de imagem do agente) | `unknown` (sem custo declarado; instaladores ~159–172 MB não assinados) |
| Maturidade | `EXPERIMENTAL`/`NOT_VERIFIED`: 2 commits, sem testes, sem release | `EXPERIMENTAL`/`NOT_VERIFIED`: 4 commits, 1 release, sem suíte de testes observada, builds não assinados |
| Limitações declaradas | não promete one-click nem rigging de produção; áreas ocultas são inferidas; parser ≠ aceite do software-alvo | sem edição manual de meshes/keyframe deformers; sem presets de expressão/gravação de movimento; sem bones para braços/partes separadas; wallpaper Windows pouco testado; `.doll` é formato proprietário do runtime |

Registros candidatos no formato do manifesto proposto acima — **proposta de preenchimento, não manifesto aprovado**; informação desconhecida permanece desconhecida:

```yaml
id: image-to-psd-layer-split            # rótulo interno candidato
version: unversioned-upstream           # sem tag/release; pin por commit
kind: local-tool
capabilities: [image2d.split-parts, image2d.reconstruct-occluded, psd.export-layered]
source: { upstream: https://github.com/link-ding/image-to-psd, commit: e386bf3a92ef1359379ee582309cb55e85db0e9c, author: link-ding, observedAt: 2026-11-10 }
codeLicense: none-identified            # sem LICENSE; API license: null
rightsNote: autorizacao-de-uso-geral-declarada-pelo-usuario   # sem URL/documento; nao e Apache/MIT
modelLicense: separate-record-required  # provider de geração de imagem usado nas referências de partes
mode: local                             # remoto apenas se o agente usar geração de imagem
inputContracts: [still-image-v?, layered-svg-v?, parts-manifest-v?]
outputContracts: [layered-psd-v?, part-png-set-v?, export-qa-report-v?]
requirements: { os: unknown, runtime: python3 + pillow/numpy/psd-tools (cairosvg opcional), hardware: unknown, agent: runtime de agente compatível com skills }
network: { destinations: [provider-de-imagem-do-agente], uploads: unknown }
cost: { known: false, unit: unknown }
sideEffects: [install-python-deps, write-artifact, call-image-provider]
install: { required: true, userConsent: true }
telemetry: { default: unknown, disclosure: não publicada }
readiness: experimental
limitations: [sem release/testes upstream; nao promete rigging de producao; areas ocultas sao inferidas; compatibilidade PSD com software-alvo nao verificada]
```

```yaml
id: doll-studio-2d5d-runtime            # rótulo interno candidato
version: 0.1.0                          # release v0.1.0; pin por commit
kind: local-tool
capabilities: [psd.read, layers.cleanup, rig2d.auto-rig, rig2d.deform, anim.idle, anim.lip-sync, anim.hair-physics, tracking.face, model.doll.export, export.html-selfcontained]
source: { upstream: https://github.com/link-ding/doll-studio, commit: 127968436dca6d564b6075de94259679e4f17c43, author: link-ding, observedAt: 2026-11-10 }
codeLicense: none-identified-for-original-code
thirdParty: [LivLiv Player (Apache-2.0, adaptado em src/idle.js, src/voice.js, src/tracking.js), MediaPipe tasks-vision 1.1.1 (Apache-2.0) + face_landmarker.task (Google), electron/package.json declara MIT apenas para o subpacote dollpet]
modelLicense: separate-record-required  # face_landmarker.task
mode: local
inputContracts: [layered-psd-v?, part-png-set-v?, doll-model-v1?]
outputContracts: [doll-model-v1?, html-selfcontained-v?, cleanup-report-v?]
requirements: { os: Windows/macOS (builds nao assinados) ou browser com WebGL/WASM, runtime: servidor HTTP local (web) ou Electron 45/Node 22 (desktop), hardware: unknown, sensors: camera e microfone para tracking/lip-sync }
network: { destinations: [registry.npmjs.org, storage.googleapis.com (apenas no fetch inicial do vendor)], uploads: unknown }
cost: { known: false, unit: unknown }
sideEffects: [download-vendor-17mb, camera-access, microphone-access, write-artifact, write-external-agent-config]
install: { required: true, userConsent: true }
telemetry: { default: unknown, disclosure: não publicada }
readiness: experimental
limitations: [sem suite de testes observada; instaladores nao assinados; sem edicao manual de meshes/keyframes; sem presets de expressao; .doll e formato proprietario do runtime]
blocked: [copiar, integrar, redistribuir ou fazer fork do codigo original ate esclarecimento ou autorizacao do titular]
```

Regras de registro para estes candidatos:

1. **Nenhum claim de capability.** Os blocos acima descrevem o que o upstream declara; não são claims `supported`/`partial` e não substituem probing runtime, conformance suite ou licença verificada.
2. **Substituição sem ruptura.** Trocar um provider por outro (ou por implementação própria) não pode exigir mudança de contrato da Forge: a etapa é definida pelos contratos de input/output, não pelo nome da ferramenta.
3. **Gate de direitos fail-closed.** Enquanto `codeLicense` for `none-identified`, cópia/redistribuição/fork ficam bloqueados; uso eventual depende de esclarecimento do titular e de autorização explícita do usuário. Uma autorização declarada verbalmente não vira licença formal no registro.
4. **Efeitos revelados antes da execução.** Instalação, download de vendor, câmera/microfone, chamada a provider de imagem e escrita em configuração de agentes externos exigem consentimento por escopo, com destino/bytes/custo visíveis e reversão possível.
5. **Conteúdo reconstruído identificado.** Pixels inferidos em áreas ocultas entram como conteúdo gerado na proveniência e na revisão, com tool/model/parâmetros quando conhecidos.
6. **Implementação independente possível.** Havendo impedimento de direitos ou técnico, a Forge pode desenvolver separador de camadas, editor/rig ou runtime 2.5D próprios, **sem copiar código, prompts, exemplos ou assets** dos repositórios.
7. **Formatos não são contratos semânticos.** PSD/PSB, `.doll`, HTML autocontido e formatos compatíveis com Live2D são formatos de saída/entrada com validação própria; extensão ou nome não prova conteúdo, compatibilidade nem direitos. Live2D só entra quando houver provider adequado e licenciado.

## Providers 3D locais e rota image→game-ready em avaliação (registro documental, não hub)

Rota estudada a partir de fonte externa — [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md) item 12: vídeo [`Local AI Now Makes Game-Ready 3D Characters (Fully Animated!)`](https://www.youtube.com/watch?v=bEiW6L7Y7NM) (canal `PixelArtistry`, upload declarado 2026-11-06, 24:12): **imagem 2D → geração de mesh (TRELLIS.2/Pixal3D) → watertight → decimation/low-poly → bake de normal map → texturização (UltraTex) → combinação de prop em DCC → auto-rig/animação → importação em engine**. Nada abaixo é capability registrada, claim `supported`/`partial`, adapter aprovado ou evidência de execução: são candidatos observados em material de terceiro, com direitos pendentes.

| Etapa/capability candidata | Candidatos observados (verificados na pesquisa item 12) | Direitos verificados | Modo | Limite registrado |
|---|---|---|---|---|
| `image3d.generate-mesh` | `microsoft/TRELLIS.2` (MIT, “model and code”); `TencentARC/Pixal3D` (MIT + componentes de terceiros em `NOTICE`); empacotamentos ComfyUI de terceiros | MIT nos repositórios; **pesos/`NOTICE` a verificar** (um wrapper de terceiro descreve “academic-only model license”, não confirmado upstream) | Local (GPU) | Exige GPU/VRAM não testadas no alvo da Forge; modelo ≠ código quanto a direitos |
| `mesh.make-watertight` | `Mstafa-awad/WTiVo-WatertightVoxel-ComfyuiNode` (GPL-3.0); `WTiVo-FastMergeByDistance` (MIT) | GPL-3.0 / MIT | Local | Nós pré-compilados exigem Python 3.12 + PyTorch 2.8 + **CUDA 12** |
| `mesh.decimate-lowpoly` | `Mstafa-awad/LODTailor-The-Mesh-Trimmer-ComfyuiNode` (GPL-3.0) | GPL-3.0; variante `LODTailor-The-Mesh-Trimmer` **sem licença** (fail-closed) | Local | Copyleft: cópia/adaptação/redistribuição exige compliance e revisão |
| `texture.bake-normal` | `Mstafa-awad/LODTailor-Bake-Forger` (GPL-3.0) | GPL-3.0 | Local | Idem |
| `texture.generate-from-image` | `Mstafa-awad/UltraTex-ComfyUI-nodes` (GPL-3.0) + `pixelartistry/PixelArtistry-UltraTex` (MIT **escopado**) sobre **FLUX.2 Klein base 9B** | GPL-3.0 nos nós; modelo sob **FLUX Non-Commercial License v2.1** (Black Forest Labs) | Local (GPU) | **Bloqueio comercial:** executar o modelo é uso não comercial; outputs declarados como do usuário pelo autor do repositório, sem parecer jurídico |
| `rig.auto-rig` / `motion.animate` | `actionforge.app` (aplicação web hospedada, “free in your browser”; crédito a “CG Stuff”); clips de `Quaternius` declarados **CC0** | **Não verificada** (nenhum repositório público identificado); CC0 declarado por terceiro, não re-verificado na fonte | **Remoto/hospedado** | Envio de mesh/dados a serviço externo; termos, retenção e direitos desconhecidos; auto-rig de vídeo **não** é rigging profissional garantido |
| `dcc.combine-and-place-prop` | Blender (ADR-001 Decisão 5: interface técnica auxiliar; sem renderer padrão) | GPL-2.0-or-later conforme o projeto; não re-verificado nesta revisão | Local | Nenhuma decisão de renderer padrão; comparação Blender × WebGL/SpriteForge continua aberta |
| `destination.game-engine-import` | `godotengine/godot` (MIT) | MIT | Local | **Destino de consumo (Game Asset)**, não módulo de geração; nenhuma integração autorizada, testada ou homologada |
| `service.hosted-3d-flow` (patrocinado) | VARCO 3D (NC AI), “Flow + MCP” | **Não verificada**; sem repositório oficial identificado | **Remoto/hospedado** | Segmento **patrocinado** do vídeo; `DO NOT INTEGRATE` neste estágio |

Regras que se aplicam a todos os candidatos acima, sem exceção:

1. **Nenhum claim de capability.** Nada aqui é `supported`/`partial`; claims exigem versão de contrato, escopo, evidência aplicável à combinação exata e probing runtime (§Registro de capability/provider).
2. **Substituição sem ruptura.** Qualquer etapa pode ser atendida por outro provider, por implementação própria ou por fluxo manual: o contrato é de input/output da etapa, não do fornecedor.
3. **Gate de direitos fail-closed e por componente.** GPL-3.0 (nós de malha/textura), MIT **escopado** (instalador/workflows do autor, excluindo explicitamente nós e modelos), **FLUX Non-Commercial v2.1** (modelo de texturização), licenças não verificadas (ActionForge, VARCO 3D) e CC0 declarado por terceiro (animações) são decisões **separadas**; wrapper, instalador ou workflow não cobre pesos, modelos, datasets nem outputs.
4. **Efeitos revelados antes da execução.** Instalação one-click, download de nós/modelos/pesos (~26 GB declarados), execução em GPU, envio de mesh a serviço hospedado e importação em engine exigem consentimento por efeito e autorização explícita.
5. **Hardware é alvo de homologação, não suporte.** Os requisitos declarados (Windows + NVIDIA, RTX 5080 16 GB testado, 8–12 GB declarado, CUDA 12) **não** cobrem o alvo registrado no ADR-001 (Windows + AMD RX 580 8 GB): para esse alvo a rota permanece `BLOCKED`/`unknown`, sem adaptação ROCm/DirectML testada.
6. **Conteúdo patrocinado e afiliados não são evidência.** O vídeo de origem é patrocinado (VARCO 3D) e contém links de afiliados declarados; isso não invalida os repositórios verificados, mas impede tratar a demonstração como medição independente.
7. **Nada foi executado.** Nenhum clone, download, instalação, execução, cópia de código/prompts/workflows, fork ou redistribuição; apenas leitura de metadados públicos e de licenças.


## Backend de vídeo e camadas de integração estudadas em 2026-11-11 (registro documental, não hub)

Quatro fontes externas foram pesquisadas em 2026-11-11 UTC e registradas em [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md) (itens 13 a 16). Nenhuma foi clonada, instalada, executada, chamada ou incorporada; **nenhuma capability, adapter, provider ou workflow novo existe no checkout** por causa deste registro. A tabela abaixo separa o que cada fonte é para a Forge.

| Fonte | Papel possível na Forge | Estado | Condição bloqueadora / requisito |
|---|---|---|---|
| [`heygen-com/hyperframes`](https://github.com/heygen-com/hyperframes) (`main`/`2a70733c15`, Apache-2.0) | **Backend/workflow opcional de vídeo** (adapter hipotético `hyperframes-video`: composição HTML + assets locais → MP4 com hash) e fonte do checklist de pureza determinística aplicável ao renderer Blender existente | `PLANNED` — candidato, **sujeito a decisão humana** | Node 22+, FFmpeg e Chrome headless com **consentimento explícito**; telemetria do CLI **desligada por padrão** (`npx hyperframes telemetry disable`); cloud render **não** obrigatório; contrato de mídia temporal **não existe** na spec v1; nada testado no alvo Windows + AMD RX 580 (`unknown`) |
| [`storytold/craft-ai-integrations`](https://github.com/storytold/craft-ai-integrations) e `craft-libs` (MIT OR Apache-2.0) | **Referência de desenho** do Tool/Provider Hub: core sem I/O, client com `consent`/`Job`, `ToolDesk` (qual modelo cada tool usa), `ProviderFactory`, catálogo de modelos com tamanho/SHA-256/origem/licença, adapter declarativo por arquivo de dados, máscaras verificadas antes do consumo | `DOCUMENTED` como inspiração; **não é provider** | Implementação em Rust — a *forma* dos contratos é transferível, o código não se aplica à stack Electron/Node + Python da Forge |
| [`storytold/artcraft`](https://github.com/storytold/artcraft) (MIT OR Apache-2.0, com `NOTICE`) | **Inspiração** de Scene Composer ("construir a cena antes de gerar") e de projeção de design system (`frame.md` do hyperframes tem papel análogo); seus providers hospedados são candidatos cloud | `PLANNED` como conceito; providers `BLOCKED` | Geração depende de serviços hospedados (catálogo próprio de 62 modelos, Grok, Midjourney, Sora, World Labs); backend `artcraft-services` é `NOASSERTION`; direitos, custo e privacidade pendentes |
| [`neilsonnn/image-blaster`](https://github.com/neilsonnn/image-blaster) (MIT) | **Referência de convenções** (indexação `N-slug` + sidecar de request, disk-first com URLs só como proveniência, repair sem nova geração, atomicidade de objeto, clean plate por subtração). Seus providers são candidatos cloud | `DOCUMENTED` como inspiração; providers `BLOCKED` | Todos os providers são cloud e pagos com **upload da imagem do usuário** (World Labs Marble, FAL Hunyuan3D-v3, FAL Meshy v6, ElevenLabs SFX, nano-banana, gpt-image-2); projeto sem atividade desde 2026-05-15; exigir que o usuário entregue chaves de API ao agente no chat é padrão **vedado** pela Forge |
| [`Blizaine/Maestro`](https://github.com/Blizaine/Maestro) (WanGP Non-Commercial Evaluation License 1.1) | **Nenhum.** Nem provider, nem adapter, nem backend, nem dependência | `REJECT` | A licença proíbe explicitamente oferta como parte de produto pago, serviço hospedado, API, deployment headless **ou integração**; o pipeline depende de CUDA e kernels exclusivos NVIDIA ("AMD GPUs and macOS are not currently supported"), incompatível com o alvo AMD RX 580 8 GB do ADR-001; 150 GB de disco e 50–100 GB de pesos no primeiro uso |

**Providers cloud candidatos adicionais trazidos por essas fontes** (todos exigem decisão humana, direitos, custo, privacidade e consentimento por efeito; nenhum é dependência): World Labs Marble (modelo `marble-1.1` no image-blaster; catálogo do ArtCraft lista Marble 1.0, Marble 1.0 Draft, Marble 1.1 e Marble 1.1 Plus) para worlds e Gaussian splats; TripoSplat para splats; FAL como agregador de `fal-ai/hunyuan3d-v3/image-to-3d`, `fal-ai/meshy/v6/image-to-3d` e `fal-ai/elevenlabs/sound-effects/v2`; Hunyuan 3D 2.0/2.1/3/3 Sketch/3.1 Pro/3.1 Rapid/3.1 Part/3.1 Smart Topology, Tripo3D H3.1, Meshy 6 e Rodin 2.5 Fast para meshes; `nano-banana` e `gpt-image-2` para edição de imagem; Grok Imagine/Grok Video, Midjourney, Sora 1/Sora 2 e GPT Image 1 para imagem/vídeo. **Hunyuan 3D continua com o gate de licença já registrado nesta documentação**; nada aqui o remove.

**O que estas fontes não mudam:** (1) provider permanece substituível e nenhum vira obrigatório (requisito confirmado 5); (2) hardware continua alvo de homologação, não suporte declarado — `unknown` é estado válido; (3) a licença do código de um projeto **não** cobre pesos, termos de serviço nem direitos dos outputs; (4) telemetria de CLI de terceiro só entra com default desligado e consentimento explícito; (5) nada foi medido, executado ou validado — nenhum estado `VERIFIED` nasce deste registro.

## Critérios de aceite futuros

- Conformance suite reproduzível por capability com fixtures, erros, cancelamentos, limite de bytes, outputs inválidos e restart.
- Adapter declara capacidades ausentes e não aceita silenciosamente um input incompatível.
- Testes verificam `no network/no install/no download/no cost` antes da autorização e reautorização após scope change.
- Registro mostra source, commit/version, licença do code/model/provider, custos/retention conhecidos e desconhecidos.
- Cada capability `STABLE` tem evidência E2E real na combinação publicada de OS/runtime/hardware e workflow; nenhum selo genérico atravessa combinações não testadas.