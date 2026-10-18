# Missions du 18 octobre 2026

Règles communes : lire `AGENTS.md` et `LESSONS.md` en entier avant de commencer. Travailler dans `C:\Users\DrSmoke\Documents\ChatGPT\IA DESKTOP`, branche `main`. Commiter seulement tes propres fichiers (`git add <chemins>`, jamais `git add -A`), aucun `git push`. Ne répondre à aucune boîte de dialogue à la place de DrSmoke. Terminer par un compte rendu court : hash du commit, `npm run check` et `npm test` (nombre de tests), ce qui n'a pas pu être vérifié, nouvelles leçons ajoutées à `LESSONS.md`. Le chef évalue ensuite, corrige si besoin et te transmet ses corrections : les relire fait partie de la mission. Le plan complet est dans `docs/plan-travail.md`.

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

Tu travailles dans un worktree : lis et teste uniquement dans `C:/Users/DrSmoke/Documents/ChatGPT/IA DESKTOP` (branche `main`), ne modifie rien d'autre que ton rapport `docs/revue-opencode-final.md`. Relis `AGENTS.md` et `LESSONS.md` d'abord. Passe en revue les commits du 18 octobre (`git log --since=2026-10-18`) : `src/responses.mjs`, `/api/reponses`, `/api/discussion`, `/api/traitement`, fichiers joints dans `src/queue.mjs`, `public/response-card.js`, `public/discussion.js`, installeurs. Cherche : fuite de chemin, identifiant ou secret dans une réponse publique, contournement de garde (jeton, origine), double envoi, écrasement de fichier, lecture de `credential` ou de messages chiffrés, régression d'accessibilité. Rapport court : défauts numérotés (gravité, fichier:ligne, scénario, correctif proposé). Ne commite que ce rapport (`git add docs/revue-opencode-final.md`), pas de push.
