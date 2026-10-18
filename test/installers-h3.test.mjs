import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute=promisify(execFile);
const root=fileURLToPath(new URL('..',import.meta.url));
const options={windowsHide:true,timeout:120000};
const literal=value=>`'${value.replaceAll("'","''")}'`;
async function temporary(t){const path=await mkdtemp(join(tmpdir(),'installer-h3-'));t.after(()=>rm(path,{recursive:true,force:true}));return path;}
async function ps(t,names,body){
  if(process.platform!=='win32')return t.skip('PowerShell Windows absent');
  const path=await temporary(t),script=join(path,'test.ps1');
  await writeFile(script,`$ErrorActionPreference='Stop'
$ast=[System.Management.Automation.Language.Parser]::ParseFile(${literal(join(root,'scripts/installer.ps1'))},[ref]$null,[ref]$null)
foreach($nom in @(${names.map(literal).join(',')})) {
 $f=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $nom},$true)
 if(-not $f){throw "fonction absente : $nom"}
 . ([scriptblock]::Create($f.Extent.Text))
}
${body}`);
  return execute('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-File',script],options);
}
async function bash(t,names,body){
  const text=await readFile(join(root,'scripts/installer.sh'),'utf8');
  const functions=names.map(name=>{const match=text.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`,'m'));assert.ok(match,`fonction ${name}`);return match[0];}).join('\n');
  const path=await temporary(t),script=join(path,'test.sh');
  await writeFile(script,functions+'\n'+body);
  return execute(process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/bash',['--noprofile','--norc',script.replaceAll('\\','/')],options);
}

test('H3 grille PowerShell : découpes des deux colonnes et aucun autre espace touché',async t=>{
  const result=await ps(t,['Appeler-Herdr','Lire-Panneaux','Creer-GrilleHerdr'],`
$script:panes=@('w9:p1');$script:calls=@()
function FauxHerdr {
 $script:calls+=,@($args);$global:LASTEXITCODE=0
 if($args[0] -eq 'workspace'){return '{"result":{"workspace_id":"w9"}}'}
 if($args[1] -eq 'list') {
  if(($args -join ' ') -ne 'pane list --workspace w9'){throw 'liste non bornée au nouvel espace'}
  return @{result=@{panes=@($script:panes|ForEach-Object {@{pane_id=$_}})}}|ConvertTo-Json -Depth 5 -Compress
 }
 if($args[1] -eq 'split'){$script:panes+=('w9:p'+($script:panes.Count+1))}
 return '{"result":{}}'
}
$herdrTrouve='FauxHerdr'
$ids=@(Creer-GrilleHerdr)
if(($ids -join ',') -ne 'w9:p1,w9:p2,w9:p3,w9:p4'){throw 'ordre des postes incorrect'}
$splits=@($calls|Where-Object {$_[1] -eq 'split'})
if(($splits|ForEach-Object {$_ -join ' '}) -join ';' -ne 'pane split --pane w9:p1 --direction right --no-focus;pane split --pane w9:p1 --direction down --no-focus;pane split --pane w9:p2 --direction down --no-focus'){throw 'grille incorrecte'}
'ok'`);
  if(result)assert.equal(result.stdout.trim(),'ok');
});

test('H3 grille bash : deux colonnes découpées par identifiant précis',async t=>{
  const result=await bash(t,['lire_panneaux','creer_grille_herdr'],`
set -e
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
printf 'w9:p1\n' > "$work/panes"
fake_herdr() {
 printf '%s\n' "$*" >> "$work/calls"
 case "$1 $2" in
  'workspace create') printf '{"result":{"workspace_id":"w9"}}\n' ;;
  'pane list')
   [ "$*" = 'pane list --workspace w9' ] || return 1
   printf '{"result":{"panes":['
   sep='';while read -r id;do printf '%s{"pane_id":"%s"}' "$sep" "$id";sep=',';done < "$work/panes"
   printf ']}}\n' ;;
  'pane split') n=$(wc -l < "$work/panes");printf 'w9:p%s\n' "$((n+1))" >> "$work/panes";printf '{"result":{}}\n' ;;
  *) printf '{"result":{}}\n' ;;
 esac
}
HERDR_TROUVE=fake_herdr
ids=$(creer_grille_herdr)
[ "$(printf '%s' "$ids"|tr '\n' ',')" = 'w9:p1,w9:p2,w9:p3,w9:p4' ]
grep 'pane split' "$work/calls"`);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/),[
    'pane split --pane w9:p1 --direction right --no-focus',
    'pane split --pane w9:p1 --direction down --no-focus',
    'pane split --pane w9:p2 --direction down --no-focus',
  ]);
});
