# 06 — Contratos e fronteiras de integração

> **Status:** `PROPOSTA`. Nenhum contrato abaixo existe no código. Nenhum foi adicionado ao pacote de Domain Contracts v1 (que segue **não aprovado** em [`../DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`](../DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md) §11).
> **Regra:** o viewport não cria um segundo domínio. Ele **lê** referências de asset (`assetId`, `path`, `sha256`) e **escreve** apenas duas coisas, sempre com ação explícita: (a) overrides de sessão em JSON próprio; (b) artefatos derivados (captura PNG) registrados pelo fluxo existente.

## 1. Contrato `View3DSession` (efêmero, proposta)

Representa **uma sessão de inspeção**. Não é `Asset`, não é `AssetVersion`, não é `Artifact`.

```json
{
  "recordType": "view3dSession",
  "schemaVersion": 1,
  "id": "v3d_2f6a...",
  "createdAt": "2026-11-13T12:00:00.000Z",
  "source": {
    "assetId": "chr_mira",
    "origin": "input",
    "path": "input/mira.glb",
    "sha256": "9f2c...",
    "bytes": 18432000,
    "format": "glb"
  },
  "renderer": {
    "engine": "three",
    "engineVersion": "0.187.0",
    "backend": "webgl2",
    "software": false,
    "device": "unknown"
  },
  "camera": {
    "type": "perspective",
    "position": [2.4, 1.6, 3.2],
    "target": [0, 0.9, 0],
    "fov": 45,
    "orthoHeight": null
  },
  "report": {
    "declared": { "meshes": 3, "triangles": 12400, "materials": 4, "animations": 2 },
    "measured": { "meshes": 3, "triangles": 12400, "drawCalls": 18, "textures": 6 },
    "bounds": { "min": [-0.8, 0, -0.4], "max": [0.8, 1.9, 0.4], "size": [1.6, 1.9, 0.8] },
    "notes": []
  },
  "overridesRef": null
}
```

**Regras de validação propostas**

| Campo | Regra |
|---|---|
| `recordType`/`schemaVersion` | obrigatórios, literais |
| `id` | ID estável com prefixo (`v3d_`), não é caminho |
| `source.path` | relativo ao projeto, começa em `input/` ou `.lia-forge/runs/`, sem `..` |
| `source.sha256` | 64 hex; **calculado no main**, nunca informado pelo renderer |
| `source.bytes` | inteiro > 0, ≤ teto configurado |
| `renderer.backend` | `webgl2`, `webgpu` ou `unknown` |
| `camera` | números finitos; `orthoHeight` obrigatório se ortográfica |
| `report` | apenas números/strings; nenhum booleano de aprovação |
| `overridesRef` | caminho relativo dentro de `.lia-forge/view3d/` ou `null` |

**Onde persiste:** apenas se o usuário salvar a sessão; caso contrário, vive em memória e morre com a view. Se persistida: `.lia-forge/view3d/sessions/<id>.json`. Nunca em `.spriteforge/assets.json` (esse store tem schema próprio e não deve ganhar campos inventados).

## 2. Contrato `View3DOverrides` (persistente, proposta)

Representa **alterações reversíveis de apresentação**, nunca edição do arquivo.

```json
{
  "recordType": "view3dOverrides",
  "schemaVersion": 1,
  "createdAt": "2026-11-13T12:05:00.000Z",
  "sourceSha256": "9f2c...",
  "camera": { "type": "perspective", "position": [2.4, 1.6, 3.2], "target": [0, 0.9, 0], "fov": 45 },
  "visibility": { "nodeId": false },
  "transforms": {
    "nodeId": { "position": [0,0,0], "rotationQuat": [0,0,0,1], "scale": [1,1,1] }
  },
  "materials": {
    "matId": {
      "baseColor": "#rrggbb",
      "metalness": 0.0,
      "roughness": 0.5,
      "opacity": 1.0,
      "textureOverrides": { "map": null }
    }
  },
  "lighting": { "preset": "studio-neutral", "environmentIntensity": 1.0 },
  "notes": "inspeção de proporção do braço"
}
```

**Regras**

