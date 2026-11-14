# Roadmap de capacidades independentes — proposta de evolução da Lia Forge

- **Data:** 2026-11-14
- **Branch:** `arena/624582f5-lia-forge`
- **Estado:** `PROPOSED`. Nada aqui está autorizado para implementação.
- **Base:** [`INDEPENDENT-CAPABILITIES-AND-LEARNING-REPORT.md`](INDEPENDENT-CAPABILITIES-AND-LEARNING-REPORT.md) (fichas K-01 a K-31) e [`INDEPENDENT-ARCHITECTURE-REVIEW.md`](INDEPENDENT-ARCHITECTURE-REVIEW.md) (achados C-, R-, G-, decisões DEC-, fatia única).
- **Regra de origem:** as capacidades vêm de ideias gerais e de tecnologias públicas. Nenhum código, nome de API ou texto dos materiais de referência de terceiros deve ser usado na implementação.

---

## 1. Princípios deste roadmap

1. **Evoluir antes de criar.** Cada item aponta primeiro para o módulo existente que deve crescer. Módulo novo só quando não há dono.
2. **Não competir com a fatia única.** A revisão de arquitetura recomenda uma fatia: do GLB do usuário ao spritesheet aprovado e exportado, em `main`, com Blender real. As ondas abaixo **reforçam** essa fatia (onda 0) ou vêm **depois** dela.
3. **Um contrato, vários consumidores.** O relatório de verificação e o evento "artefato mudou" são definidos uma vez e usados por QA, viewport, MCP e revisão humana.
4. **Sem dependência nova na onda 0.** Tudo o que reforça a fatia usa o que já está no projeto.
5. **Consentimento é mecanismo.** Onde os materiais usam texto para conter o agente, a Lia Forge usa gate.
6. **Estados honestos.** Cada entrega declara `IMPLEMENTED`, `EXECUTED` ou `VALIDATED`, e o relatório de verificação lista degraus não executados com motivo.

---

## 2. Decisões de produto que condicionam o roadmap

Nenhuma destas decisões é minha. Cada uma bloqueia os itens indicados.

| # | Decisão | Alternativas | Recomendação | Bloqueia |
|---|---|---|---|---|
| **E-1** | Geração procedural por código será capability da Lia Forge? | A) Não. B) Sim, como provider opcional em página isolada. C) Sim, nativa. | **A agora; reavaliar B após a onda 2.** A fatia única não depende disso. | K-01, K-02 (parte vetorial), K-27, K-18 |
| **E-2** | Modelos de blocos (formato de projeto do Blockbench) entram como segunda via de autoria? | A) Não; Blender é a única. B) Só importação para GLB. | **A**, até haver demanda concreta. | — |
| **E-3** | Onde roda código gerado por agente? | A) Só em página isolada, sem Node e sem rede. B) Processo restrito no sistema. C) Livre no sistema. | **A como regra permanente.** | K-27 |
| **E-4** | Onde ficam materiais de terceiros em avaliação? | A) Fora do Git. B) Repositório privado separado. C) No repositório do produto. | **A ou B.** | Plano da §8 |
| **E-5** | O validador glTF oficial entra como dependência? | A) Não; só o inspetor próprio. B) Sim, como segunda opinião opcional em desenvolvimento e teste. C) Sim, em produção. | **B.** É Apache-2.0, sem dependências transitivas; o inspetor próprio continua sendo a fonte das medidas. | Parte de K-09 |
| **E-6** | UV, textura e animação: quem executa? | A) Só o adapter Blender. B) Implementação própria fora do Blender. | **A.** Blender é a ferramenta de autoria; reimplementar é duplicar. | K-05, K-06, K-07 |
| **E-7** | Cena de composição: código livre ou declarativa? | A) Página de código livre. B) Lista declarativa de assets e transformações. | **B.** | K-18 |

