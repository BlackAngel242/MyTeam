// Réponses structurées d'un agent, lues dans son journal local (lecture seule).
//
// Contrat de sortie de readClaudeResponses(sessionId) :
//   { found, complete, responses: [{ key, startedAt, endedAt, state, blocks: [{ text }] }] }
// - key : clé publique opaque et stable ; aucun identifiant de session ni chemin ne sort.
// - state : « terminée » (fin de tour observée), « interrompue » (arrêt demandé par
//   DrSmoke observé) ou « fin non déterminée » (le journal ne permet pas de conclure,
//   y compris pour un tour encore en cours).
// - complete : false quand la lecture n'a couvert que la fin du journal (début tronqué).
// - Les réponses sont les 30 dernières, de la plus ancienne à la plus récente.
// - Seuls les blocs de texte de l'agent sortent : ni outils, ni raisonnement, ni
//   messages inter-agents. Secrets et chemins personnels sont masqués.
// readAgentResponses(agent, agents) : même contrat pour Codex et OpenCode, avec
// rattachement par dossier et activité récente, jamais si ce choix est ambigu.
// Codex : textes output_text publics uniquement ; agent_message est toujours ignoré.
// OpenCode : parts text non synthétiques, colonnes précises, base en lecture seule.
import { open, lstat, opendir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createAgentActivityReader, readOpenCodeTexts } from './agent-activity.mjs';

const TAIL_BYTES = 8 * 1024 * 1024;
const MAX_LINE = 4 * 1024 * 1024;
const MAX_RESPONSES = 30;
const MAX_BLOCK = 20000;
const paths = new Map();

