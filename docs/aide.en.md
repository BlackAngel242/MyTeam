# Agent Office User Guide

[Français](aide.md) | **English**

This document contains integrated help documentation for The Agent Office for the user and their agents. It can be read directly or browsed via the interactive "?" drawer in the UI.

---

## 1. Welcome to Your Office

The Agent Office is your local control tower. It lets you monitor your AI agents connected in Herdr and send them instructions.

Everything displayed on screen originates from real observations: active Herdr processes, raw terminal streams, local logs, and files on disk. The office never fabricates data, completion percentages, or fictional states.

---

## 2. 5-Step Guided Tour

This quick walkthrough explains core office operations. You can skip this tour at any time by clicking "Passer la visite".

### Step 1: Observe the team in the pixel art scene
The main window renders your team in an animated pixel art environment. The sky shifts continuously according to your computer's clock (6:30 AM sunrise, 7:30 PM sunset), and indoor lighting automatically turns on in the evening (pendant ceiling lights and desk lamps). The wall board summarizes key operational facts (RETOUR, EN FILE, COURRIER, SOUS-AGENTS). The team lead sits at the Direction desk. Each character shows their real state through their pose, monitor glow, and color-coded name underline.

### Step 2: Select a workstation
Click any character in the scene (or tap on a touchscreen), click their name in the desk list below the canvas, or click directly in the landing view of the station. On mobile or narrow screens, the view automatically scrolls down to the control panel.

### Step 3: Inspect and instruct in the "Poste" tab
The "Poste" (Workstation) tab displays detailed agent metrics: model, activity, token usage, and live terminal output. You can freeze scrolling, expand the terminal to full height, search for text, and send prompts using `Ctrl+Enter` (or click "Mettre en file" if busy).

### Step 4: Coordinate in the "Équipe" tab
The "Équipe" (Team) tab centralizes collective workflows. The "Courrier du chef" section alerts you whenever an agent finishes work (the list resets when viewed). The "File d'attente" section lists queued instructions with automatic retry. You can also check multiple available agents to send a common instruction with a 2-click armed dispatch.

### Step 5: Manage documents and track tasks
The "Fichiers" (Files) tab lets you inspect recently modified files or browse project folders via safe copy or move without deletion. The "Tâches" (Tasks) tab tracks real checked boxes in project Markdown files and action plans published by agents.

---

## 3. Comprehensive Area Guide

### Zone 1: Office Scene (Global View)

The canvas provides an immediate overview of your entire agent team.

#### What it is for
- Monitor the status of each connected Herdr agent at a glance.
- Spot roadblocks, task completions, and quota breaks immediately.
- Observe physical interactions between the lead, agents, and their subagents.
- Follow live indicators on the wall-mounted scoreboard.

#### Wall Scoreboard
- Located on the back wall, this board highlights key operational facts not repeated on desks or cards.
- `RETOUR` line: lights up in purple when an agent is on quota break, showing the exact resume time reported by the tool (or `??:??` if unspecified).
- `EN FILE` line: displays the number of queued prompts waiting in the secure queue (lights up in blue when instructions are queued).
- `COURRIER` line: counts unread completion letters (lights up in mint when letters await review).
- `SOUS-AGENTS` line: counts assistants currently active in the reflection room (lights up in light grey when subagents are running).
- Each line illuminates in vivid color when its fact is observed; inactive lines remain subtle and dark.

#### Corkboard and Team Board Modal
- A pixel art corkboard hangs on the back wall (to the right of the neon sign). Its colored pins indicate the count of open tasks in `TODO.md` (`+` symbol when over 6 tasks remain).
- Clicking the corkboard or the "Tableau" button opens the **Tableau de l'équipe** modal.
- This view provides read-only access to the 4 pillar files:
  1. **Current stage**: excerpt from `HANDOFF.md` presenting the active project phase.
  2. **To do / ideas**: tasks and roadmap items from `TODO.md`.
  3. **Team roles**: responsibilities and file ownership from `AGENTS.md`.
  4. **Latest lessons**: documented mistakes and rules from `LESSONS.md`.
