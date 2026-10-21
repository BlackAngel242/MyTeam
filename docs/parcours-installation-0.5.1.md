# Parcours d'installation 0.5.1 — décision de la table ronde

Décision produit : une installation lancée par la personne autorise la mise en place des prérequis manquants. Les outils IA restent un choix explicite. « Ceylin » est interprété comme **Clink** sous Windows et « HPRD » comme **Herdr**. La personne qui installe peut corriger ces noms avant la fusion.

| Étape | Décision | Condition et retour |
| --- | --- | --- |
| Node.js 22+ | Automatiser | Détecter la version ; installer si absente ou trop ancienne ; vérifier après installation. Si le gestionnaire est absent ou la version reste trop ancienne, afficher la marche à suivre. |
| Clink | Automatiser sur Windows | Détecter, puis installer via winget si disponible. Clink n'existe pas comme prérequis sur Linux/macOS. |
| Herdr | Automatiser | Détecter, puis installer depuis la méthode officielle ; vérifier la présence. Son absence interdit l'orchestration. |
| Chemin Herdr | Automatiser | Enregistrer le chemin utilisateur uniquement quand Herdr est trouvé hors PATH. |
| Claude, Codex, OpenCode, Pi, Gemini CLI | Choix groupé | Afficher seulement les outils absents. Saisir plusieurs numéros, puis confirmer la liste une fois. Aucun téléchargement IA en mode `--oui` / `-Oui`. |
| Antigravity CLI | Choix guidé | Détecter `antigravity-cli` ; ouvrir la documentation officielle si sélectionné. Aucune commande d'installation non vérifiée n'est exécutée. |
| Espace Herdr, agent chef, intégrations | Garder sous contrôle humain | Leur création et lancement modifient le poste ou démarrent des agents ; ces choix sont distincts de l'installation des prérequis. |
| Extensions VS Code | Reporter | Cette fonctionnalité n'est pas prioritaire ; aucun outil IA n'en dépend. |
| Projet et dossier | Choix explicite | Conserver le choix « améliorer MyTeam » ou « nouveau projet » et le chemin de travail ; aucune donnée personnelle dans le dépôt public. |
| Simulation | Garder | `--dry-run` / `-DryRun` ne télécharge, n'installe, ni n'écrit. |

Points discutés : l'installation automatique évite les validations répétées mais le système peut encore demander une élévation de privilèges ; elle ne doit pas masquer un échec. Le choix multi-IA protège les préférences et crédits de chacun ; si aucun agent n'est détecté, une sélection est nécessaire pour accomplir une mission, mais l'installateur peut terminer avec un message de configuration restante. Une sélection Antigravity seule exige une installation manuelle avant la première mission. Aucun mot de passe, jeton ou clé n'est demandé par MyTeam.

Critères de recette : machine vierge ; machine avec une IA déjà présente ; sélection de deux IA ; sélection vide ; gestionnaire de paquets absent ; échec d'installation ; simulation ; terminal sans entrée ; Linux, macOS et Windows. Les installateurs doivent présenter les mêmes décisions, et Windows Latest doit être vérifié dans GitHub Actions.
