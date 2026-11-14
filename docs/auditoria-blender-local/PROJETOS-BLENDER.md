# Projetos Blender

O JSON guarda a leitura por SHA-256. Cada valor é um agregado de datablocks serializados. A identificação de imagens externas leva em conta o sufixo e os indicadores de empacotamento. Referências, scripts, drivers, animações e Geometry Nodes foram lidos como dados, sem avaliar dependências ou executar a cena.

| Classe | SHA-256 inicial | Objetos / coleções | Malhas / vértices / faces | Rigs / ossos / Actions | Materiais / imagens | Árvores GN / textos / referências |
| --- | --- | --- | --- | --- | --- | --- |
| Referência de personagem e rig | 185f70708560 | 76 / 19 | 52 / 385513 / 384198 | 1 / 497 / 2 | 53 / 81 | 8 / 1 / 77 |
| Referência de personagem e rig | 1ff99db94859 | 143 / 6 | 78 / 89408 / 117241 | 2 / 1321 / 2 | 59 / 64 | 12 / 2 / 62 |
| Referência de shader estilizado | 9fc5059eb5f8 | 20 / 5 | 12 / 23715 / 23127 | 1 / 1 / 0 | 15 / 4 | 1 / 1 / 0 |
| Referência de personagem e rig | 185f70708560 | 76 / 19 | 52 / 385513 / 384198 | 1 / 497 / 2 | 53 / 81 | 8 / 1 / 77 |
| Referência de personagem e rig | cb483194a7a0 | 159 / 9 | 135 / 189065 / 338278 | 1 / 612 / 0 | 44 / 63 | 0 / 0 / 3 |
| Deformação procedural | 982afeb06005 | 13 / 3 | 9 / 6204 / 5918 | 1 / 7 / 4 | 4 / 3 | 2 / 0 / 0 |
| Template humanoide modular | a0c80f926dea | 147 / 12 | 78 / 11169 / 5602 | 1 / 74 / 12 | 2 / 1 | 0 / 1 / 0 |
| Template humanoide modular | dcf9b6cf86ed | 147 / 12 | 78 / 10992 / 5812 | 1 / 71 / 10 | 2 / 1 | 0 / 2 / 0 |
| Recuperação e histórico | 040d5b035b31 | 0 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 2 | 0 / 0 / 0 |
| Recuperação e histórico | 3f4fc1871fab | 0 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 2 | 0 / 0 / 0 |
| Recuperação e histórico | 7962955c4e78 | 0 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 2 | 0 / 0 / 0 |
| Recuperação e histórico | 84a2b26576db | 5 / 1 | 3 / 498 / 524 | 0 / 0 / 0 | 1 / 2 | 0 / 0 / 0 |
| Recuperação e histórico | 231916508df4 | 0 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 2 | 0 / 0 / 0 |
| Recuperação e histórico | 8aa191e593ea | 148 / 9 | 78 / 11169 / 5602 | 1 / 74 / 12 | 3 / 3 | 0 / 0 / 1 |
| Recuperação e histórico | b0d2a48f1a77 | 148 / 9 | 78 / 11169 / 5602 | 1 / 74 / 12 | 3 / 3 | 0 / 0 / 1 |
| Recuperação e histórico | dc3a198a776f | 6 / 2 | 2 / 5586 / 5562 | 1 / 74 / 12 | 3 / 3 | 0 / 0 / 1 |

## Classes, incluindo membros de pacotes

- Biblioteca de materiais · 337 ocorrências.
- Cena ou biblioteca em pacote · 121 ocorrências.
- Deformação procedural · 2 ocorrências.
- Ferramenta procedural de tranças · 10 ocorrências.
- Recuperação e histórico · 8 ocorrências.
- Referência de personagem e rig · 4 ocorrências.
- Referência de shader estilizado · 22 ocorrências.
- Template humanoide modular · 4 ocorrências.
- Template ou exemplo de rig · 72 ocorrências.

As bases modulares são referências de template para peças intercambiáveis e Actions. SquishBulge é uma referência para deformação por proximidade e Geometry Nodes. Shaders de jogo são referências de técnica e pedem fixture própria para bake e QA. Os autosaves são snapshots com evidência estrutural, sujeitos aos direitos da cena de origem. Cenas de rig em bundles ajudam a formular testes de pose, skin e clipes. Os materiais de bibliotecas pedem licença por item.

A leitura estática não mede duração de clipes, bindings, qualidade visual, resolução de dependências nem fidelidade da exportação. Text blocks com extensão Python e drivers são sinais de conteúdo ativo. Layouts SDNA não reconhecidos ficam de fora dos contadores por tipo. [Formato Blender](https://developer.blender.org/docs/release_notes/5.0/core/)
