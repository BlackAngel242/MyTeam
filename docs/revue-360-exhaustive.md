# Revue 360° de MyTeam : au-delà de l'orchestration

> Document complémentaire à `MyTeam-Autonomie-Feuille-Route.md` (CodeBuddy, 10 verrous V1-V10 sur l'autonomie et l'orchestration).
> Celui-ci couvre tout le reste : architecture, sécurité, robustesse, i18n, performance, documentation, tests, release et UX.
> Réponse directe à la question : **non, les problèmes ne sont pas que dans l'orchestration.**

---

## 1. Réponse courte

L'orchestration (la boucle chef → délégation → retour) est le sujet le plus **visible**, mais ce n'est pas le seul endroit où MyTeam accumule de la dette. Trois autres familles ressortent, par ordre d'impact :

1. **Maintenabilité** : des fichiers uniques énormes (`public/app.js` ≈ 159 Ko, `server.mjs` ≈ 44 Ko) et aucune vérification automatique du code (pas de linter, pas de formateur, `npm run check` est une liste manuelle).
2. **Duplication** : le français et l'anglais sont deux fichiers séparés sans lien, `site/` duplique `public/`, les installateurs `.ps1` et `.sh` sont deux copies de 52 Ko, la version 0.5.1 est codée en dur à plusieurs endroits.
3. **Documentation** : des dizaines de documents d'analyse (`revue-*`, `proposition-*`, `audit-360`) sans registre de décision pour dire ce qui a été adopté ou rejeté.

La **sécurité**, elle, est déjà excellente (voir section 4) : ce n'est pas là qu'il faut investir en priorité.

---

## 2. Ce qui est déjà très solide (à ne pas casser)

| Domaine | Ce qui est bon | Preuve |
|---|---|---|
| Sécurité | Jeton d'accès 256 bits, comparaison à temps constant, origine exacte, CSP stricte, zéro `innerHTML` | `server.mjs:32, 288-294`, frontend « Zero innerHTML » |
| Dépendances | **Zéro dépendance npm** | `package.json` (aucun `dependencies`) |
| Tests | Plus de 60 fichiers de test | arborescence du dépôt |
| CI | Deux OS (Ubuntu + Windows), Node 22 | `.github/workflows/ci.yml` |
| Robustesse | Salle de crise à sécurité positive, écritures atomiques | `src/crisis.mjs` |
| Mise à jour | Somme SHA-256 + protection zip-slip | `src/update.mjs` |
| Chemins | `realpath` + vérification d'appartenance, création exclusive | `src/files.mjs` |

Ces acquis sont le socle. Les sections suivantes portent sur ce qui reste à faire.

---

## 3. Architecture et maintenabilité

### 3.1. Fichiers monolithiques

**Constat.** L'interface tient dans un seul fichier : `public/app.js` (158 919 octets) contient les agents, la file, les todos, les fichiers, le terminal, l'envoi groupé, la salle de crise, l'autonomie, la direction, le tableau, les animations, les notifications, les sons, le plein écran et l'édition de la mise en page. `server.mjs` (44 163 octets) contient toutes les routes. `public/style.css` (60 453 octets) tout le style.

**Problème.** Un fichier de 159 Ko est difficile à relire, à fusionner (conflits fréquents entre branches) et impossible à tester en isolation. Le risque de régression est proportionnel à la taille.

**Proposition.** Découper progressivement, sans tout réécrire :
- `public/` : extraire par module (`agents.js`, `queue.js`, `todos.js`, `terminal.js`, `broadcast.js`, `crisis.js`, `autonomy.js`, `board.js`), chargés en modules ES (`<script type="module">`), avec un `state.js` central.
- `server.mjs` : déplacer les routes vers `src/routes/*.mjs` (une route par fichier), garder `server.mjs` comme point d'entrée.

**Critère de succès.** Aucun fichier source au-dessus de ~500 lignes ; `public/app.js` remplacé par un point d'entrée de moins de 100 lignes.

### 3.2. Pas de vérification automatique du code

**Constat.** `npm run check` est une liste manuelle de 38 `node --check`. Il n'y a ni ESLint, ni Prettier, ni typage (c'est du JavaScript nu). Un nouveau fichier oublié dans la liste n'est jamais vérifié.

**Problème.** La qualité dépend de la discipline de celui qui met à jour la liste. C'est fragile et non reproductible.

**Proposition.**
- Remplacer la liste par `node --check **/*.mjs **/*.js` (ou un `find`/glob) : zéro maintenance.
- Ajouter ESLint (règles minimales) et Prettier (formatage unique) en `devDependencies`, exécutés dans la CI.

