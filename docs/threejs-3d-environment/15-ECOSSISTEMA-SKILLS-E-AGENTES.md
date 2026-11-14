# 15 — Ecossistema de skills, agentes e ferramentas de produção Three.js

> **Status:** `PESQUISA` em 2026-11-13. Este documento **não instala, não executa e não integra** nenhuma solução externa. Todos os estados abaixo são `observado no checkout`, `declarado pelo upstream` ou `não verificado`; nenhum é `instalado` ou `testado` no Lia Forge.

Este é o documento complementar da frente de ambiente 3D. Ele **não repete** a auditoria técnica de [`01`](01-AUDITORIA-ESTADO-ATUAL.md) a [`14`](14-CRITERIOS-DE-ACEITE.md): parte dos fatos já verificados em [`03`](03-PESQUISA-TECNICA-THREEJS.md) e responde a uma pergunta diferente: **quais skills, agentes e ferramentas de produção existem, o que cada um realmente entrega, e o que o Lia Forge pode aprender, adaptar ou recusar sem aumentar o escopo do viewport**.

A matriz comparativa fica em [`16-MATRIZ-SOLUCOES-SKILLS.md`](16-MATRIZ-SOLUCOES-SKILLS.md). O roadmap, o catálogo de skills próprias e os critérios de curadoria ficam em [`17-ROADMAP-INTEGRACAO-SKILLS.md`](17-ROADMAP-INTEGRACAO-SKILLS.md). As decisões humanas novas começam em **58** em [`../DECISIONS-AND-OPEN-QUESTIONS.md`](../DECISIONS-AND-OPEN-QUESTIONS.md).

---

## 1. Método e limites de evidência

### 1.1 O que foi feito

- Leitura das URLs obrigatórias da missão e das páginas de distribuição dos pacotes.
- Clonagem **somente de leitura** dos repositórios públicos em `/tmp`, sem `npm install`, sem instalar plugin, sem executar script, sem abrir MCP, sem renderizar e sem chamar provider.
- Contagem de arquivos, skills, referências, scripts e targets de versão por inspeção local.
- Comparação de APIs citadas nas skills com o pacote `three@0.187.0` já extraído em `/tmp/threecheck/package`.
- Consulta à API do GitHub e ao registry npm para licença, estrelas, forks, atividade e versão publicada.

### 1.2 O que **não** foi feito

- Nenhuma skill foi aplicada a um agente real.
- Nenhum script de QA, instalador ou MCP foi executado.
- Nenhum código gerado por `img2threejs`, `Kiln`, `NixieFX` ou pelos scaffolds foi compilado.
- Nenhum asset, modelo, textura, vídeo ou dataset foi copiado para o repositório.
- Nenhuma conclusão jurídica foi emitida: licença foi **identificada**, não **aprovada**.

### 1.3 Vocabulário usado

| Termo | Definição operacional neste documento |
|---|---|
| **Skill** | Conteúdo instrucional versionado, normalmente `SKILL.md` com frontmatter, referências e, às vezes, scripts opcionais. Não executa nada por si só. |
| **Pacote de skills** | Vários `SKILL.md` + referências + assets + scripts, distribuído por repositório, npm ou CLI. |
| **Agente** | Runtime que interpreta instruções e pode propor ou chamar ferramentas autorizadas. O agente não é a skill. |
| **Roteador** | Skill ou componente que escolhe quais skills carregar para uma tarefa. Não é um executor. |
| **Ferramenta** | CLI, biblioteca, runtime ou serviço que executa uma ação: validar, otimizar, renderizar, exportar, inspecionar. |
| **MCP** | Protocolo de tools expostas por um processo local ou remoto. É uma fronteira de execução, não um formato de conhecimento. |
| **Marketplace** | Página de descoberta e distribuição. Não é fonte de verdade de versão, licença ou conteúdo. |

O [`SKILLS-KNOWLEDGE-ENGINE.md`](../SKILLS-KNOWLEDGE-ENGINE.md) já fixa a regra que este documento assume: **skill é conhecimento e não executor**; uma skill não autoriza acesso a arquivo, instalação, chamada de API, envio de arquivo ou início de processo. O [`INTELLIGENT-ORCHESTRATOR.md`](../INTELLIGENT-ORCHESTRATOR.md) planeja e não executa. Nada nesta pesquisa muda essas fronteiras.

---

## 2. Cobertura das URLs obrigatórias

