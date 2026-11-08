import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const exec = promisify(execFile);
const directory = fileURLToPath(new URL('.', import.meta.url));
const first = 'https://marketing.example';
const second = 'https://docs.example';
const pair = [first, second];
const pass = origin => ({ origin, status: 'pass', reason: 'peer_link_present' });

async function verify(scenario, args, expectedExit, results) {
  let output;
  let actualExit = 0;
  try {
    output = await exec(process.execPath, ['--import', './fixture-fetch.mjs', 'check.mjs', ...args], {
      cwd: directory,
      env: { ...process.env, NODE_OPTIONS: '', DOCS_CHECK_FIXTURE: scenario },
      timeout: 12_000,
    });
  } catch (error) {
    output = error;
    actualExit = error.code;
  }
  assert.equal(output.stderr, '');
  assert.equal(actualExit, expectedExit);
  assert.equal(output.stdout, JSON.stringify({ schemaVersion: 1, results }) + '\n');
}

for (const [name, scenario, args] of [
  ['reciprocal plain indexes pass', 'reciprocal', pair],
  ['Markdown with a titled angle-bracket destination passes', 'markdown', pair],
  ['exact 128 KiB in UTF-8 including BOM passes', 'exact_limit', pair],
  ['bare origins may use uppercase host, default port and one trailing slash', 'reciprocal',
    ['https://MARKETING.example:443/', second]],
]) {
  test(name, () => verify(scenario, args, 0, pair.map(pass)));
}

for (const [name, scenario, status, reason] of [
  ['404 is an absent index', 'absent', 'drift', 'missing_index'],
  ['HTML 200 fallback is refused', 'html', 'refused', 'unsupported_media_type'],
  ['HTML mislabeled plain text is refused', 'plain_html', 'refused', 'missing_initial_h1'],
  ['non-200 response is refused', 'wrong_status', 'refused', 'unexpected_http_status'],
  ['prose before an H1 is refused', 'missing_h1', 'refused', 'missing_initial_h1'],
  ['empty H1 is refused', 'empty_h1', 'refused', 'missing_initial_h1'],
  ['prose, relative, altered and unrelated links do not satisfy reciprocity', 'missing_link', 'drift', 'peer_link_missing'],
  ['fences, markup, quotes and code are not index list links', 'fenced_link', 'drift', 'peer_link_missing'],
  ['redirect is refused without following its Location', 'redirect', 'refused', 'redirect'],
  ['oversize declared length is refused', 'oversized_length', 'refused', 'body_too_large'],
  ['oversize streamed bytes are refused without a length header', 'oversized_stream', 'refused', 'body_too_large'],
  ['malformed UTF-8 is refused', 'invalid_utf8', 'refused', 'invalid_utf8'],
  ['network error text stays out of output', 'request_error', 'refused', 'request_failed'],
  ['timeout covers a stalled body after response headers', 'timeout', 'refused', 'timeout'],
]) {
  test(name, { concurrency: true }, () => verify(scenario, pair, 1, [
    { origin: first, status, reason }, pass(second),
  ]));
}

test('injected and non-origin arguments stop both requests and are never echoed', async () => {
  const invalid = [
    'https://owner:password@marketing.example',
    'https://marketing.example/../',
    'https://marketing.example?secret=value',
    'https://marketing.example/#fragment',
    'https://marketing.example\\',
    'https://marketing.example\n::error::injected',
    'https://marketing.example; $(touch SHOULD_NOT_EXIST)',
    'https://marketing.example:65536',
    'http://marketing.example',
    'https://127.1',
    '--help',
  ];
  await Promise.all(invalid.map(value => verify('no_requests', [value, second], 2, [
    { origin: null, status: 'refused', reason: 'invalid_origin' },
    { origin: second, status: 'skipped', reason: 'invalid_pair' },
  ])));
});

test('equivalent origins are refused before either request', () =>
  verify('no_requests', [first, 'https://MARKETING.example:443/'], 2,
    [first, first].map(origin => ({ origin, status: 'refused', reason: 'duplicate_origin' }))));

test('wrong argument count is refused without requests', () =>
  verify('no_requests', [first], 2, [0, 1].map(() =>
    ({ origin: null, status: 'refused', reason: 'expected_two_origins' }))));
