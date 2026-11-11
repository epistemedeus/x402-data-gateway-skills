# H130010 result

Ordinary public acquisition of the existing careers plugin is received. The selected path is an anonymous clone, the exact checkout `10fe00777a8ff99551bc0cd80df528fb3b8608cc`, and `agy plugin install` of `plugins/public-careers-board`. Product version stays 0.1.3. No new wrapper, carrier, parser, or marketplace entry was added.

## Selected install

```sh
git -c credential.helper= clone https://github.com/epistemedeus/x402-data-gateway-skills.git
git -C x402-data-gateway-skills -c credential.helper= checkout 10fe00777a8ff99551bc0cd80df528fb3b8608cc
agy plugin install "$PWD/x402-data-gateway-skills/plugins/public-careers-board"
agy plugin list --json
```

Both the simple clone above and a separate `git fetch --depth 1 origin 10fe00777a8ff99551bc0cd80df528fb3b8608cc` resolved that commit. Each local directory install exited 0. `agy plugin list --json` returned one plugin:

| Field | Received |
| --- | --- |
| name | `public-careers-board` |
| enabled | true |
| version | `0.1.3` |
| carrier (`source`) | `claude-code` |
| skills | `public-careers-board` |

The same identity was returned when the edited working tree, whose only plugin changes are this README subsection and its test, was installed into another empty home. Skill bytes still matched the pin. The installed README matched the edited file.

## Native URL route

`agy plugin` help does not name a Git URL. It says `install <target>` supports `plugin[@marketplace]`. A non-directory token such as `--help` exits 1 with `install target must be a directory`. An `https://github.com/...` repository URL is accepted anyway. The traced command was `git clone --depth 1` of the repository. That clone's HEAD was `10fe00777a8ff99551bc0cd80df528fb3b8608cc`, which is also current `HEAD` and `refs/heads/main`. The installer then found `plugins/` and installed two plugins: `public-careers-board` (`claude-code`, 0.1.3) and `samedaydesk` (`antigravity`, 0.1.3). Installing the repository root locally did the same. That route is not this plugin alone and does not pin a commit, so it is not the selected path. The marketplace form was not used.

## Files

The pinned plugin directory has 19 files. All 19 matched the installed tree byte for byte. The install adds one generated root `plugin.json` (sha256 `fb923b3e809e3fa25979072eba36a711b8978798f0862d223f9d8ac4dca1f0f1`, 345 bytes) with name `public-careers-board`, version `0.1.3`, the Claude description, and author `Neomorphic LLC`. The original `.claude-plugin/plugin.json` remains in the installed tree. That generated file is not part of the repository. Hashes are in `evidence/file-parity.json`.

## Controls

Command controls for the installed script ran with `unshare -Urn` and did not call a careers endpoint. No model call was made.

| Case | Exit | Result |
| --- | --- | --- |
| `node <installed cli> run` | 0 | `missing_input`, runtime `22.23.4` |
| `--board notion` | 0 | `unknown_board` |
| `--board liveramp --source workday` | 0 | `wrong_source`, `source` null |
| `node` absent from `PATH` | 127 | `node: No such file or directory` |
| acquired `runtimeSupported` | 0 | `22.22.1` false, `22.22.2` true |
| empty directory install | 1 | `could not detect plugin structure` |
| missing path | 1 | `install target must be a directory` |
| regular file | 1 | `install target must be a directory` |
| unknown Git URL | 1 | `git clone` exit 128, username prompt refused |
| repository URL or repository root | 0 | two plugins, not careers alone |
| `check-sync.mjs` | 0 | 13 skill files, original install hash unchanged |
| `distribution.test.mjs` | 0 | 6 passed |

This host has Node 22.23.4 and 24.22.2. The acquired command was not launched on a Node older than 22.22.2. The version boundary is the acquired module's `runtimeSupported` predicate. A missing `node` is the process refusal.

Git ran with an empty task `HOME`, `GIT_CONFIG_NOSYSTEM=1`, `credential.helper` empty, no `insteadOf`, no auth header, and `GIT_ASKPASS=/bin/false`. The public pin fetch succeeded. The unknown URL asked for a username and stopped. The remote URL had no userinfo.

## Provenance

No official `agy` was on `PATH` or under `/usr`, `/usr/local`, `/opt`, or `/home/ubuntu/.local`. One task-owned install used `https://antigravity.google/cli/install.sh` with `--dir` pointed at the task directory.

| Item | Value |
| --- | --- |
| `agy --version` | 1.4.12 |
| platform | `linux_amd64` |
| manifest version | 1.4.12 |
| archive sha512 | `ea01c73b772187bca928852cf96235f0d846d6da5ebdac188b9ae719597465737f325540d483ee5f3f62d151029001713344972a187ddfb98cc7b97f7204b7f4` |
| archive host | `storage.googleapis.com` |
| installer sha256 | `62966c07365423bd4dc209355060744058fb30d60f5323e2d360e39de64e5042` |
| binary sha256 | `1edfb30477447825f0aaa05fd9a91d82f9adf26686f41cd4f5c70b90abe383e8` |
| binary bytes | 234144144 |

The installer verified the archive checksum before it wrote the binary. Help text is in `evidence/`. The real `/home/ubuntu/.bashrc` timestamp stayed 2026-11-01 18:41:58 UTC. `/home/ubuntu/.gemini` and `/home/ubuntu/.local/bin/agy` were absent before and after. Canonical `skills/public-careers-board/`, the other plugin, and any root marketplace file were not edited. H125's model turn and H129's capture repair were not repeated. Outside adoption is unknown.

## Product delta

`plugins/public-careers-board/README.md` gains the tested Antigravity subsection and keeps the Node and Claude examples. `distribution.test.mjs` locks that subsection. Receipt files are this directory. Stdout, exits, the git trace, and the file inventory are under `evidence/`.
