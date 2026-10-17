# Propositions de design et d'interface pour le Bureau des agents

Par Antigravity (panneau w5:p2), revue de design du 17 octobre 2026 à partir des 13 captures d'écran réelles du dossier `captures/revue-design/`.

---

## 1. Ce qui fonctionne remarquablement sur le plan visuel

L'orientation esthétique retenue donne une âme et une personnalité uniques au projet :

- **Ambiance bleu nuit et cohérence pixel art** : Le contraste entre le fond sombre bleuté (`#0c1423`), les textures feutrées du mobilier et les aplats lumineux des écrans crée une atmosphère de salle de contrôle chaleureuse et rétro. L'image de nuit à travers la baie vitrée avec l'éclairage de la lune et la skyline illumine élégamment le haut de la pièce.
- **Lisibilité immédiate des statuts opérationnels** : Dans `scenario-scene-zoom.png`, l'état de chaque agent se comprend en une fraction de seconde sans lire le texte : la posture au clavier pour OpenCode, la main levée avec la bulle point d'interrogation pour Antigravity, et surtout le chevalet blanc « RETOUR 14:58 » sur le bureau éteint de Codex qui matérialise la pause de quota avec une élégance parfaite.
- **Narratif visuel vivant et authentique** : La mise en valeur du chef au bureau Direction avec sa moquette violette et l'animation des deux petits sous-agents installés dans la salle de réflexion vitrée (avec leur bulle d'échange) incarnent la vie d'équipe sans jamais trahir la réalité des processus.
- **Palette de commandes (`palette.png`) et aide (`aide.png`) de très haute tenue** : La fenêtre modale `Ctrl+K` présente une hiérarchie typographique limpide, avec ses touches d'action (`Entrée`, `Échap`) bien ancrées en bas. Le panneau d'aide latéral s'intègre naturellement avec un découpage par étapes très lisible.

---

## 2. Les 6 propositions de design et d'interface prioritaires

Voici les 6 chantiers graphiques et ergonomiques les plus décisifs, classés par impact utilisateur.

### Proposition 1 : Résoudre la collision entre la bannière d'alerte et les outils de scène
- **Captures concernées** : `mode-disposer.png`, `telephone.png` et `scenario-1440.png`.
- **Ce que l'on voit** : La bannière d'alerte jaune « Antigravity attend ta réponse dans Herdr » a été insérée à l'intérieur de la barre supérieure du cadre de la scène (`.office-top`). En mode disposer, le texte d'aide jaune-vert (« Glisse les postes... ») s'affiche exactement au même endroit : les deux messages se superposent en un fouillis totalement illisible. Sur smartphone (`telephone.png`), la bannière est broyée verticalement en un moignon tronqué derrière le bouton Disposer.
- **Proposition concrète** : Extraire la bannière d'alerte de `.office-top`. La placer en bandeau d'alerte transversal autonome juste en dessous de la barre d'en-tête globale (`.topbar`), ou la traiter sous forme de notification flottante (« toast ») soignée ancrée en haut à droite. La barre de scène retrouvera sa fonction unique : afficher le titre de la vue et les boutons d'action de la scène.
- **Effort** : Petit (ajustement de structure HTML et CSS flexbox).

