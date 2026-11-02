[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$')]
    [string]$Subject,
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$LocalRoot = $PSScriptRoot
$PrepareFolders = Join-Path $LocalRoot 'scripts\prepare-folders.ps1'
$Runner = Join-Path $LocalRoot 'scripts\run-render.cjs'
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (-not $NodeCommand) {
    throw 'Node.js não foi encontrado no PATH. O runner não instala dependências ou ferramentas.'
}
if (-not (Test-Path -LiteralPath $PrepareFolders -PathType Leaf)) {
    throw "Preparador de pastas não encontrado: $PrepareFolders"
}
if (-not (Test-Path -LiteralPath $Runner -PathType Leaf)) {
    throw "Runner Node não encontrado: $Runner"
}

if (@('mixamo-male', 'mixamo-female', 'unreal-manny', 'unreal-quinn') -contains $Subject) {
    & $PrepareFolders
} else {
    & $PrepareFolders -CustomName $Subject
}

$RunnerArguments = @($Runner, '--subject', $Subject)
if ($CheckOnly) { $RunnerArguments += '--check-only' }
$PreviousErrorActionPreference = $ErrorActionPreference
try {
    # The Node runner writes actionable diagnostics to stderr on blocked runs.
    $ErrorActionPreference = 'Continue'
    & $NodeCommand.Source @RunnerArguments
    $RunnerExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
}
if ($RunnerExitCode -ne 0) {
    throw "O runner terminou com código $RunnerExitCode. Leia as mensagens acima; outputs parciais, se houver, são preservados em local-renderer-test\output."
}
