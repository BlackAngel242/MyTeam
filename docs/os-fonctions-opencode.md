# Étude de faisabilité : les fonctions de l'« OS d'agents » côté serveur et données

17 octobre 2026. Étude sans modification de code, pour préparer la décision de DrSmoke sur cinq fonctions : salle de contrôle avec fil de discussion, transfert de direction, priorité dans la file d'attente, envoi de fichiers avec une consigne, traitement de fichiers suivi jusqu'au résultat.

Sources : les modules existants (`src/herdr.mjs`, `src/claude-activity.mjs`, `src/agent-activity.mjs`, `src/delegations.mjs`, `src/queue.mjs`, `src/files.mjs`) et les journaux réels de Claude, Codex et OpenCode de ce poste, lus en lecture seule pour cette étude. Projet de référence cité par le chef : Atoll92/agent-standup, qui lit lui aussi les journaux locaux (Claude Code et Codex notamment) pour montrer « ce que disent réellement les agents », avec des extraits bornés (environ 1 à 2 Ko par sortie) et une option qui masque code et noms de fichiers dans ses exports. Son README signale qu'OpenCode n'a pas encore d'adaptateur chez eux car son format est peu documenté : nous, nous le lisons déjà.

Règle commune à tout ce qui suit : on n'affirme que des faits observés (journal, disque, état Herdr, heure du poste), on ne devine ni intention ni réussite, aucune clé ni aucun secret n'est lu ni stocké, et tout envoi vers un agent passe par la file d'attente existante.

## 1. Ce que les journaux contiennent réellement (vérifié sur ce poste)

