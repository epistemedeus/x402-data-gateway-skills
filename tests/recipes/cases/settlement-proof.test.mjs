import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAbiParameters, encodeEventTopics, parseAbiItem } from 'viem';
import { loadMerchant } from '../lib/merchant.mjs';

import { skillMarkdown } from '../lib/paths.mjs';

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const TX = `0x${'1'.repeat(64)}`;
const PAYER = '0x1111111111111111111111111111111111111111';
const RECIPIENT = '0x2222222222222222222222222222222222222222';

test('settlement-proof useful: disposable receipt fixture verifies Base USDC transfer evidence', async () => {
  const { BASE_USDC, settlementProof, settlementProofMcpOutputSchema } = await loadMerchant('settlement-proof.mjs');
  const log = {
    address: BASE_USDC,
    topics: encodeEventTopics({ abi: [TRANSFER], eventName: 'Transfer', args: { from: PAYER, to: RECIPIENT } }),
    data: encodeAbiParameters([{ type: 'uint256' }], [5000n]),
  };
  const client = {
    async getTransactionReceipt() {
      return { status: 'success', blockNumber: 49823378n, logs: [log] };
    },
    async getBlock() {
      return { timestamp: 1786350903n };
    },
  };
  const result = await settlementProof(
    { transactionHash: TX, recipient: RECIPIENT, amountAtomic: '5000', payer: PAYER },
    { client, now: () => new Date('2026-08-11T08:30:00.000Z') },
  );
  assert.equal(result.ok, true);
  assert.equal(result.decision, 'verified');
  assert.equal(settlementProofMcpOutputSchema.safeParse(result).success, true);
  assert.match(skillMarkdown('settlement-proof'), /\/commerce\/settlement-proof/);
});

test('settlement-proof refusal: malformed hash fails closed before proof claims', async () => {
  const { normalizeSettlementProofInput } = await loadMerchant('settlement-proof.mjs');
  assert.throws(
    () => normalizeSettlementProofInput({ transactionHash: '0x12', recipient: RECIPIENT, amountAtomic: '5000' }),
    /32-byte/,
  );
});
