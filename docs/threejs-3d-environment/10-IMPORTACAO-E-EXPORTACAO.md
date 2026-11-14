# 10 — Estratégia de importação e exportação

> **Princípio herdado:** GLB/glTF é o **container de intercâmbio** central, não um contrato semântico. Rig, hierarquia, pesos, UVs, materiais, FPS, root motion, eixos e unidades precisam ser verificados; a extensão `.glb` não prova nada disso ([`../LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md`](../LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md) §9.2).
> **Princípio desta frente:** o viewport **importa para inspecionar** e **exporta apenas derivados explícitos**. Ele nunca reescreve o original.

## 1. Matriz de importação

| Formato | Fase 1 | Como | Limite/observação |
|---|---|---|---|
| **`.glb`** (glTF binary 2.0) | **Sim** | `GLTFLoader.parse`/`load` | Recursos embutidos; formato central |
| **`.gltf` autocontido** (recursos em `data:`) | **Sim** | `GLTFLoader.parse` | Sem I/O externo; mesmo caminho do `.glb` |
| **`.gltf` + `.bin` + texturas externas** | Não (Fase 5) | Protocolo com allowlist de irmãos | Risco de path traversal; exige diretório autorizado e decisão 51 |
| **`.fbx`** | Não | Blender → GLB | Semântica de rig/animação varia; loader web não cobre tudo |
| **`.obj`** | Não | Blender → GLB | Sem rig/animação; MTL/texturas externas |
| **`.stl`** | Não | Blender → GLB | Só geometria |
| **`.ply`** | Não | Blender → GLB (ou splat, futuro) | Point cloud não é mesh |
| **`.blend`** | Não | Blender | Fonte editável; nunca prometer abertura no navegador |
| **`.vrm`** | Não | Blender/add-on → GLB | Extensões VRM específicas; licença própria |
| **`.spz`/`.splat`** | Não | futuro `splat.ingest` | Representação diferente; não é malha |

**Restrição existente que o plano não pode ignorar:** o caminho atual de upload (`studio-service.saveInput`) recusa arquivos acima de **32 MB**, e `readInput`/`/artifact` recusam acima de **6 MB**. O viewport da Fase 1 lê arquivos **já presentes** no projeto (por exemplo, colocados ali por um fluxo anterior ou pelo sistema de arquivos), mas **não** torna possível importar 80–256 MB pelo seletor atual. Aumentar o teto de importação é a decisão 57, com impacto em memória, disco e UX; não é consequência automática deste viewport.

**Regra de produto:** formatos não suportados produzem mensagem com **próximo passo real** (“converter no Blender”, “abrir no Blender”), nunca um canvas vazio.

## 2. Pipeline de importação (proposto)

```
1. Resolver referência
   assetId? path (input/ | .lia-forge/runs/)
   ↓
2. Validar no main
   extensão (.glb ou .gltf autocontido) · tamanho ≤ teto · lstat (não symlink) · dentro do projeto
   ↓
3. Hash SHA-256 (stream) + leitura do cabeçalho (inspectGlb)
   ↓
4. Abrir sessão + emitir token/protocolo
   ↓
5. Renderer: GLTFLoader (Draco/KTX2/Meshopt se necessário)
   ↓
6. Construir SceneIndex (nós, materiais, skins, clips, bounds, contagens)
   ↓
7. Comparar declarado (inspectGlb) × medido (cena)
   ↓
8. Diagnostics (observações) → UI
   ↓
9. Close: dispose de tudo
```

### 2.1 Validação declarado × medido

| Métrica | Declarado (JSON do GLB) | Medido (cena Three.js) | Divergência indica |
|---|---|---|---|
| Meshes | `meshes.length` | nós com `isMesh` | Nós vazios/instâncias |
| Triângulos | soma por accessor/índice | soma por geometria | Primitivas não renderizadas, morph, etc. |
| Materiais | `materials.length` | materiais únicos em uso | Materiais não usados |
| Texturas | `textures.length` | texturas carregadas | Falha de decoder/imagem faltando |
| Animações | `animations.length` | clips no grafo | Clipes sem alvo |
| Skins | `skins.length` | `SkinnedMesh` | Skin declarada sem uso |

Divergência **não** é erro automático; é observação com severidade.

## 3. Compressão e decoders

