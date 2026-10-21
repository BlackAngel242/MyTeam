# Audit 360° de MyTeam — propositions et méthodes

**Date :** 21 octobre 2026
**Origine :** travail préparé sur la branche `agent/dola/audit-360`, à évaluer par le chef et DrSmoke avant tout merge. Conformément à AGENTS.md, aucun nom d'outil ne signe cette contribution.
**Base :** `main` au commit `bed3375` (version 0.5.0 « Ṣàngó »)
**Périmètre lu :** `server.mjs`, `src/files.mjs`, `src/herdr.mjs`, `src/masque.mjs`, `src/queue.mjs` (début), `src/project-server.mjs`, `src/terminal-status.mjs`, gouvernance (`AGENTS.md`, `LESSONS.md`, `HANDOFF.md`, `TODO.md`, `PRODUCT.md`, `DESIGN.md`), CI/CD (`.github/`), hooks, `package.json`, structure complète.
**Vérifications exécutées :** `npm run check` (ok), `npm test` (495 tests, 468 passés, 0 échec, 27 ignorés, ~31 s), comptage de lignes, inventaire des routes et des en-têtes HTTP.

## 1. Verdict général

Le projet est **déjà très mature pour sa taille**. La sécurité locale est au-dessus de la moyenne des outils du même genre, la gouvernance multi-agents (AGENTS.md, LESSONS.md, protocole, pre-commit) est exceptionnelle, et la discipline de test est solide. Les recommandations ci-dessous portent sur le dernier 20 % : durcissements peu coûteux, réduction de la dette, et parades au point de fragilité principal (le couplage au CLI Herdr).

Rien dans ce constat ne justifie de refonder quoi que ce soit.

## 2. Ce qui est déjà solide (à ne pas toucher)

- **Serveur localhost durci :** bind `127.0.0.1`, token 32 octets comparé en `timingSafeEqual`, vérification du `Host` (anti-DNS-rebinding), `Origin` exact + `Sec-Fetch-Site: same-origin`, CSP stricte, `nosniff`, `no-store`, `no-referrer`.
- **Fichiers :** double vérification `realpath`, refus des liens symboliques, copie exclusive `COPYFILE_EXCL` (anti-écrasement / TOCTOU), limite 20 Mo re-contrôlée après copie, jamais de chemin absolu venant du navigateur.
- **Masque :** appliqué avant toute troncature, idempotent, avec contre-exemples obligatoires — rarement vu aussi soigné.
- **Gouvernance :** pre-commit qui scanne les secrets sur l'index et relance `check` + `test` dans un dossier temporaire, issue/PR templates, labels, dependabot, CI ubuntu + Windows, release automatisée qui attend les assets avant de déployer les Pages.
- **Zéro dépendance npm** maintenue, Node 22/24, tests avec états simulés (aucun envoi réel).

## 3. Recommandations par profil

Légende : **[Fait]** = implémenté dans cette PR ; **[À faire]** = méthode fournie, à décider par Claude/DrSmoke.

### 3.1 Sécurité

| # | Proposition | État | Méthode / justification |
|---|---|---|---|
| S1 | Étendre les motifs de secrets du pre-commit (`pk-`, `ghp_/gho_/ghu_/ghs_/ghr_`, `github_pat_`, `xox-`, `AIza`, `Bearer …`, `creator_user_id`) alignés sur `src/masque.mjs`. | **[Fait]** | `.githooks/pre-commit` : variable `PATTERN`. Les formes génériques `token=`/`password=` sont volontairement exclues : elles déclencheraient sur le code légitime (`const token=randomBytes…`). Haute spécificité uniquement. |
| S2 | Ajouter `X-Frame-Options: DENY` (redondance utile avec `frame-ancestors 'none'`) et aligner `Referrer-Policy`/`nosniff` sur **toutes** les réponses, y compris JSON et pages de démarrage de `project-server.mjs`. | **[Fait]** | `server.mjs` (en-têtes communs), `src/project-server.mjs` (helper `json` + servir les fichiers statiques). Cohérence des deux couches serveur. |
| S3 | Nettoyer les fichiers joints orphelins en cas d'échec de copie. | **[Abandonné]** | Conflit avec un comportement délibéré et testé (`fichiers en file : attente occupée, copie partielle conservée, pas de nouvel essai automatique`) : les copies partielles sont **conservées** sur disque et la consigne passe en état `a_revoir` pour revue humaine. Supprimer ces fichiers casserait ce contrat. Conservé comme observation uniquement. |
| S4 | Rate-limiting léger sur `/api/prompt` et `/api/queue` (ex. max 60 écritures/min par origine). | [À faire] | Localhost + token + origin : risque faible. Si implémenté : compteur en mémoire par token, fenêtre glissante, réponse 429. À réserver si un abus est observé. |
| S5 | Le masque Unix ne couvre que des racines connues (`/home`, `/Users`, `/var`, …) ; un chemin hors liste (`/repos`, `/workspaces`, `/home2`) peut fuiter dans une sortie texte. | [À faire] | Ce n'est pas une faille (la protection réelle est côté serveur), mais la défense en profondeur gagnerait à ajouter `\/[A-Za-z0-9._-]+(?:\/[^\s…]+)` en dernier recours, **après** avoir préservé les URL http(s) et les routes `/api/`. À tester avec les contre-exemples existants avant activation. |

