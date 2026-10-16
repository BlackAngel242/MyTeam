# Apparence du bureau

Direction choisie par DrSmoke : personnages en pixels dans un bureau bleu nuit, construction directe. Ce choix explicite prime sur le tirage Impeccable ba708317.

La scène occupe la partie principale et montre des postes correspondant aux agents réellement détectés. Une liste de boutons offre la même sélection au clavier. Le panneau de droite contient les sorties et une seule action principale : envoyer la prochaine consigne.

Couleurs : fond #0c1423, surfaces #111e31, texte #f2f4f7, texte secondaire #a7b8ce. Menthe #a0dfc4 pour la disponibilité, bleu #9dbbff pour le travail, ambre #f4c780 pour l'attente. Chaque état a aussi son libellé français.

Typographie locale Bahnschrift, repli Segoe UI. Texte fonctionnel d'au moins 12 px. Consolas uniquement pour les sorties de terminal. Aucun chargement de police externe.

Personnages, postes et décor calculés dans un canvas. Les mouvements de frappe reflètent seulement le statut de travail. Les mouvements peuvent être arrêtés et respectent la réduction des animations du système. La scène s'allonge si les agents sont nombreux.

Sur petit écran, le panneau de lecture passe sous le bureau. Les longs chemins et sorties peuvent revenir à la ligne. Les boutons de sélection restent disponibles indépendamment de la scène.

Vérification Impeccable effectuée une fois. Tailles de texte corrigées. Le signalement du contour de l'avatar est un faux positif : il s'agit volontairement d'une géométrie en pixels, pas d'une forme organique imitée.
