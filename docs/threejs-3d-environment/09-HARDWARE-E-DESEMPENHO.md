# 09 — Hardware e desempenho

> **Hardware de referência (declarado pelo usuário):** AMD Radeon RX 580 8 GB · AMD Ryzen 5 5500 · 16 GB RAM · Windows (presumido pelo alvo de homologação do produto, **não medido nesta sessão**).
> **Regra:** nada aqui foi medido em GPU. Números de arquitetura são fatos; orçamentos são **hipóteses** a validar; o que não foi medido aparece como `unknown`.
> **Não se presume** CUDA, ROCm, Vulkan nativo do app, WebGPU funcional, nem desempenho de Blender.

## 1. Fatos do hardware

| Item | Valor | Fonte | Rótulo |
|---|---|---|---|
| GPU | Radeon RX 580, GCN 4.0 (Polaris), 14 nm | ficha técnica pública (TechSpot/HMC) | Documentação de terceiro |
| Shaders / CUs | 2.304 stream processors / 36 CUs | idem | idem |
| VRAM | 8 GB GDDR5, 256-bit, **256 GB/s** | idem | idem |
| FP32 | **6,17 TFLOPS** | idem | idem |
| TDP | 185 W | idem | idem |
| Saídas | até 5120×2880; HDMI 2.0b / DP | idem | idem |
| Ray tracing | não | idem | idem |
| CPU | Ryzen 5 5500 (6 núcleos/12 threads) | declarado pelo usuário | Hipótese de configuração |
| RAM | 16 GB | declarado pelo usuário | idem |
| SO | Windows (alvo de homologação) | ADR-001/estado do produto | Não verificado |
| Driver | **desconhecido** | — | `unknown` |
| WebGL2 | esperado, **não medido** | Chromium 156 suporta | Hipótese |
| WebGPU | **desconhecido** | ver §3 | `unknown` |

**O que a RX 580 é boa em:** rasterização de triângulos com sombreamento simples/médio, muitas texturas, 1080p. **O que ela não é:** GPU de compute moderno, ray tracing ou path tracing interativo. Para um viewport de inspeção, isso é suficiente — desde que o orçamento seja respeitado.

## 2. WebGL2 × WebGPU nesta máquina

| Pergunta | Resposta honesta | Consequência de projeto |
|---|---|---|
| WebGL2 funciona? | Quase certamente sim no Chromium 156, mas **não medido** | É o piso obrigatório; testar no primeiro E2E |
| WebGPU funciona na RX 580? | **Não se sabe** | Não pode ser requisito |
| Por que pode funcionar? | WebGPU/D3D12 exige FL 11.1 **ou** FL 11.0 + Resource Binding Tier 2; GCN4 é uma arquitetura D3D12, e o driver AMD moderno tende a atender | Candidato, não promessa |
| Por que pode falhar? | Blocklist do Dawn por driver/versão, ausência de suporte no Linux, bugs de driver em Polaris, `requestAdapter()` retornando `null` | Precisa de probe e fallback |
| Compatibility mode (Chrome 146) resolve? | Ele roda em OpenGL ES 3.1/D3D11, **começando por Android**; Windows é exploração | Não contar com isso em 2026 |
| E no Linux? | Suporte a WebGPU é parcial; RADV suporta gfx803, mas o navegador pode bloquear | Manter WebGL2 como padrão |

### 2.1 Estratégia obrigatória

```
if (flag 'view3d.backend' === 'webgpu') {
  try { WebGPURenderer; await init(); backend='webgpu' }
  catch { WebGPURenderer({forceWebGL:true}) ; backend='webgl2' }
} else {
  WebGLRenderer; backend='webgl2'
}
```

- A UI **sempre** mostra o backend real e se é software.
- Nenhuma feature exclusiva de WebGPU nas Fases 1–5; WebGPU não é entregável de fase.
- Se WebGPU for habilitado por flag e cair para WebGL2, isso não é erro: é informação.

### 2.2 Detecção de software rendering

