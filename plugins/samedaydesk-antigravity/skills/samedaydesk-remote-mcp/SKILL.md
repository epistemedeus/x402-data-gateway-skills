---
name: samedaydesk-remote-mcp
description: Discover the existing SameDayDesk remote MCP tools and their payment boundary. Use when an Antigravity session needs the bound server inventory. Unpaid initialize and tools/list only. Do not call a tool, pay, or start a trial.
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

## Unpaid discovery

`initialize`, the initialized notification, and `tools/list` are discovery. They are not extraction, not a trial start, and not a purchase. Read tool names, descriptions, and input schemas from the live list. A cached count is not the inventory.

HTTP `POST /trial/extract` and `POST /trial/read` are separate routes. Walletless HTTP discovery does not prove a walletless MCP tool. Do not start either trial from this skill.

## Payment boundary

Do not send `tools/call`. A call can require payment on Base USDC through the live merchant challenge. This plugin has no wallet, signer, payment header, or price. Stop on a payment challenge or HTTP 402. Do not turn that challenge into a purchase.

Read payment marks from that same `tools/list` response. Do not cache the tool count or a price.

- `_meta.x402.paymentRequired: true` means that tool requires payment. Any accept entries beside it are live terms for a later authorized caller. This skill does not copy them into a call.
- `_meta.samedaydesk.paymentRequired: false` together with `charged: false` means that response marked the tool free. A free mark is not permission to call it from this skill.
- Any other shape, or a tool with no input schema, is unknown. Stop.

A GET of `https://agents.samedaydesk.com/mcp` is not `tools/list`. Do not use a GET tool count as the MCP inventory. HTTP 200 can still carry a JSON-RPC error, including `Method not found`. That is a stop, not an empty result and not a reason to call a tool.

## Errors

If initialize or tools/list fails, times out, or returns a protocol error, stop and report that boundary. Do not retry with another account, an API key, Vertex, or a payment header.

A direct MCP SDK probe of the same URL is not evidence that this Antigravity host loaded the server. Host install and list are a separate step from a model turn.
