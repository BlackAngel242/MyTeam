import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createBureauServer } from '../server.mjs';

async function bureau(t, piedFile) {
  const bridge = { list: async () => [], read: async () => ({ text: '' }) };
  const server = createBureauServer({ bridge, piedFile });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const port = server.address().port, origin = `http://127.0.0.1:${port}`;
  const send = (path, headers = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, headers: { Host: `127.0.0.1:${port}`, ...headers } }, res => { let s = ''; res.on('data', c => s += c); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(s) })); });
    req.on('error', reject); req.end();
  });
  const { data: { token } } = await send('/api/state');
  return { send, auth: { Origin: origin, 'X-Bureau-Token': token } };
}

test('le pied de page est facultatif : par défaut seule la signature de l\'auteur, aucun téléphone ni société', async t => {
  const dossier = await mkdtemp(join(tmpdir(), 'pied-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  const { send, auth } = await bureau(t, join(dossier, 'absent.json'));
  assert.equal((await send('/api/pied')).status, 403);
  const r = await send('/api/pied', auth);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { gauche: 'DrSmoke « Un Mbokatié engagé »', droite: '', enseigne: '' });
});

test('chacun règle son propre pied dans .bureau/pied.json : texte nettoyé et borné', async t => {
  const dossier = await mkdtemp(join(tmpdir(), 'pied-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  const fichier = join(dossier, 'pied.json');
  await writeFile(fichier, JSON.stringify({ gauche: 'Mon équipe\u0007\n', droite: 'x'.repeat(500), enseigne: 'BUREAU DE MON EQUIPE '.repeat(5), inconnu: 'ignoré' }));
  const { send, auth } = await bureau(t, fichier);
  const r = await send('/api/pied', auth);
  assert.equal(r.data.gauche, 'Mon équipe');
  assert.equal(r.data.droite.length, 120);
  assert.equal(r.data.enseigne.length, 28);
  assert.deepEqual(Object.keys(r.data), ['gauche', 'droite', 'enseigne']);
  await writeFile(fichier, '{pas du json');
  assert.deepEqual((await send('/api/pied', auth)).data, { gauche: 'DrSmoke « Un Mbokatié engagé »', droite: '', enseigne: '' });
  await writeFile(fichier, JSON.stringify({ gauche: '', droite: '' }));
  assert.deepEqual((await send('/api/pied', auth)).data, { gauche: '', droite: '', enseigne: '' });
});

test('plus aucune information personnelle imposée dans le code ni les documents publics', async () => {
  for (const f of ['public/index.html', 'public/i18n.js', 'public/i18n-en.js', 'README.md', 'README.en.md', 'LICENSE', 'server.mjs']) {
    const texte = await readFile(new URL(`../${f}`, import.meta.url), 'utf8');
    // Aucun numéro de téléphone (international ou non) ni contact WhatsApp imposé : seulement des motifs génériques.
    assert.doesNotMatch(texte, /whatsapp\s*:?\s*\+?\d|\+\d{2,3}[ .]?\d{1,2}[ .]?\d{2,3}[ .]?\d{2}[ .]?\d{2}/i, f);
  }
});
