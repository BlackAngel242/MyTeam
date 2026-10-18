# Reprise IA

Lire attentivement ce document ainsi que `PRODUCT.md`, `DESIGN.md`, `JOURNAL.md`, `LESSONS.md` et `docs/publication-github.md` avant toute intervention sur le projet.

## Contexte et architecture du projet

L'application MyTeam (« Bureau des agents ») est une tour de contrôle locale dans le navigateur conçue pour DrSmoke et ses agents d'intelligence artificielle opérant dans Herdr.

- Serveur d'application : Développé en Node.js natif (ES Modules, `server.mjs`), sans aucune bibliothèque tierce (`node_modules` n'existe pas). Il écoute exclusivement sur `http://127.0.0.1:4317`.
- Passerelle Herdr (`src/herdr.mjs`) : Communique avec l'outil Herdr en local via `node:child_process` (arguments isolés, aucune interprétation shell). La liste des agents est rafraîchie toutes les trois secondes. Les envois de consignes sont strictement interdits aux agents occupés ou bloqués.
- Chef et agents : Le premier agent démarré dans Herdr est désigné chef d'équipe et occupe le bureau VIP. Les autres sont ses agents.
- Cycle de délégation et courriers : Surveillance des délégations (`herdr agent prompt`) dans le journal du chef. L'agent vient prendre sa consigne, travaille à son poste, puis envoie un courrier au chef une fois la mission achevée. L'humeur reflète fidèlement les résultats observés et les erreurs enrichissent `LESSONS.md`.
- Salle de réflexion : Pièce animée dédiée où les sous-agents d'un agent se concentrent avant de déposer leur dossier de travail.
- Activités locales réelles (`src/claude-activity.mjs`, `src/agent-activity.mjs`) : Suivi des jetons et sous-agents pour Claude, lecture des configurations et historiques locaux réels pour Codex et OpenCode, sans inventer de métriques.
- Explorateur de fichiers (`src/files.mjs`) : Navigation arborescente sécurisée dans les fichiers du projet, confinée à la racine, sans suppression ni écrasement.
- Interface web (`public/`) :
  - Scène calculée dans un canvas (`public/app.js`), agrandie avec netteté intégrale en pixel art avec bureau VIP et salle de réflexion.
  - Logos personnalisés 16x16 pour chaque outil (`public/logos.js`).
  - Moteur de filtrage et surlignage de terminal sans altération du texte (`public/terminal.js`).
  - Panneau latéral organisé en deux onglets : « Poste » (vue individuelle, console, recherche, consigne avec Ctrl+Entrée, explorateur) et « Équipe » (envoi groupé avec confirmation en deux étapes, journal des envois, délégations).
  - Mode plein écran étendu regroupant la scène et le panneau de pilotage.

## Règle absolue : Vérité des faits

Le bureau n'affiche que ce qui est réellement observé : états Herdr, journaux locaux, fichiers du disque, horloge de la machine. Jamais de pourcentage fictif, de tâche imaginaire ou d'humeur inventée. Toute lacune d'un outil est signalée par « Non exposé par cet outil ».

## État au 18 octobre 2026 (0.4.x, dépôt public MyTeam)

- Dépôt public `BlackAngel242/MyTeam`, CI Ubuntu et Windows, site GitHub Pages, release 0.4.0 ; le reste à faire est dans `TODO.md`. Aucun nom d'auteur imposé dans l'interface (pied de page dans `.bureau/pied.json`).
- Suite de tests : près de 400 tests, `npm run check` et `npm test` verts sur l'export propre de `HEAD` avant chaque push.
- Lot L (table ronde) : crise atomique et relecture (OpenCode), budget d'écriture de la file et alerte visible, lecture incrémentale contrôlée, masque public unique `src/masque.mjs`, consentement, déplacement exclusif, bilans honnêtes (Codex), accessibilité et performance de l'interface (Claude), documentation et noms (Antigravity).
- Pause de quota : l'heure annoncée est retrouvée même coupée par le terminal, compte à rebours dans la liste, la barre d'état et la scène, notification au retour, reprise automatique de tout agent une minute après (consigne par la file, une fois par pause).
- TODO du bureau : le groupe « Demandes en cours » suit les consignes envoyées aux agents ; une demande n'est cochée qu'après une réponse terminée de l'agent.
- Bouton « Autonomie » (NoBabysitter supervisé) : `src/autonomie.mjs`, `/api/autonomie`. Plafonds de durée et d'échanges, arrêt sur échéance, plafond, boucle, salle de crise ou redémarrage ; jamais de push, suppression, installation, publication ni réponse à une boîte de dialogue ; le chef décide, aucun agent n'écrit à un autre directement.
- Reste : validation du chef pour le tag et la release 0.4.1. Entrée 0.4.1 prête dans CHANGELOG.md (FR et EN), site GitHub Pages vérifié en local avec Playwright, documentation d'aide (docs/aide.en.md) et README.en.md relus et harmonisés (parité stricte et vocabulaire chief/Mosaic unifié).
- Captures et plafonds : l'ensemble des 22 captures de docs/captures/ et 12 de site/assets/ ont été régénérées avec un pied de page vide (garantissant l'absence de données personnelles) ; ajout des captures à 10 agents (20 et 21) ; plafonds factuels « jusqu'à 10 agents testés, 12 en envoi groupé, mosaïque 4 » documentés dans README FR/EN, docs/aide*.md et le site. Suite complète : 433 tests passés (427 réussis, 6 ignorés).

