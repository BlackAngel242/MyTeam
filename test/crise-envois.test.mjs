// Verrou de crise pendant la requête : la crise est revérifiée après la
// lecture du corps et juste avant chaque appel à Herdr (constat C-CD-02).
// Le gestionnaire est appelé directement, sans ouvrir de port, avec un flux
// de corps suspendu que le test contrôle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCrise} from '../src/crisis.mjs';
import {createBureauServer} from '../server.mjs';

const PORT = 4317;
const ORIGINE = `http://127.0.0.1:${PORT}`;
const ERREUR = 'Salle de crise active : les envois sont verrouillés. Levez la crise pour reprendre.';

function reponse() {
  return {
    statusCode: null,
    corps: '',
    writeHead(status) { this.statusCode = status; },
    end(corps = '') { this.corps = corps; },
    data() { try { return JSON.parse(this.corps); } catch { return this.corps; } },
  };
}

function requete({method, url, headers, corps = null, suspendu = false}) {
  const req = {method, url, headers};
  req[Symbol.asyncIterator] = async function* () {
    if (corps === null) return;
    if (suspendu) await new Promise(resolve => { req.liberer = resolve; });
    yield Buffer.from(corps, 'utf8');
  };
  return req;
}

async function bureau(t) {
  const calls = [];
  const agents = [
    {id: 'agent-1', name: 'Claude', kind: 'Claude', status: 'idle', ready: true},
    {id: 'agent-2', name: 'Codex', kind: 'Claude', status: 'idle', ready: true},
  ];
  let surEnvoi = null;
  const bridge = {
    list: async () => agents,
    read: async () => ({text: ''}),
    prompt: async (id, message) => { calls.push({id, message}); return {ok: true, message: 'Consigne transmise à Herdr.'}; },
    broadcast: async (ids, message) => {
      calls.push({ids, message});
      if (surEnvoi) await surEnvoi(ids);
      return {results: ids.map(id => ({id, name: agents.find(a => a.id === id)?.name ?? '', ok: true, message: 'Consigne transmise à Herdr.'}))};
    },
    interrupt: async () => ({requested: true, agent: 'Claude'}),
  };
  const dossier = await mkdtemp(join(tmpdir(), 'envois-crise-'));
  t.after(() => rm(dossier, {recursive: true, force: true}));
  const criseFile = join(dossier, 'crise.json');
  const crise = createCrise({file: criseFile});
  const server = createBureauServer({
    bridge,
    crise,
    criseFile,
    queueFile: join(dossier, 'file-attente.json'),
    directionFile: join(dossier, 'direction.json'),
  });
  // Aucun port ouvert : le gestionnaire est appelé à la main.
  server.address = () => ({port: PORT, family: 'IPv4', address: '127.0.0.1'});
  const handler = server.listeners('request')[0];
  const etat = reponse();
  await handler(requete({method: 'GET', url: '/api/state', headers: {host: `127.0.0.1:${PORT}`}}), etat);
  assert.equal(etat.statusCode, 200, 'jeton de session récupéré sans port ouvert');
  const token = etat.data().token;
  const headers = {
    host: `127.0.0.1:${PORT}`,
    origin: ORIGINE,
    'content-type': 'application/json',
    'x-bureau-token': token,
  };
  const lancer = ({url, corps, suspendu = false}) => {
    const req = requete({method: 'POST', url, headers, corps, suspendu});
    const res = reponse();
    return {promesse: handler(req, res), req, res};
  };
  return {crise, calls, headers, lancer, pourEnvoi(callback) { surEnvoi = callback; }};
}

test('crise : une crise déclenchée pendant la lecture du corps refuse l’envoi, aucun appel Herdr', async t => {
  const {crise, calls, lancer} = await bureau(t);
  assert.equal(crise.isActive(), false, 'crise inactive au départ : le contrôle initial passe');
  const {promesse, req, res} = lancer({url: '/api/prompt', corps: JSON.stringify({id: 'agent-1', message: 'Bonjour'}), suspendu: true});
  await new Promise(resolve => setImmediate(resolve));
  await crise.set(true);            // la crise s'active pendant la lecture du corps
  req.liberer();
  await promesse;
  assert.equal(res.statusCode, 423);
  assert.equal(res.data().error, ERREUR);
  assert.deepEqual(calls, [], 'aucun appel sur le pont Herdr');
});

test('crise : le même contrôle s’applique à l’envoi groupé', async t => {
  const {crise, calls, lancer} = await bureau(t);
  const {promesse, req, res} = lancer({url: '/api/broadcast', corps: JSON.stringify({ids: ['agent-1', 'agent-2'], message: 'Bonjour'}), suspendu: true});
  await new Promise(resolve => setImmediate(resolve));
  await crise.set(true);
  req.liberer();
  await promesse;
  assert.equal(res.statusCode, 423);
  assert.equal(res.data().error, ERREUR);
  assert.deepEqual(calls, [], 'aucun destinataire n’est touché');
});

test('crise : activée entre deux destinataires, le suivant n’est pas envoyé', async t => {
  const {crise, calls, pourEnvoi, lancer} = await bureau(t);
  // La crise s'active à la fin du premier envoi, avant le second.
  pourEnvoi(async ids => { if (ids.includes('agent-1')) await crise.set(true); });
  const {promesse, res} = lancer({url: '/api/broadcast', corps: JSON.stringify({ids: ['agent-1', 'agent-2'], message: 'Bonjour'})});
  await promesse;
  assert.equal(res.statusCode, 423);
  assert.equal(res.data().error, ERREUR);
  assert.deepEqual(calls.map(c => c.ids), [['agent-1']], 'le second destinataire n’est pas appelé');
  assert.equal(crise.isActive(), true);
  // Le premier envoi réel est bien renvoyé : rien n’est caché.
  assert.equal(res.data().results.length, 1);
  assert.equal(res.data().results[0].id, 'agent-1');
});
