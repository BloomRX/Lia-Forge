# Lia Forge — auditoria de UI/UX e roadmap de implementação

**Data:** 2026-11-14 UTC · **Estado:** auditoria estática e planejamento, para revisão humana. Nenhuma mudança visual ou funcional foi realizada.

## 1. Escopo, base e limites da evidência

- Repositório `BloomRX/Lia-Forge`; branch isolada da sessão `arena/ee48e1c5-lia-forge`. Após `git fetch origin --prune`, a branch do Agent 0 foi buscada explicitamente com `git fetch origin refs/heads/arena/649f88bd-3dspritesheet`: seu HEAD observado era `cdb0e8debc5cf666903811df6df579cadbf105e4`, idêntico ao HEAD de partida desta auditoria. O checkout é superficial; igualdade dos objetos foi verificada, sem inferir histórico completo. Não se usou `main` como base, nem se alterou a branch do Agent 0. O nome da branch da sessão é fixo; não foi criada nem trocada outra branch.
- Inspeção dos conceitos rastreados, dos documentos de marca, arquitetura e evidência, de `src/`, das regras de interface e de pontos relevantes de `shared/`, Electron e testes. As imagens de `docs/Concepts/` foram abertas como referências; nenhuma foi modificada. Os conceitos não são especificações funcionais nem prova de direitos.
- **CODE-PRESENT não é RUNTIME-PASS.** A análise de telas é estática; não houve abertura gráfica do app, teste visual de responsividade, teclado/leitor de tela, Windows, Blender, ComfyUI ou engines reais. Não foram instaladas dependências (`node_modules` ausente), fontes ou ferramentas; não foi iniciada conexão com provider. Não se afirma qualidade visual ou conformidade WCAG medida.
- Nesta sessão, `node tests/journey-smoke.mjs` passou (158 checagens, serviço e projeto temporário, renderer interno; não é E2E de UI) e `node tests/asset-progress-smoke.mjs` passou. `npm test`, `npm run build` e testes visuais/Electron não foram executados; as dependências não estão instaladas. Evidências de sessões anteriores em `docs/T13-IMPLEMENTATION-EVIDENCE.md` são históricas, não retestes desta auditoria.
- Prioridade de fontes: código para comportamento; `docs/README.md` para precedência documental; ADR e contratos aprovados apenas no escopo declarado. Propostas de arquitetura e conceitos não autorizam implementação nem comprovam capacidade.

## 2. Resumo executivo

A identidade escura Lia, o fluxo por etapas e um pipeline conectado a serviços existem no código, mas a experiência está dividida entre **Asset studio** (briefs e guias 3D→2D) e **Pipeline de produção** (objetivos, execuções, revisão e assets próprios). Não há evidência de uma biblioteca visual unificada, viewport 3D interativo ou gestão de projetos ao nível sugerido pelos conceitos. O defeito de escopo da tela inicial está confirmado estaticamente, mas sua manifestação na renderização em runtime não foi reproduzida. O fallback para dados de exemplo e o nome fixo de projeto estão confirmados no código; gravação ou mistura de dados de exemplo com dados reais é uma hipótese de risco, ainda sem reprodução ou evidência de ocorrência.

A direção recomendada é preservar a família escura rosa/magenta, priorizar clareza, projeto e artefato reais, e evoluir gradualmente a navegação e os painéis contextuais. Não copiar o mockup literalmente: ele representa funções, porcentagens, assistente, modelos e estados de exemplo que não são, por si, funcionalidades reais. A primeira fatia deve estabilizar o shell e a entrada no projeto, sem modificar contratos ou inventar recursos.

## 3. Inventário de concepts, marca e propostas

Os caminhos são sensíveis a maiúsculas: o diretório rastreado é `docs/Concepts/`, não `docs/concepts/`.

