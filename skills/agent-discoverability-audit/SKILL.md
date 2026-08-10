---
name: agent-discoverability-audit
description: Measure whether a public x402 or MPP machine service is found for a brand-blind buyer intent across Coinbase Bazaar, Agent402, Circle Agent Marketplace, and the official MPP catalog. Use for machine-service rank audits, catalog coverage checks, expected-route verification, competitor discovery, or deciding which service metadata to refine. Do not use this as proof of demand, conversion, reliability, or future rank.
---

# Audit agent discoverability

Call SameDayDesk's paid, machine-readable catalog audit.

## Build the request

Use:

`GET https://agents.samedaydesk.com/distribution/agent-discoverability-audit?origin=<https-origin>&intent=<brand-blind-capability>&route=<optional-path>&payTo=<optional-address>`

- Supply an HTTPS origin without a path or query.
- Describe the capability in 20 to 500 characters without the target hostname
  or brand.
- Add the exact expected path when route-level presence matters.
- Add `payTo` only when aliases share one EVM recipient.

Read the current operation and price from
`https://agents.samedaydesk.com/openapi.json` before paying. Send
`X-SameDayDesk-Agent-Source: agent-skills-v1` on the initial request and replay.

On HTTP 402, verify the complete resource, amount, Base network, Base USDC
asset, and recipient. Pay only with caller authorization, through x402 v2 or
MPP `evm/charge`. Preserve the source header and reconcile the protocol receipt.

Use `summary`, source-native ranks, expected-route presence, `findings`, and
`nextActions`. Keep source outages visible. Report the result as point-in-time
discovery evidence, never as buyer demand or revenue.
