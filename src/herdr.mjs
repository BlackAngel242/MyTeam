import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';

const execute = promisify(execFile);
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
    cwd:a.foreground_cwd||a.cwd||'',workspaceId:a.workspace_id||''};
}
function parseResult(output) {
  let data;
  try {data=JSON.parse(output);} catch {throw new Error('Réponse de Herdr illisible. Réessayez dans un instant.');}
  if(data.error) throw new Error('Herdr a refusé la demande. Consultez son panneau pour vérifier son état.');
  return data.result;
}
export function createHerdr({run}={}) {
  const inflight=new Set();
  const invoke=run|| (async args=>{
    try {const {stdout}=await execute(findHerdr(),args,{windowsHide:true,timeout:12000,maxBuffer:2*1024*1024,encoding:'utf8'});return stdout;}
    catch(error) {
      if(error.code==='ENOENT') throw new Error('Herdr est introuvable. Indiquez son chemin avec BUREAU_HERDR_PATH.');
      if(error.killed) throw new Error('Herdr met trop de temps à répondre. Vérifiez sa fenêtre avant de réessayer.');
      throw new Error('Herdr ne répond pas ou a refusé la demande. Vérifiez sa fenêtre. Un envoi peut avoir été reçu : consultez le terminal avant de le répéter.');
    }
  });
  async function list() {
    const result=parseResult(await invoke(['agent','list']));
    if(!Array.isArray(result?.agents)) throw new Error('Liste des agents de Herdr illisible.');
    return result.agents.filter(a=>a.pane_id&&a.terminal_id).map(normalizeAgent);
  }
  async function resolve(id) {
    const agent=(await list()).find(a=>a.id===id);
    if(!agent) throw new Error('Agent introuvable. La liste a changé, sélectionnez à nouveau un agent.');
    return agent;
  }
  return {list,async read(id) {
    const agent=await resolve(id);
    const source=['idle','done'].includes(agent.status)?'recent-unwrapped':'visible';
    const text=await invoke(['agent','read',agent.paneId,'--source',source,'--lines','120']);
    return {text,truncated:true};
  },async prompt(id,message) {
    if(typeof message!=='string'||!message.trim()||message.length>12000||message.includes('\0')) throw new Error('Écrivez une consigne de 1 à 12 000 caractères, sans caractère nul.');
    if(inflight.has(id)) throw new Error('Un envoi est déjà en cours pour cet agent.');
    inflight.add(id);
    try {
      const agent=await resolve(id);
      if(!agent.ready) throw new Error('Cet agent n’est pas disponible. Attendez la fin de son travail ou répondez dans Herdr.');
      const result=parseResult(await invoke(['agent','prompt',agent.paneId,message]));
      if(result?.type!=='agent_prompted') throw new Error('L’envoi n’a pas été confirmé par Herdr. Consultez le terminal avant de réessayer.');
      return {ok:true,message:'Consigne transmise à Herdr.'};
    } finally {inflight.delete(id);}
  }};
}
