import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, open, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBureauServer } from '../server.mjs';
import { createQueue } from '../src/queue.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(),'queue-files-'));
  t.after(() => rm(root,{recursive:true,force:true}));
  const source = join(root,'source'), target = join(root,'cible'), file = join(root,'queue.json');
  await mkdir(source); await mkdir(target);
  await writeFile(join(source,'rapport é.txt'),'Original é 🎉');
  const agents = [{id:'cible',kind:'Agent',cwd:target,status:'idle',ready:true}], sends = [];
  const server = createBureauServer({
    queueFile:file, bridge:{list:async()=>agents,prompt:async(id,message)=>{sends.push({id,message,files:await readdir(target)});}},
    getPlaces:()=>({documents:{path:source}}), lireEtat:async()=>null,
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const {token}=await (await fetch(origin+'/api/state')).json();
  const headers={Origin:origin,'X-Bureau-Token':token,'Content-Type':'application/json'};
  const post=async(data,auth=headers)=>{
    const response=await fetch(origin+'/api/queue',{method:'POST',headers:auth,body:JSON.stringify(data)});
    return {status:response.status,data:await response.json()};
  };
  const demand={id:'cible',message:'Analyse le rapport',requestKey:'unique-1',files:[{root:'documents',path:'rapport é.txt'}]};
  return {root,source,target,file,agents,sends,server,post,demand,headers};
}

test('fichiers en file : copie réelle sans écrasement avant la consigne et nom cité',async t=>{
  const f=await fixture(t);
  await writeFile(join(f.target,'rapport é.txt'),'Travail existant');
  const queued=await f.post(f.demand);
  assert.equal(queued.status,200);
  assert.deepEqual(queued.data.files,f.demand.files);
  assert.equal((await readdir(f.target)).length,1,'pas de copie avant le départ');
  await f.server.queue.tick();
  assert.equal(await readFile(join(f.target,'rapport é.txt'),'utf8'),'Travail existant');
  assert.equal(await readFile(join(f.target,'rapport é (2).txt'),'utf8'),'Original é 🎉');
  assert.equal(f.sends.length,1);
  assert.match(f.sends[0].message,/rapport é \(2\)\.txt/);
  assert.ok(f.sends[0].files.includes('rapport é (2).txt'));
  const item=f.server.queue.list().items[0];
  assert.equal(item.state,'envoyee');
  assert.deepEqual(item.copiedFiles,[{name:'rapport é (2).txt'}]);
  assert.ok(!JSON.stringify(item).includes(f.root));
  assert.equal((await f.post(f.demand)).data.itemId,queued.data.itemId);
  await f.server.queue.tick();
  assert.equal(f.sends.length,1); assert.equal((await readdir(f.target)).length,2);
});

test('fichiers en file : jeton, origine, deux fichiers maximum et chemins relatifs',async t=>{
  const f=await fixture(t);
  assert.equal((await f.post(f.demand,{'Content-Type':'application/json'})).status,403);
  assert.equal((await f.post(f.demand,{...f.headers,Origin:'http://localhost:4317'})).status,403);
  for(const files of [null,{},[...f.demand.files,...f.demand.files,...f.demand.files],
    [{root:'documents',path:f.source}], [{root:'documents',path:'../rapport.txt'}],
    [{root:'documents',path:'C:/rapport.txt'}], [{root:f.source,path:'rapport.txt'}]]) {
    assert.equal((await f.post({...f.demand,files})).status,400,JSON.stringify(files));
  }
  assert.deepEqual(await readdir(f.target),[]); assert.equal(f.sends.length,0);
});

test('fichiers en file : copie impossible ou fichier supérieur à 20 Mo donne à revoir sans envoi',async t=>{
  const f=await fixture(t);
  const handle=await open(join(f.source,'gros.bin'),'w');
  try {await handle.truncate(20*1024*1024+1);} finally {await handle.close();}
  for(const [index,path] of ['absent.txt','gros.bin'].entries()) {
    const result=await f.post({...f.demand,requestKey:`echec-${index}`,message:`Rapport ${index}`,files:[{root:'documents',path}]});
    assert.equal(result.status,200);
    await f.server.queue.tick();
    const item=f.server.queue.list().items.find(i=>i.itemId===result.data.itemId);
    assert.equal(item.state,'a_revoir'); assert.ok(item.reason);
    assert.ok(!JSON.stringify(item).includes(f.root));
  }
  assert.equal(f.sends.length,0); assert.deepEqual(await readdir(f.target),[]);
});

test('fichiers en file : attente occupée, copie partielle conservée, pas de nouvel essai automatique',async t=>{
  const f=await fixture(t);
  f.agents[0].status='working'; f.agents[0].ready=false;
  await f.post({...f.demand,files:[...f.demand.files,{root:'documents',path:'absent.txt'}]});
  await f.server.queue.tick(); assert.deepEqual(await readdir(f.target),[]);
  f.agents[0].status='idle'; f.agents[0].ready=true;
  await f.server.queue.tick();
  const item=f.server.queue.list().items[0];
  assert.equal(item.state,'a_revoir');
  assert.deepEqual(item.copiedFiles,[{name:'rapport é.txt'}]);
  await f.server.queue.tick();
  assert.deepEqual(await readdir(f.target),['rapport é.txt']); assert.equal(f.sends.length,0);
});

test('fichiers en file : agent occupé après la copie ou reprise incertaine, aucun envoi',async t=>{
  const f=await fixture(t);
  let copies=0;
  const options={file:f.file,listAgents:async()=>f.agents,prompt:async()=>{f.sends.push('interdit');},
    prepareFiles:async element=>{copies++; element.copiedFiles=[{name:'rapport.txt'}]; f.agents[0].status='working'; return element.copiedFiles;}};
  const queue=createQueue(options);
  await queue.enqueue(f.demand);
  await queue.tick();
  assert.equal(copies,1); assert.equal(queue.list().items[0].state,'a_revoir'); assert.equal(f.sends.length,0);
  const snapshot=JSON.parse(await readFile(f.file,'utf8'));
  snapshot.items[0].state='envoi_en_cours';
  await writeFile(f.file,JSON.stringify(snapshot));
  f.agents[0].status='idle';
  await createQueue(options).tick();
  assert.equal(copies,1); assert.equal(f.sends.length,0);
});

test('fichiers en file : deux fichiers, dont exactement 20 Mo, sont présents avant envoi',async t=>{
  const f=await fixture(t),handle=await open(join(f.source,'limite.bin'),'w');
  try {await handle.truncate(20*1024*1024);} finally {await handle.close();}
  await f.post({...f.demand,files:[...f.demand.files,{root:'documents',path:'limite.bin'}]});
  await f.server.queue.tick();
  assert.equal(f.sends.length,1);
  assert.deepEqual(f.sends[0].files.sort(),['limite.bin','rapport é.txt']);
  assert.equal((await stat(join(f.target,'limite.bin'))).size,20*1024*1024);
  assert.match(f.sends[0].message,/limite\.bin/);
});

test('fichiers en file : état durable pendant la copie, une reprise ne copie ni n’envoie',async t=>{
  const f=await fixture(t);
  let signaler,terminer,copies=0;
  const started=new Promise(resolve=>{signaler=resolve;});
  const gate=new Promise(resolve=>{terminer=resolve;});
  const config={file:f.file,listAgents:async()=>f.agents,prompt:async()=>{f.sends.push('envoyé');},
    prepareFiles:async()=>{copies++;signaler();await gate;return [{name:'rapport é.txt'}];}};
  const queue=createQueue(config);
  await queue.enqueue(f.demand);
  const running=queue.tick();
  await started;
  try {
    assert.equal(JSON.parse(await readFile(f.file,'utf8')).items[0].state,'envoi_en_cours');
    await createQueue(config).tick();
    assert.equal(copies,1);assert.equal(f.sends.length,0);
  } finally {terminer();await running;}
  assert.equal(f.sends.length,1);
});

test('fichiers en file : changement du dossier ou du quota pendant la copie bloque l’envoi',async t=>{
  for(const change of ['dossier','quota']) {
    const f=await fixture(t);
    let limited=false;
    const queue=createQueue({file:f.file,listAgents:async()=>f.agents,prompt:async()=>{f.sends.push('interdit');},
      limitsOf:async()=>({limitReached:limited}),prepareFiles:async()=>{
        if(change==='dossier') f.agents[0].cwd=f.source; else limited=true;
        return [{name:'rapport é.txt'}];
      }});
    await queue.enqueue(f.demand);await queue.tick();
    assert.equal(queue.list().items[0].state,'a_revoir');assert.equal(f.sends.length,0);
  }
});

test('fichiers en file : références corrompues restaurées sans chemin absolu ni envoi',async t=>{
  const f=await fixture(t);
  await f.server.queue.enqueue(f.demand);
  const snapshot=JSON.parse(await readFile(f.file,'utf8'));
  snapshot.items[0].files=[{root:'documents',path:f.source}];
  await writeFile(f.file,JSON.stringify(snapshot));
  const restored=createQueue({file:f.file,listAgents:async()=>f.agents,prompt:async()=>{f.sends.push('interdit');}});
  await restored.tick();
  const item=restored.list().items[0];
  assert.equal(item.state,'a_revoir'); assert.deepEqual(item.files,[]);
  assert.ok(!JSON.stringify(item).includes(f.root)); assert.equal(f.sends.length,0);
});