- `sourceSha256` amarra o override ao **conteúdo exato** do arquivo. Se o arquivo mudar, o override fica `stale` e a UI avisa; não aplica silenciosamente.
- Nenhum campo de geometria, UV, skin, keyframe ou hierarquia estrutural.
- Nenhum `path` de textura externa; sobrescrita de textura só por **seleção de outra textura já do projeto**, com hash.
- Tamanho máximo proposto: 256 KB.
- Aplicação é **opt-in**: abrir o modelo não aplica overrides automaticamente; a UI pergunta “aplicar a última inspeção salva?”.

## 3. Contrato `View3DSessionReport` (observações, proposta)

```json
{
  "recordType": "view3dSessionReport",
  "schemaVersion": 1,
  "sessionId": "v3d_...",
  "sourceSha256": "9f2c...",
  "generatedAt": "2026-11-13T12:06:00.000Z",
  "observations": [
    { "code": "NO_NORMALS", "severity": "high", "subject": "node:Body", "detail": "primitiva sem NORMAL", "action": "recalcular normais no Blender antes de exportar" },
    { "code": "TEXTURE_HIGH_RES", "severity": "medium", "subject": "image:2", "detail": "4096×4096 (89 MB com mipmaps)", "action": "avaliar redução para o destino" }
  ],
  "metrics": { "triangles": 12400, "drawCalls": 18, "textures": 6, "estimatedTextureBytes": 47185920 },
  "limitations": ["não avalia qualidade artística", "cores dependem de tone mapping do viewport"]
}
```

**Regra dura:** `observations` não contém `approved`, `passed` ou equivalente. Aprovação é `HumanReview`, que não existe hoje como implementação (só como contrato proposto na spec de domínio).

## 4. Capabilities e adapter (proposta de vocabulário)

O registro atual (49 capacidades) não tem preview. Proposta mínima, **sem alterar o registro agora**:

| ID proposto | Família | Status proposto | Inputs | Outputs | Providers |
|---|---|---|---|---|---|
| `model3d.preview` | `3d` | `proposed` → `partial` quando houver Fase 1 | `model/gltf-binary`, `model/gltf+json` | `view/session-report` (efêmero) | `view3d-local` (interno) |
| `material.inspect` | `3d` | `proposed` | `model/gltf-binary` | `report/json` | `view3d-local` |
| `rig3d.inspect` | `rigging-motion` | `proposed` | `model/gltf-binary` | `report/json` | `view3d-local` |
| `motion.preview` | `rigging-motion` | `proposed` | `model/gltf-binary`, `clips` | `report/json` | `view3d-local` |

**Não** renomear `model3d.inspect` (já implementado) nem `material.pbr` (planned e com semântica de autoria). O viewport **não** substitui `material.pbr`; ele só lê.

**Manifesto de adapter proposto (esboço, não implementado):**

```json
{
  "id": "view3d-local",
  "version": "0.0.0",
  "title": "Viewport 3D interno",
  "class": "execution",
  "capabilities": ["model3d.preview", "material.inspect", "rig3d.inspect", "motion.preview"],
  "providers": ["lia-forge-internal"],
  "requirements": { "ramMb": 1024, "vramMb": null, "gpu": "webgl2", "network": false, "runtime": "Chromium/WebGL2" },
  "protectedActions": ["send_data", "install_software", "download_models_or_weights", "cost"],
  "cost": { "status": "not-applicable" }
}
```

Cuidados:
- `vramMb: null` porque **VRAM não é medida** hoje pelo produto. O preflight trata como `unknown`, coerente com a política atual; um número fixo seria hipótese disfarçada de requisito. O orçamento estimado (512 MB confortável, 1 GB de alerta, 1,2 GB de recusa) vive em [`09`](09-HARDWARE-E-DESEMPENHO.md) §3 e [`05`](05-ARQUITETURA-PROPOSTA.md) §5.
- O adapter é interno e não deve aparecer como “ferramenta instalada” no Hub.

## 5. Canais IPC propostos (Electron)

Todos com `assertTrustedIpcSender`, validação de payload, limite de tamanho e erro nomeado.

