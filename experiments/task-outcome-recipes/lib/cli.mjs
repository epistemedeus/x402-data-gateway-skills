import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const guard = fileURLToPath(new URL('./offline-guard.mjs', import.meta.url));

export function runNode(script, args, { cwd, timeoutMs = 20000 } = {}) {
  const env = { ...process.env, NO_COLOR: '1' };
  delete env.FORCE_COLOR;
  const child = spawnSync(process.execPath, ['--import', guard, script, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    env,
  });
  let body = null;
  try {
    body = JSON.parse(child.stdout);
  } catch {
    body = null;
  }
  return {
    status: child.status,
    signal: child.signal,
    body,
    stdout: child.stdout,
    stderr: child.stderr,
    error: child.error ?? null,
  };
}

export function repoRoot() {
  return path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
}
