// Banc de mesure du serveur avec 10 agents (pont Herdr factice compté).
//
// Trois familles de mesures, toutes sur le code réel du serveur :
//   1. durée de GET /api/state, /api/discussion et /api/todos ;
//   2. budget d'appels Herdr par cycle de sondage (20 s) et par tour de file (15 s),
//      plus la reprise après une pause de quota ;
//   3. plafonds vérifiés : envoi groupé à 12 destinataires et consignes en attente
//      par agent.
// Chaque budget est écrit comme une inégalule vérifiable : le test échoue si le
// serveur commence à appeler Herdr davantage qu'aujourd'hui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creerBanc, NOMBRE, PANNEAUX, PANNEAU_EN_PAUSE, TEXTE_NEUTRE } from './banc-10-agents.mjs';
import { createQueue } from '../src/queue.mjs';

// Plafond de durée : volontairement large (la machine exécute souvent plusieurs
// suites de tests en parallèle, et l'antivirus ralentit les créations de
// fichiers temporaires). Les mesures réelles sont affichées par le banc à côté
// de ce test ; les budgets d'appels Herdr, eux, restent stricts et inchangés.
const PLAFOND_MS = 5000;

test('durées des trois routes principales avec 10 agents', async t => {
  const b = await creerBanc(t);
  for (const [label, chemin, agentsAttendus] of [
    ['GET /api/state', '/api/state', NOMBRE],
    ['GET /api/discussion', '/api/discussion', null],
    ['GET /api/todos', '/api/todos', null],
  ]) {
    b.raz();
    const mesure = b.mesurer(label);
    const reponse = await b.appel(chemin);
    const ms = mesure.finir();
    assert.equal(reponse.status, 200, reponse.status === 200 ? '' : `${label} : ${JSON.stringify(reponse.data)}`);
    if (agentsAttendus !== null) assert.equal(reponse.data.agents.length, agentsAttendus);
    assert.ok(ms <= PLAFOND_MS, `${label} : ${ms.toFixed(1)} ms au-delà du plafond de ${PLAFOND_MS} ms`);
  }
});

test('cycle de sondage : 1 liste et 1 lecture de panneau par agent, quota lu une fois par agent', async t => {
  const b = await creerBanc(t);
  await b.serveur.pauses.tick();   // état initial
  b.raz();
  const mesure = b.mesurer('cycle de sondage à 10 agents');
  await b.serveur.pauses.tick();   // cycle mesuré
  mesure.finir();

  assert.equal(b.n.list, 1, 'une seule commande de liste par cycle');
  assert.equal(b.n.terminal, NOMBRE, 'un panneau lu par agent et par cycle');
  assert.equal(b.n.terminalPar.size, NOMBRE, 'chaque panneau est lu une fois');
  for (const [pane, compte] of b.n.terminalPar) assert.equal(compte, 1, `panneau ${pane} lu ${compte} fois`);

  // Quota : limiteQuota() ne lit le journal que pour les non Claude (9 sur 10),
  // et seulement une fois par agent, dans reprendreApresPause().
  assert.equal(b.n.journal, NOMBRE - 1, 'le quota est lu une fois par agent non Claude');
  assert.equal(b.n.journalPar.size, NOMBRE - 1);
  for (const [id, compte] of b.n.journalPar) assert.equal(compte, 1, `quota de ${id} lu ${compte} fois dans le même cycle`);

  // Budget explicite : 1 liste + 1 panneau par agent.
  assert.ok(b.appelsHerdr() <= 1 + NOMBRE, `budget dépassé : ${b.appelsHerdr()} appels pour un budget de ${1 + NOMBRE}`);
});

test('deux cycles de sondage lancés en même temps ne doublent pas les appels Herdr', async t => {
  // Un Herdr lent (8 s de délai maximal par lecture dans la production) fait
  // dépasser les 20 s de cadence : le tour suivant démarre alors que le
  // précédent n'est pas fini. Sans garde, les appels se multiplient.
  const b = await creerBanc(t, { delaiTerminal: 40 });
  await b.serveur.pauses.tick();
  b.raz();
  await Promise.all([b.serveur.pauses.tick(), b.serveur.pauses.tick()]);

  assert.equal(b.n.list, 1, 'les deux cycles partagent une seule commande de liste');
  assert.equal(b.n.terminal, NOMBRE, 'chaque panneau reste lu une fois');
  assert.ok(b.appelsHerdr() <= 1 + NOMBRE, `budget dépassé : ${b.appelsHerdr()} appels`);
});

