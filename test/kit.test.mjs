import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir, stat, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { initKit } from '../scripts/init-kit.mjs';
import { evaluer, texte } from '../scripts/evaluer.mjs';
import { partagerLecon } from '../scripts/partager-lecons.mjs';

const executer = promisify(execFile);
// Le crochet de commit exporte GIT_INDEX_FILE : les dépôts temporaires des tests doivent l'ignorer.
const envGit = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !cle.startsWith('GIT_')));
const temporaire = async t => { const d = await mkdtemp(join(tmpdir(), 'kit-')); t.after(() => rm(d, { recursive: true, force: true })); return d; };
const existe = async chemin => Boolean(await stat(chemin).catch(() => null));

test('init-kit crée les fichiers piliers sans jamais écraser un fichier existant', async t => {
  const dossier = await temporaire(t);
  await writeFile(join(dossier, 'LESSONS.md'), '# Mes leçons\n- gardée\n');
  const r = await initKit(dossier, { lang: 'fr' });
  assert.ok(r.conserves.includes('LESSONS.md'));
  assert.equal(await readFile(join(dossier, 'LESSONS.md'), 'utf8'), '# Mes leçons\n- gardée\n');
  for (const nom of ['AGENTS.md', 'CHEF.md', 'CLAUDE.md', 'GEMINI.md', '.myteam-local/HANDOFF.md', 'TODO.md', '.myteam-local/JOURNAL.md', 'PRODUCT.md', 'docs/plan-travail.md', 'docs/mission-modele.md', 'docs/auto-evaluation.md', 'scripts/evaluer.mjs', 'scripts/partager-lecons.mjs']) {
    assert.ok(await existe(join(dossier, nom)), nom);
  }
  const deuxieme = await initKit(dossier, { lang: 'fr' });
  assert.deepEqual(deuxieme.crees, []);
  assert.ok(deuxieme.conserves.length >= r.crees.length);
});

test('init-kit : simulation sans écriture, langue anglaise, refus d’une langue inconnue ou d’une cible fichier', async t => {
  const dossier = await temporaire(t);
  const simulation = await initKit(join(dossier, 'projet'), { lang: 'en', dryRun: true });
  assert.ok(simulation.crees.length > 5);
  assert.equal(await existe(join(dossier, 'projet')), false);
  await initKit(join(dossier, 'projet'), { lang: 'en' });
  assert.match(await readFile(join(dossier, 'projet', 'AGENTS.md'), 'utf8'), /Project rules for every AI/);
  await assert.rejects(initKit(dossier, { lang: 'de' }), /Langue inconnue/);
  await writeFile(join(dossier, 'fichier.txt'), 'x');
  await assert.rejects(initKit(join(dossier, 'fichier.txt')), /n.est pas un dossier/);
});

test('les deux langues du kit ont les mêmes fichiers et la règle de signature', async () => {
  const noms = async langue => { const sortie = []; const lire = async (d, p = '') => { for (const e of await readdir(d, { withFileTypes: true })) e.isDirectory() ? await lire(join(d, e.name), p + e.name + '/') : sortie.push(p + e.name); }; await lire(fileURLToPath(new URL(`../kit/${langue}`, import.meta.url))); return sortie.sort(); };
  assert.deepEqual(await noms('fr'), await noms('en'));
  for (const langue of ['fr', 'en']) {
    const agents = await readFile(new URL(`../kit/${langue}/AGENTS.md`, import.meta.url), 'utf8');
    assert.match(agents, /Co-Authored-By/);
  }
});

test('evaluer ne rapporte que des faits : piliers, cases cochées, leçons, contrôles lancés', async t => {
  const dossier = await temporaire(t);
  await initKit(dossier, { lang: 'fr' });
  await writeFile(join(dossier, 'TODO.md'), '# T\n- [x] a\n- [ ] b\n- [x] c\n');
  const r = await evaluer(dossier, { lancerTests: false });
  assert.deepEqual(r.piliers.manquants, []);
  assert.equal(r.plan.total, 3 + 3);
  assert.equal(r.plan.fait, 2);
  assert.ok(r.lecons.total >= 8);
  assert.equal(r.git, null);
  assert.equal(r.ok, true);
  assert.match(texte(r, 'fr'), /Fichiers piliers : 5\/5/);
  assert.match(texte(r, 'en'), /Pillar files: 5\/5/);
  await rm(join(dossier, '.myteam-local/JOURNAL.md'));
  const sans = await evaluer(dossier, { lancerTests: false });
  assert.deepEqual(sans.piliers.manquants, ['.myteam-local/JOURNAL.md']);
  assert.equal(sans.ok, false);
});

