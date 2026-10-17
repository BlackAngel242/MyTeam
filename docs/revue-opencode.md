# Revue indépendante OpenCode (QA et revue de code)

Date : 17 octobre 2026. Périmètre : lecture seule de server.mjs, src/*.mjs, test/*.mjs (et consultation ponctuelle de public/app.js pour situer les délais client). Propriétaires du code : Codex pour server.mjs, src/, test/, package.json ; Claude pour public/. Ce document est le seul fichier créé. Aucune consigne n'a été envoyée : /api/prompt et /api/broadcast n'ont jamais été appelés sur le serveur vivant.

## 1. Résultats des tests

### npm test
- 58 tests, **57 réussis, 0 échec, 1 ignoré**, durée totale 15,3 s.
- Test ignoré : « ne suit pas les liens vers un fichier ou dossier » (test/claude-activity.test.mjs:78), motif « Création de liens non autorisée sur ce poste ». La protection anti-liens symboliques de src/claude-activity.mjs:20-28 est donc **validée par la lecture du code, mais pas par l'exécution** sur cette machine.
- Test le plus lent : « ne lit pas les messages au-delà du plafond de 50 Mo » (14,3 s), ce qui explique presque toute la durée de la suite.

### npm run check
- Réussi : node --check sur server.mjs, src/herdr.mjs, src/claude-activity.mjs, public/app.js, public/terminal.js.

### Sondages du serveur vivant (http://127.0.0.1:4317, lecture seule)
| Sondage | Résultat | Attendu | Verdict |
|---|---|---|---|
| GET /api/state | 200, 4 agents réels (Claude, Codex, Antigravity, OpenCode) avec activité Claude (jetons et sous-agents) | 200 sans sessionId | Conforme : **aucune clé sessionId dans la réponse**, seule l'activité calculée sort |
| GET /logos.js | 200, Content-Type: text/javascript, nosniff, no-store, CSP | 200 javascript | Conforme |
| GET /page-inconnue | 404 {"error":"Page introuvable."} | 404 | Conforme |
| Host: evil.example.com | 403 {"error":"Adresse locale requise."} | 403 | Conforme |

Aucun en-tête CORS dans les réponses : une page web étrangère ne peut pas lire le jeton ni les données.

## 2. Bugs par gravité

### Moyenne

**M1. Une erreur de lecture rend l'activité Claude disparue et déclenche une relecture géante à chaque sondage.**
Fichiers : src/claude-activity.mjs:83 (jet « Limite de memoire atteinte »), :93 et :99 (jet « Ligne trop longue »), :162-165 (le « catch » supprime l'état du cache mais garde le chemin dans `paths`), :126-145 (l'appel suivant repart de l'offset 0).
Déclencheurs réels : (a) environ 30 000 messages cumulés, soit 4 Mo de identifiants retenus (MAX_RETAINED_BYTES, :12), atteints sur une session très longue ; (b) une ligne JSON unique de plus de 4 Mo, par exemple une image encodée dans un transcript, cas plausible sur de longues sessions.
Effet : à partir de ce moment, chaque GET /api/state (toutes les 3 s, public/app.js:458) relit et reparse jusqu'à 50 Mo (MAX_BYTES, :8) depuis le début, échoue à nouveau, supprime à nouveau l'état, et renvoie found:false. Activité Claude perdue à l'écran et charge disque et processeur en boucle, indéfiniment.
Propositions : (1) remplacer le Set `counted` par une vraie LRU bornée (par exemple 50 000 identifiants) pour que la limite ne soit jamais atteinte ; (2) en cas d'erreur fatale, mémoriser un état « épuisé » à la taille courante pour ne plus jamais relire, et supprimer aussi l'entrée `paths` ; (3) pour une ligne trop longue, avancer l'offset au-delà de la ligne et continuer au lieu d'abandonner toute la lecture.

**M2. Le cache d'états est limité à 8 fichiers alors que 128 chemins sont mémorisés.**
Fichier : src/claude-activity.mjs:160 (cache de 8) contre :141 (chemins de 128).
Effet : au-delà de 8 sessions Claude suivies, chaque remplacement d'entrée repars de zéro et reparse jusqu'à 50 Mo pour la session remplacée, potentiellement toutes les 3 s. Aujourd'hui DrSmoke a une seule session Claude, donc impact faible tant que le nombre de sessions reste petit.
Proposition : aligner les deux limites (par exemple 32 et 32) ou ne garder que les sessions vues récemment.

### Faible

**F1. L'ouverture via localhost est refusée.** server.mjs:35 exige Host exactement `127.0.0.1:port`. Un utilisateur qui tape http://localhost:4317 obtient 403 « Adresse locale requise » alors que c'est la même machine. Proposition : accepter `localhost:port` ou afficher un message qui renvoie explicitement vers 127.0.0.1.

**F2. « truncated:true » est toujours vrai.** src/herdr.mjs:56 renvoie ce champ même quand le texte tient en entier. Cela contredit le principe « aucun faux » de PRODUCT.md:29. Proposition : retirer le champ ou calculer la troncature réelle.

**F3. Toutes les erreurs du serveur sortent en 400.** server.mjs:77 renvoie 400 avec le message brut, y compris pour une panne Herdr (qui devrait être un 5xx). Un client ne peut pas distinguer une faute de saisie d'une panne. Proposition : codes 502/500 pour les dépendances, 400 pour la saisie.

**F4. La consigne est passée sans séparateur « -- ».** src/herdr.mjs:65 : une consigne commençant par `--` pourrait être interprétée comme une option par la CLI Herdr, au lieu d'un texte. Le test test/herdr.test.mjs:31-39 couvre les guillemets et les retours ligne, mais pas un message « --flag ». À vérifier sur Herdr 0.9.5, ou ajouter `--` avant le message si la CLI l'accepte.

**F5. Réponse 413 envoyée pendant que le corps arrive encore.** server.mjs:28-32 : au-delà de 60 000 octets, la réponse part puis le flux de requête est détruit ; selon le client, la connexion peut être coupée avant lecture du 413. Le test test/server.test.mjs:77 n'utilise qu'un petit corps (62 000 octets). Proposition : vider ou ignorer le reste du corps avant de répondre.

**F6. Message d'erreur trompeur sur le volume de sortie.** src/herdr.mjs:32-36 : au-delà de 2 Mo de sortie (maxBuffer), le code `killed` déclenche le message « Herdr met trop de temps à répondre » alors que c'est le volume qui dépasse. Proposition : distinguer les deux cas.

**F7. /api/read n'exige ni jeton ni origine exacte.** server.mjs:57 contre :58-59 pour /api/prompt. C'est conforme au HANDOFF.md:9 et sans gravité (lecture seule, même machine, pas d'en-tête CORS), mais l'inégalité est à assumer en connaissance de cause.

**F8. La liste des agents n'est pas dédupliquée entre requêtes simultanées.** server.mjs:43 lance `herdr agent list` à chaque appel, sans garde équivalente à celle de src/claude-activity.mjs:172. Si Herdr ralentit (jusqu'à 12 s, src/herdr.mjs:32), les sondages de 3 s s'empilent et multiplient les processus herdr.exe. Proposition : partager la promesse de liste en cours, comme le fait `inflight`.

**F9. L'envoi groupe est séquentiel et sans progression.** src/herdr.mjs:70-84 : jusqu'à 2 appels Herdr par agent (liste puis envoi), soit 24 appels pour 12 agents, sans résultat intermédiaire. Côté client, le délai est limité à 120 s pour un broadcast (public/app.js:16) alors que le serveur peut dépasser. Proposition : une liste unique pour le groupe revalidée agent par agent, ou réponse progressive.

### Hors périmètre, à transmettre à Claude (public/)

**X1. Délais client et serveur désalignés.** public/app.js:16 limite /api/read à 15 s, alors que le serveur peut cumuler 12 s de liste et 12 s de lecture (src/herdr.mjs:32). La lecture peut donc être abandonnée côté client pendant que le serveur travaille encore, et le rappel de 3 s (public/app.js:458) peut en empiler d'autres. Un verrou anti-chevauchement ou des délais alignés régleraient le point.

### Informations (limites acceptées, pas des défauts)

- GET /api/state rend le jeton à toute requête locale (server.mjs:53) : choix documenté (HANDOFF.md:9). Sans en-tête CORS, une page web ne peut pas le lire ; un processus local le pourrait, mais il a déjà la main sur la machine. Modèle de confiance « même poste », à assumer.
- src/herdr.mjs:36 prévient honnêtement « Un envoi peut avoir été reçu » en cas d'échec : bien vu, à conserver.

## 3. Points demandés, vérifiés sans anomalie

- **Fuite de sessionId** : aucune. Vérifié en direct sur /api/state (4 agents, Claude avec activité) et par le test dédié test/server.test.mjs:146-176 qui refuse toute occurrence de la session ou du chemin privé dans la réponse.
- **Double envoi** : la garde `inflight` (src/herdr.mjs:60-68) est ajoutée de façon synchrone, avant tout await, donc sans fenêtre de course ; testé par test/herdr.test.mjs:41-52 ; l'envoi groupe passe par la même garde (src/herdr.mjs:79). Aucun double envoi automatique trouvé. Seul cas résiduel : un renvoi manuel après une réponse perdue (fonctionnement « au moins une fois »), déjà signalé par le message d'erreur.
- **Sécurité locale** : Host exact (server.mjs:35), origine exacte (:36), sec-fetch-site (:37), jeton aléatoire de 32 octets comparé en temps constant (:11, :19-21), CSP et nosniff et no-store (:15-16), liste blanche de fichiers sans traversal possible (:70-74), identifiant de session validé par motif strict (src/claude-activity.mjs:169), refus des liens symboliques (:20-28), Herdr appelé par execFile sans shell (src/herdr.mjs:1-2, :32). Rien à signaler.
- **Performance de la lecture des transcripts** : conception incrémentale saine (offset conservé, octets ajoutés seulement, cache partagé entre lectures simultanées, tests test/claude-activity.test.mjs:151-176). Coût normal par sondage : quelques vérifications de fichier plus les octets réellement ajoutés. Les vrais risques sont M1, M2 et F8 ci-dessus.

## 4. Couverture des tests et manques

Les 58 tests couvrent bien les comportements critiques (jeton, origine, taille, UTF-8 coupé, empreinte d'identité, refus des agents occupés, absence de double envoi, non-divulgation des sessions). Manques mineurs : aucun test de l'ouverture via `localhost`, aucun test HEAD, aucun corps très volumineux (plus d'1 Mo) pour le 413, aucun test de la limite des 12 000 caractères via /api/prompt côté serveur (couvert pour le groupe dans test/herdr.test.mjs:89-99), et le test anti-liens symboliques ignoré sur ce poste.

## 5. Ordre de correction conseillé

1. M1 (boucle de relecture et perte d'activité), 2. M2 (taille du cache), 3. F8 (liste non dédupliquée), 4. F3 (codes d'erreur), 5. F1 (localhost), puis le reste à la convenance. X1 est à transmettre à Claude pour public/.
