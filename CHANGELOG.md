# Journal des modifications (Changelog)

**Français** | [English](CHANGELOG.en.md)

Toutes les évolutions notables du projet Bureau des agents sont consignées dans ce fichier. Le format s'inspire des principes de Keep a Changelog.

## [0.5.1] - 2026-10-21 · « Ṣàngó »

- Mise à jour intégrée depuis les releases GitHub : notification, téléchargement, SHA-256, préparation et redémarrage automatique.
- Sauvegarde de l’ancienne installation, conservation des dossiers locaux et refus des clones Git.

## [0.5.0] - 2026-10-20 · « Ṣàngó »

### Projets et confidentialité

- Choix initial : améliorer MyTeam ou créer/reprendre un autre projet ; dossiers sélectionnés avant toute consigne.
- Filtrage des agents et des opérations par projet, y compris le partage des leçons ; changer de projet arrête l’ancien contexte.
- Mémoire d’exécution privée par projet dans les données du système, hors checkout ; aucune importation automatique d’une ancienne installation.
- Kit générique avec reprise et journal privés dans `.myteam-local/` ignoré, sans écrasement des fichiers existants.
- Documentation technique publique nettoyée du contexte personnel des sessions. Les anciennes releases sont retirées après publication et vérification de la nouvelle ; l’historique Git reste inchangé.
- Planification du canvas et sortie de survol corrigées en conservant Lucide local et les traductions dynamiques.
- L’écran de confiance Codex est signalé comme une action humaine dans Herdr : aucune consigne n’est envoyée si sa lecture échoue ou si ce dialogue est présent.
- Herdr installé dans `~/.local/bin` est détecté sans dépendre du PATH ; refus d’hôte adapté au port choisi et message de provenance distinct d’une expiration de session.

### Interface

- Icônes fonctionnelles Lucide locales et notices intégrées, sur la vitrine et le bureau ; personnages et emblèmes pixel art conservés.
- Thèmes Système / Clair / Sombre mémorisés par origine, adaptation au système et fonctionnement quand le stockage est refusé.
- Galerie au clavier : dialogue natif, focus confiné et retour à la vignette, libellés FR/EN.
- Prérequis visibles avant téléchargement, distinction entre outils reconnus et journaux enrichis, légendes harmonisées.
- Contrastes des champs, destinations, code Markdown, autonomie active et alertes ; barre d'actions adaptée aux tablettes.
- Tests navigateur reproductibles. Extension VS Code reportée.


## [0.4.2] - 19 octobre 2026 · « Ọṣun »

Ọṣun est la divinité yoruba des eaux douces, de la beauté et de l'abondance : une version qui rend le flux du travail visible et fluide. Chaque version porte désormais le nom d'une divinité ashanti ou yoruba (voir `docs/noms-de-versions.md`).

### Ajouté

- Interrupteur « Autonomie » toujours visible dans la barre du haut (OFF / ON, temps restant et échanges), avec les choix 5 min et 3 échanges pour un essai, et un bouton « Récapitulatif » (route `/api/autonomie/recap`) qui raconte le mode à partir du seul journal.
- Santé du bureau : route `/api/sante`, ligne de santé et bouton « Copier le diagnostic » dans l'aide (versions et états seulement, aucun chemin ni message), pastille « Redémarrage à prévoir » quand le serveur exécute un code plus ancien que les fichiers.
- Capsule animée de la tournée du chef (7 secondes, moins de 250 Ko) sur le site et dans le README.
- Scène lisible jusqu'à 10 agents sur téléphone : trois colonnes dès cinq collaborateurs (725 px de haut au lieu de 1 491 px).
- Outillage d'équipe : `scripts/rapport-tache.mjs` (rapport de fin de tâche pré-rempli, rien d'inventé), `scripts/branche-agent.mjs` (branche nommée par tâche), plafond de 90 s par test, banc de mesure à 10 agents (`docs/performance.md`).
- Méthode d'équipe : protocole de travail (`docs/protocole-agents.md`) et Fixit d'équipe, revue à 2 à 4 profils (`docs/fixit-equipe.md`).

