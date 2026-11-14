# 02 — Inventário das funcionalidades 3D existentes

> Complementa [`01-AUDITORIA-ESTADO-ATUAL.md`](01-AUDITORIA-ESTADO-ATUAL.md). Aqui cada item recebe **classificação** (rótulos definidos na missão) e **evidência**. Hoje **nenhum** item é implementado com Three.js: o que existe é código próprio, Blender ou ausência.
> **Legenda de classificação:** `JÁ IMPLEMENTADO` · `NATIVO THREE.JS` · `BIBLIOTECA COMPLEMENTAR` · `DESENVOLVIMENTO LIA` · `ADAPTER EXTERNO` · `BLENDER` · `RESEARCH ONLY` · `NÃO RECOMENDADO`.
> **Legenda de estado:** `implementado` · `parcial` · `ausente` · `bloqueado`.

## 1. Leitura e estrutura de modelos

| # | Funcionalidade | Estado real | Classificação | Evidência / limite |
|---|---|---|---|---|
| 1.1 | Abrir/validar container GLB 2 | implementado | `JÁ IMPLEMENTADO` | `shared/model3d/glb.mjs:17`; `tests/glb-inspect-smoke.mjs` |
| 1.2 | Relatório de meshes/triângulos/vértices por primitiva | implementado | `JÁ IMPLEMENTADO` | idem |
| 1.3 | Sinalizar presença de normais/UVs/joints/weights por primitiva | implementado (flags) | `JÁ IMPLEMENTADO` | `glb.mjs` `hasNormals/hasUvs/hasJoints/hasWeights` |
| 1.4 | Materiais: nome, double-sided, alphaMode, índices baseColor/normal | implementado (metadados) | `JÁ IMPLEMENTADO` | `glb.mjs` `materials` |
| 1.5 | Imagens/texturas: mime, bufferView, uri | implementado (metadados) | `JÁ IMPLEMENTADO` | `glb.mjs` `images` |
| 1.6 | Animações: nome, canais, samplers, duração máxima, targets | implementado (metadados) | `JÁ IMPLEMENTADO` | `glb.mjs` `animations` |
| 1.7 | Skins: número de juntas e raiz declarada | implementado (contagem) | `JÁ IMPLEMENTADO` | `glb.mjs` `skins` |
| 1.8 | Extensões usadas/exigidas | implementado (lista textual) | `JÁ IMPLEMENTADO` | `glb.mjs` `extensionsUsed/Required` |
| 1.9 | Hierarquia de nós (árvore, nomes, transforms) | **ausente** | `DESENVOLVIMENTO LIA` (sobre `NATIVO THREE.JS`) | `inspectGlb` só conta nós |
| 1.10 | Bounds/`Box3`, escala real, unidades | **ausente** | `NATIVO THREE.JS` + `DESENVOLVIMENTO LIA` | `Box3.setFromObject` |
| 1.11 | Validação glTF completa (spec + extensões) | **ausente** | `ADAPTER EXTERNO` (glTF-Validator, Apache-2.0) | ver [`04`](04-BIBLIOTECAS-E-REFERENCIAS.md) |
| 1.12 | Detecção de problemas comuns (normais invertidas, faces degeneradas, UV faltando, escala absurda, texturas ausentes) | **ausente** | `DESENVOLVIMENTO LIA` (diagnóstico; parte viável sem render) | exige geometria carregada |
| 1.13 | Importar FBX/OBJ/STL/PLY para visualizar | **ausente** | `NATIVO THREE.JS` (loaders) / `NÃO RECOMENDADO` no v1 | ver §1 e §6 de [`10`](10-IMPORTACAO-E-EXPORTACAO.md) |
| 1.14 | Comparar duas versões de um modelo (estrutural) | parcial | `JÁ IMPLEMENTADO` (métricas) | `ComparisonLab` mostra triângulos; sem diff de hierarquia/materiais |
| 1.15 | Comparar duas versões de um modelo (visual) | **ausente** | `DESENVOLVIMENTO LIA` | depende de viewport + captura |

## 2. Visualização de cena

