---
name: repo-security-scan
description: |
  Statically scan a public GitHub repo for supply-chain malware BEFORE an agent installs or runs it
  (a dependency, a Claude/MCP skill, an MCP server). One paid call (x402, USDC on Base). Never runs the code.

  USE FOR:
  - Vetting a GitHub repo / npm-style package / Claude skill / MCP server before install or execution
  - Flagging exfil sinks, obfuscated code execution, credential-file reads, env-harvest+network, install-time curl|bash
  - Getting a risk verdict (clean / suspicious / dangerous) + findings before trusting third-party code

  TRIGGERS:
  - "is <owner/repo> safe to install", "scan this repo / skill / MCP server for malware"
  - "check this package before I run it", "any supply-chain risk in <github url>", "should I trust this skill"
metadata:
  version: 1
---

# Repo Supply-Chain Security Scan (pre-install) via x402

Static-only supply-chain scan of a public GitHub repo before an agent installs/runs it. Never executes the code.
**No auth, no API keys, no subscription — pay per request in USDC on Base.**

## Endpoint

`GET https://x402-url-extractor-production.up.railway.app/scan?repo=<owner/name | github url>`

| Field | Value |
|------|-------|
| Param | `repo=owner/name` or `https://github.com/owner/name` |
| Price | **$0.20 USDC** (Base mainnet, `eip155:8453`) |
| Auth | none — x402 pay-per-call |
| Method | static analysis only; never runs the scanned code |

## How to pay (x402)

`GET` → **HTTP 402** → pay with any x402 client (`x402-fetch`, `x402-axios`, AgentKit) from a USDC-funded Base
wallet → replay with `X-PAYMENT` → JSON.

## Output

```json
{ "ok": true, "repo": "owner/name", "risk": "clean", "filesScanned": 12,
  "summary": "No known malware/exfil/obfuscation patterns found.", "findings": [] }
```

`risk` is `clean | suspicious | dangerous`. Low false positives; flags real exfil/obfuscation/credential/network patterns.

## Notes

- Built for the agent-tooling supply chain: vet a skill/MCP server/dependency in one call instead of cloning and
  reading it yourself (and never run untrusted code to check it).
