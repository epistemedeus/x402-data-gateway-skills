import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink, lstat, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeSupported } from '../skills/public-careers-board/scripts/cli.mjs';

const repoSkill = fileURLToPath(new URL('../skills/public-careers-board/', import.meta.url));
const SEED = 'public-careers-board.supplied-seed.v1';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function installedCopy() {
  const dir = await mkdtemp(path.join(tmpdir(), 'careers-skill-'));
  const dest = path.join(dir, 'public-careers-board');
  await new Promise((resolve, reject) => {
    const child = spawn('cp', ['-a', repoSkill, dest], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error('cp failed'))));
  });
  return { dir, dest, cli: path.join(dest, 'scripts/cli.mjs') };
}

function run(cli, args, timeoutMs = 10000, extra = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...(extra.nodeArgs || []), cli, ...args], {
      cwd: path.dirname(path.dirname(cli)),
      env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', ...(extra.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let peakKb = 0;
    const sample = setInterval(() => {
      try {
        const text = readFileSyncStatus(child.pid);
        const match = /VmHWM:\s+(\d+)/.exec(text);
        if (match) peakKb = Math.max(peakKb, Number(match[1]));
      } catch { /* exited */ }
    }, 15);
    const stop = (signal) => { try { child.kill(signal); } catch { /* already gone */ } };
    const timer = setTimeout(() => stop('SIGTERM'), timeoutMs);
    const killer = setTimeout(() => stop('SIGKILL'), timeoutMs + 1000);
    const started = Date.now();
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code, signal) => {
      clearInterval(sample);
      clearTimeout(timer);
      clearTimeout(killer);
      let body = null;
      try { body = JSON.parse(stdout); } catch { /* refusal or crash */ }
      resolve({
        code, signal, stdout, stderr, body, pid: child.pid,
        ms: Date.now() - started, peakKb, stdoutBytes: Buffer.byteLength(stdout),
      });
    });
  });
}

function readFileSyncStatus(pid) {
  return readFileSync(`/proc/${pid}/status`, 'utf8');
}

async function writeSeed(dir, responses) {
  const file = path.join(dir, `seed-${Math.random().toString(16).slice(2)}.json`);
  await writeFile(file, JSON.stringify({ schema: SEED, responses }));
  return file;
}

const acxiomJob = { title: 'Acxiom Only Role', externalPath: '/job/A/Acxiom_1', locationsText: 'Remote' };
const acxiomPage = { httpStatus: 200, body: { total: 1, jobPostings: [acxiomJob] } };
const liverampJob = {
  title: 'LiveRamp Only Role',
  location: 'Remote',
  isListed: true,
  jobUrl: 'https://jobs.ashbyhq.com/liveramp-inc/role-1',
};

test('the command gate rejects runtimes below Node 22.22.2', () => {
  assert.equal(runtimeSupported('22.14.0'), false);
  assert.equal(runtimeSupported('22.22.1'), false);
  assert.equal(runtimeSupported('v22.22.1'), false);
  assert.equal(runtimeSupported('20.17.0'), false);
  assert.equal(runtimeSupported('22.22.2'), true);
  assert.equal(runtimeSupported(process.versions.node), true);
});

test('pinned recipe bytes stay the acquired free recipe', async () => {
  const pins = JSON.parse(await readFile(path.join(repoSkill, 'references/pins.json'), 'utf8'));
  assert.equal(pins.merchantCommit, '2fde825d6f6ede84ee3d959e5ccf0f99c35eca8c');
  assert.equal(pins.revision, '7d01bfb09c530430933dec1f07c5c0b8517cffa8');
  for (const item of pins.files) {
    const bytes = await readFile(path.join(repoSkill, item.path));
    assert.equal(bytes.length, item.bytes, item.path);
    assert.equal(sha256(bytes), item.sha256, item.path);
  }
});

