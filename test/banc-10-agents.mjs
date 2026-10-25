// Pont Herdr factice de 10 agents, avec compteurs d'appels.
//
// Objectif : mesurer ce que le serveur réellement fait appeler à Herdr quand
// l'équipe passe à 10 agents, avant de toucher à quoi que ce soit. Chaque
// compteur est incrémenté au moment exact où le serveur demande le travail :
//   - list / prompt / read / broadcast : le pont (src/herdr.mjs côté serveur) ;
//   - terminal : la lecture légère du panneau (src/terminal-status.mjs), qui
//     dans la production lance `herdr agent read <panneau> --source detection` ;
//   - journal : la lecture du journal local d'activité (src/agent-activity.mjs),
//     appelée par limiteQuota() pour le quota et par /api/state pour l'affichage.
// Les lectures de journaux sont branchées sur les VRAIS lecteurs du projet,
// mais sur des racines temporaires vides : la mesure ne dépend pas des journaux
// de ce poste et reste la même ailleurs.
//
// Deux options pour les scénarios d'intégration :
//   - panneaux : la liste exacte d'agents à garder (défaut : les 10) ;
//   - rouvrir() : referme le serveur courant et en ouvre un second sur les
//     MÊMES fichiers, pour observer un redémarrage du bureau.
// appel() renvoie {status, type, data} : type est l'en-tête Content-Type.
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBureauServer } from '../server.mjs';
import { createTodosReader } from '../src/todos.mjs';
import { createAgentResponsesReader, readClaudeResponses } from '../src/responses.mjs';
import { createAgentActivityReader } from '../src/agent-activity.mjs';
import { createTerminalStatusReader } from '../src/terminal-status.mjs';
import { readClaudeActivity } from '../src/claude-activity.mjs';
import { readDelegations } from '../src/delegations.mjs';

// Panneaux, kinds et états variés : Claude, Codex, OpenCode, Antigravity et
// d'autres outils, avec idle, working, waiting, done, blocked et ready à true
// comme à false. « waiting » n'existe pas dans Herdr (qui connaît travail,
// disponible, attente, terminé, inconnu) : il est gardé tel quel pour vérifier
// qu'un état hors liste ne reçoit jamais d'envoi automatique.
export const PANNEAUX = [
  { paneId: 'w1:p1', kind: 'Claude', nom: 'Claude', status: 'idle', ready: true },
  { paneId: 'w1:p2', kind: 'Codex', nom: 'Codex', status: 'working', ready: false },
  { paneId: 'w1:p3', kind: 'OpenCode', nom: 'OpenCode', status: 'idle', ready: true },
  { paneId: 'w1:p4', kind: 'Antigravity', nom: 'Antigravity', status: 'done', ready: true },
  { paneId: 'w2:p1', kind: 'Gemini', nom: 'Gemini', status: 'working', ready: false },
  { paneId: 'w2:p2', kind: 'Cursor', nom: 'Cursor', status: 'blocked', ready: false },
  { paneId: 'w2:p3', kind: 'Kimi', nom: 'Kimi', status: 'waiting', ready: false },
  { paneId: 'w2:p4', kind: 'Grok', nom: 'Grok', status: 'idle', ready: true },
  { paneId: 'w3:p1', kind: 'Qwen', nom: 'Qwen', status: 'done', ready: false },
  { paneId: 'w3:p2', kind: 'Devin', nom: 'Devin', status: 'idle', ready: false },
];
export const NOMBRE = PANNEAUX.length;
export const PANNEAU_EN_PAUSE = 'w1:p2';   // Codex : pause de quota vue du terminal
export const SESSION_CLAUDE = '11111111-1111-4111-8111-111111111111';
// Message réel d'un outil d'IA en pause, avec une heure qui reste dans le futur
// tant que l'horloge du test est réglée avant 23:59.
export const TEXTE_PAUSE = "You've hit your usage limit · try again at 23:59";
export const TEXTE_NEUTRE = 'Prêt pour une consigne.\n';

const empreinte = value => createHash('sha256').update(value).digest('hex').slice(0, 16);

export function nouveauCompteur() {
  return {
    list: 0, prompt: 0, read: 0, broadcast: 0,
    terminal: 0, journal: 0, claude: 0, reponses: 0, todos: 0, delegations: 0,
    terminalPar: new Map(), journalPar: new Map(),
  };
}
// Appels qui deviennent des commandes Herdr dans la production.
export const appelsHerdr = n => n.list + n.prompt + n.read + n.broadcast + n.terminal;

const plus1 = (carte, cle) => carte.set(cle, (carte.get(cle) ?? 0) + 1);

