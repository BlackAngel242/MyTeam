# Contre-revue OpenCode : tableau de l'équipe et tournée du chef

17 octobre 2026. Lecture seule des commits f8b017e et 366df1e : `src/blackboard.mjs`, la route `/api/tableau` de `server.mjs`, et dans `public/app.js` le tableau (openBoard, renderBoard, cork) et la tournée du chef (drawOffice). Aucun code modifié ; les reproductions sont des lectures en mémoire ou des scénarios décrits, jamais des envois. Sept défauts, classés par gravité.

## D1. Moyenne : le masquage laisse passer des chemins et des identifiants

**Ligne :** `src/blackboard.mjs:13-15` (fonction `clean`).

**Scénario reproduit :** appel en mémoire de `parseBlackboard` avec une ligne de leçon contenant `~/.herdr/packages/standalone/x.exe`, `/root/.ssh/id`, `/etc/passwd`, `/workspace/projet/src/a.mjs`, l'identifiant d'agent `w5:p1@d234f56741fc0479` et un digest SHA-256. Sortie obtenue, tout passe entièrement : `voir ~/.herdr/packages/standalone/x.exe et /root/.ssh/id et /etc/passwd et /workspace/projet/src/a.mjs` et `identifiant w5:p1@d234f56741fc0479 et hash e3413f...`. Seuls le chemin `C:/Users/...` et l'UUID sont masqués. Le motif Unix de la ligne 15 ne couvre que les racines `Users|home|tmp|var|opt|mnt`, uniquement après un début de ligne, une espace ou un backtick ; les chemins en `~`, `/root`, `/etc`, `/workspace`, `/data` ne sont pas couverts. L'empreinte d'agent (16 hexadécimaux après `@`) et les digests longs ne sont pas des UUID et passent aussi.

**Impact :** l'annonce « chemins et identifiants masqués » du commit ne tient pas pour les piliers qui citent des chemins Unix ou des empreintes de file d'attente. Les identifiants de panneau du type `w5:p1`, affichés volontairement ailleurs, restent un choix assumé et ne sont pas signalés ici.

**Correctif proposé :** masquer tout chemin absolu commençant par `/` (ou compléter les racines avec `root|etc|srv|data|workspace`), tout chemin commençant par `~/`, toute empreinte de forme `quelquechose@[0-9a-f]{8,}` et tout digest hexadécimal de 32 caractères ou plus, avant la limite de 240 caractères.

## D2. Moyenne : un lien symbolique contourne la liste fermée de fichiers

**Ligne :** `src/blackboard.mjs:60-62` (`stat` puis `readFile`).

**Scénario reproduit :** `stat` suit les liens symboliques et `info.isFile()` est vrai pour la cible d'un lien. Un fichier nommé `TODO.md` dans le projet, qui serait un lien vers un autre fichier local de moins de 512 Ko, serait lu et affiché au tableau, avec le masquage partiel de D1. Le reste du projet refuse les liens symboliques (convention de `src/claude-activity.mjs` et `src/files.mjs`) ; c'est le seul lecteur qui ne le fait pas.

**Correctif proposé :** `lstat` comme ailleurs, refus si `isSymbolicLink()`, puis lecture ; garder le plafond de taille.

## D3. Moyenne : « Actualiser le bureau » ne recharge pas le tableau

**Ligne :** `public/app.js:112` (bouton de `errorBlock`), utilisé par `openBoard` (1327) et `renderBoard` (1320).

**Scénario reproduit :** `/api/tableau` répond 500 (ou renvoie un tableau vide) → le panneau affiche le bloc d'erreur avec son bouton « Actualiser le bureau » → le clic appelle `refreshState`, `loadQueue`, `loadTodos`, `loadFiles` selon l'onglet courant, mais jamais `loadBoard` : le tableau reste vide ou en erreur jusqu'à une fermeture puis réouverture du panneau. Le bouton promet une actualisation qu'il ne fait pas.

**Correctif proposé :** donner à `errorBlock` une action de rechargement en paramètre (par exemple `onRefresh`) ; `openBoard` et `renderBoard` passeraient une action qui rappelle `loadBoard` puis `renderBoard`.

## D4. Moyenne : la tournée ignore la mise en pause de la scène

**Ligne :** `public/app.js:1091-1127` (`drawOffice` ne lit jamais `paused`).

