import {createServer} from 'node:http';
import {readFile,lstat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {join,posix,win32} from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {createHerdr} from './src/herdr.mjs';
import {readClaudeActivity} from './src/claude-activity.mjs';
import {readAgentActivity,normalizeActivity} from './src/agent-activity.mjs';
import {standardPlaces,recentFiles,listDir,transfer,resolveInside,FileError} from './src/files.mjs';
import {readTodos,normalizeTodos} from './src/todos.mjs';
import {bossOf,readDelegations} from './src/delegations.mjs';
import {createQueue,QueueError} from './src/queue.mjs';

const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
const errorStatus=error=>[400,502].includes(error?.statusCode)?error.statusCode:500;
const execute=promisify(execFile);
export function createBureauServer({bridge=createHerdr(),readActivity=readClaudeActivity,readOtherActivity=readAgentActivity,getTodos=readTodos,getPlaces=standardPlaces,executeFile=execute,platform=process.platform,delegations=readDelegations,now=()=>Date.now(),queueFile=fileURLToPath(new URL('./.bureau/file-attente.json',import.meta.url)),queue}={}) {
  const token=randomBytes(32).toString('hex');
  let transferPending=Promise.resolve();
  // Pause de quota : la fin de pause retenue est la remise à zéro la plus tardive
  // parmi les limites atteintes. Une erreur de lecture est laissée remonter : la
  // file gèle alors l'envoi au lieu de l'autoriser (revue croisée, constat 3).
  const limiteQuota=async(id,agents)=>{
    const agent=agents.find(cible=>cible.id===id);
    if(!agent||agent.kind==='Claude') return {limitReached:false,resetsAt:null};
    const activite=await readOtherActivity(agent,agents);
    const limites=Array.isArray(activite?.limits)?activite.limits:[];
    const atteintes=limites.filter(limite=>typeof limite?.usedPercent==='number'&&limite.usedPercent>=100);
    const candidates=atteintes.length>0?atteintes:(activite?.limitReached===true?limites:[]);
    const dates=candidates.map(limite=>typeof limite?.resetsAt==='string'?Date.parse(limite.resetsAt):NaN).filter(temps=>!Number.isNaN(temps));
    const derniere=dates.length?new Date(Math.max(...dates)).toISOString():null;
    return {limitReached:activite?.limitReached===true||atteintes.length>0,resetsAt:derniere};
  };
  const fileAttente=queue??createQueue({listAgents:async()=>bridge.list(),prompt:(id,message)=>bridge.prompt(id,message),limitsOf:limiteQuota,file:queueFile,now});
  async function allowedRoots() {
    const roots=new Map();
    const add=async(key,label,kind,path)=>{
      if(typeof path!=='string'||(!posix.isAbsolute(path)&&!win32.isAbsolute(path))) return;
      try {
        const info=await lstat(path);
        if(info.isDirectory()&&!info.isSymbolicLink()) roots.set(key,{key,label,kind,path});
      } catch { /* Un lieu disparu ne reste pas dans la liste autorisee. */ }
    };
    for(const agent of await bridge.list()) {
      if(typeof agent.id!=='string'||!agent.id||/[\\/\0]/.test(agent.id)) continue;
      const label=typeof agent.name==='string'&&agent.name&&!posix.isAbsolute(agent.name)&&!win32.isAbsolute(agent.name)?agent.name:agent.kind||'Agent';
      await add('agent:'+agent.id,label,'agent',agent.cwd);
    }
    const places=await getPlaces();
    for(const key of ['bureau','documents','telechargements']) {
      const place=places?.[key];
      const labels={bureau:'Bureau',documents:'Documents',telechargements:'Téléchargements'};
      if(place?.path) await add(key,labels[key],'place',place.path);
    }
    return roots;
  }
  function rootOf(roots,key) {
    if(typeof key!=='string'||!roots.has(key)) throw new FileError('Ce dossier n’est plus autorisé. Actualise la liste des lieux.');
    return roots.get(key).path;
  }
  async function relativeFile(root,path='') {
    if(typeof path!=='string'||path.includes('\0')||posix.isAbsolute(path)||win32.isAbsolute(path)||/^[a-z]:/i.test(path)) throw new FileError('Chemin invalide.');
    const parts=path.split(/[\\/]/).filter(part=>part&&part!=='.');
    if(parts.includes('..')) throw new FileError('Ce chemin sort du dossier autorisé.');
    let full=root;
    for(const part of parts) {
      full=join(full,part);
      let info;
      try {info=await lstat(full);} catch {throw new FileError('Fichier ou dossier introuvable.');}
      if(info.isSymbolicLink()) throw new FileError('Les liens symboliques ne sont pas autorisés.');
    }
    return parts.join('/');
  }
  const server=createServer(async(req,res)=> {
    const port=server.address()?.port;
    const origin=`http://127.0.0.1:${port}`;
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
    const json=(status,data)=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    const guard=(req,{body=true}={})=>{
      const sent=Buffer.from(req.headers['x-bureau-token']||'');
      const expected=Buffer.from(token);
      if(req.headers.origin!==origin||sent.length!==expected.length||!timingSafeEqual(sent,expected)) {json(403,{error:'Session expirée. Actualisez le bureau.'});return false;}
      if(body&&!req.headers['content-type']?.startsWith('application/json')) {json(415,{error:'Format de consigne invalide.'});return false;}
      return true;
    };
    const readJson=async req=>{
      let size=0;
      let tooLarge=false;
      const chunks=[];
      for await(const chunk of req) {
        size+=chunk.length;
        if(size>60000) {tooLarge=true;chunks.length=0;}
        else if(!tooLarge) chunks.push(chunk);
      }
      // Consommer le flux sans le stocker avant de repondre evite une coupure du 413.
      if(tooLarge) {json(413,{error:'Consigne trop longue.'});return null;}
      try {
        const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error();
        return value;
      } catch {json(400,{error:'Consigne illisible.'});return null;}
    };
    if(req.headers.host!==`127.0.0.1:${port}`) return json(403,{error:'Ouvre le bureau avec http://127.0.0.1:4317'});
    if(req.headers.origin && req.headers.origin!==origin) return json(403,{error:'Origine non autorisée.'});
    if(req.headers['sec-fetch-site']==='cross-site') return json(403,{error:'Accès extérieur refusé.'});
    let url;
    try {url=new URL(req.url,origin);} catch {return json(400,{error:'Adresse invalide.'});}
    try {
      if(req.method==='GET'&&url.pathname==='/api/todos') {
        if(!guard(req,{body:false})) return;
        try {return json(200,normalizeTodos(await getTodos(await bridge.list())));}
        catch(error) {return json(errorStatus(error),{error:'Impossible de lire les listes de tâches pour le moment.'});}
      }
      if(['/api/places','/api/files/recent','/api/files/list','/api/files/transfer','/api/files/reveal'].includes(url.pathname)) {
        if(!guard(req,{body:req.method!=='GET'})) return;
        try {
          if(req.method==='GET') {
            const roots=await allowedRoots();
            if(url.pathname==='/api/places') return json(200,{places:[...roots.values()].map(({key,label,kind})=>({key,label,kind}))});
            if(url.pathname==='/api/files/recent') {
              const root='agent:'+url.searchParams.get('id');
              return json(200,{root,files:await recentFiles(rootOf(roots,root))});
            }
            if(url.pathname==='/api/files/list') {
              const root=url.searchParams.get('root'),path=await relativeFile(rootOf(roots,root),url.searchParams.get('path')??'');
              return json(200,{root,path,items:await listDir(rootOf(roots,root),path)});
            }
          } else if(req.method==='POST'&&['/api/files/transfer','/api/files/reveal'].includes(url.pathname)) {
            const parsed=await readJson(req);
            if(parsed===null) return;
            if(url.pathname==='/api/files/transfer') {
              if(!parsed.from||!parsed.to) throw new FileError('Choisis un fichier et un dossier de destination.');
              if(!['copy','move'].includes(parsed.mode)) throw new FileError('Action inconnue.');
              const operation=async()=>{
                const roots=await allowedRoots();
                const fromRoot=rootOf(roots,parsed.from.root),toRoot=rootOf(roots,parsed.to.root);
                const fromPath=await relativeFile(fromRoot,parsed.from.path),toPath=await relativeFile(toRoot,parsed.to.path);
                return transfer({fromRoot,fromPath,toRoot,toPath,mode:parsed.mode});
              };
              // Deux transferts du bureau ne choisissent jamais le meme nom libre.
              const pending=transferPending.then(operation);
              transferPending=pending.catch(()=>{});
              return json(200,await pending);
            }
            const roots=await allowedRoots(),root=rootOf(roots,parsed.root),path=await relativeFile(root,parsed.path);
            if(platform!=='win32') return json(501,{error:'L’ouverture dans l’Explorateur est disponible uniquement sous Windows.'});
            const {real}=await resolveInside(root,path);
            try {await executeFile('explorer.exe',['/select,'+real],{shell:false,windowsHide:true});}
            catch(error) {if(error.code!==1) throw error;}
            return json(200,{ok:true});
          }
          return json(404,{error:'Page introuvable.'});
        } catch(error) {
          return json(error instanceof FileError?400:500,{error:error instanceof FileError?error.message:'Impossible d’accéder aux fichiers pour le moment.'});
        }
      }
      if(req.method==='GET'&&url.pathname==='/api/state') {
        try {
          const listed=await bridge.list();
          const chef=bossOf(listed);
          const agents=await Promise.all(listed.map(async agent=>{
            const {sessionId,creator_user_id,creator_account_id,activity:previousActivity,...publicAgent}=agent;
            if(agent.kind==='Claude'&&sessionId) {
              try {
                const activity=await readActivity(sessionId);
                if(activity?.found===true) publicAgent.activity=normalizeActivity(activity,{claude:true});
              } catch { /* Une lecture locale indisponible ne coupe pas Herdr. */ }
            } else if(agent.kind!=='Claude') {
              try {
                const activity=await readOtherActivity(agent,listed);
                if(activity) publicAgent.activity=normalizeActivity(activity);
              } catch { /* Un journal facultatif ne coupe pas la liste des agents. */ }
            }
            if(agent===chef&&agent.kind==='Claude'&&sessionId) {
              // Délégations observées du chef, douze dernières heures : seuls id,
              // at, target, title et result sortent, jamais la session ni un chemin.
              try {
                const observation=await delegations(sessionId);
                const depuis=now()-12*60*60*1000;
                const vues=observation?.found===true&&Array.isArray(observation.delegations)?observation.delegations:[];
                publicAgent.delegations=vues
                  .filter(d=>d&&typeof d.at==='string'&&Date.parse(d.at)>=depuis)
                  .map(d=>({
                    id:typeof d.id==='string'?d.id.slice(0,128):'',
                    at:d.at,
                    target:typeof d.target==='string'?Array.from(d.target).slice(0,120).join(''):'',
                    title:typeof d.title==='string'?Array.from(d.title).slice(0,80).join(''):null,
                    result:d.result?{ok:typeof d.result.ok==='boolean'?d.result.ok:null,type:typeof d.result.type==='string'?Array.from(d.result.type).slice(0,40).join(''):null}:null,
                  }));
              } catch { publicAgent.delegations=[]; }
            }
            return publicAgent;
          }));
          return json(200,{connected:true,agents,updatedAt:new Date().toISOString(),token});
        }
        catch(error) {return json(errorStatus(error),{connected:false,agents:[],error:error.message,updatedAt:new Date().toISOString(),token});}
      }
      if(req.method==='GET'&&url.pathname==='/api/read') return json(200,await bridge.read(url.searchParams.get('id')));
      if(req.method==='POST'&&(url.pathname==='/api/prompt'||url.pathname==='/api/broadcast')) {
        if(!guard(req)) return;
        const parsed=await readJson(req);
        if(parsed===null) return;
        if(url.pathname==='/api/prompt') {
          if(typeof parsed.id!=='string'||!parsed.id) return json(400,{error:'Sélectionnez un agent.'});
          return json(200,await bridge.prompt(parsed.id,parsed.message));
        }
        const ids=parsed.ids;
        if(!Array.isArray(ids)||ids.length<1||ids.length>12||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length) return json(400,{error:'Choisissez de 1 à 12 agents différents.'});
        return json(200,await bridge.broadcast(ids,parsed.message));
      }
      if(req.method==='GET'&&url.pathname==='/api/queue') {
        if(!guard(req,{body:false})) return;
        return json(200,fileAttente.list());
      }
      if(req.method==='POST'&&(url.pathname==='/api/queue'||url.pathname==='/api/queue/cancel')) {
        if(!guard(req)) return;
        const parsed=await readJson(req);
        if(parsed===null) return;
        try {
          if(url.pathname==='/api/queue') return json(200,await fileAttente.enqueue({id:parsed.id,message:parsed.message,notBefore:parsed.notBefore}));
          return json(200,await fileAttente.cancel(parsed.itemId));
        } catch(error) {
          return json(error instanceof QueueError?400:errorStatus(error),{error:error.message||'La file d’attente n’a pas abouti.'});
        }
      }
      const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/logos.js':'logos.js','/terminal.js':'terminal.js'};
      if(req.method!=='GET'||!files[url.pathname]) return json(404,{error:'Page introuvable.'});
      const filename=files[url.pathname];
      let content;
      try {content=await readFile(join(publicDir,filename));} catch(error) {if(error.code==='ENOENT') return json(404,{error:'Page introuvable.'});throw error;}
      const type=filename.endsWith('.css')?'text/css':filename.endsWith('.js')?'text/javascript':'text/html';
      res.writeHead(200,{...headers,'Content-Type':`${type}; charset=utf-8`});res.end(content);
    } catch(error) {json(errorStatus(error),{error:error.message||'La demande n’a pas abouti.'});}
  });
  server.requestTimeout=20000;
  server.queue=fileAttente;
  return server;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  const port=Number(process.env.BUREAU_PORT||4317);
  const server=createBureauServer();
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Le port du bureau est déjà utilisé. Essayez un autre BUREAU_PORT.':'Le bureau n’a pas pu démarrer.');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    // Planificateur de la file d'attente : un tour toutes les 15 secondes.
    server.queue.start(15000);
    console.log(`Bureau des agents ouvert sur http://127.0.0.1:${port}`);
  });
}
