# Revue QA finale d'OpenCode (18 octobre 2026)

Deuxième passe, demandée par le chef après la publication du dépôt public sur GitHub (BlackAngel242/MyTeam) : priorité à ce qui ne devrait pas être public (secrets, jetons, clés, chemins personnels, journaux), puis sécurité des routes ajoutées le 18 octobre. Lecture seule de la branche `main` du dossier principal ; ce rapport est le seul fichier écrit. La première passe (commit 229ab9f, défauts D1 à D3) a été revérifiée indépendamment sur le code : ses trois défauts sont confirmés et repris ici (numérotés 3 à 5).

Méthode : lecture du code ligne à ligne des zones livrées le 18 octobre, scan de l'arbre ET de l'historique git (`git grep` par révision, `git log -S` sur les motifs de secrets), inspection de deux captures publiques, puis lancement de `npm run check` et `npm test`.

Constat général : aucun secret ni jeton réel n'a été trouvé, ni dans l'arbre, ni dans l'historique (motifs testés : `ghp_`, `gho_`, `github_pat_`, `sk-`, `sk-ant`, `AIza`, `xox`, `Bearer`, clés privées, `.env`). Les seules occurrences sont des exemples de tests et le texte de ce rapport. Le numéro WhatsApp de `README.md:189` et `public/index.html:154` est la signature voulue de DrSmoke : rien à retirer.

## Défauts

### 1. Haute (pour un dépôt public) : un chemin personnel est encore publié

**Fichier :** `test/delegations.test.mjs:285`.

**Scénario :** la chaîne `C:\Users\DrSmoke\secret.txt` sert d'exemple de consigne piégée dans un test. Depuis la publication, tout visiteur du dépôt y lit le nom d'utilisateur Windows et l'arborescence personnelle (`Documents\ChatGPT\IA DESKTOP`). Le commit 2d4c145 (« chemins personnels retirés ») a raté ce cas, seul résidu de ce type dans l'arbre actuel.

**Correctif :** remplacer par un chemin factice comme dans les autres tests (`C:/projet-factice/...`), par exemple `C:\projet-factice\secret.txt`. Hors périmètre de cette revue (lecture seule) : à commiter par le chef ou le propriétaire du test.

### 2. Moyenne : l'historique public garde aussi des chemins personnels

**Fichiers (dans les anciennes révisions) :** `docs/mission-claude.md:7` et `docs/publication-github.md:12` (présents dès 7817574), `docs/missions-18-octobre.md:3` (298c49f).

**Scénario :** un clone suivi de `git log -S` retrouve `C:/Users/DrSmoke/Documents/ChatGPT/IA DESKTOP` dans l'historique, même si l'arbre actuel est propre. `docs/publication-github.md` signalait déjà ce choix à trancher ; il ne l'a pas été.

**Correctif :** décision de DrSmoke, deux options : réécrire l'historique (filter-repo puis force push, action irréversible, jamais faite sans son accord explicite), ou accepter et le noter dans `docs/publication-github.md`. Un simple commit supplémentaire ne retire rien de l'historique.

### 3. Moyenne : le masquage des réponses laisse passer des chemins, des clés et des empreintes

**Fichier :** `src/responses.mjs:29-38` (fonction `mask`).

**Scénario reproduit :** appel en mémoire de `mask` avec `/workspace/projet/a.mjs`, `/data/x`, `/srv/y`, une clé Google `AIza…`, un jeton GitHub `github_pat_…`, un identifiant d'agent `w5:p1@d234f56741fc0479` et un digest SHA-256 : tout passe entier. Seuls `/etc/z`, `sk-ant-…`, `C:\Users\…`, `~/.ssh/…` et `/home/…` sont masqués. Causes : la liste des racines Unix de la ligne 37 est fermée (`home|Users|root|etc|usr|var|tmp|mnt|opt|proc`) et oublie `workspace`, `data`, `srv` ; les motifs de secrets de la ligne 32 ignorent `AIza…` et `github_pat_…` ; les empreintes (`@` suivi d'hexadécimaux) et digests longs ne sont couverts par aucun motif.

**Impact :** ces valeurs sortent dans `/api/reponses` et les extraits de `/api/discussion`, même famille de fuite que le constat D1 de `docs/revue-opencode-tableau.md` sur le tableau mural.

**Correctif :** ajouter `workspace|data|srv` aux racines (ou masquer tout chemin absolu commençant par `/`), ajouter `AIza[0-9A-Za-z_-]{35}` et `github_pat_[A-Za-z0-9_]{20,}`, masquer `@[0-9a-f]{8,}` et `[0-9a-f]{32,}`.

