# Skills & Knowledge Engine

> **Estado:** alvo `PLANNED`. Os arquivos de instrução no checkout são regras de marca/contribuição e documentação/handoff, não um mecanismo de skills de produção em runtime. Confira [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md) e a pesquisa de fontes externas em [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md).

## Papel do módulo

O Skills & Knowledge Engine mantém conhecimento versionado por categoria/estágio/format/provider, recomenda checklists e descreve procedimentos que o usuário ou executor pode seguir. Ele complementa contracts/QA/orchestrator, mas não substitui nenhum deles.

- **Skill:** orientação e critério contextual (por exemplo, arte de sprites, importação FBX, textura tilável).
- **Knowledge record:** fonte normativa/release note/spec de formato, com versão e proveniência.
- **Tool/provider adapter:** executa ação de sistema/API, em processo isolado e sujeito a permissão.
- **Workflow:** grafo concreto de nodes e inputs/outputs.
- **Agent:** opcional, usa um runtime de modelo para interpretar/invocar ferramentas autorizadas.

Uma skill nunca pode, por si só, autorizar acesso a arquivo, instalar dependência, chamar API, enviar arquivo ou iniciar processo.

## Manifesto de skill proposto

```yaml
id: game-art-sprite-normalization
version: 1.0.0
title: Normalizar sprites 2D
description: […]
assetCategories: [sprite, character]
stages: [normalize, validate]
routeTags: [brief-to-2d, existing-asset-to-edit]
inputs: [frames-v1]
outputs: [atlas-v1]
requiredCapabilities: [image.read, image.write]
optionalProviders: []
humanGates: [visual-review]
risks: [asset-overwrite]
offlineUsable: true
source: { upstream: …, commit: …, author: …, contentHash: … }
license: { id: …, url: …, reviewedAt: … }
trust: reviewed-external | first-party | user-provided | unreviewed
```

Nomes e campos são proposta; ainda não há catálogo/runtime schema. `source` e `license` são necessários para material externo e cópias editadas.

## Descoberta e invocação

1. Buscar por categoria, estágio, output contract, idioma e requisitos.
2. Mostrar skills candidatas, fonte/versão/licença, requisitos e limites; não carregar/executar silenciosamente um pacote desconhecido.
3. Filtrar por capabilities realmente disponíveis; skill que requer Blender MCP não pode aparecer como executável sem essa integração.
4. Compor rotas sugeridas sem transformar instrução em autorização.
5. Capturar qual versão/skill influenciou o plano, para reproduzir e comparar.
6. Usar instruções em modo offline quando possível; conteúdo externo não pode exigir internet/conta como condição geral do produto.

## Segurança de conteúdo

Skills externas são dados **não confiáveis**. Podem conter prompt injection, comandos de instalação, URLs, credenciais, instruções conflitantes ou links para assets sem termos claros.

- Renderizar/ler Markdown sem executar fenced code automaticamente.
- Detectar instruções para acessar segredos, desativar gates, exfiltrar dados, baixar conteúdo ou alterar arquivos fora do projeto.
- Mostrar comandos e efeitos e pedir consentimento antes de qualquer execução autorizada por outra camada.
- Isolar scripts opcionais, declarar dependências, revisar source/licença e restringir filesystem/rede.
- Pin upstream e commit/digest; atualizar só com ação explícita e relatório de mudanças.
- Permitir desativar, desinstalar e voltar à versão anterior sem afetar assets.
- Registrar attribution/notices de cópias; licença de skill não cobre modelo, exemplo ou asset referenciado automaticamente.

## Conteúdo do próprio checkout

- `.agents/skills/lia-brand-check/SKILL.md`: skill de consistência de marca para trabalho no repositório; não gera/edita assets pelo Studio.
- `.claude/rules/interface.md`: regra de interface do agente, não skill executável do runtime.
- `docs/agent-workflow.md`: especificação de handoff opcional.
- `docs/guia-externo/` e `docs/Lia.zip`: referência para a marca e apps novos.
- Documentação de ComfyUI/Blender e `docs/humanoid-workflow-research.md`: conhecimento contextual, não registro versionado de capability.

