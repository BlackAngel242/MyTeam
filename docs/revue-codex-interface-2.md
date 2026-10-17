# Deuxième revue du code d'interface

17 octobre 2026. Comparaison demandée : `git diff 7a31b20 -- public/`, complétée par la lecture du code actuel. HEAD observé : `5829d11`, avec des modifications de travail en cours par les autres agents. Les lignes ci-dessous désignent le code actuel, pas les positions dans le diff. Aucun fichier de `public/`, aucun serveur ni aucun agent réel modifié ou commandé.

La revue utilise les méthodes de revue de code et d'audit Impeccable. Les scénarios signalés comme reproduits ont été exécutés en mémoire avec des fonctions extraites du fichier, un faux document ou une fausse horloge, sans requête réseau. Les autres sont des constats de lecture, avec vérification proposée. Plusieurs fonctions existaient déjà à `7a31b20` : leur présence dans cette revue ne signifie pas qu'elles ont été introduites par le dernier diff.

## G1. Grave : le retour d'une mise en file efface le brouillon d'un autre poste

**Ligne :** `public/app.js:519`, gestionnaire de `prompt-form`, avec `selectAgent:455` et suivantes.

**Scénario reproduit :** mettre une consigne en file pour A, puis sélectionner B pendant l'attente réseau. Au retour de A, le code vide sans condition le champ actuellement affiché et montre le résultat de A sous le poste B. Le brouillon de B peut encore exister en mémoire, mais son champ devient vide et la prochaine saisie peut remplacer ce brouillon. La branche d'envoi direct possède déjà le contrôle `target===selected`, contrairement à la mise en file.

**Correctif :** capturer la cible et le texte avant l'appel. Retirer seulement le brouillon envoyé de A ; modifier le champ et le résultat uniquement si A reste sélectionné. Appliquer la même règle en cas d'erreur. Pour une réponse perdue, signaler un résultat incertain et vérifier la file avant toute nouvelle tentative ; une répétition automatique exige une clé de demande partagée avec le serveur. Ce problème était déjà présent dans la branche de file à la référence.

## G2. Grave : les lectures protégées ne s'accordent pas avec le contrôle d'origine

**Lignes :** `public/app.js:18-23`, `112`, `137`, `176-185` ; raccordement lu dans `server.mjs:82-85`, `112-118`, `214-215`.

**Scénario :** les lectures de file, tâches et lieux sont des GET avec le jeton. Une requête GET ordinaire du navigateur vers la même origine ne fournit normalement pas l'en-tête `Origin`, alors que `guard` exige sa présence exacte, même pour ces GET. Une session au jeton valable reçoit donc le message « Session expirée ». Actualiser régénère les mêmes GET et ne corrige pas cette incompatibilité. Les tests qui fabriquent explicitement un en-tête Origin ne reproduisent pas cette situation du navigateur.

**Correctif :** convenir avec OpenCode d'un contrôle de provenance adapté aux GET du navigateur, en conservant le jeton, l'hôte exact et le refus des origines étrangères. Par exemple, vérifier une origine présente, sinon la provenance locale exacte via les métadonnées du navigateur et le référent, avec refus si la preuve manque. Autre possibilité à contractualiser : des routes de lecture POST protégées. Ne pas tenter d'imposer `Origin` dans JavaScript, cet en-tête est contrôlé par le navigateur. Ajouter un essai Playwright non intercepté, sans envoi ni transfert. Défaut de raccordement déjà présent à la référence, toujours visible dans les sources lues ; pas de contournement du jeton identifié.

## M1. Moyen : la palette annoncée modale ne gère pas le focus comme un dialogue modal

**Lignes :** `public/index.html:125-127` ; `public/app.js:1176-1192`, `1095-1104`, `1136-1142`.

