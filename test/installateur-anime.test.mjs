import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { parseLigne, etatInitial, appliquer, cadre, ajuster, commandeInstalleur, executer, bannière, bilanFin, touches, naviguerChoix, naviguerConfirmation } from '../scripts/installateur-anime.mjs';

test('le protocole est lu ligne par ligne, le reste est ignoré', () => {
  assert.deepEqual(parseLigne('@@PLAN node\tNode.js 22 ou plus'), { type: 'plan', id: 'node', libelle: 'Node.js 22 ou plus' });
  assert.deepEqual(parseLigne('@@STEP herdr'), { type: 'step', id: 'herdr' });
  assert.deepEqual(parseLigne('@@INFO Recherche de Herdr…'), { type: 'info', texte: 'Recherche de Herdr…' });
  assert.deepEqual(parseLigne('@@CONFIRM herdr\tInstaller Herdr ?\r'), { type: 'confirm', id: 'herdr', question: 'Installer Herdr ?' });
  assert.deepEqual(parseLigne('@@CHOICE config\tRaccourci ?\tHerdr\tBureau'), { type: 'choice', id: 'config', question: 'Raccourci ?', options: ['Herdr', 'Bureau'] });
  assert.deepEqual(parseLigne('@@INPUT kit\tDossier ?\t.'), { type: 'input', id: 'kit', question: 'Dossier ?', defaut: '.' });
  assert.deepEqual(parseLigne('@@DONE node\tok\tv24.22.0'), { type: 'done', id: 'node', etat: 'ok', texte: 'v24.22.0' });
  assert.deepEqual(parseLigne('@@END fail'), { type: 'end', ok: false });
  for (const ligne of ['journal brut', '@@INCONNU x', '@@DONE node\tpeut-etre', '@@CONFIRM sansquestion', '@@CHOICE a\tq']) assert.equal(parseLigne(ligne), null);
});

test('la liste de tâches se met à jour et le cadre montre l\'état de chaque tâche', () => {
  const e = etatInitial({ lang: 'fr' });
  for (const [id, l] of [['node', 'Node.js'], ['herdr', 'Herdr'], ['kit', 'Kit']]) appliquer(e, { type: 'plan', id, libelle: l });
  appliquer(e, { type: 'step', id: 'node' }); appliquer(e, { type: 'done', id: 'node', etat: 'ok', texte: 'v24' });
  appliquer(e, { type: 'step', id: 'herdr' }); appliquer(e, { type: 'info', texte: 'Téléchargement' });
  const image = cadre(e, 3, { couleur: false, largeur: 80 }).join('\n');
  assert.match(image, /✔ Node\.js\s+v24/);
  assert.match(image, /⠸ Herdr/);
  assert.match(image, /○ Kit/);
  assert.match(image, /Téléchargement/);
  appliquer(e, { type: 'done', id: 'herdr', etat: 'skip', texte: 'refusé' });
  appliquer(e, { type: 'done', id: 'kit', etat: 'fail', texte: 'erreur' });
  appliquer(e, { type: 'end', ok: false });
  const fin = cadre(e, 0, { couleur: false, largeur: 80 }).join('\n');
  assert.match(fin, /– Herdr/);
  assert.match(fin, /✖ Kit/);
  assert.match(fin, /arrêtée/);
  e.lang = 'en';
  assert.match(cadre(e, 0, { couleur: false, largeur: 80 }).join('\n'), /Installing MyTeam/);
});

test('une question est dessinée sous la liste et les lignes sont ajustées à la largeur', () => {
  const e = etatInitial({ lang: 'fr' });
  appliquer(e, { type: 'plan', id: 'herdr', libelle: 'Herdr' });
  e.question = { texte: 'Installer Herdr maintenant ?', invite: 'o = oui · n ou Entrée = non' };
  const lignes = cadre(e, 0, { couleur: false, largeur: 80 });
  assert.ok(lignes.some(l => l.includes('Installer Herdr maintenant ?')));
  assert.ok(lignes.some(l => l.includes('o = oui')));
  assert.equal(ajuster('abcdefghij', 5), 'abcde…');
  const E = String.fromCharCode(27);
  assert.equal(ajuster(E + '[31mrouge' + E + '[0m', 3), E + '[31mrou…' + E + '[0m');
  assert.equal(bannière(false).length, 5);
});

