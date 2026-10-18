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

## E2 : fichiers joints à une consigne en file

**Réponse exacte de `POST /api/queue` (HTTP 200)** :

```js
{
  itemId, id, message, notBefore, priority, state,
  createdAt, updatedAt, sentAt, reason, holdUntil, requestKey,
  files: [{ root, path }],
  copiedFiles: [{ name }]
}
```

`GET /api/queue` renvoie `{items:[…]}` avec les mêmes objets. Les champs de dates sont des dates ISO ou `null` pour les dates facultatives. `message` garde la consigne originale. `files` et `copiedFiles` sont toujours des tableaux, vides sans pièce jointe ; les anciens éléments enregistrés sont adaptés à cette forme. Une clé de demande encore connue mais dont l'élément a quitté l'historique renvoie un résultat de déduplication avec `copiedFiles:[]` : aucun nouvel envoi.

**Entrée** : `{id, message, notBefore?, priority?, requestKey?, files?:[{root,path}]}`. Même jeton et même origine exacte que les autres écritures. Maximum deux fichiers, chacun de 20 × 1024 × 1024 octets. Une racine inconnue, un chemin absolu, une sortie `..`, un caractère de contrôle ou une liste mal formée donne HTTP 400. Aucun octet de fichier ni chemin absolu ne vient du navigateur.

La copie a lieu au départ effectif, après les contrôles de disponibilité et de quota, vers la racine actuelle de l'agent. Les racines autorisées sont relues à cet instant. `transfer` copie sans écrasement et ajoute un suffixe si nécessaire, par exemple `rapport (2).txt`. `copiedFiles` contient uniquement les noms effectivement copiés. Ils sont ajoutés à la consigne transmise, sous la mention « Fichiers copiés dans ton dossier de travail », comme des noms entre guillemets. Cela ne prouve aucune lecture du fichier par l'agent.

Avant toute copie, l'état `envoi_en_cours` est enregistré sur disque. Avant l'envoi, les noms copiés sont enregistrés, puis le quota, la disponibilité et l'identité de la cible sont revérifiés. Une copie impossible, un fichier trop grand, une cible modifiée ou un envoi non confirmé donne `state:'a_revoir'`, avec `reason` lisible. Aucun envoi ne suit une copie en échec et aucun nouvel essai automatique n'est fait. Les copies déjà réalisées restent sur disque et dans `copiedFiles` ; aucun fichier n'est supprimé pour annuler une copie partielle. Un redémarrage pendant la copie ou l'envoi restaure également « à revoir ».

## E6 : suivi d'un fichier confié

**Réponse exacte de `GET /api/traitement?id=<agent>` (HTTP 200)** :

```js
{
  dossiers: [{
    id,                  // clé publique opaque, stable pour la pièce jointe
    fichierConfie,       // nom seul, suffixe de copie compris
    cible,               // identifiant public de l'agent Herdr
    faits: [{ at, fait, source }]
  }]
}
```

`at` est une date ISO ; `source` vaut `file`, `disque`, `herdr` ou `journal`. Les faits sont triés de la date la plus ancienne à la plus récente. La route exige le jeton et la même preuve de provenance que les autres lectures protégées. Agent inconnu ou absent : HTTP 400. Aucun fichier joint dans l'historique conservé : `{dossiers:[]}`. Au plus 40 dossiers, correspondant aux deux pièces jointes des 20 éléments conservés dans la file. Aucun contenu de consigne, de réponse ou de fichier, aucun chemin ni identifiant de session ne sort.

Un dossier regroupe les faits disponibles : mise en file et envoi à Herdr (`file`), copie enregistrée (`file`), état actuel observé de l'agent (`herdr`), date de modification du fichier (`disque`). Une date de modification postérieure à l'envoi, sans être future au moment de la lecture, donne « Le fichier a changé pendant le traitement. ». Aucun auteur de cette modification n'est affirmé.

L'heure de copie et une empreinte du dossier de destination sont désormais conservées en interne dans la file et restaurées au redémarrage. L'empreinte ne sort pas dans les réponses publiques. Si le dossier de l'agent a changé, aucun fichier homonyme n'est inspecté. Pour les anciennes copies sans ces observations, le suivi indique « Copie constatée dans la file ; heure de copie non conservée. » à l'heure de consultation et ne fabrique aucun fait du disque. Un fichier disparu, un lien symbolique ou un journal indisponible laisse les autres faits consultables.

Une réponse terminée ou interrompue peut ajouter un fait `journal` si son début et sa fin ne précèdent pas l'envoi, et sa fin reste antérieure à l'envoi suivant à cet agent. Le texte précise toujours « lien avec ce fichier non établi ». Cette observation ne prouve ni lecture du fichier, ni réussite, ni traitement achevé. La route n'envoie rien et ne modifie aucun fichier.
