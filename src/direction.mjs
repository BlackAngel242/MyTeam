// Direction de l'équipe : chef par défaut selon la règle (l'agent présent le
// plus anciennement vu : première apparition mémorisée dans apparitions.json,
// à côté de direction.json), ou choix de DrSmoke persisté hors Git dans
// .bureau/direction.json.
// Limite assumée : au premier démarrage, sans mémoire d'ordre, les agents
// déjà présents sont départagés au numéro de panneau.
// La passation est TOUJOURS proposée puis confirmée par DrSmoke : ce module
// n'envoie aucun message aux agents et ne décide jamais à la place de DrSmoke.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { bossOf, clePanneau } from './delegations.mjs';

export class DirectionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const iso = ms => new Date(ms).toISOString();

export function createDirection({ file, apparitionsFile, bossRule = bossOf, now = () => Date.now() } = {}) {
  if (typeof file !== 'string' || !file) throw new DirectionError('La direction est mal configurée.');
  // Le carnet des premières apparitions vit au même endroit que la
  // direction : l'état privé du projet, hors Git.
  const carnetFile = typeof apparitionsFile === 'string' && apparitionsFile
    ? apparitionsFile
    : join(dirname(file), 'apparitions.json');
  let choix = null;   // {agentId, since} choisi par DrSmoke
  let apparitions = new Map();   // agentId -> date ISO de première apparition
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

  // Chargement synchrone du carnet, comme la direction : une date illisible
  // est écartée, jamais inventée.
  try {
    if (existsSync(carnetFile)) {
      const brut = JSON.parse(readFileSync(carnetFile, 'utf8'));
      if (brut && typeof brut === 'object' && !Array.isArray(brut)) {
        for (const [id, date] of Object.entries(brut)) {
          if (typeof date === 'string' && !Number.isNaN(Date.parse(date))) apparitions.set(id, date);
        }
      }
    }
  } catch { /* Carnet illisible : on repart sans mémoire, sans rien effacer. */ }

  // Même écriture atomique que la file (src/queue.mjs) : fichier temporaire
  // puis renommage. Elle est synchrone parce que l'observation est appelée
  // depuis des lectures d'état synchrones : l'ordre observé est sur le
  // disque avant le retour, sans écriture en vol qui survivrait à l'instance.
  // Un échec d'écriture ne casse pas la lecture d'état : le carnet vaut
  // alors pour la session en cours, sans survivre au redémarrage.
  function persisterApparitions() {
    try {
      mkdirSync(dirname(carnetFile), { recursive: true });
      const temporaire = `${carnetFile}.tmp`;
      writeFileSync(temporaire, JSON.stringify(Object.fromEntries(apparitions), null, 2), 'utf8');
      renameSync(temporaire, carnetFile);
    } catch { /* Voir ci-dessus : la mémoire vive garde l'ordre observé. */ }
  }

  // Observation d'une liste d'agents : le carnet retient la première
  // apparition de chacun et oublie les disparus ; la liste rendue est triée
  // par date de première apparition. À date égale, et donc au premier
  // démarrage où tous les présents sont vus au même moment, le plus petit
  // numéro de panneau départage, puis l'identifiant complet.
  function observer(liste) {
    const presents = new Set(liste.map(a => a.id));
    let change = false;
    for (const id of [...apparitions.keys()]) {
      if (!presents.has(id)) { apparitions.delete(id); change = true; }
    }
    const date = iso(now());
    for (const agent of liste) {
      if (!apparitions.has(agent.id)) { apparitions.set(agent.id, date); change = true; }
    }
    if (change) persisterApparitions();
    return [...liste].sort((a, b) => {
      const da = apparitions.get(a.id), db = apparitions.get(b.id);
      if (da !== db) return da < db ? -1 : 1;
      const ca = clePanneau(a), cb = clePanneau(b);
      if (ca && cb) {
        if (ca.espace !== cb.espace) return ca.espace < cb.espace ? -1 : 1;
        if (ca.numero !== cb.numero) return ca.numero - cb.numero;
      } else if (ca) return -1;
      else if (cb) return 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

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
  // (même empreinte), sinon la règle. L'observation alimente le carnet dans
  // tous les cas, et la règle reçoit la liste triée par première apparition :
  // c'est l'appelant qui porte l'ordre, bossOf renvoie le premier reçu.
  // Un seul chef ressort jamais de cette vue.
  function effective(agents) {
    const liste = Array.isArray(agents) ? agents.filter(a => a && typeof a.id === 'string') : [];
    const ordonnes = observer(liste);
    if (choix) {
      const choisi = liste.find(a => a.id === choix.agentId);
      if (choisi) return { boss: choisi, source: 'choix', since: choix.since };
      // L'agent choisi a disparu ou a changé d'empreinte : retour à la règle,
      // le choix enregistré reste consultable mais n'est plus appliqué.
    }
    const regle = bossRule(ordonnes);
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

  return {
    effective, set, clear,
    choixActuel: () => (choix ? { ...choix } : null),
    apparitionsActuelles: () => Object.fromEntries(apparitions),
  };
}