test('la commande lancée dépend du système et ne reçoit que des valeurs fixes', () => {
  const win = commandeInstalleur({ plateforme: 'win32', lang: 'en', simulation: true, port: 4400, racineProjet: 'C:/p' });
  assert.equal(win.commande, 'powershell.exe');
  assert.deepEqual(win.args.slice(0, 3), ['-NoProfile', '-ExecutionPolicy', 'Bypass']);
  assert.ok(win.args.includes('-Interface') && win.args.includes('-DryRun'));
  assert.deepEqual(win.args.slice(win.args.indexOf('-Lang'), win.args.indexOf('-Lang') + 2), ['-Lang', 'en']);
  const nix = commandeInstalleur({ plateforme: 'linux', lang: 'fr', racineProjet: '/p' });
  assert.equal(nix.commande, 'bash');
  assert.ok(nix.args.includes('--interface'));
  assert.ok(!nix.args.includes('--dry-run'));
});

async function fausseInstallation(t, corps) {
  const dossier = await mkdtemp(join(tmpdir(), 'anime-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  const script = join(dossier, 'faux.mjs');
  await writeFile(script, `import { createInterface } from 'node:readline';
const lignes = createInterface({ input: process.stdin })[Symbol.asyncIterator]();
const lire = async () => { const { value, done } = await lignes.next(); return done ? 'EOF' : value; };
${corps}`);
  return script;
}
async function lancer(script, reponses, opts = {}) {
  const entree = new PassThrough(), sortie = new PassThrough();
  let texte = '';
  sortie.on('data', d => { texte += d; });
  for (const r of reponses) entree.write(r + '\n');
  if (opts.fermer !== false) entree.end();
  const r = await executer({ commande: process.execPath, args: [script], sortie, entree, anime: false, lang: 'fr' });
  return { ...r, texte };
}

test('installation complète en mode texte : plan, confirmations o et n, choix, saisie, fin', async t => {
  const script = await fausseInstallation(t, `
console.log('@@PLAN a\\tPremière tâche');
console.log('@@PLAN b\\tSeconde tâche');
console.log('journal brut ignoré');
console.log('@@STEP a');
console.log('@@CONFIRM a\\tInstaller A ?');
const a = await lire();
console.log('@@DONE a\\t' + (a === 'o' ? 'ok' : 'skip') + '\\treponse=' + a);
console.log('@@STEP b');
console.log('@@CHOICE b\\tRaccourci ?\\tHerdr\\tBureau');
const c = await lire();
console.log('@@INPUT b\\tDossier ?\\t.');
const d = await lire();
console.log('@@CONFIRM b\\tInstaller B ?');
const b = await lire();
console.log('@@DONE b\\tok\\tchoix=' + c + ' dossier=' + d + ' b=' + b);
console.log('@@END ok');`);
  const r = await lancer(script, ['o', '2', 'mon-projet', 'n']);
  assert.equal(r.ok, true);
  assert.match(r.texte, /✔ Première tâche : reponse=o/);
  assert.match(r.texte, /✔ Seconde tâche : choix=2 dossier=mon-projet b=n/);
  assert.match(r.texte, /Installation terminée/);
  assert.doesNotMatch(r.texte, /journal brut/);
});

test('fin de l\'entrée = refus, jamais un accord', async t => {
  const script = await fausseInstallation(t, `
console.log('@@PLAN a\\tOutil');
console.log('@@STEP a');
console.log('@@CONFIRM a\\tInstaller l\\'outil ?');
const r = await lire();
console.log('@@DONE a\\t' + (r === 'o' ? 'ok' : 'skip') + '\\t' + r);
console.log('@@END ok');`);
  const sansReponse = await lancer(script, []);
  // la fin de l'entrée est transmise telle quelle à l'installeur (il lit EOF) : aucune réponse « n » n'est inventée
  assert.match(sansReponse.texte, /– Outil : EOF/);
  const accord = await lancer(script, ['oui']);
  assert.match(accord.texte, /✔ Outil : o/);
});

test('un installeur qui échoue donne un code d\'échec et un message d\'arrêt', async t => {
  const script = await fausseInstallation(t, `
console.log('@@PLAN a\\tÉtape');
console.log('@@STEP a');
console.log('@@DONE a\\tfail\\timpossible');
console.log('@@END fail');
process.exit(3);`);
  const r = await lancer(script, []);
  assert.equal(r.ok, false);
  assert.equal(r.code, 3);
  assert.match(r.texte, /✖ Étape : impossible/);
  assert.match(r.texte, /Installation arrêtée/);
});

test('les caractères de contrôle venant de l\'installeur sont retirés avant l\'affichage', () => {
  const E = String.fromCharCode(27);
  const evt = parseLigne('@@INFO ' + E + '[2J' + E + ']0;titre' + String.fromCharCode(7) + 'texte propre');
  assert.equal(evt.texte, '[2J]0;titretexte propre');
  assert.ok(!/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/.test(evt.texte));
  assert.equal(parseLigne('@@PLAN node\tNode' + E + '[31m rouge').libelle, 'Node[31m rouge');
});

test('une entrée fermée devant une saisie n\'envoie jamais la valeur par défaut', async t => {
  const script = await fausseInstallation(t, `
console.log('@@PLAN a\\tConfig');
console.log('@@STEP a');
console.log('@@INPUT a\\tPort ?\\t4317');
const r = await lire();
console.log('@@DONE a\\t' + (r === 'EOF' ? 'skip' : 'ok') + '\\t' + r);
console.log('@@END ok');`);
  const r = await lancer(script, []);
  assert.match(r.texte, /– Config : EOF/);
  assert.doesNotMatch(r.texte, /4317\n/);
});

test('le bilan dit démonstration ou simulation, jamais installation, et signale un arrêt', async () => {
  const e = etatInitial({ lang: 'fr', demo: true });
  assert.match(bilanFin({ ...e, fin: { ok: true } }), /Démonstration terminée : rien n’a été installé/);
  assert.match(bilanFin({ ...etatInitial({ lang: 'en', simulation: true }), fin: { ok: true } }), /Dry run finished: nothing was installed/);
  assert.equal(bilanFin({ ...etatInitial({ lang: 'fr' }), fin: { ok: true } }), 'Installation terminée.');
  assert.match(bilanFin({ ...etatInitial({ lang: 'fr' }), fin: { ok: false } }), /arrêtée/);
});

test('touches : flèches, Entrée, effacement et Ctrl+C sont reconnus', () => {
  assert.deepEqual(touches('\x1b[A\x1b[B\x1bOC\x1b[D\r1\u007f\u0003'), ['haut', 'bas', 'droite', 'gauche', 'entree', '1', 'effacer', 'ctrl-c']);
});

test('choix au clavier : flèches avec bouclage, numéros à deux chiffres, Entrée valide', () => {
  let s = { curseur: 1, chiffres: '' };
  s = naviguerChoix(s, 'haut', 13); assert.equal(s.curseur, 13);
  s = naviguerChoix(s, 'bas', 13); assert.equal(s.curseur, 1);
  s = naviguerChoix(s, 'bas', 13); assert.equal(s.curseur, 2);
  s = naviguerChoix(s, '1', 13); assert.equal(s.curseur, 1);
  s = naviguerChoix(s, '2', 13); assert.equal(s.curseur, 12, 'les options 10 et plus restent accessibles');
  s = naviguerChoix(s, '7', 13); assert.equal(s.curseur, 7, 'un numéro hors liste repart du dernier chiffre');
  s = naviguerChoix(s, 'x', 13); assert.equal(s.valide, undefined);
  assert.equal(naviguerChoix(s, 'entree', 13).valide, 7);
});

test('confirmation au clavier : non par défaut, ←/→ basculent, o et n répondent tout de suite', () => {
  assert.deepEqual(naviguerConfirmation(false, 'entree'), { oui: false, valide: true });
  assert.deepEqual(naviguerConfirmation(false, 'gauche'), { oui: true });
  assert.deepEqual(naviguerConfirmation(true, 'n'), { oui: false, valide: true });
  assert.deepEqual(naviguerConfirmation(false, 'o'), { oui: true, valide: true });
});

test('mode animé : un choix aux flèches et une confirmation renvoient le bon numéro à l\'installeur', async t => {
  const script = await fausseInstallation(t, `
console.log('@@PLAN a\tAgents');
console.log('@@STEP a');
console.log('@@CHOICE q1\tOutil ?\tIgnorer\tpi\tclaude\tcodex\ta5\ta6\ta7\ta8\ta9\ta10\ta11\ta12\tqwen');
const c = await lire();
console.log('@@CONFIRM q2\tLancer ?');
const o = await lire();
console.log('@@DONE a\tok\tchoix=' + c + ' oui=' + o);
console.log('@@END ok');`);
  const entree = new PassThrough(), sortie = new PassThrough();
  let texte = '', etape = 0;
  sortie.on('data', d => {
    texte += d;
    if (etape === 0 && texte.includes('Outil ?')) { etape = 1; setImmediate(() => entree.write('\x1b[A\r')); }
    else if (etape === 1 && texte.includes('Lancer ?')) { etape = 2; setImmediate(() => entree.write('\x1b[D\r')); }
  });
  const r = await executer({ commande: process.execPath, args: [script], sortie, entree, anime: true, couleur: false, lang: 'fr' });
  assert.equal(r.ok, true);
  assert.match(texte, /choix=13 oui=o/, 'flèche haut depuis la 1re option = dernière option (13), puis ← = Oui');
});
