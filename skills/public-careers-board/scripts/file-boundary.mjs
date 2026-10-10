// Standalone local-file boundary for the installed careers command.
// The read path follows the same regular-file, O_NOFOLLOW, O_NONBLOCK,
// deadline, and cap-before-unbounded-allocation rules as the proven
// readFileBounded helper. This file does not import another skill or a
// builder checkout, so a cold installed copy still resolves it.
import { constants } from 'node:fs';
import { lstat, open, realpath, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const INPUT_BYTE_CAP = 1048576;
export const PREDICATE_DEADLINE_MS = 15000;
// Supported concurrency guarantee. A check followed by an open of a path
// string is not atomic. This is not a universally race-proof check-then-open.
export const RACE_GUARANTEE = [
  'Every parent component is opened with O_DIRECTORY|O_NOFOLLOW through this process directory descriptor.',
  'A symlink parent fails that open and is refused rather than followed.',
  'The opened directory device and inode are compared with a fresh lstat of the same path.',
  'A mismatch is an ambiguous parent change and is refused rather than followed.',
  'The new name is created with O_CREAT|O_EXCL|O_NOFOLLOW on that directory descriptor, so the final component is not followed and an existing inode is not replaced.',
  'The directory descriptor, not a later path lookup, chooses where the name is created.',
  'This is not a universally race-proof check-then-open.',
].join(' ');

const fail = (code) => Object.assign(new Error(code), { code });

export function installedRoots(moduleDir) {
  const roots = [moduleDir];
  const entry = process.argv[1];
  if (!entry) return roots;
  const resolved = resolve(entry);
  if (resolved.endsWith(`${sep}scripts${sep}cli.mjs`) || resolved.endsWith(`${sep}scripts${sep}predicates.mjs`)) {
    roots.push(dirname(dirname(resolved)));
  }
  return roots;
}

function isSafeComponent(part) {
  return typeof part === 'string'
    && part.length > 0
    && part !== '.'
    && part !== '..'
    && !part.includes('/')
    && !part.includes('\0')
    && !/[\n\r]/.test(part);
}

export function createDeadline(timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw fail('deadline');
  const end = Date.now() + timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    left() {
      const ms = end - Date.now();
      if (ms <= 0 || controller.signal.aborted) throw fail('deadline');
      return ms;
    },
    async wait(promise) {
      if (controller.signal.aborted) throw fail('deadline');
      return await new Promise((resolvePromise, reject) => {
        const onAbort = () => reject(fail('deadline'));
        controller.signal.addEventListener('abort', onAbort, { once: true });
        Promise.resolve(promise).then(
          (value) => {
            controller.signal.removeEventListener('abort', onAbort);
            resolvePromise(value);
          },
          (error) => {
            controller.signal.removeEventListener('abort', onAbort);
            reject(error.code === 'deadline' ? error : error);
          },
        );
      });
    },
    stop() { clearTimeout(timer); },
  };
}

// Declared size is rejected before any content allocation. The read buffer is
// at most maxBytes+1, so a stream that grows past the cap is refused too.
export async function readBoundedRegular(filePath, maxBytes, clock) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > INPUT_BYTE_CAP) throw fail('oversized');
  const opening = open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let file;
  try {
    file = await clock.wait(opening);
  } catch (error) {
    void opening.then((handle) => handle.close()).catch(() => {});
    if (error?.code === 'deadline') throw error;
    throw fail('not_regular');
  }
  try {
    const info = await clock.wait(file.stat({ bigint: false }));
    if (!info.isFile()) throw fail('not_regular');
    if (!Number.isSafeInteger(info.size) || info.size < 0 || info.size > maxBytes) throw fail('oversized');
    const bytes = Buffer.alloc(info.size + 1);
    let total = 0;
    while (total < bytes.length) {
      const result = await clock.wait(file.read(bytes, total, bytes.length - total));
      if (!result.bytesRead) break;
      total += result.bytesRead;
      if (total > maxBytes) throw fail('oversized');
    }
    if (total > maxBytes) throw fail('oversized');
    return Buffer.from(bytes.subarray(0, total));
  } finally {
    await file.close().catch(() => {});
  }
}

async function rootIdentities(roots) {
  const found = [];
  for (const root of roots) {
    if (typeof root !== 'string' || root.length === 0) continue;
    try {
      const real = await realpath(root);
      const st = await lstat(real, { bigint: true });
      if (!st.isDirectory()) continue;
      found.push({ path: real, spelling: resolve(root), dev: st.dev, ino: st.ino });
    } catch { /* a missing spelling is not a container */ }
  }
  return found;
}

