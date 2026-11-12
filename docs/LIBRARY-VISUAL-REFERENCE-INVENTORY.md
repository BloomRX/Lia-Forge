# Inventário de referências visuais — Lia Forge

> **Estado:** inventário inicial de referências localizadas na Biblioteca do ChatGPT. Este documento registra referências e sua finalidade; **não afirma que os arquivos binários foram copiados para o Git**.
> **Uso:** orientar a implementação do Forge Studio e preservar a identidade visual do ecossistema Lia.
> **Regra:** referências visuais não substituem especificações funcionais, nem autorizam reutilização de material de terceiros sem verificação de direitos.

## 1. Referências específicas do Lia Forge

As três artes abaixo foram identificadas na Biblioteca, na coleção `Lia-Forge`:

| Referência | Finalidade no produto | Orientação |
|---|---|---|
| **Interface Sombria Neon do Lia Forge.png** | Conceito principal do Forge Studio | Usar como referência de layout, navegação, painéis, viewport, propriedades, workflow e assistência da Lia. |
| **Lia Forge: Heroína Pixel Neon.png** | Conceito de personagem 2D/pixel art | Usar para orientar preview de sprites, frames, animação, atlas e propriedades do asset. |
| **Forja Lia: Aiko, Guarda Florestal.png** | Conceito de personagem 3D | Usar para orientar criação e inspeção de personagem, variações, modelagem, rigging, animação e spritesheet. |

**Importante:** os arquivos originais estão identificados na Biblioteca, mas a tentativa de materialização dos bytes para o workspace/Git não foi autorizada pelo serviço de arquivos. Portanto, este commit registra os nomes e os usos, não incorpora as imagens. Não criar arquivos-placeholder com esses nomes.

## 2. Referências do ecossistema Lia

Também foram identificadas na Biblioteca referências da Lia Desktop que podem orientar a identidade compartilhada, mas não devem ser confundidas com telas do Forge:

| Referência | Uso permitido como referência |
|---|---|
| `LiaHeroImage.png` | Identidade visual/arte principal da personagem Lia. |
| `01-Home.png` | Linguagem visual e hierarquia da interface desktop. |
| `02-ai-resources.png` e variantes | Apresentação de recursos, modelos e capacidades. |
| `03-voice.png` | Padrões visuais de configuração de recursos. |
| `04-personality.png` | Personalização e apresentação de perfis. |
| `05-appearance.png` | Seleção de aparência e variações. |
| `06-presence.png` | Presença visual e modos de exibição. |
| `07-tools.png` | Catálogo de ferramentas e integrações. |
| `IconAppToolBar.png`, `IconAppCompact.png` | Referências de ícones da aplicação. |
| `LiaName.png` | Assinatura/nome da marca. |
| `chart-1.png`, `chart-2.png`, `chart-3.png`, `chart-4.png` e variantes | Artes e pranchas visuais da identidade Lia. |

Essas referências devem orientar consistência de marca, paleta, tipografia, tratamento de painéis e presença da assistente. Não copiar a estrutura funcional da Lia Desktop para o Forge quando ela não fizer sentido para um estúdio de produção de assets.

## 3. Verificação obrigatória no repositório

T12 registrou que `docs/concepts/` contém referências visuais, mas o inventário nominal completo do Git ainda precisa ser realizado no checkout de implementação.

Antes de redesenhar ou substituir a interface, o responsável pela implementação deve:

1. Inventariar recursivamente imagens em `docs/concepts/`, `assets/` e demais diretórios relevantes do repositório.
2. Registrar caminho Git, nome, formato, dimensões, tamanho e hash SHA-256.
3. Gerar uma galeria/índice visual local ou documentação com miniaturas quando tecnicamente possível.
4. Comparar as imagens do Git com as referências desta lista, identificando duplicatas e versões de maior resolução.
5. Preservar originais; não sobrescrever ou recomprimir assets-fonte.
6. Verificar proveniência e direitos antes de incluir ou redistribuir qualquer arte.
7. Atualizar este inventário com os caminhos Git reais e marcar cada item como `TRACKED_IN_GIT`, `LIBRARY_ONLY`, `DUPLICATE`, `RIGHTS_PENDING` ou `NOT_FOUND`.

## 4. Direção visual a preservar

- Estética escura com acentos neon magenta/rosa e contraste legível.
- Interface de criação profissional, com viewport central e painéis contextuais.
- Navegação clara por projetos, categorias, workflows, assets e resultados.
- Preview visual grande; propriedades e controles próximos do contexto selecionado.
- Assistência da Lia integrada à experiência, sem ocupar o espaço de trabalho nem substituir controles explícitos.
- Estados de execução, requisitos, custos, licenças, erros e aprovação claramente visíveis.
- Interface acessível e utilizável; brilho, gradientes e efeitos não podem prejudicar legibilidade.

## 5. Relação com T13

Este inventário é uma entrada visual para a missão de conclusão do produto. O Arena deve consultá-lo junto com os conceitos e documentos de arquitetura existentes. Não é autorização para inventar novas telas sem examinar os conceitos originais, nem para afirmar que imagens da Biblioteca já estão presentes no checkout.

<!-- BEGIN GENERATED VISUAL INVENTORY -->

