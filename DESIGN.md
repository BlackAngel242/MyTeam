# Apparence du bureau

Direction choisie par DrSmoke : personnages en pixels dans un bureau bleu nuit, construction directe. Ce choix explicite prime sur le tirage Impeccable ba708317.

La scène occupe la partie principale et montre des postes correspondant aux agents réellement détectés. Une liste de boutons offre la même sélection au clavier. Le panneau de droite contient les sorties et une seule action principale : envoyer la prochaine consigne.

Couleurs : fond #0c1423, surfaces #111e31, texte #f2f4f7, texte secondaire #a7b8ce. Menthe #a0dfc4 pour la disponibilité, bleu #9dbbff pour le travail, ambre #f4c780 pour l'attente. Chaque état a aussi son libellé français.

Typographie locale Bahnschrift, repli Segoe UI. Texte fonctionnel d'au moins 12 px. Consolas uniquement pour les sorties de terminal. Aucun chargement de police externe.

Personnages, postes et décor calculés dans un canvas. Les mouvements de frappe reflètent seulement le statut de travail. Les mouvements peuvent être arrêtés et respectent la réduction des animations du système. La scène s'allonge si les agents sont nombreux.

Sur petit écran, le panneau de lecture passe sous le bureau. Les longs chemins et sorties peuvent revenir à la ligne. Les boutons de sélection restent disponibles indépendamment de la scène.

## Scène, deuxième version (17 octobre 2026)

Rendu en basse résolution (256 px de large sur ordinateur, 144 px sur téléphone en deux colonnes), puis agrandi d'un facteur entier : chaque pixel reste net. Tous les textes de la scène utilisent une police pixel dessinée à la main, en capitales sans accents.

Lumière : la nuit vient du décor, la lumière vient des écrans. Chaque écran projette au sol une lueur par paliers dans la couleur de l'état. Le poste sélectionné reçoit une flaque menthe, le survol une flaque claire.

Mur : baie vitrée dont le ciel suit l'heure réelle de l'ordinateur (nuit, aube, jour, crépuscule), tableau des effectifs avec les vrais comptes, horloge réelle, enseigne, baie HERDR dont les voyants clignotent seulement quand le bureau est relié à Herdr.

Postes : façade du bureau portant l'emblème de l'outil (public/logos.js, dessiné par Codex). Posture selon l'état réel : frappe au travail, main levée et bulle « ? » en attente de DrSmoke, mug quand il est disponible, coche quand il a terminé, bulle « … » pour un état inconnu. Libellés nom et état en toutes lettres sous chaque poste. Petite fête de quatre secondes seulement après un passage observé de travail à disponible ou terminé. Les sous-agents actifs de Claude apparaissent en petits assistants, d'après son transcript local.

Couleurs d'identité des personnages : #d98a74, #9b86e0, #d17aa6, #a3b05f, #b5654f, #7e5fa8. Elles ne reprennent jamais menthe, bleu ou ambre, réservés aux états.

Le titre de l'onglet compte les agents qui attendent DrSmoke. Mode plein écran sur le cadre du bureau.

Vérification Impeccable effectuée une fois. Tailles de texte corrigées. Le signalement du contour de l'avatar est un faux positif : il s'agit volontairement d'une géométrie en pixels, pas d'une forme organique imitée.
