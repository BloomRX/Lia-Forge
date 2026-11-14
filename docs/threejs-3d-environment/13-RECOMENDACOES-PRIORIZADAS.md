# 13 — Recomendações priorizadas

> **Para quem lê só este arquivo:** a Lia Forge **não tem** viewport 3D hoje. O que existe é inspeção estrutural de GLB, validação, versionamento, exportação por destino e uma UI que **diz que não renderiza**. Three.js é adequado para o *desenho*; o trabalho real é **sessão, transporte, memória, limites e integração**. A recomendação central é: **fazer uma fatia pequena e honesta primeiro, provar em hardware real e só então expandir.**
> **Fases:** seguem [`11-PLANO-POR-FASES.md`](11-PLANO-POR-FASES.md). Critérios de aceite consolidados: [`14-CRITERIOS-DE-ACEITE.md`](14-CRITERIOS-DE-ACEITE.md).

## 1. P0 — antes de qualquer código

| # | Recomendação | Por quê | Como começar | Critério de conclusão |
|---|---|---|---|---|
| P0-1 | Responder as decisões 45–57 | Sem elas, a Fase 1 vira adivinhação | Discussão registrada em `DECISIONS-AND-OPEN-QUESTIONS.md` | Decisões escritas, com responsável |
| P0-2 | Congelar contrato `View3DSession`/`View3DOverrides`/`View3DSessionReport` | É o que impede o viewport de virar segundo domínio | Schema + fixtures + validação pura | Contrato aprovado ou rejeitado |
| P0-3 | Definir política de dependência e notices do Three.js e decoders | Licença e atualização são risco real | `THIRD_PARTY_NOTICES.md` + versão exata | Notices por componente |
| P0-4 | Definir CSP e modelo de segurança (token + protocolo) | Decoders usam wasm/worker; bytes precisam de caminho seguro | CSP report-only + desenho de canais | CSP sem violação no build; modelo aprovado |
| P0-5 | Criar fixtures sintéticas (F1, F3, F4, F5) | Testar sem baixar modelos | Estender `tests/glb-fixtures.mjs` | Fixtures versionadas, pequenas |
| P0-6 | Definir o que conta como evidência | Evitar “funcionou no sandbox” como conclusão | Ver [`09`](09-HARDWARE-E-DESEMPENHO.md) §7.3 | Critério aceito |
| P0-7 | Medir o hardware antes de prometer | WebGPU na RX 580 é `unknown` | `chrome://gpu` + probe WebGL2/WebGPU | Registro do backend real |
| P0-8 | Criar teste em Chromium real | O repositório só tem SSR/Node; canvas não é testado | Playwright/CDP ou Electron de teste, sem nova dependência de produto | Teste de fumaça abre/fecha canvas |

## 2. P1 — Fase 1 (viewport e visualização)

| # | Recomendação | Escopo mínimo |
|---|---|---|
| P1-1 | `three` fixo, carregado por `import()` dinâmico | Chunk separado; bundle base intacto |
| P1-2 | `View3DService` no main com hash, token, limites e `close` | Um serviço, não espalhar lógica |
| P1-3 | Caminho único de bytes (protocolo + Range; fallback IPC ≤ 64 MB) | Um só caminho por ambiente |
| P1-4 | Viewport WebGL2 com órbita, grade, wireframe, perspectiva/orto | Nada além |
| P1-5 | `SceneIndex` mínimo (contagens, bounds, materiais, skins, clips) | Serializável; sem expor objetos Three.js |
| P1-6 | Diagnóstico honesto (declarado × medido) | Observação, nunca aprovação |
| P1-7 | Telemetria (backend, GPU, fps, draw calls, memória) | Visível, opt-in |
| P1-8 | Dispose completo + recuperação de contexto | Teste de 10 ciclos |
| P1-9 | UI “visualização apenas” e estados de erro | Sem becos sem saída |
| P1-10 | Render sob demanda e pausa em background | Sem loop eterno |
| P1-11 | Teste em Chromium real + manual Windows | Prova o que os smokes não provam |

**Não entra na Fase 1:** seleção, hierarquia, transformação, material, animação, captura, exportação.

## 3. P2 — Fases 2, 3 e 4

### Fase 2 — seleção, hierarquia e transformações

