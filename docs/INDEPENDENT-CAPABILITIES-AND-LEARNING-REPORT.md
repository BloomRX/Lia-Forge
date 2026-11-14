# Capacidades e aprendizados independentes — estudo técnico

- **Data:** 2026-11-14
- **Branch:** `arena/624582f5-lia-forge`
- **Natureza:** pesquisa, engenharia reversa conceitual e especificação independente. Não é integração nem implementação.
- **Estado de tudo o que este documento propõe:** `PROPOSED`.
- **Documento irmão:** [`INDEPENDENT-CAPABILITIES-ROADMAP.md`](INDEPENDENT-CAPABILITIES-ROADMAP.md) (prioridades, dependências, sequência).

---

## 0. Escopo, método e limites

### 0.1 Materiais estudados

Três materiais de referência de terceiros, entregues em quatro arquivos compactados. Neste documento eles são chamados de forma neutra:

| Rótulo | Descrição neutra | Tecnologia de base |
|---|---|---|
| **Referência A** | Kit web de produção procedural de assets 3D e 2D, acompanhado de um conjunto de instruções para agentes voltadas ao ciclo de vida de um jogo | JavaScript, Three.js, Manifold, Canvas 2D, navegador sem interface |
| **Referência B** | Ambiente de criação de assets 2D por código, com motor vetorial e motor de pixel art | TypeScript, Canvas 2D, Paper.js, navegador sem interface |
| **Referência C** | Pipeline 3D por receitas, com etapas separadas de geometria, UV, pintura e animação, e exportação glTF | Python, NumPy, Pillow, Three.js no visualizador |

**Rastreabilidade.** A identificação nominal dos materiais, os hashes SHA-256 dos arquivos, as licenças, a proveniência e a análise de segurança estão em [`EXTERNAL-TOOLS-INTEGRATION-ASSESSMENT.md`](EXTERNAL-TOOLS-INTEGRATION-ASSESSMENT.md) (§2 a §6). Aquele relatório não foi alterado. A correspondência é: Referência A = primeiro item do inventário de lá; Referência B = segundo e terceiro (duas versões do mesmo material); Referência C = quarto.

### 0.2 Regra de separação usada neste estudo

Cada elemento observado foi classificado em uma de três classes, e só as duas primeiras entram nas especificações:

| Classe | O que é | Tratamento |
|---|---|---|
| **IDEIA** | Conceito funcional, princípio de projeto, prática de engenharia. Ideias não são objeto de direito autoral. | Descrita com palavras próprias e reespecificada para a Lia Forge. |
| **PÚBLICO** | Tecnologia, formato, algoritmo ou especificação de domínio público ou de licença aberta, com documentação própria e independente dos materiais. | Citada pelo nome; a implementação deve partir da documentação pública. |
| **PROPRIETÁRIO** | Código-fonte, nomes de API, estrutura de arquivos, textos de instrução, esquemas de manifesto, imagens e exemplos específicos dos materiais. | **Não reproduzido.** Quando relevante, o documento só registra que existe e por que não deve ser copiado. |

Consequências práticas:

- Este documento **não contém código** dos materiais, nem assinaturas de função, nem nomes de comandos, nem trechos de instruções.
- Os nomes de campos e de contratos propostos aqui são novos e seguem o vocabulário da Lia Forge.
- Formatos de terceiros citados pelo nome (glTF, PNG, o formato de projeto do Blockbench) são formatos públicos, não os materiais avaliados.

### 0.3 Limite honesto do "independente"

Quem escreve esta especificação leu os materiais. Isso é análise funcional, não um processo de sala limpa em sentido estrito. Para manter a implementação independente:

1. Quem implementar deve trabalhar **só** a partir deste documento, do roadmap e da documentação pública das tecnologias citadas.
2. Os arquivos compactados não devem estar disponíveis para os implementadores (ver plano de remoção no roadmap, §8).
3. Dúvidas de comportamento devem ser resolvidas por decisão de projeto da Lia Forge, não por consulta aos materiais.

### 0.4 O que foi feito e o que não foi

- **Feito:** releitura dirigida dos materiais (documentos de arquitetura, instruções para agentes, e o código das partes de servidor, visualizador, verificação e exportação), em diretório temporário fora do repositório; leitura do estado atual do código da Lia Forge.
- **Não feito:** nenhum programa, receita, teste ou instalador foi executado; nenhuma dependência foi instalada; nenhum código foi copiado; nenhum conteúdo foi enviado a serviço externo.
- **Consequência:** toda descrição de comportamento é "o material declara e o código indica", nunca "foi observado funcionando". A qualidade visual dos resultados não foi avaliada.

### 0.5 Estado da Lia Forge usado na comparação

A comparação usa a branch de código `arena/649f88bd-3dspritesheet` no commit **`97c0266`**, lida nesta sessão. Três ressalvas:

1. Esse código **não está em `main`** (ver `INDEPENDENT-ARCHITECTURE-REVIEW.md`, C-01).
2. A branch avançou nove commits desde a revisão de arquitetura (que usou `5b0ec51`). Os títulos desses commits declaram correções de itens P0: superfície HTTP, autorização por execução, direitos como gate, `--disable-autoexec` no Blender, bind em loopback. Confirmei por leitura a presença dos módulos `shared/http/api-policy.mjs` e `shared/engine/run-authorization.mjs` e da flag `--disable-autoexec` em `electron/blender-adapter.cjs`. **Não reauditei** essas correções; "existe" abaixo significa `IMPLEMENTED` por leitura, não `VALIDATED`.
3. Nada foi executado no hardware-alvo.

---

## 1. Síntese

### 1.1 O que os materiais ensinam, em dez pontos

1. **Verificar o arquivo entregue, não a prévia.** Reabrir o que foi gravado e medir é a única evidência de entrega.
2. **Separar "passou na máquina" de "aprovado por uma pessoa".** O relatório automático nasce com a revisão visual pendente.
3. **Medir antes de olhar.** Números baratos (caixa delimitadora, triângulos, bordas tocadas, níveis de alfa) pegam erros que o olho deixa passar, e custam milissegundos.
4. **Etapas explícitas, sem pré-requisito implícito.** Nenhuma etapa executa outra por conta própria; o que falta vira erro, não regeneração.
5. **Produto não é fonte.** Exportar nunca altera a origem, e sobrescrever exige pedido explícito.
6. **O viewport é um cliente que nunca perde o estado.** Câmera, seleção, clipe e tempo sobrevivem a qualquer atualização; erro mantém a última versão boa.
7. **Servidor local pequeno e fechado.** Loopback, lista de `Host` aceitos, sem rota de escrita, identidade verificável, reuso em vez de segunda instância.
8. **Instalar só com um "sim" por comando.** O diagnóstico não muda nada; cada correção é mostrada e confirmada.
9. **Instruções curtas com referências sob demanda.** Um roteador decide qual instrução vale; cada uma declara o que não faz.
10. **Erros com causa e correção.** Mensagens mapeadas a uma tabela "mensagem → causa → conserto" tornam o ciclo do agente convergente.

### 1.2 O que a Lia Forge já tem

Lido em `97c0266`. A Lia Forge está mais avançada em governança do que os três materiais, e menos em visualização e medição.

| Tema | Módulo existente | Estado por leitura |
|---|---|---|
| Inspeção estrutural de GLB | `shared/model3d/glb.mjs` | Lê cabeçalho, malhas, primitivas, triângulos, materiais, imagens, peles, animações, extensões. Não calcula extensão espacial. |
| Conteúdo de PNG | `shared/qa/png-codec.mjs`, `shared/qa/png.mjs` | Decodifica; mede pixels opacos, cobertura e cores únicas. |
| Conteúdo de spritesheet | `shared/qa/spritesheet.mjs`, `electron/spritesheet-manifest.cjs` | Confere grade, pivôs, nomes e se cada quadro declarado tem pixels. |
| Atlas | `shared/imaging/core.mjs` | Empacotamento em grade uniforme. |
| Validadores por passo | `shared/qa/validators.mjs` | Catálogo de validadores acionado por saída de passo. |
| Diagnóstico de ambiente | `shared/qa/preflight.mjs`, `electron/external-tools.cjs` | Descobre ferramentas; "nunca instala"; não medido vira `unknown`. |
| Política HTTP | `shared/http/api-policy.mjs` | `Host`, `Origin`, token, operações exclusivas do IPC. |
| Autorização por execução | `shared/engine/run-authorization.mjs`, `shared/engine/gates.mjs` | Escopo derivado do plano, decisão vinculada por impressão digital. |
| Direitos | `shared/assets/manager.mjs` | Classificação e, segundo o commit `357f50c`, gate. |
| Perfis de destino | `shared/destinations/profiles.mjs` | Adapta manifesto de spritesheet por motor de jogo. |
| Render 3D → 2D | `scripts/blender_spritesheet.py` | Turntable, ações, empacotamento. |
| Viewport 3D | `src/App.jsx` | **Ilustrativo** (SVG/CSS); não há WebGL nem `three` no `package.json`. |
| Skills | `docs/SKILLS-KNOWLEDGE-ENGINE.md`, `.agents/skills/` | Motor `PLANNED`; uma única instrução de marca no checkout. |
| MCP | `scripts/spriteforge-mcp.mjs` | Dez ferramentas. |

