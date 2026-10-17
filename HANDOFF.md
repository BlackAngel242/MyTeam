# Reprise IA

Lire attentivement ce document ainsi que `PRODUCT.md`, `DESIGN.md`, `JOURNAL.md`, `LESSONS.md` et `docs/publication-github.md` avant toute intervention sur le projet.

## Contexte et architecture du projet

L'application « Bureau des agents » est une tour de contrôle locale dans le navigateur conçue pour DrSmoke et ses agents d'intelligence artificielle opérant dans Herdr.

- Serveur d'application : Développé en Node.js natif (ES Modules, `server.mjs`), sans aucune bibliothèque tierce (`node_modules` n'existe pas). Il écoute exclusivement sur `http://127.0.0.1:4317`.
- Passerelle Herdr (`src/herdr.mjs`) : Communique avec l'outil Herdr en local via `node:child_process` (arguments isolés, aucune interprétation shell). La liste des agents est rafraîchie toutes les trois secondes. Les envois de consignes sont strictement interdits aux agents occupés ou bloqués.
- Activité de Claude (`src/claude-activity.mjs`) : Analyse son journal local pour extraire la consommation réelle de jetons et la liste des sous-agents actifs.
- Interface web (`public/`) :
  - Scène calculée dans un canvas (`public/app.js`), agrandie avec netteté intégrale en pixel art.
  - Logos personnalisés 16x16 pour chaque outil (`public/logos.js`).
  - Moteur de filtrage et surlignage de terminal sans altération du texte (`public/terminal.js`).
  - Panneau latéral organisé en deux onglets : « Poste » (vue individuelle, console, recherche, consigne avec Ctrl+Entrée) et « Équipe » (envoi groupé avec confirmation en deux étapes, journal des envois).
  - Mode plein écran étendu regroupant la scène et le panneau de pilotage.

## État d'avancement au 17 octobre 2026 (Version 0.2.0)

- Suite de tests : 57 tests automatisés réussis (`npm test`, 0 échec). La syntaxe de tous les fichiers JavaScript est validée (`npm run check`).
- Évaluation ergonomique : Deux passages d'évaluation critique réalisés et documentés dans `docs/revue-antigravity.md` (note globale de 8,7/10).

## Préparation à la publication GitHub (Chantier en cours)

Le projet est préparé pour un partage public sur GitHub, sans publication automatique :

1. Fichiers créés et maintenus par Antigravity :
   - `README.md` : Présentation accrocheuse, sections d'installation et de contribution, signature de DrSmoke préservée.
   - `CONTRIBUTING.md` : Règles de contribution, philosophie zéro dépendance, environnement de test.
   - `CHANGELOG.md` : Historique des versions 0.1.0 et 0.2.0.
   - `docs/publication-github.md` : Audit des chemins locaux, vérification des secrets, configuration du dépôt, 3 choix de licence détaillés pour DrSmoke, liste des captures d'écran à produire.
   - `TODO.md` : Tableau de bord des tâches accomplies et restantes.

2. Répartition du travail en équipe :
   - OpenCode rédige en parallèle les scripts d'installation automatique dans `scripts/` et le guide d'installation multi-plateforme dans `docs/INSTALLATION.md`. Ne pas modifier ces fichiers.
   - Claude assure la coordination générale de la session.
   - Codex veille sur la cohérence des tests et du moteur Herdr.
   - Antigravity gère la documentation publique, l'ergonomie et la préparation GitHub.

3. Décisions en attente de DrSmoke :
   - Choix de la licence libre (MIT, Apache 2.0 ou GNU GPLv3).
   - Validation des captures d'illustration pour `docs/captures/`.
   - Création manuelle du dépôt GitHub et publication initiale.
