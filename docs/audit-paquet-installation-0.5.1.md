# Table ronde : paquet utilisateur et installation par commande

Décision (niveau standard, approbation DrSmoke à la fusion) : le dépôt public conserve les instructions de développement ; le ZIP ne livre que les éléments utiles à l'utilisateur et les modèles vierges du kit. `git archive` applique `.gitattributes` ; le filtrage du ZIP n'efface rien de Git ni de son historique.

| Regard | Tension | Arbitrage |
| --- | --- | --- |
| Utilisateur pressé | ZIP manuel / commande courte | Ajouter `npm exec` pour les machines ayant Node.js 22+, conserver l'installateur ZIP pour les autres. |
| Novice | « npm » suppose déjà Node / expérience sans prérequis | Afficher clairement cette condition sur le site. |
| Mainteneur | Notes utiles aux agents / paquet lisible | Garder les documents de pilotage dans Git ; exclure leurs exemplaires racine du ZIP. Le kit contient des modèles vierges. |
| Sécurité | Simplification / fuite de traces | Exclure les notes de session, les revues et les fichiers d'exécution ; refuser `.env`, `.bureau` et `.myteam-local` suivis. |
| Exploitation | Installation temporaire npm / raccourci durable | Copier l'application vers le dossier utilisateur avant de créer un raccourci ; refuser d'écraser une installation existante. |
| QA | Tests source / poids de distribution | Les tests restent dans le ZIP Git ; le paquet npm condensé les omet et l'installateur n'y propose pas `npm test`. |

Trois risques à surveiller : (1) le code du dépôt et les anciennes révisions restent publics malgré le filtrage du ZIP ; (2) la commande distante npm pointe vers un tag et exige une connexion réseau ; (3) les droits système peuvent encore demander une élévation lors de l'installation de Node/Clink/Herdr. Le raccourci MyTeam, Herdr ou combiné reste un choix de l'utilisateur. La commande npm n'écrase pas une installation existante : la mise à jour intégrée prend le relais.

Recette : vérifier les entrées réelles du ZIP, le contenu de `npm pack`, la simulation `myteam-install --dry-run`, puis installer depuis la future archive publiée sur Linux et Windows. La commande distante sur le tag n'est vérifiable qu'après publication de cette version ; avant ce point, le test local prouve uniquement le fonctionnement du paquet.
