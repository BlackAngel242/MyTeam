# Installer le Bureau des agents

**Français** | [English](INSTALLATION.en.md)

Le Bureau des agents est une petite application locale : elle s'ouvre dans votre navigateur, montre vos agents Herdr au travail et vous permet de leur écrire. Le serveur écoute sur `127.0.0.1` ; les outils d’IA peuvent utiliser leurs propres services distants. Aucune clé API ni aucun jeton n'est demandé, lu ou enregistré par le bureau ni par ses scripts d'installation.

## Choisir le projet avant de travailler (0.5.0)

Au démarrage, choisissez **Améliorer MyTeam** pour travailler sur le logiciel, ou **Créer ou reprendre un autre projet** pour votre propre dossier. Sélectionnez et validez les dossiers avant toute consigne. Le dossier et le projet actifs restent visibles ; **Changer de projet** revient à l’écran de choix `/demarrage` et arrête l’ancien contexte. Les agents doivent travailler dans les dossiers sélectionnés : un agent d’un autre projet n’est pas une cible autorisée.

La mémoire d’exécution (file, direction, autonomie et configuration) est privée, séparée par projet dans le dossier de données du système sous `MyTeam`, hors du checkout. Emplacements : Windows `%LOCALAPPDATA%/MyTeam`, macOS `~/Library/Application Support/MyTeam`, Linux `$XDG_DATA_HOME/MyTeam` ou `~/.local/share/MyTeam`. Chaque projet possède son sous-dossier `projects/<empreinte du chemin canonique>`. Une ancienne installation n’est pas importée automatiquement. Changer de projet ne rejoue pas les anciennes consignes.

Les documents techniques relus peuvent être partagés volontairement. Le kit crée ses notes `HANDOFF.md` et `JOURNAL.md` dans `.myteam-local/`, ignoré par Git, et n’écrase aucun fichier existant. `.gitignore` ne protège pas un fichier déjà suivi ou ajouté de force ; vérifiez les fichiers avant publication. Les outils d’IA conservent leurs propres journaux, droits et connexions : MyTeam ne fournit pas de bac à sable système pour ces outils.

## Prérequis

- Windows 10 ou 11, macOS, ou Linux.
- Node.js version 22 ou plus (le script d'installation vérifie et propose de l'installer).
- Herdr, ouvert avant de lancer le bureau : c'est lui qui détecte vos agents.
- Facultatif : une ou plusieurs IA en ligne de commande (Claude Code, Codex, OpenCode, Gemini CLI, Antigravity). Le bureau fonctionne sans aucune d'entre elles : il se contente de montrer celles que Herdr voit.

## Ce que fait et ne fait pas l'installation

### Ce que fait l'installation

- **Vérification rigoureuse** : Contrôle la présence et la version minimale de Node.js (>= 22) et de Herdr.
- **Confort du terminal (Clink sous Windows)** : Propose l'installation facultative de Clink via winget (`chrisant996.Clink`) pour enrichir cmd.exe avec l'historique persistant, l'autocomplétion et la coloration.
- **Grille Herdr 2×2** : Prépare automatiquement un espace de travail à 4 panneaux nommés `Chef`, `Agent 2`, `Agent 3` et `Agent 4`.
- **Détection des 24 outils Herdr** : Repère dans votre PATH tous les exécutables compatibles reconnus par Herdr (`pi`, `claude`, `codex`, `gemini`, `cursor`, `devin`, `agy`, `cline`, `omp`, `mastracode`, `opencode`, `copilot`, `kimi`, `kiro`, `droid`, `amp`, `grok`, `hermes`, `kilo`, `qodercli`, `qwen`, `letta`, `maki`, `muse`).
- **Lancement d'agents sur mesure** : Propose panneau par panneau de lancer l'outil de votre choix, sans jamais rien imposer.
- **Intégrations Herdr officielles** : Propose d'exécuter `herdr integration install <outil>` pour les outils détectés, en prévenant qu'elle modifie leur configuration.
- **Orientation du chef** : Installe la compétence officielle (`herdr --skill`) pour Claude Code ou oriente vers `CHEF.md` pour les autres outils, puis propose d'envoyer la consigne d'orientation au premier panneau.
- **Extensions recommandées** : Propose 3 extensions VS Code utiles au projet (`Markdown All in One`, `ESLint`, `Prettier`).
- **Configuration locale** : Enregistre `BUREAU_PORT` et `BUREAU_HERDR_PATH` dans votre profil utilisateur, sans doublon.
- **Raccourci au choix** : Crée au choix un lanceur pour Herdr seul, pour le bureau Web seul, ou un lanceur combiné « Herdr et bureau ».
- **Kit d'équipe** : Propose d'initialiser les fichiers de collaboration d'équipe (`init-kit.mjs`) dans le dossier de projet de votre choix.
- **Vérification immédiate** : Propose de valider l'environnement en exécutant `npm test` et `npm run check`.
- **Interface animée ou texte** : Disponible en version animée interactive en direct (`scripts/installateur-anime.mjs` avec bannière pixel art et liste de tâches en temps réel) ou en mode texte classique.