| Caminho | O que foi observado / finalidade |
|---|---|
| `docs/Concepts/Interface Sombria Neon do Lia Forge.png` | Conceito principal: navegação lateral, viewport central amplo, abas, propriedades/workflow/histórico à direita, pipeline inferior e assistência. Personagem e progresso são ilustrativos. |
| `docs/Concepts/Lia Forge_ Heroína Pixel Neon.png` | Preview 2D/pixel, miniaturas, propriedades do asset, animação/spritesheet e pipeline; não comprova editor ou player. |
| `docs/Concepts/Forja Lia_ Aiko, Guarda Florestal.png` | Personagem 3D em viewport, propriedades contextuais, troca de modelo, rig e atividade; não comprova modelagem interativa. |
| `docs/Concepts/Lia-Forge-Visual-Asset-Library-Reference.png` | Prancha de categorias (personagens, criaturas, props, cenários, VFX, UI, folhas e GLB), não um catálogo de assets existentes. Direitos pendentes. |
| `docs/Concepts/Painel Neon do Ecossistema Lia Forge.png` | Prancha de dashboard, projetos, fluxos e assistente; a promessa de gerar modelos prontos é apenas texto do concept. Direitos pendentes. |
| `docs/Concepts/ref.jpg` | Prancha de referências estilísticas de pixel art, personagens e efeitos, não UI nem conteúdo entregue. Direitos pendentes. |
| `docs/Concepts/chart-1(1).png`, `chart-2.png`, `chart-3.png`, `chart-4.png` | Assinatura Lia, personagem e marcas da família; referências de identidade, não telas. Direitos a verificar; `chart-3.png` é duplicata byte a byte de `docs/Brand/lia-forge.png`. |
| `docs/Brand/lia-forge.png` | Marca ilustrada de referência, duplicada como acima; direitos de uso público exigem revisão. |
| `assets/lia-forge.svg`, `assets/lia-forge.ico` | Ícones rastreados do app; SVG com quadrantes, diferente da marca em L/Sakura e da marca geométrica de algumas pranchas. Isso é divergência de identidade a decidir, não autorização para substituir. |
| `docs/LIBRARY-VISUAL-REFERENCE-INVENTORY.md` | Inventário rastreado com dimensões, hashes, duplicatas, direitos e referências apenas nominais na Biblioteca. O texto inicial histórico que diz que imagens não foram copiadas é superado pela seção 6 gerada, que documenta arquivos presentes. `LIBRARY_ONLY` não foi examinado diretamente. |
| `docs/BRAND-STANDARDS.md`, `docs/guia-externo/00-PADRAO-DA-MARCA.md`, `01-GUIA-APP-NOVO.md`, `GLOSSARIO.md`, `README.md` | Família visual e princípios de autonomia, consentimento, privacidade e honestidade; kit externo é referência adaptada, não especificação vinculante acima das decisões da Forge. `docs/Lia.zip` contém kit textual Windows, não uma coleção adicional de imagens. |
| `docs/lia-ecosystem-integration.md`, `.claude/rules/interface.md`, `.agents/skills/lia-brand-check/SKILL.md` | Limites específicos: Waifu opcional e sem ponte implementada; textos pt-BR, foco, estados reais, consentimento e fechamento seguro. |
| `docs/PRODUCT-ARCHITECTURE.md`, `ASSET-PIPELINES.md`, `WORKFLOW-ENGINE.md`, `ASSET-MANAGEMENT.md`, `TOOL-PROVIDER-HUB.md`, `VISUAL-QA-BENCHMARK.md` | Visão, fluxos e requisitos de produto; ler como arquitetura-alvo, não como prova de telas. |
| `docs/LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md`, `ADR-001-LIA-FORGE-DECISIONS.md`, `DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`, `DECISIONS-AND-OPEN-QUESTIONS.md` | Decisões/arquitetura e questões abertas; proposta de contratos e migração não autorizadas automaticamente. |
| `docs/IMPLEMENTATION-AUDIT.md`, `T13-IMPLEMENTATION-EVIDENCE.md`, `INTEGRATED-RESEARCH-AND-ARCHITECTURE-REVIEW-2026-11-14.md` | Inventário de capacidade, evidência de execução histórica e pesquisas; distinguir tool stub, teste e runtime real. |
| `docs/T12-PRODUCTION-WORKFLOW-MAP.md`, `T12-IMPLEMENTATION-ROADMAP.md`, `MASTER-ROADMAP.md`, `CAPABILITY-BOUNDARIES-AND-ROADMAP.md` | Fluxos e roadmap propostos, não promessas de implementação. |

Para dimensões, hashes completos e estados do inventário consultar `docs/LIBRARY-VISUAL-REFERENCE-INVENTORY.md`. Mesmo um arquivo `TRACKED_IN_GIT` não constitui liberação geral de direitos. Não materializar imagens da Biblioteca nem distribuir artes com direitos pendentes sem decisão.

## 4. Inventário de telas, componentes e fluxos existentes

**Classificação:** “conectado” significa caminho de UI até handler/API presente no código, sujeito a pré-requisitos; não significa teste visual ou runtime real. O defeito P0 abaixo está confirmado por análise estática no caminho da abertura padrão; seu efeito na renderização ainda não foi reproduzido em runtime.

