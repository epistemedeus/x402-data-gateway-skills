#!/usr/bin/env node
// Installed client for the pinned free careers recipe.
// The byte bounds match the existing acquisition helper: 100–30000 ms,
// 1024–1048576 source bytes, and 1024–1048576 output bytes. This copy does
// not import a sibling skill, so an install stays self-contained.
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, lstat, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const REFUSED = new Set(['--pay', '--settle', '--sign', '--wallet', '--purchase']);
const FLAGS = new Set(['--board', '--source', '--out', '--seed', '--timeout-ms', '--max-bytes', '--output-bytes']);
const READERS = {
  acxiom: { id: 'acxiom', reader: 'fetchAcxiom', sourceKind: 'workday', boardKey: 'acxiom' },
  acxiomllc: { id: 'acxiom', reader: 'fetchAcxiom', sourceKind: 'workday', boardKey: 'acxiom' },
  liveramp: { id: 'liveramp', reader: 'fetchAshby', sourceKind: 'ashby', boardKey: 'liverampAshby' },
  'liveramp-inc': { id: 'liveramp', reader: 'fetchAshby', sourceKind: 'ashby', boardKey: 'liverampAshby' },
  liverampashby: { id: 'liveramp', reader: 'fetchAshby', sourceKind: 'ashby', boardKey: 'liverampAshby' },
  'liveramp-ashby': { id: 'liveramp', reader: 'fetchAshby', sourceKind: 'ashby', boardKey: 'liverampAshby' },
};

const fail = (code) => Object.assign(new Error(code), { code });

export function runtimeSupported(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version || ''));
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (major > 22) return true;
  if (major < 22) return false;
  if (minor > 22) return true;
  if (minor < 22) return false;
  return patch >= 2;
}

function integer(value, min, max, code) {
  if (!/^[0-9]+$/.test(value || '')) throw fail(code);
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw fail(code);
  return number;
}

function allowance(timeoutMs, maxBytes, end = Date.now() + timeoutMs) {
  let remaining = maxBytes;
  return {
    end,
    left() {
      const ms = end - Date.now();
      if (ms <= 0) throw fail('deadline');
      return ms;
    },
    charge(bytes) {
      this.left();
      remaining -= bytes;
      if (remaining < 0) throw fail('oversized_source');
    },
    async wait(promise) {
      const ms = this.left();
      let timer;
      try {
        return await Promise.race([
          promise,
          new Promise((_, reject) => { timer = setTimeout(() => reject(fail('deadline')), ms); }),
        ]);
      } finally { clearTimeout(timer); }
    },
  };
}

async function readRegular(path, maxBytes, clock) {
  const opening = open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  let file;
  try { file = await clock.wait(opening); }
  catch (error) { void opening.then((handle) => handle.close()).catch(() => {}); throw error.code === 'deadline' ? error : fail('tampered_source'); }
  try {
    const info = await clock.wait(file.stat());
    if (!info.isFile()) throw fail('tampered_source');
    if (info.size > maxBytes) throw fail('oversized_source');
    const bytes = Buffer.alloc(info.size);
    let total = 0;
    while (total < bytes.length) {
      const result = await clock.wait(file.read(bytes, total, bytes.length - total));
      if (!result.bytesRead) break;
      total += result.bytesRead;
    }
    if (total !== info.size) throw fail('tampered_source');
    clock.charge(total);
    return bytes.subarray(0, total);
  } finally { void file.close().catch(() => {}); }
}

async function verifyRecipe(clock) {
  const pinBytes = await readRegular(resolve(root, 'references/pins.json'), 65536, clock);
  let pins;
  try { pins = JSON.parse(pinBytes.toString('utf8')); }
  catch { throw fail('tampered_source'); }
  if (!Array.isArray(pins.files) || pins.files.length !== 3) throw fail('tampered_source');
  for (const item of pins.files) {
    if (!item || typeof item.path !== 'string' || item.path.includes('..') || !item.path.startsWith('recipe/')) throw fail('tampered_source');
    const bytes = await readRegular(resolve(root, item.path), item.bytes, clock);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== item.bytes || digest !== item.sha256) throw fail('tampered_source');
  }
  return pins;
}

function parseArgs(argv) {
  if (argv.length > 24) throw fail('usage');
  if (argv.reduce((sum, value) => sum + Buffer.byteLength(value), 0) > 8192) throw fail('usage');
  const refused = [];
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (REFUSED.has(token)) { refused.push(token); continue; }
    if (!FLAGS.has(token)) throw fail('usage');
    const value = argv[i + 1];
    if (!value || value.startsWith('--') || opts[token]) throw fail('usage');
    opts[token] = value;
    i += 1;
  }
  return { refused, opts };
}

