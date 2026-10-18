// Salle de crise : état {active, since} persisté de façon atomique dans
// .bureau/crise.json (hors Git, comme la file d'attente).
// Règle de sûreté : un fichier absent veut dire « jamais déclenchée » ; un
// fichier corrompu ou illisible veut dire crise ACTIVE, avec sa raison. En cas
// de doute, rien ne part.
//
// Contrat : get() renvoie {active, since, reason} ; set(active) accepte un
// booléen (autre chose = erreur de saisie) et renvoie le même objet ; isActive()
// est la lecture utilisée par la file et les routes d'envoi.
import {existsSync, readFileSync} from 'node:fs';
import {mkdir, writeFile, rename} from 'node:fs/promises';
import {dirname} from 'node:path';

const iso = ms => new Date(ms).toISOString();

export class CriseError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CriseError';
    this.statusCode = status;
  }
}

export function createCrise({file, now = () => Date.now()} = {}) {
  if (typeof file !== 'string' || !file) throw new CriseError('La salle de crise est mal configurée.', 500);

  let etat = {active: false, since: null, reason: null};
  try {
    if (existsSync(file)) {
      const forme = JSON.parse(readFileSync(file, 'utf8'));
      if (!forme || typeof forme !== 'object' || typeof forme.active !== 'boolean') throw new Error();
      etat = {
        active: forme.active,
        since: typeof forme.since === 'string' && !Number.isNaN(Date.parse(forme.since)) ? iso(Date.parse(forme.since)) : null,
        reason: null,
      };
      if (etat.active && !etat.since) etat.since = iso(now());
    }
  } catch {
    etat = {
      active: true,
      since: iso(now()),
      reason: 'État de la salle de crise illisible : crise active par sécurité.',
    };
  }

  let ecriture = Promise.resolve();
  // Écriture atomique comme la file : temporaire puis remplacement.
  function persister() {
    const operation = async () => {
      await mkdir(dirname(file), {recursive: true});
      const temporaire = `${file}.tmp`;
      await writeFile(temporaire, JSON.stringify({version: 1, active: etat.active, since: etat.since}, null, 2), 'utf8');
      await rename(temporaire, file);
    };
    const suite = ecriture.then(operation, operation);
    ecriture = suite.catch(() => {});
    return suite;
  }

  return {
    get: () => ({active: etat.active, since: etat.since, reason: etat.reason}),
    isActive: () => etat.active,
    async set(active) {
      if (typeof active !== 'boolean') throw new CriseError('La crise s’active ou se lève avec un booléen.');
      if (active === etat.active) return {active: etat.active, since: etat.since, reason: etat.reason};
      etat = active
        ? {active: true, since: iso(now()), reason: null}
        : {active: false, since: null, reason: null};
      await persister();
      return {active: etat.active, since: etat.since, reason: etat.reason};
    },
  };
}
