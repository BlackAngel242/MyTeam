#!/usr/bin/env bash
# Installe les prerequis du Bureau des agents sur macOS et Linux.
#
# Verifie Node.js, Herdr et les outils d'IA en ligne de commande, propose chaque
# installation avec une confirmation (o/n), prepare un espace Herdr a 4 panneaux
# (le premier = chef), propose les extensions utiles du projet, configure le port
# et le chemin de Herdr, peut creer le raccourci « Ouvrir le bureau » (au choix :
# Herdr ou le bureau dans le navigateur), puis lance npm test et npm run check.
# Relancable sans degat : le script verifie avant d'agir.
# Aucune cle API ni aucun jeton n'est demande, lu ou enregistre.
#
# Usage : bash scripts/installer.sh [options]
#   --dry-run            Simulation : affiche les actions sans rien executer.
#   --oui                Accepte sauf toute installation (Node.js, Herdr, outils, extensions) (o/n obligatoire).
#   --port <numero>      Port du bureau (defaut : 4317 ou valeur existante).
#   --herdr-chemin <fichier>  Chemin de herdr s'il n'est pas dans le PATH.
#   --sans-raccourci     Ne propose pas le raccourci « Ouvrir le bureau ».
#   --aide               Affiche cette aide.
#   --lang fr|en         Langue des messages (sinon langue du système).

DRY_RUN=0
OUI=0
PORT=""
HERDR_CHEMIN=""
SANS_RACCOURCI=0
LANGUE="${LC_ALL:-${LC_MESSAGES:-${LANG:-en}}}"
case "$LANGUE" in fr*) LANGUE=fr ;; *) LANGUE=en ;; esac
texte() {
  if [ "${LANGUE:-fr}" = en ]; then printf '%s' "$2"; else printf '%s' "$1"; fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --oui) OUI=1 ;;
    --port) PORT="${2:-}"; shift ;;
    --herdr-chemin) HERDR_CHEMIN="${2:-}"; shift ;;
    --sans-raccourci) SANS_RACCOURCI=1 ;;
    --lang)
      case "${2:-}" in fr|en) LANGUE="$2"; shift ;; *) printf 'Langue invalide / Invalid language: fr|en\n'; exit 1 ;; esac ;;
    --aide)
      if [ "$LANGUE" = en ]; then printf '%s\n' 'Agent desktop installer: --dry-run (preview), --oui (never confirms installations or agent launches), --port <1024..65535>, --herdr-chemin <file>, --sans-raccourci, --lang fr|en, --aide. Each installation needs individual confirmation.'; exit 0; fi
      sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "$(texte "Option inconnue : $1" "Unknown option: $1")"
      echo "$(texte 'Lancez : bash scripts/installer.sh --aide' 'Run: bash scripts/installer.sh --aide')"
      exit 1
      ;;
  esac
  shift
done

RACINE="$(cd "$(dirname "$0")/.." && pwd)"
RAPPORT=""

dire() { echo "$1"; }
simuler() { echo "[simulation] $1"; }
noter() { RAPPORT="$RAPPORT
 - $1"; }

confirmer() {
  if [ "$DRY_RUN" = "1" ]; then simuler "$(texte "$1 o/n : o (simule)" "$1 y/n : y (preview)")"; return 0; fi
  if [ "$OUI" = "1" ] && [ "${2:-}" != "individuel" ]; then dire "$(texte "$1 o/n : o (accepte automatiquement)" "$1 y/n : y (automatic)")"; return 0; fi
  while true; do
    printf '%s (%s) : ' "$1" "$(texte o/n y/n)"
    read -r reponse || return 1
    reponse=$(printf '%s' "$reponse" | tr '[:upper:]' '[:lower:]')
    case "$reponse" in
      o|oui) [ "${LANGUE:-fr}" = fr ] && return 0 ;;
      y|yes) [ "${LANGUE:-fr}" = en ] && return 0 ;;
      n|non|no) return 1 ;;
      *) dire "$(texte 'Repondez par o ou par n.' 'Please answer y or n.')" ;;
    esac
  done
}

executer() {
  if [ "$DRY_RUN" = "1" ]; then simuler "$1"; return 0; fi
  dire "$1"
  shift
  "$@"
}

# Les valeurs deviennent des donnees, jamais du code shell reinterprete.
literal_shell() {
  printf "'"
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
  printf "'"
}

argument_desktop() {
  case "$1" in *$'\n'*|*$'\r'*) return 1 ;; esac
  local valeur="$1"
  valeur=${valeur//\\/\\\\}
  valeur=${valeur//\"/\\\"}
  valeur=${valeur//\$/\\\$}
  valeur=${valeur//\`/\\\`}
  valeur=${valeur//%/%%}
  # Deux couches : argument Exec, puis valeur du fichier Desktop Entry.
  valeur=${valeur//\\/\\\\}
  printf '"%s"' "$valeur"
}

ecrire_lanceur() {
  local fichier="$1" choix="$2"
  {
    printf '#!/bin/bash\n'
    if [ "$choix" = "herdr" ]; then
      printf 'exec %s\n' "$(literal_shell "$HERDR_LANCEUR")"
    else
      printf 'cd -- %s || exit 1\n' "$(literal_shell "$RACINE")"
      printf 'export BUREAU_PORT=%s\n' "$(literal_shell "$PORT_CHOISI")"
      printf 'bureau_node=$(command -v node || command -v node.exe) || exit 1\n'
      printf '"$bureau_node" scripts/ouvrir-bureau.mjs || exit 1\n'
      if [ "$choix" = "ensemble" ]; then
        printf 'exec %s\n' "$(literal_shell "$HERDR_LANCEUR")"
      fi
    fi
  } > "$fichier"
  chmod +x "$fichier"
}

ecrire_desktop() {
  local fichier="$1" cible="$2" terminal="$3" argument
  argument=$(argument_desktop "$cible") || return 1
  printf '[Desktop Entry]\nType=Application\nName=Ouvrir le bureau\nExec=%s\nTerminal=%s\nCategories=Utility;\n' \
    "$argument" "$terminal" > "$fichier"
  chmod +x "$fichier"
}

installer_node() {
  case "$(gestionnaire_paquets)" in
    brew) brew install node ;;
    apt) sudo apt-get update && sudo apt-get install -y nodejs npm ;;
    dnf) sudo dnf install -y nodejs npm ;;
    *) return 1 ;;
  esac
}

installer_outil() {
  case "$1" in
    herdr) curl -fsSL https://herdr.dev/install.sh | sh ;;
    claude) curl -fsSL https://claude.ai/install.sh | bash ;;
    codex) curl -fsSL https://chatgpt.com/codex/install.sh | sh ;;
    opencode) curl -fsSL https://opencode.ai/install | bash ;;
    gemini) npm install -g @google/gemini-cli ;;
    *) return 1 ;;
  esac
}

