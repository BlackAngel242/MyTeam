// Opt-in : MYTEAM_BROWSER_TESTS=1, Playwright installé hors du projet.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const enabled = process.env.MYTEAM_BROWSER_TESTS === '1';
let browser, server, origin;
const root = fileURLToPath(new URL('../', import.meta.url));
const agents = ['Claude', 'Codex', 'OpenCode', 'Antigravity'].map((name, i) => ({
  id: `agent-${i}`, name, kind: name, status: ['idle', 'working', 'blocked', 'done'][i],
  ready: i === 0 || i === 3, paneId: `w1:p${i + 1}`, cwd: 'projet-demo', boss: i === 0
}));
let writes = 0;
let captureCount = 4, captureAuto = false;
before(async () => {
  if (!enabled) return;
  const { chromium } = await import(process.env.MYTEAM_PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, executablePath: process.env.MYTEAM_CHROMIUM });
  server = createServer(async (req, res) => {
    if (req.method !== 'GET') { writes++; res.writeHead(405); return res.end(); }
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/')) {
      const team = captureCount === 4 ? agents : [...agents, ...['Gemini', 'Cursor', 'Kimi', 'Copilot', 'Grok', 'Pi'].map((name, i) => ({ id: `extra-${i}`, name, kind: name, status: i % 2 ? 'idle' : 'working', ready: i % 2 === 1, paneId: `w2:p${i + 1}` }))];
      const data = path === '/api/state' ? { connected: true, token: 'simulation', agents: team, pied: { gauche: '', droite: '', enseigne: '' } }
        : path === '/api/read' ? { text: 'Vérification terminée.\nUne erreur de démonstration.\nEn attente de votre réponse.' }
        : path === '/api/autonomie' ? { actif: captureAuto, objectif: 'Vérifier les corrections de démonstration', finAt: captureAuto ? '2026-10-20T14:35:00.000Z' : null, echanges: 2, maxEchanges: 3, journal: [] }
        : path === '/api/crise' ? { active: false }
        : path === '/api/pied' ? { gauche: '', droite: '', enseigne: '' }
        : path === '/api/sante' ? { herdr: true, journauxTrouves: 3, conforme: true }
        : { items: [], tasks: [], groups: [], messages: [], responses: [], files: [], places: [], agents: [], totals: {} };
      res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(data));
    }
    const base = resolve(root, path.startsWith('/site/') ? 'site' : 'public');
    const name = path.startsWith('/site/') ? path.slice(6) : path.slice(1);
    const file = resolve(base, name || 'index.html');
    if (!file.startsWith(base + sep)) { res.writeHead(403); return res.end(); }
    try {
      const data = await readFile(file);
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4' })[extname(file)] || 'application/octet-stream');
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test('captures de documentation : états simulés, aucune écriture', { skip: !enabled || !process.env.MYTEAM_REFRESH_CAPTURES, timeout: 90000 }, async () => {
  const captures = [
    ['01-ordinateur-scene'], ['01-ordinateur-scene-soir', 'soir'], ['02-ordinateur-poste', 'poste'], ['03-ordinateur-equipe', 'equipe'],
    ['04-ordinateur-palette', 'palette'], ['05-ordinateur-aide', 'aide'], ['06-telephone-scene'], ['07-telephone-poste', 'poste'],
    ['08-telephone-equipe', 'equipe'], ['09-telephone-palette', 'palette'], ['10-telephone-aide', 'aide'], ['11-ordinateur-mosaique', 'mosaique'],
    ['12-ordinateur-crise', 'crise'], ['13-telephone-mosaique', 'mosaique'], ['14-telephone-crise', 'crise'],
    ['16-ordinateur-autonomie', 'autonomie'], ['17-telephone-autonomie', 'autonomie'], ['18-ordinateur-autonomie-en', 'autonomie'],
    ['19-telephone-autonomie-en', 'autonomie'], ['20-ordinateur-10-agents', 'dix'], ['21-telephone-10-agents', 'dix'],
    ['22-ordinateur-autonomie-actif', 'actif'], ['23-ordinateur-autonomie-fenetre-active', 'actif-fenetre'],
    ['24-telephone-autonomie-actif', 'actif'], ['25-ordinateur-autonomie-actif-en', 'actif'], ['26-telephone-autonomie-actif-en', 'actif'],
    ['27-ordinateur-clair', 'clair'], ['28-telephone-clair', 'clair']
  ];
  const assetMap = { '01-ordinateur-scene': 'scene', '01-ordinateur-scene-soir': 'scene-soir', '02-ordinateur-poste': 'poste', '03-ordinateur-equipe': 'equipe', '11-ordinateur-mosaique': 'mosaique', '12-ordinateur-crise': 'crise', '16-ordinateur-autonomie': 'autonomie', '20-ordinateur-10-agents': '10-agents', '18-ordinateur-autonomie-en': 'autonomie-en', '22-ordinateur-autonomie-actif': 'autonomie-actif', '25-ordinateur-autonomie-actif-en': 'autonomie-actif-en' };
  for (const [name, action] of captures) {
    const mobile = name.includes('telephone'), en = name.endsWith('-en');
    captureCount = action === 'dix' ? 10 : 4;
    captureAuto = action?.startsWith('actif') || false;
    const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 900 }, locale: en ? 'en-US' : 'fr-FR', reducedMotion: 'reduce', colorScheme: 'dark' });
    try {
      await context.addInitScript(({ en, light, night }) => {
        localStorage.setItem('bureau.aideVue', '1'); localStorage.setItem('bureau.animation', 'off');
        localStorage.setItem('bureau.langue', en ? 'en' : 'fr'); localStorage.setItem('myteam.appearance', light ? 'light' : 'dark');
        const Original = Date, fixed = new Original(2026, 9, 20, night ? 21 : 14, 30).getTime();
        window.Date = class extends Original { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } };
      }, { en, light: action === 'clair', night: action === 'soir' });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/'); await page.locator('.agent-button').first().waitFor();
      if (action?.startsWith('actif')) await page.waitForFunction(() => document.querySelector('#auto-open').getAttribute('aria-checked') === 'true');
      if (action === 'poste') { await page.locator('.agent-button').first().click(); await page.locator('#output').filter({ hasText: 'Vérification' }).waitFor(); }
      if (action === 'equipe') await page.locator('#tab-equipe').click();
      if (action === 'palette') await page.locator('#palette-open').click();
      if (action === 'aide') await page.locator('#help-open').click();
      if (action === 'mosaique') { await page.locator('#tiles-open').click(); await page.locator('.tl-terminal-pre').first().filter({ hasText: 'Vérification' }).waitFor(); }
      if (action === 'crise') await page.locator('#crise-open').click();
      if (action === 'autonomie' || action === 'actif-fenetre') await page.locator('#auto-open').click();
      if (mobile && ['poste', 'equipe'].includes(action)) await page.locator('.detail').scrollIntoViewIfNeeded();
      if (mobile && action === 'mosaique') await page.locator('#tiles').scrollIntoViewIfNeeded();
      const file = resolve(root, 'docs/captures', name + '.png');
      await page.screenshot({ path: file });
      if (assetMap[name]) await copyFile(file, resolve(root, 'site/assets', assetMap[name] + '.png'));
      assert.deepEqual(errors, [], name);
    } finally { await context.close(); }
  }
  captureCount = 4; captureAuto = false;
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(r => server.close(r));
  assert.equal(writes, 0, 'aucune consigne ni écriture API pendant la vérification');
});
async function open(t, path = '/site/', options = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce', locale: 'fr-FR', ...options });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(origin + path);
  return page;
}

