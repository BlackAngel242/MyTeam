#!/usr/bin/env node
// Boucle de correction automatisée : ajoute une leçon à LESSONS.md puis prévient les agents Herdr disponibles.
// Un agent au travail n'est jamais interrompu : il est listé pour être prévenu plus tard.
// Usage : node scripts/partager-lecons.mjs "Texte de la leçon" [dossier] [--dry-run] [--lang fr|en]
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const executer = promisify(execFile);

function trouverHerdr(env = process.env) {
  if (env.BUREAU_HERDR_PATH && existsSync(env.BUREAU_HERDR_PATH)) return env.BUREAU_HERDR_PATH;
  return 'herdr';
}

const lanceur = async (binaire, args) => (await executer(binaire, args, { windowsHide: true, timeout: 30000 })).stdout;

export async function partagerLecon(texte, { dossier = '.', lang = 'fr', dryRun = false, herdr = trouverHerdr(), lancer = lanceur, attendre = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (typeof texte !== 'string' || !texte.trim() || texte.length > 2000 || /[\r\n\0]/.test(texte)) throw new Error(lang === 'fr' ? 'Écrivez une leçon d’une ligne (2000 caractères au plus).' : 'Write a one-line lesson (2000 characters max).');
  const fichier = join(resolve(dossier), 'LESSONS.md');
  const ligne = `- ${texte.trim()}`;
  const actuel = await readFile(fichier, 'utf8').catch(() => null);
  const resultat = { ajoutee: false, prevenus: [], serait: [], plusTard: [], aVerifier: [], injoignables: false, simulation: dryRun };
  if (actuel === null || !actuel.split(/\r?\n/).includes(ligne)) {
    if (!dryRun) { if (actuel === null) await writeFile(fichier, `# ${lang === 'fr' ? 'Leçons' : 'Lessons'}\n\n${ligne}\n`); else await appendFile(fichier, (actuel.endsWith('\n') ? '' : '\n') + ligne + '\n'); }
    resultat.ajoutee = true;
  }
  const message = lang === 'fr'
    ? `Nouvelle leçon du chef : ${texte.trim()} Relis LESSONS.md avant ta prochaine mission. Aucune action requise maintenant.`
    : `New lesson from the lead: ${texte.trim()} Re-read LESSONS.md before your next mission. No action required now.`;
  let agents = [];
  try { agents = JSON.parse(await lancer(herdr, ['agent', 'list'])).result?.agents ?? []; } catch { resultat.injoignables = true; }
  for (const a of agents) {
    if (typeof a.pane_id !== 'string' || !/^[\w:.@-]{1,64}$/.test(a.pane_id)) continue;
    const nom = a.name || a.agent || a.pane_id;
    if (!['idle', 'done'].includes(a.agent_status)) { resultat.plusTard.push(nom); continue; }
    if (dryRun) { resultat.serait.push(nom); continue; }
    await lancer(herdr, ['agent', 'prompt', a.pane_id, message]);
    await attendre(2000);
    // Le texte déposé peut rester dans la zone de saisie sans partir. Entrée n'est envoyée que si l'agent est toujours
    // disponible ET que le début de NOTRE message est visible à l'écran : jamais sur une autorisation ou une boîte de dialogue.
    let envoye = false;
    try {
      const maintenant = JSON.parse(await lancer(herdr, ['agent', 'list'])).result?.agents?.find(x => x.pane_id === a.pane_id);
      const ecran = await lancer(herdr, ['agent', 'read', a.pane_id, '--source', 'visible', '--lines', '15']);
      const debut = message.slice(0, 28);
      if (maintenant && ['idle', 'done'].includes(maintenant.agent_status) && String(ecran).includes(debut)) {
        await lancer(herdr, ['pane', 'send-keys', a.pane_id, 'Enter']);
        envoye = true;
      }
    } catch { /* état illisible : aucune touche envoyée */ }
    (envoye ? resultat.prevenus : resultat.aVerifier).push(nom);
  }
  return resultat;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--lang');
  const lang = i !== -1 ? args[i + 1] : ((process.env.LANG ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en');
  const libres = args.filter((a, k) => !a.startsWith('--') && args[k - 1] !== '--lang');
  try {
    const r = await partagerLecon(libres[0], { dossier: libres[1] ?? '.', lang, dryRun: args.includes('--dry-run') });
    const fr = lang === 'fr';
    console.log(r.ajoutee ? (r.simulation ? (fr ? 'Serait ajoutée à LESSONS.md (non fait).' : 'Would be added to LESSONS.md (not done).') : (fr ? 'Leçon ajoutée à LESSONS.md.' : 'Lesson added to LESSONS.md.')) : (fr ? 'Leçon déjà présente.' : 'Lesson already present.'));
    if (r.injoignables) console.log(fr ? 'Herdr injoignable : aucun agent prévenu.' : 'Herdr unreachable: no agent notified.');
    if (r.simulation) console.log(fr ? 'Simulation : rien n’a été écrit ni envoyé.' : 'Dry run: nothing was written or sent.');
    if (r.serait.length) console.log((fr ? 'Serait prévenu (non fait) : ' : 'Would be notified (not done): ') + r.serait.join(', '));
    if (r.prevenus.length) console.log((fr ? 'Prévenus : ' : 'Notified: ') + r.prevenus.join(', '));
    if (r.aVerifier.length) console.log((fr ? 'Message déposé, envoi non confirmé : vérifiez le panneau de ' : 'Message left, sending not confirmed: check the pane of ') + r.aVerifier.join(', '));
    if (r.plusTard.length) console.log((fr ? 'À prévenir plus tard (au travail) : ' : 'To notify later (busy): ') + r.plusTard.join(', '));
  } catch (erreur) { console.error(erreur.message); process.exit(1); }
}
