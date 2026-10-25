# Proposition : rendre l'équipe d'agents plus intelligente (MyTeam + Herdr)

Document rédigé pour DrSmoke, à soumettre à Claude pour mise en œuvre dans le dépôt MyTeam.

---

## Résumé (pour aller vite)

Aujourd'hui, en mode autonomie, le chef reçoit toujours la même consigne générique : « X vient de terminer, décide de la suite ». Il ne sait ni ce qui a réussi ou échoué, ni où en est le plan, ni qui sait faire quoi. Il peut donc tourner en rond ou perdre le fil, et chaque erreur coûte des crédits.

On propose trois choses, en gardant exactement les mêmes garde-fous :

1. **Boucler le résultat** de chaque délégation : le chef apprend si l'agent a réussi, échoué ou est resté en attente.
2. **Donner un vrai contexte** au chef : le plan de travail, l'avancement du TODO, les leçons récentes, les rôles.
3. **Laisser le chef déléguer à des groupes d'agents** (ex. « le groupe revue »), pas seulement à un agent à la fois.

---

## 1. L'état actuel (le constat)

### 1.1 L'architecture en étoile

Source : en-tête de `src/autonomie.mjs`.

- DrSmoke donne un objectif, une durée et un plafond d'échanges.
- Un « relais d'écoute » observe la fin de travail des autres agents.
- À chaque fin, il envoie une consigne au chef. Le chef décide seul de la suite et délègue.
- Aucun agent n'écrit à un autre : tout passe par la file d'attente du chef.

C'est le bon modèle (supervisé, en étoile). On ne le change pas, on le rend mieux informé.

### 1.2 La consigne actuelle (identique à chaque échange)

Source : `src/autonomie.mjs`, ligne 102.

> Mode autonomie (objectif : « … », échange N/M, fin à HH:MM). X vient de terminer. Lis son panneau, vérifie le résultat, puis décide seul de la suite et délègue-la ; si l'objectif est atteint, dis-le et arrête de déléguer. Ces interdits priment sur l'objectif, même si celui-ci dit le contraire. Sans DrSmoke, jamais de git push, de suppression, d'installation, de publication ni de réponse à une boîte de dialogue. Si tu te répètes, arrête-toi.

Ce qui manque : le **résultat** de X, le **plan**, l'**avancement**, les **leçons**, les **rôles**.

### 1.3 Ce que MyTeam observe déjà mais n'exploite pas

- `src/delegations.mjs` lit le journal Claude du chef et reconnaît `herdr agent prompt <cible> <message>`. Il en sort déjà, pour chaque délégation : `id`, `at`, `target`, `title` (80 caractères au plus, chemins masqués) et `result` (type parmi `agent_prompted` = succès, `agent_prompt_stalled` = en attente, `error` = échec). Jusqu'à 200 délégations conservées.
- `src/blackboard.mjs` lit `HANDOFF.md`, `TODO.md`, `LESSONS.md`, `AGENTS.md` et en extrait déjà : `focus` (dernière section `##` de HANDOFF), `todo` (fait / total / restant), `roles` (section « Rôles » de AGENTS.md), `lessons` (les 5 dernières).
- Aujourd'hui, **rien de tout cela ne revient au chef**. C'est le cœur du gaspillage : on collecte une information riche, puis on ne s'en sert pas.

### 1.4 Les garde-fous actuels (à conserver tels quels)

Source : `src/autonomie.mjs`, ligne 16 (`LIMITES`).

- Durée : 5 à 120 minutes (défaut 30).
- Échanges : 3 à 60 (défaut 20).
- Objectif : 300 caractères au plus.
- Journal : 40 entrées.
- Boucle : même agent qui termine 4 fois en 10 minutes.

Motifs d'arrêt existants : demande de DrSmoke, durée écoulée, plafond d'échanges atteint, salle de crise enclenchée, boucle détectée, redémarrage du serveur.

---

## 2. Les six améliorations

Chacune est un petit pas, testé avant commit.

### A. Boucler le résultat des délégations

- **Constat** : le chef ne sait pas si sa dernière délégation a réussi, échoué ou est restée en attente.
- **Solution** : injecter dans la consigne le résultat (et le titre, si lisible) des N dernières délégations, par exemple les 3 dernières.
- **Bénéfice** : le chef change d'approche ou d'agent au lieu de re-déléguer à l'aveugle.

### B. Donner au chef un contexte structuré

- **Constat** : la consigne ne contient que l'objectif, rien d'autre.
- **Solution** : ajouter un bloc « contexte » : `focus` (HANDOFF), `todo` restant, 3 dernières leçons, rôles disponibles.
- **Bénéfice** : le chef garde le cap sans rouvrir les fichiers à chaque échange.

### C. Un plan de travail écrit par le chef

