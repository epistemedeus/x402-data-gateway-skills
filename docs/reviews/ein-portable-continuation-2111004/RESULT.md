# EIN portable continuation 2111004

Distribution receipt for one acquisition skill. This file is not part of the product tree.

## Source and routing

- Skills repository: `epistemedeus/x402-data-gateway-skills`
- Branch: `codex/ein-portable-continuation-2111004`
- Base: `612f61c651b41dba00523c5db1f80424e0a7ca68`
- Product commit: `b269566f14b1200d9e0f9b9230160abb0de11cd6`
- Product tree: `ae73465016b5cdbe7ea9049971385e3ce74e223a`
- This receipt is the commit that follows that product commit.
- EIN source, read only: `epistemedeus/ein-llc-lean` `23e52b4a46916c1df29bf54d26017e51e8e24acb` at `/tmp/ein-2111004`. No EIN source, archive, or manifest bytes were edited. An incidental `package-lock.json` caret change from an earlier api-server install was restored.
- Runtime: Node `v22.23.3`. Continuation package engines require Node `>=22`. No npm install for the continuation client.
- Hermes installer: `/tmp/hermes-user-211988/.local/bin/hermes`, which execs the enrolled checkout launcher. `hermes --version` reports Hermes Agent `vgit.1fd1827.dirty` (`2026.9.24`), Python `3.14.7`.
- Fresh task home: a new `HERMES_HOME` whose `installs` and `tools` symlinks point at `/tmp/hermes-user-211988/.hermes`. An empty home has no committed dependency environment and exits before install. Skills land in the fresh home.
- Merchant pin used only by the existing recipe runner: `/tmp/merchant-pin-4910f83` at `4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1`. Recipe `skillsPin` remains `2c57e275bbb57421d08c4a270ba6ab5237ff2ec8`.
- No other model, Bot message, live production operation, or registry publication.

## What shipped

The base catalog has 19 skills and no EIN activation continuation entry. This branch adds `skills/ein-llc-activation-continuation`. The other 19 skill directories are unchanged against the base. README catalog text, the validation count (now 20), the export catalog expectation, and one inventory family were the only shared edits. The inventory family is `independent_contract_tests`, not a merchant recipe.

The skill acquires the pinned public archive and calls the existing continuation commands. It does not fork the client or add a second state machine.

## Acquisition bytes

Hosted anonymous GET, recorded separately from the frozen descriptor field `published: false`. That field stays false. Acquiring the archive does not rewrite it.

| Object | Bytes | SHA-256 |
| --- | ---: | --- |
| `https://ein.llc/downloads/ein-activation-continuation-v0.1.5.json` | 9131 | `3734639536ee9104549592e46271148e12ed2e4c69191b858116fdbd3ad7da4f` |
| `https://ein.llc/downloads/ein-activation-continuation-v0.1.5.tgz` | 50590 | `e490d78753e8bb8e18aa517b882107f667f088546ace4888e5f86b86b9afb6f0` |

Uncompressed tar is 225280 bytes. Current readback is 39 regular `ustar` members under `ein-activation-continuation/`. The assignment text said 40 members. This source and the live descriptor both list 39 files. The pin records 39.

Vendored dependency name is `ein-formation-http-client` `0.1.1`. The package.json inside that directory is named `ein-public-http-client`, MIT. The skill checks that package name.

## Installed journey

Final install URL:

`https://raw.githubusercontent.com/epistemedeus/x402-data-gateway-skills/b269566f14b1200d9e0f9b9230160abb0de11cd6/skills/ein-llc-activation-continuation/SKILL.md`

Each of `SKILL.md`, `scripts/continuation.mjs`, `references/continuation-pin.json`, and `references/LICENSE.txt` returned HTTP 200. The journey then byte-compared those installed files to the product tree, acquired `https://ein.llc` from the installed script, and checked import closure: outcome `acquired`, `npmInstall` false, runtime `v22`, descriptor `published` field false, no `node_modules`.

Command, from `/tmp/skills-2111004`:

`EIN_LEAN_ROOT=/tmp/ein-2111004 HERMES_BIN=/tmp/hermes-user-211988/.local/bin/hermes EIN_SKILL_PRODUCT_URL=<url above> node --test --test-concurrency=1 --test-force-exit tests/ein-llc-activation-continuation-journey.test.mjs`

Exit 0. 3 passed, 0 failed, 26075.533397 ms.

Positive and negative outputs on the owned loopback disposable host (`artifacts/api-server` disposable host plus the real agent catalog, synthetic `owner@example.test` fixture identity, caller key `loopback-caller-key-2111004`):

