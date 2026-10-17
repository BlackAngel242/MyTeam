# Propositions pour professionnaliser le dépôt GitHub « MyTeam »

Ce document recense les fichiers, automatisations et réglages standards de l'écosystème GitHub recommandés pour donner à MyTeam (le Bureau des agents) une finition digne d'un grand projet open source.

Aucun de ces fichiers n'est créé d'office : il s'agit d'un catalogue de propositions raisonnées. DrSmoke décidera des options à retenir avant toute mise en place.

---

## Sommaire

1. [Workflow d'intégration continue GitHub Actions](#1-workflow-dintégration-continue-github-actions)
2. [Badge dynamique de statut de build](#2-badge-dynamique-de-statut-de-build)
3. [Modèles de signalement d'anomalies et d'évolutions](#3-modèles-de-signalement-danomalies-et-dévolutions)
4. [Modèle de Pull Request](#4-modèle-de-pull-request)
5. [Fichier de mécénat et soutien financier](#5-fichier-de-mécénat-et-soutien-financier)
6. [Réglages et protections du dépôt](#6-réglages-et-protections-du-dépôt)
7. [Tableau récapitulatif des décisions](#7-tableau-récapitulatif-des-décisions)

---

## 1. Workflow d'intégration continue GitHub Actions

- **Emplacement proposé** : `.github/workflows/ci.yml`
- **Rôle** : Exécuter automatiquement le contrôle syntaxique (`npm run check`) et la suite complète de tests natifs (`npm test`) sur chaque `push` et sur chaque `pull_request`.
- **Bénéfice pour le projet** : Garantit publiquement qu'aucune proposition externe ne casse le code existant (200 tests automatisés). Les runners GitHub étant gratuits pour les dépôts publics, cette automatisation ne coûte rien.
- **Effort estimé** : Faible (un fichier YAML d'une trentaine de lignes).
- **Validation requise de DrSmoke** : Oui. DrSmoke doit valider s'il souhaite exécuter les tests uniquement sous Ubuntu (rapide et économe) ou sur une matrice multi-OS (Ubuntu, Windows, macOS), ce qui est pertinent puisque MyTeam propose des scripts d'installation pour ces trois environnements.

### Exemple de configuration suggérée

```yaml
name: Tests et qualité

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  test:
    name: Validation Node.js ${{ matrix.node-version }} sur ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ ubuntu-latest, windows-latest, macos-latest ]
        node-version: [ 22 ]

    steps:
      - name: Récupération du code
        uses: actions/checkout@v4

      - name: Configuration de Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Contrôle de la syntaxe
        run: npm run check

      - name: Exécution des tests automatisés
        run: npm test
```

---

## 2. Badge dynamique de statut de build

- **Emplacement proposé** : En tête de `README.md` (à côté des badges MIT, Node.js et tests).
- **Rôle** : Afficher en direct si la dernière version du code passe tous les tests (`CI | passing`).
- **Bénéfice pour le projet** : Apporte une preuve immédiate de sérieux et de stabilité à tout visiteur découvrant MyTeam.
- **Effort estimé** : Négligeable (une ligne markdown à ajouter dans `README.md` une fois le workflow activé).
- **Validation requise de DrSmoke** : Oui. DrSmoke doit confirmer le nom définitif du compte ou de l'organisation GitHub accueillant le projet (par exemple `https://github.com/DrSmoke/MyTeam/actions/workflows/ci.yml/badge.svg`).

---

## 3. Modèles de signalement d'anomalies et d'évolutions

- **Emplacement proposé** : Dossier `.github/ISSUE_TEMPLATE/`
- **Fichiers suggérés** :
  - `bug_report.yml` : Formulaire structuré pour déclarer un problème technique.
  - `feature_request.yml` : Formulaire pour suggérer une nouvelle fonctionnalité.
  - `config.yml` : Fichier d'aiguillage vers la documentation ou les discussions pour les simples questions.
- **Bénéfice pour le projet** : Évite les signalements incomplets ou flous, guide les utilisateurs pour qu'ils précisent leur système d'exploitation, leur version de Node.js et de Herdr, et rappelle l'interdiction absolue de publier des clés d'API, des jetons ou des données personnelles.
- **Effort estimé** : Faible (deux formulaires YAML clairs et un fichier de configuration).
- **Validation requise de DrSmoke** : Oui. DrSmoke doit valider les questions posées aux déclarants et le rappel des principes directeurs (zéro dépendance, vérité des faits, pixel art).

### Exemple de points clés demandés dans un rapport de bug
- Version de Node.js (`node -v`) et système d'exploitation (Windows, Linux, macOS).
- Version de Herdr et liste des agents utilisés (Claude, Codex, Antigravity, OpenCode).
- Comportement observé vs comportement attendu.
- Extraits de terminaux ou journaux locaux (avec rappel de masquer tout secret).

---

## 4. Modèle de Pull Request

- **Emplacement proposé** : `.github/PULL_REQUEST_TEMPLATE.md`
- **Rôle** : Fournir une grille de relecture prête à l'emploi dès qu'un contributeur ouvre une Pull Request sur le dépôt.
- **Bénéfice pour le projet** : Fait gagner un temps précieux à DrSmoke et au chef d'équipe en responsabilisant le contributeur avant même l'examen du code.
- **Effort estimé** : Faible (un fichier Markdown structuré).
- **Validation requise de DrSmoke** : Oui. DrSmoke doit valider la liste des critères imposés aux contributeurs.

### Exemple de checklist proposée
- [ ] La modification n'ajoute aucune dépendance externe dans `package.json`.
- [ ] La commande `npm run check` s'exécute sans erreur.
- [ ] La commande `npm test` réussit (200 tests passants).
- [ ] Aucun secret, jeton ou identifiant personnel n'est présent dans le diff.
- [ ] Les textes sont en français soigné, accentué, sans tiret cadratin.
- [ ] Le fichier `CHANGELOG.md` a été mis à jour si la modification est visible pour l'utilisateur.

---

## 5. Fichier de mécénat et soutien financier

- **Emplacement proposé** : `.github/FUNDING.yml`
- **Rôle** : Activer le bouton rose officiel « Sponsor » en haut du dépôt GitHub.
- **Bénéfice pour le projet** : Permet aux développeurs et aux entreprises qui tirent profit de MyTeam d'apporter une contribution financière aux travaux de l'auteur.
- **Plateformes supportées par GitHub** :
  - GitHub Sponsors (compte personnel ou organisation).
  - Plateformes tierces reconnues : Ko-fi, Buy Me a Coffee, Patreon, Liberapay.
  - Lien personnalisé : renvoi vers une page de contact officielle ou l'auteur.
- **Effort estimé** : Très faible (quelques lignes de texte).
- **Validation requise de DrSmoke** : **Indispensable**. DrSmoke doit décider s'il souhaite activer cette fonction, choisir les canaux de paiement ou conserver uniquement sa signature actuelle (contact WhatsApp).

---

## 6. Réglages et protections du dépôt

En complément des fichiers sur le disque, quelques réglages dans l'interface de gestion de GitHub permettent de sécuriser la gouvernance du projet :

1. **Règles de protection de branche (`Branch Protection Rules`)** :
   - Bloquer les suppressions et les écritures forcées (`git push --force`) sur la branche principale.
   - Exiger que le workflow de tests (GitHub Actions) réussisse avant d'autoriser la fusion d'une Pull Request.
   - Effort : 3 minutes dans les réglages GitHub. Validation DrSmoke requise : Oui.

2. **Activation de l'espace GitHub Discussions** :
   - Offre un forum communautaire pour les retours d'expérience, astuces de prompts et configurations d'agents, tout en gardant l'onglet Issues réservé aux véritables anomalies logicielles.
   - Effort : 1 clic dans les réglages GitHub. Validation DrSmoke requise : Oui.

3. **Mise à jour des métadonnées du dépôt** :
   - Renseigner la description courte : « Tour de contrôle locale en pixel art pour surveiller et piloter ses équipes d'agents d'IA sous Herdr. »
   - Renseigner les topics validés : `ai-agents`, `multi-agent-systems`, `herdr`, `pixel-art`, `developer-tools`, `local-first`, `nodejs`, `claude`, `codex`, `opencode`, `antigravity`.
   - Renseigner l'URL du site ou de la documentation locale.
   - Effort : 2 minutes. Validation DrSmoke requise : Oui.

---

## 7. Tableau récapitulatif des décisions

| Proposition | Fichier ou réglage | Bénéfice principal | Effort estimé | Validation DrSmoke requise ? |
| :--- | :--- | :--- | :--- | :--- |
| **Intégration continue** | `.github/workflows/ci.yml` | Valide automatiquement 200 tests et la syntaxe à chaque push / PR. | Faible (~15 min) | **Oui** (choix de la matrice OS). |
| **Badge de statut CI** | `README.md` | Montre l'état passant des tests en temps réel aux visiteurs. | Négligeable (~2 min) | **Oui** (confirmation de l'URL du dépôt). |
| **Modèles d'Issues** | `.github/ISSUE_TEMPLATE/*` | Structure les rapports de bugs, exclut les secrets, cadre les demandes. | Faible (~20 min) | **Oui** (validation des questions posées). |
| **Modèle de Pull Request** | `.github/PULL_REQUEST_TEMPLATE.md` | Checklist avant fusion (tests, zéro dépendance, pas de secrets). | Faible (~10 min) | **Oui** (validation des règles de la checklist). |
| **Bouton de soutien** | `.github/FUNDING.yml` | Propose le mécénat (GitHub Sponsors, Ko-fi ou l'auteur). | Faible (~5 min) | **Indispensable** (choix des canaux financiers). |
| **Protection de branche** | Réglages GitHub (`Settings > Branches`) | Empêche les pushs forcés et impose la réussite de la CI avant fusion. | Très faible (~3 min) | **Oui** (décision de gouvernance). |
| **GitHub Discussions** | Réglages GitHub (`Settings > General`) | Sépare les discussions d'atelier du suivi technique des bugs. | Très faible (~1 min) | **Oui** (accord sur l'ouverture d'un forum). |
