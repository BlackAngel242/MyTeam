import { createConnection } from 'node:net';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

function listening(port) {
  return new Promise(resolve=>{
    const socket=createConnection({host:'127.0.0.1',port});
    const finish=value=>{socket.destroy();resolve(value);};
    socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));
    socket.setTimeout(500,()=>finish(false));
  });
}
async function detached(file,args,options={}) {
  const child=spawn(file,args,{stdio:'ignore',detached:true,windowsHide:true,...options});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  child.unref();
}
export async function openBureau({root,port=4317,probe=listening,start,browse}={}) {
  if(!/^\d{4,5}$/.test(String(port))||Number(port)<1024||Number(port)>65535)throw new Error('Port invalide.');
  port=Number(port);
  const url=`http://127.0.0.1:${port}`;
  start??=()=>detached(process.execPath,[join(root,'server.mjs')],{cwd:root,env:{...process.env,BUREAU_PORT:String(port)}});
  browse??=()=>detached(process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open',[url]);
  if(!await probe(port)) {
    const directory=join(root,'.bureau');await mkdir(directory,{recursive:true});
    const path=join(directory,`demarrage-${port}.lock`);let lock;
    for(let i=0;i<100&&!lock;i++) {
      try {lock=await open(path,'wx');await lock.writeFile(String(process.pid));}
      catch(error) {
        if(error.code!=='EEXIST')throw error;
        // Seul le verrou d'un processus disparu peut être retiré.
        const pid=Number(await readFile(path,'utf8').catch(()=>''));
        if(Number.isSafeInteger(pid)&&pid>0) {
          try {process.kill(pid,0);}catch(failure){if(failure.code==='ESRCH')await unlink(path).catch(()=>{});}
        }
        if(await probe(port))break;
        await delay(100);
      }
    }
    if(lock) {
      try {
        if(!await probe(port))await start();
        for(let i=0;i<100&&!await probe(port);i++)await delay(100);
        if(!await probe(port))throw new Error('Le bureau ne démarre pas. / The desktop did not start.');
      } finally {await lock.close();await unlink(path);}
    } else if(!await probe(port))throw new Error('Démarrage déjà en cours. / Startup already in progress.');
  }
  await browse(url);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=dirname(dirname(fileURLToPath(import.meta.url)));
  openBureau({root,port:process.env.BUREAU_PORT||4317}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