| URL | O que é | Achado principal | Uso permitido nesta fase |
|---|---|---|---|
| [`github.com/CloudAI-X/threejs-skills`](https://github.com/CloudAI-X/threejs-skills) | Repositório de 13 skills de conhecimento puro | MIT, 4.173 estrelas no snapshot, 6.090 linhas, alvo declarado **r186**, sem scripts. Duas APIs aparecem deprecadas no r187. | **ADAPTAR** conteúdo selecionado, com correções e atribuição. |
| [`promptsrush.com/marketplace/skills/threejs-skills`](https://promptsrush.com/marketplace/skills/threejs-skills) | Vitrine de terceiros do repositório acima | Lista **10** skills, não 13; afirma auditoria “r160+”; changelog de 2026-08-18; a página ainda diz que o README do upstream apontaria `pinkforest/threejs-playground`, mas o checkout atual aponta `CloudAI-X/threejs-skills`. | Apenas **descoberta**. Não é fonte de versão. |
| [`threejsresources.com/ai/skills`](https://threejsresources.com/ai/skills) | Índice editorial de skills | Cinco skills publicadas; tese correta de que WebGPU/TSL/pós-processamento são sensíveis à revisão e de que a revisão do `three` deve ser pinada junto da skill. | Apenas **descoberta** e critério editorial. |
| [`explainx.ai/skills/sickn33/antigravity-awesome-skills/threejs-skills`](https://explainx.ai/skills/sickn33/antigravity-awesome-skills/threejs-skills) | Página de distribuição do agregador `sickn33` | Conteúdo genérico com import map em `three@0.183.0`, `setAnimationLoop`, `CapsuleGeometry` e `OrbitControls`; instalável por CLI de skills. | Apenas **exemplo de formato**. Não é fonte curada. |
| [`pi.dev/packages/pi-skill-threejs-builder`](https://pi.dev/packages/pi-skill-threejs-builder) | Pacote de skill para o runner `pi` | MIT, 0 dependências, 75,6 KB, uma skill e cinco referências; pins em `three@0.160.0`; contém regra de orientação **incorreta**. | **PESQUISA** de referência frames e calibração, com correção obrigatória. |
| [`threejsresources.com/ai/skills/threejs-game-skills`](https://threejsresources.com/ai/skills/threejs-game-skills) | Página da skill de jogos | Aponta para `majidmanzarpour/threejs-game-skills`; nove skills, scaffold, QA com Playwright e APIs pagas opcionais. | **PESQUISA** de QA e direção de jogo. |
| [`smithery.ai/skills/Dexploarer/threejs-scene-builder`](https://smithery.ai/skills/Dexploarer/threejs-scene-builder) | Página de MCP/skill | Retorna **Not found**; o repositório no GitHub também retorna **404**. A pesquisa anterior registrou o encerramento do proxy/registry MCP da Smithery em 2026-10-31. | **DESCARTAR**. Não pesquisar de novo. |
| [`skillspot.dev/skills/community-threejs-webgl`](https://www.skillspot.dev/skills/community-threejs-webgl) | Listagem comunitária | Página genérica de “Three.js & WebGL”; não expõe upstream, licença, versão, commit ou conteúdo auditável. | **NÃO VERIFICÁVEL**. Não copiar. |
| [`github.com/img2threejs/img2threejs`](https://github.com/img2threejs/img2threejs) | Skill + CLI + pipeline Python | Apache-2.0, 21.321 estrelas, versão 2.0.1; gera fábrica TypeScript procedural a partir de imagem; GLB é alvo de emissão por plugin, não o produto principal. | **PESQUISA** apenas. |

**Resultado:** as nove URLs foram visitadas. Cinco não são fonte de conteúdo reutilizável: `promptsrush`, o índice `threejsresources`, `explainx`, `skillspot` e `smithery` (morta). As quatro restantes apontam para repositórios ou pacotes auditáveis: `CloudAI-X`, `pi.dev`, a página `threejsresources/threejs-game-skills` (que leva ao repositório `majidmanzarpour`) e `img2threejs`.

---

## 3. Panorama: o que existe de fato

### 3.1 Duas famílias que não devem ser confundidas

**Conhecimento puro.** `CloudAI-X` e os três `SKILL.md` do subconjunto Three.js de `gamedev-skills` são conteúdo instrucional com referências. Não têm runtime, não instalam nada e não executam nada. O risco dominante é **conteúdo desatualizado ou instrução enganosa**, não execução.

**Pacotes com ferramenta.** `majidmanzarpour`, `img2threejs`, `NixieFX`, `Kiln`, `open-3d-skills`, `3dviz-pro-max` e `threejs-architecture-effects` incluem scripts, scaffolds, runtimes, MCP ou providers. O risco dominante é **execução, dependência, rede e licença**, não apenas texto.

### 3.2 Números do snapshot

| Solução | Tipo | Licença | Alvo Three.js declarado | Estrelas | Último push | Tamanho do checkout |
|---|---|---|---:|---:|---|---:|
| `CloudAI-X/threejs-skills` | 13 skills, conhecimento puro | MIT | r186 | 4.173 | 2026-10-19 | 352 KB |
| `gamedev-skills/awesome-gamedev-agent-skills` | 79 skills + roteador; 3 de Three.js | Apache-2.0 | **r187** | 8.768 | 2026-11-12 | 5,2 MB |
| `majidmanzarpour/threejs-game-skills` | 9 skills de jogo + scaffold + QA | MIT | `^0.184.0` | 2.810 | 2026-09-28 | 913 KB |
| `scottstts/Threejs-Awesome-Graphics-Agent-Skills` | 24 skills de gráficos | **MIT AND GPL-3.0-only** | `^0.185.1`, testa 0.186.1 | 990 | 2026-10-22 | 187 MB |
| `dgreenheck/webgpu-claude-skill` | 1 skill de WebGPU/TSL | **nenhuma** | r183 | 1.284 | 2026-04-10 | 208 KB |
| `img2threejs/img2threejs` | Skill + CLI + pipeline Python | Apache-2.0 | constantes de 0.169.0 | 21.321 | 2026-11-05 | 5,6 MB |
| `picassio/pi-skill-threejs-builder` | 1 skill + 5 referências | MIT | 0.160.0 | 3 | 2026-07-13 | 108 KB |
| `azakhary/nixie-fx` | Runtime + editor + CLI + 2 skills | MIT | peer `>=0.184 <0.186` | 27 | 2026-11-05 | 6,7 MB |
| `viettranx/3dviz-pro-max` | 1 skill + kits + exemplos | MIT | 0.180 | 1.283 | 2026-09-11 | 87 MB |
| `Moh4696/open-3d-skills` | 8 skills | MIT | 0.169.0 | 367 | 2026-11-09 | 2,0 MB |
| `lhlGitHub/threejs-architecture-effects` | 1 skill + starter React 19 | MIT | 0.185.1 | 729 | 2026-09-22 | 26 MB |
| `instruktlabs/kiln` | MCP + CLI + SDK + render + GLB | MIT | **0.187.0** | 327 | 2026-11-13 | 167 MB |
| `sickn33/agentic-awesome-skills` | Agregador de milhares de skills | MIT | exemplo em r183 | 49.668 | 2026-11-12 | 463 MB (API, não clonado) |
| `AftabIbrahimKazi/ai-dev-kit` | Kit genérico de skills | MIT | não específico | 10 | 2026-11-11 | 5,0 MB |

Salvo indicação em contrário, os tamanhos são do checkout baixado, não do pacote npm. Estrelas e forks são um retrato de 2026-11-13 e mudam; não são critério de qualidade. `gamedev-skills` e `Kiln` são os únicos itens com alvo **r187.0** explícito no snapshot.

---

## 4. Soluções recomendadas para curadoria

### 4.1 `gamedev-skills/awesome-gamedev-agent-skills` — o subconjunto Three.js r187

**O que é.** Catálogo Apache-2.0 com 79 skills e um roteador para 12 engines. O Lia Forge só se interessa por **três** skills em `skills/web-engines/`:

- [`threejs-scene-setup`](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/web-engines/threejs-scene-setup): `Scene`, `PerspectiveCamera`, `WebGLRenderer`, `setAnimationLoop`, `Timer`, resize, `OrbitControls`, WebGPU como opção.
- [`threejs-gltf-loading`](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/web-engines/threejs-gltf-loading): `GLTFLoader`, Draco, Meshopt, KTX2, `AnimationMixer`, `SkeletonUtils`.
- [`threejs-materials-lighting`](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/web-engines/threejs-materials-lighting): PBR, luzes, sombras, IBL, tone mapping, `OutputPass`.

O [`EXTERNAL-REPOSITORY-RESEARCH.md`](../EXTERNAL-REPOSITORY-RESEARCH.md) já cobre esse catálogo em nível de formato e de `create-game-assets`; esta seção **não repete** essa auditoria. Ela isola o subconjunto Three.js **r187** e registra o que mudou no snapshot: 79 skills, verificação de 2026-11-11 e três skills `threejs-*`.

**Evidência de qualidade.** As três skills somam 1.059 linhas com referências. O `VERSION-SUPPORT.md` do repositório declara `three.js r187 (npm 0.187.0)`, verificado em 2026-11-11, e as skills citam explicitamente mudanças de r180, r183, r185, r186 e r187. Exemplos: `Clock` substituído por `Timer`; `RGBELoader` substituído por `HDRLoader`; `DRACOLoader` e `KTX2Loader` com decoders padrão desde r185; PMREM reconstruído em cube render targets no r187. Isso é **muito mais próximo** do alvo do Lia Forge do que o r186 do CloudAI-X.

**Limites.** São apenas três tópicos; não cobrem animação autoral, rigging, shader customizado, otimização de malha, Blender ou QA visual. O catálogo inteiro é de jogos, com dezenas de skills fora do escopo. A licença Apache-2.0 permite adaptação com `NOTICE`, mas o projeto ainda precisa decidir se **copia** texto ou **reescreve** o procedimento com atribuição.

**Classificação:** `ADAPTAR` os três tópicos, com reescrita e verificação contra r187; não instalar o catálogo inteiro.

### 4.2 `CloudAI-X/threejs-skills` — a taxonomia mais completa de conhecimento puro

**O que é.** Treze skills, 6.090 linhas, sem nenhum script: fundamentos, geometria, materiais, texturas, iluminação, loaders, animação, interação, performance, pós-processamento, shaders, asset pipeline e React Three Fiber.

**Evidência.** MIT; 13 `SKILL.md`; 14 arquivos no total; nenhum arquivo executável. A skill de fundamentos acerta a semântica de orientação (`Object3D.getWorldDirection` é +Z; câmeras retornam −Z), o que é relevante porque outras skills erram isso. A skill de pós-processamento já usa `RenderPipeline` e explica a migração de `PostProcessing` no r183.

**Drift r186 → r187 observado.** Duas ocorrências precisam de correção antes de qualquer adaptação:

| Arquivo | Ocorrência | Estado real no r187 |
|---|---|---|
| `skills/threejs-lighting/SKILL.md:441` | `renderer.library.addLight(SunLightNode, SunLight)` | `NodeLibrary.addLight()` está **deprecado desde r187**; o caminho novo é `Light.registerNode()`. Ainda funciona com aviso, não foi removido. |
| `skills/threejs-materials/SKILL.md:168` | `iridescenceThicknessRange: [100, 400]` | A propriedade está **deprecada desde r187**; usar `iridescenceThicknessMinimum` e `iridescenceThicknessMaximum`. O getter/setter antigo ainda existe com aviso. |

Isso não torna a skill “quebrada”: esses dois trechos ainda rodam no r187, mas emitem depreciação. Também não autoriza dizer que “r186 funciona em r187” sem varredura. A conclusão correta é: **funciona com avisos e exige patch**, não “é compatível”.

**Limites.** Não tem QA executável, não tem amostras de GLB, não cobre Blender e mistura React Three Fiber na configuração que documenta (R3F 9.8 / drei 10.7), que exige React 19 e é **incompatível** com o React 18.3.1 atual. A skill de R3F deve ser removida do recorte, não adaptada agora.

**Classificação:** `ADAPTAR` a taxonomia e os checklists; `DESCARTAR` a skill de R3F nesta fase.

### 4.3 O que é “recomendado” aqui

Nenhuma das duas é recomendada como **dependência**. A recomendação é de **curadoria de conhecimento**:

1. usar o subconjunto r187 do `gamedev-skills` como base de verificação de API;
2. usar a taxonomia do `CloudAI-X` como mapa de tópicos e de “erros comuns”;
3. reescrever o conteúdo em skills first-party, com `source`, `license`, `commit`, `contentHash`, `threeRevision` e `verifiedAt`, sem copiar blocos inteiros sem revisão;
4. manter as skills externas como **referência**, não como runtime.

---

## 5. Alternativas que merecem avaliação, mas não adoção imediata

### 5.1 `majidmanzarpour/threejs-game-skills`

**O que faz.** Nove skills de jogo, incluindo um `threejs-game-director` que roteia especialistas, `threejs-aaa-graphics-builder`, `threejs-qa-release`, `threejs-debug-profiler`, `threejs-game-ui-designer`, `threejs-gameplay-systems` e geradores que chamam Tripo, Gemini e ElevenLabs. Inclui scaffold Vite + TypeScript + Three.js, hooks determinísticos, RNG com seed e templates Playwright.

**O que interessa ao Lia Forge.** O **modelo de evidência**: manifesto de capturas, inspeção de pixels do canvas, métricas de draw calls/triângulos/texturas, orçamentos desktop/mobile, relatório de release e separação entre “passou nos pixels” e “qualidade estética”. Isso conversa diretamente com o QA do Lia Forge, mas é mais ambicioso do que a Fase 1 permite.

**Riscos.** Alvo `^0.184.0`, não r187. Sete scripts e dependências de desenvolvimento (`@playwright/test`, `pngjs`), a varredura bruta encontrou 427 menções a variáveis de API/chaves, três `npm install`, três `rm -rf` e cinco `eval`/`child_process` no texto ou nos scripts. O diretor depende de APIs pagas opcionais; sem chave, promete cair para procedural, mas isso não foi testado. O escopo é jogo, não inspeção de asset.

**Classificação:** `PESQUISA` para QA e direção; **não copiar scripts** sem revisão de segurança e adaptação ao runtime do Lia Forge.

### 5.2 `scottstts/Threejs-Awesome-Graphics-Agent-Skills`

**O que faz.** Vinte e quatro skills de gráficos sofisticados: oceano espectral, nuvens volumétricas, atmosfera, SSAO, bloom, exposição/color grading, materiais procedurais, geometria procedural, validação visual. Inclui uma galeria de exemplos grande e um verificador de “frescor” do Three.js.

**O que interessa.** É a referência mais rica em **vocabulário visual** e em critérios de “o que faz uma cena parecer boa”. A skill `threejs-visual-validation` tem capturas fixas, mosaicos de diagnóstico, sweeps e evidência temporal — ideias úteis para o QA visual do Lia Forge.

**Riscos.** Licença de pacote **MIT AND GPL-3.0-only**, com materiais GPL-3.0 em pelo menos três skills (chuva/puddle, areia deformável, denim). O repositório tem 187 MB e 61 `curl`, 46 `npx`, 4 `wget` no conteúdo. Alvo `^0.185.1`, com teste em 0.186.1, não r187. Copiar código ou shader de uma skill GPL contamina a licença; copiar assets é pior.

**Classificação:** `ESTUDAR` a linguagem visual e a estrutura de validação; **bloqueado para código** até auditoria por arquivo e decisão jurídica.

### 5.3 `Moh4696/open-3d-skills`

**O que faz.** Oito skills para sites 3D: cena Three.js procedural, filme por scroll, vídeo com alpha, cursor rig, exploded view, captura de frames, checagem em navegadores reais e assets de movimento. O `site-check` cobre Chromium e WebKit, mede frame time, draw calls, triângulos, erros de página, requests falhos, canvas em branco e overflow; o `frame-capture` usa relógio virtual para gravar 60 fps determinístico.

**O que interessa.** O `site-check` é a melhor referência pública, entre as auditadas, para **QA visual com navegador real** sem depender de um modelo. O `frame-capture` é uma ideia forte para comparação A/B de capturas.

**Riscos.** Alvo 0.169.0, bem defasado; 50 arquivos e 15 `pip install`, 9 `npx`, 18 menções a chaves/API; scripts de navegador e vídeo. Não é específico de inspeção de GLB. A licença MIT é favorável, mas a distância de versão é grande.

**Classificação:** `PESQUISA` para QA e captura; não adotar o starter nem os scripts agora.

### 5.4 `viettranx/3dviz-pro-max`

**O que faz.** Uma skill grande de visualização 3D criativa, com workflow de dez passos, catálogo pesquisável, kits Three.js, templates executáveis, capture helper e exemplos com Blender bake. Cobre raciocínio sobre o objeto, escala, composição, materiais, iluminação e validação visual.

**O que interessa.** A disciplina de **raciocinar sobre o objeto antes de escolher o template** e a separação entre “ilustração”, “simulação” e “playback” são boas para o futuro Skills Engine. Também declara explicitamente que capturas de exemplo não são benchmark e que a proveniência importa.

**Riscos.** Alvo 0.180; 87 MB; 1.468 arquivos de texto inspecionados; 63 `curl`, 9 `pip install`; exemplos com Blender. O volume e a idade tornam a adaptação cara.

**Classificação:** `PESQUISA` de método; não é base de código.

### 5.5 `lhlGitHub/threejs-architecture-effects`

**O que faz.** Uma skill de construção arquitetônica procedural (tijolos, madeira, dougong, beirais, materiais PBR) com timeline 0–1, câmeras de detalhe e starter Vite + React + Three.js. O scaffold copia o starter e **recusa sobrescrever**; não instala nem inicia servidor.

**O que interessa.** A recusa de overwrite e a ideia de uma timeline determinística com scrub são boas práticas. O tema é nichado.

**Riscos.** Usa React 19.2.6 e three 0.185.1; incompatível com o React 18.3.1 do Lia Forge e fora do alvo r187. É uma skill de autoria visual, não de inspeção.

**Classificação:** `ESTUDAR` como exemplo de scaffold seguro; **não aplicável** ao runtime atual.

### 5.6 `instruktlabs/kiln`

**O que faz.** Runtime local + CLI + SDK + servidor MCP que permite a um agente escrever JavaScript com helpers de geometria e material; o Kiln executa o programa, devolve vistas renderizadas e checagens estruturais, mantém `programRef` por revisão e exporta GLB. Tem biblioteca local de assets, histórico de revisão, perfis de exportação e `kiln_export_to` que **nunca substitui arquivo**. O renderer distingue rota GPU/CPU, `viewFidelity` e fallback; a busca de catálogo é offline.

**O que interessa.** É o exemplo mais alinhado ao Lia Forge em **contrato de ferramenta**: revisão exata, proveniência, exportação que não sobrescreve, descoberta de capacidades, status de renderer e distinção entre “geometria” e “evidência de material”. Também é o único item auditado, além do `gamedev-skills`, com `three@0.187.0` no `package.json`.

**Riscos.** O próprio `SECURITY.md` diz que o subprocesso de avaliação **não é um sandbox completo**. O repositório tem 587 ocorrências de `eval`/`Function`/`child_process`, 1.266 menções a env/API keys, 113 `curl` e 60 `npm install`. Executa JavaScript gerado por agente, grava arquivos e pode iniciar um renderer local. É uma ferramenta de execução, não uma skill; não pode ser tratada como conteúdo inofensivo.

**Classificação:** `PESQUISA` e candidato a **provider/adaptor externo** no futuro, atrás de gate de execução; **não integrar** sem decisão 60.

---

## 6. Pesquisa adicional, com valor limitado ou bloqueio

### 6.1 `img2threejs/img2threejs`

**O que faz.** Reconstrói um objeto ou personagem de uma imagem como **fábrica TypeScript procedural** de Three.js, com pipeline em estágios (`blockout → structural → form → material → surface → lighting → interaction → optimization`), contratos de qualidade, inventário de detalhes, state local, validação por script e revisão por visão do agente. O GLB aparece como **alvo de emissão por plugin** (`--target glb`), com verificação de magic/tamanho/localização; não é o formato principal de autoria.

**O que interessa.** O modelo de `qualityContract`, o state gate local, a separação entre “spec” e “código”, o inventário de detalhes e a noção de que uma feature identitária não pode ser mascarada por um score global são excelentes para o futuro Skills Engine e para QA de modelo 3D.

**Riscos.** O alvo declarado nas constantes é `three@0.169.0`; o código gerado usa `WebGLRenderer` e `three/examples/jsm`, e não foi validado em r187. O pipeline depende de agente multimodal, browser, Python 3.10+ stdlib, e plugins que podem chamar serviços remotos. O instalador npm publicado é `img2threejs@0.2.0` (73 KB), enquanto o repositório está em 2.0.1; são artefatos diferentes. Apache-2.0 é favorável, mas o custo de adaptação é alto.

**Classificação:** `PESQUISA` apenas. Não é uma skill de inspeção; é uma fábrica de código.

### 6.2 `picassio/pi-skill-threejs-builder`

**O que faz.** Skill de uma página para criar apps Three.js, com referências de GLTF, reference frames, game patterns, tópicos avançados e Capacitor iOS. Inclui `gltf-calibration-helpers.mjs` (eixos, bbox, seta de forward, label sprite) e um instalador Python stdlib.

**O que interessa.** A ideia de **calibrar o forward por asset** e de visualizar eixos/bbox é útil, especialmente para importação de GLB. A referência de Capacitor iOS é fora do escopo atual, mas documenta um caminho mobile.

**Riscos.** Pins em `three@0.160.0`; 75,6 KB no pacote npm; zero dependências; 3 estrelas. Contém um erro factual grave: afirma que “GLTF models face -Z by default” e que “Object3D forward é -Z”. O spec glTF 2.0 §3.4 define **+Z forward**, e o `Object3D.getWorldDirection` do three retorna a coluna +Z da matriz; só `Camera.getWorldDirection` nega para −Z. A regra não pode ser propagada.

**Classificação:** `PESQUISA` de calibração; **não copiar a regra de orientação**.

### 6.3 `dgreenheck/webgpu-claude-skill`

**O que faz.** Skill de WebGPU/TSL para Claude Code e Cursor, com 1 `SKILL.md`, `REFERENCE.md`, sete documentos e exemplos de setup, materiais, compute shaders, pós-processamento, WGSL e device loss.

**O que interessa.** É o material mais completo de TSL/WebGPU entre os auditados, com migrações de r171, r177, r178, r180, r181, r182 e r183.

**Riscos.** **Não há `LICENSE`** no repositório e a API do GitHub retorna `license: null`. Sem licença, não há direito de copiar, adaptar ou redistribuir. Além disso, está parado desde 2026-04-10 e declara alinhamento com r183; não cobre r187. WebGPU também não é requisito do v1 e não foi medido na RX 580.

**Classificação:** **BLOQUEADO por licença**; `PESQUISA` somente se o autor conceder licença explícita e se WebGPU entrar no escopo.

### 6.4 `azakhary/nixie-fx`

**O que faz.** Runtime de partículas/VFX determinístico com adaptadores PixiJS e Three.js, editor, CLI, export bundle e duas skills (`nixie-fx-authoring`, `nixie-fx-runtime`). O Three.js é o backend canônico.

**O que interessa.** O contrato de export bundle, `export-status` read-only com estados `exported/stale/unexported/orphaned`, hashes por efeito e separação entre projeto editável e artefato de jogo são boas referências para o domínio de assets.

**Riscos.** O peer de Three.js é `>=0.184.0 <0.186.0`: **não aceita r187**. É um runtime, não uma skill; adiciona dependência, editor e pipeline próprios. VFX está fora do v1.

**Classificação:** `PESQUISA` para pós-fase 5; **incompatível** com o alvo atual.

---

## 7. Descartadas, não verificáveis ou de baixo valor

| Solução | Motivo do descarte | O que ainda pode ser aproveitado |
|---|---|---|
| `Dexploarer/threejs-scene-builder` | GitHub 404; Smithery “Not found”; serviço de registry MCP encerrado em 2026-10-31. | Nada. Não pesquisar de novo. |
| `sickn33/agentic-awesome-skills` como fonte | Agregador com 49.668 estrelas e milhares de skills; exemplo Three.js em r183; sem curadoria própria verificável; o nome antigo `antigravity-awesome-skills` foi renomeado. | Apenas **descoberta** e formato de instalação cross-agent. |
| `promptsrush.com/marketplace/skills/threejs-skills` | Lista 10 skills de um repositório que tem 13; “auditado r160+” é claim antigo; aponta clone diferente do upstream. | Descoberta; nada de versão. |
| `explainx.ai/.../threejs-skills` | Distribuição do agregador; conteúdo genérico em r183. | Exemplo de frontmatter e comando de instalação. |
| `skillspot.dev/skills/community-threejs-webgl` | Sem upstream, licença, versão, commit ou conteúdo; página gerada. | Nada verificável. |
| `AftabIbrahimKazi/ai-dev-kit` | Kit genérico de coding standards e MCP; 10 estrelas; não é Three.js. | Nada específico de 3D. |
| `threejsresources.com/ai/skills` como fonte | Índice editorial, não repositório; útil para descobrir, não para copiar. | A regra editorial de pinar a revisão do `three`. |

**Nota sobre o `sickn33`:** o volume não é qualidade. Um agregador pode ser útil para descobrir nomes e formatos, mas não fornece proveniência por skill, nem testa o conteúdo contra a revisão instalada. Usá-lo como “fonte” seria exatamente o `unknown` disfarçado que o projeto rejeita.

---

## 8. Compatibilidade real com `three@0.187.0`

### 8.1 O que foi verificado no pacote

O pacote `three@0.187.0` foi extraído em `/tmp/threecheck/package` e comparado com as APIs citadas. Resultados:

| Alegação ou API | Evidência no r187 | Classificação |
|---|---|---|
| `Timer` substitui `Clock` | `src/core/Timer.js` exporta `Timer`; `Clock` é deprecated e ainda exportado. | **Correta**; `Timer.update()` existe. |
| `Object3D.getWorldDirection` retorna +Z | `src/core/Object3D.js:1049-1057` lê `e[8], e[9], e[10]` da matriz world. | **Correta**; `Camera` nega em `src/cameras/Camera.js:106-109`. |
| glTF usa +Z como forward | Spec glTF 2.0 §3.4: right-handed, +Y up, +Z forward, −X right; frente do asset em +Z. | **Correta**; a skill `pi` contradiz o spec. |
| `DRACOLoader` e `KTX2Loader` acham decoders sem path desde r185 | `DRACOLoader.js:17-19,67-70` define URLs padrão via `new URL`; `KTX2Loader.js:106-107` idem para basis. | **Correta**, com ressalva de bundler. |
| `NodeLibrary.addLight` foi removido | `src/renderers/common/nodes/NodeLibrary.js:120-143` marca **deprecated since r187**, não removido; ainda delega para `Light.registerNode`. | **Parcialmente correta**; é depreciação, não remoção. |
| `iridescenceThicknessRange` foi removido | `MeshPhysicalMaterial.js:603-620` mantém getter/setter deprecated que mapeia para `iridescenceThicknessMinimum` e `Maximum`. | **Parcialmente correta**; é depreciação, não remoção. |
| `pixelationPass` mudou de assinatura | `PixelationPassNode.js:225` ainda é `(scene, camera, pixelSize, normalEdgeStrength, depthEdgeStrength)`. | **Sem quebra observada** nesta assinatura. |
| `RoomEnvironment` não recebe renderer | `RoomEnvironment.js:35` tem `constructor()` sem parâmetros. | **Correta** desde r184. |
| `PostProcessing` virou `RenderPipeline` | Skill do CloudAI já usa `RenderPipeline`; migração declarada no r183. | **Correta**. |

### 8.2 O que isso significa

- **Não existe compatibilidade automática r186 → r187.** Duas APIs citadas pelo CloudAI-X estão deprecadas, não removidas; o código roda com warnings, mas a skill não pode ser marcada “r187” sem patch.
- **A alegação “r187” do `gamedev-skills` é a mais confiável do conjunto**, porque o repositório declara verificação em 2026-11-11 e cita as mudanças do r187. Ainda assim, é uma declaração do upstream, não um teste do Lia Forge.
- **A alegação “r187” não deve ser inferida de uma versão próxima.** `NixieFX`, `scottstts`, `majid`, `open-3d-skills`, `3dviz`, `arch`, `pi` e `img2threejs` estão todos em revisões anteriores. O `Kiln` está em 0.187.0, mas é uma ferramenta, não uma skill.
- **A única forma de elevar o estado para “testado”** é executar o exemplo em um ambiente controlado e registrar comandos, saída e revisão. Isso não foi feito nesta missão.

---

## 9. Segurança, licença e redistribuição

### 9.1 Riscos por tipo de pacote

| Risco | Onde aparece | Controle mínimo antes de qualquer uso |
|---|---|---|
| Prompt injection em `SKILL.md` | Todos os pacotes de texto; especialmente agregadores e marketplaces | Tratar como dado não confiável; renderizar sem executar; detectar instruções de segredo, download, desativação de gate e escrita fora do projeto. |
| Execução de script não auditado | `majid`, `img2threejs`, `open-3d-skills`, `Kiln`, `3dviz`, `NixieFX` | Processo separado, filesystem scoped, sem rede por padrão, limites de tempo/memória, consentimento explícito, log e kill switch. |
| Instalação e dependências | `npx skills add`, `npm install`, Playwright, Python, MCP | Nunca instalar automaticamente; declarar dependências; revisar `postinstall`; permitir desinstalação e rollback. |
| Rede e chaves de API | `majid` (Tripo/Gemini/ElevenLabs), `img2threejs` (plugins), `3dviz`, `open-3d-skills` | Default offline; chave nunca em código de browser; consentimento por chamada; orçamento e limite de tentativas. |
| Cópia de código restrito | `scottstts` (GPL), `webgpu` (sem licença) | Bloquear cópia; auditoria por arquivo; parecer jurídico; notices. |
| Asset com direitos próprios | `scottstts`, `3dviz`, `arch`, `Kiln`, `img2threejs` | Licença do repositório não cobre automaticamente modelos, texturas, HDRs, vídeos ou outputs de provider. |
| Sobrescrita e path traversal | Scaffolds e exportadores | Escrever apenas em diretório novo; recusar overwrite; validar caminho; exportação nunca substitui original. |
| Drift de versão | Quase todos | Declarar revisão alvo e data; testar contra o pacote instalado; não aceitar “compatível” sem verificação. |

### 9.2 Licenças identificadas

| Licença | Itens | Situação para o Lia Forge |
|---|---|---|
| MIT | CloudAI-X, majid, pi, NixieFX, 3dviz, open-3d-skills, arch, Kiln, sickn33, ai-dev-kit | Compatível para adaptação com copyright e permissão; assets e outputs têm termos próprios. |
| Apache-2.0 | gamedev-skills, img2threejs | Compatível para adaptação; exige `NOTICE` e preservação de avisos; revisar patentes e dependências. |
| MIT AND GPL-3.0-only | scottstts | **Bloqueado para código** sem auditoria por arquivo; GPL impõe obrigações ao combinado. |
| Nenhuma licença identificada | webgpu-claude-skill | **Bloqueado**: todos os direitos reservados por padrão; não copiar, adaptar nem redistribuir. |
| Não verificável | skillspot, promptsrush, explainx | Não usar como fonte de conteúdo; apenas descoberta. |
| Desconhecida ou morta | Dexploarer, Smithery | Descartar. |

**Regra prática:** a licença do repositório não cobre automaticamente o modelo, a textura, o HDR, o vídeo, o áudio, o output do provider ou o asset de exemplo. O `THIRD_PARTY_NOTICES.md` do Lia Forge teria de ser alimentado por componente, com URL, commit, licença e hash — exatamente o que o [`SKILLS-KNOWLEDGE-ENGINE.md`](../SKILLS-KNOWLEDGE-ENGINE.md) propõe.

---

## 10. O que o Lia Forge deve aprender com isso

### 10.1 O que não fazer

- Não adicionar `three` como dependência só porque uma skill existe. O viewport ainda não foi implementado.
- Não instalar `npx skills add`, nem copiar dezenas de `SKILL.md` para `.agents/skills`, nem tratar um marketplace como catálogo aprovado.
- Não promover uma skill externa a “capacidade” do Hub. Skill não é capability.
- Não declarar “funciona em r187” porque o README diz r187. A verificação é no pacote e no comportamento.
- Não usar `img2threejs`, `Kiln` ou `NixieFX` como se fossem bibliotecas internas. São ferramentas externas com licença, execução e manutenção próprias.
- Não importar a skill de React Three Fiber enquanto o runtime estiver em React 18.3.1.

### 10.2 O que vale a pena

1. **Taxonomia de tópicos** do CloudAI-X, reescrita e corrigida para r187.
2. **Três skills r187** do `gamedev-skills` como base de verificação de API e de “common mistakes”.
3. **Modelo de evidência** do QA do `majid` e do `site-check` do `open-3d-skills`: captura, métricas, manifesto, comparação e reprodutibilidade.
4. **Modelo de contrato de ferramenta** do `Kiln`: revisão exata, `programRef`, exportação que não sobrescreve, status de renderer, separação entre geometria e fidelidade de material.
5. **Modelo de curadoria** do `gamedev-skills`: versão declarada, data de verificação, roteador e testes de trigger.
6. **Modelo de state gate** do `img2threejs`: checklist local, evidência por estágio, contrato de qualidade e correção limitada.
7. **Referência de calibração** do `pi`, corrigida contra o spec glTF e a semântica do three.

### 10.3 O que precisa ser criado dentro do Lia Forge

- Skills first-party para importação de GLB, QA visual, materiais/iluminação, animação, performance e fronteira com Blender.
- Um registro de proveniência por skill (`source`, `commit`, `contentHash`, `license`, `threeRevision`, `verifiedAt`, `trust`).
- Um verificador de drift que compara a revisão declarada com a versão instalada e sinaliza depreciações conhecidas.
- Um gate de execução para ferramentas externas, separado do Skills Engine.
- Critérios de aceite de curadoria, não apenas “a skill carregou”.

O detalhamento está em [`17`](17-ROADMAP-INTEGRACAO-SKILLS.md).

---

## 11. Limitações desta pesquisa

1. **Nenhuma skill foi executada.** O estado máximo é `observado` ou `declarado`.
2. **Não há GPU, navegador real ou Windows neste ambiente.** Nada sobre render, cor, performance ou WebGPU foi medido.
3. **A comparação de API foi pontual, não exaustiva.** Duas depreciações e algumas semânticas foram verificadas; não é uma auditoria linha a linha de 6.090 + 1.059 linhas.
4. **O snapshot é de 2026-11-13.** Estrelas, commits, issues e versões mudam. Todo uso futuro precisa reconferir commit e licença.
5. **Não houve revisão jurídica.** A classificação de licença é técnica e conservadora, não parecer legal.
6. **Os clones foram de leitura.** Nada foi instalado; nenhum `node_modules`, build, render ou asset entrou no repositório.
7. **`scottstts`, `3dviz`, `arch` e `Kiln` são grandes.** O tamanho foi medido, mas não foi feita auditoria completa de cada arquivo.
8. **O `skillspot` não expõe proveniência.** A ausência de licença e de upstream foi tratada como bloqueio, não como permissão.

---

## 12. Evidências executadas

| Verificação | Comando ou método | Resultado |
|---|---|---|
| Estado do repositório | `git status`, `git log -1`, `git diff --check` | Árvore limpa antes da edição; nenhuma alteração de código de produção |
| Metadados, licença e atividade | API `api.github.com/repos/<owner>/<repo>` para 14 repositórios | Stars, forks, licença, created/pushed, tamanho e `license.spdx_id` registrados |
| Conteúdo dos pacotes | `codeload.github.com/<owner>/<repo>/tar.gz/refs/heads/main` em `/tmp`, sem `npm install` | 13 checkouts de leitura; nenhum script executado |
| Contagem de skills e referências | `find ... -name SKILL.md`, `wc -l`, `find ... -maxdepth` | 13 CloudAI; 79 gamedev, 3 Three; 9 majid; 24 scott; 1 webgpu; 1 img2; 1 pi; 2 nixie; 1 3dviz; 8 open3d; 1 arch |
| Versões e licenças npm | `registry.npmjs.org/<pacote>/latest` para `three`, `img2threejs`, `@img2threejs/img2`, `pi-skill-threejs-builder`, `nixie-fx`, `@gltf-transform/cli`, `gltfpack`, `gltf-validator`, `@google/model-viewer`, `spectorjs` | Versões, licenças e tamanho descompactado registrados |
| Compatibilidade r187 | `grep -n` em `/tmp/threecheck/package/src` e `examples/jsm` | `addLight` e `iridescenceThicknessRange` deprecated; `Timer`, `Object3D.getWorldDirection`, `DRACOLoader` e `KTX2Loader` confirmados |
| Cobertura das URLs | `fetch_page` e `curl` para as nove URLs obrigatórias | 9 de 9 visitadas; 5 não são fonte reutilizável; 1 morta |
| Varredura de conteúdo | contagem bruta de `curl`, `wget`, `npm install`, `npx`, `pip install`, `sudo`, `rm -rf`, `eval`, `child_process`, chaves e URLs | Números usados como **sinal**, não como prova de vulnerabilidade |
| Execução de skill, CLI, MCP ou render | nenhum comando executado | Estado permanece `não testado` |

**O que não é evidência:** README, badge, estrela, screenshot, demo pública, claim de “auditado” ou lista de marketplace. Nenhum desses foi usado para afirmar compatibilidade ou qualidade.

## 13. Fontes principais

### Repositórios e páginas

- [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills)
- [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
- [gamedev-skills — version support](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/docs/VERSION-SUPPORT.md)
- [gamedev-skills — threejs-glTF loading](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/web-engines/threejs-gltf-loading)
- [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills)
- [scottstts/Threejs-Awesome-Graphics-Agent-Skills](https://github.com/scottstts/Threejs-Awesome-Graphics-Agent-Skills)
- [dgreenheck/webgpu-claude-skill](https://github.com/dgreenheck/webgpu-claude-skill)
- [img2threejs/img2threejs](https://github.com/img2threejs/img2threejs)
- [picassio/pi-skill-threejs-builder](https://github.com/picassio/pi-skill-threejs-builder)
- [pi.dev — pi-skill-threejs-builder](https://pi.dev/packages/pi-skill-threejs-builder)
- [azakhary/nixie-fx](https://github.com/azakhary/nixie-fx)
- [viettranx/3dviz-pro-max](https://github.com/viettranx/3dviz-pro-max)
- [Moh4696/open-3d-skills](https://github.com/Moh4696/open-3d-skills)
- [lhlGitHub/threejs-architecture-effects](https://github.com/lhlGitHub/threejs-architecture-effects)
- [instruktlabs/kiln](https://github.com/instruktlabs/kiln)
- [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills)
- [AftabIbrahimKazi/ai-dev-kit](https://github.com/AftabIbrahimKazi/ai-dev-kit)
- [SkillSpot — Three.js & WebGL](https://www.skillspot.dev/skills/community-threejs-webgl)
- [PromptSRush — threejs-skills](https://promptsrush.com/marketplace/skills/threejs-skills)
- [Three.js Resources — AI skills](https://threejsresources.com/ai/skills)
- [ExplainX — threejs-skills](https://explainx.ai/skills/sickn33/antigravity-awesome-skills/threejs-skills)
- [Smithery — Dexploarer/threejs-scene-builder](https://smithery.ai/skills/Dexploarer/threejs-scene-builder)
- [Dexploarer/threejs-scene-builder — GitHub 404](https://github.com/Dexploarer/threejs-scene-builder)

### Especificações e releases

- [glTF 2.0 Specification, §3.4](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [three.js Migration Guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)
- [three.js r187](https://github.com/mrdoob/three.js/releases/tag/r187)
- [three.js `Object3D.getWorldDirection`](https://github.com/mrdoob/three.js/blob/r187/src/core/Object3D.js)
- [three.js `Camera.getWorldDirection`](https://github.com/mrdoob/three.js/blob/r187/src/cameras/Camera.js)

### Ferramentas citadas na avaliação

- [glTF-Transform](https://github.com/donmccurdy/glTF-Transform)
- [glTF-Validator](https://github.com/KhronosGroup/glTF-Validator)
- [meshoptimizer / gltfpack](https://github.com/zeux/meshoptimizer)
- [Spector.js](https://github.com/BabylonJS/Spector.js)
- [model-viewer](https://github.com/google/model-viewer)
- [Blender MCP](https://github.com/ahujasid/blender-mcp)

---

## 14. Conclusão

O ecossistema tem muito conteúdo e pouca verificabilidade. As duas melhores fontes de **conhecimento** são o subconjunto r187 do `gamedev-skills` e a taxonomia do `CloudAI-X`; nenhuma das duas é uma dependência, e ambas exigem curadoria. As melhores referências de **processo** são o QA com evidência do `majid` e do `open-3d-skills`, e o contrato de ferramenta do `Kiln`. As piores armadilhas são licença ausente, GPL misturada, marketplace sem proveniência, pin antigo e script não auditado.

O Lia Forge não precisa de um catálogo de 79 ou 2.955 skills. Precisa de **poucas skills first-party, com proveniência, versão, licença e critério de evidência**, e de uma fronteira clara: conhecimento não executa; agente propõe; ferramenta executa sob permissão; humano decide.
