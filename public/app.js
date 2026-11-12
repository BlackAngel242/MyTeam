'use strict';
const canvas = $('office'), ctx = canvas.getContext('2d');
// Teintes d'identité volontairement éloignées des couleurs d'état (menthe, bleu, ambre, gris).
const colors = ['#d98a74','#9b86e0','#d17aa6','#a3b05f','#b5654f','#7e5fa8'];
const drafts = new Map();
let boardData = null, enseigne = '';
let state = { connected:false, agents:[], token:null }, selected = null, stateBusy = false, readBusy = false, sending = false, readSequence = 0;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
// Animation active par défaut (choix de DrSmoke) ; sa préférence est mémorisée dans ce navigateur.
// Sans choix mémorisé, la réduction des mouvements du système fige la scène.
const readMotion=()=>{try{return localStorage.getItem('bureau.animation');}catch{return null;}};
const initialPaused = readMotion()==='off'||(readMotion()==null&&motionPreference.matches);
const labels = { idle:()=>t('etat.disponible'), done:()=>t('etat.termine'), busy:()=>t('etat.au_travail'), working:()=>t('etat.au_travail'), running:()=>t('etat.au_travail'), waiting:()=>t('etat.attend_reponse'), blocked:()=>t('etat.attend_reponse'), unknown:()=>t('etat.inconnu'), stopped:()=>t('etat.arrete') };
const label = a => a.needsUserAttention ? t('etat.verifier_herdr') : quotaPause(a) ? t('etat.pause_limite') : (labels[a.status]||(()=>t('etat.inconnu')))();
const tint = a => a.needsUserAttention ? '#f4c780' : quotaPause(a) ? '#b5a8e6' : ['busy','working','running'].includes(a.status) ? '#9dbbff' : ['idle','done'].includes(a.status) ? '#a0dfc4' : ['waiting','blocked'].includes(a.status) ? '#f4c780' : '#a7b8ce';
const activeAgent = () => state.agents.find(a => a.id === selected);
// Un agent en pause de limite ne peut pas répondre : pas d'envoi direct, seulement la file d'attente.
const crisisOn = () => CrisisUi.isOn();
const canSend = a => Boolean(state.connected && a && a.ready && ['idle','done'].includes(a.status) && !quotaPause(a) && !crisisOn());
// Message de repli de la demande : envoyé brut, affiché traduit par errorText.
const DEMANDE_EC='La demande a échoué. Réessaie dans un instant.';
async function request(url, options = {}) {
  // Délais au moins égaux au pire cas du serveur (liste puis lecture Herdr) pour ne pas abandonner une réponse en route.
  const response = await fetch(url, { ...options, signal:AbortSignal.timeout(url==='/api/broadcast'?120000:url==='/api/update'&&options.method==='POST'?180000:30000), cache:'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || DEMANDE_EC);
  return data;
}
function errorText(error,context='lecture') {
  // Trois causes distinctes, jamais un message unique : session expirée,
  // Herdr déconnecté, lecture en panne. Le contexte « envoi » adapte le mot.
  const message=error?.message||'';
  if(error?.status===403||/Session expir/i.test(message)) return t('erreur.session_expiree');
  if(message===DEMANDE_EC) return t('erreur.demande_echouee');
  // Les messages précis du serveur (agent occupé, envoi peut-être reçu, refus) sont traduits par tServeur
  // et gardés sinon tels quels : les remplacer par « la consigne n'a pas été transmise » serait faux.
  if(message&&!(error instanceof TypeError)&&error?.name!=='TimeoutError'&&!(error instanceof SyntaxError))return tServeur(message);
  if(typeof state!=='undefined'&&state&&state.connected===false)return t('erreur.herdr_deconnecte');
  const detail=(error.name==='TimeoutError'?t('erreur.detail.delai'):error instanceof TypeError?t('erreur.detail.serveur'):error instanceof SyntaxError?t('erreur.detail.reponse'):tServeur(message)||t('erreur.detail.cause')).replace(/[.\s]+$/,'');
  return t(context==='envoi'?'erreur.envoi_non_abouti':'erreur.lecture_en_panne',{detail});
}
// Agent occupé ou en pause : la consigne peut être mise en file ; le serveur l'enverra seul quand il sera prêt.
const canQueue = a => Boolean(state.connected && a && !crisisOn() && !canSend(a));
function updateForm() {
  const a = activeAgent(), allowed = canSend(a), queue = canQueue(a);
  $('message').disabled = !(allowed || queue) || sending;
  $('send').disabled = !(allowed || queue) || sending || !$('message').value.trim();
  $('send').classList.toggle('queue-mode', queue);
  $('priority-wrap').hidden = !queue;if(!queue)$('priority').checked=false;
  $('send').querySelector('span').textContent = sending ? t('consigne.envoi_en_cours') : queue ? t('consigne.mettre_file',{nom:a.name}) : attached.length ? t('consigne.envoyer_fichier') : t('consigne.envoyer');
  const pause = queue && quotaPause(a);
  $('send-help').textContent = crisisOn() ? t('consigne.aide_crise') : !a ? t('consigne.aide_choisir') : !state.connected ? t('consigne.herdr_off') : queue ? (pause ? (pause.until ? t('consigne.aide_pause_jusqu_a',{nom:a.name,heure:hhmm(pause.until)}) : t('consigne.aide_pause',{nom:a.name})) : t('consigne.aide_indisponible',{nom:a.name})) : t('consigne.aide_directe',{nom:a.name});
}
let agentsKey='';
function renderAgents() {
  const key=JSON.stringify([state.connected,selected,state.agents.map(a=>[a.id,a.name,a.kind,a.status,label(a),a.paneId||'',quotaPause(a)?.until?.getTime?.()||0]),state.agents.some(quotaPause)?Math.floor(Date.now()/60000):0]);
  if(key!==agentsKey||!$('agents-list').children.length){agentsKey=key;buildAgentList();}
  renderDetail();
}
function buildAgentList() {
  const list = $('agents-list'), focused = document.activeElement?.dataset?.agentId;
  list.replaceChildren();
  if (!state.agents.length) {
    const p = document.createElement('p');p.className='list-placeholder';p.textContent=state.connected?t('poste.aucun_agent'):t('poste.attente_connexion');list.append(p);
  }
  state.agents.forEach((a,i) => {
    const button=document.createElement('button');button.type='button';button.className='agent-button'+(a.id===selected?' selected':'');button.dataset.agentId=a.id;button.setAttribute('aria-pressed',String(a.id===selected));
    const face=logoCanvas(a)||document.createElement('span');
    if(face.tagName==='SPAN'){face.className='pixel-face';face.style.setProperty('--agent-color',colors[i%colors.length]);}
    face.setAttribute('aria-hidden','true');
    const text=document.createElement('span'), name=document.createElement('span'), status=document.createElement('span');name.className='agent-name';name.textContent=a.name;status.className='agent-status';const qp=quotaPause(a);status.textContent=!state.connected?t('etat.connexion_perdue'):qp?(qp.until?t('pause.retour',{heure:hhmm(qp.until),reste:until(qp.until)}):t('pause.en_pause')):label(a);text.append(name,status);button.append(face,text);
    if(a.paneId){const pane=document.createElement('span');pane.className='pane-badge';pane.textContent=a.paneId;pane.title=t('poste.panneau_herdr');button.append(pane);}button.addEventListener('click',()=>selectAgent(a.id));list.append(button);
  });
  if(focused){const again=[...list.children].find(e=>e.dataset.agentId===focused);(again||list.querySelector('.agent-button')||$('refresh')).focus({preventScroll:true});}
}
function renderDetail() {
  const a=activeAgent();
  $('detail-title').textContent=a?a.name:t('poste.choisis');
  $('detail-status').textContent=a?(state.connected?label(a):t('etat.connexion_perdue')):t('poste.poste_ouvrira');
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
    $('pick-list').replaceChildren(...state.agents.map(x=>{const b=document.createElement('button');b.type='button';b.className='tool-button pick';b.dataset.id=x.id;b.textContent=t('equipe.choix',{nom:x.name,etat:label(x).toLowerCase()});b.addEventListener('click',()=>selectAgent(x.id));return b;}));
    if(focusedPick)$('pick-list').querySelector('[data-id="'+CSS.escape(focusedPick)+'"]')?.focus({preventScroll:true});
  }
  if(a)$('pick-list').dataset.key='';
  if(a){$('agent-kind').textContent=a.kind||t('poste.non_precise');$('agent-pane').textContent=a.paneId||t('poste.non_precise');$('agent-cwd').textContent=a.cwd||t('poste.non_precise');}
  renderActivity(a);renderStatusbar(a);updateForm();renderBroadcast();renderSummary();DirectionUi.render();
}
// Résumé en tête de page et alerte : uniquement les états Herdr actuels.
function renderSummary(){
  const on=state.connected,count=list=>on?state.agents.filter(a=>list.includes(a.status)&&!a.needsUserAttention).length:0;
  $('count-work').textContent=count(['busy','working','running']);$('count-wait').textContent=on?state.agents.filter(a=>a.needsUserAttention||['waiting','blocked'].includes(a.status)).length:0;$('count-free').textContent=on?state.agents.filter(a=>a.ready&&['idle','done'].includes(a.status)&&!quotaPause(a)).length:0;
  $('chips').classList.toggle('offline',!on);
  const waiting=on?state.agents.filter(a=>a.needsUserAttention||['waiting','blocked'].includes(a.status)):[];
  $('attention').hidden=!waiting.length;
  if(waiting.length){
    $('attention-text').textContent=waiting.length===1?t('etat.attente.un',{nom:waiting[0].name}):t('etat.attente.autres',{noms:waiting.map(a=>a.name).join(', ')});
    $('attention-open').dataset.target=waiting[0].id;$('attention-open').textContent=t('equipe.ouvrir_poste',{nom:waiting[0].name});
  }
  const free=on?state.agents.filter(canSend).length:0;
  $('team-badge').hidden=!free;$('team-badge').textContent=free;$('team-badge').title=free>1?t('equipe.disponibles.autres',{n:free}):t('equipe.disponibles.un',{n:free});
}
$('attention-open').addEventListener('click',()=>{const id=$('attention-open').dataset.target;if(id){selectAgent(id);showTab('poste');$('output').focus({preventScroll:true});}});
// Menu du panneau : onglets accessibles au clavier (flèches gauche et droite).
const tabs=['poste','equipe','fichiers','taches'];
function showTab(name){
  for(const t of tabs){const on=t===name,tab=$('tab-'+t);tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;$('panel-'+t).hidden=!on;}
  if(name==='fichiers')FilesUi.load();
  if(name==='taches')TodosUi.load();
  if(name==='equipe'){loadRelais();QueueUi.load();loadTreatments();loadDiscussion();Scene.renderMail();Scene.acknowledgeMail();}
}
const currentTab=()=>tabs.find(t=>$('tab-'+t).getAttribute('aria-selected')==='true');
let attached=[];
function errorBlock(container,message,icon='erreur',retry=null){
  // La même panne n'est ni redessinée ni réannoncée : le bouton garde le focus et l'alerte reste unique.
  // Le message est affiché tel quel : aucune liste vide ne remplace jamais une erreur.
  const old=container.querySelector(':scope>.error-block');if(old&&old.dataset.message===message)return;
  const box=document.createElement('div');box.dataset.message=message;box.className='error-block';box.setAttribute('role','alert');
  const pic=iconCanvas(icon);if(pic)box.append(pic);
  const p=document.createElement('p');p.textContent=message;
  const btn=document.createElement('button');btn.type='button';btn.className='tool-button';btn.textContent=t('commandes.actualiser_bureau');
  btn.addEventListener('click',async()=>{await refreshState();if(retry)return retry();const t=currentTab();if(t==='equipe')QueueUi.load();if(t==='taches')TodosUi.load();if(t==='fichiers')FilesUi.load();});
  box.append(p,btn);container.replaceChildren(box);
}
function iconCanvas(name){
  const icon=window.EMPTY_ICONS?.[name];if(!icon)return null;
  const c=document.createElement('canvas');c.width=16;c.height=16;c.className='empty-icon';c.setAttribute('aria-hidden','true');const g3=c.getContext('2d');
  icon.rows.forEach((row,y)=>[...row].forEach((ch,x)=>{if(icon.palette[ch]){g3.fillStyle=icon.palette[ch];g3.fillRect(x,y,1,1);}}));return c;
}
let discData=null;
window.TodosUi = createTodosUi({ getState: () => state, api: request, t, $, errorBlock, errorText, renderStatusbar, activeAgent, agentByTarget, getQueueItems: () => QueueUi.items, getDiscData: () => discData });
window.FilesUi = createFilesUi({ getState: () => state, api: request, t, $, errorBlock, errorText, activeAgent, showTab, since });
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
  if(/Thinking|Réflexion/i.test(chrome)||s.thought)s.activity='poste.activite.reflexion';else if(/Working|esc (to )?interrupt/i.test(chrome))s.activity='poste.activite.execution';else if(/Loading/i.test(chrome))s.activity='poste.activite.chargement';
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
const windowLabel=min=>!min?null:min%1440===0&&min>1440?t('temps.jours',{n:min/1440}):min%60===0?t('temps.heures',{n:min/60}):t('temps.minutes',{n:min});
function quotaPause(a){
  if(!a)return null;
  const act=a.activity;
  if(act?.limitReached){
    // Seules les limites épuisées décident du retour ; si aucune ne l'est, l'outil ne dit pas laquelle bloque.
    const blocking=(act.limits||[]).filter(l=>l.usedPercent>=100);
    const times=[...blocking.filter(l=>l.resetsAt).map(l=>new Date(l.resetsAt)),act.resetsAt?new Date(act.resetsAt):null].filter(d=>d&&d>Date.now());
    // Message de terminal resté affiché après l'heure annoncée : la pause est finie.
    if(act.source==='terminal'&&act.resetsAt&&new Date(act.resetsAt)<=Date.now())return null;
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
  const dates=QueueUi.items.filter(q=>q.id===a.id&&q.holdUntil).map(q=>new Date(q.holdUntil)).filter(d=>!Number.isNaN(d));
  return dates.length?new Date(Math.max(...dates)):null;
}
function pauseBanner(a,pause){
  const source=pause.source==='terminal'?t('pause.source.terminal'):t('pause.source.journal');
  if(!pause.until)return t('pause.quota_non_annonce',{source});
  const relance=holdUntilOf(a)||new Date(pause.until.getTime()+300000);
  return t('pause.quota_retour',{retour:hhmm(pause.until),reste:until(pause.until),relance:hhmm(relance),source});
}
const hhmm=d=>d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
// File d'attente : lecture du serveur, annulation possible tant que la consigne n'est pas partie.
window.QueueUi = createQueueUi({ getState: () => state, api: request, t, tServeur, $, errorBlock, errorText, renderStatusbar, activeAgent, hhmm });
function renderStatusbar(a){
  const bar=$('statusbar'),s=a&&statusCache.get(a.id),pause=a&&quotaPause(a);
  const st=s?.status&&Object.keys(s.status).length?s.status:null;
  const plan=a&&TodosUi.planOf(a.id);
  if(!a||(!st&&!pause&&!plan)){bar.hidden=true;return;}
  bar.hidden=false;
  const head=st?.title||(st?.thought?t('poste.en_cours',{texte:st.thought}):'');
  $('task-title').hidden=!head;$('task-title').textContent=head;
  const chips=[];
  if(pause)chips.push(['warn',pauseBanner(a,pause)]);
  if(st?.activity&&!pause)chips.push(['activity',t(st.activity)+(st.elapsed?' · '+st.elapsed:'')]);
  if(st?.model)chips.push(['model',(st.mode?st.mode+' · ':'')+st.model+(st.effort?' · '+st.effort:'')]);
  if(st?.context)chips.push(['context',t('poste.contexte',{used:st.context.used,pct:st.context.pct})]);
  if(st?.flow)chips.push(['context',t('poste.tokens_tour',{n:st.flow})]);
  if(plan)chips.push(['context',t('poste.plan',{fait:plan.done,total:plan.total,pct:plan.pct})]);
  if(st?.warnings)chips.push(['warn',st.warnings>1?t('poste.avertissements.autres',{n:st.warnings}):t('poste.avertissements.un',{n:st.warnings})]);
  $('status-chips').replaceChildren(...chips.map(([k,t])=>{const li=document.createElement('li');li.className='schip '+k;li.textContent=t;return li;}));
  $('limit').hidden=!st?.limit;
  if(!st?.limit){$('limit-label').textContent='';$('limit-value').textContent='';}
  else{
    const fenetre=st.limit.window==='de session'?t('poste.fenetre.session'):st.limit.window;
    $('limit-label').textContent=st.limit.reset?(fenetre?t('poste.limite_fenetre_reset',{fenetre,heure:hhmm(st.limit.reset)}):t('poste.limite_reset',{heure:hhmm(st.limit.reset)})):(fenetre?t('poste.limite_fenetre',{fenetre}):t('poste.limite'));
    $('limit-value').textContent=st.limit.left+' %';$('limit-bar').style.width=Math.max(0,Math.min(100,st.limit.left))+'%';$('limit').classList.toggle('low',st.limit.left<=20);
  }
  $('status-source').textContent=s?t('poste.lu_dans_barre',{heure:s.at.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}):'';
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
  if(sel&&!sel.isCollapsed&&$('output').contains(sel.anchorNode)){$('read-state').textContent=t('sorties.selection');return false;}
  const output=$('output'),text=termData.text,atBottom=output.scrollHeight-output.scrollTop-output.clientHeight<45,query=$('term-search').value.trim();
  let matches=0;
  if(window.TerminalView?.render){try{matches=window.TerminalView.render(output,text,{query,frozen})?.matches||0;}catch{output.textContent=text;}}
  else{output.textContent=text;if(query)matches=text.toLowerCase().split(query.toLowerCase()).length-1;}
  if(!frozen&&atBottom)output.scrollTop=output.scrollHeight;
  $('term-hits').textContent=query?(matches?(matches>1?t('sorties.trouves.autres',{n:matches}):t('sorties.trouves.un',{n:matches})):t('sorties.aucun_resultat')):'';
  $('term-copy').disabled=false;$('term-search').disabled=false;
  return true;
}
$('term-search').addEventListener('input',renderOutput);
$('term-expand').addEventListener('click',()=>{const on=!document.body.classList.contains('term-expanded');document.body.classList.toggle('term-expanded',on);$('term-expand').dataset.actif=String(on);$('term-expand').textContent=on?t('commandes.reduire'):t('commandes.agrandir');if(on)$('output').scrollIntoView({block:'nearest'});});
// Ctrl+Entrée (ou Cmd+Entrée) envoie, sans contourner les vérifications des boutons.
$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!$('send').disabled){e.preventDefault();$('prompt-form').requestSubmit();}});
$('broadcast-message').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!$('broadcast-send').disabled){e.preventDefault();$('broadcast-send').click();}});
$('broadcast-all').addEventListener('click',()=>{for(const a of state.agents)if(canSend(a))broadcastTargets.add(a.id);broadcastArmed=null;renderBroadcast();});
$('term-freeze').addEventListener('click',()=>{frozen=!frozen;$('term-freeze').dataset.actif=String(frozen);$('term-freeze').textContent=frozen?t('commandes.reprendre'):t('commandes.figer');$('read-state').textContent=frozen?t('sorties.defilement_fige'):t('sorties.lecture_actualisee');});
$('term-copy').addEventListener('click',async()=>{if(!termData.valid||termData.id!==selected)return;try{await navigator.clipboard.writeText(termData.text);$('term-copy').textContent=t('sorties.copie');}catch{$('term-copy').textContent=t('sorties.copie_refusee');}setTimeout(()=>{$('term-copy').textContent=t('sorties.copier');},1600);});
// Journal des envois : trois issues seulement, jamais de faux « non transmise » quand on ne sait pas.
// sent = Herdr a confirmé ; refused = refus avant tout envoi ; unknown = coupure, délai ou erreur après la transmission.
const outcomeLabels={sent:()=>t('consigne.issue.transmise'),refused:()=>t('consigne.issue.refusee'),unknown:()=>t('consigne.issue.inconnue')};
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
  boite.setAttribute('role','dialog');boite.setAttribute('aria-label',t('sorties.copie_manuelle'));
  boite.style.cssText='background:#101d33;border:1px solid #2c4468;border-radius:12px;padding:14px;max-width:640px;width:100%;';
  const titre=document.createElement('p');
  titre.style.cssText='margin:0 0 8px;';
  titre.textContent=t('sorties.copie_refusee_detail',{message});
  const zone=document.createElement('textarea');
  zone.readOnly=true;zone.value=texte;zone.rows=12;
  zone.style.cssText='width:100%;box-sizing:border-box;white-space:pre-wrap;user-select:text;background:#0b1526;color:#e7edf5;border:1px solid #2c4468;border-radius:8px;padding:8px;font-size:13px;';
  const actions=document.createElement('div');actions.style.cssText='margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;';
  const choisir=document.createElement('button');choisir.type='button';choisir.className='tool-button';choisir.textContent=t('sorties.tout_selectionner');
  choisir.addEventListener('click',()=>{zone.focus();zone.select();announceCopy(t('sorties.texte_selectionne'),true);});
  const fermer=document.createElement('button');fermer.type='button';fermer.className='tool-button';fermer.textContent=t('commandes.fermer');
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
    announceCopy(t('sorties.copie_ok',{message}),true);
    return true;
  }catch{
    announceCopy(t('sorties.copie_ko',{message}),false);
    openCopyFallback(texte,message,declencheur);
    return false;
  }
}
const sendLog=[];
function logSend(names,message,outcome,detail){
  sendLog.unshift({at:new Date(),names,message,outcome,detail});sendLog.length=Math.min(sendLog.length,30);
  $('send-log').replaceChildren(...sendLog.map(e=>{
    const li=document.createElement('li');li.className=e.outcome;
    const head=document.createElement('span');head.className='log-head';head.textContent=[e.at.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),e.names.join(', '),(outcomeLabels[e.outcome]||(()=>undefined))()].join(' · ');
    const body=document.createElement('span');body.className='log-body';body.textContent=e.message.length>110?e.message.slice(0,110)+'…':e.message;
    li.append(head,body);if(e.outcome!=='sent'){const why=document.createElement('span');why.className='log-why';why.textContent=e.detail;li.append(why);}
    // P1 : l'aperçu reste court, mais la consigne INTÉGRALE se lit et se copie
    // d'un clic, toujours depuis e.message, jamais depuis le texte raccourci.
    const actions=document.createElement('span');actions.className='log-actions';actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;';
    const lire=document.createElement('button');lire.type='button';lire.className='tool-button';lire.textContent=t('sorties.lire_tout');
    let ouvert=null;
    lire.addEventListener('click',()=>{
      if(ouvert){ouvert.remove();ouvert=null;lire.textContent=t('sorties.lire_tout');return;}
      ouvert=document.createElement('span');ouvert.className='log-full';
      ouvert.style.whiteSpace='pre-wrap';ouvert.style.userSelect='text';
      ouvert.textContent=e.message;
      li.append(ouvert);lire.textContent=t('commandes.reduire');
    });
    const copier=document.createElement('button');copier.type='button';copier.className='tool-button';copier.textContent=t('consigne.copier');
    copier.addEventListener('click',()=>copyText(e.message,t('consigne.de',{noms:e.names.join(', ')}),copier));
    actions.append(lire,copier);li.append(actions);return li;
  }));
}
const compact=n=>n>=1e6?t('poste.unites.m',{n:(n/1e6).toLocaleString('fr-FR',{maximumFractionDigits:1})}):n>=1e3?t('poste.unites.k',{n:(n/1e3).toLocaleString('fr-FR',{maximumFractionDigits:1})}):String(n);
function since(ms){const s=Math.round(ms/1000);return s<60?t('temps.passe.s',{n:s}):s<3600?t('temps.passe.min',{n:Math.round(s/60)}):t('temps.passe.h',{n:Math.round(s/3600)});}
// Compte à rebours compact pour la scène : « 45MIN », « 1H12 ».
function compte(d){const m=Math.max(0,Math.ceil((d-Date.now())/60000));return m<60?m+'MIN':Math.floor(m/60)+'H'+String(m%60).padStart(2,'0');}
function until(d){const m=Math.max(0,Math.round((d-Date.now())/60000));return m<60?t('temps.future.min',{n:m}):t('temps.future.hm',{h:Math.floor(m/60),m:String(m%60).padStart(2,'0')});}
// Tokens et sous-agents : uniquement ce que le transcript local expose (Claude). Les autres outils ne les publient pas.
function renderActivity(a){
  const list=$('subagent-list');list.replaceChildren();list.hidden=true;
  if(!a)return;
  const change=Scene.changeOf(a.id);
  $('agent-since').textContent=change?t('poste.depuis_temps',{etat:label(a),duree:since(performance.now()-change.at)}):t('poste.depuis',{etat:label(a)});
  const act=a.activity;
  if(!act){$('agent-tokens').textContent=t('poste.non_expose');$('agent-subagents').textContent=t('poste.non_expose');return;}
  if(act.match==='activité non attribuable'){$('agent-tokens').textContent=t('poste.non_attribuable');$('agent-subagents').textContent='';return;}
  const tok=act.tokens||{};
  $('agent-tokens').textContent=t('poste.tokens',{produits:compact(tok.output||0),lus:compact((tok.input||0)+(tok.cacheCreation||0)),cache:compact(tok.cacheRead||0)});
  const subs=act.subagents||[];
  $('agent-subagents').textContent=subs.length?String(subs.length):t('poste.aucun');
  for(const s of subs){const li=document.createElement('li');li.textContent=s.description||t('poste.sans_description');list.append(li);}
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
    const name=document.createElement('span');name.textContent=ok?a.name:t('equipe.choix',{nom:a.name,etat:label(a).toLowerCase()});
    labelEl.className='target'+(ok?'':' unavailable');labelEl.append(box2,name);return labelEl;
  }));
  if(!state.agents.length){const p=document.createElement('p');p.className='list-placeholder';p.textContent=t('equipe.aucun_contacter');box.append(p);}
  // Le focus clavier reste sur une commande utilisable même si la case visée vient d'être désactivée.
  if(focused){const again=box.querySelector(`[data-target="${CSS.escape(focused)}"]`);(again&&!again.disabled?again:box.querySelector('input:not(:disabled)')||$('broadcast-message')).focus({preventScroll:true});}
  const names=state.agents.filter(a=>broadcastTargets.has(a.id)).map(a=>a.name),n=names.length,text=$('broadcast-message').value.trim();
  $('broadcast-message').disabled=broadcasting||!state.connected;
  $('broadcast-all').disabled=broadcasting||!state.agents.some(a=>canSend(a)&&!broadcastTargets.has(a.id));
  $('broadcast-send').disabled=broadcasting||!n||!text;
  $('broadcast-send').querySelector('span').textContent=broadcasting?t('consigne.envoi_en_cours'):broadcastArmed?t('equipe.confirmer_envoi',{noms:names.join(', ')}):n?(n>1?t('equipe.envoyer.autres',{n}):t('equipe.envoyer.un',{n})):t('equipe.cocher_un');
  $('broadcast-send').classList.toggle('armed',Boolean(broadcastArmed));
  $('broadcast-help').textContent=!state.connected?t('consigne.herdr_off'):broadcastArmed?t('equipe.aide_verifier'):t('equipe.aide_disponibles');
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
      const li=document.createElement('li');li.className=outcome;
      const texte=r.ok?tServeur(r.message||'')||t('consigne.transmise_herdr'):tServeur(r.error||'')||t('equipe.envoi_refuse');
      li.textContent=t('equipe.resultat',{nom:r.name||t('taches.agent'),texte});results.append(li);
      logSend([r.name||t('taches.agent')],message,outcome,r.ok?t('consigne.transmise_herdr'):tServeur(r.error||'')||t('equipe.envoi_refuse_complet'));
      // Un agent servi ne doit jamais recevoir la consigne une seconde fois lors d'une reprise.
      if(r.ok||outcome==='unknown')broadcastTargets.delete(r.id);
    }
    if((data.results||[]).every(r=>r.ok))$('broadcast-message').value='';
  }catch(error){
    const li=document.createElement('li');li.className='unknown';li.textContent=t('consigne.verifier_terminaux',{erreur:errorText(error,'envoi')});results.append(li);
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
  if(onFiles)FilesUi.reset();
  queueMicrotask(()=>showTab(onFiles?'fichiers':'poste'));
  if(selected) keepDraft(selected,$('message').value);
  selected=id;readSequence++;resetAttach();loadAttach();loadResponses();
  $('message').value=drafts.get(id)||'';$('send-result').hidden=true;
  termPlaceholder(t('sorties.lecture'));$('read-state').textContent=t('sorties.lecture_en_cours');
  renderAgents();readOutput();Scene.draw(0);
}
async function refreshState() {
  if(stateBusy)return;stateBusy=true;$('refresh').disabled=true;
  try {
    const data=await request('/api/state');
    state={...data,agents:Array.isArray(data.agents)?data.agents:[]};
    // Une disparition n'est confirmée que dans une liste connectée ; pendant une panne, le poste et le brouillon sont gardés.
    if(selected&&state.connected&&!activeAgent()) {
      keepDraft(selected,$('message').value);selected=null;readSequence++;$('message').value='';termPlaceholder(t('sorties.agent_parti'));$('read-state').textContent=t('sorties.poste_ferme');$('send-result').hidden=true;
    } else if(selected&&!state.connected){readSequence++;termPlaceholder(t('sorties.herdr_attente'));$('read-state').textContent=t('sorties.indisponible');}
    if(state.connected){const live=new Set(state.agents.map(a=>a.id));Scene.forgetMissing(live,statusCache);}
    $('state-error').hidden=!data.error;$('state-error').textContent=data.error?tServeur(data.error):'';
    $('last-update').textContent=t('etat.actualise_a',{heure:new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});
  }catch(error){
    if(selected)keepDraft(selected,$('message').value);
    state={connected:false,agents:[],token:null};readSequence++;
    termPlaceholder(t('sorties.serveur_off'));$('read-state').textContent=t('sorties.indisponible');
    $('state-error').hidden=false;$('state-error').textContent=errorText(error);
  }
  finally{
    stateBusy=false;$('refresh').disabled=false;
    $('connection').className='connection '+(state.connected?'connected':'disconnected');$('connection-text').textContent=state.connected?t('etat.herdr_connecte'):t('etat.herdr_deconnecte');
    $('office-count').textContent=state.connected?(state.agents.length>1?t('etat.agents_detectes.autres',{n:state.agents.length}):t('etat.agents_detectes.un',{n:state.agents.length})):t('etat.connexion_indisponible');
    const notice=$('scene-notice');notice.hidden=state.connected&&state.agents.length>0;
    notice.querySelector('strong').textContent=state.connected?t('etat.bureau_attend'):t('etat.herdr_hors_ligne');
    notice.querySelector('span').textContent=state.connected?t('etat.ouvrir_agent'):t('etat.verifier_herdr');
    renderAgents();Scene.draw(0);
  }
}
async function readOutput() {
  if(readBusy||!selected||!state.connected)return;
  readBusy=true;const id=selected,sequence=readSequence;
  try{
    const data=await request('/api/read?id='+encodeURIComponent(id),{headers:{'X-Bureau-Token':state.token||''}});
    if(id!==selected||sequence!==readSequence)return;
    const parts=splitChrome(data.text||'');
    statusCache.set(id,{status:parts.status,at:new Date()});renderStatusbar(activeAgent());
    termData={id,text:parts.body||t('sorties.sans_sortie'),valid:true};
    if(renderOutput())$('read-state').textContent=frozen?t('sorties.defilement_fige'):t('sorties.lecture_actualisee');
    $('read-note').textContent=data.truncated?t('sorties.extrait'):t('sorties.direct');
  }catch(error){if(id===selected&&sequence===readSequence){$('read-state').textContent=t('sorties.indisponible');termPlaceholder(errorText(error));}}
  finally{readBusy=false;if(id!==selected&&selected)readOutput();}
}
// Fil de la salle de contrôle : extraits des réponses lisibles de tous les agents.
async function loadDiscussion(){
  if(!state.connected||!state.token||!window.Discussion)return;
  try{discData=await request('/api/discussion',{headers:{'X-Bureau-Token':state.token}});Discussion.render($('disc-list'),discData);}
  catch(error){$('disc-list').replaceChildren(Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:errorText(error)}));}
}
// Fichiers confiés : faits observés par le serveur pour chaque pièce jointe, jamais un verdict.
const sourceLabels={file:()=>t('fichiers.source.file'),disque:()=>t('fichiers.source.disque'),herdr:()=>t('fichiers.source.herdr'),journal:()=>t('fichiers.source.journal')};
let treatShown='';
async function loadTreatments(){
  if(!state.connected||!state.token||!state.agents.length)return;
  try{
    const lists=await Promise.all(state.agents.map(a=>request('/api/traitement?id='+encodeURIComponent(a.id),{headers:{'X-Bureau-Token':state.token}}).then(d=>(d.dossiers||[]).map(x=>({...x,agent:a.name})),()=>[])));
    const dossiers=lists.flat().sort((x,y)=>Date.parse(y.faits.at(-1)?.at||0)-Date.parse(x.faits.at(-1)?.at||0)).slice(0,10);
    const shown=JSON.stringify(dossiers);if(shown===treatShown)return;treatShown=shown;
    $('treat-count').textContent=dossiers.length?'('+dossiers.length+')':'';
    if(!dossiers.length){$('treat-list').replaceChildren(Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:t('fichiers.aucun_confie')}));return;}
    $('treat-list').replaceChildren(...dossiers.map(d=>{
      const sec=document.createElement('section');sec.className='task-group';
      const h=document.createElement('h3');h.textContent=t('fichiers.confie_a',{fichier:d.fichierConfie,nom:d.agent});
      const ul=document.createElement('ul');ul.className='task-list';
      for(const f of d.faits){const li=document.createElement('li');li.textContent=t('fichiers.fait',{heure:hhmm(new Date(f.at)),fait:tServeur(f.fait),source:(sourceLabels[f.source]||(()=>f.source))()});ul.append(li);}
      sec.append(h,ul);return sec;
    }));
  }catch{ /* Lecture facultative : la file reste utilisable. */ }
}
// Pièces jointes : fichiers récents du dossier de l'agent, copiés par le serveur au départ de la consigne (par la file).
const attachSize=n=>n<1048576?t('fichiers.taille.ko',{n:Math.max(1,Math.round(n/1024))}):t('fichiers.taille.mo',{n:(n/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})});
function attachSummary(){const n=attached.length;$('attach-summary').textContent=n?(n>1?t('consigne.joint.autres',{n}):t('consigne.joint.un',{n})):t('consigne.joindre');}
function resetAttach(){attached=[];$('attach-list').replaceChildren();attachSummary();}
async function loadAttach(){
  const a=activeAgent(),box=$('attach');
  if(!box.open||!a||!state.token)return;
  const list=$('attach-list'),note=text=>list.replaceChildren(Object.assign(document.createElement('li'),{className:'list-placeholder',textContent:text}));
  try{
    const data=await request('/api/files/recent?id='+encodeURIComponent(a.id),{headers:{'X-Bureau-Token':state.token}});
    if(a.id!==selected)return;
    const files=(data.files||[]).filter(f=>f.size<=20*1048576).slice(0,30);
    if(!files.length){note(t('consigne.aucun_fichier',{nom:a.name}));return;}
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
      label.append(box,' ',Object.assign(document.createElement('span'),{textContent:t('equipe.element',{nom:f.name,taille:attachSize(f.size)})}));li.append(label);return li;
    }));
  }catch(error){if(a.id===selected)note(errorText(error));}
}
$('attach').addEventListener('toggle',loadAttach);
// Mosaïque : 2 à 4 terminaux côte à côte à la place de la scène (public/tiles.js).
let tilesOn=false;
function setTiles(on){
  if(on&&!window.Tiles)return;
  tilesOn=on;Scene.sync();$('tiles-open').dataset.actif=String(on);$('tiles-open').querySelector('span').textContent=on?t('commandes.vue_scene'):t('commandes.mosaique');
  document.querySelector('.scene-wrap').hidden=on;$('tiles').hidden=!on;
  if(!on){if(window.Tiles)Tiles.unmount();return;}
  Tiles.mount($('tiles'),{
    agents:()=>state.agents.map(a=>({id:a.id,name:a.name,kind:a.kind,status:a.status,paneId:a.paneId,paused:Boolean(quotaPause(a))})),
    read:id=>request('/api/read?id='+encodeURIComponent(id),{headers:{'X-Bureau-Token':state.token||''}}).then(d=>({text:splitChrome(d.text||'').body})),
    send:async(id,message)=>{
      const a=state.agents.find(x=>x.id===id);
      if(!canSend(a))throw new Error(crisisOn()?t('equipe.crise.envois_verrouilles'):t('poste.indisponible'));
      try{
        const data=await request('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({id,message})});
        logSend([a.name],message,'sent',tServeur(data.message||'')||t('consigne.transmise_herdr'));refreshState();
      }catch(error){logSend([a.name],message,outcomeOf(error),errorText(error,'envoi'));throw new Error(errorText(error,'envoi'));}
    },
    canSend:a=>canSend(state.agents.find(x=>x.id===a.id)),
    onExpand:id=>{setTiles(false);selectAgent(id);},
    onClose:()=>setTiles(false),
  });
}
$('tiles-open').addEventListener('click',()=>setTiles(!tilesOn));
// Pied de page facultatif : le texte vient de .bureau/pied.json (local, jamais imposé).
// Santé du bureau : observée par le serveur (Herdr, journaux, version chargée comparée aux fichiers), jamais de chemin ni de message.
let santeData=null;
async function loadSante(){
  if(!state.connected||!state.token)return;
  try{santeData=await request('/api/sante',{headers:{'X-Bureau-Token':state.token}});}catch{santeData=null;}
  renderSante();
}
function renderSante(){
  const d=santeData,chip=$('sante-chip');
  if(!d){chip.hidden=true;$('sante-ligne').textContent=t('sante.indisponible');return;}
  chip.hidden=d.conforme!==false;chip.title=t('sante.redemarrage_aide');
  $('sante-ligne').textContent=t('sante.ligne',{herdr:d.herdr?t('sante.oui'):t('sante.non'),journaux:d.journauxTrouves,version:d.conforme===false?t('sante.version_ancienne'):t('sante.version_ok')});
}
async function copierDiagnostic(){
  await loadSante();
  const d=santeData,pre=$('sante-texte');
  if(!d){$('sante-ligne').textContent=t('sante.indisponible');return;}
  const texte=JSON.stringify(d,null,2);
  try{await navigator.clipboard.writeText(texte);pre.hidden=true;$('sante-ligne').textContent=t('sante.copie');}
  catch{pre.textContent=texte;pre.hidden=false;$('sante-ligne').textContent=t('sante.copie_impossible');}
}
$('sante-copier').addEventListener('click',copierDiagnostic);
let updateBusy=false;
async function checkUpdate(force=false){
 if(!state.token)return;
 try{
  const d=await request('/api/update'+(force?'?force=1':''),{headers:{'X-Bureau-Token':state.token}});
  $('update-open').hidden=!d.available;
  $('update-label').textContent=t('update.available',{version:d.latest});
  $('update-install').hidden=!d.available;
  $('update-status').textContent=d.available?t('update.available',{version:d.latest}):t('update.current',{version:d.installed});
 }catch(error){$('update-status').textContent=errorText(error);}
}
$('update-check').addEventListener('click',()=>checkUpdate(true));
$('update-open').addEventListener('click',()=>{toggleHelp(true);$('update-install').focus();});
$('update-install').addEventListener('click',async()=>{
 if(updateBusy)return;updateBusy=true;$('update-install').disabled=true;
 const status=$('update-status'),post=action=>request('/api/update',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({action})});
 try{
  status.textContent=t('update.downloading');const prepared=await post('prepare');
  status.textContent=t('update.restarting');await post('install');
  for(let i=0;i<60;i++){
   await new Promise(resolve=>setTimeout(resolve,1000));
   try{const response=await fetch('/api/projet',{cache:'no-store',signal:AbortSignal.timeout(900)});if(response.ok&&((await response.json()).version===prepared.ready)){location.reload();return;}}catch{}
  }
  status.textContent=t('update.restart_failed');
 }catch(error){status.textContent=errorText(error);}finally{updateBusy=false;$('update-install').disabled=false;}
});
async function loadFooter(){
  if(!state.connected||!state.token)return;
  try{
    const p=await request('/api/pied',{headers:{'X-Bureau-Token':state.token}});
    $('footer-left').textContent=p.gauche||'';$('footer-right').textContent=p.droite||'';
    $('page-footer').hidden=!(p.gauche||p.droite);
    enseigne=p.enseigne||'';
  }catch{ /* Pied facultatif : sans réponse, il reste masqué. */ }
}
// Relais d'écoute : option du serveur, désactivée par défaut ; le chef est prévenu quand un agent termine.
let relaisBusy=false;
async function loadRelais(){
  if(!state.connected||!state.token||relaisBusy)return;
  try{const r=await request('/api/relais',{headers:{'X-Bureau-Token':state.token}});$('relais-actif').checked=r.actif===true;}
  catch{ /* Lecture facultative : la case garde son dernier état. */ }
}
$('relais-actif').addEventListener('change',async()=>{
  const box=$('relais-actif'),actif=box.checked,out=$('relais-result');relaisBusy=true;
  try{await request('/api/relais',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({actif})});out.className='files-result';out.textContent=t(actif?'onglet.equipe.relais-active':'onglet.equipe.relais-desactive');out.hidden=false;}
  catch(error){box.checked=!actif;out.className='files-result error';out.textContent=errorText(error,'envoi');out.hidden=false;}
  finally{relaisBusy=false;}
});
window.CrisisUi = createCrisisUi({ getState: () => state, api: request, t, $, errorText, updateForm, renderBroadcast, backdrop: (...args) => backdrop(...args), getQueueItems: () => QueueUi.items, hhmm, label, splitChrome, tServeur });
window.AutoUi = createAutoUi({ getState: () => state, api: request, t, $, errorText, backdrop: (...args) => backdrop(...args), isCrisisOn: () => CrisisUi.isOn(), loadQueue: () => QueueUi.load(), hhmm, DEMANDE_EC });
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
    if(!data.supported)note(tServeur(data.reason||'')||t('poste.reponses_non_exposees'));
    else if(!data.found)note(t('poste.reponses_introuvable'));
    else if(!data.responses.length)note(t('poste.reponses_aucune'));
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
      drafts.delete(target);$('priority').checked=false;resetAttach();loadAttach();QueueUi.load();
      if(target===selected){$('message').value='';$('send-result').className='';$('send-result').textContent=t('consigne.mise_en_file',{nom:a.name});$('send-result').hidden=false;}
    }catch(error){if(target===selected){$('send-result').className='error';$('send-result').textContent=errorText(error,'envoi');$('send-result').hidden=false;}}
    finally{sending=false;updateForm();}
    return;
  }
  if(!canSend(a)||sending||!message)return;
  const target=a.id;sending=true;updateForm();$('send-result').hidden=true;
  try{
    const data=await request('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({id:target,message})});
    drafts.delete(target);logSend([a.name],message,'sent',tServeur(data.message||'')||t('consigne.transmise_herdr'));
    if(target===selected){$('message').value='';$('send-result').className='';$('send-result').textContent=tServeur(data.message||'')||t('consigne.transmise_herdr');$('send-result').hidden=false;}
    await refreshState();
  }catch(error){logSend([a.name],message,outcomeOf(error),errorText(error,'envoi'));if(target===selected){$('send-result').className='error';$('send-result').textContent=t('consigne.verifier_sorties',{erreur:errorText(error,'envoi')});$('send-result').hidden=false;}}
  finally{sending=false;updateForm();}
});
$('refresh').addEventListener('click',async()=>{await refreshState();readOutput();});
function syncMotion(){ const label=$('motion').querySelector('span');label.dataset.i18n=Scene.isPaused()?'commandes.animer':'commandes.mettre_en_pause';label.textContent=t(label.dataset.i18n);$('motion').dataset.actif=String(Scene.isPaused());$('motion').querySelector('use').setAttribute('href',Scene.isPaused()?'/icons.svg#play':'/icons.svg#pause');Scene.draw(0);Scene.sync(); }
$('motion').addEventListener('click',()=>{Scene.setPaused(!Scene.isPaused());try{localStorage.setItem('bureau.animation',Scene.isPaused()?'off':'on');}catch{}syncMotion();});
motionPreference.addEventListener('change',()=>{if(readMotion()==null){Scene.setPaused(motionPreference.matches);syncMotion();}});
function agentByTarget(target){
  return state.agents.find(a=>a.paneId===target||a.name?.toLowerCase()===String(target).toLowerCase());
}
window.Scene = createScene({ canvas, getState: () => state, getSelected: () => selected, getQueueItems: () => QueueUi.items, getBoardData: () => boardData, getEnseigne: () => enseigne, getTodosData: () => TodosUi.data, isTilesOn: () => tilesOn, initialPaused, colors, label, tint, compte, showTab, selectAgent, openBoard, copyText, logoFor, activeAgent, quotaPause, signal, hhmm, agentByTarget });
// Signaux : notification Windows quand la page est en arrière-plan, son 8 bits si DrSmoke l'a activé (public/sounds.js).
const prefs={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}}};
function signal(kind,title,body){
  if(window.BureauSounds?.enabled)try{window.BureauSounds.play(kind);}catch{}
  if(!title||prefs.get('bureau.notifs')!=='on'||typeof Notification==='undefined'||Notification.permission!=='granted'||!document.hidden)return;
  try{const n=new Notification(title,{body,tag:'bureau-'+kind});n.onclick=()=>{focus();n.close();};}catch{}
}
function syncSignals(){
  const notif=prefs.get('bureau.notifs')==='on'&&typeof Notification!=='undefined'&&Notification.permission==='granted';
  $('notif-toggle').dataset.actif=String(notif);$('notif-toggle').textContent=notif?t('commandes.notifs.actives'):typeof Notification!=='undefined'&&Notification.permission==='denied'?t('commandes.notifs.refusees'):t('commandes.notifs.desactivees');
  const snd=Boolean(window.BureauSounds?.enabled);$('sound-toggle').dataset.actif=String(snd);$('sound-toggle').textContent=window.BureauSounds?(snd?t('commandes.sons.actifs'):t('commandes.sons.inactifs')):t('commandes.sons.absent');$('sound-toggle').disabled=!window.BureauSounds;
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
function toggleHelp(open=$('help').hidden,{auto=false}={}){
  $('help').hidden=!open;$('help-open').setAttribute('aria-expanded',String(open));
  // Ouverture automatique de la première visite : l'aide s'affiche sans voler le focus ni interrompre un lecteur d'écran.
  if(open){if(!auto)$('help-close').focus();try{localStorage.setItem('bureau.aideVue','1');}catch{}}else $('help-open').focus();
}
$('help-open').addEventListener('click',()=>toggleHelp());
$('help-close').addEventListener('click',()=>toggleHelp(false));
// Première visite : l'aide ne s'ouvre pas si DrSmoke a déjà commencé une action (clic, touche, palette).
let acted=false;for(const ev of ['pointerdown','keydown'])addEventListener(ev,()=>{acted=true;},{once:true,capture:true});
try{if(!localStorage.getItem('bureau.aideVue'))setTimeout(()=>{if(!acted&&$('palette').hidden)toggleHelp(true,{auto:true});},900);}catch{}
window.PaletteUi = createPaletteUi({ getState: () => state, t, $, label, canSend, canQueue, selectAgent, showTab, currentTab, openBoard, Scene, CrisisUi, isTilesOn: () => tilesOn, setTiles, toggleHelp, backdrop: (...args) => backdrop(...args) });
const backdrop=(keep=$('palette'))=>[...document.body.children].filter(el=>el!==keep&&el.tagName!=='SCRIPT');
window.DirectionUi = createDirectionUi({ getState: () => state, api: request, t, tServeur, $, bossOf, label, quotaPause, canSend, hhmm, showTab, logSend, outcomeOf, errorText, refreshState, loadQueue: () => QueueUi.load() });
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
  src.textContent=[source,f?t('taches.modifie',{duree:FilesUi.ago(f.modified)}):''].filter(Boolean).join(' · ');
  const ul=document.createElement('ul');for(const t of items){const li=document.createElement('li');li.textContent=t;ul.append(li);}
  sec.append(h,src,items.length?ul:Object.assign(document.createElement('p'),{textContent:t('taches.rien')}));return sec;
}
function renderBoard(){
  const b=boardData,cards=[];
  if(b?.focus)cards.push(boardCard(t('taches.etape_en_cours',{titre:b.focus.title}),'HANDOFF.md',b.focus.items,true));
  if(b?.todo)cards.push(boardCard(t('taches.a_faire_compte',{fait:b.todo.done,total:b.todo.total}),'TODO.md',b.todo.remaining));
  if(b?.roles)cards.push(boardCard(t('taches.roles'),'AGENTS.md',b.roles.items));
  if(b?.lessons)cards.push(boardCard(t('taches.lecons',{total:b.lessons.total}),'LESSONS.md',b.lessons.latest,true));
  if(cards.length)$('board-body').replaceChildren(...cards);
  else{const box=document.createElement('div');$('board-body').replaceChildren(box);errorBlock(box,t('taches.aucun_pilier'),'taches',reloadBoard);}
}
async function openBoard(){
  boardTrigger=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
  for(const el of backdrop($('board')))el.inert=true;
  $('board').hidden=false;$('board-close').focus();
  if(!boardData)$('board-body').replaceChildren(Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:t('taches.lecture_tableau')}));
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
// Une seule couche répond à une touche : palette, puis disposition, puis aide.
addEventListener('keydown',e=>{
  const typing=/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable;
  if(!$('auto').hidden){if(e.key==='Escape'){e.preventDefault();AutoUi.close();}return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&$('board').hidden&&$('crise').hidden){e.preventDefault();$('palette').hidden?PaletteUi.open():PaletteUi.close();return;}
  if(!$('crise').hidden){if(e.key==='Escape'){e.preventDefault();CrisisUi.close();}return;}
  if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='c'&&$('palette').hidden&&$('board').hidden){e.preventDefault();CrisisUi.open();return;}
  if(e.ctrlKey&&!e.shiftKey&&e.key.toLowerCase()==='k'&&!$('crise').hidden){e.preventDefault();return;}
  if(!$('palette').hidden){if(e.key==='Escape'){e.preventDefault();PaletteUi.close();}return;}
  if(!$('board').hidden){if(e.key==='Escape'){e.preventDefault();closeBoard();}return;}
  if(e.key==='Escape'&&Scene.layoutEdit()){Scene.endLayoutEdit();return;}
  if(e.key==='Escape'&&!$('help').hidden)toggleHelp(false);
  else if(e.key==='?'&&!typing&&!e.isComposing){e.preventDefault();toggleHelp();}
});
setInterval(()=>{if(!document.hidden)loadBoard().then(()=>{if(!$('board').hidden)renderBoard();}).catch(()=>{});},60000);
let cycleLent=0;
setInterval(()=>{if(document.hidden)return;QueueUi.load();Scene.renderMail();CrisisUi.load();AutoUi.load();TodosUi.load();loadResponses();if(cycleLent++%3===0){loadDiscussion();loadSante();if(currentTab()==='equipe')loadTreatments();}},5000);
setTimeout(TodosUi.load,1500);setTimeout(loadFooter,1600);setTimeout(CrisisUi.load,1500);
// Écran tactile : on touche un personnage, on ne clique pas (proposition P5 d'OpenCode).
if(matchMedia('(pointer:coarse)').matches){const hint=document.querySelector('.office-bottom>span');if(hint)hint.textContent=hint.textContent.replace('Clique','Touche');}
termPlaceholder($('output').textContent);syncMotion();refreshState().then(()=>loadBoard()).catch(()=>{});
// En arrière-plan, avec les notifications activées, seul l'état des agents est relu (toutes les 15 s) :
// Scene.draw(0) y repère les changements sans animer la scène. Le navigateur peut encore espacer ces relectures.
let hiddenTicks=0;
setInterval(()=>{
  if(!document.hidden){hiddenTicks=0;refreshState();readOutput();return;}
  if(prefs.get('bureau.notifs')==='on'&&++hiddenTicks%5===0)refreshState();
},3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshState();readOutput();}});

// La recherche de release est légère et mise en cache côté serveur.
setTimeout(checkUpdate,3000);
