# Revue critique du Bureau des agents

Par Antigravity (panneau w5:p2), evaluation independante du 17 octobre 2026.

## 1. Notes d'evaluation (sur 10)

- Lisibilite : 7,5 / 10
  Le contraste sombre est bon, les couleurs semantiques d'etat (bleu travail, menthe disponible, ambre attente) sont claires et stables. En revanche, le cadre du terminal est trop etroit pour afficher du texte monospace sans replis continuels, et la police pixel 3x5 de la scene est parfois difficile a dechiffrer.

- Hierarchie visuelle : 6 / 10
  L'en-tete marketing H1 ("Une equipe. Un meme bureau.") et le decor de la piece (ciel, vitres, baie Herdr) consomment plus de la moitie de la hauteur utile. A l'inverse, l'alerte pour un agent bloquant qui attend DrSmoke reste discrete, et le panneau lateral empile tous les controles les uns sous les autres sans organisation par onglets.

- Utilite pour piloter des agents : 6,5 / 10
  La base est tres saine : aucun statut invente, securite des envois respectee, sauvegarde des brouillons. Mais l'usage quotidien est freine par l'absence de raccourci clavier pour envoyer, l'absence d'indication du panneau Herdr (w5:p1, etc.), un plein ecran purement contemplatif et une experience mobile ou la selection ne montre pas le resultat.

- Note globale : 6,7 / 10

## 2. Les 5 problemes majeurs et leur emplacement exact dans le code

1. La selection d'un agent sur mobile ne montre pas son poste
   - Emplacement : public/app.js (fonction selectAgent, lignes 121 a 128) et public/style.css (lignes 6 a 7).
   - Constat : Sur telephone (ecran inferieur a 800 px), le panneau lateral aside.detail est repousse tout en bas, sous la scene et sous la liste des boutons. Lorsqu'on clique sur un agent dans la scene ou dans la liste, la selection est enregistree mais l'ecran ne defile pas. L'utilisateur a l'impression que son clic n'a eu aucun effet.

2. Le plein ecran supprime toutes les fonctions de pilotage
   - Emplacement : public/index.html (ligne 23), public/style.css (ligne 14) et public/app.js (lignes 394 a 396).
   - Constat : Le bouton plein ecran applique requestFullscreen() uniquement sur .office-frame. La liste des agents, le terminal de sortie, les informations d'activite et le formulaire d'envoi sont completement masques. Le bureau devient une simple animation sans moyen de lire ou de donner une consigne.

3. Le terminal est trop etroit et sa selection de texte est cassee par le rafraichissement
   - Emplacement : public/style.css (ligne 3, selecteur pre) et public/app.js (fonction readOutput, lignes 155 a 168, et intervalle ligne 401).
   - Constat : Le panneau de droite a une largeur fixee a 370 px (environ 300 px utiles pour le pre). Les lignes de terminal de 80 a 120 colonnes se replient en permanence, ce qui rend les erreurs et les tableaux illisibles. De plus, readOutput remplace output.textContent toutes les 3 secondes, ce qui annule immediatement toute selection de texte faite par l'utilisateur pour copier un log.

4. Aucun raccourci clavier d'envoi et empilement vertical infini des formulaires
   - Emplacement : public/app.js (lignes 169 a 180 pour prompt, 106 a 120 pour broadcast) et public/index.html (lignes 37 et 38).
   - Constat : Les champs textarea ne gerent pas le raccourci Ctrl+Entree (ou Cmd+Entree). L'utilisateur doit obligatoirement reprendre la souris pour cliquer sur le bouton d'envoi. De plus, le formulaire individuel et le bloc d'envoi groupe sont empiles a la suite dans la meme colonne etroite, repoussant les boutons loin du terminal.

5. Absence de l'identifiant de panneau Herdr et priorite disproportionnee donnee au decor
   - Emplacement : public/app.js (lignes 45 et 55 a 57), public/index.html (lignes 21 et 33) et public/style.css (lignes 3 et 273 a 289).
   - Constat : Le champ paneId (w5:p1, w5:p2, w5:p4...), pourtant fourni par Herdr via /api/state, n'est affiche nulle part (ni sur les boutons, ni dans les meta de l'agent). Impossible de savoir quel terminal Herdr physique correspond a l'agent selectionne. En parallele, le grand titre H1 et le mur superieur de la scene occupent la majeure partie du premier ecran.

## 3. Cinq propositions concretes classees par priorite

1. Rendre la selection reactive sur telephone (Priorite 1)
   Ajouter dans selectAgent un defilement fluide (scrollIntoView({ behavior: 'smooth' })) vers le titre du panneau quand la fenetre fait moins de 800 px, ou introduire deux onglets mobiles simples : "Bureau" et "Poste selectionne".

2. Preserver la selection de texte et donner de l'air au terminal (Priorite 2)
   Dans readOutput, verifier window.getSelection().toString() avant d'ecraser textContent pour ne pas couper une copie en cours. Permettre d'elargir le terminal ou de le placer sous la scene en pleine largeur sur demande pour lire confortablement 80 a 100 colonnes.

