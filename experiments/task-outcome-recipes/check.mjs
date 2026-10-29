import './lib/offline-guard.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot } from './lib/cli.mjs';
import { runBoardCases } from './recipes/public-board-coverage/0.1.0/run.mjs';
import { runRetentionCases } from './recipes/caller-result-retention/0.1.0/run.mjs';
import { runMcpCases } from './recipes/free-mcp-page-read/0.1.0/run.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = repoRoot();
const RELEASED = '41ff445d93cab50fb6e96d9f70bcffa08ad3cab7';

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (stat.isFile()) out.push(full);
  }
  return out.sort();
}

function git(args) {
  const child = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  return child.stdout;
}

test('three versioned recipes stay inside the admitted directory and preserve the publisher pin', () => {
  const porcelain = git(['status', '--porcelain', '--untracked-files=all']);
  for (const line of porcelain.split('\n').filter(Boolean)) {
    const file = line.slice(3);
    assert.equal(file.startsWith('experiments/task-outcome-recipes/'), true, line);
  }
  assert.equal(git(['diff', '--name-only', 'HEAD', '--', 'plugins', 'skills', 'consumers', 'tests', 'package.json', 'package-lock.json']).trim(), '');
  assert.equal(git(['rev-parse', `${RELEASED}^{commit}`]).trim(), RELEASED);
  const distribution = JSON.parse(readFileSync(path.join(root, 'plugins/samedaydesk-antigravity/DISTRIBUTION.json'), 'utf8'));
  assert.equal(distribution.releasedCommit, RELEASED);
  assert.equal(distribution.listing.submissionStored, false);
  const inventory = JSON.parse(readFileSync(path.join(here, 'INVENTORY.json'), 'utf8'));
  assert.equal(inventory.releasedCommitPreserved, RELEASED);
  assert.equal(inventory.network, 'loopback-mcp-fixture-only');
  const listed = new Map(inventory.files.map((item) => [item.path, item]));
  const present = walk(here)
    .map((file) => path.relative(here, file).split(path.sep).join('/'))
    .filter((file) => file !== 'INVENTORY.json');
  assert.deepEqual(present, [...listed.keys()].sort());
  for (const [rel, item] of listed) {
    const full = path.join(here, rel);
    const bytes = readFileSync(full);
    assert.equal(bytes.length, item.bytes, rel);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, rel);
  }
  for (const [rel, digest] of Object.entries(inventory.sources)) {
    assert.equal(sha256(path.join(root, rel)), digest, rel);
  }
  for (const id of ['public-board-coverage', 'caller-result-retention', 'free-mcp-page-read']) {
    const recipe = JSON.parse(readFileSync(path.join(here, 'recipes', id, '0.1.0', 'recipe.json'), 'utf8'));
    assert.equal(recipe.version, '0.1.0');
    assert.equal(recipe.capability.installExecuted, false);
    assert.equal(typeof recipe.directAlternative, 'string');
    assert.equal(recipe.license.spdx, 'MIT');
    for (const [rel, digest] of Object.entries(recipe.sourcePins)) {
      assert.equal(sha256(path.join(root, rel)), digest, rel);
    }
  }
  const result = readFileSync(path.join(here, 'RESULT.md'), 'utf8');
  for (const token of [
    'direct_sufficient_for_titles',
    'skill_adds_absolute_url_and_coverage',
    'direct_collapses_nothing_on_403',
    'direct_sufficient_for_bytes',
    'skill_required_for_tool_error_and_overwrite',
    'delivered_body_sufficient_for_text',
    'mcp_required_for_one_call_stop',
  ]) {
    assert.equal(result.includes(token), true, token);
  }
});

