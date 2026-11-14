# Lia Forge — Auditoria de agentes, Skills, MCP e automação

> **Estado deste documento:** `PROPOSED` (avaliação e recomendação). Não autoriza implementação, instalação, compra, envio de dados nem aceite de licença.
> **Data:** 2026-11-14 (UTC). **Branch:** `arena/6113e868-lia-forge`, criada de `main` @ `6bd9a5a`.
> **O que foi feito nesta sessão:** leitura de documentos, inspeção de código, consulta de metadados públicos na API do GitHub e execução dos testes first-party que não exigem dependências. **Nada foi instalado, nenhum script de terceiros foi executado, nenhum asset ou dado privado saiu da máquina, nenhum código foi escrito.**

## 0. Leia primeiro: três achados que mudam a leitura do resto

1. **A `main` não tem código.** `main` @ `6bd9a5a` contém `README.md`, `AGENTS.md` e `docs/` (pesquisa). Não há `package.json`, `electron/`, `shared/`, `scripts/` nem `tests/`. Logo, **na `main`, nenhuma capacidade de agente, Skill, MCP ou workflow é `IMPLEMENTED`**.
2. **Seis dos dez documentos de contexto obrigatório não existem na `main`:** `agent-workflow.md`, `mcp.md`, `INTELLIGENT-ORCHESTRATOR.md`, `TOOL-PROVIDER-HUB.md`, `WORKFLOW-ENGINE.md` e `DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`. Eles (e todo o código) existem apenas na branch remota `arena/649f88bd-3dspritesheet` @ `5b0ec51` (T13) e no PR #1, que está **fechado sem merge**. Li esses arquivos e o código **diretamente daquele commit, em modo somente leitura**, sem trocar de branch e sem copiar nada para esta branch.
3. **Consequência documental:** os quatro `T14-*.md` e o `BLENDER-BRIDGE-SPECIFICATION.md` presentes na `main` citam arquivos (`shared/orchestrator/planner.mjs`, `electron/blender-adapter.cjs`, `WORKFLOW-ENGINE.md` etc.) que **não existem na `main`**. As afirmações "já existe" desses documentos são verdadeiras apenas em relação a `5b0ec51`.

Por isso este documento usa sempre duas colunas de verdade: **`main`** e **branch T13 (`5b0ec51`)**.

### 0.1 Vocabulário de estado usado aqui

| Rótulo | Significado exato neste documento |
|---|---|
| `PROPOSED` | Ideia ou desenho descrito em documento; sem decisão humana registrada. |
| `PLANNED` | Aceito em roadmap/spec com critério de aceite, ainda sem código. |
| `IMPLEMENTED` | Código existe em um commit identificado. Não diz que roda. |
| `EXECUTED` | Rodou, com evidência reproduzível. Sempre digo **onde** e **com o quê** (ferramenta real ou stub). |
| `VALIDATED` | Executado com ferramenta real, entrada real e revisão humana registrada. |

**Nada neste repositório está `VALIDATED` segundo a evidência que pude verificar.** Os testes que executei usam fixtures sintéticas e stubs de ferramenta; Blender, ComfyUI, Krita, Aseprite, Godot e Ollama não estão presentes no ambiente desta sessão.

---

## 1. Evidências coletadas nesta sessão

### 1.1 Código real (branch T13 @ `5b0ec51`, não está na `main`)

| Componente | Arquivo | O que o código faz de fato | Estado |
|---|---|---|---|
| Planner determinístico | `shared/orchestrator/planner.mjs` | 8 receitas de workflow fixas; resolve adapter por capability via Hub; marca passo bloqueado com motivo. Não usa LLM, não busca Skills. | `IMPLEMENTED` + `EXECUTED` (smoke) |
| Engine em DAG | `shared/engine/execution-manager.mjs`, `dag.mjs`, `run-states.mjs` | Estados, checkpoint, retomada, cancelamento, timeout, `step.retry.maxAttempts` (padrão 1) com backoff. | `IMPLEMENTED` + `EXECUTED` (smoke) |
| Gates | `shared/engine/gates.mjs` | 9 códigos de gate; autorização por fingerprint de escopo (inclui `costCeiling`); revisão ancorada em SHA-256; entrada alterada; alvo de escrita seguro; redação de segredos. | `IMPLEMENTED` + `EXECUTED` (smoke) |
| Adapter SDK | `shared/adapters/sdk.mjs` | 3 classes (`execution`, `manual-editing`, `remote-service`); 9 códigos de erro; custo `known/unknown/not-applicable`; 4 ações protegidas. | `IMPLEMENTED` + `EXECUTED` (smoke) |
| Registro de adapters | `electron/adapters/index.mjs` | 7 adapters: `blender-spritesheet`, `comfyui-concept`, `comfyui-remote`, `local-image-ops`, `rig2d-software`, `glb-inspect`, `export-package`. O remoto falha fechado sem transporte e sem autorização. | `IMPLEMENTED`; 4 internos `EXECUTED`; Blender/ComfyUI só com stub |
| Blender headless | `electron/blender-adapter.cjs`, `scripts/blender_spritesheet.py` | `spawn` com `shell: false`, `--background --python <script first-party>`. Um único fluxo: modelo existente → spritesheet. | `IMPLEMENTED`; **Blender real não `EXECUTED`** aqui |
| Servidor MCP próprio | `scripts/spriteforge-mcp.mjs` | stdio, 10 tools `spriteforge_*` (status, listar, criar asset, anexar referência, preparar task, atualizar etapa, abrir painel). Não gera arte, não chama provider. | `IMPLEMENTED`; **não `EXECUTED` nesta sessão** (ver 1.2) |
| QA determinístico | `shared/qa/validators.mjs` e afins | Validadores nomeados: `png-structural`, `png-content`, `glb-structural`, `rig2d-structural`, `animation-loop`, `destination-profile`. | `IMPLEMENTED` + `EXECUTED` (fixtures) |
| Asset manager | `shared/assets/manager.mjs` | Versões com SHA-256, declarações de licença, estados `owned / licensed / license-pending / …`, flag `redistributable`. | `IMPLEMENTED` + `EXECUTED` (smoke) |
| Isolamento do renderer | `electron/main.cjs` | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; guardas de IPC e navegação. | `IMPLEMENTED` + `EXECUTED` (smoke) |
| Skill first-party | `.agents/skills/lia-brand-check/SKILL.md` | Única Skill; trata de marca, não de produção. | `IMPLEMENTED` (conteúdo) |