3. Ajouter Ctrl+Entree et un raccourci de selection pour l'envoi groupe (Priorite 3)
   Ecouter l'evenement keydown sur #message et #broadcast-message pour declencher l'envoi sur Ctrl+Entree. Dans l'envoi groupe, ajouter un bouton simple "Cocher tous les disponibles" pour eviter de cocher un a un les agents prets.

4. Afficher le paneId Herdr sur les cartes et le panneau de detail (Priorite 4)
   Ajouter un badge discret (par exemple "Panneau w5:p1") sous le nom de l'agent dans agents-list et dans agent-meta. Cela fait le pont immediat entre l'interface visuelle et les fenetres reelles de Herdr.

5. Revoir le mode plein ecran pour en faire une vraie tour de controle (Priorite 5)
   Appliquer le plein ecran sur un conteneur incluant soit un volet escamotable avec le terminal et la consigne au clic sur un personnage, soit permettre d'afficher les sorties directement au survol ou au clic sur le poste.

## 4. Ce qui est deja reussi

- Verite stricte des donnees : aucune invention de pourcentages, d'agents fantomes ou de faux statuts. Les etats refletent fidelement Herdr.
- Securite des consignes : blocage des envois quand un agent travaille deja, et confirmation securisee en deux etapes (bouton ambre arme) pour les envois groupes.
- Confort des brouillons : la saisie en cours n'est pas perdue lors du passage d'un agent a un autre grace a drafts.set().
- Identite pixel art soignee : ciel calibre sur l'heure reelle de la machine, eclairage par les ecrans, logos 16x16 dedies a chaque outil (Claude, Codex, Antigravity, OpenCode).
- Remontee locale des activites de Claude : prise en compte reelle de ses sous-agents et de sa consommation de jetons sans impacter les autres outils.
- Notification discrète par le titre de l'onglet : le compteur (N) signale efficacement les agents en attente quand la page est en arriere-plan.

## 5. Deuxième passage (après prise en compte des retours)

Évaluation de la nouvelle version mise à jour le 17 octobre 2026.

### Nouvelles notes d'évaluation (sur 10)

- Lisibilité : 8,8 / 10 (+1,3)
  Le masquage du grand titre H1 dégage la vue. La barre d'état avec ses pastilles (au travail, en attente, disponibles) offre une lecture instantanée de l'équipe. L'alerte jaune avec le bouton « Ouvrir son poste » rend les agents bloqués impossibles à rater. Les outils de terminal (recherche avec surlignage, figer, copier) et la pause automatique lors d'une sélection de texte transforment la lecture des logs.

- Hiérarchie visuelle : 8,5 / 10 (+2,5)
  L'organisation en deux onglets distincts (« Poste » et « Équipe ») résout élégamment la surcharge verticale du panneau latéral. Chaque vue est désormais ciblée et aérée. Le badge sur l'onglet Équipe signale directement le nombre d'agents disponibles.

- Utilité pour piloter des agents : 8,7 / 10 (+2,2)
  Le plein écran intègre désormais la scène et le panneau de pilotage ensemble, en faisant une véritable tour de contrôle. Le raccourci Ctrl+Entrée, le bouton « Cocher tous les disponibles », la présence de l'identifiant réel du panneau Herdr (w5:p1, w5:p4) et le défilement automatique sur mobile comblent les manques fonctionnels clés.

- Note globale : 8,7 / 10 (contre 6,7 initialement, progression nette de +2 points)

### Ce qui a été corrigé avec succès

- Défilement automatique fluide vers le panneau de pilotage lors de la sélection d'un agent sur mobile ou écran étroit.
- Préservation de la sélection de texte dans le terminal lors des rafraîchissements toutes les 3 secondes.
- Raccourci clavier Ctrl+Entrée (et Cmd+Entrée) pour l'envoi individuel et groupé.
- Bouton « Cocher tous les disponibles » dans l'onglet Équipe pour accélérer les envois collectifs.
- Affichage clair du panneau Herdr (paneId) sur les boutons d'agents et dans les métadonnées.
- Mode plein écran englobant la scène et le panneau de pilotage dans la même vue.

### Ce qui reste à améliorer

1. Flexibilité de la largeur du terminal : Sur grand écran et en plein écran, la colonne de droite reste fixée à environ 400 px. Un commutateur permettant d'élargir le terminal (ou de le basculer sous la scène) permettrait d'afficher confortablement des sorties de 100 à 120 colonnes.
2. Signal visuel d'envoi sur la scène : Lors de l'envoi d'une consigne (« Envoi en cours… »), une brève impulsion lumineuse ou un indicateur réseau sur le bureau de l'agent confirmerait visuellement le départ de la consigne dans le décor en pixels.
3. Raccourci clavier pour basculer d'onglet : Permettre de passer rapidement de l'onglet « Poste » à l'onglet « Équipe » via un raccourci clavier global (par exemple Alt+1 et Alt+2).
4. Alerte en cas de prise de travail impromptue : Si un agent passe à l'état occupé alors que l'utilisateur rédigeait une consigne, afficher une notification contextuelle immédiate plutôt que de simplement griser le bouton.
