import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHerdr } from '../src/herdr.mjs';

const SESSION = '12345678-1234-1234-1234-123456789abc';
const liste = agents => JSON.stringify({ id: 'x', result: { agents } });
const claude = (extra = {}) => ({ agent: 'claude', agent_status: 'working', pane_id: 'w1:p1', terminal_id: 't1', cwd: 'C:/x', ...extra });
const info = (pgid, pids = []) => JSON.stringify({ id: 'x', result: { process_info: { foreground_process_group_id: pgid, foreground_processes: pids.map(pid => ({ pid, argv: ['claude.exe'] })) } } });

async function dossierSessions(t, fichiers) {
  const d = await mkdtemp(join(tmpdir(), 'sessions-'));
  t.after(() => rm(d, { recursive: true, force: true }));
  for (const [nom, contenu] of Object.entries(fichiers)) await writeFile(join(d, nom), typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
  return d;
}

test('un Claude sans agent_session reçoit sa session exacte par le processus du panneau', async t => {
  const sessionsDir = await dossierSessions(t, { '4242.json': { pid: 4242, sessionId: SESSION, cwd: 'C:/x' } });
  const appels = [];
  const herdr = createHerdr({ sessionsDir, run: async args => { appels.push(args.join(' ')); return args[0] === 'agent' ? liste([claude()]) : info(4242); } });
  const [agent] = await herdr.list();
  assert.equal(agent.sessionId, SESSION);
  assert.ok(appels.includes('pane process-info --pane w1:p1'));
  // l'identifiant public de l'agent ne dépend pas de la session retrouvée
  const avant = agent.id;
  const herdr2 = createHerdr({ sessionsDir: join(sessionsDir, 'absent'), run: async args => (args[0] === 'agent' ? liste([claude()]) : info(4242)) });
  assert.equal((await herdr2.list())[0].id, avant);
});

test('pas de session : pid sans fichier, fichier d\'un autre pid, identifiant mal formé, information absente', async t => {
  const sessionsDir = await dossierSessions(t, {
    '1.json': { pid: 2, sessionId: SESSION },
    '3.json': { pid: 3, sessionId: '../../x' },
    '4.json': '{pas du json',
  });
  for (const pgid of [99, 1, 3, 4]) {
    const [agent] = await createHerdr({ sessionsDir, run: async a => (a[0] === 'agent' ? liste([claude()]) : info(pgid)) }).list();
    assert.equal(agent.sessionId, undefined, `pgid ${pgid}`);
  }
  const [sansInfo] = await createHerdr({ sessionsDir, run: async a => { if (a[0] === 'agent') return liste([claude()]); throw new Error('non pris en charge'); } }).list();
  assert.equal(sansInfo.sessionId, undefined);
});

test('une session déjà fournie par Herdr est gardée, les autres outils ne sont pas interrogés, le résultat est mis en cache 15 s', async t => {
  const sessionsDir = await dossierSessions(t, { '4242.json': { pid: 4242, sessionId: SESSION } });
  const appels = [];
  let horloge = 1000;
  const run = async args => {
    appels.push(args.join(' '));
    if (args[0] === 'agent') return liste([claude({ agent_session: { value: 'fourni-par-herdr' } }), { agent: 'codex', agent_status: 'idle', pane_id: 'w1:p2', terminal_id: 't2', cwd: 'C:/x' }]);
    return info(4242);
  };
  const herdr = createHerdr({ sessionsDir, run, now: () => horloge });
  const agents = await herdr.list();
  assert.equal(agents[0].sessionId, 'fourni-par-herdr');
  assert.ok(!appels.some(a => a.startsWith('pane process-info')));
  const run2 = async args => { appels.push(args.join(' ')); return args[0] === 'agent' ? liste([claude()]) : info(4242); };
  const h2 = createHerdr({ sessionsDir, run: run2, now: () => horloge });
  await h2.list(); await h2.list();
  assert.equal(appels.filter(a => a.startsWith('pane process-info')).length, 1);
  horloge += 16000;
  await h2.list();
  assert.equal(appels.filter(a => a.startsWith('pane process-info')).length, 2);
});

test('un client interactif qui garde une conversation de fond donne la session de fond (parkedJobId)', async t => {
  const FOND = 'aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb';
  const sessionsDir = await dossierSessions(t, {
    '100.json': { pid: 100, sessionId: SESSION, kind: 'interactive', parkedJobId: 'job42' },
    '200.json': { pid: 200, sessionId: FOND, kind: 'bg', jobId: 'job42' },
    '300.json': { pid: 300, sessionId: 'cccccccc-1111-2222-3333-dddddddddddd', kind: 'bg', jobId: 'autre' },
  });
  const [agent] = await createHerdr({ sessionsDir, run: async a => (a[0] === 'agent' ? liste([claude()]) : info(100)) }).list();
  assert.equal(agent.sessionId, FOND);
  const seul = await dossierSessions(t, { '100.json': { pid: 100, sessionId: SESSION, parkedJobId: 'introuvable' } });
  const [sans] = await createHerdr({ sessionsDir: seul, run: async a => (a[0] === 'agent' ? liste([claude()]) : info(100)) }).list();
  assert.equal(sans.sessionId, SESSION);
});
