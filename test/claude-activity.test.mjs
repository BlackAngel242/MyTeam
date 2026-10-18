import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { appendFile, mkdir, mkdtemp, open, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readClaudeActivity } from '../src/claude-activity.mjs';

const sessionId = '12345678-1234-1234-1234-123456789abc';
const assistant = (id, usage = {}, content = []) => ({ type: 'assistant', message: { id, usage, content } });
const jsonl = entries => entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';

async function fixture(t, entries = []) {
  const root = await mkdtemp(join(tmpdir(), 'claude-activity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'projet', 'session');
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${sessionId}.jsonl`);
  await writeFile(path, jsonl(entries));
  return { root, path };
}

test('additionne les quatre compteurs sans compter deux fois un message', async t => {
  const first = assistant('m1', { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 30, cache_creation_input_tokens: 4 });
  const { root } = await fixture(t, [first, first, assistant('m2', { input_tokens: 5, output_tokens: 3, cache_read_input_tokens: 7, cache_creation_input_tokens: 1 })]);
  const result = await readClaudeActivity(sessionId, { root });
  assert.deepEqual(result, { found: true, tokens: { input: 15, output: 5, cacheRead: 37, cacheCreation: 5 }, subagents: [] });
  result.tokens.input = 999;
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 15);
});

test('detecte Agent et Task puis retire seulement le sous-agent termine', async t => {
  const description = 'é'.repeat(90);
  const { root, path } = await fixture(t, [assistant('m1', {}, [
    { type: 'tool_use', id: 'a1', name: 'Agent', input: { description, prompt: 'SECRET' } },
    { type: 'tool_use', id: 'a2', name: 'Task', input: { description: 'Verifier les calculs' } },
    { type: 'tool_use', id: 'a3', name: 'Read', input: { description: 'Ne pas exposer' } },
    { type: 'text', text: 'MESSAGE PRIVE' },
  ])]);
  assert.deepEqual((await readClaudeActivity(sessionId, { root })).subagents, [
    { id: 'a1', description: 'é'.repeat(80) },
    { id: 'a2', description: 'Verifier les calculs' },
  ]);
  await appendFile(path, jsonl([{ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'a1', content: 'SECRET' }] } }]));
  const result = await readClaudeActivity(sessionId, { root });
  assert.deepEqual(result.subagents, [{ id: 'a2', description: 'Verifier les calculs' }]);
  assert.ok(!JSON.stringify(result).includes('SECRET'));
  assert.ok(!JSON.stringify(result).includes('MESSAGE PRIVE'));
  assert.ok(!JSON.stringify(result).includes(root));
});

test('refuse les identifiants invalides', async () => {
  for (const id of ['../secret', '', sessionId.toUpperCase(), null, 12]) {
    assert.deepEqual(await readClaudeActivity(id), { found: false });
  }
});

test('renvoie found:false si le fichier est absent', async t => {
  const { root } = await fixture(t);
  assert.deepEqual(await readClaudeActivity('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { root }), { found: false });
  assert.deepEqual(await readClaudeActivity(sessionId, { root: join(root, 'absent') }), { found: false });
});

test('ignore les lignes corrompues et les structures inattendues', async t => {
  const { root, path } = await fixture(t);
  await writeFile(path, 'illisible\nnull\n{}\n' + jsonl([assistant('m1', { input_tokens: 8 })]) + '{incomplet');
  assert.deepEqual((await readClaudeActivity(sessionId, { root })).tokens, { input: 8, output: 0, cacheRead: 0, cacheCreation: 0 });
});

test('invalide le cache quand seule la date de modification change', async t => {
  const { root, path } = await fixture(t, [assistant('m1', { input_tokens: 1 })]);
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 1);
  await writeFile(path, jsonl([assistant('m1', { input_tokens: 2 })]));
  const future = new Date(Date.now() + 10000);
  await utimes(path, future, future);
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 2);
});

test('ne suit pas les liens vers un fichier ou un dossier', async t => {
  const { root, path } = await fixture(t, [assistant('m1', { input_tokens: 9 })]);
  const linkedRoot = join(root, 'liens');
  await mkdir(linkedRoot);
  try {
    await symlink(join(root, 'projet'), join(linkedRoot, 'projet'), process.platform === 'win32' ? 'junction' : 'dir');
    await symlink(path, join(linkedRoot, `${sessionId}.jsonl`), 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('Creation de liens non autorisee sur ce poste');
    throw error;
  }
  assert.deepEqual(await readClaudeActivity(sessionId, { root: linkedRoot }), { found: false });
});

test('ne lit pas les messages au-dela du plafond de 50 Mo', async t => {
  const { root, path } = await fixture(t);
  const first = jsonl([assistant('m1', { input_tokens: 3 })]);
  await writeFile(path, first);
  const block = 'x'.repeat(1023) + '\n';
  let remaining = 50 * 1024 * 1024 - Buffer.byteLength(first);
  const chunk = block.repeat(1024);
  while (remaining >= chunk.length) {
    await appendFile(path, chunk);
    remaining -= chunk.length;
  }
  await appendFile(path, 'x'.repeat(Math.max(0, remaining - 1)) + '\n');
  await appendFile(path, jsonl([assistant('m2', { input_tokens: 100 })]));
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 3);
});

for (const name of ['Agent', 'Task']) {
  for (const status of ['completed', 'failed', 'killed', 'cancelled']) {
    test(`${name} en arriere-plan reste actif jusqu'a ${status}`, async t => {
      const { root, path } = await fixture(t, [assistant('m1', {}, [
        { type: 'tool_use', id: 'async-1', name, input: { description: 'Recherche', run_in_background: true } },
      ]), { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'async-1', content: [{ type: 'text', text: 'Async agent launched successfully.' }] }] } }]);
      assert.deepEqual((await readClaudeActivity(sessionId, { root })).subagents, [{ id: 'async-1', description: 'Recherche' }]);
      await appendFile(path, jsonl([{ type: 'user', message: { content: '<tool-use-id>autre</tool-use-id><status>completed</status>' } }]));
      assert.equal((await readClaudeActivity(sessionId, { root })).subagents.length, 1);
      await appendFile(path, jsonl([{ type: 'user', message: { content: [{ type: 'text', text: `<task-notification><tool-use-id>async-1</tool-use-id><status>${status}</status></task-notification>` }] } }]));
      assert.deepEqual((await readClaudeActivity(sessionId, { root })).subagents, []);
    });
  }
}

