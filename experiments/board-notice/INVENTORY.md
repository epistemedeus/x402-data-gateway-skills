# Inventory

Tracked output is `experiments/board-notice/` only. This file lists every other
file in that directory at export. Its own bytes are the git blob.

Original n8n comparison: `evidence/n8n-route.json`, 34 commands, each exit 0.
Original direct check: 11 passed, 0 failed, 7826 ms, in
`evidence/direct-journey.json`. Amendment direct check: 15 passed, 0 failed,
10260 ms, in `evidence/direct-journey-amendment.json`. Amendment n8n
comparison: `evidence/n8n-route-amendment.json`, 34 commands, each exit 0,
12 cases, 0 mismatches. One LiveRamp GET: `evidence/live-baseline.json`.

| Bytes | sha256 | Path |
| ---: | --- | --- |
| 2585 | `dfca6c6b5d46f816ea02887f56815934ddd36a8e9c4c70c0243a074cb3b56417` | `ECOSYSTEM-MAP.md` |
| 1071 | `044d7291c37a2ead106ea4b4c26f713e63b7834637ed634da640f74e8cbe4625` | `LICENSE` |
| 1011 | `9085d4519441f29bce9c1c7b8e0cf7bd701f9aa351e6f69571cc1d5555b37ff1` | `NEXT.md` |
| 2115 | `f936aa7510b80e2217c061834bba07a12d96a4e34de2c2b80554b514ae18b571` | `PROVENANCE.md` |
| 4283 | `d762cc0f63b7e4f0e841540dc2890ff40c5d08a2de8b87dd6ef7a5df61c7ea01` | `RECIPE.md` |
| 4987 | `c7b3b281092be492f18b2db62944a62e0e5f6155d061ea1b81eeab0068e44b2a` | `RESULT.md` |
| 2159 | `dc7e15dd7b1587af062e3dfa7eeb959e2a2cf5a213f389c7f64293fd8fbdaf90` | `bin/journey.mjs` |
| 2843 | `ef1737b0ddad2855f920333142ce73b27208c1202e0242ff6a890ad82cb184df` | `bin/loopback-runner.mjs` |
| 2310 | `273c174fcf9fc398d1efef927d2da102729e3c609cd9eed36fa560c134f3b1ba` | `evidence/direct-journey-amendment.json` |
| 1242 | `da78f2a74d166b6de28c1effda344229b7b7000ee3b5056e8b680e8cd86dcbea` | `evidence/direct-journey.json` |
| 528 | `ab64a8039d1a88f6fb0961e813f624a65d8359bfae31a082383f5c4545a73161` | `evidence/live-baseline.json` |
| 27689 | `9ddd2529be0c8c5243643c196b226fd641486b5611c9f52da08d4a10685363af` | `evidence/n8n-route-amendment.json` |
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
| 4363 | `5649615b26990c4a76343f4688d9e9188e02d282177c9df8e7372cd5220f434e` | `lib/state.mjs` |
| 44405 | `7444f3413f58601587e2b1c4e2980c1145c00ed4ab96bc9440d322707f4f9d8f` | `test/journey.test.mjs` |
| 3727 | `252b4a7cf2ac48db738b8ac172ff5b3447f617229a8833dec091078ac7ec21a3` | `test/live-baseline.mjs` |
| 26278 | `635847ea7d50672566f0e9a6b9df49e4e6a2408c0ef64937c01d401dbfb68069` | `test/n8n-route.mjs` |
| 2260 | `06a31956da0f619614742b90943d0cd5c915d5b27f82774a59a9b224e6852bd0` | `workflow/board-notice.inactive.n8n.json` |

Skill and plugin trees are not in this inventory because they are unchanged
inputs. `git diff --exit-code -- skills/public-careers-board plugins/public-careers-board`
exited 0 after the amendment checks.