**Critère de succès.** `npm run check` ne référence plus aucun fichier nommé un par un ; `npx eslint .` et `npx prettier --check .` passent en CI.

---

## 4. Sécurité : solide, avec des bords mineurs

### 4.1. Ce qui est déjà en place (à conserver tel quel)

- **Jeton** : `randomBytes(32).toString('hex')` (256 bits), régénéré à chaque démarrage, comparé par `timingSafeEqual`. `server.mjs:32, 294`.
- **Origine** : correspondance exacte `http://127.0.0.1:${port}` + vérification `sec-fetch-site` + vérification de l'en-tête `host`.
- **En-têtes** (`server.mjs:288-289`) : `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, et une CSP stricte : `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`.
- **Frontend** : politique « zéro innerHTML » (`discussion.js`, `response-card.js`, `tiles.js` n'utilisent que `createElement` + `textContent`).
- **Masquage** : `src/masque.mjs` (chemins Windows/Unix, secrets, empreintes), idempotent.
- **Chemins** : `src/files.mjs` (`realpath` + `inside()`, création exclusive `COPYFILE_EXCL`).
- **Mise à jour** : `src/update.mjs` (somme SHA-256, protection zip-slip complète).
- **Salle de crise** : `src/crisis.mjs` (un fichier corrompu = crise active, écriture atomique).

### 4.2. Bords mineurs (non bloquants)

| # | Constat | Proposition | Priorité |
|---|---|---|---|
| S1 | Le jeton est **éphémère** : régénéré à chaque redémarrage, il force un « Session expirée, actualise le bureau » à chaque relance du serveur. | Garder l'éphémère (c'est une sécurité), mais améliorer la reprise : le client redemande le jeton automatiquement au lieu d'afficher l'erreur. | Faible (UX) |
| S2 | Pas de **limite de débit** sur les routes d'écriture. Un 256 bits aléatoire rend la force brute impossible, mais une limitation douce serait une défense en profondeur. | Compter les échecs d'authentification par adresse (simple compteur en mémoire, fenêtre glissante). | Faible |
| S3 | Pas de **politique de rotation** documentée du jeton (il n'est pas persisté, donc la question ne se pose pas : à vérifier si un jour il est persisté). | Documenter explicitement « jeton jamais persisté » dans `SECURITY.md`. | Documentaire |
| S4 | `SECURITY.md` fait 7 lignes. | L'enrichir avec les mesures réellement en place (elles sont nombreuses et méritent d'être affichées). | Documentaire |

**Conclusion sécurité.** Aucun défaut critique détecté. Les bords sont des durcissements optionnels et documentaires.

---

## 5. Robustesse et fiabilité

### 5.1. Salle de crise (déjà excellente)

`src/crisis.mjs` applique une logique de sécurité positive rare : fichier absent = jamais déclenchée, fichier corrompu = **crise active**. L'activation pose le verrou en mémoire avant l'écriture ; la levée n'est effective qu'après écriture réussie. C'est le bon modèle.

### 5.2. Ce qui manque

| # | Constat | Proposition | Priorité |
|---|---|---|---|
| R1 | Pas de gestion d'erreur globale visible (à vérifier : `process.on('uncaughtException')` / `unhandledRejection`). Un rejet non intercepté peut faire tomber le serveur sans journal. | Ajouter un handler global qui journalise et répond proprement, sans `exit` brutal. | Moyenne |
| R2 | ✅ Déjà géré : `update-helper.mjs` fait le retour arrière (sauvegarde `.myteam-backup-*`, `rename`, bilan de santé `healthy()`, restauration si la nouvelle version ne démarre pas). Le vrai point restant : l'**authenticité** de la release — le SHA-256 prouve l'**intégrité** du zip, pas qu'il est légitime (le zip et sa somme viennent du même canal). | Signer les releases (minisign/age), clé publique embarquée dans le binaire, vérifiée avant extraction. | Moyenne |
| R3 | Pas de « dernière version connue stable » ni de canal canary : le SHA-256 protège de la falsification, pas d'une release qui contient un bug. | Ajouter un canal `stable` (par défaut) et `canary` (opt-in) dans la mise à jour. | Faible |

---

## 6. Internationalisation

### 6.1. Deux fichiers séparés sans lien

**Constat.** `public/i18n.js` (47 257 octets) et `public/i18n-en.js` (39 635 octets) sont deux dictionnaires indépendants. Toute nouvelle chaîne doit être ajoutée deux fois.

**Problème.** Risque de dérive : une clé présente en français et absente en anglais retombe silencieusement, ou vice-versa. Les tailles diffèrent déjà de ~7,6 Ko.

**Proposition.**
- Fusionner en un seul fichier `i18n.js` où chaque clé porte `{fr, en}` (une seule ligne par chaîne, les deux langues côte à côte).
- Ajouter un test de parité qui échoue si une clé n'a pas ses deux variantes.

**Critère de succès.** Un seul fichier de traduction ; un test garantit que toute clé a `fr` **et** `en`.

### 6.2. La documentation bilingue est dupliquée

**Constat.** `docs/aide.md` (48 242 o) et `docs/aide.en.md` (38 093 o), `README` + `README.en`, `CHANGELOG`, `INSTALLATION`, `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, `NOTICE`, et le kit (`kit/fr` + `kit/en`) existent en double.

