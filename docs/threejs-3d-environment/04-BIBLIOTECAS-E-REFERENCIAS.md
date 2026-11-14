# 04 — Bibliotecas complementares e projetos de referência

> **Método:** versão e licença lidas no `registry.npmjs.org` e na API do GitHub em 2026-11-13; código dos decoders lido no pacote `three@0.187.0`. Nenhuma biblioteca foi instalada no repositório.
> **Regra de ouro:** `STUDY`/`INSPIRE` não autoriza copiar código. Biblioteca só entra no produto com versão fixa, licença verificada, aviso em `THIRD_PARTY_NOTICES.md` e um teste que prove o uso.

## 1. Bibliotecas complementares (candidatas)

| Biblioteca | Versão | Licença | Para quê | Veredito | Observações de integração |
|---|---|---|---|---|---|
| **three** | `0.187.0` | MIT | Render 3D, loaders, controles, animação | **ADOTAR (Fase 1)** | Zero dependências; carregar por `import()` dinâmico; fixar versão exata no `package.json` e no lockfile |
| **@react-three/fiber** | `9.8.2` | MIT | Integração declarativa React↔Three | **NÃO ADOTAR agora** | Peer exige `react >=19 <19.4`; o produto usa React `18.3.1`. Adotar exigiria atualizar React (mudança de produção fora do escopo) |
| **@react-three/drei** | `10.7.9` | MIT | Helpers React (câmeras, controles, telas) | **NÃO ADOTAR agora** | Peer exige `react ^19`; mesma incompatibilidade |
| **three-mesh-bvh** | `0.9.18` | MIT | Raycast acelerado, consultas espaciais | **OPCIONAL (Fase 2)** | Peer `three >= 0.159`; útil só se a seleção por triângulo ficar lenta |
| **@gltf-transform/core / cli** | `4.5.1` | MIT | Otimização/inspeção de glTF, dedupe, compressão, prune | **ADAPTER EXTERNO (Fase 5)** | Não empacotar no renderer; rodar como etapa explícita, com consentimento e hash |
| **gltf-validator** | `2.0.0-dev.3.10` | Apache-2.0 | Validação completa de conformidade glTF | **ADAPTER EXTERNO (recomendado)** | Pode ser usado em Node no processo principal ou como etapa de QA; não substitui revisão visual |
| **@google/model-viewer** | `4.4.0` | Apache-2.0 | Visualizador web pronto (custom element) | **RESEARCH ONLY** | Peer `three ^0.183`; é uma superfície e um runtime próprios, não a UX da Forge |
| **spectorjs** | `0.9.33` | MIT | Captura/depuração de frames WebGL | **DESENVOLVIMENTO (ferramenta interna)** | Não enviar ao usuário final por padrão; útil em diagnóstico |
| **lil-gui** | `0.21.0` (também bundled no three) | MIT | Painel de debug | **DESENVOLVIMENTO (dev only)** | Não usar como UI de produto |
| **three-stdlib** | `2.36.1` | MIT | Coleção de addons mantida pela comunidade | **NÃO NECESSÁRIO** | Duplica `three/addons`; só se houver um addon específico ausente |

### 1.1 Decoders de compressão

