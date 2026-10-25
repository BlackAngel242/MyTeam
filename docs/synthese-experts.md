# Synthèse de la revue à 6 experts — MyTeam

Revue croisée de six spécialistes (orchestration, architecture, identité/confiance, sécurité, IA, validation factuelle) sur le dépôt `MyTeam` (Node.js 22, zéro dépendance). Réponse pour Claude, qui se charge du code. Chaque point cite `fichier:ligne`.

## Verdict global

- Le **pattern superviseur** (un chef unique, étoile autour de lui, rien ne passe entre agents) est **le bon choix**. Il est confirmé par le code : `src/autonomie.mjs:1-6`, `src/delegations.mjs:400` (`bossOf`), `src/direction.mjs:119` (`effective`), `src/relais.mjs:58` (`observe`).
- Mais le chef travaille **à l'aveugle** : il n'a aucun retour d'information. Le résultat de la délégation (`delegations.mjs:204-220`) et le tableau noir (`blackboard.mjs`) sont calculés **mais jamais réinjectés** dans la consigne du chef.
- Le **backend est sain** (21 modules à responsabilité nette, ~70 fichiers de test, écritures atomiques). Le **frontend est monolithique** (`public/app.js`, 1990 lignes en portée globale). Une **faille de sécurité critique** est à corriger en priorité.

---

## 1. Sécurité — le point critique à traiter d'abord

### 1.1. Le jeton est exposé par une route publique (CRITIQUE)

`GET /api/state` n'appelle pas `guard()` (`server.mjs:394`) et renvoie `...token` dans le corps (`server.mjs:436`). Un processus local quelconque peut donc lire le jeton en clair, puis envoyer des consignes aux agents (`POST /api/prompt`, `/api/broadcast`), copier des fichiers, ou lever la salle de crise.

Les contrôles Host/Origin/Sec-Fetch-Site (`server.mjs:299-305`, `325-327`) sont forgeables hors navigateur : ils ne protègent que contre une page web malveillante (CSRF/DNS rebinding), **pas contre un processus local**.

