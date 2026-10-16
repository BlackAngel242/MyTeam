$ErrorActionPreference = 'Stop'
$bureauRoot = $PSScriptRoot
$bureauUrl = 'http://127.0.0.1:4317'
$bureauRunning = $false
try {
    $bureauResponse = Invoke-WebRequest -Uri "$bureauUrl/api/state" -TimeoutSec 2
    $bureauData = $bureauResponse.Content | ConvertFrom-Json
    $bureauRunning = ($null -ne $bureauData.token -and $null -ne $bureauData.agents)
} catch {}
if (-not $bureauRunning) {
    $bureauNode = (Get-Command node -ErrorAction Stop).Source
    Start-Process -FilePath $bureauNode -ArgumentList 'server.mjs' -WorkingDirectory $bureauRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $bureauRoot 'bureau.log') -RedirectStandardError (Join-Path $bureauRoot 'bureau-erreurs.log')
    for ($bureauAttempt = 0; $bureauAttempt -lt 20; $bureauAttempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $bureauResponse = Invoke-WebRequest -Uri "$bureauUrl/api/state" -TimeoutSec 2
            $bureauData = $bureauResponse.Content | ConvertFrom-Json
            if ($null -ne $bureauData.token -and $null -ne $bureauData.agents) { $bureauRunning = $true; break }
        } catch {}
    }
}
if (-not $bureauRunning) { throw 'Le bureau ne démarre pas. Consultez bureau-erreurs.log dans le dossier du projet.' }
Start-Process $bureauUrl
