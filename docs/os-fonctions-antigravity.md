# Architecture et organisation fonctionnelle de l'OS d'agents

Ce document propose une organisation claire, opérationnelle et rigoureuse des futures capacités du Bureau des agents pour en faire un véritable système d'exploitation d'agents d'intelligence artificielle, au-delà de son rendu visuel.

Toutes les propositions respectent scrupuleusement les règles du projet :
1. **Vérité des faits** : chaque information affichée provient strictement d'un fait physique observé (processus Herdr, journaux locaux, fichiers sur disque, horloge de la machine). Rien n'est inventé ou simulé.
2. **Souveraineté de DrSmoke** : aucune IA ne répond à une boîte de dialogue, ne s'arroge la direction ou n'émet une décision à sa place.
3. **Architecture locale zéro dépendance** : écoute exclusive sur `127.0.0.1:4317`, aucun paquet tiers npm, code JavaScript natif.

---

## 1. Cartographie : Où vit chaque fonction ?

Pour éviter l'encombrement et garantir une ergonomie fluide sur grand écran comme sur mobile, les fonctions sont réparties entre quatre espaces complémentaires :

| Espace | Rôle principal | Fonctions accueillies |
| :--- | :--- | :--- |
| **La Scène (Canvas pixel art)** | Surveillance sensorielle immédiate et échos physiques des faits | Bulles de parole du standup au-dessus des agents, bureau Direction du chef actif, dossier physique posé sur le poste lors d'un traitement de fichier, voyant d'alerte en cas de crise, panneau de liège interactif. |
| **L'Onglet « Poste »** | Pilotage unitaire et dialogue approfondi avec un collaborateur | Sorties réelles du terminal, sélection de texte, barre d'état d'outil, envoi de fichiers joints avec une consigne, suivi unitaire du traitement de fichier. |
| **L'Onglet « Équipe »** | Commandement stratégique, coordination collective et flux | Fil de discussion chronologique (Standup), boîte aux lettres du chef, file d'attente avec priorisation des départs, transfert de direction (changement de chef ou suppléance de quota). |
| **L'Onglet « Fichiers »** | Gouvernance du patrimoine documentaire et du code | Règle « Un fichier, un propriétaire », fichiers en cours de traitement par agent, inspection des diffs avant validation, lieux de dépôt sécurisés sans suppression. |
| **L'Onglet « Tâches »** | Alignement factuel sur les objectifs | Suivi des cases réelles de `TODO.md` et des plans d'action issus des journaux des agents, sans extrapolation. |
| **Mode Tuiles (Mosaïque)** | Surveillance opérationnelle multi-terminaux commutable | Affichage simultané de 2 à 4 terminaux d'agents en colonnes ou grille, commutable d'un clic depuis la barre d'outils. |
| **Disjoncteur « Salle de crise »** | Sécurité d'urgence et gel des dérives | Bouton sous clapet dans l'en-tête supérieur ouvrant un panneau modale de diagnostic et de suspension générale des envois. |

---

## 2. Organisation détaillée des 7 fonctions et parcours de DrSmoke

### Fonction 1 : Salle de contrôle et fil de discussion (Standup des agents)

#### Ce que c'est et ce qui la nourrit
Inspiré d'outils comme *agent-standup*, cette fonction offre une vue synthétique des échanges sans obliger DrSmoke à lire des milliers de lignes de terminal.
- **Données réelles** : extraction des intentions affichées par les outils dans leurs journaux (champs `task` ou `thought`), des annonces d'étapes franchies, des ordres de délégation (`herdr agent prompt`), des demandes de validation (`?`) et des fins de tâche (`done`).
- **Règle d'intégrité** : jamais de bavardage simulé. Le fil ne contient que des citations textuelles exactes émises par l'outil ou par Herdr.

#### Où elle vit
- **Dans l'onglet Équipe** : une section prioritaire « Fil de discussion (Standup) » située au-dessus de la file d'attente, affichant les bulles chronologiques avec avatar, nom de l'agent, heure exacte et citation.
- **Sur la scène** : une bulle de texte temporaire en pixels (3 secondes) s'élève au-dessus de l'agent dès qu'une nouvelle phrase clé est observée.

#### Parcours de DrSmoke en 4 gestes
1. DrSmoke clique sur l'onglet **Équipe** (ou tape `Ctrl+K` puis « Fil de l'équipe »).
2. Il survole le fil unifié pour prendre connaissance du statut de chaque agent en quelques secondes.
3. Il clique sur une bulle de parole pour ouvrir immédiatement le poste de l'agent, avec le terminal automatiquement positionné sur la ligne correspondante.
4. Il saisit directement sa réaction ou consigne dans la zone d'envoi rapide située sous le fil.

