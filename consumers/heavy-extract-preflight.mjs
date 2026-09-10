#!/usr/bin/env node
/** Historical filename only: deterministic Node script, not a native Heavy/Grok model.
 * One unpaid challenge request; no wallet, credential, paid replay, or model call.
 */
import fs from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { interpretSingle } from './extract-record.mjs';

const ORIGIN = 'https://agents.samedaydesk.com';
const TARGET = 'https://example.com/';
const MAX_BYTES = 262144;
const TIMEOUT_MS = 8000;
async function boundedGet(url, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('read_deadline')), TIMEOUT_MS);
  let listener;
  const aborted = new Promise((_, reject) => {
    listener = () => reject(new Error('read_deadline'));
    controller.signal.addEventListener('abort', listener, {once:true});
  });
  try {
    const res = await Promise.race([fetchImpl(url, {method:'GET', redirect:'manual', signal:controller.signal,
      headers:{Accept:'application/json, text/html;q=0.5', 'X-SameDayDesk-Agent-Source':'agent-skills-v1'}}), aborted]);
    const reader = res.body?.getReader();
    const chunks = [];let size = 0;
    if (reader) while (true) {
      const part = await Promise.race([reader.read(), aborted]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) { controller.abort(); void reader.cancel().catch(()=>{}); throw new Error('body_limit'); }
      chunks.push(Buffer.from(part.value));
    }
    return {status:res.status, text:Buffer.concat(chunks).toString('utf8'), contentType:res.headers.get('content-type') || '',
      paymentRequired:res.headers.has('payment-required'), wwwAuthenticate:res.headers.has('www-authenticate')};
  } finally {clearTimeout(timer);controller.signal.removeEventListener('abort',listener);controller.abort();}
}
export async function runPreflight({ fetchImpl = globalThis.fetch, origin = ORIGIN, target = TARGET, directPreview = false } = {}) {
  // Exact destinations. Environment credentials and arbitrary URLs are never read.
  if (origin !== ORIGIN || target !== TARGET) throw new Error('only_the_documented_public_fixture_destinations_are_supported');
  const skillUrl = new URL('../skills/web-extract/SKILL.md',import.meta.url);
  const skill = fs.readFileSync(skillUrl,'utf8');
  if (!skill.includes('name: web-extract')) throw new Error('local_skill_missing');
  const requestUrl = `${origin}/extract?url=${encodeURIComponent(target)}`;
  let received;
  try {received = await boundedGet(requestUrl,fetchImpl);} catch {
    return {evidenceKind:'deterministic_script', nativeModelRun:false, outcome:'transport_unknown', paymentAttempted:false, automaticRetry:false, sourceExecution:'unknown'};
  }
  let record = null;try {record = JSON.parse(received.text);} catch {}
  const unpaid = received.status === 402;
  const report = {
    evidenceKind:'deterministic_script', nativeModelRun:false,
    localGuidanceRead:'skills/web-extract/SKILL.md', modelSelection:'none',
    request:{method:'GET',url:requestUrl}, httpStatus:received.status,
    outcome:unpaid ? 'unpaid_challenge_observed' : 'unexpected_response_stop',
    sourceExecution:unpaid ? 'no_paid_output_observed' : 'not_inferred',
    paymentAttempted:false, walletTouched:false, paymentVerified:false, automaticRetry:false,
    // Merely seeing 402 does not validate amount, network, recipient, or resource binding.
    challengeVerified:false, purchaseIntent:null,
    deliveredRecord:received.status === 200 ? interpretSingle(record) : null,
    directPreview:null,
  };
  if (directPreview) {
    try {
      const direct = await boundedGet(target,fetchImpl);
      const accepted = direct.status >= 200 && direct.status < 300 && /text\/html/i.test(direct.contentType);
      report.directPreview = {status:direct.status, sourceOk:accepted,
        title:accepted ? (direct.text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || null) : null,
        previewOnly:true, completeness:'not_proven', decoding:'utf-8-only', redirectsFollowed:false};
    } catch {report.directPreview={sourceOk:false,outcome:'transport_unknown',previewOnly:true};}
  }
  return report;
}
async function main(args) {
  if (args.includes('--help')) {console.log('node consumers/heavy-extract-preflight.mjs [--direct-preview] [--out NEW_FILE]\nDeterministic unpaid example.com preflight; not a native model. No live paid replay.');return;}
  let out=null,directPreview=false;
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--direct-preview')directPreview=true;
    else if(args[i]==='--out' && args[i+1] && !args[i+1].startsWith('--') && !out)out=args[++i];
    else throw new Error('unsupported_argument');
  }
  const report=await runPreflight({directPreview});
  if(out)fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(report,null,2));
  if(report.outcome!=='unpaid_challenge_observed')process.exitCode=2;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('preflight_failed; no automatic retry');process.exitCode=1;});
