import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {readdirSync,statSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';

const execute = promisify(execFile);
export class HerdrError extends Error {
  constructor(message) {super(message);this.name='HerdrError';this.statusCode=502;}
}
export class AgentInputError extends Error {
  constructor(message) {super(message);this.name='AgentInputError';this.statusCode=400;}
}
export function findHerdr({home=homedir(),env=process.env,platform=process.platform}={}) {
  if(env.BUREAU_HERDR_PATH) return env.BUREAU_HERDR_PATH;
  const releases=join(home,'.herdr','packages','standalone','releases');
  const candidates=[];
  try {
    for(const entry of readdirSync(releases,{withFileTypes:true})) {
      if(!entry.isDirectory()) continue;
      const directory=join(releases,entry.name),binary=join(directory,platform==='win32'?'herdr.exe':'herdr');
      try {
        if(statSync(binary).isFile()) candidates.push({binary,modified:statSync(directory).mtimeMs,name:entry.name});
      } catch { /* Une installation incomplete ne masque pas les autres versions. */ }
    }
  } catch {return 'herdr';}
  candidates.sort((a,b)=>b.modified-a.modified||b.name.localeCompare(a.name,undefined,{numeric:true}));
  return candidates[0]?.binary||'herdr';
}
export function normalizeAgent(a) {
  const status=['idle','working','blocked','done','unknown'].includes(a.agent_status)?a.agent_status:'unknown';
  const fingerprint=createHash('sha256').update(JSON.stringify([a.terminal_id,a.agent,a.agent_session?.value])).digest('hex').slice(0,16);
  const names={pi:'Pi',claude:'Claude',codex:'Codex',gemini:'Gemini',cursor:'Cursor',devin:'Devin',agy:'Antigravity',antigravity:'Antigravity',cline:'Cline',omp:'OMP',mastracode:'Mastra Code',opencode:'OpenCode',copilot:'Copilot',kimi:'Kimi',kiro:'Kiro',droid:'Droid',amp:'Amp',grok:'Grok',hermes:'Hermes',kilo:'Kilo',qodercli:'Qoder',qwen:'Qwen',letta:'Letta',maki:'Maki',muse:'Muse'};
  const supplied=a.name||a.display_agent||names[a.agent]||a.agent||'Agent';
  const name=names[a.agent]&&typeof supplied==='string'&&[a.agent,names[a.agent].toLowerCase()].includes(supplied.trim())?names[a.agent]:supplied;
  return {id:`${a.pane_id}@${fingerprint}`,paneId:a.pane_id,name,kind:names[a.agent]||a.agent||'inconnu',status,
    ready:['idle','done'].includes(status)&&a.interactive_ready!==false&&!a.launch_pending&&!a.screen_detection_skipped,
    cwd:a.foreground_cwd||a.cwd||'',workspaceId:a.workspace_id||'',
    ...(a.agent==='claude'?{sessionId:a.agent_session?.value}:{})};
}
function parseResult(output) {
  let data;
  try {data=JSON.parse(output);} catch {throw new HerdrError('Réponse de Herdr illisible. Réessayez dans un instant.');}
  if(!data||typeof data!=='object') throw new HerdrError('Réponse de Herdr illisible. Réessayez dans un instant.');
  if(data.error) throw new HerdrError('Herdr a refusé la demande. Consultez son panneau pour vérifier son état.');
  return data.result;
}
export function createHerdr({run,executeFile=execute,sessionsDir=join(homedir(),'.claude','sessions'),now=()=>Date.now()}={}) {
  const inflight=new Set();
  let listing;
  const sessionsClaude=new Map();
  const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
  const invoke=async args=>{
    try {
      if(run) return await run(args);
      const {stdout}=await executeFile(findHerdr(),args,{windowsHide:true,timeout:12000,maxBuffer:2*1024*1024,encoding:'utf8'});
      return stdout;
    }
    catch(error) {
      if(error instanceof HerdrError) throw error;
      if(error.code==='ENOENT') throw new HerdrError('Herdr est introuvable. Indiquez son chemin avec BUREAU_HERDR_PATH.');
      if(error.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER') throw new HerdrError('La sortie de Herdr est trop volumineuse pour être lue.');
      if(error.killed) throw new HerdrError('Herdr met trop de temps à répondre. Vérifiez sa fenêtre avant de réessayer.');
      if(run) throw new HerdrError(error.message||'La demande n’a pas abouti.');
      throw new HerdrError('Herdr ne répond pas ou a refusé la demande. Vérifiez sa fenêtre. Un envoi peut avoir été reçu : consultez le terminal avant de le répéter.');
    }
  };
  // Session exacte d'un Claude sans agent_session (intégration Herdr absente) : le processus au premier plan du
  // panneau a un fichier ~/.claude/sessions/<pid>.json qui porte son identifiant de session. Aucune approximation :
  // le pid doit correspondre et l'identifiant doit avoir la forme d'un UUID, sinon rien.
  async function sessionClaude(paneId) {
    const vu=sessionsClaude.get(paneId);
    if(vu&&now()-vu.at<15000) return vu.id;
    let id;
    try {
      const info=parseResult(await invoke(['pane','process-info','--pane',paneId]))?.process_info;
      const pids=[info?.foreground_process_group_id,...(Array.isArray(info?.foreground_processes)?info.foreground_processes.map(p=>p?.pid):[])].filter(n=>Number.isInteger(n)&&n>0);
      for(const pid of [...new Set(pids)]) {
        try {
          const chemin=join(sessionsDir,pid+'.json');
          if(statSync(chemin).size>65536) continue;
          const session=JSON.parse(readFileSync(chemin,'utf8'));
          if(session?.pid!==pid||!UUID.test(session.sessionId)) continue;
          id=session.sessionId;
          // Le client interactif peut « garder » une conversation tournant en fond (parkedJobId) : la vraie conversation,
          // celle dont le journal grandit, est la session de fond portant ce jobId.
          if(typeof session.parkedJobId==='string'&&session.parkedJobId) {
            for(const nom of readdirSync(sessionsDir)) {
              if(!/^\d+\.json$/.test(nom)) continue;
              try {
                const autre=JSON.parse(readFileSync(join(sessionsDir,nom),'utf8'));
                if(autre?.jobId===session.parkedJobId&&UUID.test(autre.sessionId)) {id=autre.sessionId;break;}
              } catch { /* fichier de session illisible : ignoré */ }
            }
          }
          break;
        } catch { /* ce processus n'est pas une session Claude */ }
      }
    } catch { /* Herdr ne donne pas d'information de processus : pas de session */ }
    sessionsClaude.set(paneId,{at:now(),id});
    if(sessionsClaude.size>32) sessionsClaude.delete(sessionsClaude.keys().next().value);
    return id;
  }
  function list() {
    if(listing) return listing;
    listing=(async()=>{
      try {
        const result=parseResult(await invoke(['agent','list']));
        if(!Array.isArray(result?.agents)) throw new HerdrError('Liste des agents de Herdr illisible.');
        const agents=result.agents.filter(a=>a.pane_id&&a.terminal_id).map(normalizeAgent);
        await Promise.all(agents.map(async a=>{if(a.kind==='Claude'&&!a.sessionId){const id=await sessionClaude(a.paneId);if(id)a.sessionId=id;}}));
        return agents;
      } finally {listing=undefined;}
    })();
    return listing;
  }
  async function resolve(id) {
    const agent=(await list()).find(a=>a.id===id);
    if(!agent) throw new AgentInputError('Agent introuvable. La liste a changé, sélectionnez à nouveau un agent.');
    return agent;
  }
  const checkMessage=message=>{
    if(typeof message!=='string'||!message.trim()||message.length>12000||message.includes('\0')) throw new AgentInputError('Écrivez une consigne de 1 à 12 000 caractères, sans caractère nul.');
  };
  async function read(id) {
    const agent=await resolve(id);
    const source=['idle','done'].includes(agent.status)?'recent-unwrapped':'visible';
    const text=await invoke(['agent','read',agent.paneId,'--source',source,'--lines','120']);
    return {text};
  }
  async function prompt(id,message) {
    checkMessage(message);
    if(inflight.has(id)) throw new AgentInputError('Un envoi est déjà en cours pour cet agent.');
    inflight.add(id);
    try {
      const agent=await resolve(id);
      if(!agent.ready) throw new AgentInputError('Cet agent n’est pas disponible. Attendez la fin de son travail ou répondez dans Herdr.');
      const result=parseResult(await invoke(['agent','prompt',agent.paneId,message]));
      if(result?.type!=='agent_prompted') throw new HerdrError('L’envoi n’a pas été confirmé par Herdr. Consultez le terminal avant de réessayer.');
      return {ok:true,message:'Consigne transmise à Herdr.'};
    } finally {inflight.delete(id);}
  }
  async function interrupt(id) {
    // Interruption polie : Échap dans le panneau, jamais de kill.
    const agent=await resolve(id);
    await invoke(['pane','send-keys',agent.paneId,'esc']);
    return {requested:true,agent:agent.name};
  }
  async function broadcast(ids,message) {
    checkMessage(message);
    const results=[];
    for(const id of ids) {
      let name='';
      try {
        const agent=await resolve(id);
        name=agent.name;
        if(!agent.ready) {results.push({id,name,ok:false,error:'Cet agent n’est pas disponible. Attendez la fin de son travail ou répondez dans Herdr.'});continue;}
        await prompt(id,message);
        results.push({id,name,ok:true,message:'Consigne transmise à Herdr.'});
      } catch(error) {results.push({id,name,ok:false,error:error.message||'La demande n’a pas abouti.'});}
    }
    return {results};
  }
  return {list,read,prompt,interrupt,broadcast};
}
