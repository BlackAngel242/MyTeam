# Découpage de `public/app.js` : plan

État mesuré le 25 octobre 2026 sur `claude/tests-eperm` (commit `ced4a8a`) : 1 990 lignes, 158 919 octets, 144 fonctions de premier niveau, 27 routes `/api/...`. Aucun code n'est modifié par ce document.

## Stratégie

- Scripts classiques, pas de modules ES. Chaque fichier se déclare comme `window.<Nom>` (même forme que `Tiles.mount`, `ResponseCard`, `Discussion`).
- Migration ES modules : hors périmètre pour l'instant. Tout le code est en scripts globaux ; la passer en modules serait le principal risque.
- Un lot = un fichier extrait, un commit, `npm run check` et `npm test` verts avant commit (règle de `dsh.md`).
- Aucune fonction ne change de comportement pendant l'extraction : déplacement, puis exposition explicite.

## Premier lot : `public/scene.js` (rendu canvas)

Frontière : lignes ~1020 à ~1770 de `app.js`, de `syncMotion` jusqu'à `frame(time)` incluse. Contient le décor, le personnage, la salle de réunion, le bureau du chef, le courrier, la scène et sa boucle d'animation.

### Ce qui part dans `scene.js`
- Le canvas hors écran `off` / `g` et les fonctions de dessin (`px`, `text`, `neon`, `pool`, `glow`, `room`, `station`, `person`, `drawOffice`, `draw`, etc.).
- La boucle : `syncSceneLoop`, `frame`, `sceneFrame`, `sceneTimer`.
- La disposition (`layout`, `custom`, `saveLayout`, `toLogical`, `syncLayoutEdit`) et le bureau VIP.
- Les acteurs animés (`actors`, `deskSpots`, `syncActors`, `drawActors`) et le courrier (`renderMail`, `mailLog`).

### Ce qui reste dans `app.js`
- Tout ce qui parle au DOM hors canvas : panneaux, listes, formulaires, `refreshState`, `renderAgents`.
- Les appels à `Scene.draw(...)` remplacent les appels directs `draw(...)`, aux cinq endroits relevés (lignes 119, 649, 676, 1020 et une ligne de `draw(lastFrame)`).

### Contrat `window.Scene` (proposé)
```
window.Scene = {
  draw(time),            // remplace draw(time)
  sync(),                // remplace syncSceneLoop()
  setPaused(on),         // remplace le réglage de paused et syncMotion
  toLogical(event),
  attentionTitle(),      // si la scène le lit
};
```
Les dépendances que `scene.js` lit depuis `app.js` doivent être passées, pas lues en global non déclaré. Liste mesurée :
- `state` (33 usages dans la scène) : passer par `Scene.init({ getState: () => state })`.
- `t` (traduction, 58 usages) et `$` (accès DOM) : déjà globaux dans `app.js` ; à exposer depuis un petit `public/bureau-base.js` chargé avant tout.
- `paused`, `selected`, `pixelCase`, `textWidth`, `hexRgb` : `pixelCase` et `textWidth` sont pures, à déplacer dans `scene.js`. `paused` vient de `Scene.setPaused`.
- Constantes d'état `WORK`, `FREE`, `WAIT` (ligne 1024) : utilisées dans `app.js` aussi. À déplacer dans `public/bureau-base.js` (ex. `window.ETATS`).

## Ordre de chargement (index.html)

Actuel : `appearance`, `i18n`, `i18n-en`, `logos`, `sounds`, `empty-icons`, `terminal`, `response-card`, `tiles`, `discussion`, `app`, `project-context`.

Cible :
1. `bureau-base.js` (nouveau : `$`, `ETATS`, petites aides partagées).
2. `scene.js` (nouveau, avant `app.js`).
3. Le reste inchangé, `app.js` ensuite.

Règle de `LESSONS.md` (leçon « script oublié dans index.html ») : un script oublié dans `index.html` ne produit aucune erreur visible. `test/index-scripts.test.mjs` exige que chaque `public/*.js` soit chargé par `index.html` et servi par `server.mjs`. Il faut donc ajouter les deux nouveaux fichiers aux deux endroits, dans le même commit.

## Lots suivants (après validation de `scene.js`)

Dans l'ordre proposé par DrSmoke, chacun avec un `window.X` et un paramètre `api` :
1. `queue-ui.js` (`loadQueue`, `renderQueue`, lignes ~141-198).
2. `todos-ui.js` (`loadTodos`, lignes ~199-244).
3. `files-ui.js` (`loadFiles`, `renderFileList`, `renderCrumbs`, lignes ~245-325).
4. `crisis-ui.js` (`loadCrisis`, `renderCrisis`, `openCrisis`, lignes ~845-911).
5. `auto-ui.js` (`loadAuto`, `renderAuto`, `openAuto`, lignes ~912-977).
6. `palette-ui.js` (`renderPalette`, `openPalette`, lignes ~1828-1853).
7. `direction-ui.js` (`renderDirection`, `setDirection`, lignes ~1854-1903).

Les numéros de lignes sont ceux de `ced4a8a` ; ils bougent à chaque lot, il faut les recalculer avant de découper.

## Tests à lancer après chaque lot

1. `npm run check` (ajoute le `node --check` du nouveau fichier).
2. `npm test` (Node 24, puis Node 22 avant tout push).
3. `test/index-scripts.test.mjs` : chargement et service de chaque script.
4. `test/canvas-scheduling.test.mjs` et `test/files.test.mjs`, les seuls tests qui citent `app.js`.
5. Vérification navigateur (`AGENTS.md`) : scène et panneau sur ordinateur et téléphone, avec états simulés et sans aucune consigne réelle. Playwright avec Edge installé hors du projet (leçon Interface et Playwright).

## Risques

- Ordre de chargement : un `window.X` utilisé avant son chargement échoue en silence (ex. « module absent », icônes vides). Mitigation : test `index-scripts` + capture.
- `state` est remplacé en entier à chaque rafraîchissement (leçon interface) : la scène ne doit pas stocker d'état propre dans `state`.
- Animation : `paused` et l'horloge partagée `now` ne doivent pas être réaffectés par la scène (leçon Playwright, `now`).
- Pas de changement de texte : toute chaîne reste dans `i18n.js` / `i18n-en.js`.

## Hors périmètre de ce plan

- Migration ESM.
- Refonte visuelle.
- Changement des routes `/api/...`.
