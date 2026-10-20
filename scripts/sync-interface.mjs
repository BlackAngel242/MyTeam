// Les deux interfaces livrent les mêmes assets locaux, sans dépendance de production.
import { copyFile } from 'node:fs/promises';
for (const name of ['appearance.js', 'appearance.css', 'icons.svg']) {
  await copyFile(new URL(`../public/${name}`, import.meta.url), new URL(`../site/${name}`, import.meta.url));
}
