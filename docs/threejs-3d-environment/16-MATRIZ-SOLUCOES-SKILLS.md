# 16 — Matriz de soluções: skills, agentes e ferramentas

> **Status:** `PESQUISA` em 2026-11-13. Nenhum item foi instalado, executado ou integrado. A matriz classifica **utilidade para curadoria**, não autorização de uso.

Este documento é a matriz comparativa da frente complementar. A narrativa, as fichas e as evidências de API ficam em [`15-ECOSSISTEMA-SKILLS-E-AGENTES.md`](15-ECOSSISTEMA-SKILLS-E-AGENTES.md). O catálogo de skills próprias, o roadmap e os critérios de aceite ficam em [`17-ROADMAP-INTEGRACAO-SKILLS.md`](17-ROADMAP-INTEGRACAO-SKILLS.md).

---

## 1. Como ler a classificação

| Rótulo | Significado |
|---|---|
| **ADAPTAR** | Conteúdo ou padrão com licença compatível e valor claro; pode virar skill first-party depois de reescrita/revisão e atribuição. Não significa copiar o pacote. |
| **ESTUDAR** | Boa referência de método, QA ou arquitetura; não entra no produto nesta fase. |
| **PESQUISA** | Exige experimento, licença, hardware ou integração que ainda não existe; não é base de implementação. |
| **BLOQUEADO** | Impedimento de licença, segurança ou incompatibilidade dura; só leitura. |
| **DESCARTAR** | Morto, não verificável, genérico demais ou inadequado ao escopo; não reabrir sem fato novo. |
| **NÃO APLICÁVEL** | Pode ser bom, mas conflita com uma restrição atual do Lia Forge (React 18, r187, v1 read-only). |

**Utilidade** é qualitativa: `Alta` para o que resolve uma lacuna real de conhecimento ou de QA; `Média` para método aproveitável; `Baixa` para escopo periférico; `Nenhuma` para o que não tem relação com o Lia Forge.

A coluna **Alvo Three** é a revisão declarada pelo upstream ou observada no checkout. Ela **não** foi testada no Lia Forge. Onde há `n/d`, o projeto não declara revisão.

---

## 2. Matriz principal — skills, agentes e pacotes

