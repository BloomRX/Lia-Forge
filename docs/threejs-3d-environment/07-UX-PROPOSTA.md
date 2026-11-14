# 07 — Proposta de experiência (UX)

> **Status:** `PROPOSTA`. Nenhuma tela foi implementada. A referência visual continua sendo a identidade da Lia Forge (magenta/rosa, preto, branco) e a linguagem de painéis já usada em `src/ForgeStudio.jsx` e `src/App.jsx`.
> **Princípio:** o viewport deve parecer **parte da Lia Forge**, não um aplicativo embutido. Nada de chrome de DCC, nada de menus infinitos, nada de jargão sem explicação.

## 1. Princípios de experiência

1. **Honestidade primeiro.** Se algo não está sendo mostrado de verdade, a interface diz. (Hoje o painel de modelo já faz isso; a regra se mantém.)
2. **Revelação progressiva.** Três modos, não trinta painéis: **Inspecionar** (padrão), **Ajustar**, **Animar**.
3. **Ações explícitas e reversíveis.** Nada é salvo, capturado ou exportado sem botão. Nada altera o arquivo original.
4. **Vocabulário de produto.** “Modelo”, “textura”, “esqueleto”, “animação”, “prévia” — não “node graph”, “UV set 0”, “skin weight buffer” sem tradução.
5. **Densidade controlada.** Painéis colapsáveis, Inspector contextual, zero campos desabilitados sem explicação.
6. **Desempenho é UX.** Render sob demanda, aviso antes de abrir arquivo grande, HUD opcional, modo leve.
7. **Acessibilidade desde o desenho.** Foco visível, atalhos documentados, contraste, não depender só de cor, respeitar `prefers-reduced-motion`.
8. **Sem becos sem saída.** Todo erro tem próximo passo; todo formato não suportado aponta para Blender/exportação.

## 2. Onde o viewport entra no produto

| Entrada | Contexto | O que abre |
|---|---|---|
| Card do asset → **“Inspecionar modelo”** | Asset com `.glb` registrado | Viewport no asset atual, painel de diagnóstico |
| Etapa “Modelo 3D” do workspace (`StageWorkspace`) | Durante produção | Viewport + “abrir no Blender” + “marcar inspeção feita” (decisão humana) |
| Artefato de run (`.glb`) | Pós-execução | Viewport do artefato, com proveniência do run |
| `InputPicker` (modelo escolhido) | Insumo do projeto | Viewport rápido antes de usar no pipeline |
| Comparison Lab (Fase 5) | Comparação | Capturas do viewport como entradas de A/B |

**Fora do escopo:** abrir um arquivo arbitrário do disco sem que ele esteja no projeto. O produto trabalha com projeto; o seletor já copia para `input/` quando o usuário escolhe. O viewport não cria uma porta lateral.

