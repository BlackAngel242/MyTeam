# MyTeam : plan d'orchestration fondé sur les patterns multi-agent

> Document de travail pour Claude (qui se charge du code).
> Il complète `proposition-orchestration.md` (6 améliorations + groupes + scénarios) et `revue-360-exhaustive.md` (tout le reste : architecture, sécurité, i18n, docs, tests, release).
> Ce document est le plus théorique des trois : il ancre les correctifs dans la littérature multi-agent, pour que l'implémentation ne soit pas un bricolage mais une application de patterns connus.

---

## 0. Positionnement

MyTeam est, structurellement, le **pattern « superviseur »** de la littérature multi-agent :

```
Objectif -> Chef (superviseur) -> [Agent, Agent, Agent] -> Synthèse -> Décision -> Re-délégation
```

Le pattern superviseur a trois modes de défaillance documentés : le **téléphone arabe**, le **goulot du superviseur**, et la **propagation d'erreur**. MyTeam les porte tous les trois. Ce document les nomme et donne, pour chacun, le correctif canonique adapté au code existant.

---

## 1. Correctif n°1 (priorité maximale) : le pass-through direct (anti-téléphone-arabe)

### Constat

LangGraph a mesuré que les architectures superviseur perdent **~50 % de performance** à cause du « telephone game » : le superviseur **reformule** la réponse du sous-agent, et la fidélité se dégrade à chaque passage.

Dans MyTeam, le flux est exactement celui-là :

1. L'agent A termine son travail.
2. `relais.mjs:89` envoie au chef : « X vient de terminer. Lis son panneau avant de lui confier la suite. » (la consigne complète « …vérifie le résultat, puis décide seul de la suite et délègue-la » est dans `autonomie.mjs:102`, le mode autonomie).
3. Le chef **lit le panneau** de A (un résumé), puis **réécrit** une nouvelle consigne pour B.

La sortie de A traverse **deux fois** le contexte du chef : une lecture, puis une reformulation.

### Nuance honnête (à ne pas perdre de vue)

Le **produit du travail** (les fichiers) est déjà partagé : les agents travaillent sur le même système de fichiers. Donc MyTeam atténue déjà le téléphone arabe au niveau du code produit. Ce qui se dégrade, c'est le **contexte de coordination** : « pourquoi on fait ça », « ce qui a été décidé », « quelle est la suite ». C'est ce contexte-là qui est reformulé et qui s'appauvrit à chaque passage.

### Solution

Le correctif canonique est le `forward_message` : laisser la sortie de A **passer telle quelle** à B, sans reformulation du chef. Le chef ne synthétise que ce qui est strictement nécessaire (la décision de « qui fait quoi ensuite »), jamais le contenu produit par A.

### Implémentation concrète (pour Claude)

- Dans la consigne d'autonomie (autonomie.mjs), remplacer « Lis son panneau, vérifie le résultat » par une instruction qui pointe vers la **sortie brute** de A et interdit de la reformuler.
- Ajouter un mécanisme de transmission : quand le chef délègue à B, le contenu produit par A (ou un lien direct vers le fichier de sortie) est **joint à la consigne de B à l'identique**.
- Le chef garde uniquement le rôle d'**aiguilleur** (routage + décision d'arrêt), pas de **traducteur**.

### Critère de succès

La consigne reçue par B contient la sortie de A **à l'identique** (ou un lien direct, non reformulé). Le chef ne réécrit plus le contenu produit par les agents.

---

## 2. Correctif n°2 : checkpointing du chef (anti-goulot du superviseur)

### Constat

Le chef accumule dans son contexte : l'objectif, l'historique des délégations, le tableau noir (`blackboard.mjs`), les avis du relais. C'est le goulot du superviseur : le contexte du chef se sature et se dégrade.

### Solution

Le tableau noir actuel est une atténuation partielle, pas un vrai checkpointing. Il faut **persister la trajectoire du chef** hors de son contexte :

- Un fichier `docs/plan-travail.md` (déjà proposé dans `proposition-orchestration.md`) tient l'état : objectif, étape courante, décisions prises, prochaines actions.
- À chaque délégation, le chef **écrit** dans ce fichier au lieu de tout garder en mémoire.
- Le fichier devient la source de vérité ; le contexte du chef ne porte que ce qui est en cours.

### Critère de succès

Le chef peut reprendre une session interrompue en relisant `plan-travail.md`, sans avoir à re-parcourir tout l'historique. Son contexte ne croît plus linéairement avec le nombre d'échanges.

---

## 3. Correctif n°3 : quality gate (anti-propagation d'erreur)

### Constat

