import { createReadStream } from 'node:fs';
import { lstat, opendir, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { masque } from './masque.mjs';

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_LINE = 4 * 1024 * 1024;
const CACHE_LIMIT = 32;
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const modelName = value => typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,127}$/u.test(value) ? value : null;
const effortName = value => ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(value) ? value : null;
// resets_at est un horodatage Unix en secondes dans le journal Codex.
const resetsAt = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null;
const isoDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
// Nom de tâche lisible : formats_locaux devient « formats locaux ».
const taskLabel = value => typeof value === 'string' ? Array.from(value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 80).join('') : '';

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
    ).map(limit => ({ label: limit.label, usedPercent: limit.usedPercent, window: number(limit.window), resetsAt: isoDate(limit.resetsAt) })) : [],
    model: modelName(value.model),
    effort: effortName(value.effort),
    limitReached: value.limitReached === true,
    source: 'journal local',
    match: claude ? 'session exacte' : 'dossier et activité récente',
  };
  if (claude || Array.isArray(value.subagents)) result.subagents = (Array.isArray(value.subagents) ? value.subagents : []).filter(agent =>
    agent && typeof agent.id === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(agent.id)
  // Masque public AVANT la troncature : une description de sous-agent ne doit
  // jamais livrer un chemin ni un secret (constat C-CD-04).
  ).map(agent => ({ id: agent.id, description: typeof agent.description === 'string' ? Array.from(masque(agent.description).slice(0, 160)).slice(0, 80).join('') : '' }));
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
  if (entry.type === 'response_item' && payload.type === 'function_call' && payload.name === 'update_plan') {
    state.plan = null;
    try {
      const args = typeof payload.arguments === 'string' ? JSON.parse(payload.arguments) : payload.arguments;
      if (Array.isArray(args?.plan) && args.plan.length <= 200 && args.plan.every(step => typeof step?.step === 'string' && ['pending','in_progress','completed'].includes(step.status))) {
        state.plan = args.plan.map(step => ({text:Array.from(step.step.slice(0,320)).slice(0,160).join(''),status:step.status}));
      }
    } catch { /* Un appel mal forme n'est pas un plan fiable. */ }
  }
  if (entry.type === 'session_meta') {
    state.cwd = payload.source === 'subagent' || payload.source?.subagent ? null : cwdKey(payload.cwd);
    if (typeof payload.id === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(payload.id)) state.thread = payload.id;
  }
  if (entry.type === 'turn_context') {
    state.model = modelName(payload.model);
    state.effort = effortName(payload.effort ?? payload.reasoning_effort);
  }
  if (entry.type === 'response_item' && payload.type === 'function_call' && payload.name === 'spawn_agent') {
    // Seul task_name est lisible : les arguments de message sont chiffrés et ne
    // sont ni lus, ni stockés, ni renvoyés.
    try {
      const args = typeof payload.arguments === 'string' ? JSON.parse(payload.arguments) : payload.arguments;
      const taskName = typeof args?.task_name === 'string' ? args.task_name : '';
      if (typeof payload.call_id === 'string' && taskName) {
        state.spawnNames.delete(payload.call_id);
        state.spawnNames.set(payload.call_id, taskName);
        if (state.spawnNames.size > 64) state.spawnNames.delete(state.spawnNames.keys().next().value);
        state.subagents = [];
      }
    } catch { /* Un appel illisible n'est pas une observation. */ }
  }
  if (entry.type === 'event_msg' && payload.type === 'item_completed' && payload.item?.type === 'SubAgentActivity') {
    const item = payload.item;
    if (!state.thread && typeof payload.thread_id === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(payload.thread_id)) state.thread = payload.thread_id;
    const thread = typeof item.agent_thread_id === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(item.agent_thread_id) ? item.agent_thread_id : null;
    const kind = typeof item.kind === 'string' ? item.kind : '';
    const fromCall = state.spawnNames.get(typeof item.id === 'string' ? item.id : '');
    const path = typeof item.agent_path === 'string' ? item.agent_path.split('/').filter(Boolean).pop() ?? '' : '';
    const nom = taskLabel(fromCall) || taskLabel(path);
    // Le fil principal de Codex n'est PAS un sous-agent : ses événements portent
    // son nom « root » ou l'identifiant de session. Ils sont ignorés.
    const estRacine = thread !== null && (thread === state.thread || nom === 'root');
    if (thread && !estRacine && ['started', 'interacted', 'completed'].includes(kind)) {
      // started et interacted prouvent que le sous-agent existe ; completed le
      // retire. Valeurs réellement observées dans les journaux du 17/10/2026.
      // world_state.state.environments.subagents n'apparaît dans aucun journal
      // local observé : non implémenté pour ne rien inventer.
      if (!state.subagents) state.subagents = [];
      let agent = state.agents.get(thread);
      if (!agent) {
        agent = { active: false, description: '' };
        state.agents.set(thread, agent);
        if (state.agents.size > 64) state.agents.delete(state.agents.keys().next().value);
      }
      if (kind === 'completed') agent.active = false;
      else {
        agent.active = true;
        if (!agent.description) agent.description = nom;
      }
      state.subagents = [...state.agents.entries()].filter(([, sous]) => sous.active).map(([id, sous]) => ({ id, description: sous.description }));
    }
  }
  if (entry.type !== 'event_msg' || payload.type !== 'token_count') return;
  const usage = payload.info?.total_token_usage;
  if (usage && typeof usage === 'object') {
    const input = number(usage.input_tokens), read = number(usage.cached_input_tokens), write = number(usage.cache_write_input_tokens);
    const uncached = input === null ? null : input - (read ?? 0) - (write ?? 0);
    state.tokens = { input: number(uncached), output: number(usage.output_tokens), cacheRead: read, cacheCreation: write };
  }
  if (payload.rate_limits && typeof payload.rate_limits === 'object') {
    const limits = payload.rate_limits;
    state.limits = ['primary', 'secondary'].flatMap((key, i) => {
      const limit = limits[key];
      const used = number(limit?.used_percent);
      return used !== null ? [{ label: i ? 'Secondaire' : 'Principale', usedPercent: used, window: number(limit.window_minutes), resetsAt: resetsAt(limit.resets_at) }] : [];
    });
    const reached = typeof limits.rate_limit_reached_type === 'string' && limits.rate_limit_reached_type !== '';
    state.limitReached = reached || state.limits.some(limit => limit.usedPercent >= 100);
  }
}

