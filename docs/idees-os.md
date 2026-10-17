# Vision OS : 8 idées audacieuses pour transformer le Bureau des agents

Ce document propose 8 innovations majeures pour faire évoluer le « Bureau des agents » d'un simple tableau de bord vers un véritable système d'exploitation visuel et opérationnel pour agents d'intelligence artificielle.

Chaque idée est ancrée dans des données réelles existantes sur cette machine et classée par ordre d'effet « waouh » utile.

---

## 1. La Passerelle de Relais Inter-Agents avec Feu Vert Humain (Rang 1)

### Ce que voit DrSmoke
Quand un agent termine sa tâche (par exemple Claude achève une spécification dans le panneau `w5:p1`), le bureau détecte la fin de mission. Une flèche animée en pixels relie son bureau à celui d'un autre agent disponible (par exemple Codex dans `w5:p4`). Un bandeau interactif ambre apparaît :
« Claude a terminé sa spec. Proposer le relais à Codex pour implémenter les tests ? »
DrSmoke peut relire le message pré-rempli, le modifier, puis cliquer sur un bouton « Valider le relais ». La consigne est alors transmise à Codex sans que DrSmoke n'ait eu à copier-coller du texte entre terminaux.

### La donnée réelle qui la nourrit
- La transition d'état observée dans `changes.get(a.id)` (`from: working`, `to: done` ou `idle`).
- L'extrait des dernières sorties lu par `GET /api/read?id=...` (recherche du résumé final produit par l'agent).
- La liste des agents disponibles vérifiée par `canSend(target)`.
- La transmission finale par l'endpoint sécurisé `POST /api/prompt` avec le jeton de session existant.

### Le risque et sa parade
- Risque : Boucle d'envoi incontrôlée où deux agents se renvoient des messages en boucle infinie, ou transmission d'une consigne erronée.
- Parade : Aucun envoi automatique en coulisse. Le bureau ne fait que suggérer et préparer le texte ; le clic humain explicite de DrSmoke reste obligatoire pour tout départ de message.

### Effort
Moyen (détection de fin de tâche côté client et modale de confirmation pré-remplie).

---

## 2. La Palette de Commandes Universelle (Spotlight `Ctrl+K`) (Rang 2)

### Ce que voit DrSmoke
En appuyant sur `Ctrl+K` (ou `Cmd+K`), une palette de commandes élégante s'ouvre au centre de l'écran en surimpression semi-transparente. DrSmoke peut taper :
- `@claude` pour basculer instantanément sur le poste de Claude ;
- `/model sonnet` pour préparer un changement de modèle ;
- `/test` ou `/brainstorming` pour déclencher une compétence slash ;
- `@tous` suivi d'un message pour préparer un envoi groupé sans toucher la souris.
L'autocomplétion propose en direct les noms des agents connectés et leurs compétences disponibles.

### La donnée réelle qui la nourrit
- La liste active des agents dans `state.agents` (`id`, `name`, `kind`, `paneId`).
- L'inventaire des compétences locales répertoriées dans `~/.claude/skills/`, `~/.gemini/config/skills/`, `~/.codex/config.toml` et `~/.config/opencode/skills/`.
- Les modèles réels répertoriés dans `docs/commandes-outils.md`.

### Le risque et sa parade
- Risque : Collision avec les raccourcis de recherche du navigateur ou frappe d'une commande destructrice (`/clear`, `/exit`).
- Parade : Empêcher le comportement par défaut (`e.preventDefault()`), filtrer strictement les commandes dangereuses pour ne jamais les exécuter automatiquement, et exiger une confirmation visuelle avant toute expédition.

### Effort
Petit à Moyen (composant JavaScript natif sans dépendance, écoute du clavier et filtrage flou simple).

---

## 3. Le Dock d'Activités Flottant et Fenêtres Multi-Terminaux (Rang 3)

### Ce que voit DrSmoke
Plutôt que d'être confiné à un seul terminal latéral de 400 px, DrSmoke peut cliquer sur une icône « Détacher » pour transformer la console de n'importe quel agent en une fenêtre flottante redimensionnable et déplaçable sur l'écran.
DrSmoke peut ainsi observer deux agents travailler côte à côte sur deux fenêtres de 80 colonnes chacune, ou minimiser un terminal dans un « Dock » d'icônes situé en bas de l'écran. Chaque icône du dock possède une pastille pulsante de la couleur de l'état (bleu qui frappe, ambre qui clignote en cas d'attente).

### La donnée réelle qui la nourrit
- Les appels existants à `/api/read?id=...` gérés en parallèle pour chaque fenêtre active sur l'écran.
- La structure HTML existante de `public/terminal.js` encapsulée dans des conteneurs modulaires.

