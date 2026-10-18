# Project rules for every AI

This file applies to every AI working on this project (Claude, Codex, OpenCode, Antigravity, Gemini and others). Read it in full before the first change. The other instruction files (`CLAUDE.md`, `GEMINI.md`) point here: one single source.

## Read before working

1. `LESSONS.md`: mistakes already made and how to avoid them. Never repeat them.
2. `PRODUCT.md` (what the product does), then `HANDOFF.md` (current state) and `TODO.md`.
3. `docs/plan-travail.md`: the plan, the owners and the state of each box.
4. If you are the lead: `CHEF.md`.

## Roles

- The lead is the first agent started in Herdr (first pane). It coordinates, splits the work into written missions, evaluates, corrects and merges. It never leaves an agent idle without a task.
- The other agents receive a written mission (`docs/mission-modele.md`), work in the files entrusted to them and report in a few lines.
- The project owner decides. No AI answers a dialog, a permission prompt or a folder choice in their place.

## One file, one owner

- Each file or folder has an owner in `docs/plan-travail.md`. Before changing another agent's file: read its `git diff`, then ask the lead.
- Commit only your own files (`git add <paths>`), never `git add -A`.

## Truth of facts

- Invent nothing: no percentage, state or result that was not observed (file, log, test actually run).
- Any approximation is named as such.

## Definition of "done"

- The project checks pass (tests, syntax check) and their result is stated.
- The work was tried for real, not only read.
- The report says what could not be verified.
- A new mistake becomes a line in `LESSONS.md`.

## Correction loop (learning together)

- `LESSONS.md` is the shared memory: a single copy, re-read by every AI before each mission.
- When the lead corrects an agent's work, it adds the lesson (mistake, cause, rule) and then tells all agents: `node scripts/partager-lecons.mjs "the lesson"`.
- Each agent that meets a new mistake adds it itself and says so in its report.
- Only the lead checks a plan box, after evaluation (`node scripts/evaluer.mjs`).

## Signature and author (mandatory)

- Every contribution goes through the project owner's GitHub profile: the author and contributor is them, and nobody else. Never change the repository's Git identity.
- No AI signs anything: no `Co-Authored-By`, no "Generated with ...", no AI name in the author, a commit message, a pull request or a release.
- Credit to AIs (tools and models used) appears in one place: a "Built with the help of AI" section of `README.md`.

## Security

- No secret, token or account identifier in Git, logs or documents.
- No publication, no `git push`, no deletion or installation without the explicit agreement of the project owner.

## Writing

Simple sentences, in the project's language. Code: comments only for non-obvious logic.
