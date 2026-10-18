import {createReadStream} from 'node:fs';
import {lstat,opendir,open} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {Readable} from 'node:stream';
import {createAgentActivityReader,readAgentActivity} from './agent-activity.mjs';
import {masque} from './masque.mjs';

const STATUSES=new Set(['pending','in_progress','completed']);
const MAX_BYTES=50*1024*1024,MAX_LINE=4*1024*1024;
const projectDirectory=fileURLToPath(new URL('../',import.meta.url));

function textOf(value) {
  if(typeof value!=='string') return '';
  // Masque public AVANT la troncature : réduire d'abord laisse fuiter la fin
  // d'un chemin ou d'un secret coupé au milieu (constat C-CD-04).
  return Array.from(masque(value.slice(0,1024))
    .replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,160).join('');
}

export function normalizeTodos(value) {
  const result={project:[],agents:{}};
  if(Array.isArray(value?.project)) result.project=value.project.filter(item=>item&&typeof item.text==='string'&&typeof item.done==='boolean'&&typeof item.source==='string'&&/^(?:TODO\.md|plan[^\\/:]*\.md)$/i.test(item.source)).slice(0,200).map(item=>({text:textOf(item.text),done:item.done,source:item.source}));
  if(value?.agents&&typeof value.agents==='object') for(const [id,tasks] of Object.entries(value.agents)) {
    if(!/^[a-zA-Z0-9_.:@-]{1,200}$/.test(id)||!Array.isArray(tasks)) continue;
    Object.defineProperty(result.agents,id,{enumerable:true,configurable:true,value:tasks.filter(task=>task&&typeof task.text==='string'&&STATUSES.has(task.status)).slice(0,200).map(task=>({text:textOf(task.text),status:task.status}))});
  }
  return result;
}

async function* completeLines(stream,state) {
  let partial=state.partial,skipping=state.skipping;
  for await(const chunk of stream) {
    state.offset+=chunk.length;
    let start=0;
    for(let end=chunk.indexOf(10);end!==-1;end=chunk.indexOf(10,start)) {
      const segment=chunk.subarray(start,end+1);
      if(!skipping&&partial.length+segment.length<=MAX_LINE) yield partial.length?Buffer.concat([partial,segment]):segment;
      partial=Buffer.alloc(0);skipping=false;start=end+1;
    }
    if(start<chunk.length) {
      if(!skipping&&partial.length+chunk.length-start<=MAX_LINE) partial=Buffer.concat([partial,chunk.subarray(start)]);
      else {partial=Buffer.alloc(0);skipping=true;}
    }
  }
  state.partial=partial;state.skipping=skipping;
}

async function readLines(path,state,size,consume) {
  if(state.exhausted||state.offset>=size) return;
  const stream=createReadStream(path,{start:state.offset,end:Math.min(size,state.offset+MAX_BYTES)-1});
  const input=Readable.from(completeLines(stream,state));
  const lines=createInterface({input,crlfDelay:Infinity});
  try {for await(const line of lines) {consume(line);if(state.exhausted) break;}}
  catch {state.exhausted=true;state.partial=Buffer.alloc(0);}
  finally {lines.close();input.destroy();stream.destroy();}
}

async function projectTodos(root) {
  const files=[{path:join(root,'TODO.md'),source:'TODO.md'}],result=[];
  try {
    const docs=join(root,'docs'),info=await lstat(docs);
    if(info.isDirectory()&&!info.isSymbolicLink()) {
      const names=[];
      for await(const entry of await opendir(docs)) if(entry.isFile()&&!entry.isSymbolicLink()&&/^plan.*\.md$/i.test(entry.name)) names.push(entry.name);
      for(const name of names.sort()) files.push({path:join(docs,name),source:name});
    }
  } catch { /* Le dossier docs est facultatif. */ }
  for(const file of files) {
    if(result.length>=200) break;
    try {
      const info=await lstat(file.path);
      if(!info.isFile()||info.isSymbolicLink()) continue;
      const state={offset:0,partial:Buffer.alloc(0),skipping:false,exhausted:false};
      let fence=null;
      await readLines(file.path,state,Math.min(info.size,MAX_BYTES),line=>{
        const marker=/^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
        if(marker) {
          if(!fence) fence=marker[1];
          else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length&&!marker[2].trim()) fence=null;
          return;
        }
        if(fence) return;
        const match=/^\s*-\s+\[([ xX])\]\s+(.+?)\s*$/.exec(line);
        if(match&&result.length<200) {
          const text=textOf(match[2]);
          if(text) result.push({text,done:match[1].toLowerCase()==='x',source:file.source});
          if(result.length===200) state.exhausted=true;
        }
      });
      // Les fichiers Markdown ne sont pas necessairement termines par un saut de ligne.
      if(!state.exhausted&&state.partial.length&&!state.skipping&&!fence) {
        const match=/^\s*-\s+\[([ xX])\]\s+(.+?)\s*$/.exec(state.partial.toString('utf8'));
        if(match) {const text=textOf(match[2]);if(text) result.push({text,done:match[1].toLowerCase()==='x',source:file.source});}
      }
    } catch { /* Aucun chemin ou message d'erreur de fichier n'est expose. */ }
  }
  return result.slice(0,200);
}