| Canal | Request | Response | Limites | Erros |
|---|---|---|---|---|
| `lia-forge:view3d:open` | `{ assetId?, path, origin: 'input' ou 'runs' }` | `{ sessionId, token, modelUrl, sha256, bytes, report }` | path ≤ 600 chars; `.glb` ou `.gltf` autocontido no v1; ≤ 256 MB | `VIEW3D_NOT_FOUND`, `VIEW3D_REFUSED_PATH`, `VIEW3D_TOO_LARGE`, `VIEW3D_UNSUPPORTED_FORMAT`, `VIEW3D_BUSY` |
| `lia-forge:view3d:close` | `{ sessionId }` | `{ ok: true }` | — | `VIEW3D_SESSION_UNKNOWN` |
| `lia-forge:view3d:save-overrides` | `{ sessionId, overrides }` | `{ path, sha256 }` | ≤ 256 KB; JSON validado | `VIEW3D_INVALID_OVERRIDES`, `VIEW3D_WRITE_REFUSED` |
| `lia-forge:view3d:capture` | `{ sessionId, width, height, purpose }` | `{ path, bytes, sha256 }` | ≤ 6 MB PNG; máx. 2048² | `VIEW3D_CAPTURE_FAILED`, `VIEW3D_TOO_LARGE` |
| `lia-forge:view3d:save-version` | `{ assetId, sessionId, artifacts[] }` | `{ version }` | payload ≤ 64 KB; usa `addAssetVersion` | `ASSET_NOT_FOUND`, `VIEW3D_STALE_SOURCE` |
| `lia-forge:view3d:metrics` | `{ sessionId? }` | `{ processes: [...], renderer: {...} }` | só números | — |

**Dois hosts, um contrato.** No app Electron, o `open` acima é IPC e o `modelUrl` é `lia3d://…`. No preview em navegador, o mesmo `View3DService` expõe `GET /api/lia-forge/studio/view3d/file?token=…` (same-origin) e o `modelUrl` é **relativo**; o renderer nunca monta `localhost` nem usa `/artifact` para modelos grandes. Ver a matriz de transporte em [`05`](05-ARQUITETURA-PROPOSTA.md) §6.3.

**Regras invioláveis**

1. Nenhum canal aceita caminho absoluto vindo do renderer.
2. Nenhum canal devolve caminho absoluto.
3. `capture` e `save-version` exigem ação explícita do usuário (não acontecem em `open`).
4. `save-version` não grava bytes novos: registra artefatos **já existentes** e valida o hash da fonte.
5. Um `sessionId` só serve para o arquivo declarado; não é “chave mestra” do projeto.

## 6. Protocolo `lia3d://` (proposta)

```
lia3d://<sessionId>/model        → arquivo declarado na sessão
lia3d://<sessionId>/sidecar/<n>  → apenas se .gltf com irmãos autorizados (fase posterior)
```

Regras:
- `protocol.registerSchemesAsPrivileged([{ scheme: 'lia3d', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])`.
- `protocol.handle('lia3d', ...)` valida `request.initiatorOrigin` contra a origem do app (dev e packaged).
- Resolve contra a **lista fechada** de arquivos da sessão; nunca `path.join(root, url)` direto.
- Recusa symlink no momento da leitura (`lstat`), como já é feito em `electron/main.cjs:1225`.
- `Accept-Ranges`/`Content-Range` para streaming; `Content-Type: model/gltf-binary` para `.glb` e `model/gltf+json` para `.gltf` autocontido.
- Token/sessão expiram: TTL padrão 30 min de inatividade; `close` revoga imediatamente.

## 7. Integração com os sistemas da Lia Forge

