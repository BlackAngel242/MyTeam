# Version de référence 0.5.0

**Objectif :** livrer une référence unique propre avec contexte de projet, confidentialité locale, interface harmonisée et documentation cohérente. Publication et retrait des anciennes releases explicitement demandés par le propriétaire le 20 octobre.

**Spécification :** audit privé MyTeam du 20 octobre et parcours à deux choix validé dans la conversation. Nouveau périmètre : corriger, tester, publier, puis retirer les deux anciennes releases. Aucune réécriture de l’historique Git.

**Architecture :** lancement local protégé servant un écran de choix avant les commandes ; serveur de bureau lié à un contexte immuable par projet. Journaux et état local hors du checkout ; mémoire technique publiable séparée. Aucun message réel pendant les essais, aucune dépendance npm de production.

## Interfaces et contraintes

- `src/projects.mjs` : validation des dossiers, sélection par lieu connu + chemin relatif, filtrage des agents, stockage local par racine canonique.
- `src/project-server.mjs` : serveur de lancement, contrôles origine/jeton, choix initial et changement de contexte, création/arrêt des instances du bureau.
- `server.mjs` : conserve `createBureauServer` pour les tests du bureau ; son point d’entrée utilise le serveur de lancement. Chaque instance reçoit pont filtré et chemins d’état privés.
- `public/start.html`, `start.js`, `start.css` : français/anglais, deux choix, navigation des dossiers, validation explicite et dossier actif. Le logiciel ne promet pas un sandbox des outils externes.
- `scripts/partager-lecons.mjs` : filtrage des destinataires par racine de projet avant chaque envoi.
- `scripts/init-kit.mjs` : modèles conservés sans écrasement, journaux de session locaux distingués des guides techniques.
- `public/app.js` : reprise de l’animation avec une seule boucle ; survol annulé à la sortie du canvas.
- Publication : paquet vérifié et checksum, nouvelle release avant suppression des anciennes ; téléchargement Pages aligné sur la nouvelle version.

## Vérifications prioritaires

- Dossier manquant, symlink sortant, chemin absolu envoyé au navigateur, traversée, sélection concurrente : refus sans changement de contexte.
- Agent passant d’un dossier A à B : ne reçoit aucune nouvelle consigne de A ; envois groupés et reprises aussi filtrés.
- Changement de projet : plus de réutilisation de file, autonomie, direction, pièces jointes ou caches de l’ancien contexte.
- Aucune ancienne donnée locale de l’auteur importée à l’installation.
- Les journaux locaux restent hors de Git et du paquet ; les exemples et licences restent distribués.

## Tâches

- [x] R1 Nettoyer les documents de contexte personnel, README FR/EN, guides et kit, sans supprimer les décisions techniques utiles. Scanner les textes et le paquet.
- [x] R2 Corriger les deux optimisations du canvas avec reproductions rouges puis vertes ; conserver Lucide et les traductions dynamiques.
- [x] R3 Implémenter le choix initial et le contexte de projet, les contrôles de dossiers, l’état privé, l’arrêt de l’ancien contexte et le filtrage du partage de leçons ; tests unitaires et HTTP simulés.
- [x] R4 Vérifier Node 22/24, navigateur ordinateur/téléphone FR/EN, captures simulées et revue indépendante du diff. Corriger les remarques importantes.
- [ ] R5 Produire et vérifier le paquet 0.5.0, mettre à jour les liens de téléchargement, publier et vérifier la nouvelle release et Pages, puis supprimer les anciennes releases et leurs assets. Fermer les deux PR remplacées.

## Registre

- Base : `06b6fd6`, branche `codex_reference-0.5.0`, répertoire isolé. Exécution autorisée par la demande de publication de la nouvelle référence ; pas de nouvelle demande de permission pour les étapes déjà autorisées.
- Choix : numéro 0.5.0 pour le nouveau parcours. Aucun nouveau nom de divinité choisi à la place du propriétaire.
- Les copies privées historiques sont conservées hors du dépôt avant nettoyage ; elles ne sont pas publiées avec la release.

- Revue indépendante R3 : sorties par liens symboliques, sélection de racine large, TODO lié au mauvais contexte et lecteurs différés corrigés ; régressions simulées ajoutées. Aucun appel réel aux agents.
- Validation : Node 24 avec navigateur, 485 tests dont 471 réussis et 14 ignorés ; Node 22, 458 réussis et 27 ignorés (navigateur optionnel désactivé). Démarrage FR/EN 390/1280 px : 5 tests Chromium réussis après correction de `hidden`. Syntaxes et différences vérifiées.