## 6. Inventário verificado no checkout (gerado)

Gerado por `scripts/inventory_visual_references.py` a partir dos arquivos rastreados no Git.
Nenhum arquivo-fonte foi alterado, recomprimido ou renomeado.

**13 imagens rastreadas.**

| Caminho Git | Formato | Dimensões | Bytes | SHA-256 | Estado |
|---|---|---|---|---|---|
| `assets/lia-forge.ico` | ico | 16×16 | 5,564 | `acbf4ec3143e79c3…` | TRACKED_IN_GIT |
| `assets/lia-forge.svg` | svg | 128×128 | 547 | `55aa9a6ad8dbe797…` | TRACKED_IN_GIT |
| `docs/Brand/lia-forge.png` | png | 400×400 | 269,162 | `2e50e1638fdacc7c…` | DUPLICATE de `docs/Concepts/chart-3.png` |
| `docs/Concepts/Forja Lia_ Aiko, Guarda Florestal.png` | png | 1672×941 | 1,621,389 | `9185e2808ec6f832…` | TRACKED_IN_GIT |
| `docs/Concepts/Interface Sombria Neon do Lia Forge.png` | png | 1672×941 | 1,944,081 | `1d9117e3e80ef1b4…` | TRACKED_IN_GIT |
| `docs/Concepts/Lia Forge_ Heroína Pixel Neon.png` | png | 1672×941 | 1,795,188 | `7810e92f6b950bdc…` | TRACKED_IN_GIT |
| `docs/Concepts/Lia-Forge-Visual-Asset-Library-Reference.png` | png | 1536×1024 | 2,116,111 | `87abff1b59d2f263…` | RIGHTS_PENDING |
| `docs/Concepts/Painel Neon do Ecossistema Lia Forge.png` | png | 1672×941 | 2,204,634 | `cbd05e3ebc0265ce…` | RIGHTS_PENDING |
| `docs/Concepts/chart-1(1).png` | png | 400×400 | 64,980 | `26ae179be702c806…` | RIGHTS_PENDING |
| `docs/Concepts/chart-2.png` | png | 1000×563 | 939,023 | `dc5312163695e111…` | RIGHTS_PENDING |
| `docs/Concepts/chart-3.png` | png | 400×400 | 269,162 | `2e50e1638fdacc7c…` | DUPLICATE de `docs/Brand/lia-forge.png` |
| `docs/Concepts/chart-4.png` | png | 400×400 | 339,303 | `bb84a89711c24f2c…` | RIGHTS_PENDING |
| `docs/Concepts/ref.jpg` | jpg | 1536×1024 | 191,390 | `5c642ee3fc5ac740…` | RIGHTS_PENDING |

### 6.1 Referências nominais da Biblioteca

| Referência | Estado | Caminho Git |
|---|---|---|
| Interface Sombria Neon do Lia Forge.png | TRACKED_IN_GIT | `docs/Concepts/Interface Sombria Neon do Lia Forge.png` |
| Lia Forge: Heroína Pixel Neon.png | TRACKED_IN_GIT | `docs/Concepts/Lia Forge_ Heroína Pixel Neon.png` |
| Forja Lia: Aiko, Guarda Florestal.png | TRACKED_IN_GIT | `docs/Concepts/Forja Lia_ Aiko, Guarda Florestal.png` |
| LiaHeroImage.png | LIBRARY_ONLY | — |
| 01-Home.png | LIBRARY_ONLY | — |
| 02-ai-resources.png | LIBRARY_ONLY | — |
| 03-voice.png | LIBRARY_ONLY | — |
| 04-personality.png | LIBRARY_ONLY | — |
| 05-appearance.png | LIBRARY_ONLY | — |
| 06-presence.png | LIBRARY_ONLY | — |
| 07-tools.png | LIBRARY_ONLY | — |
| IconAppToolBar.png | LIBRARY_ONLY | — |
| IconAppCompact.png | LIBRARY_ONLY | — |
| LiaName.png | LIBRARY_ONLY | — |
| chart-1.png | LIBRARY_ONLY | — |
| chart-2.png | RIGHTS_PENDING | `docs/Concepts/chart-2.png` |
| chart-3.png | DUPLICATE | `docs/Concepts/chart-3.png` |
| chart-4.png | RIGHTS_PENDING | `docs/Concepts/chart-4.png` |

### 6.2 Duplicatas byte a byte

- `2e50e1638fdacc7c…`: `docs/Brand/lia-forge.png`, `docs/Concepts/chart-3.png`

### 6.3 Regras de uso aplicadas

- `TRACKED_IN_GIT`: arquivo presente no checkout, origem declarada pelo commit que o publicou.
- `RIGHTS_PENDING`: arte vinda da Biblioteca do ChatGPT; proveniência e direitos ainda não verificados. Não redistribuir nem usar em material público até decisão humana.
- `DUPLICATE`: dois caminhos com o mesmo SHA-256; preservar ambos (não sobrescrever originais) e citar um como canônico na documentação.
- `NOT_FOUND`: referência apenas nominal; nenhum placeholder foi criado com esses nomes.
- `LIBRARY_ONLY`: existe na Biblioteca, não no Git.

<!-- END GENERATED VISUAL INVENTORY -->
