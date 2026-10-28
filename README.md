# SameDayDesk Agent Skills

Installable skills that let an agent discover and call SameDayDesk's live
machine-commerce gateway. The 2026-09-10 `GET /api/actions` readback for version 1.23.46 listed twenty-three
deterministic paid HTTP actions (including `POST /extract/batch`), accepts x402
v2 or native MPP Payment authentication on the same URLs, and settles exact USDC
on Base without an account, API key, or subscription. Re-read the live catalog
before trusting any cached count. MCP (Model Context Protocol) `tools/list` is a separate inventory (S77 reported
twenty-three tools and thirteen typed `outputSchema` values; inventory counts
are not evidence of native model execution); do not
assume HTTP actions and MCP tools are the same population from a shared label.

Canonical gateway: `https://agents.samedaydesk.com`

## Install

```bash
npx skills add epistemedeus/x402-data-gateway-skills --all --yes
```

Install one skill with:

```bash
npx skills add epistemedeus/x402-data-gateway-skills --skill wallet-enrich --yes
```

## Antigravity

`plugins/samedaydesk-antigravity` is the Antigravity CLI plugin. `npx skills add` does not install it. It is not a listing in `antigravity-plugins-official`. The pinned checkout and the no-listing boundary are in that plugin's README.

## Skills

| Skill | Capability family | Paid routes |
| --- | --- | --- |
| `samedaydesk-machine-commerce` | Current walletless public-page discovery, catalog selection and nonspending purchase-intent preflight | All live paid HTTP routes from `/api/actions` (twenty-three at last check) |
| `company-enrich` | Company, contact, infrastructure, and AI-readiness evidence | `/enrich` |
| `wallet-enrich` | Base wallet and contract profiling | `/wallet-enrich` |
| `web-extract` | Live walletless first use for structured extraction or bounded Markdown with supported tables; separate paid routes | `/extract`, `/extract/batch`, `/read` |
| `repo-security-scan` | Static pre-install repository risk evidence | `/scan` |
| `schema-generate` | JSON-LD generation and structured-data gap analysis | `/schemaforge` |
| `deep-audit` | Combined company and AI-search-readiness audit | `/deep-audit` |
| `morpho-risk` | Morpho position, protection, market, and historical replay evidence | Four `/defi/morpho-*` routes |
| `opportunity-preflight` | Funded agent-work economics and hard gates | `/work/opportunity-preflight` |
| `agent-discoverability-audit` | Brand-blind rank, coverage, and stale exact-route pricing across machine-service catalogs | `/distribution/agent-discoverability-audit` |
| `payment-offer-preflight` | Credential-free x402 and MPP challenge comparison before buyer authorization | `/commerce/payment-offer-preflight` |
| `contract-qualified-search` | Search Agent402 and MPP by capability plus guaranteed output paths, or audit one known seller route | `/commerce/contract-qualified-search`, `/commerce/seller-integrity-audit` |
| `agent-surface-budget-audit` | Measure MCP and OpenAPI agent-context burden and get progressive-discovery fixes | `/distribution/agent-surface-budget-audit` |
| `settlement-proof` | Exact canonical Base USDC post-settlement verification | `/commerce/settlement-proof` |
| `transaction-receipt` | Normalized Base or Ethereum receipt, fee, and decoded transfer evidence | `/chain/transaction-receipt` |
| `wallet-policy-safety` | Exact-action and stateful delegated-wallet policy evidence | Two `/security/*wallet-policy-conformance` routes |
| `public-careers-board` | One caller-supplied public careers board, with source and coverage, from the free recipe | None. The command does not call the paid route. |
| `samedaydesk-task-result` | Acquire the published caller-result 0.1.1 archive and retain a caller-supplied result, recovery, or optional feedback statement | None. The command does not pay, sign, or settle. |
| `ein-llc-activation-continuation` | Acquire the public EIN.LLC continuation 0.1.5 archive and continue one supplied business context | None. The command does not claim, pay, or file. |
| `lockfile-defect-report` | Execute a caller-owned npm lockfile pair and compare a plain-language expectation; structured capture is optional | None. The command does not submit, award, or pay. |

## Task result

`samedaydesk-task-result` acquires the published caller and runs it on caller-owned files. From the installed skill, run `node scripts/task-result.mjs acquire --work DIR`. A missing result file returns the next action. Payment stays with a separate executor.

## EIN activation continuation

`ein-llc-activation-continuation` acquires the public EIN.LLC continuation 0.1.5 archive and runs it on caller-owned files. From the installed skill, run `node scripts/continuation.mjs acquire --work DIR`, then `assess`, `prepare`, `resume`, `status`, `show`, or `cancel` against `https://ein.llc` with `agent_assisted_human`. A missing context file returns the next action. Claim, payment, and filing stay with the human. `disposable_owner_qa` is only for an owned loopback.