---

### Fonction 2 : Transfert de direction (Changement de chef et passation de quota)

#### Ce que c'est et ce qui la nourrit
Le chef coordonne l'équipe et occupe le bureau Direction. Si le chef actuel (par exemple Claude) approche de son plafond d'utilisation ou doit être remplacé temporairement par OpenCode ou Codex, DrSmoke doit pouvoir transférer la direction de façon explicite et ordonnée.
- **Données réelles** : configuration de l'agent désigné dans `state.boss`, détection de limite de quota (`quotaPause(boss)`), et délégations observées dans le journal du chef actif.
- **Règle d'intégrité** : aucune IA ne s'autoproclame chef. En cas de pause de quota du chef, le bureau signale l'événement et propose un suppléant disponible, mais attend la décision de DrSmoke.

#### Où elle vit
- **Dans l'onglet Équipe** : un encart « Direction de l'équipe » affichant le chef en titre, avec un bouton « Changer de chef ».
- **Sur la scène** : le bureau Direction (boiseries dorées, moquette violette) accueille physiquement l'agent désigné comme chef. Lors d'une passation, l'ancien chef regagne un poste standard et le nouveau chef prend place au bureau Direction.
- **En alerte d'attention** : si le chef entre en pause de quota, un bandeau discret propose la passation temporaire vers le premier agent disponible.

#### Parcours de DrSmoke en 4 gestes
1. DrSmoke clique sur le bureau Direction dans la scène (ou sur « Direction » dans l'onglet Équipe).
2. Il clique sur le bouton **« Changer de chef »** (ou clique sur « Désigner un suppléant » dans le bandeau de pause de quota).
3. Une liste modale présente les agents connectés éligibles avec leur statut et quota restant ; DrSmoke choisit le nouvel agent coordinateur.
4. Il clique sur **« Confirmer le transfert »** : le serveur met à jour la gouvernance, le nouvel agent s'installe au bureau Direction, et la détection des délégations bascule sur son journal.

---

### Fonction 3 : Priorité des envois dans la file d'attente

#### Ce que c'est et ce qui la nourrit
La file d'attente serveur (`src/queue.mjs`) retient les consignes destinées aux agents occupés ou en pause de limite. Certaines directives stratégiques ou correctives doivent pouvoir passer avant des tâches de routine.
- **Données réelles** : liste ordonnée des consignes dans `data/queue.json`, avec niveau de priorité (`priorite: 'haute' | 'normale'`) et heure de soumission.
- **Règle d'intégrité** : le départ reste assujetti à la disponibilité physique de l'agent. La priorité ne force jamais un envoi vers un agent occupé ou bloqué.

#### Où elle vit
- **Dans l'onglet Poste** : lors de la rédaction, une case à cocher optionnelle « Envoi prioritaire (tête de file) ».
- **Dans l'onglet Équipe (section File d'attente)** : chaque élément de la file présente deux flèches de réorganisation (monter/descendre), un badge « Urgent » rougeoyant si prioritaire, et le bouton « Retirer ».

#### Parcours de DrSmoke en 3 gestes
1. Dans l'onglet **Équipe**, DrSmoke repère la consigne urgente en attente dans la liste de la file.
2. Il clique sur le bouton **« Passer en tête »** (ou flèche vers le haut).
3. La consigne se place immédiatement au premier rang de traitement pour cet agent et partira à sa toute première seconde de disponibilité.

---

### Fonction 4 : Envoi de fichiers avec une consigne

#### Ce que c'est et ce qui la nourrit
Permettre à DrSmoke d'attacher explicitement des fichiers du projet (spécification, journal, code source) à la consigne envoyée à un agent, sans avoir à ressaisir manuellement leur chemin complet.
- **Données réelles** : catalogue des fichiers du projet vérifiés par `src/files.mjs`.
- **Règle d'intégrité** : seuls les chemins relatifs existants et autorisés dans le projet peuvent être joints. Aucun chemin système arbitraire n'est transmis.

