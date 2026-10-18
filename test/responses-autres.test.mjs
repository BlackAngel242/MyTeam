import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, appendFile, rm, utimes, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import * as responses from '../src/responses.mjs';
import { createBureauServer } from '../server.mjs';

const cwd = 'C:/projet-factice';
const codex = { id: 'x', kind: 'Codex', cwd };
const at = '2026-10-18T10:00:00Z';
const line = (...entries) => entries.map(e => JSON.stringify(e)).join('\n') + '\n';
const meta = { type: 'session_meta', payload: { cwd, id: 'SESSION_PRIVEE', creator_account_id: 'COMPTE_PRIVE' } };
const event = (type, extra = {}) => ({ type: 'event_msg', timestamp: at, payload: { type, ...extra } });
const message = text => ({ type: 'response_item', timestamp: at, payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] } });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'responses-autres-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const codexRoot = join(root, 'codex'), openCodeRoot = join(root, 'opencode');
  await mkdir(codexRoot); await mkdir(openCodeRoot);
  assert.equal(typeof responses.createAgentResponsesReader, 'function', 'lecteur commun disponible');
  return { codexRoot, openCodeRoot, file: join(codexRoot, 'rollout-test.jsonl'), reader: responses.createAgentResponsesReader({ codexRoot, openCodeRoot }) };
}

test('Codex : textes publics du tour, fin observée, aucun message chiffré ni raisonnement', async t => {
  const f = await fixture(t);
  await writeFile(f.file, line(meta, event('task_started', { turn_id: 'TOUR_PRIVE' }), message('Bonjour é 🎉'),
    event('agent_message', { message: 'CHIFFRE_INTERDIT' }),
    { type: 'response_item', payload: { type: 'message', role: 'assistant', channel: 'analysis', content: [{ type: 'output_text', text: 'RAISONNEMENT_INTERDIT' }] } },
    message('Voir ~/.ssh/id et token=abcdef123456'), event('task_complete')));
  const result = await f.reader(codex, [codex]);
  assert.equal(result.found, true); assert.equal(result.complete, true);
  assert.equal(result.responses.length, 1);
  assert.equal(result.responses[0].state, 'terminée');
  assert.equal(result.responses[0].blocks[0].text, 'Bonjour é 🎉');
  assert.doesNotMatch(JSON.stringify(result), /PRIV|INTERDIT|\.ssh|abcdef123456|projet-factice|rollout/);
  const key = result.responses[0].key;
  assert.match(key, /^[0-9a-f]{16}$/);
  assert.deepEqual(await f.reader(codex, [codex, { ...codex, id: 'y' }]), { found: false, complete: false, responses: [] });
  assert.equal((await f.reader(codex)).responses[0].key, key);
});

test('Codex : un message adressé à un tiers explicite n\'apparaît pas, les autres restent (C-CD-08)', async t => {
  const f = await fixture(t);
  const tiers = { type: 'response_item', timestamp: at, payload: { type: 'message', role: 'assistant', channel: 'commentary', recipient: 'agent-confidentiel', content: [{ type: 'output_text', text: 'SECRET_TIERS' }] } };
  const pourLaPersonne = { type: 'response_item', timestamp: at, payload: { type: 'message', role: 'assistant', channel: 'commentary', recipient: 'user', content: [{ type: 'output_text', text: 'Visible pour la personne' }] } };
  await writeFile(f.file, line(meta, event('task_started'), message('Visible sans destinataire'), tiers, pourLaPersonne, event('task_complete')));
  const result = await f.reader(codex, [codex]);
  assert.equal(result.found, true);
  assert.deepEqual(result.responses[0].blocks.map(b => b.text), ['Visible sans destinataire', 'Visible pour la personne']);
  assert.doesNotMatch(JSON.stringify(result), /SECRET_TIERS|agent-confidentiel/, 'le message d\'un tiers ne doit jamais sortir');
});

test('Codex : lecture incrémentale UTF-8, ligne géante sautée et réécriture', async t => {
  const f = await fixture(t);
  await writeFile(f.file, line(meta, event('task_started'), message('Début')));
  const first = await f.reader(codex);
  assert.equal(first.responses[0].state, 'fin non déterminée');
  const bytes = Buffer.from(line(message('Suite é 🎉'))), cut = bytes.indexOf(Buffer.from('é')) + 1;
  await appendFile(f.file, bytes.subarray(0, cut));
  assert.equal((await f.reader(codex)).responses[0].blocks.length, 1);
  await appendFile(f.file, bytes.subarray(cut));
  await appendFile(f.file, 'x'.repeat(4 * 1024 * 1024 + 5) + '\n' + line(event('turn_aborted')));
  const result = await f.reader(codex);
  assert.deepEqual(result.responses[0].blocks.map(b => b.text), ['Début', 'Suite é 🎉']);
  assert.equal(result.responses[0].state, 'interrompue');
  await writeFile(f.file, line(meta, message('Réécrit')));
  assert.deepEqual((await f.reader(codex)).responses[0].blocks, [{ text: 'Réécrit' }]);
});

test('Codex : deux journaux aussi récents restent sans rattachement', async t => {
  const f = await fixture(t), other = join(f.codexRoot, 'rollout-autre.jsonl');
  for (const path of [f.file, other]) { await writeFile(path, line(meta, message('Texte'))); await utimes(path, new Date(1000), new Date(1000)); }
  assert.equal((await f.reader(codex)).found, false);
  await utimes(other, new Date(2000), new Date(2000));
  assert.equal((await f.reader(codex)).found, true);
});

