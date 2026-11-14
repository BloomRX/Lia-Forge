# 03 — Pesquisa técnica: Three.js para o viewport da Lia Forge

> **Base de verificação:** pacote oficial `three@0.187.0` baixado do npm registry (4.795.351 bytes de tarball, 24 MB descompactado, 1.277 arquivos) e re-inspecionado na revisão final de 2026-11-13; documentação oficial em `threejs.org`; release do Electron 45; wiki de requisitos do WebGPU; docs do Electron. Nada foi adicionado ao repositório.
> **Regra:** o que foi lido no código publicado do pacote está marcado “verificado no pacote”; o que é recomendação está marcado “recomendação”.

## 0. Correções aplicadas na revisão final (2026-11-13)

A verificação técnica da revisão corrigiu quatro afirmações da primeira versão desta pesquisa. Todas foram conferidas no código do pacote `three@0.187.0`:

| Afirmação anterior | Correção | Fonte no pacote |
|---|---|---|
| “Raycast de `SkinnedMesh` usa a bind pose” | **Errado.** O raycast usa a **pose atual** via `getVertexPosition()`; o problema real é que `boundingSphere`/`boundingBox` são cacheados e não se atualizam sozinhos durante a animação | `src/objects/SkinnedMesh.js` (raycast, computeBoundingSphere, getVertexPosition) |
| “Para bounds de skinned mesh, usar a pose atual, não o bind” | **Parcialmente errado.** `Box3.setFromObject(obj, precise=true)` chama `getVertexPosition()` e **inclui skinning**; sem `precise`, usa `object.boundingBox` (que em `SkinnedMesh` também aplica skinning, mas só se calculado) | `src/math/Box3.js` (expandByObject), `SkinnedMesh.computeBoundingBox` |
| “`GLTFExporter` não gera KTX2” | **Impreciso.** O `GLTFExporter` não gera; existe `KTX2Exporter` separado (r187), não integrado e baseado em `DataTexture`/libs KTX | `examples/jsm/exporters/KTX2Exporter.js` |
| “Telemetria é igual nos dois backends” | **Errado.** `WebGPURenderer` expõe `info.memory.texturesSize` (bytes) e `render.drawCalls`; `WebGLRenderer` expõe contadores `geometries/textures` e `render.calls/triangles` | `src/renderers/common/Info.js`, `src/renderers/webgl/WebGLInfo.js` |

Nenhuma recomendação de arquitetura mudou por causa disso; os critérios de aceite e a UX foram ajustados para refletir o comportamento real.

## 1. Versão, licença e peso

| Item | Valor | Fonte |
|---|---|---|
| Versão atual | **`0.187.0`** (r187) | `registry.npmjs.org/three/latest` (consultado 2026-11-13) |
| Licença | **MIT** | `package.json`/`LICENSE` do pacote |
| Dependências de runtime | **nenhuma** (sem `dependencies`) | `package.json` do pacote |
| Tarball / descompactado | 4,8 MB / 24 MB | `npm pack` + `du` nesta sessão |
| `build/three.module.js` | 644 KB crus · **126 KB gzip** | medição nesta sessão |
| `build/three.webgpu.js` | 1,3 MB crus · **258 KB gzip** | medição nesta sessão |
| Addons | `three/addons/*` → `examples/jsm/*` | `exports` do pacote |
| Decoders opcionais | Draco wasm 192 KB (`gltf/`) / 286 KB (completo); Basis/KTX2 wasm 527 KB | `examples/jsm/libs/` |

**Consequência para o produto:** o custo de bundle é aceitável **se** o viewport for carregado sob demanda (`import()` dinâmico). Carregar Three.js no bundle inicial em uma app Electron é desperdício: 79% dos usuários podem nunca abrir um modelo.

## 1.1 Matriz de conferência técnica (revisão final)

Cada tópico pedido na revisão foi conferido no pacote `three@0.187.0` e/ou na documentação oficial. “Suportado” significa que a API existe e faz o que a proposta precisa; não significa que o produto já exista.