**Ausências confirmadas por busca no código de `5b0ec51`:** nenhum `roleId`/papel de agente; nenhum carregador, manifesto ou registro de Skills em runtime; nenhuma chamada de LLM; nenhum cliente MCP (a Forge só é *servidor*); nenhuma ocorrência de `rollback`, `restore` ou `supersede` em `shared/` e `electron/`; nenhuma classificação de dados (`public/internal/private/secret`); Three.js não consta em `package.json` nem é importado.

### 1.2 Testes executados (cópia de `5b0ec51` em diretório temporário, sem `npm install`)

Rodei individualmente os 33 arquivos da cadeia `npm test`, com Node v22.22.3.

- **30 passaram**, entre eles `orchestrator-engine-smoke`, `run-lifecycle-smoke`, `workflow-coverage-smoke`, `adapter-sdk-smoke`, `qa-content-smoke`, `asset-manager-smoke`, `studio-service-smoke`, `blender-adapter-smoke`, `host-integration-smoke`, `domain-contracts-smoke`.
- **3 não rodaram por dependência ausente** (não instalei nada, por regra): `mcp-smoke.mjs` (falta `@modelcontextprotocol/sdk`), `vite-store-smoke.mjs` e `studio-ui-render-smoke.mjs` (falta `vite`). Isso é "não executado", não "falhou por defeito".

Alcance dessa evidência: prova que a lógica de plano, gates, engine e validadores se comporta como os testes descrevem **com entradas sintéticas e ferramentas simuladas**. Não prova que um asset de jogo real foi produzido.

### 1.3 Metadados externos verificados (API do GitHub, 2026-11-14)

Campos consultados: licença SPDX reportada, estrelas, data do último push, arquivado ou não. Estrelas não medem qualidade. SPDX `NOASSERTION`/`NONE` significa que o GitHub não reconheceu uma licença padrão na raiz; exige leitura do arquivo antes de qualquer uso.

| Repositório | SPDX | ★ | Último push | Observação verificada |
|---|---|---|---|---|
| `ahujasid/mcp-for-blender` | MIT | 34.330 | 2026-11-13 | Sem release no GitHub (pin só por commit). README: socket **sem autenticação nem criptografia** na porta 9876; **por padrão o agente executa qualquer Python no Blender**; `BLENDER_MCP_SAFE_MODE=1` é opt-in; traz integrações remotas embutidas (Poly Haven, Sketchfab, Meshy, Tripo, Rodin, Hunyuan3D) e seção de telemetria. |
| `Comfy-Org/comfy-mcp` | NOASSERTION | 342 | 2026-11-14 | Coerente com a classificação dual AGPL/comercial da T14; não reli o arquivo de licença. |
| `artokun/comfyui-mcp` | MIT | 924 | 2026-11-09 | Ativo. |
| `joenorton/comfyui-mcp-server` | Apache-2.0 | 412 | 2026-02-17 | ~9 meses sem push. |
| `nanayax3/krita-mcp` | MIT | 53 | 2026-02-26 | Pequeno e ~9 meses sem push. |
| `diivi/aseprite-mcp` | MIT | 993 | 2026-11-03 | Ativo; sem release. Aseprite em si é pago. |
| `willibrandon/pixel-mcp` | MIT | 160 | 2025-10-18 | **Mais de um ano sem push.** |
| `Coding-Solo/godot-mcp` | MIT | 6.636 | 2026-04-16 | ~7 meses sem push; 75 issues abertas; Node ≥ 18. Lança editor, roda projeto, captura saída. |
| `CoplayDev/unity-mcp` | MIT | 15.960 | 2026-10-30 | Exige editor Unity (proprietário). |
| `chongdashu/unreal-mcp` | **NONE** | 2.117 | 2025-04-22 | Sem licença e parado: bloqueado. |
| `meshy-dev/meshy-mcp-server` | MIT | 93 | 2026-11-13 | Wrapper; o destino é serviço remoto pago. |
| `pixellab-code/pixellab-mcp` | **NONE** | 48 | 2025-08-10 | Sem licença: bloqueado. |
| `modelcontextprotocol/servers` | NOASSERTION | 91.976 | 2026-11-12 | Referência. |
| `modelcontextprotocol/typescript-sdk` | NOASSERTION | 13.764 | 2026-11-10 | Já é dependência declarada em `5b0ec51` (`@modelcontextprotocol/sdk` 1.32.2). Licença a reler. |
| `gamedev-skills/awesome-gamedev-agent-skills` | Apache-2.0 | 8.773 | 2026-11-12 | Release v2.0.0 (2026-11-11). |
| `arjun988/blender-skills` | MIT | 2.763 | 2026-11-06 | Sem release. |
| `anthropics/skills` | **NONE** | 194.156 | 2026-11-06 | **Diverge da T14** ("Apache-2.0 por skill"): não há licença na raiz; o README diz que *muitas* Skills são Apache-2.0 e que as de documentos têm outro regime. Verificar Skill a Skill. |
| `aldegad/sprite-gen` | Apache-2.0 | 4.057 | 2026-11-07 | Ativo. |
| `SifuInTheShell/Effigy` | MIT | 260 | 2026-11-13 | Release v0.4.0 (2026-11-06). README declara Windows 11 + NVIDIA 16 GB (AMD RX 9070 só no modo rápido); usa Blender headless fixado em versão; exporta `CREDITS.txt` e `LICENSES.json`. |
| `wangchaozhi/game-asset-agent` | **NONE** | 0 | 2026-07-07 | Sem licença, sem adoção. |
| `langchain-ai/langgraph` | MIT | 44.926 | 2026-11-14 | Referência de padrão. |
| `openai/openai-agents-python` | MIT | 30.658 | 2026-11-14 | Referência de padrão. |
| `temporalio/temporal` | MIT | 24.388 | 2026-11-14 | Referência de padrão. |
| `promptfoo/promptfoo` | MIT | 27.148 | 2026-11-14 | Candidato a ferramenta de desenvolvimento. |
| `ollama/ollama` · `ggml-org/llama.cpp` | MIT | 186.902 · 134.885 | 2026-11-14 · 11-13 | Runtimes; a licença dos **pesos** é separada. |
| `mrdoob/three.js` | MIT | 118.327 | 2026-11-14 | Biblioteca. |
| `KhronosGroup/glTF-Validator` | Apache-2.0 | 481 | 2026-10-06 | Validador de referência glTF. |
| `donmccurdy/glTF-Transform` | MIT | 2.076 | 2026-10-20 | Inspeção e otimização de glTF em Node. |
| `zeux/meshoptimizer` | MIT | 8.851 | 2026-10-14 | Simplificação e compressão de malha. |
| `KhronosGroup/glTF-Blender-IO` | Apache-2.0 | 1.679 | 2026-11-11 | Exportador glTF do Blender. |
| `blender/blender` (espelho) | NOASSERTION | 21.960 | 2026-11-13 | Blender é GPL; usar como processo separado. |
| `godotengine/godot` | MIT | 120.105 | 2026-11-13 | Engine; execução headless possível. |
| `Comfy-Org/ComfyUI` | GPL-3.0 | 146.698 | 2026-11-14 | Usar via HTTP, processo separado. |
| `VAST-AI-Research/UniRig` | MIT | 2.107 | 2026-06-04 | ~5 meses sem push; licença de pesos não verificada. |
| `microsoft/TRELLIS.2` | MIT | 12.893 | 2026-07-10 | Licença de pesos e requisito de GPU não verificados aqui. |

