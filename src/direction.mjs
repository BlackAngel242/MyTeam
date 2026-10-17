// Direction de l'équipe : chef par défaut selon la règle (le plus petit panneau),
// ou choix de DrSmoke persisté hors Git dans .bureau/direction.json.
// La passation est TOUJOURS proposée puis confirmée par DrSmoke : ce module
// n'envoie aucun message aux agents et ne décide jamais à la place de DrSmoke.
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { bossOf } from './delegations.mjs';

export class DirectionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const iso = ms => new Date(ms).toISOString();

export function createDirection({ file, bossRule = bossOf, now = () => Date.now() } = {}) {
  if (typeof file !== 'string' || !file) throw new DirectionError('La direction est mal configurée.');
  let choix = null;   // {agentId, since} choisi par DrSmoke
  let ecriture = Promise.resolve();

  // Chargement synchrone au démarrage : la direction est connue dès la création.
  try {
    if (existsSync(file)) {
      const brut = JSON.parse(readFileSync(file, 'utf8'));
      if (brut && typeof brut.agentId === 'string' && brut.agentId && typeof brut.since === 'string') {
        choix = { agentId: brut.agentId, since: brut.since };
      }
    }
  } catch { /* Fichier illisible : on repart de la règle, sans rien effacer. */ }

  function persister() {
    const operation = async () => {
      await mkdir(dirname(file), { recursive: true });
      const temporaire = `${file}.tmp`;
      const forme = choix ? { agentId: choix.agentId, since: choix.since } : { agentId: null, since: null };
      await writeFile(temporaire, JSON.stringify(forme, null, 2), 'utf8');
      await rename(temporaire, file);
    };
    const suite = ecriture.then(operation, operation);
    ecriture = suite.catch(() => {});
    return suite;
  }

  // Chef effectif : le choix de DrSmoke s'il vise encore un agent de la liste
  // (même empreinte), sinon la règle. Un seul chef ressort jamais de cette vue.
  function effective(agents) {
    const liste = Array.isArray(agents) ? agents.filter(a => a && typeof a.id === 'string') : [];
    if (choix) {
      const choisi = liste.find(a => a.id === choix.agentId);
      if (choisi) return { boss: choisi, source: 'choix', since: choix.since };
      // L'agent choisi a disparu ou a changé d'empreinte : retour à la règle,
      // le choix enregistré reste consultable mais n'est plus appliqué.
    }
    const regle = bossRule(liste);
    return { boss: regle ?? null, source: 'regle', since: null };
  }

  async function set(agents, agentId) {
    if (typeof agentId !== 'string' || !agentId.trim() || agentId.length > 200) {
      throw new DirectionError('Sélectionnez un agent.');
    }
    const liste = Array.isArray(agents) ? agents : [];
    const choisi = liste.find(a => a && a.id === agentId);
    if (!choisi) throw new DirectionError('Cet agent n\'est pas dans la liste de Herdr.', 404);
    const avant = choix;
    choix = { agentId, since: iso(now()) };
    try {
      await persister();
    } catch {
      choix = avant;
      throw new DirectionError('Sauvegarde impossible : le choix de direction n\'a pas été gardé.', 500);
    }
    return { boss: choisi, source: 'choix', since: choix.since };
  }

  async function clear() {
    const avant = choix;
    choix = null;
    try {
      await persister();
    } catch {
      choix = avant;
      throw new DirectionError('Sauvegarde impossible : le retour à la règle n\'a pas été gardé.', 500);
    }
    return { source: 'regle', since: null };
  }

  return { effective, set, clear, choixActuel: () => (choix ? { ...choix } : null) };
}
