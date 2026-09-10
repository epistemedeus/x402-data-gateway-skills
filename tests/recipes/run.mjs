#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (Number(process.versions.node.split('.')[0]) !== 22) {
  console.error(`recipes require Node 22; got ${process.version}`);
  process.exit(2);
}

const casesDir = path.join(root, 'tests/recipes/cases');
const files = fs
  .readdirSync(casesDir)
  .filter((name) => name.endsWith('.test.mjs'))
  .map((name) => path.join(casesDir, name));

const merchantDir =
  process.env.S88_MERCHANT_SOURCE_DIR || path.resolve(root, '../x402-url-extractor');

const env = {
  ...process.env,
  S88_MERCHANT_SOURCE_DIR: merchantDir,
  // Prefer merchant-installed viem when skills package has no local node_modules.
  NODE_PATH: [path.join(merchantDir, 'node_modules'), process.env.NODE_PATH]
    .filter(Boolean)
    .join(path.delimiter),
};

// Serial: recipes patch process-global extract fetch / DNS hooks.
const result = spawnSync(
  process.execPath,
  ['--import', path.join(root, 'tests/recipes/lib/offline-only.mjs'), '--test', '--test-concurrency=1', ...files],
  { cwd: root, env, stdio: 'inherit' },
);
process.exit(result.status ?? 1);
