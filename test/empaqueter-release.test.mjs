import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { empaqueter } from '../scripts/empaqueter-release.mjs';

const executer = promisify(execFile);
// Le crochet de commit exporte GIT_INDEX_FILE : les dépôts temporaires des tests doivent l'ignorer.
const envGit = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !cle.startsWith('GIT_')));

// Noms des entrées d'un zip, lus dans le répertoire central (aucun outil externe : tar varie selon le système).
function nomsZip(octets) {
  let fin = octets.length - 22;
  while (fin >= 0 && octets.readUInt32LE(fin) !== 0x06054b50) fin--;
  assert.ok(fin >= 0, 'fin de répertoire central introuvable');
  const total = octets.readUInt16LE(fin + 10);
  let p = octets.readUInt32LE(fin + 16);
  const noms = [];
  for (let i = 0; i < total; i++) {
    assert.equal(octets.readUInt32LE(p), 0x02014b50);
    const longueur = octets.readUInt16LE(p + 28), extra = octets.readUInt16LE(p + 30), commentaire = octets.readUInt16LE(p + 32);
    noms.push(octets.toString('utf8', p + 46, p + 46 + longueur).replace(/\/$/, ''));
    p += 46 + longueur + extra + commentaire;
  }
  return noms;
}

test('l\'archive contient les fichiers suivis dans MyTeam-<version>/, sans les export-ignore ni les fichiers non suivis', async t => {
  const depot = await mkdtemp(join(tmpdir(), 'release-'));
  t.after(() => rm(depot, { recursive: true, force: true }));
  const git = (...a) => executer('git', ['-C', depot, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', ...a], { env: envGit });
  try { await git('init', '-q'); } catch { t.skip('git indisponible'); return; }
  await mkdir(join(depot, 'docs'));
  await writeFile(join(depot, 'README.md'), 'ok');
  await writeFile(join(depot, 'docs', 'revue-interne.md'), 'interne');
  await writeFile(join(depot, '.gitattributes'), 'docs/revue-*.md export-ignore\n');
  await writeFile(join(depot, 'non-suivi.txt'), 'x');
  await git('add', 'README.md', 'docs', '.gitattributes');
  await git('commit', '-q', '-m', 'essai');
  const r = await empaqueter('1.2.3', { depot });
  assert.match(r.sha256, /^[0-9a-f]{64}$/);
  assert.ok((await stat(r.fichier)).size > 0);
  const noms = nomsZip(await readFile(r.fichier));
  assert.ok(noms.includes('MyTeam-1.2.3/README.md'));
  assert.ok(!noms.some(n => n.includes('revue-interne')));
  assert.ok(!noms.some(n => n.includes('non-suivi')));
  assert.ok(!noms.some(n => !n.startsWith('MyTeam-1.2.3')));
});

test('une version ou une révision invalide est refusée', async () => {
  await assert.rejects(empaqueter('v1'), /Version attendue/);
  await assert.rejects(empaqueter('1.0.0', { rev: 'HEAD; rm -rf /' }), /Révision invalide/);
});
