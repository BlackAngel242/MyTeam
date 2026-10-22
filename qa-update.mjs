// Simulation controlee de la mise a jour integree (src/update.mjs et src/update-helper.mjs
// du commit teste), avec un fetcher factice : aucune requete reelle vers GitHub.
// Usage : node qa-update.mjs <checkout> <workdir>
//         node qa-update.mjs child <checkout> <bundleDir> <installDir> <dataDir> <port>
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [mode, ...args] = process.argv.slice(2);
let failures = 0;
function resultat(id, ok, detail) {
  if (!ok) failures++;
  console.log(`RESULT|${id}|${ok ? 'PASS' : 'FAIL'}|${detail}`);
}
function info(id, detail) { console.log(`RESULT|${id}|INFO|${detail}`); }

// ---------- ZIP (methode "stored", CRC32 reel) ----------
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function buildZip(entries) {
  const chunks = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'), crc = crc32(e.content), size = e.content.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, e.content);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(size, 20); cen.writeUInt32LE(size, 24);
    cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cen, name]));
    offset += 30 + name.length + size;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cd, end]);
}

async function fichiersDuCheckout(checkout, version, { broken = false } = {}) {
  const racine = `MyTeam-${version}/`;
  const entries = [{ name: racine, content: Buffer.alloc(0) }];
  const pkg = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'));
  pkg.version = version;
  entries.push({ name: racine + 'package.json', content: Buffer.from(JSON.stringify(pkg, null, 2)) });
  const server = broken ? Buffer.from('process.exit(1);\n') : await readFile(join(checkout, 'server.mjs'));
  entries.push({ name: racine + 'server.mjs', content: server });
  for (const dossier of ['src', 'public']) {
    const base = join(checkout, dossier);
    const pile = [base];
    while (pile.length) {
      const courant = pile.pop();
      for (const entree of await readdir(courant, { withFileTypes: true })) {
        const chemin = join(courant, entree.name);
        if (entree.isDirectory()) pile.push(chemin);
        else entries.push({ name: racine + chemin.slice(checkout.length + 1).replaceAll('\\', '/'), content: await readFile(chemin) });
      }
    }
  }
  return entries;
}

function releaseJson(version) {
  const base = `https://github.com/BlackAngel242/MyTeam/releases/download/v${version}`;
  return {
    tag_name: `v${version}`, draft: false, prerelease: false,
    assets: [
      { name: `MyTeam-${version}.zip`, browser_download_url: `${base}/MyTeam-${version}.zip` },
      { name: `MyTeam-${version}.zip.sha256`, browser_download_url: `${base}/MyTeam-${version}.zip.sha256` },
    ],
  };
}
function bodyRes(buf) {
  return { ok: true, headers: { get: (h) => (h.toLowerCase() === 'content-length' ? String(buf.length) : null) }, body: (async function* () { yield buf; })() };
}
function makeFetcher(bundle) {
  return async (url) => {
    if (url.includes('/releases/latest')) return { ok: true, headers: { get: () => null }, json: async () => bundle.json };
    if (url.endsWith('.zip.sha256')) return bodyRes(Buffer.from(bundle.shaText, 'utf8'));
    if (url.endsWith('.zip')) return bodyRes(bundle.zipBuf);
    throw new Error(`URL inattendue : ${url}`);
  };
}
async function construireBundle(checkout, version, options = {}) {
  const entries = await fichiersDuCheckout(checkout, version, options);
  const zipBuf = buildZip(entries);
  const sha = createHash('sha256').update(zipBuf).digest('hex');
  const shaText = options.badSha ? `${'0'.repeat(64)}  MyTeam-${version}.zip\n` : `${sha}  MyTeam-${version}.zip\n`;
  return { json: releaseJson(version), zipBuf, shaText };
}
async function ecrireBundle(dir, bundle) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'release.json'), JSON.stringify(bundle.json));
  await writeFile(join(dir, 'archive.zip'), bundle.zipBuf);
  await writeFile(join(dir, 'checksum.txt'), bundle.shaText);
}
async function lireBundle(dir) {
  return {
    json: JSON.parse(await readFile(join(dir, 'release.json'), 'utf8')),
    zipBuf: await readFile(join(dir, 'archive.zip')),
    shaText: await readFile(join(dir, 'checksum.txt'), 'utf8'),
  };
}
async function installTree(checkout, dir, version) {
  await mkdir(dir, { recursive: true });
  await cp(join(checkout, 'server.mjs'), join(dir, 'server.mjs'));
  await cp(join(checkout, 'src'), join(dir, 'src'), { recursive: true });
  await cp(join(checkout, 'public'), join(dir, 'public'), { recursive: true });
  const pkg = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'));
  pkg.version = version;
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  await mkdir(join(dir, '.bureau'), { recursive: true });
  await writeFile(join(dir, '.bureau', 'marqueur.txt'), 'configuration-locale-qa');
  await mkdir(join(dir, '.myteam-local'), { recursive: true });
  await writeFile(join(dir, '.myteam-local', 'marqueur.txt'), 'kit-local-qa');
}
async function etapes(parent) {
  return (await readdir(parent)).filter((n) => n.startsWith('.myteam-stage-'));
}
async function attendre(condition, timeoutMs, pas = 500) {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) { if (await condition()) return true; await new Promise((r) => setTimeout(r, pas)); }
  return false;
}
async function portOuvert(port) {
  try { const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) }); return r.status; } catch { return 0; }
}
function tuerParPort(port) {
  try {
    const pid = execFileSync('powershell.exe', ['-NoProfile', '-Command', `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`], { encoding: 'utf8' }).trim();
    if (pid) process.kill(Number(pid));
  } catch {}
}

