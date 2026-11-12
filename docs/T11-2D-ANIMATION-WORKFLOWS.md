# T11 — Fluxos candidatos de animação 2D e integração arquitetural

> **Estado:** `PROPOSED`. **Nada implementado, nenhum provider integrado, nenhum contrato alterado.** Pesquisa-base: [`T11-2D-SKELETAL-ANIMATION-AND-AI-RESEARCH.md`](T11-2D-SKELETAL-ANIMATION-AND-AI-RESEARCH.md) e [`T11-2D-ANIMATION-TOOLS-MATRIX.md`](T11-2D-ANIMATION-TOOLS-MATRIX.md).
> **Regras mantidas:** Orchestrator planeja **capacidades**; Provider Hub seleciona **providers/adapters**; Workflow Engine **executa e coordena**; QA valida; **aprovação humana separada**; **Execution Backend é dimensão de execução**, não um segundo orquestrador. **Não criar módulo chamado Spine, AI Animation ou 2D Studio.** **Não duplicar contratos** de personagem, animação, spritesheet ou exportação. **Não aprovar a alternativa A de identidade compartilhada** sem decisão humana.

## Fluxo A — personagem 2D esquelético (imagem → rig → animação → export)

- **Capacidades necessárias:** `image2d.decompose-layers` (nova, proposta), `rig2d.build` (nova, proposta), `rig2d.animate-assisted` (nova, proposta), `render.spritesheet` (**existente**), `asset.export-for-target` (**existente**), QA técnica/visual (**existente**).
- **Etapas:** 1 imagem-base (gerada ou importada, com proveniência) → 2 separação em partes/camadas com **inpaint das regiões ocultas** → 3 revisão humana das máscaras (**gate**) → 4 esqueleto + hierarquia + pesos/meshes → 5 revisão/ajuste de juntas (**gate**) → 6 animações (idle/walk/run/attack/hit) assistidas ou manuais → 7 limpeza de keys e timing (**manual**) → 8 QA → 9 export por destino.
- **Providers candidatos:** separação = `see-through` (Apache-2.0; pesos a confirmar), CLD/LayerD/RevealLayer (índice awesome-image-to-layer); rig = `2DAutoRigger` (licença divergente; **REFINE GATE**), OpenBone (MIT, manual/agentes via MCP), manual no Godot; animação assistida = agente sobre formato editável (método do vídeo), OpenBone MCP; spritesheet = **renderer Blender já existente**.
- **Backend possível:** separação/rig/anim = **local CPU/GPU** (see-through tem sugestões low-VRAM) ou remoto para GPU pesada; spritesheet = **local** (Blender). Nenhum hosted obrigatório.
- **Entradas/saídas:** entra imagem + intenções; saem **camadas PSD/PNG**, `rig` editável (json/`.tscn`/Spine-format), animações, **spritesheet 384×144 quando o destino pedir** (contrato atual preservado), manifesto de proveniência por passo.
- **Dependências:** pesos gated (sam3) evitáveis escolhendo backends abertos (birefnet/humanparsing/rtmpose/lama); Blender para spritesheet.
- **Licenças:** código Apache-2.0/MIT nos candidatos principais; **evitar** `spine-animation-ai` (noncommercial) e Spine como dependência (licença por usuário); outputs do usuário.
- **Memória/GPU:** see-through = GPU recomendada com offload/NF4 possíveis; rig/anim = CPU; spritesheet = o já conhecido do renderer Blender. **Nada verificado no alvo** → `UNKNOWN`.
- **Etapas manuais obrigatórias:** gate de máscaras, gate de juntas, limpeza de keys/timing, aprovação visual.
- **QA:** integridade de camadas (alpha, ordem), rig sem ossos órfãos, animações com loops fechados, **validação estrutural do spritesheet existente**, inspeção visual humana.
- **Riscos/limitações:** ossos “como pontos” e keys bagunçadas (relato do vídeo na tarefa 3); inpaint pode inventar geometria oculta (declarar como conteúdo reconstruído); maturidade ★0/★1 dos candidatos de rig.

## Fluxo B — personagem modular (mesmo rig, várias roupas/variantes)

