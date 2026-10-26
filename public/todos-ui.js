'use strict';
// Tâches : cases des fichiers du projet, plans publiés par les agents et demandes envoyées (courrier et file).
// Dépendances fournies par app.js ; l'état affiché et le dernier résultat lu vivent ici.
function createTodosUi({ getState, api, t, $, errorBlock, errorText, renderStatusbar, activeAgent, agentByTarget, getQueueItems, getDiscData }) {
  let todosGen = 0, todosShown = '', todosData = null;
  // Tâches : cases réelles des fichiers du projet et plans publiés par les agents.
  // Le pourcentage est un simple rapport de cases cochées sur cases totales, jamais une estimation.
  const pct=(done,total)=>total?Math.round(done/total*100):0;
  function planOf(id){const steps=todosData?.agents?.[id];if(!steps?.length)return null;const done=steps.filter(s=>s.status==='completed').length;return{done,total:steps.length,pct:pct(done,steps.length)};}
  // Demandes envoyées aux agents (courrier du chef et file d'attente) : à faire tant que l'agent n'a pas rendu
  // de réponse terminée après l'envoi, réalisée ensuite. Rien n'est coché sans cette preuve.
  function demandes(){
    const bulles=getDiscData()?.bulles||[],limite=Date.now()-12*3600000,vues=new Set(),out=[];
    const fini=(id,at)=>bulles.some(b=>b.id===id&&b.state==='terminée'&&Date.parse(b.at)>Date.parse(at));
    const ajoute=(clef,agent,texte,at)=>{
      if(!agent||!at||vues.has(clef)||Date.parse(at)<limite)return;vues.add(clef);
      out.push({at:Date.parse(at),text:t('taches.demande',{nom:agent.name,titre:texte.length>110?texte.slice(0,110)+'…':texte}),done:fini(agent.id,at),source:t('taches.demandes_source')});
    };
    for(const a of getState().agents)for(const d of Array.isArray(a.delegations)?a.delegations:[])if(d&&d.title)ajoute('d'+d.id,agentByTarget(d.target),d.title,d.at);
    for(const q of getQueueItems()){if(q.state==='annulee'||typeof q.message!=='string')continue;ajoute('q'+q.itemId,getState().agents.find(a=>a.id===q.id),q.message,q.sentAt||q.createdAt||q.notBefore);}
    return out.sort((x,y)=>y.at-x.at).slice(0,15).map(({at,...rest})=>rest);
  }
  async function loadTodos(){
    if(!getState().connected||!getState().token){todosShown='';$('tasks-progress').replaceChildren();errorBlock($('tasks-project'),t('taches.herdr_off'),'taches');$('tasks-agents').replaceChildren(Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:t('taches.plans_non_charges')}));return;}
    const gen=++todosGen;let data;
    try{data=await api('/api/todos',{headers:{'X-Bureau-Token':getState().token}});}catch(error){if(gen!==todosGen)return;todosData=null;todosShown='';$('tasks-progress').replaceChildren();errorBlock($('tasks-project'),errorText(error),'taches');$('tasks-agents').replaceChildren(Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:t('taches.plans_non_charges')}));return;}
    data.project=[...demandes(),...(data.project||[])];
    const shown=JSON.stringify([data,getState().agents.map(a=>a.id+a.name)]);if(gen!==todosGen||shown===todosShown)return;todosShown=shown;todosData=data;renderStatusbar(activeAgent());
    const project=data.project||[],done=project.filter(t=>t.done).length;
    const prog=$('tasks-progress');prog.replaceChildren();
    if(project.length){
      const label=document.createElement('div');label.className='limit-head';
      const l1=document.createElement('span');l1.textContent=t('taches.cases_projet');const l2=document.createElement('b');l2.textContent=t('taches.projet_progression',{coches:done,total:project.length,pct:pct(done,project.length)});label.append(l1,l2);
      const track=document.createElement('div');track.className='limit-track';const bar=document.createElement('i');bar.style.width=(done/project.length*100)+'%';track.append(bar);prog.append(label,track);
    }
    const groups=new Map();for(const t of project){if(!groups.has(t.source))groups.set(t.source,[]);groups.get(t.source).push(t);}
    $('tasks-project').replaceChildren(...[...groups].map(([source,items])=>{
      const sec=document.createElement('section');sec.className='task-group';
      const d=items.filter(t=>t.done).length;
      const h=document.createElement('h3');h.textContent=t('taches.groupe',{source,fait:d,total:items.length,pct:pct(d,items.length)});
      const track=document.createElement('div');track.className='limit-track';track.setAttribute('role','img');track.setAttribute('aria-label',t('taches.groupe_aria',{source,pct:pct(d,items.length)}));const bar=document.createElement('i');bar.style.width=pct(d,items.length)+'%';track.append(bar);
      sec.append(h,track);
      for(const [title,list] of [[t('taches.a_faire'),items.filter(t=>!t.done)],[t('taches.realisees'),items.filter(t=>t.done)]]){
        if(!list.length)continue;
        const sub=document.createElement('h4');sub.className='task-sub';sub.textContent=t('taches.compte',{titre:title,n:list.length});
        const ul=document.createElement('ul');ul.className='task-list';
        for(const item of list){const li=document.createElement('li');li.className=item.done?'done':'';const box=document.createElement('span');box.className='box';box.setAttribute('aria-hidden','true');const tx=document.createElement('span');tx.textContent=item.text;li.append(box,tx);li.setAttribute('aria-label',item.done?t('taches.aria_fait',{texte:item.text}):t('taches.aria_a_faire',{texte:item.text}));ul.append(li);}
        sec.append(sub,ul);
      }
      return sec;
    }));
    if(!project.length)$('tasks-project').textContent=t('taches.aucune_case');
    const agents=Object.entries(data.agents||{}).filter(([,steps])=>steps?.length);
    const statusLabel={pending:()=>t('taches.statut.a_faire'),in_progress:()=>t('taches.statut.en_cours'),completed:()=>t('taches.statut.fait')};
    $('tasks-agents').replaceChildren(...(agents.length?agents.map(([id,steps])=>{
      const sec=document.createElement('section');sec.className='task-group';const h=document.createElement('h3');const dn=steps.filter(s=>s.status==='completed').length;h.textContent=t('taches.groupe_agent',{nom:(getState().agents.find(a=>a.id===id)?.name)||t('taches.agent'),fait:dn,total:steps.length,pct:pct(dn,steps.length)});
      const ul=document.createElement('ul');ul.className='task-list';
      for(const s of steps){const li=document.createElement('li');li.className=s.status==='completed'?'done':s.status==='in_progress'?'doing':'';const box=document.createElement('span');box.className='box';const tx=document.createElement('span');tx.textContent=t('taches.etape',{texte:s.text,statut:(statusLabel[s.status]||(()=>s.status))()});li.append(box,tx);ul.append(li);}
      sec.append(h,ul);return sec;
    }):[Object.assign(document.createElement('p'),{className:'list-placeholder',textContent:t('taches.aucun_plan')})]));
  }
  return { load: loadTodos, planOf, get data() { return todosData; } };
}
