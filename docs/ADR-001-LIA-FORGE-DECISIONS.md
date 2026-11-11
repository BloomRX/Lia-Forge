# ADR-001 — Lia Forge: arquitetura aprovada e gates de implementação

**Data do registro documental:** 2026-10-25 (UTC; valor original preservado)  
**Data da aprovação humana:** não registrada separadamente; não inferida do snapshot  
**Estado:** `ACCEPTED — ARCHITECTURE ONLY`  
**Implementação/migração:** `NOT AUTHORIZED`  
**Proposta consolidada:** [LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md](LIA-FORGE-CONSOLIDATED-ARCHITECTURE-PROPOSAL.md)  
**Especificação de contracts:** [DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md](DOMAIN-CONTRACTS-IMPLEMENTATION-SPEC.md) (`DRAFT_FOR_HUMAN_REVIEW`; não autorizada para implementação)

## Contexto e histórico

A proposta consolidada anterior estava `PROPOSED`, com recomendações e questões abertas. A revisão final do usuário aprova as decisões arquiteturais abaixo e substitui interpretações conflitantes anteriores. A aprovação **não** autoriza código, testes, instalação, integração, execução de provider ou migração.

## Decisões

1. **Um produto:** Lia Forge é a única interface/produto. `Lia3DCreate` e `Lia3DSprite` são módulos first-party com responsabilidades distintas. Painel Blender só pode existir como interface técnica auxiliar quando uma operação exigir interação direta com Blender.
2. **Versões e aprovação:** `Asset` é identidade lógica; `AssetVersion` é snapshot imutável; `ArtifactVersion` é revisão imutável de entrega/slot que agrupa `Artifact` refs; `Artifact` é arquivo físico imutável identificado por bytes/hash. Tentativas candidatas, incompletas, rejeitadas e falhas permanecem preservadas. Só `HumanReview=approve` dos refs/hashes exatos, seguido de transação, pode mover `Asset.currentVersionId`.
3. **Profile e legado:** v1 tem um `ProjectVisualProfile` global por Project, com forma evolutiva para escopos futuros e sem herança. `.spriteforge/` permanece intacto; não criar `.spriteforge/project.json`, não escolher banco ou ID de Project e não migrar agora. Mapeadores legados começam read-only e preservam bytes, sidecars, outputs e campos desconhecidos.
4. **Primeira homologação:** modelo 3D existente do usuário → setup explícito de câmera/animação → render → spritesheet PNG + manifesto → validação estrutural → avaliação visual → aprovação humana. Não exige `Lia3DCreate` nem provider generativo.
5. **Renderer e plataforma:** comparar Blender e WebGL/SpriteForge sobre o mesmo input/hash e rubrica; nenhum renderer padrão antes da evidência. Windows, incluindo AMD RX 580 8 GB, é primeiro alvo de homologação — não declaração de suporte; CPU, AMD/Vulkan e outras combinações exigem evidência própria.
6. **Direitos e evidência:** direitos comerciais de outputs e direitos de código, wrapper, dependências, modelos, pesos, datasets e assets são avaliados separadamente. Capability claims devem ser versionados, escopados e sustentados por evidência; claim não substitui validação visual, direitos ou aprovação humana.

## Consequências e decisões ainda abertas

Nenhum provider, modelo/peso, licença/clearance concreto, renderer padrão, mecanismo de persistência/ID do Project, canonicalização de Profile ou operação que justifique painel Blender é escolhido por este ADR. Direitos desconhecidos permanecem `unknown`/bloqueados conforme o uso; omissão não cria default.

## Gate de implementação

Após revisão da proposta e deste ADR, preparar primeiro um pacote delimitado de contracts puros e testes/fixtures. A execução desse pacote exige autorização separada e revisão independente da Arena antes de qualquer etapa seguinte. Nenhuma migração ou escrita de formatos legados está aprovada.
