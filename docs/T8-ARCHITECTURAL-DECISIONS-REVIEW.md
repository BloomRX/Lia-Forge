# T8 — Revisão de decisões arquiteturais: resumo, alternativas e recomendações

> **Estado:** `PROPOSED`. Este é o documento de entrada da revisão T8 (2026-11-12 UTC). **Não autoriza implementação**, não altera contratos, não altera código de nenhum produto do ecossistema e **não aprova nenhuma decisão em nome da pessoa usuária**.
> **Branch:** `arena/649f88bd-3dspritesheet` (Lia Forge), `HEAD` local `13dc4c7d2fde28f9324fd929482948ba34a87abf`. Commits anteriores preservados: `b8403fb` (T5), `79d4b58` (T6), `33fdedf` (vídeo), `b81b127` (T7). `origin/main` intocado em `e988711`.
> **Documentos desta revisão:** [`STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md`](STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md) · [`3D-CHARACTER-PRODUCTION-PIPELINE.md`](3D-CHARACTER-PRODUCTION-PIPELINE.md) · [`CAPABILITY-BOUNDARIES-AND-ROADMAP.md`](CAPABILITY-BOUNDARIES-AND-ROADMAP.md) · [`PROVIDER-AND-MODEL-ADMISSION-POLICY.md`](PROVIDER-AND-MODEL-ADMISSION-POLICY.md) · [`T8-REQUIREMENTS-TRACEABILITY.md`](T8-REQUIREMENTS-TRACEABILITY.md).

## 1. Resumo executivo

