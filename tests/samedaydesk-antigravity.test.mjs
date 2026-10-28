import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CUSTOMER_TASK_READY,
  ConfigError,
  HOST_NAME_MAX,
  OBSERVED_AGY_148_PLUGIN_STAGE_REL,
  OPERATOR_DISCOVERY_QA,
  ProtocolError,
  SYNTHETIC_PLUGIN_STAGE_REL,
  TransportRefusal,
  agyHostNameFits,
  agyHostPrefix,
  agyHostToolName,
  classifyListedTool,
  currentHostQualification,
  customerFreeRead,
  discover,
  loadAdapterConfig,
  probeUnsupported,
  readInventory,
  readPluginState,
  readToolBoundary,
  stagePlugin,
  startFixture,
  treeDigest,
  uninstallPlugin,
} from './fixtures/samedaydesk-antigravity/protocol.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pluginRoot = join(repoRoot, 'plugins', 'samedaydesk-antigravity');
const ENDPOINT = 'https://agents.samedaydesk.com/mcp';

function readPlugin(name) {
  return readFileSync(join(pluginRoot, name), 'utf8');
}

test('adapter manifest is one Antigravity plugin and does not enroll root skills', () => {
  const manifest = JSON.parse(readPlugin('plugin.json'));
  assert.equal(manifest.name, 'samedaydesk');
  assert.equal(manifest.displayName, 'SameDayDesk');
  assert.match(manifest.name, /^[a-zA-Z0-9_-]+$/);
  assert.equal(manifest.$schema, 'https://antigravity.google/schemas/v1/plugin.json');
  assert.equal(typeof manifest.description, 'string');
  assert.equal(manifest.skills, undefined);
  assert.equal(manifest.extensions, undefined);
  const allowed = new Set([
    '$schema', 'name', 'displayName', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords',
  ]);
  for (const key of Object.keys(manifest)) assert.equal(allowed.has(key), true, key);
  assert.equal(manifest.author.name, 'SameDayDesk');
  assert.equal(manifest.author.email, undefined);
  assert.deepEqual(readdirSync(join(pluginRoot, 'skills')), ['samedaydesk-remote-mcp']);
  assert.equal(readdirSync(join(repoRoot, 'skills')).length, 21);
});

test('qualification record keeps the SDK probe separate from host execution', () => {
  const observed = JSON.parse(readPlugin('OBSERVED.json'));
  assert.equal(observed.directSdkProbe.separateFromAntigravityHost, true);
  assert.equal(observed.directSdkProbe.toolsCallSent, false);
  assert.equal(observed.hostLoadedExchange.received, true);
  assert.equal(observed.attribution, 'unqualified');
  assert.equal(observed.sourceHeader, null);
  assert.equal(observed.githubInstall.pinnedOneCommandUrl, false);
  assert.equal(observed.githubInstall.branchSubpathInstall.received, true);
  assert.equal(observed.githubInstall.branchSubpathInstall.pinsCommit, false);
  assert.equal(observed.githubInstall.branchSubpathInstall.followsBranchTip, true);
  assert.equal(observed.directSdkProbe.toolsListCount, 29);
  assert.equal(observed.qualificationHistory[0].id, 'ROOT17500');
  assert.equal(observed.qualificationHistory[0].hostLoadedExchangeReceived, false);
  assert.equal(observed.qualificationHistory[1].id, 'ROOT19120');
  assert.equal(observed.qualificationHistory[1].notCompleteHostLoad, true);
  assert.equal(observed.qualificationHistory[1].loaded, 22);
  assert.equal(observed.qualificationHistory[1].dropped, 7);
  assert.equal(observed.qualificationHistory[1].evidence.sha256, 'f223ae2ba7d8457b168aa8dfba1c6b5c4b7f1b43694c266bf14b26aa730c37b2');
  assert.equal(observed.hostName.hostLoadedAfterRename, true);
  assert.equal(observed.hostName.agy149ServerHeading, 'samedaydesk_samedaydesk');
  assert.equal(observed.hostName.prefixFormObservedOnAgy149, false);
  assert.equal(observed.hostName.installReRun, true);
  assert.equal(observed.hostName.installReRunStagedDirectory, '.gemini/config/plugins/samedaydesk');
  assert.equal(observed.hostName.schemaHasToolIdAlias, false);
  assert.match(observed.hostLoadedExchange.reason, /samedaydesk_samedaydesk/);
  assert.match(observed.hostLoadedExchange.reason, /30 Lazy remote ids/);
  assert.match(observed.hostLoadedExchange.reason, /mcp_samedaydesk_samedaydesk_/);
  assert.match(observed.hostLoadedExchange.reason, /No tools\/call was sent/);
});

