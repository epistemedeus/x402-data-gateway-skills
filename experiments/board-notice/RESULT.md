# RESULT

The original fixture run remains `evidence/direct-journey.json` and
`evidence/n8n-route.json`. A caller can name one supported board and explicit
phrases, baseline with no notice, receive one loopback notice for a new match,
stay quiet on repeat, and keep that state across a new process. That run did
not exercise a no-seed live fetch, a cut-off sink body, or two overlapping
callers. It is scoped fixture evidence, not client mail and not a commission.

The packaged careers skill, Claude plugin, and pins stayed byte-identical
(`git diff --exit-code` exit 0) after both runs.

## Original fixture measurements

| Phase | What ran | Result |
| --- | --- | --- |
| Cold setup | n8n 2.44.0 import, export, reimport, publish on a second SQLite folder | 20682 ms. Source workflow stayed `active: false`. |
| Engine | `n8n start` until the webhook was registered | 25644 ms from the start of setup. First probe count 2, status 500 on an empty job. |
| Execution | baseline, quiet repeat, rejected new match | 931 ms. Direct new-match case 224 ms. Direct baseline 112 ms. |
| Recovery | SIGKILL n8n, start again, same state file | 5451 ms. Restart probe count 1. The rejected URL was still unseen, then one accept. |
| Adaptation | acxiom phrases, then liveramp, then magnite on the direct route | 439 ms. n8n changed-board case matched the direct state. |
| Review | skill diff, 12 paired states, RSS, delivery labels | after the runs. |

Direct check then: exit 0, 11 passed, 0 failed, 7826 ms, Node v22.23.4.
n8n comparison: exit 0, 12 cases, 0 mismatches, 34 commands, all exit 0.
Peak owned RSS 1076772 KiB across 6 processes. Admission is 2097152 KiB.
That run made no public board GET.

## What the amendment tests prove

Seed is optional on the journey CLI, the observer, and the loopback runner.
The direct suite drives those commands. A controlled child records argv
(scope `controlled-child-argv`, no public GET). Omitting `--seed` leaves it
off argv, with `seeded` false and `sourceCoverage` `controlled_child`. A
present path is forwarded. A missing file, a bare `--seed`, or a following
flag is `seed_rejected`, exit 2, and does not spawn the child or write state.
The runner does the same for a job with no seed, and an empty seed is HTTP
400 `job_shape`.

One credential-free LiveRamp Ashby GET then used the unchanged reader.
Board `liveramp`, reader `fetchAshby`, 2026-11-01T02:18:30Z. `seeded` false,
`sourceCoverage` `live_public_https`, `requestCount` 1, outcome `baseline`
(`initial_seen_set`), 0 notices, 0 local sink posts. Stored as the projection
in `evidence/live-baseline.json`. The suite does not run that command again.

A sink that sends 200 and a partial accept JSON, then destroys the response,
returns `ambiguous` (this run: `ECONNRESET`). The URL stays pending and is
not called accepted. The next full accept commits it and POSTs a second time.
A body that never ends returns `timeout` (520 ms, under 3 s) and does not
commit. A body over 65536 bytes returns `response_limited` and does not
commit. Accepted, unknown, rejected, socket-drop, and 302 cases still match
the original labels. `exactlyOnce` and `exactlyOnceMail` stay false.

On one state file, a second caller returned `busy` / `state_busy` in 42 ms
while the first waited on the sink. It did not POST and did not change the
file. A different board on that file was also busy. The unrelated journey,
its seen URL, and its pending record remained, and the held notice was
accepted after the sink answered. A live foreign pid kept its lock. A dead
pid was recovered into a baseline. Two state files both baselined together.
The existing SIGKILL-during-sink case still recovers one later notice.

Direct amendment: exit 0, 15 passed, 0 failed, 10260 ms, Node v22.23.4.
Evidence: `evidence/direct-journey-amendment.json`.

n8n amendment: exit 0. The script's repo input was its own checkout,
`/home/ubuntu/ae14-work/h98310`. 12 cases, 0 mismatches, 34 commands, all
exit 0. Setup 20375 ms, engine ready 25339 ms, execution 811 ms, recovery
5444 ms. Peak owned RSS 1041576 KiB, 6 processes, within 2097152 KiB.
`publicGets` 0. Workflow file stayed `active: false`. Evidence:
`evidence/n8n-route-amendment.json`.

## What transfers

The CLI flags, optional seed, per-file owner, accept body, and inactive n8n
HTTP workflow transfer to another operator who uses these three boards and
brings phrases plus a loopback sink. The board list does not transfer to a
fourth ATS. A destination other than `http://127.0.0.1` does not transfer.
Loopback acceptance is not a mail contract. Accepting this source is not a
commission and not a hosted service.

## Limits

Partial or wrong-shaped reads do not baseline. The next complete read
baselines every row then present and sends nothing for those rows. Unknown,
rejected, dropped, cut-off, oversized, and 3xx answers are not delivered. A
later run can POST again. A busy caller is not queued. Root still owns real
mail, criteria, and any account.
