# Plan de travail (18 octobre 2026)

Source de vérité de l'avancement : les cases ci-dessous. Le bureau les lit (onglet Tâches) et calcule le pourcentage par cases cochées. Une case se coche seulement après évaluation par le chef : `npm run check`, `npm test`, relecture du commit et vérification à l'écran si l'interface change.

Cycle de chaque lot : mission écrite → travail de l'agent (commit de ses seuls fichiers) → évaluation du chef → correction si besoin → leçon ajoutée à `LESSONS.md` et agents informés → case cochée.

## Lot A. Réponses lisibles (avis de Codex Desktop, P0 à P4)

- [x] A1a (Claude) Réponses structurées côté serveur pour Claude (session exacte) : `src/responses.mjs`, route `GET /api/reponses`, `test/responses.test.mjs`
- [x] A1b (OpenCode) Même contrat pour Codex et OpenCode (rattachement par dossier, ambigu = rien), dans `src/responses.mjs`
- [x] A2 (Antigravity) Carte de réponse avec Markdown sûr : `public/response-card.js`
- [x] A3 (Antigravity) Copier et exporter `.md` par réponse puis par session
- [x] A4 (Antigravity) Mise à jour par clés stables sans perdre sélection ni défilement
- [x] A5 (Claude) Intégration dans `public/app.js`, vérification Playwright à 1440, 390 et 360 px

## Lot B. Sécurité des installeurs (revue de Codex)

- [x] B1 (Codex) Injection par nom de dossier dans `scripts/installer.sh` (`sh -c`) : passer les arguments séparément
- [x] B2 (Codex) Même risque dans le profil et les raccourcis générés : échapper selon le format, retirer le shell intermédiaire
- [x] B3 (Codex) Retirer `-Oui` et `--oui` pour Herdr et les extensions : vrai o/n exigé
- [x] B4 (Codex) Chemin de Herdr : exiger un exécutable résolu littéralement, pas `installer.ps1`
- [x] B5 (Claude) Évaluation et test des installeurs en simulation

## Lot C. Avancement visible dans l'OS

- [x] C1 (Claude) Onglet Tâches : tableau « À faire » et « Réalisées » par fichier de plan, avec pourcentage et barre
- [x] C2 (Claude) Pourcentage de cases cochées de chaque agent sur sa carte et dans son poste (plan publié par l'agent seulement)
- [x] C3 (Claude) Mention explicite à l'écran : pourcentage = cases cochées sur cases totales, jamais une estimation

## Lot D. Les agents apprennent ensemble

- [x] D1 (Claude) Règle « boucle de correction » dans `AGENTS.md` : chaque correction devient une leçon dans `LESSONS.md`, les agents sont informés par message
- [x] D2 (Claude) Message de leçon envoyé à chaque agent après chaque correction, relu avant sa prochaine mission
- [ ] D3 (Antigravity) Rangement de `LESSONS.md` par thèmes pour que la relecture reste courte

## Lot E. Fonctions de l'OS d'agents

- [x] E1 (Claude) Audit : priorité des envois et transfert de direction livrés, tests `queue` et `direction` verts
- [x] E2 (OpenCode) Envoi d'un fichier avec une consigne : `files` dans `POST /api/queue`, copie sans écrasement avant l'envoi, plafond de volume (`docs/os-fonctions-opencode.md`, section 5)
- [x] E3 (Claude) Interface « Joindre un fichier » sur la consigne, nom de fichier seul affiché
- [x] E4 (Claude, OpenCode bloqué) Fil de la salle de contrôle `GET /api/discussion` (réutilise le lecteur de journaux du lot A, messages chiffrés de Codex jamais exposés)
- [ ] E5 (Antigravity) Fil de discussion dans l'interface
- [ ] E6 (OpenCode) Traitement de fichier suivi jusqu'au résultat : `GET /api/traitement`, faits sourcés, jamais « réussi » (section 6)
- [ ] E7 (Claude) Interface du dossier de traitement

## Lot F. Clôture

- [ ] F1 (Antigravity) Nom `MyTeam` partout dans les documents (écart relevé dans `HANDOFF.md`)
- [ ] F2 (Antigravity) `CHANGELOG.md`, `README.md` et `docs/aide.md` à jour
- [ ] F3 (Claude) `TODO.md`, `HANDOFF.md`, `JOURNAL.md` à jour
- [ ] F4 (Claude) `npm run check` et `npm test` verts, fusion dans `main`, aucun fichier en attente
- [ ] F5 (DrSmoke) Création du dépôt GitHub public et publication : jamais faite sans son feu vert
