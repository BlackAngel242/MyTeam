# Bureau des agents

Un tableau de bord immersif et vivant en pixel art pour surveiller, lire et piloter vos équipes d'agents d'intelligence artificielle autonomes exécutés dans Herdr.

![Aperçu du Bureau des agents](docs/captures/apercu-bureau.png)
> *Aperçu de la scène animée et du panneau de pilotage du Bureau des agents (capture en cours d'intégration).*

## Pour qui et pourquoi ?

Le Bureau des agents a été conçu pour les développeurs, créateurs et orchestrateurs qui font collaborer plusieurs agents d'IA (Claude, Codex, Antigravity, OpenCode) en parallèle et souhaitent garder une vision claire de leur atelier sans jongler entre plusieurs fenêtres de terminal.

- Organisation Chef et Agents : Le premier agent démarré dans Herdr est désigné comme le chef d'équipe (bureau Direction). Les autres agents sont ses collaborateurs directs.
- Cycle de délégation et courriers : Lorsque le chef délègue une mission (détection de commandes `herdr agent prompt` dans son journal), chaque agent visé vient chercher sa tâche au bureau Direction, retourne à son poste pour travailler, puis envoie son « courrier » de fin de mission au chef.
- Évaluation et humeur : Le chef reçoit le travail et l'apprécie ; l'humeur affichée reflète strictement les résultats observés, et les erreurs constatées alimentent directement `LESSONS.md`.
- Salle de réflexion repliable : Les sous-agents actifs se réunissent dans une salle de réflexion vitrée au libellé fixe « SALLE DE REFLEXION », avec commande de repli pour adapter la scène aux écrans compacts.
- File d'attente sécurisée : Possibilité de mettre en file une consigne pour un agent occupé ou en pause de quota, avec relance automatique planifiée à la remise à zéro + 5 min et protection absolue contre les doubles envois.
- Suivi des tâches réelles : Onglet dédié observant les cases cochées dans les fichiers du projet (`TODO.md`) et les plans d'action publiés par les agents dans leurs journaux.
- Palette de commandes et aide contextuelle : Accès rapide par `Ctrl+K` et touche `?` pour naviguer, inspecter et piloter entièrement au clavier.
- Notifications et sons 8 bits : Alertes visuelles de bureau Windows et signaux sonores Web Audio discrets pour les blocages, courriers et pauses de limite.
- Outils intégrés : Explorateur de fichiers sécurisé, barre d'état détaillée sous chaque poste, et lecture de l'activité locale réelle pour Claude, Codex et OpenCode.
- Règle de vérité des faits : Tout est piloté par des faits physiques observés (états Herdr, journaux locaux, fichiers du disque). Aucun statut, tâche, pourcentage ou humeur n'est inventé.
- 100% local et sans dépendance : Écoute locale exclusive sur 127.0.0.1, aucune télémétrie, et zéro bibliothèque npm.

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

## Lire la scène et le bureau Direction

- Ambiance, cycle jour-nuit et éclairage du soir : Le ciel de la baie vitrée évolue en continu selon l'horloge de ton ordinateur (nuit, aube, jour, crépuscule), avec lever fixe à 6 h 30 et coucher fixe à 19 h 30 (approximation sans saisons). En soirée (dès 17 h 30 et à pleine puissance à 19 h jusqu'au matin), les suspensions au plafond et les lampes de bureau s'allument automatiquement pour éclairer l'atelier. La lampe d'un poste s'éteint si l'agent part en pause de limite.
- Tableau d'affichage de la scène : Un tableau mural synthétise les faits utiles absents du reste de la scène. Il affiche l'heure de reprise d'une pause de quota (`RETOUR`), le nombre de consignes en attente (`EN FILE`), les courriers non lus (`COURRIER`) et les sous-agents en activité (`SOUS-AGENTS`). Chaque ligne s'allume dès que son fait est observé.
- Le chef au bureau Direction : Le premier agent démarré dans Herdr occupe le bureau Direction mis en valeur. Une pile de courriers s'y empile dès qu'un agent termine une tâche ; cliquer dessus ouvre directement l'onglet Équipe. Une commande avec plusieurs ordres de délégation fait venir chaque collaborateur visé chercher son travail.
- Chaque poste en un coup d'œil : Chaque bureau arbore en façade le logo en pixels de son outil (Claude, Codex, Antigravity, OpenCode). Sous chaque bureau, le nom seul de l'agent est affiché, souligné d'un trait fin de la couleur de son état (bleu travail, menthe disponible, ambre attente, violet pause), sans texte d'état redondant avec sa posture et son écran.
- Postures visibles : Frappe au clavier quand l'agent est au travail (bleu ciel), mug en main quand il est disponible (menthe), main levée quand il attend ta réponse (ambre).
- Pause de quota et chevalet « RETOUR » : Si un agent atteint son plafond d'utilisation, son fauteuil se vide, sa lampe de bureau s'éteint, une veilleuse violette clignote et un chevalet blanc affiche l'heure exacte de reprise annoncée par l'outil.
- Bulles d'état : Bulle jaune « ? » quand l'agent attend une consigne ou une autorisation, coche verte quand il vient de terminer, points de suspension « ... » pour un état inconnu.
- Salle de réflexion repliable : Pièce dédiée portant le libellé fixe « SALLE DE REFLEXION », où les sous-agents se réunissent avant de déposer leur dossier complété sur le bureau de leur agent. Le nombre de sous-agents actifs est visible au tableau mural.
- Mode « Disposer » : Le bouton « Disposer » permet de réorganiser librement les bureaux sur le sol et de redimensionner le bureau Direction par son coin doré. Une barre d'aide dédiée rappelle les commandes et la touche Échap enregistre la disposition.