### 1.3 Onde estão as oportunidades

| Tipo | Oportunidades (detalhe na §2) |
|---|---|
| **Aprimorar o que existe** | Medidas de PNG (K-10), extensão e orçamento de GLB (K-09), empacotamento compacto e mapa por nome (K-03), relatório com revisão pendente (K-14), diagnóstico com consentimento por comando (K-25), identidade do servidor (K-26) |
| **Completar o que é parcial** | Entrega como produto separado da fonte (K-08), turntable como evidência (K-13), catálogo de erros com correção (K-11), contrato de briefing (K-21) |
| **Criar** | Viewport real (K-15), atualização ao vivo (K-16), preservação de estado (K-17), captura de evidência (K-13), escada de verificação (K-12), Skills próprias (K-20) |
| **Decidir antes de criar** | Geração procedural por código (K-01, K-02), pipeline UV/pintura/animação fora do Blender (K-05 a K-07), cenas de composição (K-18) |
| **Comunicação entre módulos** | Um só contrato de relatório de verificação (K-14) consumido por QA, viewport, MCP e revisão humana; um só evento de "artefato mudou" (K-16) |

---

## 2. Catálogo de capacidades

Cada ficha tem os mesmos dez campos. "Origem" indica em quais materiais a capacidade foi observada e a classe de cada elemento (§0.2). "Existe" refere-se à Lia Forge em `97c0266`.

Ordem: produção (K-01 a K-08), validação e evidência (K-09 a K-14), visualização (K-15 a K-19), agentes e conhecimento (K-20 a K-24), ambiente, segurança e projeto (K-25 a K-31).

---

### A. Produção

#### K-01 — Geração procedural 3D por código, com saída GLB

- **Origem:** A (principal), C. IDEIA: asset como programa reproduzível. PÚBLICO: Three.js, Manifold, glTF 2.0.
- **Problema:** produzir adereços e formas simples sem modelagem manual nem serviço pago, de modo reproduzível e versionável.
- **Como funciona:** um módulo-gerador por asset devolve uma hierarquia de objetos e, opcionalmente, clipes. Três técnicas se combinam: primitivas e extrusões para formas de baixo polígono; operações booleanas sobre sólidos fechados; e campo de distância com sinal convertido em malha por extração de isossuperfície, para volumes orgânicos. O resultado é serializado em GLB.
- **Tecnologias públicas:** Three.js (`BufferGeometry`, extrusão, torno, `GLTFExporter`), Manifold (booleanas e `levelSet`, compilado para WebAssembly), especificação glTF 2.0.
- **Entradas e saídas:** entrada = gerador + parâmetros + unidade e eixos do projeto. Saída = GLB, lista de clipes, medidas.
- **Na Lia Forge:** um **provider** da capability `model3d.generate` (hoje `partial`), executado em página isolada. Não é novo módulo de domínio: entra pelo hub de providers existente.
- **Existe:** `model3d.generate` no registro; nenhum gerador procedural.
- **Melhorar:** tipar a saída do provider com o mesmo relatório de verificação de K-09.
- **Desenvolver:** ambiente de execução isolado (K-27), contrato do gerador, conversão sólido → malha com UV e materiais.
- **Riscos e segurança:** a conversão a partir de sólidos transfere só posições e índices; UV, cores e fronteiras de material precisam de mapeamento explícito. Extração por campo de distância custa caro em resolução alta. Convenções de eixo e de sinal variam entre bibliotecas. O gerador é código: só roda em sandbox, nunca no processo principal.
- **Validar:** gerar três formas de referência (caixa com furo, sólido de revolução, volume orgânico); exigir zero erros no validador glTF, extensão dentro da tolerância e contagem de triângulos abaixo do orçamento; repetir e comparar hash para provar determinismo.

#### K-02 — Geração procedural 2D por código, com saída PNG

- **Origem:** A, B (principal). IDEIA: dois regimes distintos, vetorial e grade de pixels; aleatoriedade com semente; tamanho lógico × escala. PÚBLICO: Canvas 2D, Paper.js, ruído simplex.
- **Problema:** ícones, elementos de interface, tiles e texturas coerentes com um estilo, sem modelo generativo.
- **Como funciona:** o gerador recebe uma superfície de desenho no tamanho final e um índice de quadro. No regime vetorial, formas são construídas por primitivas, caminhos e booleanas, e depois preenchidas e contornadas. No regime de pixel, desenha-se em grade inteira, sem suavização. A rasterização final acontece no navegador.
- **Tecnologias públicas:** API Canvas 2D e `toBlob`; Paper.js (booleanas e deslocamento de caminhos, MIT); ruído simplex; geradores pseudoaleatórios com semente (por exemplo, mulberry32 ou xoshiro, de domínio público).
- **Entradas e saídas:** entrada = gerador, largura, altura, escala, quadros, tokens do tema (K-22). Saída = PNG por asset ou por quadro.
- **Na Lia Forge:** provider de `vfx2d.generate` (já `implemented`) e das capabilities `image2d.pixel-art` e `image2d.tileset` (hoje `planned`).
- **Existe:** `shared/imaging/core.mjs` (composição, recorte, recolorir, contorno) e `shared/vfx/core.mjs`, ambos puros em Node, sem navegador.
- **Melhorar:** os módulos puros já resolvem pixel art sem navegador; acrescentar gerador pseudoaleatório com semente obrigatória e modo "sem suavização" declarado no contrato.
- **Desenvolver:** só se a decisão E-1 (roadmap §2) for positiva: camada vetorial com booleanas.
- **Riscos e segurança:** depender de navegador sem interface para rasterizar é pesado para o hardware-alvo; fontes e imagens externas contaminam o canvas e quebram a exportação; texto embutido em asset é quase sempre erro.
- **Validar:** as medidas de K-10 por asset; teste de determinismo por hash; pixel art deve ter exatamente dois níveis de alfa.

#### K-03 — Atlas e spritesheets

- **Origem:** A (parcial), B (principal). IDEIA: dois modos de empacotamento com critério de escolha; mapa por nome como contrato. PÚBLICO: convenção de mapa de quadros usada por motores 2D; algoritmos de empacotamento de retângulos.
- **Problema:** reunir quadros e imagens num só arquivo com metadados que o motor de jogo consegue ler.
- **Como funciona:** **grade** — todas as células iguais, posição previsível pelo índice, pivô estável entre quadros; indicada para animação e tiles. **Compacto** — retângulos de tamanhos diferentes arranjados para minimizar área; indicado para ícones independentes. Ambos determinísticos. Um JSON acompanha a imagem com dados da folha e um mapa nome → retângulo; animações são intervalos nomeados de quadros.
- **Tecnologias públicas:** algoritmos MaxRects, Skyline e Shelf (descritos em literatura aberta); convenções de atlas de Pixi.js, Phaser, Godot e Unity.
- **Entradas e saídas:** entrada = lista de imagens nomeadas, modo, espaçamento, colunas. Saída = PNG + JSON (folha, quadros por nome, animações).
- **Na Lia Forge:** evolução de `render.atlas` e de `shared/destinations/profiles.mjs`.
- **Existe:** grade uniforme (`packAtlas`), manifesto com grade, pivôs e nomes, adaptação por destino, validação de conteúdo por quadro.
- **Melhorar:** regra explícita "animação e tiles → grade"; acesso por nome como contrato; intervalos de animação nomeados no manifesto, se ainda não houver.
- **Desenvolver:** modo compacto; opção de espaçamento com extrusão de borda para evitar vazamento de cor entre células.
- **Riscos e segurança:** o modo compacto muda posições quando um item entra, então consumidores não podem depender de ordem; sem extrusão de borda há vazamento com filtragem linear.
- **Validar:** propriedades — nenhum retângulo se sobrepõe, todos dentro da folha, mesma entrada gera mesma saída; ida e volta: recortar pelo JSON reproduz as imagens originais bit a bit.

#### K-04 — Pipeline por etapas independentes sobre um artefato de trabalho

