# MyTeam · Bureau des agents

> 🌐 **Langue / Language** : **Français** | [English](README.en.md)  
> 📚 **Documentation complète** : [docs/index.md](docs/index.md) ([English](docs/index.en.md)) | [Installation](docs/INSTALLATION.md) | [Aide](docs/aide.md) | [Site GitHub Pages](https://blackangel242.github.io/MyTeam/)

MyTeam vous montre vos agents d'IA lancés dans [Herdr](https://github.com/herdrdev/herdr) (site [herdr.dev](https://herdr.dev)) au travail dans un bureau en pixel art : suivez leur état, envoyez-leur des consignes et lisez leurs réponses. Tout reste sur votre machine : aucune dépendance npm, aucun appel sortant.

[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)
[![CI](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml/badge.svg)](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml)
[![Dépendances](https://img.shields.io/badge/d%C3%A9pendances-0%20npm-informational.svg)](package.json)

---

## Ce que tu vois en 30 secondes

1. **Le chef au bureau Direction** : Le chef d'équipe centralise les consignes, reçoit les courriers d'étape et traverse physiquement la pièce pour remettre les dossiers à ses collaborateurs.
2. **Des postes de travail incarnés** : Chaque IA (Claude Code, Codex, Antigravity, OpenCode et 20 autres) travaille à son propre bureau avec son emblème pixel art 16×16, ses postures réelles et ses pauses de quota explicites (l'équipe accueille jusqu'à 10 agents testés, 12 en envoi groupé).
3. **L'autonomie supervisée (NoBabysitter)** : Un interrupteur permanent dans la barre d'outils permet de cadrer un cycle autonome par un objectif, une durée (5 à 120 min) et un plafond d'échanges (3 à 60), avec arrêt d'urgence immédiat.
4. **La surveillance en Mosaïque** : Basculez en un clic sur une vue multi-terminaux (4 tuiles au plus) avec recherche textuelle instantanée et consigne rapide.
5. **Le disjoncteur Salle de crise** : En cas d'imprévu, le bouton sous clapet (`Ctrl+Maj+C`) gèle instantanément tous les départs de consignes sans jamais forcer un arrêt violent.

---

## 5 fonctions clés

### 1. La scène vivante et le bureau Direction
Le bureau Direction accueille le chef d'équipe. À chaque délégation observée dans son journal local, le chef sort de son bureau, traverse l'atelier et remet en main propre le dossier doré à son coéquipier. L'éclairage s'adapte automatiquement à l'heure locale, avec lever de soleil le matin et allumage des lampes de bureau dès 19 h 00.

![Scène principale de MyTeam](docs/captures/01-ordinateur-scene.png)

### 2. Le poste de travail et les sorties en direct
Chaque collaborateur a ses sorties de terminal en direct, avec recherche instantanée et repérage des erreurs et des attentes, et un champ de consigne séparé. Les réponses Markdown sont extraites sans pollution. La file d'attente prioritaire diffère les envois vers les agents occupés ou en pause de quota : un avis de disponibilité part une minute après la levée de la pause, et la file attend 5 minutes avant de renvoyer une consigne restée en attente.

![Poste de travail et terminal](docs/captures/02-ordinateur-poste.png)

### 3. La mosaïque multi-terminaux
Le mode Mosaïque affiche les terminaux de vos coéquipiers côte à côte (4 tuiles au plus) pour surveiller le travail en direct, tandis que l'effectif global de l'équipe est testé jusqu'à 10 agents (12 en envoi groupé). Il intègre une recherche synchronisée sur toutes les tuiles, un envoi rapide de consigne (`Ctrl+Entrée`) et un rafraîchissement économique suspendu dès que l'onglet n'est plus actif.

![Mode mosaïque multi-terminaux](docs/captures/11-ordinateur-mosaique.png)

### 4. L'autonomie supervisée (NoBabysitter)
L'interrupteur « Autonomie OFF/ON » lance un cycle de coordination en étoile où le chef décide et délègue chaque sous-tâche vers l'objectif fixé. Le mode s'arrête seul sur échéance, plafond d'échanges, boucle détectée ou salle de crise. Il rappelle au chef de ne jamais faire de `git push`, de suppression, d'installation ni de publication sans vous : c'est une consigne de prudence, pas un verrou technique, le serveur ne contrôle pas les commandes du chef. Un bouton Récapitulatif extrait le bilan Markdown complet directement depuis le journal des faits.

![Mode autonomie active](docs/captures/23-ordinateur-autonomie-fenetre-active.png)

### 5. La salle de crise sous clapet
Accessible par raccourci clavier (`Ctrl+Maj+C`) ou depuis la barre d'outils, la salle de crise verrouille immédiatement les départs de consignes (code HTTP 423) et affiche un diagnostic en direct des sorties de chaque agent. Elle permet de transmettre un arrêt poli par la touche Échap sans tuer les processus en cours.

![Salle de crise](docs/captures/12-ordinateur-crise.png)

---

## Installation en 3 lignes

```bash
git clone https://github.com/BlackAngel242/MyTeam.git && cd MyTeam
# Sous Windows : double-cliquez sur "Installer MyTeam.bat" (ou lancez : node server.mjs)
# Sous macOS / Linux : bash scripts/installer.sh (ou lancez : node server.mjs)
```

Ouvrez ensuite `http://127.0.0.1:4317` dans votre navigateur.  
*Prérequis : [Node.js](https://nodejs.org) >= 22 et [Herdr](https://github.com/herdrdev/herdr). Zéro dépendance npm requise.*

Pour le guide d'installation pas-à-pas, le mode démonstration et les options avancées, consultez [docs/INSTALLATION.md](docs/INSTALLATION.md).

---

## Vérité des faits et sécurité locale

- **Vérité des faits observés** : Aucun pourcentage inventé, aucune tâche simulée, aucun état émotionnel fictif. Tout provient exclusivement des faits réels mesurés sur votre machine (processus Herdr, journaux locaux, fichiers sur disque et horloge système).
- **Souveraineté et sécurité** : Serveur HTTP local strictement restreint à `127.0.0.1`, jeton de session aléatoire (`X-Bureau-Token`), aucune télémétrie sortante et aucun secret intercepté.
- **Zéro dépendance npm** : Entièrement conçu avec les modules standards de Node.js (`node:http`, `node:fs`, `node:crypto`, `node:test`).
- **Équipe de 10 agents testée** : Support de 24 outils d'IA, testé avec succès jusqu'à 10 agents simultanés (12 en envoi groupé, mosaïque 4 tuiles au plus).

---

## Documentation et liens

- [Guide d'installation détaillé (docs/INSTALLATION.md)](docs/INSTALLATION.md)
- [Guide d'utilisation et aide (docs/aide.md)](docs/aide.md)
- [Kit d'équipe et collaboration (docs/kit.md)](docs/kit.md)
- [Index de la documentation (docs/index.md)](docs/index.md)
- [Journal des versions (CHANGELOG.md)](CHANGELOG.md)
- [Guide de contribution (CONTRIBUTING.md)](CONTRIBUTING.md)
- [Mentions légales et marques (NOTICE.md)](NOTICE.md)

---

## Réalisé avec l'aide de l'IA

Ce projet a été concrétisé grâce à l'intelligence artificielle : Claude (Anthropic), Codex (OpenAI), Antigravity (Google) et OpenCode (MiMo) ont aidé à le concevoir, l'écrire et le tester. **L'auteur et le contributeur du projet est DrSmoke** ([BlackAngel242](https://github.com/BlackAngel242)) : les idées, les décisions et la publication sont les siennes, aucune IA ne signe de contribution. Détails dans [`docs/credits-ia.md`](docs/credits-ia.md).

## Licence

Distribué sous licence MIT. Consultez [LICENSE](LICENSE) pour plus d'informations.
