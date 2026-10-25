import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,lstat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createUpdater,extractZip,newer} from '../src/update.mjs';

const release='0.5.0',base=`https://github.com/BlackAngel242/MyTeam/releases/download/v${release}/MyTeam-${release}.zip`;
const archive=()=>{
 const entries=[[`MyTeam-${release}/package.json`,Buffer.from(JSON.stringify({version:release}))],[`MyTeam-${release}/server.mjs`,Buffer.from('server')]];
 const locals=[],central=[];let offset=0;
 for(const [name,content] of entries){
  const n=Buffer.from(name),local=Buffer.alloc(30),directory=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(content.length,18);local.writeUInt32LE(content.length,22);local.writeUInt16LE(n.length,26);
  directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt32LE(content.length,20);directory.writeUInt32LE(content.length,24);directory.writeUInt16LE(n.length,28);directory.writeUInt32LE(offset,42);
  locals.push(local,n,content);central.push(directory,n);offset+=local.length+n.length+content.length;
 }
 const c=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(c.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,c,end]);
};
const setup=async()=>{
 const temp=await mkdtemp(join(tmpdir(),'myteam-updater-')),root=join(temp,'MyTeam'),dataRoot=join(temp,'data');
 await mkdir(root);await writeFile(join(root,'package.json'),JSON.stringify({version:'0.4.2'}));
 const zip=archive(),sha=createHash('sha256').update(zip).digest('hex');
 const fetcher=async url=>{
  if(url.includes('api.github.com'))return new Response(JSON.stringify({tag_name:`v${release}`,assets:[{name:`MyTeam-${release}.zip`,browser_download_url:base,digest:`sha256:${sha}`},{name:`MyTeam-${release}.zip.sha256`,browser_download_url:base+'.sha256'}]}));
  return new Response(url.endsWith('.sha256')?`${sha}  MyTeam-${release}.zip\n`:zip);
 };
 return {temp,root,dataRoot,zip,fetcher};
};
test('version comparison is numeric',()=>{
 assert.equal(newer('0.10.0','0.9.9'),true);assert.equal(newer('0.5.0','0.5.0'),false);assert.equal(newer('0.4.9','0.5.0'),false);
});
test('release archive is read, traversal and code injection rejected',()=>{
 const zip=archive();assert.equal(extractZip(zip,release).length,2);
 const tampered=Buffer.from(zip);const needle=Buffer.from('MyTeam-0.5.0/server.mjs');const at=tampered.indexOf(needle);
 assert.ok(at>0);tampered.write('MyTeam-0.5.0/../../x.mjs',at,'utf8');
 assert.throws(()=>extractZip(tampered,release),/Archive|Contenu/);
});
test('prepare downloads verified release and preserves local configuration',async t=>{
 const s=await setup();t.after(()=>rm(s.temp,{recursive:true,force:true}));
 await mkdir(join(s.root,'.bureau'));await writeFile(join(s.root,'.bureau','port.json'),'private');
 const updater=createUpdater({...s,version:'0.4.2'});const available=await updater.check();assert.equal(available.available,true);
 const ready=await updater.prepare();assert.equal(ready.ready,'0.5.0');
 const stages=await import('node:fs/promises').then(fs=>fs.readdir(s.temp));const stage=stages.find(x=>x.startsWith('.myteam-stage-'));
 assert.equal(JSON.parse(await readFile(join(s.temp,stage,'package.json'),'utf8')).version,release);
 assert.equal(await readFile(join(s.temp,stage,'.bureau','port.json'),'utf8'),'private');
 assert.equal((await lstat(join(s.root,'package.json'))).isFile(),true);
});
test('copy in a Git checkout is refused without touching files',async t=>{
 const s=await setup();t.after(()=>rm(s.temp,{recursive:true,force:true}));await mkdir(join(s.root,'.git'));
 const updater=createUpdater({...s,version:'0.4.2'});
 await assert.rejects(updater.prepare(),/Copie Git/);
 assert.equal(await readFile(join(s.root,'package.json'),'utf8'),'{"version":"0.4.2"}');
});
test('mismatched SHA refuses installation',async t=>{
 const s=await setup();t.after(()=>rm(s.temp,{recursive:true,force:true}));
 const original=s.fetcher;s.fetcher=async url=>url.endsWith('.sha256')?new Response(`${'0'.repeat(64)}  MyTeam-0.5.0.zip\n`):original(url);
 await assert.rejects(createUpdater({...s,version:'0.4.2'}).prepare(),/SHA-256/);
});

test('U3: a refused SHA-256 leaves no staging directory behind',async t=>{
 const s=await setup();t.after(()=>rm(s.temp,{recursive:true,force:true}));
 const original=s.fetcher;s.fetcher=async url=>url.endsWith('.sha256')?new Response(`${'0'.repeat(64)}  MyTeam-0.5.0.zip\n`):original(url);
 await assert.rejects(createUpdater({...s,version:'0.4.2'}).prepare(),/SHA-256/);
 const leftovers=(await import('node:fs/promises').then(fs=>fs.readdir(s.temp))).filter(x=>x.startsWith('.myteam-stage-'));
 assert.deepEqual(leftovers,[]);
});

