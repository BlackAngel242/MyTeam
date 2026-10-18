// Récapitulatif Markdown de fin d'autonomie (N3), 18 octobre 2026.
//
// Règle du projet : le récapitulatif ne contient QUE des faits présents dans le
// journal de src/autonomie.mjs. Jamais le contenu d'une réponse d'agent, jamais
// un chemin. L'objectif passe par masque(). Vide si aucun mode n'a tourné.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { recapAutonomie } from '../src/autonomie-recap.mjs';
import { createBureauServer } from '../server.mjs';

const at = heure => `2026-10-18T${heure}:00.000Z`;

// Un mode complet : lancement, deux fins d'agent prévenues, arrêt.
const modeFait = {
  actif: false,
  objectif: null,
  debut: null,
  finAt: null,
  echanges: 0,
  maxEchanges: 0,
  arret: 'durée écoulée',
  journal: [
    { at: at('10:00'), type: 'debut', texte: 'Autonomie lancée : « Réparer le module de facturation », 30 min, 20 échanges au plus.' },
    { at: at('10:05'), type: 'message', texte: 'Claude a terminé : le chef est prévenu (échange 1/20).' },
    { at: at('10:12'), type: 'message', texte: 'Codex a terminé : le chef est prévenu (échange 2/20).' },
    { at: at('10:30'), type: 'arret', texte: 'Autonomie arrêtée : durée écoulée.' },
  ],
};

test('le récapitulatif porte les faits du journal', () => {
  const md = recapAutonomie(modeFait);
  assert.match(md, /Réparer le module de facturation/, 'objectif présent');
  assert.match(md, /2026-10-18T10:00/, 'début présent');
  assert.match(md, /2026-10-18T10:30/, 'fin présente');
  assert.match(md, /durée écoulée/, 'motif d\'arrêt présent');
  assert.match(md, /2/, 'nombre d\'échanges présent');
  assert.match(md, /2026-10-18T10:05/, 'première fin horodatée');
  assert.match(md, /2026-10-18T10:12/, 'seconde fin horodatée');
});

test('la liste des fins d\'agents est horodatée et nommée', () => {
  const md = recapAutonomie(modeFait);
  assert.match(md, /10:05[\s\S]*Claude/, 'Claude et son horodatage');
  assert.match(md, /10:12[\s\S]*Codex/, 'Codex et son horodatage');
});

test('aucun chemin ni secret ne sort par le récapitulatif', () => {
  const md = recapAutonomie({
    ...modeFait,
    journal: [
      { at: at('10:00'), type: 'debut', texte: 'Autonomie lancée : « Lire C:/Users/Personne/Projet Prive/client.txt avec token=abcdef123456 », 30 min, 20 échanges au plus.' },
      { at: at('10:30'), type: 'arret', texte: 'Autonomie arrêtée : durée écoulée.' },
    ],
  });
  assert.ok(!/Projet Prive/.test(md), 'le chemin privé est masqué');
  assert.ok(!/client\.txt/.test(md), 'la fin du chemin est masquée');
  assert.ok(!/abcdef123456/.test(md), 'le secret est masqué');
});

test('une adresse web reste lisible dans le récapitulatif', () => {
  const md = recapAutonomie({
    ...modeFait,
    journal: [{ at: at('10:00'), type: 'debut', texte: 'Autonomie lancée : « Voir https://exemple.test/a et /api/todos », 30 min, 20 échanges au plus.' }],
  });
  assert.match(md, /https:\/\/exemple\.test\/a/, 'l\'adresse web est conservée');
  assert.match(md, /\/api\/todos/, 'la route du bureau est conservée');
});

test('le récapitulatif est vide si aucun mode n\'a tourné', () => {
  assert.equal(recapAutonomie({ actif: false, objectif: null, debut: null, finAt: null, echanges: 0, maxEchanges: 0, arret: null, journal: [] }), '');
  assert.equal(recapAutonomie({ actif: false, journal: [] }), '');
  assert.equal(recapAutonomie({}), '');
});

test('aucun contenu de réponse d\'agent ne figure dans le récapitulatif', () => {
  const md = recapAutonomie(modeFait);
  assert.ok(!/le chef est prévenu/.test(md), 'la phrase du journal n\'est pas recopiée telle quelle');
  assert.ok(!/objectif :/.test(md) || !/réponse/i.test(md), 'aucune réponse d\'agent citée');
});

test('un mode encore en cours n\'invente ni fin ni motif d\'arrêt', () => {
  const md = recapAutonomie({
    actif: true, objectif: 'Réparer le module', debut: at('10:00'), finAt: at('10:30'),
    echanges: 1, maxEchanges: 20, arret: null,
    journal: [
      { at: at('10:00'), type: 'debut', texte: 'Autonomie lancée : « Réparer le module », 30 min, 20 échanges au plus.' },
      { at: at('10:05'), type: 'message', texte: 'Claude a terminé : le chef est prévenu (échange 1/20).' },
    ],
  });
  assert.match(md, /en cours/, 'l\'arrêt non observé est dit tel quel');
  assert.ok(!/Motif d/.test(md), 'aucun motif d\'arrêt inventé');
});

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
async function bureauAvecAutonomie(t, autonomie) {
  const bridge = {
    list: async () => [{ id: 'w5:p1@abcd1234abcd1230', name: 'Claude', kind: 'Claude', status: 'idle', ready: true }],
    read: async () => ({ id: 'w5:p1@abcd1234abcd1230', text: '' }),
    prompt: async () => ({ sent: true }),
    broadcast: async () => ({ results: [] }),
  };
  const server = createBureauServer({ bridge, autonomie });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const send = (path, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method, headers: { Host: `127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin', ...headers } }, res => {
      let texte = '';
      res.setEncoding('utf8');
      res.on('data', chunk => texte += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: texte }));
    });
    req.on('error', reject);
    req.end(body);
  });
  const etat = await send('/api/state');
  const jeton = JSON.parse(etat.body).token;
  return { send, jeton };
}

const fauxAutonomie = journal => ({
  get: () => ({ actif: false, objectif: null, debut: null, finAt: null, echanges: 0, maxEchanges: 0, arret: 'durée écoulée', journal }),
  demarrer: async () => ({}), arreter: async () => ({}), passer: async item => item, verifier: async () => {},
});

test('GET /api/autonomie/recap exige le jeton et l\'origine', async t => {
  const { send } = await bureauAvecAutonomie(t, fauxAutonomie(modeFait.journal));
  assert.equal((await send('/api/autonomie/recap', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
});

test('GET /api/autonomie/recap renvoie du Markdown', async t => {
  const { send, jeton } = await bureauAvecAutonomie(t, fauxAutonomie(modeFait.journal));
  const { status, headers, body } = await send('/api/autonomie/recap', { headers: { 'X-Bureau-Token': jeton } });
  assert.equal(status, 200);
  assert.match(headers['content-type'] ?? '', /text\/markdown/);
  assert.match(body, /#/, 'du Markdown, pas du JSON');
  assert.match(body, /Réparer le module de facturation/);
});

test('GET /api/autonomie/recap est vide sans mode passé', async t => {
  const { send, jeton } = await bureauAvecAutonomie(t, fauxAutonomie([]));
  const { status, body } = await send('/api/autonomie/recap', { headers: { 'X-Bureau-Token': jeton } });
  assert.equal(status, 200);
  assert.equal(body, '', 'aucun mode tourné : rien à raconter');
});
