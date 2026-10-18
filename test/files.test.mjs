import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm, symlink, utimes} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {listDir, recentFiles, transfer, resolveInside} from '../src/files.mjs';

async function sandbox(t) {
  const base = await mkdtemp(join(tmpdir(), 'bureau-fichiers-'));
  t.after(() => rm(base, {recursive:true, force:true}));
  const a = join(base, 'agent'), b = join(base, 'bureau'), outside = join(base, 'dehors');
  for (const d of [a, b, outside, join(a, 'src'), join(a, 'node_modules')]) await mkdir(d, {recursive:true});
  await writeFile(join(a, 'rapport.md'), 'Rapport');
  await writeFile(join(a, 'src', 'app.js'), 'code');
  await writeFile(join(a, 'node_modules', 'ignore.js'), 'x');
  await writeFile(join(outside, 'secret.txt'), 'secret');
  return {a, b, outside};
}

test('un chemin ne sort jamais du dossier autorisé', async t => {
  const {a} = await sandbox(t);
  for (const bad of ['../dehors/secret.txt', '..\\dehors\\secret.txt', '/etc/passwd', 'C:\\Windows\\win.ini', 'a\0b']) {
    await assert.rejects(resolveInside(a, bad));
  }
});

test('un lien symbolique vers l’extérieur est refusé', async t => {
  const {a, outside} = await sandbox(t);
  try { await symlink(join(outside, 'secret.txt'), join(a, 'lien.txt')); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) return t.skip('Liens non autorisés sur ce poste'); throw error; }
  await assert.rejects(resolveInside(a, 'lien.txt'), /sort du dossier/);
});

test('les fichiers récents ignorent node_modules et suivent la date', async t => {
  const {a} = await sandbox(t);
  const old = new Date(Date.now() - 7 * 86400e3);
  await utimes(join(a, 'src', 'app.js'), old, old);
  const names = (await recentFiles(a)).map(f => f.path);
  assert.deepEqual(names, ['rapport.md']);
});

test('la liste d’un dossier place les dossiers en premier', async t => {
  const {a} = await sandbox(t);
  const items = await listDir(a);
  assert.equal(items[0].dir, true);
  assert.ok(items.some(i => i.name === 'rapport.md' && !i.dir));
});

test('copier ne remplace jamais un fichier existant', async t => {
  const {a, b} = await sandbox(t);
  await writeFile(join(b, 'rapport.md'), 'Ancien');
  const result = await transfer({fromRoot:a, fromPath:'rapport.md', toRoot:b, mode:'copy'});
  assert.equal(result.name, 'rapport (2).md');
  assert.equal(await readFile(join(b, 'rapport.md'), 'utf8'), 'Ancien');
  assert.ok(existsSync(join(a, 'rapport.md')));
});

test('déplacer retire le fichier de son origine', async t => {
  const {a, b} = await sandbox(t);
  await transfer({fromRoot:a, fromPath:'rapport.md', toRoot:b, mode:'move'});
  assert.ok(!existsSync(join(a, 'rapport.md')));
  assert.equal(await readFile(join(b, 'rapport.md'), 'utf8'), 'Rapport');
});

test('dossier, action inconnue et sortie de racine refusés', async t => {
  const {a, b} = await sandbox(t);
  await assert.rejects(transfer({fromRoot:a, fromPath:'src', toRoot:b}), /Seuls les fichiers/);
  await assert.rejects(transfer({fromRoot:a, fromPath:'rapport.md', toRoot:b, mode:'delete'}), /Action inconnue/);
  await assert.rejects(transfer({fromRoot:a, fromPath:'rapport.md', toRoot:b, toPath:'../dehors'}), /sort du dossier/);
});

test('un déplacement ne remplace jamais un fichier apparu après le contrôle du nom libre', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'deplace-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const a = join(dir, 'source'), b = join(dir, 'cible');
  await mkdir(a); await mkdir(b);
  await writeFile(join(a, 'rapport.txt'), 'nouveau');
  // Un écrivain extérieur crée la destination juste après le contrôle d'existence (existsSync), avant la création.
  const fs = (await import('node:fs')).default;
  const {syncBuiltinESMExports} = await import('node:module');
  const original = fs.existsSync;
  let injecte = false;
  fs.existsSync = chemin => { const vu = original(chemin); if (!vu && !injecte && chemin.endsWith('rapport.txt') && chemin.startsWith(b)) { injecte = true; fs.writeFileSync(chemin, 'concurrent'); } return vu; };
  syncBuiltinESMExports();
  try {
    const r = await transfer({fromRoot: a, fromPath: 'rapport.txt', toRoot: b, mode: 'move'});
    assert.equal(injecte, true);
    assert.equal(r.name, 'rapport (2).txt');
    assert.equal(await readFile(join(b, 'rapport.txt'), 'utf8'), 'concurrent');
    assert.equal(await readFile(join(b, 'rapport (2).txt'), 'utf8'), 'nouveau');
    assert.equal(original(join(a, 'rapport.txt')), false);
  } finally { fs.existsSync = original; syncBuiltinESMExports(); }
});
