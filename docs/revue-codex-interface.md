# Revue Codex de l’interface

Revue du 17 octobre 2026, en lecture seule pour `public/`. Aucun envoi vers un agent réel, aucune modification du serveur, aucune interruption de session. Seul ce rapport est créé.

## Résultat

Huit défauts retenus : deux de gravité élevée, quatre de gravité moyenne et deux de gravité faible. Aucun défaut d’injection HTML confirmé dans le parcours examiné. Aucun contournement confirmé de la nouvelle confirmation groupée ou du verrou d’envoi par agent.

Les numéros ci-dessous correspondent à la version examinée. L’interface ayant évolué pendant les premières lectures, les références ont été revérifiées sur la version identifiée à la fin du rapport.

## Gravité élevée

### 1. Les sorties de A peuvent être affichées ou copiées sous le nom de B

- **Lignes exactes :** `public/app.js:180` et `:182` changent de poste et affichent un message provisoire, sans vider `lastOutput`, déclaré à `:84`. La recherche réutilise ce texte à `:91` et `:92`, la copie à `:102`. Même conservation après fermeture à `:193`, après déconnexion à `:200` et après erreur de lecture à `:223`.
- **Scénario confirmé :** lire A, sélectionner B, puis rechercher ou copier avant la réponse de B. La recherche réaffiche le terminal de A avec le titre B ; Copier copie également A. Une erreur de lecture laisse ce problème présent.
- **Conséquence :** DrSmoke peut interpréter une erreur ou une demande d’autorisation comme provenant du mauvais agent.
- **Correctif proposé :** associer explicitement le texte à son identifiant d’agent, par exemple `{agentId, text, valid}`. Invalider cette association dès le changement de poste, sa disparition, la déconnexion ou une erreur. Recherche et copie doivent être indisponibles tant qu’aucune sortie valide ne correspond au poste courant. Vider aussi les anciens compteurs de recherche et la note d’extrait.
- **Vérification après correction :** retarder puis faire échouer la lecture de B ; aucune action ne doit réafficher ou copier A sous B.

### 2. Réessayer un envoi groupé partiel peut renvoyer la consigne aux agents déjà servis

- **Ligne exacte :** `public/app.js:173`. Le message et les destinataires sont supprimés uniquement si tous les résultats réussissent.
- **Scénario confirmé :** A reçoit la consigne et B échoue. A reste coché, comme B, avec le même message. Si A est encore disponible ou l’est redevenu au moment de réessayer, la nouvelle confirmation inclut A et lui transmet une seconde fois la consigne.
- **Conséquence :** une reprise destinée à B peut relancer un travail déjà confié à A. Le verrou serveur contre les envois simultanés ne bloque pas deux envois successifs.
- **Correctif proposé :** après réception des résultats, retirer de `broadcastTargets` chaque identifiant ayant `ok:true`, conserver uniquement les échecs et le message, puis désarmer la confirmation. Si la réponse globale est perdue, conserver un état « résultat inconnu » et demander de vérifier les terminaux avant toute reprise.
- **Vérification après correction :** simuler un succès pour A et un échec pour B ; la tentative suivante doit contenir uniquement B, même si A demeure disponible.

## Gravité moyenne

### 3. Le journal annonce « non transmise » alors que le résultat peut être inconnu

- **Lignes exactes :** `public/app.js:109` transforme toute valeur `ok:false` en « non transmise ». Les erreurs réseau ou délais dépassés sont enregistrés ainsi à `:174` et `:235`.
- **Scénario confirmé :** l’envoi expire sans réponse. Le message près du bouton avertit que la consigne a peut-être été reçue, mais le journal annonce « non transmise ».
- **Conséquence :** deux informations contradictoires peuvent inciter à répéter une consigne déjà reçue. Une erreur de Herdr après transmission peut avoir la même ambiguïté.
- **Correctif proposé :** remplacer le simple booléen du journal par trois résultats : « transmise », « refusée avant envoi », « résultat inconnu ». Un délai dépassé, une coupure réseau ou une réponse illisible doivent utiliser le troisième résultat. Ne pas assimiler automatiquement toute erreur à un refus prouvé.
- **Vérification après correction :** simuler une coupure après acceptation de la requête ; le journal doit indiquer « résultat inconnu », jamais garantir l’absence d’envoi.

### 4. Le focus clavier disparaît quand un destinataire devient occupé

