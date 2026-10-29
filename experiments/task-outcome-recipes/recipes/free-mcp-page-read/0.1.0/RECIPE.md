# Free MCP page read 0.1.0

Task: read one caller-supplied public HTTPS page with the existing free MCP `trial_read`, then stop. A lost or paid response is not a retry and not a purchase.

Consumer: an agent whose host binds the SameDayDesk remote MCP server declared by `plugins/samedaydesk-antigravity`.

## Acquisition

MCP. The plugin config names `https://agents.samedaydesk.com/mcp`. The documented install checks out `41ff445d93cab50fb6e96d9f70bcffa08ad3cab7` and installs that plugin directory. This recipe does not run `agy`, does not check out that commit, does not call production, and does not submit the marketplace form.

The tested server is the existing loopback fixture `tests/fixtures/samedaydesk-antigravity/protocol.mjs`. `customerFreeRead` sends `initialize`, the initialized notification, `tools/list`, and one ordinary `tools/call`. It sends no `task` field.

## Inputs and outputs

Input is the synthetic MCP URL and `https://example.com/public-page`. Output is `outcome`, `consumingRequests`, `purchaseSent`, `paidRequestSent`, `retried`, and `structured.markdown` when the fixture returns a body. `charged` is false on the useful read.

## Direct alternative

Read `structured.markdown` from the result already in hand. That is sufficient for the fixture text. A live HTTPS GET of the page is the stronger outside baseline and is not performed. The MCP path is the one-call stop, the payment-challenge stop, and the refusal to treat a lost body as success.

## Fixtures

| Fixture | Expected class |
| --- | --- |
| first use | `customer-useful`, one consuming call, markdown `Synthetic read of https://example.com/public-page` |
| repeat | Reuse that markdown locally. No new call |
| refusal | A second `tools/call` on the same server is `refused`. A list without `trial_read` sends no call. HTTP 402 is `caller-authority` with `purchaseSent` false. A `task` field throws before send |
| recovery | `customer-lost` stays `unknown` / `lost-response` and `retried` false. A later read is a new server and a new explicit call. Operator `discover` sends no `tools/call` |

## License

MIT, limited to `plugins/samedaydesk-antigravity/LICENSE`. The released commit recorded in `DISTRIBUTION.json` stays `41ff445d93cab50fb6e96d9f70bcffa08ad3cab7`.
