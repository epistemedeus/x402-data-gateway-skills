# samedaydesk-antigravity

Antigravity CLI plugin for the existing SameDayDesk remote MCP. The source directory is `plugins/samedaydesk-antigravity`. The machine name in `plugin.json` is `samedaydesk`. The name shown to people is SameDayDesk. It binds one server and one skill. It does not install the other skills in this repository, and it does not change the merchant server.

## Install

Use the official `agy` CLI. `OBSERVED.json` names the builds this directory was measured with. A later CLI build can differ. The public acquisition pin is commit `41ff445d93cab50fb6e96d9f70bcffa08ad3cab7` in `https://github.com/epistemedeus/x402-data-gateway-skills`. A later documentation commit is not that pin. `DISTRIBUTION.json` records the same pin.

This plugin is not listed in the Antigravity Marketplace. Official docs name one catalog, `antigravity-plugins-official`. `agy plugin install samedaydesk` and `agy plugin install samedaydesk@antigravity-plugins-official` install from that curated catalog, not from this directory. The Marketplace page's publisher step is an interest form, [https://forms.gle/2EX5RFYPoJe1UgxR9](https://forms.gle/2EX5RFYPoJe1UgxR9), to learn more about a listing. It is not a free submission that stores a listing id. This package was not submitted. There is no marketplace listing status.

The supplied URL is the released tree. It is not an `agy plugin install` argument. Official docs install a GitHub URL as the repository root, and this repository root is not the plugin. A measured tree URL follows a branch tip. A commit SHA is not a branch.

```text
https://github.com/epistemedeus/x402-data-gateway-skills/tree/41ff445d93cab50fb6e96d9f70bcffa08ad3cab7/plugins/samedaydesk-antigravity
```

Do not run `agy plugin import`. That migrates Gemini or Claude profiles, tokens, and keyrings. This adapter does not need that migration. Do not start a paid API, Vertex project, enterprise plan, or trial to install it.

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
agy --version
git clone https://github.com/epistemedeus/x402-data-gateway-skills.git
cd x402-data-gateway-skills
git checkout 41ff445d93cab50fb6e96d9f70bcffa08ad3cab7
agy plugin validate "$PWD/plugins/samedaydesk-antigravity" --strict
agy plugin install "$PWD/plugins/samedaydesk-antigravity"
agy plugin list --json
```

A sparse checkout of `plugins/samedaydesk-antigravity` is enough. There is no one-command URL that pins this commit.

On agy 1.4.8, a tree URL `https://github.com/<owner>/<repo>/tree/<branch>/<subpath>` was parsed as a subpath. `<branch>` had to be a remote branch name, and that build accepted a slash inside the branch name. `owner/repo:subpath` was rejected. This URL installed the directory and followed the branch tip. It does not pin a commit, and it is not the acquisition pin:

```text
https://github.com/epistemedeus/x402-data-gateway-skills/tree/codex/root17500-client-native-distribution-20261028/plugins/samedaydesk-antigravity
```

To leave an existing account untouched, run `agy` with a separate `HOME`. On agy 1.4.8 the previous machine name staged at `$HOME/.gemini/config/plugins/samedaydesk-antigravity`. Installing machine name `samedaydesk` stages `$HOME/.gemini/config/plugins/samedaydesk`. An earlier re-run used an isolated HOME with no signed-in user. `agy plugin list --json` read the skill and the MCP server component. `agy mcp list` still printed `No MCP servers configured.` and did not open the endpoint. That headless `agy --print` stopped before any tool load: the host does not reload plugin MCP servers without a signed-in Antigravity user, and the login URL was not followed. A later run inherited the signed-in `tpotalpha` profile and used the enrolled agy 1.4.9 binary, without running the installer. The same stage path was `.gemini/config/plugins/samedaydesk`. `agy mcp list` was still empty. The model prompt listed server `samedaydesk_samedaydesk` with every remote id under Lazy and none under Eager. It did not show the `mcp_samedaydesk_samedaydesk_` function prefix. Uninstall removed only `samedaydesk`. Older docs also mention `$HOME/.gemini/antigravity-cli/plugins/`. The tests stage there inside a temporary directory. That fixture path is not the agy 1.4.8 path. Read the staged path, skill name, MCP server name, and enabled flag from `agy plugin list --json`. Explicit enable and disable are stored at `plugins.<name>.enabled` in `$HOME/.gemini/config/config.json`. A missing entry lists as enabled. Do not copy that staged tree over another profile. `agy mcp list` is a separate manual server registry. It does not list servers that arrived only through this plugin, and it does not open the remote endpoint.

A profile that still has the previous machine name keeps that install until it is removed by name:

```bash
agy plugin uninstall samedaydesk-antigravity
```

That removes only the previous plugin name. It does not remove `samedaydesk`.

