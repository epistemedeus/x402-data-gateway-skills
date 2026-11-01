# Inventory

Tracked output is `experiments/board-notice/` only. This file lists every other
file in that directory at export. Its own bytes are the git blob.

Commands, exits, and durations for the n8n comparison are in
`evidence/n8n-route.json` (34 commands, each `exit` 0). The direct check is
`node --test --test-concurrency=1 experiments/board-notice/test/journey.test.mjs`:
exit 0, 11 passed, 0 failed, 7826 ms. Counts from that run are in
`evidence/direct-journey.json`.

| Bytes | sha256 | Path |
| ---: | --- | --- |
| 2546 | `4f5234ff350a1060302d3eeb387b9df589d836263432a69393c1e321966b5baa` | `ECOSYSTEM-MAP.md` |
| 1071 | `044d7291c37a2ead106ea4b4c26f713e63b7834637ed634da640f74e8cbe4625` | `LICENSE` |
| 695 | `b4559c77e0de016961acccc31500a4fe8b278b754f24e219127dc3daf4210b2e` | `NEXT.md` |
| 1732 | `295ecbe2a43009a082dafb21accc9c1301d3ea7bf2fa53e65603683fcc59cf5d` | `PROVENANCE.md` |
| 2893 | `b27b5ac605091e877db4c16c7f69435fa979231ad81eb606d9558b8b742df4c3` | `RECIPE.md` |
| 2609 | `24cdf3cd77d06d9394e59068a9da6594171c25149638c319c837fc73b3891f92` | `RESULT.md` |
| 1936 | `034f9d5a2472d6ad9bb5f7e7a9ff4f0704e5ef0b1296ce09cbf5e4ba7e70a9d0` | `bin/journey.mjs` |
| 2579 | `4ea52519b1904bd1546e432b9f5cd922fbbb069a4c18858756ab7f2ddfa8eb6f` | `bin/loopback-runner.mjs` |
| 1242 | `da78f2a74d166b6de28c1effda344229b7b7000ee3b5056e8b680e8cd86dcbea` | `evidence/direct-journey.json` |
| 27607 | `5a7ecff04a760f947f257de2c9488e0cf2fcc93761f9864f2defe39adca75af0` | `evidence/n8n-route.json` |
| 1015 | `f7428c375a95889ee67ae2ada25fc7d4e6b776079c938e2c386d7beba867679d` | `fixtures/acxiom-baseline.seed.json` |
| 882 | `fb42ad607903098ac2a7887a2dc372a99bd6eae0ab9ad4f89f7c8648f2c45a7e` | `fixtures/acxiom-duplicate.seed.json` |
| 185 | `607b40e38147ba74a843299904ddb135a5a74230a8b03c4c9a72b0b344273ca8` | `fixtures/acxiom-empty.seed.json` |
| 1383 | `862049aa292674d46832b628f0f4674ab193bc6088e3740a9262ea49c074ce33` | `fixtures/acxiom-new.seed.json` |
| 1335 | `cf3ff14204acd5ef01b99b7f8c774bb5857df4b2def6cd92268c1efdd0891a4b` | `fixtures/acxiom-or-new.seed.json` |
| 478 | `f8d6f87fd2836cba6308aa33d377a1127f73277153e0c1780139464d5d0e3981` | `fixtures/acxiom-partial.seed.json` |
| 197 | `9cb426da0dad39fdf5de12abaaf5434f4e90bf3fb0ab7e972a1d68172a12b612` | `fixtures/liveramp-failure.seed.json` |
| 381 | `f9d387bb4c081325661859f3cc9fd123a56e56653fd29cced936cc9021847446` | `fixtures/liveramp-one.seed.json` |
| 161 | `2e2c9fb9a6b8aa5c71bb9f1556d312d0280b9b655709479dee3f8a0418f01363` | `fixtures/liveramp-shape.seed.json` |
| 1187 | `d48392114bd45ca6955845c4b82d96d2a75c11fb1e8e3b2388000fbe554b7c23` | `fixtures/magnite-one.seed.json` |
| 2508 | `90017924a721c32d269b858bd33dc10bec6d962ea31bb883f5bffdfeb15fd596` | `lib/deliver.mjs` |
| 1344 | `1ab40fa2cf7a122fdcf7093c7b8dbf905f5ea8f650a834107c8d9246e7d6f0da` | `lib/match.mjs` |
| 1358 | `bf2ae36328df18837435ee0178c435d32dd102e071f1e0c5098929e9b12bf294` | `lib/observe.mjs` |
| 9214 | `932bd46914dbcbebc9dfef45a6d1c65a57c9b1f51f499801cbe06c2287945f10` | `lib/run.mjs` |
| 1107 | `a63fb52a196a015d79e829dbd47c422a14f6d250dcd98de26085fed79472be7e` | `lib/state.mjs` |
| 22197 | `0803bd8b16e253dfbcc9b9b2d404c9e63cfc7a8121f414acbd54080f7faa1358` | `test/journey.test.mjs` |
| 26124 | `6259476701aadbaba9f14a057336a9256bdfc76bfbebff7ea8402784be6d9863` | `test/n8n-route.mjs` |
| 2260 | `06a31956da0f619614742b90943d0cd5c915d5b27f82774a59a9b224e6852bd0` | `workflow/board-notice.inactive.n8n.json` |

Skill and plugin trees are not in this inventory because they are unchanged
inputs. `git diff --exit-code -- skills/public-careers-board plugins/public-careers-board`
exited 0 after both checks.
