'use strict';
const $ = id => document.getElementById(id);
const canvas = $('office'), ctx = canvas.getContext('2d');
const colors = ['#a0dfc4','#b5b0e8','#edbb87','#8ebfe0','#d8a5bf','#c8d18e'];
const drafts = new Map();
let state = { connected:false, agents:[], token:null }, selected = null, stateBusy = false, readBusy = false, sending = false, readSequence = 0, spots = [];
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let paused = motionPreference.matches;
const labels = { idle:'Disponible', done:'Terminé', busy:'Au travail', working:'Au travail', running:'Au travail', waiting:'Attend une réponse', blocked:'Attend une réponse', unknown:'État inconnu', stopped:'Arrêté' };
const label = a => labels[a.status] || 'État inconnu';
const tint = a => ['busy','working','running'].includes(a.status) ? '#9dbbff' : ['idle','done'].includes(a.status) ? '#a0dfc4' : ['waiting','blocked'].includes(a.status) ? '#f4c780' : '#a7b8ce';
const activeAgent = () => state.agents.find(a => a.id === selected);
const canSend = a => Boolean(state.connected && a && a.ready && ['idle','done'].includes(a.status));
const paint = (x,y,w,h,color) => {ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal:AbortSignal.timeout(url==='/api/prompt'?30000:15000), cache:'no-store' });
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
  $('send-help').textContent = !a ? 'Sélectionne un agent pour lui écrire.' : !state.connected ? 'Envoi indisponible : Herdr est déconnecté.' : !allowed ? 'Cet agent doit être disponible pour recevoir une consigne.' : 'La consigne sera envoyée à ' + a.name + ' dans Herdr.';
}
function renderAgents() {
  const list = $('agents-list'), focused = document.activeElement?.dataset?.agentId;
  list.replaceChildren();
  if (!state.agents.length) {
    const p = document.createElement('p');p.className='list-placeholder';p.textContent=state.connected?'Aucun agent détecté. Ouvre un agent dans Herdr pour lui donner un poste.':'Les postes apparaîtront lorsque Herdr sera connecté.';list.append(p);
  }
  state.agents.forEach((a,i) => {
    const button=document.createElement('button');button.type='button';button.className='agent-button'+(a.id===selected?' selected':'');button.dataset.agentId=a.id;button.setAttribute('aria-pressed',String(a.id===selected));
    const face=document.createElement('span');face.className='pixel-face';face.style.setProperty('--agent-color',colors[i%colors.length]);face.setAttribute('aria-hidden','true');
    const text=document.createElement('span'), name=document.createElement('span'), status=document.createElement('span');name.className='agent-name';name.textContent=a.name;status.className='agent-status';status.textContent=state.connected?label(a):'Connexion perdue';text.append(name,status);button.append(face,text);button.addEventListener('click',()=>selectAgent(a.id));list.append(button);
  });
  if(focused) [...list.children].find(e=>e.dataset.agentId===focused)?.focus({preventScroll:true});
  const a=activeAgent();
  $('detail-title').textContent=a?a.name:'Choisis un agent';
  $('detail-status').textContent=a?(state.connected?label(a):'Connexion perdue'):'Son poste s’ouvrira ici.';
  $('detail-dot').style.background=a?tint(a):'#71839a';
  $('detail-avatar').style.color=a?colors[state.agents.indexOf(a)%colors.length]:'#a0dfc4';
  $('agent-meta').hidden=!a;
  if(a){$('agent-kind').textContent=a.kind||'Non précisé';$('agent-cwd').textContent=a.cwd||'Non précisé';}
  updateForm();
}
function selectAgent(id) {
  if(id===selected)return;
  if(selected) drafts.set(selected,$('message').value);
  selected=id;readSequence++;
  $('message').value=drafts.get(id)||'';$('send-result').hidden=true;
  $('output').textContent='Lecture des dernières sorties…';$('read-state').textContent='Lecture en cours…';
  renderAgents();readOutput();draw(0);
}
async function refreshState() {
  if(stateBusy)return;stateBusy=true;$('refresh').disabled=true;
  try {
    const data=await request('/api/state');
    state={...data,agents:Array.isArray(data.agents)?data.agents:[]};
    if(selected&&!activeAgent()) {
      drafts.set(selected,$('message').value);selected=null;readSequence++;$('message').value='';$('output').textContent='Cet agent a quitté Herdr. Sélectionne un autre poste.';$('read-state').textContent='Poste fermé';$('send-result').hidden=true;
    }
    $('state-error').hidden=!data.error;$('state-error').textContent=data.error||'';
    $('last-update').textContent='Actualisé à '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }catch(error){
    if(selected)drafts.set(selected,$('message').value);
    state={connected:false,agents:[],token:null};selected=null;readSequence++;$('message').value='';
    $('output').textContent='Connexion perdue. Actualise le bureau pour retrouver les sorties.';$('read-state').textContent='Lecture indisponible';
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
    const output=$('output'),atBottom=output.scrollHeight-output.scrollTop-output.clientHeight<45;
    output.textContent=data.text||'Le terminal de cet agent n’a pas encore de sortie.';
    if(atBottom)output.scrollTop=output.scrollHeight;
    $('read-state').textContent='Lecture actualisée';
    $('read-note').textContent=data.truncated?'Extrait des dernières lignes du terminal. Les lignes plus anciennes ne sont pas affichées.':'Les sorties viennent directement du terminal de l’agent.';
  }catch(error){if(id===selected&&sequence===readSequence){$('read-state').textContent='Lecture indisponible';$('output').textContent=errorText(error);}}
  finally{readBusy=false;if(id!==selected&&selected)readOutput();}
}
$('message').addEventListener('input',()=>{if(selected)drafts.set(selected,$('message').value);updateForm();});
$('prompt-form').addEventListener('submit',async event=>{
  event.preventDefault();const a=activeAgent(),message=$('message').value.trim();if(!canSend(a)||sending||!message)return;
  const target=a.id;sending=true;updateForm();$('send-result').hidden=true;
  try{
    const data=await request('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':state.token},body:JSON.stringify({id:target,message})});
    drafts.delete(target);
    if(target===selected){$('message').value='';$('send-result').className='';$('send-result').textContent=data.message||'Consigne transmise à Herdr.';$('send-result').hidden=false;}
    await refreshState();
  }catch(error){if(target===selected){$('send-result').className='error';$('send-result').textContent=errorText(error)+' Vérifie les sorties de l’agent avant de renvoyer : la consigne peut avoir été reçue.';$('send-result').hidden=false;}}
  finally{sending=false;updateForm();}
});
$('refresh').addEventListener('click',async()=>{await refreshState();readOutput();});
function syncMotion(){ $('motion').setAttribute('aria-pressed',String(paused));$('motion').querySelector('span').textContent=paused?'Animer le bureau':'Mettre en pause';$('motion').querySelector('path').setAttribute('d',paused?'m8 5 11 7-11 7V5':'M8 5v14M16 5v14');draw(0); }
$('motion').addEventListener('click',()=>{paused=!paused;syncMotion();});
motionPreference.addEventListener('change',event=>{paused=event.matches;syncMotion();});
function plant(x,y){paint(x+5,y+26,24,22,'#bf9279');paint(x+2,y+22,30,7,'#d1a48a');paint(x+14,y,7,27,'#579a89');paint(x+2,y+5,12,13,'#75b69b');paint(x+20,y+8,12,13,'#3e7d75');paint(x+7,y-5,12,12,'#91bea2');}
function windowPixel(x,y){paint(x-6,y-6,166,130,'#0e192c');paint(x,y,154,118,'#2b4566');paint(x+5,y+5,144,108,'#172c4a');paint(x+9,y+65,20,43,'#263f60');paint(x+34,y+46,22,62,'#244263');paint(x+61,y+74,27,34,'#305170');paint(x+96,y+36,22,72,'#254361');paint(x+124,y+58,15,50,'#2e4d6d');paint(x+107,y+12,11,11,'#dbcda2');paint(x+75,y,5,118,'#49617a');paint(x,y+59,154,5,'#49617a');paint(x-9,y+118,172,8,'#5c7085');}
function character(x,y,color,a,time){
  const work=state.connected&&['busy','working','running'].includes(a.status),bounce=work&&!paused?Math.floor(Math.sin(time/180)*2):0;
  paint(x-12,y+35,42,8,'#122137');paint(x-4,y+23,10,17,'#1b2941');paint(x+15,y+23,10,17,'#1b2941');paint(x-5,y+34,12,5,'#a0b5c5');paint(x+15,y+34,12,5,'#a0b5c5');
  paint(x-8,y+5,37,24,color);paint(x-14,y+8+bounce,7,16,color);paint(x+29,y+8-bounce,7,16,color);paint(x-14,y+21+bounce,7,6,'#debba6');paint(x+29,y+21-bounce,7,6,'#debba6');
  paint(x,y-18+bounce,22,26,'#debba6');paint(x-4,y-20+bounce,29,10,'#26374d');paint(x-4,y-14+bounce,6,13,'#26374d');paint(x+4,y-7+bounce,4,4,'#1a2638');paint(x+16,y-7+bounce,4,4,'#1a2638');paint(x+8,y+1+bounce,8,3,'#a36e65');
}
function workstation(a,i,x,y,time){
  const chosen=a.id===selected,color=colors[i%colors.length];
  if(chosen){paint(x-66,y-62,186,157,'#486d79');paint(x-62,y-58,178,149,'#20394b');}
  paint(x-49,y+34,155,14,'#152237');paint(x-49,y-4,10,49,'#5c5760');paint(x+86,y-4,10,49,'#5c5760');paint(x-57,y-15,166,22,'#a18d7f');paint(x-57,y+1,166,7,'#726879');
  paint(x-13,y-62,78,49,'#101a2b');paint(x-9,y-58,70,39,state.connected?'#254d64':'#293748');paint(x+20,y-13,12,6,'#25364b');paint(x+7,y-7,37,4,'#25364b');
  if(state.connected){paint(x-3,y-50,25,3,color);paint(x-3,y-43,47,3,'#75a0b7');paint(x-3,y-36,35,3,'#75a0b7');if(!paused&&['busy','working','running'].includes(a.status))paint(x-3+(Math.floor(time/400)%4)*8,y-28,6,3,color);}
  paint(x-19,y+8,85,8,'#566477');paint(x-15,y+10,77,2,'#8191a0');paint(x+80,y-32,10,17,'#d5c2a5');paint(x+90,y-28,5,7,'#a68c78');
  paint(x-8,y+30,49,44,'#203851');paint(x-13,y+24,59,12,'#3d5670');
  character(x+3,y+27,color,a,time);
  ctx.font='12px Bureau, Segoe UI, sans-serif';ctx.textAlign='center';ctx.fillStyle=chosen?'#e8fff4':'#c4d2e4';
  let name=a.name;while(ctx.measureText(name).width>145&&name.length>3)name=name.slice(0,-2)+'…';ctx.fillText(name,x+26,y+97);
  paint(x+72,y-56,7,7,state.connected?tint(a):'#71839a');
  spots.push({x:x-62,y:y-65,w:175,h:171,id:a.id});
}
function draw(time){
  const agents=state.agents,columns=agents.length>8?4:3,rows=Math.max(2,Math.ceil(agents.length/columns));
  const sceneHeight=620+Math.max(0,rows-2)*170;
  if(canvas.height!==sceneHeight){canvas.height=sceneHeight;canvas.parentElement.style.aspectRatio='1000 / '+sceneHeight;}
  ctx.imageSmoothingEnabled=false;spots=[];
  paint(0,0,1000,sceneHeight,'#152239');paint(0,0,1000,220,'#22344c');paint(0,211,1000,12,'#455971');paint(0,223,1000,sceneHeight-223,'#26364a');
  for(let y=226;y<sceneHeight;y+=46){paint(0,y,1000,2,'#2e4054');for(let x=(y%92?0:61);x<1000;x+=123)paint(x,y,2,46,'#2e4054');}
  paint(55,37,3,149,'#31465f');paint(949,37,3,149,'#31465f');windowPixel(108,48);windowPixel(337,48);windowPixel(566,48);
  paint(794,52,113,79,'#17243b');paint(800,58,101,67,'#647579');paint(808,66,36,24,'#dbc6a0');paint(852,66,38,8,'#9fc2b0');paint(852,81,29,7,'#9fc2b0');paint(808,98,80,4,'#b1c7be');paint(808,108,60,4,'#b1c7be');
  paint(781,154,136,48,'#535565');paint(773,146,151,12,'#ac9680');paint(789,166,37,26,'#354254');paint(835,166,33,26,'#354254');paint(877,166,33,26,'#354254');plant(874,102);
  paint(55,248,41,111,'#132238');plant(57,225);paint(909,485,45,65,'#142237');plant(915,471);
  paint(330,255,350,289,'#304459');paint(339,263,332,273,'#344b60');paint(347,271,316,257,'#30465b');
  const stepX=columns===4?208:266,stepY=170;
  agents.forEach((a,i)=>workstation(a,i,columns===4?151+(i%columns)*stepX:204+(i%columns)*stepX,302+Math.floor(i/columns)*stepY,time));
  if(!agents.length){paint(323,317,354,20,'#958679');paint(335,337,13,86,'#635f64');paint(651,337,13,86,'#635f64');paint(448,285,97,31,'#122239');paint(453,290,87,21,'#294156');paint(490,316,12,7,'#17293d');}
  paint(54,530,143,42,'#1b2c42');paint(62,518,127,42,'#52647b');paint(62,526,58,27,'#677b91');paint(128,526,53,27,'#677b91');paint(54,536,12,34,'#415369');paint(185,536,12,34,'#415369');paint(70,568,9,12,'#152239');paint(174,568,9,12,'#152239');
  paint(802,574,115,15,'#17283c');paint(809,565,101,15,'#6a6d74');ctx.font='10px Bureau, Segoe UI, sans-serif';ctx.textAlign='center';ctx.fillStyle='#c5d3dc';ctx.fillText('LE BUREAU DE DRSMOKE',860,576);
}
canvas.addEventListener('click',event=>{const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*1000/r.width,y=(event.clientY-r.top)*canvas.height/r.height;const spot=spots.find(s=>x>=s.x&&x<=s.x+s.w&&y>=s.y&&y<=s.y+s.h);if(spot)selectAgent(spot.id);});
canvas.addEventListener('mousemove',event=>{const r=canvas.getBoundingClientRect(),x=(event.clientX-r.left)*1000/r.width,y=(event.clientY-r.top)*canvas.height/r.height;canvas.style.cursor=spots.some(s=>x>=s.x&&x<=s.x+s.w&&y>=s.y&&y<=s.y+s.h)?'pointer':'default';});
let lastFrame=0;
function frame(time){if(!paused&&time-lastFrame>80){draw(time);lastFrame=time;}requestAnimationFrame(frame);}
syncMotion();refreshState();requestAnimationFrame(frame);
setInterval(()=>{if(!document.hidden){refreshState();readOutput();}},3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshState();readOutput();}});
