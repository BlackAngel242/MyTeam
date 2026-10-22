# Harnais QA PR #12 : scenarios d'installation Windows avec stubs controles.
# Execute scripts/installer.ps1 (Windows PowerShell 5.1) dans une copie temporaire,
# avec des faux executables qui journalisent leurs appels. Aucune installation reelle.
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$OutDir
)
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)

$Work = Join-Path $env:RUNNER_TEMP 'qa-pr12-harness'
if (Test-Path $Work) { Remove-Item $Work -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Work, $OutDir | Out-Null
$StubSrc = Join-Path $Work 'stubsrc'
$InstallCopy = Join-Path $Work 'install'
New-Item -ItemType Directory -Force -Path $StubSrc | Out-Null

$ResultsFile = Join-Path $OutDir 'results-installer.txt'
$script:FailCount = 0
function Resultat([string]$id, [bool]$ok, [string]$detail) {
  $etat = if ($ok) { 'PASS' } else { 'FAIL' }
  if (-not $ok) { $script:FailCount++ }
  $ligne = "RESULT|$id|$etat|$detail"
  Add-Content -LiteralPath $ResultsFile -Value $ligne -Encoding UTF8
  Write-Host $ligne
}
function Info([string]$id, [string]$detail) {
  Add-Content -LiteralPath $ResultsFile -Value "RESULT|$id|INFO|$detail" -Encoding UTF8
  Write-Host "RESULT|$id|INFO|$detail"
}

# ---------- Copie pristine de l'installation (sans .git ni dist) ----------
& robocopy $Source $InstallCopy /E /XD .git dist /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy a echoue ($LASTEXITCODE)" }
$Installer = Join-Path $InstallCopy 'scripts\installer.ps1'
if (-not (Test-Path $Installer)) { throw "installer.ps1 introuvable dans la copie" }

# ---------- Stubs ----------
$stubCs = @'
using System;
using System.IO;
class HerdrStub {
  static int Main(string[] args) {
    string log = Environment.GetEnvironmentVariable("QA_STUB_LOG");
    if (!string.IsNullOrEmpty(log)) { try { File.AppendAllText(log, "herdr " + string.Join(" ", args) + "\n"); } catch {} }
    string mode = Environment.GetEnvironmentVariable("HERDR_STUB_MODE");
    if (mode == "fail") { Console.Error.WriteLine("herdr stub: echec simule"); return 3; }
    if (args.Length == 0) return 0;
    string stateFile = Environment.GetEnvironmentVariable("HERDR_STUB_STATE");
    Func<int> splits = () => { try { return int.Parse(File.ReadAllText(stateFile).Trim()); } catch { return 0; } };
    if (args[0] == "--version") { Console.WriteLine("herdr 0.9.5 (stub)"); return 0; }
    if (args[0] == "--skill") { Console.WriteLine("# Competence Herdr (stub)"); return 0; }
    if (args[0] == "workspace" && args.Length > 1 && args[1] == "create") {
      if (mode == "gridfail") { Console.Error.WriteLine("herdr stub: creation refusee"); return 3; }
      Console.WriteLine("{\"result\":{\"workspace_id\":\"w9\"}}"); return 0;
    }
    if (args[0] == "pane" && args.Length > 1 && args[1] == "list") {
      int n = splits() + 1; string panes = "";
      for (int i = 1; i <= n; i++) { if (i > 1) panes += ","; panes += "{\"pane_id\":\"w9:p" + i + "\"}"; }
      Console.WriteLine("{\"result\":{\"panes\":[" + panes + "]}}"); return 0;
    }
    if (args[0] == "pane" && args.Length > 1 && args[1] == "split") {
      try { File.WriteAllText(stateFile, (splits() + 1).ToString()); } catch {}
      Console.WriteLine("{\"result\":{}}"); return 0;
    }
    if (args[0] == "integration") { Console.WriteLine("integration installee (stub)"); return 0; }
    Console.WriteLine("{\"result\":{}}"); return 0;
  }
}
'@
$csPath = Join-Path $StubSrc 'herdr-stub.cs'
Set-Content -LiteralPath $csPath -Value $stubCs -Encoding UTF8
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$HerdrExeMaster = Join-Path $StubSrc 'herdr.exe'
& $csc /nologo /out:$HerdrExeMaster $csPath | Out-Null
if (-not (Test-Path $HerdrExeMaster)) { throw 'Compilation du stub herdr impossible' }
Info 'STUB' 'Stub herdr.exe compile avec csc.exe (Framework 4.0)'

function Ecrire-Stub([string]$nom, [string]$contenu) {
  Set-Content -LiteralPath (Join-Path $StubSrc $nom) -Value $contenu -Encoding ASCII
}
Ecrire-Stub 'node22.cmd' "@echo off`r`necho node %* >> `"%QA_STUB_LOG%`"`r`nif /I `"%~1`"==`"--version`" echo v22.14.0`r`nexit /b 0`r`n"
Ecrire-Stub 'clink.cmd' "@echo off`r`necho clink %* >> `"%QA_STUB_LOG%`"`r`nexit /b 0`r`n"
Ecrire-Stub 'npm.cmd' "@echo off`r`necho npm %* >> `"%QA_STUB_LOG%`"`r`nif defined NPM_STUB_EXIT (exit /b %NPM_STUB_EXIT%)`r`nexit /b 0`r`n"
Ecrire-Stub 'winget.cmd' @'
@echo off
echo winget %* >> "%QA_STUB_LOG%"
if /I "%~3"=="OpenJS.NodeJS.LTS" goto :node
if /I "%~3"=="chrisant996.Clink" goto :clink
exit /b 0
:node
if /I "%WINGET_NODE%"=="fail" exit /b 1
copy /y "%QA_STUB_SRC%\node22.cmd" "%QA_STUBDIR%\node.cmd" >nul
exit /b 0
:clink
if /I "%WINGET_CLINK%"=="fail" exit /b 1
copy /y "%QA_STUB_SRC%\clink.cmd" "%QA_CLINK_DIR%\clink.cmd" >nul
exit /b 0
'@
Ecrire-Stub 'powershell.cmd' @'
@echo off
echo powershell %* >> "%QA_STUB_LOG%"
if /I "%PSSTUB_MODE%"=="fail" exit /b 1
mkdir "%USERPROFILE%\.herdr\packages\stub" 2>nul
copy /y "%QA_HERDR_EXE%" "%USERPROFILE%\.herdr\packages\stub\herdr.exe" >nul
exit /b 0
'@
foreach ($t in @('claude','codex','opencode','pi','gemini','agy','antigravity-cli','code')) {
  Ecrire-Stub "$t.cmd" "@echo off`r`necho $t %* >> `"%QA_STUB_LOG%`"`r`nexit /b 0`r`n"
}

$Ps51 = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$SysDirs = @(
  (Join-Path $env:WINDIR 'System32'),
  $env:WINDIR,
  (Join-Path $env:WINDIR 'System32\Wbem'),
  (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0')
) | Select-Object -Unique
$RealNodeDir = Split-Path -Parent (Get-Command node -CommandType Application).Source

$OriginalUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
function Restaurer-Registre {
  [Environment]::SetEnvironmentVariable('BUREAU_HERDR_PATH', $null, 'User')
  [Environment]::SetEnvironmentVariable('BUREAU_PORT', $null, 'User')
  [Environment]::SetEnvironmentVariable('Path', $OriginalUserPath, 'User')
}

# ---------- Moteur de scenario ----------
function Invoke-Scenario {
  param([hashtable]$Cfg)
  $id = $Cfg.Id
  $dir = Join-Path $Work "scen-$id"
  $stubDir = Join-Path $dir 'bin'
  $stubDir2 = Join-Path $dir 'bin2'
  $profile = Join-Path $dir 'profile'
  $tmp = Join-Path $dir 'tmp'
  New-Item -ItemType Directory -Force -Path $stubDir, $stubDir2, $profile, $tmp | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $profile 'AppData\Roaming'), (Join-Path $profile 'AppData\Local'), (Join-Path $profile 'Desktop') | Out-Null
  $callsLog = Join-Path $dir 'calls.log'
  $stateFile = Join-Path $dir 'herdr-state.txt'
  New-Item -ItemType File -Force -Path $callsLog | Out-Null
  # Stubs demandes par le scenario
  foreach ($s in @($Cfg.Stubs)) {
    switch ($s) {
      'herdr' { Copy-Item $HerdrExeMaster (Join-Path $stubDir 'herdr.exe') }
      'herdr2' { Copy-Item $HerdrExeMaster (Join-Path $stubDir2 'herdr.exe') }
      'clink' { Copy-Item (Join-Path $StubSrc 'clink.cmd') (Join-Path $stubDir 'clink.cmd') }
      'clink2' { Copy-Item (Join-Path $StubSrc 'clink.cmd') (Join-Path $stubDir2 'clink.cmd') }
      'winget' { Copy-Item (Join-Path $StubSrc 'winget.cmd') (Join-Path $stubDir 'winget.cmd') }
      'powershellstub' { Copy-Item (Join-Path $StubSrc 'powershell.cmd') (Join-Path $stubDir 'powershell.cmd') }
      'npmstub' { Copy-Item (Join-Path $StubSrc 'npm.cmd') (Join-Path $stubDir 'npm.cmd') }
      default { Copy-Item (Join-Path $StubSrc "$s.cmd") (Join-Path $stubDir "$s.cmd") }
    }
  }
  if ($Cfg.HerdrPackages) {
    $pkg = Join-Path $profile '.herdr\packages\pre'
    New-Item -ItemType Directory -Force -Path $pkg | Out-Null
    Copy-Item $HerdrExeMaster (Join-Path $pkg 'herdr.exe')
  }
  # Registre utilisateur : PATH (pour Rafraichir-Path), variables nettoyees
  Restaurer-Registre
  $userDirs = @($stubDir) + @($Cfg.RefreshDirs | ForEach-Object { if ($_ -eq 'BIN2') { $stubDir2 } else { $_ } })
  [Environment]::SetEnvironmentVariable('Path', ($userDirs -join ';'), 'User')

  $envOverride = @{
    'Path' = (@($stubDir) + @($(if (-not $Cfg.NoBin2InPath) { $stubDir2 })) + @($Cfg.ExtraPath) + $SysDirs) -join ';'
    'USERPROFILE' = $profile
    'APPDATA' = (Join-Path $profile 'AppData\Roaming')
    'LOCALAPPDATA' = (Join-Path $profile 'AppData\Local')
    'TEMP' = $tmp; 'TMP' = $tmp
    'QA_STUB_LOG' = $callsLog
    'QA_STUBDIR' = $stubDir
    'QA_STUB_SRC' = $StubSrc
    'QA_HERDR_EXE' = $HerdrExeMaster
    'QA_CLINK_DIR' = $(if ($Cfg.ClinkDir2) { $stubDir2 } else { $stubDir })
    'HERDR_STUB_LOG' = $callsLog
    'HERDR_STUB_STATE' = $stateFile
    'HERDR_STUB_MODE' = [string]$Cfg.HerdrMode
    'WINGET_NODE' = [string]$Cfg.WingetNode
    'WINGET_CLINK' = [string]$Cfg.WingetClink
    'PSSTUB_MODE' = [string]$Cfg.PsMode
    'NPM_STUB_EXIT' = [string]$Cfg.NpmExit
  }
  $saved = @{}
  foreach ($k in $envOverride.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process'); [Environment]::SetEnvironmentVariable($k, $envOverride[$k], 'Process') }
  [Environment]::SetEnvironmentVariable('BUREAU_HERDR_PATH', $null, 'Process')
  [Environment]::SetEnvironmentVariable('BUREAU_PORT', $null, 'Process')

  $answersFile = Join-Path $dir 'answers.txt'
  [IO.File]::WriteAllLines($answersFile, [string[]]@($Cfg.Answers))
  $outFile = Join-Path $OutDir "installer-$id.out.log"
  $errFile = Join-Path $OutDir "installer-$id.err.log"
  $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$Installer`" -Lang fr " + [string]$Cfg.Args
  $timeout = if ($Cfg.Timeout) { [int]$Cfg.Timeout } else { 180 }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $proc = Start-Process -FilePath $Ps51 -ArgumentList $argList -WorkingDirectory $InstallCopy -RedirectStandardInput $answersFile -RedirectStandardOutput $outFile -RedirectStandardError $errFile -PassThru -NoNewWindow
  $timedOut = -not $proc.WaitForExit($timeout * 1000)
  if ($timedOut) { try { $proc.Kill() } catch {}; $proc.WaitForExit() }
  $sw.Stop()
  $exitCode = if ($timedOut) { $null } else { $proc.ExitCode }

  foreach ($k in $envOverride.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') }
  $regHerdr = [Environment]::GetEnvironmentVariable('BUREAU_HERDR_PATH', 'User')
  $regPort = [Environment]::GetEnvironmentVariable('BUREAU_PORT', 'User')
  Restaurer-Registre

  $output = ''
  if (Test-Path $outFile) { $output = Get-Content -LiteralPath $outFile -Raw }
  if (Test-Path $errFile) { $err = Get-Content -LiteralPath $errFile -Raw; if ($err) { $output += "`n[stderr]`n$err" } }
  $calls = Get-Content -LiteralPath $callsLog -Raw
  [pscustomobject]@{
    Id = $id; ExitCode = $exitCode; TimedOut = $timedOut; Seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    Output = [string]$output; Calls = [string]$calls; Dir = $dir; Profile = $profile
    RegHerdr = $regHerdr; RegPort = $regPort; StubDir = $stubDir; StubDir2 = $stubDir2
  }
}
function Contient($r, [string]$motif) { return $r.Output -match [regex]::Escape($motif) }
function NbOccurrences($texte, [string]$motif) { return ([regex]::Matches([string]$texte, [regex]::Escape($motif))).Count }

$ReponsesStd = @('n', '0', 'n', 'o', 'n', 'n', 'n', 'n', 'n', 'n')

# ================= S1 : ZERO IA (aucun outil, reponse 0) =================
$r = Invoke-Scenario @{ Id = 'S1-zero-ia'; Stubs = @('herdr', 'clink', 'winget'); ExtraPath = @($RealNodeDir); Answers = $ReponsesStd; Timeout = 90 }
Resultat 'S1' (-not $r.TimedOut) "Aucune boucle : termine=$(-not $r.TimedOut) en $($r.Seconds) s, code=$($r.ExitCode)"
Resultat 'S1' ($r.ExitCode -eq 0) "Code de sortie 0 malgre zero IA (outils facultatifs) : code=$($r.ExitCode)"
Resultat 'S1' ((NbOccurrences $r.Output 'Numéros à installer') -eq 1) "Selection demandee exactement 1 fois : $((NbOccurrences $r.Output 'Numéros à installer'))"
Resultat 'S1' (Contient $r 'Aucune IA choisie') "Message 'Aucune IA choisie' affiche"
Resultat 'S1' (Contient $r '=== Resume ===') "L'installation continue jusqu'au resume"
Resultat 'S1' (Contient $r 'Node.js est deja present') "Node reel 22 detecte comme prerequis present"
Resultat 'S1' (Contient $r 'Herdr est present') "Herdr (stub) detecte dans le PATH"
Resultat 'S1' (Contient $r '1. Claude Code') "Liste des absents en noms lisibles (Claude Code en tete)"
Resultat 'S1' (-not (Contient $r 'Claude Code|claude')) "Aucune valeur brute 'Nom|commande' dans l'affichage"

# ================= S2 : MODE -Oui (aucun refus, aucune IA telechargee) =================
$r = Invoke-Scenario @{ Id = 'S2-oui'; Stubs = @('herdr', 'clink', 'npmstub'); ExtraPath = @(); HerdrMode = 'gridfail'; Answers = @('n', 'n', 'n', 'n', 'n', 'n'); Args = '-Oui -SansRaccourci'; Timeout = 300 }
Resultat 'S2' ($r.ExitCode -eq 0) "Mode -Oui : code de sortie $($r.ExitCode)"
Resultat 'S2' ((NbOccurrences $r.Output 'refus') -eq 0) "Aucune mention 'refus' sans refus reel en mode -Oui : $((NbOccurrences $r.Output 'refus')) occurrence(s)"
Resultat 'S2' (-not ($r.Calls -match 'install -g')) "Aucun telechargement d'outil IA en mode -Oui"
Resultat 'S2' ((NbOccurrences $r.Output 'Numéros à installer') -eq 0) "Aucune invite de selection IA en mode -Oui"
Resultat 'S2' (Contient $r 'Aucune IA choisie') "Message de configuration restante affiche en mode -Oui"
Resultat 'S2' (Contient $r 'procedure manuelle') "Echec de creation d'espace Herdr visible (repli procedure manuelle), pas masque"

# ================= S3 : NODE ABSENT, WINGET INSTALLE =================
$r = Invoke-Scenario @{ Id = 'S3-node-winget'; Stubs = @('herdr', 'clink', 'winget'); ExtraPath = @(); Answers = $ReponsesStd; Timeout = 180 }
Resultat 'S3' (Contient $r 'Node.js est absent') "Node absent detecte"
Resultat 'S3' ($r.Calls -match 'winget install --id OpenJS\.NodeJS\.LTS') "winget appele pour Node.js LTS"
Resultat 'S3' (Contient $r 'maintenant installe (version majeure 22)') "Node reverifie a 22 apres installation et actualisation du PATH"
Resultat 'S3' ($r.ExitCode -eq 0) "Code de sortie 0 : code=$($r.ExitCode)"

# ================= S4 : NODE ABSENT, WINGET EN ECHEC =================
$r = Invoke-Scenario @{ Id = 'S4-node-echec'; Stubs = @('herdr', 'clink', 'winget'); ExtraPath = @(); WingetNode = 'fail'; Answers = $ReponsesStd; Timeout = 180 }
Resultat 'S4' (Contient $r 'de Node.js a echoue') "Echec d'installation de Node visible dans la sortie"
Resultat 'S4' ($r.ExitCode -eq 1) "Code de sortie non nul si Node reste indisponible : code=$($r.ExitCode)"
Resultat 'S4' (Contient $r 'Installation incomplète') "Resume declare l'installation incomplete"
Resultat 'S4' (Contient $r 'Herdr est present') "Herdr traite independamment de l'echec Node (detecte present)"

# ================= S4b : HERDR INSTALLE MALGRE NODE EN ECHEC =================
$r = Invoke-Scenario @{ Id = 'S4b-herdr-sans-node'; Stubs = @('clink', 'winget', 'powershellstub'); ExtraPath = @(); WingetNode = 'fail'; Answers = $ReponsesStd; Timeout = 180 }
$attendu = Join-Path $r.Profile '.herdr\packages\stub\herdr.exe'
Resultat 'S4b' (Contient $r 'Herdr est maintenant installe') "Installation de Herdr tentee et reussie malgre l'echec de Node"
Resultat 'S4b' ($r.RegHerdr -eq $attendu) "BUREAU_HERDR_PATH enregistre apres installation automatique hors PATH"
Resultat 'S4b' ($r.ExitCode -eq 1) "Code de sortie 1 du seul fait de Node : code=$($r.ExitCode)"
Resultat 'S4b' (-not (Contient $r 'Herdr : non installé')) "Resume sans mention Herdr 'non installe' erronee"

# ================= S5 : HERDR ABSENT, INSTALLATION EN ECHEC =================
$r = Invoke-Scenario @{ Id = 'S5-herdr-echec'; Stubs = @('clink', 'powershellstub'); ExtraPath = @($RealNodeDir); PsMode = 'fail'; Answers = $ReponsesStd; Timeout = 180 }
Resultat 'S5' (Contient $r 'de Herdr a echoue') "Echec d'installation de Herdr visible"
Resultat 'S5' (Contient $r 'Herdr : installation echouee.') "Echec Herdr present dans le resume final"
Resultat 'S5' ($r.ExitCode -eq 1) "Code de sortie non nul si Herdr reste indisponible : code=$($r.ExitCode)"

# ================= S7 : GRILLE HERDR + AGENT START chef =================
$r = Invoke-Scenario @{ Id = 'S7-grille-agent'; Stubs = @('herdr', 'clink', 'claude'); ExtraPath = @($RealNodeDir); Answers = @('o', '1', 'o', '0', '0', '0', 'n', 'n', 'n', '0', 'n', 'o', 'n', 'n', 'n', 'n'); Timeout = 240 }
Resultat 'S7' (Contient $r 'Panneaux crees et nommes') "Grille Herdr creee (4 panneaux)"
Resultat 'S7' ($r.Calls -match 'herdr agent start chef --kind claude --pane w9:p1') "Commande recue par le stub : agent start chef --kind claude --pane w9:p1 (nom technique en minuscules)"
Resultat 'S7' (-not ($r.Calls -match 'agent start Chef')) "Aucune commande 'agent start Chef' avec majuscule"
$renames = @($r.Calls -split "`n" | Where-Object { $_ -match 'pane rename' })
Info 'S7' "Renommages de panneaux recus par le stub (noms d'affichage) : $($renames -join ' ; ')"
Resultat 'S7' ($r.ExitCode -eq 0) "Code de sortie 0 : code=$($r.ExitCode)"

# ================= S8 : HERDR HORS PATH DEJA PRESENT =================
$r = Invoke-Scenario @{ Id = 'S8-herdr-hors-path'; Stubs = @('clink'); ExtraPath = @($RealNodeDir); HerdrPackages = $true; Answers = $ReponsesStd; Timeout = 180 }
$attendu = Join-Path $r.Profile '.herdr\packages\pre\herdr.exe'
Resultat 'S8' (Contient $r 'Herdr est present') "Herdr trouve hors PATH dans .herdr\packages"
Resultat 'S8' (Contient $r 'pas dans le PATH') "Signalement explicite de l'absence du PATH"
Resultat 'S8' ($r.RegHerdr -eq $attendu) "BUREAU_HERDR_PATH enregistre pour un Herdr deja present hors PATH"
Resultat 'S8' ($r.ExitCode -eq 0) "Code de sortie 0 : code=$($r.ExitCode)"

# ================= S10 : RACCOURCI CONJOINT HERDR + BUREAU =================
$bureauReel = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $bureauReel 'Ouvrir le bureau.lnk'
if (Test-Path $lnk) { Remove-Item $lnk -Force }
$r = Invoke-Scenario @{ Id = 'S10-raccourci'; Stubs = @('herdr', 'clink'); ExtraPath = @($RealNodeDir); Answers = @('n', '0', 'n', 'o', '3', 'o', 'n', 'n', 'n', 'n'); Timeout = 180 }
$lnkOk = Test-Path $lnk
$cibleOk = $false; $argsOk = $false
if ($lnkOk) {
  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut($lnk)
  $cibleOk = $sc.TargetPath -match 'powershell\.exe$'
  $argsOk = ($sc.Arguments -match 'AvecHerdr') -and ($sc.Arguments -match 'Ouvrir le bureau\.ps1')
  Remove-Item $lnk -Force
}
Resultat 'S10' $lnkOk "Raccourci 'Ouvrir le bureau.lnk' cree sur le Bureau du runner (ephemere)"
Resultat 'S10' $cibleOk "Cible du raccourci conjoint : powershell.exe"
Resultat 'S10' $argsOk "Arguments du raccourci : lanceur 'Ouvrir le bureau.ps1' avec -AvecHerdr (lancement conjoint MyTeam + Herdr)"

# ================= S11 : ECHEC NPM SUR UN OUTIL IA =================
$r = Invoke-Scenario @{ Id = 'S11-npm-echec'; Stubs = @('herdr', 'clink', 'npmstub'); ExtraPath = @($RealNodeDir); NpmExit = '1'; Answers = @('n', '3', 'o', 'n', 'o', 'n', 'n', 'n', 'n'); Timeout = 180 }
Resultat 'S11' ($r.Calls -match 'npm install -g opencode-ai') "Commande npm d'installation d'OpenCode reellement emise"
Resultat 'S11' (Contient $r 'OpenCode échouée') "Echec de la commande native affiche comme echec (LASTEXITCODE respecte)"
Resultat 'S11' (-not (Contient $r 'OpenCode : installé.')) "Aucune annonce de reussite pour la commande en echec"
Resultat 'S11' ($r.ExitCode -eq 0) "L'echec d'un outil IA facultatif ne fait pas echouer l'installation : code=$($r.ExitCode)"

# ================= CLINK C1 : DEJA PRESENT =================
$r = Invoke-Scenario @{ Id = 'C1-clink-present'; Stubs = @('herdr', 'clink', 'winget'); ExtraPath = @($RealNodeDir); Answers = $ReponsesStd; Timeout = 120 }
Resultat 'C1' (Contient $r 'Clink est déjà présent.') "Message observe : Clink deja present"
Resultat 'C1' (-not ($r.Calls -match 'Clink')) "Aucun appel winget pour Clink deja present"
Info 'C1' "Etat final declare : message console 'Clink est déjà présent.', aucune ligne Clink au resume ; code=$($r.ExitCode)"

# ================= CLINK C2 : WINGET ABSENT =================
$r = Invoke-Scenario @{ Id = 'C2-clink-winget-absent'; Stubs = @('herdr'); ExtraPath = @($RealNodeDir); Answers = $ReponsesStd; Timeout = 120 }
Resultat 'C2' (Contient $r 'Clink ignoré : winget est absent.') "Message observe : Clink ignore car winget absent (visible, pas d'echec silencieux)"
Resultat 'C2' ($r.ExitCode -eq 0) "Code de sortie 0 (Clink facultatif) : code=$($r.ExitCode)"
Info 'C2' "Etat final declare : 'Clink ignoré : winget est absent.' ; code=$($r.ExitCode)"

# ================= CLINK C3 : INSTALLATION REUSSIE =================
$r = Invoke-Scenario @{ Id = 'C3-clink-install'; Stubs = @('herdr', 'winget'); ExtraPath = @($RealNodeDir); Answers = $ReponsesStd; Timeout = 120 }
Resultat 'C3' ($r.Calls -match 'winget install --id chrisant996\.Clink') "Commande emise : winget install --id chrisant996.Clink"
Resultat 'C3' (Contient $r 'Clink : installé.') "Etat final declare au resume : 'Clink : installé.' (reverifie apres actualisation du PATH)"
Info 'C3' "Code de sortie du scenario : $($r.ExitCode)"

# ================= CLINK C4 : WINGET RENVOIE UNE ERREUR =================
$r = Invoke-Scenario @{ Id = 'C4-clink-echec'; Stubs = @('herdr', 'winget'); ExtraPath = @($RealNodeDir); WingetClink = 'fail'; Answers = $ReponsesStd; Timeout = 120 }
Resultat 'C4' (Contient $r 'Clink a échoué') "Echec Clink visible dans la sortie console (mode console, sans -Interface)"
Resultat 'C4' (Contient $r 'Clink : installation échouée.') "Echec Clink present dans le resume final"
Resultat 'C4' (-not (Contient $r 'Clink : installé.')) "L'echec n'est pas annonce comme un succes"
Resultat 'C4' ($r.ExitCode -eq 0) "Code de sortie global 0 (Clink facultatif) : code=$($r.ExitCode)"
Info 'C4' "Etat final declare : 'Clink : installation échouée.' au resume"

# ================= CLINK C5 : VISIBLE APRES ACTUALISATION DU PATH =================
$r = Invoke-Scenario @{ Id = 'C5-clink-refresh'; Stubs = @('herdr', 'winget'); ExtraPath = @($RealNodeDir); ClinkDir2 = $true; NoBin2InPath = $true; RefreshDirs = @('BIN2'); Answers = $ReponsesStd; Timeout = 120 }
Resultat 'C5' ($r.Calls -match 'winget install --id chrisant996\.Clink') "Clink absent de la detection initiale (hors PATH processus), winget appele"
Resultat 'C5' (Contient $r 'Clink : installé.') "Apres Rafraichir-Path, Clink est detecte et declare 'installé' au resume"

# ================= DETECTION DES OUTILS (DryRun) =================
$detect = @(
  @{ Stub = 'claude'; Nom = 'Claude Code' },
  @{ Stub = 'codex'; Nom = 'Codex (OpenAI)' },
  @{ Stub = 'opencode'; Nom = 'OpenCode' },
  @{ Stub = 'pi'; Nom = 'Pi' },
  @{ Stub = 'gemini'; Nom = 'Gemini CLI' },
  @{ Stub = 'agy'; Nom = 'Antigravity' },
  @{ Stub = 'antigravity-cli'; Nom = 'Antigravity' }
)
foreach ($d in $detect) {
  $idD = "DET-$($d.Stub)"
  $r = Invoke-Scenario @{ Id = $idD; Stubs = @($d.Stub); ExtraPath = @($RealNodeDir); Answers = @(); Args = '-DryRun -SansRaccourci'; Timeout = 120 }
  Resultat $idD (Contient $r "$($d.Nom) : déjà présent.") "Detection de $($d.Stub) : '$($d.Nom) : déjà présent.'"
}
$r = Invoke-Scenario @{ Id = 'DET-tous'; Stubs = @('claude', 'codex', 'opencode', 'pi', 'gemini', 'antigravity-cli'); ExtraPath = @($RealNodeDir); Answers = @(); Args = '-DryRun -SansRaccourci'; Timeout = 120 }
Resultat 'DET-tous' (-not (Contient $r 'Outils absents proposés')) "Tous les outils presents : aucun outil repropose"
Resultat 'DET-tous' ((NbOccurrences $r.Output 'déjà présent.') -ge 6) "Les 6 outils du catalogue sont annonces presents en noms lisibles"

# ================= CONTROLE GLOBAL D'AFFICHAGE =================
$motifBrut = $false
foreach ($f in (Get-ChildItem (Join-Path $OutDir 'installer-*.out.log'))) {
  $txt = Get-Content -LiteralPath $f.FullName -Raw
  if ($txt -match '[A-Za-z]\|[a-z]') { $motifBrut = $true; Info 'AFFICHAGE' "Motif brut detecte dans $($f.Name) : $($Matches[0])" }
}
Resultat 'AFFICHAGE' (-not $motifBrut) "Aucune valeur technique brute du type 'Nom|commande' dans l'ensemble des sorties capturees"

Restaurer-Registre
Write-Host "Harnais termine : $script:FailCount echec(s) d'attente."
if ($script:FailCount -gt 0) { exit 1 }
exit 0
