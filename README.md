# x402 Data Gateway — Agent Skills

Agent Skills that teach your Claude / Cursor / MCP agent to call a live **x402 pay-per-call data gateway** —
clean, structured JSON for a few cents of **USDC on Base**, with **no API keys, no signup, no subscription**.
Send an x402 payment, get the data.

Gateway: `https://x402-url-extractor-production.up.railway.app` (alias `https://pay.samedaydesk.com`)
Network: USDC on **Base mainnet** (`eip155:8453`) · settles directly on-chain (non-custodial).

## Install

```bash
npx skills add epistemedeus/x402-data-gateway-skills --all --yes
```

Or add a single skill, e.g. `npx skills add epistemedeus/x402-data-gateway-skills wallet-enrich`.
Any agent that reads [Agent Skills](https://github.com/vercel-labs/skills) (`SKILL.md`) can use these.

## Skills

| Skill | What it does | Endpoint | Price |
|-------|--------------|----------|-------|
| **company-enrich** | Domain → company intel **+ AI/agent-readiness + DNS/email-infra** signals (category-of-one) | `GET /enrich?domain=` | $0.02 |
| **wallet-enrich** | Base/EVM `0x` address → on-chain profile (EOA/contract, token holdings, token/NFT metadata, proxy, activity) | `GET /wallet-enrich?address=` | $0.02 |
| **web-extract** | Any URL → structured JSON or LLM-ready Markdown | `GET /extract?url=` · `GET /read?url=` | $0.05 |
| **repo-security-scan** | Static supply-chain malware scan of a public GitHub repo before install (never runs it) | `GET /scan?repo=` | $0.20 |
| **schema-generate** | Business site → paste-ready JSON-LD bundle + gap diff (AI-citation eligibility) | `GET /schemaforge?site=` | $0.25 |

## How payment works (x402)

1. Your agent `GET`s an endpoint and receives **HTTP 402** with the payment requirements (amount, USDC-on-Base
   asset, payTo wallet).
2. It pays with any x402 client — [`x402-fetch`](https://www.npmjs.com/package/x402-fetch), `x402-axios`, or
   Coinbase **AgentKit**'s x402 action — from a wallet holding a little USDC on Base. The client signs an
   EIP-3009 authorization; funds settle directly on-chain to the gateway wallet. The facilitator never custodies
   the money.
3. The client automatically replays the request with the `X-PAYMENT` header and returns the JSON.

```ts
import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";
// walletClient must be funded with USDC on Base
const fetchPaid = wrapFetchWithPayment(fetch, walletClient);
const res = await fetchPaid("https://x402-url-extractor-production.up.railway.app/enrich?domain=stripe.com");
console.log(await res.json());
```

## Why this gateway

- **Frictionless for autonomous agents** — no account, no API keys, no subscription. The incumbents (Clearbit,
  Apollo, Nansen) are signup- and KYC-gated, which an autonomous agent can't pass. Here you just pay per call.
- **Differentiated data** — `company-enrich` returns DNS/email-infrastructure (SPF/DMARC/MX) and AI-search-readiness
  signals that generic enrichment APIs don't; `wallet-enrich` is the crypto-native counterpart for sizing up an
  address before you transact.
- **Deterministic, public-data-only** — reproducible JSON, not opaque scraped guesses.

Discovery: `/.well-known/x402` · `/llms.txt` · `/openapi.json` on the gateway host.
