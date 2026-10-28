# samedaydesk-antigravity

Antigravity CLI plugin for the existing SameDayDesk remote MCP. It binds one server and one discovery skill. It does not install the other skills in this repository, and it does not change the merchant server.

## Install

Use the official `agy` CLI. The qualification record in `OBSERVED.json` names the build this package was installed with. A later CLI build can differ.

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
agy --version
```

Do not run `agy plugin import`. That migrates Gemini or Claude profiles, tokens, and keyrings. This adapter does not need that migration. Do not start a paid API, Vertex project, enterprise plan, or trial to install it.

`agy plugin install` accepts a local directory or a GitHub URL. On agy 1.4.8, a tree URL `https://github.com/<owner>/<repo>/tree/<branch>/<subpath>` is parsed as a subpath. `<branch>` must be a remote branch name, and this build accepted a slash inside the branch name. A commit SHA is not a branch. `owner/repo:subpath` is rejected. The repository root is the wrong target: it is not this plugin, and installing it would not be this directory.

On that same build, this URL installed this directory and followed the branch tip. It does not pin a commit:

```text
https://github.com/epistemedeus/x402-data-gateway-skills/tree/codex/root17500-client-native-distribution-20261028/plugins/samedaydesk-antigravity
```

Install this directory from a pinned checkout:

```bash
git clone https://github.com/epistemedeus/x402-data-gateway-skills.git
cd x402-data-gateway-skills
git checkout <pinned-commit>
agy plugin validate "$PWD/plugins/samedaydesk-antigravity" --strict
agy plugin install "$PWD/plugins/samedaydesk-antigravity"
agy plugin list --json
```

A sparse checkout of `plugins/samedaydesk-antigravity` is enough. There is no separate one-command URL for a pinned commit.

To leave an existing account untouched, run `agy` with a separate `HOME`. On agy 1.4.8 the staged directory is `$HOME/.gemini/config/plugins/samedaydesk-antigravity`. Older docs also mention `$HOME/.gemini/antigravity-cli/plugins/`. Read the staged path, skill name, MCP server name, and enabled flag from `agy plugin list --json`. Explicit enable and disable are stored at `plugins.<name>.enabled` in `$HOME/.gemini/config/config.json`. A missing entry lists as enabled. Do not copy that staged tree over another profile. `agy mcp list` is a separate manual server registry. It does not list servers that arrived only through this plugin, and it does not open the remote endpoint.

## Components

- `plugin.json` names the plugin `samedaydesk-antigravity`.
- `mcp_config.json` sets `serverUrl` to `https://agents.samedaydesk.com/mcp`.
- `skills/samedaydesk-remote-mcp/SKILL.md` is the only skill.

No hook, install script, resident process, credential field, or telemetry endpoint is declared.

## Discovery and payment

`initialize` and `tools/list` are unpaid discovery. They are not extraction and not a trial. Do not send `tools/call` from this package. The plugin sets no `X-SameDayDesk-Agent-Source` header. Attribution is unqualified.

A direct MCP SDK probe of the URL is not the Antigravity host loading the plugin. `agy plugin list` is the component readback. A model turn is a later step and is not required to install or list the plugin.

## Remove

```bash
agy plugin disable samedaydesk-antigravity
agy plugin uninstall samedaydesk-antigravity
```

Uninstall removes this plugin only.

## License

`LICENSE` applies to the files in this directory only. It does not license the rest of `x402-data-gateway-skills`.
