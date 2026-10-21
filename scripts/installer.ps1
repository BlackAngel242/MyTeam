#Requires -Version 5.1
<#
.SYNOPSIS
  Installe les prerequis du Bureau des agents sur Windows.

.DESCRIPTION
  Verifie Node.js, Herdr et les outils d'IA en ligne de commande, propose chaque
  installation avec une confirmation (o/n), prepare un espace Herdr a 4 panneaux
  (le premier = chef), propose les extensions utiles du projet, configure le port
  et le chemin de Herdr, peut creer le raccourci « Ouvrir le bureau » (au choix :
  Herdr ou le bureau dans le navigateur), puis lance npm test et npm run check.
  Le script est relancable sans degat : il verifie avant d'agir.
  Aucune cle API ni aucun jeton n'est demande, lu ou enregistre.

.PARAMETER DryRun
  Affiche les actions sans rien executer (simulation).

.PARAMETER Oui
  Accepte sauf toute installation (Node.js, Herdr, outils, extensions), qui exigent un o/n individuel.

.PARAMETER Port
  Port du bureau (variable BUREAU_PORT). Sinon, question pendant l'installation.

.PARAMETER HerdrChemin
  Chemin complet de herdr.exe si Herdr n'est pas dans le PATH (BUREAU_HERDR_PATH).

.PARAMETER SansRaccourci
  Ne propose jamais la creation du raccourci « Ouvrir le bureau ».

.PARAMETER Aide
  Affiche cette aide.

.PARAMETER Interface
  Dialogue UTF-8 avec l'interface animée, par lignes @@ et réponses sur l'entrée standard.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\installer.ps1 -DryRun
