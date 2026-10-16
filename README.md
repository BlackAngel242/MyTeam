# Bureau des agents

Un bureau animé local pour consulter les agents Herdr et leur transmettre une consigne.

## Ouvrir

Double-cliquer sur « Ouvrir le bureau.cmd », ou ouvrir un terminal dans ce dossier et lancer :

```powershell
node server.mjs
```

Puis ouvrir http://127.0.0.1:4317 dans le navigateur. Herdr doit être ouvert. Rien à installer : Node.js est déjà présent sur cet ordinateur.

## Utiliser

Cliquer sur un personnage ou sélectionner un agent dans la liste. Le panneau affiche un extrait réel du terminal. Pendant son travail, seule sa partie visible est lue pour éviter de perturber l'agent. Les consignes sont transmises seulement aux agents disponibles ou ayant terminé. « Consigne transmise » confirme l'envoi à Herdr, pas la réussite du travail.

Les agents bloqués demandent une réponse dans Herdr. Aucun bouton n'accepte automatiquement leurs demandes d'autorisation. Une déconnexion retire les agents et empêche tout envoi.

## Limites de cette première version

- Les personnages correspondent aux agents détectés par Herdr. Les sous-agents internes à Claude ne sont pas encore suivis.
- Le bureau ne connaît pas le détail d'une tâche ni son pourcentage. Il affiche seulement l'état fourni par Herdr.
- Il n'attribue pas de mission automatiquement et ne remplace pas Claude comme coordinateur.
- Entre le contrôle d'état et l'envoi, un autre outil pourrait lancer l'agent. Éviter d'envoyer simultanément depuis plusieurs fenêtres.
- L'accès est limité à cet ordinateur. Sur un téléphone, l'interface s'adapte mais le serveur n'est pas accessible à distance.

## Entretien sans IA

`public/` contient l'interface ; `src/herdr.mjs` contient le raccordement ; `server.mjs` sert l'application et vérifie les accès. Le programme Herdr peut être désigné avec BUREAU_HERDR_PATH si son emplacement change. Le port se change avec BUREAU_PORT.

Vérifications : `npm test` et `npm run check`. Aucun paquet tiers, aucune étape de compilation. Pour arrêter un lancement manuel : Ctrl+C dans son terminal. Ne jamais arrêter Herdr pour fermer le bureau. Pour un lancement par raccourci, rechercher le processus Node exécutant exactement server.mjs dans ce dossier ; ne pas fermer tous les processus Node.

DrSmoke « Un Mbokatié engagé »
