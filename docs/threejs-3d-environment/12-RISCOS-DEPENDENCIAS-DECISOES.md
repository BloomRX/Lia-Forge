# 12 — Riscos, dependências e decisões pendentes

> **Status:** `PROPOSTA`. As decisões abaixo **não** foram tomadas. Elas continuam a numeração de [`../DECISIONS-AND-OPEN-QUESTIONS.md`](../DECISIONS-AND-OPEN-QUESTIONS.md) (última registrada: **62**; as questões 45–57 foram acrescentadas por esta frente e as 58–62 pela frente de skills) e **não** foram decididas. Se aprovadas, devem ser consolidadas lá pela pessoa responsável, não por esta frente.

## 1. Riscos

| ID | Risco | Prob. | Impacto | Mitigação | Como detectar |
|---|---|---|---|---|---|
| R1 | Viewport vaza GPU/VRAM e derruba o app | Alta se ingênuo | Alto | `ResourceTracker`, `dispose`, telemetria, teste de 10 ciclos | `renderer.info.memory` crescente; `app.getAppMetrics` |
| R2 | GLB grande congela a UI | Alta | Alto | Streaming, progresso, cancelamento, teto, classes de tamanho | Frames > 200 ms no load; reclamação |
| R3 | Modelo malicioso explora parser | Baixa | Alto | Renderer sandboxed, sem rede, limites, só `.glb`/`.gltf` autocontido no v1 | Fuzz, testes negativos |
| R4 | CSP quebra decoders/workers | Alta | Médio | Report-only, `wasm-unsafe-eval`, `worker-src blob:`, teste de build | Violations no console; smoke |
| R5 | WebGPU não funciona na RX 580 | Média | Médio | WebGL2 padrão; WebGPU opcional com fallback | Probe em `chrome://gpu` |
| R6 | Software rendering (SwiftShader) engana avaliação de cor | Média | Alto | Detectar e avisar; desabilitar pós-processamento | `gl.RENDERER`; fps |
| R7 | Usuário acredita que “salvou o modelo” | Alta | Alto | Microcopy, modos, confirmações, “não altera o arquivo” | Teste de usabilidade |
| R8 | Round-trip de export perde dados | Alta | Alto | Bloquear extensões desconhecidas; diff; não sobrescrever | Relatório de diferenças |
| R9 | Contrato de override vira segundo domínio | Média | Médio | Manter fora do domínio v1; validar puro; sem tocar store | Revisão de arquitetura |
| R10 | React 18 impede R3F e empurra “solução caseira” | Alta | Baixo/Médio | Integração imperativa com ponte; não adotar R3F | Decisão 48 |
| R11 | Bundle/telemetria quebram padrão de notices | Média | Médio | Gerar notices; fixar versão; revisar wasm | CI de notices |
| R12 | Viewport compete com Blender/jogo e piora ambos | Alta | Médio | Aviso de tarefa pesada; modo leve; uma sessão | Medição com apps abertos |
| R13 | Comparação Blender × WebGL vira “escolha de renderer” sem evidência | Média | Alto | Não declarar renderer padrão; rubrica separada | Revisão de decisões |
| R14 | Inclusão de `three` no bundle base sem lazy | Média | Médio | `import()` dinâmico; medir build | Tamanho do chunk inicial |
| R15 | Testes de UI/canvas inexistentes dão falsa confiança | Alta | Alto | Criar teste em Chromium real; separar do SSR | Cobertura |
| R16 | Nomes de nós/bones vazios/duplicados quebram UI | Média | Baixo | IDs internos gerados pela Lia | Fixtures adversas |
| R17 | Path traversal via `.gltf` externo | Média | Alto | v1 só GLB/glTF autocontido; allowlist de irmãos na Fase 5 | Testes negativos |
| R18 | Expectativa de “editor 3D completo” | Alta | Alto | Escopo explícito; botão “editar no Blender” | Feedback de produto |
| R19 | Dependência de licença de decoder mal registrada | Média | Médio | Notices por componente; revisão | Auditoria de licenças |
| R20 | Perda de contexto GPU em produção | Média | Médio | Handler + recriação; teste provocado | Telemetria local (sem envio) |
| R21 | Arquivo grande não consegue entrar no projeto | Alta | Médio | O viewport abre o que já existe; elevar o teto de `saveInput` é decisão separada, com memória/disco | Teste com arquivo > 32 MB |

### 1.1 Riscos que **não** existem (para não gastar esforço)

- **“O Three.js não renderiza glTF”** — renderiza, com suporte amplo de extensões.
- **“Precisa de R3F para integrar com React”** — não precisa; runtime imperativo é suficiente.
- **“WebGPU é obrigatório para performance”** — não é; WebGL2 atende inspeção.
- **“Precisa de Draco para abrir modelos”** — só quando o arquivo usa Draco.
- **“Precisa de worker para tudo”** — só para decoders e, se medido, parse pesado.