- **Origem:** C. IDEIA pura.
- **Problema:** pipelines que "consertam" pré-requisitos sozinhos destroem trabalho manual e escondem o que realmente rodou.
- **Como funciona:** um único artefato de trabalho serializado é a entrada de todas as etapas posteriores. Cada etapa declara o que lê e o que escreve. Regras: nenhuma etapa executa outra; pré-requisito ausente é erro; regenerar a etapa inicial invalida as posteriores e isso é dito antes; edição manual do artefato é entrada válida; existir e ser estruturalmente válido não prova estar atualizado; etapas que escrevem no mesmo artefato rodam em série.
- **Tecnologias públicas:** nenhuma específica; grafo acíclico de passos.
- **Entradas e saídas:** por etapa, um contrato "lê / escreve / invalida".
- **Na Lia Forge:** é exatamente o papel de `shared/engine/dag.mjs` e do planner. Não criar módulo novo: acrescentar ao contrato de passo os campos "invalida" e "exige explicitamente".
- **Existe:** DAG, gates, estados de execução.
- **Melhorar:** tornar "nunca executar pré-requisito ausente" uma propriedade testada do motor; registrar no plano o que cada passo invalida. Fecha a lacuna G-01 da revisão (capabilities com entrada e saída em texto livre).
- **Desenvolver:** marcador "etapa finalizada manualmente" que o planner respeita.
- **Riscos e segurança:** sem assinatura de frescor, o usuário pode entregar algo desatualizado; a Lia Forge pode fazer melhor com hash de conteúdo por artefato (roadmap P1 da revisão).
- **Validar:** teste do motor em que um pré-requisito falta e nenhum processo é iniciado; teste em que regenerar a etapa 1 marca as etapas 2 e 3 como desatualizadas sem executá-las.

#### K-05 — Desdobramento e empacotamento automático de UV

- **Origem:** C. IDEIA: densidade de texel por região, folga entre ilhas, modo "cartas" para pixel art. PÚBLICO: algoritmos de empacotamento; Blender Smart UV Project e empacotamento de ilhas; biblioteca xatlas.
- **Problema:** dar a um modelo coordenadas de textura utilizáveis sem intervenção manual.
- **Como funciona:** faces são agrupadas em ilhas, cada ilha recebe área proporcional a uma densidade, as ilhas são arranjadas num quadrado com folga. Para pixel art, faces vizinhas compartilham uma grade contínua de texels e as coordenadas caem em inteiros.
- **Tecnologias públicas:** operadores de UV do Blender (acessíveis por `bpy`), xatlas (MIT), MaxRects e Shelf.
- **Entradas e saídas:** entrada = malha, densidade, folga, modo. Saída = malha com `TEXCOORD_0`, dimensões do atlas.
- **Na Lia Forge:** capability `model3d.uv` (hoje `planned`), atendida pelo **adapter Blender**, que já é a ferramenta de autoria. Não reimplementar empacotador.
- **Existe:** nada além do id no registro.
- **Melhorar:** não se aplica.
- **Desenvolver:** job de UV no Blender Bridge; verificação pós-etapa (abaixo).
- **Riscos e segurança:** folga menor que a dilatação de borda causa vazamento; ilhas degeneradas em densidade baixa.
- **Validar:** toda primitiva tem `TEXCOORD_0`; coordenadas em [0, 1]; nenhuma sobreposição de ilhas acima de um limiar; folga mínima respeitada.

#### K-06 — Pintura procedural de textura e variantes

- **Origem:** C. IDEIA: pintar sobre UV existente; variantes de textura sobre o mesmo desdobramento; modo de render (texel duro ou suave) como propriedade do asset, não da receita. PÚBLICO: projeção triplanar, dilatação de borda, ruído procedural.
- **Problema:** texturizar sem pintura manual e sem modelo generativo; produzir variações (expressões, cores) sem refazer UV.
- **Como funciona:** a pintura seleciona regiões do modelo por nome, aplica campos procedurais e marcas, e projeta em espaço de textura. Depois dilata as bordas das ilhas para evitar costuras. Variantes são texturas diferentes registradas contra o mesmo modelo; só uma é a ativa.
- **Tecnologias públicas:** nós de textura procedural e bake do Blender; NumPy e Pillow; técnicas descritas em literatura de computação gráfica.
- **Entradas e saídas:** entrada = modelo com UV, receita de pintura, tokens de tema, nome da variante. Saída = PNG, registro da variante.
- **Na Lia Forge:** `model3d.texture` e `model3d.bake` (`planned`) pelo adapter Blender; o conceito de **variante** pertence ao domínio (`AssetVersion` ou equivalente), não ao adapter.
- **Existe:** modularidade de personagem (`character.modularity`) em 2D.
- **Melhorar:** levar "variante sobre mesma base" ao contrato de asset 3D.
- **Desenvolver:** job de bake no Bridge; registro de variantes.
- **Riscos e segurança:** dilatação maior que a folga das ilhas; variante não ativa tornar-se ativa por acidente.
- **Validar:** dimensões da textura compatíveis com o UV; ausência de pixels transparentes dentro das ilhas; trocar de variante não altera os bytes do modelo.

#### K-07 — Animação procedural com verificação numérica

- **Origem:** C. IDEIA: cinemática direta para movimento rotacional, inversa só quando algo precisa tocar ou mirar um ponto, e sempre convertida em chaves simples; inspecionar o movimento por números além de imagens. PÚBLICO: cinemática inversa analítica de dois ossos, animação glTF.
- **Problema:** criar ciclos (parado, andar) e detectar defeitos de movimento que uma imagem estática não mostra.
- **Como funciona:** descobre-se primeiro o que é animável (controles, eixos locais, comprimentos). Clipes são conjuntos de chaves por controle. Cadeias com cinemática inversa são resolvidas e gravadas como rotações. Uma inspeção amostra o clipe em alta frequência e relata cortes de velocidade angular, trancos na ponta da cadeia, estalos perto do alcance máximo e inversões.
- **Tecnologias públicas:** sistema de ações e restrições do Blender; canais e amostradores de animação do glTF 2.0.
- **Entradas e saídas:** entrada = modelo com esqueleto, descrição do clipe. Saída = clipes nomeados com modo de repetição; relatório de inspeção.
- **Na Lia Forge:** `motion.cycles` e `validateAnimationLoop` já existem; a novidade é o **relatório numérico de continuidade**.
- **Existe:** validação de laço de animação; correspondência de ações no script de render.
- **Melhorar:** estender a validação de laço com descontinuidade de velocidade entre o último e o primeiro quadro.
- **Desenvolver:** amostrador de animação glTF puro (lê canais, interpola, devolve poses) — útil também para o viewport (K-15).
- **Riscos e segurança:** regenerar geometria apaga clipes; clipes só devem substituir os que a etapa declara.
- **Validar:** clipe de referência com tranco conhecido deve ser sinalizado; clipe suave não; laço fechado com erro abaixo de limiar.

#### K-08 — Entrega: produto separado da fonte

- **Origem:** A, C. IDEIA pura.
- **Problema:** exportações que sobrescrevem fontes, misturam intermediários com entregáveis ou deixam arquivos pela metade.
- **Como funciona:** fonte, variante e produto são identidades distintas. Um produto é uma cópia imutável num caminho escolhido dentro de uma raiz de entrega. Regras: exportar não executa etapas anteriores nem muda a fonte; substituir exige pedido explícito; fontes e receitas não podem ser alvo; a escrita é atômica (arquivo temporário e troca); é possível selecionar partes, clipes e variante; produtos repetidos ficam descritos num manifesto de alvos.
- **Tecnologias públicas:** troca atômica de arquivos do sistema operacional; glTF.
- **Entradas e saídas:** entrada = asset, seleção (partes, clipes, variante), alvo. Saída = produto + registro de proveniência.
- **Na Lia Forge:** evolução de `exportRun` em `shared/services/studio-service.mjs` e de `export.engine`.
- **Existe:** exportação com perfis de destino; gate de direitos.
- **Melhorar:** escrita atômica; recusa de sobrescrita sem pedido; proibição de exportar sobre fonte.
- **Desenvolver:** seleção de partes e de clipes na exportação de GLB.
- **Riscos e segurança:** confinamento de caminho após resolver links (K-26); exportar parte de um modelo precisa preservar esqueleto e transformações ancestrais.
- **Validar:** exportar e comparar o hash da fonte antes e depois; tentar sobrescrever sem a opção e esperar erro; interromper no meio e não achar arquivo parcial.

---

### B. Validação e evidência

#### K-09 — Validação técnica de GLB em duas camadas