**Scénario :** Ctrl+K place le focus dans le champ, mais Tab peut quitter la palette puisque le fond n'est ni inerte ni exclu du parcours. Échap masque simplement le conteneur ; le focus reste sans destination explicite. Une commande qui ouvre un onglet ne place pas nécessairement le focus dans son contenu. Si Disposer est actif, son premier écouteur Échap se déclenche aussi avant celui de la palette : une touche ferme deux états. Les flèches sur les onglets peuvent également déplacer un poste par propagation jusqu'à l'écouteur Disposer. Enfin, l'aide de première visite peut s'ouvrir après 900 ms et prendre le focus au milieu d'une saisie ou d'une palette déjà ouverte.

**Correctif :** gérer une seule couche active et donner la priorité à la couche supérieure. Mémoriser le déclencheur, contenir Tab dans le dialogue, rendre le fond inerte pendant son ouverture, puis restaurer le focus à la fermeture ou le déplacer vers la destination de la commande. Donner au champ un libellé explicite et une sémantique de sélection cohérente avec sa liste. Réserver les flèches de disposition à la scène et ignorer les événements déjà traités, la composition de texte, les champs éditables et les autres couches. Pour l'aide non modale sur ordinateur, garder un chemin explicite de retour ; sur téléphone où elle recouvre la page, gérer une couche modale. Ne pas ouvrir automatiquement l'aide lorsque l'utilisateur a déjà commencé une action. Palette et ouverture automatique existaient déjà ; les nouvelles flèches Disposer ajoutent un conflit.

## M2. Moyen : relire un ancien horaire repousse la pause au lendemain

**Lignes :** `public/app.js:285-294`, `302-305`, `504-505`.

**Scénario reproduit :** le terminal conserve « try again at 4:45 PM ». À 16:44, `parseClock` retourne aujourd'hui à 16:45. À 16:46:01, la relecture de la même ligne retourne demain à 16:45. Le bureau peut donc remettre l'agent en pause pendant presque une journée sans nouvelle annonce. Un horaire portant un fuseau explicite est aussi interprété avec l'heure locale, car le suffixe n'est pas traité. Les heures et minutes hors limites ne sont pas refusées avant `setHours`.

**Correctif :** rattacher l'annonce à sa première observation ou, de préférence, à une date du journal ; mémoriser l'échéance plutôt que la reconstruire à chaque lecture. Une ligne inchangée ne crée pas une nouvelle journée. Valider les bornes et conserver le fuseau explicite quand il est connu ; si la date ou le fuseau reste ambigu, ne pas inventer une échéance précise. Ajouter des cas avant/après minuit et après expiration. Fonction déjà présente à la référence.

## M3. Moyen : la nouvelle identification des limites transforme une journée en semaine

**Lignes :** `public/app.js:299-302`.

**Scénario :** `l.window>=1440` est traduit par « hebdomadaire ». Or 1440 minutes correspondent à 24 heures, et 2880 à deux jours. La correction destinée à expliquer le quota peut donc afficher une durée fausse. De plus, le calcul de retour inclut toutes les limites dès que `act.limitReached` est vrai, y compris une limite non atteinte dont la remise à zéro serait beaucoup plus tardive.

**Correctif :** utiliser le libellé fourni par la source, ou formater la durée effective en minutes, heures ou jours sans lui attribuer arbitrairement une semaine. Retenir les échéances des limites réellement bloquantes. Si la source ne permet pas d'identifier laquelle bloque, le dire au lieu de choisir une réserve non épuisée. Tester 300, 1440 et 10080 minutes, puis deux limites dont une seule est atteinte. L'identification textuelle est nouvelle dans le diff ; le calcul trop large de l'échéance existait déjà.

## M4. Moyen : les sons et les nouvelles icônes ne sont jamais chargés

**Lignes :** `public/index.html:10-12` ; `public/app.js:105-108`, `1117-1133` ; liste statique de `server.mjs:229`.

