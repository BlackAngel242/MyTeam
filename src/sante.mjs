// Santé du bureau (N7) : instantané factuel pour le diagnostic du poste.
//
// Contrat de la route GET /api/sante (jeton exigé), réponse de neuf clés :
//   herdr, herdrVersion, node, journauxTrouves, crise, autonomie,
//   versionChargee, versionDisque, conforme.
// Jamais de chemin, de clé, d'objectif ni de message dans la réponse. La
// route observe seulement : aucun redémarrage, aucun effet de bord.
//
// La version du disque est recalculée au plus toutes les 60 secondes, jamais
// à chaque appel : la machine de DrSmoke a 8 Go de mémoire et la santé doit
// rester légère. Le premier appel vérifie réellement (le bouton « Vérifier »
// de l'interface doit dire vrai la première fois).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { findHerdr } from './herdr.mjs';

const execute = promisify(execFile);
const DELAI_CACHE = 60000;
const DELAI_HERDR = 2000;
const MAX_FICHIERS = 200;
const PROFONDEUR = 3;

// Journaux d'agents connus sur ce poste : on en compte le nombre, on ne dit
// jamais où ils sont.
const racinesJournaux = () => [
  join(homedir(), '.claude', 'projects'),
  join(homedir(), '.claude', 'sessions'),
  join(homedir(), '.codex', 'sessions'),
  join(homedir(), '.local', 'share', 'opencode'),
];

const compterFichiers = (racine, profondeur = 0) => {
  if (profondeur > PROFONDEUR) return 0;
  let entrees;
  try { entrees = readdirSync(racine, { withFileTypes: true }); } catch { return 0; }
  let n = 0;
  for (const entree of entrees.slice(0, MAX_FICHIERS)) {
    n += entree.isFile() ? 1 : entree.isDirectory() ? compterFichiers(join(racine, entree.name), profondeur + 1) : 0;
    if (n >= MAX_FICHIERS) break;
  }
  return n;
};

// La version Herdr est un numéro, pas une sortie libre : aucun chemin ni
// texte de terminal ne peut passer par là.
const propre = texte => Array.from(String(texte).replace(/[\u0000-\u001f\u007f]/g, ' ')).filter(c => /[A-Za-z0-9._+\- ]/.test(c)).slice(0, 40).join('').trim();

export function createSante({
  bridge,
  criseActive = () => false,
  autonomieActive = () => false,
  racine = join(dirname(fileURLToPath(import.meta.url)), '..'),
  maintenant = () => Date.now(),
  delaiCache = DELAI_CACHE,
  delaiHerdr = DELAI_HERDR,
  versionHerdr = null,
  journaux = null,
  compteur = () => {},
} = {}) {
  const fichiers = () => {
    const liste = ['server.mjs'];
    try {
      for (const nom of readdirSync(join(racine, 'src'))) {
        if (nom.endsWith('.mjs')) liste.push(join('src', nom));
      }
    } catch { /* Pas de dossier src/ : l'empreinte reste calculable. */ }
    return liste.sort();
  };
  const empreinte = () => {
    const h = createHash('sha256');
    for (const rel of fichiers()) {
      h.update(rel);
      h.update('\0');
      try { h.update(readFileSync(join(racine, rel))); } catch { h.update('absent'); }
      h.update('\0');
    }
    return h.digest('hex').slice(0, 16);
  };
  // Ce que le serveur a réellement chargé au démarrage : figé une fois.
  const versionChargee = empreinte();
  // Au premier appel, le disque est réellement relu (le bouton « Vérifier »
  // dit vrai la première fois), puis au plus toutes les 60 secondes.
  let cache = { valeur: null, at: maintenant() - delaiCache - 1 };
  const versionDisque = () => {
    const t = maintenant();
    if (t - cache.at < delaiCache && cache.valeur !== null) return cache.valeur;
    compteur();
    cache = { valeur: empreinte(), at: t };
    return cache.valeur;
  };

  const herdrRepond = async () => {
    if (typeof bridge?.list !== 'function') return false;
    // Le minuteur garde la boucle d'événements vivante le temps du délai (un minuteur « unref » laissait un test, ou un
    // processus sans autre activité, s'arrêter avec une promesse en attente) et il est annulé dès que Herdr répond.
    let minuteur;
    const delai = new Promise(resolve => { minuteur = setTimeout(() => resolve(false), delaiHerdr); });
    try {
      return await Promise.race([
        Promise.resolve().then(() => bridge.list()).then(() => true, () => false),
        delai,
      ]);
    } finally { clearTimeout(minuteur); }
  };

  const version = versionHerdr ?? (async () => {
    try {
      const { stdout } = await execute(findHerdr(), ['--version'], { windowsHide: true, timeout: 3000, encoding: 'utf8' });
      return propre(String(stdout).split(/\r?\n/)[0]) || null;
    } catch { return null; }
  });

  const journauxTrouves = async () => {
    try {
      const n = journaux ? await journaux() : racinesJournaux().reduce((total, racineJ) => total + compterFichiers(racineJ), 0);
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    } catch { return 0; }
  };

  async function instantane() {
    const [herdr, versionHerdrCourante, trouves] = await Promise.all([herdrRepond(), version(), journauxTrouves()]);
    const disque = versionDisque();
    return {
      herdr: Boolean(herdr),
      herdrVersion: typeof versionHerdrCourante === 'string' && versionHerdrCourante ? versionHerdrCourante : null,
      node: process.version,
      journauxTrouves: trouves,
      crise: criseActive() === true,
      autonomie: autonomieActive() === true,
      versionChargee,
      versionDisque: disque,
      conforme: versionChargee === disque,
    };
  }

  return { instantane, versionChargee };
}
