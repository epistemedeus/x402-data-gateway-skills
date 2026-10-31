import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(pluginRoot, '..', '..');
const skillRel = path.join('skills', 'public-careers-board');
const SEED = 'public-careers-board.supplied-seed.v1';

function run(executable, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: options.cwd || repoRoot,
      env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs || 20000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      let body = null;
      try { body = JSON.parse(stdout); } catch { /* refusal text or check output */ }
      resolve({ code, signal, stdout, stderr, body });
    });
  });
}

async function copyTree(source, dest) {
  await new Promise((resolve, reject) => {
    const child = spawn('cp', ['-a', source, dest], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`cp ${source} failed`))));
  });
}

async function isolatedPlugin() {
  const dir = await mkdtemp(path.join(tmpdir(), 'careers-plugin-'));
  const dest = path.join(dir, 'public-careers-board');
  const cwd = path.join(dir, 'other-cwd');
  await copyTree(pluginRoot, dest);
  await mkdir(cwd);
  await mkdir(path.join(cwd, 'skills', 'public-careers-board'), { recursive: true });
  await writeFile(path.join(cwd, 'skills', 'public-careers-board', 'MARKER'), 'decoy');
  return {
    dir,
    dest,
    cwd,
    cli: path.join(dest, 'skills', 'public-careers-board', 'scripts', 'cli.mjs'),
  };
}

async function writeSeed(dir, responses) {
  const file = path.join(dir, `seed-${Math.random().toString(16).slice(2)}.json`);
  await writeFile(file, JSON.stringify({ schema: SEED, responses }));
  return file;
}

const liverampJob = {
  title: 'LiveRamp Only Role',
  location: 'Remote',
  isListed: true,
  jobUrl: 'https://jobs.ashbyhq.com/liveramp-inc/role-1',
};

