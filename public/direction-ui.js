'use strict';
// Direction de l'équipe : le chef vient de la règle (premier panneau) ou d'un choix de DrSmoke.
// Dépendances fournies par app.js ; la passation et ses messages vivent ici.
function createDirectionUi({ getState, api, t, tServeur, $, bossOf, label, quotaPause, canSend, hhmm, showTab, logSend, outcomeOf, errorText, refreshState, loadQueue }) {
  // Direction de l'équipe : le chef vient de la règle (premier panneau) ou d'un choix de DrSmoke.
  // Le bureau propose une passation quand le chef est en pause de quota ; il ne décide jamais seul.
  let directionBusy=false,handoff=null;
  function renderDirection(){
    const on=getState().connected&&getState().agents.length>1,boss=on?bossOf(getState().agents):null,d=getState().direction;
    const pick=$('direction-pick'),others=on?getState().agents.filter(a=>a!==boss):[],key=others.map(a=>a.id+label(a)).join('|');
    $('direction-now').textContent=!on?t('direction.deux_agents'):t(quotaPause(boss)?(d?.source==='choix'?(d.since?'direction.choix_depuis_pause':'direction.choix_pause'):'direction.regle_pause'):(d?.source==='choix'?(d.since?'direction.choix_depuis':'direction.choix'):'direction.regle'),{nom:boss.name,heure:d?.since?hhmm(new Date(d.since)):'',suppleant:''});
    if(pick.dataset.key!==key){const keep=pick.value;pick.dataset.key=key;pick.replaceChildren(...others.map(a=>Object.assign(document.createElement('option'),{value:a.id,textContent:a.name+' · '+label(a).toLowerCase()})));if(others.some(a=>a.id===keep))pick.value=keep;}
    $('direction-set').disabled=!others.length||directionBusy;pick.disabled=!others.length;
    $('direction-reset').hidden=d?.source!=='choix';$('direction-reset').disabled=directionBusy;
    // Proposition dans le bandeau d'attention : chef en pause, au moins un suppléant disponible.
    const free=on&&quotaPause(boss)?others.find(canSend):null,banner=$('direction-banner');
    if(free&&banner?.dataset.target!==free.id){
      const box=banner||Object.assign(document.createElement('div'),{id:'direction-banner',className:'direction-banner'});box.setAttribute('role','status');box.dataset.target=free.id;
      const p=document.createElement('span');p.textContent=t('direction.banniere',{chef:boss.name,suppleant:free.name});
      const go=document.createElement('button');go.type='button';go.className='tool-button';go.textContent=t('direction.voir_proposition');
      go.addEventListener('click',()=>{showTab('equipe');$('direction-pick').value=free.id;$('direction').scrollIntoView({block:'start'});$('direction-set').focus({preventScroll:true});});
      box.replaceChildren(p,go);if(!banner)document.querySelector('.office-frame').after(box);
    }else if(!free&&banner)banner.remove();
  }
  function directionMessage(from,to){
    return from?t('direction.passe_remplace',{nom:to.name,ancien:from.name}):t('direction.passe',{nom:to.name});
  }
  async function setDirection(agentId){
    directionBusy=true;renderDirection();$('direction-result').hidden=true;const before=bossOf(getState().agents);
    try{
      await api('/api/direction',agentId?{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':getState().token},body:JSON.stringify({agentId})}:{method:'DELETE',headers:{'X-Bureau-Token':getState().token}});
      await refreshState();
      const now=bossOf(getState().agents);
      $('direction-result').className='files-result';$('direction-result').textContent=now?t('direction.desormais',{nom:now.name}):t('direction.mise_a_jour');$('direction-result').hidden=false;
      // Passation : message écrit par le bureau, relu et envoyé (ou non) par DrSmoke.
      if(now&&before&&now.id!==before.id){handoff={to:now.id};$('direction-message').value=directionMessage(before,now);$('direction-handoff').hidden=false;$('direction-message').focus({preventScroll:true});}
    }catch(error){$('direction-result').className='files-result error';$('direction-result').textContent=errorText(error);$('direction-result').hidden=false;}
    finally{directionBusy=false;renderDirection();}
  }
  $('direction-set').addEventListener('click',()=>{const id=$('direction-pick').value;if(id)setDirection(id);});
  $('direction-reset').addEventListener('click',()=>setDirection(null));
  $('direction-skip').addEventListener('click',()=>{handoff=null;$('direction-handoff').hidden=true;$('direction-set').focus({preventScroll:true});});
  $('direction-send').addEventListener('click',async()=>{
    const a=handoff&&getState().agents.find(x=>x.id===handoff.to),message=$('direction-message').value.trim();if(!a||!message)return;
    $('direction-send').disabled=true;
    try{
      // Agent disponible : envoi direct ; sinon la passation attend dans la file, en tête.
      const direct=canSend(a),data=direct?await api('/api/prompt',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':getState().token},body:JSON.stringify({id:a.id,message})})
        :await api('/api/queue',{method:'POST',headers:{'Content-Type':'application/json','X-Bureau-Token':getState().token},body:JSON.stringify({id:a.id,message,priority:'haute'})});
      if(direct)logSend([a.name],message,'sent',tServeur(data.message||'')||t('consigne.transmise_herdr'));else loadQueue();
      $('direction-result').className='files-result';$('direction-result').textContent=direct?t('direction.transmise',{nom:a.name}):t('direction.en_file',{nom:a.name});$('direction-result').hidden=false;
      handoff=null;$('direction-handoff').hidden=true;
    }catch(error){if(canSend(a))logSend([a.name],message,outcomeOf(error),errorText(error));$('direction-result').className='files-result error';$('direction-result').textContent=errorText(error);$('direction-result').hidden=false;}
    finally{$('direction-send').disabled=false;}
  });
  return { render: renderDirection, set: setDirection };
}
