# Pipelines de assets e pontos de entrada

> **Estado:** especificação de produto-alvo. Rotas aqui listadas não devem ser lidas como capabilities já disponíveis. O estado real está em [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md); contratos gerais estão em [`WORKFLOW-ENGINE.md`](WORKFLOW-ENGINE.md).
>
> **Adendo 2D/2.5D e destinos de utilização (revisão documental; evidência upstream de 2026-11-09/2026-11-10 UTC):** a Forge é registrada como **fábrica geral de assets** — a mesma infraestrutura de projeto, identidade visual, geração, edição, validação, proveniência e exportação atende personagens 2D, personagens 2.5D, PSD em camadas, formatos compatíveis com Live2D quando houver provider adequado, personagens 3D (VRM/GLB/FBX e outros suportados), cabelos/roupas/acessórios/expressões/partes intercambiáveis e rigging/animação/spritesheet/renderização. **Formatos são capacidades e formatos de saída, nunca dependência obrigatória de um único software.** Este adendo acrescenta a rota 2.5D em camadas, dois providers externos experimentais e os destinos de consumo. É apenas documentação: nenhum adapter foi criado, nada foi clonado/instalado/executado e nenhum direito foi aceito. Detalhes de origem/versão/licença em [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md) itens 10 e 11.

## Modelo de rota

Uma rota é um DAG reutilizável de transformações tipadas entre artefatos. A pessoa escolhe **objetivo, entradas, restrições, saída e ponto de entrada**. O orquestrador pode recomendar um plano, mas o usuário escolhe e inicia. O executor solicita somente os estágios que faltam a partir dos insumos aprovados.

```text
Pedido + restrições + artefatos existentes
  → validar entradas e direitos
  → construir plano tipado e capability gaps
  → revisar consentimentos/custos/destinos
  → iniciar explicitamente
  → executar nós, preservar checkpoints e artefatos
  → validar estruturalmente
  → revisar visualmente com pessoa
  → aceitar, iterar, comparar ou exportar
```

Ponto de entrada é uma propriedade da execução, não uma declaração de que as etapas anteriores foram concluídas. Uma entrada existente só satisfaz um nó quando passa os contratos específicos daquele nó; extensão de arquivo sozinha não prova que o conteúdo serve.

## Categorias de primeira classe e saídas

| Categoria | Exemplos de objetivo | Formas de saída | Gates típicos |
|---|---|---|---|
| **Personagem / criatura** | conceito; corpo inteiro estilizado; retrato; NPC; criatura; direção de animação; personagem 2D, 2.5D ou 3D para jogo ou para destino desktop. | PNGs/atlas + JSON, sequência de frames, modelo (GLB/FBX/BLEND/VRM), rig, clips, fontes editáveis, PSD em camadas + máscaras, personagem 2.5D (deformação/blink/lip sync/física), arquivo de runtime 2.5D (ex.: `.doll`) e formatos compatíveis com Live2D quando houver provider adequado. | Identidade/silhueta, câmera, escala, pivô, geometria, rig, weights, ações/slots, estabilidade temporal, nomenclatura/ordem de camadas, conteúdo reconstruído identificado, licenças. |
| **Item / arma / ferramenta / prop** | vista para inventário, item equipável, prop animado, variações. | Imagem, spritesheet, modelo, materiais/texturas, pivô, variações de movimento, arquivos fonte. | Orientação/escala, ponto de encaixe, colisão, dimensões, rotação, transparência e uso no jogo. |
| **2D / sprites / animação / UI** | pixel art, ilustração, ícone, frame sequence, tileset ou elemento de interface; personagem 2.5D em camadas. | Imagens individuais, atlas com retângulos/pivôs/FPS, SVG ou fonte procedural, PSD em camadas + máscaras por parte, partes PNG transparentes + manifesto, página HTML autocontida de player 2.5D quando suportada. | Grade/paleta, alpha real, clipping, seams, escala de leitura, loop, oclusões reconstruídas sinalizadas e licenças/fontes. |
| **Ambiente / cenário / fundo** | cenário estático, tileável, parallax, panorama, mapa de profundidade ou módulos 3D. | Imagem final + fonte, camadas foreground/midground/background, depth map, kit modular, cena/mesh. | Composição/câmera, costura do tile, consistência de profundidade, bounds, parallax, desempenho e rights. |
| **Material / textura / superfície** | mapa PBR, tiles, decal, material procedural, variações de superfície. | Albedo/base color, normal, roughness, metallic, height, máscara, shader/fontes. | Espaço de cor, resolução, tileability, canais, UV e licença de source/model. |
| **Procedural / código** | gerar arte 2D/3D reproduzível, variações ou geometria. | Fonte, parâmetros, versão do runtime, imagem/modelo renderizado e instrução de reprodução. | Dependências, determinismo declarado, execução isolada, comportamento de script e equivalência do output. |
| **Outras categorias extensíveis** | áudio, VFX, partículas, cinematic ou outro asset de jogo. | Contrato específico do pacote; nunca assumir um formato universal. | Requisitos e validação são definidos pelo tipo/plugin, sem relaxar consentimento ou provenance. |

