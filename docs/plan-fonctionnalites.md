# Plan : savoir ce qui marche (tests Linux, puis Windows par SmokeSama)

Date : 22 octobre 2026. Base : `main` (lire le dernier commit avant de commencer).
Lis d'abord `docs/regles-agents.md`, `AGENTS.md`, `LESSONS.md`, `HANDOFF.md`.

## But

Pour chaque fonctionnalité demandée par SmokeSama, établir par une preuve observable ce qui marche, ce qui ne marche pas, et ce qui n'a pas été testé. Pas de correction avant la reproduction. Les tests Windows seront faits par SmokeSama ensuite.

## Les quatre fonctionnalités demandées

- **F1. Directeur = premier agent lancé, dans n'importe quel panneau.** Aujourd'hui la règle (`bossOf`, `src/delegations.mjs`, ligne 384) choisit le panneau au numéro le plus bas (`w5:p1` avant `w5:p2`) et ne regarde pas l'heure de lancement. Écart confirmé à la lecture, non reproduit.
- **F2. Deux OpenCode dans deux panneaux = deux agents distincts.** Signalé par SmokeSama. L'identifiant `panneau@empreinte` (`src/herdr.mjs`, ligne 33) devrait les séparer. Le défaut est peut-être dans le suivi d'activité OpenCode (`src/agent-activity.mjs`). Non reproduit.
- **F3. Les sessions personnelles ne sont visibles de personne d'autre.** Aucune preuve encore. Il faut inventorier tout ce qui sort de la machine.
- **F4. Un installateur interactif qui suit les consignes de la section « Décisions déjà tranchées » de `docs/regles-agents.md`.** Vérifié sur Linux seulement, en mode simulation, sans rien installer.

## Qui fait quoi

| Tâche | Fonctionnalité | Propriétaire | Branche |
|---|---|---|---|
| T1 | F1 : reproduction par test qui échoue | Muse | `muse/T1-directeur` |
| T2 | F4 : parcours interactif en simulation sous Linux | Muse | `muse/T2-installeur` |
| T3 | F2 : reproduction de deux OpenCode distincts | Dola | `agent/dola/T3-opencode` |
| T4 | F3 : inventaire de ce qui sort de la machine | Dola | `agent/dola/T4-confidentialite` |

Chaque tâche est faite dans l'ordre : **d'abord la reproduction** (un test qui échoue ou un relevé avec preuve), puis le rapport. Aucune correction n'est écrite dans ce plan. Les corrections viendront après évaluation de SmokeSama.

## Méthode, pour chaque tâche

1. Partir de `main` à jour. Une branche par tâche, une pull request par tâche.
2. Écrire la reproduction. Si un test doit échouer pour montrer le défaut, le garder, et le dire.
3. Lancer `npm run check` et `npm test`. Annoncer le nombre exact (réussis, échoués, ignorés). Tester aussi sous Node 22.
4. Ne rien corriger dans `src/`, `server.mjs`, `scripts/` ou `public/` sans demande explicite. La correction vient après le rapport.
5. Ouvrir la pull request avec le rapport dans le corps. Ne jamais fusionner.
6. Le rapport annonce, pour chaque point : testé, simulé, non testé, bloqué.

## Détail par tâche

### T1 (Muse) : F1, directeur

- Écrire un test : deux agents Claude, lancés dans cet ordre, `w5:p2` puis `w5:p1`. Attendu : le premier lancé (`w5:p2`) est directeur. Le test doit montrer le comportement actuel.
- Ajouter un test avec un seul agent, puis un test où le premier lancé disparaît et le suivant doit devenir directeur.
- Dire si l'heure de lancement est disponible dans les données Herdr. Si elle n'existe pas, le dire : ce serait un blocage de F1.
- Fichiers à lire : `src/delegations.mjs` (`bossOf`), `src/direction.mjs`, `server.mjs` (lignes 398 à 416).

### T2 (Muse) : F4, installeur interactif

- Lire la section « Décisions déjà tranchées » de `docs/regles-agents.md`. C'est la liste de référence.
- Lancer `scripts/installer.sh` en mode simulation, sans rien installer ni écrire. Relever pas à pas ce qui est demandé.
- Pour chaque décision de la liste : conforme, non conforme, ou non testé, avec la sortie qui le prouve.
- Ne pas tester les installations réelles : elles se feront sur Windows par SmokeSama.

### T3 (Dola) : F2, deux OpenCode

- Écrire un test qui simule deux panneaux OpenCode (identifiants de terminal et de panneau différents) dans le même dossier de projet.
- Attendu : deux agents distincts, chacun avec sa propre session.
- Relever où les deux se confondent, si c'est le cas : `src/agent-activity.mjs`, `src/herdr.mjs`, ou ailleurs. Donner le nom du fichier et la ligne.

### T4 (Dola) : F3, confidentialité

- Inventorier tout ce qui peut sortir de la machine vers d'autres personnes : interface servie en réseau, site GitHub Pages (`site/`), captures (`docs/captures/`, `site/assets/`), archives publiées, fichiers suivis par Git (`HANDOFF.md`, `LESSONS.md`, `docs/`).
- Pour chaque élément : ce qu'il contient, qui peut le voir, et une preuve (fichier, ligne, ou contenu réel).
- Ne rien supprimer. Signaler seulement.

## Résultat attendu de la semaine

Un tableau, établi par Muse et Dola, par fonctionnalité :

| Fonctionnalité | Reproduction Linux | Résultat | Preuve | Windows (SmokeSama) |
|---|---|---|---|---|
| F1 directeur | oui/non | marche / ne marche pas / bloqué | lien vers le test | à tester |
| F2 OpenCode distincts | oui/non | ... | ... | à tester |
| F3 confidentialité | oui/non | ... | ... | à tester |
| F4 installeur | oui/non | ... | ... | à tester |

## Interdits

- Pas de correction avant le rapport.
- Pas de fusion de pull request.
- Pas de publication (release, tag, ZIP, site).
- Pas de modification de `release.yml`, `.githooks/`, `git config`.
- Pas de nom d'outil d'IA dans les commits, les titres ni les corps de PR.

## Compte rendu

Tâche (T1 à T4), branche, numéro de pull request, hash, tests (nombre exact), résultat par point (testé, simulé, non testé, bloqué), ce qui reste à faire, leçon ajoutée à `LESSONS.md` (oui ou non).
