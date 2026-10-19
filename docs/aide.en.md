# MyTeam · Agent desk User Guide

[Français](aide.md) | **English**

This document contains integrated help documentation for MyTeam · Agent desk for the user and their agents. It can be read directly or browsed via the interactive "?" drawer in the UI.

---

## 1. Welcome to Your Office

MyTeam · Agent desk is your local control tower. It lets you monitor your AI agents connected in Herdr and send them instructions.

Everything displayed on screen originates from real observations: active Herdr processes, raw terminal streams, local logs, and files on disk. The office never fabricates data, completion percentages, or fictional states.

The interface is bilingual (French and English). An "FR / EN" button in the top toolbar instantly toggles the language across all views, metrics, drawers, and error messages.

---

## 2. Key Features <a id="key-features"></a>

### 1. Animated scene and Direction desk
The Direction desk hosts the team chief. On each delegation observed in the chief's local log, the chief leaves the desk, walks across the workshop, and delivers the golden folder directly to the teammate. The room lighting adjusts automatically to local time, with morning sunrise and warm desk lamps turning on at 7:00 PM.

![Main scene in MyTeam](captures/01-ordinateur-scene.png)

### 2. Workstation tab and live output
Every collaborator has live terminal output, with instant search and highlighting of errors and waiting states, and a separate instruction field. Markdown replies are extracted without log noise. A priority queue defers instructions for busy agents or those on quota pauses: an availability notice goes out one minute after a pause lifts, and the queue waits 5 more minutes before resending an instruction that stayed queued.

![Workstation and terminal](captures/02-ordinateur-poste.png)

### 3. Live multi-terminal Mosaic
The Mosaic mode displays collaborator terminals side-by-side (4 tiles at most) to monitor work in real time, while the overall team capacity is verified up to 10 agents (12 in broadcast). It features synchronized text search across all tiles, quick prompt dispatch (`Ctrl+Enter`), and an energy-efficient refresh loop that suspends when the tab is hidden.

![Multi-terminal mosaic mode](captures/11-ordinateur-mosaique.png)

### 4. Supervised autonomy (NoBabysitter)
The permanent "Autonomy OFF/ON" switch starts a star-topology coordination loop where the chief decides and delegates each step toward the designated goal. The mode stops by itself on timeout, exchange cap, detected loop or crisis room. It reminds the chief never to `git push`, delete, install or publish without you: this is a precaution, not a technical lock, the server does not control the chief's commands. A Summary button extracts the full factual Markdown report directly from the event log.

![Active autonomy mode](captures/23-ordinateur-autonomie-fenetre-active.png)

### 5. Guarded Crisis Room
Accessible via shortcut (`Ctrl+Shift+C`) or from the toolbar, the Crisis Room immediately blocks all outgoing prompts (HTTP 423) and displays live diagnostic tail outputs for every agent. It enables sending a polite Escape key stop without terminating processes.

![Crisis room](captures/12-ordinateur-crise.png)

---

## 3. 7-Step Guided Tour

This quick walkthrough explains core office operations.

### Step 1: Observe the team in the pixel art scene
The main window renders your team in an animated pixel art environment. The sky shifts continuously according to your computer's clock (6:30 AM sunrise, 7:30 PM sunset), and indoor lighting automatically turns on in the evening (pendant ceiling lights and desk lamps). The wall board summarizes key operational facts (BACK, QUEUED, MAIL, SUBAGENTS). The team chief sits at the Direction desk. Each character shows their real state through their pose, monitor glow, desk front emblem, and color-coded name underline.

### Step 2: Select a workstation
Click any character in the scene (or tap on a touchscreen), click their name in the desk list below the canvas, or click directly in the landing view of the station. On mobile or narrow screens, the view automatically scrolls down to the control panel.

### Step 3: Inspect and instruct in the "Desk" tab
The "Desk" tab displays detailed agent metrics: model, activity, token usage, and live terminal output. You can freeze scrolling ("Freeze"), expand the terminal to full height ("Expand"), search for text, read formatted markdown in the "Readable replies" drawer, and send prompts using `Ctrl+Enter` (or click "Queue prompt" if busy, with optional local file attachments).

