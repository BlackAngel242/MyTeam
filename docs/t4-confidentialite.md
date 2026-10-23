# T4 (F3) : inventaire de ce qui sort de la machine
Date : 23 octobre 2026. Branche `agent/dola/T4-confidentialite`. Inventaire seul, aucune suppression.

## Méthode
Inventaire de tout ce qui peut quitter la machine vers d'autres personnes. Pour chaque élément : contenu, qui peut le voir, preuve (fichier, ligne, ou contenu réel). Aucune suppression.

## 1. Interface servie en réseau
- **Écoute** : `server.mjs` ligne 670 : `server.listen(port,'127.0.0.1',...)`. Port 4317 par défaut (`server.mjs` ligne 666, variable `BUREAU_PORT`).
- **Qui peut voir** : uniquement la machine locale. 127.0.0.1 n'est pas joignable depuis le réseau.
- **Statut** : testé (lecture du code). Conforme à la règle d'`AGENTS.md` (« Serveur sur 127.0.0.1 uniquement »).

## 2. Site GitHub Pages (`site/`)
- **Contenu** : `site/index.html`, `site/style.css`, `site/appearance.css`, `site/site.js`, `site/appearance.js`, `site/icons.svg`, et `site/assets/` (17 captures PNG + 3 médias : `tournee-du-chef.gif`/`.mp4`/`.webm`).
- **Publication** : `.github/workflows/pages.yml` publie `site/` sur GitHub Pages à chaque push sur `main` (chemin `site/**`). URL publique : `https://blackangel242.github.io/MyTeam/` (champ `homepage` du dépôt, `has_pages: true`).
- **Qui peut voir** : tout le monde (site public).
- **Statut** : testé (liste des fichiers + workflow + API GitHub). Les captures sont faites avec des états simulés (`AGENTS.md` : « captures de vérification se font avec Playwright et des états simulés »), mais leur contenu réel n'est pas vérifié ici (pas d'OCR). À vérifier visuellement par SmokeSama.

## 3. Captures (`docs/captures/`, `site/assets/`)
- **`docs/captures/`** : 18 fichiers PNG (01-ordinateur-scene.png … 18-ordinateur-autonomie-en.png). Suivis par Git.
- **`site/assets/`** : 17 captures PNG + 3 médias. Suivis par Git, publiés sur GitHub Pages (voir 2).
- **`.gitignore` ligne 8** : `/captures/` est ancré à la racine — il n'ignore que `captures/` à la racine, pas `docs/captures/`. Ce point est déjà une leçon dans `LESSONS.md` (« Dans .gitignore, ancrer /captures/ avec un slash initial : sans slash, la règle ignore aussi docs/captures/ »). Ici le slash initial est présent, donc `docs/captures/` est bien suivi.
- **Qui peut voir** : tout le monde (dépôt Git public, et `site/assets/` en plus sur GitHub Pages).
- **Statut** : testé (liste des fichiers + .gitignore). Contenu des images : non vérifié (pas d'OCR dans cet environnement).

## 4. Archives publiées (releases)
- **Release v0.5.0** « Ṣàngó » publiée (pas un brouillon), avec 2 assets téléchargeables (API GitHub `/releases`).
- **Aucune archive** (zip/tar/gz) n'est présente dans le dépôt Git lui-même (`git ls-files` ne renvoie aucun fichier d'archive).
- **Qui peut voir** : tout le monde (release publique).
- **Statut** : testé (API GitHub + git ls-files).

## 5. Fichiers suivis par Git (`HANDOFF.md`, `LESSONS.md`, `docs/`, racine)
Le dépôt est public (`visibility: public`). Tous les fichiers suivis sont visibles par tous.

### 5.1 Secrets et jetons
- **Aucun secret réel** trouvé : `git grep` sur `ghp_`, `github_pat_`, `sk-`, `password`, `api_key` ne renvoie que des mentions documentaires (explications dans la doc, pas de valeurs).
- **Statut** : testé.

### 5.2 Chemins personnels et noms d'utilisateur
- **Aucun chemin personnel réel** trouvé. Seuls des exemples génériques : `C:\Users\vous` (`docs/INSTALLATION.md` ligne 180), `C:\Users\you` (`docs/INSTALLATION.en.md` ligne 180), `~/.herdr/...`.
- **Statut** : testé.

### 5.3 Emails et identités
- **Aucun email réel** dans les fichiers suivis. L'unique identité Git est `DrSmoke <160735734+BlackAngel242@users.noreply.github.com>` (forme noreply de GitHub).
- **Statut** : testé.

### 5.4 Risque signalé : masquage incomplet (déjà connu)
- `docs/revue-opencode-final.md` ligne 31 : le masque (`src/masque.mjs`) ne couvre pas certaines formes : racines Unix `workspace`, `data`, `srv` ; secrets `AIza…` et `github_pat_…` ; empreintes `@`+hexadécimal ; digests longs.
- **Conséquence** : si un chemin personnel ou un secret de ces formes apparaît dans une réponse affichée ou dans une capture, il ne serait pas masqué. C'est un risque potentiel de fuite, pas une fuite constatée.
- **Statut** : testé (lecture du rapport existant). Déjà consigné, non corrigé dans ce plan.

## 6. État d'exécution privé
- `.myteam-local/` est ignoré par Git (`.gitignore` ligne 14). L'état d'exécution MyTeam (file d'attente, direction, autonomie) y est conservé, hors du dépôt. Conforme à `HANDOFF.md` (« L'état d'exécution est privé, par projet, dans les données locales du système sous MyTeam, hors checkout »).
- **Statut** : testé.

## Résultat par point
| Point | Statut | Preuve |
|---|---|---|
| Serveur sur 127.0.0.1 uniquement | testé | server.mjs ligne 670 |
| Site GitHub Pages public | testé | .github/workflows/pages.yml, API (has_pages=true) |
| Captures dans docs/captures/ suivies par Git | testé | ls docs/captures/, .gitignore ligne 8 |
| Captures dans site/assets/ publiées sur Pages | testé | ls site/assets/, pages.yml |
| Release v0.5.0 publique, 2 assets | testé | API GitHub /releases |
| Aucune archive dans le dépôt | testé | git ls-files |
| Aucun secret réel dans les fichiers suivis | testé | git grep |
| Aucun chemin personnel réel | testé | git grep (exemples génériques seulement) |
| Aucun email réel | testé | git log + git grep |
| Risque de masquage incomplet (AIza, github_pat_, workspace, srv) | testé (déjà connu) | docs/revue-opencode-final.md ligne 31 |
| État privé dans .myteam-local/ ignoré | testé | .gitignore ligne 14 |
| Contenu réel des images (OCR) | non testé | pas d'OCR dans cet environnement |
| Windows | non testé | réservé à SmokeSama |

## Conclusion
Rien ne sort par le réseau (serveur en localhost). Ce qui sort : le dépôt Git public (docs, captures, code), le site GitHub Pages (captures + médias), et la release v0.5.0 (2 assets). Aucun secret, chemin personnel ou email réel n'y est trouvé. Un risque potentiel existe : le masque ne couvre pas certaines formes de secrets/chemins (déjà consigné). Aucune suppression effectuée.

Leçon ajoutée à LESSONS.md : non.
