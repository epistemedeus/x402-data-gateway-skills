# CHECKS

Tested source `2fde6b38f534777132cddd7975b601d43fa53e03` / tree `6b417406b448740086693e31733c4effe2ce35d8`. Node v22.23.4. All test invocations serial; no model children.

Commands (owning checkout unless noted):

```bash
env NODE_OPTIONS=--max-old-space-size=512 UV_THREADPOOL_SIZE=1 OMP_NUM_THREADS=1 npm ci --ignore-scripts --no-audit --no-fund
# exit 0; same command at each frozen merchant checkout also exits 0.
env NODE_OPTIONS=--max-old-space-size=512 UV_THREADPOOL_SIZE=1 OMP_NUM_THREADS=1 node --test --test-concurrency=1 tests/*.test.mjs
# original baseline exit 1
env NODE_OPTIONS=--max-old-space-size=512 UV_THREADPOOL_SIZE=1 OMP_NUM_THREADS=1 node tests/recipes/run.mjs
# original recipe attempt exit 1: old source prerequisite missing
env PATH=/home/ubuntu/.nvm/versions/node/v22.23.4/bin:$PATH NODE_OPTIONS=--max-old-space-size=512 UV_THREADPOOL_SIZE=1 OMP_NUM_THREADS=1 node --test --test-concurrency=1 tests/*.test.mjs
# equipped baseline exit 0
env PATH=/home/ubuntu/.nvm/versions/node/v22.23.4/bin:$PATH NODE_OPTIONS=--max-old-space-size=512 UV_THREADPOOL_SIZE=1 OMP_NUM_THREADS=1 S88_MERCHANT_SOURCE_DIR=/home/ubuntu/ae14-work/root9814-merchant-recipes-4910f83b node tests/recipes/run.mjs
# equipped baseline and final exit 0
env NODE_OPTIONS=--max-old-space-size=512 UV_THREADPOOL_SIZE=1 OMP_NUM_THREADS=1 FIRST_USE_MERCHANT_SOURCE_DIR=/home/ubuntu/ae14-work/root9814-merchant-source-65176654 node --test --test-concurrency=1 tests/walletless-first-use.test.mjs
# focused replay exit 0
env PATH=/home/ubuntu/.nvm/versions/node/v22.23.4/bin:$PATH NODE_OPTIONS=--max-old-space-size=512 UV_THREADPOOL_SIZE=1 OMP_NUM_THREADS=1 FIRST_USE_MERCHANT_SOURCE_DIR=/home/ubuntu/ae14-work/root9814-merchant-source-65176654 EXTRACT_MERCHANT_SOURCE_DIR=/home/ubuntu/ae14-work/root9814-merchant-recipes-4910f83b node --test --test-concurrency=1 tests/*.test.mjs
# final exit 0; both optional source replays execute
env PATH=/home/ubuntu/.nvm/versions/node/v22.23.4/bin:$PATH NODE_OPTIONS=--max-old-space-size=512 UV_THREADPOOL_SIZE=1 OMP_NUM_THREADS=1 node --test --test-concurrency=1 tests/walletless-first-use.test.mjs
# absent-prerequisite control exit 0; optional replay explicitly skipped
git diff --check f96ba07c000d073dadc65d205cab34e552452bde HEAD
# exit 0
```

First failed observations, preserved before correction:

- `tests/received-useful-work-export.test.mjs:89`: executable mask `64 !== 73`; the next test rejects exported 0600/0700 modes against Git-declared 0644/0755. Restored only Git-declared modes; no content/index change.
- `tests/samedaydesk-task-result.test.mjs:182`: six cases share `install_failed`, `reason: child_spawn_failed`. Initial `process.execPath` was `/exec-daemon/node`, with no adjacent npm; use the existing complete Node22 bin directory through PATH. No unrelated runtime/source repair.
- `tests/recipes/cases/00-inventory.test.mjs:54`: `Set S88_MERCHANT_SOURCE_DIR to merchant pin 4910f83bd2be1e38667f1a3cfa23c70fcff6b0c1`; 18 recipe failures share missing source/dependency prerequisites. Received that exact separate checkout and its locked dependencies, preserving original failures.
- No focused guidance test failed. Self-review corrected the synthetic exhausted snapshot before final replay.

Final explicit skips: pinned Hermes discovery (1); EIN_LEAN_ROOT/HERMES_BIN journeys (3); separate SAMEDAYDESK_CURRENT_MERCHANT 838abb50 journeys (2). They are optional/unqualified, not invented passes.

| Observation | Exit | Counts | Retained raw artifact / SHA-256 |
| --- | --- | --- | --- |
| baseline | 1 | 112 pass / 8 fail / 7 skip | `/tmp/root9814-baseline.tap` / `d3e7415f7e2d01b2fb86a3ed514046712d22c744bac9b5ed93238dfabcdfe213` |
| equipped baseline | 0 | 120 pass / 0 fail / 7 skip | `/tmp/root9814-baseline-equipped.tap` / `f6502fcbb3a3ef3106caa943f60da656b86cc77d0f5e5edfdb0fe7ecfecdc8ec` |
| baseline recipe prerequisites absent | 1 | 6 pass / 18 fail | `/tmp/root9814-baseline-recipes.tap` / `8037647a37354347e15387f5425d796dc14efefa36590201d64c5ddf24c95387` |
| equipped baseline recipes | 0 | 26 pass | `/tmp/root9814-baseline-recipes-equipped.tap` / `d40829e5b2f46d7ee8f851f7bbe7d0411417b31b54c4ed03055b37c0332d1906` |
| focused current replay | 0 | 14 pass | `/tmp/root9814-focused-first.tap` / `3e30ef37a437ff1c5b8d67150753c4e5d7b9aba846fb50370849df6c64be32c7` |
| final owning suite | 0 | 135 pass / 0 fail / 6 skip | `/tmp/root9814-final.tap` / `21b2e3eb95e69b455a5211defa432b3a5a2922c6b9ca8d675cae83d9ea0fbf9e` |
| final recipes | 0 | 26 pass | `/tmp/root9814-final-recipes.tap` / `abf1cef69e9cccb892dc929e6cea3af128c5da5d46fc48228cc1530fa5322b86` |
| current replay prerequisite absent | 0 | 13 pass / 0 fail / 1 skip | `/tmp/root9814-optional-absent.tap` / `6836d6890cc9144e220e03435b4ab948547f5b01268a08012d20ef61bb8d532a` |
