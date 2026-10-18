# Guide et audit de publication GitHub de MyTeam (Bureau des agents)

Ce document prépare la publication publique du projet sur GitHub, conformément aux souhaits de DrSmoke. Aucun élément n'est publié automatiquement : ce document sert de feuille de route et d'audit préalable.

## 1. Audit de partage : éléments spécifiques à la machine locale

Cet audit recense les données propres à l'ordinateur de travail ou à la session locale de DrSmoke, qui doivent être adaptées ou isolées avant une mise à disposition publique.

| Élément | Emplacement | Problème pour un utilisateur tiers | Correction proposée |
| :--- | :--- | :--- | :--- |
| Version Herdr en dur | `src/herdr.mjs` (ligne 17) | Recherche le chemin `0.9.5-x86_64-pc-windows-msvc`. Échoue sur Linux, macOS ou avec une autre version de Herdr si `BUREAU_HERDR_PATH` n'est pas défini. | Parcourir dynamiquement le dossier des versions `.herdr/packages/standalone/releases/*/herdr.exe`, ou documenter `BUREAU_HERDR_PATH`. |
| Chemin absolu de test | `docs/mission-claude.md` (ligne 7) | Mentionne `C:/Users/DrSmoke/Documents/ChatGPT/IA DESKTOP`. | Document interne de coordination : à conserver dans l'historique ou à exclure de l'archive publique. |
| Identifiants de session Herdr | `HANDOFF.md`, `JOURNAL.md` | Mentionnent les panneaux de la session de développement (`w5:p1`, `w5:p4`, etc.). | Normal dans le journal de conception, mais à préciser comme exemples dans la documentation publique. L'application lit ces valeurs dynamiquement. |
| Fichiers de journalisation locale | `bureau.log`, `bureau-erreurs.log` | Journaux locaux générés lors du lancement par le script PowerShell. | Déjà ignorés dans `.gitignore`. Vérifier qu'ils ne sont jamais ajoutés au suivi Git. |
| Dossier de captures d'écran | `captures/` | Peut contenir des captures d'écrans avec des données de projets réels. | Déjà ignoré dans `.gitignore`. Captures d'illustration candidates prêtes dans le dossier public `docs/captures/`. |
| Données d'identité de l'auteur | `public/index.html`, `README.md` | Mentionne DrSmoke, l'auteur et le numéro WhatsApp. | Choix explicite de DrSmoke : ces mentions sont conservées comme signature et crédit d'auteur. |

### Vérification des secrets et données sensibles

- Clés API et jetons secrets : Aucun secret, mot de passe ou clé API n'est présent dans le code ou dans l'historique Git (`git ls-files` vérifié).
- Jeton d'authentification du bureau : Le jeton `X-Bureau-Token` est généré aléatoirement en mémoire à chaque démarrage du serveur (`crypto.randomBytes(32)`). Il n'est jamais sauvegardé sur le disque.
- Règle de vérité des faits : Tout ce qui apparaît à l'écran provient exclusivement de faits observés (processus Herdr, journaux locaux de Claude, Codex et OpenCode, fichiers réels). Aucun faux agent, faux statut, faux pourcentage ou fausse humeur n'est simulé.

## 2. Configuration du dépôt GitHub

### Informations générales recommandées

- Nom du dépôt : `MyTeam`
- Description courte : « Tour de contrôle locale en pixel art pour surveiller et piloter ses équipes d'agents d'IA sous Herdr. »
- Visibilité : Public
- Licence choisie : Licence MIT (`LICENSE`) avec avis de marques (`NOTICE.md`)
- Sauvegarde de référence : Version majeure stabilisée au commit `7817574`
- Sujets (topics) : `ai-agents`, `multi-agent-systems`, `herdr`, `pixel-art`, `developer-tools`, `local-first`, `nodejs`, `claude`, `codex`, `opencode`, `antigravity`

### Fichiers inclus dans le socle public

- Serveur et logique métier : `server.mjs`, `src/herdr.mjs`, `src/claude-activity.mjs`, `src/agent-activity.mjs`, `src/files.mjs`, `src/queue.mjs`, `src/direction.mjs`, `src/todos.mjs`, `src/delegations.mjs`, `src/terminal-status.mjs`, `src/blackboard.mjs`
- Interface utilisateur pixel art : `public/index.html`, `public/style.css`, `public/app.js`, `public/logos.js`, `public/terminal.js`, `public/sounds.js`, `public/empty-icons.js`
- Scripts de démarrage et d'installation : `Ouvrir le bureau.cmd`, `Ouvrir le bureau.ps1`, `scripts/installer.ps1`, `scripts/installer.sh`
- Documentation publique : `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE`, `NOTICE.md`, `docs/INSTALLATION.md`, `docs/aide.md`, `docs/captures/`
- Tests automatisés natifs : `package.json`, `test/*.mjs` (200 tests automatisés sans dépendance externe avec `node:test`)
- Configuration et exclusion : `.gitignore`

### Fichiers conservés pour la coordination interne

- `bureau.log`, `bureau-erreurs.log` (exclus par `.gitignore`)
- Notes de coordination spécifiques à la session locale : `docs/mission-claude.md`, `docs/avis-codex.md`, `docs/revue-opencode.md`, `docs/revue-codex-interface.md`, `docs/revue-antigravity.md`, `docs/revue-codex-delegations.md`

## 3. Choix de la licence logicielle (Validé)

DrSmoke a retenu la **Licence MIT** pour MyTeam (le Bureau des agents), offrant une liberté maximale d'utilisation, de modification et de distribution, tout en protégeant son attribution originale.
Le fichier `LICENSE` contient le texte standard MIT, et `NOTICE.md` précise que les marques et emblèmes (Claude, Codex, Antigravity, OpenCode, Gemini, Herdr) restent la propriété exclusive de leurs éditeurs respectifs.

## 4. Captures d'écran préparées pour la vitrine GitHub

Le dossier `docs/captures/` rassemble les captures candidates réalisées avec des états simulés (aucun secret ni chemin personnel, requêtes réseau d'envoi bloquées) :

1. `01-ordinateur-scene.png` : Vue complète sur ordinateur (1440x900) en journée avec le chef au bureau Direction, tableau mural, collaborateurs à leurs postes et salle de réflexion.
2. `01-ordinateur-scene-soir.png` : Vue complète en soirée (21 h) avec éclairage d'ambiance, suspensions au plafond et lampes individuelles allumées.
3. `02-ordinateur-poste.png` : Vue du poste ouvert avec barre d'état de l'outil et lecture directe du terminal Herdr.
4. `03-ordinateur-equipe.png` : Onglet Équipe avec courrier du chef, file d'attente sécurisée avec priorités et envoi groupé armé.
5. `04-ordinateur-palette.png` : Boîte modale de palette de commandes (Ctrl+K) ouverte au centre de l'écran.
6. `05-ordinateur-aide.png` : Volet d'aide latérale avec guide en 5 étapes, légendes et tableau des raccourcis.
7. Vues mobiles (`06-telephone-scene.png` à `10-telephone-aide.png`) : Adaptation responsive complète sur smartphone (390x844).