| Área / tela | Componentes e evidência | Estado e limites |
|---|---|---|
| Shell e navegação | `src/main.jsx` → `App`; `App`, `Sidebar`, `TopBar`, `navigate`, menu compacto em `src/App.jsx:431,834-1008` | Estado React local, sem roteador; cinco páginas condicionais `studio`, `handoff`, `forge`, `exports`, `activity`. A entrada inicial é `studio`. Nome `Hollow Vale` fixo e botão de projeto apenas retorna ao studio. |
| Dashboard / projeto | `StudioPage`, cards e `AssetBrowser` (`App.jsx:1026-1182`); `ProjectPanel` (`ForgeStudio.jsx:951`) | Não há dashboard multi-projeto completo. No pipeline há pasta atual, contagens e, em IPC desktop, abrir/criar/revelar pasta; no HTTP a pasta é configurada no servidor. Não há histórico/grade de projetos comprovado. |
| Workspace / personagens e itens | `StudioPage`, `AssetBrowser`, `StageNavigator`, `StageWorkspace`, `InspectorPanel`, `NewAssetModal` (`App.jsx:1026-1482,1791-1902`) | Briefs, busca, etapas, modos de entrada, referências, handoff e registro manual têm handlers; as imagens das etapas são **guias**, não saída. Existem dados de exemplo. Referências fora de escopo são um defeito confirmado estaticamente (P0); a renderização do studio ainda não foi reproduzida em runtime. |
| Viewport 2D/3D | `StagePreview`, `BriefPreview`, `ReferencePreview`, `ModelPreview`, `RigPreview`, `SpritePreview`, `AssetArtwork` (`App.jsx:1344-1590`) | Protótipos SVG estáticos/guia, não viewport interativo 3D, reprodução de animação ou inspeção visual real do modelo. Pipeline exibe imagens reais de artefatos via `RunArtifactImage` / `ArtifactThumb` (`ForgeStudio.jsx:158,754`); não equivale a viewer 3D. |
| Biblioteca / assets e versões | `AssetBrowser`, `ExportsPage` (`App.jsx:1151,1770`); `ComparisonLab`, `RightsPanel`, `handleRegisterVersion`, `handleAttach` (`ForgeStudio.jsx:486,1075,1426,1620`); `shared/assets/manager.mjs` | Busca restrita a personagens/itens no studio; comparação de até quatro imagens, registro de versão, direitos e anexação no pipeline. Não há evidência de catálogo visual geral unificado entre esses dois estados, packs ou filtros abrangentes. |
| Workflows / execução | `ForgeStudio`, `WorkflowCard`, `PlanStepRow`, `RunStepRow`, `JourneyChecklist`; `shared/orchestrator/planner.mjs`, `shared/ui/journey.mjs`, `shared/services/studio-service.mjs` | Catálogo, plano, inputs, pré-voo, execução, progresso, cancelamento/retomada e bloqueios conectados. Os oito objetivos são receitas, não oito resultados universalmente executáveis; dependem de input, ferramenta e gate. |
| Agentes / tarefas | `HandoffPage`, `makeAgentPrompt`, `taskSpecFor` (`App.jsx:333-430,1590`); `ActivityPage` | Handoff opcional gera prompt/spec e downloads; não comprova agente integrado, diálogo com Waifu ou execução autônoma. Atividade mostra estado de jobs e ComfyUI, não uma central completa de gestão de agentes. |
| Revisão humana | `RunStepRow`, `handleReview` (`ForgeStudio.jsx:632,1602`); `shared/engine/gates.mjs`, `studio-service.mjs` | Aprovado/rejeitado com nota e histórico; hash vincula aprovação ao conteúdo. Não confundir validação estrutural e aprovação humana com qualidade artística garantida. |
| Histórico / logs / proveniência | `timelineFor`, `SavedRunItem`, abas de run (`ForgeStudio.jsx:116,801,1992-2045`), `runItemActions` (`shared/ui/journey.mjs`) | Runs gravados, logs, eventos, revisões, gates, custo/licença/hash e recuperação estão representados. Não demonstram histórico global de todas as ações ou um diff de versões de modelo. |
| QA / exportação | `RunStepRow`, rodapé de run e resultado de exportação (`ForgeStudio.jsx:632,2047-2131`); `shared/qa/`, `shared/destinations/profiles.mjs` | Validações por passo e compatibilidade com perfil, pacote/manifesto e ressalva de destino não verificado. `ExportsPage` separado lista saídas dos assets do studio; não é prova de importação em engine. |
| Configurações / ferramentas / custos | `ProvidersPanel`, `ToolsPanel`, `MachinePanel` (`ForgeStudio.jsx:209-485`); `shared/hub/provider-hub.mjs`, `shared/integrations/provider-store.mjs` | Preferências de ComfyUI e Blender, endpoint, consentimento/custo e candidatos por passo são mostrados. Planner escolhe adapter; não há seletor genérico de qualquer ferramenta por passo comprovado. Disponibilidade é dependente da máquina. |
| Feedback / modais | `Toast`, `NewAssetModal`, loading/error de `ForgeStudio`, banners de ação (`App.jsx:1791-1905`; `ForgeStudio.jsx:1638-1700`) | Estados e retry existem em algumas áreas; cobertura e acessibilidade são desiguais. Fechamento Electron é fluxo separado: preservar `electron/main.cjs`, `task-manager.cjs` e confirmação existente. |

### Capacidades reais: não extrapolar as receitas

`shared/orchestrator/planner.mjs` lista arte 2D, personagem 2D por partes, modular 2D, animação 2D de rig existente, objeto 3D/render, personagem 3D/spritesheet, UI/VFX e variações/retexture. VFX e transformações internas existem no código; 3D/render exige modelo e Blender; geração de conceito exige provider adequado. No fluxo humanoide completo, geração 3D e auto-rig estão bloqueados por adapters ausentes. A prévia VFX é real e localizada (`VfxPreview`), não um editor visual geral. A métrica de compatibilidade do pacote não prova importação no Godot/Unity/Unreal. `docs/T13-IMPLEMENTATION-EVIDENCE.md` §3 e §12 detalha evidência histórica e os limites de ferramentas reais.

