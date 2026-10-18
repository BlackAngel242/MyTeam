#!/usr/bin/env node
// Installeur animé de MyTeam : bannière, ligne de temps et liste de tâches qui s'actualise en direct.
// Il ne contient aucune logique d'installation : il lance scripts/installer.ps1 (Windows) ou installer.sh
// avec leur mode interface, lit le protocole `@@` (docs/installeur-protocole.md) et pose les questions.
// Sans dépendance. Hors terminal ou avec --simple : sortie en texte simple, une ligne par événement.
// Usage : node scripts/installateur-anime.mjs [--lang fr|en] [--dry-run] [--simple] [--port <n>] [--demo]
// --demo : démonstration de l'animation, sans rien installer ni réseau.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const BANNIERE = [
  ['██   ██ ██    ██ ████████ ███████  █████  ██   ██', 250],
  ['███ ███  ██  ██     ██    ██      ██   ██ ███ ███', 247],
  ['██ █ ██   ████      ██    █████   ███████ ██ █ ██', 244],
  ['██   ██    ██       ██    ██      ██   ██ ██   ██', 241],
  ['██   ██    ██       ██    ███████ ██   ██ ██   ██', 238],
];
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// --- protocole -----------------------------------------------------------------------------
export function parseLigne(ligne) {
  // Les textes viennent d'un autre programme : aucun caractère de contrôle (séquences ANSI comprises) ne doit atteindre le terminal.
  const propre = String(ligne).replace(/\r$/, '').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '');
  const m = /^@@([A-Z]+)(?: (.*))?$/.exec(propre);
  if (!m) return null;
  const champs = (m[2] ?? '').split('\t');
  switch (m[1]) {
    case 'PLAN': return champs.length >= 2 ? { type: 'plan', id: champs[0], libelle: champs.slice(1).join(' ') } : null;
    case 'STEP': return { type: 'step', id: champs[0] };
    case 'INFO': return { type: 'info', texte: m[2] ?? '' };
    case 'CONFIRM': return champs.length >= 2 ? { type: 'confirm', id: champs[0], question: champs.slice(1).join(' ') } : null;
    case 'CHOICE': return champs.length >= 3 ? { type: 'choice', id: champs[0], question: champs[1], options: champs.slice(2) } : null;
    case 'INPUT': return champs.length >= 2 ? { type: 'input', id: champs[0], question: champs[1], defaut: champs[2] ?? '' } : null;
    case 'DONE': return champs.length >= 2 && ['ok', 'skip', 'fail'].includes(champs[1]) ? { type: 'done', id: champs[0], etat: champs[1], texte: champs.slice(2).join(' ') } : null;
    case 'END': return { type: 'end', ok: (champs[0] ?? 'ok') === 'ok' };
    default: return null;
  }
}

