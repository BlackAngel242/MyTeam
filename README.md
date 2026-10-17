# Bureau des agents

Un tableau de bord immersif et vivant en pixel art pour surveiller, lire et piloter vos équipes d'agents d'intelligence artificielle autonomes exécutés dans Herdr.

![Aperçu du Bureau des agents](docs/captures/apercu-bureau.png)
> *Aperçu de la scène animée et du panneau de pilotage du Bureau des agents (capture en cours d'intégration).*

## Pour qui et pourquoi ?

Le Bureau des agents a été conçu pour les développeurs, créateurs et orchestrateurs qui font collaborer plusieurs agents d'IA (Claude, Codex, Antigravity, OpenCode) en parallèle et souhaitent garder une vision claire de leur atelier sans jongler entre plusieurs fenêtres de terminal.

- Une scène vivante et fidèle : Vos agents prennent vie à leurs postes de travail avec des postures réelles (frappe active au travail, mug quand disponible, main levée quand ils attendent une réponse).
- Ambiance connectée : La grande baie vitrée s'adapte en temps réel à l'heure de votre ordinateur (nuit, aube, plein jour ou crépuscule), et les écrans éclairent le sol aux couleurs de leur état.
- Console de pilotage intégrée : Lisez les sorties de terminal en temps réel, surlignez des termes de recherche, figez le flux pour copier un extrait, et transmettez vos consignes en un éclair avec Ctrl+Entrée.
- Coordination d'équipe : Envoyez des consignes individuelles ou ciblez plusieurs agents disponibles en même temps grâce à l'envoi groupé sécurisé en deux clics.
- Respect de la vie privée et sobriété : 100% local (127.0.0.1), sans télémétrie, et zéro dépendance npm. Tout fonctionne avec la bibliothèque standard de Node.js.

## Ouvrir le bureau (sur cet ordinateur)

Double-cliquer sur « Ouvrir le bureau.cmd », ou ouvrir un terminal dans ce dossier et lancer :

```powershell
node server.mjs
```

Puis ouvrir `http://127.0.0.1:4317` dans le navigateur. Herdr doit être ouvert. Rien à installer : Node.js est déjà présent sur cet ordinateur, sans bibliothèque ni abonnement supplémentaire.

## Installer sur un autre ordinateur

Pour déployer le Bureau des agents sur une autre machine sous Windows, Linux ou macOS :

- Consultez le guide pas à pas dans [docs/INSTALLATION.md](docs/INSTALLATION.md).
- Utilisez les scripts d'installation automatique mis à disposition dans le dossier [scripts/](scripts/).
- Rappel : Aucun paquet externe n'est nécessaire (`npm install` est inutile). Il suffit de disposer de Node.js (version 22 ou supérieure) et de Herdr.

## Lire la scène

- Décor et ambiance : La baie vitrée suit l'heure réelle de ton ordinateur (nuit, aube, jour, crépuscule). La baie HERDR clignote tant que la liaison locale est active. Les écrans projettent au sol une lueur de la couleur de l'état de chaque agent.
- Postes et personnages : Chaque poste arbore en façade le logo en pixels de son outil (Claude, Codex, Antigravity, OpenCode). Les silhouettes restent stables pour identifier chaque poste d'un coup d'œil.
- Postures visibles : Frappe au clavier quand l'agent est au travail, mug en main quand il est disponible, main levée quand il attend une réponse de ta part.
- Bulles d'état : Bulle jaune « ? » quand l'agent attend une consigne ou une autorisation, coche verte quand il vient de terminer, points de suspension « ... » pour un état inconnu. Une légère animation festive apparaît pendant quelques secondes dès qu'un agent passe du travail à la disponibilité.
- Couleurs d'état : Bleu pour le travail, menthe pour disponible ou terminé, ambre pour l'attente, gris pour un état inconnu.
- Bandeau d'alerte et compteurs : En haut de page, des pastilles comptent les agents au travail, en attente et disponibles. Une alerte en bandeau signale immédiatement tout agent bloquant pour ouvrir son poste en un clic.
- Identification des panneaux Herdr : L'identifiant précis du panneau Herdr (par exemple w5:p1 ou w5:p4) apparaît directement sous le nom de chaque agent dans la liste, ainsi que dans les détails de son poste.

## Onglet Poste

- Navigation mobile : Sur téléphone ou écran étroit, choisir un agent dans la scène ou dans la liste fait défiler automatiquement la page jusqu'à son poste de pilotage.
- Sorties du terminal : Affiche les dernières lignes réelles du terminal de l'agent sélectionné. Pendant son travail, seule la partie visible est lue pour éviter de perturber son activité.
- Recherche en direct : Le champ de recherche permet de filtrer ou de surligner instantanément des termes dans les sorties.
- Pause automatique et sélection de texte : Dès qu'une sélection de texte est active à la souris dans les sorties, l'actualisation automatique se met en pause avec la mention « Sélection en cours, affichage en pause ». Tu peux ainsi sélectionner et copier n'importe quel extrait sans risquer d'être interrompu par le rafraîchissement.
- Figer le défilement : Le bouton « Figer » arrête le suivi automatique vers le bas pour te laisser lire tranquillement une erreur ou un extrait de code. Le bouton « Reprendre » réactive le suivi automatique.
- Copier : Le bouton « Copier » place l'intégralité du texte affiché du terminal dans ton presse-papier.
- Consigne individuelle : La zone de texte permet d'écrire à l'agent sélectionné. L'envoi est réservé aux agents disponibles ou ayant terminé, empêchant d'interrompre un agent en plein travail. Le raccourci clavier Ctrl+Entrée (ou Cmd+Entrée) permet d'envoyer directement la consigne sans reprendre la souris. Les brouillons de message sont conservés si tu changes de poste.

## Onglet Équipe

- Envoi groupé en deux clics : Coche les agents disponibles à qui tu souhaites parler, ou clique sur « Cocher tous les disponibles » pour sélectionner en un clic l'ensemble des agents prêts. Saisis une consigne commune, puis valide. Le raccourci Ctrl+Entrée fonctionne également ici. Le premier clic sur le bouton arme l'envoi et affiche clairement les destinataires. Le second clic confirme l'expédition individuelle vers chacun d'eux.
- Journal des envois : Consigne l'historique des envois de ta session avec l'heure exacte, les destinataires, le texte et la confirmation de transmission par Herdr.

## Tokens et sous-agents

- Pour Claude : Le bureau lit son journal local pour afficher sa consommation réelle de jetons (produits, lus, en cache) et ses sous-agents actifs. Deux sous-agents peuvent apparaître sous forme de petits assistants sur son bureau.
- Pour les autres outils (Codex, Antigravity, OpenCode) : Le bureau affiche fidèlement « Non exposé par cet outil » sans inventer de consommation ni de fausse sous-tâche.

## Mode plein écran

Le bouton « Plein écran » en haut à droite du cadre du bureau permet d'agrandir l'application sur tout l'écran. Ce mode conserve la scène ET le panneau de pilotage (lecture du terminal, saisie de consignes et onglets) réunis sur un même écran de surveillance. La touche Échap permet de quitter ce mode à tout moment.

## Limites honnêtes

- Seuls les agents réellement ouverts et détectés dans Herdr apparaissent dans le bureau.
- Le bureau n'invente aucun pourcentage d'avancement, aucun faux agent et aucune donnée non fournie par Herdr.
- Le bureau ne prend aucune décision autonome : il ne valide jamais une demande d'autorisation et ne ferme aucune session.
- La mention « Consigne transmise » confirme la réception par Herdr, mais ne garantit pas que la mission est réussie ou terminée.
- L'application est strictement locale (127.0.0.1) : l'interface s'adapte sur petit écran, mais le serveur n'est pas accessible sur le réseau public.

## Contribuer

Les contributions respectant la philosophie du projet (indépendance technique, vérité des données, pixel art et accessibilité) sont les bienvenues.

- Consultez le guide [CONTRIBUTING.md](CONTRIBUTING.md) pour les consignes d'architecture et de proposition de code.
- Consultez l'historique des versions dans [CHANGELOG.md](CHANGELOG.md).
- Avant toute soumission, vérifiez que l'ensemble des tests automatisés passe (`npm test`) et que la syntaxe est irréprochable (`npm run check`).

## Entretien sans IA

- Organisation du code : `public/` contient l'interface (HTML, CSS, canvas, logos et gestion du terminal) ; `src/herdr.mjs` gère la passerelle locale Herdr ; `src/claude-activity.mjs` extrait l'activité locale de Claude ; `server.mjs` héberge l'application et sécurise les requêtes.
- Réglages : Le port peut être changé avec la variable `BUREAU_PORT`. Le chemin vers l'outil Herdr peut être précisé avec `BUREAU_HERDR_PATH`.
- Tests et vérifications :
  - `npm test` : exécute la suite complète des tests automatisés.
  - `npm run check` : vérifie la validité syntaxique de tous les fichiers du projet.
- Arrêt du bureau : Utiliser Ctrl+C dans le terminal ayant lancé `node server.mjs`. Ne jamais forcer la fermeture de Herdr pour arrêter le bureau.

## Licence et marques

Code sous licence MIT (`LICENSE`). Les noms et emblèmes des outils d'IA appartiennent à leurs propriétaires et servent seulement à identifier chaque poste : voir `NOTICE.md`.

DrSmoke « Un Mbokatié engagé »
