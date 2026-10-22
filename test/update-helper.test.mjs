import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';

async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
test('helper swaps a ZIP installation and starts the new server',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'myteam-restart-')),root=join(temp,'MyTeam'),stage=join(temp,'stage'),helper=join(temp,'helper.mjs'),manifest=helper+'.json',p=await port();
 let running;
 t.after(async()=>{if(running)try{process.kill(running);}catch{}await rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 await mkdir(root);await mkdir(stage);
 await writeFile(join(root,'old.txt'),'previous');
 await writeFile(join(stage,'package.json'),'{"version":"0.6.0"}');
 await writeFile(join(stage,'server.mjs'),`import {createServer} from 'node:http';import {writeFileSync} from 'node:fs';writeFileSync('child.pid',String(process.pid));createServer((req,res)=>res.end('ready')).listen(process.env.BUREAU_PORT,'127.0.0.1');`);
 await copyFile(new URL('../src/update-helper.mjs',import.meta.url),helper);
 await writeFile(manifest,JSON.stringify({root,stage,pid:999999999,port:p,version:'0.6.0'}));
 const child=spawn(process.execPath,[helper,manifest],{cwd:temp,stdio:'ignore'});
 for(let i=0;i<100;i++){
  try{running=Number(await readFile(join(root,'child.pid'),'utf8'));if((await fetch(`http://127.0.0.1:${p}`)).ok)break;}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(running,'new server started');
 assert.equal((await (await fetch(`http://127.0.0.1:${p}`)).text()),'ready');
 const backup=(await readdir(temp)).find(name=>name.startsWith('.myteam-backup-'));
 assert.equal(await readFile(join(temp,backup,'old.txt'),'utf8'),'previous');
 await new Promise(r=>child.on('exit',r));
});

const serverSource=(marker,body)=>`import {createServer} from 'node:http';import {writeFileSync} from 'node:fs';writeFileSync('${marker}',String(process.pid));createServer((req,res)=>res.end('${body}')).listen(process.env.BUREAU_PORT,'127.0.0.1');`;
async function waitFor(condition,timeout=15000){
 const start=Date.now();
 while(Date.now()-start<timeout){if(await condition())return true;await new Promise(r=>setTimeout(r,100));}
 return false;
}
const reachable=async p=>{try{return (await fetch(`http://127.0.0.1:${p}`)).ok;}catch{return false;}};

test('U6: helper waits for the running server to stop, then swaps and starts the new server',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'myteam-u6-')),root=join(temp,'MyTeam'),stage=join(temp,'stage'),helper=join(temp,'helper.mjs'),manifest=helper+'.json',p=await port();
 const pids=[];
 t.after(async()=>{for(const pid of pids)try{process.kill(pid);}catch{}await rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 await mkdir(root);await mkdir(stage);
 await writeFile(join(root,'old.txt'),'previous');
 await writeFile(join(root,'server.mjs'),serverSource('old.pid','old'));
 await writeFile(join(stage,'package.json'),'{"version":"0.6.0"}');
 await writeFile(join(stage,'server.mjs'),serverSource('child.pid','ready'));
 const old=spawn(process.execPath,[join(root,'server.mjs')],{cwd:root,env:{...process.env,BUREAU_PORT:String(p)},stdio:'ignore'});
 pids.push(old.pid);
 assert.equal(await waitFor(()=>reachable(p)),true,'old server responds before the update');
 await copyFile(new URL('../src/update-helper.mjs',import.meta.url),helper);
 await writeFile(manifest,JSON.stringify({root,stage,pid:old.pid,port:p,version:'0.6.0'}));
 const child=spawn(process.execPath,[helper,manifest],{cwd:temp,stdio:'ignore'});
 await new Promise(r=>setTimeout(r,1500));
 assert.equal(await readFile(join(root,'old.txt'),'utf8'),'previous','no swap while the server is alive');
 assert.equal((await readdir(temp)).some(name=>name.startsWith('.myteam-backup-')),false,'no backup while the server is alive');
 try{process.kill(old.pid);}catch{}
 assert.equal(await waitFor(async()=>{try{return (await (await fetch(`http://127.0.0.1:${p}`)).text())==='ready';}catch{return false;}}),true,'new server responds after the swap');
 assert.equal(JSON.parse(await readFile(join(root,'package.json'),'utf8')).version,'0.6.0');
 pids.push(Number(await readFile(join(root,'child.pid'),'utf8')));
 const backup=(await readdir(temp)).find(name=>name.startsWith('.myteam-backup-'));
 assert.ok(backup,'a backup of the previous installation exists');
 assert.equal(await readFile(join(temp,backup,'old.txt'),'utf8'),'previous');
 await new Promise(r=>child.on('exit',r));
});

test('U7: helper rolls back when the new server fails to start',async t=>{
 const temp=await mkdtemp(join(tmpdir(),'myteam-u7-')),root=join(temp,'MyTeam'),stage=join(temp,'stage'),helper=join(temp,'helper.mjs'),manifest=helper+'.json',p=await port();
 const pids=[];
 t.after(async()=>{for(const pid of pids)try{process.kill(pid);}catch{}await rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 await mkdir(root);await mkdir(stage);
 await writeFile(join(root,'old.txt'),'previous');
 await writeFile(join(root,'package.json'),'{"version":"0.5.2"}');
 await writeFile(join(root,'server.mjs'),serverSource('old.pid','old'));
 await writeFile(join(stage,'package.json'),'{"version":"0.6.0"}');
 await writeFile(join(stage,'new.txt'),'broken release');
 await writeFile(join(stage,'server.mjs'),`throw new Error('broken release');`);
 const old=spawn(process.execPath,[join(root,'server.mjs')],{cwd:root,env:{...process.env,BUREAU_PORT:String(p)},stdio:'ignore'});
 pids.push(old.pid);
 assert.equal(await waitFor(()=>reachable(p)),true,'old server responds before the update');
 await copyFile(new URL('../src/update-helper.mjs',import.meta.url),helper);
 await writeFile(manifest,JSON.stringify({root,stage,pid:old.pid,port:p,version:'0.6.0'}));
 const child=spawn(process.execPath,[helper,manifest],{cwd:temp,stdio:'ignore'});
 try{process.kill(old.pid);}catch{}
 await new Promise(r=>child.on('exit',r));
 assert.equal(JSON.parse(await readFile(join(root,'package.json'),'utf8')).version,'0.5.2','previous version restored');
 assert.equal(await readFile(join(root,'old.txt'),'utf8'),'previous');
 const failed=(await readdir(temp)).find(name=>name.startsWith('.myteam-failed-'));
 assert.ok(failed,'the failed release is preserved');
 assert.equal(await readFile(join(temp,failed,'new.txt'),'utf8'),'broken release');
 assert.equal(await waitFor(async()=>{try{return (await (await fetch(`http://127.0.0.1:${p}`)).text())==='old';}catch{return false;}}),true,'previous server responds again after rollback');
 pids.push(Number(await readFile(join(root,'old.pid'),'utf8')));
});
