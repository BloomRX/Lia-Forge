[CmdletBinding()]
param(
    [Parameter()]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')]
    [string]$CustomName
)

$ErrorActionPreference = 'Stop'
$LocalRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$RelativeFolders = @(
    'assets',
    'assets\mixamo-male',
    'assets\mixamo-male\source\actions',
    'assets\mixamo-female',
    'assets\mixamo-female\source\actions',
    'assets\unreal-manny',
    'assets\unreal-manny\source',
    'assets\unreal-quinn',
    'assets\unreal-quinn\source',
    'assets\custom',
    'output'
)
if ($CustomName) {
    $RelativeFolders += "assets\custom\$CustomName"
}

foreach ($RelativeFolder in $RelativeFolders) {
    $FolderPath = Join-Path $LocalRoot $RelativeFolder
    [void][System.IO.Directory]::CreateDirectory($FolderPath)
}

Write-Output "Pastas locais prontas em: $LocalRoot"
Write-Output 'Nenhum arquivo existente foi alterado, baixado ou removido.'
if ($CustomName) {
    Write-Output "Pasta custom criada/verificada: assets/custom/$CustomName"
}
