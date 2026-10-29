# Caller result retention 0.1.0

Task: keep an already delivered MCP tool result, then keep a second task's result without replacing the first. A tool error is not a successful keep.

Consumer: an agent that already holds CallToolResult JSON and uses `samedaydesk-task-result` 0.1.0.

## Acquisition

CLI retain. The documented install is:

```sh
npx skills add epistemedeus/x402-data-gateway-skills --skill samedaydesk-task-result --yes
node scripts/task-result.mjs retain --result first-use.json --out copy.json
```

This laboratory does not run `npx` and does not acquire `samedaydesk-caller-result` 0.1.1. That acquire is a public GET plus an npm install of `@modelcontextprotocol/sdk` 1.30.0. The source-closed use is `retain`. SDK recovery stays at the missing-caller next action.

## Inputs and outputs

Input is the caller-owned result file and a new `--out` path. Output is `outcome` `retained` or `tool_refusal`, `sha256`, `retainedBytesMatch`, `isError`, `usefulness` `unknown`, and `paymentCreated` false.

## Direct alternative

Copy the file. The copy matches the retained bytes and does not classify `isError`, refuse a second write, or stop a payment flag.

## Fixtures

| Fixture | Expected class |
| --- | --- |
| `fixtures/first-use.json` | `retained`, bytes match the direct copy |
| `fixtures/repeat.json` | Second file retained, first file unchanged |
| `fixtures/tool-error.json` | `tool_refusal`, bytes still kept |
| refusal | `--pay` is `payment_refused` before a request. A second retain to the same `--out` is `overwrite_refused` and leaves the first bytes in place |
| recovery | A missing result returns `missing_input` and does not load an example. `recover` with an absent caller returns `missing_input` and does not create a caller |

## License

MIT. `skills/samedaydesk-task-result/LICENSE` and `skills/samedaydesk-task-result/references/LICENSE.txt`. Copyright 2026 Neomorphic LLC. The caller archive, when acquired, carries its own MIT license.