## Onglet Poste, terminal et file d'attente

- Sélection directe : Dès l'ouverture, une vue d'accueil claire invite à choisir un agent parmi des boutons rapides. Sur mobile, choisir un agent fait défiler la vue automatiquement.
- Sorties du terminal : Affiche les dernières lignes réelles du terminal Herdr de l'agent sélectionné.
- Outils de confort : Champ de recherche avec surlignage des occurrences, bouton « Figer » pour suspendre le défilement, bouton « Copier » pour récupérer le texte, et bouton « Agrandir » pour lire le terminal en pleine hauteur.
- Pause automatique sur sélection : Dès qu'une sélection de texte est active à la souris dans les sorties, le rafraîchissement se met en pause pour ne jamais faire sauter ta sélection.
- Consigne et file d'attente : Si l'agent est disponible, le formulaire permet un envoi immédiat (Ctrl+Entrée). S'il est occupé ou en pause de quota, le bouton devient « Mettre en file » pour différer l'envoi en toute sécurité.

## Onglet Équipe, délégations et file d'attente

- Courrier du chef : Enregistre les fins de travail observées avec compteur dans le titre ; la liste se remet à zéro dès que tu la consultes.
- File d'attente collective : Liste toutes les consignes différées avec leur cible et leur statut. Chaque consigne peut être retirée d'un clic. Le serveur déclenche le départ automatique dès que l'agent redevient disponible (ou 5 minutes après sa remise à zéro de quota).
- Envoi groupé en deux clics : Coche les agents disponibles ou clique sur « Cocher tous les disponibles ». Le premier clic sur « Envoyer » arme l'envoi en listant les destinataires, le second confirme l'expédition individuelle.
- Journal des envois : Consigne l'historique complet des transmissions de la session.

## Onglet Fichiers et Onglet Tâches

- Onglet Fichiers : Consultation sécurisée des fichiers récents ou navigation dans les dossiers de travail. Copie par glisser-déposer standard, ou déplacement avec la touche Maj (requiert une confirmation). Aucun écrasement et aucune suppression ne sont autorisés.
- Onglet Tâches : Tableau de bord des cases réelles cochées dans les fichiers Markdown (`TODO.md`) et des plans publiés par les agents dans leurs journaux. La progression affichée est strictement factuelle, sans projection artificielle.

## Palette de commandes, aide et signaux

- Palette de commandes (Ctrl+K) : Ouvre une boîte modale au clavier pour chercher un agent, ouvrir un poste, rédiger une consigne, changer d'onglet ou basculer les affichages.
- Aide escamotable (touche ?) : Volet latéral présentant la visite guidée en 5 étapes, la légende de la scène, la table des raccourcis et les réglages des signaux.
- Notifications et sons : Le bureau propose des notifications système Windows en arrière-plan et des sons 8 bits synthétisés avec Web Audio (`public/sounds.js`), activables d'un clic dans l'aide.

## Mode plein écran

Le bouton « Plein écran » en haut à droite du cadre du bureau permet d'agrandir l'application sur tout l'écran. Ce mode conserve la scène ET le panneau de pilotage (lecture du terminal, saisie de consignes et onglets) réunis sur un même écran de surveillance. La touche Échap permet de quitter ce mode à tout moment.

## Limites honnêtes

- Seuls les agents réellement ouverts et détectés dans Herdr apparaissent dans le bureau.
- Vérité des faits : Le bureau n'invente aucun pourcentage d'avancement, aucun faux agent, aucune tâche fictive et aucune humeur imaginaire.
- Le bureau ne prend aucune décision autonome : il ne valide jamais une demande d'autorisation et ne ferme aucune session.
- La mention « Consigne transmise » confirme la réception par Herdr, mais ne garantit pas que la mission est réussie ou terminée.
- L'application est strictement locale (127.0.0.1) : l'interface s'adapte sur petit écran, mais le serveur n'est pas accessible sur le réseau public.

## Contribuer

Les contributions respectant la philosophie du projet (indépendance technique, vérité des faits, pixel art et accessibilité) sont les bienvenues.

- Consultez le guide [CONTRIBUTING.md](CONTRIBUTING.md) pour les consignes d'architecture et de proposition de code.
- Consultez l'historique des versions dans [CHANGELOG.md](CHANGELOG.md).
- Avant toute soumission, vérifiez que l'ensemble des tests automatisés passe (`npm test`) et que la syntaxe est irréprochable (`npm run check`).

## Entretien sans IA

- Organisation du code : `public/` contient l'interface (HTML, CSS, canvas, logos et gestion du terminal) ; `src/herdr.mjs` gère la passerelle locale Herdr ; `src/claude-activity.mjs` et `src/agent-activity.mjs` extraient les activités réelles ; `src/files.mjs` gère l'explorateur ; `server.mjs` héberge l'application et sécurise les requêtes.
- Réglages : Le port peut être changé avec la variable `BUREAU_PORT`. Le chemin vers l'outil Herdr peut être précisé avec `BUREAU_HERDR_PATH`.
- Tests et vérifications :
  - `npm test` : exécute la suite complète des tests automatisés.
  - `npm run check` : vérifie la validité syntaxique de tous les fichiers du projet.
- Sauvegarde de référence : Version majeure stabilisée au commit `7817574`.
- Arrêt du bureau : Utiliser Ctrl+C dans le terminal ayant lancé `node server.mjs`. Ne jamais forcer la fermeture de Herdr pour arrêter le bureau.

## Licence et marques

Code sous licence MIT (`LICENSE`). Les noms et emblèmes des outils d'IA appartiennent à leurs propriétaires et servent seulement à identifier chaque poste : voir `NOTICE.md`.

DrSmoke « Un Mbokatié engagé »
