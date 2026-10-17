# Reprise IA

Lire attentivement ce document ainsi que `PRODUCT.md`, `DESIGN.md`, `JOURNAL.md`, `LESSONS.md` et `docs/publication-github.md` avant toute intervention sur le projet.

## Contexte et architecture du projet

L'application « Bureau des agents » est une tour de contrôle locale dans le navigateur conçue pour DrSmoke et ses agents d'intelligence artificielle opérant dans Herdr.

- Serveur d'application : Développé en Node.js natif (ES Modules, `server.mjs`), sans aucune bibliothèque tierce (`node_modules` n'existe pas). Il écoute exclusivement sur `http://127.0.0.1:4317`.
- Passerelle Herdr (`src/herdr.mjs`) : Communique avec l'outil Herdr en local via `node:child_process` (arguments isolés, aucune interprétation shell). La liste des agents est rafraîchie toutes les trois secondes. Les envois de consignes sont strictement interdits aux agents occupés ou bloqués.
- Chef et agents : Le premier agent démarré dans Herdr est désigné chef d'équipe et occupe le bureau VIP. Les autres sont ses agents.
- Cycle de délégation et courriers : Surveillance des délégations (`herdr agent prompt`) dans le journal du chef. L'agent vient prendre sa consigne, travaille à son poste, puis envoie un courrier au chef une fois la mission achevée. L'humeur reflète fidèlement les résultats observés et les erreurs enrichissent `LESSONS.md`.
- Salle de réflexion : Pièce animée dédiée où les sous-agents d'un agent se concentrent avant de déposer leur dossier de travail.
- Activités locales réelles (`src/claude-activity.mjs`, `src/agent-activity.mjs`) : Suivi des jetons et sous-agents pour Claude, lecture des configurations et historiques locaux réels pour Codex et OpenCode, sans inventer de métriques.
- Explorateur de fichiers (`src/files.mjs`) : Navigation arborescente sécurisée dans les fichiers du projet, confinée à la racine, sans suppression ni écrasement.
- Interface web (`public/`) :
  - Scène calculée dans un canvas (`public/app.js`), agrandie avec netteté intégrale en pixel art avec bureau VIP et salle de réflexion.
  - Logos personnalisés 16x16 pour chaque outil (`public/logos.js`).
  - Moteur de filtrage et surlignage de terminal sans altération du texte (`public/terminal.js`).
  - Panneau latéral organisé en deux onglets : « Poste » (vue individuelle, console, recherche, consigne avec Ctrl+Entrée, explorateur) et « Équipe » (envoi groupé avec confirmation en deux étapes, journal des envois, délégations).
  - Mode plein écran étendu regroupant la scène et le panneau de pilotage.

## Règle absolue : Vérité des faits

Le bureau n'affiche que ce qui est réellement observé : états Herdr, journaux locaux, fichiers du disque, horloge de la machine. Jamais de pourcentage fictif, de tâche imaginaire ou d'humeur inventée. Toute lacune d'un outil est signalée par « Non exposé par cet outil ».

## État d'avancement au 17 octobre 2026 (Version 0.2.0 stabilisée)

- Sauvegarde majeure : Version stabilisée enregistrée au commit `7817574`.
- Suite de tests : 129 tests automatisés passants sur 131 (2 tests ignorés sur les liens symboliques Windows, 0 échec). La syntaxe de tous les fichiers JavaScript est validée (`npm run check`).
- Évaluation ergonomique : Deux passages d'évaluation critique réalisés et documentés dans `docs/revue-antigravity.md` (note globale de 8,7/10).
- Licence logicielle : Licence MIT retenue par DrSmoke, actée dans `LICENSE` avec mention des marques tierces dans `NOTICE.md`.

## Préparation à la publication GitHub et chantiers en cours

Le projet est préparé pour un partage public sur GitHub, sans publication automatique :

1. Fichiers créés et maintenus par Antigravity :
   - `README.md` : Guide complet avec présentation publique, nouveau concept de chef et délégations, installation et contribution, signature originale de DrSmoke préservée.
   - `CONTRIBUTING.md` : Règles de contribution, philosophie zéro dépendance, environnement de test.
   - `CHANGELOG.md` : Historique des versions 0.1.0 et 0.2.0 enrichi avec les derniers ajouts.
   - `docs/publication-github.md` : Audit des chemins, absence de secrets, configuration du dépôt, licence MIT et captures d'écran requises.
   - `docs/idees-os.md` : 8 innovations pour faire du bureau un véritable système d'exploitation d'agents.
   - `docs/commandes-outils.md` : Référentiel vérifié des commandes locales de changement de modèle et lancement de compétences.
   - `TODO.md` : Tableau de bord des tâches accomplies et restantes.

2. Répartition du travail en équipe :
   - OpenCode : Finalise le module de détection des délégations (`src/delegations.mjs`), rédige les scripts d'installation dans `scripts/` et le guide `docs/INSTALLATION.md`.
   - Claude : Coordonne la session et maintient l'interface `public/`.
   - Codex : Veille sur la cohérence des tests et du moteur Herdr.
   - Antigravity : Gère la documentation publique, l'ergonomie, la conformité aux faits et la préparation GitHub.

3. Décisions et actions de DrSmoke :
   - Validation des captures d'illustration pour `docs/captures/`.
   - Création manuelle du dépôt GitHub et publication initiale.

## Reprise du chef après sa pause de limite (17 octobre 2026, 02 h 55)

Claude (chef, w5:p1) a atteint 91 % de sa limite de session, remise à zéro vers 04 h 40 ; Codex (w5:p4) est en pause jusqu'à 04 h 37. Restent actifs : OpenCode (w5:p3) et Antigravity (w5:p2).

Dernier état vérifié : 131 tests, 129 réussis, 2 ignorés ; dernier commit sauvegardé visible avec `git log -1`. Aucun dépôt distant : la publication GitHub (dépôt public `bureau-des-agents`, licence MIT, branche `main`) a été refusée par le garde-fou de Claude Code faute d'accord explicite ; DrSmoke peut la lancer lui-même (commande dans le compte rendu du chef).

En cours au moment de la pause :
- OpenCode : file d'attente serveur avec relance automatique à « remise à zéro + 5 min », pause de quota (`limitReached`, `resetsAt`), délégations dans `/api/state`, sous-agents Codex. Puis corriger les 4 constats confirmés de `docs/revue-codex-delegations.md`.
- Antigravity : documentation du concept chef et agents, README, CHANGELOG.

À la reprise, le chef doit : lire ce fichier, `git log`, les comptes rendus d'OpenCode et d'Antigravity ; relire et tester leur code ; redémarrer seulement le processus du port 4317 ; vérifier avec Playwright ; puis s'attaquer à la fenêtre des tâches (`/api/todos` est prêt côté serveur) et aux idées Mobbin retenues (palette Ctrl+K, aide « ? », visite guidée).