## État d'avancement au 17 octobre 2026 (Version 0.3.0 livrée et stabilisée)

- Suite de tests : 161 tests automatisés (159 réussis, 2 ignorés sur les liens symboliques Windows, 0 échec). Syntaxe irréprochable validée avec `npm run check`.
- File d'attente serveur sécurisée (`src/queue.mjs`) :
  - Bouton « Mettre en file » sur le poste quand un agent est au travail ou en pause de limite.
  - Gestion collective dans l'onglet Équipe avec liste des consignes et retrait unitaire possible.
  - Relance automatique planifiée 5 minutes après la remise à zéro de quota annoncée par l'outil (`remise à zéro + 5 min`).
  - Protection absolue contre les doubles envois (clé d'idempotence, statut d'envoi persistant avant tout appel externe, écriture atomique sur disque et sauvegarde des fichiers corrompus en `.corrompu`).
- Onglet Tâches connecté :
  - Analyse des cases réellement cochées dans les fichiers de documentation (`TODO.md`) et des plans publiés par les agents dans leurs journaux.
  - Progression strictement factuelle, sans extrapolation ni calcul inventé.
- Palette de commandes modale (`Ctrl+K`) et aide escamotable (`aside.help`, touche `?`) :
  - Navigation complète au clavier pour ouvrir un poste, rédiger une consigne, changer d'onglet ou ajuster la scène.
  - Volet d'aide latéral ouvert à la première visite avec visite guidée en 5 étapes, table des raccourcis et commandes des signaux.
- Module sonore et notifications :
  - Module Web Audio 8 bits autonome sans fichier audio (`public/sounds.js`, 4 signaux : fin de travail, blocage, pause de limite, délégation).
  - Notifications de bureau Windows en arrière-plan avec bascules d'activation dans l'aide et mémorisation dans `localStorage`.
- Ambiance visuelle et cycle jour-nuit continu :
  - Transition progressive du ciel selon l'heure réelle de la machine (nuit, aube, jour, crépuscule), lever fixe à 6 h 30 et coucher fixe à 19 h 30 (approximation sans saisons).
  - Arc horaire pour le soleil et la lune, éclairage dynamique de la pièce, de la salle de réflexion et du bureau Direction.
- Scène pixel art et organisation de l'équipe :
  - Salle de réflexion repliable pour les sous-agents d'analyse.
  - Bureau Direction valorisé pour le premier agent démarré (le chef), avec pile de courriers cliquable ouvrant directement l'onglet Équipe.
  - Suivi des ordres de délégation (`herdr agent prompt`) et courriers de fin de travail remis à zéro dès consultation.
- Synthèse de design D1 à D8 appliquée :
  - D1 : État principal « En pause (limite) » unifié sur l'ensemble de l'interface.
  - D2 : Barre d'aide à la disposition isolée sur sa propre ligne pour éviter tout chevauchement avec l'alerte d'attention.
  - D3 : Cartes d'agents restructurées sur deux lignes avec identifiant Herdr en pastille (`.pane-pill`) et passage en grille 2 colonnes sous 1360 px sans troncature.
  - D4 : Onglet Équipe épuré avec compteurs intégrés dans les titres de section.
  - D5 : Terminal occupant la hauteur disponible avec bouton « Agrandir » / « Réduire » pour une lecture pleine page.
  - D6 : Blocs d'erreur unifiés avec bouton « Actualiser le bureau » et 6 icônes d'états vides pixel art 16x16 (`public/empty-icons.js`).
  - D7 : Écran d'accueil de poste invitant à la sélection directe dès l'ouverture.
  - D8 : Adaptation responsive mobile soignée et validée à 390 et 360 px sans débordement horizontal.