async function findClaude(root,name) {
  const pending=[root];
  while(pending.length) {
    const directory=pending.pop();
    try {
      const info=await lstat(directory);
      if(!info.isDirectory()||info.isSymbolicLink()) continue;
      for await(const entry of await opendir(directory)) {
        if(entry.isSymbolicLink()) continue;
        const path=join(directory,entry.name);
        if(entry.isDirectory()) pending.push(path);
        else if(entry.isFile()&&entry.name===name) return path;
      }
    } catch { /* Un dossier inaccessible ne bloque pas les autres. */ }
  }
  return null;
}

async function validClaudeFile(path,root) {
  for(let directory=dirname(path);;directory=dirname(directory)) {
    const info=await lstat(directory);
    if(!info.isDirectory()||info.isSymbolicLink()) return null;
    if(directory===root) break;
    if(dirname(directory)===directory) return null;
  }
  const info=await lstat(path);
  return info.isFile()&&!info.isSymbolicLink()?info:null;
}

function taskResultId(content) {
  const values=typeof content==='string'?[content]:Array.isArray(content)?content.filter(block=>block?.type==='text').map(block=>block.text):[];
  for(const value of values) {
    if(typeof value!=='string') continue;
    try {const parsed=JSON.parse(value);const id=parsed.taskId??parsed.task_id??parsed.id??parsed.task?.id;if(typeof id==='string'||typeof id==='number') return String(id);}
    catch { /* Claude peut publier un resultat textuel plutot que JSON. */ }
    const match=/Task #(\d+) created successfully/i.exec(value);
    if(match) return match[1];
  }
  return null;
}

function consumeClaude(state,entry) {
  const content=entry?.message?.content;
  if(!Array.isArray(content)) return;
  if(entry.type==='assistant') {
    for(const block of content) {
      if(block?.type!=='tool_use'||!['TodoWrite','TaskCreate','TaskUpdate'].includes(block.name)||typeof block.id!=='string'||block.id.length>128||state.seen.has(block.id)) continue;
      if(state.seen.size>=10000) {state.exhausted=true;return;}
      state.seen.add(block.id);
      const input=block.input;
      if(block.name==='TodoWrite') {
        if(!Array.isArray(input?.todos)||input.todos.length>200||!input.todos.every(todo=>typeof todo?.content==='string'&&STATUSES.has(todo.status))) {state.reliable=false;continue;}
        state.tasks.clear();state.creates.clear();state.reliable=true;state.published=true;
        input.todos.forEach((todo,i)=>state.tasks.set('todo:'+i,{text:textOf(todo.content),status:todo.status}));
      } else if(block.name==='TaskCreate') {
        const text=textOf(input?.subject);
        if(!text) continue;
        if(state.tasks.size>=200) {state.exhausted=true;return;}
        state.tasks.set(block.id,{text,status:'pending'});state.creates.set(block.id,block.id);state.published=true;
      } else {
        const id=String(input?.taskId??input?.task_id??'');
        if(!state.tasks.has(id)) {state.reliable=false;continue;}
        if(input.status==='deleted') {state.tasks.delete(id);continue;}
        const task=state.tasks.get(id);
        if(input.status!==undefined&&!STATUSES.has(input.status)) {state.reliable=false;continue;}
        if(input.status!==undefined) task.status=input.status;
        if(typeof input.subject==='string') task.text=textOf(input.subject);
      }
    }
  } else if(entry.type==='user') {
    for(const block of content) {
      if(block?.type!=='tool_result') continue;
      const key=state.creates.get(block.tool_use_id);
      if(key) {
        const task=state.tasks.get(key);state.creates.delete(block.tool_use_id);
        if(block.is_error) {state.tasks.delete(key);continue;}
        const id=taskResultId(block.content);
        if(id&&id.length<=128&&task) {state.tasks.delete(key);state.tasks.set(id,task);}
      } else if(block.is_error&&state.seen.has(block.tool_use_id)) state.reliable=false;
    }
  }
}