- Each block shows its source filename and modification timestamp on disk.
- Security and integrity: token-protected `/api/tableau` route, strict allowlist of files, sensitive paths and private IDs masked.
- Easy closing: Escape key, close button, or clicking the dark backdrop. Focus returns to the trigger button.

#### Direction Desk and the Lead's Rounds
- Assigned to the first agent started in Herdr (the team lead).
- Distinct purple carpet, wood paneling, and panoramic window view.
- Completed task mail stacks on the desk. Clicking the stack navigates directly to the Team tab.
- Lead's rounds on delegation: when a delegation is observed in their log (`herdr agent prompt`), the lead stands up, exits Direction, crosses the floor to place the titled gold folder on the collaborator's desk, and walks back. Only one round takes place at a time to ensure readable visual progression.

#### Continuous Day-Night Cycle and Evening Ambiance
- Sky through the window evolves continuously following your local computer clock (night, dawn, day, dusk).
- Sun and moon follow a diurnal arc (warm sun near horizon, fixed 6:30 AM sunrise, 7:30 PM sunset).
- City lights and stars gradually fade as daylight increases.
- Ceiling pendant lights: starting at 5:30 PM (full intensity at 7:00 PM until morning), ceiling fixtures turn on automatically with a soft golden glow.
- Desk lamps: each workstation features an individual desk lamp that turns on in the evening if the agent is present, staying off if on quota break.
- Room lighting, reflection room, and Direction desk adjust dynamically with the sky and screen glows.
- Reduced motion: if `prefers-reduced-motion` is active, the scene freezes by default, while still updating once a minute to reflect clock time and daylight.

#### Workstation Identification and Underlines
- A 16x16 pixel art emblem identifies the tool on each desk front (Claude, Codex, Antigravity, OpenCode, and others).
- Below each desk, the agent's name is underlined with a thin status bar (blue for working, mint for available, amber for awaiting input, purple for quota break).
- If connection with Herdr is lost, `HORS LIGNE` is displayed.
- Status is clearly communicated through character pose, screen glow, bubble, and underline without redundant textual clutter.

#### Character Poses
- Typing: agent working on a task (sky blue).
- Holding a mug: agent available, awaiting next instruction (mint).
- Raised arm: agent awaiting human confirmation or input in Herdr (amber).
- Smile and sparks: work recently ended (observed transition from working to done); outcome to be verified in output.
- Empty chair: agent on quota limit break.

#### Status Bubbles
- Amber question mark: agent requests confirmation or input in Herdr.
- Green checkmark: task reported complete by Herdr, inspect terminal output for results.
- Grey ellipsis: transient status or unannounced state.

#### Status Colors
- Sky blue: working (running commands, editing code).
- Mint: available or completed.
- Amber: awaiting human action.
- Soft purple: quota limit break.
- Slate grey: unknown status or disconnected.

#### Quota Break and "RETOUR" Sign
- When a tool hits its token or request limit, the agent steps away from their chair.
- Monitor turns off, desk lamp turns off, and a subtle purple standby light blinks.
- A white desktop easel marked "RETOUR" displays the exact resume time reported by the tool.
- The local server schedules automatic dispatch of queued items 5 minutes after that time.

#### Subagent Glass Reflection Room
- Dedicated glass-walled room labeled "SALLE DE REFLEXION" (or "REFLEXION" on compact screens), never truncated.
- When an agent delegates subtasks, small assistants leave their desk carrying a golden folder.
- They cross the corridor and enter the glass reflection room.
- They gather around desks with laptops or work at the whiteboard.
- The exact number of active subagents is displayed on the wall scoreboard.
- When analyses finish, they return to deliver the completed folder to their lead agent before leaving.
- The reflection room can be toggled/collapsed on compact screens.

