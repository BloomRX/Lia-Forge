# Gestão de assets, versões e proveniência

> **Estado:** **parcialmente implementado** (T13, 2026-11-13 UTC). `shared/assets/manager.mjs` traz catálogo com schema versionado (`ASSET_MANAGER_SCHEMA_VERSION = 1`), versões por asset, proveniência (adapter, licença, direitos da saída, SHA-256 do run), seis estados de direitos (`owned`, `licensed`, `license-pending`, `unknown`, `restricted`, `blocked`), classificação por dica de licença sem inventar restrição e relatório de direitos; runs concluídos podem ser anexados como versão de um asset. Evidência executada: `tests/asset-manager-smoke.mjs` e `tests/studio-service-smoke.mjs`. Seguem como **alvo**: version graph com ramificação/fusão e deduplicação por conteúdo. O manifesto JSON do workspace e os snapshots de execução continuam sendo a base legada; confira [`IMPLEMENTATION-AUDIT.md`](IMPLEMENTATION-AUDIT.md) e [`T13-IMPLEMENTATION-EVIDENCE.md`](T13-IMPLEMENTATION-EVIDENCE.md).

## Objetivo

Manter cada asset utilizável fora da aplicação e reconstruível a partir de registros verificáveis: origem, transformações, versões, licenças, arquivos, checks, approvals e relação com o projeto. O gerenciador não deve mover, apagar ou sobrescrever dados silenciosamente.

## Entidades lógicas

```text
Project
  └── Asset (identidade lógica, categoria e briefing)
       ├── AssetVersion (snapshot imutável de uma revisão aprovada)
       │    ├── Artifact (arquivo bruto, derivado, fonte, preview ou relatório)
       │    └── WorkflowRun / Transformation (inputs → outputs)
       ├── Reference (origem e direitos independentes)
       ├── LicenseRecord / ConsentRecord
       ├── QA evidence / HumanReview
       └── ComparisonGroup (opcional)
```

| Entidade | Campos mínimos propostos |
|---|---|
| **Project** | ID estável, raiz visível, schema version, engine/alvo opcional, data, configurações locais sem segredos. |
| **Asset** | ID, nome, categoria/subtipo extensível, brief, tags, targets, owner do projeto, estado e versão corrente. |
| **AssetVersion** | ID, parent version(s), data, autor/ator, motivo, conjunto imutável de artefatos e status de revisão. |
| **Artifact** | ID, caminho relativo/URI, media type, extensão, bytes, SHA-256, tamanho/dimensões/metadata quando aplicável, papel (source/intermediate/final/evidence), parent IDs, estado/validator. |
| **Transformation / WorkflowRun** | Workflow/versão, adapter/provider/modelo e versões, parâmetros redigidos, inputs/outputs/hash, ambiente reportado, tempo/custo quando medido, consentimentos, status e logs. |
| **ProvenanceRecord** | Fonte/URL/autor, data de criação/aquisição, ferramenta, versão, modelo/weights, prompt/ref IDs conforme autorizado, licença/termos e alterações. |
| **Review / Evidence** | Revisor/ator, data, artefato/hash, checklist, aceito/rejeitado/pendente, justificativa, screenshot/contact sheet se aprovado para armazenar. |

Estes nomes descrevem o domínio; não congelam JSON schema, SQLite ou outro backend. A escolha de armazenamento permanece aberta.

## Proveniência e direitos

- O código do provider, o modelo/weights, o prompt, o asset de referência, o output e os arquivos de exemplo podem ter termos diferentes.
- Registrar URL/autor/versão/commit/checksum onde aplicável; guardar evidência/termos apenas de modo autorizado e sem segredos pessoais.
- Registrar as permissões e restrições aplicadas ao arquivo específico; não inferir que `MIT`/`Apache-2.0` do código concede direitos sobre modelos, APIs, outputs, demo images ou dados de treino.
- Uma transformação conserva lineage: um atlas editado aponta para as imagens/frames/modelos que o produziram; uma conversão não apaga a origem.
- Se os termos de um artefato derivado não puderem ser inferidos, estado `UNKNOWN`/`REVIEW_REQUIRED`; não rotular como liberado para uso comercial.
- O aceite de uma licença deve estar vinculado ao identificador exato da licença/versão e ao material escolhido; trocar URL, hash ou modelo exige nova revisão.
- Custos reais, envio de dados e retenção remota pertencem ao registro de execução, não a uma nota genérica do projeto.

