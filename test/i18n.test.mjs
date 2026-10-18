import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createBureauServer} from '../server.mjs';

const racine=join(dirname(fileURLToPath(import.meta.url)),'..');
const cheminI18n=join(racine,'public','i18n.js');
const cheminEn=join(racine,'public','i18n-en.js');

// Charge le runtime comme le navigateur : i18n.js puis i18n-en.js.
function charger({langueStockee=null,langueNavigateur='fr-FR'}={}) {
  const contexte={
    navigator:{language:langueNavigateur},
    localStorage:{getItem:cle=>cle==='bureau.langue'?langueStockee:null,setItem:()=>{}},
    location:{reload(){}},
    document:{readyState:'complete',documentElement:{lang:''},querySelectorAll:()=>[],getElementById:()=>null,addEventListener:()=>{}},
  };
  contexte.window=contexte;
  vm.createContext(contexte);
  vm.runInContext(readFileSync(cheminI18n,'utf8'),contexte,{filename:'i18n.js'});
  vm.runInContext(readFileSync(cheminEn,'utf8'),contexte,{filename:'i18n-en.js'});
  return contexte.window;
}

const fichiersTexte=()=>readdirSync(join(racine,'public'))
  .filter(nom=>nom.endsWith('.js')&&!nom.startsWith('i18n'))
  .map(nom=>({nom,texte:readFileSync(join(racine,'public',nom),'utf8')}));