## Rotas-alvo

Os exemplos de grafo abaixo descrevem possibilidades. Nó pode ser local, remoto ou manual, desde que haja adapter registrado e o usuário autorize seus efeitos.

| Rota | Grafo ilustrativo | Entradas válidas que podem virar ponto inicial | Estado no checkout |
|---|---|---|---|
| **Brief → 2D** | Brief/referência → direção de arte → imagem/frames → normalização/atlas → QA. | Brief, imagem de referência, frame isolado ou atlas a editar. | `PLANNED` — ComfyUI gera apenas PNG de conceito; não existe pipeline geral 2D. |
| **Brief → 3D → rig → animação → spritesheet** | Brief → vistas → mesh → materiais → rig → clips → render/atlas → QA. | Brief, vistas aprovadas, mesh, rig ou modelo animado. | `PARTIALLY_IMPLEMENTED` como contrato humanoide; só render Blender de modelo existente é executável. |
| **Manequim / poses → 2D** | Pose frames/rig → alinhamento/câmera → transferência de identidade/estilo → atlas → QA. | Sequência de pose, vídeo/rig de origem com licença e metadados. | `PLANNED`; não há transformador de pose/estilo no app. |
| **Código/procedural → 2D** | Fonte/seed → sandbox → render de frames → empacotador → QA. | Código existente, seed/brief, sequência parcial. | `PLANNED`; não há adapter de código-para-asset no runtime. |
| **Código/procedural → 3D** | Fonte/parametrização → sandbox/DCC → mesh/material → export → QA. | Script, cena procedural, modelo ou parâmetro. | `PLANNED`; nenhuma execução procedural genérica exposta pelo núcleo. |
| **Imagem → 3D** | Imagem autorizada → provider de geometria → normalização/material → QA 3D. | Imagem existente; pode começar também em mesh/textura já produzidos. | `DOCUMENTED` como opção de provider externo; sem adapter image-to-3D no app. |
| **Asset existente → editar/converter** | Importar → inspecionar → fork/versão → transformação escolhida → validar/exportar. | Qualquer formato compatível com adapter e schema de QA disponível. | `PARTIALLY_IMPLEMENTED` para registro manual e render de modelo existente; edição/conversão genérica não existe. |
| **Cena 3D → ambiente 2D/2.5D** | Cena/câmera → renders/camadas/depth → compositing/parallax → QA. | Cena, renders ou camadas parciais. | `PLANNED`. |
| **Imagem 2D → PSD em camadas → rig 2.5D → animação → exportação** | Imagem autorizada → separação de partes → reconstrução de áreas ocultas (marcada como conteúdo gerado) → PSD + máscaras → revisão de partes → rig/deformação 2.5D → animação (idle/blink/lip sync/física) → exportação → QA. | Ilustração PNG/JPG/SVG com direitos adequados; PSD/PSB em camadas já separado; partes PNG transparentes + manifesto; SVG em camadas; rig/ajustes manuais já feitos para retomar. | `PLANNED`/`BLOCKED` como rota; dois providers externos experimentais registrados como candidatos (ver abaixo). Nenhum adapter, instalação, execução ou aceite de direitos ocorreu. |

### Rota 2.5D em camadas — etapas, providers candidatos e alternativas

A rota é uma sequência de capabilities independentes. Cada etapa tem provider substituível; **nenhuma dupla de ferramentas forma dependência indivisível**, ainda que o upstream de uma declare forte dependência da outra. Nomes de capability abaixo são rótulos ilustrativos de planejamento, não contratos de domínio aprovados.

