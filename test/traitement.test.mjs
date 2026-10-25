import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBureauServer } from '../server.mjs';
import { createQueue } from '../src/queue.mjs';

async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'traitement-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const source=join(root,'source'),target=join(root,'agent');
  await mkdir(source);await mkdir(target);
  await writeFile(join(source,'rapport é.txt'),'Contenu privé 🎉');
  const clock={ms:Date.now()},agents=[{id:'c',kind:'Codex',name:'Agent',cwd:target,status:'idle',ready:true,creator_account_id:'COMPTE_PRIVE'}];
  let responses={found:false,responses:[]},reads=0,sends=0;
  const server=createBureauServer({queueFile:join(root,'queue.json'),now:()=>clock.ms,cacheReponsesMs:0,
    bridge:{list:async()=>agents,prompt:async()=>{sends++;clock.ms+=1000;}},
    getPlaces:()=>({documents:{path:source}}),readOtherActivity:async()=>null,
    getOtherResponses:async()=>{reads++;return responses;},
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const {token}=await (await fetch(origin+'/api/state',{headers:{'Sec-Fetch-Site':'same-origin'}})).json();
  const headers={Origin:origin,'X-Bureau-Token':token};
  const get=async(id='c',auth=headers)=>{
    const response=await fetch(origin+'/api/traitement?id='+encodeURIComponent(id),{headers:auth});
    return {status:response.status,data:await response.json()};
  };
  const enqueue=async(files=[{root:'documents',path:'rapport é.txt'}])=>{
    const response=await fetch(origin+'/api/queue',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id:'c',message:'CONSIGNE_PRIVEE',files})});
    assert.equal(response.status,200);
    return response.json();
  };
  return {root,source,target,clock,agents,server,get,enqueue,setResponses:value=>{responses=value;},get reads(){return reads;},get sends(){return sends;}};
}

test('traitement : jeton et provenance exigés, agent inconnu refusé, absence de dossier explicite',async t=>{
  const f=await fixture(t);
  for(const auth of [{},{Origin:'http://localhost:4317'},{Origin:'http://evil.test','X-Bureau-Token':'faux'}]) assert.equal((await f.get('c',auth)).status,403);
  assert.equal(f.reads,0);
  assert.equal((await f.get('inconnu')).status,400);
  assert.equal((await f.get('')).status,400);
  assert.deepEqual((await f.get()).data,{dossiers:[]});
  assert.equal(f.sends,0);
});

test('traitement : file et copie datées, nom effectivement copié, aucun contenu ni chemin privé',async t=>{
  const f=await fixture(t);
  await writeFile(join(f.target,'rapport é.txt'),'Travail existant');
  const queued=await f.enqueue();
  const pending=(await f.get()).data.dossiers;
  assert.equal(pending.length,1);assert.equal(pending[0].fichierConfie,'rapport é.txt');
  assert.ok(pending[0].faits.some(fact=>fact.source==='file'&&/mise en file/i.test(fact.fait)&&fact.at===queued.createdAt));
  assert.ok(!pending[0].faits.some(fact=>fact.source==='disque'),'aucun fichier copié encore');
  await f.server.queue.tick();
  const result=await f.get(),dossier=result.data.dossiers[0];
  assert.equal(result.status,200);assert.equal(dossier.id,pending[0].id);
  assert.equal(dossier.fichierConfie,'rapport é (2).txt');assert.equal(dossier.cible,'c');
  assert.ok(dossier.faits.some(fact=>fact.source==='file'&&/copie/i.test(fact.fait)));
  assert.ok(dossier.faits.some(fact=>fact.source==='file'&&/envoyée/i.test(fact.fait)));
  assert.ok(dossier.faits.some(fact=>fact.source==='herdr'));
  assert.ok(dossier.faits.every(fact=>['file','disque','herdr','journal'].includes(fact.source)&&Number.isFinite(Date.parse(fact.at))));
  const text=JSON.stringify(result.data);
  assert.ok(!text.includes(f.root));assert.doesNotMatch(text,/CONSIGNE_PRIVEE|COMPTE_PRIVE|Contenu privé|sessionId|réussi|traité/i);
  assert.deepEqual(f.server.queue.list().items[0].copiedFiles,[{name:'rapport é (2).txt'}]);
  assert.equal(await readFile(join(f.target,'rapport é.txt'),'utf8'),'Travail existant');
});

test('traitement : modification postérieure à l’envoi, fait du disque sans attribution à l’agent',async t=>{
  const f=await fixture(t);await f.enqueue();await f.server.queue.tick();
  const sent=Date.parse(f.server.queue.list().items[0].sentAt),file=join(f.target,'rapport é.txt');
  await utimes(file,new Date(sent-10),new Date(sent-10));
  assert.ok(!(await f.get()).data.dossiers[0].faits.some(fact=>/a changé pendant le traitement/.test(fact.fait)));
  f.clock.ms=sent+2000;
  await utimes(file,new Date(sent+1000),new Date(sent+1000));
  const before=await stat(file),result=await f.get();
  assert.ok(result.data.dossiers[0].faits.some(fact=>fact.source==='disque'&&fact.fait==='Le fichier a changé pendant le traitement.'&&Date.parse(fact.at)===sent+1000));
  assert.equal((await stat(file)).mtimeMs,before.mtimeMs,'la lecture ne modifie pas le fichier');
});

