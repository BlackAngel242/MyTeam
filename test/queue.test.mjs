import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createQueue, QueueError } from '../src/queue.mjs';

async function montage(t, { agents = [
  { id: 'w5:p4@fp', name: 'Codex', status: 'idle', ready: true },
  { id: 'a', name: 'A', status: 'idle', ready: true },
  { id: 'b', name: 'B', status: 'idle', ready: true },
], limiteParAgent = () => ({ limitReached: false, resetsAt: null }), echec = null } = {}) {
  const dossier = await mkdtemp(join(tmpdir(), 'queue-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  const file = join(dossier, 'file-attente.json');
  const envois = [];
  const horloge = { ms: Date.parse('2026-10-17T10:00:00.000Z') };
  const queue = createQueue({
    listAgents: async () => agents,
    prompt: async (id, message) => {
      if (echec) throw new Error(echec);
      envois.push({ id, message });
      return { ok: true };
    },
    limitsOf: async id => limiteParAgent(id),
    file,
    now: () => horloge.ms,
  });
  return { queue, file, envois, horloge, dossier };
}

test('file : enqueue accepte le valide et refuse les entrées invalides', async t => {
  const { queue } = await montage(t);
  const element = await queue.enqueue({ id: 'w5:p4@fp', message: 'Vérifier les calculs' });
  assert.equal(element.state, 'attente');
  assert.equal(element.notBefore, null);
  assert.ok(element.itemId.startsWith('q-'));
  assert.equal(element.createdAt, '2026-10-17T10:00:00.000Z');
  await assert.rejects(() => queue.enqueue({ id: '', message: 'x' }), QueueError);
  await assert.rejects(() => queue.enqueue({ id: 'a', message: '' }), QueueError);
  await assert.rejects(() => queue.enqueue({ id: 'a', message: 'x'.repeat(12001) }), QueueError);
  await assert.rejects(() => queue.enqueue({ id: 'a', message: 'a\0b' }), QueueError);
  await assert.rejects(() => queue.enqueue({ id: 'a', message: 'ok', notBefore: 'pas-une-date' }), QueueError);
  assert.equal(queue.list().items.length, 1);
});

test('file : plafond de 5 en attente par agent, doublon refusé, plafond de 20 au total', async t => {
  const { queue } = await montage(t);
  for (let i = 0; i < 5; i++) await queue.enqueue({ id: 'a', message: `Consigne ${i}` });
  await assert.rejects(() => queue.enqueue({ id: 'a', message: 'Consigne 5' }), /5 consignes en attente/);
  await assert.rejects(() => queue.enqueue({ id: 'a', message: 'Consigne 0' }), /déjà en file/);
  for (let g = 1; g < 4; g++) for (let i = 0; i < 5; i++) await queue.enqueue({ id: `g${g}`, message: `Message ${g}-${i}` });
  await assert.rejects(() => queue.enqueue({ id: 'z', message: 'trop' }), /pleine/);
  const premier = queue.list().items[0];
  await queue.cancel(premier.itemId);
  const ajoute = await queue.enqueue({ id: 'z', message: 'maintenant' });
  assert.equal(ajoute.state, 'attente');
  assert.equal(queue.list().items.length, 20);
});

test('file : tick envoie au plus une consigne à la fois par agent', async t => {
  const { queue, envois } = await montage(t);
  await queue.enqueue({ id: 'a', message: 'Première' });
  await queue.enqueue({ id: 'a', message: 'Deuxième' });
  await queue.enqueue({ id: 'b', message: 'Troisième' });
  const tour = await queue.tick();
  assert.deepEqual(envois.map(e => e.message), ['Première', 'Troisième']);
  assert.equal(tour.sent.length, 2);
  assert.equal(queue.list().items.filter(item => item.state === 'envoyee').length, 2);
  assert.ok(queue.list().items.filter(item => item.state === 'envoyee').every(item => item.sentAt === '2026-10-17T10:00:00.000Z'));
  await queue.tick();
  assert.deepEqual(envois.map(e => e.message), ['Première', 'Troisième', 'Deuxième']);
});

test('file : jamais d\'envoi vers un agent au travail, bloqué ou inconnu', async t => {
  const agents = [
    { id: 'travail', status: 'working', ready: false },
    { id: 'bloque', status: 'blocked', ready: false },
    { id: 'inconnu', status: 'unknown', ready: false },
    { id: 'pret', status: 'idle', ready: true },
    { id: 'fini', status: 'done', ready: true },
  ];
  const { queue, envois } = await montage(t, { agents });
  for (const id of ['travail', 'bloque', 'inconnu', 'pret', 'fini']) await queue.enqueue({ id, message: `Pour ${id}` });
  await queue.tick();
  assert.deepEqual(envois.map(e => e.id), ['pret', 'fini']);
  assert.equal(queue.list().items.filter(item => item.state === 'attente').length, 3);
});

test('file : notBefore est respectée, puis l\'envoi a lieu', async t => {
  const { queue, envois, horloge } = await montage(t);
  await queue.enqueue({ id: 'a', message: 'Plus tard', notBefore: '2026-10-17T12:00:00.000Z' });
  await queue.tick();
  assert.deepEqual(envois, []);
  horloge.ms = Date.parse('2026-10-17T11:59:00.000Z');
  await queue.tick();
  assert.deepEqual(envois, []);
  horloge.ms = Date.parse('2026-10-17T12:00:00.000Z');
  await queue.tick();
  assert.deepEqual(envois.map(e => e.message), ['Plus tard']);
  assert.equal(queue.list().items[0].notBefore, '2026-10-17T12:00:00.000Z');
});

test('file : pause de quota jusqu\'à la remise à zéro + 5 minutes', async t => {
  const resetsAt = '2026-10-17T11:00:00.000Z';
  const { queue, envois, horloge } = await montage(t, { limiteParAgent: () => ({ limitReached: true, resetsAt }) });
  await queue.enqueue({ id: 'w5:p4@fp', message: 'Après la pause' });
  await queue.tick();
  assert.deepEqual(envois, []);
  horloge.ms = Date.parse('2026-10-17T11:04:59.000Z');
  await queue.tick();
  assert.deepEqual(envois, [], 'les 5 minutes ne sont pas écoulées');
  horloge.ms = Date.parse('2026-10-17T11:05:01.000Z');
  await queue.tick();
  assert.deepEqual(envois.map(e => e.message), ['Après la pause']);
});

test('file : pause de quota sans date de remise à zéro n\'est jamais forcée', async t => {
  const { queue, envois, horloge } = await montage(t, { limiteParAgent: () => ({ limitReached: true, resetsAt: null }) });
  await queue.enqueue({ id: 'w5:p4@fp', message: 'Ne partira pas' });
  horloge.ms = Date.parse('2026-10-18T10:00:00.000Z');
  await queue.tick();
  assert.deepEqual(envois, []);
  assert.equal(queue.list().items[0].state, 'attente');
});

test('file : envoi non confirmé passe « à revoir » sans jamais être renvoyé', async t => {
  const longue = 'L\'envoi n\'a pas été confirmé. ' + 'x'.repeat(300);
  const { queue, envois } = await montage(t, { echec: longue });
  await queue.enqueue({ id: 'w5:p4@fp', message: 'Risque' });
  await queue.tick();
  await queue.tick();
  await queue.tick();
  assert.deepEqual(envois, [], 'aucun renvoi automatique');
  const element = queue.list().items[0];
  assert.equal(element.state, 'a_revoir');
  assert.equal(element.reason.length, 200, 'la raison est tronquée');
});

test('file : une cible disparue passe « à revoir » sans envoi', async t => {
  const agents = [{ id: 'a@fp', status: 'idle', ready: true }];
  const { queue, envois } = await montage(t, { agents });
  await queue.enqueue({ id: 'a@fp', message: 'Pour un agent remplacé' });
  agents.length = 0;
  await queue.tick();
  assert.deepEqual(envois, []);
  const element = queue.list().items[0];
  assert.equal(element.state, 'a_revoir');
  assert.match(element.reason, /cible a changé/i);
});

test('file : cancel annule une attente et refuse le reste', async t => {
  const { queue } = await montage(t);
  const element = await queue.enqueue({ id: 'a', message: 'À annuler' });
  const annule = await queue.cancel(element.itemId);
  assert.equal(annule.state, 'annulee');
  await assert.rejects(() => queue.cancel(element.itemId), QueueError);
  await assert.rejects(() => queue.cancel('inconnu'), QueueError);
});

test('file : persistance, rechargement et JSON corrompu sans donnée privée', async t => {
  const { queue, file, dossier } = await montage(t);
  await queue.enqueue({ id: 'a', message: 'À garder' });
  const brut = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(brut.version, 1);
  assert.equal(brut.items.length, 1);
  assert.equal(brut.items[0].message, 'À garder');
  assert.ok(!JSON.stringify(brut).includes(dossier), 'aucun chemin dans le fichier');
  const reprise = createQueue({ listAgents: async () => [], prompt: async () => ({ ok: true }), file, now: () => 0 });
  assert.equal(reprise.list().items[0].message, 'À garder');
  await writeFile(file, '{cassé', 'utf8');
  const vide = createQueue({ listAgents: async () => [], prompt: async () => ({ ok: true }), file, now: () => 0 });
  assert.deepEqual(vide.list().items, []);
});

test('file : deux tick() simultanés n\'envoient pas deux fois', async t => {
  const { queue, envois } = await montage(t);
  await queue.enqueue({ id: 'a', message: 'Une seule fois' });
  await Promise.all([queue.tick(), queue.tick()]);
  assert.equal(envois.length, 1);
  assert.equal(queue.list().items[0].state, 'envoyee');
});
