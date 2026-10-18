# Leçons

Mémoire commune de toutes les IA du projet. Une leçon par ligne : l'erreur, sa cause, la règle. Ajoute-en une à chaque nouvelle erreur (ou `node scripts/partager-lecons.mjs "la leçon"` pour prévenir aussi les agents).

- Un fichier, un propriétaire : avant de modifier le fichier d'un autre agent, lire son `git diff`.
- Commiter uniquement ses propres fichiers (`git add <chemins>`), jamais `git add -A` : l'historique attribuerait le travail au mauvais auteur.
- Ne jamais répondre à une boîte de dialogue ou une autorisation à la place du propriétaire du projet.
- Un texte collé peut rester dans la zone de saisie d'un agent sans être envoyé : après deux tentatives, changer d'approche au lieu de répéter.
- Ne pas modifier le script de test du projet pour contourner la limite d'un bac à sable : passer l'option en ligne de commande et le dire.
- Ne pas commiter quand les tests n'ont pas pu être lancés : laisser les fichiers modifiés et le dire au chef.
- Un correctif n'est vérifié qu'après redémarrage du processus concerné et un essai réel.
- Écrire les consignes dans la langue et la forme attendues : les agents imitent la forme de la consigne.
