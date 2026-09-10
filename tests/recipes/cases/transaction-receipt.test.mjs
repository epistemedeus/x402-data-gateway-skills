import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAbiParameters, encodeEventTopics, parseAbiItem } from 'viem';
import { loadMerchant } from '../lib/merchant.mjs';

import { skillMarkdown } from '../lib/paths.mjs';

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const TX = `0x${'1'.repeat(64)}`;
const FROM = '0x1111111111111111111111111111111111111111';
const TO = '0x2222222222222222222222222222222222222222';

test('transaction-receipt useful: disposable receipt fixture yields normalized chain evidence', async () => {
  const { NETWORKS, transactionReceipt } = await loadMerchant('transaction-receipt.mjs');
  const usdc = NETWORKS.base.canonicalUsdc;
  const client = {
    async getTransactionReceipt() {
      return {
        status: 'success',
        blockNumber: 50n,
        blockHash: `0x${'2'.repeat(64)}`,
        transactionIndex: 3,
        from: FROM,
        to: TO,
        contractAddress: null,
        type: 'eip1559',
        gasUsed: 21000n,
        effectiveGasPrice: 2000000000n,
        logs: [{
          address: usdc,
          topics: encodeEventTopics({ abi: [TRANSFER], eventName: 'Transfer', args: { from: FROM, to: TO } }),
          data: encodeAbiParameters([{ type: 'uint256' }], [5000n]),
          logIndex: 1,
        }],
      };
    },
    async getBlock() { return { timestamp: 1786350903n }; },
  };
  const result = await transactionReceipt({ transactionHash: TX }, {
    client,
    now: () => new Date('2026-08-11T08:30:00.000Z'),
  });
  assert.equal(result.ok, true);
  assert.equal(result.decision, 'found');
  assert.ok(result.canonicalUsdcTransfers.length >= 1);
  assert.match(skillMarkdown('transaction-receipt'), /\/chain\/transaction-receipt/);
});

test('transaction-receipt refusal: unsupported network fails closed', async () => {
  const { normalizeTransactionReceiptInput } = await loadMerchant('transaction-receipt.mjs');
  assert.throws(
    () => normalizeTransactionReceiptInput({ transactionHash: TX, network: 'arbitrum' }),
    /base or ethereum/i,
  );
});
