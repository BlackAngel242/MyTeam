#!/usr/bin/env node
// Retire les anciennes releases après vérification de la référence, sans toucher aux tags.
// Usage : node scripts/garder-releases.mjs <proprietaire/depot> --reference v0.5.0 [--garder 1] [--dry-run]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const executer = promisify(execFile);
const lancerGh = async args => (await executer('gh', args, { windowsHide: true, timeout: 60000 })).stdout;

export async function garderReleases(depot, { garder = 1, reference, dryRun = false, gh = lancerGh } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(depot ?? '')) throw new Error('Dépôt attendu : proprietaire/depot');
  if (!Number.isInteger(garder) || garder < 1 || garder > 50) throw new Error('--garder attend un entier de 1 à 50.');
  if (!dryRun || reference) {
    if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(reference ?? '')) throw new Error('Une référence publiée est requise (--reference v1.2.3).');
    const vue = JSON.parse(await gh(['release', 'view', reference, '--repo', depot, '--json', 'tagName,isDraft,assets']));
    const version = reference.slice(1);
    if (!vue || vue.tagName !== reference || vue.isDraft || ![`MyTeam-${version}.zip`, `MyTeam-${version}.zip.sha256`].every(nom => vue.assets?.some(a => a.name === nom))) throw new Error('La référence publiée doit contenir son archive et son checksum vérifiés.');
  }
  const liste = JSON.parse(await gh(['release', 'list', '--repo', depot, '--limit', '100', '--json', 'tagName,publishedAt,isDraft']));
  if (!Array.isArray(liste) || liste.length >= 100) throw new Error('Liste des releases incomplète : aucune suppression.');
  const publiees = liste.filter(r => !r.isDraft).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const gardees = publiees.slice(0, garder).map(r => r.tagName);
  const supprimees = publiees.slice(garder).map(r => r.tagName);
  if (reference && !gardees.includes(reference)) throw new Error('La référence doit faire partie des releases conservées.');
  if (supprimees.some(tag => !/^[A-Za-z0-9_][\w.+-]{0,99}$/.test(tag))) throw new Error('Tag de release invalide : aucune suppression.');
  for (const tag of supprimees) {
    if (!dryRun) await gh(['release', 'delete', tag, '--repo', depot, '--yes']);
  }
  return { gardees, supprimees };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--garder');
  const ref = args.indexOf('--reference');
  try {
    const r = await garderReleases(args[0], { garder: i === -1 ? 1 : Number(args[i + 1]), reference: ref === -1 ? undefined : args[ref + 1], dryRun: args.includes('--dry-run') });
    console.log(`${args.includes('--dry-run') ? 'Simulation : ' : ''}gardées : ${r.gardees.join(', ') || 'aucune'} ; supprimées : ${r.supprimees.join(', ') || 'aucune'}`);
  } catch (erreur) { console.error(erreur.message); process.exit(1); }
}
