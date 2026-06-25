---
name: schema-generate
description: |
  Generate a complete, paste-ready JSON-LD structured-data bundle for a business website in one paid call
  (x402, USDC on Base), plus a gap diff vs the live site, so the page becomes eligible to be cited by AI
  assistants. No API keys, no signup, pay-per-call.

  USE FOR:
  - Generating schema.org JSON-LD (LocalBusiness/MedicalBusiness + Service/OfferCatalog + FAQPage + Review/AggregateRating + geo/hours)
  - Auditing what structured data a business site is MISSING (gap diff) and getting a ranked fix list
  - Making a local-business page eligible for AI-assistant citation / rich results

  TRIGGERS:
  - "generate JSON-LD / schema markup for <site>", "what structured data is <site> missing"
  - "make <site> eligible for AI citation / rich results", "add schema.org markup for this business"
metadata:
  version: 1
---

# Schema Generator (business site -> paste-ready JSON-LD + gap diff) via x402

Generate a valid-by-construction JSON-LD bundle tuned to the fields that pages surfacing for high-intent vertical
queries actually carry, plus a gap diff vs the live site and a ranked fix list. **No auth, no API keys, no
subscription — pay per request in USDC on Base.**

## Endpoint

`GET https://x402-url-extractor-production.up.railway.app/schemaforge?site=<url>&vertical=<v>&city=<c>`

| Field | Value |
|------|-------|
| Params | `site` (required), `vertical` (optional, e.g. `med-spas`), `city` (optional) |
| Price | **$0.25 USDC** (Base mainnet, `eip155:8453`) |
| Auth | none — x402 pay-per-call |

## How to pay (x402)

`GET` → **HTTP 402** → pay with any x402 client (`x402-fetch`, `x402-axios`, AgentKit) from a USDC-funded Base
wallet → replay with `X-PAYMENT` → JSON.

## Output

```json
{ "ok": true, "site": "https://example-clinic.com", "vertical": "med-spas",
  "missing": ["faqPage","review","service"], "fixList": ["1. Add FAQPage markup ..."],
  "jsonLd": { "@context": "https://schema.org", "@graph": [] }, "pasteAs": "..." }
```

## Notes

- Deterministic and valid by construction; rating/review fields are placeholders for the business's real values.
- Pairs with `company-enrich`'s `aiReadiness` score: enrich to find the gaps, schema-generate to fill them.
