# Política de admissão de ferramentas, providers e modelos

> **Estado:** `PROPOSED` — política para aprovação humana. **Nenhum componente foi admitido por este documento**, e nada aqui autoriza instalação, download, execução, chamada de API, aceite de licença ou custo.
> **Data:** 2026-11-12 UTC. **Fontes:** pesquisa dos itens 1–16 de [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md), [`3D-CHARACTER-PRODUCTION-PIPELINE.md`](3D-CHARACTER-PRODUCTION-PIPELINE.md), [`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md) e [`CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md`](CHARACTER-HAIR-MOTION-BACKENDS-AUDIT-3D.md).
> **Princípio:** existência de formato, provider ou repositório candidato **não** é capacidade implementada; e licença de código **não** cobre pesos, datasets, termos de serviço nem outputs.

## 1. O que é avaliado separadamente (nunca em bloco)

| # | Dimensão | Pergunta objetiva | Falha típica que esta dimensão evita |
|---|---|---|---|
| 1 | **Código-fonte** | Qual licença SPDX, quem detém, há cláusula de copyleft, há exceção de patente? | Tratar `NOASSERTION` como "sem licença" ou como "livre" |
| 2 | **Pesos/checkpoints** | Licença dos pesos é a mesma do código? É não comercial? Exige registro/atribuição? Tem restrição territorial? | "Repo é MIT" → concluir que o output é comercializável |
| 3 | **Datasets** | Licença do dataset de treino e direito de uso do modelo derivado | Herdar restrição de dataset sem registrar |
| 4 | **Dependências** | Há dependência GPL/AGPL, binário sem fonte, wheel de release pessoal? | Cadeia de suprimento não auditada (ex.: wheel hospedado em repositório pessoal) |
| 5 | **Extensões e nodes** | Licença por node, não por repositório hospedeiro | Nós GPL-3.0 dentro de host de outra licença |
| 6 | **Serviços hospedados** | Termos de serviço, jurisdição, SLA, retenção, subcontratados | Chamar de "open source" um app hospedado sem repositório |
| 7 | **APIs** | Autenticação, escopo, rate limit, preço, versão, deprecação | Custo desconhecido virar dependência |
| 8 | **Outputs** | Quem detém, há atribuição obrigatória, há restrição de uso comercial, há marca d'água? | Distribuir output com obrigação de notice não cumprida |
| 9 | **Telemetria** | Envia o quê, para quem, é anônima, tem opt-out real, é verificável? | Tool "gratuita" que envia dados de uso por padrão |
| 10 | **Tratamento de dados** | Que arquivo do usuário sai da máquina, por quanto tempo, para qual região? | Upload de referência privada sem consentimento |
| 11 | **Redistribuição** | Pode ser redistribuído com o produto? Exige notice, fonte, mesma licença? | Empacotar GPL sem oferecer fonte |
| 12 | **Uso comercial** | Permitido, condicionado ou vedado — para código, pesos e outputs separadamente | Adotar licença não comercial em produto |
| 13 | **Custos e limites** | Custo por chamada/assinatura/disco/energia; limite de orçamento por tentativa | Operação paga sem teto |
| 14 | **Manutenção e maturidade** | Último commit, releases, issues, testes, CI, número de mantenedores, ciclo de breaking change | Depender de projeto abandonado ou pré-1.0 sem plano |

## 2. Categorias de admissão

| Categoria | Critérios objetivos (todos obrigatórios) | O que **não** permite |
|---|---|---|
| **`ADMIT`** | Licença de código **e** de pesos permissiva e verificada por componente; sem telemetria obrigatória ou com opt-out verificável; sem upload obrigatório de dado do usuário; roda no hardware-alvo ou tem fallback local; pin de versão/commit; SBOM ou inventário de dependências; documentação de uso e de falha; plano de desativação e remoção | Não autoriza redistribuição de pesos sem revisão própria |
| **`ADMIT_WITH_RESTRICTIONS`** | Todos os critérios de `ADMIT`, **mais** restrição explícita registrada (ex.: copyleft em processo separado, uso não comercial de um componente, telemetria com opt-out, custo por chamada com teto, hardware específico) | Não permite que a restrição seja resolvida por inferência; cada restrição precisa de gate e de responsável |
| **`RESEARCH_ONLY`** | Util para estudo de conceito/formato/arquitetura; sem intenção de execução no produto | Não pode virar dependência, nem ser citado como capability, nem ter código copiado sem revisão de licença |
| **`MONITOR`** | Relevante, mas imaturo, sem licença verificada, sem release, ou em mudança rápida; reavaliação datada | Não permite integração, instalação nem anúncio |
| **`REJECT`** | Licença incompatível com o uso previsto **ou** requisito de hardware incompatível com o alvo **ou** risco de privacidade/dados inaceitável **ou** escopo contrário à arquitetura | Não pode ser reavaliado sem fato novo documentado |
| **`BLOCKED_PENDING_LICENSE_REVIEW`** | Componente tecnicamente interessante cuja licença/direitos não puderam ser verificados (serviço hospedado sem termos acessíveis, `NOASSERTION` sem leitura do arquivo, pesos sem licença declarada) | Não pode ser usado, testado com dados reais nem anunciado; permanece bloqueado até leitura da licença completa |

### 2.1 Reconciliação com os vocabulários já publicados

Esta documentação já usa dois conjuntos de rótulos. A política **não** cria um terceiro sem mapeamento:

| Rótulos de [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md) itens 1–12 | Rótulos dos itens 13–16 | Categoria desta política |
|---|---|---|
| `STUDY` | `INSPIRE` | `RESEARCH_ONLY` (com registro do conceito aproveitado) |
| `ADAPT` | `ADAPT` | `ADMIT_WITH_RESTRICTIONS` **após** revisão; antes disso, `MONITOR` |
| `MONITOR` | — | `MONITOR` |
| `DO NOT INTEGRATE` | `REJECT` | `REJECT` ou `BLOCKED_PENDING_LICENSE_REVIEW`, conforme o motivo |
| — | `ADOPT` | `ADMIT` (não ocorreu em nenhum caso até 2026-11-12) |
| — | `RESEARCH_ONLY` | `RESEARCH_ONLY` |

## 3. Requisitos mínimos por componente (checklist de admissão)

1. **Documentação:** origem oficial, propósito, entradas/saídas, modos de falha conhecidos e o que o componente **não** faz.
2. **Pin de versão/commit:** repositório, branch, commit SHA e data; para serviços, versão de API e data da consulta. Nada entra por "última versão".
3. **SBOM/inventário de dependências:** dependências diretas e transitivas relevantes, com licença por item; binários sem fonte sinalizados; wheels de origem não oficial sinalizados como risco de cadeia de suprimento.
4. **Licença por componente:** código, pesos, dataset, node/extensão e output — **separadamente**, com arquivo lido (não apenas SPDX da API).
5. **Proveniência:** quem publica, onde está hospedado, hash/assinatura quando existir, e como o componente chega à máquina do usuário.
6. **Segurança:** escopo de permissões, acesso a rede, execução de subprocesso, escrita em disco, manipulação de credenciais; default deny para efeitos externos.
7. **Privacidade:** quais dados saem da máquina, para quem, com qual retenção; telemetria com opt-out verificável; **nenhum envio sem consentimento por efeito**.
8. **Fallback:** comportamento quando o componente está ausente, desatualizado, sem licença ou sem rede — a Forge continua utilizável.
9. **Desativação:** interruptor explícito por componente; desativar não apaga artefatos válidos.
10. **Remoção e rollback:** procedimento para remover sem perder outputs, com preservação de proveniência dos assets já produzidos.
11. **Compatibilidade de hardware:** SO, GPU/CPU, VRAM, disco e runtime declarados **pelo autor**, e separadamente o que foi **testado na máquina-alvo**; `unknown` é resposta válida e não vira compatibilidade presumida.
12. **Custo:** conhecido, desconhecido ou zero — registrado como tal, com teto por tentativa quando pago.
13. **Evidência de execução:** para qualquer promoção a `VERIFIED`, registrar OS/hardware exatos, versão do componente, inputs/fixtures, outputs com hash, testes executados e responsável pela revisão.

## 4. Processo de revisão

1. **Triagem documental** (o que foi feito na T7/T8): metadados, árvore, licenças, README, requisitos. Resultado: categoria provisória.
2. **Leitura de licença completa** por componente (código, pesos, dataset, termos de serviço). Sem esta etapa, o máximo é `BLOCKED_PENDING_LICENSE_REVIEW`.
3. **Decisão humana** de admissão, com registro de categoria, restrições, responsável e data. **Não existe admissão automática.**
4. **Autorização separada** para download/instalação (consentimento por efeito), com tamanho, hash, origem e destino declarados antes.
5. **Probe de hardware** na máquina-alvo: detectar, não afirmar. Resultado registrado como `installed`/`detected`/`configured`/`licensed`/`unavailable`/`unknown`.
6. **Execução real com fixture** e registro de evidência (só então `VERIFIED`, escopado ao comportamento estreito testado).
7. **Reavaliação datada** para `MONITOR` e para componentes pré-1.0.
8. **Plano de saída** escrito antes da entrada: como desativar, remover e reverter.

## 5. Exemplos aplicados às ferramentas estudadas

| Componente (pin) | Tipo | Código | Pesos | Telemetria/dados | Hardware | Categoria proposta | Motivo objetivo |
|---|---|---|---|---|---|---|---|
| [`heygen-com/hyperframes`](https://github.com/heygen-com/hyperframes) `2a70733c15` | Backend de vídeo | **Apache-2.0** (com patente) | n/a | CLI envia uso (comandos + desempenho), anônima até sign-in, **opt-out** `telemetry disable`; render local não envia projeto; cloud render faz upload | Node 22+, FFmpeg, Chrome headless; **sem GPU/CUDA**; Windows Intel/AMD 64-bit; nada testado no alvo | **`ADMIT_WITH_RESTRICTIONS`** (candidato) | Restrições: telemetria (desligar por padrão), instalação de 3 dependências com consentimento, versão pré-1.0, cloud render excluído do caminho padrão, contrato de mídia temporal inexistente |
| [`microsoft/TRELLIS.2`](https://github.com/microsoft/TRELLIS.2) + [`TRELLIS.2-4B`](https://huggingface.co/microsoft/TRELLIS.2-4B) | Image-to-3D | **MIT** | **MIT** (declarado na ficha do modelo) | Execução local | **NVIDIA ≥24 GB necessária**, **Linux-only**, CUDA 12.4 | **`REJECT`** para o alvo atual | Incompatível com Windows + RX 580 8 GB por declaração do autor; reavaliável se o hardware-alvo mudar |
| [`TencentARC/Pixal3D`](https://github.com/TencentARC/Pixal3D) | Image-to-3D | **MIT** + `NOTICE` | MIT (badge aponta `TencentARC/LICENSE`) | Local | **Exige instalação do TRELLIS.2**; `natten` compilado por arquitetura CUDA; `--low_vram` 1024 | **`REJECT`** para o alvo atual + `MONITOR` como técnica | Herda os requisitos do TRELLIS.2; adicional: wheel `utils3d` em release pessoal (cadeia de suprimento) |
| [`VAST-AI-Research/TripoSR`](https://github.com/VAST-AI-Research/TripoSR) | Image-to-3D | **MIT** | **MIT, incluindo pretrained models** (declarado no README) | Local | ~6 GB VRAM; **fallback CPU** documentado | **`ADMIT_WITH_RESTRICTIONS`** (candidato a avaliar) | Restrições: sem push desde 2026-06-04, saída sem PBR, CPU lenta, exige probe real no alvo |
| [`VAST-AI-Research/UniRig`](https://github.com/VAST-AI-Research/UniRig) | Rigging | **MIT** | Checkpoint HF `VAST-AI/UniRig` — **licença não verificada** | Local | `spconv`, `torch_scatter`, `torch_cluster` com wheels **por versão de CUDA** | **`BLOCKED_PENDING_LICENSE_REVIEW`** | Licença dos pesos não lida; dependências CUDA; checkpoints completos ainda pendentes upstream |
| [`Tencent-Hunyuan/Hunyuan3D-2`](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) / `-2.1` | Image-to-3D | `NOASSERTION` | **Tencent Hunyuan 3D 2.0 Community License**: não exclusiva, intransferível, royalty-free; **não se aplica em UE, Reino Unido e Coreia do Sul**; exige cópia do acordo a terceiros; Acceptable Use Policy | Local | CUDA (não verificado nesta revisão) | **`BLOCKED_PENDING_LICENSE_REVIEW`** | Restrição territorial e obrigações de distribuição exigem revisão jurídica humana; `Hunyuan3D-3.x` **não localizado** como repositório público (404 em 2026-11-12) |
| [`comfyanonymous/ComfyUI`](https://github.com/comfyanonymous/ComfyUI) | Host de workflows | **GPL-3.0** | n/a (checkpoints do usuário) | Local | "Todos os SOs e tipos de GPU"; 4 GB VRAM + 8 GB RAM com streaming; AMD Windows = ROCm 10.0 com `device-gfx1200/1201` (RDNA4); `--directml` e `--cpu` existem no código | **`ADMIT_WITH_RESTRICTIONS`** (já em uso como processo separado) | Restrições: GPL-3.0 (integração por endpoint HTTP, sem linkagem — fronteira a registrar); suporte a Polaris/RX 580 **não documentado** → `unknown` |
| Nós [`Mstafa-awad/*`](https://github.com/Mstafa-awad) (WTiVo, LODTailor, Bake Forger, UltraTex) | Nodes de ComfyUI | **GPL-3.0** | Sem pesos (UltraTex usa FLUX) | Local | Host ComfyUI | **`ADMIT_WITH_RESTRICTIONS`** para uso local · **`REJECT`** para redistribuição sem cumprir GPL | Restrição: redistribuir workflow que os inclui exige cumprir GPL-3.0; maturidade baixa (★0–21, sem releases) |
| [`pixelartistry/PixelArtistry-UltraTex`](https://github.com/pixelartistry/PixelArtistry-UltraTex) + FLUX.2 Klein | Texturização | **MIT escopado** (só instalador e layouts/notas; nodes e modelos mantêm licenças próprias) | **FLUX Non-Commercial License v2.1** → outputs **não comerciais** | Local | Host ComfyUI | **`REJECT`** para uso comercial · `RESEARCH_ONLY` como técnica | Peso não comercial contamina o output; MIT escopado não cobre os componentes que efetivamente executam |
| [`blender/blender`](https://github.com/blender/blender) | DCC/renderer | **GPL-2.0-or-later** (`NOASSERTION` no SPDX) | n/a | Local | CPU/GPU conforme build | **`ADMIT_WITH_RESTRICTIONS`** (já adotado como interface técnica auxiliar no ADR-001 Decisão 5) | Restrição: processo separado, sem linkagem; suporte de GPU da RX 580 não verificado |
| [`godotengine/godot`](https://github.com/godotengine/godot) | Engine de destino | **MIT** | n/a | Local | Amplo | **`RESEARCH_ONLY`** (destino, não componente da Forge) | A Forge exporta para engine; não a embute nem a redistribui |
| [`jpcy/xatlas`](https://github.com/jpcy/xatlas) | Biblioteca de UV | **MIT** | n/a | Local | CPU | **`ADMIT_WITH_RESTRICTIONS`** (candidato) | Restrição: seria nova dependência de código — exige decisão e SBOM; maduro e estável (2024) |
| [`wjakob/instant-meshes`](https://github.com/wjakob/instant-meshes) | Retopologia | **NOASSERTION** | n/a | Local | CPU | **`BLOCKED_PENDING_LICENSE_REVIEW`** | Licença não lida; sem push desde 2022-01-03 |
| [`storytold/materialcraft`](https://github.com/storytold/materialcraft) / [`texturecraft`](https://github.com/storytold/texturecraft) | Materiais/textura 3D | **Apache-2.0** | n/a | Apps locais ("your files, your machine") | Rust nativo + WASM | **`RESEARCH_ONLY`** como ferramentas externas · **`INSPIRE`/`RESEARCH_ONLY`** para a arquitetura `craft-ai-*` | São apps interativas, não providers automáticos; a arquitetura de integrações é referência de desenho, não código adotável na stack da Forge |
| [`Blizaine/Maestro`](https://github.com/Blizaine/Maestro) | Studio de vídeo/imagem/áudio | **WanGP Non-Commercial Evaluation License 1.1** (vedado integrar/oferecer como serviço/API/produto pago) | Pesos de terceiros com licenças próprias (MiniMax H3 etc.) | Local + serviços opcionais | **NVIDIA ≥6 GB**, 150 GB disco; **AMD e macOS não suportados** | **`REJECT`** · conceitos como `RESEARCH_ONLY` | Licença proíbe exatamente a integração; hardware incompatível com o alvo |
| [`neilsonnn/image-blaster`](https://github.com/neilsonnn/image-blaster) | Skillset + viewer | **MIT** | Pesos dos providers (não cobre) | **Upload da imagem do usuário** em toda geração; chaves entregues ao agente no chat | Sem GPU local; rede obrigatória | **`RESEARCH_ONLY`** (convenções) · providers: `BLOCKED_PENDING_LICENSE_REVIEW` | Projeto inativo desde 2026-05-15; torna World Labs/FAL dependências obrigatórias; padrão de credencial inaceitável |
| [`storytold/artcraft`](https://github.com/storytold/artcraft) | IDE de criação com Scene Composer | **MIT OR Apache-2.0** + `NOTICE`; `artcraft-services` **NOASSERTION** | Providers hospedados (62 modelos, Grok, Midjourney, Sora, World Labs) | Geração em serviços externos | Apps nativas locais; geração cloud | **`RESEARCH_ONLY`** (conceito e arquitetura) | Incorporar o projeto inteiro comprometeria autonomia e escopo; a decisão do Studio já determina que ferramenta de criação avaliada pertence ao catálogo da **Forge**, não à arquitetura do Studio |
| ActionForge · VARCO 3D | Serviços hospedados | **Sem repositório público** | Termos não verificados | Não verificado | Não verificado | **`BLOCKED_PENDING_LICENSE_REVIEW`** | Não são open source; VARCO é segmento patrocinado do vídeo de origem |
| [`link-ding/image-to-psd`](https://github.com/link-ding/image-to-psd) · [`link-ding/doll-studio`](https://github.com/link-ding/doll-studio) | Skills/editores 2D-2.5D | `license: null`, **sem `LICENSE`** (image-to-psd); licença do código original **não identificada** (doll-studio) | MediaPipe ~17 MB (doll-studio) | doll-studio reescreve `~/.claude/settings.json` e `~/.codex/config.toml` (task alerts) | Local | **`BLOCKED_PENDING_LICENSE_REVIEW`** | Autorização de uso **declarada pelo usuário** não substitui documento de licença; comportamento de escrita em configuração de agente exige revisão |
| Mixamo · serviços de mocap (Rokoko/DeepMotion/Move.ai) | Rigging/animação hospedados | Termos de serviço | n/a | Upload de mídia | Remoto | **`BLOCKED_PENDING_LICENSE_REVIEW`** | Direitos de uso comercial e retenção não verificados nesta revisão |

## 6. Regras transversais

1. **Nenhum provider é obrigatório.** Toda capability precisa de fallback local, manual ou de ausência declarada (`unknown`).
2. **Consentimento por efeito.** Instalação, download de peso, aceite de licença, envio de dado, uso de API, custo, upload e escrita destrutiva são autorizações separadas e explícitas.
3. **Credenciais fora dos dados do projeto.** Nenhum segredo em JSON de projeto, perfil, proveniência ou log (o padrão do image-blaster — entregar chave ao agente no chat — é explicitamente vedado).
4. **Telemetria desligada por padrão.** Ferramenta sem opt-out verificável não entra como `ADMIT`.
5. **Stars, downloads e patrocínio não são evidência** de qualidade, de compatibilidade nem de direitos.
6. **Conteúdo patrocinado e links de afiliado** são sinalizados como tal e não sustentam conclusão técnica.
7. **Copyleft é compatível com processo separado**, não com linkagem ou redistribuição sem revisão.
8. **Licença não comercial em qualquer componente da cadeia** impede `ADMIT` para produto com uso comercial, independentemente da licença do código da Forge.

## 7. O que esta política não faz

Não admite nenhum componente (todas as linhas da §5 são **propostas** de categoria para decisão humana), não autoriza download/instalação/execução, não aceita licença, não define orçamento, não escolhe provider e não altera contratos nem código.
