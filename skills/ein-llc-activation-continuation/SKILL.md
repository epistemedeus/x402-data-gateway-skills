---
name: ein-llc-activation-continuation
description: Acquire the public EIN.LLC activation continuation 0.1.5 archive and continue one caller-supplied business context with discover, assess, prepare, resume, status, show, or cancel. Use when the caller has explicit yes/no/unknown facts and a later process must read the same task. Missing files return the next action. The command does not claim, pay, file, or invent a company.
license: MIT
compatibility: Requires Node.js 22. No npm install. Public reads are anonymous GETs of the pinned descriptor and archive. Business operations stay on an owned loopback disposable lane.
metadata:
  author: ein.llc
  version: "0.1.0"
  hermes:
    tags: [ein-llc, activation, continuation, no-spend]
  openclaw:
    requires:
      bins:
        - node
---

# EIN.LLC activation continuation

Install this skill, then acquire the already released continuation and point it at caller-owned files. The executable is `scripts/continuation.mjs`. The byte pins are `references/continuation-pin.json`. This skill's license is `references/LICENSE.txt`. The continuation archive carries its own MIT license and the vendored `ein-formation-http-client` 0.1.1.

The descriptor field `published` remains false. That is the frozen field. Acquiring the hosted archive does not rewrite it.

## Next action

Acquire the pinned 0.1.5 archive into a new directory:

`node scripts/continuation.mjs acquire --work DIR`

`DIR` must be a new directory. The command does not run npm install and does not execute the archive examples.

Run one existing command against caller-owned files:

`node scripts/continuation.mjs run --caller DIR/ein-activation-continuation --command assess --state STATE.json --task-id TASK --customer-key-file KEY --context CONTEXT.json --base-url http://127.0.0.1:PORT --lane disposable_owner_qa`

`discover`, `assess`, `prepare`, `resume`, `status`, `show`, and `cancel` are the continuation commands. `http` is the default transport. `mcp`, `a2a`, and `a2a-rest` are selected with `--transport`. A2A catalog reads need `--catalog-transport http`.

Assess reads `ein.supplied-context.v1` from `--context`. The fields are `hasUsEntity`, `hasEin`, `providerRequiresUsEntity`, `providerRequiresEin`, `jurisdictionKnown`, and `selectedState`, each `yes`, `no`, or `unknown`. Task prose does not infer a business prerequisite. A missing file returns `missing_input` and the next action.

Prepare needs `--intended-email-file`. The claim URL stays in the mode 0600 continuation file until `show --show-claim-url`. That handoff is for the intended human. This command does not claim, pay, attest, register, or file.

A later process uses the same `--state`, `--task-id`, and `--customer-key-file`. `resume` replays the stored operation. `status` needs a human-issued `--grant-file` and `--grant-origin`. Pending status stays unpaid.

`discover` may read `https://ein.llc`. Assess, prepare, resume, status, show, and cancel stay on `http://127.0.0.1` or `http://[::1]` with `disposable_owner_qa`.

## Boundaries

Public acquisition uses `https://ein.llc` and the paths in `references/continuation-pin.json`. `--public-root` accepts only `http://127.0.0.1:port` or `http://[::1]:port` and records local receiving. A redirect is followed only when it stays on that origin and the pinned path. The work directory is the directory you pass. An existing output is left in place.

The published client can also run `agent_assisted_human` against an https origin, including `localhost` loopback aliases. This skill does not open that lane, so a live case is not started here.

`--pay`, `--settle`, `--sign`, `--wallet`, `--claim`, `--attest`, `--register`, and `--file` stop before any request. Running this command does not select or prove a native model.