| # | Recomendação | Cuidado |
|---|---|---|
| P2-1 | Picking por clique + hierarquia com IDs estáveis da Lia | Nomes podem ser vazios/duplicados |
| P2-2 | Gizmo (`TransformControls.getHelper()`) + undo/redo + reset | Sem undo, não liberar |
| P2-3 | Overrides persistentes com `sourceSha256` e `stale` | Nunca aplicar sem confirmar |
| P2-4 | Captura PNG como ação explícita | Marcar como prévia; não criar versão |

### Fase 3 — materiais e texturas

| # | Recomendação | Cuidado |
|---|---|---|
| P2-5 | Inspeção PBR + prévia de textura + VRAM estimada | Pipeline de cor declarado |
| P2-6 | Ambiente neutro (`RoomEnvironment`/PMREM) e fundo | Não alterar material do arquivo |
| P2-7 | Override de material só com decisão 47 = A | Nunca criar shader |
| P2-8 | Diagnóstico de material/UV/textura | Observação, não aprovação |

### Fase 4 — personagens, esqueletos e animações

| # | Recomendação | Cuidado |
|---|---|---|
| P2-9 | `SkeletonHelper` + lista de bones + skins | `dispose()` no fechamento |
| P2-10 | `AnimationMixer` + timeline + scrub | Precisão verificada; `uncache*` |
| P2-11 | Comparação A/B de clipes | Mesma pose e mesmo tempo |
| P2-12 | Diagnóstico de animação e root motion | Não editar keyframes |

## 4. P3 — Fase 5 (integração) e além

| # | Recomendação | Condição |
|---|---|---|
| P3-1 | Passo de workflow abre o viewport para revisão | Nunca automático |
| P3-2 | Evidência de inspeção na jornada | Humana, ligada ao `sha256` |
| P3-3 | Captura registrada como versão via `addAssetVersion` | Ação explícita |
| P3-4 | Comparison Lab aceita capturas e A/B de versões | Comparação humana |
| P3-5 | “Abrir no Blender” contextual | Sem controlar Blender |
| P3-6 | Leitura de `ProjectVisualProfile`/`ChangeImpactReport`/`StyleLock` | Somente quando existirem |
| P3-7 | Export GLB derivado com relatório de diferenças | Fase 5; nunca sobrescrever |
| P3-8 | `gltf-validator` opcional e `gltf-transform` como etapa externa | Sem dependência obrigatória |
| P3-9 | `.gltf` externo com allowlist (se decisão 51 permitir) | Testes negativos |
| P3-10 | Câmera para spritesheet (sem escolher renderer) | Decisão 56 e ADR-001 |
| P3-11 | Comparação Blender × WebGL com rubrica separada | Sem score agregado |

**Pós-fase 5 (pesquisa, não comprometido):** cabelo, partículas, colisores, splats, path tracing. Nada disso tem fase ou prazo.

## 5. Recomendações negativas (não fazer)

| # | Não fazer | Motivo |
|---|---|---|
| N-1 | Adotar R3F/drei agora | React 18; exige upgrade amplo |
| N-2 | Implementar edição de malha/UV/rig/animação | Blender é dono; escopo explode |
| N-3 | Usar `file://` ou desativar `webSecurity` | Bypass de segurança |
| N-4 | Mandar WebGPU como requisito | Não medido na RX 580 |
| N-5 | Prometer “qualquer GLB” | Memória e formatos limitam |
| N-6 | Exportar sobrescrevendo o original | Perda irreversível |
| N-7 | Medir qualidade por um score único (WebGL × Blender) | Já rejeitado nos docs de contrato |
| N-8 | Criar segunda app/launcher ou janela separada por padrão | Viola integração |
| N-9 | Baixar modelos/pesos para teste | Não autorizado |
| N-10 | Duplicar assets no import | Violação de “sem duplicação” |
| N-11 | Esconder limitações no HUD/UX | Quebra confiança |
| N-12 | Usar tone mapping/ambiente sem declarar na proveniência | Captura não reproduzível |
| N-13 | Colocar `three` no bundle inicial | Custo para quem nunca abre modelo |

## 6. Ordem sugerida de trabalho (fora do código)

```
1. Ler README + 01–14 (esta pasta) + ADR-001 + contrato de domínio
2. Responder 45–57
3. Aprovar/rejeitar contratos (06)
4. Medir hardware (probe) e registrar
5. Só então autorizar um pacote de implementação da Fase 1
```

## 7. Conclusão em uma página

