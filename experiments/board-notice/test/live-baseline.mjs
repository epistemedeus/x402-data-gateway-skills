#!/usr/bin/env node
// One credential-free LiveRamp Ashby baseline. A second run sees the evidence file and does not fetch.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const experiment = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(experiment, '../..');
const evidence = path.join(experiment, 'evidence/live-baseline.json');
const skill = path.join(repo, 'skills/public-careers-board');
const journey = path.join(experiment, 'bin/journey.mjs');

try {
  await access(evidence);
  process.stdout.write('live baseline evidence already exists; not fetching again\n');
  process.exit(0);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const work = await mkdtemp(path.join(tmpdir(), 'h98310-live-'));
const received = [];
const sink = await new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      received.push(Buffer.concat(chunks).length);
      res.writeHead(204);
      res.end();
    });
  });
  server.listen(0, '127.0.0.1', () => {
    resolve({
      url: `http://127.0.0.1:${server.address().port}/notice`,
      close: () => new Promise((done) => server.close(done)),
    });
  });
});

const childArgs = [
  journey,
  '--skill', skill,
  '--board', 'liveramp',
  '--state', path.join(work, 'state.json'),
  '--sink', sink.url,
  '--phrase', 'account executive',
  '--timeout-ms', '20000',
];

let result = { code: 1, body: null, stderrBytes: 0 };
try {
  result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, childArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const text = Buffer.concat(stdout).toString('utf8').trim();
      let body = null;
      try { body = JSON.parse(text); } catch { body = null; }
      resolve({ code, body, stderrBytes: Buffer.concat(stderr).length });
    });
  });
} finally {
  await sink.close();
  await rm(work, { recursive: true, force: true });
}

const body = result.body || {};
const projection = {
  schema: 'board-notice.live-baseline.v1',
  scope: 'one credential-free LiveRamp Ashby GET through the unchanged reader',
  board: body.board ?? 'liveramp',
  reader: body.reader ?? null,
  outcome: body.outcome ?? null,
  reason: body.reason ?? null,
  boardClaim: body.boardClaim ?? null,
  seeded: body.seeded ?? null,
  sourceCoverage: body.sourceCoverage ?? null,
  requestCount: body.requestCount ?? null,
  notices: Array.isArray(body.notices) ? body.notices.length : null,
  sinkPosts: received.length,
  exactlyOnce: body.exactlyOnce === true,
  exactlyOnceMail: body.exactlyOnceMail === true,
  exit: result.code,
  stderrBytes: result.stderrBytes,
  publicGets: 1,
  fetchedAt: new Date().toISOString(),
};
await writeFile(evidence, `${JSON.stringify(projection, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(projection)}\n`);
const ok = projection.reader === 'fetchAshby'
  && projection.seeded === false
  && projection.sourceCoverage === 'live_public_https'
  && projection.requestCount === 1
  && projection.notices === 0
  && projection.sinkPosts === 0
  && (projection.outcome === 'baseline' || projection.outcome === 'empty')
  && projection.exit === 0;
if (!ok) process.exitCode = 1;
