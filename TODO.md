# Suivi du projet

## Première version (0.1.0) : Terminée

- [x] Repérer Herdr et confirmer l'accès local.
- [x] Raccorder la liste réelle, la lecture et l'envoi de consignes.
- [x] Construire le bureau animé en pixel art et son panneau d'échanges.
- [x] Vérifier ordinateur, téléphone, protections locales et accents.
- [x] Fournir le démarrage, le guide humain et la reprise IA.

## Deuxième version (0.2.0) : Terminée et stabilisée

- [x] Évaluation critique du design et de l'expérience utilisateur (`docs/revue-antigravity.md`).
- [x] Organisation en onglets « Poste » et « Équipe » pour alléger le panneau latéral.
- [x] Outils avancés de terminal : recherche en direct, surlignage, figer le défilement et copie rapide.
- [x] Pause automatique de rafraîchissement des sorties lors d'une sélection de texte.
- [x] Raccourci clavier universel Ctrl+Entrée (et Cmd+Entrée) pour soumettre les consignes.
- [x] Bouton « Cocher tous les disponibles » dans l'onglet Équipe.
- [x] Affichage explicite de l'identifiant de panneau Herdr (`paneId`, ex. `w5:p1`) sur chaque carte et dans le poste.
- [x] Défilement automatique fluide vers le poste lors d'un clic sur mobile (< 860 px).
- [x] Mode plein écran englobant la scène et le panneau de pilotage dans une même tour de contrôle.
- [x] Intégration de la consommation réelle de jetons et des sous-agents locaux de Claude.
- [x] Télémétrie locale étendue à Codex et OpenCode (`src/agent-activity.mjs`).
- [x] Explorateur de fichiers intégré et sécurisé (`src/files.mjs` et API `/api/files`).
- [x] Scène pixel art enrichie : bureau VIP pour le chef et salle de réflexion pour les sous-agents.
- [x] Barre d'état par IA sous chaque poste.
- [x] Règle absolue de vérité des faits : aucune donnée simulée ni inventée.
- [x] Extension de la suite de tests automatisés (129 tests réussis sur 131, 0 échec).
- [x] Sauvegarde de référence au commit `7817574`.

## Troisième version (0.3.0) : Terminée et stabilisée

- [x] File d'attente serveur avec bouton « Mettre en file » sur le poste pour les agents occupés ou en pause de quota.
- [x] Retrait unitaire des consignes en file et départ automatique à « remise à zéro + 5 min ».
- [x] Protection anti-double envoi absolue : statut d'envoi persistant, écriture atomique sur disque et clé d'idempotence.
- [x] Onglet Tâches raccordé aux cases réelles de `TODO.md` et aux plans d'action publiés par les agents.
- [x] Volet d'aide escamotable (`aside.help`, touche `?`) avec visite guidée en 5 étapes.
- [x] Palette de commandes modale (`Ctrl+K`) pour naviguer et agir au clavier.
- [x] Module sonore 8 bits Web Audio (`public/sounds.js`) et notifications de bureau Windows.
- [x] Cycle jour-nuit continu synchronisé avec l'heure réelle de la machine (lever fixe à 6 h 30, coucher à 19 h 30).
- [x] Salle de réflexion repliable pour les sous-agents d'analyse.
- [x] Bureau Direction valorisé pour le premier agent démarré dans Herdr avec pile de courriers cliquable.
- [x] Détection des délégations et courriers du chef remis à zéro dès consultation.
- [x] Application rigoureuse de la synthèse de design D1 à D8 (ordinateurs et mobiles 360-390 px).
- [x] Suite de tests étendue à 161 tests automatisés (159 réussis, 2 ignorés sur les liens symboliques Windows).

## Préparation à la publication GitHub et chantiers futurs : En cours

- [x] Audit de partage des chemins et données spécifiques à la machine (`docs/publication-github.md`).
- [x] Rédaction du guide de contribution (`CONTRIBUTING.md`).
- [x] Rédaction du journal des versions (`CHANGELOG.md` versions 0.1.0, 0.2.0 et 0.3.0).
- [x] Enrichissement du guide d'accueil et présentation publique (`README.md`).
- [x] Validation de la licence libre par DrSmoke (Licence MIT dans `LICENSE` et avis de marques dans `NOTICE.md`).
- [x] Inventaire des commandes locales vérifiées pour modèles et compétences (`docs/commandes-outils.md`).
- [x] Synthèse des 8 innovations pour l'OS d'agents (`docs/idees-os.md`).
- [x] Guide d'aide complet et fidèle à l'interface réelle (`docs/aide.md`).
- [ ] Détection automatique des ordres de délégation (`src/delegations.mjs`, en cours par OpenCode).
- [ ] Documentation d'installation multi-plateforme (`docs/INSTALLATION.md`, en cours par OpenCode).
- [ ] Scripts d'installation automatique (`scripts/`, en cours par OpenCode).
- [ ] Production et validation des captures d'illustration pour le dossier `docs/captures/`.
- [ ] Création du dépôt public GitHub et publication initiale par DrSmoke.
- [ ] Évolution vers un OS d'agents en fenêtres ou tuiles libres (décision DrSmoke).