### Ce que ne fait PAS l'installation

- **Aucune dépendance npm externe** : Le projet ne contient aucun `node_modules` et ne fait aucun `npm install`.
- **Aucune collecte de clés ou secrets** : Aucun mot de passe, jeton ou clé API n'est demandé ni manipulé. Chaque IA gère sa propre authentification.
- **Aucune installation automatique forcée** : L'option `-Oui` / `--oui` ne valide JAMAIS d'installation de logiciel, d'intégration, de lancement d'agent ou de kit d'équipe. Chaque action sensible exige un accord interactif « o/n ».
- **Aucun écrasement de fichier** : Les scripts ne remplacent jamais vos compétences existantes ni vos fichiers de projet.
- **Aucun appel réseau extérieur non maîtrisé** : Le serveur écoute exclusivement sur l'interface locale `127.0.0.1`.

## Méthode 1 : Installation par la release (recommandée)

Cette méthode est la plus simple et ne nécessite aucun outil de développement préalable (ni Git, ni compilateur).

1. **Télécharger l'archive** : Rendez-vous sur la page des [Releases du projet sur GitHub](https://github.com/BlackAngel242/MyTeam/releases) et téléchargez le fichier ZIP de la dernière version stable.
2. **Décompresser l'archive** : Extrayez l'ensemble des fichiers dans le dossier de votre choix (par exemple dans votre dossier personnel ou vos documents).
3. **Lancer l'installation** :
   - **Sous Windows** : double-cliquez sur `Installer MyTeam.bat`.
     * **Mode animé** : Si Node.js (version 22 ou plus) est déjà présent sur votre machine, l'installeur animé démarre directement dans le terminal (bannière en pixel art dégradé, liste de tâches actualisée en temps réel avec pastilles colorées et spinner, étape Clink facultative pour le confort de cmd.exe, et questions interactives).
     * **Repli texte si Node.js est absent** : Si Node.js est absent ou dans une version antérieure à 22, le fichier `.bat` bascule automatiquement sur l'installeur texte sécurisé via PowerShell pour vous proposer d'installer Node.js via winget. Une fois l'installation de Node.js validée, fermez et relancez simplement `Installer MyTeam.bat` pour profiter de l'expérience animée.
   - **Sous macOS ou Linux** : ouvrez un terminal dans le dossier décompressé et exécutez :
     ```bash
     bash scripts/installer.sh
     ```
     *(ou `node scripts/installateur-anime.mjs` si Node.js 22+ est déjà installé)*

