# Phase de correction : F1 (directeur) et résumé de l'installeur

Date : 22 octobre 2026. Base : `main` (lire le dernier commit avant de commencer).
Lis d'abord `docs/regles-agents.md`, `AGENTS.md`, `LESSONS.md`, `HANDOFF.md`, puis `docs/plan-fonctionnalites.md`.

## Ce qui est décidé (ne pas rouvrir)

- **F1, option A** : MyTeam mémorise l'ordre de première apparition des agents. Le directeur est l'agent présent le plus anciennement vu. Herdr ne fournit pas d'heure de lancement, donc c'est MyTeam qui la retient.
- **Pas de PR en attente** : la reproduction de F1 (branche `muse/T1-directeur`, commit `aab4622`) reste comme référence, la PR #24 est fermée.
- **Le plan de vérification reste celui de `docs/plan-fonctionnalites.md`** : les tests Linux d'abord, les tests Windows par SmokeSama ensuite.

## Tâche C1 (Muse) : F1, directeur = premier agent vu

Branche : `muse/C1-directeur`. Une pull request. Ne fusionne jamais.

Spécification :
1. Chaque agent présent reçoit une date de première apparition, la première fois qu'il est vu. Elle est conservée tant que l'agent est présent.
2. Le directeur est l'agent présent dont la première apparition est la plus ancienne. À égalité, le plus petit numéro de panneau.
3. Quand un agent disparaît, sa date est oubliée. Le suivant le plus anciennement vu devient directeur.
4. La date est conservée sur le disque, dans l'état d'exécution privé du projet (même emplacement et même écriture atomique que la file, voir `src/queue.mjs`), pour survivre à un redémarrage de MyTeam.
5. **Limite à dire dans le rapport et dans l'aide** : au premier démarrage de MyTeam, les agents déjà présents n'ont pas d'heure connue. Leur ordre de départ est le numéro de panneau. Le texte doit le dire, sans le cacher.
6. Ne pas toucher à la vérité des faits : pas d'heure inventée, pas d'ordre affiché comme « lancé à … ».

Tests à écrire :
- Les trois tests F1 de `test/delegations.test.mjs` dans la branche `muse/T1-directeur` doivent passer. Ils n'ont pas été modifiés : ne pas les retoucher pour les faire passer.
- Un test de persistance : redémarrer le module, l'ordre est conservé.
- Un test d'égalité : même première apparition, le plus petit panneau gagne.
- Un test de départ à froid : les agents déjà présents au démarrage gardent l'ordre de numéro de panneau.

Fichiers : `src/delegations.mjs` (`bossOf`), `src/direction.mjs`, `server.mjs` (lignes 398 à 416). Lire avant d'écrire.

## Tâche C2 (Muse) : résumé de l'installeur en simulation

Branche : `muse/C2-resume-installeur`. Une pull request. Ne fusionne jamais.

Problème constaté (T2) : en simulation (`--dry-run`), le résumé final affirme au passé des actions qui n'ont pas eu lieu (« BUREAU_PORT écrit dans le profil », « Raccourci : créé », « Tests : exécutés »).

Règle :
- En simulation, le résumé ne parle jamais au passé d'une action réelle. Il dit « serait fait » ou « simulé ».
- En mode réel, le résumé ne dit « fait » que pour ce qui a réussi, et « non fait » avec la raison pour le reste.

Tests :
- Un test par variante : simulation et réel. En simulation, aucun verbe au passé pour une écriture ou un raccourci.
- Vérifier les deux installeurs : `scripts/installer.sh` et `scripts/installer.ps1`. Le texte doit être le même sur les deux.

## Méthode, pour chaque tâche

1. Écrire le test qui échoue, puis corriger le minimum.
2. `npm run check` et `npm test` passent. Annoncer le nombre exact (réussis, échoués, ignorés). Tester aussi sous Node 22.
3. Relire le diff avant de pousser.
4. Pull request avec le rapport dans le corps. Aucune signature d'IA.
5. Pour chaque point : testé, simulé, non testé, bloqué. Ne jamais dire « marche » sans preuve.

## Interdits

- Pas de fusion, pas de publication (release, tag, ZIP, site).
- Pas de modification de `release.yml`, `.githooks/`, `git config`.
- Pas d'effacement de la reproduction F1 : les tests existants restent tels quels.
- Pas de jeton extrait de l'URL du dépôt ou de la configuration Git.

## Ce qui reste hors de cette phase

- F2 (deux OpenCode) et F3 (confidentialité) : Dola, voir `docs/plan-fonctionnalites.md`.
- Le choix groupé des IA dans l'installeur : test réel par SmokeSama, sur Linux puis Windows.
- Tous les tests Windows : SmokeSama.

## Compte rendu

Tâche (C1 ou C2), branche, numéro de pull request, hash, tests (nombre exact), résultat par point, ce qui n'est pas vérifié, leçon ajoutée à `LESSONS.md` (oui ou non).
