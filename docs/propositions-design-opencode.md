# Propositions de design d'OpenCode (17 octobre 2026)

Sources : les 24 captures de `captures/revue-design/`, `docs/synthese-design.md` (décisions D1 à D8), `LESSONS.md`. Six captures ont été examinées en détail : reel-1440, telephone-390, onglet-poste-codex, onglet-equipe, palette, jour-nuit. Ce document propose ; `public/` reste la propriété de Claude, qui applique ou refuse.

Rappel issu des leçons : la police pixel n'a pas tous les signes. « », « » et « ~ » s'affichent « ? ». Les textes de la scène et des pastilles utilisent donc le tiret et les lettres simples.

## 1. Constats observés sur les captures

- C1. La même information apparaît jusqu'à quatre fois : compteurs du haut (« 4 au travail, 0 en attente, 0 disponibles »), panneau de la scène (TRAVAIL, DISPONIBLE, ATTENTE, parfois EN PAUSE), noms sous les bureaux (« CODEX AU TRAVAIL »), cartes du bas (« Claude - Au travail »). La règle de DrSmoke est pourtant « jamais la même information deux fois ».
- C2. Sur la fiche de Codex (capture onglet-poste-codex), la pause annonce « retour à 16:50 (dans 1 h 35) - relance prévue à 16:50 » : la relance y est présentée à la même heure que le retour. Le contrat du serveur est « remise à zéro + 5 minutes » (champ holdUntil de la file).
- C3. Le message « Lecture indisponible : Session expirée. Actualisez le bureau. » occupe l'onglet Tâches (capture palette) et deux sections de l'onglet Équipe. C'est exactement le défaut G2 de la revue d'interface : un navigateur n'envoie pas Origin sur un GET de même origine. Corrigé côté serveur (commit 0791adc, provenance acceptée par Sec-Fetch-Site = same-origin) : la capture doit être refaite après rechargement.
- C4. Le libellé de la salle de réflexion change et se tronque d'une capture à l'autre : « SALLE DE REFLEXION - 1 SOUS-AGENT DE COD... », « REFLEXION - 1 S. », « SALLE DE REFLEXION ».
- C5. Sur téléphone, l'invitation dit « Clique sur un personnage pour ouvrir son poste » alors qu'on touche l'écran.
- C6. L'onglet Équipe annonce « Aucun courrier depuis l'ouverture du bureau » alors que le serveur transmet les délégations du chef sur les douze dernières heures, journal à l'appui.
- C7. Dans la palette, la mention « récents » répétée devant chaque « Fichiers de... » n'apporte aucune information.

## 2. Propositions

### P1. Le panneau de statistiques de la scène (choix à faire, trois options)
1. Le transformer en tableau de bord des faits utiles : pause de quota en cours (heure de retour), nombre de consignes en file, nombre de courriers non lus. Rien d'affiché n'y est déjà dit ailleurs. (Recommandé)
2. Ne garder que l'horloge pixel et supprimer les trois lignes de compteurs.
3. Le laisser en lecture seule mais masqué sous 1360 px, la place manquant sur petit écran.

### P2. Les cartes du bas deviennent la source unique de l'état (choix à faire, trois options)
1. Sous les bureaux, seul le nom de l'agent ; l'état reste dans les cartes et se devrait à la posture du personnage (mug, main levée, frappe). (Recommandé)
2. Sous les bureaux, nom et état en petit, mais alors les cartes ne montrent que le nom et le panneau Herdr.
3. Garder les deux mais différencier clairement : la scène montre l'ambiance, les cartes portent la couleur d'état officielle.

### P3. Bandeau de pause de quota en une seule ligne
« Pause de quota : retour annoncé 16:50, relance 16:55 (source : terminal) ». Le retour vient de resetsAt, la relance de holdUntil (retour + 5 min), la source distingue le journal du terminal. Cela règle C2 et évite de reparser le terminal côté interface : le serveur expose déjà limitReached, resetsAt, usedPercent et la source.

### P4. Libellé stable de la salle de réflexion (choix à faire, trois options)
1. « SALLE DE REFLEXION » toujours, et le nombre de sous-agents passe dans le panneau de P1. (Recommandé : jamais tronqué, jamais faux)
2. « REFLEXION - 2 SA » avec une abréviation fixe de trois lettres.
3. Faire défiler doucement le texte long, en veillant à ce qu'il reste lisible.

### P5. Textes adaptés au support
Ordinateur : « Clique sur un personnage ». Téléphone : « Touche un personnage ». Même logique pour les autres invitations de clic.

### P6. Le courrier dit la vérité de sa source
Remplacer « Aucun courrier depuis l'ouverture du bureau » par « Aucune délégation observée sur les 12 dernières heures » et, quand il y en a, afficher l'heure du dernier envoi observé. Le champ result (réussite, échec, inconnu) vient du serveur : ne jamais affirmer qu'une tâche est réussie, seulement ce que le journal en dit.

### P7. Trois erreurs, trois réponses
Le serveur distingue désormais 400 (saisie), 502 (Herdr) et 500 (interne), et la provenance des lectures ne casse plus. L'interface peut aligner ses messages : « Session expirée : actualise » (réponse du serveur), « Herdr est déconnecté » (liste d'agents vide), « Lecture en panne, réessaie » (journal illisible). Aucun de ces cas ne doit s'afficher comme une liste vide (décision D6 déjà prise).

## 3. Ce que le serveur permet désormais d'affirmer

- Pause de quota : activity.limitReached, activity.resetsAt (heure locale, lendemain si passée), activity.usedPercent, activity.source (journal ou terminal). Une seule vérité côté serveur, pour tous les agents.
- File d'attente : états attente, envoi_en_cours, envoyee, annulee, a_revoir, plus holdUntil (fin de pause mémorisée) et requestKey (ajout idempotent). Le champ holdUntil est l'heure de relance à afficher.
- Délégations du chef : id, at, target, title (80 caractères, jamais la consigne complète) et result sur douze heures.
- Lectures protégées : GET accepté avec la preuve de provenance du navigateur (Sec-Fetch-Site = same-origin) ou l'origine exacte ; les écritures gardent l'origine stricte et le jeton.

## 4. Ce qui n'a pas été vérifié ici

- Six captures examinées en détail sur vingt-quatre ; les planches d'heures, le mode Disposer, l'aide et les onglets Fichiers et Tâches n'ont pas reçu de constat nominatif.
- Le rendu réel des accents dans la police pixel n'a pas été testé dans cette session ; la leçon du « ? » s'applique tant qu'elle n'est pas levée.
- L'essai Playwright sans interception demandé par la revue G2 n'a pas été exécuté dans cette mission ; les tests HTTP couvrent les deux provenances et le refus, mais pas un vrai navigateur.
