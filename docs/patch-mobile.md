# D8 : composition sur téléphone

Proposition CSS pour Claude, après lecture de `docs/synthese-design.md`, du HTML et des styles actuels. Cibles : fenêtres de **390 px et 360 px de large**. Seul ce document est modifié. Application et vérification Playwright à faire par Claude ; aucun résultat visuel après correction n'est revendiqué ici.

## Où copier

Ajouter **les deux blocs suivants à la toute fin de `public/style.css`**, après les règles existantes. Ils remplacent, par priorité dans la feuille, les déclarations mobiles concernées. Conserver les autres règles, notamment `[hidden]{display:none!important}`, les états, le focus et la réduction des mouvements. Aucun changement HTML requis pour la structure lue.

Ne pas ajouter `overflow-x:hidden` au document : cela cacherait une partie du bureau sans corriger sa largeur. Ne pas utiliser `width:100vw` sur les blocs de contenu. Le défilement vertical de la page est volontaire sur téléphone.

## Bloc 1 : une colonne sans largeur minimale imposée

**Défaut corrigé :** `grid-template-columns:1fr` peut conserver la largeur minimale de la barre de scène ou du canvas. Le panneau doit rester sous le bureau, y compris avec un nom ou un chemin long. Ce bloc remplace les propriétés correspondantes de la règle actuelle `max-width:860px`.

```css
@media (max-width: 860px) {
  main,
  main:fullscreen {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
    gap: 24px;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    height: auto;
    min-height: 0;
  }

  main > .office-section,
  main > .detail {
    min-width: 0;
    max-width: 100%;
  }

  .office-frame,
  .office-top,
  .office-tools,
  .scene-wrap,
  .tab-panel,
  .output-wrap {
    min-width: 0;
    max-width: 100%;
  }

  .detail {
    align-self: stretch;
    width: 100%;
    height: auto;
    max-height: none;
    padding: 20px 0 0;
    border-left: 0;
    border-top: 1px solid var(--line);
    overflow: visible;
  }

  .tab-panel {
    overflow-wrap: anywhere;
  }
}
```

## Bloc 2 : composition dédiée à 390 et 360 px

Chaque groupe ci-dessous précise le défaut corrigé. Copier **le bloc entier**, après le précédent. Il couvre les deux largeurs sans règle différente à 360 px.

