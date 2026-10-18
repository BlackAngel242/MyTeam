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
#   --interface          Dialogue UTF-8 avec l'interface animée.

DRY_RUN=0
OUI=0
PORT=""
HERDR_CHEMIN=""
SANS_RACCOURCI=0
INTERFACE=0
LANGUE="${LC_ALL:-${LC_MESSAGES:-${LANG:-en}}}"
case "$LANGUE" in fr*) LANGUE=fr ;; *) LANGUE=en ;; esac
texte() {
  if [ "${LANGUE:-fr}" = en ]; then printf '%s' "$2"; else printf '%s' "$1"; fi
}
port_valide() {
  [[ "${1:-}" =~ ^[0-9]{4,5}$ ]] && [ "$1" -ge 1024 ] && [ "$1" -le 65535 ]
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --oui) OUI=1 ;;
    --port)
      if ! port_valide "${2:-}"; then
        printf '%s\n' "$(texte 'Port invalide : indiquez un nombre entre 1024 et 65535.' 'Invalid port: enter a number between 1024 and 65535.')" >&2
        exit 1
      fi
      PORT="$2"; shift ;;
    --herdr-chemin) HERDR_CHEMIN="${2:-}"; shift ;;
    --sans-raccourci) SANS_RACCOURCI=1 ;;
    --interface) INTERFACE=1 ;;
    --lang)
      case "${2:-}" in fr|en) LANGUE="$2"; shift ;; *) printf 'Langue invalide / Invalid language: fr|en\n'; exit 1 ;; esac ;;
    --aide)
      if [ "$LANGUE" = en ]; then printf '%s\n' 'Agent desktop installer: --dry-run (preview), --oui (never confirms installations or agent launches), --port <1024..65535>, --herdr-chemin <file>, --sans-raccourci, --interface, --lang fr|en, --aide. Each installation needs individual confirmation.'; exit 0; fi
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
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

champ_interface() {
  local valeur="$1"
  valeur=${valeur//$'\r'/ };valeur=${valeur//$'\n'/ };valeur=${valeur//$'\t'/ }
  [ -z "${RACINE:-}" ] || valeur=${valeur//"$RACINE"/[dossier]}
  [ -z "${HOME:-}" ] || valeur=${valeur//"$HOME"/[dossier]}
  if [[ "$valeur" =~ [[:cntrl:]]|(^|[^[:alnum:]_])[A-Za-z]:[\\/]|\~/|/(home|Users|root|tmp|private|mnt|media|Volumes)/|sk-|gh[pousr]_|github_pat_|Bearer ]]; then
    printf '%s' "$valeur" | sed -E 's@[[:cntrl:]]@ @g; s@(^|[^[:alnum:]_])[A-Za-z]:[\\/][^"<>|?*]+@\1[dossier]@g; s@(~[\\/]|/(home|Users|root|tmp|private|mnt|media|Volumes)/)[^"<>|?*]+@[dossier]@g; s@(sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{12,}|Bearer[[:space:]]+[A-Za-z0-9_.-]+@[masqué]@g'
  else printf '%s' "$valeur";fi
}

emettre_interface() {
  local type="$1" separateur=' ' champ;shift
  printf '@@%s' "$type"
  for champ in "$@"; do printf '%s' "$separateur";champ_interface "$champ";separateur=$'\t';done
  printf '\n'
}

etat_etape() {
  [ "${INTERFACE:-0}" = 1 ] || return 0
  local message="${2:-}"
  [ "$1" != fail ] || ECHEC_INTERFACE=1
  case "$ETAT_ETAPE:$1" in fail:ok|fail:skip|ok:skip) return 0 ;; esac
  if [ -z "$message" ] && [ "$ETAT_ETAPE" != "$1" ]; then
    case "$1" in ok) message=$(texte 'Effectué.' 'Done.');;fail) message=$(texte 'Erreur.' 'Error.');;esac
  fi
  ETAT_ETAPE="$1"
  [ -z "$message" ] || TEXTE_ETAPE="$message"
  return 0
}