version_node_majeure() {
  if ! command -v node >/dev/null 2>&1; then return 1; fi
  version=$(node --version 2>/dev/null) || return 1
  majeure=$(printf '%s' "$version" | sed 's/^v//' | cut -d. -f1)
  case "$majeure" in
    ''|*[!0-9]*) return 1 ;;
    *) echo "$majeure" ;;
  esac
}

gestionnaire_paquets() {
  if command -v brew >/dev/null 2>&1; then echo brew
  elif command -v apt-get >/dev/null 2>&1; then echo apt
  elif command -v dnf >/dev/null 2>&1; then echo dnf
  else echo aucun
  fi
}

commande_node() {
  case "$(gestionnaire_paquets)" in
    brew) echo 'brew install node' ;;
    apt) echo 'sudo apt-get update && sudo apt-get install -y nodejs npm' ;;
    dnf) echo 'sudo dnf install -y nodejs npm' ;;
    *) echo '' ;;
  esac
}

dire "$(texte '=== Bureau des agents : installation ===' '=== Agent desktop: installation ===')"
dire "$(texte "Dossier du projet : $RACINE" "Project folder: $RACINE")"
if [ "$DRY_RUN" = "1" ]; then dire "$(texte 'Mode simulation : rien ne sera installe ni modifie.' 'Preview mode: nothing will be installed or changed.')"; fi
dire ''

# --- 1. Node.js ---------------------------------------------------------
dire "$(texte '--- 1. Node.js (version 22 ou plus) ---' '--- 1. Node.js (version 22 or later) ---')"
MAJEURE=$(version_node_majeure || true)
if [ -n "$MAJEURE" ] && [ "$MAJEURE" -ge 22 ] 2>/dev/null; then
  dire "$(texte "Node.js est deja present (version majeure $MAJEURE). Rien a faire." "Node.js is already available (major version $MAJEURE). No action needed.")"
  noter "$(texte 'Node.js : deja present.' 'Node.js: already available.')"
else
  if [ -z "$MAJEURE" ]; then dire "$(texte 'Node.js est absent de cet ordinateur.' 'Node.js is missing from this computer.')"
  else dire "$(texte "Node.js est present mais trop ancien (version majeure $MAJEURE) : il faut la version 22 ou plus." "Node.js is available but too old (major version $MAJEURE): version 22 or later is required.")"; fi
  CMD_NODE=$(commande_node)
  if [ -n "$CMD_NODE" ] && confirmer "$(texte "Installer Node.js avec votre gestionnaire de paquets ($CMD_NODE) ?" "Install Node.js with your package manager ($CMD_NODE)?")" individuel; then
    executer "$(texte "Installation de Node.js : $CMD_NODE" "Installing Node.js: $CMD_NODE")" installer_node
    if [ "$DRY_RUN" != "1" ]; then
      MAJEURE=$(version_node_majeure || true)
      if [ -n "$MAJEURE" ] && [ "$MAJEURE" -ge 22 ] 2>/dev/null; then
        dire "$(texte "Node.js est maintenant installe (version majeure $MAJEURE)." "Node.js is now installed (major version $MAJEURE).")"
        noter "$(texte 'Node.js : installe.' 'Node.js: installed.')"
      else
        dire "$(texte "La version proposee reste trop ancienne ou Node.js manque encore." "The available version is still too old, or Node.js is still missing.")"
        dire "$(texte "Installez Node 22 ou plus depuis la page officielle : https://nodejs.org/en/download" "Install Node 22 or later from the official page: https://nodejs.org/en/download")"
        noter "$(texte 'Node.js : a installer depuis nodejs.org.' 'Node.js: install from nodejs.org.')"
      fi
    else
      noter "$(texte "Node.js : simulation de l'installation." "Node.js: preview of installation.")"
    fi
  else
    dire "$(texte 'Installez Node 22 ou plus depuis la page officielle : https://nodejs.org/en/download' 'Install Node 22 or later from the official page: https://nodejs.org/en/download')"
    noter "$(texte 'Node.js : non installe (refuse ou gestionnaire absent).' 'Node.js: not installed (declined or no package manager).')"
  fi
fi
NODE_OK=0
if [ "$DRY_RUN" = "1" ]; then NODE_OK=1
else
  MAJEURE=$(version_node_majeure || true)
  if [ -n "$MAJEURE" ] && [ "$MAJEURE" -ge 22 ] 2>/dev/null; then NODE_OK=1; fi
fi
dire ''

