# Outils et plugins recommandés

**Français** | [English](plugins-recommandes.en.md)

Ce que l'auteur utilise avec MyTeam. **Rien n'est installé automatiquement** : c'est une liste de départ, à choisir selon vos besoins. Chaque installation passe par votre confirmation, dans l'outil concerné.

## Outils d'IA en ligne de commande (dans les panneaux Herdr)

Herdr reconnaît ces types d'agents : pi, claude, codex, gemini, cursor, devin, agy, cline, omp, mastracode, opencode, copilot, kimi, kiro, droid, amp, grok, hermes, kilo, qodercli, qwen, letta, maki, muse. L'auteur utilise surtout Claude Code (chef), Codex, Antigravity (`agy`) et OpenCode. L'installeur de MyTeam détecte ceux qui sont présents et propose de les lancer un par un.

## Intégrations officielles de Herdr

`herdr integration install <outil>` fait remonter à Herdr l'état et l'identifiant de session de l'agent. Elles modifient la configuration de l'outil concerné : l'installeur les propose une par une. Sans l'intégration de Claude, le bureau ne peut pas afficher les réponses lisibles de Claude (pas de session exacte). Outils concernés : pi, omp, claude, codex, copilot, devin, droid, kimi, opencode, kilo, hermes, qodercli, qwen, letta, cursor, mastracode, antigravity-cli, grok.

## Plugins de Claude Code utilisés par l'auteur

Relevés dans l'installation de l'auteur (octobre 2026). Les noms de marketplaces sont ceux de son installation ; **vérifiez la commande d'installation avec `claude plugin --help`** avant de la copier, elle n'est pas garantie ici.

| Plugin | Marketplace | À quoi il sert |
| --- | --- | --- |
| superpowers | claude-plugins-official | Méthodes de travail (planifier, déboguer, tester, relire). |
| frontend-design | claude-plugins-official | Aide à la conception d'interfaces soignées. |
| impeccable | impeccable | Revue et amélioration de design d'interface. |
| honey | greenpt | Réponses et code plus courts, moins de jetons consommés. |
| pua | pua-skills | Exigence de preuve et changement d'approche après des échecs répétés. |
| netlify-skills | claude-plugins-official | Déploiement et configuration Netlify. |
| lovable | claude-plugins-official | Pont vers le générateur d'applications Lovable. |
| rust-analyzer-lsp | claude-plugins-official | Analyse de code Rust. |
| greptile | anthropic-plugin-directory | Revue de code assistée. |
| warp | claude-code-warp | Intégration avec le terminal Warp. |

## Extensions VS Code proposées par l'installeur

Markdown All in One (`yzhang.markdown-all-in-one`), ESLint (`dbaeumer.vscode-eslint`) et Prettier (`esbenp.prettier-vscode`) : facultatives, une confirmation par extension.

## Ce que le projet n'exige pas

MyTeam n'a aucune dépendance npm. Seuls Node.js 22 ou plus et Herdr sont nécessaires ; tout le reste de cette page est un confort.
