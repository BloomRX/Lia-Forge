# Ambiente 3D nativo da Lia Forge (Three.js) — auditoria, arquitetura e especificação

> **Estado desta entrega:** `PROPOSTA / AUDITORIA — REVISÃO FINAL`. Nenhum código de produção foi alterado, nenhuma dependência foi adicionada ao produto, nenhum modelo foi baixado, nenhuma licença foi aceita e nenhum merge foi feito.
> **Branch da sessão:** `arena/c61c7ae8-lia-forge` (base `0b4e8671270a14d935e17138cac71366c0fe841f`).
> **Data efetiva:** 2026-11-13 (UTC).
> **Escopo:** viewport 3D próprio da Lia Forge para inspeção e manipulação controlada de conteúdo 3D, com Three.js como tecnologia de renderização — não como dono da arquitetura, não como cópia do Blender e não como um segundo aplicativo.

## 1. Resumo executivo

1. **Não existe viewport 3D na Lia Forge.** O que existe é inspeção **estrutural** de GLB (`shared/model3d/glb.mjs`), validação QA, versionamento de asset, exportação por destino e uma UI que **declara** não renderizar (`src/App.jsx:1399`: *“ILLUSTRATION · NOT A MODEL VIEWER”*).
2. **A arquitetura recomendada é um módulo interno, não um app.** Lia Forge permanece dona de projetos, assets, contratos, workflows, permissões, QA, histórico e UX; Three.js é biblioteca de rendering/interação; Blender continua o DCC de autoria; GLB/glTF é o container de intercâmbio.
3. **WebGL2 é o piso obrigatório; WebGPU é opcional e não comprovado na RX 580.** Não há medição de WebGPU/D3D12 nesta máquina; o desenho exige fallback automático e nunca torna WebGPU requisito.
4. **O custo real não é desenhar: é o produto em volta.** De 76 funcionalidades mapeadas, 33 são `DESENVOLVIMENTO LIA` (sessão, transporte, memória, limites, UI, diagnóstico, integração); 23 são primitivas nativas do Three.js; 7 pertencem ao Blender.
5. **A primeira fatia deve ser pequena e read-only.** Fase 1 = abrir, visualizar, orbitar, diagnosticar, medir e descartar. Seleção/hierarquia/transformação vêm na Fase 2; materiais na 3; rig/animação na 4; integração com workflows/Blender/QA na 5.
6. **Antes de qualquer código do viewport, 13 decisões humanas precisam de resposta** (questões 45–57), e o contrato de sessão/overrides precisa ser aprovado. A frente complementar de skills acrescenta as decisões 58–62, que condicionam apenas curadoria e uso de ferramentas externas. O restante é execução com critérios verificáveis.

**Veredito:** especificação consistente e pronta para orientar a implementação, **condicionada** às decisões 45–57, à aprovação dos contratos e à medição no hardware-alvo. A parte de skills é **condicionada** às decisões 58–62. Nada aqui autoriza implementar.

## 2. Como ler esta pasta

Esta pasta é **independente** dos documentos da frente T13 e não substitui nenhum deles. Onde havia documentação existente, ela é referenciada, não reescrita. A regra de leitura é a mesma do resto do repositório:

- **Observado no código** — caminho/arquivo/linha existe no checkout desta sessão.
- **Documentação oficial** — fonte primária (Three.js, Khronos/glTF, Electron, Chromium/WebGPU, npm registry), com URL ou versão.
- **Executado** — comando/verificação realmente rodada nesta sessão, com resultado.
- **Hipótese** — estimativa técnica **não** medida; precisa de banco de provas no hardware-alvo.
- **Proposta** — decisão sugerida, sem aprovação.
- **Não verificado** — depende de GPU, Windows, Blender, navegador real ou revisão humana.

Nada aqui promove estado de capacidade. A fonte de verdade do que está implementado continua sendo o código e [`../T13-IMPLEMENTATION-EVIDENCE.md`](../T13-IMPLEMENTATION-EVIDENCE.md); o estado operacional continua em [`../../memory-bank/estado.md`](../../memory-bank/estado.md).

## 3. Entregáveis finais × arquivos