### Step 4: Coordinate in the "Team" tab
The "Team" tab centralizes collective workflows. The "Chief’s mail" section alerts you whenever an agent finishes work. The "Chief listening relay" section allows automatically notifying the chief via the instruction queue when a teammate completes a task. The "Queue" section lists queued instructions with automatic retry. You can also check multiple available agents to send a common instruction with a 2-click armed dispatch.

### Step 5: Manage documents and track tasks
The "Files" tab lets you inspect recently modified files or browse project folders via safe copy or move without deletion. The "Tasks" tab tracks real checked boxes in project Markdown files (`TODO.md`) and action plans published by agents.

### Step 6: Mosaic (multi-terminal monitoring)
The "Mosaic" button on the canvas frame replaces the office decor with a view of 2 to 4 terminals side by side (up to 10 agents tested, 12 in group broadcast, mosaic 4), with highlighted text search, toggle between "2×2 grid" or "Columns", and a quick prompt field (Ctrl+Enter). The "Scene view" button restores the office view at any time.

### Step 7: Crisis room (emergency circuit breaker)
The flip-covered "Crisis room" button (emergency shortcut: Ctrl+Shift+C) enables instant reaction if things drift: it locks all direct sends (HTTP 423), freezes the queue, and opens a calm diagnostic modal to request a polite interruption of an agent via the Escape key, without ever resorting to forced process kills.

---

## 4. Comprehensive Area Guide

### Zone 1: Office Scene (Global View)

The canvas provides an immediate overview of your entire agent team.

#### What it is for
- Monitor the status of each connected Herdr agent at a glance.
- Spot roadblocks, task completions, and quota breaks immediately.
- Observe physical interactions between the chief, agents, and their subagents.
- Follow live indicators on the wall-mounted scoreboard.

#### Wall Scoreboard
- Located on the back wall, this board highlights key operational facts not repeated on desks or cards.
- `BACK` (`RETOUR`) line: lights up in purple when an agent is on quota break, showing the exact resume time reported by the tool (or `??:??` if unspecified).
- `QUEUED` (`EN FILE`) line: displays the number of queued prompts waiting in the secure queue (lights up in blue when instructions are queued).
- `MAIL` (`COURRIER`) line: counts unread completion letters (lights up in mint when letters await review).
- `SUBAGENTS` (`SOUS-AGENTS`) line: counts assistants currently active in the reflection room (lights up in light grey when subagents are running).
- Each line illuminates in vivid color when its fact is observed; inactive lines remain subtle and dark.

#### Corkboard and Team Board Modal
- A pixel art corkboard hangs on the back wall (to the right of the neon sign). Its colored pins indicate the count of open tasks in `TODO.md` (`+` symbol when over 6 tasks remain).
- Clicking the corkboard or the "Board" button opens the **Team board** modal.
- This view provides read-only access to the 4 pillar files:
  1. **Current stage**: excerpt from `HANDOFF.md` presenting the active project phase.
  2. **To do / ideas**: tasks and roadmap items from `TODO.md`.
  3. **Team roles**: responsibilities and file ownership from `AGENTS.md`.
  4. **Latest lessons**: documented mistakes and rules from `LESSONS.md`.
- Each block shows its source filename and modification timestamp on disk.
- Security and integrity: token-protected `/api/tableau` route, strict allowlist of files, sensitive paths and private IDs masked.
- Easy closing: Escape key, close button, or clicking the dark backdrop. Focus returns to the trigger button.

#### Direction Desk and the Chief's Rounds
- Assigned to the first agent started in Herdr (the team chief).
- Distinct purple carpet, wood paneling, and panoramic window view.
- Completed task mail stacks on the desk. Clicking the stack navigates directly to the Team tab.
- Chief's rounds on delegation: when a delegation is observed in its log (`herdr agent prompt`), the chief stands up, exits Direction, crosses the floor to place the titled gold folder on the collaborator's desk, and walks back. Only one round takes place at a time to ensure readable visual progression.

