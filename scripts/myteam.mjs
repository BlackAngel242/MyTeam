// Commande `myteam` (et raccourci MyTeam du Bureau) : démarre le bureau en arrière-plan, l'ouvre dans le
// navigateur par défaut, puis ouvre Herdr sur la session dédiée MyTeam dans ce terminal.
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as attendre } from 'node:timers/promises';
import { openBureau } from './ouvrir-bureau.mjs';
import { findHerdr, sessionHerdr } from '../src/herdr.mjs';

const racine = dirname(dirname(fileURLToPath(import.meta.url)));

// Sous Windows, l'installeur enregistre BUREAU_PORT et BUREAU_HERDR_SESSION dans les variables de l'utilisateur.
// Le registre fait foi : un terminal ouvert avant (ré)installation garde d'anciennes valeurs, ou aucune.
export function variableUtilisateur(nom, { env = process.env, platform = process.platform, lancer = spawnSync } = {}) {
  if (platform !== 'win32') return env[nom] || undefined;
  const r = lancer('reg', ['query', 'HKCU\\Environment', '/v', nom], { encoding: 'utf8', windowsHide: true });
  const ligne = (r.stdout ?? '').split(/\r?\n/).find(l => l.trim().startsWith(nom + ' '));
  return ligne?.trim().split(/\s+REG_\w+\s+/)[1]?.trim() || env[nom] || undefined;
}

// Qui écoute ce port ? null = personne (connexion refusée) ; { myteam: false } = un autre programme, y compris un
// programme qui ne parle pas HTTP ou ne répond pas ; { myteam: true, session } = un bureau MyTeam ; { myteam: true, ancien: true } = bureau d'avant /api/identite.
export async function identifier(port, { recuperer = fetch } = {}) {
  let reponse;
  try { reponse = await recuperer(`http://127.0.0.1:${port}/api/identite`, { signal: AbortSignal.timeout(2000) }); }
  catch (e) { return e?.cause?.code === 'ECONNREFUSED' || e?.code === 'ECONNREFUSED' ? null : { myteam: false }; }
  const corps = await reponse.json().catch(() => null);
  if (reponse.ok && corps?.app === 'myteam') return { myteam: true, session: corps.session ?? null, version: corps.version ?? null };
  // Un bureau 0.6.0 ou plus ancien répond « Page introuvable. » avec la politique de sécurité propre à MyTeam.
  const csp = reponse.headers?.get?.('content-security-policy') ?? '';
  if (reponse.status === 404 && corps?.error === 'Page introuvable.' && csp.includes("frame-ancestors 'none'")) return { myteam: true, ancien: true, session: null };
  return { myteam: false };
}

// Processus qui écoute le port, seulement s'il s'agit de Node (jamais un autre programme).
export function processusNode(port, { platform = process.platform, lancer = spawnSync } = {}) {
  if (platform === 'win32') {
    const net = lancer('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true }).stdout ?? '';
    // Écoute = adresse distante 0.0.0.0:0 ; le libellé de l'état (LISTENING, ABHÖREN…) dépend de la langue de Windows.
    const ligne = net.split(/\r?\n/).find(l => new RegExp(`^\\s*TCP\\s+127\\.0\\.0\\.1:${port}\\s+0\\.0\\.0\\.0:0\\s+\\S+\\s+\\d+\\s*$`).test(l));
    const pid = Number(ligne?.trim().split(/\s+/).pop());
    if (!Number.isSafeInteger(pid) || pid <= 0) return null;
    const image = lancer('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout ?? '';
    return /^"node\.exe"/i.test(image.trim()) ? pid : null;
  }
  const pid = Number((lancer('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).stdout ?? '').trim().split(/\s+/)[0]);
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  return /node/.test(lancer('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8' }).stdout ?? '') ? pid : null;
}

const AIDE = `myteam : ouvre le bureau des agents dans le navigateur, puis Herdr sur la session MyTeam.
  myteam              bureau + Herdr
  myteam --bureau     bureau seulement (Herdr n'est pas ouvert)
  myteam --help       cette aide
Port : variable BUREAU_PORT (4317 par défaut). Session Herdr : BUREAU_HERDR_SESSION (myteam par défaut).`;

export async function lancerMyTeam(args = [], {
  env = process.env, ouvrir = openBureau, lancer = spawnSync, trouverHerdr = findHerdr, ecrire = t => console.log(t),
  lire = nom => variableUtilisateur(nom, { env }), qui = identifier, pidNode = processusNode, tuer = pid => process.kill(pid),
  pause = attendre,
} = {}) {
  if (args.includes('--help') || args.includes('-h')) { ecrire(AIDE); return 0; }
  const inconnue = args.find(a => !['--bureau'].includes(a));
  if (inconnue) { ecrire(`Option inconnue : ${inconnue}\n\n${AIDE}`); return 2; }
  const port = lire('BUREAU_PORT') || '4317';
  if (!/^\d{4,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535) { ecrire(`Port invalide (BUREAU_PORT=${port}) : un nombre entre 1024 et 65535 est attendu.`); return 2; }
  const session = sessionHerdr({ BUREAU_HERDR_SESSION: lire('BUREAU_HERDR_SESSION') || 'myteam' });
  let herdr;
  try { herdr = lire('BUREAU_HERDR_PATH') || trouverHerdr({ env }); } catch { herdr = null; }
  // Le serveur du bureau hérite de ces valeurs : il lit les agents dans la même session que la fenêtre Herdr.
  env.BUREAU_PORT = String(port);
  env.BUREAU_HERDR_SESSION = session;
  if (herdr) env.BUREAU_HERDR_PATH = herdr;

  // Un bureau déjà ouvert sur ce port doit être un bureau MyTeam de la même session ; sinon on l'arrête (si c'est le
  // nôtre) ou on s'arrête (si c'est un autre programme), plutôt que d'afficher les agents d'une autre session.
  const present = await qui(port);
  if (present && !present.myteam) { ecrire(`Le port ${port} est occupé par un autre programme. Choisissez un autre port (variable BUREAU_PORT) puis relancez myteam.`); return 1; }
  if (present?.myteam && present.session !== session) {
    // Seule autorité : le processus Node qui écoute réellement le port, jamais un numéro annoncé par une réponse HTTP.
    const pid = pidNode(port);
    if (!pid) { ecrire(`Un ancien bureau MyTeam tourne sur le port ${port} et ne lit pas la session « ${session} ». Fermez-le (ou redémarrez l'ordinateur) puis relancez myteam.`); return 1; }
    ecrire(`Redémarrage du bureau sur la session « ${session} »…`);
    try { tuer(pid); } catch { /* déjà arrêté */ }
    for (let i = 0; i < 50 && await qui(port); i++) await pause(100);
    if (await qui(port)) { ecrire(`Le bureau précédent ne s'arrête pas (processus ${pid}). Fermez-le puis relancez myteam.`); return 1; }
  }

  await ouvrir({ root: racine, port });
  ecrire(`Bureau ouvert : http://127.0.0.1:${port}`);
  if (args.includes('--bureau')) return 0;
  if (!herdr) { ecrire('Herdr est introuvable : le bureau est ouvert, mais sans agents. Relancez l’installateur (npx @drsmoke/myteam) pour installer Herdr.'); return 1; }
  ecrire(`Herdr : session « ${session} » (fermer cette fenêtre ferme l'affichage, pas les agents).`);
  const r = lancer(herdr, ['--session', session], { stdio: 'inherit', cwd: racine });
  if (r.error) { ecrire(`Herdr n'a pas pu démarrer : ${r.error.message}`); return 1; }
  return r.status ?? 0;
}
