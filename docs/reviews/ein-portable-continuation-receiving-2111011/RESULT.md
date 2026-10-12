# EIN portable continuation receiving 2111011

Distribution receipt for the canonical-lane correction. This file is not part of the product tree.

## Source and routing

- Skills repository: `epistemedeus/x402-data-gateway-skills`
- Branch: `codex/ein-portable-continuation-receiving-2111011`
- Base catalog: `612f61c651b41dba00523c5db1f80424e0a7ca68` (19 skills, no EIN continuation entry)
- Prior product: `b269566f14b1200d9e0f9b9230160abb0de11cd6`, tree `ae73465016b5cdbe7ea9049971385e3ce74e223a`
- Prior receipt, left unchanged: `8f385da585a1ce67cf879f49bc71299d87dc1d40` on `codex/ein-portable-continuation-2111004`
- This product commit: `cccf830ee18d0f04c5353c4ac2fb8f801299877e`
- This product tree: `d6f13c82e9bf58de1599cda2d2be23a53cb13671`
- This receipt is the commit that follows that product commit.
- EIN source, read only: `epistemedeus/ein-llc-lean` `23e52b4a46916c1df29bf54d26017e51e8e24acb` at `/tmp/ein-2111004`. No EIN source, archive, descriptor, vendor, or license bytes were edited. `git status` was empty after the site build. `dist` is gitignored scratch.
- Source choice: the exact `23e52b4` checkout. Current main `82db` was not substituted. The site build completed on this checkout, so a byte-identity comparison with `82db` was not required.
- Runtime: Node `v22.23.3`. Continuation package engines require Node `>=22`. The continuation client still does not run npm install.
- Hermes installer: `/tmp/hermes-user-211988/.local/bin/hermes`. `hermes --version` reports Hermes Agent `vgit.1fd1827.dirty` (`2026.9.24`), Python `3.14.7`.
- Fresh task home: a new `HERMES_HOME` whose `installs` and `tools` symlinks point at `/tmp/hermes-user-211988/.hermes`.
- Merchant pin used only by the existing recipe runner: `/tmp/merchant-pin-4910f83` at `4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1`. Recipe `skillsPin` remains `2c57e275bbb57421d08c4a270ba6ab5237ff2ec8`.
- No other model, Bot message, registry publication, deploy, or default-branch push.

## Original limitation and the correction

The 2111004 skill acquired the hosted 0.1.5 archive and ran the disposable loopback journey. `laneFor` and `runContinuation` still sent every business command through loopback only, and `agent_assisted_human` was refused on every origin. `SKILL.md` taught only disposable owner QA. That described the previous execution lane. It was not a requirement to keep an ordinary visitor off the maintained service.

The published client already owns the state machine. On exact `https://ein.llc` its lane is `agent_assisted_human`. On loopback its lane is `disposable_owner_qa`. `autonomous_machine_purchase` is refused. This change makes the skill select that same pair. It does not add a second state machine.

`serviceOrigin` accepts bare `https://ein.llc` or `http://127.0.0.1:PORT` / `http://[::1]:PORT`. `localhost` stays refused by the skill. The published client still treats `localhost` as loopback. `disposable_owner_qa` on `https://ein.llc` is `lane_refused`. `agent_assisted_human` on loopback is `lane_refused`. Any other origin is `origin_refused`. Omitting `--lane` selects `agent_assisted_human` for `https://ein.llc` and `disposable_owner_qa` for an owned loopback.

`runContinuation(flags, supplied)` passes `supplied.fetch` into the unchanged client when that value is a function. Otherwise it uses `globalThis.fetch`. The CLI does not grow a fetch flag. The seam is a test transport. A synthetic response from it is not a live case and not a paid status.

Claim, payment, attestation, and filing stay with the authorized human. The customer key and the human-issued grant stay distinct. The command does not invent a customer, a grant, or a paid status.

The 19 predecessor skill directories are byte-identical to `612f61c651b41dba00523c5db1f80424e0a7ca68` (`git diff --quiet` exit 0). The EIN pin, archive member list, vendor package name `ein-public-http-client` 0.1.1, MIT license, and historical `published: false` field are unchanged from `b269566`.

## Acquisition bytes

Hosted anonymous GET. The frozen descriptor field `published` stays false.

| Object | Bytes | SHA-256 |
| --- | ---: | --- |
| `https://ein.llc/downloads/ein-activation-continuation-v0.1.5.json` | 9131 | `3734639536ee9104549592e46271148e12ed2e4c69191b858116fdbd3ad7da4f` |
| `https://ein.llc/downloads/ein-activation-continuation-v0.1.5.tgz` | 50590 | `e490d78753e8bb8e18aa517b882107f667f088546ace4888e5f86b86b9afb6f0` |