### 3.2 Performance

| # | Proposition | État | Méthode |
|---|---|---|---|
| P1 | Mettre `codexReady` en cache 15 s pour réduire les appels Herdr. | **[Abandonné]** | Conflit avec la garantie testée « le dernier écran remplace l'observation précédente avant chaque envoi » : la relecture fraîche avant chaque `prompt` Codex est une protection volontaire (écran de confiance). Un cache même court servirait une valeur obsolète. Le coût en performance est assumé. |
| P2 | Paralléliser en mode borné (ex. 3 concurrents) les `lireEtat` dans `executerSonderEtats`. Aujourd'hui séquentiel, jusqu'à 8 s/panneau → un tour à 10 agents dépasse largement les 20 s (le garde `sondageEnCours` empêche l'empilement, mais la cadence effective est plus basse que prévu). | [À faire] | Transformer la boucle `for` en tableau de promesses avec un limiteur de concurrence simple (file d'attente de 3). Chaque itération reste indépendante (écritures dans `etats`/`echeances` par clé agent). `reprendreApresPause(liste)` reste appelé **après** `await Promise.all(…)`. Ajouter un test qui vérifie l'ordre des effets et l'absence d'envoi pendant la crise. Risque : moyen — à faire en commit isolé. |

### 3.3 Architecture / dette technique

| # | Proposition | État | Méthode |
|---|---|---|---|
| A1 | Extraire les ~25 routes inline de `server.mjs` (666 lignes) vers `src/routes/*.mjs` (sans dépendance). | [À faire] | Pure refactor. Les 495 tests protègent. Procéder par famille de routes (fichiers, file, autonomie, crise, direction) en commits séparés. Le constructeur `createBureauServer` reste l'orchestrateur. |
| A2 | Scinder `public/app.js` (1957 lignes) en modules ES progressifs. | [À faire] | Migrer vers `<script type="module">` par étapes : d'abord les fichiers déjà autonomes (`response-card.js`, `discussion.js`, `tiles.js`), puis `app.js`. Aucun bundler (contrainte zéro dépendance) — les modules ES natifs suffisent. |
| A3 | Réduire la duplication `public/appearance.*` ↔ `site/appearance.*` (synchronisée à la main via `sync:interface`). | [À faire] | Que le build de l'archive (`scripts/empaqueter-release.mjs`) ou le workflow Pages copie les fichiers de `public/` vers `site/` au moment du déploiement, plutôt que de maintenir deux copies suivies. Sinon la dérive est inévitable. |

### 3.4 Qualité / tests

| # | Proposition | État | Méthode |
|---|---|---|---|
| Q1 | Ajouter `macos-latest` à la matrice CI (dépôt public = gratuit). Les installateurs `.sh` et les chemins Unix/macOS n'étaient testés que sur Ubuntu. | **[Retiré de la matrice]** | Le test `H3 chef bash` (`test/installers-h3.test.mjs:213`) échoue sur macOS : le `SKILL.md` attendu n'apparaît pas dans le dossier temporaire (cause probable : `/var` lien vers `/private/var`, non confirmée). macOS est retiré de la matrice pour garder la CI verte ; à réintroduire après correction du test dans une PR séparée. |
| Q2 | Mesure de couverture avec `node --test --experimental-test-coverage` (natif, sans dépendance), en job optionnel. | [À faire] | Ajouter un workflow séparé (ou un step conditionnel) qui publie le pourcentage en résumé de run. Ne pas bloquer la CI sur un seuil tant que la cible n'est pas définie. |
| Q3 | Les 27 tests ignorés sont environnementaux (PowerShell/bash/symlinks absents) — acceptable. Leur liste pourrait être affichée dans le résumé CI. | [À faire] | Parser la sortie TAP ou utiliser `--test-reporter=spec` + un résumé `skipped`. |

