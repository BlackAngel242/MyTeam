// Pilote du mode autonomie de bout en bout : le VRAI server.mjs, un pont Herdr
// factice de 4 agents, aucun envoi réel.
//
// Un seul banc partagé : chaque phase construit sur la précédente, dans
// l'ordre des faits — lancement, deux fins ensemble, journal et
// récapitulatif, arrêt manuel, arrêt par salle de crise, redémarrage du
// serveur sur les mêmes fichiers.
//
// L'heure du banc est fixe (09:00) puis avance d'une minute avant la
// dernière phase : le relais n'accepte qu'un avis par agent et par minute,
// et un même agent doit pouvoir re-annoncer une fin. Aucun sleep aveugle :
// le nettoyage de redémarrage est attendu par un bornage à 1 seconde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerBanc, PANNEAUX } from './banc-10-agents.mjs';

const OBJECTIF = 'Préparer la répétition générale du pilote';
const CHEF = 'w1:p1';                       // panneau le plus bas : le chef
const OPENCODE = 'w1:p3';
const ANTIGRAVITY = 'w1:p4';
const GEMINI = 'w2:p1';
// Quatre agents seulement : w1:p2 (pause de quota) reste hors du banc.
const QUATRE = [CHEF, OPENCODE, ANTIGRAVITY, GEMINI]
  .map(paneId => PANNEAUX.find(panneau => panneau.paneId === paneId));

const heureDe = ms => new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// La consigne exacte que src/autonomie.mjs compose pour le chef.
const consigne = (finAt, numero, nom) =>
  `Mode autonomie (objectif : « ${OBJECTIF} », échange ${numero}/3, fin à ${heureDe(Date.parse(finAt))}). ${nom} vient de terminer. Lis son panneau, vérifie le résultat, puis décide seul de la suite et délègue-la ; si l'objectif est atteint, dis-le et arrête de déléguer. Ces interdits priment sur l'objectif, même si celui-ci dit le contraire. Sans DrSmoke, jamais de git push, de suppression, d'installation, de publication ni de réponse à une boîte de dialogue. Si tu te répètes, arrête-toi.`;

