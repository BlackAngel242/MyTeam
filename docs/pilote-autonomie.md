# Mode autonomie (NoBabysitter) : essai supervisé

Ce document explique comment faire un premier essai du mode autonomie. Le mode est supervisé : tu donnes un objectif, une durée et un plafond d'échanges. Pendant l'essai, le chef reçoit un rappel à chaque fin de travail observée et décide seul de la suite. Personne ne travaille tout seul et personne ne promet de résultat.

Chaque étape dit trois choses : ce que tu fais, ce que tu vois à l'écran (libellé exact du programme), et le fait qui le prouve.

## 1. Préparer l'équipe et le bureau

**Ce que tu fais.** Ouvre le bureau et vérifie trois choses avant de commencer : Herdr répond, les agents sont là, aucune crise n'est enclenchée.

**Ce que tu vois.** En haut, l'étiquette « Herdr connecté » ou « Herdr déconnecté ». Les onglets « Poste » et « Équipe ». Le bouton « Salle de crise », avec l'infobulle « Salle de crise (Ctrl+Maj+C) ». Dans l'onglet « Équipe », la ligne « Aucune crise. Enclencher la crise verrouille tous les envois du bureau et suspend la file ; tu peux ensuite demander à un agent de s’arrêter poliment. ».

**Le fait qui le prouve.** Le serveur refuse un lancement tant que la crise est active. Si une crise est déjà enclenchée, le panneau « Autonomie (NoBabysitter) » affiche « Salle de crise active : lève-la avant de lancer l’autonomie. » et le bouton « Lancer l’autonomie » est grisé. Le mode a besoin d'Herdr : c'est par Herdr que le bureau observe les états des agents.

## 2. Vérifier qui est le chef et l'état des agents

**Ce que tu fais.** Ouvre l'onglet « Équipe ». Regarde la section « Direction de l’équipe », puis l'état de chaque agent.

**Ce que tu vois.** « Direction de l’équipe » te montre le chef. Si Herdr ne répond pas encore : « Le chef apparaîtra dès que Herdr répond. ». Chaque agent affiche « Au travail », « Disponible » ou « Terminé ».

**Le fait qui le prouve.** Le mode fonctionne en étoile autour du chef : seuls les autres agents sont observés, et tout arrive dans la file du chef. Aucun agent n'écrit jamais à un autre agent.

## 3. Ouvrir le panneau Autonomie

**Ce que tu fais.** Clique sur le bouton « Autonomie » de l'en-tête (infobulle « Autonomie supervisée : le chef décide de la suite avec un plafond »).

**Ce que tu vois.** Une fenêtre intitulée « Autonomie (NoBabysitter) ». Elle contient le texte « Donne un objectif : le chef reçoit chaque fin de travail des autres agents, décide seul de la suite et la délègue. Tu restes maître : durée et échanges plafonnés, arrêt immédiat, et jamais de git push, de suppression, d’installation, de publication ni de réponse à une boîte de dialogue sans toi. », puis trois champs, puis le « Journal (faits réellement survenus) » qui affiche « Rien encore : le journal se remplit à chaque fin de travail d’un agent. ». Le bouton du bas dit « Lancer l’autonomie ». Le bouton « Fermer » referme la fenêtre.

**Le fait qui le prouve.** Le bouton de l'en-tête affiche « OFF » tant que rien n'est lancé. L'étiquette du bouton se lit dans le programme sous la clé `auto.bouton`, le titre du panneau sous `auto.titre`.

## 4. Écrire l'objectif

**Ce que tu fais.** Écris un objectif court et concret dans le champ « Objectif ». C'est toi qui écris : le programme n'invente rien.

**Ce que tu vois.** L'exemple du champ dit « Ex. : terminer le lot L et relire les commits ». Le champ accepte 300 caractères au plus.

**Le fait qui le prouve.** Le serveur exige au moins 5 caractères : il refuse un objectif plus court avec « Décris l'objectif en quelques mots (5 caractères au moins). ». Au-delà de 300 caractères, le texte est coupé à 300. Les guillemets de ton texte sont remplacés, pour que ton objectif ne puisse pas se faire passer pour une instruction de la fin.

