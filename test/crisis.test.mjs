import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCrise,CriseError} from '../src/crisis.mjs';
import {createQueue} from '../src/queue.mjs';
import {createHerdr,AgentInputError} from '../src/herdr.mjs';
import {createBureauServer} from '../server.mjs';

async function dossierTemp(t, prefix='crise-') {
  const dossier=await mkdtemp(join(tmpdir(),prefix));
  t.after(()=>rm(dossier,{recursive:true,force:true}));
  return dossier;
}

test('crise : verrou persistant après redémarrage',async t=>{
  const dossier=await dossierTemp(t);
  const file=join(dossier,'crise.json');
  const horloge={ms:Date.parse('2026-10-18T09:00:00.000Z')};
  const premiere=createCrise({file,now:()=>horloge.ms});
  assert.deepEqual(premiere.get(),{active:false,since:null,reason:null});
  const etat=await premiere.set(true);
  assert.equal(etat.active,true);
  assert.equal(etat.since,'2026-10-18T09:00:00.000Z');
  // Redémarrage : le fichier d'état suffit à reconstruire le verrou.
  const redemarrage=createCrise({file,now:()=>horloge.ms+60000});
  assert.equal(redemarrage.isActive(),true);
  assert.deepEqual(redemarrage.get(),{active:true,since:'2026-10-18T09:00:00.000Z',reason:null});
  await redemarrage.set(false);
  assert.equal(createCrise({file,now:()=>horloge.ms}).isActive(),false);
});

test('crise : fichier corrompu ou illisible donne une crise active avec sa raison',async t=>{
  const dossier=await dossierTemp(t);
  const file=join(dossier,'crise.json');
  await writeFile(file,'{pas du json','utf8');
  const crise=createCrise({file});
  assert.equal(crise.isActive(),true);
  assert.equal(crise.get().active,true);
  assert.match(crise.get().reason,/illisible/);
  assert.ok(crise.get().since);
  // Même combat avec un JSON valide mais de mauvaise forme.
  await writeFile(file,JSON.stringify({active:'oui'}),'utf8');
  assert.equal(createCrise({file}).isActive(),true);
});

test('crise : set n’accepte qu’un booléen',async t=>{
  const dossier=await dossierTemp(t);
  const crise=createCrise({file:join(dossier,'crise.json')});
  await assert.rejects(()=>crise.set('oui'),CriseError);
  await assert.rejects(()=>crise.set(1),CriseError);
});

test('crise : une sauvegarde qui échoue garde le verrou posé, la levée reste possible ensuite',async t=>{
  const dossier=await dossierTemp(t);
  const file=join(dossier,'crise.json');
  const crise=createCrise({file});
  await crise.set(true);
  // Un répertoire portant exactement le nom du fichier temporaire rend
  // l'écriture impossible : c'est la panne de disque réelle, sans simulation.
  await mkdir(`${file}.tmp`,{recursive:true});
  await assert.rejects(()=>crise.set(false));
  assert.equal(crise.isActive(),true,'le verrou reste posé tant que rien n’est écrit');
  assert.equal(JSON.parse(await readFile(file,'utf8')).active,true,'le disque dit toujours crise active');
  // Le blocage disparaît : un nouvel appel lève réellement la crise.
  await rm(`${file}.tmp`,{recursive:true,force:true});
  const etat=await crise.set(false);
  assert.equal(etat.active,false);
  assert.equal(crise.isActive(),false);
  assert.equal(JSON.parse(await readFile(file,'utf8')).active,false);
  assert.deepEqual(crise.get(),{active:false,since:null,reason:null});
});

test('crise : un échec d’écriture en levée ne déverrouille pas après redémarrage',async t=>{
  const dossier=await dossierTemp(t);
  const file=join(dossier,'crise.json');
  const crise=createCrise({file});
  await crise.set(true);
  await mkdir(`${file}.tmp`,{recursive:true});
  await assert.rejects(()=>crise.set(false));
  await rm(`${file}.tmp`,{recursive:true,force:true});
  // L'état en mémoire reste celui du disque : le redémarrage ne découvre rien d’autre.
  assert.equal(createCrise({file}).isActive(),true);
  await crise.set(false);
  assert.equal(createCrise({file}).isActive(),false);
});

