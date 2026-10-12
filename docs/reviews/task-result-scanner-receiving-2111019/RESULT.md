# Task-result scanner receiving 2111019

Receiving decision for published `samedaydesk-task-result` 0.1.0. No product source change. No ClawHub resubmission, license rewrite, install override, or provider contact.

## Source

- Repository: `https://github.com/epistemedeus/x402-data-gateway-skills`
- Branch: `codex/task-result-scanner-receiving-2111019`
- Base: `612f61c651b41dba00523c5db1f80424e0a7ca68`
- Tree: `8d5fedcff7dc09c1a8819c536f6b2b0414aed794`
- Entrypoint exercised: `skills/samedaydesk-task-result/scripts/task-result.mjs` (33653 bytes, SHA256 `d1bc056d8a08d912c11803f69c5d85d82348801ed28494bc870d7c4c72b714c3`)
- `SKILL.md` 3696 bytes, SHA256 `83fd65e53ffd93c45e7915afa0fd7e271ce226cb2a63e6d17e32b644bad66254`
- `references/caller-pin.json` 3642 bytes, SHA256 `7e6adbccf8436c90e23e3ee2338cbac093c33968628e5c5cae5c7d697abb13b7`
- `LICENSE` and `references/LICENSE.txt` are the same MIT text, 1071 bytes, SHA256 `044d7291c37a2ead106ea4b4c26f713e63b7834637ed634da640f74e8cbe4625`
- Pinned caller archive remains 0.1.1, 32421 bytes, SHA256 `693652564f9cd587e4c269ff4da4653c19b1c68f42c3debe5241f34f42bf9de3`
- Skill directories on this tree: 19. No other skill directory was edited.

Anonymous inspect of slug `samedaydesk-task-result` version `0.1.0` returns those five source hashes unchanged. The provider adds `skill-card.md`, 2214 bytes, SHA256 `b8ead3eadde5c162b5977c442c165a417f1918f908cc1ed74f89c6af256d2bf6`.

## Two provider reads stay separate

Preserved Root CLI readback `00:45:11.380`:

- slug `samedaydesk-task-result`, version and latest `0.1.0`
- five source files match `612f61c6`; provider adds `skill-card.md`
- comments, downloads, installs, and stars were 0
- security status `clean`, `hasWarnings=true`
- Skillspector `suspicious`, score 59, severity `HIGH`, recommendation `DO_NOT_INSTALL`, `issueCount` 8
- independent LLM `clean` / `benign`
- that inspect payload contained scanner summaries and did not contain the eight issue descriptions

This receiving read, anonymous, on 2026-10-12:

- `GET https://clawhub.ai/api/v1/skills/samedaydesk-task-result` with CLI `inspect --version 0.1.0 --files --json` (saved SHA256 `ec2169971f2fb170d101766ee78c6e4a204d6b1e7654c6f95d4e6c98b42c86fb`)
- stats: comments 0, downloads 32, installs 0, stars 0, versions 1
- security status `clean`, `hasWarnings=true`, `checkedAt` `1791768180759` (`2026-10-12T01:23:00.759Z`)
- VirusTotal status `clean`, `checkedAt` `1791767858898` (`2026-10-12T01:17:38.898Z`)
- Skillspector summary: `suspicious`, score 83, severity `CRITICAL`, recommendation `DO_NOT_INSTALL`, `issueCount` 10, same `checkedAt` `2026-10-12T01:23:00.759Z`
- LLM summary: status `clean`, verdict `benign`, confidence `medium`
- moderation: null
- version createdAt `1791763726306` (`2026-10-12T00:08:46.306Z`)
- the inspect `skillspector` object still has no `issues` array

The download count 32 is the later provider counter. Installs remain 0. This package makes no install or adoption claim.

## Supported route for the issue text

Official CLI is npm package `clawhub` 0.23.3. `skill publish --help` options are slug, name, owner, source owner, migrate owner, version, fork, changelog, tags, categories, topics, dry-run, json, and source repo/commit/ref/path. There is no license option. A help banner can append the current directory git commit when `CLAWHUB_COMMIT` is unset; the package version is 0.23.3.

`scan download` calls `requireAuthToken`. An anonymous invocation with an empty `HOME` and no `CLAWHUB_TOKEN` exited 1 with `Error: Not logged in. Run: clawhub login`. No scan POST and no `--update` were sent.