test('install triggers the helper, which swaps the installation once the app stops',async t=>{
 const {spawn}=await import('node:child_process');
 const {copyFile,readdir}=await import('node:fs/promises');
 const temp=await mkdtemp(join(tmpdir(),'myteam-install-')),root=join(temp,'MyTeam'),dataRoot=join(temp,'data');
 const pids=[];
 t.after(async()=>{for(const pid of pids)try{process.kill(pid);}catch{}await rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 await mkdir(join(root,'src'),{recursive:true});
 await copyFile(new URL('../src/update.mjs',import.meta.url),join(root,'src','update.mjs'));
 await copyFile(new URL('../src/update-helper.mjs',import.meta.url),join(root,'src','update-helper.mjs'));
 await writeFile(join(root,'package.json'),JSON.stringify({version:'0.4.2'}));
 await mkdir(join(root,'.bureau'));await writeFile(join(root,'.bureau','marker.txt'),'local-config');
 const newServer=`import {createServer} from 'node:http';import {writeFileSync} from 'node:fs';writeFileSync('child.pid',String(process.pid));createServer((req,res)=>res.end('ready')).listen(process.env.BUREAU_PORT,'127.0.0.1');`;
 const entries=[[`MyTeam-${release}/package.json`,Buffer.from(JSON.stringify({version:release}))],[`MyTeam-${release}/server.mjs`,Buffer.from(newServer)]];
 const locals=[],central=[];let offset=0;
 for(const [name,content] of entries){
  const n=Buffer.from(name),local=Buffer.alloc(30),directory=Buffer.alloc(46);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(content.length,18);local.writeUInt32LE(content.length,22);local.writeUInt16LE(n.length,26);
  directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt32LE(content.length,20);directory.writeUInt32LE(content.length,24);directory.writeUInt16LE(n.length,28);directory.writeUInt32LE(offset,42);
  locals.push(local,n,content);central.push(directory,n);offset+=local.length+n.length+content.length;
 }
 const c=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(c.length,12);end.writeUInt32LE(offset,16);
 const zip=Buffer.concat([...locals,c,end]),sha=createHash('sha256').update(zip).digest('hex');
 const zipFile=join(temp,'release.zip');await writeFile(zipFile,zip);
 const app=`import {createServer} from 'node:http';import {readFileSync} from 'node:fs';import {createUpdater} from './src/update.mjs';
const port=Number(process.env.BUREAU_PORT),zip=readFileSync(process.env.RELEASE_ZIP),sha=process.env.RELEASE_SHA,base=${JSON.stringify(base)};
const fetcher=async url=>{if(url.includes('api.github.com'))return new Response(JSON.stringify({tag_name:'v${release}',assets:[{name:'MyTeam-${release}.zip',browser_download_url:base,digest:'sha256:'+sha},{name:'MyTeam-${release}.zip.sha256',browser_download_url:base+'.sha256'}]}));return new Response(url.endsWith('.sha256')?sha+'  MyTeam-${release}.zip':zip);};
const server=createServer((req,res)=>res.end('old'));
server.listen(port,'127.0.0.1',async()=>{try{const updater=createUpdater({dataRoot:process.env.DATA_ROOT,fetcher,port:()=>port});await updater.prepare();await updater.install();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();}catch(e){console.error(e);process.exit(2);}});`;
 await writeFile(join(root,'server.mjs'),app);
 const {createServer:netServer}=await import('node:net');
 const probe=netServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const p=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,[join(root,'server.mjs')],{cwd:root,env:{...process.env,BUREAU_PORT:String(p),RELEASE_ZIP:zipFile,RELEASE_SHA:sha,DATA_ROOT:dataRoot},stdio:'ignore'});
 pids.push(child.pid);
 const ready=await (async()=>{const start=Date.now();while(Date.now()-start<30000){try{if((await (await fetch(`http://127.0.0.1:${p}`)).text())==='ready')return true;}catch{}await new Promise(r=>setTimeout(r,150));}return false;})();
 assert.equal(ready,true,'the new server responds on the same port after the swap');
 assert.equal(JSON.parse(await readFile(join(root,'package.json'),'utf8')).version,release);
 assert.equal(await readFile(join(root,'.bureau','marker.txt'),'utf8'),'local-config');
 pids.push(Number(await readFile(join(root,'child.pid'),'utf8')));
 const backup=(await readdir(temp)).find(name=>name.startsWith('.myteam-backup-'));
 assert.ok(backup,'a backup of the previous installation exists');
 assert.equal(JSON.parse(await readFile(join(temp,backup,'package.json'),'utf8')).version,'0.4.2');
});

test('update API requires session token and same origin before preparing',async t=>{
 const {createBureauServer}=await import('../server.mjs');
 let prepared=0;
 const fake={check:async()=>({installed:'0.5.0',latest:'0.6.0',available:true}),prepare:async()=>{prepared++;return {ready:'0.6.0'};},install:async()=>({restarting:true})};
 const server=createBureauServer({bridge:{list:async()=>[]},updater:fake,stopForUpdate:()=>{}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const token=(await (await fetch(origin+'/api/state',{headers:{'Sec-Fetch-Site':'same-origin'}})).json()).token;
 const send=(headers={})=>fetch(origin+'/api/update',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:'{"action":"prepare"}'});
 assert.equal((await send()).status,403);
 assert.equal((await send({'X-Bureau-Token':token,Origin:'http://evil.invalid'})).status,403);
 assert.equal(prepared,0);
 assert.equal((await send({'X-Bureau-Token':token})).status,200);
 assert.equal(prepared,1);
});