export async function creerBanc(t, options = {}) {
  const { delaiTerminal = 0, maintenant = () => Date.now(), panneaux = PANNEAUX } = options;
  const racine = await mkdtemp(join(tmpdir(), 'banc-10-'));
  t.after(() => rm(racine, { recursive: true, force: true }));
  const chemins = {
    projet: join(racine, 'projet'),
    claude: join(racine, 'claude'),
    codex: join(racine, 'codex'),
    opencode: join(racine, 'opencode'),
    agents: join(racine, 'agents'),
    pieces: join(racine, 'pieces'),
  };
  await Promise.all(Object.values(chemins).map(d => mkdir(d, { recursive: true })));
  // Dossier de travail réel de chaque agent : les routes de fichiers et la
  // copie des pièces jointes exigent un dossier qui existe.
  await Promise.all(panneaux.map(p => mkdir(join(chemins.agents, p.paneId.replace(':', '-')), { recursive: true })));
  await mkdir(join(chemins.projet, 'docs'), { recursive: true });
  // Vrai fichier de tâches : /api/todos passe par le vrai lecteur de src/todos.mjs.
  await writeFile(join(chemins.projet, 'TODO.md'), [
    '# Tâches', '', '- [ ] Préparer le passage à 10 agents', '- [x] Mesurer les appels Herdr',
    '- [ ] Signaler le plafond d\'échanges', '- [ ] Relire la file d\'attente', '',
  ].join('\n'));
  await writeFile(join(chemins.projet, 'docs', 'plan-travail.md'), ['- [ ] Étape une', '- [x] Étape deux', ''].join('\n'));
  await writeFile(join(chemins.pieces, 'rapport.txt'), 'Contenu du rapport à joindre.\n');

  const etats = new Map(panneaux.map(p => [p.paneId, { ...p }]));
  let texteTerminal = panneau => (panneau === PANNEAU_EN_PAUSE ? TEXTE_PAUSE : TEXTE_NEUTRE);
  const agents = () => [...etats.values()].map(p => ({
    id: `${p.paneId}@${empreinte(p.paneId)}`,
    paneId: p.paneId,
    name: p.nom,
    kind: p.kind,
    status: p.status,
    ready: p.ready === true,
    cwd: join(chemins.agents, p.paneId.replace(':', '-')),
    workspaceId: p.paneId.split(':')[0],
    ...(p.kind === 'Claude' ? { sessionId: SESSION_CLAUDE } : {}),
  }));

  const n = nouveauCompteur();
  const raz = () => {
    Object.assign(n, nouveauCompteur());
  };
  const lecteurActivite = createAgentActivityReader({ codexRoot: chemins.codex, openCodeRoot: chemins.opencode });
  const lecteurReponses = createAgentResponsesReader({ codexRoot: chemins.codex, openCodeRoot: chemins.opencode });
  const lecteurTodos = createTodosReader({ projectRoot: chemins.projet, claudeRoot: chemins.claude, codexRoot: chemins.codex });
  const envois = [];

  const bridge = {
    async list() { n.list++; return agents(); },
    async prompt(id, message) { n.prompt++; envois.push({ id, message }); return { ok: true, message: 'Consigne transmise à Herdr.' }; },
    async read(id) { n.read++; return { id, text: TEXTE_NEUTRE }; },
    async broadcast(ids, message) {
      n.broadcast++;
      const results = [];
      for (const id of ids) {
        const agent = agents().find(a => a.id === id);
        if (!agent) { results.push({ id, name: '', ok: false, error: 'Agent introuvable.' }); continue; }
        if (agent.ready !== true) { results.push({ id, name: agent.name, ok: false, error: 'Cet agent n’est pas disponible.' }); continue; }
        envois.push({ id, message });
        results.push({ id, name: agent.name, ok: true, message: 'Consigne transmise à Herdr.' });
      }
      return { results };
    },
    async interrupt(id) { return { requested: true, id }; },
  };

  const optionsServeur = {
    bridge,
    now: maintenant,
    lireEtat: createTerminalStatusReader({
      now: maintenant,
      run: async panneau => {
        n.terminal++; plus1(n.terminalPar, panneau);
        if (delaiTerminal) await new Promise(resolve => setTimeout(resolve, delaiTerminal));
        return texteTerminal(panneau);
      },
    }),
    readOtherActivity: async (agent, liste) => { n.journal++; plus1(n.journalPar, agent?.id ?? '?'); return lecteurActivite(agent, liste); },
    readActivity: async sessionId => { n.claude++; return readClaudeActivity(sessionId, { root: chemins.claude }); },
    getResponses: sessionId => { n.reponses++; return readClaudeResponses(sessionId, { root: chemins.claude }); },
    getOtherResponses: async (agent, liste) => { n.reponses++; return lecteurReponses(agent, liste); },
    getTodos: async liste => { n.todos++; return lecteurTodos(liste); },
    delegations: async sessionId => { n.delegations++; return readDelegations(sessionId, { root: chemins.claude }); },
    // Tableau mural vide pour les scénarios d'intégration : l'injection du tableau
    // dans les consignes d'autonomie est couverte par test/autonomie.test.mjs.
    getBlackboard: async () => ({}),
    queueFile: join(racine, 'file-attente.json'),
    criseFile: join(racine, 'crise.json'),
    directionFile: join(racine, 'direction.json'),
    piedFile: join(racine, 'pied.json'),
    getPlaces: () => ({ documents: { path: chemins.pieces } }),
  };
  let serveur = createBureauServer(optionsServeur);
  await new Promise(resolve => serveur.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { serveur.close(resolve); serveur.closeAllConnections?.(); }));

  let port = serveur.address().port;
  let origine = `http://127.0.0.1:${port}`;
  let jeton = null;
  const appel = async (chemin, { methode = 'GET', corps, entetes = {} } = {}) => {
    const reponse = await fetch(origine + chemin, {
      method: methode,
      headers: {
        Origin: origine,
        ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(jeton ? { 'X-Bureau-Token': jeton } : {}),
        ...entetes,
      },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });
    const texte = await reponse.text();
    let data = texte;
    try { data = JSON.parse(texte); } catch { /* réponse non JSON */ }
    return { status: reponse.status, type: reponse.headers.get('content-type'), data };
  };
  // Redémarrage sur les MÊMES fichiers : le serveur courant est refermé, le
  // suivant se reconstruit avec le même pont, les mêmes lecteurs et les mêmes
  // chemins (file-attente.json, crise.json, relais.json, autonomie.json, …).
  // Le jeton change à chaque écoute : appel() le reprend auprès de /api/state.
  const rouvrir = async () => {
    const ancien = serveur;
    await new Promise(resolve => { ancien.close(resolve); ancien.closeAllConnections?.(); });
    serveur = createBureauServer(optionsServeur);
    await new Promise(resolve => serveur.listen(0, '127.0.0.1', resolve));
    port = serveur.address().port;
    origine = `http://127.0.0.1:${port}`;
    const etatInitial = await appel('/api/state');
    jeton = etatInitial.data.token;
    return etatInitial;
  };
  const etat = await appel('/api/state');
  jeton = etat.data.token;
  raz();

  return {
    racine, chemins,
    get serveur() { return serveur; },
    get jeton() { return jeton; },
    get origine() { return origine; },
    rouvrir,
    bridge, n, raz, appelsHerdr: () => appelsHerdr(n),
    agents, envois, appel,
    // État d'un panneau, pour faire évoluer l'équipe entre deux cycles.
    statut(paneId, status, ready = ['idle', 'done'].includes(status)) {
      const panneau = etats.get(paneId);
      if (!panneau) throw new Error(`Panneau inconnu : ${paneId}`);
      panneau.status = status;
      panneau.ready = ready;
    },
    // Panneau supplémentaire, pour vérifier les plafonds au-delà de 10 agents.
    ajouterAgent({ paneId, kind = 'Gemini', nom, status = 'idle', ready = true }) {
      if (etats.has(paneId)) throw new Error(`Panneau déjà présent : ${paneId}`);
      mkdirSync(join(chemins.agents, paneId.replace(':', '-')), { recursive: true });
      etats.set(paneId, { paneId, kind, nom: nom ?? paneId, status, ready });
      return `${paneId}@${empreinte(paneId)}`;
    },
    texte(paneId, texteDuPanneau) { texteTerminal = panneau => (panneau === paneId ? texteDuPanneau : TEXTE_NEUTRE); },
    idDe(paneId) { return agents().find(a => a.paneId === paneId)?.id ?? null; },
    mesurer(label) {
      const debut = process.hrtime.bigint();
      return {
        depuis: debut,
        finir() {
          const ms = Number(process.hrtime.bigint() - debut) / 1e6;
          console.log(`MESURE ${label} : ${ms.toFixed(1)} ms, ${appelsHerdr(n)} appel(s) Herdr (list ${n.list}, prompt ${n.prompt}, read ${n.read}, broadcast ${n.broadcast}, terminal ${n.terminal}), ${n.journal} lecture(s) de journal`);
          return ms;
        },
      };
    },
  };
}
