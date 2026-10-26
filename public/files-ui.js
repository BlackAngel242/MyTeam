'use strict';
// Fichiers : récents dans le dossier de l'agent, ou navigation. Dépendances fournies par app.js.
function createFilesUi({ getState, api, t, $, errorBlock, errorText, activeAgent, showTab, since }) {
  // Fichiers : récents dans le dossier de l'agent, ou navigation. Copier par glisser-déposer, déplacer avec Maj.
  // Le serveur seul connaît les chemins réels ; ici on ne manipule que des clés de lieu et des chemins relatifs.
  let filesView='recent',filesRoot=null,filesPath='',places=[],dragged=null,filesBusy=false;
  const authed=()=>({'X-Bureau-Token':getState().token||''});
  const ago=iso=>since(Date.now()-new Date(iso).getTime());
  const size=n=>n<1024?t('fichiers.taille.o',{n}):n<1048576?t('fichiers.taille.ko',{n:(n/1024).toLocaleString('fr-FR',{maximumFractionDigits:1})}):t('fichiers.taille.mo',{n:(n/1048576).toLocaleString('fr-FR',{maximumFractionDigits:1})});
  function filesMessage(text,kind='info'){const r=$('files-result');r.hidden=!text;r.textContent=text;r.className='files-result '+kind;}
  async function loadFiles(){
    const a=activeAgent();
    $('files-title').textContent=a?t('fichiers.titre_agent',{nom:a.name}):t('fichiers.titre');
    if(!a&&filesView==='recent'){$('file-list').replaceChildren();$('files-intro').textContent=t('fichiers.intro_choisir');$('files-crumbs').hidden=true;return;}
    if(filesBusy)return;filesBusy=true;
    $('panel-fichiers').classList.remove('files-error');
    try{
      const placeData=await api('/api/places',{headers:authed()});places=placeData.places||[];renderPlaces();
      let items;
      if(filesView==='recent'){
        const data=await api('/api/files/recent?id='+encodeURIComponent(a.id),{headers:authed()});
        filesRoot=data.root;items=data.files||[];
        $('files-intro').textContent=items.length?t('fichiers.recents',{nom:a.name}):t('fichiers.aucun_recents',{nom:a.name});
        $('files-crumbs').hidden=true;
      }else{
        filesRoot=filesRoot||(a?'agent:'+a.id:places[0]?.key);
        const data=await api('/api/files/list?root='+encodeURIComponent(filesRoot)+'&path='+encodeURIComponent(filesPath),{headers:authed()});
        items=data.items||[];$('files-intro').textContent=t('fichiers.intro_cliquer');renderCrumbs();
      }
      renderFileList(items);
    }catch(error){errorBlock($('file-list'),errorText(error),'fichiers');$('places').replaceChildren(Object.assign(document.createElement('li'),{className:'list-placeholder',textContent:t('fichiers.destinations_non_chargees')}));$('files-intro').textContent=/introuvable|404/i.test(error.message)?t('fichiers.en_attente_serveur'):'';$('panel-fichiers').classList.add('files-error');}
    finally{filesBusy=false;}
  }
  function fileIcon(item){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','lucide file-icon'+(item.dir?' folder':''));svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
    const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','/icons.svg#'+(item.dir?'folder':'file'));svg.append(use);return svg;
  }
  function renderFileList(items){
    $('file-list').replaceChildren(...items.map(item=>{
      const li=document.createElement('li');li.className='file-row';
      const main=document.createElement(item.dir?'button':'div');main.className='file-main';
      if(item.dir){main.type='button';main.addEventListener('click',()=>{filesPath=item.path;loadFiles();});}
      else{main.draggable=true;main.addEventListener('dragstart',e=>{dragged={root:filesRoot,path:item.path,name:item.name};e.dataTransfer.setData('text/plain',item.name);e.dataTransfer.effectAllowed='copyMove';document.body.classList.add('dragging');});main.addEventListener('dragend',()=>{dragged=null;document.body.classList.remove('dragging');});}
      const text=document.createElement('span');text.className='file-text';
      const name=document.createElement('span');name.className='file-name';name.textContent=item.name;
      const meta=document.createElement('span');meta.className='file-meta';meta.textContent=item.dir?t('fichiers.dossier'):[item.path.includes('/')?item.path.slice(0,item.path.lastIndexOf('/')):'',size(item.size),ago(item.modified)].filter(Boolean).join(' · ');
      text.append(name,meta);main.append(fileIcon(item),text);li.append(main);
      if(!item.dir){
        const reveal=document.createElement('button');reveal.type='button';reveal.className='tool-button';reveal.textContent=t('fichiers.afficher');reveal.title=t('fichiers.afficher_titre');
        reveal.addEventListener('click',async()=>{try{await api('/api/files/reveal',{method:'POST',headers:{'Content-Type':'application/json',...authed()},body:JSON.stringify({root:filesRoot,path:item.path})});filesMessage(t('fichiers.affiche',{nom:item.name}));}catch(error){filesMessage(errorText(error),'error');}});
        li.append(reveal);
      }
      return li;
    }));
  }
  function renderCrumbs(){
    const nav=$('files-crumbs');nav.hidden=false;const place=places.find(p=>p.key===filesRoot);
    const parts=filesPath?filesPath.split('/'):[],links=[[place?.label||t('fichiers.dossier'),'']];
    parts.forEach((p,i)=>links.push([p,parts.slice(0,i+1).join('/')]));
    nav.replaceChildren(...links.map(([label,path],i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=i===links.length-1;b.addEventListener('click',()=>{filesPath=path;loadFiles();});return b;}));
  }
  function renderPlaces(){
    $('places').replaceChildren(...places.map(p=>{
      const li=document.createElement('li');const b=document.createElement('button');b.type='button';b.className='place '+p.kind;b.textContent=p.label;
      b.title=filesView==='recent'?t('fichiers.glisser'):t('fichiers.ouvrir_lieu');
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
    if(mode==='move'&&pendingMove!==key){pendingMove=key;filesMessage(t('fichiers.confirmer_deplacement',{nom:file.name,lieu:place.label}),'warn');return;}
    pendingMove=null;
    try{
      const r=await api('/api/files/transfer',{method:'POST',headers:{'Content-Type':'application/json',...authed()},body:JSON.stringify({from:{root:file.root,path:file.path},to:{root:place.key,path:''},mode})});
      filesMessage(mode==='move'?(r.name!==file.name?t('fichiers.deplace_renomme',{nom:file.name,lieu:place.label,nouveau:r.name}):t('fichiers.deplace',{nom:file.name,lieu:place.label})):(r.name!==file.name?t('fichiers.copie_renomme',{nom:file.name,lieu:place.label,nouveau:r.name}):t('fichiers.copie',{nom:file.name,lieu:place.label})),'ok');loadFiles();
    }catch(error){filesMessage(errorText(error),'error');}
  }
  function syncFilesView(){$('files-recent').setAttribute('aria-pressed',String(filesView==='recent'));$('files-browse').setAttribute('aria-pressed',String(filesView==='browse'));}
  $('files-recent').addEventListener('click',()=>{filesView='recent';syncFilesView();loadFiles();});
  $('files-browse').addEventListener('click',()=>{filesView='browse';syncFilesView();const a=activeAgent();filesRoot=a?'agent:'+a.id:null;filesPath='';loadFiles();});
  return { load: loadFiles, ago, reset() { filesView = 'recent'; syncFilesView(); filesPath = ''; } };
}
