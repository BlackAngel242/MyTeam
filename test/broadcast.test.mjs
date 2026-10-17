import test from 'node:test';
import assert from 'node:assert/strict';
import { createBureauServer } from '../server.mjs';
import { createHerdr } from '../src/herdr.mjs';

async function fixture(t) {
  const writes=[];
  const bridge=createHerdr({run:async args=>{
    if(args[1]==='list') return JSON.stringify({result:{agents:[
      {pane_id:'w5:p1',terminal_id:'t1',agent:'claude',agent_status:'idle'},
      {pane_id:'w5:p2',terminal_id:'t2',agent:'codex',agent_status:'working'},
    ]}});
    if(args[1]==='prompt') {writes.push(args);return JSON.stringify({result:{type:'agent_prompted'}});}
    throw new Error('Appel inattendu');
  }});
  const server=createBureauServer({bridge});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const state=await (await fetch(`${origin}/api/state`)).json();
  const send=async(ids,token=state.token)=>{
    const response=await fetch(`${origin}/api/broadcast`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Bureau-Token':token},body:JSON.stringify({ids,message:'Verifier le projet'})});
    return {status:response.status,data:await response.json()};
  };
  return {send,writes,ids:state.agents.map(agent=>agent.id)};
}

test('envoi groupe refuse sans jeton et sans aucun envoi',async t=>{
  const {send,writes,ids}=await fixture(t);
  assert.equal((await send(ids,'')).status,403);
  assert.deepEqual(writes,[]);
});

test('envoi groupe refuse les listes de cibles invalides',async t=>{
  const {send,writes,ids}=await fixture(t);
  for(const invalid of [null,'agent',[],[ids[0],ids[0]],[''],[12],Array.from({length:13},(_,i)=>`agent-${i}`)]) {
    assert.equal((await send(invalid)).status,400);
  }
  const unknown=await send(['agent-inexistant']);
  assert.equal(unknown.data.results[0].ok,false);
  assert.deepEqual(writes,[]);
});

test('envoi groupe partiel : seul le pret recoit une consigne',async t=>{
  const {send,writes,ids}=await fixture(t);
  const result=await send(ids);
  assert.equal(result.status,200);
  assert.deepEqual(result.data.results.map(({id,ok})=>({id,ok})),[{id:ids[0],ok:true},{id:ids[1],ok:false}]);
  assert.deepEqual(writes,[['agent','prompt','w5:p1','Verifier le projet']]);
});
