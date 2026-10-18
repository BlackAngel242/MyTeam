import { createReadStream } from 'node:fs';
import { lstat, opendir, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { masque } from './masque.mjs';

const MAX_BYTES = 50 * 1024 * 1024;
// Chemin et etat partagent une seule politique d'eviction.
const sessions = new Map();
const inflight = new Map();
const MAX_RETAINED_BYTES = 4 * 1024 * 1024;
const MAX_MESSAGE_IDS = 50000;
const CACHE_LIMIT = 32;

function remember(map, key, value, limit) {
  map.delete(key);
  map.set(key, value);
  if (map.size > limit) map.delete(map.keys().next().value);
}

// Plafond du controle de continuite : on ne relit jamais tout le journal pour
// decider si l'ancien offset est encore valable.
const CONTINUITY_BYTES = 4096;

function freshState() {
  return { offset: 0, partial: Buffer.alloc(0), skipping: false, exhausted: false, retained: 0, counted: new Set(), active: new Map(), tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 } };
}

// Continuite des octets avant de reprendre un offset (constat C-CD-07) : une
// reecriture plus longue sur le meme fichier garde l'ancien decalage et fait
// relire le journal en milieu de ligne, ce qui perd la fin du fichier.
// Le point de reprise doit toujours etre celui ou l'on s'est arrete :
//   - ligne partielle conservee : ses octets doivent toujours occuper la place
//     juste avant l'offset (sinon le debut a change) ;
//   - sinon la lecture s'est arretee juste apres un saut de ligne, qui doit
//     toujours se trouver la ;
//   - une ligne geante en cours d'ignorance n'a rien de conserve : le saut
//     se poursuit, sans relecture du journal deja parcouru.
// Un changement d'octets AVANT ce point (uniquement un ajout en tete, comme le
// test « lit seulement les octets ajoutes ») n'est pas relu : c'est le principe
// de la lecture incremental bornee.
async function resumePossible(path, state) {
  if (state.offset <= 0) return true;
  if (state.skipping) return true;
  const conserve = state.partial.length
    ? state.partial.subarray(Math.max(0, state.partial.length - CONTINUITY_BYTES))
    : null;
  const longueur = conserve ? conserve.length : 1;
  const depart = state.offset - longueur;
  if (depart < 0) return false;
  try {
    const handle = await open(path, 'r');
    try {
      const octets = Buffer.allocUnsafe(longueur);
      const { bytesRead } = await handle.read(octets, 0, longueur, depart);
      if (bytesRead !== longueur) return false;
      return conserve ? octets.equals(conserve) : octets[0] === 10;
    } finally { await handle.close(); }
  } catch { return false; }
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

function removeActive(state, id) {
  const agent = state.active.get(id);
  if (agent) { state.retained -= agent.bytes; state.active.delete(id); }
}

// Une notification de fin peut arriver dans une ligne user, queue-operation (content) ou attachment (prompt).
function endFromNotifications(state, text) {
  const notifications = text.match(/<task-notification>[\s\S]*?<\/task-notification>/g) || [text];
  for (const notification of notifications) {
    if (!/<status>\s*(completed|failed|killed|cancelled)\s*<\/status>/.test(notification)) continue;
    // « completed » peut signifier « en pause » : l'agent attend encore son propre travail en arrière-plan.
    if (/background work of its own still running|waiting on its own background work/i.test(notification)) continue;
    for (const match of notification.matchAll(/<tool-use-id>([^<]+)<\/tool-use-id>/g)) removeActive(state, match[1].trim());
    for (const match of notification.matchAll(/<task-id>([^<]+)<\/task-id>/g)) {
      for (const [id, agent] of state.active) if (agent.taskId === match[1].trim()) removeActive(state, id);
    }
  }
}

function consumeLine(state, line) {
  let entry;
  try { entry = JSON.parse(line); } catch { return; }
  if (entry?.type === 'queue-operation' && typeof entry.content === 'string') return endFromNotifications(state, entry.content);
  if (entry?.type === 'attachment' && typeof entry.attachment?.prompt === 'string') return endFromNotifications(state, entry.attachment.prompt);
  const message = entry?.message;
  if (!message || typeof message !== 'object') return;
  if (entry.type === 'assistant') {
    if (typeof message.id === 'string' && !state.counted.has(message.id) && message.usage) {
      const bytes = message.id.length * 2 + 64;
      if (state.counted.size >= MAX_MESSAGE_IDS || state.retained + bytes > MAX_RETAINED_BYTES) {
        state.exhausted = true;
        return;
      }
      state.counted.add(message.id);
      state.retained += bytes;
      for (const [key, field] of Object.entries({ input: 'input_tokens', output: 'output_tokens', cacheRead: 'cache_read_input_tokens', cacheCreation: 'cache_creation_input_tokens' })) {
        const value = message.usage[field];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) state.tokens[key] += value;
      }
    }
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block?.type !== 'tool_use' || !['Agent', 'Task'].includes(block.name) || typeof block.id !== 'string') continue;
        // Masque public AVANT la troncature : une description de sous-agent ne
        // doit jamais livrer un chemin ni un secret (constat C-CD-04).
        const description = typeof block.input?.description === 'string' ? Array.from(masque(block.input.description).slice(0, 160)).slice(0, 80).join('') : '';
        const previous = state.active.get(block.id);
        const bytes = (block.id.length + description.length) * 2 + 128;
        if (state.retained - (previous?.bytes || 0) + bytes > MAX_RETAINED_BYTES) {
          state.exhausted = true;
          return;
        }
        state.retained += bytes - (previous?.bytes || 0);
        state.active.set(block.id, { id: block.id, description, background: block.input?.run_in_background === true, bytes });
      }
    }
  } else if (entry.type === 'user') {
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block?.type !== 'tool_result') continue;
        const agent = state.active.get(block.tool_use_id), launched = textOf(block.content);
        // L'accusé « Async agent launched » prouve à lui seul un lancement en arrière-plan.
        if (agent && launched.includes('Async agent launched')) {
          // La notification de fin finale peut ne citer que l'identifiant de tâche : on le mémorise.
          const taskId = /agentId:\s*([A-Za-z0-9_-]+)/.exec(launched);
          if (taskId) agent.taskId = taskId[1];
          continue;
        }
        removeActive(state, block.tool_use_id);
      }
    }
    endFromNotifications(state, textOf(message.content));
  }
}

