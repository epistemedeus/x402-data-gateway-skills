# Public careers board

Version 0.1.3 fetches current public job openings from one supported company careers board. The local command is `skills/public-careers-board/scripts/cli.mjs` inside this plugin. It reports title, location, job URL, source, and coverage. It does not use a wallet, signup, API key, or payment, and it does not call `GET /data/careers-board`.

The original `skills/public-careers-board/` path in this repository remains the direct install. A directory install contains this plugin folder only. From the repository root, the synchronization check compares the packaged skill with that original and fails on silent drift:

```sh
node plugins/public-careers-board/check-sync.mjs
```

## Runtime

Node.js >= 22.22.2. The script resolves pins and sources from the skill directory that contains `scripts/cli.mjs`, not from the current working directory. One deadline defaults to 15000 ms and must be 100 through 30000. One response budget defaults to 1000000 bytes and must be 1024 through 1048576. Pass `--timeout-ms 30000` for Magnite when its published crawl delay plus the board read must fit. Exclusive file creation and the private recipe snapshot use the Linux `/proc/self/fd` directory-descriptor route and are refused where that route is unavailable. A missing, unknown, or wrong board does not need that route.

Chat, Cowork, and Claude Code load this skill. Claude Code and Cowork substitute `${CLAUDE_SKILL_DIR}` with the skill directory. Chat copies the skill folder into its code-execution sandbox, where the script path is `scripts/cli.mjs` relative to that folder. Run the command only where Node.js >= 22.22.2 is available. A loaded skill is not a completed board read. There is no connector to configure.

## Boards

Choose one board. Aliases are exact.

- Acxiom Workday: `acxiom`, `acxiomllc`. Public board: `https://acxiomllc.wd5.myworkdayjobs.com/en-US/AcxiomUSA`.
- LiveRamp Ashby: `liveramp`, `liveramp-inc`, `liverampashby`, `liveramp-ashby`. Public board: `https://jobs.ashbyhq.com/liveramp-inc`.
- Magnite Workday: `magnite`, `magnite-careers`. Public board: `https://osv-rubicon.wd5.myworkdayjobs.com/MagniteCareers`, after `https://www.magnite.com/careers/` confirms that handoff.

No other origin is fetched. Redirects are not followed. The command does not choose a role and does not make an employment decision.

## Examples

Fetch the LiveRamp Ashby board. Replace the plugin path with the installed plugin root, or use `${CLAUDE_SKILL_DIR}` when Claude Code or Cowork loads the skill:

```sh
node /path/to/public-careers-board/skills/public-careers-board/scripts/cli.mjs run --board liveramp
```

Read Magnite with the longer deadline its crawl delay needs:

```sh
node /path/to/public-careers-board/skills/public-careers-board/scripts/cli.mjs run --board magnite --timeout-ms 30000
```

Write one result line only when that destination does not already exist:

```sh
node /path/to/public-careers-board/skills/public-careers-board/scripts/cli.mjs run --board acxiom --out /tmp/acxiom-board.json
```

## Support

Source and questions: https://github.com/epistemedeus/x402-data-gateway-skills

The plugin path is `plugins/public-careers-board`. License: MIT. Recipe files are copyright SameDayDesk. The client is copyright Neomorphic LLC.