- **Origem:** A (principal), C. IDEIA: validar bytes e depois reabrir e medir; limites declarados por asset. PÚBLICO: glTF-Validator da Khronos (Apache-2.0), `GLTFLoader`.
- **Problema:** um GLB pode ser estruturalmente aceito e ainda ser inútil (vazio, com valores não finitos, fora de escala, sem o clipe pedido).
- **Como funciona:** **camada 1**, conformidade — o validador oficial devolve erros, avisos e informações; qualquer erro reprova, avisos são guardados para leitura. **Camada 2**, aptidão — o arquivo gravado é reaberto e medido: geometria não vazia, todos os valores finitos, triângulos, extensão nos três eixos, nomes dos clipes. Compara-se com limites declarados para aquele asset: orçamento de triângulos, extensão esperada com tolerância, clipes obrigatórios.
- **Tecnologias públicas:** glTF-Validator (pacote npm, sem dependências transitivas); mínimos e máximos dos acessores de posição no próprio glTF.
- **Entradas e saídas:** entrada = bytes do GLB + limites do asset. Saída = relatório (K-14).
- **Na Lia Forge:** evolução direta de `shared/model3d/glb.mjs` e de `validateGlbStructural`. É o "perfil GLB" do roadmap P1 da revisão.
- **Existe:** inspeção estrutural própria, sem dependência.
- **Melhorar:** calcular extensão a partir dos acessores (e, com transformações de nó, a caixa em espaço de mundo); checar valores finitos; aceitar limites por asset.
- **Desenvolver:** integração opcional do validador oficial como segunda opinião (decisão de dependência: roadmap E-5).
- **Riscos e segurança:** zero erros no validador não prova que o destino importa bem; arquivos enormes precisam de limite de tamanho antes de decodificar.
- **Validar:** conjunto de fixtures defeituosas — truncado, comprimento declarado errado, `NaN` em posição, sem malha, triângulos acima do orçamento, clipe ausente — cada uma reprovando com código próprio.

#### K-10 — Medição de PNG e de sprites

- **Origem:** A (básico), B (principal). IDEIA pura; as medidas são contagens triviais sobre pixels.
- **Problema:** um sprite pode parecer certo e estar cortado, ter borda suave onde se exigia dura, ou usar mais cores que a paleta.
- **Como funciona:** seis medidas sobre a imagem decodificada: (1) menor retângulo com alfa maior que zero; (2) quais lados da tela o conteúdo toca; (3) fração de pixels totalmente transparentes; (4) se todo alfa é 0 ou 255; (5) quantos níveis de alfa distintos; (6) quantas cores distintas entre os pixels opacos. Cada medida tem uma leitura: tocar borda sugere corte; pixel art deve ter dois níveis de alfa; cores muito acima da paleta indicam erro.
- **Tecnologias públicas:** especificação PNG.
- **Entradas e saídas:** entrada = PNG + tipo esperado (sprite, fundo, pixel art, tile). Saída = medidas + achados.
- **Na Lia Forge:** extensão de `analyzePngContent`.
- **Existe:** pixels opacos, cobertura, cores únicas, `alphaBounds`.
- **Melhorar:** acrescentar lados tocados, bordas duras, níveis de alfa; associar expectativas ao tipo do asset.
- **Desenvolver:** nada novo; é extensão.
- **Riscos e segurança:** limitar dimensões antes de decodificar; cores únicas em imagens grandes precisa de amostragem declarada (já existe o indicador).
- **Validar:** fixtures sintéticas de 8×8 com resultado conhecido para cada medida.

#### K-11 — Validação de malha e catálogo de erros com correção

- **Origem:** C. IDEIA: invariantes de malha e tabela "mensagem → causa → conserto". PÚBLICO: definições de variedade, orientação e convexidade.
- **Problema:** agentes e pessoas travam em mensagens de erro que não dizem o que mudar.
- **Como funciona:** a malha é checada contra invariantes: faces convexas, malha fechada sem arestas de borda, orientação consistente para fora, sem autointerseção, sem faces coplanares sobrepostas entre elementos. Cada erro tem código estável, nomeia o elemento, lista as alternativas válidas quando há, e está numa tabela com causa provável e correção.
- **Tecnologias públicas:** operadores de limpeza e de estatística de malha do Blender; topologia de malhas.
- **Entradas e saídas:** entrada = malha. Saída = lista de achados com código, severidade, elemento e correção sugerida.
- **Na Lia Forge:** o padrão de **catálogo de erros** vale para todos os validadores de `shared/qa/validators.mjs` e para os bloqueios do preflight, não só para malha.
- **Existe:** validadores com mensagens; preflight com "ação de usuário explícita e nomeada".
- **Melhorar:** código estável por achado e campo de correção em todos os validadores.
- **Desenvolver:** checagens de topologia via job do Blender, se a decisão for manter a autoria nele.
- **Riscos e segurança:** autointerseção é cara; rodar sob demanda.
- **Validar:** uma fixture por código de erro; teste que falha se um código não tiver entrada no catálogo.

#### K-12 — Escada de verificação

- **Origem:** B. IDEIA pura.
- **Problema:** verificar demais desperdiça tempo; verificar de menos entrega defeitos; relatar "verificado" sem dizer como engana.
- **Como funciona:** degraus em ordem crescente de custo — (1) compila ou é estruturalmente válido; (2) foi exportado e o arquivo existe; (3) foi medido e os números batem; (4) foi olhado; (5) foi visto em contexto. Sobe-se só até onde a mudança exige. O relato final lista cada degrau como executado, com resultado, ou não executado, com motivo.
- **Tecnologias públicas:** nenhuma.
- **Entradas e saídas:** entrada = artefato e natureza da mudança. Saída = lista ordenada de degraus com estado.
- **Na Lia Forge:** é a forma do relatório de QA de um passo e a base da distinção `IMPLEMENTED` / `EXECUTED` / `VALIDATED` que o projeto já usa em documentos.
- **Existe:** validadores por saída de passo; revisão humana gravada como proveniência.
- **Melhorar:** tornar "não executado, motivo" um estado de primeira classe no relatório, em vez de ausência.
- **Desenvolver:** nada novo; é contrato (K-14).
- **Riscos e segurança:** nenhum degrau automático substitui o 4 e o 5.
- **Validar:** teste de contrato — relatório sem um dos degraus é inválido.

#### K-13 — Captura de evidências sem interface

- **Origem:** A, B, C (mais completa). IDEIA: prontidão explícita; vistas padronizadas; captura em instante de animação. PÚBLICO: automação de navegador, render do Blender.
- **Problema:** dar ao revisor (pessoa ou agente) imagens comparáveis do que foi realmente entregue, sem depender de alguém abrir a interface.
- **Como funciona:** a página de visualização sinaliza "pronto" ou "erro" de forma explícita; a captura espera esse sinal em vez de um tempo fixo. Modos observados: vista única; folha de quatro vistas (frente, lado, costas, três quartos); render sem textura para julgar forma; aramado; sem iluminação; clipe num instante ou numa lista de instantes; imagem de referência lado a lado; fundo transparente. Erros da página reprovam a captura.
- **Tecnologias públicas:** Electron (`capturePage`, janela oculta), Playwright, render em segundo plano do Blender.
- **Entradas e saídas:** entrada = asset, vista, clipe, instante, modo. Saída = PNG + metadados (vista, instante, hash do asset).
- **Na Lia Forge:** dois caminhos sem dependência nova. (a) O Blender já renderiza turntable: reutilizar como evidência. (b) Quando houver viewport (K-15), capturar pela janela oculta do próprio Electron.
- **Existe:** turntable no script de render; `render.turntable` como `partial`.
- **Melhorar:** tratar as vistas do turntable como artefatos de evidência ligados à versão do asset.
- **Desenvolver:** modo "forma" (sem textura) no job de render; captura pelo viewport.
- **Riscos e segurança:** a captura não é aprovação estética; a página capturada deve ser a mesma que o usuário vê; uma instância de captura deve ter escopo próprio e não interferir na sessão do usuário.
- **Validar:** capturar um cubo de referência nas quatro vistas e comparar com imagens esperadas dentro de tolerância; forçar erro de carga e esperar reprovação.

#### K-14 — Relatório de verificação com revisão humana pendente

