#!/usr/bin/env node
// Apply the unselected Magnite title readings to an observation file.
// This command does not fetch a board and does not choose a predicate.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REFUSED = new Set(['--pay', '--settle', '--sign', '--wallet', '--purchase']);

function emit(code, body) {
  process.stdout.write(`${JSON.stringify(body)}\n`);
  process.exitCode = code;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => REFUSED.has(arg))) {
    emit(2, { result: 'refused', reason: 'payment_refused', appliedPredicate: null, employmentDecision: false });
    return;
  }
  if (args.length !== 1 || args[0].startsWith('--') || args[0].includes('://')) {
    emit(2, { result: 'refused', reason: 'usage', appliedPredicate: null, employmentDecision: false });
    return;
  }
  const pin = JSON.parse(await readFile(resolve(root, 'references/source-pins.json'), 'utf8'));
  const item = pin.files?.find((entry) => entry.path === 'sources/predicates.mjs');
  const bytes = await readFile(resolve(root, 'sources/predicates.mjs'));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (!item || bytes.length !== item.bytes || digest !== item.sha256) {
    emit(2, { result: 'refused', reason: 'tampered_source', appliedPredicate: null, employmentDecision: false });
    return;
  }
  const inputBytes = await readFile(resolve(args[0]));
  if (inputBytes.length > 1048576) {
    emit(2, { result: 'refused', reason: 'oversized_source', appliedPredicate: null, employmentDecision: false });
    return;
  }
  let input;
  try { input = JSON.parse(inputBytes.toString('utf8')); }
  catch {
    emit(2, { result: 'refused', reason: 'seed_rejected', appliedPredicate: null, employmentDecision: false });
    return;
  }
  const rows = Array.isArray(input) ? input : input?.rows;
  if (!Array.isArray(rows)) {
    emit(2, { result: 'refused', reason: 'usage', appliedPredicate: null, employmentDecision: false });
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), 'careers-predicates-'));
  try {
    const dest = join(dir, 'predicates.mjs');
    await writeFile(dest, bytes, { mode: 0o600 });
    const mod = await import(pathToFileURL(dest).href);
    emit(0, { result: 'predicates', ...mod.applyPredicates(rows) });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch(() => {
  emit(2, { result: 'refused', reason: 'failed', appliedPredicate: null, employmentDecision: false });
});
