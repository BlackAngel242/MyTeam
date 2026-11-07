#!/usr/bin/env bash
set -o pipefail
# Installe les prerequis du Bureau des agents sur macOS et Linux.
#
# Vérifie et installe Node.js et Herdr si nécessaire ; propose une sélection groupée
# des outils IA absents, puis prépare un espace Herdr à 4 panneaux
# (le premier = chef), propose les extensions utiles du projet, configure le port
# et le chemin de Herdr, peut creer le raccourci « Ouvrir le bureau » (au choix :
# Herdr ou le bureau dans le navigateur), puis lance npm test et npm run check.
# Relancable sans degat : le script verifie avant d'agir.
# Aucune cle API ni aucun jeton n'est demande, lu ou enregistre.
#
# Usage : bash scripts/installer.sh [options]
#   --dry-run            Simulation : affiche les actions sans rien executer.
#   --oui                Installe les prérequis manquants, sans choisir d’IA ni lancer d’agent.
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
      if [ "$LANGUE" = en ]; then printf '%s\n' 'Agent desktop installer: --dry-run (preview), --oui (installs missing prerequisites but never selects AI tools or launches agents), --port <1024..65535>, --herdr-chemin <file>, --sans-raccourci, --interface, --lang fr|en, --aide.'; exit 0; fi
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
# Session Herdr dédiée : le tableau de bord et la grille vivent ici, jamais dans la session par défaut.
SESSION_HERDR='myteam'
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
    emettre_interface DONE "$ETAPE" "$ETAT_ETAPE" "$TEXTE_ETAPE${DETAILS_ETAPE:+ $DETAILS_ETAPE}"
    ETAPE=''
  fi
}

etape() {
  [ "${INTERFACE:-0}" = 1 ] || return 0
  fin_etape;ETAPE="$1";ETAT_ETAPE=skip;TEXTE_ETAPE=$(texte 'Non applicable.' 'Not applicable.');TOTAL_ETAPE=0;DETAILS_ETAPE='';emettre_interface STEP "$ETAPE"
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

# Résumé : en simulation, on dit ce qui serait fait, jamais ce qui a été fait.
noter_simule() {
  if [ "$DRY_RUN" = "1" ]; then noter "$2"; else noter "$1"; fi
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
  local fichier="$1" cible="$2" icone="$3" argument
  argument=$(argument_desktop "$cible") || return 1
  {
    printf '[Desktop Entry]\nType=Application\nName=MyTeam\n'
    printf 'Comment=%s\n' "$(texte 'Bureau des agents : Herdr et navigateur' 'Agent desktop: Herdr and browser')"
    printf 'Exec=%s\nTerminal=true\nCategories=Development;\n' "$argument"
    [ -n "$icone" ] && printf 'Icon=%s\n' "$icone"
  } > "$fichier" || return 1
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
    pi) npm install -g @mariozechner/pi-coding-agent ;;
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
  if [ -n "$CMD_NODE" ]; then
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
    noter "$(texte 'Node.js : non installe (gestionnaire absent).' 'Node.js: not installed (no package manager).')"
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
  if [ -f "$HOME/.local/bin/herdr" ] && [ -x "$HOME/.local/bin/herdr" ]; then printf '%s\n' "$HOME/.local/bin/herdr"; return 0; fi
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
    if true; then
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
  if true; then
    executer "$(texte 'Installation de Herdr (script officiel https://herdr.dev/install.sh).' 'Installing Herdr (official script https://herdr.dev/install.sh).')" installer_outil herdr
    if [ "$DRY_RUN" != "1" ]; then
      HERDR_TROUVE=$(chercher_herdr || true)
      if [ -n "$HERDR_TROUVE" ]; then
        dire "$(texte "Herdr est maintenant installe : $HERDR_TROUVE" "Herdr is now installed: $HERDR_TROUVE")"
        noter "$(texte 'Herdr : installe.' 'Herdr: installed.')"
        if ! command -v herdr >/dev/null 2>&1; then HERDR_A_ENREGISTRER="$HERDR_TROUVE"; fi
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
    noter "$(texte 'Herdr : non installe (installation impossible).' 'Herdr: not installed (installation unavailable).')"
  fi
fi
dire ''

# --- 3. Panneaux Herdr --------------------------------------------------
lire_panneaux() {
  local liste ids id
  SESSION_HERDR="${SESSION_HERDR:-myteam}"
  liste=$("$HERDR_TROUVE" --session "$SESSION_HERDR" pane list --workspace "$1") || return 1
  ids=$(printf '%s' "$liste" | grep -oE '"pane_id"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]+:p[0-9]+"' | sed 's/.*"\([^"]*\)"$/\1/' | sort -u)
  [ -n "$ids" ] || return 1
  while read -r id; do case "$id" in "$1":p*) ;; *) return 1 ;; esac; done <<< "$ids"
  printf '%s\n' "$ids"
}