**Scénario reproduit :** une délégation est observée, le chef se lève et porte le dossier ; DrSmoke clique « Mettre en pause » : les sous-agents se figent (`syncActors` gère `paused`, lignes 950-953) mais le chef continue sa tournée, sort de la Direction, pose le dossier et revient. Le reste de la scène est figé, un seul personnage bouge.

**Correctif proposé :** comme pour les sous-agents, geler la progression de la tournée quand `paused` est vrai (conserver `act.t0` et ajouter la durée de pause au décalage, ou sauter le dessin sans avancer le temps de marche).

## D5. Moyenne : une délégation reçue pendant la pause ne joue jamais

**Ligne :** `public/app.js:1022-1024` (`syncOffice`).

**Scénario reproduit :** la scène est en pause, le chef délègue une tâche : `remember(dk)` marque la délégation comme vue AVANT le test `paused`, puis le `continue` saute la création de l'acteur. À la reprise, la délégation est déjà dans `seenDelegations` : la tournée ne démarrera jamais, le dossier titré n'apparaîtra pas sur le bureau de l'agent.

**Correctif proposé :** déplacer `remember(dk)` après les tests de création (ou n'appeler `remember` qu'au moment de la création de l'acteur) ; au pire, rejouer les délégations non animées à la reprise.

## D6. Faible : le piège de Tabulation perd le focus s'il a quitté le panneau

**Ligne :** `public/app.js:1336`.

**Scénario reproduit :** le panneau du tableau est ouvert ; un clic sur le texte d'une carte (non focalisable) met le focus sur `body` ; la touche Tab est pressée : `f.indexOf(document.activeElement)` vaut -1, la condition de bouclage n'est pas remplie, le Tab s'échappe vers le fond rendu inerte et le focus est perdu, sans retour possible sauf souris.

**Correctif proposé :** quand `document.activeElement` n'est pas dans la liste des éléments du panneau, empêcher le Tab par défaut et amener le focus au premier élément (dernier avec Maj+Tab).

## D7. Faible : une réécriture du tableau pendant la navigation clavier perd la position

**Ligne :** `public/app.js:1319` (`renderBoard` remplace `board-body` sans mémoriser le focus).

**Scénario reproduit :** l'utilisateur navigue au clavier dans les cartes du tableau ; un rechargement (réouverture ou actualisation future) appelle `renderBoard` ; le focus retombe sur le corps du document alors que le panneau est toujours ouvert. Les autres listes de l'interface (renderAgents, renderQueue, renderBroadcast) mémorisent et rendent le focus ; cette liste non.

**Correctif proposé :** même mécanique de mémorisation que `renderQueue` (retrouver l'élément par un identifiant stable après reconstruction).

## Points vérifiés sans anomalie

- **Route `/api/tableau` (server.mjs:164-168) :** aucune donnée venant du navigateur n'atteint la lecture ; `getBlackboard()` est appelé sans argument, la liste des quatre piliers est littérale dans le module, et jeton et provenance sont exigés comme pour les tâches. Aucun contournement par le nom de fichier ou par `root` n'est possible côté HTTP.
- **Aucune écriture :** le module ne fait que `stat` et `readFile`, et la sortie ne contient ni chemin de journal ni contenu brut au-delà des extraits masqués et bornés (240 caractères par ligne, 6 à 8 lignes par carte).
- **Sérialisation des tournées :** une seule tournée à la fois fonctionne comme annoncé (`bossBusy`, ligne 1111), les acteurs en attente patientent sans se perdre, et une tournée normale se termine bien : le retour est calculé, l'acteur est supprimé à la ligne 1120, et une tournée dont le poste disparaît est retirée proprement (ligne 1096) plutôt que de rester bloquée.
- **Couches du clavier :** la palette, le panneau et l'aide répondent chacun à leur tour aux touches (Ctrl+K désactivé pendant le panneau, Échap fermant la couche du haut, ligne 1352-1359), et le focus est rendu au déclencheur à la fermeture (ligne 1331).

## Limites de cette revue

- Les défauts D1 et D2 ont été reproduits en mémoire sur les fonctions réelles ; D3 à D7 sont des lectures de code et des scénarios, non exécutés contre le serveur vivant (aucun clic, aucune requête).
- La tournée n'a pas été observée en animation ; les durées (walk, vitesse 34 px/s) n'ont pas été mesurées.
- Le contenu réel des quatre piliers ne contient aujourd'hui aucun des motifs dangereux de D1 : le défaut est latent, il apparaîtra dès qu'une leçon ou un passage de relais citera un chemin Unix, un chemin en `~` ou une empreinte de file.
