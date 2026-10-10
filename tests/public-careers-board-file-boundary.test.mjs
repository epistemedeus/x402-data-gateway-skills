import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoSkill = fileURLToPath(new URL('../skills/public-careers-board/', import.meta.url));
const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const INPUT_CAP = 1048576;
const BOARD = 'https://osv-rubicon.wd5.myworkdayjobs.com/MagniteCareers';
const JOBS = 'https://osv-rubicon.wd5.myworkdayjobs.com/wday/cxs/osv_rubicon/MagniteCareers/jobs';
const ROBOTS_ZERO = 'Crawl-delay: 0\nUser-agent: *\nDisallow:\n';
const CAREERS = `<a href="${BOARD}">Search Jobs</a><a href="${BOARD}/">Search Jobs</a>`;
const SHELL = 'tenant: "osv_rubicon",\nsiteId: "MagniteCareers",\nappName: "cxs",\nisExternal: true,\n';

function run(cli, args, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: path.dirname(path.dirname(cli)),
      env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let peakKb = 0;
    const sample = setInterval(() => {
      try {
        const text = readFileSync(`/proc/${child.pid}/status`, 'utf8');
        const match = /VmHWM:\s+(\d+)/.exec(text);
        if (match) peakKb = Math.max(peakKb, Number(match[1]));
      } catch { /* exited */ }
    }, 15);
    const timer = setTimeout(() => { try { child.kill('SIGTERM'); } catch { /* gone */ } }, timeoutMs);
    const killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, timeoutMs + 500);
    const started = Date.now();
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code, signal) => {
      clearInterval(sample);
      clearTimeout(timer);
      clearTimeout(killer);
      let body = null;
      try { body = JSON.parse(stdout); } catch { /* refusal */ }
      setTimeout(() => {
        let alive = true;
        try { process.kill(child.pid, 0); } catch { alive = false; }
        resolve({ code, signal, stdout, stderr, body, ms: Date.now() - started, peakKb, alive });
      }, 30);
    });
  });
}

function runGroup(args, timeoutMs, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' },
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
    }, timeoutMs);
    const killer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ }
    }, timeoutMs + 400);
    const started = Date.now();
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      clearTimeout(killer);
      setTimeout(() => {
        let groupAlive = true;
        try { process.kill(-child.pid, 0); } catch { groupAlive = false; }
        if (groupAlive) {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ }
        }
        let still = true;
        try { process.kill(-child.pid, 0); } catch { still = false; }
        let body = null;
        try { body = JSON.parse(stdout); } catch { /* refusal */ }
        resolve({
          code, signal, stdout, stderr, body, timedOut, groupAlive: still,
          ms: Date.now() - started,
        });
      }, 80);
    });
  });
}

async function installedCopy() {
  const dir = await mkdtemp(path.join(tmpdir(), 'careers-boundary-'));
  const dest = path.join(dir, 'public-careers-board');
  execFileSync('cp', ['-a', repoSkill, dest]);
  return { dir, dest, cli: path.join(dest, 'scripts/cli.mjs'), predicates: path.join(dest, 'scripts/predicates.mjs') };
}

async function absent(file) {
  await assert.rejects(lstat(file));
}

const job = (name, id) => ({ title: name, externalPath: `/job/City/${id}`, locationsText: 'Remote' });