| Sistema | Estado real hoje | Relação proposta com o viewport | Garantia |
|---|---|---|---|
| **Asset Manager** | Implementado (`shared/assets/manager.mjs`): assets, versões, direitos, proveniência | Leitura na Fase 1; “salvar como versão” só na Fase 5, via `addAssetVersion` | Nenhuma versão é criada sem ação; hash sempre calculado |
| **ProjectVisualProfile** | **Só documentação** (spec §3.8, não aprovado) | Nenhuma dependência nas Fases 1–4. Fase 5 (opcional): ler preset de iluminação/cor do perfil aprovado — **sem** escrever | Viewport funciona com perfil ausente |
| **Workflows / Orchestrator** | Implementado (planner + execution manager) | Fase 5: um passo de workflow pode **abrir** o viewport para revisão humana; não vira etapa automática | Nenhum passo “renderiza” via viewport no v1 |
| **Tool Provider Hub** | Implementado (`shared/hub/provider-hub.mjs`) | Fase 1: registro proposto de `model3d.preview` como capability interna; Hub pode dizer “preview disponível/indisponível” | Sem dependência de ferramenta externa |
| **Blender Bridge** | **Não existe como contrato**; existe adapter de render por subprocesso (`electron/blender-adapter.cjs`) | Fase 5: “abrir no Blender” via ferramentas externas existentes; viewport não substitui o DCC | Arquivo original intocado; nenhuma sessão Blender controlada pelo app |
| **QA** | Implementado: validadores estruturais + conteúdo | Fase 1 produz `View3DSessionReport`; Fase 5 conecta ao fluxo de QA. **Não** grava `ValidationResult` | Nenhum “aprovado” automático |
| **ChangeImpactReport** | **Só contrato proposto** (spec §3.13) | Fase 5 (opcional): exibir impacto (quem usa o asset) em modo leitura | Não calcula linhagem |
| **Style Lock** | **Só proposta** (proposta consolidada §6, spec §3.11-3.12) | Nenhuma dependência. Fase 5 (opcional): comparar cor/material contra perfil aprovado e **sugerir** | Não bloqueia nem aprova |
| **Histórico / versionamento** | Implementado no Asset Manager; runs em `.lia-forge/runs/` | Overrides na Fase 2; captura/registro na Fase 5, sempre com `sourceSha256` e `sessionId` | Reversível: nada sobrescreve |
| **`Lia3DSprite` / spritesheet** | Implementado no adapter Blender (`electron/blender-adapter.cjs`, `scripts/blender_spritesheet.py`); renderer padrão **não** escolhido (spec consolidada §15.2) | Nenhuma dependência. O viewport só inspeciona o GLB que alimenta o pipeline; não monta câmera de sprite, não renderiza turntable e não produz atlas | Não vira renderer de spritesheet nem compete com o pipeline existente |
| **Exportadores** | Implementado: `buildExportBundle` + perfis de destino | Viewport **não exporta direto**; derivado explícito só na Fase 5 e exportação para destino continua por run + perfil | Nenhum “exportar do viewport” sem validação |
| **Comparison Lab** | Implementado: até 8 arquivos, métricas reais | Fase 5: aceitar capturas do viewport como entradas e A/B visual alternando dois GLBs na mesma sessão (um carregado por vez) | Comparação continua humana |

### 7.1 O que fazer quando o contrato não existe

Para `ProjectVisualProfile`, `StyleLock`, `ChangeImpactReport` e `Blender Bridge`: **não inventar**. O viewport deve:

1. Detectar ausência e mostrar “recurso não disponível nesta versão”.
2. Não simular dados (nada de “score de estilo”).
3. Manter o caminho funcional sem eles.

### 7.2 Dependências e decisões por integração

