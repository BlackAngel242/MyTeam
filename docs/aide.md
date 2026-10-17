# Guide d'aide du Bureau des agents

Ce document contient l'aide intégrée du bureau pour DrSmoke et ses agents. Il peut être consulté directement ou affiché dans un panneau « ? » interactif.

---

## 1. Bienvenue sur votre bureau

Le Bureau des agents est votre tour de contrôle locale. Il vous permet de surveiller vos agents d'intelligence artificielle connectés dans Herdr et de leur transmettre vos consignes.

Tout ce qui s'affiche à l'écran provient d'observations réelles : processus Herdr actifs, sorties réelles de terminaux, journaux locaux et fichiers sur votre disque. Le bureau n'invente jamais de données, de pourcentages d'avancement ni de faux états.

---

## 2. Visite guidée en 5 étapes

Cette visite rapide présente le fonctionnement essentiel de votre bureau. Vous pouvez passer cette étape à tout moment avec le bouton « Passer la visite ».

### Étape 1 : Observer l'équipe dans la scène pixel art
La fenêtre principale présente votre équipe dans un décor animé en pixel art. Le ciel change en continu selon l'heure de votre ordinateur (lever à 6 h 30, coucher à 19 h 30), et l'éclairage intérieur s'allume automatiquement en soirée (suspensions et lampes de bureau). Le tableau d'affichage résume les faits utiles (RETOUR, EN FILE, COURRIER, SOUS-AGENTS). Le chef de l'équipe occupe le bureau Direction. Chaque personnage montre son état réel par sa posture, son écran et le soulignement coloré de son nom.

### Étape 2 : Sélectionner un poste
Cliquez sur n'importe quel personnage dans la scène (ou touchez-le sur écran tactile), sur son nom dans la liste des postes sous le bureau, ou directement dans la vue d'accueil du poste. Sur téléphone ou écran étroit, la page fait défiler l'affichage automatiquement jusqu'au panneau de pilotage.

