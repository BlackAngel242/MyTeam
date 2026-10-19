import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { brancheAgent } from '../scripts/branche-agent.mjs';

const executer = promisify(execFile);
const env = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !cle.startsWith('GIT_')));
const git = (depot, ...args) => executer('git', ['-C', depot, ...args], { env, windowsHide: true }).then(r => r.stdout.trim());

async function depotDeTest(t) {
  const dossier = await mkdtemp(join(tmpdir(), 'branche-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  const depot = join(dossier, 'projet');
  await executer('git', ['init', '-q', '-b', 'main', depot], { env, windowsHide: true });
  await git(depot, 'config', 'user.email', 'essai@example.invalid');
  await git(depot, 'config', 'user.name', 'Essai');
  await writeFile(join(depot, 'a.txt'), 'a');
  await git(depot, 'add', 'a.txt');
  await git(depot, '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'départ');
  return depot;
}

test('la branche d\'un agent vit dans son propre dossier de travail, depuis la base demandée', async t => {
  const depot = await depotDeTest(t);
  const r = await brancheAgent('antigravity', 'L10', { depot });
  assert.equal(r.branche, 'agent/antigravity/L10');
  assert.equal(basename(r.dossier), 'antigravity-L10');
  assert.ok((await stat(join(r.dossier, 'a.txt'))).isFile());
  assert.equal(await git(r.dossier, 'rev-parse', '--abbrev-ref', 'HEAD'), 'agent/antigravity/L10');
  assert.equal(await git(depot, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main', 'le dossier principal ne change pas de branche');
});

test('noms invalides et branche déjà existante refusés sans rien créer', async t => {
  const depot = await depotDeTest(t);
  await assert.rejects(brancheAgent('Agent Un', 'L1', { depot }), /Nom d’agent invalide/);
  await assert.rejects(brancheAgent('codex', 'a b', { depot }), /Identifiant de tâche invalide/);
  await assert.rejects(brancheAgent('codex', 'x', { depot, base: '-D' }), /Base invalide/);
  await brancheAgent('codex', 'L2', { depot });
  await assert.rejects(brancheAgent('codex', 'L2', { depot }), /existe déjà/);
});

test('OpenCode ne reçoit jamais de worktree (décision de DrSmoke)', async t => {
  const depot = await depotDeTest(t);
  await assert.rejects(brancheAgent('opencode', 'L3', { depot }), /Pas de worktree pour OpenCode/);
  assert.equal(await git(depot, 'branch', '--list', 'agent/opencode/L3'), '');
});
