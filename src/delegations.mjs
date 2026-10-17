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

async function findTranscript(root, filename) {
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    try {
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink()) continue;
      for await (const entry of await opendir(directory)) {
        if (entry.isSymbolicLink()) continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) pending.push(path);
        else if (entry.isFile() && entry.name === filename) return path;
      }
    } catch {
      // Un dossier inaccessible ne doit pas masquer les autres sessions.
    }
  }
  return undefined;
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
// lisible. On masque donc les chemins dans tout intitulé.
function masquerChemins(texte) {
  return texte
    .replace(/[A-Za-z]:[\\/][^\s"']*/g, '…')
    .replace(/\\\\[^\s"']*/g, '…')
    .replace(/(?:^|[\s(])~?\/(?:home|Users|root|var|etc|tmp|mnt|opt|proc)\/[^\s"']*/g, suite => (suite.startsWith(' ') ? ' …' : '…'))
    .replace(/~\/[^\s"']*/g, '…');
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

// Une cible valide ressemble à un panneau (w5:p4) ou à un nom d'agent, jamais à
// une option ni à un chemin. Le module ne connaît pas la liste des agents : la
// validation reste celle de la forme, le serveur peut revalider.
const CIBLE = /^[A-Za-z0-9_.:-]{1,120}$/;
// Séparateurs du shell : après eux commence une nouvelle commande.
const SEPARATEURS = [';', '&&', '||', '|', '&', '('];

// Reconnaît `herdr ... agent prompt <cible> <message>` UNIQUEMENT en début de
// commande du shell ou juste après un séparateur : un exemple imprimé par echo,
// une commande d'aide (--help) ou un appel sans consigne ne prouve aucun envoi.
function parseDelegation(command) {
  const words = tokenize(command);
  let debut = 0;
  for (let h = 0; h < words.length; h++) {
    if (SEPARATEURS.includes(words[h].text)) { debut = h + 1; continue; }
    if (h !== debut || !isHerdrToken(words[h].text)) continue;
    const segment = words.slice(h);
    if (segment.some(mot => ['--help', '-h', 'help', '/?'].includes(mot.text))) return null;
    let i = 1;
    // Options éventuelles avant la sous-commande, par exemple --session nom.
    while (i < segment.length && segment[i].text.startsWith('-')) {
      i++;
      if (i < segment.length && !segment[i].text.startsWith('-') && segment[i].text.toLowerCase() !== 'agent') i++;
    }
    if (segment[i]?.text.toLowerCase() !== 'agent' || segment[i + 1]?.text.toLowerCase() !== 'prompt') return null;
    const cible = segment[i + 2];
    if (!cible || !cible.literal || !CIBLE.test(cible.text) || cible.text.startsWith('-')) return null;
    const message = [];
    for (let j = i + 3; j < segment.length; j++) {
      const mot = segment[j];
      if (SEPARATEURS.includes(mot.text)) break;
      message.push(mot);
    }
    if (message.length === 0) return null;
    const titre = message.every(mot => mot.literal) ? titreDe(message.map(mot => mot.text).join(' ')) : null;
    return { target: cible.text, title: titre };
  }
  return null;
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
      const found = parseDelegation(block.input.command);
      if (!found) continue;
      const at = typeof entry.timestamp === 'string' && !Number.isNaN(Date.parse(entry.timestamp)) ? entry.timestamp : null;
      const delegation = { id: block.id, at, target: found.target, title: found.title, result: null };
      state.delegations.push(delegation);
      state.byToolId.set(delegation.id, delegation);
      if (state.delegations.length > MAX_DELEGATIONS) {
        const removed = state.delegations.shift();
        if (removed && state.byToolId.get(removed.id) === removed) state.byToolId.delete(removed.id);
      }
    }
  } else if (entry.type === 'user' && Array.isArray(message.content)) {
    for (const block of message.content) {
      if (block?.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue;
      const delegation = state.byToolId.get(block.tool_use_id);
      if (delegation) delegation.result = outcomeOf(block);
    }
  }
}

// Ligne trop longue : on l'ignore en avançant, l'état reste utilisable
// (pas de relecture intégrale du journal à chaque appel). L'état de saut
// (`skipping`) est conservé entre deux lectures : une ligne géante répartie sur
// plusieurs sondages ne doit jamais être coupée en fausses entrées.
async function* completeLines(stream, state) {
  let partial = state.partial;
  let skipping = state.skipping;
  for await (const chunk of stream) {
    if (state.offset === 0 && state.head.length === 0) state.head = Buffer.from(chunk.subarray(0, 64));
    state.offset += chunk.length;
    state.tail = Buffer.concat([state.tail, chunk]).subarray(-64);
    let start = 0;
    for (let end = chunk.indexOf(10); end !== -1; end = chunk.indexOf(10, start)) {
      const segment = chunk.subarray(start, end + 1);
      if (skipping) { skipping = false; }
      else if (partial.length + segment.length > MAX_LINE) { partial = Buffer.alloc(0); }
      else {
        yield partial.length ? Buffer.concat([partial, segment]) : segment;
        partial = Buffer.alloc(0);
      }
      start = end + 1;
    }
    if (start < chunk.length) {
      if (!skipping && partial.length + chunk.length - start > MAX_LINE) { partial = Buffer.alloc(0); skipping = true; }
      else if (!skipping) partial = Buffer.concat([partial, chunk.subarray(start)]);
    }
  }
  state.partial = partial;
  state.skipping = skipping;
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
      const input = Readable.from(completeLines(stream, state));
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

// Choix du chef : le panneau <espace>:p<numéro> au plus petit numéro, dans le
// plus petit espace, avec l'identifiant complet comme dernier critère.
//
// APPROXIMATION : Herdr ne fournit pas l'heure de démarrage des panneaux. Le
// « premier agent démarré » ne peut donc pas être prouvé ; on prend le panneau
// le plus bas numéroté, qui correspond en pratique au premier créé dans l'espace.
export function bossOf(agents) {
  if (!Array.isArray(agents)) return null;
  let best = null;
  let bestKey = null;
  for (const agent of agents) {
    if (!agent || typeof agent !== 'object') continue;
    const raw = typeof agent.paneId === 'string' ? agent.paneId
      : typeof agent.id === 'string' ? agent.id.split('@')[0]
        : '';
    const match = /^([^:]+):p(\d+)$/.exec(raw.trim());
    if (!match) continue;
    const key = [match[1], Number(match[2]), typeof agent.id === 'string' ? agent.id : ''];
    if (bestKey === null
      || key[0] < bestKey[0]
      || (key[0] === bestKey[0] && key[1] < bestKey[1])
      || (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])) {
      bestKey = key;
      best = agent;
    }
  }
  return best;
}
