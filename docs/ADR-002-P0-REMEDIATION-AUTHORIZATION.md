# ADR-002 — Autorização de escopo para a remediação P0 (segurança, autorização e integridade)

**Data do registro:** 2026-10-25 (data informada pelo ambiente de trabalho nesta sessão)
**Divergência de relógio, registrada e não resolvida:** o relógio do sandbox em que os commits foram produzidos lê `2026-11-14 08:11 UTC`, e é o que o histórico do git mostra (`git log --format=%aI` nos commits desta remediação ⇒ `2026-11-14T08:10:24+00:00`). O nome do arquivo da revisão de origem coincide com o relógio do sandbox, e o ADR-001 traz `2026-10-25`. Nenhuma das datas foi inventada nem convertida aqui: as duas ficam visíveis para quem ler o histórico
**Documento de origem:** [INTEGRATED-RESEARCH-AND-ARCHITECTURE-REVIEW-2026-11-14.md](INTEGRATED-RESEARCH-AND-ARCHITECTURE-REVIEW-2026-11-14.md)
**Estado:** `ACCEPTED — SCOPE OF AUTHORIZATION ONLY` (não cria arquitetura nova nem substitui decisão arquitetural)
**Responsável pela decisão:** o usuário dono do repositório, por instrução direta nas tarefas desta linha de trabalho (DEC-A, opção A). Nenhuma pessoa foi nomeada por inferência
**ADR anterior:** [ADR-001-LIA-FORGE-DECISIONS.md](ADR-001-LIA-FORGE-DECISIONS.md) — permanece `ACCEPTED — ARCHITECTURE ONLY` com `Implementação/migração: NOT AUTHORIZED`, **inalterado**. Este ADR não o reescreve, não o revoga e não declara que decisões antigas foram substituídas: ele registra apenas o que passou a estar autorizado, e o que continua não estando
**Registro de evidência:** [T13-IMPLEMENTATION-EVIDENCE.md](T13-IMPLEMENTATION-EVIDENCE.md) §15
**Branch de trabalho:** `arena/649f88bd-3dspritesheet` (nada foi levado a `main`; ver "O que continua dependendo de autorização")

## 1. Contexto

O ADR-001 aprovou arquitetura e declarou explicitamente que a aprovação **não** autoriza código, testes, instalação, integração, execução de provider nem migração. Ainda assim, a linha de trabalho T13 acumulou 68 commits de implementação sem que houvesse, no repositório, registro do que estava autorizado — lacuna que a revisão integrada de 2026-11-14 levantou como **DEC-A** ("Regularizar o gate do ADR-001"), travando a consolidação (P0-8) e qualquer alegação de governança.

A mesma revisão levantou dez riscos P0. O usuário autorizou, para esta linha de trabalho, **exclusivamente** as correções P0 de segurança, autorização e integridade, organizadas em grupos, com método fixo: reproduzir o problema antes de modificar cada área; testes negativos e positivos; teste de mutação para provar que o teste detecta a regressão; sem refatoração ampla; sem alterar contratos além do necessário; mock ou smoke **não** valem como validação de segurança do sistema real.

A autorização veio organizada em sete grupos: (1) superfície HTTP/Vite, (2) autorização por run, (3) direitos e proveniência, (4) Blender e autoexec, (5) exportação e confinamento de caminhos, (6) persistência (três escritores do store legado) e (7) Content-Security-Policy. **Os grupos 1 a 5 foram executados; os grupos 6 e 7 não foram**, pelos motivos nomeados no §5 — não por esquecimento, e não porque a autorização tenha sido revogada.

Em auditoria posterior, o usuário dirigiu cinco pontos específicos (bind HTTP real, confinamento de caminhos na exportação, Blender `--disable-autoexec`, este ADR e a validação). Este documento é o item 4 dessa lista.

## 2. Decisões registradas

**D1 — Escopo autorizado.** Estão autorizadas as correções dos P0 de segurança, autorização e integridade da revisão integrada, e mais o achado **R-11 / P1-2** (confinamento de caminhos por prefixo de string), incluído por instrução explícita do usuário na segunda auditoria. A inclusão é extensão de escopo de trabalho: **não** reclassifica R-11 como P0 na revisão, que continua com a sua classificação original.

