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
