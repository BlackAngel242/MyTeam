# Revue Codex des délégations

Revue en lecture seule du 17 octobre 2026. Seul ce rapport est créé ; aucun code, test ou journal réel n’est modifié. Aucun appel à Herdr, aucun serveur lancé.

Version examinée : `src/delegations.mjs`, empreinte SHA-256 `e3413f6955a42a2a74e099b2a5c616a522e59364880207a9ae4303dedda248ff`. Les lignes ci-dessous se rapportent à cette version.

## 1. Gravité élevée : des consignes complètes et des chemins peuvent sortir du module

**Lignes :** `139` et `140`, `157` et `161`, puis `179` à `182` et `233`.

`title` reprend directement la consigne, simplement limitée à 80 caractères. Si la consigne est courte, elle ressort donc entièrement. Un chemin placé dans cette consigne reste également visible. `target` n’est ni limité ni validé contre les agents connus ; `result.type` accepte aussi toute chaîne du JSON, limitée à 40 caractères. Cette limite conserve entièrement un chemin court. Les plafonds de longueur ne constituent pas une protection de confidentialité.

**Vérification :** les fonctions réelles, exécutées en mémoire sur des données factices, renvoient intégralement une consigne courte et conservent un chemin absolu dans le titre comme dans le type du résultat. Aucun vrai secret n’a été utilisé.

**Correctif :** pour respecter strictement « aucune consigne complète », ne pas dériver le titre de son texte ; utiliser un intitulé distinct explicitement publié, sinon `null`. Accepter seulement une cible correspondant à un agent connu et une liste fermée de types de résultat. Borner et valider aussi `id` et `at`, puis construire la réponse uniquement avec les champs autorisés. Masquer les chemins et identifiants privés dans tout intitulé autorisé.

## 2. Gravité élevée : des exemples et l’aide sont comptés comme des délégations

**Lignes :** `125` à `140`, particulièrement `127` à `130` et `136`.

Le détecteur cherche le mot `herdr` n’importe où, puis cherche `agent prompt` plus loin sans respecter la frontière d’une commande. Il ne vérifie pas non plus qu’une consigne existe ni qu’il s’agit d’une demande d’aide.

**Vérification :** trois commandes factices sont reconnues à tort : `echo herdr agent prompt w5:p2 "Simulation"`, `herdr agent list; echo agent prompt w5:p2 "Simulation"` et `herdr agent prompt --help`. Elles ne prouvent aucun envoi. La chaîne de commande n’a jamais été exécutée.

**Correctif :** reconnaître l’exécutable uniquement en position de commande, traiter séparément les segments du shell et lire la syntaxe attendue cible/texte/options. Exclure l’aide, les commentaires et les exemples imprimés. Pour une construction shell non prise en charge, s’abstenir plutôt que déduire une relation. Une tentative reconnue reste distincte d’un envoi confirmé.

## 3. Gravité moyenne : le saut d’une ligne géante est perdu entre deux lectures

**Lignes :** `203` à `225`, particulièrement `205` et `225` ; état initial à `229`.

`skipping` est une variable locale remise à `false` à chaque appel. Elle n’est pas conservée dans l’état. Si une ligne dépasse 4 Mo et se poursuit lors du sondage suivant, son suffixe peut être interprété comme une nouvelle ligne JSON indépendante. Cela vaut aussi pour une coupure au plafond de 50 Mo.

**Vérification :** un premier flux factice de plus de 4 Mo, sans retour à la ligne, est ignoré. Le flux suivant contient un objet JSON de délégation puis un retour à la ligne, toujours dans la même ligne géante. Le générateur réel l’émet pourtant comme une nouvelle entrée valide.

**Correctif :** conserver `state.skipping` au même titre que `state.partial` et `state.offset`. Reprendre en ignorant les octets jusqu’au prochain retour à la ligne, puis seulement autoriser de nouvelles entrées. Tester une ligne géante répartie sur deux appels et sur la frontière des 50 Mo.

## 4. Gravité moyenne : l’absence d’erreur explicite est confondue avec un succès

**Lignes :** `147` à `161`, particulièrement `149`.

`ok` vaut vrai dès que `is_error` n’est pas vrai et que le texte ne commence pas exactement par un objet dont le premier champ est `error`. Un objet JSON dont `error` est le deuxième champ est donc marqué réussi. Un simple texte non interprétable est également présenté avec `ok:true`. Le marqueur `agent_prompt_stalled` ne prouve, lui, ni un échec définitif ni une transmission confirmée.

**Vérification :** un résultat JSON factice avec un premier champ neutre, puis un champ `error`, donne `{ok:true,type:null}` avec la fonction réelle.

**Correctif :** analyser le JSON et son champ `error` indépendamment de l’ordre des propriétés. Réserver le succès à une confirmation positive reconnue, par exemple `agent_prompted`. Prévoir une issue inconnue (`ok:null` ou `result:null`) pour les textes ambigus, une réponse perdue et `agent_prompt_stalled` ; ne pas les transformer automatiquement en succès ou en refus définitif.

## 5. Gravité moyenne : une réécriture avec croissance peut conserver une ancienne cible fausse

**Lignes :** `253`, puis `256` à `262` ; signature de queue alimentée à `208`.

Quand le fichier grandit, le contrôle vérifie seulement les 64 octets précédant l’ancien décalage. Il ne compare pas le début déjà lu. Un journal réécrit au début, conservant ces 64 octets puis recevant une nouvelle entrée, garde les anciennes délégations en mémoire alors qu’elles ne correspondent plus au fichier.

**Vérification :** `readSession` a été exécutée avec un système de fichiers entièrement simulé. Après une première lecture, une cible a été remplacée au début du journal et une entrée ajoutée, sans changer la queue contrôlée, l’identité du fichier ou sa date de création. La réponse conserve l’ancienne cible et ajoute la nouvelle entrée.

**Correctif :** vérifier au minimum une empreinte du début en plus de la queue ; réinitialiser l’état si elle change. Documenter qu’une signature partielle ne prouve pas l’immuabilité de tout le préfixe. Si des réécritures arbitraires doivent être garanties, utiliser un signal de génération fiable ou une vérification complète adaptée, plutôt que revendiquer cette garantie avec seulement 64 octets.

## Périmètre des vérifications

Ces cinq constats ont été vérifiés par des simulations en mémoire utilisant les fonctions du fichier examiné, sans écrire de journaux factices sur disque. Le refus des liens symboliques, le motif de validation de session et la copie des objets retournés sont présents dans le code ; aucun contournement de ces protections n’est revendiqué ici. La suite générale n’a pas été relancée, puisqu’aucun code n’a été modifié.
