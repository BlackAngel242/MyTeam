import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {parseClaudeResponses,readClaudeResponses,mask} from '../src/responses.mjs';
import {createBureauServer} from '../server.mjs';

const SESSION='12345678-1234-1234-1234-123456789abc';
const user=(uuid,text,at)=>JSON.stringify({type:'user',uuid,timestamp:at,message:{role:'user',content:text}});
const reply=(text,at,stop)=>JSON.stringify({type:'assistant',timestamp:at,message:{role:'assistant',stop_reason:stop,content:[{type:'thinking',thinking:'secret interne'},{type:'text',text},{type:'tool_use',name:'Bash',input:{command:'x'}}]}});

test('une réponse regroupe les textes d\'un tour, avec son état observé',()=>{
  const out=parseClaudeResponses([
    user('u1','Bonjour','2026-10-18T10:00:00Z'),reply('Premier paragraphe','2026-10-18T10:00:05Z','tool_use'),
    JSON.stringify({type:'user',timestamp:'2026-10-18T10:00:06Z',message:{content:[{type:'tool_result',content:'ok'}]}}),
    reply('Voici le résultat avec accents é à et emoji 🎉','2026-10-18T10:00:09Z','end_turn'),
    user('u2','Deuxième','2026-10-18T10:01:00Z'),reply('Début coupé','2026-10-18T10:01:02Z','tool_use'),
    JSON.stringify({type:'user',timestamp:'2026-10-18T10:01:03Z',message:{content:[{type:'text',text:'[Request interrupted by user]'}]}}),
    user('u3','Troisième','2026-10-18T10:02:00Z'),reply('En cours','2026-10-18T10:02:01Z','tool_use'),
  ],SESSION);
  assert.deepEqual(out.map(r=>r.state),['terminée','interrompue','fin non déterminée']);
  assert.deepEqual(out[0].blocks.map(b=>b.text),['Premier paragraphe','Voici le résultat avec accents é à et emoji 🎉']);
  assert.equal(out[0].startedAt,'2026-10-18T10:00:00.000Z');
  assert.equal(out[0].endedAt,'2026-10-18T10:00:09.000Z');
  assert.match(out[0].key,/^[0-9a-f]{16}$/);
  assert.equal(new Set(out.map(r=>r.key)).size,3);
  assert.doesNotMatch(JSON.stringify(out),/secret interne|Bash|12345678/);
});

test('les secrets, identifiants et chemins personnels sont masqués sans toucher aux routes',()=>{
  const bs=String.fromCharCode(92);
  const text=mask('voir C:'+bs+'Users'+bs+'Moi'+bs+'a.txt, ~/.ssh/id, /etc/passwd, /api/reponses, session 12345678-1234-1234-1234-123456789abc, token=abcdef123456, ghp_abcdefghijklmnopqrstuvwxyz');
  assert.doesNotMatch(text,/Moi|\.ssh|passwd|12345678|abcdef123456|ghp_/);
  assert.match(text,/\/api\/reponses/);
});

test('une ligne illisible ou géante est sautée, une session inconnue ne renvoie rien',async t=>{
  const root=await mkdtemp(join(tmpdir(),'reponses-'));t.after(()=>rm(root,{recursive:true,force:true}));
  assert.equal(parseClaudeResponses(['{pas du json',user('u','Q','2026-10-18T10:00:00Z'),reply('R','2026-10-18T10:00:01Z','end_turn')],SESSION).length,1);
  assert.deepEqual(await readClaudeResponses(SESSION,{root}),{found:false,complete:false,responses:[]});
  assert.deepEqual(await readClaudeResponses('../../x',{root}),{found:false,complete:false,responses:[]});
  await mkdir(join(root,'projet'));
  await writeFile(join(root,'projet',SESSION+'.jsonl'),[user('u','Q','2026-10-18T10:00:00Z'),reply('R','2026-10-18T10:00:01Z','end_turn')].join('\n'));
  const lu=await readClaudeResponses(SESSION,{root});
  assert.equal(lu.found,true);assert.equal(lu.complete,true);assert.equal(lu.responses.length,1);
});