- **Claude** (`~/.claude/projects/<dossier>/<uuid>.jsonl`) : une ligne JSON par événement, horodatée. Les échanges sont en clair : messages `user` et `assistant` avec blocs `text`, appels d'outils `tool_use` et leurs `tool_result`. Les autres lignes sont des métadonnées (mode, pièces jointes, historique de fichiers). C'est déjà la source de `src/claude-activity.mjs`.
- **Codex** (`~/.codex/sessions/<année>/<jour>/rollout-<uuid>.jsonl`) : `response_item/message` avec les rôles `developer`, `user`, `assistant` et blocs `input_text` ou `output_text` (parfois une image) ; aussi `reasoning` (résumés), `function_call` et sa sortie, `custom_tool_call` et sa sortie, `event_msg` (dont les `SubAgentActivity` des sous-agents), `token_count` avec les limites de quota, et des instantanés `world_state` (avec un champ `filesystem`). ATTENTION : les messages `agent_message` entre agents ont un contenu chiffré : illisible, jamais exposé, jamais deviné.
- **OpenCode** (base SQLite locale) : la table `message` porte rôle et heure, la table `part` porte le texte (`data` avec `type` et `text`). La même base contient une table `credential` : toute lecture doit rester sur des colonnes précises, comme le fait déjà `src/agent-activity.mjs`, sans jamais parcourir les autres tables.
- **Déjà lu par le bureau** : états et terminaux Herdr (`herdr.mjs`), jetons et sous-agents (les deux modules d'activité), ordres du chef (`delegations.mjs`), consignes et leur devenir (`queue.mjs`), lieux et fichiers avec copie sans écrasement (`files.mjs`).

## 2. Salle de contrôle : fil de discussion des agents

**Donnée réelle qui la nourrit.** Les textes `user` et `assistant` des trois journaux (formes vérifiées ci-dessus), les sorties de terminal déjà servies par `/api/read`, les délégations du chef déjà dans `/api/state`, et les événements de sous-agents.

**Ce qu'on peut affirmer sans inventer.** « À 10 h 32, Claude a écrit ceci (extrait de 240 caractères) », « Codex a lancé telle commande et la sortie dit ceci », « le sous-agent X a démarré puis été terminé ». On ne peut pas affirmer ce qu'un agent « pense » ou « ressent », ni traduire un message inter-agent chiffré.

**Route ou contrat.** Une nouvelle route de lecture `GET /api/discussion?agent=<id>&since=<ISO>&limit=50`, protégée comme les tâches (jeton et provenance), renvoyant des bulles `{agent, role, at, extrait, genre}` avec `genre` parmi `message`, `commande`, `outillage`. Lecture par la fin des fichiers seulement, incrémentale et bornée, avec les protections déjà en place dans `delegations.mjs` (plafonds, saut des lignes géantes, détection de réécriture, aucun chemin ni contenu brut en sortie).

**Risque et parade.** Risque principal : les secrets collés dans les journaux (clés, chemins personnels, jetons). Parade : masquage systématique avant tout envoi, sur le modèle du tableau mural mais en corrigeant ses lacunes (les chemins en `~`, `/root`, `/etc` et les empreintes d'agent passent aujourd'hui : voir ma contre-revue), extraits plafonnés, et refus total des contenus chiffrés. Risque secondaire : volume et relectures inutiles ; parade : ne lire que la fin des journaux (choix d'agent-standup aussi) et cacher par curseur temporel.

**Effort.** Moyen : un module de lecture, une route, des tests sur journaux factices. Cette base sert ensuite aux bulles de la scène.

## 3. Transfert de direction (changer de chef, passation sur quota)

**Donnée réelle.** La règle actuelle `bossOf` (le plus petit numéro de panneau, approximation documentée du premier démarré, car Herdr ne donne pas l'heure de démarrage), les états Herdr de chaque agent, et les pauses de quota observées (`limitReached`, `resetsAt`, journal ou terminal).

**Ce qu'on peut affirmer.** Qui est le chef selon la règle ; quand il est réellement en pause de quota et pour combien de temps ; qui est prêt à recevoir. On ne peut pas affirmer « qui ferait le meilleur chef » : c'est un choix de DrSmoke.

**Route ou contrat.** Une préférence persistée hors Git (`.bureau/direction.json`) qui SURCHARGE la règle quand elle existe, avec `POST /api/direction {chefId}` et `DELETE` pour revenir à la règle ; le changement est un fait affiché (« chef : X depuis HH:MM »). La passation automatique sur pause de quota devient une option explicite : elle désigne le suivant selon la règle, l'affiche comme chef par intérim, et rend la main à la règle quand la pause se termine.

**Risque et parade.** Double direction (deux agents recevant les consignes de coordination) : parade, une seule source de vérité à tout moment, la préférence valant exception unique de la règle, et l'écran indiquant laquelle s'applique. Chef remplacé dans son panneau : exiger l'empreinte courante comme dans la file. La passation est un vrai message à l'agent : elle doit passer par la file d'attente et afficher « transmis à Herdr », jamais « tâche prise en charge ».

**Effort.** Petit pour la préférence et la route ; moyen pour la passation automatique (scénarios de bascule, tests avec faux Herdr).

## 4. Priorité des envois dans la file

**Donnée réelle.** `src/queue.mjs` : l'ordre d'envoi réel est celui de `createdAt`, avec les états durables, `holdUntil` et les clés de demande déjà en place.

**Ce qu'on peut affirmer.** L'ordre exact des envois, leur issue (envoyée, à revoir, annulée) et les pauses appliquées. L'urgence ressentie n'est pas un fait : la priorité est une décision de DrSmoke, pas une mesure.

**Route ou contrat.** `POST /api/queue` accepte `priority` (`haute` ou `normale`, défaut normale) ; `tick()` trie par priorité puis par ancienneté, avec un garde-fou anti-affamement (par exemple, un envoi de priorité normale sur trois, ou un âge maximal après lequel une consigne normale remonte). Le champ `priority` rejoint la forme publique de l'élément.

**Risque et parade.** Affamement des consignes normales : le garde-fou est chiffré, testé et visible dans l'interface. Double envoi : aucun changement, les protections actuelles restent (état durable avant envoi, jamais de renvoi après doute). Contournement par le client : deux valeurs acceptées, bornes inchangées côté serveur.

**Effort.** Petit : un champ, un tri, deux tests de garde-fou.

## 5. Envoi de fichiers avec une consigne

**Donnée réelle.** `src/files.mjs` sait déjà lister les lieux autorisés, copier ou déplacer sans jamais écraser un fichier existant, et refuser tout chemin qui sort de sa racine ; `src/queue.mjs` porte la consigne ; `herdr.mjs` l'envoie.

**Ce qu'on peut affirmer.** « Le fichier F a été copié dans le dossier de travail de l'agent à telle heure » (fait disque vérifiable), puis « la consigne mentionnant ce fichier a été transmise à Herdr ». Pas « l'agent l'a lu » ni « le travail est fait ».

**Route ou contrat.** `POST /api/queue` accepte `files: [{root, path}]` avec les mêmes clés que l'explorateur de fichiers ; avant l'envoi, le serveur copie via `transfer` en mode copie dans la racine de l'agent, puis la consigne porte le chemin copié ; si la copie échoue, aucun envoi : l'élément passe « à revoir » avec la raison.

**Risque et parade.** Échappement de chemin : la validation `resolveInside` et la liste fermée de racines existent déjà, à réutiliser telle quelle. Écrasement d'un travail existant : jamais, le refus est déjà testé. Volume : plafond explicite (par exemple deux fichiers de 20 Mo chacun). Double envoi : la copie refuse un nom déjà présent, donc une seconde tentative ne crée rien. Fuite de chemin dans l'interface : n'afficher que le nom de fichier, jamais son chemin complet.

**Effort.** Moyen : branchage sur la file, appel à `transfer`, tests avec dossiers temporaires.

## 6. Traitement de fichiers (un fichier confié, suivi jusqu'au résultat)

**Donnée réelle.** La copie du fichier (fonction 5), les états et terminaux Herdr, la date de modification du fichier visible dans `files.mjs`, les délégations et leur champ `result`, les listes de tâches déjà servies.

**Ce qu'on peut affirmer.** « Confiez le fichier F à X à telle heure » (copie et consigne observées), « X travaille » (état Herdr), « F a changé à telle heure » (date de modification observée), « l'envoi a été confirmé ou non » (résultat réel du journal). On ne peut PAS affirmer « c'est réussi » ou « le résultat est bon » : le bureau observe, il ne juge pas.

**Route ou contrat.** Un dossier de traitement construit côté serveur par recoupement, sans nouvelle source de vérité : `{id, fichierConfie, cible, confiéÀ, faits: [{at, fait, source}]}` où chaque fait cite sa source (disque, file, journal). Route `GET /api/traitement?id=...` en lecture. Pour lier les observations, la consigne envoyée peut porter une étiquette de dossier, que l'on retrouve ensuite dans le journal du chef comme dans la file.

**Risque et parade.** Faux positif de lien entre une modification du fichier et la consigne (un autre agent peut toucher le même fichier) : afficher « le fichier a changé pendant le traitement », jamais « traité ». Fuite de chemin : nom de fichier seul dans l'interface. Charge : rester sur des dates de modification et les fins de journal, sans relire les contenus.

**Effort.** Moyen à grand : c'est un recoupement de plusieurs sources ; à commencer après les fonctions 4 et 1, dont il réutilise les briques.

## 7. Ordre conseillé et limites de l'étude

Ordre par retour sur effort : 4 (priorité, petit), 3 (transfert de direction, petit), 5 (fichiers avec consigne, moyen), 2 (fil de discussion, moyen), 6 (traitement de fichiers, moyen à grand).

Limites honnêtes :

- Les journaux ont été lus en lecture seule, leurs formes vérifiées sur ce poste le 17 octobre 2026 ; un changement de version d'un outil peut changer ces formats.
- Des instantanés `world_state` existent dans les journaux Codex, avec un champ `filesystem`, mais leur contenu exact n'a pas été exploité ici : à vérifier avant de s'y fier, et mon commentaire « non observé » dans `src/agent-activity.mjs` date d'une époque où je ne les avais pas vus.
- Aucun secret ni chemin personnel n'est reproduit dans ce document ; les emplacements sont décrits en forme générique.
- Les estimations d'effort sont relatives (petit : quelques heures, moyen : une session, grand : plusieurs sessions), ce ne sont pas des délais.
