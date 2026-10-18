# MyTeam · Bureau des agents

> 🌐 **Langue / Language** : **Français** | [English](README.en.md)  
> 📚 **Documentation complète** : [docs/index.md](docs/index.md) ([English](docs/index.en.md)) | [Installation](docs/INSTALLATION.md) | [Aide](docs/aide.md) | [Site GitHub Pages](https://blackangel242.github.io/MyTeam/)

MyTeam vous montre vos agents d'IA lancés dans [Herdr](https://github.com/herdrdev/herdr) (site [herdr.dev](https://herdr.dev)) au travail dans un bureau en pixel art : suivez leur état, envoyez-leur des consignes et lisez leurs réponses. Tout reste sur votre machine : aucune dépendance npm, aucun appel sortant.

[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)
[![CI](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml/badge.svg)](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml)
[![Dépendances](https://img.shields.io/badge/d%C3%A9pendances-0%20npm-informational.svg)](package.json)

![Scène principale de MyTeam](docs/captures/01-ordinateur-scene.png)

---

## Trois bénéfices pour vos équipes d'IA

- **Visibilité totale et incarnée** : voyez qui tape, qui attend, qui termine et qui prend une pause de quota, avec tournée physique du chef lors des délégations.
- **Autonomie supervisée et garde-fous** : lancez un cycle autonome cadré par un objectif, avec arrêt d'urgence immédiat. Le chef reçoit pour consigne de ne jamais pousser, supprimer, installer ni publier sans vous.
- **Souveraineté locale et vérité des faits** : écoute exclusive sur `127.0.0.1`, zéro dépendance npm, et aucun pourcentage inventé (tout vient des faits mesurés).

---

## Démarrage en 3 lignes

```bash
git clone https://github.com/BlackAngel242/MyTeam.git && cd MyTeam
# Sous Windows : double-cliquez sur "Installer MyTeam.bat" (ou : node server.mjs)
# Sous macOS / Linux : bash scripts/installer.sh (ou : node server.mjs)
```

Ouvrez `http://127.0.0.1:4317` dans votre navigateur. Prérequis : [Node.js](https://nodejs.org) >= 22 et [Herdr](https://github.com/herdrdev/herdr).  
Pour découvrir les 5 fonctions clés illustrées et le guide pas à pas, consultez les [fonctions détaillées dans docs/aide.md](docs/aide.md#2-fonctions-clés) et le [guide d'installation dans docs/INSTALLATION.md](docs/INSTALLATION.md).

---

## Vérité des faits et sécurité locale

- **Vérité des faits observés** : Aucun pourcentage inventé, aucune tâche simulée, aucun état émotionnel fictif. Tout provient exclusivement des faits réels mesurés sur votre machine (processus Herdr, journaux locaux, fichiers sur disque et horloge système).
- **Souveraineté et sécurité** : Serveur HTTP local strictement restreint à `127.0.0.1`, jeton de session aléatoire (`X-Bureau-Token`), aucune télémétrie sortante et aucun secret intercepté.
- **Zéro dépendance npm** : Entièrement conçu avec les modules standards de Node.js (`node:http`, `node:fs`, `node:crypto`, `node:test`).
- **Équipe de 10 agents testée** : Support de 24 outils d'IA, testé avec succès jusqu'à 10 agents simultanés (12 en envoi groupé, mosaïque 4 tuiles au plus).

---

## Documentation et liens

- [Fonctions clés et guide d'utilisation (docs/aide.md)](docs/aide.md#2-fonctions-clés)
- [Guide d'installation détaillé (docs/INSTALLATION.md)](docs/INSTALLATION.md)
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