test('/api/reponses exige origine et jeton et ne renvoie aucun identifiant',async t=>{
  let reads=0;
  const bridge={list:async()=>[{id:'c',kind:'Claude',status:'idle',sessionId:SESSION},{id:'x',kind:'Codex',status:'idle'}],read:async()=>({text:''})};
  const server=createBureauServer({bridge,getResponses:async id=>{reads++;assert.equal(id,SESSION);return {found:true,complete:true,responses:[{key:'abc',state:'terminée',blocks:[{text:'ok'}]}]};}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const port=server.address().port,origin=`http://127.0.0.1:${port}`;
  const send=(path,headers={})=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path,headers:{Host:`127.0.0.1:${port}`,...headers}},res=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(s)}));});req.on('error',reject);req.end();});
  const {data:{token}}=await send('/api/state');
  assert.equal((await send('/api/reponses?id=c')).status,403);
  assert.equal(reads,0);
  const auth={Origin:origin,'X-Bureau-Token':token};
  const claude=await send('/api/reponses?id=c',auth);
  assert.equal(claude.status,200);assert.equal(claude.data.supported,true);assert.equal(claude.data.responses[0].blocks[0].text,'ok');
  assert.doesNotMatch(JSON.stringify(claude.data),/12345678|sessionId/);
  const codex=await send('/api/reponses?id=x',auth);
  assert.equal(codex.data.supported,true);assert.equal(codex.data.found,false);assert.deepEqual(codex.data.responses,[]);
  assert.equal((await send('/api/reponses?id=inconnu',auth)).status,400);
});

test('/api/discussion fusionne les réponses lisibles, du plus récent au plus ancien, sans identifiant de session',async t=>{
  const bridge={list:async()=>[
    {id:'c',name:'Claude',kind:'Claude',status:'idle',sessionId:SESSION},{id:'x',name:'Codex',kind:'Codex',status:'idle'},
    {id:'a',name:'Antigravity',kind:'Antigravity',status:'idle'},{id:'o',name:'OpenCode',kind:'OpenCode',status:'idle'}],read:async()=>({text:''})};
  const long='é'.repeat(400);
  const server=createBureauServer({bridge,
    getResponses:async()=>({found:true,complete:true,responses:[{key:'k1',startedAt:'2026-10-18T10:00:00Z',endedAt:'2026-10-18T10:00:09Z',state:'terminée',blocks:[{text:long}]}]}),
    getOtherResponses:async agent=>agent.kind==='Codex'?{found:true,complete:true,responses:[{key:'k2',startedAt:'2026-10-18T11:00:00Z',endedAt:null,state:'fin non déterminée',blocks:[{text:'Codex écrit'}]}]}:{found:false,complete:false,responses:[]}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const port=server.address().port,origin=`http://127.0.0.1:${port}`;
  const send=(path,headers={})=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path,headers:{Host:`127.0.0.1:${port}`,...headers}},res=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(s)}));});req.on('error',reject);req.end();});
  const {data:{token}}=await send('/api/state');
  assert.equal((await send('/api/discussion')).status,403);
  const r=await send('/api/discussion',{Origin:origin,'X-Bureau-Token':token});
  assert.equal(r.status,200);
  assert.deepEqual(r.data.bulles.map(b=>b.agent),['Codex','Claude']);
  assert.equal(Array.from(r.data.bulles[1].extrait).length,240);
  assert.deepEqual(Object.fromEntries(r.data.sources.map(s=>[s.agent,s.etat])),{Claude:'lu',Codex:'lu',Antigravity:'non exposé',OpenCode:'non rattaché'});
  assert.doesNotMatch(JSON.stringify(r.data),/12345678|sessionId/);
});

test('le masque couvre aussi racines usuelles, clés Google, jetons fins, empreintes et digests',()=>{
  const text=mask('/workspace/projet/a.mjs /srv/y /data/x AIza'+'a'.repeat(35)+' github_pat_'+'b'.repeat(30)+' w5:p1@d234f56741fc0479 '+'e3b0c442'.repeat(8)+' et la route /api/reponses');
  assert.doesNotMatch(text,/workspace|\/srv|\/data|AIza|github_pat_|d234f567|e3b0c442/);
  assert.match(text,/\/api\/reponses/);
});

test('un chemin Windows contenant une espace est masqué en entier, sans avaler la phrase',()=>{
  const text=mask('Revue écrite : [x](<C:/Users/Moi/Projet Exemple/IA DESKTOP/docs/revue.md>). Suite du texte.');
  assert.doesNotMatch(text,/DESKTOP|revue\.md|Projet Exemple/);
  assert.match(text,/Suite du texte/);
  assert.match(mask('voir C:/a/b.txt, puis la suite'),/puis la suite/);
});

test('un tour en cours dont le début est hors de la partie lue du journal garde ses textes', () => {
  const out = parseClaudeResponses([reply('Texte venu d\'un tour commencé plus haut', '2026-10-18T10:00:05Z', 'tool_use'), reply('Suite', '2026-10-18T10:00:09Z', 'end_turn')], SESSION);
  assert.equal(out.length, 1);
  assert.equal(out[0].state, 'terminée');
  assert.deepEqual(out[0].blocks.map(b => b.text), ['Texte venu d\'un tour commencé plus haut', 'Suite']);
});
