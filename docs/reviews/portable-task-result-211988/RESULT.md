# Portable task result 211988

Receipt for the published-client acquisition skill. This file is the carrier. It does not merge, deploy, publish a registry, send a chat, or change an operational queue.

## Base, head, tree

Owning repository: `epistemedeus/x402-data-gateway-skills`.

| Fact | Value |
| --- | --- |
| Base | `de1cc34def701f0c9266120fe592bfd51d747407` |
| Product commit 1 | `32108ed46f454acc8bfac62e8ae752245cf830ee` |
| Product commit 2 | `68592000b6a9ba563c3302a3599aa9afe13752b7` |
| Product head | `68592000b6a9ba563c3302a3599aa9afe13752b7` |
| Product tree | `04bf5181ab12f233bd2df2b71807187a6b97285d` |
| Branch | `codex/portable-task-result-211988` |

Commit 2 classifies an absent caller directory as `missing_input` with a next action. The first install of the branch URL happened before GitHub raw served that script, so the installed-source readback below uses the commit URL of product head.

`git diff de1cc34def701f0c9266120fe592bfd51d747407 HEAD -- skills ':!skills/samedaydesk-task-result'` is empty. The existing 18 skill trees are unchanged. `samedaydesk-machine-commerce` still ends at unpaid purchase intent. Recipe pins stay `skillsPin` `2c57e275bbb57421d08c4a270ba6ab5237ff2ec8` and `merchantPin` `4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1`.

## Runtime and installer

Node is `/home/ubuntu/.nvm/versions/node/v22.23.3/bin/node`, version `v22.23.3`.

`hermes` was not on `PATH`. System Python is 3.12.3. The pinned Hermes core dependencies are marked `python_version >= '3.14'`, so a wheel install on 3.12 cannot supply them. `uv pip install` of `hermes-agent @ git+https://github.com/NousResearch/hermes-agent.git@1fd18277267152893a8a24792b79213e7ca3f899` exited 1 with `RuntimeError: Building wheels or sdists for hermes-agent is not supported`.

The supported route used here is that commit's `setup-hermes.sh` and `pm.cli install`. The local checkout of the installer was run as `--runtime-only` with the test-extra argument removed, so the runtime closure installed and the full test extra set did not. Setup exited 0. The launcher Python is the pinned store interpreter `Python 3.14.7` at `/tmp/hermes-user-211988/.hermes/tools/python-3.14.7+20260901-linux-x64/bin/python3`. `HERMES_HOME` was `/tmp/hermes-user-211988/.hermes`, a fresh task-owned directory, not `~/.hermes`.

Install command, after the product head was on GitHub:

```
HERMES_HOME=/tmp/hermes-user-211988/.hermes \
  /tmp/hermes-agent-1fd1827/.hermes/bin/hermes skills install \
  https://raw.githubusercontent.com/epistemedeus/x402-data-gateway-skills/68592000b6a9ba563c3302a3599aa9afe13752b7/skills/samedaydesk-task-result/SKILL.md \
  --yes --force
```

Exit 0. Scanner `skills-guard-v10`, fresh verdict `SAFE`, bundle hash `sha256:586c883a307b1f2baa8ce3a38a531e1b924cac8adfcdbcb931bc9b9098bbcfc0`. Installed files: `SKILL.md`, `references/LICENSE.txt`, `references/caller-pin.json`, `scripts/task-result.mjs`.

Installed bytes match the product tree:

| File | SHA256 | Bytes |
| --- | --- | --- |
| `SKILL.md` | `83fd65e53ffd93c45e7915afa0fd7e271ce226cb2a63e6d17e32b644bad66254` | 3696 |
| `scripts/task-result.mjs` | `40d8741812792e813def3b36a827bc4dc252cb27bf2e5dd9440b94286059d254` | 33598 |
| `references/caller-pin.json` | `7e6adbccf8436c90e23e3ee2338cbac093c33968628e5c5cae5c7d697abb13b7` | 3642 |
| `references/LICENSE.txt` | `044d7291c37a2ead106ea4b4c26f713e63b7834637ed634da640f74e8cbe4625` | 1071 |

