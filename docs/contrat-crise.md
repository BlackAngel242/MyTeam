# Contrat de la salle de crise (G1)

Côté serveur de la salle de crise. Le chef branche l'interface sur ce contrat exact. Tout est en lecture ou écriture locale, sur `127.0.0.1`, protégé comme les autres routes (jeton `X-Bureau-Token`, origine exacte).

## État

- `{active, since, reason}` persisté de façon atomique dans `.bureau/crise.json` (hors Git, comme la file d'attente).
- `since` : heure ISO de l'activation en cours, `null` quand la crise est levée.
- `reason` : `null` en temps normal ; renseignée quand l'état a été jugé illisible. Fichier absent : jamais déclenchée. Fichier corrompu ou illisible : crise ACTIVE avec la raison « État de la salle de crise illisible : crise active par sécurité. » (en cas de doute, rien ne part).

## `GET /api/crise`

- Garde : jeton et provenance (comme `/api/todos`, pas de corps).
- Réponse 200 : `{active, since, reason}`.

## `POST /api/crise`

- Garde : jeton et origine exacte (comme les autres écritures).
- Corps : `{"active": true}` pour déclencher, `{"active": false}` pour lever.
- Réponse 200 : `{active, since, reason}` après le changement (appeler deux fois avec la même valeur ne change rien et ne réécrit pas `since`).
- 400 si le corps n'est pas de la forme demandée (y compris JSON illisible) : `{error}`.
- 403 sans jeton ou sans origine exacte.

## `POST /api/crise/arret`

- Garde : jeton et origine exacte.
- Corps : `{"id": "<identifiant d'agent>"}` (identifiant courant, empreinte comprise).
- Seulement si la crise est active, sinon 409 : `{error: "La salle de crise n'est pas active."}`.
- 400 si `id` manque ou si l'agent est introuvable : `{error}`.
- Demande une interruption polie : `herdr pane send-keys <paneId> Escape` (aucun shell, aucun kill). L'agent est invité à s'arrêter proprement ; rien n'est confirmé d'autre qu'une demande envoyée.
- Réponse 200 : `{requested: true, agent: "<nom de l'agent>"}` (jamais de chemin).

## Effets de la crise active

- `POST /api/prompt` et `POST /api/broadcast` répondent 423 : `{error: "Salle de crise active : les envois sont verrouillés. Levez la crise pour reprendre."}`.
- La file d'attente continue d'accepter et de persister les consignes, mais `tick()` n'envoie rien tant que la crise est active (vérifié juste avant chaque envoi) ; les consignes restent en attente et partent après la levée.
- La passation de direction passe par la file : elle est donc suspendue aussi, sans route supplémentaire.
- L'arrêt poli (`/api/crise/arret`) reste possible, c'est son but.

## Résumé des codes

| Route | 200 | 400 | 403 | 409 | 423 |
|---|---|---|---|---|---|
| `GET /api/crise` | état | non | sans jeton ou provenance | non | non |
| `POST /api/crise` | état après changement | corps mal formé | sans jeton ou origine | non | non |
| `POST /api/crise/arret` | `{requested, agent}` | id absent ou agent inconnu | sans jeton ou origine | crise non active | non |
| `POST /api/prompt`, `POST /api/broadcast` | envoi normal | saisie invalide | sans jeton ou origine | non | crise active |
