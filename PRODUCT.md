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

- Un personnage par agent réellement détecté dans Herdr.
- États réels : travail, disponible, attente de réponse, terminé, inconnu.
- Aucun faux agent ou pourcentage fictif.
- Les sous-agents internes ne deviennent visibles que si leur outil expose leurs événements. La première version couvre les agents détectés par Herdr.
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