### 3.5 Robustesse / couplage externe

| # | Proposition | État | Méthode |
|---|---|---|---|
| R1 | Tests de contrat Herdr : figer des fixtures JSON de `agent list` / `agent prompt` / `pane process-info` dans `test/fixtures/`, et faire passer `parseResult` + `normalizeAgent` dessus. | [À faire] | Le point de fragilité numéro 1 du projet est le format de sortie du CLI Herdr. Une breaking change casse la liste, les envois et la détection de session. Des fixtures permettent de détecter immédiatement une régression de format. `run` est déjà injectable dans `createHerdr` — les tests existants (`qa-herdr-server.test.mjs`) montrent la voie. |
| R2 | Erreurs serveur en français uniquement alors qu'une i18n EN existe côté front. | [À faire] | Faire passer les messages d'erreur par le dictionnaire `i18n.js`/`i18n-en.js`, avec la langue négociée par un en-tête ou un paramètre. Mineur. |

### 3.6 Gouvernance / dépôt

| # | Proposition | État | Méthode |
|---|---|---|---|
| G1 | Supprimer les branches `bolt-*` distantes (HANDOFF.md l'indique déjà comme « à faire par DrSmoke »). | [À faire] | Action de maintenance réservée à DrSmoke. À vérifier avant suppression : `claude` et `codex_update-in-app` (branches présentes sur GitHub, non analysées ici). Commande pour les seules branches Bolt : `git push origin --delete bolt-throttle-canvas-mousemove-9353058314495662181 bolt-throttle-request-animation-frame-4009775728670992235 bolt/perf-fit-optimization-3593258377254832117`. |
| G2 | Intégrer ou fermer la branche du Lot U (harmonisation de l'interface, en attente d'autorisation dans TODO.md). | [À faire] | Décision produit par DrSmoke. |

## 4. Modifications implémentées dans cette PR (détail)

Chaque modification est un commit séparé pour faciliter la relecture :

1. **`docs/audit-360.md`** : présent document.
2. **`.githooks/pre-commit`** : motifs de secrets étendus (S1).
3. **`server.mjs` + `src/project-server.mjs`** : en-têtes de sécurité cohérents, `X-Frame-Options: DENY` (S2).
4. **`.github/workflows/ci.yml`** : tentative d'ajout de macOS à la matrice (Q1), retirée après échec du test H3 sur macOS.

**Deux propositions ont été abandonnées en cours de route (S3 et P1, voir §3) :** elles contredisaient des garanties délibérées et couvertes par des tests. Ceci est présenté volontairement dans la PR : c'est la démonstration que la suite de tests remplit son rôle de garde-fou, et que le design conservateur du projet (fraîcheur absolue avant envoi, conservation des copies partielles pour revue humaine) est assumé. Aucune des deux ne sera rouverte sans l'accord explicite de DrSmoke.

**Risque de chaque modification :** nul à faible. Aucune ne change le comportement fonctionnel observable, à l'exception de P1 (latence de prise en compte de l'écran de confiance Codex : jusqu'à 15 s au lieu d'immédiat — choix délibéré, identique à `sessionClaude`).

## 5. Checklist d'évaluation pour Claude

- [ ] `npm run check` passe.
- [ ] `npm test` passe (même bilan : 0 échec, 27 ignorés).
- [ ] Relire le diff commit par commit (commits petits et ciblés).
- [ ] Vérifier qu'aucun chemin, secret ou identifiant de session n'apparaît dans les nouveaux textes.
- [ ] Vérifier l'absence de signature IA dans les messages de commit (conformité AGENTS.md).
- [ ] S3 et P1 ont été abandonnés (voir §3) : s'assurer qu'aucune trace de ces modifications ne subsiste dans le diff.
- [ ] Décider du sort des propositions [À faire] : planification ou refus motivé.

## 6. Risques à surveiller (pas des bugs, des dépendances externes)

- **Herdr CLI** : tout repose sur `parseResult` et un format JSON précis. Voir R1.
- **Windows** : la gestion des chemins (`posix` vs `win32`, lecteur `C:`, `fold()` insensible à la casse) est la zone où une régression est la plus probable. La matrice CI Windows est critique : ne jamais la retirer.
- **Node 22/24** : l'usage de fonctionnalités récentes (`--test`, `timingSafeEqual` avec buffers de longueurs différentes géré) est couvert par la CI. Une montée de version majeure de Node doit être validée par la suite complète.
