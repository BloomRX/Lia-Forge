# Fluxo humanoide: auditoria, contrato, providers e validação

> Documento de pesquisa delimitado ao caso humanoide, não arquitetura universal. Para a fonte de verdade por capability, consulte [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md); para múltiplas categorias/rotas, consulte [`ASSET-PIPELINES.md`](ASSET-PIPELINES.md). As seções históricas sobre o renderer Mixamo/Blender pertencem a uma tarefa anterior separada e **não foram retomadas nem executadas** nesta consolidação.

**Revisado em:** 2026-11-02

**Escopo:** primeira fatia para personagem humanoide estilizado de corpo inteiro. Este documento separa capacidades observadas em código de etapas apenas contratadas. Nenhum provider foi selecionado ou executado; não houve instalação, download de pesos, aceite de licença, envio de dados ou chamada paga.

## 1. Estado auditado do repositório

| Área | Evidência no código | Estado real |
|---|---|---|
| ComfyUI | `scripts/comfyui-client.mjs` consulta endpoint, lista workflows/checkpoints, envia um workflow escolhido, acompanha fila/history e salva imagens reais. `electron/main.cjs` valida o PNG e pede confirmação antes de enviar prompt/workflow a endpoint que não seja loopback. | **Adapter de conceito parcial, funcional somente quando o endpoint e um checkpoint já existem.** A saída é imagem 2D; não é modelo 3D nem conjunto de vistas ortográficas consistente. Não houve ComfyUI conectado neste sandbox. |
| Blender | `electron/blender-adapter.cjs` chama Blender sem shell, acompanha progresso/cancelamento e verifica PNG + JSON. `scripts/blender_spritesheet.py` importa `.blend`, `.glb`, `.gltf`, `.fbx`, `.obj` e `.stl`, procura malha visível, enquadra câmera e renderiza PNGs RGBA. | **Adapter de render funcional em código, sem execução real neste sandbox.** Blender não foi detectado aqui. O script não modela, não cria rig nem animações. |
| Personagem no Blender | Para `character`, o script exige animações solicitadas, ações correspondentes e um objeto `ARMATURE`; renderiza oito frames por ação. A busca por token completo recusa correspondências ambíguas e não confunde `run` com `running`. | **Pré-requisito explícito.** OBJ/STL estáticos não satisfazem rig/ações; FBX/GLB/GLTF só servem se realmente trouxerem rig e ações importáveis. A compatibilidade precisa ser verificada no Blender escolhido. |
| Item no Blender | Para `item`, o script gera turntable ortográfica; não aplica rig humanoide. | **Funcional em código** para item/arma/ferramenta já modelado; não houve render real. O caso não equivale a uma rota de ambiente/cenário. |
| Validação de spritesheet | `electron/spritesheet-manifest.cjs` exige manifesto schema 1 coerente: asset/gerador/tipo, origem e pivô globais, dimensões PNG/grade, nomes de animação únicos, um retângulo por célula, sequência de frames, pivô/duração e `sourceFrame` (personagem) ou `null` (item). `validateSpritesheetFiles` também compara as dimensões RGBA8 do PNG e as ações pedidas. | **Validação estrutural em código**, não valida pixels realmente transparentes, qualidade visual, coerência de pose, escala ou correção semântica do rig. Revisão visual continua obrigatória. |
| Registro manual | `electron/manual-artifacts.cjs` mantém referências/saídas por etapa e verifica localização/estado básico; marcar referências concluídas exige pelo menos três caminhos de imagem distintos. Conceito único do ComfyUI fica como `in_progress`, não conclui a prancha. Status legado com menos de três caminhos é mostrado como incompleto e bloqueia avanço normal, sem reescrever automaticamente o registro; os outputs existentes são preservados. | **Parcial.** A contagem não prova que as imagens sejam frente/perfil/costas coerentes; não comprova que um modelo abre nem que contém rig utilizável. Revisão humana continua obrigatória. |
| Pipeline provider-neutral | `electron/workflow-contracts.cjs` descreve vistas → modelo → auto-rig → animações → render 2D; `electron/workflow-runner.cjs` executa planos serialmente, mantém estados, logs, contratos, autorização, revisão e validação em disco. | **Infraestrutura implementada; pipeline bloqueado** porque os adapters/provedores de vistas, geração 3D, auto-rig e animação não foram escolhidos/registrados. O endpoint de inspeção apenas mostra o plano; não inicia essas etapas. |
| Persistência/retomada | `electron/workflow-run-store.cjs` grava/lista/lê snapshots locais. A retomada genérica compara parâmetros e fingerprints de entradas/outputs; a retomada desktop Blender aceita somente a allowlist da etapa e reconstrói o plano a partir do asset e modelo atuais, sem confiar no plano salvo. Entradas modificadas durante execução invalidam a conclusão e preservam outputs produzidos. | **Parcial.** A integração desktop persistida é específica à execução Blender. Retomada não reenvia automaticamente trabalhos externos/API ambíguos e pode reutilizar etapa somente após revalidação. |
| UI | `src/App.jsx` mostra o bloqueio humanoide, inspeciona o contrato, apresenta status de runs e permite retomar Blender. | **Parcial.** As ilustrações SVG e assets iniciais da tela são previews demonstrativos da interface, não outputs de geração. O build/preview JSX desta alteração não pôde ser validado porque Vite não está instalado. |
| ComfyUI/MCP, agentes e caminhos alternativos | `scripts/spriteforge-mcp.mjs`, handoff e schema conhecem principalmente personagem/item e o fluxo existente. | Agente é opcional. **Code → 2D, Manequim → 2D e ambiente/cenário ainda não são rotas executáveis de primeira classe.** A infraestrutura genérica de contratos não deve ser confundida com essas integrações concluídas. |

### Implementação desta fatia

