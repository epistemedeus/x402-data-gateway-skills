---
name: wallet-enrich
description: |
  Profile any Base / EVM wallet or contract address in one paid call (x402, USDC on Base). Hand it a bare
  0x address; get back a clean structured on-chain profile — no API keys, no signup, pay-per-call.

  USE FOR:
  - Sizing up a wallet or counterparty BEFORE sending funds, swapping, or signing
  - Telling an EOA apart from a contract (and identifying the contract: ERC-20 / ERC-721 / ERC-1155)
  - Reading a wallet's native ETH + major Base token holdings (USDC/USDbC/USDT/EURC/DAI/WETH/cbETH/cbBTC/AERO/DEGEN/VIRTUAL)
  - Pulling token/NFT contract metadata (name, symbol, decimals, total supply) for an unknown address
  - Detecting EIP-1967 proxy contracts and their implementation address
  - A quick "is this address active / funded / a known token" check with a single derived profile label

  TRIGGERS:
  - "enrich this wallet", "profile this address", "who/what is 0x...", "look up this address"
  - "is 0x... a contract or a wallet", "what token is 0x...", "what does this wallet hold"
  - "check this address before I send", "is this address safe/active/funded"
  - "what's the contract at 0x...", "is 0x... a proxy"
metadata:
  version: 1
---

# Wallet / Address Enrichment (on-chain profile) via x402

Turn a bare Base/EVM `0x` address into a structured on-chain profile in one call. Public on-chain data only
(Base-mainnet JSON-RPC), deterministic, **no auth, no API keys, no subscription — pay per request in USDC on Base.**

This is the crypto-native counterpart to company enrichment: built for agents that already hold USDC on Base and
need to understand an address before they act on it.

## Endpoint

`GET https://x402-url-extractor-production.up.railway.app/wallet-enrich?address=<0x...>`

(alias host: `https://pay.samedaydesk.com/wallet-enrich?address=<0x...>`)

| Field | Value |
|------|-------|
| Method / param | `GET ?address=0x...` (a 40-hex EVM address) |
| Price | **$0.02 USDC** (Base mainnet, `eip155:8453`) |
| Auth | none — x402 pay-per-call |
| Data | public on-chain only (Base RPC); deterministic |

## How to pay (x402)

1. `GET` the URL. You receive **HTTP 402** with the payment requirements (amount, asset = USDC on Base, payTo).
2. Pay with any x402 client — e.g. `x402-fetch`, `x402-axios`, or Coinbase **AgentKit**'s x402 action — from a
   wallet funded with a little USDC on Base. The client signs an EIP-3009 authorization; funds settle directly
   on-chain to the service wallet (non-custodial).
3. The client automatically replays the request with the `X-PAYMENT` header and you get the JSON result.

Minimal example (TypeScript, `x402-fetch`):

```ts
import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";
// walletClient must be funded with USDC on Base
const fetchPaid = wrapFetchWithPayment(fetch, walletClient);
const res = await fetchPaid(
  "https://x402-url-extractor-production.up.railway.app/wallet-enrich?address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
);
const profile = await res.json();
```

## Output shape

```json
{
  "ok": true,
  "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "network": "base-mainnet (eip155:8453)",
  "type": "contract",
  "native": { "symbol": "ETH", "balance": "0.0098", "balanceWei": "..." },
  "tokenHoldings": [ { "symbol": "USDC", "amount": "1000.0", "kind": "stable" } ],
  "holdingsSummary": { "distinctTokens": 1, "stablecoinUnits": 1000, "hasStablecoins": true },
  "contract": {
    "standard": "ERC-20 (token)",
    "token": { "symbol": "USDC", "name": "USD Coin", "decimals": 6, "totalSupply": "4157703919.56" }
  },
  "activity": { "outboundTxCount": 1, "hasActivity": true },
  "profile": "token-contract:USDC"
}
```

`profile` is a single label an agent can branch on: `eoa` variants (`empty-or-fresh-eoa`,
`active-eoa`, `active-eoa-with-tokens`, `funded-eoa-with-stablecoins`) or contract variants
(`token-contract:<SYMBOL>`, `nft-contract`, `proxy-contract`, `contract`).

## Notes

- Input must be a `0x` + 40-hex address. ENS/Basename strings are not yet resolved (coming).
- Token holdings cover a curated set of major Base tokens; absence there does not prove a zero balance of
  every token.
- Use this instead of hand-rolling several RPC calls + ABI decoding — one paid call returns the decoded profile.
