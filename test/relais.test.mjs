import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRelais } from '../src/relais.mjs';
import { createBureauServer } from '../server.mjs';
import { createQueue } from '../src/queue.mjs';
import { request } from 'node:http';

const chief={id:'chef',name:'Chef',status:'idle'};
const agents=status=>[chief,{id:'a',name:'Agent A',status}];
async function setup(t,extra={}) {
  const folder=await mkdtemp(join(tmpdir(),'relais-'));
  t.after(()=>rm(folder,{recursive:true,force:true}));
  const clock={ms:1000000},calls=[];
  const options={file:join(folder,'relais.json'),now:()=>clock.ms,enqueue:async item=>calls.push(item),...extra};
  return {relay:createRelais(options),options,clock,calls};
}
test('relais : désactivé par défaut, état persisté, première observation sans fin inventée',async t=>{
  const {relay,options,calls}=await setup(t);
  assert.deepEqual(relay.get(),{actif:false});
  await relay.observe(agents('working'),'chef');await relay.observe(agents('idle'),'chef');
  assert.equal(calls.length,0);
  await relay.set(true);
  const restarted=createRelais(options);assert.deepEqual(restarted.get(),{actif:true});
  await restarted.observe(agents('done'),'chef');assert.equal(calls.length,0);
  await assert.rejects(relay.set('oui'),/booléen/);
});
test('relais : une clé par transition, priorité normale, deux sondages simultanés sans doublon',async t=>{
  const {relay,calls,clock}=await setup(t);await relay.set(true);
  await relay.observe(agents('working'),'chef');
  await Promise.all([relay.observe(agents('idle'),'chef'),relay.observe(agents('idle'),'chef')]);
  assert.equal(calls.length,1);
  assert.equal(calls[0].id,'chef');assert.equal(calls[0].priority,'normale');
  assert.equal(calls[0].message,'Agent A vient de terminer. Lis son panneau avant de lui confier la suite.');
  assert.match(calls[0].requestKey,/^[0-9a-f]{64}$/);
  clock.ms+=60000;await relay.observe(agents('working'),'chef');await relay.observe(agents('done'),'chef');
  assert.equal(calls.length,2);assert.notEqual(calls[0].requestKey,calls[1].requestKey);
  await relay.observe([chief,{id:'b',name:'/home/exemple/projet',status:'working'}],'chef');
  await relay.observe([chief,{id:'b',name:'/home/exemple/projet',status:'idle'}],'chef');
  assert.equal(calls[2].message,'Agent vient de terminer. Lis son panneau avant de lui confier la suite.');
});
test('relais : chef exclu, états bloqué et inconnu, disparition et remplacement sans faux positif',async t=>{
  const {relay,calls}=await setup(t);await relay.set(true);
  await relay.observe([{...chief,status:'working'}],'chef');await relay.observe([chief],'chef');
  for(const status of ['blocked','unknown']) {
    await relay.observe(agents('working'),'chef');await relay.observe(agents(status),'chef');await relay.observe(agents('idle'),'chef');
  }
  await relay.observe(agents('working'),'chef');await relay.observe([chief],'chef');await relay.observe(agents('idle'),'chef');
  await relay.observe(agents('working'),'chef');await relay.observe([chief,{id:'remplacé',name:'Agent A',status:'idle'}],'chef');
  assert.equal(calls.length,0);
});
test('relais : crise et désactivation consomment la transition, aucun rattrapage ensuite',async t=>{
  let locked=false;const {relay,calls}=await setup(t,{locked:()=>locked});await relay.set(true);
  await relay.observe(agents('working'),'chef');locked=true;await relay.observe(agents('idle'),'chef');
  locked=false;await relay.observe(agents('idle'),'chef');assert.equal(calls.length,0);
  await relay.observe(agents('working'),'chef');await relay.set(false);await relay.observe(agents('idle'),'chef');
  await relay.set(true);await relay.observe(agents('idle'),'chef');assert.equal(calls.length,0);
});
test('relais : une minute par agent, conservée après redémarrage et horloge reculée',async t=>{
  const {relay,calls,clock,options}=await setup(t);await relay.set(true);
  await relay.observe(agents('working'),'chef');await relay.observe(agents('idle'),'chef');
  const restarted=createRelais(options);clock.ms-=1000;
  await restarted.observe(agents('working'),'chef');await restarted.observe(agents('idle'),'chef');
  clock.ms+=59999;await restarted.observe(agents('working'),'chef');await restarted.observe(agents('idle'),'chef');
  assert.equal(calls.length,1);
  clock.ms+=1001;await restarted.observe(agents('working'),'chef');await restarted.observe(agents('idle'),'chef');assert.equal(calls.length,2);
});
test('relais : réponse de file perdue, aucune répétition automatique',async t=>{
  let count=0;const {relay}=await setup(t,{enqueue:async()=>{count++;throw new Error('réponse perdue');}});
  await relay.set(true);await relay.observe(agents('working'),'chef');
  await assert.rejects(relay.observe(agents('idle'),'chef'),/perdue/);
  await relay.observe(agents('idle'),'chef');assert.equal(count,1);
});