function changed(state, stat) {
  return !state || stat.size < state.size || stat.ino !== state.ino || stat.birthtimeMs !== state.birthtimeMs ||
    (!state.exhausted && stat.size === state.size && stat.mtimeMs !== state.mtimeMs);
}

async function scanCodex(file, previous, headerOnly = false, consumeEntry) {
  const { path, stat } = file;
  const handle = await open(path,'r');
  const prefix = Buffer.alloc(Math.min(stat.size,512));
  try { await handle.read(prefix,0,prefix.length,0); } finally { await handle.close(); }
  const rewritten = previous?.prefix && !prefix.subarray(0,previous.prefix.length).equals(previous.prefix);
  const state = changed(previous, stat) || rewritten ? { offset: 0, partial: Buffer.alloc(0), skipping: false, exhausted: false, cwd: null, thread: null, tokens: null, limits: [], limitReached: false, model: null, effort: null, plan: null, subagents: null, spawnNames: new Map(), agents: new Map() } : previous;
  if (!state.exhausted && state.offset < stat.size && !(headerOnly && state.cwd)) {
    const stream = createReadStream(path, { start: state.offset, end: Math.min(stat.size, state.offset + MAX_BYTES) - 1 });
    const input = Readable.from(completeLines(stream, state));
    const lines = createInterface({ input, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        consumeCodex(state, entry);
        if (!headerOnly && consumeEntry) consumeEntry(state, entry, path);
        if (headerOnly && state.cwd) break;
      }
    } catch { state.exhausted = true; state.partial = Buffer.alloc(0); }
    finally { lines.close(); input.destroy(); stream.destroy(); }
  }
  Object.assign(state, { prefix, size: stat.size, mtimeMs: stat.mtimeMs, ino: stat.ino, birthtimeMs: stat.birthtimeMs });
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
        sessionId: row.id,
        cwd: cwdKey(row.directory), updated: number(row.time_updated),
        tokens: { input: number(row.tokens_input), output: output === null ? null : output + (reasoning ?? 0), cacheRead: number(row.tokens_cache_read), cacheCreation: number(row.tokens_cache_write) },
        model: modelName(row.model) ?? modelName(detail?.model), effort: effortName(detail?.effort), limits: [],
      };
    });
  } finally { db.close(); }
}