#### Où elle vit
- **Dans l'onglet Poste** : sous la zone de texte de consigne, un bouton « Joindre un fichier » et une zone de dépôt où glisser un fichier.
- **Dans l'onglet Fichiers** : sur chaque fichier listé, un bouton d'action rapide « Joindre à la consigne de [Nom de l'agent sélectionné] ».

#### Parcours de DrSmoke en 4 gestes
1. Dans l'onglet **Poste**, DrSmoke saisit sa consigne textuelle.
2. Il clique sur le bouton **« Joindre un fichier »** (ou glisse un fichier depuis l'onglet Fichiers).
3. Il sélectionne le fichier souhaité dans la liste déroulante des fichiers récents du projet (ex. `docs/aide.md`).
4. Une pastille avec le nom du fichier et sa taille apparaît sous le texte ; DrSmoke appuie sur `Ctrl+Entrée` pour expédier la consigne enrichie du chemin exact.

---

### Fonction 5 : Traitement de fichiers (Mission confiée et suivi jusqu'au résultat)

#### Ce que c'est et ce qui la nourrit
Cette fonction matérialise le cycle de vie complet d'un fichier confié à un agent : attribution de propriété, verrouillage logique contre les conflits concurrents, surveillance de l'écriture sur disque, et vérification finale.
- **Données réelles** : règle « Un fichier, un propriétaire » de `AGENTS.md`, horodatages de modification (`mtime`), commandes de validation (`git status`, `git diff`) et journaux locaux.
- **Règle d'intégrité** : un fichier n'est jamais déclaré « validé » tant que ses tests et son diff n'ont pas été constatés. Le bureau ne prétend jamais qu'un code marche sans preuve.

#### Où elle vit
- **Sur la scène** : un classeur doré apparaît sur le bureau de l'agent pendant toute la durée où un fichier lui est confié.
- **Dans l'onglet Fichiers** : un bandeau supérieur « Fichiers en cours de traitement » liste pour chaque agent le fichier dont il est responsable, avec son état d'avancement réel.
- **Dans l'onglet Poste** : une section « Document confié » rappelle le fichier de travail avec bouton « Voir les modifications (git diff) ».

#### Parcours de DrSmoke en 4 gestes
1. Dans l'onglet **Fichiers**, DrSmoke sélectionne le fichier à modifier (ex. `README.md`).
2. Il clique sur **« Confier à un agent »**, choisit par exemple *Antigravity*, et précise la mission dans le champ pré-rempli.
3. Il clique sur **« Lancer la mission »** : la consigne part à l'agent, et le fichier est marqué comme « Détenu par Antigravity » dans toute l'interface.
4. Dès que l'agent termine, l'onglet Fichiers affiche un bouton vert **« Inspecter le git diff »** permettant à DrSmoke de vérifier le résultat avant tout commit.

---

### Fonction 6 : Les Tuiles (Bureau modulaire en fenêtres et mosaïque)

#### Ce que c'est et ce qui la nourrit
Offrir une alternative à la vue classique (scène à gauche, panneau à droite) sous la forme d'une mosaïque de terminaux actifs permettant à DrSmoke de surveiller 2 à 4 agents simultanément.
- **Données réelles** : flux réels des terminaux `/api/read` interrogés en parallèle pour les postes affichés, avec mise en veille des tuiles masquées.
- **Règle d'intégrité** : pas de surcharge réseau ; le rafraîchissement simultané est borné aux tuiles visibles.

#### Où elle vit
- **Dans la barre d'outils du bureau** (en haut de la scène) : un bouton commutable **« Mosaïque »** à côté de « Plein écran » et « Disposer ».
- **Dans chaque tuile** : en-tête compact avec nom, outil, jauge de limite, barre de recherche, bouton agrandir et champ de consigne rapide.

#### Parcours de DrSmoke en 3 gestes
1. DrSmoke clique sur le bouton **« Mosaïque »** dans la barre d'outils (ou raccourci clavier `Ctrl+K` > « Mode mosaïque »).
2. L'interface bascule en vue grille 2x2 ou côte à côte présentant les terminaux des agents actifs en direct.
3. Il tape sa consigne directement dans la tuile de l'agent ciblé, ou clique sur « Vue scène » pour revenir instantanément au décor animé.

---

### Fonction 7 : La Salle de crise (Disjoncteur général et diagnostic d'urgence)

#### Ce que c'est et ce qui la nourrit
Un mécanisme d'interruption et de protection d'urgence conçu pour reprendre la main en cas d'emballement d'un agent, de boucle de messages incontrôlée ou de défaillance réseau critique.
- **Données réelles** : état de santé des liaisons Herdr, erreurs répétées lues dans les terminaux, consommation anormale de requêtes.
- **Règle d'intégrité** : la salle de crise ne tue aucun processus de manière barbare (ce qui risquerait de corrompre des fichiers sur disque). Elle gèle instantanément tous les départs de consignes du bureau, suspend la file d'attente et offre une interface de diagnostic calme et sécurisée.

#### Où elle vit
- **Dans l'en-tête principal** : un bouton de sécurité rougeoyant discret **« Salle de crise »** (ou raccourci de secours `Ctrl+Maj+C`).
- **Sur la scène** : bascule de l'éclairage en lumière ambrée de sécurité, sirène visuelle en pixels.
- **Fenêtre modale dédiée** : tableau de bord de secours affichant l'état figé de chaque panneau Herdr, la liste des consignes stoppées, et un bouton unitaire « Demander l'arrêt propre » pour chaque agent.

#### Parcours de DrSmoke en 4 gestes
1. Face à un comportement anormal, DrSmoke clique sur le bouton **« Salle de crise »** en haut de l'écran.
2. Tous les envois automatiques de la file sont immédiatement verrouillés et les rafraîchissements automatiques sont suspendus.
3. Une fenêtre d'urgence liste chaque agent avec sa dernière action et son diagnostic ; DrSmoke clique sur **« Arrêter cet agent »** sur le poste en dérive pour lui envoyer poliment l'ordre d'arrêt.
4. Une fois la situation assainie, DrSmoke clique sur **« Lever la crise »** pour reprendre l'exploitation normale.

---

## 3. Ce qui doit être regroupé et ce qui doit être séparé

### Ce qui doit être regroupé (Cohérence fonctionnelle)
1. **Coordination collective dans l'onglet « Équipe »** : le fil de discussion (Standup), le courrier du chef, le transfert de direction et la file d'attente priorisée constituent le centre névralgique de gestion d'équipe. Les réunir dans un même onglet évite les allers-retours inutiles.
2. **Action unitaire dans l'onglet « Poste »** : le terminal brut, la barre d'état, la recherche, l'envoi de consigne et les pièces jointes forment un poste de travail complet pour un agent donné.
3. **Traçabilité du code dans l'onglet « Fichiers »** : la règle d'attribution des fichiers, le verrouillage de propriété et l'inspection des diffs doivent vivre ensemble avec l'explorateur de récents.

### Ce qui doit être séparé (Clarté et prévention des erreurs)
1. **Séparer le fil de discussion (Standup) des sorties brutes de terminal** : le fil de discussion extrait les messages de haut niveau (décisions, blocages, fin de mission) ; le terminal conserve l'exhaustivité technique (traces d'erreurs, lignes de compilation, tests). Les mélanger rendrait le fil illisible.
2. **Séparer la gestion courante de la salle de crise** : la file d'attente et les envois courants relèvent du confort opérationnel ; la salle de crise est un interrupteur d'exception qui doit rester isolé pour prévenir tout déclenchement accidentel.
3. **Séparer l'affichage en tuiles du mode scène** : la scène en pixel art est le mode par défaut immersif et apaisant ; le mode tuiles est un mode technique d'ingénierie activable à la demande.

---

## 4. Ordre de réalisation recommandé (Feuille de route)

Pour progresser sans jamais régresser sur la stabilité exemplaire du bureau (187 tests au vert), la mise en œuvre est découpée en 4 phases progressives :

### Phase 1 : Ergonomie des flux et fichiers (Priorité immédiate, faible risque)
- **1. Priorité dans la file d'attente** : ajout des flèches monter/descendre dans l'onglet Équipe et gestion de l'ordre de priorité dans `src/queue.mjs`.
- **2. Envoi de fichiers joints avec une consigne** : ajout du sélecteur de fichiers du projet sous le formulaire de consigne de l'onglet Poste et transmission de l'argument à la passerelle Herdr.
- *Effort* : Petit. Aucun impact sur la scène canvas.

### Phase 2 : Traitement de fichiers et gouvernance (Sécurité du code)
- **3. Fichier confié à un agent et suivi du diff** : matérialisation du propriétaire d'un fichier dans l'onglet Fichiers, affichage du classeur sur le bureau de l'agent dans la scène, et lien direct vers `git diff` à la fin des travaux.
- *Effort* : Moyen. Renforce l'application de la règle « Un fichier, un propriétaire » de `AGENTS.md`.

### Phase 3 : Salle de contrôle et Standup (Vision collective)
- **4. Fil de discussion (Standup des agents)** : lecture des messages clés publiés par les agents dans leurs journaux et affichage du flux chronologique unifié dans l'onglet Équipe et en bulles éphémères sur la scène.
- **5. Transfert de direction et passation de quota** : commande de changement de chef dans l'onglet Équipe et aménagement visuel du bureau Direction lors du passage de témoin.
- *Effort* : Moyen. Donne au bureau sa véritable dimension de tour de contrôle collective.

### Phase 4 : Structure avancée et résilience (Grands chantiers)
- **6. Disjoncteur « Salle de crise »** : bouton d'urgence sous clapet, gel immédiat des files d'envoi et modale de diagnostic et d'arrêt ordonné.
- **7. Mode Mosaïque en tuiles modulaires** : refonte du conteneur principal pour permettre l'affichage commutable de 2 à 4 terminaux côte à côte avec gestion sobre de la bande passante locale.
- *Effort* : Grand. À réaliser une fois les flux fonctionnels pleinement rodés.
