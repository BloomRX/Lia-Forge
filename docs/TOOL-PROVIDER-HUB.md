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

## Critérios de aceite futuros

- Conformance suite reproduzível por capability com fixtures, erros, cancelamentos, limite de bytes, outputs inválidos e restart.
- Adapter declara capacidades ausentes e não aceita silenciosamente um input incompatível.
- Testes verificam `no network/no install/no download/no cost` antes da autorização e reautorização após scope change.
- Registro mostra source, commit/version, licença do code/model/provider, custos/retention conhecidos e desconhecidos.
- Cada capability `STABLE` tem evidência E2E real na combinação publicada de OS/runtime/hardware e workflow; nenhum selo genérico atravessa combinações não testadas.