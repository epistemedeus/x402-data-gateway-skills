# Inventory

Tracked output is `experiments/board-notice/` only. This file lists every other
file in that directory at export. Its own bytes are the git blob.

Original n8n comparison: `evidence/n8n-route.json`, 34 commands, each exit 0.
Original direct check: 11 passed, 0 failed, 7826 ms, in
`evidence/direct-journey.json`. Amendment direct check: 15 passed, 0 failed,
10260 ms, in `evidence/direct-journey-amendment.json`. Amendment n8n
comparison: `evidence/n8n-route-amendment.json`, 34 commands, each exit 0.
Lock correction direct check: 16 passed, 0 failed, 10198 ms, in
`evidence/direct-journey-lock.json`. Lock correction n8n comparison:
`evidence/n8n-route-lock.json`, 12 cases, 0 mismatches, 34 commands, each
exit 0. One LiveRamp GET remains `evidence/live-baseline.json` and was not
repeated.

| Bytes | sha256 | Path |
| ---: | --- | --- |
| 2585 | `dfca6c6b5d46f816ea02887f56815934ddd36a8e9c4c70c0243a074cb3b56417` | `ECOSYSTEM-MAP.md` |
| 1071 | `044d7291c37a2ead106ea4b4c26f713e63b7834637ed634da640f74e8cbe4625` | `LICENSE` |
| 1080 | `6b33613ea0c552b72e9a788761b6b2212bca6366e6377cbe89f33264808789d7` | `NEXT.md` |
| 2302 | `e81d0838e4615f10a3dcd4f42ee196e52f79bf78d5fc331040c9ca1de92d94c3` | `PROVENANCE.md` |
| 4882 | `31d754f4ff5852db933b608313bc98a4e5ea1f9dded17133767279e8ee5e358b` | `RECIPE.md` |
| 6595 | `5a1075b4581f68b8b4e1b6491bcdb6041e29bfbb415dc633b4ad0e32e34baf5f` | `RESULT.md` |
| 2159 | `dc7e15dd7b1587af062e3dfa7eeb959e2a2cf5a213f389c7f64293fd8fbdaf90` | `bin/journey.mjs` |
| 2843 | `ef1737b0ddad2855f920333142ce73b27208c1202e0242ff6a890ad82cb184df` | `bin/loopback-runner.mjs` |
| 2310 | `273c174fcf9fc398d1efef927d2da102729e3c609cd9eed36fa560c134f3b1ba` | `evidence/direct-journey-amendment.json` |
| 2673 | `79f652c22b293ddaecbaa8f34c5fdad922150fe43b6d5ee4fc10a57dca6b8bb1` | `evidence/direct-journey-lock.json` |
| 1242 | `da78f2a74d166b6de28c1effda344229b7b7000ee3b5056e8b680e8cd86dcbea` | `evidence/direct-journey.json` |
| 528 | `ab64a8039d1a88f6fb0961e813f624a65d8359bfae31a082383f5c4545a73161` | `evidence/live-baseline.json` |
| 27689 | `9ddd2529be0c8c5243643c196b226fd641486b5611c9f52da08d4a10685363af` | `evidence/n8n-route-amendment.json` |
| 29437 | `57b210c6ff0809a6abaff9d7dcf3e150ee4c8361b0155502ecfb58b7578856db` | `evidence/n8n-route-lock.json` |
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
| 3181 | `e95318d807abf70c94e842babc65ffd79dae0f86a7b54f8efa1ce460deaf5f3f` | `lib/deliver.mjs` |
| 1344 | `1ab40fa2cf7a122fdcf7093c7b8dbf905f5ea8f650a834107c8d9246e7d6f0da` | `lib/match.mjs` |
| 1405 | `5aa1f3f96d1f22194d5c1e0893b23e898eb6d3510ed11ac34ed8be80381a1c58` | `lib/observe.mjs` |
| 10535 | `dd1c700720b0be8a38974163bcd59357f38f51c745fc8cdb1edf36ca3b065682` | `lib/run.mjs` |
| 6504 | `1ef2ca0141ac22dd65903159072af9b6ff2df41eef5f9eedb79820ffc90cd1f0` | `lib/state.mjs` |
| 52808 | `3562ee61e386e8f62b48e944a30b6ae5ab4bed1bcd681ee06d4fe6c116e30be0` | `test/journey.test.mjs` |
| 3727 | `252b4a7cf2ac48db738b8ac172ff5b3447f617229a8833dec091078ac7ec21a3` | `test/live-baseline.mjs` |
| 26278 | `5b00f27dfe0ed0d3771583bcce4e25d4094e12f0ecccb100b7dbb29ac8d72766` | `test/n8n-route.mjs` |
| 2260 | `06a31956da0f619614742b90943d0cd5c915d5b27f82774a59a9b224e6852bd0` | `workflow/board-notice.inactive.n8n.json` |

Skill and plugin trees are not in this inventory because they are unchanged
inputs. `git diff --exit-code -- skills/public-careers-board plugins/public-careers-board`
exited 0 after the lock correction.