### 4. Moyenne : les lectures de journaux sont refaites à chaque sondage, sans cache

**Fichiers :** `src/responses.mjs:69-81` (`tail` relit jusqu'à 8 Mo), `server.mjs:344-382` (les trois routes), `public/app.js` (sondage toutes les 5 s).

**Scénario :** l'onglet Équipe ouvert interroge `/api/discussion` toutes les 5 secondes ; la route agrège les réponses de tous les agents lisibles et relit la fin de chaque journal. `/api/traitement` relit les mêmes journaux pour croiser les faits. Avec quatre agents : jusqu'à huit lectures de journaux par cycle, sans cache de contenu (seul le chemin du fichier est mémorisé).

**Impact :** disque et processeur mobilisés pour des données inchangées ; réactivité de l'onglet Équipe qui peut baisser sur les grandes sessions.

**Correctif :** cache de 2 à 5 s fondé sur la taille et la date du journal, ou lecteur partagé entre `/api/discussion` et `/api/traitement`, ou ralentissement du fil à 15 ou 30 s.

### 5. Faible : une copie déjà faite reste dans le dossier de l'agent si l'envoi échoue

**Fichiers :** `src/queue.mjs:404-434`, `server.mjs:119-139`.

**Scénario :** la copie des fichiers joints a lieu dans le dossier réel de l'agent avant l'appel à Herdr. Si l'envoi échoue ensuite, la consigne passe « à revoir » mais le fichier copié reste sur le disque ; une nouvelle tentative copie à nouveau (jamais d'écrasement, le nom reçoit un suffixe), ce qui accumule les doublons.

**Impact :** aucun écrasement ni double envoi, mais encombrement et confusion possible pour l'agent.

**Correctif :** signaler la copie déjà présente dans le motif de « à revoir », ou réutiliser la copie portant l'empreinte de destination au lieu d'en créer une seconde.

### 6. Faible : `/api/state` et `/api/read` n'exigent pas le jeton

**Fichiers :** `server.mjs:298` (`/api/state`), `server.mjs:383` (`/api/read`).

**Scénario :** les trois routes du 18 octobre exigent bien `guard(req,{body:false})`, mais ces deux routes anciennes non. `/api/state` distribue même le jeton à toute requête locale : c'est volontaire pour le démarrage du navigateur. `/api/read` livre les 120 dernières lignes du terminal d'un agent au seul contrôle d'origine (`server.mjs:238-240`). Un processus local, ou un client sans `Sec-Fetch-Site`, lit donc les terminaux sans connaître le jeton.

**Correctif :** ajouter `guard(req,{body:false})` à `/api/read` ; pour `/api/state`, documenter que la distribution du jeton est volontaire (ou la limiter à la première charge de la page).

### 7. Faible : `.gitignore` ne protège pas le cache Impeccable

**Fichiers :** `.gitignore`, `.git/info/exclude:9`.

**Scénario :** `.impeccable/hook.cache.json` contient des chemins absolus personnels (`C:/Users/DrSmoke/...`). Il n'est ignoré que par `.git/info/exclude`, fichier local absent des clones. Sur un autre poste, `git add -A` le publierait avec ses chemins. `.impeccable/config.json`, lui, est suivi et propre.

**Correctif :** ajouter `.impeccable/hook.cache.json` à `.gitignore` (en gardant `config.json` suivi).

### 8. Faible : `installer.sh` accepte n'importe quel exécutable pour `--herdr-chemin`

**Fichiers :** `scripts/installer.sh:213` (seul le test `-x`), contre `scripts/installer.ps1:152-158` (`Resoudre-Herdr` exige un fichier `.exe` existant, résolu en littéral).

**Scénario :** un fichier piégé non nommé `herdr` serait accepté comme chemin de Herdr puis enregistré dans le profil (ligne 455, correctement échappé, mais exécuté plus tard comme Herdr). Le test B4 (`test/installers-securite.test.mjs:171`) ne couvre que le côté PowerShell.

**Correctif :** même règle que le ps1 côté sh : nom littéral `herdr` ou `herdr.exe`, refus des `.ps1` et des jokers ; ajouter le test sh correspondant.

## À confirmer avec DrSmoke (pas un défaut technique)