test('traitement : fin de réponse observée après l’envoi, lien avec le fichier non affirmé',async t=>{
  const f=await fixture(t);await f.enqueue();await f.server.queue.tick();
  const sent=Date.parse(f.server.queue.list().items[0].sentAt);f.clock.ms=sent+2000;
  const reply={startedAt:new Date(sent+100).toISOString(),endedAt:new Date(sent+1000).toISOString(),state:'terminée',blocks:[{text:'REPONSE_PRIVEE'}]};
  f.setResponses({found:true,responses:[reply]});
  const result=await f.get(),facts=result.data.dossiers[0].faits.filter(fact=>fact.source==='journal');
  assert.equal(facts.length,1);assert.match(facts[0].fait,/lien.*non établi/i);
  assert.equal(facts[0].at,reply.endedAt);assert.ok(!JSON.stringify(result.data).includes('REPONSE_PRIVEE'));
  f.setResponses({found:true,responses:[{...reply,startedAt:new Date(sent-100).toISOString()}]});
  assert.ok(!(await f.get()).data.dossiers[0].faits.some(fact=>fact.source==='journal'));
});

test('traitement : fichier disparu, racine remplacée et journal indisponible ne fabriquent aucun fait',async t=>{
  const f=await fixture(t);await f.enqueue();await f.server.queue.tick();
  await rm(join(f.target,'rapport é.txt'));
  assert.equal((await f.get()).status,200);
  assert.ok(!(await f.get()).data.dossiers[0].faits.some(fact=>fact.source==='disque'));
  await writeFile(join(f.source,'rapport é.txt'),'Autre fichier de même nom');
  f.agents[0].cwd=f.source;
  assert.ok(!(await f.get()).data.dossiers[0].faits.some(fact=>fact.source==='disque'));
  f.setResponses(null);
  assert.equal((await f.get()).status,200);
});

test('traitement : observations de copie restaurées et métadonnées privées retirées de la file publique',async t=>{
  const f=await fixture(t);await f.enqueue();await f.server.queue.tick();
  const config={file:join(f.root,'queue.json'),listAgents:async()=>f.agents,prompt:async()=>{throw new Error('aucun nouvel envoi');}};
  const restored=createQueue(config);
  const observations=restored.list({fileFacts:true}).items[0].copiedFiles[0];
  assert.equal(observations.name,'rapport é.txt');
  assert.equal(observations.at,new Date(f.clock.ms-1000).toISOString());
  assert.match(observations.cwdTag,/^[0-9a-f]{64}$/);
  assert.deepEqual(restored.list().items[0].copiedFiles,[{name:'rapport é.txt'}]);
  assert.ok(!JSON.stringify(restored.list()).includes(observations.cwdTag));
  await restored.tick();assert.equal(f.sends,1);
});

test('traitement : ancienne copie sans date ni destination ne fournit aucun faux fait du disque',async t=>{
  const f=await fixture(t);await f.enqueue();await f.server.queue.tick();
  const raw=JSON.parse(await readFile(join(f.root,'queue.json'),'utf8'));
  raw.items[0].copiedFiles=[{name:'rapport é.txt'}];
  await writeFile(join(f.root,'queue.json'),JSON.stringify(raw));
  const restored=createQueue({file:join(f.root,'queue.json'),listAgents:async()=>f.agents,prompt:async()=>{throw new Error('aucun envoi');}});
  const initial=f.server.queue.list;
  f.server.queue.list=restored.list;
  try {
    const facts=(await f.get()).data.dossiers[0].faits;
    assert.ok(facts.some(fact=>/heure de copie non conservée/.test(fact.fait)));
    assert.ok(!facts.some(fact=>fact.source==='disque'));
  } finally {f.server.queue.list=initial;}
});

test('traitement : une réponse du tour suivant ne complète pas le dossier précédent',async t=>{
  const f=await fixture(t);await f.enqueue();await f.server.queue.tick();
  await f.server.queue.enqueue({id:'c',message:'Autre demande sans fichier'});await f.server.queue.tick();
  const last=f.clock.ms;f.clock.ms+=2000;
  f.setResponses({found:true,responses:[{state:'terminée',startedAt:new Date(last+100).toISOString(),endedAt:new Date(last+1000).toISOString(),blocks:[]}]});
  assert.ok(!(await f.get()).data.dossiers[0].faits.some(fact=>fact.source==='journal'));
});

test('traitement : aucun résultat public du tour, y compris le second, ne contient les métadonnées privées',async t=>{
  const f=await fixture(t);
  const agents=[...f.agents,{...f.agents[0],id:'d'}];
  const queue=createQueue({file:join(f.root,'autre-queue.json'),listAgents:async()=>agents,prompt:async()=>{},
    prepareFiles:async()=>[{name:'rapport é.txt',at:new Date(f.clock.ms).toISOString(),cwdTag:'a'.repeat(64)}]});
  for(const id of ['c','d']) await queue.enqueue({id,message:'Lecture factice',files:[{root:'documents',path:'rapport é.txt'}]});
  const result=await queue.tick();
  assert.equal(result.sent.length,2);
  assert.ok(!JSON.stringify(result).includes('cwdTag'));
  assert.ok(result.sent.every(item=>Object.keys(item.copiedFiles[0]).join(',')==='name'));
});