test('tour de file : budget d\'appels pour 8 consignes réparties sur 4 agents', async t => {
  const b = await creerBanc(t);
  await b.serveur.pauses.tick();
  // Quatre cibles réellement prêtes : idle ou done, et ready à true.
  const cibles = ['w1:p1', 'w1:p3', 'w1:p4', 'w2:p4'];
  for (const pane of cibles) {
    for (const rang of [1, 2]) {
      await b.serveur.queue.enqueue({ id: b.idDe(pane), message: `Consigne ${pane} numéro ${rang}` });
    }
  }
  b.raz();
  const mesure = b.mesurer('queue.tick 8 consignes');
  await b.serveur.queue.tick();
  await b.serveur.queue.tick();   // au plus un envoi par agent et par tour
  const ms = mesure.finir();

  assert.equal(b.envois.length, 8, 'les 8 consignes sont parties en deux tours');
  assert.equal(b.n.prompt, 8, 'une commande de prompt par consigne');

  // Budget par tour de file : 1 liste pour ouvrir le tour + 1 liste de
  // revérification juste avant chaque envoi (règle de la rouge-équipe).
  const tours = 2;
  assert.ok(b.n.list <= tours + b.envois.length, `budget de liste dépassé : ${b.n.list} pour ${tours} tours et ${b.envois.length} envois`);
  // Quota : une lecture par agent cible et par tour (Claude prend son quota
  // dans le terminal, pas dans le journal : 3 lectures par tour mesurées).
  assert.ok(b.n.journal <= tours * cibles.length, `quota lu ${b.n.journal} fois pour ${tours} tours et ${cibles.length} cibles`);
  assert.ok(b.appelsHerdr() <= tours + 2 * b.envois.length, `budget d'appels dépassé : ${b.appelsHerdr()}`);
  console.log(`MESURE tour de file : ${ms.toFixed(1)} ms, ${b.n.list} liste(s), ${b.n.prompt} prompt(s), ${b.n.journal} quota(s), ${b.appelsHerdr()} appel(s) Herdr`);
});

test('tour de file avec fichier joint : la liste n\'est pas relue deux fois de suite', async t => {
  const b = await creerBanc(t);
  await b.serveur.pauses.tick();
  const ajout = await b.appel('/api/queue', {
    methode: 'POST',
    corps: { id: b.idDe('w1:p3'), message: 'Analyse le rapport joint', files: [{ root: 'documents', path: 'rapport.txt' }] },
  });
  assert.equal(ajout.status, 200, JSON.stringify(ajout.data));

  b.raz();
  await b.serveur.queue.tick();
  assert.equal(b.envois.length, 1, 'la consigne avec fichier est partie');

  // Budget d'un envoi avec fichier : 1 liste au début du tour, 1 pour les
  // lieux autorisés (copie), 1 revérification après la copie, 1 dernière
  // juste avant l'envoi. Deux lectures de suite pour le même contrôle
  // (quota puis cible) sont un appel Herdr de trop.
  const budgetListe = 4;
  assert.ok(b.n.list <= budgetListe, `liste relue ${b.n.list} fois pour un envoi avec fichier (budget ${budgetListe})`);
  assert.equal(b.n.prompt, 1);
  // Quota : contrôle au début du tour + revérification après la copie.
  assert.ok(b.n.journal <= 2, `quota lu ${b.n.journal} fois (budget 2)`);
  console.log(`MESURE envoi avec fichier : ${b.n.list} liste(s), ${b.n.journal} quota(s), ${b.n.prompt} prompt(s)`);
});

