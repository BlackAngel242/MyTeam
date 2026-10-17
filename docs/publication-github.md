# Guide et audit de publication GitHub du Bureau des agents

Ce document prépare la publication publique du projet sur GitHub, conformément aux souhaits de DrSmoke. Aucun élément n'est publié automatiquement : ce document sert de feuille de route et d'audit préalable.

## 1. Audit de partage : éléments spécifiques à la machine locale

Cet audit recense les données propres à l'ordinateur de travail ou à la session locale de DrSmoke, qui doivent être adaptées ou isolées avant une mise à disposition publique.

| Élément | Emplacement | Problème pour un utilisateur tiers | Correction proposée |
| :--- | :--- | :--- | :--- |
| Version Herdr en dur | `src/herdr.mjs` (ligne 17) | Recherche le chemin `0.9.5-x86_64-pc-windows-msvc`. Échoue sur Linux, macOS ou avec une autre version de Herdr si `BUREAU_HERDR_PATH` n'est pas défini. | Parcourir dynamiquement le dossier des versions `.herdr/packages/standalone/releases/*/herdr.exe`, ou documenter `BUREAU_HERDR_PATH`. |
| Chemin absolu de test | `docs/mission-claude.md` (ligne 7) | Mentionne `C:/Users/DrSmoke/Documents/ChatGPT/IA DESKTOP`. | Document interne de coordination : à conserver dans l'historique ou à exclure de l'archive publique. |
| Identifiants de session Herdr | `HANDOFF.md`, `JOURNAL.md` | Mentionnent les panneaux de la session de développement (`w5:p1`, `w5:p4`, etc.). | Normal dans le journal de conception, mais à préciser comme exemples dans la documentation publique. L'application lit ces valeurs dynamiquement. |
| Fichiers de journalisation locale | `bureau.log`, `bureau-erreurs.log` | Journaux locaux générés lors du lancement par le script PowerShell. | Déjà ignorés dans `.gitignore`. Vérifier qu'ils ne sont jamais ajoutés au suivi Git. |
| Dossier de captures d'écran | `captures/` | Peut contenir des captures d'écrans avec des données de projets réels. | Déjà ignoré dans `.gitignore`. Préparer des captures d'illustration dédiées dans un dossier public `docs/captures/`. |
| Données d'identité de l'auteur | `public/index.html`, `README.md` | Mentionne DrSmoke, l'auteur et le numéro WhatsApp. | Choix explicite de DrSmoke : ces mentions sont conservées comme signature et crédit d'auteur. |

### Vérification des secrets et données sensibles

- Clés API et jetons secrets : Aucun secret, mot de passe ou clé API n'est présent dans le code ou dans l'historique Git (`git ls-files` vérifié).
- Jeton d'authentification du bureau : Le jeton `X-Bureau-Token` est généré aléatoirement en mémoire à chaque démarrage du serveur (`crypto.randomBytes(32)`). Il n'est jamais sauvegardé sur le disque.
- Respect de la vie privée : Les sorties affichées dans le terminal proviennent exclusivement de la session Herdr active de la machine locale et ne sont jamais transmises à l'extérieur.

## 2. Configuration du dépôt GitHub

### Informations générales recommandées

- Nom du dépôt : `bureau-des-agents` (ou `herdr-agent-desktop`)
- Description courte : « Bureau animé en pixel art pour surveiller ses agents IA Herdr et leur envoyer des consignes. »
- Visibilité : Public
- Sujets (topics) : `ai-agents`, `herdr`, `pixel-art`, `developer-tools`, `local-first`, `nodejs`, `claude`, `codex`

### Fichiers à inclure dans le premier commit public

- Code source de l'application : `server.mjs`, `src/herdr.mjs`, `src/claude-activity.mjs`
- Interface utilisateur : `public/index.html`, `public/style.css`, `public/app.js`, `public/logos.js`, `public/terminal.js`
- Scripts de démarrage et d'installation : `Ouvrir le bureau.cmd`, `Ouvrir le bureau.ps1`, `scripts/` (en cours de rédaction par OpenCode)
- Documentation publique : `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/INSTALLATION.md` (rédigé par OpenCode)
- Tests automatisés : `package.json`, `test/*.mjs`
- Fichier d'exclusion : `.gitignore`

### Fichiers à garder en interne ou à archiver

- `bureau.log`, `bureau-erreurs.log` (exclus par `.gitignore`)
- Notes de coordination spécifiques à la session locale : `docs/mission-claude.md`, `docs/avis-codex.md`, `docs/revue-opencode.md`, `docs/revue-codex-interface.md`, `docs/revue-antigravity.md` (peuvent rester dans la branche de développement ou dans un sous-dossier d'archive).

## 3. Choix de la licence logicielle (à décider par DrSmoke)

Voici trois options reconnues pour les projets libres, présentées simplement avec leurs implications :

1. Option 1 : Licence MIT (Recommandée pour une diffusion large)
   - Principe : Très permissive et courte. N'importe qui peut utiliser, copier, modifier, fusionner et distribuer le code, y compris dans un logiciel commercial ou fermé.
   - Conséquence : DrSmoke reste crédité comme auteur original, mais d'autres personnes peuvent créer des versions dérivées sans obligation de partager leur propre code.

2. Option 2 : Licence Apache 2.0 (Protection juridique renforcée)
   - Principe : Permissive comme la licence MIT, mais ajoute une clause explicite de concession de brevets et exige que les modifications apportées aux fichiers soient clairement indiquées.
   - Conséquence : Très appréciée en milieu professionnel. Elle protège explicitement l'auteur contre les litiges de brevets tout en autorisant une large réutilisation.

3. Option 3 : Licence GNU GPLv3 (Protection du bien commun libre)
   - Principe : Licence dite avec « copyleft fort ». Toute personne qui modifie ou améliore le Bureau des agents et distribue son travail doit obligatoirement publier le code source complet sous la même licence GPLv3.
   - Conséquence : Empêche qu'une entreprise ne s'approprie le projet pour en faire un produit fermé. Garantit que les améliorations restent toujours ouvertes à la communauté.

## 4. Captures d'écran à préparer pour la vitrine GitHub

Pour rendre le dépôt attrayant sur GitHub, il est conseillé de créer un dossier `docs/captures/` et d'y ajouter :

1. `apercu-bureau.png` : Vue complète de l'application avec la scène pixel illuminée par les écrans et le panneau latéral affichant les sorties.
2. `mode-plein-ecran.png` : Vue plein écran montrant la scène et les commandes réunies dans une même tour de contrôle.
3. `recherche-terminal.png` : Zoom sur le panneau Poste avec un terme recherché surligné en jaune et le défilement figé.
4. `envoi-equipe.png` : Capture de l'onglet Équipe avec plusieurs agents cochés et le bouton ambre d'envoi armé.
5. `vue-mobile.png` : Rendu vertical adapté sur écran de smartphone.
