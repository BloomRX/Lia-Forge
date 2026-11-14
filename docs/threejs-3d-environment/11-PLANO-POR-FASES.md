# 11 — Plano de implementação incremental

> **Status:** `PROPOSTA`. Nenhuma fase está autorizada e nenhuma linha de produção foi escrita.
> **Ordem das fases:** segue a ordem definida na revisão final de 2026-11-13 — **1) viewport e visualização; 2) seleção, hierarquia e transformações; 3) materiais e texturas; 4) personagens, esqueletos e animações; 5) workflows, Blender Bridge e QA.** A Fase 0 é preparação e não entrega produto.
> **Regra de fase:** uma fase só começa quando (a) os gates da anterior estão cumpridos, (b) as decisões humanas relevantes de [`12`](12-RISCOS-DEPENDENCIAS-DECISOES.md) foram respondidas e (c) a frente T13 não depende do mesmo arquivo. Nenhuma fase altera o GLB original, nenhuma cria segundo aplicativo e nenhuma substitui o Blender.

## Por que esta ordem (e o que mudou)

A ordem anterior desta pasta colocava seleção/hierarquia na Fase 1, materiais e edição na Fase 2, rig/animação na Fase 3 e integração na Fase 4. A revisão final alinhou o plano à ordem solicitada, com três consequências técnicas deliberadas:

| Mudança | Motivo técnico | Efeito |
|---|---|---|
| Fase 1 passa a ser **somente visualização** (sem picking/hierarquia) | Reduz a superfície da primeira fatia e permite provar carregamento, memória, transporte e descarte antes de adicionar interação | Fase 1 menor e mais fácil de aceitar |
| Seleção, hierarquia e transformação vão para a **Fase 2** | Picking e `TransformControls` exigem cena estável, IDs estáveis e política de undo; são a base para inspecionar material por peça | Fase 2 vira a “camada de interação” |
| Materiais/texturas vão para a **Fase 3** | A inspeção de material é mais útil quando já se seleciona a peça; e a troca de material é override (depende da decisão 47) | Fase 3 é leitura primeiro, edição só se aprovada |
| Personagens/esqueleletos/animações vão para a **Fase 4** | Dependem de hierarquia (Fase 2) e de bounds/pose corretos; animação mexe em culling e raycast | Fase 4 é a mais sensível a desempenho |
| Integração (workflows, Blender, QA, export, comparação) vai para a **Fase 5** | Depende de sessão estável, contratos e de outros contratos ainda não aprovados (`ProjectVisualProfile`, `StyleLock`, `ChangeImpactReport`) | Nada de integração prematura com contrato inexistente |
| Recursos avançados deixam de ser “Fase 5” e passam a **pós-fase 5, não comprometidos** | Cabelo, partículas, splats, colisores e path tracing não são necessários para inspeção | Evita promessa de escopo |

A ordem é incremental e reversível: cada fase entrega uma capacidade que funciona sozinha e pode ser interrompida sem deixar dívida de contrato.

---

## Fase 0 — Decisões e preparação (sem produto)

**Objetivo:** transformar a especificação em decisões e critérios verificáveis, sem canvas e sem dependência.

| Entregável | Detalhe |
|---|---|
| Decisões 45–57 respondidas | [`../DECISIONS-AND-OPEN-QUESTIONS.md`](../DECISIONS-AND-OPEN-QUESTIONS.md), detalhadas em [`12`](12-RISCOS-DEPENDENCIAS-DECISOES.md) |
| Contratos `View3DSession`/`View3DOverrides`/`View3DSessionReport` aprovados ou rejeitados | Schema, fixtures e testes puros propostos em [`06`](06-CONTRATOS-E-INTEGRACAO.md) |
| Política de dependência gráfica | Versão exata do Three.js, notices, atualização, licença dos decoders |
| Política de segurança | CSP em report-only primeiro, protocolo, tokens, limites, allowlist |
| Fixtures sintéticas F1/F3/F4/F5 | Sem baixar modelos; estender `tests/glb-fixtures.mjs` |
| Critério de evidência | O que conta como medido (Windows + RX 580 + app real) |
| Plano de teste em Chromium real | Repositório hoje só tem SSR/Node; precisa de teste de canvas |