test('current qualification reads ROOT25700 and leaves earlier failures recorded', () => {
  const observed = JSON.parse(readPlugin('OBSERVED.json'));
  const before = JSON.stringify(observed.qualificationHistory);
  const current = currentHostQualification(observed);
  assert.equal(JSON.stringify(observed.qualificationHistory), before);
  assert.equal(observed.currentQualification.id, 'ROOT25700');
  assert.equal(observed.currentQualification.source, 'qualificationHistory');
  assert.equal(current.id, 'ROOT25700');
  assert.equal(current.source, 'qualificationHistory');
  const entry = observed.qualificationHistory.find((row) => row.id === 'ROOT25700');
  assert.equal(entry.hostComplete, true);
  assert.equal(current.hostComplete, entry.hostComplete);
  assert.equal(current.hostLoadedAfterRename, entry.hostLoadedAfterRename);
  assert.equal(current.hostLoadedExchangeReceived, entry.hostLoadedExchangeReceived);
  assert.equal(current.agyVersion, entry.agyVersion);
  assert.equal(current.agyVersion, '1.4.9');
  assert.equal(current.stagedDirectory, entry.install.stagedDirectory);
  assert.equal(current.stagedDirectory, '.gemini/config/plugins/samedaydesk');
  assert.equal(current.serverHeading, entry.inventory.serverHeading);
  assert.equal(current.serverHeading, 'samedaydesk_samedaydesk');
  assert.equal(current.loaded, 30);
  assert.equal(current.dropped, 0);
  assert.equal(observed.qualificationHistory[0].id, 'ROOT17500');
  assert.equal(observed.qualificationHistory[0].hostLoadedExchangeReceived, false);
  assert.equal(observed.qualificationHistory[1].id, 'ROOT19120');
  assert.equal(observed.qualificationHistory[1].notCompleteHostLoad, true);
  assert.equal(observed.qualificationHistory[1].loaded, 22);
  assert.equal(observed.qualificationHistory[1].dropped, 7);
  const root23200 = observed.qualificationHistory.find((row) => row.id === 'ROOT23200');
  const root24420 = observed.qualificationHistory.find((row) => row.id === 'ROOT24420');
  assert.equal(root23200.hostComplete, false);
  assert.equal(root24420.hostComplete, false);
  assert.equal(root24420.hostLoadedAfterRename, false);
  assert.equal(root24420.hostLoadedExchangeReceived, false);
  assert.equal(observed.customerUsefulExecution.hostComplete, false);
  assert.equal(observed.customerUsefulExecution.id, 'ROOT23200');
  assert.equal(observed.cli.version, '1.4.8');
  assert.equal(observed.install.stagedDirectory, '.gemini/config/plugins/samedaydesk-antigravity');
  assert.equal(observed.githubInstall.branchSubpathInstall.ref, 'codex/root17500-client-native-distribution-20261028');
  assert.equal(observed.githubInstall.branchSubpathInstall.pinsCommit, false);
  assert.equal(observed.githubInstall.pinnedOneCommandUrl, false);
  assert.notEqual(current.id, observed.qualificationHistory[0].id);
  assert.deepEqual(current.earlierEntriesRemain, [
    'ROOT17500',
    'ROOT19120',
    'ROOT22600',
    'ROOT23200',
    'ROOT24420',
  ]);
  assert.throws(
    () => currentHostQualification({ qualificationHistory: observed.qualificationHistory }),
    ProtocolError,
  );
  assert.throws(
    () => currentHostQualification({
      currentQualification: { id: 'ROOT99999' },
      qualificationHistory: observed.qualificationHistory,
    }),
    ProtocolError,
  );
  const failedPointer = currentHostQualification({
    currentQualification: { id: 'ROOT24420' },
    qualificationHistory: observed.qualificationHistory,
  });
  assert.equal(failedPointer.hostComplete, false);
  assert.equal(failedPointer.hostLoadedAfterRename, false);
  assert.equal(failedPointer.hostLoadedExchangeReceived, false);
});

test('public acquisition pins the released commit and records no marketplace listing', () => {
  const distribution = JSON.parse(readPlugin('DISTRIBUTION.json'));
  const readme = readPlugin('README.md');
  const manifest = JSON.parse(readPlugin('plugin.json'));
  const repoReadme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  assert.equal(distribution.schema, 'samedaydesk.antigravity-public-acquisition.v0');
  assert.equal(distribution.releasedCommit, '41ff445d93cab50fb6e96d9f70bcffa08ad3cab7');
  assert.equal(distribution.releasedTree, '9bcd68d9609d9ded8c8aea901360cbe0abf89a43');
  assert.equal(distribution.documentationCommitIsNotThePin, true);
  assert.equal(distribution.pluginDirectory, 'plugins/samedaydesk-antigravity');
  assert.equal(distribution.machineName, manifest.name);
  assert.equal(distribution.displayName, manifest.displayName);
  assert.equal(distribution.version, manifest.version);
  assert.equal(distribution.mcpServerUrl, 'https://agents.samedaydesk.com/mcp');
  assert.equal(distribution.measuredStageDirectory, '.gemini/config/plugins/samedaydesk');
  assert.equal(distribution.listing.listed, false);
  assert.equal(distribution.listing.marketplace, 'antigravity-plugins-official');
  assert.equal(distribution.listing.submissionStored, false);
  assert.equal(distribution.listing.interestFormSubmitted, false);
  assert.equal(distribution.listing.interestForm, 'https://forms.gle/2EX5RFYPoJe1UgxR9');
  assert.equal(distribution.suppliedUrlIsAgyInstallArgument, false);
  assert.equal(
    distribution.suppliedUrl,
    'https://github.com/epistemedeus/x402-data-gateway-skills/tree/41ff445d93cab50fb6e96d9f70bcffa08ad3cab7/plugins/samedaydesk-antigravity',
  );
  assert.equal(distribution.notInstallTargets.treeOrBranchUrlPinsCommit, false);
  assert.equal(distribution.notInstallTargets.historicalBranchSubpath.isAcquisitionPin, false);
  assert.equal(distribution.notInstallTargets.historicalBranchSubpath.pinsCommit, false);
  assert.equal(distribution.notInstallTargets.historicalBranchSubpath.ref, 'codex/root17500-client-native-distribution-20261028');
  assert.equal(distribution.sparseCheckoutEnough, true);
  assert.equal(distribution.installCommands.includes('git checkout 41ff445d93cab50fb6e96d9f70bcffa08ad3cab7'), true);
  assert.equal(distribution.installCommands.some((line) => line.includes('agy plugin import')), false);
  assert.equal(distribution.installCommands.some((line) => /agy plugin install https:/.test(line)), false);
  assert.equal(distribution.installCommands.some((line) => line.includes('codex/root17500')), false);
  assert.equal(
    distribution.installCommands.some((line) => line === 'agy plugin install "$PWD/plugins/samedaydesk-antigravity"'),
    true,
  );
  assert.deepEqual(distribution.removeCurrent, [
    'agy plugin disable samedaydesk',
    'agy plugin uninstall samedaydesk',
  ]);
  assert.equal(distribution.uninstallPreviousMachineName, 'agy plugin uninstall samedaydesk-antigravity');
  const fence = readme.split('```bash')[1].split('```')[0];
  assert.match(fence, /git checkout 41ff445d93cab50fb6e96d9f70bcffa08ad3cab7/);
  assert.match(fence, /agy plugin validate "\$PWD\/plugins\/samedaydesk-antigravity" --strict/);
  assert.match(fence, /agy plugin install "\$PWD\/plugins\/samedaydesk-antigravity"/);
  assert.match(fence, /agy plugin list --json/);
  assert.doesNotMatch(fence, /agy plugin import/);
  assert.doesNotMatch(fence, /<pinned-commit>/);
  assert.doesNotMatch(fence, /codex\/root17500/);
  assert.match(readme, /not listed/);
  assert.match(readme, /antigravity-plugins-official/);
  assert.match(readme, /https:\/\/forms\.gle\/2EX5RFYPoJe1UgxR9/);
  assert.match(readme, /not an `agy plugin install` argument/);
  assert.match(readme, /currentQualification/);
  assert.match(readme, /ROOT25700/);
  assert.match(readme, /Do not run `agy plugin import`/);
  assert.doesNotMatch(readme, /<pinned-commit>/);
  assert.match(repoReadme, /plugins\/samedaydesk-antigravity/);
  assert.match(repoReadme, /not a listing in `antigravity-plugins-official`/);
  assert.match(repoReadme, /npx skills add/);
});