Sinais: `gl.getParameter(gl.RENDERER)` contendo `SwiftShader`, `llvmpipe`, `Software`, ou `WEBGL_debug_renderer_info` indisponível com FPS muito baixo. Ação: banner, desabilitar pós-processamento/sombras, reduzir DPR, avisar que cor não é confiável para revisão.

## 3. Orçamentos propostos (hipóteses a validar)

### 3.1 Alvos de quadro

| Cenário | Alvo | Piso aceitável | Como medir |
|---|---|---|---|
| Inspeção parada (render sob demanda) | 0 frames quando ocioso | — | contador de frames |
| Órbita em 1080p, DPR 1 | 60 fps | 45 fps | média de 300 frames + p95 |
| Órbita em 1440p/DPR 2 | 60 fps | 30 fps | idem |
| Animação com skinning | 60 fps | 30 fps | idem |
| Modelo “grande” (2M triângulos) | 30 fps | 20 fps | idem |

**Nota:** “60 fps” não é requisito de vaidade; é o que faz a inspeção parecer responsiva. Um viewport a 20 fps parece quebrado.

### 3.2 Orçamento de cena por classe de modelo

| Classe | Triângulos exibidos | Draw calls | Texturas | VRAM estimada | Ação |
|---|---|---|---|---|---|
| Personagem de jogo | ≤ 150 k | ≤ 100 | ≤ 20 (≤ 2K) | 150–400 MB | Normal |
| Personagem de alta | ≤ 800 k | ≤ 300 | ≤ 40 | 400–800 MB | HUD ligado |
| Cenário/prop | ≤ 2 M | ≤ 1.000 | ≤ 60 | 600 MB–1,2 GB | Aviso; modo leve |
| Acima do teto | > 2 M | > 1.000 | > 60 | > 1,2 GB | **Recusa nomeada** com instrução (sem “carregar mesmo assim”) |

**Justificativa aritmética:** 8 GB de VRAM são compartilhados com o sistema, o compositor do Windows, o próprio Chromium e qualquer outro app. Reservar 1,2 GB para o viewport é ~15% da VRAM; mais que isso começa a competir com Blender/jogo. Orçamento operacional: **512 MB confortável, 1 GB alerta, 1,2 GB recusa** — o mesmo em [`05`](05-ARQUITETURA-PROPOSTA.md) §5.

### 3.3 Memória de textura (aritmética, não medição)

| Textura | Base RGBA8 | Com mipmaps | 20 texturas |
|---|---|---|---|
| 512² | 1,0 MB | 1,33 MB | 26,6 MB |
| 1024² | 4,2 MB | 5,6 MB | 112 MB |
| 2048² | 16,8 MB | 22,4 MB | 448 MB |
| 4096² | 67,1 MB | 89,5 MB | 1,79 GB |

Um único GLB com seis texturas 4K já consome ~537 MB de VRAM **sem** contar a geometria. Isso é o argumento mais forte para: (a) avisar antes de abrir; (b) sugerir KTX2/Basis em etapa separada; (c) nunca deixar duas cenas abertas.

### 3.4 Memória de geometria (estimativa)

Assumindo ~56 bytes/vértice (posição 12 + normal 12 + UV 8 + joints 8 + weights 16) + índices (~6 bytes/triângulo):

| Triângulos | Vértices aprox. | Geometria | Com atributos extras |
|---|---|---|---|
| 100 k | 50 k | ~4,1 MB | ~6 MB |
| 500 k | 250 k | ~20,5 MB | ~30 MB |
| 2 M | 1 M | ~82 MB | ~120 MB |

**Conclusão:** geometria raramente é o problema; **textura** é. Um “modelo de 200 MB” quase sempre é 180 MB de textura.

## 4. Orçamento de RAM (16 GB totais)

| Consumidor | Estimativa | Observação |
|---|---|---|
| Windows + apps de base | 3–5 GB | varia |
| Lia Forge (Electron: main + renderer + GPU) | 0,6–1,2 GB | medir com `app.getAppMetrics()` |
| Blender aberto com cena | 2–8 GB | depende do projeto |
| Jogo aberto | 2–8 GB | depende do jogo |
| Viewport (bytes + cena + texturas no host) | 0,3–1,5 GB | não conta VRAM |
| Margem para swap/compilação | ≥ 1 GB | abaixo disso, travamentos |

