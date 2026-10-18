# Règles du projet pour toutes les IA

Ce fichier s'applique à chaque IA qui travaille sur ce projet (Claude, Codex, OpenCode, Antigravity, Gemini et les suivantes). Le lire en entier avant la première modification. Les autres fichiers de consignes (`CLAUDE.md`, `GEMINI.md`) renvoient ici : une seule source.

## À lire avant de travailler

1. `LESSONS.md` : erreurs déjà commises et comment les éviter. Ne jamais les répéter.
2. `PRODUCT.md` (ce que fait le produit), puis `HANDOFF.md` (état actuel) et `TODO.md`.
3. `docs/plan-travail.md` : le plan, les propriétaires et l'état de chaque case.
4. Si tu es le chef : `CHEF.md`.

## Rôles

- Le chef est le premier agent démarré dans Herdr (premier panneau). Il coordonne, répartit le travail par missions écrites, évalue, corrige et fusionne. Il ne laisse jamais un agent libre sans tâche.
- Les autres agents reçoivent une mission écrite (`docs/mission-modele.md`), travaillent dans les fichiers qui leur sont confiés et rendent compte en quelques lignes.
- La personne qui possède le projet décide. Aucune IA ne répond à une boîte de dialogue, une autorisation ou un choix de dossier à sa place.

## Un fichier, un propriétaire

- Chaque fichier ou dossier a un propriétaire dans `docs/plan-travail.md`. Avant de modifier le fichier d'un autre : lire son `git diff`, puis demander au chef.
- Commiter seulement ses propres fichiers (`git add <chemins>`), jamais `git add -A`.

## Vérité des faits

- Ne rien inventer : pas de pourcentage, d'état ou de résultat qui ne soit observé (fichier, journal, test lancé).
- Toute approximation est nommée comme telle.

## Définition de « terminé »

- Les contrôles du projet passent (tests, vérification de syntaxe) et leur résultat est annoncé.
- Le travail est vérifié par un essai réel, pas seulement relu.
- Le compte rendu dit ce qui n'a pas pu être vérifié.
- Une nouvelle erreur devient une ligne de `LESSONS.md`.

## Boucle de correction (apprendre ensemble)

- `LESSONS.md` est la mémoire commune : une seule copie, relue par chaque IA avant chaque mission.
- Quand le chef corrige le travail d'un agent, il ajoute la leçon (erreur, cause, règle) puis prévient tous les agents : `node scripts/partager-lecons.mjs "la leçon"`.
- Chaque agent qui rencontre une nouvelle erreur l'ajoute lui-même et le dit dans son compte rendu.
- Seul le chef coche une case du plan, après évaluation (`node scripts/evaluer.mjs`).

## Signature et auteur (obligatoire)

- Toute contribution passe par le profil GitHub du propriétaire du projet : l'auteur et le contributeur sont lui, et personne d'autre. Ne jamais changer l'identité Git du dépôt.
- Aucune IA ne signe quoi que ce soit : pas de `Co-Authored-By`, pas de « Generated with … », pas de nom d'IA dans l'auteur, un message de commit, une pull request ou une release.
- Le crédit aux IA (outils et modèles utilisés) figure à un seul endroit : une section « Réalisé avec l'aide de l'IA » du `README.md`.

## Sécurité

- Aucun secret, jeton ou identifiant de compte dans Git, les journaux ou les documents.
- Aucune publication, aucun `git push`, aucune suppression ni installation sans l'accord explicite de la personne qui possède le projet.

## Écriture

Phrases simples, dans la langue du projet. Code : commentaires seulement pour la logique non évidente.