fin_etape() {
  if [ "${INTERFACE:-0}" = 1 ] && [ -n "${ETAPE:-}" ]; then
    emettre_interface DONE "$ETAPE" "$ETAT_ETAPE" "$TEXTE_ETAPE"
    ETAPE=''
  fi
}

etape() {
  [ "${INTERFACE:-0}" = 1 ] || return 0
  fin_etape;ETAPE="$1";ETAT_ETAPE=skip;TEXTE_ETAPE=$(texte 'Non applicable.' 'Not applicable.');TOTAL_ETAPE=0;emettre_interface STEP "$ETAPE"
}

terminer_interface() {
  local code="$1"
  [ "${INTERFACE:-0}" = 1 ] || return 0
  [ "$code" = 0 ] || etat_etape fail
  fin_etape
  if [ "$ECHEC_INTERFACE" = 1 ]; then emettre_interface END fail;else emettre_interface END ok;fi
}

lire_interface() {
  local type="$1" question="$2";shift 2
  QUESTION_NUMERO=$((QUESTION_NUMERO+1))
  emettre_interface "$type" "q$QUESTION_NUMERO" "$question" "$@"
  REPONSE_INTERFACE=''
  IFS= read -r REPONSE_INTERFACE || { ENTREE_FERMEE=1;return 1; }
}

lire_saisie() {
  local question="$1" defaut="${2:-}"
  if [ "${INTERFACE:-0}" = 1 ]; then
    lire_interface INPUT "$question" "$defaut" || return 1
    [ -n "$REPONSE_INTERFACE" ] || REPONSE_INTERFACE="$defaut"
  else printf '%s : ' "$question";IFS= read -r REPONSE_INTERFACE;fi
}

choisir() {
  local question="$1";shift
  if [ "${INTERFACE:-0}" = 1 ]; then lire_interface CHOICE "$question" "$@"
  else printf '%s : ' "$question";IFS= read -r REPONSE_INTERFACE;fi
}

dire() {
  if [ "${INTERFACE:-0}" = 1 ];then emettre_interface INFO "$1";else echo "$1";fi
}
simuler() {
  if [ "${INTERFACE:-0}" = 1 ];then etat_etape skip "$(texte Simulation. Preview.)";dire "[simulation] $1";else echo "[simulation] $1";fi
}
noter() { RAPPORT="$RAPPORT
 - $1"; }

confirmer() {
  if [ "${INTERFACE:-0}" = 1 ]; then
    if lire_interface CONFIRM "$1" && [ "$REPONSE_INTERFACE" = o ];then return 0;fi
    etat_etape skip "$(texte Refusé. Declined.)";return 1
  fi
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
  if [ "${INTERFACE:-0}" = 1 ] && [ "${ENTREE_FERMEE:-0}" = 1 ];then etat_etape skip "$(texte 'Entrée fermée.' 'Input closed.')";dire "$(texte 'Entrée fermée : action ignorée.' 'Input closed: action skipped.')";return 0;fi
  if [ "$DRY_RUN" = "1" ]; then simuler "$1"; return 0; fi
  dire "$1"
  shift
  if [ "${INTERFACE:-0}" != 1 ];then "$@";return $?;fi
  if "$@";then
    case "$ETAPE" in config) etat_etape ok "$(texte 'Configuration enregistrée.' 'Configuration saved.')";;tests) etat_etape ok "$(texte 'Vérifications réussies.' 'Checks passed.')";;*) etat_etape ok "$(texte 'Installation confirmée.' 'Installation confirmed.')";;esac
  else etat_etape fail "$(texte 'Commande en échec.' 'Command failed.')";return 1;fi
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
  } > "$fichier" || return 1
  chmod +x "$fichier" || return 1
  [ "${INTERFACE:-0}" != 1 ] || etat_etape ok "$(texte 'Raccourci créé.' 'Shortcut created.')"
}

