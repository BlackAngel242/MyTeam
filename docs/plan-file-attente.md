# Plan : file d'attente de consignes (conception seule, sans code)

Date : 17 octobre 2026. Auteur : OpenCode, mission de conception de Claude (panneau w5:p1). Ce document ne contient aucune ligne de code exécutable : c'est un plan pour que DrSmoke et Codex décident avant de construire. Fichier unique créé pour cette mission. Codex reste propriétaire de server.mjs, src/ et test/ ; Claude reste propriétaire de public/.

## 1. Le comportement proposé

Aujourd'hui, quand DrSmoke écrit à un agent occupé, la consigne est refusée : « Cet agent n'est pas disponible. » Il faut réécrire plus tard. L'idée : quand l'agent est occupé, le bureau propose de mettre la consigne en file. La consigne part toute seule quand l'agent redevient disponible, sans que DrSmoke ait à surveiller.

Concrètement :

1. DrSmoke écrit sa consigne et clique sur Envoyer. L'agent est au travail : le bureau affiche « Agent occupé : consigne mise en file pour Claude (panneau w5:p1) » avec le texte complet de la consigne visible, et un bouton « Retirer de la file » toujours cliquable.
2. La consigne attend. Rien ne part pendant ce temps. Le bureau montre la file : pour qui, depuis quand, et ce qui sera envoyé.
3. Dès que l'agent passe dans un état réellement disponible (disponible ou terminé, avec saisie prête, exactement le même contrôle que l'envoi direct d'aujourd'hui), la consigne part automatiquement, dans l'ordre où elle a été écrite.
4. Le bureau affiche « Consigne transmise à Herdr à 14 h 32 », sans jamais prétendre que la tâche est faite (principe de PRODUCT.md : signaler l'envoi, rien de plus).
5. Si quelque chose cloche (cible remplacée, agent redevenu bloqué, délai dépassé, Herdr coupé), la consigne ne part pas et passe en « à revoir » avec la raison affichée en français simple. C'est DrSmoke qui décide : renvoyer, changer de cible, ou jeter.

Une seule file, un seul ordre d'envoi par agent : si plusieurs consignes attendent pour le même agent, elles partent l'une après l'autre, avec au moins quelques secondes d'écart, pour ne pas inonder le terminal de l'agent.

## 2. Les conflits possibles et la parade de chacun

| Conflit | Ce qui se passe sans parade | La parade retenue |
|---|---|---|
| **L'agent se remet au travail entre le contrôle et l'envoi** (fenêtre de quelques secondes) | La consigne arrive pendant qu'il travaille ; elle peut rester dans sa zone de saisie sans partir (cas OpenCode observé dans LESSONS.md) ou le distraire | Contrôle d'état refait à la dernière seconde, juste avant l'envoi (c'est déjà le cas avec la liste relue dans src/herdr.mjs). Si Herdr ne confirme pas « agent_prompted », la consigne passe en « envoi non confirmé » et **n'est jamais renvoyée automatiquement** : le bureau demande à DrSmoke de regarder le terminal avant de réessayer (règle de LESSONS.md : ne jamais renvoyer à l'aveugle) |
| **Double envoi** (la file enverrait deux fois la même consigne) | L'agent reçoit deux fois la même demande | Chaque consigne en file reçoit un identifiant unique à l'écriture ; l'envoi est marqué « fait » avec cet identifiant avant toute confirmation ; le même verrou que celui de src/herdr.mjs (un envoi à la fois par agent) couvre aussi la file. Un envoi dont la réponse est perdue reste « non confirmé » et exige DrSmoke |
| **L'agent attend une réponse (autorisation, choix de dossier)** | La file pourrait boucher le dialogue ou répondre à sa place | Statut « attente de réponse » : **aucun envoi automatique**, la file pour cet agent est gelée et l'interface dit « Claude attend votre réponse dans Herdr ». Le bureau ne touche jamais aux boîtes de dialogue, ni à la touche Échap (interdits de LESSONS.md) |
| **L'agent est remplacé dans le même panneau** (nouveau terminal, nouvel agent) | La consigne part à un agent qui n'a rien demandé | La consigne en file garde l'identifiant avec empreinte (panneau + empreinte, comme aujourd'hui). Si l'empreinte ne correspond plus à la liste, la consigne passe en « cible remplacée » et attend DrSmoke : elle ne suit jamais l'occupant nouveau du panneau |
| **La consigne est déjà confiée ailleurs** (envoyée à la main pendant l'attente, ou donnée par une autre IA dans Herdr) | L'agent reçoit deux fois le même travail | Ce qui passe par Herdr en dehors du bureau est invisible : on ne peut pas le détecter. Parades possibles : (a) doublon strict détecté dans la file (même cible, même texte) avec le message « cette consigne est déjà en file » ; (b) si DrSmoke envoie la même chose à la main, il retire la consigne de la file avec le bouton prévu ; (c) la file reste visible en permanence pour qu'il voie ce qui reste à partir |
| **Deux onglets du bureau ouverts** | Chaque onglet croit être seul : deux files, deux envois possibles | La file vit côté serveur (voir section 4) : c'est le serveur seul qui décide et envoie, une fois. Les onglets affichent la même file, lue à chaque rafraîchissement. La suppression d'une consigne par un onglet la retire pour l'autre |
| **Le serveur est redémarré** | La file en mémoire disparaît, ou pire, repart en double | La file est écrite dans un petit fichier local, hors Git (aucun secret dans Git, règle absolue). Au démarrage, le serveur relit ce fichier : les consignes non envoyées réapparaissent avec la mention « file restaurée après redémarrage ». Toute consigne plus vieille que la fenêtre de validité (voir section 3) passe « à revoir » au lieu de partir. Le jeton change à chaque redémarrage : les onglets doivent actualiser, ce qui remet tout le monde d'accord |
| **Herdr est déconnected ou ne répond plus** | Envois dans le vide ou erreurs en boucle | Dès que la liste des agents échoue, le bureau affiche la déconnexion et **désactive les actions** (principe de PRODUCT.md) ; la file est gelée, rien ne part. À la reconnexion, la file reprend, mais les consignes trop vieilles (fenêtre de validité dépassée) demandent confirmation. Un agent qui a disparu de la liste fait passer sa consigne en « cible introuvable » |

Autre cas à ne pas oublier : **la file devient très longue**. Parade : limite douce (par exemple 20 consignes au total et 5 par agent) avec un message clair, plutôt que de laisser une file de 100 consignes inonder un agent au premier réveil.

## 3. Envoi automatique ou après confirmation de DrSmoke

**Recommandation : envoi automatique sous conditions, avec retrait possible tant que l'envoi n'a pas commencé.**

Le principe « envoi automatique surveillé » : la consigne part toute seule si et seulement si toutes ces conditions sont vraies au moment de l'envoi :

1. La cible est exactement la même (empreinte inchangée) ;
2. L'agent est réellement disponible (disponible ou terminé, saisie prête) : jamais au travail, jamais en attente de réponse, jamais inconnu ;
3. La consigne a moins de 30 minutes (fenêtre de validité, visible dans l'interface et modifiable) ;
4. Aucun doute n'est enregistré sur cette consigne (pas d'envoi non confirmé, pas de cible remplacée).

Dès qu'une condition manque, la consigne ne part pas et demande explicitement à DrSmoke.

Pourquoi ce choix :

- **Pour** : DrSmoke a demandé « un bouton fixe, qui analyse puis passe directement au fix sans que j'intervienne » et « une seule action principale ». Une confirmation à chaque envoi le retransforme en surveillant, ce que la file est justement censée éviter. Les conditions ci-dessus reprennent exactement les garde-fous déjà validés par les tests du projet (refus des agents occupés et bloqués, empreinte d'identité, confirmation Herdr obligatoire).
- **Contre et parade** : un envoi automatique reste un envoi. La parade est que la file soit visible en permanence (qui, quoi, depuis quand) avec un bouton « Retirer » actif jusqu'au début de l'envoi, et qu'aucun envoi non confirmé ne soit jamais répété. La fenêtre de 30 minutes évite de réveiller un agent à 3 h du matin avec une consigne de la veille.
- **Alternative écartée** : confirmation systématique. Plus prudente, mais elle ajoute un clic à chaque fois et va à l'encontre du fonctionnement voulu. Elle reste le mode de repli automatique dans tous les cas douteux, ce qui revient au même sans la contrainte au quotidien.

