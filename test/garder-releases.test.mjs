import { test } from 'node:test';
import assert from 'node:assert/strict';
import { garderReleases } from '../scripts/garder-releases.mjs';

const faux = (releases, appels) => async args => {
  appels.push(args);
  return args[0] === 'release' && args[1] === 'list' ? JSON.stringify(releases) : '';
};
const releases = [
  { tagName: 'v0.4.0', publishedAt: '2026-10-18T12:00:00Z', isDraft: false },
  { tagName: 'v0.3.0', publishedAt: '2026-10-10T12:00:00Z', isDraft: false },
  { tagName: 'v0.5.0', publishedAt: '2026-10-20T12:00:00Z', isDraft: false },
  { tagName: 'v0.1.0', publishedAt: '2026-10-01T12:00:00Z', isDraft: false },
  { tagName: 'v0.6.0-brouillon', publishedAt: '2026-10-25T12:00:00Z', isDraft: true },
];

test('seules les deux releases les plus récentes sont gardées, les autres sont supprimées avec leur tag', async () => {
  const appels = [];
  const r = await garderReleases('proprio/depot', { gh: faux(releases, appels) });
  assert.deepEqual(r.gardees, ['v0.5.0', 'v0.4.0']);
  assert.deepEqual(r.supprimees, ['v0.3.0', 'v0.1.0']);
  const suppressions = appels.filter(a => a[1] === 'delete');
  assert.equal(suppressions.length, 2);
  assert.ok(suppressions.every(a => a.includes('--cleanup-tag') && a.includes('--yes') && a.includes('--repo')));
});

test('simulation : rien n\'est supprimé ; un brouillon n\'est jamais compté ni supprimé', async () => {
  const appels = [];
  const r = await garderReleases('proprio/depot', { dryRun: true, gh: faux(releases, appels) });
  assert.equal(appels.filter(a => a[1] === 'delete').length, 0);
  assert.ok(!r.gardees.includes('v0.6.0-brouillon') && !r.supprimees.includes('v0.6.0-brouillon'));
});

test('dépôt, nombre ou tag invalides sont refusés', async () => {
  await assert.rejects(garderReleases('pasundepot', { gh: async () => '[]' }), /Dépôt attendu/);
  await assert.rejects(garderReleases('a/b', { garder: 0, gh: async () => '[]' }), /entier/);
  const appels = [];
  await garderReleases('a/b', { garder: 1, gh: faux([{ tagName: 'v1', publishedAt: '2026-01-02T00:00:00Z' }, { tagName: 'v0; rm -rf /', publishedAt: '2026-01-01T00:00:00Z' }], appels) });
  assert.equal(appels.filter(a => a[1] === 'delete').length, 0);
});
