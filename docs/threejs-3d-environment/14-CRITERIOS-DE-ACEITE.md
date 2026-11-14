# 14 — Critérios de aceite para a futura implementação

> **Status:** `PROPOSTA`. Este documento **consolida** critérios espalhados em [`06`](06-CONTRATOS-E-INTEGRACAO.md) §11, [`09`](09-HARDWARE-E-DESEMPENHO.md) §10 e [`11`](11-PLANO-POR-FASES.md). Em caso de divergência, vale a regra mais restritiva; a correção deve ser feita nos três.
> **Regra:** critério de aceite não é opinião nem screenshot. Cada item precisa de **evidência reproduzível** e de um ambiente declarado.
> **Princípio:** nenhum critério promove o asset a aprovado, escolhe renderer, autoriza upload ou substitui o Blender.

## 1. Como usar

1. Cada fase tem critérios **obrigatórios** (bloqueiam a fase) e **recomendados** (não bloqueiam).
2. Um critério só é “cumprido” com a evidência listada na coluna correspondente.
3. Evidência em ambiente errado não conta: SSR/Node não prova canvas; Chromium headless com SwiftShader não prova desempenho; screenshot sem número não prova fps.
4. Toda evidência deve registrar: commit, sistema, GPU/driver, backend, tamanho do modelo, versão do Three.js e comando executado.
5. Critério não executado é **`pending`**, nunca “ok”.

## 2. Invariantes globais (valem em todas as fases)

| ID | Invariante | Evidência mínima |
|---|---|---|
| G1 | O arquivo original nunca é alterado | SHA-256 antes/depois de abrir, salvar overrides, capturar e exportar |
| G2 | Nenhum asset é duplicado para visualizar | Inspeção do disco: nenhuma cópia nova em `input/` ou `.lia-forge/` |
| G3 | Nenhum caminho absoluto chega ao renderer nem volta dele | Teste negativo por canal + inspeção de payload |
| G4 | Nenhuma leitura fora do projeto (`input/`, `.lia-forge/runs/`, `.lia-forge/view3d/`) | Testes com `..`, symlink, caminho absoluto, unidade de rede |
| G5 | Nenhuma rede, upload, telemetria ou chamada externa | Inspeção de código + testes com rede bloqueada |
| G6 | Nenhum booleano de aprovação (`passed`, `approved`) em relatório do viewport | Validação de schema + teste |
| G7 | Nenhuma versão de asset criada sem ação explícita | Teste de fluxo + inspeção do store |
| G8 | Nada é salvo sem confirmação e sem escrita atômica | Teste de falha no meio da escrita |
| G9 | Fechar a sessão libera geometrias/texturas | `renderer.info.memory` + `app.getAppMetrics` em 10 ciclos |
| G10 | Limites de tamanho e de memória são aplicados antes do parse | Teste com arquivo acima do teto |
| G11 | O viewport não cria segundo app/janela/launcher | Revisão de arquitetura/UX |
| G12 | Blender continua dono de autoria (malha/UV/rig/animação/bake) | Revisão de escopo + ausência de ferramentas de edição |
| G13 | WebGL2 é o piso; WebGPU não é requisito | Teste em máquina sem WebGPU |
| G14 | Estados de erro têm motivo, código e próximo passo | Revisão de microcopy + testes de erro |

## 3. Fase 1 — viewport e visualização

