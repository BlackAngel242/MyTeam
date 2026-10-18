# Lessons

Shared memory of all the project's AIs. One lesson per line: the mistake, its cause, the rule. Add one for each new mistake (or `node scripts/partager-lecons.mjs "the lesson"` to also notify the agents).

- One file, one owner: before changing another agent's file, read its `git diff`.
- Commit only your own files (`git add <paths>`), never `git add -A`: history would credit the work to the wrong author.
- Never answer a dialog or a permission prompt in place of the project owner.
- Pasted text can stay in an agent's input box without being sent: after two attempts, change approach instead of repeating.
- Do not edit the project's test script to get around a sandbox limit: pass the option on the command line and say so.
- Do not commit when tests could not run: leave the files modified and tell the lead.
- A fix is only verified after restarting the process concerned and a real try.
- Write instructions in the expected language and shape: agents imitate the shape of the instruction.
