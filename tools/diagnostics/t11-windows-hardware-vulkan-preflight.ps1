#Requires -Version 5.1
<#
.SYNOPSIS
  T11 - Diagnostico SOMENTE LEITURA de hardware e Vulkan para a maquina-alvo do Lia Forge
  (Windows + AMD RX 580 / gfx803). Versao 1.0.0 (2026-11-12).

.DESCRIPTION
  Coleta, sem alterar nada, os dados necessarios para fechar os UNKNOWN registrados em
  docs/T10-E1-RX580-VULKAN-PREFLIGHT.md e docs/T11-WINDOWS-RX580-VULKAN-COLLECTION.md.

  GARANTIAS (revisadas):
    * NAO instala, atualiza ou remove qualquer componente.
    * NAO altera drivers, pagefile, variaveis de ambiente, registro ou configuracoes.
    * NAO baixa binarios, modelos, pesos ou dependencias. NAO faz chamadas de rede.
    * NAO inicia inferencia, geracao, render nem cria contexto Vulkan.
    * NAO exige administrador (todas as leituras sao de usuario; registro apenas leitura).
    * Um comando que falha NAO interrompe a coleta: o item vira UNKNOWN/ERRO Registrado.
    * Informacao indisponivel e marcada UNKNOWN - nunca inventada.
    * NAO coleta nomes de usuario, credenciais, tokens, conteudo pessoal nem inventario
      indiscriminado de arquivos. Lista apenas os 10 maiores processos por RAM (nome e MB).
    * NAO envia dados a nenhum servidor. O relatório e gravado localmente.

  O que este script NAO prova (ver docs/T11-WINDOWS-RX580-VULKAN-COLLECTION.md sec. 3):
    loader presente != dispositivo enumerado != contexto inicializado != kernels
    funcionais != modelo executando no backend. Este script cobre ate "dispositivo
    enumerado" (via vulkaninfo, se JA instalado). Contexto/kernels/modelo exigem probe
    separado, autorizado a parte.

.PARAMETER OutFile
  Caminho do relatorio textual. Padrao: .\t11-preflight-report-<UTC>.txt

.PARAMETER NoReport
  Imprime no console e nao grava arquivo.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\tools\diagnostics\t11-windows-hardware-vulkan-preflight.ps1
#>
[CmdletBinding()]
param(
  [string]$OutFile = '',
  [switch]$NoReport
)

$ScriptVersion = '1.0.0'
$ErrorActionPreference = 'Continue'
$findings = New-Object System.Collections.Generic.List[object]

function Add-Finding {
  param([string]$Group, [string]$Item, [string]$Value, [string]$Note = '')
  $findings.Add([pscustomobject]@{ Group = $Group; Item = $Item; Value = $Value; Note = $Note }) | Out-Null
}
function Try-Get {
  param([string]$Group, [string]$Item, [scriptblock]$Block, [string]$Note = '')
  try {
    $v = & $Block
    if ($null -eq $v -or "$v" -eq '') { Add-Finding $Group $Item 'UNKNOWN' 'valor vazio' }
    else { Add-Finding $Group $Item ("$v") $Note }
  } catch {
    Add-Finding $Group $Item 'UNKNOWN' ("erro: " + $_.Exception.Message)
  }
}

