import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withStateOwner } from '../lib/state.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const repoRoot = path.resolve(packageRoot, '../..');
const journeyBin = path.join(packageRoot, 'bin/journey.mjs');
const runnerBin = path.join(packageRoot, 'bin/loopback-runner.mjs');
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

function startRun(runArgs) {
  const child = spawn(process.execPath, [journeyBin, ...runArgs], { stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      const text = Buffer.concat(stdout).toString('utf8');
      let body = null;
      try { body = JSON.parse(text); } catch { body = null; }
      resolve({ code, body, text, stderr: Buffer.concat(stderr).toString('utf8'), pid: child.pid });
    });
  });
  return { pid: child.pid, child, done };
}

async function absent(file) {
  try {
    await readFile(file);
    return false;
  } catch (error) {
    return error?.code === 'ENOENT';
  }
}

function postJson(url, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { parsed = null; }
        resolve({ status: res.statusCode, body: parsed, text });
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

function startRunner() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [runnerBin], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('runner_silent'));
    }, 5000);
    child.stderr.on('data', () => {});
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      const line = buf.split('\n')[0];
      if (!line) return;
      clearTimeout(timer);
      try {
        const info = JSON.parse(line);
        resolve({
          url: info.url,
          async close() {
            if (child.exitCode !== null || child.signalCode !== null) return;
            child.kill('SIGTERM');
            await new Promise((done) => child.on('close', done));
          },
        });
      } catch (error) {
        child.kill('SIGKILL');
        reject(error);
      }
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function installControlledChild(logFile) {
  const dest = await copySkill();
  const body = `import { writeFileSync } from 'node:fs';
const argv = process.argv.slice(1);
writeFileSync(${JSON.stringify(logFile)}, JSON.stringify(argv));
const seeded = argv.includes('--seed');
process.stdout.write(JSON.stringify({
  schema: 'public-careers-board.result.v1',
  result: 'observation',
  reason: 'complete_controlled',
  board: 'acxiom',
  reader: 'controlled-child',
  sourceCoverage: 'controlled_child',
  seeded,
  rows: [{ url: 'https://jobs.example.invalid/controlled/1', title: 'Account Executive, Controlled', location: null }],
  coverage: { status: 'complete_controlled', duplicateCount: 0, requests: [{ url: 'controlled://offline' }] },
  boardClaim: 'complete',
  emptyBoard: false,
  complete: true,
}) + '\\n');
`;
  await writeFile(path.join(dest, 'scripts/cli.mjs'), body);
  return dest;
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

test('omitting --seed reaches the child reader, and a present or invalid seed stays explicit', async () => {
  const logFile = path.join(work, 'controlled-argv.json');
  const stub = await installControlledChild(logFile);
  const sink = 'http://127.0.0.1:9/notice';
  const phrase = ['--phrase', 'account executive'];
  try {
    const absentState = path.join(work, 'noseed.json');
    const absentRun = await run([
      '--skill', stub, '--board', 'acxiom', '--state', absentState, '--sink', sink, ...phrase,
    ]);
    assert.equal(absentRun.code, 0, absentRun.text + absentRun.stderr);
    assert.equal(absentRun.body.outcome, 'baseline');
    assert.equal(absentRun.body.notices.length, 0);
    assert.equal(absentRun.body.seeded, false);
    assert.equal(absentRun.body.sourceCoverage, 'controlled_child');
    assert.equal(absentRun.body.requestCount, 1);
    const absentArgv = JSON.parse(await readFile(logFile, 'utf8'));
    assert.equal(absentArgv.includes('--seed'), false);
    assert.equal(absentArgv.includes('--board'), true);

    const seed = path.join(fixtures, 'acxiom-empty.seed.json');
    await rm(logFile, { force: true });
    const presentState = path.join(work, 'present-seed.json');
    const presentRun = await run([
      '--skill', stub, '--board', 'acxiom', '--seed', seed, '--state', presentState, '--sink', sink, ...phrase,
    ]);
    assert.equal(presentRun.code, 0, presentRun.text + presentRun.stderr);
    assert.equal(presentRun.body.seeded, true);
    assert.equal(presentRun.body.sourceCoverage, 'controlled_child');
    const presentArgv = JSON.parse(await readFile(logFile, 'utf8'));
    assert.equal(presentArgv[presentArgv.indexOf('--seed') + 1], path.resolve(seed));

    await rm(logFile, { force: true });
    const missingSeed = path.join(work, 'missing-seed.json');
    const missingState = path.join(work, 'missing-seed-state.json');
    const missingRun = await run([
      '--skill', stub, '--board', 'acxiom', '--seed', missingSeed, '--state', missingState, '--sink', sink, ...phrase,
    ]);
    assert.equal(missingRun.code, 2);
    assert.equal(missingRun.body.reason, 'seed_rejected');
    assert.equal(await absent(logFile), true);
    assert.equal(await absent(missingState), true);
    assert.equal(await absent(`${missingState}.lock`), true);

    const bareState = path.join(work, 'bare-seed-state.json');
    const bareRun = await run([
      '--skill', stub, '--board', 'acxiom', '--state', bareState, '--sink', sink, ...phrase, '--seed',
    ]);
    assert.equal(bareRun.code, 2);
    assert.equal(bareRun.body.reason, 'seed_rejected');
    assert.equal(await absent(logFile), true);
    assert.equal(await absent(bareState), true);

    const flagState = path.join(work, 'flag-seed-state.json');
    const flagRun = await run([
      '--skill', stub, '--board', 'acxiom', '--state', flagState, '--sink', sink, '--timeout-ms', '15000', ...phrase, '--seed', '--phrase',
    ]);
    assert.equal(flagRun.code, 2);
    assert.equal(flagRun.body.reason, 'seed_rejected');
    assert.equal(await absent(logFile), true);
    assert.equal(await absent(flagState), true);
    evidence.push({
      case: 'no-seed-argv',
      scope: 'controlled-child-argv',
      liveGet: false,
      absentSeed: absentArgv.includes('--seed') === false && absentRun.body.seeded === false,
      presentSeed: presentRun.body.seeded === true,
      invalidSeedRejected: true,
      childSpawnedForInvalidSeed: false,
    });
  } finally {
    await rm(stub, { recursive: true, force: true });
  }
});

test('the loopback runner treats seed as an optional job field', async () => {
  const logFile = path.join(work, 'runner-argv.json');
  const stub = await installControlledChild(logFile);
  const runner = await startRunner();
  const sink = 'http://127.0.0.1:9/notice';
  try {
    const noSeedState = path.join(work, 'runner-noseed.json');
    const noSeed = await postJson(runner.url, {
      skill: stub,
      board: 'acxiom',
      phrases: ['account executive'],
      state: noSeedState,
      sink,
    });
    assert.equal(noSeed.status, 200, noSeed.text);
    assert.equal(noSeed.body.runnerExit, 0);
    assert.equal(noSeed.body.journey.outcome, 'baseline');
    assert.equal(noSeed.body.journey.seeded, false);
    assert.equal(noSeed.body.journey.sourceCoverage, 'controlled_child');
    const noSeedArgv = JSON.parse(await readFile(logFile, 'utf8'));
    assert.equal(noSeedArgv.includes('--seed'), false);

    await rm(logFile, { force: true });
    const seed = path.join(fixtures, 'acxiom-empty.seed.json');
    const withSeed = await postJson(runner.url, {
      skill: stub,
      board: 'acxiom',
      phrases: ['account executive'],
      seed,
      state: path.join(work, 'runner-seed.json'),
      sink,
    });
    assert.equal(withSeed.body.runnerExit, 0, withSeed.text);
    assert.equal(withSeed.body.journey.seeded, true);
    const withSeedArgv = JSON.parse(await readFile(logFile, 'utf8'));
    assert.equal(withSeedArgv[withSeedArgv.indexOf('--seed') + 1], path.resolve(seed));

    await rm(logFile, { force: true });
    const rejected = await postJson(runner.url, {
      skill: stub,
      board: 'acxiom',
      phrases: ['account executive'],
      seed: path.join(work, 'runner-missing-seed.json'),
      state: path.join(work, 'runner-rejected.json'),
      sink,
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.runnerExit, 2);
    assert.equal(rejected.body.journey.reason, 'seed_rejected');
    assert.equal(await absent(logFile), true);
    assert.equal(await absent(path.join(work, 'runner-rejected.json')), true);

    const shaped = await postJson(runner.url, {
      skill: stub,
      board: 'acxiom',
      phrases: ['account executive'],
      seed: '',
      state: path.join(work, 'runner-empty-seed.json'),
      sink,
    });
    assert.equal(shaped.status, 400);
    assert.equal(shaped.body.reason, 'job_shape');
    const omitted = await postJson(runner.url, {
      skill: stub,
      board: 'acxiom',
      phrases: ['account executive'],
      sink,
    });
    assert.equal(omitted.status, 400);
    assert.equal(omitted.body.reason, 'job_shape');
    assert.equal(await absent(logFile), true);
    evidence.push({
      case: 'runner-seed',
      scope: 'controlled-child-argv',
      liveGet: false,
      absentSeed: noSeedArgv.includes('--seed') === false,
      presentSeed: withSeed.body.journey.seeded === true,
      invalidSeedRejected: rejected.body.journey.reason === 'seed_rejected',
      emptySeedShape: shaped.status === 400,
    });
  } finally {
    await runner.close();
    await rm(stub, { recursive: true, force: true });
  }
});

test('a cut-off 200 body is not accepted and response reads stay bounded', async () => {
  let mode = 'accept';
  const sink = await startSink((req, res, body) => {
    req.on('error', () => {});
    res.on('error', () => {});
    if (mode === 'partial') {
      res.writeHead(200, { 'content-type': 'application/json' });
      const full = JSON.stringify({ delivery: 'accepted', noticeId: body.url });
      res.write(full.slice(0, -1));
      res.destroy();
      return;
    }
    if (mode === 'stall') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('{');
      return;
    }
    if (mode === 'huge') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write(`x`.repeat(70000));
      res.end();
      return;
    }
    accept(req, res, body);
  });
  try {
    const partialState = path.join(work, 'partial-body.json');
    const partialCommon = { sink: sink.url, state: partialState, board: 'acxiom', phrases: ['account executive'] };
    const baseline = await run(args({ ...partialCommon, seed: path.join(fixtures, 'acxiom-baseline.seed.json') }));
    assert.equal(baseline.body.outcome, 'baseline');
    mode = 'partial';
    const partial = await run(args({ ...partialCommon, seed: path.join(fixtures, 'acxiom-new.seed.json') }));
    assert.equal(partial.code, 0, partial.text + partial.stderr);
    assert.equal(partial.body.notices.length, 1);
    assert.equal(partial.body.notices[0].delivery, 'ambiguous');
    assert.notEqual(partial.body.notices[0].delivery, 'accepted');
    assert.equal(partial.body.exactlyOnce, false);
    const partialUrl = partial.body.notices[0].url;
    let stored = await stateOf(partialState);
    assert.equal(seenUrls(stored, 'acxiom').includes(partialUrl), false);
    assert.equal(stored.journeys[Object.keys(stored.journeys)[0]].pending.some((item) => item.url === partialUrl), true);
    mode = 'accept';
    const retried = await run(args({ ...partialCommon, seed: path.join(fixtures, 'acxiom-new.seed.json') }));
    assert.equal(retried.body.notices[0].delivery, 'accepted');
    stored = await stateOf(partialState);
    assert.equal(seenUrls(stored, 'acxiom').includes(partialUrl), true);
    const partialPosts = sink.received.filter((item) => item.body.title === 'Account Executive, New Role');
    assert.equal(partialPosts.length, 2);

    const stallState = path.join(work, 'stall.json');
    mode = 'accept';
    await run(args({
      sink: sink.url, state: stallState, board: 'acxiom', phrases: ['account executive'],
      seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
    }));
    mode = 'stall';
    const stallStarted = Date.now();
    const stalled = await run(args({
      sink: sink.url, state: stallState, board: 'acxiom', phrases: ['account executive'],
      seed: path.join(fixtures, 'acxiom-new.seed.json'), timeoutMs: 400,
    }));
    const stallMs = Date.now() - stallStarted;
    assert.equal(stalled.code, 0, stalled.text + stalled.stderr);
    assert.equal(stalled.body.notices[0].delivery, 'ambiguous');
    assert.equal(stalled.body.notices[0].reason, 'timeout');
    assert.equal(stallMs < 3000, true, `deadline took ${stallMs}ms`);
    assert.equal(seenUrls(await stateOf(stallState), 'acxiom').includes(stalled.body.notices[0].url), false);

    const hugeState = path.join(work, 'huge.json');
    mode = 'accept';
    await run(args({
      sink: sink.url, state: hugeState, board: 'acxiom', phrases: ['account executive'],
      seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
    }));
    mode = 'huge';
    const huge = await run(args({
      sink: sink.url, state: hugeState, board: 'acxiom', phrases: ['account executive'],
      seed: path.join(fixtures, 'acxiom-new.seed.json'),
    }));
    assert.equal(huge.code, 0, huge.text + huge.stderr);
    assert.equal(huge.body.notices[0].delivery, 'ambiguous');
    assert.equal(huge.body.notices[0].reason, 'response_limited');
    assert.notEqual(huge.body.notices[0].delivery, 'accepted');
    assert.equal(seenUrls(await stateOf(hugeState), 'acxiom').includes(huge.body.notices[0].url), false);
    evidence.push({
      case: 'partial-response',
      partial: partial.body.notices[0].delivery,
      partialReason: partial.body.notices[0].reason,
      retryAccepted: true,
      retryPosts: partialPosts.length,
      deadline: stalled.body.notices[0].reason,
      deadlineMs: stallMs,
      limited: huge.body.notices[0].reason,
      acceptedFromPartial: false,
    });
  } finally {
    await sink.close();
  }
});

