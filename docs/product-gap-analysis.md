# Lia Forge — ideia do produto e lacunas atuais

**Revisão em:** 2026-10-28

**Objetivo:** comparar a intenção documentada com o que o código realmente entrega, sem tratar uma funcionalidade planejada como pronta.

## Visão-alvo confirmada pelo usuário

A ideia é **a pessoa configurar o que quer e receber o asset pronto**, não operar manualmente cada aplicativo. O fluxo-alvo é: preencher brief/prompt e referências; escolher tipo, saída e ponto de entrada (Prompt → 3D → 2D ou uma etapa posterior com artefatos que já existem); iniciar explicitamente a tarefa; então a própria Lia Forge coordena os adapters e ferramentas necessárias — ComfyUI, Blender, Krita ou outros —, passa os resultados de uma etapa para a seguinte, acompanha e valida o trabalho e entrega os arquivos finais no workspace. Depois de iniciar, a pessoa deve poder aguardar o resultado e só ser chamada para decisões, consentimentos ou bloqueios reais. Agentes externos continuam opcionais.

“Executar automaticamente” aqui significa orquestrar o pipeline **após uma ação explícita de iniciar**; não significa instalar software, drivers ou modelos, baixar pesos ou aceitar licenças sem autorização. A Lia Forge deve detectar o que existe, explicar dependências/opções e pedir consentimento quando necessário. Não deve presumir GPU/VRAM ou escolher pesos pelo usuário.

Essa visão é maior que o estado atual. Já há duas fatias automáticas sem agente — geração de PNG de conceito pelo ComfyUI com escolha explícita de checkpoint instalado e render de spritesheet + metadados no Blender a partir de modelo existente — mas elas são ações isoladas, não a execução automática de ponta a ponta. Geração prompt → 3D, rigging/animação e as rotas Code → 2D, Manequim → 2D e ambientes continuam pendentes.

## Busca por instruções de agentes e skills

> Nota histórica: a auditoria de 2026-10-28 não encontrou esses caminhos naquele snapshot; o inventário abaixo descreve o checkout de 2026-11-06 e não apaga o resultado histórico.

- O snapshot atual contém `AGENTS.md`, `CLAUDE.md`, `.agents/skills/lia-brand-check/SKILL.md` e `.claude/rules/interface.md`.
- Esses arquivos tratam de contribuição, marca e interface; não são catálogo nem runtime de skills de produção de assets. `docs/agent-workflow.md` continua sendo um contrato de handoff opcional, não o Intelligent Orchestrator interno.
- Não encontrei no app um Skills & Knowledge Engine para roteamento de arte/ComfyUI/Blender/QA. A pesquisa individual de repositórios candidatos está em [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md); nenhum conteúdo de terceiros foi incorporado.

## Comparação: intenção × implementação