#### Continuous Day-Night Cycle and Evening Ambiance
- Sky through the window evolves continuously following your local computer clock (night, dawn, day, dusk).
- Sun and moon follow a diurnal arc (warm sun near horizon, fixed 6:30 AM sunrise, 7:30 PM sunset).
- City lights and stars gradually fade as daylight increases.
- Ceiling pendant lights: starting at 5:30 PM (full intensity at 7:00 PM until morning), ceiling fixtures turn on automatically with a soft golden glow.
- Desk lamps: each workstation features an individual desk lamp that turns on in the evening if the agent is present, staying off if on quota break.
- Room lighting, reflection room, and Direction desk adjust dynamically with the sky and screen glows.
- Reduced motion: if `prefers-reduced-motion` is active, the scene freezes by default, while still updating once a minute to reflect clock time and daylight.

#### Workstation Identification and the 24 Herdr Tool Emblems
- On the front of each desk, a 16×16 pixel art emblem identifies the tool among all 24 types supported by Herdr: `pi`, `claude`, `codex`, `gemini`, `cursor`, `devin`, `agy`, `cline`, `omp`, `mastracode`, `opencode`, `copilot`, `kimi`, `kiro`, `droid`, `amp`, `grok`, `hermes`, `kilo`, `qodercli`, `qwen`, `letta`, `maki`, `muse`, or a fallback generic agent emblem if unspecified.
- These emblems also appear on agent cards and in Mosaic tiles.
- Below each desk, the agent's name is underlined with a thin status bar (blue for working, mint for available, amber for awaiting input, purple for quota break).
- If connection with Herdr is lost, `OFFLINE` (`HORS LIGNE`) is displayed.
- Status is clearly communicated through character pose, screen glow, bubble, tool emblem, and underline without redundant textual clutter.

#### Compatibility Matrix for all 24 Herdr Tools
All 24 tools supported by Herdr benefit from universal monitoring and command orchestration:
- **Universal support (all 24 tools)**: Automatic detection on startup, dedicated 16×16 pixel art emblem, live raw terminal stream monitoring, unified statuses (working, available, waiting for reply, quota pause, offline), prompt dispatch and priority queueing, and armed 2-click broadcast dispatch.
- **Deep telemetry (Claude Code, Codex, OpenCode)**: For these 3 tools, the desk additionally analyzes local activity logs to provide structured readable Markdown answers, exact token usage breakdown per turn and session, unified discussion thread, structured action plans for the Tasks tab, and physical subagent tracking in the reflection room.

#### Official Herdr Integrations
- The command `herdr integration install <tool>` sets up official integrations for supported tools: `pi`, `omp`, `claude`, `codex`, `copilot`, `devin`, `droid`, `kimi`, `opencode`, `kilo`, `hermes`, `qodercli`, `qwen`, `letta`, `cursor`, `mastracode`, `antigravity-cli`, `grok`.
- These integrations configure the tool to report accurate states, session contexts, and live activity back to Herdr and the office.

#### Character Poses
- Typing: agent working on a task (sky blue).
- Holding a mug: agent available, awaiting next instruction (mint).
- Raised arm: agent awaiting human confirmation or input in Herdr (amber).
- Smile and sparks: work recently ended (observed transition from working to done); outcome to be verified in output.
- Empty chair: agent on quota limit break.

#### Status Bubbles
- Amber question mark: agent requests confirmation or input in Herdr.
- Green checkmark: task reported complete by Herdr, inspect terminal output for results.
- Grey dots: transient status or unspecified by the tool.

#### Status Colors
- Sky blue: working (running commands, editing code).
- Mint: available or finished.
- Amber: waiting for human intervention or input.
- Soft purple: quota limit pause.
- Slate grey: unknown state or disconnected agent.

#### Quota Break and "RETOUR" Easel
- When an agent reaches its token or request rate limit, the agent leaves their seat.
- Their screen turns off, desk lamp turns off, and a subtle purple standby light blinks.
- A white desktop easel with "BACK" ("RETOUR") displays the exact resume time reported by the tool.
- The local server schedules automatic retry of queued instructions 5 minutes after that time.
- Automatic resumption: one minute after the pause ends (reported resume time), the server automatically enqueues a short instruction reminding the agent to reply "dispo" and resume its in-progress mission (`git status`, then chief instruction) without re-doing already committed work, preserving its quota. Sent once per break, in-memory only (server restarts never replay old reminders).

