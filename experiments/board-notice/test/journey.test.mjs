import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const repoRoot = path.resolve(packageRoot, '../..');
const journeyBin = path.join(packageRoot, 'bin/journey.mjs');
const fixtures = path.join(packageRoot, 'fixtures');
const skillSource = path.join(repoRoot, 'skills/public-careers-board');
const evidence = [];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function treeHash(dir) {
  const listed = spawnSync('git', ['ls-files', '-s', dir], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  return sha256(listed.stdout);
}

async function copySkill() {
  const dir = await mkdtemp(path.join(tmpdir(), 'h98310-skill-'));
  const dest = path.join(dir, 'public-careers-board');
  const copied = spawnSync('cp', ['-a', skillSource, dest], { encoding: 'utf8' });
  assert.equal(copied.status, 0, copied.stderr);
  return dest;
}

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [journeyBin, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const text = Buffer.concat(stdout).toString('utf8');
      let body = null;
      try { body = JSON.parse(text); } catch { body = null; }
      resolve({ code, body, text, stderr: Buffer.concat(stderr).toString('utf8'), pid: child.pid });
    });
  });
}

function startSink(handler) {
  const received = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let body = null;
      try { body = JSON.parse(raw); } catch { body = { raw }; }
      received.push({ url: req.url, body });
      handler(req, res, body, received);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        url: `http://127.0.0.1:${port}/notice`,
        received,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function accept(req, res, body) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ delivery: 'accepted', noticeId: body.url }));
}

async function stateOf(file) {
  const text = await readFile(file, 'utf8');
  return JSON.parse(text);
}

function seenUrls(state, board) {
  const journey = Object.values(state.journeys).find((item) => item.board === board);
  return journey ? journey.seen : null;
}

const skill = await copySkill();
const work = await mkdtemp(path.join(tmpdir(), 'h98310-journey-'));
const skillBefore = await treeHash('skills/public-careers-board');
const pluginBefore = await treeHash('plugins/public-careers-board');

function args(extra) {
  return [
    '--skill', skill,
    '--sink', extra.sink,
    '--state', extra.state,
    '--board', extra.board,
    '--seed', extra.seed,
    '--timeout-ms', String(extra.timeoutMs || 15000),
    ...extra.phrases.flatMap((phrase) => ['--phrase', phrase]),
  ];
}

test('refuses a missing board, missing criteria, and a non-loopback sink before writing state', async () => {
  const state = path.join(work, 'refuse.json');
  const missing = await run(['--skill', skill, '--seed', path.join(fixtures, 'acxiom-empty.seed.json'), '--state', state, '--sink', 'http://127.0.0.1:9/notice', '--phrase', 'account executive']);
  assert.equal(missing.code, 2);
  assert.equal(missing.body.outcome, 'refused');
  assert.equal(missing.body.reason, 'board_required');
  const criteria = await run(['--skill', skill, '--board', 'acxiom', '--seed', path.join(fixtures, 'acxiom-empty.seed.json'), '--state', state, '--sink', 'http://127.0.0.1:9/notice']);
  assert.equal(criteria.code, 2);
  assert.equal(criteria.body.reason, 'criteria_required');
  const remote = await run(['--skill', skill, '--board', 'acxiom', '--seed', path.join(fixtures, 'acxiom-empty.seed.json'), '--state', state, '--sink', 'http://example.com/notice', '--phrase', 'account executive']);
  assert.equal(remote.code, 2);
  assert.equal(remote.body.reason, 'sink_refused');
  await assert.rejects(readFile(state, 'utf8'));
  evidence.push({ case: 'refuse', exits: [missing.code, criteria.code, remote.code] });
});

