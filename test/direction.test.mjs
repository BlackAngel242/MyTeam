import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDirection, DirectionError } from '../src/direction.mjs';

// Deux agents factices : la règle (plus petit panneau) donne w5:p1.
const liste = () => [
  { id: 'w5:p1@aaaa', paneId: 'w5:p1', name: 'Claude' },
  { id: 'w5:p4@bbbb', paneId: 'w5:p4', name: 'Codex' },
];

async function montage(t) {
  const dossier = await mkdtemp(join(tmpdir(), 'direction-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  return { file: join(dossier, 'direction.json') };
}

test('direction : sans choix, la règle donne le plus petit panneau', async t => {
  const { file } = await montage(t);
  const equipe = createDirection({ file, now: () => Date.parse('2026-10-17T12:00:00Z') });
  const vue = equipe.effective(liste());
  assert.equal(vue.boss.id, 'w5:p1@aaaa');
  assert.equal(vue.source, 'regle');
  assert.equal(vue.since, null);
});

test('direction : le choix de DrSmoke est appliqué et persisté hors Git', async t => {
  const { file } = await montage(t);
  const equipe = createDirection({ file, now: () => Date.parse('2026-10-17T12:00:00Z') });
  const vue = await equipe.set(liste(), 'w5:p4@bbbb');
  assert.equal(vue.source, 'choix');
  assert.equal(vue.since, '2026-10-17T12:00:00.000Z');
  assert.equal(equipe.effective(liste()).boss.id, 'w5:p4@bbbb');
  const brut = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(brut, { agentId: 'w5:p4@bbbb', since: '2026-10-17T12:00:00.000Z' });
  // Une nouvelle instance relit le même choix.
  const reprise = createDirection({ file, now: () => Date.parse('2026-10-17T13:00:00Z') });
  assert.equal(reprise.effective(liste()).source, 'choix');
  assert.equal(reprise.effective(liste()).since, '2026-10-17T12:00:00.000Z');
});

test('direction : l\'agent choisi disparu fait revenir la règle', async t => {
  const { file } = await montage(t);
  const equipe = createDirection({ file, now: () => Date.parse('2026-10-17T12:00:00Z') });
  await equipe.set(liste(), 'w5:p4@bbbb');
  // L'empreinte change : l'agent choisi n'est plus le même.
  const remplace = [{ id: 'w5:p1@aaaa', paneId: 'w5:p1' }, { id: 'w5:p4@autre', paneId: 'w5:p4' }];
  const vue = equipe.effective(remplace);
  assert.equal(vue.source, 'regle');
  assert.equal(vue.boss.id, 'w5:p1@aaaa');
  assert.deepEqual(equipe.choixActuel(), { agentId: 'w5:p4@bbbb', since: '2026-10-17T12:00:00.000Z' }, 'le choix reste consultable sans être appliqué');
});

test('direction : un agent absent de la liste Herdr est refusé', async t => {
  const { file } = await montage(t);
  const equipe = createDirection({ file, now: () => Date.parse('2026-10-17T12:00:00Z') });
  await assert.rejects(() => equipe.set(liste(), 'w5:p9@inconnu'), erreur => erreur instanceof DirectionError && erreur.status === 404);
  await assert.rejects(() => equipe.set(liste(), ''), erreur => erreur.status === 400);
  assert.equal(equipe.effective(liste()).source, 'regle');
});

test('direction : le retour à la règle est persisté', async t => {
  const { file } = await montage(t);
  const equipe = createDirection({ file, now: () => Date.parse('2026-10-17T12:00:00Z') });
  await equipe.set(liste(), 'w5:p4@bbbb');
  const vue = await equipe.clear();
  assert.deepEqual(vue, { source: 'regle', since: null });
  assert.equal(equipe.effective(liste()).boss.id, 'w5:p1@aaaa');
  const brut = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(brut.agentId, null);
  const reprise = createDirection({ file, now: () => Date.parse('2026-10-17T13:00:00Z') });
  assert.equal(reprise.effective(liste()).source, 'regle');
});

test('direction : aucune liste d\'agents ne donne aucun chef plutôt qu\'un faux', async t => {
  const { file } = await montage(t);
  const equipe = createDirection({ file, now: () => Date.parse('2026-10-17T12:00:00Z') });
  assert.deepEqual(equipe.effective([]), { boss: null, source: 'regle', since: null });
  assert.deepEqual(equipe.effective(null), { boss: null, source: 'regle', since: null });
});
