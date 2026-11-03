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

## Antigravity

Antigravity CLI 1.4.12 installs this existing directory. It does not add a second manifest, and the plugin version stays 0.1.3. Use a separate `HOME` when an existing Antigravity profile must stay unchanged. A public clone does not need a GitHub credential. The tested checkout is `10fe00777a8ff99551bc0cd80df528fb3b8608cc`.

```sh
git -c credential.helper= clone https://github.com/epistemedeus/x402-data-gateway-skills.git
git -C x402-data-gateway-skills -c credential.helper= checkout 10fe00777a8ff99551bc0cd80df528fb3b8608cc
agy plugin install "$PWD/x402-data-gateway-skills/plugins/public-careers-board"
agy plugin list --json
```

The installed plugin is enabled, version 0.1.3, carrier `claude-code`, with one skill named `public-careers-board`. Run it with the Node.js command in the examples above. Node.js >= 22.22.2 is required. A missing `node` does not read a board.

`agy plugin install https://github.com/epistemedeus/x402-data-gateway-skills` is a different command. On 1.4.12 it clones the default branch with `git clone --depth 1` and installs every directory under `plugins/`. That does not pin the checkout above, and it is not this plugin alone. Installing the repository root does the same. An empty directory, a missing path, a regular file, and an unknown Git URL are refused.

## Support

Source and questions: https://github.com/epistemedeus/x402-data-gateway-skills

The plugin path is `plugins/public-careers-board`. License: MIT. Recipe files are copyright SameDayDesk. The client is copyright Neomorphic LLC.
