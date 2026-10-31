#!/usr/bin/env node
// One check that the packaged skill has not drifted from skills/public-careers-board.
// Every file must match byte for byte, except the SKILL.md section between
// "## Install" and "## Bundle files". That section is the Claude channel entry.
// The original install section must still hash to ORIGINAL_INSTALL_SHA256.

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGINAL_INSTALL_SHA256 = '63ed85df6a26568094c7767ec94b5cefa0febb9fcf02ebeadf156665a0343840';
const INSTALL = '## Install\n';
const BUNDLE = '## Bundle files\n';
const CHANNEL_PHRASES = [
  '${CLAUDE_SKILL_DIR}/scripts/cli.mjs',
  'scripts/cli.mjs',
  'skills/public-careers-board',
  '22.22.2',
  '/proc/self/fd',
];

const pluginRoot = dirname(fileURLToPath(import.meta.url));
const packagedRoot = join(pluginRoot, 'skills', 'public-careers-board');
const originalRoot = join(pluginRoot, '..', '..', 'skills', 'public-careers-board');

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function splitSkill(text) {
  const start = text.indexOf(INSTALL);
  const end = text.indexOf(BUNDLE);
  if (start < 0 || end < start) return null;
  return {
    head: text.slice(0, start),
    channel: text.slice(start, end),
    tail: text.slice(end),
  };
}

async function filesUnder(root) {
  const out = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`symlink ${relative(root, full)}`);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) out.push(relative(root, full).split(sep).join('/'));
      else throw new Error(`unsupported ${relative(root, full)}`);
    }
  }
  await walk(root);
  return out;
}

function fail(message) {
  console.error(`public-careers-board sync fail: ${message}`);
  process.exitCode = 1;
}

try {
  const originalFiles = await filesUnder(originalRoot);
  const packagedFiles = await filesUnder(packagedRoot);
  if (originalFiles.join('\n') !== packagedFiles.join('\n')) {
    fail(`file list mismatch\noriginal: ${originalFiles.join(', ')}\npackaged: ${packagedFiles.join(', ')}`);
  } else {
    let identical = 0;
    for (const rel of originalFiles) {
      const originalBytes = await readFile(join(originalRoot, rel));
      const packagedBytes = await readFile(join(packagedRoot, rel));
      if (rel === 'SKILL.md') {
        const original = splitSkill(originalBytes.toString('utf8'));
        const packaged = splitSkill(packagedBytes.toString('utf8'));
        if (!original || !packaged) {
          fail('SKILL.md is missing the Install or Bundle files heading');
          continue;
        }
        if (original.head !== packaged.head || original.tail !== packaged.tail) {
          fail('SKILL.md differs outside the Install section');
          continue;
        }
        if (sha256(original.channel) !== ORIGINAL_INSTALL_SHA256) {
          fail(`original Install section hash is ${sha256(original.channel)}, expected ${ORIGINAL_INSTALL_SHA256}`);
          continue;
        }
        const missing = CHANNEL_PHRASES.filter((phrase) => !packaged.channel.includes(phrase));
        if (missing.length) {
          fail(`channel Install section is missing: ${missing.join(', ')}`);
          continue;
        }
      } else if (!originalBytes.equals(packagedBytes)) {
        fail(`${rel} differs from the original skill`);
      } else {
        identical += 1;
      }
    }
    if (!process.exitCode) {
      console.log(`public-careers-board sync ok files=${identical} skill-md-channel-only original-install=${ORIGINAL_INSTALL_SHA256}`);
    }
  }
} catch (error) {
  const code = error && error.code === 'ENOENT' ? 'missing-original' : 'error';
  console.error(`public-careers-board sync fail: ${code} ${error.message}`);
  process.exitCode = 2;
}
