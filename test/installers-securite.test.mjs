import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const racine = fileURLToPath(new URL('..', import.meta.url));
const sh = await readFile(join(racine, 'scripts/installer.sh'), 'utf8');
const ps1 = join(racine, 'scripts/installer.ps1');
const ps = await readFile(ps1, 'utf8');
const interdit = erreur => erreur.code === 'EPERM' || erreur.code === 'EACCES' ||
  /CreateFileMapping|WSL\/Service\/E_ACCESSDENIED/i.test(`${erreur.stderr} ${erreur.message}`);
const options = { windowsHide: true, timeout: 120000 };
const psLiteral = valeur => `'${valeur.replaceAll("'", "''")}'`;

// On ne charge que des fonctions : jamais le corps des installeurs.
function fonctionsBash(...noms) {
  return noms.map(nom => {
    const texte = sh.match(new RegExp(`^${nom}\\(\\) \\{[\\s\\S]*?^\\}`, 'm'))?.[0];
    assert.ok(texte, `fonction ${nom} présente`);
    return texte;
  }).join('\n');
}

let bashDisponible;
async function bash(t, script, env = {}) {
  bashDisponible ??= (async () => {
    const candidats = process.platform === 'win32'
      ? ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'] : ['/bin/bash'];
    for (const binaire of candidats.filter(existsSync)) {
      try { await execute(binaire, ['--version'], options); return binaire; }
      catch (erreur) { if (!interdit(erreur)) throw erreur; }
    }
    return null;
  })();
  const binaire = await bashDisponible;
  if (!binaire) { t.skip('Bash absent ou bloqué par les droits de cette machine'); return null; }
  // Un fichier évite le guillemetage d'arguments de Windows, qui mutile les guillemets du script.
  const dossierScript = await mkdtemp(join(tmpdir(), 'bureau-script-'));
  t.after(() => rm(dossierScript, { recursive: true, force: true }));
  const fichier = join(dossierScript, 'essai.sh').replaceAll('\\', '/');
  await writeFile(fichier, script);
  return execute(binaire, ['--noprofile', '--norc', fichier], {
    ...options, env: { ...process.env, BASH_ENV: '', DRY_RUN: '0', OUI: '1', ...env },
  });
}

async function powershell(t, corps) {
  const binaire = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
  if (!existsSync(binaire)) { t.skip('PowerShell Windows absent'); return null; }
  const script = `$ErrorActionPreference='Stop'
$ast=[System.Management.Automation.Language.Parser]::ParseFile(${psLiteral(ps1)},[ref]$null,[ref]$null)
foreach($nom in @('Confirmer','Resoudre-Herdr','Chercher-Herdr')) {
  $fonction=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $nom},$true)
  if(-not $fonction){throw "fonction absente : $nom"}
  . ([scriptblock]::Create($fonction.Extent.Text))
}
function Dire($texte) {}
function Simuler($texte) {}
${corps}`;
  try {
    return await execute(binaire, ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], options);
  } catch (erreur) {
    if (!interdit(erreur)) throw erreur;
    t.skip('PowerShell bloqué par les droits de cette machine'); return null;
  }
}

test('B1/B2 : les chemins ne sont plus interpolés dans une commande shell', () => {
  assert.doesNotMatch(sh, /\bsh -c\b|\beval\b/);
  assert.match(sh, /"\$@"/);
  assert.match(sh, /cd -- "\$RACINE" && executer 'Execution de npm test\.' npm test/);
  assert.match(sh, /FICHIERS_PROFIL=\("\$HOME\/\.profile"\)/);
});

