'use strict';
// Autonomie supervisée (NoBabysitter) : objectif, durée et échanges plafonnés ; tout vient du serveur.
// Dépendances fournies par app.js ; l'état du mode et le formulaire vivent ici.
function createAutoUi({ getState, api, t, $, errorText, backdrop, isCrisisOn, loadQueue, hhmm, DEMANDE_EC }) {
  // Autonomie supervisée (NoBabysitter) : objectif, durée et échanges plafonnés ; tout vient du serveur.
  let autoState={actif:false,journal:[]},autoBusy=false;
  const dureeLabel=min=>min%60===0&&min>=60?t('auto.heures',{n:min/60}):t('auto.minutes',{n:min});
  function resteLabel(iso){const m=Math.max(0,Math.ceil((Date.parse(iso)-Date.now())/60000));return m>=60?Math.floor(m/60)+' h '+String(m%60).padStart(2,'0'):t('auto.minutes',{n:m});}
  async function loadAuto(){
    if(!getState().connected||!getState().token)return;
    try{autoState=await api('/api/autonomie',{headers:{'X-Bureau-Token':getState().token}});syncAuto();}catch{ /* Lecture facultative. */ }
  }
  function syncAuto(){
    const on=autoState.actif===true,btn=$('auto-open');
    btn.dataset.actif=String(on);btn.setAttribute('aria-checked',String(on));
    $('auto-label').textContent=on?t('auto.pill_on',{reste:resteLabel(autoState.finAt),n:autoState.echanges,max:autoState.maxEchanges}):t('auto.pill_off');
    if(!$('auto').hidden)renderAuto();
  }
  function renderAuto(){
    const on=autoState.actif===true,locked=isCrisisOn();
    $('auto-form').hidden=on;$('auto-live').hidden=!on;
    if(on)$('auto-etat').textContent=t('auto.active',{objectif:autoState.objectif})+' — '+t('auto.reste',{reste:resteLabel(autoState.finAt),n:autoState.echanges,max:autoState.maxEchanges});
    $('auto-arret').textContent=!on&&autoState.arret?t('auto.arret_dernier',{motif:autoState.arret}):locked&&!on?t('auto.crise'):'';
    const main=$('auto-main');main.disabled=autoBusy||(locked&&!on);main.className='tool-button'+(on?' danger':'');
    main.textContent=on?t('auto.arreter'):t('auto.lancer');
    const items=Array.isArray(autoState.journal)?autoState.journal.slice().reverse():[];
    $('auto-journal').replaceChildren(...(items.length?items.map(j=>{const li=document.createElement('li');li.textContent=hhmm(new Date(j.at))+' · '+j.texte;return li;}):[Object.assign(document.createElement('li'),{className:'list-placeholder',textContent:t('auto.journal_vide')})]));
  }
  function fillAutoChoices(){
    const m=$('auto-minutes'),e=$('auto-echanges');
    if(!m.options.length){for(const v of [5,15,30,60,120])m.add(new Option(dureeLabel(v),String(v),false,v===30));for(const v of [3,10,20,40,60])e.add(new Option(String(v),String(v),false,v===20));}
    else for(const o of m.options)o.textContent=dureeLabel(Number(o.value));
  }
  // Récapitulatif de fin de mode : texte Markdown fabriqué par le serveur à partir du seul journal.
  async function showRecap(){
    const pre=$('auto-recap');
    try{
      const r=await fetch('/api/autonomie/recap',{headers:{'X-Bureau-Token':getState().token||''},cache:'no-store'});
      if(!r.ok)throw new Error(DEMANDE_EC);
      const texte=(await r.text()).trim();
      pre.textContent=texte||t('auto.recap_vide');pre.hidden=false;
    }catch(error){pre.textContent=errorText(error);pre.hidden=false;}
  }
  let autoTrigger=null;
  function openAuto(){
    autoTrigger=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
    fillAutoChoices();for(const el of backdrop($('auto')))el.inert=true;
    $('auto').hidden=false;$('auto-result').textContent='';$('auto-recap').hidden=true;renderAuto();loadAuto();($('auto-form').hidden?$('auto-main'):$('auto-objectif')).focus();
  }
  function closeAuto(){
    $('auto').hidden=true;for(const el of backdrop($('auto')))el.inert=false;
    (autoTrigger?.isConnected?autoTrigger:$('auto-open')).focus({preventScroll:true});
  }
  async function autoSet(){
    if(autoBusy)return;autoBusy=true;renderAuto();
    try{
      const body=autoState.actif?{actif:false}:{actif:true,objectif:$('auto-objectif').value,minutes:Number($('auto-minutes').value),echanges:Number($('auto-echanges').value)};
      autoState=await api('/api/autonomie',{method:'POST',headers:{'X-Bureau-Token':getState().token,'Content-Type':'application/json'},body:JSON.stringify(body)});
      $('auto-result').textContent='';if(!autoState.actif)$('mail-live').textContent=t('auto.annonce_arret',{motif:autoState.arret||''});
      loadQueue();
    }catch(error){$('auto-result').textContent=errorText(error,'envoi');}
    finally{autoBusy=false;syncAuto();renderAuto();}
  }
  $('auto-recap-btn').addEventListener('click',showRecap);$('auto-open').addEventListener('click',openAuto);$('auto-close').addEventListener('click',closeAuto);$('auto-main').addEventListener('click',autoSet);
  return { load: loadAuto, close: closeAuto };
}