**Scénario confirmé en lecture :** `public/sounds.js` et `public/empty-icons.js` figurent dans le diff, mais le HTML ne charge que logos, terminal et app. Aucun chargement dynamique de ces deux modules n'est présent dans app. La liste des fichiers servis ne les expose pas non plus. Le bouton affiche donc « Sons : module absent » et les encarts n'obtiennent pas leurs icônes. Leur présence sur disque ne suffit pas.

**Correctif :** charger les deux scripts classiques avant app, avec `defer`, et faire ajouter leurs routes statiques exactes par le propriétaire du serveur. Conserver les replis actuels si un module manque. Vérifier les réponses 200 et la présence des objets globaux avant d'annoncer la fonction intégrée. Aucun son réel déclenché pour cette revue.

## M5. Moyen : les notifications attendent des événements que l'arrière-plan ne surveille plus

**Lignes :** `public/app.js:547-553`, `985-986`, `1117-1120`, `1194-1197`.

**Scénario :** les notifications Windows sont autorisées seulement si `document.hidden` est vrai. Mais le rafraîchissement des agents et des sorties s'arrête précisément dans ce cas. Les changements ne sont donc normalement découverts qu'au retour au premier plan, où l'envoi de notification est refusé. Une requête déjà en vol au moment du changement d'onglet peut exceptionnellement en produire une, ce qui rend le fonctionnement trompeur.

**Correctif :** séparer la collecte des changements et le dessin. Continuer une collecte raisonnable en arrière-plan quand les notifications sont activées, sans animer la scène ; traiter les transitions à la réception des données. Ne pas promettre une notification ponctuelle lorsque le navigateur suspend la page. Garder la permission explicite et dédupliquer les événements. Nouveau raccordement de signaux sur une politique de rafraîchissement préexistante.

## M6. Moyen : les rafraîchissements détruisent le focus et peuvent réafficher des résultats anciens

**Lignes :** `public/app.js:66`, `97-103`, `110-137`, `119-128`, `1194-1196`.

**Scénario :** sans sélection, les boutons de l'invitation sont recréés toutes les trois secondes, sans restaurer le bouton focalisé comme le fait la liste principale. La file recrée ses boutons Retirer et les erreurs recréent leur bouton Actualiser toutes les cinq secondes. Le focus est perdu et `role=alert` peut annoncer la même panne en boucle. En parallèle, file et tâches n'ont ni verrou de lecture ni numéro de génération : avec une réponse lente, plusieurs GET se chevauchent et une ancienne réponse peut remplacer une plus récente, notamment après une annulation.

**Correctif :** ne remplacer que les contenus modifiés ; préserver le focus avec une clé stable pour invitation et éléments de file. Ne réannoncer une erreur que si elle change. Partager la lecture en cours et ignorer les réponses dont la génération ou le jeton ne correspond plus à l'état courant ; invalider une ancienne lecture après annulation. Séparer données conservées et données périmées pendant une panne. Recréation de l'invitation et encarts d'erreur nouveaux ; absence de séquençage déjà présente pour les lectures.

## M7. Moyen : l'historique affiché est borné, mais les collections en mémoire continuent de grandir

**Lignes :** `public/app.js:282`, `479`, `544`, `950-985`.

**Scénario :** `mailLog.slice(0,30)` limite seulement les lignes dessinées ; chaque fin de travail continue d'ajouter une entrée au tableau. `seenDelegations` garde aussi tous les identifiants de courrier et de délégation depuis l'ouverture. `statusCache` conserve les agents disparus ; `pausedSeen` conserve ceux qui disparaissent pendant une pause. Après une longue session avec des remplacements, mémoire et coût de certains parcours augmentent sans plafond. Il ne s'agit pas d'une fuite démontrée à chaque image, mais d'une rétention non bornée vérifiable dans les sources.

**Correctif :** borner réellement le journal en mémoire, supprimer les caches des identifiants absents d'une liste connectée et appliquer une durée de conservation aux événements vus. Si le compteur doit représenter toute la session, le garder séparément du détail limité. Les collections de courrier existaient déjà ; le cache de pauses est nouveau.