test('evaluer lance check et test seulement s’ils existent et échoue si un contrôle échoue', async t => {
  const dossier = await temporaire(t);
  await initKit(dossier, { lang: 'fr' });
  await writeFile(join(dossier, 'package.json'), JSON.stringify({ scripts: { check: 'x', test: 'y' } }));
  const lances = [];
  const r = await evaluer(dossier, { lancer: async (_d, script) => { lances.push(script); return script === 'check'; } });
  assert.deepEqual(lances, ['check', 'test']);
  assert.equal(r.ok, false);
  assert.match(texte(r, 'fr'), /✖ npm run test/);
});

test('evaluer lit l’état git réel d’un dépôt', async t => {
  const dossier = await temporaire(t);
  await initKit(dossier, { lang: 'fr' });
  try { await executer('git', ['-C', dossier, 'init', '-q'], { env: envGit }); } catch { t.skip('git indisponible'); return; }
  const r = await evaluer(dossier, { lancerTests: false });
  assert.ok(r.git.fichiersEnAttente > 5);
  assert.equal(r.git.dernierCommit, null);
});

test('partagerLecon ajoute la leçon une seule fois et ne prévient que les agents disponibles', async t => {
  const dossier = await temporaire(t);
  await initKit(dossier, { lang: 'fr' });
  const appels = [];
  const lancer = async (_b, args) => {
    appels.push(args);
    if (args[0] === 'agent' && args[1] === 'list') return JSON.stringify({ result: { agents: [
      { pane_id: 'w1:p2', name: 'codex', cwd:dossier, agent_status: 'idle' },
      { pane_id: 'w1:p3', name: 'opencode', cwd:dossier, agent_status: 'working' },
      { pane_id: 'w1:p4', name: 'agy', cwd:dossier, agent_status: 'done' },
      { pane_id: 'w1:p5; rm -rf /', name: 'piege', cwd:dossier, agent_status: 'idle' },
    ] } });
    // Écran visible : le texte déposé reste dans la zone de saisie de codex ; agy affiche autre chose (une autorisation, par exemple).
    if (args[0] === 'agent' && args[1] === 'read') return args[2] === 'w1:p2' ? '> Nouvelle leçon du chef : Une leçon utile. Relis LESSONS.md' : 'Autoriser la commande ? (o/n)';
    return '';
  };
  const r = await partagerLecon('Une leçon utile.', { dossier, lancer, attendre: async () => {} });
  assert.equal(r.ajoutee, true);
  assert.deepEqual(r.prevenus, ['codex']);
  assert.deepEqual(r.aVerifier, ['agy']);
  assert.deepEqual(r.plusTard, ['opencode']);
  const prompts = appels.filter(a => a[1] === 'prompt');
  assert.equal(prompts.length, 2);
  assert.match(prompts[0][3], /Une leçon utile\./);
  assert.equal(appels.filter(a => a[0] === 'pane' && a[2] === 'w1:p2' && a[3] === 'Enter').length, 1);
  // jamais d'Entrée sur un écran qui ne montre pas notre message (autorisation, boîte de dialogue)
  assert.equal(appels.filter(a => a[0] === 'pane' && a[2] === 'w1:p4').length, 0);
  const encore = await partagerLecon('Une leçon utile.', { dossier, lancer, attendre: async () => {} });
  assert.equal(encore.ajoutee, false);
  assert.equal((await readFile(join(dossier, 'LESSONS.md'), 'utf8')).split('Une leçon utile.').length - 1, 1);
  await assert.rejects(partagerLecon('deux\nlignes', { dossier, lancer }), /une ligne/);
});

test('partagerLecon : le dialogue de confiance Codex bloque la consigne et Entrée', async t => {
  const dossier=await temporaire(t);
  await initKit(dossier,{lang:'fr'});
  const appels=[];
  const lancer=async (_b,args)=>{
    appels.push(args);
    if(args[1]==='list')return JSON.stringify({result:{agents:[{pane_id:'w1:p2',agent:'codex',cwd:dossier,agent_status:'idle'}]}});
    if(args[1]==='read')return 'Do you trust the contents of this directory?\n1. Yes, continue\n2. No, quit\nPress enter to continue';
    throw Error('Aucun envoi attendu');
  };
  await partagerLecon('Une leçon.',{dossier,lancer,attendre:async()=>{}});
  assert.equal(appels.some(args=>args[1]==='prompt'||args[1]==='send-keys'),false);
});

test('partagerLecon : simulation sans écriture ni envoi, Herdr injoignable sans échec', async t => {
  const dossier = await temporaire(t);
  await initKit(dossier, { lang: 'fr' });
  const avant = await readFile(join(dossier, 'LESSONS.md'), 'utf8');
  const envois = [];
  const r = await partagerLecon('Simulée.', { dossier, dryRun: true, lancer: async (_b, a) => { envois.push(a); return JSON.stringify({ result: { agents: [{ pane_id: 'w1:p2', name: 'codex', cwd:dossier, agent_status: 'idle' }] } }); } });
  assert.deepEqual(r.serait, ['codex']);
  assert.deepEqual(r.prevenus, []);
  assert.equal(r.simulation, true);
  assert.equal(envois.filter(a => a[1] === 'prompt').length, 0);
  assert.equal(await readFile(join(dossier, 'LESSONS.md'), 'utf8'), avant);
  const hors = await partagerLecon('Sans Herdr.', { dossier, lancer: async () => { throw new Error('absent'); } });
  assert.equal(hors.injoignables, true);
  assert.equal(hors.ajoutee, true);
});