# ---------- 1. Identificacao do script e do momento ----------
Add-Finding 'meta' 'script' 't11-windows-hardware-vulkan-preflight.ps1' "versao $ScriptVersion; somente leitura; sem rede"
Add-Finding 'meta' 'utc' (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') ''
Add-Finding 'meta' 'host' ([System.Environment]::MachineName) 'nome da maquina apenas; nenhum dado pessoal'

# ---------- 2. Sistema operacional ----------
Try-Get 'os' 'caption' { (Get-CimInstance Win32_OperatingSystem).Caption }
Try-Get 'os' 'version' { (Get-CimInstance Win32_OperatingSystem).Version }
Try-Get 'os' 'build' { [System.Environment]::OSVersion.Version.Build }
Try-Get 'os' 'arch' { if ([System.Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' } } 'Is64BitOperatingSystem'

# ---------- 3. CPU ----------
Try-Get 'cpu' 'name' { (Get-CimInstance Win32_Processor | Select-Object -First 1).Name }
Try-Get 'cpu' 'cores' { (Get-CimInstance Win32_Processor | Select-Object -First 1).NumberOfCores }
Try-Get 'cpu' 'logical' { (Get-CimInstance Win32_Processor | Select-Object -First 1).NumberOfLogicalProcessors }

# ---------- 4. RAM e memoria virtual ----------
Try-Get 'mem' 'ram_total_mb' { [math]::Round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize / 1KB) }
Try-Get 'mem' 'ram_free_mb' { [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1KB) }
Try-Get 'mem' 'pagefile_auto' { (Get-CimInstance Win32_ComputerSystem).AutomaticManagedPagefile } 'true = gerenciado pelo sistema'
Try-Get 'mem' 'pagefile_entries' {
  ($pf = Get-CimInstance Win32_PageFileUsage)
  if (-not $pf) { 'nenhum pagefile ativo' } else { ($pf | ForEach-Object { "$($_.Name) alocado=$($_.AllocatedBaseSize)MB emuso=$($_.CurrentUsage)MB" }) -join ' | ' }
}

# ---------- 5. GPU ----------
Try-Get 'gpu' 'count' { (Get-CimInstance Win32_VideoController).Count }
$gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
$i = 0
foreach ($g in $gpus) {
  $i++
  Add-Finding 'gpu' "[$i] name" ("$($g.Name)") ''
  Add-Finding 'gpu' "[$i] vendor" ("$($g.AdapterCompatibility)") ''
  Add-Finding 'gpu' "[$i] pnpdeviceid" ("$($g.PNPDeviceID)") 'VEN_1002&DEV_67DF indicaria Polaris/RX 580'
  Add-Finding 'gpu' "[$i] driverversion" ("$($g.DriverVersion)") ''
  Add-Finding 'gpu' "[$i] driverdate" ("$($g.DriverDate)") ''
  Add-Finding 'gpu' "[$i] status" ("$($g.Status)") ''
  Add-Finding 'gpu' "[$i] adapterram_bytes" ("$($g.AdapterRAM)") 'AVISO: campo de 32 bits; acima de 4 GB pode vir truncado - confirme na UI do fabricante'
}
Add-Finding 'gpu' 'vram_available' 'UNKNOWN' 'nao ha consulta confiavel sem ferramenta do fabricante ou contador de desempenho; nao inferir'

# ---------- 6. Disco e temporarios ----------
Try-Get 'disk' 'volumes' {
  (Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    "$($_.Name): livres=$([math]::Round($_.Free / 1GB, 1))GB usados=$([math]::Round($_.Used / 1GB, 1))GB"
  }) -join ' | '
}
Try-Get 'disk' 'temp_path' { [System.IO.Path]::GetTempPath() }
Try-Get 'disk' 'temp_volume_free_gb' {
  $t = [System.IO.Path]::GetTempPath()
  [math]::Round((Get-PSDrive -Name ([System.IO.Path]::GetPathRoot($t).TrimEnd('\'))).Free / 1GB, 1)
} 'relevante porque rotas de retopo usam TMPDIR em RAM/disco'

# ---------- 7. Processos maiores por RAM (proxy de concorrencia) ----------
Try-Get 'proc' 'top10_ram' {
  (Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 |
    ForEach-Object { "$($_.Name)=$([math]::Round($_.WorkingSet64 / 1MB))MB" }) -join ' | '
} 'somente nome e MB; nenhum dado pessoal'

# ---------- 8. Vulkan: loader, ICDs, dispositivos ----------
Add-Finding 'vulkan' 'loader_vulkan-1_x64' ($(if (Test-Path "$env:SystemRoot\System32\vulkan-1.dll") {
  $vi = (Get-Item "$env:SystemRoot\System32\vulkan-1.dll").VersionInfo; "presente $($vi.FileVersion)"
} else { 'AUSENTE' })) 'loader presente != dispositivo enumerado'
Add-Finding 'vulkan' 'loader_vulkan-1_x86' ($(if (Test-Path "$env:SystemRoot\SysWOW64\vulkan-1.dll") { 'presente' } else { 'AUSENTE' })) ''
Try-Get 'vulkan' 'icd_registry_hklm' {
  $k = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Khronos\Vulkan\Drivers' -ErrorAction SilentlyContinue
  if (-not $k) { 'nenhuma chave de ICD em HKLM' } else { ($k.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { $_.Name }) -join ' | ' }
} 'leitura de registro apenas; lista DLLs de ICD registradas (ex.: driver AMD)'
Try-Get 'vulkan' 'icd_registry_wow64' {
  $k = Get-ItemProperty -Path 'HKLM:\SOFTWARE\WOW6432Node\Khronos\Vulkan\Drivers' -ErrorAction SilentlyContinue
  if (-not $k) { 'nenhuma chave WOW6432Node' } else { ($k.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object { $_.Name }) -join ' | ' }
} ''
if (Get-Command vulkaninfo -ErrorAction SilentlyContinue) {
  Try-Get 'vulkan' 'vulkaninfo_summary' {
    $raw = vulkaninfo --summary 2>&1 | Out-String
    ($raw -split "`n" | Where-Object { $_ -match 'apiVersion|driverVersion|deviceName|vendorID|deviceID|GPU id' } | ForEach-Object { $_.Trim() }) -join ' | '
  } 'executa SOMENTE vulkaninfo (leitura); nao cria contexto de aplicacao'
} else {
  Add-Finding 'vulkan' 'vulkaninfo_summary' 'UNKNOWN' 'vulkaninfo nao instalado; NAO instalar nada - registrar como UNKNOWN'
}
Add-Finding 'vulkan' 'context_init' 'NAO TESTADO' 'inicializar contexto exige binario Vulkan; fora do escopo deste script (probe separado, autorizado a parte)'
Add-Finding 'vulkan' 'kernels_funcionais' 'NAO TESTADO' 'idem'
Add-Finding 'vulkan' 'modelo_no_backend' 'NAO TESTADO' 'idem; a pergunta gfx803/res-512 so se responde com probe autorizado'

# ---------- 9. Montagem do relatorio ----------
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("T11 Windows/RX580 pre-flight - somente leitura")
$lines.Add("script=t11-windows-hardware-vulkan-preflight.ps1 version=$ScriptVersion")
$lines.Add("gerado_utc=" + (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))
$lines.Add('')
foreach ($f in $findings) {
  $note = if ($f.Note) { "   # " + $f.Note } else { '' }
  $lines.Add(("[{0}] {1} = {2}{3}" -f $f.Group, $f.Item, $f.Value, $note))
}
$lines.Add('')
$lines.Add('Interpretacao: loader presente != dispositivo enumerado != contexto inicializado != kernels funcionais != modelo no backend.')
$lines.Add('Nenhuma linha UNKNOWN deve ser lida como falha da maquina; leia como ausencia de medicao.')
$body = ($lines -join "`r`n")
$sha = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body))).Replace('-', '').ToLowerInvariant()
$report = $body + "`r`nReportSHA256=$sha"

if ($NoReport) { Write-Output $report }
else {
  if (-not $OutFile) { $OutFile = Join-Path (Get-Location) ("t11-preflight-report-" + (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss') + "Z.txt") }
  Set-Content -LiteralPath $OutFile -Value $report -Encoding UTF8
  Write-Output ("relatorio gravado em: " + $OutFile)
  Write-Output ("ReportSHA256=" + $sha)
}