Decisões da revisão de arquitetura que continuam valendo como pré-condição: DEC-01 (como o código chega a `main`), DEC-03 (núcleo mínimo de contratos), DEC-06 (HTTP só em desenvolvimento), DEC-12 (MCP só leitura primeiro), DEC-14 (registro único de decisões).

---

## 3. Prioridades

Quatro ondas. A numeração segue a da revisão (P0 a P3) para que os dois documentos se leiam juntos.

### Onda 0 — reforço da fatia única (P0)

Só evolução de módulos existentes. Nenhuma dependência nova. Nenhuma decisão de produto pendente.

| Item | Ficha | O que muda | Módulo que evolui |
|---|---|---|---|
| 0.1 | K-14, K-12 | Contrato único de relatório de verificação: estado técnico, medidas, achados com código, evidências, degraus executados e não executados, revisão humana que nasce pendente | `shared/qa/validators.mjs`; contratos `ValidationResult` e `HumanReview` |
| 0.2 | K-09 | Inspeção de GLB ganha extensão espacial, checagem de valores finitos e limites por asset (orçamento de triângulos, extensão com tolerância, clipes obrigatórios) | `shared/model3d/glb.mjs` |
| 0.3 | K-10 | Medição de PNG ganha lados tocados, bordas duras e níveis de alfa; expectativas por tipo de asset | `shared/qa/png-codec.mjs` |
| 0.4 | K-11 | Código estável e correção sugerida em todo achado de validador e em todo bloqueio do preflight | `shared/qa/validators.mjs`, `shared/qa/preflight.mjs` |
| 0.5 | K-08 | Exportação atômica, recusa de sobrescrita sem pedido, proibição de exportar sobre fonte, confinamento após resolver links | `shared/services/studio-service.mjs` |
| 0.6 | K-04 | Motor nunca executa pré-requisito ausente; plano registra o que cada passo invalida | `shared/engine/dag.mjs`, `shared/orchestrator/planner.mjs` |
| 0.7 | K-28 | Escritor único com trava para o registro de assets; chave desconhecida é erro | `shared/assets/manager.mjs` |
| 0.8 | K-13 (parte) | As vistas do turntable do Blender passam a ser artefatos de evidência ligados à versão do asset | `scripts/blender_spritesheet.py`, adapter Blender |

### Onda 1 — contratos compartilhados e primeira visualização (P1)

| Item | Ficha | O que muda | Módulo que evolui ou nasce |
|---|---|---|---|
| 1.1 | K-16 | Evento único "artefato mudou" emitido pelo armazenamento de artefatos, via IPC | Armazenamento de artefatos; `electron/preload.cjs` |
| 1.2 | K-15, K-17, K-19 | Viewport Fase 1 com descarte explícito, estado vazio, preservação de câmera e de reprodução, rótulo do artefato e da versão em exibição | Novo módulo de viewport, conforme `docs/threejs-3d-environment/` |
| 1.3 | K-13 | Captura pelo próprio Electron com sinal explícito de pronto ou erro; vistas padronizadas | Viewport + processo principal |
| 1.4 | K-25 | Preflight ganha o segundo tempo: ação exata por bloqueio, confirmação por comando, registro de consentimento, modo de fumaça | `shared/qa/preflight.mjs`; contrato `ConsentRecord` |
| 1.5 | K-26 | Rota de saúde com identidade e revisão; regra de reuso; nunca adotar instância de outro espaço | `shared/http/api-policy.mjs` |
| 1.6 | K-24 | Ferramentas MCP de leitura com esquema de saída; leitura do relatório de verificação | `scripts/spriteforge-mcp.mjs` |
| 1.7 | K-23 | Tabela de capabilities gerada do registro; teste que falha com id inexistente em documento | `shared/capabilities/registry.mjs`; teste novo |
| 1.8 | K-21 | Parte verificável do briefing como dados, alimentando os limites de 0.2 e 0.3 | Planner; `shared/ui/journey.mjs` |
| 1.9 | K-03 | Modo compacto de atlas; regra "animação e tiles em grade"; extrusão de borda | `shared/imaging/core.mjs`, `shared/destinations/profiles.mjs` |
| 1.10 | E-5 = B | Validador glTF oficial como segunda opinião em teste | Dependência de desenvolvimento |