#### Reflection Room for Subagents
- Glass-walled dedicated room with fixed label "THINKING" ("REFLEXION" in French view), never truncated.
- When an agent delegates part of their workload to subagents, assistants leave their desk carrying a golden folder.
- They cross the hallway into the glass room.
- They work at laptops around the table or gather around the whiteboard.
- The exact count of active subagents is displayed live on the wall board.
- When completed, they return to deliver the folder back to their primary agent's desk.
- The room can be collapsed to optimize space on smaller displays.

#### "Arrange" Layout Mode ("Disposer")
- Click the "Arrange" button in the upper right corner of the scene frame.
- A dedicated helper bar appears under the toolbar to remind you of controls.
- Drag any workstation across the floor (or move it with keyboard arrow keys).
- Move the chief's Direction desk or resize it by dragging its gold corner.
- Click "Reset" ("Réinitialiser") to restore default auto-layout.
- Press Escape or click "Done" ("Terminer") to save and lock your layout.

#### Mosaic Mode (Multi-Terminal Surveillance)
- The "Mosaic" button (or "Tile mode" in Ctrl+K) replaces pixel art with a modular Mosaic of 2 to 4 live terminals side by side (up to 10 agents tested, 12 in group broadcast, mosaic 4).
- Working agents appear at the top of the list for immediate visibility.
- If more than 4 agents are connected, checkboxes allow choosing which 4 agents to display.
- Layout toggle: "2×2 grid" and "Columns" buttons (on mobile, tiles stack into a single comfortable column).
- Each tile features:
  - Compact header with name, tool emblem, status badge, and "Expand" button to open the full individual workstation view.
  - Clean terminal output stripped of ANSI escape sequences.
  - Text search box with highlighted matches and occurrence counter.
  - Quick prompt field dispatched with `Ctrl+Enter`, disabled with clear explanation when the agent is unavailable.
- Economical polling: visible tiles are refreshed every 3 seconds, paused when browser tab is hidden, one read at a time per tile, preserving active text selections.
- The "Scene view" button restores the animated office view instantly.

---

### Zone 2: "Desk" Tab (Individual Workstation)

This tab lets you inspect and interact with the selected agent.

#### What it is for
- Inspect detailed activity, model name, and token usage.
- Read real terminal text from Herdr.
- Search for errors, freeze scrolling, and copy code snippets.
- Write and send individual instructions.

#### Tool Status Bar
- Active task title or thought stream extracted directly from the tool.
- Model in use (as reported, e.g., GPT-6.1-Sol or MiMo V2.6 Pro), mode, and effort setting.
- Visual quota gauge with reset time.
- Elapsed runtime and detected warnings counter.

#### Terminal Tools
- "Search in outputs" field: highlights query terms and shows match count.
- "Freeze" button: pauses auto-scroll to let you read error traces or code. Click "Resume" to resume following.
- "Copy" button: copies entire terminal text into clipboard.
- "Expand" button: expands terminal height to fill available viewport space, including dedicated comfortable mobile height.
- Auto-pause on selection: selecting text pauses live updates with an informative notice. Your selection never jumps.

#### "Readable replies" Drawer
- Beneath raw terminal output, a collapsible drawer renders structured agent responses from local logs (Claude, Codex, OpenCode).
- Safe markdown formatting without `innerHTML` (headings, lists, quotes, bold, code spans, code blocks).
- "Copy code" button per code block and "Copy response" for raw markdown source.
- Local `.md` export buttons (single response or full session). In-progress turns are exported as dated snapshots marked "partial".
- Accessible fallback: if clipboard access is denied, a read-only modal dialog opens for manual copying.

#### Sending Instructions, Queueing, and Priorities
- Available agent: text area is unlocked for immediate sending with `Ctrl+Enter` (or `Cmd+Enter`).
- Busy agent or quota break: button displays "Queue prompt" (or "Queue for {name}"). Instruction is safely stored in the server queue and dispatched when the agent is free or 5 minutes after quota reset.
- "Priority" checkbox: flags the prompt as high priority (`priority: "haute"`) to be dispatched ahead of standard prompts once the agent becomes available.
- File attachments: attach up to 2 local files (20 MB max). Files are safely copied without overwriting into the agent's working directory before dispatch.
- Draft preservation: switching agents while composing or during a queued request never loses text; each draft is stored independently.

