# Audit du paquet MyTeam 0.4.1

18 octobre 2026. Rapport court, non poussé. Périmètre : le contenu du zip de
release, pas le code.

## Méthode

- Paquet généré sur `HEAD` par `scripts/empaqueter-release.mjs`, version `0.4.1`,
  dans un dossier temporaire du système (**pas dans le dépôt**).
- Archive : **220 entrées**, 3 039 848 octets, SHA-256
  `4a462d0e351b48a666f1b6187b3ad5a6c7036a37cf888bc976eb1a3ac0540281`.
- Contrôles : listage complet, recherche par motifs, puis passage de **tous les
  fichiers texte au masque public de `src/masque.mjs`** comme garde-fou. Tout ce
  que le masque modifie est traité comme une fuite potentielle, puis examiné.
- Aucune écriture dans le dépôt, aucune publication.

## Résultat principal : propre sur les axes demandés

| Axe recherché | Occurrences trouvées |
|---|---|
| Chemins `C:\Users\DrSmoke` (ou `Users/DrSmoke`) | **0** |
| Secrets réels (`sk-`, `ghp_`, `gho_`, `ghu_`, `ghs_`, `github_pat_`, `Bearer`, jetons) | **0** |
| Adresse e-mail personnelle | **0** (seuls `t@example.invalid` et `user@example.com`, deux données de test) |
| Téléphone, société, WhatsApp (`+242`, `DMAM`, `650 72`) | **0** |
| `.bureau/`, `scratch/`, `docs/table-ronde`, `.env`, `node_modules`, `.git`, `.slim`, `bureau.log` | **0** |
| Traces d'IA (`Co-Authored-By`, `Generated with`) | **0** hors règles de prohibition et crédit officiel |

Le travail fait le 18 octobre pour retirer le numéro et la société est efficace :
la signature qui reste est réduite à « DrSmoke « Un Mbokatié engagé » », sans
contact. Les captures du dossier `docs/captures/` (22 fichiers) sont voulues.

## Constats

### C1. Notes internes livrées avec le produit (gravité moyenne)

- **Constat** : le paquet embarque les fichiers piliers de coordination et des
  notes de travail : `AGENTS.md`, `CLAUDE.md`, `JOURNAL.md`, `HANDOFF.md`,
  `LESSONS.md`, `TODO.md`, `ERREURS.md`, `docs/plan-travail.md`,
  `docs/publication-github.md`, `docs/contrat-crise.md`,
  `docs/contrat-fichiers.md`, `docs/contrat-priorite-direction.md`.
- **Preuve** : listage de l'archive, entrées à la racine et dans `docs/`.
  `AGENTS.md` contient le profil de travail personnel de DrSmoke avec ses
  citations datées ; `docs/publication-github.md` s'ouvre sur « audit de partage :
  éléments spécifiques à la machine locale » ; `JOURNAL.md` et `HANDOFF.md`
  détaillent la coordination interne des agents.
- **Nuance** : tous ces fichiers sont déjà visibles dans le dépôt public. Le zip
  n'ajoute rien qui ne soit publié ; il les place simplement dans l'archive qu'un
  utilisateur télécharge et dézippe sans rien demander.
- **Correctif proposé** : liste d'exclusion dans
  `scripts/empaqueter-release.mjs` (piliers, `docs/plan-travail.md`,
  `docs/publication-github.md`, `docs/contrat-*.md`). **Propriétaire : Codex.**
  Alternative légitime : les garder, car les fichiers piliers sont la promesse de
  reprise par une autre IA. Dans ce cas, le décider explicitement plutôt que le
  subir.
- **Remarque** : ce rapport-ci, rangé dans `docs/`, sera lui aussi dans le
  paquet 0.4.2. À mettre dans la liste d'exclusion si C1 est retenu.

### C2. Nom d'auteur en pied de page par défaut (gravité faible)

- **Constat** : quand `.bureau/pied.json` est absent, le serveur affiche par
  défaut « DrSmoke « Un Mbokatié engagé » » en pied de page du bureau. Un
  utilisateur qui installe sans rien configurer a donc la signature de l'auteur
  sur son propre poste.
- **Preuve** : `server.mjs:329`, encodé par `test/pied.test.mjs:31` et `:46`.
  `test/pied.test.mjs:54` précise volontairement qu'aucun numéro n'est imposé :
  le nom, lui, l'est.
- **Écart** : cela contredit la décision « interface sans nom d'auteur imposé »
  consignée au consensus du 18 octobre.
- **Correctif proposé** : pied de page vide par défaut, la signature venant
  uniquement de `.bureau/pied.json`. **Fichier dans mon périmètre**, mais je ne
  l'ai **pas** modifié : `test/pied.test.mjs` encode cette valeur comme
  comportement voulu, et c'est une décision produit. À trancher avant de coder.

### C3. Trace d'outil dans un document (gravité faible)

- **Constat** : `PRODUCT.md:3` porte `<!-- impeccable:product-schema 1 -->`, une
  marque de l'outil de design Impeccable.
- **Preuve** : lecture de `PRODUCT.md`, ligne 3.
- **Correctif** : retirer la ligne, ou la garder si elle sert au rechargement du
  schéma. **Propriétaire : Antigravity.**

## Ce qui a été vérifié sans être un défaut

- **Le masque comme garde-fou** a signalé 48 fichiers, tous faux positifs : ce
  sont les **expressions régulières du code** (`[A-Za-z]:[\\/]` devient
  `[chemin masqué]`) et les **données factices des tests** (`C:/projet-factice`,
  `ghp_abcdefghijklmnopqrstuvwxyz`). Aucune vraie fuite. Conséquence à retenir :
  `masque()` est fait pour les sorties texte d'exécution, pas pour auditer du
  code source ; un audit de paquet doit trier ses signalements.
- **Aucune trace d'IA dans l'historique** : les mentions de Claude, Codex,
  Antigravity et OpenCode dans `README.md`, `docs/credits-ia.md` et le site sont
  la section de crédit officielle exigée par la règle du projet. Les occurrences
  de `Co-Authored-By` et `Generated with` dans `AGENTS.md`, `LESSONS.md` et
  `kit.test.mjs` sont des **interdictions** et leur contrôle, pas des signatures.

## Limites

- Le paquet a été audité **tel qu'exporté depuis `HEAD`**. Un fichier ajouté mais
  non commité n'apparaît pas : c'est voulu, l'archive ne contient que le suivi.
- Les **images** (`docs/captures/`, `site/assets/`) n'ont pas été inspectées
  pixel par pixel. Une capture peut laisser lire un nom ou un texte à l'écran ;
  les 22 captures datent des corrections d'interface et sont à régénérer selon le
  planning du chef. **[NON VÉRIFIÉ]**
- Aucun contrôle de licence des polices ou images tierces : hors périmètre.
