import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/bash';
const literal=value=>`'${value.replaceAll("'","''")}'`;
const shellLiteral=value=>`'${String(value).replaceAll("'","'\\''")}'`;
async function fixture(t) {
  const path=await mkdtemp(join(tmpdir(),'installer-interface-'));t.after(()=>rm(path,{recursive:true,force:true}));
  await mkdir(join(path,'scripts'));
  for(const file of ['installer.sh','installer.ps1'])await copyFile(join(root,'scripts',file),join(path,'scripts',file));
  await writeFile(join(path,'scripts/init-kit.mjs'),'throw new Error("ne pas exécuter");');
  await writeFile(join(path,'Ouvrir le bureau.cmd'),'ne pas exécuter');
  await writeFile(join(path,'herdr.exe'),'ne pas exécuter');
  await writeFile(join(path,'herdr'),'#!/bin/bash\nexit 77\n');await chmod(join(path,'herdr'),0o755);
  return path;
}
function dialogue(t,file,args,{answer=()=> 'n',eof=false,env={}}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(file,args,{windowsHide:true,env:{...process.env,BASH_ENV:'',...env},stdio:['pipe','pipe','pipe']});
    const timer=setTimeout(()=>{child.kill();reject(new Error('Dialogue bloqué'));},120000);
    t.after(()=>{clearTimeout(timer);if(child.exitCode===null)child.kill();});
    let output='',errors='',partial='';const records=[];
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',chunk=>{
      output+=chunk;partial+=chunk;
      let newline;
      while((newline=partial.indexOf('\n'))!==-1) {
        const line=partial.slice(0,newline).replace(/\r$/,'');partial=partial.slice(newline+1);
        if(!line.startsWith('@@'))continue;
        records.push(line);
        if(!eof&&/^@@(?:CONFIRM|CHOICE|INPUT) /.test(line))child.stdin.write(answer(line)+'\n');
      }
    });
    child.stderr.on('data',part=>errors+=part);child.stdin.on('error',()=>{});
    child.on('error',reject);child.on('close',code=>{clearTimeout(timer);resolve({code,output,errors,records});});
    if(eof)child.stdin.end();
  });
}
async function run(t,platform,options={}) {
  const path=await fixture(t),script=join(path,'scripts',platform==='ps'?'run.ps1':'run.sh');
  if(platform==='ps') {
    await writeFile(script,`\ufeff$ErrorActionPreference='Stop'
    function Get-Command {param($Name,$CommandType,$ErrorAction)
      if($Name -eq 'winget'){return @{Source='FakeWinget'}}
      if($Name -eq 'herdr'){return @{Source=${literal(join(path,'herdr.exe'))}}}
      if($Name -eq 'code'){return @{Source='FakeCode'}}
      if($Name -eq 'node' -and ${options.present?'$true':'$false'}){return @{Source='FakeNode'}}
      if($Name -in @('claude','codex','opencode','gemini') -and ${options.present?'$true':'$false'}){return @{Source='FakeTool'}}
    }
    function node {return 'v24.22.0'}
    function FakeWinget {throw 'winget exécuté pendant la simulation'}
    & ${literal(join(path,'scripts/installer.ps1'))} -DryRun -Lang ${options.lang??'fr'} -Port 4317 ${options.classic?'':'-Interface'} ${options.yes?'-Oui':''} -HerdrChemin ${literal(join(path,options.badHerdr?'scripts/installer.ps1':'herdr.exe'))}
    exit $LASTEXITCODE`);
    return {...await dialogue(t,ps,['-NoProfile','-File',script],options),path};
  }
  await writeFile(script,`command() {
    if [ "$1" = -v ];then case "$2" in herdr) printf '%s\\n' '${path.replaceAll('\\','/')}/herdr';return 0;;code) printf 'fake_code\\n';return 0;;node|claude|codex|opencode|gemini) [ '${options.present?'1':'0'}' = 1 ];return $?;;*)return 1;;esac;fi
    builtin command "$@"
  }
  node(){ printf 'v24.22.0\\n'; }
  . '${join(path,'scripts/installer.sh').replaceAll('\\','/')}' --dry-run --lang ${options.lang??'fr'} --port ${shellLiteral(options.port??'4317')} ${options.classic?'':'--interface'} ${options.yes?'--oui':''} --herdr-chemin '${path.replaceAll('\\','/')}/herdr'
  `);
  return {...await dialogue(t,bash,['--noprofile','--norc',script.replaceAll('\\','/')],options),path};
}
function checkProtocol(result,windows) {
  assert.equal(result.code,0,result.errors);
  const expected=windows?['node','clink','herdr','panneaux','outils','chef','extensions','config','kit','tests']:['node','herdr','panneaux','outils','chef','extensions','config','kit','tests'];
  assert.deepEqual(result.records.filter(x=>x.startsWith('@@PLAN ')).map(x=>x.slice(7).split('\t')[0]),expected);
  assert.deepEqual(result.records.filter(x=>x.startsWith('@@STEP ')).map(x=>x.slice(7)),expected);
  assert.deepEqual(result.records.filter(x=>x.startsWith('@@DONE ')).map(x=>x.slice(7).split('\t')[0]),expected);
  assert.equal(result.records.at(-1),'@@END ok');
  assert.ok(result.records.filter(x=>x.startsWith('@@DONE ')).every(x=>/^@@DONE [a-z]+\t(?:ok|skip|fail)\t/.test(x)));
  assert.ok(!result.records.join('\n').includes(result.path));
  const ids=result.records.filter(x=>/^@@(?:CONFIRM|CHOICE|INPUT) /.test(x)).map(x=>x.split(' ')[1].split('\t')[0]);
  assert.equal(new Set(ids).size,ids.length,'identifiants de questions uniques');
}
for(const platform of ['bash',...(process.platform==='win32'?['ps']:[])]) {
  test(`J1 ${platform} : dialogue complet, oui/non, choix et saisie sans installation`,async t=>{
    const result=await run(t,platform,{answer:line=>{
      if(line.startsWith('@@CHOICE'))return '2';
      if(line.startsWith('@@INPUT'))return 'dossier $(commande) avec espaces';
      return /extensions|kit|Node.js|Clink/i.test(line)?'o':'n';
    }});
    checkProtocol(result,platform==='ps');
    assert.ok(result.records.some(x=>x.startsWith('@@CONFIRM ')));
    assert.ok(result.records.some(x=>x.startsWith('@@CHOICE ')));
    assert.ok(result.records.some(x=>x.startsWith('@@INPUT ')));
    assert.doesNotMatch(result.errors,/exécuté|commande:|command not found/);
  });
  test(`J1 ${platform} : EOF refuse et Oui ne valide pas les installations`,async t=>{
    const result=await run(t,platform,{yes:true,eof:true,lang:'en'});
    checkProtocol(result,platform==='ps');
    assert.ok(result.records.some(x=>x.startsWith('@@CONFIRM '))); // les choix facultatifs restent explicites
    assert.ok(result.records.some(x=>x.startsWith('@@PLAN tests\tChecks')));
    assert.deepEqual(result.records.filter(x=>/^@@DONE [a-z]+\tok\t/.test(x)).map(x=>x.split(' ')[1].split('\t')[0]),['herdr'],'seul le prérequis réellement présent est satisfait');
  });
  test(`J1 ${platform} : sans drapeau, aucune ligne du protocole`,async t=>{
    const result=await run(t,platform,{classic:true,eof:true});
    assert.equal(result.code,0,result.errors);assert.deepEqual(result.records,[]);
    assert.match(result.output,/Bureau des agents : installation/);
  });
}
if (process.platform !== 'win32') test('installation Bash réelle : zéro IA et choix 0 terminent sans boucle', async t => {
  const path = await fixture(t);
  const home = join(path, 'home'); await mkdir(home);
  const script = join(path, 'run-live.sh');
  await writeFile(script, `command() {
    if [ "$1" = -v ]; then case "$2" in claude|codex|opencode|pi|gemini|agy|antigravity-cli) return 1;; esac; fi
    builtin command "$@"
  }
  . ${shellLiteral(join(path, 'scripts/installer.sh'))} --interface --lang fr --port 4317 --herdr-chemin ${shellLiteral(join(path, 'herdr'))}
  `);
  const result = await dialogue(t, bash, ['--noprofile','--norc',script], {
    env: { HOME: home }, answer: line => line.startsWith('@@INPUT ') ? '0' : 'n',
  });
  assert.equal(result.code, 0, result.errors);
  assert.equal(result.records.filter(x => /Numéros des outils à installer/.test(x)).length, 1);
  assert.match(result.output, /Aucune IA choisie/);
  assert.equal(result.records.at(-1), '@@END ok');
});
if(process.platform==='win32')test('J1 PowerShell : erreur fatale annonce DONE fail et END fail',async t=>{
  const result=await run(t,'ps',{badHerdr:true,eof:true});
  assert.equal(result.code,1);
  assert.equal(result.records.at(-1),'@@END fail');
  assert.ok(result.records.some(x=>x.startsWith('@@DONE herdr\tfail\t')));
});

