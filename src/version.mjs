// Version du code en cours d'exécution : une seule lecture de package.json, à côté de ce dossier src.
// Les textes publics (README, site, journaux) gardent leur numéro écrit à la main : ils sont historiques.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')).version ?? null;
  } catch {
    return null;
  }
})();
