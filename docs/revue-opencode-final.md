# Revue QA finale d'OpenCode (18 octobre 2026)

Lecture seule des commits du 18 octobre (de `298c49f` à `f19931b`), sur la branche `main` du dossier principal : `src/responses.mjs`, les routes `/api/reponses`, `/api/discussion`, `/api/traitement`, les fichiers joints de `src/queue.mjs` et leur copie côté serveur, `public/response-card.js`, `public/discussion.js`, et les installeurs. Aucun code modifié ; ce rapport est le seul fichier écrit. Reproductions faites en mémoire sur les fonctions réelles, sans secret réel ni chemin personnel affiché ici. Trois défauts, puis les points vérifiés sains.

## D1. Moyenne : le masquage des réponses laisse passer des chemins, des clés et des empreintes

**Fichier :** `src/responses.mjs:29-38` (fonction `mask`).

**Scénario reproduit :** appel en mémoire de `mask` avec une ligne de réponse contenant `/workspace/projet/a.mjs`, `/data/x`, `/srv/y`, une clé Google `AIzaSyD-…`, un jeton GitHub `github_pat_11…`, un identifiant d'agent `w5:p1@d234f56741fc0479` et un digest SHA-256. Sortie obtenue : les trois chemins, les deux clés, l'identifiant et le digest passent entiers ; seuls `/etc/z`, `sk-ant-…`, `C:\Users\…`, `~/.ssh/…` et `/home/…` sont masqués. Cause : la liste des racines Unix de la ligne 37 est fermée (`home|Users|root|etc|usr|var|tmp|mnt|opt|proc`) et ne couvre ni `/workspace`, ni `/data`, ni `/srv` ; les motifs de secrets de la ligne 32 ne couvrent pas `AIza…` ni `github_pat_…` ; et la ligne 35 ne masque ni les empreintes d'agent (`…@` suivi de hexadécimaux) ni les digests longs.

**Impact :** ces valeurs apparaissent dans les réponses publiques (`/api/reponses`, extraits de `/api/discussion`), exactement le genre de fuite que la revue de Codex signalait déjà sur le tableau mural (constat D1 de `docs/revue-opencode-tableau.md`, même famille de correctifs).

**Correctif proposé :** masquer tout chemin absolu commençant par `/` (ou compléter les racines avec `workspace|data|srv`), ajouter les motifs `AIza[0-9A-Za-z_-]{35}` et `github_pat_[A-Za-z0-9_]{20,}`, et masquer les empreintes de forme `@[0-9a-f]{8,}` et les digests `[0-9a-f]{32,}`.

## D2. Moyenne : les lectures de journaux sont refaites à chaque sondage, sans cache

**Fichiers :** `src/responses.mjs:69-81` (`tail` relit jusqu'à 8 Mo), `server.mjs:344-382` (les trois routes), `public/app.js:1623` (sondage toutes les 5 s).

**Scénario reproduit par lecture :** l'onglet Équipe ouvert, `loadDiscussion` interroge `/api/discussion` toutes les 5 secondes ; la route agrège les réponses de TOUS les agents lisibles, et chacune relit la fin de son journal (jusqu'à 8 Mo lus et analysés). `loadTreatments` ajoute une requête `/api/traitement` par agent, qui relit à nouveau les mêmes journaux pour croiser les faits. Avec quatre agents, ce sont jusqu'à huit lectures de journaux par cycle de 5 secondes, sans aucun cache de contenu (seul le chemin du fichier est mémorisé).

**Impact :** disque et processeur mobilisés en continu pour relire des données inchangées ; la réactivité de l'onglet Équipe peut baisser sur les grandes sessions, en particulier avec les fichiers joints.

**Correctif proposé :** cache de courte durée (2 à 5 s) fondé sur la taille et la date du journal, ou un seul lecteur partagé entre `/api/discussion` et `/api/traitement`, ou un ralentissement du fil de discussion à 15 ou 30 s.

## D3. Faible : une copie déjà faite reste dans le dossier de l'agent si l'envoi échoue

