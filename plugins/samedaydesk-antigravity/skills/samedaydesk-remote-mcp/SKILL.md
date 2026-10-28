---
name: samedaydesk-remote-mcp
description: Separate operator discovery-QA from a customer task-ready reading of the live SameDayDesk MCP list. Document free, paid, and refusal. Unpaid initialize and tools/list only. Do not call a tool, pay, or start a trial.
---

# SameDayDesk remote MCP discovery

This is the only skill in this plugin. The source directory is `plugins/samedaydesk-antigravity`. The machine name is `samedaydesk`. It does not install the other skills in this repository.

## Bound server

`mcp_config.json` declares one server:

| Field | Value |
| --- | --- |
| Server name | `samedaydesk` |
| serverUrl | `https://agents.samedaydesk.com/mcp` |
| Transport | Remote Streamable HTTP |

The config has no command, environment, OAuth client, or HTTP header. The merchant allowlist used for this adapter has no Antigravity source value. This plugin omits `X-SameDayDesk-Agent-Source`. Attribution is unqualified. Do not copy `claude-code-marketplace-v1`, `agent-plugins-v1`, `agent-skills-v1`, or `goose-native-v1` onto this client.

## Host tool names

The host builds `mcp_<plugin name>_<server name>_<tool id>`. The result has to match `^[a-zA-Z0-9_-]{1,64}$`.

| Piece | Value |
| --- | --- |
| Source directory | `plugins/samedaydesk-antigravity` |
| Machine name | `samedaydesk` |
| Display name | SameDayDesk |
| Server name | `samedaydesk` |
| Prefix | `mcp_samedaydesk_samedaydesk_` (28 characters) |
| Longest remote id that fits | 36 characters |

The remote tool id comes from `tools/list`. This skill does not rename it. The plugin schema has `displayName` and no tool-id alias. Hiding a tool is not a shorter id. Do not add a local proxy that forwards `tools/call`.

An earlier machine name, `samedaydesk-antigravity`, made a 40-character prefix. Host qualification dropped every generated name longer than 64 characters. That failure stays in `OBSERVED.json`. Do not call it a complete host load. A saved id list is not the live inventory. Read `tools/list` again when the set matters.

## Operator discovery-QA

Operator discovery-QA is this package's own measurement. `initialize`, the initialized notification, and `tools/list` are that measurement. They are not extraction, not a trial start, and not a purchase. Read tool names, descriptions, input schemas, and payment marks from the live list. A cached count is not the inventory.

Stop when the list has been read and classified. The documented next action in this mode is to stop. Do not send `tools/call`.

HTTP `POST /trial/extract` and `POST /trial/read` are separate routes from MCP. The live list can also name an MCP tool `trial_read`. Those are different surfaces. Do not start either trial from this skill.

## Customer task-ready

Customer task-ready is a reading for an authorized caller. Operator discovery-QA stays on the unpaid list. This skill does not send the customer action.

Classify each live tool. Do not cache the tool count or a price. Do not copy accept entries.

- `_meta.x402.paymentRequired: true` means that tool requires payment. Paid means the caller already has payment authority. This skill does not purchase and does not copy the accept entry into a call.
- `_meta.samedaydesk.paymentRequired: false` together with `charged: false`, and no x402 object, means that response marked the tool free. A free mark is not permission to call it from this skill.
- Any other shape, a contradictory pair of those marks, or a tool with no input schema, is a refusal. Stop that tool.
- Extra meta keys do not change the class and do not authorize a call.
- `execution.taskSupport` does not authorize a call. On the 2026-10-28 re-check every listed tool had `execution.taskSupport` `forbidden`, including `trial_read`. This package does not turn that field into a host task.

When the live list still has free `trial_read`, the documented next action for an authorized caller is that live schema. The schema below is the shape measured at `2026-10-28T08:18:16.770Z`. Read the live tool again before use. This skill does not send it.

| Field | Measured shape |
| --- | --- |
| Tool | `trial_read` |
| Title | Read Public Page Under Shared Trial |
| Required input | `url`, string, length 1 through 2048 |
| Optional input | `markdownLimitChars`, integer, 1 through 40000 |
| Additional properties | false |
| Marks | `samedaydesk.paymentRequired` false, `charged` false, no x402 object |
| `execution.taskSupport` | `forbidden` |
| Annotations | `readOnlyHint` false, `destructiveHint` false, `idempotentHint` false, `openWorldHint` true |

The authorized caller inspects `ok`, `sourceOk`, `status`, `error`, `markdown`, `truncated`, `capture`, and `charged`. The measured output schema fixes `charged` to false. That claim is not a settlement receipt. `ok` is not source success. The call is not idempotent. A retry spends another hop. The merchant text on that tool says the paid page path remains `GET /read?url={encodedPublicUrl}`. `read` is the paid tool. `trial_read` is the free tool. This skill does not request the paid path.

Other free marks, including `page_change`, `careers_board_cold`, `report_caller_result`, and `recover_paid_result` on that same list, are not the page-read action. Leave them uncalled from this skill.

## Payment boundary

Do not send `tools/call`. A call can require payment on Base USDC through the live merchant challenge. This plugin has no wallet, signer, payment header, or price. Stop on a payment challenge or HTTP 402. Do not turn that challenge into a purchase. Do not turn a free refusal into a paid retry.

The discovery client in `tests/fixtures/samedaydesk-antigravity/protocol.mjs` refuses `tools/call` before send. It also refuses a URL under `/trial/read` or `/trial/extract` before send. Customer task-ready prose has no send path in that client. Skill prose is not that filter.

A GET of `https://agents.samedaydesk.com/mcp` is not `tools/list`. Do not use a GET tool count as the MCP inventory. HTTP 200 can still carry a JSON-RPC error, including `Method not found`. That is a stop, not an empty result and not a reason to call a tool.

## Errors

If initialize or tools/list fails, times out, or returns a protocol error, stop and report that boundary. Do not retry with another account, an API key, Vertex, or a payment header.

A direct MCP SDK probe of the same URL is not evidence that this Antigravity host loaded the server. Host install and list are a separate step from a model turn. The appended reader re-check is another unpaid list. It is not a host load.