ecrire_desktop() {
  local fichier="$1" cible="$2" terminal="$3" argument
  argument=$(argument_desktop "$cible") || return 1
  printf '[Desktop Entry]\nType=Application\nName=Ouvrir le bureau\nExec=%s\nTerminal=%s\nCategories=Utility;\n' \
    "$argument" "$terminal" > "$fichier" || return 1
  chmod +x "$fichier" || return 1
  [ "${INTERFACE:-0}" != 1 ] || etat_etape ok "$(texte 'Raccourci créé.' 'Shortcut created.')"
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

if [ "$INTERFACE" = 1 ]; then
  QUESTION_NUMERO=0;ETAPE='';ETAT_ETAPE=skip;ECHEC_INTERFACE=0;ENTREE_FERMEE=0
  for id in node herdr panneaux outils chef extensions config kit tests; do
    case "$id" in
      node) libelle=$(texte 'Node.js 22 ou plus' 'Node.js 22 or later');;herdr) libelle=Herdr;;panneaux) libelle=$(texte 'Espace Herdr en grille 2×2' 'Herdr workspace in a 2×2 grid');;
      outils) libelle=$(texte "Outils d'IA" 'AI tools');;chef) libelle=$(texte 'Commandes du chef' 'Chief commands');;
      extensions) libelle=Extensions;;config) libelle=$(texte 'Configuration et raccourci' 'Configuration and shortcut');;kit) libelle=$(texte "Kit d'équipe" 'Team kit');;tests) libelle=$(texte Vérification Checks);;
    esac
    emettre_interface PLAN "$id" "$libelle"
  done
  trap 'terminer_interface $?' EXIT
fi
dire "$(texte '=== Bureau des agents : installation ===' '=== Agent desktop: installation ===')"
dire "$(texte "Dossier du projet : $RACINE" "Project folder: $RACINE")"
if [ "$DRY_RUN" = "1" ]; then dire "$(texte 'Mode simulation : rien ne sera installe ni modifie.' 'Preview mode: nothing will be installed or changed.')"; fi
dire ''

# --- 1. Node.js ---------------------------------------------------------
etape node
dire "$(texte '--- 1. Node.js (version 22 ou plus) ---' '--- 1. Node.js (version 22 or later) ---')"
MAJEURE=$(version_node_majeure || true)
if [ -n "$MAJEURE" ] && [ "$MAJEURE" -ge 22 ] 2>/dev/null; then
  etat_etape ok "Version $MAJEURE."
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
if [ "$INTERFACE" = 1 ] && [ "$ETAT_ETAPE" = ok ];then
  if [ -n "$MAJEURE" ] && [ "$MAJEURE" -ge 22 ];then etat_etape ok "Version $MAJEURE."
  else etat_etape fail "$(texte 'Version 22 ou plus non confirmée.' 'Version 22 or later not confirmed.')";fi
fi
dire ''

