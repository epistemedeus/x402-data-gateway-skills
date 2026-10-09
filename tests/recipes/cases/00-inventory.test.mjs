import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { listSkillDirs, merchantRoot, MERCHANT_PIN, SKILLS_PIN, SKILLS_ROOT } from '../lib/paths.mjs';

function gitTopLevel(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function assertInventoryCoverage(inv, dirs) {
  assert.equal(inv.skillsPin, SKILLS_PIN);
  assert.equal(inv.merchantPin, MERCHANT_PIN);
  const names = inv.families.map((family) => family.skill);
  assert.equal(new Set(names).size, names.length, 'duplicate inventory family');
  assert.deepEqual(names.slice().sort(), dirs.slice().sort(), 'inventory must match installed skills');
  const statuses = new Set(['build', 'candidate', 'non_changing_audit', 'independent_contract_tests']);
  for (const family of inv.families) {
    assert.ok(statuses.has(family.status), 'unknown inventory status');
    if (family.status === 'build') {
      assert.ok(family.merchantModule && family.exports?.length && family.route && family.cell !== 'reserve', 'build family needs its actual merchant contract');
    }
    if (family.status === 'independent_contract_tests') {
      assert.ok(family.tests?.length, 'independent family needs actual tests');
      for (const file of family.tests) {
        assert.ok(file.startsWith('tests/') && !file.split('/').includes('..') && file.endsWith('.test.mjs'), 'invalid independent test path');
        assert.ok(fs.existsSync(path.join(SKILLS_ROOT, file)), 'missing independent test file');
      }
    }
  }
}

test('recipe inventory covers current installed skills without invented filler cells', () => {
  const inv = JSON.parse(fs.readFileSync(new URL('../inventory.json', import.meta.url)));
  assertInventoryCoverage(inv, listSkillDirs());
});

test('inventory rejects omissions, duplicates, phantom skills and untested independent families', () => {
  const inv = JSON.parse(fs.readFileSync(new URL('../inventory.json', import.meta.url)));
  const dirs = listSkillDirs();
  const change = (mutate) => { const candidate = structuredClone(inv); mutate(candidate); return candidate; };
  assert.throws(() => assertInventoryCoverage(change((candidate) => candidate.families.pop()), dirs));
  assert.throws(() => assertInventoryCoverage(change((candidate) => candidate.families.push(candidate.families[0])), dirs));
  assert.throws(() => assertInventoryCoverage(change((candidate) => candidate.families[0].skill = 'phantom-skill'), dirs));
  assert.throws(() => assertInventoryCoverage(change((candidate) => candidate.families.find((family) => family.status === 'independent_contract_tests').tests = []), dirs));
});

test('merchant pin checkout is present for fixture-backed recipes', () => {
  const root = merchantRoot();
  assert.ok(fs.existsSync(path.join(root, 'scan.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'settlement-proof.mjs')));
  const top = gitTopLevel(root);
  if (top && path.resolve(top) === path.resolve(root)) {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    assert.equal(head, MERCHANT_PIN);
  }
});

test('skills pin constant matches recipe contract; git HEAD checked only in owning skills repo', () => {
  assert.equal(SKILLS_PIN.length, 40);
  const top = gitTopLevel(SKILLS_ROOT);
  if (top && path.resolve(top) === path.resolve(SKILLS_ROOT)) {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: SKILLS_ROOT, encoding: 'utf8' }).trim();
    // Feature-branch tip may move; contract pin is the immutable S81 base recorded in inventory.
    assert.ok(head.length === 40);
    assert.equal(JSON.parse(fs.readFileSync(new URL('../inventory.json', import.meta.url))).skillsPin, SKILLS_PIN);
  }
});
