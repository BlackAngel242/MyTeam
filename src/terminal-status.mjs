// Pause de quota vue depuis le terminal de chaque agent.
//
// Toutes les 20 secondes, le serveur lit légèrement le panneau
// (`herdr agent read <panneau> --source detection`, sans faire défiler) et
// repère les messages réels de limite affichés par l'outil d'IA, par exemple :
//   « You've hit your usage limit · try again at 4:37 AM »
//   « limit reached · resets 7pm »
//   « You've used 91% of your session limit · resets 4:40am »
// Une simple jauge de contexte comme « 103.1K (10%) » n'est PAS une limite.
// limitReached n'est vrai que si la limite est réellement atteinte ; un
// pourcentage annoncé donne usedPercent, et l'heure annoncée donne resetsAt
// (heure locale du poste, le lendemain si l'heure est déjà passée).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findHerdr } from './herdr.mjs';

const execute = promisify(execFile);
const MAX_TEXTE = 200000;

// Heure annoncée (« 4:37 AM », « 7pm », « 23h45 ») en heure locale du poste.
function heureLocale(annonce, maintenant) {
  const meridien = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i.exec(annonce);
  const vingtQuatre = /(\d{1,2})[:h](\d{2})/.exec(annonce);
  let heures, minutes;
  if (meridien) {
    heures = Number(meridien[1]) % 12;
    minutes = Number(meridien[2] || 0);
    if (meridien[3].toLowerCase() === 'p') heures += 12;
  } else if (vingtQuatre) {
    heures = Number(vingtQuatre[1]);
    minutes = Number(vingtQuatre[2]);
  } else return null;
  if (heures > 23 || minutes > 59) return null;
  const date = new Date(maintenant);
  date.setHours(heures, minutes, 0, 0);
  // Une heure déjà passée est annoncée pour le lendemain.
  if (date.getTime() <= maintenant - 60000) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function parseLimitMessage(texte, { now = () => Date.now() } = {}) {
  const maintenant = now();
  for (const ligne of String(texte ?? '').slice(0, MAX_TEXTE).split('\n')) {
    const atteinte = /hit (?:your |the )?(?:usage|session|rate)[^\n]{0,40}limit/i.test(ligne)
      || /limit (?:has been )?reached/i.test(ligne);
    // « You've used 91% of your session limit » annonce un pourcentage ; la
    // jauge « 103.1K (10%) » ne contient aucun de ces motifs et est ignorée.
    const consomme = /used\s+(\d{1,3})\s*%\s*of (?:your |the )?\w+ limit/i.exec(ligne);
    const reste = /limit:\s*(\d{1,3})\s*%\s*left/i.exec(ligne);
    if (!atteinte && !consomme && !reste) continue;
    let usedPercent = null;
    if (consomme) usedPercent = Number(consomme[1]);
    else if (reste) usedPercent = 100 - Number(reste[1]);
    if (usedPercent !== null && !(usedPercent >= 0 && usedPercent <= 100)) usedPercent = null;
    const limiteAtteinte = atteinte || (usedPercent !== null && usedPercent >= 100);
    const repere = /(?:try again at|resets?(?: at)?|reset at|réessaie(?:z)? à)\s*([^\n·]+)/i.exec(ligne);
    const resetsAt = repere ? heureLocale(repere[1], maintenant) : null;
    return { limitReached: limiteAtteinte, resetsAt, usedPercent, source: 'terminal' };
  }
  return null;
}

// Lecture légère d'un panneau. Les erreurs remontent : le serveur garde alors
// le dernier état connu plutôt que d'inventer une absence de limite.
export function createTerminalStatusReader({ run, now = () => Date.now() } = {}) {
  const lire = run ?? (async panneau => {
    const { stdout } = await execute(findHerdr(), ['agent', 'read', panneau, '--source', 'detection'], {
      windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024, encoding: 'utf8',
    });
    return stdout;
  });
  return async function lireEtat(agent) {
    const panneau = typeof agent?.paneId === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(agent.paneId) ? agent.paneId : null;
    if (!panneau) return null;
    return parseLimitMessage(await lire(panneau), { now });
  };
}
