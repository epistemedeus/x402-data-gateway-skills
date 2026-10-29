# RESULT

H64006 delivered three task-native recipes under `experiments/task-outcome-recipes/` on `codex/root64006-heavy-window-20261029`. Base `2f5c1466ddf5fb5f57b39d2045cb25afc32bba64`. Released plugin commit `41ff445d93cab50fb6e96d9f70bcffa08ad3cab7` and `plugins/samedaydesk-antigravity` were not edited. No production trial, marketplace submission, paid API call, account action, merge, or deploy was run.

## Tested comparison

`public-board-coverage` 0.1.0 drives `skills/public-careers-board/scripts/cli.mjs` with supplied seeds.

- `direct_sufficient_for_titles`: the caller-held JSON and the skill return the same Acxiom title on first use, the same title on the no-change repeat, and both titles after Acxiom Later Role appears.
- `skill_adds_absolute_url_and_coverage`: the skill emits the absolute Workday URL, counts the repeated page once (`uniqueRows` 1 against two raw direct titles), and on the partial fixture reports `boardClaim` `partial` with `remaining` 1. The direct reader leaves `emptyBoard` null and does not classify coverage.
- `direct_collapses_nothing_on_403`: both the direct reader and the skill keep the LiveRamp HTTP 403 off the empty-board class. The skill's `boardClaim` is `source_failure` and `emptyBoard` is false. The later LiveRamp listing is a second command. The failure record is unchanged. `--pay`, board `notion`, and LiveRamp `--source workday` refuse before a board read.

`caller-result-retention` 0.1.0 drives `scripts/task-result.mjs retain`.

- `direct_sufficient_for_bytes`: a file copy and `retain` both keep the 75-byte first result. The second task is a new file. The first bytes stay in place.
- `skill_required_for_tool_error_and_overwrite`: `isError` true is `tool_refusal` while the bytes are still kept. `--pay` is `payment_refused` with `paymentCreated` false. A second write to the same path is `overwrite_refused`. A missing result, and `recover` without the acquired caller, return `missing_input` and do not invent a caller or an example. `@modelcontextprotocol/sdk` 1.30.0 was not installed.

`free-mcp-page-read` 0.1.0 drives the existing loopback fixture. The documented server `https://agents.samedaydesk.com/mcp` was not called.

- `delivered_body_sufficient_for_text`: the useful fixture markdown is the whole page text. The natural repeat reads that field and sends no new call. A live GET of the page was not performed.
- `mcp_required_for_one_call_stop`: the first read sends one `tools/call`. The second call on that server is `refused`. A missing `trial_read` sends no call. HTTP 402 is `caller-authority` with `purchaseSent` false. A `task` field throws before send. A lost body stays `unknown` / `lost-response` with `retried` false. A later useful read is a new server. Operator discovery sends no `tools/call`.

None of the three is a product win over its direct baseline for the bytes or titles the caller already holds. The skill or MCP client is the piece that adds the gate: coverage class, tool-error class, overwrite and payment refusal, and one-call stop.

## Preservation and credits

`DISTRIBUTION.json` still records released commit `41ff445d93cab50fb6e96d9f70bcffa08ad3cab7` and `submissionStored` false. Root's publisher receipt paths were not opened for write.

Pilot's paid 20 noncash credits to the ECB contributor, and the allocated 20 for SwarmMemo learning, stay outside this package. They are learning costs. They are not revenue, and this job does not answer those tasks.

## Execution

Model `grok-4.7`, effort xhigh, session `fdbd5621-170e-4329-ab1c-df1669191679`. One serial parent. No child process was admitted as a model worker. The check spawns Node only to run the existing skill CLIs. Admitted host estimate 2GiB. Frozen checkpoint `2026-10-29T15:27:00Z` and `requiredUntil` `2026-10-29T15:42:00Z` were left as admitted. This result does not rewrite them.

Validation command: `node --test experiments/task-outcome-recipes/check.mjs`.

## Integration recommendation

Root should receive this directory as source-only laboratory evidence. Keep the careers skill when a caller needs failure-versus-empty coverage, absolute posting URLs, or a supported-source refusal. Keep `retain` when a tool error must not be reported as a successful keep. Keep the MCP stop rules when a second free read would spend another hop. Do not merge this into a live offer, publish a marketplace listing, or build another reader, result store, or payment ledger from it.