| # | Entregável pedido na revisão final | Arquivo |
|---|---|---|
| 1 | Auditoria consolidada | [`01-AUDITORIA-ESTADO-ATUAL.md`](01-AUDITORIA-ESTADO-ATUAL.md) |
| 2 | Arquitetura final recomendada | [`05-ARQUITETURA-PROPOSTA.md`](05-ARQUITETURA-PROPOSTA.md) |
| 3 | Matriz de funcionalidades e viabilidade | [`08-MATRIZ-FUNCIONALIDADES-VIABILIDADE.md`](08-MATRIZ-FUNCIONALIDADES-VIABILIDADE.md) |
| 4 | Contratos e fronteiras entre módulos | [`06-CONTRATOS-E-INTEGRACAO.md`](06-CONTRATOS-E-INTEGRACAO.md) |
| 5 | Estratégia de UX | [`07-UX-PROPOSTA.md`](07-UX-PROPOSTA.md) |
| 6 | Estratégia de desempenho | [`09-HARDWARE-E-DESEMPENHO.md`](09-HARDWARE-E-DESEMPENHO.md) |
| 7 | Estratégia de importação e exportação | [`10-IMPORTACAO-E-EXPORTACAO.md`](10-IMPORTACAO-E-EXPORTACAO.md) |
| 8 | Plano de implementação incremental | [`11-PLANO-POR-FASES.md`](11-PLANO-POR-FASES.md) |
| 9 | Riscos e decisões pendentes | [`12-RISCOS-DEPENDENCIAS-DECISOES.md`](12-RISCOS-DEPENDENCIAS-DECISOES.md) |
| 10 | Critérios de aceite para a implementação | [`14-CRITERIOS-DE-ACEITE.md`](14-CRITERIOS-DE-ACEITE.md) |

**Documentos de suporte (mantidos da primeira entrega e revisados):**

| Documento | Conteúdo |
|---|---|
| [`02-INVENTARIO-FUNCIONALIDADES.md`](02-INVENTARIO-FUNCIONALIDADES.md) | Inventário item a item do que existe, com classificação e evidência |
| [`03-PESQUISA-TECNICA-THREEJS.md`](03-PESQUISA-TECNICA-THREEJS.md) | Pesquisa técnica verificada no pacote r187 + correções da revisão final |
| [`04-BIBLIOTECAS-E-REFERENCIAS.md`](04-BIBLIOTECAS-E-REFERENCIAS.md) | Bibliotecas candidatas, licenças e projetos de referência |
| [`13-RECOMENDACOES-PRIORIZADAS.md`](13-RECOMENDACOES-PRIORIZADAS.md) | P0–P3, recomendações negativas e conclusão executiva |
| [`15-ECOSSISTEMA-SKILLS-E-AGENTES.md`](15-ECOSSISTEMA-SKILLS-E-AGENTES.md) | Auditoria de skills, agentes e ferramentas de produção; cobertura das URLs obrigatórias, licenças, segurança e compatibilidade r187 |
| [`16-MATRIZ-SOLUCOES-SKILLS.md`](16-MATRIZ-SOLUCOES-SKILLS.md) | Matriz recomendadas, alternativas, pesquisa adicional e descartadas; casos de produção; ferramentas |
| [`17-ROADMAP-INTEGRACAO-SKILLS.md`](17-ROADMAP-INTEGRACAO-SKILLS.md) | Catálogo de skills first-party, manifesto, uso por agentes, fases S0–S6 e critérios de curadoria |

### 3.1 Entrega complementar: skills, agentes e ferramentas (2026-11-13)

A frente complementar **não repete** a auditoria técnica desta pasta. Ela responde o que existe no ecossistema, o que é reutilizável, o que está bloqueado e o que o Lia Forge deveria criar. O resultado é:

