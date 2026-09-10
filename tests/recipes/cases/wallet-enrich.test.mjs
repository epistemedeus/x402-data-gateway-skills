import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMerchant } from '../lib/merchant.mjs';
import { assertEvidenceNotAdvice, withMockedFetch } from '../lib/accept.mjs';
import { skillMarkdown } from '../lib/paths.mjs';

const ADDR = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const rpc = (result) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200, headers: { 'content-type': 'application/json' } });

test('wallet-enrich useful: disposable Base RPC fixtures yield wallet snapshot evidence', async () => {
  const { walletEnrich } = await loadMerchant('wallet-enrich.mjs');
  const result = await withMockedFetch(async (_url, init) => {
    const body = JSON.parse(String(init.body));
    if (body.method === 'eth_getCode') return rpc('0x');
    if (body.method === 'eth_getBalance') return rpc('0xde0b6b3a7640000');
    if (body.method === 'eth_getTransactionCount') return rpc('0x4');
    if (body.method === 'eth_call') return rpc(`0x${'0'.repeat(64)}`);
    return rpc(null);
  }, () => walletEnrich(ADDR));
  assert.equal(result.address, ADDR);
  assert.equal(result.type, 'eoa');
  assert.equal(result.activity.outboundTxCount, 4);
  assert.equal(result.profile, 'active-eoa');
  assertEvidenceNotAdvice(skillMarkdown('wallet-enrich'));
});

test('wallet-enrich refusal: invalid address fails closed', async () => {
  const { walletEnrich } = await loadMerchant('wallet-enrich.mjs');
  await assert.rejects(() => walletEnrich('not-an-address'), /invalid address/i);
});
