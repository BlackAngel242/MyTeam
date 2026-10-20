'use strict';
const words={
 fr:{title:'Choisir le projet · MyTeam',language:'Langue',eyebrow:'MYTEAM · DÉMARRAGE',heading:'Sur quoi travaille ton équipe ?',intro:'Choisis le contexte avant de confier une mission au directeur.',myteam:'Améliorer MyTeam',myteamDescription:'Partir du produit installé et contribuer à son évolution.',project:'Travailler sur un autre projet',projectDescription:'Démarrer un nouveau projet ou poursuivre un dossier existant.',folder:'Dossier de travail',folderDescription:'Ouvre explicitement un sous-dossier existant, vide pour un nouveau projet. Les agents doivent être ouverts dans ce dossier.',place:'Lieu',home:'Dossier personnel',parent:'Remonter',directories:'Sous-dossiers',kit:'Préparer le kit d’équipe sans remplacer les fichiers existants',privacy:'L’état de chaque projet reste sur cet ordinateur, séparé du code. Aucune publication GitHub n’est déclenchée par ce choix. Les outils des agents conservent leurs propres permissions.',back:'Retour au projet actif',choose:'Choisis un contexte',chooseFolder:'Ouvre un sous-dossier pour continuer',openMyteam:'Ouvrir MyTeam',openProject:'Ouvrir ce dossier',selected:'Dossier choisi : ',loading:'Chargement des dossiers…',opening:'Ouverture…',unavailable:'Le démarrage est indisponible. Actualise la page.',folderError:'Impossible de lire ce dossier. Choisis un autre dossier.',openError:'Le projet n’a pas pu être ouvert. Vérifie le dossier et réessaie.'},
 en:{title:'Choose a project · MyTeam',language:'Language',eyebrow:'MYTEAM · GET STARTED',heading:'What is your team working on?',intro:'Choose a context before giving the director a mission.',myteam:'Improve MyTeam',myteamDescription:'Start from the installed product and contribute to its development.',project:'Work on another project',projectDescription:'Start a new project or continue an existing folder.',folder:'Working folder',folderDescription:'Open an existing subfolder explicitly, empty for a new project. Open your agents in this folder.',place:'Location',home:'Home folder',parent:'Up one level',directories:'Subfolders',kit:'Prepare the team kit without replacing existing files',privacy:'Each project’s state stays on this computer, separate from the code. This choice does not publish anything to GitHub. Agent tools keep their own permissions.',back:'Back to the active project',choose:'Choose a context',chooseFolder:'Open a subfolder to continue',openMyteam:'Open MyTeam',openProject:'Open this folder',selected:'Selected folder: ',loading:'Loading folders…',opening:'Opening…',unavailable:'Startup is unavailable. Refresh the page.',folderError:'Could not read this folder. Choose another folder.',openError:'The project could not be opened. Check the folder and try again.'}
};
const $=selector=>document.querySelector(selector),form=$('#choice'),place=$('#place'),status=$('#status');
let lang,token='',path='',ready=false,loading=false,opening=false,statusKey='',folderRequest=0;
try{lang=localStorage.getItem('bureau.langue');}catch{}
if(!['fr','en'].includes(lang))lang=navigator.language.toLowerCase().startsWith('fr')?'fr':'en';
const text=key=>words[lang][key],mode=()=>form.querySelector('[name=mode]:checked')?.value;
function sync(){
 document.documentElement.lang=lang;document.title=text('title');$('#language').value=lang;
 for(const element of document.querySelectorAll('[data-start]'))element.textContent=text(element.dataset.start);
 for(const option of place.options)option.textContent=option.value==='home'?text('home'):option.value;
 $('#directories').setAttribute('aria-label',text('directories'));
 $('#selection-hint').textContent=path?text('selected')+path:text('chooseFolder');
 const button=form.querySelector('[type=submit]');
 button.disabled=!ready||loading||opening||!mode()||(mode()==='project'&&!path);
 button.textContent=text(opening?'opening':!mode()?'choose':mode()==='myteam'?'openMyteam':path?'openProject':'chooseFolder');
 status.textContent=statusKey?text(statusKey):'';
}
$('#language').onchange=event=>{lang=event.target.value;try{localStorage.setItem('bureau.langue',lang);}catch{}sync();};
async function folders(){
 const request=++folderRequest;loading=true;statusKey='loading';sync();
 try{
  const response=await fetch('/api/projet/dossiers?'+new URLSearchParams({lieu:place.value,chemin:path}),{headers:{'X-MyTeam-Token':token}}),data=await response.json();
  if(request!==folderRequest)return;
  if(!response.ok)throw Error();
  $('#path').textContent=path||'/';$('#parent').disabled=!path;
  $('#directories').replaceChildren(...data.directories.map(name=>{const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=name;button.onclick=()=>{path=path?path+'/'+name:name;folders();};li.append(button);return li;}));
  statusKey='';
 }catch{if(request===folderRequest){path='';$('#path').textContent='/';$('#directories').replaceChildren();statusKey='folderError';}}
 finally{if(request===folderRequest){loading=false;sync();}}
}
form.addEventListener('change',event=>{if(event.target.name==='mode'){$('#folder').hidden=event.target.value!=='project';if(event.target.value==='project'&&ready)folders();else{statusKey='';sync();}}});
place.onchange=()=>{path='';folders();};
$('#parent').onclick=()=>{path=path.split('/').slice(0,-1).join('/');folders();};
form.onsubmit=async event=>{
 event.preventDefault();if(!ready||loading||opening||!mode()||(mode()==='project'&&!path))return;
 opening=true;statusKey='opening';sync();
 try{
  const response=await fetch('/api/projet',{method:'POST',headers:{'Content-Type':'application/json','X-MyTeam-Token':token},body:JSON.stringify({mode:mode(),place:place.value,path,prepareKit:$('#kit').checked,lang})});
  if(!response.ok)throw Error();location.assign('/');
 }catch{opening=false;statusKey='openError';sync();}
};
sync();
fetch('/api/projet').then(async response=>{if(!response.ok)throw Error();return response.json();}).then(data=>{
 token=data.token;place.replaceChildren(...data.places.map(value=>{const option=document.createElement('option');option.value=value;return option;}));$('#back').hidden=!data.project;ready=true;if(mode()==='project')folders();else sync();
}).catch(()=>{statusKey='unavailable';sync();});