async function functions(t,platform,names,body,options={}) {
  const path=await fixture(t),script=join(path,'isolated.'+(platform==='ps'?'ps1':'sh'));
  if(platform==='ps') {
    await writeFile(script,`\ufeff$ErrorActionPreference='Stop'
    [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
    $ast=[System.Management.Automation.Language.Parser]::ParseFile(${literal(join(root,'scripts/installer.ps1'))},[ref]$null,[ref]$null)
    foreach($name in @(${names.map(literal).join(',')})) {
      $f=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
      if(-not $f){throw "fonction absente : $name"}
      . ([scriptblock]::Create($f.Extent.Text))
    }
    ${body}`);
    return dialogue(t,ps,['-NoProfile','-File',script],options);
  }
  const source=await readFile(join(root,'scripts/installer.sh'),'utf8');
  const definitions=names.map(name=>{
    const found=source.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`,'m'));
    assert.ok(found,name);return found[0];
  }).join('\n');
  await writeFile(script,definitions+'\n'+body);
  return dialogue(t,bash,['--noprofile','--norc',script.replaceAll('\\','/')],options);
}
const psFunctions=['Texte','Champ-Interface','Emettre-Interface','Etat-Etape','Fin-Etape','Etape','Terminer-Interface','Lire-Interface','Confirmer','Dire','Simuler','Noter','Executer','Rafraichir-Path','Proposer-Clink'];
test('L C-CD-16 bash : port invalide refusé clairement avant toute étape',async t=>{
  for(const [port,lang] of [['999999999999999999999999999999','fr'],['65536','en'],['1023','fr'],['','fr'],['4317; commande','en']]) {
    const data=await run(t,'bash',{port,lang,eof:true});
    assert.equal(data.code,1,port);
    assert.match(data.output+data.errors,/Port invalide|Invalid port/);
    assert.doesNotMatch(data.output+data.errors,/integer expected|@@STEP |@@END ok/);
  }
});
test('L C-CD-16 bash : bornes du port et saisies excessives sans erreur arithmétique',async t=>{
  const body=`for value in 1024 65535 4317 01024 1023 65536 00000 999999999999999999999999999999 '';do
    if port_valide "$value";then printf 'oui\\n';else printf 'non\\n';fi
  done`;
  const data=await functions(t,'bash',['port_valide'],body,{eof:true});
  assert.equal(data.code,0,data.errors);
  assert.deepEqual(data.output.trim().split(/\r?\n/),['oui','oui','oui','oui','non','non','non','non','non']);
  assert.equal(data.errors,'');
});
for(const platform of ['bash',...(process.platform==='win32'?['ps']:[])])test(`L C-CD-12 ${platform} : adresses Web intactes et chemins Windows masqués`,async t=>{
  const urls=['https://antigravity.google/download','http://127.0.0.1:4317/api/state'];
  const samples=[...urls,'Lire C:/Users/Personne/Projet Prive/client.txt'];
  const body=platform==='ps'?
    `$Interface=$true;$racine='dossier-factice';${samples.map(s=>`[Console]::WriteLine((Champ-Interface ${literal(s)}))`).join('\n')}`:
    `INTERFACE=1;RACINE='dossier-factice'\n${samples.map(s=>`champ_interface '${s}';printf '\\n'`).join('\n')}`;
  const data=await functions(t,platform,platform==='ps'?['Champ-Interface']:['champ_interface'],body,{eof:true});
  assert.equal(data.code,0,data.errors);
  const lines=data.output.trim().split(/\r?\n/);
  assert.deepEqual(lines.slice(0,2),urls);
  assert.match(lines[2],/\[dossier\]/);
  assert.doesNotMatch(lines[2],/Personne|Prive|client\.txt/);
});
if(process.platform==='win32') {
  for(const result of ['ok','fail','absent','present','refus'])test(`J1 Clink : ${result}, prérequis automatique avec Oui`,async t=>{
    const data=await functions(t,'ps',psFunctions,`
    $Interface=$true;$DryRun=$false;$Oui=$true;$Lang='fr';$script:questionNumero=0;$script:echecInterface=$false;$script:interfaceFinie=$false
    function Get-Command {param($Name,$CommandType,$ErrorAction)
      if($CommandType -ne 'Application'){throw 'application requise'}
      if($Name -eq 'clink' -and '${result}' -eq 'present'){return @{Source='FakeClink'}}
      if($Name -eq 'winget' -and '${result}' -ne 'absent'){return @(@{Source='FakeWinget'},@{Source='WrongWinget'})}
    }
    function FakeWinget { [Console]::WriteLine('CALL:'+($args -join '|'));$global:LASTEXITCODE=$(if('${result}' -eq 'fail'){8}else{0}) }
    function WrongWinget {throw 'deuxième exécutable interdit'}
    Etape clink;Proposer-Clink;Terminer-Interface
    if($script:echecInterface){exit 1}
    `,{answer:()=>result==='refus'?'n':'o'});
    assert.equal(data.code,result==='fail'?1:0,data.errors);
    assert.equal(data.records.at(-1),'@@END '+(result==='fail'?'fail':'ok'));
    if(['ok','fail','refus'].includes(result))assert.match(data.output,/CALL:install\|--id\|chrisant996.Clink\|-e\|--accept-source-agreements\|--accept-package-agreements/);
    else assert.doesNotMatch(data.output,/CALL:/);
    const expected=result==='present'?'ok':result==='refus'?'ok':['ok','fail'].includes(result)?result:'skip';
    assert.ok(data.records.some(x=>x.startsWith('@@DONE clink\t'+expected+'\t')));
    if(result==='present')assert.ok(data.records.includes('@@DONE clink\tok\tDéjà présent.'));
    if(result==='refus')assert.ok(!data.records.some(x=>x.startsWith('@@CONFIRM '))); 
  });
}
for(const platform of ['bash',...(process.platform==='win32'?['ps']:[])])test(`J1 ${platform} : champs sûrs et échec réel conservé jusqu’à END`,async t=>{
  const body=platform==='ps'?`
    $Interface=$true;$Lang='fr';$DryRun=$false;$script:interfaceFinie=$false;$script:echecInterface=$false
    Etape tests
    Dire ("texte"+[char]10+"@@END ok"+[char]9+" /home/exemple/projet")
    Dire ('jeton sk-' + ('x'*24))
    try {Executer 'Commande factice' { $global:LASTEXITCODE=8 }} catch {}
    Terminer-Interface
    if($script:echecInterface){exit 1}
    `:`
    INTERFACE=1;LANGUE=fr;DRY_RUN=0;ETAPE='';ETAT_ETAPE=skip;ECHEC_INTERFACE=0
    etape tests
    dire $'texte\\n@@END ok\\t /home/exemple/projet'
    token_suffix=xxxxxxxxxxxxxxxxxxxxxxxx;dire "jeton sk-$token_suffix"
    fake_failure(){ return 8; }
    (executer 'Commande factice' fake_failure) || etat_etape fail
    terminer_interface 0
    [ "$ECHEC_INTERFACE" != 1 ]
    `;
  const names=platform==='ps'?psFunctions:['texte','champ_interface','emettre_interface','etat_etape','fin_etape','etape','terminer_interface','dire','simuler','executer'];
  const data=await functions(t,platform,names,body,{eof:true});
  assert.equal(data.code,1,data.errors);
  assert.equal(data.records.filter(x=>x.startsWith('@@END ')).length,1);
  assert.equal(data.records.at(-1),'@@END fail');
  assert.ok(data.records.some(x=>x.startsWith('@@DONE tests\tfail\t')));
  assert.doesNotMatch(data.records.join('\n'),/\/home\/exemple|sk-x{24}/);
});

for(const platform of ['bash',...(process.platform==='win32'?['ps']:[])])test(`J1 retouche ${platform} : prérequis présents réussis et résumés factuels dans les deux langues`,async t=>{
  for(const lang of ['fr','en']) {
    const result=await run(t,platform,{present:true,eof:true,lang});
    checkProtocol(result,platform==='ps');
    assert.ok(result.records.includes('@@DONE node\tok\tVersion 24.'));
    assert.ok(result.records.includes('@@DONE herdr\tok\t'+(lang==='fr'?'Déjà présent.':'Already available.')));
    assert.ok(result.records.includes('@@DONE outils\tok\t'+(lang==='fr'?'Outils disponibles : 4.':'Available tools: 4.')));
    assert.ok(result.records.includes('@@PLAN node\t'+(lang==='fr'?'Node.js 22 ou plus':'Node.js 22 or later')));
    assert.ok(result.records.includes('@@PLAN panneaux\t'+(lang==='fr'?'Espace Herdr en grille 2×2':'Herdr workspace in a 2×2 grid')));
    assert.ok(result.records.includes('@@PLAN config\t'+(lang==='fr'?'Configuration et raccourci':'Configuration and shortcut')));
    assert.ok(result.records.filter(x=>x.startsWith('@@DONE ')).every(x=>!x.includes('Étape terminée')&&!x.includes('Step finished')));
  }
});

for(const platform of ['bash',...(process.platform==='win32'?['ps']:[])])test(`J1 ${platform} : choix d’un outil et confirmation avant l’appel au faux Herdr`,async t=>{
  const body=platform==='ps'?`
    $Interface=$true;$Lang='fr';$Oui=$false;$DryRun=$false;$script:questionNumero=0;$script:interfaceFinie=$false;$script:echecInterface=$false;$script:rapport=@()
    function Get-Command {param($Name,$CommandType,$ErrorAction)
      if($CommandType -ne 'Application'){throw 'application requise'}
      if($Name -eq 'codex'){return @{Source='factice.exe'}}
    }
    function FakeHerdr { [Console]::WriteLine('CALL:'+($args -join '|'));$global:LASTEXITCODE=0;return '{"result":{}}' }
    $herdrTrouve='FakeHerdr'
    Etape panneaux;Proposer-Agents @('w9:p1','w9:p2');Terminer-Interface
    `:`
    INTERFACE=1;LANGUE=fr;OUI=0;DRY_RUN=0;QUESTION_NUMERO=0;ETAPE='';ETAT_ETAPE=skip;ECHEC_INTERFACE=0
    command(){ if [ "$1" = -v ];then [ "$2" = codex ];return $?;fi;builtin command "$@"; }
    fake_herdr(){ CALLED="$CALLED$*|";printf '{"result":{}}'; }
    HERDR_TROUVE=fake_herdr
    etape panneaux;proposer_agents 'w9:p1
w9:p2';printf 'CALL:%s\\n' "$CALLED";terminer_interface 0
    `;
  const names=platform==='ps'?[...psFunctions,'Choisir','Detecter-Outils','Proposer-Agents','Appeler-Herdr','Noter']:['texte','champ_interface','emettre_interface','etat_etape','fin_etape','etape','terminer_interface','lire_interface','choisir','dire','simuler','noter','confirmer','detecter_outils','proposer_agents'];
  const data=await functions(t,platform,names,body,{answer:line=>line.startsWith('@@CHOICE')?'2':'o'});
  assert.equal(data.code,0,data.errors);
  assert.match(data.output,platform==='ps'?/CALL:agent\|start\|chef\|--kind\|codex\|--pane\|w9:p1/:/CALL:agent start chef --kind codex --pane w9:p1/);
  assert.ok(data.records.some(x=>x.startsWith('@@CHOICE ')));
  assert.ok(data.records.some(x=>x.startsWith('@@CONFIRM ')));
  assert.ok(data.records.some(x=>x.startsWith('@@DONE panneaux\tok\t')));
  assert.ok(data.records.includes('@@DONE panneaux\tok\tOutils lancés : 2.'));
});

for(const platform of ['bash',...(process.platform==='win32'?['ps']:[])])test(`J1 ${platform} : entrée fermée, aucune configuration écrite ensuite`,async t=>{
  const body=platform==='ps'?`
    $Interface=$true;$DryRun=$false;$Oui=$true;$Lang='fr';$script:questionNumero=0;$script:interfaceFinie=$false;$script:echecInterface=$false
    $script:calls=0
    Etape config
    if(Confirmer 'Question' -Individuel){throw 'EOF accepté'}
    Executer 'Configuration' {$script:calls++} | Out-Null
    if($script:calls -ne 0){throw 'écriture après EOF'}
    Terminer-Interface
    `:`
    INTERFACE=1;LANGUE=fr;DRY_RUN=0;OUI=1;QUESTION_NUMERO=0;ETAPE='';ETAT_ETAPE=skip;ECHEC_INTERFACE=0
    work=$(mktemp -d);trap 'rm -rf "$work"' EXIT
    FICHIERS_PROFIL=("$work/profile");PORT_CHOISI=4317;HERDR_A_ENREGISTRER=''
    printf 'conserver' > "$work/profile"
    etape config
    if confirmer Question individuel;then exit 1;fi
    ecrire_profil
    [ "$(cat "$work/profile")" = conserver ] || exit 2
    terminer_interface 0
    `;
  const names=platform==='ps'?psFunctions:['texte','champ_interface','emettre_interface','etat_etape','fin_etape','etape','terminer_interface','lire_interface','dire','simuler','confirmer','literal_shell','ecrire_profil'];
  const data=await functions(t,platform,names,body,{eof:true});
  assert.equal(data.code,0,data.errors);
  assert.ok(data.records.some(x=>x.startsWith('@@DONE config\tskip\t')));
});
