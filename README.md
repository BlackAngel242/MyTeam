# Bureau des agents

Un tableau de bord immersif et vivant en pixel art pour surveiller, lire et piloter vos équipes d'agents d'intelligence artificielle autonomes exécutés dans Herdr.

![Aperçu du Bureau des agents](docs/captures/apercu-bureau.png)
> *Aperçu de la scène animée et du panneau de pilotage du Bureau des agents (capture en cours d'intégration).*

## Pour qui et pourquoi ?

Le Bureau des agents a été conçu pour les développeurs, créateurs et orchestrateurs qui font collaborer plusieurs agents d'IA (Claude, Codex, Antigravity, OpenCode) en parallèle et souhaitent garder une vision claire de leur atelier sans jongler entre plusieurs fenêtres de terminal.

- Organisation Chef et Agents : Le premier agent démarré dans Herdr est désigné comme le chef d'équipe (bureau VIP). Les autres agents sont ses collaborateurs directs.
- Cycle de délégation animé : Lorsque le chef délègue une mission (détection de la commande `herdr agent prompt` dans son journal), l'agent concerné vient chercher sa tâche, retourne à son poste pour travailler, puis envoie son « courrier » de fin de mission au chef.
- Évaluation et humeur : Le chef reçoit le travail et l'apprécie ; l'humeur affichée reflète strictement les résultats observés, et les erreurs constatées alimentent directement `LESSONS.md`.
- Salle de réflexion : Les sous-agents actifs d'un agent se réunissent dans une salle de réflexion animée sur la scène, puis rapportent leur dossier de travail une fois leur analyse achevée.
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

## Lire la scène et le bureau VIP

- Décor et ambiance : La baie vitrée suit l'heure réelle de ton ordinateur (nuit, aube, jour, crépuscule). La baie HERDR clignote tant que la liaison locale est active. Les écrans projettent au sol une lueur de la couleur de l'état de chaque agent.
- Le chef et les postes : Le premier agent démarré dans Herdr occupe le bureau VIP. Chaque poste arbore en façade le logo en pixels de son outil (Claude, Codex, Antigravity, OpenCode). Les silhouettes restent stables pour identifier chaque poste d'un coup d'œil.
- Postures visibles : Frappe au clavier quand l'agent est au travail, mug en main quand il est disponible, main levée quand il attend une réponse de ta part.
- Bulles d'état : Bulle jaune « ? » quand l'agent attend une consigne ou une autorisation, coche verte quand il vient de terminer, points de suspension « ... » pour un état inconnu. Une légère animation festive apparaît pendant quelques secondes dès qu'un agent passe du travail à la disponibilité.
- Salle de réflexion : Pièce animée dédiée où les sous-agents d'un agent se concentrent avant de déposer leur dossier de travail.
- Couleurs d'état : Bleu pour le travail, menthe pour disponible ou terminé, ambre pour l'attente, gris pour un état inconnu.
- Bandeau d'alerte et compteurs : En haut de page, des pastilles comptent les agents au travail, en attente et disponibles. Une alerte en bandeau signale immédiatement tout agent bloquant pour ouvrir son poste en un clic.
- Identification des panneaux Herdr : L'identifiant précis du panneau Herdr (par exemple w5:p1 ou w5:p4) apparaît directement sous le nom de chaque agent dans la liste, ainsi que dans les détails de son poste.

## Onglet Poste et Explorateur de fichiers

- Navigation mobile : Sur téléphone ou écran étroit, choisir un agent dans la scène ou dans la liste fait défiler automatiquement la page jusqu'à son poste de pilotage.
- Sorties du terminal : Affiche les dernières lignes réelles du terminal de l'agent sélectionné. Pendant son travail, seule la partie visible est lue pour éviter de perturber son activité.
- Recherche en direct : Le champ de recherche permet de filtrer ou de surligner instantanément des termes dans les sorties.
- Pause automatique et sélection de texte : Dès qu'une sélection de texte est active à la souris dans les sorties, l'actualisation automatique se met en pause avec la mention « Sélection en cours, affichage en pause ». Tu peux ainsi sélectionner et copier n'importe quel extrait sans risquer d'être interrompu par le rafraîchissement.
- Figer le défilement et copie : Le bouton « Figer » arrête le suivi automatique pour lire calmement, et le bouton « Copier » place l'intégralité du texte dans ton presse-papier.
- Consigne individuelle : La zone de texte permet d'écrire à l'agent sélectionné avec envoi par Ctrl+Entrée. Les brouillons sont conservés lors du changement de poste.
- Explorateur de fichiers : Permet de consulter les fichiers et dossiers récents liés au travail de l'équipe, avec garanties de sécurité strictes (aucun écrasement, aucune suppression).

## Onglet Équipe et délégations

- Envoi groupé en deux clics : Coche les agents disponibles à qui tu souhaites parler, ou clique sur « Cocher tous les disponibles » pour sélectionner en un clic l'ensemble des agents prêts. Saisis une consigne commune, puis valide (Ctrl+Entrée supporté). Le premier clic sur le bouton arme l'envoi et affiche clairement les destinataires. Le second clic confirme l'expédition individuelle vers chacun d'eux.
- Journal des envois : Consigne l'historique des envois de ta session avec l'heure exacte, les destinataires, le texte et la confirmation de transmission par Herdr.
- Détection des délégations (en cours de finalisation) : Repère automatiquement les consignes transmises par le chef à ses agents et matérialise le passage de témoin.

## Télémétrie et activité locale réelle

- Pour Claude : Le bureau lit son journal local pour afficher sa consommation réelle de jetons (produits, lus, en cache) et ses sous-agents actifs.
- Pour Codex et OpenCode : Le bureau lit désormais leurs activités locales réelles (modèle configuré, historique récent) sans jamais fabriquer de données manquantes.
- Règle de vérité : Si une information n'est pas publiée par un outil, le bureau affiche fidèlement « Non exposé par cet outil ».

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
