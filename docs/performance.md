# Performance mesurée avec dix agents

Note interne du 18 octobre 2026. Chaque chiffre vient d'un passage du banc de mesure dans un environnement Windows avec Node 24 et peut être remesuré avec la commande donnée ci-dessous. Les durées changent d'une machine et d'un passage à l'autre : seuls les budgets d'appels et les plafonds sont des inégalités vérifiées par les tests à chaque passage.

## Le banc

- `test/banc-10-agents.mjs` : un pont Herdr factice de dix panneaux variés (Claude, Codex, OpenCode, Antigravity, Gemini, Cursor, Kimi, Grok, Qwen, Devin), avec des états idle, working, waiting, done, blocked et une pause de quota sur Codex. Chaque appel est compté au moment exact où le serveur le demande.
- Le serveur testé est le vrai (`server.mjs`) ; seuls Herdr et les journaux sont factices, sur des racines temporaires vides. La mesure ne dépend donc pas des journaux de ce poste et reste la même ailleurs.
- Un « appel Herdr » ci-dessous compte `list + prompt + read + broadcast + terminal`, c'est-à-dire ce qui devient de vraies commandes Herdr en production. Les lectures de journaux locaux (quota, affichage) sont comptées à part.

Commande du banc :

    node --test test/budget-10-agents.test.mjs test/relais-10-agents.test.mjs

Résultat du 18 octobre 2026 : 13 tests, 13 réussis, 0 échec.

## Durée des trois routes principales (10 agents)

| Route | Durée du passage | Appels Herdr | Lectures de journal |
| --- | --- | --- | --- |
| `GET /api/state` | 9,7 ms | 1 (liste) | 9 (quota des neuf agents non Claude) |
| `GET /api/discussion` | 7,7 ms | 1 (liste) | 0 |
| `GET /api/todos` | 45,8 ms | 1 (liste) | 0 |

Plafond de durée posé par le test : 2000 ms, volontairement large (machine chargée, antivirus). La durée réelle s'affiche à chaque passage avec la ligne `MESURE ...` du banc.

## Sondage des pauses (cadence 20 secondes)

| Situation | Durée | Appels Herdr | Détail |
| --- | --- | --- | --- |
| Cycle de sondage à 10 agents | 5,1 ms | 11 | 1 liste + 10 lectures de panneau, une par agent |
| Deux cycles lancés en même temps | durée non mesurée | 11 | 1 liste + 10 panneaux, aucun doublon |
| Cycle de reprise après pause | 83,7 ms | 11 | 1 liste + 10 panneaux ; la consigne de reprise est mise en file sans appel Herdr |
| Envoi de la reprise par la file | 8,1 ms | 3 | 2 listes + 1 prompt |

Budget fixé par le test, quel que soit le cycle : au plus `1 + nombre d'agents` appels Herdr (une liste et un panneau par agent), et la lecture de quota une seule fois par agent non Claude (9 sur 10 dans ce banc). Le quota de Claude vient de son terminal, pas d'un journal.

## Tour de file (cadence 15 secondes)

| Situation | Durée | Appels Herdr | Détail |
| --- | --- | --- | --- |
| 8 consignes réparties sur 4 agents | 67,4 ms sur 2 tours | 18 | 10 listes + 8 prompts, au plus un envoi par agent et par tour |
| Envoi avec fichier joint | durée non mesurée | 7 | 4 listes + 2 quotas + 1 prompt |

Budget d'un envoi avec fichier : 4 lectures de liste au plus (ouverture du tour, lieux autorisés pour la copie, revérification après la copie, dernier contrôle juste avant l'envoi). Deux lectures de suite pour un même contrôle compteraient comme un appel Herdr de trop.

## Rafale de fins simultanées

Scénario : mode autonomie actif, les neuf agents autres que le chef passent en « done » au même instant.

