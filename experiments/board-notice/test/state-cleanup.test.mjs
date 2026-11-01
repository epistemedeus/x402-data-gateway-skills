import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const modulePath=fileURLToPath(new URL('../lib/state.mjs',import.meta.url));
for(const failure of ['metadata','barrier'])test('failed '+failure+' initialization releases its acquired flock',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'board-notice-lock-cleanup-'));
  const child=String.raw`
const fs=require('node:fs/promises'),cp=require('node:child_process');
const a=require('node:assert/strict'),{syncBuiltinESMExports}=require('node:module');
const{pathToFileURL}=require('node:url');
const[state,modulePath,failure]=process.argv.slice(1),nativeWrite=fs.writeFile,nativeSpawn=cp.spawn;
const helpers=[];let fail=true,entered=false;
cp.spawn=(...args)=>{const c=nativeSpawn(...args);if(args[0]==='/usr/bin/flock')helpers.push(c);return c;};
fs.writeFile=async(...args)=>{if(fail&&failure==='metadata'&&args[0]===state+'.lock')throw Object.assign(new Error('controlled metadata failure'),{code:'EIO'});return nativeWrite(...args);};
if(failure==='barrier'){process.env.H98310_LOCK_BARRIER=state+'.missing';process.env.H98310_LOCK_BARRIER_STEPS='held-before-body';}
else{delete process.env.H98310_LOCK_BARRIER;delete process.env.H98310_LOCK_BARRIER_STEPS;}
syncBuiltinESMExports();
const closed=c=>c.exitCode!==null||c.signalCode!==null;
const exit=c=>closed(c)?Promise.resolve():new Promise(ok=>c.once('close',ok));
(async()=>{
 try{
  const{withStateOwner}=await import(pathToFileURL(modulePath));
  let original;try{await withStateOwner(state,async()=>{entered=true;});}catch(e){original=e;}
  a.equal(original?.code,failure==='metadata'?'EIO':'ENOENT');a.equal(entered,false);
  a.equal(helpers.length,1);a.equal(closed(helpers[0]),true,'lock helper retained after initialization failure');
  const inode=(await fs.stat(state+'.lock')).ino;
  fail=false;delete process.env.H98310_LOCK_BARRIER;delete process.env.H98310_LOCK_BARRIER_STEPS;
  const recovered=await withStateOwner(state,async()=>{entered=true;return'useful';});
  a.equal(recovered.busy,false);a.equal(recovered.value,'useful');a.equal(entered,true);
  a.equal((await fs.stat(state+'.lock')).ino,inode);a(helpers.every(closed));
  process.stdout.write(JSON.stringify({failure,originalErrorPreserved:true,failedCallbackEntered:false,helperReleasedBeforeParentExit:true,reacquired:true,inodePreserved:true})+'\n');
 }finally{
  for(const c of helpers)if(!closed(c))c.stdin.end();
  await Promise.race([Promise.all(helpers.map(exit)),new Promise(ok=>setTimeout(ok,1000))]);
  for(const c of helpers)if(!closed(c))c.kill('SIGKILL');
  await Promise.all(helpers.map(exit));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
`;
  try{
    const r=spawnSync(process.execPath,['-e',child,path.join(root,'state.json'),modulePath,failure],{encoding:'utf8',timeout:7000,maxBuffer:65536});
    assert.equal(r.status,0,r.stdout+r.stderr);const result=JSON.parse(r.stdout);
    assert.equal(result.helperReleasedBeforeParentExit,true);assert.equal(result.reacquired,true);
  }finally{await rm(root,{recursive:true,force:true});}
});
