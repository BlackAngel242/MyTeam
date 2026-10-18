# Fixit d'équipe : la revue en famille

Méthode voulue par DrSmoke le 18 octobre 2026, tirée du skill Fixit de Codex et étendue à tous les agents et à tous les domaines : code, interface, communication, psychologie, documentation. L'équipe grandit ensemble : chacun apprend des autres, comme une famille.

## Quand l'appliquer

- Avant de livrer un travail important, et chaque fois que le chef évalue une livraison.
- Quand quelqu'un écrit « Fixit », « revue en famille » ou demande un avis croisé.
- Une revue n'autorise ni réécriture hors sujet, ni push, ni publication : elle propose, l'équipe décide, le chef fusionne.

## 1. Composer le panel : de 2 à 4 profils selon le contexte

Les profils s'adaptent à ce qui est examiné. Un même agent peut jouer plusieurs profils ; les sous-agents sont facultatifs. Ce sont des regards, pas du théâtre : le compte rendu dit ce qui a réellement été contrôlé.

| Profil | Question qu'il pose | Exemples selon le contexte |
|---|---|---|
| Expert | Est-ce juste dans le métier ? | Code : langage, sécurité, tests. Interface : composition, hiérarchie, accessibilité. Texte : accroche, storytelling. |
| Senior | Est-ce durable et sans surprise ? | Architecture, dette, risques, cohérence avec l'existant validé, coût de maintenance. |
| Junior | Qu'est-ce que je ne comprends pas ? | Lisibilité, noms, étapes manquantes, jargon, première utilisation. |
| Lambda | Est-ce clair en trois secondes pour quelqu'un qui n'est pas du métier ? | Utilisateur ordinaire, lecteur pressé, mobile et grand écran, crédibilité. |

Pour la communication ou la psychologie, remplacer ou ajouter un profil adapté (rédacteur, lecteur sceptique, regard de psychologie inversée) ; pour une interface, ajouter un profil produit. Choisir au moins 2 profils, au plus 4.

## 2. Procédure

1. **Partir de l'existant validé** : identifier le support, la version exacte, le public, l'objectif, les décisions déjà adoptées (`git log`, `HANDOFF.md`, plan, `LESSONS.md`). Une option est peut-être déjà adoptée.
2. **Examiner le résultat réel**, jamais seulement le code ou la mémoire : ouvrir la capture, la page, le fichier, lancer la commande. Pour une interface : ordinateur et téléphone, chacun avec sa conclusion.
3. **Chaque profil relève ses défauts séparément**, avec une preuve observée, classés BLOQUANT, IMPORTANT ou OPTIONNEL.
4. **Auto-critique** : chaque profil conteste ses propres constats puis ceux des autres (« est-ce un fait ou un goût ? »). Ce qui ne résiste pas est retiré.
5. **Suggestions d'amélioration** : chaque profil propose, avec la raison et le coût. Les idées d'innovation hors du domaine de l'auteur sont bienvenues.
6. **Consensus** : une correction est adoptée quand la majorité des profils l'approuve et qu'aucune objection bloquante n'est restée sans réponse. À 2 profils, les deux doivent approuver. Un désaccord est consigné avec ses raisons ; en cas de blocage, le chef tranche.
7. **Corriger en une seule passe cohérente**, puis **réexaminer** avec les mêmes supports et tailles. Arrêter quand les corrections sont vérifiées : pas de boucle cosmétique.
8. **Verdict** : REJETÉ, À CORRIGER, VALIDÉ SOUS RÉSERVE ou VALIDÉ. Si rien n'a pu être examiné, écrire « vérification non effectuée » et dire ce qui manque.

## 3. S'inspirer sans copier

Pour une question de composition, de parcours ou d'interaction, comparer avec des références : Mobbin (écrans et parcours), Dribbble (propositions visuelles), Pinterest (planches d'ambiance), et ailleurs selon le sujet.

- Poser d'abord la question précise (« où placer la saisie sur téléphone ? »), puis chercher un exemple comparable.
- Ouvrir réellement les visuels avant de les analyser : un titre n'est pas une référence consultée.
- Une référence inspire, elle ne prouve pas qu'une solution marche ici : une belle image ne prouve pas un parcours viable.
- Aucune donnée privée du projet dans une requête. Si un outil manque ou demande une connexion, le dire et continuer avec les preuves accessibles ; ne rien installer ni payer sans DrSmoke.

## 4. Apprendre ensemble

- Après chaque revue : une ligne dans `LESSONS.md` (quoi, cause, règle) et un message court aux autres sur ce qui a été appris, découvert ou résolu.
- Les préférences personnelles de DrSmoke restent dans la mémoire de chaque agent, hors du dépôt, avec leur date et leur portée ; une recommandation de la revue n'est pas une préférence de DrSmoke tant qu'il ne l'a pas confirmée.
- Améliorer cette méthode quand une leçon démontrée révèle un défaut valable ailleurs : modification ciblée, proposée au chef, jamais une règle de plus à partir d'un seul exemple.

## 5. Compte rendu de revue (modèle court)

- Support, version, tailles examinées, preuves.
- Profils choisis et pourquoi.
- Défauts retenus après auto-critique, gravité, correction précise.
- Suggestions adoptées, écartées (avec la raison), reportées.
- Corrections appliquées et réexamen.
- Verdict et ce qui n'a pas pu être vérifié.