# --- 2. Herdr -----------------------------------------------------------
dire "$(texte '--- 2. Herdr (gestionnaire de terminaux) ---' '--- 2. Herdr (terminal manager) ---')"
chercher_herdr() {
  if [ -n "$HERDR_CHEMIN" ]; then
    # Nom littéral herdr ou herdr.exe : un autre exécutable n'est jamais pris pour Herdr.
    case "${HERDR_CHEMIN##*/}" in herdr|herdr.exe) [ -x "$HERDR_CHEMIN" ] && { echo "$HERDR_CHEMIN"; return 0; } ;; esac
    return 1
  fi
  if command -v herdr >/dev/null 2>&1; then command -v herdr; return 0; fi
  if [ -d "$HOME/.herdr/packages" ]; then
    trouve=$(find "$HOME/.herdr/packages" -type f \( -name herdr -o -name herdr.exe \) 2>/dev/null | head -n 1)
    if [ -n "$trouve" ]; then echo "$trouve"; return 0; fi
  fi
  return 1
}
HERDR_TROUVE=$(chercher_herdr || true)
if [ -n "$HERDR_TROUVE" ]; then
  dire "$(texte "Herdr est present : $HERDR_TROUVE" "Herdr is available: $HERDR_TROUVE")"
  noter "$(texte 'Herdr : deja present.' 'Herdr: already available.')"
  if ! command -v herdr >/dev/null 2>&1; then
    dire "$(texte "Herdr n'est pas dans le PATH : le bureau a besoin de la variable BUREAU_HERDR_PATH." "Herdr is not in PATH: the desktop needs the BUREAU_HERDR_PATH variable.")"
    if confirmer "$(texte 'Enregistrer BUREAU_HERDR_PATH avec ce chemin ?' 'Save BUREAU_HERDR_PATH with this path?')"; then
      HERDR_A_ENREGISTRER="$HERDR_TROUVE"
      dire "$(texte "BUREAU_HERDR_PATH sera enregistre dans votre profil : $HERDR_TROUVE" "BUREAU_HERDR_PATH will be saved in your profile: $HERDR_TROUVE")"
      noter "$(texte 'BUREAU_HERDR_PATH : a enregistrer (voir etape 4).' 'BUREAU_HERDR_PATH: pending (see configuration step).')"
    else
      HERDR_A_ENREGISTRER=""
      noter "$(texte 'BUREAU_HERDR_PATH : non enregistre (refuse).' 'BUREAU_HERDR_PATH: not saved (declined).')"
    fi
  else
    HERDR_A_ENREGISTRER=""
  fi
else
  HERDR_A_ENREGISTRER=""
  dire "$(texte 'Herdr est introuvable sur cet ordinateur.' 'Herdr could not be found on this computer.')"
  dire "$(texte "Methode d'installation officielle (documentation Herdr) :" "Official installation method (Herdr documentation):")"
  dire "$(texte '  macOS et Linux : curl -fsSL https://herdr.dev/install.sh | sh' '  macOS and Linux: curl -fsSL https://herdr.dev/install.sh | sh')"
  dire "$(texte '  Puis documentation complete : https://herdr.dev/docs/install/' '  Full documentation: https://herdr.dev/docs/install/')"
  if confirmer "$(texte 'Installer Herdr maintenant avec la commande officielle ci-dessus ?' 'Install Herdr now using the official command above?')" individuel; then
    executer "$(texte 'Installation de Herdr (script officiel https://herdr.dev/install.sh).' 'Installing Herdr (official script https://herdr.dev/install.sh).')" installer_outil herdr
    if [ "$DRY_RUN" != "1" ]; then
      HERDR_TROUVE=$(chercher_herdr || true)
      if [ -n "$HERDR_TROUVE" ]; then
        dire "$(texte "Herdr est maintenant installe : $HERDR_TROUVE" "Herdr is now installed: $HERDR_TROUVE")"
        noter "$(texte 'Herdr : installe.' 'Herdr: installed.')"
      else
        dire "$(texte "Herdr n'a pas ete detecte. Consultez https://herdr.dev/docs/install/ puis relancez ce script." "Herdr was not detected. See https://herdr.dev/docs/install/ and run this script again.")"
        noter "$(texte 'Herdr : a verifier.' 'Herdr: check required.')"
      fi
    else
      noter "$(texte "Herdr : simulation de l'installation officielle." "Herdr: preview of official installation.")"
    fi
  else
    dire "$(texte 'Herdr reste a installer. Documentation officielle : https://herdr.dev/docs/install/' 'Herdr still needs installing. Official documentation: https://herdr.dev/docs/install/')"
    dire "$(texte 'Le bureau ne fonctionnera pas sans Herdr ouvert.' 'The desktop requires Herdr to be open.')"
    noter "$(texte 'Herdr : non installe (refuse).' 'Herdr: not installed (declined).')"
  fi
fi
dire ''

# --- 3. Panneaux Herdr --------------------------------------------------
lire_panneaux() {
  local liste ids id
  liste=$("$HERDR_TROUVE" pane list --workspace "$1") || return 1
  ids=$(printf '%s' "$liste" | grep -oE '"pane_id"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]+:p[0-9]+"' | sed 's/.*"\([^"]*\)"$/\1/' | sort -u)
  [ -n "$ids" ] || return 1
  while read -r id; do case "$id" in "$1":p*) ;; *) return 1 ;; esac; done <<< "$ids"
  printf '%s\n' "$ids"
}