**Problème.** Même dérive que l'i18n, mais sur des documents entiers (les tailles `aide` diffèrent de 10 Ko).

**Proposition.** Le même principe : une source, deux rendus. Ou, à défaut, un script de vérification qui signale les fichiers `.en.md` plus anciens que leur homologue français.

---

## 7. Performance

### 7.1. Charge côté navigateur

**Constat.** `public/app.js` (≈159 Ko) et `public/style.css` (≈60 Ko) sont chargés en une seule fois, sans découpage (`code splitting`) et sans chargement différé visible. À cela s'ajoute la boucle d'animation (pixel art jour/nuit) et le rafraîchissement périodique de l'état.

**Problème.** Sur les machines modestes visées (la cible DrFix est justement le terrain peu puissant), 159 Ko de JS + animation + polling peuvent peser. La contrainte « 8 Go de RAM » est déjà évoquée dans `src/sante.mjs`.

**Proposition.**
- Charger les panneaux en différé (un module par panneau, chargé à l'ouverture).
- Respecter `prefers-reduced-motion` pour l'animation (à vérifier si c'est déjà le cas).
- Auditer la fréquence de rafraîchissement : la ramener à un intervalle raisonnable quand l'onglet est en arrière-plan (`document.visibilityState`).

**Critère de succès.** Le poids initial chargé au premier écran diminue ; l'animation se met en pause quand l'onglet est caché.

---

## 8. Documentation

### 8.1. Prolifération sans registre de décision

**Constat.** `docs/` contient de nombreux documents d'analyse : `revue-*` (codex, opencode, antigravity…), `proposition-*` (design-codex, design-opencode, design-antigravity, orchestration), `audit-360.md`, `os-fonctions-antigravity.md`, `programme-muse.md`, `solutions-observabilite-multi-outils.md`, plus la feuille de route CodeBuddy (hors dépôt). Aucun index ne dit ce qui a été **adopté**, **rejeté** ou **reporté**.

**Problème.** Impossible de savoir l'état des décisions. Deux documents peuvent se contredire, ou une bonne idée rester enterrée.

**Proposition.**
- Créer un `docs/DECISIONS.md` (registre type ADR) : une entrée par décision, avec date, statut (proposé / adopté / rejeté / reporté) et raison.
- Marquer en tête des anciens `revue-*` / `proposition-*` leur statut (« archivé », « adopté partiellement », etc.) ou les déplacer vers `docs/archive/`.

**Critère de succès.** Toute idée de ces documents a une trace dans `DECISIONS.md` avec un statut.

### 8.2. `LESSONS.md` géant et passif

**Constat.** `LESSONS.md` fait 37 133 octets et existe aussi dans `kit/fr` + `kit/en`. C'est un fichier unique, en croissance, lu mais jamais exploité automatiquement (déjà pointé par la feuille de route CodeBuddy en V3).

**Proposition.** Découper en thèmes (un fichier par domaine) et, à terme, le faire consommer par la consigne d'autonomie (voir l'amélioration « contexte structuré » de la proposition d'orchestration).

---

## 9. Tests et intégration continue

### 9.1. Beaucoup de tests, mais pas de mesure de couverture

**Constat.** Plus de 60 fichiers de test, exécutés par `node --test`. C'est un atout majeur. Mais aucun rapport de couverture n'est produit.

**Problème.** On ne sait pas ce qui n'est **pas** couvert. Un fichier critique peut n'avoir aucun test sans que personne le voie.

**Proposition.** `node --test --experimental-test-coverage` (ou `c8`), avec un seuil minimum sur les modules critiques (`src/`), et un rapport publié en CI.

**Critère de succès.** Un pourcentage de couverture visible par module ; un seuil minimal sur `src/*.mjs`.

### 9.2. CI à deux OS, sans macOS

**Constat.** `.github/workflows/ci.yml` tourne sur Ubuntu et Windows (Node 22), exécute `npm run check` + `npm test`. Bien, mais pas de macOS, pas de couverture, pas de build de l'installeur en CI.

