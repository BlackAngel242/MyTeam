# Correctifs proposés (à intégrer par Claude)

Ce document liste les correctifs concrets issus de la revue. Chaque correctif est décrit avec sa justification, le code exact, l'impact sur les tests et son niveau de risque. L'ordre est celui de priorité recommandé.

Contexte : les analyses complètes sont dans [`revue-360-exhaustive.md`](revue-360-exhaustive.md), [`reflexion-patterns.md`](reflexion-patterns.md) et [`synthese-experts.md`](synthese-experts.md).

---

## P1 — Sécurité : prouver la provenance sur `/api/state`

**Problème.** L'endpoint `GET /api/state` (dans `server.mjs`, autour de la ligne 394) remet le jeton de session sans exiger la preuve d'origine que toutes les autres routes exigent (`guard()`). Un processus local peut donc lire le jeton puis piloter le bureau. La frontière est assumée (le jeton ne défend pas contre un processus local), mais la barre minimale doit être identique partout. Le modèle de confiance est documenté dans `SECURITY.md`.

**Code.** Dans `server.mjs`, juste après l'ouverture du bloc `/api/state` :

```js
      if(req.method==='GET'&&url.pathname==='/api/state') {
        // Le client n'a pas encore le jeton : pas de contrôle de jeton ici.
        // En revanche, on exige la même preuve d'origine que les autres lectures
        // (Sec-Fetch-Site = same-origin posé par le navigateur, ou l'origine
        // exacte), pour ne pas remettre le jeton à un client sans provenance
        // (processus local brut).
        const origine=req.headers.origin;
        if(!(origine===origin||(!origine&&req.headers['sec-fetch-site']==='same-origin'))) {
          return json(403,{error:'Provenance du navigateur absente. Ouvre le bureau depuis son adresse locale.'});
        }
        try {
          const listed=await bridge.list();
```

La condition et le message sont identiques à la branche GET de `guard()` (même fichier, autour de la ligne 303).

**Impact sur les tests.** Les tests récupèrent le jeton en appelant `/api/state` sans en-tête d'origine. Deux changements mécaniques suffisent :

1. Dans chaque helper `send` local des fichiers de test, ajouter l'en-tête par défaut :

```js
// avant
headers:{Host:`127.0.0.1:${port}`,...headers}
// après
headers:{Host:`127.0.0.1:${port}`,'Sec-Fetch-Site':'same-origin',...headers}
```

2. Les tests qui vérifient le refus « sans provenance » doivent envoyer `'Sec-Fetch-Site':'none'` (au lieu de ne rien envoyer), car l'en-tête par défaut simule désormais le navigateur.

Fichiers concernés : `test/server.test.mjs` (helper + 3 assertions), `test/responses.test.mjs` (2 helpers), `test/crisis.test.mjs`, `test/files-server.test.mjs`, `test/relais.test.mjs`, `test/qa-herdr-server.test.mjs`, `test/autonomie-rouge.test.mjs`, `test/autonomie-recap.test.mjs`, `test/pied.test.mjs`, et les appels `fetch(...'/api/state')` de `test/broadcast.test.mjs`, `test/responses-autres.test.mjs`, `test/queue-files.test.mjs`, `test/traitement.test.mjs`, `test/utf8.test.mjs`, `test/update.test.mjs`, `test/project-server.test.mjs`, `test/crise-envois.test.mjs`, `test/sante.test.mjs`, `test/banc-10-agents.mjs`.

**Risque.** Moyen (beaucoup de fichiers de test, mais changement mécanique et vérifiable par `npm test`).

---

## P2 — Maintenabilité : factoriser la lecture des journaux JSONL

**Problème.** Trois fonctions sont dupliquées dans quatre fichiers : `completeLines`, `resumePossible`, `findTranscript`. Elles apparaissent dans `src/agent-activity.mjs`, `src/claude-activity.mjs`, `src/todos.mjs` et `src/delegations.mjs`.

**Code.** Extraire ces trois fonctions dans un nouveau `src/jsonl.mjs` et les importer depuis les quatre fichiers. La sémantique doit rester strictement identique (pas de changement de comportement).

**Risque.** Faible (extraction pure, les tests existants doivent rester verts sans modification).

---

## P3 — Orchestration : nourrir la consigne avec l'état réel

**Problème.** Le tableau de bord (`src/blackboard.mjs`) lit déjà `HANDOFF.md`, `TODO.md`, `LESSONS.md` et `AGENTS.md`, mais le résultat n'est jamais injecté dans la consigne du chef. La consigne (`src/autonomie.mjs`, ligne 102) reste une phrase générique. Le chef ne voit ni le focus du handoff, ni les tâches restantes, ni les leçons récentes.

**Code.**

1. Ajouter `docs/plan-travail.md` (et `JOURNAL.md` si pertinent) à la liste `FILES` de `src/blackboard.mjs` (ligne 9), avec une lecture tolérante si le fichier est absent.
2. Injecter `board.focus`, `board.todo` et `board.lessons` dans la consigne construite par `autonomie.passer()`, en remplaçant la phrase générique par un bref résumé (moins de 900 caractères).

**Risque.** Moyen (changement de comportement de la consigne ; à valider par un test de parité de consigne).

---

## P4 — Orchestration : arrêt « aucune progression »

**Problème.** Les six motifs d'arrêt actuels (`src/autonomie.mjs`) ne couvrent pas le cas où les délégations échouent ou n'avancent pas sans boucle détectée. Le chef peut tourner jusqu'au plafond d'échanges.

**Code.** Ajouter un septième motif d'arrêt près du détecteur de boucle (lignes 98-107 de `src/autonomie.mjs`) : si `N` délégations consécutives échouent ou si `TODO.md` ne change pas pendant `M` échanges, arrêter avec le motif « aucune progression ».

**Risque.** Moyen (nouvelle logique d'arrêt ; à couvrir par un test dédié).

---

## P5 — Maintenabilité : centraliser le numéro de version

**Problème.** Le numéro `0.5.1` est recopié en clair dans plusieurs fichiers (`README.md`, `HANDOFF.md`, `TODO.md`, `package.json`, `site/`), ce qui oblige à le corriger partout à chaque version.

**Code.** Définir la version dans un seul fichier source (par exemple `src/version.mjs`) et la lire depuis `package.json` et les affichages. Ne pas toucher aux fichiers historiques tant que le point d'entrée unique n'est pas en place.

**Risque.** Moyen (touche plusieurs fichiers ; à valider par le script `sync:interface` et les tests).

---

## Ordre conseillé

1. **P1** (sécurité) puis **P2** (maintenabilité, faible risque) en premier.
2. **P3** et **P4** (orchestration) ensuite, chacun avec son test dédié.
3. **P5** en dernier, car il touche au plus de fichiers.

Chaque correctif doit être livré en petits commits séparés, avec `npm run check` et `npm test` verts avant chaque commit, conformément aux règles du dépôt.
