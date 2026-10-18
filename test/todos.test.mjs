import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, appendFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTodosReader } from '../src/todos.mjs';

const cwd = 'C:/projet-factice';
const sid = '12345678-abcd-abcd-abcd-123456789abc';
const jsonl = (...events) => events.map(value => JSON.stringify(value)).join('\n') + '\n';
const meta = directory => ({ type: 'session_meta', payload: { cwd: directory } });
const plan = steps => ({ type: 'response_item', payload: { type: 'function_call', name: 'update_plan', arguments: JSON.stringify({ plan: steps }) } });
const assistant = (...content) => ({ type: 'assistant', message: { content } });
const tool = (id, name, input) => ({ type: 'tool_use', id, name, input });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bureau-todos-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const projectRoot = join(root, 'projet');
  const claudeRoot = join(root, 'claude');
  const codexRoot = join(root, 'codex');
  await Promise.all([mkdir(join(projectRoot, 'docs'), { recursive: true }), mkdir(join(claudeRoot, 'dossier'), { recursive: true }), mkdir(join(codexRoot, '2026'), { recursive: true })]);
  return { projectRoot, claudeRoot, codexRoot, claudeFile: join(claudeRoot, 'dossier', sid + '.jsonl'), codexFile: join(codexRoot, '2026', 'rollout-factice.jsonl'), reader: createTodosReader({ projectRoot, claudeRoot, codexRoot }) };
}

test('TODO projet : cases réelles uniquement, sources sans chemins', async t => {
  const f = await fixture(t);
  await writeFile(join(f.projectRoot, 'TODO.md'), '# Liste\n- [ ] À faire\n- [x] Fait\nTexte ordinaire\n```md\n- [ ] Exemple ignoré\n```\n');
  await writeFile(join(f.projectRoot, 'docs', 'plan-validation.md'), '- [X] Vérifié\n~~~\n- [ ] Exemple ignoré aussi\n~~~\n');
  await writeFile(join(f.projectRoot, 'docs', 'autre.md'), '- [ ] Hors contrat\n');
  const result = await f.reader();
  assert.deepEqual(result.project, [{ text: 'À faire', done: false, source: 'TODO.md' }, { text: 'Fait', done: true, source: 'TODO.md' }, { text: 'Vérifié', done: true, source: 'plan-validation.md' }]);
  assert.deepEqual(result.agents, {});
});

test('TODO projet : plafond de 200 éléments et de 160 caractères Unicode', async t => {
  const f = await fixture(t);
  await writeFile(join(f.projectRoot, 'TODO.md'), '- [ ] ' + '😀'.repeat(180) + '\n' + Array.from({ length: 220 }, (_, i) => '- [ ] Étape ' + i).join('\n'));
  const result = await f.reader();
  assert.equal(result.project.length, 200);
  assert.equal(Array.from(result.project[0].text).length, 160);
  assert.equal(result.project[0].text, '😀'.repeat(160));
});

test('Codex : dernier plan du journal le plus récent et ajout relu', async t => {
  const f = await fixture(t);
  const agent = { id: 'codex-a', kind: 'Codex', cwd };
  await writeFile(f.codexFile, jsonl(meta(cwd), plan([{ step: 'Ancien', status: 'pending' }])));
  const recent = join(f.codexRoot, '2026', 'rollout-recent.jsonl');
  await writeFile(recent, jsonl(meta(cwd), plan([{ step: 'Premier', status: 'pending' }]), plan([{ step: 'Analyser', status: 'completed' }, { step: 'Vérifier', status: 'in_progress' }]), { type: 'response_item', payload: { content: 'SECRET_MESSAGE' } }));
  await utimes(f.codexFile, new Date(1000), new Date(1000));
  await utimes(recent, new Date(2000), new Date(2000));
  assert.deepEqual((await f.reader([agent])).agents, { 'codex-a': [{ text: 'Analyser', status: 'completed' }, { text: 'Vérifier', status: 'in_progress' }] });
  await appendFile(recent, jsonl(plan([{ step: 'Fin', status: 'completed' }])));
  const result = await f.reader([agent]);
  assert.deepEqual(result.agents['codex-a'], [{ text: 'Fin', status: 'completed' }]);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|rollout|sessionId|projet-factice/);
});