---

### Zone 3: "Team" Tab (Collective Coordination)

This tab coordinates multiple agents, the queue, direction, and task completion reports.

#### What it is for
- Review completed missions through chief mail.
- Monitor and manage queued instructions with priority controls.
- Designate the team chief and handle quota handover suggestions.
- Configure the chief listening relay to alert the chief upon task completion.
- Broadcast an instruction to multiple agents in a single action.
- Inspect the session transmission journal.

#### Direction and Chief Handover
- Active chief: the Direction desk hosts the team chief (default: first agent started in Herdr).
- User selection: the "Team direction" ("Direction de l'équipe") section lets you assign any connected agent as chief or revert to default. Choice is persisted in `.bureau/direction.json`. If the assigned chief disappears from Herdr, default rule applies gracefully.
- Handover proposal banner: if the chief hits its quota limit, a banner proactively suggests passing the chief role to an available deputy.
- Human confirmation and review: handover is never automatic. The user confirms, reviews the handover message, and sends it directly or via queue.
- Delegation tracking: delegations (`herdr agent prompt`) and chief rounds are monitored in the active chief's local log.

#### Chief’s Mail ("Courrier du chef")
- Whenever an agent shifts from "working" to "available" or "done", completion mail is logged with a counter in the section title.
- List resets automatically when you view the Team tab.
- Clicking a mail item or "Open their desk" ("Ouvrir son poste") opens the agent's workstation terminal to verify results.
- Caution reminder: mail confirms the process stopped, not that the goal succeeded. Always verify actual outputs.

#### Chief Listening Relay
- Dedicated section in the Team tab: "Notify the chief when an agent finishes" ("Prévenir le chef quand un agent termine") checkbox.
- Optional feature, off by default, persisted on disk in `.bureau/relais.json`.
- Operation: whenever an agent transitions from "working" to "available" or "done", the server inserts a normal-priority instruction into the queue for the active chief: *"[Name] vient de terminer. Lis son panneau avant de lui confier la suite."*
- Safety and throttling: only one notification per observed finish, at least 1 minute interval between alerts for the same agent, state persisted before enqueueing to prevent duplicates on dropped responses.
- Never during crisis: if the Crisis Room is active, the relay is completely disabled; no message is generated or dispatched to the chief.

#### Instruction Queue and Priorities
- Displays queued instructions with target, timestamp, status, and priority level ("haute" or "normale"), sorted by scheduled dispatch order.
- "Move to the front" ("Passer en tête") button: promotes a normal instruction to high priority with one click.
- Dispatch order: high-priority instructions go first (by arrival timestamp), followed by normal ones.
- Starvation safeguard: normal instructions waiting over 30 minutes are automatically promoted to high priority.
- Strict state respect: high priority never forces a send to a busy agent or one on quota break. The server awaits availability.
- Individual cancellation: each item can be removed with its cancel button.
- Idempotence protection: atomic disk writes, idempotence keys, and frozen dispatch on uncertainty.

#### Multi-Agent Broadcast (2-Click Armed Dispatch)
- Check the agents you wish to instruct (only available agents can be checked, up to 10 agents tested, 12 in group broadcast, mosaic 4).
- "Tick all available" ("Cocher tous les disponibles") selects all ready agents in one click.
- Type your shared instruction in the text area.
- First click on "Send the instruction" ("Envoyer", or `Ctrl+Enter`): arms dispatch and displays all recipient names clearly.
- Second click: confirms dispatch. The instruction is transmitted individually to each selected agent via Herdr.

#### Transmission Journal
- Logs every dispatch made since the office started.
- Records timestamp, recipients, message excerpt, and Herdr status.

#### Entrusted Files and Processing Tracking
- Displays processing folders for files entrusted via queued prompts.
- Chronologically traces observed facts with source tags (`file`, `disque`, `herdr`, `journal`): enqueue time, file copy, disk modifications, and completion detection.
- Factual integrity: no artificial "success" claim is made; only dated facts are displayed.

#### Discussion Stream (Control Room)
- Centralizes excerpts of recent responses across the entire team, ordered newest to oldest.
- Each bubble displays agent name, timestamp, observed state, and response excerpt.
- Lists unread agents below with observed reasons ("not exposed by tool" or "not matched with certainty").

