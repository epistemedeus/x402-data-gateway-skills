#!/usr/bin/env node
// Task-owned loopback so an n8n HTTP Request node can exec the journey CLI.
// It binds 127.0.0.1 only. Stop it when the run finishes. It is not a resident monitor.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const journey = resolve(dirname(fileURLToPath(import.meta.url)), 'journey.mjs');
const allowed = new Set(['skill', 'board', 'phrases', 'seed', 'state', 'sink', 'timeoutMs']);

function runJob(job) {
  const args = [
    journey,
    '--skill', job.skill,
    '--board', job.board,
    '--state', job.state,
    '--sink', job.sink,
  ];
  if (typeof job.seed === 'string') args.push('--seed', job.seed);
  if (job.timeoutMs !== undefined) args.push('--timeout-ms', String(job.timeoutMs));
  for (const phrase of job.phrases) args.push('--phrase', phrase);
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('close', (code) => {
      const text = Buffer.concat(stdout).toString('utf8').trim();
      let body = null;
      try { body = JSON.parse(text); } catch { body = { outcome: 'unreadable', raw: text }; }
      resolvePromise({ code: code ?? 1, body, stderr: Buffer.concat(stderr).toString('utf8') });
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/run') {
    res.writeHead(404);
    res.end();
    return;
  }
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    let job;
    try { job = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { job = null; }
    const keys = job && typeof job === 'object' ? Object.keys(job) : [];
    const required = ['skill', 'board', 'phrases', 'state', 'sink'];
    const seedOk = job?.seed === undefined || (typeof job.seed === 'string' && job.seed.length > 0);
    if (!job || keys.some((key) => !allowed.has(key)) || !required.every((key) => key in job) || !Array.isArray(job.phrases) || !seedOk) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ outcome: 'refused', reason: 'job_shape' }));
      return;
    }
    const result = await runJob(job);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ runnerExit: result.code, journey: result.body }));
  });
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  process.stdout.write(`${JSON.stringify({ schema: 'board-notice.runner.v1', url: `http://127.0.0.1:${address.port}/run` })}\n`);
});