## Versões e operações não destrutivas

1. **Importar:** registrar origem e hash; deixar bytes no lugar de origem por padrão; cópia só após escolha.
2. **Editar/converter:** criar nova versão/saída adjacente ou branch; não sobrescrever a fonte sem confirmação explícita.
3. **Reexecutar:** manter outputs anteriores e registrar novo run; comparar por conteúdo/hash, não apenas nome de arquivo.
4. **Retomar:** conferir fingerprint de inputs/contrato/versões; reutilizar somente nodes comprovadamente compatíveis.
5. **Exportar:** empacotar manifestos/artefatos necessários, notices e instrução; excluir credenciais, caches privados e dados pessoais por padrão.
6. **Apagar:** exigir seleção explícita, mostrar relações/outputs dependentes, preservar lixeira ou backup reversível quando o usuário aprovar.

IDs não devem ser derivados apenas do nome do arquivo. Renomear arquivo não cria novo conteúdo; mesmo conteúdo em outro caminho não implica mesma função ou licença.

## Estrutura de pastas

O layout físico deve ser configurável e preservar um workspace externo ao app. Uma organização lógica possível (não contrato de implementação) é:

```text
<Project>/
  .lia-forge/                 # manifestos, runs, índice/cache reconstruível
    project.json
    assets.json
    runs/<run-id>/
      run.json
      evidence/
  assets/<category>/<asset-id>/
    source/                    # originais sob controle do usuário
    versions/<version-id>/
      artifacts/
      provenance.json
      qa.json
      README.md                # opcional, export de entrega
```

Não mover o namespace `.spriteforge/` atual nesta tarefa: ele continua por compatibilidade. Migração de diretório/schema requer ferramenta que valide cópia e hash, mantenha fonte original e permita rollback.

## Modelo de dados e migração

- Schema version explícita e política de compatibilidade para novas versões.
- Escrita atômica; limites de tamanho/contagem; rejeição de JSON/paths inválidos; paths resolvidos dentro das raízes aprovadas.
- Índice/cache pode ser reconstruído a partir de manifestos, mas os artefatos originais são a fonte do conteúdo.
- Cada migration gera relatório de antes/depois, erros, conflitos e hashes; não faz merge automático de conflitos ambíguos.
- Backup/restore testado com paths relativos, Unicode, arquivos grandes e symlinks.
- Export sem banco proprietário: manifests e arquivos acessíveis sem abrir Lia Forge.

## Auditoria do estado atual

Hoje o app mantém assets de personagem/item em `.spriteforge/assets.json` e snapshots de workflow em `.spriteforge/runs/`; o runner registra caminhos, tamanhos, checksums e validações de outputs. O renderer local antigo tem manifesto próprio. Isso não oferece AssetVersion imutável, lineage abrangente para edição/conversão, busca transversal, compare de versões, aceite universal de licenças nem sincronização. Não tratar log/snapshot de execução como versionamento completo.

## Critérios de aceite futuros

- Criar, editar, duplicar e exportar assets sem perder os originais.
- Reabrir o projeto sem internet e recuperar assets, lineage e estado local.
- Detectar arquivo alterado/movido por hash e solicitar reconciliação sem aprovar silenciosamente.
- Atribuir a cada output seu input/tool/provider/model/versão/licença e evidência de QA.
- Não serializar chave de API, token, senha ou credencial em manifestos/logs/export.
- Testes cobrem mudança de schema, crash durante escrita, arquivo corrompido, symlink, path externo, importação sem cópia e export/reimport.
- Uma pessoa consegue revisar o asset em ferramenta comum sem depender de Lia Forge.