test('reprise après pause : le quota n\'est lu qu\'une fois par agent et par cycle', async t => {
  let heure = Date.parse('2026-10-18T09:00:00.000Z');
  const b = await creerBanc(t, { maintenant: () => heure });

  // Cycle 1 : la pause de Codex est vue dans son panneau.
  b.raz();
  await b.serveur.pauses.tick();
  const idPause = b.idDe(PANNEAU_EN_PAUSE);
  const pause = b.serveur.pauses.etatDe(idPause);
  assert.equal(pause?.limitReached, true, 'la pause de quota est détectée dans le terminal');
  assert.ok(Date.parse(pause.resetsAt) > heure, 'la remise à zéro annoncée est dans le futur');
  assert.equal(b.n.terminal, NOMBRE);
  assert.equal(b.n.journal, NOMBRE - 1, 'une seule lecture de quota par agent non Claude');
  for (const [id, compte] of b.n.journalPar) assert.equal(compte, 1, `quota de ${id} lu ${compte} fois`);

  // La pause se lève : Codex redevient disponible, l'heure de retour est passée.
  b.texte(PANNEAU_EN_PAUSE, TEXTE_NEUTRE);
  b.statut(PANNEAU_EN_PAUSE, 'idle', true);
  heure = Date.parse(pause.resetsAt) + 61000;
  b.raz();
  const mesure = b.mesurer('cycle de reprise après pause');
  await b.serveur.pauses.tick();
  mesure.finir();

  // Une seule consigne de reprise, mise en file sans appel Herdr.
  const enFile = b.serveur.queue.list().items;
  assert.equal(enFile.length, 1, 'une seule consigne de reprise');
  assert.equal(enFile[0].id, idPause);
  assert.match(enFile[0].message, /limite d'usage est levée/);

  // Le cycle de reprise respecte le même budget que n'importe quel cycle.
  assert.equal(b.n.list, 1, 'une seule commande de liste pendant le cycle de reprise');
  assert.equal(b.n.terminal, NOMBRE);
  assert.equal(b.n.journal, NOMBRE - 1, 'le quota de chaque agent reste lu une seule fois');
  for (const [id, compte] of b.n.journalPar) assert.equal(compte, 1, `quota de ${id} lu ${compte} fois dans le cycle de reprise`);
  assert.ok(b.appelsHerdr() <= 1 + NOMBRE, `budget dépassé : ${b.appelsHerdr()} appels`);

  // Deuxième cycle : la reprise n'est pas refaite.
  b.raz();
  await b.serveur.pauses.tick();
  assert.equal(b.serveur.queue.list().items.length, 1, 'une seule consigne de reprise, jamais deux');

  // Envoi de la reprise par la file : 1 liste pour le tour, 1 avant l'envoi.
  b.raz();
  const envoi = b.mesurer('envoi de la reprise par la file');
  await b.serveur.queue.tick();
  envoi.finir();
  assert.equal(b.n.prompt, 1);
  assert.ok(b.n.list <= 2, `liste relue ${b.n.list} fois pour un envoi`);
});

test('envoi groupé : 13 destinataires refusés sans aucun envoi, 12 acceptés', async t => {
  const b = await creerBanc(t);
  // Douze agents réellement prêts : les dix du banc remis disponibles, plus deux.
  for (const pane of PANNEAUX) b.statut(pane.paneId, 'idle', true);
  b.ajouterAgent({ paneId: 'w9:p1', nom: 'Agent onze' });
  b.ajouterAgent({ paneId: 'w9:p2', nom: 'Agent douze' });
  const douze = b.agents();
  assert.equal(douze.length, 12);
  assert.equal(new Set(douze.map(agent => agent.id)).size, 12);

  b.raz();
  const refus = await b.appel('/api/broadcast', {
    methode: 'POST',
    corps: { ids: douze.map(agent => agent.id).concat('treizieme@0000000000000000'), message: 'Message de groupe' },
  });
  assert.equal(refus.status, 400, 'le plafond de 12 destinataires refuse la treizième cible');
  assert.match(refus.data.error, /1 à 12/);
  assert.equal(b.n.broadcast, 0, 'aucun appel Herdr quand la liste est trop longue');
  assert.equal(b.envois.length, 0);

  const accepte = await b.appel('/api/broadcast', { methode: 'POST', corps: { ids: douze.map(agent => agent.id), message: 'Message de groupe' } });
  assert.equal(accepte.status, 200);
  assert.equal(accepte.data.results.length, 12);
  assert.equal(b.envois.length, 12, 'les 12 destinataires reçoivent la consigne');
  assert.ok(b.n.broadcast <= 12, `${b.n.broadcast} appels de diffusion pour 12 destinataires`);
});

test('file d\'attente : plafond de 5 consignes en attente par agent', async t => {
  const racine = await mkdtemp(join(tmpdir(), 'file-par-agent-'));
  t.after(() => rm(racine, { recursive: true, force: true }));
  const file = join(racine, 'file-attente.json');
  const fileAttente = createQueue({ file, listAgents: async () => [], prompt: async () => ({ ok: true }) });

  // Cinq consignes acceptées pour un agent, la sixième refusée.
  for (const rang of [1, 2, 3, 4, 5]) {
    const ajout = await fileAttente.enqueue({ id: 'agent-banc', message: `Consigne ${rang}` });
    assert.equal(ajout.state, 'attente');
  }
  await assert.rejects(
    fileAttente.enqueue({ id: 'agent-banc', message: 'Consigne 6' }),
    /5 consignes en attente/,
    'le plafond par agent existe et refuse la sixième consigne',
  );
  // Un autre agent n'est pas touché par ce plafond.
  await fileAttente.enqueue({ id: 'autre-agent', message: 'Consigne pour un autre' });
  assert.equal(fileAttente.list().items.length, 6);

  // Le même plafond s'applique au chargement d'un fichier déjà trop rempli.
  const charge = join(racine, 'charge.json');
  await writeFile(charge, JSON.stringify({
    version: 2,
    items: Array.from({ length: 7 }, (_, index) => ({
      itemId: `q-charge-${index}`, id: 'agent-banc', message: `Consigne restaurée ${index}`,
      notBefore: null, priority: 'normale', state: 'attente',
      createdAt: '2026-10-18T09:00:00.000Z', updatedAt: '2026-10-18T09:00:00.000Z',
      sentAt: null, reason: null, holdUntil: null, requestKey: null, files: [], copiedFiles: [],
    })),
    cles: [],
  }), 'utf8');
  const rechargee = createQueue({ file: charge, listAgents: async () => [], prompt: async () => ({ ok: true }) });
  const etats = rechargee.list().items.map(item => item.state);
  assert.equal(etats.filter(etat => etat === 'attente').length, 5, 'cinq consignes seulement restent en attente');
  assert.equal(etats.filter(etat => etat === 'a_revoir').length, 2, 'le trop-plein passe à revoir sans envoi');
  for (const item of rechargee.list().items) {
    if (item.state === 'a_revoir') assert.match(item.reason, /maximum 5/);
  }
});
