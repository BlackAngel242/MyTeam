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
La fenêtre principale présente votre équipe dans un décor animé en pixel art. Le ciel change selon l'heure de votre ordinateur. Le chef de l'équipe occupe le bureau VIP. Chaque personnage montre son état réel par sa posture et ses couleurs.

### Étape 2 : Sélectionner un poste
Cliquez sur n'importe quel personnage dans la scène ou sur son nom dans la liste des postes sous le bureau. Sur téléphone ou écran étroit, la page fait défiler l'affichage automatiquement jusqu'au panneau de pilotage.

### Étape 3 : Inspecter et guider dans l'onglet « Poste »
L'onglet « Poste » affiche les informations détaillées de l'agent : son modèle, son activité, sa consommation et les dernières lignes de son terminal. Vous pouvez figer le défilement, rechercher du texte et lui envoyer une consigne avec le raccourci Ctrl+Entrée.

### Étape 4 : Coordonner dans l'onglet « Équipe »
L'onglet « Équipe » centralise la gestion collective. La section « Courrier du chef » vous signale chaque agent qui vient de terminer son travail. Vous pouvez aussi cocher plusieurs agents disponibles pour leur envoyer une consigne commune en deux clics sécurisés.

### Étape 5 : Gérer les documents dans l'onglet « Fichiers »
L'onglet « Fichiers » vous permet de voir les fichiers récemment modifiés par l'agent ou de naviguer dans les dossiers de votre projet. Vous pouvez copier ou déplacer des documents par glisser-déposer sans aucun risque de suppression accidentelle.

---

## 3. Guide complet par zone

### Zone 1 : La scène du bureau (Vue globale)

La scène offre une vue d'ensemble immédiate sur toute votre équipe d'agents.

#### À quoi elle sert
- Surveiller d'un coup d'œil l'état de chaque agent connecté à Herdr.
- Repérer immédiatement les blocages et les fins de mission.
- Observer les interactions réelles entre le chef, les agents et leurs sous-agents.

