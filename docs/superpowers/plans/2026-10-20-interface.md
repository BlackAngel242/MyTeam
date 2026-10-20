# Harmonisation de l'interface : plan d'implémentation

> Exécution native dans une branche isolée, avec une revue indépendante du diff final.

**Objectif :** appliquer la revue PRD/Fixit approuvée, avec Lucide et trois modes d'apparence sur la vitrine et le bureau.

**Architecture :** SVG statiques Lucide, sélection d'apparence native avec préférence locale, palettes CSS. Le serveur ne change que pour servir les nouveaux assets. La scène pixel art et les API d'envoi ne changent pas.

**Stack :** JavaScript natif, CSS, Node.js ≥ 22, zéro dépendance npm de production.

**Spécification :** [Interface harmonisée](../../interface.md).

## Contraintes et points de revue

- Français/anglais, aucune donnée personnelle dans les captures, aucun message envoyé à un agent.
- Vérifier stockage refusé, préférence invalide, changement système, chargement initial et dialogue fermé.
- Contrôler panneaux d'erreur, terminal, états, fenêtres, téléphone et focus dans chaque thème.

## U1 : Galerie et présentation

- [x] Reproduire la fuite de focus dans un test navigateur, puis corriger le dialogue et son retour au déclencheur.
- [x] Harmoniser libellés, compatibilité et prérequis dans `site/index.html` et `site/site.js`.

## U2 : Lucide et thèmes

- [x] Tests du choix mémorisé, de Système et des stockages refusés ; constater les échecs avant implémentation.
- [x] Assets locaux, notices, contrôles Lucide et palettes sur `public/` et `site/` ; routes statiques et traduction.
- [x] Vérifier la synchronisation des assets communs et leurs réponses HTTP réelles.

## U3 : Livraison

- [x] Tests Node et navigateur ; captures simulées et revue visuelle ordinateur/téléphone, clair/sombre.
- [x] Actualiser les piliers et les captures de documentation ; revue indépendante et corrections.
- [x] Préparer la PR : accès GitHub rétabli après correction des droits du dépôt ; proposition destinée à la fusion manuelle par DrSmoke.

## Registre

- Base : `cfea4ae`. Base propre : 442 tests, 429 réussis, 13 ignorés, 0 échec sous Node 24.19.0.
- Décision : travail sur `codex_harmonisation-interface`, sans changer la configuration d'identité Git.

- Revue indépendante : six points corrigés (survol d’alerte, destinations, code Markdown, autonomie active, contours de champs et notices dans le sprite distribué).
- Dernier contrôle visuel : libellé de l’animation corrigé pour rester cohérent avec son icône après traduction au démarrage ; reproduction rouge puis verte au navigateur.
- Node 24 : vérification syntaxique et suite complète avec navigateur. Node 22 : suite complète native. 457 tests : 443 réussis et 14 ignorés avec navigateur sous Node 24 ; 435 réussis et 22 ignorés sous Node 22, aucun échec. Les mises à jour des journaux internes restent locales.
- Limites : Chromium uniquement ; pas de lecteur d’écran ni d’Herdr réel, pas de redémarrage de serveur utilisateur.
- Livraison : branche à relire et intégrer ; aucune fusion ni nouvelle release.
