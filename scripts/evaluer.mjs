#!/usr/bin/env node
// Auto-évaluation d'un projet : uniquement des faits vérifiables (fichiers, git, cases cochées, tests lancés).
// Aucun score inventé. Code de sortie 1 si un fichier pilier manque ou si un contrôle lancé échoue.
// Usage : node scripts/evaluer.mjs [dossier] [--lang fr|en] [--json] [--sans-tests]
import { readFile, stat } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const executer = promisify(execFile);
// Un crochet Git exporte GIT_INDEX_FILE et d'autres variables GIT_* : sans les retirer, `git -C <dossier>` lirait le mauvais dépôt.
const envGit = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !cle.startsWith('GIT_')));
const PILIERS = ['AGENTS.md', 'LESSONS.md', '.myteam-local/HANDOFF.md', 'TODO.md', '.myteam-local/JOURNAL.md'];
const PLANS = ['TODO.md', join('docs', 'plan-travail.md')];
const JOURS = 24 * 3600 * 1000;

async function lire(chemin) { return readFile(chemin, 'utf8').catch(() => null); }

function cases(texte) {
  let fait = 0, total = 0, fence = false;
  for (const ligne of (texte ?? '').split(/\r?\n/)) {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(ligne)) { fence = !fence; continue; }
    if (fence) continue;
    const m = /^\s*-\s+\[([ xX])\]\s+\S/.exec(ligne);
    if (m) { total++; if (m[1] !== ' ') fait++; }
  }
  return { fait, total };
}

async function git(dossier, args) {
  try { return (await executer('git', ['-C', dossier, ...args], { windowsHide: true, timeout: 30000, env: envGit })).stdout.trim(); }
  catch { return null; }
}

// Commande constante (aucune valeur extérieure) : le shell sert seulement à retrouver npm sous Windows.
function npm(dossier, script) {
  return new Promise(fini => {
    const enfant = spawn(`npm run --silent ${script}`, { cwd: dossier, shell: true, windowsHide: true, stdio: 'ignore' });
    const minuteur = setTimeout(() => enfant.kill(), 15 * 60 * 1000);
    enfant.on('exit', code => { clearTimeout(minuteur); fini(code === 0); });
    enfant.on('error', () => { clearTimeout(minuteur); fini(false); });
  });
}

export async function evaluer(dossier, { lancerTests = true, lancer = npm, maintenant = Date.now() } = {}) {
  dossier = resolve(dossier);
  const rapport = { dossier, piliers: { presents: [], manquants: [] }, git: null, plan: { fait: 0, total: 0, pourcent: null, sources: [] }, lecons: { total: 0, ajoutees7j: null }, anciens: [], controles: [] };
  for (const nom of PILIERS) (await stat(join(dossier, nom)).catch(() => null) ? rapport.piliers.presents : rapport.piliers.manquants).push(nom);
  const estGit = await git(dossier, ['rev-parse', '--is-inside-work-tree']);
  if (estGit === 'true') {
    const modifies = (await git(dossier, ['status', '--short'])) ?? '';
    const dernier = await git(dossier, ['log', '-1', '--format=%cI']);
    rapport.git = { fichiersEnAttente: modifies ? modifies.split('\n').length : 0, dernierCommit: dernier || null };
    const recents = await git(dossier, ['log', '--since=7.days', '--format=%h', '--', 'LESSONS.md']);
    rapport.lecons.ajoutees7j = recents ? recents.split('\n').length : 0;
    if (dernier) {
      for (const nom of ['.myteam-local/HANDOFF.md', '.myteam-local/JOURNAL.md']) {
        const info = await stat(join(dossier, nom)).catch(() => null);
        if (info && Date.parse(dernier) - info.mtimeMs > 3 * JOURS) rapport.anciens.push(nom);
      }
    }
  }
  for (const source of PLANS) {
    const c = cases(await lire(join(dossier, source)));
    if (c.total) { rapport.plan.sources.push({ source: source.split('\\').join('/'), ...c }); rapport.plan.fait += c.fait; rapport.plan.total += c.total; }
  }
  if (rapport.plan.total) rapport.plan.pourcent = Math.round(rapport.plan.fait / rapport.plan.total * 100);
  rapport.lecons.total = ((await lire(join(dossier, 'LESSONS.md'))) ?? '').split(/\r?\n/).filter(l => /^-\s+\S/.test(l)).length;
  const paquet = JSON.parse((await lire(join(dossier, 'package.json'))) ?? '{}');
  if (lancerTests) for (const script of ['check', 'test']) if (paquet.scripts?.[script]) rapport.controles.push({ nom: `npm run ${script}`, reussi: await lancer(dossier, script) });
  rapport.controlesLances = rapport.controles.length;
  rapport.ok = rapport.piliers.manquants.length === 0 && rapport.controles.every(c => c.reussi);
  return rapport;
}

