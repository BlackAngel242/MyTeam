// Copié hors de l'application avant l'arrêt du serveur, pour permettre le remplacement sur Windows.
import {readFile,rename,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createConnection} from 'node:net';
import {dirname,join} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';

const [helper,manifestFile]=process.argv.slice(1);
const {root,stage,pid,port}=JSON.parse(await readFile(manifestFile,'utf8'));
const backup=join(dirname(root),`.myteam-backup-${Date.now()}-${pid}`);
function alive(){try{process.kill(pid,0);return true;}catch{return false;}}
async function listening(){return new Promise(resolve=>{const s=createConnection({host:'127.0.0.1',port});s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));s.setTimeout(500,()=>{s.destroy();resolve(false);});});}
async function launch(){const child=spawn(process.execPath,[join(root,'server.mjs')],{cwd:root,env:{...process.env,BUREAU_PORT:String(port)},stdio:'ignore',detached:true,windowsHide:true});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();return child;}
async function healthy(child){for(let i=0;i<40;i++){if(child.exitCode!==null)return false;if(await listening())return true;await wait(500);}return false;}
let swapped=false,child=null;
try{
 for(let i=0;i<120&&alive();i++)await wait(500);
 if(alive())throw new Error('Le serveur ne s’est pas arrêté.');
 await rename(root,backup);swapped=true;
 try{await rename(stage,root);}catch(e){await rename(backup,root);swapped=false;throw e;}
 child=await launch();
 if(!await healthy(child))throw new Error('La nouvelle version ne démarre pas.');
}catch(e){
 if(!swapped&&!alive())await launch().catch(()=>{});
 if(swapped){
  if(child)try{process.kill(child.pid);}catch{}
  await wait(500);
  await rename(root,join(dirname(root),`.myteam-failed-${Date.now()}-${pid}`)).catch(()=>{});
  await rename(backup,root).catch(()=>{});
  await launch().catch(()=>{});
 }
}finally{await rm(manifestFile,{force:true}).catch(()=>{});await rm(helper,{force:true}).catch(()=>{});}
