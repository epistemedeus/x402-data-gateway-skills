import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMerchant } from '../lib/merchant.mjs';
import { assertSkillDoesNotUrgePurchaseWhenFreePathExists } from '../lib/accept.mjs';
import { skillMarkdown } from '../lib/paths.mjs';

test('wallet-policy-safety useful: local matrix evaluation is free-path evidence, not paid_success', async () => {
  const {
    WALLET_POLICY_CASES,
    walletPolicyConformance,
  } = await loadMerchant('wallet-policy-conformance.mjs');
  const observations = Object.entries(WALLET_POLICY_CASES)
    .filter(([, definition]) => definition.required)
    .map(([caseName, definition]) => ({
      case: caseName,
      actual: definition.expected === 'allow' ? 'allowed' : 'denied',
      denialClass: definition.expected === 'allow' ? 'none' : 'policy',
      code: definition.expected === 'allow' ? 'signed' : 'policy_violation',
    }));
  const result = walletPolicyConformance({
    profileId: 'lab-profile',
    provider: 'Privy',
    network: 'solana:mainnet',
    protocol: 'x402',
    observations,
  });
  assert.equal(result.decision, 'conformant');
  const skill = skillMarkdown('wallet-policy-safety');
  assertSkillDoesNotUrgePurchaseWhenFreePathExists(skill);
  assert.match(skill, /npx agent-payment-policy|local evaluator|without paying|credential-free local|free/i);
});

test('wallet-policy-safety refusal: secret-like observation payload rejected', async () => {
  const { walletPolicyConformance, WalletPolicyConformanceError } = await loadMerchant('wallet-policy-conformance.mjs');
  assert.throws(
    () => walletPolicyConformance({
      profileId: 'lab',
      provider: 'Privy',
      network: 'solana:mainnet',
      protocol: 'x402',
      observations: [{ case: 'exact_amount', actual: 'allowed', denialClass: 'none', code: 'signed', privateKey: '0xabc' }],
    }),
    WalletPolicyConformanceError,
  );
});
