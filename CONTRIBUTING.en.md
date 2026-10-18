# Contributing to MyTeam (The Agent Office)

[Français](CONTRIBUTING.md) | **English**

Thank you for your interest in MyTeam (The Agent Office)! This project was designed to offer an immersive, living, and aesthetic local dashboard for developers directing multiple AI agents in Herdr.

## Guiding Principles and Golden Rules

All contributions must follow the project's core principles:

1. **Zero external dependencies**: The project uses no third-party npm packages (`npm install` is neither needed nor recommended). Everything relies exclusively on native Node.js built-ins (`node:http`, `node:fs`, `node:crypto`, `node:child_process`, `node:test`).
2. **Absolute factual truth**: The office displays only what is directly observed (Herdr processes, local logs, disk files, system clock). No simulated statuses, fictional agents, invented completion percentages, or unmarked approximations.
3. **Local security and sovereignty**: The server binds to `127.0.0.1` only. No secrets, credentials, tokens, or personal paths must ever leak into server responses, tests, or git commits.
4. **Signature and authorship**: All contributions are recorded under the GitHub profile of the project author (DrSmoke). No AI or tool names appear in commit messages or pull request titles. Credits to AI models are centralized in `README.md` and `docs/credits-ia.md`.
5. **Pixel art aesthetics**: Scenery, characters, and emblems adhere to a strict pixel grid (16×16 for tool logos). Identity colors must never be confused with semantic status colors (blue for working, mint for available or completed, amber for awaiting confirmation).
6. **Accessibility and clarity**: Full keyboard navigation, support for reduced motion settings (`prefers-reduced-motion`), and carefully written documentation without em-dashes.

---

## How to Participate?

### 1. Report a Bug

If you observe an unexpected behavior or error:
- First check that the issue is not already documented in existing tickets or in [`LESSONS.md`](LESSONS.md).
- Open a report using the dedicated GitHub issue template: describe observed facts, reproduction steps, and your environment (OS, Node.js version, Herdr version).
- Never include secrets, tokens, or private paths in your report.

### 2. Propose an Idea or Feature

Suggestions that enhance comfort, readability, or features of the agent OS are welcome:
- Use the feature request issue template.
- Explain the concrete use case, proposed user flow (in 3 to 5 steps), and code impact.

### 3. Add a Herdr-Compatible Tool and its Emblem

Herdr supports many agent kinds (`--kind`). To add or adapt an agent tool:
1. **16×16 pixel art emblem** in [`public/logos.js`](public/logos.js):
   - Exact grid of 16 rows of 16 characters (`.` for transparent, lowercase letters `a`, `b`, `c` for palette).
   - Harmonized palette of 2 to 4 hex colors.
   - Distinct and recognizable design, without copying trademarks.
2. **Lookup table**: map the Herdr kind identifier and its aliases in `window.AGENT_LOGO_MAP` in `public/logos.js`.
3. **Display name**: declare clean display name in the `names` dictionary in [`src/herdr.mjs`](src/herdr.mjs).
4. **Verification**: add or check tests in [`test/logos.test.mjs`](test/logos.test.mjs) (`npm test`).

### 4. Add or Improve a Translation

French is the reference language of the project; English is the international language:
- For the UI: contribute or complete the `public/i18n-<lang>.js` dictionary.
- For documentation: translate guides faithfully (`README.<lang>.md`, `docs/aide.<lang>.md`, `docs/kit.<lang>.md`), keeping exact command names and paths.

### 5. Propose a Lesson for LESSONS.md

[`LESSONS.md`](LESSONS.md) is the shared memory that prevents repeating previously encountered errors:
- Each lesson stems from a real bug encountered during development or operation.
- Compact format: one line per lesson, detailing the error, its cause, and the strict operational rule to prevent recurrence.
- Submit your proposed lesson in a pull request or dedicated issue.

---

## Submitting a Pull Request

1. Create a focused branch for your work (`git checkout -b my-feature`).
2. Write or update automated tests in `test/`.
3. Verify local conformance before submitting:
   ```powershell
   npm run check
   npm test
   ```
4. Complete the Pull Request checklist:
   - [ ] `npm run check` and `npm test` pass with zero errors.
   - [ ] No external dependencies added (zero npm dependencies).
   - [ ] The office displays only observed facts (no invented data).
   - [ ] UI changes verified on desktop and mobile (360 and 390 px).
   - [ ] Any new error encountered is added to `LESSONS.md`.
   - [ ] No AI tool names in commit messages or pull request titles.
5. Open your Pull Request against the main repository.
