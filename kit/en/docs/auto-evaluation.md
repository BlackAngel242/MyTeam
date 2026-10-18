# Self-evaluation

Before saying "done", each AI (and the lead before merging) answers these questions, relying on facts.

1. Did the project checks run, and which ones? (`node scripts/evaluer.mjs` runs and summarizes them.)
2. Did I try the result for real (run it, click it, call it), not only read the code?
3. What could I not verify? (Say so in the report.)
4. Did I change only my files? (`git status`, `git diff`.)
5. Did I invent anything (value, state, percentage)? If so, remove it.
6. Did a mistake happen? Does it have a line in `LESSONS.md`?
7. Are `HANDOFF.md`, `JOURNAL.md` and the plan box up to date?

## For the lead: evaluating an agent's work

- Read the commit (`git show`), not only the report.
- Re-run the checks yourself, do not trust "it passes on my side".
- If a defect is found: fix it or send it back with the reason, then share the lesson (`node scripts/partager-lecons.mjs "the lesson"`).
- Check the box only when everything is verified.
