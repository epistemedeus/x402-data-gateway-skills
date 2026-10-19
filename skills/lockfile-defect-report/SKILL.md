---
name: lockfile-defect-report
description: Prepare a no-Git N-BTY-003 report from the caller's own npm package-lock v2 or v3 pair and an explicit expected pin-delta. Use when the caller wants the current Neomorphic offer compared with the maintained n-bty-003 kit command, node n-bty-003-kit-0.1.0/engine/bin/lockfile-delta.mjs. Missing caller files stay missing. A keyword is not a known issue. The command does not submit, award, or pay.
license: MIT
compatibility: Requires Node.js 22 or newer, tar, and curl-free HTTPS fetch. Public reads are anonymous GETs of the pinned offer and kit. No Git clone, npm install, signup, or wallet.
metadata:
  author: neomorphic
  version: "0.1.0"
  hermes:
    tags: [n-bty-003, lockfile, no-spend]
  openclaw:
    requires:
      bins:
        - node
        - tar
---

# Lockfile defect report

Install the pinned kit, then prepare a report for one caller-owned lockfile pair. The executable is `scripts/report.mjs`. Identity constants are `references/pins.json`. This file's license is `LICENSE`.

The original offer is one 0.10 USDC award, manual and not escrowed. Copy `reward`, `inScope`, `outOfScope`, and `boundary` from the fetched offer. If those terms or the offer, kit, and pin identities disagree, the report says `refresh_or_unknown`. Do not rewrite either side into the other and do not treat the pin text as the current offer.

`acquire` and `report` are separate. Neither one submits a GitHub issue, selects a winner, or pays. `--submit`, `--award`, `--pay`, `--settle`, `--sign`, `--wallet`, and `--claim` stop before any request. The kit command `reproduce.mjs` on `fixtures/owner-fixture.json` is the publisher's demonstration. It is not the caller's pair and not a paid claim. A labeled QA pair is not customer revenue.

## Install

`node scripts/report.mjs acquire --work DIR`

`DIR` must be a new directory. The command GETs `https://neomorphic.io/api/trials/n-bty-003.json` and, only when that offer matches the pin, downloads the pinned archive and `SHA256SUMS`. It checks the hash, byte length, and member count, then extracts. It does not run the owner fixture. A mismatch writes `install.json` and does not download an unpinned URL.

## Report

The caller supplies both lockfiles and the expected pin-delta. The expected JSON has `status`, `counts` (`beforePins`, `afterPins`, `added`, `removed`, `changed`, `unchanged`, `missingIntegrity`), and arrays `added`, `removed`, and `changed`. A missing path, a missing expected file, or a missing offer stays missing.

`node scripts/report.mjs report --kit DIR/n-bty-003-kit-0.1.0 --archive DIR/n-bty-003-kit-0.1.0.tar.gz --before before.json --after after.json --expected expected.json --out OUT`

The maintained engine command, from a directory that contains the extracted kit and the pair, is:

`node n-bty-003-kit-0.1.0/engine/bin/lockfile-delta.mjs --before before.json --after after.json --out-dir result`

The report command runs that same `engine/bin/lockfile-delta.mjs` with `--before`, `--after`, and `--out-dir`. `OUT/report.json` keeps the offer, the input hashes, the argv, the exit, and the `pin-delta.json` digest. `purchaseAuthority` on a usable artifact is false.

Exit 0 is a prepared report: the projection matches the caller, the difference matches a documented limit of the pinned engine, an unexplained difference remains, or the engine returned a known input refusal. Exit 2 is a missing or refused input. Exit 3 is an identity or terms disagreement. Offer preflight notes are advisory. `knownIssue` is set only when the artifact and the lockfile entries match that issue's behavior. A title or note that names an issue does not.

When the report's identity status is `refresh_or_unknown`, stop using the pinned limit text as a current description. Filing the envelope and any maintainer decision stay with the caller.
