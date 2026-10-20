import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProjectServer} from '../src/project-server.mjs';
import {createBureauServer} from '../server.mjs';
test('startup gates APIs, validates selection, isolates projects and persists outside checkout',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'myteam-project-'));let server;
 try{
 const home=join(temp,'home'),myteam=join(temp,'myteam'),dataRoot=join(temp,'data');await Promise.all([mkdir(join(home,'a'),{recursive:true}),mkdir(join(home,'b'),{recursive:true}),mkdir(myteam)]);
 const sent=[];const bridge={list:async()=>[{id:'a',cwd:join(home,'a'),kind:'Codex',status:'idle',ready:true},{id:'b',cwd:join(home,'b'),kind:'Codex',status:'idle',ready:true}],prompt:async(id)=>{sent.push(id);return{};}};
 server=await createProjectServer({createBureauServer,myteamRoot:myteam,dataRoot,places:{home},bridge,startTimers:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+'/api/state')).status,409);assert.match(await(await fetch(base)).text(),/Améliorer MyTeam/);
 await writeFile(join(home,'a','TODO.md'),'- [ ] EXTERNAL_PROJECT_TASK\n');
 const state=await(await fetch(base+'/api/projet')).json();
 const choose=body=>fetch(base+'/api/projet',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-MyTeam-Token':state.token},body:JSON.stringify(body)});
 assert.equal((await fetch(base+'/api/projet',{method:'POST',body:'{}'})).status,403);
 assert.equal((await choose({mode:'project',place:'home',path:'../'})).status,400);
 assert.equal((await choose({mode:'project',place:'home',path:'a'})).status,200);
 assert.deepEqual((await server.context.bridge.list()).map(a=>a.id),['a']);
 const bureauState=await(await fetch(base+'/api/state')).json();
 const todos=await(await fetch(base+'/api/todos',{headers:{Origin:base,'X-Bureau-Token':bureauState.token}})).text();
 assert.match(todos,/EXTERNAL_PROJECT_TASK/);
const first=server.context.stateDir,old=server.context.bridge;
 assert.equal((await choose({mode:'project',place:'home',path:'b'})).status,200);assert.notEqual(first,server.context.stateDir);
 await assert.rejects(old.prompt('a','test'));
 assert.deepEqual((await server.context.bridge.list()).map(a=>a.id),['b']);assert.deepEqual(sent,[]);
 assert.equal(JSON.parse(await readFile(join(dataRoot,'project.json'),'utf8')).path,'b');
 }finally{if(server)await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
});

async function scopedServer(t,{readTerminal}={}){
 const temp=await mkdtemp(join(tmpdir(),'myteam-read-scope-'));
 const home=join(temp,'home'),myteam=join(temp,'myteam');
 await Promise.all([mkdir(join(home,'a'),{recursive:true}),mkdir(join(home,'b'),{recursive:true}),mkdir(myteam)]);
 let directory=join(home,'a'),lists=0;
 const bridge={list:async()=>{lists++;return[{id:'agent',cwd:directory,kind:'Claude',status:'idle',ready:true,paneId:'w1:p1'}];}};
 const server=await createProjectServer({createBureauServer,myteamRoot:myteam,dataRoot:join(temp,'data'),places:{home},bridge,readTerminal,startTimers:false});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});});
 const origin=`http://127.0.0.1:${server.address().port}`,{token}=await(await fetch(origin+'/api/projet')).json();
 const choose=path=>fetch(origin+'/api/projet',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-MyTeam-Token':token},body:JSON.stringify({mode:'project',place:'home',path})});
 assert.equal((await choose('a')).status,200);
 return{server,choose,move:path=>{directory=join(home,path);},get lists(){return lists;}};
}

test('projet : le sondage revalide le dossier avant de lire le terminal',async t=>{
 let reads=0;
 const view=await scopedServer(t,{readTerminal:async()=>{reads++;return null;}});
 view.server.context.core.relais.observe=async()=>view.move('b');
 await view.server.context.core.pauses.tick();
 assert.ok(view.lists>=2,'une nouvelle liste contrôle la cible avant la lecture');
 assert.equal(reads,0,'aucun terminal du projet voisin ne doit être lu');
});

test('projet : un ancien sondage suspendu ne lit plus après le changement de contexte',{timeout:5000},async t=>{
 let reads=0,release,observed;
 const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{observed=resolve;});
 const view=await scopedServer(t,{readTerminal:async()=>{reads++;return null;}});
 t.after(()=>release());
 const previous=view.server.context.core;
 previous.relais.observe=async()=>{observed();await gate;};
 const tick=previous.pauses.tick();await started;
 try{assert.equal((await view.choose('b')).status,200);}finally{release();}
 await tick;
 assert.equal(reads,0,'le lecteur de l’ancien contexte reste désactivé');
});

test('projet : le changement attend la fin d’une lecture déjà engagée',{timeout:5000},async t=>{
 let release,reading;
 const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{reading=resolve;});
 const view=await scopedServer(t,{readTerminal:async()=>{reading();await gate;return null;}});
 t.after(()=>release());
 const previous=view.server.context, tick=previous.core.pauses.tick();await started;
 let stopping;
 const stoppingStarted=new Promise(resolve=>{stopping=resolve;}),deactivate=previous.bridge.deactivate;
 previous.bridge.deactivate=()=>{stopping();return deactivate();};
 const selection=view.choose('b');
 try{
  await stoppingStarted;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(view.server.context,previous,'le changement ne doit pas dépasser une lecture en cours');
 }finally{release();}
 await tick;
 assert.equal((await selection).status,200);
 assert.notEqual(view.server.context,previous);
});
