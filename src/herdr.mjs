import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';

const execute = promisify(execFile);
export class HerdrError extends Error {
  constructor(message) {super(message);this.name='HerdrError';this.statusCode=502;}
}
export class AgentInputError extends Error {
  constructor(message) {super(message);this.name='AgentInputError';this.statusCode=400;}
}
export function findHerdr() {
  if(process.env.BUREAU_HERDR_PATH) return process.env.BUREAU_HERDR_PATH;
  const installed=join(homedir(),'.herdr','packages','standalone','releases','0.9.5-x86_64-pc-windows-msvc','herdr.exe');
  return existsSync(installed)?installed:'herdr';
}
export function normalizeAgent(a) {
  const status=['idle','working','blocked','done','unknown'].includes(a.agent_status)?a.agent_status:'unknown';
  const fingerprint=createHash('sha256').update(JSON.stringify([a.terminal_id,a.agent,a.agent_session?.value])).digest('hex').slice(0,16);
  const names={claude:'Claude',codex:'Codex',agy:'Antigravity',gemini:'Gemini',opencode:'OpenCode'};
  return {id:`${a.pane_id}@${fingerprint}`,paneId:a.pane_id,name:a.name||a.display_agent||names[a.agent]||a.agent||'Agent',kind:names[a.agent]||a.agent||'inconnu',status,
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
export function createHerdr({run,executeFile=execute}={}) {
  const inflight=new Set();
  let listing;
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
  function list() {
    if(listing) return listing;
    listing=(async()=>{
      try {
        const result=parseResult(await invoke(['agent','list']));
        if(!Array.isArray(result?.agents)) throw new HerdrError('Liste des agents de Herdr illisible.');
        return result.agents.filter(a=>a.pane_id&&a.terminal_id).map(normalizeAgent);
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
  return {list,read,prompt,broadcast};
}