| ID | Critério | Evidência | Obrigatório |
|---|---|---|---|
| F1-1 | Abre `.glb` de `input/` e de `.lia-forge/runs/` e enquadra automaticamente | Teste em Chromium real + captura com dimensões | Sim |
| F1-2 | Abre `.gltf` autocontido; recusa `.gltf` com recursos externos com próximo passo | Teste positivo/negativo | Sim |
| F1-3 | F2 (personagem) atinge 60 fps em 1080p/DPR 1 na RX 580 | Medição em Windows, 300 frames, média e p95 | Sim |
| F1-4 | 10 ciclos abrir/fechar sem crescimento de recursos | `renderer.info.memory` + `app.getAppMetrics` | Sim |
| F1-5 | Nenhum arquivo do projeto muda | Hash antes/depois | Sim |
| F1-6 | Recusa symlink, path traversal, caminho absoluto e unidade de rede | Testes negativos por canal | Sim |
| F1-7 | Nenhum caminho absoluto em request/response | Inspeção de payload + teste | Sim |
| F1-8 | Render para quando ocioso e pausa em background | Contador de frames | Sim |
| F1-9 | Perda de contexto recupera ou informa de forma acionável | `forceContextLoss()` provocado | Sim |
| F1-10 | Backend real, software rendering e driver aparecem no HUD | Captura do HUD + registro | Sim |
| F1-11 | Bundle base não cresce; chunk do viewport só carrega ao abrir | Build comparado | Sim |
| F1-12 | UI mantém “visualização apenas — o arquivo não é alterado” | Revisão de UX | Sim |
| F1-13 | Diagnóstico declarado × medido não afirma “aprovado” | Relatório de sessão + schema | Sim |
| F1-14 | Formato não suportado (`.fbx`, `.blend`, `.obj`) tem mensagem com próximo passo | Teste manual | Sim |
| F1-15 | WebGL2 indisponível produz mensagem do addon oficial, não tela preta | Teste com GPU desabilitada | Recomendado |
| F1-16 | Abrir arquivo de 80–256 MB **já presente no projeto** mostra aviso e modo leve; a limitação de 32 MB do `saveInput` não é contornada silenciosamente | Teste com fixture F3 + registro da origem do arquivo | Recomendado |

**Não pode ser aceito na Fase 1:** ausência de teste em Chromium real, ausência de teste de 10 ciclos, qualquer escrita no arquivo ou qualquer seleção/edição implementada sem contrato.

## 4. Fase 2 — seleção, hierarquia e transformações

| ID | Critério | Evidência | Obrigatório |
|---|---|---|---|
| F2-1 | Clique seleciona o mesh/bone correto em cena estática e em `SkinnedMesh` | Teste com fixture F2; comparação com hierarquia | Sim |
| F2-2 | Hierarquia usa IDs estáveis gerados pela Lia e sobrevive a reabertura | Teste de reabertura + snapshot | Sim |
| F2-3 | Foco, isolamento e visibilidade são reversíveis | Teste de reset | Sim |
| F2-4 | Transformar com gizmo não altera o GLB | Hash antes/depois | Sim |
| F2-5 | Undo/redo cobre 50 operações sem corromper estado | Teste automatizado | Sim |
| F2-6 | “Resetar sessão” volta ao estado do arquivo | Comparação de transforms/visibilidade | Sim |
| F2-7 | Overrides persistem com `sourceSha256`; hash divergente ⇒ `stale` | Teste de salvar/reabrir/alterar fonte | Sim |
| F2-8 | Overrides não são aplicados sem confirmação | Teste de UX + log | Sim |
| F2-9 | Overrides ≤ 256 KB e validados; JSON inválido não grava | Teste de schema + falha de escrita | Sim |
| F2-10 | Captura PNG só por ação explícita; passa em `png-structural` | Teste + validador | Sim |
| F2-11 | Nenhuma versão de asset é criada na Fase 2 | Inspeção do store | Sim |
| F2-12 | Nenhum campo de geometria/UV/skin/keyframe no contrato | Revisão de schema | Sim |
| F2-13 | Em personagem animado, bounds/raycast são atualizados antes do picking | Teste com animação + clique | Recomendado |

## 5. Fase 3 — materiais e texturas

| ID | Critério | Evidência | Obrigatório |
|---|---|---|---|
| F3-1 | Lista de materiais/canais corresponde ao arquivo (divergência vira observação) | Comparação com `inspectGlb` | Sim |
| F3-2 | Nenhum material/textura do arquivo é alterado | Hash antes/depois + comparação de `material.uuid` | Sim |
| F3-3 | Prévia de textura mostra resolução, formato e canal UV usados | Captura + relatório | Sim |
| F3-4 | Estimativa de VRAM segue a aritmética declarada e rotula “estimativa” | Cálculo reproduzível | Sim |
| F3-5 | Pipeline de cor (`outputColorSpace`, tone mapping, exposição) aparece no relatório e na proveniência da captura | JSON do relatório | Sim |
| F3-6 | Textura 4K acima do orçamento gera observação com ação | Teste com fixture F3 | Sim |
| F3-7 | KTX2 funciona quando o decoder está disponível; falha tem mensagem específica | Teste com fixture F4 | Sim |
| F3-8 | Sem decisão 47, material é somente leitura e a UI diz isso | Revisão de UI + teste | Sim |
| F3-9 | Fechar a sessão devolve `textures` ao baseline | `renderer.info.memory` | Sim |
| F3-10 | Nenhuma edição de UV/pintura/bake disponível | Revisão de UI | Sim |

