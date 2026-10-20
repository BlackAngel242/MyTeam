// File d'attente de consignes côté serveur.
//
// Une consigne écrite à un agent occupé attend ici, puis part automatiquement
// quand l'agent redevient disponible. Règles validées par DrSmoke (docs/plan-file-attente.md)
// et renforcées par la revue croisée (docs/revue-codex-file.md) :
// au plus un envoi à la fois par agent, jamais vers un agent bloqué ou inconnu,
// pause de quota respectée (remise à zéro de la limite + 5 minutes) et MÉMORISÉE,
// envoi marqué « envoi en cours » de façon durable AVANT tout appel externe,
// un envoi non confirmé passe « à revoir » sans jamais être renvoyé seul, et une
// panne de contrôle de quota n'autorise jamais l'envoi automatique.
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, posix, win32 } from 'node:path';

export class QueueError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const ETATS = ['attente', 'envoi_en_cours', 'envoyee', 'annulee', 'a_revoir'];
const DELAI_QUOTA = 5 * 60 * 1000;
// Budget commun en octets UTF-8 de la sauvegarde, employé des deux côtés : la
// lecture refuse d'aller au-delà, et l'ajout d'une consigne est refusé avant
// acceptation s'il ferait dépasser ce budget. Un fichier écrit est donc
// toujours relisible après un redémarrage.
const MAX_FICHIER = 512 * 1024;
// Limite de reprise : un fichier déjà trop gros n'est pas vidé en silence, il
// est relu au-delà du budget pour récupérer ce qu'il contient, avec alerte.
const MAX_REPRISE = 8 * MAX_FICHIER;
const MAX_CLES = 200;            // clés de demande conservées (distinct des éléments)
const PRIORITES = ['haute', 'normale'];
const ATTENTE_HUMAINE = 'En attente : action requise dans Herdr.';
const DELAI_PRIORITE = 30 * 60 * 1000;  // une normale attendue depuis 30 min rejoint le rang des hautes

const iso = ms => new Date(ms).toISOString();
const tronquer = (texte, max) => Array.from(String(texte ?? '')).slice(0, max).join('');
const dateLisible = valeur => (typeof valeur === 'string' && !Number.isNaN(Date.parse(valeur))) ? iso(Date.parse(valeur)) : null;

function validerFichiers(files = []) {
  if (!Array.isArray(files) || files.length > 2) throw new QueueError('Choisissez au maximum deux fichiers de 20 Mo chacun.');
  return files.map(file => {
    const root = file?.root, path = file?.path;
    if (typeof root !== 'string' || root.length > 240 || !/^(?:bureau|documents|telechargements|agent:[^\\/\u0000-\u001f]+)$/.test(root) ||
      typeof path !== 'string' || !path || path.length > 1024 || /[\u0000-\u001f]/.test(path) ||
      posix.isAbsolute(path) || win32.isAbsolute(path) || /^[a-z]:/i.test(path) || path.split(/[\\/]/).includes('..')) {
      throw new QueueError('Choisissez un fichier dans un lieu autorisé avec un chemin relatif.');
    }
    return { root, path };
  });
}

const nomCopie = name => typeof name === 'string' && name.length > 0 && name.length <= 255 &&
  name !== '.' && name !== '..' && !/[\u0000-\u001f]/.test(name) && posix.basename(name) === name && win32.basename(name) === name && !/^[a-z]:/i.test(name);
const copieObservee = file => ({name:file.name,
  ...(dateLisible(file.at)?{at:dateLisible(file.at)}:{}),
  ...(typeof file.cwdTag==='string'&&/^[0-9a-f]{64}$/.test(file.cwdTag)?{cwdTag:file.cwdTag}:{}),
});

function valider({ id, message, notBefore, requestKey, priority, files }) {
  if (typeof id !== 'string' || !id.trim() || id.length > 200) throw new QueueError('Sélectionnez un agent.');
  if (typeof message !== 'string' || !message.trim() || message.length > 12000 || message.includes('\0')) {
    throw new QueueError('Écrivez une consigne de 1 à 12 000 caractères, sans caractère nul.');
  }
  let depart = null;
  if (notBefore !== undefined && notBefore !== null && notBefore !== '') {
    const temps = Date.parse(notBefore);
    if (Number.isNaN(temps)) throw new QueueError('La date d\'envoi prévu n\'est pas lisible.');
    depart = iso(temps);
  }
  let cle = null;
  if (requestKey !== undefined && requestKey !== null && requestKey !== '') {
    if (typeof requestKey !== 'string' || requestKey.length > 64 || /[\u0000-\u001f]/.test(requestKey)) {
      throw new QueueError('La clé de demande n\'est pas lisible.');
    }
    cle = requestKey;
  }
  if (priority !== undefined && priority !== null && priority !== '' && !PRIORITES.includes(priority)) {
    throw new QueueError('La priorité doit être « haute » ou « normale ».');
  }
  return { id, message, notBefore: depart, requestKey: cle, priority: priority || 'normale', files: validerFichiers(files) };
}

