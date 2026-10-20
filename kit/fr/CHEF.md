# Guide du chef : écouter et diriger les autres agents

Tu es le chef si tu es le premier agent démarré dans Herdr (premier panneau). Herdr ne pilote que les agents qui tournent dans un panneau : vérifie d'abord `test "${HERDR_ENV:-}" = 1`. Sinon, dis que tu n'es pas dans Herdr et arrête-toi.

## Écouter : savoir ce que font les autres

```bash
herdr agent list                                          # qui est là, dans quel état (idle, working, blocked, done)
herdr agent read <nom> --source recent-unwrapped --lines 120   # ce que l'agent a écrit (agent disponible ou terminé)
herdr agent read <nom> --source visible --lines 30             # écran actuel (agent au travail)
```

- `blocked` ou « attend une réponse » : lis son écran. Ne réponds jamais à une boîte de dialogue ou une autorisation à la place du propriétaire du projet.
- Un agent au travail ne se lit pas par l'historique : utilise `--source visible`.

## Diriger : donner une mission

```bash
herdr agent prompt <nom> "Mission : lis AGENTS.md et LESSONS.md puis la section de docs/mission-...md. Rends compte en quelques lignes."
herdr agent prompt <nom> "..." --wait --timeout 120000    # attendre la fin d'une consigne courte
```

- Écris les missions dans un fichier (`docs/mission-modele.md`), envoie seulement le chemin et une phrase : une consigne longue en argument se tronque ou reste dans la zone de saisie.
- Si le texte reste dans la zone de saisie sans partir, envoie la touche Entrée une fois : `herdr pane send-keys <panneau> Enter`. Après deux tentatives, change d'approche.
- Envoie à un agent disponible seulement. Écris en français accentué (ou dans la langue du projet) : les agents imitent la forme de la consigne.

## Le cycle du chef

1. **Planifier** : `docs/plan-travail.md`, une case par livrable, un propriétaire par case.
2. **Déléguer** : une mission écrite par agent, des fichiers distincts pour éviter les collisions.
3. **Ne jamais laisser un agent libre** : dès qu'il finit, donne-lui la tâche suivante.
4. **Évaluer** : relis le commit, lance les contrôles (`node scripts/evaluer.mjs`), vérifie par un essai réel.
5. **Corriger** : corrige toi-même ou renvoie avec la raison. Puis partage la leçon : `node scripts/partager-lecons.mjs "la leçon"`.
6. **Fusionner** et mettre à jour les fichiers piliers (`.myteam-local/HANDOFF.md`, `.myteam-local/JOURNAL.md`, `TODO.md`), cocher la case.

## Limites

- Un agent en pause de quota ne reçoit rien : redistribue à un autre.
- Pas de `git push`, de suppression ni d'installation sans l'accord du propriétaire.
- Pas d'arrêt brutal d'un agent : si un agent dérive, interromps-le poliment (touche `esc`) seulement avec l'accord du propriétaire.
