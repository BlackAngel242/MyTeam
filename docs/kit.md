# Kit d'équipe : fichiers piliers, auto-évaluation et leçons partagées

Le kit donne à n'importe quel projet la méthode utilisée pour construire MyTeam : une équipe d'agents d'IA dirigée par un chef, avec des fichiers piliers que toutes les IA lisent, une évaluation par des faits et une mémoire commune des erreurs.

## Installer le kit dans un projet

```bash
node scripts/init-kit.mjs <dossier-du-projet> [--lang fr|en] [--dry-run]
```

- Crée les fichiers qui manquent, **n'écrase jamais** un fichier existant (il est signalé « conservé »).
- `--dry-run` montre ce qui serait créé sans rien écrire. Langue par défaut : celle du système.
- L'installeur de MyTeam propose cette étape à la fin (confirmation o/n).

## Ce que contient le kit

| Fichier | Rôle |
| --- | --- |
| `AGENTS.md` | Règles pour toutes les IA : rôles, un fichier un propriétaire, vérité des faits, définition de « terminé », boucle de correction, signature, sécurité. |
| `CLAUDE.md`, `GEMINI.md` | Renvoient à `AGENTS.md` : chaque outil lit la même source. Codex et OpenCode lisent `AGENTS.md` directement. |
| `CHEF.md` | Guide du chef : écouter les autres agents (`herdr agent list`, `herdr agent read`) et les diriger (`herdr agent prompt`), cycle planifier, déléguer, évaluer, corriger, fusionner. |
| `LESSONS.md` | Mémoire commune des erreurs, une ligne chacune. |
| `HANDOFF.md`, `JOURNAL.md`, `TODO.md`, `PRODUCT.md` | État actuel, historique daté, cases à cocher, ce que fait le produit. |
| `docs/plan-travail.md` | Plan avec propriétaires et cases : le bureau en affiche le pourcentage (cases cochées sur cases totales). |
| `docs/mission-modele.md` | Modèle de mission écrite pour un agent. |
| `docs/auto-evaluation.md` | Questions à se poser avant de dire « terminé », et grille du chef. |
| `scripts/evaluer.mjs`, `scripts/partager-lecons.mjs` | Les deux outils ci-dessous, copiés dans le projet. |

## Auto-évaluation

```bash
node scripts/evaluer.mjs [dossier] [--lang fr|en] [--json] [--sans-tests]
```

Un rapport fait de faits uniquement : fichiers piliers présents, cases cochées du plan et de `TODO.md` avec le pourcentage, nombre de leçons et de commits récents sur `LESSONS.md`, fichiers git en attente, fichiers piliers en retard sur le dernier commit, et résultat de `npm run check` et `npm test` s'ils existent. Aucun score inventé. Code de sortie 1 si un pilier manque ou si un contrôle échoue.

## Partage des leçons entre agents

```bash
node scripts/partager-lecons.mjs "La leçon, en une ligne." [dossier] [--dry-run] [--lang fr|en]
```

Ajoute la leçon à `LESSONS.md` (une seule fois), puis prévient les agents Herdr **disponibles** (`idle` ou `done`) : un message court, puis la touche Entrée au cas où le texte resterait dans la zone de saisie. Un agent au travail n'est jamais interrompu : il est listé « à prévenir plus tard ». Herdr injoignable : la leçon est ajoutée, aucun agent n'est prévenu.

## Le chef écoute et dirige

Le premier agent démarré dans Herdr est le chef. `CHEF.md` lui donne ses commandes ; l'installeur peut lui envoyer une consigne d'orientation et installer les intégrations officielles de Herdr (`herdr integration install <outil>`) qui font remonter l'état et la session de chaque agent. Le bureau affiche le chef au bureau Direction, suit ses délégations et son courrier, et peut le prévenir quand un agent a terminé (relais d'écoute facultatif).

## Signature

Toute contribution est signée par le profil GitHub de l'auteur, jamais par une IA. Les IA sont créditées une fois, dans le `README.md` (section « Réalisé avec l'aide de l'IA »). Voir `AGENTS.md`.