// Restauration : seule une liste blanche de champs est gardée, avec les mêmes
// règles qu'à l'ajout. Une échéance illisible produit une alerte et un état sans
// envoi, jamais une date immédiate.
function restaurer(brut) {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const id = typeof brut.id === 'string' && brut.id.trim() && brut.id.length <= 200 ? brut.id : null;
  const message = typeof brut.message === 'string' && brut.message.trim() && !brut.message.includes('\0')
    ? tronquer(brut.message, 12000) : null;
  if (!id || !message) return { probleme: 'structure' };
  const state = ETATS.includes(brut.state) ? brut.state : 'a_revoir';
  const createdAt = dateLisible(brut.createdAt) ?? iso(Date.parse(brut.updatedAt) || Date.now());
  const element = {
    itemId: typeof brut.itemId === 'string' && brut.itemId.length <= 128 ? brut.itemId : `q-restaure-${randomBytes(4).toString('hex')}`,
    id,
    message,
    notBefore: null,
    priority: PRIORITES.includes(brut.priority) ? brut.priority : 'normale',
    state,
    createdAt,
    updatedAt: dateLisible(brut.updatedAt) ?? createdAt,
    sentAt: dateLisible(brut.sentAt),
    reason: typeof brut.reason === 'string' ? tronquer(brut.reason, 200) : null,
    holdUntil: null,
    requestKey: typeof brut.requestKey === 'string' && brut.requestKey.length <= 64 ? brut.requestKey : null,
    files: [], copiedFiles: [],
  };
  let probleme = null;
  try {
    element.files = validerFichiers(brut.files);
    if (brut.copiedFiles !== undefined) {
      if (!Array.isArray(brut.copiedFiles) || brut.copiedFiles.length > 2 || brut.copiedFiles.some(file => !nomCopie(file?.name))) throw new Error();
      element.copiedFiles = brut.copiedFiles.map(copieObservee);
    }
    if (state === 'attente' && element.copiedFiles.length) throw new Error();
  } catch {
    element.files = []; element.copiedFiles = [];
    element.state = 'a_revoir';
    element.reason = 'Les fichiers joints ne sont plus fiables : revoyez cette consigne.';
  }
  if (brut.notBefore !== undefined && brut.notBefore !== null && brut.notBefore !== '') {
    const date = dateLisible(brut.notBefore);
    if (date) element.notBefore = date;
    else { probleme = 'La date d\'envoi prévu n\'est pas lisible : revoyez cette consigne.'; }
  }
  if (brut.holdUntil !== undefined && brut.holdUntil !== null && brut.holdUntil !== '') {
    const date = dateLisible(brut.holdUntil);
    if (date) element.holdUntil = date;
  }
  // Un envoi commencé dont on ne connaît pas l'issue ne repart jamais seul.
  if (element.state === 'envoi_en_cours') {
    element.state = 'a_revoir';
    element.reason = 'Envoi non confirmé : revoyez cette consigne.';
    probleme = null;
  }
  if (probleme && element.state === 'attente') {
    element.state = 'a_revoir';
    element.reason = probleme;
  }
  return { element, probleme };
}

