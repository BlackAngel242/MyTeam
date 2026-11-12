# Propositions d'amélioration : présence, pilotage et revue

Statut : proposition. Ce document ne modifie aucun comportement du produit. Chaque proposition est indépendante : elle peut être acceptée, modifiée ou refusée séparément. Rien n'est décidé tant que l'évaluation n'a pas eu lieu et que l'accord explicite n'a pas été donné, proposition par proposition.

## En bref, terre à terre

Aujourd'hui, le bureau voit les agents, leur envoie des consignes et lit leurs réponses. Ça marche. Ce qui manque, ce n'est pas une fonction vedette, c'est de la solidité et de la mémoire :

- savoir plus vite et plus sûrement ce que fait chaque agent, sans relire les panneaux en boucle ;
- ne jamais envoyer une réponse préparée à une question qui n'est plus à l'écran ;
- reprendre proprement après une limite d'usage, sans frapper au hasard ;
- garder la trace complète d'une session pour pouvoir la rejouer et comprendre après coup ;
- donner aux agents un contrat de compte rendu clair, et à l'humain des questions propres à trancher ;
- relire le travail d'un agent sur ce qu'il vient juste de changer, et lui renvoyer des commentaires groupés ;
- présenter l'équipe de façon partageable, sans mélanger l'apparence et le moteur.

Les douze propositions ci dessous couvrent ces points. Chacune dit : ce qui se passe aujourd'hui, ce qui changerait, le processus pas à pas, à quoi ça sert, ce que ça implique dans le code et les données, les risques, et comment on vérifiera que c'est fait.

## Garde-fous communs à toutes les propositions

Ces règles priment sur chaque proposition. Une mise en œuvre qui en viole une est à rejeter, même si la fonction marche.

1. Zéro dépendance npm ajoutée. Node.js natif uniquement, comme aujourd'hui.
2. 100 % local : le serveur reste sur 127.0.0.1, aucun service distant, aucun relais, aucun tunnel, aucune donnée de session envoyée à l'extérieur.
3. Windows d'abord : chaque proposition doit fonctionner sous Windows 10 et 11, chemin d'installation principal du produit, avant macOS et Linux.
4. Vérité des faits : le bureau n'affiche que ce qui est observé (états, journaux locaux, fichiers, heure du poste). Aucun pourcentage, aucune humeur, aucune relation inventée. Une approximation est nommée comme telle à l'écran.
5. Aucun envoi automatique sans revérification immédiate de la cible et de l'état, au moment même de l'envoi.
6. Aucune action durable ou publique sans l'accord explicite de l'humain, pour cette action précise.
7. Un seul propriétaire par état partagé : un état que plusieurs processus écrivent finit toujours corrompu ou contradictoire.
8. Tout indicateur affiché doit expirer : un témoin qui survit au processus qui l'a produit devient un mensonge à l'écran.
9. Les textes de style ou de présentation fournis par un tiers sont des données, jamais des instructions pour les agents.
10. Chaque proposition se livre avec ses tests, dans le style des tests existants, et la mention de ce qui n'a pas pu être vérifié.