creer_grille_herdr() {
  local creation espace avant apres nouveau gauche droite colonne id i
  local ids=() noms=('Chef' 'Agent 2' 'Agent 3' 'Agent 4')
  creation=$("$HERDR_TROUVE" workspace create --label 'Bureau des agents') || return 1
  espace=$(printf '%s' "$creation" | grep -oE '"workspace_id"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]+"' | sed 's/.*"\([^"]*\)"$/\1/' | sort -u)
  [ -n "$espace" ] && [ "$(printf '%s\n' "$espace" | wc -l)" -eq 1 ] || return 1
  avant=$(lire_panneaux "$espace") || return 1
  [ "$(printf '%s\n' "$avant" | wc -l)" -eq 1 ] || return 1
  gauche="$avant"
  "$HERDR_TROUVE" pane split --pane "$gauche" --direction right --no-focus >/dev/null || return 1
  apres=$(lire_panneaux "$espace") || return 1
  nouveau=$(printf '%s\n' "$apres" | grep -Fxv -f <(printf '%s\n' "$avant"))
  [ -n "$nouveau" ] && [ "$(printf '%s\n' "$nouveau" | wc -l)" -eq 1 ] && [ "$(printf '%s\n' "$apres" | wc -l)" -eq 2 ] || return 1
  droite="$nouveau"; ids=("$gauche" "$droite")
  for colonne in "$gauche" "$droite"; do
    avant=$(lire_panneaux "$espace") || return 1
    "$HERDR_TROUVE" pane split --pane "$colonne" --direction down --no-focus >/dev/null || return 1
    apres=$(lire_panneaux "$espace") || return 1
    nouveau=$(printf '%s\n' "$apres" | grep -Fxv -f <(printf '%s\n' "$avant"))
    [ -n "$nouveau" ] && [ "$(printf '%s\n' "$nouveau" | wc -l)" -eq 1 ] || return 1
    [ "$(printf '%s\n' "$apres" | wc -l)" -eq "$(( $(printf '%s\n' "$avant" | wc -l) + 1 ))" ] || return 1
    ids+=("$nouveau")
  done
  for i in 0 1 2 3; do "$HERDR_TROUVE" pane rename "${ids[$i]}" "${noms[$i]}" >/dev/null || return 1; done
  printf '%s\n' "${ids[@]}"
}

detecter_outils() {
  local type
  for type in pi claude codex gemini cursor devin agy cline omp mastracode opencode copilot kimi kiro droid amp grok hermes kilo qodercli qwen letta maki muse; do
    command -v "$type" >/dev/null 2>&1 && printf '%s\n' "$type"
  done
  return 0
}

