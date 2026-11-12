# T11 — Animação 2D esquelética com IA: pesquisa, referências e lacunas

> **Estado:** `RESEARCH`. Nenhuma ferramenta foi integrada, instalada, licenciada ou executada; nenhum asset foi enviado a serviço externo; nenhum preço foi inventado.
> **Data da consulta:** 2026-11-12 UTC. **Fontes primárias:** transcrição parcial do vídeo indicado, páginas oficiais de licença (Esoteric Software), documentação oficial Godot 4.7, repositórios GitHub (metadados, LICENSE, README) e fichas de artigos (SIGGRAPH/ICCV/ICML via repositórios).
> **Documentos irmãos:** [`T11-2D-ANIMATION-TOOLS-MATRIX.md`](T11-2D-ANIMATION-TOOLS-MATRIX.md) (matriz) e [`T11-2D-ANIMATION-WORKFLOWS.md`](T11-2D-ANIMATION-WORKFLOWS.md) (fluxos A–E e integração arquitetural).

## 1. O vídeo de referência: o que ele comprova e o que não comprova

**Identificação (fonte primária):** *“🤖 AI + SPINE 2D | AI Showdown”*, canal **Alexey Chernov** (`@SCIIIA`), publicado em **2026-11-10**, duração **28:00**, **24.319 views / 593 likes** na consulta. Linha de permissão no vídeo: *“Reproduced by permission of Playtika UK. House of Fun Limited.; © 2019 Playtika UK. House of Fun Limited”* — os assets de *House of Fun* foram usados **com autorização da Playtika UK**, o que é um dado de direitos relevante: a demonstração não implica que terceiros possam repetir o mesmo uso.

**Método declarado na transcrição (lida):**
- É a repetição, um ano depois, de um comparativo anterior; desta vez o objeto **não é geração de vídeo**, e sim **IA trabalhando diretamente em projetos Spine**: criar rig, definir keyframes e animar cenas.
- Quatro modelos comparados, **pelos nomes usados no vídeo**: **GPT-6 Soul**, **Claude Opus 5.5**, **Grok 4.7** e **Gemini 4 Argon**. Regra: no máximo duas tentativas por modelo; o autor escolhe a melhor versão e refina as mais bem-sucedidas.
- **Tarefas 1 e 2 (plum, hot dog):** as IAs receberam um **JSON já preparado pelo autor** — fatiamento, ossos e rig dele; animação removida e descrita em texto. Ou seja, a IA **só anima sobre rig pronto**. Tempos relatados: plum — Soul 4 min, Grok ~10, Gemini ~20, Claude ~10; hot dog — Soul/Grok 5 min, Gemini 35–40 (duas gerações), Claude ~10.
- Resultado qualitativo relatado: Claude produziu a versão visualmente mais próxima e, após uma geração corretiva, “quase indistinguível” do trabalho manual — **com a ressalva explícita do autor**: “a ideia, o rig e a definição da tarefa ainda eram minhas”.
- **Tarefa 3 (harvest basket):** condição mais dura — arquivo **só com camadas, sem ossos** (meshes mantidos). Relato parcial lido: GPT Soul criou **ossos como pontos** (incômodos para editar, toleráveis), pesos ajustados no mesh da cesta permitindo imitar efeito 3D, hierarquia e nomes claros, **keyframes bagunçados**; o modelo seguinte teve keys um pouco melhores mas animação pior e ossos posicionados/vinculados inconvenientemente.
- Observação de negócio do autor: IA “parece muito mais lucrativa à primeira vista”, **especialmente com rigs prontos**, mas “não devemos esquecer refinamento de mesh, limpeza de keys, testes e integração”.

**Lacunas explícitas da transcrição (não lidas, não inferidas):** resultados finais do basket, cactus, wheelbarrow, lizard, chipmunk, **robot (image-to-animation)**, knight, pirate girl, **UI & popups**, **VFX**, **final thoughts** e o capítulo **Cost (25:13)**. Portanto: **os custos do vídeo permanecem desconhecidos** e nenhuma conclusão sobre UI/VFX ou sobre image-to-animation pode ser atribuída ao vídeo nesta revisão.

**Comentários fornecidos:** opiniões de que a animação manual profissional segue superior em timing, expressão, controle e previsibilidade. Tratadas como **opinião de espectadores**, não como evidência técnica — mas coerentes com o relato do próprio autor sobre limpeza de keys e refinamento.

