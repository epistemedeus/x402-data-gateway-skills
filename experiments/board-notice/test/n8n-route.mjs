#!/usr/bin/env node
// Disposable proof: n8n 2.44.0 calls the journey CLI through a loopback runner.
// The process and its SQLite folder are removed at the end. This is not a resident monitor.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const repo = '/home/ubuntu/ae14-work/h98310';
const experiment = path.join(repo, 'experiments/board-notice');
const skill = path.join(repo, 'skills/public-careers-board');
const fixtures = path.join(experiment, 'fixtures');
const node24 = '/tmp/h98310-tools/node-v24.22.2-linux-x64/bin/node';
const n8nBin = '/tmp/h98310-tools/n8n-app/node_modules/n8n/bin/n8n';
const node22 = process.execPath;
const ADMISSION_KIB = 2097152;
const workflowFile = path.join(experiment, 'workflow/board-notice.inactive.n8n.json');

const report = {
  schema: 'board-notice.n8n-evidence.v1',
  startedAt: new Date().toISOString(),
  node22: process.version,
  publicGets: 0,
  exactlyOnce: false,
  exactlyOnceMail: false,
  transport: 'loopback-http',
  scheduler: false,
  commands: [],
  cases: [],
  memory: [],
};
const root = fs.mkdtempSync('/tmp/h98310-n8n-');
const storeA = path.join(root, 'store-a');
const storeB = path.join(root, 'store-b');
const work = path.join(root, 'work');
fs.mkdirSync(work, { recursive: true });
const encryptionKey = crypto.randomBytes(24).toString('hex');
const ownerSecret = crypto.randomBytes(18).toString('hex');
let port = 0;
let broker = 0;
let engine = null;
let runner = null;
let sink = null;
let runnerUrl = '';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function note(line) {
  process.stderr.write(`${line}\n`);
}

function pgidOf(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return Number(rest[2] || 0);
  } catch {
    return 0;
  }
}