- **Capacidades:** `rig2d.compose` (nova, proposta) + todas as do Fluxo A exceto decomposição repetida.
- **Etapas:** rig-template canônico por arquétipo → base + partes (roupa, cabelo, chapéu, arma) como **attachments/skins** → variantes por skin → animações **compartilhadas** → export por destino.
- **Providers:** OpenBone (skins + linked meshes), Spine-format como **formato de intercâmbio** (não como dependência), Godot por composição de nós.
- **Backend:** local. **Entradas/saídas:** rig-template + catálogo de partes → skins/variantes + animações únicas reusadas.
- **Dependências/Licenças:** MIT/Apache-2.0; nenhuma licença por usuário.
- **Memória/GPU:** leve. **Manuais:** definição do template e compatibilidade entre peças.
- **QA:** mesma animação aplicada a ≥2 variantes sem quebra; draw order correto; sem duplicação de rig por roupa.
- **Riscos:** incompatibilidade de proporções entre partes; troca em runtime é papel do **destino**, não da Forge.

## Fluxo C — animação assistida por IA sobre rig existente

- **Capacidades:** `rig2d.animate-assisted` (nova, proposta) + QA.
- **Etapas:** rig pronto + descrição textual da ação → geração de keyframes → **comparação com referência/original** → gerações corretivas (≤2, como no método do vídeo) → **limpeza manual de keys** → QA → export.
- **Providers:** agente hospedeiro editando formato editável (OpenBone MCP; Spine-json via ferramenta própria futura); **não** vídeo-gen.
- **Backend:** hosted para o modelo; **local** para edição/limpeza/export. **Entradas/saídas:** rig + prompt → keyframes editáveis + log de gerações.
- **Licenças:** termos do modelo por chamada (a verificar); outputs do usuário.
- **Memória/GPU:** irrelevante localmente. **Manuais:** limpeza de keys e timing (o ponto fraco relatado no vídeo).
- **QA:** contagem/organização de keys, loops, comparação visual com a referência.
- **Riscos:** “timeline bagunçada” (relato); depender de modelo hosted para etapa central → manter fallback manual.

## Fluxo D — spritesheet a partir de rig/personagem

- **Capacidades:** **`render.spritesheet` e validadores existentes** — **não duplicar**.
- **Etapas:** rig/personagem (2D ou 3D) → poses/frames → atlas → **validação estrutural existente** → (lacuna: validação de conteúdo, ver T10 §8.1) → export.
- **Providers:** renderer Blender existente (3D→2D); para rig 2D, render por engine/editor (Godot headless ou OpenBone) como **adapter futuro**, sem novo contrato.
- **Backend:** local. **Contrato preservado:** 384×144, grade 8×3, 24 frames, células 48×48, idle/walk/run quando presentes.
- **QA/risco:** o validador de produção **aceita atlas transparente** (lacuna T10) → qualquer fluxo D herda esse risco até a checagem de conteúdo existir.

## Fluxo E — UI, popups e VFX

- **Capacidades propostas:** `ui2d.animate` (tweens/state-machine) e `vfx2d.generate` (partículas/spritesheets procedurais) — **não esquelético**.
- **Etapas:** conceito → escolha de tecnologia por tipo (tabela §6 da pesquisa) → animação/geração → QA → export por destino.
- **Providers:** Godot (GPUParticles2D, AnimationPlayer, tweens), Rive-style state machines (OpenBone), spritesheets do Fluxo D.
- **Backend:** local. **Manuais:** direção de arte e parâmetros. **QA:** estados alcançáveis, loops de partícula, ausência de flicker.
- **Riscos:** forçar esqueleto onde partículas/tweens bastam; capítulos de UI/VFX do vídeo são **lacuna** (transcrição não lida).

## 5. Capacidades novas propostas (com justificativa) e o que **não** muda

| Capacidade proposta | Por que não existe hoje | Por que não é módulo novo |
|---|---|---|
| `image2d.decompose-layers` | nenhuma etapa de separação/inpaint no catálogo | é um **provider-step** dentro do Workflow Engine, como qualquer rota |
| `rig2d.build` | rig 2D ausente (só 3D/auto-rig 3D planejado) | idem; reusa proveniência e gate de aprovação existentes |
| `rig2d.animate-assisted` | animação assistida por IA ausente | idem; o “modelo” é provider substituível |
| `rig2d.compose` | modularidade 2D ausente | dados de produção versionados (linhagem/relações existentes), não entidade de domínio |
| `ui2d.animate` / `vfx2d.generate` | UI/VFX ausentes | mapeiam para export/QA existentes com tecnologia adequada por tipo |

**Não mudam:** contratos de personagem/animacao/spritesheet/export; o renderer e seu contrato 384×144; a fronteira Studio×Forge; a dimensão Execution Backend; o princípio de que destinos não são módulos de geração. **Nenhuma** dessas capacidades é aprovada aqui: todas entram como **proposta** em [`T9-REQUIREMENTS-TRACEABILITY.md`](T9-REQUIREMENTS-TRACEABILITY.md) bloco L, aguardando decisão humana.
