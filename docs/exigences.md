# Exigences du Bureau des agents

Chaque exigence est vérifiable. La colonne « Preuve » indique où elle est contrôlée.

## Fonctionnelles

| N° | Exigence | Preuve |
|---|---|---|
| F1 | Un poste par agent réellement détecté dans Herdr, avec son nom, son outil, son panneau et son état en toutes lettres. | test/herdr.test.mjs, capture Playwright |
| F2 | Le premier agent démarré est le chef, placé dans le bureau « Direction » ; les autres sont ses agents. | public/app.js `bossOf`, scénario chef |
| F3 | Une délégation observée dans le journal du chef déclenche la tournée du chef qui porte le dossier au poste de l'agent ; sa fin réelle envoie un courrier au chef. | public/app.js (tournée du chef), test/delegations.test.mjs |
| F4 | Les sous-agents actifs d'un agent vont en salle de réflexion et reviennent remettre leur dossier quand ils finissent. | scénario Playwright sous-agents |
| F5 | Lecture des sorties du terminal avec recherche, défilement figé, copie, surlignage des erreurs et des demandes de saisie. | test/terminal.test.mjs |
| F6 | Barre d'état propre à chaque IA (tâche, activité, modèle, limites, avertissements), lue dans l'outil lui-même. | public/app.js `splitChrome` |
| F7 | Tokens, limites et sous-agents lus dans les journaux locaux quand ils existent, sinon « Non exposé ». | test/claude-activity.test.mjs, test/agent-activity.test.mjs |
| F8 | Consigne individuelle et envoi groupé confirmé en deux gestes, uniquement vers des agents disponibles ; journal des envois avec issue transmise, refusée ou inconnue. | test/broadcast.test.mjs |
| F9 | Explorateur : fichiers récents du dossier de chaque agent, navigation, copie et déplacement vers les lieux autorisés, ouverture dans l'Explorateur. | test/files.test.mjs, test/files-server.test.mjs |
| F10 | Listes de tâches du projet et des agents visibles dans le bureau. | en cours |

## Non fonctionnelles

| N° | Exigence | Preuve |
|---|---|---|
| N1 | Aucune donnée inventée : chaque affichage vient d'une source nommée. | AGENTS.md, revues |
| N2 | Serveur local uniquement, origine exacte et jeton ; aucun chemin absolu ni identifiant de compte renvoyé. | test/server.test.mjs, test/files-server.test.mjs |
| N3 | Aucune dépendance npm ; Node.js 22 ou plus. | package.json |
| N4 | Animation active par défaut, arrêtable, mémorisée ; une image de scène coûte quelques millisecondes. | mesure Playwright (2 ms) |
| N5 | Lisible sur ordinateur et téléphone, sans débordement horizontal ; texte fonctionnel d'au moins 12 px. | captures Playwright |
| N6 | Accessible au clavier : liste des postes, onglets à flèches, raccourci Ctrl+Entrée. | scénarios Playwright |
| N7 | Installation reproductible sur un autre ordinateur. | scripts/installer.ps1, scripts/installer.sh |
