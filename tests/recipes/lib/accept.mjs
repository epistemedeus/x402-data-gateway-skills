import assert from 'node:assert/strict';

export function assertSkillDoesNotUrgePurchaseWhenFreePathExists(skillText) {
  const hasFree = /npx |local evaluator|without paying|before paying|credential-free local|free local|uses no network or wallet/i.test(skillText);
  if (!hasFree) return;
  assert.doesNotMatch(skillText, /\b(must pay|always pay|purchase now|pay before using the local)\b/i);
}

export function assertEvidenceNotAdvice(skillText) {
  assert.doesNotMatch(
    skillText,
    /\b(investment advice|financial advice|guaranteed (profit|return)|you should (buy|sell|long|short))\b/i,
  );
}

export async function withMockedFetch(impl, fn) {
  const prior = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = prior;
  }
}
