# Extract contract fixtures

Synthetic, offline output from merchant 1.23.46 at
`4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1`. These are records from actual exported
`extract`, `readMarkdown` and `executeExtractBatch` functions with injected source
responses; they are not paid deliveries, native model runs, or live website evidence.
The batch producer sets `charged:true` as part of its output contract. No payment
was made in fixture generation; consumers must not promote that flag to a receipt.

`tests/merchant-replay.mjs` replays raw HTML/status/Shift-JIS bytes through the
pinned source and validates outputs with its exported schemas. `merchant-source.json`
records exact source blob identities, not vendored merchant code. The normal tests
exercise the exported skills consumers on these records and hostile variations.
No truncation flag proves complete comments or buyer acceptance.