#### "Disposer" Layout Mode
- Click the "Disposer" button in the upper-right corner of the scene frame.
- A dedicated help bar appears below toolbars to explain controls.
- Drag any workstation to your desired location on the floor (or move with arrow keys).
- Move the Direction desk or resize it by dragging its gold handle in the bottom-right corner.
- Click "Réinitialiser" to restore automatic layout.
- Press Escape or click "Terminer" to save and exit.

#### Mosaic Mode (Multi-Terminal Monitoring)
- The "Mosaïque" button (or "Mode mosaïque" in `Ctrl+K` palette) switches from pixel art to a modular grid of 2 to 4 terminal tiles side by side.
- Working agents appear at the top of the list to monitor progress without delay.
- If more than 4 agents are connected, checkboxes allow choosing which 4 agents to display.
- Layout toggle: "Grille 2×2" and "Colonnes" buttons (smartphones use a fluid single-column layout).
- Each tile features:
  - Compact header with name, tool emblem, status badge, and "Agrandir" button to view full station.
  - Raw terminal output in a clean scrollable pre block, stripped of ANSI escape sequences.
  - Live text search with occurrence highlighting and match count.
  - Quick prompt dispatch form with `Ctrl+Enter`, automatically disabled with explanation when agent is not available.
- Resource-conscious polling: active tiles query every 3 seconds, polling halts when browser tab is hidden, one read at a time per tile, text selections never interrupted.
- The "Revenir à la scène" button or palette command restores the animated pixel art scene.

---

### Zone 2: "Poste" Tab (Individual Station)

Inspect and interact directly with the selected agent.

#### What it is for
- Review detailed activity, active model, and token consumption.
- Read live raw text output from the agent's Herdr terminal.
- Search for errors, pause scrolling, and copy code snippets.
- Draft and send new instructions.

#### Tool Status Bar
- Active task title or live thought stream from the tool.
- Model name (e.g. GPT-6.1-Sol, MiMo V2.6 Pro), mode, and effort level.
- Visual gauge of remaining quota with reset timestamp.
- Elapsed runtime and detected warnings count.

#### Terminal Controls
- "Rechercher dans les sorties" search field: instant occurrence highlighting with match count.
- "Figer" button: freezes autoscroll to calmly read stack traces or logs. Click "Reprendre" to resume autoscroll.
- "Copier" button: copies entire terminal buffer to clipboard.
- "Agrandir" button: expands terminal height to fill available screen space, including comfortable dedicated height on mobile.
- Automatic pause on selection: selecting text inside the terminal pauses updates with "Sélection en cours, affichage en pause". Selection is never cleared.

#### "Réponses lisibles" Structured Responses
- Expandable drawer below the terminal rendering structured responses from local logs (Claude, Codex, OpenCode).
- Safe Markdown rendering without `innerHTML` (headings, lists, blockquotes, bold, inline code, and code blocks).
- "Copier le code" button on every code block and "Copier la réponse" for raw Markdown source.
- Local `.md` export buttons (single response or full session). In-progress responses are exported as timestamped snapshots marked "partiel".
- Accessible fallback: if clipboard access is denied, a read-only textarea modal opens for manual copying.

#### Prompt Dispatch, Queuing, and Priority
- Available agent: textarea is unlocked for immediate dispatch with `Ctrl+Enter` (or `Cmd+Enter`).
- Busy agent or quota break: button displays "Mettre en file". Instruction is queued in the local server and will dispatch automatically once free or 5 minutes after quota reset.
- "Prioritaire" checkbox: tags instruction with high priority (`priority: "haute"`) to be processed ahead of normal queued items for that agent.
- Attached files: attach up to 2 local files (max 20 MB) to queued instructions. Files are safely copied without overwriting into the agent's workspace before prompt departure.
- Draft preservation: switching agents while drafting preserves unsent text independently for each station.

---

### Zone 3: "Équipe" Tab (Team Coordination)

