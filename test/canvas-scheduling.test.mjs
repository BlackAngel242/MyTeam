import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const scene=readFileSync(new URL('../public/scene.js',import.meta.url),'utf8');
const base=readFileSync(new URL('../public/bureau-base.js',import.meta.url),'utf8');

// Objet souple : tout accès ou appel renvoie encore un objet de ce type (éléments DOM, contexte canvas).
function stub(){
  const f=function(){return proxy;};
  const proxy=new Proxy(f,{get:(t,p)=>p==='then'?undefined:(p===Symbol.toPrimitive?()=>0:(p in t?t[p]:proxy)),set:(t,p,v)=>{t[p]=v;return true;},apply:()=>proxy,construct:()=>proxy});
  return proxy;
}

// Chaque dessin de la scène finit par ctx.drawImage(hors écran) : on compte les dessins par ce appel.
function load({paused=false,tiles=false}={}){
  let next=0;
  const raf=new Map(),timers=new Map(),events={},draws=[],state={tiles};
  const ctx=new Proxy({},{get:(t,p)=>p==='drawImage'?()=>draws.push(true):(p in t?t[p]:stub()),set:(t,p,v)=>{t[p]=v;return true;}});
  const canvas={width:800,height:600,style:{},title:'',classList:stub(),parentElement:stub(),addEventListener:(name,fn)=>events[name]=fn,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),getContext:()=>ctx,setAttribute(){}};
  const context=vm.createContext({
    document:{getElementById:()=>stub(),createElement:()=>({getContext:()=>stub(),width:0,height:0}),addEventListener(){},fullscreenEnabled:false,fullscreenElement:null},
    $:()=>stub(),ResizeObserver:function(){return {observe(){}};},localStorage:{getItem:()=>null,setItem(){}},
    matchMedia:()=>({matches:false,addEventListener(){}}),performance:{now:()=>0},
    requestAnimationFrame:fn=>{raf.set(++next,fn);return next;},cancelAnimationFrame:id=>raf.delete(id),
    setTimeout:(fn,delay)=>{timers.set(++next,{fn,delay});return next;},clearTimeout:id=>timers.delete(id),
    t:key=>key,console,canvas,addEventListener(){},window:{devicePixelRatio:1,innerWidth:1280,innerHeight:800}});
  vm.runInContext(base+'\n'+scene+`\n;this.scene=createScene({canvas,getState:()=>({connected:false,agents:[]}),getSelected:()=>null,getQueueItems:()=>[],getBoardData:()=>null,getEnseigne:()=>'',getTodosData:()=>null,isTilesOn:()=>tilesState.tiles,initialPaused:${paused},colors:['#fff'],label:()=>'',tint:()=>'#fff',compte:()=>'',showTab(){},selectAgent(){},openBoard(){},copyText(){},logoFor:()=>null,activeAgent:()=>null,quotaPause:()=>null,signal(){},hhmm:()=>'',agentByTarget:()=>null});`,context,{filename:'scene.js'});
  context.tilesState=state;
  const tick=(queue,time)=>{const [id,value]=queue.entries().next().value;queue.delete(id);(value.fn||value)(time);};
  return {context,scene:context.scene,state,raf,timers,events,draws,canvas,tick};
}

test('canvas : pause sans RAF continue, actualisation chaque minute',()=>{
  const v=load({paused:true});v.scene.sync();v.tick(v.raf,60001);
  assert.equal(v.raf.size,0);assert.equal(v.timers.size,1);
  assert.equal([...v.timers.values()][0].delay,60000);
  v.tick(v.timers);assert.equal(v.raf.size,1);
  v.tick(v.raf,120001);assert.equal(v.draws.length,2);
  assert.equal(v.raf.size,0);assert.equal(v.timers.size,1);
});

test('canvas : reprise entre timeout et RAF conserve une boucle et dessine immédiatement',()=>{
  const v=load({paused:true});v.scene.sync();v.tick(v.raf,60001);v.tick(v.timers);
  v.scene.setPaused(false);v.scene.sync();
  assert.equal(v.raf.size,1);assert.equal(v.timers.size,0);
  v.tick(v.raf,60002);assert.equal(v.draws.length,2);
  assert.equal(v.raf.size,1);
  v.scene.sync();v.scene.sync();assert.equal(v.raf.size,1);
});

test('canvas : mosaïque suspend les réveils puis reprend immédiatement',()=>{
  const v=load();v.scene.sync();v.tick(v.raf,100);
  v.state.tiles=true;v.scene.sync();
  assert.equal(v.raf.size,0);assert.equal(v.timers.size,0);
  v.state.tiles=false;v.scene.sync();v.tick(v.raf,101);
  assert.equal(v.draws.length,2);assert.equal(v.raf.size,1);
});

test('canvas : mouvements groupés ne programment qu\'un seul survol',()=>{
  const v=load();v.events.mousemove({clientX:10,clientY:10});v.events.mousemove({clientX:20,clientY:20});
  assert.equal(v.raf.size,1);v.tick(v.raf,100);
  assert.equal(v.raf.size,0);
});

test('canvas : sortir annule le survol différé et remet le curseur par défaut',()=>{
  const v=load();v.events.mousemove({clientX:10,clientY:10});v.events.mouseleave();
  assert.equal(v.raf.size,0);
  assert.equal(v.canvas.style.cursor,'default');assert.equal(v.canvas.title,'');
});

test('canvas : bascules rapides annulent RAF et timeout précédents',()=>{
  const v=load();v.scene.sync();v.tick(v.raf,100);
  v.scene.setPaused(true);v.scene.sync();
  assert.equal(v.raf.size,1);v.tick(v.raf,101);
  assert.equal(v.raf.size,0);assert.equal(v.timers.size,1);
  v.scene.setPaused(false);v.scene.sync();v.scene.setPaused(true);v.scene.sync();v.scene.setPaused(false);v.scene.sync();
  assert.equal(v.raf.size,1);assert.equal(v.timers.size,0);
  v.tick(v.raf,102);assert.equal(v.draws.length,3);
});

test('canvas : syncMotion conserve icônes Lucide et libellé traduit à chaque bascule',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const label={dataset:{}},attributes={},motion={dataset:{},querySelector:selector=>selector==='span'?label:{setAttribute:(key,value)=>attributes[key]=value}};
  const context=vm.createContext({$:()=>motion,t:key=>'EN '+key,paused:false,calls:0,Scene:{isPaused(){return this.owner.paused;},draw(){},sync(){context.calls++;}}});
  context.Scene.owner=context;
  vm.runInContext(app.slice(app.indexOf('function syncMotion()'),app.indexOf("$('motion').addEventListener")),context);
  vm.runInContext('syncMotion()',context);
  assert.equal(label.dataset.i18n,'commandes.mettre_en_pause');assert.equal(attributes.href,'/icons.svg#pause');
  vm.runInContext('paused=true;syncMotion()',context);
  assert.equal(label.textContent,'EN commandes.animer');assert.equal(attributes.href,'/icons.svg#play');
  assert.equal(motion.dataset.actif,'true');assert.equal(context.calls,2);
});