## 4. Où stocker la file

**Recommandation : côté serveur, en mémoire, avec sauvegarde dans un fichier local hors Git.**

| Solution | Avantages | Inconvénients | Verdict |
|---|---|---|---|
| Navigateur seul (localStorage) | Simple, rien à faire côté serveur | Deux onglets = deux files = doubles envois ; un vidage de cache la perd ; le serveur ne peut pas verrouiller les envois ; disparue si l'onglet est fermé longtemps | Écartée |
| **Serveur (mémoire + petit fichier local, hors Git)** | Source unique pour tous les onglets ; verrous et dédoublonnage au même endroit que les envois ; survit au redémarrage ; les règles de refus (agent bloqué, inconnu, occupé) sont appliquées au même endroit que l'envoi, sans reconfiance dans le navigateur | Un peu plus de travail dans server.mjs et src/ (fichiers de Codex) ; le fichier local contient le texte des consignes : il doit être dans .gitignore et signalé à DrSmoke | **Retenue** |
| Les deux (copie dans le navigateur) | Affichage hors ligne | Deux vérités possibles | Écartée, sauf simple copie d'affichage sans pouvoir d'envoi |

Emplacement prévu : `data/file-attente.json`, ajouté à .gitignore, avec une ligne dans README.md pour dire que ce fichier existe et peut être supprimé sans danger (la file repart alors vide). Côté API, la file reprend les mêmes protections que /api/prompt : origine exacte et jeton obligatoires pour ajouter, modifier ou retirer une consigne ; simple lecture pour affichage.