### Le risque et sa parade
- Risque : Surcharge de requêtes réseau (`/api/read`) si 4 terminaux sont ouverts en même temps, et complexité de mise en page.
- Parade : Mettre en sommeil la lecture des fenêtres minimisées dans le dock, limiter l'actualisation simultanée à 2 fenêtres actives maximum à 3 secondes d'intervalle, et conserver le plein écran natif en option.

### Effort
Grand (gestion des fenêtres flottantes, z-index, drag-and-drop et redimensionnement en pur CSS/JS).

---

## 4. Le Tableau Mural de Mémoire Partagée (Shared Blackboard) (Rang 4)

### Ce que voit DrSmoke
Sur le mur du bureau animé, entre la baie vitrée et l'enseigne, le panneau d'affichage devient interactif. En cliquant dessus, DrSmoke ouvre une fiche de synthèse partagée :
- Objectif global du sprint en cours (par exemple : « Préparer la publication GitHub »).
- Matrice de verrouillage des fichiers : qui travaille sur quoi en ce moment (ex. « Claude sur public/ », « Codex sur src/ et server.mjs », « OpenCode sur scripts/ »).
- Décisions d'architecture prises par DrSmoke que chaque agent doit respecter.

### La donnée réelle qui la nourrit
- Le contenu des fichiers de projet locaux existants : `HANDOFF.md`, `TODO.md` et `LESSONS.md`.
- Un endpoint serveur léger `GET /api/blackboard` qui lit ces fichiers Markdown et les transmet en JSON sans les modifier.

### Le risque et sa parade
- Risque : Conflit de modification concurrente entre agents écrivant en même temps dans le fichier de mémoire.
- Parade : La mémoire centrale affichée dans le bureau reste en lecture seule pour la visualisation, avec édition réservée à DrSmoke ou synchronisée via Git.

### Effort
Moyen (route serveur pour lire le Markdown et modale de lecture soignée avec rendu typographique).

---

## 5. Le Centre de Notifications Sonores Rétro 8-bit et Toasts (Rang 5)

### Ce que voit et entend DrSmoke
Quand DrSmoke travaille sur une autre application et garde le bureau en arrière-plan :
- Lorsqu'un agent termine son travail : une courte mélodie rétro triomphante en 8-bit (rappelant un jeu d'arcade) retentit, accompagnée d'une pluie de confettis en pixels sur son poste.
- Lorsqu'un agent est bloqué et demande une autorisation : un carillon doux en deux tons signale discrètement le besoin de validation.
- Un toast visuel apparaît dans le coin supérieur droit : « Codex attend ta réponse dans w5:p4 ».

### La donnée réelle qui la nourrit
- La fonction existante `trackChanges()` dans `public/app.js` qui compare déjà l'ancien état `prev` et le nouvel état `a.status`.
- La Web Audio API native du navigateur (utilisant `AudioContext` et un oscillateur à ondes carrées ou triangulaires, sans aucun fichier audio externe à télécharger).
- La Notification API du navigateur (pour les alertes système hors onglet).

### Le risque et sa parade
- Risque : Agressivité sonore ou blocage automatique de l'audio par le navigateur sans interaction préalable.
- Parade : Sons désactivés par défaut avec un bouton haut-parleur discret dans la barre du haut ; initialisation de l'AudioContext uniquement sur le premier clic de DrSmoke.

### Effort
Petit (environ 30 lignes de JavaScript natif avec Web Audio API, zéro octet de fichier son).

---

## 6. Le Radar de Fichiers Modifiés en Temps Réel (Git Live Radar) (Rang 6)

### Ce que voit DrSmoke
Sous chaque poste d'agent, une pastille indique en temps réel l'activité sur les fichiers :
« 3 fichiers modifiés · +45 / -12 lignes ».
En survolant ou en cliquant sur cette pastille, une infobulle déplie la liste précise des fichiers touchés par l'agent dans son dossier de travail (`M public/style.css`, `+ docs/idees-os.md`).
Si deux agents modifient le même fichier en parallèle, une balise d'alerte rouge clignote : « Conflit potentiel sur server.mjs ».

### La donnée réelle qui la nourrit
- Le champ `cwd` renvoyé par Herdr pour chaque agent dans `/api/state`.
- Une commande locale `git status --porcelain` exécutée périodiquement par le serveur dans chaque dossier de travail d'agent.

### Le risque et sa parade
- Risque : Ralentissement du serveur si le dépôt Git est très lourd, ou blocage si le dossier de travail n'est pas un dépôt Git.
- Parade : Intervalle de scrutation espacé (toutes les 6 à 10 secondes), exécution non bloquante et timeout strict de 2 secondes avec ignore propre si le dossier n'est pas sous Git.