**Não verificado nesta sessão:** preços, planos, termos de uso, retenção de dados e licença de saída de qualquer serviço comercial (Meshy, Tripo, Scenario, PixelLab, Ludo, Rodin, Mixamo); licenças de pesos de modelos; conteúdo interno das Skills externas; comportamento real de qualquer MCP externo. Os valores citados na T14 são herdados daquela pesquisa e seguem como **`unknown` até conferência no site do fornecedor**.

---

## 2. Conceitos que não podem se misturar

| Conceito | Definição operacional na Forge | Tem efeito no mundo? | Quem autoriza | Estado em `5b0ec51` |
|---|---|---|---|---|
| **Knowledge** | Fato de referência, versionado e citável (perfil de destino, orçamento de triângulos, convenção de eixos). Dado puro. | Não | Curadoria humana | Parcial: perfis de destino em `shared/destinations/profiles.mjs` |
| **Skill** | Procedimento em texto (checklist, critério, passo a passo) que orienta um humano ou um agente. **É dado não confiável até revisão**; nunca concede permissão. | Não por si | Curador assina o `trust` | 1 Skill de marca; nenhum mecanismo de runtime |
| **Tool** | Programa executável (Blender, Krita, Godot, validador). | Sim | Usuário, por ação | Descoberta em `electron/external-tools.cjs` |
| **Provider** | Quem oferece uma capability: modelo local, serviço remoto ou runtime. Substituível. | Sim; pode custar e receber dados | Usuário, por chamada | Hub em `shared/hub/provider-hub.mjs` |
| **Adapter** (ponte) | Código da Forge que traduz capability → chamada de tool/provider, com manifesto, custo e licença declarados. | Sim, de forma delimitada | Gate do engine | 7 adapters |
| **Workflow** | Grafo determinístico de passos com contratos de entrada/saída, validadores e gates. | Orquestra efeitos | Usuário aprova o plano | 8 receitas + engine |
| **Agente** | Processo com LLM no laço que **escolhe** a próxima ação entre tools permitidas, com contexto próprio. | Sim, de forma não determinística | Gate por ação, sempre | **Não existe dentro da Forge.** Só há handoff para agente externo (Claude Code, Codex, OpenCode) via MCP |

Regra de decisão, em ordem: se dá para escrever como função determinística, é **passo de workflow**; se é orientação que muda a qualidade mas não executa nada, é **Skill**; se é um fato, é **knowledge**; só vira **agente** o que exige julgamento aberto com várias chamadas de tool.

**MCP não é nenhum desses conceitos**: é um protocolo de transporte. Um servidor MCP expõe tools; ele herda todo o risco da tool que embrulha.

---

## 3. Papéis: o que precisa ser agente e o que não precisa

Critério para justificar um agente independente (os quatro precisam valer):

1. a tarefa exige julgamento aberto que não cabe em regra;
2. exige várias chamadas de tool cuja ordem depende do resultado anterior;
3. o conjunto de permissões é diferente do dos demais papéis (fronteira de isolamento);
4. contexto separado traz ganho real (por exemplo, o revisor não ver a justificativa de quem produziu).

