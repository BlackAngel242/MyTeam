import {realpath,stat} from 'node:fs/promises';
import {relative,resolve,isAbsolute,win32,join} from 'node:path';
import {createHash} from 'node:crypto';

export class ProjectError extends Error{constructor(message){super(message);this.name='ProjectError';this.statusCode=400;}}
export function relativeProjectPath(value=''){
  if(typeof value!=='string'||value.length>2000||/[\0\r\n]/.test(value)||isAbsolute(value)||win32.isAbsolute(value)||/^[a-z]:/i.test(value)||value.split(/[\\/]/).includes('..'))throw new ProjectError('Choisis un dossier dans un lieu proposé.');
  return value;
}
const inside=(root,path)=>{const r=relative(root,path);return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+(process.platform==='win32'?'\\':'/')));};
export async function projectContains(root,path){
  if(typeof path!=='string'||!isAbsolute(path))return false;
  try{return inside(await realpath(root),await realpath(path));}catch{return false;}
}
export async function resolveProject(selection,places,myteamRoot){
  if(selection?.mode==='myteam')return {mode:'myteam',root:await realpath(myteamRoot)};
  if(selection?.mode!=='project'||typeof selection.place!=='string'||!Object.hasOwn(places,selection.place))throw new ProjectError('Choisis un projet et son dossier.');
  const base=await realpath(places[selection.place]),path=relativeProjectPath(selection.path);
  if(!path||path==='.')throw new ProjectError('Choisis un sous-dossier dédié à ton projet.');
  let root;try{root=await realpath(resolve(base,path));if(!(await stat(root)).isDirectory())throw new Error();}catch{throw new ProjectError('Ce dossier n’est pas disponible.');}
  if(root===base)throw new ProjectError('Choisis un sous-dossier dédié à ton projet.');
  if(!inside(base,root))throw new ProjectError('Ce dossier sort du lieu choisi.');
  if(await projectContains(myteamRoot,root)||await projectContains(root,myteamRoot))throw new ProjectError('Pour ce dossier, choisis « Améliorer MyTeam ».');
  return {mode:'project',root};
}
export const projectStateDir=(dataRoot,root)=>join(dataRoot,'projects',createHash('sha256').update(root).digest('hex'));

// Le contexte est immuable pour une instance ; les anciens planificateurs ne peuvent
// plus transmettre de consigne après sa désactivation.
export function scopedBridge(base,root){
  let active=true;const pending=new Set();
  const allowed=async agent=>active&&await projectContains(root,agent.cwd);
  const list=async()=>{if(!active)return[];const agents=await base.list();const keep=await Promise.all(agents.map(allowed));return active?agents.filter((_,i)=>keep[i]):[];};
  const command=(method,id,...args)=>{
    const operation=(async()=>{if(!active)throw new ProjectError('Le projet a changé. Actualise le bureau.');const agent=(await list()).find(a=>a.id===id);if(!active||!agent)throw new ProjectError('Cet agent ne travaille pas dans le projet actif.');return typeof method==='function'?method(agent):base[method](id,...args);})();
    pending.add(operation);operation.finally(()=>pending.delete(operation)).catch(()=>{});return operation;
  };
  return {list,allowed,run:(id,operation)=>command(operation,id),prompt:(id,message)=>command('prompt',id,message),read:id=>command('read',id),interrupt:id=>command('interrupt',id),
    async broadcast(ids,message){const results=[];for(const id of ids){try{await command('prompt',id,message);results.push({id,ok:true});}catch(e){results.push({id,ok:false,error:e.message});}}return{results};},
    async deactivate(){active=false;await Promise.allSettled([...pending]);}};
}
