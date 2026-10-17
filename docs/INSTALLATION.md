# Installer le Bureau des agents

Le Bureau des agents est une petite application locale : elle s'ouvre dans votre navigateur, montre vos agents Herdr au travail et vous permet de leur écrire. Tout reste sur votre ordinateur, sur l'adresse 127.0.0.1. Aucune clé API ni aucun jeton n'est demandé, lu ou enregistré par le bureau ni par ses scripts d'installation.

## Prérequis

- Windows 10 ou 11, macOS, ou Linux.
- Node.js version 22 ou plus (le script d'installation vérifie et propose de l'installer).
- Herdr, ouvert avant de lancer le bureau : c'est lui qui détecte vos agents.
- Facultatif : une ou plusieurs IA en ligne de commande (Claude Code, Codex, OpenCode, Gemini CLI, Antigravity). Le bureau fonctionne sans aucune d'entre elles : il se contente de montrer celles que Herdr voit.

## Installation en une commande

**Windows** (ouvrir PowerShell dans le dossier du projet, puis) :

```powershell
powershell -ExecutionPolicy Bypass -File scripts\installer.ps1
```

**macOS ou Linux** (ouvrir un terminal dans le dossier du projet, puis) :

```bash
bash scripts/installer.sh
```

Le script vérifie d'abord, puis propose chaque installation avec une question « o/n ». Il n'installe rien sans votre accord. Options utiles :

| Option Windows | Option macOS / Linux | Effet |
|---|---|---|
| `-DryRun` | `--dry-run` | Simulation : affiche tout ce qui serait fait, sans rien installer ni modifier |
| `-Oui` | `--oui` | Accepte automatiquement toutes les questions « o/n » |
| `-Port 8317` | `--port 8317` | Choisit le port du bureau (sinon 4317) |
| `-HerdrChemin chemin\herdr.exe` | `--herdr-chemin chemin/herdr` | Indique Herdr s'il n'est pas dans le PATH |
| `-SansRaccourci` | `--sans-raccourci` | Ne propose pas le raccourci « Ouvrir le bureau » |
| `-Aide` | `--aide` | Affiche l'aide du script |

Le script peut être relancé autant de fois qu'on veut : il vérifie ce qui est déjà en place et ne touche qu'à ce qui manque. À la fin, il affiche un résumé de ce qui est installé, de ce qui reste à faire et de ce qui a été refusé.

## Installation manuelle

### 1. Node.js (version 22 ou plus)

- **Windows** : `winget install OpenJS.NodeJS.LTS` (paquet vérifié dans le dépôt winget), ou l'installateur depuis la page officielle https://nodejs.org/en/download
- **macOS** : `brew install node`
- **Debian / Ubuntu** : `sudo apt-get update && sudo apt-get install -y nodejs npm` puis vérifier la version avec `node --version` : si elle est inférieure à 22, le paquet de la distribution est trop vieux, prenez Node sur https://nodejs.org/en/download
- **Fedora / RHEL** : `sudo dnf install -y nodejs npm`, même vérification de version

Vérification : `node --version` doit afficher v22 ou plus.

### 2. Herdr

Herdr est le gestionnaire de terminaux qui détecte vos agents. Commandes officielles d'installation, tirées de la documentation Herdr (https://herdr.dev/docs/install/) :

- **Windows PowerShell** : `powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"`
- **Windows, si un antivirus bloque la commande ci-dessus** : `curl.exe -fsSLo install.cmd https://herdr.dev/install.cmd && install.cmd && del install.cmd`
- **macOS et Linux** : `curl -fsSL https://herdr.dev/install.sh | sh`

Puis lancer `herdr` une première fois. Vérification : `herdr --version`. Pour mettre à jour : `herdr update`.

Si Herdr est installé mais absent du PATH, le bureau peut quand même l'utiliser : réglez la variable `BUREAU_HERDR_PATH` sur le chemin complet de l'exécutable (par exemple `C:\Users\vous\.herdr\packages\standalone\releases\0.9.5-x86_64-pc-windows-msvc\herdr.exe` ou l'équivalent dans `~/.herdr/packages` sur macOS et Linux).

### 3. Le projet

1. Copiez le dossier du projet à l'emplacement de votre choix (aucun dépôt distant n'est nécessaire).
2. Lancez le serveur :

```powershell
node server.mjs
```

3. Ouvrez http://127.0.0.1:4317 dans votre navigateur.

Sous Windows, un double-clic sur « Ouvrir le bureau.cmd » fait les étapes 2 et 3 tout seul.

### 4. Les IA en ligne de commande (facultatif)

Installez uniquement celles dont vous vous servez. Chaque outil gère sa propre connexion dans son interface : ne donnez jamais de clé à un script tiers.