- **Origem:** A. IDEIA pura.
- **Problema:** confundir verificação automática com aprovação.
- **Como funciona:** por asset, um registro com: identidade, caminho, estado técnico (aprovado ou reprovado), medidas, número de avisos, caminhos das evidências e um campo de revisão visual que **nasce pendente**. Só uma decisão humana registrada muda esse campo. O código de saída da verificação reflete só o estado técnico.
- **Tecnologias públicas:** JSON.
- **Entradas e saídas:** entrada = resultados de K-09, K-10, K-13. Saída = relatório único.
- **Na Lia Forge:** este é o contrato que une QA, viewport, MCP e revisão. Corresponde a `ValidationResult` e `HumanReview` do núcleo mínimo de contratos recomendado na revisão (DEC-03).
- **Existe:** revisão humana como proveniência (commits `1ec516a`, `d338f98`); `validated` derivado de evidência (commit `357f50c`).
- **Melhorar:** um só formato de relatório para todos os validadores, com degraus (K-12), códigos (K-11) e evidências (K-13).
- **Desenvolver:** esquema versionado do relatório.
- **Riscos e segurança:** o relatório não pode ser gravável por ferramenta de agente sem passar pelo fluxo de revisão.
- **Validar:** teste de contrato; teste de que nenhuma rota automática consegue gravar a revisão como aprovada.

---

### C. Visualização

#### K-15 — Viewport 3D e inspetor

- **Origem:** A, C. IDEIA: três painéis (biblioteca, palco, inspetor); enquadramento pela caixa do objeto; descarte explícito de recursos. PÚBLICO: Three.js.
- **Problema:** ver o GLB real dentro do produto, com as informações que um artista precisa para aceitar ou recusar.
- **Como funciona:** carrega o GLB, calcula a caixa delimitadora, posiciona a câmera a uma distância proporcional ao maior lado e ajusta os planos de corte. Ao trocar de asset, libera geometrias, materiais e texturas do anterior. O inspetor tem abas: animações (busca, duração, tocar por linha, transporte com linha do tempo, velocidade, repetição, pose base), hierarquia (subárvores sob demanda, dados do nó selecionado) e visual (aparência, câmera, imagem de referência). Um modo de foco esconde os painéis.
- **Tecnologias públicas:** Three.js (`GLTFLoader`, `OrbitControls`, `AnimationMixer`, `Box3`), WebGL 2.
- **Entradas e saídas:** entrada = `View3DSession` (asset, versão, clipe inicial). Saída = `View3DSessionReport` (o que carregou, medidas, erros).
- **Na Lia Forge:** é a viewport Fase 1 já descrita em `docs/threejs-3d-environment/`. Este estudo não cria nada novo: fornece requisitos de comportamento.
- **Existe:** viewport ilustrativa; contratos `View3DSession` propostos nos documentos Three.js; `three` ausente das dependências.
- **Melhorar:** acrescentar aos requisitos da Fase 1 o descarte explícito, o estado vazio quando nenhum asset é escolhido, e as medidas do inspetor vindas do mesmo código de K-09.
- **Desenvolver:** a própria viewport.
- **Riscos e segurança:** vazamento de memória de GPU sem descarte; GLB hostil (tamanho, extensões) deve ser barrado por K-09 antes de chegar ao renderer; política de conteúdo da janela.
- **Validar:** abrir e fechar cem vezes e medir memória; fixtures F1 a F5 já previstas nos documentos Three.js; teste em Chromium real.

#### K-16 — Atualização ao vivo

- **Origem:** A (eventos enviados pelo servidor), B e C (sondagem coordenada). IDEIA pura.
- **Problema:** o usuário reexporta e quer ver o resultado sem recarregar nem perder o que estava fazendo.
- **Como funciona:** quatro peças. (1) **Detecção**: uma assinatura barata por arquivo (data de modificação e tamanho) ou uma revisão opaca do catálogo. (2) **Transporte**: evento do servidor para o cliente, ou sondagem que nunca sobrepõe duas execuções e reexecuta imediatamente se houve pedido durante a anterior. (3) **Amortecimento**: espera curta para agrupar rajadas; nova tentativa se o arquivo ainda estava sendo gravado. (4) **Corrida**: cada carga recebe um número de geração; resultado de geração antiga é descartado e seus recursos liberados. Em erro, a última versão boa continua na tela com a mensagem. Só o asset atual recarrega; escritas de relatório não disparam recarga.
- **Tecnologias públicas:** `EventSource`, `AbortController`, `fs.watch`, IPC do Electron.
- **Entradas e saídas:** entrada = evento "artefato X mudou para a versão Y". Saída = viewport atualizada ou erro não destrutivo.
- **Na Lia Forge:** no Electron não é preciso servidor HTTP: o processo principal já sabe quando um passo grava um artefato e pode emitir um evento IPC. O evento deve vir do **armazenamento de artefatos**, não de observação de disco.
- **Existe:** estados de execução; lista de execuções na interface.
- **Melhorar:** um evento único "artefato mudou" consumido por viewport, lista de assets e MCP.
- **Desenvolver:** o evento e o cliente com descarte por geração.
- **Riscos e segurança:** laços de recarga; ler arquivo pela metade; a navegação explícita do usuário sempre vence a atualização automática.
- **Validar:** disparar dez mudanças em cem milissegundos e esperar uma só recarga; corromper o arquivo e verificar que a versão anterior permanece; trocar de asset durante uma carga e verificar que a carga antiga é descartada.

#### K-17 — Preservação de câmera e de estado

- **Origem:** A, C. IDEIA pura.
- **Problema:** perder enquadramento, clipe e instante a cada atualização torna a revisão iterativa inviável.
- **Como funciona:** o estado da sessão é guardado fora do objeto carregado: câmera completa (posição, alvo, zoom, tipo de projeção), asset selecionado, modo de exibição, clipe, tempo, velocidade, tocando ou pausado. Regra: recarregar o **mesmo** asset restaura tudo; trocar de asset reenquadra. Trocar de clipe mantém o estado de reprodução; arrastar a linha do tempo pausa e só retoma se estava tocando. A seleção também vai para o endereço da página, o que permite abrir direto num asset e capturar um estado específico.
- **Tecnologias públicas:** nenhuma específica.
- **Entradas e saídas:** entrada = instantâneo de estado. Saída = estado restaurado após recarga.
- **Na Lia Forge:** campos de `View3DOverrides` e do relatório de sessão, já previstos nos documentos Three.js.
- **Existe:** só a proposta de contrato.
- **Melhorar:** explicitar no contrato a regra "mesmo asset restaura, outro asset reenquadra".
- **Desenvolver:** junto com K-15.
- **Riscos e segurança:** se a nova versão muda muito de tamanho, a câmera antiga pode ficar dentro do objeto; prever reenquadramento quando a caixa muda além de um fator.
- **Validar:** teste automatizado que lê a posição da câmera antes e depois de uma recarga do mesmo asset e exige igualdade; idem para clipe e tempo.

#### K-18 — Cenas de composição e prévias fora do oficial

- **Origem:** B, C. IDEIA pura.
- **Problema:** julgar escala, espaçamento e estados (normal, pressionado) exige ver vários assets juntos; e rótulos de teste não podem vazar para o entregável.
- **Como funciona:** uma cena de composição é uma página livre que posiciona assets do projeto, nunca é ela própria um asset e nunca é entregue. Ela consome os arquivos já exportados e se atualiza quando eles mudam. Separadamente, uma **prévia** é uma exportação marcada como não oficial, gravada em outra pasta, que nunca sobrescreve nem é copiada para o destino.
- **Tecnologias públicas:** HTML, Three.js.
- **Entradas e saídas:** entrada = lista de assets com posição, rotação, escala, clipe. Saída = imagem de composição (evidência do degrau 5 de K-12).
- **Na Lia Forge:** primeiro, a noção de **prévia não oficial** no armazenamento de artefatos. A cena de composição é P3.
- **Existe:** nada equivalente.
- **Melhorar:** não se aplica.
- **Desenvolver:** marca de "prévia" em artefato; mais tarde, uma cena declarativa (lista de assets e transformações), não uma página de código livre.
- **Riscos e segurança:** página de código livre na mesma origem do visualizador é código confiável por definição; a Lia Forge deve preferir cena declarativa.
- **Validar:** exportar prévia e verificar que nenhum arquivo oficial mudou de hash.

#### K-19 — Ver a fonte ou ver o arquivo entregue

- **Origem:** A. IDEIA pura.
- **Problema:** a prévia do gerador pode diferir do arquivo gravado (materiais não portáveis, clipes não exportados).
- **Como funciona:** o visualizador tem três modos — automático (mostra o arquivo se existir, senão a fonte), fonte, arquivo. A verificação técnica sempre usa o arquivo.
- **Tecnologias públicas:** nenhuma.
- **Entradas e saídas:** entrada = modo. Saída = indicação visível do que está sendo mostrado.
- **Na Lia Forge:** a viewport deve sempre dizer **qual versão de qual artefato** está na tela; se um dia houver prévia de gerador, o rótulo "não é o entregável" é obrigatório.
- **Existe:** não se aplica ainda.
- **Melhorar e desenvolver:** rótulo de proveniência no palco da viewport.
- **Riscos:** aprovar olhando para a coisa errada.
- **Validar:** teste de interface — o rótulo corresponde ao hash carregado.

