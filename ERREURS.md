# Erreurs et solutions

- Choix de direction lancé avant PRODUCT.md : refus sans modification. Solution : créer le contexte produit confirmé avant de reprendre.
- Lecture de l'historique du Codex actif refusée par Herdr. Aucun effet sur son travail. Solution appliquée au raccordement : source visible lorsque l'agent travaille.
- Relecture finale : caractères UTF-8 coupés entre deux morceaux réseau pouvant être abîmés. Reproduction « Réparer » devenant « R��parer ». Solution : assembler les octets, puis décoder une seule fois. Test durable dans test/utf8.test.mjs.
