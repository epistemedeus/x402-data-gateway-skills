// Optional exact-source fixture producer. No sockets, live requests or stores.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';
import net from 'node:net';
import {syncBuiltinESMExports} from 'node:module';

export const manifest = JSON.parse(fs.readFileSync(new URL('../fixtures/walletless-first-use/merchant-source.json', import.meta.url)));
export function verifyTrialSource(dir) {
  for (const file of manifest.files) {
    const b = fs.readFileSync(path.join(dir, file.path));
    const blob = createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
    if (b.length !== file.bytes || blob !== file.blob || createHash('sha256').update(b).digest('hex') !== file.sha256) {
      throw new Error('trial_source_mismatch:' + file.path);
    }
  }
}

export async function replayTrial(dir) {
  verifyTrialSource(dir); // Includes packages and every relative producer import.
  const prior = {fetch: globalThis.fetch, connect: net.Socket.prototype.connect,
    extractFetch: globalThis.__SAMEDAYDESK_EXTRACT_FETCH__};
  const blocked = () => { throw new Error('walletless_fixture_network_forbidden'); };
  globalThis.fetch = blocked;
  net.Socket.prototype.connect = blocked;
  syncBuiltinESMExports();
  try {
    const {mountExtractionTrial, extractionTrialContract} = await import(pathToFileURL(path.join(dir, 'extraction-trial.mjs')));
    const routes = new Map();
    const origin = 'https://agents.samedaydesk.com';
    // Synthetic snapshots only: no provisioning, runtime store or grant mutation.
    const authority = {schema: 'samedaydesk.extraction-trial-budget.v1', experimentId: 'offline-guidance-fixture',
      startsAt: '2026-10-25T09:24:44.619Z', expiresAt: '2026-11-01T09:24:44.619Z', maxStarted: 20};
    let availability = 'enabled', started = 0, active = false, sourceCalls = 0;
    const view = () => ['disabled', 'unavailable'].includes(availability) ? {availability}
      : {...authority, availability: active ? 'busy' : availability, started, remaining: authority.maxStarted - started};
    const budget = {
      status: async () => view(),
      async acquire() {
        if (availability !== 'enabled' || active) throw new Error('synthetic_admission_refusal');
        active = true;
        return {async spend() { started++; }, async release() { active = false; }};
      },
    };
    mountExtractionTrial({get: (p, h) => routes.set('GET ' + p, h), all: (p, h) => routes.set(p, h)}, {budget});
    async function invoke(route, {method = 'POST', body, raw, query = {}} = {}) {
      const bytes = raw ?? JSON.stringify(body);
      const req = Readable.from(bytes === undefined ? [] : [Buffer.from(bytes)]);
      Object.assign(req, {method, query, headers: {'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(bytes ?? ''))}, socket: {}});
      return new Promise((resolve, reject) => {
        const headers = {};
        const res = {destroyed: false, statusCode: 200,
          set(k, v) { headers[k.toLowerCase()] = v; return this; },
          status(code) { this.statusCode = code; return this; },
          json(data) { resolve({status: this.statusCode, headers, body: data}); },
        };
        Promise.resolve(routes.get(method === 'GET' && route.startsWith('/.well-known/') ? 'GET ' + route : route)(req, res)).catch(reject);
      });
    }
    const source = new URL('https://caller-owned.example/page');
    const table = '<table><tr><th rowspan="2">Engine</th><th colspan="2">Support</th></tr><tr><th>Transpile</th><th>Reconcile</th></tr><tr><td>Alpha</td><td></td><td>Yes<sup><a href="#fn1">1</a></sup></td></tr><tr><td colspan="3"><span id="fn1">Preview</span></td></tr></table>';
    let sourceBody = table, sourceStatus = 200, sourceError = null, sourceGate = null;
    globalThis.__SAMEDAYDESK_EXTRACT_FETCH__ = async () => {
      sourceCalls++;
      if (sourceGate) await sourceGate;
      if (sourceError) throw Object.assign(new Error('synthetic source failure'), {code: sourceError});
      const response = new Response(sourceStatus === 204 ? null : sourceBody, {status: sourceStatus,
        headers: {'content-type': 'text/html; charset=utf-8'}});
      Object.defineProperty(response, 'url', {value: source.href});
      return response;
    };
    const out = {synthetic: true, sourcePin: manifest.commit,
      discoveryPointer: origin + '/.well-known/extraction-trial', discovery: {}, refusals: {}, requests: {}, outputs: {}};
    for (const value of ['enabled', 'disabled', 'scheduled', 'expired', 'exhausted', 'busy', 'unavailable']) {
      availability = value;
      started = value === 'exhausted' ? authority.maxStarted : 0;
      out.discovery[value] = await invoke('/.well-known/extraction-trial', {method: 'GET'});
      if (value !== 'enabled') out.refusals[value] = await invoke('/trial/read', {body: {url: source.href}});
    }
    out.discoveryAndRefusalSourceCalls = sourceCalls;
    availability = 'enabled'; started = 0;
    const request = (body, route = '/trial/read') => invoke(route, {body: {url: source.href, ...body}});
    out.outputs.read = await request({});
    out.outputs.extract = await request({}, '/trial/extract');
    out.sharedAfterTwo = extractionTrialContract(view());
    out.outputs.bounded = await request({markdownLimitChars: 25});
    sourceBody = '<table><tr><td><table><tr><td>nested</td></tr></table></td></tr></table>';
    out.outputs.omitted = await request({});
    sourceBody = '<body>Blocked</body>'; sourceStatus = 403;
    out.outputs.sourceRefusal = await request({});
    sourceStatus = 204;
    out.outputs.empty = await request({});
    sourceStatus = 200; sourceError = 'timeout';
    out.outputs.fetchFailure = await request({}); sourceError = null;
    sourceBody = '<body>' + 'x'.repeat(3_000_001) + '</body>';
    const capped = await request({markdownLimitChars: 25});
    out.outputs.bodyCap = capped;
    sourceBody = table;
    for (const [name, body, route] of [
      ['readMinimum', {markdownLimitChars: 1}], ['readMaximum', {markdownLimitChars: 40000}],
      ['extractExcerpt', {textExcerptLimitChars: 8}, '/trial/extract'],
    ]) out.requests[name] = await request(body, route);
    const beforeInvalid = sourceCalls;
    for (const [name, body, route] of [
      ['wrongReadField', {textExcerptLimitChars: 8}], ['wrongExtractField', {markdownLimitChars: 8}, '/trial/extract'],
      ['readString', {markdownLimitChars: '25'}], ['readZero', {markdownLimitChars: 0}],
      ['readTooLarge', {markdownLimitChars: 40001}], ['extra', {beforeFetch: true}],
      ['private', {url: 'https://127.0.0.1/'}], ['credentials', {url: 'https://u:p@example.com/'}],
    ]) out.requests[name] = await request(body, route);
    out.requests.query = await invoke('/trial/read', {body: {url: source.href}, query: {markdownLimitChars: 1}});
    out.requests.method = await invoke('/trial/read', {method: 'GET'});
    out.requests.invalidJson = await invoke('/trial/read', {raw: '{'});
    out.requests.oversizeJson = await invoke('/trial/read', {raw: JSON.stringify({padding: 'x'.repeat(5000)})});
    out.invalidRequestSourceCalls = sourceCalls - beforeInvalid;
    let release;
    sourceGate = new Promise(resolve => { release = resolve; });
    const pending = request({});
    // The parser is asynchronous: wait only until the in-memory fixture fetch starts.
    while (!active) await new Promise(resolve => setImmediate(resolve));
    try { out.crossOperationBusy = await request({}, '/trial/extract'); }
    finally { release(); await pending; sourceGate = null; }
    out.sourceCalls = sourceCalls;
    // Time is intentionally removed only from delivered records for byte-stable replay.
    for (const group of [out.outputs, out.requests]) for (const response of Object.values(group)) delete response.body.fetchedAt;
    return out;
  } finally {
    globalThis.fetch = prior.fetch;
    net.Socket.prototype.connect = prior.connect;
    if (prior.extractFetch === undefined) delete globalThis.__SAMEDAYDESK_EXTRACT_FETCH__;
    else globalThis.__SAMEDAYDESK_EXTRACT_FETCH__ = prior.extractFetch;
    syncBuiltinESMExports();
  }
}
