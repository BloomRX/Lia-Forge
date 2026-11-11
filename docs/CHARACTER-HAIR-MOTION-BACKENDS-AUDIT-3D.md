# Auditoria complementar — personagens, cabelo, movimento e backends

- **Snapshot da auditoria:** 2026-10-25 (UTC; data confiável do ambiente)
- **Checkout Lia Forge:** `/home/user/3DSpritesheet`
- **Branch local:** `arena/649f88bd-3dspritesheet` — permanece ativa
- **Baseline:** [`docs/MODULE-CONSOLIDATION-AUDIT-3D.md`](MODULE-CONSOLIDATION-AUDIT-3D.md)
- **Escopo:** auditoria estática e planejamento. Nenhuma integração/migração, instalação, execução de código do projeto, teste, notebook, pipeline, serviço ou runtime, download de modelo/asset/arquivo de demonstração, upload, aceitação de licença ou operação Git mutável foi feita. Houve apenas consultas de leitura a páginas/API, inspeção estática de arquivos e parsing local do JSON do notebook para leitura de células.

> Este documento complementa o relatório anterior; não o substitui. A leitura de código, manifestos e documentação prova apenas que esses elementos aparecem no snapshot examinado — não prova que funcionem no Blender, Colab, Windows ou em uma GPU específica. As afirmações de vídeos e Patreon são atribuídas aos autores e não são reproduções independentes. Este não é um parecer jurídico.

## 1. Conclusão executiva

1. **A ponta remota examinada do 3D Create avançou um commit** desde o snapshot do relatório anterior: de `027e9dfc…` para `9e4bc91f…`. O commit chama-se v0.4.4 e adiciona um notebook HairDeck para Colab, um handler de coleta/importação e um ZIP do add-on Motion2MixamoRig. Isso é **implementação parcial**, não comprovação de uma integração ponta a ponta.
2. **Há uma provável incompatibilidade de diretório entre as células 5 e 6 do notebook HairDeck.** A célula 5 já põe o nome da imagem em `res`, enquanto o upstream cria `OUT_DIR/<nome_da_imagem>`; a célula 6 passa `res` ao exportador VRM, que espera `info.json` e os arquivos de seed diretamente nesse diretório. Pela leitura estática, executar as células em sequência provavelmente falha antes da célula 7. Não foi executado para confirmar. Como a célula 6 é marcada opcional, seria possível ignorá-la e coletar GLBs, mas assim não se obteria a VRM.
3. **A afirmação “spring bones do HairDeck chegam com o GLB e passam a animar na Lia” não é sustentada pelo fluxo de código lido.** O HairDeck separa o GLB de cabelo do export VRM com física. O handler do 3D Create coleta/importa o primeiro `.glb`, ignora o `.vrm`, não mapeia cadeias para o rig existente nem cria pesos. Ele apenas parenta raízes ao objeto Armature. O GLB padrão também inclui um proxy de cabeça, e a coleta não apresenta uma escolha visual de variação.
4. **A ocorrência de polígonos ocultos e UVs sobrepostos é uma observação atribuída ao autor da demonstração, não uma reprodução nossa nem um defeito universal demonstrado.** A postagem pública do teste descreve polígonos ocultos e cartas empilhadas no mesmo espaço UV; a documentação do próprio HairDeck confirma que cada carta recebe coordenadas UV normalizadas localmente e que o GLB junta essas cartas sem atlas global. O pacote com os arquivos de teste não foi baixado. Não foi possível determinar, sem a malha original, se os polígonos relatados eram caps intencionais, superfícies internas, interseções entre cartas ou uma combinação.
4. **Motion2MixamoRig é código Apache-2.0, mas a rota de inferência atual herda licenças não comerciais/restritas.** O NOTICE do projeto classifica GVHMR como não comercial e o modelo SMPL-X como não comercial; a licença oficial SMPL-X proíbe uso em produto/serviço comercial sem outra autorização. O NOTICE também lista YOLOv8 sob AGPL-3.0 e pesos adicionais com termos próprios. Logo, o ZIP Apache não libera automaticamente o pipeline, os pesos ou seus outputs para uso comercial.
5. **O ZIP Motion2MixamoRig está empacotado, não ligado ao agente do 3D Create; o build oficial da v0.1.8 é macOS ARM64.** O snapshot não mostra uma tool, prompt ou handler que execute a captura/retarget. A documentação do plugin diz que o usuário o habilita na milestone correspondente. O README da extensão descreve CPU-only no Windows, mas declara teste apenas em macOS Apple Silicon; a release diz que o build Windows está “coming soon”. O ZIP incluído pelo 3D Create não prova suporte Windows. O runtime instala-se fora do Python do Blender e baixa dependências/pesos grandes.
6. **Charakuru oferece um fluxo documentado mais amplo de ilustração → referências → candidatos Tripo → rig/pesos/springs → revisão VRM, mas é source-available com termos próprios e dependência de Codex/Tripo.** O repositório Git contém documentação; o kit com código/Skills/assets é distribuído em ZIP separado, que não foi baixado. Respeitando a restrição do usuário, não se copia, migra ou incorpora código, Skills ou assets. Só podem ser discutidos princípios gerais para uma implementação independente.
7. **Para Windows + AMD RX 580 8 GB, não há suporte oficial/documentado encontrado para HairDeck via AMD/Vulkan/ROCm.** O guia Windows do snapshot HairDeck pede GPU NVIDIA Ampere ou mais recente, CUDA 12.8; o caminho que o 3D Create documenta é Colab T4. O README da extensão Motion2MixamoRig descreve CPU-only no Windows, mas a release v0.1.8 fornece apenas build macOS ARM64, diz que Windows está “coming soon” e registra teste apenas em macOS Apple Silicon. CPU é alternativa documental a homologar, não validação/build oficial Windows no hardware do usuário.
8. **Nenhum teste E2E foi validado nesta auditoria.** Não houve execução de notebook, Blender, Motion2MixamoRig, HairDeck, Charakuru, import/export GLB/VRM ou Windows/AMD. A contagem “133 testes” aparece na mensagem de commit; o teste novo `test_agent_v044.py` verifica conteúdo textual/estrutura do notebook e o manifest do ZIP, não geração, spring bones ou resultado visual.

**Direção recomendada:** seguir com a arquitetura aprovada para planejamento: Lia3DCreate prepara personagem/cabelo/roupa/material/rig/validação; Lia3DSprite cuida de câmeras/animação/render/spritesheets. Forge permanece a interface principal independente. HairDeck, captura de movimento, retargeting e outros geradores são providers/capacidades opcionais e substituíveis; nenhum deles, Colab, API ou agente externo deve ser obrigatório. Não iniciar integração/migração sem aprovação expressa.

## 2. Método, estados e discrepância temporal

### Estados usados

- **IMPLEMENTADO:** código, notebook ou pacote aparece no snapshot lido. Não implica funcionamento.
- **VALIDADO:** execução real reproduzível, no ambiente e com artefato definidos. **Nenhuma integração E2E deste escopo recebeu este estado.**
- **PARCIAL:** há componentes concretos, mas falta parte essencial do fluxo, contrato ou validação.
- **DOCUMENTADO:** README, tutorial, manifesto ou post descreve uma capacidade; não é validação independente.
- **PLANEJADO:** aparece em roadmap/ideia, sem implementação demonstrada.
- **EXPERIMENTAL:** o próprio projeto ou as evidências disponíveis o descrevem assim.
- **BLOQUEADO:** há impedimento legal/técnico que impede recomendar aquela rota para o uso indicado até resolução.
- **NÃO VERIFICADO:** não houve prova de execução, qualidade ou compatibilidade no ambiente relevante.

### Cronologia dos snapshots consultados