creer_grille_herdr() {
  local creation espace avant apres nouveau gauche droite colonne id i
  SESSION_HERDR="${SESSION_HERDR:-myteam}"
  local ids=() noms=('Chef' 'Agent 2' 'Agent 3' 'Agent 4')
  creation=$("$HERDR_TROUVE" --session "$SESSION_HERDR" workspace create --label 'Bureau des agents' --cwd "$RACINE") || return 1
  espace=$(printf '%s' "$creation" | grep -oE '"workspace_id"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]+"' | sed 's/.*"\([^"]*\)"$/\1/' | sort -u)
  [ -n "$espace" ] && [ "$(printf '%s\n' "$espace" | wc -l)" -eq 1 ] || return 1
  avant=$(lire_panneaux "$espace") || return 1
  [ "$(printf '%s\n' "$avant" | wc -l)" -eq 1 ] || return 1
  gauche="$avant"
  "$HERDR_TROUVE" --session "$SESSION_HERDR" pane split --pane "$gauche" --direction right --no-focus >/dev/null || return 1
  apres=$(lire_panneaux "$espace") || return 1
  nouveau=$(printf '%s\n' "$apres" | grep -Fxv -f <(printf '%s\n' "$avant"))
  [ -n "$nouveau" ] && [ "$(printf '%s\n' "$nouveau" | wc -l)" -eq 1 ] && [ "$(printf '%s\n' "$apres" | wc -l)" -eq 2 ] || return 1
  droite="$nouveau"; ids=("$gauche" "$droite")
  for colonne in "$gauche" "$droite"; do
    avant=$(lire_panneaux "$espace") || return 1
    "$HERDR_TROUVE" --session "$SESSION_HERDR" pane split --pane "$colonne" --direction down --no-focus >/dev/null || return 1
    apres=$(lire_panneaux "$espace") || return 1
    nouveau=$(printf '%s\n' "$apres" | grep -Fxv -f <(printf '%s\n' "$avant"))
    [ -n "$nouveau" ] && [ "$(printf '%s\n' "$nouveau" | wc -l)" -eq 1 ] || return 1
    [ "$(printf '%s\n' "$apres" | wc -l)" -eq "$(( $(printf '%s\n' "$avant" | wc -l) + 1 ))" ] || return 1
    ids+=("$nouveau")
  done
  for i in 0 1 2 3; do "$HERDR_TROUVE" --session "$SESSION_HERDR" pane rename "${ids[$i]}" "${noms[$i]}" >/dev/null || return 1; done
  printf '%s\n' "${ids[@]}"
}

session_herdr_active() {
  SESSION_HERDR="${SESSION_HERDR:-myteam}"
  "$HERDR_TROUVE" session list 2>/dev/null | awk -v n="$SESSION_HERDR" '$1==n && $2=="running"{f=1} END{exit f?0:1}'
}

# Démarre la session dédiée en arrière-plan, sans fenêtre, puis attend qu'elle réponde.
# Commande vérifiée dans une session d'essai (herdr 0.9.5) : herdr --session <nom> server.
demarrer_session_herdr() {
  SESSION_HERDR="${SESSION_HERDR:-myteam}"
  session_herdr_active && return 0
  "$HERDR_TROUVE" --session "$SESSION_HERDR" server >/dev/null 2>&1 &
  disown 2>/dev/null || true
  local i=0
  while [ "$i" -lt 100 ]; do
    session_herdr_active && return 0
    sleep 0.1
    i=$((i+1))
  done
  return 1
}

# Espace « Bureau des agents » déjà présent dans la session ? Sinon rien.
espace_bureau_existant() {
  local liste
  SESSION_HERDR="${SESSION_HERDR:-myteam}"
  liste=$("$HERDR_TROUVE" --session "$SESSION_HERDR" workspace list) || return 1
  printf '%s' "$liste" | grep -oE '"label":"Bureau des agents"[^}]*"workspace_id":"[^"]+"' | sed -E 's/.*"workspace_id":"([^"]+)".*/\1/' | head -n 1
}

# Réutilise l'unique espace existant, sinon le crée. Jamais de second espace.
assurer_grille_herdr() {
  local existant ids
  GRILLE_REUTILISEE=0
  existant=$(espace_bureau_existant) || return 1
  if [ -n "$existant" ]; then
    ids=$(lire_panneaux "$existant") || return 1
    GRILLE_REUTILISEE=1
    printf '%s\n' "$ids" | head -n 4
    return 0
  fi
  creer_grille_herdr
}

detecter_outils() {
  local type
  for type in pi claude codex gemini cursor devin agy cline omp mastracode opencode copilot kimi kiro droid amp grok hermes kilo qodercli qwen letta maki muse; do
    if [ "$type" = agy ]; then
      { command -v agy >/dev/null 2>&1 || command -v antigravity-cli >/dev/null 2>&1; } && printf '%s\n' agy
    else
      command -v "$type" >/dev/null 2>&1 && printf '%s\n' "$type"
    fi
  done
  return 0
}

