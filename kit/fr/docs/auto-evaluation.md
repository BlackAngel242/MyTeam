# Auto-évaluation

Avant de dire « terminé », chaque IA (et le chef avant de fusionner) répond à ces questions, en s'appuyant sur des faits.

1. Les contrôles du projet ont-ils tourné, et lesquels ? (`node scripts/evaluer.mjs` les lance et résume.)
2. Ai-je essayé le résultat pour de vrai (lancé, cliqué, appelé), pas seulement relu le code ?
3. Qu'est-ce que je n'ai pas pu vérifier ? (Le dire dans le compte rendu.)
4. Ai-je modifié seulement mes fichiers ? (`git status`, `git diff`.)
5. Ai-je inventé quelque chose (valeur, état, pourcentage) ? Si oui, le retirer.
6. Une erreur s'est-elle produite ? A-t-elle une ligne dans `LESSONS.md` ?
7. `.myteam-local/HANDOFF.md`, `.myteam-local/JOURNAL.md` et la case du plan sont-ils à jour ?

## Pour le chef : évaluer le travail d'un agent

- Relire le commit (`git show`), pas seulement le compte rendu.
- Relancer les contrôles soi-même, ne pas se fier à « ça passe chez moi ».
- Si un défaut est trouvé : corriger ou renvoyer avec la raison, puis partager la leçon (`node scripts/partager-lecons.mjs "la leçon"`).
- Cocher la case seulement quand tout est vérifié.
