import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { budget } from '../skills/received-useful-work/scripts/task-distribution/source.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const skill = path.join(repo, 'skills/received-useful-work');
const deliveryCli = path.join(skill, 'scripts/library-delivery.mjs');
const ARCHIVE = 'a447722a865d0743abda5399b884497d9bce0ab7660eae39c57e10fcbad15094';
const LOCK_TGZ = '6f1b59e96eb4e6b222a0f5ac4db6cc9375a0f703e642b841f4c7de4bfa570cbf';
const LOCK_LOCK = 'eed6f8c3e417faed7bb70151c96acffc0ed6ee57d30fea7138b7dea18cba0666';
const NPM_CACHE_LIMIT = 20_000_000;
const NPM_TREE_LIMIT = 80_000_000;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function cleanEnv(home, cache) {
  return {
    PATH: process.env.PATH,
    HOME: home,
    TMPDIR: home,
    LANG: 'C',
    LC_ALL: 'C',
    npm_config_cache: cache,
    npm_config_update_notifier: 'false',
  };
}

function run(command, args, { cwd, env, timeoutMs, outputLimit = 262144 }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let flooded = false;
    const stop = (signal) => {
      try { child.kill(signal); } catch { /* already gone */ }
    };
    const timer = setTimeout(() => stop('SIGTERM'), timeoutMs);
    const killer = setTimeout(() => stop('SIGKILL'), timeoutMs + 1000);
    const take = (chunk, which) => {
      if (which === 'out') stdout += chunk;
      else stderr += chunk;
      if (stdout.length + stderr.length > outputLimit) {
        flooded = true;
        stop('SIGTERM');
      }
    };
    child.stdout.on('data', (chunk) => take(chunk, 'out'));
    child.stderr.on('data', (chunk) => take(chunk, 'err'));
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      clearTimeout(killer);
      resolve({
        code,
        signal,
        stdout,
        stderr,
        flooded,
        elapsedMs: Date.now() - started,
      });
    });
  });
}

async function treeBytes(dir) {
  const { readdir, stat } = await import('node:fs/promises');
  let total = 0;
  const pending = [dir];
  while (pending.length) {
    const current = pending.pop();
    let names;
    try { names = await readdir(current, { withFileTypes: true }); }
    catch { continue; }
    for (const name of names) {
      const abs = path.join(current, name.name);
      if (name.isSymbolicLink()) continue;
      if (name.isDirectory()) pending.push(abs);
      else if (name.isFile()) total += (await stat(abs)).size;
    }
  }
  return total;
}

function descriptor() {
  return {
    schema: 'neomorphic.route-liquidity-read.machine-entry.v1',
    packageName: 'route-liquidity-read',
    version: '0.1.0',
    hostedAcquisitionVerified: false,
    paymentAuthority: 'none',
    claimAuthority: 'none',
    archive: '/downloads/route-liquidity-read/0.1.0/route-liquidity-read-0.1.0.tar.gz',
    publicPath: '/downloads/route-liquidity-read/0.1.0/route-liquidity-read-0.1.0.tar.gz',
    sha256: ARCHIVE,
    bytes: 75422,
  };
}

async function publicRoot(dir, { archive = null } = {}) {
  const leaf = path.join(dir, 'downloads/route-liquidity-read/0.1.0');
  await mkdir(leaf, { recursive: true });
  const body = `${JSON.stringify(descriptor())}\n`;
  await writeFile(path.join(dir, 'downloads/route-liquidity-read/current.json'), JSON.stringify({ ...descriptor(), publicationStatus: 'hosted_library_received', libraryLaunched: true, hostedAcquisitionVerified: true, paidServiceLaunch: false }));
  await writeFile(path.join(leaf, 'descriptor.json'), body);
  await writeFile(path.join(leaf, 'machine-entry.json'), body);
  if (archive !== null) await writeFile(path.join(leaf, 'route-liquidity-read-0.1.0.tar.gz'), archive);
  return dir;
}

