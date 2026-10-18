import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalStatusReader, parseLimitMessage } from '../src/terminal-status.mjs';

// Midi local du 17 octobre 2026, pour des rÃ©sultats identiques dans tous les fuseaux.
const midi = new Date(2026, 9, 17, 12, 0, 0).getTime();
const maintenant = () => midi;
function attendu(heures, minutes, demain = false) {
  const d = new Date(midi);
  d.setHours(heures, minutes, 0, 0);
  if (demain) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

test('Â« You\'ve hit your usage limit â€¦ try again at 4:37 AM Â» est une limite atteinte', () => {
  const etat = parseLimitMessage("Vous avez terminÃ©. You've hit your usage limit Â· try again at 4:37 AM", { now: maintenant });
  assert.deepEqual(etat, { limitReached: true, resetsAt: attendu(4, 37, true), usedPercent: null, source: 'terminal' });
});

test('Â« limit reached â€¦ resets 7pm Â» est une limite atteinte', () => {
  const etat = parseLimitMessage('Limit reached. Try later or upgrade Â· resets 7pm', { now: maintenant });
  assert.deepEqual(etat, { limitReached: true, resetsAt: attendu(19, 0), usedPercent: null, source: 'terminal' });
});

test('Â« You\'ve used 91% of your session limit Â» donne le pourcentage sans limite atteinte', () => {
  const etat = parseLimitMessage("You've used 91% of your session limit Â· resets 4:40am", { now: maintenant });
  assert.deepEqual(etat, { limitReached: false, resetsAt: attendu(4, 40, true), usedPercent: 91, source: 'terminal' });
});

test('un pourcentage de 100 % compte comme limite atteinte', () => {
  const etat = parseLimitMessage("You've used 100% of your session limit Â· resets 4:40am", { now: maintenant });
  assert.equal(etat.limitReached, true);
  assert.equal(etat.usedPercent, 100);
});

test('Â« 103.1K (10%) Â» n\'est pas une limite', () => {
  assert.equal(parseLimitMessage('103.1K (10%)', { now: maintenant }), null);
  assert.equal(parseLimitMessage('Contexte : 2M (78%) Â· 3 warnings', { now: maintenant }), null);
  assert.equal(parseLimitMessage('Travail en cours, rien Ã  signaler.', { now: maintenant }), null);
});

test('une heure annoncÃ©e dÃ©jÃ  passÃ©e est reportÃ©e au lendemain, sinon gardÃ©e', () => {
  const troisHeures = new Date(2026, 9, 17, 3, 0, 0).getTime();
  const etat = parseLimitMessage("You've hit your usage limit Â· try again at 4:37 AM", { now: () => troisHeures });
  assert.equal(etat.resetsAt, attendu(4, 37, false), 'Ã  3 h du matin, 4:37 reste aujourd\'hui');
});

test('la ligne de limite est trouvÃ©e au milieu d\'un terminal bruyant', () => {
  const bruit = ['$ claude', 'RÃ©flexion en cours...', '103.1K (10%)', "You've hit your usage limit Â· try again at 4:37 AM", 'autre chose'].join('\n');
  const etat = parseLimitMessage(bruit, { now: maintenant });
  assert.equal(etat.limitReached, true);
  assert.equal(etat.resetsAt, attendu(4, 37, true));
});

test('la lecture de panneau passe le bon panneau et ne renvoie que le contrat', async t => {
  const appels = [];
  const lire = createTerminalStatusReader({
    now: () => midi,
    run: async panneau => { appels.push(panneau); return "limit reached Â· resets 7pm"; },
  });
  const etat = await lire({ paneId: 'w5:p2' });
  assert.deepEqual(appels, ['w5:p2']);
  assert.deepEqual(etat, { limitReached: true, resetsAt: attendu(19, 0), usedPercent: null, source: 'terminal' });
  assert.deepEqual(Object.keys(etat).sort(), ['limitReached', 'resetsAt', 'source', 'usedPercent'], 'aucun texte de terminal ne sort');
  assert.equal(await lire({ paneId: '../dangereux' }), null, 'un panneau illisible n\'est pas lu');
  assert.deepEqual(appels, ['w5:p2']);
});

test('une panne de lecture remonte au serveur au lieu d\'inventer une absence de limite', async () => {
  const lire = createTerminalStatusReader({ run: async () => { throw new Error('Herdr indisponible'); } });
  await assert.rejects(() => lire({ paneId: 'w5:p1' }), /Herdr indisponible/);
});

test('l\'heure coupée sur la ligne suivante par la largeur du panneau est retrouvée', () => {
  const ecran = ['■ You’ve hit your usage limit. Upgrade to Pro (https://', 'chatgpt.com/explore/pro), visit https://chatgpt.com/settings/', 'usage to purchase more credits or try again at 4:39 PM.', '', '› Ask Codex to do anything'].join('\n');
  const etat = parseLimitMessage(ecran, { now: maintenant });
  assert.equal(etat.limitReached, true);
  assert.equal(etat.resetsAt, attendu(16, 39));
});