test('animation : le libellé traduit reste cohérent avec l’icône au démarrage', { skip: !enabled }, async t => {
  const page = await open(t, '/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  assert.equal(await page.locator('#motion use').getAttribute('href'), '/icons.svg#play');
  assert.equal(await page.locator('#motion span').textContent(), 'Animer le bureau');
  await page.locator('#lang-toggle').click();
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  assert.equal(await page.locator('#motion span').textContent(), 'Animate the office');
  await page.locator('#motion').click();
  assert.equal(await page.locator('#motion use').getAttribute('href'), '/icons.svg#pause');
  assert.equal(await page.locator('#motion span').textContent(), 'Pause');
});

test('galerie : Tab reste dans le dialogue et Échap rend le focus à la vignette', { skip: !enabled }, async t => {
  const page = await open(t);
  const trigger = page.locator('.gallery-item').first();
  await trigger.focus(); await trigger.press('Enter');
  await page.locator('.lightbox.active').waitFor();
  for (const key of ['Tab', 'Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    assert.equal(await page.evaluate(() => document.querySelector('.lightbox').contains(document.activeElement)), true);
  }
  await page.keyboard.press('Escape');
  assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
});

test('thèmes : persistance, système et langue sur la vitrine et le bureau', { skip: !enabled }, async t => {
  for (const path of ['/site/', '/']) {
    const page = await open(t, path);
    const select = page.locator('[data-appearance-select]');
    await select.selectOption('light');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.reload();
    assert.equal(await select.inputValue(), 'light');
    await select.selectOption('system'); await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.locator(path === '/' ? '#lang-toggle' : '#btn-lang').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await select.getAttribute('aria-label'), 'Appearance');
  }
});

test('thèmes : stockage refusé, l’apparence et la langue restent utilisables', { skip: !enabled }, async t => {
  const page = await open(t);
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Refusé'); } }));
  await page.reload();
  await page.locator('[data-appearance-select]').selectOption('light');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.locator('#btn-lang').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
});

test('responsive : les deux surfaces restent dans l’écran, en clair et sombre', { skip: !enabled, timeout: 60000 }, async t => {
  for (const path of ['/site/', '/']) {
    const page = await open(t, path);
    for (const width of [360, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      // Le viewport change avant la fin du recalcul des règles responsive.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      for (const theme of ['light', 'dark']) {
        await page.locator('[data-appearance-select]').selectOption(theme);
        const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
          overflow: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, name: el.id || el.className, right: el.getBoundingClientRect().right })) }));
        if (process.env.MYTEAM_CAPTURE_DIR) {
          await mkdir(process.env.MYTEAM_CAPTURE_DIR, { recursive: true });
          if (path === '/' && await page.locator('#help-close').isVisible()) await page.locator('#help-close').click();
          await page.screenshot({ path: resolve(process.env.MYTEAM_CAPTURE_DIR, `${path === '/' ? 'bureau' : 'vitrine'}-${width}-${theme}.png`) });
        }
        assert.ok(dimensions.content <= dimensions.width + 1, `${path} ${width}px ${theme} : ${JSON.stringify(dimensions)}`);
      }
    }
  }
});

