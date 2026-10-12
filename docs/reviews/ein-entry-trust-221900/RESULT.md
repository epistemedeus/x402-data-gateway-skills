# EIN entry trust receiving 221900

**Decision:** retain the published entry 0.1.1 and continuation 0.1.5 unchanged. The seven exposed provider objects describe partial inspection, permission metadata, and two quality-policy labels. They do not establish a consequential delivery or authority defect. Skillspector's `69 / HIGH / DO_NOT_INSTALL` remains the provider verdict; this adjudication does not override it. Investigation stops here.

## Native receipt and source

One existing VM session: `01a12f89-df97-7d03-9741-003da190e3b4`, started `2026-10-12T09:55:28.112Z`, native `codex_exec` 0.162.1, **gpt-6.1-sol / high**, provider OpenAI. Model and effort came from the session's `turn_context`, not script output. No child model, Bot, or review Chat. Role: `receivingConsumer`; Root owns provider contact and publication. This outcome is separate from Heavy221800's intake writer.

Repository: `epistemedeus/x402-data-gateway-skills`, exact base/current main `bf6148ce9f814bb757791a302f1e11258b836866`; isolated branch `codex/ein-entry-trust-receive-221900`. An anonymous registry read and independent local hashing match all five submitted members:

| Member | Bytes | SHA256 |
| --- | ---: | --- |
| `LICENSE` | 1079 | `bf4623255db76888a7b6919c4011ee054b19bb6b089491ec2106772ecc4e375b` |
| `SKILL.md` | 4511 | `3723df7ac398bbb98d210cfe7f9eacf0e3fa039e1b14a2e616e4aa6275b7d5b5` |
| `references/LICENSE.txt` | 1079 | `bf4623255db76888a7b6919c4011ee054b19bb6b089491ec2106772ecc4e375b` |
| `references/continuation-pin.json` | 8202 | `866e5a4755c3cdc70c52d6c1c84a2a896e8d89c0ad5b5b98eb388e443c8404db` |
| `scripts/continuation.mjs` | 24342 | `07dc8ee41d5a2a29beffdb426113c576e1a72a84060dd24861cb30d30fae3acc` |

The provider adds `skill-card.md`, 2106 bytes, SHA256 `9a73e47191af4b08b46236af05f561ad32eed654765462b30cea50ba3b644600`; its anonymous GET matches. Verify source fingerprint: `94f6d8dbb347ee9fa51582113b94abefef781c5d2c1a01177a1c5da61980e0f7`. Server-resolved GitHub provenance is **unavailable**; local byte equality is independently established.

Hosted descriptor: 9131 bytes, SHA256 `3734639536ee9104549592e46271148e12ed2e4c69191b858116fdbd3ad7da4f`. Hosted archive: 50590 bytes, SHA256 `e490d78753e8bb8e18aa517b882107f667f088546ace4888e5f86b86b9afb6f0`. Anonymous GETs at `09:58:06Z` match the immutable pins. Independent tar reading matches the exact 39-member path set, lengths, hashes, and modes in the source pin. Descriptor `published` remains false. No hosted bytes changed.

All 19 predecessor skill trees match the merge's first parent. This feature changes only this review directory; every skill, existing test, and human-facing page remains unchanged. Tree identities and response receipts are in [evidence.json](evidence.json).

## Current provider observations

Exact public responses are retained as [inspect-skill.json](inspect-skill.json), [inspect-version.json](inspect-version.json), and [verify.json](verify.json). These are current GET responses, not edits to Root's earlier summary or a newly requested scan.

| Response | Completed UTC on October 12 | HTTP | Body SHA256 |
| --- | --- | ---: | --- |
| Registry inspect | `09:56:51.770114` | 200 | `3525fc4dbe5a9f66434b27dc8ac0c1f4dcd08ba78afa2fb4f35ff9b4f6275f33` |
| Version 0.1.1 inspect | `09:56:53.027794` | 200 | `5aaf72782a8abea2dbea538d87f65b514c02c552d37fe9903b5e228f2d623453` |
| Supported anonymous verify | `09:56:54.601388` | 200 | `3b2605fe21c39d5c2a57d07da318a36a390a70c63facee85f2b16dd711667e01` |

Registry: owner `epistemedeus`, latest/version `0.1.1`, moderation null; downloads 46, installs/comments/stars 0, versions 1. Downloads are a provider counter, not adoption evidence.

Version security: `clean`, `hasWarnings=true`; scan clock `2026-10-12T03:03:33.537Z`. VirusTotal: `clean`, clock `03:01:58.955Z`. Verify schema `clawhub.skill.verify.v1`: `ok=true`, `decision=pass`, no reasons, security `passed=true`, verdict `benign`, confidence `medium`. AIG 0.2.2 has zero results and securityScore 100. Separately, Skillspector 2.11.2 retains score 69, severity HIGH, recommendation DO_NOT_INSTALL, seven objects, suppressed count 0. Its own scan clock is `03:02:18.780885Z`.

Coverage remains partial: five components, four fully inspected, one partial, 80%, `is_complete=false`. The script is present (611 lines); the ledger records `static_parse_limit` for `static_patterns_tool_misuse`, plus unresolved path-like references in prose/examples. Presence, parser coverage, LLM interpretation, and install recommendation are separate observations.