| Papel pedido | Veredito | Motivo | O que é hoje |
|---|---|---|---|
| Orquestrador | **Passo determinístico**, não agente | Seleção por capability e restrições é regra. LLM, se houver, só propõe texto de brief; nunca decide rota. | `IMPLEMENTED` em `5b0ec51` |
| Intérprete de brief | **Agente opcional (A1)** | Transformar pedido livre em brief estruturado exige julgamento. Permissão: leitura do brief; zero tools com efeito. | `PROPOSED` |
| Concept art | **Provider + Skill + gate humano** | Geração é chamada a provider; direção de arte é Skill; escolha é humana. Não há laço de tools. | Adapter ComfyUI `IMPLEMENTED`, não executado com ComfyUI real |
| Modelagem 3D (geração) | **Provider + passo** | Imagem→3D é uma chamada; limpeza básica é script. | Capability `model3d.generate` existe na receita, **sem adapter** (passo bloqueado) |
| Modelagem/limpeza no DCC | **Agente (A2: operador de DCC)**, só quando script não basta | Único caso com laço real de inspeção→ação→inspeção no Blender. É também o de maior risco. | `PROPOSED` |
| Rigging | **Passo + Skill de checklist + gate humano** | Auto-rig é uma chamada; a qualidade de pesos é revisão humana. | Capability `rig3d.auto` **sem adapter** |
| Animação | **Provider/passo + gate humano** | Geração ou retarget é chamada; "pé escorregando" é olho humano. | `motion.cycles` **sem adapter** para 3D; rig 2D interno `IMPLEMENTED` |
| Spritesheet | **Passo determinístico** | Câmera, quadros, atlas e manifesto são totalmente especificáveis. | `IMPLEMENTED`; Blender real não executado aqui |
| Otimização | **Passo determinístico** | Orçamento e diff antes/depois; sem LLM. | Parcial |
| QA estrutural | **Passo determinístico** | Validadores. | `IMPLEMENTED` + `EXECUTED` em fixtures |
| QA visual assistivo | **Agente opcional (A3: co-revisor)** | Vale por ter contexto isolado de quem produziu. Só sinaliza; nunca aprova. | `PROPOSED` |
| Aprovação final | **Humano, indelegável** | Regra do produto. | Gate de revisão `IMPLEMENTED` |
| Curadoria de Skills | **Processo humano**, com apoio de script de verificação | Decisão de confiança não se delega a um agente. | `PROPOSED` |

**Resultado: no máximo três agentes (A1 intérprete, A2 operador de DCC, A3 co-revisor), todos opcionais.** A linha de produção funciona sem nenhum deles. Isso é mais restritivo que os 8 papéis da T14 e que os 5 subagentes de `agent-workflow.md`: aqueles são **papéis lógicos** úteis para nomear etapas e permissões, mas a maioria não passa no critério acima.

O agente externo de código (Claude Code, Codex, OpenCode) que consome o MCP da Forge fica **fora** da fronteira de confiança: a Forge lhe entrega um task spec e recebe caminhos de arquivo, que revalida.

---

## 4. Arquitetura de orquestração recomendada

```text
Pedido ─► [A1 intérprete, opcional] ─► brief estruturado ─► revisão humana
                                              │
                                              ▼
                        Planner determinístico (receitas + Hub)
                                              │  plano com custo, dados, licenças, gates
                                              ▼
                                   Aprovação humana do plano
                                              │
                                              ▼
   Engine DAG ── para cada passo ─► gate de autorização (fingerprint do escopo)
        │                                     │
        │                     ┌───────────────┼────────────────────┐
        │                     ▼               ▼                    ▼
        │              passo determinístico  provider        [A2 operador de DCC]
        │              (script first-party)  (local/remoto)   em processo isolado
        │                     └───────────────┼────────────────────┘
        │                                     ▼
        │                 envelope de handoff (artefatos + hashes + ledger)
        │                                     ▼
        │                    validadores determinísticos do passo
        │                                     ▼
        │              [A3 co-revisor, opcional: só anota] ─► revisão humana
        ▼
   checkpoint · log com hash · versão nova (nunca sobrescreve)
```

Princípios:

- **A Forge é dona do grafo.** Nenhum framework multiagente externo assume a orquestração. LangGraph, OpenAI Agents SDK e Temporal servem como referência de padrões (checkpoint, handoff, retomada); o engine próprio já cobre esses padrões em `5b0ec51`.
- **Agente é executor de um passo**, com contrato de saída igual ao de um script. O engine não distingue quem produziu o envelope; distingue apenas se ele valida.
- **Skill entra como anexo do passo**, com identificador, versão, hash e `trust`. Fica registrada no ledger como "orientou este passo".
- **Falha estrutural** (validador reprovou) pode ter nova tentativa dentro do orçamento. **Falha semântica** (aparência, proporção, movimento) para e pede humano.

---

## 5. Handoffs e contratos de entrada/saída

### 5.1 Envelope comum (`PROPOSED`)

Todo handoff entre etapas, seja de script, provider, agente ou trabalho manual, entrega o mesmo envelope:

```yaml
handoff:
  schemaVersion: 1
  fromStep: rig            # etapa que produziu
  toStep: animate          # etapa que vai consumir
  producedBy: { kind: script | provider | agent | human, id: ..., version: ... }
  artifacts:
    - { role: rigged-model, path: ..., sha256: ..., format: glb, bytes: ... }
  declared:                # o que o produtor afirma; o consumidor revalida
    units: meters
    upAxis: Y
    scaleReference: 1.7
  validators: [ { id: glb-structural, result: pass, reportSha256: ... } ]
  provenance:
    inputs: [ { sha256: ..., origin: user | generated | third-party, license: ... } ]
    tools:  [ { name: blender, version: ..., license: GPL } ]
    models: [ { name: ..., weightsSha256: ..., license: ..., verifiedOn: ... } ]
    skills: [ { id: ..., version: ..., sha256: ..., trust: first-party } ]
    remote: [ { destination: ..., bytesSent: ..., cost: known|unknown, consentRef: ... } ]
  review: { required: true, state: pending | approved | rejected, by: ..., artifactSha256: ... }
  openIssues: [ ... ]      # o que o produtor sabe que está incompleto
```

Regras: o consumidor **nunca confia no campo `declared`** e revalida; uma etapa pulada fica `out_of_scope`, nunca "concluída" (regra já presente em `agent-workflow.md`); o envelope é imutável, e uma correção gera envelope novo que referencia o anterior.

### 5.2 Contratos por etapa