Current readback remains 39 regular `ustar` members. The skill does not rewrite that count.

## Installed product URL

Final install URL:

`https://raw.githubusercontent.com/epistemedeus/x402-data-gateway-skills/cccf830ee18d0f04c5353c4ac2fb8f801299877e/skills/ein-llc-activation-continuation/SKILL.md`

Before the suite, each of `SKILL.md`, `scripts/continuation.mjs`, `references/continuation-pin.json`, and `references/LICENSE.txt` returned HTTP 200 and matched the product tree bytes:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `SKILL.md` | 4462 | `4448452f960a9e9979dedc61112c81dc89a08a6e293fbd2959a2fcfb2702b5b2` |
| `scripts/continuation.mjs` | 24342 | `07dc8ee41d5a2a29beffdb426113c576e1a72a84060dd24861cb30d30fae3acc` |
| `references/continuation-pin.json` | 8202 | `866e5a4755c3cdc70c52d6c1c84a2a896e8d89c0ad5b5b98eb388e443c8404db` |
| `references/LICENSE.txt` | 1079 | `bf4623255db76888a7b6919c4011ee054b19bb6b089491ec2106772ecc4e375b` |

The skills suite then installed that URL with Hermes, byte-compared those four files to the product tree, acquired `https://ein.llc` from the installed script, and ran the cold loopback journey.

Command, from `/tmp/skills-2111011`:

`EIN_LEAN_ROOT=/tmp/ein-2111004 HERMES_BIN=/tmp/hermes-user-211988/.local/bin/hermes HERMES_RUNTIME_HOME=/tmp/hermes-user-211988/.hermes EIN_SKILL_PRODUCT_URL=<url above> node --test --test-concurrency=1 --test-force-exit tests/*.test.mjs`

Exit 0. 99 tests, 95 pass, 0 fail, 4 skip, 49992.74277 ms. The four skips are the same optional checks as 2111004: pinned Hermes producer checkout, exact merchant replay, and two `SAMEDAYDESK_CURRENT_MERCHANT` cases pinned to `838abb50ec9ddac9e93d39d9f8c91f1f3ca44a35`.

The three journey tests inside that run passed:

- `installed skill acquires hosted 0.1.5 and stops missing, unknown, irrelevant, and satisfied contexts` (8270.814722 ms)
- `qualifying loopback prepare loss resumes the same operation, and the direct client matches` (10510.746246 ms)
- `wrong task, key, recipient, grant, archive faults, and cold pending status stay unpaid` (8258.575833 ms)

Loopback evidence, owned disposable host, synthetic `owner@example.test`, caller key `loopback-caller-key-2111004`:

- Missing, technical, unknown, and already-satisfied contexts stop before a case.
- Qualifying context with `EIN_PREPARE_FAILPOINT=after_commit` returns `prepare_uncertain` after one committed application.
- A later process resumes the same `applicationId`. The direct `bin/ein-continuation.mjs` on the same lane returns the same uncertain prepare and the same resume, with one application and `paid` false.
- Wrong task, key, recipient, grant origin, changed terms, expired grant, revoke, tamper, and timeout stay refused. Pending status stays unpaid.

## Supplied transport, not a live case

`tests/ein-llc-activation-continuation.test.mjs` prefetches the anonymous catalog and OpenAPI documents, acquires the hosted archive, then replaces `globalThis.fetch` with a function that throws `live_production_fetch`. The test passes `supplied.fetch`. That function serves the saved GET bodies and synthetic assess, prepare, and status bodies. It does not forward those operations.

Observed construction, all on `https://ein.llc`, lane `agent_assisted_human` with `--lane` omitted on assess:

- `POST /api/agent/v1/assessments` with the mapped supplied facts (`goal` and the yes/no/unknown fields). Assessment id `asmt_supplied_2111011`. `paid` false.
- `POST /api/agent/v1/applications` with `assessmentId`, intended email `supplied-recipient@example.test`, and `operationId` `task:task-route-2111011`. Application id `app_supplied_transport_2111011`. `paid` false. The claim token was absent from the skill result.
- `resume` did not send a second prepare.
- `GET /api/agent/v1/applications/app_supplied_transport_2111011/status` with `Authorization: Bearer` the grant file, not the customer key. The grant was not in the URL. Observed status `provisional`, `paid` false, `filingAuthorization` false.
- `show` kept `claimLinkStored` true and omitted `claimUrl`. `show --show-claim-url` returned `https://ein.llc/review/app_supplied_transport_2111011?claim=...` for the intended human handoff. Neither show sent a request.
- `cancel` sent no request and reported `serverCaseCancelled` false.
- `liveProductionCalls` stayed 0.

