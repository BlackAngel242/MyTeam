import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, appendFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createAgentActivityReader } from '../src/agent-activity.mjs';

const cwd = 'C:/projet-factice';
const codex = { kind: 'Codex', cwd };
const usage = (input, output, cached = 0) => ({ type: 'event_msg', payload: {
  type: 'token_count', info: { total_token_usage: { input_tokens: input, output_tokens: output, cached_input_tokens: cached } },
} });
const meta = (directory = cwd) => ({ type: 'session_meta', payload: { cwd: directory } });
const lines = (...items) => items.map(item => JSON.stringify(item)).join('\n') + '\n';
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'agent-activity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const codexRoot = join(root, 'codex');
  const openCodeRoot = join(root, 'opencode');
  await mkdir(join(codexRoot, '2026', '10'), { recursive: true });
  await mkdir(openCodeRoot);
  const file = join(codexRoot, '2026', '10', 'rollout-factice.jsonl');
  const reader = createAgentActivityReader({ codexRoot, openCodeRoot });
  return { root, codexRoot, openCodeRoot, file, reader };
}

test('Codex : dernier cumul, limites, modèle et effort sans données privées', async t => {
  const f = await fixture(t);
  const event = usage(150, 30, 50);
  event.payload.rate_limits = { primary: { used_percent: 12, window_minutes: 300, resets_at: 1792208254 }, secondary: { used_percent: 25, window_minutes: 10080, resets_at: 1792672627 }, rate_limit_reached_type: null };
  await writeFile(f.file, lines({ type:'session_meta',payload:{cwd,creator_user_id:'SECRET_UTILISATEUR',creator_account_id:'SECRET_COMPTE',id:'SECRET_SESSION'} },
    usage(100, 20, 40), event,
    { type: 'turn_context', payload: { model: 'modele-factice', effort: 'high', private: 'SECRET_CONTENU' } },
    { type: 'response_item', payload: { content: 'SECRET_MESSAGE' } }));
  const result = await f.reader(codex);
  assert.ok(result);
  assert.equal(result.tokens.input, 100);
  assert.equal(result.tokens.output, 30);
  assert.equal(result.tokens.cacheRead, 50);
  assert.equal(result.model, 'modele-factice');
  assert.equal(result.effort, 'high');
  assert.deepEqual(result.limits, [
    { label: 'Principale', usedPercent: 12, window: 300, resetsAt: new Date(1792208254 * 1000).toISOString() },
    { label: 'Secondaire', usedPercent: 25, window: 10080, resetsAt: new Date(1792672627 * 1000).toISOString() },
  ]);
  assert.equal(result.limitReached, false);
  assert.equal(result.source, 'journal local');
  assert.equal(result.match, 'dossier et activité récente');
  assert.equal('subagents' in result, false);
  assert.doesNotMatch(JSON.stringify(result), /SECRET_|projet-factice|rollout|sessionId|creator_/);
});

test('Codex : aucun rattachement si plusieurs agents partagent le dossier', async t => {
  const f = await fixture(t);
  await writeFile(f.file, lines(meta(), usage(10, 2)));
  assert.equal(await f.reader(codex, [codex, { ...codex }]), null);
  assert.ok(await f.reader(codex, [codex, { kind: 'OpenCode', cwd }]));
});

test('Codex : cache écrit séparé de l’entrée et absence de compteurs conservée', async t => {
  const f = await fixture(t);
  await writeFile(f.file, lines(meta(), { type: 'turn_context', payload: { model: 'modele-factice', effort: 'medium' } }));
  assert.equal((await f.reader(codex)).tokens, null);
  const event = usage(200, 40, 70);
  event.payload.info.total_token_usage.cache_write_input_tokens = 10;
  await appendFile(f.file, lines(event));
  assert.deepEqual((await f.reader(codex)).tokens, { input: 120, output: 40, cacheRead: 70, cacheCreation: 10 });
});

test('Codex : sélection du journal le plus récent du dossier exact', async t => {
  const f = await fixture(t);
  await writeFile(f.file, lines(meta(), usage(10, 2)));
  const other = join(f.codexRoot, '2026', '10', 'rollout-autre.jsonl');
  await writeFile(other, lines(meta('C:/autre-factice'), usage(999, 999)));
  const recent = join(f.codexRoot, '2026', '10', 'rollout-recent.jsonl');
  await writeFile(recent, lines(meta(), usage(20, 4)));
  const { utimes } = await import('node:fs/promises');
  await utimes(f.file, new Date(1000), new Date(1000));
  await utimes(recent, new Date(2000), new Date(2000));
  assert.equal((await f.reader(codex)).tokens.input, 20);
});

