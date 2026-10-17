import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createQueue } from '../src/queue.mjs';
import { createBureauServer } from '../server.mjs';

// Reproductions de revue : les assertions décrivent le comportement sûr attendu.
// Aucun Herdr réel, aucun serveur écoutant, aucune minuterie.
async function montage(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'bureau-revue-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'file-attente.json');
  const agents = [{ id: 'p1@empreinte', kind: 'Codex', status: 'idle', ready: true }];
  const envois = [];
  const config = {
    file, listAgents: async () => agents,
    prompt: async (id, message) => { envois.push({ id, message }); return { ok: true }; },
    now: () => Date.parse('2026-10-17T12:00:00Z'), ...options,
  };
  return { file, agents, envois, config, queue: createQueue(config) };
}

test('revue : une reprise pendant un envoi incertain ne renvoie pas la consigne', async t => {
  let signaler, terminer;
  const debut = new Promise(resolve => { signaler = resolve; });
  const attente = new Promise(resolve => { terminer = resolve; });
  let appels = 0;
  const { queue, config } = await montage(t, {
    prompt: async () => { appels++; signaler(); await attente; return { ok: true }; },
  });
  await queue.enqueue({ id: 'p1@empreinte', message: 'Consigne factice' });
  const premierTour = queue.tick();
  await debut;
  try {
    // Nouvelle instance lisant exactement l'état disque disponible au moment du crash.
    const reprise = createQueue({ ...config, prompt: async () => { appels++; return { ok: true }; } });
    await reprise.tick();
    assert.equal(appels, 1, 'un état durable doit empêcher le second envoi');
  } finally { terminer(); await premierTour; }
});

test('revue : une nouvelle tentative HTTP après réponse perdue ne crée pas un second envoi', async t => {
  const { queue, envois } = await montage(t);
  const demande = { id: 'p1@empreinte', message: 'Une opération unique' };
  await queue.enqueue(demande);
  await queue.tick();
  // Le premier onglet ne reçoit pas la réponse ; sa tentative arrive après le tour.
  try { await queue.enqueue(demande); } catch { /* Refus de doublon acceptable. */ }
  await queue.tick();
  assert.equal(envois.length, 1);
});

test('revue : le raccordement serveur respecte le quota et ne plante pas', async t => {
  const { file, agents, envois } = await montage(t);
  let lectures = 0;
  const server = createBureauServer({
    queueFile: file, now: () => Date.parse('2026-10-17T12:00:00Z'),
    bridge: { list: async () => agents, prompt: async (...args) => { envois.push(args); } },
    readOtherActivity: async () => {
      lectures++;
      return { limitReached: true, limits: [{ usedPercent: 100, resetsAt: '2026-10-17T13:00:00Z' }] };
    },
  });
  await server.queue.enqueue({ id: agents[0].id, message: 'Attendre le quota' });
  await assert.doesNotReject(() => server.queue.tick());
  assert.equal(envois.length, 0);
  assert.equal(lectures, 1);
});

test('revue : le délai de cinq minutes reste valable après disparition du signal quota', async t => {
  let maintenant = Date.parse('2026-10-17T12:00:00Z');
  let atteint = true;
  const { queue, envois } = await montage(t, {
    now: () => maintenant,
    limitsOf: async () => ({ limitReached: atteint, resetsAt: '2026-10-17T13:00:00Z' }),
  });
  await queue.enqueue({ id: 'p1@empreinte', message: 'Après cinq minutes' });
  await queue.tick();
  atteint = false;
  maintenant = Date.parse('2026-10-17T13:01:00Z');
  await queue.tick();
  assert.equal(envois.length, 0, 'la pause connue doit durer jusqu’à 13 h 05');
});

test('revue : une lecture de quota en panne ne permet pas l’envoi automatique', async t => {
  const { queue, envois } = await montage(t, { limitsOf: async () => { throw new Error('Journal indisponible'); } });
  await queue.enqueue({ id: 'p1@empreinte', message: 'Pas sans contrôle' });
  await queue.tick();
  assert.equal(envois.length, 0);
});

test('revue : une date corrompue restaurée ne déclenche pas un départ immédiat', async t => {
  const { file, config, envois } = await montage(t);
  await writeFile(file, JSON.stringify({ version: 1, items: [{
    itemId: 'q-factice', id: 'p1@empreinte', message: 'Plus tard', state: 'attente',
    createdAt: '2026-10-17T11:59:00Z', notBefore: 'date-corrompue',
  }] }));
  await createQueue(config).tick();
  assert.equal(envois.length, 0);
});

test('revue : une annulation ne peut pas réussir après le début de l’envoi', async t => {
  let signaler, terminer;
  const debut = new Promise(resolve => { signaler = resolve; });
  const attente = new Promise(resolve => { terminer = resolve; });
  const { queue } = await montage(t, { prompt: async () => { signaler(); await attente; return { ok: true }; } });
  const item = await queue.enqueue({ id: 'p1@empreinte', message: 'Déjà en cours' });
  const tour = queue.tick();
  await debut;
  try { await assert.rejects(() => queue.cancel(item.itemId)); }
  finally { terminer(); await tour; }
});

test('revue : deux tours simultanés partagent un seul envoi', async t => {
  const { queue, envois } = await montage(t);
  await queue.enqueue({ id: 'p1@empreinte', message: 'Un seul tour' });
  await Promise.all([queue.tick(), queue.tick()]);
  assert.equal(envois.length, 1);
});

test('revue : occupé, bloqué, inconnu et cible remplacée restent sans envoi', async t => {
  const { queue, agents, envois } = await montage(t);
  await queue.enqueue({ id: 'p1@empreinte', message: 'Attendre la bonne cible' });
  for (const status of ['working', 'blocked', 'unknown']) {
    agents[0].status = status;
    await queue.tick();
  }
  agents[0] = { ...agents[0], id: 'p1@autre-empreinte', status: 'idle', ready: true };
  await queue.tick();
  assert.equal(envois.length, 0);
  assert.equal(queue.list().items[0].state, 'a_revoir');
});
