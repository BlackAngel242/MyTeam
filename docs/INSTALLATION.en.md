# Installing MyTeam · Agent desk

[Français](INSTALLATION.md) | **English**

MyTeam · Agent desk (Bureau des agents) is a lightweight local application: it opens in your web browser, visualizes your Herdr agents at work, and allows you to send them instructions. Everything stays on your local machine at address `127.0.0.1`. No API keys or tokens are ever requested, read, or saved by the office or by its setup scripts.

## Prerequisites

- Windows 10 or 11, macOS, or Linux.
- Node.js version 22 or higher (the installer script checks and offers to install it).
- Herdr, started before running the office: Herdr is the process manager that detects your agents.
- Optional: one or more command-line AI agents (Claude Code, Codex, OpenCode, Gemini CLI, Antigravity). The office functions without any of them installed: it displays whatever Herdr detects.

## What the installer does and does not do

### What the installer does

- **Rigorous verification**: Validates presence and minimum version of Node.js (>= 22) and Herdr.
- **Terminal comfort (Clink on Windows)**: Offers optional Clink installation via winget (`chrisant996.Clink`) to enhance cmd.exe with persistent history, advanced autocompletion, and color support.
- **2×2 Herdr grid**: Automatically configures a 4-pane workspace named `Chef`, `Agent 2`, `Agent 3`, and `Agent 4`.
- **Detection of all 24 Herdr tools**: Identifies in PATH all supported executables recognized by Herdr (`pi`, `claude`, `codex`, `gemini`, `cursor`, `devin`, `agy`, `cline`, `omp`, `mastracode`, `opencode`, `copilot`, `kimi`, `kiro`, `droid`, `amp`, `grok`, `hermes`, `kilo`, `qodercli`, `qwen`, `letta`, `maki`, `muse`).
- **Custom agent launch**: Prompts pane by pane to launch the tool of your choice, never forcing any agent.
- **Official Herdr integrations**: Offers to run `herdr integration install <tool>` for detected tools, warning that it alters their configuration.
- **Team lead orientation**: Installs the official lead skill (`herdr --skill`) for Claude Code or points to `CHEF.md` for other tools, then offers to send the orientation prompt to the lead pane.
- **Recommended extensions**: Suggests 3 useful VS Code project extensions (`Markdown All in One`, `ESLint`, `Prettier`).
- **Local configuration**: Saves `BUREAU_PORT` and `BUREAU_HERDR_PATH` in user environment without duplicates.
- **Launcher shortcut choice**: Offers to create a desktop shortcut for Herdr alone, the Web office alone, or the combined "Herdr and desktop" launcher.
- **Team collaboration kit**: Offers to initialize project collaboration files (`init-kit.mjs`) in your chosen project directory.
- **Immediate verification**: Offers to run `npm test` and `npm run check` to validate your environment.
- **Animated or text interface**: Available in an interactive live animated terminal interface (`scripts/installateur-anime.mjs` with pixel art banner and real-time task checklist) or in classic plain text mode.

### What the installer does NOT do

- **No external npm dependencies**: The project contains no `node_modules` and never runs `npm install`.
- **No key or secret collection**: No password, token, or API key is requested or handled. Each AI manages its own credentials.
- **No forced silent installation**: The `-Oui` / `--oui` flag NEVER auto-confirms software installations, integrations, agent launches, or team kit setup. Each sensitive action requires explicit interactive "y/n" consent.
- **No file overwriting**: The scripts never overwrite existing skills or project documents without explicit user confirmation.
- **No unauthorized external network requests**: The server strictly binds to the local interface `127.0.0.1`.

## Method 1: Installation from the Release Archive (Recommended)

This method is the easiest and does not require any developer tools upfront (no Git, no compilers).

