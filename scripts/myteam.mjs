// Commande `myteam` (et raccourci MyTeam du Bureau) : démarre le bureau en arrière-plan, l'ouvre dans le
// navigateur par défaut, puis ouvre Herdr sur la session dédiée MyTeam dans ce terminal.
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBureau } from './ouvrir-bureau.mjs';
import { findHerdr, sessionHerdr } from '../src/herdr.mjs';

const racine = dirname(dirname(fileURLToPath(import.meta.url)));

// Sous Windows, l'installeur enregistre BUREAU_PORT et BUREAU_HERDR_SESSION dans les variables de l'utilisateur :
// un terminal ouvert avant l'installation ne les voit pas encore, on les relit donc dans le registre.
export function variableUtilisateur(nom, { env = process.env, platform = process.platform, lancer = spawnSync } = {}) {
  if (env[nom]) return env[nom];
  if (platform !== 'win32') return undefined;
  const r = lancer('reg', ['query', 'HKCU\\Environment', '/v', nom], { encoding: 'utf8', windowsHide: true });
  const ligne = (r.stdout ?? '').split(/\r?\n/).find(l => l.trim().startsWith(nom + ' '));
  return ligne?.trim().split(/\s+REG_\w+\s+/)[1]?.trim() || undefined;
}

const AIDE = `myteam : ouvre le bureau des agents dans le navigateur, puis Herdr sur la session MyTeam.
  myteam              bureau + Herdr
  myteam --bureau     bureau seulement (Herdr n'est pas ouvert)
  myteam --help       cette aide
Port : variable BUREAU_PORT (4317 par défaut). Session Herdr : BUREAU_HERDR_SESSION (myteam par défaut).`;

export async function lancerMyTeam(args = [], { env = process.env, ouvrir = openBureau, lancer = spawnSync, trouverHerdr = findHerdr, ecrire = t => console.log(t), lire = nom => variableUtilisateur(nom, { env }) } = {}) {
  if (args.includes('--help') || args.includes('-h')) { ecrire(AIDE); return 0; }
  const inconnue = args.find(a => !['--bureau'].includes(a));
  if (inconnue) { ecrire(`Option inconnue : ${inconnue}\n\n${AIDE}`); return 2; }
  const port = lire('BUREAU_PORT') || '4317';
  const session = sessionHerdr({ BUREAU_HERDR_SESSION: lire('BUREAU_HERDR_SESSION') || 'myteam' });
  // Le serveur du bureau hérite de ces valeurs : il lit les agents dans la même session que la fenêtre Herdr.
  env.BUREAU_PORT = String(port);
  env.BUREAU_HERDR_SESSION = session;
  await ouvrir({ root: racine, port });
  ecrire(`Bureau ouvert : http://127.0.0.1:${port}`);
  if (args.includes('--bureau')) return 0;
  let herdr;
  try { herdr = lire('BUREAU_HERDR_PATH') || trouverHerdr({ env }); } catch { herdr = null; }
  if (!herdr) { ecrire('Herdr est introuvable : le bureau est ouvert, mais sans agents. Relancez l’installateur (npx @drsmoke/myteam) pour installer Herdr.'); return 1; }
  ecrire(`Herdr : session « ${session} » (fermer cette fenêtre ferme l'affichage, pas les agents).`);
  const r = lancer(herdr, ['--session', session], { stdio: 'inherit', cwd: racine });
  if (r.error) { ecrire(`Herdr n'a pas pu démarrer : ${r.error.message}`); return 1; }
  return r.status ?? 0;
}
