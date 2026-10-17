# Leçons

- Utiliser le chemin absolu de Herdr : la découverte PowerShell ne le retournait pas correctement, contrairement à where.exe.
- Filtrer le schéma local avant de l'afficher : sa sortie complète est volumineuse.
- Écrire PRODUCT.md avant de lancer le choix de direction Impeccable.
- Sur un agent occupé, lire la source visible : Herdr refuse de faire défiler son historique pendant son travail. Utiliser recent-unwrapped seulement pour idle/done.
- Ne pas convertir séparément chaque morceau d'une requête réseau : conserver les octets jusqu'à la fin pour préserver les accents et emojis.
- Herdr 0.9.5 : aide seule consultée avec `herdr agent --help` et `herdr agent prompt --help`. Elle annonce `herdr agent prompt <TARGET> <TEXT> [OPTIONS]`, sans documenter le séparateur `--`. Son acceptation reste non confirmée : aucun envoi réel n'a été tenté pour la vérifier. Une consigne commençant par `--` peut donc être interprétée comme une option de Herdr. `execFile` la garde dans un argument distinct, mais cela ne garantit pas la manière dont Herdr la comprend ; ne pas ajouter un séparateur non vérifié.
- Activité Claude : chemin et état partagent un cache de 32 sessions. Une ligne de plus de 4 Mo est sautée jusqu'au prochain retour à la ligne. La déduplication conserve au maximum 50 000 identifiants et un budget d'état de 4 Mo ; au-delà, la session est mémorisée comme épuisée et l'activité n'est plus exposée plutôt que de donner des totaux approximatifs. Les sondages suivants ne relisent rien, même si le fichier grandit. Une troncature ou un remplacement du fichier permet une nouvelle lecture. Les erreurs de flux sont également mémorisées pour éviter les boucles.
- Une réponse 413 exige de consommer le reste du corps sans le mémoriser, avant de répondre : quitter trop tôt la boucle de lecture peut couper la connexion. Les erreurs de saisie, de Herdr et internes utilisent respectivement 400, 502 et 500 ; les messages existants restent conservés.

## Travail en équipe d'agents (17 octobre 2026, à lire par chaque IA avant de travailler)

- Un fichier, un propriétaire. Avant de modifier un fichier confié à un autre agent, lire `git diff` de ce fichier : OpenCode éditait server.mjs au moment où Claude s'apprêtait à le reprendre. Propriété actuelle : public/ pour Claude ; server.mjs, src/, test/ et package.json pour Codex ; docs/ selon la mission.
- `agent_prompt_stalled` ne prouve pas l'échec : Codex et OpenCode ont démarré plus de 5 secondes après. Lire le panneau avant tout renvoi, ne jamais renvoyer à l'aveugle.
- Un texte collé peut rester dans la zone de saisie sans être envoyé (OpenCode). Après deux tentatives, changer d'approche au lieu de répéter.
- Ne jamais répondre à une boîte de dialogue d'un agent (autorisation, choix de dossier) à la place de DrSmoke. Ne jamais appuyer sur Échap chez un agent marqué au travail sans son accord.
- Le champ `tokens` de `herdr agent list` ne contient pas de consommation : ce sont des clés de tri et de logo. Les vrais tokens de Claude viennent de son transcript local ; les autres outils ne les exposent pas, afficher « Non exposé ».
- Un sous-agent lancé en arrière-plan reçoit tout de suite un résultat « Async agent launched » : il reste actif jusqu'à la notification de fin portant son tool-use-id.
- Couleurs d'identité et couleurs d'état ne doivent jamais se confondre : menthe, bleu et ambre sont réservés aux états.
- Herdr ne distingue que travail, disponible, attente, terminé et inconnu. Pas de « réflexion » ni de « pause » inventées : on peut seulement dire « dans cet état depuis » à partir des changements observés.
- Écrire les consignes aux agents en français accentué : une consigne sans accents a produit un README entièrement sans accents. Les agents imitent la forme de la consigne.
- Une mesure prise juste après une capture pleine page peut être faussée : vérifier le défilement par une mesure dédiée avant de déclarer un défaut.
- Captures : Chrome sans fenêtre bloque sur cette page animée avec `--virtual-time-budget`. Utiliser Playwright avec `channel: 'msedge'` installé hors du projet, et simuler les états par interception de /api/state sans jamais envoyer de consigne.
- Lecture incrémentale d'un journal : vérifier la continuité des octets (taille et début inchangés) avant de reprendre à l'ancien décalage ; un journal réécrit doit être relu depuis le début (OpenCode, délégations).
- Un hook de commit doit tester le contenu indexé (extrait dans un dossier temporaire), jamais le dossier de travail où d'autres agents écrivent en parallèle.
- Les sous-agents d'un outil peuvent tomber en panne (« Model unavailable ») : l'agent doit alors faire le travail lui-même et le signaler, pas abandonner.
- Commiter uniquement ses propres fichiers (`git add <chemins>`), jamais `git add -A` : un commit d'OpenCode a embarqué une modification en cours de Claude dans public/app.js. Le hook l'a vérifiée, mais l'historique attribue le travail au mauvais auteur.
- Après un redémarrage d'un agent (OpenCode), vérifier que ses missions en cours ont bien abouti dans le dossier principal : un redémarrage peut perdre la consigne ou laisser le travail dans un worktree.
- La police pixel n'a pas tous les signes : « · » s'affiche « ? ». Utiliser le tiret dans les textes de la scène.
