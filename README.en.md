# MyTeam · Agent desk

> 🌐 **Language / Langue** : [Français](README.md) | **English**  
> 📚 **Documentation index** : [docs/index.en.md](docs/index.en.md) ([Index en français](docs/index.md))

An immersive and living pixel art dashboard to monitor, inspect, and direct your autonomous AI agent teams running in Herdr.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)
[![CI](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml/badge.svg)](https://github.com/BlackAngel242/MyTeam/actions/workflows/ci.yml)
[![Dependencies](https://img.shields.io/badge/dependencies-0%20npm-informational.svg)](package.json)

![MyTeam scene and workshop](docs/captures/01-ordinateur-scene.png)
> *Overview of the daytime scene: chief at the Direction desk, wall board with live indicators, team members at their dedicated workstations, and glass reflection room.*

---

## Table of Contents

- [Who is it for and why?](#who-is-it-for-and-why)
- [Quick Start](#quick-start)
  - [1. Automated setup](#1-automated-setup)
  - [2. Starting the office](#2-starting-the-office)
- [Features](#features)
  - [Animated scene and Direction desk](#animated-scene-and-direction-desk)
  - [Workstation tab and live terminal](#workstation-tab-and-live-terminal)
  - [Team tab, direction, and priority queue](#team-tab-direction-and-priority-queue)
  - [Files and Tasks tabs](#files-and-tasks-tabs)
  - [Command palette, help, and audio-visual cues](#command-palette-help-and-audio-visual-cues)
  - [Fullscreen mode](#fullscreen-mode)
- [Core Principles and Factual Integrity](#core-principles-and-factual-integrity)
- [Contributing](#contributing)
- [Maintenance without AI](#maintenance-without-ai)
- [License and Trademarks](#license-and-trademarks)

---

## Who is it for and why?

MyTeam · Agent desk is built for developers, researchers, and orchestrators running multiple AI agents in parallel (Claude Code, Codex, Antigravity, OpenCode, and others) managed by [Herdr](https://github.com/atoll92/herdr). It transforms a dry grid of terminal windows into a lively graphical workshop where every observable action counts.

- **Clear team hierarchy**: The Direction desk hosts the team chief, surrounded by collaborators at their dedicated desks.
- **Embodied task delegation**: When the chief delegates a prompt (`herdr agent prompt`), they walk across the room to place the golden folder directly on the collaborator's desk.
- **Priority queue and quota management**: Safely queue instructions for busy agents or those on quota breaks, with high-priority flagging, a "Move to the front" button, 1-minute automatic resumption via a short prompt after a quota pause lifts, and deferred dispatch.
- **Supervised autonomy (NoBabysitter)**: Start a scoped autonomous cycle defined by an objective (duration from 5 to 120 min, 3 to 60 exchanges at most). The chief coordinates in a star topology and delegates each step; the mode stops automatically on expiration, exchange cap, loop detection, crisis room, or server restart, and never runs a git push, deletion, installation, publication, or dialog response without DrSmoke.
- **Glass reflection room**: Subagents step away from their desk to deliberate together in a dedicated area before reporting back.
- **Factual task progress**: Direct aggregation of checked boxes in project Markdown files (`TODO.md`) and action plans published by agents, with zero invented percentages.
- **100% local with zero npm dependencies**: Standalone local server bound to `127.0.0.1`, no external npm packages, no outbound network requests, and no stored API keys.

---

## Quick Start

MyTeam runs on Windows, macOS, and Linux. It only requires [Node.js](https://nodejs.org) (v22 or higher) and [Herdr](https://github.com/atoll92/herdr). No package installation (`npm install`) is required.

### 1. Automated setup

Two installation methods are available depending on your workflow:

#### Method 1: From the release archive (recommended, no Git required)

1. Download the ZIP archive of the latest version from the GitHub repository [Releases page](https://github.com/BlackAngel242/MyTeam/releases).
2. Extract the archive into your preferred folder.
3. Launch setup:
   - **On Windows**: double-click `Installer MyTeam.bat`. If Node.js (v22 or higher) is detected, the animated installer starts immediately (pixel art gradient banner, live task list updating in real time, visual status badges, optional Clink step for cmd.exe convenience, and interactive y/n confirmations for each tool or integration). If Node.js is missing or too old, the script switches to secure text mode to offer Node.js installation via winget, then invites you to run the .bat file again for the animated setup experience.
   - **On macOS or Linux**: open a terminal in the folder and run `bash scripts/installer.sh` (or `node scripts/installateur-anime.mjs` if Node.js is already available).

> [!NOTE]
> **Windows SmartScreen warning**: Like any `.bat` script downloaded from the Internet without a costly commercial code-signing certificate, Windows SmartScreen may display a warning dialog ("Windows protected your PC"). You can safely proceed by clicking **More info** followed by **Run anyway**, or in advance by right-clicking the `.bat` file (or the `.zip` archive before extraction) > **Properties** > check the **Unblock** box at the bottom > **OK**.

> [!TIP]
> **Demo mode**: You can preview the installer terminal animation without installing anything or altering your system by running:
> ```bash
> node scripts/installateur-anime.mjs --demo
> ```

#### Method 2: By cloning the Git repository (for developers)

Clone the repository and run the setup script for your platform:

- **On Windows (PowerShell):**
  ```powershell
  git clone https://github.com/BlackAngel242/MyTeam.git
  cd MyTeam
  powershell -ExecutionPolicy Bypass -File scripts\installer.ps1
  ```
  *(or double-click `Installer MyTeam.bat` directly)*

- **On macOS or Linux (bash):**
  ```bash
  git clone https://github.com/BlackAngel242/MyTeam.git
  cd MyTeam
  bash scripts/installer.sh
  ```

> [!TIP]
> **What the installer does and does not do**: The scripts verify Node.js (>= 22) and Herdr, prepare a 2×2 Herdr grid (`Chef`, `Agent 2`, `Agent 3`, `Agent 4`), detect all 24 compatible tools, offer Clink on Windows (cmd.exe comfort via winget), official `herdr integration install` integrations, chief skill (`herdr --skill` or `CHEF.md`), orientation prompt, 3 desktop shortcuts (including combined "Herdr and desktop"), and team kit initialization (`node scripts/init-kit.mjs`). They install no external npm packages, neither request nor store API keys, and never auto-approve silent installations: the `-Oui` / `--oui` switch never auto-confirms installations or agent launches (individual y/n prompt remains mandatory). Useful options: `-DryRun` / `--dry-run` (simulation), `-Lang fr|en` / `--lang fr|en`, `-Port` / `--port`, `-HerdrChemin` / `--herdr-chemin`, `-SansRaccourci` / `--sans-raccourci`. Refer to [docs/INSTALLATION.en.md](docs/INSTALLATION.en.md) ([Français](docs/INSTALLATION.md)) for the complete guide.

### 2. Starting the office

Once requirements are met, launch the local server:

```powershell
node server.mjs
```

*(On Windows, you can also double-click `Ouvrir le bureau.cmd` or the combined "Herdr and desktop" shortcut)*

Then open the application in your browser:
```text
http://127.0.0.1:4317
```

### 3. 6-Step Post-Installation Walkthrough

1. **Open the shortcut**: Double-click the "Herdr and desktop" shortcut (or start Herdr and run `node server.mjs`).
2. **See the 4 panes and animated office**: Check the 4 panes in your 2×2 Herdr grid and explore the live office scene at `http://127.0.0.1:4317`.
3. **The chief reads CHEF.md**: In the Chef pane, the team chief reads `CHEF.md` and `AGENTS.md`, inspects team members with `herdr agent list`, and stands by.
4. **First delegation**: Send an initial prompt to the chief from the web office; watch their physical round across the office scene to deliver the folder to their teammate.
5. **Tasks tab**: Open the Tasks tab to monitor real-time factual progress of checked boxes in `TODO.md` and action plans published by agents, with zero invented percentages.
6. **Crisis room**: Locate the flip-covered "Salle de crise" (Crisis Room) button (`Ctrl+Shift+C`) to instantly freeze outgoing instructions and request a polite interruption via the Escape key.

---

## Features

### Animated scene and Direction desk

- **Chief at the Direction desk, transfer, and rounds**: The Direction desk hosts the team chief (default: first panel started in Herdr, or explicitly chosen by the user). Mail builds up on the desk as agents finish tasks; clicking the stack opens the Team tab. On every delegation observed in their local logs, the chief physically steps out, crosses the office to hand over the titled folder to the recipient, and returns to their desk. Leadership can be reassigned at any time, and the UI proactively proposes handover if the chief enters a quota limit break.
- **Continuous day-night cycle and evening ambiance**: The sky through the panoramic window follows your local system clock (6:30 AM sunrise, 7:30 PM sunset, season-neutral). Starting at 5:30 PM (and reaching full strength from 7:00 PM until morning), ceiling pendant lights and desk lamps automatically illuminate the workshop. Individual desk lamps turn off when an agent leaves on a quota break.
- **Wall-mounted dashboard**: Live scoreboard displaying key information not repeated on desks: quota recovery time (`RETOUR`), pending queued prompts (`EN FILE`), unread completion letters (`COURRIER`), and active subagents (`SOUS-AGENTS`).
- **Team board (corkboard modal)**: A corkboard with colored pins tracking open tasks and the "Tableau" button opens a read-only modal viewing the project's pillar files (`HANDOFF.md`, `TODO.md`, `AGENTS.md`, `LESSONS.md`), with timestamps and masked private paths.
- **Every desk at a glance**: Each desk displays its tool's 16x16 pixel art emblem on the front (Claude, Codex, Antigravity, OpenCode, and others). Below each desk, the agent's name is underlined with a thin status bar (sky blue for working, mint for available, amber for awaiting confirmation, purple for quota limit break). If Herdr connection drops, `HORS LIGNE` is displayed.
- **Visual poses and status bubbles**: Typing animation when working, holding a mug when available, raised hand with "?" bubble when awaiting confirmation, green checkmark when done, and "..." for transient states.
- **Quota break and "RETOUR" sign**: When an agent hits its token or rate limit, their chair empties, desk lamp switches off, a purple standby light blinks, and a desktop easel displays the exact resume time reported by the tool.
- **Glass reflection room for subagents**: A dedicated area labeled "SALLE DE REFLEXION" where subagents assemble before delivering their completed dossiers.
- **"Disposer" layout mode**: The "Disposer" button allows freely moving desks across the floor using the mouse or keyboard arrow keys, or stretching the Direction desk's gold handle to resize it. Pressing Escape saves positions.
- **Mosaic mode (multi-terminal monitoring)**: The "Mosaïque" / "Vue scène" toggle (also accessible via `Ctrl+K`) replaces the graphical scene with a grid of 2 to 4 live terminal tiles. Working agents are sorted first, with toggle between 2x2 grid and columnar layouts, tile selector when over 4 agents are connected, reactive text search with match counts, quick prompt dispatch (`Ctrl+Enter`), "Agrandir" button to expand a single station, and resource-conscious polling (3s interval, paused on hidden tab, one request per tile, preserving text selections).
- **Animation pause and accessibility**: A "Mettre en pause" button freezes canvas rendering. If your operating system has `prefers-reduced-motion` enabled, animations are frozen by default while still updating every minute to reflect the time of day.

### Workstation tab and live terminal

- **Direct selection**: A clean landing view presents fast buttons to pick an agent. On mobile, selecting an agent scrolls automatically to their workstation panel.
- **Tool status bar**: Displays current task or active thought extracted directly from the tool, active model, mode, effort, remaining quota gauge with reset time, and elapsed run time.
- **Raw terminal output**: Streams raw lines from the selected agent's Herdr terminal.
- **Utility controls**: Instant search with occurrence highlighting and match counter, "Freeze" button to freeze autoscroll, "Copy" button to copy buffer, and "Expand" button for comfortable full-height reading.
- **Selection freeze**: Selecting text inside the output terminal automatically suspends polling so your selection is never cleared mid-read.
- **"Readable answers" structured response view**: An expandable drawer below the terminal renders formatted Markdown responses from local session logs (Claude, Codex, OpenCode). Includes safe rendering without `innerHTML`, block code copy, source Markdown copy, `.md` file export (marked "partial" if ongoing), and accessible clipboard fallbacks.
- **Prompt form, queuing, and priority**: If the agent is available, prompts are dispatched immediately (`Ctrl+Enter` or `Cmd+Enter`). If the agent is busy or on quota break, the button becomes "Queue prompt" to safely queue the message. A "Priority" checkbox tags urgent instructions (`priority: "haute"`) to jump ahead of regular instructions for that agent.
- **Draft preservation**: Switching agents while typing preserves unsent drafts individually.

### Team tab, direction, and priority queue

- **Team direction and handoff**: Displays the active team chief and allows appointing any connected agent as chief or resetting to default (first panel). Changes persist in `.bureau/direction.json`. If the chief enters a quota break, a banner proposes handing the chief role over to an available substitute. The handover instruction is reviewed before sending.
- **Chief's mail**: Logs completed tasks with counter in the section title; the list resets when viewing the Team tab. Clicking a mail item navigates directly to that agent's terminal.
- **Collective queue and priority management**: Lists all deferred instructions with targets, statuses, and priority levels ("haute" or "normale"). A "Move to front" button promotes regular instructions. High-priority items are sent first as soon as the agent becomes free. An automatic anti-starvation guard promotes normal instructions waiting over 30 minutes to high priority. Any queued item can be cancelled with one click.
- **Attached files and entrusted files**: Attach local files to queued instructions (up to 2 files of 20 MB). Files are copied without overwriting into the agent's workspace before dispatch, and observed processing facts are logged in the "Entrusted files" section.
- **Control room discussion feed**: Aggregates excerpts of the latest responses from the entire team sorted newest to oldest. Agents that could not be read are reported at the bottom with reason.
- **"Crisis Room" emergency circuit breaker**: An emergency safety button behind a protective flip cover (`Ctrl+Shift+C` or command palette) immediately blocks all prompt dispatches (HTTP 423) and freezes the queue without data loss. An amber security glow frames the scene, and a diagnostic modal shows live statuses and recent terminal lines for each agent. The user can request a polite stop (`POST /api/crise/arret`) sending the canonical Escape key (`esc` in Herdr) after double confirmation, never using a hard kill. Persisted atomically in `.bureau/crise.json`.
- **Broadcast message**: Select available agents or click "Check all available". First click arms the dispatch showing recipient list; second click confirms individual dispatch via Herdr.
- **Chief listening relay**: Subtle option persisted in `.bureau/relais.json` (disabled by default) queuing a neutral notification to the chief when a teammate completes a task ("{name} just finished. Review its pane before delegating the next step."). Never triggered during a crisis or for the chief itself.
- **Dispatch log**: Logs full session dispatch history with timestamps, recipients, text, and status returned by Herdr.

### Herdr 24 Tools Compatibility Matrix

The office accurately detects and visualizes the 24 tool types supported by Herdr:

| Support tier | Tools | Supported capabilities |
|---|---|---|
| **Universal support (24 tools)** | `pi`, `claude`, `codex`, `gemini`, `cursor`, `devin`, `agy`, `cline`, `omp`, `mastracode`, `opencode`, `copilot`, `kimi`, `kiro`, `droid`, `amp`, `grok`, `hermes`, `kilo`, `qodercli`, `qwen`, `letta`, `maki`, `muse` | Auto-detection, dedicated desk, 16×16 pixel art emblem, raw Herdr status (busy, idle, wait, done, quota break), prompt dispatch, queueing, and live raw terminal output. |
| **Deep enriched telemetry (3 tools)** | **Claude Code**, **Codex**, **OpenCode** | Read-only local transcript parsing: structured Markdown answers in "Readable answers", token counting and turn extraction, team discussion feed, and published action plans. Other tools clearly indicate "Not exposed by this tool". |

### Files and Tasks tabs

- **Files tab (Secure Explorer)**: Fast inspection of files created or modified in the last 48 hours in the selected agent's workspace, or step-by-step folder navigation with breadcrumbs. Access is strictly scoped to the agent's workspace, Desktop, Documents, and Downloads. "Show in folder" button reveals the file in file manager. Safe drag-and-drop copies files; Shift + drag-and-drop moves files after confirmation. No file deletion or overwriting is permitted (automatic numeric suffixing).
- **Tasks tab (Factual tracking with percentage)**: Observes checkboxes in project Markdown files (`TODO.md`) and action plans published by agents. Progress bar and percentages are calculated strictly from the ratio of checked tasks. If no plan is published, it faithfully indicates "No plan published by an agent yet".

### Command palette, help, and audio-visual cues

- **Command Palette (`Ctrl+K`)**: Opens a keyboard modal to search for an agent, open their station, write an instruction, view the team board, switch tabs, or trigger actions without using the mouse.
- **Contextual Help drawer (`?` key)**: Side panel accessible via "Help" button or `?` key, presenting a 7-step guided tour, visual scene legend, keyboard shortcuts reference table, and sound settings.
- **Instant Bilingual Interface (FR / EN)**: "FR / EN" button in the top toolbar to instantly switch the entire interface between French and English (saved in browser localStorage).
- **Signals: 8-bit sound effects and desktop notifications**: System notifications when the browser tab is hidden (checks every 15s), and synthesized 8-bit Web Audio chimes (`public/sounds.js`) for blocked states, task completions, quota breaks, and delegations. Preferences are saved in localStorage.

### Fullscreen mode

The "Fullscreen" button in the upper-right corner expands the app to full screen, maintaining both the animated pixel scene AND the workstation/team panel together in a single panoramic control view. Pressing Escape exits fullscreen.

---

## Core Principles and Factual Integrity

MyTeam adheres to strict engineering rules:

1. **Observed factual truth**: The office never simulates agents, never invents progress percentages, fake tasks, or fictional states. Everything originates exclusively from measured facts (Herdr processes, local logs, disk files, system clock).
2. **Respect for human authority**: The application never makes decisions on your behalf. It never auto-approves confirmation prompts, never selects directories without permission, and never forces dispatches.
3. **Absolute local privacy**: Binds strictly to `127.0.0.1`, verifies exact origin, and requires a random session token (`X-Bureau-Token`). No arbitrary paths from the browser are accepted.
4. **Zero npm dependencies**: Server and scripts rely 100% on Node.js built-ins (`node:http`, `node:fs`, `node:crypto`, `node:child_process`, `node:test`).
5. **Shared lessons memory**: Every mistake encountered is documented in `LESSONS.md` to prevent future regressions.

---

## Built with the Help of AI

This project was built with the assistance of artificial intelligence: Claude (Anthropic, Opus 5.5 and Sonnet 5.5), Codex (OpenAI, GPT-6.1-Sol), Antigravity (Google, Gemini 3.8 Flash), and OpenCode (MiMo V2.6 Pro) assisted in its design, implementation, and testing. **The sole author and contributor of the project is DrSmoke** ([BlackAngel242](https://github.com/BlackAngel242)): ideas, architectural choices, and releases are his; no AI signs contributions. Full credits in [`docs/credits-ia.en.md`](docs/credits-ia.en.md) ([Français](docs/credits-ia.md)).

## Contributing

Contributions that align with the project's philosophy (technical independence, factual truth, pixel art aesthetics, and accessibility) are welcome.

- Refer to [CONTRIBUTING.en.md](CONTRIBUTING.en.md) ([Français](CONTRIBUTING.md)) for architectural guidelines, setup steps, and PR checklist.
- Review the code of conduct in [CODE_OF_CONDUCT.en.md](CODE_OF_CONDUCT.en.md) ([Français](CODE_OF_CONDUCT.md)) and the security policy in [SECURITY.en.md](SECURITY.en.md) ([Français](SECURITY.md)).
- Review release history in [CHANGELOG.en.md](CHANGELOG.en.md) ([Français](CHANGELOG.md)).
- Explore the complete public documentation index in [docs/index.en.md](docs/index.en.md) ([Français](docs/index.md)).
- Before submitting, verify syntax (`npm run check`) and ensure all tests pass (`npm test`).

---

## Maintenance without AI

- **Code organization**:
  - `public/`: Web frontend (semantic HTML5, CSS styles, pixel art canvas renderer, 16x16 logos, terminal engine, and Web Audio sounds).
  - `src/herdr.mjs`: Local bridge with the Herdr process manager.
  - `src/claude-activity.mjs` and `src/agent-activity.mjs`: Non-destructive extraction of live tool activity.
  - `src/files.mjs`: Secure file explorer backend.
  - `src/queue.mjs`: Atomic priority queue with disk persistence.
  - `src/direction.mjs`: Team chief tracking and persistence.
  - `src/todos.mjs`: Factual extraction of task plans.
  - `src/blackboard.mjs`: Extraction and structured parsing of the corkboard from project Markdown sections.
  - `src/crisis.mjs`: Crisis room handling, HTTP 423 dispatch locking, and atomic persistence.
  - `src/delegations.mjs`: Detection and tracking of delegations in the chief's log over a rolling 12-hour window.
  - `src/relais.mjs`: Neutral listening relay notifying the chief when an agent completes a task.
  - `src/responses.mjs`: Turn-by-turn parsing and extraction of readable assistant responses.
  - `src/terminal-status.mjs`: Live detection of quota pauses and session limits in terminal streams.
  - `src/autonomie.mjs`: Supervised star autonomy engine (NoBabysitter), exchange and duration caps, loop detection, and safety stops.
  - `server.mjs`: Hardened native HTTP server.
  - `scripts/`: Setup and verification scripts (`installer.ps1`, `installer.sh`, `init-kit.mjs`, `evaluer.mjs`, `partager-lecons.mjs`).
- **Environment variables**:
  - `BUREAU_PORT`: Customizes listening port (default `4317`).
  - `BUREAU_HERDR_PATH`: Absolute path to the Herdr binary if not in PATH.
- **Verification commands**:
  - `npm test`: Runs full automated test suite using `node:test` (the command displays the exact test count on each run).
  - `npm run check`: Validates syntax of all JavaScript files via `node --check`.
- **Clean shutdown**: Use `Ctrl+C` in the terminal running `node server.mjs`.

---

## License and Trademarks

MyTeam source code is released under the **MIT License** (see [LICENSE](LICENSE)).

Third-party names, trademarks, and logos (Claude, Codex, Antigravity, OpenCode, Gemini, Herdr, and all 24 supported tools) remain the property of their respective owners. Pixel art representations in `public/logos.js` are used solely to visually distinguish tools occupying each workstation, without commercial affiliation or endorsement: see [NOTICE.en.md](NOTICE.en.md) ([Français](NOTICE.md)).

DrSmoke « Un Mbokatié engagé »

**Optional footer.** To show your own information at the bottom of the desk, create the file `.bureau/pied.json` (local, never published): `{"gauche": "your text", "droite": "a contact", "enseigne": "MY TEAM DESK"}` (`gauche` = left, `droite` = right). Without this file only DrSmoke « Un Mbokatié engagé » is shown. `enseigne` is the neon sign on the scene wall: absent by default.