- **Recomendado para curadoria:** o subconjunto Three.js **r187** de `gamedev-skills` (Apache-2.0, três skills) e a taxonomia de 13 tópicos do `CloudAI-X` (MIT, alvo r186, com duas depreciações a corrigir).
- **Estudo:** QA com evidência de `majidmanzarpour` e `open-3d-skills`; contrato de ferramenta do `Kiln`; vocabulário visual do `scottstts`, com bloqueio GPL.
- **Pesquisa:** `img2threejs`, `pi-skill-threejs-builder`, `NixieFX` e `threejs-architecture-effects`.
- **Bloqueado:** `dgreenheck/webgpu-claude-skill` (sem licença) e `scottstts` para código (GPL).
- **Descartado:** `Dexploarer/threejs-scene-builder` (404), Smithery (Not found), marketplaces sem proveniência e agregadores como fonte de conteúdo.
- **Nada foi instalado, executado, copiado ou integrado.** Nenhuma dependência foi adicionada ao `package.json`.

## 4. Conclusão em uma página

1. **O que já existe e serve:** inspeção estrutural de GLB (`glb.mjs`), QA (`glb-structural`, `png-*`, `destination-profile`), versões de asset com hash/direitos, exportação por destino, Comparison Lab (≤ 8 arquivos), transporte IPC/HTTP com o mesmo serviço, confinamento de caminho e uma UI honesta.
2. **O que não existe:** qualquer renderização, sessão de visualização, hierarquia visual, seleção, animação, materiais, captura, overrides, protocolo de bytes e telemetria gráfica.
3. **Tecnologia:** `three@0.187.0` (MIT, zero dependências) cobre GLTF/GLB, Draco/Meshopt/KTX2, `OrbitControls`, `TransformControls`, `SkeletonHelper`, `AnimationMixer`, `Raycaster`, PBR, `PMREMGenerator`, `EffectComposer` e `GLTFExporter` — verificado no pacote, não presumido.
4. **Fronteira:** Three.js **desenha e inspeciona**; Blender **autora e renderiza**; Lia Forge **governa** projeto, asset, contrato, permissão, QA, histórico, UX e a decisão humana. O viewport não é Scene Composer, não é renderer oficial e não é um DCC.
5. **Formato:** GLB é o container central; glTF autocontido é aceito na Fase 1; `.gltf` com recursos externos só na Fase 5, com allowlist. Formato não suportado recebe próximo passo, não tela preta.
6. **Memória e desempenho:** o risco dominante é VRAM/textura, não geometria. Orçamento proposto: 512 MB confortável, 1 GB alerta, 1,2 GB recusa; arquivo até 256 MB; uma sessão; DPR ≤ 1.5; render sob demanda; `dispose` completo. Nada disso foi medido ainda.
7. **Segurança:** token + protocolo `lia3d://` com Range, allowlist e TTL; CSP em report-only antes de enforce; nenhum `file://`, nenhum caminho absoluto, nenhuma rede, nenhum decoder de CDN.
8. **Decisões:** 18 questões abertas (45–62) registradas em [`../DECISIONS-AND-OPEN-QUESTIONS.md`](../DECISIONS-AND-OPEN-QUESTIONS.md), sem default e sem decisão tomada. As questões 58–62 são da frente de skills e estão detalhadas em [`17`](17-ROADMAP-INTEGRACAO-SKILLS.md) §9. A recomendação técnica é não vinculante.
9. **Skills e ferramentas:** o ecossistema tem muito conteúdo e pouca verificabilidade. A recomendação é adaptar conhecimento com proveniência e criar poucas skills first-party; não instalar catálogos, não copiar GPL/sem licença e não transformar skill em executor. Evidência em [`15`](15-ECOSSISTEMA-SKILLS-E-AGENTES.md) e [`16`](16-MATRIZ-SOLUCOES-SKILLS.md).

## 5. Plano em cinco fases

| Fase | Escopo | Não inclui | Esforço (hipótese) |
|---|---|---|---|
| 0 | Decisões, contratos, CSP, fixtures, critério de evidência | Qualquer código de produto | S–M |
| 1 | Viewport e visualização GLB/glTF, diagnóstico, telemetria, descarte | Seleção, edição, material, animação, captura | M–L |
| 2 | Seleção, hierarquia, transformações reversíveis, overrides, captura | Material, animação, versionamento, Blender | M–L |
| 3 | Materiais, texturas, UVs, ambiente e pipeline de cor | Pintura, bake, shader customizado | M |
| 4 | Personagens, esqueletos, clipes, timeline, A/B | Edição de animação, retarget | M–L |
| 5 | Workflows, jornada, QA, Blender, Comparison Lab, export derivado | Escolher renderer, publicar, controlar Blender | L |
| pós | Cabelo, partículas, splats, colisores, path tracing | Promessa de fase ou prazo | — |

