# RESULT

A cold caller can name one supported board and explicit phrases, baseline the
current feed with no notice, receive one loopback notice for a new match,
repeat without a second notice, and keep that state across a new process.
The same journey runs through the Node 22 CLI and through installed n8n 2.44.0.
n8n does not own the seen-set. `exactlyOnce` and `exactlyOnceMail` stay false.

The packaged careers skill, Claude plugin, and pins are byte-identical
(`git diff --exit-code` exit 0). No public board GET, mail, scheduler, signup,
or resident process was left behind.

## Measured effort

| Phase | What ran | Result |
| --- | --- | --- |
| Cold setup | n8n 2.44.0 import, export, reimport, publish on a second SQLite folder | 20682 ms. Source workflow stayed `active: false`. |
| Engine | `n8n start` until the webhook was registered | 25644 ms from the start of setup. First probe count 2, status 500 on an empty job. |
| Execution | baseline, quiet repeat, rejected new match | 931 ms. Direct new-match case 224 ms. Direct baseline 112 ms. |
| Recovery | SIGKILL n8n, start again, same state file | 5451 ms. Restart probe count 1. The rejected URL was still unseen, then one accept. |
| Adaptation | acxiom phrases, then liveramp, then magnite on the direct route | 439 ms. n8n changed-board case matched the direct state. |
| Review | skill diff, 12 paired states, RSS, delivery labels | after the runs. |

Direct check: `node --test --test-concurrency=1 experiments/board-notice/test/journey.test.mjs`, exit 0, 11 passed, 0 failed, 7826 ms, Node v22.23.4.
n8n comparison: `node experiments/board-notice/test/n8n-route.mjs`, exit 0, 12 cases, 0 mismatches, 34 recorded commands, all exit 0.
Peak owned RSS 1076772 KiB across 6 processes (command shell, proof, loopback runner, `n8n start` 733456 KiB, `n8n task-runner` 136524 KiB, journey CLI). Admission is 2097152 KiB.

## What transfers

The CLI flags, state file, accept body, and inactive n8n HTTP workflow transfer
to another operator who uses these three boards and brings phrases plus a
loopback sink. The board list does not transfer to a fourth ATS. A live fetch
without `--seed` is the existing reader and was not run here. A destination
other than `http://127.0.0.1` does not transfer.

## Limits

Partial or wrong-shaped reads do not baseline. The next complete read baselines
every row then present, including rows that were on the partial page, and sends
nothing for them. Unknown, rejected, dropped, and 3xx answers are not treated
as delivered. A retry can POST again. Root still owns real mail, criteria, and
any account.