// --- dessin (fonctions pures, testées) ---------------------------------------------------
const nettoyer = s => String(s).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
export function ajuster(texte, largeur) {
  let visible = 0, sortie = '';
  for (let i = 0; i < texte.length; i++) {
    if (texte[i] === '\x1b') { const fin = /^\x1b\[[0-9;?]*[A-Za-z]/.exec(texte.slice(i)); if (fin) { sortie += fin[0]; i += fin[0].length - 1; continue; } }
    if (visible >= largeur) { sortie += '…' + (texte.includes('[') ? '[0m' : ''); break; }
    sortie += texte[i]; visible++;
  }
  return sortie;
}

export function peindre(couleur) {
  const c = (code, s) => couleur ? `\x1b[${code}m${s}\x1b[0m` : s;
  return {
    gris: s => c('90', s), menthe: s => c('32', s), cyan: s => c('36', s), ambre: s => c('33', s), rouge: s => c('31', s), gras: s => c('1', s),
    degrade: (s, n) => couleur ? `\x1b[38;5;${n}m${s}\x1b[0m` : s,
    fond: s => couleur ? `\x1b[46;30m ${s} \x1b[0m` : `[${s}]`,
  };
}

export function bannière(couleur) {
  const p = peindre(couleur);
  return BANNIERE.map(([ligne, n]) => '  ' + p.degrade(ligne, n));
}

export function cadre(etat, image, { couleur = true, largeur = 100 } = {}) {
  const p = peindre(couleur), L = [];
  const fr = etat.lang !== 'en';
  L.push(p.gris('│'));
  L.push(p.cyan('◆') + '  ' + p.gras(fr ? 'Installation de MyTeam' : 'Installing MyTeam') + (etat.simulation ? p.ambre(fr ? '  (simulation, rien n’est installé)' : '  (dry run, nothing is installed)') : ''));
  for (const t of etat.taches) {
    const pastille = t.etat === 'ok' ? p.menthe('✔') : t.etat === 'fail' ? p.rouge('✖') : t.etat === 'skip' ? p.gris('–')
      : t.etat === 'run' ? p.cyan(SPINNER[image % SPINNER.length]) : p.gris('○');
    const libelle = t.etat === 'pending' || t.etat === 'skip' ? p.gris(t.libelle) : t.etat === 'run' ? p.gras(t.libelle) : t.libelle;
    L.push(p.gris('│') + '   ' + pastille + ' ' + libelle + (t.texte ? p.gris('  ' + t.texte) : ''));
  }
  if (etat.info) L.push(p.gris('│') + '   ' + p.gris(etat.info));
  if (etat.question) {
    L.push(p.gris('│'));
    L.push(p.ambre('◆') + '  ' + p.gras(etat.question.texte));
    for (const o of etat.question.lignes ?? []) L.push(p.gris('│') + '   ' + o);
    L.push(p.gris('│') + '   ' + p.cyan(etat.question.invite));
  }
  if (etat.fin) L.push(p.gris('│'), (etat.fin.ok ? p.menthe('◇') : p.rouge('◇')) + '  ' + bilanFin(etat));
  return L.map(l => ajuster(l, largeur - 1));
}

// --- état -------------------------------------------------------------------------------------
export function etatInitial({ lang = 'fr', simulation = false, demo = false } = {}) { return { lang, simulation, demo, taches: [], info: '', question: null, fin: null }; }
// Bilan final : une démonstration ou une simulation ne prétend jamais avoir installé quoi que ce soit.
export function bilanFin(etat) {
  const fr = etat.lang !== 'en';
  if (!etat.fin?.ok) return fr ? 'Installation arrêtée : voir le message ci-dessus.' : 'Installation stopped: see the message above.';
  if (etat.demo) return fr ? 'Démonstration terminée : rien n’a été installé ni modifié.' : 'Demo finished: nothing was installed or changed.';
  if (etat.simulation) return fr ? 'Simulation terminée : rien n’a été installé ni modifié.' : 'Dry run finished: nothing was installed or changed.';
  return fr ? 'Installation terminée.' : 'Installation finished.';
}
export function appliquer(etat, evt) {
  const tache = id => etat.taches.find(t => t.id === id);
  switch (evt.type) {
    case 'plan': if (!tache(evt.id)) etat.taches.push({ id: evt.id, libelle: evt.libelle, etat: 'pending', texte: '' }); break;
    case 'step': { const t = tache(evt.id); if (t) t.etat = 'run'; etat.info = ''; break; }
    case 'info': etat.info = evt.texte; break;
    case 'done': { const t = tache(evt.id); if (t) { t.etat = evt.etat; t.texte = evt.texte; } etat.info = ''; break; }
    case 'end': etat.fin = { ok: evt.ok }; etat.info = ''; break;
    default: break;
  }
  return etat;
}

// --- sorties ------------------------------------------------------------------------------------
function sortieAnimee(flux, couleur) {
  let hauteur = 0, image = 0, etat = null;
  const largeur = () => flux.columns || 100;
  const dessiner = () => {
    const lignes = cadre(etat, image, { couleur, largeur: largeur() });
    let s = hauteur ? `\x1b[${hauteur}A\r` : '';
    for (const l of lignes) s += '\x1b[2K' + l + '\n';
    s += '\x1b[J';
    flux.write(s);
    hauteur = lignes.length;
  };
  let minuteur = null;
  return {
    // Bannière révélée ligne par ligne (dégradé du clair au sombre), pastille du nom, puis la liste de tâches.
    async demarrer(e, { revelation = 70 } = {}) {
      etat = e; flux.write('\x1b[?25l\n');
      for (const l of bannière(couleur)) { flux.write(l + '\n'); if (revelation) await new Promise(r => setTimeout(r, revelation)); }
      flux.write('\n  ' + peindre(couleur).fond('myteam') + '\n');
      dessiner(); minuteur = setInterval(() => { image++; dessiner(); }, 90); minuteur.unref?.();
    },
    maj() { dessiner(); },
    arreter() { clearInterval(minuteur); if (etat) dessiner(); flux.write('\x1b[?25h'); },
  };
}
function sortieSimple(flux) {
  const dit = t => flux.write(t + '\n');
  return {
    demarrer(e) { dit(e.lang === 'en' ? 'MyTeam installation' : 'Installation de MyTeam'); },
    maj() {},
    evenement(evt, etat) {
      if (evt.type === 'plan') return;
      const t = etat.taches.find(x => x.id === evt.id);
      if (evt.type === 'step' && t) dit(`… ${t.libelle}`);
      else if (evt.type === 'done' && t) dit(`${evt.etat === 'ok' ? '✔' : evt.etat === 'skip' ? '–' : '✖'} ${t.libelle}${evt.texte ? ' : ' + evt.texte : ''}`);
      else if (evt.type === 'info') dit(`  ${evt.texte}`);
    },
    arreter() {},
  };
}

// --- questions ------------------------------------------------------------------------------------
function questionsClavier(entree, etat, rafraichir, lang) {
  const fr = lang !== 'en';
  const touche = (acceptes) => new Promise(resolve => {
    const surDonnees = buf => {
      const s = buf.toString('utf8');
      if (s === '\u0003') { entree.removeListener('data', surDonnees); process.kill(process.pid, 'SIGINT'); return; }
      let t;
      for (const ch of s) { t = acceptes(ch); if (t !== undefined) break; }
      if (t !== undefined) { entree.removeListener('data', surDonnees); resolve(t); }
    };
    entree.on('data', surDonnees);
  });
  return {
    async confirm(texte) {
      etat.question = { texte, invite: fr ? 'o = oui · n ou Entrée = non' : 'y = yes · n or Enter = no' };
      rafraichir();
      const oui = await touche(s => (/^[oOyY]$/.test(s) ? true : /^[nN\r\n]$/.test(s) ? false : undefined));
      etat.question = null; rafraichir();
      return oui;
    },
    async choice(texte, options) {
      etat.question = { texte, lignes: options.map((o, i) => `${i + 1}. ${o}`), invite: fr ? `Tapez un numéro (1 à ${options.length})` : `Type a number (1 to ${options.length})` };
      rafraichir();
      const n = await touche(s => (/^[1-9]$/.test(s) && Number(s) <= options.length ? Number(s) : undefined));
      etat.question = null; rafraichir();
      return n;
    },
    async input(texte, defaut) {
      etat.question = { texte, invite: (fr ? 'Saisie puis Entrée' : 'Type then Enter') + (defaut ? ` [${defaut}]` : '') };
      rafraichir();
      let tampon = '';
      const v = await new Promise(resolve => {
        const surDonnees = buf => {
          for (const ch of buf.toString('utf8')) {
            if (ch === '\r' || ch === '\n') { entree.removeListener('data', surDonnees); resolve(tampon); return; }
            if (ch === '\u007f' || ch === '\b') tampon = tampon.slice(0, -1); else if (ch >= ' ') tampon += ch;
            etat.question.invite = (fr ? 'Saisie : ' : 'Input: ') + tampon;
            rafraichir();
          }
        };
        entree.on('data', surDonnees);
      });
      etat.question = null; rafraichir();
      return v || defaut;
    },
  };
}
function questionsTexte(sortie, lecteurLignes, lang) {
  const fr = lang !== 'en';
  const lire = async () => { const { value, done } = await lecteurLignes.next(); return done ? null : String(value).trim(); };
  return {
    // Fin de l'entrée (null) = aucune réponse : l'appelant ferme l'entrée de l'installeur, qui la traite comme un refus.
    // Jamais de réponse synthétique (ni « n » prétendu saisi, ni valeur par défaut) à la place de la personne.
    async confirm(texte) { sortie.write(`? ${texte} ${fr ? '(o/n)' : '(y/n)'} : `); const r = await lire(); sortie.write((r ?? '') + '\n'); return r === null ? null : /^(o|oui|y|yes)$/i.test(r); },
    async choice(texte, options) { sortie.write(`? ${texte}\n${options.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}\n> `); const r = await lire(); sortie.write((r ?? '') + '\n'); if (r === null) return null; const n = Number(r); return Number.isInteger(n) && n >= 1 && n <= options.length ? n : 1; },
    async input(texte, defaut) { sortie.write(`? ${texte}${defaut ? ` [${defaut}]` : ''} : `); const r = await lire(); sortie.write((r ?? '') + '\n'); return r === null ? null : (r || defaut); },
  };
}

// --- exécution -------------------------------------------------------------------------------------
// Démonstration sans rien installer ni réseau : un faux installeur qui parle le même protocole.
const DEMO = `
const dort = ms => new Promise(r => setTimeout(r, ms));
const lignes = (await import('node:readline')).createInterface({ input: process.stdin })[Symbol.asyncIterator]();
const lire = async () => { const { value, done } = await lignes.next(); return done ? 'n' : value; };
const fr = process.argv[1] !== 'en';
const T = fr
  ? [['node','Node.js 22 ou plus'],['herdr','Herdr, gestionnaire de terminaux'],['panneaux','Espace Herdr en grille 2×2'],['outils','Outils d’IA détectés'],['chef','Chef : commandes et intégrations'],['extensions','Extensions utiles'],['config','Configuration et raccourci'],['kit','Kit d’équipe'],['tests','Vérification finale']]
  : [['node','Node.js 22 or later'],['herdr','Herdr, terminal manager'],['panneaux','Herdr 2×2 workspace'],['outils','Detected AI tools'],['chef','Lead: commands and integrations'],['extensions','Useful extensions'],['config','Configuration and shortcut'],['kit','Team kit'],['tests','Final check']];
for (const [id, l] of T) console.log('@@PLAN ' + id + String.fromCharCode(9) + l);
for (const [id, l] of T) {
  console.log('@@STEP ' + id);
  for (const m of fr ? ['Recherche…','Vérification…','Terminé'] : ['Looking…','Checking…','Done']) { console.log('@@INFO ' + m); await dort(450); }
  if (id === 'herdr') {
    console.log('@@CONFIRM herdr' + String.fromCharCode(9) + (fr ? 'Démo : installer Herdr ? (rien ne sera installé)' : 'Demo: install Herdr? (nothing will be installed)'));
    const r = await lire();
    console.log('@@DONE herdr' + String.fromCharCode(9) + (r === 'o' ? 'ok' : 'skip') + String.fromCharCode(9) + (r === 'o' ? '' : (fr ? 'refusé' : 'declined')));
    continue;
  }
  console.log('@@DONE ' + id + String.fromCharCode(9) + 'ok' + String.fromCharCode(9));
}
console.log('@@END ok');
`;

export function commandeInstalleur({ plateforme = process.platform, lang = 'fr', simulation = false, port = null, racineProjet = racine, demo = false } = {}) {
  if (demo) return { commande: process.execPath, args: ['--input-type=module', '-e', DEMO, lang] };
  if (plateforme === 'win32') {
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(racineProjet, 'scripts', 'installer.ps1'), '-Interface', '-Lang', lang];
    if (simulation) args.push('-DryRun');
    if (port) args.push('-Port', String(port));
    return { commande: 'powershell.exe', args };
  }
  const args = [join(racineProjet, 'scripts', 'installer.sh'), '--interface', '--lang', lang];
  if (simulation) args.push('--dry-run');
  if (port) args.push('--port', String(port));
  return { commande: 'bash', args };
}

