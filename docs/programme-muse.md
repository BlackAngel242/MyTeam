# Programme de travail pour Muse

Date : 21 octobre 2026. Ce document est la seule feuille de route à suivre. Il remplace les consignes orales.

Base : `main`. Avant de commencer, relire le dernier commit de `main` : le document peut être en retard sur le dépôt.

## 0. Reprendre une session

1. Lire `AGENTS.md`, `LESSONS.md`, `HANDOFF.md` et `TODO.md`, puis ce document en entier.
2. Vérifier l'état réel sur GitHub avant d'agir : releases, pull requests ouvertes, branches.
3. Prendre la première tâche non cochée de la section 3 dont les prérequis sont cochés.
4. Ne jamais refaire une action listée dans la section 1 comme déjà faite.
5. En fin de session, remplir la section 8 (journal de reprise) avant de s'arrêter.

## 1. Déjà fait (ne pas refaire)

- Pull requests #2 à #13 traitées. Aucune pull request ouverte au moment de la rédaction.
- Ruleset « Protéger main » actif : une approbation obligatoire, tests Ubuntu et Windows obligatoires, push forcé et suppression interdits, administrateurs autorisés à contourner.
- Nom de la version 0.5.0 : « Ṣàngó », validé par DrSmoke. Règle de nommage dans `docs/noms-de-versions.md`.
- Mise à jour intégrée (0.5.1) fusionnée dans `main` (commit `1993ebf`).
- Release **v0.5.1 publiée automatiquement** le 21 octobre à 19 h 40. Cause : le workflow se lance à chaque modification de `package.json` sur `main`. Le ZIP n'est pas nettoyé et la recette n'est pas faite.
- Release **v0.5.0 retirée** par le workflow (le tag est resté). Les liens de téléchargement du README et du site visent `v0.5.0/MyTeam-0.5.0.zip` et renvoient 404.
- Titre de la release 0.5.1 avec deux espaces parasites autour du nom.
- Tests sur `main` : 506 tests, 479 réussis, 0 échec, 27 ignorés.

## 2. Décisions déjà prises par DrSmoke (ne pas les rediscuter)

- **D1.** Passer la release 0.5.1 en brouillon et restaurer la 0.5.0 le temps de la recette. Validé le 21 octobre (« fais comme tu le dis »).
- **D2.** La mise à jour intégrée reste. Elle ne s'installe qu'après un clic explicite de l'utilisateur.
- **D3.** Aucune release publique sans accord explicite pour cette release précise.
- **D4.** Le nom suit la règle de `docs/noms-de-versions.md` : il change au premier ou au deuxième chiffre, et reste pour un changement du dernier chiffre.

## 3. Feuille de route

Une case ne se coche qu'après fusion de la pull request par DrSmoke. Muse propose, DrSmoke valide.

Légende des types : **[G]** action GitHub (release, branche, paramètre), **[C]** code et tests, **[D]** document, **[H]** recette humaine (DrSmoke seul).

### Priorité 1 : urgent

- [ ] **T1 [G]** Release 0.5.1 en brouillon, release 0.5.0 restaurée. Prérequis : D1.
  - Passer `v0.5.1` en brouillon. Ne jamais supprimer le tag ni la release.
  - Recréer `v0.5.0` avec `MyTeam-0.5.0.zip` et `MyTeam-0.5.0.zip.sha256`. Titre : `MyTeam 0.5.0 « Ṣàngó »`. Le ZIP vient de l'archive d'origine de la 0.5.0 (commit `bed3375`), pas d'une reconstruction.
  - Contrôle : `releases/download/v0.5.0/MyTeam-0.5.0.zip` répond 200, `releases/latest` pointe sur 0.5.0, `v0.5.1` est en brouillon, le tag `v0.5.1` existe toujours.
  - Si l'API renvoie 403 (« not permitted for this session type »), s'arrêter, consigner le blocage dans la section 8, et indiquer à DrSmoke les trois étapes à faire sur GitHub.

- [ ] **T2 [C]** ZIP de publication nettoyé.
  - Modifier `scripts/empaqueter-release.mjs` pour exclure `site/`, `.github/`, `.impeccable/` et `.jules/`. `.jules/` cite un outil tiers, interdit dans un livrable public.
  - Ajouter un test dans `test/empaqueter-release.test.mjs` qui vérifie l'absence de ces dossiers et de `test/` dans l'archive.
  - Ne pas toucher à `.github/workflows/release.yml` (voir T3).
  - Contrôle : l'archive contient une seule racine `MyTeam-X.Y.Z/`, les lanceurs `Installer MyTeam.bat` et `Ouvrir le bureau.cmd` sont présents, `test/` et les quatre dossiers exclus sont absents.

