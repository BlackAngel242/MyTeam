# Installing The Agent Office

[Français](INSTALLATION.md) | **English**

The Agent Office (Bureau des agents) is a lightweight local application: it opens in your web browser, visualizes your Herdr agents at work, and allows you to send them instructions. Everything stays on your local machine at address `127.0.0.1`. No API keys or tokens are ever requested, read, or saved by the office or by its setup scripts.

## Prerequisites

- Windows 10 or 11, macOS, or Linux.
- Node.js version 22 or higher (the installer script checks and offers to install it).
- Herdr, started before running the office: Herdr is the process manager that detects your agents.
- Optional: one or more command-line AI agents (Claude Code, Codex, OpenCode, Gemini CLI, Antigravity). The office functions without any of them installed: it displays whatever Herdr detects.

## One-Command Installation

**Windows** (open PowerShell in the project directory, then run):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\installer.ps1
```

**macOS or Linux** (open a terminal in the project directory, then run):

```bash
bash scripts/installer.sh
```

The script first performs pre-flight checks, then prompts for each component with a clear interactive "y/n" question. Nothing is installed without explicit consent. It also configures a 4-pane Herdr workspace (the first pane designated as lead), offers three recommended project extensions, and creates a desktop launcher shortcut of your choice. Useful parameters:

| Windows Option | macOS / Linux Option | Effect |
|---|---|---|
| `-DryRun` | `--dry-run` | Simulation: displays everything that would be done without installing or modifying anything |
| `-Oui` | `--oui` | Automatically answers yes to "y/n" prompts |
| `-Port 8317` | `--port 8317` | Customizes the office port (default is 4317) |
| `-HerdrChemin path\herdr.exe` | `--herdr-chemin path/herdr` | Points to Herdr binary if not found in PATH |
| `-SansRaccourci` | `--sans-raccourci` | Skips offering the desktop launcher shortcut |
| `-Aide` | `--aide` | Displays script command-line help |

The script can be rerun safely as often as needed: it inspects existing configuration and only sets up missing items. At the end, it outputs a clean summary of installed components, remaining tasks, and declined items.

### Additional steps offered by the installer

1. **4-pane Herdr workspace** (pane 1 = lead): created via `herdr workspace create --label "Bureau des agents"`, followed by three splits (`herdr pane split`) and renaming (`herdr pane rename`) into Chef, Agent 2, Agent 3, Agent 4. If a command fails or its output cannot be parsed, the script provides manual instructions instead of exiting abruptly. No AI tool is launched automatically: to launch an agent in a pane, the verified command is `herdr agent start <name> --kind claude --pane <pane-id>`.
2. **Recommended extensions** (optional): the script asks if you wish to see the list, then presents verified VS Code extensions one by one: `yzhang.markdown-all-in-one` (Markdown All in One, Yu Zhang), `dbaeumer.vscode-eslint` (ESLint, Microsoft), and `esbenp.prettier-vscode` (Prettier). They are installed via `code --install-extension` if VS Code is detected; otherwise, this step is skipped.
3. **Office launcher shortcut**: offers to create a launcher that starts Herdr and opens the office in your default browser without duplicating running servers.

## Manual Installation

### 1. Node.js (version 22 or higher)

- **Windows**: `winget install OpenJS.NodeJS.LTS` (verified winget package), or official installer from https://nodejs.org/en/download
- **macOS**: `brew install node`
- **Debian / Ubuntu**: `sudo apt-get update && sudo apt-get install -y nodejs npm`, then verify `node --version`: if below v22, distribution packages are outdated; install Node from https://nodejs.org/en/download
- **Fedora / RHEL**: `sudo dnf install -y nodejs npm`, same version check

Verification: `node --version` must show v22 or higher.

### 2. Herdr

Herdr is the terminal manager that detects your agents. Official installation commands from Herdr documentation (https://herdr.dev/docs/install/):

- **Windows PowerShell**: `powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 | iex"`
- **Windows, if antivirus blocks the command above**: `curl.exe -fsSLo install.cmd https://herdr.dev/install.cmd && install.cmd && del install.cmd`
- **macOS and Linux**: `curl -fsSL https://herdr.dev/install.sh | sh`

Then run `herdr` once. Verify with `herdr --version`. To update: `herdr update`.

If Herdr is installed but not in your PATH, the office can still locate it: set the `BUREAU_HERDR_PATH` environment variable to the full binary path (for example `C:\Users\you\.herdr\packages\standalone\releases\0.9.5-x86_64-pc-windows-msvc\herdr.exe` or equivalent under `~/.herdr/packages` on macOS and Linux).

### 3. The Project

1. Copy the project folder to your preferred local directory (no remote git repository required).
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

1. `npm test`: The test suite must pass; execution outputs the exact number of passed and skipped tests.
2. `npm run check`: Validates syntax of all project JavaScript files via `node --check`.
3. `node server.mjs` then `http://127.0.0.1:4317`: The office dashboard renders connected agents currently active in Herdr.

## Troubleshooting

- **"Le port du bureau est déjà utilisé" (Port already in use)**: Another program is listening on the port. Customize the port using `BUREAU_PORT` (e.g., 8317) and restart.
- **"Herdr est introuvable" (Herdr not found)**: Herdr is neither in PATH nor under `~/.herdr`. Install it (see above) or point `BUREAU_HERDR_PATH` to its binary. Quick check: `herdr --version`.
- **Office starts but no agents appear**: Herdr must be running with agents active in its panes. The office never simulates agents: if none are visible, Herdr reports none.
- **403 "Adresse locale requise" (Local address required)**: Connect using exact IP `http://127.0.0.1:4317` (not `http://localhost:4317`).
- **"Session expirée. Actualisez le bureau." (Session expired)**: The server process restarted. Simply refresh your browser tab.
- **Server fails to start**: Check `bureau.log` and `bureau-erreurs.log` in the project root directory for server logs.
- **Node.js missing or outdated**: `node --version` must show v22 or higher. Install from https://nodejs.org/en/download, open a new terminal, and re-run the setup script.
- **Antivirus blocks setup command**: This can occur with direct download-and-execute commands (`irm ... | iex`). Official Herdr and Claude Code docs provide alternative workflows with downloaded `install.cmd` files.
- **Tests fail**: Verify your Node.js version, then re-run `npm test`.
- **Complete uninstallation**: Delete the project directory (which also removes `.bureau/`, holding queued prompts), remove any desktop shortcut, and unset `BUREAU_PORT` and `BUREAU_HERDR_PATH`. Node.js, Herdr, and AI tools are uninstalled separately through their own standard procedures.

## Verified Sources

Commands above were verified on October 17, 2026 from official references: nodejs.org, local winget repository (`OpenJS.NodeJS.LTS`), herdr.dev documentation, code.claude.com/docs, github.com/openai/codex, opencode.ai/docs, github.com/google-gemini/gemini-cli. Antigravity CLI remains the sole unverified command, for which only official documentation URLs are provided.
