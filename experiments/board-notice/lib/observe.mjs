import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function observeBoard({ skill, board, seed, timeoutMs }) {
  const cli = resolve(skill, 'scripts/cli.mjs');
  try {
    await access(cli);
  } catch {
    throw Object.assign(new Error('skill_missing'), { code: 'skill_missing' });
  }
  const args = [
    cli,
    'run',
    '--board', board,
    '--timeout-ms', String(timeoutMs),
  ];
  if (seed != null) {
    try {
      await access(seed);
    } catch {
      throw Object.assign(new Error('seed_rejected'), { code: 'seed_rejected' });
    }
    args.push('--seed', seed);
  }
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: resolve(skill),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const text = Buffer.concat(stdout).toString('utf8');
      const line = text.trim();
      let body = null;
      try { body = JSON.parse(line); } catch { body = null; }
      resolvePromise({
        code: code ?? 1,
        body,
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}
