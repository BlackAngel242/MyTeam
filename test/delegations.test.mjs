import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bossOf, readDelegations } from '../src/delegations.mjs';

const SESSION = '12345678-1234-1234-1234-123456789abc';

async function journal(t, lignes, { nom = SESSION } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'bureau-delegations-'));
  const dossier = join(root, 'projet-test');
  await mkdir(dossier);
  await writeFile(join(dossier, `${nom}.jsonl`), lignes.join('\n') + '\n', 'utf8');
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function appel(id, command, timestamp = '2026-10-17T09:00:00.000Z') {
  return JSON.stringify({ type: 'assistant', timestamp, message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] } });
}

function resultat(toolUseId, content, is_error = false) {
  return JSON.stringify({
    type: 'user',
    timestamp: '2026-10-17T09:00:05.000Z',
    message: { content: [{ type: 'tool_result', tool_use_id: toolUseId, content, ...(is_error ? { is_error: true } : {}) }] },
  });
}

test('repère les délégations avec guillemets imbriqués, échappés et apostrophes', async t => {
  const root = await journal(t, [
    appel('t1', 'herdr agent prompt w5:p2 "L\'écran d\'accueil est cassé"'),
    appel('t2', 'herdr agent prompt w5:p1 \'Dire "bonjour" à tous\''),
    appel('t3', 'herdr agent prompt w5:p1 "Il faut \\"revoir\\" la page d\'accueil"'),
  ]);
  const { found, delegations } = await readDelegations(SESSION, { root });
  assert.equal(found, true);
  assert.equal(delegations.length, 3);
  assert.deepEqual(delegations.map(d => d.target), ['w5:p2', 'w5:p1', 'w5:p1']);
  assert.equal(delegations[0].title, "L'écran d'accueil est cassé".slice(0, -1), 'jamais la consigne complète');
  assert.equal(delegations[1].title, 'Dire "bonjour" à tous'.slice(0, -1));
  assert.equal(delegations[2].title, 'Il faut "revoir" la page d\'accueil'.slice(0, -1));
  for (const d of delegations) {
    assert.equal(d.at, '2026-10-17T09:00:00.000Z');
    assert.equal(d.result, null);
    assert.ok(d.title.length <= 80);
  }
});

test('un message en variable ou en substitution ne donne pas de titre', async t => {
  const root = await journal(t, [
    appel('v1', 'herdr agent prompt w5:p3 $(cat consigne.txt)'),
    appel('v2', 'herdr agent prompt w5:p3 "$MA_VARIABLE"'),
    appel('v3', 'herdr agent prompt w5:p3 "Merci $MA_VARIABLE"'),
    appel('v4', 'herdr agent prompt w5:p3 \'$(cat f)\''),
  ]);
  const { delegations } = await readDelegations(SESSION, { root });
  assert.deepEqual(delegations.map(d => [d.target, d.title]), [
    ['w5:p3', null],
    ['w5:p3', null],
    ['w5:p3', null],
    ['w5:p3', '$(cat f)'.slice(0, -1)],
  ]);
});

test('cible par nom et herdr qualifié par chemin entre guillemets', async t => {
  const root = await journal(t, [
    appel('n1', 'herdr agent prompt mon-agent "Travaille sur la facturation"'),
    appel('n2', '& "C:\\Program Files\\herdr\\herdr.exe" agent prompt w5:p3 "Bonjour"'),
    appel('n3', '"/usr/local/bin/herdr" agent prompt w5:p4 "Aussi avec chemin Unix"'),
    appel('n4', 'C:\\Program Files\\herdr\\herdr.exe agent prompt w5:p5 "Sans guillemets"'),
  ]);
  const { delegations } = await readDelegations(SESSION, { root });
  assert.deepEqual(delegations.map(d => [d.target, d.title]), [
    ['mon-agent', 'Travaille sur la facturation'.slice(0, -1)],
    ['w5:p3', 'Bonjou'],
    ['w5:p4', 'Aussi avec chemin Unix'.slice(0, -1)],
  ]);
});