| Área | Intenção documentada | O que existe no código | Situação |
|---|---|---|---|
| Janela desktop e workspace local | Usar a ferramenta sem depender de abas ou de um agente; manter dados no workspace do projeto. | Launcher Python + Electron, armazenamento local `.spriteforge/assets.json`, janela desktop e proteções de navegação/fechamento. O empacotamento Windows está configurado, mas o README confirma que nenhum instalador `.exe` foi produzido/validado. | **Parcialmente pronto** — fonte/launcher existem; ainda falta uma distribuição de usuário final validada. |
| Pipeline de personagem e item | Brief → vistas → modelo → rig/movimento → spritesheet; retomar sem refazer etapas compatíveis. | ComfyUI produz PNG de conceito após escolha explícita de checkpoint; Blender rende PNG + JSON a partir de modelo registrado; contratos humanoides provider-neutral descrevem vistas frente/lado/costas, modelo, rig, ações e render. | **Parcial** — etapas de views/model/rig/animation estão contratadas, mas sem providers/adapters executáveis; ComfyUI não garante vistas consistentes. Itens podem usar turntable Blender a partir de modelo existente. |
| Uso sem agente | Depois de configurar e iniciar, aguardar enquanto a Lia Forge coordena as ferramentas e entrega o resultado; não operar cada app etapa por etapa. | A UI pode abrir ferramentas, gerar referência no ComfyUI, renderizar 3D existente e inspecionar o plano humanoide bloqueado. | **Grande lacuna** — a pessoa ainda precisa fornecer modelo/rig/animações e conduzir as outras etapas; não há entrega prompt → 3D → 2D autônoma. |
| Orquestração do pipeline | Executar as etapas necessárias, ligar outputs a inputs, mostrar progresso, recuperar de erros e entregar um resultado verificável. | Runner serial com estados, contratos de I/O, progresso, logs, gates de autorização/revisão, checksums, validação de formatos, preservação de outputs e retomada genérica compatível; snapshots locais e retomada persistida específica do Blender. | **Parcial** — não há adapters humanoides executáveis, fila de produção nem retomada de tasks externas/API ambíguas após reinício. |
| Criação/geração dentro da Lia Forge | Produzir imagens/modelos/rig/spritesheet por adapters locais ou APIs escolhidos para cada etapa, sem exigir agente externo. | ComfyUI gera concept PNG; Blender renderiza spritesheet de modelo existente; `workflow-runner.cjs` aceita adapters genéricos com contratos. | **Parcial** — contratos humanoides não equivalem a providers instalados/registrados; não cria modelos 3D, rigs nem animações; não há edição 2D ou cadeia completa. |
| ComfyUI sem agente | Usar geração local com controle do usuário, iniciada pela Lia Forge depois de uma ação explícita. | Consulta status; botão escolhe workflow de personagem/item, verifica checkpoint instalado, envia prompt, acompanha history e salva PNG validado na etapa de referências. | **Parcial** — sem download/instalação de pesos, uso de referência visual como condicionamento ou validação de qualidade/consistência; MCP de agentes não é necessário. |
| Retomar de arquivos existentes | Aceitar prompt, imagens, vistas, poses, modelo ou rig e começar na etapa adequada, sem repetir etapas compatíveis. | A UI oferece ponto de entrada e caminhos relativos em texto; manual-artifacts verifica arquivos; o runner revalida formato/hash e consegue reutilizar etapas validadas compatíveis. Retomada desktop persistida atualmente habilitada apenas para Blender. | **Parcial** — ainda falta seletor/importador e retomada de provider; extensão/checksum não confirmam que um modelo/rig é semanticamente utilizável. |
| Veracidade e validação de outputs | Só concluir com artefatos reais, sem simular geração. | ComfyUI: PNG real salvo e estrutura conferida. Runner: arquivos no disco, formatos, tamanhos, checksums e dependências glTF locais; preserva outputs válidos parciais em falha. Blender: PNG RGBA8 + JSON com grade/retângulos/pivôs/durações conferidos. | **Parcialmente implementado** — checagem estrutural não confirma pixels transparentes, qualidade visual, coerência de vistas, rig/weights ou compatibilidade semântica do modelo. |
| Ambientes e cenários | Tipo próprio com saída estática ou camadas/depth/parallax. | O formulário de asset aceita apenas `character` e `item`; “prop/cenário” é uma categoria de item. Schema/MCP e pastas manuais também só conhecem esses dois tipos. | **Ausente** — não existe contrato para fundo estático, camadas, depth map ou parallax. |
| Rotas Code → 2D e Manequim → 2D | Produzir 2D sem obrigar modelagem 3D, ou usar poses de manequim como guia. | `docs/usage-workflows.md` e `docs/agent-workflow.md` explicitamente dizem que são rotas futuras. UI/schema/MCP aceitam só `3d_to_2d`. | **Ausente**. |
| Hardware e instalação de IA | Detectar hardware/runtime, recomendar uma rota compatível e pedir consentimento antes de instalar/baixar. | `doctor` detecta runtimes e consulta dispositivos reportados por uma instância ComfyUI já ativa; não faz inventário confiável de GPU nem compatibilidade CUDA/ROCm/Vulkan. Modelo configurado fica vazio; o downloader CLI exige HTTPS, checksum e aceite de licença. | **Parcial** — boas proteções para pesos; falta o onboarding hardware-aware e a instalação opcional/local de um backend. |
| Delegação a agentes | Oferecer handoff para Claude Code, Codex, OpenCode etc. sem torná-los obrigatórios. | UI/MCP exportam tarefas, restrições, pontos de entrada, insumos e validação de outputs; integração de configuração MCP opcional. | **Parcialmente pronto** — prepara e acompanha o contrato; quem executa as ferramentas é o agente/ambiente externo. |

