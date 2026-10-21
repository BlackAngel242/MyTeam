# MyTeam · Agent desk

**🌐 Official website: [https://blackangel242.github.io/MyTeam/](https://blackangel242.github.io/MyTeam/)** · [Français](README.md)

Watch your [Herdr](https://github.com/herdrdev/herdr) AI agents work in a pixel art office, send them instructions and read their replies. The office and its state run locally; AI tools use their own services.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)
[![CI](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml/badge.svg)](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml)
[![Dependencies](https://img.shields.io/badge/dependencies-0%20npm-informational.svg)](package.json)

[![Chief tour: live animated delegation](docs/captures/tournee-du-chef.gif)](https://blackangel242.github.io/MyTeam/)

- **Who does what, live**: who works, waits or finishes, tested with up to 10 agents.
- **You stay in control**: queue, crisis room, capped Autonomy mode you can stop.
- **Local and plain**: `127.0.0.1` only, zero npm dependencies, nothing invented on screen.

## Choose your project before working (0.5.0)

At startup, choose **Improve MyTeam** to work on the software, or **Create or resume another project** for your own folder. Select and confirm the folders before sending any instruction. The active project and folder remain visible; **Change project** returns to `/demarrage`, the startup screen and stops the previous context. Agents must work inside the selected folders: agents from another project are not authorized targets.

Execution memory (queue, direction, autonomy and configuration) is private, separated by project in the operating system data folder under `MyTeam`, outside the checkout. An older installation is never imported automatically. Changing projects does not replay old instructions.

Reviewed technical documents may be shared deliberately. The kit creates `HANDOFF.md` and `JOURNAL.md` inside `.myteam-local/`, ignored by Git, and never overwrites an existing file. `.gitignore` does not protect files already tracked or force-added; review files before publishing. AI tools keep their own logs, permissions and connections: MyTeam does not provide an operating system sandbox for those tools.

[Download MyTeam 0.5.1](https://github.com/BlackAngel242/MyTeam/releases/download/v0.5.1/MyTeam-0.5.1.zip)

## Built-in updates

From an official ZIP installation, MyTeam announces a new release in the desk. Use **Update and restart** in Help: the app downloads and verifies the SHA-256, stages the files and restarts automatically. The previous installation is kept as a backup alongside the app, while project data remains in the system data directory. Git checkouts must be updated with Git. Upgrading from 0.5.0 requires one manual download.

## Quick start

```bash
git clone https://github.com/BlackAngel242/MyTeam.git && cd MyTeam
node server.mjs   # or double-click "Installer MyTeam.bat" on Windows
```

Open `http://127.0.0.1:4317`. Requirements: [Node.js](https://nodejs.org) 22 or later and [Herdr](https://herdr.dev).

## Learn more

[Website](https://blackangel242.github.io/MyTeam/) · [User guide](docs/aide.en.md) · [Installation](docs/INSTALLATION.en.md) · [Team kit](docs/kit.en.md) · [Changelog](CHANGELOG.en.md) · [Contributing](CONTRIBUTING.en.md) · [Notices and trademarks](NOTICE.en.md)

## Built with the help of AI

This project was brought to life with the assistance of artificial intelligence: Claude (Anthropic), Codex (OpenAI), Antigravity (Google), and OpenCode (MiMo) assisted in designing, writing, and testing it. **The author and project contributor is DrSmoke** ([BlackAngel242](https://github.com/BlackAngel242)): ideas, architectural decisions, and releases remain his own, and no AI signs any contribution. Details in [`docs/credits-ia.md`](docs/credits-ia.md).

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
