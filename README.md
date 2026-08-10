# SameDayDesk Agent Skills

Installable skills that let an agent discover and call SameDayDesk's live
machine-commerce gateway. The service exposes thirteen deterministic HTTP
actions, accepts x402 v2 or native MPP Payment authentication on the same URLs,
and settles exact USDC on Base without an account, API key, or subscription.

Canonical gateway: `https://agents.samedaydesk.com`

## Install

```bash
npx skills add epistemedeus/x402-data-gateway-skills --all --yes
```

Install one skill with:

```bash
npx skills add epistemedeus/x402-data-gateway-skills --skill wallet-enrich --yes
```

## Skills

| Skill | Capability family | Paid routes |
| --- | --- | --- |
| `samedaydesk-machine-commerce` | Catalog-level selection, payment safety, and receipt reconciliation | All thirteen paid routes |
| `company-enrich` | Company, contact, infrastructure, and AI-readiness evidence | `/enrich` |
| `wallet-enrich` | Base wallet and contract profiling | `/wallet-enrich` |
| `web-extract` | Structured page extraction and LLM-ready Markdown | `/extract`, `/read` |
| `repo-security-scan` | Static pre-install repository risk evidence | `/scan` |
| `schema-generate` | JSON-LD generation and structured-data gap analysis | `/schemaforge` |
| `deep-audit` | Combined company and AI-search-readiness audit | `/deep-audit` |
| `morpho-risk` | Morpho position, protection, market, and historical replay evidence | Four `/defi/morpho-*` routes |
| `opportunity-preflight` | Funded agent-work economics and hard gates | `/work/opportunity-preflight` |
| `agent-discoverability-audit` | Brand-blind rank and coverage across machine-service catalogs | `/distribution/agent-discoverability-audit` |

## Live contract first

Do not trust a cached price or payment example. Before paying:

1. Read `https://agents.samedaydesk.com/api/actions` or the relevant operation
   in `https://agents.samedaydesk.com/openapi.json`.
2. Send the complete GET request with
   `X-SameDayDesk-Agent-Source: agent-skills-v1`.
3. Validate the live HTTP 402 resource, amount, `eip155:8453` network,
   canonical Base USDC asset, and recipient.
4. Pay only when the caller has authorized wallet use and the live amount.
   Use an existing x402 v2 client and replay with `PAYMENT-SIGNATURE`, or use an
   MPP `evm/charge` client and replay with `Authorization: Payment`.
5. Preserve the source header on replay. Reconcile `PAYMENT-RESPONSE` for x402
   or `Payment-Receipt` for MPP before using the output downstream.

The optional source header is declared attribution only. It is not
authentication, it contains no secret, and it cannot change price, payment, or
access. SameDayDesk reduces the exact allowlisted value to an aggregate
`agent-skills` source label so skill-driven discovery, challenges, and paid
successes can be measured separately from generic crawlers.

Discovery surfaces:

- x402 manifest: `https://agents.samedaydesk.com/.well-known/x402`
- OpenAPI: `https://agents.samedaydesk.com/openapi.json`
- MPP OpenAPI: `https://agents.samedaydesk.com/mpp-openapi.json`
- Compact skill contract: `https://agents.samedaydesk.com/skill.md`
- Action catalog: `https://agents.samedaydesk.com/api/actions`
- MCP transport: `POST https://agents.samedaydesk.com/mcp`
