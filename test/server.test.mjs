import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createBureauServer} from '../server.mjs';

async function bureau(t, overrides={}) {
  const calls=[];
  const bridge={
    list:async()=>[{id:'agent-1',status:'idle',ready:true}],
    read:async id=>({id,text:'<script>texte du terminal</script>'}),
    prompt:async(id,message)=>{calls.push({id,message});return {sent:true};},
    ...overrides,
  };
  const server=createBureauServer({bridge});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  const origin=`http://127.0.0.1:${port}`;
  const send=(path,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path,method,headers:{Host:`127.0.0.1:${port}`,...headers}},res=>{
      let text='';
      res.setEncoding('utf8');
      res.on('data',chunk=>text+=chunk);
      res.on('end',()=>{try {resolve({status:res.statusCode,headers:res.headers,data:JSON.parse(text)});} catch(error){reject(error);}});
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
  const {send}=await bureau(t,{list:async()=>{throw new Error('Herdr indisponible');}});
  const response=await send('/api/state');
  assert.equal(response.status,200);
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