test('installed copy classifies missing, unknown, and wrong source without a source read', async () => {
  const copy = await installedCopy();
  try {
    const missing = await run(copy.cli, ['run', '--seed', path.join(copy.dir, 'absent-seed.json')]);
    assert.equal(missing.code, 0);
    assert.equal(missing.body.result, 'missing_input');
    assert.equal(missing.body.rows, null);
    assert.equal(missing.body.paymentSent, false);
    assert.equal(missing.body.paidFallback, false);

    const unknown = await run(copy.cli, ['run', '--board', 'notion', '--seed', path.join(copy.dir, 'absent-seed.json')]);
    assert.equal(unknown.code, 0);
    assert.equal(unknown.body.result, 'unknown_board');
    assert.equal(unknown.body.coverage, null);

    const wrong = await run(copy.cli, ['run', '--board', 'liveramp', '--source', 'workday', '--seed', path.join(copy.dir, 'absent-seed.json')]);
    assert.equal(wrong.code, 0);
    assert.equal(wrong.body.result, 'wrong_source');
    assert.equal(wrong.body.source, null);
    assert.equal(wrong.body.paidFallback, false);

    const foreign = await run(copy.cli, ['run', '--board', 'acxiom', '--source', 'https://user:secret@evil.example/jobs']);
    assert.equal(foreign.code, 0);
    assert.equal(foreign.body.result, 'wrong_source');
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('installed copy keeps partial, empty, source failure, and complete distinct', async () => {
  const copy = await installedCopy();
  try {
    const failureSeed = await writeSeed(copy.dir, [{ httpStatus: 403, body: { errorCode: 'forbidden', message: 'no' } }]);
    const failure = await run(copy.cli, ['run', '--board', 'liveramp-inc', '--seed', failureSeed]);
    assert.equal(failure.code, 0, failure.stdout);
    assert.equal(failure.body.result, 'observation');
    assert.equal(failure.body.seeded, true);
    assert.equal(failure.body.sourceCoverage, 'supplied_seed');
    assert.equal(failure.body.reader, 'fetchAshby');
    assert.equal(failure.body.boardClaim, 'source_failure');
    assert.equal(failure.body.emptyBoard, false);
    assert.equal(failure.body.complete, false);
    assert.equal(failure.body.rows.length, 0);
    assert.equal(failure.body.coverage.emptyBoard, false);
    assert.equal(failure.body.useful, null);
    assert.equal(failure.body.paymentSent, false);
    assert.ok(failure.body.coverage.requests.every((entry) => entry.url.includes('api.ashbyhq.com')));

    const emptySeed = await writeSeed(copy.dir, [{ httpStatus: 200, body: { total: 0, jobPostings: [] } }]);
    const empty = await run(copy.cli, ['run', '--board', 'acxiomllc', '--seed', emptySeed]);
    assert.equal(empty.code, 0, empty.stdout);
    assert.equal(empty.body.reader, 'fetchAcxiom');
    assert.equal(empty.body.boardClaim, 'empty');
    assert.equal(empty.body.emptyBoard, true);
    assert.equal(empty.body.complete, false);
    assert.notEqual(empty.body.boardClaim, failure.body.boardClaim);

    const partialSeed = await writeSeed(copy.dir, [
      { httpStatus: 200, body: { total: 2, jobPostings: [acxiomJob] } },
      { httpStatus: 500, body: { message: 'later failed' } },
    ]);
    const partial = await run(copy.cli, ['run', '--board', 'acxiom', '--seed', partialSeed]);
    assert.equal(partial.code, 0, partial.stdout);
    assert.equal(partial.body.boardClaim, 'partial');
    assert.equal(partial.body.complete, false);
    assert.equal(partial.body.emptyBoard, false);
    assert.equal(partial.body.rows.length, 1);
    assert.equal(partial.body.rows[0].title, 'Acxiom Only Role');
    assert.equal(partial.body.coverage.remaining, 1);

    const completeSeed = await writeSeed(copy.dir, [acxiomPage, acxiomPage]);
    const complete = await run(copy.cli, ['run', '--board', 'acxiom', '--source', 'workday', '--seed', completeSeed]);
    assert.equal(complete.code, 0, complete.stdout);
    assert.equal(complete.body.boardClaim, 'complete');
    assert.equal(complete.body.complete, true);
    assert.equal(complete.body.coverage.status, 'complete_for_declared_total');

    const listedSeed = await writeSeed(copy.dir, [{ httpStatus: 200, body: { jobs: [liverampJob] } }]);
    const changed = await run(copy.cli, ['run', '--board', 'liverampashby', '--source', 'ashby', '--seed', listedSeed]);
    assert.equal(changed.code, 0, changed.stdout);
    assert.equal(changed.body.board, 'liveramp');
    assert.equal(changed.body.rows[0].title, 'LiveRamp Only Role');
    assert.notEqual(changed.body.rows[0].title, complete.body.rows[0].title);
    assert.equal(changed.body.coverage.status, 'complete_for_returned_listed_set');
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('installed copy refuses payment, tamper, overwrite, redirect following, timeout, and oversized reads', async () => {
  const copy = await installedCopy();
  try {
    const paid = await run(copy.cli, ['run', '--pay', '--board', 'liveramp']);
    assert.equal(paid.code, 2);
    assert.equal(paid.body.reason, 'payment_refused');
    assert.equal(paid.body.paidFallback, false);
    assert.equal(paid.body.paymentSent, false);
    assert.equal(paid.body.rows, null);

    const cliSource = await readFile(copy.cli, 'utf8');
    assert.equal(cliSource.includes('/data/careers-board'), false);
    assert.equal(cliSource.includes(repoSkill), false);

    const boards = path.join(copy.dest, 'recipe/boards.mjs');
    const original = await readFile(boards);
    const flipped = Buffer.from(original);
    flipped[flipped.length - 2] ^= 0x01;
    await writeFile(boards, flipped);
    const tampered = await run(copy.cli, ['run', '--board', 'liveramp']);
    assert.equal(tampered.code, 2);
    assert.equal(tampered.body.reason, 'tampered_source');
    assert.equal(tampered.body.rows, null);
    await writeFile(boards, original);

    const redirectSeed = await writeSeed(copy.dir, [{
      httpStatus: 302,
      headers: { location: 'https://evil.example/jobs' },
      raw: '',
    }]);
    const redirect = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', redirectSeed]);
    assert.equal(redirect.code, 0, redirect.stdout);
    assert.equal(redirect.body.boardClaim, 'source_failure');
    assert.equal(redirect.body.complete, false);
    assert.equal(redirect.body.emptyBoard, false);
    assert.equal(redirect.body.rows.length, 0);
    assert.ok(redirect.body.coverage.requests.every((entry) => !String(entry.url).includes('evil.example')));

    const huge = 'X'.repeat(4000);
    const hugeSeed = await writeSeed(copy.dir, [{
      httpStatus: 200,
      body: { jobs: [{ ...liverampJob, title: huge }] },
    }]);
    const oversizedOut = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', hugeSeed, '--output-bytes', '1024']);
    assert.equal(oversizedOut.code, 2, oversizedOut.stdout);
    assert.equal(oversizedOut.body.reason, 'oversized_output');
    assert.equal(oversizedOut.stdout.includes(huge.slice(0, 40)), false);

    const fatSeed = await writeSeed(copy.dir, [{ httpStatus: 200, padTo: 5000 }]);
    const oversized = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', fatSeed, '--max-bytes', '1024']);
    assert.equal(oversized.code, 2, oversized.stdout);
    assert.equal(oversized.body.reason, 'oversized_source');
    assert.equal(oversized.body.complete, undefined);
    assert.equal(oversized.body.rows, null);

    const hangSeed = await writeSeed(copy.dir, [{ hang: true }]);
    const timed = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', hangSeed, '--timeout-ms', '400']);
    assert.equal(timed.code, 2, timed.stdout);
    assert.ok(timed.body.reason === 'timeout' || timed.body.reason === 'deadline', timed.body.reason);
    assert.equal(timed.body.rows, null);

    const sentinel = path.join(copy.dir, 'user-file.json');
    await writeFile(sentinel, 'KEEP');
    const goodSeed = await writeSeed(copy.dir, [{ httpStatus: 200, body: { jobs: [liverampJob] } }]);
    const overwrite = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', goodSeed, '--out', sentinel]);
    assert.equal(overwrite.code, 2);
    assert.equal(overwrite.body.reason, 'overwrite_refused');
    assert.equal(await readFile(sentinel, 'utf8'), 'KEEP');

    const target = path.join(copy.dir, 'link-target.json');
    const link = path.join(copy.dir, 'link.json');
    await writeFile(target, 'TARGET');
    await symlink(target, link);
    const throughLink = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', goodSeed, '--out', link]);
    assert.equal(throughLink.code, 2);
    assert.equal(throughLink.body.reason, 'overwrite_refused');
    assert.equal(await readFile(target, 'utf8'), 'TARGET');

    const inside = path.join(copy.dest, 'evidence.json');
    const insideWrite = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', goodSeed, '--out', inside]);
    assert.equal(insideWrite.code, 2);
    assert.equal(insideWrite.body.reason, 'overwrite_refused');
    await assert.rejects(lstat(inside));

    const created = path.join(copy.dir, 'fresh.json');
    const written = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', goodSeed, '--out', created]);
    assert.equal(written.code, 0, written.stdout);
    const saved = JSON.parse(await readFile(created, 'utf8'));
    assert.equal(saved.rows[0].title, 'LiveRamp Only Role');
    assert.equal(saved.paidFallback, false);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('installed copy still passes the pinned public recipe tests', async () => {
  const copy = await installedCopy();
  try {
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['--test', path.join(copy.dest, 'recipe/boards.public.test.mjs')], {
        cwd: copy.dest,
        env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.on('close', (code) => resolve({ code, stdout }));
    });
    assert.equal(result.code, 0, result.stdout);
    assert.match(result.stdout, /# fail 0/);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('empty Ashby jobs stay an empty board and partial stays partial', async () => {
  const copy = await installedCopy();
  try {
    const emptySeed = await writeSeed(copy.dir, [{ httpStatus: 200, body: { jobs: [] } }]);
    const empty = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', emptySeed]);
    assert.equal(empty.code, 0, empty.stdout);
    assert.equal(empty.body.coverage.status, 'complete_for_returned_listed_set');
    assert.equal(empty.body.coverage.emptyBoard, true);
    assert.equal(empty.body.boardClaim, 'empty');
    assert.equal(empty.body.emptyBoard, true);
    assert.equal(empty.body.complete, false);
    assert.equal(empty.body.rows.length, 0);

    const hiddenSeed = await writeSeed(copy.dir, [{
      httpStatus: 200,
      body: {
        jobs: [{
          title: 'Hidden Role',
          isListed: false,
          location: 'Remote',
          jobUrl: 'https://jobs.ashbyhq.com/liveramp-inc/hidden',
        }],
      },
    }]);
    const hidden = await run(copy.cli, ['run', '--board', 'liveramp-inc', '--seed', hiddenSeed]);
    assert.equal(hidden.code, 0, hidden.stdout);
    assert.equal(hidden.body.coverage.emptyBoard, false);
    assert.equal(hidden.body.coverage.listedSetEmpty, true);
    assert.equal(hidden.body.boardClaim, 'complete');
    assert.equal(hidden.body.emptyBoard, false);
    assert.equal(hidden.body.complete, true);

    const partialSeed = await writeSeed(copy.dir, [{
      httpStatus: 200,
      body: { jobs: [{ title: 'Needs a flag' }] },
    }]);
    const partial = await run(copy.cli, ['run', '--board', 'liverampashby', '--seed', partialSeed]);
    assert.equal(partial.code, 0, partial.stdout);
    assert.equal(partial.body.boardClaim, 'partial');
    assert.equal(partial.body.emptyBoard, false);
    assert.equal(partial.body.complete, false);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('two supplied responses share one 1024-byte budget', async () => {
  const copy = await installedCopy();
  try {
    const firstBody = { total: 2, jobPostings: [{ title: 'Role', externalPath: '/job/A/1', locationsText: 'Remote' }] };
    const firstBytes = Buffer.byteLength(JSON.stringify(firstBody));
    const padTo = 1023;
    assert.ok(firstBytes <= 1024 && padTo <= 1024 && firstBytes + padTo > 1024);
    const seed = await writeSeed(copy.dir, [
      { httpStatus: 200, body: firstBody },
      { httpStatus: 200, padTo },
    ]);
    const result = await run(copy.cli, ['run', '--board', 'acxiom', '--seed', seed, '--max-bytes', '1024', '--timeout-ms', '4000']);
    assert.equal(result.code, 2, result.stdout);
    assert.equal(result.signal, null);
    assert.equal(result.body.reason, 'oversized_source');
    assert.equal(result.body.rows, null);
    assert.equal(result.body.result, 'refused');
    assert.equal(result.stdout.includes('Role'), false);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('a drip response is cancelled when the deadline fires', async () => {
  const copy = await installedCopy();
  try {
    const seed = await writeSeed(copy.dir, [{ drip: true, dripBytes: 16, dripIntervalMs: 20 }]);
    const result = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', seed, '--timeout-ms', '400'], 2500);
    assert.equal(result.code, 2, result.stdout);
    assert.equal(result.signal, null, result.signal || 'killed');
    assert.ok(result.ms < 2000, String(result.ms));
    assert.ok(result.body.reason === 'timeout' || result.body.reason === 'deadline', result.body?.reason);
    assert.equal(result.body.rows, null);
    assert.throws(() => process.kill(result.pid, 0));
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('every result honors the output bound and --out', async () => {
  const copy = await installedCopy();
  try {
    const board = 'B'.repeat(6000);
    const fresh = path.join(copy.dir, 'bounded.json');
    const result = await run(copy.cli, ['run', '--board', board, '--output-bytes', '1024', '--out', fresh]);
    assert.equal(result.code, 2, result.stdout);
    assert.equal(result.body.reason, 'oversized_output');
    assert.equal(result.body.rows, null);
    assert.equal(result.body.board, null);
    assert.equal(result.stdout.includes(board.slice(0, 20)), false);
    assert.ok(result.stdoutBytes <= 1024, String(result.stdoutBytes));
    const saved = await readFile(fresh, 'utf8');
    assert.equal(saved.includes(board.slice(0, 20)), false);
    assert.ok(Buffer.byteLength(saved) <= 1024);
    assert.equal(JSON.parse(saved).reason, 'oversized_output');

    const sentinel = path.join(copy.dir, 'keep.json');
    await writeFile(sentinel, 'KEEP');
    const blocked = await run(copy.cli, ['run', '--board', 'notion', '--output-bytes', '2048', '--out', sentinel]);
    assert.equal(blocked.code, 2);
    assert.equal(blocked.body.reason, 'overwrite_refused');
    assert.equal(await readFile(sentinel, 'utf8'), 'KEEP');

    const short = path.join(copy.dir, 'short.json');
    const unknown = await run(copy.cli, ['run', '--board', 'notion', '--output-bytes', '2048', '--out', short]);
    assert.equal(unknown.code, 0, unknown.stdout);
    assert.equal(unknown.body.result, 'unknown_board');
    assert.equal(unknown.body.board, 'notion');
    assert.equal(JSON.parse(await readFile(short, 'utf8')).board, 'notion');
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('padTo is rejected before an unbounded allocation', async () => {
  const copy = await installedCopy();
  try {
    const bounded = await writeSeed(copy.dir, [{ httpStatus: 200, padTo: 4096 }]);
    const small = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', bounded, '--max-bytes', '1024', '--timeout-ms', '2000'], 4000);
    assert.equal(small.code, 2, small.stdout);
    assert.equal(small.body.reason, 'oversized_source');
    assert.equal(small.body.rows, null);
    assert.ok(small.ms < 2000, String(small.ms));

    const negative = await writeSeed(copy.dir, [{ httpStatus: 200, padTo: -1 }]);
    const bad = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', negative, '--max-bytes', '1048576']);
    assert.equal(bad.code, 2, bad.stdout);
    assert.equal(bad.body.reason, 'seed_rejected');

    const huge = await writeSeed(copy.dir, [{ httpStatus: 200, padTo: Number.MAX_SAFE_INTEGER }]);
    const giant = await run(copy.cli, ['run', '--board', 'liveramp', '--seed', huge, '--max-bytes', '1024', '--timeout-ms', '2000'], 4000);
    assert.equal(giant.code, 2, giant.stdout);
    assert.equal(giant.signal, null);
    assert.equal(giant.body.reason, 'oversized_source');
    assert.equal(giant.body.rows, null);
    assert.ok(giant.ms < 1000, String(giant.ms));
    assert.ok(giant.peakKb === 0 || giant.peakKb < 250000, String(giant.peakKb));

    const terabyte = await writeSeed(copy.dir, [{ httpStatus: 200, padTo: 1_000_000_000_000 }]);
    const tb = await run(copy.cli, ['run', '--board', 'acxiom', '--seed', terabyte, '--max-bytes', '2048', '--timeout-ms', '2000'], 4000);
    assert.equal(tb.code, 2, tb.stdout);
    assert.equal(tb.body.reason, 'oversized_source');
    assert.ok(tb.ms < 1000, String(tb.ms));
    assert.ok(tb.peakKb === 0 || tb.peakKb < 250000, String(tb.peakKb));
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('execution is bound to the verified recipe bytes', async () => {
  const copy = await installedCopy();
  try {
    const hookDir = path.join(copy.dir, 'hook');
    await mkdir(hookDir);
    const log = path.join(copy.dir, 'loads.txt');
    const marker = path.join(copy.dir, 'executed.txt');
    await writeFile(path.join(hookDir, 'register.mjs'), "import { register } from 'node:module';\nregister('./hook.mjs', import.meta.url);\n");
    await writeFile(path.join(hookDir, 'hook.mjs'), `
export async function load(url, context, nextLoad) {
  if (url.endsWith('/recipe/boards.mjs')) {
    const fs = await import('node:fs');
    fs.appendFileSync(process.env.LOAD_LOG, url + '\\n');
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return nextLoad(url, context);
}
`);
    const swapped = `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(marker)}, 'executed');
export const BOARDS = {
  acxiom: {
    endpoint: 'https://acxiomllc.wd5.myworkdayjobs.com/wday/cxs/acxiomllc/AcxiomUSA/jobs',
    boardUrl: 'https://acxiomllc.wd5.myworkdayjobs.com/en-US/AcxiomUSA',
  },
  liverampAshby: {
    endpoint: 'https://api.ashbyhq.com/posting-api/job-board/liveramp-inc',
    boardUrl: 'https://jobs.ashbyhq.com/liveramp-inc',
  },
};
export async function fetchAcxiom() {
  return { rows: [{ title: 'SWAPPED' }], coverage: { status: 'complete_for_declared_total', emptyBoard: false, requests: [{ url: 'https://acxiomllc.wd5.myworkdayjobs.com/wday/cxs/acxiomllc/AcxiomUSA/jobs', error: null }] } };
}
export async function fetchAshby() { return fetchAcxiom(); }
`;
    const boards = path.join(copy.dest, 'recipe/boards.mjs');
    const originalBoards = await readFile(boards);
    const seed = await writeSeed(copy.dir, [{
      httpStatus: 200,
      body: { total: 1, jobPostings: [{ title: 'Acxiom Only Role', externalPath: '/job/A/Acxiom_1', locationsText: 'Remote' }] },
    }]);
    const extra = {
      nodeArgs: ['--import', path.join(hookDir, 'register.mjs')],
      env: { LOAD_LOG: log },
    };
    const running = run(copy.cli, ['run', '--board', 'acxiom', '--seed', seed, '--timeout-ms', '5000'], 8000, extra);
    const started = Date.now();
    let seen = '';
    while (Date.now() - started < 2000) {
      seen = await readFile(log, 'utf8').catch(() => '');
      if (seen.includes('boards.mjs')) break;
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    await writeFile(boards, swapped);
    const result = await running;
    assert.equal(result.code, 0, result.stdout);
    assert.equal(result.body.rows[0].title, 'Acxiom Only Role');
    assert.equal(result.stdout.includes('SWAPPED'), false);
    const loads = await readFile(log, 'utf8');
    assert.match(loads, /careers-snap-/);
    assert.equal(loads.includes(`${copy.dest}/recipe/boards.mjs`), false);
    await assert.rejects(access(marker));
    const snapUrl = loads.trim().split('\n')[0];
    const snapDir = path.dirname(path.dirname(new URL(snapUrl).pathname));
    await assert.rejects(access(snapDir));
    await writeFile(boards, originalBoards);

    await writeFile(log, '');
    const wrong = await run(copy.cli, ['run', '--board', 'liveramp', '--source', 'workday', '--timeout-ms', '3000'], 5000, extra);
    assert.equal(wrong.code, 0, wrong.stdout);
    assert.equal(wrong.body.result, 'wrong_source');
    assert.equal(await readFile(log, 'utf8'), '');
    await assert.rejects(access(marker));

    const unknown = await run(copy.cli, ['run', '--board', 'notion', '--timeout-ms', '3000'], 5000, extra);
    assert.equal(unknown.code, 0, unknown.stdout);
    assert.equal(unknown.body.result, 'unknown_board');
    assert.equal(await readFile(log, 'utf8'), '');
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('the same supplied seed selects the same observation twice', async () => {
  const copy = await installedCopy();
  try {
    const seed = await writeSeed(copy.dir, [{ httpStatus: 200, body: { jobs: [liverampJob] } }]);
    const args = ['run', '--board', 'liveramp', '--source', 'ashby', '--seed', seed];
    const first = await run(copy.cli, args);
    const second = await run(copy.cli, args);
    assert.equal(first.code, 0, first.stdout);
    assert.equal(second.code, 0, second.stdout);
    const stable = (body) => ({
      result: body.result,
      board: body.board,
      reader: body.reader,
      title: body.rows[0].title,
      url: body.rows[0].url,
      status: body.coverage.status,
      claim: body.boardClaim,
      emptyBoard: body.emptyBoard,
      complete: body.complete,
      seeded: body.seeded,
      paymentSent: body.paymentSent,
      charged: body.charged,
    });
    assert.deepEqual(stable(first.body), stable(second.body));
    assert.equal(first.body.rows[0].title, 'LiveRamp Only Role');
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});
