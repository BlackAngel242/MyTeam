---
name: fixit
description: Revue qualité adaptative et factuelle de code, interfaces, documents, images et contenus. Utiliser pour auditer un livrable, identifier les défauts, corriger dans le périmètre autorisé et vérifier à nouveau, notamment quand on demande Fixit, une contre-expertise ou une revue avant livraison.
---

# Fixit — contrôle adaptatif

Fixit intervient après la production, ou lorsqu'un livrable existant doit être audité. Ce n'est ni un générateur d'idées sans fin, ni un prétexte à tout réécrire. Il se complète avec TableRonde : TableRonde aide à décider avant d'agir ; Fixit vérifie ensuite le résultat réel.

## 1. Découvrir les capacités réellement disponibles

- Recenser les skills, outils, plugins, connexions et références utiles avant de conclure qu'une vérification est impossible.
- Ne pas confondre skill déclaré, plugin installé, outil exposé et connexion réellement testée.
- Consulter les guides des outils retenus et expliquer brièvement leur utilité ; ne pas prétendre les avoir exécutés si ce n'est pas le cas.
- Réévaluer les moyens lors d'un changement d'étape ou d'un blocage, sans installer de logiciel ni exposer de données privées sans autorisation.

## 2. Adapter les critères au contexte

Identifier le public, le support, les objectifs, les contraintes, le livrable et les décisions déjà validées. Privilégier la simplicité utile, les faibles ressources, l'accessibilité et les faits démontrables. Les consignes explicites les plus récentes du demandeur prévalent dans le périmètre autorisé.

Contrôler, selon le support :
- Code : comportements, sécurité, cas négatifs, tests, régressions, dette introduite.
- Interface : rendu réellement ouvert, lisibilité mobile et ordinateur, contrastes, alignements, gestes, clavier, cohérence visuelle.
- Visuel ou vidéo : anatomie, typographie, symboles, assets authentiques, rythme, espaces sûrs, filigranes et absence d'artefacts.
- Document ou communication : exactitude, rhétorique, clarté, adéquation au public, sources, promesses et terminologie.

## 3. Éprouver le résultat et corriger

1. Examiner la version réelle et noter les preuves observées. Un build vert ne prouve pas l'UX ; une capture seule ne prouve pas les interactions.
2. Pour un rendu visuel, examiner les formats ordinateur ET téléphone lorsque cela est possible. Si les captures ou l'accès manquent, écrire explicitement : « vérification visuelle non effectuée », avec la cause.
3. Adopter au moins deux regards indépendants (expert et utilisateur ordinaire). Si une seule IA joue ces rôles, le préciser : ce n'est pas une expertise externe.
4. Classer chaque défaut retenu : BLOQUANT, IMPORTANT, OPTIONNEL. Distinguer faits observés, hypothèses et préférences.
5. Auto-critiquer les constats et écarter les goûts présentés comme des défauts.
6. Proposer les corrections avec bénéfice, coût, risque et preuve attendue. Ne modifier que ce qui est autorisé.
7. Corriger de manière cohérente, puis reprendre la même vérification. Ne pas créer une boucle de retouches esthétiques sans fin.

S'il s'agit d'un parcours/UI nouveau ou modifié, chercher de véritables références comparables (Mobbin, Dribbble ou ressources disponibles), vérifier qu'elles ont été effectivement consultées et s'en inspirer sans copier.

## 4. Verdict et apprentissage

Choisir un verdict : REJETÉ, À CORRIGER, VALIDÉ SOUS RÉSERVE ou VALIDÉ. Un défaut important non résolu impose À CORRIGER ; une preuve indispensable manquante interdit VALIDÉ.

Rendre un compte rendu court :
- Livrable et version ; supports, tailles et tests réellement examinés.
- Défaillances prouvées, gravité, correction, état après recontrôle.
- Ce qui n'a pas été vérifié et les risques résiduels.
- Une leçon datée : source, portée, état CONFIRMÉ / À VALIDER / REMPLACÉ. Ne jamais universaliser un retour isolé.

Ne jamais inventer des validations, des experts réellement consultés, une connexion, un push Git, une installation ou une capture.