export function createQueue({
  listAgents,
  prompt,
  limitsOf = async () => ({ limitReached: false, resetsAt: null }),  // (id, listeAgents) => {limitReached, resetsAt}
  file,
  now = () => Date.now(),
  maxItems = 20,
  maxPerAgent = 5,
  prepareFiles = async () => { throw new QueueError('La copie des fichiers est indisponible.'); },
  locked = () => false,  // salle de crise : vrai bloque tous les envois de tick()
} = {}) {
  if (typeof listAgents !== 'function' || typeof prompt !== 'function' || typeof file !== 'string') {
    throw new QueueError('La file d\'attente est mal configurée.');
  }
  let items = [];
  const cles = new Map();
  let corruption = null;
  let alerte = null;   // récupération visible : fichier devenu trop gros, rien n'est vidé en silence
  let compteur = 0;
  let ecriture = Promise.resolve();
  let tour = null;
  let minuterie = null;

  function nouveau({ id, message, notBefore, requestKey, priority, files }, etat = 'attente', raison = null) {
    const date = iso(now());
    return { itemId: `q-${now().toString(36)}-${compteur++}-${randomBytes(3).toString('hex')}`, id, message, notBefore, priority: priority || 'normale', state: etat, createdAt: date, updatedAt: date, sentAt: null, reason: raison, holdUntil: null, requestKey, files, copiedFiles: [] };
  }

  function publique(element) {
    const result = structuredClone(element);
    result.copiedFiles = (result.copiedFiles??[]).map(file => ({name:file.name}));
    return result;
  }

  // Ordre réel d'envoi : priorité haute d'abord (et une normale en attente
  // depuis plus de 30 minutes rejoint ce rang, à ancienneté égale), puis
  // l'ancienneté. La priorité ne change rien aux règles de disponibilité.
  function ordreEnvoi(a, b) {
    const rang = element => (element.priority === 'haute' || now() - Date.parse(element.createdAt) > DELAI_PRIORITE) ? 0 : 1;
    return rang(a) - rang(b) || a.createdAt.localeCompare(b.createdAt) || a.itemId.localeCompare(b.itemId);
  }

  // Même texte pour mesurer et pour écrire : le budget est calculé sur
  // exactement ce qui part sur le disque.
  const texteSauvegarde = (listeItems, entrees) =>
    JSON.stringify({ version: 2, items: listeItems, cles: [...entrees].map(([key, valeur]) => ({ key, ...valeur })) }, null, 2);

  // Écriture atomique : fichier temporaire puis remplacement. Une erreur de
  // sauvegarde est signalée à l'appelant, jamais avalée.
  function persister() {
    const operation = async () => {
      await mkdir(dirname(file), { recursive: true });
      if (corruption !== null) {
        // Le fichier d'origine est préservé pour diagnostic avant d'être remplacé.
        try { await writeFile(`${file}.corrompu`, corruption, { flag: 'wx', encoding: 'utf8' }); } catch { /* déjà préservé */ }
        corruption = null;
      }
      const temporaire = `${file}.tmp`;
      const texte = texteSauvegarde(items, cles);
      // Dernière barrière : on ne écrit jamais un fichier que la lecture ne
      // pourrait pas reprendre. Aucun chemin de travail normal ne l'atteint.
      if (Buffer.byteLength(texte, 'utf8') > MAX_REPRISE) {
        throw new QueueError(`Sauvegarde impossible : la file dépasserait les ${MAX_REPRISE} octets que l’on sait relire.`, 500);
      }
      await writeFile(temporaire, texte, 'utf8');
      await rename(temporaire, file);
      // Une sauvegarde revenue dans le budget résout l'alerte de récupération.
      alerte = Buffer.byteLength(texte, 'utf8') > MAX_FICHIER ? alerte : null;
    };
    const suite = ecriture.then(operation, operation);
    ecriture = suite.catch(() => {});
    return suite;
  }

  // Chargement synchrone au démarrage : la file est disponible dès la création.
  try {
    if (existsSync(file)) {
      const taille = statSync(file).size;
      // Un fichier au-delà du budget n'est pas abandonné : on le relit tant
      // qu'il tient dans la limite de reprise, puis on signale ce qui reste.
      const tropGros = taille > MAX_FICHIER;
      const brutTexte = taille > MAX_REPRISE ? null : readFileSync(file, 'utf8');
      if (brutTexte === null) {
        corruption = 'Fichier trop grand pour être lu.';
        alerte = {
          type: 'fichier-trop-gros', taille, budget: MAX_FICHIER, relues: 0, conservees: 0,
          message: `Le fichier de la file d’attente fait ${taille} octets, au-delà des ${MAX_REPRISE} que l’on sait relire : aucune consigne restaurée.`,
        };
      } else {
        let forme = null;
        try { forme = JSON.parse(brutTexte); } catch { forme = null; }
        if (!forme || (forme.version !== 1 && forme.version !== 2) || !Array.isArray(forme.items)) {
          corruption = brutTexte;
          if (tropGros) alerte = {
            type: 'fichier-trop-gros', taille, budget: MAX_FICHIER, relues: 0, conservees: 0,
            message: `Le fichier de la file d’attente fait ${taille} octets, au-dessus des ${MAX_FICHIER} prévus, et son contenu n’est pas lisible : aucune consigne restaurée.`,
          };
        } else {
          const problemes = [];
          for (const brut of forme.items.slice(-maxItems)) {
            const restaure = restaurer(brut);
            if (!restaure) continue;
            if (restaure.probleme === 'structure') { problemes.push('structure'); continue; }
            if (restaure.probleme) problemes.push(restaure.probleme);
            items.push(restaure.element);
          }
          // Plafonds par cible : le trop-plein passe « à revoir », sans envoi.
          const vus = new Map();
          for (const element of items) {
            if (element.state !== 'attente') continue;
            const compte = (vus.get(element.id) ?? 0) + 1;
            vus.set(element.id, compte);
            if (compte > maxPerAgent) {
              element.state = 'a_revoir';
              element.reason = `Trop de consignes en attente pour cet agent (maximum ${maxPerAgent}).`;
            }
          }
          if (Array.isArray(forme.cles)) {
            for (const entree of forme.cles.slice(-MAX_CLES)) {
              if (entree && typeof entree.key === 'string' && typeof entree.itemId === 'string') {
                cles.set(entree.key, { itemId: entree.itemId, state: ETATS.includes(entree.state) ? entree.state : 'a_revoir', at: dateLisible(entree.at) ?? iso(now()) });
              }
            }
          }
          if (problemes.length) corruption = brutTexte;
          if (tropGros) alerte = {
            type: 'fichier-trop-gros', taille, budget: MAX_FICHIER,
            relues: forme.items.length, conservees: items.length,
            message: `Le fichier de la file d’attente fait ${taille} octets, au-dessus des ${MAX_FICHIER} prévus : ${items.length} consignes gardées sur ${forme.items.length} relues.`,
          };
        }
      }
    }
  } catch (error) {
    if (existsSync(file)) {
      try { corruption = readFileSync(file, 'utf8').slice(0, MAX_FICHIER); } catch { corruption = 'Fichier illisible.'; }
    }
  }

  async function enqueue(entree, { allowRepeatedMessage = false } = {}) {
    const valide = valider(entree ?? {});
    if (allowRepeatedMessage === true && !valide.requestKey) {
      throw new QueueError('Un événement interne exige une clé de demande.');
    }
    // Une répétition de la même clé de demande retrouve le résultat existant,
    // même après envoi ou redémarrage : jamais un second envoi.
    if (valide.requestKey && cles.has(valide.requestKey)) {
      const connu = cles.get(valide.requestKey);
      const existant = items.find(element => element.itemId === connu.itemId);
      return publique(existant ?? {
        itemId: connu.itemId, id: valide.id, message: valide.message, notBefore: valide.notBefore,
        state: connu.state, createdAt: connu.at, updatedAt: connu.at, sentAt: null,
        reason: 'Consigne déjà traitée (clé de demande déjà utilisée).', holdUntil: null, requestKey: valide.requestKey,
        priority: valide.priority, files: valide.files, copiedFiles: [],
      });
    }
    // Une consigne identique reste refusée. Seuls les événements internes munis
    // de clés distinctes peuvent répéter leur texte ; les clés restent dédupliquées.
    if (allowRepeatedMessage !== true && items.some(element => ['attente', 'envoi_en_cours', 'envoyee'].includes(element.state)
      && element.id === valide.id && element.message === valide.message && JSON.stringify(element.files) === JSON.stringify(valide.files))) {
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
    // Refus avant acceptation : rien n'est mis en file à moitié. La mesure se
    // fait sur le texte qui serait réellement écrit, message et fichiers joints
    // compris, et sans l'éviction des clés (mesure à la hausse).
    const futuresCles = new Map(cles);
    if (valide.requestKey) futuresCles.set(valide.requestKey, { itemId: element.itemId, state: element.state, at: element.updatedAt });
    if (Buffer.byteLength(texteSauvegarde([...items, element], futuresCles), 'utf8') > MAX_FICHIER) {
      throw new QueueError(`La file d’attente ne peut pas garder cette consigne : la sauvegarde dépasserait ${MAX_FICHIER} octets (512 Ko) et ne pourrait plus être relue après un redémarrage. Raccourcissez le message ou libérez de la place en annulant des consignes.`);
    }
    items.push(element);
    if (valide.requestKey) {
      cles.set(valide.requestKey, { itemId: element.itemId, state: element.state, at: element.updatedAt });
      while (cles.size > MAX_CLES) cles.delete(cles.keys().next().value);
    }
    try {
      await persister();
    } catch {
      items.splice(items.indexOf(element), 1);
      if (valide.requestKey) cles.delete(valide.requestKey);
      throw new QueueError('Sauvegarde impossible : la consigne n\'a pas été gardée.');
    }
    return publique(element);
  }

  async function cancel(itemId) {
    const element = items.find(candidate => candidate.itemId === itemId);
    // Un envoi commencé ne peut plus être retiré : la consigne peut être reçue.
    if (!element || element.state !== 'attente') throw new QueueError('Cette consigne n\'est plus annulable.');
    element.state = 'annulee';
    element.reason = 'Annulée depuis le bureau.';
    element.updatedAt = iso(now());
    try {
      await persister();
    } catch {
      element.state = 'attente';
      element.reason = null;
      throw new QueueError('Sauvegarde impossible : l\'annulation n\'a pas été gardée.');
    }
    return publique(element);
  }

  async function prioritize(itemId, priority) {
    if (!PRIORITES.includes(priority)) throw new QueueError('La priorité doit être « haute » ou « normale ».');
    // Une requête mal formée est une erreur de saisie : le 409 est réservé aux
    // consignes qui existent mais ne sont plus en attente.
    if (typeof itemId !== 'string' || !itemId.trim()) throw new QueueError('Sélectionnez une consigne.');
    const element = items.find(candidate => candidate.itemId === itemId);
    // Seule une consigne encore en attente change de priorité : le reste est déjà joué.
    if (!element || element.state !== 'attente') throw new QueueError('Seule une consigne encore en attente change de priorité.', 409);
    const avant = element.priority;
    element.priority = priority;
    element.updatedAt = iso(now());
    try {
      await persister();
    } catch {
      element.priority = avant;
      throw new QueueError('Sauvegarde impossible : la priorité n\'a pas été gardée.', 500);
    }
    return publique(element);
  }

  function list({fileFacts=false}={}) {
    const sortie = { items: [...items].sort(ordreEnvoi).map(element=>fileFacts?structuredClone(element):publique(element)) };
    // Fait observé au démarrage : un fichier devenu trop gros est signalé
    // (taille et compteurs seuls, jamais le contenu ni le chemin).
    if (alerte) sortie.alerte = structuredClone(alerte);
    return sortie;
  }

  async function tick() {
    if (tour) return tour;
    const execution = async () => {
      const envoyes = [];
      const revoirs = [];
      const liste = (await listAgents()).filter(agent => agent && typeof agent.id === 'string');
      const agents = new Map(liste.map(agent => [agent.id, agent]));
      const pauses = new Map();
      // Une panne du contrôle de quota n'est JAMAIS une absence de limite :
      // elle gèle l'envoi automatique jusqu'à un contrôle valable.
      const pauseDe = async id => {
        if (!pauses.has(id)) {
          pauses.set(id, Promise.resolve().then(() => limitsOf(id, liste)).then(
            valeur => ({ limitReached: valeur?.limitReached === true, resetsAt: typeof valeur?.resetsAt === 'string' ? Date.parse(valeur.resetsAt) : NaN, incertain: false }),
            () => ({ limitReached: false, resetsAt: NaN, incertain: true }),
          ));
        }
        return pauses.get(id);
      };
      let modifie = false;
      // Une cible disparue est signalée tout entière : rien ne partira vers elle.
      for (const element of items.filter(candidate => candidate.state === 'attente')) {
        if (!agents.has(element.id)) {
          element.state = 'a_revoir';
          element.reason = 'La cible a changé, revoyez cette consigne.';
          element.updatedAt = iso(now());
          modifie = true;
          revoirs.push(element);
        }
      }
      for (const id of new Set(items.filter(candidate => candidate.state === 'attente').map(candidate => candidate.id))) {
        const agent = agents.get(id);
        const attente = items.filter(candidate => candidate.state === 'attente' && candidate.id === id)
          .sort(ordreEnvoi);
        // Le motif décrit la dernière observation du panneau ; aucun envoi ne part tant que la cible n'est pas prête.
        for (const element of attente) {
          const raison = agent?.needsUserAttention ? ATTENTE_HUMAINE : element.reason === ATTENTE_HUMAINE ? null : element.reason;
          if (raison !== element.reason) { element.reason = raison; element.updatedAt = iso(now()); modifie = true; }
        }
        if (!agent || !['idle', 'done'].includes(agent.status) || agent.ready !== true) continue;
        const pause = await pauseDe(id);
        if (pause.incertain) continue;   // contrôle en panne : aucun envoi automatique
        if (pause.limitReached && Number.isNaN(pause.resetsAt)) continue;  // pause sans date : jamais forcée
        if (pause.limitReached && !Number.isNaN(pause.resetsAt)) {
          // Fin de pause mémorisée sur chaque consigne : remise à zéro + 5 minutes.
          // Elle reste valable même quand le signal de quota disparaît.
          const fin = pause.resetsAt + DELAI_QUOTA;
          for (const element of attente) {
            const connue = element.holdUntil ? Date.parse(element.holdUntil) : 0;
            if (!(connue >= fin)) {
              element.holdUntil = iso(fin);
              element.updatedAt = iso(now());
              modifie = true;
            }
          }
          if (now() < fin) continue;  // pause encore en cours : rien ne part ce tour
        }
        for (const element of attente) {
          // Salle de crise : rien ne part, la file garde ses consignes en attente.
          if (locked()) break;
          const target = { ...agent };
          const depart = element.notBefore ? Date.parse(element.notBefore) : 0;
          const relance = element.holdUntil ? Date.parse(element.holdUntil) : 0;
          if (now() < Math.max(depart, relance)) continue;
          // État durable AVANT tout appel externe : une reprise après un crash
          // verra « envoi en cours » et ne renverra jamais la consigne.
          element.state = 'envoi_en_cours';
          element.reason = null;
          element.updatedAt = iso(now());
          modifie = true;
          try {
            await persister();
          } catch {
            element.state = 'attente';
            element.reason = 'Sauvegarde impossible, envoi reporté.';
            element.updatedAt = iso(now());
            continue;
          }
          try {
            let message = element.message;
            if (element.files.length) {
              const copies = await prepareFiles(element,target);
              if (!Array.isArray(copies) || copies.length !== element.files.length || copies.some(file => !nomCopie(file?.name))) {
                throw new QueueError('La copie des fichiers n’a pas été confirmée.');
              }
              element.copiedFiles = copies.map(copieObservee);
              message += '\n\nFichiers copiés dans ton dossier de travail :\n' + element.copiedFiles.map(file => '- '+JSON.stringify(file.name)).join('\n');
              if (message.length > 12000) throw new QueueError('La consigne avec les noms de fichiers dépasse 12 000 caractères.');
              await persister();
              // La copie peut prendre du temps : revérifier quota et cible sur
              // une seule lecture, pour ne pas demander deux fois la liste à
              // Herdr pour le même contrôle. Le contrôle final juste avant
              // l'envoi reste en place plus bas.
              const recheck = await listAgents();
              const limit = await limitsOf(element.id,recheck);
              if (limit?.limitReached === true) throw new QueueError('Une limite est apparue après la copie : revoyez cette consigne.');
              const current = recheck.find(candidate => candidate.id === element.id);
              if (!current || !['idle','done'].includes(current.status) || current.ready !== true || current.cwd !== target.cwd || current.kind !== target.kind || current.sessionId !== target.sessionId) {
                throw new QueueError('La cible a changé ou n’est plus disponible après la copie.');
              }
            }
            // Vérifié juste avant l'envoi : la cible peut être devenue occupée
            // pendant la sauvegarde ou la copie. Une panne de lecture retarde
            // l'envoi au lieu de la rejeter : attendre n'est pas une erreur.
            let courant = null;
            try {
              courant = (await listAgents()).find(candidate => candidate && candidate.id === element.id);
            } catch { courant = null; }
            if (!courant || !['idle', 'done'].includes(courant.status) || courant.ready !== true
              || courant.cwd !== target.cwd || courant.kind !== target.kind || courant.sessionId !== target.sessionId) {
              element.state = 'attente';
              element.reason = null;
              element.updatedAt = iso(now());
              modifie = true;
              break;
            }
            // Vérifié juste avant l'envoi : la crise peut être déclenchée pendant la copie.
            if (locked()) {
              element.state = 'attente';
              element.reason = null;
              element.updatedAt = iso(now());
              modifie = true;
              break;
            }
            await prompt(element.id, message);
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
          if (element.requestKey && cles.has(element.requestKey)) {
            cles.get(element.requestKey).state = element.state;
          }
          modifie = true;
          break;
        }
      }
      if (modifie) await persister();
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

  return { enqueue, cancel, prioritize, list, tick, start, stop };
}
