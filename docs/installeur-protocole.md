# Protocole entre l'installeur et son interface animée

L'interface (`scripts/installateur-anime.mjs`) lance `scripts/installer.ps1 -Interface` (Windows) ou `scripts/installer.sh --interface` (macOS, Linux), lit leur sortie standard et leur écrit les réponses sur l'entrée standard. La logique d'installation reste dans les scripts ; l'interface ne fait que dessiner et poser les questions. Toute ligne qui ne commence pas par `@@` est ignorée par l'interface (journaux bruts).

## Sortie de l'installeur (une ligne par message, texte en UTF-8, pas de retour à la ligne dans un texte)

| Ligne | Sens |
| --- | --- |
| `@@PLAN <id>	<libellé>` | Une tâche de la liste, émise une fois par tâche au début, dans l'ordre. Identifiants : `node`, `herdr`, `panneaux`, `outils`, `chef`, `extensions`, `clink` (Windows seulement), `config`, `kit`, `tests`. |
| `@@STEP <id>` | La tâche commence (spinner). |
| `@@INFO <texte>` | Message sous la tâche en cours. |
| `@@CONFIRM <id>	<question>` | Question o/n. L'interface répond `o` ou `n`. Toute demande « individuelle » reste individuelle : jamais de réponse automatique. |
| `@@CHOICE <id>	<question>	<option 1>	<option 2>...` | Choix numéroté. L'interface répond le numéro à partir de 1. |
| `@@MULTI <id>	<question>	<option 1>	<option 2>...` | Cases toutes décochées au départ ; réponse : numéros cochés séparés par des virgules, ligne vide pour aucun. Flèches pour déplacer, Espace pour cocher, `a` pour tout cocher ou décocher, Entrée pour valider. En texte : saisir par exemple `2,4`. |
| `@@INPUT <id>	<question>	<valeur par défaut>` | Saisie libre. L'interface répond une ligne (vide = défaut). |
| `@@DONE <id>	<ok|skip|fail>	<texte>` | La tâche est finie : réussie, ignorée (refus ou déjà fait) ou en échec. |
| `@@END <ok|fail>` | Fin de l'installation. |

## Règles

- Une réponse est lue sur une seule ligne de l'entrée standard, après chaque `@@CONFIRM`, `@@CHOICE`, `@@MULTI` ou `@@INPUT`. Fin de l'entrée (EOF) = refus, aucune case cochée, jamais un accord. Chaque case représente un consentement individuel ; les options `-Oui` et `--oui` ne cochent aucune case.
- Les prérequis Node.js, Herdr et Clink sont installés automatiquement, avec ou sans `-Oui` / `--oui`. Les outils IA et extensions exigent une confirmation explicite.
- Le texte est dans la langue demandée (`-Lang fr|en` / `--lang fr|en`).
- Aucun chemin personnel, jeton ni valeur du disque non échappée dans un message : les valeurs restent des données.