## Components

- `plugin.json` machine name is `samedaydesk`. `displayName` is SameDayDesk.
- `mcp_config.json` server key is `samedaydesk`. `serverUrl` is `https://agents.samedaydesk.com/mcp`.
- `skills/samedaydesk-remote-mcp/SKILL.md` is the only skill.

## Host tool names

agy 1.4.8 loads plugin MCP tools under `mcp_<plugin name>_<server name>_<tool id>` and rejects a name that does not match `^[a-zA-Z0-9_-]{1,64}$`. The previous machine name made the prefix `mcp_samedaydesk-antigravity_samedaydesk_` (40 characters). Host qualification then loaded 22 tools and dropped 7. That failure is retained in `OBSERVED.json`. It was not a complete host load.

The published plugin schema, fetched from `https://antigravity.google/schemas/v1/plugin.json` on 2026-10-28, can set `displayName`. It has no tool-id alias. `enabledTools` and `disabledTools` only hide tools. This config sets neither. The server entry stays `serverUrl` only and still points at `https://agents.samedaydesk.com/mcp`. Remote tool ids stay the merchant ids. SameDayDesk branding stays in `displayName`, the description, and the skill. The host prefix uses the machine name. The source directory is longer, and this job did not re-measure a host load, so a later host that prefixes the directory name instead of `plugin.json` `name` would still be over 64.

With machine name `samedaydesk` and server `samedaydesk`, the agy 1.4.8 prefix is `mcp_samedaydesk_samedaydesk_` (28 characters). A remote id of 37 or more characters does not fit that prefix. One unpaid `tools/list` on 2026-10-28, separate from the Antigravity host, had 29 ids. The longest was `stateful_wallet_policy_conformance` at 34 characters, so the longest generated name was 62. That count is not a permanent inventory. That list measurement sent no `tools/call`. A later unpaid list for the task-ready reader is appended in `OBSERVED.json`. It does not replace the 29-id measurement. On agy 1.4.9 the signed-in host did not register those function names. It listed the same remote ids, 30 of them, as Lazy tools under the server heading `samedaydesk_samedaydesk`. The seven ids dropped by the older prefix were in that listing. No `tools/call` was sent.

## Current qualification

`currentQualification.id` in `OBSERVED.json` is `ROOT25700`. Read that history entry. Its `hostComplete`, `hostLoadedAfterRename`, and `hostLoadedExchangeReceived` are true. It records agy 1.4.9, stage `.gemini/config/plugins/samedaydesk`, server heading `samedaydesk_samedaydesk`, 30 Lazy, and 0 dropped. Do not read an earlier history row as the current result. `cli.version` remains `1.4.8`. `install.stagedDirectory` remains `.gemini/config/plugins/samedaydesk-antigravity`. `customerUsefulExecution.hostComplete` remains false and belongs to ROOT23200. Nothing in this directory adds a host load or a model turn.

## Tests and the CLI

`tests/samedaydesk-antigravity.test.mjs` is not an `agy` run. The positive list talks to a local HTTP stub. Cleanup copies this directory into `.gemini/antigravity-cli/plugins` under a temporary HOME. The agy 1.4.8 qualification staged at `.gemini/config/plugins/samedaydesk-antigravity`. Those are different paths. A passing test is not a host-loaded `initialize`.

No hook, install script, resident process, credential field, or telemetry endpoint is declared.

## Discovery and payment

`initialize` and `tools/list` are unpaid discovery. They are not a trial and not a purchase. In operator discovery-QA, stop after that list and do not send `tools/call`. That no-call control is only for discovery-QA.

The customer skill may send one ordinary free `trial_read` when the user supplies a public URL. This package does not pay, does not POST `/trial/read` or `/trial/extract`, and sets no `X-SameDayDesk-Agent-Source` header. Attribution is unqualified.

A direct MCP SDK probe of the URL is not the Antigravity host loading the plugin. `agy plugin list` is the component readback. A model turn is a later step and is not required to install or list the plugin.

## Task-ready reader

Use customer task-ready to send one ordinary free `trial_read` for the supplied public URL and inspect the structured result. It does not add Task augmentation. `execution.taskSupport` `forbidden` forbids that augmentation only. Paid tools, including `read`, stay with the authorized caller's own payment authority. Missing, expired, exhausted, refused, and lost responses stop without a payment or a retry. The synthetic journey lives in `tests/fixtures/samedaydesk-antigravity/protocol.mjs`. Counts in `OBSERVED.json` are not a package contract.

## Remove

```bash
agy plugin disable samedaydesk
agy plugin uninstall samedaydesk
```

Uninstall removes the machine name `samedaydesk` only.

## License

`LICENSE` applies to the files in this directory only. It does not license the rest of `x402-data-gateway-skills`.
