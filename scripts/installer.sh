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

DRY_RUN=0
OUI=0
PORT=""
HERDR_CHEMIN=""
SANS_RACCOURCI=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --oui) OUI=1 ;;
    --port) PORT="${2:-}"; shift ;;
    --herdr-chemin) HERDR_CHEMIN="${2:-}"; shift ;;
    --sans-raccourci) SANS_RACCOURCI=1 ;;
    --aide)
      sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Option inconnue : $1"
      echo "Lancez : bash scripts/installer.sh --aide"
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
  if [ "$DRY_RUN" = "1" ]; then simuler "$1 o/n : o (simule)"; return 0; fi
  if [ "$OUI" = "1" ] && [ "${2:-}" != "individuel" ]; then dire "$1 o/n : o (accepte automatiquement)"; return 0; fi
  while true; do
    printf '%s (o/n) : ' "$1"
    read -r reponse || return 1
    reponse=$(printf '%s' "$reponse" | tr '[:upper:]' '[:lower:]')
    case "$reponse" in
      o|oui) return 0 ;;
      n|non) return 1 ;;
      *) dire 'Repondez par o ou par n.' ;;
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
      printf 'node server.mjs > bureau.log 2> bureau-erreurs.log &\nsleep 2\n'
      printf 'if [ "$(uname)" = Darwin ]; then open %s; else xdg-open %s; fi\n' \
        "$(literal_shell "http://127.0.0.1:$PORT_CHOISI")" "$(literal_shell "http://127.0.0.1:$PORT_CHOISI")"
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

dire '=== Bureau des agents : installation ==='
dire "Dossier du projet : $RACINE"
if [ "$DRY_RUN" = "1" ]; then dire 'Mode simulation : rien ne sera installe ni modifie.'; fi
dire ''

# --- 1. Node.js ---------------------------------------------------------
dire '--- 1. Node.js (version 22 ou plus) ---'
MAJEURE=$(version_node_majeure || true)
if [ -n "$MAJEURE" ] && [ "$MAJEURE" -ge 22 ] 2>/dev/null; then
  dire "Node.js est deja present (version majeure $MAJEURE). Rien a faire."
  noter 'Node.js : deja present.'
else
  if [ -z "$MAJEURE" ]; then dire 'Node.js est absent de cet ordinateur.'
  else dire "Node.js est present mais trop ancien (version majeure $MAJEURE) : il faut la version 22 ou plus."; fi
  CMD_NODE=$(commande_node)
  if [ -n "$CMD_NODE" ] && confirmer "Installer Node.js avec votre gestionnaire de paquets ($CMD_NODE) ?" individuel; then
    executer "Installation de Node.js : $CMD_NODE" installer_node
    if [ "$DRY_RUN" != "1" ]; then
      MAJEURE=$(version_node_majeure || true)
      if [ -n "$MAJEURE" ] && [ "$MAJEURE" -ge 22 ] 2>/dev/null; then
        dire "Node.js est maintenant installe (version majeure $MAJEURE)."
        noter 'Node.js : installe.'
      else
        dire "La version proposee reste trop ancienne ou Node.js manque encore."
        dire "Installez Node 22 ou plus depuis la page officielle : https://nodejs.org/en/download"
        noter 'Node.js : a installer depuis nodejs.org.'
      fi
    else
      noter "Node.js : simulation de l'installation."
    fi
  else
    dire 'Installez Node 22 ou plus depuis la page officielle : https://nodejs.org/en/download'
    noter 'Node.js : non installe (refuse ou gestionnaire absent).'
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
dire '--- 2. Herdr (gestionnaire de terminaux) ---'
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
  dire "Herdr est present : $HERDR_TROUVE"
  noter 'Herdr : deja present.'
  if ! command -v herdr >/dev/null 2>&1; then
    dire "Herdr n'est pas dans le PATH : le bureau a besoin de la variable BUREAU_HERDR_PATH."
    if confirmer 'Enregistrer BUREAU_HERDR_PATH avec ce chemin ?'; then
      HERDR_A_ENREGISTRER="$HERDR_TROUVE"
      dire "BUREAU_HERDR_PATH sera enregistre dans votre profil : $HERDR_TROUVE"
      noter 'BUREAU_HERDR_PATH : a enregistrer (voir etape 4).'
    else
      HERDR_A_ENREGISTRER=""
      noter 'BUREAU_HERDR_PATH : non enregistre (refuse).'
    fi
  else
    HERDR_A_ENREGISTRER=""
  fi
