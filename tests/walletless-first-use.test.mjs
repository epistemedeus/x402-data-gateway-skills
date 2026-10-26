import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {interpretSingle} from '../consumers/extract-record.mjs';
import {manifest, replayTrial, verifyTrialSource} from './walletless-merchant-replay.mjs';

const received = JSON.parse(fs.readFileSync(new URL('../fixtures/walletless-first-use/producer.json', import.meta.url)));
const contract = received.discovery.enabled.body;
const guides = ['samedaydesk-machine-commerce', 'web-extract'].map(name => [name,
  fs.readFileSync(new URL(`../skills/${name}/SKILL.md`, import.meta.url), 'utf8')]);
const rows = text => text.split('\n').filter(line => line.startsWith('| ')).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));

for (const [name, guide] of guides) {
  test(`${name}: discovery and caller authorization precede request construction and paid selection`, () => {
    const pointer = guide.indexOf('`x-service-info.docs.extractionTrial`');
    const request = guide.indexOf('| Caller needs |');
    const paid = guide.indexOf(name === 'web-extract' ? '## Choose a separate paid route' : '## Choose the paid action');
    assert.ok(pointer > 0 && pointer < request && request < paid);
    assert.match(guide, /require same-origin HTTPS without credentials or cross-origin redirects/);
    assert.match(guide, /GET that contract fresh; its `Cache-Control: no-store` availability, operation,\nexample, limits and result guidance are the authority before constructing a request/);
    assert.match(guide, /Missing, malformed or unreachable discovery means availability is unknown: stop\nthe trial path/);
    assert.match(guide, /Discovery alone does not authorize an unsolicited URL fetch/);
    assert.match(guide, /caller's actual task and caller-owned public HTTPS URL; replace the\ndiscovery example/);
    assert.doesNotMatch(guide, /2026-11-01|17 remaining|18 remaining|20 (?:free )?calls/i);
  });

  test(`${name}: structured and table-body choices construct the current producer requests`, () => {
    const choices = rows(guide).filter(row => row.length === 4 && row[2].startsWith('`POST '));
    assert.equal(choices.length, 2);
    for (const [index, [need, member, operation, template]] of choices.entries()) {
      const producer = index === 0 ? contract.request : contract.reader.request;
      assert.match(need, index === 0 ? /Structured.*metadata.*JSON-LD/ : /body.*tables.*Markdown/);
      assert.equal(member, index === 0 ? '`request`' : '`reader.request`');
      assert.equal(operation, `\`${producer.method} ${producer.path}\``);
      const body = JSON.parse(template.slice(1, -1));
      assert.equal(body.url, '<caller-public-https-url>');
      body.url = producer.body.url; // The example is shape evidence, never a task to execute.
      assert.deepEqual(body, producer.body);
    }
    assert.match(guide, /HTTP operations, not evidence of walletless MCP tools or batch support/);
    assert.match(guide, /Extract optionally accepts `textExcerptLimitChars` \(1–40,000, default 1,200\)/);
    assert.match(guide, /read optionally accepts integer `markdownLimitChars` \(1–40,000, default 40,000\)/);
    assert.match(guide, /Do not swap those fields, attach query parameters, or send extra body fields/);
    assert.equal(received.requests.extractExcerpt.body.capture.textExcerptLimitChars, 8);
    assert.equal(received.requests.readMinimum.body.capture.markdownLimitChars, contract.reader.markdownLimitChars.minimum);
    assert.equal(received.requests.readMaximum.body.capture.markdownLimitChars, contract.reader.markdownLimitChars.maximum);
    for (const key of ['wrongReadField', 'wrongExtractField', 'readString', 'readZero', 'readTooLarge', 'extra', 'private', 'credentials', 'query']) {
      assert.equal(received.requests[key].status, 400, key);
      assert.equal(received.requests[key].body.error, 'invalid_trial_input', key);
    }
    assert.equal(received.invalidRequestSourceCalls, 0);
  });

  test(`${name}: actual disabled/expired/exhausted/busy/unavailable records select stop, never payment`, () => {
    const availabilityRows = rows(guide).filter(row => row.length === 2);
    const eligible = availabilityRows.find(row => row[0] === '`enabled`');
    assert.match(eligible[1], /only for the caller-authorized task; recheck current limits and expiry/);
    for (const [availability, refusal] of Object.entries(received.refusals)) {
      const row = availabilityRows.find(row => row[0].includes('`' + availability + '`'));
      assert.ok(row, availability);
      assert.match(row[1], /^Stop.*do not submit or automatically retry/);
      assert.equal(refusal.status, 503);
      assert.deepEqual(refusal.body, {ok: false, charged: false, error: 'trial_unavailable', availability});
      assert.equal(refusal.headers['payment-required'], undefined);
      assert.equal(received.discovery[availability].headers['cache-control'], 'no-store');
    }
    assert.match(availabilityRows.find(row => row[0] === 'Missing or unknown')[1], /^Stop with availability unknown/);
    assert.match(guide, /Never turn a free refusal into a paid retry/);
    assert.match(guide, /direct\/native\nalternative, or the separate nonspending paid-intent path below when requested/);
    assert.equal(received.discoveryAndRefusalSourceCalls, 0);
  });

  test(`${name}: shared authority and lost outcomes cannot create per-operation entitlement`, () => {
    assert.equal(contract.limits.maxStarted, 20);
    assert.equal(contract.limits.concurrency, 1);
    assert.equal(received.sharedAfterTwo.experimentId, contract.experimentId);
    assert.equal(received.sharedAfterTwo.expiresAt, contract.expiresAt);
    assert.equal(received.sharedAfterTwo.remaining, contract.remaining - 2);
    assert.equal(received.crossOperationBusy.status, 503);
    assert.equal(received.crossOperationBusy.body.availability, 'busy');
    assert.match(guide, /Read and extract share the SAME original authority: at most 20 attempted hops,\none concurrent operation and the original expiry reported by live discovery/);
    assert.match(guide, /A hop is not a call: failed DNS and redirects spend before I\/O/);
    assert.match(guide, /Never cache a\nremaining count or date as permanent entitlement, assign per-operation credit,\nrenew\/reset a grant, or read runtime stores/);
    assert.match(guide, /unknown\/lost response must not be automatically repeated; results are not\nretained for replay/);
  });

  test(`${name}: delivered source failures and table omission stay bounded evidence`, () => {
    const output = received.outputs;
    assert.equal(interpretSingle(output.read.body).usableCandidate, true);
    assert.match(output.read.body.markdown, /<th rowspan="2">Engine<\/th><th colspan="2">Support<\/th>/);
    assert.match(output.read.body.markdown, /<td>Alpha<\/td><td><\/td><td>Yes/);
    assert.match(output.read.body.markdown, /href="https:\/\/caller-owned.example\/page#fn1"/);
    assert.equal(output.read.body.truncated, false);
    for (const key of ['sourceRefusal', 'fetchFailure', 'empty']) {
      assert.equal(output[key].status, 200);
      assert.equal(interpretSingle(output[key].body).usableCandidate, false, key);
    }
    assert.equal(output.sourceRefusal.body.ok, true);
    assert.equal(output.sourceRefusal.body.sourceOk, false);
    assert.equal(output.fetchFailure.body.status, null);
    assert.equal(output.fetchFailure.body.finalUrl, null);
    for (const key of ['bounded', 'omitted', 'bodyCap']) {
      assert.equal(interpretSingle(output[key].body).coverage, 'partial', key);
      assert.equal(output[key].body.truncated, true);
    }
    assert.match(output.omitted.body.markdown, /Table omitted: nested table/);
    assert.ok(output.bounded.body.markdown.length <= 25);
    assert.equal(output.bodyCap.body.capture.bodyBytes, 3_000_000);
    assert.match(guide, /captured 403 can have `ok:true` and `sourceOk:false`/);
    assert.match(guide, /Unsupported tables are explicitly omitted with truncation/);
    assert.match(guide, /even untruncated output proves no general\ntable fidelity, rendered-page completeness or buyer acceptance/);
    assert.match(guide, /No trial result\nis a payment or settlement receipt/);
  });
}

test('producer method/parser refusals remain distinct from source failures', () => {
  assert.equal(received.sourcePin, manifest.commit);
  assert.equal(received.discovery.exhausted.body.remaining, 0);
  assert.equal(received.discovery.exhausted.body.started, 20);
  for (const [key, status, error] of [['method', 405, 'method_not_allowed'], ['invalidJson', 400, 'invalid_trial_body'], ['oversizeJson', 413, 'invalid_trial_body']]) {
    assert.equal(received.requests[key].status, status);
    assert.equal(received.requests[key].body.error, error);
    assert.equal(received.requests[key].body.charged, false);
  }
});

test('general skill stays nonspending and both skills preserve live protocol and paid-body authority', () => {
  for (const [, guide] of guides) {
    assert.match(guide, /complete resource|complete resource URL/);
    assert.match(guide, /amount/); assert.match(guide, /Base/); assert.match(guide, /recipient/);
    assert.match(guide, /(?:actually present in|actually offered by) the live challenge/);
  }
  assert.match(guides[0][1], /End every\nrun before payment/);
  assert.match(guides[0][1], /exact POST body/);
  assert.match(guides[0][1], /credentialsUsed: false/);
  assert.match(guides[1][1], /MCP and HTTP credential scopes remain\ndistinct/);
  assert.match(guides[1][1], /Unknown payment outcomes require read-only reconciliation/);
});

test('optional current producer replay matches received full records', {
  skip: !process.env.FIRST_USE_MERCHANT_SOURCE_DIR && 'optional: exact 65176654 merchant source and locked dependencies not supplied',
}, async () => {
  assert.equal(received.sourcePin, manifest.commit);
  assert.deepEqual(await replayTrial(process.env.FIRST_USE_MERCHANT_SOURCE_DIR), received);
});

test('source verification fails closed before import on a missing producer', () => {
  assert.throws(() => verifyTrialSource(new URL('./fixtures/', import.meta.url).pathname));
});