test('relais : même agent revenu après disparition, clés distinctes et caches bornés',async t=>{
  const {relay,calls,clock,options}=await setup(t);await relay.set(true);
  await relay.observe(agents('working'),'chef');await relay.observe(agents('idle'),'chef');
  await relay.observe([chief],'chef');clock.ms+=60000;
  await relay.observe(agents('working'),'chef');await relay.observe(agents('idle'),'chef');
  assert.equal(calls.length,2);assert.notEqual(calls[0].requestKey,calls[1].requestKey);
  const many=[chief,...Array.from({length:1000},(_,i)=>({id:'n'+i,name:'N',status:'working'}))];
  await relay.observe(many,'chef');await relay.observe(many.map(a=>({...a,status:'done'})),'chef');
  assert.ok(calls.length<=258);
  assert.ok((await readFile(options.file)).length<65536);
});
test('relais : état corrompu désactive, sauvegarde impossible interdit toute mise en file',async t=>{
  const {options,relay,calls}=await setup(t);await writeFile(options.file,'{corrompu');
  assert.deepEqual(createRelais(options).get(),{actif:false});
  await relay.set(true);await relay.observe(agents('working'),'chef');
  await rm(options.file);await writeFile(join(options.file,'..','obstacle'),'fichier');
  const impossible=createRelais({...options,file:join(options.file,'..','obstacle','relais.json')});
  await assert.rejects(impossible.set(true),/Sauvegarde/);assert.deepEqual(impossible.get(),{actif:false});assert.equal(calls.length,0);
});

async function bureau(t) {
  const folder=await mkdtemp(join(tmpdir(),'relais-srv-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  let list=[{...chief,paneId:'w9:p1',kind:'Claude',ready:true},{id:'a',name:'Agent A',paneId:'w9:p2',kind:'Claude',status:'working',ready:false}];
  const clock={ms:1000000},sends=[];
  const bridge={list:async()=>list,prompt:async(id,message)=>{sends.push({id,message});return {ok:true};}};
  const server=createBureauServer({bridge,now:()=>clock.ms,lireEtat:async()=>null,readOtherActivity:async()=>null,queueFile:join(folder,'queue.json'),criseFile:join(folder,'crise.json'),directionFile:join(folder,'direction.json'),relaisFile:join(folder,'relais.json')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port,origin=`http://127.0.0.1:${port}`;
  const send=(path,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path,method,headers:{Host:`127.0.0.1:${port}`,...headers}},res=>{
      let text='';res.setEncoding('utf8');res.on('data',part=>text+=part);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text)}));
    });req.on('error',reject);req.end(body);
  });
  const {data:{token}}=await send('/api/state');
  const headers={Origin:origin,'X-Bureau-Token':token,'Content-Type':'application/json'};
  return {send,server,headers,clock,sends,folder,status(value,id='a'){list=list.map(a=>a.id===id?{...a,status:value,ready:['idle','done'].includes(value)}:a);}};
}
test('relais API : GET et POST protégés, forme exacte, entrée incorrecte refusée',async t=>{
  const {send,headers}=await bureau(t);
  for(const method of ['GET','POST']) {
    assert.equal((await send('/api/relais',{method,body:method==='POST'?'{}':undefined})).status,403);
    assert.equal((await send('/api/relais',{method,headers:{...headers,Origin:'http://localhost:4317'},body:method==='POST'?'{}':undefined})).status,403);
    assert.equal((await send('/api/relais',{method,headers:{...headers,'X-Bureau-Token':'faux'},body:method==='POST'?'{}':undefined})).status,403);
    const noOrigin={...headers};delete noOrigin.Origin;
    assert.equal((await send('/api/relais',{method,headers:noOrigin,body:method==='POST'?'{}':undefined})).status,403);
  }
  assert.deepEqual((await send('/api/relais',{headers})).data,{actif:false});
  for(const value of [{},[],{actif:'oui'},{actif:1}])assert.equal((await send('/api/relais',{method:'POST',headers,body:JSON.stringify(value)})).status,400);
  assert.deepEqual((await send('/api/relais',{method:'POST',headers,body:'{"actif":true}'})).data,{actif:true});
});
test('relais raccordé : sondages HTTP et fond, deux fins espacées reçues par le chef via la file',async t=>{
  const {send,server,headers,status,clock,sends}=await bureau(t);
  await send('/api/relais',{method:'POST',headers,body:'{"actif":true}'});
  await server.pauses.tick();status('idle');
  await Promise.all([send('/api/state'),send('/api/state'),server.pauses.tick()]);
  assert.equal(server.queue.list().items.length,1);assert.equal(sends.length,0);
  await server.queue.tick();assert.equal(sends.length,1);assert.equal(sends[0].id,'chef');
  clock.ms+=60000;status('working');await server.pauses.tick();status('done');await send('/api/state');
  await server.queue.tick();assert.equal(sends.length,2);
});

