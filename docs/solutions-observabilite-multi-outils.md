# Solutions : observabilité multi-outils et direction

21 octobre 2026. Proposition de DrSmoke, formalisée à la demande de SmokeSama sur la branche `Muse`. Statut : proposition, rien n'est décidé pour `main`. Origine : le test réel OpenCode du 20 octobre 2026 et les exigences de conception posées par SmokeSama à sa suite.

## 1. Contexte et fait générateur

Le 20 octobre 2026, un test réel de délégation a été mené sur MyTeam 0.5.0 avec deux panneaux OpenCode dans le même projet : un chef sur le modèle `mimo-v2.6-pro` (Xiaomi MiMo) et un exécutant sur `deepseek-v4-pro` (DeepSeek), chacun avec sa clé API directe de fournisseur. La délégation de bout en bout a réussi : consigne envoyée depuis le bureau au chef, délégation du chef vers l'exécutant par Herdr, fichier de preuve créé par l'exécutant et vérifié sur disque, compte rendu du chef. Le constat complet figure dans le rapport « Rapport du test réel OpenCode, 20 octobre 2026 » (document de travail de DrSmoke, hors dépôt).

Le défaut découvert pendant ce test : quand deux agents OpenCode partagent le même projet, le bureau ne voit rien de leur travail. Ni activité, ni délégations, ni discussion, alors que les sessions existent réellement dans la base d'OpenCode et que le travail a bien eu lieu. Défaut secondaire relevé au même moment (O-6) : le premier `/api/read` d'un panneau OpenCode neuf peut revenir vide.

Ce défaut compte parce que le scénario du test est un scénario d'usage normal, pas un cas limite. Un utilisateur peut refuser Claude ou Codex, ou les avoir en pause, et travailler avec OpenCode seul, alimenté par les clés API de plusieurs fournisseurs, réparti sur plusieurs panneaux avec un modèle différent par panneau. MyTeam doit superviser cette équipe là aussi bien qu'une équipe Claude.

## 2. Exigences posées par SmokeSama

- Le premier outil lancé est le directeur par défaut, quel que soit l'outil. Jamais un outil précis désigné directeur par construction.
- Plusieurs panneaux du même outil, avec des modèles différents par panneau, forment un cas normal à supporter. L'identité d'un agent est son panneau et son modèle, pas son outil et son dossier.
- Poignée de main hiérarchique : dès qu'un nouvel agent apparaît, le directeur se présente, lui assigne son rôle et sa mission ; l'exécutant accuse réception (soumission) ; la hiérarchie devient visible et communicante dans le bureau.

## 3. Diagnostic

Causes re-vérifiées le 21 octobre 2026 sur la base courante (`main` à `bed3375`, postérieure à la 0.5.0) : les trois causes relevées sur la 0.5.0 sont toujours présentes à l'identique.

### Cause 1 : identifiant de session réservé à Claude

`src/herdr.mjs`, fonction `normalizeAgent` (ligne 44) : le `sessionId` n'est ajouté que si l'outil est Claude (`a.agent === 'claude'`). Le repli qui retrouve une session Claude sans intégration Herdr (`sessionsDir` sur `~/.claude/sessions`, ligne 126) est lui aussi réservé à Claude. Un agent OpenCode, Codex ou autre arrive donc dans le bureau sans identifiant de session, et tout ce qui dépend d'une session lui est fermé.

### Cause 2 : délégations lues dans le seul journal Claude

`src/delegations.mjs` : l'en-tête du module annonce « Délégations observées dans le journal Claude du chef », et `readDelegations` (ligne 368) ne lit que sous `~/.claude/projects`, avec un identifiant validé au format des sessions Claude. Dans `server.mjs` (ligne 414), les délégations du chef ne sont lues que si `agent === chef && agent.kind === 'Claude' && sessionId`. Un chef OpenCode a donc zéro délégation affichée par construction, et pas de tournée. Les réponses et la discussion passent par le même partage : Claude par son `sessionId`, les autres outils par le lecteur générique soumis à la cause 3 (`reponsesDe`, `server.mjs` ligne 132).

