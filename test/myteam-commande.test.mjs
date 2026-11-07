import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHerdr, sessionHerdr } from '../src/herdr.mjs';
import { lancerMyTeam, variableUtilisateur, identifier, processusNode } from '../scripts/myteam.mjs';
import { createBureauServer } from '../server.mjs';
import { cadre, etatInitial, appliquer, parseLigne, dossierLocal } from '../scripts/installateur-anime.mjs';

test('session Herdr dédiée : chaque appel du serveur vise --session, un nom invalide est refusé', async () => {
  const appels = [];
  const herdr = createHerdr({ env: { BUREAU_HERDR_SESSION: 'myteam' }, run: async args => { appels.push(args); return JSON.stringify({ result: { agents: [] } }); } });
  await herdr.list();
  assert.deepEqual(appels[0].slice(0, 3), ['--session', 'myteam', 'agent']);
  const parDefaut = [];
  await createHerdr({ env: {}, run: async args => { parDefaut.push(args); return JSON.stringify({ result: { agents: [] } }); } }).list();
  assert.equal(parDefaut[0][0], 'agent', 'sans variable, la session par défaut de Herdr reste utilisée');
  assert.equal(sessionHerdr({}), null);
  assert.throws(() => sessionHerdr({ BUREAU_HERDR_SESSION: 'myteam; rm -rf' }), /invalide/);
});

function dependances({ variables = {}, herdr = 'C:/herdr.exe', statut = 0, presents = [null], pidNode = () => null } = {}) {
  const journal = { ouvertures: [], lancements: [], textes: [], tues: [] };
  let n = 0;
  return {
    journal,
    options: {
      env: {},
      lire: nom => variables[nom],
      ouvrir: async o => { journal.ouvertures.push(o); },
      trouverHerdr: () => herdr,
      lancer: (fichier, args, opts) => { journal.lancements.push({ fichier, args, opts }); return { status: statut }; },
      ecrire: t => journal.textes.push(t),
      qui: async () => presents[Math.min(n++, presents.length - 1)],
      pidNode,
      tuer: pid => journal.tues.push(pid),
      pause: async () => {},
    },
  };
}

test('myteam : ouvre le bureau au port enregistré puis Herdr sur la session MyTeam, dans ce terminal', async () => {
  const { journal, options } = dependances({ variables: { BUREAU_PORT: '8317' } });
  assert.equal(await lancerMyTeam([], options), 0);
  assert.equal(journal.ouvertures[0].port, '8317');
  assert.equal(options.env.BUREAU_HERDR_SESSION, 'myteam', 'le serveur lit la même session que la fenêtre Herdr');
  assert.deepEqual(journal.lancements[0].args, ['--session', 'myteam']);
  assert.equal(journal.lancements[0].opts.stdio, 'inherit');
  assert.ok(journal.textes.some(t => t.includes('http://127.0.0.1:8317')));
  assert.equal(options.env.BUREAU_HERDR_PATH, 'C:/herdr.exe', 'le serveur reçoit aussi le chemin de Herdr');
});

test('myteam : un bureau MyTeam d’une autre session est arrêté puis rouvert sur la session MyTeam', async () => {
  const { journal, options } = dependances({ presents: [{ myteam: true, session: null, pid: 4242 }, null] });
  assert.equal(await lancerMyTeam([], options), 0);
  assert.deepEqual(journal.tues, [4242]);
  assert.equal(journal.ouvertures.length, 1);
});

test('myteam : le bon bureau déjà ouvert est réutilisé, un autre programme sur le port n’est jamais arrêté', async () => {
  const a = dependances({ presents: [{ myteam: true, session: 'myteam', pid: 7 }] });
  assert.equal(await lancerMyTeam([], a.options), 0);
  assert.deepEqual(a.journal.tues, []);
  const b = dependances({ presents: [{ myteam: false }] });
  assert.equal(await lancerMyTeam([], b.options), 1);
  assert.deepEqual(b.journal.tues, []);
  assert.equal(b.journal.ouvertures.length, 0);
  assert.ok(b.journal.textes.some(t => /occupé par un autre programme/.test(t)));
  const c = dependances({ presents: [{ myteam: true, ancien: true, session: null, pid: null }] });
  assert.equal(await lancerMyTeam([], c.options), 1, 'ancien bureau sans processus Node identifié : on explique au lieu de deviner');
  assert.equal(c.journal.ouvertures.length, 0);
  const d = dependances({ presents: [{ myteam: true, ancien: true, session: null, pid: null }, null], pidNode: () => 99 });
  assert.equal(await lancerMyTeam([], d.options), 0);
  assert.deepEqual(d.journal.tues, [99]);
});

test('identifier : bureau MyTeam, ancien bureau, autre programme, port libre', async () => {
  const rep = (status, corps, csp = '') => async () => ({ ok: status === 200, status, json: async () => corps, headers: { get: n => n === 'content-security-policy' ? csp : null } });
  assert.deepEqual(await identifier(4317, { recuperer: rep(200, { app: 'myteam', version: '0.6.1', session: 'myteam', pid: 5 }) }), { myteam: true, session: 'myteam', pid: 5, version: '0.6.1' });
  assert.equal((await identifier(4317, { recuperer: rep(404, { error: 'Page introuvable.' }, "default-src 'self'; frame-ancestors 'none'") })).ancien, true);
  assert.deepEqual(await identifier(4317, { recuperer: rep(404, { error: 'Not found' }) }), { myteam: false });
  assert.equal(await identifier(4317, { recuperer: async () => { throw new Error('ECONNREFUSED'); } }), null);
});