- **Lignes exactes :** `public/app.js:145` recrée toutes les cases, `:147` désactive la nouvelle case devenue indisponible, puis `:153` essaie de lui rendre le focus. Le même manque de repli existe pour un bouton de poste supprimé à `:36` et `:47`.
- **Scénario confirmé avec document factice :** placer le focus sur la case A, puis actualiser A avec `ready:false`. L’ancienne case est retirée ; la nouvelle est désactivée et ne peut pas recevoir le focus. Celui-ci revient au corps de la page.
- **Conséquence :** la navigation au clavier perd sa position pendant un rafraîchissement automatique.
- **Correctif proposé :** conserver les éléments existants quand cela est possible. À défaut, restaurer le focus seulement si la cible existe et est active ; sinon choisir la prochaine case disponible ou l’onglet Équipe. Pour un poste disparu, choisir un poste voisin ou une commande stable. Ne pas déplacer le focus lorsque l’utilisateur était hors de la liste.
- **Vérification après correction :** pendant une navigation au clavier, rendre l’agent occupé puis le supprimer ; le focus doit rester visible sur une commande utilisable.

### 5. Une panne temporaire efface la sélection sans la rétablir

- **Lignes exactes :** `public/app.js:193` efface la sélection dès que la réponse ne contient plus le poste ; `:199` le fait également sur une erreur réseau. Aucune restauration n’a lieu à la prochaine réussite de `refreshState`.
- **Scénario confirmé :** A est sélectionné avec un brouillon. Une lecture de l’état renvoie `{connected:false, agents:[]}`, puis la suivante retrouve le même A. Le brouillon reste en mémoire mais le poste demeure désélectionné et le champ vide jusqu’à une nouvelle sélection manuelle.
- **Conséquence :** une indisponibilité de quelques secondes interrompt inutilement la lecture et peut donner l’impression que le brouillon a disparu.
- **Correctif proposé :** distinguer « liste indisponible » et « disparition confirmée dans une liste connectée ». Pendant une panne, conserver l’identifiant préféré et le brouillon, tout en désactivant les envois et en signalant l’absence de données fraîches. Restaurer uniquement le même identifiant complet au retour de la connexion, jamais un autre agent occupant le même panneau.
- **Vérification après correction :** déconnecter puis reconnecter la même session ; retrouver son poste et son brouillon. Remplacer sa session ; ne jamais reporter la sélection ou le brouillon sur son remplaçant.

### 6. Cliquer un poste depuis Équipe ne l’ouvre pas sur ordinateur

- **Ligne exacte :** `public/app.js:185`. `showTab('poste')` est exécuté uniquement si `innerWidth < 860`.
- **Scénario confirmé :** ouvrir Équipe sur ordinateur, puis cliquer le bouton ou le personnage B. B devient sélectionné, mais le panneau visible reste Équipe et le terminal de B reste caché.
- **Conséquence :** le clic ne produit pas l’ouverture attendue du poste, contrairement au parcours sur téléphone et au bouton d’alerte.
- **Correctif proposé :** appeler `showTab('poste')` pour toute sélection explicite d’un poste ; limiter seulement le défilement vers le panneau au téléphone. Traiter aussi le clic sur le poste déjà sélectionné, car le retour anticipé à `:178` empêcherait encore l’ouverture de Poste.
- **Vérification après correction :** depuis Équipe, cliquer le poste courant puis un autre, sur ordinateur et téléphone ; Poste doit devenir visible dans les deux cas.

## Gravité faible

### 7. Les anciennes sessions restent dans les cartes de mémoire sans limite

- **Lignes exactes :** `public/app.js:6` crée `drafts`, alimenté notamment à `:179`, `:193`, `:198` et `:226`. Seul un envoi réussi supprime son entrée à `:232`. `lastStatus` et `changes` sont créés à `:248` et alimentés à `:251`, sans purge des identifiants partis.
- **Constat par lecture du code :** les nouvelles sessions créent de nouveaux identifiants ; leurs brouillons et anciens états restent conservés pendant toute la vie de l’onglet. Le journal, lui, est correctement limité à trente entrées à `:106`.
- **Conséquence :** la mémoire croît au fil des remplacements de sessions. Aucun ralentissement mesuré n’est revendiqué dans cette revue.
- **Correctif proposé :** purger les cartes d’état pour les agents définitivement absents. Pour les brouillons, conserver un nombre maximal d’entrées ou une durée explicite, avec une politique qui protège les brouillons pendant les pannes temporaires. Ne pas purger sur une simple déconnexion.
- **Vérification après correction :** simuler de nombreux remplacements de sessions ; vérifier que les cartes restent bornées et qu’un brouillon actif n’est pas perdu.

### 8. Le statut annonce une actualisation alors que l’affichage est suspendu

