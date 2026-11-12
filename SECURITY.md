# Sécurité

**Français** | [English](SECURITY.en.md)

MyTeam tourne uniquement en local (127.0.0.1), avec origine exacte et jeton pour toute écriture et toute lecture de fichiers.

## Modèle de confiance

Le jeton défend contre le **cross-site web** (falsification de requête entre sites, rebinding DNS) : un site tiers ne peut ni lire ni écrire. Il ne défend pas contre un **processus local** de la même machine, qui a de toute façon déjà accès aux fichiers du projet. L'endpoint `GET /api/state` remet le jeton au navigateur au démarrage (amorçage) ; c'est une frontière de confiance assumée, pas une faille.

## Mise à jour

Le paquet de mise à jour est vérifié par une empreinte SHA-256 publiée sur le même canal. Cette empreinte garantit l'**intégrité** (le fichier n'a pas été altéré en transit), pas l'**authenticité** de l'éditeur. Pour renforcer l'authenticité, des versions signées (par exemple `minisign` ou `age`) sont recommandées.

Pour signaler une faille, ouvrez un signalement privé via l'onglet « Security » du dépôt (« Report a vulnerability »). N'indiquez pas de détails exploitables dans un ticket public.
