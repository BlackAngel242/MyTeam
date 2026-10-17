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
  Accepte sauf Herdr et chaque extension, qui exigent un o/n individuel.

.PARAMETER Port
  Port du bureau (variable BUREAU_PORT). Sinon, question pendant l'installation.

.PARAMETER HerdrChemin
  Chemin complet de herdr.exe si Herdr n'est pas dans le PATH (BUREAU_HERDR_PATH).

.PARAMETER SansRaccourci
  Ne propose jamais la creation du raccourci « Ouvrir le bureau ».

.PARAMETER Aide
  Affiche cette aide.

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
  [switch]$Aide
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if ($Aide) {
  Write-Host @'
Script d'installation du Bureau des agents (Windows).

Usage :
  powershell -ExecutionPolicy Bypass -File scripts\installer.ps1 [options]

Options :
  -DryRun          Simulation : affiche les actions sans rien executer.
  -Oui             Accepte sauf Herdr et chaque extension (o/n obligatoire).
  -Port <numero>   Port du bureau (defaut : 4317 ou valeur existante).
  -HerdrChemin <fichier>  Chemin de herdr.exe si absent du PATH.
  -SansRaccourci   Ne propose pas le raccourci « Ouvrir le bureau ».
  -Aide            Affiche cette aide.

Chaque installation est confirmee par o/n. Aucune cle n'est demandee.
'@
  exit 0
}

$racine = Split-Path -Parent $PSScriptRoot
$rapport = @()

function Dire([string]$texte) { Write-Host $texte }
function Simuler([string]$texte) { Write-Host "[simulation] $texte" -ForegroundColor Yellow }
function Noter([string]$texte) { $script:rapport += $texte }

function Confirmer([string]$question, [switch]$Individuel) {
  if ($DryRun) { Simuler "$question o/n : o (simule)"; return $true }
  if ($Oui -and -not $Individuel) { Dire "$question o/n : o (accepte automatiquement)"; return $true }
  while ($true) {
    $saisie = Read-Host "$question (o/n)"
    if ($null -eq $saisie) { return $false }
    $reponse = $saisie.Trim().ToLower()
    if ($reponse -match '^(o|oui)$') { return $true }
    if ($reponse -match '^(n|non)$') { return $false }
    Dire 'Repondez par o ou par n.'
  }
}

