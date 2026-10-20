# Guide des commandes d'outils et de pilotage

Ce document recense les commandes internes, la gestion des modèles et le déclenchement des compétences (skills) pour les 5 agents pris en charge dans l'écosystème : Claude Code, Codex, OpenCode, Antigravity et Gemini CLI.

Référence technique issue de l’aide des outils consultée en octobre 2026. Les commandes, modèles et emplacements dépendent de la version installée : vérifier `--help` avant usage. Les chemins ci-dessous sont des emplacements génériques, pas un inventaire de configuration personnelle.

---

## 1. Claude Code (`claude`)

### Commande pour changer de modèle
- Commande tapée dans l'outil : `/model` ou `/model <nom>` (par exemple `/model sonnet`, `/model opus`, `/model haiku`).
- Comportement : Si la commande `/model` est envoyée seule, elle ouvre un menu interactif avec sélection par flèches. Si un nom ou alias direct est fourni en argument (`/model opus`), le changement est appliqué directement.
- Statut : Vérifié (aide `claude --help`, fichier de configuration `~/.claude/settings.json` et documentation officielle Claude Code).

### Où lire la liste des modèles disponibles localement
- Emplacement : Dans `~/.claude/settings.json` (le champ `"model"` indique le modèle actif). L'aide `claude --help` liste le modèle d'exécution par défaut (`claude-3-7-sonnet-20250219`) et les options `--model <model>` et `--fallback-model <model>`. Les alias courts reconnus sont `sonnet`, `opus` et `haiku`.
- Statut : Vérifié.

### Comment lister et lancer une compétence ou commande personnalisée
- Lister les compétences : Dans la session, taper `/help`, `/skills` ou `/plugins`. En ligne de commande hors session : `claude plugins list`.
- Emplacements locaux : Les compétences personnelles sont stockées dans `~/.claude/skills/` (et dans les plugins activés listés dans `~/.claude/settings.json` sous `"enabledPlugins"`). Les compétences propres au projet se situent dans `.claude/skills/`.
- Lancer une compétence : Taper `/<nom-de-competence>` dans l'invite (par exemple `/commit`, `/review-pr`, `/brainstorming`), ou formuler une demande naturelle mentionnant explicitement la compétence.
- Statut : Vérifié.

### Commandes à NE JAMAIS proposer en un clic
- `/exit` ou `/quit` : Termine immédiatement le REPL sans préavis.
- `/clear` ou `/reset` : Efface brutalement tout l'historique et la mémoire de travail de la session active.
- `/compact` : Déclenche un compactage forcé avec compression irréversible du contexte récent.
- `--dangerously-skip-permissions` : Désactive tous les contrôles d'autorisation et autorise l'accès complet sans validation humaine.
- Statut : Vérifié.

---

## 2. OpenAI Codex CLI (`codex`)

### Commande pour changer de modèle
- Commande tapée dans l'outil : `/model` dans le terminal interactif TUI (ouvre le sélecteur interactif des modèles configurés), ou au lancement via `codex -m <nom>` ou `codex -c model="<nom>"`.
- Comportement : `/model` ouvre un menu déroulant interactif dans l'interface TUI. En ligne de commande ou via configuration, un nom direct (`gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-astra`, `o3`) est accepté sans invite.
- Statut : Vérifié (aide `codex --help`, fichier `~/.codex/config.toml`).

