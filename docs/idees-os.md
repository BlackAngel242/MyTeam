# Vision OS : 8 idées audacieuses pour transformer le Bureau des agents

Ce document propose 8 innovations majeures pour faire évoluer le « Bureau des agents » d'un simple tableau de bord vers un véritable système d'exploitation visuel et opérationnel pour agents d'intelligence artificielle.

Le concept architectural central a été validé par DrSmoke : **le premier agent démarré dans Herdr est le chef (« boss », bureau VIP), les autres sont ses agents**.
Toute la vie du bureau repose sur une règle d'airain : **la vérité des faits**. Rien n'est inventé ou simulé, chaque animation et indicateur découle directement de faits observés sur le disque ou dans Herdr.

---

## 1. La Passerelle de Délégation et Courrier Chef-Agents (Rang 1)

### Ce que voit DrSmoke
- Le Chef (premier agent démarré) trône à son bureau VIP.
- Quand le chef délègue une tâche (détection de la commande `herdr agent prompt` dans son journal local), une animation montre l'agent concerné se lever, venir au bureau VIP chercher sa consigne, puis retourner s'asseoir à son propre poste pour travailler.
- Quand l'agent a terminé sa mission, il expédie un « courrier » en pixels vers le bureau du chef.
- Le chef reçoit le dossier et apprécie le résultat : son humeur reflète fidèlement les résultats observés (succès, tests réussis ou blocage).
- Si une erreur est constatée, elle vient directement enrichir le fichier `LESSONS.md`.

### La donnée réelle qui la nourrit
- La commande `herdr agent prompt <cible> <message>` interceptée dans le journal ou l'activité de l'agent coordinateur.
- La transition d'état observée dans `changes.get(a.id)` (`from: working`, `to: done` ou `idle`).
- Les sorties réelles de l'agent lues par `GET /api/read?id=...`.
- Le fichier `LESSONS.md` inspecté et mis à jour lors de l'apparition d'erreurs documentées.

### Le risque et sa parade
- Risque : Boucle d'envoi incontrôlée entre le chef et ses agents, ou invention de faux courriers et de fausses humeurs.
- Parade : Règle de vérité des faits. L'animation ne démarre que sur une commande de délégation réellement tracée. DrSmoke conserve le contrôle absolu avec un bouton de validation avant tout réenvoi vers un agent.

### Effort
Moyen (détection des délégations en cours par OpenCode, animation du personnage se déplaçant au bureau VIP).

---

## 2. La Salle de Réflexion et Rapport de Dossiers des Sous-Agents (Rang 2)

### Ce que voit DrSmoke
Quand un agent (comme Claude) active des sous-agents internes pour des tâches de recherche, d'exploration ou de test :
- Les sous-agents ne s'entassent pas sur le bureau principal : ils se déplacent vers une « salle de réflexion » animée sur la scène (war room en pixels).
- Ils y débattent et travaillent ensemble.
- Dès que leur tâche se termine, ils reviennent au poste de leur agent parent pour lui rapporter leur « dossier » (rapport ou fichier de synthèse).

### La donnée réelle qui la nourrit
- Les sous-agents réels extraits du journal local de Claude par `src/claude-activity.mjs` (`activity.subagents`).
- Les événements `tool_use` de type `Agent` et `Task` et leurs résolutions respectives (`completed`, `failed`).

### Le risque et sa parade
- Risque : Confusion visuelle si plusieurs agents lancent simultanément des dizaines de sous-agents.
- Parade : Limitation à l'affichage des sous-agents réellement actifs dans la salle de réflexion, avec compteur chiffré des dossiers déposés.