### Proposition 2 : Alléger la surcharge de textes explicatifs dans l'onglet Équipe
- **Capture concernée** : `onglet-equipe.png`.
- **Ce que l'on voit** : Trois longs paragraphes d'instructions statiques (décrivant le courrier du chef, le rôle de la file d'attente et le principe du message groupé) occupent plus de 60 % de la hauteur du panneau latéral. Les éléments d'interaction réels (cases à cocher des agents, champ de consigne, bouton d'envoi) sont relégués tout en bas et exigent un défilement constant.
- **Proposition concrète** : Réduire chaque explication à une seule ligne sobre ou remplacer ces pavés par de petites icônes discrètes d'information au survol. Présenter les sections sous forme de cartes repliables avec indicateurs de quantité (« Courrier du chef (0) », « File d'attente (0) ») pour que le formulaire de consigne collective soit immédiatement accessible sans défiler.
- **Effort** : Petit (allègement rédactionnel et style compact).

### Proposition 3 : Éviter la troncature des noms et identifiants de panneaux à 1280 px
- **Capture concernée** : `reel-1280.png`.
- **Ce que l'on voit** : Sur un écran de 1280 pixels de large (très fréquent sur PC portable), les boutons d'agents sous le bureau compriment excessivement le texte : « Antigra... Disponible · w... » et « OpenCo... Au travail · w... ». L'identifiant du panneau Herdr (`w5:p2`, `w5:p3`), indispensable pour faire le lien avec la fenêtre physique, disparaît derrière les points de suspension.
- **Proposition concrète** : Isoler l'identifiant Herdr dans une petite pastille distincte (badge bleu-gris) alignée à droite de la carte, et autoriser le nom de l'agent à occuper sa propre ligne au-dessus du statut. Si la largeur est inférieure à 1360 px, passer la grille en deux colonnes de deux cartes plutôt qu'une rangée unique de quatre cartes comprimées.
- **Effort** : Moyen (ajustement de la grille CSS et du gabarit des cartes).

### Proposition 4 : Donner plus de respiration verticale au terminal dans l'onglet Poste
- **Capture concernée** : `onglet-poste-codex.png`.
- **Ce que l'on voit** : La fiche détaillée de Codex présente un bloc de statut très haut (encart d'alerte de reprise à 14:58, modèle GPT-6.1-Sol, jauge de limite 5h à 37 %, avertissements, horodatage). En conséquence, la zone du terminal monospace (« Dernières sorties ») est écrasée sur moins de 150 pixels de hauteur, ne laissant voir que 7 ou 8 lignes de journal à la fois.
- **Proposition concrète** : Compacter la télémétrie en une barre d'état dense de deux lignes (pastilles horizontales pour le modèle, l'effort et la jauge de limite), et offrir un bouton d'agrandissement (« Pleine hauteur » ou « Console étendue ») permettant d'étirer le terminal pour afficher confortablement 25 à 30 lignes de logs lors des sessions de débogage.
- **Effort** : Moyen (réorganisation de `.statusbar` et option d'expansion du terminal).

### Proposition 5 : Remplacer les messages d'expiration par de véritables états vides illustrés
- **Captures concernées** : `onglet-fichiers.png` et `onglet-taches.png`.
- **Ce que l'on voit** : Lorsque le bureau perd son jeton ou qu'aucun plan n'est chargé, les onglets affichent une phrase brute et austère : « Session expirée. Actualisez le bureau. » perdue au milieu d'un grand désert bleu foncé, sans aucun bouton d'action pour remédier à la situation.
- **Proposition concrète** : Concevoir un composant d'état vide (« Empty State ») chaleureux avec une petite icône pixel art (classeur vide pour les fichiers, sablier pour les tâches, prise débranchée pour l'expiration) et un bouton d'action direct bien visible (« Actualiser le bureau » ou « Reconnecter la session »).
- **Effort** : Petit (création d'un patron visuel réutilisable).

### Proposition 6 : Repenser la disposition mobile en vue carrousel plutôt qu'en zoom écrasé
- **Capture concernée** : `telephone.png`.
- **Ce que l'on voit** : Sur écran de smartphone, le canvas pixel art tente d'afficher toute la largeur de la scène en la réduisant fortement, ce qui coupe la moitié des fenêtres et force un zoom disproportionné sur le bureau Direction, tout en repoussant les agents et le panneau de commande très bas dans la page.
- **Proposition concrète** : Sur écran inférieur à 600 px, abandonner le rendu miniaturisé de la scène globale. Proposer à la place une vue en carrousel horizontal où l'utilisateur fait glisser son doigt (swipe) d'un poste à l'autre, avec la fiche détaillée et le terminal directement sous le poste sélectionné, complétée par une barre d'onglets fixe au pouce tout en bas de l'écran.
- **Effort** : Grand (adaptation responsive dédiée au mobile).

---

## 3. L'idée audacieuse : Le « Tiling Desk OS » (Bureau en tuiles interactives)

Pour transformer le Bureau des agents en un véritable système d'exploitation d'agents :

Plutôt que d'enfermer le bureau dans une mise en page fixe (scène à gauche, panneau fixe à droite), adopter une logique de **bureau en tuiles modulaires** :

1. **Tuiles détachables** : Chaque poste d'agent, terminal de sortie ou liste de fichiers peut être agrandi ou épinglé côte à côte en un clic. DrSmoke peut ainsi afficher simultanément sur un même écran le bureau animé, le terminal en direct du chef Claude à gauche, et le terminal de Codex ou OpenCode à droite pendant une délégation.
2. **Dock inférieur persistant** : Une barre de tâches façon système d'exploitation en bas d'écran affiche la miniature active de chaque agent avec une micro-jauge de progression de son contexte et une pastille d'alerte interactive.
3. **Glisser-déposer de missions** : DrSmoke peut glisser un fichier ou une consigne directement depuis l'explorateur sur le bureau d'un agent dans la scène pour lui assigner la tâche instantanément.
