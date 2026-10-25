'use strict';
// File d’attente : dépendances fournies par app.js et état relu à chaque appel.
function createQueueUi({ getState, api, t, tServeur, $, errorBlock, errorText, renderStatusbar, activeAgent, hhmm }) {
  const queueLabels={attente:()=>t('equipe.file.attente'),envoyee:()=>t('equipe.file.envoyee'),annulee:()=>t('equipe.file.annulee'),a_revoir:()=>t('equipe.file.a_revoir')};
  let queueItems=[],queueGen=0,queueShown='';
  async function loadQueue(){
    if(!getState().connected||!getState().token){queueShown='';errorBlock($('queue-list'),t('equipe.file_herdr_off'),'file');return;}
    // Seule la lecture la plus récente s'affiche : une réponse lente ne remplace jamais une plus récente.
    const gen=++queueGen;let items;
    try{const lu=await api('/api/queue',{headers:{'X-Bureau-Token':getState().token}});items=lu.items||[];
      // Récupération d'un fichier de file devenu trop gros : le serveur la signale, le bureau l'affiche telle quelle.
      const alerte=typeof lu.alerte?.message==='string'?lu.alerte.message:'';$('queue-alerte').hidden=!alerte;$('queue-alerte').textContent=alerte;}catch(error){if(gen===queueGen){queueShown='';errorBlock($('queue-list'),errorText(error),'file');}return;}
    if(gen!==queueGen)return;
    queueItems=items;renderQueue();renderStatusbar(activeAgent());
  }
  function renderQueue(){
    const list=$('queue-list'),visible=queueItems.filter(q=>q.state!=='annulee').slice(-20).reverse(),waitingN=queueItems.filter(q=>q.state==='attente').length;
    $('queue-count').textContent=waitingN?t('equipe.file_en_attente',{n:waitingN}):'';
    const shown=JSON.stringify([visible,getState().agents.map(a=>a.id+a.name)]);if(shown===queueShown)return;queueShown=shown;
    if(!visible.length){const li=document.createElement('li');li.className='list-placeholder';li.textContent=t('equipe.file_vide');list.replaceChildren(li);return;}
    const focusedItem=document.activeElement?.closest?.('#queue-list [data-item]')?.dataset.item,focusedIndex=focusedItem?[...document.activeElement.parentElement.children].indexOf(document.activeElement)+1:1;
    list.replaceChildren(...visible.map(q=>{
      const agent=getState().agents.find(a=>a.id===q.id),li=document.createElement('li');li.className='queue-item '+q.state;li.dataset.item=q.itemId;
      const head=document.createElement('span');head.className='log-head';
      const headParts=[t('equipe.file.entete',{nom:agent?.name||t('equipe.agent_disparu'),etat:(queueLabels[q.state]||(()=>undefined))()})];
      if(q.state==='attente'&&q.notBefore&&new Date(q.notBefore)>Date.now())headParts.push(t('equipe.file.pas_avant',{heure:hhmm(new Date(q.notBefore))}));
      if(q.sentAt)headParts.push(hhmm(new Date(q.sentAt)));
      head.textContent=headParts.join(' · ');
      const body=document.createElement('span');body.className='log-body';body.textContent=q.message.length>140?q.message.slice(0,140)+'…':q.message;
      if(q.priority==='haute'){const tag=document.createElement('span');tag.className='prio';tag.textContent=t('equipe.prioritaire');head.prepend(tag,' · ');}
      li.append(head,body);
      if(q.files?.length){const names=q.copiedFiles?.length?q.copiedFiles.map(f=>f.name).join(', '):q.files.map(f=>f.path.split(/[/\\]/).pop()).join(', ');const att=document.createElement('span');att.className='log-why';att.textContent=q.files.length>1?(q.copiedFiles?.length?t('equipe.joint.autres',{liste:names}):t('equipe.joint.autres_depart',{liste:names})):(q.copiedFiles?.length?t('equipe.joint.un',{liste:names}):t('equipe.joint.un_depart',{liste:names}));li.append(att);}
      if(q.reason){const why=document.createElement('span');why.className='log-why';why.textContent=tServeur(q.reason);li.append(why);}
      if(q.state==='attente'){
        const tools=document.createElement('div');tools.className='queue-tools';
        const high=q.priority==='haute',prio=document.createElement('button');prio.type='button';prio.className='tool-button';prio.textContent=high?t('equipe.file.normal'):t('equipe.file.tete');
        prio.addEventListener('click',async()=>{try{await api('/api/queue/priority',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':getState().token},body:JSON.stringify({itemId:q.itemId,priority:high?'normale':'haute'})});}catch(error){head.textContent=errorText(error);}loadQueue();});
        const cancel=document.createElement('button');cancel.type='button';cancel.className='tool-button';cancel.textContent=t('equipe.file.retirer');
        cancel.addEventListener('click',async()=>{try{await api('/api/queue/cancel',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':getState().token},body:JSON.stringify({itemId:q.itemId})});}catch(error){head.textContent=errorText(error,'envoi');}loadQueue();});
        tools.append(prio,cancel);li.append(tools);
      }
      return li;
    }));
    if(focusedItem)(list.querySelector('[data-item="'+CSS.escape(focusedItem)+'"] button:nth-of-type('+focusedIndex+')')||list.querySelector('[data-item="'+CSS.escape(focusedItem)+'"] button'))?.focus({preventScroll:true});
  }
  return { load: loadQueue, render: renderQueue, get items() { return queueItems; } };
}
