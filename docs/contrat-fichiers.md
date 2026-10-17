# Contrat de l'explorateur de fichiers

Auteur : Claude (coordinateur). Module : `src/files.mjs` (Claude), testé par `test/files.test.mjs`. Branchement dans `server.mjs` : Codex.

## Lieux autorisés

Le serveur seul décide des racines. Le navigateur ne fournit jamais de chemin absolu.

- `agent:<id de l'agent>` : le dossier de travail de cet agent, relu dans `herdr agent list` à chaque requête. Un agent disparu n'a plus de racine.
- `bureau`, `documents`, `telechargements` : `standardPlaces()` de `src/files.mjs`, seulement s'ils existent.

## Routes

Toutes exigent l'origine exacte et le jeton `X-Bureau-Token`, y compris les lectures, car elles révèlent des noms de fichiers.

| Route | Entrée | Réponse |
|---|---|---|
| `GET /api/places` | aucune | `{places:[{key,label,kind:'agent'|'place'}]}` |
| `GET /api/files/recent?id=<id>` | agent Herdr | `{root:'agent:<id>', files:[{name,path,size,modified,ext,dir}]}` via `recentFiles` |
| `GET /api/files/list?root=<clé>&path=<relatif>` | racine et chemin relatif | `{root, path, items:[…]}` via `listDir` |
| `POST /api/files/transfer` | `{from:{root,path}, to:{root,path}, mode:'copy'|'move'}` | `{ok, name, path, mode}` via `transfer` |
| `POST /api/files/reveal` | `{root,path}` | ouvre l'Explorateur Windows sur le fichier (`explorer.exe /select,<chemin réel>` via execFile, sans shell) ; ailleurs, 501 |

Les `FileError` deviennent des 400 avec leur message ; les autres erreurs restent des 500.

## Interdits

Aucune suppression, aucun écrasement, aucun dossier copié pour le moment, aucun lien symbolique suivi, aucun chemin absolu accepté ni renvoyé. Un fichier n'est « produit par » un agent que si un journal le prouve ; sinon il est « modifié récemment dans son dossier ».