### Étape 3 : Inspecter et guider dans l'onglet « Poste »
L'onglet « Poste » affiche les informations détaillées de l'agent : son modèle, son activité, sa consommation et les dernières lignes de son terminal. Vous pouvez figer le défilement, agrandir le terminal en pleine hauteur, rechercher du texte et lui envoyer une consigne avec le raccourci Ctrl+Entrée (ou cliquer sur « Mettre en file » s'il est occupé).

### Étape 4 : Coordonner dans l'onglet « Équipe »
L'onglet « Équipe » centralise la gestion collective. La section « Courrier du chef » vous signale chaque agent qui vient de terminer son travail (la liste se remet à zéro dès que vous la consultez). La section « File d'attente » liste les consignes différées avec relance automatique. Vous pouvez aussi cocher plusieurs agents disponibles pour leur envoyer une consigne commune en deux clics sécurisés.

### Étape 5 : Gérer les documents et suivre les tâches
L'onglet « Fichiers » vous permet de voir les fichiers récemment modifiés par l'agent ou de naviguer dans les dossiers de votre projet par copie ou déplacement sans suppression. L'onglet « Tâches » affiche l'avancement des cases réellement cochées dans les fichiers du projet et les plans d'action publiés par les agents.

---

## 3. Guide complet par zone

### Zone 1 : La scène du bureau (Vue globale)

La scène offre une vue d'ensemble immédiate sur toute votre équipe d'agents.

#### À quoi elle sert
- Surveiller d'un coup d'œil l'état de chaque agent connecté à Herdr.
- Repérer immédiatement les blocages, fins de mission et pauses de limite.
- Observer les interactions réelles entre le chef, les agents et leurs sous-agents.
- Suivre les faits utiles et les indicateurs clés au tableau d'affichage mural.

#### Le tableau d'affichage de la scène
- Placée sur le mur du fond, cette ardoise regroupe les faits utiles non répétés sur les bureaux et les cartes.
- Ligne `RETOUR` : s'affiche en violet lorsqu'un agent est en pause de quota, avec l'heure exacte de reprise annoncée par l'outil (ou `??:??` si non communiquée).
- Ligne `EN FILE` : indique le nombre de consignes en attente d'expédition dans la file d'attente sécurisée (s'allume en bleu dès qu'une consigne est en attente).
- Ligne `COURRIER` : compte les courriers non lus annonçant la fin d'une tâche (s'allume en menthe quand des courriers attendent consultation).
- Ligne `SOUS-AGENTS` : dénombre les assistants actuellement au travail dans la salle de réflexion (s'allume en gris clair si des sous-agents sont actifs).
- Chaque ligne s'allume en couleur vive dès que son fait est observé ; les lignes sans activité restent sombres et discrètes.

#### Le bureau Direction
- Attribué au premier agent démarré dans Herdr (le chef d'équipe).
- Reconnaissable à sa moquette violette, ses boiseries élégantes et sa grande baie vitrée.
- Une pile de courriers s'accumule sur son bureau dès qu'un agent termine une tâche. Un clic sur cette pile ouvre directement l'onglet Équipe et le courrier du chef.
- Lorsqu'une commande du chef comporte des ordres pour plusieurs agents, chaque collaborateur visé vient chercher sa tâche à son bureau.

#### Cycle jour-nuit continu et ambiance lumineuse
- Le ciel visible par la baie vitrée évolue en temps réel selon l'heure exacte de votre machine (nuit, aube, jour, crépuscule).
- Le soleil et la lune suivent un arc horaire dans le ciel (soleil orangé près de l'horizon, lever fixe à 6 h 30 et coucher fixe à 19 h 30, approximation sans saisons).
- Les fenêtres de la ville et les étoiles s'effacent progressivement avec la montée du jour.
- Suspensions au plafond : dès 17 h 30 (pleine intensité atteinte à 19 h jusqu'au matin), les suspensions lumineuses au plafond s'allument automatiquement pour éclairer le bureau d'une douce lueur dorée.
- Lampes de bureau : chaque poste dispose d'une lampe individuelle qui s'allume le soir pour un agent présent, et reste éteinte si l'agent est parti en pause de limite.
- L'éclairage de la pièce, de la salle de réflexion et du bureau Direction s'adapte en temps réel à l'ambiance du ciel et des moniteurs.
- Réduction des mouvements : si votre système active la réduction des mouvements (`prefers-reduced-motion`), la scène est automatiquement figée par défaut (sans choix manuel enregistré). Dans cet état figé, le décor continue d'être redessiné une fois par minute pour suivre l'heure et l'éclairage.

#### Identification des postes et nom souligné
- En façade de chaque bureau, le logo 16x16 en pixel art identifie clairement l'outil (Claude, Codex, Antigravity, OpenCode).
- Sous chaque bureau, le nom seul de l'agent est affiché, souligné d'un trait fin de la couleur de son état (bleu pour travail, menthe pour disponible, ambre pour attente, violet pour pause).
- Si l'application perd la liaison avec Herdr, la mention `HORS LIGNE` s'affiche sous le bureau.
- L'état n'a pas besoin d'être répété en texte : il est clairement exprimé par la posture de l'agent, le contenu de son écran, sa bulle et le soulignement coloré de son nom.

#### Postures des personnages
- Frappe au clavier : agent au travail sur une tâche (bleu ciel).
- Mug en main : agent disponible, en attente de sa prochaine consigne (menthe).
- Bras levé : agent en attente d'une validation ou d'une réponse de votre part (ambre).
- Sourire et étincelles : le travail vient de s'arrêter (passage réel de « au travail » à « terminé ») ; le résultat reste à vérifier dans ses sorties.
- Fauteuil vide : agent en pause de quota (limite d'utilisation atteinte).

#### Bulles au-dessus des postes
- Point d'interrogation ambre : l'agent demande une confirmation ou une saisie dans Herdr.
- Coche verte : travail terminé selon Herdr, résultat à vérifier dans les sorties réelles.
- Points de suspension gris : statut transitoire ou non renseigné par l'outil.

#### Couleurs d'état
- Bleu ciel : au travail (exécution de commandes, écriture de code).
- Menthe : disponible ou travail terminé.
- Ambre : attente d'une intervention de votre part.
- Violet doux : en pause de quota.
- Gris ardoise : état inconnu ou agent déconnecté.

#### Pause de quota et chevalet « RETOUR »
- Quand un outil atteint son plafond de requêtes ou de jetons, l'agent quitte son fauteuil.
- L'écran de son ordinateur s'éteint, sa lampe de bureau s'éteint et une veilleuse violette clignote discrètement.
- Un chevalet blanc portant la mention « RETOUR » affiche l'heure exacte de reprise annoncée par l'outil.
- Le serveur local planifie la relance automatique des consignes en attente 5 minutes après cette heure.

#### Salle de réflexion repliable des sous-agents
- Pièce vitrée dédiée portant le libellé fixe « SALLE DE REFLEXION » (ou « REFLEXION » sur écran étroit), jamais tronqué quelle que soit l'activité.
- Lorsqu'un agent délègue une partie de son travail à des sous-agents, de petits assistants quittent son poste en portant un dossier doré.
- Ils traversent le couloir et entrent dans la salle de réflexion vitrée.
- Ils s'installent à table sur leurs ordinateurs portables ou travaillent au tableau blanc.
- Le nombre exact de sous-agents en réflexion est indiqué en direct sur le tableau mural de la scène.
- Dès que leurs analyses sont terminées, ils reviennent déposer le dossier complété sur le bureau de leur agent avant de quitter la pièce.
- La salle de réflexion dispose d'une option de repli pour adapter l'affichage de la scène aux écrans compacts.

#### Mode « Disposer » (Personnalisation de la scène)
- Cliquez sur le bouton « Disposer » en haut à droite du cadre de la scène.
- Une barre d'aide dédiée s'affiche sous les outils pour rappeler les commandes.
- Glissez chaque bureau d'agent à l'endroit désiré sur le sol (ou déplacez-le aux flèches du clavier).
- Déplacez le bureau Direction du chef ou redimensionnez-le en étirant son coin doré en bas à droite.
- Cliquez sur « Réinitialiser » pour rétablir la disposition automatique.
- Appuyez sur la touche Échap ou cliquez sur « Terminer » pour valider et enregistrer vos réglages.

---

### Zone 2 : Onglet « Poste » (Pilotage individuel)

Cet onglet permet d'inspecter l'agent sélectionné et d'échanger directement avec lui.

#### À quoi il sert
- Consulter l'activité détaillée, le modèle et la consommation de l'agent.
- Lire le texte réel affiché dans son terminal Herdr.
- Rechercher des erreurs, figer le défilement et copier des extraits de code.
- Rédiger et envoyer une nouvelle consigne individuelle.

#### Barre d'état de l'outil
- Titre de la tâche en cours ou pensée extraite en direct de l'outil.
- Modèle utilisé (tel que l'outil l'affiche, par exemple GPT-6.1-Sol pour Codex ou MiMo V2.6 Pro pour OpenCode), mode et niveau d'effort.
- Jauge visuelle de la limite restante avec heure de remise à zéro.
- Temps d'exécution écoulé et nombre d'avertissements détectés.

#### Outils du terminal
- Champ « Rechercher dans les sorties » : met en surbrillance instantanée les termes cherchés et affiche le nombre de correspondances.
- Bouton « Figer » : interrompt le défilement automatique vers le bas pour vous laisser lire calmement une trace d'erreur ou du code. Cliquez sur « Reprendre » pour réactiver le suivi.
- Bouton « Copier » : copie l'intégralité du texte du terminal affiché dans votre presse-papier.
- Bouton « Agrandir » : étend la hauteur du terminal pour occuper tout l'espace disponible et lire de longs historiques en pleine page, y compris sur téléphone où il déploie une hauteur dédiée confortable.
- Pause automatique sur sélection : dès que vous sélectionnez du texte à la souris dans les sorties, l'actualisation se met en pause avec la mention « Sélection en cours, affichage en pause ». Votre sélection ne saute jamais.

#### Envoi de consigne et mise en file
- Agent disponible : la zone de texte est déverrouillée et permet un envoi immédiat avec le raccourci clavier Ctrl+Entrée (ou Cmd+Entrée).
- Agent occupé ou en pause de quota : le bouton affiche « Mettre en file ». La consigne est enregistrée dans la file d'attente sécurisée du serveur et partira toute seule dès que l'agent sera disponible ou 5 minutes après sa remise à zéro de limite.
- Conservation des brouillons : si vous changez d'agent alors qu'un texte est commencé ou pendant l'envoi d'une consigne en file, chaque brouillon reste mémorisé indépendamment sans être écrasé par l'autre poste.

---

### Zone 3 : Onglet « Équipe » (Coordination collective)

Cet onglet gère les échanges avec plusieurs agents, la file d'attente et la réception des rapports de fin de travail.

#### À quoi il sert
- Prendre connaissance des missions terminées grâce au courrier du chef.
- Suivre et administrer les consignes en attente de départ dans la file d'attente.
- Transmettre une même directive à plusieurs agents en une seule action.
- Consulter le journal des transmissions de la session.

#### Courrier du chef
- Chaque fois qu'un agent passe de l'état « au travail » à « disponible » ou « terminé », un courrier est enregistré avec compteur dans le titre de section.
- La liste se remet automatiquement à zéro dès que vous consultez l'onglet Équipe.
- Un clic sur un courrier ou sur son bouton « Ouvrir son poste » permet d'accéder directement au terminal de l'agent pour vérifier son travail.
- Rappel de prudence : le courrier confirme l'arrêt du processus de travail, pas la réussite de l'objectif. Vérifiez toujours les sorties réelles.

#### File d'attente des consignes
- Affiche la liste des consignes en attente d'expédition avec le nom de l'agent destinataire et le statut courant.
- Chaque consigne peut être annulée d'un clic grâce à son bouton de retrait unitaire.
- Le serveur déclenche le départ automatique dès que l'agent ciblé est libre, ou 5 minutes après sa remise à zéro en cas de pause de quota.
- Protection anti-double envoi : persistance atomique sur disque, clé d'idempotence et gel d'envoi en cas de doute.

#### Message à plusieurs agents (Envoi groupé en deux clics)
- Cochez les agents à qui vous souhaitez vous adresser (seuls les agents disponibles peuvent être sélectionnés).
- Le bouton « Cocher tous les disponibles » permet de sélectionner l'ensemble des agents libres en un seul clic.
- Saisissez votre consigne commune dans la zone de texte.
- Premier clic sur « Envoyer » (ou Ctrl+Entrée) : arme l'envoi et affiche clairement les noms de tous les destinataires.
- Second clic : confirme l'envoi. La même consigne part alors séparément à chaque agent choisi via Herdr.

#### Journal des envois de la session
- Consigne chaque envoi réalisé depuis l'ouverture du bureau.
- Affiche l'heure, les destinataires, le texte et le statut de transmission retourné par Herdr.

---

### Zone 4 : Onglet « Fichiers » (Explorateur sécurisé)

Cet onglet permet de consulter et d'organiser les fichiers du projet en lien avec vos agents.

#### À quoi il sert
- Découvrir rapidement les fichiers récemment créés ou modifiés par un agent.
- Parcourir l'arborescence des dossiers du projet.
- Ouvrir un emplacement dans l'Explorateur Windows en un clic.
- Copier ou déplacer des fichiers entre différents dossiers de travail.

#### Sécurité et intégrité absolue
- Aucune fonction de suppression n'existe dans le bureau.
- Aucun fichier ne peut être écrasé : si un fichier du même nom existe dans la destination, il est automatiquement renommé avec un indice numérique.
- La navigation est limitée aux lieux autorisés : le dossier de travail de chaque agent, Bureau, Documents et Téléchargements. Aucun chemin venant du navigateur n'est accepté.

#### Vue Récents et vue Parcourir
- Bouton « Récents » : liste les fichiers modifiés au cours des 48 dernières heures dans le dossier de travail de l'agent sélectionné.
- Bouton « Parcourir » : exploration dossier par dossier avec barre de navigation (fil d'Ariane) cliquable.

#### Actions sur les fichiers
- Bouton « Afficher » : révèle directement le fichier sélectionné dans l'Explorateur Windows de votre poste.
- Glisser-déposer standard : glissez un fichier vers l'un des lieux de la liste « Déposer dans » pour en créer une copie.
- Maj + Glisser-déposer : maintenez la touche Maj enfoncée pendant le glisser-déposer pour déplacer le fichier. Un message d'avertissement vous demandera un second geste identique pour confirmer le déplacement.

---

### Zone 5 : Onglet « Tâches » (Suivi factuel des plans)

Cet onglet permet de suivre l'avancement concret du travail sans estimation artificielle.

#### À quoi il sert
- Afficher les cases à cocher réelles trouvées dans les fichiers de documentation du projet (`TODO.md`).
- Consulter les plans d'action structurés publiés par les agents dans leurs journaux d'activité.
- Observer une barre de progression strictement calculée sur le nombre de tâches cochées par rapport au total.

#### Règle de vérité des tâches
- Aucun pourcentage n'est extrapolé ni prédit.
- Si un agent ne publie pas de plan dans ses sorties ou journaux, le bureau affiche « Aucun plan publié par un agent pour le moment ».

---

### Zone 6 : Palette de commandes, aide et signaux

#### Palette de commandes (Ctrl+K)
- Accessible par le bouton « Commandes » ou le raccourci clavier Ctrl+K.
- Permet de chercher un agent, ouvrir son poste, rédiger un message, basculer d'onglet ou lancer une action sans lâcher le clavier.
- Navigation fluide : flèches haut et bas pour choisir, Entrée pour valider, Échap pour fermer.

#### Panneau d'aide latéral (Touche ?)
- Accessible par le bouton « Aide » ou la touche « ? », ouvert automatiquement à la première visite.
- Contient la visite guidée en 5 étapes, les légendes visuelles et les boutons de contrôle des signaux.

#### Signaux : Sons 8 bits et notifications Windows
- Bouton « Notifications Windows » : active les notifications système quand la page est en arrière-plan (agent attendant une réponse, fin de mission, pause de limite). Page cachée, le bureau relit alors l'état des agents toutes les 15 secondes ; le navigateur peut espacer ces relectures.
- Bouton « Sons » : active les signaux sonores synthétisés en Web Audio 8 bits (`public/sounds.js`), courts et discrets (< 0,6 s, volume bas), pour les mêmes événements et les délégations.
- Le choix d'activation reste mémorisé localement dans votre navigateur (`bureau.sons`).

---

## 4. Tableau des raccourcis et commandes rapides

| Zone | Action ou raccourci | Effet |
| :--- | :--- | :--- |
| **Général** | `Ctrl + K` | Ouvre la palette de commandes modale. |
| **Général** | Touche `?` | Ouvre ou ferme ce volet d'aide. |
| **Scène** | Clic sur un personnage (ou toucher sur écran tactile) | Ouvre son poste individuel (fait défiler sur mobile). |
| **Scène** | Clic sur la pile de courrier | Ouvre l'onglet Équipe et la section Courrier du chef. |
| **Scène** | Bouton « Disposer » | Active la réorganisation manuelle des bureaux. |
| **Scène** | Touche `Échap` | Ferme une seule couche à la fois : la palette d'abord, puis le mode « Disposer », puis l'aide. |
| **Scène** | Bouton « Plein écran » | Agrandit la scène et le panneau dans une vue unifiée. |
| **Scène** | Bouton « Mettre en pause » | Coupe ou réactive les animations du canvas (figée, la scène suit l'heure chaque minute). |
| **Navigation**| `Flèche droite` / `Flèche gauche` | Passe d'un onglet à l'autre (Poste, Équipe, Fichiers, Tâches). |
| **Poste** | `Ctrl + Entrée` (ou `Cmd + Entrée`) | Envoie la consigne à l'agent sélectionné. |
| **Poste** | Bouton « Mettre en file » | Place la consigne dans la file d'attente si l'agent est occupé. |
| **Poste** | Bouton « Agrandir » | Agrandit ou réduit le terminal en pleine hauteur (y compris sur mobile). |
| **Poste** | Sélection de texte dans le terminal | Suspend temporairement l'actualisation pour copier. |
| **Poste** | Bouton « Figer » | Bloque le suivi automatique vers le bas. |
| **Poste** | Bouton « Copier » | Place le texte complet du terminal dans le presse-papier. |
| **Équipe** | Bouton « Retirer » | Supprime une consigne en attente dans la file. |
| **Équipe** | `Ctrl + Entrée` (ou `Cmd + Entrée`) | Déclenche l'envoi groupé armé. |
| **Équipe** | Bouton « Cocher tous les disponibles » | Sélectionne tous les agents prêts en un seul clic. |
| **Fichiers** | Glisser-déposer sur un lieu | Copie le fichier vers le dossier choisi. |
| **Fichiers** | `Maj` + Glisser-déposer sur un lieu | Déplace le fichier (nécessite une confirmation). |
| **Fichiers** | Bouton « Afficher » | Ouvre le dossier du fichier dans l'Explorateur Windows. |

---

## 5. Règle d'or : La vérité des faits

Le Bureau des agents applique une règle d'intégrité stricte :
1. Seuls les faits observables sont affichés (processus réels, horloge de l'ordinateur, journaux locaux, fichiers du disque).
2. Aucun pourcentage d'avancement inventé n'est proposé lorsqu'un outil ne le calcule pas lui-même.
3. Si un outil ne publie pas sa consommation de jetons ou ses sous-agents, la mention « Non exposé par cet outil » est fidèlement indiquée.
4. Une erreur constatée n'est jamais masquée : elle est rapportée dans les sorties et vient enrichir le document LESSONS.md pour prémunir l'équipe contre toute récidive.

