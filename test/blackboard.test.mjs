import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,symlink} from 'node:fs/promises';
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

test('chemins Unix, dossier personnel, empreintes et digests sont masqués (revue D1 d\'OpenCode)', () => {
  const ligne='- voir ~/.herdr/packages/x.exe et /root/.ssh/id et /etc/passwd et `/workspace/projet/src/a.mjs`, agent w5:p1@d234f56741fc0479, hash e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855, panneau w5:p1, 12 h/24 h\n';
  const text=parseBlackboard({'LESSONS.md':ligne}).lessons.latest[0];
  assert.doesNotMatch(text,/herdr\/packages|\.ssh|passwd|workspace|d234f567|e3b0c442/);
  assert.match(text,/panneau w5:p1/);
  assert.match(text,/12 h\/24 h/);
});

test('un lien symbolique nommé comme un pilier n\'est jamais lu (revue D2 d\'OpenCode)', async t => {
  const root=await mkdtemp(join(tmpdir(),'tableau-lien-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(join(root,'secret.txt'),'- [ ] SECRET\n');
  try{await symlink(join(root,'secret.txt'),join(root,'TODO.md'));}catch{t.skip('liens symboliques interdits sur ce poste');return;}
  const board=await readBlackboard({root});
  assert.equal(board.todo,undefined);
  assert.deepEqual(board.files,[]);
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