The script imports only Node built-ins. It does not import `x402MCPClient`, `callToolWithPayment`, or `cold-consumer`, and it does not set `shell: true`. The pin loads from `references/caller-pin.json` beside the installed script. Direct data route is `@modelcontextprotocol/sdk@1.30.0`. `@x402/mcp@2.16.0` is the optional projection and is not the archive.

This installer run and the Node invocations are deterministic. They do not select or prove a native model. Effort is unknown. `chargedCents` was not recorded.

## Commands, exits, and counts

Skill suite, from `/tmp/skills-211988`, after product head:

```
node --test --test-concurrency=1 tests/*.test.mjs
```

Exit 0. `tests 82`, `pass 80`, `fail 0`, `skipped 2`, `duration_ms 19550.533065`.

The two skips are the existing optional cases: pinned Hermes producer checkout not configured, and exact merchant source replay not supplied.

The new file alone:

```
node --test --test-concurrency=1 tests/samedaydesk-task-result.test.mjs
```

Exit 0. `tests 10`, `pass 10`, `fail 0`, `duration_ms 7008.193336`.

Recipe suite against merchant checkout `/tmp/merchant-pin-4910f83` at `4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1`. `npm ci --ignore-scripts --no-audit --no-fund` there exited 0 and added 241 packages, including `viem` 2.55.11.

```
S88_MERCHANT_SOURCE_DIR=/tmp/merchant-pin-4910f83 node tests/recipes/run.mjs
```

First run exited 1. `tests 24`, `pass 22`, `fail 2`. Both failures were `ERR_MODULE_NOT_FOUND` for `viem` imported by `tests/recipes/cases/settlement-proof.test.mjs` and `tests/recipes/cases/transaction-receipt.test.mjs`. Node 22 ESM does not resolve `NODE_PATH`, which is what `tests/recipes/run.mjs` sets. No recipe assertion was weakened.

Second run, with an untracked symlink from the skills `node_modules` to the merchant `node_modules`, exited 0. `tests 26`, `pass 26`, `fail 0`, `duration_ms 1806.497591`. The symlink was not committed.

## Installed-source input and output

Invoked the Hermes-installed script with Node 22.23.3.

Absent caller:

```
node scripts/task-result.mjs recover --caller /tmp/no-such-caller-211988 \
  --action start --operation /tmp/no-op-211988.json \
  --checkpoint /tmp/no-cp-211988.json --grant /tmp/no-grant-211988.json
```

Exit 0.

```json
{"usefulness":"unknown","paymentCreated":false,"outcome":"missing_input","nextAction":"Pass --caller with the directory acquire wrote. This command does not create a caller or load an example."}
```

Caller-owned result, exact bytes `{"structuredContent":{"count":0,"note":null},"isError":false,"content":[]}`:

```
node scripts/task-result.mjs retain --result RESULT.json --out COPY.json
```

Exit 0. Outcome `retained`, `isError` false, `retainedBytesMatch` true, `bytes` 74, sha256 `e6a55f98710aff3f0c0fb8e91272b4f1843a147777393a2430fcdff7496d6f04`. The copy matches the input bytes, so `count` 0, `note` null, and the absent `missing` key stay absent. A sentinel environment value was not present in stdout.

No-command invocation exits 0 with `missing_input` and does not run a bundled example. `--pay` exits 2 with `payment_refused` and creates no payment.

## Loopback consumer and direct comparison