proposer_agents() {
  [ "$OUI" = 1 ] && { dire "$(texte 'Le mode --oui ne lance aucun agent.' 'The --oui option never starts an agent.')"; return 0; }
  local outils=() panneaux=() noms=('Chef' 'Agent 2' 'Agent 3' 'Agent 4') type pane i=0 j choix liste
  liste=$(detecter_outils)
  [ -n "$liste" ] || { dire "$(texte 'Aucun outil compatible détecté : aucun agent lancé.' 'No supported tools detected: no agent started.')"; return 0; }
  while read -r type; do outils+=("$type"); done <<< "$liste"
  while read -r pane; do panneaux+=("$pane"); done <<< "$1"
  for pane in "${panneaux[@]}"; do
    if [ "$DRY_RUN" = 1 ]; then simuler "$(texte "Choix et confirmation de l'outil pour ${noms[$i]}." "Choose and confirm a tool for ${noms[$i]}.")"; i=$((i+1)); continue; fi
    dire "$(texte "Panneau ${noms[$i]} : outils détectés" "Pane ${noms[$i]}: detected tools")"
    for ((j=0;j<${#outils[@]};j++)); do dire "$((j+1)). ${outils[$j]}"; done
    printf '%s : ' "$(texte 'Numéro de l’outil (0 ou Entrée pour ignorer)' 'Tool number (0 or Enter to skip)')"
    read -r choix || choix=0
    if [[ "$choix" =~ ^[0-9]{1,2}$ ]] && [ "$choix" -ge 1 ] && [ "$choix" -le "${#outils[@]}" ]; then
      type="${outils[$((10#$choix-1))]}"
      if command -v "$type" >/dev/null 2>&1 && confirmer "$(texte "Lancer $type dans le panneau ${noms[$i]} ?" "Start $type in pane ${noms[$i]}?")" individuel; then
        if "$HERDR_TROUVE" agent start "${noms[$i]}" --kind "$type" --pane "$pane" >/dev/null; then
          if [ -z "${CHEF_PANE:-}" ]; then CHEF_PANE="$pane"; CHEF_TYPE="$type"; fi
          noter "$(texte "$type : lancement confirmé par Herdr." "$type: launch confirmed by Herdr.")"
        else dire "$(texte "Le lancement de $type n’a pas été confirmé. Consultez le panneau avant de réessayer." "Launch of $type was not confirmed. Check the pane before trying again.")"; fi
      fi
    fi
    i=$((i+1))
  done
}

dire "$(texte '--- 3. Espace Herdr avec 4 panneaux (le premier = chef) ---' '--- 3. Herdr workspace with 4 panes (first pane = chief) ---')"
# Commandes verifiées dans l'aide de Herdr 0.9.5 : herdr workspace create,
# herdr pane split, herdr pane rename, herdr agent start <nom> --kind <type>
# --pane <id>. NON VERIFIÉ : le format exact des sorties de ces commandes.
# Si une commande échoue ou si sa sortie n'est pas lisible, la procédure
# manuelle est affichée au lieu d'échouer silencieusement.
# Aucun outil d'IA n'est lancé sans choix et confirmation individuelle.
if [ -n "$HERDR_TROUVE" ]; then
  if confirmer "$(texte 'Créer un espace Herdr « Bureau » avec 4 panneaux (le premier = chef) ?' 'Create a Herdr workspace called Bureau with 4 panes (first pane = chief)?')"; then
    if [ "$DRY_RUN" = "1" ]; then
      simuler "$(texte "Création de l'espace « Bureau des agents » puis 3 découpes de panneaux." "Creating the Agent desktop workspace, then splitting it into four panes.")"
      simuler "$(texte 'Nommage des panneaux : Chef, Agent 2, Agent 3, Agent 4.' 'Pane names: Chef, Agent 2, Agent 3, Agent 4.')"
      noter "$(texte 'Panneaux Herdr : simulation.' 'Herdr panes: preview.')"
    else
      panneaux_ok=0
      ids=$(creer_grille_herdr) && panneaux_ok=1
      if [ "$panneaux_ok" = "1" ]; then
        dire "$(texte 'Panneaux créés et nommés : Chef, Agent 2, Agent 3, Agent 4.' 'Panes created and named: Chef, Agent 2, Agent 3, Agent 4.')"
        noter "$(texte 'Panneaux Herdr : 4 panneaux créés et nommés.' 'Herdr panes: 4 panes created and named.')"
        proposer_agents "$ids"
      fi
      if [ "$panneaux_ok" = "0" ]; then
        dire "$(texte "La création automatique n'a pas abouti." "Automatic creation failed.")"
        dire "$(texte 'Procédure manuelle (commandes vérifiées de Herdr) :' 'Manual procedure (verified Herdr commands):')"
        dire '  herdr workspace create --label "Bureau des agents"'
        dire "$(texte '  herdr pane list                      # repérer les identifiants, ex. w6:p1' '  herdr pane list                      # find pane identifiers, e.g. w6:p1')"
        dire '  herdr pane split --pane w6:p1 --direction right'
        dire '  herdr pane split --pane w6:p1 --direction down'
        dire '  herdr pane split --pane w6:p2 --direction down'
        dire "$(texte '  herdr pane rename w6:p1 Chef         # puis Agent 2, Agent 3, Agent 4' '  herdr pane rename w6:p1 Chef         # then Agent 2, Agent 3, Agent 4')"
        dire "$(texte "  # optionnel : lancer un outil d'IA dans un panneau (non fait par ce script)" "  # optional: start an AI tool in a pane")"
        dire "$(texte '  # herdr agent start <nom> --kind claude --pane w6:p1' '  # herdr agent start <name> --kind claude --pane w6:p1')"
        dire "$(texte '  # types vérifiés : pi, claude, codex, gemini, cursor, agy, opencode, copilot...' '  # verified types: pi, claude, codex, gemini, cursor, agy, opencode, copilot...')"
        noter "$(texte 'Panneaux Herdr : procédure manuelle affichée.' 'Herdr panes: manual procedure displayed.')"
      fi
    fi
  else
    noter "$(texte 'Panneaux Herdr : non créés (refus).' 'Herdr panes: not created (declined).')"
  fi
else
  dire "$(texte "Herdr absent : l'espace de panneaux est ignoré. Installez Herdr puis relancez ce script." "Herdr is missing: workspace skipped. Install Herdr and run this script again.")"
  noter "$(texte 'Panneaux Herdr : ignorés (Herdr absent).' 'Herdr panes: skipped (Herdr missing).')"
fi
dire ''

# --- 4. IA en ligne de commande (optionnelles) ---------------------------
dire "$(texte "--- 4. Outils d'IA en ligne de commande (entierement optionnels) ---" "--- 4. Command-line AI tools (entirely optional) ---")"
dire "$(texte "Aucune cle ni aucun jeton n'est demande ici. Si un outil vous demande de vous" "No key or token is requested here. If a tool asks you to sign in,")"
dire "$(texte 'connecter, faites-le dans son interface au premier lancement, jamais dans ce script.' 'use its own interface when you first open it, never this script.')"
dire ''

proposer_outil() {
  nom="$1"; detection="$2"; installation="$3"; lien="$4"; lien2="${5:-}"
  dire "### $nom"
  if command -v "$detection" >/dev/null 2>&1; then
    dire "$(texte "$nom est deja installe (commande '$detection')." "$nom is already installed (command $detection).")"
    noter "$(texte "$nom : deja installe." "$nom: already installed.")"
    dire ''
    return
  fi
  dire "$(texte "Commande d'installation officielle : $installation" "Official installation command: $installation")"
  [ -n "$lien" ] && dire "$(texte "Documentation : $lien" "Documentation: $lien")"
  [ -n "$lien2" ] && dire "$(texte "Documentation complémentaire : $lien2" "Additional documentation: $lien2")"
  if confirmer "$(texte "Installer $nom ?" "Install $nom?")" individuel; then
    executer "$(texte "Installation de $nom : $installation" "Installing $nom: $installation")" installer_outil "$detection"
    if [ "$DRY_RUN" != "1" ]; then
      if command -v "$detection" >/dev/null 2>&1; then
        dire "$(texte "$nom est installe." "$nom is installed.")"
        noter "$(texte "$nom : installe." "$nom: installed.")"
      else
        dire "$(texte "$nom n'a pas ete detecte tout de suite. Ouvrez un nouveau terminal pour verifier." "$nom was not detected yet. Open a new terminal to check.")"
        noter "$(texte "$nom : a verifier." "$nom: check required.")"
      fi
    else
      noter "$(texte "$nom : simulation de l'installation." "$nom: preview of installation.")"
    fi
  else
    dire "$(texte "$nom : non installe (refuse)." "$nom: not installed (declined).")"
    noter "$(texte "$nom : non installe (refuse)." "$nom: not installed (declined).")"
  fi
  dire ''
}

proposer_outil 'Claude Code' 'claude' 'curl -fsSL https://claude.ai/install.sh | bash' 'https://code.claude.com/docs'
proposer_outil 'Codex (OpenAI)' 'codex' 'curl -fsSL https://chatgpt.com/codex/install.sh | sh' 'https://developers.openai.com/codex'
proposer_outil 'OpenCode' 'opencode' 'curl -fsSL https://opencode.ai/install | bash' 'https://opencode.ai/docs' 'Alternative avec Node.js : npm install -g opencode-ai'
proposer_outil 'Gemini CLI (Google)' 'gemini' 'npm install -g @google/gemini-cli' 'https://www.geminicli.com/docs/get-started/installation' 'Alternative : brew install gemini-cli'

dire '### Antigravity (Google)'
dire "$(texte "La commande d'installation d'Antigravity CLI n'a pas pu etre verifiee :" "The Antigravity CLI installation command could not be verified:")"
dire "$(texte 'nous ne la donnons donc pas. Suivez sa documentation officielle :' 'it is not provided here. Follow the official documentation:')"
dire '  https://antigravity.google/product/antigravity-cli'
dire '  https://antigravity.google/docs/cli/getting-started'
dire "$(texte 'Note : Google annonce que Gemini CLI cede la place a Antigravity CLI pour les' 'Note: Google announces a transition from Gemini CLI to Antigravity CLI for')"
dire "$(texte 'comptes gratuits et Google One :' 'free and Google One accounts:')"
dire '  https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli'
noter "$(texte 'Antigravity : documentation seule (methode non verifiee).' 'Antigravity: documentation only (method not verified).')"
dire ''

# --- 5. Extensions utiles (optionnelles) --------------------------------
dire "$(texte '--- 5. Extensions utiles pour ce projet (optionnelles) ---' '--- 5. Useful project extensions (optional) ---')"
# Trois extensions vérifiées sur le marché VS Code le 17 octobre 2026, avec
# leurs éditeurs : yzhang.markdown-all-in-one (Yu Zhang), dbaeumer.vscode-eslint
# (Microsoft), esbenp.prettier-vscode (Prettier).
if confirmer "$(texte 'Veux-tu voir la liste des extensions proposées pour ce projet ?' 'Would you like to see the suggested project extensions?')"; then
  dire "$(texte '  1. Markdown All in One : yzhang.markdown-all-in-one (Yu Zhang) : table des matières et confort Markdown.' '  1. Markdown All in One: yzhang.markdown-all-in-one (Yu Zhang): contents and Markdown editing.')"
  dire "$(texte '  2. ESLint : dbaeumer.vscode-eslint (Microsoft) : contrôle du JavaScript et du TypeScript.' '  2. ESLint: dbaeumer.vscode-eslint (Microsoft): JavaScript and TypeScript checks.')"
  dire "$(texte '  3. Prettier - Code formatter : esbenp.prettier-vscode (Prettier) : mise en forme cohérente du code.' '  3. Prettier - Code formatter: esbenp.prettier-vscode (Prettier): consistent code formatting.')"
  if ! command -v code >/dev/null 2>&1; then
    dire "$(texte "VS Code n'est pas détecté sur cet ordinateur : l'installation des extensions est ignorée." "VS Code was not detected: extension installation skipped.")"
    noter "$(texte 'Extensions : ignorées (VS Code absent).' 'Extensions: skipped (VS Code missing).')"
  else
    for ext in 'Markdown All in One|yzhang.markdown-all-in-one' 'ESLint|dbaeumer.vscode-eslint' 'Prettier - Code formatter|esbenp.prettier-vscode'; do
      nom="${ext%%|*}"; id="${ext##*|}"
      if confirmer "$(texte "Installer l'extension $nom ($id) ?" "Install extension $nom ($id)?")" individuel; then
        executer "$(texte "Installation de $id avec code --install-extension." "Installing $id with code --install-extension.")" code --install-extension "$id"
        noter "$(texte "Extension $id : proposée à l'installation." "Extension $id: installation offered.")"
      else
        noter "$(texte "Extension $id : refusée." "Extension $id: declined.")"
      fi
    done
  fi
else
  noter "$(texte 'Extensions : liste non demandée.' 'Extensions: list not requested.')"
fi
dire ''

# --- 6. Configuration ---------------------------------------------------
dire "$(texte '--- 6. Configuration du bureau ---' '--- 6. Desktop configuration ---')"
FICHIERS_PROFIL=("$HOME/.profile")
[ -f "$HOME/.bashrc" ] && FICHIERS_PROFIL+=("$HOME/.bashrc")

PORT_CHOISI=""
if [ -n "$PORT" ]; then PORT_CHOISI="$PORT"
else
  existant=$(sed -n 's/^export BUREAU_PORT="\([0-9]*\)"$/\1/p' "$HOME/.profile" 2>/dev/null | tail -n 1)
  if [ -n "$existant" ]; then
    PORT_CHOISI="$existant"
    dire "$(texte "Port deja enregistre : $PORT_CHOISI" "Previously saved port: $PORT_CHOISI")"
  else
    PORT_CHOISI="4317"
  fi
fi

if [ -z "$PORT" ] && [ "$DRY_RUN" != "1" ]; then
  if ! confirmer "$(texte "Utiliser le port $PORT_CHOISI pour le bureau ?" "Use port $PORT_CHOISI for the desktop?")"; then
    while true; do
      printf '%s : ' "$(texte 'Entrez un port entre 1024 et 65535' 'Enter a port between 1024 and 65535')"
      read -r saisie
      case "$saisie" in
        ''|*[!0-9]*) dire "$(texte 'Port invalide.' 'Invalid port.')" ;;
        *)
          if [ "$saisie" -ge 1024 ] && [ "$saisie" -le 65535 ]; then PORT_CHOISI="$saisie"; break; fi
          dire "$(texte 'Port invalide.' 'Invalid port.')"
          ;;
      esac
    done
  fi
fi
case "$PORT_CHOISI" in
  ''|*[!0-9]*) PORT_CHOISI="4317" ;;