### Corrigé

- Aperçu de partage de la page (Open Graph) : adresses absolues, image 1200×630 sans donnée personnelle, texte alternatif.
- Mode Autonomie : l'arrêt attend la fin d'un envoi en cours, les consignes encore en file sont retirées à l'arrêt et au redémarrage, l'objectif ne peut plus fermer ses guillemets ni passer avant les interdits, qui sont présentés comme une consigne et non comme un verrou.
- Pause de quota : l'heure annoncée est retrouvée même coupée sur deux lignes du terminal, avec compte à rebours et reprise automatique une minute après.
- Tests insensibles à la charge (fixture isolée du dossier personnel des agents).
- Le site n'affiche plus de numéro de version figé ; README ramené à une page ; lien Herdr corrigé.

### Sécurité

- Les captures et images publiques ont été reprises sans information personnelle, et l'historique du dépôt a été nettoyé des anciennes versions de ces images.

## [0.4.1] - 18 octobre 2026

### Ajouté

- Mode Autonomie supervisée (NoBabysitter) :
  - Bouton « Autonomie » dans la barre d'outils et route serveur `/api/autonomie` pour lancer un cycle de travail autonome supervisé.
  - Architecture en étoile autour du chef d'équipe : le chef reçoit chaque fin de travail d'un collaborateur, décide seul de la suite et la délègue ; aucun agent n'écrit à un autre directement.
  - Paramétrage borné : objectif précis (5 à 300 caractères), durée maximale (5 à 120 minutes, 30 min par défaut) et plafond d'échanges (3 à 60, 20 par défaut).
  - Arrêts automatiques et immédiats : échéance atteinte, plafond d'échanges, boucle détectée (terminaisons répétées sur 10 minutes), déclenchement de la salle de crise, redémarrage du serveur ou bouton d'arrêt manuel.
  - Suivi en direct dans la barre d'outils (temps restant et ratio d'échanges) et journal factuel des événements réels.
- Pause de quota avec compte à rebours et reprise automatique :
  - Détection fiable des horaires de remise à zéro dans le terminal, y compris lorsque l'heure est coupée sur la ligne suivante.
  - Mémorisation de l'échéance dès la première détection pour éviter le maintien indu en pause après remise à zéro.
  - Compte à rebours en direct dans la liste des postes, la barre d'état et le chevalet de la scène, avec alerte au retour.
  - Reprise automatique : envoi d'une consigne courte par la file d'attente à l'agent une minute après la fin de la pause pour relancer le travail sans refaire ce qui est déjà commité.
- TODO des demandes en cours et panneau de liège :
  - Suivi des demandes transmises aux agents dans l'onglet Tâches (« Demandes en cours »), cochées uniquement quand l'agent a rendu une réponse terminée après l'envoi.
  - Tableau de liège en pixel art sur le mur du fond affichant le nombre de tâches ouvertes dans `TODO.md` avec punaises colorées.
  - Découverte exacte de la session Claude active par son identifiant de processus (`~/.claude/sessions/<pid>.json`), restaurant l'historique d'activité, les sous-agents, les délégations et les réponses du chef.
- Site statique GitHub Pages (`site/`) :
  - Présentation bilingue (français et anglais) du Bureau des agents, responsive sur ordinateur et mobile, mettant en valeur l'atelier en pixel art, la mosaïque, la salle de crise et l'autonomie supervisée, sans dépendance externe.
- Outils de maintenance CI :
  - Script de rétention des versions (`scripts/garder-releases.mjs`) conservant au plus les 2 releases les plus récentes.
  - Vérification de la révision et de la structure du fichier ZIP lors de l'empaquetage de publication.

### Sécurité