| Etapa (capability candidata) | O que precisa produzir | Provider candidato registrado (experimental) | Alternativas previstas |
|---|---|---|---|
| Separar partes da imagem 2D | partes com pixels próprios, fronteiras e ordem de oclusão | [`link-ding/image-to-psd`](https://github.com/link-ding/image-to-psd) @ `e386bf3a92ef1359379ee582309cb55e85db0e9c` — skill de agente + script Python (`pillow`, `numpy`, `psd-tools`; `cairosvg` para SVG) | outro separador de camadas; separação manual assistida; implementação própria da Forge |
| Reconstruir áreas ocultas | pixels inferidos sob oclusão, **identificados como conteúdo reconstruído/gerado** | idem (o upstream declara preenchimento de oclusões e dependência de ferramenta de geração de imagem, ex.: ImageGen no Codex) | pintura manual pelo usuário; provider de inpainting escolhido e consentido; manter a parte incompleta e registrá-la como `partial` |
| Exportar PSD em camadas + máscaras | PSD/PSB com RGBA por camada e máscara grayscale editável, camadas vazias preservadas | idem — `scripts/layered_assets.py psd-png parts.json … --report qa.json` (ou `psd existing.svg …`) | exportador próprio da Forge; outro formato de camadas; partes PNG + manifesto sem PSD |
| Revisar e corrigir partes | correção de sangramento entre camadas, fragmentos soltos e lacunas; ajustes manuais preservados | [`link-ding/doll-studio`](https://github.com/link-ding/doll-studio) @ `127968436dca6d564b6075de94259679e4f17c43` — limpeza de camadas e retoques erase/cover/move/restore no editor web | revisão manual em editor 2D do usuário (ex.: Krita); validador/checklist próprio da Forge |
| Rig e deformação 2.5D | auto-rig por nome de camada, medição facial, meshes, pontos de controle e parâmetros de deformação | idem (`src/psd.js`, `src/autorig.js`, `src/roles.js`, `src/rig.js`, `src/renderer.js`) | editor/rig próprio; outro runtime 2.5D; rig manual/keyframes |
| Animação | idle, blink, olhar, formas de boca/lip sync, física de cabelo, reação a clique | idem (`src/idle.js`, `src/voice.js`, `src/tracking.js` + MediaPipe Face Landmarker) | clips/keyframes próprios; outro runtime; frames/spritesheet via rota 3D→2D existente |
| Exportação | arquivo do runtime 2.5D (ex.: `.doll` v1), página HTML autocontida e — quando houver suporte real — formatos intercambiáveis | idem (export `.doll` e web page; player como browser source) | exportação para formatos intercambiáveis quando suportada; frames/spritesheet; Live2D ou formatos compatíveis **apenas quando houver provider adequado** |

Regras da rota:

1. **Origem e versão pinadas.** Proveniência registra repositório, branch, commit, data observada e o que foi lido; nada de “última versão” implícita.
2. **Direitos antes do uso.** `image-to-psd` não tem arquivo de licença — há apenas autorização de uso geral **declarada pelo usuário**, que não é licença formal Apache/MIT. `doll-studio` tem licença **não identificada** para o código original; Apache-2.0 cobre apenas componentes de terceiros (LivLiv Player adaptado e MediaPipe) e a declaração `MIT` existe só no manifesto do subpacote Electron. Cópia, integração, redistribuição e fork permanecem bloqueados até esclarecimento/autorização do titular; estudo conceitual e avaliação técnica são permitidos nesta fase.
3. **Conteúdo reconstruído é conteúdo gerado.** Áreas ocultas preenchidas por inferência entram na proveniência como geradas/reconstruídas, com tool/model/parâmetros quando conhecidos, e são mostradas como tal na revisão humana; nunca como pixels do original.
4. **Sem promessa de rigging profissional.** O próprio upstream declara não garantir one-click nem qualidade de produção; a Forge não declara qualidade de rigging, compatibilidade de formato nem suporte de plataforma a partir desta documentação.
5. **Provider substituível.** Se surgir impedimento de direitos, técnico ou de manutenção, a Forge pode desenvolver implementação própria e independente — **sem copiar código, prompts, exemplos ou assets** dos repositórios sem autorização apropriada.
6. **Efeitos exigem consentimento por escopo.** Instalação da skill e de dependências Python, download do MediaPipe (~17 MB do npm e do Google Storage), envio de arte/prompt a provider de geração de imagem, uso de câmera/microfone, execução de app Electron não assinado e escrita em arquivos de configuração de agentes externos (`~/.claude/settings.json`, `~/.codex/config.toml`) são efeitos separados, revelados antes e nunca ativados por padrão.
7. **Compatibilidade só com evidência.** Ler um PSD com sucesso em um parser não prova que o software-alvo o aceita; declarar formato/software verificado exige import real observado na combinação testada.

### Preservação obrigatória na rota 2.5D

Para cada tentativa — inclusive incompleta ou falha — preservar e registrar, sem sobrescrever originais:

- **original da imagem** (bytes + SHA-256) e sua origem/direitos;
- **PSD e máscaras** por camada, com nomes/ordem/offsets reais;
- **partes reconstruídas/inferidas**, marcadas como conteúdo gerado, com tool/model/parâmetros quando conhecidos;
- **ajustes manuais** (retoques, pontos de controle, tipos de parte, grupos de física) como revisão própria, preservando a versão anterior;
- **configuração do rig** (medições, pivôs, parâmetros, física) com versão e vínculo ao PSD usado;
- **arquivo final** exportado e o artefato/página de reprodução;
- **proveniência e hashes** de input/output por etapa, backend, versões e consentimentos;
- **resultados parciais e falhas**, com motivo e estado (`partial`/`failed`/`blocked`/`unknown`).

### Rota 3D local image→game-ready — etapas, candidatos observados e bloqueios (referência externa, não rota aprovada)

Rota estudada a partir de fonte externa de terceiro (pesquisa [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md), item 12: vídeo [`Local AI Now Makes Game-Ready 3D Characters (Fully Animated!)`](https://www.youtube.com/watch?v=bEiW6L7Y7NM), canal `PixelArtistry`, upload declarado 2026-11-06, 24:12, e repositório [`pixelartistry/PixelArtistry-Animated-Characters`](https://github.com/pixelartistry/PixelArtistry-Animated-Characters) @ `77f1462dab42`). Como na rota 2.5D, **cada etapa é uma capability independente com provider substituível**; nenhuma dupla de ferramentas forma dependência indivisível. Registrar a rota **não** cria decisão de produto, de provider nem de formato: a seleção permanece em aberto (proposta §15.2) e, no pacote de contracts, os IDs de slot/role/`formatId` continuam pendentes (especificação §11, item 5). Nada foi clonado, baixado, instalado, executado ou medido por nós.

| Etapa (capability candidata) | O que precisa produzir | Candidato observado na fonte externa | Alternativas previstas |
|---|---|---|---|
| Gerar mesh a partir de imagem 2D | mesh bruto + proveniência (modelo, versão, seed/parâmetros redigidos, hash de input/output) | `microsoft/TRELLIS.2` @ `75fbf0183001` (MIT “model and code”) e/ou `TencentARC/Pixal3D` @ `f7cf38429b0b` (MIT + `NOTICE` de terceiros) via ComfyUI | Serviço hospedado com direitos resolvidos; `hunyuan3d` (item 5 da pesquisa, documentação apenas); modelagem manual; implementação própria |
| Tornar o mesh watertight | malha fechada, sem buracos, com relatório do que foi reparado | `Mstafa-awad/WTiVo-WatertightVoxel-ComfyuiNode` @ `fb9e9ea6a7de` (**GPL-3.0**) | Reparo em DCC; implementação própria; `WTiVo-FastMergeByDistance` (MIT) |
| Reduzir para low-poly de jogo | malha decimada com contagem de triângulos declarada (no vídeo, ~12k) e LODs quando aplicável | `Mstafa-awad/LODTailor-The-Mesh-Trimmer-ComfyuiNode` @ `3d25b7d4aa38` (**GPL-3.0**) | Decimate/LOD em DCC; implementação própria |
| Baker mapas a partir do high-poly | normal map (e demais mapas) com resolução e espaço declarados | `Mstafa-awad/LODTailor-Bake-Forger` @ `f13589c22558` (**GPL-3.0**) | Bake em DCC; implementação própria |
| Texturizar a partir da imagem de referência | texturas 2K/PBR ligadas à imagem fonte | `Mstafa-awad/UltraTex-ComfyUI-nodes` @ `8b3715605fa5` (**GPL-3.0**) sobre **FLUX.2 Klein base 9B** (**FLUX Non-Commercial License v2.1**) | Provider de textura com direitos comerciais resolvidos; pintura manual; textura procedural |
| Gerar prop compatível e combinar | prop low-poly coerente em escala/estilo + combinação e attach no DCC | Segundo workflow do repositório do autor + **Blender** (interface técnica auxiliar, ADR-001 Decisão 5) | Prop modelado manualmente; biblioteca com licença verificada (ex.: CC0 confirmado na fonte) |
| Auto-rig, finger rig e attach de props | rig com ossos, pesos e attach de prop, com relatório do que foi automático e do que exige revisão | `actionforge.app` — serviço **web hospedado**, licença **não verificada**, sem repositório público identificado | Auto-rig em DCC; rig manual; retarget a partir de rig existente |
| Animar | clips com licença conhecida, proveniência e retarget declarado | Animações de `Quaternius`, **CC0 declarado pelo autor do vídeo** (não re-verificado na fonte) | Captura de movimento; keyframe manual; retarget de clips licenciados |
| Exportar para o destino de consumo | arquivos + manifesto de importação com escala, eixos, unidades, FPS, root motion e pontos de colisão/hitbox | **Godot** (`godotengine/godot` @ `069458825a8e`, MIT) como **destino de consumo** Game Asset | Outras engines/consumidores como novos targets (§Destinos de utilização), sem criar módulo de geração por destino |

**Preservação obrigatória nesta rota** (mesma disciplina da rota 2.5D): imagem 2D fonte; mesh bruto, watertight, high-poly e low-poly; mapas e texturas geradas; prop e combinação no DCC; rig e pesos; clips de animação; projeto/arquivos de engine; **todo conteúdo gerado por modelo identificado como tal na proveniência** (mesh, mapas, texturas), com modelo/versão/seed/parâmetros redigidos e hashes de input e output; ajustes manuais preservados como eventos próprios; versões e iterações encadeadas, sem sobrescrever a anterior.

**Bloqueios e limites registrados:**

1. **Hardware/backend:** os requisitos declarados são Windows + GPU **NVIDIA** com **CUDA 12**/PyTorch 2.8/Python 3.12, ~26 GB de disco, testados em RTX 5080 (16 GB) e declarados funcionais em 8–12 GB com configurações menores. O alvo de homologação da Forge é **Windows + AMD RX 580 8 GB** (ADR-001 Decisão 5): para esse alvo a rota é **`BLOCKED`/`unknown`** — nenhuma adaptação (ROCm, DirectML ou outro backend) foi testada ou aprovada aqui.
2. **Direitos por componente:** GPL-3.0 nos nós de malha/mapa/textura; MIT **escopado** no repositório do autor (exclui explicitamente nós e modelos); **FLUX.2 Klein não comercial** para texturização; ActionForge e VARCO 3D sem licença verificada; CC0 de animações declarado por terceiro. Wrapper, instalador ou workflow **não** cobre pesos, modelos, datasets nem outputs.
3. **Rotas não offline:** ActionForge e VARCO 3D são serviços hospedados — implicam envio de mesh/dados para fora do ambiente local, com termos e retenção desconhecidos.
4. **Conteúdo patrocinado e afiliados:** o vídeo de origem é patrocinado (VARCO 3D, da NC AI) e traz links de afiliados declarados (TripoAI, 3DAIStudio, Hitem3D, MeshyAI, RunPod), que **não** são ferramentas usadas no vídeo nem candidatos avaliados.
5. **Estado por etapa:** todos os candidatos acima permanecem `EXPERIMENTAL`/`NOT_VERIFIED`; nenhum vira claim `supported`/`partial` sem probing runtime, conformance e licença verificada ([`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md)).


### Rotas candidatas identificadas em fontes externas de 2026-11-11 (sem execução, sem decisão)

A pesquisa dos itens 13 a 16 de [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md) apontou três rotas e um nó de plano que **não existem no checkout** (busca por `audio`, `sfx`, `sound`, `splat`, `spz`, `gaussian`, `video`, `ffmpeg`, `timeline`, `composer` e `psd` retorna 0 arquivos). São registradas aqui como candidatas, com etapas hipotéticas e bloqueios — **não** como rotas aprovadas, e nenhum provider foi escolhido.

| Rota candidata | Etapas hipotéticas | O que a Forge já tem | Bloqueio atual |
|---|---|---|---|
| **Ambiente / cenário a partir de imagem** (estático) | Imagem → análise literal e inventário de objetos → clean plate por subtração (remover objetos de primeiro plano preservando cenário, materiais, iluminação, atmosfera, câmera e layout) → geração de world/mesh de ambiente → colisão/ocupação → export para destino | Categoria "ambientes, cenários, fundos estáticos, camadas, profundidade e parallax" já está no escopo de assets; taxonomia de código valida apenas `character`/`item`; rota `PLANNED` | Provider (todos os candidatos observados são cloud e pagos: World Labs Marble; TripoSplat), direitos, custo, privacidade (upload da imagem), extensão de taxonomia e decisão sobre splats |
| **Gaussian splats (`.spz`) como representação de ambiente** | Ingestão de `.spz` → visualização/inspeção → derivação de colisão ou proxy de malha → registro como `Artifact` com hash e proveniência → export | Nada. `MODEL_EXTENSIONS` cobre `.blend`, `.glb`, `.gltf`, `.fbx`, `.obj`, `.stl` | Decisão humana prévia: splats entram no escopo de asset? Formatos são capacidades, não dependências de software (proposta §9.2/§9.4) — entraria como formato de `Artifact` e validador, nunca como módulo |
| **Vídeo como capacidade de produção** (trailer, cinematic, showcase, docs-to-video) | Assets/spritesheets aprovados → composição declarativa (cena, trilhas, tempos, câmera, legendas) → validação de pureza determinística → render por quadro → encode → validação de mídia temporal (codec, fps, duração, resolução, trilhas) → revisão humana → export | Render determinístico **de imagem** já existe (Blender, spritesheet) e serve de precedente para o checklist de pureza; vídeo consta apenas como **destino de consumo** | Contrato de mídia temporal não existe na spec v1; backend candidato (`hyperframes`, Apache-2.0) exige Node 22+, FFmpeg e Chrome headless com consentimento, telemetria desligada por padrão e decisão sobre cloud render; nada testado no alvo AMD RX 580 |
| **Áudio e SFX** (ambiente em loop, SFX por objeto, voz) | Descrição/objeto → geração de SFX → validação de formato/duração/loop → vínculo ao asset por relação → export | Nada | Decisão humana: áudio é escopo da Forge ou apenas do destino? Providers observados são cloud (ElevenLabs SFX via FAL; catálogo de música/som do ArtCraft), com custo e direitos próprios |

**Nó de plano candidato (não é rota):** *staging* de cena — compor câmera, pose, posicionamento, camadas e máscaras **antes** do nó de geração, com esses dados como inputs declarados e versionáveis. Encaixa em `WorkflowPlan` ([`WORKFLOW-ENGINE.md`](WORKFLOW-ENGINE.md)) e na rota já documentada `Manequim ou sequência de poses → 2D`; **não deve virar módulo de composição separado**. O manequim posado passa a ser `Asset` de referência ligado por `lia.rel.uses_reference`, não prompt solto.

**Distinção obrigatória (destino × categoria):** vídeo/streaming já está registrado como **destino de consumo** possível na seção seguinte, e destinos são consumidores, não módulos de geração. Se vídeo virar **capacidade de produção**, ele entra como categoria/rota com contrato e backend próprios, e o destino continua sendo apenas o alvo de exportação — as duas coisas não se confundem nem se substituem. O mesmo vale para áudio.

**O que se aproveita destas fontes sem adotar providers:** as convenções de linhagem e preservação do image-blaster (indexação `N-slug` com sidecar oculto de request, `N=0` como origem, política disk-first em que URLs de provider são apenas proveniência/retomada, e "local repair" que preenche arquivos faltantes **sem criar nova geração**); a disciplina de análise de objetos (itens atomicamente segmentáveis, sem assets compostos, sem elementos de superfície do cenário); e o checklist de pureza determinística do hyperframes (sem relógio de parede, sem aleatoriedade não semeada, sem rede durante o render, saída fixa, duração finita).

## Destinos de utilização

Dois destinos de primeira classe são registrados explicitamente. Eles são **consumidores dos assets, não módulos de geração separados**:

- **Game Asset:** personagens, roupas, cabelos, animações, spritesheets, tilesets e outros assets destinados a jogos, com engine/versão e requisitos próprios.
- **Lia Desktop Asset:** personagem principal da Lia, roupas alternativas, cabelos, expressões, acessórios e animações para uso no desktop (pet/overlay/wallpaper), com requisitos próprios de transparência, loop, resolução, desempenho e empacotamento.

Regras:

1. **Nenhuma distinção estrutural entre os destinos.** Ambos utilizam o mesmo sistema de assets, contratos, formatos, pipelines e mecanismos de versionamento. Não há árvore de projeto, schema, store, rota, UI ou módulo de geração separado por destino, nem arquitetura distinta para “personagens de jogos” e “personagens da Lia”.
2. **Destino é requisito de compatibilidade/consumo**, registrado como target/declaração de exportação (formato, resolução, transparência, FPS/loop, empacotamento, tamanho, plataforma) — nunca como identidade nova do asset.
3. **Um mesmo asset pode ser publicado para vários destinos** sem duplicar sua identidade nem sua origem: cada exportação é uma nova entrega/versão ligada ao mesmo Asset, com proveniência e hashes próprios.
4. **A Forge não se limita a esses destinos.** Avatares, experiências interativas, vídeo/streaming, impressão e outros consumidores podem ser acrescentados como novos targets, sem criar módulos de geração.
5. Nada aqui autoriza integração com Lia Desktop, engine de jogo ou qualquer consumidor: publicar/exportar continua ação explícita do usuário, com direitos e consentimento por efeito e nenhum envio de dados por padrão.

## Prioridade de primeira fatia

A primeira fatia de produção a provar é um **humanoide estilizado de corpo inteiro**, com pelo menos uma rota selecionada (a definir), artefatos reais, contrato por estágio e revisão humana. A prioridade não autoriza escolher provider/modelo, baixar pesos nem pressupor hardware. Paralelamente, o fluxo local existente **modelo 3D → spritesheet** deve ser validado como uma fatia independente, e a rota Brief → 2D deve poder avançar sem aguardar o pipeline 3D.

## Contratos mínimos por nó

Cada etapa deve declarar:

- `inputContracts`: ID, tipo semântico, formato, origem/parent, limites e validador;
- `outputContracts`: IDs, formatos, quantidade/optionalidade e critérios de estrutura;
- capability e adapter necessários, versões e requisitos reais reportados;
- se lê ou envia prompt/referência/modelo, se instala/baixa algo, destino e custo conhecido/desconhecido;
- política de overwrite, idempotência, cancelamento, retry e reconciliação;
- review humano requerida, evidence artifact e condição de aceite;
- proveniência esperada e dados que devem permanecer no sidecar/manifesto.

Um adapter pode devolver outputs parciais reais e estado `PARTIALLY_IMPLEMENTED`/`BLOCKED`; não pode completar contrato com placeholders sem identificá-los como placeholders. Um mock é válido para teste de protocolo, não para declarar geração/renderer verificado.

## Regras de ponto de entrada e retomada

1. Identificar os artefatos que existem e perguntar antes de copiá-los/movê-los.
2. Validar bytes/estrutura, formato semântico, origem e licença antes do nó consumidor.
3. Construir subgrafo a partir do nó escolhido, sem executar predecessores.
4. Marcar predecessores `out_of_scope`/`reused` conforme a semântica; nunca como recém-concluídos.
5. Reutilizar saída anterior apenas se hashes, inputs, workflow/adapter e contrato ainda coincidirem e a nova execução não depender de efeito externo ambíguo.
6. Preservar a versão anterior ao editar ou converter; pedir confirmação antes de substituir o caminho de entrega.
7. Ao mudar um input, invalidar somente descendentes dependentes, não todo o projeto.

## Limite atual

O schema e a UI atuais reconhecem `character`/`item`, uma progressão 3D → 2D e outputs manuais. O código tem caminhos reais de concept PNG via ComfyUI e render de modelo existente via Blender. Não há rotas executáveis para ambientes, manequins, geração procedural, imagem→3D, edição/conversão geral nem outros tipos de asset. **Também não há nada executável na rota 2.5D em camadas**: nenhum separador de partes, exportador de PSD, editor/rig 2.5D, runtime de animação, adapter ou destino de publicação (jogo/Lia Desktop) foi implementado, instalado, chamado ou testado; `image-to-psd` e `doll-studio` são apenas candidatos documentais com direitos pendentes. Veja a matriz por arquivo em [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md).