| # | Funcionalidade | Estado real | Classificação | Observação |
|---|---|---|---|---|
| 2.1 | Viewport 3D | **ausente** | `DESENVOLVIMENTO LIA` | `ModelPreview` é ilustração rotulada |
| 2.2 | Câmera orbital (zoom/pan/rotate) | **ausente** | `NATIVO THREE.JS` (`OrbitControls`) | addon MIT verificado em r187 |
| 2.3 | Perspectiva ↔ ortográfica | **ausente** | `NATIVO THREE.JS` | troca de câmera + controles; ponto de atenção em `OrbitControls` |
| 2.4 | Grade e eixos | **ausente** no viewport | `NATIVO THREE.JS` (`GridHelper`, `AxesHelper`) | a ilustração atual desenha grade em CSS |
| 2.5 | Wireframe / modo de visualização | **ausente** | `NATIVO THREE.JS` (`material.wireframe`, `WireframeGeometry`) | modo por material ou overlay de arestas |
| 2.6 | Enquadrar objeto selecionado | **ausente** | `DESENVOLVIMENTO LIA` (cálculo com `Box3`) | usar margem/fov, não só `fitToBox` |
| 2.7 | Seleção por clique (picking) | **ausente** | `NATIVO THREE.JS` (`Raycaster`) | `three-mesh-bvh` só se necessário |
| 2.8 | Destaque/hover/seleção | **ausente** | `DESENVOLVIMENTO LIA` | `BoxHelper`/outline; evitar post-processing por padrão |
| 2.9 | Hierarquia de cena navegável | **ausente** | `DESENVOLVIMENTO LIA` | dados vêm do grafo Three.js para React |
| 2.10 | Visibilidade por objeto | **ausente** | `NATIVO THREE.JS` + override de sessão | reversível |
| 2.11 | Iluminação de inspeção (neutral studio) | **ausente** | `NATIVO THREE.JS` (`RoomEnvironment` + `PMREMGenerator`) | evitar HDRI externo/licença |
| 2.12 | Sombras | **ausente** | `NATIVO THREE.JS` | desligadas por padrão por custo |
| 2.13 | Tone mapping / color space correto | **ausente** | `NATIVO THREE.JS` (`outputColorSpace`, tone mapping) | crítico para julgar cor de material |
| 2.14 | Post-processing (outline, SSAO, bloom) | **ausente** | `BIBLIOTECA COMPLEMENTAR` (addons oficiais) | custo alto; só sob demanda |
| 2.15 | Backend WebGL2/WebGPU com fallback | **ausente** | `NATIVO THREE.JS` | `WebGPURenderer` cai para WebGL2 |
| 2.16 | Telemetria de GPU/frame (fps, draw calls, triângulos, memória) | **ausente** | `DESENVOLVIMENTO LIA` (`renderer.info`) | precisa existir desde a Fase 1 |
| 2.17 | Download/upload de recursos e `dispose()` | **ausente** | `DESENVOLVIMENTO LIA` | manual oficial de cleanup |
| 2.18 | Recuperação de contexto perdido | **ausente** | `DESENVOLVIMENTO LIA` | evento `webglcontextlost` |

## 3. Transformação e edição

| # | Funcionalidade | Estado real | Classificação | Observação |
|---|---|---|---|---|
| 3.1 | Gizmo de mover/rotacionar/escalar | **ausente** | `NATIVO THREE.JS` (`TransformControls`) + `DESENVOLVIMENTO LIA` | precisa de undo/redo e escopo |
| 3.2 | Foco/teclas (F, G, R, S) | **ausente** | `DESENVOLVIMENTO LIA` | atalhos só quando viewport focada |
| 3.3 | Alterações reversíveis de transform | **ausente** | `DESENVOLVIMENTO LIA` (overrides de sessão) | não altera GLB |
| 3.4 | Troca controlada de material | **ausente** | `DESENVOLVIMENTO LIA` | material clonado; nunca mutar o original |
| 3.5 | Edição de geometria/topologia | **ausente** | `BLENDER` | não recomendado no viewport |
| 3.6 | UV editing | **ausente** | `BLENDER` (edição) / `DESENVOLVIMENTO LIA` (visualização) | ver matriz |
| 3.7 | Undo/redo | **ausente** | `DESENVOLVIMENTO LIA` | necessário se houver edição |
| 3.8 | Salvamento de configuração de cena (Lia) | **ausente** | `DESENVOLVIMENTO LIA` | JSON de overrides versionável |

## 4. Materiais, texturas, personagens e animação

| # | Funcionalidade | Estado real | Classificação | Observação |
|---|---|---|---|---|
| 4.1 | Inspeção PBR (baseColor, metallic, roughness, emissive, normal, alpha) | **ausente** | `NATIVO THREE.JS` (leitura de `MeshStandardMaterial`) + `DESENVOLVIMENTO LIA` | valores declarados vs efetivos |
| 4.2 | Prévia de textura por canal | **ausente** | `DESENVOLVIMENTO LIA` | canvas/ImageBitmap; cuidado com CORS/`blob:` |
| 4.3 | Resolução/formato/VRAM estimada de textura | **ausente** | `DESENVOLVIMENTO LIA` | cálculo com mipmaps |
| 4.4 | UV visualization | **ausente** | `DESENVOLVIMENTO LIA` (shader próprio) / `RESEARCH ONLY` | viável, mas não é prioridade |
| 4.5 | Normais/tangentes debug | **ausente** | `BIBLIOTECA COMPLEMENTAR` (`VertexNormalsHelper`/`VertexTangentsHelper`) | helpers oficiais |
| 4.6 | Visualização de armature | **ausente** | `NATIVO THREE.JS` (`SkeletonHelper`) | + lista de bones |
| 4.7 | Skinning debug (pesos) | **ausente** | `DESENVOLVIMENTO LIA` / `RESEARCH ONLY` | shader custom; sem equivalência ao Blender |
| 4.8 | Reprodução de animação | **ausente** | `NATIVO THREE.JS` (`AnimationMixer`) | loop, velocidade, scrub |
| 4.9 | Timeline/keyframes | **ausente** | `DESENVOLVIMENTO LIA` (UI) + `NATIVO THREE.JS` (dados de track) | keyframes de glTF acessíveis via `AnimationClip.tracks` |
| 4.10 | Edição de animação | **ausente** | `BLENDER` | Three.js não é editor de animação |
| 4.11 | Comparação de poses/clipes | **ausente** | `DESENVOLVIMENTO LIA` | dois mixers ou snapshots |
| 4.12 | Cabelo (cards/strands) | **ausente** | `RESEARCH ONLY` / `BLENDER` | ver `character.hair` planned |