## 5. Matriz concept × implementação

**IMPLEMENTADO:** representação correspondente conectada no código, com escopo indicado; **PARCIAL:** só parte ou guia; **AUSENTE:** não encontrada no escopo examinado; **OBSOLETO:** afirmação documental/rotulagem superada, não necessariamente concept descartado; **NÃO CONFIRMADO:** não há prova suficiente. Nenhum estado implica validação gráfica ou plataforma-alvo.

| Concept / intenção | Estado | Evidência e diferença |
|---|---|---|
| Superfície escura, rosa/magenta, navegação lateral | IMPLEMENTADO | Tokens e `.sidebar` em `src/styles.css:1-5`; `Sidebar` em `App.jsx`. Marca e proporções não são iguais ao mockup. |
| Studio central com navegador, etapa e inspector | PARCIAL | `StudioPage`/`workbench-grid`; referências fora de escopo indicam defeito de renderização, ainda não reproduzido em runtime, e a área central é guia, não viewport. |
| Viewport 3D navegável e edição visual do modelo/rig | AUSENTE | `ModelPreview`/`RigPreview` são guias estáticos; inspeção GLB no serviço não é visualizador. |
| Preview 2D, frames e spritesheet | PARCIAL | `SpritePreview` ilustrativo; `RunArtifactImage` e `VfxPreview` exibem imagens reais. Não há player de frames comprovado. |
| Painel contextual de propriedades | PARCIAL | `InspectorPanel` exibe dados e edição de brief/animações; não implementa controles completos de aparência/modelo/rig mostrados no concept. |
| Pipeline com andamento e bloqueios reais | PARCIAL | `StageNavigator`, `JourneyChecklist` e run/plan em `ForgeStudio`; dois modelos de jornada diferentes. Nenhum percentual ou progresso do mockup é evidência. |
| Projetos e dashboard | PARCIAL | `ProjectPanel` escolhe pasta em desktop; shell mostra projeto fixo e não lista projetos recentes. |
| Biblioteca visual categorizada, packs e busca abrangente | PARCIAL | `AssetBrowser` filtra personagens/itens; `ComparisonLab` e Asset Manager têm versões. Prancha de categorias não é acervo disponível. |
| Fluxo de execução, plano, revisão e histórico | PARCIAL | `ForgeStudio`, `RunStepRow`, `SavedRunItem`, `timelineFor`; correspondência funcional parcial, sem workspace visual de grafo completo. |
| Exportação e QA | PARCIAL | Resultado e perfil/validações em `ForgeStudio`; destino real não verificado. `ExportsPage` é outra lista. |
| Ferramentas, providers e custo | PARCIAL | `ProvidersPanel`, `ToolsPanel`, `PlanStepRow`; configuração e candidatos existem, escolha explícita livre por etapa não comprovada. |
| Assistente Lia conversacional | AUSENTE | `forge-assistant` é texto condicional; `HandoffPage` prepara material para agente externo. Nenhuma ponte Waifu funcional (`docs/lia-ecosystem-integration.md`). |
| Assistência contextual sem chat | IMPLEMENTADO | Orientações condicionais em `ForgeStudio` e bloqueios no plano; não é agente. |
| Comparação e escolha de versão | PARCIAL | `ComparisonLab` compara imagens medidas e registra escolha; não é comparação universal 3D ou diff interativo. |
| Nome/identidade de projeto sempre real | AUSENTE | `PROJECT_NAME`, `Sidebar` e heading usam `Hollow Vale`; `ProjectPanel` consulta pasta real em outra tela. |
| Afirmação antiga de que concepts não estão no Git | OBSOLETO | Trecho histórico de `LIBRARY-VISUAL-REFERENCE-INVENTORY.md` §1 contradito por §6 e pelos arquivos rastreados. A existência não resolve direitos. |
| QA artístico, acessibilidade e fidelidade visual dos concepts | NÃO CONFIRMADO | Sem inspeção do app executando, medições de contraste, E2E de acessibilidade ou aprovação visual humana nesta sessão. |

## 6. Problemas priorizados e impactos

P0 = impede uso ou ameaça confiança/dados; P1 = alto impacto no fluxo; P2 = consistência/usabilidade; P3 = refinamento. Severidade é avaliação estática, não resultado de teste visual.

