'use strict';
// Scène du bureau : rendu canvas, disposition des postes, survol et boucle d'animation.
// Créée par app.js avec ses dépendances : rien n'est lu en global non déclaré.
function createScene({ canvas, getState, getSelected, getQueueItems, getBoardData, getEnseigne, getTodosData, isTilesOn, initialPaused, colors, label, tint, compte, showTab, selectAgent, openBoard, copyText, logoFor, activeAgent, quotaPause, signal, hhmm, agentByTarget }) {
  const ctx = canvas.getContext('2d');
  const { WORK, FREE, WAIT } = ETATS;
  let paused = initialPaused;
  let spots = [];
  // Scène dessinée en basse résolution puis agrandie : chaque pixel du décor reste net à toutes les tailles.
  const sceneLabels={working:()=>t('scene.au_travail'),busy:()=>t('scene.au_travail'),running:()=>t('scene.au_travail'),idle:()=>t('scene.disponible'),done:()=>t('scene.termine'),waiting:()=>t('scene.attend_reponse'),blocked:()=>t('scene.attend_reponse')};
  const glyphs={'%':'101001010100101',A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',0:'111101101101111',1:'010110010010111',2:'110001010100111',3:'110001010001110',4:'101101111001001',5:'111100110001110',6:'011100111101111',7:'111001010010010',8:'111101111101111',9:'111101111001110','-':'000000111000000','+':'000010111010000','_':'000000000000111','.':'000000000000010',':':'000010000010000','?':'110001010000010','!':'010010010000010','/':'001001010100100',"'":'010010000000000',' ':'000000000000000'};
  const off=document.createElement('canvas'), g=off.getContext('2d');
  let hovered=null, ariaText='', lastFrame=0, layoutKey='', boardBottom=0;
  const lastStatus=new Map(), changes=new Map();
  // Départs et retours de pause de quota : déclenchés seulement par un passage observé, jamais au chargement.
  const pausedSeen=new Set(),quotaTrips=new Map();
  function trackChanges(){
    const now=performance.now();
    for(const a of getState().agents){
      const prev=lastStatus.get(a.id);
      if(prev&&prev!==a.status){changes.set(a.id,{from:prev,to:a.status,at:now});if(WAIT.includes(a.status))signal('blocked',t('etat.notif_attente',{nom:a.name}),t('etat.notif_attente_aide'));}
      lastStatus.set(a.id,a.status);
      const p=quotaPause(a);
      if(p&&!pausedSeen.has(a.id)){pausedSeen.add(a.id);if(prev&&!paused)quotaTrips.set(a.id,{dir:'out',t0:now,h:hash(a.id)});if(prev)signal('pause',t('pause.notif',{nom:a.name}),p.until?t('pause.notif_retour',{heure:hhmm(p.until)}):t('pause.notif_sans_heure'));}
      else if(!p&&pausedSeen.has(a.id)){pausedSeen.delete(a.id);if(!paused)quotaTrips.set(a.id,{dir:'in',t0:now,h:hash(a.id)});signal('delegation',t('pause.notif_dispo',{nom:a.name}),'');$('mail-live').textContent=t('pause.notif_dispo',{nom:a.name});}
    }
  }
  const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.codePointAt(0),16777619);return h>>>0;};
  const rng=seed=>()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
  function px(x,y,w,h,c,a=1){g.globalAlpha=a;g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));g.globalAlpha=1;}
  const pixelCase=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9 .:_\-+?!/'%]/g,'?');
  const textWidth=s=>Math.max(0,s.length*4-1);
  // Performance: Replace O(n) while loop string slicing with direct O(1) mathematical calculation.
  // Since each character has a fixed width of 4px (with -1 total offset), max-3 / 4 gets exact fit.
  function fit(s,max){s=pixelCase(s);if(textWidth(s)<=max)return s;const keep=Math.floor((max-3)/4);return (keep>0?s.slice(0,keep):s.slice(0,1)).trimEnd()+'.';}
  // Performance: Hoist canvas getState() (fillStyle, globalAlpha) out of the character/pixel loop to avoid massive overhead.
  function text(s,x,y,c,a=1){g.globalAlpha=a;g.fillStyle=c;g.beginPath();[...s].forEach((ch,i)=>{const bits=glyphs[ch]||glyphs['?'];for(let b=0;b<15;b++)if(bits[b]==='1')g.rect(Math.round(x+i*4+b%3),Math.round(y+Math.floor(b/3)),1,1);});g.fill();g.globalAlpha=1;}
  // Halo en pixels autour d'une getEnseigne() : reste dans le langage pixel, pas de flou.
  function neon(s,x,y,c){for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])text(s,x+dx,y+dy,c,.22);text(s,x,y,c);}
  function pool(cx,cy,rx,ry,c,a){for(let dy=-ry;dy<=ry;dy++){const hw=Math.round(rx*Math.sqrt(1-(dy/ry)**2));if(hw>0)px(cx-hw,cy+dy,hw*2,1,c,a);}}
  // Lumière par paliers successifs : effet de dégradé sans lissage.
  function glow(cx,cy,r,c,s){pool(cx,cy,Math.round(r*1.9),Math.round(r*.7),c,.045*s);pool(cx,cy,Math.round(r*1.3),Math.round(r*.48),c,.06*s);pool(cx,cy,Math.round(r*.75),Math.round(r*.28),c,.08*s);}

  // Le chef : celui que le serveur désigne (drapeau boss, calculé par src/direction.mjs). L'écran ne choisit
  // jamais à la place du serveur : sans drapeau, il n'y a pas de chef affiché.
  const fitMode=matchMedia('(min-width:1100px) and (min-height:620px)');
  function layout(){
    const wrap=canvas.parentElement,cssW=wrap.clientWidth||960,cssH=wrap.clientHeight||600,narrow=cssW<560,boss=getState().connected?bossOf(getState().agents):null;
    const n=Math.max(1,(getState().agents.length||2)-(boss?1:0)),wallH=narrow?70:84,rowH=80,bossTop=wallH+10;
    // Deux dispositions : le bureau du chef au-dessus des agents, ou à leur droite (écran large).
    const shape=(W,side)=>{
      const bossH=boss&&!side?88:0,top=wallH+12+bossH,areaW=side?W-160:W;
      const cols=Math.min(narrow?(n>=5?3:2):Math.max(1,Math.floor((areaW-8)/62)),n),rows=Math.ceil(n/cols),roomY=top+Math.max(rows*rowH,side?92:0)+4;
      return {W,cols,rows,roomY,H:roomY+(roomOpen()?60:16),top,bossH,areaW,side};
    };
    // En vue globale, la largeur logique suit la forme de la fenêtre : la scène la remplit au lieu de flotter entre deux bandes vides.
    // Téléphone : jusqu'à 4 collaborateurs sur 2 colonnes, au-delà 3 colonnes, sinon la scène devient bien plus haute que l'écran (10 agents).
    let best=shape(narrow?(n>=5?216:144):256,false);
    // On retient la disposition qui donne les plus gros pixels (personnages les plus lisibles) ; à égalité, celle qui remplit le mieux le cadre.
    if(fitMode.matches&&!narrow){
      const score=s=>{const k=Math.min(cssW/s.W,cssH/s.H);return k*1000+(s.W*s.H*k*k)/(cssW*cssH);};
      for(const W of [256,288,320,352,384,416,448,480])for(const side of boss&&W>=352?[false,true]:[false]){const s=shape(W,side);if(score(s)>score(best))best=s;}
    }
    const {W,cols,rows,roomY,H,top,bossH,areaW,side}=best,S=Math.max(2,Math.round(Math.min(cssW,fitMode.matches?cssH*W/H:cssW)*(window.devicePixelRatio||1)/W));
    return {W,H,S,cols,rows,wallH,rowH,top,bossTop,bossH,boss,roomY,narrow,areaW,sideBoss:side,cw:Math.min(78,Math.floor((areaW-8)/cols))};
  }
  // Bureau VIP du chef : moquette, cloison vitrée avec porte au centre, getEnseigne() et pile de courrier reçu.
  // Disposition libre : DrSmoke peut glisser les postes et déplacer ou redimensionner le bureau du chef.
  // Positions mémorisées dans ce navigateur, en proportion du sol pour suivre toutes les tailles de fenêtre.
  const readLayout=()=>{try{return JSON.parse(localStorage.getItem('bureau.disposition')||'null')||{stations:{},vip:null};}catch{return {stations:{},vip:null};}};
  let custom=readLayout(),editLayout=false,dragging=null;
  const saveLayout=()=>{try{localStorage.setItem('bureau.disposition',JSON.stringify(custom));}catch{}};
  const layoutKeyOf=a=>a.kind+'|'+a.name;
  const floorBox=L=>({top:L.wallH+6,h:L.roomY-(L.wallH+6)});
  function vipOffice(L,time){
    const side=L.sideBoss;let w=L.narrow?120:side?148:150,cx=side?L.W-8-w/2:Math.round(L.W/2),y=side?L.top-6:L.bossTop,vh=side?L.roomY-L.top+2:L.bossH;
    if(custom.vip){const f=floorBox(L);w=Math.max(70,Math.min(L.W-4,custom.vip.fw*L.W));vh=Math.max(70,Math.min(f.h,custom.vip.fh*f.h));cx=Math.max(w/2+2,Math.min(L.W-w/2-2,custom.vip.fx*L.W));y=Math.max(f.top,Math.min(L.roomY-vh,f.top+custom.vip.fy*f.h));}
    cx=Math.round(cx);y=Math.round(y);w=Math.round(w);vh=Math.round(vh);
    const x=cx-w/2;vipRect={x,y,w,h:vh};
    px(x,y,w,vh-6,mix('#241f38','#3b3459',amb.d*.65));px(x,y,w,1,'#c9a46a',.6);px(x,y,1,vh-6,'#c9a46a',.6);px(x+w-1,y,1,vh-6,'#c9a46a',.6);
    for(let gx=x+4;gx<x+w-4;gx+=8)for(let gy=y+6;gy<y+vh-10;gy+=8)px(gx,gy,1,1,'#30294a');
    const by=y+vh-6;px(x,by,w/2-10,3,'#2c4468');px(cx+10,by,w/2-10,3,'#2c4468');px(x,by,w/2-10,1,'#4a6a94');px(cx+10,by,w/2-10,1,'#4a6a94');
    text(t('scene.direction'),x+5,y+4,'#c9a46a');
    mailSpot=null;
    if(mailCount){const mx=x+w-22;for(let k=0;k<Math.min(mailCount,5);k++){px(mx,y+8-k*2+20,9,6,'#dfe6ee');px(mx+1,y+9-k*2+20,7,1,'#9aabc1');}text(String(mailCount),mx+11,y+26,'#dfe6ee');mailSpot={x:mx-3,y:y+14,w:22,h:20};}
    if(editLayout){px(x+w-7,by-7,6,6,'#c9a46a');px(x+w-5,by-5,2,2,'#241f38');}
    return {cx,y0:y-6,doorY:by+1};
  }
  // Lumière du jour, calculée en continu sur l'heure réelle du poste. Lever vers 6 h 30, coucher vers 19 h 30 :
  // heures fixes, sans les saisons (approximation assumée). La nuit garde l'identité bleu nuit du bureau.
  const SUNRISE=6.5,SUNSET=19.5;
  const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  function daylight(){
    const t=new Date(),h=t.getHours()+t.getMinutes()/60+t.getSeconds()/3600;
    const d=smooth(SUNRISE-1,SUNRISE+1.5,h)*(1-smooth(SUNSET-1.5,SUNSET+1,h));
    const warm=Math.max(Math.exp(-((h-SUNRISE)**2)/1.1),Math.exp(-((h-SUNSET)**2)/1.1));
    const sun=h>SUNRISE-.6&&h<SUNSET+.6?(h-(SUNRISE-.6))/(SUNSET-SUNRISE+1.2):null;
    const night=24-(SUNSET-SUNRISE),moon=d<.6?((h-SUNSET+24)%24)/night:null;
    return {h,d,warm,sun,moon:moon!=null&&moon<=1?moon:null};
  }
  const hexRgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
  const mix=(a,b,t)=>{const A=hexRgb(a),B=hexRgb(b),k=Math.min(1,Math.max(0,t));return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*k).toString(16).padStart(2,'0')).join('');};
  let amb=daylight();
  const skyNight=['#0e1d3a','#112347','#142a54','#183260','#1c396b'],skyDay=['#3f75bd','#4d85c7','#5f96d0','#78aad9','#9ac2e4'],skyWarm=['#2a2f62','#51427e','#93608a','#d4867a','#f0b47c'];
  function cityWindow(x,y,w,h){
    const {d,warm,sun,moon}=amb;
    px(x-2,y-2,w+4,h+4,'#0b1426');
    skyNight.forEach((c,i)=>px(x,y+Math.floor(i*h/5),w,Math.ceil(h/5)+1,mix(mix(c,skyDay[i],d),skyWarm[i],warm*.85)));
    const r=rng(7),starA=Math.max(0,1-d*1.6);
    for(let i=0;i<w/5;i++){const sx=x+Math.floor(r()*w),sy=y+Math.floor(r()*h*.42),c=r()>.7?'#c9d6f0':'#6f86b3';if(starA>.02)px(sx,sy,1,1,c,starA);}
    // La lune suit son arc pendant la nuit, le soleil le sien pendant le jour : position fidèle à l'heure.
    if(moon!=null){
      const mx=x+3+Math.round(moon*(w-13)),my=y+Math.round(h*.7-Math.sin(Math.PI*moon)*h*.55),a=Math.max(0,1-d*1.8);
      px(mx+1,my,6,8,'#e9e3c6',a);px(mx,my+1,8,6,'#e9e3c6',a);px(mx+2,my+2,2,2,'#cfc8a8',a);px(mx+5,my+5,1,1,'#cfc8a8',a);
    }
    if(sun!=null){
      const sx=x+3+Math.round(sun*(w-12)),sy=y+Math.round(h*.8-Math.sin(Math.PI*sun)*h*.66),c=mix('#ffe7a3','#ff9a5c',warm);
      pool(sx+3,sy+3,9,7,c,.12+.1*d);px(sx+1,sy,4,6,c);px(sx,sy+1,6,4,c);
    }
    const b=rng(11),lit=.78+.18*d;let bx=x;
    while(bx<x+w){
      const bw=6+Math.floor(b()*10),bh=10+Math.floor(b()*h*.55),top=y+h-bh,right=Math.min(bx+bw,x+w),dark=b()>.5;
      px(bx,top,right-bx,bh,mix(dark?'#0a162d':'#0d1b36',dark?'#2a4670':'#32507b',d));
      for(let wy=top+2;wy<y+h-2;wy+=3)for(let wx=bx+1;wx<right-1;wx+=2)if(b()>lit)px(wx,wy,1,1,b()>.25?'#f4c780':'#9dbbff',.5+b()*.5);
      bx=right+(b()>.7?1:0);
    }
    const panes=Math.max(2,Math.round(w/35));
    for(let m=1;m<panes;m++)px(x+Math.round(m*w/panes),y,1,h,'#0b1426');
    px(x,y+Math.round(h*.36),w,1,'#0b1426');
    px(x+5,y+3,1,9,'#ffffff',.07+.06*d);px(x+7,y+3,1,5,'#ffffff',.07+.06*d);
    px(x-4,y+h+2,w+8,2,mix('#2a4166','#4a6890',d));px(x-4,y+h+4,w+8,1,'#0f1a2c');
  }
  function clock(x,y){
    const t=new Date(),s=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
    px(x,y,25,11,'#0b1426');px(x+1,y+1,23,9,'#101c33');text(s,x+3,y+3,'#a0dfc4');
  }
  // Tableau d'équipe : uniquement les comptes réels fournis par Herdr.
  // Tableau de la scène (proposition P1 d'OpenCode) : seulement des faits absents du reste de la scène,
  // les états étant déjà portés par les cartes et les postures. Une ligne s'allume quand son fait est observé.
  // Panneau de liège : ouvre le tableau de l'équipe. Ses notes reflètent le nombre réel de tâches ouvertes.
  let boardSpot=null;
  // Lettres agrandies (chaque pixel d'une lettre devient k x k) : gros pourcentage de l'écran de projection.
  // Performance: Hoist canvas getState() (fillStyle) out of the character/pixel loop.
  function textBig(s,x,y,c,k){g.globalAlpha=1;g.fillStyle=c;g.beginPath();[...s].forEach((ch,i)=>{const bits=glyphs[ch]||glyphs['?'];for(let b=0;b<15;b++)if(bits[b]==='1')g.rect(Math.round(x+i*4*k+(b%3)*k),Math.round(y+Math.floor(b/3)*k),k,k);});g.fill();}
  // Tableau de liège : la todo réelle du projet (cases de TODO.md et des plans), jamais une valeur inventée.
  // Les cases ouvertes d'abord ; quand tout est fait, les dernières cases réalisées.
  let screenSpot=null;
  function cork(x,y,grand){
    const w=grand?66:34,h=grand?46:26;
    px(x-1,y-1,w+2,h+2,'#3a2a20');px(x,y,w,h,'#9a6f45');for(let i=0;i<(grand?24:12);i++){const r=rng(31+i);px(x+2+Math.floor(r()*(w-4)),y+2+Math.floor(r()*(h-4)),1,1,'#7d5835');}
    const tasks=Array.isArray(getTodosData()?.project)?getTodosData().project:null;
    if(grand&&tasks){
      const done=tasks.filter(t=>t.done).length,open=tasks.filter(t=>!t.done);
      px(x+2,y+2,w-4,9,'#f1e6c8');text(t('scene.todo')+' '+done+'/'+tasks.length,x+4,y+4,'#5a4a3a');px(x+w/2-1,y,2,2,'#c0392b');
      const recents=tasks.filter(t=>t.done).slice(-4).reverse();
      const lignes=[...open.slice(0,4).map(tk=>[tk,false]),...recents.slice(0,Math.max(0,4-open.length)).map(tk=>[tk,true])];
      lignes.forEach(([tk,ok],i)=>{
        const ly=y+13+i*8;px(x+2,ly-1,w-4,7,ok?'#c9d8b6':'#f4d36b');
        if(ok){px(x+3,ly+2,1,1,'#2f6b5e');px(x+4,ly+3,1,1,'#2f6b5e');px(x+5,ly+1,1,2,'#2f6b5e');}else px(x+3,ly+1,3,3,'#8a6b2b');
        text(fit(tk.text,w-14),x+8,ly,ok?'#4a5d3f':'#3a2f25');
      });
      if(open.length>4)text('+'+(open.length-4),x+w-13,y+4,'#8a3b2f');
    }else{
      const open=getBoardData()?.todo?Math.max(0,getBoardData().todo.total-getBoardData().todo.done):null,notes=open==null?3:Math.min(6,open);
      const colorsN=['#f4d36b','#a0dfc4','#f2b0c9','#9dbbff'];
      for(let k=0;k<notes;k++){const nx=x+3+(k%3)*10,ny=y+3+Math.floor(k/3)*11;px(nx,ny,8,8,colorsN[k%4]);px(nx+1,ny+3,6,1,'#5a4a3a',.5);px(nx+1,ny+5,4,1,'#5a4a3a',.5);px(nx+3,ny,2,1,'#c0392b');}
      if(open!=null&&open>6)text('+',x+29,y+19,'#f2f4f7');
    }
    boardSpot={x:x-1,y:y-1,w:w+2,h:h+2};
  }
  // Écran de projection : pourcentage d'exécution du travail réel = cases cochées sur cases totales (jamais une estimation).
  function ecran(x,y,w){
    const tasks=Array.isArray(getTodosData()?.project)?getTodosData().project:null,total=tasks?tasks.length:0,done=tasks?tasks.filter(tk=>tk.done).length:0,pct=total?Math.round(done/total*100):null;
    const h=40;
    px(x-2,y-2,w+4,h+4,'#1a2438');px(x-1,y-1,w+2,h+2,'#2c3d5a');px(x,y,w,h,'#0b1426');
    const glow=pct==null?0:.05;px(x+1,y+1,w-2,h-2,'#9dbbff',glow);
    const titre=t('scene.avancement');text(titre,x+Math.floor((w-textWidth(titre))/2),y+3,'#9dbbff');
    const gros=pct==null?'..':pct+'%',gw=gros.length*8-2;
    textBig(gros,x+Math.floor((w-gw)/2),y+11,pct===100?'#a0dfc4':'#f2f4f7',2);
    const bw=w-8;px(x+4,y+h-12,bw,4,'#1d2b40');if(pct!=null)px(x+4,y+h-12,Math.round(bw*pct/100),4,'#a0dfc4');
    if(pct!=null)text(done+'/'+total,x+4,y+h-6,'#c4d2e4');
    screenSpot={x:x-2,y:y-2,w:w+4,h:h+4};
  }
  function board(x,y,w){
    const paused=getState().agents.map(quotaPause).filter(Boolean),back=paused.map(q=>q.until).filter(Boolean).sort((a,b)=>a-b)[0];
    const waitingQ=getQueueItems().filter(q=>q.state==='attente').length,subs=getState().agents.reduce((k,a)=>k+(a.activity?.subagents?.length||0),0);
    const rows=[[t('scene.en_file'),String(waitingQ),'#9dbbff',waitingQ>0],[t('scene.courrier'),String(mailCount),'#a0dfc4',mailCount>0],[t('scene.sous_agents'),String(subs),'#c4d2e4',subs>0]];
    if(paused.length)rows.unshift([t('scene.retour'),back?compte(back):t('scene.heure_inconnue'),'#b5a8e6',true]);
    const h=rows.length*8+5;boardBottom=y+h;
    px(x,y,w,h,'#0b1426');px(x+1,y+1,w-2,h-2,'#111e33');
    rows.forEach(([name,value,c,on],i)=>{
      const ry=y+4+i*8,v=getState().connected?value:'-',lit=getState().connected&&on;
      px(x+4,ry+1,3,3,lit?c:'#3a4c65');text(name,x+10,ry,lit?'#c4d2e4':'#71839a');text(v,x+w-4-textWidth(v),ry,lit?'#f2f4f7':'#71839a');
    });
  }
  // La baie « HERDR » clignote seulement quand le bureau est réellement relié à Herdr.
  function rack(x,y,bottom,time){
    px(x,y,22,bottom-y,'#0b1426');px(x+1,y+1,20,bottom-y-2,'#17243c');
    text('HERDR',x+2,y+3,getState().connected?'#a0dfc4':'#566477');
    for(let i=0;i<6;i++){
      const uy=y+11+i*8;px(x+2,uy,18,6,'#0f1a2e');px(x+10,uy+2,8,1,'#22324d');px(x+10,uy+4,6,1,'#22324d');
      const on=getState().connected&&(paused||(Math.floor(time/320)+i*3)%5!==0);
      px(x+4,uy+2,2,2,on?(i%3?'#a0dfc4':'#9dbbff'):'#26354d');
    }
  }
  function plant(x,bottom){
    px(x+2,bottom-7,8,7,'#6e5242');px(x+1,bottom-8,10,2,'#8a6852');
    px(x+5,bottom-20,2,13,'#2f6b5e');px(x,bottom-18,5,4,'#4f9a82');px(x+7,bottom-22,5,4,'#3f8673');px(x+2,bottom-25,5,4,'#6bb79a');px(x+6,bottom-15,5,3,'#4f9a82');
  }
  // Rayon de soleil entrant par la fenêtre : il se penche selon la position de l'astre et s'efface la nuit.
  function sunbeam(L,wx,ww,wy,wh){
    const {d,warm,sun}=amb;if(sun==null||d<.05)return;
    const c=mix('#ffe9a8','#ffb070',warm),lean=(.5-sun)*1.1,top=wy+wh+5,bottom=Math.min(L.roomY-4,L.wallH+46);
    for(let y=top,k=0;y<bottom;y+=2,k+=2){const a=.07*d*(1-k/(bottom-top))+.01;px(wx+6+lean*k,y,ww-12,2,c,a);}
  }
  function room(L,time){
    const {W,H,wallH,narrow}=L,d=amb.d;
    const wall=mix('#16243d','#3a5683',d*.9),seam=mix('#1a2a46','#42618f',d*.9),floor=mix('#18263c','#344b6e',d*.85),plank=mix('#15223a','#2c4163',d*.85);
    px(0,0,W,wallH,wall);px(0,0,W,3,mix('#0d1729','#1d2f4d',d));
    for(let x=20;x<W;x+=40)px(x,3,1,wallH-9,seam);
    px(0,wallH-6,W,4,mix('#1d2f4d','#36527c',d*.8));px(0,wallH-2,W,2,mix('#2a4166','#4a6890',d*.8));
    px(0,wallH,W,H-wallH,floor);
    for(let y=wallH+3,i=0;y<H;y+=6,i++){px(0,y,W,1,plank);for(let x=i%2?7:27;x<W;x+=40)px(x,y-5,1,5,plank);}
    px(0,wallH,W,1,'#0f1a2c');
    const nightLight=Math.max(0,1-d*1.4);
    if(narrow){boardSpot=null;screenSpot=null;}
    if(narrow){cityWindow(6,10,58,44);sunbeam(L,6,58,10,44);board(70,10,68);clock(70,44);if(nightLight)glow(35,wallH+8,16,'#9dbbff',.7*nightLight);}
    else{
      cityWindow(8,10,112,50);sunbeam(L,8,112,10,50);if(nightLight)glow(64,wallH+9,26,'#9dbbff',.7*nightLight);
      board(128,12,64);clock(198,12);if(getEnseigne())neon(fit(getEnseigne(),60),128,Math.max(50,boardBottom+5),'#a0dfc4');
      const bordX=W-100,libre=bordX-8-202;
      if(W>=352)cork(bordX,10,true);else boardSpot=null;
      // L'écran se range sous l'horloge, dans le mur resté libre ; plus large quand la scène l'est.
      if(W>=352&&libre>=36)ecran(202,27,Math.min(72,libre));else screenSpot=null;
      plant(W-52,wallH+4);rack(W-26,16,wallH+6,time);plant(1,wallH+6);
    }
    const v=.12*(1-.6*d);
    for(let i=0;i<3;i++){px(0,0,2+i*2,H,'#050a14',v);px(W-2-i*2,0,2+i*2,H,'#050a14',v);px(0,0,W,1+i,'#050a14',v);}
    // Suspensions du plafond : allumées dès que le jour baisse, comme dans un vrai bureau en soirée.
    const lamp=lampLevel();
    for(let x=narrow?36:44;x<W-20;x+=narrow?72:88){
      px(x,0,1,8,'#0d1729');px(x-4,8,9,3,mix('#24344f','#3a4d6b',d));px(x-5,11,11,1,'#1a2740');
      if(lamp>.02){px(x-3,12,7,1,'#ffe2a8',.35+.65*lamp);glow(x,wallH+20,30,'#ffd89a',1.1*lamp);px(x-14,13,29,wallH-10,'#ffd89a',.025*lamp);}
    }
  }
  // Éclairage intérieur, sur l'heure du poste : allumé de 17 h 30 (pleine puissance à 19 h) jusqu'au matin,
  // éteint progressivement entre le lever et 8 h. Le bureau s'éclaire avant la nuit noire, comme un vrai.
  const lampLevel=()=>{const h=amb.h;return h<12?1-smooth(SUNRISE,SUNRISE+1.5,h):smooth(SUNSET-2,SUNSET-.5,h);};
  function monitor(x,y,a,c,live,work,time,anim,h){
    px(x,y,17,13,'#0b1424');px(x+1,y+1,15,10,live?'#0d1f35':'#111a29');
    if(live){
      const shift=work&&anim?Math.floor(time/260):0;
      for(let k=0;k<4;k++){const w=3+(((h>>(k*3))&7)+(k+shift)*5)%10;px(x+2,y+2+k*2,Math.min(w,13),1,c,work?.95:.55);}
      if(work&&anim&&Math.floor(time/400)%2)px(x+2+Math.min(13,3+((h+shift)%9)),y+8,2,1,c);
    }
    px(x+7,y+13,3,2,'#0b1424');px(x+5,y+14,7,1,'#26364f');
  }
  function bubble(x,y,kind,anim,time){
    const fill={wait:'#f4c780',done:'#a0dfc4',unknown:'#a7b8ce'}[kind],dy=kind==='wait'&&anim?Math.floor(time/450)%2:0;
    y-=dy;
    px(x,y,11,9,'#0b1426');px(x+1,y+1,9,7,fill);px(x,y+9,3,2,'#0b1426');px(x+1,y+8,2,2,fill);
    if(kind==='wait')text('?',x+4,y+2,'#0c1423');
    else if(kind==='done')[[3,5],[4,6],[5,5],[6,4],[7,3]].forEach(([dx,ddy])=>px(x+dx,y+ddy,1,1,'#0c1423'));
    else[3,5,7].forEach(dx=>px(x+dx,y+5,1,1,'#0c1423'));
  }
  // Personnage : apparence stable par agent, posture dictée uniquement par l'état Herdr.
  function person(x,y0,shirt,h,pose,c,live){
    const skin=['#f0cdb4','#debba6','#c69878','#9c6b4e'][h%4],hair=['#1d2738','#3a2a24','#5a4334','#2f3e57','#7a5236'][(h>>3)%5],style=(h>>6)%5,hx=x+2,hy=y0+12;
    px(x,y0+21,12,10,shirt);px(x,y0+21,12,1,'#ffffff',.2);px(x+4,y0+21,4,2,skin);
    px(hx,hy,8,9,skin);
    if(style===4){px(hx-1,hy-2,10,3,'#33486b');px(hx-4,hy+1,5,1,'#33486b');px(hx-1,hy+1,1,3,hair);px(hx+8,hy+1,1,3,hair);}
    else if(style===3){px(hx-1,hy-1,10,3,hair);px(hx-1,hy+2,2,9,hair);px(hx+7,hy+2,2,9,hair);}
    else{
      px(hx-1,hy-1,10,3,hair);px(hx-1,hy+2,1,3,hair);px(hx+8,hy+2,1,3,hair);
      if(style===1)[0,3,6].forEach(dx=>px(hx+dx,hy-2,2,1,hair));
      if(style===2)px(hx+2,hy-4,4,3,hair);
    }
    const look=pose==='work'?-1:0;
    px(hx+2+look,hy+4,1,2,'#141c2b');px(hx+5+look,hy+4,1,2,'#141c2b');
    // Humeur lue uniquement dans l'état Herdr : sourire une fois fini, inquiétude en attente, concentration au travail.
    if(pose==='sleep'){px(hx+1,hy+4,2,1,'#141c2b');px(hx+5,hy+4,2,1,'#141c2b');px(hx+3,hy+7,2,1,'#a36e65');}
    else if(pose==='wait'){px(hx+1,hy+2,2,1,'#141c2b');px(hx+5,hy+3,2,1,'#141c2b');px(hx+3,hy+7,2,1,'#141c2b');}
    else if(pose==='happy'){px(hx+2,hy+6,1,1,'#a36e65');px(hx+3,hy+7,2,1,'#a36e65');px(hx+5,hy+6,1,1,'#a36e65');}
    else px(hx+3,hy+7,2,1,'#a36e65');
    if(live)px(hx,hy+1,2,8,c,.28);
    if(pose==='work'){px(x-2,y0+22,2,7,shirt);px(x+12,y0+22,2,7,shirt);}
    else if(pose==='wait'){px(x-2,y0+22,2,8,shirt);px(x+12,y0+13,2,9,shirt);px(x+12,y0+10,2,3,skin);}
    else{px(x-2,y0+22,2,8,shirt);px(x+12,y0+22,2,5,shirt);}
    return skin;
  }
  function station(a,i,cx,y0,time,L){
    const chosen=a&&a.id===getSelected(),live=Boolean(getState().connected&&a),st=a?.status;
    const work=live&&WORK.includes(st),wait=live&&WAIT.includes(st),free=live&&FREE.includes(st),anim=!paused&&live;
    const c=a?tint(a):'#566477',h=a?hash(a.kind+'|'+a.name):0,shirt=colors[i%colors.length];
    if(chosen)glow(cx,y0+58,17,'#a0dfc4',1.7);else if(a&&a.id===hovered)glow(cx,y0+58,15,'#c4d2e4',.9);
    if(live)glow(cx-13,y0+46,14,c,(work?1.4:wait?1.2:.8)*(1-.45*amb.d));
    px(cx-25,y0+55,50,3,'#0a1322',.55);
    px(cx-3,y0+15,16,16,'#22324f');px(cx-2,y0+16,14,14,'#2a3c5e');
    const pause=live&&quotaPause(a);
    const pose=pause?'sleep':work?'work':wait?'wait':st==='done'&&live?'happy':'rest',x=cx-1,away=a&&(awayAgents.has(a.id)||Boolean(pause)||quotaTrips.get(a.id)?.dir==='in');
    const skin=a&&!away?person(x,y0,shirt,h,pose,c,live):null;
    px(cx-24,y0+30,48,3,'#7a604f');px(cx-24,y0+30,48,1,'#957660');px(cx-24,y0+33,48,18,'#4a3a3c');px(cx-23,y0+34,46,1,'#55434a');
    px(cx-22,y0+51,3,4,'#3a2e33');px(cx+19,y0+51,3,4,'#3a2e33');
    // Emblème de l'outil sur la façade : identité réelle tirée du champ « agent » de Herdr.
    if(a){
      px(cx-10,y0+34,20,17,'#382b30');const logo=logoFor(a);
      if(logo)logo.rows.forEach((row,ry)=>[...row].forEach((ch,rx)=>{if(logo.palette[ch])px(cx-8+rx,y0+34+ry,1,1,logo.palette[ch],live?1:.4);}));
      else{const ini=pixelCase(a.name).slice(0,1)||'?';text(ini,cx-1,y0+40,'#c4d2e4');}
    }
    px(cx-1,y0+29,12,2,'#7f90a8');px(cx,y0+29,10,1,'#a5b4c8');
    if(a&&!away){
      if(pose==='work'){const p=anim?Math.floor(time/140)%2:0;px(x+1,y0+28-p,2,2,skin);px(x+8,y0+28-(1-p),2,2,skin);}
      else if(free&&!a.activity?.subagents?.length){px(x+13,y0+26,3,4,'#dfe6ee');px(x+16,y0+27,1,2,'#dfe6ee');px(x+13,y0+26,3,1,'#5a3d2e');px(x+12,y0+27,2,2,skin);}
    }
    monitor(cx-22,y0+15,a,c,live,work,time,anim,h);
    // Lampe de bureau : s'allume le soir pour un agent présent ; éteinte s'il est parti en pause de limite.
    const lamp=lampLevel(),lampOn=live&&!away&&lamp>.02;
    px(cx+19,y0+29,5,1,'#2a3247');px(cx+21,y0+22,1,7,'#3a4560');px(cx+18,y0+20,7,2,lampOn?'#e8c47e':'#4a5570');
    if(lampOn){px(cx+19,y0+22,5,1,'#fff1c9',.6+.4*lamp);glow(cx+12,y0+31,16,'#ffd89a',1.3*lamp);}
    if(a&&live){if(wait)bubble(cx+12,y0,'wait',anim,time);else if(st==='done')bubble(cx+12,y0,'done',anim,time);else if(!work&&!free)bubble(cx+12,y0,'unknown',anim,time);}
    if(!a)return;
    // Petite fête de fin : seulement pendant quelques secondes après un passage réel de « travail » à « disponible » ou « terminé ».
    const change=changes.get(a.id),age=change?performance.now()-change.at:Infinity;
    if(live&&age<4000&&WORK.includes(change.from)&&FREE.includes(change.to)){
      const blink=anim?Math.floor(time/180)%2:0;
      [[x-4,y0+6],[x+15,y0+3],[x-1,y0+1],[x+17,y0+12]].forEach(([sx,sy],k)=>{const on=(k+blink)%2===0;px(sx,sy+1,3,1,'#a0dfc4',on?1:.5);px(sx+1,sy,1,3,on?'#ffffff':'#a0dfc4');});
    }
    deskSpots.set(a.id,{cx,y0});
    const max=L.cw-4,name=fit(a.name,max),status=fit(getState().connected?((sceneLabels[st]||(()=>t('scene.inconnu')))()):t('scene.hors_ligne'),max);
    text(name,cx-textWidth(name)/2,y0+60,chosen?'#a0dfc4':'#e2eaf4');
    if(pause){
      // L'agent a quitté son poste : écran éteint, voyant de veille, chevalet avec son heure de retour.
      px(cx-21,y0+16,15,10,'#070d18');
      const glowOn=paused||Math.floor(time/900)%2===0;px(cx-8,y0+27,1,1,'#b5a8e6',glowOn?1:.35);
      px(cx+1,y0+15,27,15,'#0b1426');px(cx+2,y0+16,25,13,'#dfe6ee');px(cx+5,y0+29,2,2,'#7a604f');px(cx+22,y0+29,2,2,'#7a604f');
      // Le chevalet alterne l'heure de retour annoncée et le temps restant, recalculé sur l'heure du poste.
      const left=pause.until?Math.max(0,Math.round((pause.until-Date.now())/60000)):null,showLeft=left!=null&&!paused&&Math.floor(time/3000)%2===1;
      const sign=showLeft?(left<60?t('scene.temps_min',{n:left}):t('scene.temps_hm',{h:Math.floor(left/60),m:String(left%60).padStart(2,'0')})):pause.until?hhmm(pause.until):t('scene.heure_inconnue');
      const signLabel=showLeft?t('scene.dans'):t('scene.retour');
      text(signLabel,cx+2+Math.floor((25-textWidth(signLabel))/2),y0+17,'#0c1423');text(sign,cx+2+Math.floor((25-textWidth(sign))/2),y0+23,'#5b4a9e');
    }
    // Proposition P2 d'OpenCode : le nom seul sous le bureau, souligné de la couleur d'état. Hors ligne, on le dit.
    if(!getState().connected)text(status,cx-textWidth(status)/2,y0+67,'#71839a');
    else px(cx-Math.min(10,textWidth(name)/2),y0+67,Math.min(20,textWidth(name)),1,c,.9);
    if(chosen)px(cx-9,y0+70,18,1,'#a0dfc4');
    if(a===L.boss&&vipRect)spots.push({x:vipRect.x*L.S,y:vipRect.y*L.S,w:vipRect.w*L.S,h:vipRect.h*L.S,id:a.id});
    else spots.push({x:(cx-L.cw/2)*L.S,y:y0*L.S,w:L.cw*L.S,h:L.rowH*L.S,id:a.id});
  }
  // Sous-agents mis en scène. Seuls deux faits réels pilotent tout : l'apparition d'un sous-agent actif
  // dans le journal de son agent, puis sa disparition. Le chef remet un dossier, l'assistant part en salle de réflexion,
  // y reste tant qu'il est actif, puis revient remettre le dossier complété et quitte la scène.
  const actors=new Map(),deskSpots=new Map();let actorsBooted=false;
  const SPEED_MIN=26;
  function meetingGeometry(L){
    const ty=L.roomY+38,tx=Math.round(L.W*(L.narrow?.56:.52)),doorX=8,boardX=L.W-(L.narrow?42:56);
    const seats=[[tx-16,ty-2,'back'],[tx,ty-3,'back'],[tx+16,ty-2,'back'],[tx-34,ty+6,'side'],[tx+34,ty+6,'side'],[tx-8,ty+16,'front']];
    return {tx,ty,doorX,boardX,laneY:L.roomY-3,seats};
  }
  // Salle de réflexion ouverte seulement quand un sous-agent est actif ou encore en déplacement ; sinon une bande discrète.
  function roomOpen(){return (typeof actors!=='undefined'&&actors.size>0)||getState().agents.some(a=>a.activity?.subagents?.length);}
  function meetingRoom(L,time){
    const {roomY,W,H}=L,G=meetingGeometry(L);
    if(!roomOpen()){
      px(0,roomY,W,H-roomY,mix('#1a2740','#344b6e',amb.d*.85));px(0,roomY,W,3,'#2c4468');px(0,roomY,W,1,'#4a6a94');
      text(L.narrow?t('scene.reflexion'):t('scene.salle_reflexion'),G.doorX+18,roomY+6,'#5d7190');return G;
    }
    px(0,roomY,W,H-roomY,mix('#1a2740','#344b6e',amb.d*.85));
    for(let x=4;x<W;x+=12)for(let y=roomY+6;y<H;y+=8)px(x+((y>>3)%2)*6,y,1,1,'#22324d');
    // Cloison vitrée avec une porte à gauche.
    px(G.doorX+12,roomY,W-G.doorX-12,3,'#2c4468');px(G.doorX+12,roomY,W-G.doorX-12,1,'#4a6a94');
    px(0,roomY,G.doorX,3,'#2c4468');px(G.doorX-1,roomY-1,2,5,'#4a6a94');px(G.doorX+11,roomY-1,2,5,'#4a6a94');
    // Libellé fixe (proposition P4 d'OpenCode) : jamais tronqué ; le nombre de sous-agents est au tableau.
    text(L.narrow?t('scene.reflexion'):t('scene.salle_reflexion'),G.doorX+18,roomY+6,'#8fa3c0');
    // Tableau blanc : ses traits ne grandissent que si un assistant y travaille vraiment.
    const bx=G.boardX,by=roomY+6;
    px(bx-1,by-1,34,19,'#0b1426');px(bx,by,32,17,'#dfe6ee');
    const atBoard=[...actors.values()].some(a=>a.atBoard);
    [[3,3,14,'#9b86e0'],[3,7,20,'#d98a74'],[3,11,10,'#7f90a8']].forEach(([dx,dy,w,c],k)=>px(bx+dx,by+dy,atBoard&&!paused?Math.max(3,(Math.floor(time/220)+k*5)%w+3):w,1,c));
    px(bx+24,by+4,5,5,'#a3b05f',.7);
    return G;
  }
  function tableTop(G){
    px(G.tx-24,G.ty-1,48,7,'#5f4a3f');px(G.tx-22,G.ty-3,44,4,'#7a604f');px(G.tx-20,G.ty-4,40,2,'#957660');
    px(G.tx-2,G.ty+6,4,6,'#3a2e33');
  }
  // Trajet en ligne brisée : position au temps t, avec arrêts éventuels (attente au tableau).
  function walk(points,elapsed,speed){
    let t=elapsed/1000;
    for(let i=0;i<points.length-1;i++){
      const [x1,y1]=points[i],[x2,y2,wait=0]=points[i+1],d=Math.abs(x2-x1)+Math.abs(y2-y1),dur=d/speed;
      if(t<dur){const f=dur?t/dur:1;return {x:x1+(x2-x1)*f,y:y1+(y2-y1)*f,moving:true,done:false};}
      t-=dur;if(t<wait/1000)return {x:x2,y:y2,moving:false,done:false,pause:true};t-=wait/1000;
    }
    const [x,y]=points[points.length-1];return {x,y,moving:false,done:true};
  }
  function standPoint(parent){const d=deskSpots.get(parent);return d?[d.cx+29,d.y0+55]:null;}
  function syncActors(L,now){
    const live=new Map();
    if(getState().connected)for(const a of getState().agents)for(const s of a.activity?.subagents||[])live.set(a.id+'|'+s.id,{parent:a.id,s});
    const used=new Set([...actors.values()].filter(x=>x.seat!=null&&['aller','reunion'].includes(x.phase)).map(x=>x.seat));
    for(const [k,v] of live)if(!actors.has(k)){
      let seat=0;while(used.has(seat)&&seat<5)seat++;used.add(seat);
      const h=hash(k);
      actors.set(k,{key:k,parent:v.parent,h,seat,phase:actorsBooted&&!paused?'aller':'reunion',t0:now,speed:SPEED_MIN+(h%12),board:h%3===0});
    }
    if(getState().connected)actorsBooted=true;
    for(const [k,act] of actors){
      if(!getState().agents.some(a=>a.id===act.parent)||(paused&&['retour','remise','sortie'].includes(act.phase))){actors.delete(k);continue;}
      if(!live.has(k)&&['aller','reunion'].includes(act.phase)){
        if(paused){actors.delete(k);continue;}
        act.from=act.pos||null;act.phase='retour';act.t0=now;
      }
    }
  }
  // Assistants : version réduite d'un personnage, aux couleurs de l'agent qui les emploie.
  const skins=['#f0cdb4','#debba6','#c69878','#9c6b4e'],hairs=['#1d2738','#3a2a24','#5a4334','#2f3e57','#7a5236'];
  function helperHead(x,top,h){
    const skin=skins[h%4],hair=hairs[(h>>2)%5],style=(h>>5)%3;
    px(x-3,top,7,7,skin);px(x-3,top-1,7,2,hair);px(x-4,top,1,4,hair);px(x+4,top,1,4,hair);
    if(style===1)px(x-1,top-3,3,2,hair);if(style===2)px(x-4,top+1,1,6,hair),px(x+4,top+1,1,6,hair);
    px(x-2,top+3,1,2,'#141c2b');px(x+1,top+3,1,2,'#141c2b');px(x-1,top+5,2,1,'#a36e65');
    px(x-3,top+1,1,5,'#ffffff',.12);
  }
  function seatedHelper(x,y,h,bubbleOn,time,body='#c4d2e4'){
    px(x-5,y-16,11,12,'#22324f');px(x-4,y-15,9,10,'#2a3c5e');
    helperHead(x,y-20,h);
    px(x-4,y-13,9,8,body);px(x-4,y-13,9,1,'#ffffff',.22);px(x-1,y-13,3,2,skins[h%4]);
    // Ordinateur portable allumé : le travail du sous-agent est réel tant qu'il est actif.
    px(x-4,y-6,9,5,'#0b1424');px(x-3,y-5,7,3,'#9dbbff',.55);px(x-5,y-1,11,1,'#7f90a8');
    if(bubbleOn){
      const idea=Math.floor(time/1300)%2===0,by=y-31;
      px(x-1,by,9,8,'#0b1426');px(x,by+1,7,6,'#f2f4f7');px(x-1,by+8,3,2,'#0b1426');px(x,by+7,2,2,'#f2f4f7');
      if(idea){px(x+2,by+2,3,3,'#f4d36b');px(x+3,by+5,1,1,'#8a6a2a');}else[1,3,5].forEach(d=>px(x+d,by+4,1,1,'#0c1423'));
    }
  }
  function walkingHelper(x,y,h,moving,time,folder,body='#c4d2e4'){
    const step=moving&&!paused?Math.floor(time/140)%4:0,swing=[0,1,0,-1][step];
    px(x-4,y-1,9,2,'#0a1322',.5);
    px(x-3+Math.max(0,swing),y-6,2,6-Math.abs(swing),'#1b2941');px(x+1-Math.max(0,-swing),y-6,2,6-Math.abs(swing),'#1b2941');
    px(x-3,y-1,2,1,'#0e1626');px(x+1,y-1,2,1,'#0e1626');
    px(x-4,y-14,9,8,body);px(x-4,y-14,9,1,'#ffffff',.22);px(x-1,y-14,3,2,skins[h%4]);
    px(x-6,y-13+swing,2,6,body);px(x-6,y-8+swing,2,2,skins[h%4]);
    helperHead(x,y-21,h);
    if(folder==='aller'){px(x+4,y-12-swing,6,7,'#c9a46a');px(x+4,y-12-swing,6,1,'#e0c08a');px(x+5,y-10-swing,4,1,'#8a6a40');}
    else if(folder==='retour'){px(x+4,y-13-swing,6,8,'#c9a46a');px(x+5,y-15-swing,4,4,'#f2f4f7');px(x+6,y-14-swing,2,1,'#7f90a8');}
    else{px(x+5,y-13+swing,2,6,body);px(x+5,y-8+swing,2,2,skins[h%4]);}
  }
  function drawActors(L,G,time,now,layer){
    for(const act of actors.values()){
      const stand=standPoint(act.parent);if(!stand)continue;
      act.body=colors[Math.max(0,getState().agents.findIndex(a=>a.id===act.parent))%colors.length];
      // Chaque assistant a sa propre voie dans le couloir pour ne pas se superposer.
      const lane=G.laneY+((act.h%3)-1)*3;
      const [sx,sy]=stand,seat=G.seats[act.seat%G.seats.length],door=[G.doorX+6,lane],inside=[G.doorX+6,L.roomY+16];
      const toSeat=[[sx,sy],[sx,lane],door,inside,...(act.board?[[G.boardX+16,L.roomY+30,2600]]:[]),[seat[0],L.roomY+16],[seat[0],seat[1]]];
      if(act.phase==='aller'){
        const p=walk(toSeat,now-act.t0,act.speed);act.pos=[p.x,p.y];act.atBoard=Boolean(p.pause);
        if(p.done){act.phase='reunion';act.atBoard=false;}else{if(layer==='front')walkingHelper(Math.round(p.x),Math.round(p.y),act.h,p.moving,time,'aller',act.body);continue;}
      }
      if(act.phase==='reunion'){
        act.pos=[seat[0],seat[1]];
        if((layer==='back'&&seat[2]==='back')||(layer==='side'&&seat[2]!=='back')){
          const seated=[...actors.values()].filter(x=>x.phase==='reunion'),turn=seated.length?seated[Math.floor(time/1300)%seated.length]:null;
          seatedHelper(seat[0],seat[1],act.h,!paused&&turn===act,time,act.body);
        }
        continue;
      }
      if(act.phase==='retour'){
        const from=act.from||[seat[0],seat[1]],back=[from,[from[0],L.roomY+16],inside,door,[sx,lane],[sx,sy]];
        const p=walk(back,now-act.t0,act.speed);
        if(p.done){act.phase='remise';act.t0=now;}else{if(layer==='front')walkingHelper(Math.round(p.x),Math.round(p.y),act.h,p.moving,time,'retour',act.body);continue;}
      }
      if(act.phase==='remise'){
        // Remise du dossier complété au chef : le dossier se pose sur son bureau pendant un court instant.
        if(layer==='front'){walkingHelper(sx,sy,act.h,false,time,'retour',act.body);const d=deskSpots.get(act.parent);if(d){px(d.cx+14,d.y0+27,5,3,'#c9a46a');px(d.cx+15,d.y0+26,3,1,'#f2f4f7');}}
        if(now-act.t0>1800){act.phase='sortie';act.t0=now;}
        continue;
      }
      if(act.phase==='sortie'){
        const p=walk([[sx,sy],[sx,lane],[-6,lane]],now-act.t0,act.speed+10);
        if(p.done){actors.delete(act.key);continue;}
        if(layer==='front')walkingHelper(Math.round(p.x),Math.round(p.y),act.h,true,time,null,act.body);
      }
    }
  }
  // Vie de bureau entre le chef et ses agents, pilotée par deux faits :
  // une délégation observée dans le journal du chef (`herdr agent prompt`), et la fin réelle d'un travail (état Herdr).
  const awayAgents=new Set(),officeActors=new Map(),seenDelegations=new Set(),mailLog=[];let officeBooted=false,mailCount=0,mailSpot=null,mailTotal=0,mailShown='',mailVus=new Set();
  // Mémoire bornée : on oublie les plus anciens identifiants vus, que le journal du chef (12 h) ne renverra plus.
  function remember(key){seenDelegations.add(key);if(seenDelegations.size>500)seenDelegations.delete(seenDelegations.values().next().value);}
  // Courrier du chef : les délégations réellement observées dans son journal (12 h),
  // avec l'heure du dernier envoi observé. Le champ result ne parle QUE de l'envoi :
  // jamais une réussite de travail non confirmée n'est affichée.
  function resultLabel(result){
    if(result&&result.ok===true)return t('equipe.resultat_ok');
    if(result&&result.ok===false)return t('equipe.resultat_ko');
    return t('equipe.resultat_inconnu');
  }
  function renderMail(){
    const list=$('mail-list');
    const delegs=getState().agents.flatMap(a=>(Array.isArray(a.delegations)?a.delegations:[]).map(d=>({d,a})))
      .filter(({d})=>d&&d.at&&!Number.isNaN(new Date(d.at))&&Date.now()-new Date(d.at)<=12*3600*1000)
      .sort((x,y)=>new Date(y.d.at)-new Date(x.d.at));
    // Même affichage, même dessin : la liste n'est pas rebâtie pour rien.
    const signature=JSON.stringify([delegs.map(({d})=>[d.id,d.at,d.target,d.title,d.result]),getState().agents.map(a=>a.id+a.name)]);
    if(signature===mailShown)return;mailShown=signature;
    // Annonce discrète aux lecteurs d'écran : seulement les envois apparus après le premier affichage.
    const nouveaux=delegs.filter(({d})=>!mailVus.has(d.id));
    if(mailVus.size&&nouveaux.length){const c=agentByTarget(nouveaux[0].d.target);$('mail-live').textContent=t('equipe.courrier_annonce',{nom:c?c.name:String(nouveaux[0].d.target)});}
    for(const {d} of delegs)mailVus.add(d.id);
    $('mail-count').textContent=delegs.length?t('equipe.dernier_envoi',{heure:hhmm(new Date(delegs[0].d.at))}):'';
    if(!delegs.length){const li=document.createElement('li');li.className='list-placeholder';li.textContent=t('equipe.aucune_delegation');list.replaceChildren(li);return;}
    list.replaceChildren(...delegs.slice(0,30).map(({d})=>{
      const li=document.createElement('li');li.className='mail';
      const cible=agentByTarget(d.target);
      const head=document.createElement('span');head.className='log-head';
      head.textContent=t('equipe.vers',{heure:hhmm(new Date(d.at)),nom:cible?cible.name:String(d.target)});
      const body=document.createElement('span');body.className='log-body';
      body.textContent=d.title?t('equipe.tache_deleguee',{titre:d.title}):t('equipe.contenu_ilisible');
      const why=document.createElement('span');why.className='log-why';why.textContent=resultLabel(d.result);
      const open=document.createElement('button');open.type='button';open.className='tool-button';open.textContent=t('equipe.ouvrir_son_poste');
      open.hidden=!cible;
      open.addEventListener('click',()=>{if(cible&&getState().agents.some(x=>x.id===cible.id))selectAgent(cible.id);showTab('poste');});
      // P1 : copie de la délégation OBSERVÉE, jamais « copier la réponse » : ce
      // contenu n'est pas une réponse d'agent. Les champs copiés sont nommés.
      const copier=document.createElement('button');copier.type='button';copier.className='tool-button';copier.textContent=t('equipe.copier_delegation');
      const aide=t('equipe.aide_copier_delegation');
      copier.title=aide;copier.setAttribute('aria-label',aide);
      copier.addEventListener('click',()=>{
        const texte=[
          t('equipe.copie_cible',{cible:cible?cible.name+' ('+d.target+')':String(d.target)}),
          t('equipe.copie_heure',{heure:new Date(d.at).toLocaleString('fr-FR')}),
          t('equipe.copie_tache',{titre:d.title||t('equipe.non_lisible')}),
          t('equipe.copie_envoi',{etat:resultLabel(d.result)}),
        ].join('\n');
        copyText(texte,t('equipe.delegation_de',{heure:hhmm(new Date(d.at))}),copier);
      });
      const actions=document.createElement('span');actions.className='log-actions';actions.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;';
      actions.append(open,copier);
      li.append(head,body,why,actions);return li;
    }));
  }
  function syncOffice(L,now){
    if(!getState().connected||!L.boss)return;
    for(const d of L.boss.delegations||[]){
      const dk=d.id+'|'+d.target;if(seenDelegations.has(dk))continue;
      // En pause, la délégation n'est pas marquée vue : la tournée partira à la reprise de l'animation.
      if(officeBooted&&paused)continue;
      remember(dk);
      const t=agentByTarget(d.target);
      if(!officeBooted||!t||t===L.boss)continue;
      officeActors.set('deleg|'+dk,{type:'deleg',agent:t.id,t0:now,h:hash(t.id),title:d.title});
      signal('delegation',null);
    }
    for(const a of getState().agents){
      if(a===L.boss)continue;
      const c=changes.get(a.id);
      if(!c||!WORK.includes(c.from)||!FREE.includes(c.to))continue;
      const key='mail|'+a.id+'|'+Math.round(c.at);
      if(officeActors.has(key)||seenDelegations.has(key))continue;remember(key);
      if(!officeBooted)continue;
      const deleg=(L.boss.delegations||[]).filter(d=>agentByTarget(d.target)===a).at(-1);
      mailLog.unshift({agentId:a.id,name:a.name,at:new Date(),from:c.from,to:c.to,title:deleg?.title||null});mailLog.length=Math.min(mailLog.length,30);mailTotal++;renderMail();
      signal('mail',t('equipe.notif_termine',{nom:a.name}),deleg?.title?t('equipe.notif_tache',{titre:deleg.title}):t('equipe.notif_resultat'));
      if(!paused)officeActors.set(key,{type:'mail',agent:a.id,t0:now});else mailCount++;
    }
    officeBooted=true;
  }
  function drawOffice(L,vip,time,now){
    awayAgents.clear();let bossBusy=false;
    const boss=vip&&deskSpots.get(L.boss.id);
    for(const [key,act] of officeActors){
      const d=deskSpots.get(act.agent);
      if(!d||!boss){officeActors.delete(key);continue;}
      if(act.type==='mail'){
        // L'enveloppe vole du poste de l'agent jusqu'au chef, puis rejoint sa pile ; le chef lève le pouce.
        const f=Math.min(1,(now-act.t0)/1600),x0=d.cx,y0=d.y0+18,x1=boss.cx-18,y1=boss.y0+26;
        if(f<1){const x=x0+(x1-x0)*f,y=y0+(y1-y0)*f-Math.sin(f*Math.PI)*24;px(x-4,y-3,9,6,'#dfe6ee');px(x-3,y-2,7,1,'#9aabc1');px(x-1,y-1,3,1,'#9aabc1');}
        else if(f>=1&&!act.landed){act.landed=now;mailCount++;}
        if(act.landed){
          const age=now-act.landed;
          if(age<2200){const bx=boss.cx+12,by=boss.y0-1;px(bx,by,11,9,'#0b1426');px(bx+1,by+1,9,7,'#dfe6ee');px(bx+3,by+4,2,3,'#0c1423');px(bx+5,by+3,3,4,'#0c1423');px(bx+5,by+2,1,1,'#0c1423');px(bx,by+9,3,2,'#0b1426');}
          else officeActors.delete(key);
        }
        continue;
      }
      // Délégation observée : le chef se lève, sort de la Direction, porte le dossier jusqu'au poste de l'agent,
      // le pose sur son bureau, puis revient s'asseoir. Une seule tournée à la fois : les suivantes attendent.
      if(bossBusy){act.t0=now;continue;}
      bossBusy=true;
      // Scène en pause : la tournée se fige ; à la reprise, l'horloge de marche est décalée de la durée de pause.
      if(paused)act.pausedAt??=now;
      else if(act.pausedAt!=null){act.t0+=now-act.pausedAt;act.pausedAt=null;}
      const clock=act.pausedAt??now;
      const bossSpot=[boss.cx-30,boss.y0+55],door=[boss.cx,vip.doorY+4],stand=[d.cx+29,d.y0+55];
      const there=[bossSpot,[door[0],bossSpot[1]],door,[stand[0],door[1]],[stand[0],stand[1],1800]];
      const back=[stand,[stand[0],door[1]],door,[door[0],bossSpot[1]],bossSpot];
      const speed=34+(act.h%8),goT=clock-act.t0;
      let p=walk(there,goT,speed),returning=false;
      if(p.done){p=walk(back,goT-act.goDur,speed);returning=true;}
      else act.goDur=goT+1;
      if(returning&&p.done){officeActors.delete(key);continue;}
      awayAgents.add(L.boss.id);
      // Remise : le dossier apparaît sur le bureau de l'agent, avec le titre de la tâche s'il est connu.
      if(p.pause||returning){px(d.cx+4,d.y0+26,8,5,'#c9a46a');px(d.cx+4,d.y0+26,8,1,'#e0c08a');px(d.cx+5,d.y0+28,5,1,'#8a6a40');}
      if(p.pause&&act.title){const t=fit(act.title,Math.min(110,L.W-8)),tx=Math.max(2,Math.min(L.W-textWidth(t)-6,d.cx-textWidth(t)/2));px(tx-3,d.y0-3,textWidth(t)+6,9,'#0b1426');text(t,tx,d.y0-1,'#f4d36b');}
      walkingHelper(Math.round(p.x),Math.round(p.y),hash(L.boss.id),p.moving,time,returning?null:'aller',colors[Math.max(0,getState().agents.indexOf(L.boss))%colors.length]);
    }
  }
  // Pause de quota : l'agent éteint son écran et quitte le bureau par la gauche, batterie vide ;
  // au retour observé, il revient batterie pleine et se rassoit. Scène en pause : pas de trajet.
  function drawQuotaTrips(L,time,now){
    for(const [id,trip] of quotaTrips){
      const d=deskSpots.get(id),a=getState().agents.find(x=>x.id===id);
      if(!d||!a||paused){quotaTrips.delete(id);continue;}
      const stand=[d.cx+29,d.y0+55],lane=L.roomY-3,path=[stand,[stand[0],lane],[-8,lane]];
      const p=walk(trip.dir==='out'?path:[...path].reverse(),now-trip.t0,30+(trip.h%6));
      if(p.done){quotaTrips.delete(id);continue;}
      const x=Math.round(p.x),y=Math.round(p.y);
      walkingHelper(x,y,trip.h,p.moving,time,null,colors[Math.max(0,getState().agents.indexOf(a))%colors.length]);
      // Batterie au-dessus de la tête : vide au départ, pleine au retour.
      const full=trip.dir==='in',bx=x-4,by=y-32;
      px(bx,by,8,5,'#0b1426');px(bx+8,by+1,1,3,'#0b1426');px(bx+1,by+1,6,3,'#1a2740');
      px(bx+1,by+1,full?6:1,3,full?'#a0dfc4':'#ff8a7a');
    }
  }
  function draw(time){
    const L=layout(),key=L.W+'x'+L.H+'@'+L.S,now=performance.now();
    if(key!==layoutKey){layoutKey=key;off.width=L.W;off.height=L.H;canvas.width=L.W*L.S;canvas.height=L.H*L.S;canvas.parentElement.style.aspectRatio=L.W+' / '+L.H;}
    spots=[];g.clearRect(0,0,L.W,L.H);trackChanges();amb=daylight();
    room(L,time);
    const G=meetingRoom(L,time),vip=L.boss?vipOffice(L,time):null;
    const all=getState().agents.length?getState().agents:[null,null],items=all.filter(a=>!L.boss||a!==L.boss);
    deskSpots.clear();
    if(vip)station(L.boss,getState().agents.indexOf(L.boss),vip.cx,vip.y0,time,L);
    const f=floorBox(L);lastLayout=L;
    items.forEach((a,i)=>{
      const r=Math.floor(i/L.cols),inRow=Math.min(L.cols,items.length-r*L.cols),c=i%L.cols;
      let cx=Math.round(L.areaW/2+(c-(inRow-1)/2)*L.cw),y0=L.top+r*L.rowH;
      const saved=a&&custom.stations[layoutKeyOf(a)];
      if(saved){cx=Math.round(Math.max(26,Math.min(L.W-26,saved.fx*L.W)));y0=Math.round(Math.max(f.top,Math.min(L.roomY-L.rowH,f.top+saved.fy*f.h)));}
      station(a,a?getState().agents.indexOf(a):i,cx,y0,time,L);
      if(editLayout&&a){const hw=Math.min(31,Math.floor(L.cw/2)-1);px(cx-hw,y0+4,hw*2,1,'#a0dfc4',.6);px(cx-hw,y0+77,hw*2,1,'#a0dfc4',.6);px(cx-hw,y0+4,1,74,'#a0dfc4',.6);px(cx+hw-1,y0+4,1,74,'#a0dfc4',.6);}
    });
    syncActors(L,now);syncOffice(L,now);
    drawActors(L,G,time,now,'back');if(roomOpen())tableTop(G);drawActors(L,G,time,now,'side');drawActors(L,G,time,now,'front');
    drawOffice(L,vip,time,now);drawQuotaTrips(L,time,now);
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(off,0,0,canvas.width,canvas.height);
    const summary=!getState().connected?t('scene.resume_hors_ligne'):!getState().agents.length?t('scene.resume_vide'):t('scene.resume',{liste:getState().agents.map(a=>t('scene.resume_item',{nom:a.name,etat:label(a).toLowerCase()})).join(', ')});
    if(summary!==ariaText){ariaText=summary;canvas.setAttribute('aria-label',summary);}
    attentionTitle();
  }
  // En vue globale l'image est centrée dans son cadre (object-fit: contain) : on retire les bandes vides avant de convertir le clic.
  const spotAt=event=>{
    const r=canvas.getBoundingClientRect(),k=Math.min(r.width/canvas.width,r.height/canvas.height);
    const ox=(r.width-canvas.width*k)/2,oy=(r.height-canvas.height*k)/2;
    const x=(event.clientX-r.left-ox)/k,y=(event.clientY-r.top-oy)/k;
    return spots.find(s=>x>=s.x&&x<=s.x+s.w&&y>=s.y&&y<=s.y+s.h);
  };
  const onMail=event=>{if(!mailSpot)return false;const p=toLogical(event);return p.x>=mailSpot.x&&p.x<=mailSpot.x+mailSpot.w&&p.y>=mailSpot.y&&p.y<=mailSpot.y+mailSpot.h;};
  canvas.addEventListener('click',event=>{
    if(editLayout)return;
    if(screenSpot){const p=toLogical(event);if(p.x>=screenSpot.x&&p.x<=screenSpot.x+screenSpot.w&&p.y>=screenSpot.y&&p.y<=screenSpot.y+screenSpot.h){showTab('taches');return;}}
    if(boardSpot){const p=toLogical(event);if(p.x>=boardSpot.x&&p.x<=boardSpot.x+boardSpot.w&&p.y>=boardSpot.y&&p.y<=boardSpot.y+boardSpot.h){openBoard();return;}}
    if(onMail(event)){mailCount=0;draw(lastFrame);showTab('equipe');$('mailbox').scrollIntoView({block:'start'});$('mailbox').classList.remove('flash');void $('mailbox').offsetWidth;$('mailbox').classList.add('flash');return;}
    const spot=spotAt(event);if(spot)selectAgent(spot.id);
  });
  let vipRect=null,lastLayout=null;
  function toLogical(event){
    const r=canvas.getBoundingClientRect(),k=Math.min(r.width/canvas.width,r.height/canvas.height);
    const ox=(r.width-canvas.width*k)/2,oy=(r.height-canvas.height*k)/2,S=lastLayout?.S||1;
    return {x:(event.clientX-r.left-ox)/k/S,y:(event.clientY-r.top-oy)/k/S};
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!editLayout||!lastLayout)return;
    const p=toLogical(event),L=lastLayout,v=vipRect;
    if(v&&p.x>=v.x+v.w-10&&p.x<=v.x+v.w&&p.y>=v.y+v.h-14&&p.y<=v.y+v.h)dragging={type:'resize'};
    else if(v&&p.x>=v.x&&p.x<=v.x+v.w&&p.y>=v.y&&p.y<=v.y+v.h)dragging={type:'vip',dx:p.x-(v.x+v.w/2),dy:p.y-v.y};
    else{
      const spot=spotAt(event),a=spot&&getState().agents.find(x=>x.id===spot.id),d=a&&deskSpots.get(a.id);
      if(a&&d&&a!==L.boss)dragging={type:'station',key:layoutKeyOf(a),dx:p.x-d.cx,dy:p.y-d.y0};
    }
    if(dragging){canvas.setPointerCapture(event.pointerId);event.preventDefault();}
  });
  canvas.addEventListener('pointermove',event=>{
    if(!dragging||!lastLayout)return;
    const p=toLogical(event),L=lastLayout,f=floorBox(L),v=vipRect;
    if(dragging.type==='station')custom.stations[dragging.key]={fx:(p.x-dragging.dx)/L.W,fy:(p.y-dragging.dy-f.top)/f.h};
    else if(dragging.type==='vip')custom.vip={fx:(p.x-dragging.dx)/L.W,fy:(p.y-dragging.dy-f.top)/f.h,fw:v.w/L.W,fh:v.h/f.h};
    else if(dragging.type==='resize'){const w=Math.max(70,p.x-v.x),h=Math.max(70,p.y-v.y+4);custom.vip={fx:(v.x+w/2)/L.W,fy:(v.y-f.top)/f.h,fw:w/L.W,fh:h/f.h};}
    draw(lastFrame);
  });
  canvas.addEventListener('pointerup',()=>{if(dragging){dragging=null;saveLayout();}});
  function syncLayoutEdit(){
    $('layout-edit').dataset.actif=String(editLayout);$('layout-edit').querySelector('span').textContent=editLayout?t('commandes.terminer'):t('commandes.disposer');
    $('layout-reset').hidden=!editLayout;$('layout-hint').hidden=!editLayout;canvas.classList.toggle('editing',editLayout);draw(lastFrame);
  }
  $('layout-edit').addEventListener('click',()=>{editLayout=!editLayout;syncLayoutEdit();});
  $('layout-reset').addEventListener('click',()=>{custom={stations:{},vip:null};saveLayout();draw(lastFrame);});
  addEventListener('keydown',e=>{
    // Disposer au clavier : les flèches déplacent le poste sélectionné (Maj pour un grand pas).
    // Elles restent aux onglets, listes et champs qui les traitent déjà ; Échap est géré avec les autres couches.
    if(!editLayout||!lastLayout||!/^Arrow/.test(e.key)||e.defaultPrevented||e.isComposing||!$('palette').hidden)return;
    const t=document.activeElement;if(/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName||'')||t?.isContentEditable||t?.closest?.('[role="tab"],[role="listbox"],.help'))return;
    const a=activeAgent(),L=lastLayout,f=floorBox(L),step=e.shiftKey?10:2,d=a&&deskSpots.get(a.id);if(!d)return;
    e.preventDefault();
    const dx={ArrowLeft:-step,ArrowRight:step}[e.key]||0,dy={ArrowUp:-step,ArrowDown:step}[e.key]||0;
    if(a===L.boss&&vipRect)custom.vip={fx:(vipRect.x+vipRect.w/2+dx)/L.W,fy:(vipRect.y+dy-f.top)/f.h,fw:vipRect.w/L.W,fh:vipRect.h/f.h};
    else custom.stations[layoutKeyOf(a)]={fx:(d.cx+dx)/L.W,fy:(d.y0+dy-f.top)/f.h};
    saveLayout();draw(lastFrame);
  });
  let hoverFrame=null,hoverEvent=null;
  canvas.addEventListener('mousemove',event=>{
    hoverEvent=event;
    if(hoverFrame!==null)return;
    hoverFrame=requestAnimationFrame(()=>{
      hoverFrame=null;
      const event=hoverEvent;hoverEvent=null;
      const id=spotAt(event)?.id||null,mail=onMail(event);canvas.style.cursor=editLayout?'move':id||mail?'pointer':'default';const onBoard=boardSpot&&(()=>{const p=toLogical(event);return p.x>=boardSpot.x&&p.x<=boardSpot.x+boardSpot.w&&p.y>=boardSpot.y&&p.y<=boardSpot.y+boardSpot.h;})();if(onBoard&&!editLayout)canvas.style.cursor='pointer';canvas.title=mail?t('equipe.courrier_titre'):onBoard?t('equipe.tableau_titre'):'';if(id!==hovered){hovered=id;draw(lastFrame);}
    });
  });
  canvas.addEventListener('mouseleave',()=>{
    if(hoverFrame!==null)cancelAnimationFrame(hoverFrame);
    hoverFrame=hoverEvent=null;
    canvas.style.cursor='default';canvas.title='';
    if(hovered){hovered=null;draw(lastFrame);}
  });
  new ResizeObserver(()=>draw(lastFrame)).observe(canvas.parentElement);
  $('fullscreen').hidden=!document.fullscreenEnabled;
  $('fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else document.querySelector('main').requestFullscreen().catch(()=>{});});
  document.addEventListener('fullscreenchange',()=>{const on=Boolean(document.fullscreenElement);$('fullscreen').dataset.actif=String(on);$('fullscreen').querySelector('span').textContent=on?t('commandes.quitter_plein_ecran'):t('commandes.plein_ecran');draw(lastFrame);});
  // L'onglet signale les agents qui attendent DrSmoke, même quand la page est en arrière-plan.
  function attentionTitle(){const n=getState().connected?getState().agents.filter(a=>WAIT.includes(a.status)).length:0,title=(n?'('+n+') ':'')+t('etat.titre_document');if(document.title!==title)document.title=title;}
  // Figée, la scène se redessine encore chaque minute pour suivre l'heure et la lumière.
  let sceneFrame=null,sceneTimer=null,sceneImmediate=false;
  function syncSceneLoop(){
    if(sceneFrame!==null)cancelAnimationFrame(sceneFrame);
    if(sceneTimer!==null)clearTimeout(sceneTimer);
    sceneFrame=sceneTimer=null;
    sceneImmediate=true;
    if(!isTilesOn())sceneFrame=requestAnimationFrame(frame);
  }
  function frame(time){
    sceneFrame=null;
    if(isTilesOn())return;
    if(sceneImmediate||time-lastFrame>=(paused?60000:80)){sceneImmediate=false;draw(time);lastFrame=time;}
    if(paused)sceneTimer=setTimeout(()=>{sceneTimer=null;sceneFrame=requestAnimationFrame(frame);},60000);
    else sceneFrame=requestAnimationFrame(frame);
  }
  return {
    draw,
    sync: syncSceneLoop,
    isPaused: () => paused,
    setPaused: (on) => { paused = on; },
    renderMail,
    changeOf: (id) => changes.get(id),
    forgetMissing(live, statusCache) {
      for (const m of [lastStatus, changes, statusCache, pausedSeen]) for (const id of m.keys()) if (!live.has(id)) m.delete(id);
    },
    acknowledgeMail() { if (mailCount) { mailCount = 0; draw(lastFrame); } },
    layoutEdit: () => editLayout,
    toggleLayoutEdit() { editLayout = !editLayout; syncLayoutEdit(); },
    endLayoutEdit() { editLayout = false; syncLayoutEdit(); },
  };
}
