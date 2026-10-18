import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute=promisify(execFile);
const literal=value=>`'${value.replaceAll("'","''")}'`;
for(const withHerdr of [false,true])test(`L C-CD-14 : premier exécutable sélectionné, Herdr ${withHerdr?'activé':'désactivé'}`,{skip:process.platform!=='win32'},async t=>{
  const dir=await mkdtemp(join(tmpdir(),'launcher-ps-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const first=join(dir,'herdr.exe'),second=join(dir,'autre-herdr.exe');
  await writeFile(first,'factice, ne pas exécuter');
  await writeFile(second,'factice, ne pas exécuter');
  // Seules les lectures de configuration personnelle sont neutralisées dans cette copie.
  const source=(await readFile(new URL('../Ouvrir le bureau.ps1',import.meta.url),'utf8'))
    .replace(/\[Environment\]::GetEnvironmentVariable\('[A-Z_]+', 'User'\)/g,'$null');
  const launcher=join(dir,'ouvrir.ps1'),harness=join(dir,'essai.ps1');
  await writeFile(launcher,source);
  await writeFile(harness,`\ufeff$ErrorActionPreference='Stop'
    $env:BUREAU_PORT='4317';$env:BUREAU_HERDR_PATH=''
    $launcherCalls=@{node=0;herdr=0}
    function Get-Command {param($Name,$CommandType,$ErrorAction)
      if($CommandType -ne 'Application'){throw 'application requise'}
      if($Name -eq 'node'){return @(@{Source='FakeNode'},@{Source='WrongNode'})}
      if($Name -eq 'herdr'){return @(@{Source=${literal(first)}},@{Source=${literal(second)}})}
      throw 'commande inattendue'
    }
    function FakeNode {
      if($args.Count -ne 1 -or $args[0] -ne (Join-Path ${literal(dir)} 'scripts/ouvrir-bureau.mjs')){throw 'arguments inattendus'}
      $launcherCalls.node++;$global:LASTEXITCODE=0
    }
    function WrongNode {throw 'second exécutable appelé'}
    function Start-Process {param($FilePath,$WorkingDirectory,$WindowStyle)
      if($FilePath -ne ${literal(first)}){throw 'mauvais exécutable Herdr'}
      $launcherCalls.herdr++
    }
    & ${literal(launcher)} ${withHerdr?'-AvecHerdr':''}
    if($launcherCalls.node -ne 1 -or $launcherCalls.herdr -ne ${withHerdr?1:0}){throw 'nombre incorrect'}
    [Console]::WriteLine('Sélection correcte, aucun processus lancé.')
  `);
  const result=await execute('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-File',harness],{windowsHide:true,timeout:120000});
  assert.match(result.stdout,/aucun processus/);
  assert.equal(result.stderr,'');
});
