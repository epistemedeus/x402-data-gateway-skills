# Reuse decision

The maintained reader already classifies Acxiom, LiveRamp, and Magnite.
The missing piece is a caller-owned baseline, one notice, a quiet repeat, and
a restart, with an honest delivery result. No second board parser was added.

| Option | Source and acquisition | License | Seam | Decision |
| --- | --- | --- | --- | --- |
| public-careers-board 0.1.3 | this repo, `skills/public-careers-board`, recipe revision `7d01bfb09c530430933dec1f07c5c0b8517cffa8` | MIT. Recipe copyright SameDayDesk. CLI copyright Neomorphic LLC. | `node scripts/cli.mjs run --board [--seed]` | Used unchanged as the only reader. Omitting `--seed` is its live fetch. |
| n8n 2.44.0 | `npm install n8n@2.44.0`. Engines: Node `>=24`. Installed copy under `/tmp/h98310-tools/n8n-app`. | Sustainable Use License v1.0. The npm field is `SEE LICENSE IN LICENSE.md`. | Inactive workflow, Webhook to HTTP Request to the loopback runner. | Selected as the optional caller. Not the seen-set. |
| Node-RED 4.1.0 | `node-red` on npm. Not installed. | Apache-2.0, from its package.json. | A second runtime around the same CLI. | Not selected. It would repeat the n8n proof. |
| Apprise 1.9.4 | notification library. Not installed. | BSD-2-Clause, copyright 2025 Chris Caron. | Sends a message after someone else decides it is new. | Not selected. No baseline or seen-set. |
| changedetection.io master | `https://github.com/dgtlmoon/changedetection.io` `LICENSE` fetched 2026-11-01. Not installed. | Apache-2.0, copyright Leigh Morresi and contributors. The README also points at `COMMERCIAL_LICENCE.md` for resale. | Page watcher, not this reader's seed contract. | Not selected. |
| H98210 `board_delta.py` | Pilot `bffe09a7651f79f24fea6075a011d63225e7f54e`, reference only. | Not vendored. | Supplied seen-id diff for Greenhouse, Lever, and Ashby. | Not copied. It has no durable notice. |

n8n static data is experimental. Official docs
(`getWorkflowStaticData`, page updated 2026-10-28) say it is unavailable in
test executions, the workflow must be published and called by a trigger or
webhook, and n8n saves it when the execution succeeds. That is the wrong
commit point for "store the URL only after this sink accepts it." The imported
workflow's `staticData` was null. Execute Command stays unused because n8n
disables it unless the instance turns it on.

`isolated-vm` 7.0.2 is the n8n expression engine. The first binary failed to
load under Node 24.22.2 (`undefined symbol` on the V8 allocator). It was
rebuilt with that Node toolchain before import. The journey CLI itself stays
on Node 22.
