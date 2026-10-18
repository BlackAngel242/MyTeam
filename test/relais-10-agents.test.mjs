// Relais et autonomie avec 10 agents qui terminent en même temps.
//
// Scénario : les agents passent en « done » au même instant, mode autonomie
// actif. On compte les consignes créées pour le chef et les appels Herdr, on
// vérifie la détection de boucle, le plafond d'échanges, et la course entre
// passer() et arreter() relevée par la revue rouge-équipe.
//
// Deux points restent des constats, sans correction de ma part :
//   - le plafond de 5 consignes en attente par agent tronque une rafale de 9 fins ;
//   - passer() renvoie toujours le message brut du relais quand le mode est clos
//     et que le relais reste actif (src/autonomie.mjs, hors de mon périmètre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAutonomie, LIMITES } from '../src/autonomie.mjs';
import { creerBanc, NOMBRE, PANNEAUX } from './banc-10-agents.mjs';

const CHEF = 'w1:p1';   // panneau le plus bas : le chef selon la règle
const AUTRES = PANNEAUX.map(panneau => panneau.paneId).filter(pane => pane !== CHEF);

// Tous les agents au travail, l'autonomie lancée, la première observation
// sert de référence au relais (aucune fin rétropective).
async function equipePretAPrendre(b, { objectif = 'Finir le lot des 10 agents', echanges = 20, relaisAvant = false } = {}) {
  for (const pane of PANNEAUX) b.statut(pane.paneId, 'working', false);
  if (relaisAvant) {
    const ouvert = await b.appel('/api/relais', { methode: 'POST', corps: { actif: true } });
    assert.equal(ouvert.status, 200, JSON.stringify(ouvert.data));
  }
  const lance = await b.appel('/api/autonomie', {
    methode: 'POST',
    corps: { actif: true, objectif, minutes: 30, echanges },
  });
  assert.equal(lance.status, 200, JSON.stringify(lance.data));
  assert.equal((await b.appel('/api/relais')).data.actif, true, 'le relais d\'écoute est actif');
  await b.serveur.pauses.tick();
}

test('dix fins en même temps : une seule rafale, budget d\'appels inchangé', async t => {
  const b = await creerBanc(t);
  await equipePretAPrendre(b);

  // Les 9 agents autres que le chef terminent au même instant.
  for (const pane of AUTRES) b.statut(pane, 'done', true);
  b.raz();
  const mesure = b.mesurer('rafale de 10 fins simultanées');
  await b.serveur.pauses.tick();
  mesure.finir();

  const items = b.serveur.queue.list().items;
  console.log(`MESURE 10 fins simultanées : ${items.length} consigne(s) créée(s) pour ${AUTRES.length} fins, ${b.appelsHerdr()} appel(s) Herdr (list ${b.n.list}, terminal ${b.n.terminal}, quota ${b.n.journal})`);

  // Pas de tempête : au plus une consigne par fin, et jamais au-delà du plafond
  // de 5 consignes en attente par agent de la file d'attente.
  assert.ok(items.length <= 5, `plafond de la file dépassé : ${items.length} consignes en attente pour le chef`);
  assert.equal(items.length, 5, 'CONSTAT : la rafale remplit les 5 places du plafond par agent');
  const chef = b.idDe(CHEF);
  for (const item of items) assert.equal(item.id, chef, 'toutes les fins vont au chef');
  assert.equal(new Set(items.map(item => item.message)).size, items.length, 'deux fins différentes ne fabriquent jamais le même texte');
  // Les 4 fins restantes n'ont aucune consigne : leur transition est déjà
  // consommée par le relais, elles ne reparaîtront qu'au prochain changement
  // d'état de ces agents. À arbitrer avec le chef : élargir le plafond pour les
  // événements internes, ou rejouer les fins non servies.

  // Budget du cycle : 1 liste + 1 panneau par agent, quota lu une fois par agent.
  assert.equal(b.n.list, 1);
  assert.equal(b.n.terminal, NOMBRE);
  assert.equal(b.n.journal, NOMBRE - 1);
  assert.ok(b.appelsHerdr() <= 1 + NOMBRE, `budget dépassé : ${b.appelsHerdr()} appels`);

  // Envoi : le chef redevient disponible, la file ne parle qu'à lui, donc au
  // plus un envoi par tour.
  b.statut(CHEF, 'idle', true);
  b.raz();
  let tours = 0;
  while (b.envois.length < items.length && tours < 20) { await b.serveur.queue.tick(); tours++; }
  assert.equal(b.envois.length, items.length, 'toutes les consignes sont parties');
  assert.equal(b.n.prompt, items.length, 'une commande de prompt par consigne');
  assert.ok(b.n.list <= tours + items.length, `budget de liste dépassé : ${b.n.list} pour ${tours} tours et ${items.length} envois`);
  console.log(`MESURE envoi des ${items.length} consignes : ${tours} tour(s), ${b.n.list} liste(s), ${b.n.prompt} prompt(s), ${b.appelsHerdr()} appel(s) Herdr`);
});