**D2 — Transporte HTTP (DEC-C, opção B).** A API HTTP do Studio é superfície de desenvolvimento, não caminho de produto: bind em loopback por padrão; token por sessão em toda rota mutável; lista fechada de hosts (nunca `allowedHosts: true`); recusa de requisição mutável sem `Origin` confiável; configuração de executável, concessão de autorização e revisão humana são **exclusivas do IPC**. Exposição de rede só por opt-in nomeado — `LIA_FORGE_HTTP_EXPOSE=1` (com `LIA_FORGE_HTTP_HOST` opcional) ou `npm run dev:expose` / `preview:expose` (`--mode expose`, que existe porque `VAR=1 comando` não é portável no Windows, alvo do produto). Nenhum script publicado em `package.json` passa `--host`, porque a flag da CLI do Vite sobrescreve `server.host` do config — medido: `vite --host 0.0.0.0` atendeu em endereço não-loopback mesmo com o config em loopback.

**D3 — Autorização por run (DEC-F, opção B).** A autorização é derivada do plano real do run (workflow, adapters, capabilities, destinos, entradas por SHA-256, teto de custo) e vinculada a fingerprint, com ações protegidas nomeadas (`send_data`, `cost`, `install_software`, `download_models_or_weights`). Sem ação protegida no plano, o registro diz `grantedBy: 'policy:no-protected-action'` — ausência de exigência não é ausência de autorização. O canal HTTP **não concede** autorização: só o IPC do Electron.

**D4 — Direitos e proveniência como gate.** Exportação e envio remoto consultam direitos, estado do run, revisão pendente e hash revisado, e falham fechado nomeando o motivo. `validated: true` deixa de ser literal: deriva de passo concluído, validadores aprovados e SHA-256 do arquivo igual ao do passo. Declaração humana de bloqueio não é afrouxada por proveniência anexada.

**D5 — Blender e autoexec (P0-7).** Toda invocação de Blender pelo produto carrega `--background --disable-autoexec` antes de `--python`; o plano de workflow recusa argumentos sem essas flags (inclusive argumentos vazios); e o script do repositório confere e desativa `preferences.filepaths.use_file_autorun` **antes** de `bpy.ops.wm.open_mainfile`, recusando abrir o arquivo quando não consegue conferir ou desativar. `.blend` de terceiro é tratado como entrada não confiável. **`--factory-startup` foi deliberadamente não adotado**: descarta as preferências da pessoa e, combinado com auto-save, pode sobrescrever `userpref.blend` — efeito colateral irreversível no ambiente de quem usa a máquina. O script também não chama `save_userpref`, então as preferências da pessoa não são gravadas.

**D6 — Confinamento de caminhos (R-11 / P1-2).** Contenção deixa de ser decidida por `startsWith` e passa a ser decidida por **caminho relativo** (sair da raiz produz `..`) e, quando o alvo ou seus pais existem, por **caminho real** (symlinks resolvidos até o ancestral existente mais próximo). A raiz de confinamento da exportação é a **pasta do run**, não o projeto inteiro: exportar aceita somente os artefatos autorizados daquele run. Sair dela é tratado como adulteração do registro do run e falha fechado, nomeando cada caminho recusado. O pacote de exportação confere também o caminho declarado de cada artefato (absoluto, `..` ou drive Windows recusam).

**D7 — Método de evidência.** Cada área foi reproduzida antes de ser modificada, com a medição gravada na mensagem de commit e no cabeçalho do teste correspondente. Cada correção tem teste negativo e positivo. Cada teste de segurança foi submetido a teste de mutação (reintroduzir o defeito e contar quantas checagens falham) — sem isso, o teste não é declarado útil. O que não pôde ser medido é reportado como não mensurável (ex.: separadores Windows e junctions em sandbox Linux), nunca como aprovado.