- `JOURNAL.md`, `ERREURS.md`, `HANDOFF.md`, `LESSONS.md` sont suivis par git et donc publics : ils racontent l'organisation interne, les quotas et les décisions. Utiles pour la reprise par une autre IA, mais c'est un choix de publication à confirmer. `ERREURS.md` relu : rien de sensible, seulement des faits techniques.
- `.github/workflows/ci.yml` existe mais n'est pas suivi : absent de GitHub pour l'instant. Contenu vérifié, aucun secret ni chemin personnel. À commiter si l'intégration continue est voulue.
- Deux captures sur dix inspectées (`docs/captures/02-ordinateur-poste.png`, `03-ordinateur-equipe.png`) : aucun chemin personnel ni secret visible, seulement les noms d'agents et la signature voulue.

## Points sains vérifiés

- **Gardes des routes du 18 octobre :** `/api/reponses` (`server.mjs:345`), `/api/traitement` (`:355`), `/api/discussion` (`:365`) exigent `guard(req,{body:false})`, identique à `/api/todos` : jeton comparé à temps constant (`:205-207`), origine exacte ou `Sec-Fetch-Site: same-origin` (`:212-218`), refus uniformes. Aucun contournement trouvé.
- **Fichiers joints :** racines fermées (`bureau|documents|telechargements|agent:…`), chemin relatif exigé, `..`, absolus et liens symboliques refusés (`server.mjs:106-117`, `src/files.mjs:23-31`), 20 Mo vérifiés avant et après la copie (`server.mjs:129,133`), copie sans écrasement (`COPYFILE_EXCL`, `src/files.mjs:88`, suffixe « (2) »), nom de copie validé comme nom de fichier seul (`src/queue.mjs:47-48`), nom cité dans la consigne entre guillemets JSON (`src/queue.mjs:412`).
- **Double envoi :** clé de demande idempotente et refus des doublons (`src/queue.mjs:251-266`), état « envoi en cours » persisté avant toute action externe (`:392-397`), un envoi non confirmé reste « à revoir » (`:428-433`).
- **Credential et messages chiffrés :** lecture OpenCode en projection étroite, jamais la table `credential`, jamais `SELECT *` (`src/agent-activity.mjs:325-343`) ; les messages inter-agents de Codex sont ignorés (seuls les blocs `output_text` sortent, `src/responses.mjs:154-176`).
- **Rattachement ambigu :** deux agents du même outil dans le même dossier, ou deux journaux aussi récents, donnent aucun rattachement (`src/agent-activity.mjs:274-277,299,306`).
- **Fuites de sortie :** clés publiques opaques (sha256 tronqué), `/api/traitement` ne sort que des noms de fichiers validés (`server.mjs:157-193`), `copiedFiles` réduit au nom seul dans la vue publique (`src/queue.mjs:167`).
- **Interfaces :** aucun `innerHTML` dans `public/response-card.js` ni `public/discussion.js` ; liens limités à http/https (`response-card.js:83-94`), images distantes affichées en texte, repli presse-papiers avec dialogue annoncé (`role=dialog`, `aria-modal`, retour du focus). `public/discussion.js` est une liste sans bouton : rien à corriger, aucun attribut ARIA non plus (acceptable pour du texte seul).
- **Entêtes de sécurité :** CSP stricte, `nosniff`, `no-referrer` sur toutes les réponses (`server.mjs:201-202`).
- **Installeurs :** o/n individuel pour chaque installation même avec `--oui` / `-Oui` (`installer.sh:56,244`, `installer.ps1:76-84,124,191,336`), valeurs du disque traitées comme données (`literal_shell`, `argument_desktop`), tests dédiés au dossier piégé et au faux Herdr présents et verts.

## Jeux de tests et limites

- `npm run check` : vert (14 fichiers). `npm test` : 242 tests, 239 réussis, 0 échec, 3 ignorés (liens symboliques interdits sur ce poste), lancés ici après la revue.
- Les défauts 3, 4 et 5 sont des lectures de code et des scénarios, non mesurés sur serveur vivant ; aucune requête envoyée, aucune interface cliquée (règle de la mission).
- Deux captures sur dix seulement ont été inspectées ; les autres pourraient contenir un détail non repéré.
- Les formats de journaux de Claude, Codex et OpenCode supposent les versions actuelles des outils ; un changement de version peut invalider les lecteurs.
- Correctifs des défauts 1 à 8 : proposés seulement, aucun fichier autre que ce rapport n'a été modifié. Nouvelles leçons suggérées (non écrites dans `LESSONS.md`, lecture seule) : « un nettoyage de chemins personnels doit se vérifier par `git grep` sur l'arbre ET `git log -S` sur l'historique », et « un fichier exclu par `.git/info/exclude` n'est protégé que sur ce poste : la protection durable est `.gitignore` ».
