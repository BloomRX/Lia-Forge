# Estado atual — Lia Forge

> Fonte de verdade operacional. Registra estado e evidência; não substitui o relato da tarefa.

Atualizado em: 2026-11-06

> As seções originais abaixo preservam snapshots anteriores e não devem ser reutilizadas como prova do checkout atual. Os adendos datados registram cada baseline/continuação. Auditoria por capacidade e sessão: [`docs/IMPLEMENTATION-AUDIT.md`](../docs/IMPLEMENTATION-AUDIT.md) e [`docs/PHASE-0-REPORT.md`](../docs/PHASE-0-REPORT.md).

## Onde estamos

| Item | Valor |
|---|---|
| Branch de trabalho | `arena/649f88bd-3dspritesheet` |
| Último commit validado na plataforma-alvo | Nenhum. Windows não foi executado neste ambiente. |
| Fase | Fase 0: auditoria técnica e preparação arquitetural executadas; a fase não é declarada encerrada (contratos, integração real e gate Windows pendentes). |

## Pronto e verificado na plataforma-alvo

- Nenhum item validado em Windows nesta sessão.

## Escrito e executado no sandbox, mas **não** validado na plataforma-alvo

- Documentação da marca, instruções `CLAUDE.md`/`AGENTS.md`, `memory-bank/`, rule de interface e skill neutra.
- Paths de workspace e pesos centralizados por runtime; padrão empacotado `%USERPROFILE%\Lia\Forge` e aviso explícito para workspace legado, sem mover dados.
- Destino compartilhável `LIA_MODELOS` e aceite de licença separado do repositório; o catálogo de pesos segue vazio.
- NSIS configurado para instalação por usuário e avisos/licenças incluídos no pacote.
- Legibilidade de rótulos elevada a 9 px e instruções prioritárias a 10 px; `npm run build` passa. Revisão visual ainda pendente: não há navegador/Chromium instalado no sandbox, e o layout desktop deve ser conferido no Windows.
- Testes locais: `npm test`, `npm run build`, `python -m unittest discover -s tests -v` (26 testes), `py_compile`, `node --check` e `git diff --check`.

## Bloqueios abertos

| O quê | Desde | O que destrava |
|---|---|---|
| Execução real do instalador e do app em Windows | 2026-10-28 | Gerar `npm run package:win` em Windows; abrir, confirmar paths/diálogo legado, fechar com segurança e testar desinstalação sem perder workspace. |
| Blender/ComfyUI reais | 2026-10-28 | Testes manuais na máquina do usuário, somente se ele iniciar/configurar as ferramentas. Nenhuma instalação é autorizada por esta tarefa. |
| Descoberta comum `lia.json` / ponte Waifu | 2026-10-28 | Contrato e consentimento definidos junto ao app Waifu; não inventar protocolo nem declarar integração atual. |

## Próximo passo verificável

1. Revisar e aprovar/ajustar os contratos `AssetType`, `OutputContract`, status de Run e migration policy em `docs/PHASE-0-REPORT.md`; em seguida delegar os pacotes Codex isolados nos prompts A–C, sem integrar no runner/store ainda.
2. Em paralelo, somente em ambiente próprio autorizado, executar checklist Windows/Blender/ComfyUI de `docs/lia-ecosystem-integration.md` e registrar divergências antes de qualquer `PASS`.

---

## Adendo — consolidação documental 2026-11-06

