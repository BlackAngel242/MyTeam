'use strict';
fetch('/api/projet').then(r=>r.ok?r.json():null).then(data=>{
 const link=document.querySelector('#project-context');
 if(link&&data?.project){
  const en=window.getLangue?.()==='en',name=data.project.mode==='myteam'?'MyTeam':data.project.root.split(/[\\/]/).filter(Boolean).at(-1);
  link.textContent=(en?'Project: ':'Projet : ')+name;
  link.title=data.project.root+(en?' · Change project':' · Changer de projet');
 }
}).catch(()=>{});
