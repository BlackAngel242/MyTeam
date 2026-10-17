import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {existsSync} from 'node:fs';
import {createBureauServer} from '../server.mjs';
import {createHerdr, HerdrError} from '../src/herdr.mjs';

async function bureau(t, overrides={}, options={}) {
  const calls=[];
  const bridge={
    list:async()=>[{id:'agent-1',status:'idle',ready:true}],
    read:async id=>({id,text:'<script>texte du terminal</script>'}),
    prompt:async(id,message)=>{calls.push({id,message});return {sent:true};},
    broadcast:async(ids,message)=>{calls.push({ids,message});return {results:[]};},
    ...overrides,
  };
  const server=createBureauServer({bridge,...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  const origin=`http://127.0.0.1:${port}`;
  const send=(path,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path,method,headers:{Host:`127.0.0.1:${port}`,...headers}},res=>{
      let text='';
      res.setEncoding('utf8');
      res.on('data',chunk=>text+=chunk);
      res.on('end',()=>{let data;try {data=JSON.parse(text);} catch {data=text;} resolve({status:res.statusCode,headers:res.headers,data});});
    });
    req.on('error',reject);
    req.end(body);
  });
  return {send,origin,calls};
}

test('le serveur refuse adresse étrangère, origine étrangère et accès extérieur',async t=>{
  const {send}=await bureau(t);
  for(const headers of [{Host:'exemple.invalid'},{Origin:'https://exemple.invalid'},{'Sec-Fetch-Site':'cross-site'}]) {
    assert.equal((await send('/api/state',{headers})).status,403);
  }
});

test('une consigne exige une origine exacte et le jeton courant',async t=>{
  const {send,origin,calls}=await bureau(t);
  const state=await send('/api/state');
  assert.equal(state.status,200);
  assert.equal(state.data.connected,true);
  assert.equal(state.headers['cache-control'],'no-store');
  const token=state.data.token;
  const body=JSON.stringify({id:'agent-1',message:'Bonjour\n"équipe"'});
  const headers={'Content-Type':'application/json',Origin:origin,'X-Bureau-Token':token};
  for(const invalid of [{...headers,'X-Bureau-Token':''},{...headers,'X-Bureau-Token':'x'.repeat(token.length)},{...headers,Origin:''},{...headers,Origin:'http://localhost:4317'}]) {
    assert.equal((await send('/api/prompt',{method:'POST',headers:invalid,body})).status,403);
  }
  assert.deepEqual(calls,[]);
  const sent=await send('/api/prompt',{method:'POST',headers,body});
  assert.equal(sent.status,200);
  assert.deepEqual(sent.data,{sent:true});
  assert.deepEqual(calls,[{id:'agent-1',message:'Bonjour\n"équipe"'}]);
});

test('une panne de liste donne une déconnexion et aucune ancienne cible',async t=>{
  const {send}=await bureau(t,{list:async()=>{throw new HerdrError('Herdr indisponible');}});
  const response=await send('/api/state');
  assert.equal(response.status,502);
  assert.equal(response.data.connected,false);
  assert.deepEqual(response.data.agents,[]);
  assert.equal(response.data.error,'Herdr indisponible');
});

test('le serveur refuse données illisibles, format incorrect et consigne trop grande',async t=>{
  const {send,origin,calls}=await bureau(t);
  const {data:{token}}=await send('/api/state');
  const headers={Origin:origin,'X-Bureau-Token':token,'Content-Type':'application/json'};
  assert.equal((await send('/api/prompt',{method:'POST',headers,body:'{invalide'})).status,400);
  assert.equal((await send('/api/prompt',{method:'POST',headers,body:JSON.stringify({message:'Sans cible'})})).status,400);
  assert.equal((await send('/api/prompt',{method:'POST',headers:{...headers,'Content-Type':'text/plain'},body:'Bonjour'})).status,415);
  assert.equal((await send('/api/prompt',{method:'POST',headers,body:JSON.stringify({id:'agent-1',message:'é'.repeat(31000)})})).status,413);
  assert.deepEqual(calls,[]);
});

