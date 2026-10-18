# MyTeam · Agent desk

> 🌐 **Language / Langue** : [Français](README.md) | **English**  
> 📚 **Complete Documentation** : [docs/index.en.md](docs/index.en.md) ([Français](docs/index.md)) | [Installation](docs/INSTALLATION.en.md) | [Help](docs/aide.en.md) | [GitHub Pages site](https://blackangel242.github.io/MyTeam/)

MyTeam shows your AI agents running in [Herdr](https://github.com/herdrdev/herdr) (website [herdr.dev](https://herdr.dev)) at work in a pixel art office: follow their status, send them instructions and read their replies. Everything stays on your machine: no npm dependency, no outbound request.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)
[![CI](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml/badge.svg)](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml)
[![Dependencies](https://img.shields.io/badge/dependencies-0%20npm-informational.svg)](package.json)

![Main scene in MyTeam](docs/captures/01-ordinateur-scene.png)

---

## Three benefits for your AI teams

- **Total and embodied visibility**: see who is typing, waiting, finishing, and taking a quota pause, with physical walking rounds by the chief during delegations.
- **Supervised autonomy and guardrails**: launch an autonomous cycle bounded by an objective, with an immediate emergency stop. The chief is told never to push, delete, install or publish without you.
- **Local sovereignty and factual truth**: exclusive listening on `127.0.0.1`, zero npm dependencies, and no invented percentages (everything comes from measured facts).

---

## Quick setup in 3 lines

```bash
git clone https://github.com/BlackAngel242/MyTeam.git && cd MyTeam
# On Windows: double-click "Installer MyTeam.bat" (or run: node server.mjs)
# On macOS / Linux: bash scripts/installer.sh (or run: node server.mjs)
```

Then open `http://127.0.0.1:4317` in your browser. Requirements: [Node.js](https://nodejs.org) >= 22 and [Herdr](https://github.com/herdrdev/herdr).  
To discover the 5 illustrated key features and the step-by-step guide, see the [detailed features in docs/aide.en.md](docs/aide.en.md#2-key-features) and the [installation guide in docs/INSTALLATION.en.md](docs/INSTALLATION.en.md).

---

## Factual truth and local security

- **Observed factual truth**: No invented percentages, no fake tasks, no simulated emotional states. Everything comes exclusively from real events measured on your machine (Herdr processes, local logs, disk files, and system clock).
- **Local sovereignty and security**: Local HTTP server strictly bound to `127.0.0.1`, random session token (`X-Bureau-Token`), zero outbound telemetry, and zero intercepted secrets.
- **Zero npm dependencies**: Built entirely with standard Node.js native modules (`node:http`, `node:fs`, `node:crypto`, `node:test`).
- **Tested with 10 agents**: Supports 24 AI tools, successfully tested up to 10 simultaneous agents (12 in group broadcast, mosaic 4 tiles at most).

---

## Documentation and links

- [Key features and user guide (docs/aide.en.md)](docs/aide.en.md#2-key-features)
- [Detailed installation guide (docs/INSTALLATION.en.md)](docs/INSTALLATION.en.md)
- [Team kit and collaboration (docs/kit.en.md)](docs/kit.en.md)
- [Documentation index (docs/index.en.md)](docs/index.en.md)
- [Changelog (CHANGELOG.en.md)](CHANGELOG.en.md)
- [Contributing guide (CONTRIBUTING.en.md)](CONTRIBUTING.en.md)
- [Legal notice and trademarks (NOTICE.en.md)](NOTICE.en.md)

---

## Built with the help of AI

This project was brought to life with the assistance of artificial intelligence: Claude (Anthropic), Codex (OpenAI), Antigravity (Google), and OpenCode (MiMo) assisted in designing, writing, and testing it. **The author and project contributor is DrSmoke** ([BlackAngel242](https://github.com/BlackAngel242)): ideas, architectural decisions, and releases remain his own, and no AI signs any contribution. Details in [`docs/credits-ia.md`](docs/credits-ia.md).

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