### Effort
Moyen (déjà réalisé et validé au commit `7817574`, peaufinage de l'animation de retour).

---

## 3. La Palette de Commandes Universelle (Spotlight `Ctrl+K`) (Rang 3)

### Ce que voit DrSmoke
En appuyant sur `Ctrl+K` (ou `Cmd+K`), une palette de commandes élégante s'ouvre au centre de l'écran en surimpression semi-transparente. DrSmoke peut taper :
- `@claude` pour basculer instantanément sur le poste du chef ou d'un collaborateur ;
- `/model sonnet` pour préparer un changement de modèle documenté dans `docs/commandes-outils.md` ;
- `/brainstorming` ou `/pua` pour déclencher une compétence slash ;
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

## 4. L'Explorateur de Fichiers Vivant et Verrouillage d'Équipe (Rang 4)

### Ce que voit DrSmoke
Un panneau dédié permet de naviguer dans les fichiers récents modifiés par les agents.
- Une barre d'état sous chaque poste indique les fichiers en cours d'édition.
- Un système de balises visuelles signale les fichiers piliers (`README.md`, `PRODUCT.md`, `LESSONS.md`) et indique qui en détient la propriété pour éviter les conflits concurrents.
- DrSmoke peut inspecter les diffs en direct sans sortir du bureau.

### La donnée réelle qui la nourrit
- Le module `src/files.mjs` (déjà implémenté) qui sécurise la lecture de fichiers sans écrasement ni suppression.
- La surveillance de `git status --porcelain` dans le dossier du projet.

### Le risque et sa parade
- Risque : Écrasement accidentel de fichier ou fuite de secret.
- Parade : Mode lecture seule strict dans le bureau ; aucun chemin absolu venant du navigateur n'est accepté par le serveur.

### Effort
Petit (déjà réalisé et validé au commit `7817574`).

---

## 5. Le Dock d'Activités Flottant et Fenêtres Multi-Terminaux (Rang 5)

### Ce que voit DrSmoke
Plutôt que d'être confiné à un seul terminal latéral, DrSmoke peut cliquer sur une icône « Détacher » pour transformer la console de n'importe quel agent en une fenêtre flottante redimensionnable et déplaçable sur l'écran.
DrSmoke peut ainsi observer le chef et un agent travailler côte à côte sur deux fenêtres de 80 colonnes chacune, ou minimiser un terminal dans un « Dock » d'icônes situé en bas de l'écran avec pastille d'état pulsante.

### La donnée réelle qui la nourrit
- Les flux `/api/read?id=...` interrogés en parallèle pour chaque fenêtre active sur l'écran.
- La structure HTML existante de `public/terminal.js` encapsulée dans des conteneurs modulaires.

### Le risque et sa parade
- Risque : Surcharge de requêtes réseau (`/api/read`) si plusieurs terminaux sont ouverts en même temps.
- Parade : Mettre en sommeil la lecture des fenêtres minimisées dans le dock, et limiter l'actualisation simultanée à 2 fenêtres actives maximum.

### Effort
Grand (gestion des fenêtres flottantes, z-index, drag-and-drop et redimensionnement en pur CSS/JS).

---

## 6. Le Centre de Notifications Sonores Rétro 8-bit et Toasts (Rang 6)

### Ce que voit et entend DrSmoke
Quand DrSmoke garde le bureau en arrière-plan :
- Lorsqu'un agent termine son travail : une courte mélodie rétro triomphante en 8-bit retentit, accompagnée de confettis en pixels sur son poste.
- Lorsqu'un agent est bloqué et demande une autorisation : un carillon doux en deux tons signale discrètement le besoin de validation.
- Un toast visuel apparaît : « Codex attend ta réponse dans w5:p4 ».

### La donnée réelle qui la nourrit
- La fonction existante `trackChanges()` dans `public/app.js` qui compare déjà l'ancien état `prev` et le nouvel état `a.status`.
- La Web Audio API native du navigateur (utilisant `AudioContext` et un oscillateur à ondes carrées ou triangulaires, zéro octet de fichier son).
- La Notification API du navigateur.

### Le risque et sa parade
- Risque : Agressivité sonore ou blocage automatique de l'audio par le navigateur sans interaction préalable.
- Parade : Sons désactivés par défaut avec bouton haut-parleur discret ; initialisation de l'AudioContext uniquement sur le premier clic de DrSmoke.

### Effort
Petit (environ 30 lignes de JavaScript natif avec Web Audio API).

---

## 7. Le Tableau Mural de Mémoire Partagée (Shared Blackboard) (Rang 7)

### Ce que voit DrSmoke
Sur le mur du bureau animé, entre la baie vitrée et l'enseigne, le panneau d'affichage devient interactif :
- Objectif global du sprint en cours.
- Répartition des rôles : Chef (Claude), Codex, Antigravity, OpenCode.
- Décisions d'architecture prises par DrSmoke que chaque agent doit respecter.

### La donnée réelle qui la nourrit
- Le contenu des fichiers locaux existants : `HANDOFF.md`, `TODO.md` et `LESSONS.md`.
- Un endpoint serveur léger `GET /api/blackboard` qui lit ces fichiers Markdown sans les modifier.

### Le risque et sa parade
- Risque : Conflit de modification concurrente entre agents écrivant en même temps dans le fichier de mémoire.
- Parade : La mémoire centrale affichée dans le bureau reste en lecture seule pour la visualisation, avec édition réservée à DrSmoke ou synchronisée via Git.

### Effort
Moyen (route serveur pour lire le Markdown et modale de lecture soignée).

---

## 8. Le Disjoncteur Général « Salle de Crise » (Panic & Triage Switch) (Rang 8)

### Ce que voit DrSmoke
Dans la barre d'en-tête, un interrupteur sécurisé sous clapet « Salle de crise » est disponible à tout moment. En cas d'emballement d'un agent ou de boucle d'erreurs :
- Toutes les actions d'envoi du bureau sont instantanément verrouillées.
- L'affichage se fige sur les derniers états connus pour permettre l'analyse sans défilement intempestif.
- Un panneau de tri d'urgence liste chaque panneau avec son état, ses derniers logs et un bouton individuel pour envoyer un arrêt propre.

### La donnée réelle qui la nourrit
- Les identifiants de panneaux réels (`paneId`, ex. `w5:p1`) et les commandes d'arrêt documentées dans `docs/commandes-outils.md`.
- Un état booléen local dans le bureau `state.panicMode = true`.

### Le risque et sa parade
- Risque : Arrêter brutalement un agent qui était en pleine écriture critique de fichier sur disque.
- Parade : Le disjoncteur ne tue pas les processus au niveau du système d'exploitation ; il bloque les envois du bureau et propose l'arrêt poli et ordonné via consigne.

### Effort
Petit à Moyen (gestion d'état côté interface et panneau de diagnostic d'urgence).

---

## Synthèse d'avancement au 17 octobre 2026

| Innovation | Statut | Détail de l'état réel |
| :--- | :---: | :--- |
| **Chef au bureau VIP** | **Terminé** | Le premier agent démarré est mis en valeur au poste VIP dans la scène pixel. |
| **Salle de réflexion des sous-agents** | **Terminé** | Pièce animée dédiée avec déplacement des sous-agents (validé au commit `7817574`). |
| **Explorateur de fichiers local** | **Terminé** | Module `src/files.mjs` opérationnel avec navigation sécurisée sans suppression. |
| **Barre d'état par IA** | **Terminé** | Statut détaillé en direct sous chaque poste d'agent. |
| **Télémétrie Codex et OpenCode** | **Terminé** | Module `src/agent-activity.mjs` opérationnel avec tests passants. |
| **Détection des délégations** | *En cours* | Travail en cours par OpenCode sur l'interception de `herdr agent prompt`. |
| **Courrier et humeur factuelle** | *En cours* | Logique de fin de mission et mise à jour de `LESSONS.md`. |
| **Palette `Ctrl+K` et sons 8-bit** | *Planifié* | Prochaine étape ergonomique pour la version 0.3.0. |