## Lockfile defect report

`lockfile-defect-report` reads the current N-BTY-003 offer and prepares a report for a caller-owned npm lockfile v2 or v3 pair. From the installed skill, run `node scripts/report.mjs acquire --work DIR`, then run the maintained engine on the caller's `before.json` and `after.json`. Compare the caller's expected behavior with the actual delta. The structured `report --expected` mode is optional. A missing file stays missing. The kit owner fixture is not a substitute. Submission and the original one-award payment stay outside the command.

## Live contract first

For one caller-owned public HTTPS page, the two existing skills first follow
OpenAPI `x-service-info.docs.extractionTrial` on the same origin and GET the
fresh `no-store` contract before constructing any trial request. Its current
`request` describes structured extraction; `reader.request` describes bounded
Markdown with supported native HTML tables. Discovery is not authorization for
an unsolicited fetch. Both operations share the original finite hop allowance,
one concurrent lease and current expiry; a hop is not a call. Refusal or an
unknown outcome never becomes an automatic retry or payment. Direct/native
alternatives and the separate nonspending paid-intent path remain available.
The live challenge determines which payment protocols are actually offered;
historical MPP examples do not establish current availability.

Do not trust a cached price or payment example. Before any separate executor pays:

1. Read `https://agents.samedaydesk.com/api/actions` or the relevant operation
   in `https://agents.samedaydesk.com/openapi.json`.
2. Use the selected operation’s exact method, URL, query and JSON body, including
   POST for `/extract/batch`. Send only the initial unpaid request with
   `X-SameDayDesk-Agent-Source: agent-skills-v1`.
3. Validate the live HTTP 402 resource, amount, `eip155:8453` network,
   canonical Base USDC asset, and recipient.
4. Keep the public catalog skill credential-free and stop at a verified
   purchase intent.

The public `samedaydesk-machine-commerce` skill does not access wallets, sign,
create payment credentials, broadcast transactions, or replay paid requests.
Payment execution belongs to a separate capability with its own explicit
authority and receipt reconciliation.

A separately authorized executor can consume the purchase intent, select one
protocol, and reconcile `PAYMENT-RESPONSE` for x402 or `Payment-Receipt` for
MPP before using the paid output downstream.

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

## Deterministic consumer validation

The historical filename `consumers/heavy-extract-preflight.mjs` names a Node
script, not a native Grok/Heavy model. It reads local skill guidance and sends
one credential-free request for the fixed example.com target. HTTP 402 proves
only that a challenge was observed, not verified payment terms or source execution.
No model was invoked, no skill installation was tested here, and no paid replay
is available. Environment credentials, custom origins and custom targets are ignored.

```bash
node --test tests/*.test.mjs
node consumers/heavy-extract-preflight.mjs --help
```

Optional public network probe (one unpaid request, no automatic retry):

```bash
node consumers/heavy-extract-preflight.mjs
```

`--direct-preview` adds one fixed example.com read, with no redirects and a bounded
UTF-8-only preview. It is not a complete page or an equivalent extraction service.
`--out NEW_FILE` writes a new local report and refuses overwrite.

The pure consumers in `consumers/extract-record.mjs` interpret delivered records;
they neither fetch nor pay. Their `usableCandidate` is not buyer acceptance,
complete coverage, a payment receipt, or execution authority. `chargedClaim`
retains the batch field as a claim, never as payment verification.

The committed fixtures were generated offline by the exact merchant source;
see `fixtures/extract-contract/README.md`. Optional source replay requires an
existing exact merchant checkout with its own dependencies, no installation:

```bash
EXTRACT_MERCHANT_SOURCE_DIR=/path/to/exact-merchant-checkout node --test tests/*.test.mjs
```

Without that path, only the optional source-replay test is explicitly skipped.
Native model selection, installation and execution remain a separate gate.

Current walletless guidance also has offline producer fixtures at
`fixtures/walletless-first-use/`. Their separate optional replay uses the merchant
at `6517665410c4e1267d7c2a7ef8860abdeec8086c` with its locked dependencies:

```bash
FIRST_USE_MERCHANT_SOURCE_DIR=/path/to/exact-current-merchant \
  node --test --test-concurrency=1 tests/walletless-first-use.test.mjs
```

Without that input the current producer replay is explicitly skipped. These
tests compare guidance decisions and delivered records, not model execution or
live trial availability. They make no trial request over the network.

## Offline buyer recipes

With Node 22, install each checkout's locked dependencies using
`npm ci --ignore-scripts`, set `S88_MERCHANT_SOURCE_DIR` to the merchant checkout
at `4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1`, then run
`npm run test:recipes`. See `tests/recipes/README.md` for exact scope.
These are direct merchant-function fixture tests, not installed model-consumer,
paid delivery, or live financial evidence. The runner blocks network fallthrough
and verifies the imported merchant source bytes.