### Onda 2 — largura controlada (P2)

| Item | Ficha | O que muda | Módulo |
|---|---|---|---|
| 2.1 | K-20 | Formato de Skill com "não cobre", "autoridade" e contrato de delegação; primeiras Skills próprias (§6) | `SKILLS-KNOWLEDGE-ENGINE.md` → implementação |
| 2.2 | K-07 | Amostrador de animação glTF puro; relatório de continuidade de movimento | `shared/model3d/`; `validateAnimationLoop` |
| 2.3 | K-29 | Comparador de duas versões de GLB; "edição manual é entrada válida" no planner | `shared/model3d/glb.mjs`; planner |
| 2.4 | K-05, K-06 | Jobs de UV e de bake no Blender Bridge, com verificação pós-etapa; variantes de textura no contrato de asset | Blender Bridge; contratos de asset |
| 2.5 | K-30 | Artefato manual com especificação verificável e registro de direitos | `electron/manual-artifacts.cjs` |
| 2.6 | K-22 | Paleta do projeto como dados, ligada à contagem de cores | Perfil visual; `shared/qa/png-codec.mjs` |
| 2.7 | K-31 | Informações de build, lista de hashes, recusa de árvore suja | Empacotamento |
| 2.8 | K-18 (parte) | Marca de "prévia não oficial" em artefatos | Armazenamento de artefatos |

### Onda 3 — condicionada a decisão (P3)

| Item | Ficha | Condição | O que seria |
|---|---|---|---|
| 3.1 | K-27 | E-3 = A e E-1 ≠ A | Executor isolado para geradores |
| 3.2 | K-01 | E-1 = B ou C | Provider de geração procedural 3D |
| 3.3 | K-02 | E-1 = B ou C | Camada vetorial 2D |
| 3.4 | K-18 | E-7 = B | Cena de composição declarativa |

---

## 4. Dependências entre capacidades

Leitura: "A → B" significa que B precisa de A.

```text
ONDA 0
  0.1 relatório ──┬─→ 0.2 GLB ──────────┐
                  ├─→ 0.3 PNG           │
                  ├─→ 0.4 códigos       │
                  └─→ 0.8 evidência     │
  0.6 motor ──────→ (independente)      │
  0.5 exportação ─→ (independente)      │
  0.7 escritor único → (independente)   │
                                        ▼
ONDA 1
  0.7 ─→ 1.1 evento ─→ 1.2 viewport ─→ 1.3 captura
  0.2 ─────────────────→ 1.2 (medidas do inspetor)
  0.1 ─→ 1.6 MCP leitura
  0.1 + 0.2 + 0.3 ─→ 1.8 briefing verificável
  0.4 ─→ 1.4 consentimento
  1.5 saúde do servidor (independente; só em modo de desenvolvimento)
  1.7 documentação gerada (independente)
  1.9 atlas compacto (independente)
  0.2 ─→ 1.10 validador oficial como segunda opinião
                                        ▼
ONDA 2
  1.6 + 1.4 ─→ 2.1 Skills
  0.2 ─→ 2.2 amostrador ─→ (melhora 1.2)
  0.2 + 0.6 ─→ 2.3 comparador
  0.1 + Blender Bridge ─→ 2.4 UV e bake
  0.1 ─→ 2.5 artefato manual verificável
  0.3 ─→ 2.6 paleta
  1.1 ─→ 2.8 prévia não oficial
                                        ▼
ONDA 3
  E-3 ─→ 3.1 executor ─→ 3.2 / 3.3
  1.2 + 2.8 ─→ 3.4 cena
```

Pontos de atenção:

