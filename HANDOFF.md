# Reprise technique de MyTeam

Lire `AGENTS.md`, `LESSONS.md`, `PRODUCT.md`, `DESIGN.md`, `TODO.md` et le plan courant avant toute modification.

## Proposition d'améliorations (12 novembre 2026)

Un document de propositions est déposé dans `docs/propositions-ameliorations.md` : douze propositions indépendantes (surface déclarée et événements, journal rejouable, packs d'équipe, portes humaines, reprise après limite disciplinée, revérification avant envoi, ouverture de projet validée, contrat de compte rendu, questions structurées, revue du dernier tour, tableau partagé et espaces isolés, présence lisible), chacune avec processus, utilité, implications et critères d'acceptation. Aucun code modifié : en attente d'évaluation, proposition par proposition, et d'accord explicite avant toute mise en œuvre. Ajout du 13 novembre 2026 : périmètre confirmé (un seul poste, local sur 127.0.0.1, pas d'accès distant ni de vues multiples ; dépendances possibles sous conditions si le gain d'efficacité est mesuré) et cinq propositions supplémentaires P13 à P17 (file unique des attentes avec état relu persistant, jauges de capacité locales, boîte de recherche et d'actions par Ctrl+F, fenêtre agent unique à quatre onglets avec repli honnête, notes accrochées à un panneau à envoi explicite).

## Préparation documentaire npm (10 novembre 2026)

La PR MyTeam 0.6.1 (#70, branche `lot/l2-lanceur`) existe déjà et fournit le lanceur `myteam`, le raccourci et la session Herdr dédiée. Les README et guides clarifient `npx` contre `npm i` dans une PR complémentaire, sans changer le binaire npm existant `myteam-install`. L'intégration de la PR complémentaire et la publication npm 0.6.1 restent à effectuer. Le workflow `Release` est exclusivement manuel et nécessite `main` ; aucun essai Windows réel ni `npm test` local n'a été effectué pour cette documentation.

## État au 7 novembre 2026 (0.6.1 en préparation)

- `main` est en 0.6.0 « Èṣù », publiée sur npm (`@drsmoke/myteam`, publication de confiance) et en release GitHub.
- 0.6.1 : commande `myteam` (`bin/myteam`, `bin/myteam.cmd`, `scripts/myteam.mjs`), session Herdr `myteam` (`sessionHerdr` dans `src/herdr.mjs`, lue aussi par `src/terminal-status.mjs`), route `GET /api/identite` pour reconnaître un bureau déjà ouvert, raccourci MyTeam automatique avec `public/myteam.ico`, relais de quota (`src/relais-quota.mjs`, appelé par `reprendreApresPause` dans `server.mjs`).
- Ne jamais lancer d'essai Herdr dans la session par défaut : utiliser une session d'essai (`herdr --session myteam-essai …`), puis `herdr session stop` et `herdr session delete`.

## État au 29 octobre 2026

La démonstration publique est en maintenance jusqu'au 27 novembre 2026, avec compte à rebours. Pour la remettre en ligne : copier l'ancienne page (`maintenance/site-index-original.html`) à la place de `site/index.html`. Pendant la maintenance, les contrôles de la page d'accueil portent sur l'archive.

## État au 20 octobre 2026 (base saine 0.5.0)

- `main` est en version 0.5.0. Dernier commit : `123a161`, qui fusionne la PR #7 (raison d'une consigne en attente) et la leçon sur le 403 de la PR #6, en « squash » pour que l'auteur soit DrSmoke.
- Aucune PR n'est ouverte. Les PR #2 et #3 (Bolt, générées automatiquement) ont été fermées : elles partaient de l'ancienne base, et leur code a été réécrit en 0.5.0. Une nouvelle proposition sur le code actuel reste bienvenue, avec une mesure.
- Tests lancés le 20 octobre sur le commit `2589ed5`, dont le contenu est identique à `main` : `npm run check` passe, `npm test` donne 495 tests, 468 réussis, 0 échec, 27 ignorés.
- La version 0.5.0 porte le nom Ṣàngó, choisi par DrSmoke le 20 octobre (voir `docs/noms-de-versions.md`).
- À faire par DrSmoke : supprimer les branches `bolt-*` sur GitHub, qui ne servent plus.

## Socle conservé

Application locale Node.js 22/24, sans dépendance npm de production. Herdr fournit les agents et leurs états ; les journaux enrichis concernent Claude, Codex et OpenCode. Les scènes et pourcentages ne décrivent que des faits observés. L’interface propose Lucide local et les thèmes Système / Clair / Sombre.

Les envois distinguent transmission et accomplissement. Origine exacte, jeton, écoute sur `127.0.0.1`, validation des chemins, absence d’écrasement, contrôle de la cible juste avant l’envoi et arrêt de l’autonomie restent des contraintes de sécurité.

## Référence 0.5.0

Le parcours commence par « Améliorer MyTeam » ou « Créer ou reprendre un autre projet ». Le choix du dossier précède toute consigne. Le contexte filtre les agents et les opérations selon les dossiers sélectionnés. Changer de projet arrête l’ancien contexte et n’importe pas sa file ni son autonomie.

L’état d’exécution est privé, par projet, dans les données locales du système sous `MyTeam`, hors checkout. Aucune ancienne installation n’est importée automatiquement. Les documents suivis de ce dépôt sont des synthèses techniques publiques ; les rapports bruts de sessions n’y ont pas leur place.

## Vérification et suite

Le plan `docs/superpowers/plans/2026-10-20-reference.md` fait foi pour l’avancement de la livraison. Exécuter `npm run check`, `npm test`, puis les essais navigateur FR/EN sur ordinateur et téléphone avec états simulés. Aucun envoi réel pendant ces essais. Les résultats de la nouvelle référence doivent être constatés avant publication.

Publier et vérifier la nouvelle release avant de retirer les anciennes releases et leurs archives. L’historique Git n’est pas réécrit. Le filtrage MyTeam n’est pas un bac à sable du système ni une restriction des droits propres aux outils d’IA externes.

## Mise à jour intégrée (branche codex_update-in-app, en revue)

Le bureau vérifie la dernière release officielle, contrôle le ZIP et son SHA-256, prépare un dossier frère puis déclenche un assistant externe pour arrêter, remplacer et relancer le serveur. L'ancien dossier est conservé. Les copies Git sont refusées. La version préparée est 0.5.1 ; valider les tests Linux et Windows avant fusion/publication. Depuis 0.5.0, une mise à niveau manuelle initiale reste nécessaire.