## Fontes externas pesquisadas

- `gamedev-skills/awesome-gamedev-agent-skills` oferece skills com metadata, roteador, scripts e testes; seu guia de criação de game assets exige manifest, normalização e inspeção, mas chama ferramentas de geração externas. Referência para estudar formato, não para afirmar que a Lia Forge gera assets.
- `arjun988/blender-skills` é um grande pacote de instruções para agentes Blender e pressupõe execução via MCP, incluindo Python dentro do Blender; requer revisão curada e controles de execução.
- `sprite-gen` combina uma skill de agente e CLI, mas certas rotas usam provedores remotos/pagos; separar skill local de geração remota.
- `OpenGame` implementa Game Skill em framework de agente para criar jogos web; não é um skill engine genérico de assets.
- `link-ding/image-to-psd` (adendo 2D/2.5D; origem pinada em `main`/`e386bf3a92ef1359379ee582309cb55e85db0e9c`): **skill de agente** que separa uma ilustração de personagem em 19 camadas padrão (`back hair`, `front hair`, `face`, `eyewhite`, `irides`, `mouth`…) e exporta PSD com pixels RGBA e máscara grayscale por camada, preenchendo áreas ocultas por inferência. O conteúdo instrucional (`SKILL.md` e `references/`) é escrito em chinês; o README existe em inglês e chinês. `agents/openai.yaml` declara `display_name`, `default_prompt`, produtos `chatgpt`/`codex`/`api`/`atlas` e **`allow_implicit_invocation: true`**. O export é um script Python (`pillow`, `numpy`, `psd-tools`; `cairosvg` para SVG) e as imagens de referência das partes dependem de ferramenta de geração de imagem do agente. **Não há arquivo `LICENSE`** (API do GitHub: `license: null`); existe apenas **autorização de uso geral declarada pelo usuário**, que não é licença formal Apache/MIT. No manifesto proposto, isso se traduz por `license.id: none-identified`, `source` com commit pinado e **`trust: unreviewed`**: conteúdo externo não confiável, cujas instruções pedem instalação de dependências e chamadas a provider de imagem, e portanto só pode ser lido/renderizado — nunca executado — sem os gates de consentimento. **Não copiar `SKILL.md`, `references/`, prompts, exemplos ou PSDs** para uma skill própria; uma implementação independente reescreve procedimento e textos do zero, e áreas ocultas preenchidas devem ser marcadas como conteúdo reconstruído/gerado.
- `link-ding/doll-studio` (adendo 2D/2.5D; origem pinada em `main`/`127968436dca6d564b6075de94259679e4f17c43`): **não é skill** — é aplicação (editor/player WebGL e app desktop Electron) e runtime 2.5D, registrado como tool/provider candidato em [`TOOL-PROVIDER-HUB.md`](TOOL-PROVIDER-HUB.md). Seu `FORMAT.md`, `THIRD_PARTY_NOTICES.md` e README servem apenas como knowledge record de estudo (formato `.doll` v1, nomenclatura de camadas reconhecida pelo auto-rig, componentes de terceiros Apache-2.0); o código original tem licença **não identificada**, então nada pode ser copiado, adaptado ou redistribuído.

Licenças, versões, testes, riscos e decisões de integração estão detalhados por repositório em [`EXTERNAL-REPOSITORY-RESEARCH.md`](EXTERNAL-REPOSITORY-RESEARCH.md) — itens 10 e 11 cobrem o adendo 2D/2.5D.

## Critérios de aceite futuros

- Import de uma skill mostra diff, origem, licença, dependências e permissões; nada é executado no import.
- Routing tests para categorias/estágios e conflitos; skill não elegível nunca é escolhida só por similaridade textual.
- Prompt-injection/security corpus impede bypass de consentimento, secrets, path traversal, shell/download e rede.
- Skill offline tem checklists úteis sem agent/provider; conteúdo sem source/license aprovado não é redistribuído.
- Pinning e rollback reproduzem a mesma recomendação e registram a versão do conteúdo.