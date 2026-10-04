import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const bundleUrl = new URL('skills/received-useful-work/', root);
const provenanceUrl = new URL('provenance/received-useful-work-0.1.1.json', root);
const sourceRevision = '6029b2c2cbcdd1b258bd98333e4e11596bf5c7da';
const catalog = [
  'agent-discoverability-audit',
  'agent-surface-budget-audit',
  'company-enrich',
  'contract-qualified-search',
  'deep-audit',
  'morpho-risk',
  'opportunity-preflight',
  'payment-offer-preflight',
  'repo-security-scan',
  'samedaydesk-machine-commerce',
  'schema-generate',
  'settlement-proof',
  'transaction-receipt',
  'wallet-enrich',
  'wallet-policy-safety',
  'web-extract',
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function walk(dir, prefix = '') {
  const found = [];
  for (const name of fs.readdirSync(dir)) {
    const rel = prefix ? `${prefix}/${name}` : name;
    const abs = path.join(dir, name);
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink()) throw new Error(`symlink ${rel}`);
    if (stat.isDirectory()) found.push(...walk(abs, rel));
    else found.push({ path: rel, mode: stat.mode & 0o777, bytes: stat.size, sha256: sha256(fs.readFileSync(abs)) });
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

function rejectDrift(expected, actual) {
  const errors = [];
  if (expected.length !== actual.length) errors.push(`count ${actual.length} != ${expected.length}`);
  const byPath = new Map(actual.map((item) => [item.path, item]));
  for (const item of expected) {
    const got = byPath.get(item.path);
    if (!got) {
      errors.push(`missing ${item.path}`);
      continue;
    }
    if (got.sha256 !== item.sha256) errors.push(`sha256 ${item.path}`);
    if (got.bytes !== item.bytes) errors.push(`bytes ${item.path}`);
    const want = item.mode === '100755' ? 0o755 : 0o644;
    if ((got.mode & 0o777) !== want) errors.push(`mode ${item.path}`);
  }
  if (errors.length) throw new Error(errors.join('; '));
}

test('catalog skills stay in place beside the additive export', () => {
  const names = fs.readdirSync(new URL('skills/', root)).sort();
  assert.deepEqual(names, [...catalog, 'received-useful-work'].sort());
  for (const name of catalog) {
    assert.equal(fs.existsSync(new URL(`skills/${name}/SKILL.md`, root)), true, name);
  }
});

test('packaging keeps the accepted 0.1.1 identity, license, and executable command', () => {
  const skill = fs.readFileSync(new URL('SKILL.md', bundleUrl), 'utf8');
  const front = skill.match(/^---\n([\s\S]+?)\n---\n/);
  assert.ok(front);
  assert.match(front[1], /(?:^|\n)name: received-useful-work(?:\n|$)/);
  assert.match(front[1], /(?:^|\n)license: MIT(?:\n|$)/);
  assert.match(front[1], /(?:^|\n)  version: "0\.1\.1"(?:\n|$)/);
  assert.match(skill, /^# Received useful work/m);
  const license = fs.readFileSync(new URL('LICENSE', bundleUrl), 'utf8');
  assert.match(license, /^MIT License\n/);
  assert.match(license, /Copyright \(c\) 2026 Neomorphic LLC/);
  assert.equal(sha256(fs.readFileSync(new URL('LICENSE', bundleUrl))), '044d7291c37a2ead106ea4b4c26f713e63b7834637ed634da640f74e8cbe4625');
  assert.equal(fs.readFileSync(new URL('references/LICENSE.txt', bundleUrl), 'utf8'), license);
  const command = fs.statSync(new URL('scripts/dispatch.mjs', bundleUrl));
  assert.equal(command.isFile(), true);
  assert.equal(command.mode & 0o111, 0o111);
});

test('members and pins match the separated mirror provenance', () => {
  const provenance = JSON.parse(fs.readFileSync(provenanceUrl, 'utf8'));
  assert.equal(provenance.role, 'generated-mirror-provenance');
  assert.equal(provenance.separatedFromSkillBundle, true);
  assert.equal(provenance.bundle, 'skills/received-useful-work');
  assert.equal(provenance.source.repository, 'epistemedeus/neomorphic-io');
  assert.equal(provenance.source.revision, sourceRevision);
  assert.equal(provenance.source.path, 'public/.well-known/skills/received-useful-work');
  assert.equal(fs.existsSync(new URL('provenance/received-useful-work-0.1.1.json', bundleUrl)), false);
  const actual = walk(fileURLToPath(bundleUrl));
  assert.equal(actual.length, 26);
  rejectDrift(provenance.members, actual);
  const byPath = new Map(provenance.members.map((item) => [item.path, item]));
  assert.equal(byPath.get('SKILL.md').sha256, '82b1845a90b066562c13e7c68b11806c4315a6c1990bda1327193714eab15d1f');
  assert.equal(byPath.get('references/pins.json').sha256, sha256(fs.readFileSync(new URL('references/pins.json', bundleUrl))));
  assert.equal(byPath.get('scripts/dispatch.mjs').mode, '100755');
  const pins = JSON.parse(fs.readFileSync(new URL('references/pins.json', bundleUrl), 'utf8'));
  assert.equal(pins.skill, 'received-useful-work');
  assert.equal(pins.version, '0.1.1');
  assert.equal(pins.paymentAuthority, 'none');
  assert.equal(pins.installedCommand, 'scripts/dispatch.mjs');
  assert.ok(Array.isArray(pins.functions) && pins.functions.length > 0);
  for (const fn of pins.functions) {
    assert.match(fn.archive, /^\/downloads\/[a-z0-9./-]+$/);
    assert.match(fn.sha256, /^[0-9a-f]{64}$/);
    assert.equal(Number.isInteger(fn.bytes) && fn.bytes > 0, true);
  }
  const delivery = JSON.parse(fs.readFileSync(new URL('references/library-delivery.json', bundleUrl), 'utf8'));
  assert.equal(delivery.schema, 'neomorphic.received-library-delivery.v1');
  for (const entry of delivery.entries) {
    if (entry.sha256) {
      assert.match(entry.sha256, /^[0-9a-f]{64}$/);
      assert.equal(Number.isInteger(entry.bytes) && entry.bytes > 0, true);
    }
  }
});

test('a drifted member hash is rejected before it can replace the export', () => {
  const provenance = JSON.parse(fs.readFileSync(provenanceUrl, 'utf8'));
  const drifted = walk(fileURLToPath(bundleUrl));
  const target = drifted.find((item) => item.path === 'SKILL.md');
  target.sha256 = '0'.repeat(64);
  assert.throws(() => rejectDrift(provenance.members, drifted), /sha256 SKILL\.md/);
});
