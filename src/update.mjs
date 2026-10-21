import {createHash,randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir,rm,lstat,cp,rename,realpath} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {spawn} from 'node:child_process';
import {dirname,join,basename,resolve} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const dataDirectory=()=>process.platform==='win32'?join(process.env.LOCALAPPDATA||join(homedir(),'AppData','Local'),'MyTeam'):process.platform==='darwin'?join(homedir(),'Library','Application Support','MyTeam'):join(process.env.XDG_DATA_HOME||join(homedir(),'.local','share'),'MyTeam');

const repo='BlackAngel242/MyTeam';
const maxZip=80*1024*1024,maxTotal=250*1024*1024;
const versionPattern=/^\d+\.\d+\.\d+$/;
const versionOf=(v)=>versionPattern.test(v)?v.split('.').map(Number):null;
export function newer(a,b){const x=versionOf(a),y=versionOf(b);return Boolean(x&&y&&x.some((n,i)=>n>y[i]&&x.slice(0,i).every((p,j)=>p===y[j])));}
const fail=(message,status=400)=>Object.assign(new Error(message),{statusCode:status});
async function bytes(response,max){
 if(!response.ok)throw fail('Téléchargement indisponible.',502);
 if(Number(response.headers.get('content-length'))>max)throw fail('Fichier trop volumineux.',502);
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>max)throw fail('Fichier trop volumineux.',502);chunks.push(chunk);}
 return Buffer.concat(chunks);
}
export function extractZip(zip,version){
 const root=`MyTeam-${version}/`;
 if(zip.length<22||zip.length>maxZip)throw fail('Archive invalide.');
 let end=zip.length-22;
 while(end>=Math.max(0,zip.length-65557)&&!(zip.readUInt32LE(end)===0x06054b50&&end+22+zip.readUInt16LE(end+20)===zip.length))end--;
 if(end<0)throw fail('Archive invalide.');
 const count=zip.readUInt16LE(end+10),size=zip.readUInt32LE(end+12),offset=zip.readUInt32LE(end+16);
 if(!count||count>5000||zip.readUInt16LE(end+8)!==count||offset+size!==end)throw fail('Archive invalide.');
 let p=offset,total=0;const seen=new Set(),files=[];
 for(let i=0;i<count;i++){
  if(p+46>end||zip.readUInt32LE(p)!==0x02014b50)throw fail('Archive invalide.');
  const nameSize=zip.readUInt16LE(p+28),extra=zip.readUInt16LE(p+30),comment=zip.readUInt16LE(p+32),next=p+46+nameSize+extra+comment;
  if(next>end)throw fail('Archive invalide.');
  const name=zip.toString('utf8',p+46,p+46+nameSize),path=name.slice(root.length),directory=name.endsWith('/'),parts=(directory?path.slice(0,-1):path).split('/');
  const mode=(zip.readUInt32LE(p+38)>>>16)&0xffff,kind=mode&0xf000;
  if(!path&&name===root&&directory&&i===0){p=next;continue;}
  if(!name.startsWith(root)||name.includes('\\')||parts.some(s=>!s||s==='.'||s==='..'||/[\0-\x1f<>:"|?*]/.test(s)||/[. ]$/.test(s)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s))||/^(?:\.git|\.bureau|\.myteam-local|\.env[^/]*)$/i.test(parts[0])||(kind&&kind!==(directory?0x4000:0x8000))||seen.has(path.toLowerCase()))throw fail('Contenu de l’archive refusé.');
  seen.add(path.toLowerCase());
  const method=zip.readUInt16LE(p+10),flags=zip.readUInt16LE(p+8),packed=zip.readUInt32LE(p+20),unpacked=zip.readUInt32LE(p+24),local=zip.readUInt32LE(p+42);
  total+=unpacked;if(total>maxTotal||unpacked>maxTotal||![0,8].includes(method)||flags&1||local+30>offset||zip.readUInt32LE(local)!==0x04034b50||zip.readUInt16LE(local+8)!==method)throw fail('Archive invalide.');
  const localName=zip.readUInt16LE(local+26),localExtra=zip.readUInt16LE(local+28),dataStart=local+30+localName+localExtra;
  if(dataStart+packed>offset||!zip.subarray(local+30,local+30+localName).equals(zip.subarray(p+46,p+46+nameSize)))throw fail('Archive invalide.');
  const compressed=zip.subarray(dataStart,dataStart+packed),content=method===0?compressed:inflateRawSync(compressed,{maxOutputLength:maxTotal});
  if(content.length!==unpacked)throw fail('Archive invalide.');
  if(directory){if(unpacked!==0)throw fail('Archive invalide.');}else files.push({path,content});p=next;
 }
 if(p!==end||!files.some(f=>f.path==='package.json')||!files.some(f=>f.path==='server.mjs'))throw fail('Archive incomplète.');
 let pkg;try{pkg=JSON.parse(files.find(f=>f.path==='package.json').content);}catch{throw fail('Version du paquet invalide.');}
 if(pkg.version!==version)throw fail('Version du paquet différente de la release.');
 return files;
}
export function createUpdater({root=fileURLToPath(new URL('../',import.meta.url)),dataRoot=dataDirectory(),fetcher=fetch,spawnHelper=spawn,version,port=()=>4317}={}){
 let cached=null,checkedAt=0,pending=null,busy=false;
 const installed=version??JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
 const status=()=>({installed,latest:cached?.version??null,available:cached?newer(cached.version,installed):false,ready:pending?.version??null,busy});
 async function check({force=false}={}){
  if(!force&&Date.now()-checkedAt<3600000)return status();
  const response=await fetcher(`https://api.github.com/repos/${repo}/releases/latest`,{headers:{'Accept':'application/vnd.github+json','User-Agent':'MyTeam-Updater'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw fail('Impossible de vérifier les releases.',502);
  const item=await response.json(),v=item.tag_name?.replace(/^v/,'');
  if(!versionPattern.test(v)||item.draft||item.prerelease||!Array.isArray(item.assets))throw fail('Release non reconnue.',502);
  const asset=(suffix)=>item.assets.find(a=>a.name===`MyTeam-${v}.zip${suffix}`&&a.browser_download_url===`https://github.com/${repo}/releases/download/v${v}/MyTeam-${v}.zip${suffix}`);
  if(!asset('')||!asset('.sha256'))throw fail('Fichiers de release incomplets.',502);
  cached={version:v,zip:asset(''),checksum:asset('.sha256')};checkedAt=Date.now();return status();
 }
 async function prepare(){
  if(busy)throw fail('Mise à jour déjà en cours.',409);busy=true;
  try{
   await check({force:true});
   if(!status().available)throw fail('Aucune nouvelle version disponible.',409);
   if((await lstat(root)).isSymbolicLink()||(await realpath(root)).toLowerCase()!==resolve(root).toLowerCase())throw fail('Dossier d’installation non pris en charge.',409);
   try{await lstat(join(root,'.git'));throw fail('Copie Git : mettez à jour avec Git pour préserver votre travail.',409);}catch(e){if(e.code!=='ENOENT')throw e;}
   const v=cached.version;
   const [archive,checksum]=await Promise.all([
    fetcher(cached.zip.browser_download_url,{signal:AbortSignal.timeout(120000)}).then(r=>bytes(r,maxZip)),
    fetcher(cached.checksum.browser_download_url,{signal:AbortSignal.timeout(30000)}).then(r=>bytes(r,1024))
   ]);
   const match=/^([a-f0-9]{64})  MyTeam-(\d+\.\d+\.\d+)\.zip\n?$/.exec(checksum.toString('utf8'));
   const hash=createHash('sha256').update(archive).digest('hex');
   if(!match||match[2]!==v||match[1]!==hash||cached.zip.digest&&cached.zip.digest!==`sha256:${hash}`)throw fail('Empreinte SHA-256 différente : mise à jour refusée.',502);
   const files=extractZip(archive,v),stage=join(dirname(root),`.myteam-stage-${randomBytes(8).toString('hex')}`);
   await mkdir(stage,{mode:0o700});
   try{
    for(const file of files){const target=join(stage,file.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,file.content,{flag:'wx'});}
    // Anciennes installations : ces deux dossiers locaux sont conservés, sans les inclure dans la release.
    for(const name of ['.bureau','.myteam-local']){
     try{const info=await lstat(join(root,name));if(info.isSymbolicLink()||!info.isDirectory())throw fail('Dossier local non pris en charge.',409);await cp(join(root,name),join(stage,name),{recursive:true,errorOnExist:true,force:false,filter:async(path)=>{if((await lstat(path)).isSymbolicLink())throw fail('Lien local non pris en charge.',409);return true;}});}
     catch(e){if(e.code!=='ENOENT')throw e;}
    }
   }catch(e){await rm(stage,{recursive:true,force:true});throw e;}
   if(pending)await rm(pending.stage,{recursive:true,force:true});pending={version:v,stage};return status();
  }finally{busy=false;}
 }
 async function install(){
  if(!pending||busy)throw fail('Aucune mise à jour préparée.',409);
  const {stage,version:v}=pending;
  if(!(await lstat(stage)).isDirectory())throw fail('Mise à jour préparée introuvable.',409);
  const helper=join(dataRoot,`update-helper-${randomBytes(8).toString('hex')}.mjs`),manifest=helper+'.json';
  await mkdir(dataRoot,{recursive:true,mode:0o700});
  await writeFile(helper,await readFile(new URL('./update-helper.mjs',import.meta.url)),{mode:0o600,flag:'wx'});
  await writeFile(manifest,JSON.stringify({root,stage,version:v,pid:process.pid,port:Number(port())}),{mode:0o600,flag:'wx'});
  try{
   const child=spawnHelper(process.execPath,[helper,manifest],{detached:true,stdio:'ignore',windowsHide:true,cwd:dataRoot,env:{...process.env}});
   await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
  }catch(e){await rm(helper,{force:true});await rm(manifest,{force:true});throw fail('Impossible de démarrer la mise à jour.',500);}
  pending=null;return {restarting:true,version:v};
 }
 return {check,prepare,install,status};
}