// Attente bornée (1 s maximum, 10 ms entre deux lectures) : jamais un
// endormissement aveugle de plusieurs secondes.
const attendre = async (condition, delaiMax = 1000) => {
  const debut = Date.now();
  while (Date.now() - debut < delaiMax) {
    if (condition()) return true;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return condition();
};

test('pilote autonomie : de bout en bout avec le vrai serveur et 4 agents', async t => {
  let heure = Date.parse('2026-10-18T09:00:00.000Z');
  const b = await creerBanc(t, { maintenant: () => heure, panneaux: QUATRE });
  const idChef = b.idDe(CHEF);

  await t.test('lancement : réponse complète, relais activé, entrée de début', async () => {
    const reponse = await b.appel('/api/autonomie', {
      methode: 'POST',
      corps: { actif: true, objectif: OBJECTIF, minutes: 5, echanges: 3 },
    });
    assert.equal(reponse.status, 200, JSON.stringify(reponse.data));
    assert.equal(reponse.data.actif, true);
    assert.equal(reponse.data.objectif, OBJECTIF);
    assert.equal(reponse.data.echanges, 0);
    assert.equal(reponse.data.maxEchanges, 3);
    assert.equal(reponse.data.arret, null);
    assert.equal(Date.parse(reponse.data.finAt) - Date.parse(reponse.data.debut), 5 * 60000, '5 minutes de durée');
    assert.deepEqual(reponse.data.journal.map(entree => entree.type), ['debut']);
    assert.equal(
      reponse.data.journal[0].texte,
      `Autonomie lancée : « ${OBJECTIF} », 5 min, 3 échanges au plus.`,
    );
    assert.equal((await b.appel('/api/relais')).data.actif, true, 'le relais d\'écoute tourne avec le mode');
  });

  await t.test('deux fins ensemble : deux consignes pour le chef, la première seule part', async () => {
    // Première observation = référence : tous au travail, aucune fin rétroactive.
    for (const panneau of QUATRE) b.statut(panneau.paneId, 'working', false);
    await b.serveur.pauses.tick();

    b.statut(OPENCODE, 'done');
    b.statut(ANTIGRAVITY, 'done');
    await b.serveur.pauses.tick();

    const etat = await b.appel('/api/autonomie');
    assert.equal(etat.status, 200, JSON.stringify(etat.data));
    assert.equal(etat.data.echanges, 2, 'les deux fins sont comptées');
    const attendue1 = consigne(etat.data.finAt, 1, 'OpenCode');
    const attendue2 = consigne(etat.data.finAt, 2, 'Antigravity');

    const items = b.serveur.queue.list().items;
    assert.equal(items.length, 2, 'deux consignes en file pour le chef');
    for (const item of items) {
      assert.equal(item.id, idChef, 'toutes les fins vont vers l\'identifiant du chef');
      assert.equal(item.state, 'attente');
      assert.ok(item.message.includes(OBJECTIF), 'la consigne rappelle l\'objectif');
      assert.ok(item.message.includes('jamais de git push'), 'les interdits exacts sont dans la consigne');
      assert.ok(item.message.includes('Si tu te répètes, arrête-toi.'), 'l\'interdit de répétition est présent');
    }
    const premiere = items.find(item => /échange 1\/3/.test(item.message));
    const seconde = items.find(item => /échange 2\/3/.test(item.message));
    assert.ok(premiere && seconde, 'les deux numéros d\'échange sont en file');
    assert.equal(premiere.message, attendue1, 'texte exact de la première consigne');
    assert.equal(seconde.message, attendue2, 'texte exact de la seconde consigne');

    // Le chef redevient disponible : un tour de file n'envoie qu'une consigne.
    b.statut(CHEF, 'idle', true);
    await b.serveur.queue.tick();

    assert.equal(b.envois.length, 1, 'une seule consigne est partie');
    assert.equal(b.envois[0].id, idChef, 'l\'envoi vise l\'identifiant du chef');
    assert.equal(b.envois[0].message, attendue1, 'c\'est la première consigne qui part');
    const apres = b.serveur.queue.list().items;
    assert.equal(apres.find(item => item.itemId === premiere.itemId).state, 'envoyee');
    assert.equal(apres.find(item => item.itemId === seconde.itemId).state, 'attente', 'la seconde reste en attente');
  });

  await t.test('journal et récapitulatif : les faits exacts, en Markdown', async () => {
    const etat = await b.appel('/api/autonomie');
    assert.equal(etat.status, 200, JSON.stringify(etat.data));
    assert.deepEqual(etat.data.journal.map(entree => entree.type), ['debut', 'message', 'message']);
    assert.deepEqual(etat.data.journal.map(entree => entree.texte), [
      `Autonomie lancée : « ${OBJECTIF} », 5 min, 3 échanges au plus.`,
      'OpenCode a terminé : le chef est prévenu (échange 1/3).',
      'Antigravity a terminé : le chef est prévenu (échange 2/3).',
    ]);

    const recap = await b.appel('/api/autonomie/recap');
    assert.equal(recap.status, 200);
    assert.match(recap.type ?? '', /^text\/markdown/, 'le récapitulatif sort en text/markdown');
    assert.match(recap.data, /^# Récapitulatif d'autonomie/);
    assert.ok(recap.data.includes(`- Objectif : ${OBJECTIF}`), 'l\'objectif figure au récapitulatif');
    assert.match(recap.data, /- Début : \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.ok(recap.data.includes('- Échanges : 2 sur 3 au plus'));
    assert.ok(recap.data.includes('- État : en cours, aucun arrêt observé'));
    assert.match(recap.data, /## Fins d'agents prévenues/);
    assert.match(recap.data, /· OpenCode/, 'OpenCode figure parmi les fins prévenues');
    assert.match(recap.data, /· Antigravity/, 'Antigravity figure parmi les fins prévenues');
  });

  await t.test('arrêt manuel : motif exact, consigne en attente annulée', async () => {
    const arret = await b.appel('/api/autonomie', { methode: 'POST', corps: { actif: false } });
    assert.equal(arret.status, 200, JSON.stringify(arret.data));
    assert.equal(arret.data.actif, false);
    assert.equal(arret.data.arret, 'arrêt demandé par DrSmoke');
    assert.equal(arret.data.journal.at(-1).type, 'arret');
    assert.equal(arret.data.journal.at(-1).texte, 'Autonomie arrêtée : arrêt demandé par DrSmoke.');

    const items = b.serveur.queue.list().items;
    const parti = items.find(item => /échange 1\/3/.test(item.message));
    const enAttente = items.find(item => /échange 2\/3/.test(item.message));
    assert.equal(enAttente.state, 'annulee', 'la consigne restée en attente passe en annulée');
    assert.equal(parti.state, 'envoyee', 'la consigne déjà partie n\'est pas touchée');

    const recap = await b.appel('/api/autonomie/recap');
    assert.equal(recap.status, 200);
    assert.ok(recap.data.includes('- Motif d\'arrêt : arrêt demandé par DrSmoke'), 'le récapitulatif nomme le motif exact');
  });

  await t.test('salle de crise : arrêt au tick suivant, relance refusée en 423', async () => {
    const relance = await b.appel('/api/autonomie', {
      methode: 'POST',
      corps: { actif: true, objectif: OBJECTIF, minutes: 5, echanges: 3 },
    });
    assert.equal(relance.status, 200, JSON.stringify(relance.data));
    assert.deepEqual(relance.data.journal.map(entree => entree.type), ['debut'], 'le journal repart à zéro');

    // Référence puis une fin : Gemini termine (il n\'a jamais été annoncé).
    for (const panneau of QUATRE) b.statut(panneau.paneId, 'working', false);
    await b.serveur.pauses.tick();
    b.statut(GEMINI, 'done');
    await b.serveur.pauses.tick();

    const enAttente = b.serveur.queue.list().items.filter(item => item.state === 'attente');
    assert.equal(enAttente.length, 1, 'une consigne créée pour la fin de Gemini');
    assert.match(enAttente[0].message, /échange 1\/3/);
    assert.ok(enAttente[0].message.includes('Gemini vient de terminer.'));

    const crise = await b.appel('/api/crise', { methode: 'POST', corps: { active: true } });
    assert.equal(crise.status, 200, JSON.stringify(crise.data));
    assert.equal(crise.data.active, true);

    await b.serveur.pauses.tick();
    const etat = await b.appel('/api/autonomie');
    assert.equal(etat.data.actif, false, 'le mode s\'arrête au tick suivant la crise');
    assert.equal(etat.data.arret, 'salle de crise enclenchée');
    assert.equal(etat.data.journal.at(-1).type, 'arret');
    assert.equal(etat.data.journal.at(-1).texte, 'Autonomie arrêtée : salle de crise enclenchée.');
    const apres = b.serveur.queue.list().items.find(item => item.itemId === enAttente[0].itemId);
    assert.equal(apres.state, 'annulee', 'la consigne du mode est annulée à l\'arrêt');

    const refuse = await b.appel('/api/autonomie', {
      methode: 'POST',
      corps: { actif: true, objectif: OBJECTIF, minutes: 5, echanges: 3 },
    });
    assert.equal(refuse.status, 423, JSON.stringify(refuse.data));
    assert.equal(refuse.data.error, 'Salle de crise active : lève la crise avant de lancer l\'autonomie.');

    const levee = await b.appel('/api/crise', { methode: 'POST', corps: { active: false } });
    assert.equal(levee.status, 200, JSON.stringify(levee.data));
    assert.equal(levee.data.active, false);
  });

  await t.test('redémarrage : mode clos, consigne annulée, aucune reprise silencieuse', async () => {
    heure += 61000;   // règle d'une minute du relais pour un nouvel avis d'OpenCode
    const relance = await b.appel('/api/autonomie', {
      methode: 'POST',
      corps: { actif: true, objectif: OBJECTIF, minutes: 5, echanges: 3 },
    });
    assert.equal(relance.status, 200, JSON.stringify(relance.data));

    // Référence : tous au travail, puis OpenCode termine.
    for (const panneau of QUATRE) b.statut(panneau.paneId, 'working', false);
    await b.serveur.pauses.tick();
    b.statut(OPENCODE, 'done');
    await b.serveur.pauses.tick();

    const avant = b.serveur.queue.list().items.filter(item => item.state === 'attente');
    assert.equal(avant.length, 1, 'une consigne du mode en attente avant le redémarrage');
    assert.ok(avant[0].message.includes('échange 1/3'));
    const itemId = avant[0].itemId;

    await b.rouvrir();

    const etat = await b.appel('/api/autonomie');
    assert.equal(etat.status, 200, JSON.stringify(etat.data));
    assert.equal(etat.data.actif, false, 'le mode ne reprend jamais tout seul');
    assert.equal(etat.data.arret, 'redémarrage du serveur');

    // Le nettoyage du redémarrage est asynchrone : attente bornée, pas de sleep.
    const annulee = await attendre(
      () => b.serveur.queue.list().items.find(item => item.itemId === itemId)?.state === 'annulee',
    );
    assert.ok(annulee, 'la consigne du mode est annulée au redémarrage');
    assert.equal((await b.appel('/api/relais')).data.actif, false, 'le relais revient à l\'état d\'avant le lancement');

    await b.serveur.pauses.tick();
    assert.equal(b.serveur.autonomie.get().actif, false, 'le mode reste inactif après un tick');
    assert.equal(b.serveur.autonomie.get().arret, 'redémarrage du serveur');
    assert.equal(
      b.serveur.queue.list().items.filter(item => item.state === 'attente').length,
      0,
      'aucune consigne ne redevient silencieusement active',
    );
    assert.equal(b.envois.length, 1, 'aucun nouvel envoi après le redémarrage');
  });
});