## M8. Moyen : la réduction des mouvements ne s'applique pas au canvas

**Lignes :** `public/app.js:8-11`, `460`, `1114` ; règle finale `prefers-reduced-motion` de `public/style.css`.

**Scénario :** la préférence système est lue, mais ne sert qu'au défilement lors de la sélection mobile. `paused` dépend seulement du stockage local. La règle CSS qui coupe les animations ne coupe pas les déplacements dessinés en JavaScript ; une première visite avec mouvements réduits conserve donc personnages et trajets animés.

**Correctif :** distinguer préférence explicite et préférence système, calculer une réduction effective pour tous les mouvements du canvas, puis réagir au changement de préférence. Continuer à actualiser l'heure, les états et le cycle de lumière sans trajets animés. Ne pas multiplier les chaînes `requestAnimationFrame` lors d'un changement. Défaut préexistant, toujours applicable aux nouveaux effets.

## M9. Moyen : Agrandir ne donne pas plus de hauteur sur téléphone

**Lignes :** `public/app.js:352` ; `public/style.css:238-239`, `726` et suivantes.

**Scénario :** cliquer Agrandir ajoute `term-expanded` et masque les informations. Mais la règle mobile `#output` impose toujours `min-height:180px;max-height:340px` et gagne par priorité sur `.term-expanded pre`. Le bouton peut donc indiquer Réduire alors que le terminal conserve sa hauteur limitée. Ce conflit concerne aussi les règles mobiles proposées par Codex puis intégrées.

**Correctif :** ajouter après les règles mobiles une règle explicite `.term-expanded #output` avec les hauteurs voulues pour cette vue, en tenant compte du clavier et de la hauteur disponible. Vérifier que les informations utiles sont restaurées à la réduction et que le focus reste visible. Nouveau conflit du diff, sans correction de source dans cette revue.

## Contrôles sans défaut retenu et limites

- **Injection HTML :** pas d'usage de `innerHTML`, `outerHTML`, `insertAdjacentHTML` ou d'exécution de texte serveur trouvé dans app. Noms, tâches, messages de file, erreurs et commandes passent par des nœuds et `textContent`. Le rendu du terminal possède un repli texte. Les sélecteurs dynamiques de cibles utilisent `CSS.escape`. Aucun défaut d'injection HTML retenu.
- **Envoi groupé :** la confirmation compare les identifiants et le texte exact avant l'envoi. Une liste modifiée ne déclenche pas immédiatement l'ancienne confirmation. Cela ne remplace pas les contrôles serveur.
- **Cycle jour-nuit :** simulation réussie entre 23:59:59 et 00:00:00 : lumière identique et position lunaire continue. `Date` suit le fuseau du poste ; lever et coucher fixes sont une approximation écrite dans le code, pas un calcul astronomique. Aucun défaut de passage de minuit retenu pour ce cycle.
- **Salle repliable :** le calcul de hauteur et la suppression de la table suivent `roomOpen`. Le premier dessin d'une arrivée ou d'un départ peut précéder la synchronisation des acteurs, mais aucun emballement certain du `ResizeObserver` n'est démontré. Ne pas confondre la chaîne d'animation attendue avec une création de nouvelles chaînes à chaque rendu.
- **Vérifications exécutées :** deux reproductions en mémoire confirmées, un contrôle de continuité à minuit réussi, absence des deux scripts confirmée, `node --check public/app.js` et `node --check public/sounds.js` réussis. Pas de fichier de test ajouté, pas d'envoi, de notification système, de son ni de transfert réel.
- **À vérifier après correction :** parcours Tab et Échap des couches, champs en composition de texte, lectures non interceptées dans le navigateur, réponses lentes inversées et agrandissement à 360/390 px. Aucun test interactif nouveau revendiqué par cette revue.
