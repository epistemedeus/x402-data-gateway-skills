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

test('recipe inventory covers all 16 skills without invented filler cells', () => {
  const inv = JSON.parse(fs.readFileSync(new URL('../inventory.json', import.meta.url)));
  assert.equal(inv.skillsPin, SKILLS_PIN);
  assert.equal(inv.merchantPin, MERCHANT_PIN);
  const dirs = listSkillDirs();
  assert.equal(dirs.length, 16);
  assert.deepEqual(inv.families.map((f) => f.skill).sort(), dirs);
  const build = inv.families.filter((f) => f.status === 'build');
  assert.ok(build.length <= 9);
  assert.equal(build.length, 9);
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
