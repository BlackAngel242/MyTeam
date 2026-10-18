# Missions du 18 octobre 2026

Règles communes : lire `AGENTS.md` et `LESSONS.md` en entier avant de commencer. Travailler dans le dossier du projet, branche `main`. Commiter seulement tes propres fichiers (`git add <chemins>`, jamais `git add -A`), aucun `git push`. Ne répondre à aucune boîte de dialogue à la place de DrSmoke. Terminer par un compte rendu court : hash du commit, `npm run check` et `npm test` (nombre de tests), ce qui n'a pas pu être vérifié, nouvelles leçons ajoutées à `LESSONS.md`. Le chef évalue ensuite, corrige si besoin et te transmet ses corrections : les relire fait partie de la mission. Le plan complet est dans `docs/plan-travail.md`.

## OpenCode : A1, réponses structurées côté serveur

Lire `docs/avis-codex.md`, section P0. Fichiers à toi : `src/responses.mjs` (nouveau), la route dans `server.mjs`, `test/responses.test.mjs` (nouveau), ligne ajoutée à `npm run check` dans `package.json`.

- `GET /api/reponses?id=<agent>` protégée comme `/api/todos` (jeton et provenance), lecture seule des journaux locaux (Claude, Codex, OpenCode), lecture incrémentale et bornée comme `src/delegations.mjs`.
- Chaque réponse : clé publique opaque, agent, heures observées, blocs de texte, source, état parmi `en cours`, `terminée`, `interrompue`, `fin non déterminée` seulement quand le journal le permet.
- Ne jamais exposer : identifiants internes de session, chemins de journaux, comptes, messages inter-agents chiffrés de Codex, table `credential` d'OpenCode (colonnes précises seulement). Masquer secrets et chemins comme `src/todos.mjs` (`textOf`), y compris les chemins en `~`.
- Si le rattachement est ambigu, ne pas rattacher.
- Tests sur journaux factices : réponse longue, accents et emojis, ligne géante, journal réécrit, message chiffré, agent inconnu.
- Contrat de sortie à écrire en tête de `src/responses.mjs` pour qu'Antigravity branche l'interface dessus.

Quand A1 est évalué, la suite est E3 : `GET /api/discussion` (fil de la salle de contrôle), même lecteur de journaux. Détail dans `docs/os-fonctions-opencode.md`, section 2.

## Antigravity : A2, A3, A4, carte de réponse

Lire `docs/avis-codex.md`, sections P2, P3, P4. Fichier à toi : `public/response-card.js` (nouveau) et `public/style.css` pour les styles de la carte uniquement (préfixe `.rc-`). L'intégration dans `public/app.js` est faite par le chef : documente en tête de ton module la fonction à appeler et les données attendues.

