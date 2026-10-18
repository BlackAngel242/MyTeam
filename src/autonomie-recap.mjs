// Récapitulatif Markdown de fin d'autonomie (N3).
//
// Le récapitulatif ne raconte que ce qui est écrit dans le journal de
// src/autonomie.mjs : lancement, fins d'agents prévenues, arrêt. Rien d'autre.
// Jamais le contenu d'une réponse d'agent, jamais un chemin : l'objectif et les
// noms passent par le masque public avant de sortir. Aucun mode tourné, aucune
// ligne à raconter : la sortie reste vide.
//
// Les faits sont lus d'abord dans les champs structurés de l'entrée de journal,
// quand ils existent ; à défaut dans le texte de l'entrée. Les deux formes sont
// acceptées pour que le récapitulatif marche aujourd'hui et continue de marcher
// le jour où src/autonomie.mjs enrichit son journal.
import { masque } from './masque.mjs';

const texte = valeur => (typeof valeur === 'string' ? masque(Array.from(valeur.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 300).join('')) : '');
const horodatage = valeur => (typeof valeur === 'string' && !Number.isNaN(Date.parse(valeur))) ? new Date(valeur).toISOString() : null;

// « objectif » dans une entrée de lancement : « … » quand le texte fait foi.
const objectifDe = entree => {
  if (typeof entree?.objectif === 'string' && entree.objectif.trim()) return texte(entree.objectif);
  const trouve = /«\s*([\s\S]*?)\s*»/.exec(String(entree?.texte ?? ''));
  return trouve ? texte(trouve[1]) : '';
};

// « 20 échanges au plus » dans une entrée de lancement.
const plafondDe = entree => {
  if (Number.isInteger(entree?.maxEchanges) && entree.maxEchanges > 0) return entree.maxEchanges;
  const trouve = /(\d+)\s+échanges?\s+au\s+plus/i.exec(String(entree?.texte ?? ''));
  return trouve ? Number(trouve[1]) : null;
};

// « Claude a terminé » dans une entrée de fin d'agent.
const agentDe = entree => {
  if (typeof entree?.agent === 'string' && entree.agent.trim()) return texte(entree.agent);
  const trouve = /^([\s\S]*?)\s+a\s+termin/i.exec(String(entree?.texte ?? ''));
  return trouve ? texte(trouve[1]) : '';
};

// « Autonomie arrêtée : durée écoulée. » dans une entrée d'arrêt.
const motifDe = entree => {
  if (typeof entree?.motif === 'string' && entree.motif.trim()) return texte(entree.motif);
  const trouve = /arrêt[ée]e\s*:\s*([\s\S]*?)\.?\s*$/.exec(String(entree?.texte ?? ''));
  return trouve ? texte(trouve[1].replace(/\.$/, '')) : '';
};

export function recapAutonomie(etat = {}) {
  const journal = Array.isArray(etat.journal) ? etat.journal : [];
  const lancement = journal.find(entree => entree?.type === 'debut');
  // Aucun lancement observé : aucun mode n'a tourné, rien à raconter.
  if (!lancement) return '';

  const arret = [...journal].reverse().find(entree => entree?.type === 'arret');
  const fins = journal.filter(entree => entree?.type === 'message');
  const objectif = objectifDe(lancement) || texte(etat.objectif) || '(non renseigné)';
  const plafond = plafondDe(lancement);
  const debut = horodatage(lancement.at) ?? horodatage(etat.debut);
  const fin = arret ? horodatage(arret.at) : null;
  const motif = arret ? motifDe(arret) : '';
  const encoreActive = etat.actif === true && !arret;

  const lignes = ['# Récapitulatif d\'autonomie', ''];
  lignes.push(`- Objectif : ${objectif}`);
  if (debut) lignes.push(`- Début : ${debut}`);
  // Pas d'arrêt observé : on ne l'invente pas, on dit que c'est en cours.
  if (fin) lignes.push(`- Fin : ${fin}`);
  if (motif) lignes.push(`- Motif d'arrêt : ${motif}`);
  if (encoreActive) lignes.push('- État : en cours, aucun arrêt observé');
  lignes.push(`- Échanges : ${fins.length}${plafond ? ` sur ${plafond} au plus` : ''}`);

  if (fins.length) {
    lignes.push('', '## Fins d\'agents prévenues', '');
    for (const entree of fins) {
      const quand = horodatage(entree.at) ?? '';
      const qui = agentDe(entree) || '(agent non nommé)';
      lignes.push(`- ${quand ? `${quand} · ` : ''}${qui}`);
    }
  }
  return lignes.join('\n') + '\n';
}
