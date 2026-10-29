# Task outcome recipes

Three versioned install and use recipes for capabilities that already exist in this repository. Each recipe has a first use, a natural repeat, a refusal, and a recovery fixture, plus a direct alternative that the check actually runs.

| Recipe | Version | Acquisition | Existing capability |
| --- | --- | --- | --- |
| `recipes/public-board-coverage` | 0.1.0 | CLI `scripts/cli.mjs` | `public-careers-board` 0.1.3 |
| `recipes/caller-result-retention` | 0.1.0 | CLI `scripts/task-result.mjs retain` | `samedaydesk-task-result` 0.1.0 |
| `recipes/free-mcp-page-read` | 0.1.0 | MCP loopback fixture | `plugins/samedaydesk-antigravity` remote MCP |

The checks do not install from a registry, fetch a live board, acquire a published archive, call `https://agents.samedaydesk.com/mcp`, or submit a marketplace listing. Fetch is limited to `127.0.0.1`.

```sh
node --test experiments/task-outcome-recipes/check.mjs
```

`INVENTORY.json` is the source-closed file list. `RESULT.md` and `NEXT.md` are the handback. Upstream skill and plugin licenses stay where they are. This directory is MIT, Copyright 2026 Neomorphic LLC, and does not relicense those files.