Manage multi-agent workflows, queue administration, leadership, and completion reports.

#### What it is for
- Review completed missions via lead mail.
- Monitor and manage queued instructions with priority controls.
- Designate team lead and handle quota handover proposals.
- Broadcast instructions to multiple agents in one action.
- Inspect session dispatch logs.

#### Leadership and Handover
- Active lead: Direction desk is occupied by the team lead. Default is the first agent started in Herdr (lowest pane rule).
- Explicit choice: "Direction de l'équipe" section allows appointing any connected agent as lead or resetting to default. Choice is saved in `.bureau/direction.json`. If the appointed agent disconnects, server falls back safely to default.
- Handover proposal banner: if the lead hits a quota limit, a banner proposes handing leadership over to an available peer.
- Confirmation and reviewed handover prompt: handover is never automatic. User validates change, and the prepared handover prompt is reviewed before dispatch (directly or via queue).
- Delegation tracking: delegated missions (`herdr agent prompt`) and lead rounds are tracked in the active lead's logs.

#### Lead Mail
- Every time an agent transitions from working to available or done, a completion letter is logged with counter in section header.
- List automatically resets when viewing the Team tab.
- Clicking a mail item or "Ouvrir son poste" button navigates directly to that agent's terminal.
- Caution: mail confirms task process stopped, not that objectives were achieved. Always inspect actual outputs.

#### Queue and Priority Management
- Lists queued instructions with target, timestamp, status, and priority ("haute" or "normale"), ordered by scheduled dispatch.
- "Passer en tête" button: promotes a normal queued prompt to high priority with one click.
- Dispatch order: high-priority items dispatch first by arrival time, followed by normal items.
- Anti-starvation guard: normal instructions waiting over 30 minutes automatically elevate to high priority.
- Absolute respect for states: high priority never forces dispatch to a busy agent or one on quota break.
- Individual cancel button removes any queued item.
- Anti-double dispatch protection: atomic disk persistence, idempotency keys, and safe freeze on uncertainty.

#### Broadcast Message (Armed 2-Click Dispatch)
- Check agents to include (only available agents can be checked).
- "Cocher tous les disponibles" button selects all available agents in one click.
- Type shared instruction.
- First click on "Envoyer" (or `Ctrl+Enter`) arms dispatch and lists confirmed recipients.
- Second click confirms dispatch, sending individually to each agent via Herdr.

#### Session Dispatch Log
- Logs all dispatches during the active session with timestamps, recipients, text, and Herdr status.

#### Entrusted Files and Processing Logs
- Lists dossiers for files entrusted to agents with prompts.
- Chronologically traces observed facts with exact sources (`file`, `disque`, `herdr`, `journal`): queue timestamp, copy completion, disk modifications during agent work, and response completion.
- Factual rule: never claims "succeeded" or "completed"; only dated observable facts are shown.

#### Control Room Discussion Feed
- Gathers excerpts of recent responses across the entire team, newest to oldest.
- Each bubble displays agent name, timestamp, observed state, and excerpt.
- Lower section lists unread agents with reasons ("non exposé par cet outil" or "non rattaché avec certitude").

---

### Zone 4: "Fichiers" Tab (Secure Explorer)

Browse and organize project files connected to your agents.

#### What it is for
- Discover files created or modified by an agent in the last 48 hours.
- Step through project folder hierarchies with breadcrumbs.
- Reveal locations in Windows Explorer with one click.
- Copy or move files between workspace directories.

#### Absolute Safety and Integrity
- No deletion function exists in the office.
- No file overwriting: if a file with the same name exists at destination, it is renamed with a numeric index.
- Navigation strictly scoped to allowed roots: agent workspaces, Desktop, Documents, and Downloads. No arbitrary paths accepted.

#### Recent and Browse Views
- "Récents" button: lists files modified in the last 48 hours in the selected agent's workspace.
- "Parcourir" button: folder-by-folder exploration with clickable breadcrumbs.

