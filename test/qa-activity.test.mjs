import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { appendFile, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { readClaudeActivity } from '../src/claude-activity.mjs';

const sessionId = '12345678-1234-1234-1234-123456789abc';
const line = (id, input = 1) => JSON.stringify({ type: 'assistant', message: { id, usage: { input_tokens: input }, content: [] } }) + '\n';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'claude-qa-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, path: join(root, `${sessionId}.jsonl`) };
}

function watchReads(t, implementation) {
  const original = fs.createReadStream;
  const calls = [];
  const mocked = t.mock.method(fs, 'createReadStream', (path, options) => {
    calls.push({ path, ...options });
    return implementation ? implementation(path, options, original) : original(path, options);
  });
  syncBuiltinESMExports();
  return { calls, restore() { mocked.mock.restore(); syncBuiltinESMExports(); } };
}

test('M1 saute une ligne geante et poursuit les messages suivants', async t => {
  const { root, path } = await fixture(t);
  await writeFile(path, line('m1', 3) + 'x'.repeat(5 * 1024 * 1024) + '\n' + line('m2', 7));
  const watcher = watchReads(t);
  try {
    const result = await readClaudeActivity(sessionId, { root });
    assert.equal(result.found, true);
    assert.equal(result.tokens.input, 10);
    await readClaudeActivity(sessionId, { root });
    assert.equal(watcher.calls.length, 1);
    await appendFile(path, line('m3', 2));
    assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 12);
    assert.ok(watcher.calls[1].start > 5 * 1024 * 1024);
  } finally { watcher.restore(); }
});

test('M1 memorise le saut dune ligne geante encore incomplete', async t => {
  const { root, path } = await fixture(t);
  await writeFile(path, line('m1', 4) + 'x'.repeat(5 * 1024 * 1024));
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 4);
  await appendFile(path, 'fin\n' + line('m2', 6));
  assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 10);
});

test('M1 borne les identifiants sans approximation et memorise le fichier epuise', async t => {
  const { root, path } = await fixture(t);
  await writeFile(path, Array.from({ length: 50001 }, (_, i) => line(`m${i}`)).join(''));
  const watcher = watchReads(t);
  try {
    assert.deepEqual(await readClaudeActivity(sessionId, { root }), { found: false });
    const reads = watcher.calls.length;
    for (let i = 0; i < 3; i++) {
      await appendFile(path, line(`suite${i}`));
      assert.deepEqual(await readClaudeActivity(sessionId, { root }), { found: false });
    }
    const future = new Date(Date.now() + 10000);
    await utimes(path, future, future);
    assert.deepEqual(await readClaudeActivity(sessionId, { root }), { found: false });
    assert.equal(watcher.calls.length, reads);
    await writeFile(path, line('nouveau', 9));
    assert.equal((await readClaudeActivity(sessionId, { root })).tokens.input, 9);
    assert.equal(watcher.calls.length, reads + 1);
  } finally { watcher.restore(); }
});

test('M1 une erreur de flux est memorisee sans relecture a chaque sondage', async t => {
  const { root, path } = await fixture(t);
  await writeFile(path, line('m1'));
  let fail = true;
  const watcher = watchReads(t, (path, options, original) => fail
    ? Readable.from((async function* () { throw new Error('Erreur disque simulee'); })())
    : original(path, options));
  try {
    assert.deepEqual(await readClaudeActivity(sessionId, { root }), { found: false });
    fail = false;
    await appendFile(path, line('m2'));
    assert.deepEqual(await readClaudeActivity(sessionId, { root }), { found: false });
    assert.equal(watcher.calls.length, 1);
  } finally { watcher.restore(); }
});

test('M2 trente-deux chemins et leurs etats restent ensemble en cache', async t => {
  const { root } = await fixture(t);
  const ids = Array.from({ length: 32 }, (_, i) => `${i.toString(16).padStart(8, '0')}-1234-1234-1234-123456789abc`);
  for (const id of ids) {
    await writeFile(join(root, `${id}.jsonl`), line('m1', 3));
    assert.equal((await readClaudeActivity(id, { root })).tokens.input, 3);
  }
  const watcher = watchReads(t);
  try {
    for (const id of ids) assert.equal((await readClaudeActivity(id, { root })).tokens.input, 3);
    assert.equal(watcher.calls.length, 0);
  } finally { watcher.restore(); }
});
