import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openBureau } from '../scripts/ouvrir-bureau.mjs';

async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'lanceur-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  return root;
}
test('raccourci : port configuré déjà occupé, aucun second serveur',async t=>{
  const calls=[];
  await openBureau({root:await fixture(t),port:4321,probe:async()=>true,start:()=>assert.fail('second serveur'),browse:url=>calls.push(url)});
  assert.deepEqual(calls,['http://127.0.0.1:4321']);
});
test('raccourci : deux ouvertures simultanées ne lancent qu’un serveur',async t=>{
  const root=await fixture(t);let running=false,starts=0,browsers=0;
  const options={root,port:4322,probe:async()=>running,start:async()=>{starts++;await new Promise(r=>setTimeout(r,30));running=true;},browse:()=>browsers++};
  await Promise.all([openBureau(options),openBureau(options)]);
  assert.equal(starts,1);assert.equal(browsers,2);
});
test('raccourci : port invalide refusé avant toute action',async t=>{
  for(const port of [0,65536,'4317; commande'])await assert.rejects(openBureau({root:await fixture(t),port,start:()=>assert.fail()}),/Port/);
});
