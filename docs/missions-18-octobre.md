# Missions du 18 octobre 2026

Règles communes : lire `AGENTS.md` et `LESSONS.md` en entier avant de commencer. Travailler dans `C:\Users\DrSmoke\Documents\ChatGPT\IA DESKTOP`, branche `main`. Commiter seulement tes propres fichiers (`git add <chemins>`, jamais `git add -A`), aucun `git push`. Ne répondre à aucune boîte de dialogue à la place de DrSmoke. Terminer par un compte rendu court : hash du commit, `npm run check` et `npm test` (nombre de tests), ce qui n'a pas pu être vérifié, nouvelles leçons ajoutées à `LESSONS.md`. Le chef évalue ensuite, corrige si besoin et te transmet ses corrections : les relire fait partie de la mission. Le plan complet est dans `docs/plan-travail.md`.

## OpenCode : A1, réponses structurées côté serveur

Lire `docs/avis-codex.md`, section P0. Fichiers à toi : `src/responses.mjs` (nouveau), la route dans `server.mjs`, `test/responses.test.mjs` (nouveau), ligne ajoutée à `npm run check` dans `package.json`.

- `GET /api/reponses?id=<agent>` protégée comme `/api/todos` (jeton et provenance), lecture seule des journaux locaux (Claude, Codex, OpenCode), lecture incrémentale et bornée comme `src/delegations.mjs`.
- Chaque réponse : clé publique opaque, agent, heures observées, blocs de texte, source, état parmi `en cours`, `terminée`, `interrompue`, `fin non déterminée` seulement quand le journal le permet.
- Ne jamais exposer : identifiants internes de session, chemins de journaux, comptes, messages inter-agents chiffrés de Codex, table `credential` d'OpenCode (colonnes précises seulement). Masquer secrets et chemins comme `src/todos.mjs` (`textOf`), y compris les chemins en `~`.
- Si le rattachement est ambigu, ne pas rattacher.
- Tests sur journaux factices : réponse longue, accents et emojis, ligne géante, journal réécrit, message chiffré, agent inconnu.
- Contrat de sortie à écrire en tête de `src/responses.mjs` pour qu'Antigravity branche l'interface dessus.

Quand A1 est évalué, la suite est E3 : `GET /api/discussion` (fil de la salle de contrôle), même lecteur de journaux. Détail dans `docs/os-fonctions-opencode.md`, section 2.

## Antigravity : A2, A3, A4, carte de réponse

Lire `docs/avis-codex.md`, sections P2, P3, P4. Fichier à toi : `public/response-card.js` (nouveau) et `public/style.css` pour les styles de la carte uniquement (préfixe `.rc-`). L'intégration dans `public/app.js` est faite par le chef : documente en tête de ton module la fonction à appeler et les données attendues.

- Markdown restreint et sûr : paragraphes, titres, listes, citations, gras, code en ligne, blocs de code. Jamais `innerHTML`, uniquement `createElement` et `textContent`. Liens : protocoles contrôlés. Aucune image distante. Syntaxe non prise en charge : affichée comme texte.
- Bouton « Copier le code » par bloc, « Copier la réponse » (Markdown source complet), « Exporter la réponse » en `.md` (Blob local), « Exporter la session affichée ». Copie et export lisent le même objet de contenu, jamais `innerText`. Repli zone de texte en lecture seule si le presse-papiers est refusé.
- Mise à jour par clés stables : ne pas reconstruire la liste, garder sélection, focus et défilement. Réponse en cours exportée comme instantané daté marqué « partiel ».
- Entrée attendue : le format de `GET /api/reponses` défini par OpenCode en tête de `src/responses.mjs`. Tant qu'il n'est pas livré, coder tolérant (404 = état vide, pas d'erreur).
- Vérifier avec Playwright (`channel: 'msedge'`, états simulés, aucune consigne réelle) : réponse longue, plusieurs blocs de code, HTML actif en texte, 360 et 390 px.

Ensuite : D3 (ranger `LESSONS.md` par thèmes sans perdre aucune leçon), puis F1 et F2 (nom `MyTeam` partout, `CHANGELOG.md`, `README.md`, `docs/aide.md`).

## Codex : B1 à B4, sécurité des installeurs

Tu as trouvé les défauts dans ta revue : corrige-les. Fichiers à toi pour cette mission : `scripts/installer.sh`, `scripts/installer.ps1` et leurs tests s'ils existent (`test/`). Économise ton quota : mission courte, pas d'exploration inutile.

- B1/B2 : un dossier nommé `$(commande)` ne doit jamais s'exécuter. Passer les arguments séparément, échapper selon le format de chaque fichier généré (profil, raccourcis, `.desktop`), supprimer `sh -c` quand possible.
- B3 : `-Oui` et `--oui` ne valident plus l'installation de Herdr ni des extensions : vrai o/n à chaque fois.
- B4 : le chemin de Herdr doit être un exécutable résolu littéralement, `installer.ps1` ne doit pas être accepté.
- Ajouter un test qui reproduit chaque cas (dossier piégé, `--oui`, faux Herdr). Ne lancer aucune installation réelle.