| Sistema | Dependência do viewport | Decisão humana necessária | Fase | Se não existir/aprovar |
|---|---|---|---|---|
| **Asset Manager** | `assetId`, versão, `sha256`, `addAssetVersion` | Nenhuma para leitura; aprovar o uso de `addAssetVersion` na Fase 5 | 1 (leitura) / 5 (registro) | Viewport abre por caminho de `input/`; registrar versão fica indisponível |
| **ProjectVisualProfile** | Preset de iluminação/cor (leitura) | Aprovar o contrato (spec §3.8) antes de ler | 5 (opcional) | Viewport usa ambiente neutro próprio; nada quebra |
| **Workflows** | Passo que abre revisão humana | Aprovar o passo e a evidência na jornada | 5 | Nenhum workflow menciona o viewport |
| **Tool Provider Hub** | Capability `model3d.preview` interna | Aprovar o vocabulário/capability (decisão 45) | 1 (registro) | Hub não anuncia preview; UI ainda funciona |
| **Blender Bridge** | “Abrir no Blender” contextual | Não há contrato de “Bridge”; aprovar apenas o diálogo com ferramenta externa | 5 | Botão não existe; Blender continua acessível pelas ferramentas atuais |
| **Comparison Lab** | Capturas como entradas; A/B de versões | Aprovar formato de captura/proveniência | 5 | Comparação continua só com artefatos existentes |
| **ChangeImpactReport** | Exibir impacto em leitura | Aprovar contrato (spec §3.13) | 5 (opcional) | Nenhum impacto é mostrado; não se inventa linhagem |
| **Style Lock** | Sugerir cor/material vs perfil aprovado | Aprovar contrato e critério (spec §3.11–3.12) | 5 (opcional) | Nenhum “score de estilo”; nada bloqueia |

**Regra de dependência:** nenhuma dessas integrações pode ser pré-requisito da Fase 1. Se uma integração for necessária para “abrir o modelo”, o desenho está errado — o viewport precisa funcionar apenas com caminho de projeto + Asset Manager existente.

## 8. As oito garantias pedidas — mecanismo concreto

### 8.1 Carregamento sem duplicação de assets

| Mecanismo | Como |
|---|---|
| Sem cópia | O viewport lê o arquivo **no lugar** (`input/` ou `.lia-forge/runs/`), via token/protocolo |
| Sem upload implícito | Nenhum byte vai para fora da máquina |
| Cache por hash | Reabrir o mesmo `sha256` usa cache de bytes (≤ 64 MB), não recarrega do disco |
| Sem “importar para dentro do app” | Diferente do fluxo de `saveInput` (que copia para `input/`), o viewport não copia |

**Atenção:** o produto hoje **copia** arquivos escolhidos no seletor para `input/` (`studio-service.saveInput`). O viewport não deve repetir isso para arquivos já no projeto — apenas resolver o caminho existente.

### 8.2 Preservação dos arquivos originais

- Abertura **read-only**; nenhum `fs.writeFile` no arquivo de origem.
- Hash calculado no `open` e conferido antes de qualquer registro.
- Teste de aceite: comparar `sha256` do arquivo antes/depois de uma sessão completa, incluindo salvar overrides e capturar.

### 8.3 Alterações reversíveis

- Toda alteração vive em `View3DOverrides`, aplicada a **cópias** de material/objeto no grafo, nunca ao carregado original (para permitir “resetar”).
- “Resetar sessão” descarta overrides em memória e reaplica o estado do arquivo.
- Undo/redo é um requisito de UX se houver transformação; sem ele, o usuário não confia na reversibilidade.

### 8.4 Salvamento seguro

- Escrita **atômica** (arquivo temporário + `rename`) dentro de `.lia-forge/view3d/`, como já se faz no serviço.
- Recusa de symlink; confinamento ao projeto.
- Se o JSON for inválido, nada é gravado.
- Se o `sourceSha256` mudou desde a abertura, gravação é recusada com instrução.

### 8.5 Histórico de versões

- Overrides **não** criam versão de asset (são apresentação).
- Captura PNG pode ser registrada como artefato de uma versão, com `validator: 'png-structural'`.
- “Salvar versão” no viewport **não altera o GLB**; registra a escolha/artefato. Para nova versão do modelo, o fluxo é Blender/conversão + registro.

### 8.6 Validação antes da exportação

- Exportação continua no fluxo existente: `exportRun` + `checkDestinationCompatibility`.
- O viewport pode emitir observações que **informam** a decisão, mas não substitui `glb-structural`, `png-structural` nem teste no destino.
- Se o usuário quiser exportar um GLB derivado, o caminho é etapa explícita com `gltf-validator` (opcional) e diff de metadados.

### 8.7 Compatibilidade com formatos de destino