Detalhe, gates e critérios em [`11`](11-PLANO-POR-FASES.md) e [`14`](14-CRITERIOS-DE-ACEITE.md).

## 6. Correções aplicadas na revisão final

| Correção | Onde | Efeito |
|---|---|---|
| Ordem das fases alinhada a **1) viewport, 2) seleção/hierarquia/transformações, 3) materiais/texturas, 4) personagens/animações, 5) integração** | [`11`](11-PLANO-POR-FASES.md), [`08`](08-MATRIZ-FUNCIONALIDADES-VIABILIDADE.md), [`07`](07-UX-PROPOSTA.md), [`13`](13-RECOMENDACOES-PRIORIZADAS.md) | Fase 1 estritamente read-only; integração não acontece cedo demais |
| Raycast de `SkinnedMesh` **usa a pose atual**; o problema é o bound cacheado | [`03`](03-PESQUISA-TECNICA-THREEJS.md) §0 e §9, [`14`](14-CRITERIOS-DE-ACEITE.md) | Critério de picking e recomendação de recalcular bounds |
| `Box3.setFromObject(obj, true)` **aplica skinning** via `getVertexPosition()` | [`03`](03-PESQUISA-TECNICA-THREEJS.md) §0 e §4 | Evita instrução errada sobre bounds de personagem |
| `GLTFExporter` não gera KTX2, mas existe `KTX2Exporter` separado | [`10`](10-IMPORTACAO-E-EXPORTACAO.md), [`03`](03-PESQUISA-TECNICA-THREEJS.md) | Não promete transcodificação automática |
| Telemetria difere entre WebGL e WebGPU (`texturesSize`, `drawCalls`) | [`09`](09-HARDWARE-E-DESEMPENHO.md), [`05`](05-ARQUITETURA-PROPOSTA.md), [`03`](03-PESQUISA-TECNICA-THREEJS.md) | HUD trata campo ausente como `unknown` |
| `WebGPURenderer.init()/dispose()` assíncronos; `ShaderMaterial` não confiável | [`05`](05-ARQUITETURA-PROPOSTA.md), [`03`](03-PESQUISA-TECNICA-THREEJS.md) | Interface `ViewportRenderer` corrigida |
| `.gltf` autocontido entra na Fase 1; externo fica na Fase 5 | [`10`](10-IMPORTACAO-E-EXPORTACAO.md), [`06`](06-CONTRATOS-E-INTEGRACAO.md), [`12`](12-RISCOS-DEPENDENCIAS-DECISOES.md) | Atende “GLB/glTF” sem abrir path traversal |
| Contagem da matriz verificada por script (76 linhas; 33 Lia, 23 nativas, 7 Blender) | [`08`](08-MATRIZ-FUNCIONALIDADES-VIABILIDADE.md) | Remove número aproximado incorreto |
| Critérios de aceite consolidados e separados por fase | [`14`](14-CRITERIOS-DE-ACEITE.md) | Evita critério duplicado/divergente |
| Teto de importação existente (32 MB em `saveInput`, 6 MB em `readInput`) explicitado | [`10`](10-IMPORTACAO-E-EXPORTACAO.md), [`12`](12-RISCOS-DEPENDENCIAS-DECISOES.md) (R21, decisão 57) | O plano não promete abrir 256 MB pelo seletor atual |
| Questões 45–57 registradas nominalmente no arquivo de decisões | [`../DECISIONS-AND-OPEN-QUESTIONS.md`](../DECISIONS-AND-OPEN-QUESTIONS.md) | Rastreabilidade, sem reabrir 1–44 |
| Questões 58–62 registradas na seção de skills | [`../DECISIONS-AND-OPEN-QUESTIONS.md`](../DECISIONS-AND-OPEN-QUESTIONS.md) e [`17`](17-ROADMAP-INTEGRACAO-SKILLS.md) §9 | Curadoria e ferramentas externas também ficam sem default |

