# Audit du paquet : liste npm (files du package.json), ZIP de release construit
# par scripts/empaqueter-release.mjs, effet de .gitattributes, confidentialite.
param(
  [Parameter(Mandatory = $true)][string]$Checkout,
  [Parameter(Mandatory = $true)][string]$OutDir
)
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$ResultsFile = Join-Path $OutDir 'results-paquet.txt'
$script:FailCount = 0
function Resultat([string]$id, [bool]$ok, [string]$detail) {
  $etat = if ($ok) { 'PASS' } else { 'FAIL' }
  if (-not $ok) { $script:FailCount++ }
  Add-Content -LiteralPath $ResultsFile -Value "RESULT|$id|$etat|$detail" -Encoding UTF8
  Write-Host "RESULT|$id|$etat|$detail"
}
function Info([string]$id, [string]$detail) {
  Add-Content -LiteralPath $ResultsFile -Value "RESULT|$id|INFO|$detail" -Encoding UTF8
  Write-Host "RESULT|$id|INFO|$detail"
}

# ---------- Paquet npm : npm pack --dry-run --json ----------
$packLog = Join-Path $OutDir 'pack-npm.json'
Push-Location $Checkout
try { $packJson = npm pack --dry-run --json 2>$null | Out-String } finally { Pop-Location }
Set-Content -LiteralPath $packLog -Value $packJson -Encoding UTF8
try {
  $pack = ($packJson | ConvertFrom-Json)[0]
  $noms = @($pack.files | ForEach-Object { $_.path })
  Info 'PACK-NPM' "Fichiers distribues par npm pack : $($noms.Count)"
  foreach ($requis in @('server.mjs', 'src/update.mjs', 'scripts/installer.ps1', 'scripts/installer-npm.mjs', 'kit/')) {
    Resultat 'PACK-NPM' ([bool]($noms | Where-Object { $_ -like "$requis*" })) "Presence dans le paquet npm : $requis"
  }
  $interdits = @($noms | Where-Object { $_ -match '(^|/)(\.myteam-local|\.bureau|\.env)' -or $_ -match '^test/' -or $_ -match '(^|/)(JOURNAL|HANDOFF|LESSONS|TODO)\.md$' })
  Resultat 'PACK-NPM' ($interdits.Count -eq 0) "Aucun fichier prive ou de developpement dans le paquet npm (test/, .bureau, .myteam-local, journaux) : $($interdits.Count) trouve(s)"
} catch {
  Resultat 'PACK-NPM' $false "npm pack --dry-run --json illisible : $($_.Exception.Message)"
}

# ---------- ZIP de release : scripts/empaqueter-release.mjs ----------
$zip = Join-Path $Checkout 'dist\MyTeam-0.5.1.zip'
$zipShaFile = "$zip.sha256"
Resultat 'PACK-ZIP' (Test-Path $zip) "ZIP de release construit par empaqueter-release.mjs au commit teste"
if (Test-Path $zip) {
  $shaReel = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
  $shaAnnonce = ((Get-Content -LiteralPath $zipShaFile -Raw) -split '\s+')[0].ToLowerInvariant()
  Resultat 'PACK-ZIP' ($shaReel -eq $shaAnnonce) "Empreinte SHA-256 du fichier .sha256 conforme a celle du ZIP"
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($zip)
  $entrees = @($archive.Entries | ForEach-Object { $_.FullName })
  $archive.Dispose()
  Info 'PACK-ZIP' "Entrees du ZIP : $($entrees.Count)"
  foreach ($requis in @('server.mjs', 'package.json', 'src/update.mjs', 'src/update-helper.mjs', 'scripts/installer.ps1', 'Ouvrir le bureau.cmd', 'Installer MyTeam.bat')) {
    Resultat 'PACK-ZIP' ([bool]($entrees | Where-Object { $_ -like "*/$requis" })) "Presence dans le ZIP : $requis"
  }
  $prives = @($entrees | Where-Object { $_ -match '\.myteam-local|\.bureau|(^|/)\.env' })
  Resultat 'PACK-ZIP' ($prives.Count -eq 0) "Aucun etat prive dans le ZIP (.myteam-local, .bureau, .env) : $($prives.Count)"
  $exportIgnore = @($entrees | Where-Object { $_ -match '/(JOURNAL|HANDOFF|ERREURS|AGENTS|CLAUDE|DESIGN|LESSONS|PRODUCT|TODO)\.md$' -or $_ -match '/CHANGELOG' })
  Resultat 'PACK-ZIP' ($exportIgnore.Count -eq 0) "Effet de .gitattributes (export-ignore) : notes internes absentes du ZIP : $($exportIgnore.Count) presente(s)"
  $docsPresents = @($entrees | Where-Object { $_ -match '/docs/' })
  $docsAttendus = @($docsPresents | Where-Object { $_ -match 'INSTALLATION|aide|kit\.md|installeur-protocole' })
  Info 'PACK-ZIP' "docs/ dans le ZIP : $($docsPresents.Count) entree(s), dont attendues (installation, aide, kit, protocole) : $($docsAttendus.Count)"
  $tests = @($entrees | Where-Object { $_ -match '/test/' })
  Info 'PACK-ZIP' "Fichiers de test dans le ZIP de release : $($tests.Count) entree(s) sous test/ (constat factuel)"
  $racines = @($entrees | ForEach-Object { ($_ -split '/')[0] } | Select-Object -Unique)
  Resultat 'PACK-ZIP' ($racines.Count -eq 1 -and $racines[0] -eq 'MyTeam-0.5.1') "Toutes les entrees sous le prefixe unique MyTeam-0.5.1/"

  # ---------- Confidentialite : scan des contenus texte du ZIP ----------
  $extract = Join-Path $env:RUNNER_TEMP 'qa-zip-extract'
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  [IO.Compression.ZipFile]::ExtractToDirectory($zip, $extract)
  $motifs = @{
    'jeton GitHub (ghp_)' = 'ghp_[A-Za-z0-9]{20,}'
    'jeton GitHub fin (github_pat_)' = 'github_pat_[A-Za-z0-9_]{20,}'
    'cle type sk-' = 'sk-[A-Za-z0-9]{20,}'
    'cle privee PEM' = 'BEGIN [A-Z ]*PRIVATE KEY'
    'chemin de profil Windows' = '[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\'
    'chemin de profil Linux' = '/home/[A-Za-z0-9._-]+/'
  }
  foreach ($nom in $motifs.Keys) {
    $hits = @(Get-ChildItem $extract -Recurse -File | Where-Object { $_.Length -lt 2MB } | Select-String -Pattern $motifs[$nom] -List -ErrorAction SilentlyContinue)
    Resultat 'CONF' ($hits.Count -eq 0) "Motif '$nom' dans le contenu du ZIP : $($hits.Count) fichier(s) touche(s)"
  }
}
exit $(if ($script:FailCount -gt 0) { 1 } else { 0 })
