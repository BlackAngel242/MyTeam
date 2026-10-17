import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {mkdtemp, mkdir, writeFile, readFile, access, rm, realpath, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBureauServer} from '../server.mjs';

async function fixture(t, options = {}) {
  const base = await mkdtemp(join(tmpdir(), 'bureau-routes-'));
  const work = join(base, 'agent'), desktop = join(base, 'bureau');
  await Promise.all([mkdir(work), mkdir(desktop)]);
  await writeFile(join(work, 'rapport.txt'), 'rapport original');
  let agents = [{id:'agent-1', name:'Agent factice', kind:'Agent', cwd:work}];
  const server = createBureauServer({
    bridge:{list:async()=>agents},
    getPlaces:()=>({bureau:{label:'Bureau', path:desktop}, documents:{label:'Documents'}, telechargements:{label:'Téléchargements'}}),
    ...options,
  });
  await new Promise(resolve=>server.listen(0, '127.0.0.1', resolve));
  t.after(async()=>{
    await new Promise(resolve=>server.close(resolve));
    await rm(base, {recursive:true, force:true});
  });
  const port = server.address().port, origin = `http://127.0.0.1:${port}`;
  const send = (path, {method='GET', headers={}, body}={})=>new Promise((resolve, reject)=>{
    const req = request({hostname:'127.0.0.1', port, path, method, headers:{Host:`127.0.0.1:${port}`, ...headers}}, res=>{
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk=>text+=chunk);
      res.on('end', ()=>{
        let data; try { data=JSON.parse(text); } catch { data=text; }
        resolve({status:res.statusCode, data});
      });
    });
    req.on('error', reject);
    req.end(body);
  });
  const {data:{token}} = await send('/api/state');
  const headers = {Origin:origin, 'X-Bureau-Token':token};
  const post = (path, data)=>send(path, {method:'POST', headers:{...headers, 'Content-Type':'application/json'}, body:JSON.stringify(data)});
  const privateFree = response=>{
    const json = JSON.stringify(response.data);
    for (const path of [base, work, desktop]) assert.ok(!json.includes(path), 'aucun chemin absolu dans la réponse');
    assert.doesNotMatch(json, /[A-Za-z]:[\\/]/);
  };
  return {send, post, headers, work, desktop, privateFree, setAgents:value=>{agents=value;}};
}

test('les trois lectures de fichiers exigent origine exacte et jeton même sans Content-Type', async t=>{
  const f = await fixture(t);
  for (const route of ['/api/places', '/api/files/recent?id=agent-1', '/api/files/list?root=agent%3Aagent-1&path=']) {
    for (const headers of [{}, {Origin:f.headers.Origin}, {'X-Bureau-Token':f.headers['X-Bureau-Token']}, {...f.headers, Origin:'http://localhost:4317'}, {...f.headers, 'X-Bureau-Token':'faux'}]) {
      assert.equal((await f.send(route, {headers})).status, 403);
    }
    const response = await f.send(route, {headers:f.headers});
    assert.equal(response.status, 200);
    f.privateFree(response);
  }
});

test('lieux, liste et fichiers récents utilisent uniquement les racines du serveur', async t=>{
  const f = await fixture(t);
  const places = await f.send('/api/places', {headers:f.headers});
  assert.deepEqual(places.data.places.map(p=>p.key).sort(), ['agent:agent-1', 'bureau']);
  assert.ok(places.data.places.every(p=>['agent', 'place'].includes(p.kind)));
  const listed = await f.send('/api/files/list?root=agent%3Aagent-1&path=', {headers:f.headers});
  assert.equal(listed.data.root, 'agent:agent-1');
  assert.equal(listed.data.path, '');
  assert.equal(listed.data.items[0].path, 'rapport.txt');
  const recent = await f.send('/api/files/recent?id=agent-1', {headers:f.headers});
  assert.equal(recent.data.root, 'agent:agent-1');
  assert.equal(recent.data.files[0].name, 'rapport.txt');
  for (const response of [places, listed, recent]) f.privateFree(response);
});

test('racines inconnues, chemin absolu interne et sortie de racine sont refusés', async t=>{
  const f = await fixture(t);
  for (const route of [
    '/api/files/list?root=inconnue', '/api/files/recent?id=inconnu',
    `/api/files/list?root=agent%3Aagent-1&path=${encodeURIComponent(f.work)}`,
    '/api/files/list?root=agent%3Aagent-1&path=..',
  ]) {
    const response = await f.send(route, {headers:f.headers});
    assert.equal(response.status, 400);
    f.privateFree(response);
  }
  const response = await f.post('/api/files/transfer', {from:{root:'inconnue', path:'rapport.txt'}, to:{root:'bureau', path:''}, mode:'copy'});
  assert.equal(response.status, 400);
  f.privateFree(response);
});

test('un agent disparu perd immédiatement sa racine', async t=>{
  const f = await fixture(t);
  assert.equal((await f.send('/api/files/list?root=agent%3Aagent-1', {headers:f.headers})).status, 200);
  f.setAgents([]);
  assert.equal((await f.send('/api/files/list?root=agent%3Aagent-1', {headers:f.headers})).status, 400);
  assert.equal((await f.send('/api/files/recent?id=agent-1', {headers:f.headers})).status, 400);
  const places = await f.send('/api/places', {headers:f.headers});
  assert.ok(places.data.places.every(p=>p.key!=='agent:agent-1'));
});

