import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const executer = promisify(execFile);
const installeur = fileURLToPath(new URL('../scripts/installer.sh', import.meta.url));

// Résumé de simulation de l'installeur : il ne doit jamais affirmer qu'une action a été faite.
test('installeur bash en simulation : le résumé ne dit jamais « enregistré » ni « créé »', { skip: process.platform === 'win32' }, async t => {
  const maison = await mkdtemp(join(tmpdir(), 'resume-sim-'));
  t.after(() => rm(maison, { recursive: true, force: true }));
  const { stdout } = await executer('bash', [installeur, '--dry-run'], {
    cwd: maison,
    env: { ...process.env, HOME: maison },
    timeout: 90000,
  }).catch(e => e);
  const texte = String(stdout);
  assert.match(texte, /BUREAU_PORT.*(simulation|preview)/i, 'le port est annoncé comme simulé');
  assert.doesNotMatch(texte, /BUREAU_PORT: \d+ \(saved in profile\)/, 'pas de « saved in profile » en simulation');
  assert.doesNotMatch(texte, /Shortcut: created/, 'pas de « Shortcut: created » en simulation');
  assert.doesNotMatch(texte, /Tests: completed/, 'pas de « Tests: completed » en simulation');
  assert.deepEqual(await readdir(maison), [], 'rien n\'est écrit dans le dossier personnel');
});
