# T11 — Matriz de ferramentas e abordagens de animação 2D

> **Estado:** `RESEARCH` (2026-11-12 UTC). Nenhum item abaixo foi executado na Forge ou no hardware-alvo; **classificação de evidência** usa o vocabulário pedido: `VALIDATED_EXTERNALLY`, `VERIFIED_IN_FORGE`, `VERIFIED_ON_TARGET_HARDWARE`, `PARTIAL`, `BLOCKED`, `UNKNOWN`. Pesquisa documental **não** conta como integração.
> **Leitura:** Tabela A = dimensões técnicas; Tabela B = licença, custo, manutenção, evidência e classificação. Detalhes e fontes em [`T11-2D-SKELETAL-ANIMATION-AND-AI-RESEARCH.md`](T11-2D-SKELETAL-ANIMATION-AND-AI-RESEARCH.md).

## Tabela A — dimensões técnicas

| Ferramenta/abordagem | Resultado editável | Qualidade (relatada) | Controle / correção | Modularidade | Integração | Execução | Hardware |
|---|---|---|---|---|---|---|---|
| **Spine** (editor + runtimes) | **Sim** — bones, slots, skins, meshes, FFD, timelines | referência de mercado (profissional) | total (editor) | **skins/attachments/slots** | runtimes oficiais Godot/Unity/UE/ts/cpp/etc.; CLI **não evidenciada** | local (editor desktop) | leve (editor); runtimes mínimos |
| **Godot nativo** (`Skeleton2D`/`Bone2D`/`Polygon2D`) | **Sim** — esqueleto 2D + IK (`SkeletonModificationStack2D`) | boa para cut-out/mesh simples | total (engine) | por composição de nós (sem skins nativas) | nativa da engine MIT | local | leve |
| **OpenBone** | **Sim** — bones, skins, linked meshes, trace-mesh, FFD, state machines, **MCP** | não avaliada independentemente | total (editor web) + **agentes via MCP** | **skins por outfit + linked meshes** | própria; **MCP server**; import **.psd** | local (web/editor) | leve |
| **DragonBones** | **Sim** (runtime TS/JS) | histórica | editor sem repo público | skins/attachments | Unity/Godot via comunidade | local | leve |
| **Rive** | **Sim** (runtime) + state machines | boa para UI interativa | editor comercial | componentes/state machines | runtimes MIT multiplataforma | local/SaaS | leve |
| **Aseprite** | **Frames** (não esquelético) | excelente pixel art | total por frame | não | exporta spritesheets | local | leve |
| **OpenToonz / Synfig** | **Sim** (cut-out/mesh) | profissional tradicional | total | parcial | export variado | local | médio |
| **Live2D Cubism** | **Sim** (modelo 2.5D por partes) | referência anime 2.5D | total (editor) | partes/parâmetros | SDK proprietário | local | médio |
| **`matbn/2DAutoRigger`** | **Sim** — rig.json + camadas + exports Godot/Spine/Unity | não avaliada | **REFINE GATE** antes de fatiar; edits como log desfazível | template por parte (`cutout/hybrid/mesh`) | Godot `.tscn`, Spine json+atlas, Unity prefab; CLI | **local, sem conta/cloud/telemetria** | CPU/GPU conforme backend (sam3 gated etc.) |
| **`spine-animation-ai`** | **Sim** — skeleton.json Spine + animações de prateleira | não avaliada | preview HTML5; keys geradas | partes separadas como entrada | Spine Web Player; skill de agente | local | CPU (opencv) |
| **`see-through`** | **Camadas PSD inpaintadas** (23), sem rig | SIGGRAPH 2026; camadas completas c/ occlusão | pós-estratificação por profundidade/E-D | camadas semânticas = base p/ modularidade | PSD → Live2D/Spine/PSD-import | local (GPU) ou HF Space | GPU recomendada; sugestões low-VRAM (offload, NF4) |
| **IA animando rig Spine pronto** (método do vídeo) | **Sim** — keyframes no projeto Spine | “quase indistinguível” após 1 geração corretiva (relato do autor, modelo Claude) | gerações corretivas; **limpeza de keys ainda manual** | herda a do rig | Spine | hosted (modelos) | n/a (API) |
| **IA criando rig a partir de camadas** (tarefa 3 do vídeo) | **Parcial** — ossos como pontos, pesos inconvenientes, keys bagunçadas (relato) | inferior | exige limpeza manual | — | Spine | hosted | n/a |
| **Imagem→vídeo** (classe) | **Não** (vídeo/frames sem estrutura) | variável | quase nenhum | não | player | hosted/local | GPU |