---

### D. Agentes e conhecimento

#### K-20 — Skills: formato, roteamento e limites

- **Origem:** A, B, C. IDEIA: instrução curta com referências sob demanda; roteador; ordem de autoridade; regras de rejeição; critérios de qualidade; contrato de delegação. PROPRIETÁRIO: os textos das instruções — não reproduzidos.
- **Problema:** dar a um agente conhecimento especializado sem inflar o contexto e sem lhe dar poderes.
- **Como funciona:** cada instrução tem um cabeçalho com nome e descrição de quando usar, um corpo curto e arquivos de referência lidos só quando necessários. Padrões recorrentes: (1) um **roteador** mapeia "o que o usuário quer" para a instrução certa e fixa regras transversais; (2) cada instrução declara o que **não** cobre; (3) uma **ordem de autoridade** resolve conflitos — pedido do usuário, depois tema do projeto, depois documento de estilo, depois regras gerais, depois referência de API; (4) **regras de rejeição** listam padrões proibidos; (5) **critérios de qualidade** poucos e nomeados; (6) a **delegação** a subagente leva projeto, asset, etapa pedida, restrições e produtos esperados, e o subagente devolve o que mudou e o que faltou, sem refazer pré-requisitos; (7) "faça a menor etapa que satisfaz o pedido"; (8) "não confie na memória para assinaturas, leia a referência".
- **Tecnologias públicas:** convenção aberta de arquivos de instrução com cabeçalho YAML; `AGENTS.md`.
- **Entradas e saídas:** entrada = pedido e contexto do projeto. Saída = escolha de instrução e plano de passos.
- **Na Lia Forge:** alimenta o `SKILLS-KNOWLEDGE-ENGINE.md` (`PLANNED`), que já define que uma Skill nunca autoriza nada por si só. Os padrões acima entram como requisitos de formato.
- **Existe:** manifesto de Skill proposto; uma Skill de marca.
- **Melhorar:** acrescentar ao manifesto proposto os campos "não cobre", "autoridade" e "contrato de delegação".
- **Desenvolver:** as Skills próprias (lista no roadmap §6), escritas do zero sobre as capabilities da Lia Forge.
- **Riscos e segurança:** instruções dos materiais mandam o agente instalar software e pesquisar na rede; na Lia Forge isso só existe como pedido de autorização. Instrução em texto é convenção, não mecanismo: a fronteira real são os gates.
- **Validar:** para cada Skill, um caso de teste "pedido → instrução escolhida → capabilities invocadas"; verificação estática de que nenhuma Skill cita comando de instalação ou rede fora do fluxo de autorização.

#### K-21 — Contrato de briefing e de entrega de asset

- **Origem:** A. IDEIA pura.
- **Problema:** o pedido de um asset chega sem as informações que tornam a entrega verificável.
- **Como funciona:** por asset, o briefing registra: identificador estável, aparência ou referência, dimensões e origem, unidade e eixos (para cima e para frente), forma de entrega (arquivo ou implementação no destino, esta última com motivo concreto), técnica escolhida com justificativa e destino. Itens opcionais só quando relevantes: clipes, transparência, costuras, pontos de encaixe, orçamento de geometria. A aceitação reabre o arquivo final e reporta caminhos, como regenerar, evidências e falhas.
- **Tecnologias públicas:** nenhuma.
- **Entradas e saídas:** entrada = pedido do usuário. Saída = briefing estruturado; os limites de K-09 e K-10 derivam dele.
- **Na Lia Forge:** é a entrada do planner. Os limites declarados aqui viram parâmetros dos validadores.
- **Existe:** etapa de direção de arte e `brief.md` nos fluxos; `shared/ui/journey.mjs`.
- **Melhorar:** estruturar a parte verificável do briefing (dimensões, eixos, orçamento, clipes) como dados, mantendo a parte descritiva em texto.
- **Desenvolver:** esquema do briefing verificável.
- **Riscos:** briefing obrigatório demais vira burocracia; só os campos que alimentam validação devem ser exigidos.
- **Validar:** um briefing gera automaticamente o conjunto de limites; alterar um limite muda o resultado da verificação.

#### K-22 — Tema do projeto como dados e documento de estilo

- **Origem:** B, C. IDEIA pura.
- **Problema:** manter coerência visual entre assets feitos em momentos diferentes.
- **Como funciona:** o projeto tem um conjunto de **tokens** (paleta, rampas de cor, padrões de traço, materiais) consumidos por todos os geradores, e, opcionalmente, um documento em texto com o que os tokens não expressam (resolução, tratamento de borda, camadas, movimento). Dois fluxos: estilo primeiro, ou tema primeiro. Cor escrita à mão num asset é motivo de rejeição. Exploração de variações só acontece a pedido, numa área temporária, e o estilo só é fixado depois da escolha.
- **Tecnologias públicas:** formatos de tokens de design.
- **Entradas e saídas:** entrada = direção de arte. Saída = tokens + documento; a contagem de cores de K-10 é comparada com a paleta.
- **Na Lia Forge:** "perfil visual" já está no roadmap P3 da revisão. Este estudo acrescenta que o perfil deve ser **verificável** (paleta como limite de K-10).
- **Existe:** direção de arte como etapa.
- **Melhorar e desenvolver:** tokens de paleta por projeto ligados ao validador de PNG.
- **Riscos:** fixar estilo cedo demais.
- **Validar:** asset com cor fora da paleta é sinalizado.

#### K-23 — Documentação gerada e testes de documentação

- **Origem:** B, C. IDEIA pura.
- **Problema:** a documentação que o agente lê diverge do código.
- **Como funciona:** a referência de API é gerada a partir do código; um teste compila os exemplos dos guias contra o código; outro teste garante que projetos só importam das entradas públicas e que as entradas públicas não exportam caminhos internos. Guias explicam **quando** usar; a referência dá o **como**.
- **Tecnologias públicas:** geradores de documentação e verificadores de tipo.
- **Entradas e saídas:** entrada = código. Saída = referência + testes.
- **Na Lia Forge:** aplica-se ao registro de capabilities e ao SDK de adapters: a lista de capabilities nos documentos deve ser gerada do registro. Isso elimina a classe de divergência achada na revisão (ids de capability citados em documentos e inexistentes no registro).
- **Existe:** registro em `shared/capabilities/registry.mjs`; documentos escritos à mão.
- **Melhorar:** gerar a tabela de capabilities; teste que falha se um documento citar id inexistente.
- **Desenvolver:** o gerador e o teste (o cruzamento já foi feito manualmente na revisão).
- **Riscos:** nenhum relevante.
- **Validar:** introduzir um id falso num documento e ver o teste falhar.

#### K-24 — Interface de linha de comando legível por máquina

- **Origem:** A, B, C. IDEIA pura.
- **Problema:** agentes interpretam saída de texto livre e erram.
- **Como funciona:** todo comando de leitura tem saída JSON; códigos de saída são estáveis e documentados (por exemplo, zero sem diferenças, um com diferenças, dois falha); comandos de criação recusam sobrescrever; há comandos de leitura dedicados (listar, inspecionar, estado) separados dos que escrevem.
- **Tecnologias públicas:** nenhuma.
- **Entradas e saídas:** entrada = comando. Saída = JSON com esquema.
- **Na Lia Forge:** vale para as ferramentas MCP: separar ferramentas de leitura das de escrita é a decisão DEC-12 da revisão.
- **Existe:** dez ferramentas MCP, com leitura e escrita misturadas.
- **Melhorar:** esquema de saída por ferramenta; ferramentas de leitura primeiro.
- **Desenvolver:** ferramenta MCP de leitura do relatório de verificação (K-14).
- **Riscos:** ferramenta de escrita marcar etapa como concluída (achado C-07 da revisão).
- **Validar:** teste de contrato por ferramenta.

---

### E. Ambiente, segurança e projeto

#### K-25 — Diagnóstico de ambiente e instalação com consentimento