export function texte(r, lang = 'fr') {
  const fr = lang === 'fr', l = [];
  l.push(fr ? `Auto-évaluation de ${r.dossier}` : `Self-evaluation of ${r.dossier}`);
  l.push(fr ? `Fichiers piliers : ${r.piliers.presents.length}/${r.piliers.presents.length + r.piliers.manquants.length}` + (r.piliers.manquants.length ? ` (manquants : ${r.piliers.manquants.join(', ')})` : '')
    : `Pillar files: ${r.piliers.presents.length}/${r.piliers.presents.length + r.piliers.manquants.length}` + (r.piliers.manquants.length ? ` (missing: ${r.piliers.manquants.join(', ')})` : ''));
  l.push(r.plan.total ? (fr ? `Plan : ${r.plan.fait}/${r.plan.total} cases cochées, ${r.plan.pourcent} %` : `Plan: ${r.plan.fait}/${r.plan.total} boxes checked, ${r.plan.pourcent}%`)
    : (fr ? 'Plan : aucune case à cocher trouvée' : 'Plan: no checkbox found'));
  l.push(fr ? `Leçons : ${r.lecons.total}` + (r.lecons.ajoutees7j == null ? '' : `, ${r.lecons.ajoutees7j} commit(s) sur LESSONS.md ces 7 jours`)
    : `Lessons: ${r.lecons.total}` + (r.lecons.ajoutees7j == null ? '' : `, ${r.lecons.ajoutees7j} commit(s) touching LESSONS.md in the last 7 days`));
  if (r.git) l.push(fr ? `Git : ${r.git.fichiersEnAttente} fichier(s) en attente, dernier commit ${r.git.dernierCommit ?? 'aucun'}` : `Git: ${r.git.fichiersEnAttente} pending file(s), last commit ${r.git.dernierCommit ?? 'none'}`);
  else l.push(fr ? 'Git : dossier hors dépôt' : 'Git: not a repository');
  for (const nom of r.anciens) l.push(fr ? `À mettre à jour : ${nom} (plus de 3 jours de retard sur le dernier commit)` : `Update needed: ${nom} (more than 3 days behind the last commit)`);
  for (const c of r.controles) l.push(`${c.reussi ? '✔' : '✖'} ${c.nom}`);
  if (!r.ok) l.push(fr ? 'Bilan : défauts à corriger avant de déclarer terminé.' : 'Result: defects to fix before calling it done.');
  else if (!r.controlesLances) l.push(fr ? 'Bilan : inventaire seulement, aucun contrôle lancé (tests non exécutés) : cela ne dit rien de la qualité du travail.' : 'Result: inventory only, no check was run (tests not executed): this says nothing about the quality of the work.');
  else l.push(fr ? 'Bilan : aucun défaut constaté par les contrôles lancés ci-dessus.' : 'Result: no defect found by the checks run above.');
  return l.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--lang');
  const lang = i !== -1 ? args[i + 1] : ((process.env.LANG ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en');
  const dossier = args.find((a, k) => !a.startsWith('--') && args[k - 1] !== '--lang') ?? '.';
  const r = await evaluer(dossier, { lancerTests: !args.includes('--sans-tests') });
  console.log(args.includes('--json') ? JSON.stringify(r, null, 2) : texte(r, lang));
  process.exit(r.ok ? 0 : 1);
}
