# Changelog

[Français](CHANGELOG.md) | **English**

All notable changes to The Agent Office (MyTeam) project are documented in this file. The format is based on Keep a Changelog.

## [Unreleased]

_Nothing yet._

## [0.4.1] - October 18, 2026

### Added

- Supervised Autonomy mode (NoBabysitter):
  - "Autonomy" button in the top toolbar and `/api/autonomie` server endpoint to run a scoped, supervised autonomous work cycle.
  - Star-shaped topology around the team chief: the chief receives task completion notices from teammates, decides the next step alone, and delegates it; no agent communicates directly with another.
  - Strict caps: clear objective (5 to 300 characters), maximum duration (5 to 120 minutes, 30 min default), and exchange cap (3 to 60, 20 default).
  - Automatic and safe stops: expiration of time limit, exchange cap reached, loop detected (repeated finishes within 10 minutes), crisis room activation, server restart, or manual stop button.
  - Live toolbar status (remaining time and exchange ratio) and factual event log tracking observable facts.
- Quota pause with countdown and automatic resumption:
  - Robust extraction of resume times from terminal outputs, including times wrapped onto the following line.
  - Resume deadline remembered upon first detection to prevent lingering terminal messages from keeping an agent paused past reset.
  - Live countdown on workstation list, status bar, and scene desk easel, with completion notification.
  - Automatic resumption: one minute after a quota pause lifts, the server enqueues a short prompt reminding the agent to reply "dispo" and resume in-progress work without redoing already committed work.
- In-progress request tracking in TODO and wall corkboard:
  - Factual tracking in Tasks tab of ongoing requests sent to agents (chief mail, queue), checked only once the agent returns a completed response after dispatch.
  - Pixel art corkboard on the back wall showing open task counts from `TODO.md` with color-coded pins.
  - Claude session discovery via process PID (`~/.claude/sessions/<pid>.json`), restoring activity log, subagents, delegations, and chief responses.
- Static GitHub Pages site (`site/`):
  - Bilingual static website presenting MyTeam on desktop and mobile, showcasing the pixel art scene, Mosaic mode, Crisis Room, and supervised autonomy, with zero external dependencies.
- CI and release maintenance:
  - Release retention script (`scripts/garder-releases.mjs`) retaining at most the 2 most recent releases.
  - Archive verification checking git revision and zip structure during packaging.

### Security

- Unified public mask (`src/masque.mjs`):
  - Single module applying three strict masking rules for local file paths (`C:\...`, `/home/...`) and sensitive credentials or tokens.
  - Explicit preservation of Web URLs (`http://`, `https://`).
  - Extended masking to subagent descriptions, autonomy objective and log, and exclusion of third-party recipients in Codex responses.
- Hardened Crisis Room:
  - Crisis lock maintained even if writing state to disk fails.
  - State re-verified after parsing request body and immediately before prompt dispatches.
- Autonomy and queue safety:
  - Autonomy stop serialized with active dispatch, and pending autonomy prompts purged upon stop or server restart.
  - Strict re-verification of target readiness, working directory, and availability right before queue dispatch.
  - Queue write budget aligned with read budget, with explicit rejection before acceptance.
- Hardened installer security:
  - Immediate rejection of invalid port numbers before any change.
  - Exclusive file move preventing overwrites, requiring interactive confirmation.

### Changed

- Accessibility and UI ergonomics (lot L):
  - Accessible fallback modal: inert backdrop, trapped focus, and automatic help without focus theft.
  - Dynamic toggles using `data-actif` instead of `aria-pressed`.
  - Command palette (`Ctrl+K`) disabled while Crisis Room is active.
  - Resource-conscious rendering: agent list redrawn only on data changes, scene drawing suspended under Mosaic view, and background polling spaced to 15 seconds.
  - Unified vocabulary: consistent informal address ("tutoiement") in French UI and server notices, unified English terms (`chief` instead of `lead`, capitalized `Mosaic`).
  - Queue recovery warning prominently displayed in the Team tab.
- Office decor customization:
  - Scene wall neon sign and footer made optional and customizable via `.bureau/pied.json`, without forced author or contact details.

### Fixed

- Byte continuity verification: byte checks ensure file integrity before resuming incremental read offsets in Claude activity and tasks.
- Windows compatibility: reliable detection and execution of setup scripts in the presence of 8.3 short paths (`PROGRA~1`).
- Help documentation: removed obsolete reference to non-existent "Skip tour" button, and aligned English labels with live UI strings.

## [0.4.0] - October 18, 2026

### Added (installation and release)

