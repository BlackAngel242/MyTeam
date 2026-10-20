# Interface harmonisée

Périmètre approuvé par DrSmoke le 20 octobre 2026 : Lucide, thèmes et corrections de la revue PRD/Fixit. L'extension VS Code reste reportée.

- Une famille Lucide pour les contrôles et les cartes de la vitrine. Les personnages, les emblèmes et les états vides pixel art sont conservés.
- Assets livrés localement, sans dépendance npm ni requête vers un fournisseur d'icônes. Notices Lucide/Feather conservées.
- Apparence : Système, Clair, Sombre. Le choix reste propre à chaque origine et suit le système seulement en mode Système. Aucun changement du cycle horaire du canvas.
- La galerie reste utilisable au clavier : le fond est inerte pendant l'agrandissement, Échap ferme et le focus revient à la vignette.
- Les outils reconnus sont distingués des lecteurs de journaux enrichis. Les légendes des captures décrivent leur contenu.

Validation : rendu à 360, 390, 768 et 1366 px, clavier, FR/EN, rechargement, système et stockage indisponible ; contrôle des contrastes, tests existants et captures sur données simulées uniquement.


## Maintenance

Les sources communes sont `public/appearance.js`, `public/appearance.css` et `public/icons.svg`. Après modification : `npm run sync:interface` recopie ces trois fichiers dans `site/`. Les tests HTTP vérifient les copies distribuées et le type MIME SVG. Les notices complètes Lucide/Feather sont intégrées au sprite pour accompagner aussi le site GitHub Pages ; leur copie lisible est dans `docs/licences-lucide.txt`.

Les SVG proviennent de https://github.com/lucide-icons/lucide/tree/main/icons (récupérés le 20 octobre 2026). Aucun appel à ce catalogue n'est nécessaire à l'exécution. Les sorties terminal gardent volontairement leur fond sombre et leurs couleurs de surlignage ; les blocs Markdown utilisent les couleurs du thème.

Les tests navigateur sont optionnels et ne nécessitent aucune dépendance de production : installer Playwright hors du projet, puis lancer `MYTEAM_BROWSER_TESTS=1 MYTEAM_PLAYWRIGHT_MODULE=<module Playwright> MYTEAM_CHROMIUM=<exécutable Chromium> node --test test/interface-browser.test.mjs`. Ajouter `MYTEAM_REFRESH_CAPTURES=1` pour régénérer les captures de documentation sur les seules données simulées ; toutes les écritures API y sont refusées.