// ---------- Mode enfant : prepare puis declenche l'installation, puis sort ----------
if (mode === 'child') {
  const [checkout, bundleDir, installDir, dataDir, port] = args;
  const { createUpdater } = await import(pathToFileURL(join(checkout, 'src', 'update.mjs')).href);
  const bundle = await lireBundle(bundleDir);
  const updater = createUpdater({ root: installDir, dataRoot: dataDir, fetcher: makeFetcher(bundle), port: () => Number(port) });
  await updater.prepare();
  const res = await updater.install();
  console.log(`ENFANT|prepare-et-install-declenche|${JSON.stringify(res)}`);
  process.exit(0);
}

// ---------- Mode principal ----------
const [checkout, work] = args;
const { createUpdater, extractZip } = await import(pathToFileURL(join(checkout, 'src', 'update.mjs')).href);
await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });

// U1 : detection d'une nouvelle version
{
  const root = join(work, 'u1'); await installTree(checkout, root, '0.5.1');
  const bundle = await construireBundle(checkout, '0.5.2');
  const updater = createUpdater({ root, dataRoot: join(work, 'u1-data'), fetcher: makeFetcher(bundle), port: () => 4817 });
  const st = await updater.check({ force: true });
  resultat('U1', st.installed === '0.5.1' && st.latest === '0.5.2' && st.available === true, `Detection : installee=${st.installed}, derniere=${st.latest}, disponible=${st.available}`);
}

// U2 : preparation complete, conservation des dossiers locaux dans l'etape
{
  const root = join(work, 'u2'); await installTree(checkout, root, '0.5.1');
  const bundle = await construireBundle(checkout, '0.5.2');
  const updater = createUpdater({ root, dataRoot: join(work, 'u2-data'), fetcher: makeFetcher(bundle), port: () => 4817 });
  const st = await updater.prepare();
  const stages = await etapes(work);
  let ok = st.ready === '0.5.2' && stages.length === 1;
  let detail = `Pret=${st.ready}, etapes=${stages.length}`;
  if (stages.length === 1) {
    const stage = join(work, stages[0]);
    const pkgStage = JSON.parse(await readFile(join(stage, 'package.json'), 'utf8'));
    const marqueurBureau = existsSync(join(stage, '.bureau', 'marqueur.txt')) ? await readFile(join(stage, '.bureau', 'marqueur.txt'), 'utf8') : '';
    const marqueurKit = existsSync(join(stage, '.myteam-local', 'marqueur.txt')) ? await readFile(join(stage, '.myteam-local', 'marqueur.txt'), 'utf8') : '';
    ok = ok && pkgStage.version === '0.5.2' && marqueurBureau === 'configuration-locale-qa' && marqueurKit === 'kit-local-qa';
    detail += `, version etape=${pkgStage.version}, .bureau conserve=${marqueurBureau === 'configuration-locale-qa'}, .myteam-local conserve=${marqueurKit === 'kit-local-qa'}`;
  }
  resultat('U2', ok, detail);
}

// U3 : SHA-256 incorrect refuse
{
  const root = join(work, 'u3'); await installTree(checkout, root, '0.5.1');
  const bundle = await construireBundle(checkout, '0.5.2', { badSha: true });
  const updater = createUpdater({ root, dataRoot: join(work, 'u3-data'), fetcher: makeFetcher(bundle), port: () => 4817 });
  let message = '';
  try { await updater.prepare(); } catch (e) { message = e.message; }
  const stages = await etapes(work);
  resultat('U3', /Empreinte SHA-256/.test(message) && stages.length === 0, `Refus SHA incorrect : "${message}" ; aucune etape laissee=${stages.length === 0}`);
}