## 3. Layout proposto

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Contexto do asset · mira.glb · 18,4 MB · sha256 9f2c…   [Inspecionar ▾] [⋯]  │
├───────────────┬───────────────────────────────────────────────┬───────────────┤
│ HIERARQUIA    │                   VIEWPORT                    │ INSPECTOR     │
│               │                                               │               │
│ ▾ Armature    │      ┌──────────────────────────────┐         │ Material      │
│   ▾ Hips      │      │                              │         │  Base color ▢ │
│     Spine     │      │        modelo 3D             │         │  Metallic 0.0 │
│ ▸ Body        │      │        (grid + eixos)        │         │  Roughness 0.4│
│ ▸ Hair        │      │                              │         │ Texturas (6)  │
│ ▸ Face        │      └──────────────────────────────┘         │ Transform     │
│               │   [Persp|Orto] [Wire] [Skeleton] [Foco] [HUD] │ Diagnóstico   │
├───────────────┴───────────────────────────────────────────────┴───────────────┤
│ TIMELINE (só no modo Animar): clip ▾  ▶ 0:00 / 0:02.4  velocidade 1.0x        │
├───────────────────────────────────────────────────────────────────────────────┤
│ Status: “Visualização apenas — o arquivo não é alterado.”  12.400 tri · 18 draw │
└───────────────────────────────────────────────────────────────────────────────┘
```

- Painel de hierarquia: **280 px**, colapsável — aparece na **Fase 2**.
- Inspector: **320 px**, abas contextuais (Transform / Material / Texturas / Diagnóstico) — Transform na Fase 2, Material/Texturas na Fase 3.
- Timeline: **96 px**, só quando há animação e o modo é Animar — **Fase 4**.
- Viewport: ocupa o restante; canvas com `aria-label` e fallback textual.
- Na **Fase 1** só existem viewport, toolbar de câmera/wireframe, painel de resumo e diagnóstico: sem hierarquia, sem inspector, sem timeline.

## 4. Modos e disponibilidade por fase

| Modo | Fase | O que já funciona |
|---|---|---|
| **Visualizar** (subconjunto do Inspecionar) | 1 | Órbita, zoom, pan, wireframe, grade, eixos, enquadramento, resumo, diagnóstico |
| **Inspecionar** | 2+ | Visualizar + seleção, hierarquia, foco, inspector somente leitura, esqueleto (Fase 4) |
| **Ajustar** | 2+ | Transformações reversíveis com undo/redo; material só na Fase 3 e se a decisão 47 permitir |
| **Animar** | 4 | Mixer, timeline, scrub, A/B de clipes |

### 4.1 Visualizar / Inspecionar (padrão, seguro)

- Órbita, zoom, pan, foco, wireframe, grade, eixos, esqueleto on/off.
- Seleção por clique (Fase 2); inspector **somente leitura**.
- Diagnóstico sempre visível como resumo (chips com severidade).
- Nenhum gizmo de transformação; nenhuma edição.

### 4.2 Ajustar (quando aprovado)

- Gizmo de mover/rotacionar/escalar **apenas para nós selecionados**.
- Alterações marcadas como “nesta sessão” e agrupadas em “Alterações (3)”.
- Botões: **Desfazer**, **Refazer**, **Resetar sessão**, **Salvar configuração**.
- Troca de material permitida **só** por seleção de material existente ou override de parâmetros; nunca criar shader.
- Faixa amarela persistente: “Estas mudanças não alteram o arquivo .glb.”

### 4.3 Animar (inspeção de clipes)

- Lista de clipes com duração e número de canais.
- Play/pause/stop, loop, velocidade, scrub, frame atual.
- Comparação A/B de dois clipes (Fase 4): tocar alternado ou lado a lado com o mesmo tempo.
- Nenhuma edição de keyframe. Botão “editar no Blender” explícito.

## 5. Fluxos principais

> Os fluxos abaixo descrevem o produto completo. Na Fase 1, os passos de seleção/overrides/captura não existem e a UI diz “visualização apenas”. Cada fluxo indica a fase em que passa a valer.

### 5.1 Primeira inspeção de um modelo (Fase 1)

1. Usuário abre o asset → clica **Inspecionar modelo**.
2. Se o arquivo é grande: diálogo “Este modelo tem 92 MB. Abrir em modo completo? [Abrir] [Modo leve] [Cancelar]”.
3. Viewport carrega com progresso real: “lendo 40%… interpretando… texturas 3/6”.
4. Ao terminar: enquadramento automático, resumo “3 meshes · 12.400 triângulos · 4 materiais · 2 animações”.
5. Diagnóstico mostra até 3 observações mais relevantes com “ver todas”.

### 5.2 Salvar uma configuração de inspeção (Fase 2)

1. Ajusta câmera, oculta o cabelo e muda a transformação de apresentação (material só na Fase 3, se a decisão 47 permitir).
2. Clica **Salvar configuração**.
3. Diálogo: “Salvar apenas a visualização? O arquivo .glb não será alterado.” [Salvar] [Cancelar]
4. Grava `View3DOverrides` em `.lia-forge/view3d/`; mostra caminho relativo e hash da fonte.
5. Na próxima abertura: “Existe uma configuração salva desta versão. Aplicar? [Aplicar] [Ignorar]”.

### 5.3 Registrar uma prévia como versão (captura na Fase 2; registro na Fase 5)

1. Clica **Capturar prévia** → PNG 1024×1024 (padrão), fundo transparente ou neutro.
2. A prévia aparece no painel com hash e tamanho.
3. Clica **Registrar como versão** → escolhe o asset → grava via API existente.
4. Confirmação: “Versão v3 registrada com a prévia; o modelo original permanece intocado.”

### 5.4 Formato não suportado (Fase 1)

1. Usuário tenta abrir `.fbx`/`.blend`/`.obj`.
2. Mensagem: “A Lia Forge ainda não desenha .fbx neste viewport. Você pode: (a) converter para .glb no Blender; (b) abrir o arquivo no Blender; (c) ver o relatório estrutural existente.”
3. Nenhum botão finge que abriu.

### 5.5 Arquivo em software rendering (Fase 1)

1. Probe detecta SwiftShader/llvmpipe.
2. Banner: “A renderização está sem aceleração de GPU. O modelo pode ficar lento e as cores não são confiáveis para revisão. [Entendi] [Ver diagnóstico]”.
3. Pós-processamento e sombras desabilitados automaticamente.

## 6. Microcopy (pt-BR)

| Situação | Texto |
|---|---|
| Faixa de modo | “Visualização apenas — o arquivo não é alterado.” |
| Overrides | “Configuração salva para esta versão do modelo. Nada foi alterado no .glb.” |
| Fonte mudou | “O arquivo mudou desde que esta configuração foi salva. Aplicar mesmo assim não é possível — salve uma nova configuração.” |
| Arquivo grande | “Abrir {n} MB pode usar bastante memória. Fechar o Blender ou um jogo antes ajuda.” |
| Sem GPU | “Sem aceleração de GPU: a prévia não representa cor/desempenho reais.” |
| Captura | “Prévia capturada (PNG {w}×{h}). Ainda não é uma versão do asset.” |
| Versão | “Versão {v} registrada. O arquivo original continua igual.” |
| Erro de parse | “Não foi possível interpretar este .glb: {motivo curto}. O relatório estrutural pode indicar o problema.” |
| Diagnóstico | “Observação, não aprovação. A decisão de qualidade é sua.” |
| Fechar | “Fechar a visualização? Configurações não salvas serão perdidas.” |

## 7. Acessibilidade

- **Foco:** o canvas recebe foco por clique/Tab e exibe contorno; atalhos só ativos quando focado.
- **Atalhos:** `1/3/7` vistas, `P` perspectiva/orto e `W` wireframe desde a Fase 1; `F` foco e `Esc` desselecionar a partir da Fase 2; `Espaço` play/pause na Fase 4; `Del` nunca deleta nada.
- **Leitor de tela:** hierarquia é uma `tree` com `aria-expanded`/`aria-selected`; inspector é `form` somente leitura com rótulos; status em `aria-live="polite"`.
- **Sem dependência de cor:** severidade tem ícone + texto (“alta”, “média”, “baixa”), não só vermelho/amarelo.
- **Contraste e tipografia:** seguir a regra já registrada no produto (rótulos ≥ 9 px; instruções prioritárias ≥ 10 px; contraste alto).
- **Movimento:** respeitar `prefers-reduced-motion` (sem auto-rotate, sem animação de câmera, sem transições longas).
- **Alternativa textual:** painel “Resumo” com as mesmas informações do relatório para quem não usa o canvas.

## 8. Estados e feedback

| Estado | UI | Nunca |
|---|---|---|
| Carregando | Barra + etapa + cancelar | Barra falsa/indeterminada sem etapa |
| Vazio | “Nenhum modelo registrado neste asset” + ação | Canvas preto sem explicação |
| Erro | Código curto + motivo + próximos passos | “Algo deu errado” genérico |
| Grande | Aviso e opção de modo leve | Abrir sem avisar |
| Sem GPU | Banner + HUD | Fingir desempenho |
| Seleção | Destaque + inspector preenchido | Selecionar invisível |
| Animação | Timeline ativa, botão pausar | Rodar sem parar |
| Sessão salva | Chip “configuração salva” com data | Aplicar sem perguntar |
| Contexto perdido | “Reconectando visualização…” | Tela congelada silenciosa |

## 9. O que evitar (anti-padrões)

- **Barra de menus de DCC** (File/Edit/Mesh/…) — não é o produto.
- **Inspector com 40 campos numéricos** — agrupar e esconder avançado.
- **Gizmo sempre visível** — só no modo Ajustar e com seleção.
- **Destaque por bloom exagerado** — atrapalha julgar material.
- **Auto-play de animação ao abrir** — surpresa e custo.
- **Aplicar overrides automaticamente** — quebra confiança.
- **“Salvar” ambíguo** — dizer exatamente o que é salvo (configuração? captura? versão?).
- **Ícone sem rótulo** em ações destrutivas ou de gravação.

## 10. Integração com a jornada existente

A jornada de 12 passos (`shared/ui/journey.mjs`) deriva o estado real do projeto. Proposta para a **Fase 5**:

- O passo “Modelo 3D” ganha evidência **“modelo inspecionado visualmente”** apenas quando houver `View3DSession` registrada com o `sha256` atual.
- A evidência é **declarada como humana**, não inferida de “abriu o canvas”.
- O passo continua não promovendo o asset a aprovado; aprovação é outro gate.

Isso não altera o contrato atual da jornada nesta missão; fica como proposta para quando o viewport existir.

## 11. Critérios de UX por fase

**Fase 1**

1. Um usuário que nunca usou Blender consegue abrir um GLB, girar, dar zoom, enquadrar e ler o diagnóstico sem instrução externa.
2. Nenhuma ação grava no disco; não existe botão de salvar.
3. Em 3 cliques ou menos, o usuário fecha o viewport e volta ao asset.
4. Em tela de 1366×768, o viewport não é esmagado por painéis.
5. Todos os estados de erro têm próximo passo.
6. Teclado cobre vistas, perspectiva/orto, wireframe e fechamento.

**Fase 2:** seleção clara, hierarquia navegável por teclado, inspector somente leitura, undo/redo óbvio, “salvar configuração” sem ambiguidade.

**Fase 3:** material identificável por peça, pipeline de cor declarado, prévia de textura sem prometer fidelidade.

**Fase 4:** timeline legível, A/B de clipes no mesmo tempo, aviso de que não é editor.

**Fase 5:** evidência humana na jornada, captura/registro explícitos, “abrir no Blender” sem controlar o Blender.