test('Codex : ajout incrémental, ligne partielle et UTF-8', async t => {
  const f = await fixture(t);
  await writeFile(f.file, lines(meta(), usage(10, 2)));
  assert.equal((await f.reader(codex)).tokens.input, 10);
  const next = Buffer.from(lines({ type: 'turn_context', payload: { model: 'modèle-é', effort: 'low' } }, usage(25, 5)));
  const cut = next.indexOf(Buffer.from('è')) + 1;
  await appendFile(f.file, next.subarray(0, cut));
  assert.equal((await f.reader(codex)).tokens.input, 10);
  await appendFile(f.file, next.subarray(cut));
  const result = await f.reader(codex);
  assert.equal(result.tokens.input, 25);
  assert.equal(result.model, 'modèle-é');
});

test('Codex : troncature réinitialise le cumul ; ligne corrompue ignorée', async t => {
  const f = await fixture(t);
  await writeFile(f.file, lines(meta(), usage(100000, 20000), { type: 'turn_context', payload: { model: 'ancien-modele-assez-long' } }));
  assert.equal((await f.reader(codex)).tokens.input, 100000);
  await writeFile(f.file, lines(meta()) + '{illisible\n' + lines(usage(3, 1)));
  assert.equal((await f.reader(codex)).tokens.input, 3);
});

test('Aucune activité fabriquée pour absence ou outil non pris en charge', async t => {
  const f = await fixture(t);
  assert.equal(await f.reader(codex), null);
  assert.equal(await f.reader({ kind: 'Gemini', cwd }), null);
  assert.equal(await f.reader({ kind: 'Antigravity', cwd }), null);
});

test('OpenCode : compteurs cumulés SQLite, pas de doublon ancien/nouveau schéma, lecture seule', async t => {
  const f = await fixture(t);
  const file = join(f.openCodeRoot, 'opencode.db');
  const db = new DatabaseSync(file);
  const schema = '(id TEXT PRIMARY KEY,parent_id TEXT,directory TEXT,time_updated INTEGER,model TEXT,tokens_input INTEGER,tokens_output INTEGER,tokens_reasoning INTEGER,tokens_cache_read INTEGER,tokens_cache_write INTEGER)';
  db.exec('CREATE TABLE session ' + schema + '; CREATE TABLE session_v2 ' + schema + '; CREATE TABLE message (id TEXT PRIMARY KEY,session_id TEXT,time_updated INTEGER,data TEXT)');
  for (const table of ['session', 'session_v2']) db.prepare('INSERT INTO ' + table + ' VALUES (?,?,?,?,?,?,?,?,?,?)').run('SECRET_SESSION', null, cwd, 10, 'modele-sqlite', 80, 12, 9, 40, 5);
  db.prepare('INSERT INTO message VALUES (?,?,?,?)').run('SECRET_MESSAGE_ID', 'SECRET_SESSION', 10, JSON.stringify({ role: 'assistant', modelID: 'modele-sqlite', variant: 'high', content: 'SECRET_CONTENU', tokens: { input: 80, output: 12, reasoning: 9, cache: { read: 40, write: 5 } } }));
  db.close();
  const before = await readFile(file);
  const beforeStat = await stat(file);
  const result = await f.reader({ kind: 'OpenCode', cwd });
  assert.ok(result);
  assert.deepEqual(result.tokens, { input: 80, output: 21, cacheRead: 40, cacheCreation: 5 });
  assert.equal(result.model, 'modele-sqlite');
  assert.equal(result.effort, 'high');
  assert.deepEqual(result.limits, []);
  assert.doesNotMatch(JSON.stringify(result), /SECRET_|projet-factice|opencode\.db/);
  assert.deepEqual(await readFile(file), before);
  assert.equal((await stat(file)).mtimeMs, beforeStat.mtimeMs);
  assert.equal(await f.reader({ kind: 'OpenCode', cwd }, [{ kind: 'OpenCode', cwd }, { kind: 'OpenCode', cwd }]), null);
});

test('Codex : aucune relecture des octets deja traites', async t => {
  const f=await fixture(t);
  await writeFile(f.file,lines(meta(),usage(10,2)));
  await f.reader(codex);
  const previous=(await stat(f.file)).size;
  const original=fs.createReadStream;
  const calls=[];
  const mocked=t.mock.method(fs,'createReadStream',(path,options)=>{calls.push(options);return original(path,options);});
  syncBuiltinESMExports();
  try {
    await f.reader(codex);
    assert.equal(calls.length,0);
    await appendFile(f.file,lines(usage(20,4)));
    assert.equal((await f.reader(codex)).tokens.input,20);
    assert.equal(calls.length,1);
    assert.equal(calls[0].start,previous);
  } finally {mocked.mock.restore();syncBuiltinESMExports();}
});

test('OpenCode : les mises a jour du journal WAL invalident les compteurs caches', async t => {
  const f=await fixture(t);
  const db=new DatabaseSync(join(f.openCodeRoot,'opencode.db'));
  try {
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE session_v2 (id TEXT PRIMARY KEY,directory TEXT,time_updated INTEGER,tokens_input INTEGER,tokens_output INTEGER,tokens_reasoning INTEGER,tokens_cache_read INTEGER,tokens_cache_write INTEGER);');
    db.prepare('INSERT INTO session_v2 VALUES (?,?,?,?,?,?,?,?)').run('session-privee',cwd,1,10,2,1,3,0);
    const agent={kind:'OpenCode',cwd};
    assert.equal((await f.reader(agent)).tokens.output,3);
    db.exec('UPDATE session_v2 SET tokens_output=8,time_updated=2');
    assert.equal((await f.reader(agent)).tokens.output,9);
  } finally {db.close();}
});

