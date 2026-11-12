// Délégations observées dans le journal Claude du chef.
//
// On lit le même journal que src/claude-activity.mjs, avec les mêmes protections :
// identifiant validé par motif, refus des liens symboliques, lecture incrémentale
// par morceaux, plafonds de taille, cache borné, aucun chemin ni contenu de journal
// ne sort de ce module. Seuls sortent : id, at, target, title (80 caractères max)
// et result (type de 40 caractères max).
import { createReadStream } from 'node:fs';
import { lstat, opendir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { masque } from './masque.mjs';
import { completeLines, findTranscript } from './jsonl.mjs';

const MAX_BYTES = 50 * 1024 * 1024;      // octets lus au plus par appel
const MAX_LINE = 4 * 1024 * 1024;        // une ligne plus longue est ignorée
const MAX_DELEGATIONS = 200;             // délégations conservées (les plus récentes)
const MAX_TITLE = 80;

const cache = new Map();
const paths = new Map();
const inflight = new Map();

function remember(map, key, value, limit) {
  map.delete(key);
  map.set(key, value);
  if (map.size > limit) map.delete(map.keys().next().value);
}

async function transcriptInfo(path, root) {
  for (let directory = dirname(path); ; directory = dirname(directory)) {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) return undefined;
    if (directory === root) break;
    if (dirname(directory) === directory) return undefined;
  }
  const info = await lstat(path);
  return info.isFile() && !info.isSymbolicLink() ? info : undefined;
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n');
}

function readable(text) {
  const sansAnsi = text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
  return sansAnsi.replace(/\s+/g, ' ').trim();
}

// Les plafonds de longueur ne sont pas une protection : un chemin court reste
// lisible. On applique donc le masque public unique (chemins avec espaces,
// secrets, identifiants ; adresses web et routes /api intactes), puis on
// réduit le marqueur de chemin à « … » pour garder un titre bref.
function masquerChemins(texte) {
  return masque(texte).replaceAll('[chemin masqué]', '…');
}

// Un titre n'est JAMAIS la consigne complète : même courte, elle est coupée d'au
// moins un caractère. 80 caractères au plus, chemins masqués.
function titreDe(message) {
  const caracteres = Array.from(masquerChemins(readable(message)));
  if (caracteres.length < 2) return null;
  return caracteres.slice(0, Math.min(MAX_TITLE, caracteres.length - 1)).join('');
}

// Découpe une commande en mots en respectant les guillemets des shells.
// literal est faux dès qu'un mot contient une variable ou une substitution :
// dans ce cas la consigne n'est pas « en clair » et son titre reste null.
function tokenize(command) {
  const words = [];
  const n = command.length;
  let i = 0;
  while (i < n) {
    const c = command[i];
    if (/\s/.test(c)) { i++; continue; }
    if (';&|()'.includes(c)) {
      if ((c === '&' || c === '|') && command[i + 1] === c) { words.push({ text: c + c, literal: true }); i += 2; }
      else { words.push({ text: c, literal: true }); i++; }
      continue;
    }
    let text = '';
    let literal = true;
    while (i < n) {
      const d = command[i];
      if (d === "'") {
        i++;
        while (i < n && command[i] !== "'") { text += command[i]; i++; }
        i++;
        continue;
      }
      if (d === '"') {
        i++;
        while (i < n && command[i] !== '"') {
          const e = command[i];
          if ((e === '\\' || e === '`') && i + 1 < n && '"\\$`'.includes(command[i + 1])) { text += command[i + 1]; i += 2; continue; }
          if (e === '$' || e === '`') literal = false;
          text += e;
          i++;
        }
        i++;
        continue;
      }
      if (/\s/.test(d) || ';&|()'.includes(d)) break;
      if (d === '$' || d === '`') literal = false;
      text += d;
      i++;
    }
    words.push({ text, literal });
  }
  return words;
}

function isHerdrToken(text) {
  return /^(?:.*[\\/])?herdr(\.exe)?$/i.test(text);
}