| Extensão | Suporte three r187 | Custo | Requisito |
|---|---|---|---|
| `KHR_draco_mesh_compression` | Sim (`DRACOLoader`) | wasm 192 KB + worker | CSP wasm/worker; caminho do decoder local |
| `EXT_meshopt_compression` | Sim (`MeshoptDecoder`) | JS pequeno | — |
| `KHR_texture_basisu` (KTX2) | Sim (`KTX2Loader`) | wasm 527 KB + worker | CSP; suporte de formato da GPU |
| `EXT_texture_webp` / `EXT_texture_avif` | Sim | decode do navegador | Compatibilidade do Chromium |
| `KHR_mesh_quantization` | Sim | — | Precisão reduzida |

**Decisão proposta:** em vez de empacotar decoders sempre, carregá-los **sob demanda** quando o arquivo declarar a extensão. Se o decoder falhar (CSP, arquivo ausente, GPU sem formato), a mensagem deve ser específica: “este modelo usa Draco e o decodificador não pôde ser carregado”.

**Nunca** buscar decoders em CDN. Eles vêm do pacote `three` empacotado, com versão fixa.

## 4. Exportação: princípios

1. **Original é intocável.** Nenhuma escrita no `.glb` de origem, jamais.
2. **Exportar é criar derivado.** Todo export gera novo artefato com hash, proveniência e versão.
3. **Exportar é ação explícita.** Não há “auto-save” de modelo.
4. **Round-trip não é lossless.** Precisa de relatório de diferenças.
5. **Compatibilidade de destino é evidência, não promessa.**

## 5. O que `GLTFExporter` faz e não faz (verificado no pacote r187)

### 5.1 Opções relevantes

`binary`, `trs`, `onlyVisible`, `maxTextureSize`, `animations`, `includeCustomExtensions`, `copyright`. Padrões: `binary: false`, `trs: false`, `onlyVisible: true`, `maxTextureSize: Infinity`, `animations: []`.

### 5.2 Extensões que o exporter cobre

`KHR_lights_punctual`, `KHR_materials_unlit`, `KHR_materials_*` (clearcoat, sheen, transmission, volume, ior, specular, iridescence, anisotropy, dispersion, emissive_strength, variants), `KHR_texture_transform`, `KHR_mesh_quantization`, `EXT_mesh_gpu_instancing`, `EXT_texture_webp`, `EXT_materials_bump`.

### 5.3 O que ele **não** faz

| Limitação | Consequência |
|---|---|
| **Não comprime** (sem Draco/Meshopt) | GLB exportado tende a ser maior que o original comprimido |
| **Não gera KTX2** | Texturas viram PNG/JPEG/WebP; perde compressão de GPU. Existe `KTX2Exporter` separado (r187), mas ele não está integrado ao `GLTFExporter` e trabalha a partir de `DataTexture`/libs de KTX — não é um “transcode automático” |
| **Não preserva extensões desconhecidas** (exceto `extensions` customizadas declaradas) | Exportar um arquivo com extensão de terceiro pode **perder** dados |
| **Reescreve estrutura** (nós, accessors, nomes, ordem) | Diff textual é inútil; comparar semanticamente |
| **Reencoda texturas via canvas** | Pode alterar cor/formato/tamanho |
| Animações precisam ser passadas explicitamente | Exportar sem `animations` perde clipes |
| `onlyVisible: true` por padrão | Objetos ocultos **desaparecem** se o usuário esqueceu |

**Conclusão:** `GLTFExporter` serve para gerar uma **cópia derivada** simples (ex.: recorte de cena, remoção de objeto de inspeção), nunca como “salvar” do arquivo.

## 6. Estratégia recomendada de exportação

| Caso | Caminho | Ferramenta | Validação |
|---|---|---|---|
| Salvar configuração de inspeção | JSON `View3DOverrides` | Lia (proposto) | Schema próprio |
| Registrar prévia | PNG | `renderer.domElement.toBlob` + captura | `png-structural`, `png-content` |
| Gerar GLB derivado a partir de cena inspecionada (Fase 5) | Etapa explícita “Exportar cópia” | `GLTFExporter` | `glb-structural` + `gltf-validator` (opcional) + diff semântico |
| Otimizar/comprimir modelo | Etapa de produção | `gltf-transform` (adapter externo) | Antes/depois com hash e relatório |
| Render 3D → spritesheet | Fluxo existente | Blender adapter | Manifesto + PNG |
| Exportar para destino | Fluxo existente | `exportRun` + perfil | `destination-profile` |