esac
if [ "$PORT_CHOISI" -lt 1024 ] || [ "$PORT_CHOISI" -gt 65535 ]; then PORT_CHOISI="4317"; fi

ecrire_profil() {
  bloc="# >>> bureau-des-agents >>>
export BUREAU_PORT=\"$PORT_CHOISI\""
  if [ -n "$HERDR_A_ENREGISTRER" ]; then
    bloc="$bloc
export BUREAU_HERDR_PATH=$(literal_shell "$HERDR_A_ENREGISTRER")"
  fi
  bloc="$bloc
# <<< bureau-des-agents <<<"
  for fichier in "${FICHIERS_PROFIL[@]}"; do
    if [ "$DRY_RUN" = "1" ]; then
      simuler "$(texte "Mise a jour du bloc de configuration dans $fichier (BUREAU_PORT=$PORT_CHOISI)." "Updating configuration block in $fichier (BUREAU_PORT=$PORT_CHOISI).")"
      continue
    fi
    tmp="$fichier.bureau.tmp"
    if [ -f "$fichier" ]; then
      awk '/# >>> bureau-des-agents >>>/{ignorer=1} /# <<< bureau-des-agents <<</{ignorer=0; next} !ignorer' "$fichier" > "$tmp"
    else
      : > "$tmp"
    fi
    printf '%s\n' "$bloc" >> "$tmp"
    mv "$tmp" "$fichier"
    dire "$(texte "Configuration ecrite dans $fichier." "Configuration written to $fichier.")"
  done
}
ecrire_profil
noter "$(texte "BUREAU_PORT : $PORT_CHOISI (ecrit dans le profil)." "BUREAU_PORT: $PORT_CHOISI (saved in profile).")"
if [ -n "$HERDR_A_ENREGISTRER" ]; then noter "$(texte "BUREAU_HERDR_PATH : $HERDR_A_ENREGISTRER (ecrit dans le profil)." "BUREAU_HERDR_PATH: $HERDR_A_ENREGISTRER (saved in profile).")"; fi

