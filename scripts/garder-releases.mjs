#!/usr/bin/env node
// Garde seulement les N releases GitHub les plus récentes (2 par défaut) et supprime les autres avec leur tag :
// inutile d'accumuler des archives. Passe par la CLI `gh` (compte déjà connecté), jamais par un jeton lu ici.
// Usage : node scripts/garder-releases.mjs <proprietaire/depot> [--garder 2] [--dry-run]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const executer = promisify(execFile);
const lancerGh = async args => (await executer('gh', args, { windowsHide: true, timeout: 60000 })).stdout;

export async function garderReleases(depot, { garder = 2, dryRun = false, gh = lancerGh } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(depot ?? '')) throw new Error('Dépôt attendu : proprietaire/depot');
  if (!Number.isInteger(garder) || garder < 1 || garder > 50) throw new Error('--garder attend un entier de 1 à 50.');
  const liste = JSON.parse(await gh(['release', 'list', '--repo', depot, '--limit', '100', '--json', 'tagName,publishedAt,isDraft']));
  const publiees = liste.filter(r => !r.isDraft).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const gardees = publiees.slice(0, garder).map(r => r.tagName);
  const supprimees = publiees.slice(garder).map(r => r.tagName);
  for (const tag of supprimees) {
    if (!/^[\w.+-]{1,100}$/.test(tag)) continue;
    if (!dryRun) await gh(['release', 'delete', tag, '--repo', depot, '--cleanup-tag', '--yes']);
  }
  return { gardees, supprimees };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--garder');
  try {
    const r = await garderReleases(args[0], { garder: i === -1 ? 2 : Number(args[i + 1]), dryRun: args.includes('--dry-run') });
    console.log(`${args.includes('--dry-run') ? 'Simulation : ' : ''}gardées : ${r.gardees.join(', ') || 'aucune'} ; supprimées : ${r.supprimees.join(', ') || 'aucune'}`);
  } catch (erreur) { console.error(erreur.message); process.exit(1); }
}