| ID | Solução | Tipo | Licença | Alvo Three | Utilidade | Evidência principal | Classificação | Fase sugerida |
|---|---|---|---|---|---|---|---|---|
| S01 | `CloudAI-X/threejs-skills` | 13 skills, conhecimento puro | MIT | r186 | Alta | 6.090 linhas; sem scripts; 2 APIs deprecadas no r187; R3F inaplicável | **ADAPTAR** | 0–1 |
| S02 | `gamedev-skills` — subconjunto Three.js | 3 skills + referências | Apache-2.0 | **r187** | Alta | 1.059 linhas; `VERSION-SUPPORT` verificado 2026-11-11; cita r180–r187 | **ADAPTAR** | 0–1 |
| S03 | `gamedev-skills` — catálogo completo | 79 skills + roteador | Apache-2.0 | r187 para Three | Baixa | Fora do escopo: jogos, engines e disciplinas | **ESTUDAR** só o roteador | 0 |
| S04 | `majidmanzarpour/threejs-game-skills` | 9 skills + scaffold + QA | MIT | `^0.184.0` | Média | QA de canvas, evidência, Playwright; APIs pagas; 427 menções a chaves | **ESTUDAR** | 1–2 |
| S05 | `scottstts/Threejs-Awesome-Graphics-Agent-Skills` | 24 skills de gráficos | **MIT AND GPL-3.0-only** | `^0.185.1` | Média | Vocabulário visual forte; 187 MB; GPL em 3 skills | **BLOQUEADO para código** | pós-5 |
| S06 | `dgreenheck/webgpu-claude-skill` | 1 skill de WebGPU/TSL | **nenhuma** | r183 | Média | Material bom, sem licença, parado desde 2026-04 | **BLOQUEADO** | pós-5 |
| S07 | `img2threejs/img2threejs` | Skill + CLI + pipeline Python | Apache-2.0 | constantes 0.169.0 | Média | Fábrica procedural com quality gates; GLB por plugin; browser/visão | **PESQUISA** | pós-5 |
| S08 | `picassio/pi-skill-threejs-builder` | 1 skill + 5 referências | MIT | 0.160.0 | Baixa | Calibração útil; erro factual de forward `-Z`; 3 estrelas | **PESQUISA** | 0–1 |
| S09 | `azakhary/nixie-fx` | Runtime + editor + CLI + 2 skills | MIT | peer `>=0.184 <0.186` | Baixa | VFX determinístico; **não aceita r187** | **PESQUISA** | pós-5 |
| S10 | `viettranx/3dviz-pro-max` | 1 skill + kits + exemplos | MIT | 0.180 | Média | Método de raciocínio visual; 87 MB; Blender bake | **ESTUDAR** | pós-5 |
| S11 | `Moh4696/open-3d-skills` | 8 skills | MIT | 0.169.0 | Média | `site-check` e `frame-capture`; QA real; defasado | **ESTUDAR** | 1–2 |
| S12 | `lhlGitHub/threejs-architecture-effects` | 1 skill + starter | MIT | 0.185.1 | Baixa | Scaffold que não sobrescreve; React 19 | **NÃO APLICÁVEL** | pós-5 |
| S13 | `instruktlabs/kiln` | MCP + CLI + SDK + render + GLB | MIT | **0.187.0** | Alta | Revisão/proveniência; `export_to` sem overwrite; executa JS; não é skill | **PESQUISA** como adaptor | 5–6 |
| S14 | `sickn33/agentic-awesome-skills` | Agregador | MIT | exemplo r183 | Baixa | 49.668 estrelas; milhares de skills; sem curadoria própria | **DESCARTAR como fonte** | 0 |
| S15 | `skillspot.dev` — community Three.js | Listagem | não informada | n/d | Nenhuma | Sem upstream, licença, commit ou conteúdo auditável | **DESCARTAR** | 0 |
| S16 | `promptsrush` — threejs-skills | Vitrine | não informada | “r160+” | Nenhuma | 10 skills contra 13 reais; clone divergente | **DESCARTAR como fonte** | 0 |
| S17 | `explainx.ai` — threejs-skills | Distribuição de agregador | não informada | r183 | Baixa | Exemplo de frontmatter e instalação | **DESCARTAR como fonte** | 0 |
| S18 | `threejsresources.com/ai/skills` | Índice editorial | não informada | variado | Baixa | Cinco skills; regra de pinar revisão | **ESTUDAR** só o critério | 0 |
| S19 | `Dexploarer/threejs-scene-builder` / Smithery | MCP/skill morto | n/d | n/d | Nenhuma | GitHub 404; Smithery “Not found” | **DESCARTAR** | — |
| S20 | `AftabIbrahimKazi/ai-dev-kit` | Kit genérico | MIT | n/d | Nenhuma | 10 estrelas; não é Three.js | **DESCARTAR** | — |

### 2.1 Capacidades por solução

| ID | Gera código | Gera asset | GLB/glTF | Inspeciona ou corrige | Offline |
|---|---|---|---|---|---|
| S01 | Exemplos e padrões | Nenhum | Instrução de loader | Checklist; não executa | Sim |
| S02 | Exemplos e padrões | Nenhum | Sim, via `GLTFLoader` | Checklist e “Verify”; não executa | Sim |
| S04 | Scaffold e código de jogo | Assets via Tripo, Gemini e ElevenLabs | Sim | QA com Playwright e pixels | Parcial |
| S05 | Shaders, cenas e materiais | Assets de exemplo | n/d | Validação visual | Sim para texto |
| S06 | Exemplos WebGPU/TSL | Nenhum | n/d | n/d | Sim |
| S07 | Fábrica TypeScript | GLB por plugin | Lê GLB para rig e mede referência | Quality gates e revisão por visão | Parcial |
| S08 | Instruções e helper | Nenhum | Calibração de GLB | Ajuda a inspecionar; contém erro de eixo | Sim |
| S09 | Runtime de VFX | Bundle de efeitos | n/d | Diagnóstico de runtime | Sim |
| S10 | Cenas, kits e templates | Assets com Blender bake | n/d | Capture helper e validação visual | Parcial |
| S11 | Cenas e captura | Vídeo com alpha e frames | n/d | Checagem em navegadores reais | Parcial |
| S12 | Starter React 19 | Nenhum | n/d | n/d | Sim |
| S13 | JS de geometria, renders e GLB | Sim | Exporta GLB | Render, checagem estrutural e fidelidade | Sim local |
| S14 | Agrega conteúdo | n/d | n/d | n/d | Sim |