### Effort
Moyen (nouvelle commande sécurisée dans `src/herdr.mjs` ou route dédiée `GET /api/agent-git`).

---

## 7. L'Arbre Vivant de Délégation des Sous-Agents (Rang 7)

### Ce que voit DrSmoke
Actuellement, les sous-agents de Claude sont représentés par de petits assistants statiques debout sur le bureau. Avec cette évolution, un clic sur ces assistants ouvre une vue en organigramme arborescent en pixels :
- Nœud parent : Claude (tâche principale, temps écoulé, jetons consommés).
- Nœuds enfants : Sous-agent 1 (Recherche documentaire, actif depuis 45 s), Sous-agent 2 (Vérification de code, terminé).
Une barre de progression temporelle et l'outil en cours d'exécution sont visibles pour chaque assistant.

### La donnée réelle qui la nourrit
- Le tableau d'objets `activity.subagents` déjà extrait en temps réel depuis le journal local par `src/claude-activity.mjs` (`id`, `description`, `tool_use_id`).
- L'historique des événements de démarrage et de fin déjà capturé dans la méthode `consumeLine` du serveur.

### Le risque et sa parade
- Risque : Complexité visuelle si un agent lance 8 sous-agents en cascade.
- Parade : Vue en popover compacte avec défilement propre, limitée aux sous-agents actifs et aux 3 derniers terminés.

### Effort
Moyen (les données existent déjà dans l'API, seule la modale graphique reste à concevoir).

---

## 8. Le Disjoncteur Général « Salle de Crise » (Panic & Triage Switch) (Rang 8)

### Ce que voit DrSmoke
Dans la barre d'en-tête, un interrupteur sécurisé sous clapet « Salle de crise » est disponible à tout moment. En cas d'emballement d'un agent, de boucle d'erreurs en cascade ou d'incompréhension générale, DrSmoke active l'interrupteur :
- Toutes les actions d'envoi du bureau sont instantanément verrouillées.
- L'affichage se fige sur les derniers états connus pour permettre l'analyse sans défilement intempestif.
- Un panneau de tri d'urgence s'ouvre, listant chaque panneau avec son état, ses derniers logs et un bouton individuel « Envoyer consigne d'arrêt propre : /stop ».

### La donnée réelle qui la nourrit
- Les identifiants de panneaux réels (`paneId`, ex. `w5:p1`) et les commandes d'arrêt documentées dans `docs/commandes-outils.md`.
- Un état booléen local dans le bureau `state.panicMode = true`.

### Le risque et sa parade
- Risque : Arrêter brutalement un agent qui était en pleine écriture critique de fichier sur disque.
- Parade : Le disjoncteur ne tue pas les processus au niveau du système d'exploitation ; il bloque les envois du bureau et propose l'arrêt poli et ordonné via consigne.

### Effort
Petit à Moyen (gestion d'état côté interface et panneau de diagnostic d'urgence).

---

## Synthèse comparative des 8 innovations

| Rang | Innovation | Donnée réelle d'alimentation | Niveau d'effort | Bénéfice opérationnel pour DrSmoke |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **Passerelle de relais inter-agents** | Événement `done` + sorties lues `/api/read` | Moyen | Enchaînement fluide des tâches entre agents sans copier-coller |
| **2** | **Palette universelle `Ctrl+K`** | Liste `/api/state` + skills des dossiers locaux | Petit/Moyen | Pilotage complet et ultra-rapide au clavier |
| **3** | **Dock et fenêtres multi-terminaux** | Flux `/api/read` multiples en parallèle | Grand | Surveillance simultanée de plusieurs agents qui codent |
| **4** | **Tableau de mémoire partagée** | Fichiers `HANDOFF.md` et `TODO.md` | Moyen | Alignement parfait de l'équipe sur les objectifs du sprint |
| **5** | **Notifications rétro 8-bit et toasts** | Événements `trackChanges()` dans l'app | Petit | Détection immédiate des besoins de réponse hors onglet |
| **6** | **Radar de fichiers Git en direct** | `git status` dans le dossier de travail | Moyen | Prévention des écrasements de fichiers entre agents |
| **7** | **Arbre vivant des sous-agents** | Données de `src/claude-activity.mjs` | Moyen | Visibilité complète sur les agents délégués en arrière-plan |
| **8** | **Disjoncteur général Salle de crise** | État local de blocage + commandes d'arrêt | Petit/Moyen | Reprise de contrôle immédiate en cas d'emballement |
