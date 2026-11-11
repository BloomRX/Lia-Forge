# Auditoria de consolidação modular — Lia Forge, 3D Create e 3D Sprite

**Snapshot da auditoria:** 2026-10-25 (UTC; data do ambiente)<br>
**Checkout Lia Forge:** `/home/user/3DSpritesheet`<br>
**Branch de trabalho:** `arena/649f88bd-3dspritesheet` — permanece ativa<br>
**Escopo:** auditoria estática e planejamento. Nenhuma migração, cópia de repositório, instalação, execução de testes, serviço, download de assets/modelos, aceitação de licença ou operação Git mutável (commit/push/merge/troca/criação de branch) foi realizada.

> Este documento separa observação do código, afirmações documentais, inferências e propostas. “Código presente” não significa “runtime validado”. Não é parecer jurídico, auditoria de segurança completa nem autorização para redistribuir qualquer arquivo. A proposta depende de revisão e aprovação do usuário antes de qualquer migração.

## 1. Conclusão executiva

**Direção recomendada:** consolidar em um monorepo modular *somente depois de resolver os bloqueadores*, mantendo três unidades executáveis e tecnicamente independentes. A Lia Forge deve continuar como camada de interface, projeto/artefatos, autorização, orquestração e QA; 3D Create deve permanecer um add-on/worker Blender opcional; 3D Sprite deve permanecer uma aplicação Web local independente, oferecida futuramente como renderer alternativo por adapter. Não recomendo acoplar o núcleo Forge às classes, imports internos ou ao agente de qualquer dos dois projetos.

A consolidação **não está pronta para migração** por cinco motivos principais:

1. **Direitos e redistribuição não estão esclarecidos:** o repositório 3D Create não tem licença raiz identificada, embora o manifesto do add-on declare GPL-3.0-or-later; há cerca de 290,6 MB de assets e 109,8 MB de arquivos em `plugins/` no snapshot remoto. 3D Sprite também não tem licença raiz ou notices; alguns arquivos vendorizados identificam MIT, mas outros materiais e samples não têm proveniência/licença registrada suficiente. Não copiar ou redistribuir esses conteúdos até resolver cada caso.
2. **Há riscos de execução no 3D Create:** a rotina de um clique pode fazer pull, instalar add-ons, remover pastas de add-ons, percorrer diretórios do usuário e terminar em `sync` que cria commit e pode fazer push. O extrator de ZIP não restringe manifest ID/paths ao diretório permitido. A tool `run_blender_python` executa `exec()` no processo Blender; uma lista regex não é sandbox. A bridge Colab não mostra autenticação nem limite de corpo e envia CORS `*`; torna-se pública quando exposta por túnel.
3. **Os três contratos de spritesheet não são equivalentes:** Forge, SpriteForge e o `.lia.json` do 3D Create têm schemas e semânticas diferentes. O README de SpriteForge menciona um CLI Blender que não está no repositório; a Forge tem seu próprio renderer Blender, com contrato diferente. Não existe adapter comprovado entre eles.
4. **Há sobreposição sem paridade:** Forge já tem renderer Blender para modelo existente; SpriteForge tem renderer WebGL2 mais rico para câmeras/direções, GIF, sombra e packing. A saída visual, eixos de animação e metadados diferem. Manter os dois até comparar a mesma entrada/licença em ambiente real.
5. **A observabilidade Git é incompleta:** 3D Create e 3D Sprite não estão clonados neste workspace. A API do GitHub expõe commits publicados, não alterações locais não commitadas. Não declarar os worktrees remotos limpos nem presumir que os branches contenham todo o trabalho dos autores.

O produto atual continua parcialmente implementado: a Forge oferece UI, registro manual de artefatos, conceitos ComfyUI e render de modelo existente; 3D Create implementa ferramentas Blender para corpo-base, proporções, rig, peças, shader, UV/bake, animação idle e export, mas não prova um pipeline de geração 3D completo; SpriteForge implementa um fluxo local de renderização/exportação 3D→spritesheet, mas sua validação visual depende de navegador/GPU. Nenhuma dessas capacidades foi executada nesta auditoria.

## 2. Método, estados e limites de observabilidade

Estados usados neste relatório:

- **Observado no código:** caminho/função/declaração existe no snapshot lido.
- **Declarado:** README, roadmap, manifesto ou comentário afirma uma capacidade; isso não comprova qualidade nem runtime.
- **Parcial:** existe um subconjunto concreto, mas falta parte do fluxo, contrato, segurança ou validação.
- **Proposta:** recomendação futura, não uma decisão ou implementação.
- **Não verificável aqui:** depende de worktree remoto não publicado, Blender, navegador/WebGL, GPU, provider, arquivo de entrada ou revisão jurídica.

### Identificadores Git observados

