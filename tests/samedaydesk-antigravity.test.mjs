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
  customerTaskReadyCall,
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
  assert.equal(observed.hostLoadedExchange.received, false);
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
  assert.equal(observed.hostName.hostLoadedAfterRename, false);
  assert.equal(observed.hostName.installReRun, false);
  assert.equal(observed.hostName.schemaHasToolIdAlias, false);
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

test('skill states unpaid discovery, unqualified attribution, and no tool call', () => {
  const skill = readPlugin('skills/samedaydesk-remote-mcp/SKILL.md');
  assert.match(skill, /^---\nname: samedaydesk-remote-mcp\n/);
  assert.match(skill, /description: .+/);
  assert.match(skill, new RegExp(ENDPOINT.replaceAll('/', '\\/')));
  assert.match(skill, /Attribution is unqualified/);
  assert.match(skill, /Do not send `tools\/call`/);
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
  assert.match(skill, /Skill prose is not that filter/);
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
      (error) => error instanceof ProtocolError && /paid tool request refused before send/.test(error.message),
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
  assert.equal(observed.qualificationHistory.at(-1).id, 'ROOT22600');
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
  assert.equal(customer.documentedNextAction, 'authorized-caller-live-trial-read-schema');
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

test('customer task-ready prose cannot send tools/call or consume a trial', async () => {
  let fetches = 0;
  const fetchImpl = async () => {
    fetches += 1;
    throw new Error('fetch must not run');
  };
  assert.throws(
    () => customerTaskReadyCall('tools/call', 'https://agents.samedaydesk.com/trial/read', { fetchImpl }),
    (error) => error instanceof ProtocolError && /paid tool request refused before send/.test(error.message),
  );
  assert.throws(
    () => customerTaskReadyCall('tools/list', 'https://agents.samedaydesk.com/trial/extract', { fetchImpl }),
    (error) => error instanceof ProtocolError && /trial consumption refused before send/.test(error.message),
  );
  assert.throws(
    () => customerTaskReadyCall('tools/list', `${ENDPOINT}?trial=1`, { fetchImpl }),
    (error) => error instanceof ProtocolError && /customer task-ready does not send from this client/.test(error.message),
  );
  await assert.rejects(
    () => discover('https://agents.samedaydesk.com/trial/read', { fetchImpl }),
    (error) => error instanceof ProtocolError && /trial consumption refused before send/.test(error.message),
  );
  await assert.rejects(
    () => probeUnsupported('https://agents.samedaydesk.com/trial/read', 'prompts/list', { fetchImpl }),
    (error) => error instanceof ProtocolError && /trial consumption refused before send/.test(error.message),
  );
  assert.equal(fetches, 0);
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
    assert.equal(inventory.rows.find((row) => row.name === 'trial_read').documentedNextAction, 'authorized-caller-live-trial-read-schema');
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