export function mask(value) {
  return String(value)
    .replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, '[identifiant masqué]')
    .replace(/\b(?:sk|pk|ghp|gho|ghu|ghs|xox[abprs])[-_][A-Za-z0-9_-]{16,}\b/g, '[secret masqué]')
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/=-]{16,}/gi, '$1 [secret masqué]')
    .replace(/\b((?:api[_-]?key|token|secret|password|passwd)\s*[:=]\s*)["']?[^\s"',;]{6,}/gi, '$1[secret masqué]')
    .replace(/(?:[a-z]:[\\/]|\\\\)[^\s`"'<>]+/gi, '[chemin masqué]')
    .replace(/(^|[\s`"'(])(~[\\/][^\s`"'<>)]*)/g, '$1[chemin masqué]')
    .replace(/(^|[\s`"'(])(\/(?:home|Users|root|etc|usr|var|tmp|mnt|opt|proc)(?:\/[^\s`"'<>)]*)?)/g, '$1[chemin masqué]');
}

async function inside(path, root) {
  for (let directory = dirname(path); ; directory = dirname(directory)) {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) return false;
    if (directory === root) break;
    if (dirname(directory) === directory) return false;
  }
  const info = await lstat(path);
  return info.isFile() && !info.isSymbolicLink();
}

async function find(root, filename) {
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
    } catch { /* Un dossier inaccessible ne masque pas les autres sessions. */ }
  }
  return null;
}

async function tail(path) {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const start = Math.max(0, size - TAIL_BYTES);
    const buffer = Buffer.alloc(size - start);
    await handle.read(buffer, 0, buffer.length, start);
    let text = buffer.toString('utf8');
    // Début en milieu de ligne : la première ligne est incomplète, on la saute.
    if (start > 0) text = text.slice(text.indexOf('\n') + 1);
    return { lines: text.split('\n'), complete: start === 0 };
  } finally { await handle.close(); }
}

const userText = content => typeof content === 'string' ? content
  : Array.isArray(content) ? content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n') : '';

export function parseClaudeResponses(lines, sessionId) {
  const turns = [];
  let turn = null;
  for (const line of lines) {
    if (!line || line.length > MAX_LINE) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const content = entry?.message?.content;
    const at = typeof entry?.timestamp === 'string' && !Number.isNaN(Date.parse(entry.timestamp)) ? new Date(entry.timestamp).toISOString() : null;
    if (entry?.isSidechain === true) continue;
    if (entry?.type === 'user' && !entry.isMeta) {
      const hasResult = Array.isArray(content) && content.some(block => block?.type === 'tool_result');
      const text = userText(content);
      if (hasResult || !text.trim()) continue;
      if (/^\[Request interrupted/.test(text.trim())) { if (turn) turn.interrupted = true; continue; }
      turn = { id: typeof entry.uuid === 'string' ? entry.uuid : `${at}#${turns.length}`, startedAt: at, endedAt: at, blocks: [], interrupted: false, ended: false };
      turns.push(turn);
    } else if (entry?.type === 'assistant' && turn && Array.isArray(content)) {
      for (const block of content) {
        if (block?.type === 'text' && typeof block.text === 'string' && block.text.trim()) turn.blocks.push({ text: mask(block.text.slice(0, MAX_BLOCK)) });
      }
      if (at) turn.endedAt = at;
      if (entry.message.stop_reason === 'end_turn') turn.ended = true;
    }
  }
  return turns.filter(t => t.blocks.length).slice(-MAX_RESPONSES).map(t => ({
    key: createHash('sha256').update(`${sessionId}\0${t.id}`).digest('hex').slice(0, 16),
    startedAt: t.startedAt,
    endedAt: t.endedAt,
    state: t.interrupted ? 'interrompue' : t.ended ? 'terminée' : 'fin non déterminée',
    blocks: t.blocks,
  }));
}

export async function readClaudeResponses(sessionId, { root = join(homedir(), '.claude', 'projects') } = {}) {
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/.test(sessionId)) return { found: false, complete: false, responses: [] };
  root = resolve(root);
  const cacheKey = `${root}\0${sessionId}`;
  let path = paths.get(cacheKey);
  try {
    if (!path || !(await inside(path, root))) {
      path = await find(root, `${sessionId}.jsonl`);
      if (!path || !(await inside(path, root))) { paths.delete(cacheKey); return { found: false, complete: false, responses: [] }; }
      paths.set(cacheKey, path);
    }
    const { lines, complete } = await tail(path);
    return { found: true, complete, responses: parseClaudeResponses(lines, sessionId) };
  } catch { return { found: false, complete: false, responses: [] }; }
}

const absent = () => ({ found: false, complete: false, responses: [] });
const opaque = value => createHash('sha256').update(value).digest('hex').slice(0,16);
const date = value => {
  const ms = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) && Math.abs(ms) <= 8640000000000000 ? new Date(ms).toISOString() : null;
};

function consumeCodexResponse(state, entry, path) {
  state.responseData ??= { turns: [], current: null, sequence: 0, complete: true };
  const data = state.responseData, payload = entry?.payload;
  if (!payload) return;
  const at = date(entry.timestamp);
  const start = () => {
    const turn = { key: opaque(`${path}\0${at}\0${data.sequence++}`), startedAt: at, endedAt: at, state: 'fin non déterminée', blocks: [] };
    data.turns.push(turn); data.current = turn;
    while (data.turns.length > MAX_RESPONSES) { data.turns.shift(); data.complete = false; }
    return turn;
  };
  if (entry.type === 'event_msg') {
    if (payload.type === 'task_started') start();
    else if (data.current && ['task_complete','turn_aborted'].includes(payload.type)) {
      data.current.state = payload.type === 'task_complete' ? 'terminée' : 'interrompue';
      if (at) data.current.endedAt = at;
      data.current = null;
    }
    return;
  }
  if (entry.type === 'response_item' && payload.type === 'message' && payload.role === 'user' &&
    Array.isArray(payload.content) && payload.content.some(block => block?.type === 'input_text' && typeof block.text === 'string' && block.text.trim())) {
    if (!data.current || data.current.blocks.length) start();
    return;
  }
  if (entry.type !== 'response_item' || payload.type !== 'message' || payload.role !== 'assistant' ||
    payload.channel === 'analysis' || !Array.isArray(payload.content)) return;
  const texts = payload.content.filter(block => block?.type === 'output_text' && typeof block.text === 'string' && block.text.trim());
  if (!texts.length) return;
  const turn = data.current ?? start();
  for (const block of texts) {
    if (turn.blocks.length >= 10) { data.complete = false; break; }
    if (block.text.length > MAX_BLOCK) data.complete = false;
    turn.blocks.push({ text: mask(block.text.slice(0,MAX_BLOCK)) });
  }
  if (at) turn.endedAt = at;
  while (data.turns.reduce((sum,t) => sum+t.blocks.reduce((n,b) => n+b.text.length,0),0) > 240000 && data.turns.length > 1) {
    data.turns.shift(); data.complete = false;
  }
}

export function createAgentResponsesReader(options = {}) {
  const journals = createAgentActivityReader({ ...options, consumeCodexEntry: consumeCodexResponse });
  return async function read(agent, agents = [agent]) {
    try {
      const source = await journals.readSource(agent,agents);
      if (!source) return absent();
      if (agent.kind === 'Codex') return {
        found: true, complete: source.responseData?.complete !== false,
        responses: structuredClone(source.responseData?.turns.filter(turn => turn.blocks.length) ?? []),
      };
      const result = await readOpenCodeTexts(source);
      if (!result) return absent();
      let complete = result.complete, remaining = 240000;
      const turns = [];
      // Budget partagé : priorité aux réponses les plus récentes.
      for (const message of result.messages.toReversed()) {
        const blocks = [];
        if (message.parts.length > 10) complete = false;
        for (const part of message.parts.slice(0,10)) {
          if (typeof part.text !== 'string' || !part.text.trim()) continue;
          const length = Math.min(MAX_BLOCK,remaining);
          if (part.text.length > length) complete = false;
          if (length > 0) blocks.push({ text: mask(part.text.slice(0,length)) });
          remaining -= Math.min(part.text.length,length);
        }
        if (blocks.length) turns.push({
          key: opaque(`${source.path}\0${source.sessionId}\0${message.id}`),
          startedAt: date(message.time_created), endedAt: date(message.completed),
          state: message.error === 'MessageAbortedError' ? 'interrompue' : message.finish === 'stop' ? 'terminée' : 'fin non déterminée', blocks,
        });
      }
      return { found: true, complete, responses: turns.reverse() };
    } catch { return absent(); }
  };
}

export const readAgentResponses = createAgentResponsesReader();