- **0.1 é a raiz.** Sem o contrato do relatório, cada validador continua com formato próprio e nada mais se encaixa.
- **1.1 antes de 1.2.** A viewport não deve observar disco; deve ouvir o armazenamento.
- **2.1 depois de 1.4 e 1.6.** Skills só fazem sentido quando há ferramentas de leitura e fluxo de consentimento para elas chamarem.
- **Nada da onda 0 depende de decisão pendente.** Pode ser especificado em detalhe assim que DEC-01 resolver onde o código vive.

---

## 5. Critérios de aceitação

Objetivos e verificáveis. "Fixture" é um arquivo pequeno e sintético versionado com os testes.

### Onda 0

| # | Critério |
|---|---|
| A0-1 | Existe um esquema versionado do relatório de verificação; todo validador devolve esse formato; um teste de contrato falha se um validador devolver outro. |
| A0-2 | O relatório nasce com revisão humana pendente; um teste prova que nenhuma rota automática (IPC, HTTP, MCP) consegue gravá-la como aprovada. |
| A0-3 | O relatório lista os cinco degraus de verificação; degrau ausente invalida o relatório; degrau não executado traz motivo. |
| A0-4 | A inspeção de GLB devolve extensão nos três eixos; para um cubo de fixture de lado 2, o resultado é 2 ± 0,001 em cada eixo. |
| A0-5 | Seis fixtures defeituosas de GLB (truncado, comprimento declarado errado, valor não finito, sem malha, acima do orçamento, clipe ausente) reprovam, cada uma com código distinto. |
| A0-6 | A medição de PNG devolve lados tocados, bordas duras e níveis de alfa; fixtures de 8×8 com resultado conhecido passam para cada medida. |
| A0-7 | Todo código de achado tem entrada num catálogo com causa e correção; um teste falha se houver código sem entrada. |
| A0-8 | Exportar não altera o hash de nenhum arquivo de fonte; exportar sobre arquivo existente sem a opção explícita falha; interromper a exportação não deixa arquivo parcial. |
| A0-9 | Caminho de exportação que atravessa link simbólico para fora da raiz é recusado. |
| A0-10 | Com um pré-requisito ausente, o motor não inicia nenhum processo e devolve bloqueio nomeado. |
| A0-11 | Dois escritores simultâneos no registro de assets não perdem dados; chave desconhecida é rejeitada. |
| A0-12 | Cada execução de render registra as vistas do turntable como evidências com o hash do asset. |

### Onda 1

| # | Critério |
|---|---|
| A1-1 | Gravar um artefato emite exatamente um evento com identificador e hash; dez gravações em cem milissegundos produzem uma só recarga na viewport. |
| A1-2 | Recarregar o mesmo asset preserva posição e alvo da câmera, clipe, tempo, velocidade e estado de reprodução (teste automatizado compara antes e depois). |
| A1-3 | Trocar de asset durante uma carga descarta a carga antiga e libera seus recursos; cem ciclos de abrir e fechar não aumentam a memória além de um limite definido. |
| A1-4 | Arquivo corrompido não substitui a versão em exibição; a mensagem de erro aparece e a versão anterior continua. |
| A1-5 | O palco mostra identificador e hash do artefato em exibição, iguais aos do armazenamento. |
| A1-6 | A captura espera o sinal de pronto; erro de carga reprova a captura; quatro vistas de um cubo de fixture batem com as imagens esperadas dentro de tolerância. |
| A1-7 | Sem confirmação, nenhum processo de instalação é iniciado; com confirmação, o registro de consentimento contém o comando literal, a data e o que foi baixado. |
| A1-8 | Requisição com `Host` externo recebe 403; uma segunda instância do mesmo espaço reutiliza a primeira; instância de outro espaço não é adotada. |
| A1-9 | Toda ferramenta MCP de leitura tem esquema de saída testado; nenhuma ferramenta de leitura grava em disco. |
| A1-10 | Um id de capability inexistente num documento faz o teste falhar. |
| A1-11 | Alterar um limite no briefing altera o resultado da verificação do mesmo arquivo. |
| A1-12 | No atlas compacto, nenhum retângulo se sobrepõe, todos cabem na folha, a mesma entrada gera a mesma saída, e recortar pelo JSON reproduz as imagens originais bit a bit. |
| A1-13 | A viewport Fase 1 é testada em Chromium real, e o backend gráfico do hardware-alvo é registrado. |

