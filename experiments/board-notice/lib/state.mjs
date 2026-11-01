import { randomBytes } from 'node:crypto';
import { open, readFile, rename, rm, writeFile } from 'node:fs/promises';

export const STATE_SCHEMA = 'board-notice.state.v1';
export const LOCK_SCHEMA = 'board-notice.lock.v1';

export function emptyState() {
  return { schema: STATE_SCHEMA, journeys: {} };
}

function lockPath(file) {
  return `${file}.lock`;
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

async function readLock(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { missing: true };
    return { corrupt: true };
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.schema !== LOCK_SCHEMA || !Number.isInteger(parsed.pid) || typeof parsed.token !== 'string' || !parsed.token) {
      return { corrupt: true };
    }
    return { record: parsed };
  } catch {
    return { corrupt: true };
  }
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquire(file, body, token) {
  const path = lockPath(file);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const handle = await open(path, 'wx', 0o600);
      await handle.writeFile(body);
      await handle.close();
      return true;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    const current = await readLock(path);
    if (current.missing) continue;
    if (current.record && ownerAlive(current.record.pid)) return false;
    if (current.corrupt && attempt < 2) {
      await pause(20);
      continue;
    }
    const stale = `${path}.stale-${token}`;
    try {
      await rename(path, stale);
    } catch {
      continue;
    }
    const moved = await readLock(stale);
    if (moved.record && ownerAlive(moved.record.pid)) {
      try { await rename(stale, path); } catch { /* a new owner created the path */ }
      return false;
    }
    await rm(stale, { force: true });
  }
  return false;
}

async function release(file, token) {
  const path = lockPath(file);
  const retiring = `${path}.release-${token}`;
  try {
    await rename(path, retiring);
  } catch {
    return;
  }
  const moved = await readLock(retiring);
  if (moved.record && moved.record.token === token && moved.record.pid === process.pid) {
    await rm(retiring, { force: true });
    return;
  }
  try { await rename(retiring, path); } catch { /* do not replace a live owner */ }
}

async function assertOwnLock(file, token) {
  const current = await readLock(lockPath(file));
  if (!current.record || current.record.token !== token || current.record.pid !== process.pid) {
    throw Object.assign(new Error('state_busy'), { code: 'state_busy' });
  }
}

export async function withStateOwner(file, fn) {
  const token = randomBytes(16).toString('hex');
  const body = `${JSON.stringify({
    schema: LOCK_SCHEMA,
    pid: process.pid,
    token,
    createdAt: new Date().toISOString(),
  })}\n`;
  const acquired = await acquire(file, body, token);
  if (!acquired) return { busy: true };
  try {
    return {
      busy: false,
      value: await fn({
        async commit(state) {
          await assertOwnLock(file, token);
          return writeState(file, state);
        },
      }),
    };
  } finally {
    await release(file, token);
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
