import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/installer-npm.mjs', import.meta.url));
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// Dossier personnel isolé : la cible est calculée depuis LOCALAPPDATA (Windows) ou HOME (autres systèmes).
async function maison(t) {
  const dossier = await mkdtemp(join(tmpdir(), 'myteam-npm-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  const cible = process.platform === 'win32' ? join(dossier, 'Programs', 'MyTeam') : join(dossier, '.local', 'lib', 'MyTeam');
  const lancer = (...args) => spawnSync(process.execPath, [script, ...args],
    { encoding: 'utf8', timeout: 30000, env: { ...process.env, LOCALAPPDATA: dossier, HOME: dossier, USERPROFILE: dossier } });
  return { cible, lancer };
}

test('--dry-run annonce la cible hors du dossier de données, sans rien écrire', async t => {
  const { cible, lancer } = await maison(t);
  const r = lancer('--dry-run');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes(cible), r.stdout);
  await assert.rejects(readdir(cible));
});

test('un dossier cible étranger à MyTeam est refusé sans modification', async t => {
  const { cible, lancer } = await maison(t);
  await mkdir(cible, { recursive: true });
  await writeFile(join(cible, 'package.json'), JSON.stringify({ name: 'autre-chose', version: '1.0.0' }));
  const r = lancer();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ne contient pas MyTeam : rien n'a été modifié/);
  assert.deepEqual(await readdir(cible), ['package.json']);
});

test('une installation existante relance son propre assistant, sans écraser, et signale la nouvelle version', async t => {
  const { cible, lancer } = await maison(t);
  await mkdir(join(cible, 'scripts'), { recursive: true });
  await writeFile(join(cible, 'package.json'), JSON.stringify({ name: '@drsmoke/myteam', version: '0.0.1' }));
  await writeFile(join(cible, 'scripts', 'installateur-anime.mjs'), "console.log('assistant existant ' + process.argv.slice(2).join(' '));");
  const r = lancer('--lang', 'fr', '--simple');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /MyTeam 0\.0\.1 est déjà installé/);
  assert.ok(r.stdout.includes(`La version ${version} existe`), r.stdout);
  assert.match(r.stdout, /assistant existant --lang fr --simple/);
  assert.deepEqual((await readdir(cible)).sort(), ['package.json', 'scripts']);
});
