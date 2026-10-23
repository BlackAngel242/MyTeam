// T3 (F2) : deux OpenCode dans deux panneaux = deux agents distincts.
// Reproduction (T3-A, T3-B, T3-D) + correction C3 option B (T3-C). Preuves par fichier et ligne.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeAgent } from '../src/herdr.mjs';
import { createAgentActivityReader } from '../src/agent-activity.mjs';

const dossier = 'C:/projet-commun';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 't3-opencode-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const codexRoot = join(root, 'codex');
  const openCodeRoot = join(root, 'opencode');
  await mkdir(codexRoot, { recursive: true });
  await mkdir(openCodeRoot);
  const reader = createAgentActivityReader({ codexRoot, openCodeRoot });
  return { root, openCodeRoot, reader };
}

// Deux panneaux OpenCode : terminal et panneau differents, meme dossier.
const panneauA = { pane_id: 'w5:p1', terminal_id: 'term_A', agent: 'opencode', agent_status: 'idle', cwd: dossier };
const panneauB = { pane_id: 'w5:p2', terminal_id: 'term_B', agent: 'opencode', agent_status: 'working', cwd: dossier };

test('T3-A : identites Herdr distinctes (pane_id different)', () => {
  const a = normalizeAgent(panneauA);
  const b = normalizeAgent(panneauB);
  // src/herdr.mjs ligne 41 : id = `${pane_id}@${fingerprint}`. Le pane_id
  // differe, donc les identites sont distinctes meme si l'empreinte est la meme.
  assert.notEqual(a.id, b.id, 'deux panneaux differents doivent avoir deux id differents');
  assert.equal(a.kind, 'OpenCode');
  assert.equal(b.kind, 'OpenCode');
  // OpenCode n'expose pas de sessionId (src/herdr.mjs ligne 44 : seul Claude).
  assert.equal(Object.hasOwn(a, 'sessionId'), false);
  assert.equal(Object.hasOwn(b, 'sessionId'), false);
});

test('T3-B : les deux dans la liste, meme dossier => aucune activite (garde)', async t => {
  const f = await fixture(t);
  const db = new DatabaseSync(join(f.openCodeRoot, 'opencode.db'));
  const schema = '(id TEXT PRIMARY KEY,parent_id TEXT,directory TEXT,time_updated INTEGER,model TEXT,tokens_input INTEGER,tokens_output INTEGER,tokens_reasoning INTEGER,tokens_cache_read INTEGER,tokens_cache_write INTEGER)';
  db.exec('CREATE TABLE session_v2 ' + schema + ';');
  db.prepare('INSERT INTO session_v2 VALUES (?,?,?,?,?,?,?,?,?,?)').run('session-A', null, dossier, 100, 'modele-a', 10, 1, 0, 0, 0);
  db.prepare('INSERT INTO session_v2 VALUES (?,?,?,?,?,?,?,?,?,?)').run('session-B', null, dossier, 200, 'modele-b', 999, 999, 0, 0, 0);
  db.close();
  const agents = [{ kind: 'OpenCode', cwd: dossier }, { kind: 'OpenCode', cwd: dossier }];
  // src/agent-activity.mjs ligne 309 : si plus d'un agent du meme genre dans le
  // meme dossier, retourne null. Comportement sur, mais aucune activite n'est
  // visible pour aucun des deux.
  assert.equal(await f.reader(agents[0], agents), null);
  assert.equal(await f.reader(agents[1], agents), null);
});

test('T3-C : un seul dans la liste mais deux sessions en base => activite non attribuable (option B)', async t => {
  const f = await fixture(t);
  const db = new DatabaseSync(join(f.openCodeRoot, 'opencode.db'));
  const schema = '(id TEXT PRIMARY KEY,parent_id TEXT,directory TEXT,time_updated INTEGER,model TEXT,tokens_input INTEGER,tokens_output INTEGER,tokens_reasoning INTEGER,tokens_cache_read INTEGER,tokens_cache_write INTEGER)';
  db.exec('CREATE TABLE session_v2 ' + schema + ';');
  // Session du panneau A, ancienne (time_updated=100), peu de tokens.
  db.prepare('INSERT INTO session_v2 VALUES (?,?,?,?,?,?,?,?,?,?)').run('session-A', null, dossier, 100, 'modele-a', 10, 1, 0, 0, 0);
  // Session du panneau B, recente (time_updated=200), beaucoup de tokens.
  db.prepare('INSERT INTO session_v2 VALUES (?,?,?,?,?,?,?,?,?,?)').run('session-B', null, dossier, 200, 'modele-b', 999, 888, 0, 0, 0);
  db.close();
  // Un seul OpenCode dans la liste (l'autre a ete filtre par allowAgent ou le
  // contexte projet). La garde de la ligne 309 passe (length === 1).
  const unSeul = [{ kind: 'OpenCode', cwd: dossier }];
  const activite = await f.reader(unSeul[0], unSeul);
  // Option B (docs/phase-correction-f2.md) : aucun chiffre, motif explicite.
  assert.ok(activite, 'un etat est retourne');
  assert.equal(activite.match, 'activité non attribuable');
  assert.equal(activite.tokens, null, 'aucun chiffre de tokens');
  assert.equal(activite.model, null, 'aucun modele');
  assert.equal(activite.effort, null, 'aucun effort');
});

test('T3-D : horodatages identiques => null (seule egalite exacte protege)', async t => {
  const f = await fixture(t);
  const db = new DatabaseSync(join(f.openCodeRoot, 'opencode.db'));
  const schema = '(id TEXT PRIMARY KEY,parent_id TEXT,directory TEXT,time_updated INTEGER,model TEXT,tokens_input INTEGER,tokens_output INTEGER,tokens_reasoning INTEGER,tokens_cache_read INTEGER,tokens_cache_write INTEGER)';
  db.exec('CREATE TABLE session_v2 ' + schema + ';');
  db.prepare('INSERT INTO session_v2 VALUES (?,?,?,?,?,?,?,?,?,?)').run('session-A', null, dossier, 150, 'modele-a', 10, 1, 0, 0, 0);
  db.prepare('INSERT INTO session_v2 VALUES (?,?,?,?,?,?,?,?,?,?)').run('session-B', null, dossier, 150, 'modele-b', 999, 999, 0, 0, 0);
  db.close();
  const unSeul = [{ kind: 'OpenCode', cwd: dossier }];
  // src/agent-activity.mjs : egalite exacte d'horodatage => null (garde conservee).
  // Horodatages differents => activite non attribuable (voir T3-C, option B).
  assert.equal(await f.reader(unSeul[0], unSeul), null);
});