function clesUtilisees() {
  const utilisees=new Set();
  const html=readFileSync(join(racine,'public','index.html'),'utf8');
  for(const [,cle] of html.matchAll(/data-i18n="([^"]+)"/g)) utilisees.add(cle);
  for(const [,attributs] of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for(const couple of attributs.split(';')) {
      const [,cle]=couple.split(':');
      if(cle) utilisees.add(cle.trim());
    }
  }
  for(const {texte} of fichiersTexte()) {
    for(const [,cle] of texte.matchAll(/\bt\(\s*'([^']+)'/g)) utilisees.add(cle);
    for(const [,cle] of texte.matchAll(/\bt\(\s*"([^"]+)"/g)) utilisees.add(cle);
  }
  return utilisees;
}

function litterales() {
  // Littéraux en forme de clé (citation directe d'une clé, y compris via variable),
  // plus les clés portées par data-i18n et data-i18n-attr. Motif ancré sur la
  // citation pour ne pas se perdre sur les apostrophes des phrases.
  const trouvees=new Set();
  const motif=/['"`]([a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+)['"`]/g;
  for(const {texte} of fichiersTexte()) {
    for(const [,valeur] of texte.matchAll(motif)) trouvees.add(valeur);
  }
  const html=readFileSync(join(racine,'public','index.html'),'utf8');
  for(const [,valeur] of html.matchAll(motif)) trouvees.add(valeur);
  for(const [,cle] of html.matchAll(/data-i18n="([^"]+)"/g)) trouvees.add(cle);
  for(const [,attributs] of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for(const couple of attributs.split(';')) {
      const [,cle]=couple.split(':');
      if(cle) trouvees.add(cle.trim());
    }
  }
  return trouvees;
}

test('i18n : les fichiers existent et le runtime répond',()=>{
  assert.ok(existsSync(cheminI18n),'public/i18n.js existe');
  assert.ok(existsSync(cheminEn),'public/i18n-en.js existe');
  const fenetre=charger();
  assert.equal(typeof fenetre.t,'function');
  assert.equal(typeof fenetre.tServeur,'function');
  assert.equal(typeof fenetre.getLangue,'function');
  assert.equal(typeof fenetre.setLangue,'function');
  assert.deepEqual([...fenetre.i18nLangues],['fr','en']);
});

test('i18n : chaque clé utilisée existe dans les deux dictionnaires',()=>{
  const fenetre=charger();
  const utilisees=clesUtilisees();
  assert.ok(utilisees.size>50,'des clés sont bien détectées ('+utilisees.size+')');
  const manquantesFr=[...utilisees].filter(cle=>fenetre.__i18n.FR[cle]===undefined);
  const manquantesEn=[...utilisees].filter(cle=>fenetre.__i18n.EN[cle]===undefined);
  assert.deepEqual(manquantesFr,[],'clés utilisées absentes du français');
  assert.deepEqual(manquantesEn,[],'clés utilisées absentes de l\'anglais');
});

test('i18n : aucune clé orpheline dans les dictionnaires',()=>{
  const fenetre=charger();
  const utilise=litterales();
  for(const cle of Object.values(fenetre.__i18n.ERREURS_SERVEUR)) utilise.add(cle);
  const orphelines=Object.keys(fenetre.__i18n.FR).filter(cle=>!utilise.has(cle));
  assert.deepEqual(orphelines,[],'clés du dictionnaire jamais utilisées');
  assert.deepEqual(Object.keys(fenetre.__i18n.FR).sort(),Object.keys(fenetre.__i18n.EN).sort(),'les deux dictionnaires ont les mêmes clés');
});

test('i18n : t remplace les valeurs du gabarit',()=>{
  const fenetre=charger();
  const avecValeur=Object.entries(fenetre.__i18n.FR).find(([,texte])=>/\{\w+\}/.test(texte));
  assert.ok(avecValeur,'un gabarit avec valeur existe');
  const [cle,texteFr]=avecValeur;
  const nom=texteFr.match(/\{(\w+)\}/)[1];
  const rendu=fenetre.t(cle,{[nom]:'ZZVALEUR'});
  assert.ok(rendu.includes('ZZVALEUR'),'la valeur remplace le gabarit');
  assert.ok(!/\{\w+\}/.test(rendu),'aucun gabarit résiduel');
});

test('i18n : repli sur le français quand la clé anglaise manque',()=>{
  const fenetre=charger();
  const [cle,texteFr]=Object.entries(fenetre.__i18n.FR)[0];
  delete fenetre.DICTIONNAIRE_EN[cle];
  fenetre.setLangue('en');
  assert.equal(fenetre.t(cle),texteFr);
});

test('i18n : la langue vient de localStorage puis du navigateur',()=>{
  assert.equal(charger({langueNavigateur:'fr-FR'}).getLangue(),'fr');
  assert.equal(charger({langueNavigateur:'en-US'}).getLangue(),'en');
  assert.equal(charger({langueNavigateur:'fr-FR',langueStockee:'en'}).getLangue(),'en');
  assert.equal(charger({langueNavigateur:'en-US',langueStockee:'fr'}).getLangue(),'fr');
});

test('i18n : pluriels explicites .un et .autres en paire',()=>{
  const fenetre=charger();
  const cles=Object.keys(fenetre.__i18n.FR);
  const sansPaire=cles.filter(cle=>cle.endsWith('.un')&&!cles.includes(cle.slice(0,-2)+'autres'))
    .concat(cles.filter(cle=>cle.endsWith('.autres')&&!cles.includes(cle.slice(0,-6)+'un')));
  assert.deepEqual(sansPaire,[],'chaque pluriel a ses deux clés');
});

test('i18n : messages du serveur traduits, message inconnu laissé tel quel',()=>{
  const fenetre=charger();
  const table=fenetre.__i18n.ERREURS_SERVEUR;
  assert.ok(Object.keys(table).length>5,'la table des messages serveur existe');
  const [message,cle]=Object.entries(table)[0];
  assert.equal(fenetre.tServeur(message),fenetre.__i18n.FR[cle]);
  fenetre.setLangue('en');
  assert.equal(fenetre.tServeur(message),fenetre.__i18n.EN[cle]);
  assert.equal(fenetre.tServeur('Message jamais vu du serveur.'),'Message jamais vu du serveur.');
  for(const cleErreur of Object.keys(fenetre.__i18n.FR).filter(c=>c.startsWith('erreur.serveur.'))) {
    assert.ok(fenetre.__i18n.FR[cleErreur],'le français de '+cleErreur+' existe');
    assert.ok(fenetre.__i18n.EN[cleErreur],'l\'anglais de '+cleErreur+' existe');
  }
});

test('i18n : la traduction attend le chargement du dictionnaire anglais',()=>{
  // Les scripts defer s'exécutent en readyState 'interactive', avant i18n-en.js :
  // appliquer tout de suite traduirait avec le seul français.
  let surCharge=null;
  let appels=0;
  const contexte={
    navigator:{language:'en-US'},
    localStorage:{getItem:()=>null,setItem:()=>{}},
    location:{reload(){}},
    document:{readyState:'interactive',documentElement:{lang:''},querySelectorAll:()=>{appels++;return [];},getElementById:()=>null,addEventListener:(nom,fn)=>{if(nom==='DOMContentLoaded')surCharge=fn;}},
  };
  contexte.window=contexte;
  vm.createContext(contexte);
  vm.runInContext(readFileSync(cheminI18n,'utf8'),contexte,{filename:'i18n.js'});
  assert.equal(appels,0,'rien n\'est appliqué avant DOMContentLoaded');
  assert.equal(typeof surCharge,'function','l\'application est programmée sur DOMContentLoaded');
  vm.runInContext(readFileSync(cheminEn,'utf8'),contexte,{filename:'i18n-en.js'});
  surCharge();
  assert.ok(appels>0,'l\'application a lieu une fois les deux dictionnaires chargés');
  assert.equal(contexte.window.t('header.au-travail'),'at work');
});

test('i18n : les deux fichiers sont servis par le bureau',async t=>{
  const server=createBureauServer({bridge:{list:async()=>[],read:async()=>({text:''}),prompt:async()=>({}),interrupt:async()=>({}),broadcast:async()=>({results:[]})}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const port=server.address().port;
  const lire=chemin=>new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path:chemin,method:'GET',headers:{Host:`127.0.0.1:${port}`,'Sec-Fetch-Site':'same-origin'}},res=>{
      let texte='';
      res.setEncoding('utf8');
      res.on('data',chunk=>texte+=chunk);
      res.on('end',()=>resolve({status:res.statusCode,type:res.headers['content-type'],texte}));
    });
    req.on('error',reject);
    req.end();
  });
  for(const chemin of ['/i18n.js','/i18n-en.js']) {
    const reponse=await lire(chemin);
    assert.equal(reponse.status,200,chemin+' est servi');
    assert.match(reponse.type,/javascript/);
    assert.ok(reponse.texte.length>1000);
  }
});