**Fichiers :** `src/queue.mjs:404-434` (séquence de copie puis d'envoi), `server.mjs:119-139` (`prepareQueuedFiles`).

**Scénario reproduit par lecture :** l'état durable « envoi en cours » est bien écrit avant la copie (aucun double envoi possible), mais la copie des fichiers joints est effectuée dans le dossier réel de l'agent AVANT l'appel à Herdr. Si l'envoi échoue ensuite, la consigne passe « à revoir » et le fichier copié reste sur le disque ; une nouvelle consigne de DrSmoke copie à nouveau (la copie ne remplace jamais, elle renomme), ce qui accumule des doublons dans le dossier de l'agent.

**Impact :** aucun écrasement ni double envoi, mais de l'encombrement et une confusion possible pour l'agent, qui voit deux exemplaires du même fichier.

**Correctif proposé :** soit signaler dans la consigne « à revoir » qu'une copie est déjà présente (nom et heure), soit, lors d'une nouvelle tentative, réutiliser la copie déjà faite si elle existe et porte l'empreinte de destination, au lieu d'en créer une seconde.

## Points vérifiés sans anomalie

- **Garde jeton et origine :** les trois nouvelles routes (`/api/reponses`, `/api/traitement`, `/api/discussion`) exigent `guard(req,{body:false})` comme les lectures existantes ; aucun contournement trouvé.
- **Fichiers joints :** racines fermées (`bureau|documents|telechargements|agent:…`), chemin relatif exigé, `..` et liens symboliques refusés, 20 Mo vérifiés avant ET après la copie, `transfer` en copie sans jamais écraser, cible revérifiée après la copie (statut, dossier, empreinte de session) avant l'envoi, et la consigne enrichie reste sous 12 000 caractères.
- **Double envoi :** l'état durable « envoi en cours » est persisté avant toute action externe, y compris avant la copie ; une reprise après crash ne renvoie jamais, et un envoi non confirmé reste « à revoir ».
- **Credential et messages chiffrés :** `readOpenCodeTexts` (src/agent-activity.mjs:325-348) ne lit que des colonnes extraites de `message` et `part`, en lecture seule, jamais la table `credential` ni `SELECT *` ; les messages inter-agents chiffrés de Codex (`agent_message`, `encrypted_content`) sont ignorés par le lecteur de réponses (exigence de `payload.type === 'message'` et de blocs `output_text`).
- **Fuites de sortie :** les clés publiques des réponses sont des empreintes opaques (sha256 tronqué), `/api/traitement` ne sort que des noms de fichiers validés (jamais de chemin, ni de l'empreinte de dossier interne), et `copiedFiles` est réduit au seul nom dans la vue publique de la file.
- **Accessibilité :** `public/response-card.js` et `public/discussion.js` n'utilisent jamais `innerHTML`, les boutons ont texte et `aria-label`, la boîte de copie de repli est annoncée (`aria-modal`, titre lié, retour du focus à la fermeture) et son gestionnaire clavier ne traite qu'Échap, sans jamais détourner Ctrl+A. Aucune régression trouvée.
- **Installeurs :** le durcissement du 18 octobre est correct : les valeurs deviennent des données (guillemets shell et échappements de fichier bureau), les refus de nouvelles lignes, et Herdr comme chaque extension exigent leur propre « o/n » même en mode -Oui / --oui.
- **Suite :** `npm run check` vert (14 fichiers, dont `src/responses.mjs`) ; `npm test` : 242 tests, 239 réussis, 3 ignorés (liens symboliques interdits sur ce poste).

## Limites de cette revue

- Les défauts D1 a été reproduit en mémoire sur la fonction réelle ; D2 et D3 sont des lectures de code et des scénarios, non mesurés sur le serveur vivant (aucune requête envoyée, aucune interface cliquée).
- Les composants publics ont été lus mais pas vérifiés à l'écran ; la vérification visuelle (ordinateur et téléphone) reste à faire avec Playwright et des états simulés, comme le veut la définition de « terminé ».
- Les formats des journaux de Claude, Codex et OpenCode supposent les versions actuelles des outils ; un changement de version peut invalider les lecteurs.
