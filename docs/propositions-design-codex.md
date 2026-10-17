# Propositions de design de Codex

Revue du 17 octobre 2026, avant décision collective. Les treize PNG ont été ouverts et examinés individuellement : `reel-1920`, `reel-1440`, `reel-1280`, `scenario-1440`, `scenario-scene-zoom`, `onglet-poste-codex`, `onglet-equipe`, `onglet-fichiers`, `onglet-taches`, `aide`, `palette`, `mode-disposer`, `telephone`.

Les trois captures réelles montrent des instants différents. Les captures de scénario servent à juger la présentation des états, pas à affirmer l'activité actuelle des agents. Une image fixe ne permet pas de vérifier une animation, le clavier ou le comportement du défilement. Deux lectures indépendantes Impeccable ont complété cette analyse visuelle. Aucun changement d'interface n'est proposé comme déjà réalisé.

## Ce qui fonctionne visuellement

- **Une identité reconnaissable.** Le bleu nuit, la baie vitrée, les écrans lumineux et les personnages en pixels forment un vrai lieu. Les logos sur les bureaux permettent de repérer les outils sans transformer toute la page en tableau de chiffres.
- **Les états ont un langage visuel concret.** Dans `scenario-1440` et `scenario-scene-zoom`, la main levée d'Antigravity, le poste vide de Codex avec son chevalet « RETOUR », et OpenCode devant son écran donnent des indices différents. Les textes complètent la couleur. Il faut préserver cette combinaison.
- **La hiérarchie du lieu est comprise.** Le bureau Direction distingue Claude ; les deux petits personnages occupent une salle dédiée. La scène raconte l'organisation sans ajouter de décor spectaculaire étranger au produit.
- **Le cadre général est déjà plus efficace.** À 1440 et 1920, l'en-tête tient sur une ligne ; dans le scénario, l'alerte est intégrée à la barre de la scène. Les boutons sous le bureau gardent une alternative lisible aux personnages.
- **Les outils secondaires ont leur place.** Les onglets sont nets, le terminal distingue erreur et demande de réponse, la palette de commandes présente une sélection claire et ses touches, et l'aide reste dans un panneau latéral sans remplacer le bureau.

## Les six propositions, par différence attendue

### 1. Donner au téléphone une composition réellement adaptée

**Capture :** `telephone.png`.

**Ce que je vois :** la scène et ses outils dépassent le bord droit. Le bandeau d'attente est réduit à une forme verticale ; le texte « Ouvrir le poste de Antigravity » déborde de son bouton. La capture montre surtout le décor et Claude, sans vue d'ensemble des autres postes.

**Proposition :** sur téléphone, empiler un en-tête court, une alerte pleine largeur, une scène complète à l'échelle et la sélection des agents. Mettre « Disposer » et « Plein écran » sur une rangée séparée. Après sélection, proposer un accès direct « Lire le poste » ; afficher le panneau sous la scène plutôt que conserver les dimensions de l'ordinateur. Garder les pixels nets avec un dessin adapté, sans étirement ni découpe des agents.

**Effort : moyen.** À préserver : des boutons faciles à toucher et l'accès à tous les agents, même si leur scène devient petite.

### 2. Unifier ce que signifie « disponible »

**Captures :** `onglet-poste-codex.png`, `scenario-1440.png`, `palette.png`.

**Ce que je vois :** la fiche Codex annonce « Disponible » avec un point menthe, puis « Limite atteinte », un retour à 14:58 et une relance à 15:03. La scène le présente en pause, tandis que la palette affiche encore « Disponible ». Il faut interpréter plusieurs informations pour savoir si une consigne peut partir.

**Proposition :** afficher partout un état principal « En pause de limite » lorsque cette limite est réellement observée. Dans la fiche, distinguer explicitement « Retour annoncé : 14:58 » et « Reprise des envois prévue : 15:03 ». Conserver « Herdr : disponible » dans les informations détaillées. La carte, le personnage, la palette et l'action d'envoi doivent utiliser la même lecture pratique, sans effacer la donnée brute. Ne pas inventer d'heure si l'outil n'en fournit pas.

**Effort : moyen.** À préserver : la différence entre l'état de l'agent et l'autorisation effective de lui envoyer une consigne. Une pause de quota ne doit pas avoir le même signal qu'une réponse attendue de DrSmoke.

### 3. Faire du cadrage de la scène un outil de lecture

**Captures :** `reel-1920.png`, `reel-1440.png`, `reel-1280.png`, `scenario-scene-zoom.png`.

**Ce que je vois :** à 1920 les postes sont généreux ; à 1440, le mur et le sol prennent beaucoup de place autour de personnages plus petits. La salle de réflexion reste présente même vide. À 1280, les boutons tronquent les noms d'Antigravity et d'OpenCode. Les deux sous-agents du scénario sont visibles, mais leur rattachement ne se lit pas directement.

