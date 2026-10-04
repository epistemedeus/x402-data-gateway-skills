import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const checker = path.join(root, 'contracts/discovery-to-acquisition/check.py');

const optionalHermesUnavailable = !process.env.HERMES_AGENT_SOURCE && process.env.HERMES_REQUIRE_DISCOVERY_CHECK !== '1';

test('pinned Hermes producer accepts the listing summary and rejects seeded false selection', {
  skip: optionalHermesUnavailable ? 'optional pinned Hermes checkout not configured' : false,
}, () => {
  const hermes = process.env.HERMES_AGENT_SOURCE;
  const python = process.env.HERMES_PYTHON || 'python3';
  assert.ok(hermes, 'HERMES_AGENT_SOURCE must point at NousResearch/hermes-agent 2f80ae0a6a91932b1808a53f9c55f8b3f313d6cc');
  const result = spawnSync(python, [checker], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 1048576,
    env: { ...process.env, HERMES_AGENT_SOURCE: hermes },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PRODUCER PASS identifier=received-useful-work trust=community/);
  assert.match(result.stdout, /INSTALL hermes skills install clawhub\/received-useful-work/);
  assert.match(result.stdout, /SYNTHETIC x402 integration repair rank=1/);
  assert.match(result.stdout, /SYNTHETIC tool input compatibility rank=1/);
  assert.match(result.stdout, /SYNTHETIC task distribution rank=4/);
  assert.match(result.stdout, /SEEDED REJECT 5/);
  assert.match(result.stdout, /phrase removed from summary is not selected/);
  assert.match(result.stdout, /same-named skill from another owner/);
  assert.match(result.stdout, /LIVE RECEIPT hits=0/);
  assert.match(result.stdout, /SUBMISSION action=none/);
  assert.match(result.stdout, /KNOWN SOURCE members=26/);
  assert.match(result.stdout, /REGISTRY LISTING members=25/);
});
