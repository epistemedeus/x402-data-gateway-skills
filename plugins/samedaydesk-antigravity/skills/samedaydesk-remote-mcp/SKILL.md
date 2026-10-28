---
name: samedaydesk-remote-mcp
description: Read one caller-supplied public URL with the live free SameDayDesk MCP tool trial_read. Send one ordinary tools/call, then inspect the structured result. Stop on missing, expired, exhausted, refused, or unknown. Do not pay, grant, or retry. Operator discovery-QA only lists tools and stops.
---

# Read one public page

This is the only skill in this plugin. The source directory is `plugins/samedaydesk-antigravity`. The machine name is `samedaydesk`. It does not install the other skills in this repository. Public install is the pinned checkout in the plugin README. This directory is not an Antigravity Marketplace listing.

Use customer task-ready when the user supplies a public URL and asks for a read. Use operator discovery-QA only as a separate measurement. Implementation tests use a synthetic local fixture and do not call production.

## Customer task-ready

The user supplies one public HTTPS URL. Read that page with the live free tool `trial_read`. One ordinary call. Then stop.

1. `initialize`, then the initialized notification, then `tools/list` on the bound server. The live `trial_read` entry is the schema. A saved count is not the inventory.
2. Continue only when that entry is free: `_meta.samedaydesk.paymentRequired` is false, `charged` is false, and there is no `_meta.x402` object. Any other shape is a refusal. Stop that tool.
3. Send one ordinary `tools/call` for `trial_read`. The required argument is the caller URL. Include `markdownLimitChars` only when the live schema lists it and the caller set it. Do not add a `task` field. Do not send any other tool.
4. Inspect the structured result: `ok`, `sourceOk`, `status`, `error`, `markdown`, `truncated`, `capture`, and `charged`.
5. Stop. Do not send a second call.

`execution.taskSupport` `forbidden` forbids optional asynchronous Task augmentation. It does not forbid this ordinary `tools/call`. A normal `tools/call` returns the tool result on that same response. A task-augmented call puts `task` on the request and returns a task id instead. MCP 2025-11-25 keeps those paths separate:

- Tasks: <https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/basic/utilities/tasks.mdx>
- Tools: <https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/server/tools.mdx>

The call draws on the original shared budget. Do not create a grant, copy a price, or fund another allowance. Free is not unlimited and not idempotent. A retry spends another hop.

| Result | Say this | Then |
| --- | --- | --- |
| `trial_read` missing, or its input schema missing | Access is missing. | Stop. Do not pay. |
| `error` or availability `expired` | Access is expired. | Stop. Do not pay or retry. |
| `error` or availability `exhausted` | The shared free budget is exhausted. | Stop. Do not pay or retry. |
| refused, `isError`, or `sourceOk: false` | Access is refused. `ok` is not source success. | Stop. Do not turn this into a paid retry. |
| empty, unreadable, or lost response | The outcome is unknown. | Do not retry. |
| `sourceOk: true`, markdown present, `charged: false` | Return that structured read. | Stop. `charged: false` is not a settlement receipt. |

Paid continuation uses the paid tool `read` and requires that authorized caller's own payment authority. This skill does not purchase, sign, or attach a payment header. Do not call `page_change`, `careers_board_cold`, `report_caller_result`, or `recover_paid_result` from this read. Do not start either trial HTTP route. `POST /trial/read` and `POST /trial/extract` are not this MCP call.

On the 2026-10-28 re-check the live `trial_read` input was required `url` (string, 1 through 2048) and optional `markdownLimitChars` (integer, 1 through 40000), with `execution.taskSupport` `forbidden`. Read the live tool again before use. That snapshot is not a permanent schema.

## Operator discovery-QA

This no-call rule applies only when the task is operator discovery-QA. It is not a ban on the customer read above.

Send `initialize`, the initialized notification, and `tools/list`. Read names, descriptions, input schemas, and payment marks. Then stop. Do not send `tools/call`. Do not POST a trial. Do not purchase.

`_meta.x402.paymentRequired: true` means paid. `_meta.samedaydesk.paymentRequired: false` together with `charged: false`, and no x402 object, means the list marked the tool free. A contradictory pair, any other payment shape, or a missing input schema is a refusal. Extra meta keys do not change the class. Do not copy accept entries or prices.

## Bound server

`mcp_config.json` declares one server:

| Field | Value |
| --- | --- |
| Server name | `samedaydesk` |
| serverUrl | `https://agents.samedaydesk.com/mcp` |
| Transport | Remote Streamable HTTP |

The config has no command, environment, OAuth client, or HTTP header. This plugin omits `X-SameDayDesk-Agent-Source`. Attribution is unqualified. Do not copy `claude-code-marketplace-v1`, `agent-plugins-v1`, `agent-skills-v1`, or `goose-native-v1` onto this client.

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

The remote tool id comes from `tools/list`. This skill does not rename it. Hiding a tool is not a shorter id. Do not add a local proxy that forwards `tools/call`.

An earlier machine name, `samedaydesk-antigravity`, made a 40-character prefix. Host qualification dropped every generated name longer than 64 characters. Twenty-two names loaded and seven were dropped. Do not call it a complete host load. That failure stays in `OBSERVED.json`. A saved id list is not the live inventory.

agy 1.4.9, signed in, listed this renamed plugin under the server heading `samedaydesk_samedaydesk`. Every remote id in that prompt was Lazy. None were Eager. The prompt did not show `mcp_samedaydesk_samedaydesk_`. The seven ids dropped by the older prefix were present. That listing is not a `tools/call`.

## Payment boundary

Stop on a payment challenge or HTTP 402. This plugin has no wallet, signer, payment header, or price. Do not turn that challenge into a purchase.

A GET of `https://agents.samedaydesk.com/mcp` is not `tools/list`. HTTP 200 can still carry a JSON-RPC error, including `Method not found`. That is a stop.

If initialize or tools/list fails, times out, or returns a protocol error, stop and report that boundary. Do not retry with another account, an API key, Vertex, or a payment header.

A direct MCP SDK probe of the same URL is not evidence that this Antigravity host loaded the server. The discovery fixture's no-call control stays in discovery mode. It is not the customer path.
