# Contribuer au Bureau des agents

Merci de votre intérêt pour le Bureau des agents ! Ce projet a été conçu pour offrir un tableau de bord local, vivant et esthétique aux développeurs qui pilotent plusieurs agents d'intelligence artificielle dans Herdr.

## Principes directeurs du projet

Toute contribution doit respecter les règles fondamentales suivantes :

1. Zéro dépendance externe : Le projet n'utilise aucune bibliothèque tierce (`npm install` est inutile). Tout repose exclusivement sur les modules natifs de Node.js (`node:http`, `node:fs`, `node:crypto`, `node:child_process`, `node:test`).
2. Vérité absolue des données : Le bureau ne simule aucun agent, n'invente aucun statut et ne fabrique aucun pourcentage de complétion. Les animations reflètent strictement les états observés dans Herdr.
3. Sécurité et exécution locale : Le serveur écoute exclusivement sur l'adresse `127.0.0.1`. Aucune donnée n'est transmise vers des serveurs distants.
4. Identité graphique pixel art : Les décors, personnages et emblèmes respectent une esthétique soignée en pixels. Les logos d'outils sont dessinés dans une grille 16x16 (`public/logos.js`). Les couleurs d'identité des agents ne doivent jamais être confondues avec les couleurs sémantiques d'état (bleu pour le travail, menthe pour disponible ou terminé, ambre pour l'attente).
5. Accessibilité et confort d'utilisation : L'interface doit rester totalement utilisable au clavier (onglets accessibles avec les touches fléchées, envoi avec Ctrl+Entrée). Le réglage système de réduction des mouvements (`prefers-reduced-motion`) doit être respecté en désactivant automatiquement les animations.
6. Rédaction soignée : Tous les textes de l'interface et de la documentation sont rédigés en français simple et correctement accentué, sans tiret cadratin.

## Environnement de développement

### Prérequis

- Node.js version 22 ou supérieure
- Herdr installé et accessible

### Lancer l'application en local

```powershell
node server.mjs
```

L'application est immédiatement accessible dans le navigateur à l'adresse `http://127.0.0.1:4317`.

### Vérifier le code

Deux commandes sans dépendance permettent de valider vos modifications avant toute proposition :

- Lancer la suite de tests automatisés :
  ```powershell
  npm test
  ```
  La suite valide le raccordement avec Herdr, le serveur HTTP, les protections de requêtes, l'envoi groupé, la lecture locale de Claude et le moteur de terminal.

- Contrôler la syntaxe de tous les fichiers JavaScript :
  ```powershell
  npm run check
  ```

## Proposer une modification

1. Créez une branche thématique décrivant précisément votre travail.
2. Écrivez des tests automatisés pour toute nouvelle logique dans le dossier `test/`.
3. Vérifiez que `npm test` et `npm run check` réussissent sans avertissement.
4. Mettez à jour `README.md` et `CHANGELOG.md` si votre modification introduit un changement visible pour l'utilisateur.
5. Ouvrez une Pull Request avec une description claire de vos intentions.
