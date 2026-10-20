# Reprise technique de MyTeam

Lire `AGENTS.md`, `LESSONS.md`, `PRODUCT.md`, `DESIGN.md`, `TODO.md` et le plan courant avant toute modification.

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
