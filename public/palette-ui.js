'use strict';
// Palette de commandes (Ctrl+K) : actions du bureau au clavier, construites à partir des agents réels.
// Dépendances fournies par app.js ; le clavier global et le fond inerte restent dans app.js.
function createPaletteUi({ getState, t, $, label, canSend, canQueue, selectAgent, showTab, currentTab, openBoard, Scene, CrisisUi, isTilesOn, setTiles, toggleHelp, backdrop }) {
  // Palette de commandes (Ctrl+K) : toutes les actions du bureau au clavier, construites à partir des agents réels.
  let paletteIndex=0,paletteItems=[];
  function commands(){
    const list=[];
    for(const a of getState().agents){
      list.push({label:t('commandes.ouvrir_poste',{nom:a.name}),hint:label(a),run:()=>{selectAgent(a.id);showTab('poste');}});
      if(canSend(a)||canQueue(a))list.push({label:canSend(a)?t('commandes.ecrire',{nom:a.name}):t('commandes.mettre_file',{nom:a.name}),hint:label(a),run:()=>{selectAgent(a.id);showTab('poste');setTimeout(()=>$('message').focus(),50);}});
      // La sélection rouvre l'onglet Poste au tour suivant : on passe aux fichiers juste après.
      list.push({label:t('commandes.fichiers_de',{nom:a.name}),hint:t('commandes.hint_fichiers'),run:()=>{selectAgent(a.id);setTimeout(()=>showTab('fichiers'),0);}});
    }
    list.push({label:t('commandes.message_plusieurs'),hint:t('commandes.hint_equipe'),run:()=>{showTab('equipe');setTimeout(()=>$('broadcast-message').focus(),50);}});
    list.push({label:t('commandes.courrier'),hint:t('commandes.hint_equipe'),run:()=>{showTab('equipe');$('mailbox').scrollIntoView({block:'start'});}});
    list.push({label:t('commandes.file'),hint:t('commandes.hint_equipe'),run:()=>{showTab('equipe');$('queue-list').scrollIntoView({block:'start'});}});
    list.push({label:t('equipe.tableau_titre'),hint:t('commandes.hint_memoire'),run:()=>setTimeout(openBoard,0)});
    list.push({label:t('commandes.taches'),hint:t('commandes.hint_taches'),run:()=>showTab('taches')});
    list.push({label:Scene.layoutEdit()?t('commandes.terminer_disposition'):t('commandes.disposer_postes'),hint:t('commandes.hint_scene'),run:()=>Scene.toggleLayoutEdit()});
    list.push({label:Scene.isPaused()?t('commandes.animer_bureau'):t('commandes.pause_bureau'),hint:t('commandes.hint_scene'),run:()=>$('motion').click()});
    list.push({label:t('commandes.salle_crise'),hint:t('commandes.hint_urgence'),run:CrisisUi.open});
    list.push({label:isTilesOn()?t('commandes.vue_scene'):t('commandes.mode_mosaique'),hint:t('commandes.hint_scene'),run:()=>setTiles(!isTilesOn())});
    if(document.fullscreenEnabled)list.push({label:t('commandes.plein_ecran'),hint:t('commandes.hint_scene'),run:()=>$('fullscreen').click()});
    list.push({label:t('commandes.actualiser_agents'),hint:'Herdr',run:()=>$('refresh').click()});
    list.push({label:t('commandes.aide'),hint:'?',run:()=>toggleHelp(true)});
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
    }):[Object.assign(document.createElement('li'),{className:'list-placeholder',textContent:t('commandes.aucune')})]));
    $('palette-input').setAttribute('aria-activedescendant',paletteItems.length?'cmd-'+paletteIndex:'');
  }
  // Palette modale : fond inerte pendant son ouverture, focus rendu au déclencheur ou à la destination de la commande.
  let paletteTrigger=null;
  function openPalette(){
    paletteTrigger=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
    for(const el of backdrop())el.inert=true;
    $('palette').hidden=false;$('palette-input').value='';paletteIndex=0;renderPalette();$('palette-input').focus();
  }
  function closePalette(restore=true){
    $('palette').hidden=true;for(const el of backdrop())el.inert=false;
    if(restore)(paletteTrigger?.isConnected?paletteTrigger:$('palette-open')).focus({preventScroll:true});
  }
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
  return { open: openPalette, close: closePalette, isOpen: () => !$('palette').hidden };
}