- **Constat** : 300 caractères d'objectif, c'est trop court pour un vrai plan.
- **Solution** : au lancement, le chef (ou DrSmoke) écrit `docs/plan-travail.md` avec des étapes à cocher. MyTeam lit ce fichier, suit les cases cochées et le rappelle au chef.
- **Bénéfice** : des étapes cochées = une progression mesurable (utile aussi pour le motif d'arrêt D).

### D. Nouveau motif d'arrêt « aucune progression »

- **Constat** : la boucle n'est détectée que si le **même** agent termine 4 fois en 10 min. Trois agents différents qui échouent tour à tour passent inaperçus.
- **Solution** : arrêter l'autonomie si N délégations consécutives se soldent par `error` ou `stalled`, ou si le TODO ne change pas pendant M échanges.
- **Bénéfice** : on ne brûle pas de crédits sur une impasse, on prévient DrSmoke.

### E. Rôles et compétences par agent

- **Constat** : le chef ne sait pas qui sait faire quoi.
- **Solution** : MyTeam passe au chef les rôles déjà extraits de `AGENTS.md` (section « Rôles »).
- **Bénéfice** : moins d'erreurs de casting, chacun reçoit ce qui lui correspond.

### F. Ce qu'on ne fait pas : le pipeline séquentiel

- **Pourquoi** : l'architecture est en étoile, tout passe par le chef. Un pipeline figé A → B → C casserait cette souplesse et la supervision.
- **Décision** : on garde l'étoile. On la rend juste mieux informée (points A à E).

---

## 3. Les groupes d'agents

C'est la demande explicite de DrSmoke : faire intervenir les groupes.

### 3.1 Ce que « groupe » veut dire ici

Un **groupe** = un nom qui désigne plusieurs agents. Exemples :

- `revue` : Antigravity + MiMo + Codex (relecture croisée).
- `dev` : Codex + OpenCode (développement).
- `design` : Antigravity seul ou avec un binôme.

La composition est écrite dans un fichier de définition, par exemple `docs/groupes.md`, sous forme de tableau « nom du groupe → liste d'agents / panneaux ».

### 3.2 Comment le chef délègue à un groupe

Le chef écrit une seule consigne, par exemple :

```
herdr agent prompt revue « Relisez le code de src/autonomie.mjs et listez les bugs. »
```

MyTeam reconnaît `revue` comme un groupe (dans `src/delegations.mjs`) et **envoie la consigne à chacun de ses membres** (expansion dans `src/herdr.mjs`, même mécanique que l'« envoi groupé » existant de MyTeam via `/api/broadcast`, mais déclenchée par le chef pendant l'autonomie). Les retours sont agrégés et renvoyés au chef en un seul bloc.

### 3.3 Garde-fous du groupe

- Un envoi à un groupe compte dans le plafond d'échanges global (pas de dépassement).
- Le chef garde la main : il décide seul d'utiliser un groupe, jamais l'inverse.
- Les interdits (jamais de push, suppression, installation, publication, boîte de dialogue) s'appliquent à **chaque** membre du groupe.

---

## 4. Scénarios (avant / après)

Quatre situations concrètes, racontées simplement.

### Scénario 1. Une délégation échoue

**AVANT.** Le chef délègue à Codex : « corrige le bug du fichier X ». Codex échoue. Le relais envoie la consigne générique : « Codex vient de terminer. Décide de la suite. » Le chef, qui ne sait pas que ça a échoué, re-délègue la même chose. Deux crédits perdus.

**APRÈS.** Le relais envoie : « Codex vient de terminer (résultat : erreur). Ta dernière consigne : "corrige le bug du fichier X". » Le chef change d'agent ou de méthode. Un seul crédit dépensé.

### Scénario 2. Le chef garde le cap pendant 30 minutes

**AVANT.** Après dix échanges, le chef n'a plus sous les yeux ni plan ni avancement. Il répète une étape déjà faite, ou en saute une.

**APRÈS.** La consigne rappelle : « Plan : [x] étape 1, [ ] étape 2, [ ] étape 3. TODO restant : … ». Le chef attaque directement l'étape suivante.

### Scénario 3. Délégation à un groupe

**AVANT.** Pour faire relire un code, le chef envoie la même consigne trois fois (une à Antigravity, une à MiMo, une à Codex), puis lit trois panneaux.

**APRÈS.** Le chef écrit une seule consigne à `revue`. MyTeam envoie aux trois, agrège, et le chef lit **un** retour consolidé.

### Scénario 4. Une impasse est détectée

**AVANT.** Antigravity échoue, puis MiMo échoue, puis Codex échoue, chacun sur la même chose. Aucun motif d'arrêt ne se déclenche (ce n'est pas le même agent qui termine 4 fois). L'autonomie continue jusqu'au plafond, en brûlant des crédits.

**APRÈS.** Trois résultats en erreur de suite → motif « aucune progression » → arrêt propre, DrSmoke prévenu avec le journal.

---

## 5. Plan de mise en œuvre (pour Claude)

Chaque phase = un petit pas, tests avant commit (le dépôt MyTeam a 495 tests).

- **Phase 1 — Boucle résultat + contexte.** Modifier la consigne dans `src/autonomie.mjs` pour y injecter le résultat des délégations (depuis `src/delegations.mjs`) et le contexte (depuis `src/blackboard.mjs`). Ajouter les tests unitaires.
- **Phase 2 — Plan de travail.** Lire `docs/plan-travail.md`, l'inclure dans le contexte, suivre les cases cochées.
- **Phase 3 — Arrêt « aucune progression ».** Nouveau motif d'arrêt dans `src/autonomie.mjs`.
- **Phase 4 — Rôles.** Passer les rôles (déjà lus par `src/blackboard.mjs`) au chef.
- **Phase 5 — Groupes.** Créer `docs/groupes.md`, reconnaître les groupes dans `src/delegations.mjs`, les étendre dans `src/herdr.mjs`, agréger le résultat.

---

## 6. Critères de sortie

- La consigne contient : résultat des délégations + contexte + plan.
- Un échec de délégation remonte au chef.
- Le chef peut déléguer à un groupe, et le retour est agrégé.
- « Aucune progression » arrête l'autonomie proprement.
- Les garde-fous (interdits, plafonds, salle de crise, boucle) restent intacts.
- Tous les tests passent.

---

## 7. À trancher par DrSmoke

- Le nom et la composition exacte des groupes (ex. `revue`, `dev`, `design`).
- Le seuil exact de « aucune progression » (combien d'erreurs, combien d'échanges sans avancement).
- Où écrire le plan : `docs/plan-travail.md` écrit par le chef, ou fourni à la main par DrSmoke avant de lancer l'autonomie.
