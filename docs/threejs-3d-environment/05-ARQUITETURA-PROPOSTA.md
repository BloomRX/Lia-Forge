# 05 — Arquitetura proposta

> **Status:** `PROPOSTA` — não aprovada, não implementada. Nenhum arquivo de código foi criado.
> **Princípio:** a Lia Forge é o produto; o viewport é **uma view** dela. Three.js é biblioteca de renderização; não define contratos, permissões, versionamento nem UX.
> **Fronteira herdada:** [`../LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md`](../LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md) §4.1 (UI única, módulos internos) e [`../CAPABILITY-BOUNDARIES-AND-ROADMAP.md`](../CAPABILITY-BOUNDARIES-AND-ROADMAP.md) §2.1 (Scene Composer é experiência combinada, não módulo paralelo).

## 1. Visão em uma figura

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Lia Forge — renderer Chromium (sandbox, sem Node)                            │
│                                                                              │
│  React UI (App / ForgeStudio)                                                │
│    │  comando (abrir asset, selecionar, salvar)                              │
│    ▼                                                                         │
│  Lia3DView (bundle carregado sob demanda)                                    │
│    ├── ViewportRuntime  ── WebGLRenderer (padrão) / WebGPURenderer (flag)    │
│    ├── SceneIndex       ── dados serializáveis (nós, materiais, skins, clips)│
│    ├── CameraRig        ── OrbitControls + ortho/persp + foco                │
│    ├── Selection        ── Raycaster + highlight                             │
│    ├── MaterialInspector / TextureInspector                                  │
│    ├── SkeletonInspector / AnimationPreview                                  │
│    ├── Diagnostics      ── regras sobre relatório + cena carregada           │
│    ├── Capture          ── PNG de prévia (ação explícita)                    │
│    └── SessionOverrides ── estado reversível da sessão                       │
│         │ bytes/URLs (nunca caminho absoluto)                                │
│         ▼                                                                    │
│  Transporte: window.liaForge.view3d (IPC) | fetch same-origin (HTTP preview) │
└──────────────────────────────────────────┬───────────────────────────────────┘
                                           │
