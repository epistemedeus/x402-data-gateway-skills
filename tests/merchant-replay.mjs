// Optional source replay, never an HTTP payment gate or a live merchant request.
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
export const MERCHANT_PIN='4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1';
export async function replayMerchant(sourceDir) {
 const manifest=JSON.parse(fs.readFileSync(new URL('../fixtures/extract-contract/merchant-source.json',import.meta.url)));
 for(const e of manifest.files){const b=fs.readFileSync(path.join(sourceDir,e.path));
  const sha=createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');if(sha!==e.sha)throw Error('merchant_source_mismatch:'+e.path);}
 const {extract,readMarkdown,extractMcpOutputSchema,readMcpOutputSchema}=await import(pathToFileURL(path.join(sourceDir,'extract.mjs')).href);
 const {executeExtractBatch,extractBatchMcpOutputSchema}=await import(pathToFileURL(path.join(sourceDir,'extract-batch.mjs')).href);
 const prior=globalThis.__SAMEDAYDESK_EXTRACT_FETCH__;
 const outputs={};
 const makeResponse=(body,status=200,url='https://fixture.example/final',type='text/html; charset=utf-8')=>{
  const r=new Response(status===204?null:body,{status,headers:{'content-type':type}});Object.defineProperty(r,'url',{value:url});return r;};
 const run=async(name,body,{status=200,type,read=false,url}={})=>{
  globalThis.__SAMEDAYDESK_EXTRACT_FETCH__=async()=>makeResponse(body,status,url,type);
  const record=await (read?readMarkdown:extract)('https://fixture.example/requested');
  (read?readMcpOutputSchema:extractMcpOutputSchema).parse(record);
  outputs[name]={synthetic:true,sourcePin:MERCHANT_PIN,producer:read?'readMarkdown':'extract',envelope:record};
 };
 try {
  await run('http-200-useful','<title>Fixture</title><body>Bounded useful text</body>');
  for(const status of [204,403,404,429,500])await run('http-'+status,status===204?'':'<title>Refused</title><body>Block copy is not useful content</body>',{status});
  await run('redirect-pin','<body>Redirected content</body>',{url:'https://fixture.example/redirected'});
  await run('truncated-excerpt','<body>'+'x'.repeat(1300)+'</body>');
  await run('body-truncated','<body>'+'x'.repeat(3000010)+'</body>');
  const japanese=Buffer.from([0x82,0xb1,0x82,0xf1,0x82,0xc9,0x82,0xbf,0x82,0xcd]);
  await run('multibyte-charset',Buffer.concat([Buffer.from('<meta charset="shift_jis"><body>'),japanese,Buffer.from('</body>')]),{type:'text/html'});
  await run('read-truncated','<body>'+'x'.repeat(40100)+'</body>',{read:true});
  await run('read-403','<body>Forbidden</body>',{read:true,status:403});
  const dir=fs.mkdtempSync(path.join(tmpdir(),'skills-merchant-replay-'));
  try {
   const urls=['https://a.example/','https://b.example/','https://c.example/','https://a.example/'];
   const body=Buffer.from(JSON.stringify({urls,fields:['title','text']}));
   const record=await executeExtractBatch({rawBody:body,headers:{},dataDir:dir,
    fetchImpl:async url=>{
     if(String(url)==='https://c.example/')throw new Error('synthetic lost source response');
     return makeResponse('<title>Fixture</title><body>Text</body>',String(url)==='https://b.example/'?404:200,String(url));
    }});
   extractBatchMcpOutputSchema.parse(record);
   outputs['partial-batch']={synthetic:true,sourcePin:MERCHANT_PIN,producer:'executeExtractBatch',envelope:record};
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 } finally {if(prior===undefined)delete globalThis.__SAMEDAYDESK_EXTRACT_FETCH__;else globalThis.__SAMEDAYDESK_EXTRACT_FETCH__=prior;}
 return outputs;
}
