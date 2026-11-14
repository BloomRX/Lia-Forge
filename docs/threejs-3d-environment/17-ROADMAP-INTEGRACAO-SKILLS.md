# 17 — Roadmap de integração de skills, agentes e ferramentas

> **Status:** `PROPOSTA` em 2026-11-13. Nada aqui foi implementado, instalado ou executado. As fases são condicionais às decisões **58–62** e não promovem nenhuma capability existente.

Este documento fecha a frente complementar: define **quais skills o Lia Forge deve ter**, **como elas se encaixam no Skills & Knowledge Engine e no Intelligent Orchestrator**, **como agentes as usariam** e **em que ordem isso pode acontecer** sem confundir conhecimento com execução. A auditoria está em [`15`](15-ECOSSISTEMA-SKILLS-E-AGENTES.md); a matriz, em [`16`](16-MATRIZ-SOLUCOES-SKILLS.md).

---

## 1. Princípios

1. **Skill é conhecimento, não executor.** Um `SKILL.md` não abre arquivo, não instala dependência, não chama API, não envia bytes e não inicia processo.
2. **Agente propõe; Orchestrator planeja; ferramenta executa; humano decide.** Nenhuma camada substitui a outra.
3. **Toda skill declara a revisão do Three.js** e a data de verificação. “r186” não é “r187”.
4. **Toda skill externa é dado não confiável** até revisão de conteúdo, licença, proveniência e segurança.
5. **Nada de `unknown` disfarçado.** O estado é `first-party`, `reviewed-external`, `unreviewed` ou `blocked`; a disponibilidade é `instalado`, `disponível` ou `testado`, com evidência.
6. **Offline por padrão.** Conteúdo externo não pode exigir internet, conta ou chave como condição geral do produto.
7. **Sem duplicação.** Uma skill por responsabilidade; não criar uma segunda fonte de verdade para o que [`03`](03-PESQUISA-TECNICA-THREEJS.md), [`06`](06-CONTRATOS-E-INTEGRACAO.md) ou [`14`](14-CRITERIOS-DE-ACEITE.md) já fixam.
8. **Escopo do v1 preservado.** O viewport é inspetor read-only; Blender autora; o Lia Forge governa projeto, asset, contrato, permissão, QA e histórico.

---

## 2. Onde as skills se encaixam

### 2.1 Fronteira dos quatro componentes

```
┌──────────────────────────────────────────────────────────────┐
│ Skills & Knowledge Engine                                    │
│  catálogo, manifesto, proveniência, licença, busca, leitura  │
│  NÃO executa, NÃO instala, NÃO altera asset                  │
└──────────────────────────────┬───────────────────────────────┘
                               │ skill + hash + versão
┌──────────────────────────────▼───────────────────────────────┐
│ Intelligent Orchestrator                                     │
│  escolhe rota, anexa skill ao passo, calcula bloqueios       │
│  NÃO carrega skill silenciosamente, NÃO executa ferramenta    │
└──────────────────────────────┬───────────────────────────────┘
                               │ plano + capability + gate
┌──────────────────────────────▼───────────────────────────────┐
│ Agente opcional                                              │
│  lê skill, interpreta, propõe diagnóstico e próximo passo    │
│  NÃO ganha permissão por causa da skill                      │
└──────────────────────────────┬───────────────────────────────┘
                               │ pedido autorizado
┌──────────────────────────────▼───────────────────────────────┐
│ Tool / Provider / Adapter                                    │
│  executa em processo isolado, com limite, log e consentimento │
│  NÃO é chamado implicitamente por uma skill                   │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Regras de composição

- O Orchestrator pode anexar **mais de uma skill** ao mesmo passo, desde que elas não se contradigam e que o plano registre os IDs e hashes.
- Uma skill pode recomendar uma ferramenta, mas a recomendação **não** é uma autorização. O passo continua sujeito a `requiredCapabilities`, `humanGates` e `protectedActions`.
- Se a skill exige uma capability inexistente, o passo fica **bloqueado com razão nomeada**. Exemplo: uma skill de materiais que exige `material.pbr` não pode aparecer como executável enquanto essa capability estiver `planned`.
- O relatório final deve registrar **quais skills influenciaram o plano** e **quais não foram usadas**, para permitir reprodução e comparação.

---

## 3. Manifesto proposto

O schema abaixo é uma **extensão ilustrativa** do manifesto já proposto em [`SKILLS-KNOWLEDGE-ENGINE.md`](../SKILLS-KNOWLEDGE-ENGINE.md). Campos novos: `threeRevision`, `verifiedAt`, `reviewer`, `execution` e `superses`. Os valores são exemplos; nenhum hash real foi calculado.

```yaml
id: lia-threejs-gltf-intake
version: 0.1.0
title: "Importar e diagnosticar GLB/glTF"
description: "Checklist de importação, extensões, escala, eixos, hierarquia, materiais e animações."
assetCategories: [model3d]
stages: [import, validate]
routeTags: [3d-object-render, 3d-character-spritesheet, existing-asset-to-edit]
inputs: [model/gltf-binary, model/gltf+json]
outputs: [relatorio/json, checklist]
requiredCapabilities: [model3d.inspect]
optionalProviders: [gltf-validator, gltf-transform]
humanGates: [asset-acceptance]
risks: [missing-textures, unsupported-extension, wrong-scale]
offlineUsable: true
threeRevision: 0.187.0
verifiedAt: 2026-11-13
source:
  upstream: first-party
  commit: "<commit que criar a skill>"
  author: "Lia Forge"
  contentHash: "sha256:<calculado no commit>"
