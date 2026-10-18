# Contribuer à MyTeam (Bureau des agents)

**Français** | [English](CONTRIBUTING.en.md)

Merci de votre intérêt pour MyTeam (le Bureau des agents) ! Ce projet a été conçu pour offrir un tableau de bord local, vivant et esthétique aux personnes qui pilotent plusieurs agents d'intelligence artificielle dans Herdr.

## Principes directeurs et règles d'or

Toute contribution doit respecter les règles fondamentales du projet :

1. **Zéro dépendance externe** : Le projet n'utilise aucun paquet npm tiers (`npm install` est inutile et déconseillé). Tout repose exclusivement sur les modules natifs de Node.js (`node:http`, `node:fs`, `node:crypto`, `node:child_process`, `node:test`).
2. **Vérité absolue des faits** : Le bureau n'affiche que ce qui est réellement observé (états Herdr, journaux locaux, fichiers du disque, horloge réelle). Jamais de statut simulé, de faux agent, de pourcentage inventé ou d'approximation non signalée.
3. **Sécurité et souveraineté locale** : Le serveur écoute sur `127.0.0.1` uniquement. Aucun secret, identifiant de compte, jeton ou chemin personnel ne doit fuiter dans les réponses du serveur, les tests ou les commits.
4. **Signature et auteur** : Toute contribution est enregistrée sous le profil GitHub de l'auteur du projet (DrSmoke). Aucun nom d'outil ou d'IA n'apparaît dans les messages de commit ou les titres de pull request. Les crédits aux modèles utilisés sont centralisés dans `README.md` et `docs/credits-ia.md`.
5. **Esthétique pixel art** : Les décors, personnages et emblèmes respectent une grille précise (16×16 pour les logos d'outils). Les teintes d'identité ne doivent jamais se confondre avec les couleurs réservées aux états (bleu au travail, menthe disponible ou terminé, ambre en attente).
6. **Accessibilité et sobriété** : Navigation intégrale au clavier, support du mode de réduction des mouvements (`prefers-reduced-motion`) et textes soignés en français accentué sans tiret cadratin.

---

## Comment participer ?

### 1. Signaler un défaut (Bug)

Si vous observez un comportement inattendu ou une erreur :
- Vérifiez d'abord que le problème n'est pas déjà répertorié dans les tickets ou dans [`LESSONS.md`](LESSONS.md).
- Ouvrez un signalement via le modèle dédié dans GitHub : décrivez les faits observés, les étapes de reproduction et votre environnement (système, version Node, version Herdr).
- Ne collez aucun secret, jeton ou chemin privé dans le signalement.

### 2. Proposer une idée ou une amélioration

Les propositions renforçant le confort, la lisibilité ou les fonctionnalités de l'OS d'agents sont bienvenues :
- Utilisez le modèle d'issue de proposition d'idée.
- Expliquez le besoin concret, le parcours utilisateur envisagé (en 3 à 5 gestes) et l'impact sur le code.

### 3. Ajouter un outil compatible Herdr et son emblème

Herdr prend en charge de nombreux agents (`--kind`). Pour ajouter ou adapter un outil :
1. **Emblème pixel art 16×16** dans [`public/logos.js`](public/logos.js) :
   - Grille exacte de 16 lignes de 16 caractères (`.` pour transparent, lettres `a`, `b`, `c` pour la palette).
   - Palette de 2 à 4 couleurs hexadécimales harmonisées.
   - Forme reconnaissable et distincte, sans copier servilement une marque déposée.
2. **Table de correspondance** : associez l'identifiant Herdr et ses alias dans `window.AGENT_LOGO_MAP` de `public/logos.js`.
3. **Nom d'affichage** : déclarez le libellé propre dans la table `names` de [`src/herdr.mjs`](src/herdr.mjs).
4. **Validation** : ajoutez ou vérifiez le test dans [`test/logos.test.mjs`](test/logos.test.mjs) (`npm test`).

### 4. Ajouter ou enrichir une langue

Le français est la langue de référence du projet, l'anglais est la langue internationale :
- Pour l'interface : complétez ou créez le dictionnaire `public/i18n-<langue>.js`.
- Pour la documentation : traduisez fidèlement les guides (`README.<langue>.md`, `docs/aide.<langue>.md`, `docs/kit.<langue>.md`) en conservant les noms de commandes et chemins exacts.

### 5. Proposer une leçon pour LESSONS.md

[`LESSONS.md`](LESSONS.md) est la mémoire commune qui évite de répéter les erreurs déjà rencontrées :
- Chaque leçon vient d'une erreur réelle rencontrée en développement ou en utilisation.
- Format compact : une seule ligne par leçon, décrivant l'erreur, sa cause et la règle opérationnelle stricte pour ne jamais la reproduire.
- Soumettez votre proposition dans une pull request ou un ticket dédié.

---

## Proposer une Pull Request

1. Créez une branche thématique décrivant précisément votre travail (`git checkout -b ma-fonctionnalite`).
2. Écrivez ou complétez des tests automatisés dans `test/`.
3. Validez la conformité locale avant de proposer :
   ```powershell
   npm run check
   npm test
   ```
4. Respectez la liste de contrôle du modèle de Pull Request :
   - [ ] `npm run check` et `npm test` passent sans erreur.
   - [ ] Aucune dépendance ajoutée sans raison (zéro dépendance externe).
   - [ ] Le bureau n'affiche que des faits observés (aucune donnée inventée).
   - [ ] Interface vérifiée sur ordinateur et téléphone (360 et 390 px).
   - [ ] Nouvelle erreur rencontrée consignée dans `LESSONS.md`.
   - [ ] Aucun nom d'IA dans le titre ou les messages de commit.
5. Ouvrez votre Pull Request sur le dépôt principal.
