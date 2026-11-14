# Assimilação pelo Arena

## Matriz de compatibilidade arquitetural

| Capacidade e evidência local | Bridge e Tool/Provider Hub | Skills, Orchestrator, Workflow e agente | Artefato e inspeção Three.js |
| --- | --- | --- | --- |
| Malhas, bases modulares, MPFB, retopologia e UV | Reusar inspeção e exportação; mapear operação autorizada ao adapter. RetopoFlow e escultura ficam na bancada. | Skill de topologia, UV e modularidade. Agente prepara entradas e checkpoint para acabamento do artista. | GLB derivado. Medir triângulos, UV, normais e hierarquia. Visualizar em fases 1–3. |
| Rigs, retarget, snap, Actions, rig tools e pesos voxel | Contrato de rig e versão de adapter explícitos. Voxel e pacotes comerciais dependem de direitos e prova do binário. | Selecionar por rig de origem/destino, Pose de repouso, direitos e canais. Separar bind, retarget, bake e revisão em nós. | GLB com skin e clips. Validar joints, pesos, eixos, duração e root motion. Revisão em fase 4. |
| Shape keys e modifiers, com SKkeeper como candidato | Job restrito a combinação comprovada de modificador e modelo. | Skill para comparar nomes, contagens e deltas antes/depois. Planner seleciona por suporte a morph. | GLB com morph targets. Diagnóstico estrutural e inspeção visual do resultado. |
| Hair cards, tranças e roupa | Execução Blender e bake em versão derivada. Usar etapa manual quando seleção, grooming ou fitting exigirem artista. | Skill de guias, UV e alpha. Validar colisão, orientação e geometria após realizar instâncias. | GLB com malhas e materiais. Curvas de autoria e simuladores permanecem no Blender. |
| Shaders e biblioteca procedural | Exportação controlada de malha e bake PBR quando o perfil exigir. | Skill de decomposição de shader e seleção de mapas. Designer valida cor e aparência. | GLB com texturas e material ou PNG para spritesheet. A fase 3 mede textura, VRAM estimada e cor. |
| SquishyFX, JiggleGen, JiggleMaker, Wiggle e cloth | Bake mediante versão, cache e prova de execução. Controladores, handlers e configuração de simulador pertencem ao projeto de autoria. | Workflow recebe intervalos, amostragem e entradas. Validadores comparam saída e parâmetros de referência. | Exportar channels suportados ou saída renderizada. Checar rig, deformação e clipes. |
| VRM, MMD e glTF legado | Adapters opcionais para formatos e fixtures aprovados. Usar o GLB como formato central. | Planner encaminha perfil de destino e direitos do modelo. Agente valida relatórios e pede revisão de tradução de materiais e movimentos. | GLB de inspeção. VRM exige suporte explícito do consumidor, e a conversão MMD precisa de QA de morphs e física. |
| PaletteGrid, Onion Skinning e Proxy Picker | Etapa manual no Blender com artefato e evidência quando aplicável. | Handoff especifica gesto esperado, modo, contexto e decisão do artista. | Consumir a versão exportada ou captura. |
| Bloom Agent, ferramentas auxiliares compiladas e caches | Referência de interação, estudo e histórico. Manter as responsabilidades do Hub, runner e Bridge propostos. | Aproveitar somente documentação, operação com entradas escopadas e lições de handoff. MCP acessa funções aprovadas da Forge. | Relatório portável e artefatos de QA previstos no workflow. |

O agente descobre o catálogo de capabilities e evidencia a disponibilidade no Hub. O planner escolhe pelo formato, ambiente, versão, licença, dependências, custo e necessidade de interação. O Workflow Engine vincula o plano à entrada e à operação autorizada. Um adapter futuro passaria ao Bridge o job tipado e usaria o runner existente. O agente verifica o relatório do job e os validadores dos bytes gravados, e abre revisão humana quando qualidade visual ou direitos continuam pendentes. O MCP atual cobre handoff. Uma chamada MCP futura, se aprovada, poderia consultar compatibilidade ou pedir a execução de um plano registrado com as mesmas permissões do serviço.

GLB/glTF retém elementos compatíveis de geometria, materiais, skins e animações. O perfil de exportação precisa explicitar o que foi bakeado, simplificado ou omitido, como árvores de Geometry Nodes, controladores e shaders próprios do Blender. [Especificação Khronos](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.pdf)

## Oportunidades e prioridades

1. **P0 · documentação e direitos.** Assimilar o baseline, os relatórios estáticos, as matrizes, os IDs e as correções de licença. Confirmar titularidade de cenas, procedência dos bundles e permissões de uso de cada saída.
2. **P1 · Skills de QA de autoria e intercâmbio.** Converter os achados em procedimentos verificáveis para malha, material e rig. Definir fixtures próprias para base modular, morph, cabelo e clipe. Medir o GLB com o inspetor existente e usar os critérios de aceite da branch Three.js conforme cada fase.
3. **P1 · candidatos de adaptação.** Avaliar VRM, MPFB, SKkeeper e um fluxo de bake por vez. Escolher a operação e versão, medir comportamento headless no Windows, comparar saída com controles e registrar diferenças. A seleção de candidatos é PROPOSED.
4. **P2 · workflows com intervenção humana.** Planejar roupa, hair cards, retopo e materiais com gates de arte. Um agente de pesquisa de direitos ou de QA pode receber handoff por item e devolver uma evidência vinculada ao SHA-256.
5. **P3 · pesquisa de ferramentas nativas, comerciais e bibliotecas.** Revisar proveniência, licenças de distribuição, dependências, permissões de dados e custos antes de qualquer ensaio. Resolver as discrepâncias de manifests e os pacotes incompletos.

## Lacunas e decisões

- Confirmar quais extensões do perfil Blender fora das três raízes integram a coleção, se devem entrar em auditoria adicional.
- Obter os termos de aquisição, licenças de materiais e origem das versões comerciais e de arte de terceiros. As classificações de referência permitem assimilar técnicas documentadas.
- Separar desempenho real, aparência, compatibilidade de Blender e validação de destino. A leitura estática cobre estrutura em disco. As métricas de cena, integração e janela-alvo têm seus próprios critérios.
- Selecionar fixtures aprovadas para a primeira fatia e decidir quais candidatos devem avançar. Compatibilidade em runtime, uso de código de terceiros e publicação de arte são decisões individuais.
- Resolver arquivos compactados com listagem incompleta pelos detalhes da triagem local. Volumes sem inventário próprio podem depender do primeiro volume, e timeouts deixam conteúdo indeterminado.