### Cause 3 : attribution refusée dès que deux agents du même outil partagent un dossier

`src/agent-activity.mjs` (ligne 309) : le lecteur d'activité générique retourne `null` si le nombre d'agents du même outil dans le même dossier de travail n'est pas exactement 1. Les lecteurs existent pourtant pour Codex (`~/.codex/sessions`) et OpenCode (`~/.local/share/opencode`, sa base de sessions) : c'est l'attribution par couple (outil, dossier) qui rend le bureau aveugle dès le deuxième panneau, au lieu d'attribuer par session et par panneau.

### Ce qui est déjà sain

La règle du chef n'est pas en cause : `bossOf` (`src/delegations.mjs`, ligne 384) choisit le plus petit panneau, sans regarder l'outil, et son commentaire documente honnêtement l'approximation (Herdr ne fournit pas l'heure de démarrage des panneaux ; le plus petit panneau correspond en pratique au premier créé). `src/direction.mjs` gère déjà le choix manuel de l'utilisateur, persistant et prioritaire sur la règle, avec passation toujours proposée puis confirmée par l'utilisateur. Le centrage sur Claude est donc localisé : session, délégations, attribution. C'est là que portent les solutions.

## 4. Solutions

### Couche 1 : identité par panneau

Principe : chaque panneau reçoit l'identité complète (outil, modèle, session), et l'activité est attribuée par session, jamais par couple (outil, dossier).

