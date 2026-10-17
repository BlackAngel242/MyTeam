import { createReadStream } from 'node:fs';
import { lstat, opendir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_LINE = 4 * 1024 * 1024;
const CACHE_LIMIT = 32;
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const modelName = value => typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,127}$/u.test(value) ? value : null;
const effortName = value => ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(value) ? value : null;

function keep(map, key, value, limit = CACHE_LIMIT) {
  map.delete(key);
  map.set(key, value);
  if (map.size > limit) map.delete(map.keys().next().value);
}

function cwdKey(cwd) {
  if (typeof cwd !== 'string' || !cwd) return null;
  if (win32.isAbsolute(cwd) && !cwd.startsWith('/')) return win32.normalize(cwd).replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
  if (posix.isAbsolute(cwd)) return posix.normalize(cwd).replace(/\/$/, '') || '/';
  return null;
}

// Seuls ces champs peuvent quitter les lecteurs, y compris en cas d'adaptateur injecte.
export function normalizeActivity(value, { claude = false } = {}) {
  if (!value || typeof value !== 'object') return null;
  const keys = ['input', 'output', 'cacheRead', 'cacheCreation'];
  const tokens = Object.fromEntries(keys.map(key => [key, number(value.tokens?.[key])]));
  const result = {
    tokens: Object.values(tokens).some(value => value !== null) ? tokens : null,
    limits: Array.isArray(value.limits) ? value.limits.filter(limit =>
      limit && ['Principale', 'Secondaire'].includes(limit.label) && number(limit.usedPercent) !== null
    ).map(limit => ({ label: limit.label, usedPercent: limit.usedPercent, window: number(limit.window) })) : [],
    model: modelName(value.model),
    effort: effortName(value.effort),
    source: 'journal local',
    match: claude ? 'session exacte' : 'dossier et activité récente',
  };
  if (claude) result.subagents = Array.isArray(value.subagents) ? value.subagents.filter(agent =>
    agent && typeof agent.id === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(agent.id)
  ).map(agent => ({ id: agent.id, description: typeof agent.description === 'string' ? Array.from(agent.description.slice(0, 160)).slice(0, 80).join('') : '' })) : [];
  return result;
}

async function* files(root) {
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
        else if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) {
          const stat = await lstat(path);
          if (stat.isFile() && !stat.isSymbolicLink()) yield { path, stat };
        }
      }
    } catch { /* Un journal inaccessible ne rend pas Herdr indisponible. */ }
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
      if (!skipping && partial.length + segment.length <= MAX_LINE) yield partial.length ? Buffer.concat([partial, segment]) : segment;
      partial = Buffer.alloc(0);
      skipping = false;
      start = end + 1;
    }
    if (start < chunk.length) {
      if (!skipping && partial.length + chunk.length - start <= MAX_LINE) partial = Buffer.concat([partial, chunk.subarray(start)]);
      else { partial = Buffer.alloc(0); skipping = true; }
    }
  }
  state.partial = partial;
  state.skipping = skipping;
}

function consumeCodex(state, entry) {
  const payload = entry?.payload;
  if (!payload || typeof payload !== 'object') return;
  if (entry.type === 'session_meta') state.cwd = cwdKey(payload.cwd);
  if (entry.type === 'turn_context') {
    state.model = modelName(payload.model);
    state.effort = effortName(payload.effort ?? payload.reasoning_effort);
  }
  if (entry.type !== 'event_msg' || payload.type !== 'token_count') return;
  const usage = payload.info?.total_token_usage;
  if (usage && typeof usage === 'object') {
    const input = number(usage.input_tokens), read = number(usage.cached_input_tokens), write = number(usage.cache_write_input_tokens);
    const uncached = input === null ? null : input - (read ?? 0) - (write ?? 0);
    state.tokens = { input: number(uncached), output: number(usage.output_tokens), cacheRead: read, cacheCreation: write };
  }
  if (payload.rate_limits && typeof payload.rate_limits === 'object') {
    state.limits = ['primary', 'secondary'].flatMap((key, i) => {
      const limit = payload.rate_limits[key];
      const used = number(limit?.used_percent);
      return used !== null ? [{ label: i ? 'Secondaire' : 'Principale', usedPercent: used, window: number(limit.window_minutes) }] : [];
    });
  }
}

function changed(state, stat) {
  return !state || stat.size < state.size || stat.ino !== state.ino || stat.birthtimeMs !== state.birthtimeMs ||
    (!state.exhausted && stat.size === state.size && stat.mtimeMs !== state.mtimeMs);
}

async function scanCodex(file, previous, headerOnly = false) {
  const { path, stat } = file;
  const state = changed(previous, stat) ? { offset: 0, partial: Buffer.alloc(0), skipping: false, exhausted: false, cwd: null, tokens: null, limits: [], model: null, effort: null } : previous;
  if (!state.exhausted && state.offset < stat.size && !(headerOnly && state.cwd)) {
    const stream = createReadStream(path, { start: state.offset, end: Math.min(stat.size, state.offset + MAX_BYTES) - 1 });
    const input = Readable.from(completeLines(stream, state));
    const lines = createInterface({ input, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        consumeCodex(state, entry);
        if (headerOnly && state.cwd) break;
      }
    } catch { state.exhausted = true; state.partial = Buffer.alloc(0); }
    finally { lines.close(); input.destroy(); stream.destroy(); }
  }
  Object.assign(state, { size: stat.size, mtimeMs: stat.mtimeMs, ino: stat.ino, birthtimeMs: stat.birthtimeMs });
  return state;
}

