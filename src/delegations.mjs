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
const MAX_TYPE = 40;

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
  return Array.from(sansAnsi.replace(/\s+/g, ' ').trim()).slice(0, MAX_TITLE).join('');
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

// Cherche `herdr ... agent prompt <cible> [message]` dans la commande.
// Retourne null si la cible est illisible ; une commande n'est comptée qu'une fois.
function parseDelegation(command) {
  const words = tokenize(command);
  for (let h = 0; h < words.length; h++) {
    if (!isHerdrToken(words[h].text)) continue;
    for (let i = h + 1; i + 2 < words.length; i++) {
      if (words[i].text.toLowerCase() !== 'agent' || words[i + 1].text.toLowerCase() !== 'prompt') continue;
      const target = words[i + 2];
      if (!target.literal || !target.text.trim()) return null;
      const rest = [];
      for (let j = i + 3; j < words.length; j++) {
        const word = words[j];
        if ([';', '&&', '||', '|'].includes(word.text)) break;
        rest.push(word);
      }
      const title = rest.length > 0 && rest.every(word => word.literal) ? readable(rest.map(word => word.text).join(' ')) : null;
      return { target: target.text, title };
    }
  }
  return null;
}

// Issue observée : marqueur court extrait du tool_result, jamais son texte complet.
function outcomeOf(block) {
  const text = textOf(block.content);
  const ok = block.is_error !== true && !/^\s*\{\s*"error"/.test(text);
  let type = null;
  const marker = text.match(/agent_prompt_[a-z_]+/);
  if (marker) type = marker[0];
  else {
    try {
      const parsed = JSON.parse(text);
      const candidate = parsed?.result?.type ?? parsed?.type;
      if (typeof candidate === 'string') type = candidate;
    } catch { /* Le résultat n'est pas du JSON : on garde un marqueur simple. */ }
  }
  if (!type && !ok) type = 'error';
  return { ok, type: type ? Array.from(type).slice(0, MAX_TYPE).join('') : null };
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
      if (typeof block.id !== 'string' || typeof block.input?.command !== 'string') continue;
      if (state.byToolId.has(block.id)) continue;
      const found = parseDelegation(block.input.command);
      if (!found) continue;
      const delegation = {
        id: block.id,
        at: typeof entry.timestamp === 'string' ? entry.timestamp : null,
        target: found.target,
        title: found.title,
        result: null,
      };
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
// (pas de relecture intégrale du journal à chaque appel).
async function* completeLines(stream, state) {
  let partial = state.partial;
  let skipping = false;
  for await (const chunk of stream) {
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
    if (start < chunk.length && !skipping) {
      if (partial.length + chunk.length - start > MAX_LINE) { partial = Buffer.alloc(0); skipping = true; }
      else partial = Buffer.concat([partial, chunk.subarray(start)]);
    }
  }
  state.partial = partial;
}

function freshState() {
  return { offset: 0, partial: Buffer.alloc(0), tail: Buffer.alloc(0), delegations: [], byToolId: new Map(), size: 0, mtimeMs: 0, ino: 0, birthtimeMs: 0 };
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
