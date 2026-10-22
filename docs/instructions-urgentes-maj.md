# Instructions urgentes : mise à jour intégrée (U6, U7)

Date : 22 octobre 2026. Base : `main` (lire le dernier commit avant de commencer).
Lis d'abord `docs/regles-agents.md`, `AGENTS.md`, `LESSONS.md`, `HANDOFF.md`.

## Pourquoi cette mission

Le rapport QA Windows de la PR #12 (relance sur le commit `78d2c697`, 22 octobre) montre que la mise à jour intégrée ne réussit pas son échange de version sur Windows :

- **U6** : après l'échange, le nouveau serveur ne répond pas sur le port. La version reste 0.5.1, aucune sauvegarde n'est créée. Les données locales sont conservées.
- **U7** : le retour arrière échoue. La version reste 0.5.2 au lieu de revenir en 0.5.1. Le dossier d'échec n'est pas conservé.
- **U3** (mineur) : après un refus pour empreinte SHA-256 fausse, un dossier d'étape subsiste.

Le rapport n'est pas tranché sur la cause : le runner Windows n'a pas de session interactive. Ne conclus donc rien sur la cause avant d'avoir reproduit.

Le fichier de rapport envoyé à Claude est tronqué à la source : seule la première partie est lisible. Ne te fonde que sur les points ci-dessus, et demande à SmokeSama la suite si tu en as besoin.

## Ce qui est déjà fait (ne pas refaire)

- PR #12 fusionnée (`1993ebf`). La release 0.5.1 a été publiée automatiquement, elle doit rester en brouillon jusqu'à la correction.
- Le ZIP a été nettoyé (PR #15).
- Ne pas dire que la mise à jour intégrée est « validée » : c'est faux sur Windows.

## Règles

- Branche : `muse/U6-U7`. Une pull request. Ne fusionne jamais toi-même : seul SmokeSama fusionne.
- Aucune publication : pas de release, pas de tag, pas de ZIP publié.
- Ne modifie pas `.github/workflows/release.yml`, `.githooks/` ni la configuration git.
- Avant chaque push : `npm run check` et `npm test` passent. Annonce le nombre exact (réussis, échoués, ignorés). Teste aussi sous Node 22.
- Aucune signature d'IA dans les commits, titres ni corps de PR.

## Fichiers à lire

- `src/update.mjs` : vérification de release, téléchargement, contrôle SHA-256, préparation, installation (lancement de l'assistant).
- `src/update-helper.mjs` : attente de l'arrêt du serveur, échange de dossier, relance, vérification de santé, retour arrière.
- `test/update.test.mjs` et `test/update-helper.test.mjs` : tests existants.

## Méthode

1. **Reproduire d'abord.** Écris un test qui échoue pour U6 et un pour U7, avant toute correction. Si la reproduction Windows n'est pas possible, reproduis sous Linux avec Node, et dis-le.
2. **Chercher la cause, pas le symptôme.** Points à vérifier dans `update-helper.mjs` :
   - le lancement du nouveau serveur (`launch`, `healthy`) : sortie d'erreur, port, chemin, variables d'environnement ;
   - la condition qui décide du retour arrière (`swapped`, `alive`) ;
   - le lancement détaché sous Windows (`detached`, `windowsHide`).
   Ne modifie pas les tests pour les faire passer.
3. **Corriger le minimum.** Une correction par défaut identifiée, avec son test.
4. **Ne jamais sauter le contrôle d'empreinte** ni la conservation de `.bureau` et `.myteam-local`.
5. **U3** : après un refus d'empreinte, supprimer le dossier d'étape. Test à l'appui.
6. Relis ton diff avant de pousser.

## Ce que tu ne peux pas affirmer

- Que la mise à jour marche sur Windows réel : seule une reproduction sur une machine Windows, faite par SmokeSama, le prouve.
- Que la cause est celle que tu trouves, si tu ne l'as reproduite qu'en simulation.

Écris « testé », « simulé », « non testé » ou « bloqué » pour chaque point.

## Compte rendu

Tâche (U6, U7, U3), branche, numéro de PR, hash, tests (nombre exact), cause identifiée et preuve, ce qui n'est pas vérifié, leçon ajoutée à `LESSONS.md` (oui ou non).