### Onda 2

| # | Critério |
|---|---|
| A2-1 | Cada Skill tem um caso de teste "pedido → Skill escolhida → capabilities invocadas"; verificação estática prova que nenhuma Skill contém comando de instalação ou de rede fora do fluxo de autorização. |
| A2-2 | Um clipe de fixture com tranco conhecido é sinalizado; um clipe suave não é. |
| A2-3 | Dois GLB com diferença conhecida produzem o relatório esperado; dois idênticos produzem relatório vazio. |
| A2-4 | Após o job de UV, toda primitiva tem coordenadas de textura em [0, 1] e a folga mínima entre ilhas é respeitada; trocar de variante de textura não altera os bytes do modelo. |
| A2-5 | Entrega manual com dimensões erradas é recusada; sem registro de direitos, fica bloqueada. |
| A2-6 | Asset com cor fora da paleta do projeto é sinalizado. |
| A2-7 | Build a partir de árvore com alterações não commitadas falha; todo arquivo de terceiros embutido aparece na lista de componentes. |
| A2-8 | Exportar uma prévia não altera o hash de nenhum arquivo oficial. |

### Onda 3

| # | Critério |
|---|---|
| A3-1 | Quatro geradores hostis de teste (rede, leitura de arquivo, laço infinito, alocação sem limite) são barrados e relatados. |
| A3-2 | Três formas de referência geradas passam em A0-4 e A0-5 e têm hash idêntico em duas execuções. |

### Critério transversal de independência

| # | Critério |
|---|---|
| AX-1 | Nenhum arquivo do repositório contém código, nomes de API ou textos dos materiais de referência; a revisão de cada entrega confirma que a implementação partiu deste roadmap e de documentação pública. |
| AX-2 | Toda dependência nova entra com versão fixada, licença registrada e decisão anotada. |

---

## 6. Divisão recomendada entre os agentes especializados

Proposta de responsabilidade. **Não inicia nenhuma tarefa**; cada frente depende de autorização.

| Agente | Itens | Entregáveis esperados | Não deve |
|---|---|---|---|
| **Arquitetura e contratos** (transversal) | 0.1, 0.4, 0.6, 0.7, 1.1, 1.7, 1.8 | Esquema do relatório; catálogo de códigos; evento de artefato; briefing verificável | Criar segundo motor ou segundo registro |
| **QA e validação** (pode ser o mesmo da linha acima) | 0.2, 0.3, 0.5, 1.9, 1.10, 2.2, 2.3, 2.6 | Extensões dos inspetores; fixtures; atlas compacto; comparador | Introduzir dependência sem E-5 decidida |
| **Blender** | 0.8, 2.4 | Vistas como evidência; modo de forma sem textura; jobs de UV e bake com verificação pós-etapa | Reimplementar empacotador de UV; executar add-ons |
| **Three.js** | 1.2, 1.3, depois 3.4 | Viewport Fase 1 com os requisitos de K-15 a K-17 e K-19; captura | Observar disco; criar segundo domínio de asset; embutir biblioteca fora do gerenciador de pacotes |
| **UI/UX** | Interface de 0.1 (revisão pendente), 1.2 (painéis), 1.4 (consentimento) | Fluxo de revisão; biblioteca, palco e inspetor; diálogo de consentimento por comando | Mostrar "validado" sem evidência |
| **Agentes, Skills e MCP** | 1.6, 2.1, 2.5 | Ferramentas de leitura; formato de Skill; Skills próprias | Dar poder de escrita a ferramenta antes de DEC-12 |
| **Segurança** (revisão transversal) | 0.5, 1.4, 1.5, 3.1 | Revisão dos critérios A0-8, A0-9, A1-7, A1-8, A3-1 | — |

