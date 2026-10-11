# Closed task-result journey 211994

This receipt records the installed-source journey for `samedaydesk-task-result`. It is owner QA of the already released caller 0.1.1 against merchant `838abb50ec9ddac9e93d39d9f8c91f1f3ca44a35`. It is not native model selection, a customer task, settled revenue, or a registry publication.

Product head `0693da2a609df703f892eb4322d37910c3743b69`, tree `d6c8d61103f8664b7bcd02881e743a6dcb60ab5d`. Base `898694ca41b16616f5d0ee6f0026a2da7993164c`, tree `d107828c193576409947b2ce37b631bb9e47bdaa`. That base includes `c50ce6d4` and `68592000b6a9ba563c3302a3599aa9afe13752b7` (tree `04bf5181ab12f233bd2df2b71807187a6b97285d`) and does not contain receipt `c2c66a1de7111be3410e52c60a5a6c0fc595a418`. `skills/` is unchanged from `898694ca`. Nineteen skill directories remain. The other eighteen skill trees are the same bytes.

Node `/home/ubuntu/.nvm/versions/node/v22.23.3/bin/node`, `v22.23.3`. `chargedCents` was not recorded.

## Product commits

```text
0693da2a609df703f892eb4322d37910c3743b69 test: resolve recipe viem from the pinned merchant closure
67c1599cfbe71963e161fb076ce04712c2fa265d test: recover the hosted caller against the current merchant mount
```

`git diff --stat 898694ca41b16616f5d0ee6f0026a2da7993164c..0693da2a609df703f892eb4322d37910c3743b69` is seven test and recipe files, 672 insertions, 3 deletions. No merchant archive, payment code, or caller package changed.

## Hermes install

Installer checkout `/tmp/hermes-agent-1fd1827`, commit `1fd18277267152893a8a24792b79213e7ca3f899`. This checkout is not an unmodified vendor setup. `setup-hermes.sh` was edited locally during the earlier runtime install so `pm_args=()` replaced `pm_args=("$test_environment")`. That kept the runtime closure and skipped the full test extra set. System Python 3.12.3 cannot import the dependencies marked for Python 3.14. The store interpreter is `/tmp/hermes-user-211988/.hermes/tools/python-3.14.7+20260901-linux-x64/bin/python3`, Python 3.14.7.

Fresh skills home `/tmp/hermes-user-211994/.hermes`. It does not use `~/.hermes`. `installs` and `tools` in that home are symlinks to `/tmp/hermes-user-211988/.hermes/installs` and `/tmp/hermes-user-211988/.hermes/tools`, so this home borrows the already committed dependency store instead of downloading a second one. Launch environment:

```text
HOME=/tmp/hermes-user-211994
HERMES_HOME=/tmp/hermes-user-211994/.hermes
HERMES_RUNTIME_DIR=/tmp/hermes-user-211994/.hermes/tools
```

`hermes skills --help` exited 0. Install command, exit 0:

```text
hermes skills install \
  https://raw.githubusercontent.com/epistemedeus/x402-data-gateway-skills/0693da2a609df703f892eb4322d37910c3743b69/skills/samedaydesk-task-result/SKILL.md \
  --yes
```

The URL is that commit, not the branch. Scan: SAFE, skills-guard-v10, `sha256:393d70cc40e9f956b189f5e4d26b44a011bb47c8901d2533328e63476f8d2a67`, decision ALLOWED. Installed files match `git show 0693da2a609df703f892eb4322d37910c3743b69:skills/samedaydesk-task-result/<path>`:

| Path | Bytes | SHA256 |
| --- | --- | --- |
| SKILL.md | 3696 | `83fd65e53ffd93c45e7915afa0fd7e271ce226cb2a63e6d17e32b644bad66254` |
| scripts/task-result.mjs | 33653 | `d1bc056d8a08d912c11803f69c5d85d82348801ed28494bc870d7c4c72b714c3` |
| references/caller-pin.json | 3642 | `7e6adbccf8436c90e23e3ee2338cbac093c33968628e5c5cae5c7d697abb13b7` |
| references/LICENSE.txt | 1071 | `044d7291c37a2ead106ea4b4c26f713e63b7834637ed634da640f74e8cbe4625` |

## Merchant fixture