| Fonte | Identificador examinado | Data retornada pela fonte | Interpretação neste relatório |
|---|---|---:|---|
| 3D Create, branch `arena/01a0d27a-3d-create` | `9e4bc91f7115abb5137682e5814c170dd2f670ba` | 2026-11-08 | API retornou um commit posterior à data da auditoria. É um snapshot de código que foi lido, mas o timestamp futuro não é tratado como evidência cronológica válida. A comparação com `027e9dfc…` deu 1 commit à frente, 0 atrás. |
| HairDeck, `main` | `cb20f7073419a33c9ab88f22f686fcb9060a99f0` | 2026-11-05; API também informa criação em 2026-10-29 | Ambos são futuros em relação a 2026-10-25. O conteúdo é analisado como snapshot fornecido pela API, mas disponibilidade/cronologia deve ser confirmada antes de uma decisão de release. |
| Vídeo HairDeck `c2ZsNhlYftM` e post HairDeck no Patreon | página indica publicação em 2026-11-08 / post “4 days ago” | posterior a 2026-10-25 | Conteúdo acessível no snapshot web, mas futuro em relação à data confiável desta auditoria; evidência retrospectiva provisória, não validação disponível em 25/out. |
| Charakuru v1.1.0 | `8eb22f6c6700dcc310896336596682594928024c` | 2026-10-23 | Versão compatível com a data de corte usada para comparação. A API listou uma release v1.1.1 em novembro, mas seu conteúdo/código não foi inspecionado e ela não é usada como baseline nesta auditoria. |
| Motion2MixamoRig v0.1.8 | tag → `f05a718188026b06e7ee64b47bab077970444b19` | 2026-10-24 | Release anterior a 2026-10-25; projeto se declara experimental e registra teste apenas em macOS Apple Silicon. |
| GVHMR / SMPL-X | `zju3dv/GVHMR` `ee960bb6…`; `vchoutas/smplx` `1265df7b…` | 2026-09-15 / 2023-10-12 | Revisão de licenças e dependências upstream; nenhum código/modelo foi baixado para o workspace. |

A mensagem do commit 3D Create anuncia “v0.4.4”, integração HairDeck, Motion2MixamoRig empacotado e “133 testes”. O commit não é tag de release nem prova de execução. A árvore/diff confirma os arquivos adicionados/modificados; os testes não foram rodados. A branch remota examinada mudou desde o relatório anterior; a tabela de HEADs daquele documento continua útil como histórico, não como ponta atual do 3D Create.

**Estado local preservado:** antes da criação deste relatório, o checkout permanecia na branch `arena/649f88bd-3dspritesheet`, `HEAD` `13dc4c7d2fde28f9324fd929482948ba34a87abf`, com `README.md` já modificado e 111 caminhos não rastreados. Nenhum deles foi limpo, substituído ou movido. Este relatório é um novo arquivo.

### Fontes audiovisuais acessíveis e limites

