import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createHerdr, normalizeAgent, HerdrError, AgentInputError} from '../src/herdr.mjs';
import {createBureauServer} from '../server.mjs';

const raw={pane_id:'w5:p4',terminal_id:'term_1',agent:'codex',agent_status:'idle'};
const listing=JSON.stringify({result:{agents:[raw]}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

async function bureau(t, bridge) {
  const server=createBureauServer({bridge});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  const origin=`http://127.0.0.1:${port}`;
  const send=(path,{method='GET',headers={},body,chunked=false}={})=>new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path,method,headers:{Host:`127.0.0.1:${port}`,...headers}},res=>{
      let text='';
      res.setEncoding('utf8');
      res.on('data',chunk=>text+=chunk);
      res.on('error',reject);
      res.on('end',()=>{try {resolve({status:res.statusCode,data:JSON.parse(text)});} catch(error) {reject(error);}});
    });
    req.on('error',reject);
    if(chunked) {
      for(let offset=0;offset<body.length;offset+=32768) req.write(body.subarray(offset,offset+32768));
      req.end();
    } else req.end(body);
  });
  return {send,origin};
}

test('les listes simultanées partagent une seule commande et son résultat',async()=>{
  let calls=0;
  const pending=deferred();
  const bridge=createHerdr({run:async args=>{assert.deepEqual(args,['agent','list']);calls++;return pending.promise;}});
  const requests=[bridge.list(),bridge.list(),bridge.list()];
  assert.equal(calls,1);
  pending.resolve(listing);
  const results=await Promise.all(requests);
  for(const result of results) assert.deepEqual(result,[normalizeAgent(raw)]);
  await bridge.list();
  assert.equal(calls,2,'une liste terminée ne reste pas figée en cache');
});

test('une panne de liste partagée libère la promesse pour la prochaine tentative',async()=>{
  const pending=deferred();
  let calls=0;
  const bridge=createHerdr({run:async()=>++calls===1?pending.promise:listing});
  const requests=[bridge.list(),bridge.list()];
  assert.equal(calls,1);
  pending.reject(new HerdrError('Herdr indisponible'));
  const results=await Promise.allSettled(requests);
  for(const result of results) {
    assert.equal(result.status,'rejected');
    assert.equal(result.reason.message,'Herdr indisponible');
  }
  assert.deepEqual(await bridge.list(),[normalizeAgent(raw)]);
  assert.equal(calls,2);
});

test('la lecture ne prétend plus que chaque sortie est tronquée',async()=>{
  const bridge=createHerdr({run:async args=>args[1]==='list'?listing:'Sortie courte'});
  const result=await bridge.read(normalizeAgent(raw).id);
  assert.deepEqual(result,{text:'Sortie courte'});
});

test('une consigne commençant par -- reste un seul argument intact',async()=>{
  const message='--flag texte de la consigne';
  let written;
  const bridge=createHerdr({run:async args=>{
    if(args[1]==='list') return listing;
    written=args;
    return JSON.stringify({result:{type:'agent_prompted'}});
  }});
  await bridge.prompt(normalizeAgent(raw).id,message);
  assert.deepEqual(written,['agent','prompt','w5:p4',message]);
});

test('sortie trop volumineuse et délai dépassé produisent des erreurs distinctes',async()=>{
  const errors=[
    Object.assign(new Error('maxBuffer'),{code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',killed:true}),
    Object.assign(new Error('timeout'),{killed:true,signal:'SIGTERM'}),
  ];
  const messages=[];
  for(const error of errors) {
    const bridge=createHerdr({executeFile:async()=>{throw error;}});
    await assert.rejects(bridge.list(),actual=>{
      assert.equal(actual.statusCode,502);
      messages.push(actual.message);
      return true;
    });
  }
  assert.match(messages[0],/volumineus/i);
  assert.doesNotMatch(messages[0],/trop de temps/i);
  assert.equal(messages[1],'Herdr met trop de temps à répondre. Vérifiez sa fenêtre avant de réessayer.');
  assert.notEqual(messages[0],messages[1]);
});

test('les erreurs de saisie Herdr gardent leurs messages et leur statut 400',async()=>{
  const bridge=createHerdr({run:async()=>listing});
  for(const [action,message] of [
    [()=>bridge.read('absent'),'Agent introuvable. La liste a changé, sélectionnez à nouveau un agent.'],
    [()=>bridge.prompt(normalizeAgent(raw).id,''),'Écrivez une consigne de 1 à 12 000 caractères, sans caractère nul.'],
  ]) await assert.rejects(action(),error=>error.statusCode===400&&error.message===message);
});

test('lecture, envoi et état distinguent 400, 502 et 500 sans changer les messages',async t=>{
  let failure;
  const bridge={
    list:async()=>{if(failure) throw failure;return [];},
    read:async()=>{throw failure;},
    prompt:async()=>{throw failure;},
  };
  const {send,origin}=await bureau(t,bridge);
  const {data:{token}}=await send('/api/state');
  const headers={Origin:origin,'X-Bureau-Token':token,'Content-Type':'application/json'};
  for(const [error,status] of [[new AgentInputError('Saisie refusée.'),400],[new HerdrError('Herdr indisponible.'),502],[new Error('Erreur interne.'),500]]) {
    failure=error;
    for(const [path,options] of [
      ['/api/read?id=agent-1',{headers}],
      ['/api/prompt',{method:'POST',headers,body:JSON.stringify({id:'agent-1',message:'Bonjour'})}],
      ['/api/state',{}],
    ]) {
      const response=await send(path,options);
      assert.equal(response.status,status,path);
      assert.equal(response.data.error,error.message,path);
      if(path==='/api/state') {
        assert.equal(response.data.connected,false);
        assert.deepEqual(response.data.agents,[]);
      }
    }
  }
});

test('localhost reste refusé avec une adresse explicite pour ouvrir le bureau',async t=>{
  const {send}=await bureau(t,{list:async()=>[]});
  const response=await send('/api/state',{headers:{Host:'localhost:4317'}});
  assert.equal(response.status,403);
  assert.deepEqual(response.data,{error:'Ouvre le bureau avec http://127.0.0.1:4317'});
});

test('un corps de plus de 3 Mo reçoit un 413 complet puis le serveur répond encore', {timeout:10000},async t=>{
  let writes=0;
  const {send,origin}=await bureau(t,{list:async()=>[],prompt:async()=>{writes++;}});
  const {data:{token}}=await send('/api/state');
  const response=await send('/api/prompt',{
    method:'POST',
    headers:{Origin:origin,'X-Bureau-Token':token,'Content-Type':'application/json','Transfer-Encoding':'chunked'},
    body:Buffer.alloc(3*1024*1024+1,0x61),chunked:true,
  });
  assert.equal(response.status,413);
  assert.deepEqual(response.data,{error:'Consigne trop longue.'});
  assert.equal(writes,0);
  const next=await send('/api/state');
  assert.equal(next.status,200);
  assert.equal(next.data.connected,true);
});
