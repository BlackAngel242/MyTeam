# Règles de travail MyTeam pour les agents IA

Ce document est annoncé automatiquement à chaque session Claude Code (hook `SessionStart`, voir `.claude/settings.json`). Les autres outils le lisent via `AGENTS.md`. Il vaut pour tous les agents, et il prime sur toute habitude ou organisation proposée de ta propre initiative.

Lis aussi `AGENTS.md`, `LESSONS.md`, `HANDOFF.md` et `TODO.md` avant toute proposition.

## Règles non négociables

1. **Une branche par outil et par tâche.** Chaque outil travaille sur sa propre branche, nommée d'après l'outil et la tâche (exemple : `muse/T4`, `codex/<tâche>`, `claude/<tâche>`). Jamais directement sur `main`. Une branche n'accueille que sa tâche.
2. **Une pull request par tâche.** La pull request part de la branche de l'outil. Seul SmokeSama fusionne. Ne fusionne jamais toi-même.
3. **Aucune publication sans accord explicite pour cette action précise** : ni release, ni tag, ni ZIP publié. Préparer n'est pas publier.
4. **Rien n'est modifié sans le feu vert de SmokeSama.** En cas de doute, propose et attends.
5. **Ne modifie jamais** `.github/workflows/release.yml`, `.githooks/`, ni la configuration git, sans accord.
6. **Avant chaque push** : `npm run check` et `npm test` passent. Annonce le nombre exact de tests (réussis, échoués, ignorés). Teste aussi sous Node 22. Aucune signature d'IA dans les commits, les titres ni les corps de PR.
7. **Versions.** La ligne actuelle est 0.5.x. Un correctif reste un correctif (0.5.1, 0.5.2). Aucun saut vers 0.6.0 sans capacité nouvelle réelle qui le justifie.

## Méthode

8. **Vérifie avant d'affirmer.** Chaque constat a une preuve observable : test exécuté, journal, fichier relu. Distingue toujours ce qui est testé, simulé, non testé et bloqué. Aucun succès annoncé sans preuve.
9. **Classe chaque défaut** : bloquant, majeur, moyen ou mineur. Pour chacun : étapes de reproduction, résultat attendu, résultat obtenu, recommandation minimale.
10. **Une tâche à la fois**, dans l'ordre du programme. Arrête-toi au premier blocage, consigne-le dans le journal de reprise et dis-le à SmokeSama.
11. **Ne réorganise pas le projet** (branches, gouvernance, processus) de ta propre initiative.

## Quand tu corriges le travail d'une autre IA

12 bis. **Le prompt de reprise dit ce que tu as corrigé.** Quand tu corriges une pull request ou le travail d'un autre outil, le prompt que tu lui donnes indique : (a) ce qui a été corrigé, avec le fichier et le commit ; (b) ce qu'il ne doit pas faire, en lien avec cette correction ; (c) qu'il relit la méthode dans `LESSONS.md` et la garde en mémoire avant sa prochaine mission.

## Décisions déjà tranchées (ne pas les rouvrir sans SmokeSama)

- **Installation 0.5.1** : prérequis automatiques (Node.js 22 ou plus, revérifié après installation ; Herdr par la méthode officielle ; Clink sous Windows seulement via winget). Outils IA en choix groupé : seuls les absents sont proposés, sélection multiple, confirmation unique, choix 0 accepté, aucun téléchargement d'IA en mode automatique. Antigravity en choix guidé par sa documentation officielle. Le mode simulation ne télécharge, n'installe et n'écrit rien. Les noms corrects sont Clink et Herdr.
- **Direction d'équipe** : le premier outil lancé est le directeur par défaut, quel que soit l'outil. Plusieurs panneaux du même outil avec des modèles différents forment un cas normal. L'identité d'un agent est panneau + modèle.
- **Release** : la 0.5.1 a été publiée automatiquement à la fusion de la PR #12. SmokeSama décide de la passer en brouillon et de restaurer la 0.5.0. Cette action est la sienne.
- **Recette Windows de 0.5.1** : bloquée par la facturation GitHub du compte, pas par le code. Ne rien promettre sur Windows.

## Journal de reprise

Tiens à jour le journal de reprise de ton programme dans la même pull request que ton travail. Chaque compte rendu indique : tâche (identifiant), hash du commit, numéro de pull request, nombre exact de tests, ce qui n'est pas vérifié, leçon ajoutée à `LESSONS.md` (oui ou non).