**Fora de escopo:** qualquer canvas, dependência, canal IPC ou rota nova.
**Esforço (hipótese):** S–M.
**Gate de saída:** decisões registradas, contratos aprovados/rejeitados, fixtures prontas, nenhuma ambiguidade sobre o que é “Fase 1”.

---

## Fase 1 — Viewport e visualização GLB/glTF

**Objetivo:** abrir um modelo do projeto e **vê-lo de verdade**, com segurança, memória controlada e diagnóstico honesto — sem edição e sem interação de seleção.

### Escopo

1. `three` fixo (`0.187.0`), carregado por `import()` dinâmico; chunk separado do bundle base.
2. `View3DService` no main: resolução de referência, hash, token, protocolo, limites, `close`.
3. Transporte único de bytes (IPC e HTTP same-origin) com `Range`, `AbortController` e progresso real.
4. Viewport WebGL2: câmera orbital, zoom/pan, perspectiva ↔ ortográfica, grade, eixos, wireframe, enquadramento automático.
5. Render sob demanda (sem loop eterno), com pausa em background.
6. `SceneIndex` interno mínimo: nós, contagens, materiais (nomes), skins (contagem), clips (nomes/duração), bounds — dados serializáveis, sem expor objetos Three.js ao React.
7. Diagnóstico declarado × medido (sem normais, sem UV, extensão desconhecida, escala suspeita, draw calls).
8. Telemetria: backend real, software rendering, fps, draw calls, triângulos, geometrias/texturas.
9. Ciclo de vida: `dispose` completo, `forceContextLoss`, cancelamento, recuperação de contexto.
10. UI: modo **Visualizar** (órbita + painel de resumo + diagnóstico); sem painel de hierarquia e sem inspector de seleção.
11. Estados honestos: arquivo grande, formato não suportado, erro de parse, GPU ausente/software, contexto perdido.

### Importação aceita nesta fase

| Formato | Fase 1 | Observação |
|---|---|---|
| `.glb` | **Sim** | Recursos embutidos; formato central |
| `.gltf` **autocontido** (recursos em `data:`) | **Sim** | Mesmo caminho de parse; sem I/O externo |
| `.gltf` com `.bin`/texturas externas | Não (Fase 5) | Exige allowlist de irmãos e protocolo; decisão 51 |
| FBX/OBJ/STL/BLEND/VRM/SPZ | Não | Converter/abrir no Blender, com mensagem de próximo passo |

### Fora de escopo

Seleção, hierarquia navegável, transformações, materiais detalhados, animação, overrides, captura, exportação, WebGPU, integração com workflows.

### Critérios de aceite

| # | Critério | Como provar |
|---|---|---|
| 1 | Abre F1 e F2 e enquadra a cena automaticamente | Teste em Chromium real + verificação manual |
| 2 | F2 (personagem) a 60 fps em 1080p/DPR 1 na RX 580 | Medição em Windows com HUD |
| 3 | 10 ciclos abrir/fechar sem crescimento de recursos | `renderer.info.memory` + `app.getAppMetrics` |
| 4 | Nenhum arquivo do projeto é alterado | SHA-256 antes/depois |
| 5 | Recusa caminho fora do projeto, symlink, arquivo > teto, formato inválido e `.gltf` externo | Testes negativos em cada canal |
| 6 | Nenhum caminho absoluto chega ao renderer | Inspeção de payload + teste |
| 7 | Render para quando ocioso | Contador de frames |
| 8 | Perda de contexto recupera ou informa de forma acionável | Teste provocado com `forceContextLoss()` |
| 9 | Bundle base não cresce; chunk só carrega ao abrir | Build comparado |
| 10 | UI mantém “visualização apenas — o arquivo não é alterado” | Revisão de UX |

