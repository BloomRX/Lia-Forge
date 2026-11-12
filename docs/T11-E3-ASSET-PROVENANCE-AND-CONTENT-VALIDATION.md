# T11 · Eixo B — Proveniência de assets para o primeiro render E3 e proposta de validação de conteúdo

> **Estado:** preparação e proposta. **Nenhum asset foi baixado, nenhum render executado, nenhum código de produção alterado.** O manifesto-exemplo é **sintético** e não aprova nada.
> **Data:** 2026-11-12 UTC. **Antecessores:** [`T10-E3-RENDERER-VALIDATION.md`](T10-E3-RENDERER-VALIDATION.md) (bloqueios e lacuna de conteúdo) e `local-renderer-test/README.md` (procedimento e manifesto schema 2).

## 1. Auditoria dos assets disponíveis (o que existe e o que não existe)

Inspecionado neste ambiente em 2026-11-12 (e coerente com a T10):

| Candidato | Arquivo no repositório/ambiente? | Licença do modelo/texturas/animações comprovada? | Manifesto? | Uso em teste interno? | Pode entrar no repositório? | Classificação |
|---|---|---|---|---|---|---|
| `mixamo-male` / `mixamo-female` | **Não** (`assets/` inexistente; 0 arquivos `.blend/.fbx/.glb/.gltf/.obj/.stl` em todo o checkout) | **Não** — termos Mixamo/Adobe não revisados; manifesto os marca `awaiting_user_assets_and_terms_review` e arquivos `not-provided` | existe template, sem aprovação | só após asset + revisão humana | **Não** (asset de terceiro sem licença comprovada) | `BLOCKED` |
| `unreal-manny` / `unreal-quinn` (opcionais) | **Não** | **Não** (termos Epic/Fab não revisados) | idem | idem | **Não** | `BLOCKED` |
| `custom-<slug>` | **Não** | n/a até o usuário prover | `customSubjectTemplate` disponível | **sim, é o caminho previsto** para asset próprio | asset próprio pode, se o usuário autorizar e a licença permitir | `UNKNOWN` até provisão |
| Fixtures sintéticos de validador | existem apenas em `local-renderer-test/output/` (**gitignored**, efêmeros; regeneráveis deterministicamente — hashes reproduzidos na T11) | n/a (sintéticos) | n/a | já usados para validar **validadores**, não renderer | não (efêmeros por desenho) | `VERIFIED_IN_FORGE` (só validadores) |

**Conclusão:** **não há nenhum asset executável disponível** e baixar modelos/personagens de terceiros é proibido por esta tarefa. O primeiro render real depende de **asset próprio ou licenciado provido pelo usuário**, com manifesto aprovado. Disponibilidade local **não** implica licença adequada (regra reafirmada).

## 2. Manifesto de proveniência: exemplo sintético

Artefato: [`local-renderer-test/manifests/example-synthetic-own-asset.manifest.json`](../local-renderer-test/manifests/example-synthetic-own-asset.manifest.json) — mesmo `schemaVersion: 2` do manifesto real, com `"exampleOnly": true` e aviso explícito de que **nenhum campo descreve asset real**.

O que o modelo permite registrar (campos presentes): identidade e versão (`id`, `sourceVersion`, `characterTitle`); autor e origem (`authorship.author`, `sourceUrl`, `derivedFrom`, `modifications`); licença e evidência (`licenseRecord.*` incluindo `exactTermsUrlReviewed`, `termsReviewDate`, `evidence`); arquivos relacionados com `role/path/status/sizeBytes/sha256`; animações incluídas (`animations[]` com `sourceClipTitle`, `sourceFilePath`, `blenderActionName`, `confirmedByUser`); restrições (`restrictions[]`); e **autorização de uso no teste** (`authorizationForTest.grantedBy/grantedAt/scope`).

**Regras de preenchimento reafirmadas:** não inventar autoria/licença (usar `not supplied by source` quando a origem não publica versão); `confirmedByUser: true` **somente após inspecionar o clip real**; `redistributionRightsConfirmed` nunca sem evidência; o manifesto **registra fatos, não concede licença**.

## 3. Lacuna de validação de conteúdo (T10 §8.1): proposta técnica

**Problema confirmado por execução:** `validateSpritesheetFiles`/`validateSpritesheetManifest` (produção) aceitam um atlas 384×144 **inteiramente transparente**; a checagem de pixels (alpha por célula, variação `walk`/`run`) existe **apenas** em `local-renderer-test/scripts/verify-output.cjs`.

**Onde a validação de conteúdo deveria acontecer:** na mesma barreira que já valida estrutura, ou seja, no caminho de validação de produção — mas **compartilhada**, não duplicada.

**Proposta (não implementada):**
1. Extrair de `verify-output.cjs` a lógica de (a) decodificação RGBA8, (b) contagem de pixels com `alpha > 0` por célula e (c) variação entre frames de uma mesma ação para um módulo compartilhado (sugestão: `electron/spritesheet-content-checks.cjs`).
2. Fazer `verify-output.cjs` **consumir** esse módulo (sem duplicar) e expor ao validador de produção uma função opcional, **desligada por padrão** até decisão humana, para não mudar comportamento atual.
3. Critérios propostos para evitar falsos positivos: célula inválida = **zero pixels com alpha > 0** (não exigir fundo opaco — transparência legítima é o ponto); ação inválida = **variação zero entre todos os frames** de `walk`/`run` quando a ação existe no asset; limites de cobertura configuráveis por destino, não globais.
4. **Impacto:** toca código de produção (`electron/`) → exige autorização separada; altera apenas adição de checagem, não o contrato 384×144/8×3/24 frames.
5. **Testes necessários:** fixtures sintéticos já disponíveis (cheio, célula vazia, totalmente transparente) + novos fixtures *legitimamente esparsos* (objeto pequeno) e *walk/run idênticos*; regressão dos smokes existentes e do `blender-adapter-smoke.cjs`.

## 4. Condições para executar o primeiro render e procedimento reproduzível

**Condições (ambas obrigatórias):** (i) asset com proveniência aprovada por pessoa (manifesto real com `reviewed_by_user`, `localRenderingConfirmed`, `confirmedByUser` por ação); (ii) ambiente capaz de executar Blender (máquina-alvo Windows, ou outra autorizada). **Nenhuma das duas está satisfeita** neste ambiente nem, até onde se sabe, na máquina-alvo → **bloqueio registrado**, não contornado.

**Procedimento (na máquina-alvo, pelo usuário):** os 8 passos de [`T10-E3-RENDERER-VALIDATION.md`](T10-E3-RENDERER-VALIDATION.md) §11, agora precedidos por: duplicar o modelo de manifesto (real, não o exemplo), preencher com fatos reais e hashes dos arquivos, e só então `run-render.ps1 -Subject <id>`. Repetir a execução e comparar hashes/dimensões/tempos para medir determinismo. Registrar o resultado como adendo datado, mantendo a separação `VERIFIED_IN_FORGE` × `VERIFIED_ON_TARGET_HARDWARE`.