function ownerScript(stateFile, entered, release, out) {
  return `
import { readFile, writeFile } from 'node:fs/promises';
import { withStateOwner } from ${JSON.stringify(path.join(packageRoot, 'lib/state.mjs'))};
const entered = ${JSON.stringify(entered)};
const release = ${JSON.stringify(release)};
const out = ${JSON.stringify(out)};
try {
  let did = false;
  const owned = await withStateOwner(${JSON.stringify(stateFile)}, async () => {
    did = true;
    await writeFile(entered, String(process.pid));
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      try { await readFile(release); break; }
      catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    return 'held';
  });
  await writeFile(out, JSON.stringify({ busy: owned.busy, entered: did }));
} catch (error) {
  await writeFile(out, JSON.stringify({ busy: null, entered: false, error: String(error && error.stack || error) }));
}
`;
}

function spawnOwner(stateFile, dir, id, steps) {
  const entered = path.join(dir, `${id}-entered`);
  const release = path.join(dir, `${id}-release`);
  const out = path.join(dir, `${id}-out`);
  const env = { ...process.env };
  if (steps) {
    env.H98310_LOCK_BARRIER = dir;
    env.H98310_LOCK_BARRIER_STEPS = steps;
  } else {
    delete env.H98310_LOCK_BARRIER;
    delete env.H98310_LOCK_BARRIER_STEPS;
  }
  const child = spawn(process.execPath, ['--input-type=module', '-'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
  const stderr = [];
  child.stderr.on('data', (chunk) => stderr.push(chunk));
  child.stdout.on('data', () => {});
  child.stdin.end(ownerScript(stateFile, entered, release, out));
  return { child, entered, release, out, stderr };
}

async function waitFor(file, ms = 4000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { return await readFile(file, 'utf8'); }
    catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  throw new Error(`timeout ${file}`);
}

function stopOwner(owner) {
  if (!owner) return;
  try { owner.child.kill('SIGKILL'); } catch { /* already exited */ }
}

test('overlapping callers on one state file get busy, and separate files do not', async () => {
  let opened;
  const arrived = new Promise((resolve) => { opened = resolve; });
  const sink = await startSink((req, res, body) => {
    opened({ res, body });
  });
  let first;
  let foreignHeld;
  try {
    const state = path.join(work, 'overlap.json');
    const baseline = await run(args({
      sink: sink.url, state, board: 'acxiom', phrases: ['account executive'],
      seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
    }));
    assert.equal(baseline.body.outcome, 'baseline');
    const stored = await stateOf(state);
    const key = Object.keys(stored.journeys)[0];
    stored.journeys[key].pending.push({ url: 'https://jobs.example.invalid/pending-kept', delivery: 'ambiguous', status: null });
    stored.journeys[key].seen.push('https://jobs.example.invalid/seen-kept');
    stored.journeys.kept = {
      board: 'magnite',
      phrases: ['kept phrase'],
      baselined: true,
      seen: ['https://jobs.example.invalid/foreign-seen'],
      pending: [{ url: 'https://jobs.example.invalid/foreign-pending', delivery: 'rejected', status: 500 }],
    };
    await writeFile(state, `${JSON.stringify(stored)}\n`);
    const snapshot = await readFile(state, 'utf8');
    first = startRun(args({
      sink: sink.url, state, board: 'acxiom', phrases: ['account executive'],
      seed: path.join(fixtures, 'acxiom-new.seed.json'),
    }));
    const arrival = await Promise.race([
      arrived,
      new Promise((_, reject) => setTimeout(() => reject(new Error('notice_not_started')), 5000)),
    ]);
    const lock = JSON.parse(await readFile(`${state}.lock`, 'utf8'));
    assert.equal(lock.schema, 'board-notice.lock.v1');
    assert.equal(lock.pid, first.pid);
    const duplicateStarted = Date.now();
    const duplicate = await run(args({
      sink: sink.url, state, board: 'acxiom', phrases: ['account executive'],
      seed: path.join(fixtures, 'acxiom-new.seed.json'),
    }));
    const duplicateMs = Date.now() - duplicateStarted;
    assert.equal(duplicate.code, 0, duplicate.text + duplicate.stderr);
    assert.equal(duplicate.body.outcome, 'busy');
    assert.equal(duplicate.body.reason, 'state_busy');
    assert.equal(duplicate.body.notices.length, 0);
    assert.equal(duplicate.body.stateChanged, false);
    assert.equal(duplicateMs < 2000, true, `duplicate waited ${duplicateMs}ms`);
    const other = await run(args({
      sink: sink.url, state, board: 'liveramp', phrases: ['account executive'],
      seed: path.join(fixtures, 'liveramp-one.seed.json'),
    }));
    assert.equal(other.body.outcome, 'busy');
    assert.equal(other.body.reason, 'state_busy');
    assert.equal(sink.received.length, 1);
    assert.equal(await readFile(state, 'utf8'), snapshot);
    const lockAfter = JSON.parse(await readFile(`${state}.lock`, 'utf8'));
    assert.equal(lockAfter.pid, first.pid);
    assert.equal(lockAfter.token, lock.token);
    accept(null, arrival.res, arrival.body);
    const finished = await first.done;
    assert.equal(finished.body.outcome, 'notice', finished.text + finished.stderr);
    assert.equal(finished.body.notices[0].delivery, 'accepted');
    const releasedNames = await readdir(work);
    assert.equal(releasedNames.some((name) => name.includes('.stale-') || name.includes('.release-')), false);
    const releasedLock = JSON.parse(await readFile(`${state}.lock`, 'utf8'));
    assert.equal(releasedLock.mechanism, 'flock');
    const after = await stateOf(state);
    assert.deepEqual(after.journeys.kept, stored.journeys.kept);
    assert.equal(after.journeys[key].seen.includes('https://jobs.example.invalid/seen-kept'), true);
    assert.equal(after.journeys[key].pending.some((item) => item.url === 'https://jobs.example.invalid/pending-kept'), true);
    assert.equal(after.journeys[key].seen.includes(finished.body.notices[0].url), true);
    assert.equal(Object.values(after.journeys).some((item) => item.board === 'liveramp'), false);

    const foreignState = path.join(work, 'foreign.json');
    const foreignDir = path.join(work, 'foreign-holder');
    await mkdir(foreignDir);
    foreignHeld = spawnOwner(foreignState, foreignDir, 'holder');
    const holderPid = Number(await waitFor(foreignHeld.entered));
    const foreign = await run(args({
      sink: sink.url, state: foreignState, board: 'acxiom', phrases: ['account executive'],
      seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
    }));
    assert.equal(foreign.body.outcome, 'busy', foreign.text + foreign.stderr);
    assert.equal(foreign.body.reason, 'state_busy');
    assert.equal(await absent(foreignState), true);
    const foreignLock = JSON.parse(await readFile(`${foreignState}.lock`, 'utf8'));
    assert.equal(foreignLock.pid, holderPid);
    assert.equal(foreignLock.mechanism, 'flock');
    process.kill(holderPid, 0);
    await writeFile(foreignHeld.release, '1');

    const ended = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    assert.equal(ended.status, 0);
    let deadAlive = true;
    try { process.kill(ended.pid, 0); } catch (error) { deadAlive = error?.code !== 'ESRCH'; }
    assert.equal(deadAlive, false);
    const deadState = path.join(work, 'dead.json');
    await writeFile(`${deadState}.lock`, `${JSON.stringify({
      schema: 'board-notice.lock.v1',
      pid: ended.pid,
      token: 'dead-token-0123456789abcdef',
      createdAt: new Date().toISOString(),
    })}\n`);
    const recovered = await run(args({
      sink: sink.url, state: deadState, board: 'acxiom', phrases: ['account executive'],
      seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
    }));
    assert.equal(recovered.code, 0, recovered.text + recovered.stderr);
    assert.equal(recovered.body.outcome, 'baseline');
    assert.equal(recovered.body.notices.length, 0);
    const names = await readdir(work);
    assert.equal(names.some((name) => name.includes('.stale-') || name.includes('.release-')), false);
    const deadLock = JSON.parse(await readFile(`${deadState}.lock`, 'utf8'));
    assert.equal(deadLock.mechanism, 'flock');
    assert.notEqual(deadLock.pid, ended.pid);

    const leftState = path.join(work, 'independent-a.json');
    const rightState = path.join(work, 'independent-b.json');
    const [left, right] = await Promise.all([
      run(args({
        sink: sink.url, state: leftState, board: 'acxiom', phrases: ['account executive'],
        seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
      })),
      run(args({
        sink: sink.url, state: rightState, board: 'liveramp', phrases: ['account executive'],
        seed: path.join(fixtures, 'liveramp-one.seed.json'),
      })),
    ]);
    assert.equal(left.body.outcome, 'baseline', left.text);
    assert.equal(right.body.outcome, 'baseline', right.text);
    assert.equal(left.body.outcome === 'busy' || right.body.outcome === 'busy', false);
    assert.equal(seenUrls(await stateOf(leftState), 'liveramp'), null);
    assert.equal(seenUrls(await stateOf(rightState), 'acxiom'), null);
    assert.equal(seenUrls(await stateOf(leftState), 'acxiom').length, 2);
    evidence.push({
      case: 'state-overlap',
      duplicate: 'busy',
      duplicateMs,
      otherBoardWhileHeld: 'busy',
      foreignLiveStolen: false,
      deadOwnerRecovered: recovered.body.outcome === 'baseline',
      independentBusy: false,
      preservedForeignJourney: true,
    });
  } finally {
    if (foreignHeld) {
      try { await writeFile(foreignHeld.release, '1'); } catch { /* holder already left */ }
      stopOwner(foreignHeld);
    }
    if (first && first.child.exitCode === null && first.child.signalCode === null) first.child.kill('SIGKILL');
    await sink.close();
  }
});

test('a paused initializer and two stale recoverers cannot both own one lock', async () => {
  const dir = path.join(work, 'barriers');
  await mkdir(dir);
  const initState = path.join(dir, 'init.json');
  const init = spawnOwner(initState, dir, 'init', 'held-before-body');
  let paused;
  let staleA;
  let staleB;
  try {
    await waitFor(path.join(dir, `${init.child.pid}.held-before-body.ready`));
    const initLock = `${initState}.lock`;
    const initInode = (await stat(initLock)).ino;
    let contenderEntered = false;
    const contenderStarted = Date.now();
    const contender = await withStateOwner(initState, async () => { contenderEntered = true; });
    const contenderMs = Date.now() - contenderStarted;
    assert.equal(contender.busy, true);
    assert.equal(contenderEntered, false);
    assert.equal(contenderMs < 1000, true, `contender waited ${contenderMs}ms`);
    assert.equal((await stat(initLock)).ino, initInode);
    assert.equal(await absent(init.entered), true);
    await writeFile(path.join(dir, `${init.child.pid}.held-before-body.go`), '');
    await waitFor(init.entered);
    await writeFile(init.release, '1');
    const initResult = JSON.parse(await waitFor(init.out));
    assert.equal(initResult.busy, false, JSON.stringify(initResult) + Buffer.concat(init.stderr).toString('utf8'));
    assert.equal(initResult.entered, true);
    assert.equal(contenderEntered, false);

    const pausedState = path.join(dir, 'paused-dead.json');
    const pausedEnded = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    await writeFile(`${pausedState}.lock`, `${JSON.stringify({
      schema: 'board-notice.lock.v1',
      pid: pausedEnded.pid,
      token: 'paused-dead-token-0123456789',
      mechanism: 'flock',
      createdAt: new Date().toISOString(),
    })}\n`);
    paused = spawnOwner(pausedState, dir, 'paused', 'held-before-body');
    await waitFor(path.join(dir, `${paused.child.pid}.held-before-body.ready`));
    const pausedInode = (await stat(`${pausedState}.lock`)).ino;
    const pausedBody = await readFile(`${pausedState}.lock`, 'utf8');
    assert.equal(JSON.parse(pausedBody).pid, pausedEnded.pid);
    let pausedContenderEntered = false;
    const pausedContender = await withStateOwner(pausedState, async () => { pausedContenderEntered = true; });
    assert.equal(pausedContender.busy, true);
    assert.equal(pausedContenderEntered, false);
    assert.equal((await stat(`${pausedState}.lock`)).ino, pausedInode);
    assert.equal(JSON.parse(await readFile(`${pausedState}.lock`, 'utf8')).token, 'paused-dead-token-0123456789');
    await writeFile(path.join(dir, `${paused.child.pid}.held-before-body.go`), '');
    await waitFor(paused.entered);
    await writeFile(paused.release, '1');
    const pausedResult = JSON.parse(await waitFor(paused.out));
    assert.equal(pausedResult.busy, false, JSON.stringify(pausedResult) + Buffer.concat(paused.stderr).toString('utf8'));
    assert.equal(pausedResult.entered, true);
    assert.equal(pausedContenderEntered, false);

    const staleState = path.join(dir, 'stale.json');
    const ended = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    await writeFile(`${staleState}.lock`, `${JSON.stringify({
      schema: 'board-notice.lock.v1',
      pid: ended.pid,
      token: 'stale-token-0123456789abcdef',
      mechanism: 'flock',
      createdAt: new Date().toISOString(),
    })}\n`);
    const staleInode = (await stat(`${staleState}.lock`)).ino;
    staleA = spawnOwner(staleState, dir, 'stale-a', 'before-flock');
    staleB = spawnOwner(staleState, dir, 'stale-b', 'before-flock');
    await waitFor(path.join(dir, `${staleA.child.pid}.before-flock.ready`));
    await waitFor(path.join(dir, `${staleB.child.pid}.before-flock.ready`));
    await writeFile(path.join(dir, `${staleB.child.pid}.before-flock.go`), '');
    const winnerPid = Number(await waitFor(staleB.entered));
    const winnerLock = JSON.parse(await readFile(`${staleState}.lock`, 'utf8'));
    assert.equal(winnerLock.pid, winnerPid);
    assert.equal(winnerLock.mechanism, 'flock');
    assert.equal((await stat(`${staleState}.lock`)).ino, staleInode);
    await writeFile(path.join(dir, `${staleA.child.pid}.before-flock.go`), '');
    const loser = JSON.parse(await waitFor(staleA.out));
    assert.equal(loser.busy, true, JSON.stringify(loser) + Buffer.concat(staleA.stderr).toString('utf8'));
    assert.equal(loser.entered, false);
    assert.equal((await stat(`${staleState}.lock`)).ino, staleInode);
    const afterLoser = JSON.parse(await readFile(`${staleState}.lock`, 'utf8'));
    assert.equal(afterLoser.token, winnerLock.token);
    assert.equal(await absent(staleA.entered), true);
    const barrierNames = await readdir(dir);
    assert.equal(barrierNames.some((name) => name.includes('.stale-') || name.includes('.release-')), false);
    await writeFile(staleB.release, '1');
    const winner = JSON.parse(await waitFor(staleB.out));
    assert.equal(winner.busy, false, JSON.stringify(winner));
    assert.equal(winner.entered, true);
    evidence.push({
      case: 'lock-barrier',
      mechanism: 'flock',
      incompleteInitBusy: true,
      incompleteInitMs: contenderMs,
      deadBodyInitializerKept: true,
      initializerEntered: true,
      inodeKept: true,
      staleLoserBusy: true,
      staleWinnerEntered: true,
      replacementOverwritten: false,
    });
  } finally {
    stopOwner(init);
    stopOwner(paused);
    stopOwner(staleA);
    stopOwner(staleB);
  }
});

test('writes the direct-route evidence', async () => {
  await mkdir(path.join(packageRoot, 'evidence'), { recursive: true });
  const body = {
    schema: 'board-notice.direct-lock.v1',
    amends: 'evidence/direct-journey-amendment.json',
    node: process.version,
    mechanism: 'flock',
    cases: evidence,
  };
  await writeFile(path.join(packageRoot, 'evidence/direct-journey-lock.json'), `${JSON.stringify(body, null, 2)}\n`);
  assert.equal(evidence.length >= 6, true);
});

after(async () => {
  await rm(skill, { recursive: true, force: true });
  await rm(work, { recursive: true, force: true });
});
