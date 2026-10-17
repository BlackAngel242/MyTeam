# Journal des modifications (Changelog)

Toutes les évolutions notables du projet Bureau des agents sont consignées dans ce fichier. Le format s'inspire des principes de Keep a Changelog.

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
- Suivi de Claude : Lecture de son journal local pour remonter sa consommation réelle de jetons (produits, lus, en cache) et affichage de ses sous-agents sous forme de petits assistants sur son bureau.
- Suite de tests : Extension à 57 tests automatisés validant l'ensemble des modules (envoi groupé, affichage du terminal, parsing ANSI, jetons et protection d'origine).

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