// U4 : chemins dangereux refuses par extractZip
{
  const base = await fichiersDuCheckout(checkout, '9.9.9');
  const cas = [
    { nom: 'traversee', entries: [...base, { name: 'MyTeam-9.9.9/../evil.txt', content: Buffer.from('x') }], motif: /refusé/ },
    { nom: 'env', entries: [...base, { name: 'MyTeam-9.9.9/.env', content: Buffer.from('x') }], motif: /refusé/ },
    { nom: 'antislash', entries: [...base, { name: 'MyTeam-9.9.9/src\\evil.mjs', content: Buffer.from('x') }], motif: /refusé/ },
    { nom: 'incomplet', entries: base.filter((e) => !e.name.endsWith('server.mjs')), motif: /incomplète/ },
  ];
  for (const c of cas) {
    let message = '';
    try { extractZip(buildZip(c.entries), '9.9.9'); } catch (e) { message = e.message; }
    resultat(`U4-${c.nom}`, c.motif.test(message), `Archive ${c.nom} : "${message}"`);
  }
}

// U5 : refus de remplacer un clone Git
{
  const root = join(work, 'u5'); await installTree(checkout, root, '0.5.1');
  await mkdir(join(root, '.git'), { recursive: true });
  const bundle = await construireBundle(checkout, '0.5.2');
  const updater = createUpdater({ root, dataRoot: join(work, 'u5-data'), fetcher: makeFetcher(bundle), port: () => 4817 });
  let message = '';
  try { await updater.prepare(); } catch (e) { message = e.message; }
  resultat('U5', /Copie Git/.test(message), `Refus clone Git : "${message}"`);
}

// U8 : aucune nouvelle version
{
  const root = join(work, 'u8'); await installTree(checkout, root, '0.5.1');
  const bundle = await construireBundle(checkout, '0.5.1');
  const updater = createUpdater({ root, dataRoot: join(work, 'u8-data'), fetcher: makeFetcher(bundle), port: () => 4817 });
  let message = '';
  try { await updater.prepare(); } catch (e) { message = e.message; }
  resultat('U8', /Aucune nouvelle version/.test(message), `Sans nouveaute : "${message}"`);
}

// U6 : installation declenchee, echange, redemarrage sur le meme port
const portU6 = 4817;
const dirU6 = join(work, 'u6');
{
  await installTree(checkout, dirU6, '0.5.1');
  const bundleDir = join(work, 'u6-bundle');
  await ecrireBundle(bundleDir, await construireBundle(checkout, '0.5.2'));
  const enfant = execFileSync(process.execPath, [new URL(import.meta.url).pathname.replace(/^\//, ''), 'child', checkout, bundleDir, dirU6, join(work, 'u6-data'), String(portU6)], { encoding: 'utf8' });
  info('U6', `Sortie enfant : ${enfant.trim()}`);
  const servi = await attendre(async () => (await portOuvert(portU6)) === 200, 90000);
  const pkgApres = JSON.parse(await readFile(join(dirU6, 'package.json'), 'utf8'));
  const backups = (await readdir(work)).filter((n) => n.startsWith('.myteam-backup-'));
  const marqueur = existsSync(join(dirU6, '.bureau', 'marqueur.txt')) ? await readFile(join(dirU6, '.bureau', 'marqueur.txt'), 'utf8') : '';
  resultat('U6', servi && pkgApres.version === '0.5.2', `Nouveau serveur repond sur le port ${portU6} : ${servi} ; version apres echange=${pkgApres.version}`);
  resultat('U6', backups.length === 1 && marqueur === 'configuration-locale-qa', `Sauvegarde creee=${backups.length === 1} ; donnees locales conservees=${marqueur === 'configuration-locale-qa'}`);
}

// U7 : retour arriere si le redemarrage echoue
const portU7 = 4818;
{
  const dirU7 = join(work, 'u7');
  await installTree(checkout, dirU7, '0.5.2');
  const bundleDir = join(work, 'u7-bundle');
  await ecrireBundle(bundleDir, await construireBundle(checkout, '0.5.3', { broken: true }));
  execFileSync(process.execPath, [new URL(import.meta.url).pathname.replace(/^\//, ''), 'child', checkout, bundleDir, dirU7, join(work, 'u7-data'), String(portU7)], { encoding: 'utf8' });
  const revenu = await attendre(async () => {
    if ((await portOuvert(portU7)) !== 200) return false;
    try { return JSON.parse(await readFile(join(dirU7, 'package.json'), 'utf8')).version === '0.5.2'; } catch { return false; }
  }, 180000);
  const echoues = (await readdir(work)).filter((n) => n.startsWith('.myteam-failed-'));
  resultat('U7', revenu && echoues.length === 1, `Retour arriere apres echec de demarrage : revenu en 0.5.2 et serveur repondant=${revenu} ; dossier d'echec conserve=${echoues.length === 1}`);
  tuerParPort(portU7);
}
tuerParPort(portU6);

console.log(`Simulation de mise a jour terminee : ${failures} echec(s).`);
process.exit(failures > 0 ? 1 : 0);