| Tópico | O que foi conferido | Veredito para a Lia | Cuidado real |
|---|---|---|---|
| **WebGL2** | `WebGLRenderer`, addon `WebGL.isWebGL2Available()`, contexto WebGL2 no Chromium 156 | **Piso obrigatório** | Não medido nesta máquina; testar no primeiro E2E |
| **WebGPU** | `WebGPURenderer` (`three/webgpu`), fallback automático, `forceWebGL`, `await init()` | **Opcional, não requisito** | `requestAdapter()` pode falhar; `ShaderMaterial` não é confiável |
| **GLTFLoader** | `parse/parseAsync/load`, `setDRACOLoader/KTX2Loader/MeshoptDecoder`, 52 identificadores de extensão | **Suficiente** para inspeção | `.gltf` externo exige protocolo/allowlist |
| **GLTFExporter** | `parse/parseAsync`, opções `binary/trs/onlyVisible/maxTextureSize/animations`; sem Draco/KTX2 | **Só derivado explícito** | Perde extensões desconhecidas; `onlyVisible` padrão `true` |
| **OrbitControls** | `extends Controls`, `connect/disconnect/dispose`, `update(deltaTime)`, damping | **Pronto para uso** | Damping exige `update()` contínuo |
| **TransformControls** | `extends Controls`, `getHelper()` obrigatório, `attach/detach`, `setMode/setSpace`, eventos `dragging-changed`/`objectChange` | **Pronto, com disciplina** | Não é `Object3D`; exige undo/redo e escopo |
| **AnimationMixer** | `clipAction`, `setTime`, `update`, `timeScale`, `stopAllAction`, `uncacheClip/Root` | **Pronto para tocar/inspecionar** | Não é editor; um mixer por conjunto animado |
| **SkeletonHelper** | `extends LineSegments`, `updateMatrixWorld`, `dispose()` | **Pronto** | Não mostra roll/orientação como Blender |
| **Materiais PBR** | `MeshStandardMaterial`/`MeshPhysicalMaterial`, canais e extensões `KHR_materials_*` | **Leitura pronta** | Cor depende de `outputColorSpace` e tone mapping |
| **Texturas e UVs** | `flipY=false`, `colorSpace`, `texture.channel`, `KTX2Loader.detectSupport` | **Leitura pronta** | VRAM é aritmética, não medição; 4K derruba orçamento |
| **Scene graph** | `traverse`, `attach`, `matrixWorldAutoUpdate`, `layers`, nomes não únicos | **Base pronta** | IDs estáveis precisam ser da Lia |
| **Raycasting** | `Raycaster.setFromCamera`, `intersectObjects`, skinning na pose atual, `boundingSphere` cacheada | **Pronto** | Recalcular bounds em personagem animado |
| **Descarte de recursos** | `dispose()` em geometria/material/textura, `renderer.dispose()`, `forceContextLoss()`, `ResourceTracker` (manual) | **Obrigatório** | Vazamento é o risco nº 1; testar 10 ciclos |
| **Memória** | `renderer.info.memory`, `app.getAppMetrics()`, VRAM estimada | **Medição necessária** | WebGL e WebGPU expõem campos diferentes |
| **Electron** | `sandbox`, `contextIsolation`, CSP, `protocol.handle`, preload sem `Buffer` | **Compatível** | CSP e protocolo ainda não existem no app |

### 1.2 Visualização não é edição

A confusão mais perigosa desta frente é tratar “existe `TransformControls`” como “a Lia Forge pode editar modelos”. Não pode, por decisão de produto e por contrato:

- **Fase 1** não tem seleção nem gizmo; é visualização.
- **Fase 2** pode ter transformação **de sessão**, gravada em `View3DOverrides` e aplicada a cópias — nunca ao arquivo.
- **Fase 3** pode inspecionar material e, só com a decisão 47 aprovada, sobrescrever parâmetros em sessão.
- **Rig, UV, malha, textura pintada, animação autoral e bake** continuam no Blender, em qualquer fase.
- O viewport **não exporta sozinho**: exportação derivada é Fase 5, com relatório de diferenças; exportação para destino continua em `exportRun`.

## 2. Renderizadores: WebGL2 x WebGPU

### 2.1 O que o pacote realmente faz (verificado)