- [ ] **T3 [D]** Diagnostic des publications automatiques et du titre de release.
  - Lire `.github/workflows/release.yml` : déclencheur (push sur `main` avec `package.json`), étape de retrait des anciennes releases (`scripts/garder-releases.mjs`), génération du titre (deux espaces parasites).
  - Rédiger `docs/diagnostic-release.md` : cause exacte de chaque défaut, correctif proposé pour chacun, et risque.
  - Ne rien modifier dans le workflow avant accord de DrSmoke. Proposition attendue : passer le déclenchement en `workflow_dispatch` uniquement, pour qu'aucune modification de `package.json` ne republie.

### Priorité 2 : recette et qualité

- [ ] **T4 [C]** QA-L1 : la grille Herdr se crée sans dossier de projet imposé.
  - Reproduire d'abord avec un test qui échoue. Le corriger dans le code concerné, puis vérifier que le test passe.
  - Source du défaut : `docs/revue-recette-pr12.md`.

- [ ] **T5 [C]** Deux broutilles d'affichage listées dans `docs/revue-recette-pr12.md`.
  - Une PR par broutille si elles touchent des fichiers différents.

- [ ] **T6 [D]** Liste de recette humaine 0.5.1 pour DrSmoke.
  - Créer `docs/recette-0.5.1.md` : cases à cocher pour Linux et Windows, couvrant l'installation réelle de Node.js et Herdr, Herdr hors PATH, démarrage et délégation réelle au chef, création du raccourci, notification, téléchargement, installation et redémarrage d'une mise à jour, conservation du projet, du port et des données locales.
  - Muse ne fait pas cette recette. DrSmoke la fait sur ses machines.

- [ ] **T7 [C]** Test H3 sur macOS et retour de macOS dans la matrice CI.
  - Reproduire l'échec de `test/installers-h3.test.mjs:213` sur macOS. Cause probable : le dossier temporaire passe par `/var`, qui est un lien vers `/private/var`. Non confirmée.
  - Corriger le test ou l'installeur, puis remettre `macos-latest` dans `.github/workflows/ci.yml`. Ce fichier appartient à la chaîne de vérification : ne le modifier qu'après le correctif validé en local.

- [ ] **T8 [C]** Contrats Herdr (R1 de l'audit, priorité la plus haute de l'audit).
  - Créer `test/fixtures/` avec des sorties JSON réelles de `agent list`, `agent prompt` et `pane process-info`, anonymisées (aucun chemin personnel, aucun identifiant).
  - Faire passer `parseResult` et `normalizeAgent` sur ces fixtures.

### Priorité 3 : mise à jour en arrière-plan