proposer_agents() {
  SESSION_HERDR="${SESSION_HERDR:-myteam}"
  [ "$OUI" = 1 ] && { dire "$(texte 'Le mode --oui ne lance aucun agent.' 'The --oui option never starts an agent.')"; return 0; }
  local outils=() panneaux=() noms=('Chef' 'Agent 2' 'Agent 3' 'Agent 4') type pane i=0 j choix liste
  liste=$(detecter_outils)
  [ -n "$liste" ] || { dire "$(texte 'Aucun outil compatible détecté : aucun agent lancé.' 'No supported tools detected: no agent started.')"; return 0; }
  while read -r type; do outils+=("$type"); done <<< "$liste"
  while read -r pane; do panneaux+=("$pane"); done <<< "$1"
  for pane in "${panneaux[@]}"; do
    case " ${PANNEAUX_TENTES:-} " in *" $pane "*) i=$((i+1)); continue ;; esac
    if [ "$DRY_RUN" = 1 ]; then simuler "$(texte "Choix et confirmation de l'outil pour ${noms[$i]}." "Choose and confirm a tool for ${noms[$i]}.")"; i=$((i+1)); continue; fi
    if [ "${INTERFACE:-0}" = 1 ]; then
      question="$(texte "Outil pour le panneau ${noms[$i]}" "Tool for pane ${noms[$i]}")"
    else
      dire "$(texte "Panneau ${noms[$i]} : outils détectés" "Pane ${noms[$i]}: detected tools")"
      for ((j=0;j<${#outils[@]};j++)); do dire "$((j+1)). ${outils[$j]}"; done
      question="$(texte 'Numéro de l’outil (0 ou Entrée pour ignorer)' 'Tool number (0 or Enter to skip)')"
    fi
    choisir "$question" "$(texte Ignorer Skip)" "${outils[@]}" || REPONSE_INTERFACE=0
    choix="$REPONSE_INTERFACE"
    if [ "${INTERFACE:-0}" = 1 ] && [[ "$choix" =~ ^[0-9]{1,2}$ ]]; then choix=$((10#$choix-1));fi
    if [[ "$choix" =~ ^[0-9]{1,2}$ ]] && [ "$choix" -ge 1 ] && [ "$choix" -le "${#outils[@]}" ]; then
      type="${outils[$((10#$choix-1))]}"
      if command -v "$type" >/dev/null 2>&1 && confirmer "$(texte "Lancer $type dans le panneau ${noms[$i]} ?" "Start $type in pane ${noms[$i]}?")" individuel; then
        PANNEAUX_TENTES="${PANNEAUX_TENTES:+$PANNEAUX_TENTES }$pane"
        local agent_nom
        if [ "$i" -eq 0 ]; then agent_nom=chef; else agent_nom="agent$((i+1))"; fi
        if "$HERDR_TROUVE" --session "$SESSION_HERDR" agent start "$agent_nom" --kind "$type" --pane "$pane" >/dev/null; then
          if [ "${INTERFACE:-0}" = 1 ]; then DETAILS_ETAPE="${DETAILS_ETAPE:+$DETAILS_ETAPE, }${noms[$i]} = $type"; fi
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
  if [ "$OUI" = "1" ]; then
    dire "$(texte 'Le mode --oui ne crée ni session Herdr ni espace de panneaux.' 'The --oui option creates no Herdr session or workspace.')"
    noter "$(texte 'Panneaux Herdr : ignorés (--oui).' 'Herdr panes: skipped (--oui).')"
    etat_etape skip "$(texte 'Ignoré avec --oui.' 'Skipped with --oui.')"
  elif confirmer "$(texte 'Créer un espace Herdr « Bureau » avec 4 panneaux (le premier = chef) ?' 'Create a Herdr workspace called Bureau with 4 panes (first pane = chief)?')"; then
    if [ "$DRY_RUN" = "1" ]; then
      simuler "$(texte "Démarrage de la session Herdr « myteam » puis création de l'espace « Bureau des agents » (ou réutilisation s'il existe)." "Starting the myteam Herdr session, then creating or reusing the Bureau des agents workspace.")"
      simuler "$(texte 'Nommage des panneaux : Chef, Agent 2, Agent 3, Agent 4.' 'Pane names: Chef, Agent 2, Agent 3, Agent 4.')"
      noter "$(texte 'Panneaux Herdr : simulation.' 'Herdr panes: preview.')"
    else
      panneaux_ok=0
      if demarrer_session_herdr; then
        ids=$(assurer_grille_herdr) && panneaux_ok=1
      fi
      if [ "$panneaux_ok" = "1" ]; then
        [ "$INTERFACE" != 1 ] || etat_etape ok "$(texte 'Espace prêt.' 'Workspace ready.')"
        if [ "${GRILLE_REUTILISEE:-0}" = "1" ]; then
          dire "$(texte "Espace « Bureau des agents » existant réutilisé dans la session myteam." "Existing Bureau des agents workspace reused in the myteam session.")"
          noter "$(texte 'Panneaux Herdr : espace existant réutilisé.' 'Herdr panes: existing workspace reused.')"
        else
          dire "$(texte 'Panneaux créés et nommés : Chef, Agent 2, Agent 3, Agent 4 (session myteam).' 'Panes created and named: Chef, Agent 2, Agent 3, Agent 4 (session myteam).')"
          noter "$(texte 'Panneaux Herdr : 4 panneaux créés et nommés dans la session myteam.' 'Herdr panes: 4 panes created and named in the myteam session.')"
        fi
        OUTILS_AVANT_INSTALLATION=$(detecter_outils)
        proposer_agents "$ids"
      fi
      if [ "$panneaux_ok" = "0" ]; then
        [ "$INTERFACE" != 1 ] || etat_etape fail
        dire "$(texte "La création automatique n'a pas abouti." "Automatic creation failed.")"
        dire "$(texte 'Procédure manuelle (commandes vérifiées de Herdr, session myteam) :' 'Manual procedure (verified Herdr commands, myteam session):')"
        dire "  herdr --session myteam server       # puis attendre que la session réponde"
        dire "  herdr --session myteam workspace create --label \"Bureau des agents\" --cwd \"$RACINE\""
        dire "$(texte '  herdr --session myteam pane list     # repérer les identifiants, ex. w6:p1' '  herdr --session myteam pane list     # find pane identifiers, e.g. w6:p1')"
        dire '  herdr --session myteam pane split --pane w6:p1 --direction right --no-focus'
        dire '  herdr --session myteam pane split --pane w6:p1 --direction down --no-focus'
        dire '  herdr --session myteam pane split --pane w6:p2 --direction down --no-focus'
        dire "$(texte '  herdr --session myteam pane rename w6:p1 Chef   # puis Agent 2, Agent 3, Agent 4' '  herdr --session myteam pane rename w6:p1 Chef   # then Agent 2, Agent 3, Agent 4')"
        dire "$(texte "  # optionnel : lancer un outil d'IA dans un panneau (non fait par ce script)" "  # optional: start an AI tool in a pane")"
        dire "$(texte '  # herdr --session myteam agent start <nom> --kind claude --pane w6:p1' '  # herdr --session myteam agent start <name> --kind claude --pane w6:p1')"
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
  SESSION_HERDR="${SESSION_HERDR:-myteam}"
  [ "$OUI" = 1 ] && { etat_etape skip "$(texte 'Ignoré avec --oui.' 'Skipped with --oui.')";return 0; }
  [ -n "$HERDR_TROUVE" ] || { etat_etape skip "$(texte 'Herdr absent.' 'Herdr missing.')";return 0; }
  local personnel="${1:-$HOME}" outils=() eligibles=() liste type integration orientation selection='' index=0 accord
  liste=$(detecter_outils)
  if [ -n "$liste" ]; then while read -r type; do outils+=("$type"); done <<< "$liste"; fi
  for type in "${outils[@]}"; do
    integration="$type";[ "$type" = agy ] && integration=antigravity-cli
    case "$integration" in pi|omp|claude|codex|copilot|devin|droid|kimi|opencode|kilo|hermes|qodercli|qwen|letta|cursor|mastracode|antigravity-cli|grok) ;; *) continue ;; esac
    eligibles+=("$type")
  done
  if [ "$INTERFACE" = 1 ] && [ "${#eligibles[@]}" -gt 0 ]; then
    if lire_interface MULTI "$(texte 'Quelles intégrations Herdr installer ? Elles modifient la configuration des outils sélectionnés.' 'Which Herdr integrations should be installed? They change the configuration of selected tools.')" "${eligibles[@]}"; then
      [[ "$REPONSE_INTERFACE" =~ ^[0-9]+(,[0-9]+)*$ ]] && selection=",$REPONSE_INTERFACE,"
    fi
  fi
  for type in "${eligibles[@]}"; do
    index=$((index+1)); integration="$type"; [ "$type" = agy ] && integration=antigravity-cli
    accord=0
    if [ "$INTERFACE" = 1 ]; then [[ "$selection" == *",$index,"* ]] && accord=1
    elif confirmer "$(texte "Installer l'intégration Herdr pour $type ? Elle modifie la configuration de cet outil." "Install the Herdr integration for $type? It changes this tool's configuration.")" individuel; then accord=1; fi
    if [ "$accord" = 1 ]; then
      if [ "$DRY_RUN" = 1 ]; then simuler "herdr integration install $integration"
      elif "$HERDR_TROUVE" integration install "$integration"; then
        etat_etape ok "$(texte 'Intégration installée.' 'Integration installed.')"
        if [ "${INTERFACE:-0}" = 1 ]; then DETAILS_ETAPE="${DETAILS_ETAPE:+$DETAILS_ETAPE, }$(texte Intégration Integration) : $type"; fi
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
    elif "$HERDR_TROUVE" --session "$SESSION_HERDR" agent prompt "$CHEF_PANE" "$orientation"; then etat_etape ok "$(texte 'Orientation envoyée.' 'Orientation sent.')"
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

# Une seule saisie pour tous les outils absents. Aucun outil déjà présent n'est réinstallé.
OUTILS_DISPONIBLES=0
OUTILS_MANQUANTS=()
for fiche in 'Claude Code|claude' 'Codex (OpenAI)|codex' 'OpenCode|opencode' 'Pi|pi' 'Gemini CLI|gemini' 'Antigravity|antigravity-cli'; do
  nom=${fiche%%|*}; commande=${fiche#*|}
  if command -v "$commande" >/dev/null 2>&1 || { [ "$commande" = antigravity-cli ] && command -v agy >/dev/null 2>&1; }; then
    dire "$(texte "$nom : déjà présent." "$nom: already available.")"
    noter "$nom : déjà présent."
    OUTILS_DISPONIBLES=$((OUTILS_DISPONIBLES+1))
  else OUTILS_MANQUANTS+=("$fiche"); fi
done
if [ "$OUTILS_DISPONIBLES" -gt 0 ]; then etat_etape ok "$(texte "Outils disponibles : $OUTILS_DISPONIBLES." "Available tools: $OUTILS_DISPONIBLES.")"; fi
if [ "${#OUTILS_MANQUANTS[@]}" -gt 0 ]; then
  dire "$(texte 'Outils absents proposés :' 'Missing tools available for selection:')"
  for i in "${!OUTILS_MANQUANTS[@]}"; do dire "$((i+1)). ${OUTILS_MANQUANTS[i]%%|*}"; done
  dire "$(texte 'Antigravity : ouverture de la documentation officielle, installation manuelle.' 'Antigravity: official documentation, manual installation.')"
  while :; do
    if [ "$OUI" = 1 ]; then selection=0
    elif [ "$INTERFACE" = 1 ]; then
      labels=(); for fiche in "${OUTILS_MANQUANTS[@]}"; do labels+=("${fiche%%|*}"); done
      if lire_interface MULTI "$(texte 'Quels outils IA installer ?' 'Which AI tools should be installed?')" "${labels[@]}"; then selection=$REPONSE_INTERFACE; else selection=0; fi
    elif [ "$DRY_RUN" = 1 ]; then selection=0
    elif lire_saisie "$(texte 'Numéros des outils à installer (ex. 1,3 ; 0 = aucun)' 'Tool numbers to install (e.g. 1,3; 0 = none)')" 0; then selection=$REPONSE_INTERFACE
    else selection=0; fi
    selection=${selection// /}
    if [ "$selection" = 0 ] || [ -z "$selection" ]; then
      if [ "$OUTILS_DISPONIBLES" -eq 0 ] && [ "$DRY_RUN" != 1 ]; then dire "$(texte 'Aucune IA choisie : vous pourrez en installer une avant votre première mission.' 'No AI selected: you can install one before your first mission.')"; fi
      break
    fi
    if [[ ! "$selection" =~ ^[1-9][0-9]*(,[1-9][0-9]*)*$ ]]; then dire "$(texte 'Sélection invalide.' 'Invalid selection.')";continue;fi
    IFS=, read -ra indices <<< "$selection"
    valide=1; choisis=()
    for indice in "${indices[@]}"; do
      if [ "$indice" -gt "${#OUTILS_MANQUANTS[@]}" ]; then valide=0;break;fi
      fiche=${OUTILS_MANQUANTS[indice-1]}
      [[ " ${choisis[*]} " == *" $fiche "* ]] || choisis+=("$fiche")
    done
    if [ "$valide" != 1 ]; then dire "$(texte 'Numéro hors liste.' 'Number out of range.')";continue;fi
    noms_choisis=(); for fiche in "${choisis[@]}"; do noms_choisis+=("${fiche%%|*}"); done
    dire "$(texte "Sélection : ${noms_choisis[*]}" "Selection: ${noms_choisis[*]}")"
    if [ "$INTERFACE" != 1 ] && [ "$DRY_RUN" != 1 ] && ! confirmer "$(texte 'Installer cette sélection ?' 'Install this selection?')" individuel; then continue;fi
    if [ "$INTERFACE" = 1 ]; then DETAILS_ETAPE="$(texte 'Sélection' 'Selection') : ${noms_choisis[*]}"; fi
    for fiche in "${choisis[@]}"; do
      nom=${fiche%%|*}; commande=${fiche#*|}
      if [ "$commande" = antigravity-cli ]; then
        dire 'https://antigravity.google/docs/cli/getting-started'
        noter 'Antigravity : installation manuelle requise.'
      else
        executer "$(texte "Installation de $nom." "Installing $nom.")" installer_outil "$commande"
        if [ "$DRY_RUN" != 1 ] && command -v "$commande" >/dev/null 2>&1; then OUTILS_DISPONIBLES=$((OUTILS_DISPONIBLES+1));noter "$nom : installé."
        elif [ "$DRY_RUN" != 1 ]; then noter "$nom : installation à vérifier.";fi
      fi
    done
    break
  done
fi
if [ "$OUTILS_DISPONIBLES" -eq 0 ] && [ "$DRY_RUN" != 1 ]; then
  dire "$(texte 'Aucun outil IA détecté : configurez au moins un outil avant de démarrer une mission.' 'No AI tool detected: set up one before starting a mission.')"
fi
if [ "${panneaux_ok:-0}" = 1 ] && [ -n "${ids:-}" ]; then
  # Repérer d'abord un nouvel outil, puis poser les questions hors de la boucle :
  # dans `while … done <<< "$nouveaux"`, les questions liraient la liste au lieu des réponses.
  nouvel_outil=0
  while IFS= read -r outil; do
    [ -n "$outil" ] || continue
    if ! printf '%s\n' "${OUTILS_AVANT_INSTALLATION:-}" | grep -Fxq "$outil"; then nouvel_outil=1; break; fi
  done <<< "$(detecter_outils)"
  if [ "$nouvel_outil" = 1 ]; then proposer_agents "$ids"; fi
fi

# --- 5. Extensions utiles (optionnelles) --------------------------------
if [ "$INTERFACE" = 1 ]; then etape chef;proposer_chef;fi
etape extensions
dire "$(texte '--- 5. Extensions utiles pour ce projet (optionnelles) ---' '--- 5. Useful project extensions (optional) ---')"
# Trois extensions vérifiées sur le marché VS Code le 17 octobre 2026, avec
# leurs éditeurs : yzhang.markdown-all-in-one (Yu Zhang), dbaeumer.vscode-eslint
# (Microsoft), esbenp.prettier-vscode (Prettier).
if [ "$INTERFACE" = 1 ] || confirmer "$(texte 'Veux-tu voir la liste des extensions proposées pour ce projet ?' 'Would you like to see the suggested project extensions?')"; then
  dire "$(texte '  1. Markdown All in One : yzhang.markdown-all-in-one (Yu Zhang) : table des matières et confort Markdown.' '  1. Markdown All in One: yzhang.markdown-all-in-one (Yu Zhang): contents and Markdown editing.')"
  dire "$(texte '  2. ESLint : dbaeumer.vscode-eslint (Microsoft) : contrôle du JavaScript et du TypeScript.' '  2. ESLint: dbaeumer.vscode-eslint (Microsoft): JavaScript and TypeScript checks.')"
  dire "$(texte '  3. Prettier - Code formatter : esbenp.prettier-vscode (Prettier) : mise en forme cohérente du code.' '  3. Prettier - Code formatter: esbenp.prettier-vscode (Prettier): consistent code formatting.')"
  if ! command -v code >/dev/null 2>&1; then
    etat_etape skip "$(texte 'VS Code absent.' 'VS Code missing.')"
    dire "$(texte "VS Code n'est pas détecté sur cet ordinateur : l'installation des extensions est ignorée." "VS Code was not detected: extension installation skipped.")"
    noter "$(texte 'Extensions : ignorées (VS Code absent).' 'Extensions: skipped (VS Code missing).')"
  else
    extensions_selection=''
    if [ "$INTERFACE" = 1 ] && [ "$OUI" != 1 ]; then
      if lire_interface MULTI "$(texte 'Quelles extensions installer ?' 'Which extensions should be installed?')" 'Markdown All in One (yzhang.markdown-all-in-one)' 'ESLint (dbaeumer.vscode-eslint)' 'Prettier - Code formatter (esbenp.prettier-vscode)' && [[ "$REPONSE_INTERFACE" =~ ^[1-3](,[1-3])*$ ]]; then
        extensions_selection=",$REPONSE_INTERFACE,"
      fi
    fi
    if [ "$INTERFACE" = 1 ] && [ -n "$extensions_selection" ]; then
      noms_extensions=()
      [[ "$extensions_selection" == *",1,"* ]] && noms_extensions+=('Markdown All in One')
      [[ "$extensions_selection" == *",2,"* ]] && noms_extensions+=('ESLint')
      [[ "$extensions_selection" == *",3,"* ]] && noms_extensions+=('Prettier - Code formatter')
      DETAILS_ETAPE="$(texte 'Sélection' 'Selection') : ${noms_extensions[*]}"
    fi
    ext_index=0
    for ext in 'Markdown All in One|yzhang.markdown-all-in-one' 'ESLint|dbaeumer.vscode-eslint' 'Prettier - Code formatter|esbenp.prettier-vscode'; do
      ext_index=$((ext_index+1))
      nom="${ext%%|*}"; id="${ext##*|}"
      accord_extension=0
      if [ "$INTERFACE" = 1 ]; then [[ "$extensions_selection" == *",$ext_index,"* ]] && accord_extension=1
      elif confirmer "$(texte "Installer l'extension $nom ($id) ?" "Install extension $nom ($id)?")" individuel; then accord_extension=1; fi
      if [ "$accord_extension" = 1 ]; then
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
  if [ -n "$HERDR_TROUVE" ] && [ "$OUI" != 1 ]; then
    bloc="$bloc
export BUREAU_HERDR_SESSION=\"$SESSION_HERDR\""
  fi
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
  noter_simule "$(texte "BUREAU_PORT : $PORT_CHOISI (ecrit dans le profil)." "BUREAU_PORT: $PORT_CHOISI (saved in profile).")" "$(texte "BUREAU_PORT : $PORT_CHOISI (simulation, rien écrit dans le profil)." "BUREAU_PORT: $PORT_CHOISI (preview, nothing written to profile).")"
  if [ -n "$HERDR_A_ENREGISTRER" ]; then noter_simule "$(texte "BUREAU_HERDR_PATH : $HERDR_A_ENREGISTRER (ecrit dans le profil)." "BUREAU_HERDR_PATH: $HERDR_A_ENREGISTRER (saved in profile).")" "$(texte "BUREAU_HERDR_PATH : $HERDR_A_ENREGISTRER (simulation, rien écrit dans le profil)." "BUREAU_HERDR_PATH: $HERDR_A_ENREGISTRER (preview, nothing written to profile).")"; fi
  if [ -n "$HERDR_TROUVE" ] && [ "$OUI" != 1 ]; then noter_simule "$(texte "BUREAU_HERDR_SESSION : $SESSION_HERDR (ecrit dans le profil)." "BUREAU_HERDR_SESSION: $SESSION_HERDR (saved in profile).")" "$(texte "BUREAU_HERDR_SESSION : $SESSION_HERDR (simulation, rien écrit dans le profil)." "BUREAU_HERDR_SESSION: $SESSION_HERDR (preview, nothing written to profile).")"; fi
fi

# Commande « myteam » : lien ~/.local/bin/myteam vers bin/myteam, sans écraser un lien étranger.
if [ -f "$RACINE/bin/myteam" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    simuler "$(texte "Lien ~/.local/bin/myteam vers $RACINE/bin/myteam." "Link ~/.local/bin/myteam to $RACINE/bin/myteam.")"
    noter_simule "$(texte 'Commande myteam : lien simulé.' 'myteam command: link simulated.')" "$(texte 'Commande myteam : lien simulé, rien créé.' 'myteam command: link simulated, nothing created.')"
  else
    mkdir -p "$HOME/.local/bin" || { etat_etape fail;exit 1; }
    lien_myteam="$HOME/.local/bin/myteam"
    if [ -e "$lien_myteam" ] || [ -L "$lien_myteam" ]; then
      if [ -L "$lien_myteam" ] && [ "$(readlink "$lien_myteam")" = "$RACINE/bin/myteam" ]; then
        noter "$(texte 'Commande myteam : lien déjà en place.' 'myteam command: link already in place.')"
      else
        dire "$(texte "$lien_myteam existe et n'appartient pas à MyTeam : conservé." "$lien_myteam exists and is not MyTeam's: kept.")"
        noter "$(texte 'Commande myteam : lien étranger conservé.' 'myteam command: foreign link kept.')"
      fi
    else
      ln -s "$RACINE/bin/myteam" "$lien_myteam" || { etat_etape fail;exit 1; }
      noter "$(texte 'Commande myteam : lien créé dans ~/.local/bin.' 'myteam command: link created in ~/.local/bin.')"
    fi
    case ":$PATH:" in
      *":$HOME/.local/bin:"*) : ;;
      *) dire "$(texte 'Ajoutez ~/.local/bin à votre PATH pour taper « myteam » (par exemple export PATH=\"$HOME/.local/bin:$PATH\").' 'Add ~/.local/bin to your PATH to type "myteam" (for example export PATH=\"$HOME/.local/bin:$PATH\").')" ;;
    esac
  fi
else
  dire "$(texte 'bin/myteam est absent : commande myteam non installée.' 'bin/myteam is missing: the myteam command was not installed.')"
  noter "$(texte 'Commande myteam : lanceur absent.' 'myteam command: launcher missing.')"
fi

if [ "$SANS_RACCOURCI" != "1" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    dire "$(texte 'Pas de raccourci automatique sur macOS : lancez bin/myteam dans un terminal.' 'No automatic shortcut on macOS: run bin/myteam in a terminal.')"
    noter "$(texte 'Raccourci : non prévu sur macOS.' 'Shortcut: not provided on macOS.')"
  elif [ -f "$RACINE/bin/myteam" ]; then
    if command -v xdg-user-dir >/dev/null 2>&1; then
      DOSSIER_BUREAU=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
    elif [ -d "$HOME/Desktop" ]; then
      DOSSIER_BUREAU="$HOME/Desktop"
    elif [ -d "$HOME/Bureau" ]; then
      DOSSIER_BUREAU="$HOME/Bureau"
    else
      DOSSIER_BUREAU="$HOME"
    fi
    FICHIER_DESKTOP="$DOSSIER_BUREAU/myteam.desktop"
    if [ "$DRY_RUN" = "1" ]; then
      simuler "$(texte "Création de $FICHIER_DESKTOP (Exec=$RACINE/bin/myteam, Terminal=true)." "Creating $FICHIER_DESKTOP (Exec=$RACINE/bin/myteam, Terminal=true).")"
      noter_simule "$(texte 'Raccourci : simulé, rien créé.' 'Shortcut: simulated, nothing created.')"
    elif [ -f "$FICHIER_DESKTOP" ]; then
      if grep -q "^Exec=.*bin/myteam" "$FICHIER_DESKTOP" 2>/dev/null; then
        ecrire_desktop "$FICHIER_DESKTOP" "$RACINE/bin/myteam" "$RACINE/public/myteam.png" || { etat_etape fail; exit 1; }
        dire "$(texte "Raccourci créé : $FICHIER_DESKTOP" "Shortcut created: $FICHIER_DESKTOP")"
        noter "$(texte 'Raccourci : myteam.desktop créé.' 'Shortcut: myteam.desktop created.')"
      else
        dire "$(texte "$FICHIER_DESKTOP existe et n'appartient pas à MyTeam : conservé." "$FICHIER_DESKTOP exists and is not MyTeam's: kept.")"
        noter "$(texte 'Raccourci : fichier étranger conservé.' 'Shortcut: foreign file kept.')"
      fi
    else
      ecrire_desktop "$FICHIER_DESKTOP" "$RACINE/bin/myteam" "$RACINE/public/myteam.png" || { etat_etape fail; exit 1; }
      dire "$(texte "Raccourci créé : $FICHIER_DESKTOP" "Shortcut created: $FICHIER_DESKTOP")"
      noter "$(texte 'Raccourci : myteam.desktop créé.' 'Shortcut: myteam.desktop created.')"
    fi
    if [ "$INTERFACE" = 1 ] && [ "$ENTREE_FERMEE" != 1 ]; then DETAILS_ETAPE="${DETAILS_ETAPE:+$DETAILS_ETAPE, }Raccourci : myteam.desktop"; fi
  else
    dire "$(texte 'bin/myteam est absent : raccourci ignoré.' 'bin/myteam is missing: shortcut skipped.')"
    noter "$(texte 'Raccourci : lanceur absent.' 'Shortcut: launcher missing.')"
  fi
fi
if [ "$INTERFACE" = 1 ] && [ "$ENTREE_FERMEE" != 1 ]; then DETAILS_ETAPE="${DETAILS_ETAPE:+$DETAILS_ETAPE, }Port $PORT_CHOISI"; fi
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
if [ ! -d "$RACINE/test" ]; then
  etat_etape skip "$(texte 'Paquet utilisateur sans tests.' 'User package without tests.')"
  dire "$(texte 'Les tests de développement sont disponibles dans le dépôt source.' 'Development tests are available in the source repository.')"
elif [ "$NODE_OK" != "1" ]; then
  etat_etape skip "$(texte 'Node.js absent ou trop ancien.' 'Node.js missing or too old.')"
  dire "$(texte 'Node.js manquant ou trop ancien : tests ignorés. Relancez ce script après installation.' 'Node.js missing or too old: tests skipped. Run this script again after installing it.')"
  noter "$(texte 'Tests : ignorés (Node.js absent).' 'Tests: skipped (Node.js missing).')"
elif confirmer "$(texte 'Lancer npm test et npm run check maintenant ?' 'Run npm test and npm run check now?')"; then
  (cd -- "$RACINE" && executer "$(texte 'Execution de npm test.' 'Running npm test.')" npm test) || etat_etape fail
  (cd -- "$RACINE" && executer "$(texte 'Execution de npm run check.' 'Running npm run check.')" npm run check) || etat_etape fail
  if [ "$DRY_RUN" != 1 ] && [ "${INTERFACE:-0}" = 1 ]; then etat_etape ok "$(texte 'Vérifications réussies.' 'Checks passed.')";fi
  noter_simule "$(texte 'Tests : executes.' 'Tests: completed.')" "$(texte 'Tests : simules, non executes.' 'Tests: simulated, not run.')"
else
  noter "$(texte 'Tests : non executes (refuse).' 'Tests: not run (declined).')"
fi
dire ''

[ "$INTERFACE" = 1 ] || proposer_kit

# --- Resume -------------------------------------------------------------
INSTALLATION_INCOMPLETE=0
if [ "$DRY_RUN" != 1 ] && { [ "$NODE_OK" != 1 ] || [ -z "$HERDR_TROUVE" ]; }; then
  INSTALLATION_INCOMPLETE=1
  dire "$(texte 'Installation incomplète : Node.js 22+ et Herdr sont requis.' 'Incomplete installation: Node.js 22+ and Herdr are required.')"
  [ "$INTERFACE" != 1 ] || ECHEC_INTERFACE=1
fi
dire "$(texte '=== Resume ===' '=== Summary ===')"
if [ -z "$RAPPORT" ]; then dire "$(texte 'Rien a signaler.' 'Nothing to report.')"; else printf '%s\n' "$RAPPORT" | sed '/^ *$/d'; fi
dire ''
if [ "$SANS_RACCOURCI" = "1" ]; then
  dire "$(texte 'Pour démarrer : tapez « myteam » dans un nouveau terminal.' 'To start: type "myteam" in a new terminal.')"
else
  dire "$(texte 'Pour démarrer : double-cliquez sur le raccourci MyTeam du Bureau, ou tapez « myteam » dans un nouveau terminal.' 'To start: double-click the MyTeam shortcut on your Desktop, or type "myteam" in a new terminal.')"
fi
if [ -n "$HERDR_TROUVE" ]; then
  dire "$(texte "Adresse du bureau : http://127.0.0.1:$PORT_CHOISI (myteam ouvre Herdr sur la session myteam)." "Desktop address: http://127.0.0.1:$PORT_CHOISI (myteam opens Herdr in the myteam session).")"
else
  dire "$(texte "Adresse du bureau : http://127.0.0.1:$PORT_CHOISI (Herdr absent : le bureau reste consultable, sans agents)." "Desktop address: http://127.0.0.1:$PORT_CHOISI (Herdr missing: the desktop remains available, without agents).")"
fi
[ "$INSTALLATION_INCOMPLETE" = 0 ] || exit 1
if [ "$INTERFACE" = 1 ] && [ "$ECHEC_INTERFACE" = 1 ]; then exit 1;fi