test('public board coverage: first use, repeat, refusal, and recovery', () => {
  const board = runBoardCases();
  assert.equal(board.first.ran.status, 0, board.first.ran.stdout + board.first.ran.stderr);
  assert.equal(board.first.ran.body.boardClaim, 'complete');
  assert.equal(board.first.ran.body.seeded, true);
  assert.equal(board.first.ran.body.paymentSent, false);
  assert.equal(board.first.ran.body.useful, null);
  assert.deepEqual(board.first.titles, ['Acxiom Only Role']);
  assert.deepEqual(board.first.direct.titles, ['Acxiom Only Role']);
  assert.equal(board.first.direct.rawTitles.length, 2);
  assert.equal(board.first.ran.body.coverage.uniqueRows, 1);
  assert.equal(board.first.direct.buildsAbsoluteUrl, false);
  assert.match(board.first.ran.body.rows[0].url, /Acxiom_1$/);
  assert.equal(board.first.direct.paths[0], '/job/A/Acxiom_1');

  assert.deepEqual(board.same.titles, board.first.titles);
  assert.deepEqual(board.same.direct.titles, board.first.direct.titles);
  assert.equal(board.same.ran.body.boardClaim, 'complete');

  assert.deepEqual(board.changed.titles, ['Acxiom Only Role', 'Acxiom Later Role']);
  assert.deepEqual(board.changed.direct.titles, board.changed.titles);
  assert.equal(board.changed.titles.includes('Acxiom Later Role'), true);
  assert.equal(board.first.titles.includes('Acxiom Later Role'), false);

  assert.equal(board.partial.ran.status, 0, board.partial.ran.stdout);
  assert.equal(board.partial.ran.body.boardClaim, 'partial');
  assert.equal(board.partial.ran.body.complete, false);
  assert.equal(board.partial.ran.body.emptyBoard, false);
  assert.equal(board.partial.ran.body.coverage.remaining, 1);
  assert.deepEqual(board.partial.titles, ['Acxiom Only Role']);
  assert.equal(board.partial.direct.classifiesCoverage, false);
  assert.equal(board.partial.direct.transportNotOk, true);
  assert.equal(board.partial.direct.emptyBoard, null);

  assert.equal(board.pay.status, 2);
  assert.equal(board.pay.body.result, 'refused');
  assert.equal(board.pay.body.reason, 'payment_refused');
  assert.equal(board.pay.body.rows, null);
  assert.equal(board.unknown.status, 0);
  assert.equal(board.unknown.body.result, 'unknown_board');
  assert.equal(board.unknown.body.rows, null);
  assert.equal(board.wrong.status, 0);
  assert.equal(board.wrong.body.result, 'wrong_source');
  assert.equal(board.wrong.body.paymentSent, false);

  assert.equal(board.failed.ran.body.boardClaim, 'source_failure');
  assert.equal(board.failed.ran.body.emptyBoard, false);
  assert.equal(board.failed.ran.body.complete, false);
  assert.deepEqual(board.failed.titles, []);
  assert.equal(board.failed.direct.transportNotOk, true);
  assert.equal(board.failed.direct.emptyBoard, null);
  assert.deepEqual(board.failed.direct.titles, []);
  const failureSnapshot = JSON.stringify(board.failed.ran.body);
  assert.equal(board.recovered.ran.body.board, 'liveramp');
  assert.equal(board.recovered.ran.body.boardClaim, 'complete');
  assert.deepEqual(board.recovered.titles, ['LiveRamp Only Role']);
  assert.deepEqual(board.recovered.direct.titles, ['LiveRamp Only Role']);
  assert.equal(JSON.stringify(board.failed.ran.body), failureSnapshot);
  assert.equal(board.failed.ran.body.rows.length, 0);
});