- `electron/workflow-contracts.cjs`: contrato humanoide com cinco etapas e contratos explícitos de entradas/saídas.
- `electron/workflow-runner.cjs`: estados `planned`, `awaiting_authorization`, `running`, `failed`, `awaiting_review`, `validated`, além de `blocked`/`cancelled`; progresso, logs, autorização por escopo, revisão humana e validação real de arquivos. Nesta revisão, `readExact` foi tornado resiliente a leituras curtas legais do `FileHandle.read`, com regressão sintética.
- `electron/manual-artifacts.cjs`, `electron/main.cjs` e `scripts/spriteforge-mcp.mjs`: bloquear conclusão de uma prancha com menos de três imagens distintas; a imagem de conceito ComfyUI fica como progresso parcial. Status legado de uma só imagem é tratado como incompleto na UI/handoff e não desbloqueia avanço; nenhum registro antigo é reescrito automaticamente e os paths/arquivos são preservados.
- `electron/workflow-run-store.cjs`: persistência de snapshots no workspace, listagem/leitura e validação de IDs/caminhos.
- `electron/resume-workflow.cjs`: allowlist para não retomar automaticamente uma etapa que possa reenviar dados/cobrar de um provider.
- `electron/main.cjs`, `electron/preload.cjs` e `electron/ipc-guard.cjs`: APIs IPC com exigência de remetente e frame principal confiáveis. O handler ComfyUI remoto exige confirmação antes do envio; o cliente recusa redirects HTTP para não encaminhar prompts a outro host.
- `electron/blender-workflow-plan.cjs` e `electron/resume-workflow.cjs`: plano Blender tipado e allowlist estrita; a retomada usa modelo/ações/tamanho atuais e não clona plano persistido.
- `electron/spritesheet-manifest.cjs`: schema estrutural compartilhado entre o runner geral e o adapter Blender.
- `src/App.jsx` e `src/asset-progress.js`: cartão de fluxo humanoide bloqueado, inspeção de contrato e UI de retomada Blender; IDs de ação padrão em minúsculas com rótulos title case; estados legados de prancha com menos de três imagens são exibidos como incompletos sem alterar/apagar os outputs salvos.
- `tests/workflow-runner-smoke.cjs`, `tests/workflow-run-store-smoke.cjs`: testes focados em contratos, gates, falhas, integridade, logs, persistência e retomada; o runner também simula leituras GLB curtas.
- `tests/asset-progress-smoke.mjs` e `tests/manual-artifacts-smoke.cjs`: regressões de paths distintos, alias/caixa/separadores e estado legado incompleto; outputs existentes não são mutados. `tests/mcp-smoke.mjs` cobre um-conceito, três vistas e bloqueio do status legado, mas exige `@modelcontextprotocol/sdk` e permaneceu bloqueado neste sandbox.

### Contrato do fluxo

```text
Brief/prompt
  → vistas aprovadas: frente, lado e costas
  → modelo 3D
  → rig humanoide
  → ações solicitadas (por exemplo, idle/walk/run)
  → Blender: spritesheet PNG RGBA8 + manifesto JSON
```

Caso de aceitação reservado: humanoide estilizado de corpo inteiro, com ações `idle`, `walk` e `run`. O adapter espera oito amostras por ação (24 células no total), e os testes sintéticos verificam resolução de nomes sem ambiguidade e manifesto de três linhas × oito colunas. Isso **não** substitui abrir o modelo, confirmar deformação/loop/foot sliding e revisar visualmente os 24 frames gerados. Nenhuma execução real desse caso ocorreu.

As quatro etapas de provider têm revisão humana; o Blender continua sendo o adapter existente. As entradas de texto e arquivos ficam no contexto local do adapter e não são copiadas como texto cru aos logs; snapshots guardam hashes/resumos. A autorização registra ações, destino, descrição dos dados e estimativa de custo; se os dados/plano mudarem depois da autorização, ela volta a aguardar aprovação. A revisão revalida checksums e formatos antes de liberar a próxima etapa.

Retomada genérica só reutiliza uma etapa anterior quando workflow, adapter/provider/versão, parâmetros, autorização, contratos, fingerprints de entrada e outputs continuam compatíveis. Os outputs são revalidados em disco. GLTF JSON local inclui hashes de seus recursos externos; referências remotas, traversal e dependências que escapam por diretório simbólico são recusadas. O runner recalcula fingerprints depois do adapter: se uma entrada mudar durante a execução, não marca a etapa como concluída, mas preserva outputs já escritos para diagnóstico/retomada segura.

Os validadores genéricos conferem assinatura/estrutura de PNG, JPEG, WebP, JSON, GLB, glTF e dependências locais, Blender, FBX, OBJ, STL, BVH, GIF e MP4. Isso **não** substitui abrir e inspecionar um modelo, validar topologia/UV/texturas, weights/skinning, anatomia, movimento ou qualidade visual. O validador mais específico hoje é o do atlas/manifesto do Blender.

## 2. Providers: alternativas reais

A pesquisa é documental, feita nas fontes primárias ligadas abaixo e revisada em 2026-10-29. No snapshot consultado, o Meshy MCP oficial informava v0.6.6 (commit em 2026-10-26) e o SDK oficial Tripo v0.5.0 (commit em 2026-10-23). Compatibilidade, termos e preços podem mudar; a estimativa de 44 créditos Meshy é baseada no README consultado e precisa ser confirmada antes de qualquer uso. **Licença do repositório, licença dos pesos/modelo e direitos/termos do output são itens distintos.** Não foram aceitos termos nem baixados arquivos.

### Geração 3D local