- Animated installer (`scripts/installateur-anime.mjs`): banner revealed line by line, timeline and live task list (done, skipped, failed), yes/no questions and choices under the list, plain-text fallback outside a terminal, `--demo` to see the animation without installing anything.
- `Installer MyTeam.bat`: double-click the file from the release zip; animated installer when Node.js 22 or later is present, otherwise the text installer, which offers Node.js.
- Optional Clink step (Windows, individual confirmation, `winget install chrisant996.Clink`).
- Protocol between the installer and its interface (`docs/installeur-protocole.md`); the PowerShell and bash installers speak it with `-Interface` / `--interface`.
- `scripts/empaqueter-release.mjs`: zip archive of the files tracked by Git, without the internal working notes.

### Fixed

- Sounds and empty-state icons: `sounds.js` and `empty-icons.js` were not loaded by the page ("Sounds: module missing"); a test now requires every script in `public/` to be loaded and served.


### Fixed

- Draft preservation on enqueue (G1): enqueueing a prompt for an agent then switching workstations during the network request no longer clears drafts on other stations.
- Protected browser read validity (G2): local browser GET requests (`/api/queue`, `/api/todos`, `/api/places`, `/api/files/*`) are validated using `Sec-Fetch-Site` when `Origin` header is absent, preventing false "Session expired" error notices.
- Quota pause deadline calculations (M2): deadline announcements in terminal outputs (such as "try again at 4:45 PM") preserve the calculated resume time upon re-reading rather than postponing to the next day; invalid times are rejected and UTC/GMT mentions are respected.
- Accurate quota limit labeling (M3): a 24-hour window displays "24 h" instead of "weekly", and only limits reached at 100% determine resume times.
- Static script distribution (M4): the local HTTP server exposes secure static routes for `/sounds.js` and `/empty-icons.js`.
- Respect for reduced motion (M8): system preference `prefers-reduced-motion` freezes animated canvas by default without manual toggle, while maintaining a 1-minute tick to update time, sky, and lighting.
- Expanded terminal height on mobile (M9): the "Agrandir" button applies a priority CSS rule ensuring substantial height gain (between 62% and 80% of screen height, with internal scrolling tracking the last line) on smartphones.
- Truly modal command palette (M1): backdrop is inert, Tab key stays trapped in the palette, focus returns to trigger or open tab; Escape closes only one layer at a time (palette, then Arrange mode, then help drawer); Arrange arrow keys do not intercept list navigation; first-visit help does not open if an action has already begun.
- Background notifications (M5): when Windows notifications are enabled, agent states are polled every 15 seconds while page is hidden, without canvas animation.
- Stable rerenders (M6): landing cards, queue, and tasks are only redrawn when content changes; focused button is preserved, recurring failures are notified only once, and slow responses do not overwrite newer reads.
- Bounded memory (M7): 30 mail items retained in detail (counter covers full session), up to 500 delegation IDs tracked, dropped agent caches purged.

### Added