if [ "$SANS_RACCOURCI" != "1" ]; then
  if command -v xdg-user-dir >/dev/null 2>&1; then
    DOSSIER_BUREAU=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
  elif [ -d "$HOME/Desktop" ]; then
    DOSSIER_BUREAU="$HOME/Desktop"
  elif [ -d "$HOME/Bureau" ]; then
    DOSSIER_BUREAU="$HOME/Bureau"
  else
    DOSSIER_BUREAU="$HOME"
  fi
  # Nouveau choix : le raccourci lance Herdr directement, ou le bureau ouvert
  # dans le navigateur. Le lanceur existant est réutilisé pour ce second cas :
  # aucun doublon n'est créé.
  CHOIX_LANCEUR='bureau'
  if [ "$DRY_RUN" = "1" ]; then
    simuler "$(texte 'Question du raccourci : 1 = Herdr, 2 = le bureau dans le navigateur, 3 = Herdr et bureau (défaut 2).' 'Shortcut choice: 1 = Herdr, 2 = desktop in browser, 3 = Herdr and desktop (default 2).')"
  elif [ "$OUI" = "1" ]; then
    dire "$(texte 'Raccourci : choix automatique « le bureau » (--oui).' 'Shortcut: automatic desktop choice (--oui).')"
  else
    printf '%s : ' "$(texte 'Que doit lancer le raccourci du Bureau ? 1 = Herdr, 2 = le bureau, 3 = Herdr et bureau (défaut 2)' 'What should the shortcut open? 1 = Herdr, 2 = desktop, 3 = Herdr and desktop (default 2)')"
    read -r choix_saisi
    [ "$choix_saisi" = "1" ] && CHOIX_LANCEUR='herdr'
    [ "$choix_saisi" = "3" ] && CHOIX_LANCEUR='ensemble'
  fi
  if [ "$CHOIX_LANCEUR" = "herdr" ]; then
    HERDR_LANCEUR="$HERDR_TROUVE"
    [ -z "$HERDR_LANCEUR" ] && HERDR_LANCEUR=$(command -v herdr 2>/dev/null || true)
    if [ -z "$HERDR_LANCEUR" ]; then
      dire "$(texte 'Herdr est introuvable : le raccourci Herdr est ignoré.' 'Herdr was not found: Herdr shortcut skipped.')"
      noter "$(texte 'Raccourci : Herdr absent.' 'Shortcut: Herdr missing.')"
    elif confirmer "$(texte 'Créer le raccourci « Ouvrir le bureau » qui lance Herdr ?' 'Create the Open desktop shortcut that starts Herdr?')"; then
      if [ "$(uname)" = "Darwin" ]; then
        RACCOURCI="$DOSSIER_BUREAU/Ouvrir le bureau.command"
        if [ "$DRY_RUN" = "1" ]; then
          simuler "$(texte "Création du raccourci $RACCOURCI (lance Herdr)." "Creating shortcut $RACCOURCI (starts Herdr).")"
        else
          ecrire_lanceur "$RACCOURCI" herdr
          dire "$(texte "Raccourci créé : $RACCOURCI" "Shortcut created: $RACCOURCI")"
        fi
      else
        RACCOURCI="$DOSSIER_BUREAU/ouvrir-le-bureau.desktop"
        if [ "$DRY_RUN" = "1" ]; then
          simuler "$(texte "Création du raccourci $RACCOURCI (lance Herdr)." "Creating shortcut $RACCOURCI (starts Herdr).")"
        else
          ecrire_desktop "$RACCOURCI" "$HERDR_LANCEUR" true || exit 1
          dire "$(texte "Raccourci créé : $RACCOURCI" "Shortcut created: $RACCOURCI")"
        fi
      fi
      noter "$(texte 'Raccourci : créé (lance Herdr).' 'Shortcut: created (starts Herdr).')"
    else
      noter "$(texte 'Raccourci : non créé (refus).' 'Shortcut: not created (declined).')"
    fi
  elif [ "$CHOIX_LANCEUR" = 'ensemble' ]; then
    HERDR_LANCEUR="$HERDR_TROUVE"
    if [ -z "$HERDR_LANCEUR" ]; then
      dire "$(texte 'Herdr absent : raccourci combiné ignoré.' 'Herdr missing: combined shortcut skipped.')"
    elif confirmer "$(texte 'Créer le raccourci « Herdr et bureau » ?' 'Create the Herdr and desktop shortcut?')"; then
      LANCEUR="$DOSSIER_BUREAU/Ouvrir le bureau.command"
      if [ "$DRY_RUN" = 1 ]; then
        simuler "$(texte 'Création du raccourci combiné, dans un terminal visible.' 'Creating the combined shortcut, in a visible terminal.')"
      else
        ecrire_lanceur "$LANCEUR" ensemble
        if [ "$(uname)" != Darwin ]; then ecrire_desktop "$DOSSIER_BUREAU/ouvrir-le-bureau.desktop" "$LANCEUR" true || exit 1; fi
      fi
    fi
  elif [ "$(uname)" = "Darwin" ]; then
    RACCOURCI="$DOSSIER_BUREAU/Ouvrir le bureau.command"
    question="$(texte 'Créer le raccourci « Ouvrir le bureau » qui ouvre le bureau dans le navigateur ?' 'Create the Open desktop shortcut that opens the browser?')"
    [ -f "$RACCOURCI" ] && question="$(texte "Le raccourci existe déjà. Le remplacer ($RACCOURCI) ?" "The shortcut already exists. Replace it ($RACCOURCI)?")"
    if confirmer "$question"; then
      if [ "$DRY_RUN" = "1" ]; then
        simuler "$(texte "Création du raccourci $RACCOURCI (lance node server.mjs puis ouvre le navigateur)." "Creating shortcut $RACCOURCI (starts node server.mjs then opens the browser).")"
      else
        ecrire_lanceur "$RACCOURCI" bureau
        dire "$(texte "Raccourci créé : $RACCOURCI" "Shortcut created: $RACCOURCI")"
      fi
      noter "$(texte 'Raccourci : créé.' 'Shortcut: created.')"
    else
      noter "$(texte 'Raccourci : non créé (refus).' 'Shortcut: not created (declined).')"
    fi
  else
    RACCOURCI="$DOSSIER_BUREAU/ouvrir-le-bureau.desktop"
    question="$(texte 'Créer le raccourci « Ouvrir le bureau » qui ouvre le bureau dans le navigateur ?' 'Create the Open desktop shortcut that opens the browser?')"
    [ -f "$RACCOURCI" ] && question="$(texte "Le raccourci existe déjà. Le remplacer ($RACCOURCI) ?" "The shortcut already exists. Replace it ($RACCOURCI)?")"
    if confirmer "$question"; then
      if [ "$DRY_RUN" = "1" ]; then
        simuler "$(texte "Création du raccourci $RACCOURCI (lance node server.mjs puis ouvre le navigateur)." "Creating shortcut $RACCOURCI (starts node server.mjs then opens the browser).")"
      else
        LANCEUR="$DOSSIER_BUREAU/Ouvrir le bureau.command"
        ecrire_lanceur "$LANCEUR" bureau
        ecrire_desktop "$RACCOURCI" "$LANCEUR" false || exit 1
        dire "$(texte "Raccourci créé : $RACCOURCI" "Shortcut created: $RACCOURCI")"
      fi
      noter "$(texte 'Raccourci : créé.' 'Shortcut: created.')"
    else
      noter "$(texte 'Raccourci : non créé (refus).' 'Shortcut: not created (declined).')"
    fi
  fi