test('synchronization check accepts this tree and rejects a drifted byte', async () => {
  const ok = await run(process.execPath, [path.join(pluginRoot, 'check-sync.mjs')]);
  assert.equal(ok.code, 0, ok.stderr);
  assert.match(ok.stdout, /sync ok files=13/);

  const dir = await mkdtemp(path.join(tmpdir(), 'careers-sync-'));
  try {
    await mkdir(path.join(dir, 'plugins'), { recursive: true });
    await mkdir(path.join(dir, 'skills'), { recursive: true });
    await copyTree(pluginRoot, path.join(dir, 'plugins', 'public-careers-board'));
    await copyTree(path.join(repoRoot, skillRel), path.join(dir, 'skills', 'public-careers-board'));
    const boards = path.join(dir, 'plugins', 'public-careers-board', 'skills', 'public-careers-board', 'recipe', 'boards.mjs');
    const bytes = await readFile(boards);
    bytes[bytes.length - 2] ^= 0x01;
    await writeFile(boards, bytes);
    const drifted = await run(process.execPath, [path.join(dir, 'plugins', 'public-careers-board', 'check-sync.mjs')], { cwd: dir });
    assert.equal(drifted.code, 1, drifted.stdout + drifted.stderr);
    assert.match(drifted.stderr, /recipe\/boards\.mjs differs/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('isolated plugin resolves from its own root when cwd is elsewhere', async () => {
  const copy = await isolatedPlugin();
  try {
    const seed = await writeSeed(copy.dir, [{ httpStatus: 200, body: { jobs: [liverampJob] } }]);
    const result = await run(process.execPath, [copy.cli, 'run', '--board', 'liveramp', '--seed', seed], { cwd: copy.cwd });
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.body.result, 'observation');
    assert.equal(result.body.seeded, true);
    assert.equal(result.body.sourceCoverage, 'supplied_seed');
    assert.equal(result.body.board, 'liveramp');
    assert.equal(result.body.reader, 'fetchAshby');
    assert.equal(result.body.rows[0].title, 'LiveRamp Only Role');
    assert.equal(result.body.rows[0].location, 'Remote');
    assert.equal(result.body.rows[0].url, liverampJob.jobUrl);
    assert.equal(result.body.source, 'https://api.ashbyhq.com/posting-api/job-board/liveramp-inc');
    assert.equal(result.body.recipeRevision, '7d01bfb09c530430933dec1f07c5c0b8517cffa8');
    assert.equal(result.body.paymentSent, false);
    assert.equal(result.body.paidFallback, false);
    assert.equal(result.body.useful, null);
    assert.equal(await readFile(path.join(copy.cwd, 'skills', 'public-careers-board', 'MARKER'), 'utf8'), 'decoy');
  } finally {
    await rm(copy.dir, { recursive: true, force: true });
  }
});

test('isolated plugin classifies missing and wrong boards without a source read', async () => {
  const copy = await isolatedPlugin();
  try {
    const missing = await run(process.execPath, [copy.cli, 'run'], { cwd: copy.cwd });
    assert.equal(missing.code, 0, missing.stdout);
    assert.equal(missing.body.result, 'missing_input');
    assert.equal(missing.body.rows, null);

    const unknown = await run(process.execPath, [copy.cli, 'run', '--board', 'notion'], { cwd: copy.cwd });
    assert.equal(unknown.code, 0, unknown.stdout);
    assert.equal(unknown.body.result, 'unknown_board');

    const wrong = await run(process.execPath, [
      copy.cli, 'run', '--board', 'liveramp', '--source', 'workday',
    ], { cwd: copy.cwd });
    assert.equal(wrong.code, 0, wrong.stdout);
    assert.equal(wrong.body.result, 'wrong_source');
    assert.equal(wrong.body.source, null);

    const magniteWrong = await run(process.execPath, [
      copy.cli, 'run', '--board', 'magnite', '--source', 'https://api.smartrecruiters.com/v1/companies/Magnite/postings',
    ], { cwd: copy.cwd });
    assert.equal(magniteWrong.code, 0, magniteWrong.stdout);
    assert.equal(magniteWrong.body.result, 'wrong_source');
  } finally {
    await rm(copy.dir, { recursive: true, force: true });
  }
});

test('isolated plugin keeps source failure and timeout distinct from a board', async () => {
  const copy = await isolatedPlugin();
  try {
    const failureSeed = await writeSeed(copy.dir, [{ httpStatus: 403, body: { errorCode: 'forbidden', message: 'no' } }]);
    const failure = await run(process.execPath, [copy.cli, 'run', '--board', 'liveramp', '--seed', failureSeed], { cwd: copy.cwd });
    assert.equal(failure.code, 0, failure.stdout);
    assert.equal(failure.body.boardClaim, 'source_failure');
    assert.equal(failure.body.emptyBoard, false);
    assert.equal(failure.body.complete, false);
    assert.equal(failure.body.rows.length, 0);

    const hangSeed = await writeSeed(copy.dir, [{ hang: true }]);
    const timed = await run(process.execPath, [
      copy.cli, 'run', '--board', 'liveramp', '--seed', hangSeed, '--timeout-ms', '400',
    ], { cwd: copy.cwd, timeoutMs: 8000 });
    assert.equal(timed.code, 2, timed.stdout);
    assert.ok(timed.body.reason === 'timeout' || timed.body.reason === 'deadline', timed.body && timed.body.reason);
    assert.equal(timed.body.rows, null);
    assert.equal(timed.body.emptyBoard, undefined);
  } finally {
    await rm(copy.dir, { recursive: true, force: true });
  }
});

test('isolated plugin refuses payment flags and preserves an existing file', async () => {
  const copy = await isolatedPlugin();
  try {
    for (const flag of ['--pay', '--settle', '--sign', '--wallet', '--purchase']) {
      const paid = await run(process.execPath, [copy.cli, 'run', flag, '--board', 'liveramp'], { cwd: copy.cwd });
      assert.equal(paid.code, 2, flag + paid.stdout);
      assert.equal(paid.body.reason, 'payment_refused');
      assert.equal(paid.body.paymentSent, false);
      assert.equal(paid.body.paidFallback, false);
      assert.equal(paid.body.rows, null);
    }

    const sentinel = path.join(copy.dir, 'user-file.json');
    await writeFile(sentinel, 'KEEP');
    const seed = await writeSeed(copy.dir, [{ httpStatus: 200, body: { jobs: [liverampJob] } }]);
    const overwrite = await run(process.execPath, [
      copy.cli, 'run', '--board', 'liveramp', '--seed', seed, '--out', sentinel,
    ], { cwd: copy.cwd });
    assert.equal(overwrite.code, 2, overwrite.stdout);
    assert.equal(overwrite.body.reason, 'overwrite_refused');
    assert.equal(await readFile(sentinel, 'utf8'), 'KEEP');

    const created = path.join(copy.dir, 'fresh.json');
    const written = await run(process.execPath, [
      copy.cli, 'run', '--board', 'liveramp', '--seed', seed, '--out', created,
    ], { cwd: copy.cwd });
    assert.equal(written.code, 0, written.stdout);
    assert.equal(JSON.parse(await readFile(created, 'utf8')).rows[0].title, 'LiveRamp Only Role');
    assert.equal(await readFile(sentinel, 'utf8'), 'KEEP');
  } finally {
    await rm(copy.dir, { recursive: true, force: true });
  }
});

test('plugin manifest, license, and consumer readme stay inside this folder', async () => {
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'public-careers-board');
  assert.equal(manifest.displayName, 'Public careers board');
  assert.equal(manifest.version, '0.1.3');
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.author.name, 'Neomorphic LLC');
  assert.equal(manifest.homepage, 'https://github.com/epistemedeus/x402-data-gateway-skills');
  assert.equal(manifest.repository, manifest.homepage);
  assert.match(manifest.description, /Node\.js/);
  assert.match(manifest.description, /GET \/data\/careers-board/);
  assert.equal(manifest.mcpServers, undefined);

  const license = await readFile(path.join(pluginRoot, 'LICENSE'));
  const skillLicense = await readFile(path.join(repoRoot, skillRel, 'LICENSE'));
  assert.ok(license.equals(skillLicense));

  const readme = await readFile(path.join(pluginRoot, 'README.md'), 'utf8');
  const prose = readme.replace(/```[\s\S]*?```/g, ' ');
  const words = prose.split(/\s+/).filter(Boolean);
  assert.ok(words.length >= 40, `readme words ${words.length}`);
  const examples = readme.match(/scripts\/cli\.mjs run --board/g) || [];
  assert.ok(examples.length >= 3, `examples ${examples.length}`);

  const cli = await readFile(path.join(pluginRoot, skillRel, 'scripts', 'cli.mjs'), 'utf8');
  assert.equal(cli.includes("from '../"), false);
  assert.equal(cli.includes("from '../../"), false);
  assert.equal(cli.includes('/data/careers-board'), false);
});