test('caller result retention: first use, repeat, refusal, and recovery', () => {
  const kept = runRetentionCases();
  assert.equal(kept.first.status, 0, kept.first.stdout + kept.first.stderr);
  assert.equal(kept.first.body.outcome, 'retained');
  assert.equal(kept.first.body.retainedBytesMatch, true);
  assert.equal(kept.first.body.isError, false);
  assert.equal(kept.first.body.usefulness, 'unknown');
  assert.equal(kept.first.body.paymentCreated, false);
  assert.equal(kept.directFirst.match, true);
  assert.equal(kept.directFirst.classifiesToolError, false);
  assert.equal(kept.directFirst.bytes, kept.first.body.bytes);

  assert.equal(kept.repeat.status, 0, kept.repeat.stdout);
  assert.equal(kept.repeat.body.outcome, 'retained');
  assert.equal(Buffer.compare(kept.firstBytes, kept.firstStill), 0);
  assert.notEqual(kept.firstBytes.toString('utf8'), kept.repeatBytes.toString('utf8'));
  assert.match(kept.repeatBytes.toString('utf8'), /second-delivery/);

  assert.equal(kept.toolError.status, 0);
  assert.equal(kept.toolError.body.outcome, 'tool_refusal');
  assert.equal(kept.toolError.body.isError, true);
  assert.equal(kept.toolError.body.retainedBytesMatch, true);
  assert.match(kept.toolErrorBytes.toString('utf8'), /"isError":true/);

  assert.equal(kept.pay.status, 2);
  assert.equal(kept.pay.body.outcome, 'payment_refused');
  assert.equal(kept.pay.body.paymentCreated, false);

  assert.equal(kept.overwrite.status, 2);
  assert.equal(kept.overwrite.body.outcome, 'overwrite_refused');
  assert.equal(Buffer.compare(kept.firstBytes, kept.firstStill), 0);

  assert.equal(kept.missing.status, 0);
  assert.equal(kept.missing.body.outcome, 'missing_input');
  assert.match(kept.missing.body.nextAction, /does not load a bundled example/);

  assert.equal(kept.recover.status, 0, kept.recover.stdout + kept.recover.stderr);
  assert.equal(kept.recover.body.outcome, 'missing_input');
  assert.match(kept.recover.body.nextAction, /does not create a caller/);
  assert.equal(kept.recover.body.paymentCreated, false);
});

test('free MCP page read: first use, local repeat, refusal, and recovery', async () => {
  const mcp = await runMcpCases();
  assert.equal(mcp.first.outcome, 'useful');
  assert.equal(mcp.first.consumingRequests, 1);
  assert.equal(mcp.first.toolsCallSent, true);
  assert.equal(mcp.first.purchaseSent, false);
  assert.equal(mcp.first.paidRequestSent, false);
  assert.equal(mcp.first.retried, false);
  assert.equal(mcp.first.structured.charged, false);
  assert.equal(mcp.first.structured.markdown, `Synthetic read of ${mcp.page}`);
  assert.equal(mcp.afterFirst, 1);
  assert.equal(mcp.repeat.sufficientForText, true);
  assert.equal(mcp.repeat.liveGetPerformed, false);
  assert.equal(mcp.repeat.enforcesOneCall, false);
  assert.equal(mcp.repeat.markdown, mcp.first.structured.markdown);

  assert.equal(mcp.second.outcome, 'refused');
  assert.equal(mcp.second.consumingRequests, 1);
  assert.equal(mcp.second.retried, false);
  assert.equal(mcp.afterSecond, 2);
  assert.equal(mcp.first.outcome, 'useful');

  assert.equal(mcp.missing.outcome, 'missing');
  assert.equal(mcp.missing.toolsCallSent, false);
  assert.equal(mcp.missingCalls, 0);
  assert.equal(mcp.paid.outcome, 'caller-authority');
  assert.equal(mcp.paid.reason, 'payment-challenge');
  assert.equal(mcp.paid.purchaseSent, false);
  assert.equal(mcp.paid.retried, false);
  assert.equal(mcp.taskIsProtocolError, true);
  assert.equal(mcp.taskRequests, 0);

  assert.equal(mcp.lost.outcome, 'unknown');
  assert.equal(mcp.lost.reason, 'lost-response');
  assert.equal(mcp.lost.retried, false);
  assert.equal(JSON.stringify(mcp.lost), JSON.stringify(mcp.frozenLost));
  assert.equal(mcp.reread.outcome, 'useful');
  assert.equal(mcp.reread.consumingRequests, 1);
  assert.equal(mcp.lost.outcome, 'unknown');

  assert.deepEqual(mcp.discoveredSent, ['initialize', 'notifications/initialized', 'tools/list']);
  assert.equal(mcp.discoveryCalls, 0);
});