test('evaluer sans contrôle lancé ne dit pas « aucun défaut » mais « inventaire seulement »', async t => {
  const dossier = await temporaire(t);
  await initKit(dossier, { lang: 'fr' });
  const sans = await evaluer(dossier, { lancerTests: false });
  assert.equal(sans.controlesLances, 0);
  assert.match(texte(sans, 'fr'), /inventaire seulement, aucun contrôle lancé/);
  assert.match(texte(sans, 'en'), /inventory only, no check was run/);
  assert.doesNotMatch(texte(sans, 'fr'), /aucun défaut constaté/);
  await writeFile(join(dossier, 'package.json'), JSON.stringify({ scripts: { check: 'x' } }));
  const avec = await evaluer(dossier, { lancer: async () => true });
  assert.equal(avec.controlesLances, 1);
  assert.match(texte(avec, 'fr'), /aucun défaut constaté par les contrôles lancés/);
});


test('init-kit garde les journaux locaux et complète gitignore sans perte ni doublon',async t=>{
  const dossier=await temporaire(t);
  await writeFile(join(dossier,'.gitignore'),'custom/\n.bureau/');
  await writeFile(join(dossier,'HANDOFF.md'),'Ancien relais conservé');
  await initKit(dossier);
  const ignore=await readFile(join(dossier,'.gitignore'),'utf8');
  assert.equal(ignore,'custom/\n.bureau/\n.myteam-local/\n.env*\n*.log\n');
  assert.equal(await readFile(join(dossier,'HANDOFF.md'),'utf8'),'Ancien relais conservé');
  assert.equal(await existe(join(dossier,'JOURNAL.md')),false);
  await writeFile(join(dossier,'.myteam-local/JOURNAL.md'),'Privé');
  await initKit(dossier);
  assert.equal(await readFile(join(dossier,'.gitignore'),'utf8'),ignore);
  assert.equal(await readFile(join(dossier,'.myteam-local/JOURNAL.md'),'utf8'),'Privé');
});

test('partagerLecon refuse cwd absent, relatif, extérieur et lien sortant',async t=>{
  const dossier=await temporaire(t),exterieur=await temporaire(t);
  await mkdir(join(dossier,'src'));await symlink(exterieur,join(dossier,'sortie'),'dir');
  const chemins=[undefined,'src',exterieur,join(dossier,'sortie'),dossier,join(dossier,'src')];
  const agents=chemins.map((cwd,i)=>({pane_id:`w1:p${i}`,name:`agent${i}`,cwd,agent_status:'idle'}));
  const r=await partagerLecon('Locale.',{dossier,dryRun:true,lancer:async()=>JSON.stringify({result:{agents}})});
  assert.deepEqual(r.serait,['agent4','agent5']);
});

test('partagerLecon revalide le projet avant prompt puis avant Entrée',async t=>{
  for(const depart of ['prompt','Enter']){
    const dossier=await temporaire(t),exterieur=await temporaire(t),appels=[];let listes=0;
    const lancer=async(_b,args)=>{
      appels.push(args);
      if(args[1]==='list'){
        listes++;const parti=listes>=(depart==='prompt'?2:3);
        return JSON.stringify({result:{agents:[{pane_id:'w1:p2',name:'agent',cwd:parti?exterieur:dossier,agent_status:'idle'}]}});
      }
      if(args[1]==='read')return 'Nouvelle leçon du chef : Locale.';
      return '';
    };
    await partagerLecon('Locale.',{dossier,lancer,attendre:async()=>{}});
    assert.equal(appels.filter(a=>a[1]==='prompt').length,depart==='prompt'?0:1);
    assert.equal(appels.filter(a=>a[1]==='send-keys').length,0);
  }
});


test('init-kit refuse gitignore et les parents symboliques avant toute écriture',async t=>{
  for(const nom of ['.gitignore','scripts','docs','.myteam-local']){
    const dossier=await temporaire(t),outside=await temporaire(t);
    const cible=nom==='.gitignore'?join(outside,'ignore'):outside;
    if(nom==='.gitignore')await writeFile(cible,'Secret inchangé');
    await symlink(cible,join(dossier,nom),nom==='.gitignore'?'file':'dir');
    await assert.rejects(initKit(dossier),/Lien symbolique refusé/);
    assert.deepEqual((await readdir(dossier)),[nom]);
    if(nom==='.gitignore')assert.equal(await readFile(cible,'utf8'),'Secret inchangé');
    else assert.deepEqual(await readdir(outside),[]);
  }
});