- Task board with percentage: factual calculation and display of completion percentage based on checked boxes in `TODO.md` and action plans published by agents in their local logs.
- Readable agent responses: `public/response-card.js` component and `.rc-` styles beneath workstation terminal (hooked to `GET /api/reponses`), rendering structured responses in safe Markdown without `innerHTML`, accurate source text copy, code block copy buttons, local `.md` export (single turn or full session), accessible clipboard fallback, and stable key reconciliation without breaking active text selection (Claude, Codex, OpenCode).
- File attachments and entrusted files: ability to attach local files to queued instructions with safe non-overwriting copy into the agent's working directory before dispatch, 2 files / 20 MB cap, and factual tracking of processing milestones in Team tab via `GET /api/traitement`.
- Team discussion stream: `public/discussion.js` component and `.disc-` styles in control room (hooked to `GET /api/discussion`), assembling excerpts of recent responses across the entire team ordered newest to oldest, with explicit notice for unread agents ("not exposed by tool", "not matched with certainty").
- Hardened installer security: `scripts/installer.sh` and `scripts/installer.ps1` hardened against trap directories (`$(command)`), strict rejection of auto-approval flags (`--oui` / `-Oui`) requiring interactive y/n confirmation, and strict resolution of Herdr binary.
- Team board: "Tableau" button and corkboard on canvas wall opening a read-only modal viewing pillar files (`HANDOFF.md` stage, `TODO.md` open boxes, `AGENTS.md` roles, `LESSONS.md` latest rules), with source and timestamp per file. Token-protected `/api/tableau` route, closed file list, masked paths and IDs.
- Staged quota break: when an agent enters quota pause, they leave their seat with empty battery; their easel alternates between resume time and countdown; upon resumption, they return with full battery. Nothing is animated on initial page load.
- Lead rounds: on observed delegations (`herdr agent prompt`), the lead leaves Direction, places the titled folder on the target agent's desk, and walks back. One round at a time.
- Crisis room (G1, G3): flip-covered emergency circuit breaker ("Salle de crise", shortcut `Ctrl+Shift+C` or command palette), amber safety halo, calm diagnostic displaying last terminal lines per agent, immediate lock on all direct sends and queue freeze (HTTP 423), and polite per-agent interruption sending canonical Escape (`esc` in Herdr) after human confirmation, without brutal process kills. Atomic persistence in `.bureau/crise.json` (defaults to active on file corruption).
- Mosaic mode (G2, G4): switchable multi-terminal view replacing canvas scene ("Mosaïque" / "Vue scène", palette command), prioritizing active agents, toggle between "Grille 2×2" and "Colonnes", tile picker for >4 agents, clean terminal outputs stripped of ANSI codes with highlighted text search and match counter, quick prompt field (`Ctrl+Enter`) disabled with explanation when agent is unavailable, "Agrandir" button opening individual station, and bounded economical polling (every 3s, paused when tab hidden, one read at a time per tile, preserving active text selections).
- Bilingual FR / EN interface: instant toggle via top header "FR / EN" button (persisted in `localStorage` under `bureau.langue`), automatic detection from system or browser language (`navigator.language`), full translation of all screens, forms, help drawers, and server error messages without external page reload.
- Lead listening relay: optional feature in Team tab (off by default, persisted in `.bureau/relais.json`), dispatching a neutral message to the active lead via queue when an agent transitions from working to available ("an agent just finished, read its pane"), with minimum 1-minute interval per agent, strict deduplication, and complete shutdown during crisis.
- Team kit and evaluation tooling: `scripts/init-kit.mjs` setup script (non-overwriting deployment of pillar files `AGENTS.md`, `CHEF.md`, `LESSONS.md`, etc.), factual self-evaluation script `scripts/evaluer.mjs` (verifying pillars, checked boxes, and tests with zero invented metrics), and `scripts/partager-lecons.mjs` dissemination script (recording lessons in `LESSONS.md` and gently notifying available Herdr agents only), documented in `docs/kit.en.md`.
- 24 pixel art Herdr tool emblems: integration in `public/logos.js` of 16×16 emblems for all 24 Herdr-supported tools (`pi`, `claude`, `codex`, `gemini`, `cursor`, `devin`, `agy`, `cline`, `omp`, `mastracode`, `opencode`, `copilot`, `kimi`, `kiro`, `droid`, `amp`, `grok`, `hermes`, `kilo`, `qodercli`, `qwen`, `letta`, `maki`, `muse`) plus generic agent fallback, displayed on desk fronts, agent cards, and mosaic tiles.
- Official Herdr integrations: support and documentation for `herdr integration install <tool>` integrations enabling fine-grained session reporting and agent activity tracking in Herdr.
- 7-step guided tour and help: upgrade of interactive help drawer and documentation to a 7-step walkthrough (adding steps 6 Mosaic and 7 Crisis Room).

### Changed

- Evening lighting: ceiling pendant lights and desk lamps illuminate starting at 5:30 PM until morning based on local clock; desk lamp of an agent on quota break remains off.
- Wall scoreboard: displays resume time of quota pause, queued prompts, unread mail, and active subagents instead of repeating card states.
- Under each desk, agent name only underlined with state color; state is conveyed through card, character pose, screen glow, and bubble.
- Reflection room fixed label: "SALLE DE REFLEXION" never truncated regardless of activity.
- Touchscreens: "Touche" instead of "Clique", status pill padding adjusted to prevent overflow on mobile.
- Multi-target lead command: dispatches visual rounds for each targeted agent sequentially rather than stopping at the first.

## [0.3.0] - October 17, 2026

### Added

- Intelligent and safe queue:
  - "Mettre en file" button available on workstation when agent is busy or on quota break.
  - Queue list in Team tab showing targets, status, and single-item cancel buttons.
  - Scheduled automatic retry 5 minutes after reported quota reset time (`reset + 5 min`).
  - Strong double-send protection (idempotence key, persistent send state prior to external calls, atomic disk writes, preserved corrupt files).
- Tasks tab:
  - Tracking real checked boxes in project documentation files (`TODO.md`).
  - Tracking action plans published by agents in their local logs.
  - Strict factual progress calculation based only on observed facts, without invented estimates.
- Collapsible help drawer:
  - Lateral help drawer opened via dedicated button or `?` key, activated on first visit.
  - Guided tour, zone visual legend, full keyboard shortcuts reference.
  - Signal toggles (desktop notifications and sound chimes).