┌──────────────────────────────────────────▼───────────────────────────────────┐
│ Electron main (Node)                                                         │
│  View3DService                                                               │
│   ├── resolve(assetRef/artifactRef) → {sha256, bytes, size, projectPath}     │
│   ├── token opaco → arquivo permitido (TTL, 1 modelo por token)              │
│   ├── protocol.handle('lia3d') → stream com Range, allowlist, symlink check  │
│   ├── IPC handlers (open/close/overrides/capture/save-version)               │
│   └── métricas de processo (app.getAppMetrics) + guarda de concorrência      │
│                                                                              │
│  Serviços existentes reaproveitados:                                          │
│   AssetManager · StudioService · QA validators · Provider Hub · preflight     │
│   ProjectStructure · Comparison Lab · export/destination profiles             │
└──────────────────────────────────────────┬───────────────────────────────────┘
                                           │ leitura/escrita confinada
                                    Projeto do usuário
                                    ├── input/
                                    ├── .lia-forge/runs/
                                    └── .lia-forge/view3d/sessions/*.json  (novo)
```

E o Blender permanece fora desse caminho, como adapter de produção:

```
Workflow/Asset ──► Blender adapter (subprocesso) ──► PNG + manifesto ──► QA ──► versão
```

## 2. Responsabilidades por módulo

| Módulo | Onde roda | Fase | Responsabilidade | Nunca faz |
|---|---|---|---|---|
| **`Lia3DView` (entrada)** | Renderer | 1 | Monta a view, carrega runtime sob demanda, liga/desliga ciclo de vida | Falar com filesystem |
| **`ViewportRuntime`** | Renderer | 1 | Criação/destruição do renderer, resize, DPR, loop, perda de contexto, telemetria | Decidir qual asset abrir |
| **`SceneIndex`** | Renderer | 1 (mínimo), 2 (hierarquia) | Converter grafo Three.js em dados planos para React (nós, materiais, skins, clips, bounds, contagens) | Expor objetos Three.js à UI |
| **`CameraRig`** | Renderer | 1 (órbita), 2 (foco) | Perspectiva/ortográfica, órbita, foco, presets de vista | Alterar câmera do arquivo |
| **`Selection`** | Renderer | 2 | Picking, hover, seleção múltipla, highlight, isolamento | Editar geometria |
| **`MaterialInspector` / `TextureInspector`** | Renderer | 3 | Ler PBR real, listar canais, prévia de textura, estimar VRAM | Gravar textura no disco |
| **`SkeletonInspector` / `AnimationPreview`** | Renderer | 4 | `SkeletonHelper`, lista de bones, mixer, scrub, loop, velocidade | Salvar clipe ou keyframe |
| **`Diagnostics`** | Renderer + shared (puro) | 1–4 | Produzir **observações** (normais ausentes, UV ausente, escala suspeita, draw calls altos) a partir de fatos | Declarar “aprovado” |
| **`SessionOverrides`** | Renderer + main | 2 | Manter alterações reversíveis da sessão; serializar em JSON quando o usuário salvar | Reescrever GLB |
| **`Capture`** | Renderer → main | 2 | Gerar PNG de prévia por ação explícita | Fazer upload/telemetria |
| **`View3DService`** | Main | 1 | Resolver referências, emitir tokens, servir bytes, gravar overrides, calcular hash | Interpretar/avaliar arte |
| **`View3DTransport`** | Renderer | 1 | Unificar IPC e HTTP same-origin, erros e limites | Duplicar regra de negócio |
| **`view3d` contracts** | `shared/` (puro) | 1 | Validar `View3DSession`/`View3DOverrides`, calcular limites, formatar diagnóstico | Tocar em Three.js |

## 3. Por que não React Three Fiber (e como integrar mesmo assim)

**Fato:** `@react-three/fiber@9.8.2` declara peer `react >=19 <19.4`; `@react-three/drei@10.7.9` exige `react ^19`. O produto está em `react 18.3.1`. Atualizar React seria uma mudança de produção ampla, não autorizada nesta missão.

**Padrão proposto — runtime imperativo com ponte explícita:**

```
React component (Lia3DView)
  ├─ useRef<HTMLDivElement> (container)
  ├─ useEffect(() => {
  │    let runtime = null;
  │    let cancelled = false;
  │    (async () => {
  │      runtime = await createRuntime(container, opts);
  │      if (cancelled) { runtime.dispose(); return; }
  │    })();
  │    return () => { cancelled = true; runtime?.dispose(); };
  │  }, [assetRef])
  ├─ assinatura de estado: runtime.subscribe(snapshot => setSnapshot(snapshot))
  └─ comandos: runtime.select(id) | runtime.setMode('inspect'|'adjust')
                runtime.saveOverrides() | runtime.capture()
```

- O estado que o React vê é **snapshot serializável** (não referências Three.js).
- Render sob demanda: o runtime chama `notify()` quando o snapshot muda; a UI não re-renderiza por frame.
- O canvas nunca é recriado por re-render; o `useEffect` depende de `assetRef`, não do estado da UI.

Isso também deixa a porta aberta para adotar R3F no futuro, se o React for atualizado, sem refazer contratos.

## 4. Ciclo de vida de uma sessão

```
idle ──open(ref)──► resolving ──ok──► loading ──ok──► ready ⇄ animating
  ▲                     │                │              │
  │                     │ erro           │ erro         │ close/crash
  └────── error ◄───────┴────────────────┘              ▼
                                                     disposing ──► idle
```

Estados e garantias:

| Estado | O que a UI mostra | O que o sistema garante |
|---|---|---|
| `resolving` | “Localizando o arquivo no projeto…” | Confinamento de caminho; hash; recusa de symlink; limite de tamanho |
| `loading` | Progresso real por etapa (bytes, parse, texturas) | Cancelamento real; descarte do parcial; sem CPU infinita |
| `ready` | Viewport + painéis | Render sob demanda; telemetria ativa; nenhuma escrita em disco |
| `animating` | Timeline ativa | Mixer isolado; loop; velocidade; pausa ao sair |
| `error` | Mensagem acionável (o que fazer) | Nenhum objeto órfão; sessão destruída |
| `disposing` | “Fechando…” | `dispose()` de tudo, `forceContextLoss()`, remoção do canvas |

**Regra de concorrência:** uma sessão 3D ativa por vez (na Fase 1). Duas abas/sessões exigiriam orçamento de memória e um gerenciador de cache; não é necessário para inspeção.

## 5. Arquitetura de memória

| Camada | Conteúdo | Limite proposto (hipótese a validar) |
|---|---|---|
| Arquivo em disco | GLB original | Sem cópia; lido sob demanda |
| Cache de bytes na main | Últimos N arquivos para reabrir | ≤ 64 MB total, LRU por hash |
| Buffer no renderer | Bytes em parse | 1 modelo por vez; sem cópia extra após o parse |
| GPU | Geometrias + texturas | ≤ 512 MB “confortável”; alerta em 1 GB; recusa estimada em 1,2 GB (≈15% de 8 GB) |
| JS heap | Cena, índice, snapshots | Sem reter `Scene` antiga ao trocar de modelo |
| Overrides | JSON pequeno | ≤ 256 KB por sessão |

**Medição obrigatória:** `renderer.info.memory.geometries/textures`, `renderer.info.render.calls/triangles`, `performance.now()` por frame, `app.getAppMetrics()` (main e GPU) a cada N segundos quando o HUD estiver ativo. Sem isso, “não vaza memória” é opinião.

**Política de arquivo grande (proposta):**

| Classe | Tamanho do GLB | Comportamento |
|---|---|---|
| Pequeno | ≤ 20 MB | Carrega direto |
| Médio | 20–80 MB | Progresso, confirmação leve, HUD |
| Grande | 80–256 MB | Confirmação explícita; “modo leve” sugerido; aviso de RAM/VRAM |
| Acima do teto | > 256 MB | Recusa nomeada com instrução (otimizar/converter em etapa separada) |

O teto de 256 MB vem do adapter `glb-inspect` existente; o viewport **não** deve ser mais permissivo que a inspeção estrutural.

## 6. Segurança: modelo de acesso a bytes

### 6.1 O problema

O renderer é sandboxed e não deve receber caminhos absolutos nem acesso ao filesystem. Um GLB de 100 MB não deve atravessar IPC como base64. `.gltf` com texturas externas não deve buscar `file://`.

### 6.2 Solução proposta: token + protocolo

```
1) UI: open({ assetId? , pathRelativo })
2) main: resolve path dentro de input/ (ou runs/, conforme origem)
         valida extensão (.glb ou .gltf autocontido no v1) e tamanho
         calcula sha256 (stream)
         cria sessão { sessionId, token, absolutePath permitido, expiraEm }
3) main → renderer: { sessionId, token, modelUrl: 'lia3d://<sessionId>/model',
                      bytes, sha256, report }   // sem absolutePath
4) renderer: GLTFLoader.load('lia3d://<sessionId>/model')
5) protocol.handle('lia3d'):
     - valida initiatorOrigin === origem do app
     - valida token/sessão viva
     - resolve APENAS o arquivo declarado (e, se .gltf, irmãos autorizados)
     - recusa path traversal, symlink, arquivo fora do conjunto
     - responde com Content-Type, Content-Length, Accept-Ranges
6) close(): revoga token; opcionalmente apaga sessão
```

Vantagens: streaming/Range, sem base64, sem `file://`, sem expor caminho, cancelamento por sessão, auditoria.

### 6.3 Alternativa para o preview no navegador

O host HTTP (`vite.config.js`) já segue o padrão “mesma origem”. Proposta: `GET /api/lia-forge/studio/view3d/file?token=...` com `Range` e `Cache-Control: no-store`, emitido pelo mesmo `View3DService`. Nada de `localhost` no browser.

**Matriz de transporte proposta**

| Ambiente | Caminho primário | Range | Teto prático | Observação |
|---|---|---|---|---|
| Electron (app) | `lia3d://<sessionId>/model` | Sim | 256 MB | Sem caminho absoluto no renderer |
| Navegador/preview | `GET /api/lia-forge/studio/view3d/file?token=…` | Sim | 256 MB | Mesma origem; sem `localhost` |
| Fallback (Electron sem protocolo) | IPC (`open`/`read`) | Não | 64 MB | Simples; duplica memória; não é o padrão |
| Rota existente `/artifact` | `readInput` | Não | 6 MB | **Não** serve para modelos grandes; permanece como está |

### 6.4 CSP mínima proposta (não implementar sem revisão)

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:;
img-src 'self' data: blob:;
style-src 'self' 'unsafe-inline';   /* Vite injeta estilos; revisar */
connect-src 'self';
object-src 'none'; base-uri 'self'; frame-ancestors 'none';
```

- `'wasm-unsafe-eval'` é necessário para compilar os decoders wasm (Draco/Basis).
- `worker-src blob:` é necessário porque os loaders oficiais criam workers a partir de `Blob`.
- A CSP deve ser aplicada **primeiro em report-only**, com um smoke que colete violações.
- Se a CSP quebrar o dev server do Vite, aplicar por ambiente (dev vs packaged), nunca desligando no app empacotado.

## 7. Renderer: WebGL2 padrão, WebGPU opcional

```ts
// interface proposta (conceitual, não implementada)
interface ViewportRenderer {
  init(canvas): Promise<void>
  render(scene, camera): void
  setAnimationLoop(fn | null): void
  info(): RendererStats          // WebGL: info.memory.{geometries,textures} + render.{calls,triangles}
                                 // WebGPU: info.memory.texturesSize (bytes) e render.drawCalls
  dispose(): Promise<void> | void // WebGPURenderer.dispose() é assíncrono
  readonly backend: 'webgl2' | 'webgpu' | 'unknown'
  readonly isSoftware: boolean
}
```

- **Fase 1:** implementação única `WebGLRendererAdapter`.
- **WebGPU não é entregável de fase:** fica atrás de flag `view3d.backend = 'auto'|'webgl'|'webgpu'` e só é avaliado depois de a Fase 1 estar estável e medida; `auto` tenta WebGPU e cai para WebGL2; a UI mostra o backend real.
- **Detecção de WebGL2:** usar o addon oficial `WebGL.isWebGL2Available()`/`getWebGL2ErrorMessage()` (`three/addons/capabilities/WebGL.js`). **Detecção de software:** ler `gl.getParameter(gl.RENDERER)` e, quando disponível, `WEBGL_debug_renderer_info`; se contiver `SwiftShader`, `llvmpipe` ou `Software`, mostrar aviso e desabilitar pós-processamento.
- **Perda de contexto:** `canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); estado = 'recovering' })`; ao restaurar, recriar recursos a partir do arquivo (nunca do estado antigo).

## 8. Diagnóstico: observações, não aprovação

O módulo `Diagnostics` transforma fatos em observações com severidade e “o que fazer”:

| Observação | Fonte | Severidade | Não é |
|---|---|---|---|
| Nenhuma normal no primitivo | `inspectGlb` + geometria | alta (iluminação quebra) | Prova de defeito visual |
| Sem `TEXCOORD_0` com material que usa textura | relatório + material | alta | — |
| `triangleCount` acima do orçamento do destino | relatório + perfil | média | Reprovação automática |
| Texturas 4K em modelo de 48 px no jogo | texturas + destino | média | Decisão de arte |
| Bounds muito fora da origem | cena | média | Erro do exportador |
| Skinned mesh sem skin | relatório | alta | — |
| `extensionsRequired` desconhecida | relatório | alta (pode não renderizar) | — |
| Draw calls > 1.000 | telemetria | média (desempenho) | — |
| Backend em software | probe | alta (experiência) | — |

**Regra:** o viewport nunca grava `ValidationResult.status = passed`. Ele produz um `View3DSessionReport` (proposta) que pode ser anexado a uma revisão, e o usuário decide. QA estrutural continua sendo QA estrutural; qualidade visual continua sendo humana.

## 9. Estrutura de arquivos proposta (não criada)

```
shared/view3d/
  session.mjs          # validação pura de View3DSession/View3DOverrides
  diagnostics.mjs      # regras determinísticas sobre relatório + cena
  limits.mjs           # tetos, classes de tamanho, formatação