### Skills próprias sugeridas (onda 2)

Escritas do zero, sobre capabilities da Lia Forge. Cada uma com "quando usar", "não cobre" e referências sob demanda.

| Skill | Cobre | Capabilities |
|---|---|---|
| Roteador de produção | Escolher a Skill e a ordem; regras transversais (menor etapa suficiente, nunca regenerar sem pedido) | — |
| Verificação de asset | Escada de verificação; leitura do relatório; como relatar degraus não executados | `model3d.inspect`, validadores |
| Leitura de medidas de sprite | O que cada medida de PNG significa e o que conferir por tipo de asset | Validadores de PNG e de spritesheet |
| Escolha de atlas | Grade ou compacto; acesso por nome | `render.atlas` |
| Briefing verificável | Quais dados pedir ao usuário e como viram limites | Planner |
| Preparação de ambiente | Ler o preflight; pedir consentimento por comando; nunca instalar por garantia | Preflight |
| Revisão de forma em 3D | Conferir números antes de imagens; vistas padronizadas; devolver crítica por parte | `render.turntable`, viewport |

---

## 7. Sequência de implementação

Ordem recomendada, supondo que DEC-01 esteja resolvida e a fatia única esteja em curso.

| Passo | Itens | Por que nesta ordem | Portão de saída |
|---|---|---|---|
| 1 | 0.1 | Raiz de dependências; define o formato que todos consomem | A0-1, A0-2, A0-3 |
| 2 | 0.2, 0.3, 0.4 (em paralelo) | Enchem o relatório com medidas e códigos | A0-4 a A0-7 |
| 3 | 0.5, 0.6, 0.7 (em paralelo) | Integridade de exportação, do motor e do registro | A0-8 a A0-11 |
| 4 | 0.8 | Primeira evidência visual sem dependência nova | A0-12 |
| — | **Fim da onda 0: a fatia única passa a ter verificação, evidência e revisão pendente** | | |
| 5 | 1.1 | Pré-requisito da viewport | A1-1 |
| 6 | 1.7, 1.8, 1.9, 1.10 (em paralelo, independentes da viewport) | Baixo risco, alto retorno de coerência | A1-10, A1-11, A1-12 |
| 7 | 1.2, depois 1.3 | Viewport e captura | A1-2 a A1-6, A1-13 |
| 8 | 1.4, 1.5, 1.6 (em paralelo) | Consentimento, servidor e leitura por MCP | A1-7, A1-8, A1-9 |
| — | **Fim da onda 1** | | |
| 9 | 2.2, 2.3, 2.5, 2.6, 2.8 | Extensões sobre contratos já estáveis | A2-2, A2-3, A2-5, A2-6, A2-8 |
| 10 | 2.4 | Depende do Blender Bridge existir | A2-4 |
| 11 | 2.1 | Skills por último na onda: precisam de ferramentas e de consentimento prontos | A2-1 |
| 12 | 2.7 | Junto com o instalador | A2-7 |
| — | **Reavaliar E-1** com os dados de uso | | |
| 13 | Onda 3, se decidida | | A3-1, A3-2 |

O que **não** fazer fora de ordem:

- Viewport antes do evento de artefato.
- Skills antes das ferramentas de leitura.
- Qualquer gerador de código antes do executor isolado.
- Qualquer dependência nova antes da decisão correspondente.

---

## 8. Plano de remoção dos arquivos compactados de terceiros

**Estado: plano. Nada foi executado. A reescrita de histórico aguarda autorização.**

### 8.1 O que está publicado

Quatro arquivos em `tools/`, adicionados por um único commit. Identificados aqui por caminho genérico, tamanho e identificador de blob; os nomes de arquivo estão no relatório de avaliação (§2) e no próprio commit.

