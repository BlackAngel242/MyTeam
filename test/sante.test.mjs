// Santé du bureau (N7) : tests d'abord, dont la confidentialité de la réponse.
//
// La route GET /api/sante raconte l'état du poste sans jamais dire où il
// travaille : aucun chemin, aucune clé, aucun objectif, aucun message. Elle
// observe seulement : aucun redémarrage n'est possible par cette route.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { createBureauServer } from '../server.mjs';
import { createSante } from '../src/sante.mjs';

// Serveur isolé : pont Herdr factice, lecteurs factices, fichiers temporaires.
// Rien ne lit le home du poste ni le .bureau/ du projet.
async function fixture(t, { bridge } = {}) {
  const racine = await mkdtemp(join(tmpdir(), 'sante-'));
  await Promise.all(['claude', 'codex', 'opencode', 'agents', 'pieces'].map(n => mkdir(join(racine, n), { recursive: true })));
  t.after(() => rm(racine, { recursive: true, force: true }));
  const pont = bridge ?? {
    async list() {
      return [
        { id: 'w5:p1@aaa', paneId: 'w5:p1', name: 'Chef', kind: 'Claude', status: 'idle', ready: true, cwd: join(racine, 'agents') },
      ];
    },
    async prompt() { return { ok: true, message: 'Consigne transmise à Herdr.' }; },
    async read() { return { id: 'w5:p1@aaa', text: 'Prêt.' }; },
    async broadcast() { return { results: [] }; },
    async interrupt() { return { requested: true, id: 'w5:p1@aaa' }; },
  };
  const server = createBureauServer({
    bridge: pont,
    readActivity: async () => ({ found: false }),
    readOtherActivity: async () => null,
    getResponses: async () => ({ found: false, complete: false, responses: [] }),
    getOtherResponses: async () => ({ found: false, complete: false, responses: [] }),
    getTodos: async () => ({ files: [] }),
    delegations: async () => ({ found: false, delegations: [] }),
    queueFile: join(racine, 'file-attente.json'),
    criseFile: join(racine, 'crise.json'),
    directionFile: join(racine, 'direction.json'),
    piedFile: join(racine, 'pied.json'),
    getPlaces: () => ({ documents: { path: join(racine, 'pieces') } }),
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origine = `http://127.0.0.1:${server.address().port}`;
  const etat = await (await fetch(`${origine}/api/state`, { headers: { Origin: origine } })).json();
  const appel = async (chemin, { methode = 'GET', corps, jeton = etat.token } = {}) => {
    const reponse = await fetch(origine + chemin, {
      method: methode,
      headers: {
        Origin: origine,
        ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(jeton ? { 'X-Bureau-Token': jeton } : {}),
      },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });
    const texte = await reponse.text();
    let data = texte;
    try { data = JSON.parse(texte); } catch { /* texte brut */ }
    return { status: reponse.status, data, texte };
  };
  return { racine, origine, appel, jeton: etat.token, serveur: server };
}

test('N7 santé : le jeton est exigé', async t => {
  const b = await fixture(t);
  const refuse = await b.appel('/api/sante', { jeton: '' });
  assert.equal(refuse.status, 403, refuse.status === 403 ? '' : refuse.texte);
  const accepte = await b.appel('/api/sante');
  assert.equal(accepte.status, 200, accepte.status === 200 ? '' : accepte.texte);
});

test('N7 santé : les champs exacts, tous factuels', async t => {
  const b = await fixture(t);
  const { data } = await b.appel('/api/sante');
  assert.deepEqual(Object.keys(data).sort(), [
    'autonomie', 'conforme', 'crise', 'herdr', 'herdrVersion', 'journauxTrouves', 'node', 'versionChargee', 'versionDisque',
  ]);
  assert.equal(typeof data.herdr, 'boolean');
  assert.equal(typeof data.journauxTrouves, 'number');
  assert.ok(Number.isInteger(data.journauxTrouves) && data.journauxTrouves >= 0);
  assert.equal(data.node, process.version, 'la version Node est celle du processus du serveur');
  assert.ok(data.herdrVersion === null || typeof data.herdrVersion === 'string');
  assert.equal(typeof data.crise, 'boolean');
  assert.equal(typeof data.autonomie, 'boolean');
  assert.match(data.versionChargee, /^[0-9a-f]{16}$/);
  assert.match(data.versionDisque, /^[0-9a-f]{16}$/);
  assert.equal(data.conforme, true, 'sans modification, la version chargée est celle du disque');
});

test('N7 santé : réponse muette sur les chemins, la clé, l\'objectif et les messages', async t => {
  const b = await fixture(t);
  // Témoins : objectif d'autonomie en cours et consigne en file.
  const OBJECTIF = 'OBJECTIF-TEMPOIN-7f3a';
  const MESSAGE = 'MESSAGE-TEMPOIN-9c2b';
  const lance = await b.appel('/api/autonomie', {
    methode: 'POST',
    corps: { actif: true, objectif: OBJECTIF, minutes: 5, echanges: 3 },
  });
  assert.equal(lance.status, 200, lance.status === 200 ? '' : lance.texte);
  const mise = await b.appel('/api/queue', {
    methode: 'POST',
    corps: { id: 'w5:p1@aaa', message: MESSAGE },
  });
  assert.equal(mise.status, 200, mise.status === 200 ? '' : mise.texte);

  const { texte } = await b.appel('/api/sante');
  for (const temoin of [OBJECTIF, MESSAGE, b.jeton]) {
    assert.ok(!texte.includes(temoin), `la réponse ne doit pas contenir « ${temoin} »`);
  }
  assert.ok(!texte.includes('C:'), 'aucun chemin Windows');
  assert.ok(!texte.includes('/users/'), 'aucun chemin Unix utilisateur');
  const maison = homedir();
  assert.ok(!texte.toLowerCase().includes(maison.toLowerCase()), 'aucun chemin du home du poste');
  assert.ok(!texte.includes(b.racine), 'aucun chemin du dossier temporaire de test');
});

test('N7 santé : une modification sur le disque rend la version non conforme', async t => {
  const racine = await mkdtemp(join(tmpdir(), 'sante-code-'));
  t.after(() => rm(racine, { recursive: true, force: true }));
  await mkdir(join(racine, 'src'));
  await writeFile(join(racine, 'server.mjs'), 'export const a = 1;\n');
  await writeFile(join(racine, 'src', 'module.mjs'), 'export const b = 2;\n');

  let lectures = 0;
  const sante = createSante({
    racine,
    bridge: { list: async () => [] },
    versionHerdr: async () => '0.0.0-test',
    journaux: async () => 0,
    compteur: () => lectures++,
    delaiCache: 0,
    maintenant: () => 1000,
  });

  const avant = await sante.instantane();
  assert.equal(avant.conforme, true);
  assert.equal(avant.versionChargee, avant.versionDisque);

  // Le code change sur le disque : le serveur tourne toujours sur l'ancien.
  await writeFile(join(racine, 'src', 'module.mjs'), 'export const b = 3;\n');
  const apres = await sante.instantane();
  assert.equal(apres.conforme, false, 'la version du disque a changé');
  assert.notEqual(apres.versionChargee, apres.versionDisque);
});

test('N7 santé : la version du disque est recalculée au plus toutes les 60 s', async t => {
  const racine = await mkdtemp(join(tmpdir(), 'sante-cache-'));
  t.after(() => rm(racine, { recursive: true, force: true }));
  await mkdir(join(racine, 'src'));
  await writeFile(join(racine, 'server.mjs'), 'export const a = 1;\n');

  let heure = 0;
  let lectures = 0;
  const sante = createSante({
    racine,
    bridge: { list: async () => [] },
    versionHerdr: async () => '0.0.0-test',
    journaux: async () => 0,
    compteur: () => lectures++,
    maintenant: () => heure,
  });

  await sante.instantane();
  await sante.instantane();
  await sante.instantane();
  const luesTotot = lectures;
  assert.ok(luesTotot <= 2, `au plus un recalcul par fenêtre (observé : ${luesTotot})`);

  heure = 59_000;
  await sante.instantane();
  assert.equal(lectures, luesTotot, 'avant 60 s, aucun recalcul');

  heure = 61_000;
  await sante.instantane();
  assert.ok(lectures > luesTotot, 'après 60 s, le disque est relu une fois');
});

test('N7 santé : Herdr répond, ou non, sans jamais bloquer', async t => {
  const repond = createSante({
    racine: await mkdtemp(join(tmpdir(), 'sante-herdr-')),
    bridge: { list: async () => [] },
    versionHerdr: async () => '0.0.0-test',
    journaux: async () => 0,
  });
  assert.equal((await repond.instantane()).herdr, true);

  const muet = createSante({
    racine: await mkdtemp(join(tmpdir(), 'sante-muet-')),
    bridge: { list: () => new Promise(() => {}) },   // ne répond jamais
    delaiHerdr: 20,
    versionHerdr: async () => '0.0.0-test',
    journaux: async () => 0,
  });
  assert.equal((await muet.instantane()).herdr, false, 'un Herdr muet donne false après le délai');
});

test('N7 santé : crise et autonomie reflètent l\'état réel, sans redémarrage', async t => {
  const b = await fixture(t);
  const depart = await b.appel('/api/sante');
  assert.equal(depart.data.crise, false);
  assert.equal(depart.data.autonomie, false);

  const crise = await b.appel('/api/crise', { methode: 'POST', corps: { active: true } });
  assert.equal(crise.status, 200, crise.status === 200 ? '' : crise.texte);
  const lance = await b.appel('/api/autonomie', {
    methode: 'POST',
    corps: { actif: true, objectif: 'Verifier les etats de sante', minutes: 5, echanges: 3 },
  });
  assert.equal(lance.status, 423, 'en crise, l\'autonomie ne démarre pas');

  const pendant = await b.appel('/api/sante');
  assert.equal(pendant.data.crise, true);
  await b.appel('/api/crise', { methode: 'POST', corps: { active: false } });
  const apres = await b.appel('/api/sante');
  assert.equal(apres.data.crise, false);
  // La route n'agit pas : le serveur répond toujours, aucune relance n'a eu lieu.
  const encore = await b.appel('/api/state');
  assert.equal(encore.status, 200);
});