electron/view3d/
  service.cjs          # resolve, tokens, protocolo, hash, overrides
  ipc.cjs              # canais e validação de payload
src/view3d/
  index.js             # entrada lazy (import dinâmico)
  transport.js         # IPC | HTTP (espelha lia-forge-api.js)
  runtime/
    renderer.js        # ViewportRenderer + WebGL adapter
    scene.js           # carregamento GLTF, ResourceTracker
    camera.js          # OrbitControls, ortho/persp, foco
    selection.js       # Raycaster, highlight, isolamento
    materials.js       # inspeção e overrides de material
    textures.js        # prévia de canais, VRAM
    skeleton.js        # SkeletonHelper, bones
    animation.js       # AnimationMixer, timeline
    capture.js         # PNG de prévia
    telemetry.js       # renderer.info, fps, memória
    diagnostics.js     # ponte para shared/view3d/diagnostics
  ui/
    Viewport3D.jsx     # container + canvas + toolbar
    HierarchyPanel.jsx
    InspectorPanel.jsx
    DiagnosticsPanel.jsx
    AnimationTimeline.jsx
```

**Nada disso existe.** É um alvo de discussão, alinhado ao padrão de pastas atual (`shared/<domínio>`, `electron/<domínio>`, `src/`).

## 10. O que **não** faz parte desta arquitetura

| Fora de escopo | Por quê |
|---|---|
| Edição de malha/UV/rig/animação | DCC; risco e custo altos; a decisão de produto não existe |
| Render final determinístico | `Lia3DSprite`/Blender continuam candidatos; nenhum renderer é padrão |
| Scene Composer / staging de geração | Capacidade separada (pergunta 20), não é viewport |
| Colisores/física | Requisito do destino, não da inspeção |
| Splats/point clouds como cena principal | `splat.ingest` está `planned`; visualizador não é prioridade |
| Publicação/upload | Nenhum dado sai da máquina sem consentimento |
| Segundo app/launcher | Proibido pela decisão de produto |

## 11. Decisões de arquitetura que precisam de aprovação

1. `three` como dependência fixa + carregamento lazy.
2. WebGL2 padrão; WebGPU experimental atrás de flag.
3. Tokens + protocolo `lia3d://` em vez de bytes/base64 por IPC.
4. Uma sessão ativa por vez e teto de 256 MB.
5. Overrides de sessão como único estado persistente do viewport.
6. Nenhuma escrita em GLB; exportação só como artefato derivado explícito.
7. Nenhuma dependência React 19/R3F nesta fase.

Todas estão detalhadas em [`12-RISCOS-DEPENDENCIAS-DECISOES.md`](12-RISCOS-DEPENDENCIAS-DECISOES.md) como questões 45–57.
