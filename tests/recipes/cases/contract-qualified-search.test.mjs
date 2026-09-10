import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMerchant } from '../lib/merchant.mjs';

import { skillMarkdown } from '../lib/paths.mjs';

const request = { query: 'service domain ownership code provenance', requiredPaths: ['data.sourceRepository'], limit: 3 };
const response = (value) => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(value) });
const agent402 = { results: [
  { seller: 'https://good.example', sellerName: 'Good', url: 'https://good.example/provenance', route: '/provenance', method: 'GET', priceUsd: 0.01, payable: 'x402', description: 'source repository provenance', score: 20 },
]};

test('contract-qualified-search useful: fixtures return only contract-qualified candidates, no target payment', async () => {
  const { contractQualifiedSearch, contractQualifiedSearchMcpOutputSchema } = await loadMerchant('contract-qualified-search.mjs');
  const result = await contractQualifiedSearch(request, {
    fetchImpl: async (url) => response(String(url).includes('agent402') ? agent402 : { services: [] }),
    auditImpl: async () => ({
      ok: true, machineBuyable: true,
      routes: [{ protocols: ['x402'], runtimeChallengeVerified: true, findings: [], responseContract: { decision: 'admissible', guaranteedPaths: ['data.sourceRepository'] } }],
    }),
    now: () => new Date('2026-08-12T12:00:00.000Z'),
  });
  assert.equal(result.decision, 'qualified_candidates_found');
  assert.equal(result.boundary.targetPaymentSent, false);
  assert.equal(contractQualifiedSearchMcpOutputSchema.safeParse(result).success, true);
  assert.match(skillMarkdown('contract-qualified-search'), /\/commerce\/contract-qualified-search/);
});

test('contract-qualified-search refusal: credential-like query rejected before search', async () => {
  const { normalizeContractQualifiedSearchInput } = await loadMerchant('contract-qualified-search.mjs');
  assert.throws(
    () => normalizeContractQualifiedSearchInput({ ...request, query: 'api_key=secret-value' }),
    /credential/i,
  );
});