- Missing context: exit 0, `missing_input`. No example ran.
- Technical context (`providerRequiresUsEntity` no, `providerRequiresEin` no): `not_needed_now`, next action `stop`, then `prepare_refused`.
- Unknown context: `insufficient_information`, next action `clarify_prerequisite`, then `prepare_refused`.
- Already satisfied (`hasUsEntity` yes, `hasEin` yes): `already_satisfied`, next action `stop`, then `prepare_refused`. Applications stayed 0.
- Qualifying supplied context: `required_for_selected_path`.
- Prepare with `EIN_PREPARE_FAILPOINT=after_commit`: exit 2, `prepare_uncertain`, after the host committed one application and one `formation_application_authority`.
- Second process, new host, same store: `resume` returned the same `applicationId`. `claimTokenHash` was unchanged. A second `resume` left the application count at 1.
- The direct `bin/ein-continuation.mjs` on the same lane returned the same `prepare_uncertain` and the same resume outcome, also one application, `paid` false.
- `show` omitted `claimUrl`. `show --show-claim-url` returned `https://ein.llc/review/app_...` and next action `human_claim`. The customer key and intended email were absent from that stdout.
- `status` before a grant: `missing_grant`. Fixture `POST` claim with `Bearer owner` returned 200. Fixture grant issue returned 201. Grant-scoped `status` stayed `paid` false and `complete` false. The grant token was absent from stdout.
- `payment_attempts` and `application_intakes` stayed 0.
- Wrong task id on the same continuation file: `task_mismatch`. Wrong key: `customer_mismatch`. Wrong intended email: `recipient_changed`. Application count stayed 1.
- Grant origin `https://ein.llc` against the loopback API: `foreign_credential`. The grant was not sent.
- Catalog `catalogVersion` `1999-01-01` and a changed `priceNote`, through a loopback proxy in front of the real host: `terms_changed`. No `authorization` header and no `/status` request.
- Expired grant: `grant_rejected`. Revoke returned 204, then `grant_rejected`.
- Truncated continuation JSON: `continuation_unreadable`. The private marker was absent from stdout.
- Discover against a loopback server that never responds, `--deadline-ms 200`: `timeout`.

Unit acquisition gates in `tests/ein-llc-activation-continuation.test.mjs` also passed inside the skills suite: malformed context and FIFO without disclosure, traversal, symlink, hardlink, device, FIFO, truncated and tampered descriptor, cross-origin redirect, overwrite refusal, and hosted acquire.

## Other suites

Skills normal/catalog/validation, same Node, `EIN_LEAN_ROOT` and `HERMES_BIN` set so the journey did not skip:

`node --test --test-concurrency=1 --test-force-exit tests/*.test.mjs`

Exit 0. 98 tests, 94 pass, 0 fail, 4 skip, 47956.317955 ms. The four skips are existing optional checks: pinned Hermes producer checkout, exact merchant replay, and two `SAMEDAYDESK_CURRENT_MERCHANT` cases pinned to `838abb50ec9ddac9e93d39d9f8c91f1f3ca44a35`. They are not this skill.

Recipes:

`S88_MERCHANT_SOURCE_DIR=/tmp/merchant-pin-4910f83 node tests/recipes/run.mjs`

Exit 0. 26 pass, 0 fail, 3470.726224 ms.

Public continuation, `/tmp/ein-2111004/tools/activation-continuation`:

`npm test` (`node --experimental-strip-types --test --test-concurrency=1 test/*.test.mjs`)

Exit 1. 76 tests, 75 pass, 1 fail, 40262.981225 ms. The failure is `receiving: built machine index, frozen bytes and actual handler contract compose; stale release refuses`. It opens `artifacts/ein-llc/dist/public/downloads/ein-activation-continuation-v0.1.5.tgz`, which is not in the git tree. `dist` is gitignored. Copying `public/` into `dist/public` then failed on the Astro-emitted `api/v1/service-catalog.json`, which is also absent until a site build. Assertions were not changed. The other 75 tests passed, including supplied-context, protocol-loss, and refusal coverage. The partial `dist` copy was removed.

Human-claim consumer, `/tmp/ein-2111004/tools/human-claim-consumer-100389`:

`npm test`

Exit 0. 16 pass, 0 fail, 13988.036669 ms. This source's count is 16.

## Direct client comparison

The published CLI can use `agent_assisted_human` on an https origin, including a `localhost` loopback alias. This skill refuses that lane, so it does not start a live case. `discover` of exact `https://ein.llc` is allowed, and the skill sets `agent_assisted_human` only for that command.

On the qualifying loopback case, the skill and the direct CLI produced the same uncertain prepare and the same resume outcome, with one application and no payment. The skill adds the pinned acquire, `missing_input` when a caller file is absent, stdout withholding of the key, email, and grant, and loopback-only business operations. No time or cost saving is claimed. No customer, revenue, or model-selection result is claimed. Hosted reads were anonymous GETs. Loopback cases were owner QA on `127.0.0.1`.

## Limits

- `published: false` remains the frozen historical field.
- Member count on this readback is 39.
- One of the 76 continuation tests needs an Astro `dist/public` from this same source, including `api/v1/service-catalog.json`.
- The skill does not claim, pay, attest, register, file, or mint a grant.
- No outside adoption is shown.

## Root next steps

- Review this branch and merge it when the catalog addition is accepted. This receipt is not a publication.
- Registry publication and any production claim stay with Root.
- EIN manifest and source identity stay with the 1002 owner. Do not rewrite `published` to true.
- A site build of `ein-llc` at `23e52b4a46916c1df29bf54d26017e51e8e24acb` is the remaining input for the one built-catalog receiving assertion.
