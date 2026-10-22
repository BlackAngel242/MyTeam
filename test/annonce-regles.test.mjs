import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const executer = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/annonce-regles.mjs', import.meta.url));

test('annonce-regles : affiche les règles non négociables et la branche par outil', async () => {
  const { stdout } = await executer(process.execPath, [script]);
  assert.match(stdout, /Règles de travail MyTeam/);
  assert.match(stdout, /Une branche par outil et par tâche/);
  assert.match(stdout, /Jamais directement sur `main`/);
  assert.match(stdout, /Seul SmokeSama fusionne/);
});