| Handoff | Entrada mínima | Saída exigida | Validação determinística | Gate humano | Estado em `5b0ec51` |
|---|---|---|---|---|---|
| Brief → **Concept** | Brief estruturado; referências com origem e licença | ≥ 3 vistas distintas (frente, perfil, costas) em PNG; decisões de design | `png-structural`, `png-content`; contagem de vistas | Escolha de direção; **coerência entre vistas não é verificada por código** | Adapter ComfyUI existe; regra das 3 vistas existe no MCP; execução real ausente |
| Concept → **Modelagem** | Vistas aprovadas (hash da aprovação) | GLB; unidades, eixo e escala declarados; contagem de triângulos | `glb-structural` | Silhueta e proporção | Inspeção de GLB `IMPLEMENTED`; **geração sem adapter**; faltam validadores de non-manifold, sobreposição de UV e orçamento de triângulos |
| Modelagem → **Rigging** | GLB aprovado | GLB com esqueleto e pesos; mapa de nomes de ossos; osso raiz | Presença de skin, hierarquia, nomes | Deformação em poses de teste | **Sem adapter 3D**; rig 2D interno existe |
| Rigging → **Animação** | Modelo rigado aprovado; lista de clips, FPS, duração | Clips nomeados conforme o pedido; root motion declarado | `animation-loop` (primeiro quadro ≈ último) | Pé escorregando, peso, leitura do movimento | Validador existe; **geração/retarget 3D sem adapter** |
| Animação → **Spritesheet** | Modelo animado aprovado; câmera, tamanho de quadro, direções, pivô | Atlas PNG + manifesto JSON (quadros, retângulos, pivô, FPS, clip) | `png-structural`, `png-content`, consistência do manifesto | Leitura na resolução final | **Caminho mais completo**: adapter, script e validadores existem; falta rodar com Blender real |
| Spritesheet → **QA / entrega** | Atlas + manifesto + perfil do destino | Pacote do destino + relatório + ledger | `destination-profile`; hashes | Aprovação final sobre o hash exato | `export-package` e revisão por SHA-256 `IMPLEMENTED` + `EXECUTED` em fixtures |

Leitura honesta da tabela: **só a última metade da cadeia (modelo existente → spritesheet → QA → pacote) tem código**. Concept depende de ComfyUI não exercitado; modelagem, rigging e animação 3D são passos declarados na receita e bloqueados por falta de adapter. Um "agente de rigging" hoje não teria tool alguma para chamar.

---

## 6. Blender e Three.js

### 6.1 Blender

| Rota | O que é | Risco | Estado | Recomendação |
|---|---|---|---|---|
| **B1. Headless com script first-party** | `blender --background --python <script da Forge>`, `shell: false`, argumentos fechados | Baixo: o código executado é da Forge e é revisável | `IMPLEMENTED` em `5b0ec51` para um fluxo (spritesheet); não executado com Blender real nesta sessão | **Rota principal.** Ampliar por operações nomeadas e fechadas (inspecionar, medir, exportar, renderizar) |
| **B2. Bridge com add-on próprio** | Especificado em `BLENDER-BRIDGE-SPECIFICATION.md` | Médio: superfície maior, sessão interativa | `PROPOSED` | Só depois de B1 estar `VALIDATED` |
| **B3. MCP de terceiros (`mcp-for-blender`)** | Add-on abre socket; agente envia Python | **Alto**: Python arbitrário por padrão, socket sem autenticação, integrações remotas embutidas, telemetria a auditar, sem release para fixar | Não instalado, não executado | **Não embutir.** Admissível apenas como experimento manual do usuário, fora do produto, com modo seguro ligado, integrações remotas desligadas, cópia descartável do `.blend` e sem credenciais no ambiente |

Regras para qualquer rota: Blender roda como **processo separado** (GPL não se mistura ao código da Forge); a versão do Blender entra no ledger; o `.blend` de origem nunca é sobrescrito; a saída vai para diretório novo e só é promovida após validação.

O agente A2 só faz sentido sobre B1/B2, escolhendo entre **operações nomeadas** da Forge. Um agente que escreve Python livre dentro do Blender equivale a dar shell ao modelo.

### 6.2 Three.js

- **Fato:** não há viewport 3D. Three.js não é dependência em `5b0ec51`; a interface declara que a ilustração não é um visualizador de modelo. O pacote `docs/threejs-3d-environment/` é `PROPOSED`.
- **Papel recomendado:** inspeção, pré-visualização e **geração de evidência de QA** (turntable, poses de teste, captura por quadro). Não é ferramenta de autoria e não substitui o Blender.
- **Valor para a cadeia de agentes:** é o que permite revisão humana rápida dos handoffs de modelagem, rigging e animação sem abrir o DCC, e é a fonte de imagens para um eventual co-revisor A3.
- **Segundo renderizador de spritesheet:** a especificação de contratos prevê comparar Blender e WebGL com a mesma entrada. Isso continua `PROPOSED`, sem renderizador padrão escolhido.
- **Peças candidatas, todas não adotadas:** `three.js` (MIT), `glTF-Validator` (Apache-2.0), `glTF-Transform` (MIT), `meshoptimizer` (MIT). Licença e atividade conferidas em 1.3; integração e desempenho na RX 580 não medidos.
- **Limite:** WebGPU na RX 580 não foi medido; o piso deve ser WebGL2.

---

## 7. Permissões, isolamento, aprovação humana e rollback

### 7.1 Níveis de permissão (`PROPOSED`)

| Nível | Pode | Exemplos | Aprovação |
|---|---|---|---|
| P0 Ler | Ler arquivos dentro do projeto | Inspecionar GLB, validar PNG | Nenhuma além de abrir o projeto |
| P1 Escrever em área nova | Criar arquivos em diretório de run | Renderizar spritesheet | Aprovação do plano |
| P2 Executar tool local com script da Forge | Blender headless, Godot headless | Uma operação nomeada | Por passo, com fingerprint |
| P3 Executar código não first-party em tool | Python livre no DCC, script de Skill externa | — | **Negado por padrão**; exceção manual, caso a caso |
| P4 Rede / envio de dados | Provider remoto | Imagem→3D em serviço | Por chamada: destino, bytes, hash, custo, retenção |
| P5 Custo | Qualquer chamada paga | — | Por chamada, com teto; custo `unknown` exige confirmação consciente |
| P6 Instalar / baixar pesos | Add-on, modelo, MCP | — | Por item: origem, hash, licença, tamanho |
| P7 Sobrescrever / apagar | Substituir versão, limpar | — | Confirmação separada, com backup |

