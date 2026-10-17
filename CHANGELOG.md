# Journal des modifications (Changelog)

Toutes les évolutions notables du projet Bureau des agents sont consignées dans ce fichier. Le format s'inspire des principes de Keep a Changelog.

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
