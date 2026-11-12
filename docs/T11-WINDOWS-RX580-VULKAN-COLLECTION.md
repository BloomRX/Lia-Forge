# T11 — Coleta segura de hardware e Vulkan na máquina-alvo (Windows + RX 580)

> **Estado:** procedimento **preparado e revisado**, **não executado** na máquina-alvo (o ambiente do agente é Debian 12 sem GPU; executar aqui não representaria o Windows). Nenhum probe, download, compilação ou instalação foi iniciado.
> **Data:** 2026-11-12 UTC. **Antecessor direto:** [`T10-E1-RX580-VULKAN-PREFLIGHT.md`](T10-E1-RX580-VULKAN-PREFLIGHT.md) §1.2 e §8. **Artefato:** [`tools/diagnostics/t11-windows-hardware-vulkan-preflight.ps1`](../tools/diagnostics/t11-windows-hardware-vulkan-preflight.ps1) v1.0.0.
> **Pergunta que este documento serve:** *a RX 580 / gfx803 executa de forma funcional e sustentável a rota Vulkan res-512, considerando VRAM, RAM e requisitos reais do modelo?* Até haver medição na máquina-alvo, **UNKNOWN**.

## 1. Auditoria do checklist da T10 (o que faltava)

O checklist da T10 (§1.2) media GPU/driver/CPU/RAM/pagefile/disco e, para Vulkan, apenas "`vulkaninfo --summary` se já instalado". Auditoria contra os cinco estágios que **não se implicam entre si**:

| Estágio | Checklist T10 media? | Script T11 mede? | Como |
|---|---|---|---|
| 1. Vulkan **instalado** (loader) | Não | **Sim** | presença/versão de `vulkan-1.dll` em System32/SysWOW64 |
| 2. **ICD** do fabricante registrado | Não | **Sim** | leitura (somente leitura) de `HKLM:\SOFTWARE\Khronos\Vulkan\Drivers` e WOW6432Node |
| 3. **Dispositivo enumerado** (RX 580 identificada, apiVersion/driverVersion) | Parcial (só se `vulkaninfo` existisse) | **Sim, condicional** | `vulkaninfo --summary` **se já instalado**; senão `UNKNOWN` (não instala) |
| 4. **Contexto inicializado** | Não | **Não — declarado `NAO TESTADO`** | exigiría binário Vulkan; fora do escopo de diagnóstico |
| 5. **Kernels / modelo funcionais no backend** | Não | **Não — declarado `NAO TESTADO`** | é o probe autorizado à parte (T10 §8) |

Outras lacunas fechadas pelo script: VRAM **disponível** marcada `UNKNOWN` (não há consulta confiável sem ferramenta do fabricante — não inferir); **volume dos temporários** (relevante porque rotas de retopo usam TMPDIR); **processos concorrentes** (top-10 por RAM, só nome e MB); **identificador PCI** com nota de que `VEN_1002&DEV_67DF` indicaria Polaris/RX 580; **caveat do campo `AdapterRAM`** (32 bits, trunca acima de 4 GB); **hash SHA-256 do relatório** e **versão do script** embutidos.

## 2. O script de coleta (propriedades revisadas)

`tools/diagnostics/t11-windows-hardware-vulkan-preflight.ps1` (v1.0.0). Justificativa da localização: o repositório não possuía `tools/`; criar `tools/diagnostics/` separa diagnóstico **somente leitura** do código de produção em `scripts/` e do harness de render em `local-renderer-test/scripts/`, evitando que um script de medição seja confundido com pipeline.

Propriedades verificadas por inspeção (e declaradas no cabeçalho):

- **Somente leitura:** nenhuma chamada de rede (`Invoke-WebRequest`/`Invoke-RestMethod` ausentes), nenhuma instalação/remoção/alteração de registro, driver, pagefile ou variável de ambiente; único `Set-Content` grava o próprio relatório local.
- **Sem administrador:** todas as leituras (CIM, registro HKLM em modo leitura, `Get-Process`) funcionam como usuário padrão.
- **Tolerante a falhas:** cada medição passa por `Try-Get`; exceção vira `UNKNOWN` + motivo, sem interromper a coleta.
- **Sem dados pessoais:** não coleta nomes de usuário, credenciais, tokens, conteúdo pessoal nem inventário de arquivos; lista apenas os 10 maiores processos por RAM (nome e MB).
- **Reprodutível/auditável:** versão do script, timestamp UTC e `ReportSHA256` (hash do corpo do relatório) no próprio arquivo.
- **Compatível com PowerShell 5.1** (sem operador ternário nem sintaxe de PS 7).