`skill verify` is an anonymous `GET /api/v1/skills/{slug}/verify`. Both the CLI (`skill verify samedaydesk-task-result --version 0.1.0`, exit 0) and the raw GET `https://clawhub.ai/api/v1/skills/samedaydesk-task-result/verify?version=0.1.0` (HTTP 200 at `2026-10-12T01:34:13Z`, body SHA256 `1ba97cfca526b37889d72bb3cb8d97f306a54ed907c79985a39550ec62894041`) return the stored report. That report is the later score-83 scan, not a reconstruction of the 00:45 eight-issue summary. The earlier eight descriptions are not exposed by the public inspect payload, and this route does not label any subset as those eight. That branch stops there.

Verify wrapper, same `checkedAt` `2026-10-12T01:23:00.759Z`:

- schema `clawhub.skill.verify.v1`
- `ok` true, `decision` `pass`, `reasons` empty
- security status `clean`, `passed` true, verdict `benign`, confidence `medium`
- AIG `aig-skill-scan` 0.2.2: 0 results, `securityScore` 100
- Skillspector 2.11.2: score 83, severity `CRITICAL`, recommendation `DO_NOT_INSTALL`, max issue severity `HIGH`, `suppressed_count` 0, 10 issue objects
- coverage: 5 components, 4 fully inspected, 1 partial, coverage 80 percent, `is_complete` false
- partial file is `scripts/task-result.mjs` (754 lines). Ledger includes `static_parse_limit` for analyzer `static_patterns_tool_misuse` on that file.
- LLM findings text on the inspect summary calls AE1, LP3, SDI-1, SDI-2, and SQP-3 expected. The Skillspector objects below assign their own severities. Those are separate layers.

## License distinction

Immutable source `LICENSE`, `references/LICENSE.txt`, and published `skill-card.md` section `License/Terms of Use` say `MIT`. Version metadata `license` is `MIT-0`. Publish help has no license flag. Bytes were not rewritten and the skill was not republished.

## Actual findings mapped to the entrypoint

| # | Id | Severity | Location | What the provider reported | What that code does |
| --- | --- | --- | --- | --- | --- |
| 0-5 | AE1, one `finding_id` `finding-08d48473b437482092d96d6605034e29`, one fingerprint | HIGH | `SKILL.md` lines 21, 27, 33, 37, 41, 45 | `scripts/task-result.mjs (partial)`. Referenced artifact was not completely inspected. | Those lines name the entrypoint and the acquire, retain, recover, and feedback commands. The script is in the published bundle and was executed below. The partial mark matches the scanner ledger, not a missing file. |
| 6 | LP3 `finding-77469a6c5fa14c3a90ad78ace1fab059` | MEDIUM | `SKILL.md` line 1 | No tool-scope or permission declaration for network actions. | Front matter names Node, npm, and anonymous pinned GETs, and says the command does not pay, sign, or settle. Hosts and flags are in the body. |
| 7 | SDI-1 `finding-b34bd7189b964637a8390cc822fec1cb` | MEDIUM | `scripts/task-result.mjs` 361-424 | Acquire downloads an archive, extracts it, and can run `npm ci`. | `acquire()` is the published purpose. It checks the public root, refuses redirects, pins every fetched byte, extracts only the pinned members, and runs `npm ci --ignore-scripts --no-audit --no-fund` only after `--install yes`. |
| 8 | SDI-2 `finding-4be3fd6ae87d4b2588bdcbf3832386f4` | MEDIUM | `scripts/task-result.mjs` 534-710 | Recover and feedback can connect and submit a statement. | `recover()` and `feedback()` require caller-owned files. MCP connects only after `assertMcpEndpoint`. HTTP feedback returns `feedback_not_sent` unless `--send yes`. `paymentCreated` stays false. |
| 9 | SQP-3 `finding-126d27e9893b46a0b448e2b2ba978884`, tag `llm-unconfirmed` | LOW | `scripts/task-result.mjs` 414-415 | Child env sets `LANG` and `LC_ALL` to `C`. | Those two variables are part of the replaced env for the npm child. The rest of that env is `PATH` limited to Node's directory, a fresh `HOME`, `CI=true`, and `npm_config_registry` pinned to `https://registry.npmjs.org`. |

Provider remediations that would remove the script reference, add a permission framework, split or delete acquire/install/recovery/feedback, or drop the locale lines were not applied. They would hide or narrow disclosed behavior to change a score.

## Independent source probe

The probe spawned the published `scripts/task-result.mjs` with Node `v22.23.3`. Loopback listeners were owned by the probe. No production feedback write, customer task, key, wallet, signing, or payment was used. Exit 0. Cases 35. Failed 0.