test('ignore les cibles impossibles à lire, les exemples imprimés et l\'aide', async t => {
  const root = await journal(t, [
    appel('i1', 'herdr agent prompt "$PANE_CIBLE" "Bonjour"'),
    appel('i2', 'herdr agent prompt'),
    appel('i3', 'echo agent prompt w5:p1 "Ce n\'est pas herdr"'),
    appel('i4', 'herdr agent list'),
    appel('i5', 'echo herdr agent prompt w5:p2 "Simulation"'),
    appel('i6', 'herdr agent list; echo agent prompt w5:p2 "Simulation"'),
    appel('i7', 'herdr agent prompt --help'),
    appel('i8', 'herdr agent prompt w5:p1 --help'),
    appel('i9', 'herdr agent prompt w5:p2'),
    appel('i10', 'herdr agent prompt ../chemin "x"'),
    appel('i11', 'herdr agent prompt "C:/Users/x" "y"'),
  ]);
  const { delegations } = await readDelegations(SESSION, { root });
  assert.deepEqual(delegations, []);
});

test('les délégations par variable et par chemin complet sont reconnues', async t => {
  const root = await journal(t, [
    appel('v1', 'H="$HOME/.herdr/packages/standalone/releases/0.9.5-x86_64-pc-windows-msvc/herdr.exe"; "$H" agent prompt w5:p4 "$(cat fichier)"'),
    appel('v2', 'H=/opt/herdr/herdr.exe; $H agent prompt w5:p2 "Avec variable nue"'),
    appel('v3', 'H="${HOME}/.herdr/herdr"; ${H} agent prompt mon-agent "Avec accolades"'),
    appel('v4', 'H=autre-chose; "$H" agent prompt w5:p1 "Ne pas compter"'),
    appel('v5', 'H="$HOME/.herdr/herdr.exe"; echo "$H" agent prompt w5:p1 "Faux positif echo"'),
    appel('v6', 'H="$HOME/.herdr/herdr.exe"; "$H" agent prompt --help'),
    appel('v7', '"$HOME/.herdr/packages/standalone/releases/0.9.5-x86_64-pc-windows-msvc/herdr.exe" agent prompt w5:p3 "Chemin direct"'),
    appel('v8', 'export H=/usr/local/bin/herdr; "$H" agent prompt w5:p5 "Avec export"'),
  ]);
  const { delegations } = await readDelegations(SESSION, { root });
  assert.deepEqual(delegations.map(d => [d.id, d.target]), [
    ['v1', 'w5:p4'],
    ['v2', 'w5:p2'],
    ['v3', 'mon-agent'],
    ['v7', 'w5:p3'],
    ['v8', 'w5:p5'],
  ]);
  assert.equal(delegations[0].title, null, 'le message $(cat fichier) n\'est pas en clair');
  assert.equal(delegations[1].title, 'Avec variable nue'.slice(0, -1));
});

test('les lignes corrompues et les structures inattendues sont ignorées', async t => {
  const root = await journal(t, [
    '{"broken"',
    'pas du json',
    '123',
    'null',
    '{"type":"assistant","message":"autre chose"}',
    appel('c1', 'herdr agent prompt w5:p2 "Consigne valide"'),
  ]);
  const { delegations } = await readDelegations(SESSION, { root });
  assert.equal(delegations.length, 1);
  assert.equal(delegations[0].id, 'c1');
});

test('plafond : une ligne géante est ignorée sans casser la lecture', async t => {
  const long = 'x'.repeat(5 * 1024 * 1024);
  const root = await journal(t, [
    appel('g1', 'herdr agent prompt w5:p1 "Avant la ligne géante"'),
    appel('g2', 'herdr agent prompt w5:p1 ' + long),
    appel('g3', 'herdr agent prompt w5:p1 "Après la ligne géante"'),
    appel('g4', 'herdr agent prompt w5:p1 "' + 'Titre volontairement beaucoup trop long '.repeat(6) + '"'),
  ]);
  const { delegations } = await readDelegations(SESSION, { root });
  assert.deepEqual(delegations.map(d => d.id), ['g1', 'g3', 'g4']);
  for (const d of delegations) assert.ok(d.title.length <= 80, `title trop long : ${d.title.length}`);
  assert.equal(delegations[2].title.length, 80);
});