test('parent and multi-level symlinks into the skill create no file', async () => {
  const copy = await installedCopy();
  try {
    const scripts = path.join(copy.dest, 'scripts');
    const before = (await readdir(scripts)).sort();
    const parent = path.join(copy.dir, 'parent');
    await symlink(scripts, parent);
    const parentOut = await run(copy.cli, ['run', '--out', path.join(parent, 'owned.json')]);
    assert.equal(parentOut.code, 2, parentOut.stdout);
    assert.equal(parentOut.body.reason, 'overwrite_refused');
    assert.equal(parentOut.body.paymentSent, false);
    assert.deepEqual((await readdir(scripts)).sort(), before);
    await absent(path.join(scripts, 'owned.json'));

    const mid = path.join(copy.dir, 'mid');
    const top = path.join(copy.dir, 'top');
    await symlink(scripts, mid);
    await symlink(mid, top);
    const multi = await run(copy.cli, ['run', '--out', path.join(top, 'nested.json')]);
    assert.equal(multi.code, 2, multi.stdout);
    assert.equal(multi.body.reason, 'overwrite_refused');
    assert.deepEqual((await readdir(scripts)).sort(), before);
    await absent(path.join(scripts, 'nested.json'));

    const hidden = path.join(scripts, '..hidden.json');
    const dotted = await run(copy.cli, ['run', '--out', hidden]);
    assert.equal(dotted.code, 2, dotted.stdout);
    assert.equal(dotted.body.reason, 'overwrite_refused');
    await absent(hidden);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('symlinked invocation refuses skill output and still writes a new outside file', async () => {
  const copy = await installedCopy();
  try {
    const via = path.join(copy.dir, 'via-skill');
    await symlink(copy.dest, via);
    const linkedCli = path.join(via, 'scripts/cli.mjs');
    const through = await run(linkedCli, ['run', '--board', 'notion', '--out', path.join(via, 'through.json')]);
    assert.equal(through.code, 2, through.stdout + through.stderr);
    assert.equal(through.body.reason, 'overwrite_refused');
    assert.equal(through.body.result, 'refused');
    await absent(path.join(copy.dest, 'through.json'));

    const realOut = await run(linkedCli, ['run', '--board', 'notion', '--out', path.join(copy.dest, 'real-out.json')]);
    assert.equal(realOut.code, 2, realOut.stdout);
    assert.equal(realOut.body.reason, 'overwrite_refused');
    await absent(path.join(copy.dest, 'real-out.json'));

    const sentinel = path.join(copy.dir, 'keep.json');
    await writeFile(sentinel, 'KEEP');
    const kept = await run(linkedCli, ['run', '--out', sentinel]);
    assert.equal(kept.code, 2);
    assert.equal(kept.body.reason, 'overwrite_refused');
    assert.equal(await readFile(sentinel, 'utf8'), 'KEEP');

    const target = path.join(copy.dir, 'final-target.json');
    const link = path.join(copy.dir, 'final-link.json');
    await writeFile(target, 'TARGET');
    await symlink(target, link);
    const throughLink = await run(linkedCli, ['run', '--out', link]);
    assert.equal(throughLink.code, 2);
    assert.equal(throughLink.body.reason, 'overwrite_refused');
    assert.equal(await readFile(target, 'utf8'), 'TARGET');

    const fresh = path.join(copy.dir, 'fresh.json');
    const written = await run(linkedCli, ['run', '--board', 'notion', '--out', fresh]);
    assert.equal(written.code, 0, written.stdout);
    assert.equal(written.body.result, 'unknown_board');
    assert.equal(written.body.board, 'notion');
    assert.equal(written.alive, false);
    const saved = JSON.parse(await readFile(fresh, 'utf8'));
    assert.equal(saved.result, 'unknown_board');
    assert.equal(saved.paymentSent, false);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('an outside parent symlink is refused instead of followed', async () => {
  const copy = await installedCopy();
  try {
    const realOut = path.join(copy.dir, 'real-out');
    await mkdir(realOut);
    const link = path.join(copy.dir, 'out-link');
    await symlink(realOut, link);
    const result = await run(copy.cli, ['run', '--out', path.join(link, 'fresh.json')]);
    assert.equal(result.code, 2, result.stdout);
    assert.equal(result.body.reason, 'overwrite_refused');
    await absent(path.join(realOut, 'fresh.json'));
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('an ambiguous parent change is refused rather than followed into the skill', async () => {
  const copy = await installedCopy();
  try {
    const helper = await import(pathToFileURL(path.join(copy.dest, 'scripts/file-boundary.mjs')).href);
    assert.match(helper.RACE_GUARANTEE, /ambiguous parent change/);
    assert.match(helper.RACE_GUARANTEE, /not a universally race-proof check-then-open/);
    const parent = path.join(copy.dir, 'stable-parent');
    await mkdir(parent);
    const target = path.join(parent, 'fresh.json');
    await assert.rejects(
      helper.writeNewFileOutside(target, 'nope\n', [copy.dest], {
        beforeCommit: async () => {
          await rename(parent, `${parent}-real`);
          await symlink(path.join(copy.dest, 'scripts'), parent);
        },
      }),
      (error) => error.code === 'overwrite_refused',
    );
    await absent(path.join(copy.dest, 'scripts', 'fresh.json'));
    await absent(path.join(`${parent}-real`, 'fresh.json'));
    await absent(target);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('installed reader dispatch accepts a bounded LiveRamp fixture and refuses the wrong source', async () => {
  const copy = await installedCopy();
  try {
    const seedPath = path.join(copy.dir, 'seed.json');
    await writeFile(seedPath, JSON.stringify({
      schema: 'public-careers-board.supplied-seed.v1',
      responses: [{
        httpStatus: 200,
        body: {
          jobs: [{
            title: 'LiveRamp Only Role',
            location: 'Remote',
            isListed: true,
            jobUrl: 'https://jobs.ashbyhq.com/liveramp-inc/role-1',
          }],
        },
      }],
    }));
    const block = path.join(copy.dir, 'block-fetch.mjs');
    await writeFile(block, "globalThis.fetch = async () => { throw new Error('network_called'); };\n");
    const out = path.join(copy.dir, 'observation.json');
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['--import', block, copy.cli, 'run', '--board', 'liveramp', '--source', 'ashby', '--seed', seedPath, '--out', out], {
        cwd: copy.dir,
        env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.on('close', (code) => resolve({ code, stdout, body: JSON.parse(stdout) }));
    });
    assert.equal(result.code, 0, result.stdout);
    assert.equal(result.body.result, 'observation');
    assert.equal(result.body.reader, 'fetchAshby');
    assert.equal(result.body.rows[0].title, 'LiveRamp Only Role');
    assert.equal(result.body.paymentSent, false);
    assert.equal(result.body.seeded, true);
    assert.equal(JSON.parse(await readFile(out, 'utf8')).reader, 'fetchAshby');

    const wrong = await run(copy.cli, ['run', '--board', 'liveramp', '--source', 'https://liveramp.wd5.myworkdayjobs.com/wday/cxs/liveramp/LiveRampCareers/jobs']);
    assert.equal(wrong.code, 0, wrong.stdout);
    assert.equal(wrong.body.result, 'wrong_source');
    assert.equal(wrong.body.reader, 'fetchAshby');
    assert.equal(wrong.body.rows, null);
    const unknown = await run(copy.cli, ['run', '--board', 'notion']);
    assert.equal(unknown.body.result, 'unknown_board');
    assert.equal(unknown.body.reader, null);
    const paid = await run(copy.cli, ['run', '--pay', '--board', 'liveramp']);
    assert.equal(paid.code, 2);
    assert.equal(paid.body.reason, 'payment_refused');
    assert.equal(paid.body.paymentSent, false);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('installed Magnite handoff and empty coverage stay on the bounded fixture', async () => {
  const copy = await installedCopy();
  try {
    const page0 = { httpStatus: 200, body: { total: 2, jobPostings: [job('Office Manager', 'Office-Manager_R-01429')] } };
    const page1 = { httpStatus: 200, body: { total: 0, jobPostings: [job('Account Executive, Agency Sales, UK', 'Account-Executive_R-01368')] } };
    const probe = { httpStatus: 200, body: { total: 2, jobPostings: [job('Office Manager', 'Office-Manager_R-01429')] } };
    const seed = path.join(copy.dir, 'magnite-seed.json');
    await writeFile(seed, JSON.stringify({
      schema: 'public-careers-board.supplied-seed.v1',
      responses: [
        { httpStatus: 200, raw: ROBOTS_ZERO },
        { httpStatus: 200, raw: CAREERS },
        { httpStatus: 200, raw: SHELL },
        page0,
        page1,
        probe,
      ],
    }));
    const handed = await run(copy.cli, ['run', '--board', 'magnite', '--source', 'magnite-workday', '--seed', seed, '--timeout-ms', '30000'], 15000);
    assert.equal(handed.code, 0, handed.stdout + handed.stderr);
    assert.equal(handed.body.result, 'observation');
    assert.equal(handed.body.reader, 'fetchMagnite');
    assert.equal(handed.body.boardClaim, 'complete');
    assert.equal(handed.body.complete, true);
    assert.equal(handed.body.emptyBoard, false);
    assert.equal(handed.body.coverage.roleFilter, null);
    assert.equal(handed.body.rows.length, 2);
    assert.equal(handed.body.paymentSent, false);
    assert.equal(handed.body.source, JOBS);

    const emptySeed = path.join(copy.dir, 'empty-seed.json');
    await writeFile(emptySeed, JSON.stringify({
      schema: 'public-careers-board.supplied-seed.v1',
      responses: [
        { httpStatus: 200, raw: ROBOTS_ZERO },
        { httpStatus: 200, raw: CAREERS },
        { httpStatus: 200, raw: SHELL },
        { httpStatus: 200, body: { total: 0, jobPostings: [] } },
      ],
    }));
    const empty = await run(copy.cli, ['run', '--board', 'magnite-careers', '--seed', emptySeed, '--timeout-ms', '30000'], 15000);
    assert.equal(empty.code, 0, empty.stdout + empty.stderr);
    assert.equal(empty.body.boardClaim, 'empty');
    assert.equal(empty.body.emptyBoard, true);
    assert.equal(empty.body.complete, false);
    assert.equal(empty.body.rows.length, 0);
    assert.equal(empty.body.coverage.status, 'empty_board');
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('predicate input stays bounded for valid, malformed, exact, and oversized bytes', async () => {
  const copy = await installedCopy();
  try {
    const block = path.join(copy.dir, 'block-fetch.mjs');
    const log = path.join(copy.dir, 'fetch.log');
    await writeFile(block, [
      "import { appendFileSync } from 'node:fs';",
      "globalThis.fetch = async () => { appendFileSync(process.env.FETCH_LOG, 'called\\n'); throw new Error('network_called'); };",
      '',
    ].join('\n'));
    const valid = path.join(copy.dir, 'valid.json');
    await writeFile(valid, `${JSON.stringify([{ title: 'Account Executive', location: 'Remote', url: 'https://jobs.ashbyhq.com/liveramp-inc/example' }])}\n`);
    const ok = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['--import', block, copy.predicates, valid], {
        cwd: copy.dir,
        env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', FETCH_LOG: log },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      const started = Date.now();
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.on('close', (code) => resolve({ code, stdout, body: JSON.parse(stdout), ms: Date.now() - started }));
    });
    assert.equal(ok.code, 0, ok.stdout);
    assert.equal(ok.body.result, 'predicates');
    assert.equal(ok.body.appliedPredicate, null);
    assert.equal(ok.body.employmentDecision, false);
    assert.equal(ok.body.alternatives.find((item) => item.id === 'either_exact_title').matchCount, 1);
    assert.ok(ok.ms < 2000, String(ok.ms));
    assert.equal(await readFile(log, 'utf8').catch(() => ''), '');

    const malformed = path.join(copy.dir, 'bad.json');
    await writeFile(malformed, '{');
    const bad = await run(copy.predicates, [malformed]);
    assert.equal(bad.code, 2, bad.stdout);
    assert.equal(bad.body.reason, 'seed_rejected');
    assert.equal(bad.body.appliedPredicate, null);
    assert.equal(bad.body.employmentDecision, false);
    assert.equal(bad.alive, false);

    const prefix = '[{"title":"';
    const suffix = '"}]';
    const fill = INPUT_CAP - Buffer.byteLength(prefix) - Buffer.byteLength(suffix);
    assert.ok(fill > 0);
    const exactPath = path.join(copy.dir, 'exact.json');
    await writeFile(exactPath, prefix + 'A'.repeat(fill) + suffix);
    assert.equal((await lstat(exactPath)).size, INPUT_CAP);
    const exact = await run(copy.predicates, [exactPath], 8000);
    assert.equal(exact.code, 0, exact.stdout.slice(0, 300));
    assert.equal(exact.body.appliedPredicate, null);
    assert.equal(exact.body.employmentDecision, false);
    assert.equal(exact.alive, false);

    const overPath = path.join(copy.dir, 'over.json');
    await writeFile(overPath, `${prefix + 'B'.repeat(fill) + suffix} `);
    assert.equal((await lstat(overPath)).size, INPUT_CAP + 1);
    const over = await run(copy.predicates, [overPath]);
    assert.equal(over.code, 2, over.stdout);
    assert.equal(over.body.reason, 'oversized_source');
    assert.equal(over.body.appliedPredicate, null);
    assert.equal(over.body.employmentDecision, false);
    assert.equal(over.stdout.includes('BBBB'), false);

    const declared = path.join(copy.dir, 'declared.json');
    execFileSync('truncate', ['-s', '400000000', declared]);
    const declaredResult = await run(copy.predicates, [declared], 4000);
    assert.equal(declaredResult.code, 2, declaredResult.stdout);
    assert.equal(declaredResult.signal, null);
    assert.equal(declaredResult.body.reason, 'oversized_source');
    assert.equal(declaredResult.body.appliedPredicate, null);
    assert.ok(declaredResult.ms < 1000, String(declaredResult.ms));
    assert.ok(declaredResult.peakKb === 0 || declaredResult.peakKb < 250000, String(declaredResult.peakKb));
    assert.equal(declaredResult.alive, false);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('predicate FIFO, directory, and symlink inputs exit without a blocked child', async () => {
  const copy = await installedCopy();
  try {
    const fifo = path.join(copy.dir, 'input.fifo');
    execFileSync('mkfifo', [fifo]);
    const streamed = await runGroup([copy.predicates, fifo], 1800, copy.dir);
    assert.equal(streamed.timedOut, false, streamed.stderr);
    assert.equal(streamed.signal, null);
    assert.equal(streamed.code, 2, streamed.stdout);
    assert.equal(streamed.body.reason, 'seed_rejected');
    assert.equal(streamed.body.appliedPredicate, null);
    assert.equal(streamed.body.employmentDecision, false);
    assert.equal(streamed.groupAlive, false);
    assert.ok(streamed.ms < 1800, String(streamed.ms));

    const asDir = await run(copy.predicates, [copy.dir]);
    assert.equal(asDir.code, 2, asDir.stdout);
    assert.equal(asDir.body.reason, 'seed_rejected');
    assert.equal(asDir.body.appliedPredicate, null);
    assert.equal(asDir.alive, false);

    const real = path.join(copy.dir, 'real.json');
    await writeFile(real, '[{"title":"Account Executive"}]\n');
    const link = path.join(copy.dir, 'linked.json');
    await symlink(real, link);
    const linked = await run(copy.predicates, [link]);
    assert.equal(linked.code, 2, linked.stdout);
    assert.equal(linked.body.reason, 'seed_rejected');
    assert.equal(linked.body.appliedPredicate, null);
    assert.equal(linked.body.employmentDecision, false);
    assert.equal(await readFile(real, 'utf8'), '[{"title":"Account Executive"}]\n');
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('pinned predicate source and pin reads refuse symlink and byte tampering', async () => {
  const copy = await installedCopy();
  try {
    const source = path.join(copy.dest, 'sources/predicates.mjs');
    const original = await readFile(source);
    const elsewhere = path.join(copy.dir, 'moved-predicates.mjs');
    await writeFile(elsewhere, original);
    await rm(source);
    await symlink(elsewhere, source);
    const input = path.join(copy.dir, 'rows.json');
    await writeFile(input, '[{"title":"Account Executive"}]\n');
    const linked = await run(copy.predicates, [input]);
    assert.equal(linked.code, 2, linked.stdout);
    assert.equal(linked.body.reason, 'tampered_source');
    assert.equal(linked.body.appliedPredicate, null);
    assert.equal(linked.body.employmentDecision, false);
    await rm(source);
    await writeFile(source, original);

    const flipped = Buffer.from(original);
    flipped[flipped.length - 2] ^= 0x01;
    await writeFile(source, flipped);
    const changed = await run(copy.predicates, [input]);
    assert.equal(changed.code, 2, changed.stdout);
    assert.equal(changed.body.reason, 'tampered_source');
    await writeFile(source, original);

    const pin = path.join(copy.dest, 'references/source-pins.json');
    const pinBytes = await readFile(pin);
    const pinCopy = path.join(copy.dir, 'pins.json');
    await writeFile(pinCopy, pinBytes);
    await rm(pin);
    await symlink(pinCopy, pin);
    const pinLink = await run(copy.predicates, [input]);
    assert.equal(pinLink.code, 2, pinLink.stdout);
    assert.equal(pinLink.body.reason, 'tampered_source');
    assert.equal(pinLink.body.appliedPredicate, null);
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('an expired acquisition deadline refuses before returning bytes and the child can exit', async () => {
  const copy = await installedCopy();
  try {
    const helper = await import(pathToFileURL(path.join(copy.dest, 'scripts/file-boundary.mjs')).href);
    const file = path.join(copy.dir, 'small.json');
    await writeFile(file, '[{"title":"Account Executive"}]\n');
    const clock = helper.createDeadline(20);
    await new Promise((resolve) => setTimeout(resolve, 40));
    await assert.rejects(helper.readBoundedRegular(file, 1000, clock), (error) => error.code === 'deadline');
    clock.stop();
    const live = helper.createDeadline(15000);
    const bytes = await helper.readBoundedRegular(file, 1000, live);
    live.stop();
    assert.equal(JSON.parse(bytes.toString('utf8'))[0].title, 'Account Executive');

    const input = path.join(copy.dir, 'rows.json');
    await writeFile(input, '[{"title":"Account Executive"}]\n');
    const child = await runGroup([copy.predicates, input], 1800, copy.dir);
    assert.equal(child.timedOut, false);
    assert.equal(child.code, 0, child.stdout);
    assert.equal(child.body.appliedPredicate, null);
    assert.equal(child.body.employmentDecision, false);
    assert.equal(child.groupAlive, false);
    assert.ok(child.ms < 1800, String(child.ms));
  } finally { await rm(copy.dir, { recursive: true, force: true }); }
});

test('a packed skill directory runs the boundary without the workspace tree', async () => {
  const packed = mkdtempSync(path.join(tmpdir(), 'careers-pack-'));
  const archive = path.join(packed, 'skill.tar');
  const extracted = path.join(packed, 'out');
  try {
    execFileSync('tar', ['-cf', archive, '-C', path.dirname(repoSkill), 'public-careers-board']);
    execFileSync('mkdir', ['-p', extracted]);
    execFileSync('tar', ['-xf', archive, '-C', extracted]);
    const cli = path.join(extracted, 'public-careers-board/scripts/cli.mjs');
    const helper = path.join(extracted, 'public-careers-board/scripts/file-boundary.mjs');
    assert.equal((await lstat(helper)).isFile(), true);
    const fresh = path.join(packed, 'fresh.json');
    const result = await run(cli, ['run', '--board', 'notion', '--out', fresh]);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.body.result, 'unknown_board');
    assert.equal(JSON.parse(await readFile(fresh, 'utf8')).result, 'unknown_board');
    const inside = path.join(extracted, 'public-careers-board/scripts/not-created.json');
    const refused = await run(cli, ['run', '--out', inside]);
    assert.equal(refused.code, 2, refused.stdout);
    assert.equal(refused.body.reason, 'overwrite_refused');
    await absent(inside);
  } finally { await rm(packed, { recursive: true, force: true }); }
});