test('relais raccordé : crise sans rattrapage et changement de chef, jamais envoyé à un chef occupé',async t=>{
  const {send,server,headers,status,sends}=await bureau(t);
  const post=(path,value)=>send(path,{method:'POST',headers,body:JSON.stringify(value)});
  await post('/api/relais',{actif:true});await server.pauses.tick();
  await post('/api/crise',{active:true});status('idle');await server.pauses.tick();
  await post('/api/crise',{active:false});await server.pauses.tick();
  assert.equal(server.queue.list().items.length,0);
  status('working');await post('/api/direction',{agentId:'a'});
  status('working','chef');await server.pauses.tick();status('idle','chef');await server.pauses.tick();
  assert.equal(server.queue.list().items[0].id,'a');
  await server.queue.tick();assert.equal(sends.length,0);
  status('idle');await server.queue.tick();assert.equal(sends.length,1);assert.equal(sends[0].id,'a');
});
test('relais API : erreur de sauvegarde = 500 sans chemin ni activation',async t=>{
  const {send,headers,folder}=await bureau(t);
  await mkdir(join(folder,'relais.json.tmp'));
  const response=await send('/api/relais',{method:'POST',headers,body:'{"actif":true}'});
  assert.equal(response.status,500);assert.equal(typeof response.data.error,'string');
  assert.ok(!JSON.stringify(response.data).includes(folder));
  assert.deepEqual((await send('/api/relais',{headers})).data,{actif:false});
});

test('file et relais : répétition réservée aux événements internes, clé obligatoire et toujours dédupliquée',async t=>{
  const {options}=await setup(t);
  const queue=createQueue({file:join(options.file,'..','queue.json'),listAgents:async()=>[chief],prompt:async()=>({ok:true})});
  const notice={id:'chef',message:'Agent A vient de terminer. Lis son panneau avant de lui confier la suite.',requestKey:'evenement-1'};
  const first=await queue.enqueue(notice);
  assert.equal((await queue.enqueue(notice,{allowRepeatedMessage:true})).itemId,first.itemId);
  await assert.rejects(queue.enqueue({...notice,requestKey:'manuel-2'}),/déjà en file/);
  await assert.rejects(queue.enqueue({...notice,requestKey:undefined},{allowRepeatedMessage:true}),/clé/);
  const second=await queue.enqueue({...notice,requestKey:'evenement-2'},{allowRepeatedMessage:true});
  assert.notEqual(second.itemId,first.itemId);
});

test('file API : le navigateur ne peut pas autoriser la répétition des messages',async t=>{
  const {send,headers,server}=await bureau(t);
  const post=value=>send('/api/queue',{method:'POST',headers,body:JSON.stringify(value)});
  const value={id:'chef',message:'Consigne manuelle',requestKey:'manuelle-1'};
  assert.equal((await post(value)).status,200);
  const repeated=await post({...value,requestKey:'manuelle-2',allowRepeatedMessage:true});
  assert.equal(repeated.status,400);
  assert.match(repeated.data.error,/déjà en file/);
  assert.equal(server.queue.list().items.length,1);
});
