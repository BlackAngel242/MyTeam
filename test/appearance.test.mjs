import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function load({ stored = null, dark = false, denied = false } = {}) {
  const events = {}, controls = [], dataset = {}, saved = [];
  const media = { matches: dark, addEventListener: (_, fn) => events.system = fn };
  const select = { value: '', addEventListener: (_, fn) => events.select = fn };
  controls.push(select);
  const context = {
    document: { documentElement: { dataset }, readyState: 'complete', querySelectorAll: () => controls },
    window: { matchMedia: () => media, addEventListener: (name, fn) => events[name] = fn },
    localStorage: {
      getItem: () => { if (denied) throw new Error('Stockage refusé'); return stored; },
      setItem: (key, value) => { if (denied) throw new Error('Stockage refusé'); saved.push([key, value]); }
    }
  };
  vm.runInNewContext(readFileSync(new URL('../public/appearance.js', import.meta.url), 'utf8'), context);
  return { dataset, select, events, media, saved };
}

test('apparence : le système est appliqué avant les contrôles, sans préférence enregistrée', () => {
  const view = load({ dark: true });
  assert.equal(view.dataset.theme, 'dark');
  assert.equal(view.select.value, 'system');
  view.media.matches = false;
  view.events.system();
  assert.equal(view.dataset.theme, 'light');
});

test('apparence : le choix explicite survit aux changements système et se mémorise', () => {
  const view = load({ stored: 'dark' });
  view.media.matches = false;
  view.events.system();
  assert.equal(view.dataset.theme, 'dark');
  view.select.value = 'light';
  view.events.select();
  assert.equal(view.dataset.theme, 'light');
  assert.deepEqual(view.saved, [['myteam.appearance', 'light']]);
});

test('apparence : un stockage refusé ou une préférence invalide ne bloque pas le choix', () => {
  for (const options of [{ denied: true }, { stored: 'invalide' }]) {
    const view = load(options);
    assert.equal(view.select.value, 'system');
    view.select.value = 'dark';
    view.events.select();
    assert.equal(view.dataset.theme, 'dark');
    view.select.value = 'invalide';
    view.events.select();
    assert.equal(view.select.value, 'system');
  }
});

test('apparence : les changements et suppressions de préférence se propagent entre onglets', () => {
  const view = load({ stored: 'dark' });
  view.events.storage({ key: 'myteam.appearance', newValue: 'light' });
  assert.equal(view.dataset.theme, 'light');
  assert.equal(view.select.value, 'light');
  view.events.storage({ key: 'autre', newValue: 'dark' });
  assert.equal(view.dataset.theme, 'light');
  view.events.storage({ key: null, newValue: null });
  assert.equal(view.select.value, 'system');
});

test('apparence : la vitrine et le bureau distribuent le même comportement', () => {
  const code = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  assert.equal(code('../public/appearance.js'), code('../site/appearance.js'));
});
