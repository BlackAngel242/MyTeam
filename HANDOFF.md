# Reprise IA

Lire PRODUCT.md, docs/conception.md, docs/plan.md, JOURNAL.md, LESSONS.md et ERREURS.md avant de changer le projet.

DrSmoke a approuvé une application locale dans le navigateur, des personnages pixels dans un bureau bleu nuit et la construction directe. Il a explicitement autorisé l'accès à sa session Herdr depuis Codex Desktop extérieur, sans interruption des agents. Le guide intégré Herdr interdit normalement cet accès hors panneau ; l'autorisation ciblée de DrSmoke prévaut pour ce projet.

Serveur : Node.js natif, sans dépendance. `node server.mjs`, port 4317, 127.0.0.1 uniquement. Les commandes Herdr sont appelées via execFile, arguments séparés. La liste est lue avant chaque accès et la cible inclut une empreinte d'identité pour empêcher l'envoi à un agent remplacé. Pas d'envoi automatique aux statuts working, blocked ou unknown. Pas de fermeture, d'interruption ou de validation d'autorisation Herdr.

API interface : GET /api/state, GET /api/read?id=..., POST /api/prompt avec origine exacte et jeton X-Bureau-Token reçu de /api/state. La lecture CLI renvoie du texte brut, pas du JSON. Sur agent actif, utiliser la source visible.

Agents réels observés : panneaux w5:p1 (Claude), w5:p4 (Codex), w5:p2 (Antigravity), w5:p3 (OpenCode). Ces identifiants sont des observations, pas une configuration à figer. Une mission de vérification en lecture seule a été transmise à w5:p4 ; lire son résultat lorsqu'il est disponible. Ne pas lui envoyer à nouveau la même mission.

Aucun dépôt distant n'est configuré. Ne pas publier le projet ni les sorties des agents automatiquement. Aucune tâche détaillée ou sous-agent interne ne peut être inventé.

Première version vérifiée : 13 tests réussis, vérification syntaxique des trois fichiers JavaScript réussie, rendu ordinateur et téléphone inspecté. Détecteur Impeccable exécuté une fois, textes agrandis. Guide humain : README.md. Démarrage par double-clic : Ouvrir le bureau.cmd. Le serveur de cette livraison tourne en arrière-plan avec Node ; vérifier l'identité et l'emplacement du processus avant toute action.