- O viewport não altera formato. Ele exibe o que o arquivo tem e aponta incompatibilidades declaradas (ex.: `glb` aceito, `fbx` não suportado pelo renderer web na Fase 1).
- Perfis de destino continuam em `shared/destinations/profiles.mjs`; `verified: false` permanece até teste real.

### 8.8 Visualização temporária × alteração persistente

| Ação | Onde vive | Persiste? | Cria versão? |
|---|---|---|---|
| Girar câmera | memória/sessão | só se “salvar sessão” | não |
| Ocultar nó | overrides em memória | só se salvar | não |
| Mover/rotacionar/escalar (se aprovado) | overrides | só se salvar | não |
| Trocar material (se aprovado) | overrides | só se salvar | não |
| Capturar PNG | artefato | sim, com ação | opcional |
| “Salvar versão” | Asset Manager | sim | sim |
| Editar geometria | **não existe** | — | — |

## 9. Modelo de ameaças (resumo)

| Ameaça | Vetor | Mitigação proposta |
|---|---|---|
| Path traversal | `path` no IPC | Resolver no main, allowlist, `lstat`, recusa symlink |
| Arquivo malicioso explorando parser | GLB/JSON grande/adulterado | Limite de tamanho, parser em renderer sandboxed, timeout, descarte; sem `eval` |
| Execução de código via glTF | Extensões/URI externas | v1 só `.glb`/`.gltf` autocontido (sem URIs externas); rejeitar `uri` remota |
| SSRF via `.gltf` | `uri: http(s)://...` | Recusar rede no loader (nenhum recurso remoto) |
| Vazamento de caminho absoluto | mensagens de erro | Sanitizar mensagens; nunca devolver caminho real |
| Exfiltração | captura/telemetria | Nada sai da máquina; nenhuma telemetria |
| Worker/wasm malicioso | decoder substituído | Decoders empacotados com versão e checksum, sem CDN |
| DoS de memória | cena gigante | Tetos, classes de tamanho, recusa nomeada, HUD |
| CSP ausente | qualquer XSS no renderer | CSP em report-only e depois enforce; ver §6.4 do doc 05 |

## 10. Contratos que **não** serão propostos agora

- `SceneStaging` (Scene Composer) — pergunta 20 continua aberta; não é viewport.
- `RenderRequest`/`RenderSetup` (render final) — pertence a `Lia3DSprite`, com comparação de renderer pendente.
- `HairAsset`, `ColliderAsset`, `SplatAsset` — dependem de decisões de escopo (perguntas 18, 43).
- Qualquer alteração em `Asset`/`Artifact`/`AssetVersion` — a spec de domínio está congelada até aprovação.

## 11. Critérios de aceite contratuais por fase

### Fase 1

1. Abrir um `.glb` e um `.gltf` autocontido de `input/` e de `.lia-forge/runs/` sem copiar, sem alterar e sem expor caminho absoluto.
2. Fechar a sessão e provar (teste) que nenhuma geometria/textura permanece: `renderer.info.memory` volta ao baseline ou é descartado com o contexto.
3. Recusar: tamanho acima do teto, formato não suportado, `.gltf` com recursos externos, caminho fora do projeto, symlink.
4. Nenhum canal IPC aceita ou devolve caminho absoluto; teste negativo para cada canal.
5. `View3DSessionReport` não contém `passed`/`approved`; nenhuma escrita em disco além do relatório efêmero.

### Fase 2

6. Salvar `View3DOverrides` e reabrir: aplicação só após confirmação; `sourceSha256` divergente ⇒ `stale` e recusa.
7. Captura PNG só por ação explícita; hash confere; original intocado; nenhuma versão criada automaticamente.
8. Overrides ≤ 256 KB, validados; escrita atômica; recusa de symlink e de caminho fora de `.lia-forge/view3d/`.

### Fase 5

9. “Salvar como versão” registra artefatos existentes via `addAssetVersion`, com `sourceSha256` conferido e validador aplicado.
10. Exportação derivada de GLB exige ação explícita, produz relatório de diferenças com hashes e bloqueia extensões desconhecidas.
11. Nenhum canal do viewport contorna `exportRun`/`checkDestinationCompatibility`; nenhum contrato não aprovado é obrigatório.
