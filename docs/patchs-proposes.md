# Correctifs proposés (état au 25/10/2026)

Ce document liste les correctifs concrets issus de la revue. Chaque correctif est décrit avec sa justification, le code exact, l'impact sur les tests et son niveau de risque. L'ordre est celui de priorité recommandé.

Contexte : les analyses complètes sont dans [`revue-360-exhaustive.md`](revue-360-exhaustive.md), [`reflexion-patterns.md`](reflexion-patterns.md) et [`synthese-experts.md`](synthese-experts.md).

## État d'avancement

| Correctif | État |
|---|---|
| P1 — sécurité `/api/state` | ✅ Livré, commit 63e324a |
| P2 — factoriser la lecture JSONL | ✅ Livré, commit `abd65dd` |
| P3 — nourrir la consigne | ✅ Livré, commit `97c8fa2` |
| P4 — arrêt « aucune progression » | ✅ Livré, commit 264aaf9 (critère des délégations en échec non implémenté) |
| P5 — centraliser la version | ✅ Livré, commit 187a888 (point d'entrée seul ; textes publics inchangés) |

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

**État.** ✅ Livré dans le commit `abd65dd`. Le module `src/jsonl.mjs` est créé et les quatre fichiers importent désormais `completeLines`, `resumePossible` et `findTranscript`.

---

## P3 — Orchestration : nourrir la consigne avec l'état réel

**Problème.** Le tableau de bord (`src/blackboard.mjs`) lit déjà `HANDOFF.md`, `TODO.md`, `LESSONS.md` et `AGENTS.md`, mais le résultat n'est jamais injecté dans la consigne du chef. La consigne (`src/autonomie.mjs`, ligne 102) reste une phrase générique. Le chef ne voit ni le focus du handoff, ni les tâches restantes, ni les leçons récentes.

**Code.**

1. Ajouter `docs/plan-travail.md` (et `JOURNAL.md` si pertinent) à la liste `FILES` de `src/blackboard.mjs` (ligne 9), avec une lecture tolérante si le fichier est absent.
2. Injecter `board.focus`, `board.todo` et `board.lessons` dans la consigne construite par `autonomie.passer()`, en remplaçant la phrase générique par un bref résumé (moins de 900 caractères).

**Risque.** Moyen (changement de comportement de la consigne ; à valider par un test de parité de consigne).

**État.** ✅ Livré dans le commit `97c8fa2`. `docs/plan-travail.md` est ajouté à `FILES`, et `autonomie.passer()` injecte désormais un résumé du tableau mural (`focus`, `todo`, `plan`, `leçons`) borné à 600 caractères, avec lecture tolérante en cas d'absence.

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

## Ordre conseillé pour le reste

P2 et P3 sont déjà livrés. Restent à décider, dans cet ordre :
1. **P1** (sécurité) en premier.
2. **P4** (orchestration) ensuite, avec son test dédié.
3. **P5** en dernier, car il touche au plus de fichiers.

Chaque correctif restant doit être livré en petits commits séparés, avec `npm run check` et `npm test` verts avant chaque commit, conformément aux règles du dépôt.
