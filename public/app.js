'use strict';
const $ = id => document.getElementById(id);
const canvas = $('office'), ctx = canvas.getContext('2d');
// Teintes d'identité volontairement éloignées des couleurs d'état (menthe, bleu, ambre, gris).
const colors = ['#d98a74','#9b86e0','#d17aa6','#a3b05f','#b5654f','#7e5fa8'];
const drafts = new Map();
let state = { connected:false, agents:[], token:null }, selected = null, stateBusy = false, readBusy = false, sending = false, readSequence = 0, spots = [];
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
// Animation active par défaut (choix de DrSmoke) ; sa préférence est mémorisée dans ce navigateur.
const readMotion=()=>{try{return localStorage.getItem('bureau.animation');}catch{return null;}};
let paused = readMotion()==='off';
const labels = { idle:'Disponible', done:'Terminé', busy:'Au travail', working:'Au travail', running:'Au travail', waiting:'Attend une réponse', blocked:'Attend une réponse', unknown:'État inconnu', stopped:'Arrêté' };
const label = a => labels[a.status] || 'État inconnu';
const tint = a => ['busy','working','running'].includes(a.status) ? '#9dbbff' : ['idle','done'].includes(a.status) ? '#a0dfc4' : ['waiting','blocked'].includes(a.status) ? '#f4c780' : '#a7b8ce';
const activeAgent = () => state.agents.find(a => a.id === selected);
const canSend = a => Boolean(state.connected && a && a.ready && ['idle','done'].includes(a.status));
async function request(url, options = {}) {
  // Délais au moins égaux au pire cas du serveur (liste puis lecture Herdr) pour ne pas abandonner une réponse en route.
  const response = await fetch(url, { ...options, signal:AbortSignal.timeout(url==='/api/broadcast'?120000:30000), cache:'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'La demande a échoué. Réessaie dans un instant.');
  return data;
}
function errorText(error) {
  if (error.name === 'TimeoutError') return 'Herdr met trop de temps à répondre. Réessaie dans un instant.';
  if (error instanceof TypeError) return 'Le serveur local ne répond plus. Vérifie que le bureau est toujours lancé.';
  if (error instanceof SyntaxError) return 'Le serveur local a renvoyé une réponse illisible. Réessaie dans un instant.';
  return error.message || 'Impossible de joindre Herdr. Réessaie dans un instant.';
}
function updateForm() {
  const a = activeAgent(), allowed = canSend(a);
  $('message').disabled = !allowed || sending;
  $('send').disabled = !allowed || sending || !$('message').value.trim();
  $('send').querySelector('span').textContent = sending ? 'Envoi en cours…' : 'Envoyer la consigne';
  $('send-help').textContent = !a ? 'Sélectionne un agent pour lui écrire.' : !state.connected ? 'Envoi indisponible : Herdr est déconnecté.' : !allowed ? 'Cet agent doit être disponible pour recevoir une consigne.' : 'La consigne sera envoyée à ' + a.name + ' dans Herdr. Ctrl+Entrée pour envoyer.';
}
function renderAgents() {
  const list = $('agents-list'), focused = document.activeElement?.dataset?.agentId;
  list.replaceChildren();
  if (!state.agents.length) {
    const p = document.createElement('p');p.className='list-placeholder';p.textContent=state.connected?'Aucun agent détecté. Ouvre un agent dans Herdr pour lui donner un poste.':'Les postes apparaîtront lorsque Herdr sera connecté.';list.append(p);
  }
  state.agents.forEach((a,i) => {
    const button=document.createElement('button');button.type='button';button.className='agent-button'+(a.id===selected?' selected':'');button.dataset.agentId=a.id;button.setAttribute('aria-pressed',String(a.id===selected));
    const face=logoCanvas(a)||document.createElement('span');
    if(face.tagName==='SPAN'){face.className='pixel-face';face.style.setProperty('--agent-color',colors[i%colors.length]);}
    face.setAttribute('aria-hidden','true');
    const text=document.createElement('span'), name=document.createElement('span'), status=document.createElement('span');name.className='agent-name';name.textContent=a.name;status.className='agent-status';const qp=quotaPause(a);status.textContent=(!state.connected?'Connexion perdue':qp?'En pause (limite)'+(qp.until?' · retour '+hhmm(qp.until):''):label(a))+(a.paneId?' · '+a.paneId:'');text.append(name,status);button.append(face,text);button.addEventListener('click',()=>selectAgent(a.id));list.append(button);
  });
  if(focused){const again=[...list.children].find(e=>e.dataset.agentId===focused);(again||list.querySelector('.agent-button')||$('refresh')).focus({preventScroll:true});}
  const a=activeAgent();
  $('detail-title').textContent=a?a.name:'Choisis un agent';
  $('detail-status').textContent=a?(state.connected?label(a):'Connexion perdue'):'Son poste s’ouvrira ici.';
  $('detail-dot').style.background=a?tint(a):'#71839a';
  $('detail-avatar').style.color=a?colors[state.agents.indexOf(a)%colors.length]:'#a0dfc4';
  const avatarLogo=a&&logoCanvas(a);
  if(avatarLogo)$('detail-avatar').replaceChildren(avatarLogo);else if(!$('detail-avatar').querySelector('svg'))$('detail-avatar').replaceChildren(defaultAvatar.cloneNode(true));
  $('agent-meta').hidden=!a;
  if(a){$('agent-kind').textContent=a.kind||'Non précisé';$('agent-pane').textContent=a.paneId||'Non précisé';$('agent-cwd').textContent=a.cwd||'Non précisé';}
  renderActivity(a);renderStatusbar(a);updateForm();renderBroadcast();renderSummary();
}
// Résumé en tête de page et alerte : uniquement les états Herdr actuels.
function renderSummary(){
  const on=state.connected,count=list=>on?state.agents.filter(a=>list.includes(a.status)).length:0;
  $('count-work').textContent=count(['busy','working','running']);$('count-wait').textContent=count(['waiting','blocked']);$('count-free').textContent=count(['idle','done']);
  $('chips').classList.toggle('offline',!on);
  const waiting=on?state.agents.filter(a=>['waiting','blocked'].includes(a.status)):[];
  $('attention').hidden=!waiting.length;
  if(waiting.length){
    $('attention-text').textContent=waiting.length===1?waiting[0].name+' attend ta réponse dans Herdr.':waiting.map(a=>a.name).join(', ')+' attendent ta réponse dans Herdr.';
    $('attention-open').dataset.target=waiting[0].id;$('attention-open').textContent='Ouvrir le poste de '+waiting[0].name;
  }
  const free=on?state.agents.filter(canSend).length:0;
  $('team-badge').hidden=!free;$('team-badge').textContent=free;$('team-badge').title=free+' agent'+(free>1?'s':'')+' disponible'+(free>1?'s':'');
}
$('attention-open').addEventListener('click',()=>{const id=$('attention-open').dataset.target;if(id){selectAgent(id);showTab('poste');$('output').focus({preventScroll:true});}});
// Menu du panneau : onglets accessibles au clavier (flèches gauche et droite).
const tabs=['poste','equipe','fichiers'];
function showTab(name){
  for(const t of tabs){const on=t===name,tab=$('tab-'+t);tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;$('panel-'+t).hidden=!on;}
  if(name==='fichiers')loadFiles();
}
// Fichiers : récents dans le dossier de l'agent, ou navigation. Copier par glisser-déposer, déplacer avec Maj.
// Le serveur seul connaît les chemins réels ; ici on ne manipule que des clés de lieu et des chemins relatifs.
let filesView='recent',filesRoot=null,filesPath='',places=[],dragged=null,filesBusy=false;
const authed=()=>({'X-Bureau-Token':state.token||''});
const ago=iso=>since(Date.now()-new Date(iso).getTime());
const size=n=>n<1024?n+' o':n<1048576?(n/1024).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Ko':(n/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo';
function filesMessage(text,kind='info'){const r=$('files-result');r.hidden=!text;r.textContent=text;r.className='files-result '+kind;}
async function loadFiles(){
  const a=activeAgent();
  $('files-title').textContent=a?'Fichiers de '+a.name:'Fichiers';
  if(!a&&filesView==='recent'){$('file-list').replaceChildren();$('files-intro').textContent='Choisis un agent pour voir les fichiers modifiés récemment dans son dossier de travail.';$('files-crumbs').hidden=true;return;}
  if(filesBusy)return;filesBusy=true;
  try{
    const placeData=await request('/api/places',{headers:authed()});places=placeData.places||[];renderPlaces();
    let items;
    if(filesView==='recent'){
      const data=await request('/api/files/recent?id='+encodeURIComponent(a.id),{headers:authed()});
      filesRoot=data.root;items=data.files||[];
      $('files-intro').textContent=items.length?'Modifiés ces dernières 48 heures dans le dossier de travail de '+a.name+'. C’est un fait observé sur le disque, pas une preuve que '+a.name+' les a écrits.':'Aucun fichier modifié ces dernières 48 heures dans le dossier de '+a.name+'.';
      $('files-crumbs').hidden=true;
    }else{
      filesRoot=filesRoot||(a?'agent:'+a.id:places[0]?.key);
      const data=await request('/api/files/list?root='+encodeURIComponent(filesRoot)+'&path='+encodeURIComponent(filesPath),{headers:authed()});
      items=data.items||[];$('files-intro').textContent='Clique sur un dossier pour l’ouvrir.';renderCrumbs();
    }
    renderFileList(items);
  }catch(error){$('file-list').replaceChildren();$('files-intro').textContent=/introuvable|404/i.test(error.message)?'L’explorateur de fichiers attend son raccordement au serveur : il sera actif après le prochain redémarrage du bureau.':errorText(error);}
  finally{filesBusy=false;}
}
function fileIcon(item){
  const span=document.createElement('span');span.className='file-icon'+(item.dir?' folder':'');span.setAttribute('aria-hidden','true');
  span.textContent=item.dir?'':(item.ext||'?').slice(0,4).toUpperCase();return span;
}
function renderFileList(items){
  $('file-list').replaceChildren(...items.map(item=>{
    const li=document.createElement('li');li.className='file-row';
    const main=document.createElement(item.dir?'button':'div');main.className='file-main';
    if(item.dir){main.type='button';main.addEventListener('click',()=>{filesPath=item.path;loadFiles();});}
    else{main.draggable=true;main.addEventListener('dragstart',e=>{dragged={root:filesRoot,path:item.path,name:item.name};e.dataTransfer.setData('text/plain',item.name);e.dataTransfer.effectAllowed='copyMove';document.body.classList.add('dragging');});main.addEventListener('dragend',()=>{dragged=null;document.body.classList.remove('dragging');});}
    const text=document.createElement('span');text.className='file-text';
    const name=document.createElement('span');name.className='file-name';name.textContent=item.name;
    const meta=document.createElement('span');meta.className='file-meta';meta.textContent=item.dir?'Dossier':[item.path.includes('/')?item.path.slice(0,item.path.lastIndexOf('/')):'',size(item.size),ago(item.modified)].filter(Boolean).join(' · ');
    text.append(name,meta);main.append(fileIcon(item),text);li.append(main);
    if(!item.dir){
      const reveal=document.createElement('button');reveal.type='button';reveal.className='tool-button';reveal.textContent='Afficher';reveal.title='Afficher dans l’Explorateur';
      reveal.addEventListener('click',async()=>{try{await request('/api/files/reveal',{method:'POST',headers:{'Content-Type':'application/json',...authed()},body:JSON.stringify({root:filesRoot,path:item.path})});filesMessage(item.name+' affiché dans l’Explorateur.');}catch(error){filesMessage(errorText(error),'error');}});
      li.append(reveal);
    }
    return li;
  }));
}
function renderCrumbs(){
  const nav=$('files-crumbs');nav.hidden=false;const place=places.find(p=>p.key===filesRoot);
  const parts=filesPath?filesPath.split('/'):[],links=[[place?.label||'Dossier','']];
  parts.forEach((p,i)=>links.push([p,parts.slice(0,i+1).join('/')]));
  nav.replaceChildren(...links.map(([label,path],i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=i===links.length-1;b.addEventListener('click',()=>{filesPath=path;loadFiles();});return b;}));
}
function renderPlaces(){
  $('places').replaceChildren(...places.map(p=>{
    const li=document.createElement('li');const b=document.createElement('button');b.type='button';b.className='place '+p.kind;b.textContent=p.label;
    b.title=filesView==='recent'?'Glisse un fichier ici':'Ouvrir ce lieu';
    b.addEventListener('click',()=>{filesView='browse';syncFilesView();filesRoot=p.key;filesPath='';loadFiles();});
    b.addEventListener('dragover',e=>{if(!dragged)return;e.preventDefault();e.dataTransfer.dropEffect=e.shiftKey?'move':'copy';b.classList.add('over');});
    b.addEventListener('dragleave',()=>b.classList.remove('over'));
    b.addEventListener('drop',e=>{e.preventDefault();b.classList.remove('over');if(dragged)transferFile(dragged,p,e.shiftKey?'move':'copy');});
    li.append(b);return li;
  }));
}
// Déplacer retire le fichier de son dossier : un second geste de confirmation est demandé.
let pendingMove=null;
async function transferFile(file,place,mode){
  const key=file.root+'|'+file.path+'|'+place.key;
  if(mode==='move'&&pendingMove!==key){pendingMove=key;filesMessage('Déplacer '+file.name+' vers '+place.label+' ? Refais le même geste pour confirmer.','warn');return;}
  pendingMove=null;
  try{
    const r=await request('/api/files/transfer',{method:'POST',headers:{'Content-Type':'application/json',...authed()},body:JSON.stringify({from:{root:file.root,path:file.path},to:{root:place.key,path:''},mode})});
    filesMessage((mode==='move'?'Déplacé : ':'Copié : ')+file.name+' → '+place.label+(r.name!==file.name?' (renommé '+r.name+')':''),'ok');loadFiles();
  }catch(error){filesMessage(errorText(error),'error');}
}
function syncFilesView(){$('files-recent').setAttribute('aria-pressed',String(filesView==='recent'));$('files-browse').setAttribute('aria-pressed',String(filesView==='browse'));}
$('files-recent').addEventListener('click',()=>{filesView='recent';syncFilesView();loadFiles();});
$('files-browse').addEventListener('click',()=>{filesView='browse';syncFilesView();const a=activeAgent();filesRoot=a?'agent:'+a.id:null;filesPath='';loadFiles();});
tabs.forEach((t,i)=>{
  $('tab-'+t).addEventListener('click',()=>showTab(t));
  $('tab-'+t).addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;const next=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];showTab(next);$('tab-'+next).focus();});
});
// Barre d'état de l'outil : les dernières lignes d'un terminal d'IA sont son interface (invite, modèle, limites, raccourcis).
// On les sépare des sorties et on n'affiche que ce que l'outil écrit lui-même.
const spinner='⣾⣽⣻⢿⡿⣟⣯⣷⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏✻✶✳✢⬝';
const chromeLine=[/used \d+% of your .*limit|limit reached|resets \d/i,/^[\s─━═▀▄╹┃╭╮╰╯│]*$/,/^\s*[›>❯]\s*($|\S)/,/for shortcuts|esc (to )?(interrupt|cancel)|ctrl\+p|shift\+tab|f2 to view|\/status|Ask anything|to do anything|auto mode|bypass permissions|accept edits|Restart to update|Update installed|update available/i,/^\s*┃/,/limit:\s*\d+%\s*left/i,/\s·\s~\s·\s/,new RegExp('^\\s*['+spinner+']'),new RegExp('^[\\s'+spinner+'·*]*(Working|Loading|Thinking|Réflexion)?[.…]*\\s*$','i'),/⊙\s*\d+\s*(MCP|plugins?)/i];
function splitChrome(text){
  const lines=text.replace(/\s+$/,'').split('\n');let cut=lines.length,seen=0;
  // Au plus 10 lignes non vides : certains outils (OpenCode) encadrent aussi leurs messages de « ┃ ».
  for(let i=lines.length-1;i>=0&&seen<10;i--){if(!chromeLine.some(r=>r.test(lines[i])))break;cut=i;if(lines[i].trim())seen++;}
  const chrome=lines.slice(cut).join('\n'),s={};
  let m;
  if((m=chrome.match(/^\s*(\S+)\s+(minimal|low|medium|high|xhigh|max)\s+·\s+\S+\s+·\s+(.+?)\s*…?\s*$/m))){s.model=m[1];s.effort=m[2];s.title=m[3];}
  else if((m=chrome.match(/shortcuts\s{2,}(.+?)\s+·\s+(minimal|low|medium|high|xhigh|max)\s*$/mi))){s.model=m[1];s.effort=m[2];}
  else if((m=chrome.match(/┃\s+(\w[\w ]*?)\s+·\s+(.+?)\s*$/m))&&!/shortcuts|commands/.test(m[2])){s.mode=m[1];s.model=m[2];}
  if((m=chrome.match(/(\d+\s*[hj]|weekly|hebdo\w*)?\s*limit:\s*(\d+)%\s*left/i)))s.limit={window:(m[1]||'').replace(/\s/g,''),left:Number(m[2])};
  // Claude Code : « You've used 91% of your session limit · resets 4:40am ».
  if(!s.limit&&(m=chrome.match(/used\s+(\d+)%\s+of your (\w+) limit[^\n]*?resets\s+([0-9:]+\s*[ap]m)/i)))s.limit={window:m[2].toLowerCase()==='session'?'de session':m[2],left:100-Number(m[1]),reset:parseClock(m[3])};
  if((m=chrome.match(/(\d+(?:[.,]\d+)?\s*[KkM])\s*\((\d+)%\)/)))s.context={used:m[1],pct:Number(m[2])};
  if((m=chrome.match(/(\d+)\s+warnings?/i)))s.warnings=Number(m[1]);
  if((m=chrome.match(/Working\s*\((\d+h\s*)?(\d+m\s*)?\d+s/i)))s.elapsed=m[0].replace(/Working\s*\(/i,'').trim();
  // Ligne d'activité écrite par l'outil derrière son indicateur animé (la plus récente), sans les mots de remplissage.
  const live=[...chrome.matchAll(new RegExp('^\\s*['+spinner+']+\\s+(.+)$','gm'))].map(x=>x[1].trim()).filter(t=>/[A-Za-zÀ-ÿ]{3,}/.test(t)&&!/^(Working|Loading|Thinking)[.…]*$/i.test(t)&&!/esc (to )?interrupt/i.test(t));
  // Le texte animé s'écrit lettre à lettre : on garde la version la plus complète des dernières lignes.
  if(live.length){
    let t=live.slice(-4).reduce((x,y)=>y.length>=x.length?y:x);
    const meta=t.match(/\(((?:\d+h\s*)?(?:\d+m\s*)?\d+s)(?:\s*·\s*[↓↑]\s*([\d.,]+\s*[kKM]?)\s*tokens)?[^)]*\)\s*$/);
    if(meta){s.elapsed=s.elapsed||meta[1];if(meta[2])s.flow=meta[2].replace('.',',');t=t.slice(0,meta.index).trim();}
    s.thought=t;
  }
  if(/Thinking|Réflexion/i.test(chrome)||s.thought)s.activity='Réflexion';else if(/Working|esc (to )?interrupt/i.test(chrome))s.activity='Exécution';else if(/Loading/i.test(chrome))s.activity='Chargement';
  const quota=limitFromText(text);if(quota)s.quota=quota;
  return {body:lines.slice(0,cut).join('\n').replace(/\s+$/,''),status:s};
}
const statusCache=new Map();
// Pause de quota : l'outil annonce lui-même la fin de sa limite (« try again at 4:37 AM », « resets 7pm »),
// ou son journal donne l'heure exacte de remise à zéro (Codex). Relance prévue 5 minutes après.
function parseClock(txt){
  const m=/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i.exec(txt)||/(\d{1,2})[:h](\d{2})/.exec(txt);if(!m)return null;
  let h=Number(m[1])%12,min=Number(m[2]||0);if(m[3]){if(m[3].toLowerCase()==='p')h+=12;}else h=Number(m[1]);
  const d=new Date();d.setHours(h,min,0,0);if(d<Date.now()-60000)d.setDate(d.getDate()+1);return d;
}
function limitFromText(text){
  const tail=text.split('\n').slice(-40).join('\n');
  if(!/usage limit|limit reached|rate limit|quota (atteint|exceeded)|hit your .*limit/i.test(tail))return null;
  const when=/(?:try again at|resets?(?: at)?|reset at|réessaie(?:z)? à)\s+([^\n.·]+)/i.exec(tail);
  return {until:when?parseClock(when[1]):null};
}
function quotaPause(a){
  if(!a)return null;
  const act=a.activity;
  if(act?.limitReached){
    const times=(act.limits||[]).filter(l=>l.resetsAt&&(l.usedPercent>=100||act.limitReached)).map(l=>new Date(l.resetsAt)).filter(d=>d>Date.now());
    return {until:times.length?new Date(Math.max(...times)):null,source:'journal'};
  }
  const s=statusCache.get(a.id)?.status?.quota;
  if(s&&(!s.until||s.until>Date.now()))return {until:s.until,source:'terminal'};
  return null;
}
const hhmm=d=>d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
function renderStatusbar(a){
  const bar=$('statusbar'),s=a&&statusCache.get(a.id);
  if(!a||!s||!Object.keys(s.status).length){bar.hidden=true;return;}
  const st=s.status;bar.hidden=false;
  const head=st.title||(st.thought?'En cours : '+st.thought:'');
  $('task-title').hidden=!head;$('task-title').textContent=head;
  const chips=[],pause=quotaPause(a);
  if(pause)chips.push(['warn',pause.until?'Limite atteinte · retour à '+hhmm(pause.until)+' ('+until(pause.until)+') · relance prévue à '+hhmm(new Date(pause.until.getTime()+300000)):'Limite atteinte · heure de retour non annoncée']);
  if(st.activity&&!pause)chips.push(['activity',st.activity+(st.elapsed?' · '+st.elapsed:'')]);
  if(st.model)chips.push(['model',(st.mode?st.mode+' · ':'')+st.model+(st.effort?' · '+st.effort:'')]);
  if(st.context)chips.push(['context','Contexte '+st.context.used+' · '+st.context.pct+' %']);
  if(st.flow)chips.push(['context',st.flow+' tokens sur ce tour']);
  if(st.warnings)chips.push(['warn',st.warnings+' avertissement'+(st.warnings>1?'s':'')]);
  $('status-chips').replaceChildren(...chips.map(([k,t])=>{const li=document.createElement('li');li.className='schip '+k;li.textContent=t;return li;}));
  $('limit').hidden=!st.limit;
  if(!st.limit){$('limit-label').textContent='';$('limit-value').textContent='';}
  else{
    $('limit-label').textContent='Limite'+(st.limit.window?' '+st.limit.window:'')+' restante'+(st.limit.reset?' · remise à zéro '+hhmm(st.limit.reset):'');$('limit-value').textContent=st.limit.left+' %';
    $('limit-bar').style.width=Math.max(0,Math.min(100,st.limit.left))+'%';$('limit').classList.toggle('low',st.limit.left<=20);
  }
  $('status-source').textContent='Lu dans la barre de l’outil à '+s.at.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
// Terminal : recherche, défilement figé et copie. Le module de Codex surligne les signaux réels s'il est chargé.
// Le texte est lié à l'agent qui l'a produit : jamais de sortie de A affichée ou copiée sous le nom de B.
let termData={id:null,text:'',valid:false},frozen=false;
function termPlaceholder(message){
  termData={id:selected,text:'',valid:false};$('output').textContent=message;$('term-hits').textContent='';
  $('term-copy').disabled=true;$('term-search').disabled=true;
}
function renderOutput(){
  if(!termData.valid||termData.id!==selected)return false;
  const sel=getSelection();
  // Ne pas écraser une sélection en cours : DrSmoke est peut-être en train de copier une ligne.
  if(sel&&!sel.isCollapsed&&$('output').contains(sel.anchorNode)){$('read-state').textContent='Sélection en cours, affichage en pause';return false;}
  const output=$('output'),text=termData.text,atBottom=output.scrollHeight-output.scrollTop-output.clientHeight<45,query=$('term-search').value.trim();
  let matches=0;
  if(window.TerminalView?.render){try{matches=window.TerminalView.render(output,text,{query,frozen})?.matches||0;}catch{output.textContent=text;}}
  else{output.textContent=text;if(query)matches=text.toLowerCase().split(query.toLowerCase()).length-1;}
  if(!frozen&&atBottom)output.scrollTop=output.scrollHeight;
  $('term-hits').textContent=query?(matches?matches+' trouvé'+(matches>1?'s':''):'Aucun résultat'):'';
  $('term-copy').disabled=false;$('term-search').disabled=false;
  return true;
}
$('term-search').addEventListener('input',renderOutput);
// Ctrl+Entrée (ou Cmd+Entrée) envoie, sans contourner les vérifications des boutons.
$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!$('send').disabled){e.preventDefault();$('prompt-form').requestSubmit();}});
$('broadcast-message').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!$('broadcast-send').disabled){e.preventDefault();$('broadcast-send').click();}});
$('broadcast-all').addEventListener('click',()=>{for(const a of state.agents)if(canSend(a))broadcastTargets.add(a.id);broadcastArmed=null;renderBroadcast();});
$('term-freeze').addEventListener('click',()=>{frozen=!frozen;$('term-freeze').setAttribute('aria-pressed',String(frozen));$('term-freeze').textContent=frozen?'Reprendre':'Figer';$('read-state').textContent=frozen?'Défilement figé':'Lecture actualisée';});
$('term-copy').addEventListener('click',async()=>{if(!termData.valid||termData.id!==selected)return;try{await navigator.clipboard.writeText(termData.text);$('term-copy').textContent='Copié';}catch{$('term-copy').textContent='Copie refusée';}setTimeout(()=>{$('term-copy').textContent='Copier';},1600);});
// Journal des envois : trois issues seulement, jamais de faux « non transmise » quand on ne sait pas.
// sent = Herdr a confirmé ; refused = refus avant tout envoi ; unknown = coupure, délai ou erreur après la transmission.
const outcomeLabels={sent:'transmise',refused:'refusée avant envoi',unknown:'résultat inconnu, vérifie le terminal'};
function outcomeOf(error){
  if(!error||error.name==='TimeoutError'||error instanceof TypeError||error instanceof SyntaxError)return 'unknown';
  return /peut avoir été reçu|pas été confirmé|ne répond pas|trop de temps/i.test(error.message||String(error))?'unknown':'refused';
}
const sendLog=[];
function logSend(names,message,outcome,detail){
  sendLog.unshift({at:new Date(),names,message,outcome,detail});sendLog.length=Math.min(sendLog.length,30);
  $('send-log').replaceChildren(...sendLog.map(e=>{
    const li=document.createElement('li');li.className=e.outcome;
    const head=document.createElement('span');head.className='log-head';head.textContent=e.at.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+' · '+e.names.join(', ')+' · '+outcomeLabels[e.outcome];
    const body=document.createElement('span');body.className='log-body';body.textContent=e.message.length>110?e.message.slice(0,110)+'…':e.message;
    li.append(head,body);if(e.outcome!=='sent'){const why=document.createElement('span');why.className='log-why';why.textContent=e.detail;li.append(why);}return li;
  }));
}
const compact=n=>n>=1e6?(n/1e6).toLocaleString('fr-FR',{maximumFractionDigits:1})+' M':n>=1e3?(n/1e3).toLocaleString('fr-FR',{maximumFractionDigits:1})+' k':String(n);
function since(ms){const s=Math.round(ms/1000);return s<60?'il y a '+s+' s':s<3600?'il y a '+Math.round(s/60)+' min':'il y a '+Math.round(s/3600)+' h';}
function until(d){const m=Math.max(0,Math.round((d-Date.now())/60000));return m<60?'dans '+m+' min':'dans '+Math.floor(m/60)+' h '+String(m%60).padStart(2,'0');}
// Tokens et sous-agents : uniquement ce que le transcript local expose (Claude). Les autres outils ne les publient pas.
function renderActivity(a){
  const list=$('subagent-list');list.replaceChildren();list.hidden=true;
  if(!a)return;
  const change=changes.get(a.id);
  $('agent-since').textContent=change?label(a)+', '+since(performance.now()-change.at):label(a)+', depuis l’ouverture du bureau au moins';
  const act=a.activity;
  if(!act){$('agent-tokens').textContent='Non exposé par cet outil';$('agent-subagents').textContent='Non exposé par cet outil';return;}
  const t=act.tokens||{};
  $('agent-tokens').textContent=compact(t.output||0)+' produits · '+compact((t.input||0)+(t.cacheCreation||0))+' lus · '+compact(t.cacheRead||0)+' en cache';
  const subs=act.subagents||[];
  $('agent-subagents').textContent=subs.length?String(subs.length):'Aucun';
  for(const s of subs){const li=document.createElement('li');li.textContent=s.description||'Sous-agent sans description';list.append(li);}
  list.hidden=!subs.length;
}
const defaultAvatar=$('detail-avatar').querySelector('svg').cloneNode(true);
const logoFor=a=>{const set=window.AGENT_LOGOS;return set&&(set[a.kind]||set.Agent)||null;};
function logoCanvas(a){
  const logo=logoFor(a);if(!logo)return null;
  const c=document.createElement('canvas');c.width=16;c.height=16;c.className='agent-logo';
  const g2=c.getContext('2d');
  logo.rows.forEach((row,y)=>[...row].forEach((ch,x)=>{if(logo.palette[ch]){g2.fillStyle=logo.palette[ch];g2.fillRect(x,y,1,1);}}));
  return c;
}
// Envoi groupé : seuls les agents disponibles peuvent être cochés, et un second clic confirme la liste exacte.
const broadcastTargets=new Set();let broadcastArmed=null,broadcasting=false;
function renderBroadcast(){
  const box=$('broadcast-targets'),focused=document.activeElement?.dataset?.target;
  for(const id of [...broadcastTargets])if(!canSend(state.agents.find(a=>a.id===id)))broadcastTargets.delete(id);
  box.replaceChildren(...state.agents.map(a=>{
    const ok=canSend(a),labelEl=document.createElement('label'),box2=document.createElement('input');
    box2.type='checkbox';box2.dataset.target=a.id;box2.checked=broadcastTargets.has(a.id);box2.disabled=!ok||broadcasting;
    box2.addEventListener('change',()=>{box2.checked?broadcastTargets.add(a.id):broadcastTargets.delete(a.id);broadcastArmed=null;renderBroadcast();});
    const name=document.createElement('span');name.textContent=a.name+(ok?'':' · '+label(a).toLowerCase());
    labelEl.className='target'+(ok?'':' unavailable');labelEl.append(box2,name);return labelEl;
  }));
  if(!state.agents.length){const p=document.createElement('p');p.className='list-placeholder';p.textContent='Aucun agent à contacter pour le moment.';box.append(p);}
  // Le focus clavier reste sur une commande utilisable même si la case visée vient d'être désactivée.
  if(focused){const again=box.querySelector(`[data-target="${CSS.escape(focused)}"]`);(again&&!again.disabled?again:box.querySelector('input:not(:disabled)')||$('broadcast-message')).focus({preventScroll:true});}
  const names=state.agents.filter(a=>broadcastTargets.has(a.id)).map(a=>a.name),n=names.length,text=$('broadcast-message').value.trim();
  $('broadcast-message').disabled=broadcasting||!state.connected;
  $('broadcast-all').disabled=broadcasting||!state.agents.some(a=>canSend(a)&&!broadcastTargets.has(a.id));
  $('broadcast-send').disabled=broadcasting||!n||!text;
  $('broadcast-send').querySelector('span').textContent=broadcasting?'Envoi en cours…':broadcastArmed?'Confirmer l’envoi à '+names.join(', '):n?'Envoyer à '+n+' agent'+(n>1?'s':''):'Coche au moins un agent';
  $('broadcast-send').classList.toggle('armed',Boolean(broadcastArmed));
  $('broadcast-help').textContent=!state.connected?'Envoi indisponible : Herdr est déconnecté.':broadcastArmed?'Vérifie la liste, puis clique encore pour envoyer. La même consigne partira séparément à chacun.':'Seuls les agents disponibles ou ayant terminé peuvent recevoir une consigne.';
}
$('broadcast-message').addEventListener('input',()=>{broadcastArmed=null;renderBroadcast();});
$('broadcast-send').addEventListener('click',async()=>{
  const ids=state.agents.filter(a=>broadcastTargets.has(a.id)&&canSend(a)).map(a=>a.id),message=$('broadcast-message').value.trim();
  if(!ids.length||!message||broadcasting)return;
  const key=ids.join('|')+'\n'+message;
  if(broadcastArmed!==key){broadcastArmed=key;renderBroadcast();return;}
  broadcasting=true;broadcastArmed=null;renderBroadcast();
  const results=$('broadcast-results');results.replaceChildren();results.hidden=true;
  try{
    const data=await request('/api/broadcast',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({ids,message})});
    for(const r of data.results||[]){
      const outcome=r.ok?'sent':outcomeOf(new Error(r.error||''));
      const li=document.createElement('li');li.className=outcome;li.textContent=(r.name||'Agent')+' : '+(r.ok?(r.message||'consigne transmise à Herdr.'):(r.error||'envoi refusé.'));results.append(li);
      logSend([r.name||'Agent'],message,outcome,r.ok?'Consigne transmise à Herdr.':r.error||'Envoi refusé.');
      // Un agent servi ne doit jamais recevoir la consigne une seconde fois lors d'une reprise.
      if(r.ok||outcome==='unknown')broadcastTargets.delete(r.id);
    }
    if((data.results||[]).every(r=>r.ok))$('broadcast-message').value='';
  }catch(error){
    const li=document.createElement('li');li.className='unknown';li.textContent=errorText(error)+' Vérifie les terminaux avant de renvoyer : une partie des consignes peut avoir été reçue.';results.append(li);
    logSend(state.agents.filter(a=>ids.includes(a.id)).map(a=>a.name),message,outcomeOf(error),errorText(error));
    broadcastTargets.clear();
  }
  results.hidden=false;broadcasting=false;await refreshState();
});
// Brouillons bornés : les plus anciens partent d'abord, jamais celui du poste ouvert.
function keepDraft(id,text){
  drafts.delete(id);if(text)drafts.set(id,text);
  for(const key of drafts.keys()){if(drafts.size<=30)break;if(key!==selected)drafts.delete(key);}
}
function selectAgent(id) {
  // Choisir un poste ouvre l'onglet Poste (ou garde Fichiers si DrSmoke y est) ; sur téléphone on défile jusqu'à lui.
  const onFiles=$('tab-fichiers').getAttribute('aria-selected')==='true';
  if(innerWidth<860)document.querySelector('.detail').scrollIntoView({behavior:motionPreference.matches?'auto':'smooth',block:'start'});
  if(id===selected){showTab(onFiles?'fichiers':'poste');return;}
  if(onFiles){filesView='recent';syncFilesView();filesPath='';}
  queueMicrotask(()=>showTab(onFiles?'fichiers':'poste'));
  if(selected) keepDraft(selected,$('message').value);
  selected=id;readSequence++;
  $('message').value=drafts.get(id)||'';$('send-result').hidden=true;
  termPlaceholder('Lecture des dernières sorties…');$('read-state').textContent='Lecture en cours…';
  renderAgents();readOutput();draw(0);
}
async function refreshState() {
  if(stateBusy)return;stateBusy=true;$('refresh').disabled=true;
  try {
    const data=await request('/api/state');
    state={...data,agents:Array.isArray(data.agents)?data.agents:[]};
    // Une disparition n'est confirmée que dans une liste connectée ; pendant une panne, le poste et le brouillon sont gardés.
    if(selected&&state.connected&&!activeAgent()) {
      keepDraft(selected,$('message').value);selected=null;readSequence++;$('message').value='';termPlaceholder('Cet agent a quitté Herdr. Sélectionne un autre poste.');$('read-state').textContent='Poste fermé';$('send-result').hidden=true;
    } else if(selected&&!state.connected){readSequence++;termPlaceholder('Herdr ne répond plus. Ce poste sera retrouvé dès le retour de la connexion.');$('read-state').textContent='Lecture indisponible';}
    if(state.connected){const live=new Set(state.agents.map(a=>a.id));for(const m of [lastStatus,changes])for(const id of m.keys())if(!live.has(id))m.delete(id);}
    $('state-error').hidden=!data.error;$('state-error').textContent=data.error||'';
    $('last-update').textContent='Actualisé à '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }catch(error){
    if(selected)keepDraft(selected,$('message').value);
    state={connected:false,agents:[],token:null};readSequence++;
    termPlaceholder('Le serveur du bureau ne répond plus. Ce poste sera retrouvé dès son retour.');$('read-state').textContent='Lecture indisponible';
    $('state-error').hidden=false;$('state-error').textContent=errorText(error);
  }
  finally{
    stateBusy=false;$('refresh').disabled=false;
    $('connection').className='connection '+(state.connected?'connected':'disconnected');$('connection-text').textContent=state.connected?'Herdr connecté':'Herdr déconnecté';
    $('office-count').textContent=state.connected?state.agents.length+' agent'+(state.agents.length>1?'s':'')+' détecté'+(state.agents.length>1?'s':''):'Connexion indisponible';
    const notice=$('scene-notice');notice.hidden=state.connected&&state.agents.length>0;
    notice.querySelector('strong').textContent=state.connected?'Le bureau attend ton équipe':'Herdr est déconnecté';
    notice.querySelector('span').textContent=state.connected?'Ouvre un agent dans Herdr : son personnage apparaîtra ici.':'Vérifie que Herdr est ouvert, puis clique sur Actualiser.';
    renderAgents();draw(0);
  }
}
async function readOutput() {
  if(readBusy||!selected||!state.connected)return;
  readBusy=true;const id=selected,sequence=readSequence;
  try{
    const data=await request('/api/read?id='+encodeURIComponent(id));
    if(id!==selected||sequence!==readSequence)return;
    const parts=splitChrome(data.text||'');
    statusCache.set(id,{status:parts.status,at:new Date()});renderStatusbar(activeAgent());
    termData={id,text:parts.body||'Le terminal de cet agent n’a pas encore de sortie.',valid:true};
    if(renderOutput())$('read-state').textContent=frozen?'Défilement figé':'Lecture actualisée';
    $('read-note').textContent=data.truncated?'Extrait des dernières lignes du terminal. Les lignes plus anciennes ne sont pas affichées.':'Les sorties viennent directement du terminal de l’agent.';
  }catch(error){if(id===selected&&sequence===readSequence){$('read-state').textContent='Lecture indisponible';termPlaceholder(errorText(error));}}
  finally{readBusy=false;if(id!==selected&&selected)readOutput();}
}
$('message').addEventListener('input',()=>{if(selected)keepDraft(selected,$('message').value);updateForm();});
$('prompt-form').addEventListener('submit',async event=>{
  event.preventDefault();const a=activeAgent(),message=$('message').value.trim();if(!canSend(a)||sending||!message)return;
  const target=a.id;sending=true;updateForm();$('send-result').hidden=true;
  try{
    const data=await request('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({id:target,message})});
    drafts.delete(target);logSend([a.name],message,'sent',data.message||'Consigne transmise à Herdr.');
    if(target===selected){$('message').value='';$('send-result').className='';$('send-result').textContent=data.message||'Consigne transmise à Herdr.';$('send-result').hidden=false;}
    await refreshState();
  }catch(error){logSend([a.name],message,outcomeOf(error),errorText(error));if(target===selected){$('send-result').className='error';$('send-result').textContent=errorText(error)+' Vérifie les sorties de l’agent avant de renvoyer : la consigne peut avoir été reçue.';$('send-result').hidden=false;}}
  finally{sending=false;updateForm();}
});
$('refresh').addEventListener('click',async()=>{await refreshState();readOutput();});
function syncMotion(){ $('motion').setAttribute('aria-pressed',String(paused));$('motion').querySelector('span').textContent=paused?'Animer le bureau':'Mettre en pause';$('motion').querySelector('path').setAttribute('d',paused?'m8 5 11 7-11 7V5':'M8 5v14M16 5v14');draw(0); }
$('motion').addEventListener('click',()=>{paused=!paused;try{localStorage.setItem('bureau.animation',paused?'off':'on');}catch{}syncMotion();});
// Scène dessinée en basse résolution puis agrandie : chaque pixel du décor reste net à toutes les tailles.
const WORK=['busy','working','running'], FREE=['idle','done'], WAIT=['waiting','blocked'];
const sceneLabels={working:'AU TRAVAIL',busy:'AU TRAVAIL',running:'AU TRAVAIL',idle:'DISPONIBLE',done:'TERMINÉ',waiting:'ATTEND RÉPONSE',blocked:'ATTEND RÉPONSE'};
const glyphs={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',0:'111101101101111',1:'010110010010111',2:'110001010100111',3:'110001010001110',4:'101101111001001',5:'111100110001110',6:'011100111101111',7:'111001010010010',8:'111101111101111',9:'111101111001110','-':'000000111000000','+':'000010111010000','_':'000000000000111','.':'000000000000010',':':'000010000010000','?':'110001010000010','!':'010010010000010','/':'001001010100100',"'":'010010000000000',' ':'000000000000000'};
const off=document.createElement('canvas'), g=off.getContext('2d');
let hovered=null, ariaText='', lastFrame=0, layoutKey='', boardBottom=0;
const lastStatus=new Map(), changes=new Map();
function trackChanges(){
  const now=performance.now();
  for(const a of state.agents){const prev=lastStatus.get(a.id);if(prev&&prev!==a.status)changes.set(a.id,{from:prev,to:a.status,at:now});lastStatus.set(a.id,a.status);}
}
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.codePointAt(0),16777619);return h>>>0;};
const rng=seed=>()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
function px(x,y,w,h,c,a=1){g.globalAlpha=a;g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));g.globalAlpha=1;}
const pixelCase=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9 .:_\-+?!/']/g,'?');
const textWidth=s=>Math.max(0,s.length*4-1);
function fit(s,max){s=pixelCase(s);if(textWidth(s)<=max)return s;while(s.length>1&&textWidth(s+'.')>max)s=s.slice(0,-1);return s.trimEnd()+'.';}
function text(s,x,y,c,a=1){[...s].forEach((ch,i)=>{const bits=glyphs[ch]||glyphs['?'];for(let b=0;b<15;b++)if(bits[b]==='1')px(x+i*4+b%3,y+Math.floor(b/3),1,1,c,a);});}
// Halo en pixels autour d'une enseigne : reste dans le langage pixel, pas de flou.
function neon(s,x,y,c){for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])text(s,x+dx,y+dy,c,.22);text(s,x,y,c);}
function pool(cx,cy,rx,ry,c,a){for(let dy=-ry;dy<=ry;dy++){const hw=Math.round(rx*Math.sqrt(1-(dy/ry)**2));if(hw>0)px(cx-hw,cy+dy,hw*2,1,c,a);}}
// Lumière par paliers successifs : effet de dégradé sans lissage.
function glow(cx,cy,r,c,s){pool(cx,cy,Math.round(r*1.9),Math.round(r*.7),c,.045*s);pool(cx,cy,Math.round(r*1.3),Math.round(r*.48),c,.06*s);pool(cx,cy,Math.round(r*.75),Math.round(r*.28),c,.08*s);}

