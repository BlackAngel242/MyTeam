'use strict';
// Salle de crise : verrou général des envois, diagnostic calme, interruption polie par agent.
// Dépendances fournies par app.js ; l'état de la salle vit ici.
function createCrisisUi({ getState, api, t, $, errorText, updateForm, renderBroadcast, backdrop, getQueueItems, hhmm, label, splitChrome, tServeur }) {
  let crisisState = null;
  const crisisOn = () => crisisState?.active === true;
  // Salle de crise : verrou général des envois, diagnostic calme, interruption polie par agent (jamais un arrêt brutal).
  let criseArmed=null,criseStopArmed=null,criseBusy=false,criseTrigger=null;
  const criseTails=new Map();
  async function loadCrisis(){
    if(!getState().connected||!getState().token)return;
    try{
      const c=await api('/api/crise',{headers:{'X-Bureau-Token':getState().token}});
      const was=crisisOn();crisisState={active:c.active===true,since:c.since||null,reason:c.reason||null};
      syncCrisis();if(was!==crisisOn()){updateForm();renderBroadcast();}
    }catch{ /* Lecture facultative : sans réponse, l'état précédent est conservé. */ }
  }
  function syncCrisis(){
    const on=crisisOn();document.body.classList.toggle('crise',on);
    $('crise-open').dataset.actif=String(on);$('crise-open').querySelector('span').textContent=on?t('equipe.crise.en_cours'):t('equipe.crise.titre');
    $('crise-banner').hidden=!on;
    if(on)$('crise-banner-text').textContent=crisisState.reason?(crisisState.since?t('equipe.crise.banniere_depuis_raison',{heure:hhmm(new Date(crisisState.since)),raison:tServeur(crisisState.reason)}):t('equipe.crise.banniere_raison',{raison:tServeur(crisisState.reason)})):(crisisState.since?t('equipe.crise.banniere_depuis',{heure:hhmm(new Date(crisisState.since))}):t('equipe.crise.banniere'));
    if(!$('crise').hidden)renderCrisis();
  }
  async function criseSet(active){
    if(criseBusy)return;criseBusy=true;renderCrisis();
    try{await api('/api/crise',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':getState().token},body:JSON.stringify({active})});await loadCrisis();$('crise-result').textContent=active?t('equipe.crise.enclenchee'):t('equipe.crise.levee');}
    catch(error){$('crise-result').textContent=errorText(error,'envoi');}
    finally{criseBusy=false;renderCrisis();}
  }
  async function criseStop(agent){
    if(criseBusy)return;criseBusy=true;renderCrisis();
    try{await api('/api/crise/arret',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':getState().token},body:JSON.stringify({id:agent.id})});$('crise-result').textContent=t('equipe.crise.interruption',{nom:agent.name});}
    catch(error){$('crise-result').textContent=errorText(error,'envoi');}
    finally{criseStopArmed=null;criseBusy=false;renderCrisis();}
  }
  function renderCrisis(){
    const on=crisisOn();
    $('crise-state').textContent=on?t('equipe.crise.active'):t('equipe.crise.aucune');
    const main=$('crise-main');main.disabled=criseBusy;main.className='tool-button'+(on?'':' danger');
    main.textContent=on?t('equipe.crise.lever'):criseArmed?t('equipe.crise.confirmer'):t('equipe.crise.enclencher');
    const waiting=getQueueItems().filter(q=>q.state==='attente').length;
    $('crise-queue').textContent=waiting?(waiting>1?t('equipe.crise.file.autres',{n:waiting}):t('equipe.crise.file.un',{n:waiting})):t('equipe.crise.file_vide');
    $('crise-agents').replaceChildren(...getState().agents.map(a=>{
      const li=document.createElement('li'),head=document.createElement('span');head.className='crise-agent';head.textContent=[t('equipe.choix',{nom:a.name,etat:label(a).toLowerCase()}),a.paneId].filter(Boolean).join(' · ');
      const tail=document.createElement('pre');tail.className='crise-tail';tail.textContent=criseTails.get(a.id)||t('equipe.crise.lecture');
      li.append(head,tail);
      if(on){
        const b=document.createElement('button');b.type='button';b.className='tool-button';b.disabled=criseBusy;
        b.textContent=criseStopArmed===a.id?t('equipe.crise.confirmer_interrompre',{nom:a.name}):t('equipe.crise.arreter');
        b.addEventListener('click',()=>{if(criseStopArmed===a.id)criseStop(a);else{criseStopArmed=a.id;renderCrisis();setTimeout(()=>{if(criseStopArmed===a.id){criseStopArmed=null;renderCrisis();}},5000);}});
        li.append(b);
      }
      return li;
    }));
  }
  async function loadCrisisTails(){
    await Promise.all(getState().agents.map(async a=>{
      try{const d=await api('/api/read?id='+encodeURIComponent(a.id),{headers:{'X-Bureau-Token':getState().token||''}});criseTails.set(a.id,splitChrome(d.text||'').body.trim().split('\n').filter(Boolean).slice(-4).join('\n')||t('equipe.crise.sans_sortie'));}
      catch{criseTails.set(a.id,t('equipe.crise.lecture_impossible'));}
    }));
    if(!$('crise').hidden)renderCrisis();
  }
  function openCrisis(){
    criseTrigger=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
    for(const el of backdrop($('crise')))el.inert=true;
    $('crise').hidden=false;$('crise-result').textContent='';criseArmed=null;criseStopArmed=null;renderCrisis();loadCrisis();loadCrisisTails();$('crise-main').focus();
  }
  function closeCrisis(){
    $('crise').hidden=true;for(const el of backdrop($('crise')))el.inert=false;criseArmed=null;criseStopArmed=null;
    (criseTrigger?.isConnected?criseTrigger:$('crise-open')).focus({preventScroll:true});
  }
  $('crise-open').addEventListener('click',openCrisis);
  $('crise-close').addEventListener('click',closeCrisis);
  $('crise-banner-open').addEventListener('click',openCrisis);
  $('crise-main').addEventListener('click',()=>{
    if(crisisOn())return criseSet(false);
    if(criseArmed){clearTimeout(criseArmed);criseArmed=null;return criseSet(true);}
    criseArmed=setTimeout(()=>{criseArmed=null;renderCrisis();},5000);renderCrisis();
  });
  return { load: loadCrisis, isOn: crisisOn, open: openCrisis, close: closeCrisis };
}
