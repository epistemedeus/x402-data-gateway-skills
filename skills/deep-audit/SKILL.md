---
name: deep-audit
description: |
  Run ONE paid call (x402, USDC on Base) to get a COMPLETE AI-search-readiness audit of any company by domain:
  firmographics + tech stack + contact + DNS/email infrastructure + a 0-100 AI-readiness score, PLUS a
  structured-data gap analysis with a paste-ready JSON-LD fix list and a combined letter grade. The bundled
  "deep" tier = enrich + schemaforge in one call. No API keys, no signup, pay-per-call.

  USE FOR:
  - A full "is this company ready to be found and cited by AI assistants" audit in a single call
  - Firmographics (name, legal name, description, logo, industry) + tech-stack fingerprint + social + contact surface
  - DNS + email infrastructure (A/MX/NS, SPF/DMARC presence) and a 0-100 AI-search-readiness score
  - A structured-data GAP analysis: what JSON-LD the site is missing + a paste-ready fix list to become AI-citable
  - A single letter grade (A-F) summarizing AI-search readiness

  TRIGGERS:
  - "audit this site for AI search", "is <domain> ready for ChatGPT / Perplexity / AI answers"
  - "full audit of <company>", "deep audit <domain>", "AI visibility audit", "GEO audit"
  - "what structured data is <site> missing", "how do I make <site> AI-citable"
metadata:
  version: 1
---

# Deep Audit (domain -> complete AI-search-readiness audit) via x402

One call returns everything `company-enrich` returns **PLUS** the `schema-generate` structured-data gap analysis
and paste-ready JSON-LD fix list, merged into one report with a combined AI-search-readiness **letter grade**.
The premium "deep" tier — priced the same as `schema-generate` alone for strictly more value. Public data only
(homepage HTML + DNS); no auth, no API keys, no subscription — **pay per request in USDC on Base.**

## Endpoint

`GET https://x402-url-extractor-production.up.railway.app/deep-audit?domain=<domain-or-url>`

| Field | Value |
|------|-------|
| Method / param | `GET ?domain=stripe.com` (bare domain or full URL; optional `&vertical=` `&city=`) |
| Price | **$0.25 USDC** (Base mainnet, `eip155:8453`) |
| Auth | none — x402 pay-per-call |
| Returns | `summary{aiReadinessScore, structuredDataGaps, grade, headline}`, `identity`, `tech`, `contact`, `social`, `dns`, `aiReadinessSignals`, `structuredData{current, missing, fixList, jsonLd, pasteAs}` |

## How to pay (x402)

1. `GET` the URL -> **HTTP 402** with payment requirements (amount, USDC-on-Base asset, payTo).
2. Pay with any x402 client (`x402-fetch`, `x402-axios`, Coinbase **AgentKit** x402 action) from a USDC-funded
   Base wallet. The client signs an EIP-3009 authorization; USDC settles directly on-chain (non-custodial).
3. The client replays with the `X-PAYMENT` header and returns the merged audit JSON.

```ts
import { wrapFetchWithPayment } from "x402-fetch";
const fetchPaid = wrapFetchWithPayment(fetch, walletClient); // Base wallet funded with USDC
const r = await fetchPaid("https://x402-url-extractor-production.up.railway.app/deep-audit?domain=stripe.com");
const audit = await r.json(); // audit.summary.grade -> e.g. "B (72/100)"
```

Also exposed as the `deep_audit` tool on our MCP server: `POST https://x402-url-extractor-production.up.railway.app/mcp`.
