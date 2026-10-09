# Buyer recipe contract pack (S88)

Offline contract recipes call the pinned merchant exports with disposable inputs
and assert their actual output or refusal. They do not execute an installed model
consumer, test a paid delivery, or authenticate chain evidence. There is no synthetic
acceptance classifier: hand-written usable/paid flags are not evidence.

## Pins

- Skills pack: see `inventory.json` `skillsPin`
- Merchant source: see `inventory.json` `merchantPin` (`epistemedeus/x402-url-extractor`)

Live catalog prices are not frozen in skill text. To refresh fixtures after a
merchant release, follow `merchantUpdateProcedure` in `inventory.json`.

## One-command replay (Node 22)

```bash
export S88_MERCHANT_SOURCE_DIR=/path/to/x402-url-extractor
# Checkout merchant commit 4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1 there first.
# Run npm ci --ignore-scripts in both the merchant and skills checkouts.
node tests/recipes/run.mjs
```

Or:

```bash
npm run test:recipes
```

Recipes run with `--test-concurrency=1` because a few cases temporarily patch
process-global extract fetch / DNS hooks.

## Scope

Nine build families each include one useful caller task and one
refusal/unsupported case. S81-refreshed `web-extract` and
`samedaydesk-machine-commerce` are non-changing audits only. Remaining skills
are inventoried as candidates without invented filler cells. The public careers
and received-useful-work families use the independent contract tests named in
`inventory.json`; they are not fabricated merchant recipes. The inventory tracks
the installed skill names rather than freezing their count at the S88 snapshot.

The runner blocks real network access, including accidental fetch fallthrough.
Merchant module bytes and their relative-import closure must match
`merchant-source.json` before import, including when no Git directory is present.
Dependency versions come from the pinned merchant lockfile. Recipe evidence is
limited to those functions and fixture cases; missing contracts or full chain/live
checks remain outside this suite.