| Opção | Entrada → saída / rig | Plataforma e requisitos publicados | Licenças / riscos e limitações |
|---|---|---|---|
| [Microsoft TRELLIS](https://github.com/microsoft/TRELLIS) | Texto ou imagem → representação 3D; há pipelines de mesh/3D Gaussians e export de mesh. O README recomenda modelos condicionados por imagem para melhor resultado. Não fornece rig/animação. | Testado em Linux e GPUs NVIDIA; README indica ≥16 GB VRAM e dependências CUDA. Não assumir Windows, AMD, Vulkan ou CPU. | Repositório sob MIT. A página do repositório não resolve sozinha a licença de cada checkpoint/dependência nem direitos de outputs; conferir o model card e arquivos de cada peso antes de baixar/usar comercialmente. |
| [Microsoft TRELLIS.2](https://github.com/microsoft/TRELLIS.2) | Imagem → asset 3D com materiais PBR e fluxo de export GLB; não faz auto-rig nem animação. | Modelo 4B; README indica Linux, NVIDIA ≥24 GB e CUDA 12.4. Não assumir Windows/AMD. | Código do repo sob MIT; licença específica do peso e de dependências/resultados precisa ser conferida no checkpoint. |
| [Tencent Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) | Imagem → geometria; etapa de texturização PBR separada. Sem auto-rig/animações. | Repositório declara Windows/macOS/Linux; configuração testada usa Python 3.10, PyTorch 2.5.1 + CUDA 12.4. Requisitos reportados: cerca de 10 GB VRAM shape, 21 GB texture ou 29 GB ambos. A alegação de Windows não comprova AMD. | Licença Community própria; exclui EU, Reino Unido e Coreia do Sul; exige condições/notices de distribuição e Powered by Tencent Hunyuan em usos cobertos; requer contato/licença se o produto ultrapassa o limiar de 1 milhão de usuários ativos mensais definido na licença. Tencent declara não reivindicar direitos sobre outputs, mas atribui ao usuário a responsabilidade. Ler a licença integral antes de aceitar/baixar. |
| [VAST TripoSR](https://github.com/VAST-AI-Research/TripoSR) | Uma imagem → malha; precisa de limpeza/retopologia/textura conforme o alvo. Não rigga nem anima. | README reporta aproximadamente 6 GB VRAM no preset padrão; não validamos execução CPU, Windows ou AMD. | O README e o arquivo do repositório declaram MIT para o código e pesos publicados ali. Isso não constitui garantia jurídica geral sobre o output ou dados de treino; revisar o material/versão efetivamente obtidos. |
| [Stability AI Stable Fast 3D](https://github.com/Stability-AI/stable-fast-3d) | Imagem → modelo com UV/textura e GLB; não faz rig/animação. | README reporta cerca de 6 GB VRAM por padrão e oferece caminho CPU; Windows é descrito como experimental. Não há validação de hardware nesta máquina. | O modelo é gated e usa Stability AI Community License, não MIT: uso comercial exige registro; organizações acima de US$1M de receita anual precisam licença Enterprise. O texto atribui ao usuário propriedade de outputs na relação entre as partes, dentro da lei, mas impõe atribuição/condições de distribuição e AUP. Código do repo não deve ser confundido com licença dos pesos. |

### Rigging/animação local

| Opção | Entrada → saída | Plataforma/licença | Limitações para a Lia Forge |
|---|---|---|---|
| [Seed3D Puppeteer](https://github.com/Seed3D/Puppeteer) | Pesquisa de auto-rigging e animação guiada por vídeo; o repo descreve geração de esqueleto/skinning e export de rig FBX, mas não foi verificado como clip game-ready nem como import no adapter atual. | Código Apache-2.0. README usa Python 3.10, PyTorch 2.1.1/CUDA 11.8 e `bpy==4.2.0`; checkpoints são componentes separados. | Licença dos pesos/checkpoints e compatibilidade Windows/AMD não foram verificadas; requer download de vários pesos e stack CUDA. Não é uma integração pronta no aplicativo. |
| Blender atual / rig manual | Importa e renderiza assets existentes; a execução atual exige armature e ações existentes para personagem. Ferramentas de rig manual exigem trabalho humano. | Blender foi instalado pelo usuário via Steam na máquina alvo, mas não existe no sandbox atual; plataforma alvo não foi exercitada. O adapter escolhe Eevee e não fixa um backend testado para esta execução. | **Não** é auto-rig. `.obj`/`.stl` estático não gera armature ou animações. Uma ação com nome parecido não prova que a animação deformou corretamente o mesh. |

### APIs em nuvem

| Opção | Capacidades e formatos publicados | Custo, dados e termos | Avaliação |
|---|---|---|---|
| [Meshy MCP Server oficial](https://github.com/meshy-dev/meshy-mcp-server) + [guia oficial](https://github.com/meshy-dev/Meshy-guide) | O release oficial consultado é v0.6.6 (2026-10-26). O README lista geração por texto/imagem/multi-imagem, `meshy_rig`, `meshy_animate` (até 10 ações em clips num arquivo) e `meshy_text_to_motion`. A documentação lista GLB/FBX/OBJ/USDZ/BLEND e mapas PBR; GLB/FBX são formatos importáveis pelo Blender, mas não foram testados com output real desta conta. | Estimativa **Meshy 7.1**: 20 créditos mesh-only +10 textura 2K/4K +5 rig +3×3 animações = **44 créditos**; textura 8K elevaria a estimativa a 49. Não inclui imagens/conceito, retries, ajustes ou custo monetário do plano. O README do MCP diz que API key exige Pro+, mas o guia oficial anuncia Free com 200 créditos/mês; o acesso da API e o plano elegível são inconsistentes entre páginas e precisam ser confirmados antes de escolher. O FAQ de negócio do guia diz que Free = CC BY 4.0 com atribuição e planos pagos = licença comercial privada sem atribuição; o FAQ de desenvolvedor diz que retenção varia por plano, permanente em Enterprise e menor nos planos abaixo, sem prazos publicados. Um FAQ documenta image-to-3D via URL pública. As páginas consultadas não resolvem uso de uploads para treino nem prazos de exclusão precisos; não enviar referências privadas antes de revisar os termos vigentes. MIT é só do código/guia/MCP, não automaticamente dos outputs. | **Candidato com custo de créditos mais quantificável, não selecionado:** opção de fallback se o acesso à API, plano, direitos e retenção forem confirmados. O cálculo de 44 créditos é uma referência documental, não cotação ou autorização. |
| [Tripo Developer JS SDK](https://github.com/Tripo-Developer/tripo-js-sdk) | Release oficial v0.5.0 (2026-10-23), API v3. O README demonstra explicitamente imagem→modelo, `rigCheck`, `rigModel` e `retargetAnimation` com `IDLE`, `WALK`, `RUN` e saída GLB — alinhamento direto ao caso de aceite. Conversão também lista GLTF/FBX/OBJ/STL/USDZ/3MF e perfil FBX `BLENDER`. O Blender adapter aceita GLB/GLTF/FBX; compatibilidade visual/rig real continua sem teste. | O SDK orienta criar chave no console e tem endpoints de balance/usage, mas não publica no README um requisito mínimo de plano nem uma tabela de preço por modelo/rig/clip. A criação de tasks pode cobrar por submissão; por isso não há estimativa defensável para três ações sem preço oficial/conta. URLs de modelo expiram ~5 min; isso é expiração do link, não regra de retenção/exclusão dos arquivos. `uploadFile` envia arquivos à API; arquivos grandes usam URL de storage pré-assinada. A licença MIT cobre o SDK, não os outputs/uso comercial. O README não resolve direitos de outputs, privacidade, uso para treino ou retenção de uploads. | **Melhor encaixe técnico para o teste `idle`/`walk`/`run`, não selecionado nem autorizado:** o exemplo oficial encadeia as três ações para um GLB; preço/plano e termos de dados precisam ser confirmados antes de qualquer chamada. |


#### Comparação de escolhas

- **Local:** não há, entre as opções verificadas, um pipeline local Windows/AMD comprovado que entregue de prompt/referências a personagem 3D rigado e animado. TRELLIS/TRELLIS.2/Hunyuan3D/Stable Fast 3D terminam principalmente em geometria/texturas; Puppeteer é pesquisa separada para rig/ação. A combinação precisa de hardware e pesos exatos ainda é desconhecida.
- **Nuvem:** Meshy e Tripo parecem mais próximos de um fluxo vertical com geração + rig/ações. APIs enviam dados para terceiros e podem cobrar; nenhum dado pode ser enviado sem aprovação explícita do usuário.
- **Recomendação condicional para o único caso de aceite:** Tripo é o melhor encaixe técnico documentado para a parte rig/animações porque o SDK oficial mostra image-to-model → rigCheck → rigModel → `IDLE`/`WALK`/`RUN` em um GLB. Compatibilidade com as três entradas frente/perfil/costas do contrato não foi estabelecida; isso **não** comprova encaixe para o fluxo inteiro. Não é seleção nem recomendação de compra: custo total, plano elegível, direitos comerciais e privacidade precisam ser confirmados antes. Se Tripo não fornecer cotação/termos suficientes, Meshy é alternativa com custo-base de 44 créditos mais explícito, mas o acesso à API tem informação conflitante entre README do MCP e guia. Não iniciar nenhum deles sem decisão e autorização do usuário. Para rota offline, coletar hardware exato e escolher uma combinação model/backend/licença; não inferir AMD/Vulkan/CUDA/CPU.

## 3. Pré-requisitos de importação, rig, animação e render Blender

1. **Entrada no workspace:** caminho relativo seguro, arquivo existente/não vazio e extensão entre `.blend`, `.glb`, `.gltf`, `.fbx`, `.obj`, `.stl`. Para GLTF, recursos externos precisam estar locais e contidos na pasta; links remotos/fora da pasta são recusados pelo runner.
2. **Personagem:** malha visível, armature real e cada ação pedida disponível no arquivo depois da importação. O script resolve nomes de ações por igualdade sem distinção de caixa ou sequência de tokens completos; se houver múltiplas correspondências, bloqueia e pede nome mais específico. Isso não prova que a ação mova/deforme o personagem, então a revisão visual continua obrigatória. A partir de OBJ/STL não há como satisfazer rig/animação automaticamente.
3. **Animação:** o script amostra oito frames uniformemente por action range. Não avalia clipping, foot sliding, deformação, continuidade cíclica ou retarget semântico.
4. **Render:** Blender headless, câmera ortográfica, EEVEE, alpha solicitado e tamanho de frame configurado. Backend/GPU, drivers e combinação Windows/AMD ainda precisam ser detectados/testados na máquina alvo.
5. **Saída:** `spritesheet.png` RGBA8 + `spritesheet.json` schemaVersion 1; dimensões, grade, frames, retângulos, nomes, pivôs e durações precisam coincidir. A checagem não prova pixels alpha visíveis nem qualidade artística.
6. **Metadados e rastreabilidade:** run persistido inclui adapter/comando sanitizado, caminho relativo, formato, tamanho, SHA-256, validações, progresso, status, erro e autorização/revisão. Resultados anteriores ficam preservados se uma etapa posterior falhar.

### E2E-001 — um humanoide estilizado, corpo inteiro, `idle` / `walk` / `run`

Este é **um único caso de aceitação preparado, ainda não executado**. Não é uma simulação nem autorização para enviar dados, baixar/installar software ou gastar créditos.

**Asset e destino:** um humanoide bípede estilizado, corpo inteiro, sem marca/sem propriedade de terceiros, proporções e roupa simples, pés e mãos visíveis, pose neutra consistente nas referências. Brief de teste: “Aventureiro humanoide de fantasia estilizada, túnica azul-petróleo simples, faixa ocre e botas, silhueta clara, corpo inteiro, mãos/pés visíveis, pose A neutra; sem logotipos, base ou cenário.” Tamanho de frame `48 × 48 px`; ações solicitadas e chaves do manifesto exatamente `idle`, `walk`, `run`. Saída relativa esperada sob `game/assets/characters/humanoid-e2e-001/` no workspace que o usuário escolheu; a aplicação decide subpastas e IDs de run. Os dados do usuário permanecem no workspace/config centralizados da Lia Forge; não escrever nem substituir `lia.json`, nem presumir checkout, `Program Files` ou mover `Documents/Lia Forge`.

**Ferramentas/estado observado:**

| Parte | Disponível ou investigado | Bloqueio antes de um teste real |
|---|---|---|
| App e dependências | Código fonte no sandbox; Node e npm presentes; lockfile coerente. | `node_modules` ausente; `npm test` e build falham por SDK/Vite ausentes. Instalação de dependências não autorizada; ainda não há build Windows validado. |
| Referências | Contrato pede frente, perfil e costas; refs existentes podem ser fornecidas pelo usuário e aprovadas. | Nenhuma imagem real no repositório. Krita não está instalado; ComfyUI é opcional e só tem adapter de conceito 2D, sem gerar vistas ortográficas coerentes. Nenhum provider de vistas registrado. |
| Modelo, rig e ações | Blender renderer/validador existe em código. O detector de Blender procura PATH, locais usuais e bibliotecas Steam. | Usuário informou Blender instalado via Steam na máquina-alvo, mas o app não foi executado nessa máquina nesta revisão. Nenhum modelo 3D real no repositório; nenhum adapter de geração, auto-rig ou animação selecionado/registrado. |
| Provider cloud | Tripo tem melhor exemplo técnico para as três ações; Meshy tem custo-base em créditos mais quantificável. | Sem conta, API key, integração ou cotação/termos suficientes; nenhuma chamada/upload/crédito autorizado. Direitos comerciais, privacidade e retenção de Tripo continuam sem confirmação. |
| Inspeção visual | A aplicação deixa revisão humana entre as etapas. | Nenhuma cena renderizada, modelo/rig real ou atlas de 24 frames para revisar. Não afirmar compatibilidade AMD/CUDA/Vulkan/CPU. |

**Procedimento após desbloqueio, sem pular nem fabricar etapas:**

1. No workspace selecionado pelo usuário, criar um asset **Personagem → começar pelo prompt/brief**; preencher brief/regras visuais e selecionar `Idle`, `Walk`, `Run`. A interface agora guarda os IDs como minúsculos (`idle`, `walk`, `run`) e só os capitaliza na apresentação.
2. Obter três arquivos reais de referência aprovados (frente, perfil, costas, pose neutra, mesma escala/paleta) via trabalho manual local ou provider que o usuário selecionar. Conferir as imagens; somente depois registrar a etapa. Se não houver refs ou gerador real, parar em `reference-views` como bloqueado.
3. Gerar/receber um modelo 3D real a partir das vistas aprovadas; baixar ao workspace somente com autorização. Revisar anatomia/silhueta, roupa, materiais, escala e proporções no Blender; registrar o formato/caminho real e aprovar a etapa. O validador de formato não substitui abrir o modelo.
4. Produzir rig humanoide e skin weights reais; confirmar armature e deformação no Blender, em pose neutra e poses extremas. Gerar clips distintos para `idle`, `walk`, `run`; confirmar que as três ações estão importáveis, movem/deformam o mesh, têm intervalo útil e não mostram clipping/foot sliding impeditivo. A correspondência de nomes, sozinha, não aprova o movimento.
5. Acionar o renderer Blender pela UI desktop **Gerar com Blender** a partir do asset/modelo verificado. Ele amostra oito frames por ação e gera `spritesheet.png` + `spritesheet.json`; para 48 px, esperar grade de 8 colunas × 3 linhas, **384 × 144 px**, 24 frames RGBA8 e ordem `idle`, `walk`, `run`. O manifesto deve passar schema 1 e bater com PNG, dimensões, pivô e frames.
6. Abrir PNG/manifesto e examinar os 24 frames visualmente: personagem inteiro sem corte, alpha/transparência, câmera/escala fixas, pivô nos pés, poses legíveis, loop/continuidade e ausência de frames vazios/corrompidos. Registrar revisão humana; os testes sintéticos e o validador não aprovam arte ou rig.
7. Exercitar recuperação com uma execução Blender cancelada/interrompida em run separado: outputs anteriores não são apagados; somente a etapa desktop Blender é retomável. Reabrir/retomar deve revalidar fingerprints/arquivos e refazer se modelo, ações, tamanho ou outputs mudaram. Nenhuma etapa provider/API pode ser repetida automaticamente após resultado ambíguo; requer reconciliação explícita.

**Comando opcional de diagnóstico do renderer no Windows (não executado):** só para um modelo real já existente dentro do workspace, depois de Blender estar detectado. Usa um diretório novo e único para não sobrescrever; não atualiza o estado da aplicação e, portanto, não substitui o E2E pela UI nem a validação/revisão final.

```powershell
$ProjectRoot = (Resolve-Path -LiteralPath (Read-Host 'Caminho do workspace escolhido pelo usuário')).Path
$ModelRelative = (Read-Host 'Caminho relativo do modelo rigado dentro do workspace').Trim()
$Model = [IO.Path]::GetFullPath((Join-Path $ProjectRoot $ModelRelative))
$RootPrefix = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd([char[]]@('\','/')) + [IO.Path]::DirectorySeparatorChar
if (-not $Model.StartsWith($RootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'O modelo precisa permanecer dentro do workspace.' }
if (-not (Test-Path -LiteralPath $Model -PathType Leaf)) { throw 'Modelo real não encontrado; nenhum arquivo foi gerado.' }
if ([IO.Path]::GetExtension($Model).ToLowerInvariant() -notin @('.blend','.glb','.gltf','.fbx','.obj','.stl')) { throw 'Formato incompatível com o adapter Blender.' }
$Blender = node -e "const p=require('./electron/external-tools.cjs').findExternalTool('blender'); if(!p) process.exit(2); process.stdout.write(p)"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Blender)) { throw 'Blender não detectado pelo helper da aplicação.' }
$Script = (Resolve-Path -LiteralPath 'scripts/blender_spritesheet.py').Path
$OutputRoot = Join-Path $ProjectRoot 'game/assets/characters/humanoid-e2e-001/sprites'
$RunDirectory = Join-Path $OutputRoot ('diagnostic-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $RunDirectory | Out-Null
& $Blender --background --python $Script -- --input $Model --output-dir $RunDirectory --asset-name humanoid-e2e-001 --asset-type character --frame-width 48 --frame-height 48 --animations-json '["idle","walk","run"]'
if ($LASTEXITCODE -ne 0) { throw 'Blender falhou; preservar o diretório para diagnóstico e não marcar a etapa como concluída.' }
```

Esse comando não declara que o backend GPU/CPU é compatível; verifique a execução real e revise `spritesheet.png`/`.json` antes de registrar outputs.

**Provider condicional (não selecionado):** se o usuário optar por Tripo, o SDK oficial v0.5.0 documenta geração de imagem para modelo, `rigCheck`, `rigModel`, `retargetAnimation` com `IDLE`/`WALK`/`RUN` e saída GLB. O exemplo publicado não comprova que o método de geração consome as três imagens separadas frente/perfil/costas exigidas pelo contrato Lia Forge; o adapter deve mapear essa entrada de forma documentada ou parar bloqueado, sem reduzir silenciosamente o caso a uma imagem. A cadeia do SDK é evidência de API, não integração pronta nem prova que o output abra/deforme/renderize corretamente aqui. Antes da primeira chamada, exigir confirmação do plano/preço por task (incluindo retries), limite de gasto, direitos comerciais, retenção/treino, quais imagens/brief podem sair do dispositivo e consentimento final de envio. A estimativa não está estabelecida. Se essas condições ou a compatibilidade multi-vista não forem confirmadas, não chamar Tripo. Meshy é alternativa documental de **44 créditos** (sem cotação monetária; acesso API/planos têm páginas divergentes) e também depende de consentimento e validação dos termos.

**Resultado real atual:** bloqueado antes da primeira vista/modelo. Não há outputs de produção nem revisão visual. O plano IPC de humanoide é apenas inspeção de contrato (`executed: false`); o fluxo inteiro não tem adapters executáveis selecionados. Se o usuário fornecer depois um modelo real rigado com essas ações, um E2E Blender iniciado do ponto **modelo rigado/animações existentes** poderá validar apenas render/atlas; isso não deverá ser descrito como o fluxo completo prompt→3D.

**Escopo que este caso não satisfaz:** itens/armas/ferramentas continuam em fluxo próprio sem rig humanoide (o turntable já existente é distinto); Code → 2D, Manequim → 2D e ambientes/cenários precisam continuar como rotas independentes; retomada a partir de assets existentes deve continuar sem obrigar refazer etapas. As opções atuais de entrada cobrem prompt/brief/conceito/modelo/rig; não tornam automaticamente executáveis as rotas Code/Manequim/ambiente. Não ampliar a infraestrutura nesta fatia sem um caso real que justifique.

## 4. Testes, execução e bloqueios desta revisão

Os smoke tests usam arquivos sintéticos dentro de diretórios temporários para testar contratos e validadores; eles **não** são um personagem ou output de produção. Nesta revisão, foi acrescentado um teste de leitura GLB em chunks parciais simulados; também é um fixture sintético.

**Ambiente deste sandbox:** Node `v22.22.3` (satisfaz `>=22.12.0`), npm `10.9.8`, Python `3.11.2`; `node_modules` ausente. `package.json` e a raiz do `package-lock.json` (lockfile v3) coincidem em nome, versão, dependencies, devDependencies e engines. `npm ls --package-lock-only --all` terminou com exit code 0; listou dependências **opcionais** não instaladas. Essa inspeção não instalou nada nem valida uma árvore real de `node_modules`.

**Verificações realizadas:**

```text
node --check em todos os .cjs/.mjs/.js de electron/, scripts/ e tests/       PASS
node --check src/asset-progress.js                                            PASS
python -m py_compile nos scripts e testes Python auditados                     PASS
12 smoke tests Node sem dependências externas                                  PASS
python -m unittest tests.test_blender_spritesheet -v                            4/4 PASS
python -m unittest discover -s tests -v                                         29/30 PASS
npm ls --package-lock-only --all                                                exit 0
npm test                                                                        FAIL antes dos testes: @modelcontextprotocol/sdk ausente
npm run build                                                                    FAIL: vite: not found
```

Os 12 smoke tests Node locais foram: `asset-progress`, `comfyui-client`, `task-manager`, `navigation-guard`, `ipc-guard`, `manual-artifacts`, `external-tools`, `workflow-runner`, `workflow-run-store`, `blender-workflow-plan`, `blender-adapter` e `lia-paths`. `npm test` também começa por `mcp-smoke` e `vite-store-smoke`, que não chegaram a executar por dependências ausentes. O smoke ComfyUI usa HTTP/PNG sintéticos e testa que um POST redirecionado não alcança o segundo host; não chamou ComfyUI/provider real. Os testes `idle`/`walk`/`run` verificam nomes, estrutura e manifesto sintético; não executam Blender.

A única falha da suíte Python completa foi `test_installed_npm_tree_matches_lockfile`: `package_dependencies_ready()` retorna falso porque não existe `node_modules`. `npm test` falha logo no primeiro teste, ao importar `@modelcontextprotocol/sdk`; o build falha porque `vite` não está instalado. `npm ci` não foi executado (nem online nem offline); seu `postinstall` pode baixar o binário Electron. JSX e preview/build não foram validados. Não há Blender no sandbox, arquivos 3D/imagens de entrada reais, rig, animações, atlas real ou revisão dos 24 frames.

Nenhum provider foi escolhido, configurado, instalado, baixado, licenciado ou chamado; nenhuma API/dado remoto foi usado. Não foi validada uma combinação concreta de Windows + AMD/CUDA/Vulkan/CPU. O Blender via Steam informado pelo usuário é apenas evidência da máquina-alvo, não detecção/execução Windows comprovada nesta revisão.

### Tentativa de validação real do renderer — 2026-11-01

**Resultado: bloqueado antes do import/render.** A busca no workspace `/home/user/3DSpritesheet` não encontrou nenhum `.blend`, `.glb`, `.gltf`, `.fbx`, `.obj`, `.stl`, `.bvh` ou `.abc`. `docs/Lia.zip` foi apenas listado (não extraído) e contém arquivos de documentação, sem modelos. Não há origem/licença/autorização de modelo para avaliar. O sistema atual é Linux `6.1.158+ x86_64`; `command -v blender` não retornou caminho e `findExternalTool('blender')`/`getExternalToolStatus()` reportou `installed: false`. O helper não conseguiu detectar Blender pelo PATH, locais Linux comuns ou Steam nesta sandbox. A informação de que Blender está instalado via Steam pertence à máquina Windows do usuário, não a este processo Linux.

Comandos de inspeção executados e resultados:

```bash
$ find . -type f \( -iname '*.blend' -o -iname '*.glb' -o -iname '*.gltf' -o -iname '*.fbx' -o -iname '*.obj' -o -iname '*.stl' -o -iname '*.bvh' -o -iname '*.abc' \) -not -path './node_modules/*' -not -path './.git/*' -printf '%p\t%s bytes\n' | sort
<nenhum resultado>

$ printf 'Blender command on PATH: '; command -v blender || true
Blender command on PATH:

$ node - <<'NODE'
const { findExternalTool } = require('./electron/external-tools.cjs');
const result = findExternalTool('blender');
console.log(result || 'not detected');
NODE
not detected

$ node - <<'NODE'
const { getExternalToolStatus } = require('./electron/external-tools.cjs');
Promise.resolve(getExternalToolStatus()).then((status) => console.log(JSON.stringify(status.blender ?? status, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
NODE
{
  "label": "Blender",
  "installed": false
}

$ printf 'OS/kernel: '; uname -srm; printf 'Node: '; node --version; printf 'npm: '; npm --version; printf 'Python: '; python --version 2>&1
OS/kernel: Linux 6.1.158+ x86_64
Node: v22.22.3
npm: 10.9.8
Python: Python 3.11.2

$ unzip -l docs/Lia.zip
<15 arquivos, somente documentação; não extraído>
```

`Blender --version` e `scripts/blender_spritesheet.py` **não foram executados**: não havia executável/modelo compatível. Nenhum PNG, atlas, manifesto, log de render ou evidência visual foi criado. Não usei fixtures sintéticas como substituto, não instalei ferramenta, não baixei asset e não alterei workspace de saída.

**Recurso exato para desbloquear o renderer-only E2E:** fornecer no workspace escolhido um único modelo real acessível (`.blend`, `.fbx`, `.glb` ou `.gltf`) com mesh humanoide visível, armature e três ações distintas importáveis (`idle`, `walk`, `run`); manter recursos externos do GLTF locais junto ao projeto. Confirmar origem/licença e autorização para render local. Além disso, o processo precisa conseguir executar uma instalação existente do Blender — por exemplo, rodar no Windows onde a instalação Steam está acessível ou disponibilizar um executável já instalado neste ambiente; não vou instalá-lo. OBJ/STL estático não satisfaz este teste de rig/animações. Com esses dois recursos, o renderer pode ser acionado e PNG/manifesto examinados; qualidade de movimento continuará dependendo de inspeção visual humana.

### Validação Windows: comandos exatos e limites

Executar na raiz do checkout em PowerShell. Os comandos de inspeção, verificação de sintaxe e smoke tests abaixo são locais; não instalam pacotes, não baixam modelos e não chamam providers. O teste de Blender é apenas `--version`. Os comandos de `npm test`/build ficam para **depois de autorização explícita para instalar**.

```powershell
node --version
npm --version
py -3 --version

# Confere metadados de package.json contra a raiz do lockfile, sem instalar.
node -e "const p=require('./package.json'), l=require('./package-lock.json').packages['']; for (const k of ['name','version','dependencies','devDependencies','engines']) { if (JSON.stringify(p[k] ?? null) !== JSON.stringify(l[k] ?? null)) { console.error('Mismatch:', k); process.exitCode=1 } }"
if ($LASTEXITCODE -ne 0) { throw 'package.json e package-lock.json divergem' }
npm ls --package-lock-only --all
if ($LASTEXITCODE -ne 0) { throw 'npm ls --package-lock-only falhou' }

# Usa o detector da aplicação, que inclui bibliotecas Steam; Get-Command sozinho não as cobre.
$Blender = node -e "const p=require('./electron/external-tools.cjs').findExternalTool('blender'); if(!p) process.exit(2); process.stdout.write(p)"
if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $Blender)) { & $Blender --version; if ($LASTEXITCODE -ne 0) { throw 'Blender --version falhou' } } else { Write-Warning 'Blender não detectado pelo helper; não presumir caminho Steam nem instalar nada.' }

# Sintaxe JS (não inclui JSX, que depende do build Vite).
$JsFiles = Get-ChildItem electron,scripts,tests -Recurse -File | Where-Object { @('.cjs','.mjs','.js') -contains $_.Extension }
foreach ($File in $JsFiles) { node --check $File.FullName; if ($LASTEXITCODE -ne 0) { throw "node --check falhou: $($File.FullName)" } }
node --check src/asset-progress.js
if ($LASTEXITCODE -ne 0) { throw 'node --check falhou: src/asset-progress.js' }

$NodeTests = @(
  'tests/asset-progress-smoke.mjs',
  'tests/comfyui-client-smoke.mjs',
  'tests/task-manager-smoke.cjs',
  'tests/navigation-guard-smoke.cjs',
  'tests/ipc-guard-smoke.cjs',
  'tests/manual-artifacts-smoke.cjs',
  'tests/external-tools-smoke.cjs',
  'tests/workflow-runner-smoke.cjs',
  'tests/workflow-run-store-smoke.cjs',
  'tests/blender-workflow-plan-smoke.cjs',
  'tests/blender-adapter-smoke.cjs',
  'tests/lia-paths-smoke.cjs'
)
foreach ($Test in $NodeTests) { node $Test; if ($LASTEXITCODE -ne 0) { throw "Falhou: $Test" } }

py -3 -m py_compile scripts/blender_spritesheet.py scripts/lia_paths.py scripts/mcp_config.py scripts/spriteforge_launcher.py tests/test_blender_spritesheet.py tests/test_bootstrap.py tests/test_mcp_config.py
py -3 -m unittest tests.test_blender_spritesheet -v
py -3 -m unittest discover -s tests -v
```

Sem `node_modules`, `unittest discover` deverá reportar 29/30 PASS e a única falha esperada `test_installed_npm_tree_matches_lockfile`; isso não autoriza instalação. **Só depois de aprovação explícita** executar `npm ci` (rede necessária e `postinstall` pode baixar Electron), seguido de:

```powershell
npm test
npm run build
```

Esses dois comandos foram tentados apenas no sandbox e deram os bloqueios acima; nenhum teste, build, empacotamento, execução do app ou render foi feito no Windows nesta revisão. O comando `Gerar com Blender` na UI é o caminho de E2E quando houver modelo real no workspace; não usar um `.obj`/`.stl` estático como substituto de rig/animações.

## 5. Autorizações e próximo passo mínimo

**Nada está autorizado para cobrança, instalação, download, aceite de licença ou envio remoto.** Não compartilhar API keys no chat. Para avançar sem afirmar outputs inexistentes, há dois próximos passos distintos:

- **E2E mínimo local do renderer:** o usuário escolhe/indica o workspace existente e fornece um humanoide real (`.blend`, `.glb`, `.gltf` ou `.fbx`) com armature e ações importáveis `idle`, `walk`, `run`. Isso valida somente import/rig já existente → Blender → atlas, não geração desde prompt. Rodar no Windows e inspecionar os 24 frames é obrigatório; não mover nem sobrescrever dados.
- **Fluxo completo prompt → 2D:** primeiro escolher provider e resolver por escrito plano/API, preço máximo para o modelo + rig + três ações/retries, direitos comerciais, uso/retention dos uploads e imagens/brief autorizados. Tripo é o melhor encaixe técnico documentado, mas sem preço/termos suficientes ainda não é recomendação de compra nem escolha. Meshy tem referência de 44 créditos, mas há conflito documentado sobre plano/API e questões de retenção. Só depois implementar/registrar adapters; fazer uma confirmação final explícita imediatamente antes de qualquer chamada paga/envio e validar o output real no Blender.
- **Rota local de geração:** fornecer diagnóstico exato da máquina-alvo (Windows build/versão, GPU/modelo/VRAM/driver/backend) e selecionar modelo, versão, URL, checksum e licença. Não inferir suporte AMD/Vulkan/CUDA/CPU nem baixar pesos sem autorização.

Ainda faltam os URLs dos vídeos Easy-install mencionados anteriormente para auditar esses métodos. Até haver vistas, modelo, rig, três ações, PNG e manifesto reais verificados e revisão visual, o pipeline completo deve continuar indicado como **bloqueado/parcial**, nunca concluído.

## Fontes primárias consultadas

- [Microsoft TRELLIS](https://github.com/microsoft/TRELLIS) · [MIT do repositório](https://github.com/microsoft/TRELLIS/blob/main/LICENSE)
- [Microsoft TRELLIS.2](https://github.com/microsoft/TRELLIS.2) · [MIT do repositório](https://github.com/microsoft/TRELLIS.2/blob/main/LICENSE)
- [Tencent Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) · [Community License](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE)
- [VAST TripoSR](https://github.com/VAST-AI-Research/TripoSR) · [MIT](https://github.com/VAST-AI-Research/TripoSR/blob/main/LICENSE)
- [Stability AI Stable Fast 3D](https://github.com/Stability-AI/stable-fast-3d) · [Community License](https://github.com/Stability-AI/stable-fast-3d/blob/main/LICENSE.md)
- [Seed3D Puppeteer](https://github.com/Seed3D/Puppeteer) · [Apache-2.0 do código](https://github.com/Seed3D/Puppeteer/blob/main/LICENSE)
- [Tripo Developer JS SDK](https://github.com/Tripo-Developer/tripo-js-sdk) · [README oficial](https://github.com/Tripo-Developer/tripo-js-sdk/blob/main/README.md) · [MIT do SDK](https://github.com/Tripo-Developer/tripo-js-sdk/blob/main/LICENSE)
- [Meshy MCP Server](https://github.com/meshy-dev/meshy-mcp-server) · [README oficial](https://github.com/meshy-dev/meshy-mcp-server/blob/main/README.md) · [Meshy Guide](https://github.com/meshy-dev/Meshy-guide) · [AI-3D FAQ](https://github.com/meshy-dev/Meshy-guide/blob/main/AI-3D-FAQ.md) · [FAQ de desenvolvedores](https://github.com/meshy-dev/Meshy-guide/blob/main/FAQ-Developer.md) · [MIT do guia/código](https://github.com/meshy-dev/Meshy-guide/blob/main/License.md)
- [ComfyUI requisitos](https://docs.comfy.org/installation/system_requirements) · [Blender Rigify no código oficial](https://github.com/blender/blender/tree/main/scripts/addons_core/rigify)

As páginas dos repositórios, READMEs e arquivos de licença acima são evidência técnica preliminar, não aconselhamento jurídico. Termos de conta/API, direitos de resultado e privacidade precisam ser confirmados antes de uso real/comercial.

## 6. Preparação do ensaio real do renderer com Mixamo / Unreal — 2026-11-02

Foi preparada `local-renderer-test/` com README, manifesto de origem/licença, uma barreira de licença baseada em confirmação explícita do usuário, runner PowerShell sem caminho fixo de Blender e verificador local do atlas. `.gitignore` cobre `local-renderer-test/assets/` e `local-renderer-test/output/`; os documentos/helpers ficam fora dessas pastas para poderem ser revisados/versionados. Nenhum asset foi baixado; não houve uso de credenciais, instalação, execução do Blender ou render real.

A leitura do código confirma: o renderer aceita um único `--input`, usa `bpy.ops.import_scene.fbx` para FBX e procura as actions requeridas em `bpy.data.actions`. O adapter não aceita vários FBX de animação separados nem faz retarget/merge. Por sujeito Mixamo, a estrutura aguarda um FBX com personagem/skin, três FBX de ações selecionadas pelo usuário e um `.blend` consolidado com um rig principal e actions reais nomeadas `idle`, `walk`, `run`. Manny/Quinn são opcionais e só entram como `.blend` local preparado pelo usuário após revisão dos termos próprios.

O menu atual de formatos do Mixamo e os termos oficiais atuais Adobe/Mixamo e Fab/Unreal **não foram confirmados** nesta atualização. `FBX Binary` aparece apenas como preferência condicional se a interface atual o oferecer; nada aqui afirma disponibilidade ou licença. `source-license-manifest.json` começa como pendente e o runner bloqueia até o usuário registrar que revisou os termos atuais, que autorizou o render local e quais foram as fontes/títulos reais. A barreira não valida juridicamente nem consulta a web.

O runner solicita ao helper `electron/external-tools.cjs` a detecção do Blender já instalado (incluindo caminhos Steam suportados), registra a versão/log e usa o renderer real com frame 48×48 e oito frames por ação. A expectativa do código é um atlas 384×144 (grade 8×3) mais manifesto JSON; o renderer não mantém PNGs separados por frame. O verificador lê PNG/manifesto reais, mede alpha por célula e sinal de variação nos frames walk/run, registra hashes/versão e deixa revisão visual humana explicitamente obrigatória. Nenhuma dessas saídas existe ainda: a execução segue bloqueada por assets reais acessíveis e confirmação de termos/licença. Não marcar o renderer como validado até a execução real e inspeção visual.

## 7. Investigação futura — contrato/adaptadores do renderer (adiada)

**Estado:** somente item de investigação registrado; nenhuma alteração de código, CLI, formatos, schema ou dependências foi implementada. **Pré-condição:** concluir primeiro o ensaio atual real com os personagens Mixamo masculino e feminino, verificar a procedência/licença e revisar visualmente os dois resultados. Não iniciar esta evolução como substituto desse ensaio.

Depois dessa pré-condição, investigar e produzir uma proposta (sem implementação nesta etapa) para:

1. **Modelo base + animações separadas:** avaliar importação sequencial do mesh/rig base e de FBX/GLB de animação, associação das actions ao rig, compatibilidade de ossos/rest pose, retarget necessário, retenção de actions e tratamento de clips ausentes/ambíguos. Não presumir que nomes iguais de ossos sejam prova suficiente de compatibilidade.
2. **Múltiplos meshes, armatures e actions:** definir como identificar o personagem/rig principal, como tratar meshes skinned compartilhando armature, múltiplos rigs independentes, actions duplicadas ou incompatíveis e qual objeto recebe cada action. Evitar depender silenciosamente do primeiro armature encontrado; erros de seleção devem ser explícitos e rastreáveis.
3. **Formatos de entrada e saída:** comparar formatos suportáveis por versão/instalação real do Blender e por ferramentas de criação, incluindo preservação de mesh, materiais, rig, actions, unidades e eixos. Separar formatos de entrada, formato intermediário normalizado e formatos de saída; não declarar suporte com base apenas na extensão. Avaliar PNG/JSON atuais e possíveis saídas adicionais somente após definir consumidores e compatibilidade.
4. **Camada de adaptadores por workflow:** estudar uma interface em que cada workflow (por exemplo, Mixamo, Unreal ou ferramenta local) prepare/normalize seus inputs e procedência numa representação intermediária explícita, deixando o núcleo renderer responsável por enquadramento, amostragem, render e empacotamento. A camada não deve introduzir dependência obrigatória de provider nem contornar gates de licença/autorização.
5. **Compatibilidade com o contrato atual:** manter o caminho existente de um único `--input`, seus defaults, `spritesheet.png`, `spritesheet.json` e schema de manifesto atual; novas capacidades devem ser opt-in e versionadas. Definir regressões que comparem o comportamento atual com o E2E Mixamo real antes/depois, incluindo grade, nomes/ordem de ações, hashes/estrutura, artefatos e revisão visual, sem sobrescrever outputs legados.

**Entregável futuro da investigação:** matriz de formatos/capacidades verificada em versões concretas, proposta do contrato intermediário/adaptadores, riscos de rig/retarget/múltiplos objetos, plano de compatibilidade e critérios de teste. Este registro não escolhe formatos, não afirma compatibilidade ainda não testada e não autoriza implementação.