| Blob (Git) | Tamanho | SHA-256 (prefixo) | Corresponde a |
|---|---|---|---|
| `950ef4f4092b…` | 5.457.225 bytes | `de72743f4bde` | Referência A |
| `91e620ec99fc…` | 984.113 bytes | `bbf566bd35bc` | Referência C |
| `bc87dd1819b1…` | 745.645 bytes | `016c2f170f36` | Referência B (versão atual) |
| `d91c246261fd…` | 710.094 bytes | `b21c0efc2544` | Referência B (versão anterior) |

### 8.2 Commits e referências afetados

Verificado nesta sessão pela API do GitHub e por `git ls-remote`.

| Verificação | Resultado |
|---|---|
| Commit que introduz os arquivos | `7fcde2b` ("External Tools"), enviado pela interface web do GitHub |
| Commits descendentes (carregam os arquivos na árvore) | `73ecbbe` (relatório de avaliação) e os commits desta etapa |
| Commit imediatamente anterior, limpo | `a6a679b` (revisão de arquitetura) |
| Branches que contêm `7fcde2b` | **Só** `arena/624582f5-lia-forge` |
| `main` | Não contém (está atrás, em `6bd9a5a`) |
| Outras cinco branches `arena/*` | Não contêm (divergem em `6bd9a5a` ou em `13dc4c7`) |
| Tags | Nenhuma no repositório |
| Releases | Nenhuma |
| Pull requests a partir desta branch | Nenhum |
| Referências `refs/pull/*` (1, 2, 3) | Não contêm os quatro arquivos |
| Forks | Nenhum |
| Proteção da branch | Não protegida |

Observação fora do escopo: existe um quinto arquivo compactado, `docs/Lia.zip` (33 KB), em outras duas branches e na referência do PR nº 1. **Não é um dos materiais avaliados**, não foi inspecionado e não entra neste plano. Fica registrado para decisão separada.

### 8.3 Estado final desejado

```text
antes:  6bd9a5a ─ a6a679b ─ 7fcde2b ─ 73ecbbe ─ (commits desta etapa)
                            ▲ adiciona os 4 arquivos

depois: 6bd9a5a ─ a6a679b ─ 73ecbbe' ─ (commits desta etapa)'
                            sem tools/, com os relatórios intactos
```

Preservados, com conteúdo idêntico byte a byte:

- `docs/INDEPENDENT-ARCHITECTURE-REVIEW.md`
- `docs/EXTERNAL-TOOLS-INTEGRATION-ASSESSMENT.md` (mantém nomes, hashes e a menção ao commit original, como registro de proveniência)
- `docs/INDEPENDENT-CAPABILITIES-AND-LEARNING-REPORT.md`
- `docs/INDEPENDENT-CAPABILITIES-ROADMAP.md`
- Todo o conteúdo herdado de `main`

### 8.4 Procedimento proposto

1. **Registro antes de tocar em nada:** anotar o SHA atual da ponta da branch e os hashes SHA-256 dos quatro documentos.
2. **Reescrever localmente:** recriar a branch a partir de `a6a679b`, reaplicando só os commits de documentação e descartando `7fcde2b` (`git rebase --onto a6a679b 7fcde2b`). Os commits reaplicados recebem novos SHAs.
3. **Verificar localmente, antes de enviar:**
   - `tools/` não existe na árvore de nenhum commit da branch;
   - nenhum dos quatro identificadores de blob é alcançável a partir da branch;
   - os quatro documentos têm os mesmos hashes do passo 1;
   - a diferença entre a ponta nova e a antiga é exatamente a remoção dos quatro arquivos.
4. **Enviar com substituição protegida:** `git push --force-with-lease` **apenas** para `arena/624582f5-lia-forge`. A opção recusa o envio se a branch remota tiver mudado desde a leitura.
5. **Verificar no remoto:** a árvore da ponta não lista `tools/`; a comparação com `a6a679b` mostra só documentos.
6. **Limpar o ambiente de trabalho:** expirar o registro de referências e coletar objetos soltos no clone local; apagar as cópias temporárias extraídas fora do repositório.