| Componente | Licença | Tamanho no pacote | Situação |
|---|---|---|---|
| **Draco** (`examples/jsm/libs/draco/`) | Apache-2.0 ([google/draco](https://github.com/google/draco)) | wasm 192 KB (glTF) / 286 KB | Suporte a `KHR_draco_mesh_compression`; carregar só quando o arquivo exigir |
| **Basis Universal / KTX2** (`examples/jsm/libs/basis/`) | Apache-2.0 ([BinomialLLC/basis_universal](https://github.com/BinomialLLC/basis_universal)); `KTX-Software` reporta `NOASSERTION` na API e precisa de leitura por componente | `basis_transcoder.wasm` 527 KB | Suporte a `KHR_texture_basisu`; requer CSP para wasm/worker |
| **Meshopt** (`meshopt_decoder.module.js`) | MIT ([zeux/meshoptimizer](https://github.com/zeux/meshoptimizer)) | pequeno (JS) | `EXT_meshopt_compression`; sem wasm |

**Risco de licença:** os três são redistribuídos dentro do pacote `three`. Ao empacotar o app, é preciso que `THIRD_PARTY_NOTICES.md` (gerado por `scripts/generate_third_party_notices.py`) inclua os textos correspondentes. Hoje o projeto não tem Three.js e, portanto, não tem esses notices.

## 2. Projetos de referência (estudo, não cópia)

| Projeto | Licença (verificada) | O que observar | O que **não** fazer | Veredito |
|---|---|---|---|---|
| [**three.js editor**](https://threejs.org/editor/) (dentro de [mrdoob/three.js](https://github.com/mrdoob/three.js), pasta `editor/`) | MIT (mesmo repositório) | Estrutura de hierarquia, inspector, gizmo, player, serialização de cena; referência de UX profissional | Copiar código/estilos; herdar o modelo de “projeto em localStorage” | **INSPIRE** |
| [**three-gltf-viewer**](https://github.com/donmccurdy/three-gltf-viewer) | MIT | Fluxo de abrir/arrastar GLB, painel de cena, variantes de material, debug de textura | Transformar em segunda UI; copiar sem revisão | **INSPIRE** |
| [**Babylon.js**](https://github.com/BabylonJS/Babylon.js) (+ Sandbox/Inspector) | Apache-2.0 | Como um inspetor 3D organiza hierarquia, materiais, animação e performance | Reimplementar o motor; copiar UI | **REFERÊNCIA CONCEITUAL** |
| [**@google/model-viewer**](https://github.com/google/model-viewer) | Apache-2.0 | Simplicidade de “só mostrar o modelo”, AR, enquadramento automático | Ser a experiência principal da Forge | **RESEARCH ONLY** |
| [**three-mesh-bvh**](https://github.com/gkjohnson/three-mesh-bvh) | MIT | Picking e consultas espaciais em malhas densas | Introduzir dependência antes de medir | **OPCIONAL** |
| [**three-gpu-pathtracer**](https://github.com/gkjohnson/three-gpu-pathtracer) | MIT | Render de alta qualidade no navegador | Prometer render final/“foto de produto” | **RESEARCH ONLY** |
| [**GaussianSplats3D**](https://github.com/mkkellogg/GaussianSplats3D) | MIT | Visualização de splats (capacidade futura `splat.ingest`) | Adotar agora; último push 2025-10 | **RESEARCH ONLY** |
| [**glTF-Transform**](https://github.com/donmccurdy/glTF-Transform) | MIT | Inspeção/otimização de glTF em Node; dedupe, prune, compressão | Reescrever GLB silenciosamente | **ADAPTER EXTERNO** |
| [**glTF-Validator**](https://github.com/KhronosGroup/glTF-Validator) | Apache-2.0 | Conformidade formal com a spec e extensões | Tratar “válido” como “bonito/correto para o jogo” | **ADAPTER EXTERNO** |
| **3D Sprite / SpriteForge Web** (projeto interno, snapshot em [`../MODULE-CONSOLIDATION-AUDIT-3D.md`](../MODULE-CONSOLIDATION-AUDIT-3D.md)) | **Sem licença raiz identificada**; Three.js r169 vendorizado | Organização de render por direção, framing, atlas, pivôs | Copiar código/assets antes de esclarecer direitos | **STUDY / DO NOT INTEGRATE** |
| **3D Create / Bloom Agent** (interno) | GPL-3.0-or-later no manifesto do add-on; sem licença raiz identificada | Tools Blender, rig canônico, export | Copiar para dentro do renderer | **BLENDER / STUDY** |
| **Blender** (`io_scene_gltf2`) | GPL (addon do Blender) | Semântica correta de import/export glTF, unidades, eixos, animação | Importar código GPL para o app | **REFERÊNCIA / NÃO INTEGRAR** |

### 2.1 O que o three.js editor ensina (e o que não se aplica)

**Aplicável:**
- Hierarquia com seleção sincronizada com o viewport.
- Inspector contextual à direita, não uma parede de campos.
- Gizmo acoplado a atalhos e a um botão “focar”.
- Separação entre “cena do arquivo” e “ajustes de inspeção” (no editor, isso vira cena salva; na Forge, vira **override de sessão**).
- Barra de status com contagens e alertas.

**Não aplicável:**
- Editor genérico de cena com criação de primitivas e scripts — a Forge não é um DCC.
- Persistência em `localStorage` — a Forge versiona por Asset/Artifact.
- Uso de `file://` e drag-drop direto do sistema sem validação — a Forge confina em `input/` e usa tokens.

## 3. O que **não** adotar (e por quê)

| Item | Motivo |
|---|---|
| React Three Fiber / drei nesta fase | Exigem React 19; atualizar React é mudança de produção não autorizada nesta missão |
| Babylon.js como segundo motor | Duplicaria runtime, licença e UI; a decisão arquitetural já é “um produto, uma view” |
| model-viewer como viewport oficial | Não expõe hierarquia, materiais, skeleton, animação ou overrides; seria uma ilha |
| Path tracing como “render final” | Custo e qualidade não determinísticos; não substitui Blender |
| Physically based engine de física (Rapier etc.) | Colisores são declaração do destino, não do viewport; sem caso de uso aprovado |
| Editor de malha/UV/rig dentro do app | Escopo de DCC; três.js não tem modelagem; alto custo e risco |
| `webSecurity: false`, `file://` e `nodeIntegration` no renderer | Violam o modelo de segurança atual |
| Vendorizar Three.js em `shared/` | Impede atualização e auditoria de licença; usar npm com versão fixa |

## 4. Política de licenças e notices (proposta)

1. **Versão exata** de toda dependência gráfica (`three` sem `^`).
2. **Nenhuma cópia de código** de repositórios com licença não identificada (3D Sprite, 3D Create, doll-studio, etc.).
3. **Notices**: rodar `python scripts/generate_third_party_notices.py` após adicionar `three`; revisar manualmente as entradas de Draco/Basis/Meshopt e incluir os textos de licença dos arquivos wasm/js redistribuídos.
4. **Wasm**: tratar cada binário como artefato de terceiro com origem, versão e checksum registrados; nada de CDN em runtime.
5. **Assets de exemplo**: nenhum GLB/HDRI/textura de terceiro entra no repositório sem licença explícita e registro de proveniência. Fixtures de teste devem ser **sintéticas** (geradas por script) ou de autoria própria — como já ocorre em `tests/glb-fixtures.mjs`.

## 5. Conclusão

- A única dependência realmente necessária para a Fase 1 é **`three` (MIT)**, com carregamento sob demanda.
- As bibliotecas complementares úteis (`three-mesh-bvh`, `gltf-validator`, `gltf-transform`) entram **como opção**, atrás de um caso de uso medido, não por antecipação.
- O ecossistema React do Three.js está fora de alcance enquanto o produto estiver em React 18; isso **não bloqueia** o viewport — apenas determina que a integração será imperativa (runtime Three.js com ponte para React).
- Projetos de referência servem para **UX e arquitetura**, não para cópia. O three.js editor é a melhor referência de interação; o glTF-Transform/Validator são as melhores referências de rigor de formato.
