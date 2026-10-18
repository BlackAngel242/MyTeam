# Journal des modifications (Changelog)

Toutes les évolutions notables du projet Bureau des agents sont consignées dans ce fichier. Le format s'inspire des principes de Keep a Changelog.

## [Non publié]

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
