import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const installer = fileURLToPath(new URL('../skillmarket/installer.mjs', import.meta.url));
const project = fileURLToPath(new URL('../skillmarket/', import.meta.url));

function run(...args) {
  const p = spawnSync(process.execPath, [installer, ...args], { encoding: 'utf8', timeout: 20000 });
  assert.equal(p.error, undefined);
  return p;
}

test('SkillMarket : manifest portable et définitions cohérentes', async () => {
  const plugin = JSON.parse(await readFile(join(project, 'plugin.json'), 'utf8'));
  assert.equal(plugin.name, 'drsmoke-quality-workflows');
  for (const skill of ['fixit', 'table-ronde']) {
    const content = await readFile(join(project, 'skills', skill, 'SKILL.md'), 'utf8');
    assert.match(content, new RegExp('^---\\nname: ' + skill + '\\n'));
    assert.match(content, /\ndescription: .+\n/);
  }
});

test('SkillMarket : simulation, installation et réexécution sans écraser', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'skillmarket-test-'));
  try {
    const dry = run('--tool', 'codex', '--dir', tmp, '--dry-run');
    assert.equal(dry.status, 0, dry.stderr);
    assert.deepEqual(await readdir(tmp), []);
    const first = run('--tool', 'codex', '--dir', tmp);
    assert.equal(first.status, 0, first.stderr);
    assert.match(await readFile(join(tmp, 'fixit', 'SKILL.md'), 'utf8'), /^---\nname: fixit/m);
    assert.match(await readFile(join(tmp, 'table-ronde', 'SKILL.md'), 'utf8'), /^---\nname: table-ronde/m);
    const again = run('--tool', 'codex', '--dir', tmp);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /déjà à jour/);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('SkillMarket : conflit détecté avant toute écriture ; remplacement sauvegardé', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'skillmarket-conflict-'));
  try {
    const first = run('--tool', 'codex', '--dir', tmp, '--skill', 'fixit');
    assert.equal(first.status, 0, first.stderr);
    await writeFile(join(tmp, 'fixit', 'SKILL.md'), 'version privée', 'utf8');
    const conflict = run('--tool', 'codex', '--dir', tmp);
    assert.notEqual(conflict.status, 0);
    assert.equal(await readFile(join(tmp, 'fixit', 'SKILL.md'), 'utf8'), 'version privée');
    assert.deepEqual((await readdir(tmp)).sort(), ['fixit']);
    const replace = run('--tool', 'codex', '--dir', tmp, '--replace');
    assert.equal(replace.status, 0, replace.stderr);
    const files = await readdir(tmp);
    const backup = files.find(name => name.startsWith('fixit.backup-'));
    assert.ok(backup, 'Sauvegarde avant écrasement');
    assert.equal(await readFile(join(tmp, backup, 'SKILL.md'), 'utf8'), 'version privée');
    assert.ok(files.includes('table-ronde'));
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('SkillMarket : ChatGPT refuse une fausse installation locale', () => {
  const runResult = run('--tool', 'chatgpt', '--dry-run');
  assert.notEqual(runResult.status, 0);
  assert.match(runResult.stderr, /ChatGPT n’accepte pas une installation locale/);
});