test('Codex : dossier partagé, mauvais dossier et journal absent sans rattachement', async t => {
  const f = await fixture(t);
  await writeFile(f.codexFile, jsonl(meta(cwd), plan([{ step: 'Tâche', status: 'pending' }])));
  assert.deepEqual((await f.reader([{ id: 'a', kind: 'Codex', cwd }, { id: 'b', kind: 'Codex', cwd }])).agents, {});
  assert.deepEqual((await f.reader([{ id: 'a', kind: 'Codex', cwd: 'C:/ailleurs' }, { id: 'b', kind: 'OpenCode', cwd }])).agents, {});
  assert.deepEqual((await f.reader([{ id: 'c', kind: 'Claude', sessionId: sid }])).agents, {});
});

test('Claude : TodoWrite exact, dernier état et liste vide explicite', async t => {
  const f = await fixture(t);
  const agent = { id: 'claude-a', kind: 'Claude', sessionId: sid };
  await writeFile(f.claudeFile, jsonl(assistant(tool('t1', 'TodoWrite', { todos: [{ content: 'Préparer', status: 'pending' }] })), assistant(tool('t2', 'TodoWrite', { todos: [{ content: 'Préparer', status: 'completed' }, { content: 'Tester', status: 'in_progress' }] }))));
  assert.deepEqual((await f.reader([agent])).agents['claude-a'], [{ text: 'Préparer', status: 'completed' }, { text: 'Tester', status: 'in_progress' }]);
  await appendFile(f.claudeFile, jsonl(assistant(tool('t3', 'TodoWrite', { todos: [] }))));
  assert.deepEqual((await f.reader([agent])).agents['claude-a'], []);
  assert.deepEqual((await f.reader([{ ...agent, sessionId: '../../secret' }])).agents, {});
});

test('Claude : une réécriture plus longue du transcript est relue depuis le début', async t => {
  const f = await fixture(t);
  const agent = { id: 'claude-a', kind: 'Claude', sessionId: sid };
  const cases = n => Array.from({ length: n }, (_, i) => ({ content: `Étape ${i + 1}`, status: 'pending' }));
  const todoWrite = (id, n) => jsonl(assistant(tool(id, 'TodoWrite', { todos: cases(n) })));
  await writeFile(f.claudeFile, todoWrite('t1', 10));
  assert.equal((await f.reader([agent])).agents['claude-a'].length, 10);
  // Même fichier, plus long, réécrit en une seule ligne : sans contrôle de
  // continuité l'ancien décalage reste au milieu de la ligne et la fin se perd.
  await writeFile(f.claudeFile, todoWrite('outil-long', 20));
  assert.equal((await f.reader([agent])).agents['claude-a'].length, 20);
});

test('Claude : TaskCreate lié au résultat puis TaskUpdate', async t => {
  const f = await fixture(t);
  const agent = { id: 'claude-a', kind: 'Claude', sessionId: sid };
  await writeFile(f.claudeFile, jsonl(assistant(tool('creation-1', 'TaskCreate', { subject: 'Tâche initiale', description: 'SECRET_DESCRIPTION' })), { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'creation-1', content: 'Task #1 created successfully: Tâche initiale' }] } }, assistant(tool('maj-1', 'TaskUpdate', { taskId: '1', subject: 'Tâche corrigée', status: 'in_progress' }))));
  assert.deepEqual((await f.reader([agent])).agents['claude-a'], [{ text: 'Tâche corrigée', status: 'in_progress' }]);
  await appendFile(f.claudeFile, jsonl(assistant(tool('maj-2', 'TaskUpdate', { taskId: '1', status: 'completed' }))));
  const result = await f.reader([agent]);
  assert.deepEqual(result.agents['claude-a'], [{ text: 'Tâche corrigée', status: 'completed' }]);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|creation-1|taskId|sessionId|jsonl/);
});

test('Journaux corrompus et absence de plan : aucun contenu de message exposé', async t => {
  const f = await fixture(t);
  await writeFile(f.codexFile, jsonl(meta(cwd), { type: 'response_item', payload: { type: 'function_call', name: 'update_plan', arguments: '{invalide' } }) + '{corrompu\n');
  await writeFile(f.claudeFile, jsonl({ type: 'user', message: { content: 'SECRET_MESSAGE' } }));
  assert.deepEqual((await f.reader([{ id: 'c', kind: 'Codex', cwd }, { id: 'a', kind: 'Claude', sessionId: sid }])).agents, {});
});