---

### Zone 4: "Files" Tab (Secure File Explorer)

This tab inspects and organizes project files linked to your agents.

#### What it is for
- Quickly discover files created or modified by an agent.
- Navigate project directory trees.
- Reveal folders in Windows Explorer with one click.
- Copy or move files between working directories.

#### Absolute Safety and Integrity
- No deletion functionality exists in the office.
- No file overwrite is possible: colliding filenames are automatically renamed with numeric indexes.
- Navigation restricted to allowed roots: agent working folder, Desktop, Documents, Downloads. No raw paths from the browser are accepted.

#### Recent and Browse Views
- "Recent" ("Récents") button: lists files modified in the last 48 hours in the selected agent's working folder.
- "Browse" ("Parcourir") button: folder-by-folder navigation with clickable breadcrumbs.

#### File Actions
- "Reveal" ("Afficher") button: reveals the selected file directly in Windows Explorer.
- Standard drag and drop: drag a file to any target in the "Drop into" ("Déposer dans") list to copy it.
- Shift + Drag and drop: hold Shift to move a file. An alert prompt requires a second identical gesture to confirm.

---

### Zone 5: "Tasks" Tab (Factual Task Progress)

This tab monitors concrete work progress without artificial metrics.

#### What it is for
- Display real checkable items found in project documentation (`TODO.md`).
- Inspect structured action plans published by agents in their logs.
- Observe a progress bar strictly calculated as checked items over total items.

#### Factual Progress Rules
- Progress percentage is strictly calculated from real checked boxes.
- No percentage is extrapolated or guessed.
- If an agent does not publish an action plan, "No plan published by an agent for now" ("Aucun plan publié par un agent pour le moment") is displayed.

---

### Zone 6: Command Palette, Bilingual Interface, and Signals

#### Command Palette (Ctrl+K)
- Accessible via "Commands" ("Commandes") button or `Ctrl+K`.
- Search for agents, open workstations, draft prompts, open the team board ("Shared memory"), switch tabs, or trigger actions from the keyboard.
- Fluid navigation: arrow keys to choose, Enter to confirm, Escape to close.

#### Desk health
- In the help (`?` key), a line shows whether Herdr responds, how many agent logs are found and whether the server runs the latest version of the files.
- The "Restart needed" badge appears in the header when the server runs older code than the files: restart it when no Autonomy mode is running (a restart ends that mode).
- The "Copy diagnostic" button copies versions and states only: never a path, key, objective or message. Useful to ask for help without exposing your terminal.

#### Bilingual FR / EN Interface
- "FR / EN" button located in the top header toolbar (next to Help).
- Automatic detection: defaults to browser language (`navigator.language`) on initial visit.
- Manual toggle: clicking toggles language and stores your choice in `localStorage` under `bureau.langue`.
- Full coverage: all buttons, metrics, drawers, forms, and server error messages are instantly translated.

#### Help Drawer (Key: ?)
- Accessible via "Help" ("Aide") button or `?` key, opened automatically on first visit.
- Contains the 7-step guided tour, visual legends, and signal controls.

#### Supervised Autonomy Mode (NoBabysitter)
- Accessible via the "Autonomy" button in the top header toolbar (tooltip: "Supervised autonomy: the chief decides what comes next, within caps").
- "Autonomy (NoBabysitter)" modal: launch a supervised autonomous cycle by setting a clear objective (5 to 300 characters), a maximum duration (5 to 120 minutes, default 30 min), and a cap on exchanges (3 to 60, default 20).
- Star-shaped architecture: the team chief coordinates everything. Upon each observed task completion from a teammate, the listening relay enqueues a prompt for the chief reminding it of the objective, exchange count (`{n}/{max}`), and deadline. The chief alone decides the next step and delegates it. No agent writes directly to another without passing through the chief.
- Absolute safety guardrails:
  - Never any Git push, file deletion, package installation, publication, or answering dialog prompts without explicit consent from DrSmoke.
  - No claim of full autonomy: autonomy is strictly supervised, bounded, and measurable.