## Deuxième revue de Codex traitée (17 octobre 2026, après 0.3.0)

- Les 11 constats de `docs/revue-codex-interface-2.md` sont corrigés (détail dans la section « Non publié » de `CHANGELOG.md`). 177 tests, 175 réussis, 2 ignorés.
- Vérifications Playwright sur états simulés dans le scratchpad de Claude (`pw/revue2*.mjs`) ; G2 confirmé sans interception sur le vrai serveur par l'essai d'OpenCode (`%TEMP%/opencode/essai-g2`).
- Après tout changement de `server.mjs` : redémarrer le processus qui écoute sur 4317, sinon l'ancien code reste servi.
- Codex est au repos (quota bas, 19 % le 17 octobre) : ne pas lui confier de mission avant sa remise à zéro. OpenCode reprend ses fichiers si besoin.
- Non vérifié : notifications Windows réelles page cachée (le délai réel dépend du navigateur), lecteur d'écran sur la palette.

## Soir du 17 octobre 2026

- Fusion dans `main` faite (42fa960), branche alignée. Éclairage du soir, P1, P2, P4 et P5 d'OpenCode appliqués.
- Le tableau de la scène relit la file toutes les 5 s, quel que soit l'onglet.
- Faits ensuite : P3, P6, P7 (OpenCode), tableau de l'équipe (`/api/tableau`, `src/blackboard.mjs`) et tournée du chef (Claude). DrSmoke a écarté l'accès direct au poste sur téléphone.
- Décisions de DrSmoke (17 octobre au soir) : replay abandonné (pas de bulles de dialogue comme Atoll92/agent-standup), météo abandonnée (consomme pour rien), salle de crise à garder en réserve, bureau en tuiles accepté. Pause de quota mise en scène livrée.
- Étude en cours de l'organisation fonctionnelle de l'OS d'agents : fil de la salle de contrôle, transfert de direction, priorité des envois, envoi et traitement de fichiers. OpenCode : docs/os-fonctions-opencode.md (données et serveur) ; Antigravity : docs/os-fonctions-antigravity.md (parcours et organisation).

## 18 octobre 2026 : plan de travail, avancement visible, fonctions de l'OS

