import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMerchant } from '../lib/merchant.mjs';

import { skillMarkdown } from '../lib/paths.mjs';

test('schema-generate useful: local bundle builder yields schema gap evidence without paid_success', async () => {
  const { buildBundle } = await loadMerchant('schemaforge.mjs');
  const bundle = buildBundle({
    site: 'https://clinic.example',
    vertical: 'med-spas',
    city: 'Austin',
    name: 'Austin Clinic',
  });
  assert.ok(bundle);
  assert.match(JSON.stringify(bundle), /@graph|LocalBusiness|MedicalBusiness|FAQPage|schema\.org|@context/i);
  assert.match(skillMarkdown('schema-generate'), /\/schemaforge/);
});

test('schema-generate refusal/unsupported: missing site is not paid_success', async () => {
  const { schemaforge } = await loadMerchant('schemaforge.mjs');
  const result = await schemaforge({});
  assert.equal(result.ok, false);
  assert.match(String(result.error || ''), /missing required param: site/i);
});
