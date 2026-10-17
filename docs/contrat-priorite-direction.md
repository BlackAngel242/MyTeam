# Contrat : priorité des envois et direction de l'équipe

17 octobre 2026. Décisions de DrSmoke : la passation de direction est proposée par le bureau et confirmée par DrSmoke, jamais automatique. Serveur : OpenCode (`src/queue.mjs`, `server.mjs`, nouveau `src/direction.mjs`, tests). Interface : Claude (`public/`).

## Priorité des envois

- `POST /api/queue` accepte `priority`: `"haute"` ou `"normale"` (défaut `"normale"`). Toute autre valeur : 400.
- Chaque élément public porte `priority`.
- `POST /api/queue/priority {itemId, priority}` change la priorité d'une consigne encore `attente` (sinon 409). Jeton et origine exacte comme `/api/queue/cancel`.
- Ordre d'envoi, par agent : priorité haute d'abord, puis ancienneté (`createdAt`). Garde-fou : une consigne normale en attente depuis plus de 30 minutes passe au rang des hautes, à ancienneté égale. Le garde-fou est testé.
- La priorité ne force jamais un envoi vers un agent occupé, bloqué ou en pause : les règles d'envoi et de pause restent inchangées. Aucune protection contre le double envoi n'est modifiée.
- `GET /api/queue` renvoie les éléments dans l'ordre réel d'envoi prévu.

## Direction de l'équipe

- Chef par défaut : la règle actuelle `bossOf` (plus petit panneau).
- Choix de DrSmoke persisté hors Git dans `.bureau/direction.json` : `{agentId, since}` où `agentId` est l'identifiant complet `pane@empreinte`. Écriture atomique comme la file.
- `GET /api/state` : chaque agent porte `boss: true|false` (un seul vrai), et la réponse porte `direction: {source: "choix"|"regle", since}`. Si l'agent choisi a disparu ou changé d'empreinte, on revient à la règle et `source` vaut `"regle"`. Précision : `since` est l'heure du choix pour `"choix"`, et `null` pour `"regle"` (l'heure de démarrage du chef n'est pas connue). Un choix dont l'agent a disparu reste enregistré mais n'est plus appliqué.
- Les délégations sont lues dans le journal du chef effectif (choix ou règle), pas seulement de la règle.
- `POST /api/direction {agentId}` : l'agent doit exister dans la liste Herdr actuelle (sinon 404). `DELETE /api/direction` : retour à la règle. Jeton et origine exacte exigés pour les deux.
- Le serveur n'envoie aucun message aux agents lors d'un changement : la consigne de passation est écrite par DrSmoke dans l'interface et passe par la file ou l'envoi normal.
