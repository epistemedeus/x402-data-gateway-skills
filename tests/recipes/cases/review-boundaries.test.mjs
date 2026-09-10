import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyMerchantSource} from '../lib/merchant.mjs';
import {merchantRoot} from '../lib/paths.mjs';
test('source pin is checked by bytes without requiring a Git checkout',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'s93-source-'));
 try {
  const manifest=JSON.parse(fs.readFileSync(new URL('../merchant-source.json',import.meta.url)));
  for(const file of Object.keys(manifest.gitBlobs)) {const dest=path.join(dir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(merchantRoot(),file),dest);}
  assert.doesNotThrow(()=>verifyMerchantSource(dir));
  fs.appendFileSync(path.join(dir,'scan.mjs'),'\n// mutated\n');
  assert.throws(()=>verifyMerchantSource(dir),/source differs/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('offline guard fails the process even if a merchant catches fetch failure',()=>{
 const guard=new URL('../lib/offline-only.mjs',import.meta.url).pathname;
 const result=spawnSync(process.execPath,['--import',guard,'--input-type=module','-e',"try { await fetch('https://fixture.invalid'); } catch {}"],{encoding:'utf8',timeout:3000});
 assert.equal(result.status,1);assert.match(result.stderr,/non-fixture network/);
});