Estado real: as ações protegidas em `gates.mjs` e `sdk.mjs` são quatro — `send_data`, `cost`, `install_software`, `download_models_or_weights` — o que cobre P4, P5 e P6. **Não há ação protegida para P3 (executar código arbitrário) nem para P7 (sobrescrever/apagar)**, embora `WORKFLOW-ENGINE.md` liste "Sobrescrever/apagar" na tabela de gates. A lista também está duplicada nos dois arquivos, com padrões de redação de segredo ligeiramente diferentes: risco de divergência.

### 7.2 Regras de segurança

- **Recomendação não é autorização.** Texto vindo de Skill, de agente, de README, de saída de tool ou de metadado de arquivo é dado. Nenhum deles pode ligar rede, baixar modelo, relaxar gate ou ampliar escopo. A autorização vem só do usuário e fica presa ao fingerprint do escopo.
- **Isolamento por processo.** Cada tool e cada agente rodam em processo filho, sem shell, com diretório de trabalho próprio, ambiente mínimo e **sem credenciais herdadas**, com timeout e encerramento da árvore de processos (o `task-manager.cjs` já faz isso para tarefas locais).
- **Permissão por papel, mínima.** A1 não tem tool com efeito. A2 tem apenas operações nomeadas de DCC, sem rede. A3 lê imagens e escreve anotações.
- **Admissão de MCP externo** (tudo `PROPOSED`): licença lida no commit fixado; lista fechada de tools; sem rede, salvo destino declarado; nenhum token em arquivo do projeto; log de chamada com hash de entrada e saída; revisão de telemetria; interruptor de emergência testado.
- **Admissão de Skill externa:** fixar por commit e hash; revisão humana do texto; varredura de instruções que peçam rede, instalação ou execução; `trust` assinado por pessoa; Skill não traz script executável para dentro do produto.
- **Dados:** classificar cada entrada (`public / internal / private / secret`) antes de qualquer P4. Hoje essa classificação **não existe no código**.

### 7.3 Rollback

Estado real: o asset manager guarda versões com hash, e a revisão é ancorada em SHA-256, o que é a base correta. **Não encontrei operação explícita de rollback, restauração ou substituição de versão** em `shared/` e `electron/`.

Desenho recomendado (`PROPOSED`):

1. Artefatos são imutáveis e endereçados por hash; toda etapa escreve em diretório novo.
2. A "versão atual" de um asset é um ponteiro; promover é mover o ponteiro, e só com aprovação humana sobre o hash exato.
3. Rollback é mover o ponteiro de volta e registrar o evento. Nada é apagado.
4. Descendentes de uma versão revertida ficam marcados como desatualizados, não removidos.
5. Efeito remoto não tem rollback: o que foi enviado ou pago é registrado como irreversível, e isso é dito ao usuário **antes** da chamada.
6. Limpeza de disco é ação P7 separada.

---

## 8. QA e proveniência

| Camada | O que cobre | Quem decide | Estado |
|---|---|---|---|
| 1. Estrutural | Formato, dimensões, alpha, manifesto, estrutura de GLB, laço de animação, perfil de destino | Código | `IMPLEMENTED` + `EXECUTED` em fixtures (`5b0ec51`) |
| 2. Conteúdo determinístico | Sangramento de atlas, padding, tiling, non-manifold, UV sobreposta, orçamento de triângulos, pesos ausentes | Código | Parcial (`png-content`); a parte 3D está `PROPOSED` |
| 3. Evidência visual | Turntable, poses de teste, primeiro/meio/último quadro | Código gera; humano olha | `PROPOSED` (depende do viewport) |
| 4. Co-revisão por modelo | Sinalizar suspeitas | Agente A3 anota; **nunca aprova** | `PROPOSED`; sem modelo escolhido, sem taxa de falso alarme medida |
| 5. Aprovação | Qualidade final | Humano | Gate `IMPLEMENTED` |

**Ledger de proveniência por entrega (`PROPOSED`):** o pacote final deve trazer, por componente, origem, hash, licença, data de verificação da licença, uso permitido e o que saiu da máquina. O Effigy faz algo equivalente com `CREDITS.txt` e `LICENSES.json` por exportação. Em `5b0ec51` a base existe (declarações de licença, estado `redistributable`, hashes), mas **não há registro de quais Skills influenciaram um passo nem de dados enviados**, porque nenhum dos dois mecanismos existe.

Critério de pronto de um asset: validadores da camada 1 e 2 aprovados **e** aprovação humana sobre o hash **e** ledger completo, sem licença pendente. Faltando qualquer um, o estado é `partial`, nunca `ready`.

---

## 9. Opções locais, gratuitas e pagas

Nenhum custo ou autorização é assumido aqui. "Gratuito" refere-se ao software; hardware, tempo e licença de saída são outra conversa. Compatibilidade com a RX 580 8 GB vem das T9–T14 e **não foi medida nesta sessão**.

| Etapa | Local e gratuito | Local com software pago | Remoto pago | Leitura |
|---|---|---|---|---|
| Brief / plano | Planner determinístico (existe); LLM local via Ollama ou llama.cpp (MIT; pesos com licença própria) | — | Agente externo do usuário | LLM é opcional. Viabilidade de 7B na RX 580: `unknown` |
| Concept art | ComfyUI (GPL-3.0, processo separado); Krita manual | Aseprite | Serviços de imagem | Local é lento no hardware-alvo segundo a T14 |
| Modelagem 3D | Blender manual; geradores abertos exigem GPU que o alvo não tem, segundo a T9/T10 | — | Serviços de imagem→3D | **Sem rota local automática comprovada.** Decisão humana: manual ou remoto |
| Rigging | Rigify (acompanha o Blender); UniRig (MIT, pesos a verificar) | — | Mixamo (termos a verificar) e outros | Lacuna: nenhum adapter |
| Animação | Keyframe manual no Blender; candidatos locais de motion citados na T9 | — | Serviços de motion | Lacuna: retarget para GLB |
| Spritesheet | Blender headless + script da Forge (existe) | Aseprite para retoque | — | **Rota mais madura** |
| Otimização | Blender, `meshoptimizer`, `glTF-Transform` | — | — | Determinístico, bom candidato a código próprio |
| QA | Validadores da Forge; `glTF-Validator`; Godot headless | — | — | Local resolve |
| Operar DCC por agente | B1 da Forge; MCPs MIT de Blender, Krita e Godot | MCP de Aseprite, Unity | — | Ver riscos em 6.1 e 7.2 |