async function databaseStamp(path, root) {
  const directory = await lstat(root);
  if (!directory.isDirectory() || directory.isSymbolicLink()) return null;
  const stamps = [];
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      const stat = await lstat(path + suffix);
      if (!stat.isFile() || stat.isSymbolicLink()) return null;
      if (suffix !== '-shm') stamps.push([stat.size, stat.mtimeMs, stat.ino, stat.birthtimeMs]);
    } catch (error) { if (suffix === '' || error.code !== 'ENOENT') return null; }
  }
  return JSON.stringify(stamps);
}

async function openCodeSessions(path) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('session_v2','session','message')").all().map(row => row.name);
    const table = tables.includes('session_v2') ? 'session_v2' : tables.includes('session') ? 'session' : null;
    if (!table) return [];
    const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
    if (!['id', 'directory', 'time_updated'].every(key => columns.has(key))) return [];
    const optional = ['model', 'tokens_input', 'tokens_output', 'tokens_reasoning', 'tokens_cache_read', 'tokens_cache_write'];
    const select = ['id', 'directory', 'time_updated', ...optional.map(key => columns.has(key) ? key : `NULL AS ${key}`)].join(',');
    const rows = db.prepare(`SELECT ${select} FROM ${table}${columns.has('parent_id') ? ' WHERE parent_id IS NULL' : ''} ORDER BY time_updated DESC`).all();
    return rows.map(row => {
      let detail;
      if (tables.includes('message')) {
        try {
          detail = db.prepare("SELECT json_extract(data,'$.variant') AS effort, json_extract(data,'$.modelID') AS model FROM message WHERE session_id=? AND json_valid(data) AND json_extract(data,'$.role')='assistant' ORDER BY time_updated DESC LIMIT 1").get(row.id);
        } catch { /* Le schema de messages peut varier ; les compteurs restent natifs. */ }
      }
      const output = number(row.tokens_output), reasoning = number(row.tokens_reasoning);
      return {
        cwd: cwdKey(row.directory), updated: number(row.time_updated),
        tokens: { input: number(row.tokens_input), output: output === null ? null : output + (reasoning ?? 0), cacheRead: number(row.tokens_cache_read), cacheCreation: number(row.tokens_cache_write) },
        model: modelName(row.model) ?? modelName(detail?.model), effort: effortName(detail?.effort), limits: [],
      };
    });
  } finally { db.close(); }
}

export function createAgentActivityReader({ codexRoot = join(homedir(), '.codex', 'sessions'), openCodeRoot = join(homedir(), '.local', 'share', 'opencode') } = {}) {
  const headers = new Map(), states = new Map(), databases = new Map(), pending = new Map();
  async function readCodex(cwd) {
    const candidates = [];
    for await (const file of files(codexRoot)) candidates.push(file);
    candidates.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    for (let i = 0; i < candidates.length; i++) {
      const file = candidates[i];
      const known = headers.get(file.path);
      let header = known;
      if (changed(known, file.stat) || (!known?.cwd && !known?.exhausted && known?.size !== file.stat.size)) {
        header = await scanCodex(file, null, true);
        // Un offset de lecture d'en-tete n'est jamais celui du lecteur complet.
        header = { cwd: header.cwd, exhausted: header.exhausted, size: file.stat.size, mtimeMs: file.stat.mtimeMs, ino: file.stat.ino, birthtimeMs: file.stat.birthtimeMs };
      } else Object.assign(header, { size: file.stat.size, mtimeMs: file.stat.mtimeMs });
      keep(headers, file.path, header, 2048);
      if (header.cwd !== cwd || header.exhausted) continue;
      // Deux fichiers aussi recents ne permettent pas de choisir une session.
      for (let j = i + 1; j < candidates.length && candidates[j].stat.mtimeMs === file.stat.mtimeMs; j++) {
        const other = await scanCodex(candidates[j], null, true);
        if (other.cwd === cwd) return null;
      }
      const state = await scanCodex(file, states.get(file.path));
      keep(states, file.path, state);
      if (state.exhausted || state.cwd !== cwd) return null;
      if (!state.tokens && !state.model && !state.effort && !state.limits.length) return null;
      return normalizeActivity(state);
    }
    return null;
  }
  async function readOpenCode(cwd) {
    const candidates = [];
    for (const name of ['opencode.db', 'opencode-.db']) {
      const path = join(openCodeRoot, name);
      try {
        const stamp = await databaseStamp(path, openCodeRoot);
        if (!stamp) continue;
        let cached = databases.get(path);
        if (cached?.stamp !== stamp) { cached = { stamp, rows: await openCodeSessions(path) }; keep(databases, path, cached); }
        candidates.push(...cached.rows.filter(row => row.cwd === cwd && row.updated !== null));
      } catch { /* Base absente, verrouillee ou SQLite natif indisponible : rien d'invente. */ }
    }
    candidates.sort((a, b) => b.updated - a.updated);
    const result = candidates[0];
    if (!result) return null;
    const activity = normalizeActivity(result);
    return activity.tokens || activity.model || activity.effort ? activity : null;
  }
  return async function readAgentActivity(agent, agents = [agent]) {
    if (!agent || !['Codex', 'OpenCode'].includes(agent.kind)) return null;
    const cwd = cwdKey(agent.cwd);
    if (!cwd || agents.filter(peer => peer.kind === agent.kind && cwdKey(peer.cwd) === cwd).length !== 1) return null;
    const key = `${agent.kind}\0${cwd}`;
    if (pending.has(key)) return structuredClone(await pending.get(key));
    const promise = (agent.kind === 'Codex' ? readCodex(cwd) : readOpenCode(cwd)).catch(() => null);
    pending.set(key, promise);
    try { return await promise; } finally { pending.delete(key); }
  };
}

export const readAgentActivity = createAgentActivityReader();