- O vídeo [“New Local AI Turns Any Video Into Mixamo Animation”](https://www.youtube.com/watch?v=58UpDAnbdkM) está listado como publicado em 2026-10-24. A página/transcrição descreve Motion2MixamoRig e Charakuru; o autor diz que o retarget bruto teve problemas em pernas/root sliding e recomenda uma etapa de limpeza no Blender/agente. A página foi lida como texto; o vídeo não foi reproduzido visualmente e a sequência não foi repetida.
- A página [“Free & Local Hair Card AI Generator is Here - HairDeck”](https://www.youtube.com/watch?v=c2ZsNhlYftM) diz que o teste removeu “almost 12k hidden polygons”, reempacotou UVs e produziu VRM. A página informa 2026-11-08, futuro em relação ao corte desta auditoria. A postagem pública associada no [Patreon](https://www.patreon.com/Stefan3DAI/posts/free-local-hair-174347750) reporta quatro seeds, “polygons hidden inside every strand”, cartas empilhadas no mesmo espaço UV, um Blend final com 101 cartas/springs/colliders e melhor resultado em cabelo longo/estratificado do que em tranças/cabelo curto. **Isso é o relato do autor do teste, não reprodução nem prova de defeito de todos os seeds.**
- O [post Patreon Charakuru + Motion2MixamoRig](https://www.patreon.com/Stefan3DAI/posts/charakuru-rigged-172975147), datado de 21/out no snapshot, informa dois vídeos de 10 segundos, duas animações brutas e duas limpas e a restrição não comercial GVHMR/SMPL-X. É um caso demonstrativo, não benchmark.
- Os ZIPs e projetos compartilhados por Drive/Patreon não foram baixados. Não houve inspeção das malhas, licença de redistribuição desses arquivos ou comparação visual direta.

## 3. Inventário de capacidades e estado

| Capacidade/rota | Estado | Observação e lacuna principal |
|---|---|---|
| HairDeck upstream — imagem → hair cards/cores/cadeias | **DOCUMENTADO / IMPLEMENTADO no snapshot upstream / NÃO VERIFICADO aqui** | Há código, documentação, outputs descritos e testes upstream. Nenhum modelo foi executado; a página consultada tem data futura. |
| HairDeck no 3D Create — job Colab + retorno GLB | **IMPLEMENTADO / PARCIAL** | Notebook, handler `kind="hairdeck"` e import de GLB aparecem em `9e4bc91f…`. A tool do agente é genérica e não apresenta HairDeck entre os exemplos; seleção da variação, VRM e física do cabelo não são transferidos ao rig da cena. Há provável erro de diretório no export VRM do notebook, não testado. |
| HairDeck spring bones na cena existente | **BLOQUEADO para a rota atual / NÃO VERIFICADO** | A célula VRM tenta exportar `.vrm`, mas há provável erro de diretório antes desse output; mesmo se corrigido, `colab_collect` ignora `.vrm` e o handler não converte cadeias nem atribui pesos ao rig. Parentar o objeto ao Armature não equivale a parentar ao osso da cabeça ou a skinning. |
| Geometria HairDeck: polígonos ocultos/interseções | **NÃO VERIFICADO; diagnóstico PLANEJADO** | Há relato de um caso, mas não arquivo de saída, seed/hash, screenshot comparável ou reprodução local. O código upstream limpa degenerados, não valida colisão global nem classifica faces intencionais. |
| Charakuru 1.1.0 — pipeline de personagem/VRM | **DOCUMENTADO; código/Skills/assets do ZIP não inspecionados** | README/tutorial descrevem o fluxo; o repositório consultado contém documentação e licença. A distribuição completa está em ZIP separado, que não foi baixado. Sem integração permitida por padrão. |
| Motion2MixamoRig v0.1.8 — CLI/extensão Blender | **IMPLEMENTADO upstream / EXPERIMENTAL / NÃO VERIFICADO no Windows do usuário** | Código Apache, inferência local, entradas de vídeo e pose em imagem. O upstream afirma teste em macOS Apple Silicon; Windows tem rota CPU documentada, não validada por nós. |
| Motion2MixamoRig no 3D Create | **IMPLEMENTADO como ZIP empacotado; PARCIAL como fluxo de produto** | ZIP de 95.192 bytes e registro de proveniência na tabela de plugins; nenhuma tool/handler/prompt que o invoque foi encontrada. O usuário o habilita/usa manualmente. |
| Captura/retarget comercial por GVHMR + SMPL-X | **BLOQUEADO até licença alternativa/autorização** | O código do wrapper é Apache-2.0; modelos upstream e dependências têm restrições próprias não comerciais/research. |
| Hair/pose em RX 580 8 GB AMD, Windows, Vulkan/ROCm | **NÃO VERIFICADO** | Nenhuma das fontes consultadas documenta uma rota HairDeck/Motion2MixamoRig suportada por RX 580. Documentação antiga do 3D Create menciona RX 580/ZLUDA como plano/afirmação, mas não comprova esse pipeline. |
| Validador/pós-processador não destrutivo HairDeck | **PLANEJADO** | A proposta está na seção 5; não foi implementada nem testada. |
| Validação E2E HairDeck/3D Create/Motion/Charakuru | **NÃO VERIFICADO (nenhum E2E validado)** | Nenhum serviço, teste, Blender, notebook ou pipeline foi executado. |

## 4. HairDeck: fluxo, integração, geometria e hardware

### 4.1 O que o upstream descreve

HairDeck gera a partir de uma imagem estilizada um conjunto de hair cards, cores ao longo das cartas e cadeias de mola. A documentação lista pré-processamento com SAM 3/BiRefNet, DINOv3, modelos HairDeck de imagem/cartas/cor/cadeias e outputs por seed. O código upstream e checkpoints próprios são indicados como Apache-2.0; SAM 3, DINOv3, BiRefNet, dados e demais componentes mantêm termos/licenças próprios.

Os arquivos descritos pelo README incluem `cards_seedN.json`, `chains_seedN.json`, `hair_seedN.glb`, `hair_seedN_nohead.glb` e, depois do export, `avatar_seedN.vrm`. No `hair_seedN.glb`, as cartas, proxy de cabeça, UVs e cores não significam automaticamente textura de imagem, rig skinned ou mola funcional. A documentação de export descreve VRM 0.x produzido separadamente com Blender 4.2 + VRM Add-on, cabelo preparado/skinned e grupos `secondaryAnimation` de spring bones.

Detalhe importante do código consultado:

- [`hairdeck/cards/mesh.py`](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/hairdeck/cards/mesh.py) constrói cada carta com secções trianguladas, superfícies laterais e faces de fechamento nas extremidades. Seu `card_uv()` normaliza `u` entre 0–1 e `v` ao longo de cada carta.
- [`hairdeck/infer/glb.py`](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/hairdeck/infer/glb.py) concatena as cartas e seus UVs/cores no mesh GLB sem atlas global; remove faces degeneradas por limiar de área, mas não faz teste de interseção entre cartas. O GLB de cabelo tem material PBR e atributo `COLOR_0`; `*_chains.glb` desenha as cadeias como tubos/esferas laranja em outra malha — visualização de cadeia, não bone/skin.
- [`hairdeck/vrm/export.py`](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/hairdeck/vrm/export.py) descreve um export VRM 0.x separado: preparação de cartas/UV/skin, Blender 4.2 com VRM Add-on para criar bones e grupos spring, e validação/preview.
- [`hairdeck/vrm/check.py`](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/hairdeck/vrm/check.py) verifica layout glTF, índices, pesos, humanoid, spring groups, colliders e consistência do export. Não promete teste de faces ocultas, colisão de cartas ou pack de UV entre cartas.

A normalização independente de UV por carta explica por que um artista pode precisar de atlas/repack para pintar texturas únicas por peça; por si só, UVs sobrepostos não provam defeito no material por vértice que o GLB gera. O relato “quase 12 mil polígonos ocultos” não permite atribuir causa precisa: para isso seria necessário inspecionar o mesmo output/seed, os dados de faces e a versão dos pesos.

### 4.2 O que o commit novo do 3D Create realmente conecta

A comparação remota do SHA anterior `027e9dfc…` com `9e4bc91f…` lista, entre outros, estes arquivos novos/alterados: `agent/bloom_agent/tools/handlers.py`, `colab/hairdeck_bloom.ipynb`, `plugins/Motion2MixamoRig-v0.1.8.zip`, `plugins/README.md` e `tests/test_agent_v044.py`. O manifesto do add-on declara versão `0.4.4`, Blender mínimo 4.2.0 e permissões de rede/arquivos.

O fluxo estático do notebook/handler é:

1. `colab_job(kind="hairdeck")` cria job local e inclui a referência da sessão em `jobs/<id>/input` quando existe.
2. O notebook pede `job_id`/`base_url`, verifica a ponte, clona `https://github.com/hyz317/HairDeck.git` com `--depth 1` **sem fixar commit**, instala dependências, FFmpeg e pesos e pede token Hugging Face. O usuário tem de aceitar os termos SAM 3/DINOv3.
3. A célula 4 usa `files.upload()` para o usuário escolher a imagem novamente; ela não baixa automaticamente o arquivo `jobs/<id>/input` que a tool já guardou. Na célula 5, `res` recebe `/content/hairdeck_out/<nome_da_imagem>` e o comando passa esse valor a `image_to_hair.py --out`. O upstream define o destino de cada imagem como `OUT_DIR/<nome_da_imagem>`, portanto os arquivos individuais ficam em `res/<nome_da_imagem>/`; `summary.json` fica em `res/`.
4. A célula 6, marcada opcional, chama `hairdeck.vrm.export res <VARIACAO>`. O exporter abre `res/info.json` e espera `cards_seedN.json`/`chains_seedN.json` em `res/`, mas o script de geração descrito acima grava `info.json` e os arquivos de seed no diretório aninhado `res/<nome_da_imagem>/`. Pela inspeção estática, executar a célula 6 sem ajustar o caminho deve falhar (provável `FileNotFoundError` em `info.json`); não executamos para confirmar. Mesmo corrigido, o exporter usa o body padrão HairDeck porque o notebook não passa `--body`; não corresponde automaticamente ao personagem/rig atual do 3D Create. A célula 7 envia pela ponte os `.glb`/`.vrm` que encontrar sob `/content/hairdeck_out`.
5. A célula 7 percorre a pasta global `/content/hairdeck_out`, não apenas a subpasta do job atual; em runtime reaproveitado isso pode incluir artefatos de execuções anteriores. O dicionário de resultados usa apenas o basename, podendo sobrescrever nomes iguais. A ponte usa endpoints HTTP expostos via ngrok; o 3D Create ordena resultados e `colab_collect` trata `.glb` como HairDeck. O handler importa o primeiro GLB disponível, mesmo que `complete` ainda não exista.
6. `_importar_cabelo_hairdeck()` chama o importer genérico, calcula uma escala e posição aproximadas (linha de cabeça `0.78 × altura`, cabelo `0.30 × altura`), marca `bloom_piece="cabelo"` e parenta objetos-raiz ao objeto do rig.

**Lacunas específicas observáveis:**

- Se a célula opcional de export VRM chegar a produzir um arquivo, `colab_collect()` só passa `.glb` ao importador; não há leitura do `.vrm`/VRM 0.x nem conversão de `secondaryAnimation` para o rig da cena. A incompatibilidade de diretório descrita acima deve ser corrigida antes de contar com esse arquivo.
- O GLB escolhido normalmente é `hair_seed0.glb`, que o upstream descreve com **head proxy**. O handler não separa/oculta esse mesh. A alternativa `_nohead.glb` existe, mas não há seleção por tipo/seed no handler.
- A saída padrão traz os resultados de 4 seeds, mas a cena não pede escolha visual: importa o primeiro GLB da lista. `VARIACAO` só decide o VRM produzido na célula 6; alterar esse número não muda a seleção feita pelo `colab_collect`.
- O GLB de cabelo padrão não traz bones/skinning; o GLB `*_chains.glb` contém representação visual de tubos/esferas. O parent do objeto-raiz ao Armature não cria vertex groups, peso de cabeça, `parent_type="BONE"` ou spring physics.
- O handler não relata uma comparação de UV/cores/material antes/depois, não inspeciona a presença dos atributos esperados e não valida export/round-trip. Aplicar depois um shader toon pode também mudar a aparência do material original; esse efeito não foi testado.
- Tool registry descreve `colab_job` genericamente como geração 3D de último recurso, com exemplos `echo`/`gen3d`; `agent_core.py` também só dá instrução genérica de Colab. O handler conhece `kind="hairdeck"`, mas o caminho não é totalmente descrito para descoberta pelo agente.

A integração é, portanto, **job + retorno/import inicial de geometria**, não “cabelo com spring bones já integrado e validado na personagem”. O usuário ainda teria de escolher/inspecionar a variante, decidir o tratamento do head proxy, resolver pesos/rig/física e confirmar materiais/texturas/UVs.

### 4.3 Geometria, faces internas e correção conservadora

**Evidência disponível:**

- O relato do autor de HairDeck no Patreon diz que, no seu teste, havia polígonos ocultos dentro das mechas e cartas empilhadas na mesma UV; descreve seleção entre quatro seeds, repack e textura manual. A página do YouTube diz que removeu “almost 12k hidden polygons”. O pacote de arquivos anunciado (relatório, Blender, viewer, UVs/cores e resultados) não foi baixado, e as páginas carregam datas de novembro posteriores ao corte.
- O upstream trata faces degeneradas/cleanup local por carta, mas o código de geração não mostra uma etapa que remova faces internas entre cartas ou avalie self-intersection do conjunto. Não há validator de UV atlas global nesse caminho.
- A lista de issues consultada contém uma pergunta sobre conversão de hair cards para Groom do Unreal e uma issue sobre ComfyUI/MPS; **não apareceu** uma issue de faces internas nessa amostra. Isso não prova que não existam comentários, PRs, reports ou correções em outra branch.
- O 3D Create atual calcula caixa, posição/escala e import; não há limpeza geométrica, relatório de face-overlap ou comparação antes/depois no handler.

**Não afirmar:** que este relatório reproduziu os 12 mil polígonos, que todos os resultados têm o problema ou que apagar faces “escondidas” é seguro. Faces de espessura/cap, cartões intencionalmente sobrepostos, seams, UVs, cores e materiais podem ser necessários.

**Validador/pós-processador proposto, não implementado:**

1. Manter o GLB de entrada imutável e trabalhar numa cópia; registrar hash da entrada, seed escolhido, commit do gerador, hashes/IDs de pesos, parâmetros, versão Blender/importer e transforms.
2. Criar relatório anterior à correção com número de vértices/faces, componentes, faces de área zero/quase zero, duplicatas exatamente coincidentes, normals, UV bounds/overlaps, material indices, vertex colors e informação de rig/skin/VRM quando houver.
3. Medir interseção triângulo-triângulo de forma diagnóstica e marcar faces suspeitas por componente/carta. Só aplicar teste “inside/outside” em componentes que sejam fechados e semanticamente adequados; hair cards abertos/finos não são um sólido confiável.
4. Não fazer merge-by-distance global, decimate, dissolve, flip normal ou “delete interior faces” por regra cega. Uma eventual correção automática fica restrita a degenerados/exatas duplicatas com prova geométrica e igualdade de material/UV/pesos, criando uma nova cópia e preservando a fonte.
5. Dar ao usuário uma camada de revisão (wireframe/IDs destacadas, toggles por grupo/carta, UV view e preview antes/depois) e permitir “não corrigir”. Para faces suspeitas mas ambíguas, relatório + revisão manual, sem alteração.
6. Testar fixtures sintéticas autorizadas: cartas isoladas, cards cruzadas/overlap intencional, caps, vértices duplicados, degenerados, seam UV, materiais diferentes, cores, hair proxy, armature/weights e spring extension. Medir tanto falso positivo quanto falso negativo.
7. Para qualquer caso real, testar várias imagens/seeds e comparar câmeras frontal/lateral/traseira/close-up e wireframe; conferir aparência, UV/atlas, cores/materiais, deformação do rig e round-trip GLB/VRM. Registrar a versão do gerador e só então decidir thresholds.

### 4.4 Dependências, backends, dados e custos HairDeck

| Rota | O que a documentação indica | Limite para este hardware/produto | Dados/custos e estado |
|---|---|---|---|
| **Windows local upstream** | O guia Windows no snapshot HairDeck `cb20f707…` (posterior à data de corte) pede Windows 10/11 x64, Python 3.12, NVIDIA Ampere+ (compute capability 8.0+), driver/CUDA 12.8, Visual C++ runtime e sessão OpenGL. Os autores dizem ter rodado em RTX 3070 Ti 8 GB e mencionam auto-offload. Confirmar a disponibilidade/release dessa documentação. | RX 580 AMD não satisfaz a exigência NVIDIA/CUDA documentada nesse snapshot. Não encontramos suporte oficial DirectML, ROCm ou Vulkan para HairDeck. | Não envia imagem a serviço de inferência se executado local; download de código/pesos/dependências. Nenhuma instalação/download feito. |
| **Linux local** | README e requirements apontam Python 3.12, PyTorch 2.8/torchvision 0.23 e uma GPU CUDA; dependências de SAM3/DINOv3/preview/FFmpeg. | Não valida RX 580 nem ROCm. | Local depois de instalar, mas precisa de rede para obter código/modelos na primeira execução. |
| **macOS Apple Silicon** | README atual descreve MPS. | Não aplicável ao Windows/AMD do usuário. | Código/compatibilidade não testados por nós. |
| **CPU local** | O código de seleção de device prevê fallback CUDA → MPS → CPU, mas a documentação de inferência exige GPU CUDA (ou MPS no Mac); não encontramos benchmark/suporte CPU declarado para Windows. | **Não tratar CPU como alternativa viável sem prova de tempo/memória e estabilidade.** | Sem custo de provider, mas custo de tempo/energia; teste futuro precisaria ser autorizado. |
| **Colab T4 do 3D Create** | Notebook recomenda runtime T4 e anuncia instalação de 5–10 min e geração de ~1–3 min, como estimativas do notebook. | É o único backend ligado pelo handler atual; não torna Colab obrigatório para o projeto-alvo e não foi executado. | A imagem é escolhida/enviada manualmente para Colab; pesos são baixados via Hugging Face; resultados voltam ao PC via URL pública ngrok. O notebook chama Colab “grátis”, mas disponibilidade/termos podem mudar; não é garantia de cota/custo. |
| **Demo hospedada/API** | README aponta demo web no Hugging Face Spaces. | Não há adapter/API de geração no 3D Create que tenha sido validado. | Upload para serviço externo exigiria consentimento e revisão de retenção/termos; custo e disponibilidade não foram verificados. |

SAM 3 e DINOv3 têm licenças próprias (arquivos no repositório oficial da Meta) e o notebook pede aceitação dos termos gated. O texto dessas licenças não foi aceito; os weights não foram baixados. O modelo não pode ser distribuído apenas com base na licença Apache do código HairDeck.

**Privacidade/bridge:** o notebook pede upload manual da imagem para Colab; depois envia arquivos de resultado por `base_url` (ngrok). A bridge local do snapshot aceita GET/POST sem autenticação aparente, libera CORS `*` e não mostra limite máximo de corpo para POST. O notebook não usa automaticamente o arquivo de referência guardado pelo job. Nada foi tunneled. Qualquer uso deve explicar ao usuário o destino da imagem, os termos do Colab/HF, volume de dados e o túnel antes de pedir autorização.

## 5. Charakuru: comparação sem copiar ou integrar

### 5.1 Capacidades documentadas no snapshot v1.1.0

O README/tutorial descreve uma app local que recebe uma ilustração de corpo inteiro e combina geração/revisão de imagens, candidatos 3D Tripo, preparação no Blender e export VRM. Em termos documentados:

- agente com geração de imagem e browser control cria oito vistas: cabeça (com cabelo) e corpo/roupa, quatro direções cada; há checkpoints humanos para rever/substituir imagens;
- Tripo gera quatro candidatos para a cabeça e quatro para o corpo, e o usuário escolhe antes de prosseguir; o tutorial diz que os créditos Tripo começam a ser usados nessa etapa;
- ferramenta separa/organiza partes e grupos de textura/spring, faz UV/texturas, permite ajuste de proporção, rig do corpo e cabeça, transferência de pesos de um corpo-base, física para cabelo/saia/ribbons, revisão de motion/walk e export VRM 1.0 + Blend;
- documentação também descreve checks estruturais/MToon/textura/springs, mas afirma que aparência visual não é pontuada automaticamente; há outras etapas opcionais, como expressões.

Esses pontos são **documentados pelo projeto**, não inspeção do binário nem execução independente. O README diz que o kit está em desenvolvimento e reconhece bugs/funcionalidades ausentes.

### 5.2 Diferenças em relação ao 3D Create observado

| Área | Charakuru — documentação | 3D Create no snapshot `9e4bc91f…` | Gap/paridade real |
|---|---|---|---|
| Entrada e candidatos | Uma ilustração → referências 2D por partes → comparação de 4 candidatos de cabeça e 4 de corpo, com escolha humana. | `reference_info` e ferramentas de corpo/proporção/rig; o README remoto ainda marca M1–M5 pendentes; HairDeck só cria cabelo via Colab, não candidato de corpo. | Fluxo Charakuru mais explicitamente guiado por candidatos/decisões; não há equivalência E2E provada no Create. |
| Peças/roupa/cabelo | Separação com Tripo, categorias de textura e grupos de spring; cabelo e roupa são revisados por peça. | `make_piece`/`adapt_asset` e hair import parcial; peças e UV/bake existem como handlers, mas não comprovam qualidade num avatar real. | Sobreposição conceitual, não paridade de pipeline ou topologia. |
| Rig/pesos | Tripo para posição dos ossos + transferência de pesos do corpo-base; revisão de dobras e springs. | Rig canônico/autoweights, peças parentadas; HairDeck import atual não liga os cards ao rig nem traz springs. | A rota HairDeck não satisfaz rig/physics do alvo sem etapa adicional. |
| Materiais/UV/export | Tripo/texturas, MToon, VRM 1.0, Blend editável, review de walk. | Shader, UV/bake e export VRM/GLB/FBX/Blend declarados; HairDeck GLB usa cores/UVs próprias; sem round-trip validado. | Outputs/versões de VRM e pipeline de material diferem; não assumir conversão fiel. |
| Agente/provider | Codex com geração de imagem/browser control; Tripo na conta do usuário; Blender 5.2, VRM Add-on, Blender MCP. | Agente Gemini/Groq no Create; Colab/ngrok para HairDeck; addon Motion2MixamoRig separado. | Ambos têm dependências remotas opcionais/obrigatórias para sua automação. Forge não pode herdar esse requisito. |

### 5.3 Direitos, assets, custos e limites

A licença em `Charakuru/LICENSE` é “Source-Available License and Terms of Use” customizada (v1.2), não uma licença OSI/MIT; a API do GitHub retorna `NOASSERTION`, o que não significa ausência de termos. A licença cobre código, Scripts, Skills e documentação fornecidos como kit. Em síntese para planejamento (não parecer jurídico):

- a licença permite certos usos privados e internos, sujeitos aos limites de uso comercial nela definidos;
- **redistribuir o kit ou integrar em produto/serviço que disponibilize código do kit a usuários requer permissão prévia por escrito**; atingir o limite de receita ou funding pode exigir acordo comercial separado;
- assets do kit (incluindo corpo doador ponderado, modelos, artwork e exemplos) têm restrições fortes de extração/uso separado/redistribuição; um acordo de código não libera automaticamente esses assets;
- outputs autorizados têm tratamento próprio, mas continuam sujeitos a direitos de Tripo, arte/imagem e terceiros.

O kit completo é distribuído em ZIP separado; o Git consultado contém README, tutorial e licença, não os arquivos de app/Skills listados na distribuição. O ZIP não foi baixado. A documentação lista Node.js 22+, navegador Chromium desktop, Codex com geração de imagem/browser control, conta Tripo, Blender 5.2, VRM Add-on e Blender MCP. O app pode rodar localmente, mas imagem/Tripo e operações do agente usam contas/serviços externos. O preço atual de Tripo, limites de créditos e termos não foram auditados; não há custo confiável a fixar aqui.

**Restrição respeitada:** não copiar, incorporar, migrar ou redistribuir código, Skills, prompts, donor body, imagens, modelos ou outros assets Charakuru. É permitido estudar a ideia de checkpoints, comparação humana, proveniência e validação e propor uma implementação independente, sem transcrever materiais protegidos. Não criar um `CharakuruAdapter` nem depender do pacote.

## 6. Motion2MixamoRig: captura, retarget, hardware e licenças

### 6.1 Capacidades e requisitos funcionais documentados

Motion2MixamoRig v0.1.8 declara-se experimental. O CLI e a extensão Blender usam o mesmo pipeline: vídeo de uma pessoa ou foto em pose → estimação do esqueleto via GVHMR → retarget para personagem com rig Mixamo → `.glb` skinned e previews. O personagem de entrada precisa ser Mixamo/FBX em T-pose; o input deve mostrar uma pessoa inteira, cabeça aos pés e visível durante o vídeo.

- **Vídeo:** extração temporal, retarget e export de movimento. O projeto gera `skeleton_motion.npz`, `mixamo_rotations.npz`, `mixamo_character.glb`, `run.json`, previews e `diagnostics.json` de self-intersections do personagem animado.
- **Imagem:** a implementação repete a foto por 32 frames para a entrada temporal de GVHMR e retorna uma **pose estática**; não inventa uma sequência de movimento.
- **Reuso/retomada:** o arquivo de esqueleto pode ser passado com `--skeleton` para retargetar outros rigs e pular a extração pesada. Cache, run report e saída por job dão base para retomar etapas locais, sujeito à persistência dos arquivos.
- **Mãos:** `--detect-hands` é opcional, usa HaMeR + modelo MANO, acrescenta dedos ao retarget e aproximadamente dobra o tempo segundo o README.

O README cita ~5 GB de pesos GVHMR; o guia da extensão estima ~5,6 GB de pesos no primeiro `Generate Motion` e ~1,4 GB de runtime/dependências no setup; `--detect-hands` baixa ~2,7 GB adicionais. O README estima 8–15 min de extração para um vídeo de ~30 s no primeiro run CPU, 3–5 min após cache e mais 1–2 min para retarget/render; são estimativas upstream, não medição nesta máquina. Mixamo FBX, SMPL-X e MANO não vêm no repositório e têm fontes/termos separados.

### 6.2 Integração existente no 3D Create

O branch atual contém `plugins/Motion2MixamoRig-v0.1.8.zip` (95.192 bytes no tree snapshot), e `plugins/README.md` registra origem/tag `v0.1.8`, commit `f05a718…`, licença do código Apache-2.0, ID `motion2mixamorig` e uso esperado na milestone M5. `test_agent_v044.py` afirma ler o manifest do ZIP e conferir ID/versão/licença; **esse teste não foi executado por nós**. O arquivo do plugin foi inspecionado estaticamente via API na etapa anterior; não foi instalado nem integrado ao workspace.

A release upstream v0.1.8 traz apenas um ZIP oficial macOS ARM64 e diz que Windows está “coming soon”. O guia da extensão descreve uma opção CPU e documentação de runtime Windows, mas alega teste apenas em macOS; também diz que ZIP sem plataforma é apenas para teste local, enquanto releases são específicas por plataforma. A cópia incluída no 3D Create não comprova que seja um build oficial Windows suportado.

O README de plugins diz que extensões são instaladas pelo launcher, todas desligadas por padrão e que o usuário as habilita em cada milestone. Não encontramos no `tools_registry.py`, `agent_core.py` ou handlers uma tool que escolha vídeo/foto, chame o add-on e devolva o GLB automaticamente. Então:

- **empacotado:** sim;
- **disponível como UI independente do Blender:** a documentação upstream descreve isso;
- **chamável pelo agente 3D Create/Forge sem intervenção:** não demonstrado;
- **instalado/executado nesta sessão:** não.

O manifesto declara Blender mínimo 4.2.0, mas isso não equivale a validação com o ambiente do usuário. O README upstream marca a versão como experimental e diz que foi testada apenas em macOS Apple Silicon.

### 6.3 Hardware, performance e dependências

| Backend | Evidência documental | Conclusão para RX 580 / Windows |
|---|---|---|
| **CPU local** | O guia da extensão lista Device `CPU` como modo lento e CPU-only para Windows; a documentação estima 8–15 min para extrair um vídeo de ~30 s na primeira execução e 3–5 min em runs semelhantes depois dos pesos/cache. | É uma possibilidade documentada, mas a release v0.1.8 não traz build oficial Windows e declara teste apenas macOS; **não foi testada** no Windows nem no CPU do usuário. O RX 580 pode ficar sem uso. Medir antes de prometer. |
| **NVIDIA CUDA** | A extensão lista CUDA/NVIDIA; CUDA deve corresponder ao PyTorch/driver. | Não é backend RX 580 AMD. |
| **Apple MPS** | Documentado para Apple Silicon se PyTorch MPS estiver disponível. | Não aplicável ao Windows. |
| **AMD / Vulkan / ROCm / DirectML** | Não encontramos no seletor/documentação uma rota suportada. | **NÃO VERIFICADO; não anunciar suporte.** |
| **Colab/cloud/API** | O ZIP e README não mostram backend Colab/API de inferência. | Não obrigatório para esta ferramenta; não usar provider remoto por suposição. |

O runtime do add-on instala CPython 3.11/dependências fora do Python do Blender; o README descreve download de `uv` e instalação inicial, além de baixar automaticamente os pesos. A execução de inferência, segundo a documentação, é local depois desses downloads; os arquivos de vídeo/pose não precisam ser enviados a provider no fluxo documentado. Qualquer setup/execução/download exigiria autorização explícita e revisão das licenças antes de uso comercial.

### 6.4 Licenças: licença do wrapper não libera os modelos

| Componente | Evidência consultada | Impacto de planejamento |
|---|---|---|
| Código Motion2MixamoRig | `LICENSE` Apache-2.0; o ZIP testa a string Apache no manifest. | Reuso de código poderia ser possível após aprovação, notices e obrigações Apache, mas não resolve dependências/pesos. Nenhum código foi copiado. |
| GVHMR | `NOTICE.md` do projeto diz “non-commercial research purposes only”; [`zju3dv/GVHMR/LICENSE`](https://github.com/zju3dv/GVHMR/blob/ee960bb6e2ea2d381aa97f08e9b71ef320b624b1/LICENSE) permite uso educacional, pesquisa e fins sem fins lucrativos e proíbe uso comercial sem falar com os autores. | Pipeline padrão não é rota comercial liberada pela licença do wrapper. Obter autorização ou substituir a etapa por provider/modelo com direitos compatíveis. |
| SMPL-X | Licença oficial do [`vchoutas/smplx`](https://github.com/vchoutas/smplx/blob/1265df7ba545e8b00f72e7c557c766e15c71632f/LICENSE): somente pesquisa científica, educação ou arte não comerciais; proíbe produto/serviço comercial e disponibilização/redistribuição sem permissão escrita. O modelo exige registro/download próprios. | **BLOQUEIO para uso comercial** na rota atual até acordo ou substituição. O termo “arte” no grant continua condicionado a não comercial. |
| MANO/HaMeR (opcional) | Motion README/NOTICE exigem modelo MANO separado e indicam termos próprios; código de inferência HaMeR e weights são tratados separadamente. | Ativar mãos adiciona outra licença/modelo gated; não assumir que o código MIT da parte de inferência libera MANO/weights. |
| YOLOv8 e pesos de pose/HMR | `NOTICE.md` do wrapper lista YOLOv8 sob AGPL-3.0 e licenças próprias para checkpoints de pose/HMR. | Revisão jurídica/técnica adicional antes de distribuir runtime ou acoplar esse caminho. |

A documentação do upstream resume que a rota end-to-end fica efetivamente restrita a não comercial/pesquisa por seus componentes, independentemente de o wrapper ser Apache. O post Patreon de 21/out também informa que os próprios outputs do teste foram considerados não comerciais por GVHMR/SMPL-X. Não se aceita licença nem se presume direito de output/redistribuição nesta auditoria.

## 7. Matriz independente de backends e dados

| Etapa/capacidade | Windows local | CPU | NVIDIA GPU | AMD RX 580 / Vulkan / ROCm | Colab/cloud/API | Dados e custo/licença |
|---|---|---|---|---|---|---|
| **Modelagem Blender / preparação 3D local** | Blender local continua sendo a rota manual/base. | Operações geométricas convencionais podem rodar em CPU, conforme operação. | Pode acelerar render/operação suportada pelo Blender. | A documentação antiga do 3D Create menciona RX 580/Vulkan/ZLUDA em tabelas de planejamento, sem prova específica nesta auditoria. Isso não valida HairDeck/Motion. | Não necessário para operação manual. | Sem custo de inferência remota; hardware/energia e assets com licença própria. |
| **HairDeck** | Guia upstream Windows pede NVIDIA Ampere+ e CUDA12.8; o 3D Create só liga HairDeck via Colab. | Seleção CPU existe no código, mas suporte/performance Windows não documentados. | Windows upstream documenta CUDA; notebook pede Colab T4. | Nenhuma rota suportada encontrada para RX 580. | Colab T4 é rota **opcional** no notebook; demo hospedada é serviço remoto separado, não adapter validado. | Colab recebe imagem manualmente; HF recebe autenticação para weights gated; GLB/VRM retornam via ngrok. “Grátis” é declaração do notebook, disponibilidade/termos incertos; weights e licenças não são automaticamente livres de condições. |
| **Motion2MixamoRig** | Add-on Blender 4.2+ com Python externo; release v0.1.8 experimental traz ZIP oficial macOS ARM64; build Windows anunciado como futuro. | O guia documenta CPU-only para Windows e CPU como opção geral, mas sem build oficial Windows/teste real. | CUDA NVIDIA; MPS Apple. | Sem suporte declarado; não usar RX 580 como se fosse CUDA. | Não há backend remoto integrado no projeto. | Vídeo/foto ficam locais no fluxo de inferência documentado; runtime/weights baixados (~1,4 GB + ~5–5,6 GB; hands +2,7 GB); uso comercial bloqueado por upstream. |
| **Charakuru/Tripo** | App UI local no PC; Blender local para edição/rig. | CPU local não substitui geração Tripo. | Não há requisito de GPU de inferência local documentado para o kit. | Não há compatibilidade de inferência AMD a declarar. | Tripo é usado no browser; agente também pode usar provider de imagem. | Imagens/candidatos vão a serviço externo conforme o fluxo; créditos começam na geração de candidatos; preço/termos atuais não foram verificados. Source-available; sem cópia/integração. |
| **Lia3DSprite / render de spritesheet** | Pipeline separado do Character Create; usa modelo já preparado e renderer local conforme baseline do relatório anterior. | Pode ser opção em certas operações, sem equivalência de desempenho visual. | Depende do renderer/browser escolhido e deve ser testado por rota. | Nenhuma nova afirmação de suporte para hair/mocap; homologação separada. | Não deve depender de Colab/provider/agente. | A entrada `.glb`/`.blend` só é fronteira candidata até round-trip e render real passarem. |

### Política proposta de execução e retomada

1. **Escolher backend por etapa**, não por workflow inteiro: `HairGeneration`, `PoseCapture`, `Retarget`, `RigValidation`, `SpriteRender` podem ter executores distintos. Um job de render não deve inicializar Colab/Motion/HairDeck.
2. **Local/manual é caminho válido:** aceitar personagem existente, cabelo/roupa existente, animação importada ou keyframes manuais sem iniciar agente/provider. CPU é permitido onde medido; não anunciar que a GPU do usuário é compatível por ser “8 GB”.
3. **Colab, cloud, API, upload e cobrança são opt-in.** Antes da chamada, mostrar destino, arquivo/bytes enviados, modelo/provider, licença, custo estimado conhecido e o que fica remoto. Se preço/retention forem desconhecidos, bloquear ou pedir decisão informada.
4. **Retomar por artefato intermediário:** persistir outputs por estágio (cartas/JSON/GLB, skeleton/NPZ, rig/Blend) com hashes e estado; não repetir a etapa cara se usuário já tem resultado válido. O pipeline Motion documenta reuso de `skeleton_motion.npz`; Charakuru documenta checkpoints do projeto; o notebook HairDeck atual não implementa scheduler de retomada Forge entre providers.
5. **Sem provider obrigatório:** o usuário pode cancelar/omitir HairDeck, MoCap, Tripo ou modelo externo e ainda usar Forge para registrar/importar/renderizar arquivos autorizados.

## 8. Arquitetura-alvo, proveniência e fases

### Limites dos módulos

- **Forge:** interface, projeto/artefatos, autorizações, estado de execução, proveniência e revisão. Deve abrir/registrar arquivos e permitir modo manual; não importar internals de agente/provider.
- **`Lia3DCreate`:** módulo próprio para criação/preparação de personagem, cabelo, roupa, materiais, rig, peças e validadores. Providers (por exemplo HairDeck, quando autorizado) são adapters opcionais; não são o módulo nem a interface principal.
- **`Lia3DSprite`:** módulo próprio para câmeras/direções, seleção/execução de animações, renderização e empacotamento de spritesheet. Consome um personagem/animação existente; não deve precisar de HairDeck, Tripo, GVHMR ou agente para operar.
- **Providers independentes, nomes preservados:** `HairDeck`, `Motion2MixamoRig`, `Tripo` e outros mantêm nome/origem nos registros. Módulos internos usam prefixo `Lia`. Captura de movimento e retarget são ports separados: mudar o estimador de pose não deve obrigar a trocar o renderer ou o rigging.
- **Coexistência, não substituição:** manter Forge e os fluxos implementados existentes como baseline; `Lia3DCreate` e `Lia3DSprite` são limites/planejamento modular, não autorização para mover, renomear, substituir ou migrar código. Qualquer migração aguarda aprovação expressa.
- **Interface e documentação próprias em pt-BR:** labels, estados, consentimentos, documentação e relatórios da Forge/Lia devem ser em português do Brasil; providers externos conservam nome/origem, sem tornarem seu UI/idioma uma dependência.
- **Charakuru não é provider a integrar:** apenas ideias gerais de checkpoints, revisão humana e comparação de candidatos podem inspirar implementação independente. Nada de código, Skills, assets ou pacote Charakuru.

`.glb` continua sendo candidato de intercâmbio, não contrato já validado. `hair_seedN.glb`, avatar `.vrm` (VRM 0.x no HairDeck), `.blend`, `.npz` e manifests têm semânticas diferentes. O importador tem de declarar qual deles consome e verificar o que preserva. Não inferir spring bones a partir da extensão `.glb` nem renomear `.vrm` para atender um contrato.

### Proveniência mínima por artefato/run

Registrar sem sobrescrever sidecars legados:

- módulo e capability Lia; provider com nome original; versão/tag e commit SHA do código;
- ID/versão/hash de cada weight/model, license/terms e status de direitos (p.ex. `unknown`, `noncommercial`, `cleared`);
- arquivo de entrada, SHA-256, permissões/consentimento, arquivos enviados e destinos remotos quando houver;
- backend selecionado, SO/versão/CPU/GPU/driver/CUDA/MPS, Blender/add-on/importer/exporter e dependências relevantes;
- parâmetros/seed/variação escolhida, unidades/eixos/FPS, rig profile, formato e transform aplicado;
- outputs, tamanho/hash, artifacts intermediários e relações entrada→saída;
- checks executados, resultado em separado (estrutural, visual, licença, round-trip), warnings e aprovação humana.

### Fases condicionais — nenhuma autorizada por este relatório

**Fase A — confirmar snapshot, data e direitos.** Confirmar com mantenedores a ponta publicada do 3D Create (o timestamp `2026-11-08` é futuro), pin do HairDeck e do ZIP Motion, terms dos modelos gated, licença de imagens e qualquer arquivo de teste antes de integrar.

**Fase B — fechar a especificação sem executar provider.** Definir contracts de `HairAsset`, `MotionClip`, `RiggedCharacter`, `ValidationReport` e provenance. Preservar outputs brutos e distinguir GLB sem rig, GLB com skin, GLB com visualização de chains e VRM com springs. Especificar e revisar estaticamente o destino `OUT_DIR/<image_name>` entre notebook, exportador e coleta, incluindo isolamento de diretório por job e exclusão de artefatos antigos.

**Fase C — primeiro validar por fixtures sintéticas aprovadas.** Desenvolver a especificação do validator em cópias/fakes: cartões intencionais e casos sintéticos. Não instalar HairDeck nem baixar weights; nenhuma “correção” automática até testes de falso positivo e preservação de UV/cores/material.

**Fase D — piloto HairDeck após autorização.** Corrigir e testar a hierarquia de diretórios da geração/export VRM/coleta; isolar cada job e evitar envio de saídas antigas. Selecionar e exibir os quatro seeds; pin de commit/weights; escolher `nohead` explicitamente; comparar atributos antes/depois; desenvolver uma rota explícita de spring bones/weights (ou declarar que o cabelo é estático). Testar uma personagem licenciada e registrar tudo. Não importar VRM e GLB indistintamente.

**Fase E — piloto MoCap separado.** Antes de instalação, download ou execução, decisão informada sobre licença/uso (incluindo comercial), Windows e dados. Se o uso for comercial e a rota GVHMR/SMPL-X continuar, obter autorização ou trocar provider/modelo. Se CPU for opção, benchmark local autorizado e anotado no hardware real; comparar vídeo/retarget cru e revisão manual.

**Fase F — conectar `Lia3DSprite`.** Só depois de existir artefato personagem/animação validado, renderizar em rota manual ou provider escolhido; guardar FPS, ações, câmeras e metadata sem depender da origem do modelo. Comparar antes/depois e revisar visualmente.

## 9. Testes e critérios de validação futuros

| Área | Evidência de testes encontrada | O que não comprova |
|---|---|---|
| 3D Create v0.4.4 | `tests/test_agent_v044.py` verifica marcadores de células, strings do protocolo, presença do branch `kind="hairdeck"`, nomes do importador e manifest/versão/licença do ZIP. CI chama `tests/run_all.py` em Ubuntu/Python 3.12. A mensagem do commit anuncia 133 testes. | Não foi executado nesta auditoria. Testes de conteúdo não rodam HairDeck, Colab, Blender, bridge, import VRM, física, GPU, Windows ou revisão visual. O número 133 não foi recontado nem validado por execução. |
| HairDeck upstream | O tree lista testes de VAE, seleção de device, offload, preprocessing, Windows setup/demo/VRM. A documentação também descreve avaliação de pointcloud/chains com assets/weights. | Não foi rodada suíte nem avaliação. Nos arquivos consultados não apareceu uma suíte que detecte as faces ocultas/overlap relatadas no Patreon, nem uma fixture com essa entrada específica. |
| Motion2MixamoRig | Documentação lista testes/doctor, diagnóstico de interseção do personagem, foot locking e outputs. O README upstream diz “experimental” e “tested on macOS (Apple Silicon) only”. | Não é validação Windows/AMD nem autorização para uso comercial. Não executamos `doctor`, geração de vídeo/imagem ou import GLB. |
| Charakuru | README/tutorial informam validações de VRM, MToon, textura e spring e alertam que o kit está em desenvolvimento. | O kit release não foi baixado; esses checks não foram inspecionados nem executados. Revisão visual e autorização de Tripo/agent continuam separadas. |
| Vídeos/Patreon | Páginas textuais e transcrições descrevem demonstrações e outputs. | Não substituem artefatos comparáveis, benchmark ou execução nossa. O ZIP de demonstração não foi baixado. HairDeck video/post aparecem com datas futuras. |

### Gate para qualquer alegação de compatibilidade/qualidade

Antes de marcar `VALIDADO` para um backend, exigir: OS/hardware exatos; dependências/licenças aprovadas; input e hash; commit/weights/seed; outputs completos; logs; validação estrutural; comparação visual; import/export round-trip; registro de falhas e aprovação humana. Teste unitário/estático, vídeo promocional e mensagem de commit não satisfazem esse gate.

## 10. Fontes consultadas (snapshots fixados quando possível)

### Projetos

- [Baseline de consolidação anterior](MODULE-CONSOLIDATION-AUDIT-3D.md).
- [3D Create — árvore no SHA `9e4bc91f…`](https://github.com/BloomRX/3d-create/tree/9e4bc91f7115abb5137682e5814c170dd2f670ba); [handlers](https://github.com/BloomRX/3d-create/blob/9e4bc91f7115abb5137682e5814c170dd2f670ba/agent/bloom_agent/tools/handlers.py#L264-L390); [tool registry](https://github.com/BloomRX/3d-create/blob/9e4bc91f7115abb5137682e5814c170dd2f670ba/agent/bloom_agent/tools_registry.py#L101-L117); [agent prompt](https://github.com/BloomRX/3d-create/blob/9e4bc91f7115abb5137682e5814c170dd2f670ba/agent/bloom_agent/agent_core.py#L68-L80); [notebook](https://github.com/BloomRX/3d-create/blob/9e4bc91f7115abb5137682e5814c170dd2f670ba/colab/hairdeck_bloom.ipynb); [teste v0.4.4](https://github.com/BloomRX/3d-create/blob/9e4bc91f7115abb5137682e5814c170dd2f670ba/tests/test_agent_v044.py); [plugins README](https://github.com/BloomRX/3d-create/blob/9e4bc91f7115abb5137682e5814c170dd2f670ba/plugins/README.md); [PIPELINE.md](https://github.com/BloomRX/3d-create/blob/9e4bc91f7115abb5137682e5814c170dd2f670ba/docs/PIPELINE.md); [ANIME_RECIPES.md](https://github.com/BloomRX/3d-create/blob/9e4bc91f7115abb5137682e5814c170dd2f670ba/docs/ANIME_RECIPES.md).
- [HairDeck README no SHA `cb20f707…`](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/README.md); [Windows setup](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/docs/windows.md); [image-to-hair output layout](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/scripts/image_to_hair.py); [cards/UV](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/hairdeck/cards/mesh.py); [GLB writer](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/hairdeck/infer/glb.py); [VRM export](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/hairdeck/vrm/export.py); [VRM checker](https://github.com/hyz317/HairDeck/blob/cb20f7073419a33c9ab88f22f686fcb9060a99f0/hairdeck/vrm/check.py); [issues](https://github.com/hyz317/HairDeck/issues); [releases](https://github.com/hyz317/HairDeck/releases).
- [Charakuru v1.1.0 README](https://github.com/nanocle/Charakuru/blob/8eb22f6c6700dcc310896336596682594928024c/README.md); [license](https://github.com/nanocle/Charakuru/blob/8eb22f6c6700dcc310896336596682594928024c/LICENSE); [tutorial](https://github.com/nanocle/Charakuru/blob/8eb22f6c6700dcc310896336596682594928024c/docs/tutorial.md); [v1.1.0 release](https://github.com/nanocle/Charakuru/releases/tag/v1.1.0).
- [Motion2MixamoRig v0.1.8 README](https://github.com/MaxLiu22/Motion2MixamoRig/blob/f05a718188026b06e7ee64b47bab077970444b19/README.md); [NOTICE](https://github.com/MaxLiu22/Motion2MixamoRig/blob/f05a718188026b06e7ee64b47bab077970444b19/NOTICE.md); [Blender extension guide](https://github.com/MaxLiu22/Motion2MixamoRig/blob/f05a718188026b06e7ee64b47bab077970444b19/blender_extension/README.md); [release v0.1.8](https://github.com/MaxLiu22/Motion2MixamoRig/releases/tag/v0.1.8).
- [GVHMR LICENSE](https://github.com/zju3dv/GVHMR/blob/ee960bb6e2ea2d381aa97f08e9b71ef320b624b1/LICENSE); [SMPL-X LICENSE](https://github.com/vchoutas/smplx/blob/1265df7ba545e8b00f72e7c557c766e15c71632f/LICENSE); [SAM 3 LICENSE](https://github.com/facebookresearch/sam3/blob/main/LICENSE); [DINOv3 license](https://github.com/facebookresearch/dinov3/blob/main/LICENSE.md).

### Vídeo e relato do autor (atribuição, não E2E independente)

- [Stefan 3D AI — Motion2MixamoRig/Charakuru, 24/out/2026](https://www.youtube.com/watch?v=58UpDAnbdkM).
- [Stefan 3D AI — HairDeck, página/transcrição](https://www.youtube.com/watch?v=c2ZsNhlYftM); [post HairDeck com descrição do teste](https://www.patreon.com/Stefan3DAI/posts/free-local-hair-174347750).
- [Post Patreon Charakuru + Motion2MixamoRig, 21/out no snapshot](https://www.patreon.com/Stefan3DAI/posts/charakuru-rigged-172975147).

## 11. Ações expressamente não realizadas

- Não houve clone de 3D Create, HairDeck, Charakuru ou Motion2MixamoRig no workspace; fontes de código e a estrutura do ZIP do plugin Motion2MixamoRig incluído no 3D Create foram inspecionadas estaticamente via API.
- O ZIP Charakuru, os pesos/modelos HairDeck/GVHMR/SMPL-X/MANO/HaMeR e os arquivos Drive/Patreon não foram baixados; o ZIP do plugin Motion2MixamoRig não foi instalado nem integrado ao workspace.
- Não houve upload de imagem/vídeo, token ou chave; não foi aceito termo/licença; nenhum serviço ou túnel foi iniciado.
- Não houve instalação, geração HairDeck, captura MoCap, importação/exportação Blender, teste, benchmark, alteração de branch/histórico, commit ou push.
- Nenhum arquivo anterior foi editado. O único arquivo novo desta etapa é este relatório complementar; o baseline permanece em `docs/MODULE-CONSOLIDATION-AUDIT-3D.md`.

**Recomendação final:** manter como **planejamento** a separação `Lia3DCreate`/`Lia3DSprite` e adapters opcionais. Tratar HairDeck no 3D Create como import inicial de geometria via Colab, não como cabelo com física integrada; obter um output e validação reproduzível só após autorização. Tratar Motion2MixamoRig como captura experimental: CPU aparece na documentação para Windows, mas a release v0.1.8 não traz build oficial Windows nem validação local; uso comercial segue bloqueado por GVHMR/SMPL-X até substituição/permissão. Usar Charakuru apenas como referência conceitual, sem código, Skills ou assets. Não declarar suporte RX 580, Windows, spring bones ou correção de faces internas sem teste E2E no ambiente e autorização do usuário.
