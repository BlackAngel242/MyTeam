import {createServer} from 'node:http';
import {readFile,lstat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {join,dirname,posix,win32} from 'node:path';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {createHerdr} from './src/herdr.mjs';
import {readClaudeActivity} from './src/claude-activity.mjs';
import {readAgentActivity,normalizeActivity} from './src/agent-activity.mjs';
import {standardPlaces,recentFiles,listDir,transfer,resolveInside,FileError} from './src/files.mjs';
import {readTodos,normalizeTodos} from './src/todos.mjs';
import {bossOf,readDelegations} from './src/delegations.mjs';
import {createQueue,QueueError} from './src/queue.mjs';
import {createTerminalStatusReader} from './src/terminal-status.mjs';
import {createDirection,DirectionError} from './src/direction.mjs';
import {readBlackboard} from './src/blackboard.mjs';
import {readClaudeResponses,readAgentResponses} from './src/responses.mjs';
import {createCrise} from './src/crisis.mjs';
import {createRelais,RelaisError} from './src/relais.mjs';
import {createAutonomie,AutonomieError} from './src/autonomie.mjs';
import {createSante} from './src/sante.mjs';
import {masque} from './src/masque.mjs';
import {recapAutonomie} from './src/autonomie-recap.mjs';

const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
const errorStatus=error=>[400,502].includes(error?.statusCode)?error.statusCode:500;
const execute=promisify(execFile);
const empreinte=value=>createHash('sha256').update(value).digest('hex');
export function createBureauServer({bridge=createHerdr(),readActivity=readClaudeActivity,readOtherActivity=readAgentActivity,getTodos=readTodos,getBlackboard=readBlackboard,getResponses=readClaudeResponses,getOtherResponses=readAgentResponses,cacheReponsesMs=3000,getPlaces=standardPlaces,executeFile=execute,platform=process.platform,delegations=readDelegations,now=()=>Date.now(),lireEtat=createTerminalStatusReader({now}),queueFile=fileURLToPath(new URL('./.bureau/file-attente.json',import.meta.url)),queue,criseFile=fileURLToPath(new URL('./.bureau/crise.json',import.meta.url)),crise,directionFile=fileURLToPath(new URL('./.bureau/direction.json',import.meta.url)),piedFile=fileURLToPath(new URL('./.bureau/pied.json',import.meta.url)),direction,relaisFile=join(dirname(queueFile),'relais.json'),relais,autonomieFile=join(dirname(queueFile),'autonomie.json'),autonomie:autonomieInjectee,sante:santeInjectee}={}) {
  const token=randomBytes(32).toString('hex');
  let transferPending=Promise.resolve();
  const etats=new Map();
  let sondeur=null;
  // Heure annoncée mémorisée à sa première lecture : le message reste affiché après la remise à zéro,
  // et « 4:39 PM » relu à 16:50 ne doit pas devenir demain.
  const echeances=new Map();
  // Pause de quota : la fin de pause retenue est la remise à zéro la plus tardive
  // parmi les limites atteintes. Une erreur de lecture est laissée remonter : la
  // file gèle alors l'envoi au lieu de l'autoriser (revue croisée, constat 3).
  // Le journal reste prioritaire ; l'état du terminal ne remplit que les trous.
  const limiteQuota=async(id,agents)=>{
    const agent=agents.find(cible=>cible.id===id);
    if(!agent) return {limitReached:false,resetsAt:null};
    if(agent.kind!=='Claude') {
      const activite=await readOtherActivity(agent,agents);
      const limites=Array.isArray(activite?.limits)?activite.limits:[];
      const atteintes=limites.filter(limite=>typeof limite?.usedPercent==='number'&&limite.usedPercent>=100);
      if(activite?.limitReached===true||atteintes.length>0) {
        const candidates=atteintes.length>0?atteintes:limites;
        const dates=candidates.map(limite=>typeof limite?.resetsAt==='string'?Date.parse(limite.resetsAt):NaN).filter(temps=>!Number.isNaN(temps));
        return {limitReached:true,resetsAt:dates.length?new Date(Math.max(...dates)).toISOString():null};
      }
    }
    const etat=etats.get(id);
    return etat?{limitReached:etat.limitReached===true,resetsAt:etat.resetsAt??null}:{limitReached:false,resetsAt:null};
  };
  // Sondage léger des terminaux : messages de limite observés dans le panneau.
  // Un seul cycle à la fois : la cadence est de 20 secondes, mais une lecture
  // lente de Herdr (jusqu'à 8 s par panneau) fait dépasser ce délai, et le tour
  // suivant démarrait alors que le premier n'est pas fini, doublant les appels.
  let sondageEnCours = null;
  const executerSonderEtats=async()=>{
    const liste=await bridge.list();
    await relaisEcoute.observe(liste,equipe.effective(liste).boss?.id).catch(()=>{});
    await autonomie.verifier().catch(()=>{});
    for(const agent of liste) {
      try {
        const etat=await lireEtat(agent);
        if(etat?.resetsAt) {
          const annonce=new Date(etat.resetsAt).toTimeString().slice(0,5);
          const connue=echeances.get(agent.id);
          if(connue&&connue.annonce===annonce&&now()-connue.vu<12*3600000) etat.resetsAt=connue.resetsAt;
          else echeances.set(agent.id,{annonce,resetsAt:etat.resetsAt,vu:now()});
          // Remise à zéro passée : le message affiché est périmé, l'agent n'est plus en pause.
          if(Date.parse(etat.resetsAt)<=now()) {etats.delete(agent.id);continue;}
        } else echeances.delete(agent.id);
        if(etat) etats.set(agent.id,etat); else etats.delete(agent.id);
      } catch { /* Lecture impossible : on garde le dernier état connu. */ }
    }
    await reprendreApresPause(liste).catch(()=>{});
  };
  const sonderEtats=()=>{
    if(!sondageEnCours) sondageEnCours=executerSonderEtats().finally(()=>{sondageEnCours=null;});
    return sondageEnCours;
  };
  // Reprise après une pause de quota, pour tous les agents : une minute après l'heure de retour, une consigne
  // courte passe par la file (donc jamais en crise, jamais à un agent occupé) pour vérifier qu'il est de nouveau là.
  // Une seule fois par pause ; en mémoire seulement, un redémarrage du serveur n'en rattrape aucune.
  const enPause=new Map(),reprises=new Map();
  async function reprendreApresPause(liste) {
    const maintenant=now();
    for(const agent of liste) {
      let limite;
      try {limite=await limiteQuota(agent.id,liste);} catch {continue;}
      if(limite.limitReached) {
        const retour=limite.resetsAt?Date.parse(limite.resetsAt):null;
        enPause.set(agent.id,Number.isFinite(retour)?retour:null);
      } else if(enPause.has(agent.id)) {
        const retour=enPause.get(agent.id);enPause.delete(agent.id);
        reprises.set(agent.id,{nom:agent.name,echeance:(retour??maintenant)+60000,retour});
      }
    }
    for(const [id,reprise] of [...reprises]) {
      const agent=liste.find(a=>a.id===id);
      if(!agent) {reprises.delete(id);continue;}
      if(maintenant<reprise.echeance||salleDeCrise.isActive()||!['idle','done'].includes(agent.status)) continue;
      reprises.delete(id);
      const heure=reprise.retour?new Date(reprise.retour).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):null;
      const message=`Chef : ta limite d'usage est levée${heure?` (retour annoncé à ${heure})`:''}. Réponds « dispo » en une ligne, puis reprends ta mission en cours (git status, puis la mission du chef) sans rien refaire de déjà commité. Économise ton quota.`;
      await fileAttente.enqueue({id,message,priority:'normale',requestKey:createHash('sha256').update(`reprise:${id}:${reprise.echeance}`).digest('hex')},{allowRepeatedMessage:true}).catch(()=>{});
    }
  }
  const pauses={
    tick:sonderEtats,
    start(intervalMs=20000){pauses.stop();sondeur=setInterval(()=>{sonderEtats().catch(()=>{});},intervalMs);sondeur.unref?.();},
    stop(){if(sondeur) clearInterval(sondeur);sondeur=null;},
    etatDe:id=>etats.get(id)??null,
  };
  // Fusion d'un état de terminal dans l'activité : une donnée de journal plus
  // précise n'est jamais écrasée ; le terminal signe sa source « terminal ».
  function fusionnerEtat(activite,etat){
    if(!etat) return activite;
    // Une pause déjà prouvée par le journal n'est jamais écrasée par le terminal.
    const journalPrecis=activite&&(activite.limitReached===true||(activite.limits??[]).some(limite=>typeof limite?.usedPercent==='number'&&limite.usedPercent>=100));
    if(journalPrecis) return activite;
    const base=activite??{tokens:null,limits:[],model:null,effort:null};
    return {...base,limitReached:etat.limitReached===true,resetsAt:etat.resetsAt??null,usedPercent:typeof etat.usedPercent==='number'?etat.usedPercent:null,source:'terminal'};
  }
  // Cache de 3 s par agent (cacheReponsesMs) : le fil, les réponses et le suivi relisaient les mêmes journaux à chaque sondage.
  const cacheReponses=new Map();
  const reponsesDe=(agent,agents)=>{
    const vu=cacheReponses.get(agent.id);
    if(vu&&now()-vu.at<cacheReponsesMs) return vu.promesse;
    const promesse=Promise.resolve(agent.kind==='Claude'?(agent.sessionId?getResponses(agent.sessionId):{found:false,complete:false,responses:[]}):getOtherResponses(agent,agents));
    cacheReponses.set(agent.id,{at:now(),promesse});
    if(cacheReponses.size>64) cacheReponses.delete(cacheReponses.keys().next().value);
    promesse.catch(()=>cacheReponses.delete(agent.id));
    return promesse;
  };
  // Salle de crise : un état illisible rend la crise active (rien ne part).
  const salleDeCrise=crise??createCrise({file:criseFile,now});
  const fileAttente=queue??createQueue({listAgents:async()=>bridge.list(),prompt:(id,message)=>bridge.prompt(id,message),limitsOf:limiteQuota,prepareFiles:prepareQueuedFiles,file:queueFile,now,locked:()=>salleDeCrise.isActive()});
  // Direction de l'équipe : choix de DrSmoke persisté, sinon la règle du plus
  // petit panneau. Le serveur n'envoie jamais de message lors d'un changement.
  const equipe=direction??createDirection({file:directionFile,now});
  // Le relais d'écoute passe par l'autonomie : sans mode actif, la consigne part telle quelle ; sinon elle rappelle l'objectif.
  const relaisEcoute=relais??createRelais({file:relaisFile,enqueue:(item,meta)=>autonomie.passer(item,meta),now,locked:()=>salleDeCrise.isActive()});
  const autonomie=autonomieInjectee??createAutonomie({file:autonomieFile,enqueue:item=>fileAttente.enqueue(item,{allowRepeatedMessage:true}),cancel:itemId=>fileAttente.cancel(itemId),relais:relaisEcoute,now,locked:()=>salleDeCrise.isActive()});
  // Santé du bureau (N7) : instantané de diagnostic, muet sur les chemins, les
  // clés, les objectifs et les messages. La route observe : aucun redémarrage.
  const sante=santeInjectee??createSante({bridge,criseActive:()=>salleDeCrise.isActive(),autonomieActive:()=>autonomie.get().actif===true,maintenant:now});
  // L'autonomie expose son objectif et son journal : ce sont des textes libres,
  // qui peuvent citer un chemin ou un secret. Ils passent par le masque public
  // avant de sortir du serveur, comme les autres sorties de texte.
  const vueAutonomie=brut=>{
    const etat=brut??autonomie.get();
    return {
      ...etat,
      objectif:typeof etat?.objectif==='string'?masque(etat.objectif):etat?.objectif??null,
      arret:typeof etat?.arret==='string'?masque(etat.arret):etat?.arret??null,
      journal:Array.isArray(etat?.journal)?etat.journal.map(entree=>({...entree,texte:typeof entree?.texte==='string'?masque(entree.texte):entree?.texte})):(etat?.journal??[]),
    };
  };
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
  async function prepareQueuedFiles(element,agent) {
    const operation=async()=>{
      try {
        const roots=await allowedRoots(),toRoot=rootOf(roots,'agent:'+element.id);
        if(toRoot!==agent.cwd) throw new FileError('Le dossier de la cible a changé.');
        element.copiedFiles=[];
        for(const file of element.files) {
          const fromRoot=rootOf(roots,file.root),fromPath=await relativeFile(fromRoot,file.path);
          const {real}=await resolveInside(fromRoot,fromPath),info=await lstat(real);
          if(!info.isFile()) throw new FileError('Seuls les fichiers peuvent être joints.');
          if(info.size>20*1024*1024) throw new FileError('Chaque fichier joint est limité à 20 Mo.');
          const copied=await transfer({fromRoot,fromPath,toRoot,toPath:'',mode:'copy'});
          element.copiedFiles.push({name:copied.name,at:new Date(now()).toISOString(),cwdTag:empreinte(toRoot)});
          const destination=await resolveInside(toRoot,copied.path);
          if((await lstat(destination.real)).size>20*1024*1024) throw new FileError('Un fichier a grandi pendant la copie et dépasse 20 Mo.');
        }
        return element.copiedFiles;
      } catch(error) {
        // Les erreurs natives peuvent contenir des chemins absolus : message fermé.
        throw new QueueError(error instanceof FileError?error.message:'Impossible de copier les fichiers joints. Aucun envoi effectué.');
      }
    };
    const pending=transferPending.then(operation);
    transferPending=pending.catch(()=>{});
    return pending;
  }
  async function traitementsDe(agent,agents) {
    const observedAt=new Date(now()).toISOString(),observedMs=Date.parse(observedAt);
    const items=(fileAttente.list({fileFacts:true}).items??[]).filter(item=>item.id===agent.id).slice(0,20);
    if(!items.some(item=>item.files?.length)) return {dossiers:[]};
    const roots=await allowedRoots(),root=roots.get('agent:'+agent.id)?.path;
    let responses=[];
    if(['Claude','Codex','OpenCode'].includes(agent.kind)&&items.some(item=>item.sentAt)) {
      try {const read=await reponsesDe(agent,agents);if(read?.found===true&&Array.isArray(read.responses)) responses=read.responses;}
      catch { /* Une source facultative indisponible ne retire pas les faits de la file. */ }
    }
    const etats={idle:'disponible',done:'terminé',working:'au travail',blocked:'en attente de réponse',unknown:'inconnu'};
    const dossiers=[];
    const nomValide=name=>typeof name==='string'&&name.length>0&&name.length<=255&&name!=='.'&&name!=='..'&&
      !/[\u0000-\u001f]/.test(name)&&posix.basename(name)===name&&win32.basename(name)===name&&!/^[a-z]:/i.test(name);
    for(const item of items) {
      const sent=typeof item.sentAt==='string'?Date.parse(item.sentAt):NaN;
      const next=items.map(other=>Date.parse(other.sentAt)).filter(at=>at>sent).sort((a,b)=>a-b)[0]??Infinity;
      for(const [index,file] of (Array.isArray(item.files)?item.files.slice(0,2):[]).entries()) {
        const copied=item.copiedFiles?.[index];
        const original=typeof file?.path==='string'?posix.basename(file.path.replaceAll('\\','/')):'';
        const name=nomValide(copied?.name)?copied.name:original;
        if(!nomValide(name)) continue;
        const faits=[];
        const fact=(at,fait,source)=>{
          const ms=typeof at==='string'?Date.parse(at):NaN;
          if(Number.isFinite(ms)) faits.push({at:new Date(ms).toISOString(),fait,source});
        };
        fact(item.createdAt,'Consigne mise en file.','file');
        if(nomValide(copied?.name)) fact(copied.at??observedAt,copied.at?'Copie faite dans le dossier de l’agent.':'Copie constatée dans la file ; heure de copie non conservée.','file');
        fact(item.sentAt,'Consigne envoyée à Herdr.','file');
        fact(observedAt,'État de la cible observé : '+(etats[agent.status]??'inconnu')+'.','herdr');
        // L'empreinte de destination empêche de lire un fichier homonyme dans un
        // nouveau dossier de l'agent. Les anciennes copies sans empreinte restent inconnues.
        if(root&&nomValide(copied?.name)&&copied.cwdTag===empreinte(root)) {
          try {
            const relative=await relativeFile(root,copied.name),{real}=await resolveInside(root,relative),info=await lstat(real);
            if(info.isFile()) {
              const changed=Number.isFinite(sent)&&info.mtimeMs>sent&&info.mtimeMs<=observedMs;
              fact(info.mtime.toISOString(),changed?'Le fichier a changé pendant le traitement.':'Date de modification du fichier observée.','disque');
            }
          } catch { /* Fichier disparu ou lien symbolique : aucun fait de disque fabriqué. */ }
        }
        const reply=responses.filter(response=>['terminée','interrompue'].includes(response?.state)&&
          Date.parse(response.startedAt)>=sent&&Date.parse(response.endedAt)>=Date.parse(response.startedAt)&&
          Date.parse(response.endedAt)<=observedMs&&Date.parse(response.endedAt)<next)
          .sort((a,b)=>Date.parse(a.endedAt)-Date.parse(b.endedAt))[0];
        if(reply) fact(reply.endedAt,'Une réponse de l’agent '+(reply.state==='terminée'?'s’est terminée':'a été interrompue')+' après l’envoi ; lien avec ce fichier non établi.','journal');
        faits.sort((a,b)=>a.at.localeCompare(b.at));
        dossiers.push({id:empreinte(`${item.itemId}\0${index}`).slice(0,16),fichierConfie:name,cible:agent.id,faits});
      }
    }
    return {dossiers};
  }
  const server=createServer(async(req,res)=> {
    const port=server.address()?.port;
    const origin=`http://127.0.0.1:${port}`;
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
    const json=(status,data)=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    const guard=(req,{body=true}={})=>{
      const sent=Buffer.from(req.headers['x-bureau-token']||'');
      const expected=Buffer.from(token);
      if(sent.length!==expected.length||!timingSafeEqual(sent,expected)) {json(403,{error:'Session expirée. Actualise le bureau.'});return false;}
      // Un POST exige l'origine exacte. Un GET de navigateur n'envoie pas
      // toujours Origin : la provenance est alors prouvée par Sec-Fetch-Site
      // = same-origin (en-tête posé par le navigateur, non modifiable par une
      // page). Sans aucune preuve, le refus reste la règle.
      const origine=req.headers.origin;
      if(body) {
        if(origine!==origin) {json(403,{error:'Origine du navigateur non reconnue. Ouvre le bureau depuis son adresse locale.'});return false;}
        if(!req.headers['content-type']?.startsWith('application/json')) {json(415,{error:'Format de consigne invalide.'});return false;}
      } else if(!(origine===origin||(!origine&&req.headers['sec-fetch-site']==='same-origin'))) {
        json(403,{error:'Provenance du navigateur absente. Actualise le bureau depuis son adresse locale.'});return false;
      }
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
    if(req.headers.host!==`127.0.0.1:${port}`) return json(403,{error:`Ouvre le bureau avec ${origin}`});
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
      // Pied de page facultatif : chacun met ses propres informations dans .bureau/pied.json ; rien n'est imposé.
      if(req.method==='GET'&&url.pathname==='/api/pied') {
        if(!guard(req,{body:false})) return;
        const net=valeur=>typeof valeur==='string'?Array.from(valeur.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim()).slice(0,120).join(''):'';
        try {
          const brut=JSON.parse(await readFile(piedFile,'utf8'));
          return json(200,{gauche:net(brut?.gauche),droite:net(brut?.droite),enseigne:net(brut?.enseigne).slice(0,28)});
        } catch {return json(200,{gauche:'',droite:'',enseigne:''});}
      }
      // Tableau mural : fichiers piliers du projet, en lecture seule, protégés comme les tâches.
      if(req.method==='GET'&&url.pathname==='/api/tableau') {
        if(!guard(req,{body:false})) return;
        try {return json(200,await getBlackboard());}
        catch {return json(500,{error:'Impossible de lire le tableau de l’équipe pour le moment.'});}
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
          // Chef effectif : choix de DrSmoke s'il vaut encore, sinon la règle.
          const {boss:chef,source:sourceDirection,since:depuisDirection}=equipe.effective(listed);
          await relaisEcoute.observe(listed,chef?.id).catch(()=>{});
          const agents=await Promise.all(listed.map(async agent=>{
            const {sessionId,creator_user_id,creator_account_id,activity:previousActivity,...publicAgent}=agent;
            publicAgent.boss=agent===chef;
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
            const etatPause=etats.get(agent.id);
            if(etatPause||publicAgent.activity) publicAgent.activity=fusionnerEtat(publicAgent.activity,etatPause);
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
          return json(200,{connected:true,agents,direction:{source:sourceDirection,since:depuisDirection},updatedAt:new Date().toISOString(),token});
        }
        catch(error) {return json(errorStatus(error),{connected:false,agents:[],error:error.message,updatedAt:new Date().toISOString(),token});}
      }
      // Réponses structurées d'un agent : journal local, lecture seule, jamais d'identifiant de session.
      if(req.method==='GET'&&url.pathname==='/api/reponses') {
        if(!guard(req,{body:false})) return;
        try {
          const agents=await bridge.list(),agent=agents.find(a=>a.id===url.searchParams.get('id'));
          if(!agent) return json(400,{error:'Agent introuvable.'});
          if(!['Claude','Codex','OpenCode'].includes(agent.kind)) return json(200,{supported:false,reason:'Les réponses de cet outil ne sont pas exposées pour le moment.',responses:[]});
          const lu=await reponsesDe(agent,agents);
          return json(200,{supported:true,found:lu.found===true,complete:lu.complete===true,responses:Array.isArray(lu.responses)?lu.responses:[]});
        } catch(error) {return json(errorStatus(error),{error:'Impossible de lire les réponses pour le moment.'});}
      }
      if(req.method==='GET'&&url.pathname==='/api/traitement') {
        if(!guard(req,{body:false})) return;
        try {
          const agents=await bridge.list(),agent=agents.find(item=>item.id===url.searchParams.get('id'));
          if(!agent) return json(400,{error:'Agent introuvable.'});
          return json(200,await traitementsDe(agent,agents));
        } catch(error) {return json(errorStatus(error),{error:'Impossible de lire le suivi des fichiers pour le moment.'});}
      }
      // Fil de la salle de contrôle : dernières réponses de tous les agents lisibles, extraits courts, du plus récent au plus ancien.
      // Jamais les messages inter-agents chiffrés ni ce que « pense » un agent : seulement des textes déjà masqués par les lecteurs.
      if(req.method==='GET'&&url.pathname==='/api/discussion') {
        if(!guard(req,{body:false})) return;
        try {
          const agents=await bridge.list(),bulles=[],sources=[];
          await Promise.all(agents.map(async agent=>{
            if(!['Claude','Codex','OpenCode'].includes(agent.kind)) {sources.push({agent:agent.name,id:agent.id,etat:'non exposé'});return;}
            let lu;
            try {lu=await reponsesDe(agent,agents);} catch {lu=null;}
            if(!lu||lu.found!==true) {sources.push({agent:agent.name,id:agent.id,etat:'non rattaché'});return;}
            sources.push({agent:agent.name,id:agent.id,etat:'lu'});
            for(const r of (Array.isArray(lu.responses)?lu.responses:[]).slice(-10)) {
              const at=r.endedAt||r.startedAt;
              if(at) bulles.push({agent:agent.name,id:agent.id,key:r.key,at,state:r.state,extrait:Array.from(String(r.blocks?.[0]?.text??'')).slice(0,240).join('')});
            }
          }));
          bulles.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
          return json(200,{bulles:bulles.slice(0,50),sources});
        } catch(error) {return json(errorStatus(error),{error:'Impossible de lire la discussion pour le moment.'});}
      }
      if(req.method==='GET'&&url.pathname==='/api/read') {
        if(!guard(req,{body:false})) return;
        return json(200,await bridge.read(url.searchParams.get('id')));
      }
      if(req.method==='POST'&&(url.pathname==='/api/prompt'||url.pathname==='/api/broadcast')) {
        const verrouille=()=>json(423,{error:'Salle de crise active : les envois sont verrouillés. Lève la crise pour reprendre.'});
        if(!guard(req)) return;
        if(salleDeCrise.isActive()) return verrouille();
        const parsed=await readJson(req);
        if(parsed===null) return;
        // La crise peut être déclenchée pendant la lecture du corps : revérification.
        if(salleDeCrise.isActive()) return verrouille();
        if(url.pathname==='/api/prompt') {
          if(typeof parsed.id!=='string'||!parsed.id) return json(400,{error:'Sélectionnez un agent.'});
          // Dernier contrôle juste avant l'appel à Herdr.
          if(salleDeCrise.isActive()) return verrouille();
          return json(200,await bridge.prompt(parsed.id,parsed.message));
        }
        const ids=parsed.ids;
        if(!Array.isArray(ids)||ids.length<1||ids.length>12||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length) return json(400,{error:'Choisis de 1 à 12 agents différents.'});
        // Un destinataire après l'autre : le verrou est revérifié juste avant
        // chaque envoi, une crise déclenchée en route arrête la suite.
        const results=[];
        for(const id of ids) {
          if(salleDeCrise.isActive()) return json(423,results.length?{error:'Salle de crise active : les envois sont verrouillés. Lève la crise pour reprendre.',results}:{error:'Salle de crise active : les envois sont verrouillés. Lève la crise pour reprendre.'});
          try {
            const un=await bridge.broadcast([id],parsed.message);
            if(Array.isArray(un?.results)) results.push(...un.results);
          } catch(error) {
            // Avant le premier envoi, l'erreur reste celle d'aujourd'hui (400, 502...).
            if(!results.length) throw error;
            results.push({id,name:'',ok:false,error:error.message||'La demande n’a pas abouti.'});
          }
        }
        return json(200,{results});
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
          if(url.pathname==='/api/queue') {
            if(Array.isArray(parsed.files)&&parsed.files.length) {
              const roots=await allowedRoots();
              for(const file of parsed.files) rootOf(roots,file?.root);
            }
            return json(200,await fileAttente.enqueue({id:parsed.id,message:parsed.message,notBefore:parsed.notBefore,priority:parsed.priority,requestKey:parsed.requestKey,files:parsed.files}));
          }
          return json(200,await fileAttente.cancel(parsed.itemId));
        } catch(error) {
          return json(error instanceof QueueError?(error.status??400):error instanceof FileError?400:errorStatus(error),{error:error.message||'La file d’attente n’a pas abouti.'});
        }
      }
      if(req.method==='POST'&&url.pathname==='/api/queue/priority') {
        if(!guard(req)) return;
        const parsed=await readJson(req);
        if(parsed===null) return;
        try {return json(200,await fileAttente.prioritize(parsed.itemId,parsed.priority));}
        catch(error) {
          return json(error instanceof QueueError?(error.status??400):errorStatus(error),{error:error.message||'La priorité n’a pas changé.'});
        }
      }
      if(url.pathname==='/api/autonomie/recap') {
        if(req.method!=='GET') return json(404,{error:'Page introuvable.'});
        if(!guard(req,{body:false})) return;
        // Texte Markdown : le récapitulatif ne raconte que les faits du journal.
        const corps=recapAutonomie(vueAutonomie());
        res.writeHead(200,{...headers,'Content-Type':'text/markdown; charset=utf-8'});
        return res.end(corps);
      }
      if(url.pathname==='/api/autonomie') {
        if(req.method==='GET') {
          if(!guard(req,{body:false})) return;
          return json(200,vueAutonomie());
        }
        if(req.method==='POST') {
          if(!guard(req)) return;
          const parsed=await readJson(req);
          if(parsed===null) return;
          if(typeof parsed?.actif!=='boolean') return json(400,{error:'L’autonomie exige {"actif":true,"objectif":"…"} ou {"actif":false}.'});
          try {return json(200,parsed.actif?vueAutonomie(await autonomie.demarrer(parsed)):vueAutonomie(await autonomie.arreter()));}
          catch(error) {return json(error instanceof AutonomieError?error.status:500,{error:error instanceof AutonomieError?error.message:'L’autonomie n’a pas pu être changée.'});}
        }
        return json(404,{error:'Page introuvable.'});
      }
      // Santé du bureau : jeton exigé, réponse muette (ni chemin, ni clé, ni
      // objectif, ni message). La route n'agit pas : pas de redémarrage ici.
      if(req.method==='GET'&&url.pathname==='/api/sante') {
        if(!guard(req,{body:false})) return;
        try {return json(200,await sante.instantane());}
        catch(error) {return json(errorStatus(error),{error:error.message||'La santé du bureau n’a pas pu être lue.'});}
      }
      if(url.pathname==='/api/relais') {
        if(req.method==='GET') {
          if(!guard(req,{body:false})) return;
          return json(200,relaisEcoute.get());
        }
        if(req.method==='POST') {
          if(!guard(req)) return;
          const parsed=await readJson(req);
          if(parsed===null) return;
          if(typeof parsed?.actif!=='boolean') return json(400,{error:'Le relais exige {"actif":true} ou {"actif":false}.'});
          try {return json(200,await relaisEcoute.set(parsed.actif));}
          catch(error) {return json(error instanceof RelaisError?error.status:500,{error:'Sauvegarde impossible : le relais n’a pas été changé.'});}
        }
        return json(404,{error:'Page introuvable.'});
      }
      // Salle de crise : état persisté, envois verrouillés, arrêt poli d'un agent.
      if(url.pathname==='/api/crise') {
        if(req.method==='GET') {
          if(!guard(req,{body:false})) return;
          return json(200,salleDeCrise.get());
        }
        if(req.method==='POST') {
          if(!guard(req)) return;
          const parsed=await readJson(req);
          if(parsed===null) return;
          if(typeof parsed?.active!=='boolean') return json(400,{error:'La crise s’active ou se lève avec {"active":true} ou {"active":false}.'});
          try {return json(200,await salleDeCrise.set(parsed.active));}
          catch(error) {return json(errorStatus(error),{error:error.message||'L’état de la salle de crise n’a pas changé.'});}
        }
        return json(404,{error:'Page introuvable.'});
      }
      if(req.method==='POST'&&url.pathname==='/api/crise/arret') {
        if(!guard(req)) return;
        const parsed=await readJson(req);
        if(parsed===null) return;
        if(typeof parsed?.id!=='string'||!parsed.id) return json(400,{error:'Sélectionnez un agent.'});
        if(!salleDeCrise.isActive()) return json(409,{error:'La salle de crise n’est pas active.'});
        try {return json(200,await bridge.interrupt(parsed.id));}
        catch(error) {return json(errorStatus(error),{error:error.message||'L’arrêt n’a pas été demandé.'});}
      }
      if(url.pathname==='/api/direction') {
        if(req.method==='POST') {
          if(!guard(req)) return;
          const parsed=await readJson(req);
          if(parsed===null) return;
          try {
            const vue=await equipe.set(await bridge.list(),parsed.agentId);
            // Aucun message n'est envoyé aux agents : la passation est écrite par
            // DrSmoke dans l'interface, puis passe par la file ou l'envoi normal.
            return json(200,{direction:{source:vue.source,since:vue.since}});
          } catch(error) {
            return json(error instanceof DirectionError?error.status:errorStatus(error),{error:error.message||'Le choix de direction n’a pas abouti.'});
          }
        }
        if(req.method==='DELETE') {
          if(!guard(req,{body:false})) return;
          try {return json(200,{direction:await equipe.clear()});}
          catch(error) {
            return json(error instanceof DirectionError?error.status:errorStatus(error),{error:error.message||'Le retour à la règle n’a pas abouti.'});
          }
        }
      }
      const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/logos.js':'logos.js','/terminal.js':'terminal.js','/response-card.js':'response-card.js','/tiles.js':'tiles.js','/i18n.js':'i18n.js','/i18n-en.js':'i18n-en.js','/discussion.js':'discussion.js','/sounds.js':'sounds.js','/empty-icons.js':'empty-icons.js','/appearance.js':'appearance.js','/appearance.css':'appearance.css','/icons.svg':'icons.svg'};
      if(req.method!=='GET'||!files[url.pathname]) return json(404,{error:'Page introuvable.'});
      const filename=files[url.pathname];
      let content;
      try {content=await readFile(join(publicDir,filename));} catch(error) {if(error.code==='ENOENT') return json(404,{error:'Page introuvable.'});throw error;}
      const type=filename.endsWith('.css')?'text/css':filename.endsWith('.js')?'text/javascript':filename.endsWith('.svg')?'image/svg+xml':'text/html';
      res.writeHead(200,{...headers,'Content-Type':`${type}; charset=utf-8`});res.end(content);
    } catch(error) {json(errorStatus(error),{error:error.message||'La demande n’a pas abouti.'});}
  });
  server.requestTimeout=20000;
  server.queue=fileAttente;
  server.pauses=pauses;
  server.direction=equipe;
  server.relais=relaisEcoute;
  server.autonomie=autonomie;
  return server;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  const port=Number(process.env.BUREAU_PORT||4317);
  const {createProjectServer}=await import('./src/project-server.mjs');
  const server=await createProjectServer({createBureauServer});
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Le port du bureau est déjà utilisé. Essayez un autre BUREAU_PORT.':'Le bureau n’a pas pu démarrer.');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>{
    // Planificateur de la file d'attente : un tour toutes les 15 secondes.

    // Pause de quota : lecture légère des terminaux toutes les 20 secondes.

    console.log(`Bureau des agents ouvert sur http://127.0.0.1:${port}`);
  });
}
