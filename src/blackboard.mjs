import {readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {masque} from './masque.mjs';

// Tableau mural de mémoire partagée : lecture seule des fichiers piliers du projet.
// Liste fermée de fichiers, jamais de chemin venant du navigateur ; rien n'est écrit.
const projectDirectory=fileURLToPath(new URL('../',import.meta.url));
const FILES=['HANDOFF.md','TODO.md','LESSONS.md','AGENTS.md'];
const MAX_BYTES=512*1024;

function clean(value) {
  // Masque public unique (chemins, secrets, identifiants) AVANT la troncature :
  // les routes /api/... et les adresses web restent lisibles.
  return Array.from(masque(String(value))
    .replace(/\*\*|__|`/g,'')
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()).slice(0,240).join('');
}

// Sections de second niveau (« ## Titre ») et leurs lignes, dans l'ordre du fichier.
function sections(text) {
  const out=[];let current=null;
  for(const line of text.split(/\r?\n/)) {
    const h=/^##\s+(.+)$/.exec(line);
    if(h){current={title:clean(h[1]),lines:[]};out.push(current);continue;}
    if(current) current.lines.push(line);
  }
  return out;
}
const bullets=lines=>lines.map(l=>/^\s*[-*]\s+(?!\[)(.+)$/.exec(l)?.[1]).filter(Boolean).map(clean).filter(Boolean);

export function parseBlackboard(texts) {
  const board={};
  if(typeof texts['HANDOFF.md']==='string') {
    // La dernière section datée du passage de relais est l'état le plus récent.
    const all=sections(texts['HANDOFF.md']).filter(s=>!/^(Contexte|Règle absolue)/i.test(s.title));
    const latest=all.filter(s=>!/^Préparation/i.test(s.title)).at(-1);
    if(latest) board.focus={source:'HANDOFF.md',title:latest.title,items:bullets(latest.lines).slice(0,6)};
  }
  if(typeof texts['TODO.md']==='string') {
    const boxes=[...texts['TODO.md'].matchAll(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/gm)].map(m=>({done:m[1]!==' ',text:clean(m[2])}));
    board.todo={source:'TODO.md',done:boxes.filter(b=>b.done).length,total:boxes.length,remaining:boxes.filter(b=>!b.done).map(b=>b.text).slice(0,8)};
  }
  if(typeof texts['AGENTS.md']==='string') {
    const roles=sections(texts['AGENTS.md']).find(s=>/^Rôles/i.test(s.title));
    if(roles) board.roles={source:'AGENTS.md',items:bullets(roles.lines).slice(0,6)};
  }
  if(typeof texts['LESSONS.md']==='string') {
    const lessons=bullets(texts['LESSONS.md'].split(/\r?\n/));
    board.lessons={source:'LESSONS.md',total:lessons.length,latest:lessons.slice(-5).reverse()};
  }
  return board;
}

export async function readBlackboard({root=projectDirectory}={}) {
  const texts={},files=[];
  for(const name of FILES) {
    try {
      // lstat : un lien symbolique nommé comme un pilier ne doit pas faire lire un autre fichier.
      const info=await lstat(join(root,name));
      if(info.isSymbolicLink()||!info.isFile()||info.size>MAX_BYTES) continue;
      texts[name]=await readFile(join(root,name),'utf8');
      files.push({name,modified:info.mtime.toISOString()});
    } catch {}
  }
  return {...parseBlackboard(texts),files};
}
