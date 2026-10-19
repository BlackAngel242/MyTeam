import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const siteDir = resolve(__dirname, '../site');

function loadSiteI18N() {
  const code = readFileSync(join(siteDir, 'site.js'), 'utf8');
  const context = { module: { exports: {} } };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.module.exports.I18N;
}

test('tous les fichiers locaux référencés dans site/index.html et site/style.css existent', () => {
  const html = readFileSync(join(siteDir, 'index.html'), 'utf8');
  const css = readFileSync(join(siteDir, 'style.css'), 'utf8');

  const refs = new Set();

  // Éléments link, script, img
  for (const m of html.matchAll(/<(?:link|script|img)\s+[^>]*?(?:src|href)=["']([^"']+)["']/gi)) {
    const url = m[1].trim();
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('#') && !url.startsWith('mailto:')) {
      refs.add(url);
    }
  }

  // Éléments data-lightbox
  for (const m of html.matchAll(/data-lightbox=["']([^"']+)["']/gi)) {
    const url = m[1].trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      refs.add(url);
    }
  }

  // Balises meta d'images sociales
  for (const m of html.matchAll(/<meta\s+[^>]*(?:property=["']og:image["']|name=["']twitter:image["'])[^>]*content=["']([^"']+)["']/gi)) {
    const url = m[1].trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      refs.add(url);
    }
  }

  // Références d'images dans style.css
  for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) {
    const url = m[1].trim();
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
      refs.add(url);
    }
  }

  assert.ok(refs.size > 0, 'Des fichiers locaux doivent être référencés');
  for (const ref of refs) {
    const fullPath = resolve(siteDir, ref);
    assert.ok(existsSync(fullPath), `Le fichier référencé « ${ref} » est introuvable sur le disque (${fullPath})`);
  }
});

test('les clés de traduction FR et EN dans site/site.js sont identiques et complètes', () => {
  const I18N = loadSiteI18N();
  assert.ok(I18N, 'I18N doit être exporté par site.js');
  assert.ok(I18N.fr, 'I18N.fr doit exister');
  assert.ok(I18N.en, 'I18N.en doit exister');

  const frKeys = Object.keys(I18N.fr).sort();
  const enKeys = Object.keys(I18N.en).sort();

  assert.deepEqual(frKeys, enKeys, 'Les clés françaises et anglaises doivent être strictement identiques');

  for (const key of frKeys) {
    assert.ok(typeof I18N.fr[key] === 'string' && I18N.fr[key].trim().length > 0, `Traduction FR vide pour la clé : ${key}`);
    assert.ok(typeof I18N.en[key] === 'string' && I18N.en[key].trim().length > 0, `Traduction EN vide pour la clé : ${key}`);
  }

  // Vérifier que chaque data-i18n dans index.html existe dans I18N
  const html = readFileSync(join(siteDir, 'index.html'), 'utf8');
  for (const m of html.matchAll(/data-i18n=["']([^"']+)["']/g)) {
    const key = m[1].trim();
    assert.ok(key in I18N.fr, `La clé data-i18n « ${key} » du HTML manque dans I18N.fr`);
  }

  // Vérifier les attributs data-i18n-attr
  for (const m of html.matchAll(/data-i18n-attr=["']([^"']+)["']/g)) {
    const spec = m[1].trim();
    for (const pair of spec.split(',')) {
      const parts = pair.split(':');
      if (parts.length === 2) {
        const key = parts[1].trim();
        assert.ok(key in I18N.fr, `La clé d'attribut « ${key} » manque dans I18N.fr`);
      }
    }
  }
});

test('aucune URL externe autorisée sauf github.com et son sous-domaine github.io', () => {
  const files = ['index.html', 'style.css', 'site.js'];
  const urlRegex = /https?:\/\/([^\s"'<>\)]+)/gi;

  for (const file of files) {
    const content = readFileSync(join(siteDir, file), 'utf8');
    for (const m of content.matchAll(urlRegex)) {
      const rawUrl = m[0];
      const host = m[1].split('/')[0].split(':')[0].toLowerCase();

      // Autoriser 127.0.0.1 ou localhost (serveur du bureau local)
      if (host === '127.0.0.1' || host === 'localhost') {
        continue;
      }

      // Toute URL externe doit être sur github.com ou github.io
      const isGitHub = host === 'github.com' || host.endsWith('.github.com');
      const isGitHubPages = host === 'blackangel242.github.io' || host.endsWith('.github.io');

      assert.ok(
        isGitHub || isGitHubPages,
        `URL externe non autorisée trouvée dans ${file} : « ${rawUrl} » (hôte: ${host})`
      );
    }
  }
});

test('aucun numéro de téléphone ni information personnelle dans les fichiers de site/', () => {
  const files = ['index.html', 'style.css', 'site.js'];
  const phoneRegex = /whatsapp\s*:?\s*\+?\d|\+\d{2,3}[ .]?\d{1,2}[ .]?\d{2,3}[ .]?\d{2}[ .]?\d{2}|\b0[1-9](?:[ .-]?[0-9]{2}){4}\b/gi;

  for (const file of files) {
    const content = readFileSync(join(siteDir, file), 'utf8');
    assert.doesNotMatch(content, phoneRegex, `Information personnelle ou téléphone détecté dans site/${file}`);
  }
});

test('aucun tiret cadratin dans les fichiers de site/', () => {
  const files = ['index.html', 'style.css', 'site.js'];
  for (const file of files) {
    const content = readFileSync(join(siteDir, file), 'utf8');
    assert.ok(!content.includes('\u2014'), `Tiret cadratin (—) détecté dans site/${file}`);
    assert.ok(!content.includes('\u2013'), `Tiret demi-cadratin (–) détecté dans site/${file}`);
  }
});

test('l\'aperçu de partage (Open Graph) : image en URL absolue, existante, 1200×630 et légère', async () => {
  const { readFile, stat } = await import('node:fs/promises');
  const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
  for (const nom of ['og:image', 'twitter:image']) {
    const m = new RegExp(`(?:property|name)="${nom}" content="([^"]+)"`).exec(html);
    assert.ok(m, nom);
    assert.match(m[1], /^https:\/\/blackangel242\.github\.io\/MyTeam\/assets\/[\w-]+\.png$/, `${nom} doit être une URL absolue`);
  }
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  const fichier = new URL('../site/assets/social-og.png', import.meta.url);
  const octets = await readFile(fichier);
  assert.equal(octets.readUInt32BE(16), 1200);
  assert.equal(octets.readUInt32BE(20), 630);
  assert.ok((await stat(fichier)).size < 300 * 1024, 'moins de 300 Ko pour WhatsApp');
});

test('la vidéo d\'accueil a ses sources (webm, mp4), un repli GIF léger et respecte le mouvement réduit', async () => {
  const { readFile, stat } = await import('node:fs/promises');
  const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
  assert.match(html, /<video id="hero-video"[^>]*autoplay muted loop playsinline/);
  for (const [fichier, plafondKo] of [['tournee-du-chef.webm', 1500], ['tournee-du-chef.mp4', 1500], ['tournee-du-chef.gif', 5000]]) {
    assert.ok(html.includes(`assets/${fichier}`), fichier);
    assert.ok((await stat(new URL(`../site/assets/${fichier}`, import.meta.url))).size < plafondKo * 1024, `${fichier} sous ${plafondKo} Ko`);
  }
  const js = await readFile(new URL('../site/site.js', import.meta.url), 'utf8');
  assert.match(js, /prefers-reduced-motion/);
});
