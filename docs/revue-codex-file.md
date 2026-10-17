# Revue croisée de la file d'attente

17 octobre 2026. Lecture de `LESSONS.md`, de la propriété dans `AGENTS.md`, de `src/queue.mjs`, du raccordement serveur, de `src/herdr.mjs` et des tests existants. Sources d'OpenCode inchangées. Les essais utilisent uniquement des dossiers temporaires et des fonctions simulant les agents ; aucun envoi Herdr, aucun serveur lancé, aucune minuterie démarrée.

## 1. Grave : un redémarrage peut renvoyer une consigne déjà reçue

**Lignes :** `src/queue.mjs:62-69`, `78-80`, `161-177`.

**Scénario :** Herdr reçoit la consigne, mais le processus s'arrête avant le retour de `prompt` ou avant la sauvegarde finale. Le fichier contient encore `attente`. Une nouvelle instance relit cet état et envoie à nouveau si la cible est disponible. Le verrou `tour` protège une instance en mémoire, pas une reprise. De plus, les erreurs de sauvegarde sont avalées : même une consigne affichée comme envoyée peut rester en attente sur disque. Le test ouvre une seconde instance avec le fichier disponible pendant le premier appel et constate deux appels simulés.

**Correctif :** avant tout appel externe, passer l'élément dans un état durable « envoi en cours » avec un identifiant de tentative ; attendre une sauvegarde atomique réussie, sinon ne rien envoyer. Au démarrage, tout état « envoi en cours » devient « à revoir », sans renvoi automatique. Écrire dans un fichier temporaire puis le remplacer ; signaler les erreurs de persistance. Si plusieurs processus peuvent partager le fichier, prévoir aussi un verrou exclusif. Cela garantit l'absence de renvoi automatique après doute, sans prétendre garantir la réception par Herdr.

## 2. Grave : le raccordement désactive de fait le contrôle des quotas

**Lignes :** `server.mjs:23-31`, `33` ; `src/queue.mjs:125`, `129-133`.

**Scénario :** `tick` transmet une `Map` à `limitsOf`, mais `limiteQuota` appelle `agents.find`, prévu pour un tableau. La fonction asynchrone rejette sa promesse ; `pauseDe` transforme cette erreur en `limitReached:false`. Le journal n'est jamais lu et la consigne part malgré un quota simulé à 100 %. Le test d'intégration reproduit le passage sans quota ; il ne s'agit pas seulement d'une erreur qui gèlerait la file.

**Correctif :** choisir un contrat unique : transmettre le tableau original aux lecteurs d'activité, utiliser une `Map` séparée pour les recherches de la file. Toute erreur de contrôle doit geler l'envoi ou le placer « à revoir », avec une raison claire. Conserver un test au niveau `createBureauServer`, car les tests unitaires du module ne détectent pas cette incompatibilité.

## 3. Grave : une panne de lecture autorise l'envoi

**Lignes :** `src/queue.mjs:129-133` ; `server.mjs:31`.

**Scénario :** même après correction du format précédent, un lecteur de quota qui rejette sa promesse est assimilé à une absence de limite. Le test unitaire obtient un appel simulé alors que le contrôle est indisponible. Le même repli existe côté serveur.

**Correctif :** distinguer « outil sans donnée de quota disponible » et « contrôle en panne ». Une panne ne doit jamais annuler une pause déjà observée. Exposer une raison d'attente compréhensible et ne reprendre qu'après un contrôle valable. Traiter aussi les exceptions synchrones du lecteur de la même manière.

## 4. Grave : les cinq minutes supplémentaires disparaissent au renouvellement du quota

**Lignes :** `src/queue.mjs:126`, `153-159` ; `server.mjs:28-30`.

**Scénario :** à midi le quota atteint sa limite, remise à zéro annoncée à 13 h. À 13 h 01, le journal indique une limite disponible. Le code ne vérifie plus la date, car la condition dépend du seul `limitReached` actuel : la consigne part avant 13 h 05. Le test reproduit cet envoi anticipé.

**Correctif :** mémoriser et persister, par cible, la fin de pause observée, égale à la remise à zéro plus cinq minutes. La conserver après changement de pourcentage et après redémarrage. Si plusieurs limites sont atteintes, retenir la fin de pause la plus tardive ; sélectionner seulement le plus grand pourcentage ne suffit pas. Continuer à appliquer indépendamment `notBefore`, et choisir la plus tardive des échéances applicables.

## 5. Grave : une réponse perdue peut produire un second ajout et un second envoi

**Lignes :** `src/queue.mjs:86-104` ; `server.mjs:215-220`.

**Scénario :** le serveur accepte l'ajout mais sa réponse ne parvient pas à l'onglet. Le planificateur envoie entre-temps. L'onglet réessaie le même ajout ; la détection de doublon ne regarde que les éléments encore `attente`, donc une nouvelle consigne identique est acceptée et envoyée. Deux onglets présentant la même tentative peuvent rencontrer ce cas. Le test simule ces appels au même point d'entrée de la file, sans requête réseau réelle.