test('B3 : Herdr et chaque extension exigent leur confirmation particulière', () => {
  assert.match(sh, /confirmer 'Installer Herdr[^\n]+ individuel; then/);
  assert.match(sh, /confirmer "Installer l'extension[^\n]+ individuel; then/);
  assert.match(ps, /Confirmer 'Installer Herdr[^\n]+ -Individuel\)/);
  assert.match(ps, /Confirmer "Installer l'extension[^\n]+ -Individuel\)/);
});

test('B1 : un argument piégé reste un seul argument, sans exécution', async t => {
  const resultat = await bash(t, `${fonctionsBash('executer')}
dire() { :; }
executer test printf '<%s>' "$PIEGE"`, { PIEGE: 'dossier $(printf INJECTION >&2) `printf AUTRE >&2` " et espaces' });
  if (!resultat) return;
  assert.equal(resultat.stderr, '');
  assert.equal(resultat.stdout, '<dossier $(printf INJECTION >&2) `printf AUTRE >&2` " et espaces>');
});

test('B2 : profil et lanceurs gardent littéralement les dossiers piégés', async t => {
  const dossier = await mkdtemp(join(tmpdir(), 'bureau-installation-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  const resultat = await bash(t, `${fonctionsBash('literal_shell', 'ecrire_profil', 'ecrire_lanceur')}
dire() { :; }
FICHIERS_PROFIL=("$DOSSIER/profil avec espaces")
PORT_CHOISI=4317
HERDR_A_ENREGISTRER="$PIEGE"
HERDR_LANCEUR="$PIEGE"
ecrire_profil
. "${'$'}{FICHIERS_PROFIL[0]}"
printf '%s' "$BUREAU_HERDR_PATH"
ecrire_lanceur "$DOSSIER/herdr.command" herdr
ecrire_lanceur "$DOSSIER/bureau.command" bureau
# N'exécute pas de serveur : seuls exec/cd sont remplacés par des témoins.
exec() { printf '\\nHERDR:%s' "$1"; }
. "$DOSSIER/herdr.command"
cd() { printf '\\nRACINE:%s' "$2"; return 1; }
( . "$DOSSIER/bureau.command" ) || :`, {
    DOSSIER: dossier.replaceAll('\\', '/'),
    PIEGE: "/tmp/dossier ' $(printf INJECTION >&2) `printf AUTRE >&2` \\\" fin",
    RACINE: "/tmp/dossier ' $(printf INJECTION >&2) `printf AUTRE >&2` \\\" fin",
  });
  if (!resultat) return;
  const attendu = "/tmp/dossier ' $(printf INJECTION >&2) `printf AUTRE >&2` \\\" fin";
  assert.equal(resultat.stderr, '');
  assert.equal(resultat.stdout, `${attendu}\nHERDR:${attendu}\nRACINE:${attendu}`);
});

test('B2 : Desktop Entry protège espaces, guillemets, dollars et pourcents', async t => {
  const cible = '/tmp/avec espaces/"$(printf INJECTION)" `commande` \\ %f';
  const resultat = await bash(t, `${fonctionsBash('argument_desktop')}
argument_desktop "$CIBLE"`, { CIBLE: cible });
  if (!resultat) return;
  // Décode successivement la valeur Desktop Entry, l'argument Exec et les codes %.
  let argument = resultat.stdout.replace(/\\\\/g, '\\');
  assert.ok(argument.startsWith('"') && argument.endsWith('"'));
  argument = argument.slice(1, -1).replace(/\\(["$`\\])/g, '$1').replaceAll('%%', '%');
  assert.equal(argument, cible);
  const refuse = await bash(t, `${fonctionsBash('argument_desktop')}
if argument_desktop $'/tmp/a\\nExec=commande'; then exit 1; fi`);
  assert.equal(refuse.stdout, '');
});

test('B3 : --oui demande encore un o/n pour Herdr et chaque extension, EOF refuse', async t => {
  const resultat = await bash(t, `${fonctionsBash('confirmer')}
dire() { :; }; simuler() { :; }
for nom in Herdr Extension1 Extension2 Extension3; do
  if confirmer "$nom" individuel <<< n; then exit 1; fi
done
if confirmer Herdr individuel </dev/null; then exit 2; fi
confirmer Herdr individuel <<< o
confirmer configuration </dev/null`);
  if (!resultat) return;
  assert.equal((resultat.stdout.match(/\(o\/n\)/g) || []).length, 6);
});

test('B3 : -Oui respecte chaque refus individuel et autorise seulement un o/n explicite', async t => {
  const resultat = await powershell(t, `$DryRun=$false; $Oui=$true
$script:lectures=0
function Read-Host($question) { $script:lectures++; return 'n' }
foreach($nom in @('Herdr','Extension1','Extension2','Extension3')) {
  if(Confirmer $nom -Individuel){throw 'accord automatique interdit'}
}
if(-not (Confirmer configuration)){throw 'option Oui ordinaire perdue'}
if($lectures -ne 4){throw 'confirmation individuelle manquante'}
function Read-Host($question) { return 'o' }
if(-not (Confirmer Herdr -Individuel)){throw 'accord explicite perdu'}
function Read-Host($question) { return $null }
if(Confirmer Herdr -Individuel){throw 'absence de réponse acceptée'}
'ok'`);
  if (resultat) assert.equal(resultat.stdout.trim(), 'ok');
});

test('B4 : faux Herdr, dossier et joker sont refusés, exe résolu littéralement', async t => {
  const dossier = await mkdtemp(join(tmpdir(), 'bureau-herdr-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  const executable = join(dossier, 'herdr[1].exe');
  const faux = join(dossier, 'installer.ps1');
  await writeFile(executable, 'factice, jamais exécuté');
  await writeFile(faux, 'throw "ne jamais exécuter"');
  await mkdir(join(dossier, 'dossier.exe'));
  const resultat = await powershell(t, `
foreach($chemin in @(${[faux, join(dossier, 'dossier.exe'), join(dossier, '*.exe'), join(dossier, 'absent.exe')].map(psLiteral).join(',')})) {
  $HerdrChemin=$chemin
  $refuse=$false
  try { $null=Chercher-Herdr } catch { $refuse=$true }
  if(-not $refuse){throw 'faux chemin Herdr accepté'}
}
$HerdrChemin=${psLiteral(executable)}
$trouve=Chercher-Herdr
# Les runners Windows exposent des noms courts (8.3) : on compare le nom et l'existence, pas la forme du chemin.
if((Split-Path $trouve -Leaf) -cne 'herdr[1].exe' -or -not (Test-Path -LiteralPath $trouve)){throw 'chemin littéral perdu'}
'ok'`);
  if (resultat) assert.equal(resultat.stdout.trim(), 'ok');
});

test('B4 (sh) : --herdr-chemin exige un exécutable nommé herdr ou herdr.exe', async t => {
  const dossier = await mkdtemp(join(tmpdir(), 'bureau-herdr-'));
  t.after(() => rm(dossier, { recursive: true, force: true }));
  const base = dossier.replaceAll(String.fromCharCode(92), '/');
  const resultat = await bash(t, `${fonctionsBash('chercher_herdr')}
for nom in faux.sh herdr; do
  printf '#!/bin/sh\n' > "$DOSSIER/$nom"; chmod +x "$DOSSIER/$nom"
  HERDR_CHEMIN="$DOSSIER/$nom"; HOME=/inexistant
  printf '%s=%s\n' "$nom" "$(chercher_herdr || echo refuse)"
done`, { DOSSIER: base });
  if (!resultat) return;
  assert.equal(resultat.stdout, `faux.sh=refuse
herdr=${base}/herdr
`);
});