- Masque public unique (`src/masque.mjs`) :
  - Unification du masquage selon trois règles strictes pour masquer les chemins locaux (`C:\...`, `/home/...`) et les jetons ou identifiants sensibles.
  - Préservation explicite des URL Web (`http://`, `https://`).
  - Masquage étendu aux descriptions de sous-agents, à l'objectif et au journal du mode autonomie, et exclusion des destinataires tiers dans les réponses Codex.
- Salle de crise durcie :
  - Verrou de crise conservé même en cas d'échec d'écriture sur le disque.
  - Contrôle d'état de crise répété après lecture du corps de requête et immédiatement avant chaque expédition.
- Sécurisation de l'autonomie et de la file d'attente :
  - Arrêt de l'autonomie sérialisé avec l'envoi en cours et retrait immédiat de la file des consignes du mode à l'arrêt ou après redémarrage.
  - Re-vérification stricte de l'état, du répertoire de travail et de la disponibilité de la cible juste avant chaque départ de la file d'attente.
  - Budget d'écriture de la file aligné sur le budget de lecture avec rejet explicite avant acceptation.
- Installation sécurisée :
  - Rejet immédiat de tout numéro de port invalide avant toute modification.
  - Déplacement exclusif de fichiers sans écrasement avec consentement interactif.

### Modifié

- Accessibilité et ergonomie (lot L) :
  - Modale de repli accessible : fond inerte, piège du focus et aide automatique sans vol de focus.
  - Bascules à libellé dynamique utilisant `data-actif` au lieu de `aria-pressed`.
  - Désactivation de l'ouverture de la palette `Ctrl+K` pendant l'activation de la salle de crise.
  - Rendu économique et optimisé : liste d'agents redessinée uniquement sur changement, suspension du dessin de la scène sous la mosaïque, et relevé des traitements et du fil toutes les 15 secondes.
  - Unification du vocabulaire : tutoiement harmonisé dans l'ensemble de l'interface et des messages serveur, et harmonisation des termes anglais (`chief` au lieu de `lead`, majuscule à `Mosaic`).
  - Alerte de récupération de la file affichée visiblement dans l'onglet Équipe.
- Personnalisation du décor :
  - Pied de page et enseigne murale rendus facultatifs et configurables via `.bureau/pied.json`, sans mention obligatoire d'auteur ou de coordonnées.

### Corrigé

- Contrôle de continuité des octets : vérification de l'intégrité avant de reprendre un décalage de lecture incrémentale dans l'activité Claude et les tâches.
- Compatibilité Windows : détection et exécution des scripts d'installation fiabilisées en présence de chemins courts 8.3 (`PROGRA~1`).
- Aide : suppression de la mention du bouton « Passer la visite » inexistant dans l'interface et alignement des libellés anglais sur les textes réels.

## [0.4.0] - 18 octobre 2026

### Ajouté (installation et release)

- Installeur animé (`scripts/installateur-anime.mjs`) : bannière révélée ligne par ligne, ligne de temps et liste de tâches qui se met à jour en direct (réussie, ignorée, en échec), questions o/n et choix sous la liste, repli en texte simple hors terminal, `--demo` pour voir l'animation sans rien installer.
- `Installer MyTeam.bat` : double-clic sur le fichier du zip de la release ; installeur animé si Node.js 22 ou plus est présent, sinon installeur texte qui propose Node.js.
- Étape Clink facultative (Windows, confirmation individuelle, `winget install chrisant996.Clink`).
- Protocole entre l'installeur et son interface (`docs/installeur-protocole.md`) ; les installeurs PowerShell et bash parlent ce protocole avec `-Interface` / `--interface`.
- `scripts/empaqueter-release.mjs` : archive zip des fichiers suivis par Git, sans les notes de travail internes.

### Corrigé

- Sons et icônes d'états vides : `sounds.js` et `empty-icons.js` n'étaient pas chargés par la page (« Sons : module absent ») ; un test exige désormais que chaque script de `public/` soit chargé et servi.


### Corrigé