test('un sous-agent en attente de son propre travail reste actif, puis finit par son identifiant de tâche', async t => {
  const { root, path } = await fixture(t, [assistant('m1', {}, [
    { type: 'tool_use', id: 'async-2', name: 'Agent', input: { description: 'Témoin', run_in_background: true } },
  ]), { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'async-2', content: [{ type: 'text', text: 'Async agent launched successfully.\nagentId: a008adb6c12e82af0 (internal ID)' }] }] } }]);
  await appendFile(path, jsonl([{ type: 'user', message: { content: '<task-notification><task-id>a008adb6c12e82af0</task-id><tool-use-id>async-2</tool-use-id><status>completed</status><summary>is waiting on its own background work</summary><note>This agent stopped with background work of its own still running.</note></task-notification>' } }]));
  assert.equal((await readClaudeActivity(sessionId, { root })).subagents.length, 1);
  await appendFile(path, jsonl([{ type: 'user', message: { content: '<task-notification><task-id>a008adb6c12e82af0</task-id><status>completed</status><summary>finished</summary></task-notification>' } }]));
  assert.deepEqual((await readClaudeActivity(sessionId, { root })).subagents, []);
});

test('un resultat ordinaire termine aussi un appel marque en arriere-plan', async t => {
  const { root } = await fixture(t, [assistant('m1', {}, [
    { type: 'tool_use', id: 'a1', name: 'Agent', input: { run_in_background: true } },
  ]), { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'a1', content: 'Fini' }] } }]);
  assert.deepEqual((await readClaudeActivity(sessionId, { root })).subagents, []);
});

test('une ligne incomplete est reprise, meme entre deux octets UTF-8', async t => {
  const { root, path } = await fixture(t, [assistant('m1', { input_tokens: 3 })]);
  const next = Buffer.from(jsonl([assistant('m2', { output_tokens: 7 }, [{ type: 'tool_use', id: 'a1', name: 'Task', input: { description: 'équipe' } }])]));
  const split = next.indexOf(Buffer.from('é')) + 1;
  await appendFile(path, next.subarray(0, split));
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.output, 0);
  await appendFile(path, next.subarray(split));
  const result = await readClaudeActivity(sessionId, { root });
  assert.equal(result.tokens.input, 3);
  assert.equal(result.tokens.output, 7);
  assert.equal(result.subagents[0].description, 'équipe');
});