**Leitura arquitetural (o que o vídeo realmente demonstra):** o ganho medido aparece **quando o rig, o fatiamento e a definição da tarefa já existem** e a IA atua como *animador assistido sobre estrutura editável*; a dificuldade aparece **quando a estrutura precisa ser criada** (ossos como pontos, pesos inconvenientes, keys bagunçadas). Isso separa duas capacidades distintas: **animação assistida sobre rig existente** (madura o bastante para avaliação séria) e **rigging automático a partir de imagem** (ainda exige gate humano de refino).

## 2. Spine como referência técnica e comercial (sem adoção automática)

| Aspecto | Evidência primária |
|---|---|
| Editor | **Comercial, fechado.** Licença por tipos (acordo de 2025-04-05): **Professional/Essential** = usuário nomeado único, código de ativação, máx. 2 computadores (um em uso por vez), **condicionado a receita/financiamento agregado < US$ 500 mil nos últimos 12 meses** (ultrapassar termina o acordo e exige Enterprise); **Enterprise** = usuários provisionados, renovação anual, inclui afiliadas; **Education** = instituições acreditadas, **materiais produzidos não podem ter uso comercial**; **Trial** = gratuito, **apenas teste/avaliação** |
| Runtimes | `EsotericSoftware/spine-runtimes` (★5.361, push 2026-11-10, SPDX `NOASSERTION`): **Spine Runtimes License Agreement** — integração/obras derivadas permitidas sob a Seção 2 do acordo do editor; caso contrário, permitida **desde que cada usuário do Produto obtenha sua própria licença do Spine Editor** e a redistribuição inclua licença e copyright |
| Runtimes oficiais | spine-c, spine-cpp, spine-csharp, spine-ts, spine-android, spine-ios, spine-flutter, spine-glfw, spine-haxe, spine-libgdx, spine-monogame, spine-sdl, spine-sfml, **spine-godot**, **spine-unity**, **spine-ue** |
| CLI/automação | **Não evidenciada** na árvore de topo do repositório (sem diretório de CLI) → `UNKNOWN`; automação real depende do editor licenciado ou de terceiros |
| Formatos | esqueleto + atlas (JSON/binário) consumidos pelos runtimes; exportações de terceiros citadas nesta pesquisa geram `skeleton.json` + `atlas.atlas`/`atlas.png` |
| Conclusão para a Forge | Spine é **referência de formato e de modelo de dados** (bones/slots/skins/attachments/meshes/FFD), **não** dependência: a licença do runtime exige licença de editor **por usuário**, o que conflita com “Forge sem dependências obrigatórias” e com custo previsível |

## 3. Alternativas verificadas

| Opção | Licença (código) | Estado | Edição/estrutura | Integração | Leitura para a Forge |
|---|---|---|---|---|---|
| **Godot nativo** (`Skeleton2D`/`Bone2D`) | **MIT** (engine) | ativo (4.7) | `Skeleton2D` parente de hierarquia de `Bone2D`, guarda rest pose; IK via `SkeletonModificationStack2D` (`execute_modifications`, `set_bone_local_pose_override`); tutorial oficial “2D skeletons” | nativa; `AnimationPlayer`, `SpriteFrames`, `Polygon2D` | **destino e validador** naturale; não tem skins/attachments estilo Spine → modularidade por composição de nós |
| **OpenBone** (`UXCentury/open-bone`) | **MIT** | ativo (push 2026-11-12), **★1** (muito novo) | bones com inherit modes; slots com draw order/tint/blend; **skins** (outfits, attachments por outfit); IK 1/2-bone + transform; **meshes ponderados com FFD, linked meshes e trace-mesh**; timelines ricas; **import .psd** (camadas→slots, grupos→bones); **servidor MCP para agentes** | própria + MCP | **clean-room declarado**: não deriva dos runtimes/editor da Esoteric (licença paga) nem do editor Rive → candidato open-source mais completo, porém imaturo |
| **DragonBones** (`DragonBonesJS`) | **MIT** (runtime) | **dormante** (push 2026-01-23); editor sem repositório público | runtime TS/JS | Unity/Godot via comunidade | referência histórica; risco de manutenção |
| **Rive** (`rive-app/rive-runtime`) | **MIT** (runtime) | ativo | runtime C++/renderer; state machines | multiplataforma | editor comercial/SaaS não verificado aqui → custo `UNKNOWN` |
| **Aseprite** | SPDX `NONE` (source-available, licença própria) | ativo (★40,9 mil) | editor de sprites/frames, **não esquelético** | exporta spritesheets | complemento de pixel art, não substituto de rig |
| **OpenToonz / Synfig** | `NOASSERTION` / **GPL-3.0** | ativos | animação 2D tradicional/cut-out | export variado | pesados para pipeline automático; GPL exige cuidado |
| **Live2D Cubism** | SDK proprietário (samples `NOASSERTION`) | ativo | modelo 2.5D por partes + parâmetros | runtimes próprios | alvo natural do `see-through`; licença comercial própria |
| **Stretchy Studio** | reivindicada **MIT** no site | **repositório não localizado** nesta consulta | auto-rig de PSD “see-through” (DWPose ou heurística) + mesh deformation | web | reivindicações **não verificadas** → `UNKNOWN` até fonte primária |