| Projeto | Branch examinada | HEAD observado | Comparação publicada com `main` | Limite |
|---|---|---|---|---|
| Lia Forge | checkout `arena/649f88bd-3dspritesheet` | `13dc4c7d2fde28f9324fd929482948ba34a87abf` | `origin/main` local em `e9887118f9826e112e594b5c154a6b151071a0e6`; clone shallow e branch sem upstream configurado | O checkout contém trabalho local preexistente. Não inferir que `HEAD` representa todos os arquivos da Forge. |
| 3D Create | [`arena/01a0d27a-3d-create`](https://github.com/BloomRX/3d-create/tree/arena/01a0d27a-3d-create) | `027e9dfc6f96565a0da2dfe5498f60f5d148dca2` | API do GitHub retornou 86 commits à frente e 0 atrás de `main` | Não há clone local; alterações não commitadas são desconhecidas. |
| 3D Sprite | [`arena/01a098db-3d-sprite`](https://github.com/BloomRX/3d-sprite/tree/arena/01a098db-3d-sprite) | `a69e6cec01ac69c40faeeb82857528be526bb9eb` | API do GitHub retornou 47 commits à frente e 0 atrás de `main` | Não há clone local; alterações não commitadas são desconhecidas. |

A leitura remota foi feita por APIs de leitura do GitHub, sem clonar os dois projetos e sem baixar blobs de assets/modelos. `find` no workspace encontrou apenas o `.git` da Forge. Logo, só são auditáveis os commits/árvores publicados acima.

**Discrepância de datas:** a data confiável deste snapshot é 2026-10-25. Documentos preexistentes da Forge registram snapshots em 2026-11-06 e a API do GitHub informou um commit/check do 3D Create em 2026-11-08, datas futuras em relação a este ambiente. Os SHAs e a comparação de branches são identificadores estáveis, mas esses timestamps/status futuros não são usados aqui como evidência temporal confiável. A API retornou checks verdes para 3D Sprite em 2026-09-20; isso é apenas o resultado daquele workflow/snapshot, não execução nesta auditoria.

### Estado local da Forge antes de criar este relatório

A leitura Git feita nesta tarefa confirmou branch `arena/649f88bd-3dspritesheet`, `HEAD` `13dc4c7d…`, repositório shallow, `README.md` já modificado e **110 caminhos não rastreados**; não havia mudanças staged. Esses caminhos incluem `AGENTS.md`, `package.json`, `src/`, `electron/`, `tests/`, `docs/` e outros materiais preexistentes. Foram preservados. Este relatório é um novo arquivo; nenhum arquivo de código ou documento anterior foi editado.

## 3. Stack e forma de execução

| Projeto | Stack observada | Entradas/execução | Dependências/serviços opcionais | Observação |
|---|---|---|---|---|
| **Lia Forge** | Electron 45, React 18, Vite 6, Node `>=22.12`; scripts Python que usam a API do Blender | Aplicação desktop; scripts de renderer Blender em subprocesso | Blender local para render; endpoint ComfyUI configurado para conceito; MCP é integração opcional. Não há agente externo obrigatório. | `package.json` fixa 9 dependências diretas. O lockfile de terceiros registra 464 pacotes; não implica que todos entrem no instalador. |
| **3D Create / Bloom Agent** | Add-on Blender, Python embarcado e APIs `bpy`; manifesto exige Blender `>=4.2.0`; DevKit seleciona Python `>=3.10` | Painel dentro do Blender, tools executadas no próprio processo Blender; exportação para arquivos | Gemini e Groq por API; Colab/ngrok como ponte opcional. O manifesto declara permissões `network` e `files`. | Não é um CLI independente de Blender nem um pacote de funções puro importável pela Forge. As tools são mediadas por UI/sessão Blender. |
| **3D Sprite / SpriteForge Web** | HTML/ES modules, JavaScript, Three.js vendorizado r169, Python stdlib para o servidor local; o código do servidor usa sintaxe Python 3.10+ | Browser WebGL2, launcher `.bat`/`.sh` e servidor HTTP estático | Não requer backend, build, CDN, npm ou Blender para rodar o app; exige navegador WebGL2. | `serve.py` usa `SimpleHTTPRequestHandler` e serve `spriteforge/app/`; não foi identificado endpoint de gravação do lado servidor. Escrita de saída é mediada pelo browser/download. |

As tecnologias não devem ser unificadas à força: o processo Forge/Electron, o runtime Blender e o app Web têm ciclos de vida, dependências e testes diferentes. Um workspace na mesma raiz pode conter vários runtimes sem criar dependência obrigatória entre eles.

## 4. Capacidades implementadas, parciais e planejadas

### Lia Forge — camada de estúdio e execução

| Capacidade | Estado observado | Evidência e limite |
|---|---|---|
| UI desktop, navegação e fachada IPC | Código presente; smoke/guard registrados em docs locais | `src/App.jsx`, `electron/main.cjs`, `electron/preload.cjs`. As prévias de arte/rig/spritesheet são guias ilustrativos, não viewers de artefatos. Não houve execução Electron/Windows nesta tarefa. |
| Projetos/artefatos locais | Parcial | Persistência JSON sob `.spriteforge/`, registro manual de arquivos existentes e snapshots de runs. Não há version graph completo, lineage/licença universal nem migração geral. Taxonomia atual é principalmente `character`/`item`. |
| ComfyUI | Parcial, executor de conceito | `scripts/comfyui-client.mjs` e adapter em `electron/main.cjs` fazem diagnóstico e geração de imagem-conceito com endpoint/checkpoint previamente configurados. Não geram modelo 3D, rig, animação ou spritesheet. Não foi chamado ComfyUI. |
| Render Blender | Código presente; runtime bloqueado/não verificado nesta auditoria | `electron/blender-adapter.cjs` chama Blender sem shell e `scripts/blender_spritesheet.py` consome modelo existente (`.blend`, `.glb/.gltf`, `.fbx`, `.obj`, `.stl`). Para personagem cria uma linha por ação e 8 amostras temporais por ação em uma câmera frontal; para item faz turntable estático de 2–24 frames. Não cria mesh, auto-rig ou animação. |
| Workflow Engine | Parcial | `electron/workflow-runner.cjs` valida/agenda etapas serialmente; `dependsOn` não equivale a scheduler DAG geral. A retomada persistida é limitada. Planner geral, Tool/Provider Hub, QA visual sistemático e categorias extensíveis são alvo/documentação, não runtime comprovado. |
| Manifesto do renderer | Implementado para um contrato estreito | `electron/spritesheet-manifest.cjs` exige `schemaVersion: 1`, `character|item`, âncora específica, dimensões e frames row-major. `electron/png-validation.cjs` valida estrutura do PNG, mas não descomprime todos os pixels nem demonstra transparência visual. |

### 3D Create — add-on Blender/agente

O registro de tools inclui operações de cena, referências, banco local, corpo, proporções, rig, câmera, shader, export, peças, UV/bake, animação e ponte Colab (`agent/bloom_agent/tools_registry.py`, `agent/bloom_agent/tools/handlers.py`). O código observado em handlers implementa subconjuntos concretos:

- `spawn_base_body`: importa um `.blend` que combine com nomes/tags do Asset Bank; sem ele constrói um manequim geométrico de primitivas explicitamente descrito como placeholder. Não é um gerador de personagem acabado.
- `apply_body_proportions`: ajusta shape keys conhecidas e alguns vértices; o resultado depende da topologia/nomenclatura do asset de entrada.
- `rig_human`: cria rig canônico e tenta auto-weights pelo Blender. Qualidade e compatibilidade com meshes reais não foram testadas.
- `apply_anime_shader`, `uv_and_bake`, `make_piece`, `adapt_asset` e `make_idle_animation`: implementam operações locais Blender; falhas de bake podem ser devolvidas como mensagem textual em resultado marcado `_ok`, exigindo que o caller examine conteúdo além do booleano.
- `export_character`: declara formatos VRM, GLB, FBX e BLEND; gera `.lia.json` com nomes de ações e peças. Se o export VRM falhar, o código retorna GLB de fallback antes do bloco de geração do manifesto — saída e sidecar podem ficar divergentes/ausentes nesse caminho.
- `run_blender_python`: compila e executa código fornecido no processo Blender. A lista `_FORBIDDEN` bloqueia alguns nomes por regex, mas não cria sandbox de Python.

O README marca M1–M5 como pendentes e descreve um notebook `colab/test_bridge.ipynb` de teste; há handlers M1–M5 no código, mas isso não transforma o pipeline completo em funcionalidade verificada. Não encontrei uma etapa comprovada de geração 3D por modelo generativo no Colab. O fluxo depende de Blender, inputs/asset bank e, para a camada agente, providers remotos.

### 3D Sprite — renderer WebGL2

O código de `spriteforge/app/core.js` contém lógica de poses, direção/turntable, auto-fit/framing, layout, pivots, metadados Aseprite, GIF, trim e packing. `app.js` combina DOM/WebGL e a geração por célula; `serve.py` é um launcher HTTP local.

Entradas observadas/documentadas pelo app: `.glb`, `.gltf`, `.fbx`, `.obj`, `.stl` e `.ply`. glTF/FBX podem trazer animação; OBJ/STL/PLY são estáticos. `.gltf` exige que os `.bin`/texturas sejam arrastados juntos para incorporação; `.obj` não carrega `.mtl`/texturas externas. Draco/Meshopt/KTX2 não são suportados. `.blend` precisa ser convertido para `.glb`.

Saídas de código: PNG da sheet, JSON de metadados, sidecar Aseprite, GIF por direção, ZIP e, opcionalmente, folha compactada/metadata, camada de sombra e GIF de sombra. Há presets, controle de 4/8/16 direções, animação, elevação, frente, pivot, SSAA, escala, luz/sombra, cancelamento e diagnóstico de GPU. Projetos `.spriteforge.json` salvam settings e identidade/nome do modelo, **não o modelo**. A aplicação não processa MP4 nem faz lote, e depende de GPU/browser real para validar aparência.

## 5. Formatos e contratos: integração não existe ainda

| Origem | Arquivos e semântica observados | Compatibilidade atual |
|---|---|---|
| 3D Create → modelo | Exporta `.blend`, `.glb`, `.fbx` ou `.vrm`; sidecar `.lia.json` declara `schemaVersion: "bloom-lia-1"`, modelo, formato, rig, ações e peças. Não registra hash de origem no trecho observado. | `.glb` é a melhor interseção de intercâmbio: é exportável pelo Create, aceito pelo Forge e pelo SpriteForge. `.blend` é útil como fonte editável e Forge o aceita, mas SpriteForge não. `.lia.json` não é consumido automaticamente pela Forge. |
| SpriteForge → spritesheet | `metadata.json` usa `tool`, `image`, `size`, `cell`, `grid`, `pivot` normalizado, `directions`, `animation`, `scale`, `render`, `shadow` e `frames` como objeto de chaves `dirNN_FFF`. Linhas são **direções**; colunas são frames temporais. O schema não traz `schemaVersion` no builder observado. | Não satisfaz o validator Forge atual. O README também menciona compatibilidade com um CLI Blender, mas `spriteforge.py` e `addon/` não existem no branch examinado. |
| Forge → spritesheet | `spritesheet.png` + `spritesheet.json`; `schemaVersion: 1`, `assetType`, `frameWidth/Height`, `columns`, `rows`, `sheetWidth/Height`, `origin`, `anchor`, `animations` e `frames` como array. Para personagem, cada linha é uma **ação** e as 8 colunas são amostras temporais; para item, uma linha turntable. | É um contrato próprio, validado por `validateSpritesheetManifest()`. Não equivale a “direções nas linhas” do SpriteForge nem ao manifesto de modelo `.lia.json` do Create. |

**Consequência:** não basta renomear chaves JSON. É preciso preservar layout semântico (ação vs. direção), tempos, pivots, padding, source frame, hash da entrada e opções de render. Até existir conversor versionado e testes de ida/volta, conservar o arquivo original de cada módulo como artefato separado e produzir qualquer sidecar canônico sem sobrescrever a fonte.

### Mapa de arquivos/funções relevantes

| Responsabilidade | Lia Forge | 3D Create | 3D Sprite |
|---|---|---|---|
| UI/entry point | `src/App.jsx`, `electron/main.cjs`, `electron/preload.cjs` | `agent/bloom_agent/ui.py`, `blender_manifest.toml` | `spriteforge/app/index.html`, `app.js`, `serve.py`, `SpriteForge.bat/.sh` |
| Planejamento/orquestração | `electron/workflow-contracts.cjs`, `workflow-runner.cjs`, `blender-workflow-plan.cjs` | `agent_core.py`, `tools_registry.py`, `tools/handlers.py` | Sem engine geral; fluxo está no app Web. |
| Modelo/Blender | `electron/blender-adapter.cjs`, `scripts/blender_spritesheet.py` | `tools/handlers.py`: `spawn_base_body`, `rig_human`, `make_piece`, `make_idle_animation`, `export_character` | Importa modelo no browser por loaders vendorizados; não abre `.blend`. |
| Render/spritesheet | `scripts/blender_spritesheet.py: render_frames, pack_atlas`; `spritesheet-manifest.cjs` | `bl.quick_render` para preview e export de modelo, não o renderer de spritesheet principal | `core.js: buildPoses, fitPoses, computeLayout, buildMetadata, buildAsepriteJson, encodeGif, packRects, applyTrimToMetadata`; `app.js` faz render WebGL. |
| Estado/artefatos | `.spriteforge/`, `electron/workflow-run-store.cjs`, `manual-artifacts.cjs` | `jobs/`, backups, Asset Bank local, export `.lia.json` | `localStorage`, IndexedDB para diretório escolhido; `projetos/`/`saida/` ignorados. |
| Testes | `tests/*-smoke.*`, testes Python | `tests/run_all.py`, `tests/test_*.py` | `tests/spriteforge/test-core.mjs`, `test-app-sync.mjs`, `tools/test_serve.py` e DevKit. |

### Fronteira proposta de domínio e adapters

**Forge mantém propriedade** de Project/Asset/Artifact, permissões, estado de run, hashes, origem/licença, validação e aprovação humana. Os módulos externos apenas recebem inputs permitidos e devolvem arquivos/metadados reais; não escrevem diretamente no store Forge nem importam suas classes internas.

Port conceitual a aprovar antes de implementar:

- **`ArtifactRef`**: versão do contrato, ID, papel semântico, tipo/formato/MIME, caminho relativo permitido, tamanho, SHA-256, módulo/versão/commit produtor, referências de entrada e estado de direitos/proveniência (`unknown` é válido e bloqueia redistribuição).
- **`ModelExport`**: `ArtifactRef` para `.blend`/`.glb` mais metadados opcionais de eixo/unidades, rig e nomes exatos de ações; sidecar legado preservado como artefato, não interpretado como confiança.
- **`SpriteSheetOutput`**: PNG + metadados versionados, sistema de coordenadas, significado das linhas/colunas, dimensões/padding, frames/tempo, pivot, direção/ação e hash do modelo fonte. Um adapter declara conversão explícita entre layout `directions` e layout `animations`.
- **`AdapterJob`**: ação, input refs, options tipadas, output directory permitido, grant de efeitos, cancelamento, eventos reais e resultado com artefatos. Não aceita Python arbitrário como contrato de workflow.

Fluxo de integração futuro: Forge cria/importa o projeto → usuário registra ou escolhe modelo existente → opcionalmente abre/exporta no Bloom Agent → modelo `.glb` pode alimentar SpriteForge ou o renderer Blender já existente → Forge valida estrutura, guarda hashes e pede revisão humana. O usuário escolhe o renderer; nenhum agente, provider, instalação, rede ou upload é obrigatório. Inicialmente a integração deve ser por processo/arquivo e adapter isolado, não import direto entre runtimes.

## 6. Arquitetura-alvo e diretórios propostos

A proposta abaixo é um alvo de discussão; **não foi criada nem aprovada**. Primeiro manter cada build e launcher independente. Só depois de contratos, direitos e snapshots aprovados, reposicionar paths preservando commits/autores.

```text
/apps
  /lia-forge                 # Electron/React: UI, facade, store e workflow Forge
  /spriteforge-web           # SpriteForge completo: app estático, serve.py e launchers
/modules
  /bloom-agent-blender        # add-on Blender, tools, handlers e runtime próprio
/packages
  /asset-contracts           # schemas versionados e fixtures; sem bpy, Electron ou provider
/adapters
  /bloom-agent               # port Forge → execução/export Blender, opcional
  /spriteforge               # port Forge → renderer WebGL, opcional, após CLI/API comprovada
/tools
  /module-checks             # só verificações estáticas/CI de integração autorizadas
/docs
  /licenses                  # inventário por arquivo/asset/provider e notices aprovados
```

| Paths atuais | Destino proposto | Disposição/condição |
|---|---|---|
| `src/`, `electron/`, `scripts/`, `workflows/comfyui/`, testes e `package*.json` da Forge | `apps/lia-forge/…` | Preservar app e seus contratos v1; adaptar de modo incremental após migration dry-run. Node/Electron continuam confinados a este app. |
| `agent/bloom_agent/`, `util/`, `tests/`, ferramentas Python/DevKit de 3D Create | `modules/bloom-agent-blender/…` | Preservar identidade e licença do add-on; retirar do caminho de instalação os ZIPs/arquivos sem proveniência resolvida. Não empacotar automaticamente com Forge. |
| `spriteforge/`, launchers, testes específicos e DevKit | `apps/spriteforge-web/…` | Permanecer executável e testável sem Forge/Node/Blender. Não declarar API headless antes de existir. |
| `.spriteforge/`, `jobs/`, keys, modelos do usuário, resultados, perfis do browser, `node_modules/`, `.blend` locais | Fora do código versionado ou ignorados por política explícita | Dados privados/gerados; nenhum desses diretórios deve ser importado ou sobrescrito pela migração. |
| `assets/learn/`, `plugins/*.zip`, samples cuja licença não está documentada | **Quarentena de inventário; não migrar/redistribuir ainda** | Resolver origem, titular, permissão e notice de cada item. Se mantidos fora do monorepo, registrar ponteiro/hash e política de acesso após autorização. |
| DevKits e rotinas `sync` de cada projeto | Permanecem isolados inicialmente | Não criar um “DevKit único” que faça commit/push/instalação de módulos sem confirmação separada. |

O layout não obriga o monorepo a usar um package manager comum. `npm` fica na Forge; Python/Blender no módulo Bloom; SpriteForge usa os arquivos JavaScript vendorizados e seu launcher Python. O package compartilhado deve conter schemas/fixtures puros, não dependências de execução dos apps.

## 7. Licenças, dependências, assets e proveniência

| Projeto/material | Evidência estática | Situação de consolidação |
|---|---|---|
| Código original Lia Forge | `LICENSE` local declara MIT. O texto exclui expressamente marca, personagem, logo e `assets/lia-forge.*`. | A licença cobre apenas o código original indicado; não se estende aos outros repositórios nem a toda imagem/modelo. |
| Dependências Lia Forge | `THIRD_PARTY_NOTICES.md` local inventaria 464 pacotes do lockfile. Exemplos diretos: React/React DOM, Electron, Vite, Zod e MCP SDK aparecem MIT; `lucide-react` ISC. | Inventário baseado em metadados/lockfile, não revisão de textos integrais nem conferência do conteúdo final do instalador Windows. Regerar/confirmar notice de distribuição após definição de packaging. |
| Add-on 3D Create | `agent/bloom_agent/blender_manifest.toml` declara `GPL-3.0-or-later`; API GitHub e árvore não mostram licença/NOTICE raiz. | Não inferir que a licença do add-on cobre todo o repositório, assets, plugins ou arquivos de terceiros. Parecer de compatibilidade/redistribuição necessário antes de incluir ou empacotar junto da Forge. |
| `plugins/` e `assets/` de 3D Create | Árvore remota soma 290.588.957 bytes em `assets/` e 109.810.030 bytes em `plugins/`. Inclui, entre outros, `Stylized_Asset_Suite_for_Blender_v4.0_Pro.zip` (87.779.394 bytes) e `Retopoflow v4.0.2.zip` (14.398.969 bytes), além de referências/arquivos com nomes de obras e personagens de terceiros. `.gitignore` não exclui genericamente `assets/learn/`; os blobs aparecem na árvore publicada. | Titularidade/licença dos arquivos e dos ZIPs não foi verificada. Algumas referências do catálogo apontam CC0/CC-BY/termos manuais, mas isso é metadado/documentação, não prova do arquivo presente. Bloqueia cópia e redistribuição até inventário por arquivo. |
| Código vendorizado 3D Sprite | `three.module.js` contém SPDX MIT e versão r169; `fflate.module.js` informa MIT, versão 0.8.2. Não há licença/NOTICE raiz na árvore/API. `gifenc`, loaders e utilitários não exibem notice local suficiente no início dos arquivos consultados. | Rastrear upstream, versões, notices e termos para cada vendorizado antes de distribuição. Ausência de notice não é evidência de domínio público nem de licença do repositório. |
| Samples 3D Sprite | README associa `fox.glb` ao sample Khronos; `crate.obj` está versionado. Não foi encontrada licença/atribuição raiz. | Confirmar fonte/licença/atribuição de cada sample e manter notice junto do arquivo permitido. |
| Gemini/Groq, Colab/ngrok, Blender extensions e modelos de terceiros | Chamadas/rotas aparecem no código e no catálogo; não foram consultados/aceitos termos de provider nem condições específicas de modelos/assets. | Direitos do serviço, input, modelo, output e arquivo importado precisam ser registrados separadamente; nenhuma condição foi aceita nesta auditoria. |

**Gate legal:** até resolver esses itens, o monorepo pode ser discutido como arquitetura, mas não deve receber cópia/redistribuição de assets/plugins ou promessa de licença unificada. Separar subdiretórios não substitui revisão jurídica nem concessão de direitos.

## 8. Segurança, privacidade e side effects observados

Achados estáticos; nada foi explorado. A classificação indica prioridade de revisão, não prova de vulnerabilidade explorada.

| Prioridade | Achado | Evidência/efeito potencial | Condição/ação de planejamento |
|---|---|---|---|
| **Alta** | Launcher `BLOOM.bat`/`util/bloom.ps1` faz mais que abrir Blender | O batch usa PowerShell com `-ExecutionPolicy Bypass`. O script faz pull e pode reexecutar versão atualizada, instala add-on/plugins, remove diretórios de add-ons antigos, percorre recursivamente Desktop/Downloads/Documents em busca de `.blend`/`.vrm`, pode baixar itens do catálogo se houver URL e termina em `tools/project_cli.py sync`. No catálogo versionado lido, os campos `url` estão vazios; a rotina de download existe, mas esses registros não a acionam. O `sync` valida, stageia, commita, fetch/rebaseia e pode fazer push. | **Não executar** como launcher durante migração/auditoria. Separar ações com confirmação, escopo explícito e preview; revisão do maintainer necessária. Nenhuma dessas ações foi executada nesta tarefa. |
| **Alta** | Instalação de ZIP de extensão sem containment/validação completa | `util/ext_install.py` deriva o ID do manifesto do ZIP, apaga diretório `user_default/<id>` existente e combina paths de membros do ZIP com destino sem validação de canonical path/containment. Não há teste de traversal visível em `tests/test_util_installer.py`. | Antes de qualquer instalação, validar ID/path após resolução, bloquear `..`/absolutos/symlinks, extrair em staging e substituir atomicamente; pin/hash/rights do pacote. Não testar com ZIP malicioso nesta auditoria. |
| **Alta** | Execução de Python do agente no Blender | `run_blender_python()` aplica bloqueios regex e então chama `exec(compile(...))` com `bpy`, `Path`, `mathutils` e builtins do processo. Pode alterar a cena e acessar recursos disponíveis ao Blender; o guard não constitui sandbox. | Tratar como execução de código com confiança/permissão explícita. Não expor como tool genérica a workflow/skills. Isolamento/allowlist deve ser decidido e testado antes de integração automática. |
| **Alta** | Bridge Colab sem autenticação aparente | `bridge.py` faz bind loopback `127.0.0.1`, mas responde `Access-Control-Allow-Origin: *`; rotas GET expõem dados do job/inputs e POST grava result/complete. O handler lê `Content-Length` sem limite máximo visível. README orienta ngrok, que pode expor a bridge à rede pública. IDs têm timestamp e sufixo aleatório curto; não substituem autenticação. | Só usar com consentimento de envio e threat model. Exigir autenticação/token por job, limite de bytes/tempo, validação MIME/filename, expiração/limpeza, CORS restrito e confirmação do destino. Nada foi tunneled ou requisitado. |
| **Média/alta** | Segredos e dados enviados a providers | `keys.py` guarda chaves Gemini/Groq em JSON local; `chmod(0o600)` é melhor esforço, não garantia em todo OS. `llm.py` chama APIs HTTPS; a referência visual pode ir inline e imagens de render retornam ao fluxo do agent. | Tornar destino/retention/custo visíveis; segredo fora do projeto/log e com revogação. Nenhuma chave/provider foi usada. |
| **Média** | Vite/dev endpoints da Forge | Configuração local descrita em auditoria precedente usa bind `0.0.0.0`/allowlist ampla e endpoints de store do dev server; há controles de IPC/path, mas não modelo transversal de autenticação/rede. | Manter fora do pacote de produção e revisar exposição/CSRF antes de qualquer acesso de rede. Sem servidor iniciado aqui. |
| **Baixa por padrão, aumenta com configuração** | Servidor SpriteForge | `serve.py` usa loopback por padrão e serve apenas diretório estático `app/`; aceita `--host 0.0.0.0`, o que expõe a página à rede. Não foi observado endpoint de gravação server-side. | Documentar que `--host` é compartilhamento deliberado; manter loopback por default. Nenhum servidor iniciado. |
| **Funcional/contrato** | Metadados e retorno de falhas | Fallback VRM do Create pode sair sem `.lia.json`; `uv_and_bake` pode incluir falha de bake em texto e sinalizar `_ok`. | Adapters devem verificar arquivos/semântica e códigos estruturados, não confiar só em mensagem/booleano. |

## 9. Testes, CI e o que não está validado

| Projeto | Suíte/configuração observada | Resultado disponível e lacunas |
|---|---|---|
| Lia Forge | `package.json` encadeia 14 smoke scripts Node; existem testes Python. `docs/PHASE-0-REPORT.md` registra uma execução anterior com 14 smokes e 30 testes Python passando e build Vite concluído. | **Nada foi rodado nesta auditoria.** O documento local citado tem data futura (2026-11-06) em relação a 2026-10-25; trate seu registro como material preexistente, não como confirmação temporal desta tarefa. Não há E2E Electron/Windows, Blender real, ComfyUI real ou avaliação visual no escopo aqui. |
| 3D Create | CI `.github/workflows/tests.yml` chama `python tests/run_all.py` em Ubuntu com Python 3.12; runner descobre `tests/test_*.py`. Há testes de chaves, schema/registry, lógica pura, bridge simulada e testes por inspeção de texto. | Não inicia Blender, não valida malha/rig/auto-weights/render visual, API real, Colab/ngrok, instalação real nem plataforma Windows. GitHub API retornou check `success` no HEAD com `completed_at` futuro `2026-11-08`; por discrepância de relógio não foi tratado como status confiável nesta data. |
| 3D Sprite | CI usa Python 3.12 e Node 22; validação, lint, `tools/test_project_cli.py`, `tools/test_creation.py` e `tests/spriteforge/test-core.mjs`. README declara 431 asserções do core e 61 do app-sync. | Check GitHub retornado como `success` em 2026-09-20 para o snapshot. A CI **não** chama `tools/test_serve.py` nem `tests/spriteforge/test-app-sync.mjs`, embora `devkit.json` os liste em `full_tests`. O checklist de browser/GPU/console continua manual; não se validou renderer/WebGL real nem aparência nesta auditoria. Os números do README não foram reexecutados. |

Não foram executados `npm test`, `npm run build`, `python -m unittest`, CI, Blender, browser, bridge, ComfyUI ou providers; não houve instalação de dependências. Testes em CI/smokes não substituem E2E ou revisão visual humana.

## 10. Plano de preparação e migração por fases

Nenhuma fase abaixo é autorização implícita para começar código ou transferência de assets.

### Fase A — congelar e completar o baseline

1. Obter de cada mantenedor snapshot verificável de commits, alterações não commitadas e arquivos ignorados que façam parte do trabalho; preservar os diretórios originais e registrar hashes/árvores.
2. Revisar o diff preexistente da Forge sem limpá-lo; identificar claramente quais arquivos pertencem à Forge e quais são material do usuário.
3. Registrar branch, SHA, autor, notices, origem de assets e execução/CI por cada snapshot. Confirmar os timestamps anômalos do GitHub por canal confiável.

**Saída:** inventário de três worktrees completos, sem classificar branch remoto como “estado integral” até receber alterações locais.

### Fase B — gate de direitos e segurança

1. Resolver licença do repositório 3D Create e 3D Sprite, notices dos vendorizados, samples, ZIPs e assets/modelos por arquivo.
2. Separar código redistribuível, material de usuário e dependências externas; nenhuma licença é aceita por default.
3. Revisar e autorizar, em seus próprios projetos, os riscos do launcher, extração ZIP, `exec`, API keys e bridge antes de qualquer automação/workflow que os acione.

**Saída:** matriz de direitos sem `unknown` para qualquer conteúdo a copiar/empacotar e threat model com limites explícitos.

### Fase C — congelar contratos e fixtures

1. Definir `ArtifactRef`, proveniência, hash, media type, paths permitidos e eventos de execução.
2. Documentar schemas legados sem alterá-los: `.lia.json` do Create; metadata SpriteForge; manifest Forge v1.
3. Criar fixtures sintéticas autorizadas e testes de conversão que demonstrem preservação de eixo, dimensões, ação/direção, frame timing, pivot, padding, source frame e alpha. Só aceitar conversão explícita; não mutar sidecar legado.
4. Separar outputs de personagem/animação (linhas por ação no Forge) de outputs direcionais (linhas por direção no SpriteForge). Definir se são artefatos diferentes ou se uma conversão é válida para uma rota específica.

**Saída:** schema versionado e testes de compatibilidade/paridade para callers legados. O contract final precisa de aprovação do usuário.

### Fase D — empacotar sem acoplamento

1. Organizar diretórios de cada módulo mantendo launcher, build e testes próprios.
2. Preservar chamadas opcionais e a Forge funcionando sem Blender, Bloom Agent, provider cloud, MCP ou SpriteForge.
3. Manter `.glb` como formato comum de intercâmbio de primeira fatia; conservar `.blend` como fonte editável quando houver necessidade. Nunca assumir que uma referência `.blend` pode ser aberta por SpriteForge.
4. Não migrar `assets/learn`, `plugins/*.zip`, chaves, outputs, perfis, `jobs/` ou dados de usuário antes do gate de direitos/segurança.

**Saída:** cada app ainda inicia e testa isoladamente; remover qualquer módulo opcional não impede abrir a Forge ou registrar artefatos manuais.

### Fase E — piloto de integração com escolha do usuário

Com uma amostra licenciada/autorizada, mesma versão/hash de `.glb` e target declarado:

1. exportar/registrar modelo pelo Create, sem assumir que agente/provider é obrigatório;
2. renderizar uma cópia com SpriteForge e outra com o renderer Forge;
3. verificar arquivos reais, metadados, hashes, dimensões, alpha, orientação, frames/ações e tempo; capturar ambiente/OS/browser/Blender;
4. fazer revisão visual humana do output e comparar resultados sem atribuir equivalência apenas por dimensões;
5. observar que o teste é E2E somente na combinação de runtime/OS/entrada registrada.

**Saída:** decisão explícita de manter duas rotas, eleger uma rota por capability ou desenvolver adapter/CLI para SpriteForge. Não substituir renderer antes desta comparação.

### Fase F — conectar Workflow Engine e preservar histórico

1. Modelar `model.create/edit/export`, `sprite.render`, `artifact.validate` e `human.review` como capabilities/adapters isolados; workflow descreve inputs/outputs, não imports internos.
2. Integrar primeiro pela execução serial/facade já existente da Forge; DAG paralelo/retomada só após scheduler e reconciliação de efeitos existirem.
3. Fazer migration dry-run com cópia imutável/backup, comparação de árvore/hash e plano de rollback.
4. Quando aprovada pelo usuário e pelos mantenedores, importar commits mantendo autoria e histórico original como ancestrais; evitar squash/filter-repo se preservação de commits/SHAs for requisito. Não descartar os repositórios-fonte até passar os critérios de release.

**Saída:** migração reversível, auditável, com histórico/autoria e dados originais preservados.

## 11. Rollback e critérios objetivos de prontidão

### Rollback mínimo

- Preservar cada repositório/snapshot original, refs/tags e árvore de arquivos; nenhum `clean`, reset, rebase destrutivo, reescrita de histórico ou exclusão de worktree como parte da migração.
- Importar código apenas após backup e comparação de hashes; separar integração em commit de migração identificável, com autores originais preservados nos commits ancestrais.
- Manter launchers/módulos antigos independentes até comprovar alternativa. Reverter adapter/configuração sem apagar outputs; outputs válidos são imutáveis ou versionados.
- Fazer dry-run de migração de dados com relatório de paths e direitos; rollback restaura paths anteriores e valida checksums. Não mover armazenamento pessoal automaticamente.

### Pronto para iniciar migração somente quando

1. Os três estados de worktree, inclusive não commitados/ignorados relevantes, estiverem disponíveis e preservados.
2. Licenças/notices de código, vendorizados, plugins, samples, modelos e imagens estiverem resolvidas para o uso pretendido; nenhum `unknown` seja distribuído.
3. `run_blender_python`, ZIP install, bridge, credenciais, rede e efeitos de launchers tenham threat model e autorização explícitos; side effects sejam opt-in e limitados.
4. Os três formatos de metadata tenham schemas versionados, converter/testes aprovados ou decisão documentada de mantê-los separados.
5. O `.glb` de intercâmbio passe em teste real para ambos os renderers, com ambiente e artefatos salvos; diferenças sejam aceitas, não mascaradas.
6. Cada módulo continue instalável/rodável/testável sem os outros e sem agente/provider obrigatório.
7. CI cubra os testes declarados ou documente deliberadamente o que fica fora; execução real e revisão visual sejam feitas na plataforma que será anunciada.
8. Dry-run, backup/restore, preservação de autoria e rollback passem em ensaio autorizado.
9. O usuário aprove formalmente a arquitetura, o conjunto de assets a migrar, a estratégia de histórico e o renderer padrão por rota.

## 12. Divisão de trabalho Arena / Codex / usuário

| Responsável | Trabalho proposto após aprovação | Limites |
|---|---|---|
| **Arena** | Manter auditoria/evidências, consolidar matriz de licenças e riscos, revisar contratos, fixtures e equivalência; preparar plano de importação/rollback. | Não instalar, baixar, executar providers/Blender, mover arquivos, mudar branches/histórico ou fazer commit/push sem pedido explícito. |
| **Codex** | Depois do aceite, receber pacotes pequenos e não concorrentes: (1) schemas/fixtures puros; (2) conversor de metadata testado em arquivos sintéticos; (3) adapter isolado de leitura/export; (4) ampliar cobertura de CI em arquivo de módulo específico. | Um pacote por vez; paths autorizados por tarefa; não tocar store/UI/runner central e adapter em paralelo; não alterar licenças nem instalar plugins. Teste de fixture não pode ser rotulado E2E. |
| **Mantenedores dos módulos / usuário** | Disponibilizar worktrees e alterações locais; confirmar direitos, preferências de renderer, dados permitidos, providers/custos e target OS; aprovar migração. | Licença e permissionamento não podem ser decididos por inferência do agente nem por mensagem de commit. |

Correções de segurança no Bloom Agent devem ser aprovadas e mantidas no próprio módulo upstream antes da integração; o monorepo não deve esconder ou contornar o risco por wrapper. Nenhum pacote Codex está autorizado por este relatório a alterar arquivos existentes.

## 13. Recomendação final

**Aprovar a direção de monorepo modular para planejamento, não autorizar a migração ainda.** Preservar Forge, Bloom Agent e SpriteForge como módulos independentes; usar `.glb` como ponte inicial de dados; definir contracts/adapters versionados; manter ambos os renderers até validação comparativa; manter assets, plugins e dados locais fora do conjunto migrado até resolver proveniência/licenças.

O estado deste snapshot é exclusivamente documental: nenhuma alteração de código, instalação, teste, execução de runtime/serviço, download de asset/modelo, aceitação de licença, commit, push ou troca/criação de branch foi feita. A próxima etapa depende da revisão e aprovação do usuário e da disponibilidade dos estados locais dos dois repositórios remotos.