**Regra de produto:** se RAM livre < 2 GB, o viewport abre em modo leve ou recusa com instrução. Isso não é pessimismo: 16 GB com Blender e um jogo abertos é o cenário real do usuário.

## 5. Limites do Electron/Chromium

| Limite | Fato | Efeito |
|---|---|---|
| Contexto WebGL | Um por canvas; vários contextos custam memória e podem ser descartados pelo navegador | Um viewport por vez |
| Processo GPU | Separado; pode morrer | `webglcontextlost` + recriação |
| TDR do Windows | ~2 s de bloqueio da GPU reinicia o driver | Evitar shader/parse pesado no frame; nada de loops longos |
| `requestAnimationFrame` | Pausa em background | Não assumir frames enquanto minimizado |
| DPR | Em telas 150%/200%, o custo cresce ao quadrado | Limitar `setPixelRatio(min(devicePixelRatio, 1.5))` por padrão |
| `app.getAppMetrics()` | Dá memória por processo (inclui GPU) | Base do HUD; não é VRAM |
| Disco | Cache de GPU do Chromium pode crescer | Não é gerenciado pelo app; monitorar |

**Não** usar `app.disableHardwareAcceleration()` (hoje não é usado — correto). **Não** usar `--disable-gpu`. **Não** forçar SwiftShader.

**Diferença de telemetria entre backends (verificado no pacote r187):** `WebGLRenderer.info` expõe `memory.geometries`, `memory.textures` e `render.calls/triangles`; `WebGPURenderer` (via `Info.js`) expõe `memory.geometries`, `memory.textures` e também **`memory.texturesSize` em bytes**, com `render.calls`/`render.drawCalls`. O HUD deve tratar os campos ausentes como `unknown`, não como zero.

## 6. Concorrência com Blender e jogos

| Situação | Risco | Mitigação |
|---|---|---|
| Blender aberto com EEVEE/Cycles | VRAM e GPU disputadas; viewport pode cair para 10–20 fps | Detectar processos gerenciados pelo app (`ManagedProcessRegistry`, `electron/task-manager.cjs`) e sugerir fechar/reduzir; HUD visível |
| Jogo aberto | VRAM cheia → texturas paginadas, stutter | Aviso; modo leve; não abrir modelo grande |
| Render Blender rodando | CPU/GPU ocupados; parse lento | Não iniciar sessão durante run pesado sem aviso |
| Múltiplos monitores | Mais pixels, mais VRAM | DPR e resolução limitados ao canvas |
| Notebook em bateria | GPU em modo económico | Não prometer fps; medir |

**Proposta:** reaproveitar o registro `ManagedProcessRegistry` de `electron/task-manager.cjs` como sinal — se há processo do Blender/ComfyUI iniciado pela Forge, o viewport mostra “há uma tarefa pesada em andamento” antes de abrir.

## 7. Plano de medição (o que provar antes de dizer “funciona”)

### 7.1 Fixtures

| Fixture | Origem | Conteúdo | Objetivo |
|---|---|---|---|
| F1 pequeno | sintético (`tests/glb-fixtures.mjs` estendido) | 1 mesh, 1 material, sem textura | Contrato/parse |
| F2 personagem | autorizado pelo usuário (não baixar) | skin + 2 animações + 4 texturas 1K | Caso de uso principal |
| F3 pesado | sintético ou autorizado | 1M+ triângulos, 6 texturas 4K | Limite/memória |
| F4 extensões | sintético | Draco ou KTX2 | Decoders/CSP |
| F5 ausente/ inválido | sintético | sem normais, escala absurda, UV faltando | Diagnóstico |

**Proibido:** baixar modelos/pesos da internet para teste. Fixtures sintéticas ou fornecidas pelo usuário.

### 7.2 Métricas a coletar