- Modal command palette (`Ctrl+K`):
  - Fast search dialog with keyboard navigation to open a workstation, draft prompts, browse files, or switch modes.
- 8-bit Web Audio module (`public/sounds.js`):
  - Standalone audio synthesizer without external audio files providing 4 discreet alerts (< 0.6s, max gain 0.05): task finished ('mail'), agent blocked ('blocked'), quota pause ('pause'), and delegation ('delegation').
  - Stored in `localStorage` under `bureau.sons`.
- Windows desktop notifications:
  - System alerts when page is in background for blocks, completions, and quota pauses.
- Continuous day-night cycle and lighting ambiance:
  - Smooth sky gradient following local clock with fading stars and city lights.
  - Diurnal arc for sun and moon (warm sun near horizon, fixed 6:30 AM sunrise, 7:30 PM sunset).
  - Dynamic ambient lighting in main room, Direction desk, and reflection room.
- Collapsible reflection room:
  - Subagent animations in dedicated room with collapse toggle for small screens.
- Direction desk:
  - Dedicated VIP workstation for the first agent started in Herdr (team lead), with clickable mail stack opening Team tab directly.
- Delegation cycle and lead mail:
  - Observation of delegation commands (`herdr agent prompt`), walking animation to fetch tasks, and mail to lead upon completion.

### Changed

- Design review synthesis applied (decisions D1 to D8):
  - D1: Unified main state "En pause (limite)" across cards, workstation sheets, and command palette during observed pauses.
  - D2: Arrangement help bar placed on its own row beneath toolbar to prevent overlap with alert banner.
  - D3: Agent cards structured on two rows (name then status) with compact Herdr pane pill and 2-column grid under 1360px.
  - D4: Streamlined Team tab with single synthetic sentence per section and counters in headers.
  - D5: Workstation terminal sized to fill available height with "Agrandir" / "Réduire" button.
  - D6: Unified error blocks with clear explanation and "Actualiser le bureau" button; 6 empty state pixel art icons (`public/empty-icons.js`).
  - D7: Engaging landing card in Workstation tab inviting user to select an agent.
  - D8: Mobile responsive layout verified at 390px and 360px widths without horizontal overflow.
- Automated test suite extension: 161 total tests (159 passing, 2 skipped on Windows symlinks, 0 failures).

## [0.2.0] - October 17, 2026

### Added

- Tabbed navigation: Clean separation of sidebar into "Poste" (individual agent) and "Équipe" (collective coordination).
- Terminal tooling: live text search with highlighted matches, "Figer" scroll freeze button, "Copier" clipboard button, auto-pause on text selection.
- Ergonomics and shortcuts: Ctrl+Enter (or Cmd+Enter) for quick prompt and broadcast, "Cocher tous les disponibles" button, arrow key tab navigation.
- Full-screen control tower: full-screen mode unifying canvas scene and control panel.
- Herdr pane identifiers: exact pane ID (`w5:p1`, `w5:p4`) shown on cards and detail header.
- Mobile experience: selecting an agent on narrow viewports smoothly scrolls to control panel.
- Live visual indicators: top bar badges counting working, waiting, and available agents; yellow alert banner for input requests; session transmission journal.
- Team lead and Direction desk: first agent recognized as lead with dedicated scene desk.
- Delegation cycle and mail: delegation detection, walking animations, and completion mail.
- Reflection room: animated room hosting subagents.
- Secure file explorer: safe directory browsing (`src/files.mjs` and `/api/files`) restricted to local folders without deletion or overwrite.
- Codex and OpenCode telemetry: non-destructive parsing of local configuration and logs (`src/agent-activity.mjs`).
- Truth of facts: strict rule banning invented metrics; real errors feed `LESSONS.md`.
- Claude token tracking: transcript parsing for real token consumption.
- Automated tests: 90 tests covering server, Herdr, activities, files, and origin verification.

## [0.1.0] - October 17, 2026

### Added

- Initial release of The Agent Office (Bureau des agents) by DrSmoke and the agent team.
- Animated pixel art scene in clean scaled canvas respecting selected art styles.
- Continuous panoramic sky synced with machine clock.
- Direct local connection to Herdr CLI agents.
- Faithful character poses: typing when working, mug when available, raised arm when waiting.
- 16x16 pixel logos for Claude, Codex, Antigravity, and OpenCode.
- Ephemeral token authentication (`X-Bureau-Token`) preventing dispatches to busy agents.
- 2-click armed group broadcast.
- Automatic draft preservation when switching between agents.
- Standalone local HTTP server with zero npm dependencies bound to 127.0.0.1.
- Quick start scripts for Windows (`Ouvrir le bureau.cmd` and `Ouvrir le bureau.ps1`).