test('plafond d\'échanges : exactement le nombre autorisé de messages, puis le relais se referme', async t => {
  // LIMITES.echanges est vérifié après la mise en file du message qui l'atteint :
  // c'est juste, on obtient exactement N messages. Les fins restantes de la même
  // observation s'arrêtent parce que l'arrêt du mode désactive aussi le relais.
  const b = await creerBanc(t);
  await equipePretAPrendre(b, { echanges: 3 });

  for (const pane of AUTRES) b.statut(pane, 'done', true);
  b.raz();
  await b.serveur.pauses.tick();

  const items = b.serveur.queue.list().items;
  const encadrees = items.filter(item => /échange \d+\/3/.test(item.message));
  const sansCadran = items.filter(item => !/échange/.test(item.message));
  const etat = b.serveur.autonomie.get();
  console.log(`MESURE plafond d'échanges à 3 : ${items.length} consigne(s), ${encadrees.length} encadrée(s), ${sansCadran.length} en clair, mode actif : ${etat.actif}, relais actif : ${(await b.appel('/api/relais')).data.actif}, ${b.appelsHerdr()} appel(s) Herdr`);

  assert.equal(items.length, 3, 'trois échanges demandés, trois consignes créées');
  assert.equal(encadrees.length, 3, 'chaque consigne porte son numéro d\'échange');
  assert.equal(sansCadran.length, 0, 'aucune consigne hors cadran ne part vers le chef');
  assert.equal(etat.actif, false, 'le mode s\'arrête au plafond');
  assert.match(etat.arret, /plafond d'échanges/);
  assert.equal((await b.appel('/api/relais')).data.actif, false, 'le relais repasse à l\'état d\'avant le lancement');
  assert.ok(b.appelsHerdr() <= 1 + NOMBRE, `budget dépassé : ${b.appelsHerdr()} appels`);
});

test('CONSTAT : relais déjà actif, le plafond ferme l\'autonomie mais les fins suivantes restent en clair', async t => {
  // Quand le relais était déjà allumé avant le lancement, l'arrêt du mode le
  // laisse actif : passer() trouve etat à null et renvoie alors le message brut
  // du relais, sans numéro d'échange. Le plafond d'échanges n'arrête donc pas
  // les messages au-delà de N quand le relais reste ouvert ; seule la série de
  // 5 consignes en attente de la file les interrompt.
  // Correctif attendu dans src/autonomie.mjs, dont je n'ai pas la propriété.
  const b = await creerBanc(t);
  await equipePretAPrendre(b, { echanges: 3, relaisAvant: true });

  for (const pane of AUTRES) b.statut(pane, 'done', true);
  b.raz();
  await b.serveur.pauses.tick();

  const items = b.serveur.queue.list().items;
  const encadrees = items.filter(item => /échange \d+\/3/.test(item.message));
  const sansCadran = items.filter(item => !/échange/.test(item.message));
  const chef = b.idDe(CHEF);
  console.log(`MESURE relais ouvert avant le lancement : ${items.length} consigne(s), ${encadrees.length} encadrée(s), ${sansCadran.length} en clair, états : ${items.map(item => item.state).join('/')}, ids : ${items.map(item => item.id === chef ? 'chef' : item.id).join('/')}`);

  assert.equal(encadrees.length, 3, 'le plafond compte juste : trois messages encadrés');
  assert.ok(encadrees.every(item => item.state === 'annulee'), 'les trois consignes du mode sont retirées de la file à l\'arrêt');
  assert.equal(b.serveur.autonomie.get().actif, false, 'le mode est clos');
  assert.equal((await b.appel('/api/relais')).data.actif, true, 'le relais ouvert par DrSmoke reste ouvert');
  assert.equal(sansCadran.length, 5, 'CONSTAT : les fins restantes partent en clair, jusqu\'au plafond de 5 de la file');
  assert.ok(sansCadran.every(item => item.state === 'attente'), 'les messages bruts restent en attente d\'envoi');
  assert.equal(items.length, 8, 'CONSTAT : 3 consignes du mode retirées à l\'arrêt, 5 messages bruts ajoutés, la 9e fin échoue sur le plafond de la file');
});

test('boucle : un même agent qui termine 4 fois en 10 minutes arrête le mode', async t => {
  let heure = Date.parse('2026-10-18T09:00:00.000Z');
  const b = await creerBanc(t, { maintenant: () => heure });
  await equipePretAPrendre(b);

  const cible = 'w1:p3';   // OpenCode
  for (let fin = 1; fin <= LIMITES.boucle.fins; fin++) {
    b.statut(cible, 'done', true);
    await b.serveur.pauses.tick();
    b.statut(cible, 'working', false);
    await b.serveur.pauses.tick();
    heure += 61000;   // la règle d'une minute du relais est respectée
  }

  const etat = b.serveur.autonomie.get();
  const items = b.serveur.queue.list().items;
  console.log(`MESURE boucle : ${items.length} consigne(s) après ${LIMITES.boucle.fins} fins du même agent, mode actif : ${etat.actif}, motif : ${etat.arret}`);

  assert.equal(etat.actif, false, 'la boucle arrête le mode autonomie');
  assert.match(etat.arret, /boucle détectée/);
  assert.equal(items.length, LIMITES.boucle.fins - 1, 'la quatrième fin ne produit aucune consigne');
  assert.equal((await b.appel('/api/relais')).data.actif, false, 'le relais repasse à l\'état d\'avant le lancement');
});

test('course entre passer() et arreter() : l\'arrêt attend l\'envoi et retire la consigne déjà en file', async t => {
  const racine = await mkdtemp(join(tmpdir(), 'course-autonomie-'));
  t.after(() => rm(racine, { recursive: true, force: true }));
  const miseEnFile = [], retirees = [];
  let relache;
  const gate = new Promise(resolve => { relache = resolve; });
  let heure = Date.parse('2026-10-18T09:00:00.000Z');
  const autonomie = createAutonomie({
    file: join(racine, 'autonomie.json'),
    relais: { get: () => ({ actif: false }), set: async valeur => ({ actif: valeur }), observe: async () => {} },
    now: () => heure,
    enqueue: async item => { miseEnFile.push(item); await gate; return { itemId: 'q-course-1' }; },
    cancel: async itemId => { retirees.push(itemId); },
  });
  await autonomie.demarrer({ objectif: 'Vérifier la course', minutes: 5, echanges: 20 });

  const envoi = autonomie.passer(
    { id: 'chef', message: 'Fin d\'un agent', requestKey: 'course-1' },
    { agent: { id: 'w1:p3', name: 'OpenCode' } },
  );
  while (miseEnFile.length === 0) await new Promise(resolve => setImmediate(resolve));

  // L'arrêt est demandé pendant que passer() attend la mise en file.
  const arret = autonomie.arreter();
  heure += 1000;
  relache();

  await assert.doesNotReject(Promise.all([envoi, arret]), 'aucune erreur pendant l\'arrêt : etat n\'est pas mis à null à partir d\'un autre appel');
  assert.equal(autonomie.get().actif, false, 'le mode est bien arrêté');
  assert.deepEqual(retirees, ['q-course-1'], 'la consigne mise en file pendant l\'arrêt est retirée');
  assert.equal(autonomie.get().journal.at(-1)?.type, 'arret', 'l\'arrêt est journalisé');
});
