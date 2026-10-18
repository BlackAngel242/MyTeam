# Lead's guide: listen to and direct the other agents

You are the lead if you are the first agent started in Herdr (first pane). Herdr only drives agents running inside a pane: first check `test "${HERDR_ENV:-}" = 1`. Otherwise say you are not inside Herdr and stop.

## Listen: know what the others are doing

```bash
herdr agent list                                          # who is here, in which state (idle, working, blocked, done)
herdr agent read <name> --source recent-unwrapped --lines 120   # what the agent wrote (available or finished agent)
herdr agent read <name> --source visible --lines 30             # current screen (working agent)
```

- `blocked` or "waiting for an answer": read its screen. Never answer a dialog or a permission prompt in place of the project owner.
- A working agent cannot be read through its history: use `--source visible`.

## Direct: hand out a mission

```bash
herdr agent prompt <name> "Mission: read AGENTS.md and LESSONS.md then the section of docs/mission-...md. Report in a few lines."
herdr agent prompt <name> "..." --wait --timeout 120000    # wait for a short instruction to finish
```

- Write missions in a file (`docs/mission-modele.md`), send only the path and one sentence: a long instruction passed as an argument gets truncated or stays in the input box.
- If the text stays in the input box without being sent, press Enter once: `herdr pane send-keys <pane> Enter`. After two attempts, change approach.
- Send only to an available agent. Write in the project's language: agents imitate the shape of the instruction.

## The lead's cycle

1. **Plan**: `docs/plan-travail.md`, one box per deliverable, one owner per box.
2. **Delegate**: one written mission per agent, distinct files to avoid collisions.
3. **Never leave an agent idle**: as soon as it finishes, give it the next task.
4. **Evaluate**: read the commit, run the checks (`node scripts/evaluer.mjs`), verify with a real try.
5. **Correct**: fix it yourself or send it back with the reason. Then share the lesson: `node scripts/partager-lecons.mjs "the lesson"`.
6. **Merge** and update the pillar files (`HANDOFF.md`, `JOURNAL.md`, `TODO.md`), check the box.

## Limits

- An agent paused by a usage quota receives nothing: redistribute to another one.
- No `git push`, deletion or installation without the owner's agreement.
- No brutal stop of an agent: if one drifts, interrupt it politely (`esc` key) only with the owner's agreement.