### 9.1 O que é realmente executável hoje

| Classe | Itens | Por quê |
|---|---|---|
| **Executável com evidência nesta sessão** | Planner, engine, gates, validadores, asset manager, empacotamento, rig 2D e VFX procedurais internos da Forge (`5b0ec51`) | 30 testes passaram, com fixtures e stubs |
| **Executável em princípio, não exercitado aqui** | Blender headless → spritesheet; ComfyUI local por HTTP; servidor MCP da Forge | Código existe; a ferramenta real ou a dependência não estava presente |
| **Executável por terceiros, com requisito incompatível ou risco alto** | Effigy (pede NVIDIA 16 GB); `mcp-for-blender` (roda, mas com Python arbitrário) | Funcionam fora do envelope de hardware ou de segurança da Forge |
| **Catálogo ou orientação, não execução** | Coleções de Skills (`awesome-gamedev-agent-skills`, `blender-skills`, `anthropics/skills`) | Texto instrucional; valor depende de curadoria e de existir uma tool por trás |
| **Demonstração ou sem condição de uso** | `game-asset-agent` (sem licença, 0 estrelas); `chongdashu/unreal-mcp` e `pixellab-mcp` (sem licença); `pixel-mcp` (parado há mais de um ano) | Bloqueados ou abandonados |
| **Depende de decisão e de verificação externa** | Todos os serviços remotos | Termos, preço, retenção e licença de saída não verificados |

---

## 10. Lacunas da implementação atual

| # | Lacuna | Evidência | Prioridade |
|---|---|---|---|
| G0 | **Código e seis documentos-base fora da `main`**; documentos da `main` apontam para arquivos inexistentes | Seção 0 | P0 (decisão) |
| G1 | Nenhuma execução com ferramenta real registrada; nada `VALIDATED` | Seção 1.2; ferramentas ausentes | P0 |
| G2 | Não há envelope de handoff único nem ledger por entrega | Seções 5.1 e 8 | P0 |
| G3 | Modelagem, rigging e animação 3D: capabilities declaradas sem adapter | Receita `prompt→3D→2D` do planner | P1 |
| G4 | Ações protegidas não cobrem executar código arbitrário nem sobrescrever/apagar; lista duplicada | Seção 7.1 | P1 |
| G5 | Sem rollback explícito | Seção 7.3 | P1 |
| G6 | Sem classificação de dados para envio remoto | Seção 7.2 | P1 (antes de qualquer provider remoto) |
| G7 | Orçamento de correção incompleto: há `retry.maxAttempts` e `costCeiling` no fingerprint, mas não há acúmulo de custo por run nem distinção entre falha estrutural e semântica | `execution-manager.mjs`, `gates.mjs` | P1 |
| G8 | QA de conteúdo 3D ausente (non-manifold, UV, triângulos, pesos) | Seção 8 | P1 |
| G9 | Sem viewport nem evidência visual para revisão de 3D | Seção 6.2 | P2 |
| G10 | Skills sem mecanismo de runtime, manifesto ou `trust` | Seção 1.1 | P2 |
| G11 | Sem papel de agente, sem LLM, sem cliente MCP | Seção 1.1 | P3 (por desenho: vem por último) |
| G12 | `mcp-smoke` e os dois testes de interface não executados nesta sessão | Seção 1.2 | Verificar em ambiente com dependências |
| G13 | Divergências de pesquisa: licença de `anthropics/skills`; MCPs com manutenção fraca classificados como candidatos | Seção 1.3 | Corrigir nos documentos T14 quando forem revisados |

Nota sobre a T14: a lacuna L1 daquele documento ("falta orçamento de tentativas") está **parcialmente desatualizada**, pois o engine já tem tentativas com backoff. O que falta é a parte de custo e a política por tipo de falha (G7).

---

## 11. Roadmap priorizado

Sem calendário; ordenado por dependência. Cada fase exige decisão humana antes de começar.

| Ordem | Fase | Entrega | Critério de aceite | Depende de |
|---|---|---|---|---|
| 0 | **Decisão de base** | Definir onde vive o código: integrar a T13 à `main` por PR revisado, ou declarar outra branch como base | Documentos da `main` deixam de apontar para arquivos inexistentes | — |
| 1 | **Primeiro handoff real** (seção 12) | Modelo existente → spritesheet → QA → pacote, com Blender real, envelope e ledger | Um asset com evidência `VALIDATED` | 0 |
| 2 | Permissões e rollback | Ações protegidas para código arbitrário e sobrescrita; lista única; ponteiro de versão com reversão | Testes de negação e de reversão | 1 |
| 3 | QA de conteúdo 3D | Validadores de malha, UV, triângulos e pesos | Fixtures positivas e negativas | 1 |
| 4 | Evidência visual | Viewport mínimo de inspeção e captura (Three.js, WebGL2) | Turntable e poses geradas para o asset da fase 1 | 1, decisão sobre dependência |
| 5 | Etapas 3D que faltam | Um adapter por etapa (rig, depois animação), rota manual primeiro | Handoff com envelope validado em cada uma | 2, 3 |
| 6 | Skills de runtime | Manifesto, `trust`, 3 a 5 Skills first-party anexáveis a passos | Skill aparece no ledger; Skill não assinada é recusada | 1 |
| 7 | Provider remoto piloto | Classificação de dados, consentimento por chamada, modo de simulação antes da chamada real | Simulação sem rede; termos verificados e registrados | 2, decisão de custo e fornecedor |
| 8 | Agentes | A1 (intérprete), depois A3 (co-revisor), por último A2 (operador de DCC) | Cada um com permissão mínima testada e sem poder de aprovação | 2, 4, 6 |
| 9 | MCP externo | Avaliação isolada de um MCP local, somente leitura | Lista fechada de tools, log com hash, interruptor testado | 2, 8 |