- Sauvegarde des brouillons lors de la mise en file (G1) : mettre une consigne en file pour un agent puis changer de poste pendant la requête réseau n'efface plus le brouillon saisi sur l'autre poste.
- Validité des lectures protégées du navigateur (G2) : les requêtes GET locales du navigateur (`/api/queue`, `/api/todos`, `/api/places`, `/api/files/*`) sont validées par `Sec-Fetch-Site` en l'absence d'en-tête `Origin`, évitant les faux messages d'erreur « Session expirée ».
- Calcul des échéances de pause de quota (M2) : une annonce d'horaire lue dans le terminal (comme « try again at 4:45 PM ») conserve l'échéance de sa première détection sans repousser la pause au lendemain en cas de relecture ; les heures invalides sont rejetées et les mentions UTC/GMT sont respectées.
- Précision du libellé des limites de quota (M3) : une fenêtre de 24 heures affiche désormais « 24 h » au lieu de « hebdomadaire », et seules les limites réellement épuisées (100 %) sont retenues pour déterminer l'heure de reprise.
- Distribution des scripts statiques (M4) : le serveur HTTP local expose désormais les routes statiques sécurisées pour `/sounds.js` et `/empty-icons.js`.
- Respect de la réduction des mouvements (M8) : la préférence système `prefers-reduced-motion` fige la scène animée par défaut sans choix manuel préalable, tout en maintenant un rafraîchissement d'une fois par minute pour actualiser l'heure, le soleil et l'éclairage.
- Hauteur du terminal agrandi sur écran mobile (M9) : le bouton « Agrandir » applique une règle prioritaire garantissant un réel gain de hauteur d'affichage (entre 62 et 80 % de l'écran, avec défilement interne qui suit la dernière ligne) sur téléphone.
- Palette de commandes réellement modale (M1) : fond inerte, Tab contenu dans la palette, focus rendu au déclencheur ou à l'onglet ouvert ; Échap ne ferme qu'une couche à la fois (palette, puis Disposer, puis aide) ; les flèches de Disposer ne détournent plus celles des onglets et des listes ; l'aide de première visite ne s'ouvre plus si une action a déjà commencé.
- Notifications en arrière-plan (M5) : quand les notifications Windows sont activées, l'état des agents est encore relu toutes les 15 secondes page cachée, sans animer la scène. Le navigateur peut espacer ces relectures.
- Rafraîchissements stables (M6) : invitation, file d'attente et tâches ne sont redessinées que si leur contenu change, le bouton focalisé est conservé, une même panne n'est annoncée qu'une fois, et une réponse lente ne remplace plus une lecture plus récente.
- Mémoire bornée (M7) : 30 courriers gardés en détail (le compteur couvre toute la session), 500 identifiants de délégations vus au plus, caches des agents disparus purgés.

### Ajouté

