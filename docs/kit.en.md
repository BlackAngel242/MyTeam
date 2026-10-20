# Team Kit: Pillar Files, Self-Evaluation, and Shared Lessons

[Français](kit.md) | **English**

The kit brings to any project the methodology used to build MyTeam: a multi-agent AI team directed by a lead, guided by pillar files that all models read, evaluated through observed facts, and relying on a shared memory of past mistakes.

## Installing the Kit in a Project

```bash
node scripts/init-kit.mjs <project-folder> [--lang fr|en] [--dry-run]
```

- Creates missing files and **never overwrites** existing files (marked "conserved / kept").
- `--dry-run` displays what would be created without writing to disk. Default language: system language.
- The MyTeam installer offers this step at the end (interactive y/n prompt).

## What the Kit Contains

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Rules for all AI models: roles, one file one owner, factual truth, definition of "done", error loop, signature, and security. |
| `CLAUDE.md`, `GEMINI.md` | Redirect to `AGENTS.md`: all tools read the same source of truth. Codex and OpenCode read `AGENTS.md` directly. |
| `CHEF.md` | Lead's operational manual: listening to agents (`herdr agent list`, `herdr agent read`) and directing them (`herdr agent prompt`), plan-delegate-evaluate-correct-merge cycle. |
| `LESSONS.md` | Reviewed generic lessons, one line per lesson; no raw session reports. |
| `.myteam-local/HANDOFF.md`, `.myteam-local/JOURNAL.md`, `TODO.md`, `PRODUCT.md` | Active stage, dated history, actionable checkboxes, product specifications. |
| `docs/plan-travail.md` | Work plan with assigned owners and tasks: the office calculates completion percentages directly from checked boxes. |
| `docs/mission-modele.md` | Written mission template for dispatching work to agents. |
| `docs/auto-evaluation.md` | Self-reflection checklist before declaring work complete, plus lead evaluation rubric. |
| `scripts/evaluer.mjs`, `scripts/partager-lecons.mjs` | Both command-line utilities below, copied into the target project. |

## Self-Evaluation

```bash
node scripts/evaluer.mjs [folder] [--lang fr|en] [--json] [--sans-tests]
```

A report built exclusively from observable facts: present pillar files, checked tasks in work plan and `TODO.md` with calculated ratio, lesson count, recent commits on `LESSONS.md`, pending git changes, pillar files falling behind the latest commit, and outputs of `npm run check` and `npm test` if available. Zero invented scores. Exits with code 1 if a pillar is missing or a check fails.

## Sharing Lessons Across Agents

```bash
node scripts/partager-lecons.mjs "The lesson, in a single line." [folder] [--dry-run] [--lang fr|en]
```

Appends the lesson to `LESSONS.md` (idempotent, single entry), then alerts **available** Herdr agents from this project only (`idle` or `done`): sends a concise notification, followed by an Enter key in case text remains buffered in the prompt area. An agent at work is never interrupted: they are flagged "to be notified later". If Herdr is unreachable, the lesson is saved to disk without agent dispatches.

## The Lead Listens and Directs

The first agent started in Herdr acts as the team lead. `CHEF.md` provides their CLI commands; the installer can send orientation instructions and install official Herdr integrations (`herdr integration install <tool>`) to surface live statuses and session IDs. The office displays the lead at the Direction desk, tracks delegations and mail, and can alert them when an agent finishes (optional notification relay).

## Signature

All contributions are signed by the author's GitHub profile, never by an AI. AI models are credited once in `README.md` (under "Built with the Help of AI"). See `AGENTS.md`.

The initializer creates a local `.gitignore` entry for `.myteam-local/` without replacing existing rules. Handoff and journal are private session notes; public root files are generic technical guides. Existing files are never overwritten. MyTeam runtime state is separate, in system data under `MyTeam`, outside the checkout.
