import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, open, readFile, rename, writeFile } from 'node:fs/promises';

export const STATE_SCHEMA = 'board-notice.state.v1';
export const LOCK_SCHEMA = 'board-notice.lock.v1';

// util-linux flock(1). The exclusive lock is the open file description, not the
// JSON body and not the directory entry. The file is never unlinked: a new inode
// would not conflict with a holder that still has the old one open.
const FLOCK = '/usr/bin/flock';

export function emptyState() {
  return { schema: STATE_SCHEMA, journeys: {} };
}

function lockPath(file) {
  return `${file}.lock`;
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function barrier(step) {
  const root = process.env.H98310_LOCK_BARRIER;
  if (!root) return;
  const steps = String(process.env.H98310_LOCK_BARRIER_STEPS || '').split(',').filter(Boolean);
  if (!steps.includes(step)) return;
  await writeFile(`${root}/${process.pid}.${step}.ready`, '');
  const go = `${root}/${process.pid}.${step}.go`;
  for (;;) {
    try {
      await access(go);
      return;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await pause(5);
    }
  }
}

function ownerAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

async function classifyBusy(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return 'unknown';
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.schema !== LOCK_SCHEMA || !Number.isInteger(parsed.pid) || parsed.pid <= 0) return 'unknown';
    return ownerAlive(parsed.pid) ? 'live' : 'dead';
  } catch {
    return 'unknown';
  }
}

function holdFlock(file) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const child = spawn(FLOCK, ['-n', '-E', '11', '--', file, '/bin/sh', '-c', "printf '%s\\n' ready; exec cat"], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ ok: false, code: 'timeout', child });
    }, 2000);
    child.stdout.on('data', (chunk) => {
      out += chunk.toString('utf8');
      if (out.includes('ready\n')) finish({ ok: true, child });
    });
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => {});
    child.on('error', (error) => finish({ ok: false, code: error?.code || 'error', error, child }));
    child.on('exit', (code) => finish({ ok: false, code: code ?? 'exit', child }));
  });
}

async function releaseHold(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try { child.stdin.end(); } catch { /* already closed */ }
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already exited */ }
      resolve();
    }, 1000);
    child.on('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function tryHold(file) {
  const acquired = await holdFlock(file);
  if (acquired.ok) return acquired;
  if (acquired.child) await releaseHold(acquired.child);
  if (acquired.error?.code === 'ENOENT' || acquired.code === 127) {
    throw Object.assign(new Error('lock_unavailable'), { code: 'lock_unavailable' });
  }
  return null;
}

async function acquire(file) {
  const path = lockPath(file);
  try {
    const handle = await open(path, 'a+', 0o600);
    await handle.chmod(0o600);
    await handle.close();
  } catch {
    return { busy: true };
  }
  await barrier('before-flock');
  let acquired = await tryHold(path);
  if (!acquired && await classifyBusy(path) === 'dead') {
    const started = Date.now();
    while (!acquired && Date.now() - started < 200) {
      await pause(10);
      acquired = await tryHold(path);
      if (!acquired && await classifyBusy(path) !== 'dead') break;
    }
  }
  if (!acquired) return { busy: true };
  try {
    await barrier('held-before-body');
    const token = randomBytes(16).toString('hex');
    const body = `${JSON.stringify({
      schema: LOCK_SCHEMA,
      pid: process.pid,
      token,
      mechanism: 'flock',
      createdAt: new Date().toISOString(),
    })}\n`;
    await writeFile(path, body, { mode: 0o600 });
    return { busy: false, path, token, child: acquired.child };
  } catch (error) {
    await releaseHold(acquired.child);
    throw error;
  }
}

async function stillOwn(path, token) {
  if (!token) return false;
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return false;
  }
  try {
    const parsed = JSON.parse(text);
    return Boolean(parsed && parsed.token === token && parsed.pid === process.pid);
  } catch {
    return false;
  }
}

export async function withStateOwner(file, fn) {
  const owned = await acquire(file);
  if (owned.busy) return { busy: true };
  try {
    return {
      busy: false,
      value: await fn({
        async commit(state) {
          if (!owned.child || owned.child.exitCode !== null || owned.child.signalCode !== null) {
            throw Object.assign(new Error('state_busy'), { code: 'state_busy' });
          }
          if (!await stillOwn(owned.path, owned.token)) {
            throw Object.assign(new Error('state_busy'), { code: 'state_busy' });
          }
          return writeState(file, state);
        },
      }),
    };
  } finally {
    await releaseHold(owned.child);
  }
}

export async function readState(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { state: emptyState(), existed: false, bytes: null };
    throw error;
  }
  let state;
  try {
    state = JSON.parse(text);
  } catch {
    throw Object.assign(new Error('state_rejected'), { code: 'state_rejected' });
  }
  if (!state || state.schema !== STATE_SCHEMA || !state.journeys || typeof state.journeys !== 'object' || Array.isArray(state.journeys)) {
    throw Object.assign(new Error('state_rejected'), { code: 'state_rejected' });
  }
  return { state, existed: true, bytes: Buffer.from(text) };
}

export async function writeState(file, state) {
  const body = `${JSON.stringify(state)}\n`;
  const next = `${file}.next`;
  await writeFile(next, body, { mode: 0o600 });
  await rename(next, file);
  return Buffer.from(body);
}
