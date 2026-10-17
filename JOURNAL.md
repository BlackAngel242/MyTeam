# Journal

## 17 octobre 2026

DrSmoke autorise la construction d'un bureau animé local et souhaite la coopération avec les agents Herdr. Apparence choisie : pixels et bleu nuit. Outils laissés au choix de Codex. Node.js et Herdr 0.9.5 sont présents. Aucun fichier de projet initial ni dépôt distant configuré.

Le guide intégré de Herdr restreint son pilotage aux agents exécutés dans un panneau Herdr. Cette conversation est extérieure ; le pilotage reste suspendu en attendant une instruction ciblée de DrSmoke.

DrSmoke a ensuite explicitement autorisé l'accès depuis cette conversation extérieure, sans interruption des agents. Liste réelle récupérée : Claude, Codex, Antigravity et OpenCode. Mission de vérification en lecture seule transmise au Codex disponible, sans intervenir sur Claude occupé.

Application écrite sans dépendance et lancée sur 127.0.0.1:4317. Douze tests réussissent. Première inspection ordinateur et téléphone effectuée : pas de débordement à 390 px. Détecteur exécuté une fois, textes fonctionnels agrandis à 12 px. Le contour géométrique de l'avatar pixel est un faux positif conservé.

Le Codex dans Herdr a reçu la mission, travaillé puis répondu. Ses lectures de fichiers ont échoué ; ses recommandations sont générales. Le raccordement prouve l'envoi et la lecture, pas la capacité de cet agent à utiliser ses propres outils. Il est revenu au statut terminé et n'a lancé aucun processus persistant pour cette mission.

Relecture finale indépendante : défaut de découpage des accents entre morceaux réseau reproduit, puis corrigé. Suite finale : 13 tests réussis, vérifications JavaScript réussies. Les trois sous-agents Codex de construction et vérification ont terminé ; aucun n'est laissé actif. La première version est livrée localement, sans publication extérieure.

DrSmoke demande ensuite à Claude dans la session Herdr actuelle d'améliorer le design et de discuter avec Codex Desktop des évolutions graphiques et fonctionnelles. Il autorise Claude à consulter les IA des trois autres panneaux et à leur déléguer des tâches. Mission docs/mission-claude.md transmise intégralement au Claude disponible w5:p1 ; son passage en travail et le titre de sa nouvelle mission sont confirmés. Codex Desktop prépare docs/avis-codex.md et conserve les fichiers d'application libres pour éviter les modifications concurrentes.

La préparation de la consultation est observée dans les sorties de Claude, puis Codex et Antigravity passent en travail. La synthèse de Claude reste attendue ; aucun résultat graphique n'est déclaré achevé par Codex Desktop. Les fichiers d'application ne sont pas modifiés par Codex Desktop pendant ce travail confié à Claude.

Claude (coordinateur) : avis réels obtenus de Codex, Antigravity et OpenCode dans leurs panneaux, plus deux regards Impeccable isolés (revue de design et détecteur). DrSmoke demande ensuite une scène bien plus ambitieuse, les logos de chaque outil, les tokens, les sous-agents, l'envoi groupé et une répartition du travail. Réalisé : scène refaite (voir DESIGN.md), logos par Codex, envoi groupé (serveur commencé par OpenCode, terminé et testé par Codex), lecture de l'activité réelle de Claude (tokens et sous-agents) par Codex après revue de Claude, interface par Claude. 46 tests réussis, 1 ignoré (liens symboliques interdits sur ce poste). Vérification Playwright sur ordinateur et téléphone, avec états simulés puis données réelles : aucun débordement, aucune erreur console. Serveur du bureau redémarré (processus vérifié par son port 4317). OpenCode reste arrêté sur un choix de dossier et Antigravity sur un indicateur de chargement : réponse de DrSmoke nécessaire. Leçons communes ajoutées à LESSONS.md.

Deuxième revue de Codex (docs/revue-codex-interface-2.md) entièrement traitée par Claude : G1, M1, M2, M3, M5 à M9 dans public/ ; G2 et M4 côté serveur. Vérifié avec Playwright à 1440, 390 et 360 px sur états simulés (focus, palette, couches Échap, réponses lentes, pannes répétées, relecture en arrière-plan, mémoire bornée), aucun débordement ni erreur console. Serveur 4317 redémarré : il tournait avec le code d'avant G2. L'essai sans interception d'OpenCode confirme alors 200 sur /api/state, /api/queue, /api/todos et /api/places. Antigravity a rédigé la section « Non publié » du CHANGELOG, complétée par Claude ; OpenCode a terminé docs/INSTALLATION.md. Codex laissé au repos à la demande de DrSmoke (19 % de quota restant). 177 tests, 175 réussis, 2 ignorés.