```css
@media (max-width: 520px) {
  /* En-tête : identité et connexion, puis actions, puis résumé compact. */
  .topbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    min-height: 0;
    margin: 0 12px;
    padding: 10px 0;
  }

  .brand {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    gap: 8px;
    font-size: 16px;
    overflow-wrap: anywhere;
  }

  .brand > span:last-child {
    min-width: 0;
  }

  .brand-sub {
    display: none;
  }

  .brand-mark {
    flex-shrink: 0;
    padding: 7px;
  }

  .connection {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
    max-width: 100px;
    margin-left: 0;
    gap: 5px;
    font-size: 12px;
  }

  /* Le statut reste lisible : le point seul ne suffit pas. */
  .connection span:last-child {
    position: static;
    width: auto;
    height: auto;
    min-width: 0;
    overflow: visible;
    clip-path: none;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .top-actions {
    grid-column: 1 / -1;
    grid-row: 2;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    min-width: 0;
  }

  .top-actions .icon-button {
    width: 100%;
    min-width: 44px;
    min-height: 44px;
    padding: 8px;
  }

  /* Les textes des boutons restent accessibles comme dans le CSS actuel. */
  .top-actions .icon-button span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .top-actions .icon-button kbd {
    display: none;
  }

  .chips {
    grid-column: 1 / -1;
    grid-row: 3;
    order: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
    gap: 4px;
  }

  .chip {
    min-width: 0;
    gap: 4px;
    padding: 5px 6px;
    font-size: 12px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .chip i {
    flex-shrink: 0;
  }

  /* Le contenu utilise la largeur disponible, sans largeur de bureau fixe. */
  main,
  main:fullscreen {
    padding: 12px;
    gap: 20px;
  }

  /* La barre devient verticale : libellé, alerte, puis outils. */
  .office-top {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    justify-content: stretch;
    gap: 8px;
    padding: 10px;
  }

  .office-top > span:first-child {
    display: flex;
    min-width: 0;
    white-space: normal;
  }

  /* Remplace aussi les règles .office-top .attention placées après
     les anciens médias : ni ellipse, ni bouton écrasé. */
  .office-top .attention {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    align-items: start;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    margin: 0;
    padding: 10px;
    gap: 8px;
  }

  .office-top .attention svg {
    width: 16px;
    height: 16px;
    margin-top: 2px;
  }

  .office-top .attention p {
    min-width: 0;
    margin: 0;
    font-size: 13px;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    overflow-wrap: anywhere;
  }

  .office-top .attention button {
    grid-column: 1 / -1;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
    padding: 10px;
    font-size: 13px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  /* Les outils ont leur propre rangée et peuvent passer sur deux lignes.
     L'aide de disposition et le compteur ne rivalisent pas avec les boutons. */
  .office-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    justify-content: flex-start;
    width: 100%;
    min-width: 0;
    gap: 8px;
  }

  .office-tools #office-count,
  .office-tools #layout-hint {
    flex: 0 1 100%;
    min-width: 0;
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .office-tools #office-count {
    order: -2;
  }

  .office-tools #layout-hint {
    order: -1;
  }

  .office-tools .frame-button {
    flex: 1 1 120px;
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
    padding: 8px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .office-tools .frame-button svg {
    flex-shrink: 0;
  }

  /* La scène entière suit les proportions du dessin fourni par app.js.
     Ne pas imposer ici de hauteur ni de ratio fixe avec !important. */
  .scene-wrap {
    width: 100%;
    min-width: 0;
    height: auto;
    min-height: 0;
    max-height: none;
  }

  .scene-wrap > canvas#office {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    height: auto;
    max-height: none;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .scene-notice {
    top: 50%;
    width: calc(100% - 24px);
    min-width: 0;
    max-width: 320px;
    padding: 12px;
    overflow-wrap: anywhere;
  }

  .office-bottom {
    padding: 10px;
    overflow-wrap: anywhere;
  }

  /* Cartes : deux colonnes, noms et états complets, grandes cibles tactiles. */
  .team-heading {
    flex-wrap: wrap;
    gap: 4px 8px;
    margin: 12px 0 8px;
  }

  .team-heading > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .agents-list {
    display: grid;
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-columns: auto;
    gap: 8px;
    overflow: visible;
    padding-bottom: 0;
  }

  .agent-button {
    align-items: flex-start;
    width: 100%;
    min-width: 0;
    min-height: 64px;
    gap: 8px;
    padding: 10px 8px;
  }

  .agent-button > span:last-child {
    display: block;
    flex: 1;
    min-width: 0;
  }

  .agent-name,
  .agent-status {
    display: block;
    min-width: 0;
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    overflow-wrap: anywhere;
  }

  .agent-status {
    margin-top: 3px;
  }

  .agent-button .agent-logo {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  /* Panneau : quatre onglets contenus dans la largeur et terminal local. */
  .tabs {
    position: static;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
    min-width: 0;
    margin-bottom: 16px;
  }

  .tab {
    flex-wrap: wrap;
    min-width: 0;
    min-height: 44px;
    gap: 4px;
    padding: 8px 4px;
    font-size: 12px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .detail-heading > div:not(.small-avatar) {
    min-width: 0;
  }

  .term-tools {
    flex-wrap: wrap;
    min-width: 0;
  }

  .term-tools input {
    flex: 1 1 100%;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    font-size: 16px;
  }

  .term-tools .tool-button {
    min-height: 44px;
  }

  #output {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 180px;
    max-height: 340px;
    padding: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    overflow: auto;
  }

  .detail textarea {
    min-width: 0;
    max-width: 100%;
    font-size: 16px;
  }

  .detail #send,
  .detail #broadcast-send {
    min-height: 44px;
    gap: 8px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .agent-meta div {
    flex-wrap: wrap;
    gap: 2px 8px;
  }

  .agent-meta dd {
    min-width: 0;
    max-width: 100%;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .files-head {
    flex-wrap: wrap;
  }

  .target,
  .place,
  .crumbs button {
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  /* L'aide et la palette ouvertes ne doivent pas agrandir la page. */
  .help {
    width: 100%;
    max-width: 100%;
  }

  .help-body {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .help-toggles .tool-button {
    max-width: 100%;
    min-height: 44px;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .palette-backdrop {
    padding: 16px 12px;
  }

  .palette-box {
    min-width: 0;
    max-width: 100%;
  }

  #palette-input {
    min-width: 0;
    font-size: 16px;
  }

  #palette-list li {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 3px;
    min-width: 0;
    min-height: 44px;
    overflow-wrap: anywhere;
  }

  .palette-foot {
    overflow-wrap: anywhere;
  }

  .page-footer {
    flex-direction: column;
    min-width: 0;
    margin: 16px 12px 0;
    padding: 12px 0;
    gap: 4px;
    overflow-wrap: anywhere;
  }
}
```