- Le cycle reste dans son budget : 352,4 ms, 11 appels Herdr (1 liste + 10 panneaux), 9 lectures de quota. La rafale n'ajoute aucun appel.
- 5 consignes seulement sont créées pour le chef, pour 9 fins : c'est le plafond de 5 consignes en attente par agent de la file d'attente. Les 4 fins restantes sont consommées sans consigne et ne reviennent qu'au prochain changement d'état de ces agents.
- Envoi des 5 consignes : 5 tours (au plus un envoi par tour), 15 appels Herdr (10 listes + 5 prompts).

## Plafonds vérifiés

| Plafond | Valeur | Comportement observé |
| --- | --- | --- |
| Envoi groupé `POST /api/broadcast` | 1 à 12 destinataires | 13 cibles : refus 400 « 1 à 12 », aucun appel Herdr, aucun envoi. 12 cibles : 12 envois, au plus 12 diffusions. |
| Consignes en attente par agent | 5 | La 6e est refusée (« 5 consignes en attente »). Au chargement d'un fichier déjà trop plein, le trop-plein passe « à revoir » sans envoi. |
| Échanges du mode autonomie | 3 à 60 (défaut 20) | Exactement le nombre demandé de messages, numérotés « échange n/N », puis le mode s'arrête et le relais revient à l'état d'avant le lancement. |
| Boucle | 4 fins du même agent dans les 10 minutes | Le mode s'arrête (« boucle détectée ») et la 4e fin ne produit aucune consigne. |
| Durée des routes | 2000 ms dans le test | Seul plafond de temps ; les durées ci-dessus ne sont pas garanties. |

## Ce qui a été corrigé le 18 octobre

1. **Un seul cycle de sondage à la fois** (commit `e572828`, `server.mjs`). La cadence de 20 secondes est plus courte qu'une lecture lente de Herdr (8 secondes par panneau dans la production) : le tour suivant démarrait pendant le premier et relisait la liste ainsi que les dix panneaux. Un tour en cours est désormais partagé par le tour suivant. Preuve : le test « deux cycles de sondage lancés en même temps ne doublent pas les appels Herdr » (1 liste, 10 panneaux).
2. **Une seule lecture de liste après la copie** (commit `20c7c68`, `src/queue.mjs`). Le quota et la cible étaient revérifiés juste après la copie avec deux demandes de liste successives, un appel Herdr de trop pour le même contrôle. Une seule lecture sert aux deux ; le dernier contrôle juste avant l'envoi reste en place. Preuve : le test « tour de file avec fichier joint » (4 listes au plus).
3. **La mise en file sort du verrou d'observation** (commit `96d7201`, `src/relais.mjs`). Un mode autonomie qui s'arrêtait au milieu d'une observation (plafond d'échanges ou boucle) appelait `relais.set()`, lequel attendait la fin de cette même observation : l'interblocage gelait le sondage de 20 secondes, puis tous les suivants. Le calcul reste sous verrou, la mise en file se fait après ; une fin dont le relais est désactivé en chemin ne part plus. Preuve : le test « course entre passer() et arreter() ».

## Limites connues

- **Rafale de fins et plafond de la file** : sur 9 fins simultanées, 4 n'ont aucune consigne, absorbées par le plafond de 5 consignes en attente par agent. À arbitrer avec le chef : élargir le plafond aux événements internes, ou rejouer les fins non servies.
- **Relais déjà actif avant le lancement** (constat, sans correction) : quand le relais était allumé avant le mode autonomie, l'arrêt du mode le laisse actif et les fins restantes partent alors en clair, jusqu'au plafond de 5 de la file. Dans le scénario du banc : 3 consignes du mode retirées à l'arrêt, 5 messages bruts en attente, la 9e fin échoue sur le plafond. Le correctif attendu est dans `src/autonomie.mjs`.
- **Durées mesurées sur journaux vides** : avec de vrais journaux, la lecture reste incrémentale et bornée (budget de 4 Mo par session, 50 000 identifiants mémorisés), mais les durées de `GET /api/state` et de la lecture de quota peuvent monter.
- **Durées non garanties** : elles dépendent de la machine, de la charge et de l'antivirus. L'engagement vérifié à chaque passage est le budget d'appels et le plafond de 2000 ms, pas les durées affichées.