- Tableau des tâches avec pourcentage : calcul factuel et affichage du pourcentage d'avancement d'après les cases cochées observées dans `TODO.md` et les plans d'action réels publiés par les agents dans leurs journaux d'activité.
- Réponses lisibles des agents : composant `public/response-card.js` et styles `.rc-` sous le terminal de l'onglet Poste (branché sur `GET /api/reponses`), affichant les réponses structurées avec Markdown sûr sans `innerHTML`, copie fidèle du texte source, boutons de copie de bloc de code, export local en `.md` (réponse unitaire ou session complète), repli accessible pour le presse-papiers et réconciliation par clés stables sans casser la sélection (Claude, Codex et OpenCode).
- Fichiers joints et fichiers confiés : possibilité de joindre des fichiers locaux à une consigne mise en file d'attente avec copie sécurisée sans écrasement dans le dossier de travail de l'agent avant l'expédition, plafond de volume de 2 fichiers de 20 Mo, et suivi factuel des étapes de traitement dans l'onglet Équipe via `GET /api/traitement`.
- Fil de discussion de l'équipe : composant `public/discussion.js` et styles `.disc-` de la salle de contrôle (branché sur `GET /api/discussion`), réunissant les extraits des dernières réponses de toute l'équipe du plus récent au plus ancien, avec mention explicite pour chaque agent non lu (« non exposé par cet outil », « non rattaché avec certitude »).
- Sécurité renforcée des installeurs : durcissement de `scripts/installer.sh` et `scripts/installer.ps1` contre les dossiers piégés (`$(commande)`), rejet absolu des options d'approbation automatique `--oui` / `-Oui` imposant une validation interactive o/n, et résolution stricte de l'exécutable Herdr.
- Tableau de l'équipe : bouton « Tableau » et panneau de liège dans la scène. Fenêtre en lecture seule sur les fichiers piliers (étape en cours de HANDOFF.md, cases ouvertes de TODO.md, rôles d'AGENTS.md, dernières leçons de LESSONS.md), avec la source et la date de chaque fichier. Route serveur `/api/tableau` protégée par jeton, liste de fichiers fermée, chemins et identifiants masqués.
- Pause de quota mise en scène : à un passage observé en pause, l'agent quitte le bureau batterie vide ; son chevalet alterne l'heure de retour annoncée et le temps restant ; à la fin observée de la pause, il revient batterie pleine. Rien n'est animé au chargement.
- Tournée du chef : à chaque délégation observée dans son journal, le chef sort de la Direction, pose le dossier titré sur le bureau de l'agent visé, puis revient. Une tournée à la fois.
- Salle de crise (G1, G3) : disjoncteur général sous clapet (« Salle de crise », raccourci `Ctrl+Maj+C` ou palette de commandes), bandeau d'alerte ambré, diagnostic d'urgence observant les dernières sorties de chaque agent, verrou immédiat de tous les envois directs et gel de la file d'attente (code HTTP 423), et mécanisme d'interruption polie par agent envoyant la touche Échap canonique (`esc` dans Herdr) avec confirmation interactive, sans aucun kill brutal du système. Persistance atomique dans `.bureau/crise.json` (crise active par sécurité si le fichier est corrompu).
- Mode Mosaïque (G2, G4) : affichage commutable de 2 à 4 terminaux côte à côte à la place de la scène (« Mosaïque » / « Vue scène », commande palette), ordonnancement des agents au travail en priorité, bascule entre disposition « Grille 2×2 » et « Colonnes », sélecteur de tuiles si plus de 4 agents connectés, terminaux nettoyés des séquences ANSI avec recherche réactive surlignée et compteur de correspondances, formulaire de consigne rapide (`Ctrl+Entrée`) désactivé avec explication quand l'agent n'est pas disponible, bouton « Agrandir » ouvrant le poste unitaire, et rafraîchissement borné et économique (toutes les 3 s, suspension quand l'onglet est masqué, une lecture à la fois par tuile, préservation de la sélection de texte).
- Interface bilingue FR / EN : bascule instantanée par bouton d'en-tête « FR / EN » (mémorisée dans `localStorage` sous `bureau.langue`), détection de la langue du système ou du navigateur par défaut (`navigator.language`), traduction complète de l'ensemble des écrans, formulaires, aides et messages d'erreur serveur sans rechargement externe.
- Relais d'écoute du chef : option facultative dans l'onglet Équipe (désactivée par défaut, persistée dans `.bureau/relais.json`), transmettant un message neutre au chef effectif via la file d'attente dès qu'un agent passe de « au travail » à disponible (« un agent vient de terminer, lis son panneau »), avec intervalle minimum d'une minute par agent, déduplication stricte et arrêt absolu pendant la salle de crise.
- Kit d'équipe et outillage d'évaluation : script d'initialisation `scripts/init-kit.mjs` (déploiement sans écrasement des fichiers piliers `AGENTS.md`, `CHEF.md`, `LESSONS.md`, etc.), script d'auto-évaluation factuelle `scripts/evaluer.mjs` (vérification des piliers, des cases cochées et des tests sans score inventé) et script de diffusion `scripts/partager-lecons.mjs` (ajout à `LESSONS.md` et notification douce des agents Herdr disponibles uniquement), documentés dans `docs/kit.md`.
- 24 emblèmes pixel art d'outils Herdr : intégration dans `public/logos.js` des emblèmes 16×16 pour l'ensemble des 24 outils supportés par Herdr (`pi`, `claude`, `codex`, `gemini`, `cursor`, `devin`, `agy`, `cline`, `omp`, `mastracode`, `opencode`, `copilot`, `kimi`, `kiro`, `droid`, `amp`, `grok`, `hermes`, `kilo`, `qodercli`, `qwen`, `letta`, `maki`, `muse`) et emblème de repli pour agent générique, affichés en façade de chaque bureau, dans les cartes et dans les tuiles de la mosaïque.
- Intégrations Herdr officielles : prise en compte et documentation des intégrations `herdr integration install <outil>` permettant la remontée fine des sessions et activités des agents vers Herdr.
- Visite guidée et aide en 7 étapes : mise à niveau du volet d'aide interactif et des documentations vers un parcours en 7 étapes (ajout des étapes 6 Mosaïque et 7 Salle de crise).

### Modifié

- Éclairage du soir : suspensions au plafond et lampes de bureau allumées de 17 h 30 au matin selon l'heure du poste ; la lampe d'un agent en pause de limite reste éteinte.
- Tableau de la scène (P1 d'OpenCode) : il ne répète plus les états des cartes et montre l'heure de retour d'une pause, les consignes en file, les courriers non lus et les sous-agents actifs.
- Sous chaque bureau, le nom seul souligné de la couleur d'état (P2 d'OpenCode) ; l'état est porté par la carte, la posture, l'écran et la bulle.
- Salle de réflexion au libellé fixe, jamais tronqué (P4 d'OpenCode).
- Téléphone : « Touche » au lieu de « Clique », pastille du panneau qui ne fait plus déborder la carte, pastilles et touches à 12 px.
- Une commande du chef portant plusieurs ordres fait venir chaque agent visé, et plus seulement le premier.

## [0.3.0] - 17 octobre 2026

### Ajouté

- File d'attente intelligente et sécurisée :
  - Bouton « Mettre en file » accessible sur le poste lorsqu'un agent est occupé ou en pause de quota.
  - Liste de la file d'attente dans l'onglet Équipe avec affichage des cibles, de l'état et bouton de retrait unitaire.
  - Relance automatique planifiée 5 minutes après l'heure de remise à zéro annoncée par l'outil (`remise à zéro + 5 min`).
  - Protection renforcée contre les doubles envois (clé d'idempotence, statut d'envoi persistant avant tout appel externe, écriture atomique sur disque et fichier corrompu préservé).
- Onglet Tâches :
  - Suivi des cases réelles cochées dans les fichiers de documentation du projet (`TODO.md`).
  - Suivi des plans d'action publiés par les agents dans leurs journaux locaux.
  - Calcul d'une progression stricte basée sur les faits observés, sans aucune estimation inventée.
- Panneau d'aide escamotable :
  - Volet latéral d'aide ouvert via le bouton dédié ou la touche `?`, activé lors de la première visite.
  - Visite guidée en 5 étapes, guide des zones, postures et couleurs de la scène, table complète des raccourcis clavier.
  - Commandes d'activation des signaux (notifications de bureau et sons).
- Palette de commandes modale (`Ctrl+K`) :
  - Fenêtre de recherche rapide avec navigation au clavier pour ouvrir un poste, rédiger une consigne, explorer les fichiers ou changer de mode.
- Module sonore Web Audio 8 bits (`public/sounds.js`) :
  - Synthétiseur audio autonome sans fichier externe proposant 4 alertes discrètes (< 0,6 s, gain max 0,05) : fin de travail ('mail'), agent en attente ('blocked'), pause de quota ('pause') et délégation ('delegation').
  - Mémorisation du choix d'activation dans `localStorage` sous la clé `bureau.sons`.
- Notifications de bureau Windows :
  - Alertes système lorsque la page est en arrière-plan pour signaler les blocages, les fins de mission et les pauses de quota.
- Cycle jour-nuit continu et ambiance lumineuse :
  - Dégradé de ciel continu selon l'heure exacte du poste (nuit, aube, jour, crépuscule) avec disparition progressive des étoiles et des fenêtres allumées.
  - Arc horaire pour la lune et le soleil (soleil orangé près de l'horizon).
  - Éclairage dynamique de la pièce, du bureau Direction et de la salle de réflexion, avec lever fixe à 6 h 30 et coucher fixe à 19 h 30 (approximation sans saisons).
- Salle de réflexion repliable :
  - Animation des sous-agents en pièce dédiée avec commande de repli pour adapter la scène aux petits écrans.
- Bureau Direction :
  - Espace de travail valorisé pour le premier agent démarré dans Herdr (le chef d'équipe), avec pile de courriers cliquable ouvrant directement l'onglet Équipe.
- Cycle de délégation et courriers du chef :
  - Détection des ordres de délégation (`herdr agent prompt`), déplacement de l'agent cherchant sa mission et envoi du courrier au chef remis à zéro dès consultation.

### Modifié

- Synthèse de revue de design appliquée (décisions D1 à D8) :
  - D1 : État principal unifié « En pause (limite) » partout (cartes d'agents, fiches de poste, palette de commandes) quand la pause est observée.
  - D2 : Barre d'aide à la disposition (`.layout-bar`) placée sur sa propre ligne sous la barre d'outils pour éviter tout chevauchement avec l'alerte d'attention.
  - D3 : Cartes d'agents restructurées sur deux lignes (nom puis statut) avec identifiant Herdr en pastille compacte (`.pane-pill`) et passage en grille de 2 colonnes sous 1360 px pour empêcher toute troncature.
  - D4 : Onglet Équipe épuré avec une seule phrase synthétique par section et compteurs d'éléments directement dans les titres (`#mail-count`, `#queue-count`).
  - D5 : Terminal de l'onglet Poste dimensionné pour occuper toute la hauteur disponible, enrichi d'un bouton « Agrandir » / « Réduire » (`#term-expand`) pour une lecture confortable.
  - D6 : Blocs d'erreur unifiés avec message explicite et bouton « Actualiser le bureau » ; intégration de 6 icônes d'états vides pixel art 16x16 (`public/empty-icons.js`) remplaçant les listes silencieuses.
  - D7 : Vue d'accueil engageante dans l'onglet Poste (`#poste-empty`) invitant à choisir un agent avec sélection directe par boutons rapides.
  - D8 : Composition responsive mobile ajustée et validée à 390 et 360 px de largeur sans débordement horizontal.
- Extension de la suite de tests automatisés : 161 tests au total (159 réussis, 2 ignorés sur liens symboliques Windows, 0 échec).

## [0.2.0] - 17 octobre 2026

### Ajouté

- Pilotage par onglets : Séparation claire du panneau latéral en deux vues distinctes, « Poste » (dédié à l'agent sélectionné) et « Équipe » (dédié à la coordination collective).
- Outils de terminal :
  - Recherche textuelle en direct avec surlignage des correspondances et compteur d'occurrences.
  - Bouton « Figer » permettant d'interrompre le défilement automatique pour lire calmement du code ou une trace d'erreur.
  - Bouton « Copier » plaçant l'intégralité du texte du terminal dans le presse-papier.
  - Mise en pause automatique de l'actualisation dès qu'une sélection de texte est active à la souris.
- Ergonomie et raccourcis clavier :
  - Raccourci Ctrl+Entrée (ou Cmd+Entrée) pour envoyer rapidement une consigne individuelle ou un message groupé.
  - Bouton « Cocher tous les disponibles » dans l'onglet Équipe pour sélectionner en un clic tous les agents prêts.
  - Navigation accessible au clavier entre les onglets à l'aide des flèches gauche et droite.
- Tour de contrôle en plein écran : Le mode plein écran englobe désormais toute la zone principale, gardant ensemble la scène pixel et le panneau de pilotage interactif.
- Identification des fenêtres Herdr : L'identifiant précis du panneau (par exemple `w5:p1` ou `w5:p4`) est désormais affiché sur chaque carte d'agent et dans l'en-tête de détail.
- Expérience mobile : Sélectionner un agent sur écran étroit (< 860 px) active l'onglet Poste et fait défiler la page de manière fluide jusqu'au panneau de commande.
- Indicateurs visuels réels :
  - Pastilles récapitulatives dans la barre du haut comptant en temps réel les agents au travail, en attente et disponibles.
  - Bandeau d'alerte jaune dès qu'un agent attend une décision avec bouton direct « Ouvrir son poste ».
  - Journal des envois de la session consignant l'historique et le statut de chaque message transmis.
- Chef d'équipe et bureau VIP : Le premier agent démarré dans Herdr est reconnu comme chef de l'équipe (« boss ») et bénéficie d'un bureau VIP mis en valeur dans la scène pixel art.
- Cycle de délégation et courriers : Observation des ordres de délégation (`herdr agent prompt`) dans le journal du chef, déplacement de l'agent pour récupérer sa mission, puis envoi d'un courrier au chef à l'achèvement de la tâche avec humeur calquée sur les faits.
- Salle de réflexion : Pièce animée dédiée accueillant les sous-agents en phase d'analyse avant qu'ils ne rapportent leur dossier au poste principal.
- Explorateur de fichiers intégré : Consultation sécurisée de l'arborescence des fichiers du projet (`src/files.mjs` et API `/api/files`), strictement confinée au dossier local sans risque d'écrasement ni de suppression.
- Télémétrie Codex et OpenCode : Lecture des configurations et journaux locaux réels (`src/agent-activity.mjs`) venant compléter le suivi de Claude sans fabriquer de données.
- Règle de vérité des faits : Règle fondamentale interdisant toute invention de tâche, de pourcentage ou d'humeur ; seules les données observables sont affichées, et les erreurs réelles alimentent `LESSONS.md`.
- Suivi de Claude : Lecture de son journal local pour remonter sa consommation réelle de jetons (produits, lus, en cache) et affichage de ses sous-agents sous forme de petits assistants sur son bureau.
- Suite de tests : Extension à 90 tests automatisés validant l'ensemble des modules (serveur, Herdr, activité Claude/Codex/OpenCode, explorateur de fichiers et protection d'origine).
- Sauvegarde de référence : Version stabilisée et enregistrée au commit `7817574`.

## [0.1.0] - 17 octobre 2026

### Ajouté

- Version initiale du Bureau des agents par DrSmoke et l'équipe d'agents.
- Scène animée en pixel art dans un canvas basse résolution agrandi proprement, respectant les styles graphiques choisis.
- Ciel en baie vitrée synchronisé avec l'horloge réelle de l'ordinateur (nuit, aube, jour, crépuscule).
- Raccordement local direct aux agents détectés par Herdr via l'outil en ligne de commande.
- Postures visuelles fidèles aux états réels : frappe au clavier au travail, mug en main quand disponible, main levée en attente.
- Logos en pixels 16x16 pour Claude, Codex, Antigravity et OpenCode.
- Système d'envoi unitaire protégé par jeton éphémère (`X-Bureau-Token`) interdisant l'envoi à des agents occupés.
- Envoi groupé sécurisé avec mécanisme de confirmation en deux étapes (bouton armé).
- Sauvegarde automatique des brouillons de consigne lors du passage d'un agent à un autre.
- Serveur HTTP local autonome sans aucune dépendance npm, restreint à l'adresse 127.0.0.1.
- Scripts de démarrage rapide pour Windows (`Ouvrir le bureau.cmd` et `Ouvrir le bureau.ps1`).
