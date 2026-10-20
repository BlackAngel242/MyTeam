#!/usr/bin/env node
// Initialise un projet avec le kit d'équipe : fichiers piliers, plan, missions, évaluation et leçons communes.
// Jamais d'écrasement : un fichier déjà présent est conservé et signalé.
// Usage : node scripts/init-kit.mjs <dossier> [--lang fr|en] [--dry-run]
import { mkdir, readdir, copyFile, stat, lstat, constants, readFile, open } from 'node:fs/promises';
import { join, relative, dirname, resolve, sep } from 'node:path';
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
  const existant = await lstat(cible).catch(() => null);
  if(existant?.isSymbolicLink())throw new Error('Lien symbolique refusé : '+cible);
  if (existant && !existant.isDirectory()) throw new Error('La cible existe et n\u2019est pas un dossier.');
  const source = join(kitRoot, lang);
  const aCopier = [];
  for await (const chemin of fichiers(source)) {
    const nom=relative(source, chemin);
    aCopier.push({ de: chemin, vers: join(cible, ...(['JOURNAL.md','HANDOFF.md'].includes(nom)?['.myteam-local',nom]:[nom])) });
  }
  for (const nom of SCRIPTS_COPIES) aCopier.push({ de: join(scriptsRoot, nom), vers: join(cible, 'scripts', nom) });
  const resultat = { cible, crees: [], conserves: [] };
  async function verifier(chemin){
    let courant=cible;
    for(const segment of relative(cible,chemin).split(sep)){
      courant=join(courant,segment);
      const info=await lstat(courant).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      if(info?.isSymbolicLink())throw new Error('Lien symbolique refusé : '+courant);
    }
  }
  // Vérifier toutes les destinations avant la première copie, y compris gitignore.
  for(const {vers} of aCopier)await verifier(vers);
  await verifier(join(cible,'.gitignore'));
  for (const { de, vers } of aCopier) {
    const nom = relative(cible, vers).split('\\').join('/');
    await verifier(vers);
    if (await stat(vers).catch(() => null)) { resultat.conserves.push(nom); continue; }
    if (!dryRun) {
      await mkdir(dirname(vers), { recursive: true });
      await copyFile(de, vers, constants.COPYFILE_EXCL);
    }
    resultat.crees.push(nom);
  }
  const ignore=join(cible,'.gitignore'),avant=await readFile(ignore,'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
  const manquants=['.myteam-local/','.bureau/','.env*','*.log'].filter(ligne=>!avant.split(/\r?\n/).includes(ligne));
  if(manquants.length){
    if(!dryRun){await mkdir(cible,{recursive:true});await verifier(ignore);const fichier=await open(ignore,constants.O_WRONLY|constants.O_APPEND|constants.O_CREAT|constants.O_NOFOLLOW,0o600);try{await fichier.writeFile((avant&&!avant.endsWith('\n')?'\n':'')+manquants.join('\n')+'\n');}finally{await fichier.close();}}
    resultat.crees.push('.gitignore');
  }else resultat.conserves.push('.gitignore');
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