test('crise : tick n’envoie rien puis reprend à la levée',async t=>{
  const dossier=await dossierTemp(t,'crise-queue-');
  const envois=[];
  let verrou=true;
  const queue=createQueue({
    listAgents:async()=>[{id:'a',name:'A',status:'idle',ready:true}],
    prompt:async(id,message)=>{envois.push({id,message});return {ok:true};},
    file:join(dossier,'file-attente.json'),
    locked:()=>verrou,
  });
  await queue.enqueue({id:'a',message:'Consigne gardée'});
  const tourVerrouille=await queue.tick();
  assert.deepEqual(envois,[]);
  assert.equal(tourVerrouille.sent.length,0);
  assert.equal(queue.list().items[0].state,'attente');
  verrou=false;
  const tour=await queue.tick();
  assert.deepEqual(envois.map(e=>e.message),['Consigne gardée']);
  assert.equal(tour.sent.length,1);
  assert.equal(queue.list().items[0].state,'envoyee');
});

test('crise : interruption polie avec arguments exacts, sans shell, jamais de kill',async t=>{
  const appels=[];
  const executeFile=async(binaire,args,options)=>{
    appels.push({binaire,args,options});
    if(args[0]==='agent'&&args[1]==='list') return {stdout:JSON.stringify({result:{agents:[{pane_id:'w5:p3',terminal_id:'term_1',agent:'codex',agent_status:'working',interactive_ready:true}]}})};
    return {stdout:JSON.stringify({result:{ok:true}})};
  };
  const herdr=createHerdr({executeFile});
  const [agent]=await herdr.list();
  assert.ok(agent.id.startsWith('w5:p3@'),'l’identifiant courant porte l’empreinte');
  const reponse=await herdr.interrupt(agent.id);
  assert.deepEqual(reponse,{requested:true,agent:agent.name});
  const envoi=appels.find(a=>a.args[0]==='pane');
  assert.deepEqual(envoi.args,['pane','send-keys','w5:p3','esc']);
  assert.equal(envoi.options.shell,undefined);
  assert.ok(!appels.some(a=>/kill/i.test(a.args.join(' '))),'aucun kill jamais envoyé');
});

test('crise : interruption d’un agent inconnu = erreur de saisie',async t=>{
  const executeFile=async(binaire,args)=>{
    if(args[0]==='agent'&&args[1]==='list') return {stdout:JSON.stringify({result:{agents:[]}})};
    return {stdout:JSON.stringify({result:{ok:true}})};
  };
  const herdr=createHerdr({executeFile});
  await assert.rejects(()=>herdr.interrupt('inconnu'),AgentInputError);
});

async function bureau(t,{agents=[{id:'agent-1',name:'Claude',status:'idle',ready:true}]}={}) {
  const calls=[],interrupts=[];
  const bridge={
    list:async()=>agents,
    read:async()=>({text:'terminal'}),
    prompt:async(id,message)=>{calls.push({id,message});return {sent:true};},
    broadcast:async(ids,message)=>{calls.push({ids,message});return {results:[]};},
    interrupt:async id=>{
      const agent=agents.find(a=>a.id===id);
      if(!agent) {const erreur=new Error('Agent introuvable. La liste a changé, sélectionnez à nouveau un agent.');erreur.statusCode=400;throw erreur;}
      interrupts.push(id);
      return {requested:true,agent:agent.name};
    },
  };
  const dossier=await dossierTemp(t,'crise-srv-');
  const server=createBureauServer({
    bridge,
    criseFile:join(dossier,'crise.json'),
    queueFile:join(dossier,'file-attente.json'),
    directionFile:join(dossier,'direction.json'),
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  const origin=`http://127.0.0.1:${port}`;
  const send=(path,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path,method,headers:{Host:`127.0.0.1:${port}`,...headers}},res=>{
      let text='';
      res.setEncoding('utf8');
      res.on('data',chunk=>text+=chunk);
      res.on('end',()=>{let data;try {data=JSON.parse(text);} catch {data=text;} resolve({status:res.statusCode,data});});
    });
    req.on('error',reject);
    req.end(body);
  });
  return {send,origin,calls,interrupts};
}