# --- 2. Herdr -----------------------------------------------------------
etape herdr
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
  etat_etape ok "$(texte 'Déjà présent.' 'Already available.')"
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
    choisir "$(texte 'Numéro de l’outil (0 ou Entrée pour ignorer)' 'Tool number (0 or Enter to skip)')" "$(texte Ignorer Skip)" "${outils[@]}" || REPONSE_INTERFACE=0
    choix="$REPONSE_INTERFACE"
    if [ "${INTERFACE:-0}" = 1 ] && [[ "$choix" =~ ^[0-9]{1,2}$ ]]; then choix=$((10#$choix-1));fi
    if [[ "$choix" =~ ^[0-9]{1,2}$ ]] && [ "$choix" -ge 1 ] && [ "$choix" -le "${#outils[@]}" ]; then
      type="${outils[$((10#$choix-1))]}"
      if command -v "$type" >/dev/null 2>&1 && confirmer "$(texte "Lancer $type dans le panneau ${noms[$i]} ?" "Start $type in pane ${noms[$i]}?")" individuel; then
        if "$HERDR_TROUVE" agent start "${noms[$i]}" --kind "$type" --pane "$pane" >/dev/null; then
          [ "${INTERFACE:-0}" != 1 ] || etat_etape ok
          if [ -z "${CHEF_PANE:-}" ]; then CHEF_PANE="$pane"; CHEF_TYPE="$type"; fi
          if [ "${INTERFACE:-0}" = 1 ];then TOTAL_ETAPE=$((TOTAL_ETAPE+1));etat_etape ok "$(texte "Outils lancés : $TOTAL_ETAPE." "Tools started: $TOTAL_ETAPE.")";fi
          noter "$(texte "$type : lancement confirmé par Herdr." "$type: launch confirmed by Herdr.")"
        else [ "${INTERFACE:-0}" != 1 ] || etat_etape fail;dire "$(texte "Le lancement de $type n’a pas été confirmé. Consultez le panneau avant de réessayer." "Launch of $type was not confirmed. Check the pane before trying again.")"; fi
      fi
    fi
    i=$((i+1))
  done
}

etape panneaux
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
        [ "$INTERFACE" != 1 ] || etat_etape ok "$(texte '4 panneaux créés.' '4 panes created.')"
        dire "$(texte 'Panneaux créés et nommés : Chef, Agent 2, Agent 3, Agent 4.' 'Panes created and named: Chef, Agent 2, Agent 3, Agent 4.')"
        noter "$(texte 'Panneaux Herdr : 4 panneaux créés et nommés.' 'Herdr panes: 4 panes created and named.')"
        proposer_agents "$ids"
      fi
      if [ "$panneaux_ok" = "0" ]; then
        [ "$INTERFACE" != 1 ] || etat_etape fail
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
  etat_etape skip "$(texte 'Herdr absent.' 'Herdr missing.')"
fi
dire ''

installer_competence_chef() {
  local dossier="$1/.claude/skills/herdr" cible="$1/.claude/skills/herdr/SKILL.md" parent contenu
  if [ -e "$cible" ] || [ -L "$cible" ]; then etat_etape ok "$(texte 'Compétence déjà présente.' 'Skill already available.')";dire "$(texte 'Compétence déjà présente : conservée.' 'Skill already exists: kept.')"; return 0; fi
  parent="$dossier"
  while [ "$parent" != / ] && [ -n "$parent" ]; do
    [ ! -L "$parent" ] || return 1
    parent=$(dirname "$parent")
  done
  confirmer "$(texte 'Ajouter les commandes Herdr au chef, sans remplacer de fichier ?' 'Add Herdr commands to the chief without replacing any file?')" individuel || return 0
  if [ "$DRY_RUN" = 1 ]; then simuler "$(texte 'Ajout de la compétence Herdr dans le dossier connu.' 'Add the Herdr skill to its known directory.')"; return 0; fi
  contenu=$("$HERDR_TROUVE" --skill) || return 1
  [ -n "$contenu" ] && [ "${#contenu}" -le 524288 ] || return 1
  mkdir -p "$dossier" || return 1
  (set -C; printf '%s' "$contenu" > "$cible") || return 1
  [ "${INTERFACE:-0}" != 1 ] || etat_etape ok "$(texte 'Compétence ajoutée.' 'Skill added.')"
}

proposer_chef() {
  [ "$OUI" = 1 ] && { etat_etape skip "$(texte 'Ignoré avec --oui.' 'Skipped with --oui.')";return 0; }
  [ -n "$HERDR_TROUVE" ] || { etat_etape skip "$(texte 'Herdr absent.' 'Herdr missing.')";return 0; }
  local personnel="${1:-$HOME}" outils=() liste type integration orientation
  liste=$(detecter_outils)
  if [ -n "$liste" ]; then while read -r type; do outils+=("$type"); done <<< "$liste"; fi
  for type in "${outils[@]}"; do
    integration="$type";[ "$type" = agy ] && integration=antigravity-cli
    case "$integration" in pi|omp|claude|codex|copilot|devin|droid|kimi|opencode|kilo|hermes|qodercli|qwen|letta|cursor|mastracode|antigravity-cli|grok) ;; *) continue ;; esac
    if confirmer "$(texte "Installer l'intégration Herdr pour $type ? Elle modifie la configuration de cet outil." "Install the Herdr integration for $type? It changes this tool's configuration.")" individuel; then
      if [ "$DRY_RUN" = 1 ]; then simuler "herdr integration install $integration"
      elif "$HERDR_TROUVE" integration install "$integration"; then etat_etape ok "$(texte 'Intégration installée.' 'Integration installed.')"
      else etat_etape fail;dire "$(texte "L'intégration de $type n'a pas été confirmée. Vérifiez avant de réessayer." "Integration for $type was not confirmed. Check before trying again.")"; fi
    fi
  done
  [ -n "${CHEF_PANE:-}" ] || { etat_etape skip "$(texte 'Aucun chef lancé.' 'No chief started.')";return 0; }
  if [ "$CHEF_TYPE" = claude ]; then
    installer_competence_chef "$personnel" || dire "$(texte 'Compétence non ajoutée : CHEF.md du kit suffit.' 'Skill not added: the kit CHEF.md is sufficient.')"
  else dire "$(texte 'Chemin de compétence non vérifié pour cet outil : CHEF.md du kit suffit.' 'Skill location not verified for this tool: the kit CHEF.md is sufficient.')"; fi
  orientation=$(texte "Tu es le chef de l'équipe. Lis AGENTS.md et CHEF.md, liste les agents avec \`herdr agent list\`, puis attends les instructions de DrSmoke." 'You are the team chief. Read AGENTS.md and CHEF.md, list agents with `herdr agent list`, then wait for instructions from DrSmoke.')
  dire "$orientation"
  if confirmer "$(texte 'Envoyer cette orientation au chef ?' 'Send this orientation to the chief?')" individuel; then
    if [ "$DRY_RUN" = 1 ]; then simuler "$(texte "Orientation du chef dans $CHEF_PANE." "Chief orientation in $CHEF_PANE.")"
    elif "$HERDR_TROUVE" agent prompt "$CHEF_PANE" "$orientation"; then etat_etape ok "$(texte 'Orientation envoyée.' 'Orientation sent.')"
    else etat_etape fail;dire "$(texte 'Envoi non confirmé : consultez le panneau avant de réessayer.' 'Send not confirmed: check the pane before trying again.')"; fi
  fi
}
[ "$INTERFACE" = 1 ] || proposer_chef