function lexicalInside(filePath, roots) {
  const abs = resolve(filePath);
  for (const root of roots) {
    if (typeof root !== 'string' || root.length === 0) continue;
    const base = resolve(root);
    const rel = relative(base, abs);
    if (rel === '' || rel === '..' || isAbsolute(rel)) {
      if (rel === '') return true;
      continue;
    }
    if (!rel.startsWith(`..${sep}`)) return true;
  }
  return false;
}

export async function openDirectoryNoFollow(dirPath) {
  const abs = resolve(dirPath);
  if (!abs.startsWith(sep)) throw fail('overwrite_refused');
  const parts = abs === sep ? [] : abs.split(sep).filter(Boolean);
  let current = await open(sep, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    for (const part of parts) {
      if (!isSafeComponent(part)) throw fail('overwrite_refused');
      let next;
      try {
        next = await open(
          `/proc/self/fd/${current.fd}/${part}`,
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
        );
      } catch {
        throw fail('overwrite_refused');
      }
      await current.close();
      current = next;
    }
    return current;
  } catch (error) {
    await current.close().catch(() => {});
    throw error;
  }
}

export async function assertDirectoryStable(dirPath, handle) {
  const listed = await lstat(dirPath, { bigint: true });
  const held = await handle.stat({ bigint: true });
  if (!listed.isDirectory() || listed.dev !== held.dev || listed.ino !== held.ino) {
    throw fail('overwrite_refused');
  }
}

async function isInsideHandle(handle, roots) {
  const identities = await rootIdentities(roots);
  if (!identities.length) throw fail('overwrite_refused');
  let walked = await open(`/proc/self/fd/${handle.fd}`, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    let located = '';
    try { located = await realpath(`/proc/self/fd/${walked.fd}`); }
    catch { return true; }
    for (const id of identities) {
      if (located === id.path || located.startsWith(`${id.path}${sep}`)) return true;
      if (located === id.spelling || located.startsWith(`${id.spelling}${sep}`)) return true;
    }
    for (let depth = 0; depth < 64; depth += 1) {
      const st = await walked.stat({ bigint: true });
      if (identities.some((id) => id.dev === st.dev && id.ino === st.ino)) return true;
      const parent = await open(`/proc/self/fd/${walked.fd}/..`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      const pst = await parent.stat({ bigint: true });
      const topped = pst.dev === st.dev && pst.ino === st.ino;
      await walked.close();
      walked = parent;
      if (topped) return false;
    }
    return true;
  } finally {
    await walked.close().catch(() => {});
  }
}

async function finalOccupied(parent, name) {
  try {
    await lstat(`/proc/self/fd/${parent.fd}/${name}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw fail('overwrite_refused');
  }
}

async function createExclusiveFile(parent, name, bytes) {
  if (!isSafeComponent(name)) throw fail('overwrite_refused');
  let file;
  try {
    file = await open(
      `/proc/self/fd/${parent.fd}/${name}`,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
  } catch {
    // The name is occupied, is a final link, or cannot be created exclusively.
    // Match the previous command: do not replace that inode.
    throw fail('overwrite_refused');
  }
  try {
    await file.writeFile(bytes);
  } catch (error) {
    await file.close().catch(() => {});
    await unlink(`/proc/self/fd/${parent.fd}/${name}`).catch(() => {});
    throw error;
  }
  await file.close();
}

export async function containedByRoots(dirPath, roots) {
  const handle = await openDirectoryNoFollow(dirPath);
  try {
    await assertDirectoryStable(dirPath, handle);
    return await isInsideHandle(handle, roots);
  } finally {
    await handle.close().catch(() => {});
  }
}

export async function createExclusiveChild(dirPath, name, bytes, roots = []) {
  const parent = await openDirectoryNoFollow(dirPath);
  try {
    await assertDirectoryStable(dirPath, parent);
    if (roots.length && await isInsideHandle(parent, roots)) throw fail('overwrite_refused');
    if (await finalOccupied(parent, name)) throw fail('overwrite_refused');
    await assertDirectoryStable(dirPath, parent);
    await createExclusiveFile(parent, name, bytes);
  } finally {
    await parent.close().catch(() => {});
  }
}

export async function writeNewFileOutside(filePath, bytes, roots, options = {}) {
  const abs = resolve(filePath);
  const parentPath = dirname(abs);
  const name = basename(abs);
  if (!isSafeComponent(name) || lexicalInside(abs, roots)) throw fail('overwrite_refused');
  const parent = await openDirectoryNoFollow(parentPath);
  try {
    if (options.beforeCommit) await options.beforeCommit({ parent: parentPath, handle: parent });
    await assertDirectoryStable(parentPath, parent);
    if (await isInsideHandle(parent, roots)) throw fail('overwrite_refused');
    if (await finalOccupied(parent, name)) throw fail('overwrite_refused');
    await assertDirectoryStable(parentPath, parent);
    await createExclusiveFile(parent, name, bytes);
  } finally {
    await parent.close().catch(() => {});
  }
}
