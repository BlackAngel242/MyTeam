// Contrat interface : GET /api/relais -> {actif:boolean} ; POST /api/relais
// reçoit {actif:boolean} et renvoie la même forme. Origine exacte et jeton exigés.
// Désactivé par défaut, persisté dans .bureau/relais.json. Aucun envoi direct :
// une fin observée working -> idle/done d'un autre agent ajoute au chef effectif
// une consigne de priorité normale. La première observation après démarrage ou
// activation sert de référence, sans reconstituer de transition pendant l'arrêt.
// Les doublons de sondage, crises, états intermédiaires et agents remplacés sont
// exclus. Une minute au minimum entre avis d'un même agent, même après reprise.
// Les clés opaques dépendent de l'agent et du compteur de changements d'état.
// Aucun chemin, identifiant privé ni contenu de réponse ne sort de ce module.
import { lstatSync, openSync, readSync, closeSync } from 'node:fs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest('hex');
const MAX=256, MINUTE=60000;
export class RelaisError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
export function createRelais({file,enqueue,now=()=>Date.now(),locked=()=>false}={}) {
  if(typeof file!=='string'||!file||typeof enqueue!=='function')throw new RelaisError('Relais mal configuré.',500);
  let actif=false,pending=Promise.resolve(),changes=0;
  const states=new Map(),last=new Map(),epoch=randomBytes(16).toString('hex');
  try {
    const info=lstatSync(file);
    if(!info.isFile()||info.isSymbolicLink()||info.size>65536)throw new Error();
    const fd=openSync(file,'r');let saved;
    try {
      const bytes=Buffer.alloc(65537),length=readSync(fd,bytes,0,bytes.length,0);
      if(length>65536)throw new Error();
      saved=JSON.parse(bytes.subarray(0,length).toString('utf8'));
    } finally {closeSync(fd);}
    if(typeof saved?.actif!=='boolean'||(saved.dernieres!==undefined&&(!Array.isArray(saved.dernieres)||saved.dernieres.length>MAX)))throw new Error();
    for(const entry of saved.dernieres??[]) {
      if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||!/^[0-9a-f]{64}$/.test(entry[0])||!Number.isFinite(entry[1])||entry[1]<0)throw new Error();
      last.set(entry[0],entry[1]);
    }
    actif=saved.actif;
  } catch {actif=false;last.clear();}
  const exclusive=operation=>{const next=pending.then(operation,operation);pending=next.catch(()=>{});return next;};
  const get=()=>({actif});
  async function save(value) {
    try {
      await mkdir(dirname(file),{recursive:true});
      await writeFile(`${file}.tmp`,JSON.stringify({actif:value,dernieres:[...last]}),'utf8');
      await rename(`${file}.tmp`,file);
    } catch {throw new RelaisError("Sauvegarde impossible : le relais n'a pas été changé.",500);}
  }
  function set(value) {
    if(typeof value!=='boolean')return Promise.reject(new RelaisError('Le relais exige un booléen actif.'));
    return exclusive(async()=>{
      await save(value);
      if(value!==actif)states.clear();
      actif=value;return get();
    });
  }
  function observe(agents,bossId) {
    const snapshot=Array.isArray(agents)?agents.slice(0,MAX).map(a=>({...a})):[];
    return exclusive(async()=>{
      const current=new Set(),events=[];
      for(const agent of snapshot) {
        if(typeof agent.id!=='string'||!agent.id||agent.id.length>200||current.has(agent.id))continue;
        current.add(agent.id);
        const before=states.get(agent.id);
        const counter=!before||before.status!==agent.status?++changes:before.counter;
        states.set(agent.id,{status:agent.status,counter});
        if(before?.status==='working'&&['idle','done'].includes(agent.status)&&agent.id!==bossId)events.push({agent,counter});
      }
      for(const id of states.keys())if(!current.has(id))states.delete(id);
      if(!actif||locked()||!current.has(bossId))return;
      const time=now();if(!Number.isFinite(time)||time<0)return;
      for(const [id,at]of last)if(time-at>=MINUTE)last.delete(id);
      for(const {agent,counter}of events) {
        if(locked())break;
        const key=hash(agent.id);
        if(last.has(key)||last.size>=MAX)continue;
        // Mémoriser AVANT la file : une réponse perdue ne déclenche aucun renvoi.
        last.set(key,time);
        try {await save(actif);}catch(error){actif=false;throw error;}
        if(locked())continue;
        const raw=typeof agent.name==='string'&&!/[\\/]/.test(agent.name)&&!/^\s*[a-z]:/i.test(agent.name)?agent.name:'Agent';
        const name=Array.from(raw.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()).slice(0,80).join('')||'Agent';
        await enqueue({id:bossId,message:`${name} vient de terminer. Lis son panneau avant de lui confier la suite.`,priority:'normale',requestKey:hash(`${epoch}:${agent.id}:${counter}`)},{agent:{id:agent.id,name}});
      }
    });
  }
  return {get,set,observe};
}
