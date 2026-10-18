// Mode autonomie (« NoBabysitter »), version supervisée en étoile autour du chef.
//
// DrSmoke donne un objectif, une durée et un plafond d'échanges. Tant que le mode est actif, chaque fin de
// travail d'un autre agent (observée par le relais d'écoute) ajoute au chef une consigne qui rappelle
// l'objectif et les interdits ; le chef décide seul de la suite et la délègue. Aucun agent n'écrit à un autre
// par ce module : tout passe par la file d'attente du chef.
//
// Garde-fous : désactivé par défaut ; durée et échanges plafonnés ; arrêt à l'échéance, au plafond, à la salle de
// crise, sur boucle (un même agent qui termine trop souvent) et à tout redémarrage du serveur (jamais de reprise
// silencieuse). Le journal ne contient que des faits réellement survenus.
import { readFileSync } from 'node:fs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

const MINUTE = 60000;
export const LIMITES = { minutes: { min: 5, defaut: 30, max: 120 }, echanges: { min: 3, defaut: 20, max: 60 }, objectif: 300, journal: 40, boucle: { fenetre: 10 * MINUTE, fins: 4 } };
export class AutonomieError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const entier = (valeur, { min, defaut, max }) => {
  if (valeur === undefined || valeur === null) return defaut;
  if (!Number.isInteger(valeur) || valeur < min || valeur > max) throw new AutonomieError(`Valeur attendue entre ${min} et ${max}.`);
  return valeur;
};
const heure = ms => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function createAutonomie({ file, enqueue, relais, now = () => Date.now(), locked = () => false } = {}) {
  if (typeof file !== 'string' || !file || typeof enqueue !== 'function' || !relais) throw new AutonomieError('Autonomie mal configurée.', 500);
  let etat = null; // null : inactif ; sinon {objectif, debut, finAt, maxEchanges, echanges, relaisAvant}
  let dernierArret = null, journal = [], pending = Promise.resolve();
  const fins = new Map();
  // Jamais de reprise silencieuse : un mode actif au moment d'un arrêt du serveur est clos au redémarrage,
  // et le relais d'écoute retrouve l'état qu'il avait avant le lancement.
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    if (saved?.actif === true) {
      dernierArret = 'redémarrage du serveur';
      pending = Promise.resolve().then(async () => {
        if (saved.relaisAvant === false) await relais.set(false).catch(() => {});
        await mkdir(dirname(file), { recursive: true });
        await writeFile(`${file}.tmp`, JSON.stringify({ actif: false, arret: dernierArret, relaisAvant: null }), 'utf8');
        await rename(`${file}.tmp`, file);
      }).catch(() => {});
    } else if (typeof saved?.arret === 'string') dernierArret = saved.arret.slice(0, 200);
  } catch { /* Aucun état enregistré. */ }
  const exclusive = operation => { const suite = pending.then(operation, operation); pending = suite.catch(() => {}); return suite; };
  const noter = (type, texte) => { journal.push({ at: new Date(now()).toISOString(), type, texte }); if (journal.length > LIMITES.journal) journal.shift(); };
  async function sauver() {
    try {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify({ actif: Boolean(etat), arret: dernierArret, relaisAvant: etat ? etat.relaisAvant : null }), 'utf8');
      await rename(`${file}.tmp`, file);
    } catch { throw new AutonomieError("Sauvegarde impossible : l'autonomie n'a pas été changée.", 500); }
  }
  const get = () => etat
    ? { actif: true, objectif: etat.objectif, debut: new Date(etat.debut).toISOString(), finAt: new Date(etat.finAt).toISOString(), echanges: etat.echanges, maxEchanges: etat.maxEchanges, arret: null, journal: [...journal] }
    : { actif: false, objectif: null, debut: null, finAt: null, echanges: 0, maxEchanges: 0, arret: dernierArret, journal: [...journal] };

  async function arreter(motif) {
    if (!etat) return;
    const avant = etat.relaisAvant;
    etat = null; dernierArret = motif; fins.clear();
    noter('arret', `Autonomie arrêtée : ${motif}.`);
    await sauver().catch(() => {});
    if (avant === false) await relais.set(false).catch(() => {});
  }
  function demarrer({ objectif, minutes, echanges } = {}) {
    return exclusive(async () => {
      if (etat) throw new AutonomieError("L'autonomie est déjà active.", 409);
      if (locked()) throw new AutonomieError('Salle de crise active : levez la crise avant de lancer l\'autonomie.', 423);
      const texte = typeof objectif === 'string' ? Array.from(objectif.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, LIMITES.objectif).join('') : '';
      if (texte.length < 5) throw new AutonomieError("Décrivez l'objectif en quelques mots (5 caractères au moins).");
      const duree = entier(minutes, LIMITES.minutes), plafond = entier(echanges, LIMITES.echanges);
      const debut = now();
      const relaisAvant = relais.get().actif;
      etat = { objectif: texte, debut, finAt: debut + duree * MINUTE, maxEchanges: plafond, echanges: 0, relaisAvant };
      dernierArret = null; journal = []; fins.clear();
      try { await relais.set(true); await sauver(); }
      catch (erreur) { etat = null; await relais.set(relaisAvant).catch(() => {}); throw erreur instanceof AutonomieError ? erreur : new AutonomieError("Le relais d'écoute n'a pas pu être activé.", 500); }
      noter('debut', `Autonomie lancée : « ${texte} », ${duree} min, ${plafond} échanges au plus.`);
      return get();
    });
  }
  const arretManuel = () => exclusive(async () => { await arreter('arrêt demandé par DrSmoke'); return get(); });

  // Appelé par le relais à la place de la file : sans autonomie active, la consigne passe telle quelle.
  async function passer(item, meta = {}) {
    if (!etat) return enqueue(item);
    const t = now();
    if (t >= etat.finAt) { await arreter('durée écoulée'); return undefined; }
    const cle = String(meta.agent?.id ?? '');
    const recents = (fins.get(cle) ?? []).filter(at => t - at < LIMITES.boucle.fenetre);
    recents.push(t); fins.set(cle, recents);
    if (recents.length >= LIMITES.boucle.fins) { await arreter(`boucle détectée (${meta.agent?.name ?? 'un agent'} termine trop souvent)`); return undefined; }
    const numero = etat.echanges + 1, nom = meta.agent?.name ?? 'Un agent';
    const message = `Mode autonomie (objectif : « ${etat.objectif} », échange ${numero}/${etat.maxEchanges}, fin à ${heure(etat.finAt)}). ${nom} vient de terminer. Lis son panneau, vérifie le résultat, puis décide seul de la suite et délègue-la ; si l'objectif est atteint, dis-le et arrête de déléguer. Sans DrSmoke, jamais de git push, de suppression, d'installation, de publication ni de réponse à une boîte de dialogue. Si tu te répètes, arrête-toi.`;
    const resultat = await enqueue({ ...item, message });
    etat.echanges = numero;
    noter('message', `${nom} a terminé : le chef est prévenu (échange ${numero}/${etat.maxEchanges}).`);
    if (numero >= etat.maxEchanges) await arreter('plafond d\'échanges atteint');
    else await sauver().catch(() => {});
    return resultat;
  }
  // Contrôle périodique : échéance et salle de crise.
  const verifier = () => exclusive(async () => {
    if (!etat) return;
    if (locked()) await arreter('salle de crise enclenchée');
    else if (now() >= etat.finAt) await arreter('durée écoulée');
  });
  return { get, demarrer, arreter: arretManuel, passer, verifier };
}