The receiver is `fixtures/mcp-task-recovery-loopback.mjs` from merchant `838abb50ec9ddac9e93d39d9f8c91f1f3ca44a35`. It mounts `mcp-server.mjs`, the native journal, and the opportunity and receipt handlers. A local worktree at `/tmp/merchant-838abb50-full` disabled sparse checkout only in that worktree. The original sparse checkout was left sparse. `npm ci --ignore-scripts --no-audit --no-fund` in that worktree, using the checkout `.npmrc` (`legacy-peer-deps=true`), added 244 packages and exited 0. No merchant file was committed.

The test process hosts a facilitator and a lossy proxy on `127.0.0.1` only. The facilitator returns fixture verify and settle results and never calls an external facilitator, chain, wallet, or real signature check. The payment signature in the supplied operation is the existing local fixture pattern. The proxy forwards to the real receiver and destroys one paid response after that receiver has finished the effect. Restart is a new receiver process and a new client process.

## Commands and exits

Recipe failure retained, before the resolver, exit 1. Node 22 ESM does not load `viem` through `NODE_PATH`.

```text
S88_MERCHANT_SOURCE_DIR=/tmp/merchant-pin-4910f83 node tests/recipes/run.mjs
```

`ERR_MODULE_NOT_FOUND` for `viem` from `tests/recipes/cases/settlement-proof.test.mjs` and `tests/recipes/cases/transaction-receipt.test.mjs`. Tests 24, pass 22, fail 2, skipped 0.

Recipe command after `tests/recipes/lib/fixture-deps.mjs` parents `viem` at the pinned merchant package `4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1`, exit 0. Tests 26, pass 26, fail 0, skipped 0. Pins and the eighteen unchanged skills were not edited to hide the failure.

Owning skills suite, exit 0:

```text
SAMEDAYDESK_CURRENT_MERCHANT=/tmp/merchant-838abb50-full node --test tests/*.test.mjs
```

Tests 87, pass 85, fail 0, skipped 2. The skips are the pre-existing optional Hermes producer check and the optional extract merchant replay. They are not this journey.

Installed journey, exit 0, tests 2, pass 2:

```text
SAMEDAYDESK_CURRENT_MERCHANT=/tmp/merchant-838abb50-full \
SAMEDAYDESK_TASK_RESULT_SCRIPT=/tmp/hermes-user-211994/.hermes/skills/samedaydesk-task-result/scripts/task-result.mjs \
SAMEDAYDESK_INSTALLED_SKILL_ROOT=/tmp/hermes-user-211994/.hermes/skills/samedaydesk-task-result \
node --test --test-concurrency=1 tests/samedaydesk-task-result-merchant-journey.test.mjs
```

The same file against the repository script also exited 0 before this install. Acceptance invocations of acquire, recover, retain, and feedback used the installed script above. The test checks those four installed files byte for byte against the exported skill.

Prompt redaction of malformed caller-private input across retain, recover, and feedback is in `tests/samedaydesk-task-result.test.mjs` and again from the installed script inside the journey. Each command finished within the 2 second limit, exited 2 with `input_rejected` or `result_rejected`, and did not write the input into stdout or stderr. The FIFO retain regression from `898694ca` still passes. Those two source repairs were not reopened.

## Installed journey counts

Acquire from the public hosted descriptor, `--install yes`, no `--public-root`:

- outcome `acquired`, version `0.1.1`, 15 members
- archive 32421 bytes, SHA256 `693652564f9cd587e4c269ff4da4653c19b1c68f42c3debe5241f34f42bf9de3`
- `hostedAcceptance` false, `npmInstall` `completed`, `descriptorSourceFetched` false, `receiving` `hosted_descriptor`
- `npmPublished` false and `registryPackageClaim` false

Supplied retain, separate from the merchant result: bytes kept exactly, `count` 0, `note` null, the absent key stayed absent, `isError` false. The merchant opportunity result was not given invented zero or null fields. Its real `decision` is `attempt` and `economics.expectedSurplusUsd` is 7.

`--pay`, `--settle`, `--sign`, and `--wallet` each exited 2 with `payment_refused` before any proxy request. Facilitator verify and settle were still 0.

Changed grant id on start: exit 3, `handle_rejected`, failure `grant_grantId_changed`, `toolCalls` empty, no added proxy request, settle stayed 0.

Lost paid response, then cold restart:

