// Relais en cas de pause de quota : quand un agent atteint sa limite d'usage (« You've hit your usage limit »),
// sa mission en cours est confiée à un suppléant disponible du même projet, puis l'agent est prévenu à son retour
// qu'elle a été reprise. Les messages passent par la file d'attente : jamais en crise, jamais à un agent occupé.

// Suppléant : même dossier de projet, prêt (idle/done), pas en pause, jamais le chef.
// Un outil d'une autre famille passe d'abord : un autre agent du même outil partage souvent le même compte, donc la même limite.
export function choisirSuppleant(source, agents, { enPause = () => false, chefId = null } = {}) {
  const candidats = agents.filter(a => a.id !== source.id && a.id !== chefId && a.cwd === source.cwd
    && ['idle', 'done'].includes(a.status) && a.ready === true && !enPause(a.id));
  return candidats.find(a => a.kind !== source.kind) ?? candidats[0] ?? null;
}

const heureDe = iso => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
};

// Consigne de relais. La mission connue (dernière consigne envoyée par la file) est citée ; dans tous les cas le
// suppléant lit l'écran de l'agent en pause, car une mission peut avoir été donnée hors de la file.
export function messageRelais({ source, retour = null, mission = null }) {
  const heure = heureDe(retour);
  const extrait = mission ? `\nSa dernière consigne connue :\n« ${mission.slice(0, 1500)}${mission.length > 1500 ? '…' : ''} »` : '';
  return `Chef : ${source.name} (${source.kind}) est en pause de quota${heure ? ` jusqu'à ${heure}` : ''}. Tu reprends sa mission en relais.`
    + `\n1. Lis son écran pour retrouver la tâche et l'état exact : herdr agent read ${source.paneId} --source recent-unwrapped --lines 200`
    + `\n2. Vérifie ce qui est déjà fait (git status, git log, fichiers modifiés) dans ${source.cwd} : ne refais rien de déjà commité, ne touche pas aux fichiers d'un autre agent.`
    + `\n3. Termine la mission, puis rends compte au chef (ce qui était fait, ce que tu as fait, ce qui reste).`
    + extrait;
}

export function messageRetour({ heure = null, suppleant }) {
  return `Chef : ta limite d'usage est levée${heure ? ` (retour annoncé à ${heure})` : ''}. Pendant ta pause, ta mission a été confiée à ${suppleant} : ne la reprends pas. Réponds « dispo » en une ligne et attends la prochaine consigne du chef.`;
}

// Dernière consigne envoyée par la file à cet agent dans les 12 dernières heures, s'il y en a une.
export function derniereMission(elements, id, { now = Date.now() } = {}) {
  const envoyes = elements.filter(e => e.id === id && e.state === 'envoyee' && e.sentAt && now - Date.parse(e.sentAt) < 12 * 3600000);
  envoyes.sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
  return envoyes[0]?.message ?? null;
}

export const relaisActif = (env = process.env) => env.BUREAU_RELAIS_QUOTA !== '0';