// Une variable dont la valeur se termine par herdr ou herdr.exe peut être
// invoquée plus loin : `H="$HOME/.herdr/.../herdr.exe"; "$H" agent prompt ...`.
function estExecutable(mot, variables) {
  if (isHerdrToken(mot)) return true;
  const appel = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?$/.exec(mot);
  if (!appel) return false;
  const valeur = variables.get(appel[1]);
  return typeof valeur === 'string' && /(?:^|[\\/])herdr(\.exe)?$/i.test(valeur.trim());
}

// Une cible valide ressemble à un panneau (w5:p4) ou à un nom d'agent, jamais à
// une option ni à un chemin. Le module ne connaît pas la liste des agents : la
// validation reste celle de la forme, le serveur peut revalider.
const CIBLE = /^[A-Za-z0-9_.:-]{1,120}$/;
// Séparateurs du shell : après eux commence une nouvelle commande.
const SEPARATEURS = [';', '&&', '||', '|', '&', '('];
// Déclarations de variables qui ne sont pas des commandes.
const DECLARATIONS = ['export', 'declare', 'local', 'readonly', 'unset'];

// Reconnaît `herdr ... agent prompt <cible> <message>` UNIQUEMENT en début de
// commande du shell ou juste après un séparateur : un exemple imprimé par echo,
// une commande d'aide (--help) ou un appel sans consigne ne prouve aucun envoi.
// Une commande peut porter plusieurs ordres : chacun est renvoyé séparément.
function parseDelegations(command) {
  const words = tokenize(command);
  const variables = new Map();
  const trouvees = [];
  let debut = 0;
  for (let h = 0; h < words.length; h++) {
    const mot = words[h].text;
    const affectation = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(mot);
    if (affectation) {
      variables.set(affectation[1], affectation[2]);
      if (h === debut) debut = h + 1;   // une affectation n'est pas une commande
      continue;
    }
    if (SEPARATEURS.includes(mot)) { debut = h + 1; continue; }
    if (h === debut && DECLARATIONS.includes(mot.toLowerCase())) { debut = h + 1; continue; }
    if (h !== debut || !estExecutable(mot, variables)) continue;
    const segment = words.slice(h);
    if (segment.some(palier => ['--help', '-h', 'help', '/?'].includes(palier.text))) continue;
    let i = 1;
    // Options éventuelles avant la sous-commande, par exemple --session nom.
    while (i < segment.length && segment[i].text.startsWith('-')) {
      i++;
      if (i < segment.length && !segment[i].text.startsWith('-') && segment[i].text.toLowerCase() !== 'agent') i++;
    }
    if (segment[i]?.text.toLowerCase() !== 'agent' || segment[i + 1]?.text.toLowerCase() !== 'prompt') continue;
    const cible = segment[i + 2];
    if (!cible || !cible.literal || !CIBLE.test(cible.text) || cible.text.startsWith('-')) continue;
    const message = [];
    for (let j = i + 3; j < segment.length; j++) {
      const motMessage = segment[j];
      if (SEPARATEURS.includes(motMessage.text)) break;
      message.push(motMessage);
    }
    if (message.length === 0) continue;
    const titre = message.every(motMessage => motMessage.literal) ? titreDe(message.map(motMessage => motMessage.text).join(' ')) : null;
    trouvees.push({ target: cible.text, title: titre });
  }
  return trouvees;
}

// Liste fermée des issues observées : un succès exige la confirmation positive
// agent_prompted. Un texte ambigu ou agent_prompt_stalled reste INCONNU (ok:null).
const ISSUES = ['agent_prompted', 'agent_prompt_stalled'];

