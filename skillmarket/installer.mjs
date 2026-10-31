#!/usr/bin/env node
// Installateur SkillMarket : fichiers locaux uniquement, sans dépendance ni réseau.
import { cp, lstat, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const skills = ['fixit', 'table-ronde'];
const tools = ['codex', 'claude', 'cursor', 'copilot'];
const HELP = [
  'SkillMarket — Fixit et TableRonde',
  'Usage : node skillmarket/installer.mjs [--tool codex|claude|cursor|copilot]',
  '  --scope user|project  Dossier de l’utilisateur (défaut) ou du projet',
  '  --skill all|fixit|table-ronde   Choix (défaut : all)',
  '  --dir CHEMIN         Utiliser un dossier de skills précis',
  '  --dry-run            Simulation, aucune écriture',
  '  --replace            Sauvegarder puis remplacer un skill différent',
  '  --list               Lister les skills du paquet',
  '  --help               Aide',
  'ChatGPT ne permet pas une installation locale : générer les ZIP avec build-zips.py.'
].join('\n');

function usageError(message) {
  throw new Error(message + '\n\n' + HELP);
}

function parse(args) {
  const opt = { tool: 'codex', scope: 'user', skill: 'all', dir: null, dryRun: false, replace: false, help: false, list: false };
  const names = { '--tool': 'tool', '--scope': 'scope', '--skill': 'skill', '--dir': 'dir' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') opt.help = true;
    else if (a === '--list') opt.list = true;
    else if (a === '--dry-run') opt.dryRun = true;
    else if (a === '--replace') opt.replace = true;
    else if (names[a]) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) usageError('Valeur manquante pour ' + a);
      opt[names[a]] = args[++i];
    } else usageError('Option inconnue : ' + a);
  }
  if (!opt.help && !opt.list) {
    if (![...tools, 'chatgpt'].includes(opt.tool)) usageError('Outil non pris en charge : ' + opt.tool);
    if (!['user', 'project'].includes(opt.scope)) usageError('Scope non pris en charge : ' + opt.scope);
    if (opt.skill !== 'all' && !skills.includes(opt.skill)) usageError('Skill inconnu : ' + opt.skill);
  }
  return opt;
}

function destination(opt) {
  if (opt.dir) return resolve(opt.dir);
  if (opt.scope === 'project') {
    const folder = { codex: '.agents/skills', claude: '.claude/skills', cursor: '.cursor/skills', copilot: '.github/skills' };
    return resolve(process.cwd(), folder[opt.tool]);
  }
  const home = homedir();
  const folder = { codex: '.agents/skills', claude: '.claude/skills', cursor: '.cursor/skills', copilot: '.config/github-copilot/skills' };
  return join(home, folder[opt.tool]);
}

async function statOrNull(path) {
  try { return await lstat(path); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function execute(opt) {
  if (opt.help) { console.log(HELP); return; }
  if (opt.list) { console.log(skills.join('\n')); return; }
  if (opt.tool === 'chatgpt') {
    throw new Error('ChatGPT n’accepte pas une installation locale. Générer les ZIP avec python skillmarket/build-zips.py, puis les importer depuis Plugins > Skills sur un compte éligible.');
  }
  const base = destination(opt);
  const selected = opt.skill === 'all' ? skills : [opt.skill];
  const plans = [];
  for (const skill of selected) {
    const source = join(root, 'skills', skill);
    const sourceSkill = await readFile(join(source, 'SKILL.md'), 'utf8');
    if (!sourceSkill.startsWith('---\nname: ' + skill + '\n')) throw new Error('Manifest de skill invalide : ' + skill);
    const target = join(base, skill);
    const found = await statOrNull(target);
    if (found?.isSymbolicLink()) throw new Error('Lien symbolique refusé : ' + target);
    if (found && !found.isDirectory()) throw new Error('La destination n’est pas un dossier : ' + target);
    const current = found ? await readFile(join(target, 'SKILL.md'), 'utf8').catch(() => null) : null;
    const status = !found ? 'installer' : current === sourceSkill ? 'identique' : opt.replace ? 'remplacer (sauvegarde)' : 'conflit';
    plans.push({ source, target, skill, status });
  }
  console.log('Destination : ' + base);
  for (const plan of plans) console.log(' - ' + plan.skill + ' : ' + plan.status);
  if (plans.some(p => p.status === 'conflit')) throw new Error('Skill déjà présent et différent. Ajouter --replace pour sauvegarder puis remplacer ; aucune modification effectuée.');
  if (opt.dryRun) { console.log('Simulation terminée : aucune écriture.'); return; }
  if (plans.every(p => p.status === 'identique')) { console.log('Les skills sont déjà à jour.'); return; }
  await mkdir(base, { recursive: true });
  for (const p of plans) {
    if (p.status === 'identique') continue;
    const temp = join(base, '.skillmarket-staging-' + randomUUID());
    let backup = null;
    try {
      await cp(p.source, temp, { recursive: true, force: false, errorOnExist: true });
      if (p.status === 'remplacer (sauvegarde)') {
        backup = p.target + '.backup-' + randomUUID();
        await rename(p.target, backup);
      }
      await rename(temp, p.target);
      console.log(p.skill + ' installé.' + (backup ? ' Ancienne version : ' + backup : ''));
    } catch (error) {
      await rm(temp, { recursive: true, force: true }).catch(() => {});
      if (backup && !(await statOrNull(p.target))) await rename(backup, p.target).catch(() => {});
      throw error;
    }
  }
}

execute(parse(process.argv.slice(2))).catch(error => {
  console.error('Erreur SkillMarket : ' + error.message);
  process.exitCode = 1;
});
