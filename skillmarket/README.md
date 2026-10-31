# SkillMarket — Fixit et TableRonde

Paquet de skills autonome, placé dans MyTeam comme module indépendant pour revue avant intégration. Il ne modifie ni le serveur ni l'installateur MyTeam.

## Contenu

- Fixit : contrôler un travail terminé, corriger les défauts dans le périmètre permis, vérifier et apprendre.
- TableRonde : préparer un PRD et des arbitrages contradictoires avant la production.
- plugin.json : manifeste portable Agent Plugins.
- installer.mjs : installation locale des deux skills dans Codex, Claude Code, Cursor ou Copilot.
- build-zips.py : fabriquer les ZIP individuels pour les surfaces ChatGPT éligibles, ainsi que le ZIP du plugin.

## Installer les deux skills sur un ordinateur

Prérequis : Node.js 22+ (comme MyTeam). Ne réclame aucun jeton, n'exécute aucun code tiers et n'utilise pas de réseau.

Depuis la racine du dépôt :

    node skillmarket/installer.mjs --tool codex --scope user
    node skillmarket/installer.mjs --tool claude --scope user
    node skillmarket/installer.mjs --tool cursor --scope user
    node skillmarket/installer.mjs --tool copilot --scope user

Sur Windows, ouvrir « Installer SkillMarket.bat » (Codex, profil utilisateur). L'installateur signale les prérequis manquants.

Choisir un skill :

    node skillmarket/installer.mjs --tool codex --skill fixit
    node skillmarket/installer.mjs --tool codex --skill table-ronde

Simulation : ajouter --dry-run. Installation dans le projet courant : --scope project.
Dossier spécifique : --dir chemin/vers/skills.
Un skill déjà identique est ignoré, un contenu divergent est conservé ; pour le remplacer après sauvegarde, ajouter --replace. L'installateur préserve l'ancienne version dans un dossier de sauvegarde à côté du nouveau.

## ChatGPT / GPT

Un programme local NE PEUT PAS installer silencieusement un skill dans un compte ChatGPT. Les skills personnels téléversés sont réservés aux offres/surfaces compatibles et peuvent nécessiter une autorisation d'espace de travail.

Générer les ZIP sans bibliothèque externe :

    python skillmarket/build-zips.py

Résultats : dist/Fixit-ChatGPT.zip, dist/TableRonde-ChatGPT.zip et dist/SkillMarket-Plugin.zip.

Sur un ChatGPT éligible : Plugins > Skills > Create > Upload from your computer, puis envoyer le ZIP du skill souhaité et vérifier l'analyse de sécurité. Sinon, l'utiliser dans Codex, ou demander l'import d'un plugin par l'administrateur de l'espace de travail.

Le manifeste portable plugin.json permet aussi la distribution en plugin contenant les deux skills. Le catalogue local du dépôt se trouve dans .agents/plugins/marketplace.json ; après intégration à main, la source Git peut être ajoutée à Codex avec :

    codex plugin marketplace add BlackAngel242/MyTeam

Ce paquet n'est pas publié dans l'annuaire universel ni installé sur un compte GPT par le seul fait d'être sur GitHub.

## Contrôles

    node --test test/skillmarket-installer.test.mjs

Les tests couvrent la simulation, l'installation, l'idempotence, le refus d'écrasement, la sauvegarde avant remplacement et l'absence d'installation locale pour ChatGPT.

## Sources de la méthode

- MyTeam : docs/fixit-equipe.md
- DrFix : passation/METHODE.md (Fixit adaptatif, quatre volets)
- PRD TableRonde : grille de réflexion et arbitrages, à distinguer des agents réellement consultés.