These ids are labels for the supplied transport. They are not production applications.

## Direct published client

The comparison used the client acquired from `https://ein.llc` in this run (`/tmp/ein-cli-compare-2111011/work/ein-activation-continuation/bin/ein-continuation.mjs`).

| Call | Result |
| --- | --- |
| Skill `http://localhost:9` with `disposable_owner_qa` | exit 2, `origin_refused` |
| Skill `https://ein.llc` with `disposable_owner_qa` | exit 2, `lane_refused` |
| Skill `https://ein.llc` with `--lane` omitted and a missing key file | exit 0, `missing_input` (lane accepted, no request) |
| Published client `https://ein.llc` with `disposable_owner_qa` | exit 2, `lane_refused` |
| Published client `http://127.0.0.1:9` with `agent_assisted_human` | exit 2, `lane_refused` |
| Published client `http://localhost:9` with `disposable_owner_qa` | exit 2, `unavailable` on `GET /api/v1/service-catalog` (lane accepted; the skill refuses this alias before a request) |
| Published client `discover` on exact `https://ein.llc` with `agent_assisted_human` | exit 0. `apiOrigin` `https://ein.llc`, catalog `ein.agent-service-catalog.v1` version `2026-10-01`, assess `POST /api/agent/v1/assessments`, prepare `POST /api/agent/v1/applications`, status `GET /api/agent/v1/applications/{applicationId}/status`, human step `https://ein.llc/review/{applicationId}`, `instantAgentCheckout` false, `paid` false, `filingAuthorization` false, `applicationId` null. Two anonymous GETs. No prepare. |

The caller key was not present in that transcript. No time or cost saving is claimed. No customer, revenue, or model-selection result is claimed.

## Site build for the built-catalog gate

2111004 recorded 76 continuation tests, 75 pass, 1 fail. The failure was `receiving: built machine index, frozen bytes and actual handler contract compose; stale release refuses`, because `artifacts/ein-llc/dist/public` was absent. `dist` is gitignored. Copying `public` onto `dist` was not repeated.

This run, at `/tmp/ein-2111004` on `23e52b4a46916c1df29bf54d26017e51e8e24acb`:

`npm ci --no-audit --no-fund`

Exit 0. `added 749 packages`. Root `package.json` names `packageManager` `pnpm@11.25.0` and the tree also has `pnpm-lock.yaml`. `package-lock.json` is present, and `npm ci` did not change tracked files. There is no site README. The site build command is the `build` script in `artifacts/ein-llc/package.json`.

`npm run build` in `/tmp/ein-2111004/artifacts/ein-llc`

That script runs `public-ein-client-pack.mjs --check`, `tools/activation-continuation/scripts/pack.mjs --check`, `i18n-check.mjs`, `astro build`, and `post-build.mjs`. Astro resolved as `6.4.8`. Exit 0. The build wrote `dist/public/downloads/ein-activation-continuation-v0.1.5.tgz` and `dist/public/api/v1/service-catalog.json`. No public-to-dist copy and no substitute catalog.

`npm test` in `/tmp/ein-2111004/tools/activation-continuation`

Exit 0. 76 tests, 76 pass, 0 fail, 44394.542529 ms. The previously failing receiving test passed (1357.106427 ms). Assertions were not changed.

## Other suites

Recipes, from `/tmp/skills-2111011`:

`S88_MERCHANT_SOURCE_DIR=/tmp/merchant-pin-4910f83 node tests/recipes/run.mjs`

Exit 0. 26 pass, 0 fail, 3008.635314 ms.

Human-claim consumer, `/tmp/ein-2111004/tools/human-claim-consumer-100389`:

`npm test`

Exit 0. 16 pass, 0 fail, 14056.741625 ms.

## Limits

- `published: false` remains the frozen historical field. Member count remains 39.
- The supplied-transport test proves route selection and request construction. It does not prove a live prepare, claim, or payment.
- The one live published-client call in this receipt is anonymous `discover` on `https://ein.llc`. It stored a local continuation and did not prepare.
- The skill still refuses `localhost`, arbitrary origins, credentials in the origin, and redirects off the pinned path.
- No outside adoption is shown.

## Root next steps

- Review this branch and merge it when the canonical installed entry is accepted. This receipt is not a publication.
- Registry publication, deployment, and any default-branch push stay with Root.
- EIN hosted source identity stays with its current owner. Do not rewrite `published` to true and do not edit that source from this branch.
- A visitor still supplies the context, customer key, recipient, and task id. Claim, payment, attestation, and filing stay with the authorized human.