#### File Actions
- "Afficher" button: reveals selected file in system file manager.
- Standard drag-and-drop: drag a file to any location in "Déposer dans" to create a copy.
- Shift + Drag-and-drop: hold Shift while dragging to move the file (requires double confirmation).

---

### Zone 5: "Tâches" Tab (Factual Plan Tracking)

Track concrete work progress without artificial guesswork.

#### What it is for
- Display real checkboxes from project documentation files (`TODO.md`).
- View structured action plans published by agents in activity logs.
- Observe a progress bar calculated strictly from checked tasks over total tasks.

#### Factual Truth Rule
- Progress bar and percentages are strictly calculated from the ratio of checked boxes.
- No percentages are predicted or extrapolated.
- If an agent publishes no plan in their logs, the UI faithfully states "Aucun plan publié par un agent pour le moment".

---

### Zone 6: Command Palette, Help, and Signals

#### Command Palette (`Ctrl+K`)
- Accessible via "Commandes" button or `Ctrl+K`.
- Search for agents, open stations, write messages, open team board ("Mémoire partagée"), switch tabs, or trigger actions from keyboard.
- Navigation: Up/Down arrows to select, Enter to confirm, Escape to dismiss.

#### Side Help Drawer (`?` key)
- Accessible via "Aide" button or `?` key, opens automatically on first visit.
- Contains 5-step guided tour, visual legends, and signal controls.

#### Signals: 8-bit Sounds and Desktop Notifications
- "Notifications Windows" button: enables system notifications when tab is backgrounded.
- "Sons" button: enables synthesized 8-bit Web Audio chimes (`public/sounds.js`) for events and delegations.
- Preference persists in localStorage (`bureau.sons`).

---

### Zone 7: "Salle de crise" Emergency Circuit Breaker

The crisis room is a safety mechanism to regain control during runaways, message loops, or critical errors without destroying work in progress.

#### Triggering and Visual Warning
- Accessible via the "Salle de crise" flip cover button in header, `Ctrl+Shift+C` emergency shortcut, or `Ctrl+K` palette.
- When engaged, the scene takes on an amber security halo and an alert banner appears at top of page.
- The modal requires explicit confirmation before arming ("Confirmer : enclencher la crise").

#### Immediate Effects of Crisis Lock
- **Hard lock on prompt routes**: `/api/prompt` and `/api/broadcast` reject requests with HTTP 423 ("Salle de crise active : les envois sont verrouillés").
- **Queue freeze**: Prompts are still accepted into the queue without loss, but no automatic dispatch occurs while crisis remains active.
- **Handover suspended**: Leadership handover messages pass through the queue and remain safely suspended.
- **Atomic persistence**: State `{active, since, reason}` persists in `.bureau/crise.json`. If corrupted, crisis defaults to active for safety.

#### Calm Diagnostics and Polite Interruption
- The modal lists connected agents with observed states, Herdr panes, and their last 4 raw terminal lines.
- **Polite stop by agent**: User clicks "Arrêter cet agent" then confirms ("Confirmer : interrompre [Nom]"). The server transmits the canonical Escape key (`esc` in Herdr via `POST /api/crise/arret`).
- **Absolute rule**: No process is forcefully killed (`kill`). Agents are politely asked to exit at application level to preserve file integrity on disk.
- **Recovery**: Once resolved, user clicks "Lever la crise" to unlock dispatches and resume the queue.

---

## 4. Keyboard Shortcuts and Quick Reference

