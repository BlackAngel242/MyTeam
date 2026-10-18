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
  const resultat = { ajoutee: false, prevenus: [], plusTard: [], injoignables: false };
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
    if (!dryRun) {
      await lancer(herdr, ['agent', 'prompt', a.pane_id, message]);
      await attendre(2000);
      await lancer(herdr, ['pane', 'send-keys', a.pane_id, 'Enter']); // le texte collé peut rester dans la zone de saisie
    }
    resultat.prevenus.push(nom);
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
    console.log(r.ajoutee ? (fr ? 'Leçon ajoutée à LESSONS.md.' : 'Lesson added to LESSONS.md.') : (fr ? 'Leçon déjà présente.' : 'Lesson already present.'));
    if (r.injoignables) console.log(fr ? 'Herdr injoignable : aucun agent prévenu.' : 'Herdr unreachable: no agent notified.');
    if (r.prevenus.length) console.log((fr ? 'Prévenus : ' : 'Notified: ') + r.prevenus.join(', '));
    if (r.plusTard.length) console.log((fr ? 'À prévenir plus tard (au travail) : ' : 'To notify later (busy): ') + r.plusTard.join(', '));
  } catch (erreur) { console.error(erreur.message); process.exit(1); }
}
