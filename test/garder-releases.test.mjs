import { test } from 'node:test';
import assert from 'node:assert/strict';
import { garderReleases } from '../scripts/garder-releases.mjs';

const releases = [
  { tagName: 'v0.4.2', publishedAt: '2026-10-19T12:00:00Z', isDraft: false },
  { tagName: 'v0.4.1', publishedAt: '2026-10-18T12:00:00Z', isDraft: false },
  { tagName: 'v0.5.0', publishedAt: '2026-10-20T12:00:00Z', isDraft: false },
  { tagName: 'v0.6.0', publishedAt: '2026-10-25T12:00:00Z', isDraft: true },
];
const reference = { tagName: 'v0.5.0', isDraft: false, assets: [{ name: 'MyTeam-0.5.0.zip' }, { name: 'MyTeam-0.5.0.zip.sha256' }] };
const faux = (appels, vue = reference, liste = releases) => async args => {
  appels.push(args);
  return JSON.stringify(args[1] === 'list' ? liste : args[1] === 'view' ? vue : {});
};

test('après vérification de la référence publiée, les anciennes releases sont retirées sans leurs tags', async () => {
  const appels = [];
  const r = await garderReleases('proprio/depot', { reference: 'v0.5.0', gh: faux(appels) });
  assert.deepEqual(r.gardees, ['v0.5.0']);
  assert.deepEqual(r.supprimees, ['v0.4.2', 'v0.4.1']);
  const suppressions = appels.filter(a => a[1] === 'delete');
  assert.equal(suppressions.length, 2);
  assert.ok(suppressions.every(a => !a.includes('--cleanup-tag') && a.includes('--yes') && a.includes('--repo')));
  assert.equal(appels[0][1], 'view');
});

test('une référence absente, brouillon ou privée de son archive et checksum bloque toute suppression', async () => {
  for (const vue of [null, { ...reference, isDraft: true }, { ...reference, assets: [] }]) {
    const appels = [];
    await assert.rejects(garderReleases('a/b', { reference: 'v0.5.0', gh: faux(appels, vue) }), /référence/i);
    assert.equal(appels.filter(a => a[1] === 'delete').length, 0);
  }
  await assert.rejects(garderReleases('a/b', { gh: faux([]) }), /référence/i);
});

test('simulation sans écriture, brouillons exclus et référence jamais supprimée', async () => {
  const appels = [];
  const r = await garderReleases('a/b', { dryRun: true, gh: faux(appels) });
  assert.equal(appels.filter(a => a[1] === 'delete').length, 0);
  assert.deepEqual(r.gardees, ['v0.5.0']);
  assert.ok(!r.supprimees.includes('v0.6.0'));
  await assert.rejects(garderReleases('a/b', { reference: 'v0.5.0', gh: faux([], reference, releases.filter(r => r.tagName !== 'v0.5.0')) }), /référence/i);
});

test('tous les tags sont validés avant de supprimer une release', async () => {
  const appels = [];
  await assert.rejects(garderReleases('a/b', { reference: 'v0.5.0', gh: faux(appels, reference, [...releases, { tagName: '--option', publishedAt: '2026-10-01', isDraft: false }]) }), /tag/i);
  assert.equal(appels.filter(a => a[1] === 'delete').length, 0);
  await assert.rejects(garderReleases('pasundepot', { gh: faux([]) }), /Dépôt attendu/);
  await assert.rejects(garderReleases('a/b', { garder: 0, gh: faux([]) }), /entier/);
});