| ID | Pri. | Evidência | Problema / impacto e direção recomendada |
|---|---|---|---|
| UX-01 | P0 | `App.jsx:797-810,873-905,1026-1057,1133-1135` | **Defeito confirmado estaticamente:** `StudioPage` é declarada fora de `App`, mas referencia `inspectHumanoidPipeline`, `resumeBlenderWorkflow` e `humanoidPlanReport` sem recebê-los como props. A análise prevê `ReferenceError` na renderização inicial; **a manifestação em runtime ainda não foi reproduzida**. Priorizar reprodução, correção e teste de render completo após autorização. |
| UX-02 | P0 | `App.jsx:50-116,279-289,456-486,954-958`; `ForgeStudio.jsx:951` | **Confirmado no código:** `loadAssets` usa `SEED_ASSETS` como fallback quando não encontra lista local válida e não vazia; o shell exibe o nome fixo Hollow Vale. A hidratação contém um caminho de escrita de `initialAssets`, mas **gravação ou mistura de exemplos com dados reais é uma hipótese, não comportamento comprovado em runtime**: reproduzir as condições e coletar evidência antes de afirmá-la. Investigar vazio, sincronização e troca de projeto antes de alterar persistência; não apagar dados existentes. |
| UX-03 | P1 | `App.jsx:861,987-988,1102,1206`; `ForgeStudio.jsx:1720-1810` | Ajuda diz que Forge “não gera assets sozinha”, apesar de haver VFX/transformações internas; “Fluxo de trabalho” leva a handoff, engrenagem mostra mensagem futura, botão de detalhes não tem handler. Ações/rótulos criam expectativa incorreta. Rever sem fingir recursos. |
| UX-04 | P1 | `App.jsx:212-220,432-500`; `ForgeStudio.jsx:1180-1213,1426-1446,1542-1555,1620-1627`; `shared/assets/manager.mjs` | Briefs/seleção do studio e assets/versões do pipeline têm caminhos de estado distintos; troca de pasta ocorre dentro do pipeline enquanto a hidratação do `App` ocorre no mount. Risco de contexto velho ou listas divergentes; reprodução e política de sincronização/migração **não confirmadas**. Não unir stores silenciosamente. `handleAttach`/`handleRegisterVersion` usam `type: 'character'` inclusive para resultados de outras famílias: risco de classificação incorreta. |
| UX-05 | P1 | `StagePreview`/`AssetArtwork` `App.jsx:1344-1590`; `ForgeStudio.jsx:158,754,852` | Guia SVG pode competir com saída real; label “GUIA VISUAL · NÃO É OUTPUT” existe, mas previews por etapa não equivalem a GLB ou animação. Priorizar artefato real quando disponível e deixar fallback explicitamente ilustrativo, sem prometer viewport. |
| UX-06 | P1 | `styles.css:1-5,36,43-60,278-513`; `.claude/rules/interface.md` | Microtextos ainda incluem declarações de 8 px/8,5 px e diversas regras com media queries; cascata/especificidade e contraste reais precisam ser medidos. Em particular `.existing-input-field textarea` define `outline:0` após foco global. Não presumir que todo valor declarado vence a cascata. Possível perda de legibilidade/foco. |
| UX-07 | P1 | `NewAssetModal` `App.jsx:1816-1830,1883`; `Toast` `1903`; `ForgeStudio.jsx:632-753,1920+` | Modal tem `role=dialog`, `aria-modal`, título, autofocus e Escape, mas não foi encontrado controle explícito de foco preso/restaurado; toast sem região live e nota de revisão usa placeholder. Falta testar teclado e leitor de tela; mensagens críticas podem não ser anunciadas. |
| UX-08 | P1 | `ForgeStudio.jsx:549-753,1180-1213,1638-2149`; `shared/ui/journey.mjs` | Uma página longa reúne jornada, 8 objetivos, configuração, plano, execução, comparação e lateral com projeto, máquina, providers, ferramentas, direitos e runs. Há risco de sobrecarga e de revisão perdida abaixo da dobra. Contextualizar progressivamente sem esconder custo, bloqueio ou decisão humana. |
| UX-09 | P1 | `ForgeStudio.jsx:239-415,576-631,1581-1601`; `shared/orchestrator/planner.mjs:170` | Endpoint e autorização remota são configuráveis e candidatos/custo aparecem no plano; executar é possível sem abrir o detalhe do plano. A escolha de adapter é do planner. Validar por fluxo se a pessoa entende destino, custo desconhecido e consentimento antes de executar; não afirmar ausência de gate no backend. |
| UX-10 | P1 | `App.jsx:623-628,678-833,1903-1905`; `ForgeStudio.jsx:1638-1660` | Toast genérico usa ícone de check para mensagens tanto positivas quanto erros; falhas de sync no shell têm indicador pequeno e algumas falhas de polling são engolidas. Pipeline tem erro com retry inicial, mas tratamento varia. Distinguir erro persistente, ação seguinte e sucesso sem cor apenas. |
| UX-11 | P2 | `App.jsx:1157-1170,1206`; `styles.css:23-27,57-58,512-513` | Atalhos visuais `/` e `⌘ N` não têm handler correspondente identificado; elementos compactos ocultam descrições de etapa em alguns breakpoints. Breakpoints existem, mas overflow e acesso a controles essenciais não foram medidos. Remover promessa ou implementar somente após aprovação. |
| UX-12 | P2 | `App.jsx:951-1000,1013-1019,1357-1363,1415`; `styles.css:1-5`; `assets/lia-forge.svg`; concepts | Mistura de pt-BR/inglês, nomes `Asset studio`/`Exports`, ícones Lucide ao lado de emblema CSS genérico, labels/paleta demonstrativos fixos e variantes de marca entre concepts. Pode confundir hierarquia e identidade; não adotar nova marca sem decisão. |
| UX-13 | P2 | `ForgeStudio.jsx:1236-1257,1581-1601,1727` | Mudar objetivo ou configuração após planejar pode deixar plano anterior visível até novo planejamento; execução volta a planejar via serviço, mas correspondência do que se vê ao que se executa precisa de teste. Marcar plano desatualizado em vez de presumir equivalência. |
| UX-14 | P2 | `ForgeStudio.jsx:632-753,1992-2045,2047-2131` | Logs e histórico têm detalhes técnicos úteis, mas faltam evidências de filtro, navegação por decisão ou comparação visual ampliada; revisão em miniaturas pode dificultar julgamento. Validadores de conteúdo não são aprovação artística. |
| UX-15 | P2 | `App.jsx:1791-1902`; `ForgeStudio.jsx:1014-1074` | As duas formas de referência têm comportamentos diferentes: imagem do brief é comprimida/embutida; input do pipeline é copiado e validado. Origem, persistência, limites e consequência para o usuário devem estar claros, sem assumir que são a mesma entrada. |