- skill start exit 0, outcome `transport_failure`, usefulness `unknown`, `paymentCreated` false, `newPaymentPermitted` false, `toolCalls` `["opportunity_preflight"]`
- facilitator verify 1, settle 1, `markerBeforeSettlement` true
- in-memory handler `opportunity` 1
- journal record `kind` `mcp`, `pending` absent
- revoked grant and widened `maxAtomic` on resume: each exit 3, `handle_rejected`, failure prefix `grant_`, `toolCalls` empty, proxy calls and verify/settle unchanged
- new receiver process, skill resume exit 0, outcome `restored_result`, `budgetUsefulness` `unknown`, pid distinct from the start process
- `toolCalls` `["recover_paid_result"]`
- `retainedResult.structuredContent` deep-equals `opportunityPreflight` for the supplied arguments
- `retainedResult` keeps `content`, `isError` is not true, and `_meta["samedaydesk/recovery"].version` is 1
- checkpoint budget from the acquired `mcpRecoveryBudget`: `reportedSettledAtomic` `50000`, `newPaymentPermitted` false, usefulness `unknown`
- after restart, handler counts `{opportunity: 0, receipt: 0}`
- verify stayed 1 and settle stayed 1 across the resume
- proxy tool names for this operation: `opportunity_preflight`, then `recover_paid_result`

Optional feedback, loopback only:

- MCP feedback on the recovered merchant result: `missing_input`, `connected` false, `posted` false, proxy request count unchanged. The merchant result has no caller feedback token. No token was invented and nothing was posted to a public feedback host.
- HTTP `--send yes` with an empty purchase: `capability_absent`, `posted` false, zero hits on the owned `127.0.0.1` server
- HTTP `--send yes` with the same synthetic token shape the existing suite already uses, resource `http://127.0.0.1`: `untrusted_origin`, `posted` false, zero hits, token absent from stdout

Direct comparison uses the acquired caller, not `bin/recover-mcp.mjs`. A second process imports `@modelcontextprotocol/sdk` `Client` and `startPaidMcpResult` / `resumePaidMcpResult` from that caller and runs the same supplied arguments through the same proxy loss. It is a second fixture operation, so it is not a replay of the first payment identifier.

- direct start state `unresolved`
- direct resume state `completed`, distinct pid, `structuredContent` equal to the skill `retainedResult.structuredContent`
- `isError` false, recovery version 1, top-level `_meta` present
- budget `reportedSettledAtomic` `50000`, `newPaymentPermitted` false, usefulness `unknown`
- `toolCalls` `["recover_paid_result"]`
- fixture totals after both operations: verify 2, settle 2, lost responses 2
- handler counts after the direct restart and resume: `{opportunity: 0, receipt: 0}`
- proxy tool names: `opportunity_preflight`, `recover_paid_result`, `opportunity_preflight`, `recover_paid_result`

Unknown local settlement (`success: false`, `errorReason: unknown_settlement`):

- skill start outcome `unresolved`, usefulness `unknown`, `paymentCreated` false, `newPaymentPermitted` false
- journal `settlementAttempted` true, verify 1, settle 1
- skill resume outcome `recovery_pending`, checkpoint `state` `unresolved`, usefulness `unknown`, `newPaymentPermitted` false
- `mcpRecoveryBudget`: `possibleAtomic` `50000`, `reportedSettledAtomic` null, `newPaymentPermitted` false, usefulness `unknown`
- verify and settle stay 1 across resume
- proxy names: `opportunity_preflight`, `recover_paid_result`
- handler counts after restart: `{opportunity: 0, receipt: 0}`
- direct SDK start and resume both stay `state` `unresolved`, `possibleAtomic` `50000`, `newPaymentPermitted` false
- after the direct operation the fixture totals are verify 2 and settle 2, with no third settle

`recovery_pending` on the skill resume is the skill classifier for an unresolved checkpoint whose last tool result has `isError`. The stored checkpoint is not a restored result. The direct library reports `unresolved` for the same checkpoint.

## Root publish steps

These steps were not run.

```text
git fetch origin codex/task-result-closed-journey-211994
git checkout 0693da2a609df703f892eb4322d37910c3743b69
git diff --stat 898694ca41b16616f5d0ee6f0026a2da7993164c..0693da2a609df703f892eb4322d37910c3743b69
git diff --exit-code 898694ca41b16616f5d0ee6f0026a2da7993164c..0693da2a609df703f892eb4322d37910c3743b69 -- skills
```

The receipt commit that follows `0693da2` adds only `docs/reviews/closed-task-result-211994/RESULT.md`. Reinstall from the raw commit URL above if the installed tree must match `0693da2`. Do not install the mutable branch URL. Merge into the skills default branch, registry publication, deployment, Chat Send, and customer copy stay with Root.
