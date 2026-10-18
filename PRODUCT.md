# Bureau des agents

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Choix délégué par DrSmoke : application locale dans le navigateur. Proposition : Node.js et JavaScript natif, sans bibliothèque ni abonnement supplémentaire.

## Users

DrSmoke pilote plusieurs agents dans Herdr sous la coordination de Claude.

## Product Purpose

Voir les agents travailler dans un bureau animé, consulter leurs sorties et leur envoyer des consignes.

## Operating Context

Windows, Herdr 0.9.5 installé. Cette conversation Codex est extérieure à Herdr. Les commandes locales de Herdr exposent la liste, la lecture et l'envoi de messages.

## Capabilities and Constraints

- Un personnage par agent réellement détecté dans Herdr. Le premier agent démarré dans Herdr est le chef (bureau VIP) ; les autres sont ses agents.
- Délégations observées : quand le chef délègue (commande `herdr agent prompt` observée dans son journal), le chef quitte son bureau Direction pour apporter physiquement le dossier au poste du collaborateur. À la fin réelle de la tâche, le collaborateur transmet son courrier de retour au chef.
- Salle de réflexion : les sous-agents actifs se réunissent dans une salle de réflexion animée puis rapportent leur dossier de travail.
- Règle de « vérité des faits » : le bureau n'affiche que ce qui est réellement observé (états Herdr, journaux locaux, fichiers du disque, heure de la machine). Jamais de pourcentage, de tâche, d'humeur ou de relation inventés. Les erreurs observées nourrissent `LESSONS.md`.
- États réels : travail, disponible, attente de réponse, terminé, inconnu.
- Outils intégrés : explorateur de fichiers local, barre d'état par IA, activité locale de Claude, Codex et OpenCode.
- Aucune fermeture, interruption, mise à jour ou création de session Herdr automatique.
- L'envoi de messages doit vérifier la cible et son état, puis signaler l'envoi sans prétendre que la tâche est accomplie.
- Écoute locale uniquement, aucun secret enregistré dans Git.

## Brand Commitments

Personnages en pixels, bureau bleu nuit. Tous les textes en français simple. Construction directe approuvée, sans maquette préalable.

## Product Principles

- L'animation reflète uniquement l'état connu.
- Un clic permet de lire et de parler à un agent.
- Une déconnexion reste visible et désactive les actions.
- Conserver le travail et les agents existants.
