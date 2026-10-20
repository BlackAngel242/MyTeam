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

**Ce que je vois :** la fiche Codex annonce « Disponible » avec un point menthe, puis « Limite atteinte », un retour à HH:MM et une relance à HH:MM. La scène le présente en pause, tandis que la palette affiche encore « Disponible ». Il faut interpréter plusieurs informations pour savoir si une consigne peut partir.

**Proposition :** afficher partout un état principal « En pause de limite » lorsque cette limite est réellement observée. Dans la fiche, distinguer explicitement « Retour annoncé : heure du terminal » et « Reprise des envois prévue : retour + 5 min ». Conserver « Herdr : disponible » dans les informations détaillées. La carte, le personnage, la palette et l'action d'envoi doivent utiliser la même lecture pratique, sans effacer la donnée brute. Ne pas inventer d'heure si l'outil n'en fournit pas.

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

## Contre-évaluation

Relecture du 17 octobre 2026 après application de D1 à D8. Les treize captures régénérées ont été rouvertes individuellement, ainsi que `telephone-390.png`, `telephone-360.png` et `planche-heures.png`, soit seize images examinées. Deux lectures visuelles indépendantes Impeccable ont complété la comparaison. Les résultats Playwright annoncés par Claude restent distincts de cette observation : les images permettent de juger la composition, pas de certifier le clavier, les gestes, le défilement ou les envois.

### État des six propositions

1. **Composition sur téléphone : résolue.** Dans `telephone-390.png` et `telephone-360.png`, tous les postes apparaissent dans une scène verticale complète, les cartes sont sur deux colonnes et le panneau passe dessous. Aucun élément ne déborde visiblement à droite. Dans `telephone.png`, l'alerte reprend toute la largeur avec un texte lisible et un bouton entier ; Disposer et Plein écran ont leur rangée. L'ancien écrasement est corrigé. Le parcours reste long, comme détaillé ci-dessous.

2. **État « disponible » cohérent : résolue.** `onglet-poste-codex.png` indique maintenant « En pause (limite) » et utilise un point violet. `palette.png` reprend cet état ; la scène et la carte de `scenario-1440.png` présentent aussi la pause. La fiche distingue le retour à HH:MM de la relance prévue à HH:MM. La contradiction principale avec « Disponible » a disparu. La présentation des différentes limites mérite encore une clarification.

3. **Cadrage comme outil de lecture : partielle.** Les noms des cartes sont complets dans `reel-1280.png`, avec l'état sur une autre ligne et une pastille Herdr séparée. La disposition mobile garde les agents visibles. Cependant, à 1280 les personnages et leurs textes de scène restent petits ; mur, Direction et salle de réflexion occupent encore une grande surface. Dans `scenario-scene-zoom.png`, les deux sous-agents ne portent toujours pas de repère les rattachant explicitement à Claude. Les captures ne permettent pas de vérifier la conservation d'une disposition personnalisée, ni la réduction de la salle lorsqu'elle est vide : elle est occupée dans les vues examinées.

4. **Panneau centré sur l'action : partielle.** Dans les trois vues réelles, le grand terminal vide et le formulaire inutilisable sont remplacés par une invitation courte et des choix directs d'agents. Dans `onglet-equipe.png`, les longs paragraphes ont été nettement raccourcis et le champ de message commence désormais dans le cadrage. Dans `onglet-poste-codex.png`, Agrandir est visible à côté des outils du terminal. En revanche, la zone de consigne commence toujours au bord inférieur de la capture et son bouton n'y apparaît pas. Cette image seule ne démontre pas que l'action est plus facile à atteindre ou que le terminal agrandi fonctionne.

5. **Barre du mode Disposer : résolue.** `mode-disposer.png` sépare clairement l'alerte et les boutons de la ligne « Disposition : glisse les postes… ». Réinitialiser, Terminer et Plein écran sont lisibles, sans la superposition précédente. Petite réserve de finition : le libellé « En pause HH:MM » dépasse légèrement le cadre de manipulation de Codex ; le cadre pourrait englober tout le poste et son texte.

6. **Erreurs distinctes des listes vides : partielle.** `onglet-taches.png` et `onglet-fichiers.png` affichent un encart ambre avec Actualiser le bureau, puis « Plans non chargés » ou « Destinations non chargées ». L'ancienne conclusion trompeuse sur une liste vide a disparu. Mais Fichiers conserve aussi la ligne « Session expirée. Actualise le bureau. » juste au-dessus de l'encart qui répète le même message. La correction de fond est visible ; la présentation n'est pas encore nettoyée.

### Les trois défauts restants les plus visibles

1. **Un long trajet avant de lire ou écrire sur téléphone.** Dans `telephone-390.png` et `telephone-360.png`, l'en-tête, les outils, le décor, Direction, les postes et la salle précèdent les cartes et le panneau. Les mêmes agents sont ensuite proposés une deuxième fois dans l'invitation du panneau. Conserver la scène comme vue d'ensemble, mais proposer un accès explicite au poste choisi et un mode de scène compacte ; éviter de répéter les choix lorsque les cartes sont déjà immédiatement au-dessus. Le gain recherché est un accès plus court, sans cacher les agents ni rogner leurs noms.

2. **Une pause de quota difficile à expliquer.** Dans `onglet-poste-codex.png`, « Limite atteinte » est suivi de une autre réserve de quota. Ces données peuvent concerner des limites différentes, mais rien dans le cadrage ne l'explique. Nommer la limite qui bloque et séparer les autres réserves, uniquement si la source fournit cette distinction. Sinon, indiquer que le motif détaillé n'est pas disponible. Ne pas déduire qu'une valeur est fausse à partir de cette seule image.

3. **Une erreur répétée et des instructions devenues peu utiles.** Dans `onglet-fichiers.png`, la session expirée est annoncée deux fois ; « Déposer dans » et l'explication du glisser-déposer restent affichés alors que les destinations ne sont pas chargées. Garder un seul encart de reprise, puis une indication courte sur les données indisponibles. Réafficher les explications de transfert avec les destinations, sans suggérer qu'un transfert est possible pendant l'erreur.

### Cycle jour-nuit

`planche-heures.png` montre désormais des ambiances distinctes à 06:45, 10:00, 13:30, 18:30, 19:45 et 23:00 : ciel plus clair en journée, position de l'astre différente, éclairage intérieur variable et nuit étoilée. Les captures de journée ont aussi une pièce nettement plus claire que lors de la première revue. La demande de rendre le jour perceptible est donc satisfaite visuellement. Cela ne constitue pas une vérification astronomique de la trajectoire ni des transitions animées.

Seule cette section a été ajoutée au document ; aucun fichier d'interface modifié.
