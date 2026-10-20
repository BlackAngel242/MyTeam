import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const public_ = new URL('../public/', import.meta.url);

// Un module oublié dans index.html ne produit aucune erreur : la fonction disparaît en silence
// (vu le 18 octobre : sons et icônes d'états vides absents). Chaque script du dossier doit être chargé et servi.
test('chaque script de public/ est chargé par index.html et servi par le serveur', async () => {
  const html = await readFile(new URL('index.html', public_), 'utf8');
  const serveur = await readFile(fileURLToPath(new URL('../server.mjs', import.meta.url)), 'utf8');
  const scripts = (await readdir(fileURLToPath(public_))).filter(nom => nom.endsWith('.js'));
  assert.ok(scripts.length >= 10);
  for (const nom of scripts) {
    assert.ok((html.includes(`<script src="/${nom}" defer></script>`) || (nom === 'appearance.js' && html.includes(`<script src="/${nom}"></script>`))), `${nom} absent de index.html`);
    assert.ok(serveur.includes(`'/${nom}':'${nom}'`), `${nom} absent des routes statiques du serveur`);
  }
});