## Lacunas prioritárias

1. **Concluir o wiring do runner**: registrar adapters reais de views, geração 3D, rigging e animação; expor consentimento/revisão/retomada genérica na UI e tratar reconciliation de tasks externas sem reenvio ambíguo. A máquina de estados e persistência existem, mas a cadeia não está executável sem providers.
2. **Completar a fatia vertical sem agente**: hoje ComfyUI produz um concept PNG e Blender renderiza 3D existente para PNG + JSON; ainda falta produzir/aceitar vistas consistentes, modelo/rig/animações integrados, passar outputs automaticamente e entregar artefatos finais verificados.
3. **Criar adapters executáveis para os aplicativos** (começando pelos já detectados): integração por API/CLI/script, transferência do contexto e dos arquivos, coleta de outputs e diagnóstico de falha. Abrir um `.exe` com uma pasta como `cwd` não substitui isso.
4. **Manter consentimento e setup seguros**: detectar hardware/runtime sem adivinhar; mostrar plano, dependências, fonte/licença e tamanho; pedir autorização para instalar apps/drivers ou baixar pesos; validar backend antes da produção. A execução do workflow só começa após a pessoa apertar “Iniciar”.
5. **Adicionar ambientes como tipo de primeira classe.** Definir formulário, adapters, pastas, retomada e validação para ambiente estático e para camadas/depth/parallax; prop não substitui cenário.
6. **Implementar Code → 2D e Manequim → 2D** no modelo de tarefas, seleção de fluxo, schema/MCP e contratos de saída.
7. **Substituir caminhos digitados por seleção/importação guiada.** Validar extensão, localização e legibilidade no momento da seleção; preservar os insumos existentes sem forçar refazer brief/referência/modelo/rig.
8. **Aumentar a validação por tipo de saída.** PNG: dimensões, alpha e atlas; JSON: schema, frames, nomes e pivôs; 3D: abrir/validar formato e escala; depois, preview/revisão antes de marcar pronto.
9. **Completar distribuição e teste ponta a ponta.** Produzir/testar instalador Windows e fluxos equivalentes em outras plataformas; validar a cadeia numa máquina real com ferramentas/runtime escolhidos.

## Arquivos usados como evidência

- `README.md` — posicionamento, launchers, ComfyUI, pesos, limites e funcionalidades atuais.
- `docs/usage-workflows.md` — princípio de retomada, fluxo manual, rotas disponíveis e rotas explicitamente futuras.
- `docs/agent-workflow.md`, `docs/asset-task.schema.json`, `docs/mcp.md` — contrato de handoff, schema e ferramentas MCP.
- `docs/comfyui.md`, `scripts/comfyui-client.mjs`, `workflows/comfyui/` — consulta de status, geração explícita de concept PNG com checkpoint instalado e requisitos planejados de hardware/setup.
- `src/App.jsx`, `electron/main.cjs`, `electron/manual-artifacts.cjs`, `electron/external-tools.cjs` — UI real, abertura de ferramentas, IPC e validação manual.
- `electron/workflow-contracts.cjs`, `electron/workflow-runner.cjs`, `electron/workflow-run-store.cjs`, `electron/resume-workflow.cjs` — contratos humanoides, estados, gates, validação e retomada.
- `docs/humanoid-workflow-research.md` — implementação exata, comparação de providers, fontes/licenças, requisitos Blender, testes e bloqueios.
- `scripts/spriteforge_launcher.py`, `package.json` — bootstrap, detecção, modelos e empacotamento.