`delegations.mjs` capture le **type** de résultat (`agent_prompted` = ok, `agent_prompt_stalled` = état inconnu, `error` = erreur). Mais pas sa **conformité**. (Note : `scripts/evaluer.mjs` existe, mais c'est une auto-évaluation de projet — piliers présents, git, cases de TODO, `npm check`/`test` — pas un contrôleur de sortie de délégation.) Aucun contrôle de conformité n'existe dans le flux de délégation.

### Solution

Valider la sortie **avant** de la passer au consommateur :

- Ajouter un contrôle de **conformité** : la sortie de A répond-elle au critère demandé ? (exemple : le TODO est bien coché, le fichier produit existe ET correspond à la demande, pas seulement « existe »).
- Si non conforme, **renvoyer à A** (une boucle de correction), pas transmettre tel quel à B.
- C'est le pendant qualité du `forward_message` : on transmet tel quel, mais seulement **après** avoir validé.

### Critère de succès

Une délégation n'est transmise que si sa sortie est **validée conforme**. Une sortie non conforme déclenche une reprise par le même agent, pas une propagation.

---

## 4. Correctif n°4 : consensus pour les groupes (anti-sycophancie)

### Constat

La proposition « groupes » fait travailler plusieurs agents en parallèle et agrège leurs avis. Le piège documenté : le **vote majoritaire simple** met une hallucination d'un modèle faible au même niveau que le raisonnement d'un modèle fort. Sans intervention, les discussions multi-agents convergent vers des prémisses fausses, par biais d'accord.

### Solution

- **Vote pondéré** : pondérer chaque avis par la confiance ou l'expertise de l'agent.
- **Protocole de débat** : les agents critiquent mutuellement leurs sorties sur plusieurs tours (la critique contradictoire donne de meilleurs résultats que le consensus collaboratif).
- **Déclencheurs d'intervention** : détecter la **stagnation** (la discussion ne progresse plus) et la **sycophancie** (les agents se recopient sans raisonnement propre).

### Critère de succès

Quand un groupe rend un avis, le chef reçoit non pas une moyenne brute, mais un avis **pondéré** et, si divergence, un **débat** court avant la décision.

---

## 5. Correctif n°5 : garder les TTL, privilégier le modèle du chef

### Constat

La littérature donne deux chiffres à retenir :
- Multi-agent ≈ **15× le coût en jetons** d'un agent seul.
- « Monter de modèle » rapporte souvent **plus** que doubler le budget de jetons.

### Conséquence (à ne pas casser)

- Les plafonds NoBabysitter (`LIMITES` : 5–120 min, 3–60 échanges) sont **le bon réflexe** : ce sont des *time-to-live* anti-divergence. Les garder.
- Le motif d'arrêt « boucle détectée » est un contrôle de convergence : le garder.
- Pour améliorer la qualité, **privilégier un meilleur modèle de chef** plutôt que plus d'échanges ou plus d'agents.

### Critère de succès

Aucune modification ne supprime les plafonds ni le détecteur de boucle. Toute augmentation de capacité se fait par le modèle, pas par le nombre d'échanges.

---

## 6. Ordre d'implémentation

| Ordre | Correctif | Effort | Impact | Dépend de |
|---|---|---|---|---|
| 1 | Pass-through direct (n°1) | Local | Maximal | rien |
| 2 | Quality gate (n°3) | Moyen | Fort | n°1 |
| 3 | Checkpointing (n°2) | Moyen | Fort | rien |
| 4 | Consensus groupes (n°4) | Important | Moyen | la feature « groupes » |
| 5 | Modèle du chef (n°5) | Configuration | Variable | rien |

**Logique.** Le n°1 est un changement local (dans la façon dont le chef transmet), à faire en premier. Le n°3 dépend du n°1 (on valide puis on transmet). Le n°2 est indépendant et peut démarrer en parallèle. Le n°4 n'a de sens que si la feature « groupes » est retenue. Le n°5 est un réglage, pas du code.

---

## 7. Critères de sortie globaux

1. Le chef ne reformule plus la sortie des agents (n°1) : vérifiable par un test qui compare la sortie de A et ce que B reçoit.
2. Une sortie non conforme est renvoyée à l'agent, pas propagée (n°3) : vérifiable par un test d'échec volontaire.
3. Le chef reprend une session interrompue depuis `plan-travail.md` (n°2) : vérifiable par un test de reprise.
4. Les plafonds NoBabysitter et le détecteur de boucle sont intacts (n°5) : vérifiable par les tests existants.

---

## 8. Questions à trancher par DrSmoke

1. **n°1** : la sortie de A doit-elle être transmise **à l'identique** dans la consigne de B, ou suffit-il d'un **lien direct** vers le fichier de sortie (moins de jetons, un peu moins de contexte) ?
2. **n°3** : qui définit le critère de conformité ? Le chef à chaque délégation, ou une liste de vérifications par type de tâche (code, doc, test) ?
3. **n°4** : les « groupes » sont-ils confirmés comme feature, ou le consensus reste-t-il un chantier futur ?

---

*Document rédigé après lecture du dépôt MyTeam et application des patterns multi-agent (`multi-agent-patterns`) et du cadre de décision d'architecture (`architecture`).*
