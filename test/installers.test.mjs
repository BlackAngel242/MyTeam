import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Contrôle des installeurs en LECTURE SEULE : aucun installateur n'est exécuté,
// seuls leur contenu et leur syntaxe sont vérifiés.
const execute = promisify(execFile);
const racine = fileURLToPath(new URL('..', import.meta.url));
const ps1 = join(racine, 'scripts', 'installer.ps1');
const sh = join(racine, 'scripts', 'installer.sh');

async function textes() {
  return { ps1: await readFile(ps1, 'utf8'), sh: await readFile(sh, 'utf8') };
}

test('les deux installeurs annoncent simulation, acceptation totale et aide', async () => {
  const { ps1: t1, sh: t2 } = await textes();
  for (const [nom, texte] of [['installer.ps1', t1], ['installer.sh', t2]]) {
    assert.match(texte, /DryRun|dry-run/, `${nom} : mode simulation`);
    assert.match(texte, /Oui|--oui|OUI=/, `${nom} : mode acceptation totale`);
    assert.match(texte, /Aide|--aide/, `${nom} : aide`);
    assert.match(texte, /\(o\/n\)/, `${nom} : confirmation o/n`);
    assert.ok(!texte.includes('—'), `${nom} : pas de tiret cadratin`);
  }
});

test('les commandes d\'installation sont celles vérifiées, Antigravity reste un lien', async () => {
  const { ps1: t1, sh: t2 } = await textes();
  for (const attendu of ['winget install --id OpenJS.NodeJS.LTS', 'https://herdr.dev/install.ps1', 'https://claude.ai/install.ps1', 'https://chatgpt.com/codex/install.ps1', 'opencode-ai', '@google/gemini-cli']) {
    assert.ok(t1.includes(attendu), `installer.ps1 : ${attendu}`);
  }
  for (const attendu of ['https://herdr.dev/install.sh', 'https://claude.ai/install.sh', 'https://chatgpt.com/codex/install.sh', 'https://opencode.ai/install', 'brew install node', '@google/gemini-cli']) {
    assert.ok(t2.includes(attendu), `installer.sh : ${attendu}`);
  }
  // Antigravity : documentation seule, jamais de commande inventée.
  for (const [nom, texte] of [['installer.ps1', t1], ['installer.sh', t2]]) {
    assert.match(texte, /antigravity\.google/, `${nom} : lien Antigravity`);
    assert.ok(!/(winget|npm|brew|choco|scoop|curl)[^\n]{0,40}antigravity/i.test(texte), `${nom} : aucune commande Antigravity inventée`);
  }
});

test('aucune clé ni aucun jeton n\'est demandé, lu ou enregistré', async () => {
  const { ps1: t1, sh: t2 } = await textes();
  for (const [nom, texte] of [['installer.ps1', t1], ['installer.sh', t2]]) {
    assert.match(texte, /[Aa]ucune clé|[Aa]ucun jeton|[Aa]ucune cl/, `${nom} : avertissement explicite`);
    assert.ok(!/(API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY)\s*=/.test(texte), `${nom} : aucune clé enregistrée`);
    assert.ok(!/Read-Host[^\n]{0,60}(clé|jeton|token|api)/i.test(texte), `${nom} : aucune saisie de clé`);
    assert.ok(!/curl[^\n]{0,80}(key|token)=/i.test(texte), `${nom} : aucune clé dans une URL`);
  }
});

test('les installeurs sont relancables : contrôle avant action', async () => {
  const { ps1: t1, sh: t2 } = await textes();
  assert.ok(t1.includes('Test-Path') && t1.includes('Get-Command'), 'installer.ps1 : vérifie avant d\'agir');
  assert.ok(t2.includes('command -v') && /(-f |-d |-x )/.test(t2), 'installer.sh : vérifie avant d\'agir');
  assert.ok(t2.includes('bureau-des-agents'), 'installer.sh : bloc de configuration marqué et remplace proprement');
  assert.ok((t1.match(/Confirmer /g) ?? []).length >= 6, 'installer.ps1 : chaque installation est confirmée');
  assert.ok((t2.match(/confirmer /g) ?? []).length >= 6, 'installer.sh : chaque installation est confirmée');
});

test('syntaxe PowerShell de installer.ps1 (parse seul, sans exécution)', async t => {
  if (!existsSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe') && !existsSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe')) {
    t.skip('PowerShell absent de cette machine');
    return;
  }
  const binaire = existsSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
    ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' : 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
  const script = `$t=[IO.File]::ReadAllText('${ps1.replace(/'/g, "''")}'); $e=$null; [void][System.Management.Automation.Language.Parser]::ParseInput($t,[ref]$null,[ref]$e); if($e.Count -gt 0){ $e | ForEach-Object { $_.Message }; exit 1 }`;
  const { stdout } = await execute(binaire, ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 30000 });
  assert.equal(stdout.trim(), '', 'aucune erreur de syntaxe PowerShell');
});

test('syntaxe bash de installer.sh (bash -n seul, sans exécution)', async t => {
  // git-bash sait ouvrir les chemins Windows ; le bash de WSL non.
  const candidats = ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files\\Git\\usr\\bin\\bash.exe', 'bash'];
  const dispos = candidats.filter(c => c === 'bash' || existsSync(c));
  if (dispos.length === 0) {
    t.skip('bash absent de cette machine');
    return;
  }
  for (const binaire of dispos) {
    try {
      await execute(binaire, ['-n', sh], { windowsHide: true, timeout: 30000 });
      assert.ok(true, `${binaire} : syntaxe valide`);
      return;
    } catch (erreur) {
      const texte = `${erreur.stderr || ''} ${erreur.message}`;
      if (/No such file|cannot open|Aucun fichier/i.test(texte)) continue;  // mauvais interpréteur : on tente le suivant
      assert.fail(`${binaire} refuse installer.sh : ${texte}`);
    }
  }
  t.skip('aucun bash capable d\'ouvrir le fichier sur cette machine');
});