**Esforço (hipótese):** M–L (1 pessoa, 3–6 semanas, com testes e revisão).
**Riscos dominantes:** memória/VRAM, CSP e decoders, perda de contexto, ausência de teste de canvas no repositório.

---

## Fase 2 — Seleção, hierarquia e transformações

**Objetivo:** permitir navegar pela estrutura do modelo, selecionar partes e fazer **ajustes reversíveis de apresentação** — nunca editar o arquivo.

### Escopo

1. Picking por clique com `Raycaster`; hover opcional com throttle; destaque leve (sem pós-processamento por padrão).
2. Hierarquia de cena navegável com **IDs estáveis gerados pela Lia** (nomes podem ser vazios/duplicados).
3. Foco no selecionado; isolamento temporário; visibilidade liga/desliga.
4. Inspector somente leitura de transform/bounds/contagens do nó.
5. `TransformControls` (`getHelper()` na cena) para mover/rotacionar/escalar **nós selecionados**, atrás do modo **Ajustar**.
6. Undo/redo e “Resetar sessão”; overrides de sessão em memória.
7. Salvar `View3DOverrides` em `.lia-forge/view3d/` com `sourceSha256`, escrita atômica e confirmação; estado `stale` quando o arquivo muda.
8. Captura PNG de prévia como ação explícita (sem registrar versão ainda).
9. Aviso permanente de que transformações e visibilidade **não alteram o `.glb`**.

### Fora de escopo

Edição de hierarquia (reparent/rename), edição de geometria/UV/rig, troca ou edição de material, animação, exportação, integração com versionamento.

### Critérios de aceite

1. Selecionar mesh/bone correto em modelo estático e em `SkinnedMesh` (considerando que bounds de skinning são cacheados — ver [`03`](03-PESQUISA-TECNICA-THREEJS.md) §9).
2. Hierarquia estável entre reaberturas (mesmos IDs para o mesmo conteúdo).
3. Undo/redo cobre 50 operações sem corromper estado; reset volta à cena do arquivo.
4. Transformar não altera o GLB (hash antes/depois) e não altera o override de outros nós.
5. Overrides sobrevivem a fechar/reabrir; aplicação só após confirmação; `sourceSha256` divergente ⇒ recusa.
6. Captura PNG passa em `png-structural`; nenhuma versão é criada automaticamente.
7. Nenhum caminho absoluto em payload; testes negativos continuam passando.

**Esforço (hipótese):** M–L (3–5 semanas).
**Riscos:** contrato de edição ambíguo, gizmo em personagem animado, expectativa de “salvar o modelo”, UX de overrides.

---

## Fase 3 — Materiais e texturas

**Objetivo:** inspecionar o PBR real do arquivo e explicar por que a aparência é o que é — com edição de material **somente se a decisão 47 autorizar**.

### Escopo

1. Lista de materiais por nó e por cena; mapeamento glTF → `MeshStandardMaterial`/`MeshPhysicalMaterial`.
2. Inspeção de canais: base color, metallic, roughness, normal, emissive, alpha/opacity, double-sided; extensões `KHR_materials_*` presentes.
3. Texturas: prévia, resolução, formato, `colorSpace`, `channel` (UV set), estimativa de VRAM (aritmética declarada).
4. UVs: visualização do canal usado, sem edição; deixar claro que topologia semântica (quads/loops/seams) não existe em glTF.
5. Ambiente de inspeção (`RoomEnvironment` + `PMREMGenerator`) e fundo neutro; **pipeline de cor declarado** (`outputColorSpace`, tone mapping, exposição).
6. Diagnóstico de material: textura ausente, UV ausente com material texturizado, resolução acima do orçamento, alpha suspeito.
7. KTX2/Basis: inspeção quando o decoder estiver disponível; mensagem específica quando não.
8. Override de material (parâmetros e seleção de material existente) **somente** com decisão 47 = A; nunca criar shader.

### Fora de escopo

Pintura/edição de textura, bake, criação de shader, troca de textura por arquivo externo, exportação de material.