> [!NOTE]
> **Avertissement de sécurité Windows SmartScreen** : Comme tout script `.bat` téléchargé depuis Internet sans certificat de signature commercial coûteux, Windows SmartScreen peut afficher une boîte d'alerte bleue préventive indiquant « Windows a protégé votre ordinateur ». Vous pouvez exécuter l'installeur en toute sécurité :
> - Cliquez sur **Informations complémentaires**, puis sur le bouton **Exécuter quand même**.
> - Ou en amont : faites un clic droit sur `Installer MyTeam.bat` (ou sur l'archive ZIP avant extraction) > **Propriétés** > cochez la case **Débloquer** en bas de l'onglet Général > cliquez sur **OK**.

> [!TIP]
> **Mode démonstration** : Vous pouvez observer l'animation de l'installeur sans rien installer, sans connexion réseau et sans modifier votre machine en lançant :
> ```bash
> node scripts/installateur-anime.mjs --demo
> ```

## Méthode 2 : Installation depuis le dépôt Git (développeurs)

Pour contribuer au projet ou cloner la dernière version de la branche `main` :

```bash
git clone https://github.com/BlackAngel242/MyTeam.git
cd MyTeam
```

Puis lancez le script correspondant à votre environnement :

- **Sous Windows (PowerShell) :**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\installer.ps1
  ```
  *(ou double-cliquez directement sur `Installer MyTeam.bat`)*

- **Sous macOS ou Linux (bash) :**
  ```bash
  bash scripts/installer.sh
  ```

### Options de ligne de commande

Les scripts `scripts/installer.ps1` et `scripts/installer.sh`, ainsi que le lanceur animé `scripts/installateur-anime.mjs`, acceptent des options pour personnaliser l'installation :

| Option Windows | Option macOS / Linux | Option animateur Node | Effet |
|---|---|---|---|
| `-DryRun` | `--dry-run` | `--dry-run` | Simulation : affiche toutes les actions prévues sans rien modifier ni exécuter. |
| `-Oui` | `--oui` | (non transmis) | Accepte les choix de configuration courants, mais n'auto-approuve jamais les installations logicielles, intégrations, lancements d'agents ni le kit (un accord individuel o/n reste obligatoire). |
| `-Port 8317` | `--port 8317` | `--port 8317` | Spécifie le port HTTP du bureau (défaut : 4317 ou variable `BUREAU_PORT` existante). |
| `-HerdrChemin chemin\herdr.exe` | `--herdr-chemin chemin/herdr` | (détection PATH) | Indique l'emplacement complet de l'exécutable Herdr s'il est absent du PATH. |
| `-SansRaccourci` | `--sans-raccourci` | (non transmis) | Ne propose pas la création du raccourci sur le Bureau. |
| `-Lang fr` ou `-Lang en` | `--lang fr` ou `--lang en` | `--lang fr` ou `--lang en` | Force la langue des messages du script (par défaut, détecte la langue du système). |
| `-Interface` | `--interface` | (activé par défaut) | Mode protocole de communication avec l'installeur animé. |
| (non applicable) | (non applicable) | `--demo` | Démonstration interactive de l'animation sans rien installer ni réseau. |
| (non applicable) | (non applicable) | `--simple` | Sortie texte simple sans ANSI ni repositionnement de curseur (utilisé automatiquement hors terminal TTY). |
| `-Aide` | `--aide` | (non applicable) | Affiche l'aide détaillée du script en ligne de commande. |

Le script peut être relancé sans risque : il inspecte l'état du système et n'agit que sur les éléments manquants.

### Déroulement détaillé des étapes

1. **Node.js (version 22 ou plus)** : Le script vérifie la présence de Node.js. S'il est absent ou trop ancien, il propose son installation via le gestionnaire officiel de votre système (`winget` sous Windows, `brew` sous macOS, ou paquet de votre distribution Linux).
2. **Clink (confort du terminal sous Windows)** : Si vous êtes sous Windows et que winget est disponible, le script propose l'installation facultative de Clink (`chrisant996.Clink`) qui ajoute l'historique persistant des commandes, l'autocomplétion avancée et des couleurs conviviales à cmd.exe. L'étape est sautée automatiquement si Clink est déjà présent ou si winget est indisponible.
3. **Herdr (gestionnaire de terminaux)** : Recherche de l'exécutable dans le PATH ou dans `~/.herdr`. S'il est introuvable, le script affiche la méthode officielle Herdr et propose son installation interactive. Si Herdr est installé hors du PATH, il enregistre `BUREAU_HERDR_PATH`.
4. **Espace Herdr à 4 panneaux en grille 2×2** : Création d'un espace « Bureau des agents » (`herdr workspace create`), découpage latéral à droite (`herdr pane split --direction right`) puis découpage vers le bas dans chaque colonne (`--direction down`) pour former une grille 2×2 parfaite. Les quatre panneaux sont automatiquement renommés `Chef`, `Agent 2`, `Agent 3` et `Agent 4`. En cas d'aléa ou de format non standard, la procédure manuelle exacte est affichée.
5. **Détection des 24 outils et lancement facultatif** : Le script teste dans votre environnement les 24 outils gérés par Herdr : `pi`, `claude`, `codex`, `gemini`, `cursor`, `devin`, `agy`, `cline`, `omp`, `mastracode`, `opencode`, `copilot`, `kimi`, `kiro`, `droid`, `amp`, `grok`, `hermes`, `kilo`, `qodercli`, `qwen`, `letta`, `maki`, `muse`. Pour chaque panneau (`Chef`, `Agent 2`, `Agent 3`, `Agent 4`), il affiche la liste numérotée des outils trouvés et propose de lancer l'outil choisi via `herdr agent start <nom> --kind <outil> --pane <id>` après confirmation individuelle « o/n ».
6. **Intégrations Herdr officielles** : Pour chaque outil détecté compatible avec les intégrations Herdr (`pi`, `omp`, `claude`, `codex`, `copilot`, `devin`, `droid`, `kimi`, `opencode`, `kilo`, `hermes`, `qodercli`, `qwen`, `letta`, `cursor`, `mastracode`, `antigravity-cli`, `grok`), le script propose d'exécuter `herdr integration install <outil>`. Le script rappelle explicitement que cette action modifie la configuration de l'outil et demande votre confirmation.
7. **Commandes du chef et consigne d'orientation** :
   - Si Claude Code est choisi pour le chef, le script propose d'extraire la compétence officielle (`herdr --skill`) et de l'écrire sans écrasement dans `~/.claude/skills/herdr/SKILL.md`.
   - Pour les autres outils, le script indique que le fichier `CHEF.md` du kit d'équipe contient toutes les directives nécessaires.
   - Le script prépare ensuite la consigne d'orientation vérifiée :
     *« Tu es le chef de l'équipe. Lis AGENTS.md et CHEF.md, liste les agents avec `herdr agent list`, puis attends les instructions de DrSmoke. »*
     Il propose de l'expédier directement dans le premier panneau via `herdr agent prompt <id>` après accord.
8. **Extensions utiles pour VS Code** (facultatif) : Si VS Code (`code`) est détecté, le script propose d'installer une par une trois extensions vérifiées : `yzhang.markdown-all-in-one` (Markdown All in One), `dbaeumer.vscode-eslint` (ESLint) et `esbenp.prettier-vscode` (Prettier).
9. **Configuration du port et raccourci sur le Bureau** :
   - Choix du port HTTP d'écoute (4317 par défaut), sauvegardé dans les variables d'environnement utilisateur.
   - Création du raccourci sur le Bureau avec 3 options au choix :
     * Option 1 : Lance Herdr directement.
     * Option 2 : Lance le Bureau dans votre navigateur (démarre `node server.mjs` puis ouvre l'adresse locale).
     * Option 3 : « Herdr et bureau » : lance Herdr dans un terminal visible, démarre le serveur du bureau et ouvre votre navigateur.
10. **Tests du projet** : Si Node.js est validé, proposition de lancer `npm test` et `npm run check` pour attester du bon fonctionnement.
11. **Étape kit d'équipe** : Proposition d'initialiser le kit de collaboration (`node scripts/init-kit.mjs <dossier> --lang <fr|en>`) dans un répertoire de projet pour y déployer les règles `AGENTS.md`, les consignes `CHEF.md`, la mémoire `LESSONS.md` et les fichiers de suivi.

## Parcours après installation (en 6 étapes)

Une fois l'installation terminée, suivez ce parcours pour démarrer votre session :

1. **Ouvrir le raccourci** : Double-cliquez sur le raccourci « Herdr et bureau » créé sur votre Bureau (ou lancez `herdr` dans un terminal puis démarrez `node server.mjs`).
2. **Voir les 4 panneaux dans la grille 2×2 et le bureau animé dans le navigateur** : Vérifiez que Herdr affiche vos 4 terminaux (`Chef`, `Agent 2`, `Agent 3`, `Agent 4`) et ouvrez l'adresse `http://127.0.0.1:4317` dans votre navigateur puis choisissez et validez le projet avant d’ouvrir son bureau.
3. **Le chef lit CHEF.md** : Dans le panneau du chef (ou via l'onglet Poste du bureau Web), le chef prend connaissance de `CHEF.md` et `AGENTS.md`, interroge ses équipiers avec la commande `herdr agent list` et se tient prêt à coordonner le travail.
4. **Première délégation** : Envoyez une mission au chef depuis le formulaire du bureau (Ctrl+Entrée). Dès que le chef confie une tâche dans son journal, observez sa tournée physique dans la scène : il quitte son bureau Direction pour aller déposer le dossier sur le poste de son collaborateur.
5. **Onglet Tâches** : Basculez sur l'onglet Tâches pour suivre en temps réel la progression factuelle des cases cochées dans `TODO.md` et des plans d'action publiés par les agents, sans pourcentage inventé.
6. **Salle de crise** : Repérez le bouton sous clapet « Salle de crise » en haut du bureau (accessible par le raccourci `Ctrl+Maj+C`) permettant d'interrompre instantanément les départs de consignes en cas d'urgence et d'envoyer un arrêt poli (touche Échap) sans jamais détruire les processus.

## Installation manuelle

### 1. Node.js (version 22 ou plus)

- **Windows** : `winget install OpenJS.NodeJS.LTS` (paquet vérifié dans le dépôt winget), ou installateur officiel depuis https://nodejs.org/en/download
- **macOS** : `brew install node`
- **Debian / Ubuntu** : `sudo apt-get update && sudo apt-get install -y nodejs npm` puis vérifier la version avec `node --version` (si inférieure à 22, télécharger Node sur https://nodejs.org/en/download)
- **Fedora / RHEL** : `sudo dnf install -y nodejs npm`, même vérification de version

Vérification : `node --version` doit afficher v22 ou plus.

### 2. Herdr

Herdr est le gestionnaire de terminaux qui détecte vos agents. Commandes officielles d'installation (https://herdr.dev/docs/install/) :

- **Windows PowerShell** : `powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"`
- **Windows, si un antivirus bloque la commande ci-dessus** : `curl.exe -fsSLo install.cmd https://herdr.dev/install.cmd && install.cmd && del install.cmd`
- **macOS et Linux** : `curl -fsSL https://herdr.dev/install.sh | sh`

Puis lancer `herdr` une première fois. Vérification : `herdr --version`. Pour mettre à jour : `herdr update`.

Si Herdr est installé mais absent du PATH, réglez la variable `BUREAU_HERDR_PATH` sur le chemin complet de l'exécutable (par exemple `C:\Users\vous\.herdr\packages\standalone\releases\0.9.5-x86_64-pc-windows-msvc\herdr.exe` ou l'équivalent dans `~/.herdr/packages` sur macOS et Linux).

### 3. Le projet

1. Copiez le dossier du projet à l'emplacement de votre choix.
2. Lancez le serveur local :

```powershell
node server.mjs
```

3. Ouvrez http://127.0.0.1:4317 dans votre navigateur.

Sous Windows, un double-clic sur `Ouvrir le bureau.cmd` réalise les étapes 2 et 3 automatiquement.

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
- La commande d'installation d'Antigravity CLI n'a pas pu être vérifiée sur sa documentation officielle au moment de la rédaction : suivez le lien officiel ci-dessus plutôt qu'une commande inventée.
- Google annonce que Gemini CLI cède la place à Antigravity CLI pour les comptes gratuits et Google One (annonce du 18 juin 2026 : https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli). Gemini CLI s'installe toujours, mais consultez cette note avant de choisir.

## Configuration

| Variable | Rôle | Comment la régler |
|---|---|---|
| `BUREAU_PORT` | Port du bureau (4317 par défaut) | Script d'installation, ou variable d'environnement utilisateur |
| `BUREAU_HERDR_PATH` | Chemin complet de Herdr s'il n'est pas dans le PATH | Script d'installation, ou variable d'environnement utilisateur |

Le script d'installation écrit ces réglages dans les variables d'environnement de l'utilisateur (Windows) ou dans un bloc marqué entre `# >>> bureau-des-agents >>>` et `# <<< bureau-des-agents <<<` dans `~/.profile` et `~/.bashrc` (macOS et Linux). Ce bloc est remplacé proprement à chaque relance, sans doublon. Ouvrez un nouveau terminal après configuration pour que les modifications soient actives.

## Vérifier que tout va bien

1. `npm test` : la suite de tests automatisés doit passer (vérifie les modules locaux et l'intégrité).
2. `npm run check` : valide la syntaxe de l'ensemble des fichiers JavaScript du projet.
3. `node server.mjs` puis consultation de `http://127.0.0.1:4317` : le choix initial s’affiche ; après validation, le bureau affiche les agents des dossiers sélectionnés.

## Dépannage

- **« Le port du bureau est déjà utilisé »** : un autre programme occupe le port. Choisissez un autre port avec la variable `BUREAU_PORT` (par exemple 8317) et relancez le serveur.
- **« Herdr est introuvable »** : Herdr n'est ni dans le PATH ni sous `~/.herdr`. Installez-le ou renseignez `BUREAU_HERDR_PATH` avec son chemin complet. Vérification rapide : `herdr --version`.
- **Le bureau démarre mais aucun agent n'apparaît** : Herdr doit être ouvert avec des agents lancés dans ses panneaux. Le bureau n'invente rien : s'il ne voit personne, c'est que Herdr ne voit personne non plus.
- **403 « Adresse locale requise »** : ouvrez le bureau avec l'adresse IP locale exacte `http://127.0.0.1:4317` (et non `http://localhost:4317`).
- **« Session expirée. Actualisez le bureau. »** : le serveur a redémarré. Actualisez simplement la page dans votre navigateur.
- **Le serveur ne démarre pas** : ouvrez un terminal dans le dossier du projet et lancez directement `node server.mjs`. Les messages et erreurs éventuelles s'affichent en clair dans la console. Vous pouvez aussi vérifier si le port 4317 est déjà occupé (`netstat -ano | findstr 4317` sous Windows, `lsof -i :4317` sous macOS/Linux) ou si un autre processus Node tourne déjà.
- **Node.js absent ou trop vieux** : `node --version` doit indiquer v22 ou plus. Téléchargez la dernière version LTS sur https://nodejs.org/en/download puis relancez le script d'installation.
- **Un antivirus bloque une commande d'installation** : certaines protections bloquent les commandes sans fichier de type `irm ... | iex`. Utilisez la variante par fichier `install.cmd` proposée par Herdr et Claude Code.
- **Les tests échouent** : assurez-vous de la version de Node.js, puis relancez `npm test`.
- **Désinstallation complète** : supprimez le dossier du logiciel et le raccourci sur votre Bureau, puis, si vous souhaitez effacer les états privés, le dossier de données système `MyTeam` séparément, et retirez les variables d'environnement `BUREAU_PORT` et `BUREAU_HERDR_PATH`. Node.js, Herdr et les IA se désinstallent via leurs propres outils.

## Sources vérifiées

Les commandes ci-dessus ont été relevées le 17 octobre 2026 sur les pages officielles : nodejs.org, le dépôt winget local (`OpenJS.NodeJS.LTS`), herdr.dev (guide d'agent et documentation d'installation), code.claude.com/docs, github.com/openai/codex, opencode.ai/docs, github.com/google-gemini/gemini-cli. La commande d'Antigravity CLI est la seule non vérifiée : seul son lien officiel est donné.