## 2. Dependências

### 2.1 Dependências internas (já existentes)

| Dependência | Como é usada | Risco de acoplamento |
|---|---|---|
| `shared/services/studio-service.mjs` | Padrão de serviço único e transporte | Baixo se o viewport for módulo separado |
| `shared/assets/manager.mjs` | Versões, direitos, proveniência | Baixo |
| `shared/qa/validators.mjs` | Validação estrutural | Baixo |
| `shared/integrations/project-structure.mjs` | `input/`, `.lia-forge/` | Baixo |
| `electron/ipc-guard.cjs` + `navigation-guard.cjs` | Segurança de canal | **Obrigatória** |
| `electron/task-manager.cjs` | Sinal de tarefa pesada | Baixo |
| `shared/destinations/profiles.mjs` | Compatibilidade | Baixo |
| `shared/ui/journey.mjs` | Evidência na jornada (Fase 5) | Médio (contrato de jornada) |
| `src/lia-forge-api.js` | Padrão de transporte | Baixo |

### 2.2 Dependências externas

| Dependência | Versão | Licença | Obrigatória? | Observação |
|---|---|---|---|---|
| `three` | `0.187.0` | MIT | **Sim (Fase 1)** | Fixar; lazy; notices |
| Draco decoder | embutido no `three` | Apache-2.0 | Sob demanda | Só se o GLB usar Draco |
| Basis/KTX2 transcoder | embutido no `three` | Apache-2.0 (confirmar KTX-Software) | Sob demanda | CSP wasm/worker |
| Meshopt decoder | embutido no `three` | MIT | Sob demanda | — |
| `three-mesh-bvh` | `0.9.18` | MIT | Não | Só se picking medir lento |
| `gltf-validator` | `2.0.0-dev.3.10` | Apache-2.0 | Não | QA opcional |
| `@gltf-transform/cli` | `4.5.1` | MIT | Não | Etapa externa |

**Nenhuma dessas dependências foi instalada no repositório nesta missão.**

### 2.3 Dependências bloqueantes de decisão

- Política de versão do Three.js (decisão 46).
- CSP, protocolo e transporte de bytes (decisão 49).
- Captura e exportação derivada (decisão 53).
- Escopo de edição (decisão 47).
- Limites de memória (decisão 50).
- Formatos aceitos (decisão 51).
- Teto de importação de modelos (decisão 57).
- Teste em Chromium real (decisão 55).

## 3. Decisões pendentes (45–57)

Cada item traz alternativas e uma **recomendação técnica não vinculante**. Recomendação não é decisão: a escolha continua humana e, quando tomada, deve ser registrada no arquivo de decisões.

### 45. O viewport é uma capability nova ou parte de `model3d.inspect`?

- **A)** Nova capability `model3d.preview` + provider interno. **Recomendado.**
- **B)** Estender `model3d.inspect` para incluir render. Risco: mistura “relatório estrutural” com “interação humana”, quebra semântica do adapter.
- **C)** Não registrar capability; feature de UI. Risco: Hub/preflight não expressam disponibilidade.

**Recomendação:** A, com `model3d.inspect` intacto.

### 46. Política de versão do Three.js

- **A)** Versão exata, atualização manual com teste e revisão de notices. **Recomendado.**
- **B)** Range semver (`^0.187`). Risco: Three.js usa `0.x`, mudanças quebram.
- **C)** Vendorizar no repo. Risco: licença/atualização/auditoria pior.

**Recomendação:** A + registro em `THIRD_PARTY_NOTICES.md`.

### 47. Escopo de edição do viewport (Fases 2 e 3)

- **A)** Somente overrides de apresentação (visibilidade, câmera, luz, material, transform). **Recomendado.**
- **B)** Incluir edição de hierarquia (reparent/rename). Risco: semântica de asset, export.
- **C)** Edição de geometria/UV/rig. Risco: virar DCC; rejeitado.

**Recomendação:** A — transformações na Fase 2, material na Fase 3; “Não recomendado” explícito para C.

### 48. Integração React

- **A)** Runtime imperativo com ponte de snapshot. **Recomendado** (React 18 atual).
- **B)** Atualizar React para 19 + R3F/drei. Risco: mudança ampla, não autorizada.
- **C)** Web Component isolado. Risco: segunda UI/estilo divergente.

**Recomendação:** A agora; B só com decisão de produto específica.

### 49. Modelo de segurança para bytes

- **A)** Token + protocolo `lia3d://` com Range e allowlist. **Recomendado.**
- **B)** Bytes por IPC (structured clone), teto baixo (ex.: 64 MB). Simples, mas limita e duplica memória.
- **C)** `file://` no renderer. **Rejeitado.**
- **D)** Servidor HTTP local dentro do app. Duplica transporte e superfície.