test('un JSON complet sans retour a la ligne attend la suite', async t => {
  const { root, path } = await fixture(t);
  await writeFile(path, JSON.stringify(assistant('m1', { input_tokens: 6 })));
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 0);
  await appendFile(path, '\n');
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 6);
});

test('lit seulement les octets ajoutes et conserve les identifiants comptes', async t => {
  const { root, path } = await fixture(t, [assistant('m1', { input_tokens: 3 })]);
  await readClaudeActivity(sessionId, { root });
  const file = await open(path, 'r+');
  try { await file.write(Buffer.from(jsonl([assistant('m1', { input_tokens: 9 })])), 0, undefined, 0); }
  finally { await file.close(); }
  await appendFile(path, jsonl([assistant('m1', { input_tokens: 3 }), assistant('m2', { input_tokens: 2 })]));
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 5);
});

test('repart de zero apres troncature, sans garder la ligne partielle', async t => {
  const { root, path } = await fixture(t, [assistant('long-identifiant', { input_tokens: 100 })]);
  await appendFile(path, '{partiel');
  await readClaudeActivity(sessionId, { root });
  await writeFile(path, jsonl([assistant('m2', { input_tokens: 1 })]));
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 1);
});

test('une reecriture plus longue du meme transcript est relue depuis le debut', async t => {
  const { root, path } = await fixture(t, Array.from({ length: 10 }, (_, i) => assistant(`msg${String(i + 1).padStart(2, '0')}`, { input_tokens: 1 })));
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 10);
  // Meme fichier, plus long, reecrit en une seule ligne : sans controle de
  // continuite l'ancien decalage reste en milieu de ligne et la fin se perd.
  await writeFile(path, jsonl([{
    type: 'assistant',
    message: { id: 'agent-unique', usage: { input_tokens: 20 }, content: [{ type: 'text', text: 'mot '.repeat(400) }] },
  }]));
  const result = await readClaudeActivity(sessionId, { root });
  assert.equal(result.tokens.input, 20);
  assert.deepEqual(result.subagents, []);
});

test('un fichier tronque puis reecrit plus court est aussi relu depuis le debut', async t => {
  const { root, path } = await fixture(t, Array.from({ length: 6 }, (_, i) => assistant(`ancien-${i}`, { input_tokens: 5 })));
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 30);
  await writeFile(path, jsonl([assistant('m2', { input_tokens: 4 })]));
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 4);
});

test('un simple ajout en fin de fichier reste lu de facon incrementale', async t => {
  const { root, path } = await fixture(t, [assistant('m1', { input_tokens: 3 })]);
  await readClaudeActivity(sessionId, { root });
  const dejaLu = (await stat(path)).size;
  const original = fs.createReadStream;
  const lectures = [];
  const mocked = t.mock.method(fs, 'createReadStream', (chemin, options) => {
    lectures.push({ ...options });
    return original(chemin, options);
  });
  syncBuiltinESMExports();
  try {
    await appendFile(path, jsonl([assistant('m2', { input_tokens: 2 })]));
    const result = await readClaudeActivity(sessionId, { root });
    assert.equal(result.tokens.input, 5);
    // Une seule lecture de contenu, reprise exactement a l'ancien offset.
    assert.equal(lectures.length, 1);
    assert.equal(lectures[0].start, dejaLu);
  } finally {
    mocked.mock.restore();
    syncBuiltinESMExports();
  }
});

test('des lectures simultanees ne comptent pas deux fois les nouveaux messages', async t => {
  const { root, path } = await fixture(t, [assistant('m1', { input_tokens: 3 })]);
  await readClaudeActivity(sessionId, { root });
  await appendFile(path, jsonl([assistant('m2', { input_tokens: 2 })]));
  const results = await Promise.all(Array.from({ length: 10 }, () => readClaudeActivity(sessionId, { root })));
  assert.ok(results.every(result => result.tokens.input === 5));
  results[0].tokens.input = 99;
  assert.equal(results[1].tokens.input, 5);
});
