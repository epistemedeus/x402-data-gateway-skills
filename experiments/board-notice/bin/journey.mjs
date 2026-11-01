#!/usr/bin/env node
import { resolve } from 'node:path';
import { runJourney } from '../lib/run.mjs';

function take(argv) {
  const options = { phrases: [] };
  const keys = {
    '--skill': 'skill',
    '--board': 'board',
    '--seed': 'seed',
    '--state': 'state',
    '--sink': 'sink',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--phrase') {
      options.phrases.push(next);
      i += 1;
      continue;
    }
    if (arg === '--timeout-ms') {
      options.timeoutMs = Number(next);
      i += 1;
      continue;
    }
    if (keys[arg]) {
      options[keys[arg]] = next;
      i += 1;
      continue;
    }
    throw Object.assign(new Error('usage'), { code: 'usage' });
  }
  if (!options.board) {
    throw Object.assign(new Error('board_required'), { code: 'board_required' });
  }
  if (!options.skill || !options.state || !options.sink) {
    throw Object.assign(new Error('usage'), { code: 'usage' });
  }
  if (Object.hasOwn(options, 'seed')) {
    if (typeof options.seed !== 'string' || options.seed.length === 0 || options.seed.startsWith('--')) {
      throw Object.assign(new Error('seed_rejected'), { code: 'seed_rejected' });
    }
    options.seed = resolve(options.seed);
  }
  if (options.timeoutMs === undefined) options.timeoutMs = 15000;
  options.skill = resolve(options.skill);
  options.state = resolve(options.state);
  return options;
}

const started = Date.now();
try {
  const result = await runJourney(take(process.argv.slice(2)));
  const body = { ...result.body, elapsedMs: Date.now() - started };
  process.stdout.write(`${JSON.stringify(body)}\n`);
  process.exitCode = result.code;
} catch (error) {
  const reason = typeof error?.code === 'string' ? error.code : 'failed';
  const body = {
    schema: 'board-notice.journey.v1',
    outcome: 'refused',
    reason,
    notices: [],
    exactlyOnce: false,
    exactlyOnceMail: false,
    stateChanged: false,
    statePreserved: true,
    applyRequested: false,
    elapsedMs: Date.now() - started,
  };
  process.stdout.write(`${JSON.stringify(body)}\n`);
  process.exitCode = 2;
}