test('transfert réel en copie puis déplacement sans écraser un fichier existant', async t=>{
  const f = await fixture(t);
  await writeFile(join(f.desktop, 'rapport.txt'), 'à conserver');
  const payload = {from:{root:'agent:agent-1', path:'rapport.txt'}, to:{root:'bureau', path:''}, mode:'copy'};
  const copied = await f.post('/api/files/transfer', payload);
  assert.equal(copied.status, 200);
  assert.deepEqual(copied.data, {ok:true, name:'rapport (2).txt', path:'rapport (2).txt', mode:'copy'});
  assert.equal(await readFile(join(f.desktop, 'rapport.txt'), 'utf8'), 'à conserver');
  assert.equal(await readFile(join(f.desktop, copied.data.path), 'utf8'), 'rapport original');
  assert.equal(await readFile(join(f.work, 'rapport.txt'), 'utf8'), 'rapport original');
  const moved = await f.post('/api/files/transfer', {...payload, mode:'move'});
  assert.equal(moved.status, 200);
  assert.deepEqual(moved.data, {ok:true, name:'rapport (3).txt', path:'rapport (3).txt', mode:'move'});
  await assert.rejects(access(join(f.work, 'rapport.txt')), {code:'ENOENT'});
  assert.equal(await readFile(join(f.desktop, moved.data.path), 'utf8'), 'rapport original');
  for (const response of [copied, moved]) f.privateFree(response);
});

test('les écritures exigent aussi origine et jeton', async t=>{
  const f = await fixture(t);
  for (const route of ['/api/files/transfer', '/api/files/reveal']) {
    const response = await f.send(route, {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
    assert.equal(response.status, 403);
  }
});

test('révélation Windows sans shell, code 1 ignoré et aucune ouverture pour une racine inconnue', async t=>{
  const calls = [];
  const f = await fixture(t, {platform:'win32', executeFile:async(...args)=>{
    calls.push(args);
    throw Object.assign(new Error('code habituel'), {code:1});
  }});
  const bad = await f.post('/api/files/reveal', {root:'inconnue', path:'rapport.txt'});
  assert.equal(bad.status, 400);
  assert.equal(calls.length, 0);
  const response = await f.post('/api/files/reveal', {root:'agent:agent-1', path:'rapport.txt'});
  assert.equal(response.status, 200);
  assert.deepEqual(response.data, {ok:true});
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'explorer.exe');
  assert.deepEqual(calls[0][1], ['/select,' + await realpath(join(f.work, 'rapport.txt'))]);
  assert.ok(!calls[0][2]?.shell);
  f.privateFree(response);
});

test('révélation hors Windows renvoie 501 sans lancer de processus', async t=>{
  let called = false;
  const f = await fixture(t, {platform:'linux', executeFile:async()=>{called=true;}});
  const response = await f.post('/api/files/reveal', {root:'agent:agent-1', path:'rapport.txt'});
  assert.equal(response.status, 501);
  assert.equal(called, false);
  f.privateFree(response);
});

test('une panne Explorer renvoie 500 sans divulguer le chemin de son erreur', async t=>{
  const f = await fixture(t, {platform:'win32', executeFile:async()=>{
    throw Object.assign(new Error('échec C:/secret/rapport.txt'), {code:2});
  }});
  const response = await f.post('/api/files/reveal', {root:'agent:agent-1', path:'rapport.txt'});
  assert.equal(response.status, 500);
  assert.doesNotMatch(JSON.stringify(response.data), /secret|rapport\.txt|C:/);
  f.privateFree(response);
});

test('deux deplacements simultanes gardent les deux fichiers de meme nom',async t=>{
  const f=await fixture(t);
  for(const directory of ['premier','second']) {
    await mkdir(join(f.work,directory));
    await writeFile(join(f.work,directory,'meme.txt'),directory);
  }
  const responses=await Promise.all(['premier','second'].map(directory=>f.post('/api/files/transfer',{
    from:{root:'agent:agent-1',path:directory+'/meme.txt'},to:{root:'bureau',path:''},mode:'move',
  })));
  assert.ok(responses.every(response=>response.status===200));
  assert.equal(new Set(responses.map(response=>response.data.path)).size,2);
  const contents=await Promise.all(responses.map(response=>readFile(join(f.desktop,response.data.path),'utf8')));
  assert.deepEqual(contents.sort(),['premier','second']);
  for(const response of responses) f.privateFree(response);
});

test('un lien vers un dossier interne est refuse sans etre suivi',async t=>{
  const f=await fixture(t);
  await mkdir(join(f.work,'reel'));
  try {await symlink(join(f.work,'reel'),join(f.work,'raccourci'),process.platform==='win32'?'junction':'dir');}
  catch(error) {if(['EPERM','EACCES'].includes(error.code)) return t.skip('Liens non autorises sur ce poste');throw error;}
  const response=await f.send('/api/files/list?root=agent%3Aagent-1&path=raccourci',{headers:f.headers});
  assert.equal(response.status,400);
  assert.match(response.data.error,/liens symboliques/);
  f.privateFree(response);
});
