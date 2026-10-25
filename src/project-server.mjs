import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir,realpath,rename} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {resolveProject,relativeProjectPath,projectContains,projectStateDir,scopedBridge,ProjectError} from './projects.mjs';
import {createHerdr} from './herdr.mjs';
import {createTerminalStatusReader} from './terminal-status.mjs';
import {readClaudeActivity} from './claude-activity.mjs';
import {readAgentActivity} from './agent-activity.mjs';
import {readClaudeResponses,readAgentResponses} from './responses.mjs';
import {readDelegations} from './delegations.mjs';
import {createTodosReader} from './todos.mjs';
import {readBlackboard} from './blackboard.mjs';
import {initKit} from '../scripts/init-kit.mjs';
import {VERSION} from './version.mjs';
export function localDataRoot({home=homedir(),env=process.env,platform=process.platform}={}){
 return platform==='win32'?join(env.LOCALAPPDATA||join(home,'AppData','Local'),'MyTeam'):platform==='darwin'?join(home,'Library','Application Support','MyTeam'):join(env.XDG_DATA_HOME||join(home,'.local','share'),'MyTeam');
}
const installation=fileURLToPath(new URL('../',import.meta.url));
export async function createProjectServer({createBureauServer,myteamRoot=installation,dataRoot=localDataRoot(),places={home:homedir()},bridge,readTerminal=createTerminalStatusReader(),startTimers=true}={}){
 const token=randomBytes(32).toString('hex');let runtime=null,changing=false;
 const config=join(dataRoot,'project.json');
 const installedVersion=VERSION;
 const select=async (selection,{persist=true}={})=>{
  const project=await resolveProject(selection,places,myteamRoot);
  if(selection.prepareKit===true&&project.mode==='project')await initKit(project.root,{lang:selection.lang==='en'?'en':'fr'});
  const stateDir=projectStateDir(dataRoot,project.root);await mkdir(stateDir,{recursive:true,mode:0o700});
  let scoped;const base=bridge||createHerdr({allowAgent:agent=>scoped.allowed(agent)});scoped=scopedBridge(base,project.root);
  const bySession=async(sessionId,reader)=>{const agent=(await scoped.list()).find(a=>a.sessionId===sessionId);if(!agent)throw new ProjectError('Cet agent ne travaille plus dans le projet actif.');return scoped.run(agent.id,current=>reader(current.sessionId));};
  const core=createBureauServer({bridge:scoped,lireEtat:agent=>scoped.run(agent.id,readTerminal),readActivity:id=>bySession(id,readClaudeActivity),readOtherActivity:(agent,agents)=>scoped.run(agent.id,current=>readAgentActivity(current,agents)),getResponses:id=>bySession(id,readClaudeResponses),getOtherResponses:(agent,agents)=>scoped.run(agent.id,current=>readAgentResponses(current,agents)),delegations:id=>bySession(id,readDelegations),getPlaces:()=>({bureau:{label:'Projet actif',path:project.root}}),getBlackboard:()=>readBlackboard({root:project.root}),getTodos:createTodosReader({projectRoot:project.root}),stopForUpdate:()=>{server.close(()=>{process.exit(0);});},queueFile:join(stateDir,'file-attente.json'),criseFile:join(stateDir,'crise.json'),directionFile:join(stateDir,'direction.json'),piedFile:join(stateDir,'pied.json')});
  core.address=()=>server.address();
  if(persist){const temporary=config+'.tmp';await writeFile(temporary,JSON.stringify({mode:selection.mode,place:selection.place,path:selection.path}),{mode:0o600});await rename(temporary,config);}
  if(runtime){runtime.core.queue.stop();runtime.core.pauses.stop();await runtime.bridge.deactivate();}
  runtime={...project,stateDir,bridge:scoped,core};server.context=runtime;
  if(startTimers){core.queue.start(15000);core.pauses.start(20000);}
 };
 const server=createServer(async(req,res)=>{
  const origin=`http://127.0.0.1:${server.address()?.port}`;
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});res.end(JSON.stringify(value));};
  try{
   if(req.headers.host!==new URL(origin).host||req.headers['sec-fetch-site']==='cross-site')return json(403,{error:'Origine refusée.'});
   const url=new URL(req.url,origin);
   if(url.pathname==='/api/projet'){
    if(req.method==='GET')return json(200,{token,version:installedVersion,project:runtime?{mode:runtime.mode,root:runtime.root}:null,places:Object.keys(places)});
    if(req.method!=='POST')return json(405,{error:'Méthode refusée.'});
    if(req.headers.origin!==origin||req.headers['x-myteam-token']!==token||!req.headers['content-type']?.startsWith('application/json'))return json(403,{error:'Origine ou jeton refusé.'});
    if(changing)return json(409,{error:'Un changement est en cours.'});
    changing=true;
    try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)throw new ProjectError('Demande trop longue.');chunks.push(chunk);}let selection;try{selection=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ProjectError('Choix invalide.');}
     await select(selection);return json(200,{ok:true});
    }finally{changing=false;}
   }
   if(url.pathname==='/api/projet/dossiers'&&req.method==='GET'){
    if(req.headers['x-myteam-token']!==token)return json(403,{error:'Jeton requis.'});
    const place=url.searchParams.get('lieu'),path=relativeProjectPath(url.searchParams.get('chemin')||'');
    if(!Object.hasOwn(places,place))throw new ProjectError('Lieu inconnu.');const root=await realpath(places[place]),target=join(root,path);
    if(!await projectContains(root,target))throw new ProjectError('Dossier hors du lieu choisi.');
    const entries=await readdir(target,{withFileTypes:true});return json(200,{directories:entries.filter(e=>e.isDirectory()&&!e.name.startsWith('.')).map(e=>e.name).sort()});
   }
   const files={'/demarrage':'start.html','/start.js':'start.js','/start.css':'start.css','/project-context.js':'project-context.js'};
   if(!runtime&&url.pathname==='/')files['/']='start.html';
   if(files[url.pathname]&&req.method==='GET'){
    const name=files[url.pathname],content=await readFile(new URL('../public/'+name,import.meta.url));res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});return res.end(content);
   }
   if(!runtime||changing)return json(409,{error:'Choisis le projet avant de démarrer.',url:'/demarrage'});
   runtime.core.emit('request',req,res);
  }catch(error){json(error instanceof ProjectError?400:500,{error:error instanceof ProjectError?error.message:'Le projet n’a pas pu être ouvert.'});}
 });
 server.on('close',()=>{if(runtime){runtime.core.queue.stop();runtime.core.pauses.stop();void runtime.bridge.deactivate();}});
 try{const selection=JSON.parse(await readFile(config,'utf8'));await select(selection,{persist:false});}catch{/* Un ancien choix absent ou invalide laisse le démarrage fermé. */}
 return server;
}