test('issue observée : seul agent_prompted est un succès, l\'ambigu reste inconnu', async t => {
  const root = await journal(t, [
    appel('r1', 'herdr agent prompt w5:p1 "Première"'),
    resultat('r1', '{"result":{"type":"agent_prompted"}}'),
    appel('r2', 'herdr agent prompt w5:p2 "Deuxième"'),
    resultat('r2', 'agent_prompt_stalled ' + 'détail '.repeat(100), true),
    appel('r3', 'herdr agent prompt w5:p3 "Troisième"'),
    resultat('r3', '{"error":"Herdr a refusé"}'),
    appel('r4', 'herdr agent prompt w5:p4 "Quatrième"'),
    resultat('r4', 'agent_prompt_' + 'a'.repeat(80)),
    appel('r5', 'herdr agent prompt w5:p1 "Cinquième"'),
    resultat('r5', '{"ok":true,"error":"échec discret"}'),
  ]);
  const { delegations } = await readDelegations(SESSION, { root });
  assert.deepEqual(delegations.map(d => d.result), [
    { ok: true, type: 'agent_prompted' },
    { ok: null, type: 'agent_prompt_stalled' },
    { ok: false, type: 'error' },
    { ok: null, type: null },
    { ok: false, type: 'error' },
  ]);
  const texte = JSON.stringify(delegations);
  assert.ok(!texte.includes('détail'), 'le texte complet du tool_result ne doit pas sortir');
  assert.ok(!texte.includes('Herdr a refusé'), 'le texte complet de l\'erreur ne doit pas sortir');
  for (const d of delegations) assert.ok(d.result.type === null || ['agent_prompted', 'agent_prompt_stalled', 'error'].includes(d.result.type), 'liste fermée de types');
});

test('un tool_result sans texte exploitable reste une issue inconnue', async t => {
  const root = await journal(t, [
    appel('s1', 'herdr agent prompt w5:p1 "Sans résultat textuel"'),
    resultat('s1', [{ type: 'text', text: 'ok' }]),
  ]);
  const { delegations } = await readDelegations(SESSION, { root });
  assert.deepEqual(delegations[0].result, { ok: null, type: null });
});

test('sessionId invalide ou fichier absent renvoient found:false', async t => {
  assert.deepEqual(await readDelegations('pas-une-session', { root: await journal(t, []) }), { found: false });
  assert.deepEqual(await readDelegations('123', { root: await journal(t, []) }), { found: false });
  assert.deepEqual(await readDelegations(null, { root: await journal(t, []) }), { found: false });
  assert.deepEqual(await readDelegations(SESSION, { root: await journal(t, [], { nom: 'autre-session' }) }), { found: false });
});

test('confidentialité : ni chemin, ni commande, ni message complet dans la sortie', async t => {
  const message = 'Consigne confidentielle '.repeat(20);
  const root = await journal(t, [
    appel('p1', 'herdr agent prompt w5:p1 "' + message + '"'),
    resultat('p1', 'agent_prompted ' + 'suite '.repeat(50)),
  ]);
  const reponse = await readDelegations(SESSION, { root });
  const texte = JSON.stringify(reponse);
  assert.ok(!texte.includes(root), 'le chemin du journal ne doit pas sortir');
  assert.ok(!texte.includes('.jsonl'), 'le nom du journal ne doit pas sortir');
  assert.ok(!texte.includes('herdr agent prompt'), 'la commande complète ne doit pas sortir');
  assert.ok(!texte.includes(message.trim()), 'le message complet ne doit pas sortir');
  assert.ok(!texte.includes('suite '), 'le résultat complet ne doit pas sortir');
});

test('deux lectures simultanées donnent le même résultat, sans double comptage', async t => {
  const root = await journal(t, [appel('d1', 'herdr agent prompt w5:p1 "Une seule fois"')]);
  const [a, b] = await Promise.all([readDelegations(SESSION, { root }), readDelegations(SESSION, { root })]);
  assert.deepEqual(a, b);
  assert.equal(a.delegations.length, 1);
});

test('un journal réécrit est relu depuis le début, sans garder l\'ancien contenu', async t => {
  const root = await journal(t, [appel('ancien', 'herdr agent prompt w5:p1 "Ancienne consigne"')]);
  const avant = await readDelegations(SESSION, { root });
  assert.equal(avant.delegations.length, 1);
  const dossier = join(root, 'projet-test');
  await writeFile(join(dossier, `${SESSION}.jsonl`), appel('nouveau', 'herdr agent prompt w5:p2 "Nouvelle consigne"') + '\n', 'utf8');
  const apres = await readDelegations(SESSION, { root });
  assert.deepEqual(apres.delegations.map(d => d.id), ['nouveau']);
});

