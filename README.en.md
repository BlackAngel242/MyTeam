# MyTeam · Agent desk

> 🌐 **Language / Langue** : [Français](README.md) | **English**  
> 📚 **Complete Documentation** : [docs/index.en.md](docs/index.en.md) ([Français](docs/index.md)) | [Installation](docs/INSTALLATION.en.md) | [Help](docs/aide.en.md) | [GitHub Pages site](https://blackangel242.github.io/MyTeam/)

MyTeam shows your AI agents running in [Herdr](https://github.com/herdrdev/herdr) (website [herdr.dev](https://herdr.dev)) at work in a pixel art office: follow their status, send them instructions and read their replies. Everything stays on your machine: no npm dependency, no outbound request.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)
[![CI](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml/badge.svg)](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml)
[![Dependencies](https://img.shields.io/badge/dependencies-0%20npm-informational.svg)](package.json)

---

## What you see in 30 seconds

1. **The chief at the Direction desk**: The team chief coordinates tasks, receives milestone mail, and physically walks across the room to hand over folders to teammates.
2. **Dedicated visual workstations**: Each AI (Claude Code, Codex, Antigravity, OpenCode, and 20 others) works at its own desk with a 16×16 pixel art badge, genuine posture cues, and explicit quota pauses (team capacity tested up to 10 agents, 12 in group broadcast).
3. **Supervised Autonomy (NoBabysitter)**: A permanent toolbar toggle switch sets a scoped autonomous run bounded by an objective, a time limit (5 to 120 min), and an exchange cap (3 to 60), with immediate emergency stop guards.
4. **Multi-terminal Mosaic monitoring**: Switch in one click to a live multi-terminal view (4 tiles at most) with instant text search and quick prompt dispatch.
5. **Crisis Room circuit breaker**: Under unexpected circumstances, a guarded button (`Ctrl+Shift+C`) instantly freezes all outgoing prompts without killing running processes.

---

## 5 key features

### 1. Animated scene and Direction desk
The Direction desk hosts the team chief. On each delegation observed in the chief's local log, the chief leaves the desk, walks across the workshop, and delivers the golden folder directly to the teammate. The room lighting adjusts automatically to local time, with morning sunrise and warm desk lamps turning on at 7:00 PM.

![Main scene in MyTeam](docs/captures/01-ordinateur-scene.png)

### 2. Workstation tab and live output
Every collaborator has live terminal output, with instant search and highlighting of errors and waiting states, and a separate instruction field. Markdown replies are extracted without log noise. A priority queue defers instructions for busy agents or those on quota pauses: an availability notice goes out one minute after a pause lifts, and the queue waits 5 more minutes before resending an instruction that stayed queued.

![Workstation and terminal](docs/captures/02-ordinateur-poste.png)

### 3. Live multi-terminal Mosaic
The Mosaic mode displays collaborator terminals side-by-side (4 tiles at most) to monitor work in real time, while the overall team capacity is verified up to 10 agents (12 in broadcast). It features synchronized text search across all tiles, quick prompt dispatch (`Ctrl+Enter`), and an energy-efficient refresh loop that suspends when the tab is hidden.

![Multi-terminal mosaic mode](docs/captures/11-ordinateur-mosaique.png)

### 4. Supervised autonomy (NoBabysitter)
The permanent "Autonomy OFF/ON" switch starts a star-topology coordination loop where the chief decides and delegates each step toward the designated goal. The mode stops by itself on timeout, exchange cap, detected loop or crisis room. It reminds the chief never to `git push`, delete, install or publish without you: this is a precaution, not a technical lock, the server does not control the chief's commands. A Summary button extracts the full factual Markdown report directly from the event log.

![Active autonomy mode](docs/captures/23-ordinateur-autonomie-fenetre-active.png)

### 5. Guarded Crisis Room
Accessible via shortcut (`Ctrl+Shift+C`) or from the toolbar, the Crisis Room immediately blocks all outgoing prompts (HTTP 423) and displays live diagnostic tail outputs for every agent. It enables sending a polite Escape key stop without terminating processes.

![Crisis room](docs/captures/12-ordinateur-crise.png)

---

## Quick setup in 3 lines

```bash
git clone https://github.com/BlackAngel242/MyTeam.git && cd MyTeam
# On Windows: double-click "Installer MyTeam.bat" (or run: node server.mjs)
# On macOS / Linux: bash scripts/installer.sh (or run: node server.mjs)
```

Then open `http://127.0.0.1:4317` in your browser.  
*Requirements: [Node.js](https://nodejs.org) >= 22 and [Herdr](https://github.com/herdrdev/herdr). Zero npm dependencies required.*

For the step-by-step setup guide, demo mode, and options, see [docs/INSTALLATION.en.md](docs/INSTALLATION.en.md).

---

## Factual truth and local security

- **Observed factual truth**: No invented percentages, no fake tasks, no simulated emotional states. Everything comes exclusively from real events measured on your machine (Herdr processes, local logs, disk files, and system clock).
- **Local sovereignty and security**: Local HTTP server strictly bound to `127.0.0.1`, random session token (`X-Bureau-Token`), zero outbound telemetry, and zero intercepted secrets.
- **Zero npm dependencies**: Built entirely with standard Node.js native modules (`node:http`, `node:fs`, `node:crypto`, `node:test`).
- **Tested with 10 agents**: Supports 24 AI tools, successfully tested up to 10 simultaneous agents (12 in group broadcast, mosaic 4 tiles at most).

---

## Documentation and links

- [Detailed installation guide (docs/INSTALLATION.en.md)](docs/INSTALLATION.en.md)
- [User guide and help (docs/aide.en.md)](docs/aide.en.md)
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
