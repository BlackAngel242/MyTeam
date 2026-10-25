import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/version.mjs';

test('la version du code correspond à package.json, sans numéro recopié', async () => {
  const paquet = JSON.parse(await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
  assert.equal(VERSION, paquet.version);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});