function sampleRss(where) {
  const roots = [process.pid];
  if (engine?.pid) roots.push(engine.pid);
  if (runner?.pid) roots.push(runner.pid);
  const entries = [];
  const children = new Map();
  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    let status = '';
    try { status = fs.readFileSync(`/proc/${pid}/status`, 'utf8'); }
    catch { continue; }
    const ppid = Number(status.match(/PPid:\s+(\d+)/)?.[1] || 0);
    const rss = Number(status.match(/VmRSS:\s+(\d+)/)?.[1] || 0);
    let command = '';
    try { command = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ').trim(); }
    catch { command = ''; }
    if (!command) command = status.match(/^Name:\s+(.+)$/m)?.[1] || '';
    entries.push({ pid, ppid, rss, command: command.slice(0, 160) });
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  const owned = new Set();
  const stack = [...roots];
  while (stack.length) {
    const pid = stack.pop();
    if (!pid || owned.has(pid)) continue;
    owned.add(pid);
    for (const child of children.get(pid) || []) stack.push(child);
  }
  const groups = new Set(roots.map(pgidOf).filter(Boolean));
  for (const item of entries) {
    if (groups.has(pgidOf(item.pid))) owned.add(item.pid);
  }
  const processes = entries.filter((item) => owned.has(item.pid));
  const ownedRssKiB = processes.reduce((total, item) => total + item.rss, 0);
  const sample = {
    where,
    at: new Date().toISOString(),
    ownedRssKiB,
    processCount: processes.length,
    withinAdmission: ownedRssKiB <= ADMISSION_KIB,
    processes,
  };
  if (!report.peak || sample.ownedRssKiB > report.peak.ownedRssKiB) report.peak = sample;
  report.memory.push(sample);
  note(`memory ${where} ownedRssKiB=${ownedRssKiB} processes=${processes.length} within=${sample.withinAdmission}`);
  assert(sample.withinAdmission, `owned RSS ${ownedRssKiB} KiB exceeds ${ADMISSION_KIB} at ${where}`);
  return sample;
}

function n8nEnv(folder) {
  return {
    PATH: `/tmp/h98310-tools/node-v24.22.2-linux-x64/bin:${process.env.PATH || ''}`,
    HOME: process.env.HOME,
    TMPDIR: '/tmp',
    LANG: process.env.LANG || 'C.UTF-8',
    USER: process.env.USER || 'ubuntu',
    N8N_USER_FOLDER: folder,
    N8N_ENCRYPTION_KEY: encryptionKey,
    N8N_DIAGNOSTICS_ENABLED: 'false',
    N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
    N8N_TEMPLATES_ENABLED: 'false',
    N8N_HIRING_BANNER_ENABLED: 'false',
    N8N_PERSONALIZATION_ENABLED: 'false',
    N8N_PUBLIC_API_DISABLED: 'true',
    N8N_METRICS: 'false',
    N8N_LISTEN_ADDRESS: '127.0.0.1',
    N8N_PORT: String(port),
    N8N_RUNNERS_MODE: 'internal',
    N8N_RUNNERS_BROKER_PORT: String(broker),
    N8N_RUNNERS_BROKER_LISTEN_ADDRESS: '127.0.0.1',
    N8N_RUNNERS_MAX_OLD_SPACE_SIZE: '256',
    N8N_RUNNERS_MAX_CONCURRENCY: '1',
    NODE_OPTIONS: '--max-old-space-size=512',
    DB_TYPE: 'sqlite',
    GENERIC_TIMEZONE: 'UTC',
    N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'false',
    N8N_INSTANCE_OWNER_MANAGED_BY_ENV: 'true',
    N8N_INSTANCE_OWNER_EMAIL: 'h98310-local@example.com',
    N8N_INSTANCE_OWNER_FIRST_NAME: 'Local',
    N8N_INSTANCE_OWNER_LAST_NAME: 'Owner',
    N8N_INSTANCE_OWNER_PASSWORD_HASH: ownerHash(),
    EXECUTIONS_TIMEOUT: '60',
    EXECUTIONS_TIMEOUT_MAX: '90',
  };
}

let cachedHash = '';
function ownerHash() {
  if (cachedHash) return cachedHash;
  const require = createRequire(n8nBin);
  cachedHash = require('bcryptjs').hashSync(ownerSecret, 8);
  return cachedHash;
}

function runCommand(args, env, timeoutMs = 120000) {
  const started = Date.now();
  note(`$ node24 ${args.join(' ')}`);
  const child = spawnSync(node24, args, { env, cwd: root, encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGKILL' });
  const record = {
    cmd: `node24 ${args.join(' ')}`,
    exit: child.status,
    signal: child.signal || null,
    ms: Date.now() - started,
  };
  report.commands.push(record);
  note(`exit ${child.status} signal ${child.signal || ''} ${record.ms}ms`);
  if (child.stdout?.trim()) note(child.stdout.trim().slice(-800));
  if (child.stderr?.trim()) {
    fs.writeFileSync('/tmp/h98310-n8n-cli-stderr.txt', child.stderr);
    note(child.stderr.trim().slice(-800));
  }
  return child;
}

function n8n(args, folder) {
  const result = runCommand([n8nBin, ...args], n8nEnv(folder));
  assert(result.status === 0, `n8n ${args.join(' ')} exited ${result.status}\n${(result.stderr || '').slice(-1500)}`);
  return result;
}

function workflowIds(output) {
  const text = `${output.stdout || ''}\n${output.stderr || ''}`;
  const ids = [];
  for (const line of text.split('\n')) {
    const first = line.trim().split('|')[0].trim();
    if (/^[A-Za-z0-9]{10,}$/.test(first)) ids.push(first);
  }
  return ids;
}

function killGroup(pid, signal) {
  if (!pid) return;
  try { process.kill(-pid, signal); }
  catch { try { process.kill(pid, signal); } catch { /* already gone */ } }
}

function startEngine(folder) {
  note(`n8n start port=${port}`);
  const child = spawn(node24, [n8nBin, 'start'], {
    cwd: root,
    env: n8nEnv(folder),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  engine = child;
  let out = '';
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`n8n did not become ready\n${out.slice(-4000)}`)), 120000);
    const onData = (chunk) => {
      out += chunk;
      if (/Finished building workflow dependency index/.test(out) && /published workflows/.test(out)) {
        clearTimeout(timer);
        resolve(out);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`n8n exited ${code} ${signal} before ready\n${out.slice(-4000)}`));
    });
  });
  return { child, ready };
}

function startRunner() {
  const child = spawn(node22, [path.join(experiment, 'bin/loopback-runner.mjs')], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  runner = child;
  return new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`runner silent ${out}`)), 5000);
    child.stdout.on('data', (chunk) => {
      out += chunk;
      const line = out.split('\n').find((item) => item.startsWith('{'));
      if (!line) return;
      clearTimeout(timer);
      resolve(JSON.parse(line).url);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`runner exited ${code}`));
    });
  });
}