**Pontos positivos a preservar:** `assetCompletionFlags` reseta conclusão legada sem prova; estados textuais e ações de retomada em `shared/ui/journey.mjs`; revisão ancorada em hash; `ProjectPanel` explica diferenças HTTP/IPC; `ProvidersPanel` apresenta endpoint e autorização; `VfxPreview` identifica prévia procedural; exportação destaca `verifiedOnDestination`; fluxo de fechamento não deve encerrar serviços externos.

## 7. Arquitetura atual de componentes e estilos

- React 18/Vite/Electron (`package.json`), sem biblioteca de UI nova: `App.jsx` tem ~1.919 linhas e combina dados demo, persistência, IPC, fluxo manual, navegação e JSX; `ForgeStudio.jsx` ~2.212 linhas combina estado de projeto, API, plano, run e vários painéis. Muitos componentes úteis existem, mas são declarados nos mesmos arquivos e alguns dependem de estado/handlers sem fronteira explícita — UX-01 demonstra o custo.
- `src/lia-forge-api.js` abstrai HTTP/IPC; `shared/ui/journey.mjs` concentra derivação pura de estados e ações de run; isso é uma boa base. `shared/services/studio-service.mjs` e `electron/preload.cjs` são limites de integração, não devem ser alterados para rearranjar UI. Existem duas famílias de dados e de execução; não há prova de equivalência ou migração automática segura.
- `src/styles.css` (~529 linhas, muitas regras compactadas e overrides posteriores) mistura shell legado, telas, modal, correções de legibilidade e classes `.forge-*`. Há tokens básicos no `:root`, mas muitas cores, tamanhos e espaçamentos diretos; overrides por breakpoint/especificidade dificultam previsibilidade. `lucide-react` já é dependência; SVGs próprios para guias coexistem com ícones. `Inter` é primeira escolha CSS, sem fonte instalada nesta sessão; fallback do sistema existe.
- A navegação depende de estado `page`, não URL; mudar de página desmonta `ForgeStudio`, o que pode afetar estado local não persistido. Confirmar comportamento de recuperação e execução antes de reorganizar. Testes `tests/studio-ui-render-smoke.mjs` cobrem componentes do pipeline e serviços, mas não demonstram renderização integral do `App` inicial; falta regressão específica do shell, navegação e estados vazios.

## 8. Proposta de design system — sem mudar a identidade agora

**Proposta para revisão, não especificação aprovada:**

1. **Fundação:** manter superfície escura neutra/vinho e acento rosa/magenta existentes (`--bg`, `--panel`, `--text`, `--accent`); roxo e glow apenas para destaque contextual. Não adotar as cores azuis/roxas de uma prancha como rebranding automático. Mapear tokens semânticos (`surface`, `text`, `border`, `focus`, `selected`, `success`, `warning`, `error`, `blocked`, `external`) a valores medidos, com texto + ícone para estados.
2. **Legibilidade:** usar fonte de sistema já disponível, hierarquia com tamanhos legíveis e escaláveis; propor corpo 14–16 px e metadado geralmente ≥12 px, sujeito à revisão de densidade desktop. Alvo WCAG 2.2 AA: contraste ≥4,5:1 para texto normal, ≥3:1 para texto grande e indicadores/componentes aplicáveis; medir estados, zoom e foco — valores acima dos mínimos internos de 9/10 px não são prova por si.
3. **Espaçamento e layout:** escala sugerida 4/8/12/16/24/32 px, bordas e raios consistentes; `minmax(0,1fr)`, quebra de caminhos longos e rolagem interna intencional. Viewport/artefato tem prioridade de espaço; painel contextual recolhível só se o estado e os controles essenciais permanecerem acessíveis. Não oferecer configuração persistente sem suporte real.
4. **Componentes:** consolidar botão primário/secundário/perigoso, campos com rótulo e ajuda, badge semântico, card, disclosure, modal acessível, navegação, mensagem persistente e estados vazio/carregando/erro. Ícones Lucide existentes com nomes acessíveis; não usar glifos ou cores como única informação. Foco visível, ordem lógica, Escape e retorno de foco; live regions adequadas para progresso e erro.
5. **Conteúdo:** pt-BR claro e vocabulário consistente para projeto, asset, modelo 3D, checkpoint, workflow, execução e versão. Mostrar origem e tipo do dado, destino de envio, custo conhecido/desconhecido, ações do usuário, e diferença entre estruturalmente válido, revisado e verificado no destino. Não afirmar que a Lia conversa ou age autonomamente.
6. **Estados e responsividade:** especificar pelo menos vazio de projeto/asset, carregando, falha recuperável, bloqueado, aguardando revisão, cancelado/interrompido e concluído com evidência; testar 1280×720, 1024×768 e 320–760 px, zoom 200%, texto longo e caminhos sem quebra acidental. São metas futuras, não tamanhos validados nesta auditoria.