export function createAgentActivityReader({ codexRoot = join(homedir(), '.codex', 'sessions'), openCodeRoot = join(homedir(), '.local', 'share', 'opencode'), consumeCodexEntry } = {}) {
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
      const state = await scanCodex(file, states.get(file.path), false, consumeCodexEntry);
      keep(states, file.path, state);
      if (state.exhausted || state.cwd !== cwd) return null;
      return state;
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
        candidates.push(...cached.rows.filter(row => row.cwd === cwd && row.updated !== null).map(row => ({ ...row, path, root: openCodeRoot })));
      } catch { /* Base absente, verrouillee ou SQLite natif indisponible : rien d'invente. */ }
    }
    candidates.sort((a, b) => b.updated - a.updated);
    const result = candidates[0];
    if (!result || candidates[1]?.updated === result.updated) return null;
    return result;
  }
  const reader=async function readAgentActivity(agent, agents = [agent], {planOnly=false,sourceOnly=false}={}) {
    if (!agent || !['Codex', 'OpenCode'].includes(agent.kind)) return null;
    if(planOnly&&agent.kind!=='Codex') return null;
    const cwd = cwdKey(agent.cwd);
    if (!cwd || agents.filter(peer => peer.kind === agent.kind && cwdKey(peer.cwd) === cwd).length !== 1) return null;
    const key = `${agent.kind}\0${cwd}`;
    const promise = pending.get(key)||(agent.kind === 'Codex' ? readCodex(cwd) : readOpenCode(cwd)).catch(() => null);
    pending.set(key, promise);
    try {
      const result=await promise;
      if(sourceOnly) return result && (agent.kind !== 'Codex' || result.offset >= result.size) ? result : null;
      if(planOnly) return result&&result.offset>=result.size?structuredClone(result.plan):null;
      if(agent.kind==='Codex') return result&&(result.tokens||result.model||result.effort||result.limits.length||result.subagents)?normalizeActivity(result):null;
      const activity=normalizeActivity(result);
      return activity&&(activity.tokens||activity.model||activity.effort)?activity:null;
    } finally {if(pending.get(key)===promise) pending.delete(key);}
  };
  reader.readPlan=(agent,agents=[agent])=>reader(agent,agents,{planOnly:true});
  // Réservé aux lecteurs serveur : cette source contient des coordonnées privées.
  reader.readSource=(agent,agents=[agent])=>reader(agent,agents,{sourceOnly:true});
  return reader;
}

// Projection étroite des messages : jamais SELECT *, ni table credential.
export async function readOpenCodeTexts(source) {
  if (!source || !(await databaseStamp(source.path, source.root))) return null;
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(source.path, { readOnly: true });
  try {
    const messages = db.prepare(`SELECT id,time_created,
      json_extract(data,'$.time.completed') AS completed,
      json_extract(data,'$.finish') AS finish,
      json_extract(data,'$.error.name') AS error
      FROM message WHERE session_id=? AND json_valid(data)
      AND json_extract(data,'$.role')='assistant'
      ORDER BY time_created DESC,id DESC LIMIT 31`).all(source.sessionId);
    const parts = db.prepare(`SELECT substr(json_extract(data,'$.text'),1,20001) AS text
      FROM part WHERE session_id=? AND message_id=? AND json_valid(data)
      AND json_extract(data,'$.type')='text'
      AND COALESCE(json_extract(data,'$.synthetic'),0)=0
      AND COALESCE(json_extract(data,'$.ignored'),0)=0
      ORDER BY time_created,id LIMIT 33`);
    return { complete: messages.length <= 30, messages: messages.slice(0,30).reverse().map(message => ({
      ...message, parts: parts.all(source.sessionId,message.id),
    })) };
  } finally { db.close(); }
}

export const readAgentActivity = createAgentActivityReader();
