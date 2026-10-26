# Walletless first-use contract fixtures

`producer.json` receives the actual `extractionTrialContract` and
`mountExtractionTrial` exports at merchant commit
`6517665410c4e1267d7c2a7ef8860abdeec8086c`. Synthetic admission snapshots and
caller-page bytes are injected in process. The real parser, request validation,
refusals, extract/reader and bounded table converter produce the records.
Only `fetchedAt` is removed for deterministic comparison. No socket, runtime
store, provisioning, grant reset, live trial POST or payment is used.

`merchant-source.json` retains the supplied twelve full-byte identities and the
five additional relative producer imports. Every member's byte count, Git blob
and SHA-256 is checked before source import. The frozen server supplies the
OpenAPI `x-service-info.docs.extractionTrial` pointer; its discovery mount emits
`no-store`. The fixtures intentionally retain the producer's status-schema
spread, including `samedaydesk.extraction-trial-budget.v1` on enabled views.

The test budget is an in-memory admission stub shared by both mounts. It proves
consumer-facing shared snapshots and cross-operation busy refusal, not durable
budget persistence, real DNS/redirect accounting or installed availability.
Those server guarantees are read from the frozen authority and original tests;
the skills must always receive the live contract before a caller task.

Normal tests parse both skills' route/body and availability decision tables
against these producer records, then exercise the existing pure delivered-record
consumer. They do not execute a model or establish buyer usefulness, acquisition,
payment, revenue or general table fidelity. The older extract fixtures and S88
recipe pins remain separate and unchanged.

Optional replay requires an existing exact merchant checkout with its own locked
dependencies (`npm ci --ignore-scripts`), with no installation inside the test:

```bash
FIRST_USE_MERCHANT_SOURCE_DIR=/path/to/merchant-at-65176654 \
  node --test --test-concurrency=1 tests/walletless-first-use.test.mjs
```

Without that variable, replay is explicitly skipped. A supplied missing,
modified or dependency-incomplete checkout fails rather than becoming a pass.
Serial execution is required because replay temporarily blocks sockets and
injects the producer's test-only source-fetch seam. To regenerate after reviewing
the exact source, call `replayTrial` from `tests/walletless-merchant-replay.mjs`
and serialize its result; never refresh these fixtures with a live trial call.

Source: [SameDayDesk merchant](https://github.com/epistemedeus/x402-url-extractor/blob/6517665410c4e1267d7c2a7ef8860abdeec8086c/extraction-trial.mjs),
[MIT license, Copyright (c) 2026 SameDayDesk](https://github.com/epistemedeus/x402-url-extractor/blob/6517665410c4e1267d7c2a7ef8860abdeec8086c/LICENSE).
