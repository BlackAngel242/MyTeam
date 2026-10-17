// File d'attente de consignes côté serveur.
//
// Une consigne écrite à un agent occupé attend ici, puis part automatiquement
// quand l'agent redevient disponible. Règles validées par DrSmoke (docs/plan-file-attente.md) :
// au plus un envoi à la fois par agent, jamais vers un agent bloqué ou inconnu,
// pause de quota respectée (remise à zéro de la limite + 5 minutes), et un envoi
// non confirmé passe « à revoir » sans jamais être renvoyé seul.
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname } from 'node:path';

export class QueueError extends Error {}

const ETATS = ['attente', 'envoyee', 'annulee', 'a_revoir'];
const DELAI_QUOTA = 5 * 60 * 1000;

const iso = ms => new Date(ms).toISOString();
const tronquer = (texte, max) => Array.from(String(texte ?? '')).slice(0, max).join('');

function valider({ id, message, notBefore }) {
  if (typeof id !== 'string' || !id.trim()) throw new QueueError('Sélectionnez un agent.');
  if (typeof message !== 'string' || !message.trim() || message.length > 12000 || message.includes('\0')) {
    throw new QueueError('Écrivez une consigne de 1 à 12 000 caractères, sans caractère nul.');
  }
  let depart = null;
  if (notBefore !== undefined && notBefore !== null && notBefore !== '') {
    const temps = Date.parse(notBefore);
    if (Number.isNaN(temps)) throw new QueueError('La date d\'envoi prévu n\'est pas lisible.');
    depart = iso(temps);
  }
  return { id, message, notBefore: depart };
}

function elementValide(element) {
  return element && typeof element === 'object'
    && typeof element.itemId === 'string' && typeof element.id === 'string'
    && typeof element.message === 'string' && ETATS.includes(element.state);
}