### Critérios de aceite

1. Inspecionar F2 mostra os mesmos canais e texturas que o relatório declarado (divergências viram observação).
2. Nenhuma textura/material é alterado no arquivo; hash intacto.
3. Estimativa de VRAM bate com a aritmética documentada (dentro da tolerância declarada).
4. Pipeline de cor aparece no relatório de sessão e na proveniência da captura.
5. Fechar a sessão devolve `renderer.info.memory.textures` ao baseline.
6. Sem decisão 47, o modo é **somente leitura** e a UI diz isso.

**Esforço (hipótese):** M (2–4 semanas).
**Riscos:** julgar cor sem pipeline declarado, texturas 4K, falsa sensação de que o viewport “aprova” material.

---

## Fase 4 — Personagens, esqueletos e animações

**Objetivo:** inspecionar rig, skinning e clipes sem virar editor de animação.

### Escopo

1. `SkeletonHelper` (com `dispose()`), lista de bones, seleção de bone, sincronização com a hierarquia.
2. Inspeção de skins: juntas, raiz, `SkinnedMesh` sem skin, juntas sem uso, nomes duplicados.
3. `AnimationMixer` + `AnimationAction`: play/pause/stop, velocidade, loop, scrub, frame atual; `uncache*` no fechamento.
4. Timeline simples com duração real; lista de clipes com canais e alvos.
5. Comparação A/B de clipes na mesma pose/tempo (alternância e/ou lado a lado).
6. Diagnóstico de animação: clipe sem alvo, duração zero, canais faltando, root motion declarado, pose fora dos bounds.
7. Bounds/raycast de personagem animado: recalcular quando necessário; nunca confiar em bound cacheado.

### Fora de escopo

Edição de keyframes/curvas/NLA, retarget, foot sliding, animação facial/lip sync, clipes externos separados do GLB.

### Critérios de aceite

1. Toca os clipes de F2 sem stutter; tempo comparado com a duração declarada dentro de um frame.
2. Scrub não “explode” o mixer nem deixa ações órfãs.
3. Skeleton corresponde à hierarquia do arquivo; bones sem uso aparecem como observação.
4. Comparação A/B usa o mesmo tempo e a mesma pose.
5. Nenhuma escrita em disco além do relatório de sessão.
6. UI explica que não é editor de animação e oferece “editar no Blender”.

**Esforço (hipótese):** M–L (3–5 semanas).
**Riscos:** precisão de tempo, bounds de skinning, expectativa de edição, desempenho com muitos bones.

---

## Fase 5 — Workflows, Blender Bridge e QA

**Objetivo:** conectar o viewport ao que já existe, **sem** substituir Blender, sem promover asset automaticamente e sem criar contrato novo.

### Escopo

1. Passo de workflow que **abre** o viewport para revisão humana; nunca um passo automático de “render”.
2. Evidência de inspeção na jornada de 12 passos, ligada a `sha256` e `sessionId`; declarada como humana.
3. Registro de captura como artefato de versão via `addAssetVersion` (ação explícita).
4. Comparison Lab aceitando capturas do viewport e A/B visual de duas versões do mesmo asset.
5. “Abrir no Blender” contextual (arquivo e pasta), usando o caminho de ferramentas externas existente; sem controlar o Blender.
6. Leitura de `ProjectVisualProfile` **quando existir**: preset de iluminação/cor; nunca escrita.
7. Leitura de `ChangeImpactReport` e `StyleLock` **quando existirem**: mostrar/sugerir; nunca bloquear, aprovar ou calcular linhagem.
8. Exportação GLB derivada explícita, com relatório de diferenças, `glb-structural` e `gltf-validator` opcional; nunca sobrescrever o original.
9. `gltf-transform` como etapa externa opcional de otimização (sem dependência obrigatória).
10. `.gltf` com recursos externos, se a decisão 51 permitir: protocolo com allowlist de irmãos e testes negativos.
11. Exportação para destino continua no fluxo existente (`exportRun` + `checkDestinationCompatibility`), sem atalho pelo viewport.