test('Codex : les messages utilisateur séparent les tours sans événement task_started', async t => {
  const f=await fixture(t);
  const question=text=>({type:'response_item',timestamp:at,payload:{type:'message',role:'user',content:[{type:'input_text',text}]}});
  await writeFile(f.file,line(meta,question('Question 1'),message('Réponse 1'),question('Question 2'),message('Réponse 2')));
  const result=await f.reader(codex);
  assert.deepEqual(result.responses.map(r=>r.blocks.map(b=>b.text)),[['Réponse 1'],['Réponse 2']]);
  assert.ok(result.responses.every(r=>r.state==='fin non déterminée'));
});

test('Codex : réécriture plus longue et journal de sous-agent ne sont pas confondus', async t => {
  const f = await fixture(t);
  await writeFile(f.file, line(meta, message('Ancien')));
  assert.equal((await f.reader(codex)).found, true);
  await writeFile(f.file, line(meta, message('Nouveau texte, plus long que la version précédente')));
  assert.deepEqual((await f.reader(codex)).responses.flatMap(r => r.blocks.map(b => b.text)), ['Nouveau texte, plus long que la version précédente']);
  await writeFile(f.file, line({ ...meta, payload: { ...meta.payload, source: { subagent: { parent_thread_id: 'PARENT_PRIVE' } } } }, message('Sous-agent')));
  assert.equal((await f.reader(codex)).found, false);
});

test('OpenCode : texte des parts seulement, lecture seule, fin et ambiguïté', async t => {
  const f = await fixture(t), path = join(f.openCodeRoot, 'opencode.db');
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE session_v2(id TEXT,parent_id TEXT,directory TEXT,time_updated INTEGER); CREATE TABLE message(id TEXT,session_id TEXT,time_created INTEGER,time_updated INTEGER,data TEXT); CREATE TABLE part(id TEXT,message_id TEXT,session_id TEXT,time_created INTEGER,data TEXT); CREATE TABLE credential(secret TEXT); INSERT INTO credential VALUES (\'SECRET_COMPTE\');');
  const addSession = db.prepare('INSERT INTO session_v2 VALUES(?,?,?,?)');
  addSession.run('SESSION_PRIVEE', null, cwd, 10);
  db.prepare('INSERT INTO message VALUES(?,?,?,?,?)').run('MESSAGE_PRIVE', 'SESSION_PRIVEE', 1000, 2000, JSON.stringify({ role: 'assistant', finish: 'stop', time: { created: 1000, completed: 2000 } }));
  const addPart = db.prepare('INSERT INTO part VALUES(?,?,?,?,?)');
  addPart.run('p1', 'MESSAGE_PRIVE', 'SESSION_PRIVEE', 1000, JSON.stringify({ type: 'text', text: 'Réponse é 🎉' }));
  addPart.run('p2', 'MESSAGE_PRIVE', 'SESSION_PRIVEE', 1001, JSON.stringify({ type: 'reasoning', text: 'RAISONNEMENT_INTERDIT' }));
  addPart.run('p3', 'MESSAGE_PRIVE', 'SESSION_PRIVEE', 1002, JSON.stringify({ type: 'text', text: 'SYNTHETIQUE_INTERDIT', synthetic: true }));
  db.close();
  const before = await readFile(path), agent = { id: 'o', kind: 'OpenCode', cwd };
  const result = await f.reader(agent);
  assert.equal(result.found, true); assert.equal(result.complete, true);
  assert.equal(result.responses[0].state, 'terminée');
  assert.equal(result.responses[0].startedAt, '1970-01-01T00:00:01.000Z');
  assert.deepEqual(result.responses[0].blocks, [{ text: 'Réponse é 🎉' }]);
  assert.doesNotMatch(JSON.stringify(result), /PRIV|INTERDIT|SECRET_COMPTE|projet-factice|opencode\.db/);
  assert.deepEqual(await readFile(path), before);
  assert.equal((await f.reader(agent, [agent, { ...agent, id: 'o2' }])).found, false);
  const update = new DatabaseSync(path); update.prepare('INSERT INTO session_v2 VALUES(?,?,?,?)').run('SESSION_EGALE', null, cwd, 10); update.close();
  assert.equal((await f.reader(agent)).found, false);
});

test('/api/reponses raccorde Codex avec la liste courante et protège la lecture', async t => {
  const f = await fixture(t);
  await writeFile(f.file, line(meta, message('Réponse de la route')));
  let agents = [codex];
  const server = createBureauServer({ bridge: { list: async () => agents }, readOtherActivity: async () => null, getOtherResponses: f.reader, cacheReponsesMs: 0 });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const { token } = await (await fetch(origin+'/api/state')).json();
  assert.equal((await fetch(origin+'/api/reponses?id=x')).status,403);
  const headers = { Origin: origin, 'X-Bureau-Token': token };
  const read = () => fetch(origin+'/api/reponses?id=x',{ headers }).then(r => r.json());
  const result = await read();
  assert.equal(result.supported,true); assert.equal(result.found,true);
  assert.deepEqual(result.responses[0].blocks,[{text:'Réponse de la route'}]);
  agents = [codex,{...codex,id:'y'}];
  assert.deepEqual(await read(),{supported:true,found:false,complete:false,responses:[]});
});
