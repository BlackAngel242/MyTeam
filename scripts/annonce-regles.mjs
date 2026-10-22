#!/usr/bin/env node
// Affiche les règles de travail MyTeam au démarrage d'une session d'agent (hook SessionStart de Claude Code).
// En cas d'échec, rien n'est affiché et la session démarre quand même.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fichier = fileURLToPath(new URL('../docs/regles-agents.md', import.meta.url));

try {
  process.stdout.write(await readFile(fichier, 'utf8'));
} catch {
  process.exitCode = 0;
}