- `WebGLRenderer` continua sendo o renderer clássico, estável, com `info`, `dispose`, `forceContextLoss`, `setAnimationLoop`.
- `WebGPURenderer` importado de `three/webgpu`:
  - tenta WebGPU e **cai automaticamente para um backend WebGL 2** quando não há suporte;
  - aceita `forceWebGL: true`;
  - inicialização é **assíncrona** (`await renderer.init()`; `setAnimationLoop` e `dispose` também são assíncronos) e `render()` síncrono exige `init()` concluído;
  - usa o sistema de materiais em nós (TSL) para compilar WGSL **ou** GLSL conforme o backend;
  - **não** expõe `WebGLRenderer`; o caminho de material é `NodeMaterial`/TSL, e `ShaderMaterial`/`onBeforeCompile` **não são suportados de forma confiável** (o backend tenta montar um `NodeMaterial` e registra erro de build quando não consegue);
  - Fonte: `src/renderers/webgpu/WebGPURenderer.js` e manual oficial [`WebGPURenderer`](https://threejs.org/manual/pages/webgpurenderer.html).

### 2.2 Addons e o backend novo

- `KTX2Loader.detectSupport(renderer)` **já aceita** `WebGPURenderer` e usa `renderer.hasFeature(...)` para escolher o formato de transcodificação (`examples/jsm/loaders/KTX2Loader.js`, verificado no pacote). Isso remove um dos maiores receios de adotar WebGPU — mas `hasFeature()` **lança erro se chamado antes de `await renderer.init()`**, então a ordem de inicialização é parte do contrato.
- Controles (`OrbitControls`, `TransformControls`), helpers e `AnimationMixer` são independentes de backend.
- Pós-processamento tem duas pilhas: `EffectComposer` (clássica) e pipeline de nós do WebGPU. Misturar as duas não é suportado.

### 2.3 Recomendação para a Lia Forge

| Decisão | Recomendação | Justificativa |
|---|---|---|
| Renderer padrão da Fase 1 | **`WebGLRenderer`** | Ecossistema comprovado (loaders, pós-processamento, exemplos, depuração), menor risco em GPU antiga, sem `await init()` |
| WebGPU | **Opcional, atrás de flag/probe**, com fallback automático | Não há evidência de WebGPU na RX 580 desta máquina; ver [`09`](09-HARDWARE-E-DESEMPENHO.md) |
| Caminho de migração | Manter a camada de viewport isolada do renderer (interface `ViewportRenderer`) | Trocar WebGL↔WebGPU depois sem reescrever UI e contratos |
| Materiais customizados | Evitar na Fase 1; se necessário, TSL | Para suportar os dois backends no futuro |

**Não recomendado:** adotar `WebGPURenderer` como requisito na primeira fatia. O ganho de desempenho é dependente de carga e não medido neste hardware; o custo de migração de shaders e de maturidade de ferramentas é real.

## 3. Carregamento de GLB/glTF

### 3.1 API e modos

| Recurso | API verificada | Observações |
|---|---|---|
| Parse de bytes | `loader.parse(data, path, onLoad, onError)` e `loader.parseAsync(data, path)` | Ideal para bytes vindos de IPC/HTTP; `path` é a base para recursos externos |
| Load por URL | `loader.load(url, ...)` | Ideal para protocolo customizado com streaming/Range |
| Decoders | `setDRACOLoader`, `setKTX2Loader`, `setMeshoptDecoder` | Devem ser configurados **antes** do parse |
| Extensões suportadas | 52 identificadores `KHR_*`/`EXT_*` no loader (r187) | Inclui Draco, Meshopt, KTX2 (BasisU), WebP/AVIF, `KHR_lights_punctual`, `KHR_materials_*`, `KHR_animation_pointer`, `KHR_materials_variants`, gaussian splatting |
| Texturas | `ImageBitmapLoader` disponível; upload assíncrono | Decodificação de imagem é assíncrona mesmo com `parse()` |

### 3.2 O que o loader **não** resolve

- **`.gltf` com recursos externos**: `.bin`, texturas e `.bin` de Draco vêm por URL relativa. No Electron isso exige protocolo customizado com allowlist de diretório — não `file://` e não `webSecurity: false`.
- **KTX2/Draco/Meshopt não são “de graça”**: exigem os arquivos wasm/js do transcoder, servidos por caminho configurado (`setDecoderPath`/`setTranscoderPath`), o que **não** é copiado automaticamente pelo Vite.
- **Semântica do modelo**: o loader entrega o que o arquivo declara. Ele não valida rig, unidades, eixos, root motion, materials variant semantics nem “qualidade”.
- **Normalização de nomes**: nomes de nós/materiais podem vir vazios, duplicados ou com caracteres arbitrários; a UI precisa de IDs estáveis gerados pela Lia, não do nome do arquivo.

### 3.3 Workers e CSP (verificado no pacote)

`DRACOLoader` e `KTX2Loader` criam workers a partir de `URL.createObjectURL(new Blob([...]))` (`DRACOLoader.js:430`, `KTX2Loader.js:342`). Isso implica:

- CSP precisa de `worker-src blob:` (ou `child-src blob:`) e `script-src` compatível com o bundle;
- compilação de WebAssembly exige `'wasm-unsafe-eval'` em `script-src` quando há CSP (o `unsafe-eval` mais amplo também funciona, mas é pior);
- sem CSP hoje, tudo funciona — mas o renderer fica sem barreira. Ver [`05`](05-ARQUITETURA-PROPOSTA.md) §6.4.

## 4. Cena, hierarquia e inspeção geométrica

| Necessidade | Recurso nativo | Observações |
|---|---|---|
| Percorrer cena | `Object3D.traverse` | Construir um “scene index” serializável para o React (sem expor objetos Three) |
| Bounds | `Box3.setFromObject(object, precise?)` | `precise` percorre vértices e **aplica skinning** via `getVertexPosition()`; sem `precise`, usa o bound do objeto/geometria. Em personagem animado, recalcular quando a pose mudar |
| Escala/unidades | Matrizes + `Box3` | Não há unidade no glTF; reportar “unidades do arquivo” e comparar com expectativa do destino |
| Estatísticas | `BufferGeometry.attributes.position.count`, `index.count`, `groups` | Triângulos reais por primitiva |
| UVs/normais | Atributos de geometria | Visualização é desenvolvimento Lia |
| Skinning | `SkinnedMesh.skeleton.bones`, `SkeletonHelper` | Nomes de bones vêm do arquivo |
| Materiais | `MeshStandardMaterial`/`MeshPhysicalMaterial`; `material.map`, `normalMap`, `roughnessMap`, etc. | glTF mapeia para esses materiais |
| Câmeras/luzes no arquivo | `PerspectiveCamera`, `OrthographicCamera`, `KHR_lights_punctual` | Uma cena pode ter câmeras próprias; decidir se são usadas como “view” ou só exibidas |

### 4.1 Scene graph: fatos que afetam a UI

- `Object3D.traverse()` percorre a árvore; `attach()` preserva a transformação mundial ao reparentar (útil para overrides, **não** para editar o arquivo).
- `matrixAutoUpdate`/`matrixWorldAutoUpdate` controlam atualização de matrizes; `updateMatrixWorld(true)` é obrigatório antes de medir bounds/picking após uma transformação manual.
- Nomes de nós **não são únicos nem garantidos**; `userData` pode vir de qualquer exportador. IDs estáveis têm de ser gerados pela Lia (caminho + índice + hash do nó), não pelo nome.
- `Object3D.layers` permite separar helpers (grade, skeleton, gizmo) da cena inspecionada; é a forma limpa de não “sujar” o raycast.
- Animação referencia alvos por nome/uuid; se o arquivo tiver nomes duplicados, o loader pode ligar tracks ao nó errado — isso é uma **observação de diagnóstico**, não algo que o viewport corrige.

**Limite importante:** glTF não carrega topologia semântica (quads, n-gons, loops, seams, sharp edges). “Visualizar topologia” no sentido Blender **não é possível**; é possível mostrar wireframe, densidade de triângulos e grupos de material. Isso está registrado na matriz como `BLENDER`/limitação.

## 5. Câmera e controles

| Recurso | API verificada | Cuidados |
|---|---|---|
| `OrbitControls` | `enableDamping` + `update()` por frame; `target`; `minDistance/maxDistance`; `enablePan` | Damping exige loop contínuo ou render-on-demand com `update()` |
| `TransformControls` | `getHelper()` (o gizmo precisa ser adicionado à cena), `attach/detach`, `setMode('translate'/'rotate'/'scale')`, eventos `dragging-changed` e `objectChange` | Desabilitar `OrbitControls` enquanto `dragging` é `true` |
| Câmera ortográfica | `OrthographicCamera` com `frustumSize`/aspect | Alternar perspectiva↔orto exige recalcular zoom/frustum e reconfigurar controles; é um ponto clássico de bug |
| Foco no selecionado | `Box3` + `camera.position`/`target` | Considerar margem de 10-20% e `controls.update()` |
| View cube / eixos | `ViewHelper` (addon oficial) | Bom substituto de “view gizmo” sem escrever shader |

**Recomendação de UX técnica:** usar um único `OrbitControls` com **render sob demanda** e um flag `needsRender`; só ligar loop contínuo em animação ou damping ativo. Isso reduz consumo de GPU quando o app está parado — crítico com Blender/jogo abertos.

## 6. Materiais e texturas

### 6.1 Inspeção PBR

- glTF → `MeshStandardMaterial` (ou `MeshPhysicalMaterial` para extensões como clearcoat/transmission).
- Campos úteis para inspeção: `color`, `metalness`, `roughness`, `emissive`, `emissiveIntensity`, `normalScale`, `alphaTest`, `transparent`, `opacity`, `side`, `map`, `normalMap`, `roughnessMap`, `metalnessMap`, `aoMap`, `emissiveMap`.
- **Cuidado com cor:** julgar cor sem `outputColorSpace` correto e tone mapping definido produz conclusão errada. O viewport deve declarar o pipeline de cor usado.
- **Cuidado com textura compartilhada:** trocar `material.map` em um material “clonado” evita mutar o original; `material.clone()` compartilha texturas por referência (bom: sem duplicar VRAM).

### 6.1.1 Texturas e UVs: o que é fato

| Tema | Fato verificado no pacote r187 | Consequência |
|---|---|---|
| `flipY` | O `GLTFLoader` define `texture.flipY = false` | Correto para glTF; não “consertar” para `true` sem motivo |
| Espaço de cor | `baseColorTexture` e `emissiveTexture` recebem `SRGBColorSpace`; mapas de dados ficam lineares | Julgar cor sem isso produz erro |
| Canal UV | `texture.channel` é preenchido a partir de `texCoord` (`KHR_texture_transform` também altera) | É o “UV set” visível na inspeção; `TEXCOORD_0/1` |
| Formato comprimido | `KTX2Loader.detectSupport(renderer)` funciona em WebGL e WebGPU | Transcodificação depende das extensões da GPU |
| Cor padrão do renderer | `outputColorSpace = SRGBColorSpace` e `toneMapping = NoToneMapping` por padrão (WebGL) | O viewport precisa **escolher e declarar** tone mapping; o padrão não é “neutro” para julgamento artístico |
| Textura compartilhada | `material.clone()` compartilha texturas por referência | Override de parâmetro não duplica VRAM; trocar textura exige política |

### 6.2 Memória de textura (aritmética, não medição)

| Resolução | RGBA8 base | Com mipmaps (~+33%) | 10 texturas iguais |
|---|---|---|---|
| 512² | 1,0 MB | 1,33 MB | 13,3 MB |
| 1024² | 4,2 MB | 5,6 MB | 56 MB |
| 2048² | 16,8 MB | 22,4 MB | 224 MB |
| 4096² | 67,1 MB | 89,5 MB | 895 MB |

Isso é **aritmética**, não medição: o driver pode arredondar, comprimir ou paginar. Mas explica por que “abrir um GLB de 200 MB” pode derrubar uma máquina de 16 GB se o arquivo tiver 4K não comprimido. KTX2/Basis reduz drasticamente (fica comprimido na GPU), mas exige transcoder e nem toda GPU-alvo suporta todos os formatos.

### 6.3 Ambiente de iluminação para inspeção

- `RoomEnvironment` + `PMREMGenerator` (ambos oficiais, MIT) dão um estúdio neutro sem HDRI externo e sem licença de imagem.
- Alternativa mínima: `HemisphereLight` + 2 `DirectionalLight` + fundo neutro — mais barato, menos fiel a PBR.
- **Não** usar HDRI de terceiros sem licença; não empacotar textura de ambiente sem proveniência.

## 7. Animação e personagens

| Necessidade | API | Limite real |
|---|---|---|
| Tocar clipe | `AnimationMixer` + `clipAction(clip).play()` | Um mixer por conjunto de objetos animados; vários mixers exigem cuidado com o mesmo root |
| Velocidade | `mixer.timeScale` e `action.timeScale` | — |
| Scrub | `mixer.setTime(t)` (aplicado a todos os clipes; escala por `timeScale`) ou `action.time = t` | Pausar antes de scrub; `setTime` chama `update()` |
| Loop/ping-pong | `setLoop(THREE.LoopRepeat, n)` | — |
| Keyframes | `AnimationClip.tracks[i]` com `.times`, `.values`, `.name` | Acesso a dados, não a edição |
| Esqueleto | `SkeletonHelper` | Mostra linhas entre bones; não mostra roll/orientação como Blender |
| Pesos de skin | `geometry.attributes.skinWeight`, `skinIndex` | Visualização exige shader próprio |
| Morph targets | `mesh.morphTargetInfluences` | Sem UI de edição |
| IK/constraints/NLA | **inexistente** | `BLENDER` |

**Classificação honesta:** Three.js é excelente para **tocar e inspecionar** animação; não é editor. Timeline com scrub e comparação de clipes é `DESENVOLVIMENTO LIA` em cima de API nativa. Edição de keyframes, blending complexo, retarget e correção de foot sliding continuam no Blender.

## 8. Recursos, memória e descarte

Fato documentado no manual oficial ([Cleanup](https://threejs.org/manual/pages/cleanup.html)): o Three.js **não** libera VRAM automaticamente; é preciso chamar `dispose()` em geometrias, materiais, texturas e render targets, e remover objetos da cena.

Padrão recomendado (adaptado do manual, sem copiar código de terceiros — o padrão `ResourceTracker` é exemplo da própria documentação):

1. Toda criação de recurso passa por um `ResourceTracker` da sessão.
2. Ao fechar/trocar de modelo: parar `setAnimationLoop`, `mixer.stopAllAction()` + `mixer.uncacheRoot(root)`/`uncacheClip()`, `scene.clear()`, `tracker.dispose()`, `renderer.renderLists.dispose()` (WebGL), `renderer.dispose()` (no WebGPU, `await`), `renderer.forceContextLoss()` (WebGL), remover canvas do DOM. `SkeletonHelper` e `ViewHelper` têm `dispose()` próprio.
3. Em caso de erro no meio do load: descartar o parcialmente carregado também (senão vaza).
4. Telemetria: `renderer.info.memory.geometries/textures`, `renderer.info.render.calls/triangles`; no Electron, `app.getAppMetrics()` para memória por processo (inclui GPU).

**Medido no pacote:** `WebGLInfo` mantém contadores `geometries`, `textures`, `calls`, `triangles`, `points`, `lines` (`src/renderers/webgl/WebGLInfo.js`). É a base para o HUD de desempenho e para os critérios de aceite de “sem vazamento”.

## 9. Picking e seleção

- `Raycaster.setFromCamera(ndc, camera)` + `intersectObjects(root.children, true)`.
- Para `SkinnedMesh`, o raycast **considera a pose atual** (`getVertexPosition()` aplica skinning). O cuidado real é outro: `boundingSphere` é calculado uma vez e **não** é atualizado automaticamente quando o esqueleto anima; se a esfera ficar desatualizada, o raycast pode descartar o objeto antes de testar a geometria. Recalcular `computeBoundingSphere()`/`computeBoundingBox()` após mudanças de pose, ou usar um proxy/bounds conservador.
- Em cenas com centenas de milhares de triângulos, raycast por triângulo a cada `pointermove` é caro. Opções: raycast só no clique, throttle no hover, camadas de colisão simplificadas, ou `three-mesh-bvh` (`MIT`, aceleração por BVH).
- “Selecionar partes do personagem”: funciona por nó/mesh do glTF; não por “peça” semântica (braço, luva) a menos que o arquivo tenha nós nomeados para isso.

## 10. Pós-processamento

| Recurso | Uso | Custo/observação |
|---|---|---|
| `EffectComposer` + `RenderPass` + `OutputPass` | Pipeline correto de cor/saída | Obrigatório em cadeia de passes; sem `OutputPass` a cor quebra |
| `OutlinePass` | Destaque de seleção | Custa um passe extra; bom para “modo profissional” |
| SSAO/bloom/DOF | Qualidade visual | **Não recomendado** por padrão na RX 580 e em notebooks modestos |
| WebGPU `RenderPipeline` | Equivalente no backend novo | Não combinar com `EffectComposer` |

**Recomendação:** seleção por `BoxHelper`/material tint na Fase 2; `OutlinePass` como opção na Fase 2/3. Pós-processamento nunca habilitado por padrão.

## 11. Carregamento assíncrono, workers e responsividade

- O parse de glTF é majoritariamente síncrono em JS (exceto imagens e decoders em worker). Um GLB de 100 MB pode travar a thread principal por centenas de ms a segundos.
- Mitigações: carregar em `requestIdleCallback`/após o primeiro frame; mostrar progresso real por etapa (bytes lidos, parse, texturas); usar `LoadingManager.onProgress` para bytes; limitar tamanho por padrão; permitir cancelar (AbortController no fetch; descartar resultado).
- Workers de decoders do Three.js já resolvem Draco/KTX2/Meshopt fora da thread principal. **Não** é necessário mover a cena inteira para um worker para a Fase 1.
- OffscreenCanvas (manual oficial [`offscreencanvas`](https://threejs.org/manual/pages/offscreencanvas.html)) é uma otimização futura, não um requisito.

## 12. Electron: o que muda

| Tema | Fato | Implicação |
|---|---|---|
| Chromium | Electron 45 → Chromium **156** | WebGL2 e WebGPU disponíveis no motor; suporte real depende de driver/blocklist |
| Sandbox do renderer | `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` | Three.js roda no renderer sem Node; bytes vêm por IPC/HTTP |
| IPC | Structured clone transfere `ArrayBuffer`/`Uint8Array` | Evitar base64 para arquivos grandes (33% de overhead e duas cópias) |
| Preload sandbox | Electron 45 removeu `Buffer`, `setImmediate`, `clearImmediate`, `events`, `timers` e `url` do preload sandboxed | **Verificado nesta sessão:** `electron/preload.cjs` só chama `require('electron')`, não referencia `Buffer` nem `setImmediate` — o preload atual é compatível e não precisa mudar |
| Protocolo customizado | `protocol.registerSchemesAsPrivileged` + `protocol.handle`, com `initiatorOrigin` na request | Caminho recomendado para streaming e para `.gltf` com recursos externos |
| Arquivos arrastados | `webUtils.getPathForFile(file)` no preload | Único jeito correto de obter caminho de `File` |
| Métricas | `app.getAppMetrics()` (processos, memória, GPU) | Base do HUD de memória sem inventar números |
| Crash de GPU | precisa de `webglcontextlost`; processo GPU pode morrer | Recuperação deve recriar a sessão a partir da fonte (read-only) |

**Regra para os métodos novos do módulo 3D:** no preload, somente `ipcRenderer.invoke`/`on` e tipos clonáveis (string, number, boolean, objeto simples, `ArrayBuffer`/`Uint8Array`). Nada de `Buffer`, `setImmediate`, `clearImmediate`, `events`, `timers` ou caminhos absolutos — o preload é sandboxed e essas APIs não existem mais no Electron 45.

**Recomendação de arquitetura de mídia:** um protocolo `lia3d://` (nome provisório) que serve **apenas** os arquivos autorizados por uma sessão, com token opaco, Range, e verificação de `initiatorOrigin`. O renderer nunca vê caminho absoluto. Detalhes em [`06`](06-CONTRATOS-E-INTEGRACAO.md) §6.

## 13. WebGPU: estado real e o que não dá para afirmar

| Fato | Rótulo | Fonte |
|---|---|---|
| WebGPU exige D3D12 FL 11.1 **ou** FL 11.0 + Resource Binding Tier 2 no Windows; Vulkan 1.0+ com features no Linux/Android | Documentação oficial | [gpuweb wiki — System Requirements](https://github.com/gpuweb/gpuweb/wiki/System-Requirements) |
| Dawn (implementação do Chrome) valida feature level e rejeita abaixo do mínimo | Verificado no código do Dawn | [AdapterD3D12.cpp](https://dawn.googlesource.com/dawn/+/refs/heads/main/src/dawn/native/d3d12/AdapterD3D12.cpp) |
| Chrome 146 introduziu “compatibility mode” (OpenGL ES 3.1 / D3D11), **começando por Android**; Windows/D3D11 é exploração | Documentação oficial | [What's New in WebGPU (Chrome 146)](https://developer.chrome.com/blog/new-in-webgpu-146) |
| RX 580 (Polaris/GCN4) tem D3D12 e Vulkan no Windows, mas **feature level, driver e blocklist desta máquina não foram medidos** | Não verificado | requer `chrome://gpu`/`dxdiag` na máquina do usuário |
| WebGPU no Linux no Chromium é suporte parcial | Documentação/imprensa técnica | ver [`09`](09-HARDWARE-E-DESEMPENHO.md) |

**Conclusão:** não é correto dizer “WebGPU não funciona na RX 580” nem “funciona”. O correto é: **WebGL2 é o piso obrigatório; WebGPU é experimental, detectado em runtime, com fallback automático e sem promessa**.

## 14. O que o Three.js **não** resolve (trabalho da Lia)

1. Sessão de visualização, permissões, tokens e limites.
2. Transporte de bytes grande (streaming, Range, cancelamento).
3. Persistência de overrides e decisão “o que é alteração”.
4. Undo/redo, histórico e comparação de versões.
5. Regras de diagnóstico (o que é “problema” para o produto).
6. Telemetria, guardrails de memória e mensagens ao usuário.
7. QA, aprovação humana, versionamento e exportação por destino.
8. Integração com Blender, workflows e Comparison Lab.
9. Acessibilidade, i18n e consistência visual com a Lia Forge.
10. Segurança (CSP, protocolo, allowlist, isolamento).

## 15. Fontes consultadas

**Three.js (oficial)**
- Manual: [Loading 3D Models](https://threejs.org/manual/pages/loading-3d-models.html) · [Load a .GLTF](https://threejs.org/manual/pages/load-gltf.html) · [Cleanup / Freeing Resources](https://threejs.org/manual/pages/cleanup.html) · [Picking](https://threejs.org/manual/pages/picking.html) · [Animation System](https://threejs.org/manual/pages/animation-system.html) · [WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer.html) · [Rendering on Demand](https://threejs.org/manual/pages/rendering-on-demand.html) · [OffscreenCanvas](https://threejs.org/manual/pages/offscreencanvas.html) · [Post Processing](https://threejs.org/manual/pages/post-processing.html) · [WebGL Compatibility Check](https://threejs.org/manual/pages/webgl-compatibility-check.html)
- Docs: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) · [SkeletonHelper](https://threejs.org/docs/pages/SkeletonHelper.html) · [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html) · [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) · [TransformControls](https://threejs.org/docs/pages/TransformControls.html) · [Raycaster](https://threejs.org/docs/pages/Raycaster.html) · [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)
- Pacote npm `three@0.187.0` (código-fonte citado): `src/renderers/webgl/WebGLInfo.js`, `src/renderers/common/Info.js`, `src/objects/SkinnedMesh.js`, `src/math/Box3.js`, `src/animation/AnimationMixer.js`, `src/animation/AnimationAction.js`, `src/helpers/SkeletonHelper.js`, `src/core/Raycaster.js`, `src/core/Object3D.js`, `src/textures/Texture.js`, `src/extras/PMREMGenerator.js`, `examples/jsm/loaders/{GLTFLoader,KTX2Loader,DRACOLoader}.js`, `examples/jsm/controls/{OrbitControls,TransformControls}.js`, `examples/jsm/exporters/{GLTFExporter,KTX2Exporter}.js`, `examples/jsm/helpers/ViewHelper.js`, `examples/jsm/capabilities/WebGL.js`, `examples/jsm/environments/RoomEnvironment.js`. Licença MIT.

**Electron/Chromium/WebGPU**
- [Electron 45.0.0 release notes](https://github.com/electron/electron/releases/tag/v45.0.0) (Chromium 156.0.8078.48, Node 24.22.0)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron `protocol`](https://www.electronjs.org/docs/latest/api/protocol) · [`webUtils`](https://www.electronjs.org/docs/latest/api/web-utils)
- [WebGPU System Requirements (gpuweb)](https://github.com/gpuweb/gpuweb/wiki/System-Requirements)
- [Chrome 146: WebGPU compatibility mode](https://developer.chrome.com/blog/new-in-webgpu-146)

**Formato e validação**
- [glTF 2.0 Specification (Khronos)](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) · [glTF extensions](https://github.com/KhronosGroup/glTF/tree/main/extensions)
- [glTF-Validator](https://github.com/KhronosGroup/glTF-Validator) (Apache-2.0)

> Nota de licença: o repositório `KhronosGroup/glTF` reporta `NOASSERTION` na API do GitHub; a especificação tem termos próprios e os *sample assets* têm licenças individuais. **Nada** deve ser copiado/empacotado sem checagem caso a caso.