**Correction** : protéger `/api/state` par le même `guard` que les autres routes de données, et ne plus renvoyer le jeton dans le corps (le renvoyer uniquement à l'établissement de session, ou passer à une liaison par origine + cookie `HttpOnly`).

### 1.2. Authenticité de la mise à jour (CRITIQUE)

Le zip et son `.sha256` viennent du même canal (`update.mjs:61-67`, `77-83`). Le SHA-256 prouve l'**intégrité** (le zip correspond à sa somme), **pas l'authenticité** (que la release est légitime). Un compte GitHub compromis qui re-signe le SHA-256 passe le contrôle.

**Correction** : signer les releases hors canal (minisign/age), clé publique **embarquée** dans le binaire, vérifiée avant extraction.

**Note** : le retour arrière existe déjà (`update-helper.mjs:10` sauvegarde `.myteam-backup-*`, `:19` rename, `:20` restauration, `:22` bilan de santé `healthy()`, `:23-31` restauration + relance). Ne pas le ré-implémenter.

### 1.3. Bords optionnels

- `error.message` brut renvoyé (chemins absolus) : `server.mjs:438`, `583`, `612`, `636`, `643`, `654` — à fermer, contraire à la discipline de masquage du reste.
- `/api/read` renvoie `bridge.read(id)` sans `masque()` (`server.mjs:480-483`) — vérifier si `herdr.mjs` masque en amont.
- Pas de limite de débit (impact faible : bind `127.0.0.1` + jeton 256 bits).
- `SECURITY.md` (7 lignes) ne documente pas le modèle de menace ni la frontière « le jeton ne protège pas d'un processus local ».

---

## 2. Orchestration — les quatre correctifs (par ordre)

### Correctif n°1 — Pass-through direct (anti-téléphone-arabe). Priorité max, effort local.

Le chef reçoit « Lis le panneau de X » (`relais.mjs:89`), lit une vue tronquée, puis reformule pour B. La sortie de A traverse **deux fois** son contexte.

**Concrètement** :
1. Remplacer dans `autonomie.mjs:102` « Lis son panneau, vérifie le résultat » par une instruction de **transmission à l'identique** : le chef devient *aiguilleur*, pas *traducteur*.
2. Joindre la **sortie brute de A** (via `herdr.mjs:141` `read(id)`, masquée avec `masque.mjs`).
3. Faire le pass-through **au niveau de `autonomie.passer()`**, pas dans le relais (`relais.mjs:10` refuse volontairement de faire sortir du contenu — ne pas casser ça).

### Correctif n°2 — Checkpointing du chef. Effort moyen, indépendant.

Le contexte du chef croît avec les échanges et se sature (goulot du superviseur). `blackboard.mjs` lit déjà les piliers mais n'est **jamais injecté**.

**Concrètement** :
1. Ajouter un paramètre `blackboard` à `createAutonomie` (`autonomie.mjs:27`) et injecter `getBlackboard()` (déjà câblé dans `project-server.mjs:31`).
2. Ajouter `docs/plan-travail.md` à la liste `FILES` (`blackboard.mjs:9`), où le chef écrit objectif + étape courante + décisions.

### Correctif n°3 — Quality gate (anti-propagation d'erreur). Effort moyen.

`delegations.mjs:204-220` capture le **type** de résultat, pas sa **conformité**. Trois agents différents qui échouent passent inaperçus.

**Concrètement** :
1. **Palier 1** (immédiat) : ajouter un motif d'arrêt « aucune progression » près du détecteur de boucle (`autonomie.mjs:98-100`) — compter les `error`/`stalled` consécutifs, ou l'absence de changement du TODO.
2. **Palier 2** (chantier) : contrôle de conformité (« le fichier demandé existe *et correspond* »), renvoyer à A sinon (réutiliser `queue.mjs:286` `enqueue`).

### Correctif n°4 — Consensus pour les groupes. Conditionnel.

Uniquement si la fonctionnalité « groupes » est confirmée. Étendre la regex `CIBLE` (`delegations.mjs:152`) pour les noms de groupe, réutiliser `herdr.mjs:166` (`broadcast`), agréger le retour. Le vote pondéré + débat est un module à part, à traiter en dernier.

---

## 3. Architecture — découper sans casser

### 3.1. `public/app.js` : monolithe frontend (priorité 1)

1990 lignes en portée globale, ~15 responsabilités, dont ~750 lignes de rendu canvas (`app.js:1024-1770`, `draw:1649`). C'est le seul coin **sans test unitaire**.

**Découpage non cassant** (les modules `response-card.js` / `tiles.js` montrent la voie, contrat `window.*`) :
1. Extraire le canvas en `public/scene.js` exposant `window.Scene` (plus gros morceau, autonome).
2. Puis `queue-ui.js`, `todos-ui.js`, `files-ui.js`, `crisis-ui.js`, `auto-ui.js`, `palette-ui.js`, `direction-ui.js` — chaque module reçoit un `api`, ne lit plus le `state` global.
3. Garder `app.js` comme chef d'orchestre mince (état + boucle de rafraîchissement + câblage).

### 3.2. `server.mjs` : composeur + routeur mélangés (priorité 2)

`createBureauServer` (`server.mjs:31`) reçoit ~30 clés, instancie les modules **et** héberge ~20 routes en ligne (`server.mjs:285-655`).

**Concrètement** : extraire `src/router.mjs` (table déclarative `{method, path, handler}` + `guard()` + `readJson`). `createBureauServer` devient un pur composeur.

### 3.3. Duplication de lecture jsonl

`completeLines()` / `resumePossible()` / `findTranscript()` recopiés dans 4 fichiers (`agent-activity.mjs:78`, `claude-activity.mjs:156` et `:44`, `todos.mjs:33`, `delegations.mjs:272`). **Extraire `src/jsonl.mjs`** (pur, zéro changement de comportement).

### 3.4. `public/` et `site/` divergent

`sync-interface.mjs` ne synchronise que 3 assets, mais `site/` contient une seconde interface complète qui dérive. À court terme : élargir la synchronisation aux logos et variables de thème ; à terme : générer `site/` depuis `public/`.

---

## 4. IA — la consigne d'autonomie est un « réveil », pas un « briefing »

La consigne (`autonomie.mjs:102`) est bien structurée *formellement* (objectif verbatim, interdits primant sur l'objectif, bornage), mais **réactive et sous-alimentée** :

- **Réactive** : le chef n'est réveillé qu'à la fin d'un agent (`relais.mjs:72`), jamais pour planifier.
- **Sous-alimentée** : le tableau noir n'est **jamais injecté** dans le prompt (seulement exposé à l'UI). La liste `FILES` (`blackboard.mjs:9`) omet `docs/plan-travail.md` et `JOURNAL.md`.
- Le **téléphone arabe** est réel **sur le contexte de coordination** (read-then-rewrite du chef), mais atténué **sur le produit** (les fichiers et git sont partagés).

**Concrètement** :
1. Injecter `board.focus` + `board.todo.remaining` + `board.lessons.latest` dans `relais.mjs:89` et `autonomie.mjs:102` (changement local, concaténation, aucun nouveau parsing).
2. Ajouter `docs/plan-travail.md` à `FILES` (`blackboard.mjs:9`) et en extraire la case courante.
3. Viser un brief budgété de ~600-900 caractères (pas un dump) : HANDOFF courant, 3 cases TODO, 2-3 leçons.
4. Interdire la reformulation dans la consigne : « transmets à B le compte rendu de A tel quel ; tu n'ajoutes que la décision de qui fait quoi ».

---

## 5. Corrections factuelles déjà appliquées aux deux autres documents

Le validateur factuel a relevé 4 erreurs, corrigées dans `revue-360-exhaustive.md` et `reflexion-patterns.md` :

1. `npm run check` = **38** `node --check` (pas 45).
2. Le **retour arrière de mise à jour existe déjà** (`update-helper.mjs`) — le point restant est l'authenticité, pas le rollback.
3. La phrase « Lis son panneau, vérifie le résultat… » est dans `autonomie.mjs:102` (mode autonomie), pas dans `relais.mjs:89` (qui dit « Lis son panneau avant de lui confier la suite »).
4. `scripts/evaluer.mjs` est une **auto-évaluation de projet**, pas un contrôleur de sortie de délégation.

Tous les autres chiffres (tailles de fichiers, métriques CI, contrôles de sécurité, 63 fichiers de test) sont **confirmés exacts**.

---

## 6. Ordre de priorité global (pour Claude)

| # | Chantier | Priorité | Effort |
|---|---|---|---|
| 1 | Protéger `/api/state` (jeton) | Critique | Faible |
| 2 | Signer les releases (authenticité) | Critique | Moyen |
| 3 | Pass-through (anti-téléphone-arabe) | Forte | Faible |
| 4 | Injecter le tableau noir dans la consigne | Forte | Faible |
| 5 | Extraire le canvas de `app.js` | Forte | Moyen |
| 6 | Quality gate « aucune progression » | Forte | Faible |
| 7 | Extraire `src/router.mjs` | Moyenne | Moyen |
| 8 | Factoriser `src/jsonl.mjs` | Moyenne | Faible |
| 9 | Checkpointing (`plan-travail.md` dans `FILES`) | Moyenne | Faible |
| 10 | Consensus groupes | Conditionnelle | Important |
