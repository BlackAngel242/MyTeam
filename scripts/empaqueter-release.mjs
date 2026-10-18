#!/usr/bin/env node
// Archive zip d'une release : les fichiers suivis par Git à la révision donnée (jamais le dossier de travail),
// dans un dossier racine MyTeam-<version>/. Les fichiers marqués export-ignore dans .gitattributes restent dehors.
// Usage : node scripts/empaqueter-release.mjs <version> [--rev HEAD] [--sortie dist]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const executer = promisify(execFile);
// Un crochet Git exporte GIT_INDEX_FILE et d'autres variables GIT_* : sans les retirer, `git -C <dépôt>` lirait le mauvais index.
const envGit = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !cle.startsWith('GIT_')));
const racine = fileURLToPath(new URL('../', import.meta.url));

export async function empaqueter(version, { rev = 'HEAD', sortie = 'dist', depot = racine } = {}) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? '')) throw new Error('Version attendue : 1.2.3');
  if (!/^[0-9A-Za-z._\/-]{1,100}$/.test(rev)) throw new Error('Révision invalide.');
  const dossier = resolve(depot, sortie);
  await mkdir(dossier, { recursive: true });
  const fichier = join(dossier, `MyTeam-${version}.zip`);
  await executer('git', ['-C', depot, 'archive', '--format=zip', `--prefix=MyTeam-${version}/`, '-o', fichier, rev], { windowsHide: true, env: envGit });
  const sha = createHash('sha256').update(await readFile(fichier)).digest('hex');
  return { fichier, sha256: sha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = nom => { const i = args.indexOf(nom); return i === -1 ? null : args[i + 1]; };
  try {
    const r = await empaqueter(args[0], { rev: option('--rev') ?? 'HEAD', sortie: option('--sortie') ?? 'dist' });
    console.log(`${r.fichier}\nSHA-256 ${r.sha256}`);
  } catch (erreur) { console.error(erreur.message); process.exit(1); }
}