else
  HERDR_A_ENREGISTRER=""
  dire 'Herdr est introuvable sur cet ordinateur.'
  dire "Methode d'installation officielle (documentation Herdr) :"
  dire '  macOS et Linux : curl -fsSL https://herdr.dev/install.sh | sh'
  dire '  Puis documentation complete : https://herdr.dev/docs/install/'
  if confirmer 'Installer Herdr maintenant avec la commande officielle ci-dessus ?' individuel; then
    executer 'Installation de Herdr (script officiel https://herdr.dev/install.sh).' installer_outil herdr
    if [ "$DRY_RUN" != "1" ]; then
      HERDR_TROUVE=$(chercher_herdr || true)
      if [ -n "$HERDR_TROUVE" ]; then
        dire "Herdr est maintenant installe : $HERDR_TROUVE"
        noter 'Herdr : installe.'
      else
        dire "Herdr n'a pas ete detecte. Consultez https://herdr.dev/docs/install/ puis relancez ce script."
        noter 'Herdr : a verifier.'
      fi
    else
      noter "Herdr : simulation de l'installation officielle."
    fi
  else
    dire 'Herdr reste a installer. Documentation officielle : https://herdr.dev/docs/install/'
    dire 'Le bureau ne fonctionnera pas sans Herdr ouvert.'
    noter 'Herdr : non installe (refuse).'
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

dire '--- 3. Espace Herdr avec 4 panneaux (le premier = chef) ---'
# Commandes verifiées dans l'aide de Herdr 0.9.5 : herdr workspace create,
# herdr pane split, herdr pane rename, herdr agent start <nom> --kind <type>
# --pane <id>. NON VERIFIÉ : le format exact des sorties de ces commandes.
# Si une commande échoue ou si sa sortie n'est pas lisible, la procédure
# manuelle est affichée au lieu d'échouer silencieusement.
# Aucun outil d'IA n'est lancé automatiquement : herdr agent start démarrerait
# un vrai agent, c'est à DrSmoke de le faire.
if [ -n "$HERDR_TROUVE" ]; then
  if confirmer 'Créer un espace Herdr « Bureau » avec 4 panneaux (le premier = chef) ?'; then
    if [ "$DRY_RUN" = "1" ]; then
      simuler "Création de l'espace « Bureau des agents » puis 3 découpes de panneaux."
      simuler 'Nommage des panneaux : Chef, Agent 2, Agent 3, Agent 4.'
      noter 'Panneaux Herdr : simulation.'
    else
      panneaux_ok=0
      ids=$(creer_grille_herdr) && panneaux_ok=1
      if [ "$panneaux_ok" = "1" ]; then
        dire 'Panneaux créés et nommés : Chef, Agent 2, Agent 3, Agent 4.'
        noter 'Panneaux Herdr : 4 panneaux créés et nommés.'
      fi
      if [ "$panneaux_ok" = "0" ]; then
        dire "La création automatique n'a pas abouti."
        dire 'Procédure manuelle (commandes vérifiées de Herdr) :'
        dire '  herdr workspace create --label "Bureau des agents"'
        dire '  herdr pane list                      # repérer les identifiants, ex. w6:p1'
        dire '  herdr pane split --pane w6:p1 --direction right'
        dire '  herdr pane split --pane w6:p1 --direction down'
        dire '  herdr pane split --pane w6:p2 --direction down'
        dire '  herdr pane rename w6:p1 Chef         # puis Agent 2, Agent 3, Agent 4'
        dire "  # optionnel : lancer un outil d'IA dans un panneau (non fait par ce script)"
        dire '  # herdr agent start <nom> --kind claude --pane w6:p1'
        dire '  # types vérifiés : pi, claude, codex, gemini, cursor, agy, opencode, copilot...'
        noter 'Panneaux Herdr : procédure manuelle affichée.'
      fi
    fi
  else
    noter 'Panneaux Herdr : non créés (refus).'
  fi
