#!/usr/bin/env node
// Archive zip d'une release : les fichiers suivis par Git à la révision donnée (jamais le dossier de travail),
// dans un dossier racine MyTeam-<version>/. Les fichiers marqués export-ignore dans .gitattributes restent dehors,
// ainsi que les dossiers de DOSSIERS_EXCLUS, sans intérêt pour la personne qui reçoit le paquet.
// Usage : node scripts/empaqueter-release.mjs <version> [--rev HEAD] [--sortie dist]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const executer = promisify(execFile);
// Un crochet Git exporte GIT_INDEX_FILE et d'autres variables GIT_* : sans les retirer, `git -C <dépôt>` lirait le mauvais index.
const envGit = Object.fromEntries(Object.entries(process.env).filter(([cle]) => !cle.startsWith('GIT_')));
const racine = fileURLToPath(new URL('../', import.meta.url));

// Dossiers suivis par Git mais exclus du paquet : le site vitrine (déployé par ailleurs),
// les réglages du dépôt et les notes d'outils tiers. `test` est déjà écarté par .gitattributes ;
// il est répété ici pour que le contenu du paquet ne dépende pas que d'elle.
const DOSSIERS_EXCLUS = ['site', '.github', '.impeccable', '.jules', 'test'];

// Noms des entrées d'un ZIP dont la structure a déjà été validée, lus dans son répertoire central.
function nomsEntrees(octets) {
  let fin = octets.length - 22;
  const minimum = Math.max(0, fin - 65535);
  while (fin >= minimum && octets.readUInt32LE(fin) !== 0x06054b50) fin--;
  const total = octets.readUInt16LE(fin + 10);
  let p = octets.readUInt32LE(fin + 16);
  const noms = [];
  for (let i = 0; i < total; i++) {
    const nom = octets.readUInt16LE(p + 28), extra = octets.readUInt16LE(p + 30), commentaire = octets.readUInt16LE(p + 32);
    noms.push(octets.toString('utf8', p + 46, p + 46 + nom));
    p += 46 + nom + extra + commentaire;
  }
  return noms;
}

export function verifierZip(octets, prefixe) {
  const invalide = () => { throw new Error('Archive ZIP invalide.'); };
  if (!Buffer.isBuffer(octets) || octets.length < 22) invalide();
  let fin = octets.length - 22;
  const minimum = Math.max(0, fin - 65535);
  while (fin >= minimum && !(octets.readUInt32LE(fin) === 0x06054b50 && fin + 22 + octets.readUInt16LE(fin + 20) === octets.length)) fin--;
  if (fin < minimum) invalide();
  const total = octets.readUInt16LE(fin + 10), debut = octets.readUInt32LE(fin + 16);
  if (!total || octets.readUInt16LE(fin + 4) || octets.readUInt16LE(fin + 6) || octets.readUInt16LE(fin + 8) !== total || debut + octets.readUInt32LE(fin + 12) !== fin) invalide();
  let p = debut;
  for (let i = 0; i < total; i++) {
    if (p + 46 > fin || octets.readUInt32LE(p) !== 0x02014b50) invalide();
    const nom = octets.readUInt16LE(p + 28), extra = octets.readUInt16LE(p + 30), commentaire = octets.readUInt16LE(p + 32);
    const suivant = p + 46 + nom + extra + commentaire, local = octets.readUInt32LE(p + 42);
    if (suivant > fin || !octets.toString('utf8', p + 46, p + 46 + nom).startsWith(prefixe) || local + 30 > debut || octets.readUInt32LE(local) !== 0x04034b50) invalide();
    const debutNom = local + 30, finNom = debutNom + octets.readUInt16LE(local + 26);
    if (finNom + octets.readUInt16LE(local + 28) + octets.readUInt32LE(p + 20) > debut || !octets.subarray(debutNom, finNom).equals(octets.subarray(p + 46, p + 46 + nom))) invalide();
    p = suivant;
  }
  if (p !== fin) invalide();
}

export async function empaqueter(version, { rev = 'HEAD', sortie = 'dist', depot = racine } = {}) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? '')) throw new Error('Version attendue : 1.2.3');
  if (typeof rev !== 'string' || rev.startsWith('-') || !/^[0-9A-Za-z._\/-]{1,100}$/.test(rev)) throw new Error('Révision invalide.');
  let commit;
  try {
    commit = (await executer('git', ['-C', depot, 'rev-parse', '--verify', '--end-of-options', `${rev}^{commit}`], { windowsHide: true, env: envGit })).stdout.trim();
  } catch { throw new Error('Révision invalide : indiquez un commit ou une étiquette existante.'); }
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(commit)) throw new Error('Révision invalide.');
  const suivis = (await executer('git', ['-C', depot, 'ls-tree', '-rz', '--name-only', commit], { windowsHide: true, env: envGit })).stdout.split('\0');
  if (suivis.some(nom => /(^|\/)(?:\.myteam-local|\.bureau|\.env[^/]*)(?:\/|$)/.test(nom))) throw new Error('État privé suivi par Git : paquet refusé.');
  const dossier = resolve(depot, sortie);
  await mkdir(dossier, { recursive: true });
  const fichier = join(dossier, `MyTeam-${version}.zip`);
  const prefixe = `MyTeam-${version}/`;
  await executer('git', ['-C', depot, 'archive', '--format=zip', `--prefix=${prefixe}`, '-o', fichier, commit, '--', '.', ...DOSSIERS_EXCLUS.map(dossier => `:(exclude)${dossier}`)], { windowsHide: true, env: envGit });
  const octets = await readFile(fichier);
  verifierZip(octets, prefixe);
  // Contrôle du produit fini : si un dossier exclu réapparaît (attributs ou git différents),
  // la construction échoue au lieu de livrer un paquet trop rempli.
  for (const nom of nomsEntrees(octets)) {
    const premier = nom.slice(prefixe.length).split('/')[0];
    if (DOSSIERS_EXCLUS.includes(premier)) throw new Error(`Dossier exclu présent dans le paquet : ${premier}/`);
  }
  const sha = createHash('sha256').update(octets).digest('hex');
  const checksum = `${fichier}.sha256`;
  await writeFile(checksum, `${sha}  MyTeam-${version}.zip\n`);
  return { fichier, checksum, sha256: sha, commit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = nom => { const i = args.indexOf(nom); return i === -1 ? null : args[i + 1]; };
  try {
    const r = await empaqueter(args[0], { rev: option('--rev') ?? 'HEAD', sortie: option('--sortie') ?? 'dist' });
    console.log(`${r.fichier}\nSHA-256 ${r.sha256}`);
  } catch (erreur) { console.error(erreur.message); process.exit(1); }
}