**D8 — Forma de entrega.** Commits separados por assunto na branch de trabalho, documentação de evidência atualizada, push somente fast-forward. Nenhuma integração em `main` (isso é DEC-B, decisão humana pendente).

## 3. O que foi fechado sob esta autorização

| Item da revisão | Estado | Onde |
|---|---|---|
| **P0-1** (R-01) superfície HTTP | **Fechado em código** | `6795da0`; bind efetivo em `97c0266` + `938c673` |
| **P0-2** (C-04/R-03/G-02) autorização por run | **Fechado em código**; reconciliação com a flag persistente continua aberta (ver §5) | `de5efb9` |
| **P0-3** (C-05/R-05) direitos como gate | **Fechado em código** | `357f50c` |
| **P0-4** (C-07/G-04/R-10) `validated` derivado | **Fechado em código** no caminho de exportação/proveniência; literais remanescentes em `shared/adapters/software.mjs` continuam abertos (ver §5) | `357f50c` |
| **P0-6** (R-02) agente expor a API | **Parcialmente fechado**: `open_panel` não passa mais `--host 0.0.0.0` e o bind é loopback. `shell: process.platform === 'win32'` segue presente em `scripts/spriteforge-mcp.mjs` (linhas 277, 629, 646) e **não** foi medido no alvo Windows | `97c0266` |
| **P0-7** (R-04/C-11) Blender autoexec | **Fechado em código, não validado no alvo**: nenhum Blender real foi executado nesta linha de trabalho | `2e3f7a5` |
| **P1-2** (R-11) confinamento por prefixo | **Fechado em código**, incluído por D1 | `ddd0ae4` |

"Fechado em código" significa: a correção existe, tem teste negativo e positivo, e o teste foi verificado por mutação. **Não** significa validação no alvo, nem segurança de produção.

## 4. Limites desta autorização

Este ADR **não** autoriza, e nada aqui deve ser lido como autorização para:

1. executar Blender real, ComfyUI real ou qualquer ferramenta externa; importar em engine de terceiro;
2. instalar add-ons, dependências novas, drivers, ou executar código de terceiro além do que já está no lockfile do repositório;
3. providers remotos, envio de dados externos, uploads, serviços pagos, gasto de GPU/API;
4. `merge` em `main`, `rebase`, `cherry-pick` de outras branches, `force push`, ou qualquer alteração nas branches dos especialistas;
5. alterar `scripts/generate_third_party_notices.py` (DEC-I, opção A: mantém-se intocado);
6. mudar contratos além do necessário para as correções acima, ou fazer refatoração ampla;
7. Three.js/viewport (DEC-N), Skills, runtime de agentes, MCP de escrita (DEC-L) e PoC com add-on de terceiro (DEC-M) — fora de escopo;
8. declarar qualquer capacidade como `VALIDATED`, homologada ou segura para produção.

## 5. O que continua dependendo de autorização específica

