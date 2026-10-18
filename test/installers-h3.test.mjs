import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAgent } from '../src/herdr.mjs';

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
foreach($nom in @(${['Texte',...names].map(literal).join(',')})) {
 $f=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $nom},$true)
 if(-not $f){throw "fonction absente : $nom"}
 . ([scriptblock]::Create($f.Extent.Text))
}
${body}`);
  return execute('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-File',script],options);
}
async function bash(t,names,body){
  const text=await readFile(join(root,'scripts/installer.sh'),'utf8');
  const functions=['texte',...names].map(name=>{const match=text.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`,'m'));assert.ok(match,`fonction ${name}`);return match[0];}).join('\n');
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

test('H3 : les 24 types Herdr ont un nom propre sans changer les noms personnalisés',()=>{
  const names={pi:'Pi',claude:'Claude',codex:'Codex',gemini:'Gemini',cursor:'Cursor',devin:'Devin',agy:'Antigravity',cline:'Cline',omp:'OMP',mastracode:'Mastra Code',opencode:'OpenCode',copilot:'Copilot',kimi:'Kimi',kiro:'Kiro',droid:'Droid',amp:'Amp',grok:'Grok',hermes:'Hermes',kilo:'Kilo',qodercli:'Qoder',qwen:'Qwen',letta:'Letta',maki:'Maki',muse:'Muse'};
  for(const [agent,name] of Object.entries(names)) {
    const raw={agent,name:agent,pane_id:'w9:p1',terminal_id:'factice'};
    assert.equal(normalizeAgent(raw).name,name);assert.equal(normalizeAgent(raw).kind,name);
    assert.equal(normalizeAgent({...raw,name:'Équipe personnelle'}).name,'Équipe personnelle');
  }
});

test('H3 PowerShell : applications seules, outil absent ignoré et Oui sans lancement',async t=>{
  const result=await ps(t,['Detecter-Outils','Proposer-Agents'],`
function Get-Command {param($Name,$CommandType,$ErrorAction)
 if($CommandType -ne 'Application'){throw 'detection non native'}
 if($Name -in @('codex','qwen')){return @{Source='factice.exe'}}
}
function Dire($texte) {};function Noter($texte) {};function Simuler($texte) {}
$script:reads=0;$script:starts=@();$DryRun=$false;$Oui=$true
function Read-Host($texte){$script:reads++;return '1'}
function Confirmer($question,[switch]$Individuel){if(-not $Individuel){throw 'accord non individuel'};return $true}
function Appeler-Herdr($Arguments){$script:starts+=,@($Arguments);return @{result=@{}}}
if((@(Detecter-Outils) -join ',') -ne 'codex,qwen'){throw 'detection incorrecte'}
Proposer-Agents @('w9:p1','w9:p2')
if($starts.Count -ne 0 -or $reads -ne 0){throw 'Oui a lance un agent'}
$Oui=$false
Proposer-Agents @('w9:p1')
if(($starts[0] -join ' ') -ne 'agent start Chef --kind codex --pane w9:p1'){throw 'mauvaise cible ou outil'}
if($chefOutil -ne 'codex' -or $chefPane -ne 'w9:p1'){throw 'chef non memorise'}
'ok'`);
  if(result)assert.equal(result.stdout.trim(),'ok');
});

test('H3 bash : exécutable absent refusé, confirmation par panneau, Oui sans lancement',async t=>{
  const result=await bash(t,['detecter_outils','proposer_agents'],`
set -e
dire(){ :; };noter(){ :; };simuler(){ :; }
command(){ if [ "$1" = '-v' ];then case "$2" in codex|qwen) printf '/factice/%s\n' "$2";return 0;;*)return 1;;esac;fi;builtin command "$@"; }
confirmer(){ [ "$2" = individuel ]; }
fake_herdr(){ STARTED="$*"; }
HERDR_TROUVE=fake_herdr;DRY_RUN=0;OUI=1
[ "$(detecter_outils | tr '\n' ',')" = 'codex,qwen,' ]
proposer_agents 'w9:p1'
[ -z "$STARTED" ]
OUI=0
proposer_agents 'w9:p1' <<< 1
[ "$CHEF_TYPE:$CHEF_PANE" = 'codex:w9:p1' ]
printf 'START:%s\n' "$STARTED"`);
  assert.match(result.stdout,/START:agent start Chef --kind codex --pane w9:p1/);
  assert.equal((result.stdout.match(/START:/g)||[]).length,1);
});

test('H3 raccourci combiné bash : port et chemins littéraux, serveur avant Herdr',async t=>{
  const result=await bash(t,['literal_shell','ecrire_lanceur'],`
set -e
work=$(mktemp -d);trap 'rm -rf "$work"' EXIT
RACINE="/tmp/dossier '\\$(commande)";HERDR_LANCEUR="/tmp/herdr avec espaces";PORT_CHOISI=4321
ecrire_lanceur "$work/bureau.command" ensemble
cd(){ printf 'ROOT:%s\\n' "$2"; }
command(){ printf 'fake_node\\n'; }
fake_node(){ printf 'NODE:%s:%s\\n' "$BUREAU_PORT" "$*"; }
exec(){ printf 'HERDR:%s\\n' "$1"; }
. "$work/bureau.command"`);
  assert.match(result.stdout,/ROOT:\/tmp\/dossier '\$\(commande\)/);
  assert.match(result.stdout,/NODE:4321:scripts\/ouvrir-bureau.mjs\nHERDR:\/tmp\/herdr avec espaces/);
});

test('H3 langues : simulation anglaise complète sans installation',async t=>{
  const bashBin=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/bash';
  const sh=await execute(bashBin,[join(root,'scripts/installer.sh'),'--lang','en','--dry-run','--sans-raccourci'],options);
  assert.match(sh.stdout,/Agent desktop: installation/);assert.match(sh.stdout,/Project tests/);assert.match(sh.stdout,/Summary/);
  assert.doesNotMatch(sh.stdout,/Installer |Dossier du projet|Tests :|Rien a signaler/);
  if(process.platform==='win32') {
    const win=await execute('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-File',join(root,'scripts/installer.ps1'),'-Lang','en','-DryRun','-SansRaccourci'],options);
    assert.match(win.stdout,/Agent desktop: installation/);assert.match(win.stdout,/Project tests/);assert.match(win.stdout,/Summary/);
    assert.doesNotMatch(win.stdout,/Installer |Dossier du projet|Tests :|Rien a signaler/);
  }
});

test('H3 confirmations : y en anglais, o en français, aucun accord sur EOF',async t=>{
  const sh=await bash(t,['confirmer'],`
DRY_RUN=0;OUI=1;dire(){ :; };simuler(){ :; }
LANGUE=en
confirmer installation individuel <<< y || exit 1
if confirmer installation individuel <<< o; then exit 2; fi
LANGUE=fr
confirmer installation individuel <<< o || exit 3
if confirmer installation individuel </dev/null; then exit 4; fi
printf 'ok'`);
  assert.match(sh.stdout,/ok$/);
  const win=await ps(t,['Confirmer'],`
$DryRun=$false;$Oui=$true;$Lang='en'
function Dire($texte) {};function Simuler($texte) {}
function Read-Host($question){return 'y'}
if(-not (Confirmer installation -Individuel)){throw 'y refusé'}
$Lang='fr';function Read-Host($question){return 'o'}
if(-not (Confirmer installation -Individuel)){throw 'o refusé'}
function Read-Host($question){return $null}
if(Confirmer installation -Individuel){throw 'EOF accepté'}
'ok'`);
  if(win)assert.equal(win.stdout.trim(),'ok');
});
