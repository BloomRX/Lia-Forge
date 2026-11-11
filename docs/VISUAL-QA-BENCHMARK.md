# Visual QA, evidências e benchmark

> **Estado:** infraestrutura geral de Visual QA e Benchmark `PLANNED`. Checks estruturais pontuais já existem; nenhum score/benchmark foi medido nesta missão. Ver [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md).

## Objetivo e separação de evidências

Um asset é avaliado em camadas que não se substituem:

1. **Integridade de arquivo:** bytes, formato, paths, hashes, dimensões.
2. **Contrato estrutural:** canais, grade, metadados, geometria, UV/rig/ações, mídia/codec, semântica básica.
3. **QA automatizada visual/semântica:** métricas e heurísticas reproduzíveis; servem para detectar problemas, não para certificar adequação artística.
4. **Revisão visual humana:** inspeção do asset real na escala/contexto do jogo; decisão explícita de aprovar, rejeitar ou solicitar iteração.
5. **Benchmark comparativo:** comparação de workflows/providers sob condições e critérios declarados; não é indicador de qualidade universal.

`VERIFIED` declara apenas o escopo provado. “PNG válido”, “JSON passa schema”, “job terminou” e “imagem existe” não significam que o asset é bonito, coerente, transparente de fato, animável, game-ready ou licenciado.

## Gates por categoria

| Tipo | Estrutural e automatizável | Evidência/inspeção visual humana |
|---|---|---|
| **Sprites 2D / atlas** | Decode real; dimensões, pixel ratio, canais alpha e distribuição; padding/atlas bounds; retângulos/ordem/FPS/loop/pivô; duplicatas; file size. | Checkerboard e fundo branco/escuro; silhueta a escala nativa; seams; identidade entre frames; clipping; foot baseline/pivôs; ritmo/loop; paleta e legibilidade no cenário do jogo. |
| **Pixel art / tiles** | Grid exato, palette/color count, tile size, colisão/metadata, igualdade de bordas quando exigida. | Teste repetido 3×3, clusters/outline, contraste e animação em escala final. |
| **Imagem / UI / ícone** | Raster/vector parse, size, alpha, bleed, safe area, fonte/link externo, densidade/target. | Contraste/legibilidade, conteúdo, alinhamento, acessibilidade, integração com UI real. |
| **Modelo 3D / prop** | Import real no DCC, mesh count, bounds, transforms, normals, materials/textures, UV, poly/texture budgets, pivô, formatos e dependencies. | Silhueta em jogo, shading, materiais, colisão, escala, topology/artifacts, orientação em camera alvo. |
| **Rig / humanoide** | Armature/bones, hierarchy, weights, transforms, scale, names, animation Actions/Slots/clips, frame count, export/import round-trip. | Deformação em extremos, pose/foot sliding, clips/frame alignment, root motion, proportions, silhouette; revisar ações importadas no DCC e engine. |
| **Animação / vídeo** | Codec/container/frame count/FPS/duration, frame size/alpha, loop endpoints, timestamps, corruption. | Continuidade de movimento, foot contact, identity drift, jitter, cadence, camera/lighting consistency. |
| **Ambiente / parallax** | Canvas/layers/depth channel sizes, bounds, tile seam, ordered layers, depth numeric range. | Camadas sem halos, parallax sem rasgos/oclusões, composição, leitura de navegação, integração com camera/pan. |
| **Procedural / código** | Fonte e hash, dependency/command, sandbox, seed/parameters, output counts, reproducibility contract e runtime exit. | Inspecionar render em várias seeds/param bounds e verificar que a cena/game representa o pedido. |
| **Áudio/VFX/outros** | Validator específico do pacote (codec/peaks, shader/material/particles, formatos), versão e defaults. | Audição/preview no contexto real; não declarar qualidade só por análise automática. |

Para qualquer formato, validator informa o que examinou, qual versão usou e que aspectos não verificou.

## Revisão humana

Uma etapa de revisão guarda no mínimo:

- asset/version e hashes dos arquivos vistos;
- inputs/route/provider/tool/versões; destino/contexto de avaliação;
- reviewer/ator, data, checklist e ação `approve`, `reject` ou `iterate`;
- motivo e comentários; itens bloqueantes separados de preferências;
- contato/viewport/capture do arquivo real e tamanho/zoom utilizados, quando captura foi explicitamente permitida;
- quais validators passaram/falharam e quais dimensões continuam sem avaliação.

Um screenshot de demonstração, uma ilustração estática da UI ou um preview mock não é evidência do output. A Forge deve abrir/visualizar arquivo real ou registrar que a inspeção é externa.

## Benchmark e comparação

Cada comparação registra a configuração exata:

- task/brief/input artifacts e hashes; direitos de referência;
- workflow/versões/skills/prompts/parameters; provider/model/runtime e commit/release;
- sistema/OS e aceleração **reportados pela tool**, não inferidos; hardware/VRAM como `unknown` quando não reportado;
- custo real retornado/billing record, tempo real medido e limitações; não substituir por estimativa nem mostrar valor inventado;
- outputs, hashes, validadores, aprovação/rejeição humana e ambiente;
- número de amostras/seeds, condição de retry, ordem randomizada se aplicável e incerteza.

Só comparar workflows com inputs e critérios equivalentes; registrar mudanças inevitáveis. Separar métricas mecânicas (tempo, dimensões, triangulação) de julgamento humano (coerência, legibilidade, adequação ao estilo). Não pontuar por uma métrica única nem criar ranking sem número suficiente de casos/avaliadores. Outputs comerciais/privados só entram em dataset com autorização e rights review.

## Métricas: definição antes de coleta

Cada metric tem unidade, procedimento, ferramenta/versão, expected range/threshold e handling para `unknown/not applicable`. Exemplos futuros: exact-size compliance; alpha coverage; frame bounds overflow; atlas occupancy; loop discontinuity; contact displacement; mesh bounds/triangles; UV coverage; bone-weight anomalies; human pairwise preference. Nenhum valor-alvo ou resultado é afirmado aqui.

Não comparar “tempo médio” sem máquina, provider response, cache, quantidade de imagens/frames e versão. Não atribuir melhoria causal sem teste controlado. Não usar output sintético/fabricado como baseline.

## Implementação atual

`electron/png-validation.cjs`, `electron/spritesheet-manifest.cjs` e `electron/workflow-runner.cjs` executam parte dos checks de arquivo/PNG/manifesto/contrato e calculam hashes. `docs/usage-workflows.md` pede inspeção visual humana. Não há viewer 3D, contact-sheet QA universal, medição de qualidade de animação/mesh, review ledger geral ou benchmark comparativo implementado. A validação do PNG pode confirmar canal alpha declarativo sem provar que existem pixels realmente transparentes; o manifest não prova que o conteúdo visual corresponde ao pedido.

## Critérios de aceite futuros

- Fixtures negativas e positivas em cada tipo; mutation tests de metadata/alpha/paths e regression assets versionados/licenciados.
- Validadores nunca dão `pass` para artefato inexistente, truncado ou com hash divergente.
- Human review ligada ao hash/version e invalida aprovação depois de edição.
- Mesmo benchmark reproduzível a partir do manifest e aponta valores desconhecidos.
- Testes visuais automatizados complementam, não substituem, revisão humana.
- Antes de marcar um provider/route como `BETA`/`STABLE`, rodar E2E real dentro do escopo anunciado e incluir evidência/limitações.