- [ ] **T9 [D]** Spécification : `docs/mise-a-jour-arriere-plan.md`.
  - Demande de DrSmoke : signaler qu'une nouvelle version existe, télécharger tout de suite en arrière-plan. Si l'utilisateur accepte, l'application se ferme, un écran d'installation animé s'affiche, la mise à jour s'installe, puis MyTeam redémarre.
  - Partir du code existant : `src/update.mjs` (vérification de `releases/latest`, cache d'une heure, téléchargement, contrôle SHA-256, staging) et `src/update-helper.mjs` (arrêt, remplacement, relance, retour arrière).
  - La spécification doit couvrir : états (disponible, téléchargement, prête, installation, échec), messages affichés, fermeture pendant le téléchargement, coupure réseau, disque plein, relance qui échoue, données locales conservées.
  - Point de sécurité à écrire noir sur blanc : l'archive et son empreinte viennent de la même release, sans signature. La vérification protège contre la corruption et l'interruption, pas contre une release compromise. Proposer une piste (clé de signature hors du dépôt).
  - Ne pas écrire de code avant l'accord de DrSmoke sur cette spécification.

- [ ] **T10 [C]** Mise à jour en arrière-plan (après accord sur T9).
  - Téléchargement en arrière-plan dès la détection, bouton « Mettre à jour » qui déclenche l'installation, écran d'attente animé, relance automatique.
  - Jamais d'installation sans clic explicite. Conserver le contrôle d'empreinte et le retour arrière.
  - Tests : chaque état de la spécification a un test, y compris l'échec et la relance qui échoue.

### Priorité 4 : finitions (décisions de DrSmoke d'abord)

- [ ] **T11 [C]** Nom de la version dans le titre de release, lu depuis `docs/noms-de-versions.md`. Prérequis : accord sur T3.
- [ ] **T12 [C]** Pied de page du site : « MyTeam 0.5.0 « Ṣàngó » · Version de référence » (FR et EN), dans `site/index.html` et `site/site.js`. Proposition, attend l'accord de DrSmoke.
- [ ] **T13 [G]** Nettoyage des branches distantes. DrSmoke valide la liste avant toute suppression. Candidates : `claude`, `codex_update-in-app`, `bolt-throttle-canvas-mousemove-9353058314495662181`, `bolt-throttle-request-animation-frame-4009775728670992235`, `bolt/perf-fit-optimization-3593258377254832117`, `agent/dola/audit-360`. Ne jamais supprimer `ccr-f7825547-u0hf6e` (branche de session) ni `main`.
- [ ] **T14 [G]** Vérifier le ruleset « Protéger main » : un collaborateur ne doit pas pouvoir pousser directement sur `main`. Muse ne peut pas le tester : DrSmoke vérifie avec un compte de test ou sur la prochaine pull request d'un collaborateur, et le consigne dans la section 8.
- [ ] **T15 [H]** Commande d'installation `npm exec` pointant sur le tag `v0.5.1` : la tester sur une machine propre. Tâche de DrSmoke, à consigner.
- [ ] **T16 [D]** Décision à préparer pour DrSmoke : rangement du ZIP « lanceurs seuls à la racine », et raccourci Herdr séparé. Ne rien implémenter sans sa réponse.

### Priorité 5 : audit 360 (une recommandation par pull request, dans cet ordre)

Source : `docs/audit-360.md`, sections 3.1 à 3.6.

- [ ] **T17 [C]** A1 : extraire les routes de `server.mjs` vers `src/routes/` (refactor pur, les tests protègent).
- [ ] **T18 [C]** Q2 : couverture de tests en job optionnel, sans seuil bloquant.
- [ ] **T19 [C]** Q3 : résumé CI des tests ignorés.
- [ ] **T20 [C]** S4 : limite de débit sur `/api/prompt` et `/api/queue`, seulement si un abus est observé. Sinon, ne pas faire et le noter.
- [ ] **T21 [C]** S5 : défense en profondeur du masque pour les racines de chemins hors liste. Tester avec les contre-exemples existants avant activation.
- [ ] **T22 [C]** R2 : messages d'erreur serveur via les dictionnaires FR/EN.
- [ ] **T23 [C]** A2 : découper `public/app.js` en modules ES (un module par étape, pas de bundler).
- [ ] **T24 [C]** A3 : supprimer la copie `public/appearance.*` vers `site/appearance.*` au profit d'une copie au déploiement.
- [ ] **T25 [C]** P2 : sondage des panneaux en parallèle borné (trois à la fois). Commit isolé, test de l'ordre des effets, aucun envoi pendant la crise.
- [ ] **T26 [G]** G2 : le lot U (harmonisation de l'interface) est-il à intégrer ou à fermer ? Question pour DrSmoke, pas de code.

### Abandonnés (ne pas reprendre)

- S3 : nettoyage des fichiers joints orphelins. Contraire à la conservation délibérée des copies partielles, testée.
- P1 : cache de `codexReady`. Contraire à la fraîcheur exigée avant chaque envoi, testée.

## 4. Méthode pour chaque tâche

1. Créer la branche `muse/<ID>` depuis `main` à jour (exemple : `muse/T2`).
2. Reproduire le problème avant de le corriger. Écrire le test qui échoue, puis le faire passer.
3. Modifier le strict nécessaire. Une pull request = un sujet.
4. Vérifier : `npm run check` et `npm test`. Lancer aussi la suite sous Node 22, car la CI tourne sous Node 22 (voir `LESSONS.md`). Annoncer le nombre de tests (réussis, échoués, ignorés).
5. Relire son propre diff avant de pousser, en se demandant ce qui ferait échouer la CI.
6. Message de commit en français, sans signature d'IA (pas de `Co-Authored-By`, pas de « Generated with »). Ne jamais modifier `git config`.
7. Pousser la branche, ouvrir une pull request prête à relire, avec le modèle `.github/pull_request_template.md` rempli. Aucun nom d'outil dans le titre ni dans le corps.
8. Ne pas fusionner soi-même. Annoncer : « prêt à évaluer », hash du commit, tests, ce qui n'a pas pu être vérifié.
9. Après fusion par DrSmoke : cocher la case, mettre à jour `HANDOFF.md` et `TODO.md`, ajouter une ligne à `LESSONS.md` pour chaque erreur rencontrée (quoi, cause, règle).

Pour les écrans : vérifier sur ordinateur et téléphone, avec Playwright et des états simulés. Ne jamais envoyer de consigne réelle à un agent.

## 5. Interdits

- Pousser directement sur `main`. Réécrire l'historique de `main`. Forcer un push.
- Publier quoi que ce soit (release, tag, ZIP public) sans accord explicite de DrSmoke pour cette action précise.
- Supprimer une branche, une release ou un fichier sans accord explicite.
- Modifier `.github/workflows/release.yml`, `.githooks/`, `git config`, un secret ou un identifiant.
- Ajouter une dépendance npm.
- Annoncer un résultat non vérifié. Si un test n'a pas tourné, le dire.
- Recréer une version en modifiant ses fichiers : une version se restaure à partir de son archive d'origine.

## 6. Compte rendu (format court, après chaque tâche)

Tâche (ID), branche, numéro de pull request, hash, tests (nombre), ce qui n'a pas été vérifié, leçon ajoutée à `LESSONS.md` (oui ou non).

## 7. Économie de jetons

- Une seule tâche à la fois, jusqu'à sa pull request.
- Lire les fichiers ciblés (`grep`, `sed -n`) plutôt que des fichiers entiers.
- Si les jetons manquent : s'arrêter proprement. Ne rien laisser poussé à moitié. Noter l'état exact dans la section 8.

## 8. Journal de reprise (Muse remplit à chaque session)

Date, tâche en cours, dernier hash, pull request ouverte (oui ou non), ce qui reste, blocage éventuel.

- 22 octobre 2026, tâche T4 (QA-L1 : grille Herdr créée sans dossier de projet imposé), branche `claude` (fusion de `main` a6b6975 au départ ; la branche distante avait été supprimée après la fusion de la PR #15, recréée à la poussée ; T2 est fusionnée, PR #15 du 22 octobre, sa case reste à cocher par DrSmoke). Fait : `workspace create` reçoit désormais `--cwd` avec le dossier du projet (`RACINE` côté bash, `$racine` côté PowerShell) dans `scripts/installer.sh` et `scripts/installer.ps1`, et les procédures manuelles affichées en repli montrent la même commande ; deux tests ajoutés dans `test/installers-h3.test.mjs`, rouge avant le correctif (appel journalisé sans `--cwd`), vert après. Preuve en réel : contre le serveur Herdr 0.9.5 de la machine, dans une session de banc isolée démarrée depuis un dossier différent du projet, la fonction corrigée crée 4 panneaux dont `pane get` et `pane process-info` rapportent le dossier du projet. Tests : `npm run check` passe ; `npm test` 510 tests, 482 réussis, 0 échec, 28 ignorés, compteurs identiques sous Node 22.23.4. Pull request ouverte depuis `claude`, en attente de validation et de fusion par DrSmoke (la case T4 ne se coche qu'après sa fusion). Reste ensuite, dans l'ordre donné par DrSmoke : T5, T7, T8, T3, T9. Blocage : aucun.
- 21 octobre 2026, tâche T2 (ZIP de publication nettoyé), branche `claude` (fusion de `main` 7bcfca8 au départ). Fait : `scripts/empaqueter-release.mjs` exclut `site/`, `.github/`, `.impeccable/`, `.jules/` et `test/` à la construction et contrôle le ZIP produit ; test ajouté dans `test/empaqueter-release.test.mjs`, rouge avant le correctif, vert après. Archive de contrôle construite depuis HEAD : 138 entrées contre 181, racine unique `MyTeam-0.5.1/`, lanceurs présents, dossiers exclus absents. Tests : `npm run check` passe ; `npm test` 507 tests, 480 réussis, 0 échec, 27 ignorés, compteurs identiques sous Node 22.23.4. Pull request ouverte depuis `claude`, en attente de validation et de fusion par DrSmoke (la case T2 ne se coche qu'après sa fusion). Reste ensuite, dans l'ordre donné par DrSmoke : T4, T5, T7, T8, T3, T9. Blocage : aucun. Note de session : les actions de release de T1 ont été exécutées par l'API GitHub plus tôt dans la session, avant la consigne réservant T1 à DrSmoke (0.5.1 passée en brouillon, tag intact ; 0.5.0 recréée depuis l'arbre de `bed3375` avec le script du projet, l'archive binaire d'origine n'existant plus ; contrôles : téléchargement 200, `releases/latest` sur v0.5.0). À confirmer ou à défaire par DrSmoke, qui seul décide des releases.