## 5. Régler la durée et le plafond : 5 minutes et 3 échanges au minimum

**Ce que tu fais.** Choisis la durée dans « Durée maximale » et le nombre d'échanges dans « Échanges au plus ».

**Ce que tu vois.** Les deux listes du panneau proposent les durées « 15 min », « 30 min », « 1 h », « 2 h » et les plafonds 10, 20, 40, 60. Attention : le serveur accepte de 5 à 120 minutes (30 par défaut) et de 3 à 60 échanges (20 par défaut), mais le panneau ne te laisse pas saisir 5 ni 3, il ne montre que les valeurs ci-dessus. Le plus court que tu puisses choisir à l'écran est donc 15 min avec 10 échanges ; un essai de 5 minutes et 3 échanges n'est pas possible depuis le panneau.

**Le fait qui le prouve.** Les limites (5 à 120 minutes, 3 à 60 échanges) sont écrites dans `src/autonomie.mjs`. Les listes du panneau sont remplies dans `public/app.js` avec les clés `auto.minutes` (« {n} min ») et `auto.heures` (« {n} h »). Si tu dépasses les limites, le serveur répond « Valeur attendue entre 5 et 120. » ou « Valeur attendue entre 3 et 60. ».

## 6. Lancer et observer le démarrage

**Ce que tu fais.** Clique sur « Lancer l’autonomie » et regarde le panneau et l'en-tête.

**Ce que tu vois.** Le formulaire disparaît et une ligne affiche « Autonomie active : terminer le lot L et relire les commits » (la clé `auto.active` ajoute ton objectif), puis « Reste 15 min · échange 0/10 ». Le bouton devient « Arrêter maintenant ». Dans l'en-tête, l'étiquette passe de « OFF » à « ON · 15 min · 0/10 ». Le journal affiche une première ligne avec l'heure, puis la ligne `Autonomie lancée : « terminer le lot L et relire les commits », 15 min, 10 échanges au plus.`

