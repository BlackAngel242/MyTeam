import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  return { dossier, file: join(dossier, 'direction.json') };
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

test('direction : départ à froid, l\'appelant trie par numéro de panneau sans mémoire', async t => {
  const { file } = await montage(t);
  const equipe = createDirection({ file, now: () => Date.parse('2026-10-17T12:00:00Z') });
  // Aucun carnet et une liste donnée dans le désordre : au premier
  // démarrage, les agents déjà présents gardent l'ordre de numéro de
  // panneau, porté par l'appelant et non par bossOf.
  const desordre = [
    { id: 'w5:p4@bbbb', paneId: 'w5:p4', name: 'Codex' },
    { id: 'w5:p1@aaaa', paneId: 'w5:p1', name: 'Claude' },
  ];
  assert.equal(equipe.effective(desordre).boss.id, 'w5:p1@aaaa');
});

test('direction : le premier agent vu reste directeur et le carnet survit au redémarrage', async t => {
  const { dossier, file } = await montage(t);
  let heure = Date.parse('2026-10-17T12:00:00Z');
  const now = () => heure;
  const p2 = { id: 'w5:p2@bbbb', paneId: 'w5:p2', name: 'Codex' };
  const p1 = { id: 'w5:p1@aaaa', paneId: 'w5:p1', name: 'Claude' };
  const equipe = createDirection({ file, now });
  // w5:p2 est vu seul, une minute avant l'arrivée de w5:p1.
  assert.equal(equipe.effective([p2]).boss.id, 'w5:p2@bbbb');
  heure += 60_000;
  // w5:p1 a le plus petit panneau, mais w5:p2 a été vu le premier.
  assert.equal(equipe.effective([p1, p2]).boss.id, 'w5:p2@bbbb');
  // Le carnet est sur le disque, dans le même dossier privé que la direction.
  const carnet = JSON.parse(await readFile(join(dossier, 'apparitions.json'), 'utf8'));
  assert.deepEqual(carnet, {
    'w5:p2@bbbb': '2026-10-17T12:00:00.000Z',
    'w5:p1@aaaa': '2026-10-17T12:01:00.000Z',
  });
  // Redémarrage : une nouvelle instance relit le carnet ; l'ordre est
  // conservé même si la liste arrive dans l'autre sens.
  const reprise = createDirection({ file, now });
  assert.equal(reprise.effective([p1, p2]).boss.id, 'w5:p2@bbbb');
});

test('direction : première apparition égale, le plus petit panneau gagne', async t => {
  const { dossier, file } = await montage(t);
  // Carnet préexistant : w5:p3 et w5:p1 vus exactement au même moment.
  await writeFile(join(dossier, 'apparitions.json'), JSON.stringify({
    'w5:p3@cccc': '2026-10-17T12:00:00.000Z',
    'w5:p1@aaaa': '2026-10-17T12:00:00.000Z',
  }), 'utf8');
  const equipe = createDirection({ file, now: () => Date.parse('2026-10-17T13:00:00Z') });
  const p3 = { id: 'w5:p3@cccc', paneId: 'w5:p3', name: 'Codex' };
  const p1 = { id: 'w5:p1@aaaa', paneId: 'w5:p1', name: 'Claude' };
  // La liste donne w5:p3 en premier : à date égale, le panneau départage.
  assert.equal(equipe.effective([p3, p1]).boss.id, 'w5:p1@aaaa');
});

test('direction : un agent disparu est oublié, son retour compte comme une nouvelle apparition', async t => {
  const { file } = await montage(t);
  let heure = Date.parse('2026-10-17T12:00:00Z');
  const now = () => heure;
  const p2 = { id: 'w5:p2@bbbb', paneId: 'w5:p2', name: 'Codex' };
  const p1 = { id: 'w5:p1@aaaa', paneId: 'w5:p1', name: 'Claude' };
  const equipe = createDirection({ file, now });
  assert.equal(equipe.effective([p2]).boss.id, 'w5:p2@bbbb');
  heure += 60_000;
  assert.equal(equipe.effective([p2, p1]).boss.id, 'w5:p2@bbbb');
  heure += 60_000;
  // w5:p2 disparaît : w5:p1 devient directeur et la date de w5:p2 est oubliée.
  assert.equal(equipe.effective([p1]).boss.id, 'w5:p1@aaaa');
  assert.deepEqual(equipe.apparitionsActuelles(), { 'w5:p1@aaaa': '2026-10-17T12:01:00.000Z' });
  heure += 60_000;
  // w5:p2 revient : nouvelle apparition, plus récente que celle de w5:p1,
  // qui reste donc directeur.
  assert.equal(equipe.effective([p2, p1]).boss.id, 'w5:p1@aaaa');
});