### Fora de escopo

Escolher renderer padrão (Blender × WebGL), publicar/exportar direto para engine, controlar Blender, Scene Composer/staging, upload/telemetria.

### Critérios de aceite

1. Revisão registrada não promove asset a aprovado; aprovação continua humana.
2. Captura registrada como versão tem hash, validador e vínculo ao `sha256` da fonte.
3. GLB derivado tem diff, hashes e validação; original intacto.
4. Nenhuma integração com contrato não aprovado é obrigatória para o viewport funcionar.
5. “Abrir no Blender” não move, copia ou altera arquivo.
6. `.gltf` externo (se aceito) recusa traversal, symlink e recurso fora da allowlist.
7. Exportação por destino continua usando `exportRun`; nenhum “exportar do viewport” contorna a validação.

**Esforço (hipótese):** L (4–8 semanas).
**Riscos:** acoplamento com contratos não aprovados, expectativa de “exportar direto”, regressão no fluxo de exportação existente.

---

## Pós-fase 5 — Pesquisa não comprometida

Nada abaixo tem fase, prazo ou promessa. Só entra com caso de uso real, orçamento compatível e decisão humana.

| Recurso | Viabilidade | Continua no Blender? |
|---|---|---|
| Cabelo (cards/strands) | Média | Autoria sim |
| Partículas/VFX no viewport | Média | Sim |
| Inspeção de colisores | Baixa (não está no GLB) | Sim |
| Splats/ambientes | Média | Sim |
| Câmera para spritesheet | Alta, **sem** escolher renderer | Render comparado |
| Comparação Blender × WebGL sob rubrica separada | Média | Não é substituição |
| Path tracing no navegador | Baixa | Sim |
| Edição de malha/UV/rig/animação | **Não recomendado** | Sim |

---

## Resumo visual

```
Fase 0  Decisões, contratos, fixtures, segurança      (S–M, sem produto)
Fase 1  Viewport e visualização GLB/glTF              (M–L)  ← prova de valor
Fase 2  Seleção, hierarquia e transformações          (M–L)
Fase 3  Materiais e texturas                          (M)
Fase 4  Personagens, esqueletos e animações           (M–L)
Fase 5  Workflows, Blender Bridge e QA                (L)
Pós-5   Pesquisa (cabelo, splats, path tracing...)     (não comprometido)
```

## Matriz de testes por fase

| Fase | Testes puros (`shared/`) | Integração (HTTP/loopback) | Chromium real | Manual Windows/RX 580 |
|---|---|---|---|---|
| 0 | schema, limites, diagnóstico | — | — | — |
| 1 | resolução/token, limites, diagnóstico | sim (Range, recusas) | sim (abrir/fechar, contexto) | sim (fps/memória) |
| 2 | IDs, overrides/stale, undo | sim (salvar/ler, captura) | sim (picking) | sim |
| 3 | estimativa de VRAM, regras de material | sim (decoders) | sim | sim |
| 4 | relatório de clipes, alvos | sim | sim | sim |
| 5 | diff de exportação, evidência | sim | sim | sim |

**Regra de honestidade:** teste em SSR/Node não prova canvas; Chromium headless com SwiftShader não prova desempenho; screenshot sem número não é evidência. Cada fase reporta separadamente o que rodou em cada ambiente — como a T13 já faz.

## Condições para **não** avançar de fase

- Fase 1 com vazamento de memória em 10 ciclos, CSP quebrada no app empacotado ou qualquer leitura fora do projeto.
- Fase 2 sem undo/redo, com IDs instáveis ou alteração do GLB.
- Fase 3 julgando cor sem pipeline declarado ou sem decisão 47 para edição.
- Fase 4 com tempo/pose incorretos ou mixer vazando ações.
- Fase 5 sem relatório de diferenças na exportação ou promovendo asset automaticamente.
- Qualquer fase que exija reescrever o GLB original, duplicar asset, alterar workflow existente ou criar segunda aplicação.