## 5. Pipeline e integração

| # | Funcionalidade | Estado real | Classificação | Observação |
|---|---|---|---|---|
| 5.1 | Render 3D→2D via Blender | implementado | `BLENDER` + `JÁ IMPLEMENTADO` (adapter) | `scripts/blender_spritesheet.py` |
| 5.2 | Turntable | parcial | `BLENDER` | `render.turntable` |
| 5.3 | Empacotamento de atlas + manifesto | implementado | `JÁ IMPLEMENTADO` | `pack_atlas` + validadores |
| 5.4 | Exportação por destino | implementado (pacote) | `JÁ IMPLEMENTADO` | `shared/destinations` |
| 5.5 | Exportação de GLB derivado | **ausente** | `NATIVO THREE.JS` (`GLTFExporter`) + `ADAPTER EXTERNO` (gltf-transform) | round-trip não é lossless |
| 5.6 | Validação antes de exportar | parcial | `JÁ IMPLEMENTADO` (estrutural) | sem validação visual |
| 5.7 | Blender Bridge (controle de sessão/ida-e-volta) | **ausente** | `BLENDER` (futuro) | no repo só existe adapter de subprocesso |
| 5.8 | Abrir arquivo no Blender a partir do asset | parcial | `ADAPTER EXTERNO` / `JÁ IMPLEMENTADO` (ferramentas externas) | `tools:open` genérico |
| 5.9 | Versionamento de asset a partir de escolha visual | parcial | `JÁ IMPLEMENTADO` (API) + `DESENVOLVIMENTO LIA` (UI) | `addAssetVersion` com hash |
| 5.10 | Direitos/proveniência por artefato | implementado (declarativo) | `JÁ IMPLEMENTADO` | `classifyRights` |

## 6. Testes existentes que tocam 3D

| Teste | Cobre | Não cobre |
|---|---|---|
| `tests/glb-inspect-smoke.mjs` | Container GLB, relatório, recusas | Renderização |
| `tests/preflight-destinations-smoke.mjs` | Compatibilidade de pacote por destino | Import em engine real |
| `tests/production-pipeline-smoke.mjs` | Cadeia de produção 2D/2.5D | 3D interativo |
| `tests/studio-service-smoke.mjs` | `describeInputBytes` de GLB, limites de `input/` | Bytes grandes, streaming |
| `tests/studio-ui-render-smoke.mjs` | Componentes React renderizam (SSR) | Canvas/WebGL (não há DOM gráfico) |
| `tests/host-integration-smoke.mjs` | Processo externo real e ComfyUI loopback | Blender real |
| `tests/blender-adapter-smoke.cjs` | Descoberta e argumentos do Blender | Render real |

**Nenhum teste atual abre um canvas.** O smoke de UI renderiza por SSR; um viewport exige teste em navegador/Electron real, o que ainda não existe no repositório.

## 7. Inventário de “o que o Three.js acrescentaria” (resumo executivo)

| Bloco | Sem Three.js hoje | Com Three.js (nativo) | Exige Lia |
|---|---|---|---|
| Abrir e desenhar GLB | ausente | loader + renderer | sessão, limites, política de memória |
| Navegar e selecionar | ausente | câmera/controles/raycast | UI, foco, atalhos, hierarquia |
| Transformar | ausente | gizmo | overrides, undo, persistência |
| Inspecionar material | ausente | leitura de material/textura | UI de canais, VRAM, comparação |
| Personagem/animação | ausente | skeleton helper + mixer | timeline, seleção de clip, UI |
| Diagnosticar | parcial (metadados) | bounds, UVs, normais desenhadas | regras de diagnóstico, relatório |
| Exportar | parcial | exporter | diff/round-trip, validação, decisão de destino |
| QA | estrutural | captura de imagem | gate humano e versionamento |

## 8. Conclusão do inventário

- **O que já existe é sólido e deve ser reutilizado sem reescrita:** inspeção estrutural, validação, assets/versões, direitos, comparação por métricas, transporte duplo, confinamento de caminho e pipeline Blender.
- **O que não existe é exatamente o que o Three.js entrega de graça:** desenho, câmera, seleção, materiais, esqueleto, animação e descarte — mas **sem** produto em volta.
- **A classificação dominante do trabalho futuro é `DESENVOLVIMENTO LIA`**, não `NATIVO THREE.JS`. Isso precisa estar claro no planejamento: a biblioteca resolve o desenho, não a arquitetura.