**Proposition :** prévoir une composition compacte et une composition large, choisies selon la place disponible. Réduire d'abord les surfaces de mur et de sol vides, jamais les libellés utiles. Lorsque la salle est vide, lui réserver une bande discrète ; lorsqu'elle contient des sous-agents observés, la développer avec « Sous-agents de Claude · 2 ». Garder une sélection des postes à noms lisibles, éventuellement sur deux lignes. Préserver les positions personnalisées et proposer explicitement le retour à la disposition automatique.

**Effort : grand.** À préserver : tous les postes dans le cadre, les proportions des pixels et la tranquillité du décor. Ne pas agrandir en coupant les bords, ni dessiner des relations non attestées.

### 4. Organiser le panneau autour de l'action en cours

**Captures :** `reel-1440.png`, `onglet-poste-codex.png`, `onglet-equipe.png`, `aide.png`.

**Ce que je vois :** sans sélection, une grande partie du panneau présente un terminal vide et un formulaire inutilisable. Avec Codex sélectionné, la consigne commence seulement au bas de la capture. Dans Équipe, deux longs paragraphes précèdent les cibles et repoussent le message. L'aide possède déjà l'espace nécessaire pour les explications détaillées.

**Proposition :** avant sélection, montrer une invitation courte et les agents à choisir. Dans Poste, garder nom, état utile et éventuelle alerte en haut, donner la place centrale au terminal, puis une zone de consigne compacte et extensible. Dans Équipe, présenter d'abord « Courrier », « File d'attente » et leurs éléments réels ; remplacer chaque paragraphe permanent par une phrase et un accès à l'aide. Conserver immédiatement visibles la cible de l'envoi, les restrictions et sa confirmation.

**Effort : moyen.** À préserver : les avertissements de sécurité et les longues consignes. Ne pas gagner de place en réduisant la taille des caractères ou en empilant des zones qui défilent chacune séparément.

### 5. Donner au mode Disposer sa propre barre de commandes

**Capture :** `mode-disposer.png`.

**Ce que je vois :** le texte d'aide menthe, l'alerte et son bouton se superposent dans la barre supérieure. « Vue du bureau » et « Plein écran » passent sur deux lignes. Les cadres des postes et la poignée dorée sont, eux, de bons repères de manipulation.

**Proposition :** en mode Disposer, remplacer la barre habituelle par « Disposition » et trois commandes claires : « Réinitialiser », « Terminer », « Plein écran ». Placer l'aide de déplacement sur une ligne réservée juste dessous. Garder une alerte compacte séparée qui reste consultable, avec son accès au poste concerné. Ne jamais recouvrir une commande avec une consigne d'utilisation.

**Effort : petit.** À préserver : la visibilité d'une attente réelle pendant la manipulation et une sortie du mode facile à retrouver.

### 6. Faire des erreurs des états visuels compréhensibles

**Captures :** `onglet-fichiers.png`, `onglet-taches.png`.

**Ce que je vois :** « Session expirée. Actualise le bureau. » apparaît comme un simple paragraphe. Fichiers continue avec « Déposer dans » sans destination ; Tâches indique « Aucun plan publié » après l'erreur. Ces présentations peuvent faire croire que la lecture a réussi et que les listes sont vides.

**Proposition :** utiliser un bloc d'erreur commun, bien distinct d'un résultat vide : « Lecture indisponible : session expirée », suivi d'un bouton « Actualiser le bureau ». Tant que la lecture échoue, afficher « Plans non chargés » et « Destinations non chargées » plutôt que conclure à leur absence. Rendre les actions dépendantes visiblement indisponibles. Si des données précédentes sont conservées, les dater et les signaler comme anciennes.

**Effort : moyen.** À préserver : la vérité de ce qui a pu être lu. Un clic d'actualisation ne doit déclencher ni envoi, ni transfert, ni validation dans Herdr.

## Une idée audacieuse : le bureau devient le fond d'un petit système d'exploitation d'agents

Faire de chaque poste une entrée vers une **fenêtre de travail**, avec le nom de l'agent et son état réel dans la barre de titre. DrSmoke pourrait épingler le terminal de Codex et les fichiers d'OpenCode côte à côte, puis revenir d'un clic au bureau animé. Une barre basse réunirait les fenêtres ouvertes et les accès Équipe, Fichiers et Tâches. La palette actuelle servirait de lanceur et l'aide de panneau système.

Pour garder ce système simple, commencer par deux emplacements de fenêtres ajustables, plutôt que des fenêtres libres qui se cachent mutuellement. Sur téléphone, une seule fenêtre à la fois, avec retour au bureau. La scène continue à montrer uniquement les agents détectés ; les courriers, sous-agents et pauses viennent toujours d'événements observés. Une attente de réponse ouvre le poste ou indique Herdr, elle ne répond jamais à la place de DrSmoke.

**Effort : grand.** Le bénéfice serait de passer d'un beau tableau de surveillance à un espace où lire, comparer et préparer le travail. Cette idée vient après les six améliorations : elle ne doit pas ajouter de commandes automatiques ni rendre l'interface plus encombrée.
