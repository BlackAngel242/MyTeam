# Recommended Tools and Plugins

[Français](plugins-recommandes.md) | **English**

What the author uses alongside MyTeam. **Nothing is installed automatically**: this is an initial reference list to choose from based on your needs. Each installation requires your explicit confirmation within the respective tool.

## Command-Line AI Tools (in Herdr Panes)

Herdr recognizes the following agent types: `pi`, `claude`, `codex`, `gemini`, `cursor`, `devin`, `agy`, `cline`, `omp`, `mastracode`, `opencode`, `copilot`, `kimi`, `kiro`, `droid`, `amp`, `grok`, `hermes`, `kilo`, `qodercli`, `qwen`, `letta`, `maki`, `muse`. The author primarily uses Claude Code (team lead), Codex, Antigravity (`agy`), and OpenCode. The MyTeam installer detects present tools and offers to launch them pane by pane.

## Official Herdr Integrations

`herdr integration install <tool>` enables Herdr to receive accurate agent states and session identifiers. These integrations modify the configuration of the targeted tool: the installer proposes them one by one. Without the Claude integration, the office cannot display Claude's readable responses (no exact session ID). Supported tools: `pi`, `omp`, `claude`, `codex`, `copilot`, `devin`, `droid`, `kimi`, `opencode`, `kilo`, `hermes`, `qodercli`, `qwen`, `letta`, `cursor`, `mastracode`, `antigravity-cli`, `grok`.

## Claude Code Plugins Used by the Author

Surveyed in the author's installation (October 2026). Marketplace names match his environment; **verify the installation command with `claude plugin --help`** before copying, as commands are not guaranteed here.

| Plugin | Marketplace | Purpose |
| --- | --- | --- |
| superpowers | claude-plugins-official | Core workflows (planning, debugging, testing, reviewing). |
| frontend-design | claude-plugins-official | Interface design assistance. |
| impeccable | impeccable | Interface design review and refinement. |
| honey | greenpt | More concise responses and code, reduced token consumption. |
| pua | pua-skills | Evidence rigor and approach shifts after repeated failures. |
| netlify-skills | claude-plugins-official | Netlify deployment and configuration. |
| lovable | claude-plugins-official | Bridge to the Lovable application builder. |
| rust-analyzer-lsp | claude-plugins-official | Rust code analysis. |
| greptile | anthropic-plugin-directory | Assisted code reviews. |
| warp | claude-code-warp | Warp terminal integration. |

## VS Code Extensions Offered by the Installer

Markdown All in One (`yzhang.markdown-all-in-one`), ESLint (`dbaeumer.vscode-eslint`), and Prettier (`esbenp.prettier-vscode`): optional, individual confirmation per extension.

## What the Project Does Not Require

MyTeam has zero npm dependencies. Only Node.js 22 or higher and Herdr are required; everything else on this page is for convenience and productivity.