function startSink() {
  const received = [];
  let mode = 'accept';
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      let body = null;
      try { body = JSON.parse(text); } catch { body = { raw: text }; }
      received.push({ mode, body });
      try { sampleRss(`sink-${mode}`); }
      catch (error) {
        if (String(error?.message || error).includes('exceeds')) throw error;
      }
      if (mode === 'reject') {
        res.writeHead(500);
        res.end('no');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ delivery: 'accepted', noticeId: body?.url }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}/notice`,
        received,
        setMode(next) { mode = next; },
        close() { return new Promise((done) => server.close(() => done())); },
      });
    });
  });
}

function direct(job) {
  const args = [
    path.join(experiment, 'bin/journey.mjs'),
    '--skill', job.skill,
    '--board', job.board,
    '--seed', job.seed,
    '--state', job.state,
    '--sink', job.sink,
    '--timeout-ms', String(job.timeoutMs || 15000),
  ];
  for (const phrase of job.phrases) args.push('--phrase', phrase);
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(node22, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => chunk);
    child.on('close', (code, signal) => {
      const text = Buffer.concat(stdout).toString('utf8').trim();
      let journey = null;
      try { journey = JSON.parse(text); }
      catch { journey = { outcome: 'unreadable', raw: text.slice(0, 400) }; }
      report.commands.push({
        cmd: `node22 bin/journey.mjs --board ${job.board}`,
        exit: code,
        signal: signal || null,
        ms: Date.now() - started,
      });
      resolve({ exit: code, journey });
    });
  });
}

function project(journey) {
  return {
    outcome: journey?.outcome ?? null,
    reason: journey?.reason ?? null,
    board: journey?.board ?? null,
    boardClaim: journey?.boardClaim ?? null,
    notices: (journey?.notices || []).map((notice) => ({
      title: notice.title ?? null,
      delivery: notice.delivery ?? null,
      url: notice.url ?? null,
    })),
    seenCount: journey?.seenCount ?? null,
    duplicateUrls: journey?.duplicateUrls ?? null,
    exactlyOnce: journey?.exactlyOnce ?? null,
    exactlyOnceMail: journey?.exactlyOnceMail ?? null,
    stateChanged: journey?.stateChanged ?? null,
  };
}

function readState(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function journeyOf(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.journey?.schema === 'board-notice.journey.v1') return payload.journey;
  if (payload.schema === 'board-notice.journey.v1') return payload;
  if (payload.body?.journey?.schema === 'board-notice.journey.v1') return payload.body.journey;
  return null;
}

async function viaN8n(job) {
  const started = Date.now();
  const response = await fetch(`http://127.0.0.1:${port}/webhook/h98310-board-notice`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runnerUrl, job }),
  });
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch { payload = null; }
  const journey = journeyOf(payload);
  report.commands.push({
    cmd: `POST /webhook/h98310-board-notice board=${job.board}`,
    exit: journey ? 0 : 1,
    http: response.status,
    ms: Date.now() - started,
  });
  if (!journey) {
    fs.writeFileSync('/tmp/h98310-n8n-bad-response.txt', text.slice(0, 4000));
    throw new Error(`webhook status ${response.status}: ${text.slice(0, 800)}`);
  }
  return { http: response.status, journey, text };
}

async function pair(name, spec) {
  const base = {
    skill,
    board: spec.board,
    phrases: spec.phrases,
    seed: spec.seed,
    sink: sink.url,
    timeoutMs: spec.timeoutMs || 15000,
  };
  const n8nResult = await viaN8n({ ...base, state: spec.n8nState });
  const directResult = await direct({ ...base, state: spec.directState });
  const n8nProject = project(n8nResult.journey);
  const directProject = project(directResult.journey);
  const same = JSON.stringify(n8nProject) === JSON.stringify(directProject);
  const n8nState = readState(spec.n8nState);
  const directState = readState(spec.directState);
  const sameState = JSON.stringify(n8nState) === JSON.stringify(directState);
  const row = {
    name,
    same,
    sameState,
    n8nHttp: n8nResult.http,
    directExit: directResult.exit,
    n8n: n8nProject,
    direct: directProject,
  };
  report.cases.push(row);
  note(`case ${name} same=${same} sameState=${sameState} outcome=${n8nProject.outcome}`);
  assert(same && sameState, `route mismatch on ${name}: ${JSON.stringify(row)}`);
  assert(n8nProject.exactlyOnce === false && n8nProject.exactlyOnceMail === false, `${name} claimed exactly-once`);
  if (spec.board === 'magnite') {
    assert(!n8nResult.text.includes('super-secret-token-value'), 'shell token leaked through n8n');
    assert(!JSON.stringify(directResult.journey).includes('super-secret-token-value'), 'shell token leaked through the direct route');
  }
  return row;
}