// Plafond du controle de continuite : jamais de relecture du journal entier
// pour decider si l'ancien decalage est encore valable (constat C-CD-07).
const CONTINUITY_BYTES=4096;

function freshClaudeState() {
  return {offset:0,partial:Buffer.alloc(0),skipping:false,exhausted:false,tasks:new Map(),creates:new Map(),seen:new Set(),published:false,reliable:true};
}

// Les transcripts Claude ne se relient qu'a un point de reprise intact : la
// ligne conservee occupe toujours sa place, ou la lecture s'est arretee juste
// apres un saut de ligne. Une reecriture plus longue sur le meme fichier garde
// sinon l'ancien decalage et fait perdre la fin du journal. Une ligne geante
// en cours d'ignorance n'a rien de conserve : le saut se poursuit.
async function resumePossible(path,state) {
  if(state.offset<=0) return true;
  if(state.skipping) return true;
  const conserve=state.partial.length?state.partial.subarray(Math.max(0,state.partial.length-CONTINUITY_BYTES)):null;
  const longueur=conserve?conserve.length:1;
  const depart=state.offset-longueur;
  if(depart<0) return false;
  try {
    const handle=await open(path,'r');
    try {
      const octets=Buffer.allocUnsafe(longueur);
      const {bytesRead}=await handle.read(octets,0,longueur,depart);
      if(bytesRead!==longueur) return false;
      return conserve?octets.equals(conserve):octets[0]===10;
    } finally {await handle.close();}
  } catch {return false;}
}

export function createTodosReader({projectRoot=projectDirectory,claudeRoot=join(homedir(),'.claude','projects'),codexRoot}={}) {
  const codex=codexRoot===undefined?readAgentActivity:createAgentActivityReader({codexRoot});
  const cache=new Map(),pending=new Map();
  async function readClaude(sessionId) {
    if(typeof sessionId!=='string'||!/^[0-9a-f-]{36}$/.test(sessionId)) return null;
    if(pending.has(sessionId)) return structuredClone(await pending.get(sessionId));
    const promise=(async()=>{
      let saved=cache.get(sessionId),path=saved?.path,info;
      if(path) {try {info=await validClaudeFile(path,claudeRoot);} catch {} }
      if(!info) {cache.delete(sessionId);path=await findClaude(claudeRoot,sessionId+'.jsonl');if(!path) return null;info=await validClaudeFile(path,claudeRoot);if(!info) return null;saved=null;}
      let state=saved?.state;
      if(!state||info.size<state.size||info.ino!==state.ino||info.birthtimeMs!==state.birthtimeMs||(!state.exhausted&&info.size===state.size&&info.mtimeMs!==state.mtimeMs)) state=freshClaudeState();
      // Un offset ne se reprend que si les octets du point de reprise sont
      // toujours en place ; sinon le transcript a ete reecrit et on relu tout.
      if(!state.exhausted&&state.offset<info.size&&!(await resumePossible(path,state))) state=freshClaudeState();
      await readLines(path,state,info.size,line=>{try {consumeClaude(state,JSON.parse(line));} catch {}});
      Object.assign(state,{size:info.size,mtimeMs:info.mtimeMs,ino:info.ino,birthtimeMs:info.birthtimeMs});
      cache.delete(sessionId);cache.set(sessionId,{path,state});if(cache.size>32) cache.delete(cache.keys().next().value);
      return state.exhausted||!state.published||!state.reliable||state.offset<info.size?null:[...state.tasks.values()].map(task=>({...task}));
    })().catch(()=>null);
    pending.set(sessionId,promise);
    try {return await promise;} finally {pending.delete(sessionId);}
  }
  return async function readTodos(agents=[]) {
    const result={project:await projectTodos(projectRoot),agents:{}};
    await Promise.all(agents.map(async agent=>{
      if(typeof agent?.id!=='string'||!/^[a-zA-Z0-9_.:@-]{1,200}$/.test(agent.id)) return;
      let tasks=null;
      try {
        if(agent.kind==='Codex') tasks=await codex.readPlan(agent,agents);
        else if(agent.kind==='Claude') tasks=await readClaude(agent.sessionId);
      } catch { /* Un plan facultatif absent n'est pas un echec du bureau. */ }
      if(Array.isArray(tasks)) Object.defineProperty(result.agents,agent.id,{enumerable:true,value:tasks.map(task=>({text:textOf(task.text),status:task.status})),configurable:true});
    }));
    return result;
  };
}

export const readTodos=createTodosReader();
