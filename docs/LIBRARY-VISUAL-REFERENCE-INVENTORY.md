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