export function createQueue({
  listAgents,
  prompt,
  limitsOf = async () => ({ limitReached: false, resetsAt: null }),  // (id, agents) => {limitReached, resetsAt}
  file,
  now = () => Date.now(),
  maxItems = 20,
  maxPerAgent = 5,
} = {}) {
  if (typeof listAgents !== 'function' || typeof prompt !== 'function' || typeof file !== 'string') {
    throw new QueueError('La file d\'attente est mal configurée.');
  }
  let items = [];
  let compteur = 0;
  let ecriture = Promise.resolve();
  let tour = null;
  let minuterie = null;

  function nouveau({ id, message, notBefore }, etat = 'attente', raison = null) {
    const date = iso(now());
    return { itemId: `q-${now().toString(36)}-${compteur++}-${randomBytes(3).toString('hex')}`, id, message, notBefore, state: etat, createdAt: date, updatedAt: date, sentAt: null, reason: raison };
  }

  function persister() {
    if (typeof file !== 'string' || !file) return;
    const operation = async () => {
      try {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify({ version: 1, items }, null, 2), 'utf8');
      } catch { /* Une persistance en échec ne doit pas perdre la file en mémoire. */ }
    };
    ecriture = ecriture.then(operation, operation);
    return ecriture;
  }

  // Chargement synchrone au démarrage : la file est disponible dès la création,
  // sans course entre la construction et la première lecture.
  try {
    const brut = JSON.parse(readFileSync(file, 'utf8'));
    if (brut && brut.version === 1 && Array.isArray(brut.items)) items = brut.items.filter(elementValide).slice(-maxItems);
  } catch { /* Fichier absent ou illisible : on repart d'une file vide. */ }

  function publique(element) {
    return structuredClone(element);
  }

  async function enqueue(entree) {
    const valide = valider(entree ?? {});
    if (items.some(element => element.state === 'attente' && element.id === valide.id && element.message === valide.message)) {
      throw new QueueError('Cette consigne est déjà en file.');
    }
    if (items.filter(element => element.state === 'attente' && element.id === valide.id).length >= maxPerAgent) {
      throw new QueueError(`Cet agent a déjà ${maxPerAgent} consignes en attente.`);
    }
    while (items.length >= maxItems) {
      const ancien = items.findIndex(element => element.state !== 'attente');
      if (ancien === -1) break;
      items.splice(ancien, 1);
    }
    if (items.length >= maxItems) throw new QueueError(`La file d'attente est pleine (${maxItems} éléments au maximum).`);
    const element = nouveau(valide);
    items.push(element);
    await persister();
    return publique(element);
  }

  async function cancel(itemId) {
    const element = items.find(candidate => candidate.itemId === itemId);
    if (!element || element.state !== 'attente') throw new QueueError('Cette consigne n\'est plus annulable.');
    element.state = 'annulee';
    element.reason = 'Annulée depuis le bureau.';
    element.updatedAt = iso(now());
    await persister();
    return publique(element);
  }

  function list() {
    return { items: [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.itemId.localeCompare(b.itemId)).map(publique) };
  }

  async function tick() {
    if (tour) return tour;
    const execution = async () => {
      const envoyes = [];
      const revoirs = [];
      const agents = new Map((await listAgents()).filter(agent => agent && typeof agent.id === 'string').map(agent => [agent.id, agent]));
      const pauses = new Map();
      const pauseDe = async id => {
        if (!pauses.has(id)) {
          pauses.set(id, Promise.resolve(limitsOf(id, agents)).then(
            valeur => ({ limitReached: valeur?.limitReached === true, resetsAt: typeof valeur?.resetsAt === 'string' ? Date.parse(valeur.resetsAt) : NaN }),
            () => ({ limitReached: false, resetsAt: NaN }),
          ));
        }
        return pauses.get(id);
      };
      // Une cible disparue est signalée tout entière : rien ne partira vers elle.
      for (const element of items.filter(candidate => candidate.state === 'attente')) {
        if (!agents.has(element.id)) {
          element.state = 'a_revoir';
          element.reason = 'La cible a changé, revoyez cette consigne.';
          element.updatedAt = iso(now());
          revoirs.push(element);
        }
      }
      for (const id of new Set(items.filter(candidate => candidate.state === 'attente').map(candidate => candidate.id))) {
        const agent = agents.get(id);
        if (!agent || !['idle', 'done'].includes(agent.status) || agent.ready !== true) continue;
        const pause = await pauseDe(id);
        const attente = items.filter(candidate => candidate.state === 'attente' && candidate.id === id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.itemId.localeCompare(b.itemId));
        for (const element of attente) {
          const depart = element.notBefore ? Date.parse(element.notBefore) : 0;
          if (pause.limitReached) {
            // Pause de quota : remise à zéro de la limite + 5 minutes. Sans date
            // de remise à zéro connue, on n'envoie jamais sans être sûr.
            if (Number.isNaN(pause.resetsAt)) break;
            if (now() < pause.resetsAt + DELAI_QUOTA) break;
          }
          if (now() < depart) continue;
          try {
            await prompt(element.id, element.message);
            element.state = 'envoyee';
            element.sentAt = iso(now());
            element.updatedAt = element.sentAt;
            envoyes.push(element);
          } catch (error) {
            // Envoi non confirmé : « à revoir », jamais renvoyé seul.
            element.state = 'a_revoir';
            element.reason = tronquer(error?.message || 'L\'envoi n\'a pas été confirmé.', 200);
            element.updatedAt = iso(now());
            revoirs.push(element);
          }
          break;
        }
      }
      if (envoyes.length || revoirs.length) await persister();
      return { sent: envoyes.map(publique), skipped: revoirs.map(publique) };
    };
    tour = execution().finally(() => { tour = null; });
    return tour;
  }

  function start(intervalMs = 15000) {
    stop();
    minuterie = setInterval(() => { tick().catch(() => {}); }, intervalMs);
    minuterie.unref?.();
    return minuterie;
  }
  function stop() {
    if (minuterie) clearInterval(minuterie);
    minuterie = null;
  }

  return { enqueue, cancel, list, tick, start, stop };
}
