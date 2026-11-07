import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBureauServer } from '../server.mjs';
import { createTerminalStatusReader } from '../src/terminal-status.mjs';
import { choisirSuppleant, messageRelais, messageRetour, derniereMission, relaisActif } from '../src/relais-quota.mjs';

const agent = (paneId, kind, extra = {}) => ({ id: `${paneId}@x`, paneId, name: kind, kind, status: 'idle', ready: true, cwd: 'C:/projet', ...extra });

test('suppléant : même projet, prêt, pas en pause, jamais le chef, un autre outil d\'abord', () => {
  const codex = agent('w1:p1', 'Codex', { status: 'working', ready: false });
  const codex2 = agent('w1:p2', 'Codex');
  const omp = agent('w1:p3', 'OMP');
  const chef = agent('w1:p4', 'Claude');
  const ailleurs = agent('w1:p5', 'Gemini', { cwd: 'C:/autre' });
  const occupe = agent('w1:p6', 'Kimi', { status: 'working', ready: false });
  const liste = [codex, codex2, omp, chef, ailleurs, occupe];
  assert.equal(choisirSuppleant(codex, liste, { chefId: chef.id }).id, omp.id, 'un autre outil passe avant un second Codex');
  assert.equal(choisirSuppleant(codex, liste, { chefId: chef.id, enPause: id => id === omp.id }).id, codex2.id);
  assert.equal(choisirSuppleant(codex, [codex, chef, ailleurs, occupe], { chefId: chef.id }), null, 'aucun suppléant : pas de relais');
});

test('consignes : relais avec écran à lire et mission connue, retour qui interdit de reprendre', () => {
  const source = agent('w1:p1', 'Codex', { name: 'dev' });
  const m = messageRelais({ source, retour: '2026-11-07T05:42:00.000Z', mission: 'Implémenter L1.' });
  assert.match(m, /dev \(Codex\) est en pause de quota jusqu'à \d\d:\d\d/);
  assert.match(m, /herdr agent read w1:p1 --source recent-unwrapped --lines 200/);
  assert.match(m, /ne refais rien de déjà commité/);
  assert.match(m, /« Implémenter L1\. »/);
  assert.doesNotMatch(messageRelais({ source }), /dernière consigne/, 'mission inconnue : seulement l\'écran à lire');
  assert.match(messageRetour({ heure: '05:42', suppleant: 'OMP' }), /confiée à OMP : ne la reprends pas/);
  assert.equal(relaisActif({ BUREAU_RELAIS_QUOTA: '0' }), false);
  assert.equal(relaisActif({}), true);
});

test('dernière mission : la consigne la plus récente envoyée à cet agent dans les 12 dernières heures', () => {
  const now = Date.parse('2026-11-07T05:00:00Z');
  const items = [
    { id: 'a', state: 'envoyee', sentAt: '2026-11-07T04:00:00Z', message: 'récente' },
    { id: 'a', state: 'envoyee', sentAt: '2026-11-07T03:00:00Z', message: 'ancienne' },
    { id: 'a', state: 'attente', sentAt: null, message: 'pas envoyée' },
    { id: 'b', state: 'envoyee', sentAt: '2026-11-07T04:30:00Z', message: 'autre agent' },
    { id: 'a', state: 'envoyee', sentAt: '2026-11-06T10:00:00Z', message: 'trop vieille' },
  ];
  assert.equal(derniereMission(items, 'a', { now }), 'récente');
  assert.equal(derniereMission(items, 'c', { now }), null);
});

test('serveur : un agent qui atteint sa limite voit sa mission confiée une fois à un suppléant, puis il est prévenu à son retour', async t => {
  const dossier = await mkdtemp(join(tmpdir(), 'relais-quota-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  let heure = Date.parse('2026-11-07T05:00:00.000Z');
  const agents = [agent('w1:p1', 'Codex', { name: 'dev', status: 'working', ready: false }), agent('w1:p2', 'OMP', { name: 'critique' })];
  let ecran = "■ You've hit your usage limit. Upgrade to Pro or try again at 5:42 AM.";
  const bridge = { list: async () => agents.map(a => ({ ...a })), prompt: async () => ({}), read: async () => '', broadcast: async () => ({}) };
  const serveur = createBureauServer({
    bridge, now: () => heure,
    lireEtat: createTerminalStatusReader({ now: () => heure, run: async panneau => (panneau === 'w1:p1' ? ecran : 'Prêt.\n') }),
    readOtherActivity: async () => null, getBlackboard: async () => ({}), delegations: async () => [],
    queueFile: join(dossier, 'file.json'), criseFile: join(dossier, 'crise.json'), directionFile: join(dossier, 'direction.json'),
    piedFile: join(dossier, 'pied.json'),
  });
  t.after(() => serveur.pauses.stop());

  await serveur.pauses.tick();
  let file = serveur.queue.list().items;
  const relais = file.filter(e => e.id === 'w1:p2@x');
  assert.equal(relais.length, 1, 'une consigne de relais pour le suppléant');
  assert.match(relais[0].message, /dev \(Codex\) est en pause de quota/);
  assert.equal(relais[0].priority, 'haute');

  await serveur.pauses.tick();
  assert.equal(serveur.queue.list().items.filter(e => e.id === 'w1:p2@x').length, 1, 'jamais deux relais pour la même pause');

  // La limite est levée : dev revient, et sa consigne de reprise lui dit de ne pas reprendre la mission confiée.
  // « 5:42 AM » est relu dans le fuseau local et peut désigner le lendemain : on part de l'heure réellement retenue.
  const retenue = Date.parse(serveur.pauses.etatDe('w1:p1@x').resetsAt);
  ecran = 'Prêt.\n';
  agents[0].status = 'idle'; agents[0].ready = true;
  heure = retenue + 61000;
  await serveur.pauses.tick();
  await serveur.pauses.tick();
  file = serveur.queue.list().items;
  const retour = file.filter(e => e.id === 'w1:p1@x');
  assert.equal(retour.length, 1);
  assert.match(retour[0].message, /confiée à critique : ne la reprends pas/);
});