**Nunca** encadear “exportar do viewport” com “sobrescrever o arquivo que está sendo inspecionado”.

## 7. Relatório de diferenças (proposto)

Toda exportação derivada deve produzir um relatório legível:

```json
{
  "recordType": "gltfDiff",
  "schemaVersion": 1,
  "source": { "path": "input/mira.glb", "sha256": "9f2c...", "bytes": 18432000 },
  "output": { "path": ".lia-forge/runs/<id>/export/mira-derived.glb", "sha256": "a1b2...", "bytes": 20111360 },
  "changes": [
    { "kind": "removed_node", "subject": "Hair_Cards", "reason": "oculto na sessão (onlyVisible)" },
    { "kind": "reencoded_texture", "subject": "image:2", "from": "image/png", "to": "image/webp" },
    { "kind": "dropped_extension", "subject": "EXT_example", "severity": "high" }
  ],
  "limitations": ["exportação não é round-trip lossless"]
}
```

Sem esse relatório, o usuário não tem como saber o que perdeu.

## 8. Validação na importação e na exportação

| Momento | O que roda | O que **não** prova |
|---|---|---|
| Importar | `inspectGlb` (cabeçalho/JSON), opcional `gltf-validator` | Que o modelo renderiza igual ao Blender |
| Renderizar | Cena carregada + diagnóstico | Qualidade artística |
| Exportar derivado | `glb-structural`, opcional `gltf-validator`, diff | Aceite no destino |
| Empacotar para destino | `exportRun` + `checkDestinationCompatibility` | Import real na engine (não executado hoje) |
| Revisão | Humano | — |

**Regra:** “glTF válido” ≠ “visualmente correto” ≠ “adequado ao jogo”. São três evidências distintas, como já registrado em [`../DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md`](../DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md) §9.3.

## 9. Proveniência e versionamento

Toda importação/exportação deve registrar:

- `sourceSha256`, `bytes`, `path` relativo, formato;
- ferramenta/versão (`three@0.187.0`, `gltf-transform@x`, `Blender x.y`) e backend (`webgl2`/`webgpu`, `blender`);
- parâmetros que afetam o resultado (tone mapping, ambiente, escala);
- artefatos de saída com hash;
- `unknown` onde não foi medido.

Isso não cria contrato novo: usa `Provenance`/`Artifact`/`AssetVersion` existentes. Para o viewport, a proveniência **da captura** precisa dizer “prévia de inspeção, não render final” e o backend gráfico.

## 10. Limites de formato que precisam ser comunicados ao usuário

| Expectativa | Realidade |
|---|---|
| “O GLB tem tudo” | Pode não ter rig, UV, normais, materiais, unidades ou animação |
| “Importar no Blender e exportar resolve” | Pode mudar eixos, nomes, materiais e ordem |
| “KTX2 deixa tudo leve” | Exige transcoder e suporte de GPU; nem todo destino aceita |
| “Draco é sempre bom” | Custa CPU para decodificar; nem todo pipeline aceita |
| “glTF é um padrão, logo é igual em todo lugar” | Extensões e convenções variam; validar por destino |
| “Exportar do viewer é salvar” | Não é; é criar cópia com perdas possíveis |

## 11. Critérios de aceite de importação/exportação

**Fase 1**

1. Importar GLB simples, com skin/animação e com Draco/KTX2 (quando autorizado) sem travar a UI.
2. Importar `.gltf` autocontido; recusar `.gltf` com recursos externos, `.fbx`, `.blend` com mensagem e próximo passo.
3. Nenhuma importação copia, move ou altera o arquivo; hash antes/depois confere.

**Fase 5**

4. Exportar derivado **somente** por ação explícita, com relatório de diferenças e hashes.
5. Nenhuma exportação altera o original; teste de hash antes/depois.
6. Exportação com extensão desconhecida é **bloqueada** por padrão (perda silenciosa não é aceitável).
7. `onlyVisible` nunca é usado sem aviso; objetos ocultos aparecem no relatório.
8. Toda captura/exportação é marcada como “prévia/derivado”, nunca como “render final”.
9. `.gltf` externo (se aceito) recusa traversal, symlink e recurso fora da allowlist.
