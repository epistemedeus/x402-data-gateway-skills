# Board-to-notice recipe

One caller-owned journey over the unchanged `public-careers-board` 0.1.3 CLI.
There is no default company and no default phrase list. The seen-set is a JSON
file that must sit outside the skill directory. A posting URL is stored only
after the loopback sink returns HTTP 200 and
`{"delivery":"accepted","noticeId":"<that same url>"}`.

`exactlyOnce` and `exactlyOnceMail` are always false. A rejected, unknown,
ambiguous, or 3xx response is not stored, so a later run may POST it again.
This does not deliver mail and does not promise exactly-once SMTP.

The first empty or complete observation is a baseline and sends no notice.
A later new title that matches any caller phrase sends one POST. The same feed
sends none. Source failure, a partial page, a wrong schema, and an unknown row
do not change the file. A complete snapshot after a partial one baselines
whatever is present then and does not notify those rows.

## Direct route

Start a sink on `127.0.0.1` that answers the accept body above. Then:

```bash
node experiments/board-notice/bin/journey.mjs \
  --skill skills/public-careers-board \
  --board acxiom \
  --seed experiments/board-notice/fixtures/acxiom-baseline.seed.json \
  --state /tmp/board-notice-state.json \
  --sink http://127.0.0.1:PORT/notice \
  --phrase "account executive"
```

Repeat with `--phrase` for each extra phrase (1–8). Supported board ids are
`acxiom`, `liveramp`, and `magnite`, plus the aliases already accepted by the
reader. The command prints one `board-notice.journey.v1` JSON line. Exit 2
means the arguments were refused and no state was written. Exit 0 includes a
source failure; read `outcome`.

```bash
node --test --test-concurrency=1 experiments/board-notice/test/journey.test.mjs
```

That check uses Node 22, local seeds, and a loopback sink. It does not call
the public boards.

## Optional n8n caller

`workflow/board-notice.inactive.n8n.json` is an inactive n8n 2.44.0 workflow.
It has no schedule and no Execute Command node. Import it, publish it only on
a disposable local instance, and start `bin/loopback-runner.mjs`. POST this
body to `http://127.0.0.1:N8N_PORT/webhook/h98310-board-notice`:

```json
{
  "runnerUrl": "http://127.0.0.1:RUNNER/run",
  "job": {
    "skill": "/absolute/skills/public-careers-board",
    "board": "acxiom",
    "phrases": ["account executive"],
    "seed": "/absolute/experiments/board-notice/fixtures/acxiom-baseline.seed.json",
    "state": "/absolute/outside-the-skill.json",
    "sink": "http://127.0.0.1:PORT/notice",
    "timeoutMs": 15000
  }
}
```

n8n is only the HTTP caller. Do not store the seen-set in workflow static
data. Stop n8n and the runner when the run finishes. The measured comparison
is `node experiments/board-notice/test/n8n-route.mjs`, which needs the local
Node 24 and n8n 2.44.0 layout in PROVENANCE. It is not part of the Node 22 check.