**Correctif :** ajouter une clé de demande créée une seule fois pour l'action de l'utilisateur, réutilisée à chaque tentative et sauvegardée avec l'élément. Une répétition de cette clé doit retrouver le résultat existant, même après envoi ou redémarrage. Une nouvelle action volontaire reçoit une nouvelle clé : ne pas interdire à jamais deux textes identiques. Définir une durée de conservation des clés compatible avec les reprises, distincte des vingt éléments affichés.

## 6. Grave : une annulation est acceptée alors que l'envoi a commencé

**Lignes :** `src/queue.mjs:107-114`, `161-165`.

**Scénario :** pendant l'attente de `prompt`, l'élément reste `attente`. `cancel` répond donc « annulée » et l'écrit sur disque alors que la consigne peut déjà avoir été reçue. Le retour de `prompt` la transforme ensuite en « envoyée ». Le test bloque volontairement ce retour, puis constate que l'annulation est acceptée à tort.

**Correctif :** utiliser l'état « envoi en cours » avant l'appel externe ; refuser l'annulation dès ce point. Après chaque attente asynchrone et immédiatement avant la prise en charge, vérifier que l'élément appartient toujours à la file et reste `attente`. L'interface doit annoncer honnêtement qu'un envoi commencé ne peut plus être retiré.

## 7. Grave pour les échéances, moyen pour la mémoire : le fichier restauré est trop peu validé

**Lignes :** `src/queue.mjs:35-38`, `78-80`, `118`, `153-159`.

**Scénario :** un JSON syntaxiquement cassé est bien ignoré. Mais un JSON valide contenant `notBefore:"date-corrompue"` est accepté ; `Date.parse` donne `NaN`, la comparaison échoue et la consigne part immédiatement. Le test reproduit ce départ. Un `createdAt` manquant peut aussi casser le tri ; un message énorme ou des champs supplémentaires passent le filtre. `readFileSync` et `JSON.parse` chargent tout le fichier avant le plafond de vingt éléments : le nombre final d'éléments ne borne donc pas la mémoire consommée au chargement.

**Correctif :** limiter la taille du fichier avant lecture ; valider chaque champ avec les mêmes règles qu'à l'ajout, les dates, la longueur des identifiants, les doublons et les plafonds par cible. Restaurer uniquement une liste blanche de champs. Une échéance illisible ou une structure douteuse doit produire une alerte et un état sans envoi, jamais une date immédiate. Préserver le fichier corrompu pour diagnostic plutôt que l'écraser silencieusement lors du prochain ajout.

## Protections présentes et limites de la revue

- Deux `tick` simultanés de la même instance partagent le tour en cours : contrôle reproduit avec un seul appel.
- Les états `working`, `blocked`, `unknown`, `ready:false` et une empreinte de cible remplacée empêchent le départ dans les contrôles existants. `src/herdr.mjs:78-81` et `92-101` refait la recherche et vérifie la disponibilité avant d'invoquer Herdr, avec un verrou commun aux envois directs. Il reste forcément un intervalle entre cette observation et la commande externe ; aucune atomicité côté Herdr n'a été démontrée ici.
- `server.mjs:80-84` et `211-217` impose bien origine exacte et jeton aux trois opérations de file. Aucun contournement relevé dans ce raccordement ; les tests serveur existants vérifient les refus sans jeton. Aucun appel à la machine réelle n'a servi à le vérifier.
- L'ajout normal est borné à vingt éléments et cinq attentes par agent ; messages limités à 12 000 caractères, corps HTTP limité. La croissance restante concerne surtout le chargement d'un fichier modifié et la longueur non bornée des identifiants au niveau du module.
- `notBefore` valide et quota continuellement signalé comme atteint respectent leurs échéances dans les tests existants. Les sauts de l'horloge système modifient les échéances absolues ; aucun contrôle de dérive n'est présent. La durée de validité de trente minutes évoquée dans le plan de conception n'est pas appliquée : sa confirmation produit reste à clarifier avant d'en faire une exigence, notamment pour les consignes volontairement programmées plus tard.

## Vérification

`node --test --test-isolation=none test/queue-revue.test.mjs test/queue.test.mjs` : 21 tests, 14 réussis et 7 échecs reproduisant les défauts ci-dessus. Les 12 tests existants de la file passent. Les nouveaux tests expriment la protection attendue et restent volontairement en échec jusqu'aux corrections d'OpenCode ; aucun test désactivé. `npm run check` réussi. Le mode sans isolation évite les refus de création de processus de cet environnement.

La suite complète `npm test -- --test-isolation=none` a également été lancée : résultat non réussi, code 1, avec les reproductions en échec. `node --check test/queue-revue.test.mjs` réussi. Le contrôle final ne montre aucune modification de `server.mjs` ni de `src/queue.mjs` ; d'autres agents modifient l'interface en parallèle.