test('crise : GET /api/crise expose {active, since, reason}',async t=>{
  const {send,origin}=await bureau(t);
  const {data:{token}}=await send('/api/state');
  const headers={'Content-Type':'application/json',Origin:origin,'X-Bureau-Token':token};
  const etat=await send('/api/crise',{headers:{Origin:origin,'X-Bureau-Token':token}});
  assert.equal(etat.status,200);
  assert.deepEqual(etat.data,{active:false,since:null,reason:null});
  const active=await send('/api/crise',{method:'POST',headers,body:JSON.stringify({active:true})});
  assert.equal(active.status,200);
  assert.equal(active.data.active,true);
  assert.ok(active.data.since);
  assert.equal(active.data.reason,null);
});

test('crise : envoi et diffusion refusés en 423, puis repris à la levée',async t=>{
  const {send,origin,calls}=await bureau(t);
  const {data:{token}}=await send('/api/state');
  const headers={'Content-Type':'application/json',Origin:origin,'X-Bureau-Token':token};
  assert.equal((await send('/api/crise',{method:'POST',headers,body:JSON.stringify({active:true})})).status,200);
  const consigne=await send('/api/prompt',{method:'POST',headers,body:JSON.stringify({id:'agent-1',message:'Arrête-toi'})});
  assert.equal(consigne.status,423);
  assert.equal(consigne.data.error,'Salle de crise active : les envois sont verrouillés. Lève la crise pour reprendre.');
  const diffusion=await send('/api/broadcast',{method:'POST',headers,body:JSON.stringify({ids:['agent-1'],message:'Arrêtez-vous'})});
  assert.equal(diffusion.status,423);
  assert.equal(diffusion.data.error,'Salle de crise active : les envois sont verrouillés. Lève la crise pour reprendre.');
  assert.deepEqual(calls,[]);
  assert.equal((await send('/api/crise',{method:'POST',headers,body:JSON.stringify({active:false})})).status,200);
  assert.equal((await send('/api/prompt',{method:'POST',headers,body:JSON.stringify({id:'agent-1',message:'On reprend'})})).status,200);
  assert.deepEqual(calls,[{id:'agent-1',message:'On reprend'}]);
});

test('crise : POST /api/crise exige jeton et origine exacte, mal formé = 400',async t=>{
  const {send,origin}=await bureau(t);
  const {data:{token}}=await send('/api/state');
  const headers={'Content-Type':'application/json',Origin:origin,'X-Bureau-Token':token};
  for(const invalide of [{}, {Origin:origin}, {'X-Bureau-Token':token}, {...headers,'X-Bureau-Token':'x'.repeat(token.length)}, {...headers,Origin:'http://localhost:4317'}]) {
    assert.equal((await send('/api/crise',{method:'POST',headers:invalide,body:JSON.stringify({active:true})})).status,403);
    assert.equal((await send('/api/crise',{headers:invalide})).status,403);
  }
  assert.equal((await send('/api/crise',{method:'POST',headers,body:JSON.stringify({active:'oui'})})).status,400);
  assert.equal((await send('/api/crise',{method:'POST',headers,body:'{invalide'})).status,400);
  assert.equal((await send('/api/crise',{method:'POST',headers,body:JSON.stringify({})})).status,400);
});

test('crise : arrêt poli seulement si crise active, agent inconnu = 400',async t=>{
  const {send,origin,interrupts}=await bureau(t);
  const {data:{token}}=await send('/api/state');
  const headers={'Content-Type':'application/json',Origin:origin,'X-Bureau-Token':token};
  // Sans crise : 409, aucun appel.
  assert.equal((await send('/api/crise/arret',{method:'POST',headers,body:JSON.stringify({id:'agent-1'})})).status,409);
  assert.deepEqual(interrupts,[]);
  // Requête mal formée : 400 même sans crise.
  assert.equal((await send('/api/crise/arret',{method:'POST',headers,body:JSON.stringify({})})).status,400);
  // Crise active : l'arrêt est demandé, réponse sans chemin.
  assert.equal((await send('/api/crise',{method:'POST',headers,body:JSON.stringify({active:true})})).status,200);
  const arret=await send('/api/crise/arret',{method:'POST',headers,body:JSON.stringify({id:'agent-1'})});
  assert.equal(arret.status,200);
  assert.deepEqual(arret.data,{requested:true,agent:'Claude'});
  assert.deepEqual(interrupts,['agent-1']);
  // Agent inconnu : 400.
  assert.equal((await send('/api/crise/arret',{method:'POST',headers,body:JSON.stringify({id:'agent-x'})})).status,400);
  // Garde jeton et origine sur l'arrêt.
  assert.equal((await send('/api/crise/arret',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({id:'agent-1'})})).status,403);
});