test('une réécriture du début détectée remet à zéro même si la fin est conservée', async t => {
  const root = await journal(t, [
    appel('vieux', 'herdr agent prompt w5:p1 "Consigne périmée"'),
    'x'.repeat(200),
  ]);
  const avant = await readDelegations(SESSION, { root });
  assert.equal(avant.delegations.length, 1);
  const dossier = join(root, 'projet-test');
  const fichier = join(dossier, `${SESSION}.jsonl`);
  // Le début change, la queue (les 200 x) reste identique et le fichier grandit.
  const contenu = await readFile(fichier, 'utf8');
  const queue = contenu.slice(-201);
  await writeFile(fichier, appel('frais', 'herdr agent prompt w5:p2 "Consigne fraîche"') + '\n' + queue + '\n', 'utf8');
  const apres = await readDelegations(SESSION, { root });
  assert.deepEqual(apres.delegations.map(d => d.id), ['frais']);
});

test('l\'état de saut d\'une ligne géante survit entre deux lectures', async t => {
  const root = await journal(t, []);
  const dossier = join(root, 'projet-test');
  const fichier = join(dossier, `${SESSION}.jsonl`);
  await writeFile(fichier, 'x'.repeat(5 * 1024 * 1024), 'utf8');
  const premiere = await readDelegations(SESSION, { root });
  assert.deepEqual(premiere.delegations, []);
  // Ce JSON est le SUFIXE de la ligne géante : il ne doit jamais devenir une entrée.
  await appendFile(fichier, appel('piege', 'herdr agent prompt w5:p1 "Dans la ligne géante"') + '\n');
  const apres = await readDelegations(SESSION, { root });
  assert.deepEqual(apres.delegations, []);
  await appendFile(fichier, appel('vrai', 'herdr agent prompt w5:p1 "Après la ligne"') + '\n');
  const fin = await readDelegations(SESSION, { root });
  assert.deepEqual(fin.delegations.map(d => d.id), ['vrai']);
});

test('le titre n\'est jamais la consigne complète et masque les chemins', async t => {
  const root = await journal(t, [
    appel('t1', 'herdr agent prompt w5:p1 "Court"'),
    appel('t2', 'herdr agent prompt w5:p2 "Relis C:\\Users\\DrSmoke\\secret.txt et dis-moi"'),
    appel('t3', 'herdr agent prompt w5:p3 "Voir ~/prive/notes.md stp"'),
    appel('t4', 'herdr agent prompt w5:p4 "' + 'Phrase longue '.repeat(20) + '"'),
  ]);
  const { delegations } = await readDelegations(SESSION, { root });
  for (const d of delegations) assert.ok(d.title === null || d.title.length <= 80);
  assert.equal(delegations[0].title, 'Cour', 'même courte, la consigne est coupée');
  assert.notEqual(delegations[0].title, 'Court');
  assert.ok(!delegations[1].title.includes('secret'), 'le chemin est masqué');
  assert.ok(delegations[1].title.includes('…'));
  assert.ok(!delegations[2].title.includes('notes.md'), 'le chemin personnel est masqué');
  assert.equal(delegations[3].title.length, 80);
});

test('bossOf choisit le plus petit numéro de panneau de son espace', () => {
  const p1 = { id: 'w5:p1@aaaa', paneId: 'w5:p1', name: 'Claude' };
  const p4 = { id: 'w5:p4@bbbb', paneId: 'w5:p4', name: 'Codex' };
  assert.equal(bossOf([p4, p1]), p1);
  assert.equal(bossOf([p1, p4]), p1);
  const p10 = { id: 'w5:p10@cccc', paneId: 'w5:p10' };
  const p2 = { id: 'w5:p2@dddd', paneId: 'w5:p2' };
  assert.equal(bossOf([p10, p2]), p2, 'le numéro compare comme un nombre');
});

test('bossOf ignore les identifiants illisibles et renvoie null sans candidat', () => {
  assert.equal(bossOf([]), null);
  assert.equal(bossOf(null), null);
  assert.equal(bossOf([{ id: 'sans-panneau' }, { paneId: 'bizarre' }, { paneId: '' }]), null);
  const seul = { id: 'w5:p1@ffff', name: 'Chef' };
  assert.equal(bossOf([{ id: 'x' }, seul]), seul, 'l\'identifiant complet sert de repli');
  const meme = [{ id: 'w5:p2@b', paneId: 'w5:p2' }, { id: 'w5:p2@a', paneId: 'w5:p2' }];
  assert.equal(bossOf(meme), meme[1], 'égalité de panneau : tri stable sur l\'identifiant');
});