- **O que já existe e serve:** GLB estrutural, QA, versões, export por destino, transporte, segurança de janela, jornada.
- **O que não existe:** qualquer renderização, sessão, captura, hierarquia visual, animação, overrides.
- **Tecnologia:** Three.js r187 (MIT) é adequada; WebGL2 é o piso; WebGPU é opcional e não comprovado neste hardware.
- **Maior custo:** não é desenhar — é sessão, transporte de bytes, memória/VRAM, descarte, limites, UX de “não é edição” e testes reais.
- **Maior risco:** vazamento de GPU/VRAM, falsa sensação de “salvou”, exportação com perda silenciosa e conclusões sem medição.
- **Fronteira:** Three.js desenha e inspeciona; Blender autora e renderiza; Lia Forge é dona do projeto, dos assets, dos contratos e da decisão humana.
- **Próximo passo correto:** decidir (45–62), aprovar contratos, medir hardware. Implementar depois — Fase 1 pequena, sem seleção/edição, com critérios verificáveis.

## 8. Adendo — skills, agentes e ferramentas (tarefa 2)

Este adendo **não altera** as prioridades P0–P3 acima nem promove fase. Ele registra o que a pesquisa complementar recomenda para o futuro Skills & Knowledge Engine. Detalhe em [`15`](15-ECOSSISTEMA-SKILLS-E-AGENTES.md), [`16`](16-MATRIZ-SOLUCOES-SKILLS.md) e [`17`](17-ROADMAP-INTEGRACAO-SKILLS.md).

| # | Recomendação | Condição |
|---|---|---|
| S-P0-1 | Curar o subconjunto Three.js r187 do `gamedev-skills` e a taxonomia do `CloudAI-X` como **referência**, sem instalar | Aprovação das decisões 58–62; commit, hash, licença e revisor registrados |
| S-P0-2 | Registrar proveniência, licença e revisão de cada skill candidata | Manifesto do [`SKILLS-KNOWLEDGE-ENGINE.md`](../SKILLS-KNOWLEDGE-ENGINE.md) estendido com `threeRevision`, `verifiedAt` e `execution` |
| S-P0-3 | Criar um verificador de drift de revisão do Three.js | Comparar `threeRevision` com `package.json` e APIs deprecadas conhecidas; nenhuma skill “r187” sem verificação |
| S-P1-1 | Criar `lia-threejs-gltf-intake` e `lia-threejs-scene-review` como skills read-only | `model3d.inspect` disponível; nenhum viewport prometido |
| S-P1-2 | Não copiar scripts de QA externos; recriar o checklist e a evidência no runtime do Lia Forge | Revisão de segurança e de licença |
| S-P2-1 | Criar `lia-threejs-performance-budget` e `lia-threejs-visual-evidence` | Captura e telemetria existirem; gate para salvar versão |
| S-P3-1 | Criar `lia-threejs-material-lighting-review` | `material.inspect` existir; `material.pbr` continua planejado |
| S-P4-1 | Criar `lia-threejs-motion-review` | `rig3d.inspect` existir; nenhuma edição de keyframe |
| S-P5-1 | Criar `lia-threejs-export-diff` e `lia-threejs-blender-boundary` | Exportação derivada e handoff aprovados |
| S-P5-2 | Avaliar `Kiln`, `Blender MCP`, `gltf-transform`, `gltfpack` e `gltf-validator` como ferramentas externas opcionais | Decisão 60; processo isolado, sem rede default, consentimento e logs |

### 8.1 Recomendações negativas adicionais

| # | Não fazer | Motivo |
|---|---|---|
| N-14 | Instalar catálogo de skills, `npx skills add` ou MCP automaticamente | Execução silenciosa e dependência não auditada |
| N-15 | Tratar marketplace ou agregador como fonte de versão | `promptsrush` lista 10 de 13 skills; `skillspot` não expõe licença; `sickn33` não cura |
| N-16 | Copiar GPL, `NOASSERTION` ou conteúdo sem licença | Contaminação e ausência de direito de redistribuição |
| N-17 | Marcar r186 como r187 sem verificação | Duas APIs do CloudAI-X já estão deprecadas no r187 |
| N-18 | Deixar uma skill executar ferramenta, script ou chamada de rede | Viola a fronteira do Skills Engine e do Orchestrator |
| N-19 | Adaptar React Three Fiber agora | React 18.3.1; `@react-three/fiber@9` exige React 19 |
| N-20 | Criar skill genérica de “gráficos bonitos” | Sem critério verificável, vira opinião |