function outcomeOf(block) {
  const text = textOf(block.content);
  let json = null;
  try { json = JSON.parse(text); } catch { /* Le résultat n'est pas du JSON. */ }
  const erreur = block.is_error === true
    || (json !== null && typeof json === 'object' && !Array.isArray(json) && Object.hasOwn(json, 'error'));
  const marqueur = text.match(/agent_prompt_[a-z_]+/)?.[0] ?? null;
  const connu = ISSUES.includes(marqueur) ? marqueur
    : ISSUES.includes(json?.result?.type) ? json.result.type
      : ISSUES.includes(json?.type) ? json.type : null;
  if (connu === 'agent_prompt_stalled') return { ok: null, type: 'agent_prompt_stalled' };
  if (erreur) return { ok: false, type: 'error' };
  if (connu === 'agent_prompted') return { ok: true, type: 'agent_prompted' };
  return { ok: null, type: null };
}

function consumeLine(state, line) {
  let entry;
  try { entry = JSON.parse(line); } catch { return; }
  const message = entry?.message;
  if (!message || typeof message !== 'object') return;
  if (entry.type === 'assistant' && Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block?.type !== 'tool_use') continue;
      const name = typeof block.name === 'string' ? block.name.toLowerCase() : '';
      if (name !== 'bash' && name !== 'powershell') continue;
      if (typeof block.input?.command !== 'string') continue;
      if (state.byToolId.has(block.id)) continue;
      // Identifiant validé et borné, horodatage validé : rien d'autre ne sort.
      if (typeof block.id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(block.id)) continue;
      const trouvees = parseDelegations(block.input.command);
      if (trouvees.length === 0) continue;
      const at = typeof entry.timestamp === 'string' && !Number.isNaN(Date.parse(entry.timestamp)) ? entry.timestamp : null;
      const groupe = [];
      for (const trouve of trouvees) {
        const delegation = { id: block.id, at, target: trouve.target, title: trouve.title, result: null };
        state.delegations.push(delegation);
        groupe.push(delegation);
      }
      state.byToolId.set(block.id, groupe);
      while (state.delegations.length > MAX_DELEGATIONS) {
        const removed = state.delegations.shift();
        const reste = state.byToolId.get(removed.id);
        if (reste) {
          const index = reste.indexOf(removed);
          if (index !== -1) reste.splice(index, 1);
          if (reste.length === 0) state.byToolId.delete(removed.id);
        }
      }
    }
  } else if (entry.type === 'user' && Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block?.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue;
      const groupe = state.byToolId.get(block.tool_use_id);
      if (!groupe) continue;
      // Le résultat de l'outil vaut pour tous les ordres de la même commande.
      const issue = outcomeOf(block);
      for (const delegation of groupe) delegation.result = issue;
    }
  }
}

function freshState() {
  return { offset: 0, partial: Buffer.alloc(0), skipping: false, head: Buffer.alloc(0), tail: Buffer.alloc(0), delegations: [], byToolId: new Map(), size: 0, mtimeMs: 0, ino: 0, birthtimeMs: 0 };
}

function copie(delegations) {
  return delegations.map(d => ({ id: d.id, at: d.at, target: d.target, title: d.title, result: d.result ? { ok: d.result.ok, type: d.result.type } : null }));
}