- Markdown restreint et sûr : paragraphes, titres, listes, citations, gras, code en ligne, blocs de code. Jamais `innerHTML`, uniquement `createElement` et `textContent`. Liens : protocoles contrôlés. Aucune image distante. Syntaxe non prise en charge : affichée comme texte.
- Bouton « Copier le code » par bloc, « Copier la réponse » (Markdown source complet), « Exporter la réponse » en `.md` (Blob local), « Exporter la session affichée ». Copie et export lisent le même objet de contenu, jamais `innerText`. Repli zone de texte en lecture seule si le presse-papiers est refusé.
- Mise à jour par clés stables : ne pas reconstruire la liste, garder sélection, focus et défilement. Réponse en cours exportée comme instantané daté marqué « partiel ».
- Entrée attendue : le format de `GET /api/reponses` défini par OpenCode en tête de `src/responses.mjs`. Tant qu'il n'est pas livré, coder tolérant (404 = état vide, pas d'erreur).
- Vérifier avec Playwright (`channel: 'msedge'`, états simulés, aucune consigne réelle) : réponse longue, plusieurs blocs de code, HTML actif en texte, 360 et 390 px.

Ensuite : D3 (ranger `LESSONS.md` par thèmes sans perdre aucune leçon), puis F1 et F2 (nom `MyTeam` partout, `CHANGELOG.md`, `README.md`, `docs/aide.md`).

## Codex : B1 à B4, sécurité des installeurs

Tu as trouvé les défauts dans ta revue : corrige-les. Fichiers à toi pour cette mission : `scripts/installer.sh`, `scripts/installer.ps1` et leurs tests s'ils existent (`test/`). Économise ton quota : mission courte, pas d'exploration inutile.

- B1/B2 : un dossier nommé `$(commande)` ne doit jamais s'exécuter. Passer les arguments séparément, échapper selon le format de chaque fichier généré (profil, raccourcis, `.desktop`), supprimer `sh -c` quand possible.
- B3 : `-Oui` et `--oui` ne valident plus l'installation de Herdr ni des extensions : vrai o/n à chaque fois.
- B4 : le chemin de Herdr doit être un exécutable résolu littéralement, `installer.ps1` ne doit pas être accepté.
- Ajouter un test qui reproduit chaque cas (dossier piégé, `--oui`, faux Herdr). Ne lancer aucune installation réelle.

## Codex : A1b puis E2 (reprise des missions d'OpenCode, bloqué par une boîte de dialogue)

Ton quota le permet (28 % et 52 % utilisés). Propriété réattribuée par le chef pour ces deux missions : `src/responses.mjs` (déjà livré pour Claude, commit f3ccb2d), `src/queue.mjs`, `server.mjs` et leurs tests. Lire `LESSONS.md` en entier, surtout les trois leçons du 18 octobre : ne commite que si tu as lancé `npm run check` et `npm test` (si Bash est bloqué, ne commite pas et dis-le), et écris tes tests avec des scripts passés par fichier, jamais `bash -c`.

**A1b.** Étendre `src/responses.mjs` à Codex et OpenCode avec le même contrat de sortie (voir son en-tête). Rattachement par dossier de travail, comme `src/agent-activity.mjs` (réutilise ses lecteurs plutôt que d'en écrire d'autres : exporte ce qu'il faut). Plusieurs agents du même outil dans le même dossier, ou rattachement douteux : ne rien rattacher (`supported:true, found:false`). Jamais les messages `agent_message` chiffrés de Codex, jamais la table `credential` d'OpenCode. Brancher dans la route `GET /api/reponses` de `server.mjs` (aujourd'hui seul Claude avec `sessionId`). Tests sur journaux factices.

**E2.** Envoi d'un fichier avec une consigne : `docs/os-fonctions-opencode.md` section 5 et `docs/contrat-fichiers.md`. `files: [{root, path}]` accepté par `POST /api/queue`, copie sans écrasement dans le dossier de l'agent avant l'envoi (réutilise `transfer` de `src/files.mjs`), plafond de deux fichiers de 20 Mo, échec de copie = l'élément passe « à revoir » avec la raison, aucun envoi, la consigne cite le nom du fichier copié. Tests avec dossiers temporaires. Documente la forme exacte de la réponse en tête de ta section de `docs/contrat-fichiers.md` : le chef branche l'interface dessus.

Compte rendu court après chaque point (A1b d'abord), avec hash de commit.

## Antigravity : suite (D3, E5, F1, F2), dans cet ordre

Évaluation de A2 à A4 : acceptée, intégrée par le chef (volet « Réponses lisibles » du poste, commit 40e0dc1). Relis `LESSONS.md` (nouvelles leçons du 18 octobre) avant de continuer.

- **D3.** Range `LESSONS.md` par thèmes (Herdr et agents, serveur et données, interface et Playwright, Git et équipe, sécurité, installeurs) sans perdre ni modifier aucune leçon : même nombre de lignes de fond, seul l'ordre et les titres changent. Une leçon par ligne.
- **E5.** Fil de discussion dans l'interface : `GET /api/discussion` (jeton `X-Bureau-Token`) renvoie `{bulles:[{agent,id,key,at,state,extrait}], sources:[{agent,id,etat}]}`, `etat` parmi `lu`, `non rattaché`, `non exposé`. Écris `public/discussion.js` (fonction `window.Discussion.render(container, data)`, DOM sûr sans `innerHTML`, même style que la carte de réponse) : bulles du plus récent au plus ancien, nom de l'agent, heure, état, extrait ; sous la liste, une ligne par agent non lu avec sa raison (« non exposé par cet outil », « non rattaché avec certitude »). Le chef l'intègre dans l'onglet Équipe et ajoute `/discussion.js` au serveur. Vérifie avec Playwright sur états simulés, 360 et 1440 px.
- **F1.** Le nom `MyTeam` partout dans les documents (écart relevé dans `HANDOFF.md`, `docs/publication-github.md`, README, CONTRIBUTING).
- **F2.** `CHANGELOG.md` (section « Non publié »), `README.md` et `docs/aide.md` à jour : tableau des tâches avec pourcentage, réponses lisibles, fichiers joints, fil de discussion, installeurs plus sûrs.

## Codex : E6, traitement d'un fichier confié

`docs/os-fonctions-opencode.md` section 6. `GET /api/traitement?id=<agent>` (même garde que les autres lectures) : pour un fichier joint à une consigne par `POST /api/queue` (E2), un dossier `{id, fichierConfie (nom seul), cible, faits:[{at, fait, source}]}` construit par recoupement de ce que le serveur observe : consigne mise en file / envoyée (file d'attente), copie faite (`copiedFiles`), état Herdr de la cible, date de modification du fichier copié dans le dossier de l'agent, fin de réponse observée (`src/responses.mjs`). Chaque fait cite sa source (`file`, `disque`, `herdr`, `journal`). Jamais « réussi » ni « traité » : seulement des faits datés, avec « le fichier a changé pendant le traitement » si sa date de modification est postérieure à l'envoi. Nom de fichier seul, jamais de chemin. Tests. Documente la forme exacte en tête de ta section de `docs/contrat-fichiers.md`. Même règle : ne commite que si les tests ont pu être lancés.

## OpenCode : revue QA finale (lecture seule, sauf ton rapport)

Tu travailles dans un worktree : lis et teste uniquement dans le dossier du projet (branche `main`), ne modifie rien d'autre que ton rapport `docs/revue-opencode-final.md`. Relis `AGENTS.md` et `LESSONS.md` d'abord. Passe en revue les commits du 18 octobre (`git log --since=2026-10-18`) : `src/responses.mjs`, `/api/reponses`, `/api/discussion`, `/api/traitement`, fichiers joints dans `src/queue.mjs`, `public/response-card.js`, `public/discussion.js`, installeurs. Cherche : fuite de chemin, identifiant ou secret dans une réponse publique, contournement de garde (jeton, origine), double envoi, écrasement de fichier, lecture de `credential` ou de messages chiffrés, régression d'accessibilité. Rapport court : défauts numérotés (gravité, fichier:ligne, scénario, correctif proposé). Ne commite que ce rapport (`git add docs/revue-opencode-final.md`), pas de push.

# Lot G : salle de crise et mosaïque (DrSmoke a accepté les deux)

Spécification de départ : `docs/os-fonctions-antigravity.md`, fonctions 6 et 7, et `docs/idees-os.md` section 8. Relis `LESSONS.md` avant de commencer (ne pas modifier `npm test`, ne commiter que si les tests ont tourné, chemins avec espaces, antislashs dans les fichiers écrits).

## OpenCode : G1, salle de crise côté serveur

Fichiers à toi : `src/crisis.mjs` (nouveau), `src/herdr.mjs` (ajout de `interrupt` seulement), `src/queue.mjs` (option de verrou seulement), `server.mjs` (routes), `test/crisis.test.mjs` (nouveau), `docs/contrat-crise.md` (nouveau), ligne dans `npm run check`.

- État `{active, since}` persisté de façon atomique dans `.bureau/crise.json` (hors Git, comme la file). Fichier corrompu ou illisible : crise ACTIVE (en cas de doute, rien ne part), avec la raison.
- `GET /api/crise` renvoie `{active, since, reason}` ; `POST /api/crise {active:boolean}` (jeton et origine exacte comme les autres écritures) l'enclenche ou la lève. Une requête mal formée est une erreur de saisie (400).
- Crise active : `POST /api/prompt` et `POST /api/broadcast` répondent 423 avec « Salle de crise active : les envois sont verrouillés. Levez la crise pour reprendre. » ; la file continue d'accepter des consignes mais `tick()` n'envoie rien (option `locked: () => boolean` de `createQueue`, vérifiée juste avant chaque envoi) ; la passation de direction passe par la file donc reste suspendue.
- `POST /api/crise/arret {id}` : seulement si la crise est active (sinon 409). Demande à l'agent de s'arrêter proprement par une interruption polie : `bridge.interrupt(id)` dans `src/herdr.mjs` retrouve l'agent avec son identifiant courant (empreinte comprise, comme `prompt`) puis lance `herdr pane send-keys <paneId> Escape` via `execFile` avec un tableau d'arguments, aucun shell. Jamais de kill. Réponse `{requested:true}`, avec le nom de l'agent, sans chemin.
- Tests : verrou persistant après redémarrage, fichier corrompu = active, 423 sur envoi et diffusion, `tick` n'envoie rien puis reprend à la levée, interruption avec arguments exacts (faux `executeFile`), agent inconnu 400, garde jeton et origine.
- Contrat exact des routes dans `docs/contrat-crise.md` : le chef branche l'interface dessus.

## Antigravity : G2, mosaïque

Fichier à toi : `public/tiles.js` (nouveau) et styles `.tl-` dans `public/style.css` (ajout en fin de fichier seulement). Même méthode que `public/response-card.js` : en-tête de module documentant le contrat, aucun `innerHTML`.

- `window.Tiles.mount(container, api)` et `window.Tiles.unmount()`. `api` fourni par le chef : `agents()` renvoie `[{id,name,kind,status,paneId,paused}]` (statuts Herdr : `working`, `idle`, `blocked`, `done`, `unknown`), `read(id)` renvoie `Promise<{text}>` (les dernières lignes du terminal), `send(id,message)` renvoie `Promise<void>` et peut échouer avec un `Error` portant un message lisible, `canSend(agent)` renvoie un booléen, `onExpand(id)` ouvre le poste complet, `onClose()` revient à la vue scène.
- 2 à 4 tuiles : les agents au travail d'abord, puis les autres, au plus 4 ; bascule « grille 2×2 » ou « colonnes » ; si plus de 4 agents, des cases permettent de choisir lesquels affichés.
- Chaque tuile : en-tête compact (nom, outil, état, bouton Agrandir), dernières lignes du terminal dans un `pre` en `textContent` (nettoyer les séquences ANSI avec `TerminalView` de `public/terminal.js` si utilisable, sinon un nettoyage simple), recherche légère, champ de consigne rapide avec `Ctrl+Entrée`, désactivé avec l'explication quand `canSend` est faux.
- Rafraîchissement borné aux tuiles visibles : une lecture par tuile toutes les 3 s, rien quand l'onglet du navigateur est caché, une lecture à la fois par tuile, pas de relecture si le texte est identique, sélection de texte conservée.
- Accessibilité : grille avec `role="group"` et noms accessibles, tout au clavier.
- Vérifie avec Playwright sur des états simulés (1440, 390 et 360 px) : aucune consigne réelle.

# Lot H : installation clé en main, kit d'équipe, version anglaise

Demande de DrSmoke : que l'installation donne à un nouvel utilisateur le même environnement que le sien (Herdr en 4 panneaux répartis en grille 2×2, bureau en pixel art dans le navigateur, raccourci du bureau qui lance tout), avec visite guidée, version anglaise, et le système de fichiers piliers, d'auto-évaluation et de partage des leçons. Rappels : `LESSONS.md` d'abord ; ne commiter que si `npm run check` et `npm test` ont tourné ; pas de push (le chef demande l'accord de DrSmoke) ; chaque installation reste confirmée par un vrai o/n.

## Antigravity : H1, documentation anglaise

`README.en.md`, `docs/INSTALLATION.en.md`, `docs/aide.en.md`, `CONTRIBUTING.en.md` : traductions fidèles et naturelles des versions françaises (le français reste la référence), avec un lien « English / Français » en tête de chaque version. Garde les noms de fichiers, commandes et identifiants exacts. Quand `docs/kit.md` existe (le chef l'écrit), traduis-le en `docs/kit.en.md`. Ne touche ni au code ni aux scripts.

## OpenCode : H2, interface bilingue (tu es propriétaire de `public/app.js`, `public/index.html` et des modules `public/*.js` pendant cette mission ; le chef n'y touche pas)

- `public/i18n.js` (nouveau) : `window.t(clé, valeurs)` ; le français reste la langue de référence ; dictionnaire anglais dans `public/i18n-en.js`. Langue choisie par `localStorage` (`bureau.langue`), sinon `navigator.language` (commence par `fr` = français, sinon anglais). Bouton de bascule FR / EN dans l'en-tête (accessible, `aria-pressed`, `lang` du document mis à jour).
- `index.html` : textes statiques par `data-i18n` (et `data-i18n-attr` pour `aria-label`, `title`, `placeholder`). `app.js` et les modules `response-card.js`, `discussion.js`, `tiles.js` : chaînes visibles passées par `t()` ; pas de concaténation de phrases : un gabarit avec `{nom}`. Pluriels explicites.
- Messages d'erreur du serveur (en français) : table exacte dans le dictionnaire pour les afficher en anglais ; message inconnu = affiché tel quel. Ne change pas le serveur.
- Texte dessiné dans le canvas (libellés de la scène) : traduire aussi, sans signe absent de la police pixel.
- Test `test/i18n.test.mjs` : chaque clé utilisée existe dans le dictionnaire anglais, pas de clé orpheline, `t` remplace les valeurs, repli sur le français. Vérifie avec Playwright en français puis en anglais (1440, 390, 360 px), sans débordement de texte.

## Codex : H3, installeurs (`scripts/installer.ps1`, `scripts/installer.sh`, `Ouvrir le bureau.ps1`/`.cmd`, tests)

- Espace Herdr : grille 2×2 (gauche et droite, chacune coupée en haut et en bas), comme celui de DrSmoke. Vérifie dans `herdr pane split --help` comment cibler un panneau précis ; sinon le dire. Panneaux nommés Chef, Agent 2, 3, 4.
- Après la création : proposer, panneau par panneau, de lancer un outil détecté sur la machine (`claude`, `codex`, `agy`, `opencode`) avec `herdr agent start <nom> --kind <type> --pane <id>`, un o/n par outil ; jamais un outil absent ; jamais de lancement avec `-Oui`.
- Raccourci : troisième choix « Herdr et bureau » : ouvre un terminal qui lance Herdr, démarre le serveur du bureau et ouvre le navigateur sur `http://127.0.0.1:<port>`, sans second serveur si celui-ci écoute déjà. Défaut inchangé.
- Invites et messages en français et en anglais : option `-Lang fr|en` / `--lang fr|en`, sinon langue du système. Les tests existants restent verts.
- Nouvelle étape finale facultative « Kit d'équipe » : propose d'initialiser un projet avec `node scripts/init-kit.mjs <dossier>` (le chef écrit ce script ; prévois l'appel et son test avec un faux script).
- Même règles de sécurité que B1 à B4 : aucune valeur du disque interpolée dans une commande. Mission longue : économise ton quota, un point à la fois, compte rendu court avec hash.

