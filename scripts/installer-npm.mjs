#!/usr/bin/env node
// Installe une copie durable depuis le paquet npm temporaire, puis lance le même assistant que le ZIP.
import { cp, lstat, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../', import.meta.url));
const cible = process.platform === 'win32'
  ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'MyTeam')
  : join(homedir(), '.local', 'share', 'MyTeam');
const fichiers = ['package.json', 'server.mjs', 'src', 'public', 'scripts', 'kit', 'docs'];

async function installer() {
  if (process.argv.includes('--dry-run')) {
    console.log(`Simulation : MyTeam serait copié dans ${cible}, puis l'assistant d'installation serait lancé.`);
    return;
  }
  if (await lstat(cible).then(() => true, e => e.code === 'ENOENT' ? false : Promise.reject(e))) {
    throw new Error(`MyTeam existe déjà dans ${cible}. Ouvrez cette installation et utilisez sa mise à jour intégrée.`);
  }
  await mkdir(dirname(cible), { recursive: true });
  await mkdir(cible);
  try {
    for (const nom of fichiers) await cp(join(source, nom), join(cible, nom), { recursive: true, force: false, errorOnExist: true });
  } catch (erreur) {
    throw new Error(`Copie interrompue dans ${cible} : ${erreur.message}. Vérifiez ce dossier avant de réessayer.`);
  }
  console.log(`MyTeam installé dans ${cible}`);
  const windows = process.platform === 'win32';
  const r = spawnSync(windows ? 'powershell.exe' : 'bash', windows
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(cible, 'scripts', 'installer.ps1')]
    : [join(cible, 'scripts', 'installer.sh')], { cwd: cible, stdio: 'inherit', windowsHide: false });
  if (r.error) throw r.error;
  process.exitCode = r.status ?? 1;
}

installer().catch(erreur => { console.error(erreur.message); process.exitCode = 1; });
