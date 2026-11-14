# Auditoria Blender local

Pacote documental para assimilação no Arena em 2026-11-13. Foram enumerados **15.143 arquivos físicos** nas três raízes aprovadas, com **111 arquivos físicos identificados por SHA-256** na análise Blender. O restante inclui formatos de Unreal, áudio, imagens, fontes, runtimes, dependências e compactados de triagem. A enumeração ignorou o filtro .gitignore e excluiu metadados Git, dependências de desenvolvimento, bytecode em cache e redirecionamentos de diretório.

| Unidade | Contagem |
| --- | --- |
| Compactados físicos triados | 238 |
| Compactados físicos com SHA-256 na seleção Blender | 61 |
| Ocorrências de compactados internos identificadas | 92 |
| Compactados físicos com listagem falha ou parcial | 53 |
| Famílias de add-ons e extensões, incluindo componentes de bundles | 38 |
| Cenas Blender identificadas e examinadas por leitura estática | 580 ocorrências, 506 hashes únicos |
| Cenas avulsas | 16 |
| Scripts Python e manifestos avulsos | 33 Python, 1 manifesto |
| Ocorrências com hash para fontes, manifestos e documentos identificados dentro de pacotes | 4339 |
| Ocorrências de membros textuais com hash pendente | 25 |
| SHA-256 únicos, somando inventário e fontes internas | 3025 |

As contagens de arquivos físicos, membros e famílias medem unidades diferentes. As 16 cenas avulsas incluem oito arquivos de recuperação. O mapa que liga os IDs portáveis a arquivos, membros e pastas está na área de resultados locais ignorada pelo Git.

## Documentos para o Arena

- [Baseline dos checkouts e decisões](BASELINE.md)
- [Inventário geral por SHA-256](INVENTARIO.json), [fontes dentro dos pacotes](FONTES-SHA256.json) e [contagens](CONTAGENS.json)
- [Relatório individual dos add-ons](ADDONS.md) e [evidência técnica por pacote](ADDONS.json)
- [Relatório dos projetos](PROJETOS-BLENDER.md) e [métricas por SHA-256](BLENDS.json)
- [Matriz de capacidades](CAPACIDADES.md) e [matriz de licenças e dependências](LICENCAS-E-DEPENDENCIAS.md)
- [Comparação com as 19 famílias anteriores](DUPLICATAS.md)
- [Compatibilidade arquitetural, oportunidades, lacunas e prioridades](ASSIMILACAO.md)

## Ferramentas e evidência

**EXECUTED em Windows.** Git e rg para os checkouts e a enumeração. PowerShell e Python 3.14.3 com bibliotecas padrão para AST, TOML, SHA-256, ZIP, gzip, Zstandard e SDNA. bsdtar/libarchive e NanaZip para metadados e leitura seletiva de contêineres. Os utilitários de auditoria foram próprios e temporários.

**EXECUTED no preflight do Blender.** Blender Steam 5.3.0 (build 02f0899d78e3), bpy e Python integrado 3.13.13, em background com factory startup, perfil temporário e autoexec desativado. O preflight tinha zero projetos abertos. O Python do sistema não oferecia bpy. As tentativas de leitura de projetos em background não produziram relatórios utilizáveis. A inspeção de cenas usa dados serializados e não afirma compatibilidade de runtime ou qualidade visual. [CLI do Blender](https://docs.blender.org/manual/en/dev/advanced/command_line/arguments.html)

**VALIDATED no escopo estático.** Os arquivos com métricas passaram por leitura da assinatura, da sequência de blocos até ENDB e dos layouts SDNA interpretados. Nenhum add-on, binário auxiliar ou script incorporado foi executado. Cada contagem descreve o que o leitor conseguiu interpretar.

**Skills disponíveis.** O catálogo do Codex e a Skill de marca da Forge foram conferidos. Nenhuma Skill especializada em Blender, Python, cenas 3D ou auditoria de add-ons apareceu. REA é voltada a artefatos empacotados e engenharia reversa, útil numa eventual auditoria de um aplicativo auxiliar compilado. A Skill de marca é relevante à documentação de identidade. A auditoria utilizou as ferramentas diretamente, sem instalar ou atualizar Skills.

## Lacunas

Entre os 53 compactados com cobertura incompleta há 49 registros de timeout e quatro retornos de erro. Dezessete são volumes RAR numerados. Outros membros podem existir nessas embalagens. O inventário local das falhas registra os caminhos. A triagem não mede qualidade visual, dependências externas resolvidas ou execução em Blender 5.3 das operações de add-ons. Para o Arena, enviar os documentos desta pasta após revisão de escopo. Direitos dos artefatos, escolha de fixtures e adoção dos candidatos permanecem pendentes.