| Exit | Outcome | Case |
| --- | --- | --- |
| 2 | `payment_refused` | `--pay` before any listener hit and before the work directory exists. `paymentCreated` false. |
| 2 | `public_root_rejected` | localhost, `0.0.0.0`, extra path, search, hash, userinfo, https loopback, missing port, and `[::ffff:127.0.0.1]`. No listener hit. |
| 2 | `fetch_failed` | `http://2130706433:port/` and `http://127.0.0.1.:port/` are canonicalized by the URL parser to `127.0.0.1` before the allow check, then a 404 stops extraction and the work directory is removed. |
| 2 | `fetch_failed` | Explicit `http://127.0.0.1:port/` reaches the listener and a non-200 does not extract. |
| 2 | `redirect_refused` | One 302 to `https://example.invalid/elsewhere`. One listener hit. Work directory removed. |
| 2 | `traversal_refused` | `--work` through a parent symlink. No fetch. The preexisting file in the symlink target remains. |
| 2 | `overwrite_refused` | `--work` that is a dangling symlink stays a symlink. |
| 2 | `tampered_source` | `--result` symlink is not followed and its target text is absent from stdout. |
| 2 | `input_rejected` | directory, `/dev/zero`, and FIFO results, each under 1500 ms. |
| 2 | `overwrite_refused` | existing output symlink is not written through. Target bytes stay unchanged. |
| 2 | `overwrite_refused` | existing output FIFO returns without blocking. |
| 2 | `endpoint_rejected` | MCP search, extra path, hash, userinfo, localhost, `0.0.0.0`, `file:`, and `/MCP`. Listener hits stay 0. Token absent from stdout. |
| 0 | `transport_failure` | `http://127.0.0.1/mcp` has an empty port, so the URL default is port 80. It is loopback, it is outside `endpoint_rejected`, and it did not hit the probe listener. Nothing was listening on port 80. `paymentCreated` false. 140 ms. |
| 0 | `transport_failure` | Exact `http://127.0.0.1:port/mcp` is accepted and the probe listener records the attempt. `paymentCreated` false. |
| 0 | `transport_failure` | `https://127.0.0.1:1/mcp` is outside `endpoint_rejected`. Closed loopback port 1 finishes as transport failure. 141 ms. `paymentCreated` false. |
| 0 | `transport_failure` | Replacing the installed caller `LICENSE` with a symlink does not echo the sentinel. The member is restored to SHA256 `c9e2795d29bf1008cbd36ac045bd3c77d537438a51d8dda34e158f4e82a6a27c`. `O_NOFOLLOW` refuses the follow. `ELOOP` is not a named refusal, so `mapError` uses its existing unnamed-code result. The read does not succeed. Left unchanged. |
| 0 | `acquired` | `acquire --install yes` with a parent `PATH` pointing at a fake `npm` and parent `npm_config_registry=http://127.0.0.1:9`. Fake npm did not run. SDK package is present. `npmInstall` `completed`. `registryPackageClaim` false. `paymentCreated` false. 1562 ms. |

Owning suite after that probe, from this tree:

`node --test tests/skills-validation.test.mjs tests/samedaydesk-task-result.test.mjs`

Exit 0. Tests 15. Pass 15. Fail 0. Skipped 0. `duration_ms` 7035.948318. That run uses the real script, the pinned public archive, loopback acquire `--install yes`, recovery, and feedback fixtures. The current-merchant journey was not run. Recipe and financial suites were not run.

No red product failure was produced, so no regression edit was added.

## Decision

Keep the published 0.1.0 bytes at `612f61c651b41dba00523c5db1f80424e0a7ca68`. The entrypoint's acquisition, extraction, symlink, FIFO, child, endpoint, and no-payment boundaries hold on the cases above.

The visitor warning remains a provider fact: Skillspector still says `DO_NOT_INSTALL` on the later scan (score 83, 10 issues) as it did on the 00:45 summary (score 59, 8 issues). The verify wrapper's `pass` / `benign` result and the LLM expected-notes are separate from that recommendation. The ten exposed findings are partial inspection, missing permission metadata, and the disclosed acquire, install, recovery, feedback, and locale behavior. They are not a reproduced entrypoint defect.

No resubmission. No guessed edit or license flag. No immutable license rewrite. No attempt to force registry or native install past `DO_NOT_INSTALL`. No provider contact in this package. Root can send a provider question later if a human wants the score-59 list or a reason the pass wrapper still displays `DO_NOT_INSTALL`. This receiving package does not open that contact.
