---
name: company-enrich
description: |
  Enrich a company by its domain in one paid call (x402, USDC on Base) — and uniquely get AI/agent-readiness
  + DNS/email-infrastructure signals that generic enrichment APIs do not return. No API keys, no signup,
  pay-per-call. The frictionless alternative to signup-gated Clearbit/Apollo for autonomous agents.

  USE FOR:
  - Enriching a company by domain -> identity (name, legal name, description, logo), industry keywords
  - Tech-stack fingerprint (CMS / framework / analytics: WordPress, Shopify, Next.js, HubSpot, GA, ...)
  - Social profiles (twitter/x, linkedin, github, youtube, ...) and contact surface (emails, phone, address)
  - DNS + email infrastructure: A/MX/NS records, SPF & DMARC presence, whether the domain can send email
  - AI-search-readiness score (JSON-LD schema types, OpenGraph, robots/sitemap/llms.txt) — "can AI assistants cite this site"

  TRIGGERS:
  - "enrich this company", "company profile for", "tell me about <domain>", "research this domain"
  - "what tech stack does <site> use", "who is <company>", "find the LinkedIn/Twitter for <company>"
  - "is <domain> AI-search ready", "does <site> have structured data / llms.txt", "check this domain's email setup (SPF/DMARC)"
metadata:
  version: 1
---

# Company Enrichment (domain -> agent-ready intelligence) via x402

Hand it a bare domain, get back clean structured firmographics **plus a layer no other enrichment API carries:
AI/agent-readiness + DNS/email-infrastructure signals.** Public data only (homepage HTML + DNS), deterministic,
**no auth, no API keys, no subscription — pay per request in USDC on Base.**

Incumbents (Clearbit, Apollo) are signup- and KYC-gated, so they're inaccessible to an autonomous agent buyer.
This endpoint is the frictionless, pay-per-call alternative — and it's the category-of-one for "is this site
ready to be read/cited by AI agents."

## Endpoint

`GET https://x402-url-extractor-production.up.railway.app/enrich?domain=<domain-or-url>`

(alias host: `https://pay.samedaydesk.com/enrich?domain=<domain>`)

| Field | Value |
|------|-------|
| Method / param | `GET ?domain=stripe.com` (bare domain or full URL) |
| Price | **$0.02 USDC** (Base mainnet, `eip155:8453`) |
| Auth | none — x402 pay-per-call |
| Data | public web + DNS only; deterministic |

## How to pay (x402)

1. `GET` the URL → **HTTP 402** with payment requirements (amount, USDC-on-Base asset, payTo).
2. Pay with any x402 client (`x402-fetch`, `x402-axios`, Coinbase **AgentKit** x402 action) from a USDC-funded
   Base wallet. The client signs an EIP-3009 authorization; USDC settles directly on-chain (non-custodial).
3. The client replays with the `X-PAYMENT` header and returns the JSON.

```ts
import { wrapFetchWithPayment } from "x402-fetch";
const fetchPaid = wrapFetchWithPayment(fetch, walletClient); // walletClient funded with USDC on Base
const res = await fetchPaid("https://x402-url-extractor-production.up.railway.app/enrich?domain=stripe.com");
const company = await res.json();
```

## Output shape (abridged)

```json
{
  "ok": true,
  "domain": "stripe.com",
  "company": { "name": "Stripe", "description": "...", "keywords": ["financial","infrastructure", "..."], "keywordsSource": "derived" },
  "contact": { "emails": [], "phones": [], "address": null },
  "social": { "twitter": "...", "linkedin": "...", "github": "..." },
  "tech": ["Next.js"],
  "dns": { "host": "stripe.com", "mx": ["..."], "hasSPF": true, "hasDMARC": true, "emailInfra": true },
  "aiReadiness": { "hasJsonLd": true, "schemaTypes": ["Organization","WebSite"], "hasLlmsTxt": true, "score": 84 }
}
```

## Notes

- The differentiator vs generic enrichment is the `dns` (email deliverability: SPF/DMARC/MX) and `aiReadiness`
  (JSON-LD/OpenGraph/robots/sitemap/llms.txt + a 0-100 score) layers — useful for outreach validation and for
  judging whether a site is citable by AI assistants.
- Also see the companion `wallet-enrich` skill (0x address -> on-chain profile) for crypto-native enrichment.