test('adapter manifest has no hooks file', () => {
  const names = readdirSync(pluginRoot);
  assert.equal(names.includes('hooks.json'), false);
  assert.equal(names.includes('.mcp.json'), false);
  assert.equal(names.includes('.claude-plugin'), false);
});

test('mcp config uses the existing endpoint and no source header', () => {
  const config = JSON.parse(readPlugin('mcp_config.json'));
  assert.deepEqual(loadAdapterConfig(config), {
    name: 'samedaydesk',
    serverUrl: ENDPOINT,
  });
  assert.equal(JSON.stringify(config).includes('X-SameDayDesk-Agent-Source'), false);
  assert.equal(JSON.stringify(config).includes('claude-code'), false);
  assert.equal(config.mcpServers.samedaydesk.headers, undefined);
  assert.equal(config.mcpServers.samedaydesk.command, undefined);
});

test('license is scoped to the adapter directory', () => {
  const license = readPlugin('LICENSE');
  assert.match(license, /plugins\/samedaydesk-antigravity\//);
  assert.match(license, /does not license/);
  assert.match(license, /no declared/);
  assert.match(license, /Copyright \(c\) 2026 SameDayDesk/);
  const readme = readPlugin('README.md');
  assert.match(readme, /does not license the rest/);
  assert.match(readme, /Do not run `agy plugin import`/);
  assert.match(readme, /operator discovery-QA/);
  assert.match(readme, /customer task-ready/);
  assert.match(readme, /`trial_read`/);
  assert.doesNotMatch(readme, /whole repository is MIT/i);
});

test('customer skill allows one free trial_read and keeps no-call in discovery only', () => {
  const skill = readPlugin('skills/samedaydesk-remote-mcp/SKILL.md');
  const parts = skill.split('## Operator discovery-QA');
  assert.equal(parts.length, 2);
  const customer = parts[0];
  const discovery = parts[1];
  assert.match(skill, /^---\nname: samedaydesk-remote-mcp\n/);
  assert.match(skill, /description: .+/);
  assert.match(skill, new RegExp(ENDPOINT.replaceAll('/', '\\/')));
  assert.match(skill, /Attribution is unqualified/);
  assert.match(skill, /Do not start either trial/);
  assert.match(skill, /_meta\.x402\.paymentRequired/);
  assert.match(skill, /A GET of `https:\/\/agents\.samedaydesk\.com\/mcp` is not `tools\/list`/);
  assert.match(skill, /claude-code-marketplace-v1/);
  assert.match(skill, /Machine name \| `samedaydesk`/);
  assert.match(skill, /Display name \| SameDayDesk/);
  assert.match(skill, /mcp_samedaydesk_samedaydesk_/);
  assert.match(skill, /Do not call it a complete host load/);
  assert.match(skill, /operator discovery-QA/);
  assert.match(skill, /customer task-ready/);
  assert.match(skill, /authorized caller/);
  assert.match(skill, /`trial_read`/);
  assert.match(skill, /execution\.taskSupport/);
  assert.match(skill, /forbidden/);
  assert.match(skill, /markdownLimitChars/);
  assert.match(skill, /does not forbid this ordinary `tools\/call`/);
  assert.match(skill, /not an Antigravity Marketplace listing/);
  assert.match(skill, /not idempotent/);
  assert.match(customer, /Send one ordinary `tools\/call`/);
  assert.match(customer, /original shared budget/);
  assert.doesNotMatch(customer, /Do not send `tools\/call`/);
  assert.doesNotMatch(customer, /This skill does not send/);
  assert.match(discovery, /only when the task is operator discovery-QA/);
  assert.match(discovery, /Do not send `tools\/call`/);
  assert.match(readPlugin('README.md'), /one ordinary free `trial_read`/);
  assert.match(readPlugin('README.md'), /only for discovery-QA/);
  assert.doesNotMatch(skill, /X-SameDayDesk-Agent-Source: claude-code-marketplace-v1/);
  assert.doesNotMatch(skill, /\b29 tools\b/);
  assert.doesNotMatch(skill, /\b30 tools\b/);
  assert.doesNotMatch(skill, /payTo|0x[a-fA-F0-9]{6,}/);
  assert.doesNotMatch(skill, /Authorization:|Bearer |api[_-]key|PRIVATE_KEY/i);
});

test('bad config and unsupported operation never open a paid tool request', async () => {
  const fixture = await startFixture('positive');
  try {
    const cases = [
      [{ mcpServers: { samedaydesk: { httpUrl: ENDPOINT } } }, /unsupported httpUrl/],
      [{ mcpServers: { samedaydesk: { url: ENDPOINT } } }, /unsupported legacy url key/],
      [{ mcpServers: { samedaydesk: { type: 'sse', serverUrl: ENDPOINT } } }, /unsupported sse/],
      [{ mcpServers: { samedaydesk: { command: 'node', serverUrl: ENDPOINT } } }, /unsupported stdio/],
      [{ mcpServers: { samedaydesk: { serverUrl: ENDPOINT, headers: { Authorization: 'Bearer x' } } } }, /credential or header/],
      [{ mcpServers: { samedaydesk: { serverUrl: 'https://example.invalid/mcp' } } }, /existing SameDayDesk MCP endpoint/],
      [{}, /missing mcpServers/],
    ];
    for (const [config, pattern] of cases) {
      assert.throws(() => loadAdapterConfig(config), ConfigError);
      assert.throws(() => loadAdapterConfig(config), pattern);
    }
    assert.equal(fixture.requests.length, 0);
    await assert.rejects(
      () => probeUnsupported(fixture.url, 'tools/call'),
      (error) => error instanceof ProtocolError && /discovery mode refuses tools\/call before send/.test(error.message),
    );
    assert.equal(fixture.requests.length, 0);
    const unsupported = await probeUnsupported(fixture.url, 'prompts/list');
    assert.equal(unsupported.code, -32601);
    assert.deepEqual(fixture.requests.map((message) => message.method), ['prompts/list']);
  } finally {
    await fixture.close();
  }
});

test('synthetic fixture install completes initialize, initialized, and tools/list', async () => {
  const fixture = await startFixture('positive');
  try {
    const found = await discover(fixture.url);
    assert.deepEqual(found.sent, ['initialize', 'notifications/initialized', 'tools/list']);
    assert.equal(found.protocolVersion, '2025-11-25');
    assert.equal(found.serverInfo.name, 'samedaydesk-fixture');
    assert.equal(found.session, 'fixture-session');
    assert.equal(found.tools.length, 1);
    assert.equal(found.tools[0].name, 'extract');
    assert.equal(found.tools[0].inputSchema.type, 'object');
    assert.deepEqual(fixture.requests.map((message) => message.method), found.sent);
    assert.equal(fixture.requests.some((message) => message.method === 'tools/call'), false);
  } finally {
    await fixture.close();
  }
});

test('transport refusal stops on the first response and does not call a tool', async () => {
  const fixture = await startFixture('transport-refusal');
  try {
    await assert.rejects(
      () => discover(fixture.url),
      (error) => error instanceof TransportRefusal && error.details.sent.length === 1,
    );
    assert.deepEqual(fixture.requests.map((message) => message.method), ['initialize']);
    assert.equal(JSON.stringify(fixture.requests).includes('tools/call'), false);
  } finally {
    await fixture.close();
  }
});

test('synthetic cleanup and reinstall preserve an unrelated plugin and config', () => {
  const home = mkdtempSync(join(tmpdir(), 'samedaydesk-antigravity-'));
  const unrelated = join(home, 'unrelated-source');
  const manifest = JSON.parse(readPlugin('plugin.json'));
  try {
    writeFileSync(join(home, 'sentinel-config.json'), '{"marker":"preserve"}\n');
    mkdirSync(unrelated, { recursive: true });
    writeFileSync(join(unrelated, 'plugin.json'), '{"name":"unrelated-notes","description":"sentinel"}\n');
    const before = treeDigest(unrelated);
    stagePlugin(home, 'unrelated-notes', unrelated);
    const stagedUnrelated = treeDigest(join(home, ...SYNTHETIC_PLUGIN_STAGE_REL.split('/'), 'unrelated-notes'));
    assert.equal(stagedUnrelated, before);
    assert.equal(existsSync(join(home, ...OBSERVED_AGY_148_PLUGIN_STAGE_REL.split('/'))), false);
    stagePlugin(home, manifest.name, pluginRoot);
    const sourceDigest = treeDigest(pluginRoot);
    const stagedAdapter = join(home, ...SYNTHETIC_PLUGIN_STAGE_REL.split('/'), manifest.name);
    assert.equal(treeDigest(stagedAdapter), sourceDigest);
    assert.equal(readPluginState(home).plugins[manifest.name].enabled, true);
    assert.equal(readPluginState(home).plugins['unrelated-notes'].enabled, true);
    uninstallPlugin(home, manifest.name);
    assert.equal(readPluginState(home).plugins[manifest.name], undefined);
    assert.equal(treeDigest(join(home, ...SYNTHETIC_PLUGIN_STAGE_REL.split('/'), 'unrelated-notes')), before);
    assert.equal(readFileSync(join(home, 'sentinel-config.json'), 'utf8'), '{"marker":"preserve"}\n');
    stagePlugin(home, manifest.name, pluginRoot);
    assert.equal(treeDigest(stagedAdapter), sourceDigest);
    assert.equal(treeDigest(join(home, ...SYNTHETIC_PLUGIN_STAGE_REL.split('/'), 'unrelated-notes')), before);
    assert.equal(readFileSync(join(home, 'sentinel-config.json'), 'utf8'), '{"marker":"preserve"}\n');
    assert.notEqual(SYNTHETIC_PLUGIN_STAGE_REL, OBSERVED_AGY_148_PLUGIN_STAGE_REL);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('generated host names after the agy prefix stay within 64 characters', () => {
  const manifest = JSON.parse(readPlugin('plugin.json'));
  const config = JSON.parse(readPlugin('mcp_config.json'));
  const observed = JSON.parse(readPlugin('OBSERVED.json'));
  const serverName = loadAdapterConfig(config).name;
  assert.equal(manifest.name, observed.hostName.pluginName);
  assert.equal(serverName, observed.hostName.serverName);
  assert.equal(serverName, 'samedaydesk');
  const prefix = agyHostPrefix(manifest.name, serverName);
  assert.equal(prefix, 'mcp_samedaydesk_samedaydesk_');
  assert.equal(prefix.length, 28);
  assert.equal(HOST_NAME_MAX - prefix.length, 36);

  const live = observed.hostName.liveUnpaidList;
  assert.equal(live.separateFromAntigravityHost, true);
  assert.equal(live.toolsCallSent, false);
  assert.equal(live.notAPermanentInventory, true);
  assert.equal(live.ids.length, live.count);
  assert.equal(new Set(live.ids).size, live.ids.length);
  let longest = '';
  for (const id of live.ids) {
    assert.equal(agyHostNameFits(manifest.name, serverName, id), true, id);
    const generated = agyHostToolName(manifest.name, serverName, id);
    assert.equal(generated.length <= HOST_NAME_MAX, true, generated);
    if (id.length > longest.length) longest = id;
  }
  assert.equal(longest, live.longestToolId);
  assert.equal(longest.length, live.longestToolIdLength);
  assert.equal(prefix.length + longest.length, live.longestGeneratedLength);
  assert.equal(live.longestGeneratedLength <= HOST_NAME_MAX, true);
  assert.equal(live.ids.includes('trial_read'), false);

  const reader = observed.taskReadyReader;
  assert.equal(reader.id, 'ROOT22600');
  assert.equal(reader.separateFromAntigravityHost, true);
  assert.equal(reader.toolsCallSent, false);
  assert.equal(reader.trialPostSent, false);
  assert.equal(reader.purchaseSent, false);
  assert.equal(reader.notAPermanentInventory, true);
  assert.equal(reader.notAHostLoad, true);
  assert.equal(reader.hostLoadedAfterRename, false);
  assert.equal(reader.pricesCopied, false);
  assert.equal(reader.acceptsCopied, false);
  assert.equal(reader.count, reader.ids.length);
  assert.equal(new Set(reader.ids).size, reader.ids.length);
  assert.equal(reader.ids.includes('trial_read'), true);
  assert.deepEqual(new Set(reader.ids), new Set([...live.ids, 'trial_read']));
  assert.equal(reader.free.includes('trial_read'), true);
  assert.equal(reader.paid.includes('trial_read'), false);
  assert.equal(reader.paid.includes('read'), true);
  assert.equal(reader.classes.free, reader.free.length);
  assert.equal(reader.classes.paid, reader.paid.length);
  assert.equal(reader.classes.refusal, 0);
  assert.equal(reader.classes.free + reader.classes.paid, reader.count);
  assert.equal(reader.taskSupportForbidden, reader.count);
  assert.equal(reader.trialRead.class, 'free');
  assert.equal(reader.trialRead.called, false);
  assert.equal(reader.trialRead.taskSupport, 'forbidden');
  assert.deepEqual(reader.trialRead.inputRequired, ['url']);
  assert.deepEqual(reader.trialRead.inputProperties, ['url', 'markdownLimitChars']);
  assert.equal(reader.priorCountRetained, live.count);
  for (const id of reader.ids) {
    assert.equal(agyHostNameFits(manifest.name, serverName, id), true, id);
  }
  assert.deepEqual(observed.qualificationHistory.map((entry) => entry.id), [
    'ROOT17500',
    'ROOT19120',
    'ROOT22600',
    'ROOT23200',
    'ROOT24420',
    'ROOT25700',
  ]);
  const root23200 = observed.qualificationHistory.find((entry) => entry.id === 'ROOT23200');
  assert.equal(root23200.globalNoCallBanResealed, false);
  assert.equal(root23200.productionToolsCallSent, false);
  assert.equal(root23200.hostComplete, false);
  assert.equal(root23200.commands[0].exitCode, 127);
  const root24420 = observed.qualificationHistory.find((entry) => entry.id === 'ROOT24420');
  assert.equal(root24420.id, 'ROOT24420');
  assert.equal(root24420.hostComplete, false);
  assert.equal(root24420.hostLoadedAfterRename, false);
  assert.equal(root24420.hostLoadedExchangeReceived, false);
  assert.equal(root24420.hostInstallReRunAfterRename, true);
  assert.equal(root24420.globalNoCallBanResealed, false);
  assert.equal(root24420.productionToolsCallSent, false);
  assert.equal(root24420.trialPostSent, false);
  assert.equal(root24420.purchaseSent, false);
  assert.equal(root24420.discoveryNoCallRemains, true);
  assert.equal(root24420.sdkProbeUsedAsHostLoad, false);
  assert.equal(root24420.lengthOnlyFixtureUsedAsHostLoad, false);
  assert.equal(root24420.loginUrlFollowed, false);
  assert.equal(root24420.authorizationCodePasted, false);
  assert.equal(root24420.agyVersion, '1.4.8');
  assert.equal(root24420.installerNotExecuted, true);
  assert.equal(root24420.installerManifestVersion, '1.4.9');
  assert.equal(root24420.validate.exitCode, 0);
  assert.equal(root24420.validate.findings.length, 0);
  assert.equal(root24420.install.exitCode, 0);
  assert.equal(root24420.install.stagedDirectory, '.gemini/config/plugins/samedaydesk');
  assert.equal(root24420.mcpList.exitCode, 0);
  assert.equal(root24420.mcpList.showsPluginServer, false);
  assert.equal(root24420.hostLoad.exitCode, 1);
  assert.equal(root24420.hostLoad.stdoutError, 'authentication failed or timed out');
  assert.match(root24420.hostLoad.stderr, /Error: authentication timed out\./);
  assert.match(root24420.hostLoad.stderr, /accounts\.google\.com\/o\/oauth2\/auth\?<redacted>/);
  assert.equal(root24420.hostLoad.oauthQueryRedacted, true);
  assert.match(root24420.hostLoad.log, /Not reloading plugin MCP servers/);
  assert.equal(root24420.hostLoad.prefixObserved, false);
  assert.equal(root24420.hostLoad.loadedCount, null);
  assert.equal(root24420.cleanup.exitCode, 0);
  assert.equal(root24420.cleanup.unrelatedPluginPreserved, true);
  assert.equal(root24420.cleanup.unrelatedName, 'unrelated-notes');
  const root25700 = observed.qualificationHistory.at(-1);
  assert.equal(root25700.id, 'ROOT25700');
  assert.equal(root25700.isolatedHome, false);
  assert.equal(root25700.homeInheritProfile, 'tpotalpha');
  assert.equal(root25700.hostLoadedAfterRename, true);
  assert.equal(root25700.hostLoadedExchangeReceived, true);
  assert.equal(root25700.hostComplete, true);
  assert.equal(root25700.prefixFormObserved, false);
  assert.equal(root25700.agyVersion, '1.4.9');
  assert.equal(root25700.pinnedQualificationCli, '1.4.8');
  assert.equal(root25700.installerNotExecuted, true);
  assert.equal(root25700.loginUrlFollowed, false);
  assert.equal(root25700.loginWaitFinalized, false);
  assert.equal(root25700.productionToolsCallSent, false);
  assert.equal(root25700.trialPostSent, false);
  assert.equal(root25700.purchaseSent, false);
  assert.equal(root25700.globalNoCallBanResealed, false);
  assert.equal(root25700.discoveryNoCallRemains, true);
  assert.equal(root25700.sdkProbeUsedAsHostLoad, false);
  assert.equal(root25700.lengthOnlyFixtureUsedAsHostLoad, false);
  assert.equal(root25700.doctor.tpotalphaAuthenticated, true);
  assert.equal(root25700.doctor.exitCode, 1);
  assert.equal(root25700.doctor.binaryVersion, '1.4.9');
  assert.equal(root25700.validate.exitCode, 0);
  assert.equal(root25700.validate.findings[0].severity, 'note');
  assert.equal(root25700.install.exitCode, 0);
  assert.equal(root25700.install.stagedDirectory, '.gemini/config/plugins/samedaydesk');
  assert.equal(root25700.mcpList.showsPluginServer, false);
  assert.equal(root25700.hostLoad.exitCode, 0);
  assert.equal(root25700.hostLoad.stdoutStatus, 'SUCCESS');
  assert.equal(root25700.hostLoad.response, 'pong');
  assert.equal(root25700.hostLoad.startupLogWasFinal, false);
  assert.match(root25700.hostLoad.startupLog, /Not reloading plugin MCP servers/);
  assert.deepEqual(root25700.hostLoad.transcriptSteps, ['USER_INPUT', 'PLANNER_RESPONSE']);
  assert.equal(root25700.inventory.serverHeading, 'samedaydesk_samedaydesk');
  assert.equal(root25700.inventory.prefix, 'mcp_samedaydesk_samedaydesk_');
  assert.equal(root25700.inventory.prefixLength, 28);
  assert.equal(root25700.inventory.prefixFormObserved, false);
  assert.deepEqual(root25700.inventory.eager, []);
  assert.equal(root25700.inventory.loaded, 30);
  assert.equal(root25700.inventory.dropped, 0);
  assert.deepEqual(root25700.inventory.lazy, reader.ids);
  assert.equal(root25700.inventory.lazy.length, root25700.inventory.loaded);
  for (const id of root25700.inventory.previouslyDroppedPresent) {
    assert.equal(root25700.inventory.lazy.includes(id), true, id);
    assert.equal(agyHostNameFits(manifest.name, serverName, id), true, id);
  }
  assert.equal(root25700.inventory.previouslyDroppedPresent.length, 7);
  assert.equal(root25700.cleanup.exitCode, 0);
  assert.equal(root25700.cleanup.unrelatedPluginPreserved, true);
  assert.equal(root25700.cleanup.unrelatedDigest, '7ef6593e08290aa297063454449bf7beee6f99588f537423b66f8b45bda6e649');
  assert.equal(root25700.cleanup.sentinelRemovedAfterProof, true);
  assert.deepEqual(root25700.cleanup.pluginListAfterRestore, []);
  assert.match(readPlugin('skills/samedaydesk-remote-mcp/SKILL.md'), /samedaydesk_samedaydesk/);
  assert.match(readPlugin('skills/samedaydesk-remote-mcp/SKILL.md'), /Every remote id in that prompt was Lazy/);
  assert.match(readPlugin('README.md'), /samedaydesk_samedaydesk/);
  assert.equal(observed.customerUsefulExecution.customerOrdinaryCall, 'trial_read');
  assert.equal(observed.customerUsefulExecution.taskAugmentation, false);
  assert.equal(observed.customerUsefulExecution.hostComplete, false);
  assert.equal(observed.customerUsefulExecution.globalNoCallBanResealed, false);
  assert.equal(observed.hostLoadedExchange.received, true);
  assert.equal(observed.qualificationHistory[1].evidence.sha256, 'f223ae2ba7d8457b168aa8dfba1c6b5c4b7f1b43694c266bf14b26aa730c37b2');

  const boundary = 'a'.repeat(HOST_NAME_MAX - prefix.length);
  assert.equal(agyHostNameFits(manifest.name, serverName, boundary), true);
  assert.equal(agyHostNameFits(manifest.name, serverName, `${boundary}a`), false);
  assert.equal(agyHostNameFits(manifest.name, serverName, 'has.dot'), false);
  assert.equal(agyHostNameFits(manifest.name, serverName, 'has space'), false);

  const failed = observed.qualificationHistory.find((entry) => entry.id === 'ROOT19120');
  assert.equal(failed.prefix, agyHostPrefix(failed.pluginName, failed.serverName));
  assert.equal(failed.droppedTools.length, 7);
  const over = [];
  for (const tool of failed.droppedTools) {
    const generated = agyHostToolName(failed.pluginName, failed.serverName, tool.id);
    assert.equal(generated.length, tool.prefixedLength);
    assert.equal(generated.length > HOST_NAME_MAX, true, tool.id);
    assert.equal(live.ids.includes(tool.id), true, tool.id);
    over.push(tool.id);
    assert.equal(agyHostNameFits(manifest.name, serverName, tool.id), true, tool.id);
  }
  for (const id of live.ids) {
    const oldLength = agyHostToolName(failed.pluginName, failed.serverName, id).length;
    assert.equal(oldLength > HOST_NAME_MAX, over.includes(id), id);
  }
});

test('reader separates operator discovery from customer task-ready and drops prices', () => {
  const trial = {
    name: 'trial_read',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['url'],
      properties: {
        url: { type: 'string', minLength: 1, maxLength: 2048 },
        markdownLimitChars: { type: 'integer', minimum: 1, maximum: 40000 },
      },
    },
    execution: { taskSupport: 'forbidden' },
    _meta: { samedaydesk: { charged: false, paymentRequired: false } },
  };
  const paid = {
    name: 'read',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    execution: { taskSupport: 'allowed' },
    _meta: {
      x402: { paymentRequired: true, accepts: [{ amount: '5000', payTo: '0xfixture' }] },
      samedaydesk: { operation: { id: 'read', price: '5000' } },
    },
  };
  const operator = readToolBoundary(trial, OPERATOR_DISCOVERY_QA);
  const customer = readToolBoundary(trial, CUSTOMER_TASK_READY);
  assert.equal(operator.class, 'free');
  assert.equal(customer.class, 'free');
  assert.equal(operator.documentedNextAction, 'stop-after-unpaid-list');
  assert.equal(customer.documentedNextAction, 'one-ordinary-free-trial-read');
  assert.equal(operator.toolsCallSent, false);
  assert.equal(customer.toolsCallSent, false);
  assert.equal(customer.trialPostSent, false);
  assert.equal(customer.purchaseSent, false);
  assert.equal(customer.taskSupportAuthorizesCall, false);
  assert.equal(customer.taskSupport, 'forbidden');
  const paidCustomer = readToolBoundary(paid, CUSTOMER_TASK_READY);
  assert.equal(paidCustomer.class, 'paid');
  assert.equal(paidCustomer.documentedNextAction, 'caller-authority');
  assert.equal(paidCustomer.taskSupport, 'allowed');
  assert.equal(paidCustomer.taskSupportAuthorizesCall, false);
  assert.equal(paidCustomer.toolsCallSent, false);
  assert.equal(JSON.stringify(paidCustomer).includes('5000'), false);
  assert.equal(JSON.stringify(paidCustomer).includes('payTo'), false);
  assert.equal(JSON.stringify(paidCustomer).includes('0xfixture'), false);
  const otherFree = readToolBoundary({
    name: 'page_change',
    inputSchema: { type: 'object', properties: {} },
    _meta: { samedaydesk: { charged: false, paymentRequired: false } },
  }, CUSTOMER_TASK_READY);
  assert.equal(otherFree.documentedNextAction, 'free-mark-is-not-a-call');
  assert.equal(classifyListedTool({ name: 'broken' }).reason, 'missing-input-schema');
  assert.equal(classifyListedTool({
    name: 'half',
    inputSchema: { type: 'object', properties: {} },
    _meta: { samedaydesk: { charged: false } },
  }).class, 'refusal');
  assert.equal(classifyListedTool({
    name: 'both',
    inputSchema: { type: 'object', properties: {} },
    _meta: {
      x402: { paymentRequired: true, accepts: [{ amount: '1' }] },
      samedaydesk: { paymentRequired: false, charged: false },
    },
  }).reason, 'contradictory-marks');
  assert.equal(classifyListedTool({
    name: 'odd',
    inputSchema: { type: 'object', properties: {} },
    _meta: { x402: { paymentRequired: false } },
  }).class, 'refusal');
  assert.throws(() => readToolBoundary(trial, 'host-task'), ProtocolError);
  const inventory = readInventory([trial, paid, { name: 'broken' }], CUSTOMER_TASK_READY);
  assert.deepEqual(inventory.free, ['trial_read']);
  assert.deepEqual(inventory.paid, ['read']);
  assert.deepEqual(inventory.refusal, ['broken']);
  assert.equal(inventory.toolsCallSent, false);
});

const PUBLIC_PAGE = 'https://example.com/root23200-synthetic-page';

function callMessages(fixture) {
  return fixture.requests.filter((message) => message && message.method === 'tools/call');
}

test('customer fixture refuses production and trial routes before send', async () => {
  let fetches = 0;
  const fetchImpl = async () => {
    fetches += 1;
    throw new Error('fetch must not run');
  };
  await assert.rejects(
    () => customerFreeRead(ENDPOINT, PUBLIC_PAGE, { fetchImpl }),
    (error) => error instanceof ProtocolError && /synthetic local MCP/.test(error.message),
  );
  await assert.rejects(
    () => customerFreeRead('https://agents.samedaydesk.com/trial/read', PUBLIC_PAGE, { fetchImpl }),
    (error) => error instanceof ProtocolError && /trial consumption refused before send/.test(error.message),
  );
  await assert.rejects(
    () => customerFreeRead('http://127.0.0.1:9/mcp', 'http://example.com/page', { fetchImpl }),
    (error) => error instanceof ProtocolError && /https without credentials/.test(error.message),
  );
  await assert.rejects(
    () => discover('https://agents.samedaydesk.com/trial/read', { fetchImpl }),
    (error) => error instanceof ProtocolError && /trial consumption refused before send/.test(error.message),
  );
  await assert.rejects(
    () => probeUnsupported('https://agents.samedaydesk.com/trial/extract', 'prompts/list', { fetchImpl }),
    (error) => error instanceof ProtocolError && /trial consumption refused before send/.test(error.message),
  );
  assert.equal(fetches, 0);
});

test('positive fixture reads one synthetic URL with one ordinary tools/call', async () => {
  const fixture = await startFixture('customer-useful');
  try {
    const found = await customerFreeRead(fixture.url, PUBLIC_PAGE);
    assert.equal(found.outcome, 'useful');
    assert.equal(found.reason, 'structured-read');
    assert.equal(found.structured.ok, true);
    assert.equal(found.structured.sourceOk, true);
    assert.equal(found.structured.charged, false);
    assert.equal(found.structured.truncated, false);
    assert.match(found.structured.markdown, /root23200-synthetic-page/);
    assert.deepEqual(found.sent, ['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
    assert.equal(found.toolsCallSent, true);
    assert.equal(found.consumingRequests, 1);
    assert.equal(found.retried, false);
    assert.equal(found.taskAugmented, false);
    assert.equal(found.purchaseSent, false);
    assert.equal(found.trialPostSent, false);
    assert.equal(found.paidRequestSent, false);
    const calls = callMessages(fixture);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].params.name, 'trial_read');
    assert.equal(Object.hasOwn(calls[0].params, 'task'), false);
    assert.deepEqual(calls[0].params.arguments, { url: PUBLIC_PAGE });
    assert.equal(fixture.requests.some((message) => message && message.params && message.params.name === 'read'), false);
    assert.equal(JSON.stringify(fixture.requests).includes('/trial/'), false);
    assert.equal(JSON.stringify(fixture.requests).includes('payTo'), false);
    const callHeaders = fixture.headerLog.at(-1).headers;
    assert.equal(callHeaders['mcp-session-id'], 'fixture-session');
    assert.equal(callHeaders.authorization, null);
    assert.equal(callHeaders['x-samedaydesk-agent-source'], null);
  } finally {
    await fixture.close();
  }
});

test('live schema limit is sent once and an overlong URL does not call', async () => {
  const limited = await startFixture('customer-useful');
  try {
    const found = await customerFreeRead(limited.url, PUBLIC_PAGE, { markdownLimitChars: 1000 });
    assert.equal(found.outcome, 'useful');
    assert.equal(found.consumingRequests, 1);
    assert.deepEqual(callMessages(limited)[0].params.arguments, {
      url: PUBLIC_PAGE,
      markdownLimitChars: 1000,
    });
    assert.equal(Object.hasOwn(callMessages(limited)[0].params, 'task'), false);
  } finally {
    await limited.close();
  }
  const tooLong = await startFixture('customer-useful');
  try {
    const page = `https://example.com/${'a'.repeat(2048)}`;
    const found = await customerFreeRead(tooLong.url, page);
    assert.equal(found.outcome, 'refused');
    assert.equal(found.reason, 'public url outside live schema');
    assert.equal(found.toolsCallSent, false);
    assert.equal(found.consumingRequests, 0);
    assert.equal(callMessages(tooLong).length, 0);
  } finally {
    await tooLong.close();
  }
});

test('reader list classifies free paid and refusal without tools/call', async () => {
  const fixture = await startFixture('reader-list');
  try {
    const found = await discover(fixture.url);
    assert.deepEqual(found.sent, ['initialize', 'notifications/initialized', 'tools/list']);
    const inventory = readInventory(found.tools, CUSTOMER_TASK_READY);
    assert.deepEqual(inventory.free, ['trial_read', 'page_change']);
    assert.deepEqual(inventory.paid, ['read']);
    assert.deepEqual(inventory.refusal, ['contradictory']);
    assert.equal(inventory.rows.find((row) => row.name === 'trial_read').documentedNextAction, 'one-ordinary-free-trial-read');
    assert.equal(inventory.rows.find((row) => row.name === 'read').documentedNextAction, 'caller-authority');
    assert.equal(inventory.rows.find((row) => row.name === 'read').taskSupportAuthorizesCall, false);
    assert.equal(JSON.stringify(inventory).includes('5000'), false);
    assert.equal(JSON.stringify(inventory).includes('payTo'), false);
    const operator = readInventory(found.tools, OPERATOR_DISCOVERY_QA);
    assert.equal(operator.rows.every((row) => row.documentedNextAction === 'stop-after-unpaid-list'), true);
    assert.equal(fixture.requests.some((message) => message.method === 'tools/call'), false);
    assert.equal(JSON.stringify(fixture.requests).includes('/trial/'), false);
  } finally {
    await fixture.close();
  }
});

test('a listed tool without an input schema stops before tools/call', async () => {
  const fixture = await startFixture('missing-schema');
  try {
    await assert.rejects(
      () => discover(fixture.url),
      (error) => error instanceof ProtocolError && /tool missing inputSchema: broken/.test(error.message),
    );
    assert.deepEqual(fixture.requests.map((message) => message.method), [
      'initialize',
      'notifications/initialized',
      'tools/list',
    ]);
  } finally {
    await fixture.close();
  }
});

test('exhausted, expired, and refused reads stop without a paid call or a retry', async () => {
  for (const [mode, outcome] of [
    ['customer-exhausted', 'exhausted'],
    ['customer-expired', 'expired'],
    ['customer-refused', 'refused'],
  ]) {
    const fixture = await startFixture(mode);
    try {
      const found = await customerFreeRead(fixture.url, PUBLIC_PAGE);
      assert.equal(found.outcome, outcome, mode);
      assert.equal(found.consumingRequests, 1, mode);
      assert.equal(found.retried, false, mode);
      assert.equal(found.purchaseSent, false, mode);
      assert.equal(found.paidRequestSent, false, mode);
      assert.equal(callMessages(fixture).length, 1, mode);
      assert.equal(callMessages(fixture)[0].params.name, 'trial_read', mode);
      assert.equal(fixture.requests.some((message) => message && message.params && message.params.name === 'read'), false, mode);
    } finally {
      await fixture.close();
    }
  }
});

test('missing trial_read and required task augmentation do not send tools/call', async () => {
  const missing = await startFixture('customer-missing');
  try {
    const found = await customerFreeRead(missing.url, PUBLIC_PAGE);
    assert.equal(found.outcome, 'missing');
    assert.equal(found.toolsCallSent, false);
    assert.equal(found.consumingRequests, 0);
    assert.deepEqual(found.sent, ['initialize', 'notifications/initialized', 'tools/list']);
    assert.equal(callMessages(missing).length, 0);
  } finally {
    await missing.close();
  }
  const required = await startFixture('customer-task-required');
  try {
    const found = await customerFreeRead(required.url, PUBLIC_PAGE);
    assert.equal(found.outcome, 'refused');
    assert.equal(found.reason, 'task-augmentation-required');
    assert.equal(found.toolsCallSent, false);
    assert.equal(found.taskAugmented, false);
    assert.equal(callMessages(required).length, 0);
  } finally {
    await required.close();
  }
});

test('a lost response and a payment challenge do not retry or purchase', async () => {
  const lost = await startFixture('customer-lost');
  try {
    const found = await customerFreeRead(lost.url, PUBLIC_PAGE);
    assert.equal(found.outcome, 'unknown');
    assert.equal(found.reason, 'lost-response');
    assert.equal(found.consumingRequests, 1);
    assert.equal(found.retried, false);
    assert.equal(found.purchaseSent, false);
    assert.equal(callMessages(lost).length, 1);
  } finally {
    await lost.close();
  }
  const dropped = await startFixture('customer-useful');
  try {
    let toolCalls = 0;
    const fetchImpl = async (url, init) => {
      const message = JSON.parse(init.body);
      if (message.method === 'tools/call') {
        toolCalls += 1;
        throw new Error('socket reset');
      }
      return fetch(url, init);
    };
    const found = await customerFreeRead(dropped.url, PUBLIC_PAGE, { fetchImpl });
    assert.equal(toolCalls, 1);
    assert.equal(found.outcome, 'unknown');
    assert.equal(found.reason, 'lost-response');
    assert.equal(found.retried, false);
    assert.equal(found.consumingRequests, 1);
    assert.equal(found.purchaseSent, false);
  } finally {
    await dropped.close();
  }
  const challenge = await startFixture('customer-payment');
  try {
    const found = await customerFreeRead(challenge.url, PUBLIC_PAGE);
    assert.equal(found.outcome, 'caller-authority');
    assert.equal(found.reason, 'payment-challenge');
    assert.equal(found.purchaseSent, false);
    assert.equal(found.paidRequestSent, false);
    assert.equal(found.retried, false);
    assert.equal(callMessages(challenge).length, 1);
    assert.equal(callMessages(challenge)[0].params.name, 'trial_read');
  } finally {
    await challenge.close();
  }
});

test('discovery mode still refuses tools/call when the fixture would accept one', async () => {
  const fixture = await startFixture('customer-useful');
  try {
    const found = await discover(fixture.url);
    assert.equal(found.tools.some((tool) => tool.name === 'trial_read'), true);
    await assert.rejects(
      () => customerFreeRead(fixture.url, PUBLIC_PAGE, { task: { ttl: 1000 } }),
      (error) => error instanceof ProtocolError && /task augmentation refused before send/.test(error.message),
    );
    await assert.rejects(
      () => probeUnsupported(fixture.url, 'tools/call'),
      (error) => error instanceof ProtocolError && /discovery mode refuses tools\/call before send/.test(error.message),
    );
    assert.equal(fixture.requests.some((message) => message.method === 'tools/call'), false);
  } finally {
    await fixture.close();
  }
});