# --- 4. IA en ligne de commande (optionnelles) ---------------------------
etape outils
dire "$(texte "--- 4. Outils d'IA en ligne de commande (entierement optionnels) ---" "--- 4. Command-line AI tools (entirely optional) ---")"
dire "$(texte "Aucune cle ni aucun jeton n'est demande ici. Si un outil vous demande de vous" "No key or token is requested here. If a tool asks you to sign in,")"
dire "$(texte 'connecter, faites-le dans son interface au premier lancement, jamais dans ce script.' 'use its own interface when you first open it, never this script.')"
dire ''

proposer_outil() {
  nom="$1"; detection="$2"; installation="$3"; lien="$4"; lien2="${5:-}"
  dire "### $nom"
  if command -v "$detection" >/dev/null 2>&1; then
    if [ "${INTERFACE:-0}" = 1 ];then TOTAL_ETAPE=$((TOTAL_ETAPE+1));etat_etape ok "$(texte "Outils disponibles : $TOTAL_ETAPE." "Available tools: $TOTAL_ETAPE.")";fi
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
        if [ "${INTERFACE:-0}" = 1 ];then TOTAL_ETAPE=$((TOTAL_ETAPE+1));etat_etape ok "$(texte "Outils disponibles : $TOTAL_ETAPE." "Available tools: $TOTAL_ETAPE.")";fi
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
if [ "$INTERFACE" = 1 ]; then etape chef;proposer_chef;fi
etape extensions
dire "$(texte '--- 5. Extensions utiles pour ce projet (optionnelles) ---' '--- 5. Useful project extensions (optional) ---')"
# Trois extensions vérifiées sur le marché VS Code le 17 octobre 2026, avec
# leurs éditeurs : yzhang.markdown-all-in-one (Yu Zhang), dbaeumer.vscode-eslint
# (Microsoft), esbenp.prettier-vscode (Prettier).
if confirmer "$(texte 'Veux-tu voir la liste des extensions proposées pour ce projet ?' 'Would you like to see the suggested project extensions?')"; then
  dire "$(texte '  1. Markdown All in One : yzhang.markdown-all-in-one (Yu Zhang) : table des matières et confort Markdown.' '  1. Markdown All in One: yzhang.markdown-all-in-one (Yu Zhang): contents and Markdown editing.')"
  dire "$(texte '  2. ESLint : dbaeumer.vscode-eslint (Microsoft) : contrôle du JavaScript et du TypeScript.' '  2. ESLint: dbaeumer.vscode-eslint (Microsoft): JavaScript and TypeScript checks.')"
  dire "$(texte '  3. Prettier - Code formatter : esbenp.prettier-vscode (Prettier) : mise en forme cohérente du code.' '  3. Prettier - Code formatter: esbenp.prettier-vscode (Prettier): consistent code formatting.')"
  if ! command -v code >/dev/null 2>&1; then
    etat_etape skip "$(texte 'VS Code absent.' 'VS Code missing.')"
    dire "$(texte "VS Code n'est pas détecté sur cet ordinateur : l'installation des extensions est ignorée." "VS Code was not detected: extension installation skipped.")"
    noter "$(texte 'Extensions : ignorées (VS Code absent).' 'Extensions: skipped (VS Code missing).')"
  else
    for ext in 'Markdown All in One|yzhang.markdown-all-in-one' 'ESLint|dbaeumer.vscode-eslint' 'Prettier - Code formatter|esbenp.prettier-vscode'; do
      nom="${ext%%|*}"; id="${ext##*|}"
      if confirmer "$(texte "Installer l'extension $nom ($id) ?" "Install extension $nom ($id)?")" individuel; then
        executer "$(texte "Installation de $id avec code --install-extension." "Installing $id with code --install-extension.")" code --install-extension "$id"
        if [ "$DRY_RUN" != 1 ] && [ "${INTERFACE:-0}" = 1 ] && [ "$ETAT_ETAPE" != fail ];then TOTAL_ETAPE=$((TOTAL_ETAPE+1));etat_etape ok "$(texte "Extensions installées : $TOTAL_ETAPE." "Extensions installed: $TOTAL_ETAPE.")";fi
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
etape config
dire "$(texte '--- 6. Configuration du bureau ---' '--- 6. Desktop configuration ---')"
FICHIERS_PROFIL=("$HOME/.profile")
[ -f "$HOME/.bashrc" ] && FICHIERS_PROFIL+=("$HOME/.bashrc")

PORT_CHOISI=""
if [ -n "$PORT" ]; then PORT_CHOISI="$PORT"
else
  existant=$(sed -n 's/^export BUREAU_PORT="\([0-9]*\)"$/\1/p' "$HOME/.profile" 2>/dev/null | tail -n 1)
  if port_valide "$existant"; then
    PORT_CHOISI="$existant"
    dire "$(texte "Port deja enregistre : $PORT_CHOISI" "Previously saved port: $PORT_CHOISI")"
  else
    PORT_CHOISI="4317"
  fi
fi

if [ -z "$PORT" ] && [ "$DRY_RUN" != "1" ]; then
  if ! confirmer "$(texte "Utiliser le port $PORT_CHOISI pour le bureau ?" "Use port $PORT_CHOISI for the desktop?")"; then
    while true; do
      lire_saisie "$(texte 'Entrez un port entre 1024 et 65535' 'Enter a port between 1024 and 65535')" "$PORT_CHOISI" || break
      saisie="$REPONSE_INTERFACE"
      if port_valide "$saisie"; then PORT_CHOISI="$saisie"; break; fi
      dire "$(texte 'Port invalide : indiquez un nombre entre 1024 et 65535.' 'Invalid port: enter a number between 1024 and 65535.')"
    done
  fi
fi
if ! port_valide "$PORT_CHOISI"; then PORT_CHOISI="4317"; fi

ecrire_profil() {
  if [ "${INTERFACE:-0}" = 1 ] && [ "${ENTREE_FERMEE:-0}" = 1 ];then dire "$(texte 'Entrée fermée : configuration conservée.' 'Input closed: configuration kept.')";return 0;fi
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
    printf '%s\n' "$bloc" >> "$tmp" || return 1
    mv "$tmp" "$fichier" || return 1
    [ "${INTERFACE:-0}" != 1 ] || etat_etape ok "$(texte 'Configuration enregistrée.' 'Configuration saved.')"
    dire "$(texte "Configuration ecrite dans $fichier." "Configuration written to $fichier.")"
  done
}
ecrire_profil || { etat_etape fail;exit 1; }
if [ "$INTERFACE" != 1 ] || [ "$ENTREE_FERMEE" != 1 ]; then
  noter "$(texte "BUREAU_PORT : $PORT_CHOISI (ecrit dans le profil)." "BUREAU_PORT: $PORT_CHOISI (saved in profile).")"
  if [ -n "$HERDR_A_ENREGISTRER" ]; then noter "$(texte "BUREAU_HERDR_PATH : $HERDR_A_ENREGISTRER (ecrit dans le profil)." "BUREAU_HERDR_PATH: $HERDR_A_ENREGISTRER (saved in profile).")"; fi
fi

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
  if [ "$INTERFACE" = 1 ]; then
    choisir "$(texte 'Que doit lancer le raccourci ?' 'What should the shortcut open?')" Herdr "$(texte 'Le bureau' Desktop)" "$(texte 'Herdr et bureau' 'Herdr and desktop')" || REPONSE_INTERFACE=''
    [ "$REPONSE_INTERFACE" = 1 ] && CHOIX_LANCEUR=herdr
    [ "$REPONSE_INTERFACE" = 3 ] && CHOIX_LANCEUR=ensemble
  elif [ "$DRY_RUN" = "1" ]; then
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

proposer_kit() {
  [ "$OUI" = 1 ] && { etat_etape skip "$(texte 'Ignoré avec --oui.' 'Skipped with --oui.')";dire "$(texte 'Le mode --oui ne crée aucun kit.' 'The --oui option never creates a kit.')"; return 0; }
  local script_kit="$RACINE/scripts/init-kit.mjs" dossier node_kit
  [ -f "$script_kit" ] || { etat_etape skip "$(texte 'Script du kit absent.' 'Kit script missing.')";dire "$(texte 'Kit indisponible : script absent.' 'Kit unavailable: script missing.')"; return 0; }
  confirmer "$(texte "Initialiser le kit d'équipe dans un projet ?" 'Initialize the team kit in a project?')" individuel || return 0
  if [ "$DRY_RUN" = 1 ] && [ "${INTERFACE:-0}" != 1 ]; then simuler "$(texte 'Choix du dossier puis initialisation du kit.' 'Choose a folder, then initialize the kit.')"; return 0; fi
  lire_saisie "$(texte 'Dossier du projet (Entrée pour ignorer)' 'Project folder (Enter to skip)')" || return 0
  dossier="$REPONSE_INTERFACE"
  [ -n "$dossier" ] || { etat_etape skip "$(texte 'Aucun dossier choisi.' 'No folder selected.')";return 0; }
  if [ "$DRY_RUN" = 1 ]; then simuler "$(texte 'Initialisation du kit dans le dossier choisi.' 'Initialize the kit in the chosen folder.')";return 0;fi
  case "$dossier" in --*) dossier="./$dossier" ;; esac
  node_kit=$(command -v node || command -v node.exe) || return 1
  if "$node_kit" "$script_kit" "$dossier" --lang "${LANGUE:-fr}"; then
    [ "${INTERFACE:-0}" != 1 ] || etat_etape ok "$(texte 'Kit initialisé.' 'Kit initialized.')"
    noter "$(texte "Kit d'équipe : initialisé." 'Team kit: initialized.')"
  else [ "${INTERFACE:-0}" != 1 ] || etat_etape fail;dire "$(texte "Le kit n'a pas été initialisé. Consultez le résultat ci-dessus." 'The kit was not initialized. Check the output above.')"; fi
}