## 9. Arquitetura de navegação proposta

Sem inventar telas ou editar contratos: organizar **as superfícies já existentes**, com rótulos e escopo mais claros.

- **Projeto / início:** pasta real e estado gravável do `ProjectPanel`, abertura/criação IPC; vazio honesto e acesso ao trabalho. Uma lista de projetos recentes só com fonte persistente e decisão aprovada; não usar `Hollow Vale` como projeto real.
- **Studio:** seleção do asset/entrada, etapa e inspector no mesmo contexto. Preservar modo manual e handoff opcional; usar saída real quando disponível, com guia rotulado quando não. Não anunciar viewport 3D até existir.
- **Pipeline:** escolher objetivo → entradas/brief → plano com ferramentas, destino, custo e bloqueios → executar → revisão → resultado. A jornada derivada do serviço deve continuar sendo fonte de estado, não um novo progresso independente.
- **Biblioteca e resultados:** inicialmente explicitar onde estão briefs do studio e versões/artefatos de runs; mover visualmente `ComparisonLab` e lista somente quando identidade entre os dois domínios estiver comprovada. Filtros, packs e operações ausentes não viram promessas.
- **Atividade / histórico:** preservar runs, logs, gates, revisões e estados de processos externos; não misturar tarefa externa e processo gerenciado. Handoff é preparação de especificação, não painel de agentes autônomos.
- **Ferramentas / configurações:** agrupar visualmente `ProvidersPanel`, `ToolsPanel` e `MachinePanel` existentes; exibir endpoint, âmbito, licenças, limitações e custo na hora da escolha e antes de execução. Seleção por passo e novas integrações dependem de suporte/decisão, não só de UI.

As seções podem ser painéis ou destinos de navegação existentes conforme revisão; não se propõe um editor de nós, chat, asset marketplace ou dashboard multi-projeto fictício.

## 10. Roadmap incremental e dependências

| Fase | Entrega proposta | Dependências / evidência de aceite |
|---|---|---|
| 0 · decisão e estabilização | Validar UX-01 em runtime; consertar passagem de props e testar render inicial. Decidir tratamento de seed/projeto e reproduzir UX-04 antes de tocar persistência. | Aprovação humana e coordenação com Agent 0. Testes de shell e vazio; nenhum dado legado apagado. |
| 1 · shell honesto | Nome/pasta reais quando disponíveis, distinção exemplo/real, navegação coerente e estados de erro/foco. | Contrato de projeto/duas stores investigado; IPC e HTTP distintos. Não depender de novo backend. |
| 2 · hierarquia e base visual | Tokens semânticos, tipografia, componentes mínimos, responsividade e acessibilidade em shell/primeiro fluxo. | Capturas e inspeção humana; contraste/foco/zoom medidos, sem assets novos nem biblioteca. |
| 3 · contexto de criação | Reorganizar etapas/inspector em torno de artefatos existentes; rótulos claros para guias e saídas reais, VFX e imagens. | Limites de API de leitura existentes, identidade do asset e pré-requisitos reais; não criar viewer GLB fictício. |
| 4 · execução e revisão | Agrupar plano, custo, gate, status, progresso, logs e revisão; replanejamento explícito em alteração de parâmetros. | Preserve `journey.mjs`, regras de run, gates, hash, consentimento; testes de UI com dados reais/sintéticos identificados. |
| 5 · biblioteca e proveniência | Navegação para assets, versão, comparação e exportação já existentes; reconciliar domínios apenas depois de decisão sobre identidade/migração. | Aprovação de contratos, política de dados e testes de compatibilidade, nunca migração silenciosa. |
| 6 · capacidades futuras | Avaliar viewport 3D, personalização persistente, escolha manual de ferramentas e demais lacunas dos concepts. | Cada item exige proposta, direitos, viabilidade, custo e autorização; não faz parte da primeira fatia. |

## 11. Primeira fatia recomendada: entrada confiável e shell mínimo

**Objetivo:** a pessoa abre o app, vê claramente em qual contexto trabalha e consegue chegar ao pipeline existente sem uma promessa fictícia. Esta fatia é proposta para uma tarefa posterior, após revisão; não foi implementada aqui.