| Area | Action or Shortcut | Effect |
| :--- | :--- | :--- |
| **General** | `Ctrl + K` | Opens modal command palette. |
| **General** | Palette `Ctrl+K`: "Tableau de l'équipe" | Opens team corkboard modal (shared memory). |
| **General** | Palette `Ctrl+K`: "Mode mosaïque" | Toggles between pixel art scene and terminal mosaic. |
| **General** | Palette `Ctrl+K`: "Salle de crise" | Opens crisis room diagnostic and control modal. |
| **General** | `Ctrl + Shift + C` | Immediately opens crisis room modal (emergency breaker). |
| **General** | `?` key | Toggles help drawer. |
| **Scene** | Click corkboard or "Tableau" button | Opens team board in read-only mode (pillar files). |
| **Scene** | "Mosaïque" / "Vue scène" button | Toggles view between animated scene and 2-4 terminal grid. |
| **Scene** | Click character (or tap on touch screen) | Opens individual workstation (scrolls on mobile). |
| **Scene** | Click mail stack | Opens Team tab and lead mail section. |
| **Scene** | "Disposer" button | Activates manual desk rearrangement mode. |
| **Scene** | `Escape` key | Closes one layer at a time: crisis modal, palette, team board, "Disposer", then help drawer. |
| **Scene** | "Plein écran" button | Expands scene and panel into unified panoramic view. |
| **Scene** | "Mettre en pause" button | Pauses or resumes canvas animations (scene follows clock every minute). |
| **Navigation** | `Right Arrow` / `Left Arrow` | Switches between tabs (Poste, Équipe, Fichiers, Tâches). |
| **Workstation** | `Ctrl + Enter` (or `Cmd + Enter`) | Sends prompt to selected agent. |
| **Workstation** | "Prioritaire" checkbox | Tags queued prompt for high-priority dispatch. |
| **Workstation** | "Mettre en file" button | Queues prompt if agent is busy or on quota break. |
| **Workstation** | "Agrandir" button | Expands or restores terminal to full height (including mobile). |
| **Workstation** | "Réponses lisibles" drawer | Expands structured agent responses with code copy and `.md` export. |
| **Workstation** | Terminal text selection | Temporarily pauses polling to copy text. |
| **Workstation** | "Figer" button | Freezes autoscroll. |
| **Workstation** | "Copier" button | Copies full terminal buffer to clipboard. |
| **Mosaic** | "Grille 2×2" / "Colonnes" button | Toggles tile arrangement in mosaic view. |
| **Mosaic** | `Ctrl + Enter` inside a tile | Dispatches quick prompt to that tile's agent. |
| **Mosaic** | "Agrandir" button on a tile | Opens full individual station for that agent. |
| **Mosaic** | "Revenir à la scène" button | Exits mosaic and restores animated office scene. |
| **Crisis** | "Salle de crise" button | Opens crisis room diagnostic and emergency controls. |
| **Crisis** | "Arrêter cet agent" button | Requests polite stop (Escape) for agent after confirmation. |
| **Crisis** | "Lever la crise" button | Unlocks prompt dispatches and resumes queue processing. |
| **Team** | "Direction de l'équipe" section | Selects team lead, restores default rule, or validates handover. |
| **Team** | "Passer en tête" button | Promotes a waiting queued prompt to high priority. |
| **Team** | "Retirer" button | Cancels a waiting prompt in the queue. |
| **Team** | `Ctrl + Enter` (or `Cmd + Enter`) | Triggers armed broadcast dispatch. |
| **Team** | "Cocher tous les disponibles" button | Selects all available agents in one click. |
| **Files** | Drag-and-drop onto destination | Copies file to chosen folder. |
| **Files** | `Shift` + Drag-and-drop onto destination | Moves file (requires confirmation). |
| **Files** | "Afficher" button | Reveals file in system file manager. |

---

## 5. Golden Rule: Factual Truth

The Agent Office strictly adheres to factual engineering rules:
1. Only observable facts are displayed (active processes, system clock, local logs, disk files).
2. No progress percentages are invented when a tool does not calculate them itself.
3. If an agent does not expose token consumption or subagents, "Non exposé par cet outil" is faithfully indicated.
4. Detected errors are never hidden: they are reported in terminal outputs and added to `LESSONS.md` to prevent regressions.