async function readSession(sessionId, root, key) {
  let path;
  try {
    path = paths.get(key);
    let info;
    if (path) {
      try { info = await transcriptInfo(path, root); } catch { /* Chercher à nouveau si le fichier a disparu. */ }
      if (!info) { cache.delete(path); paths.delete(key); path = undefined; }
    }
    if (!path) {
      path = await findTranscript(root, `${sessionId}.jsonl`);
      if (!path) return { found: false };
      info = await transcriptInfo(path, root);
      if (!info) return { found: false };
    }
    remember(paths, key, path, 128);
    let state = cache.get(path);
    if (!state || info.size < state.size || (info.size === state.size && info.mtimeMs !== state.mtimeMs) || info.ino !== state.ino || info.birthtimeMs !== state.birthtimeMs) {
      state = freshState();
    }
    if (state.offset > 0 && state.offset <= info.size && state.tail.length > 0) {
      // Le journal doit toujours contenir, juste avant notre position, les octets
      // déjà lus. Sinon il a été réécrit : on repart de zéro sans garder l'ancien.
      const flux = createReadStream(path, { start: state.offset - state.tail.length, end: state.offset - 1 });
      const morceaux = [];
      for await (const morceau of flux) morceaux.push(morceau);
      if (!Buffer.concat(morceaux).equals(state.tail)) state = freshState();
    }
    // Le début déjà lu doit lui aussi rester identique : une réécriture qui
    // conserve la queue mais remplace le début ne doit rien laisser de l'ancien.
    // Attention : tête et queue ne prouvent pas l'immuabilité de tout le préfixe ;
    // elles détectent les réécritures courantes sans relire le fichier entier.
    if (state.offset > 0 && state.head.length > 0 && info.size >= state.head.length) {
      const flux = createReadStream(path, { start: 0, end: state.head.length - 1 });
      const morceaux = [];
      for await (const morceau of flux) morceaux.push(morceau);
      if (!Buffer.concat(morceaux).equals(state.head)) state = freshState();
    }
    if (state.offset < info.size) {
      const stream = createReadStream(path, { start: state.offset, end: Math.min(info.size, state.offset + MAX_BYTES) - 1 });
      const input = Readable.from(completeLines(stream, state, { track: true }));
      try {
        for await (const line of input) consumeLine(state, line);
      } finally {
        input.destroy();
        stream.destroy();
      }
    }
    Object.assign(state, { size: info.size, mtimeMs: info.mtimeMs, ino: info.ino, birthtimeMs: info.birthtimeMs });
    remember(cache, path, state, 8);
    return { found: true, delegations: copie(state.delegations) };
  } catch {
    // Une panne de lecture ne doit pas détruire ce qui a déjà été observé.
    if (path) {
      const state = cache.get(path);
      if (state) return { found: true, delegations: copie(state.delegations) };
    }
    return { found: false };
  }
}

export async function readDelegations(sessionId, { root = join(homedir(), '.claude', 'projects') } = {}) {
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/.test(sessionId) || typeof root !== 'string') return { found: false };
  root = resolve(root);
  const key = `${root}\0${sessionId}`;
  if (inflight.has(key)) return structuredClone(await inflight.get(key));
  const pending = readSession(sessionId, root, key);
  inflight.set(key, pending);
  try { return await pending; } finally { inflight.delete(key); }
}

// Clé de panneau d'un agent : { espace, numero } lu dans paneId (ou, à
// défaut, dans la partie avant « @ » de l'identifiant complet). Null quand
// l'identifiant est illisible : un tel agent ne peut pas être directeur.
export function clePanneau(agent) {
  if (!agent || typeof agent !== 'object') return null;
  const raw = typeof agent.paneId === 'string' ? agent.paneId
    : typeof agent.id === 'string' ? agent.id.split('@')[0]
      : '';
  const match = /^([^:]+):p(\d+)$/.exec(raw.trim());
  return match ? { espace: match[1], numero: Number(match[2]) } : null;
}

// Choix du chef : le PREMIER candidat lisible de la liste reçue (option A,
// tranchée par DrSmoke). bossOf ne trie plus : l'ordre de la liste est la
// responsabilité de l'appelant. La direction (src/direction.mjs) lui donne
// la liste triée par première apparition mémorisée ; au premier démarrage,
// sans mémoire, elle la trie par numéro de panneau.
//
// Herdr ne fournit pas l'heure de démarrage des panneaux : le « premier
// démarré » n'existe dans aucune donnée d'entrée, seul l'ordre observé par
// MyTeam fait foi. Un même panneau listé deux fois (deux empreintes) garde
// un représentant stable : le plus petit identifiant complet.
export function bossOf(agents) {
  if (!Array.isArray(agents)) return null;
  let best = null;
  let bestCle = null;
  let bestId = '';
  for (const agent of agents) {
    const cle = clePanneau(agent);
    if (!cle) continue;
    const id = typeof agent.id === 'string' ? agent.id : '';
    if (!best) { best = agent; bestCle = cle; bestId = id; continue; }
    if (cle.espace === bestCle.espace && cle.numero === bestCle.numero && id < bestId) {
      best = agent; bestId = id;
    }
  }
  return best;
}