## 6. Fase 4 — personagens, esqueletos e animações

| ID | Critério | Evidência | Obrigatório |
|---|---|---|---|
| F4-1 | `SkeletonHelper` corresponde à hierarquia do arquivo | Comparação visual + lista de bones | Sim |
| F4-2 | Bones com nome vazio/duplicado não quebram a UI | Fixture adversa | Sim |
| F4-3 | Clipes tocam com duração correta (dentro de um frame) | Comparação com duração declarada | Sim |
| F4-4 | Scrub é preciso e não deixa ações órfãs | Teste de 100 scrubs + `uncache` | Sim |
| F4-5 | Play/pause/stop/velocidade/loop funcionam sem travar | Teste automatizado | Sim |
| F4-6 | Comparação A/B usa o mesmo tempo e a mesma pose | Teste + captura | Sim |
| F4-7 | Diagnóstico de animação (clipe sem alvo, duração zero, root motion) aparece | Fixture adversa | Sim |
| F4-8 | Nenhuma escrita em disco além do relatório de sessão | Inspeção + hash | Sim |
| F4-9 | UI explica que não é editor e oferece “editar no Blender” | Revisão de UX | Sim |
| F4-10 | Personagem animado mantém ≥ 30 fps com skinning na RX 580 | Medição em Windows | Recomendado |

## 7. Fase 5 — workflows, Blender Bridge e QA

| ID | Critério | Evidência | Obrigatório |
|---|---|---|---|
| F5-1 | Passo de workflow abre o viewport, mas não renderiza nem aprova automaticamente | Inspeção do plano + teste | Sim |
| F5-2 | Evidência de inspeção é humana, ligada a `sha256`/`sessionId` | Jornada + relatório | Sim |
| F5-3 | Captura registrada como versão usa `addAssetVersion` com hash e validador | Teste + inspeção do store | Sim |
| F5-4 | Comparison Lab aceita capturas e A/B de duas versões | Teste de fluxo | Sim |
| F5-5 | “Abrir no Blender” não move/copia/altera o arquivo | Hash e inspeção de pasta | Sim |
| F5-6 | Perfil/impacto/style lock são leitura e opcionais; ausência não bloqueia | Teste com contratos ausentes | Sim |
| F5-7 | Export GLB derivado tem relatório de diferenças com hashes | Teste + JSON | Sim |
| F5-8 | Export bloqueia extensões desconhecidas por padrão | Teste com fixture adulterada | Sim |
| F5-9 | Export nunca sobrescreve o original | Hash antes/depois | Sim |
| F5-10 | Export para destino continua via `exportRun`/perfil | Teste de não-regressão | Sim |
| F5-11 | Nenhum contrato não aprovado é obrigatório para o viewport funcionar | Revisão de dependências | Sim |
| F5-12 | `.gltf` externo (se aceito) recusa traversal, symlink e irmão fora da allowlist | Testes negativos | Recomendado |

## 8. Critérios transversais

### 8.1 Segurança

- CSP aplicada em report-only antes de enforce; nenhuma violação no app empacotado.
- `worker-src blob:` e `'wasm-unsafe-eval'` justificados e testados.
- Nenhum `file://`, `webSecurity: false`, `nodeIntegration: true` ou caminho absoluto.
- Nenhum decoder vindo de CDN.
- Protocolo valida `initiatorOrigin`, token, TTL e lista fechada de arquivos.

### 8.2 Desempenho e memória