test('processusNode : seul un processus node.exe qui écoute le port est retenu', () => {
  const netstat = ['  TCP    127.0.0.1:4317         0.0.0.0:0              LISTENING       4242', '  TCP    127.0.0.1:43170        0.0.0.0:0              LISTENING       9', ''].join('\r\n');
  const lancer = image => (cmd) => ({ stdout: cmd === 'netstat' ? netstat : image });
  assert.equal(processusNode(4317, { platform: 'win32', lancer: lancer('"node.exe","4242","Console","1","50 000 K"') }), 4242);
  assert.equal(processusNode(4317, { platform: 'win32', lancer: lancer('"chrome.exe","4242","Console","1","50 000 K"') }), null);
});

test('le serveur annonce son identité : application, version, session Herdr et processus', async t => {
  const avant = process.env.BUREAU_HERDR_SESSION;
  process.env.BUREAU_HERDR_SESSION = 'myteam';
  t.after(() => { if (avant === undefined) delete process.env.BUREAU_HERDR_SESSION; else process.env.BUREAU_HERDR_SESSION = avant; });
  const server = createBureauServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const corps = await (await fetch(`http://127.0.0.1:${server.address().port}/api/identite`)).json();
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(corps, { app: 'myteam', version, session: 'myteam', pid: process.pid });
});

test('myteam --bureau n\'ouvre pas Herdr ; option inconnue et --help répondent sans rien lancer', async () => {
  const a = dependances();
  assert.equal(await lancerMyTeam(['--bureau'], a.options), 0);
  assert.equal(a.journal.ouvertures.length, 1);
  assert.equal(a.journal.lancements.length, 0);
  const b = dependances();
  assert.equal(await lancerMyTeam(['--oups'], b.options), 2);
  assert.equal(await lancerMyTeam(['--help'], b.options), 0);
  assert.equal(b.journal.ouvertures.length + b.journal.lancements.length, 0);
});

test('myteam sans Herdr : le bureau s\'ouvre quand même et la marche à suivre est donnée', async () => {
  const { journal, options } = dependances({ herdr: null });
  assert.equal(await lancerMyTeam([], options), 1);
  assert.equal(journal.ouvertures.length, 1);
  assert.ok(journal.textes.some(t => /Herdr est introuvable.*npx @drsmoke\/myteam/.test(t)));
});

test('les variables de l\'utilisateur Windows sont relues dans le registre si le terminal est plus ancien', () => {
  const sortie = '\r\nHKEY_CURRENT_USER\\Environment\r\n    BUREAU_PORT    REG_SZ    8317\r\n\r\n';
  const lancer = (cmd, args) => { assert.deepEqual([cmd, ...args], ['reg', 'query', 'HKCU\\Environment', '/v', 'BUREAU_PORT']); return { stdout: sortie }; };
  assert.equal(variableUtilisateur('BUREAU_PORT', { env: {}, platform: 'win32', lancer }), '8317');
  assert.equal(variableUtilisateur('BUREAU_PORT', { env: { BUREAU_PORT: '9000' }, platform: 'win32', lancer }), '9000');
  assert.equal(variableUtilisateur('BUREAU_PORT', { env: {}, platform: 'linux', lancer }), undefined);
});

test('bin/myteam est exécutable par Node (module ES sans extension) et répond à --help', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('../bin/myteam', import.meta.url)), '--help'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /myteam --bureau/);
});

test('le bureau sert l\'icône MyTeam en PNG, utilisée comme icône d\'onglet', async t => {
  const server = createBureauServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const reponse = await fetch(`http://127.0.0.1:${server.address().port}/myteam.png`);
  assert.equal(reponse.status, 200);
  assert.equal(reponse.headers.get('content-type'), 'image/png');
  const octets = Buffer.from(await reponse.arrayBuffer());
  assert.deepEqual(octets, await readFile(new URL('../public/myteam.png', import.meta.url)));
  assert.equal(octets.readUInt32BE(16), 256, 'PNG 256 × 256');
  const ico = await readFile(new URL('../public/myteam.ico', import.meta.url));
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], 'fichier .ico valide pour le raccourci Windows');
  assert.match(await readFile(new URL('../public/index.html', import.meta.url), 'utf8'), /<link rel="icon" type="image\/png" href="\/myteam.png">/);
});

test('l\'écran affiche le vrai dossier d\'installation à la place de [dossier] (les messages restent masqués)', () => {
  const etat = etatInitial({ lang: 'fr' });
  etat.dossier = 'C:\\Users\\Moi\\AppData\\Local\\Programs\\MyTeam';
  for (const l of ['@@PLAN a\tA', '@@STEP a', '@@INFO === Résumé ===', "@@INFO Pour démarrer : double-cliquez sur 'Ouvrir le bureau.cmd' dans [dossier]", '@@DONE a\tok\t', '@@END ok']) appliquer(etat, parseLigne(l));
  assert.ok(etat.resume[0].includes('[dossier]'), 'l\'état garde le texte masqué reçu');
  assert.match(cadre(etat, 0, { couleur: false, largeur: 200 }).join('\n'), /dans C:\\Users\\Moi\\AppData\\Local\\Programs\\MyTeam/);
  assert.equal(dossierLocal({ dossier: null }, 'dans [dossier]'), 'dans [dossier]');
});