test('la lecture transmet la cible et conserve le terminal comme texte',async t=>{
  const {send}=await bureau(t);
  const response=await send('/api/read?id=agent-1');
  assert.equal(response.status,200);
  assert.match(response.headers['content-type'],/^application\/json/);
  assert.deepEqual(response.data,{id:'agent-1',text:'<script>texte du terminal</script>'});
});

test('/logos.js est servi en javascript ou renvoie un 404 propre',async t=>{
  const {send}=await bureau(t);
  const response=await send('/logos.js');
  if(existsSync(new URL('../public/logos.js',import.meta.url))) {
    assert.equal(response.status,200);
    assert.match(response.headers['content-type'],/^text\/javascript/);
    assert.equal(response.headers['x-content-type-options'],'nosniff');
    assert.equal(response.headers['cache-control'],'no-store');
    assert.equal(response.headers['content-security-policy']!==undefined,true);
  } else {
    assert.equal(response.status,404);
    assert.deepEqual(response.data,{error:'Page introuvable.'});
  }
});

test('un envoi groupe exige jeton, origine exacte, JSON et cibles valides',async t=>{
  const {send,origin,calls}=await bureau(t);
  const {data:{token}}=await send('/api/state');
  const headers={'Content-Type':'application/json',Origin:origin,'X-Bureau-Token':token};
  const body=JSON.stringify({ids:['agent-1','agent-2'],message:'Bonjour'});
  for(const invalid of [{...headers,'X-Bureau-Token':''},{...headers,'X-Bureau-Token':'x'.repeat(token.length)},{...headers,Origin:''},{...headers,Origin:'http://localhost:4317'}]) {
    assert.equal((await send('/api/broadcast',{method:'POST',headers:invalid,body})).status,403);
  }
  assert.equal((await send('/api/broadcast',{method:'POST',headers:{...headers,'Content-Type':'text/plain'},body})).status,415);
  for(const ids of [[],['agent-1','agent-1'],['agent-1',''],['agent-1',2],Array.from({length:13},(_,i)=>`agent-${i}`)]) {
    assert.equal((await send('/api/broadcast',{method:'POST',headers,body:JSON.stringify({ids,message:'Bonjour'})})).status,400);
  }
  assert.equal((await send('/api/broadcast',{method:'POST',headers,body:'{invalide'})).status,400);
  assert.equal((await send('/api/broadcast',{method:'POST',headers,body:JSON.stringify({ids:['agent-1'],message:'é'.repeat(31000)})})).status,413);
  assert.deepEqual(calls,[]);
});

