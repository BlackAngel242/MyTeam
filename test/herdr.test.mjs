import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHerdr, normalizeAgent, findHerdr} from '../src/herdr.mjs';
import {mkdtemp,mkdir,writeFile,utimes,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const raw = {pane_id:'w5:p4', terminal_id:'term_1', agent:'codex', agent_status:'idle', cwd:'C:/projet'};
test('Herdr : le chemin explicite reste prioritaire',()=>{
  assert.equal(findHerdr({env:{BUREAU_HERDR_PATH:'C:/outil-personnel/herdr.exe'},home:'absent'}),'C:/outil-personnel/herdr.exe');
});
test('Herdr : choisit le dossier installe le plus recent et ignore une version incomplete',async t=>{
  const home=await mkdtemp(join(tmpdir(),'herdr-discovery-'));
  t.after(()=>rm(home,{recursive:true,force:true}));
  const root=join(home,'.herdr','packages','standalone','releases');
  for(const [name,time]of [['0.9.5',1000],['0.10.0',2000],['incomplete',3000]]) {
    const directory=join(root,name);
    await mkdir(directory,{recursive:true});
    if(name!=='incomplete') await writeFile(join(directory,'herdr.exe'),'factice');
    await utimes(directory,new Date(time),new Date(time));
  }
  assert.equal(findHerdr({home,env:{},platform:'win32'}),join(root,'0.10.0','herdr.exe'));
  await utimes(join(root,'0.9.5'),new Date(4000),new Date(4000));
  assert.equal(findHerdr({home,env:{},platform:'win32'}),join(root,'0.9.5','herdr.exe'));
});
test('Herdr : binaire sans extension hors Windows et repli vers le PATH',async t=>{
  const home=await mkdtemp(join(tmpdir(),'herdr-portable-'));
  t.after(()=>rm(home,{recursive:true,force:true}));
  assert.equal(findHerdr({home,env:{},platform:'linux'}),'herdr');
  const directory=join(home,'.herdr','packages','standalone','releases','version-native');
  await mkdir(directory,{recursive:true});
  await writeFile(join(directory,'herdr'),'factice');
  assert.equal(findHerdr({home,env:{},platform:'linux'}),join(directory,'herdr'));
  assert.equal(findHerdr({home,env:{},platform:'win32'}),'herdr');
});
test('les noms de types en minuscules deviennent des noms propres, les noms personnels restent',()=>{
  for(const [agent,name,expected]of [['claude','claude','Claude'],['codex','codex','Codex'],['agy','antigravity','Antigravity'],['agy','agy','Antigravity'],['antigravity','antigravity','Antigravity'],['opencode','opencode','OpenCode'],['gemini','gemini','Gemini']]) {
    assert.equal(normalizeAgent({...raw,agent,name}).name,expected);
  }
  assert.equal(normalizeAgent({...raw,name:'Mon assistant'}).name,'Mon assistant');
  assert.equal(normalizeAgent({...raw,name:'CODEX'}).name,'CODEX');
  assert.equal(normalizeAgent({...raw,agent:'agy',display_agent:'antigravity'}).name,'Antigravity');
});
test('seul Claude conserve un identifiant de session interne', () => {
  const agent_session={value:'12345678-1234-1234-1234-123456789abc'};
  assert.equal(normalizeAgent({...raw,agent:'claude',agent_session}).sessionId,agent_session.value);
  assert.equal(Object.hasOwn(normalizeAgent({...raw,agent_session}),'sessionId'),false);
});
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
test('un envoi groupe continue après un échec et ne réessaie jamais', async () => {
  const attempts={};
  const bridge=createHerdr({run:async(args)=> {
    if(args[1]==='list') return JSON.stringify({result:{agents:[
      {pane_id:'w5:p1',terminal_id:'term_1',agent:'claude',agent_status:'done'},
      {pane_id:'w5:p2',terminal_id:'term_2',agent:'codex',agent_status:'idle'},
      {pane_id:'w5:p3',terminal_id:'term_3',agent:'agy',agent_status:'idle'},
    ]}});
    if(args[1]==='prompt') {
      const pane=args[2];
      attempts[pane]=(attempts[pane]||0)+1;
      return pane==='w5:p1'?'{"result":{}}':JSON.stringify({result:{type:'agent_prompted'}});
    }
    return '{}';
  }});
  const ids=(await bridge.list()).map(a=>a.id);
  const {results}=await bridge.broadcast(ids,'Bonjour');
  assert.deepEqual(attempts,{'w5:p1':1,'w5:p2':1,'w5:p3':1});
  assert.deepEqual(results.map(r=>r.ok),[false,true,true]);
  assert.match(results[0].error,/confirmé/);
  assert.deepEqual(results.map(r=>r.name),['Claude','Codex','Antigravity']);
});
test('une consigne de groupe invalide est refusée avant tout envoi', async () => {
  let writes=0;
  const bridge=createHerdr({run:async(args)=> {
    if(args[1]==='prompt') writes++;
    return JSON.stringify({result:{agents:[raw]}});
  }});
  const id=normalizeAgent(raw).id;
  await assert.rejects(bridge.broadcast([id],''),/consigne/);
  await assert.rejects(bridge.broadcast([id],'é'.repeat(12001)),/consigne/);
  await assert.rejects(bridge.broadcast([id],'a\0b'),/consigne/);
  assert.equal(writes,0);
});
test('un envoi groupe signale les agents introuvables sans arrêter les suivants', async () => {
  const bridge=createHerdr({run:async(args)=> {
    if(args[1]==='list') return JSON.stringify({result:{agents:[raw]}});
    return JSON.stringify({result:{type:'agent_prompted'}});
  }});
  const id=normalizeAgent(raw).id;
  const {results}=await bridge.broadcast(['agent-inconnu',id],'Bonjour');
  assert.equal(results.length,2);
  assert.equal(results[0].ok,false);
  assert.match(results[0].error,/introuvable/);
  assert.equal(results[1].ok,true);
});