## Points importants pour l'intégration

- **Ordre des règles :** le bloc doit rester après `.office-top .attention…`, car ces déclarations actuelles sont placées après les anciens médias et imposent encore `white-space:nowrap` et une petite hauteur au bouton. Les sélecteurs du correctif gardent la même précision et passent après eux.
- **Proportions de la scène :** la lecture ciblée du dimensionnement dans `app.js` confirme que le canvas reçoit une largeur et une hauteur intrinsèques, et que son parent reçoit leur ratio. `width:100%;height:auto` conserve le dessin complet. Le CSS ne repositionne aucun personnage et ne change aucun fait affiché. Un agrandissement fractionnaire peut rendre les pixels d'épaisseurs légèrement différentes ; ne pas tenter de le corriger en découpant la scène.
- **Éléments masqués :** `[hidden]` doit continuer de gagner, notamment pour l'alerte, Réinitialiser et l'aide de disposition. Le correctif n'emploie pas de `display:…!important`.
- **Coordination avec D2/D3/D5 :** cette proposition vise le HTML lu, où `#layout-hint` est encore dans `.office-tools` et les cartes ont `.agent-name` et `.agent-status`. Si Claude déplace l'aide sous `.office-top`, sa nouvelle ligne doit aussi avoir `min-width:0`, `max-width:100%`, `white-space:normal` et `overflow-wrap:anywhere`. Vérifier également ses nouveaux sélecteurs de cartes et d'agrandissement du terminal avant collage. Ne pas superposer une ancienne barre d'ordinateur au bloc mobile.
- **Portée :** les boutons sous la scène restent l'alternative tactile aux petites cibles du canvas. CSS seul ne garantit pas le glisser-déposer sur écran tactile ; D8 ne doit pas annoncer ce geste comme vérifié.

## Vérification demandée à Claude, après application

À **390 × 844** puis **360 × 800**, avec une capture dédiée pour chaque largeur :

1. Mesurer `document.documentElement.scrollWidth <= document.documentElement.clientWidth` à l'état normal, avec l'alerte affichée, en mode Disposer, puis avec Aide et Commandes ouvertes. Ne pas masquer un dépassement par `overflow-x:hidden`.
2. Tester un long nom d'agent, une longue attente, un chemin sans espaces et un terminal contenant une longue ligne. Aucun texte ne doit forcer la largeur de la page ; la scène doit rester entière.
3. Confirmer que l'alerte et son bouton occupent la largeur utile, que les outils disposent de leur rangée, et que les trois boutons de disposition peuvent revenir à la ligne sans chevauchement.
4. Vérifier que les cartes gardent le nom, l'état et une cible d'au moins 44 px de haut ; sélectionner un poste et retrouver son panneau sous la scène. Vérifier aussi le focus au clavier.
5. Avec le clavier virtuel ouvert, vérifier la recherche et la consigne, puis un défilement vertical commencé sur la scène hors mode Disposer. Les dimensions seules ne prouvent pas le comportement tactile.

Toutes les vérifications utilisent des états simulés, sans envoi de consigne ni transfert de fichier réel. Pas de carrousel, pas de nouvelle fonction, pas de modification des règles d'autorisation.