1. **A fronteira Studio × Forge já está decidida** — e não foi por esta revisão. O repositório [`BloomRX/Lia-Studio`](https://github.com/BloomRX/Lia-Studio), branch `arena/01a0f4ab-lia-gamedev`, commit `49eedeec09ce` (2026-11-11T21:07:11Z), registra como **decisão de produto do Dev**: *"Lia Studio decide e coordena o jogo; Lia Forge produz, transforma e valida tecnicamente assets para qualquer consumidor. Lia Desktop e jogos são destinos de utilização, não módulos de geração separados."* O mesmo documento afirma que **a fronteira está definida, mas o protocolo/bridge entre apps não está aprovado nem implementado**.
2. **`docs/LIA-FORGE-NA-PIPELINE.md` existe** — a conclusão da T7 estava correta apenas para o repositório da Forge. O arquivo (19.340 bytes, 175 linhas, blob `82f27727858208166fce34dc050525d0dffff9c3`) está no repositório do **Studio**, na branch `arena/01a0f4ab-lia-gamedev`; a branch `main` do Studio não o contém. O Studio também já tem **código** para o primeiro corte: `app/lia/forge_brief.py` + `tests/test_forge_brief.py`.
3. **Já existe integração real, e ela é manual por desenho.** O Studio produz uma **prévia local de brief** (tipos `concept`/`model`/`rig`/`spritesheet`, IDs `[0-9a-f]{8}`, sem ler GDD, mídia, decisões, prompts anteriores ou credenciais) com `sent/saved/verified_result = False` e SHA-256 do texto. Isso é o estágio 1 da sequência "sem atalhos" que o próprio Studio define: manual → contrato versionado → experiência guiada.
4. **Para identidade compartilhada, recomenda-se avaliar a Alternativa A** (núcleo versionado + projeções por produto), com quatro condições derivadas do caso real do ArtCraft (`craft-ai-core` promovido a `craft-libs` enquanto o downstream manteve cópia local pendente, exigindo `docs/CORE-SYNC.md`): núcleo como **contrato de dados**, não biblioteca de runtime; documento de fronteira obrigatório; pin de versão com teste de leitura antiga; proibição de cópia local não declarada. **B** é aceitável só como estágio inicial (é o que existe hoje) e **C** é desaconselhada por quebrar offline-first e autonomia.
5. **A rota 3D do vídeo está bloqueada no alvo, por documentação do próprio upstream.** TRELLIS.2-4B declara *"An NVIDIA GPU with at least 24GB of memory is necessary"* e *"tested only on Linux"*; Pixal3D **exige instalar o TRELLIS.2 primeiro**. Isso **contradiz** a alegação do vídeo (8–12 GB, testado em RTX 5080 16 GB). O alvo do ADR-001 (Windows + AMD RX 580 8 GB) não é atendido. A alternativa local mais viável verificada é **TripoSR** (MIT em **código e pesos**, ~6 GB VRAM, fallback CPU documentado).
6. **ComfyUI é GPL-3.0** — fato não registrado anteriormente nesta documentação. A integração atual por endpoint HTTP de processo separado não cria obra derivada por linkagem, mas a fronteira precisa ser registrada, e qualquer redistribuição exige análise própria.
7. **Nenhuma das dez capacidades avaliadas foi promovida.** A matriz cruzada continua separando código existente de execução testada: vídeo, áudio, splats, composição e cena permanecem `MISSING` no código; image→3D e ambientes permanecem `PLANNED`; o render Blender é `IMPLEMENTED` como código e `VERIFIED` apenas em fixtures.
8. **Nada foi executado, instalado, baixado ou enviado.** Toda a revisão é leitura de fonte primária (GitHub API, fichas de modelo no Hugging Face, documentos publicados) mais verificação do checkout.

## 2. Frentes e onde cada resposta está

| Frente | Pergunta central | Resposta | Documento |
|---|---|---|---|
| **A** | Como Studio e Forge compartilham compreensão do projeto sem se tornarem dependentes? | Três camadas de propriedade (identidade global / identidade de produção / requisitos de destino), três alternativas comparadas em dez critérios, recomendação A condicionada, sequência manual → versionado → guiado | [`STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md`](STUDIO-FORGE-CONSISTENCY-ARCHITECTURE.md) |
| **B** | O pipeline imagem → personagem game-ready é viável no alvo? | Matriz das 12 etapas com **licença de código separada da licença de pesos**, hardware declarado × testado, cinco rotas alternativas (R1–R5) e três armadilhas de licença | [`3D-CHARACTER-PRODUCTION-PIPELINE.md`](3D-CHARACTER-PRODUCTION-PIPELINE.md) |
| **C** | Quais capacidades entram no escopo e com que fronteira? | Dez capacidades com problema, usuários, entradas/saídas, dependências, classificação (nativa/provider/adapter/backend/destino), QA, prioridade e risco de duplicação; sete questões de fronteira respondidas com alternativas | [`CAPABILITY-BOUNDARIES-AND-ROADMAP.md`](CAPABILITY-BOUNDARIES-AND-ROADMAP.md) |
| **D** | O que pode entrar na Forge e sob quais condições? | 14 dimensões avaliadas separadamente, 6 categorias de admissão com critérios objetivos, reconciliação com os dois vocabulários já publicados, 13 requisitos mínimos, processo de 8 passos e 20 exemplos aplicados | [`PROVIDER-AND-MODEL-ADMISSION-POLICY.md`](PROVIDER-AND-MODEL-ADMISSION-POLICY.md) |
| **E** | O que está decidido, o que depende de humano e o que mudaria em contratos? | Matriz de rastreabilidade com **53 requisitos** em 5 blocos, responsabilidade, capacidade, contrato afetado, evidência primária, risco e status | [`T8-REQUIREMENTS-TRACEABILITY.md`](T8-REQUIREMENTS-TRACEABILITY.md) |

## 3. Recomendações (fundamentadas, **não** aprovadas)

| # | Recomendação | Fundamento | Consequência se adotada |
|---|---|---|---|
| R1 | Adotar **Alternativa A** (núcleo versionado + projeções) com as quatro condições de sincronização | B gera N mapeadores e divergência silenciosa; C quebra offline-first e autonomia; A reutiliza a forma já desenhada na spec | Um contrato entre produtos, mais estreito que a Domain Contracts, com dono, versão e documento de fronteira |
| R2 | Manter o **transporte manual** como estágio 1 e não desenhar envelope antes de decidir A/B/C | O Studio declara que o bridge não está aprovado e proíbe antecipar schema | Nenhuma especificação de transporte nesta fase |
| R3 | Tratar **Scene Composer como experiência combinada** (nó de staging), não como módulo | Evita duplicar Workflow Engine e a rota `Manequim → 2D` | Contrato de staging + UI, sem entidade de domínio nova |
| R4 | **Vídeo como capability da Forge** com backend opcional, mantendo "vídeo/streaming" como destino | Studio não produz arte no lugar da Forge; hyperframes é Apache-2.0 e não exige GPU | Contrato de mídia temporal novo (hoje inexistente) + adapter substituível |
| R5 | Adotar o **checklist de pureza determinística** no renderer existente antes de qualquer novo backend | Sem pureza, `VERIFIED` não tem significado | Critério objetivo de evidência para imagem e, depois, vídeo |
| R6 | Avaliar **R1 do pipeline 3D** (TripoSR + Blender + xatlas + clips CC0 + Rigify/UniRig) como primeira rota local, com **R4 (manual)** como piso | Única combinação com licença MIT em código **e** pesos e sem exigência de CUDA ≥24 GB | Probe real no alvo; nada anunciado antes de evidência |
| R7 | Aprovar a **política de admissão** com as seis categorias e o requisito de licença **por componente** | Casos reais: FLUX não comercial sob repositório MIT; MIT escopado; Hunyuan com exclusão territorial; GPL-3.0 do ComfyUI | Nenhum componente entra sem pin, SBOM, licença por componente e plano de saída |
| R8 | Registrar a **fronteira GPL** do ComfyUI (processo separado, sem linkagem) e reavaliar antes de qualquer redistribuição | Fato verificado e ausente da documentação | Nota de licença no hub e no inventário |
| R9 | Autorizar a **correção mínima** do gerador de notices e o teste correspondente | 112 links quebrados confirmados; causa localizada em `repository_url()` linha 36 | Proveniência navegável; sem mudança de conteúdo do inventário |
| R10 | **Atualizar a leitura do lado do Studio** para os commits `33fdedf` e `b81b127` | O Studio ancora em `f274b015`/`79d4b58` e pede reconfirmação antes de desenhar transporte | Tarefa no repositório do Studio, não neste |

## 4. Alternativas rejeitadas e por quê

| Alternativa rejeitada | Onde | Justificativa |
|---|---|---|
| **C — serviço/camada central de identidade** | Frente A | Quebra funcionamento offline e autonomia dos dois produtos; exige autoridade de escrita que nenhum produto tem; conflita com "cada app mantém seus próprios estados, permissões e consentimentos". Mantida na comparação como contraste |
| **B como estado final** | Frente A | Crescimento quadrático de mapeadores, semântica duplicada de "referência"/"desvio"/"identidade" e divergência silenciosa — o risco que a exigência arquitetural quer evitar. Aceitável apenas como estágio inicial |
| **Scene Composer como módulo próprio** | Frente C | Duplicaria Workflow Engine e a rota `Manequim → 2D` já documentada |
| **Composição espacial de áudio na Forge** | Frente C | Duplicaria o papel do destino (engine/jogo) e de produtos externos; além de sobrepor-se ao Lia Voice Studio |
| **Vídeo como responsabilidade do Studio** | Frente C | Contrariaria a decisão registrada de que o Studio não gera arte/rig/animação/spritesheet no lugar da Forge |
| **Splats como capacidade de reconstrução imediata** | Frente C | Sem caso de uso aprovado e sem provider; melhor entrar primeiro como **formato** (ingestão/hash/validador) |
| **Adotar TRELLIS.2/Pixal3D no alvo atual** | Frente B | NVIDIA ≥24 GB e Linux-only por declaração do autor; incompatível com Windows + RX 580 8 GB |
| **Adotar UltraTex/FLUX.2 Klein para texturização comercial** | Frente B/D | Pesos sob FLUX Non-Commercial v2.1 contaminam o output; MIT do repositório é **escopado** a instalador e notas |
| **Adotar Maestro como backend** | Frente D | Licença proíbe expressamente integração/serviço/API/produto pago; hardware incompatível |
| **Incorporar image-blaster ou ArtCraft** | Frente D | Tornaria World Labs/FAL (ou o serviço ArtCraft) dependências obrigatórias; o primeiro exige upload de arquivo do usuário e está inativo desde 2026-05-15; o segundo é projeto de ~1,37 GB com 17 apps e backend `NOASSERTION` |
| **Usar `HSA_OVERRIDE_GFX_VERSION` como prova de suporte à RX 580** | Frente B | A documentação do ComfyUI cita RDNA2/RDNA3; a RX 580 é GCN4 (gfx803). Seria inferência, não compatibilidade documentada |
| **Tratar `--directml` como suporte confirmado** | Frente B | O flag existe no código (`comfy/cli_args.py:116`), mas não há declaração de suporte para Polaris nem teste nosso: `code-present ≠ verified` |

## 5. Decisões que exigem aprovação humana

Consolidado (detalhe com evidência em [`T8-REQUIREMENTS-TRACEABILITY.md`](T8-REQUIREMENTS-TRACEABILITY.md)):

1. **A4/B3** — alternativa de contrato compartilhado (A/B/C), dono do núcleo e documento de fronteira.
2. **B4** — `ProjectVisualProfile.scope` ganha `kind` além de `"project"`?
3. **B5** — `AssetRelationship` aceita endpoints de Projects diferentes (spec §11, item 11)?
4. **B6** — regra de precedência entre projeções em conflito.
5. **B7** — meio de armazenamento/descoberta do registro compartilhado.
6. **B11/B12** — o envelope entre produtos passa a carregar hash de referências e versão de perfil? Qual vocabulário de tipo de asset (4 do Studio × categorias extensíveis da Forge)?
7. **C1–C10** — escopo e classificação das dez capacidades (staging, ambientes, splats, image→3D, áudio, vídeo, determinismo, controle por agente, edição, referências com função).
8. **C12** — shape das extensões de destino (spec §11, item 12).
9. **D4/D5/D6/D8** — licenças de FLUX (não comercial), pesos do UniRig, Hunyuan (exclusão territorial) e clips Quaternius CC0.
10. **D7** — registro da fronteira GPL-3.0 do ComfyUI.
11. **D9** — autorização para probe/execução real na máquina Windows do usuário.
12. **E1** — aprovação da política de admissão e das categorias por componente.
13. **E4** — autorização da correção mínima de `scripts/generate_third_party_notices.py` + teste novo.
14. **E5/E6** — consolidação/publicação do documento de fronteira no Studio e atualização da leitura do Studio para os commits mais novos da Forge.
15. **E7** — publicação das sete revisões locais divergentes da Forge.
16. **E10** — resolução da ambiguidade "Forge Studio" × "Lia Studio".
17. **E11** — perfis de compatibilidade por destino (engine, Lia Desktop, vídeo).
18. **E12** — política de curadoria/proveniência de skills.

## 6. Questões sem evidência suficiente (permanecem `unknown`)

1. Licenciamento dos **pesos do UniRig** (ficha HF não lida nesta revisão).
2. Modelos **Hunyuan 3D 3.x/3.1**: não localizados como repositório público sob `Tencent-Hunyuan` (404 em 2026-11-12); aparecem apenas em catálogo de terceiro (ArtCraft) — origem e licença não verificadas.
3. Suporte real de **DirectML/ROCm/ZLUDA para RX 580 (GCN4)** em qualquer um dos componentes — nenhuma fonte primária declara.
4. Desempenho de **TripoSR em CPU** e qualidade de saída para personagem estilizado de corpo inteiro — não medido.
5. Suporte de GPU da **RX 580 no Blender** para o caminho de render da Forge — não verificado nesta revisão.
6. **ActionForge** e **VARCO 3D**: sem repositório público e sem termos lidos — não são open source e não podem ser classificados.
7. Custos reais de **FAL/World Labs/Meshy/Rodin/ElevenLabs** por chamada — não declarados nos repositórios lidos.
8. Se o Studio pretende **editar** vídeo do jogo (o que mudaria a resposta da questão 2.4) — não declarado em nenhum documento lido.
9. Estado real do código do Studio além de `forge_brief.py` — leitura limitada àquele arquivo, ao seu teste e à documentação; não houve auditoria do repositório do Studio.
10. Se a branch `arena/01a0f4ab-lia-gamedev` do Studio será integrada à `main` — o README do Studio alerta que a branch Arena "pode conter trabalho ainda não integrado".

## 7. Impactos propostos em contratos (sem implementar)

Detalhados em [`DOMAIN-CONTRACTS-EVOLUTION-PROPOSAL.md`](DOMAIN-CONTRACTS-EVOLUTION-PROPOSAL.md) §14 (I-1 a I-6) e na seção final de [`T8-REQUIREMENTS-TRACEABILITY.md`](T8-REQUIREMENTS-TRACEABILITY.md): scope/projeção do perfil, relações cross-project, precedência, propriedade e sincronização do núcleo, meio de armazenamento, funcionamento sem Studio — e, condicionados a decisão, contrato de mídia temporal, contrato de staging, formato/validador de splat e categoria de áudio. **Nenhum campo, enum, predicado ou record novo foi proposto nesta revisão**, e a especificação permanece `DRAFT_FOR_HUMAN_REVIEW — NOT AUTHORIZED FOR IMPLEMENTATION`.

## 8. Verificações realizadas nesta revisão

| Verificação | Resultado |
|---|---|
| Branch, `HEAD` e working tree antes de editar | `arena/649f88bd-3dspritesheet`; `HEAD` `13dc4c7d…`; `1 M` (`README.md` raiz) + `115 ?` — preservados |
| Commits T5/T6/vídeo/T7 presentes e ancestrais | `b8403fb`, `79d4b58`, `33fdedf`, `b81b127` — todos ancestrais da ponta remota; `origin/main` = `e988711` intocado |
| Localização de `docs/LIA-FORGE-NA-PIPELINE.md` | Encontrado em `BloomRX/Lia-Studio`, branch `arena/01a0f4ab-lia-gamedev`, blob `82f27727…`, 19.340 bytes; ausente da `main` do Studio e de qualquer repositório da Forge |
| Licenças verificadas por arquivo lido (não só SPDX) | TRELLIS.2 (MIT, código + modelo), Pixal3D (MIT + NOTICE), TripoSR (MIT incluindo pesos), UniRig (MIT código; pesos não verificados), Hunyuan3D-2/2.1 (Tencent Community License com exclusão territorial), ComfyUI (**GPL-3.0**), Blender (GPL-2.0-or-later), Godot (MIT), xatlas (MIT), instant-meshes (NOASSERTION), PixelArtistry-UltraTex (MIT **escopado**), materialcraft/texturecraft (Apache-2.0), hyperframes (Apache-2.0), Maestro (WanGP Non-Commercial 1.1), image-blaster (MIT), artcraft (MIT OR Apache-2.0 + NOTICE; `artcraft-services` NOASSERTION) |
| Hardware declarado × testado | Separados em tabela própria; nada testado pela Forge |
| Especificação e ADR-001 inalterados | sha256 `b4c7977352c4e0b4…` e `2e3cf2a1b376f64c…` conferidos |
| Links, tabelas, JSON e caracteres indevidos | Verificados após as edições (resultado no relatório final) |

## 9. Confirmação de não implementação

Nesta revisão **não** foi: escrito, alterado ou gerado código; alterado teste, dependência, configuração ou contrato; instalada, baixada ou executada ferramenta, modelo ou peso; chamada API paga ou gratuita; enviado arquivo ou dado a serviço externo; aceita licença; feito merge, force push, rebase ou reescrita de histórico; removido arquivo ou trabalho preexistente. As únicas mudanças são **documentos Markdown em `docs/`**.