### Où lire la liste des modèles disponibles localement
- Emplacement : Dans le fichier local `~/.codex/models.json` (liste les objets de modèles avec leur identifiant `slug`, leur nom d'affichage `display_name` et leurs priorités). Le modèle par défaut est défini dans `~/.codex/config.toml` via `model = "..."`.
- Statut : Vérifié (emplacement à vérifier selon la version installée).

### Comment lister et lancer une compétence ou commande personnalisée
- Lister les compétences et plugins : En ligne de commande via `codex plugin` ou dans le TUI avec `/help`.
- Emplacements locaux : Configuré dans `~/.codex/config.toml` sous les tables `[plugins]` (plugins locaux ou bundlés).
- Lancer une compétence : Taper la commande de plugin correspondante ou lancer un prompt ciblé (ex. `/review` pour une revue de code automatique).
- Statut : Vérifié.

### Commandes à NE JAMAIS proposer en un clic
- `/exit` ou `/quit` : Ferme la session Codex.
- `codex delete <session>` : Supprime définitivement une session et son historique sur disque.
- `--dangerously-bypass-approvals-and-sandbox` : Ignore toutes les demandes d'approbation et exécute les commandes sans aucun bac à sable.
- `--dangerously-bypass-hook-trust` : Exécute les hooks sans vérifier leur empreinte de confiance.
- Statut : Vérifié.

---

## 3. OpenCode (`opencode`)

### Commande pour changer de modèle
- Commande tapée dans l'outil : `/model` dans le TUI pour ouvrir la palette de sélection des modèles, ou `/model <fournisseur/modele>` (par exemple `/model mimo/mimo-v2.6-flash`).
- Comportement : `/model` sans paramètre affiche la liste interactive des modèles disponibles par fournisseur. Avec argument, il bascule directement sur le modèle demandé.
- Statut : Vérifié (aide `opencode --help`, commande `opencode models`).

### Où lire la liste des modèles disponibles localement
- Emplacement : Directement en exécutant la commande CLI `opencode models` (qui interroge les fournisseurs configurés et retourne la liste exacte des identifiants valides), ainsi que dans `~/.config/opencode/opencode.json` (sections `providers` et champ `small_model`).
- Statut : Vérifié (`opencode models` à vérifier selon les fournisseurs configurés).

### Comment lister et lancer une compétence ou commande personnalisée
- Lister les compétences : Via `opencode plugin` ou par consultation du dossier local de compétences `~/.config/opencode/skills/`.
- Lancer une compétence : Taper `/<nom>` dans l'invite de saisie ou déclenchement direct par le planificateur de tâches.
- Statut : Vérifié.

### Commandes à NE JAMAIS proposer en un clic
- `opencode uninstall` : Supprime les binaires d'OpenCode de la machine.
- `--auto` : Auto-approuve aveuglément toutes les permissions non explicitement refusées.
- `/clear` : Efface le contexte de conversation en cours.
- `/exit` : Ferme le serveur ou la session interactive.
- Statut : Vérifié.

---

## 4. Google Antigravity CLI (`agy`)

### Commande pour changer de modèle
- Commande tapée dans l'outil : `/model` dans l'interface interactive pour ouvrir la sélection, ou en argument direct lors du lancement via `agy --model <nom>` avec possibilité de spécifier l'effort de réflexion via `--effort <low|medium|high|xhigh|max>`.
- Comportement : `/model` seul affiche le sélecteur de modèles. L'outil accepte également le nom direct au lancement ou dans le REPL.
- Statut : Vérifié (`agy --help`, `agy models`).

### Où lire la liste des modèles disponibles localement
- Emplacement : En exécutant `agy models`. La liste dépend des fournisseurs et accès configurés ; ne pas réutiliser l’inventaire d’une autre installation.
- Statut : Vérifié (`agy models` exécuté avec succès).

### Comment lister et lancer une compétence ou commande personnalisée
- Lister les compétences : Commandes CLI `agy agents` et `agy plugins list`. Les dossiers de compétences se trouvent dans `~/.gemini/config/skills/` et `~/.gemini/antigravity-cli/builtin/skills/`.
- Lancer une compétence : Taper la commande précédée d'un slash dans le prompt (par exemple `/brainstorming`, `/plan`, `/pua`, `/smokeflow`).
- Statut : Vérifié.

### Commandes à NE JAMAIS proposer en un clic
- `--dangerously-skip-permissions` : Valide automatiquement toutes les demandes d'accès aux fichiers et commandes sans avertir l'utilisateur.
- `/clear` : Réinitialise la conversation et perd l'historique de la session.
- `/exit` ou `/quit` : Quitte la session interactive de l'agent.
- Statut : Vérifié.

---

## 5. Gemini CLI (`gemini`)

### Commande pour changer de modèle
- Commande tapée dans l'outil : `/model` en interactif ou option `--model <nom>` au lancement (valeur par défaut : `"auto"`).
- Comportement : `/model` ouvre la boîte de dialogue de choix de modèle dans le REPL.
- Statut : Vérifié (`gemini --help`).

### Où lire la liste des modèles disponibles localement
- Emplacement : Dans `~/.gemini/settings.json`, ainsi que dans `~/.gemini/extensions` et via la sous-commande `gemini gemma` pour les modèles locaux légers Gemma.
- Statut : Vérifié (`gemini --help`, emplacement à vérifier selon la version installée).

### Comment lister et lancer une compétence ou commande personnalisée
- Lister les compétences : Exécuter `gemini skills list` ou `gemini extensions list`. Dossier local de référence : `~/.gemini/skills/`.
- Lancer une compétence : Taper `/<nom-de-competence>` dans l'invite interactive.
- Statut : Vérifié (`gemini skills` documenté dans l'aide officielle).

### Commandes à NE JAMAIS proposer en un clic
- `--yolo` ou `-y` (YOLO mode) : Exécute absolument toutes les actions sans demander aucune confirmation.
- `--dangerously-skip-permissions` : Évite tous les bandeaux de validation d'outils.
- `gemini --delete-session <index>` : Efface de manière irréversible une session de travail enregistrée.
- `/clear` ou `/exit` : Termine ou vide la session en cours.
- Statut : Vérifié.

---

## 6. Synthèse d'intégration pour le Bureau des agents

| Outil | Commande de changement de modèle | Commande pour lister les modèles réels | Lancement de compétence | Commandes interdites en un clic |
| :--- | :--- | :--- | :--- | :--- |
| **Claude Code** | `/model` (menu) ou `/model <nom>` | Lecture de `~/.claude/settings.json` | `/<competence>` (ex. `/commit`) | `/exit`, `/clear`, `/compact`, `--dangerously-skip-permissions` |
| **Codex** | `/model` (menu) ou `-m <nom>` | Lecture de `~/.codex/models.json` | `/<commande>` ou `/review` | `/exit`, `delete`, `--dangerously-bypass-approvals-and-sandbox` |
| **OpenCode** | `/model` (menu) ou `/model <fournisseur/modele>` | Exécution de `opencode models` | `/<competence>` | `uninstall`, `--auto`, `/clear`, `/exit` |
| **Antigravity** | `/model` (menu) ou `--model <nom>` | Exécution de `agy models` | `/<competence>` (ex. `/smokeflow`) | `--dangerously-skip-permissions`, `/clear`, `/exit` |
| **Gemini CLI** | `/model` (menu) ou `--model <nom>` | `gemini gemma` ou `settings.json` | `/<competence>` (ex. `gemini skills`) | `--yolo`, `--delete-session`, `--dangerously-skip-permissions` |
