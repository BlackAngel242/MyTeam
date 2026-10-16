# Première version du bureau des agents

## Résultat attendu

Une application locale ouverte dans le navigateur affiche un bureau bleu nuit. Les agents réellement détectés occupent des postes distincts. Un clic ouvre leurs dernières sorties et permet l'envoi d'une consigne.

## Fonctionnement

Un petit serveur Node.js appelle le programme Herdr installé avec des arguments séparés, sans interpréteur de commandes. Il actualise la liste toutes les trois secondes. Les états inconnus restent inconnus. La sortie affichée est un extrait du terminal, pas une conversation complète reconstruite.

La scène animée est accompagnée d'une liste accessible au clavier. Le panneau de lecture reste utilisable sur téléphone. Les animations peuvent être désactivées et respectent la préférence système de réduction des mouvements.

Le serveur n'écoute que sur 127.0.0.1. Les messages exigent une origine locale et un jeton éphémère. La cible est vérifiée dans la liste actuelle avant chaque envoi. Un agent occupé, bloqué ou inconnu ne reçoit pas automatiquement une nouvelle consigne.

## Limites

La première version ne reconstruit pas les tâches détaillées, les liens hiérarchiques ou les sous-agents invisibles dans Herdr. Un statut « travail » n'est pas assimilé à une écriture de fichier. Aucun message d'essai n'est envoyé aux agents existants.

## Vérification

Tests de traduction des données, refus des cibles absentes et états non disponibles, limites du serveur local et erreurs Herdr. Vérification visuelle sur ordinateur et téléphone. Détecteur Impeccable exécuté une seule fois après la construction.