**Como executar (na máquina-alvo, pelo usuário):**
```powershell
cd <raiz do checkout do Lia Forge>
powershell -ExecutionPolicy Bypass -File .\tools\diagnostics\t11-windows-hardware-vulkan-preflight.ps1
# ou, sem gravar arquivo:
powershell -ExecutionPolicy Bypass -File .\tools\diagnostics\t11-windows-hardware-vulkan-preflight.ps1 -NoReport
```
Compartilhar o `.txt` gerado (ele contém apenas hardware/SO/Vulkan/top-10 processos; remova linhas se preferir). **Não** executar no ambiente Linux do agente esperando representar o Windows.

## 3. Interpretação: o que cada medição permite concluir

| Medição | Permite concluir | **Não** permite concluir |
|---|---|---|
| `PNPDeviceID` = `VEN_1002&DEV_67DF` | que a GPU física é Polaris/RX 580 | que ela é suportada por qualquer backend |
| `AdapterRAM` ≈ 8 GB (confirmado na UI AMD) | VRAM total | VRAM **disponível** após desktop/compositor |
| Driver + data | idade do driver e se é anterior/posterior a um requisito | compatibilidade Vulkan de um runtime específico |
| `vulkan-1.dll` presente | **estágio 1** (loader) | que algum dispositivo será enumerado |
| ICD AMD em `Khronos\Vulkan\Drivers` | que o driver registra um ICD | que o ICD expõe gfx803 com as extensões necessárias |
| `vulkaninfo` lista a RX 580 + `apiVersion` | **estágios 2–3** (dispositivo enumerado, versão de API) | que kernels ggml Vulkan rodem nela |
| Contexto inicializado (probe) | **estágio 4** | que o modelo caiba em VRAM/RAM |
| Geração res-512 completa com tempos/VRAM (probe) | **estágio 5** — a única que responde a pergunta principal | nada além disso; não valida qualidade |

**Regras de não-promoção (reafirmadas):** a RX 580 **não** será classificada como compatível porque (a) tem Vulkan, (b) o loader existe, (c) há binário Vulkan publicado, (d) outra GPU AMD executou o projeto, (e) o modelo está quantizado, ou (f) os pesos cabem em disco. Cada um desses fatos corresponde a um estágio **anterior** ao que importa.

## 4. Limites desta etapa

Não executar o probe res-512; não baixar os ~16,5 GB de pesos; não compilar `trellis.cpp`/`pixal3d.cpp`; não instalar Vulkan/drivers/runtimes; não contornar requisitos de memória experimentalmente. A entrega é **o procedimento e a tabela de interpretação**, não um resultado de compatibilidade.

## 5. Como o resultado alimenta decisões futuras

1. Relatório recebido → atualizar [`T10-E1-RX580-VULKAN-PREFLIGHT.md`](T10-E1-RX580-VULKAN-PREFLIGHT.md) §1.1/§1.2 com valores reais e reclassificar os `UNKNOWN` de hardware/Vulkan (estágios 1–3).
2. Se estágio 3 falhar (dispositivo não enumerado / apiVersion insuficiente) → rota Vulkan vira `BLOCKED_BY_BACKEND` **para gfx803**, e o plano local passa a ser CPU/remote-only, sem nova especulação.
3. Se estágio 3 passar → permanece `UNKNOWN` até probe autorizado (estágios 4–5), que continua exigindo autorização separada, verificação de proveniência dos GGUF/espelhos e registro de VRAM/RAM por passo.
4. Em todos os casos, registrar em [`T9-REQUIREMENTS-TRACEABILITY.md`](T9-REQUIREMENTS-TRACEABILITY.md) (bloco L) distinguindo **medição própria** de **declaração de terceiro**.