function contrast(a, b) {
  function luminance(hex) {
    if (hex.startsWith('rgb')) {
      const channels = hex.match(/[\d.]+/g).slice(0, 3).map(Number);
      hex = '#' + channels.map(n => n.toString(16).padStart(2, '0')).join('');
    }
    const rgb = hex.trim().replace('#', '');
    const full = rgb.length === 3 ? [...rgb].map(x => x + x).join('') : rgb;
    const v = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
    return v[0] * .2126 + v[1] * .7152 + v[2] * .0722;
  }
  const values = [luminance(a.trim()), luminance(b.trim())].sort((x, y) => x - y);
  return (values[1] + .05) / (values[0] + .05);
}

test('contraste : textes, états et terminal restent lisibles dans les deux thèmes', { skip: !enabled }, async t => {
  const page = await open(t, '/');
  for (const theme of ['light', 'dark']) {
    await page.locator('[data-appearance-select]').selectOption(theme);
    const colors = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      return Object.fromEntries(['text', 'muted', 'quiet', 'surface', 'bg', 'mint', 'amber', 'blue', 'negative-ink', 'negative-bg', 'on-accent', 'terminal-text', 'terminal-bg'].map(k => [k, css.getPropertyValue('--' + k)]));
    });
    for (const [a, b] of [['text', 'surface'], ['muted', 'surface'], ['quiet', 'bg'], ['mint', 'surface'], ['amber', 'surface'], ['blue', 'surface'], ['negative-ink', 'negative-bg'], ['on-accent', 'mint'], ['terminal-text', 'terminal-bg']]) {
      assert.ok(contrast(colors[a], colors[b]) >= 4.5, `${theme} : ${a}/${b}`);
    }
  }
});

test('contraste : destinations, Markdown, autonomie active et survol des alertes', { skip: !enabled }, async t => {
  const page = await open(t, '/');
  await page.evaluate(() => {
    const sample = document.createElement('section'); sample.id = 'contrast-sample';
    const place = document.createElement('button'); place.className = 'place'; place.textContent = 'Documents';
    const response = document.createElement('div'); response.id = 'contrast-response';
    sample.append(place, response); document.body.append(sample);
    ResponseCard.renderMarkdown('```js\nconst exemple = 1;\n```', response);
    document.querySelector('#auto-open').setAttribute('aria-checked', 'true');
  });
  for (const theme of ['light', 'dark']) {
    await page.locator('[data-appearance-select]').selectOption(theme);
    await page.locator('#attention-open').hover();
    const pairs = await page.evaluate(() => {
      const selectors = ['.place', '.rc-code-pre', '#auto-open .ms-state', '#attention-open'];
      return selectors.map(selector => {
        const el = document.querySelector(selector), css = getComputedStyle(el);
        let parent = el, background = css.backgroundColor;
        while (background === 'rgba(0, 0, 0, 0)' && parent.parentElement) { parent = parent.parentElement; background = getComputedStyle(parent).backgroundColor; }
        return [selector, css.color, background];
      });
    });
    const failures = pairs.filter(([, text, background]) => contrast(text, background) < 4.5);
    assert.deepEqual(failures, [], theme);
  }
});

test('contraste : les contours des contrôles restent identifiables dans les deux thèmes', { skip: !enabled }, async t => {
  const page = await open(t, '/');
  for (const theme of ['light', 'dark']) {
    await page.locator('[data-appearance-select]').selectOption(theme);
    const pairs = await page.evaluate(() => ['.appearance-control', '.term-tools input', '#message', '.auto-form textarea'].map(selector => {
      const css = getComputedStyle(document.querySelector(selector));
      return [selector, css.borderTopColor, css.backgroundColor];
    }));
    assert.deepEqual(pairs.filter(([, line, background]) => contrast(line, background) < 3), [], theme);
  }
});