**Arquivos candidatos:** `src/App.jsx` (passar os três valores/callbacks ao `StudioPage`; remover ou corrigir rótulos enganadores e tratar estados de projeto), `src/ForgeStudio.jsx` (expor/navegar ao `ProjectPanel` existente, se couber sem criar nova API), `src/styles.css` (somente tokens/layout/foco necessários), `tests/studio-ui-render-smoke.mjs` e/ou novo teste de render do `App` (a decidir segundo harness disponível). `src/lia-forge-api.js` e `shared/ui/journey.mjs` são interfaces a preservar, não mudanças presumidas. Qualquer correção de sincronização/projeto que precise backend ou migração sai da fatia e volta para decisão humana.

**Dependências prévias obrigatórias:** autorização específica para implementar; definição e aprovação humana da **política de dados demonstrativos**, inclusive fallback e eventual tratamento de demo já persistida, sem exclusão ou sobrescrita silenciosa; e **coordenação com o Agent 0** sobre escopo e arquivos concorrentes antes de começar. Também são necessárias a revisão do P0 e a confirmação da fonte de projeto no HTTP/IPC. Não instalar dependências adicionais; usar as já declaradas quando houver autorização e ambiente apropriado. Sem mudança de contratos, workflows, runtime ou backend nesta fatia.

**Critérios de aceite verificáveis:**

1. Render completo do `App` com seed, workspace vazio e workspace existente, sem `ReferenceError`; callbacks de inspeção e retomada chegam corretamente à etapa e não disparam até ação explícita. Smoke cobre a página inicial, não apenas componentes isolados.
2. Identidade de projeto apresentada é derivada de fonte verificável; se indisponível, diz “projeto não identificado” ou equivalente, nunca assume Hollow Vale. Dados demonstrativos não são apresentados como trabalho do usuário nem gravados/migrados sem política aprovada. Abrir/trocar projeto não mistura dados entre pastas; caso não possa ser provado sem mudança backend, bloquear a entrega dessa parte e registrar limitação.
3. Os destinos de navegação correspondem aos seus nomes; controles sem implementação não parecem ações funcionais. Texto distingue guia, asset real, execução, bloqueio e capacidades existentes. Não introduzir novos dados de exemplo ou falsas porcentagens.
4. Testar loading, vazio, erro, sync indisponível e recuperação; erro é textual, persistente quando necessário e com próximo passo. Testar foco inicial/retorno, teclado, modal e anúncio acessível; preservar confirmação segura de fechamento Electron.
5. Inspecionar visualmente desktop e larguras compactas, zoom 200%, sem rolagem horizontal acidental ou perda de ação essencial; medir contraste dos estados modificados. Registrar ambiente, capturas e limitações. Não declarar PASS Windows/Blender/ComfyUI sem execução nesses ambientes.
6. Executar os testes existentes pertinentes, `npm test`, `npm run build` quando dependências existentes estiverem disponíveis, e `git diff --check`; documentar falhas/pendências sem mascarar com instalação não autorizada. Validar visualmente com revisão humana antes de prosseguir.

## 12. Preservar × decisões humanas

**Preservar:** família visual escura Lia com magenta/rosa e brilho moderado; centralidade do conteúdo de criação e painéis contextuais; linguagem acolhedora, direta e pt-BR; autonomia sem Waifu/agente; execução manual; fronteiras de consentimento, endpoint/custo, proveniência, validações e revisão humana; arquivos legados; fechamento seguro; coerência 2D/3D através de vocabulário e padrões comuns, não funcionalidades simuladas.

**Decidir:** marca canônica (L/Sakura × quadrantes atuais × marca geométrica da prancha) e direitos das artes; densidade desktop/tamanhos e grau de presença da personagem; tratamento e eventual migração de `SEED_ASSETS`; identidade de asset entre briefs e versões/runs; semântica de projetos e histórico; prioridade e custo de um viewport real; escolha explícita de adapter quando houver suporte; grau de assistência Lia e eventual integração opcional sob contrato aprovado; política de testes Windows, ferramentas reais e engines.

### Revisão de princípios Lia

| Princípio | Avaliação nesta auditoria |
|---|---|
| Autonomia / Waifu opcional | **OK no desenho examinado**, sem integração funcional afirmada; runtime não verificado. |
| Dados e identidade do projeto | **RISCO:** seeds e nome fixo; sincronização entre contextos precisa de teste. |
| Consentimento / custo | **PENDENTE de teste E2E:** controles e gates existem no código; não foi feito envio ou gasto. |
| Transparência | **RISCO:** guia vs saída, ajuda desatualizada, botões e nomenclatura; regras de progresso e revisão oferecem base boa. |
| Neutralidade de fornecedor | **PENDENTE:** providers configuráveis existem, mas escolha por etapa é limitada pelo planner/capacidades. |
| Testes reais e direitos | **PENDENTE:** Windows, GPU, Blender, ComfyUI, engine, acessibilidade e direitos de artes não validados aqui. |