function sourceMatches(source, sourceKind, endpoint) {
  const token = source.trim();
  const lower = token.toLowerCase();
  if (lower === 'workday' || lower === 'ashby') return lower === sourceKind;
  let url;
  try { url = new URL(token); }
  catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) return false;
  return url.href === endpoint;
}

function boardClaim(coverage) {
  const status = coverage?.status;
  if (status === 'source_failure') return { boardClaim: 'source_failure', emptyBoard: false, complete: false };
  if (status === 'empty_board') return { boardClaim: 'empty', emptyBoard: true, complete: false };
  if (status === 'wrong_schema') return { boardClaim: 'wrong_schema', emptyBoard: false, complete: false };
  if (typeof status === 'string' && status.startsWith('complete_')) {
    return { boardClaim: 'complete', emptyBoard: false, complete: true };
  }
  if (typeof status === 'string' && (status.startsWith('partial') || status === 'partial')) {
    return { boardClaim: 'partial', emptyBoard: false, complete: false };
  }
  return { boardClaim: 'unclassified', emptyBoard: false, complete: false };
}

function base(extra) {
  return {
    schema: 'public-careers-board.result.v1',
    paymentSent: false,
    paidFallback: false,
    charged: false,
    useful: null,
    seeded: false,
    sourceCoverage: null,
    runtime: process.versions.node,
    ...extra,
  };
}

function seedFetch(responses, seen) {
  let index = 0;
  return async (url, init) => {
    seen.push(String(url));
    const item = responses[index] || { httpStatus: 503, body: null };
    index += 1;
    if (item.hang === true) {
      await new Promise((resolvePromise, reject) => {
        const signal = init?.signal;
        const onAbort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        if (signal?.aborted) onAbort();
        else if (signal) signal.addEventListener('abort', onAbort, { once: true });
        else reject(fail('seed_rejected'));
      });
    }
    let body;
    if (Number.isInteger(item.padTo) && item.padTo >= 0) body = Buffer.alloc(item.padTo, 0x61);
    else if (typeof item.raw === 'string') body = Buffer.from(item.raw);
    else if (item.body === undefined) body = Buffer.alloc(0);
    else body = Buffer.from(JSON.stringify(item.body));
    return new Response(body, {
      status: item.httpStatus ?? 200,
      headers: item.headers || { 'content-type': 'application/json' },
    });
  };
}

async function loadSeed(path, clock, maxBytes) {
  const bytes = await readRegular(path, maxBytes, clock).catch((error) => {
    if (error.code === 'oversized_source' || error.code === 'deadline') throw error;
    throw fail('seed_rejected');
  });
  let seed;
  try { seed = JSON.parse(bytes.toString('utf8')); }
  catch { throw fail('seed_rejected'); }
  if (seed?.schema !== 'public-careers-board.supplied-seed.v1' || !Array.isArray(seed.responses) || seed.responses.length > 8) {
    throw fail('seed_rejected');
  }
  return seed.responses;
}