else
  dire "Herdr absent : l'espace de panneaux est ignoré. Installez Herdr puis relancez ce script."
  noter 'Panneaux Herdr : ignorés (Herdr absent).'
fi
dire ''

# --- 4. IA en ligne de commande (optionnelles) ---------------------------
dire "--- 4. Outils d'IA en ligne de commande (entierement optionnels) ---"
dire "Aucune cle ni aucun jeton n'est demande ici. Si un outil vous demande de vous"
dire 'connecter, faites-le dans son interface au premier lancement, jamais dans ce script.'
dire ''

proposer_outil() {
  nom="$1"; detection="$2"; installation="$3"; lien="$4"; lien2="${5:-}"
  dire "### $nom"
  if command -v "$detection" >/dev/null 2>&1; then
    dire "$nom est deja installe (commande '$detection')."
    noter "$nom : deja installe."
    dire ''
    return
  fi
  dire "Commande d'installation officielle : $installation"
  [ -n "$lien" ] && dire "Documentation : $lien"
  [ -n "$lien2" ] && dire "Documentation complémentaire : $lien2"
  if confirmer "Installer $nom ?" individuel; then
    executer "Installation de $nom : $installation" installer_outil "$detection"
    if [ "$DRY_RUN" != "1" ]; then
      if command -v "$detection" >/dev/null 2>&1; then
        dire "$nom est installe."
        noter "$nom : installe."
      else
        dire "$nom n'a pas ete detecte tout de suite. Ouvrez un nouveau terminal pour verifier."
        noter "$nom : a verifier."
      fi
    else
      noter "$nom : simulation de l'installation."
    fi
  else
    dire "$nom : non installe (refuse)."
    noter "$nom : non installe (refuse)."
  fi
  dire ''
}

proposer_outil 'Claude Code' 'claude' 'curl -fsSL https://claude.ai/install.sh | bash' 'https://code.claude.com/docs'
proposer_outil 'Codex (OpenAI)' 'codex' 'curl -fsSL https://chatgpt.com/codex/install.sh | sh' 'https://developers.openai.com/codex'
proposer_outil 'OpenCode' 'opencode' 'curl -fsSL https://opencode.ai/install | bash' 'https://opencode.ai/docs' 'Alternative avec Node.js : npm install -g opencode-ai'
proposer_outil 'Gemini CLI (Google)' 'gemini' 'npm install -g @google/gemini-cli' 'https://www.geminicli.com/docs/get-started/installation' 'Alternative : brew install gemini-cli'

dire '### Antigravity (Google)'
dire "La commande d'installation d'Antigravity CLI n'a pas pu etre verifiee :"
dire 'nous ne la donnons donc pas. Suivez sa documentation officielle :'
dire '  https://antigravity.google/product/antigravity-cli'
dire '  https://antigravity.google/docs/cli/getting-started'
dire 'Note : Google annonce que Gemini CLI cede la place a Antigravity CLI pour les'
dire 'comptes gratuits et Google One :'
dire '  https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli'
noter 'Antigravity : documentation seule (methode non verifiee).'
dire ''