| Métrica | Como | Critério |
|---|---|---|
| FPS médio/p95 | `performance.now()` em 300 frames | ≥ alvo da classe |
| Draw calls / triângulos | `renderer.info.render` | ≤ orçamento |
| Geometrias/texturas vivas | `renderer.info.memory` (WebGL: contadores; WebGPU: inclui `texturesSize` em bytes) | volta ao baseline após fechar |
| Memória do processo | `app.getAppMetrics()` | sem crescimento monotônico em 10 ciclos abrir/fechar |
| Tempo de abertura | marcos do pipeline | ≤ 5 s para 20 MB; ≤ 15 s para 80 MB (hipótese) |
| Backend/software | `WebGL.isWebGL2Available()` + probe `gl.RENDERER`; opcional `WebGPU.isAvailable()` | registrado |
| Contexto perdido | provocar `forceContextLoss()` | recupera sem travar |
| Tamanho do bundle | build do Vite | chunk do viewport separado; base não cresce |

### 7.3 O que conta como evidência

- **Conta:** execução em Windows, na máquina do usuário, com o app empacotado ou `electron .`, registrando `chrome://gpu`, driver, fps, memória e capturas.
- **Não conta:** build no sandbox, teste SSR, “funciona no meu navegador”, screenshot sem números.
- **Parcial:** Chromium headless com SwiftShader prova apenas que não quebra, não que é rápido.

## 8. Mitigações obrigatórias no desenho

1. **Render sob demanda** (não loop eterno).
2. **DPR limitado** (1.5 padrão; 1 em modo leve).
3. **Sem pós-processamento por padrão**; sem sombras por padrão.
4. **Uma sessão ativa**; descarte completo ao fechar.
5. **Cache de bytes limitado** (≤ 64 MB).
6. **Teto de arquivo** (256 MB) e classes de tamanho com confirmação.
7. **Modo leve** (DPR 1, sem HUD automático, sem animação, texturas sem mipmap extra? — apenas reduzir custo de render, **não** alterar arquivo).
8. **HUD opt-in** com backend, fps, draw calls, triângulos, texturas e memória de processo.
9. **Aviso de GPU** quando software.
10. **Recusa nomeada** quando não couber, com instrução de otimizar/converter.

**Nota de integração:** o teto de 256 MB é o limite do **viewport** para um arquivo que já está no projeto. O caminho atual de upload (`saveInput`, 32 MB) e a prévia (`readInput`/`/artifact`, 6 MB) têm tetos menores e **não** são alterados por esta proposta. Ver [`10`](10-IMPORTACAO-E-EXPORTACAO.md) §1, decisão 57 e risco R21 em [`12`](12-RISCOS-DEPENDENCIAS-DECISOES.md).

## 9. O que **não** prometer

| Promessa | Por quê não |
|---|---|
| “Roda qualquer GLB” | Memória e formatos têm limite |
| “60 fps sempre” | Depende de cena, driver, outros apps |
| “WebGPU mais rápido” | Não medido; pode até ser mais lento em cenas pequenas |
| “Substitui o Blender no render” | Não é o escopo e não há evidência de paridade |
| “Determinístico” | Captura via GPU varia com driver/backend/tone mapping |
| “Zero custo de RAM” | Todo viewport custa; o compromisso é ter teto e descarte |

## 10. Critérios de aceite de desempenho para a Fase 1

1. Fixture F2 (personagem) a 60 fps em 1080p/DPR 1 na RX 580 — **medido em Windows**.
2. Abrir/fechar 10 vezes sem crescimento de `renderer.info.memory` nem de memória do processo acima de 5%.
3. Fechar a sessão devolve o app ao consumo de base (medido em `app.getAppMetrics`).
4. Fixture F3 abre com aviso e mantém ≥ 20 fps; ou recusa com mensagem clara, conforme o teto.
5. Nenhum frame acima de 100 ms durante órbita (sem stutter perceptível).
6. HUD mostra backend real e detecta software rendering quando forçado.
7. Bundle base não cresce: o chunk do viewport é carregado sob demanda.

Enquanto esses números não existirem, o estado correto é **“não medido”**, não “pronto”.