**Sobre “corrigir”.** Nenhuma solução auditada corrige geometria, rig ou material de forma segura e verificável. `img2threejs` tem um loop de correção por estágio, mas é research; `Kiln` renderiza e checa, mas não conserta o asset. Correção real continua sendo Blender ou uma ferramenta CLI com diff e gate humano.

### 2.1 Resumo por categoria

- **Recomendadas para curadoria:** S01 e S02.
- **Alternativas / estudo:** S04, S10, S11, S13 e, com bloqueio, S05 e S06.
- **Pesquisa adicional:** S07, S08, S09 e S12.
- **Descartadas:** S03 como catálogo, S14–S20.

---

## 3. Matriz de ferramentas de produção

Ferramentas não são skills. Elas executam ações e, por isso, ficam atrás de um gate diferente: capability, permissão, isolamento, rede e licença. Nenhuma foi executada nesta missão.

| ID | Ferramenta | O que faz | Licença | Versão observada | Valor para o Lia Forge | Risco | Classificação |
|---|---|---|---|---|---:|---|---|
| T01 | [`@gltf-transform/cli`](https://github.com/donmccurdy/glTF-Transform) | Inspeciona, otimiza, deduplica, comprime e converte glTF/GLB | MIT | 4.5.1 | Alto para `inspect`, `optimize`, `draco`, `meshopt`, `ktx2` como etapa externa | Dependências nativas (`sharp`, `ktx-parse`); escreve arquivo | **PESQUISA** para adapter opcional |
| T02 | [`gltfpack`](https://github.com/zeux/meshoptimizer) | Otimiza malha e animação, quantiza, gera GLB | MIT | 1.3.0 | Alto para redução de tamanho e validação de orçamento | Binário/CLI; altera geometria; precisa diff | **PESQUISA** para adapter opcional |
| T03 | [`glTF-Validator`](https://github.com/KhronosGroup/glTF-Validator) | Valida spec, extensões e boas práticas | Apache-2.0 | 2.0.0-dev.3.10 | Alto para QA oficial além do `glb-structural` | Versão `dev`; não é o mesmo que render | **PESQUISA** para validação opcional |
| T04 | [`Spector.js`](https://github.com/BabylonJS/Spector.js) | Captura e inspeciona frames WebGL | MIT | 0.9.33 | Médio para diagnosticar draw calls e estado GL | Depende de browser; dados sensíveis de frame | **PESQUISA** para debug |
| T05 | [`model-viewer`](https://github.com/google/model-viewer) | Web component para exibir GLB/USDZ | Apache-2.0 | 4.4.0 | Baixo/Médio como referência de UX de viewer | Não é Three.js; 43 MB; não substitui inspeção | **ESTUDAR** |
| T06 | [`Blender MCP`](https://github.com/ahujasid/blender-mcp) | Controla Blender por MCP e executa Python | MIT | n/d | Médio para autoria externa | Executa Python no Blender; superfície alta | **PESQUISA** com gate |
| T07 | [`Kiln`](https://github.com/instruktlabs/kiln) | Executa JS de geometria, renderiza vistas, checa e exporta GLB | MIT | 1.8.0 | Alto como referência de contrato de ferramenta | Executa código; não é sandbox completo | **PESQUISA** como adaptor |

**Regra:** T01–T03 podem virar etapas externas opcionais no futuro, mas não dependências obrigatórias do v1. T04–T07 não entram sem decisão 60 e sem um modelo de ameaça.

---

## 4. Casos de produção: onde cada abordagem se aplica

| Caso | O que o Lia Forge deve fazer | Fonte útil | Fica no Blender? |
|---|---|---|---|
| Construção de cenas | Ler `Scene`, câmera, luzes, loop e resize; diagnosticar canvas preto | S02 `scene-setup`; S01 `fundamentals` | Não; Blender só para autoria de cena complexa |
| Modelagem procedural | Gerar primitivas, lathe, extrude, sweep e assemblies; validar contagem | S10; S11 `threejs-scene`; S01 `geometry` | Sim para hard-surface, retopo e peças orgânicas |
| Geometria e materiais | PBR, UV, texturas, cor sRGB/linear, normal maps | S02 `materials-lighting`; S01 `materials`, `textures` | Sim para unwrap, bake e texturização autoral |
| Iluminação | Key/fill, sombras, IBL, tone mapping, `OutputPass` | S02 `materials-lighting`; S01 `lighting` | Sim para render final e iluminação de produção |
| Shaders | GLSL/ShaderMaterial no WebGL2; TSL só em pesquisa | S01 `shaders`; S05 como vocabulário visual | Sim para shaders complexos e baking |
| Animações | `AnimationMixer`, clipes, cross-fade, loop, root motion | S02 `gltf-loading`; S01 `animation` | Sim para keyframes, rig e edição de animação |
| Personagens | Importar, inspecionar skeleton/skins/clips, validar escala | S02 `gltf-loading`; S08 referência corrigida | Sim para rig, skin weights e animação |
| Importação e otimização | GLTFLoader, extensões, Draco/Meshopt/KTX2; gltf-transform/gltfpack | S02; T01; T02 | Parcial; otimização pode ser CLI externa |
| Ambientes de jogos | Cena, colisão, LOD, iluminação, performance | S04; S11; S03 roteador | Sim para level design e arte final |
| Inspeção visual e QA | Captura, pixels, draw calls, triângulos, texturas, comparação | S04; S11 `site-check`; T04 | Não; QA é do Lia Forge |
| Correção automatizada | Nenhuma correção silenciosa; propor diff e pedir aprovação | S07 como research; T01/T02 com dry-run | Sim quando a correção é de malha/rig |
| Exportação | `GLTFExporter`, relatório de diferenças, nunca sobrescrever | S01 `asset-pipeline`; T01; S13 | Sim para render final e formatos proprietários |

### 4.1 Fronteira explícita

**Three.js no Lia Forge:** desenhar, inspecionar, comparar, capturar e diagnosticar.

**Blender:** modelar, retopologizar, desembrulhar UV, esculpir, riggar, skinar, animar, assar mapas, renderizar e exportar formatos que o Three.js não cobre.

**Ferramentas CLI:** validar, otimizar, converter e comparar, sempre como etapa externa e com artefato derivado.

**Nunca:** usar uma skill para “corrigir” geometria, rig ou material sem uma ferramenta real, sem diff e sem gate humano.

---

## 5. O que reutilizar, adaptar e criar

| Item | Ação | Origem | Condição |
|---|---|---|---|
| Taxonomia de tópicos e “Common Mistakes” | **ADAPTAR** | S01 | Reescrever, corrigir as duas depreciações e remover R3F do recorte |
| Base de API r187 para cena, GLTF e materiais | **ADAPTAR** | S02 | Preservar `NOTICE` Apache-2.0; verificar contra o pacote instalado; não copiar o catálogo |
| Manifesto de evidência e métricas de canvas | **ESTUDAR e recriar** | S04, S11 | Não copiar scripts; implementar no runtime do Lia Forge |
| Contrato de ferramenta com revisão e export sem overwrite | **INSPIRAR** | S13 | Sem incorporar código; modelar em capability/adapter |
| State gate e quality contract | **INSPIRAR** | S07 | Pesquisa; não adotar pipeline |
| Referência de calibração de eixos/bbox | **CORRIGIR e recriar** | S08 | Substituir a regra `-Z` pelo spec glTF e pela semântica do three |
| Vocabulário visual e critérios de qualidade | **ESTUDAR** | S05, S10 | Não copiar código GPL; não copiar assets |
| Scaffold que recusa overwrite | **ESTUDAR** | S12 | React 19 e three 0.185.1 impedem uso direto |
| Skills first-party de importação, QA, materiais, animação, performance e Blender | **CRIAR** | Lia Forge | Uma por responsabilidade; manifesto completo; sem execução implícita |
| Registro de proveniência e licença por skill | **CRIAR** | Lia Forge | `source`, `commit`, `contentHash`, `license`, `threeRevision`, `verifiedAt`, `trust` |
| Verificador de drift de revisão | **CRIAR** | Lia Forge | Comparar declaração, `package.json` e APIs deprecadas conhecidas |
| Gate de execução para MCP/CLI | **CRIAR** | Lia Forge | Processo isolado, sem rede default, filesystem scoped, consentimento e logs |

---

## 6. Skills que o Lia Forge precisaria

A lista abaixo é um **catálogo proposto**, não implementado. Cada linha precisa de manifesto, fonte, licença, revisão e gate. O detalhamento de capabilities e fases está em [`17`](17-ROADMAP-INTEGRACAO-SKILLS.md).

| Skill proposta | Estágio | Capabilities exigidas | Gate humano | Offline | Fase |
|---|---|---|---|---|---|
| `lia-threejs-gltf-intake` | importar, validar | `model3d.inspect` | Não para leitura; sim para aceitar asset | Sim | 1 |
| `lia-threejs-scene-review` | visualizar, diagnosticar | `model3d.inspect`; `model3d.preview` quando existir | Não para leitura | Sim | 1–2 |
| `lia-threejs-visual-evidence` | capturar, comparar | `render3d.frame` ou captura do viewport | Sim para salvar versão | Parcial | 2 |
| `lia-threejs-material-lighting-review` | revisar materiais | `material.inspect` proposto; `material.pbr` planejado | Sim para alterar | Sim | 3 |
| `lia-threejs-motion-review` | revisar animação | `rig3d.inspect` proposto; `motion.cycles` | Sim para editar | Sim | 4 |
| `lia-threejs-performance-budget` | medir, alertar | telemetria do viewport | Não para medir | Sim | 2–3 |
| `lia-threejs-blender-boundary` | encaminhar | `render3d.frame`; `model3d.export` | Sim para abrir/exportar | Sim | 5 |
| `lia-threejs-skill-curation` | curadoria | nenhuma de asset | Sim para aprovar skill | Sim | 0–1 |

### 6.1 O que **não** criar agora

- Uma skill genérica de “faça gráficos bonitos”. Não tem critério verificável.
- Uma skill de “corrigir automaticamente o GLB”. Não existe ferramenta segura, diff ou gate.
- Uma skill de WebGPU/TSL como requisito. Não foi medida na RX 580.
- Uma skill de R3F. React 18.3.1 impede.
- Uma skill de VFX/partículas. Fora do v1 e o runtime candidato não aceita r187.

---

## 7. Como agentes usariam essas skills

A regra é a mesma do [`INTELLIGENT-ORCHESTRATOR.md`](../INTELLIGENT-ORCHESTRATOR.md): **o Orchestrator planeja e não executa**. A skill informa o plano; não autoriza ação.

| Agente ou componente | Papel | Usa skill para | Não pode |
|---|---|---|---|
| `IntakeAgent` | Classificar um GLB/glTF recebido | Ler extensões, escala, hierarquia, skins, clips e riscos | Instalar decoder, abrir rede, alterar asset |
| `SceneReviewAgent` | Explicar por que a cena está preta/errada | Aplicar checklist de cena, câmera, luz e cor | Editar geometria ou “consertar” silenciosamente |
| `MaterialAgent` | Revisar PBR, texturas e iluminação | Sugerir mudanças e apontar evidência ausente | Salvar material sem gate |
| `MotionAgent` | Revisar clipes, skeleton e loop | Detectar inconsistência, root motion e escala | Editar keyframes ou rig |
| `QAAgent` | Produzir evidência | Capturas, métricas, contato, comparação | Declarar “pronto” sem execução real |
| `SkillCuratorAgent` | Avaliar skill externa | Licença, proveniência, drift, segurança | Aprovar sozinho ou instalar |
| `Orchestrator` | Montar DAG de produção | Anexar skill e hash ao passo | Executar skill ou ferramenta |

### 7.1 Fluxo proposto para importar um GLB

1. O usuário registra o arquivo no projeto.
2. `IntakeAgent` chama `model3d.inspect` e lê o relatório estrutural.
3. A skill `lia-threejs-gltf-intake` produz um checklist: extensões, escala, eixos, animações, materiais, texturas ausentes.
4. O Orchestrator anexa a skill e o hash ao plano; nenhuma capability é executada.
5. Se houver viewport, `SceneReviewAgent` abre a cena em modo leitura e registra diagnóstico.
6. `QAAgent` captura, se o usuário autorizou; a captura é uma versão, não uma sobrescrita.
7. O humano decide: aceitar, pedir correção no Blender, ou rejeitar.

### 7.2 Fluxo proposto para uma skill externa

1. `SkillCuratorAgent` lê `SKILL.md`, licença, commit, data e dependências.
2. O sistema mostra fonte, versão, risco e o que seria executado.
3. O humano aprova **leitura**, **adaptação** ou **execução** separadamente.
4. Se aprovada, a skill é copiada para uma área de quarentena com `trust: unreviewed`.
5. Um teste de conteúdo e um teste de API r187 são executados em ambiente controlado.
6. Só então o estado pode ir para `reviewed-external`; nunca para `first-party` sem reescrita.

---

## 8. Matriz de decisão resumida

| Pergunta | Resposta desta pesquisa |
|---|---|
| Qual skill é a melhor referência de API r187? | `gamedev-skills` — três skills `threejs-*`, Apache-2.0. |
| Qual é a melhor taxonomia de tópicos? | `CloudAI-X` — 13 skills, MIT, mas r186 e com duas depreciações. |
| Qual é a melhor referência de QA visual? | `majidmanzarpour` e `open-3d-skills`, com ressalvas de versão e scripts. |
| Qual é a melhor referência de contrato de ferramenta? | `Kiln` — revisão, proveniência, export sem overwrite, status de renderer. |
| O que pode ser copiado agora? | Nada. Apenas leitura e curadoria. |
| O que está bloqueado? | `scottstts` (GPL), `webgpu` (sem licença), `skillspot` (sem proveniência). |
| O que está incompatível? | `NixieFX` (peer <0.186), R3F (React 19), `arch` (React 19 + 0.185.1). |
| O que está morto? | `Dexploarer/threejs-scene-builder` e a página Smithery. |
| O que falta criar? | Skills first-party, registro de proveniência, drift checker e gate de execução. |
| O que não muda? | O viewport não é Scene Composer; Three.js inspeciona; Blender autora; Lia Forge governa. |

---

## 9. Limitações da matriz

- A classificação é uma **recomendação técnica**, não uma decisão de produto.
- Estrelas e atividade são snapshot; não medem qualidade.
- Licença foi identificada por metadados e arquivo, não por parecer jurídico.
- Nenhum item foi executado; a coluna “Alvo Three” reflete declaração ou inspeção de configuração, não comportamento.
- A matriz não cobre todos os pacotes existentes; cobre os mandatórios, os alternativos relevantes e as ferramentas diretamente relacionadas.
- Um item marcado `DESCARTAR` pode ser reaberto apenas com fato novo: licença concedida, repositório restaurado, versão r187 publicada ou decisão humana explícita.

---

## 10. Fontes

As URLs, commits, versões e evidências de API estão em [`15`](15-ECOSSISTEMA-SKILLS-E-AGENTES.md) §2, §8, §12 e §13. Os critérios de curadoria e o roadmap estão em [`17`](17-ROADMAP-INTEGRACAO-SKILLS.md).