# --- 5. Extensions utiles (optionnelles) --------------------------------
dire '--- 5. Extensions utiles pour ce projet (optionnelles) ---'
# Trois extensions vérifiées sur le marché VS Code le 17 octobre 2026, avec
# leurs éditeurs : yzhang.markdown-all-in-one (Yu Zhang), dbaeumer.vscode-eslint
# (Microsoft), esbenp.prettier-vscode (Prettier).
if confirmer 'Veux-tu voir la liste des extensions proposées pour ce projet ?'; then
  dire '  1. Markdown All in One : yzhang.markdown-all-in-one (Yu Zhang) : table des matières et confort Markdown.'
  dire '  2. ESLint : dbaeumer.vscode-eslint (Microsoft) : contrôle du JavaScript et du TypeScript.'
  dire '  3. Prettier - Code formatter : esbenp.prettier-vscode (Prettier) : mise en forme cohérente du code.'
  if ! command -v code >/dev/null 2>&1; then
    dire "VS Code n'est pas détecté sur cet ordinateur : l'installation des extensions est ignorée."
    noter 'Extensions : ignorées (VS Code absent).'
  else
    for ext in 'Markdown All in One|yzhang.markdown-all-in-one' 'ESLint|dbaeumer.vscode-eslint' 'Prettier - Code formatter|esbenp.prettier-vscode'; do
      nom="${ext%%|*}"; id="${ext##*|}"
      if confirmer "Installer l'extension $nom ($id) ?" individuel; then
        executer "Installation de $id avec code --install-extension." code --install-extension "$id"
        noter "Extension $id : proposée à l'installation."
      else
        noter "Extension $id : refusée."
      fi
    done
  fi
else
  noter 'Extensions : liste non demandée.'
fi
dire ''

# --- 6. Configuration ---------------------------------------------------
dire '--- 6. Configuration du bureau ---'
FICHIERS_PROFIL=("$HOME/.profile")
[ -f "$HOME/.bashrc" ] && FICHIERS_PROFIL+=("$HOME/.bashrc")

PORT_CHOISI=""
if [ -n "$PORT" ]; then PORT_CHOISI="$PORT"
else
  existant=$(sed -n 's/^export BUREAU_PORT="\([0-9]*\)"$/\1/p' "$HOME/.profile" 2>/dev/null | tail -n 1)
  if [ -n "$existant" ]; then
    PORT_CHOISI="$existant"
    dire "Port deja enregistre : $PORT_CHOISI"
  else
    PORT_CHOISI="4317"
  fi
fi