test('un envoi groupe évite l’agent occupé et rend un résultat partiel',async t=>{
  const writes=[];
  const bridge=createHerdr({run:async args=>{
    if(args[1]==='list') return JSON.stringify({result:{agents:[
      {pane_id:'w5:p1',terminal_id:'term_1',agent:'claude',agent_status:'idle'},
      {pane_id:'w5:p2',terminal_id:'term_2',agent:'codex',agent_status:'working'},
    ]}});
    if(args[1]==='prompt'){writes.push(args);return JSON.stringify({result:{type:'agent_prompted'}});}
    return '{}';
  }});
  const {send,origin}=await bureau(t,bridge);
  const {data:{token,agents}}=await send('/api/state');
  const ids=agents.map(agent=>agent.id);
  const response=await send('/api/broadcast',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-Bureau-Token':token},body:JSON.stringify({ids:[ids[1],ids[0]],message:'Bonjour'})});
  assert.equal(response.status,200);
  assert.deepEqual(response.data.results.map(r=>({id:r.id,name:r.name,ok:r.ok})),[
    {id:ids[1],name:'Codex',ok:false},
    {id:ids[0],name:'Claude',ok:true},
  ]);
  assert.match(response.data.results[0].error,/disponible/);
  assert.equal(response.data.results[1].message,'Consigne transmise à Herdr.');
  assert.equal(writes.length,1);
  assert.deepEqual(writes[0],['agent','prompt','w5:p1','Bonjour']);
});

test('/api/state lit les activites Claude en parallele sans divulguer les sessions', {timeout:3000}, async t=>{
  let started=0;
  let release;
  const bothStarted=new Promise(resolve=>release=resolve);
  const tokens={input:10,output:2,cacheRead:3,cacheCreation:4};
  const subagents=[{id:'outil-1',description:'Verifier'}];
  const agents=[
    {id:'c1',kind:'Claude',sessionId:'session-privee-1'},
    {id:'c2',kind:'Claude',sessionId:'session-privee-2'},
    {id:'x',kind:'Codex',sessionId:'ne-pas-lire'},
  ];
  const readActivity=async id=>{
    assert.match(id,/session-privee/);
    if(++started===2) release();
    await bothStarted;
    return {found:true,tokens,subagents,sessionId:id,path:'CHEMIN PRIVE'};
  };
  const {send}=await bureau(t,{list:async()=>agents},{readActivity});
  const response=await send('/api/state');
  assert.equal(response.status,200);
  assert.equal(response.data.connected,true);
  assert.equal(started,2);
  assert.deepEqual(response.data.agents,[
    {id:'c1',kind:'Claude',activity:{tokens,limits:[],model:null,effort:null,source:'journal local',match:'session exacte',subagents}},
    {id:'c2',kind:'Claude',activity:{tokens,limits:[],model:null,effort:null,source:'journal local',match:'session exacte',subagents}},
    {id:'x',kind:'Codex'},
  ]);
  assert.ok(!JSON.stringify(response.data).includes('session-privee'));
  assert.ok(!JSON.stringify(response.data).includes('CHEMIN PRIVE'));
  assert.equal(agents[0].sessionId,'session-privee-1');
});

test('/api/state reste connecte si une activite echoue ou est absente',async t=>{
  const {send}=await bureau(t,{list:async()=>[
    {id:'c1',kind:'Claude',sessionId:'echec'},
    {id:'c2',kind:'Claude',sessionId:'absent'},
    {id:'c3',kind:'Claude'},
  ]},{readActivity:async id=>{if(id==='echec') throw new Error('Lecture impossible');return {found:false};}});
  const response=await send('/api/state');
  assert.equal(response.status,200);
  assert.equal(response.data.connected,true);
  assert.deepEqual(response.data.agents,[{id:'c1',kind:'Claude'},{id:'c2',kind:'Claude'},{id:'c3',kind:'Claude'}]);
});

test('/api/state expose seulement les champs publics des activites locales',async t=>{
  const listed=[{id:'x',kind:'Codex',cwd:'C:/projet-factice',sessionId:'SECRET_SESSION',creator_user_id:'SECRET_USER',creator_account_id:'SECRET_ACCOUNT'}];
  const {send}=await bureau(t,{list:async()=>listed},{readOtherActivity:async(agent,agents)=>{
    assert.equal(agent,listed[0]);
    assert.equal(agents,listed);
    return {
      tokens:{input:3,output:4,cacheRead:5,cacheCreation:6,creator_user_id:'SECRET_USER'},
      limits:[{label:'Principale',usedPercent:12,window:300,creator_account_id:'SECRET_ACCOUNT'}],
      model:'modele-factice',effort:'high',subagents:[{id:'SECRET_SESSION',description:'SECRET_MESSAGE'}],
      source:'SECRET_PATH',match:'SECRET_SESSION',path:'SECRET_PATH',creator_user_id:'SECRET_USER',
    };
  }});
  const response=await send('/api/state');
  assert.equal(response.data.connected,true);
  assert.deepEqual(response.data.agents,[{
    id:'x',kind:'Codex',cwd:'C:/projet-factice',
    activity:{tokens:{input:3,output:4,cacheRead:5,cacheCreation:6},limits:[{label:'Principale',usedPercent:12,window:300}],model:'modele-factice',effort:'high',source:'journal local',match:'dossier et activité récente'},
  }]);
  assert.doesNotMatch(JSON.stringify(response.data),/SECRET_|creator_|sessionId/);
});

test('/api/state reste utilisable si le lecteur des autres journaux echoue',async t=>{
  const {send}=await bureau(t,{list:async()=>[{id:'x',kind:'OpenCode'}]},{readOtherActivity:async()=>{throw new Error('SECRET_PATH');}});
  const response=await send('/api/state');
  assert.equal(response.status,200);
  assert.equal(response.data.connected,true);
  assert.deepEqual(response.data.agents,[{id:'x',kind:'OpenCode'}]);
  assert.doesNotMatch(JSON.stringify(response.data),/SECRET_/);
});