Agentes e MCP externos ficam no fim de propósito: sem handoff validado, permissões completas e evidência visual, um agente só acrescenta não determinismo a uma cadeia que ainda não provou nada.

---

## 12. A única próxima fatia recomendada

**Homologar um handoff real de ponta a ponta: modelo GLB existente → Blender headless → spritesheet → QA determinístico → revisão humana → pacote com ledger.**

Por que esta e não outra:

- É o **único trecho da cadeia com código completo** (adapter, script, validadores, gate de revisão, empacotamento), e ainda assim nunca foi exercitado com Blender real em evidência registrada.
- Coincide com a "primeira homologação técnica" já definida em `DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`.
- É 100 % local, sem custo de serviço, sem envio de dados, sem LLM, sem Skill externa e sem MCP externo.
- Produz o primeiro item `VALIDATED` do projeto e o molde (envelope + ledger) que todas as outras etapas e todos os futuros agentes vão reutilizar.

Escopo:

1. Entrada: um GLB próprio do usuário ou sintético, com licença declarada.
2. Execução na máquina do usuário, com a versão do Blender que ele autorizar, pela rota B1.
3. Saída: atlas PNG + manifesto + envelope de handoff (seção 5.1) + ledger (seção 8).
4. Validação estrutural automática e aprovação humana ancorada no hash.
5. Registro de evidência: versão do Blender, comando, hashes, tempo, resultado dos validadores, decisão do revisor.

Fora do escopo: geração de modelo, rig, animação nova, agentes, Skills de runtime, providers remotos, viewport.

Pré-condições que são decisões humanas, não trabalho técnico: (a) resolver G0, isto é, de qual commit a fatia parte; (b) autorizar o uso do Blender já instalado na máquina do usuário e informar a versão; (c) autorizar a escrita do envelope e do ledger como novos contratos.

Critério de aceite: um terceiro consegue, só com o pacote entregue, dizer o que entrou, o que foi executado, com qual versão, o que saiu, quem aprovou e sob qual licença — e reproduzir os hashes.

---

## 13. Decisões humanas em aberto

1. Onde vive o código (G0)?
2. O envelope de handoff e o ledger podem ser introduzidos como contratos, dado que a especificação de Domain Contracts segue "não autorizada para implementação"?
3. Three.js pode entrar como dependência do produto para evidência visual?
4. Provider remoto: sim ou não; se sim, qual fornecedor, qual teto de custo e qual classe de dados pode sair?
5. Quem assina o `trust` de uma Skill?
6. LLM local para A1/A3: autorizado? Qual modelo, com qual licença de pesos?
7. Operação de DCC por agente (A2): desejada, ou a rota por scripts nomeados basta?

---

## 14. Fontes

**Repositório, `main` @ `6bd9a5a`:** `AGENTS.md`, `README.md`, `docs/RESEARCH-CONSOLIDATION-2026-11-13.md`, `docs/T14-AGENT-ECOSYSTEM-RESEARCH.md`, `docs/T14-AGENT-ORCHESTRATION-ARCHITECTURE.md`, `docs/T14-AGENT-SKILLS-MCP-MATRIX.md`, `docs/T14-AGENT-SOLUTIONS-CATALOG.md` (índice e resumo de classificação lidos por inteiro; entradas individuais lidas por amostragem), `docs/BLENDER-BRIDGE-SPECIFICATION.md` (cabeçalho), `docs/threejs-3d-environment/README.md` e `17-ROADMAP-INTEGRACAO-SKILLS.md` (cabeçalho e estrutura).

**Repositório, `arena/649f88bd-3dspritesheet` @ `5b0ec51` (somente leitura):** `docs/agent-workflow.md`, `docs/mcp.md`, `docs/INTELLIGENT-ORCHESTRATOR.md`, `docs/WORKFLOW-ENGINE.md` (lidos por inteiro); `docs/TOOL-PROVIDER-HUB.md` (estado, vocabulário e estrutura); `docs/DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md` (estado, restrições aprovadas e estrutura; 247 KB, não lido linha a linha); `docs/SKILLS-KNOWLEDGE-ENGINE.md` (estado); código em `shared/`, `electron/`, `scripts/`, `tests/` e `package.json`, inspecionado por leitura dirigida e busca.

**GitHub:** `gh api repos/{owner}/{repo}` para os repositórios da seção 1.3; `gh api …/readme` para `ahujasid/mcp-for-blender`, `Coding-Solo/godot-mcp`, `SifuInTheShell/Effigy` e `anthropics/skills`; `gh api …/releases/latest` para seis deles; `gh pr list` e `git ls-remote` para o estado de branches e PRs. Data de todas as consultas: 2026-11-14.

## 15. Limitações desta auditoria

- Instantâneo de um único dia; metadados do GitHub mudam.
- A rede desta sessão alcança apenas GitHub, npm e PyPI: **sites de fornecedores não foram consultados**, portanto preços, termos, retenção e licenças de saída não foram verificados.
- Licença SPDX reportada pela API não substitui a leitura do arquivo de licença; não reli os arquivos marcados `NOASSERTION`.
- Licenças de pesos de modelos não foram auditadas.
- Nenhuma solução externa foi instalada ou executada; toda afirmação sobre o comportamento delas vem do README ou da pesquisa T14.
- O código da T13 foi lido de forma dirigida, não integral. As ausências listadas em 1.1 vêm de busca textual e podem ter escapado sob outro nome.
- Os testes cobrem lógica com stubs e fixtures; três não rodaram por falta de dependência.
- O hardware-alvo (RX 580) não foi medido aqui.
- A pesquisa de soluções partiu do catálogo T14 e o reverificou; não fiz uma nova varredura ampla do ecossistema.