license:
  id: MIT
  url: "https://github.com/<org>/<repo>/blob/<commit>/LICENSE"
  reviewedAt: 2026-11-13
trust: first-party
reviewer: "<pessoa>"
execution:
  scripts: none
  network: false
  filesystem: read-only
superses: null
```

### 3.1 Regras do manifesto

| Campo | Regra |
|---|---|
| `id` | Estável, único, em minúsculas e com prefixo `lia-threejs-`. Não reutilizar após remoção. |
| `version` | Semver; mudança de conteúdo que altera recomendação sobe minor; correção factual sobe patch. |
| `requiredCapabilities` | Só IDs existentes no registry; capability `planned` bloqueia o passo, não “quase funciona”. |
| `humanGates` | Obrigatório para captura, exportação, sobrescrita, uso de rede e execução de script. |
| `threeRevision` | Revisão exata contra a qual a skill foi verificada; não é faixa. |
| `verifiedAt` | Data da última verificação; não é data de publicação. |
| `source` | Para conteúdo externo, URL, commit, autor e hash do conteúdo lido; para first-party, commit do projeto. |
| `license` | ID SPDX, URL e data de revisão; `none-identified` é um estado válido e bloqueante. |
| `trust` | `first-party`, `reviewed-external`, `user-provided` ou `unreviewed`; não existe “trusted” genérico. |
| `execution` | `scripts`, `network`, `filesystem`; uma skill sem script declara `none`, não deixa implícito. |
| `superses` | ID da skill substituída, se houver; permite migração e rollback. |

### 3.2 O que o manifesto **não** faz

- Não concede permissão.
- Não instala dependência.
- Não prova que o conteúdo funciona.
- Não substitui o contrato de asset, o validador ou o gate humano.
- Não transforma uma skill externa em first-party.

---

## 4. Catálogo proposto de skills first-party

A lista é intencionalmente pequena. O objetivo é cobrir o ciclo de inspeção e QA, não recriar um catálogo de 79 skills.

### 4.1 Resumo

| ID | Skill | Fase | Capabilities | Gate | Offline |
|---|---|---|---|---|---|
| `lia-threejs-skill-curation` | Curadoria e proveniência de skills | 0 | nenhuma | aprovar leitura, adaptação e execução | Sim |
| `lia-threejs-gltf-intake` | Importar e diagnosticar GLB/glTF | 1 | `model3d.inspect` | aceitar asset | Sim |
| `lia-threejs-scene-review` | Diagnosticar cena, câmera, luz e loop | 1–2 | `model3d.inspect`; `model3d.preview` futuro | nenhum para leitura | Sim |
| `lia-threejs-performance-budget` | Medir e alertar orçamento gráfico | 2–3 | telemetria do viewport | nenhum para medir | Sim |
| `lia-threejs-visual-evidence` | Capturar, comparar e registrar evidência | 2 | `render3d.frame` ou captura do viewport | salvar versão | Parcial |
| `lia-threejs-material-lighting-review` | Revisar PBR, texturas e iluminação | 3 | `material.inspect` futuro; `material.pbr` planejado | alterar material | Sim |
| `lia-threejs-motion-review` | Revisar skeleton, clipes e loop | 4 | `rig3d.inspect` futuro; `motion.cycles` | editar animação | Sim |
| `lia-threejs-export-diff` | Comparar original e derivado | 5 | `model3d.export` | exportar | Sim |
| `lia-threejs-blender-boundary` | Encaminhar para Blender com contexto | 5 | `render3d.frame`; `model3d.export` | abrir ou exportar | Sim |

### 4.2 `lia-threejs-skill-curation`

**Para que serve.** Avaliar uma skill externa antes de qualquer uso: fonte, commit, licença, conteúdo, scripts, dependências, revisão do Three.js, riscos e duplicação.

**Checklist mínimo.**
- URL, autor, commit, data e hash do conteúdo.
- Licença identificada e compatibilidade; GPL, sem licença e `NOASSERTION` bloqueiam cópia.
- Revisão declarada e data; comparar com `three@0.187.0`.
- Scripts, rede, chaves, filesystem, `eval`, `child_process`, `rm -rf`, `sudo` e URLs.
- Instruções de prompt injection, exfiltração, desativação de gate e escrita fora do projeto.
- Assets e outputs com direitos próprios.
- Duplicação com docs existentes.
- Decisão: `first-party`, `reviewed-external`, `unreviewed`, `blocked` ou `discarded`.

**Não faz.** Não instala, não executa, não aprova sozinha.

### 4.3 `lia-threejs-gltf-intake`

**Para que serve.** Transformar o relatório do `model3d.inspect` em um diagnóstico de importação compreensível.

**Deve verificar.**
- Container: GLB válido ou glTF autocontido; extensões usadas.
- Escala e unidades: metros; bbox; se o modelo é “minúsculo” ou “gigante”.
- Eixos: +Y up, +Z forward; frente do asset; `Object3D.getWorldDirection` = +Z; câmera = −Z.
- Hierarquia: nomes vazios/duplicados, pivôs, transforms, instâncias.
- Materiais: PBR, texturas ausentes, cores em sRGB vs linear.
- Animações: clipes, duração, skins, morph targets.
- Riscos: Draco/Meshopt/KTX2 sem decoder, texturas externas, `.gltf` com recursos externos, arquivo acima do teto.

**Capabilities.** `model3d.inspect` (implementada, beta). Não exige viewport.

**Gate.** Leitura não exige; aceitar o asset como versão exige confirmação humana.

**Saída.** Relatório JSON + checklist legível; nenhuma alteração no arquivo.

### 4.4 `lia-threejs-scene-review`

**Para que serve.** Explicar por que uma cena está preta, lavada, sem sombra ou sem animação, em modo read-only.

**Ordem de diagnóstico.**
1. Câmera: posição, `near/far`, aspecto, `lookAt`.
2. Escala: bbox e distância da câmera.
3. Material: `MeshNormalMaterial` para isolar geometria.
4. Luz: ambiente/hemisfério + key direcional; intensidade fisicamente correta.
5. Cor: `outputColorSpace`, `toneMapping`, `OutputPass`.
6. Loop: `setAnimationLoop`, `Timer`, delta.
7. Carregamento: `GLTFLoader`, decoder, textura, CORS.

**Capabilities.** `model3d.inspect`; quando existir, `model3d.preview`. Enquanto o viewport não existe, a skill só pode diagnosticar estrutura e código, **não** afirmar o que aparece na tela.

**Gate.** Nenhum para leitura; qualquer correção de arquivo é proposta, não execução.

### 4.5 `lia-threejs-performance-budget`

**Para que serve.** Ler telemetria e comparar com orçamento declarado.

**Métricas.** `drawCalls`, `triangles`, `geometries`, `textures`, `textureBytes`, tempo de frame, DPR, resolução, backend, `renderer.info`.

**Orçamento inicial proposto.** Não é medição: 512 MB confortável, 1 GB alerta, 1,2 GB recusa; DPR ≤ 1.5; uma sessão; render sob demanda. A fonte é [`09`](09-HARDWARE-E-DESEMPENHO.md).

**Regra.** Campo ausente é `unknown`, não zero. WebGL e WebGPU expõem métricas diferentes. Não comparar números de backends diferentes sem declarar.

**Gate.** Nenhum para medir; nenhum para exibir alerta; o humano decide reduzir escopo.

### 4.6 `lia-threejs-visual-evidence`

**Para que serve.** Produzir evidência reproduzível de uma cena ou comparação.

**Deve registrar.** Data, revisão do Three.js, backend, DPR, resolução, câmera, ambiente, tone mapping, `sha256` do asset, skill IDs e hashes, comando e resultado.

**Regras.**
- Captura é uma **nova versão**, nunca sobrescreve o original.
- Comparação A/B usa a mesma câmera, o mesmo tempo e o mesmo asset.
- Pixels não provam qualidade estética; provam que algo foi desenhado.
- “Passou” exige métrica e inspeção humana; não existe score único.

**Gate.** Salvar versão e exportar exigem confirmação.

### 4.7 `lia-threejs-material-lighting-review`

**Para que serve.** Revisar PBR, texturas, cor e iluminação sem editar o asset.

**Deve verificar.**
- `MeshStandardMaterial` como padrão; `MeshPhysicalMaterial` só para clearcoat/transmission/sheen.
- `map`/`emissiveMap` em sRGB; normal/roughness/metalness em linear.
- Intensidade de luz fisicamente baseada; ambiente/IBL; sombras em renderer, luz e mesh.
- `toneMapping` escolhido uma vez; `OutputPass` no fim da cadeia.
- Texturas ausentes, tamanho, compressão, cor, UV.

**Capabilities.** `material.inspect` é proposta; `material.pbr` está `planned`. Sem elas, a skill é **conhecimento**, não verificação automática.

**Gate.** Alterar material exige confirmação e diff.

### 4.8 `lia-threejs-motion-review`

**Para que serve.** Revisar skeleton, skins, clipes e loop.

**Deve verificar.**
- `skins`, joints, inverse bind matrices, nomes e hierarquia.
- Clipes, duração, tracks, root motion, loop, cross-fade.
- `SkeletonUtils.clone` para instâncias; um `AnimationMixer` por raiz animada.
- Escala, pose de bind, feet sliding, matrizes não finitas.
- Câmera vs personagem: +Z do `Object3D`, −Z da câmera.

**Capabilities.** `rig3d.inspect` é proposta; `motion.cycles` existe. Não editar keyframes.

**Gate.** Editar animação ou rig é Blender; o Lia Forge só inspeciona e propõe.

### 4.9 `lia-threejs-export-diff`

**Para que serve.** Comparar original e derivado antes de aceitar uma exportação.

**Deve verificar.** Contagem de nós/malhas/materiais/texturas/animações; extensões; tamanho; hash; perda de skins, morphs, cameras, lights, metadata; mudança de eixos/escala; arquivos externos.

**Regra.** Exportação nunca sobrescreve o original. Se o diff não for compreensível, o padrão é recusar.

**Gate.** Exportar e salvar versão exigem confirmação humana.

### 4.10 `lia-threejs-blender-boundary`

**Para que serve.** Encaminhar trabalho que não pertence ao Three.js para o Blender, com contexto suficiente.

**Deve incluir.** Objetivo, asset e hash, bbox/escala, eixos, materiais, texturas, rig/clips, o que já foi tentado, o que não deve ser alterado, critério de aceite e formato de retorno.

**Não faz.** Não controla Blender, não instala add-on, não executa Python, não promete render final.

**Gate.** Abrir no Blender e exportar exigem confirmação.

---

## 5. Como o Orchestrator usaria

### 5.1 Receitas existentes

As receitas `3d-object-render` e `3d-character-spritesheet` já têm passos com `model3d.inspect`, `render3d.frame`, `render.atlas`, `rig3d.auto`, `motion.cycles` e `render3d.to2d`. As skills propostas se anexam assim:

| Passo da receita | Skill candidata | O que a skill acrescenta | O que ela não faz |
|---|---|---|---|
| `inspect` | `lia-threejs-gltf-intake` | Checklist de extensões, escala, eixos, materiais e clips | Não altera o GLB |
| `render` | `lia-threejs-scene-review` + `lia-threejs-visual-evidence` | Diagnóstico de cena e critério de captura | Não renderiza sozinha |
| `atlas` | `lia-threejs-performance-budget` | Orçamento de frames e tamanho | Não empacota |
| `auto-rig` | `lia-threejs-motion-review` | Critério de inspeção de skeleton | Não rigga |
| `animate` | `lia-threejs-motion-review` | Critério de loop e root motion | Não edita keyframes |
| `deliver` | `lia-threejs-export-diff` | Diff e recusa de perda | Não exporta |

### 5.2 Exemplo de plano com skills anexadas

```json
{
  "workflowId": "3d-object-render",
  "steps": [
    {
      "id": "inspect",
      "capability": "model3d.inspect",
      "skills": [
        {
          "id": "lia-threejs-gltf-intake",
          "version": "0.1.0",
          "threeRevision": "0.187.0",
          "contentHash": "sha256:<exemplo>"
        }
      ],
      "blockedReason": null
    }
  ],
  "skillsUsed": ["lia-threejs-gltf-intake"],
  "humanGates": ["asset-acceptance"],
  "executed": false
}
```

**Nota:** o campo `skills` ainda **não existe** no planner atual. Este é um contrato proposto; nenhuma alteração de código foi feita. O Orchestrator continua planejando e não executando.

### 5.3 Regras de bloqueio

- Skill com `threeRevision` diferente da instalada: **aviso**, não bloqueio automático; se a skill usar API removida, o passo fica bloqueado.
- Skill com `requiredCapabilities` indisponível: **bloqueio nomeado**, com alternativa.
- Skill `unreviewed`: só leitura; não pode influenciar plano que executa ação.
- Skill `blocked`: não aparece como candidata executável.
- Conflito entre duas skills: mostrar as duas e pedir decisão; não escolher silenciosamente.

---

## 6. Como agentes usariam

### 6.1 `IntakeAgent`

**Entrada:** um arquivo GLB/glTF e o relatório de `model3d.inspect`.

**Fluxo:** classificar → listar extensões → estimar escala → listar materiais/texturas ausentes → listar clips/skins → apontar riscos → propor aceitar, converter ou pedir correção.

**Proibido:** instalar decoder, baixar textura, abrir URL, alterar arquivo, “corrigir” eixo sem confirmação.

### 6.2 `SceneReviewAgent`

**Entrada:** código da cena, relatório estrutural, captura quando existir.

**Fluxo:** aplicar checklist da `lia-threejs-scene-review`; separar “não desenhou” de “desenhou errado”; pedir captura se não houver; citar a fonte de cada diagnóstico.

**Proibido:** declarar que a cena “está boa” sem captura ou sem critério; editar arquivo.

### 6.3 `QAAgent`

**Entrada:** asset, cena, skill e orçamento.

**Fluxo:** capturar, medir, comparar, registrar proveniência, apontar `unknown`, gerar relatório.

**Proibido:** sobrescrever versão, esconder falha, transformar métrica em score único, chamar renderer externo sem gate.

### 6.4 `SkillCuratorAgent`

**Entrada:** URL, commit, licença, conteúdo.

**Fluxo:** executar o checklist da `lia-threejs-skill-curation`, calcular hash, comparar com a revisão instalada, detectar duplicação, propor `trust` e pedir aprovação.

**Proibido:** instalar, executar, aprovar sozinho, copiar conteúdo para o produto sem revisão.

### 6.5 O que o agente **não** é

- Não é o Skills Engine.
- Não é o Orchestrator.
- Não é um executor com permissão implícita.
- Não é uma fonte de verdade sobre versão, licença ou qualidade.

---

## 7. Roadmap por fases

As fases abaixo são **complementares** às fases 0–5 de [`11-PLANO-POR-FASES.md`](11-PLANO-POR-FASES.md). Elas não autorizam implementação; cada uma tem entrada, saída e gate humano.

### S0 — Curadoria e decisões (agora)

**Objetivo:** transformar pesquisa em política.

**Entregas.**
- [`15`](15-ECOSSISTEMA-SKILLS-E-AGENTES.md), [`16`](16-MATRIZ-SOLUCOES-SKILLS.md) e este documento.
- Decisões 58–62 registradas.
- Lista de fontes bloqueadas, descartadas e recomendadas.
- Nenhuma dependência nova, nenhum arquivo executável, nenhum asset externo.

**Saída.** Decisões respondidas; owner da curadoria definido; nenhuma skill instalada.

**Gate.** Revisão humana dos documentos e das decisões.

### S1 — Conhecimento read-only (acompanha a Fase 1 do viewport)

**Objetivo:** ter skills first-party para importar e diagnosticar sem viewport.

**Entregas.**
- `lia-threejs-skill-curation`, `lia-threejs-gltf-intake` e `lia-threejs-scene-review`.
- Manifesto com `threeRevision`, `verifiedAt`, `trust`, `execution`.
- Checklists de extensões, escala, eixos, hierarquia, materiais e animações.
- Testes de conteúdo e de links, sem executar scripts externos.

**Capabilities.** `model3d.inspect` apenas. Nada de `model3d.preview` prometido.

**Saída.** Skills revisadas, estado explícito, nenhuma execução externa.

**Gate.** Aprovação humana do catálogo e do conteúdo.

### S2 — Evidência e orçamento (acompanha a Fase 2)

**Objetivo:** medir e capturar quando o viewport existir.

**Entregas.**
- `lia-threejs-performance-budget` e `lia-threejs-visual-evidence`.
- Contrato de captura: revisão, backend, DPR, câmera, ambiente, hash, skill.
- Comparação A/B com mesma câmera e mesmo tempo.
- Nenhuma sobrescrita.

**Capabilities.** Captura do viewport; `render3d.frame` só como alternativa Blender.

**Saída.** Evidência reproduzível; `unknown` explícito para métricas ausentes.

**Gate.** Aprovação de captura e de salvamento de versão.

### S3 — Materiais e iluminação (acompanha a Fase 3)

**Objetivo:** revisar PBR, texturas e cor sem editar.

**Entregas.**
- `lia-threejs-material-lighting-review`.
- Checklist de sRGB/linear, intensidade, sombra, IBL, tone mapping e `OutputPass`.
- Relação de texturas ausentes e orçamento de VRAM.

**Capabilities.** `material.inspect` precisa existir; `material.pbr` continua `planned` até implementação.

**Saída.** Diagnóstico de material; nenhuma pintura, bake ou edição.

**Gate.** Aprovação para qualquer alteração de material.

### S4 — Animação e personagens (acompanha a Fase 4)

**Objetivo:** inspecionar skeleton, skins, clipes e loop.

**Entregas.**
- `lia-threejs-motion-review`.
- Checklist de bind pose, joints, root motion, loop, clone e mixer.
- Distinção entre “clip existe” e “clip funciona”.

**Capabilities.** `rig3d.inspect` precisa existir; `motion.cycles` já existe.

**Saída.** Diagnóstico de animação; nenhuma edição de keyframe.

**Gate.** Aprovação para editar no Blender.

### S5 — Integração e fronteira (acompanha a Fase 5)

**Objetivo:** ligar skills ao fluxo real e ao Blender.

**Entregas.**
- `lia-threejs-export-diff` e `lia-threejs-blender-boundary`.
- Diff de original × derivado; exportação sem overwrite.
- Contexto de handoff para Blender.
- `gltf-validator`, `gltf-transform` e `gltfpack` como etapas **opcionais**, não dependências.

**Capabilities.** `model3d.export`, `render3d.frame`; nenhuma promessa de renderer final.

**Saída.** Workflow com gate; exportação derivada; relatório de diferenças.

**Gate.** Aprovação de exportação e de abertura no Blender.

### S6 — Pesquisa pós-5

**Objetivo:** avaliar o que não pertence ao v1.

**Candidatos.**
- `Kiln` como provider MCP local, com sandbox e gate.
- `Blender MCP` como ponte de autoria, com execução Python isolada.
- WebGPU/TSL, com medição na RX 580 e fallback WebGL2.
- VFX/partículas com `NixieFX`, somente após suporte a r187.
- `img2threejs` como fábrica procedural, sem adoção de pipeline.
- Procedural geometry/architecture skills, como inspiração de autoria.

**Regra.** Cada candidato exige decisão própria, teste isolado e orçamento. Nada entra “de carona” na fase 5.

---

## 8. Critérios de aceite de curadoria

Estes critérios são **adicionais** aos G1–G14 e F1-1…F5-12 de [`14`](14-CRITERIOS-DE-ACEITE.md); não os substituem nem promovem fase.

| ID | Critério | Evidência exigida |
|---|---|---|
| SC1 | Proveniência completa | `source` com URL, commit, autor e `contentHash`; `license` com ID, URL e data. |
| SC2 | Revisão declarada e verificada | `threeRevision` exata; confronto com `package.json` e APIs citadas. |
| SC3 | Estado honesto | `trust` e disponibilidade explícitos; nenhum `unknown` disfarçado. |
| SC4 | Offline por padrão | `offlineUsable`; rede declarada; nenhuma chamada obrigatória. |
| SC5 | Sem execução implícita | `execution.scripts`; scripts isolados; consentimento; nenhum `postinstall`. |
| SC6 | Capabilities reais | `requiredCapabilities` conferidas no registry; `planned` bloqueia. |
| SC7 | Gates humanos | Captura, exportação, sobrescrita, rede e script exigem confirmação. |
| SC8 | Conteúdo seguro | Varredura de prompt injection, segredos, URLs, `eval`, `child_process`, `rm -rf`, `sudo`. |
| SC9 | Evidência de comportamento | Teste executado em ambiente controlado; README não é prova. |
| SC10 | Licença e atribuição | Compatibilidade; `NOTICE`; assets e outputs com termos próprios. |
| SC11 | Atualização e rollback | Versão anterior preservada; diff; desinstalação sem afetar assets. |
| SC12 | Sem duplicação | Referência aos docs existentes; uma skill por responsabilidade. |

### 8.1 Critérios negativos

Uma skill **não** é aceita se:

- declara “r187” sem verificação;
- contém script sem inventário de dependências;
- exige rede, chave ou conta para funcionar;
- copia conteúdo GPL, sem licença ou de marketplace sem proveniência;
- recomenda desativar CSP, `webSecurity`, gate ou validação;
- promete “corrigir” geometria, rig ou material sem ferramenta e sem diff;
- duplica uma capacidade já existente sem justificar;
- usa `unknown` como se fosse resultado.

---

## 9. Decisões humanas abertas

Estas questões devem ser registradas em [`../DECISIONS-AND-OPEN-QUESTIONS.md`](../DECISIONS-AND-OPEN-QUESTIONS.md). Nenhuma tem default aplicado.

**58. Política de adoção de skills externas.** O Lia Forge deve (a) referenciar e adaptar skill por skill, com commit, hash, licença e revisor, sem instalar; (b) vendorizar o texto integral no repositório, com `NOTICE` e teste; ou (c) instalar via CLI no ambiente do usuário? A opção (a) preserva controle e permite remover; a (b) aumenta reprodutibilidade offline e o custo de manutenção; a (c) delega versão e atualização a terceiros e conflita com “nada de execução silenciosa”.

**59. Pinning e drift de versão.** Toda skill declara `threeRevision` e `verifiedAt` e é bloqueada se a API usada não existir? Ou aceita faixa semver, ou “latest”? A primeira opção é reproduzível e exige manutenção; a segunda reduz trabalho e aumenta o risco de drift; a terceira é incompatível com auditoria.

**60. Gate para MCP e ferramentas executáveis.** `Kiln`, `Blender MCP`, `gltf-transform`, `gltfpack` e `gltf-validator` entram como providers/adapters separados, com processo isolado, sem rede por padrão, filesystem scoped, limites, consentimento e kill switch? Ou ficam fora do produto e são apenas ferramentas do usuário? A primeira opção cria superfície de execução; a segunda preserva o produto e limita automação.

**61. Fronteira entre skill, agente e ferramenta.** Aprova-se a separação em que Skills Engine só mantém conhecimento, Orchestrator só planeja, agente só propõe e ferramenta só executa sob capability e gate? Ou se permite que uma skill “recomende e execute” uma ferramenta? A segunda opção viola a regra atual do [`SKILLS-KNOWLEDGE-ENGINE.md`](../SKILLS-KNOWLEDGE-ENGINE.md) e cria autorização implícita.

**62. Licenças e conteúdo.** Bloquear cópia de GPL, `NOASSERTION` e sem licença; permitir adaptação de MIT/Apache com atribuição e `NOTICE`; tratar agregadores e marketplaces apenas como descoberta? Ou permitir uso interno de GPL sem redistribuição? A segunda opção exige parecer jurídico e pode contaminar o produto; a primeira é conservadora e compatível com a licença MIT do Lia Forge.

---

## 10. Riscos do roadmap

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| SK1 | Drift de API entre a skill e o three instalado | Alta | Alto | `threeRevision`, `verifiedAt`, drift checker, teste contra o pacote. |
| SK2 | Prompt injection em skill externa | Alta | Alto | Tratar como dado, varredura, sem execução, gates. |
| SK3 | Contaminação de licença | Média | Alto | Bloqueio de GPL/sem licença; auditoria por arquivo; `NOTICE`. |
| SK4 | Execução de script/MCP malicioso | Média | Alto | Processo isolado, sem rede default, filesystem scoped, consentimento. |
| SK5 | Falsa sensação de “testado” | Alta | Alto | Estado explícito; evidência de execução; nenhum README como prova. |
| SK6 | Skill r186 vendida como r187 | Alta | Médio | Varredura de APIs deprecadas; patch; teste. |
| SK7 | Marketplace morto ou desatualizado | Média | Médio | Fonte primária, commit, data; não usar listagem como verdade. |
| SK8 | Escopo virar gerador de assets/jogos | Alta | Alto | Skills de inspeção/QA; Blender para autoria; fases separadas. |
| SK9 | Excesso de skills e duplicação | Média | Médio | Catálogo pequeno; uma por responsabilidade; critério SC12. |
| SK10 | Agente tratar recomendação como permissão | Alta | Alto | Fronteira explícita; gates; nenhum script implícito. |

---

## 11. Definition of Done desta missão

1. [`15`](15-ECOSSISTEMA-SKILLS-E-AGENTES.md), [`16`](16-MATRIZ-SOLUCOES-SKILLS.md) e este documento existem, com fontes e limitações.
2. As nove URLs obrigatórias foram cobertas e classificadas.
3. As soluções alternativas relevantes foram auditadas ou explicitamente descartadas.
4. A compatibilidade com `three@0.187.0` foi verificada por API, não presumida.
5. O catálogo de skills propostas está ligado a capabilities reais ou explicitamente planejadas.
6. O roadmap está alinhado às fases 0–5 existentes e não promove nenhuma.
7. As decisões 58–62 estão registradas, sem default.
8. Nenhum item externo foi instalado, executado, copiado ou integrado.
9. Nenhum código de produção, contrato, teste ou `package.json` foi alterado.
10. Links, tabelas e JSON dos documentos foram verificados; `git diff --check` está limpo.
11. Commit e push foram feitos na branch da sessão.
12. A conclusão separa **recomendação técnica** de **decisão humana**.

---

## 12. Conclusão

O Lia Forge não precisa de mais um catálogo. Precisa de **nove skills pequenas, verificáveis e first-party**, ancoradas em capabilities que existem ou que estão claramente planejadas, e de uma política que impeça que conteúdo externo vire execução silenciosa.

A ordem correta é: **decidir (58–62) → curar (S0) → importar e diagnosticar (S1) → medir e capturar (S2) → materiais (S3) → animação (S4) → integração e Blender (S5) → pesquisa (S6)**. Nenhuma fase deve começar antes de a anterior ter evidência e aprovação humana.

As duas fontes que mais ajudam são o subconjunto r187 do `gamedev-skills` e a taxonomia do `CloudAI-X`. As duas que mais enganam são as que prometem “r187” sem verificação e as que escondem execução atrás de uma página de marketplace. O restante é método: proveniência, licença, revisão, gate e evidência.