async function* completeLines(stream, state) {
  let partial = state.partial;
  let skipping = state.skipping;
  for await (const chunk of stream) {
    state.offset += chunk.length;
    let start = 0;
    for (let end = chunk.indexOf(10); end !== -1; end = chunk.indexOf(10, start)) {
      const segment = chunk.subarray(start, end + 1);
      if (!skipping && partial.length + segment.length <= MAX_RETAINED_BYTES) {
        yield partial.length ? Buffer.concat([partial, segment]) : segment;
      }
      skipping = false;
      partial = Buffer.alloc(0);
      start = end + 1;
    }
    if (start < chunk.length) {
      if (!skipping && partial.length + chunk.length - start <= MAX_RETAINED_BYTES) {
        partial = Buffer.concat([partial, chunk.subarray(start)]);
      } else {
        partial = Buffer.alloc(0);
        skipping = true;
      }
    }
  }
  state.partial = partial;
  state.skipping = skipping;
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

async function readSession(sessionId, root, key) {
  let path;
  let info;
  let state;
  try {
    const saved = sessions.get(key);
    path = saved?.path;
    state = saved?.state;
    if (path) {
      try { info = await transcriptInfo(path, root); } catch { /* Chercher a nouveau si le fichier a disparu. */ }
      if (!info) { sessions.delete(key); path = undefined; state = undefined; }
    }
    if (!path) {
      path = await findTranscript(root, `${sessionId}.jsonl`);
      if (!path) return { found: false };
      info = await transcriptInfo(path, root);
      if (!info) return { found: false };
    }
    if (!state || info.size < state.size || (!state.exhausted && info.size === state.size && info.mtimeMs !== state.mtimeMs) || info.ino !== state.ino || info.birthtimeMs !== state.birthtimeMs) {
      state = freshState();
    }
    // Un offset ne se reprend que si les octets du point de reprise sont
    // toujours en place ; sinon le journal a ete reecrit et on relu tout.
    if (!state.exhausted && state.offset < info.size && !(await resumePossible(path, state))) {
      state = freshState();
    }
    if (!state.exhausted && state.offset < info.size) {
      const stream = createReadStream(path, { start: state.offset, end: Math.min(info.size, state.offset + MAX_BYTES) - 1 });
      const input = Readable.from(completeLines(stream, state));
      const lines = createInterface({ input, crlfDelay: Infinity });
      try {
        for await (const line of lines) {
          consumeLine(state, line);
          if (state.exhausted) break;
        }
      } finally {
        lines.close();
        input.destroy();
        stream.destroy();
      }
    }
    Object.assign(state, { size: info.size, mtimeMs: info.mtimeMs, ino: info.ino, birthtimeMs: info.birthtimeMs });
    remember(sessions, key, { path, state }, CACHE_LIMIT);
    // Ne pas inventer un total apres epuisement de la deduplication exacte.
    if (state.exhausted) {
      state.partial = Buffer.alloc(0);
      state.counted.clear();
      state.active.clear();
      state.retained = 0;
      return { found: false };
    }
    return { found: true, tokens: { ...state.tokens }, subagents: [...state.active.values()].map(({ id, description }) => ({ id, description })) };
  } catch {
    if (path && info && state) {
      state.exhausted = true;
      state.partial = Buffer.alloc(0);
      state.counted.clear();
      state.active.clear();
      state.retained = 0;
      Object.assign(state, { size: info.size, mtimeMs: info.mtimeMs, ino: info.ino, birthtimeMs: info.birthtimeMs });
      remember(sessions, key, { path, state }, CACHE_LIMIT);
    }
    return { found: false };
  }
}

export async function readClaudeActivity(sessionId, { root = join(homedir(), '.claude', 'projects') } = {}) {
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/.test(sessionId) || typeof root !== 'string') return { found: false };
  root = resolve(root);
  const key = `${root}\0${sessionId}`;
  if (inflight.has(key)) return structuredClone(await inflight.get(key));
  const pending = readSession(sessionId, root, key);
  inflight.set(key, pending);
  try { return await pending; } finally { inflight.delete(key); }
}