async function acquireCli(args, env) {
  return run(process.execPath, [deliveryCli, ...args], { cwd: repo, env, timeoutMs: 25000, outputLimit: 131072 });
}

test('the existing delivery operation refuses an unknown library, a tampered archive, and a missing archive', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'route-task-home-'));
  const env = cleanEnv(home, path.join(home, 'npm-cache'));
  try {
    const unknown = await acquireCli(['acquire', '--library', 'route-liquidity-read-other', '--work', path.join(home, 'unknown')], env);
    assert.equal(unknown.code, 2);
    const unknownBody = JSON.parse(unknown.stdout);
    assert.equal(unknownBody.executed, false);
    assert.equal(unknownBody.useful, null);
    assert.equal(unknownBody.reason, 'unsupported_library');

    const tamperedRoot = await publicRoot(path.join(home, 'tampered-root'), { archive: Buffer.from('not-the-archive') });
    const tampered = await acquireCli([
      'acquire', '--library', 'route-liquidity-read', '--public-root', tamperedRoot,
      '--work', path.join(home, 'tampered-work'), '--timeout-ms', '5000', '--max-bytes', '200000',
    ], env);
    assert.equal(tampered.code, 2);
    const tamperedBody = JSON.parse(tampered.stdout);
    assert.equal(tamperedBody.reason, 'tampered_archive');
    assert.equal(tamperedBody.useful, null);
    assert.equal(tamperedBody.executed, false);

    const missingRoot = await publicRoot(path.join(home, 'missing-root'));
    const missing = await acquireCli([
      'acquire', '--library', 'route-liquidity-read', '--public-root', missingRoot,
      '--work', path.join(home, 'missing-work'), '--timeout-ms', '5000', '--max-bytes', '200000',
    ], env);
    assert.equal(missing.code, 2);
    const missingBody = JSON.parse(missing.stdout);
    assert.equal(missingBody.executed, false);
    assert.equal(missingBody.useful, null);
    assert.notEqual(missingBody.reason, undefined);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test('current withdrawal or unreceived hosting refuses even with unchanged frozen pins', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'route-task-withdrawn-'));
  const env = cleanEnv(home, path.join(home, 'npm-cache'));
  try {
    for (const status of ['withdrawn', 'staged_unreceived']) {
      const source = await publicRoot(path.join(home, status));
      await writeFile(path.join(source, 'downloads/route-liquidity-read/current.json'), JSON.stringify({
        ...descriptor(), publicationStatus: status, libraryLaunched: false, paidServiceLaunch: false,
      }));
      const result = await acquireCli(['acquire', '--library', 'route-liquidity-read', '--public-root', source,
        '--work', path.join(home, status + '-work'), '--timeout-ms', '5000', '--max-bytes', '200000'], env);
      assert.equal(result.code, 2);
      const body = JSON.parse(result.stdout);
      assert.equal(body.reason, 'current_library_unavailable');
      assert.equal(body.executed, false);
      assert.equal(body.useful, null);
    }
  } finally { await rm(home, { recursive: true, force: true }); }
});

test('a delivery allowance that has expired refuses the next read', () => {
  const allowance = budget(100, 4096, 4096);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        assert.throws(() => allowance.left(), (error) => error.code === 'deadline');
        resolve();
      } catch (error) { reject(error); }
    }, 150);
  });
});

test('an owned child that ignores its deadline is killed', async () => {
  const ran = await run(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: repo, env: cleanEnv(tmpdir(), tmpdir()), timeoutMs: 400, outputLimit: 1024 });
  assert.notEqual(ran.code, 0);
  assert.ok(ran.elapsedMs < 3000);
});