if [ -z "$PORT" ] && [ "$DRY_RUN" != "1" ]; then
  if ! confirmer "Utiliser le port $PORT_CHOISI pour le bureau ?"; then
    while true; do
      printf 'Entrez un port entre 1024 et 65535 : '
      read -r saisie
      case "$saisie" in
        ''|*[!0-9]*) dire 'Port invalide.' ;;
        *)
          if [ "$saisie" -ge 1024 ] && [ "$saisie" -le 65535 ]; then PORT_CHOISI="$saisie"; break; fi
          dire 'Port invalide.'
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
      simuler "Mise a jour du bloc de configuration dans $fichier (BUREAU_PORT=$PORT_CHOISI)."
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
    dire "Configuration ecrite dans $fichier."
  done
}
ecrire_profil
noter "BUREAU_PORT : $PORT_CHOISI (ecrit dans le profil)."
if [ -n "$HERDR_A_ENREGISTRER" ]; then noter "BUREAU_HERDR_PATH : $HERDR_A_ENREGISTRER (ecrit dans le profil)."; fi

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
    simuler 'Question du raccourci : 1 = Herdr, 2 = le bureau dans le navigateur (défaut 2).'
  elif [ "$OUI" = "1" ]; then
    dire 'Raccourci : choix automatique « le bureau » (--oui).'
  else
    printf 'Que doit lancer le raccourci du Bureau ? 1 = Herdr, 2 = le bureau dans le navigateur (défaut 2) : '
    read -r choix_saisi
    [ "$choix_saisi" = "1" ] && CHOIX_LANCEUR='herdr'
  fi
  if [ "$CHOIX_LANCEUR" = "herdr" ]; then
    HERDR_LANCEUR="$HERDR_TROUVE"
    [ -z "$HERDR_LANCEUR" ] && HERDR_LANCEUR=$(command -v herdr 2>/dev/null || true)
    if [ -z "$HERDR_LANCEUR" ]; then
      dire 'Herdr est introuvable : le raccourci Herdr est ignoré.'
      noter 'Raccourci : Herdr absent.'
    elif confirmer 'Créer le raccourci « Ouvrir le bureau » qui lance Herdr ?'; then
      if [ "$(uname)" = "Darwin" ]; then
        RACCOURCI="$DOSSIER_BUREAU/Ouvrir le bureau.command"
        if [ "$DRY_RUN" = "1" ]; then
          simuler "Création du raccourci $RACCOURCI (lance Herdr)."
        else
          ecrire_lanceur "$RACCOURCI" herdr
          dire "Raccourci créé : $RACCOURCI"
        fi
      else
        RACCOURCI="$DOSSIER_BUREAU/ouvrir-le-bureau.desktop"
        if [ "$DRY_RUN" = "1" ]; then
          simuler "Création du raccourci $RACCOURCI (lance Herdr)."
        else
          ecrire_desktop "$RACCOURCI" "$HERDR_LANCEUR" true || exit 1
          dire "Raccourci créé : $RACCOURCI"
        fi
      fi
      noter 'Raccourci : créé (lance Herdr).'
    else
      noter 'Raccourci : non créé (refus).'
    fi
  elif [ "$(uname)" = "Darwin" ]; then
    RACCOURCI="$DOSSIER_BUREAU/Ouvrir le bureau.command"
    question="Créer le raccourci « Ouvrir le bureau » qui ouvre le bureau dans le navigateur ?"
    [ -f "$RACCOURCI" ] && question="Le raccourci existe déjà. Le remplacer ($RACCOURCI) ?"
    if confirmer "$question"; then
      if [ "$DRY_RUN" = "1" ]; then
        simuler "Création du raccourci $RACCOURCI (lance node server.mjs puis ouvre le navigateur)."
      else
        ecrire_lanceur "$RACCOURCI" bureau
        dire "Raccourci créé : $RACCOURCI"
      fi
      noter 'Raccourci : créé.'
    else
      noter 'Raccourci : non créé (refus).'
    fi
  else
    RACCOURCI="$DOSSIER_BUREAU/ouvrir-le-bureau.desktop"
    question="Créer le raccourci « Ouvrir le bureau » qui ouvre le bureau dans le navigateur ?"
    [ -f "$RACCOURCI" ] && question="Le raccourci existe déjà. Le remplacer ($RACCOURCI) ?"
    if confirmer "$question"; then
      if [ "$DRY_RUN" = "1" ]; then
        simuler "Création du raccourci $RACCOURCI (lance node server.mjs puis ouvre le navigateur)."
      else
        LANCEUR="$DOSSIER_BUREAU/Ouvrir le bureau.command"
        ecrire_lanceur "$LANCEUR" bureau
        ecrire_desktop "$RACCOURCI" "$LANCEUR" false || exit 1
        dire "Raccourci créé : $RACCOURCI"
      fi
      noter 'Raccourci : créé.'
    else
      noter 'Raccourci : non créé (refus).'
    fi
  fi
fi
dire ''

# --- 7. Tests -----------------------------------------------------------
dire '--- 7. Tests du projet ---'
if [ "$NODE_OK" != "1" ]; then
  dire 'Node.js manquant ou trop ancien : tests ignores. Relancez ce script apres installation.'
  noter 'Tests : ignores (Node.js absent).'
elif confirmer 'Lancer npm test et npm run check maintenant ?'; then
  (cd -- "$RACINE" && executer 'Execution de npm test.' npm test)
  (cd -- "$RACINE" && executer 'Execution de npm run check.' npm run check)
  noter 'Tests : executes.'
else
  noter 'Tests : non executes (refuse).'
fi
dire ''

# --- Resume -------------------------------------------------------------
dire '=== Resume ==='
if [ -z "$RAPPORT" ]; then dire 'Rien a signaler.'; else printf '%s\n' "$RAPPORT" | sed '/^ *$/d'; fi
dire ''
dire "Pour ouvrir le bureau : lancez 'node server.mjs' dans $RACINE"
dire "puis ouvrez http://127.0.0.1:$PORT_CHOISI (ou utilisez le raccourci cree)."
dire 'Herdr doit etre ouvert pour que le bureau voie vos agents.'