- **Lignes exactes :** `public/app.js:88` suspend le rendu si du texte est sélectionné et annonce cette pause ; `:221` remplace immédiatement ce message par « Lecture actualisée » après le retour de `renderOutput`.
- **Scénario confirmé :** sélectionner du texte dans le terminal, puis recevoir de nouvelles sorties. Le texte visible reste inchangé, mais le statut annonce une actualisation.
- **Correctif proposé :** faire renvoyer à `renderOutput` un indicateur d’affichage effectif et n’annoncer « Lecture actualisée » que si le rendu a eu lieu. Distinguer éventuellement la réception des données de leur affichage.
- **Vérification après correction :** maintenir une sélection lors d’une nouvelle lecture ; le statut de pause doit rester visible jusqu’à la reprise effective.

## Points contrôlés sans défaut confirmé

- **Injection HTML :** aucun usage de `innerHTML`, `outerHTML`, `insertAdjacentHTML` ou `document.write` relevé dans `public/app.js`. Les noms, dossiers, descriptions de sous-agents, erreurs et résultats d’envoi sont affectés à `textContent`. Le rendu de terminal délégué à `TerminalView` crée des nœuds texte et des éléments, sans interpréter le texte comme du HTML. Les noms dessinés sur le canvas ne deviennent pas du HTML.
- **Confirmation groupée :** `public/app.js:164`, `:166` et `:167` recalculent les identifiants disponibles et le message. Si la liste change après le premier clic, le clic suivant réarme la confirmation sans envoyer. Ce comportement a été confirmé par simulation. Le libellé armé pourrait être remis à zéro plus tôt, mais aucun envoi vers une liste différente n’a été démontré sans nouvelle confirmation.
- **Double envoi simultané :** les verrous locaux existent à `public/app.js:165` et `:228`. Le verrou par identifiant de `src/herdr.mjs:58`, partagé avec le parcours groupé, protège aussi le croisement des deux modes. Cela ne résout pas le renvoi successif après un résultat partiel, décrit au défaut 2.
- **Onglets et noms accessibles :** relations `role="tablist"`, `role="tab"`, `aria-controls`, `aria-labelledby` et panneaux masqués présents dans `public/index.html:42` à `:55`. Mise à jour d’`aria-selected`, du `tabIndex` et navigation par flèches à `public/app.js:76` à `:81`. Les commandes principales ont un texte accessible ; le canvas a une alternative dans la liste de postes. Les contours de focus sont définis à `public/style.css:6`.
- **Absence de logos.js :** `public/app.js:132` et `:134` prévoient l’absence de `window.AGENT_LOGOS` ; les boutons et avatars ont un repli. La scène utilise une initiale à `:401`.
- **Absence de terminal.js :** `public/app.js:91` et `:92` gardent un affichage par `textContent`, sans exception attendue lorsque le module manque. Le surlignage avancé est alors absent. Une exception du module est également interceptée.
- **Boucles de rendu :** une seule chaîne `requestAnimationFrame` est démarrée à `public/app.js:456` et `:457`. Le délai et la pause limitent le dessin. Aucun emballement du `ResizeObserver` ni multiplication de chaînes n’a été démontré. La conservation sans borne des cartes reste le défaut de mémoire identifié.

## Vérifications et limites

Deux lectures complémentaires ont été réalisées : parcours/accessibilité et sécurité/états. Sept scénarios défectueux ont été reproduits avec Node, un document minimal et des requêtes entièrement factices ; un huitième scénario a confirmé la protection de la confirmation face à une liste modifiée. La croissance potentielle des cartes est un constat de code, pas une mesure en navigateur.

Les simulations n’ont lu ni envoyé de consigne à Herdr. Elles n’ont démarré aucun serveur. Aucun test de lecteur d’écran, aucune mesure de mémoire en navigateur et aucune validation visuelle sur téléphone ne sont revendiqués. Le détecteur Impeccable a été tenté une fois mais son lancement a été refusé par Windows (`spawn EPERM`) ; aucun résultat automatique n’est présenté comme obtenu.

Empreintes SHA-256 des fichiers examinés :

| Fichier | Empreinte |
|---|---|
| `public/index.html` | `7eed996152c380d99798d97ff14dfc6c2dfc44a8af7554fd5c96a7573992311d` |
| `public/app.js` | `5bc2bce74d705570da0faee6b72ccc7bfbc0a99a3006baec9172a5908918db0d` |
| `public/style.css` | `31b5cd148b1a8e456208c658fc58550c4a79387d7671d3c339afc6ded6ba533a` |

Signature : DrSmoke « Un Mbokatié engagé ».
