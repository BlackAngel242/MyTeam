# Revue des recettes Linux et Windows de la PR 12

Les deux rapports reçus testaient la tête `589876c`, avant l'allègement du ZIP et l'entrée npm. Leur logique d'installation a été comparée aux scripts. Le rapport Windows documente douze scénarios simulés et le remplacement de dossiers de mise à jour ; le fichier Linux joint contient une synthèse et s'interrompt au milieu du scénario S2, donc ses scénarios suivants ne sont pas vérifiables dans la copie reçue.

| Constat | Décision | Correctif |
| --- | --- | --- |
| Choix « 0 » sans IA déjà installée boucle | Confirmé, bloquant | Autoriser l'installation différée et terminer normalement, même sans entrée standard. |
| `agent start Chef` rejeté par Herdr | Confirmé ; Herdr impose un alias minuscule | Distinguer le libellé du panneau « Chef » et l'alias `chef` ; `agent2`, etc. |
| Échec Clink muet en console Windows | Confirmé | Contrôler le code de sortie natif, rapporter l'échec et revérifier Clink. |
| Herdr hors PATH installé, chemin non sauvegardé | Confirmé | Enregistrer le chemin après nouvelle détection, comme pour un Herdr déjà présent. |
| Herdr non tenté si Node échoue, résumé « refusé » | Confirmé | Tenter Herdr indépendamment et supprimer l'attribution d'un refus inexistant. |
| `agy` et `antigravity-cli` détectés différemment | Confirmé | Accepter les deux noms dans la sélection des outils déjà disponibles. |
| Sélection affiche `Nom|commande` | Confirmé sous Bash | N'afficher que les noms. |
| Sortie 0 avec Node/Herdr manquant | Confirmé | Finir avec un code non nul hors simulation ; garder la sélection IA facultative. |

À retester après ce commit : Windows et Linux avec zéro IA et réponse `0` ; Herdr fraîchement installé hors PATH ; échec réel ou simulé de Clink ; lancement effectif d'un agent dans un panneau avec alias `chef` ; installation npm depuis le tag publié ; ZIP réduit de la nouvelle release. La CI vérifie la syntaxe et les tests mais ne remplace pas ces recettes réelles.

La documentation Herdr impose un nom d'agent conforme à `[a-z][a-z0-9_-]{0,31}` ; « Chef » reste un libellé de panneau, `chef` devient l'alias de l'agent.