1. **Download the archive**: Go to the GitHub repository [Releases page](https://github.com/BlackAngel242/MyTeam/releases) and download the ZIP file for the latest release.
2. **Extract the archive**: Extract all files into your preferred directory (for instance in your personal folder or documents).
3. **Run installation**:
   - **On Windows**: double-click `Installer MyTeam.bat`.
     * **Animated mode**: If Node.js (v22 or higher) is already present on your machine, the animated installer starts immediately inside your terminal (pixel art gradient banner, live task list updating in real time with color badges and spinner, optional Clink step for cmd.exe convenience, and interactive prompts).
     * **Text fallback if Node.js is missing**: If Node.js is missing or older than v22, the `.bat` file automatically switches to the secure text installer via PowerShell to offer Node.js installation via winget. Once Node.js is installed, simply close and rerun `Installer MyTeam.bat` to enjoy the animated setup experience.
   - **On macOS or Linux**: open a terminal in the extracted folder and run:
     ```bash
     bash scripts/installer.sh
     ```
     *(or `node scripts/installateur-anime.mjs` if Node.js 22+ is already available)*

> [!NOTE]
> **Windows SmartScreen security warning**: Like any `.bat` script downloaded from the Internet without a costly commercial code-signing certificate, Windows SmartScreen may display a blue warning box stating "Windows protected your PC". You can safely run the installer:
> - Click **More info**, then click the **Run anyway** button.
> - Or in advance: right-click `Installer MyTeam.bat` (or the ZIP archive before extraction) > **Properties** > check the **Unblock** box at the bottom of the General tab > click **OK**.

> [!TIP]
> **Demo mode**: You can preview the installer animation without installing anything, without network requests, and without altering your machine by running:
> ```bash
> node scripts/installateur-anime.mjs --demo
> ```

## Method 2: Installation from the Git Repository (Developers)

To contribute to the project or clone the latest development version:

```bash
git clone https://github.com/BlackAngel242/MyTeam.git
cd MyTeam
```

Then run the script suited for your operating system:

- **On Windows (PowerShell):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\installer.ps1
  ```
  *(or double-click `Installer MyTeam.bat` directly)*

- **On macOS or Linux (bash):**
  ```bash
  bash scripts/installer.sh
  ```

### Command-line Parameters

The setup scripts `scripts/installer.ps1` and `scripts/installer.sh`, as well as the animated driver `scripts/installateur-anime.mjs`, support options to customize setup:

| Windows Option | macOS / Linux Option | Node Animated Driver | Effect |
|---|---|---|---|
| `-DryRun` | `--dry-run` | `--dry-run` | Simulation: displays all planned actions without modifying or installing anything. |
| `-Oui` | `--oui` | (not forwarded) | Accepts standard configuration choices, but never auto-confirms software installations, integrations, agent launches, or kit setup (individual y/n confirmation remains mandatory). |
| `-Port 8317` | `--port 8317` | `--port 8317` | Customizes the office HTTP port (default: 4317 or existing `BUREAU_PORT` environment variable). |
| `-HerdrChemin path\herdr.exe` | `--herdr-chemin path/herdr` | (PATH auto-detection) | Points to the full Herdr executable path if missing from PATH. |
| `-SansRaccourci` | `--sans-raccourci` | (not forwarded) | Skips offering to create the desktop launcher shortcut. |
| `-Lang fr` or `-Lang en` | `--lang fr` or `--lang en` | `--lang fr` or `--lang en` | Forces installer message language (defaults to your operating system UI language). |
| `-Interface` | `--interface` | (enabled by default) | Structured protocol mode for communication with the animated installer. |
| (not applicable) | (not applicable) | `--demo` | Interactive demonstration of terminal animations without installing anything or using network. |
| (not applicable) | (not applicable) | `--simple` | Plain text output without ANSI codes or cursor rewrites (used automatically outside interactive TTY terminals). |
| `-Aide` | `--aide` | (not applicable) | Displays detailed command-line help. |

The script can be rerun safely at any time: it inspects your system and only sets up missing items.

### Detailed Step-by-Step Flow

1. **Node.js (version 22 or higher)**: The script checks Node.js presence. If missing or older than v22, it offers installation via your system package manager (`winget` on Windows, `brew` on macOS, or distribution package on Linux).
2. **Clink (terminal comfort on Windows)**: On Windows with winget available, the script offers optional installation of Clink (`chrisant996.Clink`), adding persistent command history, advanced completion, and user-friendly colors to cmd.exe. Skipped automatically if Clink is already installed or if winget is missing.
3. **Herdr (terminal manager)**: Searches for the Herdr executable in PATH or under `~/.herdr`. If not found, it prints official Herdr instructions and offers interactive setup. If Herdr is installed outside PATH, it records `BUREAU_HERDR_PATH`.
4. **4-pane Herdr workspace in 2×2 grid**: Creates a "Bureau des agents" workspace (`herdr workspace create`), splits right (`herdr pane split --direction right`), and splits each column downward (`--direction down`) to produce a balanced 2×2 grid. The four panes are automatically renamed `Chef`, `Agent 2`, `Agent 3`, and `Agent 4`. If parsing fails, verified manual commands are displayed.
5. **Detection of 24 tools and optional agent launch**: The script checks your environment for all 24 Herdr-supported tools: `pi`, `claude`, `codex`, `gemini`, `cursor`, `devin`, `agy`, `cline`, `omp`, `mastracode`, `opencode`, `copilot`, `kimi`, `kiro`, `droid`, `amp`, `grok`, `hermes`, `kilo`, `qodercli`, `qwen`, `letta`, `maki`, `muse`. For each pane (`Chef`, `Agent 2`, `Agent 3`, `Agent 4`), it displays a numbered list of detected tools and offers to launch the selected tool via `herdr agent start <name> --kind <tool> --pane <id>` after individual "y/n" confirmation.
6. **Official Herdr integrations**: For each detected tool supporting Herdr integrations (`pi`, `omp`, `claude`, `codex`, `copilot`, `devin`, `droid`, `kimi`, `opencode`, `kilo`, `hermes`, `qodercli`, `qwen`, `letta`, `cursor`, `mastracode`, `antigravity-cli`, `grok`), the script offers to execute `herdr integration install <tool>`. The script explicitly warns that this alters the tool configuration and requests confirmation.
7. **Lead commands and orientation prompt**:
   - If Claude Code is chosen for the lead pane, the script offers to extract the official skill (`herdr --skill`) and write it safely into `~/.claude/skills/herdr/SKILL.md` without overwriting existing files.
   - For other tools, the script explains that `CHEF.md` from the team kit provides all required instructions.
   - The script then prepares the verified orientation prompt:
     *"You are the team chief. Read AGENTS.md and CHEF.md, list agents with `herdr agent list`, then wait for instructions from DrSmoke."*
     It offers to send it directly to the lead pane via `herdr agent prompt <id>` after confirmation.
8. **Recommended VS Code extensions** (optional): If VS Code (`code`) is detected, the script offers to install verified extensions one by one: `yzhang.markdown-all-in-one` (Markdown All in One), `dbaeumer.vscode-eslint` (ESLint), and `esbenp.prettier-vscode` (Prettier).
9. **Port configuration and Desktop shortcut**:
   - Configures the HTTP listening port (default: 4317), saved into user environment variables.
   - Offers 3 desktop shortcut choices:
     * Option 1: Starts Herdr directly.
     * Option 2: Starts the office in your browser (runs `node server.mjs` and opens the local URL).
     * Option 3: "Herdr and desktop": launches Herdr in a visible terminal, starts the office server, and opens your browser.
10. **Project test suite**: If Node.js is validated, offers to run `npm test` and `npm run check` to verify system health.
11. **Team kit initialization**: Offers to initialize the collaboration kit (`node scripts/init-kit.mjs <folder> --lang <fr|en>`) in a project directory to deploy `AGENTS.md` rules, `CHEF.md` lead guidelines, `LESSONS.md` memory, and tracking templates without overwriting existing files.

## 6-Step Post-Installation Walkthrough

Once setup completes, follow this 6-step walkthrough to start your working session:

1. **Open the shortcut**: Double-click the "Herdr and desktop" shortcut created on your Desktop (or open Herdr in a terminal, then start `node server.mjs`).
2. **See the 4 panes in a 2×2 grid and the animated office in your browser**: Verify that Herdr displays your 4 terminals (`Chef`, `Agent 2`, `Agent 3`, `Agent 4`) and open `http://127.0.0.1:4317` in your browser to view the animated office scene with desk emblems and real-time lighting matching your system clock.
3. **The lead reads CHEF.md**: In the lead pane (or via the Desk tab in the web office), the lead reads `CHEF.md` and `AGENTS.md`, inspects team members with `herdr agent list`, and stands by to coordinate.
4. **First delegation**: Send an initial prompt to the lead from the office form (Ctrl+Enter). When the lead delegates a task in their log, observe their physical round across the office scene: they step away from the Direction desk and walk over to hand the folder to their teammate.
5. **Tasks tab**: Switch to the Tasks tab to monitor real-time factual progress of checked boxes in `TODO.md` and action plans published by agents, with zero invented percentages.
6. **Crisis room**: Locate the flip-covered "Salle de crise" (Crisis Room) button at the top of the office (shortcut: `Ctrl+Shift+C`) to instantly freeze outgoing instructions and order a polite interruption (Escape key) whenever needed.

## Manual Installation

### 1. Node.js (version 22 or higher)

- **Windows**: `winget install OpenJS.NodeJS.LTS` (verified winget package), or official installer from https://nodejs.org/en/download
- **macOS**: `brew install node`
- **Debian / Ubuntu**: `sudo apt-get update && sudo apt-get install -y nodejs npm`, then verify `node --version` (if below v22, download Node from https://nodejs.org/en/download)
- **Fedora / RHEL**: `sudo dnf install -y nodejs npm`, same version check

Verification: `node --version` must show v22 or higher.

### 2. Herdr

Herdr is the terminal manager that detects your agents. Official installation commands from Herdr documentation (https://herdr.dev/docs/install/):

- **Windows PowerShell**: `powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"`
- **Windows, if antivirus blocks the command above**: `curl.exe -fsSLo install.cmd https://herdr.dev/install.cmd && install.cmd && del install.cmd`
- **macOS and Linux**: `curl -fsSL https://herdr.dev/install.sh | sh`

Then run `herdr` once. Verify with `herdr --version`. To update: `herdr update`.

If Herdr is installed but not in your PATH, set the `BUREAU_HERDR_PATH` environment variable to the full binary path (for example `C:\Users\you\.herdr\packages\standalone\releases\0.9.5-x86_64-pc-windows-msvc\herdr.exe` or equivalent under `~/.herdr/packages` on macOS and Linux).

### 3. The Project

1. Copy the project folder to your preferred local directory.
2. Start the local server:

```powershell
node server.mjs
```

3. Open `http://127.0.0.1:4317` in your browser.

On Windows, double-clicking `Ouvrir le bureau.cmd` performs steps 2 and 3 automatically.

### 4. Command-line AI Tools (Optional)

Install only the tools you plan to use. Each tool manages its own authentication in its own CLI: never provide API keys to third-party scripts.

| Tool | Verified Installation Command | Official Documentation |
|---|---|---|
| Claude Code | Windows PowerShell: `irm https://claude.ai/install.ps1 \| iex` ; macOS and Linux: `curl -fsSL https://claude.ai/install.sh \| bash` ; also `winget install Anthropic.ClaudeCode` and `brew install --cask claude-code` | https://code.claude.com/docs |
| Codex (OpenAI) | macOS and Linux: `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` ; Windows: `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 \| iex"` ; also `npm install -g @openai/codex` | https://developers.openai.com/codex |
| OpenCode | `curl -fsSL https://opencode.ai/install \| bash` ; also `npm install -g opencode-ai`, `scoop install opencode`, or `choco install opencode` | https://opencode.ai/docs |
| Gemini CLI | `npm install -g @google/gemini-cli` ; also `brew install gemini-cli` | https://www.geminicli.com/docs/get-started/installation |
| Antigravity | Command not publicly verified: not supplied here | https://antigravity.google/product/antigravity-cli and https://antigravity.google/docs/cli/getting-started |

Two points of factual integrity:
- The installation command for Antigravity CLI could not be independently verified in public documentation at the time of writing: refer to the official link above rather than an unverified command.
- Google announced that Gemini CLI transitions to Antigravity CLI for free and Google One tiers (announcement from June 18, 2026: https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli). Gemini CLI remains installable, but review this announcement prior to choosing.

## Configuration

| Variable | Role | How to Configure |
|---|---|---|
| `BUREAU_PORT` | Office HTTP listening port (default: 4317) | Installer script, or user environment variable |
| `BUREAU_HERDR_PATH` | Full path to Herdr binary if not in PATH | Installer script, or user environment variable |

The installer script writes these configuration variables to user environment settings (Windows) or within a bounded block between `# >>> bureau-des-agents >>>` and `# <<< bureau-des-agents <<<` in `~/.profile` and `~/.bashrc` (macOS and Linux). This block is cleanly replaced on reruns without duplication. Open a fresh terminal after configuration for new variables to take effect.

## Verification Checklist

1. `npm test`: The test suite must pass (verifies local modules and system integrity).
2. `npm run check`: Validates syntax of all project JavaScript files via `node --check`.
3. `node server.mjs` then `http://127.0.0.1:4317`: The office dashboard renders connected agents currently active in Herdr.

## Troubleshooting

- **"Le port du bureau est déjà utilisé" (Port already in use)**: Another program is listening on the port. Customize the port using `BUREAU_PORT` (e.g., 8317) and restart.
- **"Herdr est introuvable" (Herdr not found)**: Herdr is neither in PATH nor under `~/.herdr`. Install it (see above) or point `BUREAU_HERDR_PATH` to its binary. Quick check: `herdr --version`.
- **Office starts but no agents appear**: Herdr must be running with agents active in its panes. The office never simulates agents: if none are visible, Herdr reports none.
- **403 "Adresse locale requise" (Local address required)**: Connect using exact IP `http://127.0.0.1:4317` (not `http://localhost:4317`).
- **"Session expirée. Actualisez le bureau." (Session expired)**: The server process restarted. Simply refresh your browser tab.
- **Server fails to start**: Open a terminal in the project directory and run `node server.mjs` directly. Messages and stack traces will be displayed clearly in the console. You can also verify whether port 4317 is already in use (`netstat -ano | findstr 4317` on Windows, `lsof -i :4317` on macOS/Linux) or if another Node instance is running.
- **Node.js missing or outdated**: `node --version` must show v22 or higher. Install from https://nodejs.org/en/download, open a new terminal, and re-run the setup script.
- **Antivirus blocks setup command**: This can occur with direct download-and-execute commands (`irm ... | iex`). Official Herdr and Claude Code docs provide alternative workflows with downloaded `install.cmd` files.
- **Tests fail**: Verify your Node.js version, then re-run `npm test`.
- **Complete uninstallation**: Delete the project directory (which also removes `.bureau/`, holding queued prompts), remove any desktop shortcut, and unset `BUREAU_PORT` and `BUREAU_HERDR_PATH`. Node.js, Herdr, and AI tools are uninstalled separately through their own standard procedures.

## Verified Sources

Commands above were verified on October 17, 2026 from official references: nodejs.org, local winget repository (`OpenJS.NodeJS.LTS`), herdr.dev documentation, code.claude.com/docs, github.com/openai/codex, opencode.ai/docs, github.com/google-gemini/gemini-cli. Antigravity CLI remains the sole unverified command, for which only official documentation URLs are provided.
