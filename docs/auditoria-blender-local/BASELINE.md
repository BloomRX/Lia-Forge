# Baseline do Lia Forge para a auditoria Blender

Em 2026-11-13, os quatro checkouts usavam árvores distintas com banco Git compartilhado. Os HEADs locais coincidiam com as refs abaixo em git ls-remote. As quatro árvores estavam limpas no início.

| Checkout | HEAD inicial | Ref publicada | Escopo |
| --- | --- | --- | --- |
| main | e9887118f9826e112e594b5c154a6b151071a0e6 | main, ativa | README, instruções de agente e padrão da marca, sem runtime nem documentação técnica. |
| blender | df145d709899f4b144692031ff81e48cd4590d3b | arena/7c135d59-lia-forge, HEAD destacado | Três documentos da série Blender desde 87457fd. |
| threejs | bf6d06c27574aadb463f7ef4ff46e1ea29e31d41 | arena/c61c7ae8-lia-forge, HEAD destacado | Quatorze capítulos, índice e questões 45–56, desde 0b4e867. |
| t13 | 5b0ec51ecec1ea06b8228b03fc0f5d4b8b1f0471 | arena/649f88bd-3dspritesheet, HEAD destacado | 54 commits à frente da branch local homônima, ativa em outra árvore. |

**PROPOSED** designa uma opção para decisão. **PLANNED** designa uma etapa futura documentada. **IMPLEMENTED** exige código no checkout citado. **EXECUTED** registra o que rodou, com escopo e ambiente. **VALIDATED** exige critério verificável e resultado observado.

| Frente | Estado na fonte | Encaixe para a auditoria |
| --- | --- | --- |
| Skills & Knowledge Engine | PLANNED em runtime. docs/SKILLS-KNOWLEDGE-ENGINE.md propõe manifesto, descoberta e invocação. A Skill de marca e os handoffs existentes são instruções. | Registrar técnicas portáveis, entradas, ferramentas, direitos, condições de execução e evidência. |
| Intelligent Orchestrator | IMPLEMENTED parcialmente em shared/orchestrator/planner.mjs. O T13 usa receitas, Hub, requisitos e gates. Busca de Skills e planejamento multipipeline são PLANNED. | Selecionar a operação por capability, compatibilidade, dependências, direitos e confirmação humana. |
| Workflow Engine | IMPLEMENTED em parte em shared/engine/dag.mjs, execution-manager.mjs, gates.mjs e shared/qa/validators.mjs. T13 registra cancelamento, retomada, checkpoints e validadores do artefato em disco. Filas persistentes e reconciliação de chamadas são PLANNED. | Reutilizar plano, execução, validação e revisão existentes. |
| Agent Workflow e MCP | IMPLEMENTED em parte. docs/agent-workflow.md define handoff opcional. scripts/spriteforge-mcp.mjs oferece consulta, registro de assets, preparação de tarefa e atualização de etapa. | Agente prepara tarefa e registra artefatos. Uma invocação de autoria futura usa permissões e serviço de workflows. |
| Assets e capabilities | IMPLEMENTED em parte. shared/assets/manager.mjs trata versões e direitos, shared/capabilities/registry.mjs cataloga capacidades e shared/model3d/glb.mjs inspeciona GLB. Grafo de versões e deduplicação global são PLANNED. | Preservar IDs, origem, derivação, licença, SHA-256 e perfil de destino. |
| Hub, adapters e Blender Bridge | Hub e adapter de spritesheet IMPLEMENTED. Bridge PROPOSED, com job tipado, catálogo fechado de scripts, subprocesso, cancelamento e validação. | Registrar candidatos no catálogo da auditoria e planejar operação pelo Hub. |
| Domínio T13 | IMPLEMENTED como protótipo experimental em shared/domain/contracts.mjs. A auditoria identifica lacunas em identidade visual, relações, style lock, migração e integração com store/runner. | Levar evidência documental ao Arena. Evolução de contrato depende de aprovação. |
| Three.js | Viewport PROPOSED, fases PLANNED. Inspeção estrutural de GLB e comparação de métricas estão IMPLEMENTED. A pesquisa conferiu a ausência do Three.js nas dependências e no código. | Blender faz autoria. GLB/glTF veicula derivados. O viewport interno inspeciona os derivados. |

O T13 registrou no Debian 12 **49 capacidades, 7 adapters, 8 workflows e 5 rotas com execução interna**. Foram EXECUTED os workflows 2D descritos, retomada com gates e inspeção de uma fixture GLB, VALIDATED no escopo estrutural. A cobertura de ferramentas usa um substituto de Blender e um servidor de teste em loopback para ComfyUI. Render real, importação em engines e validação de GPU no Windows continuam pendentes no registro. A ponta do T13 corrige a exportação para preservar itens do pacote e distingue metadados de formatos recusados. Os commits anteriores tratam prévia de VFX, regra de retomada e runs interrompidos recuperáveis.

## Plano Three.js e critérios de aceite

| Fase | Escopo | Evidência futura |
| --- | --- | --- |
| 0 | Decisões e fixtures | Aprovação do escopo e dos limites de acesso. |
| 1 | Viewport GLB/glTF autocontido e diagnóstico | Chromium real, 60 fps na fixture de personagem em RX 580 a 1080p/DPR 1, dez ciclos de descarte, hash dos originais e recusas de caminhos e tamanho. |
| 2 | Hierarquia, picking, transforms e captura | IDs estáveis, undo/redo, overrides ligados ao SHA-256 e escrita atômica. |
| 3 | PBR, texturas, UV e pipeline de cor | Comparação de canais com inspetor GLB, estimativa de VRAM e descarte de texturas. |
| 4 | Skeleton, skins, clipes e A/B | Alvos, duração, scrub e comparação em pose/tempo equivalentes. |
| 5 | Workflow, QA, Bridge e exportação derivada | Relatório humano ligado a hash e sessão, diff de exportação e perfis existentes de destino. |

Fontes Blender nas [matrizes](../BLENDER-ADDONS-MATRICES.md), [pesquisa revisada](../ECOSYSTEM-RESEARCH-BLENDER-ADDONS.md) e [especificação do Bridge](../BLENDER-BRIDGE-SPECIFICATION.md). Fontes Three.js nos capítulos 01, 05, 06, 08, 11, 12 e 14 do commit acima. Fontes T13 em docs/T13-IMPLEMENTATION-EVIDENCE.md, docs/IMPLEMENTATION-AUDIT.md, docs/DOMAIN-CONTRACTS-AUDIT.md e no código citado.