- Pour chaque agent, résoudre sa session dans la base ou les journaux de son outil à partir de trois signaux croisés : le dossier de travail, le modèle de la session (la base d'OpenCode le connaît, il a été vérifié pendant le test), et les horodatages (création et mise à jour de la session).
- Le bureau connaît la première apparition de chaque panneau par son sondage de la liste Herdr : une session créée juste après l'apparition d'un panneau, dans son dossier et avec son modèle, est la sienne.
- Le modèle de lancement se lit dans les arguments du processus au premier plan du panneau, sur le modèle du repli existant pour les sessions Claude (`src/herdr.mjs`) : c'est ce qui départage deux panneaux du même outil dans le même dossier quand leurs modèles diffèrent, c'est à dire le cas normal visé par les exigences.
- La garde d'unicité de `src/agent-activity.mjs` est remplacée par cette attribution par panneau, pour l'activité, les réponses et la discussion.
- En cas d'ambiguïté réelle (deux panneaux, même outil, même dossier, même modèle, sessions indiscernables), le bureau affiche « attribution incertaine » pour le panneau concerné plutôt que rien : la vérité des faits interdit d'attribuer au hasard, elle n'oblige pas au silence.

Critères d'acceptation :

- Deux panneaux OpenCode dans le même projet, modèles différents : activité, réponses et discussion visibles pour chacun, attribuées au bon panneau, vérifiées contre la base d'OpenCode.
- Quatre panneaux OpenCode, quatre modèles : même résultat, sans dégradation.
- Deux panneaux strictement identiques (outil, dossier, modèle) : mention « attribution incertaine » affichée, aucune activité attribuée au mauvais panneau.
- Aucun changement de comportement pour un panneau unique d'un outil, ni pour Claude et Codex.

### Couche 2 : délégations natives du bureau

Principe : le bureau cesse de deviner les délégations dans les journaux des outils. Il tient son propre journal, valable pour tous les outils, et les journaux d'outils deviennent un enrichissement.

- Journal d'événements de délégation tenu par le serveur, écrit dans `.myteam-local/` du projet, donc privé et ignoré par Git, au même titre que le kit local.
- Annonce de rôle : à l'apparition d'un nouvel agent dans le projet, le bureau envoie au nouvel agent un message de rôle structuré (qui est le directeur, son propre rôle, le canal de délégation), au nom du directeur effectif. La hiérarchie devient visible dans le bureau dès l'enregistrement de l'annonce.
- Canal de délégation traçable : le kit fournit un petit script de délégation que le directeur appelle. Le script écrit d'abord l'événement dans le journal du bureau, puis transmet la mission à l'exécutant par Herdr (`herdr agent prompt`). Une délégation faite hors de ce canal reste possible, elle n'est simplement pas journalisée : le bureau le dit.
- Soumission : l'accusé de réception de l'exécutant (réponse d'acceptation lue dans son panneau ou sa session) est écrit comme événement lié à la délégation. La mission, son exécutant et sa soumission forment une chaîne lisible dans le bureau.

Schéma d'événement proposé (champs minimaux) :

- `id` : identifiant unique de l'événement.
- `at` : horodatage ISO.
- `type` : `annonce-role`, `delegation`, `soumission`, `compte-rendu`.
- `projet` : empreinte du projet actif.
- `de` : identifiant complet de l'agent émetteur (panneau et empreinte).
- `vers` : identifiant complet de l'agent destinataire.
- `modele` : modèle de l'agent concerné, quand il est connu.
- `titre` : résumé court de la mission (plafonné, comme les délégations actuelles).
- `lien` : identifiant de la délégation parente, pour les soumissions et comptes rendus.

Lecture : `/api/delegations` (à créer ou à faire évoluer) et la discussion lisent ce journal en priorité ; les délégations inférées des journaux d'outils (Claude aujourd'hui) s'y ajoutent marquées comme observées, sans doublon avec une délégation journalisée de même émetteur, destinataire et titre.

Critères d'acceptation :

- Rejeu du test du 20 octobre 2026 : la délégation chef OpenCode vers exécutant OpenCode apparaît dans le bureau avec sa soumission, sans lire la base d'OpenCode.
- Un nouvel agent reçoit l'annonce de rôle une seule fois, et la hiérarchie affichée correspond au directeur effectif (règle ou choix manuel).
- Le journal vit dans `.myteam-local/`, ignoré par Git (vérifié par `git check-ignore`), et reste lisible après redémarrage du serveur.
- Aucun contenu de mission complet ne transite au delà du titre plafonné dans les vues publiques du journal.

### Couche 3 : verrouillage du directeur

- La règle « premier lancé » est écrite explicitement dans le module de direction : le directeur par défaut est le premier agent apparu dans le projet, quel que soit son outil ; à défaut d'heure de démarrage fournie par Herdr, l'approximation actuelle par le plus petit panneau reste employée et documentée comme telle.
- La condition réservée à Claude dans `server.mjs` disparaît : délégations, tournée et discussion sont branchées sur le chef effectif quel que soit son outil (journal natif de la couche 2, enrichi des journaux d'outils quand ils existent).
- Le bureau affiche l'ancienneté du directeur (depuis quand il dirige, source règle ou choix), en réutilisant le champ `since` déjà prévu par `src/direction.mjs` pour le choix manuel et en l'alimentant aussi pour la règle dès la première apparition observée.
- Le choix manuel de l'utilisateur reste prioritaire et sa passation toujours proposée puis confirmée : aucun comportement actuel de `src/direction.mjs` n'est affaibli.

Critères d'acceptation :

- Chef OpenCode, Codex ou Claude : délégations et tournée présentes dans les trois cas.
- Le premier panneau lancé est directeur par défaut dans les trois cas ; un deuxième panneau ne le remplace jamais silencieusement.
- L'affichage de direction indique la source et l'ancienneté dans tous les cas.

### Alternative écartée : remplacer OpenCode par Pi

Pi est plus léger, et il figure déjà au catalogue des outils reconnus. Mais MyTeam n'a aujourd'hui aucun lecteur d'activité pour Pi (seuls Codex et OpenCode en ont), et ses sessions rangées par dossier poseraient le même problème d'attribution à plusieurs panneaux. Changer d'outil contournerait le symptôme sans corriger la cause, qui est la couche identité de MyTeam. Conclusion : corriger la couche identité, garder OpenCode comme outil de référence du multi-modèles, et faire de Pi le candidat naturel comme troisième outil à journaux enrichis après le correctif, si le besoin se confirme.

## 5. Plan en trois lots

### Lot 1 : identité par panneau et délégations du chef tout outil

Contenu : couche 1 complète, plus le branchement des délégations et de la tournée sur le chef quel que soit son outil (partie `server.mjs` de la couche 3).

Critères d'acceptation : ceux de la couche 1, plus la présence des délégations pour un chef OpenCode sur délégations observées dans sa session attribuée.

À ne pas régresser : protections locales du bureau (jeton, origine exacte, démarrage fermé avant choix de projet), gestion de crise (verrou 423), file d'attente et priorités, vérité des faits des vues (rien d'inventé, incertitude affichée), zéro dépendance ajoutée.

### Lot 2 : journal natif et annonce de rôle

Contenu : couche 2 complète, plus l'écriture explicite de la règle « premier lancé » et l'affichage d'ancienneté (reste de la couche 3), et le script de délégation dans le kit (français et anglais).

Critères d'acceptation : ceux de la couche 2 et de la couche 3.

À ne pas régresser : le journal reste local et ignoré par Git ; l'annonce de rôle ne contourne ni la crise ni les pauses ; aucun envoi automatique autre que l'annonce de rôle prévue par ce dossier ; la passation de direction reste proposée puis confirmée par l'utilisateur.

### Lot 3 : validation par le réel

Contenu : rejouer le test OpenCode du 20 octobre 2026 à deux panneaux (chef MiMo, exécutant DeepSeek, même mission fermée et même fichier de preuve), puis une variante à quatre panneaux OpenCode avec quatre modèles différents et une mission en chaîne (le directeur délègue à deux exécutants, un exécutant rend compte, le directeur synthétise).

Critères d'acceptation : délégation, soumissions et comptes rendus visibles dans le bureau pour chaque panneau ; activité attribuée au bon panneau pour les quatre ; budget d'appels API plafonné avant le test et respecté ; rapport de test écrit avec les écarts constatés.

À ne pas régresser : l'ensemble des tests du dépôt passe, et les parcours validés en 0.5.0 (crise, file différée, démarrage fermé, filtrage par projet) sont revérifiés après les lots 1 et 2.

## 6. Risques, limites et questions ouvertes

- Herdr ne fournit pas l'heure de démarrage des panneaux : « premier lancé » reste une approximation par l'ordre des panneaux et la première apparition observée par le bureau. Si le bureau démarre après les agents, la première apparition observée n'est pas la création réelle.
- La conformité des modèles aux annonces de rôle est variable : pendant le test du 20 octobre 2026, le chef MiMo s'est arrêté au stade du plan au premier tour et a dû être relancé. La poignée de main rend la hiérarchie visible et journalisée ; elle ne garantit pas que chaque modèle l'exécute sans relance.
- Le format de la base de sessions d'OpenCode peut évoluer d'une version à l'autre : l'attribution par session doit échouer proprement (mention d'incertitude) plutôt que silencieusement ou faussement.
- Une délégation lancée par un directeur hors du canal traçable (commande Herdr tapée à la main dans son terminal) n'est pas journalisée par construction ; la détecter en lisant les panneaux serait fragile et poserait un problème de vérité des faits. Question ouverte : faut il tenter une détection best effort marquée comme telle, ou assumer le canal unique ?
- L'ancienneté du directeur par la règle repose sur la mémoire du serveur : un redémarrage la réinitialise. Question ouverte : la persister dans `.myteam-local/` dès le lot 2, ou seulement avec le journal ?
- Ce dossier est une proposition portée par la branche `Muse`. Les lots, leur ordre et leurs critères sont soumis à la décision de SmokeSama ; rien de ce qui précède n'est décidé pour `main`.