function Executer([string]$description, [scriptblock]$action) {
  if ($DryRun) { Simuler $description; return $true }
  Dire $description
  & $action
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

Dire '=== Bureau des agents : installation ==='
Dire "Dossier du projet : $racine"
if ($DryRun) { Dire 'Mode simulation : rien ne sera installe ni modifie.' }
Dire ''

# --- 1. Node.js ---------------------------------------------------------
Dire '--- 1. Node.js (version 22 ou plus) ---'
$majeur = Lire-VersionNode
if ($null -ne $majeur -and $majeur -ge 22) {
  Dire "Node.js est deja present (version majeure $majeur). Rien a faire."
  Noter 'Node.js : deja present.'
} else {
  if ($null -eq $majeur) { Dire 'Node.js est absent de cet ordinateur.' }
  else { Dire "Node.js est present mais trop ancien (version majeure $majeur) : il faut la version 22 ou plus." }
  if (Confirmer 'Installer Node.js (version LTS) avec winget ?') {
    try {
      Executer 'Installation de Node.js avec winget (paquet OpenJS.NodeJS.LTS).' {
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
      } | Out-Null
      if (-not $DryRun) {
        Rafraichir-Path
        $majeur = Lire-VersionNode
        if ($null -ne $majeur -and $majeur -ge 22) { Dire "Node.js est maintenant installe (version majeure $majeur)."; Noter 'Node.js : installe avec winget.' }
        else { Dire "Node.js n'a pas ete detecte. Ouvrez un nouveau terminal, ou installez-le depuis https://nodejs.org/en/download puis relancez ce script."; Noter 'Node.js : a verifier (installation winget non confirmee).' }
      } else { Noter 'Node.js : simulation de l''installation winget.' }
    } catch {
      Dire "L'installation de Node.js a echoue : $($_.Exception.Message)"
      Dire 'Vous pouvez l''installer vous-meme depuis https://nodejs.org/en/download puis relancer ce script.'
      Noter 'Node.js : installation echouee.'
    }
  } else {
    Dire 'Node.js reste a installer depuis https://nodejs.org/en/download (version 22 ou plus).'
    Noter 'Node.js : non installe (refuse).'
  }
}
$nodeOk = $false
$majeur = Lire-VersionNode
if ($DryRun) { $nodeOk = $true } elseif ($null -ne $majeur -and $majeur -ge 22) { $nodeOk = $true }
Dire ''

# --- 2. Herdr -----------------------------------------------------------
Dire '--- 2. Herdr (gestionnaire de terminaux) ---'
function Resoudre-Herdr([string]$chemin) {
  $fichier = Get-Item -LiteralPath $chemin -ErrorAction SilentlyContinue
  if (-not $fichier -or $fichier.PSIsContainer -or $fichier.Extension -ine '.exe') {
    throw 'Le chemin Herdr doit designer un fichier executable .exe existant.'
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
  Dire "Herdr est present : $herdrTrouve"
  Noter 'Herdr : deja present.'
  $dansPath = [bool](Get-Command herdr -ErrorAction SilentlyContinue)
  if (-not $dansPath) {
    Dire 'Herdr n''est pas dans le PATH : le bureau a besoin de la variable BUREAU_HERDR_PATH.'
    if (Confirmer 'Enregistrer BUREAU_HERDR_PATH avec ce chemin ?') {
      Executer "Enregistrement de BUREAU_HERDR_PATH = $herdrTrouve (variable de l'utilisateur)." {
        [Environment]::SetEnvironmentVariable('BUREAU_HERDR_PATH', $herdrTrouve, 'User')
      } | Out-Null
      Noter 'BUREAU_HERDR_PATH : enregistre.'
    } else { Noter 'BUREAU_HERDR_PATH : non enregistre (refuse).' }
  }
} else {
  Dire 'Herdr est introuvable sur cet ordinateur.'
  Dire 'Methode d''installation officielle (documentation Herdr) :'
  Dire '  Windows PowerShell : powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"'
  Dire '  Si un antivirus bloque : curl.exe -fsSLo install.cmd https://herdr.dev/install.cmd && install.cmd && del install.cmd'
  Dire '  Puis documentation complete : https://herdr.dev/docs/install/'
  if (Confirmer 'Installer Herdr maintenant avec la commande officielle ci-dessus ?' -Individuel) {
    try {
      Executer 'Installation de Herdr (script officiel https://herdr.dev/install.ps1).' {
        powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"
      } | Out-Null
      if (-not $DryRun) {
        Rafraichir-Path
        $herdrTrouve = Chercher-Herdr
        if ($herdrTrouve) { Dire "Herdr est maintenant installe : $herdrTrouve"; Noter 'Herdr : installe.' }
        else { Dire 'Herdr n''a pas ete detecte. Consultez https://herdr.dev/docs/install/ puis relancez ce script.'; Noter 'Herdr : a verifier.' }
      } else { Noter 'Herdr : simulation de l''installation officielle.' }
    } catch {
      Dire "L'installation de Herdr a echoue : $($_.Exception.Message)"
      Dire 'Suivez la documentation officielle : https://herdr.dev/docs/install/'
      Noter 'Herdr : installation echouee.'
    }
  } else {
    Dire 'Herdr reste a installer. Documentation officielle : https://herdr.dev/docs/install/'
    Dire 'Le bureau ne fonctionnera pas sans Herdr ouvert.'
    Noter 'Herdr : non installe (refuse).'
  }
}
Dire ''

# --- 3. Panneaux Herdr --------------------------------------------------
Dire '--- 3. Espace Herdr avec 4 panneaux (le premier = chef) ---'
# Commandes verifiees dans l'aide de Herdr 0.9.5 : herdr workspace create,
# herdr pane split, herdr pane rename, herdr agent start <nom> --kind <type>
# --pane <id>. NON VERIFIE : le format exact des sorties de ces commandes.
# Si une commande echoue ou si sa sortie n'est pas lisible, la procedure
# manuelle est affichee au lieu d'echouer silencieusement.
# Aucun outil d'IA n'est lance automatiquement : herdr agent start demarrerait
# un vrai agent, c'est a DrSmoke de le faire.
if ($herdrTrouve) {
  if (Confirmer 'Creer un espace Herdr « Bureau » avec 4 panneaux (le premier = chef) ?') {
    if ($DryRun) {
      Simuler 'Creation de l''espace « Bureau des agents » puis 3 decoupes de panneaux.'
      Simuler 'Nommage des panneaux : Chef, Agent 2, Agent 3, Agent 4.'
      Noter 'Panneaux Herdr : simulation.'
    } else {
      try {
        Dire 'Creation de l''espace Herdr « Bureau des agents »...'
        $sortie = & $herdrTrouve workspace create --label 'Bureau des agents' 2>&1 | Out-String
        & $herdrTrouve pane split --direction right 2>&1 | Out-Null
        & $herdrTrouve pane split --direction down 2>&1 | Out-Null
        & $herdrTrouve pane split --direction down 2>&1 | Out-Null
        $liste = & $herdrTrouve pane list 2>&1 | Out-String
        $ids = [regex]::Matches($liste, '[A-Za-z0-9_-]+:p\d+') | ForEach-Object { $_.Value } | Select-Object -Unique
        $noms = @('Chef', 'Agent 2', 'Agent 3', 'Agent 4')
        if ($ids.Count -lt 4) { throw "identifiants de panneaux illisibles ($($ids.Count) trouves)" }
        for ($i = 0; $i -lt 4; $i++) { & $herdrTrouve pane rename $ids[$i] $noms[$i] 2>&1 | Out-Null }
        Dire "Panneaux crees et nommes : $($noms -join ', ') (identifiants $($ids[0..3] -join ', '))."
        Noter 'Panneaux Herdr : 4 panneaux crees et nommes.'
      } catch {
        Dire "La creation automatique n'a pas abouti : $($_.Exception.Message)"
        Dire 'Procedure manuelle (commandes verifiees de Herdr) :'
        Dire '  herdr workspace create --label "Bureau des agents"'
        Dire '  herdr pane list                      # reperer les identifiants, ex. w6:p1'
        Dire '  herdr pane split --direction right   # deuxieme panneau'
        Dire '  herdr pane split --direction down    # troisieme panneau'
        Dire '  herdr pane split --direction down    # quatrieme panneau'
        Dire '  herdr pane rename w6:p1 Chef         # puis Agent 2, Agent 3, Agent 4'
        Dire '  # optionnel : lancer un outil d''IA dans un panneau (non fait par ce script)'
        Dire '  # herdr agent start <nom> --kind claude --pane w6:p1'
        Dire '  # types verifies : pi, claude, codex, gemini, cursor, agy, opencode, copilot...'
        Noter 'Panneaux Herdr : procedure manuelle affichee.'
      }
    }
  } else { Noter 'Panneaux Herdr : non crees (refuse).' }
} else {
  Dire 'Herdr absent : l''espace de panneaux est ignore. Installez Herdr puis relancez ce script.'
  Noter 'Panneaux Herdr : ignores (Herdr absent).'
}
Dire ''

# --- 4. IA en ligne de commande (optionnelles) ---------------------------
Dire '--- 4. Outils d''IA en ligne de commande (entierement optionnels) ---'
Dire 'Aucune cle ni aucun jeton n''est demande ici. Si un outil vous demande de vous'
Dire 'connecter, faites-le dans son interface au premier lancement, jamais dans ce script.'
Dire ''

function Proposer-Outil([string]$nom, [string]$commande, [string]$detection, [string]$installation, [string]$lien) {
  Dire "### $nom"
  if (Get-Command $detection -ErrorAction SilentlyContinue) {
    Dire "$nom est deja installe (commande '$detection')."
    Noter "$nom : deja installe."
    Dire ''
    return
  }
  Dire "Commande d'installation officielle : $installation"
  if ($lien) { Dire "Documentation : $lien" }
  if (Confirmer "Installer $nom ?") {
    try {
      Executer "Installation de $nom." ([scriptblock]::Create($installation)) | Out-Null
      if (-not $DryRun) {
        Rafraichir-Path
        if (Get-Command $detection -ErrorAction SilentlyContinue) { Dire "$nom est installe."; Noter "$nom : installe." }
        else { Dire "$nom n'a pas ete detecte tout de suite. Ouvrez un nouveau terminal pour verifier."; Noter "$nom : a verifier." }
      } else { Noter "$nom : simulation de l'installation." }
    } catch {
      Dire "L'installation de $nom a echoue : $($_.Exception.Message)"
      Noter "$nom : installation echouee."
    }
  } else {
    Dire "$nom : non installe (refuse)."
    Noter "$nom : non installe (refuse)."
  }
  Dire ''
}

Proposer-Outil 'Claude Code' 'claude' 'claude' 'irm https://claude.ai/install.ps1 | iex' 'https://code.claude.com/docs'
Proposer-Outil 'Codex (OpenAI)' 'codex' 'codex' 'powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"' 'https://developers.openai.com/codex'
Proposer-Outil 'OpenCode' 'opencode' 'opencode' 'npm install -g opencode-ai' 'https://opencode.ai/docs'
Proposer-Outil 'Gemini CLI (Google)' 'gemini' 'gemini' 'npm install -g @google/gemini-cli' 'https://www.geminicli.com/docs/get-started/installation'

Dire '### Antigravity (Google)'
Dire 'La commande d''installation d''Antigravity CLI n''a pas pu etre verifiee :'
Dire 'nous ne la donnons donc pas. Suivez sa documentation officielle :'
Dire '  https://antigravity.google/product/antigravity-cli'
Dire '  https://antigravity.google/docs/cli/getting-started'
Dire 'Note : Google annonce que Gemini CLI cede la place a Antigravity CLI pour les'
Dire 'comptes gratuits et Google One : https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli'
Noter 'Antigravity : documentation seule (methode non verifiee).'
Dire ''

# --- 5. Extensions utiles (optionnelles) --------------------------------
Dire '--- 5. Extensions utiles pour ce projet (optionnelles) ---'
# Trois extensions verifiees sur le marche VS Code le 17 octobre 2026, avec
# leurs editeurs : yzhang.markdown-all-in-one (Yu Zhang), dbaeumer.vscode-eslint
# (Microsoft), esbenp.prettier-vscode (Prettier).
if (Confirmer 'Veux-tu voir la liste des extensions proposees pour ce projet ?') {
  Dire '  1. Markdown All in One : yzhang.markdown-all-in-one (Yu Zhang) : table des matieres et confort Markdown.'
  Dire '  2. ESLint : dbaeumer.vscode-eslint (Microsoft) : controle du JavaScript et du TypeScript.'
  Dire '  3. Prettier - Code formatter : esbenp.prettier-vscode (Prettier) : mise en forme coherente du code.'
  $extensions = @(
    @{ nom = 'Markdown All in One'; id = 'yzhang.markdown-all-in-one' },
    @{ nom = 'ESLint'; id = 'dbaeumer.vscode-eslint' },
    @{ nom = 'Prettier - Code formatter'; id = 'esbenp.prettier-vscode' }
  )
  $vscode = Get-Command code -ErrorAction SilentlyContinue
  if (-not $vscode) {
    Dire 'VS Code n''est pas detecte sur cet ordinateur : l''installation des extensions est ignoree.'
    Noter 'Extensions : ignorees (VS Code absent).'
  } else {
    foreach ($ext in $extensions) {
      if (Confirmer "Installer l'extension $($ext.nom) ($($ext.id)) ?" -Individuel) {
        try {
          Executer "Installation de $($ext.id) avec code --install-extension." { & $vscode.Source --install-extension $ext.id }
          Noter "Extension $($ext.id) : installee."
        } catch {
          Dire "L'installation de $($ext.id) a echoue : $($_.Exception.Message)"
          Noter "Extension $($ext.id) : echec."
        }
      } else { Noter "Extension $($ext.id) : refusee." }
    }
  }
} else { Noter 'Extensions : liste non demandee.' }
Dire ''

# --- 6. Configuration ---------------------------------------------------
Dire '--- 6. Configuration du bureau ---'
$portChoisi = 0
$portActuel = [Environment]::GetEnvironmentVariable('BUREAU_PORT', 'User')
if ($Port -gt 0) { $portChoisi = $Port }
elseif ($portActuel -match '^\d+$') { $portChoisi = [int]$portActuel; Dire "Port deja enregistre : $portChoisi" }
else { $portChoisi = 4317 }

if ($Port -eq 0 -and -not $DryRun) {
  if (Confirmer "Utiliser le port $portChoisi pour le bureau ?") { }
  else {
    while ($true) {
      $saisie = Read-Host 'Entrez un port entre 1024 et 65535'
      if ($saisie -match '^\d+$') {
        $valeur = [int]$saisie
        if ($valeur -ge 1024 -and $valeur -le 65535) { $portChoisi = $valeur; break }
      }
      Dire 'Port invalide.'
    }
  }
}
if ($portChoisi -lt 1024 -or $portChoisi -gt 65535) { $portChoisi = 4317 }
if ("$portActuel" -ne "$portChoisi") {
  Executer "Enregistrement de BUREAU_PORT = $portChoisi (variable de l'utilisateur)." {
    [Environment]::SetEnvironmentVariable('BUREAU_PORT', "$portChoisi", 'User')
  } | Out-Null
  Noter "BUREAU_PORT : $portChoisi."
} else {
  Dire "BUREAU_PORT deja enregistre ($portChoisi). Rien a faire."
  Noter "BUREAU_PORT : deja a $portChoisi."
}

if (-not $SansRaccourci) {
  $bureau = [Environment]::GetFolderPath('Desktop')
  $lienRaccourci = Join-Path $bureau 'Ouvrir le bureau.lnk'
  # Nouveau choix : le raccourci lance Herdr directement, ou le bureau ouvert
  # dans le navigateur. Le lanceur « Ouvrir le bureau.cmd » existant est reutilise
  # pour ce second cas : aucun doublon n'est cree.
  $choixLanceur = 'bureau'
  if ($DryRun) {
    Simuler 'Question du raccourci : 1 = Herdr, 2 = le bureau dans le navigateur (defaut 2).'
  } elseif ($Oui) {
    Dire 'Raccourci : choix automatique « le bureau » (-Oui).'
  } else {
    $saisie = Read-Host 'Que doit lancer le raccourci du Bureau ? 1 = Herdr, 2 = le bureau dans le navigateur (defaut 2)'
    if ($saisie.Trim() -eq '1') { $choixLanceur = 'herdr' }
  }
  if ($choixLanceur -eq 'herdr') {
    $cible = $herdrTrouve
    if (-not $cible) { $cible = Chercher-Herdr }
    if (-not $cible) {
      Dire 'Herdr est introuvable : le raccourci Herdr est ignore.'
      Noter 'Raccourci : Herdr absent.'
    } elseif (Confirmer 'Creer le raccourci « Ouvrir le bureau » qui lance Herdr ?') {
      Executer "Creation du raccourci $lienRaccourci (lance Herdr)." {
        $wsh = New-Object -ComObject WScript.Shell
        $raccourci = $wsh.CreateShortcut($lienRaccourci)
        $raccourci.TargetPath = $cible
        $raccourci.WorkingDirectory = $racine
        $raccourci.Save()
      } | Out-Null
      Noter 'Raccourci : cree sur le Bureau (lance Herdr).'
    } else { Noter 'Raccourci : non cree (refuse).' }
  } else {
    $cible = Join-Path $racine 'Ouvrir le bureau.cmd'
    if (-not (Test-Path $cible)) {
      Dire "Le lanceur 'Ouvrir le bureau.cmd' est absent du projet : raccourci ignore."
      Noter 'Raccourci : lanceur absent.'
    } else {
      $dejaLa = Test-Path $lienRaccourci
      $question = if ($dejaLa) { 'Le raccourci existe deja sur le Bureau. Le remplacer ?' } else { 'Creer le raccourci « Ouvrir le bureau » qui ouvre le bureau dans le navigateur ?' }
      if (Confirmer $question) {
        Executer "Creation du raccourci $lienRaccourci." {
          $wsh = New-Object -ComObject WScript.Shell
          $raccourci = $wsh.CreateShortcut($lienRaccourci)
          $raccourci.TargetPath = $cible
          $raccourci.WorkingDirectory = $racine
          $raccourci.Save()
        } | Out-Null
        Noter 'Raccourci : cree sur le Bureau.'
      } else { Noter 'Raccourci : non cree (refuse).' }
    }
  }
}
Dire ''

# --- 7. Tests -----------------------------------------------------------
Dire '--- 7. Tests du projet ---'
if (-not $nodeOk) {
  Dire 'Node.js manquant ou trop ancien : tests ignores. Relancez ce script apres installation.'
  Noter 'Tests : ignores (Node.js absent).'
} else {
  if (Confirmer 'Lancer npm test et npm run check maintenant ?') {
    try {
      Executer 'Execution de npm test.' {
        Push-Location $racine
        try { npm test } finally { Pop-Location }
      } | Out-Null
      Executer 'Execution de npm run check.' {
        Push-Location $racine
        try { npm run check } finally { Pop-Location }
      } | Out-Null
      Noter 'Tests : executes.'
    } catch {
      Dire "Les tests ont echoue : $($_.Exception.Message)"
      Noter 'Tests : echec.'
    }
  } else { Noter 'Tests : non executes (refuse).' }
}
Dire ''

# --- Resume -------------------------------------------------------------
Dire '=== Resume ==='
if ($rapport.Count -eq 0) { Dire 'Rien a signaler.' }
else { foreach ($ligne in $rapport) { Dire " - $ligne" } }
Dire ''
Dire "Pour ouvrir le bureau : double-cliquez sur 'Ouvrir le bureau.cmd' dans $racine"
Dire "ou lancez 'node server.mjs' puis ouvrez http://127.0.0.1:$portChoisi"
Dire 'Herdr doit etre ouvert pour que le bureau voie vos agents.'