fi
dire ''

# --- 7. Tests -----------------------------------------------------------
dire "$(texte '--- 7. Tests du projet ---' '--- 7. Project tests ---')"
if [ "$NODE_OK" != "1" ]; then
  dire "$(texte 'Node.js manquant ou trop ancien : tests ignores. Relancez ce script apres installation.' 'Node.js missing or too old: tests skipped. Run this script again after installing it.')"
  noter "$(texte 'Tests : ignores (Node.js absent).' 'Tests: skipped (Node.js missing).')"
elif confirmer "$(texte 'Lancer npm test et npm run check maintenant ?' 'Run npm test and npm run check now?')"; then
  (cd -- "$RACINE" && executer "$(texte 'Execution de npm test.' 'Running npm test.')" npm test)
  (cd -- "$RACINE" && executer "$(texte 'Execution de npm run check.' 'Running npm run check.')" npm run check)
  noter "$(texte 'Tests : executes.' 'Tests: completed.')"
else
  noter "$(texte 'Tests : non executes (refuse).' 'Tests: not run (declined).')"
fi
dire ''

proposer_kit() {
  [ "$OUI" = 1 ] && { dire "$(texte 'Le mode --oui ne crée aucun kit.' 'The --oui option never creates a kit.')"; return 0; }
  local script_kit="$RACINE/scripts/init-kit.mjs" dossier node_kit
  [ -f "$script_kit" ] || { dire "$(texte 'Kit indisponible : script absent.' 'Kit unavailable: script missing.')"; return 0; }
  confirmer "$(texte "Initialiser le kit d'équipe dans un projet ?" 'Initialize the team kit in a project?')" individuel || return 0
  if [ "$DRY_RUN" = 1 ]; then simuler "$(texte 'Choix du dossier puis initialisation du kit.' 'Choose a folder, then initialize the kit.')"; return 0; fi
  printf '%s : ' "$(texte 'Dossier du projet (Entrée pour ignorer)' 'Project folder (Enter to skip)')"
  read -r dossier || return 0
  [ -n "$dossier" ] || return 0
  case "$dossier" in --*) dossier="./$dossier" ;; esac
  node_kit=$(command -v node || command -v node.exe) || return 1
  if "$node_kit" "$script_kit" "$dossier" --lang "${LANGUE:-fr}"; then
    noter "$(texte "Kit d'équipe : initialisé." 'Team kit: initialized.')"
  else dire "$(texte "Le kit n'a pas été initialisé. Consultez le résultat ci-dessus." 'The kit was not initialized. Check the output above.')"; fi
}
proposer_kit

# --- Resume -------------------------------------------------------------
dire "$(texte '=== Resume ===' '=== Summary ===')"
if [ -z "$RAPPORT" ]; then dire "$(texte 'Rien a signaler.' 'Nothing to report.')"; else printf '%s\n' "$RAPPORT" | sed '/^ *$/d'; fi
dire ''
dire "$(texte "Pour ouvrir le bureau : lancez 'node server.mjs' dans $RACINE" "To open the desktop: run node server.mjs in $RACINE")"
dire "$(texte "puis ouvrez http://127.0.0.1:$PORT_CHOISI (ou utilisez le raccourci cree)." "then open http://127.0.0.1:$PORT_CHOISI (or use the shortcut).")"
dire "$(texte 'Herdr doit etre ouvert pour que le bureau voie vos agents.' 'Herdr must be open for the desktop to see your agents.')"
