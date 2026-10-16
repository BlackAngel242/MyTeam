import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHerdr, normalizeAgent} from '../src/herdr.mjs';

const raw = {pane_id:'w5:p4', terminal_id:'term_1', agent:'codex', agent_status:'idle', cwd:'C:/projet'};
test('un statut inconnu ne devient jamais disponible', () => {
  assert.equal(normalizeAgent({...raw, agent_status:'surprise'}).status, 'unknown');
  assert.equal(normalizeAgent({...raw, agent_status:'surprise'}).ready, false);
  assert.equal(normalizeAgent({...raw, interactive_ready:false}).ready, false);
});
test('un remplacement dans le même panneau invalide la cible', async () => {
  const bridge = createHerdr({run:async()=>JSON.stringify({result:{agents:[{...raw, terminal_id:'term_2'}]}})});
  await assert.rejects(bridge.prompt(normalizeAgent(raw).id, 'Bonjour'), /introuvable/);
});
test('refus de transmettre aux agents occupés et bloqués', async () => {
  for (const status of ['working','blocked','unknown']) {
    let writes=0;
    const bridge=createHerdr({run:async(args)=> {
      if(args[1]==='prompt') writes++;
      return JSON.stringify({result:{agents:[{...raw,agent_status:status}]}});
    }});
    await assert.rejects(bridge.prompt(normalizeAgent(raw).id,'Bonjour'), /disponible/);
    assert.equal(writes,0);
  }
});
test('la consigne est un argument séparé et son contenu reste intact', async () => {
  const message='Corrige "ceci"\n$(secret) & <script>test</script>';
  let written;
  const bridge=createHerdr({run:async(args)=> {
    if(args[1]==='prompt'){written=args;return JSON.stringify({result:{type:'agent_prompted'}});}
    return JSON.stringify({result:{agents:[raw]}});
  }});
  await bridge.prompt(normalizeAgent(raw).id,message);
  assert.deepEqual(written,['agent','prompt','w5:p4',message]);
});
test('aucun double envoi simultané au même agent', async () => {
  let release;
  const bridge=createHerdr({run:async(args)=> {
    if(args[1]==='prompt'){await new Promise(r=>release=r);return '{"result":{"type":"agent_prompted"}}';}
    return JSON.stringify({result:{agents:[raw]}});
  }});
  const id=normalizeAgent(raw).id;
  const first=bridge.prompt(id,'A');
  while(!release) await new Promise(r=>setTimeout(r,1));
  await assert.rejects(bridge.prompt(id,'B'),/envoi/);
  release(); await first;
});
test('lecture du terminal comme texte et panne Herdr explicite', async () => {
  const bridge=createHerdr({run:async(args)=>args[1]==='list'?JSON.stringify({result:{agents:[raw]}}):'<script>texte</script>'});
  assert.equal((await bridge.read(normalizeAgent(raw).id)).text,'<script>texte</script>');
  await assert.rejects(createHerdr({run:async()=>'{invalide'}).list(),/illisible/);
});
test('la lecture d’un agent actif ne fait pas défiler son terminal', async () => {
  let readArgs;
  const bridge=createHerdr({run:async(args)=> {
    if(args[1]==='list') return JSON.stringify({result:{agents:[{...raw,agent_status:'working'}]}});
    readArgs=args; return 'Travail en cours';
  }});
  await bridge.read(normalizeAgent(raw).id);
  assert.equal(readArgs[4],'visible');
});