function insideSkill(path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

async function writeOwned(path, line) {
  let info;
  try { info = await lstat(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw fail('overwrite_refused');
  }
  if (info) throw fail('overwrite_refused');
  if (insideSkill(path)) throw fail('overwrite_refused');
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    .catch((error) => { throw fail(error.code === 'EEXIST' || error.code === 'ELOOP' || error.code === 'EISDIR' ? 'overwrite_refused' : 'overwrite_refused'); });
  try {
    await file.writeFile(line);
  } catch (error) {
    await file.close().catch(() => {});
    await unlink(path).catch(() => {});
    throw error;
  }
  await file.close();
}

function classifyTransport(observation) {
  const requests = observation?.coverage?.requests;
  if (!Array.isArray(requests)) throw fail('failed');
  for (const entry of requests) {
    if (entry?.error === 'timeout') throw fail('timeout');
    if (entry?.error === 'response_too_large') throw fail('oversized_source');
    if (entry?.error === 'wrong_host') throw fail('unexpected_origin');
  }
  return requests;
}

export async function execute(argv) {
  const started = Date.now();
  const emit = (body, code) => ({ code, body: { ...body, elapsedMs: Date.now() - started } });
  try {
    if (!runtimeSupported(process.versions.node)) throw fail('unsupported_runtime');
    const command = argv[0];
    const { refused, opts } = parseArgs(argv.slice(1));
    if (refused.length) throw fail('payment_refused');
    if (command !== 'run') throw fail('usage');
    const timeoutMs = integer(opts['--timeout-ms'] || '15000', 100, 30000, 'usage');
    const maxBytes = integer(opts['--max-bytes'] || '1000000', 1024, 1048576, 'usage');
    const outputBytes = integer(opts['--output-bytes'] || '1048576', 1024, 1048576, 'usage');
    const clock = allowance(timeoutMs, 1048576);
    const pins = await verifyRecipe(clock);
    const board = opts['--board']?.trim() || '';
    if (!board) {
      return emit(base({
        result: 'missing_input',
        reason: 'missing_input',
        board: null,
        reader: null,
        source: null,
        rows: null,
        coverage: null,
        nextAction: 'Pass --board with one supported id: acxiom, acxiomllc, liveramp, liveramp-inc, liverampashby, or liveramp-ashby.',
      }), 0);
    }
    const reader = READERS[board];
    if (!reader) {
      return emit(base({
        result: 'unknown_board',
        reason: 'unknown_board',
        board,
        reader: null,
        source: null,
        rows: null,
        coverage: null,
        nextAction: 'That board is not supported. No source was read.',
      }), 0);
    }
    const mod = await import(pathToFileURL(resolve(root, 'recipe/boards.mjs')).href);
    const spec = mod.BOARDS[reader.boardKey];
    if (!spec?.endpoint || !spec?.boardUrl) throw fail('tampered_source');
    if (opts['--source'] && !sourceMatches(opts['--source'], reader.sourceKind, spec.endpoint)) {
      return emit(base({
        result: 'wrong_source',
        reason: 'wrong_source',
        board: reader.id,
        reader: reader.reader,
        source: null,
        rows: null,
        coverage: null,
        nextAction: 'That source is not the supported reader. Acxiom uses Workday. LiveRamp uses Ashby. No other origin is fetched.',
      }), 0);
    }
    const seen = [];
    const fetchImpl = opts['--seed']
      ? seedFetch(await loadSeed(resolve(opts['--seed']), allowance(0, maxBytes, clock.end), maxBytes), seen)
      : undefined;
    const fetchedAt = new Date().toISOString();
    const ctx = { boardUrl: spec.boardUrl, source: spec.endpoint, fetchedAt };
    const observation = await clock.wait(mod[reader.reader](ctx, { timeoutMs: clock.left(), maxBytes, fetchImpl }));
    const requests = classifyTransport(observation);
    if (requests.some((entry) => {
      try { return new URL(entry.url).host !== new URL(spec.endpoint).host; }
      catch { return true; }
    })) throw fail('unexpected_origin');
    const rows = Array.isArray(observation.rows) ? observation.rows : [];
    const claim = boardClaim(observation.coverage);
    const body = base({
      result: 'observation',
      reason: observation.coverage?.status || null,
      board: reader.id,
      reader: reader.reader,
      source: spec.endpoint,
      seeded: Boolean(opts['--seed']),
      sourceCoverage: opts['--seed'] ? 'supplied_seed' : 'live_public_https',
      recipeRevision: pins.revision,
      rows,
      coverage: observation.coverage,
      ...claim,
      elapsedMs: Date.now() - started,
      nextAction: 'Inspect coverage.status. A source failure is not an empty or complete board. Usefulness stays with the caller.',
    });
    const line = `${JSON.stringify(body)}\n`;
    if (Buffer.byteLength(line) > outputBytes) throw fail('oversized_output');
    if (opts['--out']) await writeOwned(resolve(opts['--out']), line);
    return { code: 0, body, line };
  } catch (error) {
    const reason = /^[a-z][a-z0-9_]{0,79}$/.test(error?.code || '') ? error.code : 'failed';
    const body = base({
      result: 'refused',
      reason,
      board: null,
      reader: null,
      source: null,
      rows: null,
      coverage: null,
      nextAction: reason === 'payment_refused'
        ? 'This command does not buy a careers board. Re-read the live challenge only on a separate authorized executor.'
        : 'The observation was not produced. A refusal is not an empty or complete board.',
    });
    return emit(body, 2);
  }
}

async function main() {
  const result = await execute(process.argv.slice(2));
  const line = result.line || `${JSON.stringify(result.body)}\n`;
  try {
    await new Promise((resolvePromise, reject) => {
      process.stdout.write(line, (error) => (error ? reject(error) : resolvePromise()));
    });
  } catch {
    process.exitCode = 2;
    return;
  }
  process.exitCode = result.code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
