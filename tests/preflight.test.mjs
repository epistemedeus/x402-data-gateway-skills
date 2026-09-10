import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {runPreflight} from '../consumers/heavy-extract-preflight.mjs';

test('actual disposable HTTP challenge is script evidence, not a model, payment or verified intent',async()=>{
 const calls=[];const server=createServer((req,res)=>{calls.push({method:req.method,path:req.url,headers:req.headers});res.writeHead(402,{'content-type':'application/json','payment-required':'synthetic-not-validated'});res.end('{"error":"payment_required"}');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const out=await runPreflight({fetchImpl:(url,opts)=>fetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}${new URL(url).search}`,opts)});
  assert.equal(calls.length,1);assert.equal(calls[0].method,'GET');assert.equal(calls[0].headers.authorization,undefined);assert.equal(calls[0].headers['payment-signature'],undefined);
  assert.equal(out.nativeModelRun,false);assert.equal(out.evidenceKind,'deterministic_script');assert.equal(out.challengeVerified,false);assert.equal(out.purchaseIntent,null);assert.equal(out.paymentAttempted,false);assert.equal(out.directPreview,null);assert.equal(out.sourceExecution,'no_paid_output_observed');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('unexpected 200/403/redirect never claims a stopped 402 execution',async()=>{
 for(const status of [200,403,302]){
  let calls=0;const out=await runPreflight({fetchImpl:async(_url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response('<body>unexpected</body>',{status});}});
  assert.equal(calls,1);assert.equal(out.outcome,'unexpected_response_stop');assert.equal(out.sourceExecution,'not_inferred');assert.equal(out.paymentAttempted,false);
 }
});
test('body cap stops a response and never retries; direct refusal has no brief title',async()=>{
 let calls=0;const out=await runPreflight({fetchImpl:async()=>{calls++;return new Response('x'.repeat(262145));}});
 assert.equal(out.outcome,'transport_unknown');assert.equal(calls,1);
 let n=0;const withDirect=await runPreflight({directPreview:true,fetchImpl:async()=>++n===1?new Response('{}',{status:402}):new Response('<title>Blocked</title>',{status:403,headers:{'content-type':'text/html'}})});
 assert.equal(n,2);assert.equal(withDirect.directPreview.sourceOk,false);assert.equal(withDirect.directPreview.title,null);
});
test('caller or environment cannot point this demonstration at private targets or custom merchant',async()=>{
 for(const opts of [{origin:'http://127.0.0.1'},{target:'https://private.invalid/'},{target:'file:///etc/passwd'}]){
  let calls=0;await assert.rejects(runPreflight({...opts,fetchImpl:()=>{calls++;}}));assert.equal(calls,0);
 }
});