async function waitForWebhook() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:${port}/webhook/h98310-board-notice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runnerUrl: 'http://127.0.0.1:9/run', job: {} }),
    });
    const text = await response.text();
    if (!text.includes('is not registered')) {
      note(`webhook registered after ${attempt} probe(s), status ${response.status}`);
      report.webhookProbes = report.webhookProbes || [];
      report.webhookProbes.push({ attempts: attempt, status: response.status });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('production webhook stayed unregistered');
}

function sqliteBytes(folder) {
  const candidates = [
    path.join(folder, 'database.sqlite'),
    path.join(folder, '.n8n/database.sqlite'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return { file, bytes: fs.statSync(file).size };
  }
  return null;
}

function skillDiff() {
  const result = spawnSync('git', ['diff', '--exit-code', '--', 'skills/public-careers-board', 'plugins/public-careers-board'], {
    cwd: repo,
    encoding: 'utf8',
  });
  return result.status;
}

async function main() {
  assert(fs.existsSync(node24), 'node 24 missing');
  assert(fs.existsSync(n8nBin), 'n8n bin missing');
  assert(skillDiff() === 0, 'skill or plugin already dirty');
  const sourceWorkflow = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));
  assert(sourceWorkflow.active === false, 'workflow source must stay inactive');
  port = 18771;
  broker = 18772;
  const setupStarted = Date.now();
  const version = runCommand([n8nBin, '--version'], n8nEnv(storeA));
  assert(version.status === 0, 'n8n --version failed');
  assert(`${version.stdout}\n${version.stderr}`.includes('2.44.0'), `unexpected version ${version.stdout}`);
  report.n8nVersion = '2.44.0';
  report.license = 'Sustainable Use License v1.0 (npm license field: SEE LICENSE IN LICENSE.md)';
  report.isolatedVm = '7.0.2 rebuilt locally against Node 24.22.2 after the downloaded binary failed to load';
  sampleRss('before-import');

  n8n(['import:workflow', '--input', workflowFile], storeA);
  const listedA = n8n(['list:workflow', '--onlyId'], storeA);
  const activeA = n8n(['list:workflow', '--active=true', '--onlyId'], storeA);
  assert((activeA.stdout || '').trim() === '', `store A published unexpectedly: ${activeA.stdout}`);
  const exportA = path.join(work, 'export-a.json');
  n8n(['export:workflow', '--all', '--output', exportA], storeA);
  const exportedA = JSON.parse(fs.readFileSync(exportA, 'utf8'));
  assert(Array.isArray(exportedA) && exportedA.length === 1, 'store A export shape');
  assert(exportedA[0].active === false, 'imported workflow became active');
  assert(exportedA[0].staticData == null, 'static data was not left null');
  n8n(['import:workflow', '--input', exportA], storeB);
  const exportB = path.join(work, 'export-b.json');
  n8n(['export:workflow', '--all', '--output', exportB], storeB);
  const exportedB = JSON.parse(fs.readFileSync(exportB, 'utf8'));
  assert(exportedB.length === 1 && exportedB[0].active === false, 'store B was not inactive');
  assert(exportedB[0].nodes.map((node) => node.name).join('|') === exportedA[0].nodes.map((node) => node.name).join('|'), 'reimport renamed nodes');
  const idB = workflowIds(n8n(['list:workflow', '--onlyId'], storeB))[0];
  assert(idB, 'store B id missing');
  n8n(['publish:workflow', '--id', idB], storeB);
  const published = n8n(['list:workflow', '--active=true', '--onlyId'], storeB);
  assert(`${published.stdout}\n${published.stderr}`.includes(idB), 'publish did not mark the workflow active');
  const stillInactive = JSON.parse(fs.readFileSync(workflowFile, 'utf8'));
  assert(stillInactive.active === false, 'git workflow file was activated');
  report.import = {
    storeAId: workflowIds(listedA)[0] || null,
    storeBId: idB,
    inactiveBeforePublish: true,
    sourceFileActive: false,
    nodeNames: exportedB[0].nodes.map((node) => node.name),
    staticData: exportedA[0].staticData,
    sqliteA: sqliteBytes(storeA),
    sqliteB: sqliteBytes(storeB),
  };
  report.setupMs = Date.now() - setupStarted;

  runnerUrl = await startRunner();
  sink = await startSink();
  report.runnerUrlHost = '127.0.0.1';
  const started = startEngine(storeB);
  const engineLog = await started.ready;
  fs.writeFileSync(path.join(work, 'n8n-engine.log'), engineLog);
  assert(/, [1-9]\d* published workflows/.test(engineLog), 'engine did not publish a workflow');
  await waitForWebhook();
  sampleRss('engine-ready');
  report.engineReadyMs = Date.now() - setupStarted;

  const phrases = ['account executive'];
  const n8nMain = path.join(work, 'main-n8n.json');
  const directMain = path.join(work, 'main-direct.json');
  const executionStarted = Date.now();
  const baseline = await pair('baseline', {
    board: 'acxiom', phrases, n8nState: n8nMain, directState: directMain,
    seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
  });
  assert(baseline.n8n.outcome === 'baseline' && baseline.n8n.notices.length === 0 && baseline.n8n.seenCount === 2, 'baseline flooded or missed rows');
  const repeat = await pair('repeat', {
    board: 'acxiom', phrases, n8nState: n8nMain, directState: directMain,
    seed: path.join(fixtures, 'acxiom-baseline.seed.json'),
  });
  assert(repeat.n8n.outcome === 'unchanged' && repeat.n8n.notices.length === 0, 'repeat notified');
  sink.setMode('reject');
  const rejected = await pair('notice-rejected', {
    board: 'acxiom', phrases, n8nState: n8nMain, directState: directMain,
    seed: path.join(fixtures, 'acxiom-new.seed.json'),
  });
  assert(rejected.n8n.outcome === 'notice_failed' && rejected.n8n.notices[0].delivery === 'rejected', 'rejection was not preserved');
  assert(rejected.n8n.seenCount === 2, 'rejected notice was committed');
  report.executionMs = Date.now() - executionStarted;

  const recoveryStarted = Date.now();
  note('SIGKILL n8n');
  killGroup(engine.pid, 'SIGKILL');
  engine = null;
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const restarted = startEngine(storeB);
  await restarted.ready;
  await waitForWebhook();
  report.recoveryMs = Date.now() - recoveryStarted;
  sampleRss('after-restart');
  const storedAfterKill = readState(n8nMain);
  assert(storedAfterKill.journeys[Object.keys(storedAfterKill.journeys)[0]].seen.length === 2, 'kill mutated seen set');

  sink.setMode('accept');
  const accepted = await pair('notice-after-restart', {
    board: 'acxiom', phrases, n8nState: n8nMain, directState: directMain,
    seed: path.join(fixtures, 'acxiom-new.seed.json'),
  });
  assert(accepted.n8n.outcome === 'notice' && accepted.n8n.notices.length === 1 && accepted.n8n.notices[0].delivery === 'accepted', 'restart did not deliver the new match once');
  const quiet = await pair('repeat-after-notice', {
    board: 'acxiom', phrases, n8nState: n8nMain, directState: directMain,
    seed: path.join(fixtures, 'acxiom-new.seed.json'),
  });
  assert(quiet.n8n.outcome === 'unchanged' && quiet.n8n.notices.length === 0, 'accepted notice repeated');
  const acceptedPosts = sink.received.filter((item) => item.body?.title === 'Account Executive, New Role' && item.mode === 'accept');
  assert(acceptedPosts.length === 2, `expected one accept per route, got ${acceptedPosts.length}`);

  const changed = await pair('changed-board', {
    board: 'liveramp', phrases, n8nState: n8nMain, directState: directMain,
    seed: path.join(fixtures, 'liveramp-one.seed.json'),
  });
  assert(changed.n8n.outcome === 'baseline' && changed.n8n.board === 'liveramp' && changed.n8n.notices.length === 0, 'changed board notified on first sight');
  const acxiomSeen = Object.values(readState(n8nMain).journeys).find((item) => item.board === 'acxiom').seen;
  assert(acxiomSeen.length === 3, 'acxiom seen set changed while baselining liveramp');

  await pair('empty', {
    board: 'acxiom', phrases,
    n8nState: path.join(work, 'empty-n8n.json'),
    directState: path.join(work, 'empty-direct.json'),
    seed: path.join(fixtures, 'acxiom-empty.seed.json'),
  });
  assert(report.cases.at(-1).n8n.outcome === 'baseline' && report.cases.at(-1).n8n.reason === 'empty_board', 'empty was not a baseline');
  await pair('source-failure', {
    board: 'liveramp', phrases,
    n8nState: path.join(work, 'fail-n8n.json'),
    directState: path.join(work, 'fail-direct.json'),
    seed: path.join(fixtures, 'liveramp-failure.seed.json'),
  });
  assert(report.cases.at(-1).n8n.outcome === 'source_failure' && report.cases.at(-1).sameState && readState(path.join(work, 'fail-n8n.json')) === null, 'failure wrote state');
  await pair('partial', {
    board: 'acxiom', phrases,
    n8nState: path.join(work, 'partial-n8n.json'),
    directState: path.join(work, 'partial-direct.json'),
    seed: path.join(fixtures, 'acxiom-partial.seed.json'),
  });
  assert(report.cases.at(-1).n8n.boardClaim === 'partial' && readState(path.join(work, 'partial-n8n.json')) === null, 'partial baselined');
  await pair('duplicate', {
    board: 'acxiom', phrases,
    n8nState: path.join(work, 'dup-n8n.json'),
    directState: path.join(work, 'dup-direct.json'),
    seed: path.join(fixtures, 'acxiom-duplicate.seed.json'),
  });
  assert(report.cases.at(-1).n8n.seenCount === 1 && report.cases.at(-1).n8n.duplicateUrls >= 1, 'duplicates were not collapsed');
  await pair('wrong-shape', {
    board: 'liveramp', phrases,
    n8nState: path.join(work, 'shape-n8n.json'),
    directState: path.join(work, 'shape-direct.json'),
    seed: path.join(fixtures, 'liveramp-shape.seed.json'),
  });
  assert(report.cases.at(-1).n8n.outcome === 'incomplete' && readState(path.join(work, 'shape-n8n.json')) === null, 'wrong shape wrote state');
  const magnite = await pair('magnite', {
    board: 'magnite', phrases,
    n8nState: path.join(work, 'magnite-n8n.json'),
    directState: path.join(work, 'magnite-direct.json'),
    seed: path.join(fixtures, 'magnite-one.seed.json'),
    timeoutMs: 20000,
  });
  assert(magnite.n8n.outcome === 'baseline' && magnite.n8n.notices.length === 0, 'magnite baseline notified');
  assert(!JSON.stringify(magnite).includes('super-secret-token-value'), 'shell token leaked into the comparison');

  sampleRss('after-cases');
  report.skillDiffExit = skillDiff();
  report.workflowFileActive = JSON.parse(fs.readFileSync(workflowFile, 'utf8')).active;
  report.sqliteAfter = sqliteBytes(storeB);
  assert(report.skillDiffExit === 0, 'skill or plugin bytes changed');
  assert(report.workflowFileActive === false, 'workflow file activated');
  report.finishedAt = new Date().toISOString();
  report.caseCount = report.cases.length;
  report.mismatchCount = report.cases.filter((item) => !item.same || !item.sameState).length;
  const evidence = path.join(experiment, 'evidence/n8n-route.json');
  fs.writeFileSync(evidence, `${JSON.stringify(report, null, 2)}\n`);
  note(`wrote ${evidence}`);
}

try {
  await main();
} catch (error) {
  report.error = String(error && error.stack ? error.stack : error).slice(0, 4000);
  fs.writeFileSync('/tmp/h98310-n8n-evidence-partial.json', `${JSON.stringify(report, null, 2)}\n`);
  note(report.error);
  process.exitCode = 1;
} finally {
  if (engine) killGroup(engine.pid, 'SIGTERM');
  if (runner) killGroup(runner.pid, 'SIGTERM');
  if (sink) await sink.close();
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (engine) killGroup(engine.pid, 'SIGKILL');
  if (runner) killGroup(runner.pid, 'SIGKILL');
  if (process.exitCode && process.exitCode !== 0) note(`left ${root} for inspection`);
  else fs.rmSync(root, { recursive: true, force: true });
}