- **Origem:** C (principal), B. IDEIA pura. Contraexemplo em A, que instala sem perguntar.
- **Problema:** preparar a máquina sem instalar nada às escondidas.
- **Como funciona:** um diagnóstico **que não altera nada** lista cada item (obrigatório ou opcional), seu estado e o comando exato que o corrige. Um modo separado percorre os itens com falha e, para cada um, mostra o comando e pede confirmação; sem terminal interativo, a resposta padrão é não. Itens que não podem ser instalados em silêncio são encaminhados ao usuário. Um modo de fumaça inicia de fato o componente crítico. A regra para agentes: dizer o comando e o que ele baixa, pedir permissão, rodar só o que foi aprovado, nunca instalar "por garantia".
- **Tecnologias públicas:** nenhuma.
- **Entradas e saídas:** entrada = requisitos por capability. Saída = relatório com estado e correção por item.
- **Na Lia Forge:** `shared/qa/preflight.mjs` já tem a regra dura "nunca instala". Falta o **segundo tempo**: consentimento por ação, registrado.
- **Existe:** preflight, descoberta de ferramentas externas, autorização por execução.
- **Melhorar:** cada bloqueio do preflight carrega a ação exata e o que ela baixa; a confirmação gera um registro de consentimento (`ConsentRecord`).
- **Desenvolver:** modo de fumaça por ferramenta (por exemplo, iniciar o Blender com `--version` e medir).
- **Riscos e segurança:** scripts de instalação de terceiros rodam com os privilégios do usuário; versões devem ser fixadas; o consentimento vale para um comando, não para uma categoria.
- **Validar:** teste em que nenhuma confirmação é dada e nenhum processo é iniciado; teste de que o registro de consentimento contém o comando literal.

#### K-26 — Servidor local seguro

- **Origem:** A, B, C. IDEIA pura.
- **Problema:** um servidor local de prévia é alcançável por qualquer página aberta no navegador do usuário.
- **Como funciona:** nove medidas observadas, somando os três materiais. (1) Escutar só em loopback. (2) Aceitar apenas `Host` igual a um nome de loopback na porta do próprio servidor, respondendo 403 ao resto — defesa contra religação de DNS. (3) Nenhuma rota de escrita. (4) Confinar todo caminho à raiz permitida **depois** de resolver links simbólicos. (5) Rota de saúde com identidade: protocolo, versão, instância, espaço de trabalho, escopo e revisão do código do servidor. (6) Reusar um servidor do mesmo espaço de trabalho em vez de abrir outro; nunca adotar um de outro espaço, modo ou protocolo; recusar um processo antigo após atualização do código. (7) Porta preferida com alternativas; porta explícita é estrita; nunca encerrar o processo de outro. (8) Não permitir reuso de endereço, para que duas instâncias não dividam a porta. (9) Escopo por projeto: pedido fora do escopo recebe 403; dado corrompido recebe 500, não 403.
- **Tecnologias públicas:** HTTP; documentação pública sobre religação de DNS.
- **Entradas e saídas:** entrada = requisição. Saída = resposta ou recusa com código correto.
- **Na Lia Forge:** `shared/http/api-policy.mjs` já cobre `Host`, `Origin` e token, e o commit `97c0266` trata do bind. Faltam, pela leitura, a identidade do servidor e a regra de reuso.
- **Existe:** itens 1 e 2, e token (que os materiais não têm).
- **Melhorar:** itens 4 (confinamento pós-resolução, apontado como R-05 na revisão), 5 e 6.
- **Desenvolver:** rota de saúde com identidade e revisão.
- **Riscos e segurança:** servidor sem escrita ainda expõe leitura; no aplicativo empacotado, o HTTP deve ficar desligado e o IPC ser o único canal (DEC-06).
- **Validar:** requisição com `Host` externo recebe 403; caminho com link simbólico para fora recebe recusa; segunda instância reutiliza a primeira; instância de outro espaço não é adotada.

#### K-27 — Execução de código gerado por agente

- **Origem:** A (no navegador), B (navegador e Node), C (no sistema, sem isolamento). IDEIA: a escolha do local de execução é a decisão de segurança.
- **Problema:** "asset como código" significa executar código escrito por um agente.
- **Como funciona:** três modelos observados. No primeiro, o gerador roda dentro de uma página que só alcança o servidor local; o próprio material adverte que isso **não é fronteira de isolamento para código não confiável**. No segundo, parte roda na página e parte no ambiente de execução do sistema. No terceiro, cada receita é um programa executado com os privilégios do usuário; a contenção é só uma regra em texto para o agente.
- **Tecnologias públicas:** `iframe` com `sandbox`, política de segurança de conteúdo, Web Workers, janela do Electron com isolamento de contexto e sem integração com Node, sessão sem rede.
- **Entradas e saídas:** entrada = código + parâmetros. Saída = bytes do artefato por um canal estreito.
- **Na Lia Forge:** se a geração procedural for adotada (E-1), a única forma aceitável é a página isolada: janela oculta com `sandbox`, sem Node, sem rede, com política de conteúdo restritiva, recebendo só dados e devolvendo só bytes por mensagem. Código no sistema é incompatível com os princípios de permissão.
- **Existe:** janelas com isolamento de contexto e `sandbox: true`; guarda dentro do script do Blender.
- **Melhorar:** não se aplica.
- **Desenvolver:** o executor isolado e seus limites (tempo, memória, tamanho da saída).
- **Riscos e segurança:** laço infinito, estouro de memória, exfiltração por rede, leitura de arquivos locais. Abrir projeto de terceiros equivale a executar código de terceiros.
- **Validar:** geradores hostis de teste — um tenta rede, um tenta ler arquivo, um entra em laço, um aloca sem limite — todos barrados e relatados.

#### K-28 — Manifesto de projeto, travas e cópias de recuperação

- **Origem:** A, C. IDEIA pura. PROPRIETÁRIO: os esquemas concretos dos manifestos — não reproduzidos.
- **Problema:** saber o que pertence ao projeto e evitar que dois processos estraguem o mesmo arquivo.
- **Como funciona:** o manifesto tem versão de esquema, identificadores estáveis e caminhos relativos confinados ao projeto. Ele **registra** fontes; nunca as infere de exportações. Projeto ambíguo falha em vez de escolher o primeiro. Diretório sem manifesto é rejeitado. Operações que mudam o manifesto ou o artefato de trabalho adquirem uma trava do projeto. Cada etapa deixa uma cópia da versão anterior ao lado, ignorada pelo controle de versão. Chaves desconhecidas no arquivo de configuração são erro.
- **Tecnologias públicas:** travas de arquivo; JSON com esquema.
- **Entradas e saídas:** entrada = operações sobre o projeto. Saída = manifesto consistente.
- **Na Lia Forge:** o problema já foi apontado na revisão como R-09 (três escritores do mesmo arquivo de assets).
- **Existe:** `shared/assets/manager.mjs`, `shared/integrations/project-structure.mjs`.
- **Melhorar:** escritor único com trava; rejeição de chaves desconhecidas; falha em ambiguidade.
- **Desenvolver:** a Lia Forge pode ir além das cópias ao lado: versões por hash de conteúdo.
- **Riscos:** trava órfã após queda do processo; precisa de expiração.
- **Validar:** dois escritores simultâneos, nenhum dado perdido; chave desconhecida rejeitada.

#### K-29 — Reconciliação entre edição manual e definição reproduzível

- **Origem:** C. IDEIA pura.
- **Problema:** o usuário ajusta o modelo à mão numa ferramenta de autoria; a definição reproduzível fica desatualizada e a próxima regeneração apaga o ajuste.
- **Como funciona:** uma operação **explícita** compara o artefato editado com o resultado capturado da definição e produz um relatório estruturado do que mudou. Nada é corrigido automaticamente; antes de comparar, faz-se cópia do editado; o código de saída distingue sem diferenças, com diferenças e falha; o relatório marca relações não resolvidas e estados não suportados. O usuário escolhe: atualizar a definição ou marcar a etapa como finalizada à mão. Há também importação de modelo externo, que preserva o original.
- **Tecnologias públicas:** comparação estrutural de cenas glTF.
- **Entradas e saídas:** entrada = versão A e versão B. Saída = relatório de diferenças.
- **Na Lia Forge:** o caso real é "o usuário editou o GLB no Blender". O equivalente é uma **comparação entre duas versões de asset** usando `inspectGlb`: nós, malhas, triângulos, clipes, materiais.
- **Existe:** inspeção de GLB; versões de asset em planejamento.
- **Melhorar:** não se aplica.
- **Desenvolver:** comparador de duas inspeções; regra "edição manual é entrada válida" no planner (K-04).
- **Riscos:** prometer reconciliação completa; ossos, pesos e UV editados à mão raramente são reconciliáveis.
- **Validar:** par de GLB com diferença conhecida produz o relatório esperado; par idêntico produz relatório vazio.

#### K-30 — Pedido de arte a um produtor externo