The new tests acquire the pinned 0.1.1 archive from a sibling fixture, then from `https://neomorphic.io` with no `--public-root`. Live acquire outcome is `acquired`, `receiving` `hosted_descriptor`, `hostedAcceptance` false, archive sha256 `693652564f9cd587e4c269ff4da4653c19b1c68f42c3debe5241f34f42bf9de3`, 32421 bytes. That is hosted byte acquisition, not a customer or adoption result. `0.1.0` remains 24149 bytes, sha256 `3c134598697aadb038a98bfee4ad6e82472df34d3fa325e19507a33ed5dc974b`. Provenance remains 1552 bytes, sha256 `fdcc880b190848385156b92625d0b93f12959d21317654e63a13646ef6e68dca`.

`--install yes` runs `npm ci --ignore-scripts --no-audit --no-fund` inside the extracted caller. The installed SDK is 1.30.0 and the locked `@x402/mcp` is 2.16.0. The skill does not call the projection. `registryPackageClaim` and `packageNameInstalledFromRegistry` stay false.

Recovery uses the acquired package's `startPaidMcpResult` / `resumePaidMcpResult` and the SDK 1.30 client against a sibling MCP server built from that same package. No facilitator verify or settle call is made. The supplied result keeps `structuredContent.count` 0, `structuredContent.note` null, `isError` false, and `_meta["samedaydesk/recovery"].version` 1. Usefulness stays `unknown`. `paymentCreated` and `newPaymentPermitted` stay false.

The same operation through the acquired `bin/recover-mcp.mjs` prints `output.count` 0 and `output.note` null, with no top-level `_meta`, and the same `resultDigest`. A sibling process importing `startPaidMcpResult` from the acquired tree matches the skill's `structuredContent`, `isError`, and `resultDigest`. The CLI projection is not the archive. The skill keeps the checkpoint result.

## Refusals and retained failures

Passing controls, all from the new test file:

- Redirect, cross-origin archive URL, truncated archive, tampered archive, and the 0.1.0 archive are refused before extraction. Exit 2. Outcomes `redirect_refused`, `cross_origin_refused`, `truncated_archive`, `tampered_archive`, `source_disagreement`.
- Ustar link and `../` member names are refused before a file is written.
- An existing output is left in place (`overwrite_refused`, exit 2).
- Expired grant exits 3, `handle_rejected`, `failure` `grant_expired`, and `toolCalls` is empty.
- A different `grantId` exits 3, `failure` `grant_grantId_changed`, with no tool call.
- A mismatched remote digest stays `unresolved` and unpaid. Resume calls only `recover_paid_result`.
- A pending `isError` result stays `recovery_pending` on start and resume.
- MCP feedback separates `caller_asserted_acceptance`, `tool_refusal` when `isError` is true, and `transport_failure` when the tool handler throws. The feedback token is not printed.
- HTTP without `--send yes` is `feedback_not_sent` and posts nothing. `--send yes` to `http://127.0.0.1` is `untrusted_origin`, `posted` false, and the fixture records no hit.

The recipe `viem` load failure above is retained as an environment fact of Node 22 ESM. It is not a change to recipe source, pins, or assertions. The optional skill-suite skips are the pre-existing ones.

## Root integration and publication

1. Fetch `codex/portable-task-result-211988`. Product head is `68592000b6a9ba563c3302a3599aa9afe13752b7`, tree `04bf5181ab12f233bd2df2b71807187a6b97285d`, base `de1cc34def701f0c9266120fe592bfd51d747407`.
2. Keep `samedaydesk-machine-commerce` as unpaid discovery and purchase intent. Do not turn it into an executor.
3. The visitor install is the Hermes URL install of this skill's `SKILL.md`, then `node scripts/task-result.mjs acquire --work DIR` from the installed copy. Add `--install yes` only when the caller dependencies should be installed from the lockfile. That is not an npm publication of `samedaydesk-caller-result`.
4. Pass caller-owned result, operation, checkpoint, and grant files. A missing file returns the next action. Do not substitute a bundled example.
5. Publication of a registry, npm package, homepage, or queue is not done here. Merge stays with Root.