export async function executer({ commande, args, sortie = process.stdout, entree = process.stdin, anime = false, couleur = false, lang = 'fr', simulation = false, demo = false, lancer = spawn } = {}) {
  const etat = etatInitial({ lang, simulation, demo });
  const enfant = lancer(commande, args, { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: false });
  let rendu, questions, lecteurEntree = null;
  if (anime) {
    rendu = sortieAnimee(sortie, couleur);
    questions = questionsClavier(entree, etat, () => rendu.maj(), lang);
    if (entree.isTTY) entree.setRawMode(true);
    entree.resume();
  } else {
    rendu = sortieSimple(sortie);
    lecteurEntree = createInterface({ input: entree, crlfDelay: Infinity })[Symbol.asyncIterator]();
    questions = questionsTexte(sortie, lecteurEntree, lang);
  }
  await rendu.demarrer(etat);
  enfant.stdin.on('error', () => {});
  const repondre = texte => { try { enfant.stdin.write(texte + '\n'); } catch { /* l'installeur est déjà fini */ } };
  let fin = null;
  const lignes = createInterface({ input: enfant.stdout, crlfDelay: Infinity });
  const code = new Promise(resolve => enfant.on('close', c => resolve(c ?? 1)));
  const lignesFermees = new Promise(resolve => lignes.once('close', resolve));
  let fileAttente = Promise.resolve();
  lignes.on('line', ligne => {
    fileAttente = fileAttente.then(async () => {
      const evt = parseLigne(ligne);
      if (!evt) return;
      appliquer(etat, evt);
      if (['confirm', 'choice', 'input'].includes(evt.type)) {
        const reponse = evt.type === 'confirm' ? await questions.confirm(evt.question) : evt.type === 'choice' ? await questions.choice(evt.question, evt.options) : await questions.input(evt.question, evt.defaut);
        if (reponse === null) { try { enfant.stdin.end(); } catch { /* déjà fermé */ } }
        else repondre(evt.type === 'confirm' ? (reponse ? 'o' : 'n') : String(reponse));
      }
      else { rendu.evenement?.(evt, etat); rendu.maj(); }
      if (evt.type === 'end') { fin = evt; try { enfant.stdin.end(); } catch { /* déjà fermé */ } }
    });
  });
  const sortieCode = await code;
  await lignesFermees;
  await fileAttente;
  if (!etat.fin) etat.fin = { ok: sortieCode === 0 };
  rendu.arreter();
  if (anime && entree.isTTY) entree.setRawMode(false);
  if (!anime) { lecteurEntree?.return?.(); sortie.write(bilanFin(etat) + '\n'); }
  entree.pause?.();
  return { code: sortieCode, ok: etat.fin.ok && sortieCode === 0, etat, fin };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = nom => { const i = args.indexOf(nom); return i === -1 ? null : args[i + 1]; };
  const lang = option('--lang') ?? ((process.env.LANG ?? process.env.LANGUAGE ?? Intl.DateTimeFormat().resolvedOptions().locale ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en');
  const anime = Boolean(process.stdout.isTTY && process.stdin.isTTY) && !args.includes('--simple');
  const { commande, args: argsInstalleur } = commandeInstalleur({ lang, simulation: args.includes('--dry-run'), port: option('--port'), demo: args.includes('--demo') });
  const r = await executer({ commande, args: argsInstalleur, anime, couleur: anime && !process.env.NO_COLOR, lang, simulation: args.includes('--dry-run'), demo: args.includes('--demo') });
  process.exit(r.ok ? 0 : (r.code || 1));
}
