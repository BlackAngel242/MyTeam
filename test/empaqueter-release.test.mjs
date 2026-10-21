import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { empaqueter, verifierZip } from '../scripts/empaqueter-release.mjs';

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
  assert.equal(typeof r.checksum, 'string', 'le checksum doit être écrit');
  assert.equal(await readFile(r.checksum, 'utf8'), `${r.sha256}  MyTeam-1.2.3.zip\n`);
  assert.ok((await stat(r.fichier)).size > 0);
  const noms = nomsZip(await readFile(r.fichier));
  assert.ok(noms.includes('MyTeam-1.2.3/README.md'));
  assert.ok(!noms.some(n => n.includes('revue-interne')));
  assert.ok(!noms.some(n => n.includes('non-suivi')));
  assert.ok(!noms.some(n => !n.startsWith('MyTeam-1.2.3')));
  const avant=await readFile(r.fichier);
  assert.doesNotThrow(()=>verifierZip(avant,'MyTeam-1.2.3/'));
  for(const mauvais of [Buffer.from('tar\ntgz\ntar.gz\nzip\n'),avant.subarray(0,-1),Buffer.alloc(64)]) {
    assert.throws(()=>verifierZip(mauvais,'MyTeam-1.2.3/'),/Archive ZIP invalide/);
  }
  assert.throws(()=>verifierZip(avant,'Autre-projet/'),/Archive ZIP invalide/);
  const corrompu=Buffer.from(avant);corrompu.writeUInt32LE(0,0);
  assert.throws(()=>verifierZip(corrompu,'MyTeam-1.2.3/'),/Archive ZIP invalide/);
  await assert.rejects(empaqueter('1.2.3',{depot,rev:'--list'}),/Révision invalide/);
  assert.deepEqual(await readFile(r.fichier),avant,'une option refusée ne remplace pas le ZIP existant');
  await git('tag','-a','version-test','-m','version de test');
  const tag=await empaqueter('1.2.4',{depot,rev:'version-test'});
  verifierZip(await readFile(tag.fichier),'MyTeam-1.2.4/');
  const blob=(await git('rev-parse','HEAD:README.md')).stdout.trim();
  await git('tag','fichier-seul',blob);
  await assert.rejects(empaqueter('1.2.5',{depot,rev:'fichier-seul'}),/Révision invalide/);
});

test('une version ou une révision invalide est refusée', async () => {
  await assert.rejects(empaqueter('v1'), /Version attendue/);
  await assert.rejects(empaqueter('1.0.0', { rev: 'HEAD; rm -rf /' }), /Révision invalide/);
  for(const rev of ['--list','--help','-o',null,{},''])await assert.rejects(empaqueter('1.0.0',{rev}),/Révision invalide/);
});

test('le ZIP de distribution garde une racine courte et écarte les notes de session', async () => {
  const attributs = await readFile(new URL('../.gitattributes', import.meta.url), 'utf8');
  for (const nom of ['AGENTS.md', 'CLAUDE.md', 'LESSONS.md', 'HANDOFF.md', 'JOURNAL.md', 'TODO.md', 'PRODUCT.md', 'DESIGN.md']) {
    assert.match(attributs, new RegExp(`^/${nom.replace('.', '\\.')} export-ignore$`, 'm'), `${nom} reste dans Git mais pas dans le ZIP`);
  }
  assert.match(attributs, /^docs\/\*\.md export-ignore$/m);
  assert.match(attributs, /^docs\/INSTALLATION\.md -export-ignore$/m);
  assert.match(attributs, /^\/test export-ignore$/m);
  assert.doesNotMatch(attributs, /^\/README\.md export-ignore$/m);
});

test('un journal privé suivi par erreur bloque la production du paquet', async t => {
  const depot = await mkdtemp(join(tmpdir(), 'release-prive-'));
  t.after(() => rm(depot, { recursive: true, force: true }));
  const git = (...a) => executer('git', ['-C', depot, '-c', 'user.name=T', '-c', 'user.email=t@example.invalid', ...a], { env: envGit });
  await git('init', '-q');
  for (const nom of ['.myteam-local/JOURNAL.md', '.bureau/queue.json', '.env.local']) {
    await mkdir(join(depot, nom, '..'), { recursive: true });
    await writeFile(join(depot, nom), 'donnée privée factice');
    await git('add', nom);
    await git('commit', '-q', '-m', 'fixture');
    await assert.rejects(empaqueter('1.2.3', { depot }), /privé/i);
    await git('rm', nom);
    await git('commit', '-q', '-m', 'fixture retirée');
  }
});