## 5. Les tests à écrire (pour la future implémentation)

Comportement de la file (unitaires) :

1. Une consigne écrite à un agent occupé entre en file ; écrite à un agent disponible, elle part directement sans passer par la file.
2. L'agent passe disponible : exactement un envoi, dans l'ordre d'écriture, avec un écart minimal entre deux consignes du même agent.
3. Doublon : la même consigne (même cible, même texte) ajoutée deux fois n'est stockée qu'une fois, avec avertissement.
4. Fenêtre de validité : une consigne de plus de 30 minutes ne part pas toute seule et demande DrSmoke.
5. Retrait : « Retirer de la file » fonctionne jusqu'au début de l'envoi, puis affiche honnêtement « déjà transmise ».

Conflits (intégration, avec un Herdr simulé comme dans les tests actuels) :

6. Agent qui se remet au travail entre le contrôle et l'envoi : aucun envoi, ou envoi confirmé par Herdr uniquement ; jamais deux fois.
7. Envoi sans confirmation de Herdr : statut « envoi non confirmé », aucun renvoi automatique.
8. Agent remplacé dans le même panneau (empreinte différente) : aucun envoi, statut « cible remplacée ».
9. Agent en attente de réponse (bloqué) ou inconnu : aucun envoi automatique, file gelée pour lui.
10. Herdr déconnecté : aucun envoi, actions désactivées ; à la reconnexion, seules les consignes encore valides partent.
11. Redémarrage du serveur : la file est relue dans le fichier, sans doublon d'envoi, et les vieilles consignes demandent confirmation.
12. Deux lecteurs (deux onglets simulés) : un seul envoi possible grâce au verrou, la suppression par l'un disparaît chez l'autre.
13. Garde-fous existants conservés : jeton et origine exigés pour toute action sur la file, refus d'un message vide ou trop long (1 à 12 000 caractères, comme aujourd'hui).

Tests d'interdits (ils doivent rester verts pour toujours) :

14. Aucun appel Herdr ne peut être déclenché vers un agent dont le statut est « bloqué » ou « inconnu ».
15. Aucun code du projet ne répond à une boîte de dialogue Herdr : la suite ne contient aucune commande qui valide une autorisation, choisit un dossier ou appuie sur Échap.

## 6. Ce qui doit rester interdit, sans exception

- **Jamais répondre à une boîte de dialogue d'autorisation ou de choix à la place de DrSmoke**, même pour débloquer une file. Un agent en attente de réponse attend DrSmoke, personne d'autre (règle de LESSONS.md).
- **Jamais envoyer automatiquement à un agent bloqué, inconnu ou au travail.** La file attend un état réellement disponible, sans exception « pour faire gagner du temps ».
- **Jamais renvoyer après un envoi non confirmé** : regarder le terminal d'abord, comme le dit LESSONS.md.
- **Jamais envoyer à un occupant nouveau d'un panneau** dont l'empreinte a changé.
- **Jamais fermer, interrompre, mettre à jour ou créer une session Herdr** pour faire avancer la file (contrainte de PRODUCT.md).
- **Jamais toucher aux fichiers des autres propriétaires** sans lire leur git diff (règle « un fichier, un propriétaire » de LESSONS.md) : l'implémentation de ce plan devra être discutée avec Codex, qui détient server.mjs, src/ et test/.
- **Jamais de secret dans Git** : le fichier de file d'attente est hors dépôt.

## 7. Résumé en une phrase

Une file unique rangée côté serveur, visible et retirable à tout moment, qui envoie toute seule dans les trente minutes si la cible est la même et l'agent vraiment disponible, et qui demande DrSmoke dans tous les autres cas, sans jamais toucher à une autorisation ni à un agent bloqué.