#>
[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$Oui,
  [int]$Port = 0,
  [string]$HerdrChemin = '',
  [switch]$SansRaccourci,
  [switch]$Interface,
  [ValidateSet('fr','en')][string]$Lang = $(if ([Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'fr') { 'fr' } else { 'en' }),
  [switch]$Aide
)

$ErrorActionPreference = 'Stop'
function Texte([string]$fr, [string]$en) {
  if ($Lang -eq 'en') { return $en }
  return $fr
}
try {
  [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
  if ($Interface) { [Console]::InputEncoding = New-Object Text.UTF8Encoding($false) }
} catch {}

if ($Aide) {
  if ($Lang -eq 'en') {
    Write-Host 'Agent desktop installer: -DryRun (preview), -Oui (installs missing prerequisites but never selects AI tools or launches agents), -Port <1024..65535>, -HerdrChemin <exe>, -SansRaccourci, -Interface, -Lang fr|en, -Aide.'
    exit 0
  }
  Write-Host @'
Script d'installation du Bureau des agents (Windows).

Usage :
  powershell -ExecutionPolicy Bypass -File scripts\installer.ps1 [options]

Options :
  -DryRun          Simulation : affiche les actions sans rien executer.
  -Oui             Installe les prérequis manquants, sans choisir d’IA ni lancer d’agent.
  -Port <numero>   Port du bureau (defaut : 4317 ou valeur existante).
  -HerdrChemin <fichier>  Chemin de herdr.exe si absent du PATH.
  -SansRaccourci   Ne propose pas le raccourci « Ouvrir le bureau ».
  -Lang fr|en      Langue des messages (sinon langue du système).
  -Interface       Dialogue avec l'interface animée.
  -Aide            Affiche cette aide.

Chaque installation est confirmee par o/n. Aucune cle n'est demandee.
'@
  exit 0
}

$racine = Split-Path -Parent $PSScriptRoot
$rapport = @()
$script:questionNumero = 0
$script:etape = ''
$script:etatEtape = 'skip'
$script:echecInterface = $false
$script:interfaceFinie = $false
$script:entreeFermee = $false

function Champ-Interface([string]$texte) {
  $texte = $texte -replace '[\r\n\t\x00-\x1f\x7f]', ' '
  foreach ($chemin in @($racine,$HOME)) { if ($chemin) { $texte = $texte -replace [regex]::Escape($chemin), '[dossier]' } }
  $texte = $texte -replace '\b[A-Za-z]:[\\/][^"<>|?*]+', '[dossier]'
  $texte = $texte -replace '(?:~[\\/]|/(?:home|Users|root|tmp|private|mnt|media|Volumes)/)[^"<>|?*]+', '[dossier]'
  return $texte -replace '(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{12,}|(?i:Bearer\s+)[A-Za-z0-9_.-]+', '[masqué]'
}
function Emettre-Interface([string]$type, [string[]]$champs) {
  $propres = @($champs | ForEach-Object { Champ-Interface $_ })
  [Console]::WriteLine('@@' + $type + ' ' + ($propres -join "`t"))
}
function Etat-Etape([string]$etat, [string]$texte = '') {
  if (-not $Interface) { return }
  if ($etat -eq 'fail') { $script:echecInterface = $true }
  $rangs = @{ skip = 0; ok = 1; fail = 2 }
  if ($rangs[$etat] -lt $rangs[$script:etatEtape]) { return }
  if (-not $texte -and $etat -ne $script:etatEtape) {
    $texte = switch ($etat) { 'ok' { Texte 'Effectué.' 'Done.' }; 'fail' { Texte 'Erreur.' 'Error.' } }
  }
  $script:etatEtape = $etat
  if ($texte) { $script:texteEtape = $texte }
}
function Fin-Etape {
  if ($Interface -and $script:etape) {
    Emettre-Interface 'DONE' @($script:etape,$script:etatEtape,$script:texteEtape)
    $script:etape = ''
  }
}
function Etape([string]$id) {
  if (-not $Interface) { return }
  Fin-Etape
  $script:etape = $id; $script:etatEtape = 'skip'
  $script:texteEtape = Texte 'Non applicable.' 'Not applicable.'
  $script:totalEtape = 0
  Emettre-Interface 'STEP' @($id)
}
function Terminer-Interface {
  if (-not $Interface -or $script:interfaceFinie) { return }
  Fin-Etape
  $script:interfaceFinie = $true
  Emettre-Interface 'END' @($(if ($script:echecInterface) { 'fail' } else { 'ok' }))
}
function Lire-Interface([string]$type,[string]$question,[string[]]$valeurs) {
  $script:questionNumero++
  Emettre-Interface $type (@("q$script:questionNumero",$question) + $valeurs)
  $ligne = [Console]::ReadLine()
  if ($null -eq $ligne) { $script:entreeFermee = $true }
  return $ligne
}
function Lire-Saisie([string]$question,[string]$defaut = '') {
  if (-not $Interface) { return Read-Host $question }
  $saisie = Lire-Interface 'INPUT' $question @($defaut)
  if ($null -eq $saisie) { return $null }
  if ($saisie -eq '') { return $defaut }
  return $saisie
}
function Choisir([string]$question,[string[]]$options) {
  if (-not $Interface) { return Read-Host $question }
  return Lire-Interface 'CHOICE' $question $options
}

function Dire([string]$texte) {
  if ($Interface) { Emettre-Interface 'INFO' @($texte) } else { Write-Host $texte }
}
function Simuler([string]$texte) {
  if ($Interface) { Etat-Etape 'skip' (Texte 'Simulation.' 'Preview.'); Dire "[simulation] $texte" } else { Write-Host "[simulation] $texte" -ForegroundColor Yellow }
}
function Noter([string]$texte) { $script:rapport += $texte }

function Confirmer([string]$question, [switch]$Individuel) {
  if ($Interface) {
    $saisie = Lire-Interface 'CONFIRM' $question @()
    $accord = $null -ne $saisie -and $saisie.Trim().ToLowerInvariant() -eq 'o'
    if (-not $accord) { Etat-Etape 'skip' (Texte 'Refusé.' 'Declined.') }
    return $accord
  }
  if ($DryRun) { Simuler (Texte "$question o/n : o (simule)" "$question y/n : y (preview)"); return $true }
  if ($Oui -and -not $Individuel) { Dire (Texte "$question o/n : o (accepte automatiquement)" "$question y/n : y (automatic)"); return $true }
  while ($true) {
    $saisie = Read-Host (Texte "$question (o/n)" "$question (y/n)")
    if ($null -eq $saisie) { return $false }
    $reponse = $saisie.Trim().ToLower()
    if (($Lang -eq 'en' -and $reponse -match '^(y|yes)$') -or ($Lang -ne 'en' -and $reponse -match '^(o|oui)$')) { return $true }
    if ($reponse -match '^(n|non|no)$') { return $false }
    Dire (Texte 'Repondez par o ou par n.' 'Please answer y or n.')
  }
}

function Executer([string]$description, [scriptblock]$action) {
  if ($Interface -and $script:entreeFermee) { Etat-Etape 'skip' (Texte 'Entrée fermée.' 'Input closed.'); Dire (Texte 'Entrée fermée : action ignorée.' 'Input closed: action skipped.'); return $false }
  if ($DryRun) { Simuler $description; return $true }
  Dire $description
  $global:LASTEXITCODE = 0
  try {
    & $action
    if ($LASTEXITCODE -ne 0) { throw (Texte "La commande a échoué." 'The command failed.') }
    if ($Interface) {
      $fait = switch ($script:etape) {
        'config' { Texte 'Configuration enregistrée.' 'Configuration saved.' }
        'tests' { Texte 'Vérifications réussies.' 'Checks passed.' }
        default { Texte 'Installation confirmée.' 'Installation confirmed.' }
      }
      Etat-Etape 'ok' $fait
    }
  } catch { if ($Interface) { Etat-Etape 'fail' (Texte 'Commande en échec.' 'Command failed.') }; throw }
  return $true
}

function Lire-VersionNode {
  $commande = Get-Command node -ErrorAction SilentlyContinue
  if (-not $commande) { return $null }
  try { $texte = & node --version 2>$null } catch { return $null }
  if ("$texte" -match '^v?(\d+)\.') { return [int]$Matches[1] }
  return $null
}

function Rafraichir-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $utilisateur = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$utilisateur"
}

if ($Interface) {
  $plans = @(
    @('node','Node.js 22 ou plus','Node.js 22 or later'), @('clink','Clink (confort de cmd)','Clink (cmd comfort)'),
    @('herdr','Herdr','Herdr'), @('panneaux','Espace Herdr en grille 2×2','Herdr workspace in a 2×2 grid'),
    @('outils',"Outils d'IA",'AI tools'), @('chef','Commandes du chef','Chief commands'),
    @('extensions','Extensions','Extensions'), @('config','Configuration et raccourci','Configuration and shortcut'),
    @('kit',"Kit d'équipe",'Team kit'), @('tests','Vérification','Checks')
  )
  foreach ($plan in $plans) { Emettre-Interface 'PLAN' @($plan[0],(Texte $plan[1] $plan[2])) }
}
trap { if ($Interface) { Etat-Etape 'fail'; Terminer-Interface }; break }

Dire (Texte '=== Bureau des agents : installation ===' '=== Agent desktop: installation ===')
Dire (Texte "Dossier du projet : $racine" "Project folder: $racine")
if ($DryRun) { Dire (Texte 'Mode simulation : rien ne sera installe ni modifie.' 'Preview mode: nothing will be installed or changed.') }
Dire ''

# --- 1. Node.js ---------------------------------------------------------
Etape 'node'
Dire (Texte '--- 1. Node.js (version 22 ou plus) ---' '--- 1. Node.js (version 22 or later) ---')
$majeur = Lire-VersionNode
if ($null -ne $majeur -and $majeur -ge 22) {
  Etat-Etape 'ok' "Version $majeur."
  Dire (Texte "Node.js est deja present (version majeure $majeur). Rien a faire." "Node.js is already available (major version $majeur). No action needed.")
  Noter (Texte 'Node.js : deja present.' 'Node.js: already available.')
} else {
  if ($null -eq $majeur) { Dire (Texte 'Node.js est absent de cet ordinateur.' 'Node.js is missing from this computer.') }
  else { Dire (Texte "Node.js est present mais trop ancien (version majeure $majeur) : il faut la version 22 ou plus." "Node.js is available but too old (major version $majeur): version 22 or later is required.") }
  if ($true) {
    try {
      Executer (Texte 'Installation de Node.js avec winget (paquet OpenJS.NodeJS.LTS).' 'Installing Node.js with winget (OpenJS.NodeJS.LTS package).') {
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
      } | Out-Null
      if (-not $DryRun) {
        Rafraichir-Path
        $majeur = Lire-VersionNode
        if ($null -ne $majeur -and $majeur -ge 22) { Dire (Texte "Node.js est maintenant installe (version majeure $majeur)." "Node.js is now installed (major version $majeur)."); Noter (Texte 'Node.js : installe avec winget.' 'Node.js: installed with winget.') }
        else { Dire (Texte "Node.js n'a pas ete detecte. Ouvrez un nouveau terminal, ou installez-le depuis https://nodejs.org/en/download puis relancez ce script." "Node.js was not detected. Open a new terminal, or install it from https://nodejs.org/en/download and run this script again."); Noter (Texte 'Node.js : a verifier (installation winget non confirmee).' 'Node.js: check required (winget installation not confirmed).') }
      } else { Noter (Texte 'Node.js : simulation de l''installation winget.' 'Node.js: preview of winget installation.') }
    } catch {
      Dire (Texte "L'installation de Node.js a echoue : $($_.Exception.Message)" "Node.js installation failed: $($_.Exception.Message)")
      Dire (Texte 'Vous pouvez l''installer vous-meme depuis https://nodejs.org/en/download puis relancer ce script.' 'You can install it from https://nodejs.org/en/download and run this script again.')
      Noter (Texte 'Node.js : installation echouee.' 'Node.js: installation failed.')
    }
  } else {
    Dire (Texte 'Node.js reste a installer depuis https://nodejs.org/en/download (version 22 ou plus).' 'Node.js still needs installing from https://nodejs.org/en/download (version 22 or later).')
    Noter (Texte 'Node.js : non installe (refuse).' 'Node.js: not installed (declined).')
  }
}
$nodeOk = $false
$majeur = Lire-VersionNode
if ($DryRun) { $nodeOk = $true } elseif ($null -ne $majeur -and $majeur -ge 22) { $nodeOk = $true }
if ($Interface -and $script:etatEtape -eq 'ok') {
  if ($null -ne $majeur -and $majeur -ge 22) { Etat-Etape 'ok' "Version $majeur." }
  else { Etat-Etape 'fail' (Texte 'Version 22 ou plus non confirmée.' 'Version 22 or later not confirmed.') }
}
Dire ''

# --- 2. Herdr -----------------------------------------------------------
function Proposer-Clink {
  if (@(Get-Command clink -CommandType Application -ErrorAction SilentlyContinue).Count -gt 0) {
    Etat-Etape 'ok' (Texte 'Déjà présent.' 'Already available.')
    Dire (Texte 'Clink est déjà présent.' 'Clink is already available.'); return
  }
  $wingetClink = @(Get-Command winget -CommandType Application -ErrorAction SilentlyContinue)[0]
  if (-not $wingetClink) { Etat-Etape 'skip' (Texte 'Winget absent.' 'Winget missing.'); Dire (Texte 'Clink ignoré : winget est absent.' 'Clink skipped: winget is missing.'); return }
  Dire (Texte 'Clink ajoute couleurs, complétion et historique à cmd.exe.' 'Clink adds colors, completion and history to cmd.exe.')
  if ($true) {
    try {
      Executer (Texte 'Installation de Clink.' 'Installing Clink.') {
        & $wingetClink.Source install --id chrisant996.Clink -e --accept-source-agreements --accept-package-agreements
      } | Out-Null
      if (-not $DryRun) {
        Rafraichir-Path
        if (Get-Command clink -CommandType Application -ErrorAction SilentlyContinue) { Noter (Texte 'Clink : installé.' 'Clink: installed.') }
        else { Dire (Texte 'Clink : installation à vérifier dans un nouveau terminal.' 'Clink: check installation in a new terminal.'); Noter (Texte 'Clink : à vérifier.' 'Clink: check required.') }
      }
    } catch { Dire (Texte "L'installation de Clink a échoué." 'Clink installation failed.'); Noter (Texte 'Clink : installation échouée.' 'Clink: installation failed.') }
  }
}
Etape 'clink'
Dire (Texte '--- Clink : confort du terminal (facultatif) ---' '--- Clink: terminal comfort (optional) ---')
Proposer-Clink
Etape 'herdr'
Dire (Texte '--- 2. Herdr (gestionnaire de terminaux) ---' '--- 2. Herdr (terminal manager) ---')
function Resoudre-Herdr([string]$chemin) {
  $fichier = Get-Item -LiteralPath $chemin -ErrorAction SilentlyContinue
  if (-not $fichier -or $fichier.PSIsContainer -or $fichier.Extension -ine '.exe') {
    throw (Texte 'Le chemin Herdr doit designer un fichier executable .exe existant.' 'The Herdr path must point to an existing .exe file.')
  }
  return (Resolve-Path -LiteralPath $fichier.FullName -ErrorAction Stop).ProviderPath
}

function Chercher-Herdr {
  if ($HerdrChemin -ne '') { return Resoudre-Herdr $HerdrChemin }
  $commande = Get-Command herdr -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($commande) { return Resoudre-Herdr $commande.Source }
  $dossier = Join-Path $env:USERPROFILE '.herdr\packages'
  if (Test-Path $dossier) {
    $trouve = Get-ChildItem -LiteralPath $dossier -File -Filter 'herdr.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($trouve) { return Resoudre-Herdr $trouve.FullName }
  }
  return $null
}
$herdrTrouve = Chercher-Herdr
if ($herdrTrouve) {
  Etat-Etape 'ok' (Texte 'Déjà présent.' 'Already available.')
  Dire (Texte "Herdr est present : $herdrTrouve" "Herdr is available: $herdrTrouve")
  Noter (Texte 'Herdr : deja present.' 'Herdr: already available.')
  $dansPath = [bool](Get-Command herdr -ErrorAction SilentlyContinue)
  if (-not $dansPath) {
    Dire (Texte 'Herdr n''est pas dans le PATH : le bureau a besoin de la variable BUREAU_HERDR_PATH.' 'Herdr is not in PATH: the desktop needs the BUREAU_HERDR_PATH variable.')
    if ($true) {
      Executer (Texte "Enregistrement de BUREAU_HERDR_PATH = $herdrTrouve (variable de l'utilisateur)." "Saving BUREAU_HERDR_PATH = $herdrTrouve (user environment variable).") {
        [Environment]::SetEnvironmentVariable('BUREAU_HERDR_PATH', $herdrTrouve, 'User')
      } | Out-Null
      Noter (Texte 'BUREAU_HERDR_PATH : enregistre.' 'BUREAU_HERDR_PATH: saved.')
    } else { Noter (Texte 'BUREAU_HERDR_PATH : non enregistre (refuse).' 'BUREAU_HERDR_PATH: not saved (declined).') }
  }
} else {
  Dire (Texte 'Herdr est introuvable sur cet ordinateur.' 'Herdr could not be found on this computer.')
  Dire (Texte 'Methode d''installation officielle (documentation Herdr) :' 'Official installation method (Herdr documentation):')
  Dire '  Windows PowerShell : powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"'
  Dire (Texte '  Si un antivirus bloque : curl.exe -fsSLo install.cmd https://herdr.dev/install.cmd && install.cmd && del install.cmd' '  If an antivirus blocks it: curl.exe -fsSLo install.cmd https://herdr.dev/install.cmd && install.cmd && del install.cmd')
  Dire (Texte '  Puis documentation complete : https://herdr.dev/docs/install/' '  Full documentation: https://herdr.dev/docs/install/')
  if ($true) {
    try {
      Executer (Texte 'Installation de Herdr (script officiel https://herdr.dev/install.ps1).' 'Installing Herdr (official script https://herdr.dev/install.ps1).') {
        powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"
      } | Out-Null
      if (-not $DryRun) {
        Rafraichir-Path
        $herdrTrouve = Chercher-Herdr
        if ($herdrTrouve) {
          Dire (Texte "Herdr est maintenant installe : $herdrTrouve" "Herdr is now installed: $herdrTrouve")
          Noter (Texte 'Herdr : installe.' 'Herdr: installed.')
          if (-not (Get-Command herdr -ErrorAction SilentlyContinue)) {
            Executer (Texte 'Enregistrement du chemin Herdr utilisateur.' 'Saving user Herdr path.') {
              [Environment]::SetEnvironmentVariable('BUREAU_HERDR_PATH', $herdrTrouve, 'User')
            } | Out-Null
            Noter (Texte 'BUREAU_HERDR_PATH : enregistré.' 'BUREAU_HERDR_PATH: saved.')
          }
        }
        else { Dire (Texte 'Herdr n''a pas ete detecte. Consultez https://herdr.dev/docs/install/ puis relancez ce script.' 'Herdr was not detected. See https://herdr.dev/docs/install/ and run this script again.'); Noter (Texte 'Herdr : a verifier.' 'Herdr: check required.') }
      } else { Noter (Texte 'Herdr : simulation de l''installation officielle.' 'Herdr: preview of official installation.') }
    } catch {
      Dire (Texte "L'installation de Herdr a echoue : $($_.Exception.Message)" "Herdr installation failed: $($_.Exception.Message)")
      Dire (Texte 'Suivez la documentation officielle : https://herdr.dev/docs/install/' 'Follow the official documentation: https://herdr.dev/docs/install/')
      Noter (Texte 'Herdr : installation echouee.' 'Herdr: installation failed.')
    }
  } else {
    Dire (Texte 'Herdr reste a installer. Documentation officielle : https://herdr.dev/docs/install/' 'Herdr still needs installing. Official documentation: https://herdr.dev/docs/install/')
    Dire (Texte 'Le bureau ne fonctionnera pas sans Herdr ouvert.' 'The desktop requires Herdr to be open.')
    Noter (Texte 'Herdr : installation impossible.' 'Herdr: installation unavailable.')
  }
}
Dire ''

# --- 3. Panneaux Herdr --------------------------------------------------
function Appeler-Herdr([string[]]$Arguments, [switch]$SansJson) {
  $texte = & $herdrTrouve @Arguments
  if ($LASTEXITCODE -ne 0) { if ($Interface) { Etat-Etape 'fail' }; throw (Texte 'Herdr a refuse la commande.' 'Herdr rejected the command.') }
  if ($Interface -and $Arguments[1] -in @('create','split','rename','start','prompt','install')) {
    $fait = switch ($Arguments[1]) {
      'install' { Texte 'Intégration installée.' 'Integration installed.' }
      'prompt' { Texte 'Orientation envoyée.' 'Orientation sent.' }
      'start' { Texte 'Lancement confirmé.' 'Launch confirmed.' }
      default { Texte 'Panneaux préparés.' 'Panes prepared.' }
    }
    Etat-Etape 'ok' $fait
  }
  if ($SansJson) { return $texte }
  $resultat = ($texte -join "`n") | ConvertFrom-Json
  if ($resultat.error) { if ($Interface) { Etat-Etape 'fail' }; throw (Texte 'Herdr a refuse la commande.' 'Herdr rejected the command.') }
  return $resultat
}

function Lire-Panneaux([string]$espace) {
  $resultat = Appeler-Herdr @('pane','list','--workspace',$espace)
  $ids = @($resultat.result.panes | ForEach-Object { $_.pane_id })
  if ($ids.Count -eq 0 -or @($ids | Where-Object { $_ -notmatch ('^'+[regex]::Escape($espace)+':p[0-9]+$') }).Count) {
    throw (Texte 'Les panneaux du nouvel espace sont illisibles.' 'Cannot read the new workspace panes.')
  }
  return $ids
}

function Creer-GrilleHerdr {
  $creation = Appeler-Herdr @('workspace','create','--label','Bureau des agents')
  $espace = $creation.result.workspace_id
  if (-not $espace) { $espace = $creation.result.workspace.workspace_id }
  if ($espace -notmatch '^[A-Za-z0-9_-]+$') { throw (Texte 'Le nouvel espace est illisible.' 'Cannot read the new workspace.') }
  $avant = @(Lire-Panneaux $espace)
  if ($avant.Count -ne 1) { throw (Texte 'Le nouvel espace doit contenir un seul panneau.' 'The new workspace must contain exactly one pane.') }
  $gauche = $avant[0]
  Appeler-Herdr @('pane','split','--pane',$gauche,'--direction','right','--no-focus') | Out-Null
  $apres = @(Lire-Panneaux $espace)
  $nouveau = @($apres | Where-Object { $_ -notin $avant })
  if ($nouveau.Count -ne 1 -or $apres.Count -ne 2) { throw (Texte 'La colonne droite est illisible.' 'Cannot identify the right column.') }
  $droite = $nouveau[0]
  $ids = @($gauche,$droite)
  foreach ($colonne in @($gauche,$droite)) {
    $avant = @(Lire-Panneaux $espace)
    Appeler-Herdr @('pane','split','--pane',$colonne,'--direction','down','--no-focus') | Out-Null
    $apres = @(Lire-Panneaux $espace)
    $nouveau = @($apres | Where-Object { $_ -notin $avant })
    if ($nouveau.Count -ne 1 -or $apres.Count -ne $avant.Count+1) { throw (Texte 'La decoupe verticale est illisible.' 'Cannot identify the vertical split.') }
    $ids += $nouveau[0]
  }
  $noms = @('Chef','Agent 2','Agent 3','Agent 4')
  for ($i=0; $i -lt 4; $i++) { Appeler-Herdr @('pane','rename',$ids[$i],$noms[$i]) | Out-Null }
  return $ids
}

function Detecter-Outils {
  foreach ($type in @('pi','claude','codex','gemini','cursor','devin','agy','cline','omp','mastracode','opencode','copilot','kimi','kiro','droid','amp','grok','hermes','kilo','qodercli','qwen','letta','maki','muse')) {
    if (Get-Command $type -CommandType Application -ErrorAction SilentlyContinue) { $type }
  }
}

function Proposer-Agents([string[]]$Panneaux) {
  if ($Oui) { Dire (Texte 'Le mode -Oui ne lance aucun agent.' 'The -Oui option never starts an agent.'); return }
  $outils = @(Detecter-Outils)
  if ($outils.Count -eq 0) { Dire (Texte 'Aucun outil compatible detecte : aucun agent lance.' 'No supported tools detected: no agent started.'); return }
  $noms = @('Chef','Agent 2','Agent 3','Agent 4')
  for ($i=0; $i -lt $Panneaux.Count; $i++) {
    if ($DryRun) { Simuler (Texte "Choix et confirmation de l'outil pour $($noms[$i])." "Choose and confirm a tool for $($noms[$i])."); continue }
    Dire (Texte "Panneau $($noms[$i]) : outils detectes" "Pane $($noms[$i]): detected tools")
    for ($j=0; $j -lt $outils.Count; $j++) { Dire "$($j+1). $($outils[$j])" }
    $choix = Choisir (Texte "Numero de l'outil (0 ou Entree pour ignorer)" "Tool number (0 or Enter to skip)") (@((Texte 'Ignorer' 'Skip')) + $outils)
    if ($Interface -and $choix -match '^\d+$') { $choix = [string]([int]$choix - 1) }
    if ([string]::IsNullOrWhiteSpace($choix) -or $choix -eq '0') { continue }
    if ($choix -notmatch '^[0-9]{1,2}$' -or [int]$choix -lt 1 -or [int]$choix -gt $outils.Count) { Dire (Texte 'Choix invalide : panneau ignore.' 'Invalid choice: pane skipped.'); continue }
    $type = $outils[[int]$choix-1]
    if (-not (Get-Command $type -CommandType Application -ErrorAction SilentlyContinue)) { Dire (Texte "Cet outil n'est plus disponible." "This tool is no longer available."); continue }
    if (Confirmer (Texte "Lancer $type dans le panneau $($noms[$i]) ?" "Start $type in pane $($noms[$i])?") -Individuel) {
      try {
        $nomAgent = if ($i -eq 0) { 'chef' } else { "agent$($i+1)" }
        Appeler-Herdr @('agent','start',$nomAgent,'--kind',$type,'--pane',$Panneaux[$i]) | Out-Null
        if (-not $script:chefPane) { $script:chefPane=$Panneaux[$i]; $script:chefOutil=$type }
        if ($Interface) { $script:totalEtape++; Etat-Etape 'ok' (Texte "Outils lancés : $($script:totalEtape)." "Tools started: $($script:totalEtape).") }
        Noter (Texte "$type : lancement confirme par Herdr." "${type}: launch confirmed by Herdr.")
      } catch { Dire (Texte "Le lancement de $type n’a pas ete confirme. Consultez le panneau avant de reessayer." "Launch of $type was not confirmed. Check the pane before trying again.") }
    }
  }
}

Etape 'panneaux'
Dire (Texte '--- 3. Espace Herdr avec 4 panneaux (le premier = chef) ---' '--- 3. Herdr workspace with 4 panes (first pane = chief) ---')
# Commandes verifiees dans l'aide de Herdr 0.9.5 : herdr workspace create,
# herdr pane split, herdr pane rename, herdr agent start <nom> --kind <type>
# --pane <id>. NON VERIFIE : le format exact des sorties de ces commandes.
# Si une commande echoue ou si sa sortie n'est pas lisible, la procedure
# manuelle est affichee au lieu d'echouer silencieusement.
# Aucun outil d'IA n'est lance sans choix et confirmation individuelle.
if ($herdrTrouve) {
  if (Confirmer (Texte 'Creer un espace Herdr « Bureau » avec 4 panneaux (le premier = chef) ?' 'Create a Herdr workspace called Bureau with 4 panes (first pane = chief)?')) {
    if ($DryRun) {
      Simuler (Texte 'Creation de l''espace « Bureau des agents » puis 3 decoupes de panneaux.' 'Creating the Agent desktop workspace, then splitting it into four panes.')
      Simuler (Texte 'Nommage des panneaux : Chef, Agent 2, Agent 3, Agent 4.' 'Pane names: Chef, Agent 2, Agent 3, Agent 4.')
      Noter (Texte 'Panneaux Herdr : simulation.' 'Herdr panes: preview.')
    } else {
      try {
        Dire (Texte 'Creation de l''espace Herdr « Bureau des agents »...' 'Creating the Agent desktop workspace...')
        $ids = @(Creer-GrilleHerdr)
        $noms = @('Chef', 'Agent 2', 'Agent 3', 'Agent 4')
        Dire (Texte "Panneaux crees et nommes : $($noms -join ', ') (identifiants $($ids[0..3] -join ', '))." "Panes created and named: $($noms -join ', ') (identifiers $($ids[0..3] -join ', ')).")
        Noter (Texte 'Panneaux Herdr : 4 panneaux crees et nommes.' 'Herdr panes: 4 panes created and named.')
        Etat-Etape 'ok' (Texte '4 panneaux créés.' '4 panes created.')
        Proposer-Agents $ids
      } catch {
        if ($Interface) { Etat-Etape 'fail' }
        Dire (Texte "La creation automatique n'a pas abouti : $($_.Exception.Message)" "Automatic creation failed: $($_.Exception.Message)")
        Dire (Texte 'Procedure manuelle (commandes verifiees de Herdr) :' 'Manual procedure (verified Herdr commands):')
        Dire '  herdr workspace create --label "Bureau des agents"'
        Dire (Texte '  herdr pane list                      # reperer les identifiants, ex. w6:p1' '  herdr pane list                      # find pane identifiers, e.g. w6:p1')
        Dire '  herdr pane split --pane w6:p1 --direction right'
        Dire '  herdr pane split --pane w6:p1 --direction down'
        Dire '  herdr pane split --pane w6:p2 --direction down'
        Dire (Texte '  herdr pane rename w6:p1 Chef         # puis Agent 2, Agent 3, Agent 4' '  herdr pane rename w6:p1 Chef         # then Agent 2, Agent 3, Agent 4')
        Dire (Texte '  # optionnel : lancer un outil d''IA dans un panneau (non fait par ce script)' '  # optional: start an AI tool in a pane')
        Dire (Texte '  # herdr agent start <nom> --kind claude --pane w6:p1' '  # herdr agent start <name> --kind claude --pane w6:p1')
        Dire (Texte '  # types verifies : pi, claude, codex, gemini, cursor, agy, opencode, copilot...' '  # verified types: pi, claude, codex, gemini, cursor, agy, opencode, copilot...')
        Noter (Texte 'Panneaux Herdr : procedure manuelle affichee.' 'Herdr panes: manual procedure displayed.')
      }
    }
  } else { Noter (Texte 'Panneaux Herdr : non crees (refuse).' 'Herdr panes: not created (declined).') }
} else {
  Dire (Texte 'Herdr absent : l''espace de panneaux est ignore. Installez Herdr puis relancez ce script.' 'Herdr is missing: workspace skipped. Install Herdr and run this script again.')
  Noter (Texte 'Panneaux Herdr : ignores (Herdr absent).' 'Herdr panes: skipped (Herdr missing).')
  Etat-Etape 'skip' (Texte 'Herdr absent.' 'Herdr missing.')
}
Dire ''

function Installer-CompetenceChef([string]$DossierPersonnel) {
  $dossier = Join-Path $DossierPersonnel '.claude/skills/herdr'
  $cible = Join-Path $dossier 'SKILL.md'
  if (Test-Path -LiteralPath $cible) { if ($Interface) { Etat-Etape 'ok' (Texte 'Compétence déjà présente.' 'Skill already available.') }; Dire (Texte 'Compétence déjà présente : conservée.' 'Skill already exists: kept.'); return }
  $parent = $dossier
  while ($parent) {
    $item = Get-Item -LiteralPath $parent -Force -ErrorAction SilentlyContinue
    if ($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw (Texte 'Chemin lié refusé pour la compétence.' 'Linked skill path rejected.') }
    $parent = Split-Path -Parent $parent
  }
  if (-not (Confirmer (Texte 'Ajouter les commandes Herdr au chef, sans remplacer de fichier ?' 'Add Herdr commands to the chief without replacing any file?') -Individuel)) { return }
  if ($DryRun) { Simuler (Texte 'Ajout de la compétence Herdr dans le dossier connu.' 'Add the Herdr skill to its known directory.'); return }
  $contenu = (& $herdrTrouve --skill) -join "`n"
  if ($LASTEXITCODE -ne 0 -or -not $contenu -or $contenu.Length -gt 524288) { throw (Texte 'Compétence Herdr illisible.' 'Cannot read the Herdr skill.') }
  [void][IO.Directory]::CreateDirectory($dossier)
  $flux = [IO.File]::Open($cible, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $octets = [Text.Encoding]::UTF8.GetBytes($contenu); $flux.Write($octets,0,$octets.Length) } finally { $flux.Dispose() }
  if ($Interface) { Etat-Etape 'ok' (Texte 'Compétence ajoutée.' 'Skill added.') }
}

function Proposer-Chef([string]$DossierPersonnel = $HOME) {
  if ($Oui -or -not $herdrTrouve) { if ($Interface) { Etat-Etape 'skip' (Texte 'Non applicable dans ce mode.' 'Not applicable in this mode.') }; return }
  $integrations = @('pi','omp','claude','codex','copilot','devin','droid','kimi','opencode','kilo','hermes','qodercli','qwen','letta','cursor','mastracode','antigravity-cli','grok')
  foreach ($type in @(Detecter-Outils)) {
    $integration = if ($type -eq 'agy') { 'antigravity-cli' } else { $type }
    if ($integration -notin $integrations) { continue }
    if (Confirmer (Texte "Installer l'intégration Herdr pour $type ? Elle modifie la configuration de cet outil." "Install the Herdr integration for $type? It changes this tool's configuration.") -Individuel) {
      if ($DryRun) { Simuler "herdr integration install $integration" }
      else {
        try { $null = Appeler-Herdr @('integration','install',$integration) -SansJson }
        catch { Dire (Texte "L'intégration de $type n'a pas été confirmée. Vérifiez avant de réessayer." "Integration for $type was not confirmed. Check before trying again.") }
      }
    }
  }
  if (-not $chefPane) { if ($Interface) { Etat-Etape 'skip' (Texte 'Aucun chef lancé.' 'No chief started.') }; return }
  if ($chefOutil -eq 'claude') {
    try { Installer-CompetenceChef $DossierPersonnel }
    catch { Dire (Texte 'Compétence non ajoutée : le fichier est conservé. CHEF.md du kit suffit.' 'Skill not added: existing files are kept. The kit CHEF.md is sufficient.') }
  } else { Dire (Texte 'Chemin de compétence non vérifié pour cet outil : CHEF.md du kit suffit.' 'Skill location not verified for this tool: the kit CHEF.md is sufficient.') }
  $orientation = Texte "Tu es le chef de l'équipe. Lis AGENTS.md et CHEF.md, liste les agents avec ``herdr agent list``, puis attends les instructions de DrSmoke." 'You are the team chief. Read AGENTS.md and CHEF.md, list agents with `herdr agent list`, then wait for instructions from DrSmoke.'
  Dire $orientation
  if (Confirmer (Texte 'Envoyer cette orientation au chef ?' 'Send this orientation to the chief?') -Individuel) {
    if ($DryRun) { Simuler (Texte "Orientation du chef dans $chefPane." "Chief orientation in $chefPane.") }
    else {
      try { $null = Appeler-Herdr @('agent','prompt',$chefPane,$orientation) -SansJson }
      catch { Dire (Texte "Envoi non confirmé : consultez le panneau avant de réessayer." 'Send not confirmed: check the pane before trying again.') }
    }
  }
}
if (-not $Interface) { Proposer-Chef }

# --- 4. IA en ligne de commande (optionnelles) ---------------------------
Etape 'outils'
Dire (Texte '--- 4. Outils d''IA en ligne de commande (entierement optionnels) ---' '--- 4. Command-line AI tools (entirely optional) ---')
Dire (Texte 'Aucune cle ni aucun jeton n''est demande ici. Si un outil vous demande de vous' 'No key or token is requested here. If a tool asks you to sign in,')
Dire (Texte 'connecter, faites-le dans son interface au premier lancement, jamais dans ce script.' 'use its own interface when you first open it, never this script.')
Dire ''

# Sélection unique des outils absents ; la confirmation porte sur la liste entière.
$catalogue = @(
  @{ Nom = 'Claude Code'; Commande = 'claude'; Installation = 'irm https://claude.ai/install.ps1 | iex' },
  @{ Nom = 'Codex (OpenAI)'; Commande = 'codex'; Installation = 'powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"' },
  @{ Nom = 'OpenCode'; Commande = 'opencode'; Installation = 'npm install -g opencode-ai' },
  @{ Nom = 'Pi'; Commande = 'pi'; Installation = 'npm install -g @mariozechner/pi-coding-agent' },
  @{ Nom = 'Gemini CLI'; Commande = 'gemini'; Installation = 'npm install -g @google/gemini-cli' },
  @{ Nom = 'Antigravity'; Commande = 'antigravity-cli'; Installation = $null }
)
function Outil-Present($outil) {
  return ([bool](Get-Command $outil.Commande -ErrorAction SilentlyContinue) -or
    ($outil.Commande -eq 'antigravity-cli' -and [bool](Get-Command agy -ErrorAction SilentlyContinue)))
}
$manquants = @($catalogue | Where-Object { -not (Outil-Present $_) })
$disponibles = @($catalogue | Where-Object { Outil-Present $_ })
foreach ($outil in $disponibles) { Dire (Texte "$($outil.Nom) : déjà présent." "$($outil.Nom): already available."); Noter "$($outil.Nom) : déjà présent." }
if ($disponibles.Count -gt 0) { Etat-Etape 'ok' (Texte "Outils disponibles : $($disponibles.Count)." "Available tools: $($disponibles.Count).") }
if ($manquants.Count -gt 0) {
  Dire (Texte 'Outils absents proposés :' 'Missing tools available for selection:')
  for ($i=0; $i -lt $manquants.Count; $i++) { Dire "$($i+1). $($manquants[$i].Nom)" }
  Dire (Texte 'Antigravity : documentation officielle, installation manuelle.' 'Antigravity: official documentation, manual installation.')
  while ($true) {
    if ($Oui -or $DryRun) { $selection = '0' }
    else { $selection = Lire-Saisie (Texte 'Numéros à installer (ex. 1,3 ; 0 = aucun)' 'Numbers to install (e.g. 1,3; 0 = none)') '0' }
    if ($null -eq $selection) { break }
    $selection = $selection -replace '\s',''
    if ($selection -eq '0' -or $selection -eq '') {
      if ($disponibles.Count -eq 0 -and -not $DryRun) { Dire (Texte 'Aucune IA choisie : vous pourrez en installer une avant votre première mission.' 'No AI selected: you can install one before your first mission.') }
      break
    }
    if ($selection -notmatch '^[1-9][0-9]*(,[1-9][0-9]*)*$') { Dire (Texte 'Sélection invalide.' 'Invalid selection.'); continue }
    $indices = @($selection.Split(',') | ForEach-Object { [int]$_ } | Select-Object -Unique)
    if (@($indices | Where-Object { $_ -gt $manquants.Count }).Count -gt 0) { Dire (Texte 'Numéro hors liste.' 'Number out of range.'); continue }
    $choisis = @($indices | ForEach-Object { $manquants[$_-1] })
    Dire (Texte "Sélection : $(($choisis | ForEach-Object { $_.Nom }) -join ', ')" "Selection: $(($choisis | ForEach-Object { $_.Nom }) -join ', ')")
    if (-not (Confirmer (Texte 'Installer cette sélection ?' 'Install this selection?') -Individuel)) { continue }
    foreach ($outil in $choisis) {
      if (-not $outil.Installation) { Dire 'https://antigravity.google/docs/cli/getting-started'; Noter 'Antigravity : installation manuelle requise.'; continue }
      try {
        Executer (Texte "Installation de $($outil.Nom)." "Installing $($outil.Nom).") ([scriptblock]::Create($outil.Installation)) | Out-Null
        if (-not $DryRun) { Rafraichir-Path; if (Get-Command $outil.Commande -ErrorAction SilentlyContinue) { $disponibles += $outil; Noter "$($outil.Nom) : installé." } else { Noter "$($outil.Nom) : à vérifier." } }
      } catch { Dire (Texte "Installation de $($outil.Nom) échouée." "Installation of $($outil.Nom) failed.") }
    }
    break
  }
}
if ($disponibles.Count -eq 0 -and -not $DryRun) { Dire (Texte 'Aucune IA détectée : configurez un outil avant une mission.' 'No AI detected: set up a tool before starting a mission.') }

# --- 5. Extensions utiles (optionnelles) --------------------------------
if ($Interface) { Etape 'chef'; Proposer-Chef }
Etape 'extensions'
Dire (Texte '--- 5. Extensions utiles pour ce projet (optionnelles) ---' '--- 5. Useful project extensions (optional) ---')
# Trois extensions verifiees sur le marche VS Code le 17 octobre 2026, avec
# leurs editeurs : yzhang.markdown-all-in-one (Yu Zhang), dbaeumer.vscode-eslint
# (Microsoft), esbenp.prettier-vscode (Prettier).
if (Confirmer (Texte 'Veux-tu voir la liste des extensions proposees pour ce projet ?' 'Would you like to see the suggested project extensions?')) {
  Dire (Texte '  1. Markdown All in One : yzhang.markdown-all-in-one (Yu Zhang) : table des matieres et confort Markdown.' '  1. Markdown All in One: yzhang.markdown-all-in-one (Yu Zhang): contents and Markdown editing.')
  Dire (Texte '  2. ESLint : dbaeumer.vscode-eslint (Microsoft) : controle du JavaScript et du TypeScript.' '  2. ESLint: dbaeumer.vscode-eslint (Microsoft): JavaScript and TypeScript checks.')
  Dire (Texte '  3. Prettier - Code formatter : esbenp.prettier-vscode (Prettier) : mise en forme coherente du code.' '  3. Prettier - Code formatter: esbenp.prettier-vscode (Prettier): consistent code formatting.')
  $extensions = @(
    @{ nom = 'Markdown All in One'; id = 'yzhang.markdown-all-in-one' },
    @{ nom = 'ESLint'; id = 'dbaeumer.vscode-eslint' },
    @{ nom = 'Prettier - Code formatter'; id = 'esbenp.prettier-vscode' }
  )
  $vscode = Get-Command code -ErrorAction SilentlyContinue
  if (-not $vscode) {
    Etat-Etape 'skip' (Texte 'VS Code absent.' 'VS Code missing.')
    Dire (Texte 'VS Code n''est pas detecte sur cet ordinateur : l''installation des extensions est ignoree.' 'VS Code was not detected: extension installation skipped.')
    Noter (Texte 'Extensions : ignorees (VS Code absent).' 'Extensions: skipped (VS Code missing).')
  } else {
    foreach ($ext in $extensions) {
      if (Confirmer (Texte "Installer l'extension $($ext.nom) ($($ext.id)) ?" "Install extension $($ext.nom) ($($ext.id))?") -Individuel) {
        try {
          Executer (Texte "Installation de $($ext.id) avec code --install-extension." "Installing $($ext.id) with code --install-extension.") { & $vscode.Source --install-extension $ext.id }
          if ($Interface -and -not $DryRun) { $script:totalEtape++; Etat-Etape 'ok' (Texte "Extensions installées : $($script:totalEtape)." "Extensions installed: $($script:totalEtape).") }
          Noter (Texte "Extension $($ext.id) : installee." "Extension $($ext.id): installed.")
        } catch {
          Dire (Texte "L'installation de $($ext.id) a echoue : $($_.Exception.Message)" "Installation of $($ext.id) failed: $($_.Exception.Message)")
          Noter (Texte "Extension $($ext.id) : echec." "Extension $($ext.id): failed.")
        }
      } else { Noter (Texte "Extension $($ext.id) : refusee." "Extension $($ext.id): declined.") }
    }
  }
} else { Noter (Texte 'Extensions : liste non demandee.' 'Extensions: list not requested.') }
Dire ''

# --- 6. Configuration ---------------------------------------------------
Etape 'config'
Dire (Texte '--- 6. Configuration du bureau ---' '--- 6. Desktop configuration ---')
$portChoisi = 0
$portActuel = [Environment]::GetEnvironmentVariable('BUREAU_PORT', 'User')
if ($Port -gt 0) { $portChoisi = $Port }
elseif ($portActuel -match '^\d+$') { $portChoisi = [int]$portActuel; Dire (Texte "Port deja enregistre : $portChoisi" "Previously saved port: $portChoisi") }
else { $portChoisi = 4317 }

if ($Port -eq 0 -and -not $DryRun) {
  if (Confirmer (Texte "Utiliser le port $portChoisi pour le bureau ?" "Use port $portChoisi for the desktop?")) { }
  else {
    while ($true) {
      $saisie = Lire-Saisie (Texte 'Entrez un port entre 1024 et 65535' 'Enter a port between 1024 and 65535') "$portChoisi"
      if ($Interface -and $null -eq $saisie) { break }
      if ($saisie -match '^\d+$') {
        $valeur = [int]$saisie
        if ($valeur -ge 1024 -and $valeur -le 65535) { $portChoisi = $valeur; break }
      }
      Dire (Texte 'Port invalide.' 'Invalid port.')
    }
  }
}
if ($portChoisi -lt 1024 -or $portChoisi -gt 65535) { $portChoisi = 4317 }
if ("$portActuel" -ne "$portChoisi") {
  Executer (Texte "Enregistrement de BUREAU_PORT = $portChoisi (variable de l'utilisateur)." "Saving BUREAU_PORT = $portChoisi (user environment variable).") {
    [Environment]::SetEnvironmentVariable('BUREAU_PORT', "$portChoisi", 'User')
  } | Out-Null
  if (-not ($Interface -and $script:entreeFermee)) { Noter (Texte "BUREAU_PORT : $portChoisi." "BUREAU_PORT: $portChoisi..") }
} else {
  Dire (Texte "BUREAU_PORT deja enregistre ($portChoisi). Rien a faire." "BUREAU_PORT already saved ($portChoisi). No action needed.")
  Noter (Texte "BUREAU_PORT : deja a $portChoisi." "BUREAU_PORT: already set to $portChoisi..")
  Etat-Etape 'ok' (Texte "Port $portChoisi déjà enregistré." "Port $portChoisi already saved.")
}

if (-not $SansRaccourci) {
  $bureau = [Environment]::GetFolderPath('Desktop')
  $lienRaccourci = Join-Path $bureau 'Ouvrir le bureau.lnk'
  # Nouveau choix : le raccourci lance Herdr directement, ou le bureau ouvert
  # dans le navigateur. Le lanceur « Ouvrir le bureau.cmd » existant est reutilise
  # pour ce second cas : aucun doublon n'est cree.
  $choixLanceur = 'bureau'
  if ($Interface) {
    $saisie = Choisir (Texte 'Que doit lancer le raccourci ?' 'What should the shortcut open?') @('Herdr',(Texte 'Le bureau' 'Desktop'),(Texte 'Herdr et bureau' 'Herdr and desktop'))
    if ($saisie -eq '1') { $choixLanceur = 'herdr' }
    if ($saisie -eq '3') { $choixLanceur = 'ensemble' }
  } elseif ($DryRun) {
    Simuler (Texte 'Question du raccourci : 1 = Herdr, 2 = le bureau dans le navigateur, 3 = Herdr et bureau (defaut 2).' 'Shortcut choice: 1 = Herdr, 2 = desktop in browser, 3 = Herdr and desktop (default 2).')
  } elseif ($Oui) {
    Dire (Texte 'Raccourci : choix automatique « le bureau » (-Oui).' 'Shortcut: automatic desktop choice (-Oui).')
  } else {
    $saisie = Read-Host (Texte 'Que doit lancer le raccourci du Bureau ? 1 = Herdr, 2 = le bureau dans le navigateur, 3 = Herdr et bureau (defaut 2)' 'What should the shortcut open? 1 = Herdr, 2 = desktop in browser, 3 = Herdr and desktop (default 2)')
    if ($saisie.Trim() -eq '1') { $choixLanceur = 'herdr' }
    if ($saisie.Trim() -eq '3') { $choixLanceur = 'ensemble' }
  }
  if ($choixLanceur -eq 'herdr') {
    $cible = $herdrTrouve
    if (-not $cible) { $cible = Chercher-Herdr }
    if (-not $cible) {
      Dire (Texte 'Herdr est introuvable : le raccourci Herdr est ignore.' 'Herdr was not found: Herdr shortcut skipped.')
      Noter (Texte 'Raccourci : Herdr absent.' 'Shortcut: Herdr missing.')
    } elseif (Confirmer (Texte 'Creer le raccourci « Ouvrir le bureau » qui lance Herdr ?' 'Create the Open desktop shortcut that starts Herdr?')) {
      Executer (Texte "Creation du raccourci $lienRaccourci (lance Herdr)." "Creating shortcut $lienRaccourci (starts Herdr).") {
        $wsh = New-Object -ComObject WScript.Shell
        $raccourci = $wsh.CreateShortcut($lienRaccourci)
        $raccourci.TargetPath = $cible
        $raccourci.WorkingDirectory = $racine
        $raccourci.Save()
      } | Out-Null
      Noter (Texte 'Raccourci : cree sur le Bureau (lance Herdr).' 'Shortcut: created on Desktop (starts Herdr).')
    } else { Noter (Texte 'Raccourci : non cree (refuse).' 'Shortcut: not created (declined).') }
  } else {
    $cible = Join-Path $racine 'Ouvrir le bureau.cmd'
    if ($choixLanceur -eq 'ensemble') {
      $cible = Join-Path $PSHOME 'powershell.exe'
      if (-not $herdrTrouve) { Dire (Texte 'Herdr absent : raccourci combine ignore.' 'Herdr missing: combined shortcut skipped.'); $cible = $null }
    }
    if (-not $cible -or -not (Test-Path -LiteralPath $cible)) {
      Dire (Texte "Le lanceur 'Ouvrir le bureau.cmd' est absent du projet : raccourci ignore." "The Open desktop launcher is missing from the project: shortcut skipped.")
      Noter (Texte 'Raccourci : lanceur absent.' 'Shortcut: launcher missing.')
    } else {
      $dejaLa = Test-Path $lienRaccourci
      $question = if ($dejaLa) { Texte 'Le raccourci existe déjà sur le Bureau. Le remplacer ?' 'The shortcut already exists on Desktop. Replace it?' } else { Texte 'Créer le raccourci « Ouvrir le bureau » ?' 'Create the Open desktop shortcut?' }
      if (Confirmer $question) {
        Executer (Texte "Creation du raccourci $lienRaccourci." "Creating shortcut $lienRaccourci..") {
          $wsh = New-Object -ComObject WScript.Shell
          $raccourci = $wsh.CreateShortcut($lienRaccourci)
          $raccourci.TargetPath = $cible
          if ($choixLanceur -eq 'ensemble') {
            $lanceur = Join-Path $racine 'Ouvrir le bureau.ps1'
            $raccourci.Arguments = '-NoProfile -File "' + $lanceur + '" -AvecHerdr'
          }
          $raccourci.WorkingDirectory = $racine
          $raccourci.Save()
        } | Out-Null
        Noter (Texte 'Raccourci : cree sur le Bureau.' 'Shortcut: created on Desktop.')
      } else { Noter (Texte 'Raccourci : non cree (refuse).' 'Shortcut: not created (declined).') }
    }
  }
}
Dire ''

function Proposer-Kit {
  if ($Oui) { if ($Interface) { Etat-Etape 'skip' (Texte 'Ignoré avec -Oui.' 'Skipped with -Oui.') }; Dire (Texte 'Le mode -Oui ne crée aucun kit.' 'The -Oui option never creates a kit.'); return }
  $scriptKit = Join-Path $racine 'scripts/init-kit.mjs'
  if (-not (Test-Path -LiteralPath $scriptKit -PathType Leaf)) { if ($Interface) { Etat-Etape 'skip' (Texte 'Script du kit absent.' 'Kit script missing.') }; Dire (Texte 'Kit indisponible : script absent.' 'Kit unavailable: script missing.'); return }
  if (-not (Confirmer (Texte "Initialiser le kit d'équipe dans un projet ?" 'Initialize the team kit in a project?') -Individuel)) { return }
  if ($DryRun -and -not $Interface) { Simuler (Texte 'Choix du dossier puis initialisation du kit.' 'Choose a folder, then initialize the kit.'); return }
  $dossier = Lire-Saisie (Texte 'Dossier du projet (Entrée pour ignorer)' 'Project folder (Enter to skip)')
  if ([string]::IsNullOrWhiteSpace($dossier)) { if ($Interface) { Etat-Etape 'skip' (Texte 'Aucun dossier choisi.' 'No folder selected.') }; return }
  if ($DryRun) { Simuler (Texte 'Initialisation du kit dans le dossier choisi.' 'Initialize the kit in the chosen folder.'); return }
  $dossier = [IO.Path]::GetFullPath($dossier)
  $nodeKit = @(Get-Command node -CommandType Application -ErrorAction Stop)[0]
  & $nodeKit.Source $scriptKit $dossier --lang $Lang
  if ($LASTEXITCODE -ne 0) { if ($Interface) { Etat-Etape 'fail' }; Dire (Texte "Le kit n'a pas été initialisé. Consultez le résultat ci-dessus." 'The kit was not initialized. Check the output above.'); return }
  if ($Interface) { Etat-Etape 'ok' (Texte 'Kit initialisé.' 'Kit initialized.') }
  Noter (Texte "Kit d'équipe : initialisé." 'Team kit: initialized.')
}

if ($Interface) { Etape 'kit'; Proposer-Kit }
Etape 'tests'

# --- 7. Tests -----------------------------------------------------------
Dire (Texte '--- 7. Tests du projet ---' '--- 7. Project tests ---')
if (-not (Test-Path (Join-Path $racine 'test') -PathType Container)) {
  Etat-Etape 'skip' (Texte 'Paquet utilisateur sans tests.' 'User package without tests.')
  Dire (Texte 'Les tests de développement sont dans le dépôt source.' 'Development tests are in the source repository.')
} elseif (-not $nodeOk) {
  Etat-Etape 'skip' (Texte 'Node.js absent ou trop ancien.' 'Node.js missing or too old.')
  Dire (Texte 'Node.js manquant ou trop ancien : tests ignores. Relancez ce script apres installation.' 'Node.js missing or too old: tests skipped. Run this script again after installing it.')
  Noter (Texte 'Tests : ignores (Node.js absent).' 'Tests: skipped (Node.js missing).')
} else {
  if (Confirmer (Texte 'Lancer npm test et npm run check maintenant ?' 'Run npm test and npm run check now?')) {
    try {
      Executer (Texte 'Execution de npm test.' 'Running npm test.') {
        Push-Location $racine
        try { npm test } finally { Pop-Location }
      } | Out-Null
      Executer (Texte 'Execution de npm run check.' 'Running npm run check.') {
        Push-Location $racine
        try { npm run check } finally { Pop-Location }
      } | Out-Null
      Noter (Texte 'Tests : executes.' 'Tests: completed.')
    } catch {
      Dire (Texte "Les tests ont echoue : $($_.Exception.Message)" "Tests failed: $($_.Exception.Message)")
      Noter (Texte 'Tests : echec.' 'Tests: failed.')
    }
  } else { Noter (Texte 'Tests : non executes (refuse).' 'Tests: not run (declined).') }
}
Dire ''

if (-not $Interface) { Proposer-Kit }

# --- Resume -------------------------------------------------------------
$installationIncomplete = -not $DryRun -and (-not $nodeOk -or -not $herdrTrouve)
if ($installationIncomplete) {
  Dire (Texte 'Installation incomplète : Node.js 22+ et Herdr sont requis.' 'Incomplete installation: Node.js 22+ and Herdr are required.')
  if ($Interface) { $script:echecInterface = $true }
}
Dire (Texte '=== Resume ===' '=== Summary ===')
if ($rapport.Count -eq 0) { Dire (Texte 'Rien a signaler.' 'Nothing to report.') }
else { foreach ($ligne in $rapport) { Dire " - $ligne" } }
Dire ''
Dire (Texte "Pour ouvrir le bureau : double-cliquez sur 'Ouvrir le bureau.cmd' dans $racine" "To open the desktop: double-click Ouvrir le bureau.cmd in $racine")
Dire (Texte "ou lancez 'node server.mjs' puis ouvrez http://127.0.0.1:$portChoisi" "or run node server.mjs, then open http://127.0.0.1:$portChoisi")
Dire (Texte 'Herdr doit etre ouvert pour que le bureau voie vos agents.' 'Herdr must be open for the desktop to see your agents.')
Terminer-Interface
if ($installationIncomplete -or ($Interface -and $script:echecInterface)) { exit 1 }
