import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMerchant } from '../lib/merchant.mjs';

import { skillMarkdown } from '../lib/paths.mjs';

const TARGET = 'https://api.example.com/paid?a=1&b=2';
const ASSET = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const RECIPIENT = '0x8904dF3DE6DFEe6a7C8cc38619d2f17806213Cee';

function x402Header() {
  return Buffer.from(JSON.stringify({
    x402Version: 2,
    resource: { url: TARGET, description: 'Paid test resource', mimeType: 'application/json' },
    accepts: [{
      scheme: 'exact', network: 'eip155:8453', asset: ASSET, amount: '5000',
      payTo: RECIPIENT, maxTimeoutSeconds: 300,
    }],
  })).toString('base64');
}

test('payment-offer-preflight useful: disposable 402 headers compare offers without paying', async () => {
  const { paymentOfferPreflight, paymentOfferPreflightMcpOutputSchema } = await loadMerchant('payment-offer-preflight.mjs');
  const result = await paymentOfferPreflight(
    { url: TARGET },
    {
      now: Date.parse('2026-08-10T20:00:00.000Z'),
      requestImpl: async () => ({
        status: 402,
        finalUrl: TARGET,
        headers: {
          get: (name) => (String(name).toLowerCase() === 'payment-required' ? x402Header() : null),
        },
      }),
      openapiImpl: async () => null,
    },
  );
  assert.equal(result.decision, 'review_required');
  assert.equal(result.offerCount, 1);
  assert.equal(result.offers[0].amountAtomic, '5000');
  assert.equal(result.boundary.paymentSent, false);
  assert.equal(paymentOfferPreflightMcpOutputSchema.safeParse(result).success, true);
  assert.match(skillMarkdown('payment-offer-preflight'), /\/commerce\/payment-offer-preflight/);
});

test('payment-offer-preflight refusal: non-https target rejected before offer claims', async () => {
  const { normalizePaymentTarget, PaymentOfferPreflightError } = await loadMerchant('payment-offer-preflight.mjs');
  assert.throws(() => normalizePaymentTarget('http://api.example.com/paid'), PaymentOfferPreflightError);
});
