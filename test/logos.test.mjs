import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/logos.js', import.meta.url), 'utf8');
const window = {};
runInNewContext(source, { window });

const HERDR_TYPES = [
  'pi', 'claude', 'codex', 'gemini', 'cursor', 'devin', 'agy', 'cline',
  'omp', 'mastracode', 'opencode', 'copilot', 'kimi', 'kiro', 'droid',
  'amp', 'grok', 'hermes', 'kilo', 'qodercli', 'qwen', 'letta', 'maki', 'muse'
];

test('Tous les logos Herdr : grille 16x16, palette valide, un emblème par type', () => {
  const logos = window.AGENT_LOGOS;
  assert.ok(logos, 'window.AGENT_LOGOS doit exister');

  for (const type of HERDR_TYPES) {
    const emblem = logos[type] || (window.AGENT_LOGO_MAP && logos[window.AGENT_LOGO_MAP[type]]);
    assert.ok(emblem, `L'outil "${type}" doit avoir un emblème dans AGENT_LOGOS`);
    assert.ok(emblem.palette, `L'emblème de "${type}" doit avoir une palette`);
    assert.ok(Array.isArray(emblem.rows), `L'emblème de "${type}" doit avoir un tableau rows`);
    assert.equal(emblem.rows.length, 16, `L'emblème de "${type}" doit avoir exactement 16 lignes (reçu ${emblem.rows.length})`);

    const paletteKeys = new Set(Object.keys(emblem.palette));
    // Vérifier les couleurs de la palette
    for (const [key, color] of Object.entries(emblem.palette)) {
      assert.match(color, /^#[0-9a-fA-F]{6}$/, `Couleur invalide "${color}" pour la clé "${key}" dans "${type}"`);
    }

    // Vérifier chaque ligne
    emblem.rows.forEach((row, rowIndex) => {
      assert.equal(row.length, 16, `Ligne ${rowIndex + 1} de "${type}" doit faire 16 caractères (reçu ${row.length} : "${row}")`);
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char !== '.') {
          assert.ok(
            paletteKeys.has(char),
            `Caractère inconnu "${char}" à la ligne ${rowIndex + 1}, col ${i + 1} dans l'emblème "${type}" (palette: ${[...paletteKeys].join(',')})`
          );
        }
      }
    });
  }
});

test('Table de correspondance et alias présents pour la recherche par kind', () => {
  assert.ok(window.AGENT_LOGO_MAP, 'window.AGENT_LOGO_MAP doit exister');
  assert.equal(window.AGENT_LOGO_MAP.agy, 'Antigravity');
  assert.equal(window.AGENT_LOGO_MAP.antigravity, 'Antigravity');
  assert.equal(window.AGENT_LOGO_MAP.gemini, 'Gemini');

  // Vérifier la résolution directe par alias
  assert.equal(window.AGENT_LOGOS.agy, window.AGENT_LOGOS.Antigravity);
  assert.equal(window.AGENT_LOGOS.antigravity, window.AGENT_LOGOS.Antigravity);
  assert.equal(window.AGENT_LOGOS.gemini, window.AGENT_LOGOS.Gemini);
  assert.equal(window.AGENT_LOGOS.claude, window.AGENT_LOGOS.Claude);
  assert.equal(window.AGENT_LOGOS.codex, window.AGENT_LOGOS.Codex);
  assert.equal(window.AGENT_LOGOS.opencode, window.AGENT_LOGOS.OpenCode);
});