**Proposition.**
- Ajouter macOS au matrix (le projet vise multi-plateforme).
- Ajouter un job qui construit et teste l'installeur sur Windows (la cible réelle).
- Intégrer la couverture au job de test.

---

## 10. Release et processus

### 10.1. Version codée en dur à plusieurs endroits

**Constat.** La version `0.5.1` est écrite dans `package.json`, `CHANGELOG.md`, `docs/noms-de-versions.md` et affichée dans l'interface. `src/sante.mjs` compare la version chargée à celle du disque.

**Problème.** Un oubli de bump dans l'un de ces endroits crée une incohérence (l'interface affiche une version, le paquet une autre).

**Proposition.** Une seule source (`package.json`), les autres la lisent ou sont vérifiées par un test qui compare toutes les occurrences.

**Critère de succès.** Un test échoue si deux endroits n'affichent pas la même version.

### 10.2. Installateurs dupliqués

**Constat.** `scripts/installer.ps1` (52 614 octets) et `scripts/installer.sh` (52 774 octets) sont deux grosses sources quasi identiques, une par plateforme.

**Problème.** Chaque correction doit être faite deux fois. La dérive est inévitable (les tailles diffèrent déjà).

**Proposition.** À défaut de fusion (PowerShell et bash ne se fusionnent pas), ajouter un test de non-régression qui vérifie qu'une correction donnée existe dans les deux, ou documenter dans chaque fichier l'autre comme « miroir à synchroniser ».

---

## 11. UX et accessibilité

| # | Constat | Proposition | Priorité |
|---|---|---|---|
| U1 | Pas d'audit d'accessibilité visible : contraste du pixel art, focus clavier, navigation au clavier, lecteur d'écran. | Audit WCAG 2.1 AA minimum, en commençant par le focus visible et le contraste des textes. | Moyenne |
| U2 | L'animation jour/nuit est continue. | Respecter `prefers-reduced-motion` et le bouton « pause » existant. | Faible |
| U3 | Le jeton éphémère provoque un « Session expirée » à chaque redémarrage. | Reconnexion automatique (voir S1). | Faible |
| U4 | Bilingue obligatoire, mais la bascule FR/EN et la langue par défaut méritent d'être confirmées (auto selon navigateur ?). | Documenter la règle de langue par défaut et la tester. | Documentaire |

---

## 12. Synthèse priorisée

| Priorité | Domaine | Action | Effort | Impact |
|---|---|---|---|---|
| 1 | Maintenabilité | Rendre `npm run check` automatique (fin de la liste manuelle) | Très faible | Fort (évite les régressions silencieuses) |
| 2 | i18n | Fusionner FR/EN en un seul fichier + test de parité | Moyen | Fort (élimine la dérive de traduction) |
| 3 | Docs | Créer `docs/DECISIONS.md` et archiver les `revue-*`/`proposition-*` | Faible | Moyen (clarifie l'état du projet) |
| 4 | Release | Version à source unique + test de cohérence | Faible | Moyen |
| 5 | Architecture | Découper `public/app.js` et `server.mjs` par modules | Important | Fort (mais à faire progressivement) |
| 6 | Tests | Couverture de code + macOS en CI | Moyen | Moyen |
| 7 | Robustesse | Gestion d'erreur globale + retour arrière de la mise à jour | Moyen | Moyen |
| 8 | Sécurité | Durcissements optionnels (S1-S4) | Faible | Faible (déjà solide) |
| 9 | UX | Audit d'accessibilité + `prefers-reduced-motion` | Moyen | Moyen |

**Lecture du tableau.** Les gains les plus rapides et les moins risqués sont en 1, 3 et 4. L'i18n (2) est le chantier le plus rentable à moyen terme. Le découpage (5) est le plus lourd et doit être fait sans casser ce qui fonctionne, module par module.

---

## 13. Conclusion

Les problèmes de MyTeam **ne sont pas que dans l'orchestration**. L'orchestration est le chantier le plus visible et le plus stratégique (c'est le cœur du produit), mais trois dettes silencieuses s'accumulent : la maintenabilité (fichiers géants, aucune vérification automatique), la duplication (i18n, `site/` vs `public/`, installateurs, version) et la documentation sans registre de décision.

La **sécurité** est, elle, en avance : elle n'appelle aucun chantier urgent.

L'ordre recommandé est de commencer par les gains rapides (check automatique, version unique, registre de décisions), puis l'i18n, puis le découpage architectural en dernier, une fois que les autres chantiers auront réduit la surface à découper.

---

*Document rédigé après lecture du dépôt MyTeam (architecture, `package.json`, `server.mjs`, `src/*.mjs`, `public/*`, `.github/workflows/ci.yml`) et de la feuille de route CodeBuddy.*
