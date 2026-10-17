import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseBlackboard,readBlackboard} from '../src/blackboard.mjs';

test('le tableau retient la dernière section du relais, les cases ouvertes, les rôles et les leçons récentes', () => {
  const board=parseBlackboard({
    'HANDOFF.md':'# Reprise\n## Contexte et architecture\n- ignoré\n## Étape 1\n- ancien\n## Étape 2\n- **nouveau** point\n- voir `src/x.mjs`\n## Préparation à la publication\n- plus tard\n',
    'TODO.md':'## A\n- [x] fait\n- [ ] reste à faire\n- [X] fait aussi\n',
    'AGENTS.md':'## Rôles\n- Le chef coordonne.\n- Les agents exécutent.\n## Sécurité\n- autre\n',
    'LESSONS.md':'# Leçons\n- L1\n- L2\n- L3\n- L4\n- L5\n- L6\n',
  });
  assert.deepEqual(board.focus,{source:'HANDOFF.md',title:'Étape 2',items:['nouveau point','voir src/x.mjs']});
  assert.deepEqual(board.todo,{source:'TODO.md',done:2,total:3,remaining:['reste à faire']});
  assert.deepEqual(board.roles.items,['Le chef coordonne.','Les agents exécutent.']);
  assert.deepEqual(board.lessons,{source:'LESSONS.md',total:6,latest:['L6','L5','L4','L3','L2']});
});

test('chemins personnels et identifiants sont masqués', () => {
  const board=parseBlackboard({'LESSONS.md':'- Fichier C:\\Users\\Moi\\secret.txt et /Users/moi/x, session 12345678-1234-1234-1234-123456789abc\n'});
  const text=board.lessons.latest[0];
  assert.doesNotMatch(text,/Moi|moi\/x|12345678-/);
  assert.match(text,/\[chemin masqué\].*\[chemin masqué\].*\[identifiant masqué\]/);
});

test('lecture sur disque : fichiers absents ignorés, dates de modification fournies', async t => {
  const root=await mkdtemp(join(tmpdir(),'tableau-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(join(root,'TODO.md'),'- [ ] une tâche\n');
  const board=await readBlackboard({root});
  assert.deepEqual(board.todo.remaining,['une tâche']);
  assert.deepEqual(board.files.map(f=>f.name),['TODO.md']);
  assert.ok(!Number.isNaN(Date.parse(board.files[0].modified)));
  assert.equal(board.focus,undefined);
});