- Orçamento: 512 MB confortável, 1 GB alerta, 1,2 GB recusa (estimativa, não medição).
- Teto de arquivo 256 MB; classes 20/80/256 MB com comportamento definido.
- Uma sessão ativa; cache ≤ 64 MB; DPR ≤ 1.5 por padrão.
- Render sob demanda; sem pós-processamento/sombras por padrão.
- Nenhum vazamento em 10 ciclos; contexto perdido recuperável.

### 8.3 Acessibilidade e UX

- Canvas focável, atalhos documentados, hierarquia como `tree`, status em `aria-live`.
- Severidade não depende só de cor.
- `prefers-reduced-motion` respeitado.
- Alternativa textual ao canvas (resumo/diagnóstico).

### 8.4 Documentação e proveniência

- Versão do Three.js e backend registrados em toda sessão/captura/export.
- Limitações declaradas (“não é render final”, “estimativa”, “observação”).
- `unknown` onde não medido.

## 9. Definition of Done (por fase)

Uma fase só é considerada concluída quando:

1. Todos os critérios **obrigatórios** têm evidência registrada.
2. Os critérios recomendados não cumpridos estão listados com motivo.
3. Nenhum invariante global foi violado.
4. Testes puros, integração e Chromium real foram executados; o que não foi está `pending`.
5. Medição em Windows/RX 580 foi feita quando o critério for de desempenho.
6. Documentação atualizada (`11`, `14`, `README`) e decisões registradas.
7. Revisão humana aprovou o avanço — nenhuma fase avança por “parece pronto”.

## 10. Matriz de rastreabilidade

| Documento | O que fornece |
|---|---|
| [`01`](01-AUDITORIA-ESTADO-ATUAL.md) | Estado real e lacunas que originam os critérios |
| [`02`](02-INVENTARIO-FUNCIONALIDADES.md) | O que existe e o que é novo |
| [`03`](03-PESQUISA-TECNICA-THREEJS.md) | Fatos de API que sustentam as decisões |
| [`05`](05-ARQUITETURA-PROPOSTA.md) | Módulos, memória, segurança, interface |
| [`06`](06-CONTRATOS-E-INTEGRACAO.md) | Contratos, canais, garantias |
| [`08`](08-MATRIZ-FUNCIONALIDADES-VIABILIDADE.md) | Classificação e fase de cada funcionalidade |
| [`09`](09-HARDWARE-E-DESEMPENHO.md) | Orçamentos e como medir |
| [`10`](10-IMPORTACAO-E-EXPORTACAO.md) | Formatos, perdas e validação |
| [`11`](11-PLANO-POR-FASES.md) | Sequência, escopo e gates |
| [`12`](12-RISCOS-DEPENDENCIAS-DECISOES.md) | Riscos e decisões que condicionam os critérios |
| [`15`](15-ECOSSISTEMA-SKILLS-E-AGENTES.md) | Evidência sobre skills, agentes e ferramentas; licenças e compatibilidade r187 |
| [`16`](16-MATRIZ-SOLUCOES-SKILLS.md) | Classificação recomendada, alternativa, pesquisa e descarte |
| [`17`](17-ROADMAP-INTEGRACAO-SKILLS.md) | Catálogo de skills, fases S0–S6 e critérios de curadoria SC1–SC12 |

**Critérios de curadoria de skills.** A frente complementar **não altera** G1–G14 nem F1-1…F5-12. Ela adiciona os critérios **SC1–SC12** em [`17`](17-ROADMAP-INTEGRACAO-SKILLS.md) §8, que valem apenas para aceitar ou rejeitar uma skill de conhecimento. Nenhum SC promove capability, fase ou implementação; todos exigem evidência e revisão humana. Em particular, uma skill marcada `r186` **não** satisfaz SC2 para o alvo `three@0.187.0` sem verificação e patch.

## 11. O que **não** é critério de aceite

- “Parece bom” em screenshot.
- “Funciona no meu navegador”.
- Build no sandbox sem GPU.
- Relatório estrutural sem render.
- AprovaÇÃO automática por métrica.
- Comparação Blender × WebGL com score único.
- Cobertura de testes sem teste de canvas.
- Redução de escopo escondida (ex.: chamar de “Fase 1” algo que já inclui edição).
