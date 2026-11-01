# Provenance

Product base `ed5a07932be44dd8a8945a313652cc848716523f` on
`codex/h98310-board-notice-journey-20261101`. Assignment
`overview/remote-worker/assignments/H98310-REUSABLE-BOARD-NOTICE-20261101.md`
at Pilot `c4fc4f9815082c65213cfcd88e7089e8219a1385`, blob
`352bb687f5a4a57673d0221ef8c623b586a78dd8`.

The reader, plugin, and pins were not edited. Checked pins:

- recipe revision `7d01bfb09c530430933dec1f07c5c0b8517cffa8`
- `recipe/boards.mjs` sha256 `d062c790660979b38a6ca4fa2bb85850cd710d06bca83ac4a029a5a32f8a3308`
- source pin parent `1fb31ed2814e84d5678f88278e6b9262110cdbab`
- `sources/magnite.mjs` sha256 `689af2d5da1c38b03adb0d68829583b3f2d3537edc8296e289c79201901fcc26`

This experiment is MIT, copyright 2026 Neomorphic LLC. See `LICENSE`.

Runtime that was actually started:

- Journey and direct route: Node v22.23.4, `node --test --test-concurrency=1`.
- State exclusion: `/usr/bin/flock` from util-linux (package `util-linux`,
  advisory `flock(2)` on the local state lock file). No added npm dependency.
  Not an NFS or distributed lock.
- n8n: 2.44.0 on Node v24.22.2 from the official linux-x64 tarball
  sha256 `48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75`.
- SQLite file inside the disposable `N8N_USER_FOLDER`. After the cases it was
  2461696 bytes. The folder was removed at the end of the script.
- Owner and encryption key were process environment only. They are not in git.
- Webhook path `h98310-board-notice` on `127.0.0.1:18771`. Broker `127.0.0.1:18772`.
- The comparison script resolves this repo from its own path. `H98310_NODE24`
  and `H98310_N8N` override the Node 24 binary and the n8n bin.
- Original comparison: no public careers GET. H98210's six Greenhouse, Lever,
  and Ashby reads were not repeated. The changedetection `LICENSE` and the
  n8n static-data doc were read for the reuse decision.
- Amendment: one credential-free LiveRamp Ashby GET (`fetchAshby`, one
  request) at 2026-11-01T02:18:30Z, projected in `evidence/live-baseline.json`.
  The direct and n8n amendment suites added no further public reads.

Seeds are local `public-careers-board.supplied-seed.v1` fixtures. Magnite's
fixture includes a shell token so the test can assert the journey output does
not echo it. The token is not a credential for a live host.