## Tabela B — licença, custo, manutenção, evidência e classificação

| Ferramenta/abordagem | Licença código | Licença editor | Licença runtime | Pesos/modelos | Outputs | Custo | Manutenção | Evidência | Classificação |
|---|---|---|---|---|---|---|---|---|---|
| Spine | fechado | **comercial por usuário nomeado**; teto de receita <US$500k (Prof/Essential); Enterprise anual; Education sem uso comercial; Trial só avaliação | **exige licença de editor por usuário do produto** | n/a | do usuário licenciado | pago (valores **não verificados**) | ativo (runtimes push 2026-11-10) | mercado amplo; vídeo usa Spine como padrão-ouro | `BLOCKED` como dependência obrigatória da Forge; `VALIDATED_EXTERNALLY` como referência de formato |
| Godot nativo | **MIT** | MIT | MIT | n/a | do usuário | **grátis** | ativo (4.7) | docs oficiais lidas | `VALIDATED_EXTERNALLY` (destino/validador) |
| OpenBone | **MIT** | MIT (editor open) | MIT | n/a | do usuário | **grátis** | ativo 2026-11-12, **★1** | README/clean-room; sem execução independente conhecida | `PARTIAL` (candidato a avaliar) |
| DragonBones | MIT (runtime) | sem repo público | MIT | n/a | — | grátis | **dormante** (2026-01) | histórica | `UNKNOWN`/risco de manutenção |
| Rive | MIT (runtime) | comercial/SaaS (**não verificado**) | MIT | n/a | — | `UNKNOWN` | ativo | runtime verificado | `PARTIAL` |
| Aseprite | própria (source-available) | paga | — | n/a | do usuário | pago | ativo | mercado | `PARTIAL` (complemento pixel art) |
| OpenToonz / Synfig | `NOASSERTION` / **GPL-3.0** | grátis | idem | n/a | — | grátis | ativos | — | `PARTIAL` (GPL exige cuidado) |
| Live2D Cubism | SDK proprietário | comercial | proprietário | n/a | — | pago | ativo | mercado anime | `UNKNOWN` (licença não lida aqui) |
| `2DAutoRigger` | **SPDX Other** (README alega Apache-2.0 core — divergência) | — | — | sam3 **gated** (Meta SAM); birefnet MIT; lama/rtmpose Apache-2.0; humanparsing MIT | rig/camadas/exports | grátis (local) | **★0**, 2026-10-23 | README apenas | `PARTIAL` + `BLOCKED_PENDING_LICENSE_REVIEW` (divergência de licença + sam3 gated) |
| `spine-animation-ai` | **PolyForm Noncommercial 1.0.0** | — | — | n/a (CV clássica) | skeleton Spine | grátis mas **não comercial** | ★673, 2026-08-26 | README/skill | `BLOCKED` para pipeline comercial |
| `see-through` | **Apache-2.0** | — | — | pesos no HF (**licença a confirmar**); treino bootstrapped de Live2D comerciais | PSD em camadas | grátis (local) ou HF Space limitado | ★5.642, SIGGRAPH 2026 | artigo + código + demo | `VALIDATED_EXTERNALLY` (camadas) / `UNKNOWN` (pesos) |
| IA animando rig pronto (método do vídeo) | n/a | n/a | n/a | modelos nomeados no vídeo | keyframes Spine | API (preços **não verificados**; capítulo Cost ilegível) | — | comparativo do autor (rigs dele) | `VALIDATED_EXTERNALLY` com escopo declarado |
| IA criando rig de camadas (tarefa 3) | n/a | n/a | n/a | idem | rig imperfeito | idem | — | relato parcial | `PARTIAL` (exige gate humano) |
| Imagem→vídeo | várias | — | — | várias | vídeo | variado | — | — | `BLOCKED` como substituto de rig (auxiliar apenas) |

## Notas de leitura

1. **“Editável” é o critério de corte:** tudo que produz apenas vídeo/frames é classificado como auxiliar, nunca como substituto de rigging.
2. **Licença do runtime Spine é o fato decisivo:** mesmo com editor licenciado, **cada usuário do produto** precisa de licença própria — incompatível com a regra da Forge de não criar dependências obrigatórias nem custos implícitos.
3. **Estrelagem baixa não desqualifica, mas dimensiona risco:** `2DAutoRigger` (★0) e `OpenBone` (★1) têm os desenhos mais alinhados à Forge; ambos exigem execução independente antes de qualquer recomendação de adoção.
4. **Nenhum preço numérico foi verificado.** Cifras do vídeo (capítulo Cost) são **lacuna explícita**; qualquer número futuro deve vir de página oficial e ser datado.
