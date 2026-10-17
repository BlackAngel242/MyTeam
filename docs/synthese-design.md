# Synthèse de la revue de design (17 octobre 2026)

Sources : 13 captures Playwright (`captures/revue-design/`), propositions de Codex (`docs/propositions-design-codex.md`), d'Antigravity (`docs/propositions-design-antigravity.md`) et critique de Claude. OpenCode rendra la sienne après sa mission serveur.

## Points d'accord et décisions

| N° | Constat partagé | Décision | Qui |
|---|---|---|---|
| D1 | « Disponible » affiché pour un agent en pause de limite (fiche, carte, palette). | Un seul état principal partout : « En pause (limite) » quand la pause est observée ; l'état Herdr reste dans les informations détaillées. | Claude |
| D2 | Alerte et aide du mode Disposer superposées ; alerte écrasée sur téléphone. | L'aide de disposition passe sur sa propre ligne sous la barre ; l'alerte reste compacte sur ordinateur et prend toute la largeur sur téléphone. | Claude |
| D3 | Noms et panneaux tronqués à 1280 px. | Cartes sur deux lignes (nom, puis état) avec l'identifiant Herdr en petite pastille ; grille de deux colonnes sous 1360 px. | Claude |
| D4 | Onglet Équipe noyé sous les explications. | Une phrase par section, compteurs dans les titres, détail renvoyé à l'aide. | Claude |
| D5 | Terminal trop court dans Poste. | Le terminal prend la hauteur restante ; bouton « Agrandir » pour le lire en pleine hauteur. | Claude |
| D6 | Erreurs présentées comme des listes vides. | Bloc d'erreur commun avec bouton « Actualiser le bureau » ; jamais « aucun » après une lecture échouée. Icônes pixel d'état vide. | Claude, icônes Antigravity |
| D7 | Panneau vide avant toute sélection. | Invitation courte et choix direct des agents. | Claude |
| D8 | Téléphone : débordement et composition d'ordinateur. | Composition mobile dédiée, règles CSS proposées par Codex puis appliquées par Claude. | Codex, Claude |

## Reporté, à décider avec DrSmoke

- Bureau en tuiles ou en fenêtres (idée audacieuse commune à Codex et Antigravity) : grand chantier, après D1 à D8.
- Carrousel mobile (Antigravity) : à comparer avec la composition proposée par Codex.
