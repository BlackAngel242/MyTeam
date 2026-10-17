# Règles du projet pour toutes les IA

Ce fichier s'applique à chaque IA qui travaille sur le Bureau des agents (Claude, Codex, OpenCode, Antigravity, Gemini et les suivantes). Le lire en entier avant la première modification.

## À lire avant de travailler

1. `LESSONS.md` : erreurs déjà commises et comment les éviter. Ne jamais les répéter.
2. `PRODUCT.md` (ce que fait le produit), `DESIGN.md` (apparence), `docs/exigences.md` (exigences vérifiables).
3. `HANDOFF.md` (état actuel), puis `TODO.md`.

## Rôles

- Le chef est le premier agent démarré dans Herdr (aujourd'hui Claude, panneau w5:p1). Il coordonne, répartit le travail, relit et intègre.
- Les autres agents reçoivent une mission écrite, travaillent dans les fichiers qui leur sont confiés et rendent compte en quelques lignes.
- DrSmoke décide. Aucune IA ne répond à une boîte de dialogue, une autorisation ou un choix de dossier à sa place.

## Un fichier, un propriétaire

- Propriété actuelle : `public/` et `src/files.mjs` pour Claude ; `server.mjs`, `src/` (sauf `files.mjs` et `delegations.mjs`), `test/` et `package.json` pour Codex ; `src/delegations.mjs` pour OpenCode ; `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` et `docs/` de publication pour Antigravity. Le chef peut réattribuer.
- Avant de modifier un fichier d'un autre agent : lire son `git diff`, puis demander au chef.

## Vérité des faits

- Le bureau n'affiche que ce qui est observé : états Herdr, journaux locaux, fichiers sur le disque, heure du poste. Jamais de pourcentage, de tâche, d'humeur ou de relation inventés.
- Toute approximation est nommée comme telle à l'écran (exemple : « dossier et activité récente »).
- Une animation démarre uniquement sur un fait observé et peut être mise en pause.

## Sécurité

- Serveur sur 127.0.0.1 uniquement, origine exacte et jeton pour toute écriture et toute lecture de fichiers.
- Aucun secret, identifiant de compte ou jeton dans Git, dans les réponses du serveur ou dans les documents.
- Fichiers : jamais de suppression ni d'écrasement, jamais de chemin absolu venant du navigateur.
- Aucune publication, aucun `git push`, aucune installation sur la machine sans l'accord explicite de DrSmoke.

## Définition de « terminé »

- `npm run check` et `npm test` passent ; le nombre de tests est annoncé.
- Toute interface modifiée est vérifiée à l'écran (ordinateur et téléphone) ; les captures de vérification se font avec Playwright et des états simulés, sans jamais envoyer de consigne réelle.
- Le compte rendu dit ce qui n'a pas pu être vérifié.
- Une nouvelle erreur rencontrée devient une ligne de `LESSONS.md`.

## Écriture

Français accentué et simple, sans tiret cadratin. Code : commentaires seulement pour la logique non évidente, sans dépendance ajoutée sans raison.
