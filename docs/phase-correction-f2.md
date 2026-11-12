# Phase de correction F2 : deux OpenCode, affichage honnête

Date : 22 octobre 2026. Base : `main` (lire le dernier commit avant de commencer).
Lis d'abord `docs/regles-agents.md`, `AGENTS.md`, `LESSONS.md`, `HANDOFF.md`, puis `docs/plan-fonctionnalites.md`.

## Ce qui est décidé (ne pas rouvrir)

1. **Option B maintenant.** Quand plusieurs OpenCode partagent un dossier, ou qu'une activité ne peut pas être liée à un panneau, MyTeam n'affiche aucun chiffre. Il écrit « activité non attribuable ». Règle « vérité des faits » d'`AGENTS.md`.
2. **Nommage « OpenCode · fenêtre N » plus tard** (phase C4), une fois la mémoire d'ordre de C1 fusionnée. Ne pas le faire ici.
3. **Pas de lien certain entre une fenêtre et une session** : aucune donnée actuelle ne le permet. Le nommage restera un repère d'affichage.

## Tâche C3 (Dola) : option B et test T3-C réécrit

Branche : `agent/dola/T3-opencode`, la même que la PR #26. Une seule pull request. Ne fusionne jamais.

Travail, dans l'ordre :
1. **Réécrire T3-C** dans `test/t3-opencode-distinct.test.mjs`. Il doit asserter le comportement attendu : pour un seul OpenCode interrogé alors qu'une autre session plus récente existe dans le même dossier, aucun chiffre n'est retourné, et le motif est « activité non attribuable ». Il doit **échouer** avant la correction, comme la reproduction de F1. Garder le test de la garde (T3-B) et le test T3-D.
2. **Corriger le minimum** dans `src/agent-activity.mjs` (lecture OpenCode, autour des lignes 301 à 309) : quand la session la plus récente n'est pas sans ambiguïté, retourner l'état « non attribuable » au lieu de la session.
3. **Ne pas toucher** à `src/herdr.mjs`, à l'identité Herdr, ni au directeur (`bossOf`).
4. Le motif affiché reste en français, sans invention : pas de tokens, pas de modèle, pas de tâche.

## Méthode

- Tests verts : `npm run check` et `npm test`. Annoncer le nombre exact (réussis, échoués, ignorés). Tester aussi sous Node 22.
- Relire le diff avant de pousser.
- Pour chaque point : testé, simulé, non testé, bloqué. Ne jamais dire « marche » sans preuve.
- Tests Windows réels : SmokeSama.

## Interdits

- Pas de fusion. Pas de publication. Pas de modification de `release.yml`, `.githooks/`, `git config`.
- Pas de jeton extrait de l'URL du dépôt.

## Compte rendu

Tâche C3, branche, numéro de PR, hash, tests (nombre exact), résultat par point, ce qui n'est pas vérifié, leçon ajoutée à `LESSONS.md` (oui ou non).
