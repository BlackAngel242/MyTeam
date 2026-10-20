import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolveProject,projectContains,scopedBridge,projectStateDir} from '../src/projects.mjs';

async function setup(t){const dir=await mkdtemp(join(tmpdir(),'myteam-project-'));t.after(()=>rm(dir,{recursive:true,force:true}));for(const d of ['myteam','projects','projects/a','projects/ab','outside'])await mkdir(join(dir,d),{recursive:true});return {dir,myteam:join(dir,'myteam'),places:{home:join(dir,'projects')}};}
test('projets : résolution explicite, refus traversée, absolu et dossier manquant',async t=>{
  const {myteam,places}=await setup(t);
  assert.equal((await resolveProject({mode:'myteam'},places,myteam)).root,myteam);
  assert.equal((await resolveProject({mode:'project',place:'home',path:'a'},places,myteam)).root,join(places.home,'a'));
  for(const selection of [{mode:'x'},...['','.','./','././'].map(path=>({mode:'project',place:'home',path})),{mode:'project',place:'inconnu',path:'a'},{mode:'project',place:'home',path:'../outside'},{mode:'project',place:'home',path:myteam},{mode:'project',place:'home',path:'absent'}])await assert.rejects(resolveProject(selection,places,myteam));
});
test('projets : symlink sortant refusé, préfixe voisin exclu et état hors projet',async t=>{
  const {dir,myteam,places}=await setup(t);try{await symlink(join(dir,'outside'),join(places.home,'link'),'junction');}catch(e){if(e.code==='EPERM'){t.skip('symlinks indisponibles');return;}throw e;}
  await assert.rejects(resolveProject({mode:'project',place:'home',path:'link'},places,myteam));
  assert.equal(await projectContains(join(places.home,'a'),join(places.home,'ab')),false);
  assert.equal(await projectContains(join(places.home,'a'),join(places.home,'a')),true);
  assert.notEqual(projectStateDir(join(dir,'data'),myteam),projectStateDir(join(dir,'data'),places.home));
  assert.ok(projectStateDir(join(dir,'data'),myteam).startsWith(join(dir,'data')));
});
test('projets : filtrage à chaque commande, changement de dossier et désactivation',async t=>{
  const {places}=await setup(t);let agents=[{id:'a',cwd:join(places.home,'a')},{id:'b',cwd:join(places.home,'ab')}];const sent=[];
  const base={list:async()=>agents,prompt:async(id,message)=>{sent.push(id);return{ok:true};},read:async()=>({text:'exemple'}),interrupt:async()=>({requested:true})};
  const bridge=scopedBridge(base,join(places.home,'a'));
  assert.deepEqual((await bridge.list()).map(x=>x.id),['a']);
  await assert.rejects(bridge.prompt('b','x'));assert.deepEqual(sent,[]);
  await bridge.prompt('a','x');assert.deepEqual(sent,['a']);
  agents[0].cwd=join(places.home,'ab');await assert.rejects(bridge.prompt('a','x'));
  agents[0].cwd=join(places.home,'a');await bridge.deactivate();assert.deepEqual(await bridge.list(),[]);await assert.rejects(bridge.prompt('a','x'));
});
test('projets : désactivation attend une commande déjà engagée et bloque les suivantes',async t=>{
  const {places}=await setup(t);let release;const pending=new Promise(r=>release=r);let began;const started=new Promise(r=>began=r);
  const bridge=scopedBridge({list:async()=>[{id:'a',cwd:join(places.home,'a')}],prompt:async()=>{began();await pending;}},join(places.home,'a'));
  const first=bridge.prompt('a','x');await started;let stopped=false;const stop=bridge.deactivate().then(()=>stopped=true);await Promise.resolve();assert.equal(stopped,false);await assert.rejects(bridge.prompt('a','y'));release();await first;await stop;assert.equal(stopped,true);
});