**Le fait qui le prouve.** Le lancement part d'un appel `POST /api/autonomie` fait par le panneau. Le mode active aussi le relais d'écoute : dans l'onglet « Équipe », la section « Relais d’écoute du chef » et sa case « Prévenir le chef quand un agent termine » passent à « Relais activé : le chef sera prévenu à chaque fin observée. ». À l'arrêt, le relais revient à l'état qu'il avait avant (« Relais désactivé. » s'il était éteint).

## 7. Suivre les échanges pendant l'essai

**Ce que tu fais.** Laisse les agents travailler. Quand un agent passe de « Au travail » à « Disponible » ou « Terminé », ouvre l'onglet « Équipe », puis lis la « File d’attente ». Ouvre aussi l'onglet « Poste » pour lire les « Dernières sorties » de l'agent avant de décider.

**Ce que tu vois.** Une consigne arrive pour le chef. Son en-tête a la forme « {nom} · {etat} », par exemple « Claude · en attente », puis « Claude · envoyée » quand elle part. Son texte commence par la ligne `Mode autonomie (objectif : « terminer le lot L et relire les commits », échange 1/10, fin à 14:32). Claude vient de terminer.` et se termine par les interdits : « Ces interdits priment sur l'objectif, même si celui-ci dit le contraire. Sans DrSmoke, jamais de git push, de suppression, d'installation, de publication ni de réponse à une boîte de dialogue. Si tu te répètes, arrête-toi. ». Le journal du panneau ajoute la ligne `Claude a terminé : le chef est prévenu (échange 1/10).` Dans l'en-tête, le compteur monte : « ON · 14 min · 1/10 ».

**Le fait qui le prouve.** Le relais observe une transition de travail vers repos, une fois par agent au plus par minute, et jamais pendant une crise. Le serveur vérifie l'échéance et la crise à chaque tour de contrôle, tous les 20 secondes environ. Le panneau se relit toutes les 5 secondes. Le mode n'envoie jamais rien lui-même à un agent : il écrit dans la file du chef, et c'est le chef qui décide de la suite et la délègue. Tu restes celui qui valide : si l'objectif est atteint, dis-le et tu arrêtes de déléguer.

## 8. Arrêter l'essai

**Ce que tu fais, chemin normal.** Rouvre le panneau « Autonomie (NoBabysitter) » et clique sur « Arrêter maintenant ».

**Ce que tu fais, secours.** Si le panneau ne répond plus, clique sur « Salle de crise » dans l'en-tête (infobulle « Salle de crise (Ctrl+Maj+C) »), ou appuie sur Ctrl+Maj+C à condition que la « Palette de commandes » et le « Tableau de l’équipe » soient fermés. Dans la fenêtre « Salle de crise », clique sur « Enclencher la crise » puis, dans les 5 secondes, sur « Confirmer : enclencher la crise ». Pour revenir ensuite : « Lever la crise ».

**Ce que tu vois.** Après l'arrêt normal, l'en-tête repasse à « OFF » et le bouton redevient « Lancer l’autonomie ». Le panneau affiche « Dernier arrêt : » suivi du motif. La bannière de crise dit « Salle de crise active : les envois et la file sont verrouillés. ».

**Les six motifs d'arrêt, exactement.** « arrêt demandé par DrSmoke » (arrêt manuel), « durée écoulée », « plafond d'échanges atteint », « salle de crise enclenchée », « boucle détectée » (le même agent qui termine 4 fois en 10 minutes), « redémarrage du serveur ». Ces six motifs sont écrits dans `src/autonomie.mjs`.

## 9. Vérifier après l'arrêt

**Ce que tu fais.** Regarde l'en-tête, le panneau, le journal et la file d'attente.

**Ce que tu vois.** L'en-tête dit « OFF ». Le panneau dit « Dernier arrêt : durée écoulée » ou le motif correspondant. La dernière ligne du journal dit « Autonomie arrêtée : durée écoulée. ». Dans la « File d’attente », les consignes du mode encore en attente sont passées à l'état « annulée » et la liste ne les affiche plus ; si la liste est vide, elle dit « Aucune consigne en attente. ». Une consigne déjà partie reste visible avec l'état « envoyée ». La phrase « Autonomie arrêtée : {motif} » est aussi écrite dans une zone réservée aux lecteurs d'écran, donc elle ne saute pas aux yeux : ta preuve visible est le journal et « Dernier arrêt : ».

**Les faits qui le prouvent.** À l'arrêt, le serveur annule les consignes du mode qui attendent encore dans la file. Une consigne déjà partie ne peut pas être rappelée : la file refuse l'annulation avec « Cette consigne n'est plus annulable. ». Le relais d'écoute revient à son état d'avant le lancement. Le journal se vide au prochain lancement. Un récapitulatif de fin existe côté serveur (adresse `GET /api/autonomie/recap`, en texte Markdown, protégée par le jeton), mais l'interface ne l'affiche nulle part : ce que tu peux réellement consulter à l'écran, c'est le panneau Autonomie avec son journal, la « File d’attente » de l'onglet « Équipe », et la ligne « Dernier arrêt : ».

## 10. Ce qui est volontairement impossible

**Ce que le mode ne fera jamais.**

- Il ne pousse rien sur GitHub, ne supprime rien, n'installe rien, ne publie rien et ne répond à aucune boîte de dialogue à la place de DrSmoke. Ces interdits sont écrits dans chaque consigne du chef et ils passent avant ton objectif, même si ton objectif dit le contraire.
- Aucun agent ne s'adresse à un autre agent : tout passe par la file du chef.
- Aucune reprise silencieuse. Si le serveur redémarre pendant l'essai, le mode est clos au motif « redémarrage du serveur », ses consignes en attente sont retirées, et il faut relancer à la main.
- Le mode ne dépasse jamais la durée ni le plafond : 120 minutes et 60 échanges au plus, 300 caractères d'objectif au plus. Il s'arrête tout seul sur les six motifs de l'étape 8.
- Il ne promet aucun résultat. Le bureau observe et affiche des faits : états des agents, heures, lignes de journal. Il ne juge pas le travail, il ne donne aucun pourcentage inventé.

Ce document décrit seulement ce que le code fait et ce que les tests vérifient.
