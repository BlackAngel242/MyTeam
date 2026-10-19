// Rapport de fin de tâche pré-rempli (N9), d'après le protocole de l'équipe.
//
// Usage : node scripts/rapport-tache.mjs <id-tâche> [options]
//   --agent <nom>          nom de l'agent (défaut : OpenCode)
//   --resume <texte>       résumé en trois lignes
//   --tests <texte>        ce que les tests donnent
//   --non-verifie <texte>  ce qui n'a pas pu être vérifié
//   --depot <dossier>      dépôt à inspecter (défaut : le dossier courant)
//
// Le script sait tout seul l'identifiant, la branche et le hash des commits
// qui portent l'identifiant. Il n'invente jamais : ce qu'il ne sait pas reste
// marqué « à compléter ». Aucun chemin ni aucune clé dans la sortie.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const executer = promisify(execFile);
// Le crochet de commit exporte GIT_* vers tout ce qu'il lance : sans les
// retirer, git lit le mauvais index (leçon du 18 octobre).
const envGit = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !cle.startsWith('GIT_')));

const A_COMPLETER = 'à compléter';
// Un champ fourni garde sa ponctuation : jamais deux points à la suite.
const ponctue = texte => {
  const propre = String(texte).trim();
  return /[.!?]$/.test(propre) ? propre : `${propre}.`;
};

export async function rapportTache(id, { depot = '.', agent = 'OpenCode', resume = null, tests = null, nonVerifie = null, git = null } = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('Identifiant de tâche attendu (par exemple N9).');
  const identifiant = id.trim().slice(0, 40);
  const nom = typeof agent === 'string' && agent.trim() ? agent.trim().slice(0, 40) : 'OpenCode';
  const appelGit = git ?? (async (...args) => {
    const { stdout } = await executer('git', ['-C', depot, ...args], { windowsHide: true, timeout: 30000, env: envGit });
    return stdout.trim();
  });

  let branche = null;
  try { branche = (await appelGit('branch', '--show-current')) || null; } catch { branche = null; }

  // Les commits de la tâche : ceux dont le message porte l'identifiant.
  // Jamais de hash deviné : sans résultat, la ligne dit qu'il n'y en a pas.
  let commits = [];
  try {
    const sortie = await appelGit('log', '-n', '3', `--grep=${identifiant}`, '--format=%h%x09%s');
    commits = sortie
      ? sortie.split(/\r?\n/).map(ligne => ligne.trim()).filter(Boolean).map(ligne => {
          const [hash, ...reste] = ligne.split('\t');
          const titre = reste.join(' ').trim();
          return titre ? `${hash} (${titre})` : hash;
        })
      : [];
  } catch { commits = []; }

  return [
    `Rapport de fin de tâche ${identifiant} (${nom}).`,
    `Branche : ${branche ?? A_COMPLETER}.`,
    `Hash : ${commits.length ? commits.join(' ; ') : `aucun commit trouvé pour ${identifiant}`}.`,
    `Résumé : ${resume === null ? `${A_COMPLETER} (trois lignes).` : ponctue(resume)}`,
    `Tests : ${tests === null ? `${A_COMPLETER}.` : ponctue(tests)}`,
    `Non vérifié : ${nonVerifie === null ? `${A_COMPLETER}.` : ponctue(nonVerifie)}`,
  ].join('\n');
}

// Ligne de commande : <id> [--agent n] [--resume t] [--tests t] [--non-verifie t] [--depot d]
if (process.argv[1] && process.argv[1].endsWith('rapport-tache.mjs')) {
  const [id, ...reste] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < reste.length; i += 2) {
    const cle = reste[i], valeur = reste[i + 1];
    if (valeur === undefined) continue;
    if (cle === '--agent') options.agent = valeur;
    if (cle === '--resume') options.resume = valeur;
    if (cle === '--tests') options.tests = valeur;
    if (cle === '--non-verifie') options.nonVerifie = valeur;
    if (cle === '--depot') options.depot = valeur;
  }
  rapportTache(id, options)
    .then(texte => { console.log(texte); })
    .catch(erreur => { console.error(erreur.message); process.exitCode = 1; });
}
