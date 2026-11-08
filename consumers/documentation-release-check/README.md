# Documentation release check

Two healthy hosts can publish valid documentation indexes and still leave
readers stranded on one side. A broken-link checker verifies links that already
exist. This gate verifies that each index **contains** a link to the other
index, even when every link already present works.

The input came from OpenMA’s two-host rollout.
[Issue #491](https://github.com/openma-ai/open-managed-agents/issues/491) ·
[Merged pull request #552](https://github.com/openma-ai/open-managed-agents/pull/552)

## Command line

Use Node.js 20 or newer. No dependency installation is needed.

```sh
node consumers/documentation-release-check/check.mjs https://www.example.com https://docs.example.com
```

Pass exactly two distinct bare HTTPS origins. A port and a single trailing slash
are allowed. Host case and default
ports are canonicalized for distinctness. Paths, query strings, fragments,
credentials and whitespace are refused before either request.

Each invocation sends one GET per origin to `/llms.txt`, with a five-second
deadline per request including the body. It refuses redirects, requires HTTP
200 with `text/plain` or `text/markdown`, and caps the body at 128 KiB of UTF-8.
The first nonblank line must be a nonempty Markdown heading (`# Title`). Put the
peer link first on an unindented, single-line list entry.

```md
- [Documentation index](https://docs.example.com/llms.txt): Reference and guides.
```

The destination must be the literal canonical peer origin plus `/llms.txt`.
A relative link, query, fragment, prose mention, or link in code or markup does
not count. The format supports plain single-line labels, optional angle
brackets around the destination, and optional simple inline titles.

Standard output is one JSON line with
`schemaVersion: 1` and two `results` in argument order. Each has an `origin`
(canonical origin or `null`), `status`, and `reason`.

| Exit | Status | Reasons |
| --- | --- | --- |
| 0 | `pass` on both | `peer_link_present` |
| 1 | `drift` | `missing_index` (404 or 410), `peer_link_missing` |
| 1 | `refused` | `redirect`, `unexpected_http_status`, `unsupported_media_type`, `body_too_large`, `invalid_utf8`, `missing_initial_h1`, `timeout`, `request_failed` |
| 2 | `refused` or `skipped` | `expected_two_origins`, `invalid_origin`, `invalid_pair`, `duplicate_origin` |

No redirect destination or listed link is requested. Output contains no
response body, headers, or error messages.

## GitHub composite action

Use the live action **only** in trusted post-deploy workflows with public
origins configured by their owners. Never supply origins from pull requests,
untrusted agent output, event payloads or user input. Origin validation checks
syntax. The workflow owner must establish host trust and control the runner
environment.

Insert the following job in an existing trusted push workflow after both deploy
jobs. Substitute their job names, your two origins, and the full reviewed commit
SHA that contains this action.

```yaml
jobs:
  documentation-release-check:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: [deploy-marketing, deploy-docs]
    runs-on: ubuntu-24.04
    permissions: {}
    steps:
      - uses: epistemedeus/x402-data-gateway-skills/consumers/documentation-release-check@REVIEWED_40_HEX_COMMIT
        with:
          first-origin: https://www.example.com
          second-origin: https://docs.example.com
```

For separate pipelines, place this job after the trusted signal that both
deployments are ready. The action uses the runner’s Node, passes the two origins
as quoted arguments, and returns the CLI output and exit code.

Run deterministic tests with
`node --test consumers/documentation-release-check/check.test.mjs`.
The [repository canary](../../.github/workflows/documentation-release-check-canary.yml)
also runs the local composite action with two fixed offline fixtures. It does not
fetch PR-selected origins or depend on either OpenMA host.

For additional context, [SameDayDesk’s unscored per-origin documentation report](https://samedaydesk.com/agent-readiness?host=docs.openma.ai&format=documentation)
is a separate optional tool.

To roll back, remove the post-deploy job or restore its previous reviewed pin.
Remove the fixture workflow if installed. For a local copy, delete this folder.
