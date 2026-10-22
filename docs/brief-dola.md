# Brief pour Dola : comment travailler sur MyTeam

Date : 22 octobre 2026. Base : `main` (lire le dernier commit avant de commencer).
Lis d'abord `docs/regles-agents.md`, `AGENTS.md`, `LESSONS.md`, `HANDOFF.md`.

## Ce qui a bien marché sur ta PR #13 (audit 360)

- Messages de commit sans signature d'IA, identité DrSmoke, aucune dépendance npm ajoutée.
- Audit structuré, avec une méthode claire et deux abandons justifiés par des tests existants.
- Une branche dédiée (`agent/dola/audit-360`) : c'est la bonne méthode, à garder.

## Erreurs à ne plus refaire

1. **Ajouter une plateforme à la CI sans la faire passer.** macOS a été ajouté à la matrice alors que le test `H3 chef bash` échouait dessus. La PR est partie avec un job rouge.
   Règle : si tu touches `.github/workflows/ci.yml`, chaque ligne de la matrice doit être verte avant de demander une relecture. Sinon, ne pas ajouter la ligne.
2. **Annoncer des résultats non observés.** Tu as écrit « npm test OK » alors que la CI macOS était rouge.
   Règle : annonce ce que tu as observé, plateforme par plateforme, et écris « non vérifié » pour le reste.
3. **Cocher « Fait » pour une chose non vérifiée** (Q1 dans l'audit).
   Règle : un statut doit correspondre à l'état réel au moment où tu l'écris.
4. **Écrire une commande de suppression sans vérifier les branches.** Ta commande incluait la branche de session `ccr-…`, qu'il ne faut jamais toucher.
   Règle : avant toute commande destructive, liste les branches réelles (`git branch -r`), exclus `main` et les branches de session, et ne propose jamais de suppression sans accord.
5. **Annoncer « prêt » sans mettre la branche à jour.** La PR est passée « behind » : la protection de `main` exige une branche à jour.
   Règle : avant « prêt à évaluer », fusionne `main` dans ta branche (sans réécriture), relance les tests, puis annonce le hash.
6. **Te comporter comme si la fusion t'appartenait.** Tu ne fusionnes jamais. Seul SmokeSama fusionne.

## Méthode à suivre

- Une tâche = une branche `agent/dola/<tâche>` = une pull request.
- Avant de commencer : lire les règles, vérifier l'état réel sur GitHub (pull requests, branches, CI).
- Avant chaque push : `npm run check` et `npm test` passent ; annonce le nombre exact (réussis, échoués, ignorés) ; teste aussi sous Node 22.
- Une modification de la chaîne de publication (`release.yml`, `.githooks/`, `git config`) demande l'accord de SmokeSama avant d'être écrite.
- Aucune publication (release, tag, ZIP), aucune suppression, aucun push sur `main`.
- Compte rendu court : tâche, branche, numéro de PR, hash, tests (nombre exact par plateforme), non vérifié, leçon ajoutée à `LESSONS.md` ou non.

## Où laisser un message à Claude

- **Sur ta pull request** : un commentaire qui commence par « Pour Claude : ». Claude est abonné aux pull requests en cours et reçoit ces commentaires.
- **Hors pull request** : écris-le dans le compte rendu que tu remets à SmokeSama, qui le transmet.
- Ne pas ouvrir de pull request juste pour un message. Ne pas créer de fichier de messages dans le dépôt sans accord de SmokeSama.

Claude ne voit que ce qui arrive par GitHub ou ce que SmokeSama lui colle. Un message laissé ailleurs ne sera pas lu.