test('Codex : deux journaux du meme dossier aussi recents restent ambigus', async t => {
  const f=await fixture(t);
  const other=join(f.codexRoot,'2026','10','rollout-egal.jsonl');
  await writeFile(f.file,lines(meta(),usage(10,2)));
  await writeFile(other,lines(meta(),usage(20,4)));
  const {utimes}=await import('node:fs/promises');
  await utimes(f.file,new Date(1000),new Date(1000));
  await utimes(other,new Date(1000),new Date(1000));
  assert.equal(await f.reader(codex),null);
});

const spawn = (callId, taskName, message) => ({ type: 'response_item', payload: { type: 'function_call', name: 'spawn_agent', call_id: callId, arguments: JSON.stringify({ task_name: taskName, fork_turns: 0, message }) } });
const subEvent = (kind, callId, thread, path) => ({ type: 'event_msg', payload: { type: 'item_completed', item: { type: 'SubAgentActivity', id: callId, kind, agent_thread_id: thread, agent_path: path } } });

test('Codex : pause de quota, resetsAt en secondes et limitReached', async t => {
  const f = await fixture(t);
  const plein = usage(10, 2);
  plein.payload.rate_limits = {
    primary: { used_percent: 100, window_minutes: 300, resets_at: 1792208254 },
    secondary: { used_percent: 5, window_minutes: 10080, resets_at: 1792672627 },
    rate_limit_reached_type: null,
  };
  await writeFile(f.file, lines(meta(), plein));
  const result = await f.reader(codex);
  assert.equal(result.limitReached, true, 'une limite à 100 % compte comme atteinte');
  assert.equal(result.limits[0].resetsAt, new Date(1792208254 * 1000).toISOString());
  const atteint = usage(11, 3);
  atteint.payload.rate_limits = {
    primary: { used_percent: 12, window_minutes: 300, resets_at: 1792208254 },
    secondary: { used_percent: 25, window_minutes: 10080, resets_at: 1792672627 },
    rate_limit_reached_type: 'primary',
  };
  await appendFile(f.file, lines(atteint));
  const suite = await f.reader(codex);
  assert.equal(suite.limitReached, true, 'rate_limit_reached_type non nul compte comme atteint');
  const sans = usage(12, 4);
  sans.payload.rate_limits = { primary: { used_percent: 12, window_minutes: 300 }, secondary: { used_percent: 25, window_minutes: 10080 }, rate_limit_reached_type: null };
  await appendFile(f.file, lines(sans));
  const fin = await f.reader(codex);
  assert.equal(fin.limitReached, false);
  assert.equal(fin.limits[0].resetsAt, null, 'resets_at absent donne null');
});

test('Codex : sous-agents démarrés et pas encore terminés, message chiffré jamais lu', async t => {
  const f = await fixture(t);
  await writeFile(f.file, lines(meta(),
    spawn('call_1', 'formats_locaux', 'CONTENU_CHIFFRE'),
    subEvent('started', 'call_1', 'thread-1', '/root/formats_locaux'),
    spawn('call_2', 'deuxieme_tache', 'AUTRE_CHIFFRE'),
    subEvent('started', 'call_2', 'thread-2', '/root/deuxieme_tache'),
    subEvent('interacted', 'call_1', 'thread-1', '/root'),
    subEvent('started', 'call_sans_nom', 'thread-3', '/root/outil_de_fond'),
    subEvent('completed', 'call_x', 'thread-4', '/root/jamais_vu'),
    subEvent('completed', 'call_2', 'thread-2', '/root/deuxieme_tache')));
  const result = await f.reader(codex);
  assert.deepEqual(result.subagents, [
    { id: 'thread-1', description: 'formats locaux' },
    { id: 'thread-3', description: 'outil de fond' },
  ]);
  const texte = JSON.stringify(result);
  assert.ok(!texte.includes('CONTENU_CHIFFRE'), 'le message chiffré ne doit jamais sortir');
  assert.ok(!texte.includes('AUTRE_CHIFFRE'), 'le message chiffré ne doit jamais sortir');
  await appendFile(f.file, lines(subEvent('completed', 'call_1', 'thread-1', '/root/formats_locaux')));
  assert.deepEqual((await f.reader(codex)).subagents, [{ id: 'thread-3', description: 'outil de fond' }]);
});

test('Codex : un appel spawn_agent illisible n\'est pas une observation', async t => {
  const f = await fixture(t);
  await writeFile(f.file, lines(meta(), usage(10, 2),
    { type: 'response_item', payload: { type: 'function_call', name: 'spawn_agent', call_id: 'call_casse', arguments: '{casse' } }));
  const result = await f.reader(codex);
  assert.equal('subagents' in result, false);
});
