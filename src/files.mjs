import {lstat, opendir, realpath, copyFile, link, unlink, stat, constants} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, sep, basename, extname, relative} from 'node:path';
import {homedir} from 'node:os';

// Dossiers qu'un scan récent ne traverse jamais : volumineux, techniques ou privés.
const SKIP = new Set(['node_modules','.git','AppData','Application Data','$Recycle.Bin','.cache','.npm','.nvm','Library','OneDrive','.vscode','.idea','__pycache__','venv','.venv','dist','build','target']);
const firstExisting = paths => paths.find(p => existsSync(p));
export function standardPlaces(home = homedir()) {
  return {
    bureau: {label:'Bureau', path:firstExisting([join(home,'Desktop'),join(home,'OneDrive','Desktop'),join(home,'Bureau'),join(home,'OneDrive','Bureau')])},
    documents: {label:'Documents', path:firstExisting([join(home,'Documents'),join(home,'OneDrive','Documents')])},
    telechargements: {label:'Téléchargements', path:firstExisting([join(home,'Downloads'),join(home,'Téléchargements')])},
  };
}
const fold = p => process.platform === 'win32' ? p.toLowerCase() : p;
function inside(rootReal, candidate) {
  const r = fold(rootReal), c = fold(candidate);
  return c === r || c.startsWith(r.endsWith(sep) ? r : r + sep);
}
export class FileError extends Error {}
// Résout un chemin relatif dans une racine autorisée, liens symboliques compris : impossible d'en sortir.
export async function resolveInside(rootPath, rel = '') {
  if (typeof rel !== 'string' || rel.includes('\0')) throw new FileError('Chemin invalide.');
  const rootReal = await realpath(rootPath);
  const target = resolve(rootReal, rel);
  if (!inside(rootReal, target)) throw new FileError('Ce chemin sort du dossier autorisé.');
  let real;
  try { real = await realpath(target); } catch { throw new FileError('Fichier ou dossier introuvable.'); }
  if (!inside(rootReal, real)) throw new FileError('Ce chemin sort du dossier autorisé.');
  return {rootReal, real};
}
const entryOf = (rootReal, full, info) => ({name:basename(full), path:relative(rootReal, full).split(sep).join('/'), size:info.size, modified:info.mtime.toISOString(), ext:extname(full).slice(1).toLowerCase(), dir:info.isDirectory()});

export async function listDir(rootPath, rel = '', {limit = 300} = {}) {
  const {rootReal, real} = await resolveInside(rootPath, rel);
  if (!(await stat(real)).isDirectory()) throw new FileError('Ce chemin n’est pas un dossier.');
  const items = [];
  for await (const entry of await opendir(real)) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
    if (!entry.isFile() && !entry.isDirectory()) continue;
    try { items.push(entryOf(rootReal, join(real, entry.name), await lstat(join(real, entry.name)))); } catch { /* fichier disparu entre-temps */ }
    if (items.length >= limit) break;
  }
  return items.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, 'fr'));
}

// Fichiers modifiés récemment dans un dossier de travail : un fait observé, pas une attribution.
export async function recentFiles(rootPath, {hours = 48, depth = 3, limit = 60, budget = 5000} = {}) {
  const rootReal = await realpath(rootPath);
  const since = Date.now() - hours * 3600e3, found = [];
  const pending = [[rootReal, 0]];
  let visited = 0;
  while (pending.length && visited < budget) {
    const [dir, level] = pending.shift();
    let handle;
    try { handle = await opendir(dir); } catch { continue; }
    for await (const entry of handle) {
      if (++visited > budget) break;
      if (entry.isSymbolicLink() || entry.name.startsWith('.') || entry.name.startsWith('~$')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { if (level < depth && !SKIP.has(entry.name)) pending.push([full, level + 1]); continue; }
      if (!entry.isFile()) continue;
      try { const info = await lstat(full); if (info.mtimeMs >= since) found.push(entryOf(rootReal, full, info)); } catch { /* ignoré */ }
    }
  }
  return found.sort((a, b) => b.modified.localeCompare(a.modified)).slice(0, limit);
}

async function freeName(dirReal, name) {
  const ext = extname(name), stem = name.slice(0, name.length - ext.length);
  for (let n = 1; n < 1000; n++) {
    const candidate = join(dirReal, n === 1 ? name : `${stem} (${n})${ext}`);
    if (!existsSync(candidate)) return candidate;
  }
  throw new FileError('Trop de fichiers portent déjà ce nom dans la destination.');
}
// Copie ou déplace un fichier entre deux racines autorisées. Jamais d'écrasement : un suffixe (2), (3)… est ajouté.
export async function transfer({fromRoot, fromPath, toRoot, toPath = '', mode = 'copy'}) {
  if (!['copy', 'move'].includes(mode)) throw new FileError('Action inconnue.');
  const src = await resolveInside(fromRoot, fromPath);
  const info = await lstat(src.real);
  if (!info.isFile()) throw new FileError('Seuls les fichiers peuvent être copiés ou déplacés pour le moment.');
  const dst = await resolveInside(toRoot, toPath);
  if (!(await stat(dst.real)).isDirectory()) throw new FileError('La destination doit être un dossier.');
  // La destination est CRÉÉE de façon exclusive (copie avec COPYFILE_EXCL, ou lien dur puis retrait de la source) :
  // un fichier apparu entre le contrôle et la création, écrit par un autre programme, n'est jamais remplacé.
  // En cas de collision, on prend le nom libre suivant.
  let target;
  for (let essai = 0; essai < 20; essai++) {
    target = await freeName(dst.real, basename(src.real));
    if (fold(target) === fold(src.real)) throw new FileError('Le fichier est déjà à cet endroit.');
    try {
      if (mode === 'copy') await copyFile(src.real, target, constants.COPYFILE_EXCL);
      else {
        try { await link(src.real, target); }
        catch (error) {
          if (error.code === 'EEXIST') throw error;
          // Volume différent ou système de fichiers sans lien dur : copie exclusive.
          await copyFile(src.real, target, constants.COPYFILE_EXCL);
        }
        await unlink(src.real);
      }
      return {ok:true, name:basename(target), path:relative(dst.rootReal, target).split(sep).join('/'), mode};
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new FileError('Trop de fichiers portent déjà ce nom dans la destination.');
}