| Pendência | Decisão humana que a destrava | Por que não foi feita aqui |
|---|---|---|
| **P0-5** (C-10/R-09) três escritores do store legado, um sobrescrevendo o arquivo inteiro com o que o renderer envia — **grupo 6 do plano, não executado** | **DEC-E** (store novo em `.lia-forge/`, legado somente leitura) | A mitigação mínima da revisão ("um único módulo escritor no processo principal; os demais caminhos passam por ele; controle de concorrência") exige escolher qual dos três escritores vira o canônico e o que acontece com o caminho que hoje aceita o arquivo inteiro vindo do renderer. Isso é decisão de arquitetura de persistência (DEC-E), não correção pontual, e fazê-la sem a decisão seria refatoração ampla — vedada por D7/§4.6 |
| **CSP** do renderer, sem `unsafe-eval` e sem permissões amplas sem justificativa — **grupo 7 do plano, não executado** | decisão própria de política de conteúdo do app empacotado | Medido nesta sessão: `dist/index.html` tem **0** scripts inline e **0** `<style>` inline (só `link rel=stylesheet` e `script type=module src=`), então uma política restritiva é plausível no build; o dev-server serve **1** script inline (o preâmbulo do React Refresh, `import { injectIntoGlobalHook } from "/@react-refresh"`), que `script-src 'self'` bloquearia. As alternativas são (a) CSP restritiva só no app empacotado/build, sem CSP no dev, ou (b) CSP com nonce no dev. **Nenhuma das duas é verificável neste ambiente**: não há navegador nem Electron aqui, e uma diretiva errada em `connect-src`/`img-src` (HMR, `blob:`, `data:` das prévias) quebra a página sem que nada neste repositório detecte. Publicar cabeçalho de segurança não verificado violaria D7 |
| **P0-10** (C-06 restante) `reviews.json` sem escrita atômica/`assertSafeWriteTarget` e `reviewer` como texto livre inclusive por HTTP | mesma frente de revisão humana (contrato) | Toca o contrato de autoria da revisão: autoria deve vir do canal confiável, o que é mudança de contrato |
| Reconciliar a autorização por run com a flag persistente `providers.comfyui.authorization.granted` (`shared/integrations/provider-store.mjs`) | **DEC-F**, opção C (política persistente explícita) | A revisão trata C como decisão própria, posterior a B |
| Literais `validated: true` em `shared/adapters/software.mjs:182/380/643/709` | mesma frente de contratos de adapter | Derivar validação nesses adapters altera o que cada adapter declara |
| Verificação no alvo: `--disable-autoexec` na versão instalada do Blender, bind e `shell:` no Windows, GPU/Vulkan, app empacotado | **DEC-G** (versão-alvo do Blender) + **DEC-P** (autorizações operacionais: executar o Blender instalado, indicar a fixture e declarar seus direitos, `npm install`) | Sem elas, **P0-9 permanece aberto** e nada é `VALIDATED` |
| Licença dos scripts que importam `bpy` e são distribuídos (`scripts/blender_spritesheet.py`) | **DEC-H** (revisão jurídica do usuário) | Não é decisão técnica |
| Levar o código à linha principal (**P0-8**) | **DEC-B** | Merge/PR é decisão humana explícita |
| **DEC-J** (registro único de decisões), **DEC-K** (vocabulário de capabilities), **DEC-L** (MCP somente leitura), **DEC-M**, **DEC-N**, **DEC-O** | cada uma por si | Inalteradas por este ADR |

## 6. Desvios registrados

1. **`npm install --ignore-scripts` foi executado nesta linha de trabalho** para restaurar `node_modules` a partir do `package-lock.json` do próprio repositório, porque `tests/test_bootstrap.py::test_installed_npm_tree_matches_lockfile` falha sem `node_modules/.package-lock.json`. Nenhuma dependência nova foi declarada e nenhum script de postinstall de terceiro foi executado. Ainda assim, DEC-P lista "autorizar `npm install` das dependências de desenvolvimento já declaradas" como autorização a pedir: o desvio fica registrado aqui em vez de ser apresentado como rotina.
2. **`tests/studio-service-smoke.mjs` teve uma expectativa de mensagem atualizada** (caso de traversal: de "não produziu artefatos" para o motivo novo, que nomeia o confinamento e os caminhos recusados). A propriedade de segurança continua assertida; nada foi afrouxado.
3. **O teste de bind foi reescrito depois de publicado** (`938c673`): a primeira versão concluía exposição por probe externo, e este sandbox encaminha tráfego do endereço link-local para listeners em loopback, o que produzia falha intermitente. A evidência passou a ser o endereço do socket LISTEN lido do kernel e atribuído ao PID do processo medido. O caso está documentado no cabeçalho do teste.

## 7. Consequências

- O gate do ADR-001 deixa de estar em contradição silenciosa com o histórico: existe agora registro, com data e responsável, do que foi autorizado a ser implementado e do que não foi.
- A revisão integrada continua sendo a fonte dos achados; este ADR não altera a classificação de nenhum deles, e o estado dos P0 fechados é registrado lá (§3) com a mesma linguagem de "fechado em código, não validado no alvo".
- Nenhuma frente nova fica destravada por este ADR: consolidação (P0-8) e validação no alvo (P0-9) continuam dependendo de DEC-B, DEC-G e DEC-P.