## 7. O que esta entrega **não** faz

- Não instala Three.js nem qualquer dependência no repositório.
- Não instala, executa ou integra skills, MCP, CLI ou providers externos; a pesquisa complementar é somente leitura.
- Não altera `package.json`, `vite.config.js`, `electron/*`, `src/*`, `shared/*`, testes, workflows ou contratos existentes.
- Não cria capability, adapter, canal IPC, rota, validador ou teste de canvas.
- Não escolhe renderer padrão para `Lia3DSprite` (decisão aberta em [`../LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md`](../LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md) §15.2).
- Não substitui Blender, não cria launcher, não altera a branch do agente principal, não faz merge.
- Não afirma desempenho em Windows/RX 580: não há GPU, Windows nem Electron gráfico neste ambiente.
- Não corrige a falha isolada de `tests/run-lifecycle-smoke.mjs` observada no sandbox; ela é registrada como limitação de evidência, não como parte desta entrega.
- Não promove nenhuma fase: todas continuam `PROPOSTA`, aguardando decisão humana.

## 8. Arquivos criados e modificados

```
docs/threejs-3d-environment/README.md
docs/threejs-3d-environment/01-AUDITORIA-ESTADO-ATUAL.md
docs/threejs-3d-environment/02-INVENTARIO-FUNCIONALIDADES.md
docs/threejs-3d-environment/03-PESQUISA-TECNICA-THREEJS.md
docs/threejs-3d-environment/04-BIBLIOTECAS-E-REFERENCIAS.md
docs/threejs-3d-environment/05-ARQUITETURA-PROPOSTA.md
docs/threejs-3d-environment/06-CONTRATOS-E-INTEGRACAO.md
docs/threejs-3d-environment/07-UX-PROPOSTA.md
docs/threejs-3d-environment/08-MATRIZ-FUNCIONALIDADES-VIABILIDADE.md
docs/threejs-3d-environment/09-HARDWARE-E-DESEMPENHO.md
docs/threejs-3d-environment/10-IMPORTACAO-E-EXPORTACAO.md
docs/threejs-3d-environment/11-PLANO-POR-FASES.md
docs/threejs-3d-environment/12-RISCOS-DEPENDENCIAS-DECISOES.md
docs/threejs-3d-environment/13-RECOMENDACOES-PRIORIZADAS.md
docs/threejs-3d-environment/14-CRITERIOS-DE-ACEITE.md
docs/threejs-3d-environment/15-ECOSSISTEMA-SKILLS-E-AGENTES.md
docs/threejs-3d-environment/16-MATRIZ-SOLUCOES-SKILLS.md
docs/threejs-3d-environment/17-ROADMAP-INTEGRACAO-SKILLS.md
```

**Modificado (apenas acréscimo):** `docs/DECISIONS-AND-OPEN-QUESTIONS.md` — questões **45–57** em seção própria e questões **58–62** na seção de skills, além de uma frase no parágrafo final de escopo negativo. Nenhuma questão 1–44 foi alterada, renumerada ou respondida.

Nenhum outro arquivo preexistente foi modificado. Os índices globais (`docs/README.md`, `memory-bank/estado.md`) **não** foram tocados para não colidir com a frente T13; a inclusão dos links é um passo de revisão humana.

## 9. Evidência desta entrega (o que foi realmente executado)

