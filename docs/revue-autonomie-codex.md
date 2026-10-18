# Revue de sécurité : autonomie et reprise après pause

18 octobre 2026. Code observé sur la base `a09fddc`. Revue sans modification du code, sans installation et sans consigne réelle. Les preuves emploient des fichiers temporaires, une horloge contrôlée et des agents factices.

## Constats classés

1. **Élevée : les consignes d'autonomie survivent à l'arrêt du mode.**
   **Preuve :** `src/autonomie.mjs:60-65` efface l'état du mode, mais ne retire pas ses messages de la file ; `src/autonomie.mjs:97` et `server.mjs:138` les ajoutent comme des consignes ordinaires, sans identité de lancement ni expiration. `src/queue.mjs:440` bloque pendant la crise, puis `src/queue.mjs:486` permet leur départ après sa levée. Reproduction : chef occupé, ajout d'une consigne d'autonomie de durée cinq minutes, crise puis `verifier()`, levée de crise après six minutes et chef disponible. Résultat : autonomie inactive, mais **un envoi factice** de l'ancienne consigne. L'arrêt manuel et l'échéance ne disposent pas davantage de mécanisme d'invalidation des messages déjà acceptés.
   **Correctif proposé :** identifier chaque lancement et ses éléments de file, puis vérifier son autorisation et son expiration juste avant l'envoi. À l'arrêt, annuler ou mettre à revoir les éléments encore en attente de ce lancement uniquement. Au redémarrage, invalider ceux d'un mode clos. Ajouter le test « chef occupé, arrêt, chef disponible : aucun envoi », avec arrêt manuel, échéance et crise. Un envoi déjà commencé doit être signalé, sans prétendre pouvoir le rappeler.

2. **Moyenne : un arrêt concurrent à la mise en file provoque une erreur interne.**
   **Preuve :** `src/autonomie.mjs:87-98` ne passe pas par `exclusive`, contrairement à l'arrêt manuel (`src/autonomie.mjs:84`). Pendant l'attente de `enqueue`, l'arrêt peut mettre `etat` à `null` ; la ligne 98 tente ensuite `etat.echanges = numero`. Reproduction avec une promesse de file suspendue : lancer `passer`, arrêter, libérer la promesse. Résultat : **TypeError**, après acceptation possible de la consigne. Le journal et la sauvegarde du passage ne sont alors pas effectués.
   **Correctif proposé :** conserver une référence et une identité du lancement, vérifier qu'elles sont encore actives après chaque attente et invalider la consigne acceptée si l'arrêt a gagné la course. Coordonner les transitions sans attendre `relais.set()` sous un verrou que le relais attend lui-même. Ajouter un test déterministe avec promesse suspendue et arrêt concurrent.

## Contrôles satisfaisants sur le périmètre lu

- **Objectif et interdits :** `src/autonomie.mjs:71-73` exige du texte, retire les contrôles ASCII, normalise les espaces, borne à 300 points de code et valide durée/plafond. La ligne 96 transmet explicitement les interdits de push, suppression, installation, publication et réponse aux dialogues. Ce rappel est une consigne au chef, pas une restriction technique de ses propres outils.
- **Authentification :** GET et POST `/api/autonomie` passent par `guard` (`server.mjs:518-529`) : jeton exigé et contrôle de provenance ; le POST impose l'origine exacte et du JSON. Aucun contournement constaté dans ces routes.
- **Reprise et agents bloqués :** `server.mjs:96` exige idle/done et l'absence de crise avant l'ajout. La file exige aussi `ready === true` (`src/queue.mjs:418`) ; la passerelle résout de nouveau la cible avant l'appel Herdr (`src/herdr.mjs:137-139`). Essai de reprise : zéro ajout pour blocked, unknown, working ou crise ; un seul ajout une fois disponible, même après un second sondage. Aucun contournement constaté de ces gardes.

## Vérification et limites

Les trois scénarios isolés ci-dessus sont exécutés, ainsi que les **49 tests existants** de `autonomie`, `relais`, `queue-revue` et `herdr` : 49 réussis, aucun ignoré, aucun échec. Aucun test de production ni envoi à un agent réel. Les tests existants d'arrêt couvrent la production de nouveaux messages, mais pas l'expiration de messages déjà en attente. Les correctifs sont proposés seulement, pas appliqués.
