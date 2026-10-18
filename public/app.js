'use strict';
const $ = id => document.getElementById(id);
const canvas = $('office'), ctx = canvas.getContext('2d');
// Teintes d'identité volontairement éloignées des couleurs d'état (menthe, bleu, ambre, gris).
const colors = ['#d98a74','#9b86e0','#d17aa6','#a3b05f','#b5654f','#7e5fa8'];
const drafts = new Map();
let state = { connected:false, agents:[], token:null }, selected = null, stateBusy = false, readBusy = false, sending = false, readSequence = 0, spots = [];
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
// Animation active par défaut (choix de DrSmoke) ; sa préférence est mémorisée dans ce navigateur.
// Sans choix mémorisé, la réduction des mouvements du système fige la scène.
const readMotion=()=>{try{return localStorage.getItem('bureau.animation');}catch{return null;}};
let paused = readMotion()==='off'||(readMotion()==null&&motionPreference.matches);
const labels = { idle:'Disponible', done:'Terminé', busy:'Au travail', working:'Au travail', running:'Au travail', waiting:'Attend une réponse', blocked:'Attend une réponse', unknown:'État inconnu', stopped:'Arrêté' };
const label = a => quotaPause(a) ? 'En pause (limite)' : labels[a.status] || 'État inconnu';
const tint = a => quotaPause(a) ? '#b5a8e6' : ['busy','working','running'].includes(a.status) ? '#9dbbff' : ['idle','done'].includes(a.status) ? '#a0dfc4' : ['waiting','blocked'].includes(a.status) ? '#f4c780' : '#a7b8ce';
const activeAgent = () => state.agents.find(a => a.id === selected);
// Un agent en pause de limite ne peut pas répondre : pas d'envoi direct, seulement la file d'attente.
const canSend = a => Boolean(state.connected && a && a.ready && ['idle','done'].includes(a.status) && !quotaPause(a));
async function request(url, options = {}) {
  // Délais au moins égaux au pire cas du serveur (liste puis lecture Herdr) pour ne pas abandonner une réponse en route.
  const response = await fetch(url, { ...options, signal:AbortSignal.timeout(url==='/api/broadcast'?120000:30000), cache:'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'La demande a échoué. Réessaie dans un instant.');
  return data;
}
function errorText(error,context='lecture') {
  // Trois causes distinctes, jamais un message unique : session expirée,
  // Herdr déconnecté, lecture en panne. Le contexte « envoi » adapte le mot.
  const message=error?.message||'';
  if(error?.status===403||/Session expir/i.test(message)) return 'Session expirée : actualise le bureau avec le bouton Actualiser.';
  // Les messages précis du serveur (agent occupé, envoi peut-être reçu, refus) sont gardés tels quels :
  // les remplacer par « la consigne n'a pas été transmise » serait faux et pousserait à un double envoi.
  if(message&&!(error instanceof TypeError)&&error?.name!=='TimeoutError'&&!(error instanceof SyntaxError))return message;
  if(typeof state!=='undefined'&&state&&state.connected===false)return 'Herdr est déconnecté ou ne répond plus : les lectures reprendront quand il reviendra.';
  const detail=(error.name==='TimeoutError'?'délai dépassé':error instanceof TypeError?'le serveur local ne répond plus, vérifie que le bureau est toujours lancé':error instanceof SyntaxError?'réponse illisible':message||'cause inconnue').replace(/[.\s]+$/,'');
  return (context==='envoi'?'Envoi non abouti : ':'Lecture en panne : ')+detail+'. Réessaie dans un instant.';
}
// Agent occupé ou en pause : la consigne peut être mise en file ; le serveur l'enverra seul quand il sera prêt.
const canQueue = a => Boolean(state.connected && a && !canSend(a));
function updateForm() {
  const a = activeAgent(), allowed = canSend(a), queue = canQueue(a);
  $('message').disabled = !(allowed || queue) || sending;
  $('send').disabled = !(allowed || queue) || sending || !$('message').value.trim();
  $('send').classList.toggle('queue-mode', queue);
  $('priority-wrap').hidden = !queue;if(!queue)$('priority').checked=false;
  $('send').querySelector('span').textContent = sending ? 'Envoi en cours…' : queue ? 'Mettre en file pour ' + a.name : attached.length ? 'Envoyer avec le fichier par la file' : 'Envoyer la consigne';
  const pause = queue && quotaPause(a);
  $('send-help').textContent = !a ? 'Sélectionne un agent pour lui écrire.' : !state.connected ? 'Envoi indisponible : Herdr est déconnecté.' : queue ? a.name + (pause ? ' est en pause' + (pause.until ? ' jusqu’à ' + hhmm(pause.until) : '') : ' n’est pas disponible') + ' : la consigne attendra dans la file et partira seule dès qu’il sera prêt.' : 'La consigne sera envoyée à ' + a.name + ' dans Herdr. Ctrl+Entrée pour envoyer.';
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
    const text=document.createElement('span'), name=document.createElement('span'), status=document.createElement('span');name.className='agent-name';name.textContent=a.name;status.className='agent-status';const qp=quotaPause(a);status.textContent=!state.connected?'Connexion perdue':qp?'En pause'+(qp.until?' · retour '+hhmm(qp.until):''):label(a);text.append(name,status);button.append(face,text);
    if(a.paneId){const pane=document.createElement('span');pane.className='pane-badge';pane.textContent=a.paneId;pane.title='Panneau Herdr';button.append(pane);}button.addEventListener('click',()=>selectAgent(a.id));list.append(button);
  });
  if(focused){const again=[...list.children].find(e=>e.dataset.agentId===focused);(again||list.querySelector('.agent-button')||$('refresh')).focus({preventScroll:true});}
  const a=activeAgent();
  $('detail-title').textContent=a?a.name:'Choisis un agent';
  $('detail-status').textContent=a?(state.connected?label(a):'Connexion perdue'):'Son poste s’ouvrira ici.';
  $('detail-dot').style.background=a?tint(a):'#71839a';
  $('detail-avatar').style.color=a?colors[state.agents.indexOf(a)%colors.length]:'#a0dfc4';
  const avatarLogo=a&&logoCanvas(a);
  if(avatarLogo)$('detail-avatar').replaceChildren(avatarLogo);else if(!$('detail-avatar').querySelector('svg'))$('detail-avatar').replaceChildren(defaultAvatar.cloneNode(true));
  $('agent-info').hidden=!a;
  $('panel-poste').classList.toggle('no-agent',!a);$('poste-empty').hidden=Boolean(a);
  // Invitation reconstruite seulement si les noms ou états changent, en gardant le bouton focalisé.
  const pickKey=a?'':state.agents.map(x=>x.id+'|'+x.name+'|'+label(x)).join('\n');
  if(!a&&$('pick-list').dataset.key!==pickKey){
    const focusedPick=document.activeElement?.closest?.('#pick-list button')?.dataset.id;$('pick-list').dataset.key=pickKey;
    $('pick-list').replaceChildren(...state.agents.map(x=>{const b=document.createElement('button');b.type='button';b.className='tool-button pick';b.dataset.id=x.id;b.textContent=x.name+' · '+label(x).toLowerCase();b.addEventListener('click',()=>selectAgent(x.id));return b;}));
    if(focusedPick)$('pick-list').querySelector('[data-id="'+CSS.escape(focusedPick)+'"]')?.focus({preventScroll:true});
  }
  if(a)$('pick-list').dataset.key='';
  if(a){$('agent-kind').textContent=a.kind||'Non précisé';$('agent-pane').textContent=a.paneId||'Non précisé';$('agent-cwd').textContent=a.cwd||'Non précisé';}
  renderActivity(a);renderStatusbar(a);updateForm();renderBroadcast();renderSummary();renderDirection();
}
// Résumé en tête de page et alerte : uniquement les états Herdr actuels.
function renderSummary(){
  const on=state.connected,count=list=>on?state.agents.filter(a=>list.includes(a.status)).length:0;
  $('count-work').textContent=count(['busy','working','running']);$('count-wait').textContent=count(['waiting','blocked']);$('count-free').textContent=on?state.agents.filter(a=>['idle','done'].includes(a.status)&&!quotaPause(a)).length:0;
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
const tabs=['poste','equipe','fichiers','taches'];
function showTab(name){
  for(const t of tabs){const on=t===name,tab=$('tab-'+t);tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;$('panel-'+t).hidden=!on;}
  if(name==='fichiers')loadFiles();
  if(name==='taches')loadTodos();
  if(name==='equipe'){loadQueue();loadTreatments();renderMail();if(mailCount){mailCount=0;draw(lastFrame);}}
}
const currentTab=()=>tabs.find(t=>$('tab-'+t).getAttribute('aria-selected')==='true');
// File d'attente : lecture du serveur, annulation possible tant que la consigne n'est pas partie.
const queueLabels={attente:'en attente',envoyee:'envoyée',annulee:'annulée',a_revoir:'à revoir'};
let queueItems=[],queueGen=0,queueShown='',todosGen=0,todosShown='',todosData=null,attached=[];
function errorBlock(container,message,icon='erreur',retry=null){
  // La même panne n'est ni redessinée ni réannoncée : le bouton garde le focus et l'alerte reste unique.
  // Le message est affiché tel quel : aucune liste vide ne remplace jamais une erreur.
  const old=container.querySelector(':scope>.error-block');if(old&&old.dataset.message===message)return;
  const box=document.createElement('div');box.dataset.message=message;box.className='error-block';box.setAttribute('role','alert');
  const pic=iconCanvas(icon);if(pic)box.append(pic);
  const p=document.createElement('p');p.textContent=message;
  const btn=document.createElement('button');btn.type='button';btn.className='tool-button';btn.textContent='Actualiser le bureau';
  btn.addEventListener('click',async()=>{await refreshState();if(retry)return retry();const t=currentTab();if(t==='equipe')loadQueue();if(t==='taches')loadTodos();if(t==='fichiers')loadFiles();});
  box.append(p,btn);container.replaceChildren(box);
}
function iconCanvas(name){
  const icon=window.EMPTY_ICONS?.[name];if(!icon)return null;
  const c=document.createElement('canvas');c.width=16;c.height=16;c.className='empty-icon';c.setAttribute('aria-hidden','true');const g3=c.getContext('2d');
  icon.rows.forEach((row,y)=>[...row].forEach((ch,x)=>{if(icon.palette[ch]){g3.fillStyle=icon.palette[ch];g3.fillRect(x,y,1,1);}}));return c;
}
async function loadQueue(){
  if(!state.connected||!state.token){queueShown='';errorBlock($('queue-list'),'Herdr est déconnecté : la file d’attente réapparaîtra à la reconnexion.','file');return;}
  // Seule la lecture la plus récente s'affiche : une réponse lente ne remplace jamais une plus récente.
  const gen=++queueGen;let items;
  try{items=(await request('/api/queue',{headers:{'X-Bureau-Token':state.token}})).items||[];}catch(error){if(gen===queueGen){queueShown='';errorBlock($('queue-list'),errorText(error),'file');}return;}
  if(gen!==queueGen)return;
  queueItems=items;renderQueue();renderStatusbar(activeAgent());
}
function renderQueue(){
  const list=$('queue-list'),visible=queueItems.filter(q=>q.state!=='annulee').slice(-20).reverse(),waitingN=queueItems.filter(q=>q.state==='attente').length;
  $('queue-count').textContent=waitingN?'('+waitingN+' en attente)':'';
  const shown=JSON.stringify([visible,state.agents.map(a=>a.id+a.name)]);if(shown===queueShown)return;queueShown=shown;
  if(!visible.length){const li=document.createElement('li');li.className='list-placeholder';li.textContent='Aucune consigne en attente.';list.replaceChildren(li);return;}
  const focusedItem=document.activeElement?.closest?.('#queue-list [data-item]')?.dataset.item,focusedIndex=focusedItem?[...document.activeElement.parentElement.children].indexOf(document.activeElement)+1:1;
  list.replaceChildren(...visible.map(q=>{
    const agent=state.agents.find(a=>a.id===q.id),li=document.createElement('li');li.className='queue-item '+q.state;li.dataset.item=q.itemId;
    const head=document.createElement('span');head.className='log-head';
    head.textContent=(agent?.name||'Agent disparu')+' · '+queueLabels[q.state]+(q.state==='attente'&&q.notBefore&&new Date(q.notBefore)>Date.now()?' · pas avant '+hhmm(new Date(q.notBefore)):'')+(q.sentAt?' · '+hhmm(new Date(q.sentAt)):'');
    const body=document.createElement('span');body.className='log-body';body.textContent=q.message.length>140?q.message.slice(0,140)+'…':q.message;
    if(q.priority==='haute'){const tag=document.createElement('span');tag.className='prio';tag.textContent='Prioritaire';head.prepend(tag,' · ');}
    li.append(head,body);
    if(q.files?.length){const att=document.createElement('span');att.className='log-why';att.textContent='Fichier'+(q.files.length>1?'s':'')+' joint'+(q.files.length>1?'s':'')+' : '+(q.copiedFiles?.length?q.copiedFiles.map(f=>f.name).join(', '):q.files.map(f=>f.path.split(/[/\\]/).pop()).join(', '))+(q.copiedFiles?.length?' (copié dans le dossier de l’agent)':' (copie au départ)');li.append(att);}
    if(q.reason){const why=document.createElement('span');why.className='log-why';why.textContent=q.reason;li.append(why);}
    if(q.state==='attente'){
      const tools=document.createElement('div');tools.className='queue-tools';
      const high=q.priority==='haute',prio=document.createElement('button');prio.type='button';prio.className='tool-button';prio.textContent=high?'Remettre en normal':'Passer en tête';
      prio.addEventListener('click',async()=>{try{await request('/api/queue/priority',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({itemId:q.itemId,priority:high?'normale':'haute'})});}catch(error){head.textContent=errorText(error);}loadQueue();});
      const cancel=document.createElement('button');cancel.type='button';cancel.className='tool-button';cancel.textContent='Retirer de la file';
      cancel.addEventListener('click',async()=>{try{await request('/api/queue/cancel',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({itemId:q.itemId})});}catch(error){head.textContent=errorText(error,'envoi');}loadQueue();});
      tools.append(prio,cancel);li.append(tools);
    }
    return li;
  }));
  if(focusedItem)(list.querySelector('[data-item="'+CSS.escape(focusedItem)+'"] button:nth-of-type('+focusedIndex+')')||list.querySelector('[data-item="'+CSS.escape(focusedItem)+'"] button'))?.focus({preventScroll:true});
}
// Tâches : cases réelles des fichiers du projet et plans publiés par les agents.
// Le pourcentage est un simple rapport de cases cochées sur cases totales, jamais une estimation.
const pct=(done,total)=>total?Math.round(done/total*100):0;
function planOf(id){const steps=todosData?.agents?.[id];if(!steps?.length)return null;const done=steps.filter(s=>s.status==='completed').length;return{done,total:steps.length,pct:pct(done,steps.length)};}
async function loadTodos(){
  if(!state.connected||!state.token){todosShown='';$('tasks-progress').replaceChildren();errorBlock($('tasks-project'),'Herdr est déconnecté : les tâches réapparaîtront à la reconnexion.','taches');$('tasks-agents').replaceChildren(Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:'Plans non chargés.'}));return;}
  const gen=++todosGen;let data;
  try{data=await request('/api/todos',{headers:{'X-Bureau-Token':state.token}});}catch(error){if(gen!==todosGen)return;todosData=null;todosShown='';$('tasks-progress').replaceChildren();errorBlock($('tasks-project'),errorText(error),'taches');$('tasks-agents').replaceChildren(Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:'Plans non chargés.'}));return;}
  const shown=JSON.stringify([data,state.agents.map(a=>a.id+a.name)]);if(gen!==todosGen||shown===todosShown)return;todosShown=shown;todosData=data;renderStatusbar(activeAgent());
  const project=data.project||[],done=project.filter(t=>t.done).length;
  const prog=$('tasks-progress');prog.replaceChildren();
  if(project.length){
    const label=document.createElement('div');label.className='limit-head';
    const l1=document.createElement('span');l1.textContent='Cases cochées dans le projet';const l2=document.createElement('b');l2.textContent=done+' sur '+project.length+' · '+pct(done,project.length)+' %';label.append(l1,l2);
    const track=document.createElement('div');track.className='limit-track';const bar=document.createElement('i');bar.style.width=(done/project.length*100)+'%';track.append(bar);prog.append(label,track);
  }
  const groups=new Map();for(const t of project){if(!groups.has(t.source))groups.set(t.source,[]);groups.get(t.source).push(t);}
  $('tasks-project').replaceChildren(...[...groups].map(([source,items])=>{
    const sec=document.createElement('section');sec.className='task-group';
    const d=items.filter(t=>t.done).length;
    const h=document.createElement('h3');h.textContent=source+' · '+d+'/'+items.length+' · '+pct(d,items.length)+' %';
    const track=document.createElement('div');track.className='limit-track';track.setAttribute('role','img');track.setAttribute('aria-label',pct(d,items.length)+' % des cases cochées dans '+source);const bar=document.createElement('i');bar.style.width=pct(d,items.length)+'%';track.append(bar);
    sec.append(h,track);
    for(const [title,list] of [['À faire',items.filter(t=>!t.done)],['Réalisées',items.filter(t=>t.done)]]){
      if(!list.length)continue;
      const sub=document.createElement('h4');sub.className='task-sub';sub.textContent=title+' ('+list.length+')';
      const ul=document.createElement('ul');ul.className='task-list';
      for(const t of list){const li=document.createElement('li');li.className=t.done?'done':'';const box=document.createElement('span');box.className='box';box.setAttribute('aria-hidden','true');const tx=document.createElement('span');tx.textContent=t.text;li.append(box,tx);li.setAttribute('aria-label',(t.done?'Fait : ':'À faire : ')+t.text);ul.append(li);}
      sec.append(sub,ul);
    }
    return sec;
  }));
  if(!project.length)$('tasks-project').textContent='Aucune case à cocher trouvée dans TODO.md ni dans les plans.';
  const agents=Object.entries(data.agents||{}).filter(([,steps])=>steps?.length);
  const statusLabel={pending:'à faire',in_progress:'en cours',completed:'fait'};
  $('tasks-agents').replaceChildren(...(agents.length?agents.map(([id,steps])=>{
    const sec=document.createElement('section');sec.className='task-group';const h=document.createElement('h3');const dn=steps.filter(s=>s.status==='completed').length;h.textContent=(state.agents.find(a=>a.id===id)?.name||'Agent')+' · '+dn+'/'+steps.length+' · '+pct(dn,steps.length)+' %';
    const ul=document.createElement('ul');ul.className='task-list';
    for(const s of steps){const li=document.createElement('li');li.className=s.status==='completed'?'done':s.status==='in_progress'?'doing':'';const box=document.createElement('span');box.className='box';const tx=document.createElement('span');tx.textContent=s.text+' ('+(statusLabel[s.status]||s.status)+')';li.append(box,tx);ul.append(li);}
    sec.append(h,ul);return sec;
  }):[Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:'Aucun plan publié par un agent pour le moment.'})]));
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
  $('panel-fichiers').classList.remove('files-error');
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
  }catch(error){errorBlock($('file-list'),errorText(error),'fichiers');$('places').replaceChildren(Object.assign(document.createElement('li'),{className:'list-placeholder',textContent:'Destinations non chargées.'}));$('files-intro').textContent=/introuvable|404/i.test(error.message)?'L’explorateur de fichiers attend son raccordement au serveur.':'';$('panel-fichiers').classList.add('files-error');}
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
// Une annonce relue garde l'échéance de sa première lecture : sinon « 4:45 PM » relu à 16:46 deviendrait demain.
const clockSeen=new Map();
function parseClock(txt){
  const key=txt.trim(),seen=clockSeen.get(key);
  if(seen&&Date.now()-seen.at<12*3600000)return seen.until;
  const m=/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i.exec(txt)||/(\d{1,2})[:h](\d{2})/.exec(txt);if(!m)return null;
  let h=Number(m[1]),min=Number(m[2]||0);
  if(m[3]){if(h<1||h>12)return null;h=h%12+(m[3].toLowerCase()==='p'?12:0);}
  if(h>23||min>59)return null;
  const d=new Date();
  if(/\b(UTC|GMT)\b/i.test(txt))d.setUTCHours(h,min,0,0);else d.setHours(h,min,0,0);
  if(d<Date.now()-60000)d.setDate(d.getDate()+1);
  clockSeen.set(key,{until:d,at:Date.now()});
  if(clockSeen.size>50)clockSeen.delete(clockSeen.keys().next().value);
  return d;
}
function limitFromText(text){
  const tail=text.split('\n').slice(-40).join('\n');
  if(!/usage limit|limit reached|rate limit|quota (atteint|exceeded)|hit your .*limit/i.test(tail))return null;
  const when=/(?:try again at|resets?(?: at)?|reset at|réessaie(?:z)? à)\s+([^\n.·]+)/i.exec(tail);
  return {until:when?parseClock(when[1]):null};
}
// Durée en minutes : 300 → « 5 h », 1440 → « 24 h », 10080 → « 7 j ».
const windowLabel=min=>!min?null:min%1440===0&&min>1440?min/1440+' j':min%60===0?min/60+' h':min+' min';
function quotaPause(a){
  if(!a)return null;
  const act=a.activity;
  if(act?.limitReached){
    // Seules les limites épuisées décident du retour ; si aucune ne l'est, l'outil ne dit pas laquelle bloque.
    const blocking=(act.limits||[]).filter(l=>l.usedPercent>=100);
    const times=[...blocking.filter(l=>l.resetsAt).map(l=>new Date(l.resetsAt)),act.resetsAt?new Date(act.resetsAt):null].filter(d=>d&&d>Date.now());
    const which=blocking.map(l=>windowLabel(l.window)).filter(Boolean);
    return {until:times.length?new Date(Math.max(...times)):null,source:act.source==='terminal'?'terminal':'journal',which:which[0]||null};
  }
  const s=statusCache.get(a.id)?.status?.quota;
  if(s&&(!s.until||s.until>Date.now()))return {until:s.until,source:'terminal'};
  return null;
}
// P3 : la pause de quota tient en une seule ligne, avec sa source et l'heure de
// relance ; la relance vient de holdUntil quand la file la donne, sinon +5 min.
function holdUntilOf(a){
  const dates=queueItems.filter(q=>q.id===a.id&&q.holdUntil).map(q=>new Date(q.holdUntil)).filter(d=>!Number.isNaN(d));
  return dates.length?new Date(Math.max(...dates)):null;
}
function pauseBanner(a,pause){
  const source=pause.source;
  if(!pause.until)return 'Pause de quota : retour non annoncé (source : '+source+')';
  const relance=holdUntilOf(a)||new Date(pause.until.getTime()+300000);
  return 'Pause de quota : retour '+hhmm(pause.until)+', relance '+hhmm(relance)+' (source : '+source+')';
}
const hhmm=d=>d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
function renderStatusbar(a){
  const bar=$('statusbar'),s=a&&statusCache.get(a.id),pause=a&&quotaPause(a);
  const st=s?.status&&Object.keys(s.status).length?s.status:null;
  const plan=a&&planOf(a.id);
  if(!a||(!st&&!pause&&!plan)){bar.hidden=true;return;}
  bar.hidden=false;
  const head=st?.title||(st?.thought?'En cours : '+st.thought:'');
  $('task-title').hidden=!head;$('task-title').textContent=head;
  const chips=[];
  if(pause)chips.push(['warn',pauseBanner(a,pause)]);
  if(st?.activity&&!pause)chips.push(['activity',st.activity+(st.elapsed?' · '+st.elapsed:'')]);
  if(st?.model)chips.push(['model',(st.mode?st.mode+' · ':'')+st.model+(st.effort?' · '+st.effort:'')]);
  if(st?.context)chips.push(['context','Contexte '+st.context.used+' · '+st.context.pct+' %']);
  if(st?.flow)chips.push(['context',st.flow+' tokens sur ce tour']);
  if(plan)chips.push(['context','Plan publié : '+plan.done+'/'+plan.total+' cases · '+plan.pct+' %']);
  if(st?.warnings)chips.push(['warn',st.warnings+' avertissement'+(st.warnings>1?'s':'')]);
  $('status-chips').replaceChildren(...chips.map(([k,t])=>{const li=document.createElement('li');li.className='schip '+k;li.textContent=t;return li;}));
  $('limit').hidden=!st?.limit;
  if(!st?.limit){$('limit-label').textContent='';$('limit-value').textContent='';}
  else{
    $('limit-label').textContent='Limite'+(st.limit.window?' '+st.limit.window:'')+' restante'+(st.limit.reset?' · remise à zéro '+hhmm(st.limit.reset):'');$('limit-value').textContent=st.limit.left+' %';
    $('limit-bar').style.width=Math.max(0,Math.min(100,st.limit.left))+'%';$('limit').classList.toggle('low',st.limit.left<=20);
  }
  $('status-source').textContent=s?'Lu dans la barre de l’outil à '+s.at.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
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
$('term-expand').addEventListener('click',()=>{const on=!document.body.classList.contains('term-expanded');document.body.classList.toggle('term-expanded',on);$('term-expand').setAttribute('aria-pressed',String(on));$('term-expand').textContent=on?'Réduire':'Agrandir';if(on)$('output').scrollIntoView({block:'nearest'});});
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
// Copie commune (P1) : succès ou échec annoncé de façon accessible. Si le
// presse-papiers est refusé ou indisponible, une zone de texte en lecture seule
// avec « Tout sélectionner » prend le relais ; aucun raccourci clavier global
// n'est détourné, Ctrl+A reste utilisable ailleurs sur la page.
function announceCopy(message,ok){
  let zone=$('copy-status');
  if(!zone){
    zone=document.createElement('div');zone.id='copy-status';
    zone.style.cssText='position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:95;max-width:min(560px,92vw);padding:9px 14px;border-radius:10px;font-size:13px;line-height:1.4;box-shadow:0 6px 18px rgba(0,0,0,.35);';
    document.body.append(zone);
  }
  zone.setAttribute('role',ok?'status':'alert');
  zone.style.background=ok?'#123c2a':'#4a1d22';
  zone.style.color=ok?'#a7e8c6':'#ffc0c0';
  zone.textContent=message;
  clearTimeout(zone._masque);
  zone._masque=setTimeout(()=>zone.remove(),5000);
}
function openCopyFallback(texte,message,declencheur){
  const fond=document.createElement('div');
  fond.style.cssText='position:fixed;inset:0;background:rgba(6,12,24,.72);z-index:96;display:flex;align-items:center;justify-content:center;padding:16px;';
  const boite=document.createElement('div');
  boite.setAttribute('role','dialog');boite.setAttribute('aria-label','Copie manuelle');
  boite.style.cssText='background:#101d33;border:1px solid #2c4468;border-radius:12px;padding:14px;max-width:640px;width:100%;';
  const titre=document.createElement('p');
  titre.style.cssText='margin:0 0 8px;';
  titre.textContent=message+' : la copie automatique a été refusée, sélectionne le texte ci-dessous puis copie-le (Ctrl+C).';
  const zone=document.createElement('textarea');
  zone.readOnly=true;zone.value=texte;zone.rows=12;
  zone.style.cssText='width:100%;box-sizing:border-box;white-space:pre-wrap;user-select:text;background:#0b1526;color:#e7edf5;border:1px solid #2c4468;border-radius:8px;padding:8px;font-size:13px;';
  const actions=document.createElement('div');actions.style.cssText='margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;';
  const choisir=document.createElement('button');choisir.type='button';choisir.className='tool-button';choisir.textContent='Tout sélectionner';
  choisir.addEventListener('click',()=>{zone.focus();zone.select();announceCopy('Texte sélectionné : copie-le avec Ctrl+C.',true);});
  const fermer=document.createElement('button');fermer.type='button';fermer.className='tool-button';fermer.textContent='Fermer';
  const fin=()=>{fond.remove();if(declencheur&&declencheur.isConnected)declencheur.focus({preventScroll:true});};
  fermer.addEventListener('click',fin);
  fond.addEventListener('mousedown',e=>{if(e.target===fond)fin();});
  actions.append(choisir,fermer);boite.append(titre,zone,actions);fond.append(boite);document.body.append(fond);
  choisir.focus();
}
async function copyText(texte,message,declencheur){
  try{
    if(!navigator.clipboard||typeof navigator.clipboard.writeText!=='function')throw new Error('presse-papiers indisponible');
    await navigator.clipboard.writeText(texte);
    announceCopy(message+' : copié.',true);
    return true;
  }catch{
    announceCopy(message+' : copie refusée, repli manuel ouvert.',false);
    openCopyFallback(texte,message,declencheur);
    return false;
  }
}
const sendLog=[];
function logSend(names,message,outcome,detail){
  sendLog.unshift({at:new Date(),names,message,outcome,detail});sendLog.length=Math.min(sendLog.length,30);
  $('send-log').replaceChildren(...sendLog.map(e=>{
    const li=document.createElement('li');li.className=e.outcome;
    const head=document.createElement('span');head.className='log-head';head.textContent=e.at.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+' · '+e.names.join(', ')+' · '+outcomeLabels[e.outcome];
    const body=document.createElement('span');body.className='log-body';body.textContent=e.message.length>110?e.message.slice(0,110)+'…':e.message;
    li.append(head,body);if(e.outcome!=='sent'){const why=document.createElement('span');why.className='log-why';why.textContent=e.detail;li.append(why);}
    // P1 : l'aperçu reste court, mais la consigne INTÉGRALE se lit et se copie
    // d'un clic, toujours depuis e.message, jamais depuis le texte raccourci.
    const actions=document.createElement('span');actions.className='log-actions';actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;';
    const lire=document.createElement('button');lire.type='button';lire.className='tool-button';lire.textContent='Lire tout';
    let ouvert=null;
    lire.addEventListener('click',()=>{
      if(ouvert){ouvert.remove();ouvert=null;lire.textContent='Lire tout';return;}
      ouvert=document.createElement('span');ouvert.className='log-full';
      ouvert.style.whiteSpace='pre-wrap';ouvert.style.userSelect='text';
      ouvert.textContent=e.message;
      li.append(ouvert);lire.textContent='Réduire';
    });
    const copier=document.createElement('button');copier.type='button';copier.className='tool-button';copier.textContent='Copier la consigne';
    copier.addEventListener('click',()=>copyText(e.message,'Consigne de '+e.names.join(', '),copier));
    actions.append(lire,copier);li.append(actions);return li;
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
    const li=document.createElement('li');li.className='unknown';li.textContent=errorText(error,'envoi')+' Vérifie les terminaux avant de renvoyer : une partie des consignes peut avoir été reçue.';results.append(li);
    logSend(state.agents.filter(a=>ids.includes(a.id)).map(a=>a.name),message,outcomeOf(error),errorText(error,'envoi'));
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
  selected=id;readSequence++;resetAttach();loadAttach();loadResponses();
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
    if(state.connected){const live=new Set(state.agents.map(a=>a.id));for(const m of [lastStatus,changes,statusCache,pausedSeen])for(const id of m.keys())if(!live.has(id))m.delete(id);}
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
// Fichiers confiés : faits observés par le serveur pour chaque pièce jointe, jamais un verdict.
const sourceLabels={file:'file',disque:'disque',herdr:'Herdr',journal:'journal'};
let treatShown='';
async function loadTreatments(){
  if(!state.connected||!state.token||!state.agents.length)return;
  try{
    const lists=await Promise.all(state.agents.map(a=>request('/api/traitement?id='+encodeURIComponent(a.id),{headers:{'X-Bureau-Token':state.token}}).then(d=>(d.dossiers||[]).map(x=>({...x,agent:a.name})),()=>[])));
    const dossiers=lists.flat().sort((x,y)=>Date.parse(y.faits.at(-1)?.at||0)-Date.parse(x.faits.at(-1)?.at||0)).slice(0,10);
    const shown=JSON.stringify(dossiers);if(shown===treatShown)return;treatShown=shown;
    $('treat-count').textContent=dossiers.length?'('+dossiers.length+')':'';
    if(!dossiers.length){$('treat-list').replaceChildren(Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:'Aucun fichier confié pour le moment.'}));return;}
    $('treat-list').replaceChildren(...dossiers.map(d=>{
      const sec=document.createElement('section');sec.className='task-group';
      const h=document.createElement('h3');h.textContent=d.fichierConfie+' · confié à '+d.agent;
      const ul=document.createElement('ul');ul.className='task-list';
      for(const f of d.faits){const li=document.createElement('li');li.textContent=hhmm(new Date(f.at))+' · '+f.fait+' ('+(sourceLabels[f.source]||f.source)+')';ul.append(li);}
      sec.append(h,ul);return sec;
    }));
  }catch{ /* Lecture facultative : la file reste utilisable. */ }
}
// Pièces jointes : fichiers récents du dossier de l'agent, copiés par le serveur au départ de la consigne (par la file).
const attachSize=n=>n<1048576?Math.max(1,Math.round(n/1024))+' Ko':(n/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})+' Mo';
function attachSummary(){const n=attached.length;$('attach-summary').textContent=n?n+' fichier'+(n>1?'s':'')+' joint'+(n>1?'s':''):'Joindre un fichier';}
function resetAttach(){attached=[];$('attach-list').replaceChildren();attachSummary();}
async function loadAttach(){
  const a=activeAgent(),box=$('attach');
  if(!box.open||!a||!state.token)return;
  const list=$('attach-list'),note=text=>list.replaceChildren(Object.assign(document.createElement('li'),{className:'list-placeholder',textContent:text}));
  try{
    const data=await request('/api/files/recent?id='+encodeURIComponent(a.id),{headers:{'X-Bureau-Token':state.token}});
    if(a.id!==selected)return;
    const files=(data.files||[]).filter(f=>f.size<=20*1048576).slice(0,30);
    if(!files.length){note('Aucun fichier récent de moins de 20 Mo dans le dossier de '+a.name+'.');return;}
    list.replaceChildren(...files.map(f=>{
      const li=document.createElement('li'),label=document.createElement('label'),box=document.createElement('input');
      box.type='checkbox';box.checked=attached.some(x=>x.path===f.path);
      box.addEventListener('change',()=>{
        attached=attached.filter(x=>x.path!==f.path);
        if(box.checked)attached.push({root:data.root,path:f.path,name:f.name});
        if(attached.length>2){attached.shift();[...list.querySelectorAll('input')].forEach(i=>{i.checked=attached.some(x=>x.name===i.dataset.name);});}
        attachSummary();updateForm();
      });
      box.dataset.name=f.name;
      label.append(box,' ',Object.assign(document.createElement('span'),{textContent:f.name+' · '+attachSize(f.size)}));li.append(label);return li;
    }));
  }catch(error){if(a.id===selected)note(errorText(error));}
}
$('attach').addEventListener('toggle',loadAttach);
// Réponses lisibles : journal de l'agent, chargé seulement quand le volet est ouvert.
let respBusy=false;
async function loadResponses(){
  const box=$('responses-box'),zone=$('responses'),a=activeAgent();
  if(!box.open||!a||!state.connected||!state.token||!window.ResponseCard)return;
  if(zone.dataset.agent!==a.id){zone.dataset.agent=a.id;zone.replaceChildren();}
  if(respBusy)return;
  respBusy=true;
  const note=text=>zone.replaceChildren(Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:text}));
  try{
    const data=await request('/api/reponses?id='+encodeURIComponent(a.id),{headers:{'X-Bureau-Token':state.token}});
    if(a.id!==selected)return;
    if(!data.supported)note(data.reason||'Les réponses de cet outil ne sont pas exposées pour le moment.');
    else if(!data.found)note('Journal de cet agent introuvable ou non rattaché avec certitude : rien n’est affiché plutôt qu’un doute.');
    else if(!data.responses.length)note('Aucune réponse écrite par cet agent dans le journal lu.');
    else ResponseCard.render(zone,{agent:a.name,agentId:a.id,found:true,complete:data.complete,responses:data.responses});
  }catch(error){if(a.id===selected)note(errorText(error));}
  finally{respBusy=false;}
}
$('responses-box').addEventListener('toggle',loadResponses);
$('message').addEventListener('input',()=>{if(selected)keepDraft(selected,$('message').value);updateForm();});
$('prompt-form').addEventListener('submit',async event=>{
  event.preventDefault();const a=activeAgent(),message=$('message').value.trim();
  if((canQueue(a)||(attached.length&&canSend(a)))&&!sending&&message){
    const target=a.id;sending=true;updateForm();$('send-result').hidden=true;
    try{
      await request('/api/queue',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({id:target,message,priority:$('priority').checked?'haute':'normale',...(attached.length?{files:attached.map(({root,path})=>({root,path}))}:{})})});
      drafts.delete(target);$('priority').checked=false;resetAttach();loadAttach();loadQueue();
      if(target===selected){$('message').value='';$('send-result').className='';$('send-result').textContent='Consigne mise en file pour '+a.name+'. Suis-la dans l’onglet Équipe.';$('send-result').hidden=false;}
    }catch(error){if(target===selected){$('send-result').className='error';$('send-result').textContent=errorText(error,'envoi');$('send-result').hidden=false;}}
    finally{sending=false;updateForm();}
    return;
  }
  if(!canSend(a)||sending||!message)return;
  const target=a.id;sending=true;updateForm();$('send-result').hidden=true;
  try{
    const data=await request('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({id:target,message})});
    drafts.delete(target);logSend([a.name],message,'sent',data.message||'Consigne transmise à Herdr.');
    if(target===selected){$('message').value='';$('send-result').className='';$('send-result').textContent=data.message||'Consigne transmise à Herdr.';$('send-result').hidden=false;}
    await refreshState();
  }catch(error){logSend([a.name],message,outcomeOf(error),errorText(error,'envoi'));if(target===selected){$('send-result').className='error';$('send-result').textContent=errorText(error,'envoi')+' Vérifie les sorties de l’agent avant de renvoyer : la consigne peut avoir été reçue.';$('send-result').hidden=false;}}
  finally{sending=false;updateForm();}
});
$('refresh').addEventListener('click',async()=>{await refreshState();readOutput();});
function syncMotion(){ $('motion').setAttribute('aria-pressed',String(paused));$('motion').querySelector('span').textContent=paused?'Animer le bureau':'Mettre en pause';$('motion').querySelector('path').setAttribute('d',paused?'m8 5 11 7-11 7V5':'M8 5v14M16 5v14');draw(0); }
$('motion').addEventListener('click',()=>{paused=!paused;try{localStorage.setItem('bureau.animation',paused?'off':'on');}catch{}syncMotion();});
motionPreference.addEventListener('change',()=>{if(readMotion()==null){paused=motionPreference.matches;syncMotion();}});
// Scène dessinée en basse résolution puis agrandie : chaque pixel du décor reste net à toutes les tailles.
const WORK=['busy','working','running'], FREE=['idle','done'], WAIT=['waiting','blocked'];
const sceneLabels={working:'AU TRAVAIL',busy:'AU TRAVAIL',running:'AU TRAVAIL',idle:'DISPONIBLE',done:'TERMINÉ',waiting:'ATTEND RÉPONSE',blocked:'ATTEND RÉPONSE'};
const glyphs={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',0:'111101101101111',1:'010110010010111',2:'110001010100111',3:'110001010001110',4:'101101111001001',5:'111100110001110',6:'011100111101111',7:'111001010010010',8:'111101111101111',9:'111101111001110','-':'000000111000000','+':'000010111010000','_':'000000000000111','.':'000000000000010',':':'000010000010000','?':'110001010000010','!':'010010010000010','/':'001001010100100',"'":'010010000000000',' ':'000000000000000'};
const off=document.createElement('canvas'), g=off.getContext('2d');
let hovered=null, ariaText='', lastFrame=0, layoutKey='', boardBottom=0;
const lastStatus=new Map(), changes=new Map();
// Départs et retours de pause de quota : déclenchés seulement par un passage observé, jamais au chargement.
const pausedSeen=new Set(),quotaTrips=new Map();
function trackChanges(){
  const now=performance.now();
  for(const a of state.agents){
    const prev=lastStatus.get(a.id);
    if(prev&&prev!==a.status){changes.set(a.id,{from:prev,to:a.status,at:now});if(WAIT.includes(a.status))signal('blocked',a.name+' attend ta réponse','Ouvre son poste dans le bureau pour lui répondre dans Herdr.');}
    lastStatus.set(a.id,a.status);
    const p=quotaPause(a);
    if(p&&!pausedSeen.has(a.id)){pausedSeen.add(a.id);if(prev&&!paused)quotaTrips.set(a.id,{dir:'out',t0:now,h:hash(a.id)});if(prev)signal('pause',a.name+' est en pause de limite',p.until?'Retour annoncé à '+hhmm(p.until)+', relance prévue 5 minutes après.':'Heure de retour non annoncée.');}
    else if(!p&&pausedSeen.has(a.id)){pausedSeen.delete(a.id);if(!paused)quotaTrips.set(a.id,{dir:'in',t0:now,h:hash(a.id)});}
  }
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
  const chosen=agents.find(a=>a.boss===true);if(chosen&&agents.length>1)return chosen;
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
    return {W,cols,rows,roomY,H:roomY+(roomOpen()?60:16),top,bossH,areaW,side};
  };
  // En vue globale, la largeur logique suit la forme de la fenêtre : la scène la remplit au lieu de flotter entre deux bandes vides.
  let best=shape(narrow?144:256,false);
  // On retient la disposition qui donne les plus gros pixels (personnages les plus lisibles) ; à égalité, celle qui remplit le mieux le cadre.
  if(fitMode.matches&&!narrow){
    const score=s=>{const k=Math.min(cssW/s.W,cssH/s.H);return k*1000+(s.W*s.H*k*k)/(cssW*cssH);};
    for(const W of [256,288,320,352,384,416,448,480])for(const side of boss&&W>=352?[false,true]:[false]){const s=shape(W,side);if(score(s)>score(best))best=s;}
  }
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
  px(x,y,w,vh-6,mix('#241f38','#3b3459',amb.d*.65));px(x,y,w,1,'#c9a46a',.6);px(x,y,1,vh-6,'#c9a46a',.6);px(x+w-1,y,1,vh-6,'#c9a46a',.6);
  for(let gx=x+4;gx<x+w-4;gx+=8)for(let gy=y+6;gy<y+vh-10;gy+=8)px(gx,gy,1,1,'#30294a');
  const by=y+vh-6;px(x,by,w/2-10,3,'#2c4468');px(cx+10,by,w/2-10,3,'#2c4468');px(x,by,w/2-10,1,'#4a6a94');px(cx+10,by,w/2-10,1,'#4a6a94');
  text('DIRECTION',x+5,y+4,'#c9a46a');
  mailSpot=null;
  if(mailCount){const mx=x+w-22;for(let k=0;k<Math.min(mailCount,5);k++){px(mx,y+8-k*2+20,9,6,'#dfe6ee');px(mx+1,y+9-k*2+20,7,1,'#9aabc1');}text(String(mailCount),mx+11,y+26,'#dfe6ee');mailSpot={x:mx-3,y:y+14,w:22,h:20};}
  if(editLayout){px(x+w-7,by-7,6,6,'#c9a46a');px(x+w-5,by-5,2,2,'#241f38');}
  return {cx,y0:y-6,doorY:by+1};
}
// Lumière du jour, calculée en continu sur l'heure réelle du poste. Lever vers 6 h 30, coucher vers 19 h 30 :
// heures fixes, sans les saisons (approximation assumée). La nuit garde l'identité bleu nuit du bureau.
const SUNRISE=6.5,SUNSET=19.5;
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
function daylight(){
  const t=new Date(),h=t.getHours()+t.getMinutes()/60+t.getSeconds()/3600;
  const d=smooth(SUNRISE-1,SUNRISE+1.5,h)*(1-smooth(SUNSET-1.5,SUNSET+1,h));
  const warm=Math.max(Math.exp(-((h-SUNRISE)**2)/1.1),Math.exp(-((h-SUNSET)**2)/1.1));
  const sun=h>SUNRISE-.6&&h<SUNSET+.6?(h-(SUNRISE-.6))/(SUNSET-SUNRISE+1.2):null;
  const night=24-(SUNSET-SUNRISE),moon=d<.6?((h-SUNSET+24)%24)/night:null;
  return {h,d,warm,sun,moon:moon!=null&&moon<=1?moon:null};
}
const hexRgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
const mix=(a,b,t)=>{const A=hexRgb(a),B=hexRgb(b),k=Math.min(1,Math.max(0,t));return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*k).toString(16).padStart(2,'0')).join('');};
let amb=daylight();
const skyNight=['#0e1d3a','#112347','#142a54','#183260','#1c396b'],skyDay=['#3f75bd','#4d85c7','#5f96d0','#78aad9','#9ac2e4'],skyWarm=['#2a2f62','#51427e','#93608a','#d4867a','#f0b47c'];
function cityWindow(x,y,w,h){
  const {d,warm,sun,moon}=amb;
  px(x-2,y-2,w+4,h+4,'#0b1426');
  skyNight.forEach((c,i)=>px(x,y+Math.floor(i*h/5),w,Math.ceil(h/5)+1,mix(mix(c,skyDay[i],d),skyWarm[i],warm*.85)));
  const r=rng(7),starA=Math.max(0,1-d*1.6);
  for(let i=0;i<w/5;i++){const sx=x+Math.floor(r()*w),sy=y+Math.floor(r()*h*.42),c=r()>.7?'#c9d6f0':'#6f86b3';if(starA>.02)px(sx,sy,1,1,c,starA);}
  // La lune suit son arc pendant la nuit, le soleil le sien pendant le jour : position fidèle à l'heure.
  if(moon!=null){
    const mx=x+3+Math.round(moon*(w-13)),my=y+Math.round(h*.7-Math.sin(Math.PI*moon)*h*.55),a=Math.max(0,1-d*1.8);
    px(mx+1,my,6,8,'#e9e3c6',a);px(mx,my+1,8,6,'#e9e3c6',a);px(mx+2,my+2,2,2,'#cfc8a8',a);px(mx+5,my+5,1,1,'#cfc8a8',a);
  }
  if(sun!=null){
    const sx=x+3+Math.round(sun*(w-12)),sy=y+Math.round(h*.8-Math.sin(Math.PI*sun)*h*.66),c=mix('#ffe7a3','#ff9a5c',warm);
    pool(sx+3,sy+3,9,7,c,.12+.1*d);px(sx+1,sy,4,6,c);px(sx,sy+1,6,4,c);
  }
  const b=rng(11),lit=.78+.18*d;let bx=x;
  while(bx<x+w){
    const bw=6+Math.floor(b()*10),bh=10+Math.floor(b()*h*.55),top=y+h-bh,right=Math.min(bx+bw,x+w),dark=b()>.5;
    px(bx,top,right-bx,bh,mix(dark?'#0a162d':'#0d1b36',dark?'#2a4670':'#32507b',d));
    for(let wy=top+2;wy<y+h-2;wy+=3)for(let wx=bx+1;wx<right-1;wx+=2)if(b()>lit)px(wx,wy,1,1,b()>.25?'#f4c780':'#9dbbff',.5+b()*.5);
    bx=right+(b()>.7?1:0);
  }
  const panes=Math.max(2,Math.round(w/35));
  for(let m=1;m<panes;m++)px(x+Math.round(m*w/panes),y,1,h,'#0b1426');
  px(x,y+Math.round(h*.36),w,1,'#0b1426');
  px(x+5,y+3,1,9,'#ffffff',.07+.06*d);px(x+7,y+3,1,5,'#ffffff',.07+.06*d);
  px(x-4,y+h+2,w+8,2,mix('#2a4166','#4a6890',d));px(x-4,y+h+4,w+8,1,'#0f1a2c');
}
function clock(x,y){
  const t=new Date(),s=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
  px(x,y,25,11,'#0b1426');px(x+1,y+1,23,9,'#101c33');text(s,x+3,y+3,'#a0dfc4');
}
// Tableau d'équipe : uniquement les comptes réels fournis par Herdr.
// Tableau de la scène (proposition P1 d'OpenCode) : seulement des faits absents du reste de la scène,
// les états étant déjà portés par les cartes et les postures. Une ligne s'allume quand son fait est observé.
// Panneau de liège : ouvre le tableau de l'équipe. Ses notes reflètent le nombre réel de tâches ouvertes.
let boardSpot=null,boardData=null;
function cork(x,y){
  px(x-1,y-1,36,28,'#3a2a20');px(x,y,34,26,'#9a6f45');for(let i=0;i<12;i++){const r=rng(31+i);px(x+2+Math.floor(r()*30),y+2+Math.floor(r()*22),1,1,'#7d5835');}
  const open=boardData?.todo?Math.max(0,boardData.todo.total-boardData.todo.done):null,notes=open==null?3:Math.min(6,open);
  const colorsN=['#f4d36b','#a0dfc4','#f2b0c9','#9dbbff'];
  for(let k=0;k<notes;k++){const nx=x+3+(k%3)*10,ny=y+3+Math.floor(k/3)*11;px(nx,ny,8,8,colorsN[k%4]);px(nx+1,ny+3,6,1,'#5a4a3a',.5);px(nx+1,ny+5,4,1,'#5a4a3a',.5);px(nx+3,ny,2,1,'#c0392b');}
  if(open!=null&&open>6)text('+',x+29,y+19,'#f2f4f7');
  boardSpot={x:x-1,y:y-1,w:36,h:28};
}
function board(x,y,w){
  const paused=state.agents.map(quotaPause).filter(Boolean),back=paused.map(q=>q.until).filter(Boolean).sort((a,b)=>a-b)[0];
  const waitingQ=queueItems.filter(q=>q.state==='attente').length,subs=state.agents.reduce((k,a)=>k+(a.activity?.subagents?.length||0),0);
  const rows=[['EN FILE',String(waitingQ),'#9dbbff',waitingQ>0],['COURRIER',String(mailCount),'#a0dfc4',mailCount>0],['SOUS-AGENTS',String(subs),'#c4d2e4',subs>0]];
  if(paused.length)rows.unshift(['RETOUR',back?hhmm(back):'??:??','#b5a8e6',true]);
  const h=rows.length*8+5;boardBottom=y+h;
  px(x,y,w,h,'#0b1426');px(x+1,y+1,w-2,h-2,'#111e33');
  rows.forEach(([name,value,c,on],i)=>{
    const ry=y+4+i*8,v=state.connected?value:'-',lit=state.connected&&on;
    px(x+4,ry+1,3,3,lit?c:'#3a4c65');text(name,x+10,ry,lit?'#c4d2e4':'#71839a');text(v,x+w-4-textWidth(v),ry,lit?'#f2f4f7':'#71839a');
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
// Rayon de soleil entrant par la fenêtre : il se penche selon la position de l'astre et s'efface la nuit.
function sunbeam(L,wx,ww,wy,wh){
  const {d,warm,sun}=amb;if(sun==null||d<.05)return;
  const c=mix('#ffe9a8','#ffb070',warm),lean=(.5-sun)*1.1,top=wy+wh+5,bottom=Math.min(L.roomY-4,L.wallH+46);
  for(let y=top,k=0;y<bottom;y+=2,k+=2){const a=.07*d*(1-k/(bottom-top))+.01;px(wx+6+lean*k,y,ww-12,2,c,a);}
}
function room(L,time){
  const {W,H,wallH,narrow}=L,d=amb.d;
  const wall=mix('#16243d','#3a5683',d*.9),seam=mix('#1a2a46','#42618f',d*.9),floor=mix('#18263c','#344b6e',d*.85),plank=mix('#15223a','#2c4163',d*.85);
  px(0,0,W,wallH,wall);px(0,0,W,3,mix('#0d1729','#1d2f4d',d));
  for(let x=20;x<W;x+=40)px(x,3,1,wallH-9,seam);
  px(0,wallH-6,W,4,mix('#1d2f4d','#36527c',d*.8));px(0,wallH-2,W,2,mix('#2a4166','#4a6890',d*.8));
  px(0,wallH,W,H-wallH,floor);
  for(let y=wallH+3,i=0;y<H;y+=6,i++){px(0,y,W,1,plank);for(let x=i%2?7:27;x<W;x+=40)px(x,y-5,1,5,plank);}
  px(0,wallH,W,1,'#0f1a2c');
  const nightLight=Math.max(0,1-d*1.4);
  if(narrow)boardSpot=null;
  if(narrow){cityWindow(6,10,58,44);sunbeam(L,6,58,10,44);board(70,10,68);clock(70,44);if(nightLight)glow(35,wallH+8,16,'#9dbbff',.7*nightLight);}
  else{
    cityWindow(8,10,112,50);sunbeam(L,8,112,10,50);if(nightLight)glow(64,wallH+9,26,'#9dbbff',.7*nightLight);
    board(128,12,64);clock(198,12);neon('BUREAU DE DRSMOKE',128,Math.max(50,boardBottom+5),'#a0dfc4');
    if(W>=352)cork(W-96,14);else boardSpot=null;
    plant(W-52,wallH+4);rack(W-26,16,wallH+6,time);plant(1,wallH+6);
  }
  const v=.12*(1-.6*d);
  for(let i=0;i<3;i++){px(0,0,2+i*2,H,'#050a14',v);px(W-2-i*2,0,2+i*2,H,'#050a14',v);px(0,0,W,1+i,'#050a14',v);}
  // Suspensions du plafond : allumées dès que le jour baisse, comme dans un vrai bureau en soirée.
  const lamp=lampLevel();
  for(let x=narrow?36:44;x<W-20;x+=narrow?72:88){
    px(x,0,1,8,'#0d1729');px(x-4,8,9,3,mix('#24344f','#3a4d6b',d));px(x-5,11,11,1,'#1a2740');
    if(lamp>.02){px(x-3,12,7,1,'#ffe2a8',.35+.65*lamp);glow(x,wallH+20,30,'#ffd89a',1.1*lamp);px(x-14,13,29,wallH-10,'#ffd89a',.025*lamp);}
  }
}
// Éclairage intérieur, sur l'heure du poste : allumé de 17 h 30 (pleine puissance à 19 h) jusqu'au matin,
// éteint progressivement entre le lever et 8 h. Le bureau s'éclaire avant la nuit noire, comme un vrai.
const lampLevel=()=>{const h=amb.h;return h<12?1-smooth(SUNRISE,SUNRISE+1.5,h):smooth(SUNSET-2,SUNSET-.5,h);};
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
  if(live)glow(cx-13,y0+46,14,c,(work?1.4:wait?1.2:.8)*(1-.45*amb.d));
  px(cx-25,y0+55,50,3,'#0a1322',.55);
  px(cx-3,y0+15,16,16,'#22324f');px(cx-2,y0+16,14,14,'#2a3c5e');
  const pause=live&&quotaPause(a);
  const pose=pause?'sleep':work?'work':wait?'wait':st==='done'&&live?'happy':'rest',x=cx-1,away=a&&(awayAgents.has(a.id)||Boolean(pause)||quotaTrips.get(a.id)?.dir==='in');
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
  // Lampe de bureau : s'allume le soir pour un agent présent ; éteinte s'il est parti en pause de limite.
  const lamp=lampLevel(),lampOn=live&&!away&&lamp>.02;
  px(cx+19,y0+29,5,1,'#2a3247');px(cx+21,y0+22,1,7,'#3a4560');px(cx+18,y0+20,7,2,lampOn?'#e8c47e':'#4a5570');
  if(lampOn){px(cx+19,y0+22,5,1,'#fff1c9',.6+.4*lamp);glow(cx+12,y0+31,16,'#ffd89a',1.3*lamp);}
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
    // L'agent a quitté son poste : écran éteint, voyant de veille, chevalet avec son heure de retour.
    px(cx-21,y0+16,15,10,'#070d18');
    const glowOn=paused||Math.floor(time/900)%2===0;px(cx-8,y0+27,1,1,'#b5a8e6',glowOn?1:.35);
    px(cx+1,y0+15,27,15,'#0b1426');px(cx+2,y0+16,25,13,'#dfe6ee');px(cx+5,y0+29,2,2,'#7a604f');px(cx+22,y0+29,2,2,'#7a604f');
    // Le chevalet alterne l'heure de retour annoncée et le temps restant, recalculé sur l'heure du poste.
    const left=pause.until?Math.max(0,Math.round((pause.until-Date.now())/60000)):null,showLeft=left!=null&&!paused&&Math.floor(time/3000)%2===1;
    const sign=showLeft?(left<60?left+'MIN':Math.floor(left/60)+'H'+String(left%60).padStart(2,'0')):pause.until?hhmm(pause.until):'??:??';
    text(showLeft?'DANS':'RETOUR',cx+2+Math.floor((25-textWidth(showLeft?'DANS':'RETOUR'))/2),y0+17,'#0c1423');text(sign,cx+2+Math.floor((25-textWidth(sign))/2),y0+23,'#5b4a9e');
  }
  // Proposition P2 d'OpenCode : le nom seul sous le bureau, souligné de la couleur d'état. Hors ligne, on le dit.
  if(!state.connected)text(status,cx-textWidth(status)/2,y0+67,'#71839a');
  else px(cx-Math.min(10,textWidth(name)/2),y0+67,Math.min(20,textWidth(name)),1,c,.9);
  if(chosen)px(cx-9,y0+70,18,1,'#a0dfc4');
  if(a===L.boss&&vipRect)spots.push({x:vipRect.x*L.S,y:vipRect.y*L.S,w:vipRect.w*L.S,h:vipRect.h*L.S,id:a.id});
  else spots.push({x:(cx-L.cw/2)*L.S,y:y0*L.S,w:L.cw*L.S,h:L.rowH*L.S,id:a.id});
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
// Salle de réflexion ouverte seulement quand un sous-agent est actif ou encore en déplacement ; sinon une bande discrète.
function roomOpen(){return (typeof actors!=='undefined'&&actors.size>0)||state.agents.some(a=>a.activity?.subagents?.length);}
function meetingRoom(L,time){
  const {roomY,W,H}=L,G=meetingGeometry(L);
  if(!roomOpen()){
    px(0,roomY,W,H-roomY,mix('#1a2740','#344b6e',amb.d*.85));px(0,roomY,W,3,'#2c4468');px(0,roomY,W,1,'#4a6a94');
    text(L.narrow?'REFLEXION':'SALLE DE REFLEXION',G.doorX+18,roomY+6,'#5d7190');return G;
  }
  px(0,roomY,W,H-roomY,mix('#1a2740','#344b6e',amb.d*.85));
  for(let x=4;x<W;x+=12)for(let y=roomY+6;y<H;y+=8)px(x+((y>>3)%2)*6,y,1,1,'#22324d');
  // Cloison vitrée avec une porte à gauche.
  px(G.doorX+12,roomY,W-G.doorX-12,3,'#2c4468');px(G.doorX+12,roomY,W-G.doorX-12,1,'#4a6a94');
  px(0,roomY,G.doorX,3,'#2c4468');px(G.doorX-1,roomY-1,2,5,'#4a6a94');px(G.doorX+11,roomY-1,2,5,'#4a6a94');
  // Libellé fixe (proposition P4 d'OpenCode) : jamais tronqué ; le nombre de sous-agents est au tableau.
  text(L.narrow?'REFLEXION':'SALLE DE REFLEXION',G.doorX+18,roomY+6,'#8fa3c0');
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
const awayAgents=new Set(),officeActors=new Map(),seenDelegations=new Set(),mailLog=[];let officeBooted=false,mailCount=0,mailSpot=null,mailTotal=0,mailShown='';
// Mémoire bornée : on oublie les plus anciens identifiants vus, que le journal du chef (12 h) ne renverra plus.
function remember(key){seenDelegations.add(key);if(seenDelegations.size>500)seenDelegations.delete(seenDelegations.values().next().value);}
// Courrier du chef : les délégations réellement observées dans son journal (12 h),
// avec l'heure du dernier envoi observé. Le champ result ne parle QUE de l'envoi :
// jamais une réussite de travail non confirmée n'est affichée.
function resultLabel(result){
  if(result&&result.ok===true)return 'Envoi confirmé par Herdr ; le résultat du travail reste à vérifier dans ses sorties.';
  if(result&&result.ok===false)return 'Envoi en échec ; revoyez cette consigne avant tout autre envoi.';
  return 'Envoi non confirmé ; vérifie le terminal avant de conclure.';
}
function renderMail(){
  const list=$('mail-list');
  const delegs=state.agents.flatMap(a=>(Array.isArray(a.delegations)?a.delegations:[]).map(d=>({d,a})))
    .filter(({d})=>d&&d.at&&!Number.isNaN(new Date(d.at))&&Date.now()-new Date(d.at)<=12*3600*1000)
    .sort((x,y)=>new Date(y.d.at)-new Date(x.d.at));
  // Même affichage, même dessin : la liste n'est pas rebâtie pour rien.
  const signature=JSON.stringify([delegs.map(({d})=>[d.id,d.at,d.target,d.title,d.result]),state.agents.map(a=>a.id+a.name)]);
  if(signature===mailShown)return;mailShown=signature;
  $('mail-count').textContent=delegs.length?'dernier envoi observé à '+hhmm(new Date(delegs[0].d.at)):'';
  if(!delegs.length){const li=document.createElement('li');li.className='list-placeholder';li.textContent='Aucune délégation observée sur les 12 dernières heures.';list.replaceChildren(li);return;}
  list.replaceChildren(...delegs.slice(0,30).map(({d})=>{
    const li=document.createElement('li');li.className='mail';
    const cible=agentByTarget(d.target);
    const head=document.createElement('span');head.className='log-head';
    head.textContent=hhmm(new Date(d.at))+' · vers '+(cible?cible.name:d.target);
    const body=document.createElement('span');body.className='log-body';
    body.textContent=d.title?'Tâche déléguée : '+d.title:'Consigne envoyée, contenu non lisible dans le journal.';
    const why=document.createElement('span');why.className='log-why';why.textContent=resultLabel(d.result);
    const open=document.createElement('button');open.type='button';open.className='tool-button';open.textContent='Ouvrir son poste';
    open.hidden=!cible;
    open.addEventListener('click',()=>{if(cible&&state.agents.some(x=>x.id===cible.id))selectAgent(cible.id);showTab('poste');});
    // P1 : copie de la délégation OBSERVÉE, jamais « copier la réponse » : ce
    // contenu n'est pas une réponse d'agent. Les champs copiés sont nommés.
    const copier=document.createElement('button');copier.type='button';copier.className='tool-button';copier.textContent='Copier la délégation';
    const aide='Copie la délégation observée : cible, heure, titre de la tâche, état d\'envoi.';
    copier.title=aide;copier.setAttribute('aria-label',aide);
    copier.addEventListener('click',()=>{
      const texte=[
        'Cible : '+(cible?cible.name+' ('+d.target+')':d.target),
        'Heure : '+new Date(d.at).toLocaleString('fr-FR'),
        'Tâche déléguée : '+(d.title||'non lisible dans le journal'),
        'État d\'envoi : '+resultLabel(d.result),
      ].join('\n');
      copyText(texte,'Délégation de '+hhmm(new Date(d.at)),copier);
    });
    const actions=document.createElement('span');actions.className='log-actions';actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;';
    actions.append(open,copier);
    li.append(head,body,why,actions);return li;
  }));
}
function agentByTarget(target){
  return state.agents.find(a=>a.paneId===target||a.name?.toLowerCase()===String(target).toLowerCase());
}
function syncOffice(L,now){
  if(!state.connected||!L.boss)return;
  for(const d of L.boss.delegations||[]){
    const dk=d.id+'|'+d.target;if(seenDelegations.has(dk))continue;
    // En pause, la délégation n'est pas marquée vue : la tournée partira à la reprise de l'animation.
    if(officeBooted&&paused)continue;
    remember(dk);
    const t=agentByTarget(d.target);
    if(!officeBooted||!t||t===L.boss)continue;
    officeActors.set('deleg|'+dk,{type:'deleg',agent:t.id,t0:now,h:hash(t.id),title:d.title});
    signal('delegation',null);
  }
  for(const a of state.agents){
    if(a===L.boss)continue;
    const c=changes.get(a.id);
    if(!c||!WORK.includes(c.from)||!FREE.includes(c.to))continue;
    const key='mail|'+a.id+'|'+Math.round(c.at);
    if(officeActors.has(key)||seenDelegations.has(key))continue;remember(key);
    if(!officeBooted)continue;
    const deleg=(L.boss.delegations||[]).filter(d=>agentByTarget(d.target)===a).at(-1);
    mailLog.unshift({agentId:a.id,name:a.name,at:new Date(),from:c.from,to:c.to,title:deleg?.title||null});mailLog.length=Math.min(mailLog.length,30);mailTotal++;renderMail();
    signal('mail',a.name+' a terminé',(deleg?.title?'Tâche : '+deleg.title+'. ':'')+'Résultat à vérifier dans ses sorties.');
    if(!paused)officeActors.set(key,{type:'mail',agent:a.id,t0:now});else mailCount++;
  }
  officeBooted=true;
}
function drawOffice(L,vip,time,now){
  awayAgents.clear();let bossBusy=false;
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
    // Délégation observée : le chef se lève, sort de la Direction, porte le dossier jusqu'au poste de l'agent,
    // le pose sur son bureau, puis revient s'asseoir. Une seule tournée à la fois : les suivantes attendent.
    if(bossBusy){act.t0=now;continue;}
    bossBusy=true;
    // Scène en pause : la tournée se fige ; à la reprise, l'horloge de marche est décalée de la durée de pause.
    if(paused)act.pausedAt??=now;
    else if(act.pausedAt!=null){act.t0+=now-act.pausedAt;act.pausedAt=null;}
    const clock=act.pausedAt??now;
    const bossSpot=[boss.cx-30,boss.y0+55],door=[boss.cx,vip.doorY+4],stand=[d.cx+29,d.y0+55];
    const there=[bossSpot,[door[0],bossSpot[1]],door,[stand[0],door[1]],[stand[0],stand[1],1800]];
    const back=[stand,[stand[0],door[1]],door,[door[0],bossSpot[1]],bossSpot];
    const speed=34+(act.h%8),goT=clock-act.t0;
    let p=walk(there,goT,speed),returning=false;
    if(p.done){p=walk(back,goT-act.goDur,speed);returning=true;}
    else act.goDur=goT+1;
    if(returning&&p.done){officeActors.delete(key);continue;}
    awayAgents.add(L.boss.id);
    // Remise : le dossier apparaît sur le bureau de l'agent, avec le titre de la tâche s'il est connu.
    if(p.pause||returning){px(d.cx+4,d.y0+26,8,5,'#c9a46a');px(d.cx+4,d.y0+26,8,1,'#e0c08a');px(d.cx+5,d.y0+28,5,1,'#8a6a40');}
    if(p.pause&&act.title){const t=fit(act.title,Math.min(110,L.W-8)),tx=Math.max(2,Math.min(L.W-textWidth(t)-6,d.cx-textWidth(t)/2));px(tx-3,d.y0-3,textWidth(t)+6,9,'#0b1426');text(t,tx,d.y0-1,'#f4d36b');}
    walkingHelper(Math.round(p.x),Math.round(p.y),hash(L.boss.id),p.moving,time,returning?null:'aller',colors[Math.max(0,state.agents.indexOf(L.boss))%colors.length]);
  }
}
// Pause de quota : l'agent éteint son écran et quitte le bureau par la gauche, batterie vide ;
// au retour observé, il revient batterie pleine et se rassoit. Scène en pause : pas de trajet.
function drawQuotaTrips(L,time,now){
  for(const [id,trip] of quotaTrips){
    const d=deskSpots.get(id),a=state.agents.find(x=>x.id===id);
    if(!d||!a||paused){quotaTrips.delete(id);continue;}
    const stand=[d.cx+29,d.y0+55],lane=L.roomY-3,path=[stand,[stand[0],lane],[-8,lane]];
    const p=walk(trip.dir==='out'?path:[...path].reverse(),now-trip.t0,30+(trip.h%6));
    if(p.done){quotaTrips.delete(id);continue;}
    const x=Math.round(p.x),y=Math.round(p.y);
    walkingHelper(x,y,trip.h,p.moving,time,null,colors[Math.max(0,state.agents.indexOf(a))%colors.length]);
    // Batterie au-dessus de la tête : vide au départ, pleine au retour.
    const full=trip.dir==='in',bx=x-4,by=y-32;
    px(bx,by,8,5,'#0b1426');px(bx+8,by+1,1,3,'#0b1426');px(bx+1,by+1,6,3,'#1a2740');
    px(bx+1,by+1,full?6:1,3,full?'#a0dfc4':'#ff8a7a');
  }
}
function draw(time){
  const L=layout(),key=L.W+'x'+L.H+'@'+L.S,now=performance.now();
  if(key!==layoutKey){layoutKey=key;off.width=L.W;off.height=L.H;canvas.width=L.W*L.S;canvas.height=L.H*L.S;canvas.parentElement.style.aspectRatio=L.W+' / '+L.H;}
  spots=[];g.clearRect(0,0,L.W,L.H);trackChanges();amb=daylight();
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
    if(editLayout&&a){const hw=Math.min(31,Math.floor(L.cw/2)-1);px(cx-hw,y0+4,hw*2,1,'#a0dfc4',.6);px(cx-hw,y0+77,hw*2,1,'#a0dfc4',.6);px(cx-hw,y0+4,1,74,'#a0dfc4',.6);px(cx+hw-1,y0+4,1,74,'#a0dfc4',.6);}
  });
  syncActors(L,now);syncOffice(L,now);
  drawActors(L,G,time,now,'back');if(roomOpen())tableTop(G);drawActors(L,G,time,now,'side');drawActors(L,G,time,now,'front');
  drawOffice(L,vip,time,now);drawQuotaTrips(L,time,now);
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
  if(boardSpot){const p=toLogical(event);if(p.x>=boardSpot.x&&p.x<=boardSpot.x+boardSpot.w&&p.y>=boardSpot.y&&p.y<=boardSpot.y+boardSpot.h){openBoard();return;}}
  if(onMail(event)){mailCount=0;draw(lastFrame);showTab('equipe');$('mailbox').scrollIntoView({block:'start'});$('mailbox').classList.remove('flash');void $('mailbox').offsetWidth;$('mailbox').classList.add('flash');return;}
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
addEventListener('keydown',e=>{
  // Disposer au clavier : les flèches déplacent le poste sélectionné (Maj pour un grand pas).
  // Elles restent aux onglets, listes et champs qui les traitent déjà ; Échap est géré avec les autres couches.
  if(!editLayout||!lastLayout||!/^Arrow/.test(e.key)||e.defaultPrevented||e.isComposing||!$('palette').hidden)return;
  const t=document.activeElement;if(/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName||'')||t?.isContentEditable||t?.closest?.('[role="tab"],[role="listbox"],.help'))return;
  const a=activeAgent(),L=lastLayout,f=floorBox(L),step=e.shiftKey?10:2,d=a&&deskSpots.get(a.id);if(!d)return;
  e.preventDefault();
  const dx={ArrowLeft:-step,ArrowRight:step}[e.key]||0,dy={ArrowUp:-step,ArrowDown:step}[e.key]||0;
  if(a===L.boss&&vipRect)custom.vip={fx:(vipRect.x+vipRect.w/2+dx)/L.W,fy:(vipRect.y+dy-f.top)/f.h,fw:vipRect.w/L.W,fh:vipRect.h/f.h};
  else custom.stations[layoutKeyOf(a)]={fx:(d.cx+dx)/L.W,fy:(d.y0+dy-f.top)/f.h};
  saveLayout();draw(lastFrame);
});
canvas.addEventListener('mousemove',event=>{const id=spotAt(event)?.id||null,mail=onMail(event);canvas.style.cursor=editLayout?'move':id||mail?'pointer':'default';const onBoard=boardSpot&&(()=>{const p=toLogical(event);return p.x>=boardSpot.x&&p.x<=boardSpot.x+boardSpot.w&&p.y>=boardSpot.y&&p.y<=boardSpot.y+boardSpot.h;})();if(onBoard&&!editLayout)canvas.style.cursor='pointer';canvas.title=mail?'Courrier du chef : voir qui a terminé':onBoard?'Tableau de l’équipe':'';if(id!==hovered){hovered=id;draw(lastFrame);}});
canvas.addEventListener('mouseleave',()=>{if(hovered){hovered=null;draw(lastFrame);}});
new ResizeObserver(()=>draw(lastFrame)).observe(canvas.parentElement);
$('fullscreen').hidden=!document.fullscreenEnabled;
$('fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else document.querySelector('main').requestFullscreen().catch(()=>{});});
document.addEventListener('fullscreenchange',()=>{const on=Boolean(document.fullscreenElement);$('fullscreen').setAttribute('aria-pressed',String(on));$('fullscreen').querySelector('span').textContent=on?'Quitter le plein écran':'Plein écran';draw(lastFrame);});
// L'onglet signale les agents qui attendent DrSmoke, même quand la page est en arrière-plan.
function attentionTitle(){const n=state.connected?state.agents.filter(a=>WAIT.includes(a.status)).length:0,title=(n?'('+n+') ':'')+'Bureau des agents · DrSmoke';if(document.title!==title)document.title=title;}
// Figée, la scène se redessine encore chaque minute pour suivre l'heure et la lumière.
function frame(time){if(time-lastFrame>(paused?60000:80)){draw(time);lastFrame=time;}requestAnimationFrame(frame);}
// Signaux : notification Windows quand la page est en arrière-plan, son 8 bits si DrSmoke l'a activé (public/sounds.js).
const prefs={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}}};
function signal(kind,title,body){
  if(window.BureauSounds?.enabled)try{window.BureauSounds.play(kind);}catch{}
  if(!title||prefs.get('bureau.notifs')!=='on'||typeof Notification==='undefined'||Notification.permission!=='granted'||!document.hidden)return;
  try{const n=new Notification(title,{body,tag:'bureau-'+kind});n.onclick=()=>{focus();n.close();};}catch{}
}
function syncSignals(){
  const notif=prefs.get('bureau.notifs')==='on'&&typeof Notification!=='undefined'&&Notification.permission==='granted';
  $('notif-toggle').setAttribute('aria-pressed',String(notif));$('notif-toggle').textContent='Notifications Windows : '+(notif?'activées':typeof Notification!=='undefined'&&Notification.permission==='denied'?'refusées par le navigateur':'désactivées');
  const snd=Boolean(window.BureauSounds?.enabled);$('sound-toggle').setAttribute('aria-pressed',String(snd));$('sound-toggle').textContent=window.BureauSounds?'Sons : '+(snd?'activés':'désactivés'):'Sons : module absent';$('sound-toggle').disabled=!window.BureauSounds;
}
$('notif-toggle').addEventListener('click',async()=>{
  if(typeof Notification==='undefined')return;
  if(prefs.get('bureau.notifs')==='on')prefs.set('bureau.notifs','off');
  else if((await Notification.requestPermission())==='granted')prefs.set('bureau.notifs','on');
  syncSignals();
});
$('sound-toggle').addEventListener('click',()=>{if(!window.BureauSounds)return;window.BureauSounds.setEnabled(!window.BureauSounds.enabled);if(window.BureauSounds.enabled)window.BureauSounds.play('mail');syncSignals();});
syncSignals();
// Aide : panneau latéral, ouvert seul à la première visite, puis par le bouton ou la touche « ? ».
function toggleHelp(open=$('help').hidden){
  $('help').hidden=!open;$('help-open').setAttribute('aria-expanded',String(open));
  if(open){$('help-close').focus();try{localStorage.setItem('bureau.aideVue','1');}catch{}}else $('help-open').focus();
}
$('help-open').addEventListener('click',()=>toggleHelp());
$('help-close').addEventListener('click',()=>toggleHelp(false));
// Première visite : l'aide ne s'ouvre pas si DrSmoke a déjà commencé une action (clic, touche, palette).
let acted=false;for(const ev of ['pointerdown','keydown'])addEventListener(ev,()=>{acted=true;},{once:true,capture:true});
try{if(!localStorage.getItem('bureau.aideVue'))setTimeout(()=>{if(!acted&&$('palette').hidden)toggleHelp(true);},900);}catch{}
// Palette de commandes (Ctrl+K) : toutes les actions du bureau au clavier, construites à partir des agents réels.
let paletteIndex=0,paletteItems=[];
function commands(){
  const list=[];
  for(const a of state.agents){
    list.push({label:'Ouvrir le poste de '+a.name,hint:label(a),run:()=>{selectAgent(a.id);showTab('poste');}});
    if(canSend(a)||canQueue(a))list.push({label:(canSend(a)?'Écrire à ':'Mettre une consigne en file pour ')+a.name,hint:label(a),run:()=>{selectAgent(a.id);showTab('poste');setTimeout(()=>$('message').focus(),50);}});
    // La sélection rouvre l'onglet Poste au tour suivant : on passe aux fichiers juste après.
    list.push({label:'Fichiers de '+a.name,hint:'Fichiers',run:()=>{selectAgent(a.id);setTimeout(()=>showTab('fichiers'),0);}});
  }
  list.push({label:'Message à plusieurs agents',hint:'Équipe',run:()=>{showTab('equipe');setTimeout(()=>$('broadcast-message').focus(),50);}});
  list.push({label:'Courrier du chef',hint:'Équipe',run:()=>{showTab('equipe');$('mailbox').scrollIntoView({block:'start'});}});
  list.push({label:'File d’attente',hint:'Équipe',run:()=>{showTab('equipe');$('queue-list').scrollIntoView({block:'start'});}});
  list.push({label:'Tableau de l’équipe',hint:'Mémoire partagée',run:()=>setTimeout(openBoard,0)});
  list.push({label:'Tâches du projet et des agents',hint:'Tâches',run:()=>showTab('taches')});
  list.push({label:editLayout?'Terminer la disposition':'Disposer les postes',hint:'Scène',run:()=>{editLayout=!editLayout;syncLayoutEdit();}});
  list.push({label:paused?'Animer le bureau':'Mettre le bureau en pause',hint:'Scène',run:()=>$('motion').click()});
  if(document.fullscreenEnabled)list.push({label:'Plein écran',hint:'Scène',run:()=>$('fullscreen').click()});
  list.push({label:'Actualiser les agents',hint:'Herdr',run:()=>$('refresh').click()});
  list.push({label:'Aide',hint:'?',run:()=>toggleHelp(true)});
  return list;
}
const fold2=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function renderPalette(){
  const q=fold2($('palette-input').value.trim()),words=q.split(/\s+/).filter(Boolean);
  paletteItems=commands().filter(c=>words.every(w=>fold2(c.label+' '+c.hint).includes(w))).slice(0,12);
  paletteIndex=Math.min(paletteIndex,Math.max(0,paletteItems.length-1));
  $('palette-list').replaceChildren(...(paletteItems.length?paletteItems.map((c,i)=>{
    const li=document.createElement('li');li.role='option';li.id='cmd-'+i;li.setAttribute('aria-selected',String(i===paletteIndex));
    const t=document.createElement('span');t.textContent=c.label;const h=document.createElement('small');h.textContent=c.hint;li.append(t,h);
    li.addEventListener('mousedown',e=>{e.preventDefault();runCommand(i);});return li;
  }):[Object.assign(document.createElement('li'),{className:'list-placeholder',textContent:'Aucune commande ne correspond.'})]));
  $('palette-input').setAttribute('aria-activedescendant',paletteItems.length?'cmd-'+paletteIndex:'');
}
// Palette modale : fond inerte pendant son ouverture, focus rendu au déclencheur ou à la destination de la commande.
let paletteTrigger=null;
const backdrop=(keep=$('palette'))=>[...document.body.children].filter(el=>el!==keep&&el.tagName!=='SCRIPT');
function openPalette(){
  paletteTrigger=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
  for(const el of backdrop())el.inert=true;
  $('palette').hidden=false;$('palette-input').value='';paletteIndex=0;renderPalette();$('palette-input').focus();
}
function closePalette(restore=true){
  $('palette').hidden=true;for(const el of backdrop())el.inert=false;
  if(restore)(paletteTrigger?.isConnected?paletteTrigger:$('palette-open')).focus({preventScroll:true});
}
// Direction de l'équipe : le chef vient de la règle (premier panneau) ou d'un choix de DrSmoke.
// Le bureau propose une passation quand le chef est en pause de quota ; il ne décide jamais seul.
let directionBusy=false,handoff=null;
function renderDirection(){
  const on=state.connected&&state.agents.length>1,boss=on?bossOf(state.agents):null,d=state.direction;
  $('direction-now').textContent=!on?'Il faut au moins deux agents connectés pour une direction.':
    boss.name+' dirige l’équipe'+(d?.source==='choix'?' sur ton choix'+(d.since?' depuis '+hhmm(new Date(d.since)):''):' (règle : premier panneau démarré)')+'.'+(quotaPause(boss)?' En pause de limite actuellement.':'');
  const pick=$('direction-pick'),others=on?state.agents.filter(a=>a!==boss):[],key=others.map(a=>a.id+label(a)).join('|');
  if(pick.dataset.key!==key){const keep=pick.value;pick.dataset.key=key;pick.replaceChildren(...others.map(a=>Object.assign(document.createElement('option'),{value:a.id,textContent:a.name+' · '+label(a).toLowerCase()})));if(others.some(a=>a.id===keep))pick.value=keep;}
  $('direction-set').disabled=!others.length||directionBusy;pick.disabled=!others.length;
  $('direction-reset').hidden=d?.source!=='choix';$('direction-reset').disabled=directionBusy;
  // Proposition dans le bandeau d'attention : chef en pause, au moins un suppléant disponible.
  const free=on&&quotaPause(boss)?others.find(canSend):null,banner=$('direction-banner');
  if(free&&banner?.dataset.target!==free.id){
    const box=banner||Object.assign(document.createElement('div'),{id:'direction-banner',className:'direction-banner'});box.setAttribute('role','status');box.dataset.target=free.id;
    const p=document.createElement('span');p.textContent=boss.name+' est en pause de limite. Confier la direction à '+free.name+' ?';
    const go=document.createElement('button');go.type='button';go.className='tool-button';go.textContent='Voir la proposition';
    go.addEventListener('click',()=>{showTab('equipe');$('direction-pick').value=free.id;$('direction').scrollIntoView({block:'start'});$('direction-set').focus({preventScroll:true});});
    box.replaceChildren(p,go);if(!banner)document.querySelector('.office-frame').after(box);
  }else if(!free&&banner)banner.remove();
}
function directionMessage(from,to){
  return 'Passation de direction décidée par DrSmoke : '+to.name+' coordonne désormais l’équipe'+(from?' à la place de '+from.name:'')+'. Lis AGENTS.md, HANDOFF.md et TODO.md, puis réponds avec ton plan.';
}
async function setDirection(agentId){
  directionBusy=true;renderDirection();$('direction-result').hidden=true;const before=bossOf(state.agents);
  try{
    await request('/api/direction',agentId?{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({agentId})}:{method:'DELETE',headers:{'X-Bureau-Token':state.token}});
    await refreshState();
    const now=bossOf(state.agents);
    $('direction-result').className='files-result';$('direction-result').textContent=now?now.name+' dirige maintenant l’équipe. Aucun message n’a été envoyé.':'Direction mise à jour.';$('direction-result').hidden=false;
    // Passation : message écrit par le bureau, relu et envoyé (ou non) par DrSmoke.
    if(now&&before&&now.id!==before.id){handoff={to:now.id};$('direction-message').value=directionMessage(before,now);$('direction-handoff').hidden=false;$('direction-message').focus({preventScroll:true});}
  }catch(error){$('direction-result').className='files-result error';$('direction-result').textContent=errorText(error);$('direction-result').hidden=false;}
  finally{directionBusy=false;renderDirection();}
}
$('direction-set').addEventListener('click',()=>{const id=$('direction-pick').value;if(id)setDirection(id);});
$('direction-reset').addEventListener('click',()=>setDirection(null));
$('direction-skip').addEventListener('click',()=>{handoff=null;$('direction-handoff').hidden=true;$('direction-set').focus({preventScroll:true});});
$('direction-send').addEventListener('click',async()=>{
  const a=handoff&&state.agents.find(x=>x.id===handoff.to),message=$('direction-message').value.trim();if(!a||!message)return;
  $('direction-send').disabled=true;
  try{
    // Agent disponible : envoi direct ; sinon la passation attend dans la file, en tête.
    const direct=canSend(a),data=direct?await request('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({id:a.id,message})})
      :await request('/api/queue',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({id:a.id,message,priority:'haute'})});
    if(direct)logSend([a.name],message,'sent',data.message||'Consigne transmise à Herdr.');else loadQueue();
    $('direction-result').className='files-result';$('direction-result').textContent=direct?'Passation transmise à '+a.name+'.':'Passation mise en file, en tête, pour '+a.name+'.';$('direction-result').hidden=false;
    handoff=null;$('direction-handoff').hidden=true;
  }catch(error){if(canSend(a))logSend([a.name],message,outcomeOf(error),errorText(error));$('direction-result').className='files-result error';$('direction-result').textContent=errorText(error);$('direction-result').hidden=false;}
  finally{$('direction-send').disabled=false;}
});
// Tableau de l'équipe : fenêtre modale en lecture seule, alimentée par /api/tableau.
let boardTrigger=null;
async function loadBoard(){
  if(!state.connected||!state.token)return null;
  try{boardData=await request('/api/tableau',{headers:{'X-Bureau-Token':state.token}});}catch(error){boardData=null;throw error;}
  return boardData;
}
function boardCard(title,source,items,wide){
  const sec=document.createElement('section');sec.className='board-card'+(wide?' wide':'');
  const h=document.createElement('h3');h.textContent=title;
  const f=boardData?.files?.find(x=>x.name===source),src=document.createElement('p');src.className='board-source';
  src.textContent=source+(f?' · modifié '+ago(f.modified):'');
  const ul=document.createElement('ul');for(const t of items){const li=document.createElement('li');li.textContent=t;ul.append(li);}
  sec.append(h,src,items.length?ul:Object.assign(document.createElement('p'),{textContent:'Rien à afficher dans ce fichier.'}));return sec;
}
function renderBoard(){
  const b=boardData,cards=[];
  if(b?.focus)cards.push(boardCard('Étape en cours : '+b.focus.title,'HANDOFF.md',b.focus.items,true));
  if(b?.todo)cards.push(boardCard('À faire · '+b.todo.done+' sur '+b.todo.total+' cochées','TODO.md',b.todo.remaining));
  if(b?.roles)cards.push(boardCard('Rôles de l’équipe','AGENTS.md',b.roles.items));
  if(b?.lessons)cards.push(boardCard('Dernières leçons · '+b.lessons.total+' au total','LESSONS.md',b.lessons.latest,true));
  if(cards.length)$('board-body').replaceChildren(...cards);
  else{const box=document.createElement('div');$('board-body').replaceChildren(box);errorBlock(box,'Aucun fichier pilier lisible dans le projet.','taches',reloadBoard);}
}
async function openBoard(){
  boardTrigger=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
  for(const el of backdrop($('board')))el.inert=true;
  $('board').hidden=false;$('board-close').focus();
  if(!boardData)$('board-body').replaceChildren(Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:'Lecture du tableau…'}));
  await reloadBoard();
}
async function reloadBoard(){
  try{await loadBoard();renderBoard();}catch(error){const box=document.createElement('div');$('board-body').replaceChildren(box);errorBlock(box,errorText(error),'taches',reloadBoard);}
  if(!$('board').hidden&&!$('board').contains(document.activeElement))$('board-close').focus({preventScroll:true});
}
function closeBoard(){
  $('board').hidden=true;for(const el of backdrop($('board')))el.inert=false;
  (boardTrigger?.isConnected?boardTrigger:$('board-open')).focus({preventScroll:true});
}
$('board-open').addEventListener('click',openBoard);
$('board-close').addEventListener('click',closeBoard);
$('board').addEventListener('mousedown',e=>{if(e.target===$('board'))closeBoard();});
document.addEventListener('keydown',e=>{if($('board').hidden)return;if(e.key==='Tab'){const f=[...$('board').querySelectorAll('button,[tabindex]')].filter(x=>!x.disabled);const i=f.indexOf(document.activeElement);if(i<0||(e.shiftKey?i===0:i===f.length-1)){e.preventDefault();f[e.shiftKey?f.length-1:0]?.focus();}}});
function runCommand(i){
  const c=paletteItems[i];closePalette(!c);if(!c)return;c.run();
  // Une commande qui ne place pas le focus elle-même le laisse sur l'onglet ouvert.
  setTimeout(()=>{const f=document.activeElement;if(!f||f===document.body||$('palette').contains(f))$('tab-'+currentTab())?.focus({preventScroll:true});},80);
}
$('palette-open').addEventListener('click',openPalette);
$('palette').addEventListener('mousedown',e=>{if(e.target===$('palette'))closePalette();});
$('palette-input').addEventListener('input',()=>{paletteIndex=0;renderPalette();});
$('palette-input').addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'){e.preventDefault();paletteIndex=(paletteIndex+1)%Math.max(1,paletteItems.length);renderPalette();}
  else if(e.key==='ArrowUp'){e.preventDefault();paletteIndex=(paletteIndex-1+paletteItems.length)%Math.max(1,paletteItems.length);renderPalette();}
  else if(e.key==='Enter'){e.preventDefault();runCommand(paletteIndex);}
  else if(e.key==='Tab')e.preventDefault();
});
// Une seule couche répond à une touche : palette, puis disposition, puis aide.
addEventListener('keydown',e=>{
  const typing=/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&$('board').hidden){e.preventDefault();$('palette').hidden?openPalette():closePalette();return;}
  if(!$('palette').hidden){if(e.key==='Escape'){e.preventDefault();closePalette();}return;}
  if(!$('board').hidden){if(e.key==='Escape'){e.preventDefault();closeBoard();}return;}
  if(e.key==='Escape'&&editLayout){editLayout=false;syncLayoutEdit();return;}
  if(e.key==='Escape'&&!$('help').hidden)toggleHelp(false);
  else if(e.key==='?'&&!typing&&!e.isComposing){e.preventDefault();toggleHelp();}
});
setInterval(()=>{if(!document.hidden)loadBoard().then(()=>{if(!$('board').hidden)renderBoard();}).catch(()=>{});},60000);
setInterval(()=>{if(document.hidden)return;loadQueue();renderMail();loadTodos();loadResponses();if(currentTab()==='equipe')loadTreatments();},5000);
setTimeout(loadTodos,1500);
// Écran tactile : on touche un personnage, on ne clique pas (proposition P5 d'OpenCode).
if(matchMedia('(pointer:coarse)').matches){const hint=document.querySelector('.office-bottom>span');if(hint)hint.textContent=hint.textContent.replace('Clique','Touche');}
termPlaceholder($('output').textContent);syncMotion();refreshState().then(()=>loadBoard()).catch(()=>{});requestAnimationFrame(frame);
// En arrière-plan, avec les notifications activées, seul l'état des agents est relu (toutes les 15 s) :
// draw(0) y repère les changements sans animer la scène. Le navigateur peut encore espacer ces relectures.
let hiddenTicks=0;
setInterval(()=>{
  if(!document.hidden){hiddenTicks=0;refreshState();readOutput();return;}
  if(prefs.get('bureau.notifs')==='on'&&++hiddenTicks%5===0)refreshState();
},3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshState();readOutput();}});