### 8.5 O que a reescrita **não** resolve — e o que precisa ser feito além dela

Este é o ponto que um simples "apagar e commitar" esconderia, e que a reescrita sozinha também não fecha.

| Resíduo | Por que persiste | Ação | Quem |
|---|---|---|---|
| Commits antigos acessíveis pelo SHA no GitHub | O GitHub mantém commits sem referência até a coleta de lixo do servidor; a URL direta do commit `7fcde2b` e de seus blobs continua respondendo | Abrir pedido ao suporte do GitHub para remover os commits órfãos e as páginas em cache, informando os SHAs | Dono do repositório |
| Cópias na plataforma de agentes | O ambiente salva instantâneos e conjuntos de alterações da branch a cada turno | Verificar com a plataforma se há retenção e como expurgar | Dono do repositório |
| Clones e downloads de terceiros | O repositório é público; qualquer cópia já feita está fora de alcance | Nenhuma ação técnica possível; considerar avisar os autores dos materiais | Dono do repositório |
| Outros clones seus | Máquinas que fizeram `fetch` da branch guardam os objetos | Apagar a branch local e coletar lixo, ou clonar de novo | Dono do repositório |
| Nome e e-mail pessoal dentro de um dos pacotes | Estiveram públicos desde o commit `7fcde2b` | Avisar o autor é a conduta correta | Dono do repositório |
| Menção aos nomes no relatório de avaliação | Mantida de propósito, por instrução, como proveniência | Nenhuma | — |

Recomendação complementar, independente da reescrita: tornar o repositório privado enquanto o suporte do GitHub não confirmar a remoção dos commits órfãos reduz a janela de exposição.

### 8.6 Riscos da operação

| Risco | Mitigação |
|---|---|
| Perder um dos relatórios na reaplicação | Hashes anotados no passo 1 e conferidos no passo 3, antes do envio |
| Sobrescrever trabalho remoto novo | `--force-with-lease` |
| A plataforma de agentes estranhar a mudança de histórico da branch | A branch mantém o mesmo nome; se houver problema de sincronização, a ponta antiga está anotada e pode ser restaurada enquanto o servidor não coletar |
| SHAs citados em mensagens anteriores deixarem de existir | `73ecbbe` e os commits desta etapa ganham novos SHAs; os novos serão informados. `a6a679b` não muda |
| Alguém ter baseado trabalho em `7fcde2b` | Verificado: nenhuma outra branch contém esse commit |

### 8.7 Autorizações necessárias

Três decisões, separadas:

1. **Reescrever o histórico da branch e enviar com substituição** (passos 2 a 5).
2. **Limpar as cópias temporárias locais** (passo 6). Depois disso, os materiais deixam de estar disponíveis neste ambiente; qualquer conferência futura dependeria de você fornecê-los de novo.
3. **Destino de `docs/Lia.zip`** nas outras branches — fora deste plano, mas pendente.

---

## 9. Limitações deste roadmap

1. É proposta. Nenhuma estimativa de esforço foi feita, porque o código-base ainda não está em `main` e a equipe e sua capacidade não são conhecidas.
2. Depende de DEC-01. Enquanto o código viver numa branch não consolidada, os nomes de módulo aqui podem mudar.
3. Os critérios de aceitação da onda 2 em diante são menos precisos que os da onda 0, porque dependem de contratos ainda não definidos (Blender Bridge, formato de Skill).
4. A divisão entre agentes pressupõe as frentes citadas nos pedidos anteriores (Blender, Three.js, UI/UX, Agentes/Skills/MCP); as linhas "Arquitetura e contratos", "QA" e "Segurança" são sugestões minhas e podem não corresponder a agentes existentes.
5. O plano de remoção foi verificado contra o estado do remoto no momento da escrita; deve ser reconferido imediatamente antes da execução.