test('cold baseline sends no old-job notice and a fresh process repeat stays quiet', async () => {
  const started = Date.now();
  const sink = await startSink(accept);
  const state = path.join(work, 'baseline.json');
  try {
    const first = await run(args({
      sink: sink.url,
      state,
      board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(first.code, 0, first.text + first.stderr);
    assert.equal(first.body.outcome, 'baseline');
    assert.equal(first.body.notices.length, 0);
    assert.equal(first.body.seenCount, 2);
    assert.equal(first.body.exactlyOnceMail, false);
    assert.equal(sink.received.length, 0);
    const stored = await stateOf(state);
    assert.equal(seenUrls(stored, 'acxiom').length, 2);
    const setupMs = Date.now() - started;
    const repeatStarted = Date.now();
    const second = await run(args({
      sink: sink.url,
      state,
      board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(second.code, 0, second.text);
    assert.equal(second.body.outcome, 'unchanged');
    assert.equal(second.body.notices.length, 0);
    assert.equal(second.body.stateChanged, false);
    assert.equal(sink.received.length, 0);
    evidence.push({ case: 'baseline-repeat', setupMs, repeatMs: Date.now() - repeatStarted, exits: [first.code, second.code] });
  } finally {
    await sink.close();
  }
});

test('a new matching job notifies once and the same feed does not notify again', async () => {
  const sink = await startSink(accept);
  const state = path.join(work, 'notice.json');
  try {
    const baseline = await run(args({
      sink: sink.url, state, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(baseline.body.outcome, 'baseline');
    const started = Date.now();
    const noticed = await run(args({
      sink: sink.url, state, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-new.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(noticed.code, 0, noticed.text);
    assert.equal(noticed.body.outcome, 'notice');
    assert.equal(noticed.body.notices.length, 1);
    assert.equal(noticed.body.notices[0].title, 'Account Executive, New Role');
    assert.equal(noticed.body.notices[0].delivery, 'accepted');
    assert.equal(sink.received.length, 1);
    assert.equal(sink.received[0].body.schema, 'board-notice.notice.v1');
    assert.deepEqual(Object.keys(sink.received[0].body).sort(), ['board', 'location', 'phrases', 'schema', 'title', 'url']);
    assert.equal(sink.received[0].body.url.includes('/job/'), true);
    const again = await run(args({
      sink: sink.url, state, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-new.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(again.body.outcome, 'unchanged');
    assert.equal(sink.received.length, 1);
    evidence.push({ case: 'new-match', executionMs: Date.now() - started, notices: 1, exits: [noticed.code, again.code] });
  } finally {
    await sink.close();
  }
});

test('empty success and source failure stay distinct and failure does not create state', async () => {
  const sink = await startSink(accept);
  const emptyState = path.join(work, 'empty.json');
  const failedState = path.join(work, 'failed.json');
  try {
    const empty = await run(args({
      sink: sink.url, state: emptyState, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-empty.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(empty.body.outcome, 'baseline');
    assert.equal(empty.body.reason, 'empty_board');
    assert.equal(empty.body.emptyBoard, true);
    assert.equal(empty.body.notices.length, 0);
    const failure = await run(args({
      sink: sink.url, state: failedState, board: 'liveramp',
      seed: path.join(fixtures, 'liveramp-failure.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(failure.code, 0, failure.text);
    assert.equal(failure.body.outcome, 'source_failure');
    assert.equal(failure.body.emptyBoard, false);
    assert.equal(failure.body.notices.length, 0);
    assert.equal(failure.body.stateChanged, false);
    await assert.rejects(readFile(failedState, 'utf8'));
    const again = await run(args({
      sink: sink.url, state: failedState, board: 'liveramp',
      seed: path.join(fixtures, 'liveramp-failure.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(again.body.outcome, 'source_failure');
    await assert.rejects(readFile(failedState, 'utf8'));
    assert.notEqual(empty.body.outcome, failure.body.outcome);
    evidence.push({ case: 'empty-vs-failure', empty: empty.body.reason, failure: failure.body.outcome });
  } finally {
    await sink.close();
  }
});

test('partial and wrong-shape reads do not baseline or notify', async () => {
  const sink = await startSink(accept);
  const state = path.join(work, 'partial.json');
  try {
    const partial = await run(args({
      sink: sink.url, state, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-partial.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(partial.body.outcome, 'incomplete');
    assert.equal(partial.body.boardClaim, 'partial');
    assert.equal(partial.body.notices.length, 0);
    await assert.rejects(readFile(state, 'utf8'));
    const shape = await run(args({
      sink: sink.url, state, board: 'liveramp',
      seed: path.join(fixtures, 'liveramp-shape.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(shape.body.outcome, 'incomplete');
    assert.equal(shape.body.notices.length, 0);
    const later = await run(args({
      sink: sink.url, state, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-new.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(later.body.outcome, 'baseline');
    assert.equal(later.body.notices.length, 0);
    assert.equal(sink.received.length, 0);
    evidence.push({ case: 'partial-shape', partial: partial.body.boardClaim, laterNotices: 0 });
  } finally {
    await sink.close();
  }
});

test('duplicate posting paths collapse to one seen id', async () => {
  const sink = await startSink(accept);
  const state = path.join(work, 'duplicate.json');
  try {
    const result = await run(args({
      sink: sink.url, state, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-duplicate.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(result.code, 0, result.text);
    assert.equal(result.body.outcome, 'baseline');
    assert.equal(result.body.seenCount, 1);
    assert.equal(result.body.duplicateUrls >= 1, true);
    assert.equal(result.body.notices.length, 0);
    evidence.push({ case: 'duplicate-urls', seenCount: result.body.seenCount, duplicateUrls: result.body.duplicateUrls });
  } finally {
    await sink.close();
  }
});

test('a rejected notice is retried once and an unknown or dropped response is not called delivered', async () => {
  let mode = 'reject';
  const sink = await startSink((req, res, body) => {
    if (mode === 'reject') {
      res.writeHead(500);
      res.end('no');
      return;
    }
    if (mode === 'unknown') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ delivery: 'unknown' }));
      return;
    }
    if (mode === 'drop') {
      req.socket.destroy();
      return;
    }
    if (mode === 'redirect') {
      res.writeHead(302, { location: 'http://127.0.0.1:9/apply' });
      res.end();
      return;
    }
    accept(req, res, body);
  });
  const state = path.join(work, 'delivery.json');
  const common = {
    sink: sink.url, state, board: 'acxiom',
    phrases: ['account executive'],
  };
  try {
    const baseline = await run(args({ ...common, seed: path.join(fixtures, 'acxiom-baseline.seed.json') }));
    assert.equal(baseline.body.outcome, 'baseline');
    const rejected = await run(args({ ...common, seed: path.join(fixtures, 'acxiom-new.seed.json') }));
    assert.equal(rejected.body.outcome, 'notice_failed');
    assert.equal(rejected.body.notices[0].delivery, 'rejected');
    assert.equal(rejected.body.exactlyOnce, false);
    let stored = await stateOf(state);
    assert.equal(stored.journeys[Object.keys(stored.journeys)[0]].seen.includes(rejected.body.notices[0].url), false);
    mode = 'accept';
    const recovered = await run(args({ ...common, seed: path.join(fixtures, 'acxiom-new.seed.json') }));
    assert.equal(recovered.body.outcome, 'notice');
    assert.equal(recovered.body.notices.length, 1);
    assert.equal(recovered.body.notices[0].delivery, 'accepted');
    const acceptedCount = sink.received.filter((item) => item.body.title === 'Account Executive, New Role').length;
    assert.equal(acceptedCount, 2);

    const unknownState = path.join(work, 'unknown.json');
    mode = 'accept';
    await run(args({ ...common, state: unknownState, seed: path.join(fixtures, 'acxiom-baseline.seed.json') }));
    mode = 'unknown';
    const unknown = await run(args({ ...common, state: unknownState, seed: path.join(fixtures, 'acxiom-new.seed.json') }));
    assert.equal(unknown.body.outcome, 'notice_ambiguous');
    assert.equal(unknown.body.notices[0].delivery, 'unknown');
    assert.equal(unknown.body.duplicatePossible, true);
    assert.equal(unknown.body.exactlyOnceMail, false);
    stored = await stateOf(unknownState);
    const unknownSeen = seenUrls(stored, 'acxiom');
    assert.equal(unknownSeen.includes(unknown.body.notices[0].url), false);

    const dropState = path.join(work, 'drop.json');
    mode = 'accept';
    await run(args({ ...common, state: dropState, seed: path.join(fixtures, 'acxiom-baseline.seed.json') }));
    mode = 'drop';
    const before = sink.received.length;
    const dropped = await run(args({ ...common, state: dropState, seed: path.join(fixtures, 'acxiom-new.seed.json') }));
    assert.equal(dropped.body.notices[0].delivery, 'ambiguous');
    assert.equal(dropped.body.exactlyOnce, false);
    mode = 'accept';
    const retried = await run(args({ ...common, state: dropState, seed: path.join(fixtures, 'acxiom-new.seed.json') }));
    assert.equal(retried.body.notices[0].delivery, 'accepted');
    const dropPosts = sink.received.slice(before).filter((item) => item.body.title === 'Account Executive, New Role');
    assert.equal(dropPosts.length, 2);

    const redirectState = path.join(work, 'redirect.json');
    mode = 'accept';
    await run(args({ ...common, state: redirectState, seed: path.join(fixtures, 'acxiom-baseline.seed.json') }));
    mode = 'redirect';
    const beforeRedirect = sink.received.length;
    const redirected = await run(args({ ...common, state: redirectState, seed: path.join(fixtures, 'acxiom-new.seed.json') }));
    assert.equal(redirected.body.notices[0].delivery, 'not_followed');
    assert.equal(sink.received.length, beforeRedirect + 1);
    stored = await stateOf(redirectState);
    assert.equal(seenUrls(stored, 'acxiom').includes(redirected.body.notices[0].url), false);
    evidence.push({
      case: 'delivery',
      rejectedThenAccepted: true,
      unknown: unknown.body.notices[0].delivery,
      ambiguous: dropped.body.notices[0].delivery,
      droppedRetryPosts: dropPosts.length,
      redirect: redirected.body.notices[0].delivery,
      exactlyOnce: false,
      exactlyOnceMail: false,
    });
  } finally {
    await sink.close();
  }
});

test('killing the process before the sink answers keeps the baseline and allows one later notice', async () => {
  let release;
  const opened = new Promise((resolve) => { release = resolve; });
  const sink = await startSink((req, res, body) => {
    release();
    setTimeout(() => {
      if (res.destroyed || res.writableEnded) return;
      accept(req, res, body);
    }, 5000);
  });
  const state = path.join(work, 'kill.json');
  try {
    const baseline = await run(args({
      sink: sink.url, state, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
      phrases: ['account executive'],
    }));
    assert.equal(baseline.body.outcome, 'baseline');
    const child = spawn(process.execPath, [journeyBin, ...args({
      sink: sink.url, state, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-new.seed.json'),
      phrases: ['account executive'],
    })], { stdio: ['ignore', 'pipe', 'pipe'] });
    await opened;
    child.kill('SIGKILL');
    const exit = await new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
    assert.equal(exit.signal, 'SIGKILL');
    const stored = await stateOf(state);
    assert.equal(stored.journeys[Object.keys(stored.journeys)[0]].seen.length, 2);
    await sink.close();
    const next = await startSink(accept);
    try {
      const recovered = await run(args({
        sink: next.url, state, board: 'acxiom',
        seed: path.join(fixtures, 'acxiom-new.seed.json'),
        phrases: ['account executive'],
      }));
      assert.equal(recovered.body.outcome, 'notice');
      assert.equal(recovered.body.notices.length, 1);
      assert.equal(next.received.length, 1);
      evidence.push({ case: 'kill-restart', signal: exit.signal, recoveredNotices: 1 });
    } finally {
      await next.close();
    }
  } finally {
    await sink.close();
  }
});

test('another board and an OR phrase keep the first seen set', async () => {
  const started = Date.now();
  const sink = await startSink(accept);
  const state = path.join(work, 'adapt.json');
  try {
    const first = await run(args({
      sink: sink.url, state, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
      phrases: ['account executive', 'zebra keeper'],
    }));
    assert.equal(first.body.outcome, 'baseline');
    assert.equal(first.body.notices.length, 0);
    const acxiomSeen = seenUrls(await stateOf(state), 'acxiom');
    const other = await run(args({
      sink: sink.url, state, board: 'liveramp',
      seed: path.join(fixtures, 'liveramp-one.seed.json'),
      phrases: ['account executive'],
      timeoutMs: 15000,
    }));
    assert.equal(other.code, 0, other.text);
    assert.equal(other.body.outcome, 'baseline');
    assert.equal(other.body.board, 'liveramp');
    assert.equal(other.body.notices.length, 0);
    assert.deepEqual(seenUrls(await stateOf(state), 'acxiom'), acxiomSeen);
    const phrase = await run(args({
      sink: sink.url, state, board: 'acxiom',
      seed: path.join(fixtures, 'acxiom-or-new.seed.json'),
      phrases: ['account executive', 'zebra keeper'],
    }));
    assert.equal(phrase.body.outcome, 'notice');
    assert.equal(phrase.body.notices.length, 1);
    assert.equal(phrase.body.notices[0].title, 'Zebra Keeper');
    const beforeMagnite = seenUrls(await stateOf(state), 'acxiom').slice();
    assert.equal(beforeMagnite.length > acxiomSeen.length, true);
    const magnite = await run(args({
      sink: sink.url, state, board: 'magnite',
      seed: path.join(fixtures, 'magnite-one.seed.json'),
      phrases: ['account executive'],
      timeoutMs: 30000,
    }));
    assert.equal(magnite.code, 0, magnite.text);
    assert.equal(magnite.body.outcome, 'baseline');
    assert.equal(magnite.body.board, 'magnite');
    assert.equal(magnite.body.notices.length, 0);
    assert.equal(magnite.text.includes('super-secret-token-value'), false);
    assert.deepEqual(seenUrls(await stateOf(state), 'acxiom'), beforeMagnite);
    evidence.push({ case: 'adapt', ms: Date.now() - started, boards: ['acxiom', 'liveramp', 'magnite'] });
  } finally {
    await sink.close();
  }
});

test('the packaged skill and plugin bytes stay unchanged', async () => {
  assert.equal(await treeHash('skills/public-careers-board'), skillBefore);
  assert.equal(await treeHash('plugins/public-careers-board'), pluginBefore);
  const diff = spawnSync('git', ['diff', '--exit-code', '--', 'skills/public-careers-board', 'plugins/public-careers-board'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(diff.status, 0, diff.stdout + diff.stderr);
  const pins = JSON.parse(await readFile(path.join(skillSource, 'references/pins.json'), 'utf8'));
  assert.equal(pins.revision, '7d01bfb09c530430933dec1f07c5c0b8517cffa8');
  for (const file of pins.files) {
    const bytes = await readFile(path.join(skillSource, file.path));
    assert.equal(sha256(bytes), file.sha256, file.path);
    assert.equal(bytes.length, file.bytes, file.path);
  }
});

test('writes the direct-route evidence', async () => {
  await mkdir(path.join(packageRoot, 'evidence'), { recursive: true });
  const body = {
    schema: 'board-notice.direct-evidence.v1',
    node: process.version,
    cases: evidence,
  };
  await writeFile(path.join(packageRoot, 'evidence/direct-journey.json'), `${JSON.stringify(body, null, 2)}\n`);
  assert.equal(evidence.length >= 6, true);
});

after(async () => {
  await rm(skill, { recursive: true, force: true });
  await rm(work, { recursive: true, force: true });
});