// Le chef : le premier agent démarré. Herdr ne donne pas l'heure de démarrage ; on retient le plus petit
// numéro de panneau de l'espace (w5:p1 avant w5:p4), approximation documentée.
function bossOf(agents){
  const num=a=>{const m=/:p(\d+)$/.exec(a.paneId||'');return m?Number(m[1]):Infinity;};
  return agents.length>1?agents.reduce((b,a)=>num(a)<num(b)?a:b):null;
}
const fitMode=matchMedia('(min-width:1100px) and (min-height:620px)');
function layout(){
  const wrap=canvas.parentElement,cssW=wrap.clientWidth||960,cssH=wrap.clientHeight||600,narrow=cssW<560,boss=state.connected?bossOf(state.agents):null;
  const n=Math.max(1,(state.agents.length||2)-(boss?1:0)),wallH=narrow?70:84,rowH=80,bossTop=wallH+10;
  // Deux dispositions : le bureau du chef au-dessus des agents, ou à leur droite (écran large).
  const shape=(W,side)=>{
    const bossH=boss&&!side?88:0,top=wallH+12+bossH,areaW=side?W-160:W;
    const cols=Math.min(narrow?2:Math.max(1,Math.floor((areaW-8)/62)),n),rows=Math.ceil(n/cols),roomY=top+Math.max(rows*rowH,side?92:0)+4;
    return {W,cols,rows,roomY,H:roomY+60,top,bossH,areaW,side};
  };
  // En vue globale, la largeur logique suit la forme de la fenêtre : la scène la remplit au lieu de flotter entre deux bandes vides.
  let best=shape(narrow?144:256,false);
  if(fitMode.matches&&!narrow){const target=cssW/cssH;for(const W of [256,288,320,352,384,416,448,480])for(const side of boss&&W>=352?[false,true]:[false]){const s=shape(W,side);if(Math.abs(s.W/s.H-target)<Math.abs(best.W/best.H-target))best=s;}}
  const {W,cols,rows,roomY,H,top,bossH,areaW,side}=best,S=Math.max(2,Math.round(Math.min(cssW,fitMode.matches?cssH*W/H:cssW)*(window.devicePixelRatio||1)/W));
  return {W,H,S,cols,rows,wallH,rowH,top,bossTop,bossH,boss,roomY,narrow,areaW,sideBoss:side,cw:Math.min(78,Math.floor((areaW-8)/cols))};
}
// Bureau VIP du chef : moquette, cloison vitrée avec porte au centre, enseigne et pile de courrier reçu.
// Disposition libre : DrSmoke peut glisser les postes et déplacer ou redimensionner le bureau du chef.
// Positions mémorisées dans ce navigateur, en proportion du sol pour suivre toutes les tailles de fenêtre.
const readLayout=()=>{try{return JSON.parse(localStorage.getItem('bureau.disposition')||'null')||{stations:{},vip:null};}catch{return {stations:{},vip:null};}};
let custom=readLayout(),editLayout=false,dragging=null;
const saveLayout=()=>{try{localStorage.setItem('bureau.disposition',JSON.stringify(custom));}catch{}};
const layoutKeyOf=a=>a.kind+'|'+a.name;
const floorBox=L=>({top:L.wallH+6,h:L.roomY-(L.wallH+6)});
function vipOffice(L,time){
  const side=L.sideBoss;let w=L.narrow?120:side?148:150,cx=side?L.W-8-w/2:Math.round(L.W/2),y=side?L.top-6:L.bossTop,vh=side?L.roomY-L.top+2:L.bossH;
  if(custom.vip){const f=floorBox(L);w=Math.max(70,Math.min(L.W-4,custom.vip.fw*L.W));vh=Math.max(70,Math.min(f.h,custom.vip.fh*f.h));cx=Math.max(w/2+2,Math.min(L.W-w/2-2,custom.vip.fx*L.W));y=Math.max(f.top,Math.min(L.roomY-vh,f.top+custom.vip.fy*f.h));}
  cx=Math.round(cx);y=Math.round(y);w=Math.round(w);vh=Math.round(vh);
  const x=cx-w/2;vipRect={x,y,w,h:vh};
  px(x,y,w,vh-6,'#241f38');px(x,y,w,1,'#c9a46a',.6);px(x,y,1,vh-6,'#c9a46a',.6);px(x+w-1,y,1,vh-6,'#c9a46a',.6);
  for(let gx=x+4;gx<x+w-4;gx+=8)for(let gy=y+6;gy<y+vh-10;gy+=8)px(gx,gy,1,1,'#30294a');
  const by=y+vh-6;px(x,by,w/2-10,3,'#2c4468');px(cx+10,by,w/2-10,3,'#2c4468');px(x,by,w/2-10,1,'#4a6a94');px(cx+10,by,w/2-10,1,'#4a6a94');
  text('DIRECTION',x+5,y+4,'#c9a46a');
  mailSpot=null;
  if(mailCount){const mx=x+w-22;for(let k=0;k<Math.min(mailCount,5);k++){px(mx,y+8-k*2+20,9,6,'#dfe6ee');px(mx+1,y+9-k*2+20,7,1,'#9aabc1');}text(String(mailCount),mx+11,y+26,'#dfe6ee');mailSpot={x:mx-3,y:y+14,w:22,h:20};}
  if(editLayout){px(x+w-7,by-7,6,6,'#c9a46a');px(x+w-5,by-5,2,2,'#241f38');}
  return {cx,y0:y-6,doorY:by+1};
}
// Le ciel suit l'heure réelle de l'ordinateur : nuit, aube, jour, crépuscule.
const skies={night:['#0e1d3a','#112347','#142a54','#183260','#1c396b'],dawn:['#262c5c','#46407a','#87598a','#cc7f7c','#eeb07c'],day:['#3a6aac','#477bbb','#588dc8','#6fa1d3','#8fbadf'],dusk:['#1b2250','#392d66','#77406f','#bf5e5f','#e5925d']};
function skyPhase(){const t=new Date(),h=t.getHours()+t.getMinutes()/60;return {h,phase:h>=21||h<5?'night':h<8?'dawn':h<17?'day':'dusk'};}
function cityWindow(x,y,w,h){
  const {h:hour,phase}=skyPhase(),night=phase==='night',day=phase==='day';
  px(x-2,y-2,w+4,h+4,'#0b1426');
  skies[phase].forEach((c,i)=>px(x,y+Math.floor(i*h/5),w,Math.ceil(h/5)+1,c));
  const r=rng(7);
  if(!day)for(let i=0;i<w/5;i++){const sx=x+Math.floor(r()*w),sy=y+Math.floor(r()*h*(night?.42:.2)),c=r()>.7?'#c9d6f0':'#6f86b3';px(sx,sy,1,1,c,night?1:.45);}
  if(night){px(x+w-21,y+5,6,8,'#e9e3c6');px(x+w-22,y+6,8,6,'#e9e3c6');px(x+w-20,y+7,2,2,'#cfc8a8');px(x+w-17,y+10,1,1,'#cfc8a8');}
  else{
    const f=Math.min(1,Math.max(0,(hour-5)/16)),sx=x+4+Math.round(f*(w-14)),sy=y+4+Math.round(Math.abs(f-.5)*2*h*.45);
    pool(sx+3,sy+3,7,6,'#ffe9a8',.18);px(sx+1,sy,4,6,'#ffe7a3');px(sx,sy+1,6,4,'#ffe7a3');
  }
  const b=rng(11),lit=night?.78:day?.96:.86;let bx=x;
  while(bx<x+w){
    const bw=6+Math.floor(b()*10),bh=10+Math.floor(b()*h*.55),top=y+h-bh,right=Math.min(bx+bw,x+w);
    px(bx,top,right-bx,bh,day?(b()>.5?'#26406a':'#2d4a75'):b()>.5?'#0a162d':'#0d1b36');
    for(let wy=top+2;wy<y+h-2;wy+=3)for(let wx=bx+1;wx<right-1;wx+=2)if(b()>lit)px(wx,wy,1,1,b()>.25?'#f4c780':'#9dbbff',.5+b()*.5);
    bx=right+(b()>.7?1:0);
  }
  const panes=Math.max(2,Math.round(w/35));
  for(let m=1;m<panes;m++)px(x+Math.round(m*w/panes),y,1,h,'#0b1426');
  px(x,y+Math.round(h*.36),w,1,'#0b1426');
  px(x+5,y+3,1,9,'#ffffff',.07);px(x+7,y+3,1,5,'#ffffff',.07);
  px(x-4,y+h+2,w+8,2,'#2a4166');px(x-4,y+h+4,w+8,1,'#0f1a2c');
}
function clock(x,y){
  const t=new Date(),s=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
  px(x,y,25,11,'#0b1426');px(x+1,y+1,23,9,'#101c33');text(s,x+3,y+3,'#a0dfc4');
}
// Tableau d'équipe : uniquement les comptes réels fournis par Herdr.
function board(x,y,w){
  const count=list=>state.agents.filter(a=>list.includes(a.status)).length;
  const rows=[['TRAVAIL',count(WORK),'#9dbbff'],['DISPONIBLE',count(FREE),'#a0dfc4'],['ATTENTE',count(WAIT),'#f4c780']];
  const pausedN=state.agents.filter(a=>quotaPause(a)).length;
  const unknown=state.agents.length-rows.reduce((s,r)=>s+r[1],0);
  if(unknown>0)rows.push(['INCONNU',unknown,'#a7b8ce']);
  if(pausedN>0)rows.push(['EN PAUSE',pausedN,'#b5a8e6']);
  const h=rows.length*8+5;boardBottom=y+h;
  px(x,y,w,h,'#0b1426');px(x+1,y+1,w-2,h-2,'#111e33');
  rows.forEach(([name,n,c],i)=>{
    const ry=y+4+i*8,value=state.connected?String(n):'-',lit=state.connected&&n>0;
    px(x+4,ry+1,3,3,lit?c:'#3a4c65');text(name,x+10,ry,lit?'#c4d2e4':'#71839a');text(value,x+w-4-textWidth(value),ry,lit?'#f2f4f7':'#71839a');
  });
}
// La baie « HERDR » clignote seulement quand le bureau est réellement relié à Herdr.
function rack(x,y,bottom,time){
  px(x,y,22,bottom-y,'#0b1426');px(x+1,y+1,20,bottom-y-2,'#17243c');
  text('HERDR',x+2,y+3,state.connected?'#a0dfc4':'#566477');
  for(let i=0;i<6;i++){
    const uy=y+11+i*8;px(x+2,uy,18,6,'#0f1a2e');px(x+10,uy+2,8,1,'#22324d');px(x+10,uy+4,6,1,'#22324d');
    const on=state.connected&&(paused||(Math.floor(time/320)+i*3)%5!==0);
    px(x+4,uy+2,2,2,on?(i%3?'#a0dfc4':'#9dbbff'):'#26354d');
  }
}
function plant(x,bottom){
  px(x+2,bottom-7,8,7,'#6e5242');px(x+1,bottom-8,10,2,'#8a6852');
  px(x+5,bottom-20,2,13,'#2f6b5e');px(x,bottom-18,5,4,'#4f9a82');px(x+7,bottom-22,5,4,'#3f8673');px(x+2,bottom-25,5,4,'#6bb79a');px(x+6,bottom-15,5,3,'#4f9a82');
}
function room(L,time){
  const {W,H,wallH,narrow}=L;
  px(0,0,W,wallH,'#16243d');px(0,0,W,3,'#0d1729');
  for(let x=20;x<W;x+=40)px(x,3,1,wallH-9,'#1a2a46');
  px(0,wallH-6,W,4,'#1d2f4d');px(0,wallH-2,W,2,'#2a4166');
  px(0,wallH,W,H-wallH,'#18263c');
  for(let y=wallH+3,i=0;y<H;y+=6,i++){px(0,y,W,1,'#15223a');for(let x=i%2?7:27;x<W;x+=40)px(x,y-5,1,5,'#15223a');}
  px(0,wallH,W,1,'#0f1a2c');
  const light=skyPhase().phase==='night'?['#9dbbff',.7]:['#ffe7a3',.55];
  if(narrow){cityWindow(6,10,58,44);board(70,10,68);clock(70,44);glow(35,wallH+8,16,light[0],light[1]);}
  else{
    cityWindow(8,10,112,50);glow(64,wallH+9,26,light[0],light[1]);
    board(128,12,64);clock(198,12);neon('BUREAU DE DRSMOKE',128,Math.max(50,boardBottom+5),'#a0dfc4');
    plant(W-52,wallH+4);rack(W-26,16,wallH+6,time);plant(1,wallH+6);
  }
  for(let i=0;i<3;i++){px(0,0,2+i*2,H,'#050a14',.12);px(W-2-i*2,0,2+i*2,H,'#050a14',.12);px(0,0,W,1+i,'#050a14',.12);}
}
function monitor(x,y,a,c,live,work,time,anim,h){
  px(x,y,17,13,'#0b1424');px(x+1,y+1,15,10,live?'#0d1f35':'#111a29');
  if(live){
    const shift=work&&anim?Math.floor(time/260):0;
    for(let k=0;k<4;k++){const w=3+(((h>>(k*3))&7)+(k+shift)*5)%10;px(x+2,y+2+k*2,Math.min(w,13),1,c,work?.95:.55);}
    if(work&&anim&&Math.floor(time/400)%2)px(x+2+Math.min(13,3+((h+shift)%9)),y+8,2,1,c);
  }
  px(x+7,y+13,3,2,'#0b1424');px(x+5,y+14,7,1,'#26364f');
}
function bubble(x,y,kind,anim,time){
  const fill={wait:'#f4c780',done:'#a0dfc4',unknown:'#a7b8ce'}[kind],dy=kind==='wait'&&anim?Math.floor(time/450)%2:0;
  y-=dy;
  px(x,y,11,9,'#0b1426');px(x+1,y+1,9,7,fill);px(x,y+9,3,2,'#0b1426');px(x+1,y+8,2,2,fill);
  if(kind==='wait')text('?',x+4,y+2,'#0c1423');
  else if(kind==='done')[[3,5],[4,6],[5,5],[6,4],[7,3]].forEach(([dx,ddy])=>px(x+dx,y+ddy,1,1,'#0c1423'));
  else[3,5,7].forEach(dx=>px(x+dx,y+5,1,1,'#0c1423'));
}
// Personnage : apparence stable par agent, posture dictée uniquement par l'état Herdr.
function person(x,y0,shirt,h,pose,c,live){
  const skin=['#f0cdb4','#debba6','#c69878','#9c6b4e'][h%4],hair=['#1d2738','#3a2a24','#5a4334','#2f3e57','#7a5236'][(h>>3)%5],style=(h>>6)%5,hx=x+2,hy=y0+12;
  px(x,y0+21,12,10,shirt);px(x,y0+21,12,1,'#ffffff',.2);px(x+4,y0+21,4,2,skin);
  px(hx,hy,8,9,skin);
  if(style===4){px(hx-1,hy-2,10,3,'#33486b');px(hx-4,hy+1,5,1,'#33486b');px(hx-1,hy+1,1,3,hair);px(hx+8,hy+1,1,3,hair);}
  else if(style===3){px(hx-1,hy-1,10,3,hair);px(hx-1,hy+2,2,9,hair);px(hx+7,hy+2,2,9,hair);}
  else{
    px(hx-1,hy-1,10,3,hair);px(hx-1,hy+2,1,3,hair);px(hx+8,hy+2,1,3,hair);
    if(style===1)[0,3,6].forEach(dx=>px(hx+dx,hy-2,2,1,hair));
    if(style===2)px(hx+2,hy-4,4,3,hair);
  }
  const look=pose==='work'?-1:0;
  px(hx+2+look,hy+4,1,2,'#141c2b');px(hx+5+look,hy+4,1,2,'#141c2b');
  // Humeur lue uniquement dans l'état Herdr : sourire une fois fini, inquiétude en attente, concentration au travail.
  if(pose==='sleep'){px(hx+1,hy+4,2,1,'#141c2b');px(hx+5,hy+4,2,1,'#141c2b');px(hx+3,hy+7,2,1,'#a36e65');}
  else if(pose==='wait'){px(hx+1,hy+2,2,1,'#141c2b');px(hx+5,hy+3,2,1,'#141c2b');px(hx+3,hy+7,2,1,'#141c2b');}
  else if(pose==='happy'){px(hx+2,hy+6,1,1,'#a36e65');px(hx+3,hy+7,2,1,'#a36e65');px(hx+5,hy+6,1,1,'#a36e65');}
  else px(hx+3,hy+7,2,1,'#a36e65');
  if(live)px(hx,hy+1,2,8,c,.28);
  if(pose==='work'){px(x-2,y0+22,2,7,shirt);px(x+12,y0+22,2,7,shirt);}
  else if(pose==='wait'){px(x-2,y0+22,2,8,shirt);px(x+12,y0+13,2,9,shirt);px(x+12,y0+10,2,3,skin);}
  else{px(x-2,y0+22,2,8,shirt);px(x+12,y0+22,2,5,shirt);}
  return skin;
}
function station(a,i,cx,y0,time,L){
  const chosen=a&&a.id===selected,live=Boolean(state.connected&&a),st=a?.status;
  const work=live&&WORK.includes(st),wait=live&&WAIT.includes(st),free=live&&FREE.includes(st),anim=!paused&&live;
  const c=a?tint(a):'#566477',h=a?hash(a.kind+'|'+a.name):0,shirt=colors[i%colors.length];
  if(chosen)glow(cx,y0+58,17,'#a0dfc4',1.7);else if(a&&a.id===hovered)glow(cx,y0+58,15,'#c4d2e4',.9);
  if(live)glow(cx-13,y0+46,14,c,work?1.4:wait?1.2:.8);
  px(cx-25,y0+55,50,3,'#0a1322',.55);
  px(cx-3,y0+15,16,16,'#22324f');px(cx-2,y0+16,14,14,'#2a3c5e');
  const pause=live&&quotaPause(a);
  const pose=pause?'sleep':work?'work':wait?'wait':st==='done'&&live?'happy':'rest',x=cx-1,away=a&&(awayAgents.has(a.id)||Boolean(pause));
  const skin=a&&!away?person(x,y0,shirt,h,pose,c,live):null;
  px(cx-24,y0+30,48,3,'#7a604f');px(cx-24,y0+30,48,1,'#957660');px(cx-24,y0+33,48,18,'#4a3a3c');px(cx-23,y0+34,46,1,'#55434a');
  px(cx-22,y0+51,3,4,'#3a2e33');px(cx+19,y0+51,3,4,'#3a2e33');
  // Emblème de l'outil sur la façade : identité réelle tirée du champ « agent » de Herdr.
  if(a){
    px(cx-10,y0+34,20,17,'#382b30');const logo=logoFor(a);
    if(logo)logo.rows.forEach((row,ry)=>[...row].forEach((ch,rx)=>{if(logo.palette[ch])px(cx-8+rx,y0+34+ry,1,1,logo.palette[ch],live?1:.4);}));
    else{const ini=pixelCase(a.name).slice(0,1)||'?';text(ini,cx-1,y0+40,'#c4d2e4');}
  }
  px(cx-1,y0+29,12,2,'#7f90a8');px(cx,y0+29,10,1,'#a5b4c8');
  if(a&&!away){
    if(pose==='work'){const p=anim?Math.floor(time/140)%2:0;px(x+1,y0+28-p,2,2,skin);px(x+8,y0+28-(1-p),2,2,skin);}
    else if(free&&!a.activity?.subagents?.length){px(x+13,y0+26,3,4,'#dfe6ee');px(x+16,y0+27,1,2,'#dfe6ee');px(x+13,y0+26,3,1,'#5a3d2e');px(x+12,y0+27,2,2,skin);}
  }
  monitor(cx-22,y0+15,a,c,live,work,time,anim,h);
  if(a&&live){if(wait)bubble(cx+12,y0,'wait',anim,time);else if(st==='done')bubble(cx+12,y0,'done',anim,time);else if(!work&&!free)bubble(cx+12,y0,'unknown',anim,time);}
  if(!a)return;
  // Petite fête de fin : seulement pendant quelques secondes après un passage réel de « travail » à « disponible » ou « terminé ».
  const change=changes.get(a.id),age=change?performance.now()-change.at:Infinity;
  if(live&&age<4000&&WORK.includes(change.from)&&FREE.includes(change.to)){
    const blink=anim?Math.floor(time/180)%2:0;
    [[x-4,y0+6],[x+15,y0+3],[x-1,y0+1],[x+17,y0+12]].forEach(([sx,sy],k)=>{const on=(k+blink)%2===0;px(sx,sy+1,3,1,'#a0dfc4',on?1:.5);px(sx+1,sy,1,3,on?'#ffffff':'#a0dfc4');});
  }
  deskSpots.set(a.id,{cx,y0});
  const max=L.cw-4,name=fit(a.name,max),status=fit(state.connected?sceneLabels[st]||'INCONNU':'HORS LIGNE',max);
  text(name,cx-textWidth(name)/2,y0+60,chosen?'#a0dfc4':'#e2eaf4');
  if(pause){
    // Pause de quota : écran éteint, « z » qui montent, heure de retour annoncée par l'outil.
    // L'agent a quitté son poste : écran éteint, voyant de veille, chevalet avec son heure de retour.
    px(cx-21,y0+16,15,10,'#070d18');
    const glowOn=paused||Math.floor(time/900)%2===0;px(cx-8,y0+27,1,1,'#b5a8e6',glowOn?1:.35);
    px(cx+1,y0+15,27,15,'#0b1426');px(cx+2,y0+16,25,13,'#dfe6ee');px(cx+5,y0+29,2,2,'#7a604f');px(cx+22,y0+29,2,2,'#7a604f');
    text('RETOUR',cx+3,y0+17,'#0c1423');text(pause.until?hhmm(pause.until):'??:??',cx+5,y0+23,'#5b4a9e');
    const p=fit('EN PAUSE'+(pause.until?' '+hhmm(pause.until):''),max);text(p,cx-textWidth(p)/2,y0+67,'#b5a8e6');
  }else text(status,cx-textWidth(status)/2,y0+67,state.connected?c:'#71839a');
  if(chosen)px(cx-9,y0+74,18,1,'#a0dfc4');
  spots.push({x:(cx-L.cw/2)*L.S,y:y0*L.S,w:L.cw*L.S,h:L.rowH*L.S,id:a.id});
}
// Sous-agents mis en scène. Seuls deux faits réels pilotent tout : l'apparition d'un sous-agent actif
// dans le journal de son agent, puis sa disparition. Le chef remet un dossier, l'assistant part en salle de réflexion,
// y reste tant qu'il est actif, puis revient remettre le dossier complété et quitte la scène.
const actors=new Map(),deskSpots=new Map();let actorsBooted=false;
const SPEED_MIN=26;
function meetingGeometry(L){
  const ty=L.roomY+38,tx=Math.round(L.W*(L.narrow?.56:.52)),doorX=8,boardX=L.W-(L.narrow?42:56);
  const seats=[[tx-16,ty-2,'back'],[tx,ty-3,'back'],[tx+16,ty-2,'back'],[tx-34,ty+6,'side'],[tx+34,ty+6,'side'],[tx-8,ty+16,'front']];
  return {tx,ty,doorX,boardX,laneY:L.roomY-3,seats};
}
function meetingRoom(L,time){
  const {roomY,W,H}=L,G=meetingGeometry(L);
  px(0,roomY,W,H-roomY,'#1a2740');
  for(let x=4;x<W;x+=12)for(let y=roomY+6;y<H;y+=8)px(x+((y>>3)%2)*6,y,1,1,'#22324d');
  // Cloison vitrée avec une porte à gauche.
  px(G.doorX+12,roomY,W-G.doorX-12,3,'#2c4468');px(G.doorX+12,roomY,W-G.doorX-12,1,'#4a6a94');
  px(0,roomY,G.doorX,3,'#2c4468');px(G.doorX-1,roomY-1,2,5,'#4a6a94');px(G.doorX+11,roomY-1,2,5,'#4a6a94');
  text(L.narrow?'REFLEXION':'SALLE DE REFLEXION',G.doorX+18,roomY+6,'#71839a');
  // Tableau blanc : ses traits ne grandissent que si un assistant y travaille vraiment.
  const bx=G.boardX,by=roomY+6;
  px(bx-1,by-1,34,19,'#0b1426');px(bx,by,32,17,'#dfe6ee');
  const atBoard=[...actors.values()].some(a=>a.atBoard);
  [[3,3,14,'#9b86e0'],[3,7,20,'#d98a74'],[3,11,10,'#7f90a8']].forEach(([dx,dy,w,c],k)=>px(bx+dx,by+dy,atBoard&&!paused?Math.max(3,(Math.floor(time/220)+k*5)%w+3):w,1,c));
  px(bx+24,by+4,5,5,'#a3b05f',.7);
  return G;
}
function tableTop(G){
  px(G.tx-24,G.ty-1,48,7,'#5f4a3f');px(G.tx-22,G.ty-3,44,4,'#7a604f');px(G.tx-20,G.ty-4,40,2,'#957660');
  px(G.tx-2,G.ty+6,4,6,'#3a2e33');
}
// Trajet en ligne brisée : position au temps t, avec arrêts éventuels (attente au tableau).
function walk(points,elapsed,speed){
  let t=elapsed/1000;
  for(let i=0;i<points.length-1;i++){
    const [x1,y1]=points[i],[x2,y2,wait=0]=points[i+1],d=Math.abs(x2-x1)+Math.abs(y2-y1),dur=d/speed;
    if(t<dur){const f=dur?t/dur:1;return {x:x1+(x2-x1)*f,y:y1+(y2-y1)*f,moving:true,done:false};}
    t-=dur;if(t<wait/1000)return {x:x2,y:y2,moving:false,done:false,pause:true};t-=wait/1000;
  }
  const [x,y]=points[points.length-1];return {x,y,moving:false,done:true};
}
function standPoint(parent){const d=deskSpots.get(parent);return d?[d.cx+29,d.y0+55]:null;}
function syncActors(L,now){
  const live=new Map();
  if(state.connected)for(const a of state.agents)for(const s of a.activity?.subagents||[])live.set(a.id+'|'+s.id,{parent:a.id,s});
  const used=new Set([...actors.values()].filter(x=>x.seat!=null&&['aller','reunion'].includes(x.phase)).map(x=>x.seat));
  for(const [k,v] of live)if(!actors.has(k)){
    let seat=0;while(used.has(seat)&&seat<5)seat++;used.add(seat);
    const h=hash(k);
    actors.set(k,{key:k,parent:v.parent,h,seat,phase:actorsBooted&&!paused?'aller':'reunion',t0:now,speed:SPEED_MIN+(h%12),board:h%3===0});
  }
  if(state.connected)actorsBooted=true;
  for(const [k,act] of actors){
    if(!state.agents.some(a=>a.id===act.parent)||(paused&&['retour','remise','sortie'].includes(act.phase))){actors.delete(k);continue;}
    if(!live.has(k)&&['aller','reunion'].includes(act.phase)){
      if(paused){actors.delete(k);continue;}
      act.from=act.pos||null;act.phase='retour';act.t0=now;
    }
  }
}
// Assistants : version réduite d'un personnage, aux couleurs de l'agent qui les emploie.
const skins=['#f0cdb4','#debba6','#c69878','#9c6b4e'],hairs=['#1d2738','#3a2a24','#5a4334','#2f3e57','#7a5236'];
function helperHead(x,top,h){
  const skin=skins[h%4],hair=hairs[(h>>2)%5],style=(h>>5)%3;
  px(x-3,top,7,7,skin);px(x-3,top-1,7,2,hair);px(x-4,top,1,4,hair);px(x+4,top,1,4,hair);
  if(style===1)px(x-1,top-3,3,2,hair);if(style===2)px(x-4,top+1,1,6,hair),px(x+4,top+1,1,6,hair);
  px(x-2,top+3,1,2,'#141c2b');px(x+1,top+3,1,2,'#141c2b');px(x-1,top+5,2,1,'#a36e65');
  px(x-3,top+1,1,5,'#ffffff',.12);
}
function seatedHelper(x,y,h,bubbleOn,time,body='#c4d2e4'){
  px(x-5,y-16,11,12,'#22324f');px(x-4,y-15,9,10,'#2a3c5e');
  helperHead(x,y-20,h);
  px(x-4,y-13,9,8,body);px(x-4,y-13,9,1,'#ffffff',.22);px(x-1,y-13,3,2,skins[h%4]);
  // Ordinateur portable allumé : le travail du sous-agent est réel tant qu'il est actif.
  px(x-4,y-6,9,5,'#0b1424');px(x-3,y-5,7,3,'#9dbbff',.55);px(x-5,y-1,11,1,'#7f90a8');
  if(bubbleOn){
    const idea=Math.floor(time/1300)%2===0,by=y-31;
    px(x-1,by,9,8,'#0b1426');px(x,by+1,7,6,'#f2f4f7');px(x-1,by+8,3,2,'#0b1426');px(x,by+7,2,2,'#f2f4f7');
    if(idea){px(x+2,by+2,3,3,'#f4d36b');px(x+3,by+5,1,1,'#8a6a2a');}else[1,3,5].forEach(d=>px(x+d,by+4,1,1,'#0c1423'));
  }
}
function walkingHelper(x,y,h,moving,time,folder,body='#c4d2e4'){
  const step=moving&&!paused?Math.floor(time/140)%4:0,swing=[0,1,0,-1][step];
  px(x-4,y-1,9,2,'#0a1322',.5);
  px(x-3+Math.max(0,swing),y-6,2,6-Math.abs(swing),'#1b2941');px(x+1-Math.max(0,-swing),y-6,2,6-Math.abs(swing),'#1b2941');
  px(x-3,y-1,2,1,'#0e1626');px(x+1,y-1,2,1,'#0e1626');
  px(x-4,y-14,9,8,body);px(x-4,y-14,9,1,'#ffffff',.22);px(x-1,y-14,3,2,skins[h%4]);
  px(x-6,y-13+swing,2,6,body);px(x-6,y-8+swing,2,2,skins[h%4]);
  helperHead(x,y-21,h);
  if(folder==='aller'){px(x+4,y-12-swing,6,7,'#c9a46a');px(x+4,y-12-swing,6,1,'#e0c08a');px(x+5,y-10-swing,4,1,'#8a6a40');}
  else if(folder==='retour'){px(x+4,y-13-swing,6,8,'#c9a46a');px(x+5,y-15-swing,4,4,'#f2f4f7');px(x+6,y-14-swing,2,1,'#7f90a8');}
  else{px(x+5,y-13+swing,2,6,body);px(x+5,y-8+swing,2,2,skins[h%4]);}
}
function drawActors(L,G,time,now,layer){
  for(const act of actors.values()){
    const stand=standPoint(act.parent);if(!stand)continue;
    act.body=colors[Math.max(0,state.agents.findIndex(a=>a.id===act.parent))%colors.length];
    // Chaque assistant a sa propre voie dans le couloir pour ne pas se superposer.
    const lane=G.laneY+((act.h%3)-1)*3;
    const [sx,sy]=stand,seat=G.seats[act.seat%G.seats.length],door=[G.doorX+6,lane],inside=[G.doorX+6,L.roomY+16];
    const toSeat=[[sx,sy],[sx,lane],door,inside,...(act.board?[[G.boardX+16,L.roomY+30,2600]]:[]),[seat[0],L.roomY+16],[seat[0],seat[1]]];
    if(act.phase==='aller'){
      const p=walk(toSeat,now-act.t0,act.speed);act.pos=[p.x,p.y];act.atBoard=Boolean(p.pause);
      if(p.done){act.phase='reunion';act.atBoard=false;}else{if(layer==='front')walkingHelper(Math.round(p.x),Math.round(p.y),act.h,p.moving,time,'aller',act.body);continue;}
    }
    if(act.phase==='reunion'){
      act.pos=[seat[0],seat[1]];
      if((layer==='back'&&seat[2]==='back')||(layer==='side'&&seat[2]!=='back')){
        const seated=[...actors.values()].filter(x=>x.phase==='reunion'),turn=seated.length?seated[Math.floor(time/1300)%seated.length]:null;
        seatedHelper(seat[0],seat[1],act.h,!paused&&turn===act,time,act.body);
      }
      continue;
    }
    if(act.phase==='retour'){
      const from=act.from||[seat[0],seat[1]],back=[from,[from[0],L.roomY+16],inside,door,[sx,lane],[sx,sy]];
      const p=walk(back,now-act.t0,act.speed);
      if(p.done){act.phase='remise';act.t0=now;}else{if(layer==='front')walkingHelper(Math.round(p.x),Math.round(p.y),act.h,p.moving,time,'retour',act.body);continue;}
    }
    if(act.phase==='remise'){
      // Remise du dossier complété au chef : le dossier se pose sur son bureau pendant un court instant.
      if(layer==='front'){walkingHelper(sx,sy,act.h,false,time,'retour',act.body);const d=deskSpots.get(act.parent);if(d){px(d.cx+14,d.y0+27,5,3,'#c9a46a');px(d.cx+15,d.y0+26,3,1,'#f2f4f7');}}
      if(now-act.t0>1800){act.phase='sortie';act.t0=now;}
      continue;
    }
    if(act.phase==='sortie'){
      const p=walk([[sx,sy],[sx,lane],[-6,lane]],now-act.t0,act.speed+10);
      if(p.done){actors.delete(act.key);continue;}
      if(layer==='front')walkingHelper(Math.round(p.x),Math.round(p.y),act.h,true,time,null,act.body);
    }
  }
}
// Vie de bureau entre le chef et ses agents, pilotée par deux faits :
// une délégation observée dans le journal du chef (`herdr agent prompt`), et la fin réelle d'un travail (état Herdr).
const awayAgents=new Set(),officeActors=new Map(),seenDelegations=new Set(),mailLog=[];let officeBooted=false,mailCount=0,mailSpot=null;
// Courrier du chef : chaque fin de travail observée, avec la tâche déléguée quand le journal du chef la montre.
function renderMail(){
  const list=$('mail-list');
  if(!mailLog.length){const li=document.createElement('li');li.className='list-placeholder';li.textContent='Aucun courrier depuis l’ouverture du bureau.';list.replaceChildren(li);return;}
  list.replaceChildren(...mailLog.slice(0,30).map(m=>{
    const li=document.createElement('li');li.className='mail';
    const head=document.createElement('span');head.className='log-head';head.textContent=m.at.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+' · '+m.name+' a terminé ('+(labels[m.from]||m.from).toLowerCase()+' → '+(labels[m.to]||m.to).toLowerCase()+')';
    const body=document.createElement('span');body.className='log-body';body.textContent=m.title?'Tâche déléguée : '+m.title:'Aucune délégation du chef trouvée pour ce travail.';
    const why=document.createElement('span');why.className='log-why';why.textContent='Objectif non vérifié par le bureau : lis le résultat dans ses sorties.';
    const open=document.createElement('button');open.type='button';open.className='tool-button';open.textContent='Ouvrir son poste';
    open.addEventListener('click',()=>{if(state.agents.some(a=>a.id===m.agentId))selectAgent(m.agentId);showTab('poste');});
    li.append(head,body,why,open);return li;
  }));
}
function agentByTarget(target){
  return state.agents.find(a=>a.paneId===target||a.name?.toLowerCase()===String(target).toLowerCase());
}
function syncOffice(L,now){
  if(!state.connected||!L.boss)return;
  for(const d of L.boss.delegations||[]){
    if(seenDelegations.has(d.id))continue;seenDelegations.add(d.id);
    const t=agentByTarget(d.target);
    if(!officeBooted||paused||!t||t===L.boss)continue;
    officeActors.set('deleg|'+d.id,{type:'deleg',agent:t.id,t0:now,h:hash(t.id),title:d.title});
  }
  for(const a of state.agents){
    if(a===L.boss)continue;
    const c=changes.get(a.id);
    if(!c||!WORK.includes(c.from)||!FREE.includes(c.to))continue;
    const key='mail|'+a.id+'|'+Math.round(c.at);
    if(officeActors.has(key)||seenDelegations.has(key))continue;seenDelegations.add(key);
    if(!officeBooted)continue;
    const deleg=(L.boss.delegations||[]).filter(d=>agentByTarget(d.target)===a).at(-1);
    mailLog.unshift({agentId:a.id,name:a.name,at:new Date(),from:c.from,to:c.to,title:deleg?.title||null});renderMail();
    if(!paused)officeActors.set(key,{type:'mail',agent:a.id,t0:now});else mailCount++;
  }
  officeBooted=true;
}
function drawOffice(L,vip,time,now){
  awayAgents.clear();
  const boss=vip&&deskSpots.get(L.boss.id);
  for(const [key,act] of officeActors){
    const d=deskSpots.get(act.agent);
    if(!d||!boss){officeActors.delete(key);continue;}
    if(act.type==='mail'){
      // L'enveloppe vole du poste de l'agent jusqu'au chef, puis rejoint sa pile ; le chef lève le pouce.
      const f=Math.min(1,(now-act.t0)/1600),x0=d.cx,y0=d.y0+18,x1=boss.cx-18,y1=boss.y0+26;
      if(f<1){const x=x0+(x1-x0)*f,y=y0+(y1-y0)*f-Math.sin(f*Math.PI)*24;px(x-4,y-3,9,6,'#dfe6ee');px(x-3,y-2,7,1,'#9aabc1');px(x-1,y-1,3,1,'#9aabc1');}
      else if(f>=1&&!act.landed){act.landed=now;mailCount++;}
      if(act.landed){
        const age=now-act.landed;
        if(age<2200){const bx=boss.cx+12,by=boss.y0-1;px(bx,by,11,9,'#0b1426');px(bx+1,by+1,9,7,'#dfe6ee');px(bx+3,by+4,2,3,'#0c1423');px(bx+5,by+3,3,4,'#0c1423');px(bx+5,by+2,1,1,'#0c1423');px(bx,by+9,3,2,'#0b1426');}
        else officeActors.delete(key);
      }
      continue;
    }
    // Délégation : l'agent quitte son poste, va chercher son dossier chez le chef, puis revient travailler.
    const stand=[d.cx+29,d.y0+55],door=[boss.cx,vip.doorY+4],bossSpot=[boss.cx-30,boss.y0+55];
    const there=[stand,[stand[0],door[1]],door,[door[0],bossSpot[1]],[bossSpot[0],bossSpot[1],1600]];
    const back=[bossSpot,[door[0],bossSpot[1]],door,[stand[0],door[1]],stand];
    const speed=34+(act.h%8),goT=now-act.t0;
    let p=walk(there,goT,speed),carrying=false;
    if(p.done){p=walk(back,goT-act.goDur,speed);carrying=true;}
    else act.goDur=goT+1;
    if(carrying&&p.done){officeActors.delete(key);continue;}
    awayAgents.add(act.agent);
    const agent=state.agents.find(x=>x.id===act.agent);
    walkingHelper(Math.round(p.x),Math.round(p.y),act.h,p.moving,time,carrying?'aller':null,colors[Math.max(0,state.agents.indexOf(agent))%colors.length]);
    if(p.pause){const bx=boss.cx-36,by=boss.y0+30;px(bx,by,5,4,'#c9a46a');}
  }
}
function draw(time){
  const L=layout(),key=L.W+'x'+L.H+'@'+L.S,now=performance.now();
  if(key!==layoutKey){layoutKey=key;off.width=L.W;off.height=L.H;canvas.width=L.W*L.S;canvas.height=L.H*L.S;canvas.parentElement.style.aspectRatio=L.W+' / '+L.H;}
  spots=[];g.clearRect(0,0,L.W,L.H);trackChanges();
  room(L,time);
  const G=meetingRoom(L,time),vip=L.boss?vipOffice(L,time):null;
  const all=state.agents.length?state.agents:[null,null],items=all.filter(a=>!L.boss||a!==L.boss);
  deskSpots.clear();
  if(vip)station(L.boss,state.agents.indexOf(L.boss),vip.cx,vip.y0,time,L);
  const f=floorBox(L);lastLayout=L;
  items.forEach((a,i)=>{
    const r=Math.floor(i/L.cols),inRow=Math.min(L.cols,items.length-r*L.cols),c=i%L.cols;
    let cx=Math.round(L.areaW/2+(c-(inRow-1)/2)*L.cw),y0=L.top+r*L.rowH;
    const saved=a&&custom.stations[layoutKeyOf(a)];
    if(saved){cx=Math.round(Math.max(26,Math.min(L.W-26,saved.fx*L.W)));y0=Math.round(Math.max(f.top,Math.min(L.roomY-L.rowH,f.top+saved.fy*f.h)));}
    station(a,a?state.agents.indexOf(a):i,cx,y0,time,L);
    if(editLayout&&a){px(cx-26,y0+6,52,1,'#a0dfc4',.6);px(cx-26,y0+76,52,1,'#a0dfc4',.6);px(cx-26,y0+6,1,70,'#a0dfc4',.6);px(cx+25,y0+6,1,70,'#a0dfc4',.6);}
  });
  syncActors(L,now);syncOffice(L,now);
  drawActors(L,G,time,now,'back');tableTop(G);drawActors(L,G,time,now,'side');drawActors(L,G,time,now,'front');
  drawOffice(L,vip,time,now);
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(off,0,0,canvas.width,canvas.height);
  const summary=!state.connected?'Bureau hors ligne : Herdr est déconnecté.':!state.agents.length?'Bureau vide : aucun agent détecté dans Herdr.':'Bureau des agents. '+state.agents.map(a=>a.name+' : '+label(a).toLowerCase()).join(', ')+'. Utilise la liste sous le bureau pour sélectionner un agent.';
  if(summary!==ariaText){ariaText=summary;canvas.setAttribute('aria-label',summary);}
  attentionTitle();
}
// En vue globale l'image est centrée dans son cadre (object-fit: contain) : on retire les bandes vides avant de convertir le clic.
const spotAt=event=>{
  const r=canvas.getBoundingClientRect(),k=Math.min(r.width/canvas.width,r.height/canvas.height);
  const ox=(r.width-canvas.width*k)/2,oy=(r.height-canvas.height*k)/2;
  const x=(event.clientX-r.left-ox)/k,y=(event.clientY-r.top-oy)/k;
  return spots.find(s=>x>=s.x&&x<=s.x+s.w&&y>=s.y&&y<=s.y+s.h);
};
const onMail=event=>{if(!mailSpot)return false;const p=toLogical(event);return p.x>=mailSpot.x&&p.x<=mailSpot.x+mailSpot.w&&p.y>=mailSpot.y&&p.y<=mailSpot.y+mailSpot.h;};
canvas.addEventListener('click',event=>{
  if(editLayout)return;
  if(onMail(event)){showTab('equipe');$('mailbox').scrollIntoView({block:'start'});$('mailbox').classList.remove('flash');void $('mailbox').offsetWidth;$('mailbox').classList.add('flash');return;}
  const spot=spotAt(event);if(spot)selectAgent(spot.id);
});
let vipRect=null,lastLayout=null;
function toLogical(event){
  const r=canvas.getBoundingClientRect(),k=Math.min(r.width/canvas.width,r.height/canvas.height);
  const ox=(r.width-canvas.width*k)/2,oy=(r.height-canvas.height*k)/2,S=lastLayout?.S||1;
  return {x:(event.clientX-r.left-ox)/k/S,y:(event.clientY-r.top-oy)/k/S};
}
canvas.addEventListener('pointerdown',event=>{
  if(!editLayout||!lastLayout)return;
  const p=toLogical(event),L=lastLayout,v=vipRect;
  if(v&&p.x>=v.x+v.w-10&&p.x<=v.x+v.w&&p.y>=v.y+v.h-14&&p.y<=v.y+v.h)dragging={type:'resize'};
  else if(v&&p.x>=v.x&&p.x<=v.x+v.w&&p.y>=v.y&&p.y<=v.y+v.h)dragging={type:'vip',dx:p.x-(v.x+v.w/2),dy:p.y-v.y};
  else{
    const spot=spotAt(event),a=spot&&state.agents.find(x=>x.id===spot.id),d=a&&deskSpots.get(a.id);
    if(a&&d&&a!==L.boss)dragging={type:'station',key:layoutKeyOf(a),dx:p.x-d.cx,dy:p.y-d.y0};
  }
  if(dragging){canvas.setPointerCapture(event.pointerId);event.preventDefault();}
});
canvas.addEventListener('pointermove',event=>{
  if(!dragging||!lastLayout)return;
  const p=toLogical(event),L=lastLayout,f=floorBox(L),v=vipRect;
  if(dragging.type==='station')custom.stations[dragging.key]={fx:(p.x-dragging.dx)/L.W,fy:(p.y-dragging.dy-f.top)/f.h};
  else if(dragging.type==='vip')custom.vip={fx:(p.x-dragging.dx)/L.W,fy:(p.y-dragging.dy-f.top)/f.h,fw:v.w/L.W,fh:v.h/f.h};
  else if(dragging.type==='resize'){const w=Math.max(70,p.x-v.x),h=Math.max(70,p.y-v.y+4);custom.vip={fx:(v.x+w/2)/L.W,fy:(v.y-f.top)/f.h,fw:w/L.W,fh:h/f.h};}
  draw(lastFrame);
});
canvas.addEventListener('pointerup',()=>{if(dragging){dragging=null;saveLayout();}});
function syncLayoutEdit(){
  $('layout-edit').setAttribute('aria-pressed',String(editLayout));$('layout-edit').querySelector('span').textContent=editLayout?'Terminer':'Disposer';
  $('layout-reset').hidden=!editLayout;$('layout-hint').hidden=!editLayout;canvas.classList.toggle('editing',editLayout);draw(lastFrame);
}
$('layout-edit').addEventListener('click',()=>{editLayout=!editLayout;syncLayoutEdit();});
$('layout-reset').addEventListener('click',()=>{custom={stations:{},vip:null};saveLayout();draw(lastFrame);});
addEventListener('keydown',e=>{if(e.key==='Escape'&&editLayout){editLayout=false;syncLayoutEdit();}});
canvas.addEventListener('mousemove',event=>{const id=spotAt(event)?.id||null,mail=onMail(event);canvas.style.cursor=editLayout?'move':id||mail?'pointer':'default';canvas.title=mail?'Courrier du chef : voir qui a terminé':'';if(id!==hovered){hovered=id;draw(lastFrame);}});
canvas.addEventListener('mouseleave',()=>{if(hovered){hovered=null;draw(lastFrame);}});
new ResizeObserver(()=>draw(lastFrame)).observe(canvas.parentElement);
$('fullscreen').hidden=!document.fullscreenEnabled;
$('fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else document.querySelector('main').requestFullscreen().catch(()=>{});});
document.addEventListener('fullscreenchange',()=>{const on=Boolean(document.fullscreenElement);$('fullscreen').setAttribute('aria-pressed',String(on));$('fullscreen').querySelector('span').textContent=on?'Quitter le plein écran':'Plein écran';draw(lastFrame);});
// L'onglet signale les agents qui attendent DrSmoke, même quand la page est en arrière-plan.
function attentionTitle(){const n=state.connected?state.agents.filter(a=>WAIT.includes(a.status)).length:0,title=(n?'('+n+') ':'')+'Bureau des agents · DrSmoke';if(document.title!==title)document.title=title;}
function frame(time){if(!paused&&time-lastFrame>80){draw(time);lastFrame=time;}requestAnimationFrame(frame);}
termPlaceholder($('output').textContent);syncMotion();refreshState();requestAnimationFrame(frame);
setInterval(()=>{if(!document.hidden){refreshState();readOutput();}},3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshState();readOutput();}});
