import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function load(paused=false){
  let next=0;
  const raf=new Map(),timers=new Map(),events={},draws=[];
  const canvas={style:{},title:'',addEventListener:(name,fn)=>events[name]=fn};
  const context=vm.createContext({paused,tilesOn:false,lastFrame:0,hovered:null,editLayout:false,boardSpot:null,canvas,
    draw:time=>draws.push(time),spotAt:event=>event.id?{id:event.id}:null,onMail:event=>event.mail,
    t:key=>key,requestAnimationFrame:fn=>{raf.set(++next,fn);return next;},cancelAnimationFrame:id=>raf.delete(id),
    setTimeout:(fn,delay)=>{timers.set(++next,{fn,delay});return next;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source.slice(source.indexOf('// Figée, la scène'),source.indexOf('// Signaux :')),context);
  vm.runInContext(source.slice(source.indexOf("let hoverFrame="),source.indexOf('new ResizeObserver')),context);
  const run=code=>vm.runInContext(code,context);
  const tick=(queue,time)=>{const [id,value]=queue.entries().next().value;queue.delete(id);(value.fn||value)(time);};
  return {context,raf,timers,events,draws,canvas,run,tick};
}

test('canvas : pause sans RAF continue, actualisation chaque minute',()=>{
  const v=load(true);v.run('frame(60001)');
  assert.equal(v.raf.size,0);assert.equal(v.timers.size,1);
  assert.equal([...v.timers.values()][0].delay,60000);
  v.tick(v.timers);assert.equal(v.raf.size,1);
  v.tick(v.raf,120001);assert.deepEqual(v.draws,[60001,120001]);
  assert.equal(v.raf.size,0);assert.equal(v.timers.size,1);
});

test('canvas : reprise entre timeout et RAF conserve une boucle et dessine immédiatement',()=>{
  const v=load(true);v.run('frame(60001)');v.tick(v.timers);
  v.run('paused=false;syncSceneLoop()');
  assert.equal(v.raf.size,1);assert.equal(v.timers.size,0);
  v.tick(v.raf,60002);assert.deepEqual(v.draws,[60001,60002]);
  assert.equal(v.raf.size,1);
  v.run('syncSceneLoop();syncSceneLoop()');assert.equal(v.raf.size,1);
});

test('canvas : mosaïque suspend les réveils puis reprend immédiatement',()=>{
  const v=load();v.run('frame(100);tilesOn=true;syncSceneLoop()');
  assert.equal(v.raf.size,0);assert.equal(v.timers.size,0);
  v.run('tilesOn=false;syncSceneLoop()');v.tick(v.raf,101);
  assert.deepEqual(v.draws,[100,101]);assert.equal(v.raf.size,1);
});

test('canvas : mouvements groupés utilisent le dernier événement',()=>{
  const v=load();v.events.mousemove({id:'a'});v.events.mousemove({id:'b'});
  assert.equal(v.raf.size,1);v.tick(v.raf,100);
  assert.equal(v.context.hovered,'b');assert.equal(v.draws.length,1);
});

test('canvas : sortir annule le survol différé et efface curseur et titre',()=>{
  const v=load();v.events.mousemove({id:'a',mail:true});v.events.mouseleave();
  assert.equal(v.raf.size,0);assert.equal(v.context.hovered,null);
  assert.equal(v.canvas.style.cursor,'default');assert.equal(v.canvas.title,'');
  v.events.mousemove({id:'b'});v.tick(v.raf,100);
  assert.equal(v.context.hovered,'b');
  v.events.mousemove({id:'c'});v.events.mouseleave();
  assert.equal(v.raf.size,0);assert.equal(v.context.hovered,null);
  assert.equal(v.draws.length,2);
});


test('canvas : bascules rapides annulent RAF et timeout précédents',()=>{
  const v=load();v.run('frame(100);paused=true;syncSceneLoop()');
  assert.equal(v.raf.size,1);v.tick(v.raf,101);
  assert.equal(v.raf.size,0);assert.equal(v.timers.size,1);
  v.run('paused=false;syncSceneLoop();paused=true;syncSceneLoop();paused=false;syncSceneLoop()');
  assert.equal(v.raf.size,1);assert.equal(v.timers.size,0);
  v.tick(v.raf,102);assert.deepEqual(v.draws,[100,101,102]);
});

test('canvas : sortie après survol affiché retire aussi le titre courrier',()=>{
  const v=load();v.events.mousemove({id:'a',mail:true});v.tick(v.raf,100);
  assert.equal(v.canvas.title,'equipe.courrier_titre');v.events.mouseleave();
  assert.equal(v.canvas.title,'');assert.equal(v.canvas.style.cursor,'default');
  assert.equal(v.context.hovered,null);
});

test('canvas : syncMotion conserve icônes Lucide et libellé traduit à chaque bascule',()=>{
  const v=load(),label={dataset:{}},attributes={};
  const motion={dataset:{},querySelector:selector=>selector==='span'?label:{setAttribute:(key,value)=>attributes[key]=value}};
  v.context.$=()=>motion;
  v.run(source.slice(source.indexOf('function syncMotion()'),source.indexOf("$('motion').addEventListener")));
  v.run('syncMotion()');
  assert.equal(label.dataset.i18n,'commandes.mettre_en_pause');assert.equal(attributes.href,'/icons.svg#pause');
  v.context.t=key=>'EN '+key;v.run('paused=true;syncMotion()');
  assert.equal(label.textContent,'EN commandes.animer');assert.equal(attributes.href,'/icons.svg#play');
  assert.equal(motion.dataset.actif,'true');assert.equal(v.raf.size,1);
});