| Outil | Commande d'installation vérifiée | Documentation officielle |
|---|---|---|
| Claude Code | Windows PowerShell : `irm https://claude.ai/install.ps1 \| iex` ; macOS et Linux : `curl -fsSL https://claude.ai/install.sh \| bash` ; aussi `winget install Anthropic.ClaudeCode` et `brew install --cask claude-code` | https://code.claude.com/docs |
| Codex (OpenAI) | macOS et Linux : `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` ; Windows : `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 \| iex"` ; aussi `npm install -g @openai/codex` | https://developers.openai.com/codex |
| OpenCode | `curl -fsSL https://opencode.ai/install \| bash` ; aussi `npm install -g opencode-ai`, `scoop install opencode` ou `choco install opencode` | https://opencode.ai/docs |
| Gemini CLI | `npm install -g @google/gemini-cli` ; aussi `brew install gemini-cli` | https://www.geminicli.com/docs/get-started/installation |
| Antigravity | Commande non vérifiée : nous ne la donnons pas | https://antigravity.google/product/antigravity-cli et https://antigravity.google/docs/cli/getting-started |

Deux points d'honnêteté :

- La commande d'installation d'Antigravity CLI n'a pas pu être vérifiée sur sa documentation officielle au moment de la rédaction : suivez le lien ci-dessus plutôt qu'une commande inventée.
- Google annonce que Gemini CLI cède la place à Antigravity CLI pour les comptes gratuits et Google One (annonce du 18 juin 2026 : https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli). Gemini CLI s'installe toujours, mais regardez cette annonce avant de choisir.

## Configuration

| Variable | Rôle | Comment la régler |
|---|---|---|
| `BUREAU_PORT` | Port du bureau (4317 par défaut) | Script d'installation, ou variable d'environnement de l'utilisateur |
| `BUREAU_HERDR_PATH` | Chemin complet de Herdr s'il n'est pas dans le PATH | Script d'installation, ou variable d'environnement de l'utilisateur |

Le script d'installation écrit ces réglages dans les variables de l'utilisateur (Windows) ou dans un bloc marqué entre `# >>> bureau-des-agents >>>` et `# <<< bureau-des-agents <<<` dans `~/.profile` et `~/.bashrc` (macOS et Linux). Ce bloc est remplacé proprement à chaque relance : jamais de doublon. Ouvrez un nouveau terminal après la configuration pour que les variables soient prises en compte.

## Vérifier que tout va bien

1. `npm test` : la suite de tests doit passer (57 tests réussis, 1 ignoré sans gravité).
2. `npm run check` : vérifie la syntaxe de tous les fichiers du projet.
3. `node server.mjs` puis http://127.0.0.1:4317 : le bureau affiche les agents réellement ouverts dans Herdr.

## Dépannage

- **« Le port du bureau est déjà utilisé »** : un autre programme occupe le port. Changez de port avec `BUREAU_PORT` (par exemple 8317) et relancez.
- **« Herdr est introuvable »** : Herdr n'est ni dans le PATH ni dans `~/.herdr`. Installez-le (voir plus haut) ou réglez `BUREAU_HERDR_PATH` sur son exécutable. Vérification rapide : `herdr --version`.
- **Le bureau démarre mais aucun agent n'apparaît** : Herdr doit être ouvert avec vos agents lancés dans ses panneaux. Le bureau n'invente rien : s'il ne voit personne, c'est que Herdr ne voit personne non plus.
- **403 « Adresse locale requise »** : ouvrez le bureau avec l'adresse exacte http://127.0.0.1:4317 (et non http://localhost:4317).
- **« Session expirée. Actualisez le bureau. »** : le serveur a redémarré. Actualisez simplement la page du navigateur.
- **Le bureau ne démarre pas** : consultez les fichiers `bureau.log` et `bureau-erreurs.log` dans le dossier du projet ; ils contiennent la sortie du serveur.
- **Node.js absent ou trop vieux** : `node --version` doit montrer v22 ou plus. Réinstallez depuis https://nodejs.org/en/download, ouvrez un nouveau terminal, puis relancez le script d'installation.
- **Un antivirus bloque une commande d'installation** : c'est le cas des commandes « sans fichier » de type `irm ... | iex`. Les pages officielles de Herdr et de Claude Code proposent une variante avec téléchargement d'un fichier `install.cmd` (voir les commandes ci-dessus).
- **Les tests échouent** : vérifiez d'abord la version de Node.js, puis relancez `npm test`. Si un test reste en échec, notez son nom exact : il indique la fonction concernée.
- **Je veux tout enlever** : supprimez le dossier du projet, le raccourci du Bureau s'il existe, et les variables `BUREAU_PORT` et `BUREAU_HERDR_PATH`. Node.js, Herdr et les IA se désinstallent séparément, via leurs propres méthodes.

## Sources vérifiées

Les commandes ci-dessus ont été relevées le 17 octobre 2026 sur les pages officielles : nodejs.org (versions disponibles), le dépôt winget local (identifiant `OpenJS.NodeJS.LTS`), herdr.dev (guide d'agent et documentation d'installation), code.claude.com/docs, github.com/openai/codex, opencode.ai/docs, github.com/google-gemini/gemini-cli. La commande d'Antigravity CLI est la seule non vérifiée : seul son lien officiel est donné.