- Automatic and safe stops:
  - Time limit reached (`durée écoulée`).
  - Exchange cap reached (`plafond d'échanges atteint`).
  - Loop detected (`boucle détectée`, if the same agent finishes repeatedly within a 10-minute window).
  - Crisis room activation (`salle de crise enclenchée`).
  - Server restart (`redémarrage du serveur`: never resumes silently without human re-engagement).
  - Instant manual stop: "Stop now" button available at any time.
- Factual event log: lists only real events as they occur (session launch, messages enqueued to the chief, stop causes).
- Live toolbar indicator: when active, the button displays remaining time and exchange progress (`Autonomy · {reste} · {n}/{max}`).

---

### Zone 7: Emergency Circuit Breaker "Crisis Room"

The Crisis Room is a safety mechanism designed to regain control during loops or critical issues without destroying work in progress.

#### Triggering and Visual Alarm
- Accessible via the flip-covered "Crisis room" ("Salle de crise") button in the header, shortcut `Ctrl+Shift+C`, or command palette.
- Canvas wraps in an amber safety glow and an alert banner appears.
- Primary button requires explicit confirmation to arm the crisis ("Confirm: start the crisis").

#### Immediate Circuit Breaker Effects
- **Absolute direct send lock**: `/api/prompt` and `/api/broadcast` return HTTP 423 ("Crisis room active: sends are locked").
- **Queue freeze**: instructions are received and stored safely, but no automatic dispatches occur while crisis is active.
- **Handover and listening relay suspension**: chief handover dispatches and the chief listening relay are fully suspended.
- **Atomic state**: saved in `.bureau/crise.json` outside Git. Defaults to active if file is corrupted.

#### Calm Diagnostics and Polite Interruption
- Modal lists each connected agent with observed status, Herdr pane ID, and the last 4 raw terminal lines.
- **Polite interruption per agent**: click "Stop this agent" ("Arrêter cet agent"), then confirm. Server sends canonical Escape (`esc` in Herdr via `POST /api/crise/arret`).
- **Absolute rule**: no process is killed (`kill`). Agents are politely asked to exit at application level to safeguard disk files.
- **Resuming**: click "Lift the crisis" ("Lever la crise") to unlock sends and resume queue processing.

---

## 5. Team Kit and Collaboration Tooling (docs/kit.en.md)

The team kit brings the multi-agent collaboration methodology used to build MyTeam to any project. Refer to [docs/kit.en.md](kit.en.md) for full documentation.

### Pillar Files
- `AGENTS.md`: Universal rules for all AI agents (roles, file ownership, truth of facts, definition of done, security).
- `CHEF.md`: Guide for the team chief on listening, delegating, evaluating, correcting, and merging.
- `LESSONS.md`: Shared memory of mistakes never to repeat.
- `TODO.md` and `HANDOFF.md`: Open tasks and status summaries to pass context without loss.

### Kit Scripts
- **Initialization**: `node scripts/init-kit.mjs <folder> [--lang fr|en]` deploys pillar files without overwriting existing files.
- **Factual self-evaluation**: `node scripts/evaluer.mjs [folder]` produces a fact-based report (pillar presence, checked box ratio, lessons, Git status, and `npm test`/`npm run check` results). Exit code 1 on failures.
- **Sharing lessons**: `node scripts/partager-lecons.mjs "Lesson in one line." [folder]` records the rule in `LESSONS.md` and gently notifies available Herdr agents (`idle` or `done`), never interrupting working agents.

---

## 6. Shortcut and Fast Commands Table

