# Public board coverage 0.1.0

Task: report the listed titles on one supported public careers board, and say whether a later observation changed them. A source failure is not an empty board.

Consumer: an agent that needs Acxiom Workday or LiveRamp Ashby coverage from the existing `public-careers-board` skill. Magnite stays on that skill's own handoff and is not this recipe's fixture.

## Acquisition

CLI, from an installed copy of `skills/public-careers-board` 0.1.3:

```sh
hermes skills install epistemedeus/x402-data-gateway-skills/skills/public-careers-board --yes
node scripts/cli.mjs run --board acxiom --seed first-use.json
```

This laboratory runs the command already in the checkout. It does not run `hermes`, `npx`, or a live board fetch. `--seed` is the skill's supplied-seed control.

## Inputs and outputs

Input is `--board` plus a `public-careers-board.supplied-seed.v1` file. Output is one JSON line: `result`, `boardClaim`, `rows`, `coverage`, `emptyBoard`, `complete`, `paymentSent`, and `useful`. `useful` stays null.

## Direct alternative

Read `title` and `externalPath` or `jobUrl` from each HTTP 200 `jobPostings` or `jobs` array. A non-200 response is transport failure. That reader does not build the absolute Workday URL, does not dedupe a repeated page, and does not report `coverage.remaining`.

On the first-use fixture the title sets match. The direct reader is sufficient for the titles. The skill adds the absolute posting URL, unique-row accounting, and partial coverage.

## Fixtures

| Fixture | Expected class |
| --- | --- |
| `fixtures/first-use.json` | Acxiom complete, one unique title |
| `fixtures/repeat-no-change.json` | Same title set |
| `fixtures/repeat-changed.json` | Adds Acxiom Later Role |
| `fixtures/partial.json` | One row, `remaining` 1 |
| refusal | `--pay`, unknown board `notion`, LiveRamp with `--source workday` |
| `fixtures/recovery-failure.json` | LiveRamp HTTP 403, `source_failure`, `emptyBoard` false |
| `fixtures/recovery-complete.json` | A later explicit command, not a retry, lists LiveRamp Only Role |

## License

MIT. `skills/public-careers-board/LICENSE`. Recipe files there are Copyright 2026 SameDayDesk. The client is Copyright 2026 Neomorphic LLC.
