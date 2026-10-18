#!/usr/bin/env node
// Branche de travail d'un agent : un dossier de travail à part (git worktree) sur une branche nommée,
// pour que deux agents ne se marchent jamais dessus dans le dossier partagé.
// ATTENTION : les worktrees sont interdits sans l'accord explicite de DrSmoke (--worktree-autorise).
// Usage : node scripts/branche-agent.mjs <agent> <tache> --worktree-autorise [--base main] [--sortie <dossier>]
// Crée la branche agent/<agent>/<tache> depuis la base et affiche le dossier où travailler.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const executer = promisify(execFile);
// Un hook de commit exporte GIT_INDEX_FILE et d'autres variables GIT_* : sans les retirer, git lirait le mauvais index.
const env = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !cle.startsWith('GIT_')));
const git = async (depot, args) => (await executer('git', ['-C', depot, ...args], { windowsHide: true, env })).stdout.trim();

export async function brancheAgent(agent, tache, { depot = '.', base = 'main', sortie, worktreeAutorise = false } = {}) {
  if (worktreeAutorise !== true) throw new Error('Les worktrees sont interdits (règle de DrSmoke). Travaille sur main avec des commits ciblés ; relance avec --worktree-autorise seulement après son accord explicite.');
  if (!/^[a-z0-9][a-z0-9-]{1,19}$/.test(String(agent))) throw new Error('Nom d’agent invalide : 2 à 20 caractères, minuscules, chiffres et tirets.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/.test(String(tache))) throw new Error('Identifiant de tâche invalide : 30 caractères au plus, lettres, chiffres, point, tiret.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,60}$/.test(String(base))) throw new Error('Base invalide.');
  const racine = await git(depot, ['rev-parse', '--show-toplevel']);
  const branche = `agent/${agent}/${tache}`;
  const existe = await git(racine, ['branch', '--list', branche]);
  if (existe) throw new Error(`La branche ${branche} existe déjà : reprends-la (git worktree list) ou choisis un autre identifiant.`);
  const dossier = resolve(sortie ?? join(dirname(racine), `${basename(racine)}-agents`, `${agent}-${tache}`));
  await git(racine, ['worktree', 'add', '-b', branche, dossier, base]);
  const sommet = await git(racine, ['rev-parse', '--short', base]);
  return { branche, dossier, base, depart: sommet };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = nom => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined; };
  const [agent, tache] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
  try {
    const r = await brancheAgent(agent, tache, { base: option('--base') ?? 'main', sortie: option('--sortie'), worktreeAutorise: args.includes('--worktree-autorise') });
    console.log(`Branche ${r.branche} créée depuis ${r.base} (${r.depart}).\nTravaille dans : ${r.dossier}\nÀ la fin : commit ciblé, puis compte rendu au chef avec la branche, le hash et l'identifiant de tâche.`);
  } catch (erreur) {
    console.error(erreur.message);
    process.exit(1);
  }
}