| Area | Action or Shortcut | Effect |
| :--- | :--- | :--- |
| **General** | `Ctrl + K` | Opens modal command palette. |
| **General** | `FR / EN` Button | Instantly toggles interface language between French and English. |
| **General** | "Autonomy" Button | Opens configuration modal for supervised autonomy (NoBabysitter). |
| **General** | Palette Ctrl+K: "Team board" ("Tableau de l'équipe") | Opens read-only team board modal (pillar files). |
| **General** | Palette Ctrl+K: "Mosaic mode" ("Mode mosaïque") | Toggles between pixel art canvas and multi-terminal Mosaic. |
| **General** | Palette Ctrl+K: "Crisis room" ("Salle de crise") | Opens crisis room diagnostic and control modal. |
| **General** | `Ctrl + Shift + C` | Immediately opens crisis room modal (emergency breaker). |
| **General** | `?` Key | Opens or closes this help drawer. |
| **Scene** | Click corkboard or "Board" ("Tableau") button | Opens team board modal (pillar files). |
| **Scene** | "Mosaic" / "Scene view" button | Toggles display between animated scene and 2 to 4 terminal Mosaic. |
| **Scene** | Click character (or tap on screen) | Opens workstation panel (scrolls on mobile). |
| **Scene** | Click mail stack | Opens Team tab and Chief’s mail section. |
| **Scene** | "Arrange" ("Disposer") button | Enables manual desk arrangement mode. |
| **Scene** | `Escape` Key | Closes one layer at a time: crisis room, palette, team board, arrangement, help. |
| **Scene** | "Full screen" ("Plein écran") button | Expands scene and panel into unified full-screen view. |
| **Scene** | "Pause" ("Mettre en pause") button | Pauses or resumes canvas animations (frozen scene updates once a minute). |
| **Navigation**| `Right Arrow` / `Left Arrow` | Cycles through tabs (Desk, Team, Files, Tasks). |
| **Desk** | `Ctrl + Enter` (or `Cmd + Enter`) | Sends instruction to selected agent. |
| **Desk** | "Priority" ("Prioritaire") checkbox | Flags instruction for high-priority queue processing. |
| **Desk** | "Queue prompt" ("Mettre en file") button | Queues instruction if agent is busy. |
| **Desk** | "Expand" ("Agrandir") button | Toggles full-height terminal view (including mobile). |
| **Desk** | "Readable replies" ("Réponses lisibles") drawer | Expands structured markdown responses with code copy and export. |
| **Desk** | Text selection in terminal | Pauses auto-refresh to allow easy copying. |
| **Desk** | "Freeze" ("Figer") button | Freezes auto-scroll. |
| **Desk** | "Copy" ("Copier") button | Copies full terminal content to clipboard. |
| **Mosaic** | "2×2 grid" / "Columns" button | Toggles mosaic tile layout. |
| **Mosaic** | `Ctrl + Enter` in a tile | Dispatches quick instruction to the agent in that tile. |
| **Mosaic** | "Expand" ("Agrandir") button on a tile | Opens full individual workstation panel for that agent. |
| **Mosaic** | "Scene view" ("Revenir à la scène") button | Closes Mosaic and restores animated office scene. |
| **Crisis** | "Crisis room" ("Salle de crise") button | Opens crisis room diagnostic panel. |
| **Crisis** | "Stop this agent" ("Arrêter cet agent") button | Requests polite interruption (Escape) for an agent after confirmation. |
| **Crisis** | "Lift the crisis" ("Lever la crise") button | Unlocks direct sends and resumes queue processing. |
| **Team** | "Team direction" ("Direction de l'équipe") section | Sets chief agent, restores default rule, or confirms handover. |
| **Team** | "Chief listening relay" ("Relais d'écoute du chef") checkbox | Toggles automatic neutral notification to chief upon task completion. |
| **Team** | "Move to the front" ("Passer en tête") button | Promotes queued instruction to high priority. |
| **Team** | "Remove" ("Retirer") button | Removes an instruction from the queue. |
| **Team** | `Ctrl + Enter` (or `Cmd + Enter`) | Triggers armed broadcast dispatch. |
| **Team** | "Tick all available" ("Cocher tous les disponibles") button| Selects all ready agents in one click. |
| **Files** | Drag and drop onto a destination | Copies file to chosen folder. |
| **Files** | `Shift` + Drag and drop | Moves file (requires confirmation). |
| **Files** | "Reveal" ("Afficher") button | Reveals file location in Windows Explorer. |

---

## 7. Golden Rule: Truth of Facts

MyTeam · Agent desk strictly enforces factual integrity:
1. Only observable facts are displayed (real processes, system clock, local logs, disk files).
2. No completion percentage is invented if a tool does not calculate it.
3. If a tool does not report token usage or subagents, "Not exposed by this tool" ("Non exposé par cet outil") is faithfully displayed.
4. Detected errors are never concealed: they appear in outputs and enrich LESSONS.md to prevent future regressions.