- Plan et missions : `docs/plan-travail.md` (cases lues par l'onglet Tâches) et `docs/missions-18-octobre.md`. Cycle : mission écrite, travail de l'agent, évaluation du chef (`npm run check`, `npm test`, relecture du commit, Playwright), correction, leçon dans `LESSONS.md`, agents prévenus par message, case cochée. Règle écrite dans `AGENTS.md` (« Boucle de correction »).
- Avancement visible : onglet Tâches avec « À faire » et « Réalisées » par fichier et pourcentage (cases cochées sur cases totales, jamais une estimation) ; pourcentage du plan publié affiché sur le poste de l'agent.
- Réponses lisibles : `src/responses.mjs` (Claude par session exacte, Codex et OpenCode par dossier, jamais en cas d'ambiguïté), `GET /api/reponses`, `public/response-card.js` (Markdown sûr, copie, export `.md`), volet « Réponses lisibles » du poste. Limite constatée : Herdr n'expose pas `agent_session` pour Claude sur ce poste, donc pas de réponses de Claude ; Antigravity non exposé.
- Fil de la salle de contrôle : `GET /api/discussion`, `public/discussion.js`, onglet Équipe. Messages inter-agents chiffrés de Codex jamais affichés.
- Fichiers : joindre un fichier à une consigne (`files` dans `POST /api/queue`, copie sans écrasement, deux fichiers de 20 Mo au plus, par la file) ; `GET /api/traitement` et section « Fichiers confiés » : faits sourcés, jamais « réussi ».
- Installeurs : correctifs de sécurité de Codex (injection par nom de dossier, `--oui` ne valide plus aucune installation, chemin Herdr littéral), tests réparés sous Windows par le chef.
- Après tout changement de `server.mjs` : redémarrer le processus du port 4317.
- OpenCode est resté bloqué par une boîte « Worktrees / Choose directory » : non traitée à la place de DrSmoke. Ses missions (A1b, E2, E4, E6) ont été reprises par Codex et le chef.
- Lot G livré : salle de crise (`src/crisis.mjs`, `/api/crise`, `docs/contrat-crise.md`, verrou 423, file suspendue, arrêt poli par `esc`, bouton sous clapet et `Ctrl+Maj+C`) et mosaïque (`public/tiles.js`, bouton Mosaïque / Vue scène). Dépôt public https://github.com/BlackAngel242/MyTeam créé et configuré avec l'accord de DrSmoke (fenêtre de pleins droits du 18 octobre), CI verte. Plus rien en suspens ; des fenêtres entièrement libres n'ont pas été demandées.

## Préparation à la publication GitHub et prochaines étapes

1. Fichiers maintenus par Antigravity :
   - `README.md` : Guide d'accueil public complet avec cycle de délégation, bureau Direction, file d'attente, tâches réelles, sons et raccourcis.
   - `CONTRIBUTING.md` : Consignes pour contribuer en respectant l'architecture zéro dépendance.
   - `CHANGELOG.md` : Historique des versions 0.1.0, 0.2.0 et 0.3.0.
   - `docs/aide.md` : Guide d'aide complet et fidèle à l'interface réelle.
   - `docs/publication-github.md` : Audit de publication, politique de sécurité et préparation des illustrations.
   - `docs/idees-os.md` : 8 pistes d'innovations pour transformer le bureau en OS d'agents.
   - `docs/commandes-outils.md` : Référentiel vérifié des commandes locales pour modèles et compétences.
   - `TODO.md` : Suivi précis des livraisons et des tâches futures.

2. Décisions et validation de DrSmoke :
   - Choix des captures finales pour `docs/captures/`.
   - Création manuelle du dépôt public GitHub (`MyTeam`) et publication initiale sur la branche `main`.
   - Arbitrage sur les évolutions d'OS d'agents (bureau en tuiles ou en fenêtres libres).

- Node actif : 24.22.0 LTS depuis le 18 octobre (nvm-windows, accord de DrSmoke). Le serveur en cours d'exécution tourne encore sur l'ancien Node 25.6.1 : le redémarrer quand DrSmoke le souhaite.

## 18 octobre 2026, lot L, part OpenCode (rangs 1, 6, 7, 5)

- Rangs 1, 6, 7 et 5 livr?s et committ?s : b56585c, 825fa11, 9560c5a, f01f10f, af523d9. V?rification faite par reproduction avant correction, test rouge sur l'ancien code, puis test vert.
- Rang 1 : lev?e de crise effective seulement apr?s ?criture r?ussie, contr?le apr?s lecture du corps et juste avant chaque envoi (diffusion destinataire par destinataire). La file rev?rifiait d?j? avant son appel : test ajout?, aucun changement de code n?cessaire.
- Rang 6 : budget d'?criture de la file ?gal au budget de lecture, refus explicite avant acceptation, alerte de r?cup?ration visible.
- Rang 7 : continuit? des octets au point de reprise avant de reprendre un offset (activit? Claude et t?ches).
- Rang 5 : masque public unique dans src/masque.mjs, trois r?gles distinctes (chemins avec espaces et UNC, secrets, adresses web et routes /api conserv?es), appliqu? avant toute troncature, y compris aux descriptions de sous-agents. Destinataire tiers ?cart? des r?ponses Codex.
- ? faire : red?marrer le processus du port 4317 pour prendre en compte server.mjs, puis v?rifier ? l'?cran. Le champ d'alerte de r?cup?ration de la file est dans /api/queue mais pas encore affich? par public/app.js.
- Non fait, hors de mon p?rim?tre : C-CD-12 dans scripts/installer.sh (propri?taire Codex). Un test ?choue dans site.test.mjs (site/assets/autonomie.png absent), p?rim?tre Antigravity.
- LESSONS.md contient mes nouvelles le?ons mais n'est pas commit? : un autre agent y a des lignes non commit?es, et committer les aurait embarqu?es.
- 18 octobre soir : docs/performance.md écrit (chiffres réels du banc à dix agents, commande de reproduction, plafonds vérifiés, limites connues). Moi : leçons du banc dans LESSONS.md, docs/performance.md classé note interne et exclu du zip de release (.gitattributes). Rien de poussé.
- Reste à arbitrer avec le chef : la rafale de fins remplit les 5 places de la file par agent (4 fins sur 9 sans consigne) et le relais déjà actif laisse passer les fins en clair après l'arrêt du mode (correctif attendu dans src/autonomie.mjs).
- Vérifié : banc 13/13, suite complète 433 tests (427 réussis, 6 ignorés, 0 échec).
