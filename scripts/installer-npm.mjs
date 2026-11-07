#!/usr/bin/env node
// Installe une copie durable depuis le paquet npm temporaire, puis lance le même assistant que le ZIP.
import { cp, lstat, mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../', import.meta.url));
// Hors du dossier de données (%LOCALAPPDATA%\MyTeam, ~/.local/share/MyTeam), créé dès le premier lancement :
// sinon toute personne ayant déjà utilisé MyTeam se verrait refuser l'installation.
const cible = process.platform === 'win32'
  ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Programs', 'MyTeam')
  : join(homedir(), '.local', 'lib', 'MyTeam');
const fichiers = ['package.json', 'server.mjs', 'src', 'public', 'scripts', 'kit', 'docs'];

// Même assistant animé que « Installer MyTeam.bat » (flèches, liste de tâches en direct) ; options transmises : --lang, --simple, --port.
function lancerAssistant(dossier = cible) {
  const r = spawnSync(process.execPath, [join(dossier, 'scripts', 'installateur-anime.mjs'), ...process.argv.slice(2)],
    { cwd: dossier, stdio: 'inherit', windowsHide: false });
  if (r.error) throw r.error;
  process.exitCode = r.status ?? 1;
}

// package.json illisible ou invalide = null (dossier étranger), jamais une erreur brute.
const lirePaquet = dossier => readFile(join(dossier, 'package.json'), 'utf8').then(t => { try { return JSON.parse(t); } catch { return null; } }, () => null);

async function installer() {
  // La démonstration n'installe rien : elle tourne depuis le paquet npm temporaire, sans copie dans le dossier utilisateur.
  if (process.argv.includes('--demo')) return lancerAssistant(source);
  const simulation = process.argv.includes('--dry-run');
  if (await lstat(cible).then(() => true, e => e.code === 'ENOENT' ? false : Promise.reject(e))) {
    // Relancer npx sur une installation existante rouvre son assistant, sans rien écraser.
    const installee = await lirePaquet(cible);
    if (!['@drsmoke/myteam', 'bureau-des-agents'].includes(installee?.name)) {
      throw new Error(`Le dossier ${cible} existe mais ne contient pas MyTeam : rien n'a été modifié. Déplacez-le avant de réessayer.`);
    }
    if (simulation) {
      console.log(`Simulation : MyTeam ${installee.version} est déjà installé dans ${cible} ; rien ne serait copié, son assistant serait relancé.`);
      return;
    }
    const proposee = (await lirePaquet(source)).version;
    console.log(`MyTeam ${installee.version} est déjà installé dans ${cible} : rien n'est écrasé, son assistant se relance.`);
    if (installee.version !== proposee) console.log(`La version ${proposee} existe : utilisez la mise à jour intégrée du bureau pour l'installer.`);
    return lancerAssistant();
  }
  if (simulation) {
    console.log(`Simulation : MyTeam serait copié dans ${cible}, puis l'assistant d'installation serait lancé.`);
    return;
  }
  await mkdir(dirname(cible), { recursive: true });
  await mkdir(cible);
  try {
    for (const nom of fichiers) await cp(join(source, nom), join(cible, nom), { recursive: true, force: false, errorOnExist: true });
  } catch (erreur) {
    throw new Error(`Copie interrompue dans ${cible} : ${erreur.message}. Vérifiez ce dossier avant de réessayer.`);
  }
  console.log(`MyTeam installé dans ${cible}`);
  lancerAssistant();
}

installer().catch(erreur => { console.error(erreur.message); process.exitCode = 1; });
