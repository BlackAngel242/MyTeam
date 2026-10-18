#!/usr/bin/env node
// Initialise un projet avec le kit d'équipe : fichiers piliers, plan, missions, évaluation et leçons communes.
// Jamais d'écrasement : un fichier déjà présent est conservé et signalé.
// Usage : node scripts/init-kit.mjs <dossier> [--lang fr|en] [--dry-run]
import { mkdir, readdir, copyFile, stat, constants } from 'node:fs/promises';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const racine = fileURLToPath(new URL('../', import.meta.url));
const SCRIPTS_COPIES = ['evaluer.mjs', 'partager-lecons.mjs'];

async function* fichiers(dossier) {
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) yield* fichiers(chemin);
    else if (entree.isFile()) yield chemin;
  }
}

export async function initKit(cible, { lang = 'fr', dryRun = false, kitRoot = join(racine, 'kit'), scriptsRoot = join(racine, 'scripts') } = {}) {
  if (!['fr', 'en'].includes(lang)) throw new Error('Langue inconnue : fr ou en.');
  if (typeof cible !== 'string' || !cible.trim()) throw new Error('Indiquez le dossier du projet à initialiser.');
  cible = resolve(cible);
  const existant = await stat(cible).catch(() => null);
  if (existant && !existant.isDirectory()) throw new Error('La cible existe et n\u2019est pas un dossier.');
  const source = join(kitRoot, lang);
  const aCopier = [];
  for await (const chemin of fichiers(source)) aCopier.push({ de: chemin, vers: join(cible, relative(source, chemin)) });
  for (const nom of SCRIPTS_COPIES) aCopier.push({ de: join(scriptsRoot, nom), vers: join(cible, 'scripts', nom) });
  const resultat = { cible, crees: [], conserves: [] };
  for (const { de, vers } of aCopier) {
    const nom = relative(cible, vers).split('\\').join('/');
    if (await stat(vers).catch(() => null)) { resultat.conserves.push(nom); continue; }
    if (!dryRun) {
      await mkdir(dirname(vers), { recursive: true });
      await copyFile(de, vers, constants.COPYFILE_EXCL);
    }
    resultat.crees.push(nom);
  }
  return resultat;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = nom => { const i = args.indexOf(nom); return i === -1 ? null : args[i + 1]; };
  const lang = option('--lang') ?? ((process.env.LANG ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en');
  const cible = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--lang');
  try {
    const r = await initKit(cible, { lang, dryRun: args.includes('--dry-run') });
    const fr = lang === 'fr';
    console.log((args.includes('--dry-run') ? (fr ? 'Simulation : ' : 'Dry run: ') : '') + (fr ? 'kit d\u2019équipe pour ' : 'team kit for ') + r.cible);
    for (const n of r.crees) console.log((fr ? '  créé      ' : '  created   ') + n);
    for (const n of r.conserves) console.log((fr ? '  conservé  ' : '  kept      ') + n);
    console.log(fr ? 'Ensuite : lisez AGENTS.md, puis lancez « node scripts/evaluer.mjs ».' : 'Next: read AGENTS.md, then run "node scripts/evaluer.mjs".');
  } catch (erreur) {
    console.error(erreur.message);
    process.exit(1);
  }
}
