// Rapport de fin de tâche pré-rempli (N9) : tests.
//
// Ce que le script garantit : il n'invente jamais un hash, il marque « à
// compléter » ce qu'il ne sait pas, et il ne laisse fuiter aucun chemin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rapportTache } from '../scripts/rapport-tache.mjs';

const executer = promisify(execFile);
const env = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !cle.startsWith('GIT_')));
const git = (depot, ...args) => executer('git', ['-C', depot, ...args], { env, windowsHide: true }).then(r => r.stdout.trim());

// Dépôt temporaire avec deux commits, dont un porte l'identifiant de tâche.
async function depotEssai(t) {
  const racine = await mkdtemp(join(tmpdir(), 'rapport-tache-'));
  t.after(() => rm(racine, { recursive: true, force: true }));
  await executer('git', ['init', '-q', '-b', 'main', racine], { env, windowsHide: true });
  await git(racine, 'config', 'user.name', 'Essai');
  await git(racine, 'config', 'user.email', 'essai@example.invalid');
  await writeFile(join(racine, 'fichier.txt'), 'un\n');
  await git(racine, 'add', 'fichier.txt');
  await git(racine, 'commit', '-q', '-m', 'N4 travail precedent');
  await writeFile(join(racine, 'fichier.txt'), 'un\ndeux\n');
  await git(racine, 'add', 'fichier.txt');
  await git(racine, 'commit', '-q', '-m', 'N9 rapport-tache : premier jet');
  return racine;
}

test('N9 rapport : identifiant, branche et hash des commits de la tâche', async t => {
  const depot = await depotEssai(t);
  const texte = await rapportTache('N9', { depot });
  assert.match(texte, /Rapport de fin de tâche N9 \(OpenCode\)\./);
  assert.match(texte, /Branche : main\./);
  assert.match(texte, /Hash : [0-9a-f]{7,} \(N9 rapport-tache : premier jet\)\./);
  // Les champs inconnus restent à compléter, jamais inventés.
  assert.match(texte, /Résumé : à compléter/);
  assert.match(texte, /Tests : à compléter/);
  assert.match(texte, /Non vérifié : à compléter/);
});

test('N9 rapport : les champs fournis sont repris tels quels', async t => {
  const depot = await depotEssai(t);
  const texte = await rapportTache('N9', {
    depot,
    agent: 'Codex',
    resume: 'Ligne une. Ligne deux. Ligne trois.',
    tests: '450 tests, 444 réussis, 0 échec.',
    nonVerifie: 'Le rendu à l\'écran.',
  });
  assert.match(texte, /Rapport de fin de tâche N9 \(Codex\)\./);
  assert.match(texte, /Résumé : Ligne une\. Ligne deux\. Ligne trois\./);
  assert.match(texte, /Tests : 450 tests, 444 réussis, 0 échec\./);
  assert.match(texte, /Non vérifié : Le rendu à l'écran\./);
});

test('N9 rapport : sans commit pour l\'identifiant, aucun hash n\'est inventé', async t => {
  const depot = await depotEssai(t);
  const texte = await rapportTache('N99', { depot });
  assert.match(texte, /Hash : aucun commit trouvé pour N99\./);
  assert.ok(!/Hash : [0-9a-f]{7}/.test(texte), 'aucun hash n\'est fabriqué');
});

test('N9 rapport : aucun chemin ni donnée personnelle dans la sortie', async t => {
  const depot = await depotEssai(t);
  const texte = await rapportTache('N9', { depot, resume: 'Essai.' });
  assert.ok(!texte.includes(depot), 'le chemin du dépôt ne sort pas');
  assert.ok(!texte.includes('rapport-tache-'), 'aucun nom de dossier temporaire');
  assert.ok(!/[A-Za-z]:\\/.test(texte), 'aucun chemin Windows');
  assert.ok(!texte.includes('/tmp/'), 'aucun chemin Unix');
});

test('N9 rapport : un identifiant est obligatoire', async () => {
  await assert.rejects(rapportTache('', { depot: '.' }), /Identifiant de tâche attendu/);
  await assert.rejects(rapportTache(null, { depot: '.' }), /Identifiant de tâche attendu/);
});
