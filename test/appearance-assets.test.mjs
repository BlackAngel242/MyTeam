import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBureauServer } from '../server.mjs';

test('le bureau sert les nouveaux assets locaux avec leur véritable type MIME', async t => {
  const server = createBureauServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const [name, type] of [['appearance.js', 'text/javascript'], ['appearance.css', 'text/css'], ['icons.svg', 'image/svg+xml']]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/${name}`);
    assert.equal(response.status, 200, name);
    assert.ok(response.headers.get('content-type').startsWith(type), name);
    const content = await response.text();
    if (name === 'icons.svg') {
      assert.ok(content.includes('ISC License') && content.includes('The MIT License'), 'les notices accompagnent le sprite distribué');
    }
    assert.equal(content, await readFile(new URL(`../public/${name}`, import.meta.url), 'utf8'));
    assert.equal(content, await readFile(new URL(`../site/${name}`, import.meta.url), 'utf8'));
  }
});