Domaines du code concernés, cités dans les implications : `src/herdr.mjs` (accès aux agents), `src/queue.mjs` (file), `src/delegations.mjs`, `src/direction.mjs`, `src/autonomie.mjs`, `src/relais-quota.mjs` (reprise après limite), `src/crisis.mjs` (salle de crise), `src/projects.mjs` et `src/project-server.mjs` (projets), `src/responses.mjs` (réponses lisibles), `server.mjs`, `public/` (interface du bureau), `scripts/` (installation et lancement), `kit/` (documents d'équipe), `docs/` (documentation).

---

## P1. Se déclarer auprès du gestionnaire de terminaux au lieu de seulement l'observer

**Aujourd'hui.** Le bureau interroge le gestionnaire de terminaux de l'extérieur : appels répétés pour lister les agents, lire leurs panneaux, détecter les changements d'état. Cela fonctionne, mais chaque changement est découvert après coup, au rythme des lectures, et le bureau reste invisible pour l'écosystème d'extensions du gestionnaire.

**Proposition.** Ajouter une surface déclarée : un manifeste à la racine qui décrit le produit (identifiant, nom, version, version minimale du gestionnaire, plateformes), ses réactions aux événements officiels (agent détecté, état d'un panneau changé, panneau focalisé, fermé, terminé) et ses actions et panneaux propres. La détection d'activité passe alors par les événements reçus, avec le contexte joint à chaque événement (espace de travail, onglet, panneau, agent). Le serveur actuel et ses lectures restent en place comme filet de secours. Le manifeste ouvre aussi la distribution par l'index officiel des extensions, qui référence automatiquement tout dépôt public portant le sujet prévu et un manifeste lisible.

**Processus.**
1. Écrire le manifeste avec les seuls événements utiles à la détection d'état, aucun de plus.
2. Ajouter un point d'entrée mince qui reçoit un événement, le traduit en fait interne (agent, ancien état, nouvel état, heure) et le transmet au même traitement que les lectures actuelles utilisent.
3. Garder une lecture de secours espacée qui rattrape les événements manqués, par exemple après un redémarrage du gestionnaire.
4. Coalescer les rafales : plusieurs événements pour le même panneau dans un court délai ne déclenchent qu'un seul traitement.
5. Déclarer dans le manifeste les actions d'ouverture du bureau et de consultation d'état, sans inscrire d'action au moment de l'exécution.

**Utilité.** Détection plus rapide et plus juste, moins d'appels répétés, moins de charge sur le poste. Le produit devient installable et découvrable par le canal officiel des extensions, au lieu de la seule commande npm.

**Implications.** Nouveau fichier manifeste à la racine ; nouveau point d'entrée dans `scripts/` ou `src/` ; `src/herdr.mjs` gagne une source d'événements à côté de ses lectures ; aucun changement au modèle de données du bureau ; l'installation npm actuelle reste la voie principale pendant la transition. Le sujet de dépôt doit être ajouté pour l'indexation, action publique à valider séparément.

**Risques et garde-fous.** Un événement annoncé ne vaut pas fait accompli : le traitement continue de revérifier l'état réel avant toute action. Les noms d'événements du manifeste suivent la forme exacte attendue par le gestionnaire, à vérifier contre sa documentation et un essai réel, pas contre un schéma supposé. Si les événements sont absents (ancienne version), le bureau retombe sur ses lectures actuelles sans rien afficher de faux.

**Critères d'acceptation.**
- Avec les événements actifs, un changement d'état d'agent est reflété au bureau sans attendre le cycle de lecture de secours, vérifié sur une session d'essai dédiée.
- Gestionnaire arrêté puis relancé : le bureau retrouve un état juste par ses lectures, sans agent fantôme.
- Rafale de 50 événements sur un panneau : un seul traitement visible, aucun envoi dupliqué.
- Sans manifeste (fichier renommé), le bureau démarre et fonctionne comme aujourd'hui.

**Effort estimé : moyen à grand. Priorité suggérée : haute, en vague 2 (après les garde-fous P5 et P6, qui protègent déjà les envois).**

## P2. Journal d'événements en ajout seul et relecture d'une session

**Aujourd'hui.** Le produit garde des journaux de session et des documents de passation, mais on ne peut pas rejouer une session d'équipe : qui a reçu quoi, qui a attendu, qui a terminé, dans quel ordre, et ce que le bureau affichait à un instant donné.

**Proposition.** Enregistrer chaque fait du bureau dans un journal en ajout seul, un fait par ligne : délégation envoyée, changement d'état d'un agent, réponse reçue, reprise après limite, arrêt de crise, question posée à l'humain et sa réponse. L'affichage, actuel ou rejoué, est calculé à partir de ces faits, jamais stocké à part. Une vue de relecture permet de revenir à n'importe quel instant d'une session passée et d'avancer pas à pas.

**Processus.**
1. Définir le format d'un fait : type, heure du poste, projet, panneau, agent, charge utile minimale, aucune donnée secrète.
2. Brancher l'écriture aux endroits où les faits naissent déjà (file, délégations, réponses, crise, reprise).
3. Construire l'état affiché comme une fonction des faits lus depuis le début : même entrée, même état, toujours.
4. Ajouter la relecture : choisir une session, placer le curseur à un instant, lire l'état calculé à cet instant, avancer fait par fait.
5. Prévoir la rotation : un journal par session, conservé dans le dossier de données privé du projet, hors du dépôt, comme l'état d'exécution actuel.

**Utilité.** Comprendre après coup un blocage ou une erreur d'aiguillage, montrer une session à quelqu'un, déboguer sans deviner. Cela sert aussi de preuve : ce qui s'est passé est écrit une fois, dans l'ordre.

**Implications.** Nouveau module de journal dans `src/` (par exemple `src/journal-evenements.mjs`) ; écritures ajoutées dans `src/queue.mjs`, `src/delegations.mjs`, `src/crisis.mjs`, `src/relais-quota.mjs` ; vue nouvelle dans `public/` ; tests de rejeu à état égal. Aucune donnée ne quitte le poste. Le volume reste faible : des faits, pas des copies d'écran.

**Risques et garde-fous.** Ne jamais journaliser de contenu sensible (consignes complètes seulement si le projet l'accepte déjà pour ses journaux ; sinon type et cible suffisent). Un fait illisible ou inconnu est ignoré, jamais bloquant : le journal ne doit pas pouvoir empêcher le bureau de travailler. Écriture en ajout seul, jamais de réécriture d'un fait passé.

**Critères d'acceptation.**
- Une session simulée de bout en bout produit un journal dont la relecture redonne, à chaque instant testé, l'état que le bureau affichait.
- Retour arrière dans la relecture : état strictement identique à celui du passage en avant, sur les mêmes faits.
- Ligne corrompue insérée au milieu du journal : relecture continue, la ligne est signalée comme ignorée.
- Aucune écriture dans le journal ne ralentit un envoi de consigne de façon perceptible sur le banc de test existant.

**Effort estimé : moyen. Priorité suggérée : haute, en vague 2. Il sert de fondation à P4, P8 et P12.**

## P3. Packs d'équipe partageables, présentation séparée du moteur

**Aujourd'hui.** L'apparence et l'identité des membres (nom affiché, couleurs, poste dans la scène) vivent dans le produit. Deux utilisateurs ne peuvent pas se passer une équipe toute prête, et présenter l'équipe autrement obligerait à toucher au moteur.

**Proposition.** Définir un format de pack d'équipe : un dossier avec un fichier de description qui liste les rôles présentés (identifiant, nom, couleurs, emblème, répliques courtes par langue, style de réponse éventuel). Le moteur lit un pack, le valide, et l'utilise pour la présentation seulement. L'utilisateur peut copier un pack, le modifier, l'appliquer, revenir au pack par défaut. Les packs se partagent comme de simples dossiers.

**Processus.**
1. Définir le format du pack : champs obligatoires, champs facultatifs, langues, limites de taille par champ.
2. Écrire la validation : tout champ inconnu ou mal formé est signalé avant application, jamais appliqué à moitié.
3. Appliquer un pack = le copier dans l'espace privé du produit ; l'original de l'utilisateur reste intact ; le bureau relit le pack appliqué.
4. Séparer strictement : un pack ne peut ni changer un réglage personnel protégé (seuils d'autonomie, crise, dossiers autorisés), ni contenir d'instruction destinée aux agents. Ses textes sont du style et de l'affichage, tronqués aux limites du format.
5. Fournir un pack d'exemple neutre, correspondant à l'équipe par défaut actuelle.

**Utilité.** Un utilisateur prépare son équipe une fois et la retrouve partout ; la communauté peut échanger des équipes sans échanger de code ; le moteur reste stable pendant que les présentations varient.

**Implications.** Nouveau format documenté dans `docs/` ; lecture et validation dans `src/` (module dédié) ; réglages d'application dans `public/` (choisir, appliquer, revenir au défaut) ; le kit peut livrer un pack de départ par projet. Aucune dépendance, aucun appel réseau : un pack est un dossier local.

**Risques et garde-fous.** Un pack vient d'un tiers : le traiter comme du code non fiable pour la sécurité d'affichage (échappement systématique dans l'interface) et comme du style pour les agents (garde-fou 9). L'application est réversible en un geste. Un pack invalide laisse le pack courant en place et dit pourquoi.

**Critères d'acceptation.**
- Pack d'exemple appliqué : la scène et les cartes montrent ses noms et couleurs, les états réels restent ceux observés.
- Pack avec un champ obligatoire manquant : refus complet, message précis, pack courant inchangé.
- Pack contenant un texte d'instruction déguisé en style : le texte n'atteint aucun envoi aux agents, vérifié par test sur les envois sortants.
- Retour au pack par défaut sans redémarrage du serveur, état de présentation seulement.

**Effort estimé : moyen. Priorité suggérée : moyenne, en vague 3.**

## P4. Portes humaines et routage dans la file de travail

**Aujourd'hui.** La file enchaîne les consignes et l'autonomie plafonnée avance sous conditions, mais une étape ne déclare pas formellement si elle peut avancer seule ou si elle doit attendre l'humain, ni où va le travail selon qu'il réussit ou échoue.

**Proposition.** Donner à chaque étape de la file trois déclarations : son mode (automatique ou porte humaine), son délai maximal, et ses destinations selon le résultat (étape suivante si succès, étape ou état si échec). Une étape à porte humaine s'arrête proprement et attend, visible dans le bureau, sans rien envoyer. Le résultat d'une étape est constaté par les faits (état de l'agent, compte rendu reçu), jamais supposé.

**Processus.**
1. Étendre le modèle d'étape de `src/queue.mjs` avec mode, délai et routage, valeurs par défaut compatibles avec les files existantes (tout automatique, routage actuel).
2. À la fin constatée d'une étape, appliquer le routage : avancer, arrêter à la porte, ou basculer vers la destination d'échec.
3. Délai dépassé : l'étape est marquée en délai, le travail n'est ni relancé ni détruit ; l'humain décide.
4. Afficher dans le bureau le mode de chaque étape et la porte en attente, avec le même vocabulaire que la salle de crise.
5. Journaliser chaque transition dans le journal de P2.

**Utilité.** L'autonomie devient prévisible : on sait à l'avance où la machine s'arrêtera et où elle continuera. La salle de crise garde son rôle d'arrêt d'urgence ; les portes sont l'arrêt prévu, calme, au bon endroit.

**Implications.** `src/queue.mjs` et `src/autonomie.mjs` principalement ; affichage dans `public/` ; compatibilité ascendante des files enregistrées (absence des nouveaux champs = comportement actuel). Aucun nouvel état persistant hors du dossier privé du projet.

**Risques et garde-fous.** Une porte ne doit jamais être franchie par un mécanisme de reprise (P5) ni par une relance automatique. Le délai ne tue aucun processus : il signale. Le routage d'échec ne renvoie jamais une consigne en boucle : nombre de passages par étape plafonné et visible.

**Critères d'acceptation.**
- File de 3 étapes dont la deuxième à porte humaine : la première s'exécute, la file s'arrête à la porte sans envoi, l'humain valide, la suite part.
- Étape en échec constaté : le travail suit la destination d'échec déclarée, une seule fois.
- Étape dont le délai expire pendant un travail réel : marquage en délai, aucun processus interrompu, aucune relance.
- Ancienne file sans les nouveaux champs : comportement identique à aujourd'hui, suite de tests existante verte.

**Effort estimé : moyen. Priorité suggérée : haute, en vague 2.**

## P5. Reprise après limite d'usage : armée, revérifiée, plafonnée

**Aujourd'hui.** Le relais de quota confie la mission d'un agent qui atteint sa limite à un autre agent, et la reprise existe. Mais la reprise d'un agent après la réouverture de sa fenêtre repose sur des conditions moins strictes que ce que la prudence exige pour une frappe automatique dans un panneau.

**Proposition.** Formaliser la reprise en contrat : un agent n'est repris automatiquement que s'il a été armé explicitement pour cela, un par un. Au moment de reprendre, trois revérifications ont lieu dans l'ordre : l'agent est toujours inactif ; il n'est pas en attente d'approbation ou de réponse de l'humain ; la preuve de la limite (le message affiché dans son panneau) est toujours présente ou vient de disparaître selon la règle choisie, constatée à l'écran. Les essais suivent un délai croissant et un plafond d'abandon. L'état de reprise (murs détectés, agents armés) appartient à un seul processus propriétaire, alimenté par un signal léger à chaque changement d'état et un balayage de secours espacé. Tout indicateur de limite affiché porte une durée de vie : si le processus propriétaire s'arrête, les indicateurs expirent au lieu de rester affichés faux.

**Processus.**
1. Ajouter l'armement explicite par agent, désactivé par défaut, visible et révocable dans le bureau.
2. Détecter le mur : lire l'heure de réouverture dans le message que l'agent affiche lui même dans son panneau ; ne jamais la deviner.
3. À l'heure dite, revérifier les trois conditions ; si l'une échoue, ne rien taper, journaliser la raison, réarmer ou abandonner selon la règle.
4. Appliquer le délai croissant entre essais (par exemple doublement) et l'abandon après un nombre fixe d'essais, annoncé à l'avance.
5. Rotation de compte ou redémarrage de session : hors périmètre, désactivés ; la reprise ne fait que continuer le travail confié, dans la même session.

**Utilité.** Le travail reprend tout seul quand c'est sûr, et jamais au mauvais moment : pas de frappe dans une boîte de dialogue, pas de réveil d'un agent qui attend l'humain, pas de boucle de tentatives. C'est la différence entre une reprise utile et une reprise qui casse une session.

**Implications.** `src/relais-quota.mjs` et le chemin de reprise de `server.mjs` ; état d'armement dans le dossier privé du projet ; affichage du compte à rebours de réouverture et de l'état armé dans `public/` ; tests sur panneaux simulés dans le style existant. Aucune rotation de compte, aucun service externe.

**Risques et garde-fous.** La frappe automatique est l'action la plus risquée du produit : le garde-fou 5 s'y applique sans exception, et tout doute = aucun envoi. L'armement ne se transmet pas d'un projet à l'autre. Un mur ne tombe que lorsque sa preuve a réellement disparu de l'écran.

**Critères d'acceptation.**
- Agent armé, mur affiché avec une heure de réouverture simulée : reprise unique, après l'heure, les trois revérifications passant.
- Même scénario, mais l'agent est en attente d'approbation à l'heure dite : aucun envoi, raison journalisée.
- Mur toujours présent après l'heure : essais espacés selon la règle, abandon au plafond, état visible.
- Processus propriétaire arrêté : les indicateurs de limite disparaissent à l'expiration de leur durée de vie, aucun faux affichage durable.

**Effort estimé : moyen. Priorité suggérée : très haute, en vague 1.**

## P6. Revérifier avant chaque envoi préparé

**Aujourd'hui.** Une réponse ou une consigne peut être préparée dans le bureau, puis envoyée quelques instants plus tard. Entre la préparation et l'envoi, l'agent a pu changer d'état, afficher une autre question, ou recevoir une réponse au clavier. Envoyer quand même, c'est répondre à côté.

**Proposition.** Tout envoi préparé est revérifié juste avant de partir : le panneau cible affiche toujours la question ou l'état pour lequel l'envoi a été préparé ; un court délai de grâce sépare la préparation de l'envoi possible ; un même envoi ne peut pas partir deux fois pour le même panneau et le même état. Si la revérification échoue, l'envoi est retenu, le bureau dit pourquoi, et l'humain décide. Quand l'envoi consiste à choisir une option affichée, la correspondance se fait sur le texte exact visible à l'écran, jamais sur une ressemblance : une option du type « oui, ne plus demander » ne doit jamais être choisie par un « oui » simple.

**Processus.**
1. À la préparation, enregistrer l'empreinte de ce qui est affiché : panneau, agent, texte de la question ou état, heure.
2. À l'envoi, relire le panneau et comparer à l'empreinte ; écart = retenue et explication.
3. Appliquer le délai de grâce par défaut à tout envoi préparé, sauf envoi immédiat saisi et validé dans le même geste par l'humain.
4. Marquer chaque envoi parti avec panneau, état et heure ; tout nouvel envoi identique dans la fenêtre d'anti-répétition est bloqué et signalé.
5. Pour un choix parmi des options affichées, exiger la correspondance exacte avec l'option visée, relue à l'écran au moment d'agir.

**Utilité.** Supprime une classe entière d'erreurs : réponses envoyées au mauvais moment, au mauvais panneau, ou à une question déjà remplacée. C'est peu de code pour beaucoup de confiance.

**Implications.** Chemin d'envoi de `src/herdr.mjs` (`prompt`) et appelants dans `server.mjs` et `src/responses.mjs` ; empreintes conservées en mémoire et, pour les envois préparés durables, dans l'état privé du projet ; affichage de la retenue et de sa raison dans `public/`. Aucun changement pour les envois immédiats de l'humain.

**Risques et garde-fous.** La revérification ne doit pas retarder visiblement les envois normaux : une relecture ciblée, pas un balayage complet. En cas de doute de lecture, retenir vaut mieux qu'envoyer : la retenue est réversible, l'envoi non.

**Critères d'acceptation.**
- Réponse préparée, puis question remplacée dans le panneau simulé : envoi retenu, raison affichée, rien n'est tapé.
- Réponse préparée, panneau inchangé : envoi normal, une seule fois ; second déclenchement identique bloqué.
- Choix « oui » alors que l'écran affiche « Oui, ne plus demander » : aucune touche pressée.
- Suite de tests d'envoi existante : toujours verte, délais d'envoi inchangés à la mesure.

**Effort estimé : petit à moyen. Priorité suggérée : très haute, en vague 1.**

## P7. Ouverture de projet entièrement validée avant de créer quoi que ce soit

**Aujourd'hui.** Au démarrage, l'utilisateur choisit et valide les dossiers du projet avant toute consigne, et le bureau refuse de travailler hors des dossiers sélectionnés. Mais la montée de l'espace de travail (panneaux, agents, kit) se fait étape par étape : une erreur au milieu peut laisser un espace à moitié construit.

**Proposition.** Décrire chaque projet par un modèle déclaratif (dossiers, panneaux prévus, outil par panneau, kit à initialiser) et valider le modèle en entier avant de créer le moindre panneau : tous les dossiers existent, les cibles sont autorisées, les outils nommés sont présents, le nom du projet est unique dans l'état privé. L'ouverture par nom en commande suit exactement le même chemin de code que l'ouverture depuis l'interface, pour que les deux voies ne divergent jamais.

**Processus.**
1. Définir le modèle de projet comme un fichier simple, lu et validé, dans la continuité des projets actuels de `src/projects.mjs`.
2. Écrire la validation complète : elle rapporte toutes les erreurs trouvées d'un coup, avant toute création.
3. Ouvrir = appliquer le modèle validé ; tout échec en cours d'application arrête et dit ce qui a été créé et ce qui ne l'a pas été, sans rien détruire.
4. L'ouverture par nom (commande) appelle la même fonction que le bouton de l'interface.
5. Les projets existants sont convertis en modèles équivalents à la première lecture, sans changer leurs dossiers ni leur état.

**Utilité.** Fini les espaces à moitié montés et les divergences entre « ça marche en cliquant » et « ça marche en commande ». Un projet devient aussi partageable et reproductible : le modèle dit tout.

**Implications.** `src/projects.mjs`, `src/project-server.mjs`, `scripts/` pour la voie commande, écran de démarrage dans `public/`. L'état privé par projet reste hors du dépôt, comme aujourd'hui.

**Risques et garde-fous.** La validation ne doit jamais créer, déplacer ni supprimer quoi que ce soit. Un modèle ne peut pas désigner un dossier hors des cibles autorisées du projet actif. La conversion des projets existants est une lecture, pas une migration destructive.

**Critères d'acceptation.**
- Modèle avec un dossier inexistant et un outil absent : les deux erreurs sont rapportées ensemble, aucun panneau créé.
- Modèle valide : ouverture identique depuis l'interface et depuis la commande, vérifié sur la session d'essai.
- Échec simulé au troisième panneau : arrêt net, bilan affiché, panneaux déjà créés laissés en place et listés.
- Projet créé avant cette proposition : ouvert sans perte d'état ni de dossiers validés.

**Effort estimé : moyen. Priorité suggérée : haute, en vague 2.**

## P8. Contrat de compte rendu pour les agents, historique attaché à la tâche

**Aujourd'hui.** Les agents rendent compte en texte libre, que le chef et le bureau interprètent. D'une session à l'autre, la forme varie, et l'historique d'une tâche se perd quand la session se ferme ou se relance.

**Proposition.** Donner aux agents un contrat de compte rendu court et stable, affichable et copiable, qui dit exactement : comment signaler qu'une étape est terminée, comment commenter en cours de route, comment signaler un blocage et ce qu'il faut y joindre (fichiers touchés, tests lancés, ce qui n'a pas été vérifié). Chaque tâche porte son historique propre (consignes, commentaires, résultats, tentatives), conservé avec la tâche et non avec la session : relancer une session ne perd pas le fil de la tâche.

**Processus.**
1. Rédiger le contrat en une page, dans le kit (`kit/`), en français et en anglais comme les autres documents du kit.
2. Le bureau sait l'afficher et le copier en un geste, et l'inclure dans la consigne d'orientation du chef.
3. Modéliser l'historique de tâche dans l'état privé du projet : entrées horodatées, rattachées aux faits du journal P2.
4. À la clôture d'une étape, le compte rendu de l'agent est rangé dans l'historique de la tâche, avec son résultat constaté.
5. Une tâche rouverte ou reprise (P5) repart avec son historique complet, pas avec une page blanche.

**Utilité.** Des comptes rendus comparables, relisibles par l'humain comme par le chef ; une mémoire de tâche qui survit aux sessions ; moins de malentendus sur « terminé » (une transmission ne prouve pas la fin du travail, le contrat dit quelle preuve est attendue).

**Implications.** Documents du `kit/` ; modèle de tâche dans `src/queue.mjs` et `src/delegations.mjs` ; affichage de l'historique dans `public/` ; tests sur la conservation après redémarrage simulé du serveur. Aucun format imposé aux outils eux mêmes : le contrat est une consigne, pas un protocole technique.

**Risques et garde-fous.** Le contrat reste court : un agent qui doit lire trois pages avant de travailler travaillera moins bien. L'historique ne contient pas de secret ni de jeton, comme les autres journaux du produit.

**Critères d'acceptation.**
- Nouvelle installation du kit : le contrat est présent dans les deux langues et cité par la consigne d'orientation.
- Tâche menée sur deux sessions successives : son historique complet est visible après la relance, dans l'ordre.
- Compte rendu qui ne suit pas le contrat : il est quand même rangé, et le bureau signale seulement qu'il est hors contrat, sans le rejeter.

**Effort estimé : petit à moyen. Priorité suggérée : moyenne, en vague 3 (après P2).**

## P9. Questions structurées à l'humain, réponses lisibles par la machine

**Aujourd'hui.** Quand un agent ou le bureau doit faire trancher l'humain (choix de projet, arbitrage, salle de crise), la question part en texte libre et la réponse revient en texte libre, que chacun interprète.

**Proposition.** Un format de question structurée : la question, des options avec pour chacune un libellé, un sous-titre, les avantages et les inconvénients quand ils comptent, une option marquée recommandée s'il y en a une, et un champ libre toujours possible. La question s'affiche dans le bureau navigateur existant, au dessus du travail en cours. La réponse revient sous une forme stable et lisible par la machine (objet structuré), avec un résultat explicite parmi : répondu, fermé sans réponse, délai dépassé, impossible à afficher. Aucun outil d'affichage externe n'est requis : le bureau est déjà un navigateur.

**Processus.**
1. Définir le format de question et de réponse, et les quatre résultats possibles.
2. Ajouter l'affichage dans `public/` : une question à la fois au premier plan, les suivantes en attente visibles.
3. L'appelant (agent via le chef, ou bureau) pose la question et attend la réponse structurée, avec un délai déclaré.
4. Délai dépassé ou question fermée : le résultat correspondant est rendu, jamais une réponse inventée ; l'appelant décide de la suite.
5. Journaliser la question et son résultat dans le journal P2, sans le contenu libre sensible éventuel.

**Utilité.** Des arbitrages plus rapides à donner et impossibles à mal comprendre ; le choix de l'humain devient une donnée propre que la file (P4) et la reprise (P5) peuvent utiliser sans deviner.

**Implications.** Format nouveau dans `src/` (par exemple `src/questions.mjs`) ; affichage dans `public/` ; intégration à la salle de crise (`src/crisis.mjs`) et au choix de projet comme premiers usages. Aucune dépendance d'affichage externe, aucun service.

**Risques et garde-fous.** Une question structurée ne doit jamais devenir un interrogatoire : nombre d'options limité, champ libre toujours présent, et « fermer sans répondre » est un résultat honorable, pas une erreur. Pas de question modale qui bloque le bureau entier.

**Critères d'acceptation.**
- Question à 3 options posée depuis une étape de file : réponse structurée reçue, étape routée selon le choix.
- Question fermée sans réponse : résultat « fermé » rendu à l'appelant, aucune action prise à sa place.
- Délai dépassé : résultat « délai » rendu, la question quitte le premier plan, le travail non concerné continue.
- Une deuxième question posée pendant la première : elle attend visiblement, rien n'est perdu.

**Effort estimé : moyen. Priorité suggérée : moyenne, en vague 3.**

## P10. Revue du dernier tour et renvoi groupé de commentaires

**Aujourd'hui.** Quand un agent termine, le bureau montre ses réponses et l'état des fichiers, mais relire précisément ce que le dernier échange a changé, commenter ligne par ligne et renvoyer l'ensemble à l'agent demande des allers retours manuels.

**Proposition.** Une vue de revue avec quatre portées au choix : changements non enregistrés, branche entière, dernier tour de l'agent (seulement ce que le dernier échange a touché), et série de commits. L'humain ou le chef annote une ligne ou une plage, les commentaires s'accumulent, puis partent en un seul envoi groupé, précédé d'un préfixe d'instruction réglable. Aucun envoi n'est automatique : la revue ne modifie aucun fichier et n'envoie rien toute seule.

**Processus.**
1. Calculer la différence pour la portée choisie, en lecture seule, avec les outils Git déjà utilisés par le produit.
2. Pour la portée « dernier tour », délimiter par les faits du journal P2 (début et fin du tour), pas par une devinette sur les dates de fichiers.
3. Afficher la différence dans le bureau, côte à côte avec la sortie de l'agent.
4. Collecter les commentaires (ligne, plage, texte), les montrer en liste avant envoi.
5. Envoyer le groupe en une fois dans le panneau de l'agent choisi, par le chemin d'envoi revérifié de P6, avec le préfixe réglé.

**Utilité.** C'est le chaînon entre « un agent a fini » et « on lui renvoie un correctif précis » : moins de copier coller, des commentaires qui visent juste, et une évaluation plus rapide du travail délégué.

**Implications.** Lecture Git en lecture seule dans `src/` (module de revue) ; affichage dans `public/` ; dépend de P2 pour la portée « dernier tour » et de P6 pour l'envoi. Aucun commentaire publié à l'extérieur : tout reste dans la session locale.

**Risques et garde-fous.** La revue ne doit jamais être confondue avec une validation : annoter n'approuve pas. Les différences volumineuses sont paginées et limitées, jamais chargées d'un bloc dans le navigateur. Aucun envoi sans l'action explicite de l'humain ou du chef dans le bureau.

**Critères d'acceptation.**
- Portée « dernier tour » : seuls les fichiers touchés pendant le tour s'affichent, vérifié sur un scénario simulé à deux tours.
- Trois commentaires sur deux fichiers : un seul envoi groupé, dans l'ordre, avec le préfixe.
- Revue ouverte puis fermée sans envoi : aucun message dans le panneau de l'agent, aucun fichier touché.
- Différence très volumineuse : affichage limité et paginé, navigateur réactif.

**Effort estimé : moyen à grand. Priorité suggérée : moyenne, en vague 3.**

## P11. Tableau de tâches partagé à double entrée et espaces isolés par tâche

**Aujourd'hui.** Les tâches vivent dans les fichiers du projet (listes, plans) que le bureau suit, et chaque agent travaille dans le dossier du projet. Deux agents sur le même dossier peuvent se marcher dessus, et un agent ne dispose pas d'une commande propre et stable pour lire et mettre à jour le même tableau que l'humain regarde.

**Proposition.** Deux ajouts liés. D'abord, un tableau de tâches à double entrée : le même état de tâches est présenté à l'humain dans le bureau et offert aux agents par une petite commande dédiée (lire le tableau, prendre une tâche, commenter, clore), avec des règles d'écriture strictes (un propriétaire par tâche, transitions déclarées). Ensuite, pour les tâches qui touchent du code, un espace de travail isolé par tâche, créé et rangé par le produit, pour que deux agents ne modifient jamais les mêmes fichiers en même temps ; le produit sait basculer d'un espace à l'autre, créer, fusionner la préparation et retirer un espace terminé.

**Processus.**
1. Définir l'état de tâche unique : identifiant, titre, propriétaire, état, commentaires, historique (P8).
2. Exposer la commande agent : lecture et transitions seulement, aucun accès direct au fichier d'état.
3. Le bureau et la commande lisent et écrivent par le même module, dans `src/` (par exemple `src/todos.mjs` étendu), pour ne jamais diverger.
4. Espace isolé par tâche : création à la prise de tâche quand le projet est un dépôt, panneau ouvert dedans, retour et nettoyage proposés à la clôture, jamais de suppression sans accord.
5. Conflit de propriétaire ou de fichier : signalé avant le départ, pas découvert après.

**Utilité.** Un seul tableau, vrai pour tout le monde ; les agents cessent de se gêner dans le même dossier ; la préparation parallèle devient possible sans désordre.

**Implications.** `src/todos.mjs` et `src/files.mjs` ; commande dans `scripts/` ; gestion d'espaces dans `src/projects.mjs` ; affichage du tableau et des espaces dans `public/`. Aucune dépendance externe : les espaces isolés utilisent l'outil de version déjà présent sur le poste.

**Risques et garde-fous.** L'espace isolé ne doit pas devenir un piège : création et retrait restent des actions visibles, réversibles, et le dossier principal n'est jamais modifié par la création d'un espace. La commande agent applique les mêmes contrôles de cible que le bureau.

**Critères d'acceptation.**
- Une tâche prise par un agent via la commande apparaît prise dans le bureau, avec son propriétaire, sans rechargement manuel.
- Deux agents, deux tâches de code en parallèle : fichiers modifiés disjoints, prouvé sur un dépôt d'essai.
- Clôture d'une tâche isolée : retour proposé, espace retiré seulement après accord, dossier principal intact.
- Transition interdite tentée via la commande (clore la tâche d'un autre) : refus clair, état inchangé.

**Effort estimé : grand. Priorité suggérée : moyenne, en vague 3, à découper en deux livraisons (tableau d'abord, espaces ensuite).**

## P12. Présence lisible : qui travaille, qui attend, ce qui mérite l'œil

**Aujourd'hui.** Le bureau montre chaque agent à son poste, avec son état. Quand les agents se multiplient et que plusieurs projets ou espaces existent, trois choses manquent : un regroupement par projet avec celui qui attend l'humain en premier, des compteurs honnêtes de ce qui reste à lire, et le signalement des faux terminés (un agent affiché fini alors qu'un processus d'arrière plan vit encore).

**Proposition.** Un ensemble de petits signaux, tous tirés de faits observés :
- vue des agents groupée par projet, lignes ordonnées par activité réelle, agents inactifs estompés, identité du fournisseur et du modèle visibles comme aujourd'hui ;
- file des réponses à lire avec un compteur par agent, qui s'efface quand l'humain ouvre réellement la réponse, pas avant ;
- badge « inactif mais processus vivant » quand un agent semble terminé mais qu'un processus d'arrière plan rattaché à son panneau tourne encore ;
- compteurs d'usage et de limites lus dans les fichiers locaux des agents, sans service ni processus supplémentaire, affichés seulement quand la source locale existe et dit son âge ;
- nommage automatique des panneaux sans modèle de langage : branche, processus, session, dans cet ordre de préférence, renommage seulement si le panneau n'a pas déjà un nom donné par l'humain ;
- alertes locales uniquement : un agent qui se bloque ou qui termine se signale dans le bureau et, si le poste le permet, par la notification du système ; aucun relais externe, aucun envoi à un service de notification.

**Processus.**
1. Regroupement et ordre : calculer la vue depuis les états déjà observés et le journal P2, sans nouvelle source de données.
2. Compteur de lecture : incrémenté à l'arrivée d'une réponse constatée, décrémenté à l'ouverture réelle de la réponse dans le bureau.
3. Faux terminé : croiser l'état affiché de l'agent avec l'information de processus du panneau, déjà lue par le produit ; divergence = badge, jamais de correction silencieuse de l'état.
4. Compteurs d'usage : lecture des fichiers locaux connus, horodatage affiché, absence de fichier = absence de compteur.
5. Nommage : règle purement locale et déterministe, journalisée, réversible.

**Utilité.** En un coup d'œil : qui a besoin de moi, qu'est ce que je n'ai pas lu, quel « terminé » n'en est pas un. C'est le confort quotidien d'une équipe de dix agents, sans aucune mécanique lourde.

**Implications.** Présentation dans `public/` ; lectures existantes de `src/herdr.mjs` (informations de processus) et `src/agent-activity.mjs` ; aucun nouvel état durable sauf les compteurs de lecture, dans l'état privé du projet. Aucun appel réseau, aucun modèle externe.

**Risques et garde-fous.** Chaque signal doit pouvoir dire d'où il vient (garde-fou 4) : au survol ou dans le détail, la source du fait est nommée. Un compteur dont la source vieillit est affiché avec son âge ou retiré, jamais présenté comme frais.

**Critères d'acceptation.**
- Deux projets ouverts en essai : la vue regroupe juste, l'agent en attente d'approbation apparaît en tête de son groupe.
- Réponse arrivée puis ouverte : le compteur passe de 1 à 0 à l'ouverture, pas à l'arrivée ni au simple affichage de la liste.
- Agent terminé avec processus d'arrière plan vivant simulé : badge présent ; processus arrêté : badge retiré au cycle suivant.
- Panneau nommé par l'humain : le nommage automatique n'y touche jamais.

**Effort estimé : petit à moyen, découpable signal par signal. Priorité suggérée : haute pour le faux terminé et le compteur de lecture (vague 1), le reste en vague 2.**

---

## Ordre de mise en œuvre suggéré

**Vague 1, fiabilité immédiate.** P6 (revérifier avant envoi), P5 (reprise après limite disciplinée), P12 partiel (faux terminé, compteur de lecture). Ce sont les propositions qui empêchent des erreurs, avec le moins de surface nouvelle.

**Vague 2, structure.** P1 (surface déclarée et événements), P2 (journal et relecture), P7 (ouverture validée), P4 (portes humaines). Elles changent les fondations et rendent les vagues suivantes moins chères.

**Vague 3, confort avancé.** P3 (packs d'équipe), P8 (contrat de compte rendu), P9 (questions structurées), P10 (revue du dernier tour), P11 (tableau partagé et espaces isolés). Chacune peut être prise ou laissée sans gêner les autres.

## Ce qui est écarté, et pourquoi

- **Dépendances compilées ou environnements d'exécution supplémentaires** (binaires à compiler, moteurs de pages ou de terminaux tiers) : contraires au zéro dépendance et à l'installation Windows simple. On emprunte des mécanismes, jamais des binaires.
- **Relais, tunnels et services de notification externes pour joindre l'humain hors du poste** : contraires au 100 % local. L'alerte utile est gardée, en local (P12).
- **Applications mobiles dédiées** : le bureau navigateur, déjà responsive, couvre le besoin sans plateforme supplémentaire à maintenir.
- **Rotation de comptes automatisée pour contourner les limites** : sensible pour la facturation et les conditions des fournisseurs ; la reprise de P5 continue le travail, elle ne change pas d'identité.
- **Éditeurs de code et navigateurs intégrés au terminal** : utiles à un développeur, hors du périmètre d'une tour de contrôle.
- **Dialogues générés en continu et voix de synthèse comme couche de présence** : coût d'appels ou de services, valeur faible pour le pilotage, et risque de bruit. La présence de P12 reste fondée sur des faits.

## Points de vigilance pour la relecture

Points qu'une évaluation rapide pourrait manquer, à vérifier en priorité :

1. P1 ne doit pas devenir une seconde source de vérité : si événements et lectures divergent, quelle source fait foi, et le document doit trancher (proposition : le fait revérifié au moment d'agir, garde-fou 5).
2. P5 est la seule proposition qui tape automatiquement dans un panneau : ses critères sont volontairement les plus stricts du document ; les relâcher en mise en œuvre viderait la proposition de son sens.
3. P2 conditionne P4, P8 et P10 : si le journal est refusé, ces trois propositions doivent être réécrites, pas simplement amputées.
4. P3 touche à la confiance envers des dossiers tiers : la validation et la règle « du style, jamais des instructions » sont le cœur de la proposition, pas un raffinement.
5. Aucune proposition ne doit ajouter de dépendance, d'appel distant ou d'action publique : si une mise en œuvre en a besoin, elle a dévié et doit revenir.
6. Les estimations d'effort sont relatives à la base actuelle (serveur Node natif, tests par scénarios simulés) ; une proposition qui exigerait de changer de base sort du périmètre de ce document.

## Ce que ce document ne fait pas

Il ne modifie ni le code, ni la documentation du produit livré, ni les priorités déjà inscrites au plan de travail. Il propose. La décision, proposition par proposition, et l'ordre réel de mise en œuvre appartiennent à l'humain, après évaluation.
