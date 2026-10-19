---
name: lockfile-defect-report
description: Execute the maintained lockfile delta tool on the caller's own npm package-lock v2 or v3 pair, compare expected behavior with actual output, and prepare a faithful N-BTY-003 report or stopping point without Git. Use for lockfile pin differences, including URL-only changes and documented partial or link cases. Does not submit a claim or promise an award.
license: MIT
compatibility: Requires Node.js 22 or newer, tar, and HTTPS fetch. No Git clone, npm install, signup, or wallet.
metadata:
  author: neomorphic
  version: "0.1.1"
  hermes:
    tags: [n-bty-003, lockfile, no-spend]
  openclaw:
    requires:
      bins:
        - node
        - tar
---

# Lockfile defect report

Use the caller's real before/after lockfiles and expected behavior in ordinary words. Missing files or an absent expectation stay missing. Do not substitute the kit owner's demonstration. Identity constants are in references/pins.json; the license is LICENSE.

## Acquire the current offer and pinned kit

    node scripts/report.mjs acquire --work DIR

DIR must not exist yet. Acquire reads the current offer and downloads only its matching pinned archive and SHA256SUMS. It checks bytes, hash and members before extraction and does not run the owner fixture. A source or terms mismatch is refresh_or_unknown, not an old description promoted to current truth.

The original offer is one manual, non-escrowed 0.10 USDC award. Preserve reward, inScope, outOfScope and boundary from the fetched offer. Preparing a report is not submitting or winning a claim.

## Default task path: the caller pair, no expectation schema

Run the maintained engine directly on the freshly acquired kit:

    node DIR/n-bty-003-kit-0.1.0/engine/bin/lockfile-delta.mjs --before before.json --after after.json --out-dir result

No expected-output JSON is required. Compare the caller's stated expectation with actual stdout, exit and result/pin-delta.json plus result/pin-delta.md. Retain the input provenance, command and artifact digest. A result is not observed merely because source code suggests it should happen.

Check the actual fields and documented limits before alleging a new defect. Missing integrity can remain partial while real deltas are still listed; installed link entries are excluded by the pinned engine. A known-issue match needs the actual same behavior, not a keyword. Offer preflight notes are advisory, not automatic award or rejection decisions.

If output agrees with the caller or matches a documented limit, return a concise useful stopping point. Otherwise retain the smallest reproducible difference, expected behavior and actual artifact for the caller. The caller decides whether to submit; this skill does not submit, award or pay. Owner QA is not outside adoption or customer revenue.

Use the freshly verified kit. If resuming a changed or uncertain extracted kit, reacquire it or use the identity-checking structured mode below rather than claim its labels prove the executable bytes.

## Optional structured comparison

Use this only when a machine-readable expected projection is already useful to the caller. Do not invent that extra schema merely to run the default task path.

    node scripts/report.mjs report --kit DIR/n-bty-003-kit-0.1.0 --archive DIR/n-bty-003-kit-0.1.0.tar.gz --before before.json --after after.json --expected expected.json --out OUT

Expected JSON contains status, counts (beforePins, afterPins, added, removed, changed, unchanged, missingIntegrity), and added/removed/changed arrays. This mode verifies extracted engine bytes against the archive and retains comparison/source/terms in OUT/report.json. It adds structured capture, not a claim of lower complete effort. Submission, award and payment flags are refused.

Exit 0 means a prepared report or useful known refusal, not bounty eligibility. Exit 2 is missing/refused input; exit 3 is source/terms disagreement. Keep stale identities unknown and do not apply old pinned limit descriptions as current facts.