if [ "$INTERFACE" = 1 ]; then etape kit;proposer_kit;fi
etape tests

# --- 7. Tests -----------------------------------------------------------
dire "$(texte '--- 7. Tests du projet ---' '--- 7. Project tests ---')"
if [ "$NODE_OK" != "1" ]; then
  etat_etape skip "$(texte 'Node.js absent ou trop ancien.' 'Node.js missing or too old.')"
  dire "$(texte 'Node.js manquant ou trop ancien : tests ignores. Relancez ce script apres installation.' 'Node.js missing or too old: tests skipped. Run this script again after installing it.')"
  noter "$(texte 'Tests : ignores (Node.js absent).' 'Tests: skipped (Node.js missing).')"
elif confirmer "$(texte 'Lancer npm test et npm run check maintenant ?' 'Run npm test and npm run check now?')"; then
  (cd -- "$RACINE" && executer "$(texte 'Execution de npm test.' 'Running npm test.')" npm test) || etat_etape fail
  (cd -- "$RACINE" && executer "$(texte 'Execution de npm run check.' 'Running npm run check.')" npm run check) || etat_etape fail
  if [ "$DRY_RUN" != 1 ] && [ "${INTERFACE:-0}" = 1 ]; then etat_etape ok "$(texte 'Vérifications réussies.' 'Checks passed.')";fi
  noter "$(texte 'Tests : executes.' 'Tests: completed.')"
else
  noter "$(texte 'Tests : non executes (refuse).' 'Tests: not run (declined).')"
fi
dire ''

[ "$INTERFACE" = 1 ] || proposer_kit

# --- Resume -------------------------------------------------------------
dire "$(texte '=== Resume ===' '=== Summary ===')"
if [ -z "$RAPPORT" ]; then dire "$(texte 'Rien a signaler.' 'Nothing to report.')"; else printf '%s\n' "$RAPPORT" | sed '/^ *$/d'; fi
dire ''
dire "$(texte "Pour ouvrir le bureau : lancez 'node server.mjs' dans $RACINE" "To open the desktop: run node server.mjs in $RACINE")"
dire "$(texte "puis ouvrez http://127.0.0.1:$PORT_CHOISI (ou utilisez le raccourci cree)." "then open http://127.0.0.1:$PORT_CHOISI (or use the shortcut).")"
dire "$(texte 'Herdr doit etre ouvert pour que le bureau voie vos agents.' 'Herdr must be open for the desktop to see your agents.')"
if [ "$INTERFACE" = 1 ] && [ "$ECHEC_INTERFACE" = 1 ]; then exit 1;fi