**Recomendação:** A no desktop; B como fallback para arquivos pequenos; HTTP same-origin no preview.

### 50. Limites de memória e concorrência

- **A)** 1 sessão, teto 256 MB, cache 64 MB, DPR ≤ 1.5, sem pós-processamento. **Recomendado.**
- **B)** 2 sessões com cache maior. Risco em 16 GB.
- **C)** Sem teto, confiar no usuário. Risco: travar a máquina.

**Recomendação:** A, com modo leve e recusa nomeada.

### 51. Formatos aceitos na Fase 1

- **A)** `.glb` + `.gltf` autocontido (recursos em `data:`); externos só na Fase 5. **Recomendado.**
- **B)** `.glb` + `.gltf` externo com allowlist de diretório. Mais útil, mais superfície.
- **C)** Todos os formatos dos loaders. Risco: semântica e memória.

**Recomendação:** A; B na Fase 5, com allowlist e testes negativos; C nunca como promessa.

### 52. Persistência de sessão/overrides

- **A)** `.lia-forge/view3d/sessions/*.json`, fora do store de assets. **Recomendado.**
- **B)** Dentro de `.spriteforge/assets.json` como campo novo. Risco: schema do store.
- **C)** Banco/serviço externo. Fora de escopo.

**Recomendação:** A; nunca B sem migração aprovada.

### 53. Captura e exportação

- **A)** Captura PNG explícita; export GLB derivado só na Fase 5 com diff. **Recomendado.**
- **B)** Exportar direto do viewport como “salvar”. Risco: perda silenciosa.
- **C)** Nenhuma captura. Perde comparação e thumbnails.

**Recomendação:** A; exportação derivada só na Fase 5.

### 54. Validação de glTF

- **A)** Opcional `gltf-validator` como adapter externo. **Recomendado.**
- **B)** Não validar além de `glb-structural`. Aceitável na Fase 1.
- **C)** Implementar validador próprio. Custo alto e sem ganho sobre Khronos.

**Recomendação:** B na Fase 1, A a partir da Fase 5.

### 55. Evidência de “funciona”

- **A)** Windows real + RX 580 + app empacotado, com `chrome://gpu` e métricas. **Recomendado.**
- **B)** Chromium headless com SwiftShader. Só prova ausência de exceção.
- **C)** Screenshot sem números. Não é evidência.

**Recomendação:** A para “pronto”; B/C aceitáveis apenas como teste de fumaça.

### 56. Fronteira com `Lia3DSprite` e render

- **A)** Viewport é inspetor; render/spritesheet continua Blender e a comparação de renderer permanece aberta. **Recomendado.**
- **B)** Viewport vira renderer candidato de `Lia3DSprite`. Exige decisão de renderer (ADR-001, Decisão 5) e evidência comparativa.
- **C)** Viewport substitui Blender. **Rejeitado.**

**Recomendação:** A; B só depois de E2E comparativo com mesmo input/hash.

### 57. Teto de importação de modelos

- **A)** Manter `saveInput` em 32 MB; o viewport abre apenas arquivos já presentes no projeto. **Recomendado para a Fase 1**, porque não altera o fluxo existente.
- **B)** Elevar o teto com upload em streaming, confirmação e testes de memória. Necessário para prometer “abrir modelos de até 256 MB” pelo seletor.
- **C)** Aceitar cópia manual para `input/` como caminho oficial. **Rejeitado**: porta lateral sem validação nem UX.

**Recomendação:** A na Fase 1; B somente se o produto decidir que importar arquivos grandes pelo app é requisito. A limitação de 32 MB não pode ser escondida na UI.

## 4. Decisões que esta missão **não** toma

- Não escolhe renderer padrão.
- Não aprova contratos de domínio.
- Não define provider/modelo/peso.
- Não autoriza instalação, download, compra, upload ou aceite de licença.
- Não altera o workflow existente.
- Não muda a branch do agente principal.
- Não aprova a implementação do módulo.

## 5. Gatilhos de revisão

| Evento | Ação |
|---|---|
| Aprovação das decisões 45–57 | Abrir pacote de contratos puros + testes |
| Evidência de fps/memória abaixo do alvo | Revisar orçamento antes de expandir |
| WebGPU funcionar de forma estável | Reavaliar backend padrão (sem prometer) |
| Contrato de `ProjectVisualProfile` aprovado | Planejar leitura, não escrita |
| Usuário pedir edição de malha | Reafirmar fronteira com Blender |
| Novo formato demandado | Avaliar via Blender/conversão, não loader direto |
| CSP quebrar o app empacotado | Rollback da CSP (não do app) e reavaliação |
