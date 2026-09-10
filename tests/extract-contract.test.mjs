import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {interpretSingle,interpretBatch} from '../consumers/extract-record.mjs';
import {replayMerchant,MERCHANT_PIN} from './merchant-replay.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../fixtures/extract-contract/${name}.json`,import.meta.url)));
const record=name=>read(name).envelope;

test('captured source refusals cannot become useful output through merchant ok',()=>{
 for(const status of [403,404,429,500]){
  const r=record('http-'+status);assert.equal(r.ok,true);assert.equal(r.sourceOk,false);
  const out=interpretSingle(r);assert.equal(out.status,status);assert.equal(out.sourceAccepted,false);assert.equal(out.usableCandidate,false);assert.equal(out.errorCode,'http_'+status);
 }
});
test('200 candidate is bounded, 204 is not useful text, and 201 is still a 2xx source',()=>{
 const r=record('http-200-useful');const out=interpretSingle(r);
 assert.equal(out.usableCandidate,true);assert.equal(out.coverage,'bounded_no_completeness_proof');assert.equal(out.paymentVerified,false);assert.equal(out.executionAuthorized,false);
 assert.equal(interpretSingle(record('http-204')).usableCandidate,false);
 assert.equal(interpretSingle({...r,status:201}).sourceAccepted,true);
 assert.equal(interpretSingle(r,{merchantStatus:402}).usableCandidate,false);
});
test('redirect identity and absent identity remain distinct',()=>{
 const r=record('redirect-pin');const out=interpretSingle(r);
 assert.notEqual(out.requestedUrl,out.finalUrl);assert.equal(out.identityKnown,true);
 assert.equal(interpretSingle({...r,url:r.requestedUrl}).usableCandidate,false);
});
test('charset is merchant-decoded evidence, not a consumer decoding claim',()=>{
 const r=record('multibyte-charset');assert.equal(r.text,'こんにちは');
 assert.equal(interpretSingle(r).capture.charset,'shift_jis');assert.equal(r.capture.charsetSource,'html-meta');
});
test('text, body and Markdown truncation preserve partial coverage',()=>{
 for(const name of ['truncated-excerpt','body-truncated','read-truncated'])assert.equal(interpretSingle(record(name)).coverage,'partial');
 assert.equal(record('read-truncated').markdown.length,40000);
 assert.equal(interpretSingle(record('read-403')).usableCandidate,false);
});
test('stale cached schema and contradictory errors fail closed',()=>{
 const r=record('http-200-useful');
 for(const key of ['sourceOk','capture','requestedUrl','finalUrl','error']){
  const stale={...r};delete stale[key];assert.equal(interpretSingle(stale).usableCandidate,false,key);
 }
 assert.equal(interpretSingle({...r,error:{code:'unexpected'}}).usableCandidate,false);
 const failed={ok:false,sourceOk:false,status:null,requestedUrl:r.requestedUrl,url:r.requestedUrl,finalUrl:null,error:{code:'timeout',message:'timeout'},capture:r.capture};
 assert.equal(interpretSingle(failed).usableCandidate,false);assert.equal(interpretSingle(failed).finalUrl,null);
});
test('actual batch failure, unknown and duplicate rows retain their own identities',()=>{
 const r=record('partial-batch');assert.equal(r.ok,false);assert.equal(r.partial,true);
 const out=interpretBatch(r);assert.equal(out.contractRecognized,true);assert.equal(out.partial,true);assert.equal(out.automaticRetry,false);assert.equal(out.paymentVerified,false);
 assert.deepEqual(out.sources.map(s=>s.status),['success','failure','unknown','skipped_duplicate']);
 assert.deepEqual(out.sources.map(s=>s.requestedUrl),['https://a.example/','https://b.example/','https://c.example/','https://a.example/']);
 assert.deepEqual(out.sources.map(s=>s.usableCandidate),[true,false,false,false]);
 assert.equal(out.sources[0].capture.method,'http-get-no-javascript');
 assert.equal(out.sources[1].httpStatus,404);assert.equal(out.sources[2].finalUrl,'https://c.example/');assert.equal(out.sources[2].responseObserved,false);
});
test('batch output omission and old invented requestedUrl rows are not candidates',()=>{
 const r=record('partial-batch');const mutated=structuredClone(r);mutated.sources[0].data=null;mutated.sources[0].provenance={outputTruncated:true};
 assert.equal(interpretBatch(mutated).sources[0].usableCandidate,false);
 const wrong={ok:true,partial:false,sources:[{requestedUrl:'https://a.example/',status:'success',httpStatus:200}]};
 assert.equal(interpretBatch(wrong).contractRecognized,false);assert.equal(interpretBatch(wrong).sources[0].requestedUrl,null);
});
test('optional actual merchant source replay validates schemas and exercises exported skills consumer', {skip:!process.env.EXTRACT_MERCHANT_SOURCE_DIR && 'exact merchant checkout not supplied'}, async()=>{
 const outputs=await replayMerchant(process.env.EXTRACT_MERCHANT_SOURCE_DIR);
 for(const [name,fixture] of Object.entries(outputs)){
  assert.equal(fixture.sourcePin,MERCHANT_PIN);
  const consume=name==='partial-batch'?interpretBatch:interpretSingle;
  const actual=consume(fixture.envelope),saved=consume(record(name));
  // Wall-clock accounting varies; semantic fields and emitted decoded data must agree.
  if(actual.accounting){delete actual.accounting.wallMs;delete saved.accounting.wallMs;}
  assert.deepEqual(actual,saved,name);
  if(name==='multibyte-charset')assert.equal(fixture.envelope.text,'こんにちは');
 }
});