| Afirmação | Como foi verificada | Ambiente |
|---|---|---|
| Estado do repositório (branch, HEAD, árvore limpa) | `git status`, `git log`, `git fetch`, fast-forward da branch | Sandbox Linux |
| Ausência de Three.js/WebGL no produto | `grep -ril three`, leitura de `package.json`, `vite.config.js` | Sandbox Linux |
| Versão e conteúdo do Three.js r187 | `npm pack three@0.187.0` + leitura do pacote em `/tmp/threecheck` (fora do repo) | Sandbox Linux, Node 22 |
| APIs de loader/exporter/controle/animação/dispose | leitura do código do pacote r187 (`GLTFLoader`, `GLTFExporter`, `KTX2Exporter`, `OrbitControls`, `TransformControls`, `AnimationMixer`, `SkeletonHelper`, `Raycaster`, `Box3`, `SkinnedMesh`, `Info`, `WebGLInfo`) | Sandbox Linux |
| Versões/licenças/peer deps das bibliotecas candidatas | API do npm (reconsultada) | Sandbox Linux |
| Compatibilidade do preload com Electron 45 | `grep` em `electron/preload.cjs` (só `require('electron')`; sem `Buffer`/`setImmediate`) | Sandbox Linux |
| Extensões glTF suportadas/exportadas | `grep` no código de `GLTFLoader`/`GLTFExporter` (52 identificadores; 20 no exporter) | Sandbox Linux |
| Guia oficial de render sob demanda, cleanup, compatibilidade WebGL | três páginas do manual oficial do Three.js | Documentação oficial |
| Comportamento de WebGPU na RX 580 | **não executado** — `unknown` | precisa de Windows + GPU |
| Desempenho, fps, VRAM, memória | **não executado** — hipóteses em [`09`](09-HARDWARE-E-DESEMPENHO.md) | precisa de Windows + GPU |
| Suíte JS existente | `npm ci --ignore-scripts` + `npm test` em 2026-11-13: **31 de 32 smokes passam**; `run-lifecycle-smoke` falha na captura do PID do processo-filho, reproduzido isoladamente e não relacionado a esta entrega (somente Markdown). Investigação fora do escopo | Sandbox Linux, Node 22.22.3 |
| Build do produto | `npx vite build` → **sucesso** (1.581 módulos; JS 350,20 kB / 102,68 kB gzip) | Sandbox Linux |
| Testes Python | `npm run test:python` → **30 testes OK** | Sandbox Linux |
| Cobertura das nove URLs obrigatórias de skills | `fetch_page` e consulta HTTP; **9 de 9** classificadas; 5 não reutilizáveis e 1 morta | Sandbox Linux |
| Metadados, licenças e atividade dos repositórios de skills | API do GitHub para 14 repositórios e registry npm para 7 pacotes; snapshot 2026-11-13 | Sandbox Linux |
| Contagem de skills, referências, scripts e targets | Clones **somente de leitura** em `/tmp`; `find`, `wc`, `grep`; nenhum `npm install` ou script executado | Sandbox Linux |
| Compatibilidade das skills com `three@0.187.0` | `grep` no pacote r187: `NodeLibrary.addLight` e `iridescenceThicknessRange` **deprecados**, não removidos; `Timer`, `Object3D.getWorldDirection`, `DRACOLoader`/`KTX2Loader` confirmados; peer do `NixieFX` `<0.186` | Sandbox Linux, pacote r187 |
| Instalação/execução de skills, MCP, CLI ou provider | **não executados**; nenhum `npx skills add`, `npm install`, script Python, browser ou render | fora de escopo por decisão da missão |
| Blender, engine, ComfyUI | **não executados** | fora de escopo |

Regra que vale para toda a pasta: **“não executado” nunca é apresentado como “aprovado”**, e ausência de evidência não é evidência de ausência de problema.

## 10. Próximo passo (revisão humana)

1. Responder as questões 45–57 (viewport) e 58–62 (skills), ou rejeitá-las com justificativa.
2. Aprovar/rejeitar os contratos `View3DSession`, `View3DOverrides` e `View3DSessionReport`.
3. Medir o hardware (`chrome://gpu`, probe WebGL2/WebGPU) e registrar no formato de [`09`](09-HARDWARE-E-DESEMPENHO.md) §7.
4. Autorizar ou não um pacote de implementação da **Fase 1** — somente read-only, com os critérios de [`14`](14-CRITERIOS-DE-ACEITE.md).
5. Se as questões 58–62 forem respondidas, autorizar apenas a **curadoria S0**: registrar proveniência, licença e revisão das skills candidatas, sem instalar nem executar nada. Qualquer skill first-party só entra depois do gate de [`17`](17-ROADMAP-INTEGRACAO-SKILLS.md) §8.

Enquanto isso não acontecer, o estado correto deste módulo é **“especificado, não implementado”**.
