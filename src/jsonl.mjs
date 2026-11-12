// Helpers de lecture des journaux JSONL partagés entre les lecteurs d'activité
// (Claude, Codex), les délégations et les tâches. La sémantique est strictement
// identique aux fonctions locales qu'ils remplacent (constat C-CD-07).
import { lstat, open, opendir } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_LINE = 4 * 1024 * 1024;        // une ligne plus longue est ignorée
const CONTINUITY_BYTES = 4096;           // octets conservés pour le contrôle de continuité

// Trouve un fichier nommé `filename` sous `root` sans suivre les liens
// symboliques. Un dossier inaccessible ne doit pas masquer les autres sessions.
export async function findTranscript(root, filename) {
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    try {
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink()) continue;
      for await (const entry of await opendir(directory)) {
        if (entry.isSymbolicLink()) continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) pending.push(path);
        else if (entry.isFile() && entry.name === filename) return path;
      }
    } catch {
      // Un dossier inaccessible ne doit pas masquer les autres sessions.
    }
  }
  return undefined;
}

// Les transcripts ne se relient qu'à un point de reprise intact : la ligne
// conservée occupe toujours sa place, ou la lecture s'est arrêtée juste après
// un saut de ligne. Une réécriture plus longue sur le même fichier garde sinon
// l'ancien décalage et fait perdre la fin du journal. Une ligne géante en cours
// d'ignorance n'a rien de conservé : le saut se poursuit.
export async function resumePossible(path, state) {
  if (state.offset <= 0) return true;
  if (state.skipping) return true;
  const conserve = state.partial.length
    ? state.partial.subarray(Math.max(0, state.partial.length - CONTINUITY_BYTES))
    : null;
  const longueur = conserve ? conserve.length : 1;
  const depart = state.offset - longueur;
  if (depart < 0) return false;
  try {
    const handle = await open(path, 'r');
    try {
      const octets = Buffer.allocUnsafe(longueur);
      const { bytesRead } = await handle.read(octets, 0, longueur, depart);
      if (bytesRead !== longueur) return false;
      return conserve ? octets.equals(conserve) : octets[0] === 10;
    } finally { await handle.close(); }
  } catch { return false; }
}

// Découpe un flux en lignes avec reprise incrémentale. Une ligne trop longue est
// ignorée en avançant, l'état reste utilisable (pas de relecture intégrale du
// journal à chaque appel). L'état de saut (`skipping`) est conservé entre deux
// lectures : une ligne géante répartie sur plusieurs sondages ne doit jamais
// être coupée en fausses entrées. `track` ajoute le suivi `head`/`tail` utilisé
// par les délégations.
export async function* completeLines(stream, state, { track = false } = {}) {
  let partial = state.partial;
  let skipping = state.skipping;
  for await (const chunk of stream) {
    if (track && state.offset === 0 && state.head.length === 0) state.head = Buffer.from(chunk.subarray(0, 64));
    state.offset += chunk.length;
    if (track) state.tail = Buffer.concat([state.tail, chunk]).subarray(-64);
    let start = 0;
    for (let end = chunk.indexOf(10); end !== -1; end = chunk.indexOf(10, start)) {
      const segment = chunk.subarray(start, end + 1);
      if (!skipping && partial.length + segment.length <= MAX_LINE) yield partial.length ? Buffer.concat([partial, segment]) : segment;
      partial = Buffer.alloc(0);
      skipping = false;
      start = end + 1;
    }
    if (start < chunk.length) {
      if (!skipping && partial.length + chunk.length - start <= MAX_LINE) partial = Buffer.concat([partial, chunk.subarray(start)]);
      else { partial = Buffer.alloc(0); skipping = true; }
    }
  }
  state.partial = partial;
  state.skipping = skipping;
}
