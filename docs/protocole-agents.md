# Protocole de travail de l'équipe

Règles de DrSmoke du 18 octobre 2026. Elles valent pour le chef et pour chaque agent. Le bureau ne remplace pas ce protocole : il aide à le suivre.

## 1. Avant toute tâche : partir de l'existant validé

- Lire `git log -8`, `HANDOFF.md`, `LESSONS.md`, `docs/plan-travail.md` et `TODO.md`.
- Une option a peut-être déjà été adoptée avant que tu penses à l'implémenter : chercher dans le code, dans l'historique (`git log -S`) et dans le plan avant d'écrire quoi que ce soit.
- Partir de la dernière version commitée de `main`, jamais d'une copie gardée en mémoire de session.

## 2. Une tâche, un identifiant, des commits ciblés

- **Antigravity, Codex et le chef** peuvent travailler sur une branche nommée `agent/<agent>/<id-tâche>` dans un dossier à part : `node scripts/branche-agent.mjs <agent> <id-tâche>` (décision de DrSmoke du 19 octobre, « tant que ça passe »). Avant de signaler la fin : `git merge main` dans la branche, tests, commit ciblé ; le chef fusionne et supprime la branche et son dossier.
- **OpenCode n'a jamais de worktree** (son interface se bloque sur la fenêtre « Worktrees ») : il travaille dans le dossier du projet, sur `main`, avec des commits ciblés (`git commit -- <fichiers>`) qui portent l'identifiant de tâche (ex. « N7 … »). Le script le refuse.
- Si une branche ou un worktree pose problème à un agent, il revient à `main` avec des commits ciblés et me le dit.
- Aucun push, aucune publication.

## 3. Fin de tâche : rapport bref, dans les deux sens

L'agent prévient le chef lui-même, sans attendre d'être interrogé :

- **Identifiant de la tâche**, **branche** et **hash du commit** ;
- **Résumé** en trois lignes, **tests** lancés, **ce qui n'a pas pu être vérifié** ;
- **Appris, découvert, résolu** : une ligne dans `LESSONS.md` et un message court aux deux autres agents.

Chaque agent fait de même quand un autre lui signale une découverte utile.

## 4. Le chef évalue, corrige, fusionne

- Relire le diff, lancer les tests sur un export propre, corriger ce qui doit l'être.
- Fusionner dans `main` (`git merge --no-ff agent/<agent>/<id>` ou cherry-pick), puis informer l'agent : ce qui a été modifié, pourquoi, et la leçon qui en découle, partagée aux autres.
- Mettre à jour `TODO.md` et `docs/plan-travail.md` : seul le chef coche ; les agents savent y lire leurs tâches et citent leur identifiant.

## 5. Surveillance sans boucle de messages

- Le chef surveille les panneaux Herdr du workspace : une inactivité prolongée veut dire « fini » ; il lit alors le panneau et le rapport.
- Pas de messages automatiques en boucle : le relais d'écoute reste désactivé sauf demande de DrSmoke, et personne ne se relance à chaque pause.
- Un agent qui termine signale lui-même sa fin, une seule fois, avec le rapport du point 3.

## 6. Revue en famille avant livraison

Avant de signaler une tâche importante terminée, l'agent applique le Fixit d'équipe (`docs/fixit-equipe.md`) : un panel de 2 à 4 profils adaptés au contexte relit le résultat réel, s'auto-critique, propose des améliorations et corrige ce qui fait consensus. Le chef l'applique aussi à l'évaluation.

## 7. Initiative et regard extérieur

- Tout agent peut demander conseil ou suggérer une amélioration (qualité, innovation, nouveauté) hors de son domaine : un regard différent apporte souvent plus.
- Une ligne au chef, avec l'idée, la raison et le coût estimé. Le chef tranche et consigne la décision dans le plan (adoptée, reportée ou écartée, avec la raison).

## 8. Machine légère : 8 Go de mémoire

La machine de DrSmoke a 8 Go : elle se bloque quand plusieurs gros traitements tournent ensemble.

- Une seule suite complète de tests à la fois (`npm test`) ; les autres agents attendent la fin ou lancent seulement les fichiers qui les concernent.
- Fermer ce qu'on lance : serveurs d'essai, navigateurs sans interface, banc de mesure. Rien ne reste en arrière-plan après la tâche.
- Les dossiers temporaires d'essai se créent dans le dossier temporaire du système et se suppriment à la fin ; ne supprimer que ce qu'on a créé soi-même.
- Pas de sous-agents ni de captures en rafale sans besoin.