- **Origem:** C. IDEIA pura.
- **Problema:** uma etapa precisa de uma imagem que o pipeline não sabe produzir.
- **Como funciona:** um manifesto de pedidos descreve cada imagem necessária e onde ela deve ser entregue, sem dizer como será usada. O produtor pode ser uma pessoa, outra ferramenta ou um agente. Só acontece a pedido explícito do usuário. A etapa consumidora verifica se o arquivo chegou e tem as dimensões certas.
- **Tecnologias públicas:** nenhuma.
- **Entradas e saídas:** entrada = lista de pedidos. Saída = arquivos entregues + estado por pedido.
- **Na Lia Forge:** é o padrão "passo manual" que o motor já conhece (`electron/manual-artifacts.cjs`) e o que o hub de providers faz quando o provider é uma pessoa.
- **Existe:** artefatos manuais.
- **Melhorar:** dar ao artefato manual uma especificação verificável (dimensões, transparência) e passar a entrega pelos mesmos validadores e pelo registro de direitos.
- **Desenvolver:** nada novo.
- **Riscos:** arquivo vindo de fora sem registro de direitos.
- **Validar:** entrega com dimensões erradas é recusada; entrega sem registro de direitos fica bloqueada.

#### K-31 — Empacotamento verificável de distribuição

- **Origem:** B, C. IDEIA pura.
- **Problema:** saber exatamente o que foi distribuído e de onde veio.
- **Como funciona:** o pacote traz um arquivo de informações de build (versão, commit, data, versão do ambiente, e se a árvore estava suja), uma lista de hashes de todos os arquivos e uma lista de componentes de terceiros. Um componente compartilhado entre dois produtos tem versão e hash fixados, e os testes dos dois verificam esses hashes.
- **Tecnologias públicas:** SHA-256, SPDX, CycloneDX.
- **Entradas e saídas:** entrada = árvore de build. Saída = três arquivos de metadados.
- **Na Lia Forge:** o instalador está no roadmap P2 da revisão. `scripts/generate_third_party_notices.py` já existe.
- **Existe:** avisos de terceiros gerados.
- **Melhorar:** recusar build de árvore suja para distribuição; incluir hashes.
- **Desenvolver:** informações de build e lista de hashes no empacotamento.
- **Riscos:** os próprios materiais mostram as falhas típicas — um deles foi empacotado de árvore suja e outro embute uma biblioteca que não aparece na lista de terceiros. Hashes provam consistência interna, não origem.
- **Validar:** build de árvore suja falha; todo arquivo embutido de terceiros aparece na lista.

---

## 3. Lições negativas

O que os materiais fazem e a Lia Forge **não** deve repetir.

| # | Observado | Por que evitar | Capacidade relacionada |
|---|---|---|---|
| N-1 | Instalar dependências automaticamente quando faltam | Viola "nenhuma instalação sem autorização"; roda scripts de terceiros | K-25 |
| N-2 | Executar receitas como programas com os privilégios do usuário | Abrir um projeto vira executar código | K-27 |
| N-3 | Embutir uma biblioteca de 2021 no visualizador | Versão sem correções; ausente da lista de terceiros | K-31 |
| N-4 | Página de composição com código livre na mesma origem | Código confiável por definição | K-18 |
| N-5 | Conter o agente só por texto ("não rode comando inline") | Convenção, não mecanismo | K-20 |
| N-6 | Dependências com faixas de versão abertas | Instalação não reproduzível | K-25 |
| N-7 | Empacotar a partir de árvore com alterações não commitadas | Build não identificável | K-31 |
| N-8 | Nenhum registro de direitos ou proveniência dos assets gerados | Requisito central da Lia Forge | — |
| N-9 | Depender de navegador sem interface só para rasterizar | Pesado para o hardware-alvo; o Electron já é um navegador | K-02, K-13 |
| N-10 | Publicar um arquivo compactado com histórico de versionamento e dado pessoal dentro | Exposição desnecessária | — |

---

## 4. Tecnologias e formatos públicos citados

Para quem implementar: a fonte de consulta é a documentação pública de cada item, não os materiais.

| Tecnologia ou formato | Licença ou natureza | Uso possível | Já no projeto? |
|---|---|---|---|
| glTF 2.0 / GLB | Especificação aberta (Khronos) | Formato central | Sim (inspeção própria) |
| glTF-Validator | Apache-2.0 | Conformidade de GLB | Não — decisão E-5 |
| Three.js | MIT | Viewport, carga e exportação de GLB | Não (proposto) |
| Manifold | Apache-2.0 | Booleanas e isossuperfície | Não — depende de E-1 |
| Canvas 2D | Padrão web | Rasterização 2D | Disponível no Electron |
| Paper.js | MIT | Booleanas vetoriais | Não — depende de E-1 |
| Ruído simplex, geradores com semente | Algoritmos públicos | Variação procedural | Verificar em `shared/vfx/core.mjs` |
| MaxRects, Skyline, Shelf | Algoritmos públicos | Atlas compacto | Não |
| PNG | Especificação aberta | Imagens | Sim (codec próprio) |
| Convenção de mapa de quadros de atlas | Prática comum de motores 2D | Metadados de spritesheet | Sim (perfis de destino) |
| Eventos enviados pelo servidor, `AbortController` | Padrões web | Atualização ao vivo | Disponível |
| Electron: janela oculta, `capturePage`, `sandbox` | MIT | Captura e execução isolada | Sim (Electron 45) |
| Playwright | Apache-2.0 | Teste em Chromium real | Não — só como dependência de teste |
| Operadores de UV, bake e ações do Blender | GPL (ferramenta externa) | UV, textura, animação | Sim, via adapter |
| xatlas | MIT | Desdobramento de UV fora do Blender | Não — sem necessidade prevista |
| Formato de projeto do Blockbench | Formato JSON de ferramenta de terceiros (GPL) | Importação de modelos de blocos | Não — decisão E-2 |
| SPDX, CycloneDX | Padrões abertos | Lista de componentes | Parcial |

---

## 5. Elementos proprietários deliberadamente não reproduzidos

Registro do que **ficou de fora**, para que a ausência seja uma decisão documentada.

- Código-fonte de qualquer um dos materiais.
- Nomes de funções, classes, comandos, opções de linha de comando e variáveis de ambiente.
- Esquemas concretos de manifestos e de arquivos de configuração (nomes de chaves e estrutura).
- Textos das instruções para agentes, incluindo listas de regras e tabelas de roteamento.
- Tabelas de erro com as mensagens literais.
- Estrutura de diretórios de projeto.
- Imagens de pincel, exemplos de assets e capturas incluídos nos pacotes.
- Regras de estilo específicas (proporções, limites de nós por formato de jogo).
- A organização interna das bibliotecas de geometria, pintura e animação.

O que foi levado é o **porquê** e o **o quê** de cada capacidade; o **como** deve ser decidido na Lia Forge.

---

## 6. Evidências e limitações

### 6.1 Evidências

| Afirmação | Base |
|---|---|
| Comportamentos atribuídos às Referências A, B e C | Leitura de documentos de arquitetura, instruções para agentes e código de servidor, visualizador, verificação e exportação, em cópia temporária fora do repositório. Localização exata de cada achado de segurança: `EXTERNAL-TOOLS-INTEGRATION-ASSESSMENT.md`, apêndice A.2. |
| Estado da Lia Forge | Leitura de `arena/649f88bd-3dspritesheet` @ `97c0266`: lista de exportações de cada módulo citado na §1.2; `package.json` (sem `three`); busca por WebGL e `EventSource` em `src/` sem ocorrências; registro de capabilities. |
| Correções P0 recentes na branch de código | Títulos dos nove commits entre `5b0ec51` e `97c0266` e presença dos módulos correspondentes. Não reauditadas. |
| Existência das versões de pacotes públicos | Consulta por nome e versão ao registro npm, feita na etapa anterior. |

### 6.2 Limitações

1. **Nada foi executado.** As capacidades são descritas a partir de código e documentação; nenhuma foi observada em funcionamento.
2. **Leitura dirigida.** Os materiais somam cerca de 54 mil linhas; as bibliotecas internas de geometria, pintura e animação da Referência C foram estudadas pela documentação de arquitetura e pelas instruções, não linha a linha. K-05, K-06 e K-07 são as fichas com menor profundidade.
3. **Comparação com código fora de `main`.** Tudo o que "existe" na Lia Forge está numa branch não consolidada e pode mudar.
4. **Sem avaliação de qualidade visual.** Este estudo não diz se os resultados dos materiais são bons.
5. **Não é sala limpa estrita** (§0.3).
6. **Licenças.** A classificação IDEIA / PÚBLICO / PROPRIETÁRIO é um critério de engenharia para manter distância segura; não é parecer jurídico.