#### Le bureau VIP de la direction
- Attribué au premier agent démarré dans Herdr (le chef d'équipe).
- Reconnaissable à sa moquette violette, ses boiseries et sa grande baie vitrée.
- Une pile de courriers s'accumule sur son bureau dès qu'un agent termine une tâche. Un clic sur cette pile ouvre directement l'onglet Équipe et le courrier du chef.

#### Postures des personnages
- Frappe au clavier : agent au travail sur une tâche.
- Mug en main : agent disponible, en attente de sa prochaine consigne.
- Bras levé : agent en attente d'une validation ou d'une réponse de votre part.
- Sourire et confettis : mission qui vient de s'achever avec succès.
- Fauteuil vide : agent en pause de quota (limite d'utilisation atteinte).

#### Bulles au-dessus des postes
- Point d'interrogation ambre : l'agent demande une confirmation ou une saisie dans Herdr.
- Coche verte : mission terminée avec succès.
- Points de suspension gris : statut transitoire ou non renseigné par l'outil.

#### Couleurs d'état
- Bleu ciel : au travail (exécution de commandes, écriture de code).
- Menthe : disponible ou travail terminé.
- Ambre : attente d'une intervention de votre part.
- Violet doux : en pause de quota.
- Gris ardoise : état inconnu ou agent déconnecté.

#### Pause de quota et chevalet « RETOUR »
- Quand un outil atteint son plafond de requêtes ou de jetons, l'agent quitte son bureau.
- L'écran de son ordinateur s'éteint et une veilleuse violette clignote discrètement.
- Un chevalet blanc portant la mention « RETOUR » affiche l'heure exacte de reprise annoncée par l'outil.
- Le serveur local prévoit la relance automatique 5 minutes après cette heure.

#### Salle de réflexion des sous-agents
- Lorsqu'un agent délègue une partie de son travail à des sous-agents, de petits assistants quittent son poste en portant un dossier doré.
- Ils traversent le couloir et entrent dans la salle de réflexion vitrée.
- Ils s'installent à table sur leurs ordinateurs portables ou travaillent au tableau blanc.
- Dès que leurs analyses sont terminées, ils reviennent déposer le dossier complété sur le bureau de leur agent avant de quitter la pièce.

#### Mode « Disposer » (Personnalisation de la scène)
- Cliquez sur le bouton « Disposer » en haut à droite du cadre de la scène.
- Glissez chaque bureau d'agent à l'endroit désiré sur le sol.
- Déplacez le bureau VIP du chef ou redimensionnez-le en étirant son coin doré en bas à droite.
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
- Modèle utilisé (par exemple Claude 3.7 Sonnet, GPT-4o, Codex), mode et niveau d'effort.
- Jauge visuelle de la limite restante avec heure de remise à zéro.
- Temps d'exécution écoulé et nombre d'avertissements détectés.

#### Outils du terminal
- Champ « Rechercher dans les sorties » : met en surbrillance instantanée les termes cherchés et affiche le nombre de correspondances.
- Bouton « Figer » : interrompt le défilement automatique vers le bas pour vous laisser lire calmement une trace d'erreur ou du code. Cliquez sur « Reprendre » pour réactiver le suivi.
- Bouton « Copier » : copie l'intégralité du texte du terminal affiché dans votre presse-papier.
- Pause automatique sur sélection : dès que vous sélectionnez du texte à la souris dans les sorties, l'actualisation se met en pause avec la mention « Sélection en cours, affichage en pause ». Votre sélection ne saute jamais.

#### Envoi de consigne individuelle
- La zone de texte est activée uniquement si l'agent est disponible ou a terminé son travail, évitant de couper une tâche en cours.
- Raccourci clavier : appuyez sur Ctrl+Entrée (ou Cmd+Entrée) pour transmettre votre consigne immédiatement.
- Conservation des brouillons : si vous changez d'agent alors qu'un texte est commencé, votre brouillon est conservé et réapparaîtra à votre retour.

---

### Zone 3 : Onglet « Équipe » (Coordination collective)

Cet onglet gère les échanges avec plusieurs agents et la réception des rapports de fin de travail.

#### À quoi il sert
- Prendre connaissance des missions terminées grâce au courrier du chef.
- Transmettre une même directive à plusieurs agents en une seule action.
- Consulter le journal des transmissions de la session.

#### Courrier du chef
- Chaque fois qu'un agent passe de l'état « au travail » à « disponible » ou « terminé », un courrier est enregistré.
- Il indique l'heure exacte et rappelle le titre de la tâche ordonnée par le chef si elle a été détectée dans les journaux locaux.
- Un bouton « Ouvrir son poste » permet d'accéder directement au terminal de l'agent pour vérifier son travail.
- Rappel de prudence : le courrier confirme l'arrêt du processus de travail, pas la réussite de l'objectif. Vérifiez toujours les sorties réelles.

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
- La navigation est strictement confinée au dossier du projet.

#### Vue Récents et vue Parcourir
- Bouton « Récents » : liste les fichiers modifiés au cours des 48 dernières heures dans le dossier de travail de l'agent sélectionné.
- Bouton « Parcourir » : exploration dossier par dossier avec barre de navigation (fil d'Ariane) cliquable.

#### Actions sur les fichiers
- Bouton « Afficher » : révèle directement le fichier sélectionné dans l'Explorateur Windows de votre poste.
- Glisser-déposer standard : glissez un fichier vers l'un des lieux de la liste « Déposer dans » pour en créer une copie.
- Maj + Glisser-déposer : maintenez la touche Maj enfoncée pendant le glisser-déposer pour déplacer le fichier. Un message d'avertissement vous demandera un second geste identique pour confirmer le déplacement.

---

## 4. Tableau des raccourcis et commandes rapides

| Zone | Action ou raccourci | Effet |
| :--- | :--- | :--- |
| **Scène** | Clic sur un personnage | Ouvre son poste individuel (fait défiler sur mobile). |
| **Scène** | Clic sur la pile de courrier | Ouvre l'onglet Équipe et la section Courrier du chef. |
| **Scène** | Bouton « Disposer » | Active la réorganisation manuelle des bureaux. |
| **Scène** | Touche `Échap` | Quitte le mode « Disposer » et sauvegarde les positions. |
| **Scène** | Bouton « Plein écran » | Agrandit la scène et le panneau dans une vue unifiée. |
| **Scène** | Bouton « Mettre en pause » | Coupe ou réactive les animations graphiques du canvas. |
| **Navigation**| `Flèche droite` / `Flèche gauche` | Passe d'un onglet à l'autre (Poste, Équipe, Fichiers). |
| **Poste** | `Ctrl + Entrée` (ou `Cmd + Entrée`) | Envoie la consigne à l'agent sélectionné. |
| **Poste** | Sélection de texte dans le terminal | Suspend temporairement l'actualisation pour copier. |
| **Poste** | Bouton « Figer » | Bloque le suivi automatique vers le bas. |
| **Poste** | Bouton « Copier » | Place le texte complet du terminal dans le presse-papier. |
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
