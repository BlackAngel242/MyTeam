param([switch]$AvecHerdr)
$ErrorActionPreference = 'Stop'
$bureauRoot = $PSScriptRoot
$bureauPort = [Environment]::GetEnvironmentVariable('BUREAU_PORT', 'User')
if (-not $bureauPort) { $bureauPort = $env:BUREAU_PORT }
if (-not $bureauPort) { $bureauPort = '4317' }
if ($bureauPort -notmatch '^\d{4,5}$' -or [int]$bureauPort -lt 1024 -or [int]$bureauPort -gt 65535) { throw 'Port invalide.' }
$env:BUREAU_PORT = $bureauPort
if ($AvecHerdr) {
    $herdr = [Environment]::GetEnvironmentVariable('BUREAU_HERDR_PATH', 'User')
    if (-not $herdr) { $herdr = $env:BUREAU_HERDR_PATH }
    if (-not $herdr) { $herdr = (@(Get-Command herdr -CommandType Application -ErrorAction SilentlyContinue)[0]).Source }
    if (-not $herdr -or [IO.Path]::GetExtension($herdr) -ne '.exe' -or -not (Test-Path -LiteralPath $herdr -PathType Leaf)) { throw 'Executable Herdr introuvable.' }
    Start-Process -FilePath $herdr -WorkingDirectory $bureauRoot -WindowStyle Normal
}
$bureauNode = (@(Get-Command node -CommandType Application -ErrorAction Stop)[0]).Source
& $bureauNode (Join-Path $bureauRoot 'scripts/ouvrir-bureau.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Le bureau ne demarre pas.' }