Version metadata says `MIT-0`; source licenses, front matter, and fetched provider card say `MIT`. No license bytes or metadata were changed.

## Findings adjudicated against this entry

| Objects | Provider location and severity | Actual behavior and adjudication |
| --- | --- | --- |
| 0–3, AE1 | `SKILL.md` 19, 27, 33, 45; HIGH; same finding ID `finding-97d872b657594e3f96151a781181f99f` and fingerprint | Four occurrences of `scripts/continuation.mjs (partial)`, not four absent scripts. The exact script is submitted. Acquisition checks descriptor/archive bytes and every member before import (`continuation.mjs` 325–378); run checks the caller tree before import (506–533). This is the sibling's coverage interpretation problem. |
| 4, LP3 | `SKILL.md` 1; MEDIUM | Explicit permissions/tool-scope metadata is absent. Node 22, anonymous pinned reads, named caller files, service origin, lanes, and refused authority are disclosed. Origin/lane checks are at 398–427, bounded regular input reads at 257–275, authority refusals at 460–462 and 590–595. No new unauthorized destination is alleged. |
| 5, SQP-3 | script 509; MEDIUM, `llm-unconfirmed` | `LANG=C` is a field in the object supplied to the imported JS client, not a process environment mutation or spawned child. The pinned CLI and journey do not reference LANG. No locale-induced incorrect result is alleged or reproduced. Reuse the sibling's conclusion that this label does not establish expanded authority; its npm-child implementation differs. |
| 6, SQP-1 | pin manifest 6; LOW, `llm-unconfirmed` | New label relative to the sibling: the archive prefix lacks activation phrases. This JSON is a byte pin, consumed as acquisition identity; `SKILL.md` names the narrow supplied-context continuation workflow. The script requires explicit acquire/run commands and caller inputs. The provider supplies no concrete broad-trigger invocation or incorrect delivery. |

The independent provider LLM calls AE1 and LP3 expected. It calls SQP-3 and SQP-1 unexpected quality issues while stating that locale does not expand authority and the skill description supplies narrow scope. Those qualifications do not erase Skillspector's recommendation. Exact issue IDs, explanations, locations, and proposed remediations remain in the unmodified verify response.

Reused investigation: [sibling RESULT at d55d906](https://github.com/epistemedeus/x402-data-gateway-skills/blob/d55d9061686e04d302a385984c80e7d9320fb29d/docs/reviews/task-result-scanner-receiving-2111019/RESULT.md). It establishes the supported anonymous `/api/v1/skills/{slug}/verify?version=...` GET, the shared coverage/permission/disclosed-operation interpretation, and no license publish option. Its CLI-help research, license research, 35 probes, and broad source scan were not repeated. This entry has no SDI acquire/install/feedback issue objects; those sibling findings were not copied onto it.

## Independently executed behavior and limits

Runtime **Node v22.14.0**. Existing selected tests, no new regression:

`node --test '--test-name-pattern=^(pin keeps|payment, claim|hosted acquire)' tests/ein-llc-activation-continuation.test.mjs`

Exit 0; **3 tests, 3 pass, 0 fail, 0 skip**, duration 1003.741928 ms. Native test output and clocks are retained in evidence.json. These establish frozen pin identity, explicit payment/signing/claim/filing refusals and lane/origin decisions before usable caller inputs, and real hosted acquisition/import with no npm install and refusal to overwrite existing output. They do not constitute a registry or native installer attempt.

Received prior evidence remains distinct: installed 95 cases, four old skips, recipes 26, continuation 76, human 16. These are user-provided completed gates, accepted and not replayed or attributed to this run. No original product red was reproduced; all seven original provider objects remain retained. No consequential new source hypothesis required a synthetic discriminating probe, edit, regression, or affected-gate rerun.

Ordinary discovery/install, actual installer refusal of **this** entry, activation, revenue, and human claim/payment/attestation/filing remain unproved here. No forced install, production claim/feedback POST, participant data, login/token copy, signing, payment, paid API, registry upload, provider contact, merge, or deployment. A sound result on these bounded checks does not change the provider verdict.

## Root-controlled follow-up and export

Ready-to-send question, **not sent**:

> For epistemedeus/ein-llc-activation-continuation 0.1.1, source fingerprint 94f6d8dbb347ee9fa51582113b94abefef781c5d2c1a01177a1c5da61980e0f7, scan checkedAt 2026-10-12T03:03:33.537Z: which result governs ordinary installation when anonymous verify says pass/benign but Skillspector says 69/HIGH/DO_NOT_INSTALL? Can you adjudicate the four repeated partial-inspection occurrences and permission/locale/pin-trigger labels against the submitted source without changing published bytes, and explain MIT-0 metadata versus the MIT source and card given the lack of a publish license option?

Export is one documentation-only feature commit and one push of the named branch after self-review; the final receiving message supplies the exact head. No release is made. Any future source correction would require a later Root-controlled version, preserving public 0.1.1/0.1.5. Native receipt is not merge, release, adoption, activation, or payment.
