# Publication et confidentialité

## Méthode

Avant publication, inventorier les fichiers suivis puis examiner leur contenu et l’archive réellement produite. Rechercher par motifs secrets, coordonnées, profils et données de session ; qualifier les correspondances pour distinguer exemples et données réelles. Examiner aussi les médias visibles et préciser la couverture. `git ls-files` est un inventaire, pas un scan de secrets ni un examen de l’historique.

Le jeton du bureau est aléatoire et gardé en mémoire. L’écoute locale, les contrôles d’origine, de jeton et de projet, et le masquage des sorties sont complémentaires ; aucun masque ne garantit l’absence de toute information sensible.

## Mémoire partageable

Conserver les guides, décisions techniques et enseignements relus. Les journaux bruts, conversations, tâches de session, configurations et pièces jointes personnelles restent privés. Le kit place ses journaux dans `.myteam-local/`, ignoré ; MyTeam garde son état d’exécution par projet dans les données locales du système sous `MyTeam`, hors checkout.

`.gitignore` ne retire pas un fichier déjà suivi ; `export-ignore` ne retire rien du dépôt public et ne s’applique qu’aux exports qui le respectent. Déplacer une note dans un autre dossier du même dépôt ne la rend pas privée. Contrôler la liste exacte du diff et de l’archive avant de publier.

Le nom public DrSmoke/BlackAngel242, les crédits officiels et les licences sont conservés par choix de l’auteur. Les captures de démonstration utilisent des états factices, sans consigne réelle ni informations personnelles.

## Référence 0.5.0

1. Vérifier le code et les guides FR/EN, les tests Node 22/24, puis les écrans ordinateur/téléphone avec états simulés.
2. Produire le paquet depuis une révision identifiée ; vérifier son inventaire, ses textes, ses licences et son SHA-256.
3. Publier la nouvelle release et aligner les liens du site ; vérifier le téléchargement effectif.
4. Retirer ensuite les anciennes releases et leurs assets.

Ce chantier ne réécrit pas l’historique Git. Nettoyer les fichiers courants et retirer une archive distribuée ne supprime pas les anciennes révisions, clones, caches ou copies téléchargées. Les résultats et limites des contrôles doivent être annoncés factuellement, sans certification absolue d’absence de secrets.

## Workflow de publication

`.github/workflows/release.yml` se déclenche sur `main` lorsque `package.json` change, ou manuellement. La version vient de `package.json` et doit avoir une entrée de changelog. Après les contrôles Node 22/24, le workflow crée un brouillon, joint ZIP et SHA-256, retélécharge les assets et vérifie leur intégrité avant publication comme référence. Après vérification du lien de téléchargement sur Pages, le retrait des anciennes releases arrive, sans supprimer les tags. Un échec de vérification arrête les étapes suivantes.

`scripts/empaqueter-release.mjs` travaille sur un commit identifié, refuse les états privés suivis par erreur et produit le ZIP ainsi que son fichier `.sha256`. `scripts/garder-releases.mjs --reference v0.5.0` exige une référence publiée avec archive et checksum ; leur vérification d’intégrité doit précéder son appel, comme dans le workflow. `--dry-run` ne supprime rien.