test('live acquire uses the pinned comparator and keeps payment closed', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'route-task-live-'));
  const cache = path.join(home, 'npm-cache');
  const env = cleanEnv(home, cache);
  const work = path.join(home, 'work');
  const receipt = { cases: {} };
  try {
    const oversized = await acquireCli([
      'acquire', '--library', 'route-liquidity-read', '--work', path.join(home, 'small'),
      '--timeout-ms', '15000', '--max-bytes', '1024',
    ], env);
    assert.equal(oversized.code, 2);
    assert.equal(JSON.parse(oversized.stdout).reason, 'oversized_source');
    receipt.cases.oversized = { code: oversized.code, reason: 'oversized_source' };

    const acquired = await acquireCli([
      'acquire', '--library', 'route-liquidity-read', '--work', work,
      '--timeout-ms', '20000', '--max-bytes', '200000',
    ], env);
    assert.equal(acquired.code, 0, acquired.stderr);
    assert.ok(acquired.elapsedMs < 20000);
    const body = JSON.parse(acquired.stdout);
    assert.equal(body.executed, false);
    assert.equal(body.useful, null);
    assert.equal(body.settlement, null);
    assert.equal(body.paymentAuthority, 'none');
    assert.equal(body.hostedAcquisitionVerified, false);
    assert.equal(body.stagedCandidate, false);
    assert.equal(body.currentPublicationStatus, 'hosted_library_received');
    assert.equal(body.sourceCoverage, 'anonymous_https');
    assert.equal(body.sha256, ARCHIVE);
    assert.equal(body.bytes, 75422);
    assert.equal(body.command.at(-1), path.join(body.packageDir, 'bin/compare.mjs'));
    assert.match(body.nextAction, /npm ci --ignore-scripts/);
    assert.match(body.nextAction, /authorization\.granted false/);
    assert.equal(await readFile(path.join(body.packageDir, '.git'), 'utf8').then(() => true, () => false), false);
    receipt.acquire = {
      code: acquired.code,
      elapsedMs: acquired.elapsedMs,
      bytes: body.bytes,
      sha256: body.sha256,
      hostedAcquisitionVerified: body.hostedAcquisitionVerified,
      useful: body.useful,
      executed: body.executed,
    };

    const tgz = await readFile(path.join(body.packageDir, 'closure/route-lock-0.1.0.tgz'));
    const lock = await readFile(path.join(body.packageDir, 'closure/route-lock-package-lock.json'));
    assert.equal(tgz.length, 20149);
    assert.equal(sha256(tgz), LOCK_TGZ);
    assert.equal(sha256(lock), LOCK_LOCK);

    const installed = await run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', 'vendor/route-lock'], {
      cwd: body.packageDir,
      env,
      timeoutMs: 60000,
      outputLimit: 1_000_000,
    });
    assert.equal(installed.code, 0, installed.stderr.slice(0, 500));
    assert.equal(installed.flooded, false);
    assert.ok(installed.elapsedMs < 60000);
    const cacheBytes = await treeBytes(cache);
    const tree = await treeBytes(path.join(body.packageDir, 'vendor/route-lock/node_modules'));
    assert.ok(cacheBytes < NPM_CACHE_LIMIT, `npm cache ${cacheBytes}`);
    assert.ok(tree < NPM_TREE_LIMIT, `node_modules ${tree}`);
    receipt.closure = { code: installed.code, elapsedMs: installed.elapsedMs, cacheBytes, treeBytes: tree };

    async function compare(args, input) {
      if (input) await writeFile(path.join(home, 'request.json'), JSON.stringify(input));
      const ran = await run(process.execPath, [path.join(body.packageDir, 'bin/compare.mjs'), ...args], {
        cwd: body.packageDir,
        env,
        timeoutMs: 10000,
        outputLimit: 262144,
      });
      let record = null;
      if (ran.stdout.trim()) record = JSON.parse(ran.stdout);
      return { ...ran, record };
    }

    const valid = await compare(['--input', 'examples/terms-differ.json']);
    assert.equal(valid.code, 0);
    assert.equal(valid.record.outcome, 'terms_differ');
    assert.equal(valid.record.authorization.granted, false);
    assert.equal(valid.record.authorization.fundsReserved, false);
    assert.equal(valid.record.authorization.paymentSent, false);
    assert.equal(valid.record.winner, null);
    assert.equal(valid.record.liquidityClaim, null);
    assert.equal(valid.record.demandClaim, null);
    assert.equal(valid.record.samePriceNotSameRoute, true);
    receipt.cases.valid = { code: valid.code, outcome: valid.record.outcome, authorization: valid.record.authorization };

    const changedInput = JSON.parse(await readFile(path.join(body.packageDir, 'examples/terms-differ.json'), 'utf8'));
    changedInput.right.body.accepts[0].maxTimeoutSeconds = changedInput.left.body.accepts[0].maxTimeoutSeconds;
    delete changedInput.right.body.accepts[0].extra.verifyingContract;
    changedInput.right.body.accepts[0].extra.name = changedInput.left.body.accepts[0].extra.name;
    const changed = await compare(['--input', path.join(home, 'request.json')], changedInput);
    assert.equal(changed.code, 0);
    assert.equal(changed.record.outcome, 'terms_agree_not_demand');
    assert.deepEqual(changed.record.termDifferences, []);
    assert.equal(changed.record.demandClaim, null);
    assert.equal(changed.record.authorization.granted, false);
    receipt.cases.changed = { code: changed.code, outcome: changed.record.outcome, termDifferences: changed.record.termDifferences };

    const unknown = await compare(['--input', 'examples/schema-names-only.json']);
    assert.equal(unknown.code, 3);
    assert.equal(unknown.record.outcome, 'equivalence_unknown');
    assert.equal(unknown.record.outputRelation, 'unknown');
    assert.equal(unknown.record.authorization.granted, false);
    receipt.cases.unknownSchema = { code: unknown.code, outcome: unknown.record.outcome };

    const terms = JSON.parse(await readFile(path.join(body.packageDir, 'examples/terms-differ.json'), 'utf8'));
    delete terms.left.body.accepts[0].payTo;
    delete terms.right.body.accepts[0].payTo;
    const unknownTerm = await compare(['--input', path.join(home, 'request.json')], terms);
    assert.equal(unknownTerm.code, 3);
    assert.equal(unknownTerm.record.termsRelation, 'unknown');
    assert.ok(unknownTerm.record.findings.includes('challenge_terms_incomplete'));
    assert.equal(unknownTerm.record.authorization.granted, false);
    receipt.cases.unknownTerm = { code: unknownTerm.code, outcome: unknownTerm.record.outcome, findings: unknownTerm.record.findings };

    const malformedInput = JSON.parse(await readFile(path.join(body.packageDir, 'examples/terms-differ.json'), 'utf8'));
    malformedInput.left.headers = { 'payment-required': '!!!!' };
    malformedInput.right.headers = { 'payment-required': '!!!!' };
    const malformed = await compare(['--input', path.join(home, 'request.json')], malformedInput);
    assert.equal(malformed.code, 3);
    assert.equal(malformed.record.outcome, 'evidence_rejected');
    assert.ok(malformed.record.findings.includes('payment_required_malformed'));
    assert.equal(malformed.record.authorization.granted, false);
    receipt.cases.malformed = { code: malformed.code, outcome: malformed.record.outcome };

    const unavailable = await compare(['--input', 'examples/missing-evidence.json']);
    assert.equal(unavailable.code, 3);
    assert.equal(unavailable.record.outcome, 'evidence_rejected');
    assert.ok(unavailable.record.findings.includes('challenge_absent'));
    assert.equal(unavailable.record.authorization.granted, false);
    receipt.cases.unavailable = { code: unavailable.code, outcome: unavailable.record.outcome };

    const staleInput = JSON.parse(await readFile(path.join(body.packageDir, 'examples/terms-differ.json'), 'utf8'));
    staleInput.left.observedAt = '2020-01-01T00:00:00.000Z';
    staleInput.right.observedAt = '2020-01-01T00:00:00.000Z';
    const stale = await compare(['--input', path.join(home, 'request.json')], staleInput);
    assert.equal(stale.code, 3);
    assert.equal(stale.record.outcome, 'evidence_rejected');
    assert.ok(stale.record.findings.includes('observation_stale'));
    assert.equal(stale.record.authorization.granted, false);
    receipt.cases.stale = { code: stale.code, outcome: stale.record.outcome };

    const fixture = JSON.parse(await readFile(path.join(body.packageDir, 'examples/terms-differ.json'), 'utf8'));
    const { compareLivePair, LIVE_PAIR } = await import(pathToFileURL(path.join(body.packageDir, 'src/live.mjs')).href);
    const openapi = { paths: {
      [LIVE_PAIR.left.route]: { get: { responses: { 200: { content: { 'application/json': { schema: fixture.left.outputContract.schema } } } } } },
      [LIVE_PAIR.right.route]: { get: { responses: { 200: { content: { 'application/json': { schema: fixture.right.outputContract.schema } } } } } },
    } };
    const shaped = await compareLivePair({
      now: fixture.now,
      fetchImpl: async (url) => {
        const name = url === LIVE_PAIR.openapi ? 'openapi' : url === LIVE_PAIR.left.url ? 'left' : 'right';
        const payload = name === 'openapi' ? openapi : fixture[name].body;
        return new Response(JSON.stringify(payload), {
          status: 500,
          headers: { 'content-type': 'application/json', date: new Date(fixture.now).toUTCString() },
        });
      },
    });
    assert.equal(shaped.exitCode, 3);
    assert.equal(shaped.record.outcome, 'evidence_rejected');
    assert.equal(shaped.record.comparableOutput, false);
    assert.deepEqual([shaped.captures.openapiStatus, shaped.captures.leftStatus, shaped.captures.rightStatus], [500, 500, 500]);
    assert.equal(shaped.record.authorization.granted, false);
    assert.equal(shaped.record.routeLock.left.attempted, false);
    receipt.cases.validShaped500 = {
      exitCode: shaped.exitCode,
      outcome: shaped.record.outcome,
      statuses: [shaped.captures.openapiStatus, shaped.captures.leftStatus, shaped.captures.rightStatus],
    };

    const claim = await compare(['--input', 'examples/seeded-liquidity.json']);
    assert.equal(claim.code, 2);
    assert.match(claim.stderr, /seeded claim rejected/);
    assert.equal(claim.record, null);
    receipt.cases.liquidity = { code: claim.code, stderr: claim.stderr.trim() };

    for (const flag of ['--pay', '--reserve', '--settle']) {
      const refused = await compare([flag, '--input', 'examples/terms-differ.json']);
      assert.equal(refused.code, 2, flag);
      assert.match(refused.stderr, new RegExp(`${flag} is refused`));
      receipt.cases[flag.slice(2)] = { code: refused.code, stderr: refused.stderr.trim() };
    }

    const cold = await run(process.execPath, ['scripts/cold-invoke.mjs'], {
      cwd: body.packageDir,
      env,
      timeoutMs: 15000,
      outputLimit: 262144,
    });
    assert.equal(cold.code, 0, cold.stderr.slice(0, 400));
    const coldBody = JSON.parse(cold.stdout);
    assert.equal(coldBody.valid.outcome, 'terms_differ');
    assert.equal(coldBody.valid.authorization.granted, false);
    assert.equal(coldBody.changed.outcome, 'terms_agree_not_demand');
    assert.equal(coldBody.negative.status, 2);
    receipt.cold = coldBody;
    console.log(`ROUTE_TASK_RECEIPT ${JSON.stringify(receipt)}`);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
