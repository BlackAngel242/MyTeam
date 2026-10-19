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

- Propriété actuelle : `public/` et `src/files.mjs` pour Claude ; `server.mjs`, `src/agent-activity.mjs`, `src/delegations.mjs`, `src/queue.mjs` et leurs tests pour OpenCode (repris de Codex, dont la limite d'usage est presque atteinte) ; `src/herdr.mjs`, `src/claude-activity.mjs`, `src/todos.mjs`, `public/terminal.js` et `public/logos.js` pour Codex ; `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` et `docs/` de publication pour Antigravity. Le chef peut réattribuer, notamment quand un agent approche de sa limite d'usage.
- Avant de modifier un fichier d'un autre agent : lire son `git diff`, puis demander au chef.

## Vérité des faits

- Le bureau n'affiche que ce qui est observé : états Herdr, journaux locaux, fichiers sur le disque, heure du poste. Jamais de pourcentage, de tâche, d'humeur ou de relation inventés.
- Toute approximation est nommée comme telle à l'écran (exemple : « dossier et activité récente »).
- Une animation démarre uniquement sur un fait observé et peut être mise en pause.

## Signature et auteur (obligatoire)

- Toute contribution passe par le profil GitHub de l'auteur du projet (DrSmoke, compte BlackAngel242) : l'auteur et le contributeur sont lui, et personne d'autre. L'identité Git du dépôt est déjà réglée (`git config user.name` et `user.email`) : ne jamais la changer.
- Aucune IA ne signe quoi que ce soit : pas de `Co-Authored-By`, pas de « Generated with … », pas de nom d'IA ou d'outil dans le nom d'auteur, le message de commit, le titre ou le corps d'une pull request, une release ou un commentaire public.
- Le crédit aux IA se fait à un seul endroit : la section « Réalisé avec l'aide de l'IA » du `README.md` et `docs/credits-ia.md`, qui citent les modèles utilisés. Le projet a été concrétisé grâce à l'IA ; l'auteur reste l'auteur.

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

## Boucle de correction (apprendre ensemble)

- `LESSONS.md` est la mémoire commune : une seule copie, lue par chaque IA avant chaque mission et relue quand le chef signale une nouvelle leçon.
- Quand le chef corrige le travail d'un agent, il ajoute la leçon à `LESSONS.md` (erreur, cause, règle) puis prévient tous les agents par message. Chaque agent relit `LESSONS.md` avant sa mission suivante.
- Chaque agent qui rencontre une nouvelle erreur l'ajoute lui-même à `LESSONS.md` et le dit dans son compte rendu. Ne jamais répéter une erreur déjà inscrite.
- Avancement : `docs/plan-travail.md` fait foi. Seul le chef coche une case, après évaluation. Un agent signale « prêt à évaluer » avec le hash de son commit.

## Protocole de travail (consigne de DrSmoke, 18 octobre 2026)

Détail dans `docs/protocole-agents.md`. En bref :

- Avant toute tâche, partir de l'existant validé (`git log -8`, `HANDOFF.md`, `LESSONS.md`, plan) : une option a peut-être déjà été adoptée ; jamais la seule mémoire de session.
- Une tâche = un identifiant du plan. Antigravity, Codex et le chef : branche nommée dans un dossier à part (`node scripts/branche-agent.mjs <agent> <id-tâche>`). OpenCode : jamais de worktree, commits ciblés sur `main` qui portent l'identifiant (décision de DrSmoke, 19 octobre).
- Fin de tâche : l'agent prévient le chef une fois (id de tâche, branche, hash, résumé en 3 lignes, tests, non vérifié), note ses leçons et informe les deux autres agents.
- Le chef évalue, corrige, fusionne, dit ce qu'il a modifié et pourquoi, partage la leçon et tient `TODO.md` et le plan à jour.
- Surveillance par inactivité des panneaux, pas de messages en boucle (relais d'écoute désactivé sauf demande).
- Tout agent peut demander conseil ou suggérer une amélioration hors de son domaine : une ligne au chef.
- Revue en famille (Fixit d'équipe, `docs/fixit-equipe.md`) avant toute livraison importante : 2 à 4 profils adaptés au contexte (expert, senior, junior, lambda), auto-critique, consensus, correction puis réexamen ; inspiration possible sur Mobbin, Dribbble, Pinterest sans copier.

## Après chaque tâche terminée (consigne de DrSmoke, 18 octobre 2026)

- Prévenir le chef tout de suite, sans attendre la fin du lot : tâche, hash du commit, nombre de tests, ce qui n'a pas pu être vérifié.
- Mettre à jour les fichiers piliers touchés : `LESSONS.md`, `HANDOFF.md`, `JOURNAL.md`, `TODO.md` et `docs/plan-travail.md` (seul le chef coche).
- Partager ce qui a été appris : une ligne dans `LESSONS.md` pour chaque erreur, découverte ou astuce (quoi, cause, règle), et le dire dans le compte rendu pour que le chef prévienne les autres.
- Quota : quand la limite d'usage d'un agent se lève, le bureau lui envoie une minute après l'heure de retour une consigne courte. Répondre « dispo » en une ligne, puis reprendre la mission en cours sans refaire ce qui est commité.

## Écriture

Français accentué et simple, sans tiret cadratin. Code : commentaires seulement pour la logique non évidente, sans dépendance ajoutée sans raison.
