// Masque public unique du bureau (constats C-CD-04, C-CD-06, C-CD-12).
//
// Un seul découpage en TROIS règles distinctes, et non un compromis de largeur :
//   1. CHEMINS : Windows (C:\, C:/), UNC (\\serveur\partage) et Unix connus
//      (~/, /home, /Users, /root, /tmp, /private, /mnt, /media, /Volumes, …),
//      espaces compris, guillemets et ponctuation autour. Le chemin est
//      remplacé EN ENTIER, y compris sa partie finale : « Projet Prive/client.txt »
//      ne reste jamais visible.
//   2. SECRETS : sk-, pk-, ghp_, gho_, ghu_, ghs_, ghr_, xox, github_pat_, AIza,
//      Bearer, et les formes token=, api_key=, apikey=, password=, secret=
//      suivies d'une valeur, plus les identifiants de session et les empreintes.
//   3. INTACTS : les adresses http:// et https:// en entier, et les routes
//      /api/… du bureau. Ce ne sont pas des chemins : « https://exemple.test/a »
//      et « /api/todos » ressortent inchangés (contre-exemples obligatoires).
//
// Le masque s'applique AVANT toute troncature de sortie : réduire la longueur
// d'abord laisse fuiter un chemin ou un secret coupé au milieu (C-CD-04).
// Fonction idempotente : rappeler le masque sur du texte déjà masqué ne change
// rien (utile quand deux couches protègent le même texte).

// Les routes du bureau ne sont pas des chemins : api n'est pas une racine ci-dessous.
// Les adresses http(s) ne sont pas des chemins : la règle Windows exige une
// lettre de lecteur non précédée d'une lettre, ce qui exclut « s:/ » de « https:// ».
// Un segment peut contenir des espaces (« Projet Prive/ »), mais il ne peut pas
// se terminer par une espace avant le séparateur : sinon « note.txt et » serait
// avalé avec le chemin suivant.
const CHEMIN_WINDOWS = /(?<![A-Za-z0-9+.\-])(?:[A-Za-z]:[\\/]|\\\\)(?:[^\\/\n`"'<>),;:]*[^\s\\/'"<>),;:][\\/])*[^\s\\/`"'<>)]*/g;
const CHEMIN_UNIX = /(^|[\s`"'(<[=])(~[\\/][^\s`"'<>)]*|\/(?:home|Users|root|etc|usr|var|tmp|mnt|opt|proc|workspace|data|srv|app|work|code|projects|private|Volumes|media)(?:\/[^\s`"'<>)]*)?(?![\w.-]))/g;
const IDENTIFIANT_SESSION = /\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi;
const IDENTIFIANT_CLE = /\b(?:creator_user_id|creator_account_id|account_id|user_id|session_id)\s*[:=]\s*["']?[^\s,"'\[]+/gi;
const SECRETS = [
  [/\b(?:sk|pk|ghp|gho|ghu|ghs|ghr|xox[abprs])[-_][A-Za-z0-9_-]{16,}\b/g, '[secret masqué]'],
  [/\b(?:github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{30,})/g, '[secret masqué]'],
  [/\b(Bearer)\s+[A-Za-z0-9._~+/=-]{16,}/gi, '$1 [secret masqué]'],
  [/\b((?:api[_-]?key|token|secret|password|passwd)\s*[:=]\s*)["']?[^\s"',;\[]{6,}/gi, '$1[secret masqué]'],
];
const EMPREINTES = [[/@[0-9a-f]{8,}\b/gi, '[identifiant masqué]'], [/\b[0-9a-f]{32,}\b/gi, '[identifiant masqué]']];

export function masque(value) {
  let texte = typeof value === 'string' ? value : String(value ?? '');
  texte = texte.replace(IDENTIFIANT_CLE, '[identifiant masqué]').replace(IDENTIFIANT_SESSION, '[identifiant masqué]');
  for (const [motif, marqueur] of [...SECRETS, ...EMPREINTES]) texte = texte.replace(motif, marqueur);
  // Les adresses http(s) ne sont pas des chemins : la règle Windows exige une
  // lettre de lecteur non précédée d'une lettre, ce qui exclut « s:/ » de « https:// ».
  // Les chemins Unix passent d'abord : un chemin relatif ensuite suivi d'un
  // chemin Windows ne doit pas les fondre en un seul marqueur.
  texte = texte.replace(CHEMIN_UNIX, '$1[chemin masqué]');
  return texte.replace(CHEMIN_WINDOWS, '[chemin masqué]');
}