- Baseline antes de editar: branch ativa `arena/649f88bd-3dspritesheet`, `HEAD` `13dc4c7d2fde28f9324fd929482948ba34a87abf`; `origin/main` estava em `e9887118f9826e112e594b5c154a6b151071a0e6` e o checkout divergia do histórico `f274b01`.
- Working tree inicial já tinha `README.md` modificado e 92 caminhos não rastreados. Nenhum foi limpo, movido ou descartado; a alteração preexistente do README foi preservada e recebeu apenas links documentais.
- Esta missão alterou/criou somente documentação; nenhum código, dependência, modelo ou asset foi alterado. Não houve clone de repositório nem download de assets/modelos, instalação, chamada de serviço de geração/provider, consumo de créditos, commit ou push. Metadados e arquivos públicos foram consultados no GitHub/web para a pesquisa solicitada.
- Estado Git final: mesma branch/HEAD, zero staged, `README.md` modificado e 105 caminhos não rastreados (92 já existiam no baseline; 13 documentos novos foram criados).
- Smoke Node diretos: 12 passaram. `npm test` parou em `tests/mcp-smoke.mjs` por `@modelcontextprotocol/sdk` ausente; `npm run build` falhou porque `vite` não está instalado. Python: 30 executados, 29 passaram; a falha foi a verificação de árvore npm instalada. Não instalar dependências para mascarar o bloqueio.
- Sintaxe Node (33 arquivos), `py_compile` (9 arquivos), 7 JSONs, 94 links locais Markdown em 23 arquivos e whitespace em 22 arquivos documentais passaram. Windows/Blender/ComfyUI reais e revisão visual continuam não testados.
- A pesquisa dos nove projetos e arquitetura/roadmap estão em `docs/EXTERNAL-REPOSITORY-RESEARCH.md`, `docs/PRODUCT-ARCHITECTURE.md` e `docs/MASTER-ROADMAP.md`; leia o índice `docs/README.md` para precedência.

---

## Adendo — Fase 0 de preparação arquitetural, 2026-11-06

- Baseline desta continuação: branch ativa `arena/649f88bd-3dspritesheet`, `HEAD` `13dc4c7d2fde28f9324fd929482948ba34a87abf`, sem upstream, zero staged, `README.md` já modificado e 105 paths não rastreados já existentes. Final: branch/HEAD intactos, zero staged, o mesmo `README.md` modificado e 106 paths não rastreados (inclui um relatório novo); nenhum baseline foi removido. Sem commit/push.
- Auditoria direta, leitura integral de `docs/DECISIONS-AND-OPEN-QUESTIONS.md` e inspeção de `electron/spritesheet-manifest.cjs` registradas em [`docs/PHASE-0-REPORT.md`](../docs/PHASE-0-REPORT.md). Manifesto v1 é específico `character|item`; o adapter exige oito colunas. `sourceFrame` de character aceita qualquer inteiro, inclusive negativo; validação de PNG não decodifica pixels. Isso não é contrato genérico de workflow.
- Ambiente: Node `v22.22.3`, npm `10.9.8`, package-lock v3; `npm ci --ignore-scripts` instalou 415 pacotes declarados após aviso prévio. Scripts de instalação foram ignorados, Electron runtime não instalado. npm relatou 6 vulnerabilidades moderadas; nenhum `audit fix`/upgrade. Blender/ComfyUI não foram instalados.
- Correções locais nesta continuação: regex de referência MCP e import `Server` na tela Activity. Após elas, `node tests/mcp-smoke.mjs`, `npm test` (14 scripts), `python -m unittest discover -s tests -v` (30/30) e `npm run build` passaram. Não são E2E de UI/Windows/Blender/ComfyUI; nenhum provider real, upload, custo ou licença foi acionado.
- Atualizados `docs/README.md` e este memory-bank para apontar ao relatório atual. `node_modules`/`dist` são artefatos ignorados; dependências/versões, dados `.spriteforge/`, `README.md` preexistente, modelos e assets não foram alterados/instalados.
- Fase 0 continua **em andamento**: contracts, migration policy, graph core, consent/security hardening e E2E reais seguem proposta/planejado/bloqueado. Próximo passo: revisão de contratos pelo usuário; prompts Codex isolados A–C já estão no relatório.

---

Atualizar este arquivo no mesmo commit quando mudar uma decisão de produto, fase ou validação na plataforma-alvo. Não registrar o tip da branch.