## 4. IA para rigging, separação e animação 2D

| Candidato | Licença | Maturidade | O que faz de fato | Classe |
|---|---|---|---|---|
| [`matbn/2DAutoRigger`](https://github.com/matbn/2DAutoRigger) | SPDX **Other** (README alega core Apache-2.0 — **divergência a resolver**) | **★0**, push 2026-10-23 | imagem → camadas fatiadas + esqueleto dimensionado pelas partes + exports **Godot (`Skeleton2D`+`Polygon2D`), Spine (`skeleton.json`+atlas), Unity (prefab)**; pipeline `ingest→matte→pose→parts ==REFINE GATE==> layers→skeleton→mesh→weights→emit`; modos `cutout/hybrid/mesh` por parte; backends plugáveis: `sam3` (**Meta SAM License, gated**), `birefnet` (MIT), `humanparsing` (MIT), `rtmpose` (Apache-2.0), `lama` (Apache-2.0); edits do gate viram log de strokes/joints (desfazível); **`provenance.json`** por backend | **rigging automático com gate humano** — o desenho mais alinhado à política da Forge (refino antes de fatiar, proveniência por passo) |
| [`GenielabsOpenSource/spine-animation-ai`](https://github.com/GenielabsOpenSource/spine-animation-ai) | **PolyForm Noncommercial 1.0.0** | ★673, push 2026-08-26 | imagens de partes → posicionamento por SIFT/RANSAC → `skeleton.json` Spine → animações de prateleira (idle/walk/run/attack/wave/jump) → preview HTML5 no Spine Web Player | skill de agente; **não comercial** → inutilizável em pipeline comercial da Forge |
| [`shitagaki-lab/see-through`](https://github.com/shitagaki-lab/see-through) | **Apache-2.0** (código) | ★5.642, push 2026-10-05; SIGGRAPH 2026 | 1 ilustração anime → **até 23 camadas RGBA totalmente inpaintadas**, semanticamente distintas, com ordem de desenho → **PSD em camadas**; modelos LayerDiff 3D (SDXL), Marigold depth (anime), SAM body parsing (19 partes); CLI `inference_psd.py`; estratificação por profundidade/esquerda-direita; sugestões low-VRAM (group offload, NF4) | **separação + reconstrução de regiões ocultas** — a etapa 2–4 do fluxo A; **supervisão de treino bootstrapped de modelos Live2D comerciais** = questão de proveniência do *dataset*, não do código |
| [`stimQQ/awesome-image-to-layer`](https://github.com/stimQQ/awesome-image-to-layer) (lista, CC0) | CC0 | — | aponta **CLD** (separação multi-camada controlável, FLUX-based), **LayerD** (ICCV 2025, pip, SVG+PSD), **RevealLayer** (ICML 2026, RGBA com conteúdo oculto), **sd-forge-layerdiffuse**, **ComfyUI-See-through**, RunDiffusion Image-to-Layers (hospedado), See-through HF Space (poucas execuções grátis/dia) | índice de alternativas por etapa |
| Geração imagem→**vídeo** (classe) | várias | — | produz vídeo/frames **sem estrutura editável** | **auxiliar**, não substituto de rig (regra herdada da T9/T10) |

**Distinções mantidas:** demo ≠ benchmark do autor ≠ execução independente ≠ validação na Forge ≠ validação no hardware-alvo. Nenhum dos candidatos acima foi executado nesta tarefa; `2DAutoRigger` e `OpenBone` têm **estrelagem quase nula** — maturidade é risco declarado, não desqualificação.

## 5. Personagens modulares (mesmo rig, várias roupas/variantes)

| Mecanismo | Onde existe | O que permite |
|---|---|---|
| **Skins + slots + attachments** | Spine (referência), **OpenBone** (skins com override de attachment por outfit, troca ao vivo) | trocar roupa/acessório sem novo rig; animações compartilhadas |
| **Linked meshes** | OpenBone | reusar vértices/triângulos/pesos com outra imagem (mesma manga em todos os outfits) |
| **Hierarquia + rest pose** | Godot `Skeleton2D`/`Bone2D` | compor partes como nós; modularidade por composição, sem skins nativas |
| **Rig template + partes** | `2DAutoRigger` (template por parte com modo de deformação) | gerar rigs consistentes entre variantes do mesmo arquétipo |

**Proposta para a Forge (sem novo contrato e sem módulo novo):** tratar modularidade como **combinação de capacidades existentes** — linhagem de `AssetVersion` + relações entre assets + perfil visual de produção — acrescida de **uma** capacidade nova proposta (`rig2d.compose`, ver [`T11-2D-ANIMATION-WORKFLOWS.md`](T11-2D-ANIMATION-WORKFLOWS.md) §5), cujo “rig template” é **dados de produção versionados**, não entidade de domínio nova. Troca de partes em runtime é responsabilidade do **destino** (engine), não da Forge.

## 6. UI, popups e VFX: tecnologia certa por tipo de asset

| Tipo de asset | Tecnologia apropriada | Por quê |
|---|---|---|
| Personagem/criatura com deformação | **esquelético** (bones + meshes/FFD) | reuso de animações, modularidade, controle de timing |
| Botões, ícones, menus, popups, HUD | **tweens/state machine/AnimationPlayer** (ou Rive-style) | são transições de estado, não deformação; esqueleto seria overkill |
| Explosão, fogo, raio, impacto | **partículas 2D / spritesheet / procedural** | natureza estocástica e aditiva; edição por parâmetro, não por keyframe de osso |
| Objetos rígidos articulados (cat, carrinho) | **cut-out** (sprite por osso) | robusto, nunca rasga; o modo `cutout` do 2DAutoRigger existe exatamente para isso |

O vídeo tem capítulos de UI e VFX, mas a transcrição não os cobre → **lacuna registrada**; a tabela acima é raciocínio de engenharia, não resumo do vídeo.

## 7. Custo e previsibilidade

**Verificado em fonte primária (estrutura de custo, não preços):**
- Spine: editor **por usuário nomeado**, condicionado a teto de receita (Professional/Essential), Enterprise **anual**, Education **sem uso comercial**, Trial **só avaliação**; **runtimes exigem licença de editor por usuário do produto**.
- Open-source gratuitos: Godot (MIT), OpenBone (MIT), DragonBonesJS (MIT), `rive-runtime` (MIT), `see-through` (Apache-2.0 no código), Aseprite (source-available, licença própria).
- Modelos/pesos: `sam3` **gated** (Meta SAM License); `see-through` publica pesos no HF (licença dos pesos a confirmar); `birefnet`/`lama`/`rtmpose`/`humanparsing` abertos.
- **Preços numéricos de Spine, Rive, Live2D, serviços hospedados e APIs: NÃO verificados nesta revisão.** O capítulo **Cost** do vídeo não foi legível → **lacuna explícita**. Nenhuma cifra será citada até consulta às páginas oficiais.

**Previsibilidade (critério de escolha):** uma ferramenta rápida que não permite corrigir uma parte específica é **menos útil** que uma lenta que entrega rig editável. Por isso os candidatos preferidos são os que expõem **gate de refino** (`2DAutoRigger`), **log de edits desfazíveis** e **export editável** (Spine-format/Godot/PSD), e não os que entregam apenas vídeo. **Controle humano e edição manual permanecem requisitos da Forge.**

## 8. Evidência e limitações

- **VALIDATED_EXTERNALLY** (medição/demonstração de terceiro, não da Forge): o comparativo do vídeo (rigs prontos → IA anima); `see-through` (artigo SIGGRAPH 2026 + código + pesos).
- **PARTIAL**: `2DAutoRigger` (README detalhado, mas ★0 e licença divergente); `OpenBone` (feature-set rico, MIT, clean-room, mas ★1); `spine-animation-ai` (★673, porém **noncommercial**).
- **UNKNOWN**: preços numéricos; CLI oficial do Spine; repositório do Stretchy Studio; licença dos pesos do `see-through`; capítulos não lidos do vídeo (UI, VFX, Cost, robot image-to-animation).
- **BLOCKED** para uso comercial: `spine-animation-ai` (PolyForm Noncommercial); Spine runtimes sem licença de editor por usuário; Education/Trial do Spine.
- **Não executado na Forge nem no hardware-alvo:** tudo acima. Nada aqui é `VERIFIED_IN_FORGE`.
