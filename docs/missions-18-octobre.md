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

## Antigravity : ordre H8, H9, H1

**H8, emblèmes de tous les outils Herdr.** Herdr accepte ces types d'agent (`herdr agent start --kind`) : pi, claude, codex, gemini, cursor, devin, agy, cline, omp, mastracode, opencode, copilot, kimi, kiro, droid, amp, grok, hermes, kilo, qodercli, qwen, letta, maki, muse. Dans `public/logos.js` (propriété de Codex pour cette mission : le chef te la confie), il n'existe que Claude, Codex, Antigravity, OpenCode et Gemini. Ajoute un emblème pixel 16×16 pour chacun des autres, même format (`palette` et `rows`), reconnaissable et distinct des autres (forme et couleur), redessiné simplement : n'essaie pas de copier fidèlement une marque, `NOTICE.md` précise que les marques restent à leurs éditeurs. Ajoute une courte table de correspondance pour que `logoCanvas(a)` retrouve l'emblème par le type d'agent (alias : `agy` et `antigravity`, `gemini`) ; vérifie dans `public/app.js` comment `logoCanvas` choisit la clé et fais l'ajustement minimal au même endroit (le chef n'y touche pas pendant H2 : écris-moi plutôt le correctif exact dans ton compte rendu si OpenCode est dessus). Génère une planche de contrôle (une seule capture Playwright avec tous les emblèmes, `docs/captures/15-emblemes-outils.png`). Test : `test/logos.test.mjs` vérifie 16 lignes de 16 caractères, symboles présents dans la palette, un emblème par type.

**H9, participation.** `CODE_OF_CONDUCT.md` (court, Contributor Covenant adapté, contact par le signalement privé du dépôt), `CONTRIBUTING.md` enrichi : signaler un défaut, proposer une idée, ajouter un outil compatible Herdr et son emblème, ajouter une langue, proposer une leçon pour `LESSONS.md`, faire une pull request (cases du modèle), règles du projet (zéro dépendance, vérité des faits). Modèles de signalement `.github/ISSUE_TEMPLATE/outil.yml` (nouvel outil) et `traduction.yml`, et `.github/labels.json` (bug, enhancement, outil, traduction, documentation, good first issue, help wanted, sécurité) avec couleurs. Ne crée rien sur GitHub : fichiers seulement.

## Codex : ajout à H3

Détecte tous les types d'agent Herdr listés ci-dessus (pas seulement quatre) quand tu proposes le lancement par panneau : un exécutable est « détecté » seulement si `command -v` ou `Get-Command -CommandType Application` le trouve. Dans `src/herdr.mjs`, complète la table des noms affichés (`names`) pour tous ces types, avec des noms propres (par exemple `kimi` → Kimi, `qodercli` → Qoder, `mastracode` → Mastra Code, `omp` → OMP) ; vérifie avec `herdr agent start --help` que la liste des types est exacte et signale tout écart. Test pour la table.

## Codex : ajouts à H3 (chef) puis H11

Demande de DrSmoke : la première tuile, celle du premier agent d'IA lancé (le chef), doit pouvoir écouter et diriger les autres. Herdr fournit `herdr --skill` (mode d'emploi pour l'agent chef) et des intégrations officielles `herdr integration install <outil>` (pi, omp, claude, codex, copilot, devin, droid, kimi, opencode, kilo, hermes, qodercli, qwen, letta, cursor, mastracode, antigravity-cli, grok) qui font remonter l'état et l'identifiant de session de l'agent : sans elles, Claude n'a pas d'`agent_session` sur ce poste et ses réponses ne sont pas lisibles dans le bureau.

- **H3, étape « Chef »** (après le lancement des outils) : pour chaque outil détecté, proposer `herdr integration install <outil>` (un o/n par outil, avec une phrase disant qu'elle modifie la configuration de cet outil), jamais avec `-Oui`. Pour le premier panneau, proposer de donner au chef ses commandes Herdr : écrire la sortie de `herdr --skill` là où son outil lit ses compétences seulement si le chemin est connu et vérifié (Claude : `~/.claude/skills/herdr/SKILL.md`, jamais d'écrasement), sinon expliquer que `CHEF.md` du kit suffit. Proposer enfin d'envoyer au chef une consigne d'orientation (o/n) : « Tu es le chef de l'équipe. Lis AGENTS.md et CHEF.md, liste les agents avec `herdr agent list`, puis attends les instructions de DrSmoke. » via `herdr agent prompt`.
- **H11, relais d'écoute** (quand H3 est livré) : dans `server.mjs` et un nouveau `src/relais.mjs` : option persistée `.bureau/relais.json` (`{actif:false}` par défaut), `GET/POST /api/relais` protégés comme les autres écritures. Quand le sondage voit un agent qui n'est pas le chef passer de travail à disponible/terminé, le serveur met en file (`createQueue`, priorité normale) UN message neutre pour le chef : « {nom} vient de terminer. Lis son panneau avant de lui confier la suite. » Une seule fois par passage observé (clé de demande avec identifiant d'agent et numéro de changement d'état), jamais si la crise est active, jamais pour le chef lui-même, jamais plus d'un message par agent et par minute. Tests avec faux Herdr et horloge. Le chef (Claude) ajoute la bascule dans l'onglet Équipe. Contrat en tête de `src/relais.mjs`.


## Antigravity : H12, bascule de langue sur GitHub et dans tous les documents publics

Demande de DrSmoke : la bascule FR / EN qui marche dans le bureau doit aussi exister sur le README GitHub et dans tout ce qu'il contient. Les cinq paires README, CONTRIBUTING, INSTALLATION, aide et kit ont déjà leur lien de bascule en tête. Reste :

- Versions anglaises + lien de bascule en tête (même forme que les paires existantes : `**Français** | [English](x.en.md)` et `[Français](x.md) | **English**`) pour : `CODE_OF_CONDUCT.md`, `SECURITY.md` (bilingue acceptable dans un seul fichier s'il reste court), `CHANGELOG.md` (`CHANGELOG.en.md`, dernières versions complètes, au moins 0.3.0 et « Non publié »), `NOTICE.md`, `docs/credits-ia.md`, `docs/plugins-recommandes.md` (le français reste la référence ; garde noms, commandes et identifiants exacts ; pronoms neutres pour les personnes et « it » pour les agents).
- Un index `docs/index.md` (FR) et `docs/index.en.md` (EN) : la liste des documents publics avec leurs deux versions liées côte à côte, et une phrase disant que les autres fichiers de `docs/` (revues, missions, contrats, études) sont des notes de travail internes en français.
- Dans `README.md` et `README.en.md` : remplace la ligne de bascule par un bloc bien visible (deux liens, drapeaux ou libellés « Français / English »), ajoute un lien vers l'index et vers les versions anglaises des documents dans les listes de liens du README.
- Modèles GitHub : `.github/PULL_REQUEST_TEMPLATE.md` et `.github/ISSUE_TEMPLATE/*.yml` en deux langues (titre et libellés « Français / English », une seule fois chacun, sans doublonner tout le texte).
- Vérifie que tous les liens relatifs des deux langues existent (un petit script Node jetable suffit, ne le commite pas). Commit avec chemins, pas de nom d'IA dans le message, compte rendu court avec hash. Ne pousse pas : le chef pousse.

## Codex : J1, mode interface des installeurs (puis OpenCode : J5, revue)

Lis `docs/installeur-protocole.md` : c'est le contrat exact. DrSmoke veut une installation animée (liste de tâches qui s'actualise, ligne de temps, comme `npx skills add`), lancée par un double-clic sur un `.bat` d'une release. Le dessin est fait par le chef en Node ; toi, tu rends les installeurs capables de parler ce protocole.

- `scripts/installer.ps1 -Interface` et `scripts/installer.sh --interface` : sans ce drapeau, rien ne change (tests existants verts). Avec : `Dire` devient `@@INFO`, chaque section numérotée devient `@@STEP`/`@@DONE` (dans l'ordre du protocole), `Confirmer` devient `@@CONFIRM` (réponse lue sur l'entrée standard, EOF = non), le choix du raccourci devient `@@CHOICE`, le dossier du kit devient `@@INPUT`. `@@PLAN` au début, `@@END` à la fin. Écris en UTF-8 (sortie PowerShell : `[Console]::OutputEncoding`).
- Nouvelle étape `clink` (Windows seulement, après Node.js) : Clink (chrisant996) ajoute couleurs, complétion et historique à cmd.exe ; propose `winget install --id chrisant996.Clink -e --accept-source-agreements --accept-package-agreements` après une confirmation individuelle (jamais avec `-Oui`), saute si `clink` est déjà présent ou si winget manque (dis-le). Identifiant vérifié par le chef : `chrisant996.Clink`, version 1.9.34 dans winget.
- Tests : un faux winget / faux Herdr, le protocole complet de bout en bout dans les deux scripts (PLAN, STEP, CONFIRM avec réponses o et n, EOF = refus, END), `-Oui` ne répond jamais à un CONFIRM d'installation, sans -Interface la sortie est inchangée. Règles B1 à B4 inchangées (aucune valeur du disque dans une commande).
- Ne modifie pas `scripts/installateur-anime.mjs` ni `Installer MyTeam.bat` (chef). Commit avec chemins, pas de nom d'IA, compte rendu court avec hash.


## Codex : J1, retouche (états et textes des étapes)

J1 accepté (protocole, étape Clink, tests). À corriger après un essai de bout en bout avec `node scripts/installateur-anime.mjs --simple --dry-run` : toutes les étapes se terminent en `skip` avec le texte « Étape terminée », même Node.js déjà présent. Règle : `ok` quand le besoin est satisfait (déjà présent ou installé), `skip` quand la personne refuse ou que l'étape ne s'applique pas, `fail` sur une erreur. Le texte du `@@DONE` dit le fait en peu de mots : « version 24 », « déjà présent », « refusé », « 4 panneaux créés », « 2 outils lancés ». Libellés du `@@PLAN` plus parlants : « Node.js 22 ou plus », « Herdr », « Espace Herdr en grille 2×2 », « Outils d'IA », « Commandes du chef », « Extensions », « Configuration et raccourci », « Kit d'équipe », « Vérification », « Clink (confort de cmd) » ; mêmes libellés en anglais. Les deux scripts. Tests mis à jour.

## OpenCode : J5, revue QA de l'installation animée et du paquet de release (lecture seule sauf ton rapport)

Dans le dossier du projet, branche `main`, lis `AGENTS.md` et `LESSONS.md`. Passe en revue : `Installer MyTeam.bat`, `scripts/installateur-anime.mjs`, `scripts/empaqueter-release.mjs`, `docs/installeur-protocole.md`, les changements de `scripts/installer.ps1` et `installer.sh` (mode interface, étape Clink), `.gitattributes`. Cherche : injection (une valeur du disque ou de la sortie de l'installeur qui finit dans une commande), contenu du zip (`git archive` sur HEAD : tout ce qui ne devrait pas partir : secrets, chemins personnels, journaux, notes internes), réponse automatique à une confirmation d'installation (`-Oui`, EOF, entrée vide), `-ExecutionPolicy Bypass` (portée du processus seulement ?), fermeture de l'entrée standard, caractères de contrôle ANSI venant de l'installeur dans l'affichage, comportement hors terminal. Teste en simulation seulement (`--dry-run`, `--demo`), jamais une installation réelle. Rapport court `docs/revue-opencode-installeur.md` (défauts numérotés : gravité, fichier:ligne, scénario, correctif), seul fichier que tu écris et commites.

## Antigravity : J6, documentation de l'installation par la release

Lis `Installer MyTeam.bat`, `scripts/installateur-anime.mjs` (en-tête et options) et `docs/installeur-protocole.md`. Mets à jour, en français et en anglais : `README.md` / `README.en.md` (section Installation rapide) et `docs/INSTALLATION.md` / `docs/INSTALLATION.en.md` : méthode 1 « télécharger le zip de la dernière release (page Releases du dépôt), le décompresser, double-cliquer sur `Installer MyTeam.bat` » (installeur animé : bannière, liste de tâches qui se met à jour, chaque installation confirmée par o/n, étape Clink facultative), `node scripts/installateur-anime.mjs --demo` pour voir l'animation sans rien installer, repli texte si Node.js manque (le `.bat` propose Node.js puis demande de relancer) ; méthode 2 : cloner le dépôt. Dis honnêtement que Windows peut afficher un avertissement SmartScreen pour un `.bat` téléchargé (fichier non signé) et comment le lever en connaissance de cause (Propriétés, Débloquer) ; sur macOS et Linux : `bash scripts/installer.sh`. Ne promets rien que le code ne fait pas. Commit avec chemins, pas de nom d'IA dans le message, pas de push, compte rendu court avec hash.

## Antigravity : K1, site GitHub Pages du projet

Demande de DrSmoke : une page `github.io` pour le projet (https://blackangel242.github.io/MyTeam/). Dossier `site/` (nouveau, statique, sans dépendance ni outil de build) :

- `site/index.html`, `site/style.css`, `site/site.js`, `site/assets/` (copie des captures utiles de `docs/captures/` : scène, poste, équipe, mosaïque, salle de crise, planche des 24 emblèmes ; un favicon pixel ; l'image de partage `social.png` 1200x630 tirée d'une capture).
- Bilingue FR / EN : bouton de bascule, langue choisie par le navigateur au premier passage puis mémorisée, `lang` du document mis à jour, mêmes textes dans les deux langues (dictionnaire dans `site.js`, `data-i18n` dans le HTML).
- Contenu : en-tête (nom, accroche, deux boutons « Télécharger la release » vers https://github.com/BlackAngel242/MyTeam/releases/latest et « Voir le code »), ce que c'est en trois idées (voir qui fait quoi, diriger l'équipe, ne rien inventer), grille des fonctions réelles (lis `README.md` : scène, poste, équipe, file, réponses lisibles, fil de discussion, fichiers joints et confiés, mosaïque, salle de crise, relais d'écoute, tâches avec pourcentage, kit d'équipe, FR/EN), galerie des captures, installation en trois gestes (télécharger le zip, double-clic sur `Installer MyTeam.bat`, ouvrir le bureau) avec la phrase SmartScreen, compatibilité (les 24 outils Herdr), participer (liens CONTRIBUTING, Discussions, Issues), crédit « Réalisé avec l'aide de l'IA ; auteur DrSmoke » comme dans le README, licence MIT. N'affirme que ce que le code fait.
- Style : le langage du bureau (bleu nuit, pixel art, mêmes couleurs que `public/style.css`), responsive 360 à 1440 px, accessible (repères, alt sur chaque image, contraste, focus visible, `prefers-reduced-motion`), aucune requête externe (pas de CDN, pas de police distante, aucun traceur), aucune information personnelle (pas de numéro, pas de société).
- Test `test/site.test.mjs` : tous les fichiers locaux référencés existent, les clés FR et EN sont identiques, aucune URL externe sauf github.com, pas de numéro de téléphone.
- Vérifie avec Playwright (1440, 390, 360 px, FR puis EN, ouverture du fichier en `file://` et via un petit serveur statique temporaire). Commit avec chemins, pas de nom d'IA dans le message, pas de push, compte rendu court avec hash. (Le chef ajoute le workflow de déploiement et active Pages.)

# Lot L : corrections issues de la table ronde (DrSmoke a coché les quatre lots)

Sources locales (non commitées) : `docs/table-ronde/consensus.md` (classement), `rapport-*.md` (preuves et lignes), `avis-*.md`. Lis `consensus.md` puis les constats cités pour ta part. Pour chaque correction : reproduire d'abord (le constat donne les étapes), corriger, ajouter le test qui échouait avant, `npm run check` et `npm test` verts, commit avec chemins (`git add <chemins> && git commit -m "..." -- <chemins>`), pas de nom d'IA dans le message, pas de push, compte rendu court avec hash après chaque rang. Un constat que tu ne parviens pas à reproduire : ne le « corrige » pas, dis-le.

## OpenCode : rangs 1, 6, 7, 5 (dans cet ordre)

Fichiers à toi : `src/crisis.mjs`, `src/queue.mjs`, `src/claude-activity.mjs`, `src/todos.mjs`, `src/blackboard.mjs`, `src/delegations.mjs`, `src/agent-activity.mjs`, `src/responses.mjs`, `server.mjs`, tests associés.
1. **C-CD-01 et 02** : une levée de crise n'est effective qu'après sa persistance réussie (un échec garde le verrou et permet de réessayer) ; contrôle de la crise après la lecture du corps de `POST /api/prompt` et `/api/broadcast`, et juste avant l'appel à Herdr pour chaque destinataire ; la file revérifie aussi.
6. **C-CD-03** : budget d'écriture de la file égal à celui de la lecture (octets UTF-8), refus clair avant acceptation, alerte de récupération si un ancien fichier dépasse.
7. **C-CD-07** : continuité des octets (taille et début inchangés) avant de reprendre un offset, dans la lecture d'activité Claude et dans `todos`.
5. **Masque public unique** (C-CD-04, 06, 12, 08) : un module commun (`src/masque.mjs`) utilisé par `responses`, `todos`, `blackboard`, `delegations` et les descriptions de sous-agents : chemins Windows et Unix avec espaces, UNC, secrets, jetons ; les adresses `http(s)://` et les routes `/api/...` restent intactes ; rejeter dans les réponses Codex les messages dont le destinataire est un tiers explicite (liste documentée de canaux publics). Les tests existants de masquage restent verts.

## Claude : rangs 2 (partie installeur animé et .bat), 3, 4, 8, 9

(Fichiers : `scripts/installateur-anime.mjs`, `Installer MyTeam.bat`, `src/files.mjs`, `scripts/evaluer.mjs`, `scripts/partager-lecons.mjs`, `public/*`.)

## Codex : petits correctifs seulement (quota bas), dans cet ordre

Fichiers à toi : `scripts/installer.sh`, `scripts/installer.ps1`, `Ouvrir le bureau.ps1`, `scripts/empaqueter-release.mjs`, tests. **C-CD-12** (Bash masque `https://` : borner la règle du lecteur Windows) ; **C-CD-16** (port Bash : longueur et plage validées, message précis, code d'erreur) ; **C-CD-14** (`@(Get-Command ... -CommandType Application)[0]` dans le raccourci, pour Node et Herdr) ; **C-CD-13** (`empaqueter` : révision résolue vers un identifiant de commit vérifié, options refusées, structure du zip contrôlée avant d'annoncer la réussite). Si ton quota est presque épuisé, arrête-toi après le dernier point terminé et dis-le.

## Antigravity : rang 10 (documents, NOTICE, site, captures)

Fichiers à toi : `README*.md`, `docs/*.md` publics, `NOTICE*.md`, `PRODUCT.md`, `docs/exigences.md`, `site/`, `docs/captures/`. Nom du produit en anglais : « MyTeam · Agent desk », en français « MyTeam · Bureau des agents ». À faire : C-AG-01 (dépannage : plus de journaux inexistants, la vraie commande), C-AG-02 (plus de nombre de tests figé : la commande de vérification), C-AG-03 et exigences (la tournée du chef qui porte le dossier), C-AG-08 (matrice honnête des 24 outils : état et fonctions communes pour tous, journaux lisibles seulement pour Claude, Codex et OpenCode), C-AG-10 (`NOTICE.md` cite toutes les marques de `public/logos.js`, aucune affiliation), C-AG-11 (README : modules et fonctions manquants), C-AG-13 (boutons anglais cités avec leurs vrais noms). Pas de `public/i18n*.js` : le vocabulaire de l'interface est fait par le chef après l'accessibilité. Une fois les corrections d'interface faites (le chef te prévient), régénère les captures de `docs/captures/` et de `site/assets/` avec l'état actuel de l'interface (sans enseigne ni nom d'auteur), et vérifie le site.
